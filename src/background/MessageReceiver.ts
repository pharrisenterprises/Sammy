/**
 * MessageReceiver - Chrome Runtime Message Router
 * @module background/MessageReceiver
 * @version 1.0.0
 * 
 * Receives and routes messages via chrome.runtime.onMessage.
 * Implements a handler registry pattern replacing monolithic if/else chains.
 * 
 * CRITICAL: All async handlers must return true to keep sendResponse open!
 * 
 * @see message-bus_breakdown.md for message patterns
 */

import type {
  IMessageRouter,
  BackgroundMessage,
  BackgroundResponse,
  MessageSender,
  MessageHandler,
  ActionCategory,
  RegisteredHandler,
  RouteResult,
  isBackgroundMessage,
  createErrorResponse,
} from './IBackgroundService';
import type { BackgroundConfig, MessageConfig } from './BackgroundConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message event types
 */
export type MessageEventType =
  | 'message_received'
  | 'message_handled'
  | 'message_error'
  | 'handler_registered'
  | 'handler_unregistered'
  | 'timeout';

/**
 * Message event
 */
export interface MessageEvent {
  type: MessageEventType;
  timestamp: Date;
  action?: string;
  requestId?: string;
  duration?: number;
  success?: boolean;
  error?: string;
}

/**
 * Message event listener
 */
export type MessageEventListener = (event: MessageEvent) => void;

/**
 * Pending request tracking
 */
interface PendingRequest {
  action: string;
  requestId: string;
  startTime: number;
  timeoutId?: ReturnType<typeof setTimeout>;
  sender: MessageSender;
}

/**
 * Chrome runtime onMessage API interface (for testing)
 */
export interface IChromeRuntimeMessages {
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

// ============================================================================
// MESSAGE RECEIVER CLASS
// ============================================================================

/**
 * MessageReceiver - Routes incoming messages to registered handlers
 * 
 * @example
 * ```typescript
 * const receiver = new MessageReceiver(config);
 * 
 * // Register handlers
 * receiver.register('get_all_projects', async (message, sender) => {
 *   const projects = await db.getAllProjects();
 *   return { success: true, data: projects };
 * }, 'project');
 * 
 * // Start receiving messages
 * receiver.start();
 * 
 * // Stop when done
 * receiver.stop();
 * ```
 */
export class MessageReceiver implements IMessageRouter {
  private config: BackgroundConfig;
  private chromeRuntime: IChromeRuntimeMessages;

  // Handler registry
  private handlers: Map<string, RegisteredHandler> = new Map();

  // Request tracking
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter: number = 0;

