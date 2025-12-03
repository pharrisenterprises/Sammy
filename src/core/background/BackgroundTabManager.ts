/**
 * BackgroundTabManager - Tab Lifecycle Management
 * @module core/background/BackgroundTabManager
 * @version 1.0.0
 * 
 * Implements IBackgroundTabManager for managing browser tabs in the
 * background service worker. Handles tab creation, tracking, script
 * injection, and messaging.
 * 
 * ## Tab Lifecycle
 * 1. openTab(): Create tab with URL
 * 2. injectScript(): Inject content script
 * 3. trackTab(): Add to tracked set
 * 4. sendToTab(): Send messages
 * 5. closeTab(): Clean up
 * 
 * ## Script Re-injection
 * When tracked tabs navigate, content scripts are re-injected via
 * webNavigation listeners to maintain recording/replay capability.
 * 
 * @example
 * ```typescript
 * const tabManager = new BackgroundTabManager();
 * 
 * // Open and track tab
 * const result = await tabManager.openTab('https://example.com', projectId);
 * if (result.success) {
 *   const tabId = result.tabId!;
 *   
 *   // Send message to content script
 *   const response = await tabManager.sendToTab(tabId, { type: 'ping' });
 *   
 *   // Close when done
 *   await tabManager.closeTab(tabId);
 * }
 * ```
 */

import type { IBackgroundTabManager, TrackedTab } from './IBackgroundService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for BackgroundTabManager
 */
export interface BackgroundTabManagerConfig {
  /** Default script to inject (default: 'js/main.js') */
  defaultScript?: string;
  
  /** Whether to inject into all frames (default: true) */
  allFrames?: boolean;
  
  /** Whether to re-inject on navigation (default: true) */
  reinjectOnNavigation?: boolean;
  
  /** Timeout for tab operations in ms (default: 30000) */
  timeout?: number;
  
