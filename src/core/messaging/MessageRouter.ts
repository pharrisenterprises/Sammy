/**
 * MessageRouter - Message routing and middleware system
 * @module core/messaging/MessageRouter
 * @version 1.0.0
 * 
 * Routes messages to appropriate handlers based on type and context.
 * Supports middleware for cross-cutting concerns like logging,
 * validation, and authentication.
 * 
 * Features:
 * - Type-based message routing
 * - Middleware pipeline (pre/post processing)
 * - Route guards for access control
 * - Handler namespacing by domain
 * - Error recovery and fallback handlers
 * 
 * @see IMessageBus for messaging interface
 * @see message-bus_breakdown.md for architecture details
 */

import {
  type IMessageBus,
  type Message,
  type MessageSender,
  type MessageContext,
  type MessageHandler,
  type Unsubscribe,
} from './IMessageBus';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default namespace for routes
 */
export const DEFAULT_NAMESPACE = 'default';

/**
 * Wildcard for matching any message type
 */
export const WILDCARD_TYPE = '*';

/**
 * Middleware execution order
 */
export const MIDDLEWARE_ORDER = {
  LOGGING: 0,
  VALIDATION: 100,
  AUTH: 200,
  RATE_LIMIT: 300,
  TRANSFORM: 400,
  HANDLER: 500,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Middleware context passed through pipeline
 */
export interface MiddlewareContext<TPayload = unknown, TResponse = unknown> {
  /** Original message */
  message: Message<TPayload>;
  /** Message sender */
  sender: MessageSender;
  /** Current payload (may be transformed) */
  payload: TPayload;
  /** Response (set by handler or middleware) */
  response?: TResponse;
  /** Whether to skip remaining middleware */
  skip: boolean;
  /** Whether to stop processing entirely */
  abort: boolean;
  /** Error if any occurred */
  error?: Error;
  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** Start time for performance tracking */
  startTime: number;
}

/**
 * Middleware function signature
 */
export type Middleware<TPayload = unknown, TResponse = unknown> = (
  ctx: MiddlewareContext<TPayload, TResponse>,
  next: () => Promise<void>
) => Promise<void> | void;

/**
 * Middleware registration
 */
export interface MiddlewareRegistration {
  /** Middleware name */
  name: string;
  /** Middleware function */
  middleware: Middleware;
  /** Execution order (lower = earlier) */
  order: number;
  /** Message types to apply to (empty = all) */
  types?: string[];
  /** Contexts to apply in (empty = all) */
  contexts?: MessageContext[];
  /** Whether middleware is enabled */
  enabled: boolean;
}

/**
 * Route definition
 */
export interface Route<TPayload = unknown, TResponse = unknown> {
  /** Message type pattern */
  type: string;
  /** Handler function */
  handler: MessageHandler<TPayload, TResponse>;
  /** Route namespace */
  namespace: string;
  /** Allowed source contexts */
  allowedContexts?: MessageContext[];
  /** Route description */
  description?: string;
  /** Route metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Route guard function
 */
export type RouteGuard = (
  message: Message,
  sender: MessageSender
) => boolean | Promise<boolean>;

/**
 * Route guard registration
 */
export interface RouteGuardRegistration {
  /** Guard name */
  name: string;
  /** Guard function */
  guard: RouteGuard;
  /** Message types to guard (empty = all) */
  types?: string[];
  /** Whether guard is enabled */
  enabled: boolean;
}

/**
 * Error handler function
 */
export type ErrorHandler = (
  error: Error,
  ctx: MiddlewareContext
) => unknown | Promise<unknown>;

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Message bus to use */
  bus: IMessageBus;
  /** Enable debug logging */
  debug?: boolean;
  /** Default error handler */
  errorHandler?: ErrorHandler;
  /** Timeout for handler execution (ms) */
  handlerTimeout?: number;
  /** Enable performance tracking */
  trackPerformance?: boolean;
}

/**
 * Router statistics
 */
export interface RouterStats {
  /** Total routes registered */
  routeCount: number;
  /** Total middleware registered */
  middlewareCount: number;
  /** Total guards registered */
  guardCount: number;
  /** Messages routed */
  messagesRouted: number;
  /** Successful routes */
  successCount: number;
  /** Failed routes */
  errorCount: number;
  /** Guard rejections */
  guardRejections: number;
  /** Average handler time (ms) */
  avgHandlerTime: number;
  /** Route counts by type */
  routesByType: Record<string, number>;
}

/**
 * Performance entry
 */
interface PerformanceEntry {
  type: string;
  duration: number;
  timestamp: number;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * MessageRouter - Routes messages to handlers with middleware support
 * 
 * Provides a structured way to handle messages with support for
 * middleware pipelines, route guards, and error handling.
 * 
 * @example
 * ```typescript
 * const router = new MessageRouter({ bus });
 * await router.initialize();
 * 
 * // Add middleware
 * router.use('logging', async (ctx, next) => {
 *   console.log('Received:', ctx.message.type);
 *   await next();
 *   console.log('Response:', ctx.response);
 * });
 * 
 * // Register routes
 * router.route('GET_STATUS', () => ({ status: 'ready' }));
 * router.route('SAVE_DATA', async (payload) => {
 *   await saveData(payload);
 *   return { saved: true };
 * });
 * ```
 */
export class MessageRouter {
  /**
   * Message bus
   */
  private bus: IMessageBus;
  
  /**
   * Router configuration
   */
  private config: Required<RouterConfig>;
  
  /**
   * Registered routes by type
   */
  private routes: Map<string, Route[]> = new Map();
  
  /**
   * Registered middleware
   */
  private middleware: MiddlewareRegistration[] = [];
  
  /**
   * Registered guards
   */
  private guards: RouteGuardRegistration[] = [];
  
  /**
   * Message handler unsubscribe functions
   */
  private unsubscribes: Unsubscribe[] = [];
  
  /**
   * Whether router is initialized
   */
  private _isReady: boolean = false;
  
  /**
   * Statistics
   */
  private stats: RouterStats;
  
  /**
   * Performance history
   */
  private performanceHistory: PerformanceEntry[] = [];
  
  /**
   * Maximum performance history size
   */
  private maxPerformanceHistory: number = 1000;
  
  /**
   * Creates a new MessageRouter
   * 
   * @param config - Router configuration
   */
  constructor(config: RouterConfig) {
    this.bus = config.bus;
    this.config = {
      bus: config.bus,
      debug: config.debug ?? false,
      errorHandler: config.errorHandler ?? this.defaultErrorHandler.bind(this),
      handlerTimeout: config.handlerTimeout ?? 30000,
      trackPerformance: config.trackPerformance ?? true,
    };
    
    this.stats = this.createEmptyStats();
  }
  
  /**
   * Whether router is initialized
   */
  get isReady(): boolean {
    return this._isReady;
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Initializes the router
   */
  async initialize(): Promise<void> {
    if (this._isReady) return;
    
    // Register wildcard handler to catch all messages
    const unsubscribe = this.bus.on(WILDCARD_TYPE, this.handleMessage.bind(this));
    this.unsubscribes.push(unsubscribe);
    
    this._isReady = true;
    this.log('Router initialized');
  }
  
  /**
   * Shuts down the router
   */
  async shutdown(): Promise<void> {
    // Unsubscribe all handlers
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes = [];
    
    // Clear routes and middleware
    this.routes.clear();
    this.middleware = [];
    this.guards = [];
    
    this._isReady = false;
    this.log('Router shutdown');
  }
  
  // ==========================================================================
  // ROUTE REGISTRATION
  // ==========================================================================
  
  /**
   * Registers a route handler
   * 
   * @param type - Message type to handle
   * @param handler - Handler function
   * @param options - Route options
   * @returns Unsubscribe function
   */
  route<TPayload = unknown, TResponse = unknown>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>,
    options?: Partial<Omit<Route, 'type' | 'handler'>>
  ): Unsubscribe {
    const route: Route<TPayload, TResponse> = {
      type,
      handler,
      namespace: options?.namespace ?? DEFAULT_NAMESPACE,
      allowedContexts: options?.allowedContexts,
      description: options?.description,
      metadata: options?.metadata,
    };
    
    if (!this.routes.has(type)) {
      this.routes.set(type, []);
      
      // Register with bus for this specific type
      const unsubscribe = this.bus.on(type, (payload, sender, message) => {
        return this.handleMessage(payload, sender, message);
      });
      this.unsubscribes.push(unsubscribe);
    }
    
    this.routes.get(type)!.push(route as Route);
    this.stats.routeCount++;
    this.stats.routesByType[type] = (this.stats.routesByType[type] ?? 0) + 1;
    
    this.log(`Route registered: ${type}`);
    
    return () => {
      this.removeRoute(type, handler as MessageHandler);
    };
  }
  
  /**
   * Registers multiple routes
   * 
   * @param routeList - Route definitions
   * @returns Unsubscribe function for all routes
   */
  registerRoutes(routeList: Array<{
    type: string;
    handler: MessageHandler;
    options?: Partial<Omit<Route, 'type' | 'handler'>>;
  }>): Unsubscribe {
    const unsubscribes = routeList.map(r => this.route(r.type, r.handler, r.options));
    
    return () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
  }
  
  /**
   * Registers routes under a namespace
   * 
   * @param namespace - Namespace prefix
   * @param routeList - Route definitions
   * @returns Unsubscribe function
   */
  namespace(
    namespace: string,
    routeList: Array<{ type: string; handler: MessageHandler }>
  ): Unsubscribe {
    return this.registerRoutes(
      routeList.map(r => ({
        ...r,
        options: { namespace },
      }))
    );
  }
  
  /**
   * Removes a route
   */
  private removeRoute(type: string, handler: MessageHandler): void {
    const routes = this.routes.get(type);
    if (!routes) return;
    
    const index = routes.findIndex(r => r.handler === handler);
    if (index >= 0) {
      routes.splice(index, 1);
      this.stats.routeCount--;
      this.stats.routesByType[type] = Math.max(0, (this.stats.routesByType[type] ?? 1) - 1);
    }
    
    if (routes.length === 0) {
      this.routes.delete(type);
    }
  }
  
  /**
   * Checks if a route exists for a type
   */
  hasRoute(type: string): boolean {
    return this.routes.has(type) && this.routes.get(type)!.length > 0;
  }
  
  /**
   * Gets all registered route types
   */
  getRouteTypes(): string[] {
    return Array.from(this.routes.keys());
  }
  
  // ==========================================================================
  // MIDDLEWARE
  // ==========================================================================
  
  /**
   * Registers middleware
   * 
   * @param name - Middleware name
   * @param middleware - Middleware function
   * @param options - Middleware options
   * @returns Unsubscribe function
   */
  use(
    name: string,
    middleware: Middleware,
    options?: {
      order?: number;
      types?: string[];
      contexts?: MessageContext[];
    }
  ): Unsubscribe {
    const registration: MiddlewareRegistration = {
      name,
      middleware,
      order: options?.order ?? MIDDLEWARE_ORDER.HANDLER,
      types: options?.types,
      contexts: options?.contexts,
      enabled: true,
    };
    
    this.middleware.push(registration);
    this.middleware.sort((a, b) => a.order - b.order);
    this.stats.middlewareCount++;
    
    this.log(`Middleware registered: ${name}`);
    
    return () => {
      const index = this.middleware.indexOf(registration);
      if (index >= 0) {
        this.middleware.splice(index, 1);
        this.stats.middlewareCount--;
      }
    };
  }
  
  /**
   * Enables or disables middleware
   */
  setMiddlewareEnabled(name: string, enabled: boolean): void {
    const mw = this.middleware.find(m => m.name === name);
    if (mw) {
      mw.enabled = enabled;
    }
  }
  
  // ==========================================================================
  // GUARDS
  // ==========================================================================
  
  /**
   * Registers a route guard
   * 
   * @param name - Guard name
   * @param guard - Guard function
   * @param options - Guard options
   * @returns Unsubscribe function
   */
  guard(
    name: string,
    guard: RouteGuard,
    options?: { types?: string[] }
  ): Unsubscribe {
    const registration: RouteGuardRegistration = {
      name,
      guard,
      types: options?.types,
      enabled: true,
    };
    
    this.guards.push(registration);
    this.stats.guardCount++;
    
    this.log(`Guard registered: ${name}`);
    
    return () => {
      const index = this.guards.indexOf(registration);
      if (index >= 0) {
        this.guards.splice(index, 1);
        this.stats.guardCount--;
      }
    };
  }
  
  /**
   * Enables or disables a guard
   */
  setGuardEnabled(name: string, enabled: boolean): void {
    const g = this.guards.find(guard => guard.name === name);
    if (g) {
      g.enabled = enabled;
    }
  }
  
  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================
  
  /**
   * Handles an incoming message
   */
  private async handleMessage(
    payload: unknown,
    sender: MessageSender,
    message: Message
  ): Promise<unknown> {
    const startTime = Date.now();
    this.stats.messagesRouted++;
    
    // Find routes for this message type
    const routes = this.routes.get(message.type);
    if (!routes || routes.length === 0) {
      return undefined;
    }
    
    // Create middleware context
    const ctx: MiddlewareContext = {
      message,
      sender,
      payload,
      skip: false,
      abort: false,
      metadata: {},
      startTime,
    };
    
    try {
      // Run guards
      const guardPassed = await this.runGuards(ctx);
      if (!guardPassed) {
        this.stats.guardRejections++;
        return { error: 'Access denied', code: 'GUARD_REJECTED' };
      }
      
      // Build middleware pipeline
      const pipeline = this.buildPipeline(ctx, routes);
      
      // Execute pipeline
      await pipeline();
      
      // Track performance
      if (this.config.trackPerformance) {
        this.recordPerformance(message.type, Date.now() - startTime);
      }
      
      if (ctx.error) {
        this.stats.errorCount++;
        return this.config.errorHandler(ctx.error, ctx);
      }
      
      this.stats.successCount++;
      return ctx.response;
    } catch (error) {
      this.stats.errorCount++;
      ctx.error = error instanceof Error ? error : new Error(String(error));
      return this.config.errorHandler(ctx.error, ctx);
    }
  }
  
  /**
   * Runs route guards
   */
  private async runGuards(ctx: MiddlewareContext): Promise<boolean> {
    for (const reg of this.guards) {
      if (!reg.enabled) continue;
      
      // Check type filter
      if (reg.types && reg.types.length > 0) {
        if (!reg.types.includes(ctx.message.type)) continue;
      }
      
      try {
        const passed = await reg.guard(ctx.message, ctx.sender);
        if (!passed) {
          this.log(`Guard rejected: ${reg.name}`);
          return false;
        }
      } catch (error) {
        this.logError(`Guard error: ${reg.name}`, error);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Builds the middleware pipeline
   */
  private buildPipeline(
    ctx: MiddlewareContext,
    routes: Route[]
  ): () => Promise<void> {
    // Filter applicable middleware
    const applicable = this.middleware.filter(m => {
      if (!m.enabled) return false;
      
      if (m.types && m.types.length > 0) {
        if (!m.types.includes(ctx.message.type)) return false;
      }
      
      if (m.contexts && m.contexts.length > 0) {
        if (!m.contexts.includes(ctx.sender.context)) return false;
      }
      
      return true;
    });
    
    // Create handler middleware
    const handlerMiddleware: Middleware = async (c) => {
      for (const route of routes) {
        // Check context restrictions
        if (route.allowedContexts && route.allowedContexts.length > 0) {
          if (!route.allowedContexts.includes(c.sender.context)) {
            continue;
          }
        }
        
        // Execute handler with timeout
        const result = await this.executeWithTimeout(
          () => route.handler(c.payload, c.sender, c.message),
          this.config.handlerTimeout
        );
        
        if (result !== undefined) {
          c.response = result;
        }
      }
    };
    
    // Build pipeline
    const allMiddleware = [
      ...applicable.map(m => m.middleware),
      handlerMiddleware,
    ];
    
    // Create composed function
    return this.compose(allMiddleware, ctx);
  }
  
  /**
   * Composes middleware into a single function
   */
  private compose(
    middleware: Middleware[],
    ctx: MiddlewareContext
  ): () => Promise<void> {
    return async () => {
      let index = -1;
      
      const dispatch = async (i: number): Promise<void> => {
        if (ctx.abort) return;
        if (ctx.skip) {
          ctx.skip = false;
          return dispatch(i + 1);
        }
        
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        
        index = i;
        
        if (i >= middleware.length) return;
        
        const mw = middleware[i];
        await mw(ctx, () => dispatch(i + 1));
      };
      
      await dispatch(0);
    };
  }
  
  /**
   * Executes a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => T | Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Handler timeout'));
      }, timeout);
      
      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Default error handler
   */
  private defaultErrorHandler(error: Error, ctx: MiddlewareContext): unknown {
    this.logError(`Handler error for ${ctx.message.type}`, error);
    
    return {
      error: error.message,
      code: 'HANDLER_ERROR',
      type: ctx.message.type,
    };
  }
  
  // ==========================================================================
  // STATISTICS & PERFORMANCE
  // ==========================================================================
  
  /**
   * Creates empty stats object
   */
  private createEmptyStats(): RouterStats {
    return {
      routeCount: 0,
      middlewareCount: 0,
      guardCount: 0,
      messagesRouted: 0,
      successCount: 0,
      errorCount: 0,
      guardRejections: 0,
      avgHandlerTime: 0,
      routesByType: {},
    };
  }
  
  /**
   * Records performance entry
   */
  private recordPerformance(type: string, duration: number): void {
    this.performanceHistory.push({
      type,
      duration,
      timestamp: Date.now(),
    });
    
    // Limit history size
    if (this.performanceHistory.length > this.maxPerformanceHistory) {
      this.performanceHistory.shift();
    }
    
    // Update average
    const total = this.performanceHistory.reduce((sum, e) => sum + e.duration, 0);
    this.stats.avgHandlerTime = total / this.performanceHistory.length;
  }
  
  /**
   * Gets router statistics
   */
  getStats(): RouterStats {
    return { ...this.stats };
  }
  
  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
    this.performanceHistory = [];
  }
  
  /**
   * Gets performance history
   */
  getPerformanceHistory(): PerformanceEntry[] {
    return [...this.performanceHistory];
  }
  
  /**
   * Gets average handler time for a specific type
   */
  getAvgHandlerTime(type?: string): number {
    const entries = type
      ? this.performanceHistory.filter(e => e.type === type)
      : this.performanceHistory;
    
    if (entries.length === 0) return 0;
    
    const total = entries.reduce((sum, e) => sum + e.duration, 0);
    return total / entries.length;
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Logs debug message
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[MessageRouter] ${message}`, ...args);
    }
  }
  
  /**
   * Logs error message
   */
  private logError(message: string, error: unknown): void {
    console.error(`[MessageRouter] ${message}`, error);
  }
}

// ============================================================================
// BUILT-IN MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Creates a logging middleware
 */
export function createLoggingMiddleware(
  options?: {
    logPayload?: boolean;
    logResponse?: boolean;
  }
): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    
    console.log(
      `[Router] → ${ctx.message.type}`,
      options?.logPayload ? ctx.payload : ''
    );
    
    await next();
    
    console.log(
      `[Router] ← ${ctx.message.type} (${Date.now() - start}ms)`,
      options?.logResponse ? ctx.response : ''
    );
  };
}

/**
 * Creates a validation middleware
 */
export function createValidationMiddleware(
  validators: Record<string, (payload: unknown) => boolean | string>
): Middleware {
  return async (ctx, next) => {
    const validator = validators[ctx.message.type];
    
    if (validator) {
      const result = validator(ctx.payload);
      
      if (result !== true) {
        ctx.abort = true;
        ctx.response = {
          error: typeof result === 'string' ? result : 'Validation failed',
          code: 'VALIDATION_ERROR',
        };
        return;
      }
    }
    
    await next();
  };
}

/**
 * Creates an authentication middleware
 */
export function createAuthMiddleware(
  authenticate: (sender: MessageSender) => boolean | Promise<boolean>
): Middleware {
  return async (ctx, next) => {
    const isAuthenticated = await authenticate(ctx.sender);
    
    if (!isAuthenticated) {
      ctx.abort = true;
      ctx.response = {
        error: 'Unauthorized',
        code: 'AUTH_ERROR',
      };
      return;
    }
    
    await next();
  };
}

/**
 * Creates a rate limiting middleware
 */
export function createRateLimitMiddleware(
  options: {
    maxRequests: number;
    windowMs: number;
  }
): Middleware {
  const requests = new Map<string, number[]>();
  
  return async (ctx, next) => {
    const key = `${ctx.sender.context}-${ctx.sender.tabId ?? 'bg'}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Get recent requests
    let recentRequests = requests.get(key) ?? [];
    recentRequests = recentRequests.filter(t => t > windowStart);
    
    if (recentRequests.length >= options.maxRequests) {
      ctx.abort = true;
      ctx.response = {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
      };
      return;
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    await next();
  };
}

/**
 * Creates a transform middleware
 */
export function createTransformMiddleware(
  transformers: {
    request?: Record<string, (payload: unknown) => unknown>;
    response?: Record<string, (response: unknown) => unknown>;
  }
): Middleware {
  return async (ctx, next) => {
    // Transform request
    const reqTransformer = transformers.request?.[ctx.message.type];
    if (reqTransformer) {
      ctx.payload = reqTransformer(ctx.payload) as typeof ctx.payload;
    }
    
    await next();
    
    // Transform response
    const resTransformer = transformers.response?.[ctx.message.type];
    if (resTransformer && ctx.response !== undefined) {
      ctx.response = resTransformer(ctx.response);
    }
  };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new MessageRouter instance
 * 
 * @param config - Router configuration
 * @returns New MessageRouter instance
 */
export function createRouter(config: RouterConfig): MessageRouter {
  return new MessageRouter(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default MessageRouter;
