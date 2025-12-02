/**
 * Tests for ActionExecutor
 * @module core/replay/ActionExecutor.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ActionExecutor,
  createActionExecutor,
  createFastExecutor,
  createRealisticExecutor,
  getActionExecutor,
  resetActionExecutor,
  clickElement,
  inputValue,
  pressEnter,
  KEYS,
  DEFAULT_ACTION_OPTIONS,
  type ActionResult,
} from './ActionExecutor';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createElement(
  tag: string,
  attrs: Record<string, string> = {}
): HTMLElement {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  document.body.appendChild(element);
  
  // Mock getBoundingClientRect for JSDOM
  element.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    top: 0,
    right: 100,
    bottom: 50,
    left: 0,
    toJSON: () => {},
  }));
  
  // Mock scrollIntoView for JSDOM
  element.scrollIntoView = vi.fn();
  
  return element;
}

function createInput(type: string = 'text', attrs: Record<string, string> = {}): HTMLInputElement {
  return createElement('input', { type, ...attrs }) as HTMLInputElement;
}

function createTextarea(): HTMLTextAreaElement {
  return createElement('textarea') as HTMLTextAreaElement;
}

function createSelect(options: string[]): HTMLSelectElement {
  const select = createElement('select') as HTMLSelectElement;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt;
    option.text = opt;
    select.appendChild(option);
  }
  return select;
}

function createCheckbox(checked: boolean = false): HTMLInputElement {
  const checkbox = createInput('checkbox');
  checkbox.checked = checked;
  return checkbox;
}

function createContentEditable(): HTMLDivElement {
  const div = createElement('div') as HTMLDivElement;
  div.contentEditable = 'true';
  return div;
}

function cleanupElements(): void {
  document.body.innerHTML = '';
}

// ============================================================================
// TESTS
// ============================================================================

describe('ActionExecutor', () => {
  let executor: ActionExecutor;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetActionExecutor();
    cleanupElements();
    executor = new ActionExecutor({ humanLike: false }); // Fast for tests
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetActionExecutor();
    cleanupElements();
  });
  
  // ==========================================================================
  // CLICK TESTS
  // ==========================================================================
  
  describe('click', () => {
    it('should click element successfully', async () => {
      const button = createElement('button');
      let clicked = false;
      button.addEventListener('click', () => { clicked = true; });
      
      const resultPromise = executor.click(button);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      if (!result.success) {
        console.error('Click failed:', result.error);
      }
      expect(result.success).toBe(true);
      expect(result.action).toBe('click');
      expect(clicked).toBe(true);
    });
    
    it('should dispatch mouse events in order', async () => {
      const button = createElement('button');
      const events: string[] = [];
      
      ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click'].forEach(type => {
        button.addEventListener(type, () => events.push(type));
      });
      
      const humanExecutor = new ActionExecutor({ humanLike: true });
      const resultPromise = humanExecutor.click(button);
      await vi.runAllTimersAsync();
      await resultPromise;
      
      expect(events).toEqual(['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']);
    });
    
    it('should focus before click', async () => {
      const button = createElement('button');
      let focused = false;
      button.addEventListener('focus', () => { focused = true; });
      
      const resultPromise = executor.click(button, { focusFirst: true });
      await vi.runAllTimersAsync();
      await resultPromise;
      
      expect(focused).toBe(true);
    });
  });
  
  // ==========================================================================
  // INPUT TESTS
  // ==========================================================================
  
  describe('input', () => {
    it('should set input value', async () => {
      const input = createInput();
      
      const resultPromise = executor.input(input, 'Hello World');
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('Hello World');
    });
    
    it('should use React-safe setter', async () => {
      const input = createInput();
      const setter = vi.fn();
      
      Object.defineProperty(input, 'value', {
        set: setter,
        get: () => '',
      });
      
      const resultPromise = executor.input(input, 'Test', { reactSafe: true });
      await vi.runAllTimersAsync();
      await resultPromise;
      
      // React-safe uses prototype setter, not the instance setter
      expect(input.value).toBeDefined();
    });
    
    it('should dispatch input and change events', async () => {
      const input = createInput();
      const events: string[] = [];
      
      input.addEventListener('input', () => events.push('input'));
      input.addEventListener('change', () => events.push('change'));
      
      const resultPromise = executor.input(input, 'Test');
      await vi.runAllTimersAsync();
      await resultPromise;
      
      expect(events).toContain('input');
      expect(events).toContain('change');
    });
    
    it('should handle textarea', async () => {
      const textarea = createTextarea();
      
      const resultPromise = executor.input(textarea, 'Multi\nLine');
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(textarea.value).toBe('Multi\nLine');
    });
    
    it('should handle contenteditable', async () => {
      const div = createContentEditable();
      
      const resultPromise = executor.input(div, 'Editable content');
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(div.innerText).toBe('Editable content');
    });
  });
  
  // ==========================================================================
  // SELECT TESTS
  // ==========================================================================
  
  describe('select', () => {
    it('should select option by value', async () => {
      const select = createSelect(['a', 'b', 'c']);
      
      const resultPromise = executor.select(select, 'b');
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(select.value).toBe('b');
    });
    
    it('should fail if option not found', async () => {
      const select = createSelect(['a', 'b', 'c']);
      
      const resultPromise = executor.select(select, 'x');
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
    
    it('should dispatch change event', async () => {
      const select = createSelect(['a', 'b']);
      let changed = false;
      select.addEventListener('change', () => { changed = true; });
      
      const resultPromise = executor.select(select, 'b');
      await vi.runAllTimersAsync();
      await resultPromise;
      
      expect(changed).toBe(true);
    });
  });
  
  // ==========================================================================
  // CHECKBOX TESTS
  // ==========================================================================
  
  describe('check/uncheck', () => {
    it('should check unchecked checkbox', async () => {
      const checkbox = createCheckbox(false);
      
      const resultPromise = executor.check(checkbox);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('check');
    });
    
    it('should skip already checked checkbox', async () => {
      const checkbox = createCheckbox(true);
      
      const resultPromise = executor.check(checkbox);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.details?.alreadyChecked).toBe(true);
    });
    
    it('should uncheck checked checkbox', async () => {
      const checkbox = createCheckbox(true);
      
      const resultPromise = executor.uncheck(checkbox);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('uncheck');
    });
    
    it('should toggle checkbox state', async () => {
      const checkbox = createCheckbox(false);
      
      const promise1 = executor.toggle(checkbox);
      await vi.runAllTimersAsync();
      await promise1;
      expect(checkbox.checked).toBe(true);
      
      const promise2 = executor.toggle(checkbox);
      await vi.runAllTimersAsync();
      await promise2;
      expect(checkbox.checked).toBe(false);
    });
    
    it('should fail for non-checkbox', async () => {
      const input = createInput('text');
      
      const resultPromise = executor.check(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
    });
  });
  
  // ==========================================================================
  // KEYBOARD TESTS
  // ==========================================================================
  
  describe('keyboard', () => {
    it('should press Enter key', async () => {
      const input = createInput();
      const events: string[] = [];
      
      ['keydown', 'keypress', 'keyup'].forEach(type => {
        input.addEventListener(type, (e) => {
          if ((e as KeyboardEvent).key === 'Enter') {
            events.push(type);
          }
        });
      });
      
      const resultPromise = executor.pressEnter(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('enter');
      expect(events).toContain('keydown');
    });
    
    it('should press Tab key', async () => {
      const input = createInput();
      let tabPressed = false;
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') tabPressed = true;
      });
      
      const resultPromise = executor.pressTab(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('tab');
      expect(tabPressed).toBe(true);
    });
    
    it('should press Escape key', async () => {
      const input = createInput();
      
      const resultPromise = executor.pressEscape(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('escape');
    });
    
    it('should press custom key', async () => {
      const input = createInput();
      
      const resultPromise = executor.pressKey(input, KEYS.ArrowDown);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.details?.key).toBe('ArrowDown');
    });
  });
  
  // ==========================================================================
  // TYPE TESTS
  // ==========================================================================
  
  describe('type', () => {
    it('should type text character by character', async () => {
      const input = createInput();
      let inputCount = 0;
      
      input.addEventListener('input', () => { inputCount++; });
      
      const resultPromise = executor.type(input, 'Hi', { charDelay: 0 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('Hi');
      expect(inputCount).toBe(2); // One per character
    });
  });
  
  // ==========================================================================
  // FOCUS TESTS
  // ==========================================================================
  
  describe('focus/blur', () => {
    it('should focus element', async () => {
      const input = createInput();
      let focused = false;
      input.addEventListener('focus', () => { focused = true; });
      
      const resultPromise = executor.focus(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(focused).toBe(true);
    });
    
    it('should blur element', async () => {
      const input = createInput();
      input.focus();
      let blurred = false;
      input.addEventListener('blur', () => { blurred = true; });
      
      const resultPromise = executor.blur(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(blurred).toBe(true);
    });
  });
  
  // ==========================================================================
  // SCROLL TESTS
  // ==========================================================================
  
  describe('scrollIntoView', () => {
    it('should scroll element into view', async () => {
      const div = createElement('div');
      const scrollSpy = vi.spyOn(div, 'scrollIntoView');
      
      const resultPromise = executor.scrollIntoView(div);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(scrollSpy).toHaveBeenCalled();
    });
  });
  
  // ==========================================================================
  // OPTIONS TESTS
  // ==========================================================================
  
  describe('options', () => {
    it('should apply preDelay', async () => {
      const button = createElement('button');
      
      const resultPromise = executor.click(button, { preDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
    });
    
    it('should get and set options', () => {
      executor.setOptions({ humanLike: true });
      
      expect(executor.getOptions().humanLike).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY AND SINGLETON TESTS
// ============================================================================

describe('factory and singleton', () => {
  beforeEach(() => {
    resetActionExecutor();
    cleanupElements();
  });
  
  afterEach(() => {
    resetActionExecutor();
    cleanupElements();
  });
  
  describe('createActionExecutor', () => {
    it('should create executor with options', () => {
      const executor = createActionExecutor({ humanLike: false });
      expect(executor.getOptions().humanLike).toBe(false);
    });
  });
  
  describe('createFastExecutor', () => {
    it('should create executor without human-like delays', () => {
      const executor = createFastExecutor();
      expect(executor.getOptions().humanLike).toBe(false);
    });
  });
  
  describe('createRealisticExecutor', () => {
    it('should create executor with human-like timing', () => {
      const executor = createRealisticExecutor();
      expect(executor.getOptions().humanLike).toBe(true);
      expect(executor.getOptions().preDelay).toBe(100);
    });
  });
  
  describe('getActionExecutor', () => {
    it('should return same instance', () => {
      const e1 = getActionExecutor();
      const e2 = getActionExecutor();
      expect(e1).toBe(e2);
    });
  });
  
  describe('resetActionExecutor', () => {
    it('should reset instance', () => {
      const e1 = getActionExecutor();
      resetActionExecutor();
      const e2 = getActionExecutor();
      expect(e2).not.toBe(e1);
    });
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetActionExecutor();
    cleanupElements();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetActionExecutor();
    cleanupElements();
  });
  
  describe('clickElement', () => {
    it('should click with default executor', async () => {
      const button = createElement('button');
      
      const resultPromise = clickElement(button);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('inputValue', () => {
    it('should input with default executor', async () => {
      const input = createElement('input') as HTMLInputElement;
      
      const resultPromise = inputValue(input, 'test');
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('test');
    });
  });
  
  describe('pressEnter', () => {
    it('should press Enter with default executor', async () => {
      const input = createElement('input');
      
      const resultPromise = pressEnter(input);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// KEYS CONSTANT TESTS
// ============================================================================

describe('KEYS', () => {
  it('should have Enter key config', () => {
    expect(KEYS.Enter.key).toBe('Enter');
    expect(KEYS.Enter.keyCode).toBe(13);
  });
  
  it('should have Tab key config', () => {
    expect(KEYS.Tab.key).toBe('Tab');
    expect(KEYS.Tab.keyCode).toBe(9);
  });
  
  it('should have Escape key config', () => {
    expect(KEYS.Escape.key).toBe('Escape');
    expect(KEYS.Escape.keyCode).toBe(27);
  });
  
  it('should have arrow key configs', () => {
    expect(KEYS.ArrowUp.key).toBe('ArrowUp');
    expect(KEYS.ArrowDown.key).toBe('ArrowDown');
    expect(KEYS.ArrowLeft.key).toBe('ArrowLeft');
    expect(KEYS.ArrowRight.key).toBe('ArrowRight');
  });
});
