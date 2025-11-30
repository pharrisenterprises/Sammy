/**
 * @fileoverview Tests for Message handler utilities
 * @module core/messages/message-handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MessageHandlerRegistry,
  messageRegistry,
  wrapAsyncHandler,
  wrapSyncHandler,
  withValidation,
  withSenderRequirement,
  createRunningState,
  createRunningRef,
  type MessageSender
} from './message-handler';
import { createSuccessResponse } from './message-types';

describe('Message Handler', () => {
  // ==========================================================================
  // MESSAGE HANDLER REGISTRY
  // ==========================================================================

  describe('MessageHandlerRegistry', () => {
    let registry: MessageHandlerRegistry;

    beforeEach(() => {
      registry = new MessageHandlerRegistry();
    });

    describe('register', () => {
      it('should register a handler', () => {
        const handler = vi.fn();
        registry.register('get_all_projects', handler);

        expect(registry.hasHandler('get_all_projects')).toBe(true);
      });

      it('should return this for chaining', () => {
        const result = registry.register('get_all_projects', vi.fn());
        expect(result).toBe(registry);
      });

      it('should allow registering multiple handlers', () => {
        registry
          .register('get_all_projects', vi.fn())
          .register('add_project', vi.fn())
          .register('delete_project', vi.fn());

        expect(registry.size).toBe(3);
      });
    });

    describe('unregister', () => {
      it('should unregister a handler', () => {
        registry.register('get_all_projects', vi.fn());
        expect(registry.hasHandler('get_all_projects')).toBe(true);

        const result = registry.unregister('get_all_projects');
        expect(result).toBe(true);
        expect(registry.hasHandler('get_all_projects')).toBe(false);
      });

      it('should return false for non-existent handler', () => {
        const result = registry.unregister('get_all_projects');
        expect(result).toBe(false);
      });
    });

    describe('getRegisteredActions', () => {
      it('should return all registered actions', () => {
        registry
          .register('get_all_projects', vi.fn())
          .register('add_project', vi.fn());

        const actions = registry.getRegisteredActions();

        expect(actions).toContain('get_all_projects');
        expect(actions).toContain('add_project');
        expect(actions).toHaveLength(2);
      });
    });

    describe('handleMessage', () => {
      it('should call handler with payload and sender', () => {
        const handler = vi.fn();
        registry.register('get_all_projects', handler);

        const message = { action: 'get_all_projects', payload: { test: true } };
        const sender: MessageSender = { tab: { id: 1 } as chrome.tabs.Tab };
        const sendResponse = vi.fn();

        registry.handleMessage(message, sender, sendResponse);

        expect(handler).toHaveBeenCalledWith(
          { test: true },
          sender,
          expect.any(Function)
        );
      });

      it('should return true for async handlers', () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        registry.register('get_all_projects', handler, { isAsync: true });

        const result = registry.handleMessage(
          { action: 'get_all_projects', payload: undefined },
          {},
          vi.fn()
        );

        expect(result).toBe(true);
      });

      it('should return undefined for sync handlers', () => {
        const handler = vi.fn();
        registry.register('get_all_projects', handler, { isAsync: false });

        const result = registry.handleMessage(
          { action: 'get_all_projects', payload: undefined },
          {},
          vi.fn()
        );

        expect(result).toBe(undefined);
      });

      it('should send error for invalid message format', () => {
        const sendResponse = vi.fn();
        
        registry.handleMessage('not a message', {}, sendResponse);

        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'Invalid message format'
          })
        );
      });

      it('should send error for unregistered action', () => {
        const sendResponse = vi.fn();
        
        registry.handleMessage(
          { action: 'get_all_projects', payload: undefined },
          {},
          sendResponse
        );

        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('No handler registered')
          })
        );
      });

      it('should attach requestId to response', () => {
        registry.register('get_all_projects', (_payload, _sender, sendResponse) => {
          sendResponse(createSuccessResponse([]));
        }, { isAsync: false });

        const sendResponse = vi.fn();
        
        registry.handleMessage(
          { action: 'get_all_projects', payload: undefined, requestId: 'req-123' },
          {},
          sendResponse
        );

        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({ requestId: 'req-123' })
        );
      });

      it('should call error handler on exception', () => {
        const errorHandler = vi.fn();
        registry.setErrorHandler(errorHandler);

        registry.register('get_all_projects', () => {
          throw new Error('Test error');
        }, { isAsync: false });

        const sendResponse = vi.fn();
        registry.handleMessage(
          { action: 'get_all_projects', payload: undefined },
          {},
          sendResponse
        );

        expect(errorHandler).toHaveBeenCalledWith(
          expect.any(Error),
          'get_all_projects'
        );
      });

      it('should handle async handler errors', async () => {
        const errorHandler = vi.fn();
        registry.setErrorHandler(errorHandler);

        registry.register('get_all_projects', async () => {
          throw new Error('Async error');
        });

        const sendResponse = vi.fn();
        registry.handleMessage(
          { action: 'get_all_projects', payload: undefined },
          {},
          sendResponse
        );

        // Wait for async error handling
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'Async error'
          })
        );
      });
    });

    describe('createListener', () => {
      it('should create a function suitable for Chrome listener', () => {
        registry.register('get_all_projects', vi.fn());

        const listener = registry.createListener();

        expect(typeof listener).toBe('function');
        expect(listener.length).toBe(3); // message, sender, sendResponse
      });
    });

    describe('clear', () => {
      it('should remove all handlers', () => {
        registry
          .register('get_all_projects', vi.fn())
          .register('add_project', vi.fn());

        expect(registry.size).toBe(2);

        registry.clear();

        expect(registry.size).toBe(0);
      });
    });
  });

  // ==========================================================================
  // WRAPPER FUNCTIONS
  // ==========================================================================

  describe('wrapAsyncHandler', () => {
    it('should wrap async function and send success response', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'test' });
      const handler = wrapAsyncHandler(fn);

      const sendResponse = vi.fn();
      await handler({ input: 1 }, {}, sendResponse);

      expect(fn).toHaveBeenCalledWith({ input: 1 }, {});
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { data: 'test' }
        })
      );
    });

    it('should handle errors and send error response', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));
      const handler = wrapAsyncHandler(fn);

      const sendResponse = vi.fn();
      await handler({}, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Test error'
        })
      );
    });
  });

  describe('wrapSyncHandler', () => {
    it('should wrap sync function and send success response', () => {
      const fn = vi.fn().mockReturnValue({ result: 42 });
      const handler = wrapSyncHandler(fn);

      const sendResponse = vi.fn();
      handler({ input: 1 }, {}, sendResponse);

      expect(fn).toHaveBeenCalledWith({ input: 1 }, {});
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { result: 42 }
        })
      );
    });

    it('should handle errors and send error response', () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      const handler = wrapSyncHandler(fn);

      const sendResponse = vi.fn();
      handler({}, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Sync error'
        })
      );
    });
  });

  // ==========================================================================
  // VALIDATION WRAPPER
  // ==========================================================================

  describe('withValidation', () => {
    it('should call handler when validation passes (returns true)', () => {
      const validator = vi.fn().mockReturnValue(true);
      const innerHandler = vi.fn();
      const handler = withValidation(validator, innerHandler);

      const sendResponse = vi.fn();
      handler({ data: 'test' }, {}, sendResponse);

      expect(validator).toHaveBeenCalledWith({ data: 'test' });
      expect(innerHandler).toHaveBeenCalled();
    });

    it('should send error when validation fails (returns false)', () => {
      const validator = vi.fn().mockReturnValue(false);
      const innerHandler = vi.fn();
      const handler = withValidation(validator, innerHandler);

      const sendResponse = vi.fn();
      handler({ data: 'test' }, {}, sendResponse);

      expect(innerHandler).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Payload validation failed'
        })
      );
    });

    it('should send custom error when validation returns string', () => {
      const validator = vi.fn().mockReturnValue('Custom validation error');
      const innerHandler = vi.fn();
      const handler = withValidation(validator, innerHandler);

      const sendResponse = vi.fn();
      handler({ data: 'test' }, {}, sendResponse);

      expect(innerHandler).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Custom validation error'
        })
      );
    });
  });

  // ==========================================================================
  // SENDER REQUIREMENT WRAPPER
  // ==========================================================================

  describe('withSenderRequirement', () => {
    it('should call handler when tab requirement is met', () => {
      const innerHandler = vi.fn();
      const handler = withSenderRequirement('tab', innerHandler);

      const sender: MessageSender = { tab: { id: 1 } as chrome.tabs.Tab };
      handler({}, sender, vi.fn());

      expect(innerHandler).toHaveBeenCalled();
    });

    it('should send error when tab requirement is not met', () => {
      const innerHandler = vi.fn();
      const handler = withSenderRequirement('tab', innerHandler);

      const sendResponse = vi.fn();
      handler({}, {}, sendResponse);

      expect(innerHandler).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('tab context')
        })
      );
    });

    it('should allow any sender for "any" requirement', () => {
      const innerHandler = vi.fn();
      const handler = withSenderRequirement('any', innerHandler);

      handler({}, {}, vi.fn());

      expect(innerHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // RUNNING STATE PATTERN
  // ==========================================================================

  describe('createRunningState', () => {
    it('should start with isRunning = false', () => {
      const state = createRunningState();
      expect(state.isRunning()).toBe(false);
    });

    it('should set isRunning to true on start()', () => {
      const state = createRunningState();
      state.start();
      expect(state.isRunning()).toBe(true);
    });

    it('should set isRunning to false on stop()', () => {
      const state = createRunningState();
      state.start();
      state.stop();
      expect(state.isRunning()).toBe(false);
    });

    it('should provide ref object for React compatibility', () => {
      const state = createRunningState();
      const ref = state.getRef();

      expect(ref.current).toBe(false);

      state.start();
      expect(ref.current).toBe(true);

      state.stop();
      expect(ref.current).toBe(false);
    });

    it('should allow synchronous state checks (CRITICAL)', () => {
      const state = createRunningState();

      // Simulate multiple rapid checks
      expect(state.isRunning()).toBe(false);
      state.start();
      expect(state.isRunning()).toBe(true);
      expect(state.isRunning()).toBe(true);
      state.stop();
      expect(state.isRunning()).toBe(false);
    });
  });

  describe('createRunningRef', () => {
    it('should create ref object with current = false', () => {
      const ref = createRunningRef();
      expect(ref.current).toBe(false);
    });

    it('should allow direct mutation', () => {
      const ref = createRunningRef();

      ref.current = true;
      expect(ref.current).toBe(true);

      ref.current = false;
      expect(ref.current).toBe(false);
    });

    it('should be usable like React useRef', () => {
      // This pattern matches how it would be used in React:
      // const isRunningRef = useRef(false);
      const isRunningRef = createRunningRef();

      // Check synchronously before starting
      if (isRunningRef.current) {
        throw new Error('Should not be running');
      }

      isRunningRef.current = true;

      // Synchronous check during operation
      expect(isRunningRef.current).toBe(true);

      isRunningRef.current = false;
    });
  });

  // ==========================================================================
  // GLOBAL REGISTRY
  // ==========================================================================

  describe('messageRegistry', () => {
    afterEach(() => {
      messageRegistry.clear();
    });

    it('should be a singleton instance', () => {
      expect(messageRegistry).toBeInstanceOf(MessageHandlerRegistry);
    });

    it('should persist handlers across accesses', () => {
      messageRegistry.register('get_all_projects', vi.fn());
      expect(messageRegistry.hasHandler('get_all_projects')).toBe(true);
    });
  });
});
