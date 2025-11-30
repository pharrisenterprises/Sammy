/**
 * @fileoverview Message handler types and utilities for Chrome extension messaging
 * @module core/messages/message-handler
 * @version 1.0.0
 * 
 * This module provides the infrastructure for handling Chrome extension messages
 * with proper async support and type safety.
 * 
 * CRITICAL PATTERNS:
 * 1. Async handlers MUST return true to keep the message channel open
 * 2. Use isRunningRef (useRef) for synchronous state checks, NOT useState
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 2 for message specifications
 * @see message-bus_breakdown.md for messaging architecture
 */

import type {
  MessageAction,
  AnyMessage,
  BaseResponse
} from './message-types';

import {
  isMessage,
  createSuccessResponse,
  createErrorResponse
} from './message-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome message sender information
 */
export interface MessageSender {
  /** Tab that sent the message (if from content script) */
  tab?: chrome.tabs.Tab;
  /** Frame ID within the tab */
  frameId?: number;
  /** Extension ID (if from another extension) */
  id?: string;
  /** URL of the sender */
  url?: string;
  /** Origin of the sender */
  origin?: string;
}

/**
 * Send response callback type
 */
export type SendResponse<T = unknown> = (response: BaseResponse<T>) => void;

/**
 * Async message handler function signature
 * 
 * @template P - Payload type
 * @template R - Response data type
 * 
 * CRITICAL: If handler is async, the listener MUST return true
 */
export type AsyncMessageHandler<P = unknown, R = unknown> = (
  payload: P,
  sender: MessageSender,
  sendResponse: SendResponse<R>
) => Promise<void> | void;

/**
 * Sync message handler function signature (immediate response)
 */
export type SyncMessageHandler<P = unknown, R = unknown> = (
  payload: P,
  sender: MessageSender
) => R;

/**
 * Handler registry entry
 */
export interface HandlerRegistryEntry<P = unknown, R = unknown> {
  /** Handler function */
  handler: AsyncMessageHandler<P, R>;
  /** Whether handler is async (requires return true) */
  isAsync: boolean;
  /** Optional description for debugging */
  description?: string;
}

/**
 * Handler registry type (action -> handler)
 */
export type HandlerRegistry = Map<MessageAction, HandlerRegistryEntry>;

/**
 * Message listener return type
 * 
 * CRITICAL: Return true for async handlers to keep channel open
 * Return undefined/void for sync handlers
 */
export type MessageListenerReturn = true | undefined | void;

/**
 * Chrome runtime message listener signature
 */
export type ChromeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => MessageListenerReturn;

// ============================================================================
// HANDLER REGISTRY CLASS
// ============================================================================

/**
 * Message handler registry for managing action handlers
 * 
 * @example
 * ```typescript
 * const registry = new MessageHandlerRegistry();
 * 
 * registry.register('get_all_projects', async (payload, sender, sendResponse) => {
 *   const projects = await db.getAllProjects();
 *   sendResponse(createSuccessResponse(projects));
 * }, { isAsync: true });
 * 
 * // In background script:
 * chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 *   return registry.handleMessage(message, sender, sendResponse);
 * });
 * ```
 */
export class MessageHandlerRegistry {
  private handlers: HandlerRegistry = new Map();
  private errorHandler: ((error: Error, action: MessageAction) => void) | null = null;

  /**
   * Register a handler for a specific action
   * 
   * @param action - Message action to handle
   * @param handler - Handler function
   * @param options - Handler options
   */
  register<P = unknown, R = unknown>(
    action: MessageAction,
    handler: AsyncMessageHandler<P, R>,
    options: { isAsync?: boolean; description?: string } = {}
  ): this {
    this.handlers.set(action, {
      handler: handler as AsyncMessageHandler,
      isAsync: options.isAsync ?? true, // Default to async for safety
      description: options.description
    });
    return this;
  }

  /**
   * Unregister a handler for an action
   * 
   * @param action - Message action to unregister
   */
  unregister(action: MessageAction): boolean {
    return this.handlers.delete(action);
  }

  /**
   * Check if a handler is registered for an action
   * 
   * @param action - Message action to check
   */
  hasHandler(action: MessageAction): boolean {
    return this.handlers.has(action);
  }

