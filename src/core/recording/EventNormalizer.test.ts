/**
 * Tests for EventNormalizer
 * @module core/recording/EventNormalizer.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EventNormalizer,
  createEventNormalizer,
  isInShadowRoot,
  getShadowHostChain,
  DEFAULT_NORMALIZER_CONFIG,
  type NormalizedEvent,
  type FrameworkType,
  type ElementType,
} from './EventNormalizer';

import type { CapturedEventData, ActionType } from './EventCapture';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockCapturedEvent(overrides?: Partial<CapturedEventData>): CapturedEventData {
  const button = document.createElement('button');
  
  return {
    eventType: 'click',
    actionType: 'click' as ActionType,
    target: button,
    originalEvent: new MouseEvent('click'),
    value: null,
    isTrusted: true,
    coordinates: {
      clientX: 100,
      clientY: 100,
      pageX: 100,
      pageY: 100,
      offsetX: 50,
      offsetY: 25,
    },
    timestamp: Date.now(),
    metadata: {
      tagName: 'button',
      inputType: null,
      isContentEditable: false,
      isFormSubmit: false,
      isNavigation: false,
      isSelect2: false,
      isCheckbox: false,
      isRadio: false,
      isChecked: null,
      key: null,
      keyCode: null,
      modifiers: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
      composedPath: [],
    },
    ...overrides,
  };
}

// ============================================================================
// EVENTNORMALIZER CLASS TESTS
// ============================================================================

describe('EventNormalizer', () => {
  let normalizer: EventNormalizer;
  
  beforeEach(() => {
    normalizer = new EventNormalizer();
  });
  
  afterEach(() => {
    normalizer.dispose();
  });
  
  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = normalizer.getConfig();
      expect(config.detectFrameworks).toBe(true);
      expect(config.resolveShadowDOM).toBe(true);
      expect(config.coalesceEvents).toBe(true);
    });
    
    it('should accept custom config', () => {
      const custom = new EventNormalizer({
        detectFrameworks: false,
        coalesceWindowMs: 200,
      });
      
      const config = custom.getConfig();
      expect(config.detectFrameworks).toBe(false);
      expect(config.coalesceWindowMs).toBe(200);
      
      custom.dispose();
    });
  });
  
  describe('normalize', () => {
    it('should normalize a captured event', () => {
      const captured = createMockCapturedEvent();
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.id).toBeDefined();
      expect(normalized.action).toBe('click');
      expect(normalized.target).toBe(captured.target);
      expect(normalized.isUserInitiated).toBe(true);
      expect(normalized.timestamp).toBeGreaterThan(0);
    });
    
    it('should generate unique IDs', () => {
      const captured = createMockCapturedEvent();
      const event1 = normalizer.normalize(captured);
      const event2 = normalizer.normalize(captured);
      
      expect(event1.id).not.toBe(event2.id);
    });
    
    it('should include environment info', () => {
      const captured = createMockCapturedEvent();
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.environment).toBeDefined();
      expect(normalized.environment.browser).toBeDefined();
      expect(normalized.environment.platform).toBeDefined();
    });
    
    it('should include element info', () => {
      const captured = createMockCapturedEvent();
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo).toBeDefined();
      expect(normalized.elementInfo.tagName).toBe('button');
      expect(normalized.elementInfo.type).toBe('button');
    });
  });
  
  describe('target resolution', () => {
    it('should resolve effective target', () => {
      const button = document.createElement('button');
      const captured = createMockCapturedEvent({ target: button });
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.effectiveTarget).toBe(button);
    });
    
    it('should resolve label click to input', () => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.id = 'test-input';
      label.setAttribute('for', 'test-input');
      document.body.appendChild(input);
      document.body.appendChild(label);
      
      const captured = createMockCapturedEvent({ target: label });
      captured.metadata.tagName = 'label';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.effectiveTarget).toBe(input);
      
      document.body.removeChild(input);
      document.body.removeChild(label);
    });
    
    it('should resolve nested input in label', () => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      label.appendChild(input);
      document.body.appendChild(label);
      
      const captured = createMockCapturedEvent({ target: label });
      captured.metadata.tagName = 'label';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.effectiveTarget).toBe(input);
      
      document.body.removeChild(label);
    });
  });
  
  describe('element classification', () => {
    it('should classify button elements', () => {
      const button = document.createElement('button');
      const captured = createMockCapturedEvent({ target: button });
      captured.metadata.tagName = 'button';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('button');
    });
    
    it('should classify input elements by type', () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      
      const captured = createMockCapturedEvent({ target: input });
      captured.metadata.tagName = 'input';
      captured.metadata.inputType = 'checkbox';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('checkbox');
      expect(normalized.elementInfo.inputType).toBe('checkbox');
    });
    
    it('should classify text inputs', () => {
      const input = document.createElement('input');
      input.type = 'text';
      
      const captured = createMockCapturedEvent({ target: input });
      captured.metadata.tagName = 'input';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('text-input');
    });
    
    it('should classify textarea', () => {
      const textarea = document.createElement('textarea');
      
      const captured = createMockCapturedEvent({ target: textarea });
      captured.metadata.tagName = 'textarea';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('textarea');
    });
    
    it('should classify select elements', () => {
      const select = document.createElement('select');
      
      const captured = createMockCapturedEvent({ target: select });
      captured.metadata.tagName = 'select';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('select');
    });
    
    it('should classify links', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      
      const captured = createMockCapturedEvent({ target: link });
      captured.metadata.tagName = 'a';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('link');
    });
    
    it('should detect contenteditable', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      
      const captured = createMockCapturedEvent({ target: div });
      captured.metadata.tagName = 'div';
      captured.metadata.isContentEditable = true;
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.type).toBe('contenteditable');
      expect(normalized.elementInfo.isEditable).toBe(true);
    });
    
    it('should detect custom elements', () => {
      // Create a custom element-like div
      const custom = document.createElement('my-custom-element');
      
      const captured = createMockCapturedEvent({ target: custom });
      captured.metadata.tagName = 'my-custom-element';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.isCustomElement).toBe(true);
      expect(normalized.elementInfo.customElementName).toBe('my-custom-element');
    });
    
    it('should extract ARIA attributes', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Close');
      button.setAttribute('aria-pressed', 'false');
      
      const captured = createMockCapturedEvent({ target: button });
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.elementInfo.ariaAttributes['aria-label']).toBe('Close');
      expect(normalized.elementInfo.ariaAttributes['aria-pressed']).toBe('false');
    });
  });
  
  describe('coordinate normalization', () => {
    it('should normalize coordinates', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      const captured = createMockCapturedEvent({
        target: button,
        coordinates: {
          clientX: 150,
          clientY: 200,
          pageX: 150,
          pageY: 200,
          offsetX: 50,
          offsetY: 25,
        },
      });
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.coordinates).not.toBeNull();
      expect(normalized.coordinates?.viewportX).toBe(150);
      expect(normalized.coordinates?.viewportY).toBe(200);
      expect(normalized.coordinates?.documentX).toBe(150);
      expect(normalized.coordinates?.documentY).toBe(200);
      
      document.body.removeChild(button);
    });
    
    it('should skip coordinates when configured', () => {
      const noCoordNormalizer = new EventNormalizer({
        normalizeCoordinates: false,
      });
      
      const captured = createMockCapturedEvent();
      const normalized = noCoordNormalizer.normalize(captured);
      
      expect(normalized.coordinates).toBeNull();
      
      noCoordNormalizer.dispose();
    });
  });
  
  describe('value normalization', () => {
    it('should normalize text input value', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'test value';
      
      const captured = createMockCapturedEvent({
        target: input,
        value: 'test value',
      });
      captured.metadata.tagName = 'input';
      
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.value).toBe('test value');
    });
    
    it('should handle null values', () => {
      const captured = createMockCapturedEvent({ value: null });
      const normalized = normalizer.normalize(captured);
      
      expect(normalized.value).toBe('');
    });
  });
  
  describe('framework detection', () => {
    it('should default to vanilla when no framework detected', () => {
      const captured = createMockCapturedEvent();
      const normalized = normalizer.normalize(captured);
      
      // In test environment, no framework should be detected
      expect(['vanilla', 'unknown', 'jquery']).toContain(normalized.framework.name);
    });
    
    it('should skip framework detection when disabled', () => {
      const noFrameworkNormalizer = new EventNormalizer({
        detectFrameworks: false,
      });
      
      const captured = createMockCapturedEvent();
      const normalized = noFrameworkNormalizer.normalize(captured);
      
      expect(normalized.framework.name).toBe('unknown');
      
      noFrameworkNormalizer.dispose();
    });
  });
  
  describe('event coalescing', () => {
    it('should coalesce related events', () => {
      const button = document.createElement('button');
      button.id = 'test-btn';
      
      const captured1 = createMockCapturedEvent({ target: button });
      const captured2 = createMockCapturedEvent({ target: button });
      
      const normalized1 = normalizer.normalize(captured1);
      const normalized2 = normalizer.normalize(captured2);
      
      // Events should be related
      expect(normalized1.relatedEvents).toContain(normalized2.id);
      expect(normalized2.relatedEvents).toContain(normalized1.id);
    });
    
    it('should not coalesce events outside window', async () => {
      const shortWindowNormalizer = new EventNormalizer({
        coalesceWindowMs: 10,
      });
      
      const button = document.createElement('button');
      
      const captured1 = createMockCapturedEvent({ target: button });
      const normalized1 = shortWindowNormalizer.normalize(captured1);
      
      // Wait longer than coalesce window
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const captured2 = createMockCapturedEvent({ target: button });
      const normalized2 = shortWindowNormalizer.normalize(captured2);
      
      // Events should not be related
      expect(normalized1.relatedEvents).not.toContain(normalized2.id);
      
      shortWindowNormalizer.dispose();
    });
    
    it('should skip coalescing when disabled', () => {
      const noCoalesceNormalizer = new EventNormalizer({
        coalesceEvents: false,
      });
      
      const button = document.createElement('button');
      
      const captured1 = createMockCapturedEvent({ target: button });
      const captured2 = createMockCapturedEvent({ target: button });
      
      const normalized1 = noCoalesceNormalizer.normalize(captured1);
      const normalized2 = noCoalesceNormalizer.normalize(captured2);
      
      expect(normalized1.relatedEvents).toHaveLength(0);
      expect(normalized2.relatedEvents).toHaveLength(0);
      
      noCoalesceNormalizer.dispose();
    });
  });
  
  describe('batch normalization', () => {
    it('should normalize multiple events', () => {
      const events = [
        createMockCapturedEvent(),
        createMockCapturedEvent(),
        createMockCapturedEvent(),
      ];
      
      const normalized = normalizer.normalizeBatch(events);
      
      expect(normalized).toHaveLength(3);
      normalized.forEach(n => {
        expect(n.id).toBeDefined();
        expect(n.action).toBe('click');
      });
    });
  });
  
  describe('cleanup', () => {
    it('should clear environment cache', () => {
      const captured = createMockCapturedEvent();
      normalizer.normalize(captured);
      
      normalizer.clearEnvironmentCache();
      
      // Should work without error
      const normalized = normalizer.normalize(captured);
      expect(normalized.environment).toBeDefined();
    });
    
    it('should clear recent events', () => {
      const button = document.createElement('button');
      const captured = createMockCapturedEvent({ target: button });
      
      normalizer.normalize(captured);
      normalizer.clearRecentEvents();
      
      const captured2 = createMockCapturedEvent({ target: button });
      const normalized2 = normalizer.normalize(captured2);
      
      // Should not have related events (cache was cleared)
      expect(normalized2.relatedEvents).toHaveLength(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createEventNormalizer', () => {
  it('should create normalizer with defaults', () => {
    const normalizer = createEventNormalizer();
    expect(normalizer).toBeInstanceOf(EventNormalizer);
    normalizer.dispose();
  });
  
  it('should create normalizer with custom config', () => {
    const normalizer = createEventNormalizer({
      detectFrameworks: false,
    });
    
    expect(normalizer.getConfig().detectFrameworks).toBe(false);
    normalizer.dispose();
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('isInShadowRoot', () => {
  it('should return false for regular elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    expect(isInShadowRoot(div)).toBe(false);
    
    document.body.removeChild(div);
  });
  
  it('should return true for shadow DOM elements', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    shadow.appendChild(inner);
    document.body.appendChild(host);
    
    expect(isInShadowRoot(inner)).toBe(true);
    
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
  
  it('should return host chain for shadow DOM', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    shadow.appendChild(inner);
    document.body.appendChild(host);
    
    const chain = getShadowHostChain(inner);
    
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(host);
    
    document.body.removeChild(host);
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_NORMALIZER_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_NORMALIZER_CONFIG.detectFrameworks).toBe(true);
    expect(DEFAULT_NORMALIZER_CONFIG.resolveShadowDOM).toBe(true);
    expect(DEFAULT_NORMALIZER_CONFIG.coalesceEvents).toBe(true);
    expect(DEFAULT_NORMALIZER_CONFIG.coalesceWindowMs).toBeGreaterThan(0);
    expect(DEFAULT_NORMALIZER_CONFIG.checkVisibility).toBe(true);
    expect(DEFAULT_NORMALIZER_CONFIG.normalizeCoordinates).toBe(true);
  });
});
