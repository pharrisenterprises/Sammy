/**
 * WaitStrategy Test Suite
 * @module core/replay/WaitStrategy.test
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WaitStrategy,
  createWaitStrategy,
  DEFAULT_WAIT_TIMEOUT,
  DEFAULT_POLL_INTERVAL,
  WAIT_CONDITIONS,
  visible,
  hidden,
  enabled,
  disabled,
  hasText,
  hasValue,
  hasAttribute,
  satisfies,
  not,
} from './WaitStrategy';

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
    if (key === 'style') {
      element.setAttribute('style', value);
    } else if (key === 'className') {
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

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('WaitStrategy constants', () => {
  it('should have default timeout', () => {
    expect(DEFAULT_WAIT_TIMEOUT).toBe(30000);
  });
  
  it('should have default poll interval', () => {
    expect(DEFAULT_POLL_INTERVAL).toBe(100);
  });
  
  it('should have all wait conditions', () => {
    expect(WAIT_CONDITIONS.VISIBLE).toBe('visible');
    expect(WAIT_CONDITIONS.HIDDEN).toBe('hidden');
    expect(WAIT_CONDITIONS.ENABLED).toBe('enabled');
    expect(WAIT_CONDITIONS.STABLE).toBe('stable');
  });
});

// ============================================================================
// WAIT STRATEGY TESTS
// ============================================================================

describe('WaitStrategy', () => {
  let strategy: WaitStrategy;
  
  beforeEach(() => {
    strategy = createWaitStrategy({
      timeout: 1000,
      pollInterval: 50,
    });
  });
  
  afterEach(() => {
    cleanupElements();
  });
  
  describe('waitFor', () => {
    it('should wait for visible element', async () => {
      const div = createMockElement('div', { style: 'display: block;' });
      
      const result = await strategy.waitFor(div, { type: 'visible' });
      
      expect(result.success).toBe(true);
      expect(result.element).toBe(div);
    });
    
    it('should wait for element to become visible', async () => {
      const div = createMockElement('div', { style: 'display: none;' });
      
      // Make visible after delay
      setTimeout(() => {
        div.style.display = 'block';
      }, 100);
      
      const result = await strategy.waitFor(div, { type: 'visible' });
      
      expect(result.success).toBe(true);
    });
    
    it('should timeout when condition not met', async () => {
      const div = createMockElement('div', { style: 'display: none;' });
      
      const result = await strategy.waitFor(
        div,
        { type: 'visible' },
        { timeout: 200, throwOnTimeout: false }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should throw on timeout by default', async () => {
      const div = createMockElement('div', { style: 'display: none;' });
      
      await expect(
        strategy.waitFor(div, { type: 'visible' }, { timeout: 100 })
      ).rejects.toThrow(/timeout/i);
    });
    
    it('should support abort signal', async () => {
      const div = createMockElement('div', { style: 'display: none;' });
      const controller = new AbortController();
      
      // Abort after short delay
      setTimeout(() => controller.abort(), 50);
      
      const result = await strategy.waitFor(
        div,
        { type: 'visible' },
        { abortSignal: controller.signal, throwOnTimeout: false }
      );
      
      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('AbortError');
    });
  });
  
  describe('waitForAll', () => {
    it('should wait for all conditions', async () => {
      const button = createMockElement('button', {
        style: 'display: block;',
      }) as HTMLButtonElement;
      
      const result = await strategy.waitForAll(button, [
        { type: 'visible' },
        { type: 'enabled' },
      ]);
      
      expect(result.success).toBe(true);
    });
    
    it('should fail if any condition not met', async () => {
      const button = createMockElement('button', {
        style: 'display: block;',
        disabled: 'true',
      }) as HTMLButtonElement;
      
      const result = await strategy.waitForAll(
        button,
        [{ type: 'visible' }, { type: 'enabled' }],
        { timeout: 200, throwOnTimeout: false }
      );
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('waitForAny', () => {
    it('should succeed when any condition met', async () => {
      const div = createMockElement('div', { style: 'display: none;' });
      
      const result = await strategy.waitForAny(div, [
        { type: 'visible' },
        { type: 'hidden' },
      ]);
      
      expect(result.success).toBe(true);
      expect(result.condition.type).toBe('hidden');
    });
  });
  
  describe('waitForSelector', () => {
    it('should wait for selector to appear', async () => {
      // Create element after delay
      setTimeout(() => {
        createMockElement('div', { id: 'delayed' });
      }, 100);
      
      const result = await strategy.waitForSelector('#delayed');
      
      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
    });
    
    it('should return element immediately if exists', async () => {
      createMockElement('div', { id: 'exists' });
      
      const result = await strategy.waitForSelector('#exists');
      
      expect(result.success).toBe(true);
      expect(result.pollCount).toBe(1);
    });
  });
  
  describe('waitForSelectorToDisappear', () => {
    it('should wait for selector to disappear', async () => {
      const div = createMockElement('div', { id: 'disappear' });
      
      // Remove after delay
      setTimeout(() => {
        div.remove();
      }, 100);
      
      const result = await strategy.waitForSelectorToDisappear('#disappear');
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('visibility conditions', () => {
    it('should detect visible element', async () => {
      const div = createMockElement('div', {
        style: 'display: block; width: 100px; height: 100px;',
      });
      
      const result = await strategy.waitForVisible(div);
      
      expect(result.success).toBe(true);
    });
    
    it('should detect hidden element', async () => {
      const div = createMockElement('div', { style: 'display: none;' });
      
      const result = await strategy.waitForHidden(div);
      
      expect(result.success).toBe(true);
    });
    
    it('should detect element hidden by visibility', async () => {
      const div = createMockElement('div', { style: 'visibility: hidden;' });
      
      const result = await strategy.waitForHidden(div);
      
      expect(result.success).toBe(true);
    });
    
    it('should detect element hidden by opacity', async () => {
      const div = createMockElement('div', { style: 'opacity: 0;' });
      
      const result = await strategy.waitForHidden(div);
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('enabled/disabled conditions', () => {
    it('should detect enabled button', async () => {
      const button = createMockElement('button') as HTMLButtonElement;
      
      const result = await strategy.waitForEnabled(button);
      
      expect(result.success).toBe(true);
    });
    
    it('should detect disabled button', async () => {
      const button = createMockElement('button', {
        disabled: 'true',
      }) as HTMLButtonElement;
      
      const result = await strategy.waitFor(button, { type: 'disabled' });
      
      expect(result.success).toBe(true);
    });
    
    it('should wait for button to become enabled', async () => {
      const button = createMockElement('button', {
        disabled: 'true',
      }) as HTMLButtonElement;
      
      setTimeout(() => {
        button.disabled = false;
      }, 100);
      
      const result = await strategy.waitForEnabled(button);
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('text conditions', () => {
    it('should match exact text', async () => {
      const div = createMockElement('div', {}, 'Hello World');
      
      const result = await strategy.waitForText(div, 'Hello World');
      
      expect(result.success).toBe(true);
    });
    
    it('should match partial text', async () => {
      const div = createMockElement('div', {}, 'Hello World');
      
      const result = await strategy.waitForText(div, 'Hello');
      
      expect(result.success).toBe(true);
    });
    
    it('should match text with regex', async () => {
      const div = createMockElement('div', {}, 'Price: $100.00');
      
      const result = await strategy.waitForText(div, /\$\d+\.\d{2}/);
      
      expect(result.success).toBe(true);
    });
    
    it('should wait for text to change', async () => {
      const div = createMockElement('div', {}, 'Loading...');
      
      setTimeout(() => {
        div.textContent = 'Complete';
      }, 100);
      
      const result = await strategy.waitForText(div, 'Complete');
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('value conditions', () => {
    it('should match input value', async () => {
      const input = createMockElement('input') as HTMLInputElement;
      input.value = 'test value';
      
      const result = await strategy.waitForValue(input, 'test value');
      
      expect(result.success).toBe(true);
    });
    
    it('should match value with regex', async () => {
      const input = createMockElement('input') as HTMLInputElement;
      input.value = 'user@example.com';
      
      const result = await strategy.waitForValue(input, /@example\.com$/);
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('attribute conditions', () => {
    it('should check attribute exists', async () => {
      const div = createMockElement('div', { 'data-status': 'active' });
      
      const result = await strategy.waitFor(div, {
        type: 'attribute',
        attribute: 'data-status',
      });
      
      expect(result.success).toBe(true);
    });
    
    it('should check attribute value', async () => {
      const div = createMockElement('div', { 'data-status': 'active' });
      
      const result = await strategy.waitFor(div, {
        type: 'attribute',
        attribute: 'data-status',
        expected: 'active',
      });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('custom function conditions', () => {
    it('should support custom condition', async () => {
      createMockElement('div', { 'data-count': '5' });
      
      const result = await strategy.waitForFunction(() => {
        const el = document.querySelector('div[data-count]');
        return el ? parseInt(el.getAttribute('data-count') ?? '0') >= 5 : false;
      });
      
      expect(result.success).toBe(true);
    });
    
    it('should support async custom condition', async () => {
      createMockElement('div', { id: 'async-test' });
      
      const result = await strategy.waitForFunction(async () => {
        await new Promise(r => setTimeout(r, 10));
        return document.querySelector('#async-test') !== null;
      });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('page load conditions', () => {
    it('should detect DOM ready', async () => {
      const result = await strategy.waitForDomReady();
      
      expect(result.success).toBe(true);
    });
    
    it('should detect page load', async () => {
      const result = await strategy.waitForLoad();
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('stability conditions', () => {
    it('should detect stable element', async () => {
      const div = createMockElement('div', {
        style: 'width: 100px; height: 100px;',
      });
      
      const result = await strategy.waitForStable(div, {
        stabilityThreshold: 100,
        stabilityChecks: 2,
      });
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('simple wait', () => {
    it('should wait for specified time', async () => {
      const startTime = Date.now();
      
      await strategy.wait(100);
      
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(90);
    });
  });
});

// ============================================================================
// CONDITION BUILDER TESTS
// ============================================================================

describe('Condition builders', () => {
  let strategy: WaitStrategy;
  
  beforeEach(() => {
    strategy = createWaitStrategy({ timeout: 500, pollInterval: 50 });
  });
  
  afterEach(() => {
    cleanupElements();
  });
  
  it('should create visible condition', async () => {
    const div = createMockElement('div', { style: 'display: block;' });
    
    const result = await strategy.waitFor(div, visible());
    
    expect(result.success).toBe(true);
  });
  
  it('should create hidden condition', async () => {
    const div = createMockElement('div', { style: 'display: none;' });
    
    const result = await strategy.waitFor(div, hidden());
    
    expect(result.success).toBe(true);
  });
  
  it('should create enabled condition', async () => {
    const button = createMockElement('button') as HTMLButtonElement;
    
    const result = await strategy.waitFor(button, enabled());
    
    expect(result.success).toBe(true);
  });
  
  it('should create disabled condition', async () => {
    const button = createMockElement('button', { disabled: 'true' });
    
    const result = await strategy.waitFor(button, disabled());
    
    expect(result.success).toBe(true);
  });
  
  it('should create hasText condition', async () => {
    const div = createMockElement('div', {}, 'Hello');
    
    const result = await strategy.waitFor(div, hasText('Hello'));
    
    expect(result.success).toBe(true);
  });
  
  it('should create hasValue condition', async () => {
    const input = createMockElement('input') as HTMLInputElement;
    input.value = 'test';
    
    const result = await strategy.waitFor(input, hasValue('test'));
    
    expect(result.success).toBe(true);
  });
  
  it('should create hasAttribute condition', async () => {
    const div = createMockElement('div', { 'data-id': '123' });
    
    const result = await strategy.waitFor(div, hasAttribute('data-id', '123'));
    
    expect(result.success).toBe(true);
  });
  
  it('should create satisfies condition', async () => {
    const div = createMockElement('div', { 'data-count': '10' });
    
    const result = await strategy.waitFor(
      div,
      satisfies(el => parseInt(el?.getAttribute('data-count') ?? '0') > 5)
    );
    
    expect(result.success).toBe(true);
  });
  
  it('should negate condition', async () => {
    const div = createMockElement('div', { style: 'display: block;' });
    
    const result = await strategy.waitFor(div, not(hidden()));
    
    expect(result.success).toBe(true);
  });
  
  it('should double-negate condition', async () => {
    const div = createMockElement('div', { style: 'display: block;' });
    
    const result = await strategy.waitFor(div, not(not(visible())));
    
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// OPTIONS TESTS
// ============================================================================

describe('WaitStrategy options', () => {
  it('should use custom timeout', async () => {
    const strategy = createWaitStrategy({ timeout: 100 });
    const div = createMockElement('div', { style: 'display: none;' });
    
    const startTime = Date.now();
    
    await strategy.waitFor(
      div,
      { type: 'visible' },
      { throwOnTimeout: false }
    ).catch(() => {});
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(250); // Allow some margin for test timing
  });
  
  it('should use custom poll interval', async () => {
    const strategy = createWaitStrategy({ pollInterval: 10 });
    const div = createMockElement('div', { style: 'display: none;' });
    
    const result = await strategy.waitFor(
      div,
      { type: 'visible' },
      { timeout: 100, throwOnTimeout: false }
    );
    
    // With 10ms interval and 100ms timeout, should poll ~10 times
    expect(result.pollCount).toBeGreaterThan(5);
  });
  
  it('should update default options', async () => {
    const strategy = createWaitStrategy();
    strategy.setDefaultOptions({ timeout: 100 });
    
    const div = createMockElement('div', { style: 'display: none;' });
    
    const startTime = Date.now();
    
    await strategy.waitFor(
      div,
      { type: 'visible' },
      { throwOnTimeout: false }
    );
    
    expect(Date.now() - startTime).toBeLessThan(200);
  });
});
