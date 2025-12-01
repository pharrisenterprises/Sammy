/**
 * Tests for EventListenerManager
 * @module core/recording/EventListenerManager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EventListenerManager,
  createEventListenerManager,
  isInShadowDOM,
  getShadowRootOf,
  getShadowHostChain,
  getEventPath,
  DEFAULT_LISTENER_CONFIG,
} from './EventListenerManager';

// ============================================================================
// BASIC FUNCTIONALITY TESTS
// ============================================================================

describe('EventListenerManager', () => {
  let manager: EventListenerManager;
  
  beforeEach(() => {
    manager = new EventListenerManager();
  });
  
  afterEach(() => {
    manager.dispose();
  });
  
  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = manager.getConfig();
      
      expect(config.eventTypes).toEqual(DEFAULT_LISTENER_CONFIG.eventTypes);
      expect(config.includeIframes).toBe(true);
      expect(config.includeShadowDOM).toBe(true);
    });
    
    it('should accept custom config', () => {
      const custom = new EventListenerManager({
        eventTypes: ['click'],
        includeIframes: false,
        maxIframeDepth: 3,
      });
      
      const config = custom.getConfig();
      
      expect(config.eventTypes).toEqual(['click']);
      expect(config.includeIframes).toBe(false);
      expect(config.maxIframeDepth).toBe(3);
      
      custom.dispose();
    });
    
    it('should not be attached initially', () => {
      expect(manager.isCurrentlyAttached()).toBe(false);
    });
  });
  
  describe('configuration', () => {
    it('should update config', () => {
      manager.updateConfig({ includeIframes: false });
      
      expect(manager.getConfig().includeIframes).toBe(false);
    });
    
    it('should preserve other config values on update', () => {
      const originalEventTypes = [...manager.getConfig().eventTypes];
      
      manager.updateConfig({ includeIframes: false });
      
      expect(manager.getConfig().eventTypes).toEqual(originalEventTypes);
    });
  });
  
  describe('event handler', () => {
    it('should store event handler', () => {
      const handler = vi.fn();
      manager.setEventHandler(handler);
      
      // Handler is private, so we test indirectly
      expect(() => manager.setEventHandler(handler)).not.toThrow();
    });
    
    it('should warn if no handler set on attach', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      manager.attach(document);
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No event handler set')
      );
      
      warnSpy.mockRestore();
    });
  });
  
  describe('attach', () => {
    it('should attach listeners to document', () => {
      const handler = vi.fn();
      manager.setEventHandler(handler);
      
      manager.attach(document);
      
      expect(manager.isCurrentlyAttached()).toBe(true);
      expect(manager.getStats().totalListeners).toBeGreaterThan(0);
    });
    
    it('should attach listeners for each event type', () => {
      const customManager = new EventListenerManager({
        eventTypes: ['click', 'input', 'change'],
        includeIframes: false,
        includeShadowDOM: false,
      });
      customManager.setEventHandler(() => {});
      
      customManager.attach(document);
      
      const stats = customManager.getStats();
      expect(stats.byEventType['click']).toBe(1);
      expect(stats.byEventType['input']).toBe(1);
      expect(stats.byEventType['change']).toBe(1);
      
      customManager.dispose();
    });
    
    it('should call handler when event occurs', () => {
      const handler = vi.fn();
      const customManager = new EventListenerManager({
        eventTypes: ['click'],
        includeIframes: false,
        includeShadowDOM: false,
      });
      customManager.setEventHandler(handler);
      customManager.attach(document);
      
      // Trigger a click event
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.click();
      
      expect(handler).toHaveBeenCalled();
      
      document.body.removeChild(button);
      customManager.dispose();
    });
  });
  
  describe('detach', () => {
    it('should remove all listeners on detachAll', () => {
      manager.setEventHandler(() => {});
      manager.attach(document);
      
      expect(manager.getStats().totalListeners).toBeGreaterThan(0);
      
      manager.detachAll();
      
      expect(manager.getStats().totalListeners).toBe(0);
      expect(manager.isCurrentlyAttached()).toBe(false);
    });
    
    it('should detach specific event type', () => {
      const customManager = new EventListenerManager({
        eventTypes: ['click', 'input'],
        includeIframes: false,
        includeShadowDOM: false,
      });
      customManager.setEventHandler(() => {});
      customManager.attach(document);
      
      customManager.detachEventType('click');
      
      const stats = customManager.getStats();
      expect(stats.byEventType['click']).toBeUndefined();
      expect(stats.byEventType['input']).toBe(1);
      
      customManager.dispose();
    });
    
    it('should not call handler after detach', () => {
      const handler = vi.fn();
      const customManager = new EventListenerManager({
        eventTypes: ['click'],
        includeIframes: false,
        includeShadowDOM: false,
      });
      customManager.setEventHandler(handler);
      customManager.attach(document);
      
      customManager.detachAll();
      
      // Trigger event after detach
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.click();
      
      // Handler should not be called for new events
      // (It may have been called during setup, so check it wasn't called after detach)
      const callCountAfterDetach = handler.mock.calls.length;
      button.click();
      expect(handler.mock.calls.length).toBe(callCountAfterDetach);
      
      document.body.removeChild(button);
      customManager.dispose();
    });
  });
  
  describe('ignore selector', () => {
    it('should ignore events from ignored elements', () => {
      const handler = vi.fn();
      const customManager = new EventListenerManager({
        eventTypes: ['click'],
        includeIframes: false,
        includeShadowDOM: false,
        ignoreSelector: '.ignore-me',
      });
      customManager.setEventHandler(handler);
      customManager.attach(document);
      
      // Create ignored element
      const ignored = document.createElement('button');
      ignored.className = 'ignore-me';
      document.body.appendChild(ignored);
      
      // Create normal element
      const normal = document.createElement('button');
      document.body.appendChild(normal);
      
      // Click ignored element
      ignored.click();
      const ignoredCalls = handler.mock.calls.length;
      
      // Click normal element
      normal.click();
      
      expect(handler.mock.calls.length).toBeGreaterThan(ignoredCalls);
      
      document.body.removeChild(ignored);
      document.body.removeChild(normal);
      customManager.dispose();
    });
  });
  
  describe('statistics', () => {
    it('should return accurate stats', () => {
      const customManager = new EventListenerManager({
        eventTypes: ['click', 'input'],
        includeIframes: false,
        includeShadowDOM: false,
      });
      customManager.setEventHandler(() => {});
      customManager.attach(document);
      
      const stats = customManager.getStats();
      
      expect(stats.totalListeners).toBe(2);
      expect(stats.mainDocumentListeners).toBe(2);
      expect(stats.iframeListeners).toBe(0);
      expect(stats.shadowDomListeners).toBe(0);
      
      customManager.dispose();
    });
    
    it('should track iframes and shadow roots', () => {
      const stats = manager.getStats();
      
      expect(typeof stats.trackedIframes).toBe('number');
      expect(typeof stats.trackedShadowRoots).toBe('number');
    });
  });
  
  describe('dispose', () => {
    it('should clean up all resources', () => {
      manager.setEventHandler(() => {});
      manager.attach(document);
      
      manager.dispose();
      
      expect(manager.isCurrentlyAttached()).toBe(false);
      expect(manager.getStats().totalListeners).toBe(0);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createEventListenerManager', () => {
  it('should create manager with defaults', () => {
    const manager = createEventListenerManager();
    
    expect(manager).toBeInstanceOf(EventListenerManager);
    expect(manager.getConfig().eventTypes).toEqual(DEFAULT_LISTENER_CONFIG.eventTypes);
    
    manager.dispose();
  });
  
  it('should create manager with custom config', () => {
    const manager = createEventListenerManager({
      eventTypes: ['click'],
    });
    
    expect(manager.getConfig().eventTypes).toEqual(['click']);
    
    manager.dispose();
  });
});

describe('isInShadowDOM', () => {
  it('should return false for regular elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    expect(isInShadowDOM(div)).toBe(false);
    
    document.body.removeChild(div);
  });
  
  it('should return true for elements in shadow DOM', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    shadow.appendChild(inner);
    document.body.appendChild(host);
    
    expect(isInShadowDOM(inner)).toBe(true);
    
    document.body.removeChild(host);
  });
});

describe('getShadowRootOf', () => {
  it('should return null for regular elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    expect(getShadowRootOf(div)).toBeNull();
    
    document.body.removeChild(div);
  });
  
  it('should return shadow root for elements in shadow DOM', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    shadow.appendChild(inner);
    document.body.appendChild(host);
    
    expect(getShadowRootOf(inner)).toBe(shadow);
    
    document.body.removeChild(host);
  });
});

describe('getShadowHostChain', () => {
  it('should return empty array for regular elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    expect(getShadowHostChain(div)).toEqual([]);
    
    document.body.removeChild(div);
  });
  
  it('should return host chain for nested shadow DOM', () => {
    // Create nested shadow DOM
    const host1 = document.createElement('div');
    const shadow1 = host1.attachShadow({ mode: 'open' });
    
    const host2 = document.createElement('div');
    shadow1.appendChild(host2);
    const shadow2 = host2.attachShadow({ mode: 'open' });
    
    const inner = document.createElement('span');
    shadow2.appendChild(inner);
    
    document.body.appendChild(host1);
    
    const chain = getShadowHostChain(inner);
    
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(host2);
    expect(chain[1]).toBe(host1);
    
    document.body.removeChild(host1);
  });
});

describe('getEventPath', () => {
  it('should return event path', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    
    let capturedPath: EventTarget[] = [];
    button.addEventListener('click', (e) => {
      capturedPath = getEventPath(e);
    });
    
    button.click();
    
    expect(capturedPath.length).toBeGreaterThan(0);
    expect(capturedPath[0]).toBe(button);
    
    document.body.removeChild(button);
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_LISTENER_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_LISTENER_CONFIG.eventTypes).toContain('click');
    expect(DEFAULT_LISTENER_CONFIG.eventTypes).toContain('input');
    expect(DEFAULT_LISTENER_CONFIG.includeIframes).toBe(true);
    expect(DEFAULT_LISTENER_CONFIG.includeShadowDOM).toBe(true);
    expect(DEFAULT_LISTENER_CONFIG.maxIframeDepth).toBeGreaterThan(0);
    expect(DEFAULT_LISTENER_CONFIG.useCapture).toBe(true);
  });
});

// ============================================================================
// REGISTERED LISTENER TESTS
// ============================================================================

describe('Registered listeners', () => {
  it('should track listener metadata', () => {
    const manager = new EventListenerManager({
      eventTypes: ['click'],
      includeIframes: false,
      includeShadowDOM: false,
    });
    manager.setEventHandler(() => {});
    manager.attach(document);
    
    const listeners = manager.getListeners();
    
    expect(listeners.length).toBe(1);
    expect(listeners[0].eventType).toBe('click');
    expect(listeners[0].context).toBe('main');
    expect(listeners[0].attachedAt).toBeGreaterThan(0);
    
    manager.dispose();
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error handling', () => {
  it('should handle errors in event handler gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const manager = new EventListenerManager({
      eventTypes: ['click'],
      includeIframes: false,
      includeShadowDOM: false,
    });
    
    manager.setEventHandler(() => {
      throw new Error('Handler error');
    });
    manager.attach(document);
    
    const button = document.createElement('button');
    document.body.appendChild(button);
    
    // Should not throw
    expect(() => button.click()).not.toThrow();
    
    expect(errorSpy).toHaveBeenCalled();
    
    document.body.removeChild(button);
    errorSpy.mockRestore();
    manager.dispose();
  });
});
