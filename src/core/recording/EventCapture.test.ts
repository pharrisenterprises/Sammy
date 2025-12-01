/**
 * Tests for EventCapture
 * @module core/recording/EventCapture.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EventCapture,
  createEventCapture,
  isInputElement,
  isClickableElement,
  getClickableAncestor,
  describeEvent,
  DEFAULT_CAPTURE_CONFIG,
  type CapturedEventData,
} from './EventCapture';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createClickEvent(target: Element, options?: Partial<MouseEventInit>): MouseEvent {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100,
    ...options,
  });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

function createInputEvent(target: Element): Event {
  const event = new Event('input', { bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

function createKeyboardEvent(key: string, target: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

// ============================================================================
// EVENTCAPTURE CLASS TESTS
// ============================================================================

describe('EventCapture', () => {
  let capture: EventCapture;
  
  beforeEach(() => {
    capture = new EventCapture({
      filterSyntheticEvents: false, // Allow jsdom synthetic events in tests
      inputDebounceMs: 0, // Disable debouncing for tests
      dedupeIntervalMs: 0, // Disable deduplication for tests
    });
  });
  
  afterEach(() => {
    capture.dispose();
  });
  
  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultCapture = new EventCapture();
      const config = defaultCapture.getConfig();
      
      expect(config.filterSyntheticEvents).toBe(true);
      expect(config.inputDebounceMs).toBe(DEFAULT_CAPTURE_CONFIG.inputDebounceMs);
      
      defaultCapture.dispose();
    });
    
    it('should accept custom config', () => {
      const customCapture = new EventCapture({
        filterSyntheticEvents: false,
        inputDebounceMs: 500,
      });
      
      const config = customCapture.getConfig();
      expect(config.filterSyntheticEvents).toBe(false);
      expect(config.inputDebounceMs).toBe(500);
      
      customCapture.dispose();
    });
  });
  
  describe('callback', () => {
    it('should call callback when event is processed', () => {
      const callback = vi.fn();
      capture.setCallback(callback);
      
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      const event = createClickEvent(button);
      capture.processEvent(event);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'click',
          target: button,
        })
      );
      
      document.body.removeChild(button);
    });
  });
  
  describe('click event processing', () => {
    it('should process click events', () => {
      const callback = vi.fn();
      capture.setCallback(callback);
      
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      const event = createClickEvent(button);
      const result = capture.processEvent(event);
      
      expect(result).not.toBeNull();
      expect(result?.actionType).toBe('click');
      expect(result?.eventType).toBe('click');
      expect(result?.target).toBe(button);
      
      document.body.removeChild(button);
    });
    
    it('should capture coordinates for click events', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      const event = createClickEvent(button, {
        clientX: 150,
        clientY: 200,
      });
      
      const result = capture.processEvent(event);
      
      expect(result?.coordinates).not.toBeNull();
      expect(result?.coordinates?.clientX).toBe(150);
      expect(result?.coordinates?.clientY).toBe(200);
      
      document.body.removeChild(button);
    });
    
    it('should detect checkbox clicks', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      document.body.appendChild(checkbox);
      
      const event = createClickEvent(checkbox);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('check');
      expect(result?.metadata.isCheckbox).toBe(true);
      expect(result?.metadata.isChecked).toBe(true);
      
      document.body.removeChild(checkbox);
    });
    
    it('should detect unchecked checkbox clicks', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;
      document.body.appendChild(checkbox);
      
      const event = createClickEvent(checkbox);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('uncheck');
      expect(result?.metadata.isChecked).toBe(false);
      
      document.body.removeChild(checkbox);
    });
    
    it('should detect radio button clicks', () => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.checked = true;
      document.body.appendChild(radio);
      
      const event = createClickEvent(radio);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('select');
      expect(result?.metadata.isRadio).toBe(true);
      
      document.body.removeChild(radio);
    });
    
    it('should detect navigation links', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      document.body.appendChild(link);
      
      const event = createClickEvent(link);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('navigate');
      expect(result?.metadata.isNavigation).toBe(true);
      
      document.body.removeChild(link);
    });
  });
  
  describe('input event processing', () => {
    it('should process input events', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'test value';
      document.body.appendChild(input);
      
      const event = createInputEvent(input);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('input');
      expect(result?.value).toBe('test value');
      
      document.body.removeChild(input);
    });
    
    it('should process textarea events', () => {
      const textarea = document.createElement('textarea');
      textarea.value = 'multiline\ntext';
      document.body.appendChild(textarea);
      
      const event = createInputEvent(textarea);
      const result = capture.processEvent(event);
      
      expect(result?.value).toBe('multiline\ntext');
      
      document.body.removeChild(textarea);
    });
    
    it('should process select events', () => {
      const select = document.createElement('select');
      const option = document.createElement('option');
      option.value = 'option1';
      select.appendChild(option);
      select.value = 'option1';
      document.body.appendChild(select);
      
      const event = createInputEvent(select);
      const result = capture.processEvent(event);
      
      expect(result?.value).toBe('option1');
      
      document.body.removeChild(select);
    });
  });
  
  describe('keyboard event processing', () => {
    it('should process Enter key', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const event = createKeyboardEvent('Enter', input);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('enter');
      expect(result?.metadata.key).toBe('Enter');
      
      document.body.removeChild(input);
    });
    
    it('should process Tab key', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const event = createKeyboardEvent('Tab', input);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('tab');
      
      document.body.removeChild(input);
    });
    
    it('should process Escape key', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const event = createKeyboardEvent('Escape', input);
      const result = capture.processEvent(event);
      
      expect(result?.actionType).toBe('escape');
      
      document.body.removeChild(input);
    });
    
    it('should ignore other keys', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const event = createKeyboardEvent('a', input);
      const result = capture.processEvent(event);
      
      expect(result).toBeNull();
      
      document.body.removeChild(input);
    });
  });
  
  describe('synthetic event filtering', () => {
    it('should filter synthetic events by default', () => {
      const filteringCapture = new EventCapture({
        filterSyntheticEvents: true,
        inputDebounceMs: 0,
      });
      
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      // jsdom events have isTrusted=false by default (synthetic)
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: button });
      
      const result = filteringCapture.processEvent(event);
      
      expect(result).toBeNull();
      
      document.body.removeChild(button);
      filteringCapture.dispose();
    });
    
    it('should allow synthetic events when configured', () => {
      const nonFilteringCapture = new EventCapture({
        filterSyntheticEvents: false,
        inputDebounceMs: 0,
      });
      
      const button = document.createElement('button');
      document.body.appendChild(button);
      
      // jsdom events have isTrusted=false by default (synthetic)
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: button });
      
      const result = nonFilteringCapture.processEvent(event);
      
      expect(result).not.toBeNull();
      expect(result?.isTrusted).toBe(false);
      
      document.body.removeChild(button);
      nonFilteringCapture.dispose();
    });
  });
  
  describe('debouncing', () => {
    it('should debounce rapid input events', async () => {
      const debouncingCapture = new EventCapture({
        filterSyntheticEvents: false,
        inputDebounceMs: 100,
        dedupeIntervalMs: 0, // Disable deduplication for this test
      });
      
      const callback = vi.fn();
      debouncingCapture.setCallback(callback);
      
      const input = document.createElement('input');
      input.value = '';
      document.body.appendChild(input);
      
      // Simulate rapid typing
      for (const char of ['t', 'te', 'tes', 'test']) {
        input.value = char;
        const event = createInputEvent(input);
        debouncingCapture.processEvent(event);
      }
      
      // Should not have emitted yet
      expect(callback).not.toHaveBeenCalled();
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should have emitted once with final value
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'test' })
      );
      
      document.body.removeChild(input);
      debouncingCapture.dispose();
    });
  });
  
  describe('cleanup', () => {
    it('should clear pending state', () => {
      capture.clear();
      // Should not throw
      expect(() => capture.clear()).not.toThrow();
    });
    
    it('should flush pending inputs', async () => {
      const debouncingCapture = new EventCapture({
        filterSyntheticEvents: false,
        inputDebounceMs: 1000, // Long debounce
      });
      
      const callback = vi.fn();
      debouncingCapture.setCallback(callback);
      
      const input = document.createElement('input');
      input.value = 'pending';
      document.body.appendChild(input);
      
      const event = createInputEvent(input);
      debouncingCapture.processEvent(event);
      
      // Flush immediately
      debouncingCapture.flushPendingInput(input);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'pending' })
      );
      
      document.body.removeChild(input);
      debouncingCapture.dispose();
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createEventCapture', () => {
  it('should create capture with defaults', () => {
    const capture = createEventCapture();
    expect(capture).toBeInstanceOf(EventCapture);
    capture.dispose();
  });
  
  it('should create capture with custom config', () => {
    const capture = createEventCapture({ inputDebounceMs: 500 });
    expect(capture.getConfig().inputDebounceMs).toBe(500);
    capture.dispose();
  });
});

describe('isInputElement', () => {
  it('should return true for input elements', () => {
    expect(isInputElement(document.createElement('input'))).toBe(true);
    expect(isInputElement(document.createElement('textarea'))).toBe(true);
    expect(isInputElement(document.createElement('select'))).toBe(true);
  });
  
  it('should return true for contenteditable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isInputElement(div)).toBe(true);
  });
  
  it('should return false for non-input elements', () => {
    expect(isInputElement(document.createElement('div'))).toBe(false);
    expect(isInputElement(document.createElement('span'))).toBe(false);
    expect(isInputElement(document.createElement('button'))).toBe(false);
  });
});

describe('isClickableElement', () => {
  it('should return true for buttons', () => {
    expect(isClickableElement(document.createElement('button'))).toBe(true);
  });
  
  it('should return true for links', () => {
    expect(isClickableElement(document.createElement('a'))).toBe(true);
  });
  
  it('should return true for inputs', () => {
    expect(isClickableElement(document.createElement('input'))).toBe(true);
  });
  
  it('should return true for elements with button role', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    expect(isClickableElement(div)).toBe(true);
  });
  
  it('should return true for elements with tabindex', () => {
    const div = document.createElement('div');
    div.setAttribute('tabindex', '0');
    expect(isClickableElement(div)).toBe(true);
  });
  
  it('should return false for plain divs', () => {
    expect(isClickableElement(document.createElement('div'))).toBe(false);
  });
});

describe('getClickableAncestor', () => {
  it('should return clickable ancestor', () => {
    const button = document.createElement('button');
    const span = document.createElement('span');
    button.appendChild(span);
    
    expect(getClickableAncestor(span)).toBe(button);
  });
  
  it('should return element itself if clickable', () => {
    const button = document.createElement('button');
    expect(getClickableAncestor(button)).toBe(button);
  });
  
  it('should return null if no clickable ancestor', () => {
    const div = document.createElement('div');
    const span = document.createElement('span');
    div.appendChild(span);
    
    expect(getClickableAncestor(span)).toBeNull();
  });
});

describe('describeEvent', () => {
  it('should describe click events', () => {
    const data: CapturedEventData = {
      eventType: 'click',
      actionType: 'click',
      target: document.createElement('button'),
      originalEvent: new Event('click'),
      value: null,
      isTrusted: true,
      coordinates: null,
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
    };
    
    expect(describeEvent(data)).toBe('Click on <button>');
  });
  
  it('should describe input events', () => {
    const data: CapturedEventData = {
      eventType: 'input',
      actionType: 'input',
      target: document.createElement('input'),
      originalEvent: new Event('input'),
      value: 'hello world',
      isTrusted: true,
      coordinates: null,
      timestamp: Date.now(),
      metadata: {
        tagName: 'input',
        inputType: 'text',
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
    };
    
    expect(describeEvent(data)).toBe('Type "hello world" in <input>');
  });
  
  it('should truncate long values', () => {
    const data: CapturedEventData = {
      eventType: 'input',
      actionType: 'input',
      target: document.createElement('input'),
      originalEvent: new Event('input'),
      value: 'this is a very long value that should be truncated',
      isTrusted: true,
      coordinates: null,
      timestamp: Date.now(),
      metadata: {
        tagName: 'input',
        inputType: 'text',
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
    };
    
    const description = describeEvent(data);
    expect(description).toContain('...');
    expect(description.length).toBeLessThan(50);
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe('DEFAULT_CAPTURE_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CAPTURE_CONFIG.filterSyntheticEvents).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.inputDebounceMs).toBeGreaterThan(0);
    expect(DEFAULT_CAPTURE_CONFIG.captureCoordinates).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.resolveSelect2).toBe(true);
  });
});
