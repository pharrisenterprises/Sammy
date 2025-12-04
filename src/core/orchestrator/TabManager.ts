/**
 * TabManager - Manages browser tabs during test execution
 * @module core/orchestrator/TabManager
 * @version 1.0.0
 * 
 * Handles opening tabs, tracking state, script injection, and cleanup.
 * Wraps chrome.tabs and chrome.runtime APIs for orchestrator integration.
 * 
 * @see background-service_breakdown.md for tab management patterns
 * @see test-orchestrator_breakdown.md for orchestrator integration
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tab state tracking
 */
export interface TrackedTab {
  /** Tab ID from Chrome */
  id: number;
  /** URL when tab was opened */
  url: string;
  /** When tab was created */
  createdAt: Date;
  /** Whether content script is injected */
  scriptInjected: boolean;
  /** Last injection time */
  lastInjectedAt?: Date;
  /** Tab ready state */
  status: TabStatus;
  /** Custom label/identifier */
  label?: string;
}

/**
 * Tab status values
 */
export type TabStatus = 
  | 'creating'      // Tab being created
  | 'loading'       // Page loading
  | 'injecting'     // Script being injected
  | 'ready'         // Ready for commands
  | 'navigating'    // Navigation in progress
  | 'closed'        // Tab has been closed
  | 'error';        // Error state

/**
 * Tab open options
 */
export interface TabOpenOptions {
  /** URL to open */
  url: string;
  /** Whether to inject content script. Default: true */
  injectScript?: boolean;
  /** Wait for page load before resolving. Default: true */
  waitForLoad?: boolean;
  /** Timeout in ms. Default: 30000 */
  timeout?: number;
  /** Make tab active. Default: true */
  active?: boolean;
  /** Custom label */
  label?: string;
}

/**
 * Tab open result
 */
export interface TabOpenResult {
  /** Success status */
  success: boolean;
  /** Tab ID if successful */
  tabId?: number;
  /** Error message if failed */
  error?: string;
  /** Time to open (ms) */
  duration?: number;
}

/**
 * Tab close result
 */
export interface TabCloseResult {
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Script injection result
 */
export interface InjectionResult {
  /** Success status */
  success: boolean;
  /** Tab ID */
  tabId: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Tab event types
 */
export type TabEventType = 
  | 'tab_created'
  | 'tab_closed'
  | 'tab_navigated'
  | 'script_injected'
  | 'tab_ready'
  | 'tab_error';

/**
 * Tab event payload
 */
export interface TabEvent {
  type: TabEventType;
  tabId: number;
  url?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Tab event listener
 */
export type TabEventListener = (event: TabEvent) => void;

/**
 * TabManager configuration
 */
export interface TabManagerConfig {
  /** Default timeout for operations (ms). Default: 30000 */
  defaultTimeout: number;
  /** Auto-inject script on open. Default: true */
  autoInject: boolean;
  /** Re-inject on navigation. Default: true */
  reinjectOnNavigation: boolean;
  /** Script file path. Default: 'js/main.js' */
  scriptPath: string;
  /** Inject into all frames. Default: true */
  allFrames: boolean;
  /** Max concurrent tabs. Default: 5 */
  maxConcurrentTabs: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_TAB_MANAGER_CONFIG: TabManagerConfig = {
  defaultTimeout: 30000,
  autoInject: true,
  reinjectOnNavigation: true,
  scriptPath: 'js/main.js',
  allFrames: true,
  maxConcurrentTabs: 5,
};

// ============================================================================
// TAB MANAGER CLASS
// ============================================================================

/**
 * TabManager - Manages browser tabs for test execution
 * 
 * @example
 * ```typescript
 * const tabManager = new TabManager();
 * 
 * // Open a tab
 * const result = await tabManager.openTab({ url: 'https://example.com' });
 * if (result.success) {
 *   const tabId = result.tabId!;
 *   
 *   // Send commands to the tab
 *   await tabManager.sendMessage(tabId, { type: 'runStep', data: stepData });
 *   
 *   // Close when done
 *   await tabManager.closeTab(tabId);
 * }
 * ```
 */
export class TabManager {
  private config: TabManagerConfig;
  private trackedTabs: Map<number, TrackedTab> = new Map();
  private activeTabId: number | null = null;
  private listeners: Set<TabEventListener> = new Set();
  private navigationListenerAttached: boolean = false;