  /**
   * Get all registered actions
   */
  getRegisteredActions(): MessageAction[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Set global error handler
   * 
   * @param handler - Error handler function
   */
  setErrorHandler(handler: (error: Error, action: MessageAction) => void): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Handle an incoming message
   * 
   * CRITICAL: Returns true for async handlers to keep message channel open
   * 
   * @param message - Incoming message
   * @param sender - Message sender
   * @param sendResponse - Response callback
   * @returns true if async handler, undefined otherwise
   */
  handleMessage(
    message: unknown,
    sender: MessageSender,
    sendResponse: SendResponse
  ): MessageListenerReturn {
    // Validate message structure
    if (!isMessage(message)) {
      sendResponse(createErrorResponse('Invalid message format'));
      return undefined;
    }

    const { action, payload, requestId } = message;

    // Get handler
    const entry = this.handlers.get(action);
    if (!entry) {
      sendResponse(createErrorResponse(`No handler registered for action: ${action}`, requestId));
      return undefined;
    }

    const { handler, isAsync } = entry;

    // Execute handler
    try {
      const result = handler(payload, sender, (response) => {
        // Attach requestId to response
        sendResponse({ ...response, requestId });
      });

      // If handler returns a promise, it's async
      if (result instanceof Promise) {
        result.catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendResponse(createErrorResponse(errorMessage, requestId));
          this.errorHandler?.(error instanceof Error ? error : new Error(errorMessage), action);
        });
        return true; // CRITICAL: Keep channel open for async response
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse(createErrorResponse(errorMessage, requestId));
      this.errorHandler?.(error instanceof Error ? error : new Error(errorMessage), action);
    }

    // Return true for async handlers even if they don't return a promise
    // This is safer - sync handlers will just respond faster
    return isAsync ? true : undefined;
  }

