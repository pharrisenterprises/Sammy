/**
 * @fileoverview Message routing system for background service worker
 * @module background/message-router
 * @version 1.0.0
 * 
 * This module provides a robust message routing system that directs
 * messages between extension components with middleware support.
 * 
 * MESSAGE FLOW:
 * - Popup → Background → Content Script
 * - Content Script → Background → Popup/Side Panel
 * - Side Panel → Background → Content Script
 * 
 * ROUTING FEATURES:
 * - Action-based routing to handlers
 * - Middleware pipeline for processing
 * - Tab-specific messaging
 * - Broadcasting to all contexts
 * - Error handling and logging
 * 
 * @see PHASE_4_SPECIFICATIONS.md for message specifications
 * @see background-service_breakdown.md for architecture details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Routable message structure
 */
export interface RoutableMessage {
  /** Action name (lowercase_snake_case) */
  action: string;
  /** Message payload */
  data?: unknown;
  /** Source context */
  source?: MessageSource;
  /** Target context(s) */
  target?: MessageTarget;
  /** Specific tab ID for tab-targeted messages */
  tabId?: number;
  /** Request ID for tracking */
  requestId?: string;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Message source types
 */
export type MessageSource = 
  | 'popup'
  | 'content_script'
  | 'side_panel'
  | 'background'
  | 'unknown';

/**
 * Message target types
 */
export type MessageTarget =
  | 'popup'
  | 'content_script'
  | 'side_panel'
  | 'background'
  | 'all'
  | 'tab';

/**
 * Route handler response
 */
export interface RouteResponse {
  /** Whether operation succeeded */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Request ID echo */
  requestId?: string;
  /** Response timestamp */
  timestamp?: number;
}

/**
 * Route handler function
 */
export type RouteHandler = (
  message: RoutableMessage,
  sender: chrome.runtime.MessageSender
) => Promise<RouteResponse> | RouteResponse;

/**
 * Middleware function
 */
export type Middleware = (
  message: RoutableMessage,
  sender: chrome.runtime.MessageSender,
  next: () => Promise<RouteResponse>
) => Promise<RouteResponse>;

/**
 * Route definition
 */
export interface RouteDefinition {
  /** Action pattern (exact match or regex) */
  action: string | RegExp;
  /** Handler function */
  handler: RouteHandler;
  /** Required source (optional filter) */
  allowedSources?: MessageSource[];
  /** Description for logging */
  description?: string;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Log all messages */
  logMessages?: boolean;
  /** Default timeout for handlers (ms) */
  handlerTimeout?: number;
  /** Enable request tracking */
  trackRequests?: boolean;
}

/**
 * Request tracking info
 */
interface TrackedRequest {
  requestId: string;
  action: string;
  source: MessageSource;
  startTime: number;
  resolved: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default router configuration
 */
export const DEFAULT_ROUTER_CONFIG: Required<RouterConfig> = {
  debug: false,
  logMessages: false,
  handlerTimeout: 30000,
  trackRequests: true
};

/**
 * Action categories for organization
 */
export const ACTION_CATEGORIES = {
  STATE: ['get_state', 'set_active_project', 'get_extension_info'],
  RECORDING: ['start_recording', 'stop_recording', 'pause_recording', 'resume_recording', 'step_captured'],
  REPLAY: ['start_replay', 'stop_replay', 'pause_replay', 'resume_replay', 'step_executed', 'replay_progress'],
  PROJECT: ['get_all_projects', 'get_project', 'create_project', 'update_project', 'delete_project'],
  STORAGE: ['export_data', 'import_data', 'clear_storage'],
  TAB: ['get_active_tab', 'inject_content_script', 'content_script_ready'],
  ERROR: ['report_error', 'clear_error']
} as const;

// ============================================================================
// MESSAGE ROUTER CLASS
// ============================================================================

/**
 * Message Router
 * 
 * Routes messages between extension components with middleware support.
 * 
 * @example
 * ```typescript
 * const router = new MessageRouter({ debug: true });
 * 
 * // Add middleware
 * router.use(loggingMiddleware);
 * router.use(validationMiddleware);
 * 
 * // Register routes
 * router.on('get_state', async () => ({ success: true, data: state }));
 * router.on('start_recording', handleStartRecording);
 * 
 * // Start listening
 * router.listen();
 * ```
 */
export class MessageRouter {
  private routes: Map<string, RouteDefinition> = new Map();
  private regexRoutes: RouteDefinition[] = [];
  private middleware: Middleware[] = [];
  private config: Required<RouterConfig>;
  private trackedRequests: Map<string, TrackedRequest> = new Map();
  private listening: boolean = false;

