/**
 * Tests for ContextBridge
 * @module core/content/ContextBridge.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ContextBridge,
  createContextBridge,
  createInitializedBridge,
  createDebugBridge,
  getContextBridge,
  resetContextBridge,
  MockContextBridge,
  createMockContextBridge,
  DEFAULT_BRIDGE_CONFIG,
} from './ContextBridge';
import {
  PAGE_SCRIPT_SOURCE,
  CONTENT_SCRIPT_SOURCE,
} from './IContentScript';
import type {
  ContentToExtensionMessage,
  ExtensionToContentMessage,
  PageContextMessage,
} from './IContentScript';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock window.postMessage
const mockPostMessage = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

// Store event listeners for simulation
let messageListeners: ((event: MessageEvent) => void)[] = [];

beforeEach(() => {
  // Setup window mocks
  vi.stubGlobal('window', {
    postMessage: mockPostMessage,
    addEventListener: (type: string, handler: (event: MessageEvent) => void) => {
      if (type === 'message') {
        messageListeners.push(handler);
      }
      mockAddEventListener(type, handler);
    },
    removeEventListener: (type: string, handler: (event: MessageEvent) => void) => {
      if (type === 'message') {
        messageListeners = messageListeners.filter(h => h !== handler);
      }
      mockRemoveEventListener(type, handler);
    },
  });
  
  // Setup document mocks
  vi.stubGlobal('document', {
    createElement: vi.fn().mockReturnValue({
      remove: vi.fn(),
    }),
    head: {
      appendChild: vi.fn(),
    },
    documentElement: {
      appendChild: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockPostMessage.mockClear();
  mockAddEventListener.mockClear();
  mockRemoveEventListener.mockClear();
  messageListeners = [];
  resetContextBridge();
});

// ============================================================================
// CONTEXT BRIDGE TESTS
// ============================================================================

describe('ContextBridge', () => {
  describe('configuration', () => {
    it('should use default config', () => {
      const bridge = createContextBridge();
      const config = bridge.getConfig();
      
      expect(config.pageMessageSource).toBe(CONTENT_SCRIPT_SOURCE);
      expect(config.acceptedPageSources).toContain(PAGE_SCRIPT_SOURCE);
      expect(config.debug).toBe(false);
    });
    
    it('should accept custom config', () => {
      const bridge = createContextBridge({
        debug: true,
        extensionMessageTimeout: 5000,
      });
      
      const config = bridge.getConfig();
      
      expect(config.debug).toBe(true);
      expect(config.extensionMessageTimeout).toBe(5000);
    });
    
    it('should update config', () => {
      const bridge = createContextBridge();
      bridge.setConfig({ debug: true });
      
      expect(bridge.getConfig().debug).toBe(true);
    });
  });
  
  describe('initialization', () => {
    it('should not be initialized by default', () => {
      const bridge = createContextBridge();
      
      expect(bridge.isInitialized()).toBe(false);
    });
    
    it('should be initialized after initialize()', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      expect(bridge.isInitialized()).toBe(true);
    });
    
    it('should attach page listener on initialize', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
    
    it('should not double-initialize', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      bridge.initialize();
      
      // Should only attach listener once
      expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('shutdown', () => {
    it('should detach listeners on shutdown', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      bridge.shutdown();
      
      expect(bridge.isInitialized()).toBe(false);
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });
    
    it('should clear handlers on shutdown', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      bridge.onPageMessage(() => {});
      expect(bridge.getHandlerCounts().page).toBe(1);
      
      bridge.shutdown();
      expect(bridge.getHandlerCounts().page).toBe(0);
    });
  });
  
  describe('page messaging', () => {
    it('should send message to page', () => {
      const bridge = createContextBridge();
      
      bridge.sendToPage({
        type: 'REPLAY_AUTOCOMPLETE',
        payload: { test: true },
      });
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REPLAY_AUTOCOMPLETE',
          source: CONTENT_SCRIPT_SOURCE,
        }),
        '*'
      );
    });
    
    it('should register page message handler', () => {
      const bridge = createContextBridge();
      const handler = vi.fn();
      
      bridge.onPageMessage(handler);
      
      expect(bridge.getHandlerCounts().page).toBe(1);
    });
    
    it('should remove page message handler', () => {
      const bridge = createContextBridge();
      const handler = vi.fn();
      
      bridge.onPageMessage(handler);
      bridge.offPageMessage(handler);
      
      expect(bridge.getHandlerCounts().page).toBe(0);
    });
    
    it('should receive page messages from accepted sources', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      const handler = vi.fn();
      bridge.onPageMessage(handler);
      
      // Simulate message from page script
      const message: PageContextMessage = {
        type: 'AUTOCOMPLETE_INPUT',
        payload: { value: 'test' },
        source: PAGE_SCRIPT_SOURCE,
      };
      
      // Trigger the listener
      for (const listener of messageListeners) {
        listener({
          source: window,
          data: message,
        } as MessageEvent);
      }
      
      expect(handler).toHaveBeenCalledWith(message);
    });
    
    it('should ignore messages from unknown sources', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      const handler = vi.fn();
      bridge.onPageMessage(handler);
      
      // Message from unknown source
      const message: PageContextMessage = {
        type: 'AUTOCOMPLETE_INPUT',
        source: 'unknown-source',
      };
      
      for (const listener of messageListeners) {
        listener({
          source: window,
          data: message,
        } as MessageEvent);
      }
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should ignore own messages', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      const handler = vi.fn();
      bridge.onPageMessage(handler);
      
      // Message from self
      const message: PageContextMessage = {
        type: 'REPLAY_AUTOCOMPLETE',
        source: CONTENT_SCRIPT_SOURCE,
      };
      
      for (const listener of messageListeners) {
        listener({
          source: window,
          data: message,
        } as MessageEvent);
      }
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should ignore messages from other windows', () => {
      const bridge = createContextBridge();
      bridge.initialize();
      
      const handler = vi.fn();
      bridge.onPageMessage(handler);
      
      const message: PageContextMessage = {
        type: 'AUTOCOMPLETE_INPUT',
        source: PAGE_SCRIPT_SOURCE,
      };
      
      // Simulate message from different window
      for (const listener of messageListeners) {
        listener({
          source: {} as Window, // Different window
          data: message,
        } as MessageEvent);
      }
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('handler counts', () => {
    it('should track handler counts', () => {
      const bridge = createContextBridge();
      
      bridge.onPageMessage(() => {});
      bridge.onPageMessage(() => {});
      
      expect(bridge.getHandlerCounts()).toEqual({
        extension: 0,
        page: 2,
      });
    });
  });
});

// ============================================================================
// MOCK CONTEXT BRIDGE TESTS
// ============================================================================

describe('MockContextBridge', () => {
  let mockBridge: MockContextBridge;
  
  beforeEach(() => {
    mockBridge = createMockContextBridge();
  });
  
  describe('sendToExtension', () => {
    it('should record sent messages', async () => {
      const message: ContentToExtensionMessage = {
        type: 'logEvent',
        data: { eventType: 'click' },
      };
      
      await mockBridge.sendToExtension(message);
      
      expect(mockBridge.getSentExtensionMessages()).toContainEqual(message);
    });
    
    it('should return configured response', async () => {
      mockBridge.setExtensionResponse({ id: 123 });
      
      const response = await mockBridge.sendToExtension({
        type: 'content_script_ready',
      });
      
      expect(response).toEqual({ id: 123 });
    });
  });
  
  describe('sendToPage', () => {
    it('should record sent messages', () => {
      const message: PageContextMessage = {
        type: 'REPLAY_AUTOCOMPLETE',
        payload: { actions: [] },
      };
      
      mockBridge.sendToPage(message);
      
      expect(mockBridge.getSentPageMessages()).toContainEqual(message);
    });
  });
  
  describe('message handlers', () => {
    it('should register and call extension handlers', () => {
      const handler = vi.fn();
      mockBridge.onExtensionMessage(handler);
      
      const message: ExtensionToContentMessage = {
        action: 'start_recording',
      };
      
      mockBridge.simulateExtensionMessage(message);
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should register and call page handlers', () => {
      const handler = vi.fn();
      mockBridge.onPageMessage(handler);
      
      const message: PageContextMessage = {
        type: 'AUTOCOMPLETE_INPUT',
        payload: { value: 'test' },
      };
      
      mockBridge.simulatePageMessage(message);
      
      expect(handler).toHaveBeenCalledWith(message);
    });
    
    it('should remove handlers', () => {
      const handler = vi.fn();
      
      mockBridge.onPageMessage(handler);
      mockBridge.offPageMessage(handler);
      
      expect(mockBridge.getHandlerCounts().page).toBe(0);
    });
  });
  
  describe('script injection', () => {
    it('should record injected scripts', async () => {
      await mockBridge.injectPageScript('js/page-interceptor.js');
      
      expect(mockBridge.getInjectedScripts()).toContain('js/page-interceptor.js');
    });
    
    it('should return true for injection', async () => {
      const result = await mockBridge.injectPageScript('test.js');
      
      expect(result).toBe(true);
    });
  });
  
  describe('reset', () => {
    it('should clear all state', async () => {
      await mockBridge.sendToExtension({ type: 'logEvent' });
      mockBridge.sendToPage({ type: 'REPLAY_AUTOCOMPLETE' });
      mockBridge.onPageMessage(() => {});
      await mockBridge.injectPageScript('test.js');
      
      mockBridge.reset();
      
      expect(mockBridge.getSentExtensionMessages()).toHaveLength(0);
      expect(mockBridge.getSentPageMessages()).toHaveLength(0);
      expect(mockBridge.getInjectedScripts()).toHaveLength(0);
      expect(mockBridge.getHandlerCounts().page).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createContextBridge', () => {
    it('should create uninitialized bridge', () => {
      const bridge = createContextBridge();
      
      expect(bridge).toBeInstanceOf(ContextBridge);
      expect(bridge.isInitialized()).toBe(false);
    });
  });
  
  describe('createInitializedBridge', () => {
    it('should create initialized bridge', () => {
      const bridge = createInitializedBridge();
      
      expect(bridge.isInitialized()).toBe(true);
    });
  });
  
  describe('createDebugBridge', () => {
    it('should create bridge with debug enabled', () => {
      const bridge = createDebugBridge();
      
      expect(bridge.getConfig().debug).toBe(true);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetContextBridge();
  });
  
  describe('getContextBridge', () => {
    it('should return same instance', () => {
      const bridge1 = getContextBridge();
      const bridge2 = getContextBridge();
      
      expect(bridge1).toBe(bridge2);
    });
    
    it('should return initialized bridge', () => {
      const bridge = getContextBridge();
      
      expect(bridge.isInitialized()).toBe(true);
    });
  });
  
  describe('resetContextBridge', () => {
    it('should create new instance after reset', () => {
      const bridge1 = getContextBridge();
      resetContextBridge();
      const bridge2 = getContextBridge();
      
      expect(bridge1).not.toBe(bridge2);
    });
    
    it('should shutdown bridge on reset', () => {
      const bridge = getContextBridge();
      expect(bridge.isInitialized()).toBe(true);
      
      resetContextBridge();
      
      // Old bridge should be shutdown
      expect(bridge.isInitialized()).toBe(false);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_BRIDGE_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_BRIDGE_CONFIG.pageMessageSource).toBe(CONTENT_SCRIPT_SOURCE);
    expect(DEFAULT_BRIDGE_CONFIG.acceptedPageSources).toContain(PAGE_SCRIPT_SOURCE);
    expect(DEFAULT_BRIDGE_CONFIG.debug).toBe(false);
    expect(DEFAULT_BRIDGE_CONFIG.extensionMessageTimeout).toBe(30000);
  });
});
