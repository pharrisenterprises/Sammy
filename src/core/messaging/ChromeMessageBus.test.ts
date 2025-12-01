/**
 * ChromeMessageBus Test Suite
 * @module core/messaging/ChromeMessageBus.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ChromeMessageBus,
  createMessageBus,
  getMessageBus,
  resetMessageBus,
  isChromeRuntimeAvailable,
  isChromeTabsAvailable,
  detectContext,
} from './ChromeMessageBus';
import type { MessageContext } from './IMessageBus';

// ============================================================================
// CHROME API MOCK
// ============================================================================

interface MockPort {
  name: string;
  sender?: chrome.runtime.MessageSender;
  onMessage: {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    listeners: Array<(message: unknown) => void>;
  };
  onDisconnect: {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    listeners: Array<() => void>;
  };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function createMockPort(name: string, sender?: chrome.runtime.MessageSender): MockPort {
  const onMessageListeners: Array<(message: unknown) => void> = [];
  const onDisconnectListeners: Array<() => void> = [];
  
  return {
    name,
    sender,
    onMessage: {
      addListener: vi.fn((listener) => onMessageListeners.push(listener)),
      removeListener: vi.fn(),
      listeners: onMessageListeners,
    },
    onDisconnect: {
      addListener: vi.fn((listener) => onDisconnectListeners.push(listener)),
      removeListener: vi.fn(),
      listeners: onDisconnectListeners,
    },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
  };
}

function setupChromeMock() {
  const messageListeners: Array<(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void> = [];
  
  const connectListeners: Array<(port: chrome.runtime.Port) => void> = [];
  
  const mockRuntime = {
    sendMessage: vi.fn((message, callback) => {
      // Simulate async response - trigger local handlers if registered
      setTimeout(() => {
        // Simulate response for requests
        if (message.expectsResponse && callback) {
          callback({ success: true, data: message.payload });
        } else if (callback) {
          callback(undefined);
        }
      }, 0);
    }),
    onMessage: {
      addListener: vi.fn((listener) => messageListeners.push(listener)),
      removeListener: vi.fn((listener) => {
        const index = messageListeners.indexOf(listener);
        if (index >= 0) messageListeners.splice(index, 1);
      }),
      listeners: messageListeners,
    },
    onConnect: {
      addListener: vi.fn((listener) => connectListeners.push(listener)),
      removeListener: vi.fn((listener) => {
        const index = connectListeners.indexOf(listener);
        if (index >= 0) connectListeners.splice(index, 1);
      }),
      listeners: connectListeners,
    },
    connect: vi.fn((options) => createMockPort(options?.name ?? 'default')),
    lastError: null as chrome.runtime.LastError | null,
  };
  
  const mockTabs = {
    sendMessage: vi.fn((_tabId, _message, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      setTimeout(() => {
        if (callback) callback(undefined);
      }, 0);
    }),
    query: vi.fn((_query, callback) => {
      callback([{ id: 1 }, { id: 2 }]);
    }),
  };
  
  (globalThis as Record<string, unknown>).chrome = {
    runtime: mockRuntime,
    tabs: mockTabs,
  };
  
  return {
    runtime: mockRuntime,
    tabs: mockTabs,
    triggerMessage: (message: unknown, sender: chrome.runtime.MessageSender = {}) => {
      let response: unknown;
      const sendResponse = (r: unknown) => { response = r; };
      
      for (const listener of messageListeners) {
        listener(message, sender, sendResponse);
      }
      
      return response;
    },
    triggerConnect: (port: MockPort) => {
      for (const listener of connectListeners) {
        listener(port as unknown as chrome.runtime.Port);
      }
    },
  };
}

function clearChromeMock() {
  delete (globalThis as Record<string, unknown>).chrome;
}

// ============================================================================
// DETECTION TESTS
// ============================================================================

describe('isChromeRuntimeAvailable', () => {
  afterEach(() => {
    clearChromeMock();
  });
  
  it('should return false when chrome not defined', () => {
    expect(isChromeRuntimeAvailable()).toBe(false);
  });
  
  it('should return true when chrome.runtime available', () => {
    setupChromeMock();
    expect(isChromeRuntimeAvailable()).toBe(true);
  });
});

describe('isChromeTabsAvailable', () => {
  afterEach(() => {
    clearChromeMock();
  });
  
  it('should return false when chrome not defined', () => {
    expect(isChromeTabsAvailable()).toBe(false);
  });
  
  it('should return true when chrome.tabs available', () => {
    setupChromeMock();
    expect(isChromeTabsAvailable()).toBe(true);
  });
});

describe('detectContext', () => {
  afterEach(() => {
    clearChromeMock();
  });
  
  it('should return unknown when chrome not available', () => {
    expect(detectContext()).toBe('unknown');
  });
});

// ============================================================================
// CHROME MESSAGE BUS TESTS
// ============================================================================

describe('ChromeMessageBus', () => {
  let bus: ChromeMessageBus;
  let mocks: ReturnType<typeof setupChromeMock>;
  
  beforeEach(async () => {
    mocks = setupChromeMock();
    bus = createMessageBus({ context: 'background' });
    await bus.initialize();
  });
  
  afterEach(async () => {
    await bus.shutdown();
    clearChromeMock();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(bus.isReady).toBe(true);
      expect(bus.context).toBe('background');
    });
    
    it('should set up message listener', () => {
      expect(mocks.runtime.onMessage.addListener).toHaveBeenCalled();
    });
    
    it('should set up connect listener for background', () => {
      expect(mocks.runtime.onConnect.addListener).toHaveBeenCalled();
    });
    
    it('should shutdown correctly', async () => {
      await bus.shutdown();
      
      expect(bus.isReady).toBe(false);
      expect(mocks.runtime.onMessage.removeListener).toHaveBeenCalled();
    });
    
    it('should throw when chrome not available', async () => {
      clearChromeMock();
      const newBus = createMessageBus();
      
      await expect(newBus.initialize()).rejects.toThrow(/not available/);
    });
  });
  
  describe('send messages', () => {
    it('should send message via runtime', () => {
      bus.send('TEST', { data: 'test' });
      
      expect(mocks.runtime.sendMessage).toHaveBeenCalled();
    });
    
    it('should send to specific tab', () => {
      bus.sendToTab(123, 'TEST', { data: 'test' });
      
      expect(mocks.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ type: 'TEST' }),
        expect.any(Function)
      );
    });
    
    it('should send to background', () => {
      bus.sendToBackground('TEST', { data: 'test' });
      
      expect(mocks.runtime.sendMessage).toHaveBeenCalled();
    });
    
    it('should track messages sent', () => {
      bus.send('TEST', {});
      bus.send('TEST', {});
      
      expect(bus.getStats().messagesSent).toBe(2);
    });
  });
  
  describe('message handlers', () => {
    it('should register and call handler', () => {
      const handler = vi.fn().mockReturnValue({ result: 'ok' });
      bus.on('TEST', handler);
      
      const message = {
        id: 'test-1',
        type: 'TEST',
        payload: { data: 'test' },
        source: 'content' as MessageContext,
        timestamp: Date.now(),
        expectsResponse: true,
      };
      
      mocks.triggerMessage(message, { tab: { id: 1 } } as chrome.runtime.MessageSender);
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should handle one-time handler', async () => {
      const handler = vi.fn();
      bus.once('TEST', handler);
      
      const message = {
        id: 'test-1',
        type: 'TEST',
        payload: {},
        source: 'content' as MessageContext,
        timestamp: Date.now(),
      };
      
      mocks.triggerMessage(message);
      await new Promise(resolve => setTimeout(resolve, 10));
      mocks.triggerMessage(message);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should unsubscribe handler', () => {
      const handler = vi.fn();
      const unsubscribe = bus.on('TEST', handler);
      
      unsubscribe();
      
      expect(bus.hasHandler('TEST')).toBe(false);
    });
  });
  
  describe('request/response', () => {
    it('should send request and receive response', async () => {
      // Mock needs to handle the message and return handler response
      const originalSendMessage = mocks.runtime.sendMessage;
      mocks.runtime.sendMessage = vi.fn((_message, callback) => {
        // Simulate the message going to a handler that returns { result: 'data' }
        setTimeout(() => {
          if (callback) callback({ result: 'data' });
        }, 0);
      });
      
      const response = await bus.request('GET_DATA', {});
      
      expect(response).toEqual({ result: 'data' });
      
      // Restore
      mocks.runtime.sendMessage = originalSendMessage;
    });
    
    it('should handle async handlers', async () => {
      // Mock needs to simulate async handler response
      const originalSendMessage = mocks.runtime.sendMessage;
      mocks.runtime.sendMessage = vi.fn((_message, callback) => {
        setTimeout(() => {
          if (callback) callback({ async: true });
        }, 20);
      });
      
      const response = await bus.request('ASYNC', {});
      
      expect(response).toEqual({ async: true });
      
      // Restore
      mocks.runtime.sendMessage = originalSendMessage;
    });
    
    it('should track requests', async () => {
      bus.on('TEST', () => 'ok');
      
      await bus.request('TEST', {});
      
      expect(bus.getStats().requestsSent).toBe(1);
    });
  });
  
  describe('broadcast', () => {
    it('should broadcast to runtime and tabs', () => {
      bus.broadcast('STATUS', { status: 'ready' });
      
      expect(mocks.runtime.sendMessage).toHaveBeenCalled();
      expect(mocks.tabs.query).toHaveBeenCalled();
    });
    
    it('should notify local subscriptions', () => {
      const callback = vi.fn();
      bus.subscribe('updates', callback);
      
      bus.broadcast('EVENT', { data: 'test' }, { channel: 'updates' });
      
      expect(callback).toHaveBeenCalledWith(
        { data: 'test' },
        expect.objectContaining({ channel: 'updates' })
      );
    });
  });
  
  describe('pub/sub', () => {
    it('should subscribe to channel', () => {
      const callback = vi.fn();
      bus.subscribe('channel-1', callback);
      
      bus.publish('channel-1', { message: 'hello' });
      
      expect(callback).toHaveBeenCalled();
    });
    
    it('should unsubscribe from channel', () => {
      const callback = vi.fn();
      const unsubscribe = bus.subscribe('channel-1', callback);
      
      unsubscribe();
      bus.publish('channel-1', { message: 'hello' });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('port connections', () => {
    it('should create port connection', () => {
      const port = bus.connect('test-port');
      
      expect(port.name).toBe('test-port');
      expect(port.isConnected).toBe(true);
      expect(mocks.runtime.connect).toHaveBeenCalledWith({ name: 'test-port' });
    });
    
    it('should disconnect port', () => {
      const port = bus.connect('test-port');
      bus.disconnect(port);
      
      expect(port.isConnected).toBe(false);
    });
    
    it('should get active connections', () => {
      const port1 = bus.connect('port-1');
      bus.connect('port-2');
      bus.disconnect(port1);
      
      const connections = bus.getConnections();
      
      expect(connections).toHaveLength(1);
      expect(connections[0].name).toBe('port-2');
    });
    
    it('should listen for incoming connections', () => {
      const handler = vi.fn();
      bus.onConnect('test-port', handler);
      
      const mockPort = createMockPort('test-port', { tab: { id: 1 } } as chrome.runtime.MessageSender);
      mocks.triggerConnect(mockPort);
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  describe('statistics', () => {
    it('should track all stats', async () => {
      bus.on('TEST', () => 'ok');
      
      bus.send('MSG', {});
      await bus.request('TEST', {});
      bus.connect('port');
      
      const stats = bus.getStats();
      
      expect(stats.messagesSent).toBeGreaterThan(0);
      expect(stats.requestsSent).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });
    
    it('should reset stats', () => {
      bus.send('MSG', {});
      bus.resetStats();
      
      expect(bus.getStats().messagesSent).toBe(0);
    });
  });
  
  describe('message queue', () => {
    it('should queue messages', () => {
      bus.queueMessage('TEST', { data: 'queued' });
      
      expect(bus.getStats().queuedMessages).toBe(1);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getMessageBus (singleton)', () => {
  beforeEach(() => {
    setupChromeMock();
  });
  
  afterEach(async () => {
    await resetMessageBus();
    clearChromeMock();
  });
  
  it('should return same instance', () => {
    const instance1 = getMessageBus();
    const instance2 = getMessageBus();
    
    expect(instance1).toBe(instance2);
  });
  
  it('should reset on resetMessageBus', async () => {
    const instance1 = getMessageBus();
    await instance1.initialize();
    
    await resetMessageBus();
    
    const instance2 = getMessageBus();
    expect(instance1).not.toBe(instance2);
  });
});
