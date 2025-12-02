/**
 * Tests for InputChangeTracker
 * @module core/recording/InputChangeTracker.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InputChangeTracker,
  createInputChangeTracker,
  createFastTracker,
  createVerboseTracker,
  getInputChangeTracker,
  resetInputChangeTracker,
  getElementValue,
  getElementInputType,
  isTrackableInput,
  isImmediateInputType,
  isDebouncedInputType,
  DEFAULT_TRACKER_CONFIG,
  type ValueChangeEvent,
  type TrackableInputType,
} from './InputChangeTracker';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a text input
 */
function createTextInput(value: string = ''): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  document.body.appendChild(input);
  return input;
}

/**
 * Create a checkbox input
 */
function createCheckbox(checked: boolean = false): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  document.body.appendChild(input);
  return input;
}

/**
 * Create a radio input
 */
function createRadio(value: string, checked: boolean = false): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'radio';
  input.value = value;
  input.checked = checked;
  document.body.appendChild(input);
  return input;
}

/**
 * Create a select element
 */
function createSelect(options: string[], selectedIndex: number = 0): HTMLSelectElement {
  const select = document.createElement('select');
  options.forEach((opt, i) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    option.selected = i === selectedIndex;
    select.appendChild(option);
  });
  document.body.appendChild(select);
  return select;
}

/**
 * Create a textarea
 */
function createTextarea(value: string = ''): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  return textarea;
}

/**
 * Create a contenteditable div
 */
function createContentEditable(content: string = ''): HTMLDivElement {
  const div = document.createElement('div');
  div.setAttribute('contenteditable', 'true');
  div.textContent = content;
  document.body.appendChild(div);
  return div;
}

/**
 * Simulate input event
 */
function simulateInput(element: Element, value?: string): void {
  if (value !== undefined) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = value;
    } else {
      element.textContent = value;
    }
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Simulate change event
 */
