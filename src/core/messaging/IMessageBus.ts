/**
 * IMessageBus - Interface for extension messaging system
 * @module core/messaging/IMessageBus
 * @version 1.0.0
 * 
 * Defines the contract for communication between extension components:
 * - Background script (service worker)
 * - Content scripts (per-tab)
 * - Popup UI
 * - DevTools panel
 * - Options page
 * 
 * Features:
 * - Type-safe message handling
 * - Request/response with timeouts
 * - Pub/sub broadcasting
 * - Channel-based routing
 * - Connection management
 * 
 * @see message-bus_breakdown.md for architecture details
 * @see messages.ts for message type definitions
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Message source/destination contexts
 */
export type MessageContext =
  | 'background'
  | 'content'
  | 'popup'
  | 'devtools'
  | 'options'
  | 'offscreen'
  | 'unknown';

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Base message structure
 */
export interface Message<T = unknown> {
  /** Unique message ID */
  id: string;
  /** Message type/action */
  type: string;
  /** Message payload */
  payload: T;
  /** Source context */
  source: MessageContext;
  /** Target context (optional, for directed messages) */
  target?: MessageContext;
  /** Tab ID (for content script messages) */
  tabId?: number;
  /** Frame ID (for iframe content scripts) */
  frameId?: number;
  /** Message timestamp */
  timestamp: number;
  /** Message priority */
  priority?: MessagePriority;
  /** Correlation ID for request/response */
  correlationId?: string;
  /** Whether message expects response */
  expectsResponse?: boolean;
  /** Channel name for pub/sub */
  channel?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response message structure
 */
export interface MessageResponse<T = unknown> {
  /** Whether request succeeded */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code */
  errorCode?: string;
  /** Correlation ID matching request */
  correlationId: string;
  /** Response timestamp */
  timestamp: number;
}

/**
 * Message envelope for internal routing
 */
export interface MessageEnvelope<T = unknown> {
  /** The message */
  message: Message<T>;
  /** Sender information */
  sender: MessageSender;
  /** Response callback (if expecting response) */
  sendResponse?: (response: MessageResponse) => void;
}

/**
 * Sender information
 */
export interface MessageSender {
  /** Sender context */
  context: MessageContext;
  /** Tab ID if from content script */
  tabId?: number;
  /** Frame ID if from iframe */
  frameId?: number;
  /** Extension ID */
  extensionId?: string;
  /** Tab URL */
  url?: string;
  /** Origin */
  origin?: string;
}

// ============================================================================
// HANDLER TYPES
// ============================================================================

/**
 * Message handler function
 */
export type MessageHandler<TPayload = unknown, TResponse = unknown> = (
  payload: TPayload,
  sender: MessageSender,
  message: Message<TPayload>
) => TResponse | Promise<TResponse> | void;

/**
 * Message handler registration
 */
export interface HandlerRegistration {
  /** Message type to handle */
  type: string;
  /** Handler function */
  handler: MessageHandler;
  /** Only handle from specific context */
  fromContext?: MessageContext;
  /** Only handle in specific context */
  inContext?: MessageContext;
  /** Handler priority (higher = called first) */
  priority?: number;
  /** Whether handler is one-time */
  once?: boolean;
}

/**
 * Subscription for pub/sub
 */
export interface Subscription {
  /** Channel name */
  channel: string;
  /** Subscriber callback */
  callback: (payload: unknown, message: Message) => void;
  /** Subscriber context filter */
  contextFilter?: MessageContext[];
}

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

// ============================================================================
// CONNECTION TYPES
// ============================================================================

/**
 * Port connection for long-lived messaging
 */
export interface PortConnection {
  /** Port name */
  name: string;
  /** Connected context */
  context: MessageContext;
  /** Tab ID (for content scripts) */
  tabId?: number;
  /** Frame ID */
  frameId?: number;
  /** Connection timestamp */
  connectedAt: number;
  /** Whether port is connected */
  isConnected: boolean;
}

/**
 * Port message handler
 */
export type PortMessageHandler<T = unknown> = (
  message: T,
  port: PortConnection
) => void;

/**
 * Port disconnect handler
 */
export type PortDisconnectHandler = (port: PortConnection) => void;

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request options
 */
export interface RequestOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Target context */
  target?: MessageContext;
  /** Target tab ID */
  tabId?: number;
  /** Target frame ID */
  frameId?: number;
  /** Retry count on failure */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Message priority */
  priority?: MessagePriority;
}

