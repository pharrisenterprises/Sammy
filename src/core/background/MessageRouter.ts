/**
 * MessageRouter - Action-Based Message Routing
 * @module core/background/MessageRouter
 * @version 1.0.0
 * 
 * Implements IMessageRouter for routing chrome.runtime messages to
 * registered handlers based on action field. Replaces if/else chain
 * with action map pattern for better maintainability.
 * 
 * ## Handler Registration
 * ```typescript
 * router.register('add_project', async (message, sender) => {
 *   const id = await db.addProject(message.payload);
 *   return { success: true, id };
 * });
 * ```
 * 
 * ## Message Routing
 * ```typescript
 * // In chrome.runtime.onMessage listener
 * chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 *   router.route(message, sender)
 *     .then(sendResponse)
 *     .catch(err => sendResponse({ success: false, error: err.message }));
 *   return true; // Keep channel open
 * });
 * ```
 * 
 * @example
 * ```typescript
 * const router = new MessageRouter();
 * 
 * // Register handlers
 * router.register('get_all_projects', async () => {
 *   const projects = await db.getAllProjects();
 *   return { success: true, projects };
 * });
 * 
 * // Route message
 * const response = await router.route({ action: 'get_all_projects' }, sender);
 * ```
 */

import {
  type IMessageRouter,
  type BackgroundMessage,
  type BackgroundResponse,
  type MessageSender,
  type MessageHandler,
  createErrorResponse,
} from './IBackgroundService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Middleware function type
 */
export type MessageMiddleware = (
  message: BackgroundMessage,
  sender: MessageSender,
  next: () => Promise<BackgroundResponse>
) => Promise<BackgroundResponse>;

/**
 * Router configuration
 */
export interface MessageRouterConfig {
  /** Whether to log all messages (default: false) */
  debug?: boolean;
  
  /** Default timeout for handlers in ms (default: 30000) */
  handlerTimeout?: number;
  
  /** Whether to throw on unknown actions (default: false) */
  strictMode?: boolean;
  
  /** Custom logger function */
  logger?: (level: string, message: string, data?: unknown) => void;
}

/**
 * Default router configuration
 */
export const DEFAULT_ROUTER_CONFIG: Required<MessageRouterConfig> = {
  debug: false,
  handlerTimeout: 30000,
  strictMode: false,
  logger: (level, message, data) => {
    if (level === 'error') {
      console.error(`[MessageRouter] ${message}`, data);
    } else if (level === 'warn') {
      console.warn(`[MessageRouter] ${message}`, data);
    } else {
      console.log(`[MessageRouter] ${message}`, data);
    }
  },
};

/**
 * Handler entry with metadata
 */
interface HandlerEntry {
  handler: MessageHandler;
  registeredAt: number;
  callCount: number;
  lastCalledAt: number | null;
  totalDuration: number;
}

// ============================================================================
// MESSAGE ROUTER CLASS
// ============================================================================

/**
 * Routes messages to registered handlers based on action field
 */
export class MessageRouter implements IMessageRouter {
  private handlers: Map<string, HandlerEntry> = new Map();
  private middleware: MessageMiddleware[] = [];
  private config: Required<MessageRouterConfig>;
  
  constructor(config?: MessageRouterConfig) {
    this.config = {
      ...DEFAULT_ROUTER_CONFIG,
      ...config,
    };
  }
  
  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================
  
  /**
   * Register a handler for an action
   */
  register<TMessage extends BackgroundMessage, TResponse extends BackgroundResponse>(
    action: string,
    handler: MessageHandler<TMessage, TResponse>
  ): void {
    if (!action) {
      throw new Error('Action name is required');
    }
    
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    if (this.handlers.has(action)) {
      this.log('warn', `Overwriting existing handler for action: ${action}`);
    }
    
    this.handlers.set(action, {
      handler: handler as unknown as MessageHandler,
      registeredAt: Date.now(),
      callCount: 0,
      lastCalledAt: null,
      totalDuration: 0,
    });
    
    this.log('debug', `Registered handler for action: ${action}`);
  }
  
