/**
 * ContextBridge - Cross-Context Messaging Implementation
 * @module core/content/ContextBridge
 * @version 1.0.0
 * 
 * Implements IContextBridge for communication between content script,
 * extension pages (background/popup), and page context scripts.
 * 
 * ## Communication Channels
 * 
 * ### Content Script ↔ Extension
 * - Uses chrome.runtime.sendMessage / onMessage
 * - Async response via Promise or sendResponse callback
 * 
 * ### Content Script ↔ Page Context
 * - Uses window.postMessage / addEventListener('message')
 * - Messages filtered by source identifier
 * - Only accepts messages from same window (e.source === window)
 * 
 * @example
 * ```typescript
 * const bridge = new ContextBridge();
 * 
 * // Send to extension
 * const response = await bridge.sendToExtension({
 *   type: 'logEvent',
 *   data: eventData
 * });
 * 
 * // Send to page context
 * bridge.sendToPage({
 *   type: 'REPLAY_AUTOCOMPLETE',
 *   payload: actions
 * });
 * 
 * // Listen for page messages
 * bridge.onPageMessage((message) => {
 *   if (message.type === 'AUTOCOMPLETE_INPUT') {
 *     // Handle autocomplete input from page
 *   }
 * });
 * ```
 */

import type {
  IContextBridge,
  ContentToExtensionMessage,
  ExtensionToContentMessage,
  PageContextMessage,
} from './IContentScript';

import {
  PAGE_SCRIPT_SOURCE,
  CONTENT_SCRIPT_SOURCE,
} from './IContentScript';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extension message handler type (matches chrome.runtime.onMessage)
 */