/**
 * Broadcast options
 */
export interface BroadcastOptions {
  /** Channel to broadcast on */
  channel?: string;
  /** Contexts to broadcast to */
  targets?: MessageContext[];
  /** Exclude contexts */
  exclude?: MessageContext[];
  /** Include specific tab IDs */
  tabIds?: number[];
  /** Exclude specific tab IDs */
  excludeTabIds?: number[];
}

// ============================================================================
// BUS CONFIGURATION
// ============================================================================

/**
 * Message bus configuration
 */
export interface MessageBusConfig {
  /** Current context */
  context: MessageContext;
  /** Default request timeout (ms) */
  defaultTimeout?: number;
  /** Default retry count */
  defaultRetries?: number;
  /** Default retry delay (ms) */
  defaultRetryDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Message ID prefix */
  idPrefix?: string;
  /** Enable message queuing when disconnected */
  enableQueue?: boolean;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Queue flush interval (ms) */
  queueFlushInterval?: number;
}

/**
 * Message bus statistics
 */
export interface MessageBusStats {
  /** Messages sent count */
  messagesSent: number;
  /** Messages received count */
  messagesReceived: number;
  /** Requests sent count */
  requestsSent: number;
  /** Responses received count */
  responsesReceived: number;
  /** Timeouts count */
  timeouts: number;
  /** Errors count */
  errors: number;
  /** Active handlers count */
  activeHandlers: number;
  /** Active subscriptions count */
  activeSubscriptions: number;
  /** Active connections count */
  activeConnections: number;
  /** Queued messages count */
  queuedMessages: number;
  /** Last activity timestamp */
  lastActivity: number;
}

// ============================================================================
// MAIN INTERFACE
// ============================================================================

/**
 * IMessageBus - Main messaging interface
 * 
 * Provides communication between extension components with
 * support for one-way messages, request/response, and pub/sub.
 * 
 * @example
 * ```typescript
 * // Register a handler
 * bus.on('GET_STATUS', (payload, sender) => {
 *   return { status: 'ready' };
 * });
 * 
 * // Send a request
 * const response = await bus.request('GET_STATUS', {});
 * 
 * // Broadcast to all
 * bus.broadcast('STATUS_CHANGED', { status: 'recording' });
 * ```
 */
export interface IMessageBus {
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Current context
   */
  readonly context: MessageContext;
  
  /**
   * Whether bus is initialized
   */
  readonly isReady: boolean;
  
  /**
   * Initializes the message bus
   */
  initialize(): Promise<void>;
  
  /**
   * Shuts down the message bus
   */
  shutdown(): Promise<void>;
  
  // ==========================================================================
  // MESSAGE HANDLERS
  // ==========================================================================
  