function simulateChange(element: Element): void {
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Wait for debounce
 */
async function waitForDebounce(ms: number = 350): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TESTS
// ============================================================================

describe('InputChangeTracker', () => {
  let tracker: InputChangeTracker;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetInputChangeTracker();
    tracker = new InputChangeTracker();
    tracker.start();
  });
  
  afterEach(() => {
    tracker.stop();
    document.body.innerHTML = '';
    resetInputChangeTracker();
    vi.useRealTimers();
  });
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  describe('lifecycle', () => {
    it('should start inactive', () => {
      const newTracker = new InputChangeTracker();
      expect(newTracker.getIsActive()).toBe(false);
    });
    
    it('should become active after start', () => {
      const newTracker = new InputChangeTracker();
      newTracker.start();
      expect(newTracker.getIsActive()).toBe(true);
      newTracker.stop();
    });
    
    it('should become inactive after stop', () => {
      tracker.stop();
      expect(tracker.getIsActive()).toBe(false);
    });
  });
  
  // ==========================================================================
  // TRACKING
  // ==========================================================================
  
  describe('tracking', () => {
    it('should start tracking element', () => {
      const input = createTextInput('initial');
      
      const result = tracker.startTracking(input);
      
      expect(result).toBe(true);
      expect(tracker.isTracking(input)).toBe(true);
    });
    
    it('should not track same element twice', () => {
      const input = createTextInput();
      
      tracker.startTracking(input);
      const result = tracker.startTracking(input);
      
      expect(result).toBe(false);
    });
    
    it('should capture initial value', () => {
      const input = createTextInput('hello');
      
      tracker.startTracking(input);
      
      expect(tracker.getInitialValue(input)).toBe('hello');
    });
    
    it('should stop tracking element', () => {
      const input = createTextInput();
      tracker.startTracking(input);
      
      const result = tracker.stopTracking(input);
      
      expect(result).toBe(true);
    });
  });
  
  // ==========================================================================
  // VALUE EXTRACTION
  // ==========================================================================
  
  describe('getValue', () => {
    it('should get text input value', () => {
      const input = createTextInput('test value');
      
      expect(tracker.getValue(input)).toBe('test value');
    });
    
    it('should get checkbox value', () => {
      const checkbox = createCheckbox(true);
      
      expect(tracker.getValue(checkbox)).toBe('true');
    });
    
    it('should get unchecked checkbox value', () => {
      const checkbox = createCheckbox(false);
      
      expect(tracker.getValue(checkbox)).toBe('false');
    });
    
    it('should get radio value when checked', () => {
      const radio = createRadio('option1', true);
      
      expect(tracker.getValue(radio)).toBe('option1');
    });
    
    it('should get empty for unchecked radio', () => {
      const radio = createRadio('option1', false);
      
      expect(tracker.getValue(radio)).toBe('');
    });
    
    it('should get select value', () => {
      const select = createSelect(['a', 'b', 'c'], 1);
      
      expect(tracker.getValue(select)).toBe('b');
    });
    
    it('should get textarea value', () => {
      const textarea = createTextarea('multi\nline');
      
      expect(tracker.getValue(textarea)).toBe('multi\nline');
    });
    
    it('should get contenteditable value', () => {
      const div = createContentEditable('editable content');
      
      expect(tracker.getValue(div)).toBe('editable content');
    });
  });
  
  // ==========================================================================
  // INPUT TYPE DETECTION
  // ==========================================================================
  
  describe('getInputType', () => {
    it('should detect text input', () => {
      const input = createTextInput();
      expect(tracker.getInputType(input)).toBe('text');
    });
    
    it('should detect checkbox', () => {
      const checkbox = createCheckbox();
      expect(tracker.getInputType(checkbox)).toBe('checkbox');
    });
    
    it('should detect radio', () => {
      const radio = createRadio('opt');
      expect(tracker.getInputType(radio)).toBe('radio');
    });
    
    it('should detect select', () => {
      const select = createSelect(['a', 'b']);
      expect(tracker.getInputType(select)).toBe('select');
    });
    
    it('should detect textarea', () => {
      const textarea = createTextarea();
      expect(tracker.getInputType(textarea)).toBe('textarea');
    });
    
    it('should detect contenteditable', () => {
      const div = createContentEditable();
      expect(tracker.getInputType(div)).toBe('contenteditable');
    });
  });
  
  // ==========================================================================
  // DEBOUNCING
  // ==========================================================================
  
  describe('debouncing', () => {
    it('should debounce text input changes', () => {
      const input = createTextInput();
      const callback = vi.fn();
      tracker.onValueChange(callback);
      tracker.startTracking(input);
      
      input.value = 'h';
      tracker.handleInput({ target: input } as Event);
      input.value = 'he';
      tracker.handleInput({ target: input } as Event);
      input.value = 'hel';
      tracker.handleInput({ target: input } as Event);
      
      // Should not emit yet
      expect(callback).not.toHaveBeenCalled();
      
      // Fast-forward past debounce
      vi.advanceTimersByTime(DEFAULT_TRACKER_CONFIG.debounceDelay + 50);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: 'hel',
          isFinal: true,
        })
      );
    });
    
    it('should immediately emit checkbox changes', () => {
      const checkbox = createCheckbox(false);
      const callback = vi.fn();
      tracker.onValueChange(callback);
      tracker.startTracking(checkbox);
      
      checkbox.checked = true;
      tracker.handleInput({ target: checkbox } as Event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('should immediately emit select changes', () => {
      const select = createSelect(['a', 'b', 'c']);
      const callback = vi.fn();
      tracker.onValueChange(callback);
      tracker.startTracking(select);
      
      select.value = 'b';
      tracker.handleChange({ target: select } as Event);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
  
  // ==========================================================================
  // CHANGE DETECTION
  // ==========================================================================
  
  describe('hasChanged', () => {
    it('should detect changed value', () => {
      const input = createTextInput('initial');
      tracker.startTracking(input);
      
      input.value = 'changed';
      tracker.handleInput({ target: input } as Event);
      vi.advanceTimersByTime(400);
      
      expect(tracker.hasChanged(input)).toBe(true);
    });
    
    it('should not detect unchanged value', () => {
      const input = createTextInput('initial');
      tracker.startTracking(input);
      
      expect(tracker.hasChanged(input)).toBe(false);
    });
    
    it('should reset hasChanged on resetTracking', () => {
      const input = createTextInput('initial');
      tracker.startTracking(input);
      
      input.value = 'changed';
      tracker.handleInput({ target: input } as Event);
      vi.advanceTimersByTime(400);
      
      tracker.resetTracking(input);
      
      expect(tracker.hasChanged(input)).toBe(false);
      expect(tracker.getInitialValue(input)).toBe('changed');
    });
  });
  
  // ==========================================================================
  // CALLBACKS
  // ==========================================================================
  
  describe('callbacks', () => {
    it('should emit value change event', () => {
      const input = createTextInput('');
      const callback = vi.fn();
      
      tracker.onValueChange(callback);
      tracker.startTracking(input);
      
      input.value = 'new value';
      tracker.handleInput({ target: input } as Event);
      vi.advanceTimersByTime(400);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          element: input,
          previousValue: '',
          newValue: 'new value',
          inputType: 'text',
          isFinal: true,
        })
      );
    });
    
    it('should allow unsubscribing', () => {
      const input = createTextInput();
      const callback = vi.fn();
      
      const unsubscribe = tracker.onValueChange(callback);
      tracker.startTracking(input);
      
      unsubscribe();
      
      input.value = 'test';
      tracker.handleInput({ target: input } as Event);
      vi.advanceTimersByTime(400);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  // ==========================================================================
  // BLUR HANDLING
  // ==========================================================================
  
  describe('blur handling', () => {
    it('should flush debounce on blur', () => {
      const input = createTextInput('');
      const callback = vi.fn();
      
      tracker.onValueChange(callback);
      tracker.startTracking(input);
      
      input.value = 'typed';
      tracker.handleInput({ target: input } as Event);
      
      // Should not emit yet (within debounce)
      expect(callback).not.toHaveBeenCalled();
      
      // Blur should flush
      tracker.handleBlur({ target: input } as Event);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: 'typed',
          isFinal: true,
        })
      );
    });
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should respect custom debounce delay', () => {
      const customTracker = new InputChangeTracker({ debounceDelay: 500 });
      customTracker.start();
      
      const input = createTextInput();
      const callback = vi.fn();
      
      customTracker.onValueChange(callback);
      customTracker.startTracking(input);
      
      input.value = 'test';
      customTracker.handleInput({ target: input } as Event);
      
      vi.advanceTimersByTime(300);
      expect(callback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(250);
      expect(callback).toHaveBeenCalled();
      
      customTracker.stop();
    });
    
    it('should emit intermediate changes when configured', () => {
      const verboseTracker = new InputChangeTracker({
        emitIntermediateChanges: true,
        debounceDelay: 300,
      });
      verboseTracker.start();
      
      const input = createTextInput('');
      const callback = vi.fn();
      
      verboseTracker.onValueChange(callback);
      verboseTracker.startTracking(input);
      
      input.value = 'a';
      verboseTracker.handleInput({ target: input } as Event);
      
      // Should emit intermediate
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isFinal: false,
        })
      );
      
      verboseTracker.stop();
    });
    
    it('should update config', () => {
      tracker.setConfig({ debounceDelay: 500 });
      
      expect(tracker.getConfig().debounceDelay).toBe(500);
    });
  });
  
  // ==========================================================================
  // FLUSH ALL
  // ==========================================================================
  
  describe('flushAllDebounces', () => {
    it('should flush all pending debounces', () => {
      const input1 = createTextInput('');
      const input2 = createTextInput('');
      const callback = vi.fn();
      
      tracker.onValueChange(callback);
      tracker.startTracking(input1);
      tracker.startTracking(input2);
      
      input1.value = 'value1';
      input2.value = 'value2';
      tracker.handleInput({ target: input1 } as unknown as Event);
      tracker.handleInput({ target: input2 } as unknown as Event);
      
      expect(callback).not.toHaveBeenCalled();
      
      tracker.flushAllDebounces();
      
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  afterEach(() => {
    resetInputChangeTracker();
    document.body.innerHTML = '';
  });
  
  it('createInputChangeTracker should create tracker', () => {
    const tracker = createInputChangeTracker();
    expect(tracker).toBeInstanceOf(InputChangeTracker);
  });
  
  it('createFastTracker should have short debounce', () => {
    const tracker = createFastTracker();
    expect(tracker.getConfig().debounceDelay).toBe(150);
  });
  
  it('createVerboseTracker should emit intermediate', () => {
    const tracker = createVerboseTracker();
    expect(tracker.getConfig().emitIntermediateChanges).toBe(true);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  afterEach(() => {
    resetInputChangeTracker();
    document.body.innerHTML = '';
  });
  
  it('should return same instance', () => {
    const tracker1 = getInputChangeTracker();
    const tracker2 = getInputChangeTracker();
    
    expect(tracker1).toBe(tracker2);
  });
  
  it('should reset instance', () => {
    const tracker1 = getInputChangeTracker();
    resetInputChangeTracker();
    const tracker2 = getInputChangeTracker();
    
    expect(tracker1).not.toBe(tracker2);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  afterEach(() => {
    resetInputChangeTracker();
    document.body.innerHTML = '';
  });
  
  describe('getElementValue', () => {
    it('should get value from input', () => {
      const input = document.createElement('input');
      input.value = 'test';
      document.body.appendChild(input);
      
      expect(getElementValue(input)).toBe('test');
    });
  });
  
  describe('getElementInputType', () => {
    it('should detect input type', () => {
      const input = document.createElement('input');
      input.type = 'email';
      document.body.appendChild(input);
      
      expect(getElementInputType(input)).toBe('email');
    });
  });
  
  describe('isTrackableInput', () => {
    it('should return true for trackable input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      expect(isTrackableInput(input)).toBe(true);
    });
    
    it('should return false for non-input', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      expect(isTrackableInput(div)).toBe(false);
    });
  });
  
  describe('isImmediateInputType', () => {
    it('should return true for checkbox', () => {
      expect(isImmediateInputType('checkbox')).toBe(true);
    });
    
    it('should return false for text', () => {
      expect(isImmediateInputType('text')).toBe(false);
    });
  });
  
  describe('isDebouncedInputType', () => {
    it('should return true for text', () => {
      expect(isDebouncedInputType('text')).toBe(true);
    });
    
    it('should return false for checkbox', () => {
      expect(isDebouncedInputType('checkbox')).toBe(false);
    });
  });
});