export type ExtensionMessageHandler = (
  message: ExtensionToContentMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

/**
 * Page message handler type
 */
export type PageMessageHandler = (message: PageContextMessage) => void;

/**
 * Context bridge configuration
 */
export interface ContextBridgeConfig {
  /** Source identifier for outgoing page messages */
  pageMessageSource?: string;
  
  /** Accepted sources for incoming page messages */
  acceptedPageSources?: string[];
  
  /** Whether to log messages for debugging */
  debug?: boolean;
  
  /** Timeout for extension messages in ms */
  extensionMessageTimeout?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_BRIDGE_CONFIG: Required<ContextBridgeConfig> = {
  pageMessageSource: CONTENT_SCRIPT_SOURCE,
  acceptedPageSources: [PAGE_SCRIPT_SOURCE],
  debug: false,
  extensionMessageTimeout: 30000,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if chrome runtime is available
 */
function isChromeRuntimeAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function'
  );
}

/**
 * Check if window is available (for page messaging)
 */
function isWindowAvailable(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Create a timeout promise
 */
function createTimeout<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Wrap chrome.runtime.sendMessage in a promise
 */
function sendMessagePromise(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!isChromeRuntimeAvailable()) {
      reject(new Error('Chrome runtime not available'));
      return;
    }
    
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ============================================================================
// CONTEXT BRIDGE CLASS
// ============================================================================

/**
 * Context Bridge implementation
 */
export class ContextBridge implements IContextBridge {
  private config: Required<ContextBridgeConfig>;
  private extensionHandlers: Set<ExtensionMessageHandler> = new Set();
  private pageHandlers: Set<PageMessageHandler> = new Set();
  private pageMessageListener: ((event: MessageEvent) => void) | null = null;
  private extensionMessageListener: ExtensionMessageHandler | null = null;
  private initialized = false;
  
  constructor(config?: Partial<ContextBridgeConfig>) {
    this.config = {
      ...DEFAULT_BRIDGE_CONFIG,
      ...config,
    };
  }
  
  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  
  /**
   * Initialize the bridge (attach listeners)
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }
    
    this.attachPageListener();
    this.attachExtensionListener();
    this.initialized = true;
    
    this.log('ContextBridge initialized');
  }
  
  /**
   * Shutdown the bridge (remove listeners)
   */
  shutdown(): void {
    this.detachPageListener();
    this.detachExtensionListener();
    this.extensionHandlers.clear();
    this.pageHandlers.clear();
    this.initialized = false;
    
    this.log('ContextBridge shutdown');
  }
  
  // ==========================================================================
  // EXTENSION MESSAGING
  // ==========================================================================
  
  /**
   * Send message to extension (background/popup)
   */
  async sendToExtension(message: ContentToExtensionMessage): Promise<unknown> {
    this.log('Sending to extension:', message.type);
    
    if (!isChromeRuntimeAvailable()) {
      this.log('Chrome runtime not available, returning null');
      return null;
    }
    
    try {
      const response = await Promise.race([
        sendMessagePromise(message),
        createTimeout(
          this.config.extensionMessageTimeout,
          `Extension message timeout: ${message.type}`
        ),
      ]);
      
      this.log('Extension response:', response);
      return response;
    } catch (error) {
      this.log('Extension message error:', error);
      throw error;
    }
  }
  
  /**
   * Register handler for extension messages
   */
  onExtensionMessage(handler: ExtensionMessageHandler): void {
    this.extensionHandlers.add(handler);
    this.log('Extension handler registered, total:', this.extensionHandlers.size);
  }
  
  /**
   * Remove extension message handler
   */
  offExtensionMessage(handler: Function): void {
    this.extensionHandlers.delete(handler as ExtensionMessageHandler);
    this.log('Extension handler removed, total:', this.extensionHandlers.size);
  }
  
  /**
   * Attach extension message listener
   */
  private attachExtensionListener(): void {
    if (!isChromeRuntimeAvailable()) {
      this.log('Chrome runtime not available, skipping extension listener');
      return;
    }
    
    this.extensionMessageListener = (
      message: ExtensionToContentMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ): boolean => {
      this.log('Extension message received:', message.action);
      
      let asyncResponse = false;
      
      for (const handler of this.extensionHandlers) {
        const result = handler(message, sender, sendResponse);
        if (result === true) {
          asyncResponse = true;
        }
      }
      
      return asyncResponse;
    };
    
    chrome.runtime.onMessage.addListener(this.extensionMessageListener);
    this.log('Extension listener attached');
  }
  
  /**
   * Detach extension message listener
   */
  private detachExtensionListener(): void {
    if (this.extensionMessageListener && isChromeRuntimeAvailable()) {
      chrome.runtime.onMessage.removeListener(this.extensionMessageListener);
      this.extensionMessageListener = null;
      this.log('Extension listener detached');
    }
  }
  
  // ==========================================================================
  // PAGE CONTEXT MESSAGING
  // ==========================================================================
  
  /**
   * Send message to page context
   */
  sendToPage(message: PageContextMessage): void {
    this.log('Sending to page:', message.type);
    
    if (!isWindowAvailable()) {
      this.log('Window not available, skipping page message');
      return;
    }
    
    const enrichedMessage: PageContextMessage = {
      ...message,
      source: this.config.pageMessageSource,
    };
    
    window.postMessage(enrichedMessage, '*');
  }
  
  /**
   * Register handler for page context messages
   */
  onPageMessage(handler: PageMessageHandler): void {
    this.pageHandlers.add(handler);
    this.log('Page handler registered, total:', this.pageHandlers.size);
  }
  
  /**
   * Remove page message handler
   */
  offPageMessage(handler: Function): void {
    this.pageHandlers.delete(handler as PageMessageHandler);
    this.log('Page handler removed, total:', this.pageHandlers.size);
  }
  
  /**
   * Attach page message listener
   */
  private attachPageListener(): void {
    if (!isWindowAvailable()) {
      this.log('Window not available, skipping page listener');
      return;
    }
    
    this.pageMessageListener = (event: MessageEvent): void => {
      // Only accept messages from same window
      if (event.source !== window) {
        return;
      }
      
      const message = event.data as PageContextMessage;
      
      // Validate message structure
      if (!message || typeof message.type !== 'string') {
        return;
      }
      
      // Filter by accepted sources
      if (message.source && !this.config.acceptedPageSources.includes(message.source)) {
        // Ignore messages from unknown sources
        return;
      }
      
      // Ignore our own messages
      if (message.source === this.config.pageMessageSource) {
        return;
      }
      
      this.log('Page message received:', message.type);
      
      // Dispatch to handlers
      for (const handler of this.pageHandlers) {
        try {
          handler(message);
        } catch (error) {
          this.log('Page handler error:', error);
        }
      }
    };
    
    window.addEventListener('message', this.pageMessageListener);
    this.log('Page listener attached');
  }
  
  /**
   * Detach page message listener
   */
  private detachPageListener(): void {
    if (this.pageMessageListener && isWindowAvailable()) {
      window.removeEventListener('message', this.pageMessageListener);
      this.pageMessageListener = null;
      this.log('Page listener detached');
    }
  }
  
  // ==========================================================================
  // SCRIPT INJECTION
  // ==========================================================================
  
  /**
   * Inject script into page context
   */
  async injectPageScript(scriptPath: string): Promise<boolean> {
    this.log('Injecting script:', scriptPath);
    
    if (!isWindowAvailable()) {
      this.log('Window not available, cannot inject script');
      return false;
    }
    
    return new Promise((resolve) => {
      try {
        const script = document.createElement('script');
        script.src = this.getScriptUrl(scriptPath);
        script.type = 'text/javascript';
        
        script.onload = () => {
          this.log('Script injected successfully:', scriptPath);
          // Remove script tag after load (optional, for cleanup)
          script.remove();
          resolve(true);
        };
        
        script.onerror = (error) => {
          this.log('Script injection failed:', scriptPath, error);
          script.remove();
          resolve(false);
        };
        
        // Inject into document
        const target = document.head || document.documentElement;
        target.appendChild(script);
        
      } catch (error) {
        this.log('Script injection error:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Get full URL for script path
   */
  private getScriptUrl(scriptPath: string): string {
    // If it's already a full URL, return as-is
    if (scriptPath.startsWith('http://') || scriptPath.startsWith('https://')) {
      return scriptPath;
    }
    
    // If chrome.runtime is available, use extension URL
    if (isChromeRuntimeAvailable() && chrome.runtime.getURL) {
      return chrome.runtime.getURL(scriptPath);
    }
    
    // Fallback to relative path
    return scriptPath;
  }
  
  /**
   * Inject inline script into page context
   */
  injectInlineScript(code: string): boolean {
    this.log('Injecting inline script');
    
    if (!isWindowAvailable()) {
      this.log('Window not available, cannot inject inline script');
      return false;
    }
    
    try {
      const script = document.createElement('script');
      script.textContent = code;
      
      const target = document.head || document.documentElement;
      target.appendChild(script);
      
      // Remove immediately after execution
      script.remove();
      
      this.log('Inline script injected successfully');
      return true;
    } catch (error) {
      this.log('Inline script injection error:', error);
      return false;
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Check if bridge is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get configuration
   */
  getConfig(): Required<ContextBridgeConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<ContextBridgeConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get handler counts
   */
  getHandlerCounts(): { extension: number; page: number } {
    return {
      extension: this.extensionHandlers.size,
      page: this.pageHandlers.size,
    };
  }
  
  /**
   * Log message if debug enabled
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[ContextBridge]', ...args);
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a ContextBridge
 */
export function createContextBridge(
  config?: Partial<ContextBridgeConfig>
): ContextBridge {
  return new ContextBridge(config);
}

/**
 * Create and initialize a ContextBridge
 */
export function createInitializedBridge(
  config?: Partial<ContextBridgeConfig>
): ContextBridge {
  const bridge = new ContextBridge(config);
  bridge.initialize();
  return bridge;
}

/**
 * Create a debug bridge with logging enabled
 */
export function createDebugBridge(): ContextBridge {
  return new ContextBridge({ debug: true });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultBridge: ContextBridge | null = null;

/**
 * Get default bridge instance
 */
export function getContextBridge(): ContextBridge {
  if (!defaultBridge) {
    defaultBridge = new ContextBridge();
    defaultBridge.initialize();
  }
  return defaultBridge;
}

/**
 * Reset default bridge
 */
export function resetContextBridge(): void {
  if (defaultBridge) {
    defaultBridge.shutdown();
    defaultBridge = null;
  }
}

// ============================================================================
// MOCK IMPLEMENTATION (for testing)
// ============================================================================

/**
 * Mock ContextBridge for testing without Chrome APIs
 */
export class MockContextBridge implements IContextBridge {
  private extensionHandlers: Set<ExtensionMessageHandler> = new Set();
  private pageHandlers: Set<PageMessageHandler> = new Set();
  private sentExtensionMessages: ContentToExtensionMessage[] = [];
  private sentPageMessages: PageContextMessage[] = [];
  private extensionResponse: unknown = { success: true };
  private injectedScripts: string[] = [];
  
  async sendToExtension(message: ContentToExtensionMessage): Promise<unknown> {
    this.sentExtensionMessages.push(message);
    return this.extensionResponse;
  }
  
  sendToPage(message: PageContextMessage): void {
    this.sentPageMessages.push(message);
  }
  
  onExtensionMessage(handler: ExtensionMessageHandler): void {
    this.extensionHandlers.add(handler);
  }
  
  onPageMessage(handler: PageMessageHandler): void {
    this.pageHandlers.add(handler);
  }
  
  offExtensionMessage(handler: Function): void {
    this.extensionHandlers.delete(handler as ExtensionMessageHandler);
  }
  
  offPageMessage(handler: Function): void {
    this.pageHandlers.delete(handler as PageMessageHandler);
  }
  
  async injectPageScript(scriptPath: string): Promise<boolean> {
    this.injectedScripts.push(scriptPath);
    return true;
  }
  
  // Test helpers
  
  /**
   * Simulate receiving extension message
   */
  simulateExtensionMessage(
    message: ExtensionToContentMessage,
    sender?: chrome.runtime.MessageSender
  ): unknown[] {
    const responses: unknown[] = [];
    const mockSender = sender || { id: 'test' };
    
    for (const handler of this.extensionHandlers) {
      let response: unknown;
      handler(message, mockSender, (r) => { response = r; });
      responses.push(response);
    }
    
    return responses;
  }
  
  /**
   * Simulate receiving page message
   */
  simulatePageMessage(message: PageContextMessage): void {
    for (const handler of this.pageHandlers) {
      handler(message);
    }
  }
  
  /**
   * Set response for sendToExtension
   */
  setExtensionResponse(response: unknown): void {
    this.extensionResponse = response;
  }
  
  /**
   * Get sent extension messages
   */
  getSentExtensionMessages(): ContentToExtensionMessage[] {
    return [...this.sentExtensionMessages];
  }
  
  /**
   * Get sent page messages
   */
  getSentPageMessages(): PageContextMessage[] {
    return [...this.sentPageMessages];
  }
  
  /**
   * Get injected scripts
   */
  getInjectedScripts(): string[] {
    return [...this.injectedScripts];
  }
  
  /**
   * Get handler counts
   */
  getHandlerCounts(): { extension: number; page: number } {
    return {
      extension: this.extensionHandlers.size,
      page: this.pageHandlers.size,
    };
  }
  
  /**
   * Reset mock state
   */
  reset(): void {
    this.sentExtensionMessages = [];
    this.sentPageMessages = [];
    this.injectedScripts = [];
    this.extensionHandlers.clear();
    this.pageHandlers.clear();
    this.extensionResponse = { success: true };
  }
}

/**
 * Create a mock context bridge
 */
export function createMockContextBridge(): MockContextBridge {
  return new MockContextBridge();
}
