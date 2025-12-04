/**
 * NavigationManager - Tab navigation event handling and auto-reinjection
 * @module background/NavigationManager
 * @version 1.0.0
 * 
 * Manages tab navigation lifecycle:
 * - Detect navigation in tracked tabs
 * - Auto-reinject content scripts after navigation
 * - Handle frame navigation (main + iframes)
 * - Track tab close events for cleanup
 * - Debounce rapid navigation events
 * 
 * Addresses:
 * - "Tab Navigation: content script lost - no re-injection"
 * - "webNavigation events fire for all tabs - must filter"
 * 
 * @see background-service_breakdown.md for navigation patterns
 */

import type { BackgroundConfig } from './BackgroundConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome webNavigation API interface (for testing)
 */
export interface IChromeWebNavigation {
  onBeforeNavigate: ChromeEvent<chrome.webNavigation.WebNavigationParentedCallbackDetails>;
  onCommitted: ChromeEvent<chrome.webNavigation.WebNavigationTransitionCallbackDetails>;
  onDOMContentLoaded: ChromeEvent<chrome.webNavigation.WebNavigationFramedCallbackDetails>;
  onCompleted: ChromeEvent<chrome.webNavigation.WebNavigationFramedCallbackDetails>;
  onErrorOccurred: ChromeEvent<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails>;
  onHistoryStateUpdated: ChromeEvent<chrome.webNavigation.WebNavigationTransitionCallbackDetails>;
  onReferenceFragmentUpdated: ChromeEvent<chrome.webNavigation.WebNavigationTransitionCallbackDetails>;
}

/**
 * Chrome tabs API interface (for testing)
 */
export interface IChromeTabs {
  onRemoved: ChromeEvent<number, chrome.tabs.TabRemoveInfo>;
  onUpdated: ChromeEvent<number, chrome.tabs.TabChangeInfo, chrome.tabs.Tab>;
}

/**
 * Chrome event interface
 */
interface ChromeEvent<T, U = void, V = void> {
  addListener(callback: V extends void ? (U extends void ? (details: T) => void : (arg1: T, arg2: U) => void) : (arg1: T, arg2: U, arg3: V) => void): void;
  removeListener(callback: V extends void ? (U extends void ? (details: T) => void : (arg1: T, arg2: U) => void) : (arg1: T, arg2: U, arg3: V) => void): void;
  hasListener(callback: V extends void ? (U extends void ? (details: T) => void : (arg1: T, arg2: U) => void) : (arg1: T, arg2: U, arg3: V) => void): boolean;
}

/**
 * Navigation event types
 */
export type NavigationEventType =
  | 'before_navigate'
  | 'committed'
  | 'dom_content_loaded'
  | 'completed'
  | 'error'
  | 'history_state_updated'
  | 'fragment_updated'
  | 'tab_removed'
  | 'tab_updated'
  | 'reinjection_scheduled'
  | 'reinjection_completed'
  | 'reinjection_failed';

/**
 * Navigation event
 */
export interface NavigationEvent {
  type: NavigationEventType;
  tabId: number;
  frameId: number;
  url?: string;
  timestamp: Date;
  transitionType?: string;
  transitionQualifiers?: string[];
  error?: string;
}

/**
 * Navigation event listener
 */
export type NavigationEventListener = (event: NavigationEvent) => void;

/**
 * Tab navigation state
 */
export interface TabNavigationState {
  tabId: number;
  url: string;
  frameId: number;
  status: 'navigating' | 'loading' | 'complete' | 'error';
  startedAt: Date;
  completedAt?: Date;
  injectionPending: boolean;
  lastInjection?: Date;
}

/**
 * Injection callback
 */
export type InjectionCallback = (tabId: number, allFrames: boolean) => Promise<boolean>;

/**
 * Tab removed callback
 */
export type TabRemovedCallback = (tabId: number) => void;

