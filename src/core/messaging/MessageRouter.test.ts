/**
 * MessageRouter Test Suite
 * @module core/messaging/MessageRouter.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageRouter,
  createRouter,
  createLoggingMiddleware,
  createValidationMiddleware,
  createAuthMiddleware,
  createRateLimitMiddleware,
  createTransformMiddleware,
} from './MessageRouter';
import type {
  IMessageBus,
  Message,
  MessageSender,
  MessageHandler,
  MessageContext,
  Unsubscribe,
} from './IMessageBus';

// ============================================================================
// MOCK MESSAGE BUS
// ============================================================================

class MockMessageBus implements Partial<IMessageBus> {
  handlers: Map<string, MessageHandler[]> = new Map();
  
  context: MessageContext = 'background';
  isReady: boolean = true;
  
  on<TPayload, TResponse>(
    type: string,
    handler: MessageHandler<TPayload, TResponse>
  ): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler as MessageHandler);
    
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler as MessageHandler);
        if (index >= 0) handlers.splice(index, 1);
      }
    };
  }
  
  // Simulate message dispatch
  async dispatch(message: Message, sender: MessageSender = { context: 'content' }): Promise<unknown> {
    const handlers = this.handlers.get(message.type) ?? [];
    let result: unknown;
    
    for (const handler of handlers) {
      result = await handler(message.payload, sender, message);
    }
    
    return result;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createTestMessage(type: string, payload: unknown = {}): Message {
  return {
    id: `test-${Date.now()}`,
    type,
    payload,
    source: 'content',
    timestamp: Date.now(),
  };
}

// ============================================================================
// ROUTER TESTS
// ============================================================================

describe('MessageRouter', () => {
  let bus: MockMessageBus;
  let router: MessageRouter;
  
  beforeEach(async () => {
    bus = new MockMessageBus();
    router = createRouter({ bus: bus as unknown as IMessageBus });
    await router.initialize();
  });
  
  afterEach(async () => {
    await router.shutdown();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(router.isReady).toBe(true);
    });
    
    it('should shutdown correctly', async () => {
      await router.shutdown();
      expect(router.isReady).toBe(false);
    });
  });
  
  describe('route registration', () => {
    it('should register a route', () => {
      router.route('TEST', () => 'response');
      
      expect(router.hasRoute('TEST')).toBe(true);
      expect(router.getRouteTypes()).toContain('TEST');
    });
    
    it('should unregister route via return function', () => {
      const unsubscribe = router.route('TEST', () => 'response');
      
      unsubscribe();
      
      expect(router.hasRoute('TEST')).toBe(false);
    });
    
    it('should register multiple routes', () => {
      router.registerRoutes([
        { type: 'A', handler: () => 'a' },
        { type: 'B', handler: () => 'b' },
      ]);
      
      expect(router.hasRoute('A')).toBe(true);
      expect(router.hasRoute('B')).toBe(true);
    });
    
    it('should register routes under namespace', () => {
      router.namespace('domain', [
        { type: 'ACTION', handler: () => 'result' },
      ]);
      
      expect(router.hasRoute('ACTION')).toBe(true);
    });
    
    it('should track route count', () => {
      router.route('A', () => {});
      router.route('B', () => {});
      
      expect(router.getStats().routeCount).toBe(2);
    });
  });
  
  describe('message handling', () => {
    it('should route message to handler', async () => {
      const handler = vi.fn().mockReturnValue({ result: 'ok' });
      router.route('TEST', handler);
      
      const message = createTestMessage('TEST', { data: 'test' });
      const response = await bus.dispatch(message);
      
      expect(handler).toHaveBeenCalled();
      expect(response).toEqual({ result: 'ok' });
    });
    
    it('should pass payload to handler', async () => {
      const handler = vi.fn();
      router.route('TEST', handler);
      
      await bus.dispatch(createTestMessage('TEST', { value: 42 }));
      
      expect(handler).toHaveBeenCalledWith(
        { value: 42 },
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle async handlers', async () => {
      router.route('ASYNC', async () => {
        await new Promise(r => setTimeout(r, 10));
        return { async: true };
      });
      
      const response = await bus.dispatch(createTestMessage('ASYNC'));
      
      expect(response).toEqual({ async: true });
    });
    
    it('should handle handler errors', async () => {
      router.route('ERROR', () => {
        throw new Error('Handler failed');
      });
      
      const response = await bus.dispatch(createTestMessage('ERROR'));
      
      expect(response).toEqual(expect.objectContaining({
        error: 'Handler failed',
        code: 'HANDLER_ERROR',
      }));
    });
    
    it('should track success count', async () => {
      router.route('TEST', () => 'ok');
      
      await bus.dispatch(createTestMessage('TEST'));
      await bus.dispatch(createTestMessage('TEST'));
      
      expect(router.getStats().successCount).toBe(2);
    });
    
    it('should track error count', async () => {
      router.route('ERROR', () => { throw new Error('fail'); });
      
      await bus.dispatch(createTestMessage('ERROR'));
      
      expect(router.getStats().errorCount).toBe(1);
    });
  });
  
  describe('context restrictions', () => {
    it('should restrict route to specific contexts', async () => {
      const handler = vi.fn().mockReturnValue('ok');
      router.route('RESTRICTED', handler, {
        allowedContexts: ['popup'],
      });
      
      // From content (not allowed)
      await bus.dispatch(
        createTestMessage('RESTRICTED'),
        { context: 'content' }
      );
      
      expect(handler).not.toHaveBeenCalled();
      
      // From popup (allowed)
      await bus.dispatch(
        createTestMessage('RESTRICTED'),
        { context: 'popup' }
      );
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  describe('middleware', () => {
    it('should execute middleware', async () => {
      const middleware = vi.fn(async (_ctx, next) => {
        await next();
      });
      
      router.use('test-mw', middleware);
      router.route('TEST', () => 'ok');
      
      await bus.dispatch(createTestMessage('TEST'));
      
      expect(middleware).toHaveBeenCalled();
    });
    
    it('should execute middleware in order', async () => {
      const order: string[] = [];
      
      router.use('first', async (_ctx, next) => {
        order.push('first-before');
        await next();
        order.push('first-after');
      }, { order: 100 });
      
      router.use('second', async (_ctx, next) => {
        order.push('second-before');
        await next();
        order.push('second-after');
      }, { order: 200 });
      
      router.route('TEST', () => {
        order.push('handler');
        return 'ok';
      });
      
      await bus.dispatch(createTestMessage('TEST'));
      
      expect(order).toEqual([
        'first-before',
        'second-before',
        'handler',
        'second-after',
        'first-after',
      ]);
    });
    
    it('should allow middleware to modify payload', async () => {
      router.use('transform', async (ctx, next) => {
        ctx.payload = { ...ctx.payload as object, extra: 'added' };
        await next();
      });
      
      const handler = vi.fn();
      router.route('TEST', handler);
      
      await bus.dispatch(createTestMessage('TEST', { original: true }));
      
      expect(handler).toHaveBeenCalledWith(
        { original: true, extra: 'added' },
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should allow middleware to set response', async () => {
      router.use('intercept', async (ctx, _next) => {
        ctx.response = { intercepted: true };
        ctx.abort = true;
      });
      
      router.route('TEST', () => ({ original: true }));
      
      const response = await bus.dispatch(createTestMessage('TEST'));
      
      expect(response).toEqual({ intercepted: true });
    });
    
    it('should filter middleware by type', async () => {
      const middleware = vi.fn(async (_ctx, next) => next());
      
      router.use('filtered', middleware, { types: ['MATCH'] });
      router.route('MATCH', () => 'ok');
      router.route('NO_MATCH', () => 'ok');
      
      await bus.dispatch(createTestMessage('MATCH'));
      expect(middleware).toHaveBeenCalledTimes(1);
      
      await bus.dispatch(createTestMessage('NO_MATCH'));
      expect(middleware).toHaveBeenCalledTimes(1); // Still 1
    });
    
    it('should disable middleware', async () => {
      const middleware = vi.fn(async (_ctx, next) => next());
      
      router.use('toggleable', middleware);
      router.route('TEST', () => 'ok');
      
      await bus.dispatch(createTestMessage('TEST'));
      expect(middleware).toHaveBeenCalledTimes(1);
      
      router.setMiddlewareEnabled('toggleable', false);
      
      await bus.dispatch(createTestMessage('TEST'));
      expect(middleware).toHaveBeenCalledTimes(1); // Still 1
    });
  });
  
  describe('guards', () => {
    it('should execute guards', async () => {
      const guard = vi.fn().mockReturnValue(true);
      
      router.guard('test-guard', guard);
      router.route('TEST', () => 'ok');
      
      await bus.dispatch(createTestMessage('TEST'));
      
      expect(guard).toHaveBeenCalled();
    });
    
    it('should reject when guard returns false', async () => {
      router.guard('reject', () => false);
      
      const handler = vi.fn();
      router.route('TEST', handler);
      
      const response = await bus.dispatch(createTestMessage('TEST'));
      
      expect(handler).not.toHaveBeenCalled();
      expect(response).toEqual(expect.objectContaining({
        error: 'Access denied',
        code: 'GUARD_REJECTED',
      }));
    });
    
    it('should track guard rejections', async () => {
      router.guard('reject', () => false);
      router.route('TEST', () => 'ok');
      
      await bus.dispatch(createTestMessage('TEST'));
      
      expect(router.getStats().guardRejections).toBe(1);
    });
    
    it('should filter guards by type', async () => {
      const guard = vi.fn().mockReturnValue(true);
      
      router.guard('filtered', guard, { types: ['GUARDED'] });
      router.route('GUARDED', () => 'ok');
      router.route('UNGUARDED', () => 'ok');
      
      await bus.dispatch(createTestMessage('GUARDED'));
      expect(guard).toHaveBeenCalledTimes(1);
      
      await bus.dispatch(createTestMessage('UNGUARDED'));
      expect(guard).toHaveBeenCalledTimes(1); // Still 1
    });
  });
  
  describe('statistics', () => {
    it('should track all stats', async () => {
      router.route('TEST', () => 'ok');
      router.use('mw', async (_ctx, next) => next());
      router.guard('guard', () => true);
      
      await bus.dispatch(createTestMessage('TEST'));
      
      const stats = router.getStats();
      
      expect(stats.routeCount).toBe(1);
      expect(stats.middlewareCount).toBe(1);
      expect(stats.guardCount).toBe(1);
      expect(stats.messagesRouted).toBe(1);
    });
    
    it('should reset stats', async () => {
      router.route('TEST', () => 'ok');
      await bus.dispatch(createTestMessage('TEST'));
      
      router.resetStats();
      
      expect(router.getStats().messagesRouted).toBe(0);
    });
    
    it('should track performance', async () => {
      router.route('TEST', async () => {
        await new Promise(r => setTimeout(r, 10));
        return 'ok';
      });
      
      await bus.dispatch(createTestMessage('TEST'));
      
      const avgTime = router.getAvgHandlerTime('TEST');
      expect(avgTime).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// MIDDLEWARE FACTORY TESTS
// ============================================================================

describe('createLoggingMiddleware', () => {
  it('should log messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const middleware = createLoggingMiddleware();
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: {},
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('createValidationMiddleware', () => {
  it('should pass valid payloads', async () => {
    const middleware = createValidationMiddleware({
      TEST: (p) => typeof p === 'object',
    });
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: { valid: true },
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.abort).toBe(false);
  });
  
  it('should reject invalid payloads', async () => {
    const middleware = createValidationMiddleware({
      TEST: () => 'Invalid payload',
    });
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: {},
      response: undefined,
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.abort).toBe(true);
    expect(ctx.response).toEqual(expect.objectContaining({
      error: 'Invalid payload',
    }));
  });
});

describe('createAuthMiddleware', () => {
  it('should allow authenticated senders', async () => {
    const middleware = createAuthMiddleware(() => true);
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: {},
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.abort).toBe(false);
  });
  
  it('should reject unauthenticated senders', async () => {
    const middleware = createAuthMiddleware(() => false);
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: {},
      response: undefined,
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.abort).toBe(true);
    expect(ctx.response).toEqual(expect.objectContaining({
      code: 'AUTH_ERROR',
    }));
  });
});

describe('createRateLimitMiddleware', () => {
  it('should allow requests within limit', async () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 5,
      windowMs: 1000,
    });
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext, tabId: 1 },
      payload: {},
      response: undefined,
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.abort).toBe(false);
  });
  
  it('should reject requests over limit', async () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 2,
      windowMs: 1000,
    });
    
    const createCtx = () => ({
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext, tabId: 1 },
      payload: {},
      response: undefined as unknown,
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    });
    
    await middleware(createCtx(), async () => {});
    await middleware(createCtx(), async () => {});
    
    const ctx = createCtx();
    await middleware(ctx, async () => {});
    
    expect(ctx.abort).toBe(true);
    expect(ctx.response).toEqual(expect.objectContaining({
      code: 'RATE_LIMIT',
    }));
  });
});

describe('createTransformMiddleware', () => {
  it('should transform request payload', async () => {
    const middleware = createTransformMiddleware({
      request: {
        TEST: (p) => ({ ...p as object, transformed: true }),
      },
    });
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: { original: true },
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.payload).toEqual({ original: true, transformed: true });
  });
  
  it('should transform response', async () => {
    const middleware = createTransformMiddleware({
      response: {
        TEST: (r) => ({ ...r as object, wrapped: true }),
      },
    });
    
    const ctx = {
      message: { type: 'TEST' } as Message,
      sender: { context: 'content' as MessageContext },
      payload: {},
      response: { data: 'test' },
      skip: false,
      abort: false,
      metadata: {},
      startTime: Date.now(),
    };
    
    await middleware(ctx, async () => {});
    
    expect(ctx.response).toEqual({ data: 'test', wrapped: true });
  });
});
