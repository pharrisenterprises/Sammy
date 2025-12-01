/**
 * Messaging System - Central export barrel
 * @module core/messaging
 * @version 1.0.0
 * 
 * Provides a unified entry point for the messaging layer.
 * 
 * Main Components:
 * - IMessageBus: Interface for message bus implementations
 * - ChromeMessageBus: Chrome extension messaging implementation
 * - MessageRouter: Message routing with middleware support
 * 
 * @example
 * ```typescript
 * import {
 *   getMessageBus,
 *   createRouter,
 *   createLoggingMiddleware,
 * } from '@/core/messaging';
 * 
 * // Get the message bus
 * const bus = getMessageBus();
 * await bus.initialize();
 * 
 * // Create a router with middleware
 * const router = createRouter({ bus });
 * router.use('logging', createLoggingMiddleware());
 * router.route('GET_STATUS', () => ({ status: 'ready' }));
 * ```
 */

// ============================================================================
// INTERFACES & TYPES (from IMessageBus)
// ============================================================================

export type {
  // Message types
  MessageContext,
  MessagePriority,
  Message,
  MessageResponse,
  MessageEnvelope,
  MessageSender,
  
  // Handler types
  MessageHandler,
  HandlerRegistration,
  Subscription,
  Unsubscribe,
  
  // Port types
  PortConnection,
  PortMessageHandler,
  PortDisconnectHandler,
  
  // Options types
  RequestOptions,
  BroadcastOptions,
  
  // Configuration types
  MessageBusConfig,
  MessageBusStats,
  
  // Factory types
  MessageBusFactory,
} from './IMessageBus';

// ============================================================================
// BASE MESSAGE BUS
// ============================================================================

export {
  // Interface and base class
  type IMessageBus,
  BaseMessageBus,
  
  // Type guards
  isMessage,
  isMessageResponse,
  isMessageContext,
  
  // Utilities
  createTypedHandler,
} from './IMessageBus';

// ============================================================================
// CHROME MESSAGE BUS
// ============================================================================

export {
  // Main class
  ChromeMessageBus,
  
  // Factory functions
  getMessageBus,
  createMessageBus,
  resetMessageBus,
  
  // Detection utilities
  isChromeRuntimeAvailable,
  isChromeTabsAvailable,
  detectContext,
  
  // Constants
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_DELAY,
  MAX_RETRIES,
  PORT_PREFIX,
} from './ChromeMessageBus';

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

export {
  // Main class
  MessageRouter,
  
  // Factory function
  createRouter,
  
  // Middleware factories
  createLoggingMiddleware,
  createValidationMiddleware,
  createAuthMiddleware,
  createRateLimitMiddleware,
  createTransformMiddleware,
  
  // Constants
  DEFAULT_NAMESPACE,
  WILDCARD_TYPE,
  MIDDLEWARE_ORDER,
  
  // Types
  type MiddlewareContext,
  type Middleware,
  type MiddlewareRegistration,
  type Route,
  type RouteGuard,
  type RouteGuardRegistration,
  type ErrorHandler,
  type RouterConfig,
  type RouterStats,
} from './MessageRouter';

// ============================================================================
// CONVENIENCE TYPES
// ============================================================================

/**
 * Common message type definitions for the extension
 */
export const MESSAGE_TYPES = {
  // Recording
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  PAUSE_RECORDING: 'PAUSE_RECORDING',
  RESUME_RECORDING: 'RESUME_RECORDING',
  RECORDING_STATUS: 'RECORDING_STATUS',
  STEP_RECORDED: 'STEP_RECORDED',
  
  // Replay
  START_REPLAY: 'START_REPLAY',
  STOP_REPLAY: 'STOP_REPLAY',
  PAUSE_REPLAY: 'PAUSE_REPLAY',
  RESUME_REPLAY: 'RESUME_REPLAY',
  REPLAY_STATUS: 'REPLAY_STATUS',
  STEP_COMPLETED: 'STEP_COMPLETED',
  STEP_FAILED: 'STEP_FAILED',
  
  // Test management
  GET_TEST_CASES: 'GET_TEST_CASES',
  SAVE_TEST_CASE: 'SAVE_TEST_CASE',
  DELETE_TEST_CASE: 'DELETE_TEST_CASE',
  EXPORT_TEST_CASE: 'EXPORT_TEST_CASE',
  IMPORT_TEST_CASE: 'IMPORT_TEST_CASE',
  
  // Configuration
  GET_CONFIG: 'GET_CONFIG',
  SET_CONFIG: 'SET_CONFIG',
  RESET_CONFIG: 'RESET_CONFIG',
  
  // Status
  GET_STATUS: 'GET_STATUS',
  PING: 'PING',
  PONG: 'PONG',
  
  // Errors
  ERROR: 'ERROR',
  WARNING: 'WARNING',
} as const;

/**
 * Message type union
 */
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

// ============================================================================
// CHANNEL NAMES
// ============================================================================

/**
 * Pub/sub channel names
 */