  /**
   * Registers a message handler
   * 
   * @param type - Message type to handle
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  on<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): Unsubscribe;
  
  /**
   * Registers a one-time message handler
   * 
   * @param type - Message type to handle
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  once<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): Unsubscribe;
  
  /**
   * Removes a message handler
   * 
   * @param type - Message type
   * @param handler - Handler to remove
   */
  off<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): void;
  
  /**
   * Removes all handlers for a message type
   * 
   * @param type - Message type
   */
  offAll(type: string): void;
  
  // ==========================================================================
  // SEND MESSAGES
  // ==========================================================================
  
  /**
   * Sends a message (fire and forget)
   * 
   * @param type - Message type
   * @param payload - Message payload
   * @param options - Send options
   */
  send<T = unknown>(
    type: string,
    payload: T,
    options?: RequestOptions
  ): void;
  
  /**
   * Sends a message to a specific tab
   * 
   * @param tabId - Target tab ID
   * @param type - Message type
   * @param payload - Message payload
   * @param options - Send options
   */
  sendToTab<T = unknown>(
    tabId: number,
    type: string,
    payload: T,
    options?: RequestOptions
  ): void;
  
  /**
   * Sends a message to the background script
   * 
   * @param type - Message type
   * @param payload - Message payload
   * @param options - Send options
   */
  sendToBackground<T = unknown>(
    type: string,
    payload: T,
    options?: RequestOptions
  ): void;
  
  // ==========================================================================
  // REQUEST/RESPONSE
  // ==========================================================================
  
  /**
   * Sends a request and waits for response
   * 
   * @param type - Message type
   * @param payload - Request payload
   * @param options - Request options
   * @returns Response promise
   */
  request<TPayload = unknown, TResponse = unknown>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse>;
  
  /**
   * Sends a request to a specific tab
   * 
   * @param tabId - Target tab ID
   * @param type - Message type
   * @param payload - Request payload
   * @param options - Request options
   * @returns Response promise
   */
  requestFromTab<TPayload = unknown, TResponse = unknown>(
    tabId: number,
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse>;
  
  /**
   * Sends a request to background script
   * 
   * @param type - Message type
   * @param payload - Request payload
   * @param options - Request options
   * @returns Response promise
   */
  requestFromBackground<TPayload = unknown, TResponse = unknown>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse>;
  
  // ==========================================================================
  // BROADCAST (PUB/SUB)
  // ==========================================================================
  
  /**
   * Broadcasts a message to multiple targets
   * 
   * @param type - Message type
   * @param payload - Message payload
   * @param options - Broadcast options
   */
  broadcast<T = unknown>(
    type: string,
    payload: T,
    options?: BroadcastOptions
  ): void;
  
  /**
   * Subscribes to a channel
   * 
   * @param channel - Channel name
   * @param callback - Subscription callback
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(
    channel: string,
    callback: (payload: T, message: Message<T>) => void
  ): Unsubscribe;
  
  /**
   * Publishes to a channel
   * 
   * @param channel - Channel name
   * @param payload - Message payload
   */
  publish<T = unknown>(channel: string, payload: T): void;
  
  // ==========================================================================
  // PORT CONNECTIONS
  // ==========================================================================
  
  /**
   * Creates a port connection
   * 
   * @param name - Port name
   * @returns Port connection
   */
  connect(name: string): PortConnection;
  
  /**
   * Listens for port connections
   * 
   * @param name - Port name to listen for
   * @param handler - Connection handler
   * @returns Unsubscribe function
   */
  onConnect(
    name: string,
    handler: (port: PortConnection) => void
  ): Unsubscribe;
  
  /**
   * Sends a message over a port
   * 
   * @param port - Port connection
   * @param message - Message to send
   */
  postMessage<T = unknown>(port: PortConnection, message: T): void;
  
  /**
   * Registers a port message handler
   * 
   * @param port - Port connection
   * @param handler - Message handler
   * @returns Unsubscribe function
   */
  onPortMessage<T = unknown>(
    port: PortConnection,
    handler: PortMessageHandler<T>
  ): Unsubscribe;
  
  /**
   * Registers a port disconnect handler
   * 
   * @param port - Port connection
   * @param handler - Disconnect handler
   * @returns Unsubscribe function
   */
  onPortDisconnect(
    port: PortConnection,
    handler: PortDisconnectHandler
  ): Unsubscribe;
  
  /**
   * Disconnects a port
   * 
   * @param port - Port to disconnect
   */
  disconnect(port: PortConnection): void;
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Gets message bus statistics
   */
  getStats(): MessageBusStats;
  
  /**
   * Resets statistics
   */
  resetStats(): void;
  
  /**
   * Gets active connections
   */
  getConnections(): PortConnection[];
  
  /**
   * Gets registered handler types
   */
  getHandlerTypes(): string[];
  
  /**
   * Checks if a handler is registered for a type
   */
  hasHandler(type: string): boolean;
  
  /**
   * Creates a message ID
   */
  createMessageId(): string;
}

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

/**
 * Abstract base implementation with common functionality
 */
export abstract class BaseMessageBus implements IMessageBus {
  protected _context: MessageContext;
  protected _isReady: boolean = false;
  protected _config: Required<MessageBusConfig>;
  protected _handlers: Map<string, Set<HandlerRegistration>> = new Map();
  protected _subscriptions: Map<string, Set<Subscription>> = new Map();
  protected _pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  protected _stats: MessageBusStats;
  protected _messageCounter: number = 0;
  
  get context(): MessageContext {
    return this._context;
  }
  
  get isReady(): boolean {
    return this._isReady;
  }
  
  constructor(config: MessageBusConfig) {
    this._context = config.context;
    this._config = {
      context: config.context,
      defaultTimeout: config.defaultTimeout ?? 30000,
      defaultRetries: config.defaultRetries ?? 0,
      defaultRetryDelay: config.defaultRetryDelay ?? 1000,
      debug: config.debug ?? false,
      idPrefix: config.idPrefix ?? 'msg',
      enableQueue: config.enableQueue ?? false,
      maxQueueSize: config.maxQueueSize ?? 100,
      queueFlushInterval: config.queueFlushInterval ?? 1000,
    };
    
    this._stats = this.createEmptyStats();
  }
  