// ============================================================================
// NAVIGATION MANAGER CLASS
// ============================================================================

/**
 * NavigationManager - Handles tab navigation and auto-reinjection
 * 
 * @example
 * ```typescript
 * const manager = new NavigationManager(config);
 * 
 * // Set tracked tabs (tabs that should auto-reinject)
 * manager.setTrackedTabs(new Set([1, 2, 3]));
 * 
 * // Set injection callback
 * manager.setInjectionCallback(async (tabId, allFrames) => {
 *   await chromeScripting.executeScript(...);
 *   return true;
 * });
 * 
 * // Start listening
 * manager.start();
 * 
 * // Stop when done
 * manager.stop();
 * ```
 */
export class NavigationManager {
  private config: BackgroundConfig;
  private chromeWebNavigation: IChromeWebNavigation | null;
  private chromeTabs: IChromeTabs | null;

  // Tracked tabs that should auto-reinject
  private trackedTabs: Set<number> = new Set();

  // Navigation state per tab
  private navigationState: Map<number, TabNavigationState> = new Map();

  // Pending injections (debounce)
  private pendingInjections: Map<number, ReturnType<typeof setTimeout>> = new Map();

  // Callbacks
  private injectionCallback: InjectionCallback | null = null;
  private tabRemovedCallback: TabRemovedCallback | null = null;

  // Event listeners
  private eventListeners: Set<NavigationEventListener> = new Set();

