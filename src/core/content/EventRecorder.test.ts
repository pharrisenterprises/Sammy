/**
 * Tests for EventRecorder
 * @module core/content/EventRecorder.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EventRecorder,
  createEventRecorder,
  createDebugRecorder,
  createFullRecorder,
  getEventRecorder,
  resetEventRecorder,
  generateXPath,
  getElementLabel,
  getElementValue,
  buildLocatorBundle,
  getEventTarget,
  determineEventType,
  DEFAULT_RECORDER_CONFIG,
} from './EventRecorder';
import type { RecordedEvent } from './IContentScript';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock document for testing
const createMockElement = (tag: string, attrs: Record<string, string> = {}): HTMLElement => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetEventRecorder();
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Helper Functions', () => {
  describe('generateXPath', () => {
    it('should generate XPath with ID', () => {
      const el = createMockElement('button', { id: 'submit-btn' });
      document.body.appendChild(el);
      
      const xpath = generateXPath(el);
      
      expect(xpath).toBe('//*[@id="submit-btn"]');
      
      el.remove();
    });
    
    it('should generate path-based XPath without ID', () => {
      const container = createMockElement('div');
      const el = createMockElement('span');
      container.appendChild(el);
      document.body.appendChild(container);
      
      const xpath = generateXPath(el);
      
      expect(xpath).toContain('span');
      
      container.remove();
    });
  });
  
  describe('getElementLabel', () => {
    it('should get aria-label', () => {
      const el = createMockElement('button', { 'aria-label': 'Submit form' });
      
      expect(getElementLabel(el)).toBe('Submit form');
    });
    
    it('should get title', () => {
      const el = createMockElement('button', { title: 'Click me' });
      
      expect(getElementLabel(el)).toBe('Click me');
    });
    
    it('should get placeholder', () => {
      const el = createMockElement('input', { placeholder: 'Enter email' }) as HTMLInputElement;
      
      expect(getElementLabel(el)).toBe('Enter email');
    });
    
    it('should get text content', () => {
      const el = createMockElement('button');
      el.textContent = 'Save';
      
      expect(getElementLabel(el)).toBe('Save');
    });
    
    it('should fallback to tag name', () => {
      const el = createMockElement('div');
      
      expect(getElementLabel(el)).toBe('div');
    });
  });
  
  describe('getElementValue', () => {
    it('should get input value', () => {
      const el = createMockElement('input') as HTMLInputElement;
      el.value = 'test@example.com';
      
      expect(getElementValue(el)).toBe('test@example.com');
    });
    
    it('should get checkbox state', () => {
      const el = createMockElement('input', { type: 'checkbox' }) as HTMLInputElement;
      el.checked = true;
      
      expect(getElementValue(el)).toBe('checked');
    });
    
    it('should get select value', () => {
      const el = document.createElement('select') as HTMLSelectElement;
      const option = document.createElement('option');
      option.value = 'option1';
      el.appendChild(option);
      el.value = 'option1';
      
      expect(getElementValue(el)).toBe('option1');
    });
  });
  
  describe('buildLocatorBundle', () => {
    it('should build complete bundle', () => {
      const el = createMockElement('button', { 
        id: 'btn',
        name: 'submit',
        'aria-label': 'Submit',
        'data-testid': 'submit-btn',
      });
      el.classList.add('btn', 'primary');
      document.body.appendChild(el);
      
      const bundle = buildLocatorBundle(el);
      
      expect(bundle.id).toBe('btn');
      expect(bundle.name).toBe('submit');
      expect(bundle.aria).toBe('Submit');
      expect(bundle.tag).toBe('button');
      expect(bundle.classes).toContain('btn');
      expect(bundle.dataAttrs?.['data-testid']).toBe('submit-btn');
      expect(bundle.xpath).toBe('//*[@id="btn"]');
      
      el.remove();
    });
  });
  
  describe('determineEventType', () => {
    it('should identify click events', () => {
      const el = createMockElement('button');
      const event = new MouseEvent('mousedown');
      
      expect(determineEventType(event, el)).toBe('click');
    });
    
    it('should identify input events', () => {
      const el = createMockElement('input') as HTMLInputElement;
      const event = new Event('input');
      
      expect(determineEventType(event, el)).toBe('input');
    });
    
    it('should identify select events', () => {
      const el = document.createElement('select');
      const event = new Event('change');
      
      expect(determineEventType(event, el)).toBe('select');
    });
    
    it('should identify enter key', () => {
      const el = createMockElement('input');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      
      expect(determineEventType(event, el)).toBe('enter');
    });
  });
});

// ============================================================================
// EVENT RECORDER TESTS
// ============================================================================

describe('EventRecorder', () => {
  let recorder: EventRecorder;
  
  beforeEach(() => {
    recorder = createEventRecorder({ debug: false });
  });
  
  afterEach(() => {
    recorder.stop();
  });
  
  describe('start/stop', () => {
    it('should start recording', () => {
      recorder.start();
      
      expect(recorder.isRecording()).toBe(true);
      expect(recorder.getState().active).toBe(true);
    });
    
    it('should start with project ID', () => {
      recorder.start(123);
      
      expect(recorder.getState().projectId).toBe(123);
    });
    
    it('should stop recording', () => {
      recorder.start();
      recorder.stop();
      
      expect(recorder.isRecording()).toBe(false);
    });
    
    it('should not double-start', () => {
      recorder.start();
      const count = recorder.getAttachedDocumentCount();
      
      recorder.start(); // Should be no-op
      
      expect(recorder.getAttachedDocumentCount()).toBe(count);
    });
  });
  
  describe('event handlers', () => {
    it('should register handler', () => {
      const handler = vi.fn();
      
      recorder.onEvent(handler);
      
      expect(recorder.getHandlerCount()).toBe(1);
    });
    
    it('should remove handler', () => {
      const handler = vi.fn();
      
      recorder.onEvent(handler);
      recorder.offEvent(handler);
      
      expect(recorder.getHandlerCount()).toBe(0);
    });
  });
  
  describe('event capture', () => {
    it('should capture click events', () => {
      const events: RecordedEvent[] = [];
      recorder.onEvent((e) => events.push(e));
      recorder.start();
      
      const button = createMockElement('button', { id: 'test-btn' });
      button.textContent = 'Click Me';
      document.body.appendChild(button);
      
      const clickEvent = new MouseEvent('mousedown', { bubbles: true });
      button.dispatchEvent(clickEvent);
      
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('click');
      expect(events[0].label).toBe('Click Me');
      
      button.remove();
    });
    
    it('should capture input events (debounced)', () => {
      const events: RecordedEvent[] = [];
      recorder.onEvent((e) => events.push(e));
      recorder.start();
      
      const input = createMockElement('input', { id: 'test-input' }) as HTMLInputElement;
      document.body.appendChild(input);
      
      input.value = 'test';
      const inputEvent = new Event('input', { bubbles: true });
      input.dispatchEvent(inputEvent);
      
      // Event is debounced - advance timer
      expect(events).toHaveLength(0);
      
      vi.advanceTimersByTime(DEFAULT_RECORDER_CONFIG.inputDebounceMs + 10);
      
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('input');
      expect(events[0].value).toBe('test');
      
      input.remove();
    });
    
    it('should capture enter key events', () => {
      const events: RecordedEvent[] = [];
      recorder.onEvent((e) => events.push(e));
      recorder.start();
      
      const input = createMockElement('input', { id: 'test-input' });
      document.body.appendChild(input);
      
      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(keyEvent);
      
      // Filter to just enter events (may also get input flush)
      const enterEvents = events.filter(e => e.eventType === 'enter');
      expect(enterEvents).toHaveLength(1);
      
      input.remove();
    });
    
    it('should not capture when not recording', () => {
      const events: RecordedEvent[] = [];
      recorder.onEvent((e) => events.push(e));
      // Don't start recording
      
      const button = createMockElement('button');
      document.body.appendChild(button);
      
      const clickEvent = new MouseEvent('mousedown', { bubbles: true });
      button.dispatchEvent(clickEvent);
      
      expect(events).toHaveLength(0);
      
      button.remove();
    });
  });
  
  describe('event count', () => {
    it('should track event count', () => {
      recorder.start();
      
      const button = createMockElement('button');
      document.body.appendChild(button);
      
      for (let i = 0; i < 3; i++) {
        const clickEvent = new MouseEvent('mousedown', { bubbles: true });
        button.dispatchEvent(clickEvent);
      }
      
      expect(recorder.getEventCount()).toBe(3);
      
      button.remove();
    });
    
    it('should clear event count', () => {
      recorder.start();
      
      const button = createMockElement('button');
      document.body.appendChild(button);
      
      const clickEvent = new MouseEvent('mousedown', { bubbles: true });
      button.dispatchEvent(clickEvent);
      
      recorder.clearEvents();
      
      expect(recorder.getEventCount()).toBe(0);
      
      button.remove();
    });
  });
  
  describe('ignore selectors', () => {
    it('should ignore elements matching ignore selectors', () => {
      const events: RecordedEvent[] = [];
      recorder.onEvent((e) => events.push(e));
      recorder.start();
      
      const button = createMockElement('button', { 'data-recorder-ignore': 'true' });
      document.body.appendChild(button);
      
      const clickEvent = new MouseEvent('mousedown', { bubbles: true });
      button.dispatchEvent(clickEvent);
      
      expect(events).toHaveLength(0);
      
      button.remove();
    });
  });
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = recorder.getConfig();
      
      expect(config.inputDebounceMs).toBe(DEFAULT_RECORDER_CONFIG.inputDebounceMs);
    });
    
    it('should accept custom config', () => {
      const customRecorder = createEventRecorder({
        inputDebounceMs: 500,
        captureFocusEvents: true,
      });
      
      const config = customRecorder.getConfig();
      
      expect(config.inputDebounceMs).toBe(500);
      expect(config.captureFocusEvents).toBe(true);
    });
    
    it('should update config', () => {
      recorder.setConfig({ inputDebounceMs: 1000 });
      
      expect(recorder.getConfig().inputDebounceMs).toBe(1000);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createEventRecorder', () => {
    it('should create recorder', () => {
      const recorder = createEventRecorder();
      
      expect(recorder).toBeInstanceOf(EventRecorder);
    });
  });
  
  describe('createDebugRecorder', () => {
    it('should create recorder with debug enabled', () => {
      const recorder = createDebugRecorder();
      
      expect(recorder.getConfig().debug).toBe(true);
    });
  });
  
  describe('createFullRecorder', () => {
    it('should create recorder with focus events', () => {
      const recorder = createFullRecorder();
      
      expect(recorder.getConfig().captureFocusEvents).toBe(true);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetEventRecorder();
  });
  
  describe('getEventRecorder', () => {
    it('should return same instance', () => {
      const recorder1 = getEventRecorder();
      const recorder2 = getEventRecorder();
      
      expect(recorder1).toBe(recorder2);
    });
  });
  
  describe('resetEventRecorder', () => {
    it('should create new instance after reset', () => {
      const recorder1 = getEventRecorder();
      resetEventRecorder();
      const recorder2 = getEventRecorder();
      
      expect(recorder1).not.toBe(recorder2);
    });
    
    it('should stop recording on reset', () => {
      const recorder = getEventRecorder();
      recorder.start();
      
      expect(recorder.isRecording()).toBe(true);
      
      resetEventRecorder();
      
      expect(recorder.isRecording()).toBe(false);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_RECORDER_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_RECORDER_CONFIG.inputDebounceMs).toBe(300);
    expect(DEFAULT_RECORDER_CONFIG.captureFocusEvents).toBe(false);
    expect(DEFAULT_RECORDER_CONFIG.captureNavigationEvents).toBe(true);
    expect(DEFAULT_RECORDER_CONFIG.debug).toBe(false);
  });
});
