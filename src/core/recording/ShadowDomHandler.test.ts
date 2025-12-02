/**
 * Tests for ShadowDomHandler
 * @module core/recording/ShadowDomHandler.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ShadowDomHandler,
  createShadowDomHandler,
  getShadowDomHandler,
  resetShadowDomHandler,
  getShadowHostChainForElement,
  isElementInShadowDom,
  getShadowDepth,
  deepQuerySelector,
  getRealTarget,
  serializeShadowHostChain,
  deserializeShadowHostChain,
  DEFAULT_SHADOW_CONFIG,
  type ShadowHostInfo,
  type ShadowEvent,
  type ElementWithShadow,
} from './ShadowDomHandler';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a custom element with open shadow DOM
 */
function createOpenShadowHost(id?: string): HTMLElement {
  const host = document.createElement('div');
  if (id) host.id = id;
  host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);
  return host;
}

/**
 * Create element inside shadow DOM
 */
function createElementInShadow(host: HTMLElement, tag: string = 'input'): Element {
  const shadowRoot = host.shadowRoot!;
  const element = document.createElement(tag);
  shadowRoot.appendChild(element);
  return element;
}

/**
 * Create nested shadow DOM structure
 */
function createNestedShadowDom(): { outer: HTMLElement; inner: HTMLElement; deepElement: Element } {
  const outer = document.createElement('div');
  outer.id = 'outer-host';
  outer.attachShadow({ mode: 'open' });
  document.body.appendChild(outer);
  
  const inner = document.createElement('div');
  inner.id = 'inner-host';
  inner.attachShadow({ mode: 'open' });
  outer.shadowRoot!.appendChild(inner);
  
  const deepElement = document.createElement('button');
  deepElement.id = 'deep-button';
  inner.shadowRoot!.appendChild(deepElement);
  
  return { outer, inner, deepElement };
}

/**
 * Simulate closed shadow root with __realShadowRoot
 */
function createExposedClosedShadowHost(): ElementWithShadow {
  const host = document.createElement('div') as ElementWithShadow;
  host.id = 'closed-host';
  
  // Simulate what page-interceptor does
  const fakeShadowRoot = document.createElement('div') as unknown as ShadowRoot;
  (fakeShadowRoot as any).mode = 'closed';
  (fakeShadowRoot as any).host = host;
  
  host.__realShadowRoot = fakeShadowRoot;
  document.body.appendChild(host);
  
  return host;
}

// ============================================================================
// TESTS
// ============================================================================

