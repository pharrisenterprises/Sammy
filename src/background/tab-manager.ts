/**
 * @fileoverview Tab lifecycle management for extension
 * @module background/tab-manager
 * @version 1.0.0
 * 
 * This module manages tab lifecycle, content script injection,
 * and tab-to-extension communication.
 * 
 * TAB TRACKING:
 * - Track which tabs have content scripts
 * - Monitor tab creation, update, removal
 * - Handle navigation and page reloads
 * 
 * CONTENT SCRIPT INJECTION:
 * - Lazy injection on first interaction
 * - Re-injection on navigation
 * - Frame support for iframes
 * 
 * @see PHASE_4_SPECIFICATIONS.md for tab management specifications
 * @see background-service_breakdown.md for architecture details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tracked tab information
 */
export interface TrackedTab {
  /** Tab ID */
  id: number;
  /** Current URL */
  url: string;
  /** Tab title */
  title: string;
  /** Window ID */
  windowId: number;
  /** Whether content script is injected */
  hasContentScript: boolean;
  /** Whether content script is ready */
  isReady: boolean;
  /** Injection timestamp */
  injectedAt: number | null;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Number of injection attempts */
  injectionAttempts: number;
  /** Last error message */
  lastError: string | null;
  /** Frames with content scripts */
  frames: Map<number, FrameInfo>;
}

/**
 * Frame information
 */
export interface FrameInfo {
  /** Frame ID */
  frameId: number;
  /** Frame URL */
  url: string;
  /** Whether content script is injected */
  hasContentScript: boolean;
  /** Parent frame ID */
  parentFrameId: number;
}

/**
 * Tab event types
 */
export type TabEventType = 
  | 'created'
  | 'updated'
  | 'removed'
  | 'activated'
  | 'injected'
  | 'ready'
  | 'error';

/**
 * Tab event
 */
export interface TabEvent {
  /** Event type */
  type: TabEventType;
  /** Tab ID */
  tabId: number;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data?: unknown;
}

/**
 * Tab event listener
 */
export type TabEventListener = (event: TabEvent) => void;

/**
 * Tab manager configuration
 */
