/**
 * IMessageBus Test Suite
 * @module core/messaging/IMessageBus.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseMessageBus,
  isMessage,
  isMessageResponse,
  isMessageContext,
  createTypedHandler,
  type Message,
  type MessageResponse,
  type MessageBusConfig,
  type MessageEnvelope,
  type PortConnection,
  type RequestOptions,
  type BroadcastOptions,
  type PortMessageHandler,
  type PortDisconnectHandler,
  type Unsubscribe,
} from './IMessageBus';

// ============================================================================
// TEST IMPLEMENTATION
// ============================================================================

/**
 * Concrete implementation for testing
 */
class TestMessageBus extends BaseMessageBus {
  public sentMessages: Array<{ type: string; payload: unknown; options?: RequestOptions }> = [];
  public broadcasts: Array<{ type: string; payload: unknown; options?: BroadcastOptions }> = [];
  public connections: PortConnection[] = [];
  
  constructor(config: Partial<MessageBusConfig> = {}) {
    super({
      context: 'background',
      ...config,
    });
  }
  
  async initialize(): Promise<void> {
    this._isReady = true;
  }
  
  async shutdown(): Promise<void> {
    this._isReady = false;
    this._handlers.clear();
    this._subscriptions.clear();
    this._pendingRequests.clear();
  }
  
  send<T>(type: string, payload: T, options?: RequestOptions): void {
    this.sentMessages.push({ type, payload, options });
    this._stats.messagesSent++;
  }
  
  sendToTab<T>(tabId: number, type: string, payload: T, options?: RequestOptions): void {
    this.sentMessages.push({ type, payload, options: { ...options, tabId } });
    this._stats.messagesSent++;
  }
  
  sendToBackground<T>(type: string, payload: T, options?: RequestOptions): void {
    this.sentMessages.push({ type, payload, options: { ...options, target: 'background' } });
    this._stats.messagesSent++;
  }
  
  async request<TPayload, TResponse>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    this._stats.requestsSent++;
    
    // Simulate request/response
    const message = this.createMessage(type, payload, options);
    message.expectsResponse = true;
    message.correlationId = message.id;
    
    const envelope: MessageEnvelope = {
      message,
      sender: { context: this._context },
    };
    
    const response = await this.handleMessage(envelope);
    
    if (response?.success) {
      return response.data as TResponse;
    }
    
    throw new Error(response?.error ?? 'No handler');
  }
  
  async requestFromTab<TPayload, TResponse>(
    tabId: number,
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    return this.request(type, payload, { ...options, tabId });
  }
  
  async requestFromBackground<TPayload, TResponse>(
    type: string,
    payload: TPayload,
    options?: RequestOptions
  ): Promise<TResponse> {
    return this.request(type, payload, { ...options, target: 'background' });
  }
  
  broadcast<T>(type: string, payload: T, options?: BroadcastOptions): void {
    this.broadcasts.push({ type, payload, options });
    this._stats.messagesSent++;
    
    // Trigger subscriptions
    const channel = options?.channel ?? type;
    const subscriptions = this._subscriptions.get(channel);
    if (subscriptions) {
      const message = this.createMessage(type, payload);
      message.channel = channel;
      
      for (const sub of subscriptions) {
        sub.callback(payload, message);
      }
    }
  }
  
  connect(name: string): PortConnection {
    const port: PortConnection = {
      name,
      context: this._context,
      connectedAt: Date.now(),
      isConnected: true,
    };
    this.connections.push(port);
    this._stats.activeConnections++;
    return port;
  }
  
  onConnect(name: string, handler: (port: PortConnection) => void): Unsubscribe {
    // Simulate immediate connection
    const port = this.connect(name);
    handler(port);
    return () => {};
  }
  
  postMessage<T>(_port: PortConnection, _message: T): void {
    // No-op for test
  }
  
  onPortMessage<T>(_port: PortConnection, _handler: PortMessageHandler<T>): Unsubscribe {
    return () => {};
  }
  
  onPortDisconnect(_port: PortConnection, _handler: PortDisconnectHandler): Unsubscribe {
    return () => {};
  }
  
  disconnect(port: PortConnection): void {
    port.isConnected = false;
    this._stats.activeConnections--;
  }
  
  getConnections(): PortConnection[] {
    return this.connections.filter(c => c.isConnected);
  }
  
  // Expose protected methods for testing
  public testHandleMessage(envelope: MessageEnvelope) {
    return this.handleMessage(envelope);
  }
  
  public testHandleResponse(response: MessageResponse) {
    return this.handleResponse(response);
  }
  
  public testCreateMessage<T>(type: string, payload: T, options?: RequestOptions) {
    return this.createMessage(type, payload, options);
  }
}

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('isMessage', () => {
  it('should return true for valid message', () => {
    const message: Message = {
      id: 'test-1',
      type: 'TEST',
      payload: {},
      source: 'background',
      timestamp: Date.now(),
    };
    
    expect(isMessage(message)).toBe(true);
  });
  
  it('should return false for invalid message', () => {
    expect(isMessage(null)).toBe(false);
    expect(isMessage({})).toBe(false);
    expect(isMessage({ id: 'test' })).toBe(false);
  });
});

