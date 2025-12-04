/**
 * ContentScriptBridge - Bridge for content script communication
 * @module background/ContentScriptBridge
 * @version 1.0.0
 * 
 * Provides API for background to communicate with content scripts:
 * - Send replay commands (runStep, prepare_replay, etc.)
 * - Receive recording events from content scripts
 * - Track tab connection state
 * - Retry on tab communication failures
 * 
 * @see message-bus_breakdown.md for communication patterns
 * @see content-script-system_breakdown.md for content script patterns
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message to send to content script
 */
export interface ContentMessage<T = unknown> {
  type: string;
  data?: T;
}

/**
 * Response from content script
 */
export interface ContentResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Chrome tabs interface (for testing)
 */
export interface IChromeTabs {
  sendMessage<T = unknown>(
    tabId: number,
    message: ContentMessage,
    callback?: (response: T) => void
  ): void;
  get(tabId: number, callback: (tab?: chrome.tabs.Tab) => void): void;
}

/**
 * Chrome runtime interface (for lastError)
 */
export interface IChromeRuntime {
  lastError?: { message?: string };
  onMessage: {
    addListener(
      callback: (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => boolean | void
    ): void;
    removeListener(
      callback: (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => boolean | void
    ): void;
  };
}

/**
 * Message from content script
 */
export interface ContentScriptMessage<T = unknown> {
  type: string;
  data?: T;
}

/**
 * Content script message listener
 */
export type ContentMessageListener<T = unknown> = (
  message: ContentScriptMessage<T>,
  sender: chrome.runtime.MessageSender
) => void;

/**
 * Bridge configuration
 */
export interface ContentBridgeConfig {
  timeout: number;
  retryCount: number;
  retryDelay: number;
  debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONTENT_BRIDGE_CONFIG: ContentBridgeConfig = {
  timeout: 10000,
  retryCount: 2,
  retryDelay: 200,
  debug: false,
};

/**
 * Known content script message types
 */
export const CONTENT_MESSAGE_TYPES = {
  // Commands to content script
  RUN_STEP: 'runStep',
  PREPARE_REPLAY: 'prepare_replay',
  STOP_REPLAY: 'stop_replay',
  PAUSE_REPLAY: 'pause_replay',
  RESUME_REPLAY: 'resume_replay',
  ENABLE_RECORDING: 'enable_recording',
  DISABLE_RECORDING: 'disable_recording',
  PAUSE_RECORDING: 'pause_recording',
  RESUME_RECORDING: 'resume_recording',
  PAGE_LOADED: 'pageLoaded',
  HIGHLIGHT_ELEMENT: 'highlight_element',
  GET_PAGE_INFO: 'get_page_info',
  // Events from content script
  LOG_EVENT: 'logEvent',
  STEP_RESULT: 'step_result',
  PAGE_READY: 'page_ready',
  RECORDING_ERROR: 'recording_error',
  REPLAY_ERROR: 'replay_error',
} as const;

/**
 * Tab connection state
 */
export interface TabConnectionState {
  tabId: number;
  connected: boolean;
  lastContact: Date | null;
  messageCount: number;
  errors: number;
}

/**
 * Run step data
 */
export interface RunStepData {
  event: string;
  path?: string;
  value?: string;
  label?: string;
  bundle: Record<string, unknown>;
  x?: number;
  y?: number;
}

/**
 * Log event data (from recording)
 */
export interface LogEventData {
  eventType: string;
  xpath: string;
  value?: string;
  label?: string;
  bundle: Record<string, unknown>;
  page?: string;
  x?: number;
  y?: number;
  timestamp?: number;
}

// ============================================================================
// CONTENT SCRIPT BRIDGE CLASS
// ============================================================================

/**
 * ContentScriptBridge - Bridge for content script communication
 * 
 * @example
 * ```typescript
 * const bridge = new ContentScriptBridge();
 * 
 * // Send step to execute
 * const result = await bridge.runStep(tabId, {
 *   event: 'click',
 *   bundle: { xpath: '...', id: '...' },
 *   label: 'Submit Button'
 * });
 * 
 * // Listen for recording events
 * bridge.onLogEvent((data, sender) => {
 *   console.log('Recorded:', data);
 * });
 * ```
 */
export class ContentScriptBridge {
  private config: ContentBridgeConfig;
  private chromeTabs: IChromeTabs | null;
  private chromeRuntime: IChromeRuntime | null;

  // Tab connection tracking
  private tabStates: Map<number, TabConnectionState> = new Map();

  // Message listeners by type
  private messageListeners: Map<string, Set<ContentMessageListener>> = new Map();
  private globalListeners: Set<ContentMessageListener> = new Set();

  // Chrome message listener reference
  private runtimeMessageListener: ((
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void) | null = null;

  // Statistics
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    retries: 0,
    stepsSent: 0,
    stepsSucceeded: 0,
    stepsFailed: 0,
  };

  /**
   * Create ContentScriptBridge
   */
  constructor(
    config: Partial<ContentBridgeConfig> = {},
    chromeTabs?: IChromeTabs | null,
    chromeRuntime?: IChromeRuntime | null
  ) {
    this.config = { ...DEFAULT_CONTENT_BRIDGE_CONFIG, ...config };
    this.chromeTabs = chromeTabs ?? this.getDefaultChromeTabs();
    this.chromeRuntime = chromeRuntime ?? this.getDefaultChromeRuntime();

    this.setupMessageListener();
  }

  // ==========================================================================
  // MESSAGING TO CONTENT SCRIPTS
  // ==========================================================================

  /**
   * Send message to content script in tab
   */
  public async send<TResponse = unknown, TData = unknown>(
    tabId: number,
    type: string,
    data?: TData
  ): Promise<ContentResponse<TResponse>> {
    if (!this.chromeTabs) {
      return { success: false, error: 'Chrome tabs API not available' };
    }

    const message: ContentMessage<TData> = { type, data };
    return this.sendWithRetry<TResponse>(tabId, message, this.config.retryCount);
  }

  /**
   * Send message with retry logic
   */
  private async sendWithRetry<TResponse>(
    tabId: number,
    message: ContentMessage,
    retriesLeft: number
  ): Promise<ContentResponse<TResponse>> {
    try {
      const response = await this.sendMessage<TResponse>(tabId, message);
      this.stats.messagesSent++;
      this.updateTabState(tabId, true);
      return response;
    } catch (error) {
      if (retriesLeft > 0) {
        this.stats.retries++;

        if (this.config.debug) {
          console.warn(`[ContentScriptBridge] Retry ${this.config.retryCount - retriesLeft + 1} for tab ${tabId}:`, error);
        }

        await this.delay(this.config.retryDelay);
        return this.sendWithRetry<TResponse>(tabId, message, retriesLeft - 1);
      }

      this.stats.errors++;
      this.updateTabState(tabId, false);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message send failed',
      };
    }
  }

  /**
   * Send message (promisified)
   */
  private sendMessage<TResponse>(
    tabId: number,
    message: ContentMessage
  ): Promise<ContentResponse<TResponse>> {
    return new Promise((resolve, reject) => {
      if (!this.chromeTabs) {
        reject(new Error('Chrome tabs API not available'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      try {
        this.chromeTabs.sendMessage<TResponse>(tabId, message, (response) => {
          clearTimeout(timeoutId);

          // Check for Chrome runtime error
          if (this.chromeRuntime?.lastError) {
            reject(new Error(this.chromeRuntime.lastError.message ?? 'Unknown error'));
            return;
          }

          // Handle boolean response (from runStep)
          if (typeof response === 'boolean') {
            resolve({ success: response });
            return;
          }

          // Handle undefined response
          if (response === undefined) {
            resolve({ success: false, error: 'No response from content script' });
            return;
          }

          // Handle object response
          if (typeof response === 'object' && response !== null) {
            if ('success' in response) {
              resolve(response as ContentResponse<TResponse>);
            } else {
              resolve({ success: true, data: response as TResponse });
            }
            return;
          }

          resolve({ success: true, data: response as TResponse });
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Send message without waiting for response
   */
  public sendAsync<TData = unknown>(tabId: number, type: string, data?: TData): void {
    if (!this.chromeTabs) {
      if (this.config.debug) {
        console.warn('[ContentScriptBridge] Chrome tabs API not available');
      }
      return;
    }

    const message: ContentMessage<TData> = { type, data };

    try {
      this.chromeTabs.sendMessage(tabId, message);
      this.stats.messagesSent++;
    } catch (error) {
      this.stats.errors++;
      if (this.config.debug) {
        console.error('[ContentScriptBridge] Send async failed:', error);
      }
    }
  }

  // ==========================================================================
  // REPLAY COMMANDS
  // ==========================================================================

  /**
   * Send runStep command to execute a step
   */
  public async runStep(tabId: number, stepData: RunStepData): Promise<ContentResponse<boolean>> {
    this.stats.stepsSent++;

    const response = await this.send<boolean>(
      tabId,
      CONTENT_MESSAGE_TYPES.RUN_STEP,
      stepData
    );

    if (response.success) {
      this.stats.stepsSucceeded++;
    } else {
      this.stats.stepsFailed++;
    }

    return response;
  }

  /**
   * Prepare content script for replay
   */
  public async prepareReplay(tabId: number, projectId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.PREPARE_REPLAY, { projectId });
  }

  /**
   * Stop replay in content script
   */
  public async stopReplay(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.STOP_REPLAY);
  }

  /**
   * Pause replay in content script
   */
  public async pauseReplay(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.PAUSE_REPLAY);
  }

  /**
   * Resume replay in content script
   */
  public async resumeReplay(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.RESUME_REPLAY);
  }

  // ==========================================================================
  // RECORDING COMMANDS
  // ==========================================================================

  /**
   * Enable recording in content script
   */
  public async enableRecording(tabId: number, projectId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.ENABLE_RECORDING, { projectId });
  }

  /**
   * Disable recording in content script
   */
  public async disableRecording(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.DISABLE_RECORDING);
  }

  /**
   * Pause recording in content script
   */
  public async pauseRecording(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.PAUSE_RECORDING);
  }

  /**
   * Resume recording in content script
   */
  public async resumeRecording(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.RESUME_RECORDING);
  }

  // ==========================================================================
  // UTILITY COMMANDS
  // ==========================================================================

  /**
   * Notify content script page is loaded
   */
  public async notifyPageLoaded(tabId: number): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.PAGE_LOADED);
  }

  /**
   * Highlight element in page
   */
  public async highlightElement(
    tabId: number,
    selector: string,
    duration?: number
  ): Promise<ContentResponse<void>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.HIGHLIGHT_ELEMENT, { selector, duration });
  }

  /**
   * Get page info from content script
   */
  public async getPageInfo(tabId: number): Promise<ContentResponse<{
    url: string;
    title: string;
    readyState: string;
  }>> {
    return this.send(tabId, CONTENT_MESSAGE_TYPES.GET_PAGE_INFO);
  }

  // ==========================================================================
  // MESSAGE LISTENERS (FROM CONTENT SCRIPTS)
  // ==========================================================================

  /**
   * Listen for messages of specific type from content scripts
   */
  public on<T = unknown>(
    messageType: string,
    listener: ContentMessageListener<T>
  ): () => void {
    let listeners = this.messageListeners.get(messageType);
    if (!listeners) {
      listeners = new Set();
      this.messageListeners.set(messageType, listeners);
    }

    listeners.add(listener as ContentMessageListener);

    return () => {
      listeners?.delete(listener as ContentMessageListener);
      if (listeners?.size === 0) {
        this.messageListeners.delete(messageType);
      }
    };
  }

  /**
   * Listen for all messages from content scripts
   */
  public onAny(listener: ContentMessageListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Listen for logEvent (recording) messages
   */
  public onLogEvent(listener: ContentMessageListener<LogEventData>): () => void {
    return this.on(CONTENT_MESSAGE_TYPES.LOG_EVENT, listener);
  }

  /**
   * Listen for step result messages
   */
  public onStepResult(
    listener: ContentMessageListener<{ success: boolean; error?: string }>
  ): () => void {
    return this.on(CONTENT_MESSAGE_TYPES.STEP_RESULT, listener);
  }

  /**
   * Listen for page ready messages
   */
  public onPageReady(listener: ContentMessageListener<{ url: string }>): () => void {
    return this.on(CONTENT_MESSAGE_TYPES.PAGE_READY, listener);
  }

  // ==========================================================================
  // RUNTIME MESSAGE LISTENER
  // ==========================================================================

  /**
   * Setup Chrome runtime message listener
   */
  private setupMessageListener(): void {
    if (!this.chromeRuntime) {
      return;
    }

    this.runtimeMessageListener = (message, sender, _sendResponse) => {
      // Only process messages from content scripts (have tab info)
      if (!sender.tab?.id) {
        return false;
      }

      // Check if it's a content script message
      if (this.isContentScriptMessage(message)) {
        this.handleContentScriptMessage(message, sender);
        this.updateTabState(sender.tab.id, true);
      }

      // Don't send response - these are one-way broadcasts
      return false;
    };

    this.chromeRuntime.onMessage.addListener(this.runtimeMessageListener);
  }

  /**
   * Check if message is from content script
   */
  private isContentScriptMessage(message: unknown): message is ContentScriptMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof (message as { type: unknown }).type === 'string'
    );
  }

  /**
   * Handle incoming content script message
   */
  private handleContentScriptMessage(
    message: ContentScriptMessage,
    sender: chrome.runtime.MessageSender
  ): void {
    this.stats.messagesReceived++;

    // Type-specific listeners
    const typeListeners = this.messageListeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(message, sender);
        } catch (error) {
          if (this.config.debug) {
            console.error('[ContentScriptBridge] Listener error:', error);
          }
        }
      });
    }

    // Global listeners
    this.globalListeners.forEach(listener => {
      try {
        listener(message, sender);
      } catch (error) {
        if (this.config.debug) {
          console.error('[ContentScriptBridge] Global listener error:', error);
        }
      }
    });
  }

  /**
   * Remove runtime message listener
   */
  private removeMessageListener(): void {
    if (this.chromeRuntime && this.runtimeMessageListener) {
      this.chromeRuntime.onMessage.removeListener(this.runtimeMessageListener);
      this.runtimeMessageListener = null;
    }
  }

  // ==========================================================================
  // TAB STATE TRACKING
  // ==========================================================================

  /**
   * Update tab connection state
   */
  private updateTabState(tabId: number, success: boolean): void {
    let state = this.tabStates.get(tabId);
    if (!state) {
      state = {
        tabId,
        connected: false,
        lastContact: null,
        messageCount: 0,
        errors: 0,
      };
      this.tabStates.set(tabId, state);
    }

    if (success) {
      state.connected = true;
      state.lastContact = new Date();
      state.messageCount++;
    } else {
      state.errors++;
      // Mark as disconnected after multiple errors
      if (state.errors >= 3) {
        state.connected = false;
      }
    }
  }

  /**
   * Get tab connection state
   */
  public getTabState(tabId: number): TabConnectionState | undefined {
    return this.tabStates.get(tabId);
  }

  /**
   * Check if tab is connected
   */
  public isTabConnected(tabId: number): boolean {
    const state = this.tabStates.get(tabId);
    return state?.connected ?? false;
  }

  /**
   * Get all connected tabs
   */
  public getConnectedTabs(): number[] {
    const connected: number[] = [];
    this.tabStates.forEach((state, tabId) => {
      if (state.connected) {
        connected.push(tabId);
      }
    });
    return connected;
  }

  /**
   * Clear tab state
   */
  public clearTabState(tabId: number): void {
    this.tabStates.delete(tabId);
  }

  /**
   * Clear all tab states
   */
  public clearAllTabStates(): void {
    this.tabStates.clear();
  }

  // ==========================================================================
  // TAB VALIDATION
  // ==========================================================================

  /**
   * Check if tab exists
   */
  public async tabExists(tabId: number): Promise<boolean> {
    if (!this.chromeTabs) {
      return false;
    }

    return new Promise((resolve) => {
      this.chromeTabs!.get(tabId, (tab) => {
        resolve(!!tab);
      });
    });
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Destroy bridge
   */
  public destroy(): void {
    this.removeMessageListener();
    this.messageListeners.clear();
    this.globalListeners.clear();
    this.tabStates.clear();
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      retries: 0,
      stepsSent: 0,
      stepsSucceeded: 0,
      stepsFailed: 0,
    };
  }

  /**
   * Get config
   */
  public getConfig(): ContentBridgeConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  public updateConfig(updates: Partial<ContentBridgeConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ==========================================================================
  // DEFAULT API ACCESS
  // ==========================================================================

  private getDefaultChromeTabs(): IChromeTabs | null {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      return {
        sendMessage: (tabId, message, callback) => {
          chrome.tabs.sendMessage(tabId, message, callback);
        },
        get: (tabId, callback) => {
          chrome.tabs.get(tabId, callback);
        },
      };
    }
    return null;
  }

  private getDefaultChromeRuntime(): IChromeRuntime | null {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return {
        get lastError() {
          return chrome.runtime.lastError;
        },
        onMessage: {
          addListener: (callback) => chrome.runtime.onMessage.addListener(callback),
          removeListener: (callback) => chrome.runtime.onMessage.removeListener(callback),
        },
      };
    }
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create ContentScriptBridge instance
 */
export function createContentScriptBridge(
  config?: Partial<ContentBridgeConfig>,
  chromeTabs?: IChromeTabs | null,
  chromeRuntime?: IChromeRuntime | null
): ContentScriptBridge {
  return new ContentScriptBridge(config, chromeTabs, chromeRuntime);
}
