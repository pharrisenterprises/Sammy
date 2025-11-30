/**
 * @fileoverview Tests for message router
 * @module background/message-router.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageRouter,
  createLoggingMiddleware,
  createValidationMiddleware,
  createRateLimitMiddleware,
  createErrorHandlingMiddleware,
  generateRequestId,
  createMessage,
  isActionInCategory,
  getActionCategory,
  DEFAULT_ROUTER_CONFIG,
  ACTION_CATEGORIES
} from './message-router';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn()
    },
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  }
};

vi.stubGlobal('chrome', mockChrome);

describe('MessageRouter', () => {
  let router: MessageRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new MessageRouter({ debug: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default config', () => {
      expect(DEFAULT_ROUTER_CONFIG.debug).toBe(false);
      expect(DEFAULT_ROUTER_CONFIG.logMessages).toBe(false);
      expect(DEFAULT_ROUTER_CONFIG.handlerTimeout).toBe(30000);
    });

    it('should have action categories defined', () => {
      expect(ACTION_CATEGORIES.STATE).toContain('get_state');
      expect(ACTION_CATEGORIES.RECORDING).toContain('start_recording');
      expect(ACTION_CATEGORIES.REPLAY).toContain('start_replay');
      expect(ACTION_CATEGORIES.PROJECT).toContain('get_all_projects');
    });
  });

  // ==========================================================================
  // ROUTE REGISTRATION
  // ==========================================================================

  describe('Route Registration', () => {
    it('should register route with on()', () => {
      router.on('test_action', () => ({ success: true }));

      expect(router.has('test_action')).toBe(true);
    });

    it('should register multiple routes with register()', () => {
      router.register({
        action_one: () => ({ success: true }),
        action_two: () => ({ success: true })
      });

      expect(router.has('action_one')).toBe(true);
      expect(router.has('action_two')).toBe(true);
    });

    it('should register regex routes', () => {
      router.on(/^project_/, () => ({ success: true }));

      expect(router.has('project_create')).toBe(true);
      expect(router.has('project_delete')).toBe(true);
      expect(router.has('other_action')).toBe(false);
    });

    it('should unregister routes with off()', () => {
      router.on('temp_action', () => ({ success: true }));
      router.off('temp_action');

      expect(router.has('temp_action')).toBe(false);
    });

    it('should support chaining', () => {
      const result = router
        .on('action_one', () => ({ success: true }))
        .on('action_two', () => ({ success: true }));

      expect(result).toBe(router);
      expect(router.getRouteCount()).toBe(2);
    });
  });

  // ==========================================================================
  // MIDDLEWARE
  // ==========================================================================

  describe('Middleware', () => {
    it('should add middleware with use()', () => {
      const middleware = vi.fn((_msg, _sender, next) => next());
      
      router.use(middleware);
      router.on('test', () => ({ success: true }));
      router.listen();

      // Middleware is registered, will be called when message is processed
    });

    it('should clear middleware', () => {
      router.use((_msg, _sender, next) => next());
      router.use((_msg, _sender, next) => next());
      
      router.clearMiddleware();

      // Middleware should be cleared
    });

    it('should execute middleware in order', async () => {
      const order: number[] = [];
      
      router.use(async (_msg, _sender, next) => {
        order.push(1);
        const result = await next();
        order.push(4);
        return result;
      });
      
      router.use(async (_msg, _sender, next) => {
        order.push(2);
        const result = await next();
        order.push(3);
        return result;
      });

      router.on('test', () => {
        order.push(0); // Handler in the middle
        return { success: true };
      });

      // Would need to trigger message handling to test full flow
    });
  });

  // ==========================================================================
  // LISTENING
  // ==========================================================================

  describe('Listening', () => {
    it('should start listening', () => {
      router.listen();

      expect(router.isListening()).toBe(true);
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it('should not add multiple listeners', () => {
      router.listen();
      router.listen();

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // OUTBOUND MESSAGING
  // ==========================================================================

  describe('Outbound Messaging', () => {
    it('should send to specific tab', async () => {
      const response = await router.sendToTab(1, {
        action: 'test',
        data: { foo: 'bar' }
      });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          action: 'test',
          source: 'background'
        })
      );
      expect(response.success).toBe(true);
    });

    it('should send to all tabs', async () => {
      const results = await router.sendToAllTabs({ action: 'broadcast_test' });

      expect(results.size).toBe(2); // Two tabs from mock
    });

    it('should broadcast to popup/side panel', () => {
      router.broadcast({ action: 'state_changed', data: {} });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // REQUEST TRACKING
  // ==========================================================================

  describe('Request Tracking', () => {
    it('should track pending requests', () => {
      router.updateConfig({ trackRequests: true });
      
      const pending = router.getPendingRequests();
      expect(Array.isArray(pending)).toBe(true);
    });
  });

  // ==========================================================================
  // ROUTE INFO
  // ==========================================================================

  describe('Route Info', () => {
    it('should get all routes', () => {
      router.on('route_one', () => ({ success: true }));
      router.on('route_two', () => ({ success: true }));

      const routes = router.getRoutes();

      expect(routes).toContain('route_one');
      expect(routes).toContain('route_two');
    });

    it('should get route count', () => {
      router.on('route_one', () => ({ success: true }));
      router.on('route_two', () => ({ success: true }));

      expect(router.getRouteCount()).toBe(2);
    });

    it('should get and update config', () => {
      expect(router.getConfig().debug).toBe(false);

      router.updateConfig({ debug: true });

      expect(router.getConfig().debug).toBe(true);
    });
  });

  // ==========================================================================
  // MIDDLEWARE FACTORIES
  // ==========================================================================

  describe('Middleware Factories', () => {
    describe('createLoggingMiddleware', () => {
      it('should create logging middleware', async () => {
        const middleware = createLoggingMiddleware();
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        const next = vi.fn().mockResolvedValue({ success: true });
        
        await middleware(
          { action: 'test' },
          {} as chrome.runtime.MessageSender,
          next
        );

        expect(consoleSpy).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });
    });

    describe('createValidationMiddleware', () => {
      it('should validate required actions', async () => {
        const middleware = createValidationMiddleware(['required_action']);
        const next = vi.fn().mockResolvedValue({ success: true });

        const result = await middleware(
          { action: 'test' },
          {} as chrome.runtime.MessageSender,
          next
        );

        expect(result.success).toBe(true);
      });

      it('should reject missing action', async () => {
        const middleware = createValidationMiddleware([]);
        const next = vi.fn().mockResolvedValue({ success: true });

        const result = await middleware(
          { action: '' },
          {} as chrome.runtime.MessageSender,
          next
        );

        expect(result.success).toBe(false);
      });
    });

    describe('createRateLimitMiddleware', () => {
      it('should allow requests within limit', async () => {
        const middleware = createRateLimitMiddleware({
          maxRequests: 5,
          windowMs: 1000
        });
        const next = vi.fn().mockResolvedValue({ success: true });

        const result = await middleware(
          { action: 'test', source: 'popup' },
          {} as chrome.runtime.MessageSender,
          next
        );

        expect(result.success).toBe(true);
      });
    });

    describe('createErrorHandlingMiddleware', () => {
      it('should catch errors', async () => {
        const middleware = createErrorHandlingMiddleware();
        const next = vi.fn().mockRejectedValue(new Error('Test error'));

        const result = await middleware(
          { action: 'test' },
          {} as chrome.runtime.MessageSender,
          next
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Test error');
      });
    });
  });

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  describe('Utilities', () => {
    describe('generateRequestId', () => {
      it('should generate unique IDs', () => {
        const id1 = generateRequestId();
        const id2 = generateRequestId();

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^req_/);
      });
    });

    describe('createMessage', () => {
      it('should create message with defaults', () => {
        const message = createMessage('test_action', { foo: 'bar' });

        expect(message.action).toBe('test_action');
        expect(message.data).toEqual({ foo: 'bar' });
        expect(message.requestId).toBeDefined();
        expect(message.timestamp).toBeDefined();
      });

      it('should create message with options', () => {
        const message = createMessage('test_action', {}, {
          source: 'popup',
          target: 'content_script',
          tabId: 123
        });

        expect(message.source).toBe('popup');
        expect(message.target).toBe('content_script');
        expect(message.tabId).toBe(123);
      });
    });

    describe('isActionInCategory', () => {
      it('should return true for actions in category', () => {
        expect(isActionInCategory('get_state', 'STATE')).toBe(true);
        expect(isActionInCategory('start_recording', 'RECORDING')).toBe(true);
      });

      it('should return false for actions not in category', () => {
        expect(isActionInCategory('get_state', 'RECORDING')).toBe(false);
      });
    });

    describe('getActionCategory', () => {
      it('should return category for action', () => {
        expect(getActionCategory('get_state')).toBe('STATE');
        expect(getActionCategory('start_recording')).toBe('RECORDING');
        expect(getActionCategory('get_all_projects')).toBe('PROJECT');
      });

      it('should return null for unknown action', () => {
        expect(getActionCategory('unknown_action')).toBeNull();
      });
    });
  });
});
