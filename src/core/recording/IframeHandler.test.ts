/**
 * Tests for IframeHandler
 * @module core/recording/IframeHandler.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  IframeHandler,
  createIframeHandler,
  getIframeHandler,
  resetIframeHandler,
  getIframeChainForElement,
  isInIframe,
  getIframeDepth,
  serializeIframeChain,
  deserializeIframeChain,
  DEFAULT_IFRAME_CONFIG,
  type IframeInfo,
  type IframeEvent,
} from './IframeHandler';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a same-origin iframe
 */
function createIframe(id?: string, name?: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  if (id) iframe.id = id;
  if (name) iframe.name = name;
  iframe.src = 'about:blank';
  document.body.appendChild(iframe);
  return iframe;
}

/**
 * Wait for iframe to load
 */
async function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    if (iframe.contentDocument?.readyState === 'complete') {
      resolve();
    } else {
      iframe.addEventListener('load', () => resolve(), { once: true });
    }
  });
}

/**
 * Create element inside iframe
 */
function createElementInIframe(iframe: HTMLIFrameElement, tag: string = 'input'): Element {
  const doc = iframe.contentDocument!;
  const element = doc.createElement(tag);
  doc.body.appendChild(element);
  return element;
}

// ============================================================================
// TESTS
// ============================================================================