export interface TabManagerConfig {
  /** Content script path */
  contentScriptPath?: string;
  /** CSS files to inject */
  cssFiles?: string[];
  /** Auto-inject on navigation */
  autoInjectOnNavigation?: boolean;
  /** Max injection attempts */
  maxInjectionAttempts?: number;
  /** Injection retry delay (ms) */
  injectionRetryDelay?: number;
  /** URL patterns to allow injection */
  allowedUrlPatterns?: RegExp[];
  /** URL patterns to block injection */
  blockedUrlPatterns?: RegExp[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Injection result
 */
export interface InjectionResult {
  /** Whether injection succeeded */
  success: boolean;
  /** Tab ID */
  tabId: number;
  /** Frame ID (0 for main frame) */
  frameId: number;
  /** Error message if failed */
  error?: string;
  /** Injection timestamp */
  timestamp: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default tab manager configuration
 */
export const DEFAULT_TAB_MANAGER_CONFIG: Required<TabManagerConfig> = {
  contentScriptPath: 'content/content.js',
  cssFiles: [],
  autoInjectOnNavigation: true,
  maxInjectionAttempts: 3,
  injectionRetryDelay: 500,
  allowedUrlPatterns: [/^https?:\/\//],
  blockedUrlPatterns: [
    /^chrome:\/\//,
    /^chrome-extension:\/\//,
    /^about:/,
    /^edge:\/\//,
    /^brave:\/\//
  ],
  debug: false
};

/**
 * Content script ready message action
 */
export const CONTENT_SCRIPT_READY_ACTION = 'content_script_ready';

// ============================================================================
// TAB MANAGER CLASS
// ============================================================================

/**
 * Tab Manager
 * 
 * Manages tab lifecycle and content script injection.
 * 
 * @example
 * ```typescript
 * const tabManager = new TabManager();
 * await tabManager.initialize();
 * 
 * // Listen for tab events
 * tabManager.on('injected', (event) => {
 *   console.log('Content script injected in tab:', event.tabId);
 * });
 * 
 * // Inject into specific tab
 * await tabManager.injectContentScript(tabId);
 * 
 * // Get tab info
 * const tab = tabManager.getTab(tabId);
 * ```
 */
export class TabManager {
  private tabs: Map<number, TrackedTab> = new Map();
  private config: Required<TabManagerConfig>;
  private listeners: Set<TabEventListener> = new Set();
  private initialized: boolean = false;

  constructor(config: TabManagerConfig = {}) {
    this.config = { ...DEFAULT_TAB_MANAGER_CONFIG, ...config };
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize tab manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Already initialized');
      return;
    }

    this.log('Initializing...');

    // Set up Chrome event listeners
    this.setupEventListeners();

    // Query existing tabs
    await this.queryExistingTabs();

    this.initialized = true;
    this.log('Initialized successfully');
  }

  /**
   * Set up Chrome tab event listeners
   */
  private setupEventListeners(): void {
    // Tab created
    chrome.tabs.onCreated.addListener((tab) => {
      this.handleTabCreated(tab);
    });

    // Tab updated (navigation, title change, etc.)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Tab removed
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.handleTabRemoved(tabId, removeInfo);
    });

    // Tab activated (switched to)
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    // Listen for content script ready messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === CONTENT_SCRIPT_READY_ACTION && sender.tab?.id) {
        this.handleContentScriptReady(sender.tab.id, sender.frameId || 0);
        sendResponse({ success: true });
      }
      return false; // Sync response
    });
  }

  /**
   * Query and track existing tabs
   */
  private async queryExistingTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.id) {
          this.trackTab(tab);
        }
      }

      this.log(`Tracking ${this.tabs.size} existing tabs`);
    } catch (error) {
      console.error('[TabManager] Failed to query tabs:', error);
    }
  }

  // ==========================================================================
  // TAB EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle tab created
   */
  private handleTabCreated(tab: chrome.tabs.Tab): void {
    if (!tab.id) return;

    this.trackTab(tab);
    this.emitEvent('created', tab.id);
    this.log(`Tab created: ${tab.id}`);
  }

  /**
   * Handle tab updated
   */
  private handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    const tracked = this.tabs.get(tabId);

    if (!tracked) {
      this.trackTab(tab);
      return;
    }

    // Update tracked info
    if (changeInfo.url) {
      tracked.url = changeInfo.url;
    }
    if (changeInfo.title) {
      tracked.title = changeInfo.title;
    }
    tracked.lastActivityAt = Date.now();

    // Handle navigation complete
    if (changeInfo.status === 'complete' && tab.url) {
      this.handleNavigationComplete(tabId, tab.url, tracked);
    }

    this.emitEvent('updated', tabId, changeInfo);
  }

  /**
   * Handle navigation complete
   */
  private handleNavigationComplete(
    tabId: number,
    url: string,
    tracked: TrackedTab
  ): void {
    // Check if URL changed (actual navigation vs. SPA route change)
    const urlChanged = this.isSignificantUrlChange(tracked.url, url);

    if (urlChanged && this.config.autoInjectOnNavigation) {
      // Mark as needing re-injection
      tracked.hasContentScript = false;
      tracked.isReady = false;

      // Re-inject if this tab was previously injected
      if (tracked.injectedAt !== null) {
        this.log(`Re-injecting after navigation: ${tabId}`);
        this.injectContentScript(tabId).catch(error => {
          this.log(`Re-injection failed: ${error}`);
        });
      }
    }

    tracked.url = url;
  }

  /**
   * Check if URL change is significant (not just hash/query change)
   */
  private isSignificantUrlChange(oldUrl: string, newUrl: string): boolean {
    try {
      const oldParsed = new URL(oldUrl);
      const newParsed = new URL(newUrl);

      // Check origin and pathname
      return oldParsed.origin !== newParsed.origin ||
             oldParsed.pathname !== newParsed.pathname;
    } catch {
      return true; // Assume significant if can't parse
    }
  }

  /**
   * Handle tab removed
   */
  private handleTabRemoved(
    tabId: number,
    removeInfo: chrome.tabs.TabRemoveInfo
  ): void {
    this.tabs.delete(tabId);
    this.emitEvent('removed', tabId, removeInfo);
    this.log(`Tab removed: ${tabId}`);
  }

  /**
   * Handle tab activated
   */
  private handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
    const tracked = this.tabs.get(activeInfo.tabId);
    
    if (tracked) {
      tracked.lastActivityAt = Date.now();
    }

    this.emitEvent('activated', activeInfo.tabId, activeInfo);
  }

  /**
   * Handle content script ready message
   */
  private handleContentScriptReady(tabId: number, frameId: number): void {
    const tracked = this.tabs.get(tabId);
    
    if (!tracked) {
      this.log(`Ready message from unknown tab: ${tabId}`);
      return;
    }

    if (frameId === 0) {
      // Main frame
      tracked.hasContentScript = true;
      tracked.isReady = true;
      tracked.injectedAt = Date.now();
      tracked.lastActivityAt = Date.now();
    } else {
      // Iframe
      const frame = tracked.frames.get(frameId);
      if (frame) {
        frame.hasContentScript = true;
      }
    }

    this.emitEvent('ready', tabId, { frameId });
    this.log(`Content script ready: tab ${tabId}, frame ${frameId}`);
  }

  // ==========================================================================
  // TAB TRACKING
  // ==========================================================================

  /**
   * Track a tab
   */
  private trackTab(tab: chrome.tabs.Tab): TrackedTab {
    if (!tab.id) {
      throw new Error('Tab has no ID');
    }

    const tracked: TrackedTab = {
      id: tab.id,
      url: tab.url || '',
      title: tab.title || '',
      windowId: tab.windowId,
      hasContentScript: false,
      isReady: false,
      injectedAt: null,
      lastActivityAt: Date.now(),
      injectionAttempts: 0,
      lastError: null,
      frames: new Map()
    };

    this.tabs.set(tab.id, tracked);
    return tracked;
  }

  /**
   * Get tracked tab
   */
  getTab(tabId: number): TrackedTab | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get all tracked tabs
   */
  getAllTabs(): TrackedTab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get tabs with content script ready
   */
  getReadyTabs(): TrackedTab[] {
    return this.getAllTabs().filter(tab => tab.isReady);
  }

  /**
   * Check if tab has content script ready
   */
  isTabReady(tabId: number): boolean {
    return this.tabs.get(tabId)?.isReady ?? false;
  }

  /**
   * Get tab count
   */
  getTabCount(): number {
    return this.tabs.size;
  }

  // ==========================================================================
  // CONTENT SCRIPT INJECTION
  // ==========================================================================

  /**
   * Inject content script into tab
   */
  async injectContentScript(
    tabId: number,
    options: { frameId?: number; force?: boolean } = {}
  ): Promise<InjectionResult> {
    const { frameId = 0, force = false } = options;
    const timestamp = Date.now();

    // Get or create tracked tab
    let tracked = this.tabs.get(tabId);
    if (!tracked) {
      try {
        const tab = await chrome.tabs.get(tabId);
        tracked = this.trackTab(tab);
      } catch (error) {
        return {
          success: false,
          tabId,
          frameId,
          error: 'Tab not found',
          timestamp
        };
      }
    }

    // Check if already injected (unless forced)
    if (!force && frameId === 0 && tracked.isReady) {
      return {
        success: true,
        tabId,
        frameId,
        timestamp
      };
    }

    // Check URL restrictions
    if (!this.isUrlAllowed(tracked.url)) {
      const error = `URL not allowed for injection: ${tracked.url}`;
      tracked.lastError = error;
      return {
        success: false,
        tabId,
        frameId,
        error,
        timestamp
      };
    }

    // Check injection attempts
    if (tracked.injectionAttempts >= this.config.maxInjectionAttempts) {
      return {
        success: false,
        tabId,
        frameId,
        error: 'Max injection attempts exceeded',
        timestamp
      };
    }

    tracked.injectionAttempts++;

    try {
      // Inject CSS first
      if (this.config.cssFiles.length > 0) {
        await chrome.scripting.insertCSS({
          target: { tabId, frameIds: frameId === 0 ? undefined : [frameId] },
          files: this.config.cssFiles
        });
      }

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: frameId === 0 ? undefined : [frameId] },
        files: [this.config.contentScriptPath]
      });

      // Update tracked state (will be confirmed when ready message received)
      if (frameId === 0) {
        tracked.hasContentScript = true;
        tracked.injectedAt = timestamp;
      } else {
        tracked.frames.set(frameId, {
          frameId,
          url: '',
          hasContentScript: true,
          parentFrameId: 0
        });
      }

      tracked.lastError = null;
      this.emitEvent('injected', tabId, { frameId });
      this.log(`Injected content script: tab ${tabId}, frame ${frameId}`);

      return {
        success: true,
        tabId,
        frameId,
        timestamp
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      tracked.lastError = errorMessage;

      this.emitEvent('error', tabId, { error: errorMessage, frameId });
      this.log(`Injection failed: ${errorMessage}`);

      return {
        success: false,
        tabId,
        frameId,
        error: errorMessage,
        timestamp
      };
    }
  }

  /**
   * Inject into all frames of a tab
   */
  async injectIntoAllFrames(tabId: number): Promise<InjectionResult[]> {
    const results: InjectionResult[] = [];

    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      
      if (!frames) {
        return [await this.injectContentScript(tabId)];
      }

      for (const frame of frames) {
        const result = await this.injectContentScript(tabId, {
          frameId: frame.frameId
        });
        results.push(result);
      }

    } catch (error) {
      results.push({
        success: false,
        tabId,
        frameId: 0,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }

    return results;
  }

  /**
   * Ensure tab has content script
   */
  async ensureContentScript(tabId: number): Promise<boolean> {
    if (this.isTabReady(tabId)) {
      return true;
    }

    const result = await this.injectContentScript(tabId);
    
    if (result.success) {
      // Wait for ready message
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.off(listener);
          resolve(false);
        }, 5000);

        const listener: TabEventListener = (event) => {
          if (event.type === 'ready' && event.tabId === tabId) {
            clearTimeout(timeout);
            this.off(listener);
            resolve(true);
          }
        };

        this.on(listener);
      });
    }

    return false;
  }

  /**
   * Check if URL is allowed for injection
   */
  private isUrlAllowed(url: string): boolean {
    // Check blocked patterns first
    for (const pattern of this.config.blockedUrlPatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }

    // Check allowed patterns
    for (const pattern of this.config.allowedUrlPatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    return false;
  }

  // ==========================================================================
  // TAB COMMUNICATION
  // ==========================================================================

  /**
   * Send message to tab
   */
  async sendToTab(
    tabId: number,
    message: unknown,
    options: { frameId?: number; ensureInjected?: boolean } = {}
  ): Promise<unknown> {
    const { frameId, ensureInjected = true } = options;

    // Ensure content script is injected
    if (ensureInjected) {
      const ready = await this.ensureContentScript(tabId);
      if (!ready) {
        throw new Error('Content script not ready');
      }
    }

    try {
      let response: unknown;
      if (frameId !== undefined) {
        response = await chrome.tabs.sendMessage(tabId, message, { frameId });
      } else {
        response = await chrome.tabs.sendMessage(tabId, message);
      }
      return response;
    } catch (error) {
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Broadcast message to all ready tabs
   */
  async broadcastToTabs(message: unknown): Promise<Map<number, unknown>> {
    const results = new Map<number, unknown>();
    const readyTabs = this.getReadyTabs();

    for (const tab of readyTabs) {
      try {
        const response = await this.sendToTab(tab.id, message, {
          ensureInjected: false
        });
        results.set(tab.id, response);
      } catch (error) {
        results.set(tab.id, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return results;
  }

  // ==========================================================================
  // EVENT EMITTER
  // ==========================================================================

  /**
   * Add event listener
   */
  on(listener: TabEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: TabEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(type: TabEventType, tabId: number, data?: unknown): void {
    const event: TabEvent = {
      type,
      tabId,
      timestamp: Date.now(),
      data
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[TabManager] Listener error:', error);
      }
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get active tab in current window
   */
  async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      return tab || null;
    } catch {
      return null;
    }
  }

  /**
   * Get active tab ID in current window
   */
  async getActiveTabId(): Promise<number | null> {
    const tab = await this.getActiveTab();
    return tab?.id ?? null;
  }

  /**
   * Focus tab
   */
  async focusTab(tabId: number): Promise<boolean> {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create new tab
   */
  async createTab(url: string, options: { active?: boolean } = {}): Promise<chrome.tabs.Tab> {
    return chrome.tabs.create({
      url,
      active: options.active ?? true
    });
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Log message (if debug enabled)
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[TabManager]', ...args);
    }
  }

  /**
   * Destroy tab manager
   */
  destroy(): void {
    this.tabs.clear();
    this.listeners.clear();
    this.initialized = false;
    this.log('Destroyed');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: TabManager | null = null;

/**
 * Get or create tab manager instance
 */
export function getTabManager(): TabManager {
  if (!instance) {
    instance = new TabManager();
  }
  return instance;
}

/**
 * Initialize tab manager singleton
 */
export async function initializeTabManager(
  config?: TabManagerConfig
): Promise<TabManager> {
  if (!instance) {
    instance = new TabManager(config);
  }
  await instance.initialize();
  return instance;
}

/**
 * Reset tab manager singleton (for testing)
 */
export function resetTabManager(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