  /**
   * Create a new TabManager
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<TabManagerConfig> = {}) {
    this.config = { ...DEFAULT_TAB_MANAGER_CONFIG, ...config };
  }

  // ==========================================================================
  // TAB OPERATIONS
  // ==========================================================================

  /**
   * Open a new tab
   * 
   * Uses chrome.runtime.sendMessage to background script for actual tab creation.
   * 
   * @param options - Tab open options
   * @returns Promise resolving to open result
   */
  public async openTab(options: TabOpenOptions): Promise<TabOpenResult> {
    const startTime = Date.now();
    const {
      url,
      injectScript = this.config.autoInject,
      waitForLoad = true,
      timeout = this.config.defaultTimeout,
      active = true,
      label,
    } = options;

    // Check concurrent tab limit
    const openTabs = this.getOpenTabs();
    if (openTabs.length >= this.config.maxConcurrentTabs) {
      return {
        success: false,
        error: `Maximum concurrent tabs (${this.config.maxConcurrentTabs}) reached`,
      };
    }

    try {
      // Send message to background script
      const response = await this.sendToBackground<{ success: boolean; tabId?: number; error?: string }>({
        action: 'openTab',
        url,
        inject: injectScript,
        active,
      }, timeout);

      if (!response.success || !response.tabId) {
        return {
          success: false,
          error: response.error || 'Failed to open tab',
          duration: Date.now() - startTime,
        };
      }

      const tabId = response.tabId;

      // Track the tab
      this.trackedTabs.set(tabId, {
        id: tabId,
        url,
        createdAt: new Date(),
        scriptInjected: injectScript,
        lastInjectedAt: injectScript ? new Date() : undefined,
        status: injectScript ? 'ready' : 'loading',
        label,
      });

      this.activeTabId = tabId;

      // Emit event
      this.emitEvent({
        type: 'tab_created',
        tabId,
        url,
        timestamp: new Date(),
      });

      // Attach navigation listeners if needed
      if (this.config.reinjectOnNavigation && !this.navigationListenerAttached) {
        this.attachNavigationListeners();
      }

      return {
        success: true,
        tabId,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Close a tab
   * 
   * @param tabId - Tab ID to close (or current active tab if not specified)
   * @returns Promise resolving to close result
   */
  public async closeTab(tabId?: number): Promise<TabCloseResult> {
    const targetTabId = tabId ?? this.activeTabId;
    
    if (!targetTabId) {
      return { success: false, error: 'No tab to close' };
    }

    try {
      const response = await this.sendToBackground<{ success: boolean; error?: string }>({
        action: 'closeTab',
        tabId: targetTabId,
      });

      if (response.success) {
        // Update tracking
        const tab = this.trackedTabs.get(targetTabId);
        if (tab) {
          tab.status = 'closed';
        }
        this.trackedTabs.delete(targetTabId);
        
        if (this.activeTabId === targetTabId) {
          this.activeTabId = null;
        }

        // Emit event
        this.emitEvent({
          type: 'tab_closed',
          tabId: targetTabId,
          timestamp: new Date(),
        });
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Close the currently active tab
   */
  public async closeActiveTab(): Promise<TabCloseResult> {
    return this.closeTab(this.activeTabId ?? undefined);
  }

  /**
   * Close all tracked tabs
   */
  public async closeAllTabs(): Promise<{ closed: number; failed: number }> {
    let closed = 0;
    let failed = 0;

    const tabIds = Array.from(this.trackedTabs.keys());
    
    for (const tabId of tabIds) {
      const result = await this.closeTab(tabId);
      if (result.success) {
        closed++;
      } else {
        failed++;
      }
    }

    return { closed, failed };
  }

  // ==========================================================================
  // SCRIPT INJECTION
  // ==========================================================================

  /**
   * Inject content script into a tab
   * 
   * @param tabId - Tab ID to inject into
   * @returns Promise resolving to injection result
   */
  public async injectScript(tabId: number): Promise<InjectionResult> {
    try {
      const response = await this.sendToBackground<{ success: boolean; error?: string }>({
        action: 'injectScript',
        tabId,
        scriptPath: this.config.scriptPath,
        allFrames: this.config.allFrames,
      });

      if (response.success) {
        const tab = this.trackedTabs.get(tabId);
        if (tab) {
          tab.scriptInjected = true;
          tab.lastInjectedAt = new Date();
          tab.status = 'ready';
        }

        this.emitEvent({
          type: 'script_injected',
          tabId,
          timestamp: new Date(),
        });
      }

      return { ...response, tabId };
    } catch (error) {
      return {
        success: false,
        tabId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Re-inject scripts into all tracked tabs
   */
  public async reinjectAll(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const tabId of this.trackedTabs.keys()) {
      const result = await this.injectScript(tabId);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  // ==========================================================================
  // TAB COMMUNICATION
  // ==========================================================================

  /**
   * Send a message to a tab's content script
   * 
   * @param tabId - Tab ID to send to
   * @param message - Message payload
   * @param timeout - Timeout in ms
   * @returns Promise resolving to response
   */
  public async sendMessage<T = unknown>(
    tabId: number,
    message: unknown,
    timeout: number = this.config.defaultTimeout
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Use chrome.tabs.sendMessage for content script communication
        if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response as T);
            }
          });
        } else {
          // Mock environment - resolve immediately
          clearTimeout(timeoutId);
          resolve({} as T);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Send message to active tab
   */
  public async sendToActiveTab<T = unknown>(
    message: unknown,
    timeout?: number
  ): Promise<T> {
    if (!this.activeTabId) {
      throw new Error('No active tab');
    }
    return this.sendMessage<T>(this.activeTabId, message, timeout);
  }

  // ==========================================================================
  // TAB STATE QUERIES
  // ==========================================================================

  /**
   * Get tracked tab by ID
   */
  public getTab(tabId: number): TrackedTab | undefined {
    return this.trackedTabs.get(tabId);
  }

  /**
   * Get active tab ID
   */
  public getActiveTabId(): number | null {
    return this.activeTabId;
  }

  /**
   * Get active tab
   */
  public getActiveTab(): TrackedTab | undefined {
    return this.activeTabId ? this.trackedTabs.get(this.activeTabId) : undefined;
  }

  /**
   * Set active tab
   */
  public setActiveTab(tabId: number): boolean {
    if (this.trackedTabs.has(tabId)) {
      this.activeTabId = tabId;
      return true;
    }
    return false;
  }

  /**
   * Check if tab is tracked
   */
  public isTracked(tabId: number): boolean {
    return this.trackedTabs.has(tabId);
  }

  /**
   * Check if tab is ready for commands
   */
  public isReady(tabId: number): boolean {
    const tab = this.trackedTabs.get(tabId);
    return tab?.status === 'ready';
  }

  /**
   * Get all tracked tabs
   */
  public getAllTabs(): TrackedTab[] {
    return Array.from(this.trackedTabs.values());
  }

  /**
   * Get open (non-closed) tabs
   */
  public getOpenTabs(): TrackedTab[] {
    return this.getAllTabs().filter(t => t.status !== 'closed');
  }

  /**
   * Get tab count
   */
  public getTabCount(): number {
    return this.trackedTabs.size;
  }

  /**
   * Check if any tabs are open
   */
  public hasOpenTabs(): boolean {
    return this.getOpenTabs().length > 0;
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to tab events
   * 
   * @param listener - Event listener
   * @returns Unsubscribe function
   */
  public onEvent(listener: TabEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  public offEvent(listener: TabEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit a tab event
   */
  private emitEvent(event: TabEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[TabManager] Error in event listener:', error);
      }
    });
  }

  /**
   * Handle tab navigation
   */
  public handleNavigation(tabId: number, url: string): void {
    const tab = this.trackedTabs.get(tabId);
    if (!tab) return;

    tab.url = url;
    tab.status = 'navigating';

    this.emitEvent({
      type: 'tab_navigated',
      tabId,
      url,
      timestamp: new Date(),
    });

    // Re-inject if configured
    if (this.config.reinjectOnNavigation) {
      this.injectScript(tabId).then(result => {
        if (result.success) {
          tab.status = 'ready';
          this.emitEvent({
            type: 'tab_ready',
            tabId,
            url,
            timestamp: new Date(),
          });
        }
      });
    }
  }

  /**
   * Attach Chrome navigation listeners
   */
  private attachNavigationListeners(): void {
    if (this.navigationListenerAttached) return;
    
    if (typeof chrome !== 'undefined' && chrome.webNavigation) {
      chrome.webNavigation.onCompleted.addListener((details) => {
        if (this.trackedTabs.has(details.tabId)) {
          this.handleNavigation(details.tabId, details.url);
        }
      });
      
      this.navigationListenerAttached = true;
    }
  }

  // ==========================================================================
  // BACKGROUND COMMUNICATION
  // ==========================================================================

  /**
   * Send message to background script
   */
  private sendToBackground<T>(
    message: Record<string, unknown>,
    timeout: number = this.config.defaultTimeout
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Background message timeout after ${timeout}ms`));
      }, timeout);

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response as T);
            }
          });
        } else {
          // Mock environment - simulate success
          clearTimeout(timeoutId);
          resolve({ success: true, tabId: Date.now() } as unknown as T);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // ==========================================================================
  // CONFIGURATION & LIFECYCLE
  // ==========================================================================

  /**
   * Get current configuration
   */
  public getConfig(): TabManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TabManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset manager state
   */
  public reset(): void {
    this.trackedTabs.clear();
    this.activeTabId = null;
  }

  /**
   * Dispose manager and close all tabs
   */
  public async dispose(): Promise<void> {
    await this.closeAllTabs();
    this.listeners.clear();
    this.reset();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a TabManager instance
 * 
 * @param config - Optional configuration
 * @returns Configured TabManager
 */
export function createTabManager(
  config?: Partial<TabManagerConfig>
): TabManager {
  return new TabManager(config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wait for tab to be ready
 * 
 * @param tabManager - TabManager instance
 * @param tabId - Tab ID
 * @param timeout - Timeout in ms
 * @returns Promise that resolves when tab is ready
 */
export async function waitForTabReady(
  tabManager: TabManager,
  tabId: number,
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (tabManager.isReady(tabId)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * Open tab and wait for ready
 */
export async function openTabAndWait(
  tabManager: TabManager,
  options: TabOpenOptions
): Promise<TabOpenResult> {
  const result = await tabManager.openTab(options);
  
  if (result.success && result.tabId) {
    const ready = await waitForTabReady(tabManager, result.tabId, options.timeout);
    if (!ready) {
      return {
        ...result,
        success: false,
        error: 'Tab did not become ready in time',
      };
    }
  }
  
  return result;
}
