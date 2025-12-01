/**
 * ChromeMessageBus - Chrome extension messaging implementation
 * @module core/messaging/ChromeMessageBus
 * @version 1.0.0
 * 
 * Real messaging implementation using Chrome extension APIs.
 * Supports communication between all extension contexts:
 * - Background script (service worker)
 * - Content scripts
 * - Popup
 * - DevTools panel
 * - Options page
 * 
 * @see IMessageBus for interface contract
 * @see message-bus_breakdown.md for architecture details
 */

import {
  BaseMessageBus,
  type Message,
  type MessageEnvelope,
  type MessageSender,
  type MessageContext,
  type MessageBusConfig,
  type PortConnection,
  type RequestOptions,
  type BroadcastOptions,
  type PortMessageHandler,
  type PortDisconnectHandler,
  type Unsubscribe,
  isMessage,
  isMessageResponse,
} from './IMessageBus';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default request timeout (30 seconds)
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default retry delay (1 second)
 */
export const DEFAULT_RETRY_DELAY = 1000;

/**
 * Maximum retries for failed requests
 */
export const MAX_RETRIES = 3;

/**
 * Port name prefix
 */
export const PORT_PREFIX = 'copilot-port';

// ============================================================================
// CHROME API DETECTION
// ============================================================================

/**
 * Checks if Chrome runtime API is available
 */
export function isChromeRuntimeAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.runtime !== undefined &&
    typeof chrome.runtime.sendMessage === 'function'
  );
}

/**
 * Checks if Chrome tabs API is available
 */
export function isChromeTabsAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.tabs !== undefined &&
    typeof chrome.tabs.sendMessage === 'function'
  );
}

/**
 * Detects the current context
 */
