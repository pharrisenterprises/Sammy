/**
 * Tests for ExtensionBridge
 * @module background/ExtensionBridge.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExtensionBridge,
  createExtensionBridge,
  getExtensionBridge,
  createBridgeSubscription,
  DEFAULT_BRIDGE_CONFIG,
  BROADCAST_EVENTS,
  type IChromeRuntime,
  type BridgeResponse,
  type BroadcastEvent,
} from './ExtensionBridge';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

type MessageCallback = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

function createMockChromeRuntime(): IChromeRuntime & {
  _sendMessageResponse: BridgeResponse | undefined;
  _messageListeners: Set<MessageCallback>;
  _triggerMessage: (message: unknown) => void;
  _setLastError: (error: { message: string } | undefined) => void;
} {
  let lastError: { message?: string } | undefined;
  let sendMessageResponse: BridgeResponse | undefined = { success: true };
  const messageListeners = new Set<MessageCallback>();

  return {
    _sendMessageResponse: sendMessageResponse,
    _messageListeners: messageListeners,
    _triggerMessage: (message: unknown) => {
      messageListeners.forEach(listener => {
        listener(message, {} as chrome.runtime.MessageSender, () => {});
      });
    },
    _setLastError: (error) => {
      lastError = error;
    },
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        callback?.(sendMessageResponse);
      }, 0);
    }),
    onMessage: {
      addListener: vi.fn((callback: MessageCallback) => {
        messageListeners.add(callback);
      }),
      removeListener: vi.fn((callback: MessageCallback) => {
        messageListeners.delete(callback);
      }),
    },
    get lastError() {
      return lastError;
    },
    id: 'test-extension-id',
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ExtensionBridge', () => {
  let bridge: ExtensionBridge;
  let mockRuntime: ReturnType<typeof createMockChromeRuntime>;

  beforeEach(() => {
    mockRuntime = createMockChromeRuntime();
    bridge = new ExtensionBridge({ debug: false }, mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    bridge.destroy();
    ExtensionBridge.resetInstance();
  });

  // ==========================================================================
  // CONNECTION TESTS
  // ==========================================================================

  describe('connection', () => {
    it('should be connected when runtime available', () => {
      expect(bridge.isExtensionConnected()).toBe(true);
    });

    it('should report connection status', () => {
      const status = bridge.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.error).toBeNull();
    });

    it('should not be connected without runtime', () => {
      const disconnectedBridge = new ExtensionBridge({}, null);
      expect(disconnectedBridge.isExtensionConnected()).toBe(false);
      disconnectedBridge.destroy();
    });
  });

  // ==========================================================================
  // MESSAGING TESTS
  // ==========================================================================

  describe('send', () => {
    it('should send message and receive response', async () => {
      const response = await bridge.send('test_action', { data: 'test' });

      expect(response.success).toBe(true);
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'test_action', payload: { data: 'test' } },
        expect.any(Function)
      );
    });

    it('should handle errors', async () => {
      mockRuntime._setLastError({ message: 'Test error' });

      const response = await bridge.send('test_action');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Test error');
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const newMockRuntime = createMockChromeRuntime();
      vi.mocked(newMockRuntime.sendMessage).mockImplementation((message, callback) => {
        attempts++;
        if (attempts === 1) {
          // First attempt - throw to trigger rejection
          throw new Error('Simulated failure');
        } else {
          // Subsequent attempts - return success
          setTimeout(() => callback?.({ success: true }), 0);
        }
      });

      const bridgeWithRetry = new ExtensionBridge({ retryCount: 2, retryDelay: 10 }, newMockRuntime);
      const response = await bridgeWithRetry.send('test_action');

      expect(response.success).toBe(true);
      expect(attempts).toBe(2);
      expect(bridgeWithRetry.getStats().retries).toBe(1);
      bridgeWithRetry.destroy();
    });

    it('should track statistics', async () => {
      await bridge.send('test_action');

      expect(bridge.getStats().messagesSent).toBe(1);
    });
  });

  describe('sendAsync', () => {
    it('should send without waiting for response', () => {
      bridge.sendAsync('test_action', { data: 'test' });

      expect(mockRuntime.sendMessage).toHaveBeenCalled();
      expect(bridge.getStats().messagesSent).toBe(1);
    });
  });

  // ==========================================================================
  // EVENT SUBSCRIPTION TESTS
  // ==========================================================================

  describe('event subscription', () => {
    it('should receive broadcast events', () => {
      const events: BroadcastEvent[] = [];
      bridge.on('logEvent', (event) => events.push(event));

      mockRuntime._triggerMessage({ type: 'logEvent', data: { test: true } });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('logEvent');
      expect(events[0].data).toEqual({ test: true });
    });

    it('should unsubscribe from events', () => {
      const events: BroadcastEvent[] = [];
      const unsubscribe = bridge.on('logEvent', (event) => events.push(event));

      mockRuntime._triggerMessage({ type: 'logEvent', data: { first: true } });
      unsubscribe();
      mockRuntime._triggerMessage({ type: 'logEvent', data: { second: true } });

      expect(events).toHaveLength(1);
    });

    it('should receive events with onAny', () => {
      const events: BroadcastEvent[] = [];
      bridge.onAny((event) => events.push(event));

      mockRuntime._triggerMessage({ type: 'event1', data: {} });
      mockRuntime._triggerMessage({ type: 'event2', data: {} });

      expect(events).toHaveLength(2);
    });

    it('should track received messages', () => {
      bridge.on('logEvent', () => {});
      mockRuntime._triggerMessage({ type: 'logEvent', data: {} });

      expect(bridge.getStats().messagesReceived).toBe(1);
    });
  });

  // ==========================================================================
  // CONVENIENCE METHOD TESTS
  // ==========================================================================

  describe('convenience methods', () => {
    it('should get projects', async () => {
      await bridge.getProjects();

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'get_all_projects', payload: undefined },
        expect.any(Function)
      );
    });

    it('should get project by id', async () => {
      await bridge.getProject(123);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'get_project_by_id', payload: { id: 123 } },
        expect.any(Function)
      );
    });

    it('should add project', async () => {
      await bridge.addProject({
        name: 'Test',
        target_url: 'https://example.com',
      });

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'add_project',
          payload: expect.objectContaining({ name: 'Test' }),
        }),
        expect.any(Function)
      );
    });

    it('should open tab', async () => {
      await bridge.openTab('https://example.com');

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'openTab',
          payload: { url: 'https://example.com', inject: true },
        }),
        expect.any(Function)
      );
    });

    it('should start recording', async () => {
      await bridge.startRecording(1, 123);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'start_recording',
          payload: { projectId: 1, tabId: 123 },
        }),
        expect.any(Function)
      );
    });

    it('should start replay', async () => {
      await bridge.startReplay({
        projectId: 1,
        tabId: 123,
        steps: [],
      });

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'start_replay',
        }),
        expect.any(Function)
      );
    });
  });

  // ==========================================================================
  // SINGLETON TESTS
  // ==========================================================================

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = ExtensionBridge.getInstance();
      const instance2 = ExtensionBridge.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = ExtensionBridge.getInstance();
      ExtensionBridge.resetInstance();
      const instance2 = ExtensionBridge.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // CONFIG TESTS
  // ==========================================================================

  describe('configuration', () => {
    it('should use default config', () => {
      const config = bridge.getConfig();
      expect(config.timeout).toBe(DEFAULT_BRIDGE_CONFIG.timeout);
    });

    it('should update config', () => {
      bridge.updateConfig({ timeout: 5000 });
      expect(bridge.getConfig().timeout).toBe(5000);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    it('should reset statistics', async () => {
      await bridge.send('test');
      bridge.resetStats();

      expect(bridge.getStats().messagesSent).toBe(0);
    });
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should destroy and cleanup', () => {
      bridge.on('test', () => {});
      bridge.onAny(() => {});
      bridge.destroy();

      expect(mockRuntime.onMessage.removeListener).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createExtensionBridge', () => {
  afterEach(() => {
    ExtensionBridge.resetInstance();
  });

  it('should create instance', () => {
    const mockRuntime = createMockChromeRuntime();
    const bridge = createExtensionBridge({}, mockRuntime);

    expect(bridge).toBeInstanceOf(ExtensionBridge);
    bridge.destroy();
  });
});

describe('getExtensionBridge', () => {
  afterEach(() => {
    ExtensionBridge.resetInstance();
  });

  it('should get singleton instance', () => {
    const bridge = getExtensionBridge();

    expect(bridge).toBeInstanceOf(ExtensionBridge);
  });
});

describe('createBridgeSubscription', () => {
  afterEach(() => {
    ExtensionBridge.resetInstance();
  });

  it('should create subscription helper', () => {
    const mockRuntime = createMockChromeRuntime();
    const bridge = new ExtensionBridge({}, mockRuntime);

    const subscription = createBridgeSubscription(bridge, 'logEvent');
    
    const events: BroadcastEvent[] = [];
    const unsubscribe = subscription.subscribe((event) => events.push(event));

    mockRuntime._triggerMessage({ type: 'logEvent', data: { test: true } });

    expect(events).toHaveLength(1);
    expect(subscription.getLatest()?.data).toEqual({ test: true });

    unsubscribe();
    bridge.destroy();
  });
});