  protected createEmptyStats(): MessageBusStats {
    return {
      messagesSent: 0,
      messagesReceived: 0,
      requestsSent: 0,
      responsesReceived: 0,
      timeouts: 0,
      errors: 0,
      activeHandlers: 0,
      activeSubscriptions: 0,
      activeConnections: 0,
      queuedMessages: 0,
      lastActivity: Date.now(),
    };
  }
  
  // Abstract methods to be implemented
  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract send<T>(type: string, payload: T, options?: RequestOptions): void;
  abstract sendToTab<T>(tabId: number, type: string, payload: T, options?: RequestOptions): void;
  abstract sendToBackground<T>(type: string, payload: T, options?: RequestOptions): void;
  abstract request<TPayload, TResponse>(type: string, payload: TPayload, options?: RequestOptions): Promise<TResponse>;
  abstract requestFromTab<TPayload, TResponse>(tabId: number, type: string, payload: TPayload, options?: RequestOptions): Promise<TResponse>;
  abstract requestFromBackground<TPayload, TResponse>(type: string, payload: TPayload, options?: RequestOptions): Promise<TResponse>;
  abstract broadcast<T>(type: string, payload: T, options?: BroadcastOptions): void;
  abstract connect(name: string): PortConnection;
  abstract onConnect(name: string, handler: (port: PortConnection) => void): Unsubscribe;
  abstract postMessage<T>(port: PortConnection, message: T): void;
  abstract onPortMessage<T>(port: PortConnection, handler: PortMessageHandler<T>): Unsubscribe;
  abstract onPortDisconnect(port: PortConnection, handler: PortDisconnectHandler): Unsubscribe;
  abstract disconnect(port: PortConnection): void;
  abstract getConnections(): PortConnection[];
  
  // Default implementations
  
