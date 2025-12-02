/**
 * ActionExecutor Test Suite
 * @module core/replay/ActionExecutor.test
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ActionExecutor,
  createActionExecutor,
  DEFAULT_ACTION_TIMEOUT,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_TYPING_DELAY,
  ACTION_TYPES,
  type ActionContext,
} from './ActionExecutor';
import type { RecordedStep } from '../types/step';

// ============================================================================
// MOCK DOM SETUP
// ============================================================================

function createMockElement(
  tag: string,
  attrs: Record<string, string> = {},
  textContent?: string
): HTMLElement {
  const element = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  
  if (textContent) {
    element.textContent = textContent;
  }
  
  document.body.appendChild(element);
  return element;
}

function cleanupElements(): void {
  document.body.innerHTML = '';
}

function createMockStep(overrides: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: 'step-1',
    name: 'Test Step',
    type: 'click',
    event: 'click',
    timestamp: Date.now(),
    target: {
      tagName: 'button',
      xpath: '/html/body/button',
      cssSelector: 'button',
    },
    path: '/html/body/button',
    value: '',
    label: '',
    ...overrides,
  };
}

function createMockContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    step: createMockStep(),
    timeout: 5000,
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('ActionExecutor constants', () => {
  it('should have default timeout', () => {
    expect(DEFAULT_ACTION_TIMEOUT).toBe(30000);
  });
  
  it('should have poll interval', () => {
    expect(DEFAULT_POLL_INTERVAL).toBe(100);
  });
  
  it('should have typing delay', () => {
    expect(DEFAULT_TYPING_DELAY).toBe(50);
  });
  
  it('should have all action types', () => {
    expect(ACTION_TYPES).toContain('click');
    expect(ACTION_TYPES).toContain('input');
    expect(ACTION_TYPES).toContain('navigate');
    expect(ACTION_TYPES).toContain('assert');
  });
});

// ============================================================================
// EXECUTOR TESTS
// ============================================================================

describe('ActionExecutor', () => {
  let executor: ActionExecutor;
  
  beforeEach(() => {
    executor = createActionExecutor({
      timeout: 5000,
      pollInterval: 50,
    });
  });
  
  afterEach(() => {
    cleanupElements();
  });
  
  describe('click action', () => {
    it('should click element', async () => {
      const button = createMockElement('button', { id: 'test-btn' });
      const clickHandler = vi.fn();
      button.addEventListener('click', clickHandler);
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '#test-btn', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(result.elementFound).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });
    
    it('should fail when element not found', async () => {
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '#nonexistent', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({
        step,
        timeout: 100,
      }));
      
      expect(result.success).toBe(false);
      expect(result.elementFound).toBe(false);
    });
  });
  
  describe('input action', () => {
    it('should type into input', async () => {
      const input = createMockElement('input', {
        id: 'test-input',
        type: 'text',
      }) as HTMLInputElement;
      
      const step = createMockStep({
        type: 'input',
        target: { tagName: 'input', cssSelector: '#test-input', xpath: '' },
        value: 'hello world',
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('hello world');
      expect(result.actualValue).toBe('hello world');
    });
    
    it('should clear existing value', async () => {
      const input = createMockElement('input', {
        id: 'test-input',
        type: 'text',
      }) as HTMLInputElement;
      input.value = 'existing';
      
      const step = createMockStep({
        type: 'input',
        target: { tagName: 'input', cssSelector: '#test-input', xpath: '' },
        value: 'new value',
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('new value');
    });
  });
  
  describe('select action', () => {
    it('should select option by value', async () => {
      const select = createMockElement('select', { id: 'test-select' }) as HTMLSelectElement;
      const option1 = document.createElement('option');
      option1.value = 'opt1';
      option1.text = 'Option 1';
      const option2 = document.createElement('option');
      option2.value = 'opt2';
      option2.text = 'Option 2';
      select.appendChild(option1);
      select.appendChild(option2);
      
      const step = createMockStep({
        type: 'select',
        target: { tagName: 'select', cssSelector: '#test-select', xpath: '' },
        value: 'opt2',
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(select.value).toBe('opt2');
    });
    
    it('should select option by text', async () => {
      const select = createMockElement('select', { id: 'test-select' }) as HTMLSelectElement;
      const option = document.createElement('option');
      option.value = 'val';
      option.text = 'My Option';
      select.appendChild(option);
      
      const step = createMockStep({
        type: 'select',
        target: { tagName: 'select', cssSelector: '#test-select', xpath: '' },
        value: 'My Option',
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(select.value).toBe('val');
    });
  });
  
  describe('keypress action', () => {
    it('should dispatch keyboard events', async () => {
      const input = createMockElement('input', { id: 'test-input' });
      const keydownHandler = vi.fn();
      input.addEventListener('keydown', keydownHandler);
      input.focus();
      
      const step = createMockStep({
        type: 'keypress',
        target: { tagName: 'input', cssSelector: '#test-input', xpath: '' },
        value: 'Enter',
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(keydownHandler).toHaveBeenCalled();
    });
    
    it('should support modifier keys', async () => {
      const input = createMockElement('input', { id: 'test-input' });
      let capturedEvent: KeyboardEvent | null = null;
      input.addEventListener('keydown', (e) => { capturedEvent = e as KeyboardEvent; });
      input.focus();
      
      const step = createMockStep({
        type: 'keypress',
        target: { tagName: 'input', cssSelector: '#test-input', xpath: '' },
        value: 'a',
        metadata: { modifiers: { ctrl: true, shift: true } },
      });
      
      await executor.execute(step, createMockContext({ step }));
      
      expect(capturedEvent?.ctrlKey).toBe(true);
      expect(capturedEvent?.shiftKey).toBe(true);
    });
  });
  
  describe('assert action', () => {
    it('should assert element exists', async () => {
      createMockElement('div', { id: 'exists' });
      
      const step = createMockStep({
        type: 'assert',
        target: { tagName: 'div', cssSelector: '#exists', xpath: '' },
        metadata: { assertion: { type: 'exists' } },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
    });
    
    it('should assert element text', async () => {
      createMockElement('div', { id: 'text-el' }, 'Hello World');
      
      const step = createMockStep({
        type: 'assert',
        target: { tagName: 'div', cssSelector: '#text-el', xpath: '' },
        metadata: { assertion: { type: 'text', expected: 'Hello World' } },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
    });
    
    it('should fail assertion when text mismatch', async () => {
      createMockElement('div', { id: 'text-el' }, 'Actual Text');
      
      const step = createMockStep({
        type: 'assert',
        target: { tagName: 'div', cssSelector: '#text-el', xpath: '' },
        metadata: { assertion: { type: 'text', expected: 'Expected Text' } },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(false);
      expect(result.actualValue).toBe('Actual Text');
    });
    
    it('should assert element value', async () => {
      const input = createMockElement('input', { id: 'val-el' }) as HTMLInputElement;
      input.value = 'test value';
      
      const step = createMockStep({
        type: 'assert',
        target: { tagName: 'input', cssSelector: '#val-el', xpath: '' },
        metadata: { assertion: { type: 'value', expected: 'test value' } },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
    });
    
    it('should assert element attribute', async () => {
      createMockElement('button', { id: 'btn', disabled: 'true' });
      
      const step = createMockStep({
        type: 'assert',
        target: { tagName: 'button', cssSelector: '#btn', xpath: '' },
        metadata: { assertion: { type: 'attribute', attribute: 'disabled', expected: 'true' } },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('hover action', () => {
    it('should trigger hover events', async () => {
      const div = createMockElement('div', { id: 'hover-el' });
      const mouseoverHandler = vi.fn();
      div.addEventListener('mouseover', mouseoverHandler);
      
      const step = createMockStep({
        type: 'hover',
        target: { tagName: 'div', cssSelector: '#hover-el', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(mouseoverHandler).toHaveBeenCalled();
    });
  });
  
  describe('focus/blur actions', () => {
    it('should focus element', async () => {
      const input = createMockElement('input', { id: 'focus-el' });
      
      const step = createMockStep({
        type: 'focus',
        target: { tagName: 'input', cssSelector: '#focus-el', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(document.activeElement).toBe(input);
    });
    
    it('should blur element', async () => {
      const input = createMockElement('input', { id: 'blur-el' }) as HTMLInputElement;
      input.focus();
      
      const step = createMockStep({
        type: 'blur',
        target: { tagName: 'input', cssSelector: '#blur-el', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(document.activeElement).not.toBe(input);
    });
  });
  
  describe('scroll action', () => {
    it('should scroll element', async () => {
      const div = createMockElement('div', {
        id: 'scroll-el',
        style: 'height: 100px; overflow: auto;',
      });
      div.innerHTML = '<div style="height: 500px;"></div>';
      
      const step = createMockStep({
        type: 'scroll',
        target: { tagName: 'div', cssSelector: '#scroll-el', xpath: '' },
        metadata: { scrollY: 200 },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(div.scrollTop).toBe(200);
    });
  });
  
  describe('wait action', () => {
    it('should wait for time', async () => {
      const startTime = Date.now();
      
      const step = createMockStep({
        type: 'wait',
        target: { tagName: '', xpath: '', cssSelector: '' },
        metadata: { waitType: 'time', waitTime: 100 },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(90);
    });
    
    it('should wait for element', async () => {
      // Create element after delay
      setTimeout(() => {
        createMockElement('div', { id: 'delayed-el' });
      }, 50);
      
      const step = createMockStep({
        type: 'wait',
        target: { tagName: 'div', cssSelector: '#delayed-el', xpath: '' },
        metadata: { waitType: 'element' },
      });
      
      const result = await executor.execute(step, createMockContext({
        step,
        timeout: 1000,
      }));
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('element location', () => {
    it('should locate by id', async () => {
      createMockElement('button', { id: 'by-id' });
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', id: 'by-id', xpath: '', cssSelector: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(result.locatorUsed).toBe('id');
    });
    
    it('should locate by data-testid', async () => {
      createMockElement('button', { 'data-testid': 'my-button' });
      
      const step = createMockStep({
        type: 'click',
        target: {
          tagName: 'button',
          xpath: '',
          cssSelector: '',
          attributes: { 'data-testid': 'my-button' },
        },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(result.locatorUsed).toBe('data-testid');
    });
    
    it('should locate by css selector', async () => {
      createMockElement('button', { className: 'btn primary' });
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', xpath: '', cssSelector: 'button.btn.primary' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(result.locatorUsed).toBe('css');
    });
    
    it.skip('should locate by xpath', async () => {
      // Skip: happy-dom doesn't fully support XPath
      createMockElement('button', { id: 'xpath-btn' });
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '', xpath: '//button[@id="xpath-btn"]' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(result.success).toBe(true);
      expect(result.locatorUsed).toBe('xpath');
    });
  });
  
  describe('statistics', () => {
    it('should track execution stats', async () => {
      createMockElement('button', { id: 'btn' });
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '#btn', xpath: '' },
      });
      
      await executor.execute(step, createMockContext({ step }));
      await executor.execute(step, createMockContext({ step }));
      
      const stats = executor.getStats();
      
      expect(stats.actionsExecuted).toBe(2);
      expect(stats.actionsSucceeded).toBe(2);
    });
    
    it('should track failed actions', async () => {
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '#nonexistent', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step, timeout: 100 }));
      
      expect(result.success).toBe(false);
      
      const stats = executor.getStats();
      
      expect(stats.actionsFailed).toBe(1);
    });
    
    it('should reset stats', async () => {
      createMockElement('button', { id: 'btn' });
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '#btn', xpath: '' },
      });
      
      await executor.execute(step, createMockContext({ step }));
      
      executor.resetStats();
      
      const stats = executor.getStats();
      expect(stats.actionsExecuted).toBe(0);
    });
  });
  
  describe('custom handlers', () => {
    it('should use custom handler', async () => {
      const customHandler = vi.fn().mockResolvedValue({
        success: true,
        duration: 10,
        elementFound: true,
        data: { custom: true },
      });
      
      executor.registerHandler('click', customHandler);
      
      createMockElement('button', { id: 'btn' });
      
      const step = createMockStep({
        type: 'click',
        target: { tagName: 'button', cssSelector: '#btn', xpath: '' },
      });
      
      const result = await executor.execute(step, createMockContext({ step }));
      
      expect(customHandler).toHaveBeenCalled();
      expect(result.data?.custom).toBe(true);
    });
  });
});

// ============================================================================
// WAIT CONDITIONS TESTS
// ============================================================================

describe('ActionExecutor wait conditions', () => {
  let executor: ActionExecutor;
  
  beforeEach(() => {
    executor = createActionExecutor({ pollInterval: 10 });
  });
  
  afterEach(() => {
    cleanupElements();
  });
  
  it.skip('should wait for visible state', async () => {
    // Skip: happy-dom doesn't properly handle async style changes in setTimeout
    const div = createMockElement('div', {
      id: 'hidden',
      style: 'display: none;',
    });
    
    // Make visible after delay
    const timeoutId = setTimeout(() => {
      (div as HTMLElement).style.display = 'block';
    }, 50);
    
    try {
      const result = await executor.waitForState(div, 'visible', 1000);
      expect(result).toBe(true);
    } finally {
      clearTimeout(timeoutId);
    }
  });
  
  it('should wait for enabled state', async () => {
    const button = createMockElement('button', {
      id: 'disabled-btn',
      disabled: 'true',
    }) as HTMLButtonElement;
    
    // Enable after delay
    setTimeout(() => {
      button.disabled = false;
    }, 50);
    
    const result = await executor.waitForState(button, 'enabled', 1000);
    
    expect(result).toBe(true);
  });
  
  it('should timeout when condition not met', async () => {
    const div = createMockElement('div', {
      style: 'display: none;',
    });
    
    const result = await executor.waitForState(div, 'visible', 100);
    
    expect(result).toBe(false);
  });
});
