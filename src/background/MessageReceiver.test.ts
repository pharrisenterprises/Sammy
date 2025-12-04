/**
 * Tests for MessageReceiver
 * @module background/MessageReceiver.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MessageReceiver,
  createMessageReceiver,
  type IChromeRuntimeMessages,
  type MessageEvent,
} from './MessageReceiver';
import { BackgroundConfig } from './BackgroundConfig';
import type { BackgroundMessage, BackgroundResponse, MessageSender } from './IBackgroundService';

// ============================================================================
// MOCK FACTORY
// ============================================================================

type MessageCallback = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

function createMockRuntime(): IChromeRuntimeMessages & {
  _simulateMessage: (
    message: unknown,
    sender?: Partial<chrome.runtime.MessageSender>
  ) => Promise<unknown>;
  _getListenerCount: () => number;
} {
  const listeners: MessageCallback[] = [];

  return {
    onMessage: {
      addListener: vi.fn((callback: MessageCallback) => {
        listeners.push(callback);
      }),
      removeListener: vi.fn((callback: MessageCallback) => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      }),
    },
    _simulateMessage: async (message, sender = {}) => {
      return new Promise((resolve) => {
        const sendResponse = vi.fn((response?: unknown) => {
          resolve(response);
        });

        const fullSender: chrome.runtime.MessageSender = {
          id: 'test-extension',
          ...sender,
        };

        for (const listener of listeners) {
          const result = listener(message, fullSender, sendResponse);
          if (result === true) {
            // Async handler - wait for sendResponse
            return;
          }
        }

        // No handler or sync handler
        resolve(undefined);
      });
    },
    _getListenerCount: () => listeners.length,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MessageReceiver', () => {
  let receiver: MessageReceiver;
  let config: BackgroundConfig;
  let mockRuntime: ReturnType<typeof createMockRuntime>;

  beforeEach(() => {
    config = new BackgroundConfig();
    mockRuntime = createMockRuntime();
    receiver = new MessageReceiver(config, mockRuntime);
  });

  afterEach(() => {
    receiver.stop();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // HANDLER REGISTRATION TESTS
  // ==========================================================================

  describe('handler registration', () => {
    it('should register a handler', () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      receiver.register('test_action', handler);

      expect(receiver.hasHandler('test_action')).toBe(true);
    });

    it('should get registered handlers', () => {
      receiver.register('action1', vi.fn(), 'project');
      receiver.register('action2', vi.fn(), 'tab');

      const handlers = receiver.getHandlers();
      expect(handlers.length).toBe(2);
    });

    it('should get handlers by category', () => {
      receiver.register('action1', vi.fn(), 'project');
      receiver.register('action2', vi.fn(), 'project');
      receiver.register('action3', vi.fn(), 'tab');

      const projectHandlers = receiver.getHandlersByCategory('project');
      expect(projectHandlers.length).toBe(2);
    });

    it('should unregister a handler', () => {
      receiver.register('test_action', vi.fn());
      receiver.unregister('test_action');

      expect(receiver.hasHandler('test_action')).toBe(false);
    });

    it('should warn when registering duplicate handler', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      receiver.register('test_action', vi.fn());
      receiver.register('test_action', vi.fn());

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // MESSAGE ROUTING TESTS
  // ==========================================================================

  describe('message routing', () => {
    it('should route message to handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true, data: 'test' });
      receiver.register('test_action', handler);

      const result = await receiver.route(
        { action: 'test_action', payload: { key: 'value' } },
        {}
      );

      expect(result.handled).toBe(true);
      expect(result.response).toEqual({ success: true, data: 'test' });
      expect(handler).toHaveBeenCalled();
    });

    it('should return unhandled for unknown action', async () => {
      const result = await receiver.route(
        { action: 'unknown_action' },
        {}
      );

      expect(result.handled).toBe(false);
    });

    it('should handle handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      receiver.register('test_action', handler);

      const result = await receiver.route(
        { action: 'test_action' },
        {}
      );

      expect(result.handled).toBe(true);
      expect(result.response?.success).toBe(false);
      expect(result.response?.error).toBe('Handler error');
    });

    it('should track request duration', async () => {
      const handler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true };
      });
      receiver.register('test_action', handler);

      const result = await receiver.route(
        { action: 'test_action' },
        {}
      );

      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
  });

  // ==========================================================================
  // LISTENER TESTS
  // ==========================================================================

  describe('listener management', () => {
    it('should start listening', () => {
      receiver.start();

      expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
      expect(receiver.isActive()).toBe(true);
    });

    it('should stop listening', () => {
      receiver.start();
      receiver.stop();

      expect(mockRuntime.onMessage.removeListener).toHaveBeenCalled();
      expect(receiver.isActive()).toBe(false);
    });

    it('should warn when starting twice', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      receiver.start();
      receiver.start();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // MESSAGE HANDLING TESTS
  // ==========================================================================

  describe('message handling', () => {
    beforeEach(() => {
      receiver.start();
    });

    it('should handle valid message', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true, data: 'result' });
      receiver.register('test_action', handler);

      const response = await mockRuntime._simulateMessage({ action: 'test_action' });

      expect(response).toEqual({ success: true, data: 'result' });
    });

    it('should pass payload to handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage({
        action: 'test_action',
        payload: { key: 'value' },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ payload: { key: 'value' } }),
        expect.any(Object)
      );
    });

    it('should return error response on handler failure', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Test error'));
      receiver.register('test_action', handler);

      const response = await mockRuntime._simulateMessage({ action: 'test_action' });

      expect(response).toEqual({ success: false, error: 'Test error' });
    });

    it('should reject invalid message format', async () => {
      const handler = vi.fn();
      receiver.register('test_action', handler);

      // Message without action
      await mockRuntime._simulateMessage({ payload: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should include sender tab info', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage(
        { action: 'test_action' },
        { tab: { id: 123, url: 'https://example.com' } }
      );

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          tab: expect.objectContaining({ id: 123 }),
        })
      );
    });
  });

  // ==========================================================================
  // TIMEOUT TESTS
  // ==========================================================================

  describe('timeout handling', () => {
    beforeEach(() => {
      config.updateMessage({ timeout: 100 });
      receiver = new MessageReceiver(config, mockRuntime);
      receiver.start();
    });

    it('should timeout slow handlers', async () => {
      const handler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { success: true };
      });
      receiver.register('slow_action', handler);

      const response = await mockRuntime._simulateMessage({ action: 'slow_action' });

      expect(response).toEqual({
        success: false,
        error: expect.stringContaining('timeout'),
      });
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    beforeEach(() => {
      receiver.start();
    });

    it('should track messages received', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage({ action: 'test_action' });
      await mockRuntime._simulateMessage({ action: 'test_action' });

      const stats = receiver.getStats();
      expect(stats.messagesReceived).toBe(2);
      expect(stats.messagesHandled).toBe(2);
    });

    it('should track unhandled messages', async () => {
      await mockRuntime._simulateMessage({ action: 'unknown' });

      const stats = receiver.getStats();
      expect(stats.messagesUnhandled).toBe(1);
    });

    it('should track errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('test'));
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage({ action: 'test_action' });

      const stats = receiver.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should reset statistics', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage({ action: 'test_action' });
      receiver.resetStats();

      const stats = receiver.getStats();
      expect(stats.messagesReceived).toBe(0);
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit handler_registered event', () => {
      const events: MessageEvent[] = [];
      receiver.onEvent(e => events.push(e));

      receiver.register('test_action', vi.fn());

      expect(events.some(e => e.type === 'handler_registered')).toBe(true);
    });

    it('should emit message_received event', async () => {
      const events: MessageEvent[] = [];
      receiver.onEvent(e => events.push(e));
      receiver.register('test_action', vi.fn().mockResolvedValue({ success: true }));
      receiver.start();

      await mockRuntime._simulateMessage({ action: 'test_action' });

      expect(events.some(e => e.type === 'message_received')).toBe(true);
    });

    it('should emit message_handled event', async () => {
      const events: MessageEvent[] = [];
      receiver.onEvent(e => events.push(e));
      receiver.register('test_action', vi.fn().mockResolvedValue({ success: true }));
      receiver.start();

      await mockRuntime._simulateMessage({ action: 'test_action' });

      expect(events.some(e => e.type === 'message_handled')).toBe(true);
    });

    it('should emit message_error event', async () => {
      const events: MessageEvent[] = [];
      receiver.onEvent(e => events.push(e));
      receiver.register('test_action', vi.fn().mockRejectedValue(new Error('test')));
      receiver.start();

      await mockRuntime._simulateMessage({ action: 'test_action' });

      expect(events.some(e => e.type === 'message_error')).toBe(true);
    });

    it('should unsubscribe from events', () => {
      const events: MessageEvent[] = [];
      const unsubscribe = receiver.onEvent(e => events.push(e));

      unsubscribe();
      receiver.register('test_action', vi.fn());

      expect(events.length).toBe(0);
    });
  });

  // ==========================================================================
  // PENDING REQUESTS TESTS
  // ==========================================================================

  describe('pending requests', () => {
    beforeEach(() => {
      receiver.start();
    });

    it('should track pending requests', async () => {
      const handler = vi.fn().mockImplementation(async () => {
        // Check pending while handler running
        expect(receiver.getPendingCount()).toBeGreaterThan(0);
        return { success: true };
      });
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage({ action: 'test_action' });
    });

    it('should clear pending after completion', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      receiver.register('test_action', handler);

      await mockRuntime._simulateMessage({ action: 'test_action' });
      
      // Wait for async cleanup in finally block
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receiver.getPendingCount()).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createMessageReceiver', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const receiver = createMessageReceiver(config);

    expect(receiver).toBeInstanceOf(MessageReceiver);
  });
});
