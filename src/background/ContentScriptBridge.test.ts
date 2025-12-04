/**
 * Tests for ContentScriptBridge
 * @module background/ContentScriptBridge.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ContentScriptBridge,
  createContentScriptBridge,
  CONTENT_MESSAGE_TYPES,
  DEFAULT_CONTENT_BRIDGE_CONFIG,
  type IChromeTabs,
  type IChromeRuntime,
  type ContentResponse,
  type ContentScriptMessage,
  type RunStepData,
} from './ContentScriptBridge';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

type MessageCallback = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

function createMockChromeTabs(): IChromeTabs & {
  _response: unknown;
  _setResponse: (response: unknown) => void;
} {
  let response: unknown = true;

  return {
    _response: response,
    _setResponse: (r) => {
      response = r;
    },
    sendMessage: vi.fn((tabId, message, callback) => {
      setTimeout(() => callback?.(response), 0);
    }),
    get: vi.fn((tabId, callback) => {
      callback({ id: tabId, url: 'https://example.com' } as chrome.tabs.Tab);
    }),
  };
}

function createMockChromeRuntime(): IChromeRuntime & {
  _messageListeners: Set<MessageCallback>;
  _triggerMessage: (message: unknown, sender: chrome.runtime.MessageSender) => void;
  _setLastError: (error: { message: string } | undefined) => void;
} {
  let lastError: { message?: string } | undefined;
  const messageListeners = new Set<MessageCallback>();

  return {
    _messageListeners: messageListeners,
    _triggerMessage: (message, sender) => {
      messageListeners.forEach(listener => {
        listener(message, sender, () => {});
      });
    },
    _setLastError: (error) => {
      lastError = error;
    },
    get lastError() {
      return lastError;
    },
    onMessage: {
      addListener: vi.fn((callback: MessageCallback) => {
        messageListeners.add(callback);
      }),
      removeListener: vi.fn((callback: MessageCallback) => {
        messageListeners.delete(callback);
      }),
    },
  };
}

function createMockSender(tabId: number): chrome.runtime.MessageSender {
  return {
    tab: { id: tabId } as chrome.tabs.Tab,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ContentScriptBridge', () => {
  let bridge: ContentScriptBridge;
  let mockTabs: ReturnType<typeof createMockChromeTabs>;
  let mockRuntime: ReturnType<typeof createMockChromeRuntime>;

  beforeEach(() => {
    mockTabs = createMockChromeTabs();
    mockRuntime = createMockChromeRuntime();
    bridge = new ContentScriptBridge({ debug: false }, mockTabs, mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    bridge.destroy();
  });

  // ==========================================================================
  // BASIC MESSAGING TESTS
  // ==========================================================================

  describe('send', () => {
    it('should send message to tab', async () => {
      const response = await bridge.send(123, 'test_type', { data: 'test' });

      expect(response.success).toBe(true);
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'test_type', data: { data: 'test' } },
        expect.any(Function)
      );
    });

    it('should handle error response', async () => {
      mockRuntime._setLastError({ message: 'Tab not found' });

      const response = await bridge.send(999, 'test_type');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Tab not found');
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const newMockTabs = createMockChromeTabs();
      const newMockRuntime = createMockChromeRuntime();
      
      vi.mocked(newMockTabs.sendMessage).mockImplementation((tabId, message, callback) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Temporary error');
        } else {
          setTimeout(() => callback?.(true), 0);
        }
      });

      const bridgeWithRetry = new ContentScriptBridge(
        { retryCount: 2, retryDelay: 10 },
        newMockTabs,
        newMockRuntime
      );

      const response = await bridgeWithRetry.send(123, 'test_type');

      expect(response.success).toBe(true);
      expect(bridgeWithRetry.getStats().retries).toBe(1);
      bridgeWithRetry.destroy();
    });

    it('should track statistics', async () => {
      await bridge.send(123, 'test_type');

      expect(bridge.getStats().messagesSent).toBe(1);
    });
  });

  describe('sendAsync', () => {
    it('should send without waiting', () => {
      bridge.sendAsync(123, 'test_type', { data: 'test' });

      expect(mockTabs.sendMessage).toHaveBeenCalled();
      expect(bridge.getStats().messagesSent).toBe(1);
    });
  });

  // ==========================================================================
  // REPLAY COMMAND TESTS
  // ==========================================================================

  describe('runStep', () => {
    it('should send runStep command', async () => {
      const stepData: RunStepData = {
        event: 'click',
        bundle: { xpath: '/html/body/button' },
        label: 'Submit',
      };

      const response = await bridge.runStep(123, stepData);

      expect(response.success).toBe(true);
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'runStep', data: stepData },
        expect.any(Function)
      );
    });

    it('should track step statistics', async () => {
      await bridge.runStep(123, { event: 'click', bundle: {} });

      expect(bridge.getStats().stepsSent).toBe(1);
      expect(bridge.getStats().stepsSucceeded).toBe(1);
    });

    it('should track failed steps', async () => {
      mockTabs._setResponse(false);

      await bridge.runStep(123, { event: 'click', bundle: {} });

      expect(bridge.getStats().stepsFailed).toBe(1);
    });
  });

  describe('prepareReplay', () => {
    it('should send prepare_replay command', async () => {
      await bridge.prepareReplay(123, 1);

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'prepare_replay', data: { projectId: 1 } },
        expect.any(Function)
      );
    });
  });

  describe('stopReplay', () => {
    it('should send stop_replay command', async () => {
      await bridge.stopReplay(123);

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'stop_replay', data: undefined },
        expect.any(Function)
      );
    });
  });

  // ==========================================================================
  // RECORDING COMMAND TESTS
  // ==========================================================================

  describe('enableRecording', () => {
    it('should send enable_recording command', async () => {
      await bridge.enableRecording(123, 1);

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'enable_recording', data: { projectId: 1 } },
        expect.any(Function)
      );
    });
  });

  describe('disableRecording', () => {
    it('should send disable_recording command', async () => {
      await bridge.disableRecording(123);

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'disable_recording', data: undefined },
        expect.any(Function)
      );
    });
  });

  // ==========================================================================
  // MESSAGE LISTENER TESTS
  // ==========================================================================

  describe('message listeners', () => {
    it('should receive logEvent messages', () => {
      const events: unknown[] = [];
      bridge.onLogEvent((message, sender) => {
        events.push({ message, tabId: sender.tab?.id });
      });

      mockRuntime._triggerMessage(
        { type: 'logEvent', data: { eventType: 'click', xpath: '/button' } },
        createMockSender(123)
      );

      expect(events).toHaveLength(1);
      expect((events[0] as { tabId: number }).tabId).toBe(123);
    });

    it('should unsubscribe from messages', () => {
      const events: unknown[] = [];
      const unsubscribe = bridge.on('test', (message) => events.push(message));

      mockRuntime._triggerMessage({ type: 'test', data: { first: true } }, createMockSender(123));
      unsubscribe();
      mockRuntime._triggerMessage({ type: 'test', data: { second: true } }, createMockSender(123));

      expect(events).toHaveLength(1);
    });

    it('should receive messages with onAny', () => {
      const events: unknown[] = [];
      bridge.onAny((message) => events.push(message));

      mockRuntime._triggerMessage({ type: 'event1', data: {} }, createMockSender(123));
      mockRuntime._triggerMessage({ type: 'event2', data: {} }, createMockSender(123));

      expect(events).toHaveLength(2);
    });

    it('should ignore messages without tab info', () => {
      const events: unknown[] = [];
      bridge.on('test', (message) => events.push(message));

      mockRuntime._triggerMessage({ type: 'test' }, {} as chrome.runtime.MessageSender);

      expect(events).toHaveLength(0);
    });

    it('should track received messages', () => {
      bridge.on('test', () => {});
      mockRuntime._triggerMessage({ type: 'test' }, createMockSender(123));

      expect(bridge.getStats().messagesReceived).toBe(1);
    });
  });

  // ==========================================================================
  // TAB STATE TESTS
  // ==========================================================================

  describe('tab state tracking', () => {
    it('should track connected tabs', async () => {
      await bridge.send(123, 'test');

      expect(bridge.isTabConnected(123)).toBe(true);
      expect(bridge.getConnectedTabs()).toContain(123);
    });

    it('should get tab state', async () => {
      await bridge.send(123, 'test');

      const state = bridge.getTabState(123);
      expect(state?.connected).toBe(true);
      expect(state?.messageCount).toBe(1);
    });

    it('should clear tab state', async () => {
      await bridge.send(123, 'test');
      bridge.clearTabState(123);

      expect(bridge.getTabState(123)).toBeUndefined();
    });
  });

  // ==========================================================================
  // TAB VALIDATION TESTS
  // ==========================================================================

  describe('tabExists', () => {
    it('should check if tab exists', async () => {
      const exists = await bridge.tabExists(123);

      expect(exists).toBe(true);
      expect(mockTabs.get).toHaveBeenCalledWith(123, expect.any(Function));
    });

    it('should return false for non-existent tab', async () => {
      vi.mocked(mockTabs.get).mockImplementation((tabId, callback) => {
        callback(undefined);
      });

      const exists = await bridge.tabExists(999);

      expect(exists).toBe(false);
    });
  });

  // ==========================================================================
  // UTILITY TESTS
  // ==========================================================================

  describe('highlightElement', () => {
    it('should send highlight command', async () => {
      await bridge.highlightElement(123, '#myButton', 2000);

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        123,
        { type: 'highlight_element', data: { selector: '#myButton', duration: 2000 } },
        expect.any(Function)
      );
    });
  });

  describe('getPageInfo', () => {
    it('should request page info', async () => {
      mockTabs._setResponse({ url: 'https://example.com', title: 'Test', readyState: 'complete' });

      const response = await bridge.getPageInfo(123);

      expect(response.success).toBe(true);
    });
  });

  // ==========================================================================
  // CONFIG TESTS
  // ==========================================================================

  describe('configuration', () => {
    it('should use default config', () => {
      const config = bridge.getConfig();
      expect(config.timeout).toBe(DEFAULT_CONTENT_BRIDGE_CONFIG.timeout);
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
      await bridge.send(123, 'test');
      bridge.resetStats();

      expect(bridge.getStats().messagesSent).toBe(0);
    });
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should cleanup on destroy', () => {
      bridge.on('test', () => {});
      bridge.destroy();

      expect(mockRuntime.onMessage.removeListener).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createContentScriptBridge', () => {
  it('should create instance', () => {
    const mockTabs = createMockChromeTabs();
    const mockRuntime = createMockChromeRuntime();
    const bridge = createContentScriptBridge({}, mockTabs, mockRuntime);

    expect(bridge).toBeInstanceOf(ContentScriptBridge);
    bridge.destroy();
  });
});