describe('IframeHandler', () => {
  let handler: IframeHandler;
  
  beforeEach(() => {
    resetIframeHandler();
    handler = new IframeHandler();
  });
  
  afterEach(() => {
    handler.stop();
    document.body.innerHTML = '';
    resetIframeHandler();
  });
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  describe('lifecycle', () => {
    it('should start inactive', () => {
      expect(handler.getIsActive()).toBe(false);
    });
    
    it('should become active after start', () => {
      handler.start();
      expect(handler.getIsActive()).toBe(true);
    });
    
    it('should become inactive after stop', () => {
      handler.start();
      handler.stop();
      expect(handler.getIsActive()).toBe(false);
    });
  });
  
  // ==========================================================================
  // ATTACHMENT
  // ==========================================================================
  
  describe('attachment', () => {
    it('should attach to same-origin iframe', async () => {
      const iframe = createIframe('test-frame');
      await waitForIframeLoad(iframe);
      
      const result = handler.attachToIframe(iframe);
      
      expect(result).toBe('attached');
      expect(handler.isAttached(iframe)).toBe(true);
    });
    
    it('should not attach twice', async () => {
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      
      handler.attachToIframe(iframe);
      const result = handler.attachToIframe(iframe);
      
      expect(result).toBe('already-attached');
    });
    
    it('should return attachment results', async () => {
      const iframe1 = createIframe();
      const iframe2 = createIframe();
      await waitForIframeLoad(iframe1);
      await waitForIframeLoad(iframe2);
      
      const result = handler.attachToAllIframes(window);
      
      expect(result.total).toBe(2);
      expect(result.attached).toBe(2);
      expect(result.crossOrigin).toBe(0);
      expect(result.success).toBe(true);
    });
  });
  
  // ==========================================================================
  // CALLBACKS
  // ==========================================================================
  
  describe('callbacks', () => {
    it('should call attach callback', async () => {
      const callback = vi.fn();
      handler.onAttach(callback);
      
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      handler.attachToIframe(iframe);
      
      expect(callback).toHaveBeenCalledWith(
        iframe.contentDocument,
        iframe
      );
    });
    
    it('should call detach callback', async () => {
      const callback = vi.fn();
      handler.onDetach(callback);
      
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      handler.attachToIframe(iframe);
      handler.detachFromIframe(iframe);
      
      expect(callback).toHaveBeenCalled();
    });
    
    it('should allow unsubscribing callbacks', async () => {
      const callback = vi.fn();
      const unsubscribe = handler.onAttach(callback);
      
      unsubscribe();
      
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      handler.attachToIframe(iframe);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  describe('events', () => {
    it('should emit attached event', async () => {
      const events: IframeEvent[] = [];
      handler.addEventListener((event) => events.push(event));
      
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      handler.attachToIframe(iframe);
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('attached');
      expect(events[0].iframe).toBe(iframe);
    });
    
    it('should emit detached event', async () => {
      const events: IframeEvent[] = [];
      handler.addEventListener((event) => events.push(event));
      
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      handler.attachToIframe(iframe);
      handler.detachFromIframe(iframe);
      
      const detachedEvent = events.find(e => e.type === 'detached');
      expect(detachedEvent).toBeDefined();
      expect(detachedEvent?.iframe).toBe(iframe);
    });
  });
  
  // ==========================================================================
  // IFRAME CHAIN
  // ==========================================================================
  
  describe('iframe chain', () => {
    it('should return empty chain for main document element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const chain = handler.getIframeChain(element);
      
      expect(chain).toEqual([]);
    });
    
    it('should return chain for element in iframe', async () => {
      const iframe = createIframe('test-frame', 'test');
      await waitForIframeLoad(iframe);
      
      const element = createElementInIframe(iframe, 'input');
      const chain = handler.getIframeChain(element);
      
      expect(chain.length).toBe(1);
      expect(chain[0].id).toBe('test-frame');
      expect(chain[0].name).toBe('test');
    });
    
    it('should include iframe index in chain', async () => {
      createIframe(); // index 0
      const iframe2 = createIframe(); // index 1
      await waitForIframeLoad(iframe2);
      
      const element = createElementInIframe(iframe2, 'button');
      const chain = handler.getIframeChain(element);
      
      expect(chain[0].index).toBe(1);
    });
  });
  
  // ==========================================================================
  // IFRAME INFO
  // ==========================================================================
  
  describe('iframe info', () => {
    it('should extract iframe info', async () => {
      const iframe = createIframe('my-id', 'my-name');
      iframe.src = 'about:blank';
      await waitForIframeLoad(iframe);
      
      const info = handler.getIframeInfo(iframe);
      
      expect(info.id).toBe('my-id');
      expect(info.name).toBe('my-name');
      expect(info.index).toBe(0);
      expect(info.xpath).toContain('iframe');
    });
  });
  
  // ==========================================================================
  // CHAIN RESOLUTION
  // ==========================================================================
  
  describe('chain resolution', () => {
    it('should resolve iframe chain by index', async () => {
      const iframe = createIframe('test');
      await waitForIframeLoad(iframe);
      
      const chain: IframeInfo[] = [{ index: 0, id: 'test' }];
      const doc = handler.resolveIframeChain(chain);
      
      expect(doc).toBe(iframe.contentDocument);
    });
    
    it('should resolve by id fallback', async () => {
      const iframe = createIframe('fallback-id');
      await waitForIframeLoad(iframe);
      
      const chain: IframeInfo[] = [{ index: 999, id: 'fallback-id' }];
      const doc = handler.resolveIframeChain(chain);
      
      expect(doc).toBe(iframe.contentDocument);
    });
    
    it('should return null for invalid chain', () => {
      const chain: IframeInfo[] = [{ index: 999 }];
      const doc = handler.resolveIframeChain(chain);
      
      expect(doc).toBeNull();
    });
  });
  
  // ==========================================================================
  // SAME ORIGIN CHECK
  // ==========================================================================
  
  describe('same origin check', () => {
    it('should identify same-origin iframe', async () => {
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      
      expect(handler.isSameOrigin(iframe)).toBe(true);
    });
  });
  
  // ==========================================================================
  // MUTATION OBSERVER
  // ==========================================================================
  
  describe('mutation observer', () => {
    it('should start observing on start', () => {
      handler.start();
      
      // Observer should be created
      expect(handler.getIsActive()).toBe(true);
    });
    
    it('should stop observing on stop', () => {
      handler.start();
      handler.stop();
      
      expect(handler.getIsActive()).toBe(false);
    });
    
    it('should attach to dynamically added iframe', async () => {
      const callback = vi.fn();
      handler.onAttach(callback);
      handler.start();
      
      // Add iframe dynamically
      const iframe = createIframe();
      await waitForIframeLoad(iframe);
      
      // Wait for mutation observer
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).toHaveBeenCalled();
    });
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should respect maxDepth', async () => {
      const limitedHandler = new IframeHandler({ maxDepth: 1 });
      
      const iframe1 = createIframe();
      await waitForIframeLoad(iframe1);
      
      // Create nested iframe
      const nestedIframe = iframe1.contentDocument!.createElement('iframe');
      nestedIframe.src = 'about:blank';
      iframe1.contentDocument!.body.appendChild(nestedIframe);
      await waitForIframeLoad(nestedIframe);
      
      limitedHandler.attachToAllIframes(window, 0);
      
      // First level should be attached
      expect(limitedHandler.isAttached(iframe1)).toBe(true);
      
      limitedHandler.stop();
    });
    
    it('should use default config values', () => {
      expect(DEFAULT_IFRAME_CONFIG.observeDynamic).toBe(true);
      expect(DEFAULT_IFRAME_CONFIG.maxDepth).toBe(10);
      expect(DEFAULT_IFRAME_CONFIG.retryDelay).toBe(100);
      expect(DEFAULT_IFRAME_CONFIG.maxRetries).toBe(3);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createIframeHandler', () => {
  afterEach(() => {
    resetIframeHandler();
    document.body.innerHTML = '';
  });
  
  it('should create handler with config', () => {
    const handler = createIframeHandler({ maxDepth: 5 });
    expect(handler).toBeInstanceOf(IframeHandler);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  afterEach(() => {
    resetIframeHandler();
    document.body.innerHTML = '';
  });
  
  it('should return same instance', () => {
    const handler1 = getIframeHandler();
    const handler2 = getIframeHandler();
    
    expect(handler1).toBe(handler2);
  });
  
  it('should reset instance', () => {
    const handler1 = getIframeHandler();
    resetIframeHandler();
    const handler2 = getIframeHandler();
    
    expect(handler1).not.toBe(handler2);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  afterEach(() => {
    resetIframeHandler();
    document.body.innerHTML = '';
  });
  
  describe('isInIframe', () => {
    it('should return false for main document element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      expect(isInIframe(element)).toBe(false);
    });
  });
  
  describe('getIframeDepth', () => {
    it('should return 0 for main document', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      expect(getIframeDepth(element)).toBe(0);
    });
  });
  
  describe('serializeIframeChain', () => {
    it('should serialize chain to JSON', () => {
      const chain: IframeInfo[] = [
        { index: 0, id: 'frame1' },
        { index: 1, id: 'frame2' },
      ];
      
      const json = serializeIframeChain(chain);
      
      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(chain);
    });
  });
  
  describe('deserializeIframeChain', () => {
    it('should deserialize valid JSON', () => {
      const chain: IframeInfo[] = [{ index: 0, id: 'test' }];
      const json = JSON.stringify(chain);
      
      const result = deserializeIframeChain(json);
      
      expect(result).toEqual(chain);
    });
    
    it('should return empty array for invalid JSON', () => {
      const result = deserializeIframeChain('invalid');
      
      expect(result).toEqual([]);
    });
  });
});
