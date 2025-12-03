/**
 * ChromeTabManager - Chrome Extension Tab Management
 * @module core/orchestrator/ChromeTabManager
 * @version 1.0.0
 * 
 * Implements ITabManager using Chrome extension APIs for tab creation,
 * script injection, and content script communication.
 * 
 * ## Tab Lifecycle
 * 1. openTab(): Create new tab with URL
 * 2. Wait for page load
 * 3. injectScript(): Inject content script via background
 * 4. sendMessage(): Send commands to content script
 * 5. closeTab(): Clean up when done
 * 
 * ## Background Communication
 * - Uses chrome.runtime.sendMessage() for background service
 * - Background handles actual script injection via chrome.scripting
 * - Tab tracking maintained in background (trackedTabs Set)
 * 
 * @example
 * ```typescript
 * const tabManager = new ChromeTabManager();
 * 
 * const result = await tabManager.openTab('https://example.com');
 * if (result.success) {
 *   await tabManager.sendMessage(result.tab.tabId, { type: 'runStep', data });
 *   await tabManager.closeTab(result.tab.tabId);
 * }
 * ```
 */

import type { ITabManager, TabInfo, TabResult } from './ITestOrchestrator';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome runtime message for tab operations
 */
interface TabMessage {
  action: string;
  url?: string;
  tabId?: number;
  [key: string]: unknown;
}

/**
 * Response from background service
 */
interface BackgroundResponse {
  success: boolean;
  tabId?: number;
  error?: string;
  [key: string]: unknown;
}

/**
 * Configuration for ChromeTabManager
 */
export interface ChromeTabManagerConfig {
  /** Timeout for tab operations in ms (default: 30000) */
  timeout?: number;
  
  /** Delay after opening tab before checking ready (default: 500) */
  loadDelay?: number;
  
  /** Max retries for script injection (default: 3) */
  maxInjectionRetries?: number;
  
  /** Delay between injection retries in ms (default: 500) */
  injectionRetryDelay?: number;
  
  /** Whether to wait for complete load (default: true) */
  waitForLoad?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_TAB_MANAGER_CONFIG: Required<ChromeTabManagerConfig> = {
  timeout: 30000,
  loadDelay: 500,
  maxInjectionRetries: 3,
  injectionRetryDelay: 500,
  waitForLoad: true,
};

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
 * Check if Chrome extension APIs are available
 */
function isChromeAvailable(): boolean {
  return typeof chrome !== 'undefined' && 
         typeof chrome.runtime !== 'undefined' &&
         typeof chrome.runtime.sendMessage === 'function';
}

/**
 * Check if Chrome tabs API is available
 */
function isTabsApiAvailable(): boolean {
  return typeof chrome !== 'undefined' &&
         typeof chrome.tabs !== 'undefined' &&
         typeof chrome.tabs.sendMessage === 'function';
}

/**
 * Send message to background service with timeout
 */
async function sendToBackground<T extends BackgroundResponse>(
  message: TabMessage,
  timeout: number = 30000
): Promise<T> {
  if (!isChromeAvailable()) {
    throw new Error('Chrome runtime not available');
  }
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Background message timeout: ${message.action}`));
    }, timeout);
    
    chrome.runtime.sendMessage(message, (response: T) => {
      clearTimeout(timer);
      
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      resolve(response);
    });
  });
}

/**
 * Send message to content script with timeout
 */
async function sendToTab<T>(
  tabId: number,
  message: unknown,
  timeout: number = 30000
): Promise<T> {
  if (!isTabsApiAvailable()) {
    throw new Error('Chrome tabs API not available');
  }
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tab message timeout: ${tabId}`));
    }, timeout);
    
    chrome.tabs.sendMessage(tabId, message, (response: T) => {
      clearTimeout(timer);
      
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      resolve(response);
    });
  });
}

// ============================================================================
// CHROME TAB MANAGER CLASS
// ============================================================================

/**
 * Tab manager using Chrome extension APIs
 */