  /**
   * Unregister a handler
   */
  unregister(action: string): void {
    if (this.handlers.delete(action)) {
      this.log('debug', `Unregistered handler for action: ${action}`);
    }
  }
  
  /**
   * Check if handler exists for action
   */
  hasHandler(action: string): boolean {
    return this.handlers.has(action);
  }
  
  /**
   * Get all registered actions
   */
  getRegisteredActions(): string[] {
    return Array.from(this.handlers.keys());
  }
  
  // ==========================================================================
  // MIDDLEWARE
  // ==========================================================================
  
  /**
   * Add middleware to the chain
   */
  use(middleware: MessageMiddleware): void {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    
    this.middleware.push(middleware);
    this.log('debug', `Added middleware (${this.middleware.length} total)`);
  }
  
  /**
   * Remove all middleware
   */
  clearMiddleware(): void {
    this.middleware = [];
  }
  
  // ==========================================================================
  // MESSAGE ROUTING
  // ==========================================================================
  
  /**
   * Route a message to its handler
   */
  async route(
    message: BackgroundMessage,
    sender: MessageSender
  ): Promise<BackgroundResponse> {
    const startTime = Date.now();
    
    // Validate message
    if (!message || typeof message !== 'object') {
      return createErrorResponse('Invalid message format');
    }
    
    const { action } = message;
    
    if (!action) {
      return createErrorResponse('Message action is required');
    }
    
    this.log('debug', `Routing message: ${action}`, { sender: sender.tab?.id });
    
    // Get handler
    const entry = this.handlers.get(action);
    
    if (!entry) {
      if (this.config.strictMode) {
        return createErrorResponse(`Unknown action: ${action}`);
      }
      
      this.log('warn', `No handler for action: ${action}`);
      return createErrorResponse(`No handler registered for action: ${action}`);
    }
    
    // Execute with middleware chain
    try {
      const response = await this.executeWithMiddleware(
        message,
        sender,
        entry
      );
      
      // Update metrics
      const duration = Date.now() - startTime;
      entry.callCount++;
      entry.lastCalledAt = Date.now();
      entry.totalDuration += duration;
      
      this.log('debug', `Handled ${action} in ${duration}ms`);
      
      return response;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('error', `Handler error for ${action}: ${err.message}`, error);
      return createErrorResponse(err.message);
    }
  }
  
