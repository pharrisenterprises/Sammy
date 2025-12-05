/**
 * MessageRouter - Message Routing System
 * @module background/MessageRouter
 * @version 1.0.0
 * 
 * Routes incoming messages to appropriate handlers.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message payload
 */
export interface Message {
  action: string;
  payload?: unknown;
}

/**
 * Message response
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  id?: number;
  tabId?: number;
}

/**
 * Message handler function
 */
export type MessageHandler = (
  payload: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
) => boolean | void | Promise<boolean | void>;

/**
 * Handler registration
 */
export interface HandlerRegistration {
  action: string;
  handler: MessageHandler;
  description?: string;
}

// ============================================================================
// MESSAGE ROUTER CLASS
// ============================================================================

/**
 * Routes messages to registered handlers
 */
export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Register a message handler
   */
  register(action: string, handler: MessageHandler): void {
    if (this.handlers.has(action)) {
      console.warn(`Handler for action "${action}" already registered, overwriting`);
    }
    this.handlers.set(action, handler);
    this.log(`Registered handler for: ${action}`);
  }

  /**
   * Register multiple handlers
   */
  registerAll(registrations: HandlerRegistration[]): void {
    registrations.forEach(({ action, handler }) => {
      this.register(action, handler);
    });
  }

  /**
   * Unregister a handler
   */
  unregister(action: string): boolean {
    return this.handlers.delete(action);
  }

  /**
   * Handle incoming message
   */
  handleMessage(
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean {
    if (!message || typeof message.action !== 'string') {
      this.log('Invalid message received:', message);
      sendResponse({ success: false, error: 'Invalid message format' });
      return false;
    }

    const { action, payload } = message;
    this.log(`Received message: ${action}`, payload);

    const handler = this.handlers.get(action);
    if (!handler) {
      this.log(`No handler for action: ${action}`);
      sendResponse({ success: false, error: `Unknown action: ${action}` });
      return false;
    }

    try {
      const result = handler(payload, sender, sendResponse);
      
      // If handler returns a promise, we need to return true
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error(`Handler error for ${action}:`, error);
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
      
      // If handler returns true, it will call sendResponse asynchronously
      return result === true;
    } catch (error) {
      console.error(`Handler error for ${action}:`, error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get registered actions
   */
  getRegisteredActions(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if action is registered
   */
  hasHandler(action: string): boolean {
    return this.handlers.has(action);
  }

  /**
   * Log message (if debug enabled)
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[MessageRouter] ${message}`, ...args);
    }
  }
}

export default MessageRouter;