  constructor(config: RouterConfig = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  // ==========================================================================
  // ROUTE REGISTRATION
  // ==========================================================================

  /**
   * Register a route handler
   * 
   * @param action - Action name or pattern
   * @param handler - Handler function
   * @param options - Route options
   */
  on(
    action: string | RegExp,
    handler: RouteHandler,
    options: {
      allowedSources?: MessageSource[];
      description?: string;
    } = {}
  ): this {
    const definition: RouteDefinition = {
      action,
      handler,
      allowedSources: options.allowedSources,
      description: options.description
    };

    if (typeof action === 'string') {
      this.routes.set(action, definition);
    } else {
      this.regexRoutes.push(definition);
    }

    this.log(`Registered route: ${action}`, options.description);
    return this;
  }

  /**
   * Register multiple routes at once
   */
  register(routes: Record<string, RouteHandler>): this {
    for (const [action, handler] of Object.entries(routes)) {
      this.on(action, handler);
    }
    return this;
  }

  /**
   * Unregister a route
   */
  off(action: string): this {
    this.routes.delete(action);
    return this;
  }

  /**
   * Check if route exists
   */
  has(action: string): boolean {
    if (this.routes.has(action)) return true;
    
    for (const route of this.regexRoutes) {
      if (route.action instanceof RegExp && route.action.test(action)) {
        return true;
      }
    }
    
    return false;
  }

  // ==========================================================================
  // MIDDLEWARE
  // ==========================================================================

  /**
   * Add middleware to the pipeline
   */
  use(middleware: Middleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Remove all middleware
   */
  clearMiddleware(): this {
    this.middleware = [];
    return this;
  }

  // ==========================================================================
  // LISTENING
  // ==========================================================================

  /**
   * Start listening for messages
   */
  listen(): this {
    if (this.listening) {
      this.log('Already listening');
      return this;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => {
          console.error('[MessageRouter] Handler error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        });

      // CRITICAL: Return true to keep channel open for async response
      return true;
    });

    this.listening = true;
    this.log('Started listening for messages');
    return this;
  }

  /**
   * Check if listening
   */
  isListening(): boolean {
    return this.listening;
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  /**
   * Handle incoming message
   */
  private async handleMessage(
    message: RoutableMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<RouteResponse> {
    const startTime = performance.now();
    const requestId = message.requestId || generateRequestId();

    // Enhance message with metadata
    const enhancedMessage: RoutableMessage = {
      ...message,
      requestId,
      timestamp: message.timestamp || Date.now(),
      source: message.source || this.inferSource(sender)
    };

    // Track request
    if (this.config.trackRequests) {
      this.trackRequest(enhancedMessage);
    }

    // Log incoming message
    if (this.config.logMessages) {
      this.logMessage('IN', enhancedMessage, sender);
    }

    try {
      // Find matching route
      const route = this.findRoute(enhancedMessage.action);

      if (!route) {
        return this.createErrorResponse(
          `Unknown action: ${enhancedMessage.action}`,
          requestId
        );
      }

      // Check source permissions
      if (route.allowedSources && enhancedMessage.source) {
        if (!route.allowedSources.includes(enhancedMessage.source)) {
          return this.createErrorResponse(
            `Action ${enhancedMessage.action} not allowed from ${enhancedMessage.source}`,
            requestId
          );
        }
      }

      // Execute middleware pipeline and handler
      const response = await this.executeWithMiddleware(
        enhancedMessage,
        sender,
        route.handler
      );

      // Add metadata to response
      const finalResponse: RouteResponse = {
        ...response,
        requestId,
        timestamp: Date.now()
      };

      // Log response
      if (this.config.logMessages) {
        const duration = performance.now() - startTime;
        this.log(`Response for ${enhancedMessage.action}: ${response.success ? 'OK' : 'ERROR'} (${duration.toFixed(1)}ms)`);
      }

      // Mark request as resolved
      if (this.config.trackRequests) {
        this.resolveRequest(requestId);
      }

      return finalResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MessageRouter] Error handling ${enhancedMessage.action}:`, error);
      
      if (this.config.trackRequests) {
        this.resolveRequest(requestId);
      }

      return this.createErrorResponse(errorMessage, requestId);
    }
  }

  /**
   * Execute handler with middleware pipeline
   */
  private async executeWithMiddleware(
    message: RoutableMessage,
    sender: chrome.runtime.MessageSender,
    handler: RouteHandler
  ): Promise<RouteResponse> {
    // Build middleware chain
    let index = 0;

    const next = async (): Promise<RouteResponse> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        return middleware(message, sender, next);
      } else {
        // Execute actual handler
        return handler(message, sender);
      }
    };

    // Start chain with timeout
    return this.withTimeout(next(), this.config.handlerTimeout);
  }

  /**
   * Find matching route for action
   */
  private findRoute(action: string): RouteDefinition | null {
    // Check exact match first
    const exactRoute = this.routes.get(action);
    if (exactRoute) return exactRoute;

    // Check regex routes
    for (const route of this.regexRoutes) {
      if (route.action instanceof RegExp && route.action.test(action)) {
        return route;
      }
    }

    return null;
  }

  /**
   * Infer message source from sender
   */
  private inferSource(sender: chrome.runtime.MessageSender): MessageSource {
    if (sender.tab) {
      return 'content_script';
    }
    
    // Check if from popup or side panel based on URL
    if (sender.url) {
      if (sender.url.includes('popup')) return 'popup';
      if (sender.url.includes('sidepanel') || sender.url.includes('side-panel')) return 'side_panel';
    }

    return 'unknown';
  }

  // ==========================================================================
  // OUTBOUND MESSAGING
  // ==========================================================================

  /**
   * Send message to specific tab
   */
  async sendToTab(tabId: number, message: RoutableMessage): Promise<RouteResponse> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        ...message,
        source: 'background',
        timestamp: Date.now()
      });
      return response as RouteResponse;
    } catch (error) {
      return this.createErrorResponse(
        `Failed to send to tab ${tabId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send message to all tabs with content script
   */
  async sendToAllTabs(message: RoutableMessage): Promise<Map<number, RouteResponse>> {
    const results = new Map<number, RouteResponse>();
    
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.id) {
          try {
            const response = await this.sendToTab(tab.id, message);
            results.set(tab.id, response);
          } catch {
            results.set(tab.id, { success: false, error: 'Tab not reachable' });
          }
        }
      }
    } catch (error) {
      console.error('[MessageRouter] Failed to query tabs:', error);
    }

    return results;
  }

  /**
   * Broadcast message to popup and side panel
   */
  broadcast(message: RoutableMessage): void {
    chrome.runtime.sendMessage({
      ...message,
      source: 'background',
      timestamp: Date.now()
    }).catch(() => {
      // Ignore errors when no receivers
    });
  }

  /**
   * Send message and await response (with timeout)
   */
  async send(message: RoutableMessage, timeoutMs?: number): Promise<RouteResponse> {
    const timeout = timeoutMs || this.config.handlerTimeout;
    
    try {
      const response = await this.withTimeout(
        chrome.runtime.sendMessage({
          ...message,
          source: 'background',
          timestamp: Date.now()
        }),
        timeout
      );
      return response as RouteResponse;
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ==========================================================================
  // REQUEST TRACKING
  // ==========================================================================

  /**
   * Track a request
   */
  private trackRequest(message: RoutableMessage): void {
    if (!message.requestId) return;

    this.trackedRequests.set(message.requestId, {
      requestId: message.requestId,
      action: message.action,
      source: message.source || 'unknown',
      startTime: Date.now(),
      resolved: false
    });

    // Clean up old requests periodically
    if (this.trackedRequests.size > 1000) {
      this.cleanupOldRequests();
    }
  }

  /**
   * Mark request as resolved
   */
  private resolveRequest(requestId: string): void {
    const request = this.trackedRequests.get(requestId);
    if (request) {
      request.resolved = true;
    }
  }

  /**
   * Clean up old tracked requests
   */
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - 60000; // 1 minute
    
    for (const [id, request] of this.trackedRequests) {
      if (request.startTime < cutoff) {
        this.trackedRequests.delete(id);
      }
    }
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): TrackedRequest[] {
    return Array.from(this.trackedRequests.values()).filter(r => !r.resolved);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Handler timeout')), timeoutMs);
      })
    ]);
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: string, requestId?: string): RouteResponse {
    return {
      success: false,
      error,
      requestId,
      timestamp: Date.now()
    };
  }

  /**
   * Log message (if debug enabled)
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[MessageRouter]', ...args);
    }
  }

  /**
   * Log message details
   */
  private logMessage(
    direction: 'IN' | 'OUT',
    message: RoutableMessage,
    sender?: chrome.runtime.MessageSender
  ): void {
    const source = sender?.tab ? `Tab ${sender.tab.id}` : message.source;
    console.log(`[MessageRouter] ${direction} ${message.action} from ${source}`, message.data);
  }

  // ==========================================================================
  // ROUTE INFO
  // ==========================================================================

  /**
   * Get all registered routes
   */
  getRoutes(): string[] {
    const routes = Array.from(this.routes.keys());
    const regexPatterns = this.regexRoutes.map(r => String(r.action));
    return [...routes, ...regexPatterns];
  }

  /**
   * Get route count
   */
  getRouteCount(): number {
    return this.routes.size + this.regexRoutes.length;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<RouterConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RouterConfig>): this {
    Object.assign(this.config, config);
    return this;
  }
}

// ============================================================================
// MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Create logging middleware
 */
export function createLoggingMiddleware(
  options: { logData?: boolean } = {}
): Middleware {
  return async (message, sender, next) => {
    const startTime = performance.now();
    const source = sender.tab ? `Tab ${sender.tab.id}` : message.source;
    
    console.log(`[Router] → ${message.action} from ${source}`);
    
    if (options.logData && message.data) {
      console.log('[Router] Data:', message.data);
    }

    const response = await next();
    
    const duration = performance.now() - startTime;
    console.log(`[Router] ← ${message.action}: ${response.success ? 'OK' : 'FAIL'} (${duration.toFixed(1)}ms)`);

    return response;
  };
}

/**
 * Create validation middleware
 */
export function createValidationMiddleware(
  _requiredActions: string[]
): Middleware {
  return async (message, _sender, next) => {
    if (!message.action) {
      return { success: false, error: 'Missing action' };
    }

    // Could add more validation here
    
    return next();
  };
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(
  options: { maxRequests: number; windowMs: number }
): Middleware {
  const requests: Map<string, number[]> = new Map();
  
  return async (message, _sender, next) => {
    const key = `${message.source || 'unknown'}-${message.action}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Get request timestamps for this key
    let timestamps = requests.get(key) || [];
    
    // Filter to window
    timestamps = timestamps.filter(t => t > windowStart);
    
    if (timestamps.length >= options.maxRequests) {
      return {
        success: false,
        error: 'Rate limit exceeded'
      };
    }
    
    timestamps.push(now);
    requests.set(key, timestamps);
    
    return next();
  };
}

/**
 * Create error handling middleware
 */
export function createErrorHandlingMiddleware(): Middleware {
  return async (message, _sender, next) => {
    try {
      return await next();
    } catch (error) {
      console.error(`[Router] Error in ${message.action}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Create a message
 */
export function createMessage(
  action: string,
  data?: unknown,
  options: {
    source?: MessageSource;
    target?: MessageTarget;
    tabId?: number;
  } = {}
): RoutableMessage {
  return {
    action,
    data,
    source: options.source,
    target: options.target,
    tabId: options.tabId,
    requestId: generateRequestId(),
    timestamp: Date.now()
  };
}

/**
 * Check if action belongs to category
 */
export function isActionInCategory(
  action: string,
  category: keyof typeof ACTION_CATEGORIES
): boolean {
  return (ACTION_CATEGORIES[category] as readonly string[]).includes(action);
}

/**
 * Get category for action
 */
export function getActionCategory(action: string): keyof typeof ACTION_CATEGORIES | null {
  for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
    if ((actions as readonly string[]).includes(action)) {
      return category as keyof typeof ACTION_CATEGORIES;
    }
  }
  return null;
}