  /**
   * Create a Chrome message listener function
   * 
   * @returns Function suitable for chrome.runtime.onMessage.addListener
   */
  createListener(): ChromeMessageListener {
    return (message, sender, sendResponse) => {
      return this.handleMessage(message, sender as MessageSender, sendResponse as SendResponse);
    };
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get handler count
   */
  get size(): number {
    return this.handlers.size;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global message handler registry instance
 * 
 * Use this for the main background script message handling
 */
export const messageRegistry = new MessageHandlerRegistry();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wrap an async function as a message handler
 * 
 * Automatically handles errors and sends appropriate responses
 * 
 * @param fn - Async function to wrap
 * @returns Message handler function
 * 
 * @example
 * ```typescript
 * registry.register('get_all_projects', wrapAsyncHandler(async (payload) => {
 *   return await db.getAllProjects();
 * }));
 * ```
 */
export function wrapAsyncHandler<P, R>(
  fn: (payload: P, sender: MessageSender) => Promise<R>
): AsyncMessageHandler<P, R> {
  return async (payload, sender, sendResponse) => {
    try {
      const result = await fn(payload, sender);
      sendResponse(createSuccessResponse(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse(createErrorResponse(errorMessage));
    }
  };
}

/**
 * Wrap a sync function as a message handler
 * 
 * @param fn - Sync function to wrap
 * @returns Message handler function
 */
export function wrapSyncHandler<P, R>(
  fn: (payload: P, sender: MessageSender) => R
): AsyncMessageHandler<P, R> {
  return (payload, sender, sendResponse) => {
    try {
      const result = fn(payload, sender);
      sendResponse(createSuccessResponse(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse(createErrorResponse(errorMessage));
    }
  };
}

/**
 * Create a handler that validates payload before processing
 * 
 * @param validator - Validation function returning true if valid
 * @param handler - Handler to call if validation passes
 * @returns Wrapped handler with validation
 */
export function withValidation<P, R>(
  validator: (payload: P) => boolean | string,
  handler: AsyncMessageHandler<P, R>
): AsyncMessageHandler<P, R> {
  return (payload, sender, sendResponse) => {
    const validationResult = validator(payload);
    
    if (validationResult === false) {
      sendResponse(createErrorResponse('Payload validation failed'));
      return;
    }
    
    if (typeof validationResult === 'string') {
      sendResponse(createErrorResponse(validationResult));
      return;
    }
    
    return handler(payload, sender, sendResponse);
  };
}

/**
 * Create a handler that requires a specific sender context
 * 
 * @param requirement - 'tab' | 'extension' | 'any'
 * @param handler - Handler to call if requirement met
 * @returns Wrapped handler with sender check
 */
export function withSenderRequirement<P, R>(
  requirement: 'tab' | 'extension' | 'any',
  handler: AsyncMessageHandler<P, R>
): AsyncMessageHandler<P, R> {
  return (payload, sender, sendResponse) => {
    if (requirement === 'tab' && !sender.tab) {
      sendResponse(createErrorResponse('This action requires a tab context'));
      return;
    }
    
    if (requirement === 'extension' && !sender.id) {
      sendResponse(createErrorResponse('This action requires an extension context'));
      return;
    }
    
    return handler(payload, sender, sendResponse);
  };
}

// ============================================================================
// MESSAGE SENDING UTILITIES
// ============================================================================

/**
 * Send a message to the background script and await response
 * 
 * @param message - Message to send
 * @returns Promise resolving to response
 * 
 * @example
 * ```typescript
 * const response = await sendMessageToBackground({
 *   action: 'get_all_projects',
 *   payload: undefined
 * });
 * 
 * if (response.success) {
 *   console.log('Projects:', response.data);
 * }
 * ```
 */
export function sendMessageToBackground<R = unknown>(
  message: AnyMessage
): Promise<BaseResponse<R>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: BaseResponse<R>) => {
      if (chrome.runtime.lastError) {
        resolve(createErrorResponse(chrome.runtime.lastError.message || 'Unknown error'));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send a message to a specific tab's content script
 * 
 * @param tabId - Tab ID to send to
 * @param message - Message to send
 * @returns Promise resolving to response
 */
export function sendMessageToTab<R = unknown>(
  tabId: number,
  message: AnyMessage
): Promise<BaseResponse<R>> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response: BaseResponse<R>) => {
      if (chrome.runtime.lastError) {
        resolve(createErrorResponse(chrome.runtime.lastError.message || 'Unknown error'));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send a message to the active tab's content script
 * 
 * @param message - Message to send
 * @returns Promise resolving to response
 */
export async function sendMessageToActiveTab<R = unknown>(
  message: AnyMessage
): Promise<BaseResponse<R>> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      return createErrorResponse('No active tab found');
    }
    
    return sendMessageToTab<R>(tab.id, message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResponse(errorMessage);
  }
}

/**
 * Broadcast a message to all tabs
 * 
 * @param message - Message to broadcast
 * @returns Promise resolving to array of responses
 */
export async function broadcastToAllTabs<R = unknown>(
  message: AnyMessage
): Promise<Array<{ tabId: number; response: BaseResponse<R> }>> {
  const tabs = await chrome.tabs.query({});
  const results: Array<{ tabId: number; response: BaseResponse<R> }> = [];
  
  for (const tab of tabs) {
    if (tab.id) {
      const response = await sendMessageToTab<R>(tab.id, message);
      results.push({ tabId: tab.id, response });
    }
  }
  
  return results;
}

// ============================================================================
// RUNNING STATE PATTERN
// ============================================================================

/**
 * Create a running state controller using the isRunningRef pattern
 * 
 * CRITICAL: This uses a mutable ref object for synchronous state access,
 * NOT useState which has async updates.
 * 
 * @example
 * ```typescript
 * const runningState = createRunningState();
 * 
 * // Check state synchronously
 * if (runningState.isRunning()) {
 *   return; // Already running
 * }
 * 
 * runningState.start();
 * try {
 *   await doWork();
 * } finally {
 *   runningState.stop();
 * }
 * ```
 */
export interface RunningStateController {
  /** Check if currently running (synchronous) */
  isRunning: () => boolean;
  /** Start running (synchronous) */
  start: () => void;
  /** Stop running (synchronous) */
  stop: () => void;
  /** Get the ref object for React useRef compatibility */
  getRef: () => { current: boolean };
}

/**
 * Create a running state controller
 * 
 * CRITICAL: Use this pattern instead of useState for synchronous state checks
 * in async operations like recording/replay.
 */
export function createRunningState(): RunningStateController {
  const ref = { current: false };
  
  return {
    isRunning: () => ref.current,
    start: () => { ref.current = true; },
    stop: () => { ref.current = false; },
    getRef: () => ref
  };
}

/**
 * React hook-compatible running state (for use in components)
 * 
 * Returns a ref object compatible with useRef pattern
 * 
 * @example
 * ```typescript
 * // In React component:
 * const isRunningRef = useRef(false);
 * // OR use this function outside React:
 * const isRunningRef = createRunningRef();
 * 
 * // Check synchronously:
 * if (isRunningRef.current) return;
 * 
 * isRunningRef.current = true;
 * ```
 */
export function createRunningRef(): { current: boolean } {
  return { current: false };
}

// ============================================================================
// TIMEOUT AND RETRY UTILITIES
// ============================================================================

/**
 * Send a message with timeout
 * 
 * @param message - Message to send
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise resolving to response or timeout error
 */
export function sendMessageWithTimeout<R = unknown>(
  message: AnyMessage,
  timeoutMs: number = 5000
): Promise<BaseResponse<R>> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(createErrorResponse(`Message timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    sendMessageToBackground<R>(message).then((response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

/**
 * Send a message with retry logic
 * 
 * @param message - Message to send
 * @param options - Retry options
 * @returns Promise resolving to response
 */
export async function sendMessageWithRetry<R = unknown>(
  message: AnyMessage,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<BaseResponse<R>> {
  const { maxRetries = 3, retryDelayMs = 500, timeoutMs = 5000 } = options;
  
  let lastError: string = 'Unknown error';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await sendMessageWithTimeout<R>(message, timeoutMs);
    
    if (response.success) {
      return response;
    }
    
    lastError = response.error || 'Unknown error';
    
    // Don't retry on certain errors
    if (lastError.includes('No handler registered') || 
        lastError.includes('Invalid message format')) {
      return response;
    }
    
    // Wait before retry (except for last attempt)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  return createErrorResponse(`Failed after ${maxRetries + 1} attempts: ${lastError}`);
}