describe('isMessageResponse', () => {
  it('should return true for valid response', () => {
    const response: MessageResponse = {
      success: true,
      correlationId: 'test-1',
      timestamp: Date.now(),
    };
    
    expect(isMessageResponse(response)).toBe(true);
  });
  
  it('should return false for invalid response', () => {
    expect(isMessageResponse(null)).toBe(false);
    expect(isMessageResponse({})).toBe(false);
    expect(isMessageResponse({ success: true })).toBe(false);
  });
});

describe('isMessageContext', () => {
  it('should return true for valid contexts', () => {
    expect(isMessageContext('background')).toBe(true);
    expect(isMessageContext('content')).toBe(true);
    expect(isMessageContext('popup')).toBe(true);
    expect(isMessageContext('devtools')).toBe(true);
    expect(isMessageContext('options')).toBe(true);
  });
  
  it('should return false for invalid contexts', () => {
    expect(isMessageContext('invalid')).toBe(false);
    expect(isMessageContext('')).toBe(false);
  });
});

// ============================================================================
// BASE MESSAGE BUS TESTS
// ============================================================================

describe('BaseMessageBus', () => {
  let bus: TestMessageBus;
  
  beforeEach(async () => {
    bus = new TestMessageBus({ context: 'background' });
    await bus.initialize();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(bus.isReady).toBe(true);
      expect(bus.context).toBe('background');
    });
    
    it('should shutdown correctly', async () => {
      await bus.shutdown();
      expect(bus.isReady).toBe(false);
    });
  });
  
  describe('message handlers', () => {
    it('should register handler', () => {
      const handler = vi.fn();
      bus.on('TEST', handler);
      
      expect(bus.hasHandler('TEST')).toBe(true);
      expect(bus.getHandlerTypes()).toContain('TEST');
    });
    
    it('should unregister handler via return function', () => {
      const handler = vi.fn();
      const unsubscribe = bus.on('TEST', handler);
      
      unsubscribe();
      
      expect(bus.hasHandler('TEST')).toBe(false);
    });
    
    it('should unregister handler via off()', () => {
      const handler = vi.fn();
      bus.on('TEST', handler);
      
      bus.off('TEST', handler);
      
      expect(bus.hasHandler('TEST')).toBe(false);
    });
    
    it('should unregister all handlers', () => {
      bus.on('TEST', vi.fn());
      bus.on('TEST', vi.fn());
      
      bus.offAll('TEST');
      
      expect(bus.hasHandler('TEST')).toBe(false);
    });
    
    it('should call handler on message', async () => {
      const handler = vi.fn().mockReturnValue('response');
      bus.on('TEST', handler);
      
      const response = await bus.request('TEST', { data: 'test' });
      
      expect(handler).toHaveBeenCalled();
      expect(response).toBe('response');
    });
    
    it('should handle one-time handler', async () => {
      const handler = vi.fn().mockReturnValue('response');
      bus.once('TEST', handler);
      
      await bus.request('TEST', {});
      await bus.request('TEST', {}).catch(() => {}); // Should fail
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should pass sender info to handler', async () => {
      const handler = vi.fn();
      bus.on('TEST', handler);
      
      await bus.request('TEST', {});
      
      expect(handler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ context: 'background' }),
        expect.anything()
      );
    });
  });
  
  describe('send messages', () => {
    it('should send message', () => {
      bus.send('TEST', { data: 'test' });
      
      expect(bus.sentMessages).toHaveLength(1);
      expect(bus.sentMessages[0].type).toBe('TEST');
    });
    
    it('should send to tab', () => {
      bus.sendToTab(123, 'TEST', { data: 'test' });
      
      expect(bus.sentMessages[0].options?.tabId).toBe(123);
    });
    
    it('should send to background', () => {
      bus.sendToBackground('TEST', { data: 'test' });
      
      expect(bus.sentMessages[0].options?.target).toBe('background');
    });
  });
  
  describe('request/response', () => {
    it('should send request and receive response', async () => {
      bus.on('GET_DATA', () => ({ result: 'data' }));
      
      const response = await bus.request<{}, { result: string }>('GET_DATA', {});
      
      expect(response).toEqual({ result: 'data' });
    });
    
    it('should handle async handlers', async () => {
      bus.on('ASYNC_OP', async () => {
        await new Promise(r => setTimeout(r, 10));
        return { async: true };
      });
      
      const response = await bus.request('ASYNC_OP', {});
      
      expect(response).toEqual({ async: true });
    });
    
    it('should handle handler errors', async () => {
      bus.on('ERROR_OP', () => {
        throw new Error('Handler error');
      });
      
      await expect(bus.request('ERROR_OP', {})).rejects.toThrow('Handler error');
    });
  });
  
  describe('broadcast', () => {
    it('should broadcast message', () => {
      bus.broadcast('STATUS_CHANGED', { status: 'ready' });
      
      expect(bus.broadcasts).toHaveLength(1);
      expect(bus.broadcasts[0].type).toBe('STATUS_CHANGED');
    });
    
    it('should broadcast with options', () => {
      bus.broadcast('EVENT', {}, { channel: 'updates', targets: ['content'] });
      
      expect(bus.broadcasts[0].options?.channel).toBe('updates');
      expect(bus.broadcasts[0].options?.targets).toContain('content');
    });
  });
  
  describe('pub/sub', () => {
    it('should subscribe to channel', () => {
      const callback = vi.fn();
      bus.subscribe('updates', callback);
      
      bus.publish('updates', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith(
        { data: 'test' },
        expect.objectContaining({ channel: 'updates' })
      );
    });
    
    it('should unsubscribe from channel', () => {
      const callback = vi.fn();
      const unsubscribe = bus.subscribe('updates', callback);
      
      unsubscribe();
      bus.publish('updates', { data: 'test' });
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('should handle multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      bus.subscribe('updates', callback1);
      bus.subscribe('updates', callback2);
      
      bus.publish('updates', { data: 'test' });
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
  
  describe('port connections', () => {
    it('should create connection', () => {
      const port = bus.connect('test-port');
      
      expect(port.name).toBe('test-port');
      expect(port.isConnected).toBe(true);
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
  });
  
  describe('statistics', () => {
    it('should track messages sent', () => {
      bus.send('TEST', {});
      bus.send('TEST', {});
      
      expect(bus.getStats().messagesSent).toBe(2);
    });
    
    it('should track messages received', async () => {
      bus.on('TEST', () => {});
      await bus.request('TEST', {});
      
      expect(bus.getStats().messagesReceived).toBe(1);
    });
    
    it('should track active handlers', () => {
      bus.on('A', () => {});
      bus.on('B', () => {});
      
      expect(bus.getStats().activeHandlers).toBe(2);
    });
    
    it('should track active subscriptions', () => {
      bus.subscribe('channel-1', () => {});
      bus.subscribe('channel-2', () => {});
      
      expect(bus.getStats().activeSubscriptions).toBe(2);
    });
    
    it('should reset stats', () => {
      bus.send('TEST', {});
      bus.resetStats();
      
      expect(bus.getStats().messagesSent).toBe(0);
    });
  });
  
  describe('message creation', () => {
    it('should create message with unique ID', () => {
      const msg1 = bus.testCreateMessage('TEST', {});
      const msg2 = bus.testCreateMessage('TEST', {});
      
      expect(msg1.id).not.toBe(msg2.id);
    });
    
    it('should include source context', () => {
      const msg = bus.testCreateMessage('TEST', {});
      
      expect(msg.source).toBe('background');
    });
    
    it('should include timestamp', () => {
      const before = Date.now();
      const msg = bus.testCreateMessage('TEST', {});
      const after = Date.now();
      
      expect(msg.timestamp).toBeGreaterThanOrEqual(before);
      expect(msg.timestamp).toBeLessThanOrEqual(after);
    });
  });
});

// ============================================================================
// TYPED HANDLER TESTS
// ============================================================================

describe('createTypedHandler', () => {
  it('should create typed handler', () => {
    interface RequestPayload {
      id: string;
    }
    
    interface ResponseData {
      name: string;
    }
    
    const handler = createTypedHandler<RequestPayload, ResponseData>(
      (payload) => ({ name: `Item ${payload.id}` })
    );
    
    const result = handler({ id: '123' }, { context: 'background' }, {} as Message<RequestPayload>);
    
    expect(result).toEqual({ name: 'Item 123' });
  });
});