  /**
   * Execute handler with middleware chain
   */
  private async executeWithMiddleware(
    message: BackgroundMessage,
    sender: MessageSender,
    entry: HandlerEntry
  ): Promise<BackgroundResponse> {
    // Build execution chain
    const executeHandler = async (): Promise<BackgroundResponse> => {
      // Apply timeout
      const timeoutPromise = new Promise<BackgroundResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Handler timeout after ${this.config.handlerTimeout}ms`));
        }, this.config.handlerTimeout);
      });
      
      const handlerPromise = Promise.resolve(entry.handler(message, sender));
      
      return Promise.race([handlerPromise, timeoutPromise]);
    };
    
    // No middleware - execute directly
    if (this.middleware.length === 0) {
      return executeHandler();
    }
    
    // Build middleware chain (reverse order)
    let chain = executeHandler;
    
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const currentMiddleware = this.middleware[i];
      const nextChain = chain;
      
      chain = () => currentMiddleware(message, sender, nextChain);
    }
    
    return chain();
  }
  
  // ==========================================================================
  // CHROME API INTEGRATION
  // ==========================================================================
  
  /**
   * Create handler for chrome.runtime.onMessage
   * 
   * @example
   * ```typescript
   * chrome.runtime.onMessage.addListener(router.createChromeHandler());
   * ```
   */
  createChromeHandler(): (
    message: BackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void
  ) => boolean {
    return (message, sender, sendResponse) => {
      // Convert Chrome sender to our MessageSender
      const messageSender: MessageSender = {
        tab: sender.tab ? {
          id: sender.tab.id,
          url: sender.tab.url,
          title: sender.tab.title,
        } : undefined,
        frameId: sender.frameId,
        id: sender.id,
        url: sender.url,
      };
      
      // Route message
      this.route(message, messageSender)
        .then(sendResponse)
        .catch((error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          sendResponse(createErrorResponse(err.message));
        });
      
      // Return true to keep channel open for async response
      return true;
    };
  }
  
  // ==========================================================================
  // METRICS & DEBUGGING
  // ==========================================================================
  
  /**
   * Get handler statistics
   */
  getStats(): Record<string, {
    callCount: number;
    avgDuration: number;
    lastCalledAt: number | null;
  }> {
    const stats: Record<string, {
      callCount: number;
      avgDuration: number;
      lastCalledAt: number | null;
    }> = {};
    
    for (const [action, entry] of this.handlers) {
      stats[action] = {
        callCount: entry.callCount,
        avgDuration: entry.callCount > 0 
          ? Math.round(entry.totalDuration / entry.callCount)
          : 0,
        lastCalledAt: entry.lastCalledAt,
      };
    }
    
    return stats;
  }
  
  /**
   * Reset all statistics
   */
  resetStats(): void {
    for (const entry of this.handlers.values()) {
      entry.callCount = 0;
      entry.lastCalledAt = null;
      entry.totalDuration = 0;
    }
  }
  
  /**
   * Get handler count
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<MessageRouterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<MessageRouterConfig> {
    return { ...this.config };
  }
  
  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================
  
  /**
   * Log message based on config
   */
  private log(level: string, message: string, data?: unknown): void {
    if (level === 'debug' && !this.config.debug) {
      return;
    }
    
    this.config.logger(level, message, data);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a MessageRouter
 */
export function createMessageRouter(config?: MessageRouterConfig): MessageRouter {
  return new MessageRouter(config);
}

/**
 * Create a debug-enabled router
 */
export function createDebugRouter(): MessageRouter {
  return new MessageRouter({
    debug: true,
    strictMode: true,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultRouter: MessageRouter | null = null;

/**
 * Get default router instance
 */
export function getMessageRouter(): MessageRouter {
  if (!defaultRouter) {
    defaultRouter = new MessageRouter();
  }
  return defaultRouter;
}

/**
 * Reset default router
 */
export function resetMessageRouter(): void {
  defaultRouter = null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a batch registration helper
 */
export function registerHandlers(
  router: MessageRouter,
  handlers: Record<string, MessageHandler>
): void {
  for (const [action, handler] of Object.entries(handlers)) {
    router.register(action, handler);
  }
}

/**
 * Create logging middleware
 */
export function createLoggingMiddleware(
  logger: (message: string) => void = console.log
): MessageMiddleware {
  return async (message, _sender, next) => {
    const start = Date.now();
    logger(`[${message.action}] Started`);
    
    try {
      const response = await next();
      const duration = Date.now() - start;
      logger(`[${message.action}] Completed in ${duration}ms (success: ${response.success})`);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      logger(`[${message.action}] Failed after ${duration}ms: ${error}`);
      throw error;
    }
  };
}

/**
 * Create error recovery middleware
 */
export function createErrorRecoveryMiddleware(
  onError?: (error: Error, message: BackgroundMessage) => void
): MessageMiddleware {
  return async (message, _sender, next) => {
    try {
      return await next();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err, message);
      return createErrorResponse(err.message);
    }
  };
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(
  maxRequests: number,
  windowMs: number
): MessageMiddleware {
  const requests: Map<string, number[]> = new Map();
  
  return async (message, sender, next) => {
    const key = `${sender.tab?.id || 'unknown'}-${message.action}`;
    const now = Date.now();
    
    // Get existing timestamps
    let timestamps = requests.get(key) || [];
    
    // Filter to window
    timestamps = timestamps.filter(t => now - t < windowMs);
    
    // Check limit
    if (timestamps.length >= maxRequests) {
      return createErrorResponse('Rate limit exceeded');
    }
    
    // Add current request
    timestamps.push(now);
    requests.set(key, timestamps);
    
    return next();
  };
}