describe('ShadowDomHandler', () => {
  let handler: ShadowDomHandler;
  
  beforeEach(() => {
    resetShadowDomHandler();
    handler = new ShadowDomHandler();
  });
  
  afterEach(() => {
    handler.stop();
    document.body.innerHTML = '';
    resetShadowDomHandler();
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
  // SHADOW ROOT ATTACHMENT
  // ==========================================================================
  
  describe('attachment', () => {
    it('should attach to open shadow root', () => {
      const host = createOpenShadowHost('test-host');
      
      const result = handler.attachToShadowRoot(host, host.shadowRoot!);
      
      expect(result).toBe(true);
    });
    
    it('should not attach twice', () => {
      const host = createOpenShadowHost();
      
      handler.attachToShadowRoot(host, host.shadowRoot!);
      const result = handler.attachToShadowRoot(host, host.shadowRoot!);
      
      expect(result).toBe(false);
    });
    
    it('should call attach callback', () => {
      const callback = vi.fn();
      handler.onAttach(callback);
      
      const host = createOpenShadowHost();
      handler.attachToShadowRoot(host, host.shadowRoot!);
      
      expect(callback).toHaveBeenCalledWith(host.shadowRoot, host);
    });
    
    it('should emit attached event', () => {
      const events: ShadowEvent[] = [];
      handler.addEventListener((event) => events.push(event));
      
      const host = createOpenShadowHost();
      handler.attachToShadowRoot(host, host.shadowRoot!);
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('attached');
      expect(events[0].host).toBe(host);
    });
  });
  
  // ==========================================================================
  // DETACHMENT
  // ==========================================================================
  
  describe('detachment', () => {
    it('should detach from shadow root', () => {
      const host = createOpenShadowHost();
      handler.attachToShadowRoot(host, host.shadowRoot!);
      
      const result = handler.detachFromShadowRoot(host);
      
      expect(result).toBe(true);
    });
    
    it('should return false for unattached', () => {
      const host = createOpenShadowHost();
      
      const result = handler.detachFromShadowRoot(host);
      
      expect(result).toBe(false);
    });
    
    it('should call detach callback', () => {
      const callback = vi.fn();
      handler.onDetach(callback);
      
      const host = createOpenShadowHost();
      handler.attachToShadowRoot(host, host.shadowRoot!);
      handler.detachFromShadowRoot(host);
      
      expect(callback).toHaveBeenCalled();
    });
  });
  
  // ==========================================================================
  // SHADOW ROOT ACCESS
  // ==========================================================================
  
  describe('getShadowRoot', () => {
    it('should get open shadow root', () => {
      const host = createOpenShadowHost();
      
      const shadowRoot = handler.getShadowRoot(host);
      
      expect(shadowRoot).toBe(host.shadowRoot);
    });
    
    it('should get exposed closed shadow root', () => {
      const host = createExposedClosedShadowHost();
      
      const shadowRoot = handler.getShadowRoot(host);
      
      expect(shadowRoot).toBe(host.__realShadowRoot);
    });
    
    it('should return null for no shadow root', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const shadowRoot = handler.getShadowRoot(element);
      
      expect(shadowRoot).toBeNull();
    });
  });
  
  // ==========================================================================
  // SHADOW HOST CHAIN
  // ==========================================================================
  
  describe('shadow host chain', () => {
    it('should return empty chain for light DOM element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const chain = handler.getShadowHostChain(element);
      
      expect(chain).toEqual([]);
    });
    
    it('should return chain for element in shadow DOM', () => {
      const host = createOpenShadowHost('test-host');
      const element = createElementInShadow(host, 'input');
      
      const chain = handler.getShadowHostChain(element);
      
      expect(chain.length).toBe(1);
      expect(chain[0]).toContain('div');
    });
    
    it('should return chain for nested shadow DOM', () => {
      const { deepElement } = createNestedShadowDom();
      
      const chain = handler.getShadowHostChain(deepElement);
      
      expect(chain.length).toBe(2);
    });
  });
  
  // ==========================================================================
  // DETAILED HOST INFO
  // ==========================================================================
  
  describe('getShadowHostInfoChain', () => {
    it('should include detailed info', () => {
      const host = createOpenShadowHost('my-host');
      const element = createElementInShadow(host);
      
      const chain = handler.getShadowHostInfoChain(element);
      
      expect(chain.length).toBe(1);
      expect(chain[0].id).toBe('my-host');
      expect(chain[0].tagName).toBe('div');
      expect(chain[0].isClosed).toBe(false);
    });
  });
  
  // ==========================================================================
  // ELEMENT FINDING
  // ==========================================================================
  
  describe('findElementInShadow', () => {
    it('should find element in shadow DOM', () => {
      const host = createOpenShadowHost();
      const input = createElementInShadow(host, 'input');
      (input as HTMLInputElement).id = 'shadow-input';
      
      const found = handler.findElementInShadow(host, '#shadow-input');
      
      expect(found).toBe(input);
    });
    
    it('should return null for no shadow root', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const found = handler.findElementInShadow(element, 'input');
      
      expect(found).toBeNull();
    });
  });
  
  describe('findAllElementsInShadow', () => {
    it('should find all matching elements', () => {
      const host = createOpenShadowHost();
      createElementInShadow(host, 'button');
      createElementInShadow(host, 'button');
      
      const found = handler.findAllElementsInShadow(host, 'button');
      
      expect(found.length).toBe(2);
    });
  });
  
  describe('deepQuerySelector', () => {
    it('should find element in light DOM', () => {
      const element = document.createElement('div');
      element.id = 'light-element';
      document.body.appendChild(element);
      
      const found = handler.deepQuerySelector('#light-element');
      
      expect(found).toBe(element);
    });
    
    it('should find element in shadow DOM', () => {
      const host = createOpenShadowHost();
      const input = createElementInShadow(host, 'input');
      (input as HTMLInputElement).className = 'shadow-input';
      
      handler.start();
      const found = handler.deepQuerySelector('.shadow-input');
      
      expect(found).toBe(input);
    });
  });
  
  // ==========================================================================
  // SHADOW BOUNDARY CHECKS
  // ==========================================================================
  
  describe('isInShadowDom', () => {
    it('should return false for light DOM', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      expect(handler.isInShadowDom(element)).toBe(false);
    });
    
    it('should return true for shadow DOM', () => {
      const host = createOpenShadowHost();
      const element = createElementInShadow(host);
      
      expect(handler.isInShadowDom(element)).toBe(true);
    });
  });
  
  describe('getContainingShadowRoot', () => {
    it('should return shadow root for element in shadow', () => {
      const host = createOpenShadowHost();
      const element = createElementInShadow(host);
      
      const shadowRoot = handler.getContainingShadowRoot(element);
      
      expect(shadowRoot).toBe(host.shadowRoot);
    });
    
    it('should return null for light DOM element', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const shadowRoot = handler.getContainingShadowRoot(element);
      
      expect(shadowRoot).toBeNull();
    });
  });
  
  describe('getLightDomAncestor', () => {
    it('should return element itself for light DOM', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const ancestor = handler.getLightDomAncestor(element);
      
      expect(ancestor).toBe(element);
    });
    
    it('should return shadow host for element in shadow', () => {
      const host = createOpenShadowHost();
      const element = createElementInShadow(host);
      
      const ancestor = handler.getLightDomAncestor(element);
      
      expect(ancestor).toBe(host);
    });
    
    it('should traverse multiple shadow boundaries', () => {
      const { outer, deepElement } = createNestedShadowDom();
      
      const ancestor = handler.getLightDomAncestor(deepElement);
      
      expect(ancestor).toBe(outer);
    });
  });
  
  // ==========================================================================
  // SPECIAL ELEMENTS
  // ==========================================================================
  
  describe('special elements', () => {
    it('should identify special elements', () => {
      const element = document.createElement('gmp-place-autocomplete');
      
      expect(handler.isSpecialElement(element)).toBe(true);
    });
    
    it('should not identify regular elements as special', () => {
      const element = document.createElement('div');
      
      expect(handler.isSpecialElement(element)).toBe(false);
    });
    
    it('should get special element type', () => {
      const element = document.createElement('gmp-place-autocomplete');
      
      expect(handler.getSpecialElementType(element)).toBe('gmp-place-autocomplete');
    });
  });
  
  // ==========================================================================
  // EVENT TARGET
  // ==========================================================================
  
  describe('getRealEventTarget', () => {
    it('should get target from composedPath', () => {
      const host = createOpenShadowHost();
      const button = createElementInShadow(host, 'button');
      
      const event = new MouseEvent('click', { bubbles: true, composed: true });
      Object.defineProperty(event, 'composedPath', {
        value: () => [button, host.shadowRoot, host, document.body, document, window],
      });
      
      const target = handler.getRealEventTarget(event);
      
      expect(target).toBe(button);
    });
  });
  
  // ==========================================================================
  // ACCESSIBILITY CHECK
  // ==========================================================================
  
  describe('isAccessible', () => {
    it('should return true for open shadow root', () => {
      const host = createOpenShadowHost();
      
      expect(handler.isAccessible(host)).toBe(true);
    });
    
    it('should return true for exposed closed root', () => {
      const host = createExposedClosedShadowHost();
      
      expect(handler.isAccessible(host)).toBe(true);
    });
    
    it('should return false for no shadow root', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      expect(handler.isAccessible(element)).toBe(false);
    });
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default config', () => {
      expect(DEFAULT_SHADOW_CONFIG.observeDynamic).toBe(true);
      expect(DEFAULT_SHADOW_CONFIG.accessClosedRoots).toBe(true);
      expect(DEFAULT_SHADOW_CONFIG.maxDepth).toBe(10);
    });
    
    it('should respect custom config', () => {
      const customHandler = new ShadowDomHandler({
        accessClosedRoots: false,
      });
      
      const host = createExposedClosedShadowHost();
      const shadowRoot = customHandler.getShadowRoot(host);
      
      // Should not access __realShadowRoot when disabled
      expect(shadowRoot).toBeNull();
      
      customHandler.stop();
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createShadowDomHandler', () => {
  afterEach(() => {
    resetShadowDomHandler();
    document.body.innerHTML = '';
  });
  
  it('should create handler with config', () => {
    const handler = createShadowDomHandler({ maxDepth: 5 });
    expect(handler).toBeInstanceOf(ShadowDomHandler);
    handler.stop();
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  afterEach(() => {
    resetShadowDomHandler();
    document.body.innerHTML = '';
  });
  
  it('should return same instance', () => {
    const handler1 = getShadowDomHandler();
    const handler2 = getShadowDomHandler();
    
    expect(handler1).toBe(handler2);
  });
  
  it('should reset instance', () => {
    const handler1 = getShadowDomHandler();
    resetShadowDomHandler();
    const handler2 = getShadowDomHandler();
    
    expect(handler1).not.toBe(handler2);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  afterEach(() => {
    resetShadowDomHandler();
    document.body.innerHTML = '';
  });
  
  describe('isElementInShadowDom', () => {
    it('should check if element is in shadow DOM', () => {
      const host = document.createElement('div');
      host.attachShadow({ mode: 'open' });
      document.body.appendChild(host);
      
      const element = document.createElement('span');
      host.shadowRoot!.appendChild(element);
      
      expect(isElementInShadowDom(element)).toBe(true);
    });
  });
  
  describe('getShadowDepth', () => {
    it('should return 0 for light DOM', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      expect(getShadowDepth(element)).toBe(0);
    });
  });
  
  describe('serializeShadowHostChain', () => {
    it('should serialize to JSON', () => {
      const chain: ShadowHostInfo[] = [
        { xpath: '/html/body/div', tagName: 'div', isClosed: false },
      ];
      
      const json = serializeShadowHostChain(chain);
      
      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(chain);
    });
  });
  
  describe('deserializeShadowHostChain', () => {
    it('should deserialize valid JSON', () => {
      const chain: ShadowHostInfo[] = [
        { xpath: '/html/body/div', tagName: 'div', isClosed: false },
      ];
      
      const result = deserializeShadowHostChain(JSON.stringify(chain));
      
      expect(result).toEqual(chain);
    });
    
    it('should return empty array for invalid JSON', () => {
      expect(deserializeShadowHostChain('invalid')).toEqual([]);
    });
  });
});