export function detectContext(): MessageContext {
  if (typeof chrome === 'undefined') {
    return 'unknown';
  }
  
  // Check for background/service worker
  if (
    typeof self !== 'undefined' &&
    (self as unknown as { serviceWorker?: unknown }).serviceWorker !== undefined
  ) {
    return 'background';
  }
  
  // Check for extension pages
  if (typeof window !== 'undefined') {
    const url = window.location?.href ?? '';
    
    if (url.includes('popup.html')) {
      return 'popup';
    }
    
    if (url.includes('devtools') || url.includes('panel.html')) {
      return 'devtools';
    }
    
    if (url.includes('options')) {
      return 'options';
    }
    
    // Check for content script (no extension URL)
    if (!url.startsWith('chrome-extension://')) {
      return 'content';
    }
    
    // Check for background page
    if (chrome.extension?.getBackgroundPage?.() === window) {
      return 'background';
    }
  }
  
  return 'background';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts Chrome sender to MessageSender
 */
function convertSender(chromeSender?: chrome.runtime.MessageSender): MessageSender {
  return {
    context: chromeSender?.tab ? 'content' : 'unknown',
    tabId: chromeSender?.tab?.id,
    frameId: chromeSender?.frameId,
    extensionId: chromeSender?.id,
    url: chromeSender?.url ?? chromeSender?.tab?.url,
    origin: chromeSender?.origin,
  };
}

/**
 * Delays execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// INTERNAL PORT WRAPPER
// ============================================================================

/**
 * Internal port wrapper with additional state
 */
interface InternalPort {
  /** Chrome port */
  chromePort: chrome.runtime.Port;
  /** Port connection info */
  connection: PortConnection;
  /** Message handlers */
  messageHandlers: Set<PortMessageHandler>;
  /** Disconnect handlers */
  disconnectHandlers: Set<PortDisconnectHandler>;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * ChromeMessageBus - Chrome extension messaging implementation
 * 
 * Provides real messaging between extension components using
 * Chrome's runtime and tabs APIs.
 * 
 * @example
 * ```typescript
 * // In background script
 * const bus = new ChromeMessageBus({ context: 'background' });
 * await bus.initialize();
 * 
 * bus.on('GET_STATUS', () => ({ status: 'ready' }));
 * 
 * // In content script
 * const contentBus = new ChromeMessageBus({ context: 'content' });
 * await contentBus.initialize();
 * 
 * const status = await contentBus.requestFromBackground('GET_STATUS', {});
 * ```
 */
export class ChromeMessageBus extends BaseMessageBus {
  /**
   * Active port connections
   */
  private ports: Map<string, InternalPort> = new Map();
  
  /**
   * Port connection listeners
   */
  private portListeners: Map<string, Set<(port: PortConnection) => void>> = new Map();
  
  /**
   * Chrome message listener reference
   */
  private chromeMessageListener: ((
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void) | null = null;
  
  /**
   * Chrome port connect listener reference
   */
  private chromeConnectListener: ((port: chrome.runtime.Port) => void) | null = null;
  
  /**
   * Message queue for when disconnected
   */
  private messageQueue: Array<{
    type: string;
    payload: unknown;
    options?: RequestOptions;
    resolve?: (value: unknown) => void;
    reject?: (error: Error) => void;
  }> = [];
  
  /**
   * Queue flush interval reference
   */
  private queueFlushInterval: ReturnType<typeof setInterval> | null = null;
  
  /**
   * Creates a new ChromeMessageBus
   * 
   * @param config - Bus configuration
   */
  constructor(config?: Partial<MessageBusConfig>) {
    super({
      context: config?.context ?? detectContext(),
      defaultTimeout: DEFAULT_TIMEOUT,
      defaultRetries: 0,
      defaultRetryDelay: DEFAULT_RETRY_DELAY,
      debug: false,
      idPrefix: 'chrome',
      enableQueue: true,
      maxQueueSize: 100,
      queueFlushInterval: 1000,
      ...config,
    });
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Initializes the Chrome message bus
   */
  async initialize(): Promise<void> {
    if (this._isReady) return;
    
    if (!isChromeRuntimeAvailable()) {
      throw new Error('Chrome runtime API is not available');
    }
    
    // Set up message listener
    this.setupMessageListener();
    
    // Set up port connection listener (background only)
    if (this._context === 'background') {
      this.setupConnectListener();
    }
    
    // Set up queue flushing
    if (this._config.enableQueue) {
      this.queueFlushInterval = setInterval(
        () => this.flushQueue(),
        this._config.queueFlushInterval
      );
    }
    
    this._isReady = true;
    this.log('Initialized');
  }
  
  /**
   * Shuts down the Chrome message bus
   */
  async shutdown(): Promise<void> {
    // Remove message listener
    if (this.chromeMessageListener && isChromeRuntimeAvailable()) {
      chrome.runtime.onMessage.removeListener(this.chromeMessageListener);
      this.chromeMessageListener = null;
    }
    
    // Remove connect listener
    if (this.chromeConnectListener && isChromeRuntimeAvailable()) {
      chrome.runtime.onConnect.removeListener(this.chromeConnectListener);
      this.chromeConnectListener = null;
    }
    
    // Clear queue interval
    if (this.queueFlushInterval) {
      clearInterval(this.queueFlushInterval);
      this.queueFlushInterval = null;
    }
    
    // Disconnect all ports
    for (const internalPort of this.ports.values()) {
      try {
        internalPort.chromePort.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    this.ports.clear();
    
    // Clear handlers and subscriptions
    this._handlers.clear();
    this._subscriptions.clear();
    this._pendingRequests.clear();
    this.messageQueue = [];
    
    this._isReady = false;
    this.log('Shutdown');
  }
  
  /**
   * Sets up the Chrome message listener
   */
  private setupMessageListener(): void {
    this.chromeMessageListener = (message, sender, sendResponse) => {
      // Validate message format
      if (!isMessage(message)) {
        return false;
      }
      
      const envelope: MessageEnvelope = {
        message: message as Message,
        sender: convertSender(sender),
        sendResponse: (response) => {
          try {
            sendResponse(response);
          } catch {
            // Channel may be closed
          }
        },
      };
      
      // Handle message asynchronously
      this.handleMessage(envelope).then(response => {
        if (response && message.expectsResponse) {
          try {
            sendResponse(response);
          } catch {
            // Channel may be closed
          }
        }
      });
      
      // Return true to indicate async response
      return message.expectsResponse === true;
    };
    
    chrome.runtime.onMessage.addListener(this.chromeMessageListener);
  }
  
  /**
   * Sets up the Chrome port connection listener
   */
  private setupConnectListener(): void {
    this.chromeConnectListener = (chromePort) => {
      const portName = chromePort.name;
      
      // Create connection info
      const connection: PortConnection = {
        name: portName,
        context: chromePort.sender?.tab ? 'content' : 'unknown',
        tabId: chromePort.sender?.tab?.id,
        frameId: chromePort.sender?.frameId,
        connectedAt: Date.now(),
        isConnected: true,
      };
      
      // Create internal port
      const internalPort: InternalPort = {
        chromePort,
        connection,
        messageHandlers: new Set(),
        disconnectHandlers: new Set(),
      };
      
      // Store port
      const portId = this.createPortId(connection);
      this.ports.set(portId, internalPort);
      this._stats.activeConnections++;
      
      // Set up port message handler
      chromePort.onMessage.addListener((message) => {
        for (const handler of internalPort.messageHandlers) {
          try {
            handler(message, connection);
          } catch (error) {
            this.logError('Port message handler error', error);
          }
        }
      });
      
      // Set up port disconnect handler
      chromePort.onDisconnect.addListener(() => {
        connection.isConnected = false;
        this._stats.activeConnections--;
        
        for (const handler of internalPort.disconnectHandlers) {
          try {
            handler(connection);
          } catch (error) {
            this.logError('Port disconnect handler error', error);
          }
        }
        
        this.ports.delete(portId);
      });
      
      // Notify connection listeners
      const listeners = this.portListeners.get(portName);
      if (listeners) {
        for (const listener of listeners) {
          try {
            listener(connection);
          } catch (error) {
            this.logError('Port listener error', error);
          }
        }
      }
      
      this.log('Port connected:', portName);
    };
    
    chrome.runtime.onConnect.addListener(this.chromeConnectListener);
  }
  
  /**
   * Creates a unique port ID
   */
  private createPortId(connection: PortConnection): string {
    return `${connection.name}-${connection.tabId ?? 'bg'}-${connection.frameId ?? 0}-${connection.connectedAt}`;
  }
  
  // ==========================================================================
  // SEND MESSAGES
  // ==========================================================================
  
  /**
   * Sends a message (fire and forget)
   */
  send<T>(type: string, payload: T, options?: RequestOptions): void {
    const message = this.createMessage(type, payload, options);
    
    this._stats.messagesSent++;
    this._stats.lastActivity = Date.now();
    
    if (options?.tabId !== undefined) {
      this.sendToTabInternal(options.tabId, message, options?.frameId);
    } else {
      this.sendToRuntimeInternal(message);
    }
  }
  
  /**
   * Sends a message to a specific tab
   */
  sendToTab<T>(
    tabId: number,
    type: string,
    payload: T,
    options?: RequestOptions
  ): void {
    const message = this.createMessage(type, payload, { ...options, tabId });
    
    this._stats.messagesSent++;
    this._stats.lastActivity = Date.now();
    
    this.sendToTabInternal(tabId, message, options?.frameId);
  }
  
  /**
   * Sends a message to the background script
   */
  sendToBackground<T>(type: string, payload: T, options?: RequestOptions): void {
    const message = this.createMessage(type, payload, { ...options, target: 'background' });
    
    this._stats.messagesSent++;
    this._stats.lastActivity = Date.now();
    
    this.sendToRuntimeInternal(message);
  }
  
  /**
   * Internal: Send message via chrome.runtime
   */
  private sendToRuntimeInternal(message: Message): void {
    try {
      chrome.runtime.sendMessage(message, () => {
        if (isChromeRuntimeAvailable() && chrome.runtime.lastError) {
          this.log('Send error:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      this.logError('Failed to send message', error);
    }
  }
  
  /**
   * Internal: Send message to tab via chrome.tabs
   */
  private sendToTabInternal(tabId: number, message: Message, frameId?: number): void {
    if (!isChromeTabsAvailable()) {
      this.logError('Chrome tabs API not available', new Error('API unavailable'));
      return;
    }
    
    try {
      if (frameId !== undefined) {
        chrome.tabs.sendMessage(tabId, message, { frameId }, () => {
          if (isChromeRuntimeAvailable() && chrome.runtime.lastError) {
            this.log('Tab send error:', chrome.runtime.lastError.message);
          }
        });
      } else {
        chrome.tabs.sendMessage(tabId, message, () => {
          if (isChromeRuntimeAvailable() && chrome.runtime.lastError) {
            this.log('Tab send error:', chrome.runtime.lastError.message);
          }
        });
      }
    } catch (error) {
      this.logError('Failed to send to tab', error);
    }
  }
  

  
  // ==========================================================================
  // REQUEST/RESPONSE
  // ==========================================================================
  
  /**
   * Sends a request and waits for response
   */
  async request<TPayload = unknown, TResponse = unknown>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    const timeout = options?.timeout ?? this._config.defaultTimeout;
    const retries = options?.retries ?? this._config.defaultRetries;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.requestInternal<TPayload, TResponse>(type, payload, options, timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < retries) {
          await delay(options?.retryDelay ?? this._config.defaultRetryDelay);
        }
      }
    }
    
    this._stats.errors++;
    throw lastError ?? new Error('Request failed');
  }
  
  /**
   * Internal request implementation
   */
  private requestInternal<TPayload, TResponse>(
    type: string,
    payload: TPayload,
    options: RequestOptions | undefined,
    timeout: number
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const message = this.createMessage(type, payload, options);
      message.expectsResponse = true;
      message.correlationId = message.id;
      
      this._stats.requestsSent++;
      this._stats.lastActivity = Date.now();
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this._pendingRequests.delete(message.id);
        this._stats.timeouts++;
        reject(new Error(`Request timeout: ${type}`));
      }, timeout);
      
      // Store pending request
      this._pendingRequests.set(message.id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
      });
      
      // Send message
      const sendCallback = (response: unknown) => {
        if (chrome.runtime.lastError) {
          clearTimeout(timeoutId);
          this._pendingRequests.delete(message.id);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (isMessageResponse(response)) {
          this.handleResponse(response);
        } else if (response !== undefined) {
          // Direct response (not wrapped)
          clearTimeout(timeoutId);
          this._pendingRequests.delete(message.id);
          this._stats.responsesReceived++;
          resolve(response as TResponse);
        }
      };
      
      try {
        if (options?.tabId !== undefined) {
          if (options.frameId !== undefined) {
            chrome.tabs.sendMessage(options.tabId, message, { frameId: options.frameId }, sendCallback);
          } else {
            chrome.tabs.sendMessage(options.tabId, message, sendCallback);
          }
        } else {
          chrome.runtime.sendMessage(message, sendCallback);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        this._pendingRequests.delete(message.id);
        reject(error);
      }
    });
  }
  
  /**
   * Sends a request to a specific tab
   */
  async requestFromTab<TPayload = unknown, TResponse = unknown>(
    tabId: number,
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    return this.request<TPayload, TResponse>(type, payload, { ...options, tabId });
  }
  
  /**
   * Sends a request to background script
   */
  async requestFromBackground<TPayload = unknown, TResponse = unknown>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    return this.request<TPayload, TResponse>(type, payload, { ...options, target: 'background' });
  }
  
  // ==========================================================================
  // BROADCAST
  // ==========================================================================
  
  /**
   * Broadcasts a message to multiple targets
   */
  broadcast<T>(type: string, payload: T, options?: BroadcastOptions): void {
    const message = this.createMessage(type, payload);
    message.channel = options?.channel;
    
    this._stats.messagesSent++;
    this._stats.lastActivity = Date.now();
    
    // Notify local subscriptions first
    if (options?.channel) {
      const subscriptions = this._subscriptions.get(options.channel);
      if (subscriptions) {
        for (const sub of subscriptions) {
          try {
            sub.callback(payload, message);
          } catch (error) {
            this.logError('Subscription error', error);
          }
        }
      }
    }
    
    // Send to runtime (other contexts)
    this.sendToRuntimeInternal(message);
    
    // Broadcast to tabs if from background
    if (this._context === 'background' && isChromeTabsAvailable()) {
      const excludeTabIds = new Set(options?.excludeTabIds ?? []);
      const targetTabIds = options?.tabIds;
      
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id === undefined) continue;
          if (excludeTabIds.has(tab.id)) continue;
          if (targetTabIds && !targetTabIds.includes(tab.id)) continue;
          
          this.sendToTabInternal(tab.id, message);
        }
      });
    }
  }
  
  // ==========================================================================
  // PORT CONNECTIONS
  // ==========================================================================
  
  /**
   * Creates a port connection
   */
  connect(name: string): PortConnection {
    if (!isChromeRuntimeAvailable()) {
      throw new Error('Chrome runtime API not available');
    }
    
    const chromePort = chrome.runtime.connect({ name });
    
    const connection: PortConnection = {
      name,
      context: this._context,
      connectedAt: Date.now(),
      isConnected: true,
    };
    
    const internalPort: InternalPort = {
      chromePort,
      connection,
      messageHandlers: new Set(),
      disconnectHandlers: new Set(),
    };
    
    const portId = this.createPortId(connection);
    this.ports.set(portId, internalPort);
    this._stats.activeConnections++;
    
    // Set up message listener
    chromePort.onMessage.addListener((message) => {
      for (const handler of internalPort.messageHandlers) {
        try {
          handler(message, connection);
        } catch (error) {
          this.logError('Port message handler error', error);
        }
      }
    });
    
    // Set up disconnect listener
    chromePort.onDisconnect.addListener(() => {
      connection.isConnected = false;
      this._stats.activeConnections--;
      
      for (const handler of internalPort.disconnectHandlers) {
        try {
          handler(connection);
        } catch (error) {
          this.logError('Port disconnect handler error', error);
        }
      }
      
      this.ports.delete(portId);
    });
    
    this.log('Connected port:', name);
    return connection;
  }
  
  /**
   * Listens for port connections
   */
  onConnect(name: string, handler: (port: PortConnection) => void): Unsubscribe {
    if (!this.portListeners.has(name)) {
      this.portListeners.set(name, new Set());
    }
    
    this.portListeners.get(name)!.add(handler);
    
    return () => {
      this.portListeners.get(name)?.delete(handler);
    };
  }
  
  /**
   * Sends a message over a port
   */
  postMessage<T>(port: PortConnection, message: T): void {
    const internalPort = this.findInternalPort(port);
    
    if (!internalPort || !port.isConnected) {
      throw new Error('Port is not connected');
    }
    
    try {
      internalPort.chromePort.postMessage(message);
    } catch (error) {
      this.logError('Failed to post message', error);
      throw error;
    }
  }
  
  /**
   * Registers a port message handler
   */
  onPortMessage<T>(port: PortConnection, handler: PortMessageHandler<T>): Unsubscribe {
    const internalPort = this.findInternalPort(port);
    
    if (!internalPort) {
      throw new Error('Port not found');
    }
    
    internalPort.messageHandlers.add(handler as PortMessageHandler);
    
    return () => {
      internalPort.messageHandlers.delete(handler as PortMessageHandler);
    };
  }
  
  /**
   * Registers a port disconnect handler
   */
  onPortDisconnect(port: PortConnection, handler: PortDisconnectHandler): Unsubscribe {
    const internalPort = this.findInternalPort(port);
    
    if (!internalPort) {
      throw new Error('Port not found');
    }
    
    internalPort.disconnectHandlers.add(handler);
    
    return () => {
      internalPort.disconnectHandlers.delete(handler);
    };
  }
  
  /**
   * Disconnects a port
   */
  disconnect(port: PortConnection): void {
    const internalPort = this.findInternalPort(port);
    
    if (internalPort) {
      try {
        internalPort.chromePort.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      
      port.isConnected = false;
    }
  }
  
  /**
   * Gets active connections
   */
  getConnections(): PortConnection[] {
    return Array.from(this.ports.values())
      .map(p => p.connection)
      .filter(c => c.isConnected);
  }
  
  /**
   * Finds internal port by connection
   */
  private findInternalPort(port: PortConnection): InternalPort | undefined {
    for (const internalPort of this.ports.values()) {
      if (
        internalPort.connection.name === port.name &&
        internalPort.connection.connectedAt === port.connectedAt
      ) {
        return internalPort;
      }
    }
    return undefined;
  }
  
  // ==========================================================================
  // MESSAGE QUEUE
  // ==========================================================================
  
  /**
   * Flushes queued messages
   */
  private flushQueue(): void {
    if (this.messageQueue.length === 0) return;
    if (!this._isReady) return;
    
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const item of queue) {
      if (item.resolve && item.reject) {
        // Request
        this.request(item.type, item.payload, item.options)
          .then(item.resolve)
          .catch(item.reject);
      } else {
        // Send
        this.send(item.type, item.payload, item.options);
      }
    }
    
    this._stats.queuedMessages = this.messageQueue.length;
  }
  
  /**
   * Queues a message for later sending
   */
  queueMessage<T>(type: string, payload: T, options?: RequestOptions): void {
    if (this.messageQueue.length >= this._config.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest
    }
    
    this.messageQueue.push({ type, payload, options });
    this._stats.queuedMessages = this.messageQueue.length;
  }
  
  /**
   * Queues a request for later sending
   */
  queueRequest<TPayload, TResponse>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (this.messageQueue.length >= this._config.maxQueueSize) {
        this.messageQueue.shift();
      }
      
      this.messageQueue.push({
        type,
        payload,
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      
      this._stats.queuedMessages = this.messageQueue.length;
    });
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Singleton instance
 */
let instance: ChromeMessageBus | null = null;

/**
 * Gets or creates the global ChromeMessageBus singleton
 * 
 * @returns ChromeMessageBus instance
 */
export function getMessageBus(): ChromeMessageBus {
  if (!instance) {
    instance = new ChromeMessageBus();
  }
  return instance;
}

/**
 * Creates a new ChromeMessageBus instance
 * 
 * @param config - Bus configuration
 * @returns New ChromeMessageBus instance
 */
export function createMessageBus(config?: Partial<MessageBusConfig>): ChromeMessageBus {
  return new ChromeMessageBus(config);
}

/**
 * Resets the global singleton (for testing)
 */
export async function resetMessageBus(): Promise<void> {
  if (instance) {
    await instance.shutdown();
    instance = null;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ChromeMessageBus;