  /** Delay after opening tab before injection (default: 100) */
  injectionDelay?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_TAB_MANAGER_CONFIG: Required<BackgroundTabManagerConfig> = {
  defaultScript: 'js/main.js',
  allFrames: true,
  reinjectOnNavigation: true,
  timeout: 30000,
  injectionDelay: 100,
};

/**
 * Tab open result
 */
export interface TabOpenResult {
  success: boolean;
  tabId?: number;
  error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Chrome tabs API is available
 */
function isChromeTabsAvailable(): boolean {
  return typeof chrome !== 'undefined' &&
         typeof chrome.tabs !== 'undefined' &&
         typeof chrome.tabs.create === 'function';
}

/**
 * Check if Chrome scripting API is available
 */
function isChromeScriptingAvailable(): boolean {
  return typeof chrome !== 'undefined' &&
         typeof chrome.scripting !== 'undefined' &&
         typeof chrome.scripting.executeScript === 'function';
}

/**
 * Wrap Chrome API callback in promise
 */
function chromePromise<T>(
  operation: (callback: (result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    operation((result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

// ============================================================================
// BACKGROUND TAB MANAGER CLASS
// ============================================================================

/**
 * Manages browser tabs in background service worker
 */
export class BackgroundTabManager implements IBackgroundTabManager {
  private config: Required<BackgroundTabManagerConfig>;
  private trackedTabs: Map<number, TrackedTab> = new Map();
  private openedTabId: number | null = null;
  private navigationListenerAttached = false;
  
  constructor(config?: BackgroundTabManagerConfig) {
    this.config = {
      ...DEFAULT_TAB_MANAGER_CONFIG,
      ...config,
    };
    
    // Attach navigation listeners if configured
    if (this.config.reinjectOnNavigation) {
      this.attachNavigationListeners();
    }
  }
  
  // ==========================================================================
  // TAB OPERATIONS
  // ==========================================================================
  
  /**
   * Open a new tab
   */
  async openTab(url: string, projectId?: number): Promise<TabOpenResult> {
    if (!isChromeTabsAvailable()) {
      return { success: false, error: 'Chrome tabs API not available' };
    }
    
    try {
      // Create tab
      const tab = await chromePromise<chrome.tabs.Tab>((callback) => {
        chrome.tabs.create({ url }, callback);
      });
      
      if (!tab.id) {
        return { success: false, error: 'No tab ID returned' };
      }
      
      const tabId = tab.id;
      
      // Wait for page to start loading
      await sleep(this.config.injectionDelay);
      
      // Inject content script
      const injected = await this.injectScript(tabId);
      
      if (!injected) {
        console.warn('Script injection failed, but tab opened');
      }
      
      // Track the tab
      this.trackTab(tabId, projectId);
      this.openedTabId = tabId;
      
      // Update URL if available
      const trackedTab = this.trackedTabs.get(tabId);
      if (trackedTab) {
        trackedTab.url = tab.url || url;
        trackedTab.scriptInjected = injected;
      }
      
      return { success: true, tabId };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
  
  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<boolean> {
    if (!isChromeTabsAvailable()) {
      return false;
    }
    
    try {
      await chromePromise<void>((callback) => {
        chrome.tabs.remove(tabId, callback);
      });
      
      this.untrackTab(tabId);
      
      if (this.openedTabId === tabId) {
        this.openedTabId = null;
      }
      
      return true;
      
    } catch (error) {
      console.error('Failed to close tab:', error);
      return false;
    }
  }
  
  /**
   * Close the last opened tab
   */
  async closeOpenedTab(): Promise<boolean> {
    if (this.openedTabId === null) {
      return false;
    }
    
    return this.closeTab(this.openedTabId);
  }
  
  // ==========================================================================
  // SCRIPT INJECTION
  // ==========================================================================
  
  /**
   * Inject content script into tab
   */
  async injectScript(tabId: number, scriptPath?: string): Promise<boolean> {
    if (!isChromeScriptingAvailable()) {
      return false;
    }
    
    const script = scriptPath || this.config.defaultScript;
    
    try {
      await chromePromise<chrome.scripting.InjectionResult[]>((callback) => {
        chrome.scripting.executeScript(
          {
            target: { 
              tabId, 
              allFrames: this.config.allFrames,
            },
            files: [script],
          },
          callback
        );
      });
      
      // Update tracked tab
      const trackedTab = this.trackedTabs.get(tabId);
      if (trackedTab) {
        trackedTab.scriptInjected = true;
        trackedTab.lastActivity = Date.now();
      }
      
      return true;
      
    } catch (error) {
      console.warn('Script injection failed:', error);
      return false;
    }
  }
  
  // ==========================================================================
  // TAB TRACKING
  // ==========================================================================
  
  /**
   * Track a tab
   */
  trackTab(tabId: number, projectId?: number): void {
    const existing = this.trackedTabs.get(tabId);
    
    if (existing) {
      // Update existing
      if (projectId !== undefined) {
        existing.projectId = projectId;
      }
      existing.lastActivity = Date.now();
    } else {
      // Create new
      this.trackedTabs.set(tabId, {
        tabId,
        url: '',
        projectId,
        scriptInjected: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      });
    }
  }
  
  /**
   * Untrack a tab
   */
  untrackTab(tabId: number): void {
    this.trackedTabs.delete(tabId);
  }
  
  /**
   * Check if tab is tracked
   */
  isTracked(tabId: number): boolean {
    return this.trackedTabs.has(tabId);
  }
  
  /**
   * Get tracked tab info
   */
  getTrackedTab(tabId: number): TrackedTab | null {
    return this.trackedTabs.get(tabId) || null;
  }
  
  /**
   * Get all tracked tabs
   */
  getTrackedTabs(): TrackedTab[] {
    return Array.from(this.trackedTabs.values());
  }
  
  /**
   * Get last opened tab ID
   */
  getOpenedTabId(): number | null {
    return this.openedTabId;
  }
  
  // ==========================================================================
  // MESSAGING
  // ==========================================================================
  
  /**
   * Send message to tab
   */
  async sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
    if (!isChromeTabsAvailable()) {
      throw new Error('Chrome tabs API not available');
    }
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tab message timeout: ${tabId}`));
      }, this.config.timeout);
      
      chrome.tabs.sendMessage(tabId, message, (response: T) => {
        clearTimeout(timer);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          // Update activity
          const trackedTab = this.trackedTabs.get(tabId);
          if (trackedTab) {
            trackedTab.lastActivity = Date.now();
          }
          
          resolve(response);
        }
      });
    });
  }
  
  // ==========================================================================
  // NAVIGATION LISTENERS
  // ==========================================================================
  
  /**
   * Attach navigation listeners for script re-injection
   */
  private attachNavigationListeners(): void {
    if (this.navigationListenerAttached) {
      return;
    }
    
    if (typeof chrome === 'undefined' || !chrome.webNavigation) {
      return;
    }
    
    // Re-inject on navigation committed (page started loading)
    chrome.webNavigation.onCommitted.addListener((details) => {
      if (this.isTracked(details.tabId)) {
        // Re-inject script
        this.injectScript(details.tabId).catch((error) => {
          console.warn('Re-injection on navigation failed:', error);
        });
      }
    });
    
    // Re-inject on page load complete
    chrome.webNavigation.onCompleted.addListener((details) => {
      if (this.isTracked(details.tabId)) {
        // Update URL
        const trackedTab = this.trackedTabs.get(details.tabId);
        if (trackedTab && details.frameId === 0) {
          trackedTab.url = details.url;
          trackedTab.lastActivity = Date.now();
        }
        
        // Re-inject script (in case onCommitted failed)
        this.injectScript(details.tabId).catch((error) => {
          console.warn('Re-injection on complete failed:', error);
        });
      }
    });
    
    // Clean up on tab removal
    if (chrome.tabs && chrome.tabs.onRemoved) {
      chrome.tabs.onRemoved.addListener((tabId) => {
        this.untrackTab(tabId);
        
        if (this.openedTabId === tabId) {
          this.openedTabId = null;
        }
      });
    }
    
    this.navigationListenerAttached = true;
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /**
   * Get tabs for a project
   */
  getTabsForProject(projectId: number): TrackedTab[] {
    return this.getTrackedTabs().filter(tab => tab.projectId === projectId);
  }
  
  /**
   * Close all tabs for a project
   */
  async closeProjectTabs(projectId: number): Promise<number> {
    const tabs = this.getTabsForProject(projectId);
    let closed = 0;
    
    for (const tab of tabs) {
      if (await this.closeTab(tab.tabId)) {
        closed++;
      }
    }
    
    return closed;
  }
  
  /**
   * Clear all tracked tabs (without closing)
   */
  clearTrackedTabs(): void {
    this.trackedTabs.clear();
    this.openedTabId = null;
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<BackgroundTabManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<BackgroundTabManagerConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a BackgroundTabManager
 */
export function createBackgroundTabManager(
  config?: BackgroundTabManagerConfig
): BackgroundTabManager {
  return new BackgroundTabManager(config);
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultTabManager: BackgroundTabManager | null = null;

/**
 * Get default tab manager instance
 */
export function getBackgroundTabManager(): BackgroundTabManager {
  if (!defaultTabManager) {
    defaultTabManager = new BackgroundTabManager();
  }
  return defaultTabManager;
}

/**
 * Reset default tab manager
 */
export function resetBackgroundTabManager(): void {
  if (defaultTabManager) {
    defaultTabManager.clearTrackedTabs();
  }
  defaultTabManager = null;
}

// ============================================================================
// MOCK IMPLEMENTATION
// ============================================================================

/**
 * Mock tab manager for testing without Chrome APIs
 */
export class MockBackgroundTabManager implements IBackgroundTabManager {
  private nextTabId = 1000;
  private trackedTabs: Map<number, TrackedTab> = new Map();
  private openedTabId: number | null = null;
  private messageHandler: ((tabId: number, message: unknown) => unknown) | null = null;
  
  // Test configuration
  public openShouldFail = false;
  public injectShouldFail = false;
  public sendShouldFail = false;
  public closeShouldFail = false;
  
  async openTab(url: string, projectId?: number): Promise<TabOpenResult> {
    if (this.openShouldFail) {
      return { success: false, error: 'Mock: open failed' };
    }
    
    const tabId = this.nextTabId++;
    
    this.trackedTabs.set(tabId, {
      tabId,
      url,
      projectId,
      scriptInjected: !this.injectShouldFail,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
    
    this.openedTabId = tabId;
    
    return { success: true, tabId };
  }
  
  async closeTab(tabId: number): Promise<boolean> {
    if (this.closeShouldFail) {
      return false;
    }
    
    const deleted = this.trackedTabs.delete(tabId);
    
    if (this.openedTabId === tabId) {
      this.openedTabId = null;
    }
    
    return deleted;
  }
  
  async closeOpenedTab(): Promise<boolean> {
    if (this.openedTabId === null) {
      return false;
    }
    
    return this.closeTab(this.openedTabId);
  }
  
  async injectScript(tabId: number, _scriptPath?: string): Promise<boolean> {
    if (this.injectShouldFail) {
      return false;
    }
    
    const tab = this.trackedTabs.get(tabId);
    if (tab) {
      tab.scriptInjected = true;
      tab.lastActivity = Date.now();
    }
    
    return true;
  }
  
  trackTab(tabId: number, projectId?: number): void {
    const existing = this.trackedTabs.get(tabId);
    
    if (existing) {
      if (projectId !== undefined) {
        existing.projectId = projectId;
      }
      existing.lastActivity = Date.now();
    } else {
      this.trackedTabs.set(tabId, {
        tabId,
        url: '',
        projectId,
        scriptInjected: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      });
    }
  }
  
  untrackTab(tabId: number): void {
    this.trackedTabs.delete(tabId);
  }
  
  isTracked(tabId: number): boolean {
    return this.trackedTabs.has(tabId);
  }
  
  getTrackedTab(tabId: number): TrackedTab | null {
    return this.trackedTabs.get(tabId) || null;
  }
  
  getTrackedTabs(): TrackedTab[] {
    return Array.from(this.trackedTabs.values());
  }
  
  getOpenedTabId(): number | null {
    return this.openedTabId;
  }
  
  async sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
    if (this.sendShouldFail) {
      throw new Error('Mock: send failed');
    }
    
    if (this.messageHandler) {
      return this.messageHandler(tabId, message) as T;
    }
    
    return true as unknown as T;
  }
  
  // Mock-specific methods
  
  setMessageHandler(handler: (tabId: number, message: unknown) => unknown): void {
    this.messageHandler = handler;
  }
  
  reset(): void {
    this.nextTabId = 1000;
    this.trackedTabs.clear();
    this.openedTabId = null;
    this.messageHandler = null;
    this.openShouldFail = false;
    this.injectShouldFail = false;
    this.sendShouldFail = false;
    this.closeShouldFail = false;
  }
  
  // Additional utility methods matching BackgroundTabManager
  
  getTabsForProject(projectId: number): TrackedTab[] {
    return this.getTrackedTabs().filter(tab => tab.projectId === projectId);
  }
  
  async closeProjectTabs(projectId: number): Promise<number> {
    const tabs = this.getTabsForProject(projectId);
    let closed = 0;
    
    for (const tab of tabs) {
      if (await this.closeTab(tab.tabId)) {
        closed++;
      }
    }
    
    return closed;
  }
  
  clearTrackedTabs(): void {
    this.trackedTabs.clear();
    this.openedTabId = null;
  }
}

/**
 * Create a mock tab manager for testing
 */
export function createMockBackgroundTabManager(): MockBackgroundTabManager {
  return new MockBackgroundTabManager();
}
