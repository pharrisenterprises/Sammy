/**
 * ExtensionBridge - Bridge for extension page communication
 * @module background/ExtensionBridge
 * @version 1.0.0
 * 
 * Provides type-safe API for UI components to communicate with background:
 * - Promise-based message sending (wraps callback pattern)
 * - Event subscription for broadcasts (recording events, replay progress)
 * - Automatic retry on transient failures
 * - Connection state management
 * 
 * @see message-bus_breakdown.md for communication patterns
 * @see ui-components_breakdown.md for UI usage patterns
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message to send to background
 */
export interface BridgeMessage<T = unknown> {
  action: string;
  payload?: T;
}

/**
 * Response from background
 */
export interface BridgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  id?: number;
  tabId?: number;
}

/**
 * Chrome runtime interface (for testing)
 */
export interface IChromeRuntime {
  sendMessage<T = unknown>(
    message: BridgeMessage,
    callback?: (response: BridgeResponse<T>) => void
  ): void;
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
  lastError?: { message?: string };
  id?: string;
}

/**
 * Broadcast event from background
 */
export interface BroadcastEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
  source?: string;
}

/**
 * Broadcast event listener
 */
export type BroadcastListener<T = unknown> = (event: BroadcastEvent<T>) => void;

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  timeout: number;
  retryCount: number;
  retryDelay: number;
  debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  timeout: 30000,
  retryCount: 2,
  retryDelay: 500,
  debug: false,
};

/**
 * Known broadcast event types
 */
export const BROADCAST_EVENTS = {
  LOG_EVENT: 'logEvent',
  STEP_RESULT: 'step_result',
  RECORDING_STARTED: 'recording_started',
  RECORDING_STOPPED: 'recording_stopped',
  REPLAY_STARTED: 'replay_started',
  REPLAY_STOPPED: 'replay_stopped',
  REPLAY_PROGRESS: 'replay_progress',
  TAB_OPENED: 'tab_opened',
  TAB_CLOSED: 'tab_closed',
} as const;

// ============================================================================
// EXTENSION BRIDGE CLASS
// ============================================================================

/**
 * ExtensionBridge - Type-safe bridge for extension page communication
 * 
 * @example
 * ```typescript
 * // In a React component
 * const bridge = ExtensionBridge.getInstance();
 * 
 * // Send message and get response
 * const response = await bridge.send<ProjectsResponse>('get_all_projects');
 * if (response.success) {
 *   setProjects(response.data.projects);
 * }
 * 
 * // Subscribe to events
 * const unsubscribe = bridge.on('logEvent', (event) => {
 *   console.log('Received:', event.data);
 * });
 * 
 * // Cleanup on unmount
 * return () => unsubscribe();
 * ```
 */
export class ExtensionBridge {
  private static instance: ExtensionBridge | null = null;

  private config: BridgeConfig;
  private chromeRuntime: IChromeRuntime | null;
  
  // Event listeners
  private broadcastListeners: Map<string, Set<BroadcastListener>> = new Map();
  private globalListeners: Set<BroadcastListener> = new Set();
  
  // Chrome message listener reference
  private messageListener: ((
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void) | null = null;

  // Connection state
  private isConnected: boolean = false;
  private connectionError: string | null = null;

  // Statistics
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    retries: 0,
  };

  /**
   * Create ExtensionBridge
   */
  constructor(
    config: Partial<BridgeConfig> = {},
    chromeRuntime?: IChromeRuntime | null
  ) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.chromeRuntime = chromeRuntime ?? this.getDefaultChromeRuntime();
    