  // Bound listener references (for removal)
  private boundOnBeforeNavigate: ((details: chrome.webNavigation.WebNavigationParentedCallbackDetails) => void) | null = null;
  private boundOnCommitted: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null;
  private boundOnDOMContentLoaded: ((details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void) | null = null;
  private boundOnCompleted: ((details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void) | null = null;
  private boundOnErrorOccurred: ((details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails) => void) | null = null;
  private boundOnHistoryStateUpdated: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null;
  private boundOnTabRemoved: ((tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void) | null = null;

  // State
  private isListening: boolean = false;

  // Statistics
  private stats = {
    navigationsDetected: 0,
    reinjectionAttempts: 0,
    reinjectionSuccesses: 0,
    reinjectionFailures: 0,
    tabsRemoved: 0,
  };

  /**
   * Create NavigationManager
   */
  constructor(
    config: BackgroundConfig,
    chromeWebNavigation?: IChromeWebNavigation | null,
    chromeTabs?: IChromeTabs | null
  ) {
    this.config = config;
    this.chromeWebNavigation = chromeWebNavigation ?? this.getDefaultChromeWebNavigation();
    this.chromeTabs = chromeTabs ?? this.getDefaultChromeTabs();
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Start listening for navigation events
   */
  public start(): void {
    if (this.isListening) {
      return;
    }

    if (!this.chromeWebNavigation) {
      console.warn('[NavigationManager] WebNavigation API not available');
      return;
    }

    // Create bound listeners
    this.boundOnBeforeNavigate = this.handleBeforeNavigate.bind(this);
    this.boundOnCommitted = this.handleCommitted.bind(this);
    this.boundOnDOMContentLoaded = this.handleDOMContentLoaded.bind(this);
    this.boundOnCompleted = this.handleCompleted.bind(this);
    this.boundOnErrorOccurred = this.handleErrorOccurred.bind(this);
    this.boundOnHistoryStateUpdated = this.handleHistoryStateUpdated.bind(this);

    // Add webNavigation listeners
    this.chromeWebNavigation.onBeforeNavigate.addListener(this.boundOnBeforeNavigate);
    this.chromeWebNavigation.onCommitted.addListener(this.boundOnCommitted);
    this.chromeWebNavigation.onDOMContentLoaded.addListener(this.boundOnDOMContentLoaded);
    this.chromeWebNavigation.onCompleted.addListener(this.boundOnCompleted);
    this.chromeWebNavigation.onErrorOccurred.addListener(this.boundOnErrorOccurred);
    this.chromeWebNavigation.onHistoryStateUpdated.addListener(this.boundOnHistoryStateUpdated);

    // Add tabs listener for cleanup
    if (this.chromeTabs) {
      this.boundOnTabRemoved = this.handleTabRemoved.bind(this);
      this.chromeTabs.onRemoved.addListener(this.boundOnTabRemoved);
    }

    this.isListening = true;
  }

  /**
   * Stop listening for navigation events
   */
  public stop(): void {
    if (!this.isListening) {
      return;
    }

    if (this.chromeWebNavigation) {
      if (this.boundOnBeforeNavigate) {
        this.chromeWebNavigation.onBeforeNavigate.removeListener(this.boundOnBeforeNavigate);
      }
      if (this.boundOnCommitted) {
        this.chromeWebNavigation.onCommitted.removeListener(this.boundOnCommitted);
      }
      if (this.boundOnDOMContentLoaded) {
        this.chromeWebNavigation.onDOMContentLoaded.removeListener(this.boundOnDOMContentLoaded);
      }
      if (this.boundOnCompleted) {
        this.chromeWebNavigation.onCompleted.removeListener(this.boundOnCompleted);
      }
      if (this.boundOnErrorOccurred) {
        this.chromeWebNavigation.onErrorOccurred.removeListener(this.boundOnErrorOccurred);
      }
      if (this.boundOnHistoryStateUpdated) {
        this.chromeWebNavigation.onHistoryStateUpdated.removeListener(this.boundOnHistoryStateUpdated);
      }
    }

    if (this.chromeTabs && this.boundOnTabRemoved) {
      this.chromeTabs.onRemoved.removeListener(this.boundOnTabRemoved);
    }

    // Clear pending injections
    for (const timeout of this.pendingInjections.values()) {
      clearTimeout(timeout);
    }
    this.pendingInjections.clear();

    this.isListening = false;
  }

  /**
   * Check if listening
   */
  public isActive(): boolean {
    return this.isListening;
  }

  // ==========================================================================
  // TAB TRACKING
  // ==========================================================================

  /**
   * Set tracked tabs
   */
  public setTrackedTabs(tabs: Set<number>): void {
    this.trackedTabs = new Set(tabs);
  }

  /**
   * Add a tab to tracking
   */
  public trackTab(tabId: number): void {
    this.trackedTabs.add(tabId);
  }

  /**
   * Remove a tab from tracking
   */
  public untrackTab(tabId: number): void {
    this.trackedTabs.delete(tabId);
    this.navigationState.delete(tabId);
    
    // Cancel pending injection
    const pending = this.pendingInjections.get(tabId);
    if (pending) {
      clearTimeout(pending);
      this.pendingInjections.delete(tabId);
    }
  }

  /**
   * Check if tab is tracked
   */
  public isTracked(tabId: number): boolean {
    return this.trackedTabs.has(tabId);
  }

  /**
   * Get tracked tabs
   */
  public getTrackedTabs(): Set<number> {
    return new Set(this.trackedTabs);
  }

  // ==========================================================================
  // CALLBACKS
  // ==========================================================================

  /**
   * Set injection callback
   */
  public setInjectionCallback(callback: InjectionCallback): void {
    this.injectionCallback = callback;
  }

  /**
   * Set tab removed callback
   */
  public setTabRemovedCallback(callback: TabRemovedCallback): void {
    this.tabRemovedCallback = callback;
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle onBeforeNavigate
   */
  private handleBeforeNavigate(details: chrome.webNavigation.WebNavigationParentedCallbackDetails): void {
    if (!this.trackedTabs.has(details.tabId)) {
      return;
    }

    // Only track main frame navigations for injection
    if (details.frameId === 0) {
      this.navigationState.set(details.tabId, {
        tabId: details.tabId,
        url: details.url,
        frameId: details.frameId,
        status: 'navigating',
        startedAt: new Date(),
        injectionPending: true,
      });
    }

    this.stats.navigationsDetected++;

    this.emitEvent({
      type: 'before_navigate',
      tabId: details.tabId,
      frameId: details.frameId,
      url: details.url,
      timestamp: new Date(),
    });
  }

  /**
   * Handle onCommitted
   */
  private handleCommitted(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
    if (!this.trackedTabs.has(details.tabId)) {
      return;
    }

    // Update state
    const state = this.navigationState.get(details.tabId);
    if (state && details.frameId === 0) {
      state.status = 'loading';
      state.url = details.url;
    }

    this.emitEvent({
      type: 'committed',
      tabId: details.tabId,
      frameId: details.frameId,
      url: details.url,
      timestamp: new Date(),
      transitionType: details.transitionType,
      transitionQualifiers: details.transitionQualifiers,
    });

    // Schedule injection after commit (early injection)
    if (details.frameId === 0 && this.config.getInjectionConfig().reinjectOnNavigation) {
      this.scheduleInjection(details.tabId, 'committed');
    }
  }

  /**
   * Handle onDOMContentLoaded
   */
  private handleDOMContentLoaded(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    if (!this.trackedTabs.has(details.tabId)) {
      return;
    }

    this.emitEvent({
      type: 'dom_content_loaded',
      tabId: details.tabId,
      frameId: details.frameId,
      url: details.url,
      timestamp: new Date(),
    });
  }

  /**
   * Handle onCompleted
   */
  private handleCompleted(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    if (!this.trackedTabs.has(details.tabId)) {
      return;
    }

    // Update state
    const state = this.navigationState.get(details.tabId);
    if (state && details.frameId === 0) {
      state.status = 'complete';
      state.completedAt = new Date();
    }

    this.emitEvent({
      type: 'completed',
      tabId: details.tabId,
      frameId: details.frameId,
      url: details.url,
      timestamp: new Date(),
    });

    // Ensure injection on completion
    if (details.frameId === 0 && this.config.getInjectionConfig().reinjectOnNavigation) {
      this.scheduleInjection(details.tabId, 'completed');
    }
  }

  /**
   * Handle onErrorOccurred
   */
  private handleErrorOccurred(details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails): void {
    if (!this.trackedTabs.has(details.tabId)) {
      return;
    }

    // Update state
    const state = this.navigationState.get(details.tabId);
    if (state && details.frameId === 0) {
      state.status = 'error';
    }

    this.emitEvent({
      type: 'error',
      tabId: details.tabId,
      frameId: details.frameId,
      url: details.url,
      timestamp: new Date(),
      error: details.error,
    });
  }

  /**
   * Handle onHistoryStateUpdated (SPA navigation)
   */
  private handleHistoryStateUpdated(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
    if (!this.trackedTabs.has(details.tabId)) {
      return;
    }

    this.emitEvent({
      type: 'history_state_updated',
      tabId: details.tabId,
      frameId: details.frameId,
      url: details.url,
      timestamp: new Date(),
      transitionType: details.transitionType,
    });

    // SPA navigations may need reinjection
    if (details.frameId === 0 && this.config.getInjectionConfig().reinjectOnNavigation) {
      this.scheduleInjection(details.tabId, 'history');
    }
  }

  /**
   * Handle tab removed
   */
  private handleTabRemoved(tabId: number, _removeInfo: chrome.tabs.TabRemoveInfo): void {
    if (!this.trackedTabs.has(tabId)) {
      return;
    }

    this.stats.tabsRemoved++;

    // Clean up
    this.untrackTab(tabId);

    // Notify callback
    if (this.tabRemovedCallback) {
      this.tabRemovedCallback(tabId);
    }

    this.emitEvent({
      type: 'tab_removed',
      tabId,
      frameId: 0,
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // INJECTION SCHEDULING
  // ==========================================================================

  /**
   * Schedule injection with debounce
   */
  private scheduleInjection(tabId: number, _source: string): void {
    // Cancel any pending injection
    const existing = this.pendingInjections.get(tabId);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = this.config.getInjectionConfig().navigationDelay;

    this.emitEvent({
      type: 'reinjection_scheduled',
      tabId,
      frameId: 0,
      timestamp: new Date(),
    });

    const timeout = setTimeout(async () => {
      this.pendingInjections.delete(tabId);
      await this.performInjection(tabId);
    }, delay);

    this.pendingInjections.set(tabId, timeout);
  }

  /**
   * Perform the actual injection
   */
  private async performInjection(tabId: number): Promise<void> {
    if (!this.injectionCallback) {
      console.warn('[NavigationManager] No injection callback set');
      return;
    }

    if (!this.trackedTabs.has(tabId)) {
      return; // Tab was untracked while waiting
    }

    this.stats.reinjectionAttempts++;

    try {
      const success = await this.injectionCallback(tabId, true);

      if (success) {
        this.stats.reinjectionSuccesses++;

        // Update state
        const state = this.navigationState.get(tabId);
        if (state) {
          state.injectionPending = false;
          state.lastInjection = new Date();
        }

        this.emitEvent({
          type: 'reinjection_completed',
          tabId,
          frameId: 0,
          timestamp: new Date(),
        });
      } else {
        this.stats.reinjectionFailures++;

        this.emitEvent({
          type: 'reinjection_failed',
          tabId,
          frameId: 0,
          timestamp: new Date(),
          error: 'Injection returned false',
        });
      }
    } catch (error) {
      this.stats.reinjectionFailures++;

      this.emitEvent({
        type: 'reinjection_failed',
        tabId,
        frameId: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Force immediate injection
   */
  public async forceInjection(tabId: number): Promise<boolean> {
    // Cancel pending
    const existing = this.pendingInjections.get(tabId);
    if (existing) {
      clearTimeout(existing);
      this.pendingInjections.delete(tabId);
    }

    if (!this.injectionCallback) {
      return false;
    }

    try {
      return await this.injectionCallback(tabId, true);
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get navigation state for a tab
   */
  public getNavigationState(tabId: number): TabNavigationState | undefined {
    return this.navigationState.get(tabId);
  }

  /**
   * Get all navigation states
   */
  public getAllNavigationStates(): Map<number, TabNavigationState> {
    return new Map(this.navigationState);
  }

  /**
   * Check if tab has pending injection
   */
  public hasPendingInjection(tabId: number): boolean {
    return this.pendingInjections.has(tabId);
  }

  /**
   * Get statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      navigationsDetected: 0,
      reinjectionAttempts: 0,
      reinjectionSuccesses: 0,
      reinjectionFailures: 0,
      tabsRemoved: 0,
    };
  }

  /**
   * Clear all state
   */
  public clearAll(): void {
    this.trackedTabs.clear();
    this.navigationState.clear();
    
    for (const timeout of this.pendingInjections.values()) {
      clearTimeout(timeout);
    }
    this.pendingInjections.clear();
    
    this.resetStats();
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to navigation events
   */
  public onEvent(listener: NavigationEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: NavigationEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[NavigationManager] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // DEFAULT APIS
  // ==========================================================================

  private getDefaultChromeWebNavigation(): IChromeWebNavigation | null {
    if (typeof chrome !== 'undefined' && chrome.webNavigation) {
      return chrome.webNavigation as unknown as IChromeWebNavigation;
    }
    return null;
  }

  private getDefaultChromeTabs(): IChromeTabs | null {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      return chrome.tabs as unknown as IChromeTabs;
    }
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create NavigationManager instance
 */
export function createNavigationManager(
  config: BackgroundConfig,
  chromeWebNavigation?: IChromeWebNavigation | null,
  chromeTabs?: IChromeTabs | null
): NavigationManager {
  return new NavigationManager(config, chromeWebNavigation, chromeTabs);
}