  on<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): Unsubscribe {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, new Set());
    }
    
    const registration: HandlerRegistration = {
      type,
      handler: handler as MessageHandler,
      once: false,
    };
    
    this._handlers.get(type)!.add(registration);
    this._stats.activeHandlers++;
    
    return () => {
      this._handlers.get(type)?.delete(registration);
      this._stats.activeHandlers--;
    };
  }
  
  once<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): Unsubscribe {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, new Set());
    }
    
    const registration: HandlerRegistration = {
      type,
      handler: handler as MessageHandler,
      once: true,
    };
    
    this._handlers.get(type)!.add(registration);
    this._stats.activeHandlers++;
    
    return () => {
      this._handlers.get(type)?.delete(registration);
      this._stats.activeHandlers--;
    };
  }
  
  off<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): void {
    const handlers = this._handlers.get(type);
    if (!handlers) return;
    
    for (const registration of handlers) {
      if (registration.handler === handler) {
        handlers.delete(registration);
        this._stats.activeHandlers--;
        break;
      }
    }
  }
  
  offAll(type: string): void {
    const handlers = this._handlers.get(type);
    if (handlers) {
      this._stats.activeHandlers -= handlers.size;
      this._handlers.delete(type);
    }
  }
  
  subscribe<T = unknown>(
    channel: string,
    callback: (payload: T, message: Message<T>) => void
  ): Unsubscribe {
    if (!this._subscriptions.has(channel)) {
      this._subscriptions.set(channel, new Set());
    }
    
    const subscription: Subscription = {
      channel,
      callback: callback as (payload: unknown, message: Message) => void,
    };
    
    this._subscriptions.get(channel)!.add(subscription);
    this._stats.activeSubscriptions++;
    
    return () => {
      this._subscriptions.get(channel)?.delete(subscription);
      this._stats.activeSubscriptions--;
    };
  }
  
  publish<T = unknown>(channel: string, payload: T): void {
    this.broadcast(channel, payload, { channel });
  }
  
  getStats(): MessageBusStats {
    return { ...this._stats };
  }
  
  resetStats(): void {
    this._stats = this.createEmptyStats();
  }
  
  getHandlerTypes(): string[] {
    return Array.from(this._handlers.keys());
  }
  
  hasHandler(type: string): boolean {
    const handlers = this._handlers.get(type);
    return handlers !== undefined && handlers.size > 0;
  }
  
  createMessageId(): string {
    this._messageCounter++;
    return `${this._config.idPrefix}-${this._context}-${Date.now()}-${this._messageCounter}`;
  }
  
  /**
   * Creates a message object
   */
  protected createMessage<T>(
    type: string,
    payload: T,
    options?: RequestOptions
  ): Message<T> {
    return {
      id: this.createMessageId(),
      type,
      payload,
      source: this._context,
      target: options?.target,
      tabId: options?.tabId,
      frameId: options?.frameId,
      timestamp: Date.now(),
      priority: options?.priority ?? 'normal',
      expectsResponse: false,
    };
  }
  
  /**
   * Handles an incoming message
   */
  protected async handleMessage(
    envelope: MessageEnvelope
  ): Promise<MessageResponse | undefined> {
    const { message, sender } = envelope;
    
    this._stats.messagesReceived++;
    this._stats.lastActivity = Date.now();
    
    // Check for channel subscription
    if (message.channel) {
      const subscriptions = this._subscriptions.get(message.channel);
      if (subscriptions) {
        for (const sub of subscriptions) {
          try {
            sub.callback(message.payload, message);
          } catch (error) {
            this._stats.errors++;
            this.logError('Subscription error', error);
          }
        }
      }
    }
    
    // Check for type handler
    const handlers = this._handlers.get(message.type);
    if (!handlers || handlers.size === 0) {
      return undefined;
    }
    
    // Execute handlers
    const toRemove: HandlerRegistration[] = [];
    let lastResponse: unknown;
    
    for (const registration of handlers) {
      try {
        const result = await registration.handler(
          message.payload,
          sender,
          message
        );
        
        if (result !== undefined) {
          lastResponse = result;
        }
        
        if (registration.once) {
          toRemove.push(registration);
        }
      } catch (error) {
        this._stats.errors++;
        this.logError('Handler error', error);
        
        if (message.expectsResponse) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            correlationId: message.correlationId ?? message.id,
            timestamp: Date.now(),
          };
        }
      }
    }
    
    // Remove one-time handlers
    for (const reg of toRemove) {
      handlers.delete(reg);
      this._stats.activeHandlers--;
    }
    
    // Return response if expected
    if (message.expectsResponse) {
      return {
        success: true,
        data: lastResponse,
        correlationId: message.correlationId ?? message.id,
        timestamp: Date.now(),
      };
    }
    
    return undefined;
  }
  
  /**
   * Handles a response to a pending request
   */
  protected handleResponse(response: MessageResponse): void {
    const pending = this._pendingRequests.get(response.correlationId);
    if (!pending) return;
    
    clearTimeout(pending.timeout);
    this._pendingRequests.delete(response.correlationId);
    
    this._stats.responsesReceived++;
    this._stats.lastActivity = Date.now();
    
    if (response.success) {
      pending.resolve(response.data);
    } else {
      pending.reject(new Error(response.error ?? 'Request failed'));
    }
  }
  
  /**
   * Logs debug message
   */
  protected log(message: string, ...args: unknown[]): void {
    if (this._config.debug) {
      console.log(`[MessageBus:${this._context}] ${message}`, ...args);
    }
  }
  
  /**
   * Logs error message
   */
  protected logError(message: string, error: unknown): void {
    console.error(`[MessageBus:${this._context}] ${message}`, error);
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for Message
 */
export function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'payload' in value &&
    'source' in value &&
    'timestamp' in value
  );
}

/**
 * Type guard for MessageResponse
 */
export function isMessageResponse(value: unknown): value is MessageResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'correlationId' in value &&
    'timestamp' in value
  );
}

/**
 * Type guard for MessageContext
 */
export function isMessageContext(value: string): value is MessageContext {
  return [
    'background',
    'content',
    'popup',
    'devtools',
    'options',
    'offscreen',
    'unknown',
  ].includes(value);
}

// ============================================================================
// FACTORY TYPES
// ============================================================================

/**
 * Message bus factory function type
 */
export type MessageBusFactory = (config: MessageBusConfig) => IMessageBus;

/**
 * Creates typed message handlers
 */
export function createTypedHandler<TPayload, TResponse>(
  handler: MessageHandler<TPayload, TResponse>
): MessageHandler<TPayload, TResponse> {
  return handler;
}