    this.checkConnection();
    this.setupMessageListener();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<BridgeConfig>): ExtensionBridge {
    if (!ExtensionBridge.instance) {
      ExtensionBridge.instance = new ExtensionBridge(config);
    }
    return ExtensionBridge.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  public static resetInstance(): void {
    if (ExtensionBridge.instance) {
      ExtensionBridge.instance.destroy();
      ExtensionBridge.instance = null;
    }
  }

  // ==========================================================================
  // MESSAGING
  // ==========================================================================

  /**
   * Send message to background and get response
   */
  public async send<TResponse = unknown, TPayload = unknown>(
    action: string,
    payload?: TPayload
  ): Promise<BridgeResponse<TResponse>> {
    if (!this.chromeRuntime) {
      return {
        success: false,
        error: 'Chrome runtime not available',
      };
    }

    const message: BridgeMessage<TPayload> = { action, payload };

    return this.sendWithRetry<TResponse>(message, this.config.retryCount);
  }

  /**
   * Send message with retry logic
   */
  private async sendWithRetry<TResponse>(
    message: BridgeMessage,
    retriesLeft: number
  ): Promise<BridgeResponse<TResponse>> {
    try {
      const response = await this.sendMessage<TResponse>(message);
      this.stats.messagesSent++;
      return response;
    } catch (error) {
      if (retriesLeft > 0) {
        this.stats.retries++;
        
        if (this.config.debug) {
          console.warn(`[ExtensionBridge] Retry ${this.config.retryCount - retriesLeft + 1}:`, error);
        }
        
        await this.delay(this.config.retryDelay);
        return this.sendWithRetry<TResponse>(message, retriesLeft - 1);
      }

      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message send failed',
      };
    }
  }

  /**
   * Send message (promisified)
   */
  private sendMessage<TResponse>(message: BridgeMessage): Promise<BridgeResponse<TResponse>> {
    return new Promise((resolve, reject) => {
      if (!this.chromeRuntime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      try {
        this.chromeRuntime.sendMessage<TResponse>(message, (response) => {
          clearTimeout(timeoutId);

          // Check for Chrome runtime error
          if (this.chromeRuntime?.lastError) {
            reject(new Error(this.chromeRuntime.lastError.message ?? 'Unknown error'));
            return;
          }

          // Handle undefined response
          if (response === undefined) {
            resolve({ success: false, error: 'No response received' });
            return;
          }

          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Send message without waiting for response (fire-and-forget)
   */
  public sendAsync<TPayload = unknown>(action: string, payload?: TPayload): void {
    if (!this.chromeRuntime) {
      if (this.config.debug) {
        console.warn('[ExtensionBridge] Chrome runtime not available');
      }
      return;
    }

    const message: BridgeMessage<TPayload> = { action, payload };

    try {
      this.chromeRuntime.sendMessage(message);
      this.stats.messagesSent++;
    } catch (error) {
      this.stats.errors++;
      if (this.config.debug) {
        console.error('[ExtensionBridge] Send async failed:', error);
      }
    }
  }

  // ==========================================================================
  // EVENT SUBSCRIPTION
  // ==========================================================================

  /**
   * Subscribe to broadcast events of specific type
   */
  public on<T = unknown>(eventType: string, listener: BroadcastListener<T>): () => void {
    let listeners = this.broadcastListeners.get(eventType);
    if (!listeners) {
      listeners = new Set();
      this.broadcastListeners.set(eventType, listeners);
    }
    
    listeners.add(listener as BroadcastListener);
    
    return () => {
      listeners?.delete(listener as BroadcastListener);
      if (listeners?.size === 0) {
        this.broadcastListeners.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to all broadcast events
   */
  public onAny(listener: BroadcastListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Emit event to listeners (used by message listener)
   */
  private emitBroadcast(event: BroadcastEvent): void {
    // Type-specific listeners
    const typeListeners = this.broadcastListeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          if (this.config.debug) {
            console.error('[ExtensionBridge] Listener error:', error);
          }
        }
      });
    }

    // Global listeners
    this.globalListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        if (this.config.debug) {
          console.error('[ExtensionBridge] Global listener error:', error);
        }
      }
    });

    this.stats.messagesReceived++;
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  /**
   * Check if connected to extension
   */
  private checkConnection(): void {
    if (!this.chromeRuntime) {
      this.isConnected = false;
      this.connectionError = 'Chrome runtime not available';
      return;
    }

    if (!this.chromeRuntime.id) {
      this.isConnected = false;
      this.connectionError = 'Not running in extension context';
      return;
    }

    this.isConnected = true;
    this.connectionError = null;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): { connected: boolean; error: string | null } {
    return {
      connected: this.isConnected,
      error: this.connectionError,
    };
  }

  /**
   * Check if connected
   */
  public isExtensionConnected(): boolean {
    return this.isConnected;
  }

  // ==========================================================================
  // MESSAGE LISTENER
  // ==========================================================================

  /**
   * Setup Chrome message listener for broadcasts
   */
  private setupMessageListener(): void {
    if (!this.chromeRuntime) {
      return;
    }

    this.messageListener = (message, _sender, _sendResponse) => {
      // Check if it's a broadcast event
      if (this.isBroadcastMessage(message)) {
        const event: BroadcastEvent = {
          type: message.type,
          data: message.data,
          timestamp: Date.now(),
          source: 'background',
        };

        this.emitBroadcast(event);
      }

      // Don't send response for broadcasts
      return false;
    };

    this.chromeRuntime.onMessage.addListener(this.messageListener);
  }

  /**
   * Check if message is a broadcast
   */
  private isBroadcastMessage(message: unknown): message is { type: string; data: unknown } {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof (message as { type: unknown }).type === 'string'
    );
  }

  /**
   * Remove message listener
   */
  private removeMessageListener(): void {
    if (this.chromeRuntime && this.messageListener) {
      this.chromeRuntime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Destroy bridge instance
   */
  public destroy(): void {
    this.removeMessageListener();
    this.broadcastListeners.clear();
    this.globalListeners.clear();
    this.isConnected = false;
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Get all projects
   */
  public async getProjects(): Promise<BridgeResponse<{ projects: unknown[] }>> {
    return this.send('get_all_projects');
  }

  /**
   * Get project by ID
   */
  public async getProject(id: number): Promise<BridgeResponse<{ project: unknown }>> {
    return this.send('get_project_by_id', { id });
  }

  /**
   * Add project
   */
  public async addProject(project: {
    name: string;
    description?: string;
    target_url: string;
  }): Promise<BridgeResponse<{ id: number }>> {
    return this.send('add_project', project);
  }

  /**
   * Update project
   */
  public async updateProject(
    id: number,
    updates: Record<string, unknown>
  ): Promise<BridgeResponse<void>> {
    return this.send('update_project', { id, ...updates });
  }

  /**
   * Delete project
   */
  public async deleteProject(id: number): Promise<BridgeResponse<void>> {
    return this.send('delete_project', { id });
  }

  /**
   * Open tab with URL
   */
  public async openTab(url: string, inject: boolean = true): Promise<BridgeResponse<{ tabId: number }>> {
    return this.send('openTab', { url, inject });
  }

  /**
   * Close opened tab
   */
  public async closeTab(): Promise<BridgeResponse<void>> {
    return this.send('close_opened_tab');
  }

  /**
   * Start recording
   */
  public async startRecording(
    projectId: number,
    tabId: number
  ): Promise<BridgeResponse<{ session: unknown }>> {
    return this.send('start_recording', { projectId, tabId });
  }

  /**
   * Stop recording
   */
  public async stopRecording(): Promise<BridgeResponse<{ steps: unknown[] }>> {
    return this.send('stop_recording');
  }

  /**
   * Get recording status
   */
  public async getRecordingStatus(): Promise<BridgeResponse<{
    isRecording: boolean;
    session: unknown | null;
  }>> {
    return this.send('get_recording_status');
  }

  /**
   * Start replay
   */
  public async startReplay(config: {
    projectId: number;
    tabId: number;
    steps: unknown[];
    csvRows?: Record<string, string>[];
  }): Promise<BridgeResponse<{ session: unknown }>> {
    return this.send('start_replay', config);
  }

  /**
   * Stop replay
   */
  public async stopReplay(): Promise<BridgeResponse<{ results: unknown[] }>> {
    return this.send('stop_replay');
  }

  /**
   * Get replay status
   */
  public async getReplayStatus(): Promise<BridgeResponse<{
    isRunning: boolean;
    session: unknown | null;
    progress: unknown | null;
  }>> {
    return this.send('get_replay_status');
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
    };
  }

  /**
   * Get config
   */
  public getConfig(): BridgeConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  public updateConfig(updates: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ==========================================================================
  // DEFAULT RUNTIME
  // ==========================================================================

  private getDefaultChromeRuntime(): IChromeRuntime | null {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return {
        sendMessage: (message, callback) => {
          chrome.runtime.sendMessage(message, callback);
        },
        onMessage: {
          addListener: (callback) => chrome.runtime.onMessage.addListener(callback),
          removeListener: (callback) => chrome.runtime.onMessage.removeListener(callback),
        },
        get lastError() {
          return chrome.runtime.lastError;
        },
        get id() {
          return chrome.runtime.id;
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
 * Create ExtensionBridge instance
 */
export function createExtensionBridge(
  config?: Partial<BridgeConfig>,
  chromeRuntime?: IChromeRuntime | null
): ExtensionBridge {
  return new ExtensionBridge(config, chromeRuntime);
}

/**
 * Get singleton ExtensionBridge instance
 */
export function getExtensionBridge(config?: Partial<BridgeConfig>): ExtensionBridge {
  return ExtensionBridge.getInstance(config);
}

// ============================================================================
// REACT HOOK HELPER
// ============================================================================

/**
 * Create a hook-friendly bridge subscription
 * Usage: const [events, subscribe] = useBridgeEvents('logEvent');
 */
export function createBridgeSubscription<T = unknown>(
  bridge: ExtensionBridge,
  eventType: string
): {
  subscribe: (callback: BroadcastListener<T>) => () => void;
  getLatest: () => BroadcastEvent<T> | null;
} {
  let latestEvent: BroadcastEvent<T> | null = null;

  return {
    subscribe: (callback: BroadcastListener<T>) => {
      return bridge.on<T>(eventType, (event) => {
        latestEvent = event;
        callback(event);
      });
    },
    getLatest: () => latestEvent,
  };
}
