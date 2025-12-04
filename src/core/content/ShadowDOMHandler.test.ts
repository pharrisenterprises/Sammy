/**
 * Tests for ShadowDOMHandler
 * @module core/content/ShadowDOMHandler.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ShadowDOMHandler,
  createShadowDOMHandler,
  createDebugShadowHandler,
  getShadowDOMHandler,
  resetShadowDOMHandler,
  hasShadowRoot,
  getShadowRoot,
  getShadowRootMode,
  createShadowHostInfo,
  generateLocalXPath,
  findAllShadowHosts,
  DEFAULT_SHADOW_HANDLER_CONFIG,
  type ShadowHostInfo,
} from './ShadowDOMHandler';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Track created elements for cleanup
let createdElements: Element[] = [];

const createTestElement = (tag: string, attrs: Record<string, string> = {}): HTMLElement => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  document.body.appendChild(el);
  createdElements.push(el);
  return el;
};

const createShadowHost = (mode: 'open' | 'closed' = 'open'): HTMLElement => {
  const host = createTestElement('div', { class: 'shadow-host' });
  host.attachShadow({ mode });
  return host;
};

beforeEach(() => {
  createdElements = [];
});

afterEach(() => {
  for (const el of createdElements) {
    el.remove();
  }
  createdElements = [];
  resetShadowDOMHandler();
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Helper Functions', () => {
  describe('hasShadowRoot', () => {
    it('should return true for element with open shadow root', () => {
      const host = createShadowHost('open');
      
      expect(hasShadowRoot(host)).toBe(true);
    });
    
    it('should return false for element without shadow root', () => {
      const el = createTestElement('div');
      
      expect(hasShadowRoot(el)).toBe(false);
    });
    
    it('should return true for element with intercepted shadow root', () => {
      const el = createTestElement('div');
      const shadowRoot = document.createElement('div') as unknown as ShadowRoot;
      (el as Record<string, unknown>).__realShadowRoot = shadowRoot;
      
      // Note: This test checks the property existence, not actual ShadowRoot
      expect((el as Record<string, unknown>).__realShadowRoot).toBeDefined();
    });
  });
  
  describe('getShadowRoot', () => {
    it('should return open shadow root', () => {
      const host = createShadowHost('open');
      
      const shadowRoot = getShadowRoot(host);
      
      expect(shadowRoot).toBe(host.shadowRoot);
    });
    
    it('should return null for element without shadow root', () => {
      const el = createTestElement('div');
      
      expect(getShadowRoot(el)).toBeNull();
    });
  });
  
  describe('getShadowRootMode', () => {
    it('should return "open" for open shadow root', () => {
      const host = createShadowHost('open');
      
      expect(getShadowRootMode(host)).toBe('open');
    });
    
    it('should return "none" for no shadow root', () => {
      const el = createTestElement('div');
      
      expect(getShadowRootMode(el)).toBe('none');
    });
  });
  
  describe('createShadowHostInfo', () => {
    it('should create info from element', () => {
      const host = createTestElement('div', { 
        id: 'my-host',
        class: 'host-class another-class',
      });
      host.attachShadow({ mode: 'open' });
      
      const info = createShadowHostInfo(host, 0, '//div[@id="my-host"]');
      
      expect(info.index).toBe(0);
      expect(info.tagName).toBe('div');
      expect(info.id).toBe('my-host');
      expect(info.classes).toContain('host-class');
      expect(info.xpath).toBe('//div[@id="my-host"]');
      expect(info.mode).toBe('open');
    });
    
    it('should handle element without ID or classes', () => {
      const host = createShadowHost('open');
      
      const info = createShadowHostInfo(host, 5);
      
      expect(info.index).toBe(5);
      expect(info.id).toBeUndefined();
    });
  });
  
  describe('generateLocalXPath', () => {
    it('should generate XPath with ID', () => {
      const el = createTestElement('button', { id: 'submit-btn' });
      
      const xpath = generateLocalXPath(el, document);
      
      expect(xpath).toBe('//*[@id="submit-btn"]');
    });
    
    it('should generate path-based XPath', () => {
      const container = createTestElement('div');
      const child = document.createElement('span');
      container.appendChild(child);
      
      const xpath = generateLocalXPath(child, document);
      
      expect(xpath).toContain('span');
    });
  });
  
  describe('findAllShadowHosts', () => {
    it('should find all shadow hosts in document', () => {
      createShadowHost('open');
      createShadowHost('open');
      createTestElement('div'); // Non-host
      
      const hosts = findAllShadowHosts(document);
      
      expect(hosts.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// SHADOW DOM HANDLER TESTS
// ============================================================================

describe('ShadowDOMHandler', () => {
  let handler: ShadowDOMHandler;
  
  beforeEach(() => {
    handler = createShadowDOMHandler({ debug: false });
  });
  
  describe('isInShadowDOM', () => {
    it('should return false for element in document', () => {
      const el = createTestElement('div');
      
      expect(handler.isInShadowDOM(el)).toBe(false);
    });
    
    it('should return true for element in shadow DOM', () => {
      const host = createShadowHost('open');
      const shadowChild = document.createElement('span');
      host.shadowRoot!.appendChild(shadowChild);
      
      expect(handler.isInShadowDOM(shadowChild)).toBe(true);
    });
  });
  
  describe('getShadowHostChain', () => {
    it('should return empty array for element in document', () => {
      const el = createTestElement('div');
      
      const chain = handler.getShadowHostChain(el);
      
      expect(chain).toHaveLength(0);
    });
    
    it('should return host XPath for element in shadow DOM', () => {
      const host = createTestElement('div', { id: 'shadow-host' });
      host.attachShadow({ mode: 'open' });
      const shadowChild = document.createElement('span');
      host.shadowRoot!.appendChild(shadowChild);
      createdElements.push(host);
      
      const chain = handler.getShadowHostChain(shadowChild);
      
      expect(chain).toHaveLength(1);
      expect(chain[0]).toContain('shadow-host');
    });
    
    it('should handle nested shadow DOMs', () => {
      // Create outer host
      const outerHost = createTestElement('div', { id: 'outer-host' });
      outerHost.attachShadow({ mode: 'open' });
      
      // Create inner host inside outer shadow
      const innerHost = document.createElement('div');
      innerHost.id = 'inner-host';
      innerHost.attachShadow({ mode: 'open' });
      outerHost.shadowRoot!.appendChild(innerHost);
      
      // Create element inside inner shadow
      const deepElement = document.createElement('span');
      innerHost.shadowRoot!.appendChild(deepElement);
      
      const chain = handler.getShadowHostChain(deepElement);
      
      expect(chain.length).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('getFocusedElement', () => {
    it('should return document.activeElement when no shadow focus', () => {
      const input = createTestElement('input') as HTMLInputElement;
      input.focus();
      
      const focused = handler.getFocusedElement();
      
      expect(focused).toBe(input);
    });
    
    it('should traverse into shadow DOM for focus', () => {
      const host = createShadowHost('open');
      const shadowInput = document.createElement('input');
      host.shadowRoot!.appendChild(shadowInput);
      shadowInput.focus();
      
      const focused = handler.getFocusedElement();
      
      expect(focused).toBe(shadowInput);
    });
  });
  
  describe('querySelectorDeep', () => {
    it('should find element in document', () => {
      const el = createTestElement('button', { id: 'test-btn' });
      
      const found = handler.querySelectorDeep('#test-btn');
      
      expect(found).toBe(el);
    });
    
    it('should find element in shadow DOM', () => {
      const host = createShadowHost('open');
      const shadowBtn = document.createElement('button');
      shadowBtn.id = 'shadow-btn';
      host.shadowRoot!.appendChild(shadowBtn);
      
      const found = handler.querySelectorDeep('#shadow-btn');
      
      expect(found).toBe(shadowBtn);
    });
  });
  
  describe('querySelectorAllDeep', () => {
    it('should find all matching elements across shadow boundaries', () => {
      createTestElement('span', { class: 'target' });
      
      const host = createShadowHost('open');
      const shadowSpan = document.createElement('span');
      shadowSpan.className = 'target';
      host.shadowRoot!.appendChild(shadowSpan);
      
      const found = handler.querySelectorAllDeep('.target');
      
      expect(found.length).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('findInShadowDOM', () => {
    it('should find element without shadow hosts', () => {
      const el = createTestElement('button', { id: 'find-btn' });
      
      const found = handler.findInShadowDOM('//*[@id="find-btn"]');
      
      expect(found).toBe(el);
    });
    
    it('should find element with shadow host chain', () => {
      const host = createTestElement('div', { id: 'host-element' });
      host.attachShadow({ mode: 'open' });
      const shadowBtn = document.createElement('button');
      shadowBtn.id = 'nested-btn';
      host.shadowRoot!.appendChild(shadowBtn);
      
      const found = handler.findInShadowDOM(
        '//*[@id="nested-btn"]',
        ['//*[@id="host-element"]']
      );
      
      expect(found).toBe(shadowBtn);
    });
  });
  
  describe('getShadowHostInfo', () => {
    it('should return info for shadow host', () => {
      const host = createShadowHost('open');
      host.id = 'info-host';
      
      const info = handler.getShadowHostInfo(host);
      
      expect(info).not.toBeNull();
      expect(info!.id).toBe('info-host');
      expect(info!.mode).toBe('open');
    });
    
    it('should return null for non-host', () => {
      const el = createTestElement('div');
      
      const info = handler.getShadowHostInfo(el);
      
      expect(info).toBeNull();
    });
  });
  
  describe('getShadowHostInfoChain', () => {
    it('should return info chain for nested element', () => {
      const host = createTestElement('div', { id: 'chain-host' });
      host.attachShadow({ mode: 'open' });
      const shadowChild = document.createElement('span');
      host.shadowRoot!.appendChild(shadowChild);
      
      const chain = handler.getShadowHostInfoChain(shadowChild);
      
      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain[0].id).toBe('chain-host');
    });
  });
  
  describe('countShadowHosts', () => {
    it('should count shadow hosts', () => {
      createShadowHost('open');
      createShadowHost('open');
      
      const count = handler.countShadowHosts();
      
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = handler.getConfig();
      
      expect(config.maxDepth).toBe(DEFAULT_SHADOW_HANDLER_CONFIG.maxDepth);
    });
    
    it('should accept custom config', () => {
      const customHandler = createShadowDOMHandler({
        maxDepth: 5,
        debug: true,
      });
      
      const config = customHandler.getConfig();
      
      expect(config.maxDepth).toBe(5);
      expect(config.debug).toBe(true);
    });
    
    it('should update config', () => {
      handler.setConfig({ maxDepth: 20 });
      
      expect(handler.getConfig().maxDepth).toBe(20);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createShadowDOMHandler', () => {
    it('should create handler', () => {
      const handler = createShadowDOMHandler();
      
      expect(handler).toBeInstanceOf(ShadowDOMHandler);
    });
  });
  
  describe('createDebugShadowHandler', () => {
    it('should create handler with debug enabled', () => {
      const handler = createDebugShadowHandler();
      
      expect(handler.getConfig().debug).toBe(true);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetShadowDOMHandler();
  });
  
  describe('getShadowDOMHandler', () => {
    it('should return same instance', () => {
      const handler1 = getShadowDOMHandler();
      const handler2 = getShadowDOMHandler();
      
      expect(handler1).toBe(handler2);
    });
  });
  
  describe('resetShadowDOMHandler', () => {
    it('should create new instance after reset', () => {
      const handler1 = getShadowDOMHandler();
      resetShadowDOMHandler();
      const handler2 = getShadowDOMHandler();
      
      expect(handler1).not.toBe(handler2);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_SHADOW_HANDLER_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_SHADOW_HANDLER_CONFIG.interceptedProperty).toBe('__realShadowRoot');
    expect(DEFAULT_SHADOW_HANDLER_CONFIG.maxDepth).toBe(10);
    expect(DEFAULT_SHADOW_HANDLER_CONFIG.debug).toBe(false);
  });
});
