/**
 * Tests for MessageRouter
 * @module core/background/MessageRouter.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MessageRouter,
  createMessageRouter,
  createDebugRouter,
  getMessageRouter,
  resetMessageRouter,
  registerHandlers,
  createLoggingMiddleware,
  createErrorRecoveryMiddleware,
  createRateLimitMiddleware,
  DEFAULT_ROUTER_CONFIG,
} from './MessageRouter';
import {
  type BackgroundMessage,
  type MessageSender,
  createSuccessResponse,
} from './IBackgroundService';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestMessage(action: string, payload?: unknown): BackgroundMessage {
  return { action, payload };
}

function createTestSender(tabId?: number): MessageSender {
  return {
    tab: tabId ? { id: tabId, url: 'https://example.com' } : undefined,
    frameId: 0,
    id: 'test-extension-id',
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MessageRouter', () => {
  let router: MessageRouter;
  
  beforeEach(() => {
    router = createMessageRouter({ debug: false });
  });
  
  afterEach(() => {
    resetMessageRouter();
  });
  
  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================
  
  describe('handler registration', () => {
    it('should register handler', () => {
      router.register('test_action', async () => createSuccessResponse());
      
      expect(router.hasHandler('test_action')).toBe(true);
    });
    
    it('should throw for empty action', () => {
      expect(() => {
        router.register('', async () => createSuccessResponse());
      }).toThrow('Action name is required');
    });
    
    it('should throw for non-function handler', () => {
      expect(() => {
        router.register('test', 'not a function' as any);
      }).toThrow('Handler must be a function');
    });
    
    it('should overwrite existing handler', async () => {
      let callCount = 0;
      
      router.register('test', async () => {
        callCount = 1;
        return createSuccessResponse();
      });
      
      router.register('test', async () => {
        callCount = 2;
        return createSuccessResponse();
      });
      
      await router.route(createTestMessage('test'), createTestSender());
      
      expect(callCount).toBe(2);
    });
    
    it('should unregister handler', () => {
      router.register('test', async () => createSuccessResponse());
      router.unregister('test');
      
      expect(router.hasHandler('test')).toBe(false);
    });
    
    it('should return registered actions', () => {
      router.register('action1', async () => createSuccessResponse());
      router.register('action2', async () => createSuccessResponse());
      router.register('action3', async () => createSuccessResponse());
      
      const actions = router.getRegisteredActions();
      
      expect(actions).toContain('action1');
      expect(actions).toContain('action2');
      expect(actions).toContain('action3');
      expect(actions).toHaveLength(3);
    });
  });
  
  // ==========================================================================
  // ROUTING TESTS
  // ==========================================================================
  
  describe('message routing', () => {
    it('should route message to handler', async () => {
      router.register('test', async (message) => {
        return createSuccessResponse({ received: message.payload });
      });
      
      const response = await router.route(
        createTestMessage('test', 'hello'),
        createTestSender()
      );
      
      expect(response.success).toBe(true);
      expect((response as any).received).toBe('hello');
    });
    
    it('should return error for missing action', async () => {
      const response = await router.route(
        {} as BackgroundMessage,
        createTestSender()
      );
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('action is required');
    });
    
    it('should return error for unregistered action', async () => {
      const response = await router.route(
        createTestMessage('unknown'),
        createTestSender()
      );
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('No handler');
    });
    
    it('should handle sync handlers', async () => {
      router.register('sync', () => createSuccessResponse({ sync: true }));
      
      const response = await router.route(
        createTestMessage('sync'),
        createTestSender()
      );
      
      expect(response.success).toBe(true);
      expect((response as any).sync).toBe(true);
    });
    
    it('should catch handler errors', async () => {
      router.register('error', async () => {
        throw new Error('Handler failed');
      });
      
      const response = await router.route(
        createTestMessage('error'),
        createTestSender()
      );
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Handler failed');
    });
    
    it('should pass sender to handler', async () => {
      let receivedSender: MessageSender | undefined;
      
      router.register('test', async (_message, sender) => {
        receivedSender = sender;
        return createSuccessResponse();
      });
      
      await router.route(
        createTestMessage('test'),
        createTestSender(123)
      );
      
      expect(receivedSender?.tab?.id).toBe(123);
    });
  });
  
  // ==========================================================================
  // MIDDLEWARE TESTS
  // ==========================================================================
  
  describe('middleware', () => {
    it('should execute middleware', async () => {
      const calls: string[] = [];
      
      router.use(async (_message, _sender, next) => {
        calls.push('before');
        const response = await next();
        calls.push('after');
        return response;
      });
      
      router.register('test', async () => {
        calls.push('handler');
        return createSuccessResponse();
      });
      
      await router.route(createTestMessage('test'), createTestSender());
      
      expect(calls).toEqual(['before', 'handler', 'after']);
    });
    
    it('should execute middleware in order', async () => {
      const calls: string[] = [];
      
      router.use(async (_message, _sender, next) => {
        calls.push('middleware1-before');
        const response = await next();
        calls.push('middleware1-after');
        return response;
      });
      
      router.use(async (_message, _sender, next) => {
        calls.push('middleware2-before');
        const response = await next();
        calls.push('middleware2-after');
        return response;
      });
      
      router.register('test', async () => {
        calls.push('handler');
        return createSuccessResponse();
      });
      
      await router.route(createTestMessage('test'), createTestSender());
      
      expect(calls).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });
    
    it('should allow middleware to modify response', async () => {
      router.use(async (_message, _sender, next) => {
        const response = await next();
        return { ...response, modified: true };
      });
      
      router.register('test', async () => createSuccessResponse());
      
      const response = await router.route(
        createTestMessage('test'),
        createTestSender()
      );
      
      expect((response as any).modified).toBe(true);
    });
    
    it('should clear middleware', async () => {
      let middlewareCalled = false;
      
      router.use(async (_message, _sender, next) => {
        middlewareCalled = true;
        return next();
      });
      
      router.clearMiddleware();
      router.register('test', async () => createSuccessResponse());
      
      await router.route(createTestMessage('test'), createTestSender());
      
      expect(middlewareCalled).toBe(false);
    });
  });
  
  // ==========================================================================
  // STATS TESTS
  // ==========================================================================
  
  describe('statistics', () => {
    it('should track call count', async () => {
      router.register('test', async () => createSuccessResponse());
      
      await router.route(createTestMessage('test'), createTestSender());
      await router.route(createTestMessage('test'), createTestSender());
      await router.route(createTestMessage('test'), createTestSender());
      
      const stats = router.getStats();
      
      expect(stats.test.callCount).toBe(3);
    });
    
    it('should track last called time', async () => {
      router.register('test', async () => createSuccessResponse());
      
      const beforeCall = Date.now();
      await router.route(createTestMessage('test'), createTestSender());
      const afterCall = Date.now();
      
      const stats = router.getStats();
      
      expect(stats.test.lastCalledAt).toBeGreaterThanOrEqual(beforeCall);
      expect(stats.test.lastCalledAt).toBeLessThanOrEqual(afterCall);
    });
    
    it('should reset stats', async () => {
      router.register('test', async () => createSuccessResponse());
      
      await router.route(createTestMessage('test'), createTestSender());
      router.resetStats();
      
      const stats = router.getStats();
      
      expect(stats.test.callCount).toBe(0);
      expect(stats.test.lastCalledAt).toBeNull();
    });
    
    it('should return handler count', () => {
      router.register('action1', async () => createSuccessResponse());
      router.register('action2', async () => createSuccessResponse());
      
      expect(router.getHandlerCount()).toBe(2);
    });
  });
  
  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = router.getConfig();
      
      expect(config.debug).toBe(false);
      expect(config.handlerTimeout).toBe(DEFAULT_ROUTER_CONFIG.handlerTimeout);
    });
    
    it('should accept custom config', () => {
      const customRouter = createMessageRouter({
        debug: true,
        handlerTimeout: 5000,
      });
      
      const config = customRouter.getConfig();
      
      expect(config.debug).toBe(true);
      expect(config.handlerTimeout).toBe(5000);
    });
    
    it('should update config', () => {
      router.setConfig({ strictMode: true });
      
      expect(router.getConfig().strictMode).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('factory functions', () => {
  afterEach(() => {
    resetMessageRouter();
  });
  
  describe('createMessageRouter', () => {
    it('should create router with defaults', () => {
      const router = createMessageRouter();
      
      expect(router.getHandlerCount()).toBe(0);
    });
  });
  
  describe('createDebugRouter', () => {
    it('should create debug-enabled router', () => {
      const router = createDebugRouter();
      const config = router.getConfig();
      
      expect(config.debug).toBe(true);
      expect(config.strictMode).toBe(true);
    });
  });
  
  describe('singleton', () => {
    it('should return same instance', () => {
      const router1 = getMessageRouter();
      const router2 = getMessageRouter();
      
      expect(router1).toBe(router2);
    });
    
    it('should create new instance after reset', () => {
      const router1 = getMessageRouter();
      resetMessageRouter();
      const router2 = getMessageRouter();
      
      expect(router1).not.toBe(router2);
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('helper functions', () => {
  describe('registerHandlers', () => {
    it('should register multiple handlers', () => {
      const router = createMessageRouter();
      
      registerHandlers(router, {
        action1: async () => createSuccessResponse(),
        action2: async () => createSuccessResponse(),
        action3: async () => createSuccessResponse(),
      });
      
      expect(router.hasHandler('action1')).toBe(true);
      expect(router.hasHandler('action2')).toBe(true);
      expect(router.hasHandler('action3')).toBe(true);
    });
  });
  
  describe('createLoggingMiddleware', () => {
    it('should log messages', async () => {
      const logs: string[] = [];
      const logger = (msg: string) => logs.push(msg);
      
      const router = createMessageRouter();
      router.use(createLoggingMiddleware(logger));
      router.register('test', async () => createSuccessResponse());
      
      await router.route(createTestMessage('test'), createTestSender());
      
      expect(logs.some(l => l.includes('Started'))).toBe(true);
      expect(logs.some(l => l.includes('Completed'))).toBe(true);
    });
  });
  
  describe('createErrorRecoveryMiddleware', () => {
    it('should recover from errors', async () => {
      const errors: Error[] = [];
      
      const router = createMessageRouter();
      router.use(createErrorRecoveryMiddleware((err) => errors.push(err)));
      router.register('test', async () => {
        throw new Error('Test error');
      });
      
      const response = await router.route(
        createTestMessage('test'),
        createTestSender()
      );
      
      expect(response.success).toBe(false);
      expect(errors).toHaveLength(1);
    });
  });
  
  describe('createRateLimitMiddleware', () => {
    it('should rate limit requests', async () => {
      const router = createMessageRouter();
      router.use(createRateLimitMiddleware(2, 1000));
      router.register('test', async () => createSuccessResponse());
      
      const sender = createTestSender(123);
      
      // First two should succeed
      const r1 = await router.route(createTestMessage('test'), sender);
      const r2 = await router.route(createTestMessage('test'), sender);
      
      // Third should be rate limited
      const r3 = await router.route(createTestMessage('test'), sender);
      
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(false);
      expect(r3.error).toContain('Rate limit');
    });
  });
});