export const CHANNELS = {
  /** Recording events */
  RECORDING: 'recording',
  /** Replay events */
  REPLAY: 'replay',
  /** Status updates */
  STATUS: 'status',
  /** Configuration changes */
  CONFIG: 'config',
  /** Error notifications */
  ERRORS: 'errors',
  /** Step events */
  STEPS: 'steps',
} as const;

/**
 * Channel name type
 */
export type ChannelName = typeof CHANNELS[keyof typeof CHANNELS];

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

// Import for internal use in factories
import {
  createMessageBus as _createMessageBus,
} from './ChromeMessageBus';

import {
  createRouter as _createRouter,
  createLoggingMiddleware as _createLoggingMiddleware,
  createValidationMiddleware as _createValidationMiddleware,
  createRateLimitMiddleware as _createRateLimitMiddleware,
  MIDDLEWARE_ORDER as _MIDDLEWARE_ORDER,
} from './MessageRouter';

/**
 * Creates and initializes a complete messaging system
 * 
 * @param config - Optional configuration
 * @returns Initialized bus and router
 */
export async function createMessagingSystem(config?: {
  debug?: boolean;
  enableLogging?: boolean;
  enableValidation?: boolean;
  validators?: Record<string, (payload: unknown) => boolean | string>;
}): Promise<{
  bus: import('./ChromeMessageBus').ChromeMessageBus;
  router: import('./MessageRouter').MessageRouter;
}> {
  const bus = _createMessageBus({
    debug: config?.debug,
  });
  
  await bus.initialize();
  
  const router = _createRouter({
    bus,
    debug: config?.debug,
  });
  
  await router.initialize();
  
  // Add default middleware
  if (config?.enableLogging) {
    router.use('logging', _createLoggingMiddleware(), {
      order: _MIDDLEWARE_ORDER.LOGGING,
    });
  }
  
  if (config?.enableValidation && config?.validators) {
    router.use('validation', _createValidationMiddleware(config.validators), {
      order: _MIDDLEWARE_ORDER.VALIDATION,
    });
  }
  
  return { bus, router };
}

/**
 * Creates a typed message factory for a specific message type
 * 
 * @param type - Message type
 * @returns Factory function for creating messages
 */
export function createMessageFactory<TPayload>(
  type: string
): (payload: TPayload) => {
  type: string;
  payload: TPayload;
  timestamp: number;
} {
  return (payload: TPayload) => ({
    type,
    payload,
    timestamp: Date.now(),
  });
}

/**
 * Creates a request helper for a specific message type
 * 
 * @param bus - Message bus instance
 * @param type - Message type
 * @returns Async function to send typed requests
 */
export function createRequestHelper<TPayload, TResponse>(
  bus: import('./IMessageBus').IMessageBus,
  type: string
): (payload: TPayload, options?: import('./IMessageBus').RequestOptions) => Promise<TResponse> {
  return (payload: TPayload, options?: import('./IMessageBus').RequestOptions) => {
    return bus.request<TPayload, TResponse>(type, payload, options);
  };
}

// ============================================================================
// PRESET MIDDLEWARE CONFIGURATIONS
// ============================================================================

/**
 * Creates a standard middleware stack for the extension
 * 
 * @param router - Router instance
 * @param options - Configuration options
 */
export function applyStandardMiddleware(
  router: import('./MessageRouter').MessageRouter,
  options?: {
    enableLogging?: boolean;
    enableRateLimit?: boolean;
    rateLimitPerMinute?: number;
    customValidators?: Record<string, (payload: unknown) => boolean | string>;
  }
): void {
  // Logging
  if (options?.enableLogging !== false) {
    router.use('logging', _createLoggingMiddleware({ logPayload: false }), {
      order: _MIDDLEWARE_ORDER.LOGGING,
    });
  }
  
  // Rate limiting
  if (options?.enableRateLimit) {
    router.use('rateLimit', _createRateLimitMiddleware({
      maxRequests: options.rateLimitPerMinute ?? 60,
      windowMs: 60000,
    }), {
      order: _MIDDLEWARE_ORDER.RATE_LIMIT,
    });
  }
  
  // Validation
  if (options?.customValidators) {
    router.use('validation', _createValidationMiddleware(options.customValidators), {
      order: _MIDDLEWARE_ORDER.VALIDATION,
    });
  }
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Helper type for extracting payload type from a message handler
 */
export type ExtractPayload<T> = T extends import('./IMessageBus').MessageHandler<infer P, unknown> ? P : never;

/**
 * Helper type for extracting response type from a message handler
 */
export type ExtractResponse<T> = T extends import('./IMessageBus').MessageHandler<unknown, infer R> ? R : never;

/**
 * Type-safe route definition helper
 */
export type TypedRoute<TPayload, TResponse> = {
  type: string;
  handler: import('./IMessageBus').MessageHandler<TPayload, TResponse>;
  options?: {
    namespace?: string;
    allowedContexts?: import('./IMessageBus').MessageContext[];
    description?: string;
  };
};