export class ChromeTabManager implements ITabManager {
  private config: Required<ChromeTabManagerConfig>;
  private tabs: Map<number, TabInfo> = new Map();
  
  constructor(config?: ChromeTabManagerConfig) {
    this.config = {
      ...DEFAULT_TAB_MANAGER_CONFIG,
      ...config,
    };
  }
  
  /**
   * Open a new tab with URL
   */
  async openTab(url: string): Promise<TabResult> {
    try {
      // Send to background service to open tab and inject script
      const response = await sendToBackground<BackgroundResponse>(
        { action: 'openTab', url },
        this.config.timeout
      );
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to open tab',
        };
      }
      
      if (!response.tabId) {
        return {
          success: false,
          error: 'No tab ID returned',
        };
      }
      
      // Wait for page to load
      if (this.config.waitForLoad) {
        await sleep(this.config.loadDelay);
      }
      
      // Create tab info
      const tabInfo: TabInfo = {
        tabId: response.tabId,
        url,
        scriptInjected: true, // Background injects on openTab
        createdAt: Date.now(),
      };
      
      this.tabs.set(response.tabId, tabInfo);
      
      return {
        success: true,
        tab: tabInfo,
      };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }
  
  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<boolean> {
    try {
      const response = await sendToBackground<BackgroundResponse>(
        { action: 'close_opened_tab', tabId },
        this.config.timeout
      );
      
      if (response.success) {
        this.tabs.delete(tabId);
      }
      
      return response.success;
      
    } catch (error) {
      console.error('Failed to close tab:', error);
      
      // Try direct tabs API as fallback
      if (isTabsApiAvailable()) {
        try {
          await new Promise<void>((resolve, reject) => {
            chrome.tabs.remove(tabId, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
          this.tabs.delete(tabId);
          return true;
        } catch {
          return false;
        }
      }
      
      return false;
    }
  }
  
  /**
   * Inject content script into tab
   */
  async injectScript(tabId: number): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < this.config.maxInjectionRetries) {
      try {
        const response = await sendToBackground<BackgroundResponse>(
          { action: 'injectScript', tabId },
          this.config.timeout
        );
        
        if (response.success) {
          const tabInfo = this.tabs.get(tabId);
          if (tabInfo) {
            tabInfo.scriptInjected = true;
          }
          return true;
        }
        
        attempts++;
        if (attempts < this.config.maxInjectionRetries) {
          await sleep(this.config.injectionRetryDelay);
        }
        
      } catch (error) {
        console.warn(`Injection attempt ${attempts + 1} failed:`, error);
        attempts++;
        if (attempts < this.config.maxInjectionRetries) {
          await sleep(this.config.injectionRetryDelay);
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if tab is ready for commands
   */
  async isTabReady(tabId: number): Promise<boolean> {
    try {
      // Try to ping the content script
      const response = await sendToTab<{ ready?: boolean }>(
        tabId,
        { type: 'ping' },
        5000 // Short timeout for ping
      );
      
      return response?.ready === true;
      
    } catch (error) {
      // Tab not ready if message fails
      return false;
    }
  }
  
  /**
   * Get tab info
   */
  async getTabInfo(tabId: number): Promise<TabInfo | null> {
    // Check local cache first
    const cached = this.tabs.get(tabId);
    if (cached) {
      return cached;
    }
    
    // Try to get from Chrome tabs API
    if (isTabsApiAvailable()) {
      try {
        const tab = await new Promise<chrome.tabs.Tab | null>((resolve) => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(tab);
            }
          });
        });
        
        if (tab) {
          const tabInfo: TabInfo = {
            tabId: tab.id!,
            url: tab.url || '',
            scriptInjected: false, // Unknown
            createdAt: Date.now(),
          };
          this.tabs.set(tabId, tabInfo);
          return tabInfo;
        }
      } catch {
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Send message to tab
   */
  async sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T> {
    return sendToTab<T>(tabId, message, this.config.timeout);
  }
  
  /**
   * Get all tracked tabs
   */
  getTrackedTabs(): TabInfo[] {
    return Array.from(this.tabs.values());
  }
  
  /**
   * Clear all tracked tabs
   */
  clearTrackedTabs(): void {
    this.tabs.clear();
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<ChromeTabManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<ChromeTabManagerConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a ChromeTabManager
 */
export function createChromeTabManager(
  config?: ChromeTabManagerConfig
): ChromeTabManager {
  return new ChromeTabManager(config);
}

/**
 * Create a fast tab manager (shorter timeouts)
 */
export function createFastTabManager(): ChromeTabManager {
  return new ChromeTabManager({
    timeout: 10000,
    loadDelay: 200,
    maxInjectionRetries: 1,
    injectionRetryDelay: 200,
    waitForLoad: false,
  });
}

/**
 * Create a tolerant tab manager (more retries)
 */
export function createTolerantTabManager(): ChromeTabManager {
  return new ChromeTabManager({
    timeout: 60000,
    loadDelay: 1000,
    maxInjectionRetries: 5,
    injectionRetryDelay: 1000,
    waitForLoad: true,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultTabManager: ChromeTabManager | null = null;

/**
 * Get default tab manager instance
 */
export function getTabManager(): ChromeTabManager {
  if (!defaultTabManager) {
    defaultTabManager = new ChromeTabManager();
  }
  return defaultTabManager;
}

/**
 * Reset default tab manager
 */
export function resetTabManager(): void {
  if (defaultTabManager) {
    defaultTabManager.clearTrackedTabs();
  }
  defaultTabManager = null;
}

// ============================================================================
// MOCK FOR TESTING
// ============================================================================

/**
 * Mock tab manager for testing without Chrome APIs
 */
export class MockTabManager implements ITabManager {
  private nextTabId = 1000;
  private tabs: Map<number, TabInfo> = new Map();
  private messageHandler: ((tabId: number, message: unknown) => unknown) | null = null;
  
  // Configuration for test behavior
  public openShouldFail = false;
  public injectShouldFail = false;
  public sendShouldFail = false;
  public isReady = true;
  
  async openTab(url: string): Promise<TabResult> {
    if (this.openShouldFail) {
      return { success: false, error: 'Mock: open failed' };
    }
    
    const tabId = this.nextTabId++;
    const tabInfo: TabInfo = {
      tabId,
      url,
      scriptInjected: true,
      createdAt: Date.now(),
    };
    
    this.tabs.set(tabId, tabInfo);
    
    return { success: true, tab: tabInfo };
  }
  
  async closeTab(tabId: number): Promise<boolean> {
    const deleted = this.tabs.delete(tabId);
    return deleted;
  }
  
  async injectScript(tabId: number): Promise<boolean> {
    if (this.injectShouldFail) {
      return false;
    }
    
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.scriptInjected = true;
    }
    
    return true;
  }
  
  async isTabReady(_tabId: number): Promise<boolean> {
    return this.isReady;
  }
  
  async getTabInfo(tabId: number): Promise<TabInfo | null> {
    return this.tabs.get(tabId) || null;
  }
  
  async sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T> {
    if (this.sendShouldFail) {
      throw new Error('Mock: send failed');
    }
    
    if (this.messageHandler) {
      return this.messageHandler(tabId, message) as T;
    }
    
    return true as unknown as T;
  }
  
  /**
   * Set handler for messages (for testing)
   */
  setMessageHandler(handler: (tabId: number, message: unknown) => unknown): void {
    this.messageHandler = handler;
  }
  
  /**
   * Get all tabs
   */
  getTabs(): TabInfo[] {
    return Array.from(this.tabs.values());
  }
  
  /**
   * Reset mock state
   */
  reset(): void {
    this.nextTabId = 1000;
    this.tabs.clear();
    this.messageHandler = null;
    this.openShouldFail = false;
    this.injectShouldFail = false;
    this.sendShouldFail = false;
    this.isReady = true;
  }
}

/**
 * Create a mock tab manager for testing
 */
export function createMockTabManager(): MockTabManager {
  return new MockTabManager();
}