  // State
  private isListening: boolean = false;
  private messageListener: ((
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void) | null = null;

  // Event listeners
  private eventListeners: Set<MessageEventListener> = new Set();

  // Statistics
  private stats = {
    messagesReceived: 0,
    messagesHandled: 0,
    messagesUnhandled: 0,
    errors: 0,
    timeouts: 0,
  };

  /**
   * Create a new MessageReceiver
   * 
   * @param config - Background configuration
   * @param chromeRuntime - Chrome runtime API (defaults to chrome.runtime)
   */
  constructor(
    config: BackgroundConfig,
    chromeRuntime?: IChromeRuntimeMessages
  ) {
    this.config = config;
    this.chromeRuntime = chromeRuntime ?? 
      (typeof chrome !== 'undefined' ? chrome.runtime : this.createMockRuntime());
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register a message handler
   * 
   * @param action - Action name to handle
   * @param handler - Handler function
   * @param category - Optional category for organization
   */
  public register(
    action: string,
    handler: MessageHandler,
    category: ActionCategory = 'system'
  ): void {
    if (this.handlers.has(action)) {
      console.warn(`[MessageReceiver] Handler already registered for action: ${action}`);
    }

    this.handlers.set(action, {
      action,
      category,
      handler,
    });

    this.emitEvent({
      type: 'handler_registered',
      timestamp: new Date(),
      action,
    });

    if (this.config.getLoggingConfig().level === 'debug') {
      console.log(`[MessageReceiver] Registered handler: ${action} (${category})`);
    }
  }

  /**
   * Unregister a handler
   */
  public unregister(action: string): void {
    if (this.handlers.delete(action)) {
      this.emitEvent({
        type: 'handler_unregistered',
        timestamp: new Date(),
        action,
      });
    }
  }

  /**
   * Check if action has a handler
   */
  public hasHandler(action: string): boolean {
    return this.handlers.has(action);
  }

  /**
   * Get all registered handlers
   */
  public getHandlers(): RegisteredHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handlers by category
   */
  public getHandlersByCategory(category: ActionCategory): RegisteredHandler[] {
    return this.getHandlers().filter(h => h.category === category);
  }

  // ==========================================================================
  // MESSAGE ROUTING
  // ==========================================================================

  /**
   * Route a message to its handler
   */
  public async route(
    message: BackgroundMessage,
    sender: MessageSender
  ): Promise<RouteResult> {
    const startTime = Date.now();
    const requestId = message.requestId ?? this.generateRequestId();

    // Find handler
    const registered = this.handlers.get(message.action);
    if (!registered) {
      return {
        handled: false,
        handler: undefined,
        duration: Date.now() - startTime,
      };
    }

    // Track pending request
    this.trackRequest(message.action, requestId, sender);

    try {
      // Execute handler
      const response = await registered.handler(message, sender);

      // Complete tracking
      this.completeRequest(requestId);

      return {
        handled: true,
        response,
        handler: message.action,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      // Complete tracking with error
      this.completeRequest(requestId);

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        handled: true,
        response: { success: false, error: errorMessage },
        handler: message.action,
        duration: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // LISTENER MANAGEMENT
  // ==========================================================================

  /**
   * Start listening for messages
   */
  public start(): void {
    if (this.isListening) {
      console.warn('[MessageReceiver] Already listening');
      return;
    }

    this.messageListener = (message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    };

    this.chromeRuntime.onMessage.addListener(this.messageListener);
    this.isListening = true;

    if (this.config.getLoggingConfig().level === 'debug') {
      console.log('[MessageReceiver] Started listening for messages');
    }
  }

  /**
   * Stop listening for messages
   */
  public stop(): void {
    if (!this.isListening || !this.messageListener) {
      return;
    }

    this.chromeRuntime.onMessage.removeListener(this.messageListener);
    this.messageListener = null;
    this.isListening = false;

    // Clear pending requests
    this.clearPendingRequests();

    if (this.config.getLoggingConfig().level === 'debug') {
      console.log('[MessageReceiver] Stopped listening for messages');
    }
  }

  /**
   * Check if listening
   */
  public isActive(): boolean {
    return this.isListening;
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  /**
   * Handle incoming message
   * 
   * CRITICAL: This method must return true for async handlers
   * to keep the sendResponse channel open.
   */
  private handleMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean {
    this.stats.messagesReceived++;

    // Validate message
    if (!this.isValidMessage(message)) {
      if (this.config.getMessageConfig().logMessages) {
        console.warn('[MessageReceiver] Invalid message format:', message);
      }
      return false;
    }

    const bgMessage = message as BackgroundMessage;
    const bgSender = this.convertSender(sender);

    // Log if configured
    if (this.config.getMessageConfig().logMessages) {
      console.log(`[MessageReceiver] Received: ${bgMessage.action}`, {
        sender: bgSender,
        payload: bgMessage.payload,
      });
    }

    this.emitEvent({
      type: 'message_received',
      timestamp: new Date(),
      action: bgMessage.action,
      requestId: bgMessage.requestId,
    });

    // Find handler
    const registered = this.handlers.get(bgMessage.action);
    if (!registered) {
      this.stats.messagesUnhandled++;
      
      if (this.config.getMessageConfig().logMessages) {
        console.warn(`[MessageReceiver] No handler for action: ${bgMessage.action}`);
      }

      // Return false to let other listeners handle it
      return false;
    }

    // Track request
    const requestId = bgMessage.requestId ?? this.generateRequestId();
    this.trackRequest(bgMessage.action, requestId, bgSender);

    // Execute handler asynchronously
    const startTime = Date.now();

    this.executeHandler(registered, bgMessage, bgSender, requestId)
      .then(response => {
        const duration = Date.now() - startTime;
        this.stats.messagesHandled++;

        // Send response
        sendResponse(response);

        this.emitEvent({
          type: 'message_handled',
          timestamp: new Date(),
          action: bgMessage.action,
          requestId,
          duration,
          success: response.success,
        });

        if (this.config.getMessageConfig().logMessages) {
          console.log(`[MessageReceiver] Handled: ${bgMessage.action} (${duration}ms)`, response);
        }
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        this.stats.errors++;

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorResponse: BackgroundResponse = {
          success: false,
          error: errorMessage,
        };

        sendResponse(errorResponse);

        this.emitEvent({
          type: 'message_error',
          timestamp: new Date(),
          action: bgMessage.action,
          requestId,
          duration,
          error: errorMessage,
        });

        console.error(`[MessageReceiver] Error handling ${bgMessage.action}:`, error);
      })
      .finally(() => {
        this.completeRequest(requestId);
      });

    // CRITICAL: Return true to keep sendResponse channel open for async response
    return true;
  }

  /**
   * Execute a handler with timeout
   */
  private async executeHandler(
    registered: RegisteredHandler,
    message: BackgroundMessage,
    sender: MessageSender,
    requestId: string
  ): Promise<BackgroundResponse> {
    const timeout = this.config.getMessageConfig().timeout;

    // Create timeout promise
    const timeoutPromise = new Promise<BackgroundResponse>((_, reject) => {
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        pending.timeoutId = setTimeout(() => {
          this.stats.timeouts++;
          this.emitEvent({
            type: 'timeout',
            timestamp: new Date(),
            action: message.action,
            requestId,
          });
          reject(new Error(`Handler timeout after ${timeout}ms`));
        }, timeout);
      }
    });

    // Execute handler
    const handlerPromise = Promise.resolve(registered.handler(message, sender));

    // Race between handler and timeout
    return Promise.race([handlerPromise, timeoutPromise]);
  }

  // ==========================================================================
  // REQUEST TRACKING
  // ==========================================================================

  /**
   * Track a pending request
   */
  private trackRequest(action: string, requestId: string, sender: MessageSender): void {
    if (!this.config.getMessageConfig().trackRequestIds) {
      return;
    }

    this.pendingRequests.set(requestId, {
      action,
      requestId,
      startTime: Date.now(),
      sender,
    });
  }

  /**
   * Complete a pending request
   */
  private completeRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      // Clear timeout
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Clear all pending requests
   */
  private clearPendingRequests(): void {
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    this.pendingRequests.clear();
  }

  /**
   * Get pending request count
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get pending requests
   */
  public getPendingRequests(): PendingRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate message format
   */
  private isValidMessage(message: unknown): boolean {
    if (!this.config.getMessageConfig().validateMessages) {
      return true;
    }

    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;
    
    // Must have action property
    if (typeof msg.action !== 'string' || !msg.action) {
      return false;
    }

    // Check payload size if configured
    const maxSize = this.config.getMessageConfig().maxPayloadSize;
    if (maxSize && msg.payload) {
      try {
        const size = new Blob([JSON.stringify(msg.payload)]).size;
        if (size > maxSize) {
          console.warn(`[MessageReceiver] Payload too large: ${size} > ${maxSize}`);
          return false;
        }
      } catch {
        // Ignore serialization errors for validation
      }
    }

    return true;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Convert Chrome sender to our sender type
   */
  private convertSender(sender: chrome.runtime.MessageSender): MessageSender {
    return {
      tab: sender.tab ? {
        id: sender.tab.id,
        url: sender.tab.url,
        title: sender.tab.title,
      } : undefined,
      frameId: sender.frameId,
      id: sender.id,
      url: sender.url,
      origin: sender.origin,
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Create mock runtime for testing
   */
  private createMockRuntime(): IChromeRuntimeMessages {
    const listeners: Array<(
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => boolean | void> = [];

    return {
      onMessage: {
        addListener: (callback) => {
          listeners.push(callback);
        },
        removeListener: (callback) => {
          const index = listeners.indexOf(callback);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
    };
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to message events
   */
  public onEvent(listener: MessageEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: MessageEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[MessageReceiver] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

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
      messagesReceived: 0,
      messagesHandled: 0,
      messagesUnhandled: 0,
      errors: 0,
      timeouts: 0,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a MessageReceiver instance
 */
export function createMessageReceiver(
  config: BackgroundConfig,
  chromeRuntime?: IChromeRuntimeMessages
): MessageReceiver {
  return new MessageReceiver(config, chromeRuntime);
}
