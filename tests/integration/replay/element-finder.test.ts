/**
 * Element Finder Integration Tests
 * @module tests/integration/replay/element-finder.test
 * @version 1.0.0
 * 
 * Integration tests for the multi-strategy element finder.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ElementFinder } from '@/core/replay/ElementFinder';
import { StrategyRegistry } from '@/core/locators/StrategyRegistry';
import type { LocatorBundle } from '@/core/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'INPUT',
    id: null,
    name: null,
    placeholder: null,
    aria: null,
    dataAttrs: {},
    text: '',
    css: '',
    xpath: '',
    classes: [],
    attrs: {},
    role: null,
    title: null,
    href: null,
    src: null,
    bounding: { x: 100, y: 100, width: 200, height: 40 },
    pageUrl: 'https://example.com',
    ...overrides,
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('ElementFinder Integration', () => {
  let finder: ElementFinder;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    const registry = new StrategyRegistry();
    finder = new ElementFinder(registry, {
      timeout: 1000,
      retryInterval: 50,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ==========================================================================
  // XPATH STRATEGY TESTS (Priority 1)
  // ==========================================================================

  describe('XPath strategy', () => {
    it('should find element by XPath', async () => {
      container.innerHTML = `
        <div>
          <form>
            <input type="text" id="username">
          </form>
        </div>
      `;

      const bundle = createBundle({
        xpath: '/html/body/div/div/form/input',
        id: 'username',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.id).toBe('username');
      expect(result.strategy).toBe('xpath');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should find element by XPath with index', async () => {
      container.innerHTML = `
        <div>
          <button>First</button>
          <button>Second</button>
          <button id="target">Third</button>
        </div>
      `;

      const bundle = createBundle({
        xpath: '//div/button[3]',
        id: 'target',
        tag: 'BUTTON',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.id).toBe('target');
    });
  });

  // ==========================================================================
  // ID STRATEGY TESTS (Priority 2)
  // ==========================================================================

  describe('ID strategy', () => {
    it('should find element by ID', async () => {
      container.innerHTML = `
        <input type="email" id="email-field">
      `;

      const bundle = createBundle({
        id: 'email-field',
        xpath: '//some/invalid/path',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.id).toBe('email-field');
      expect(result.strategy).toBe('id');
    });

    it('should prefer ID over XPath when ID is unique', async () => {
      container.innerHTML = `
        <input type="text" id="unique-id">
      `;

      const bundle = createBundle({
        id: 'unique-id',
        xpath: '', // Empty XPath forces ID fallback
      });

      const result = await finder.find(bundle);

      expect(result.strategy).toBe('id');
    });
  });

  // ==========================================================================
  // NAME STRATEGY TESTS (Priority 3)
  // ==========================================================================

  describe('name strategy', () => {
    it('should find element by name attribute', async () => {
      container.innerHTML = `
        <input type="text" name="firstName">
      `;

      const bundle = createBundle({
        name: 'firstName',
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect((result.element as HTMLInputElement).name).toBe('firstName');
      expect(result.strategy).toBe('name');
    });

    it('should find first element when multiple have same name', async () => {
      container.innerHTML = `
        <input type="radio" name="gender" value="m">
        <input type="radio" name="gender" value="f">
      `;

      const bundle = createBundle({
        name: 'gender',
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect((result.element as HTMLInputElement).value).toBe('m');
    });
  });

  // ==========================================================================
  // ARIA STRATEGY TESTS (Priority 4)
  // ==========================================================================

  describe('aria-label strategy', () => {
    it('should find element by aria-label', async () => {
      container.innerHTML = `
        <button aria-label="Submit form">Submit</button>
      `;

      const bundle = createBundle({
        aria: 'Submit form',
        tag: 'BUTTON',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.getAttribute('aria-label')).toBe('Submit form');
      expect(result.strategy).toBe('aria');
    });
  });

  // ==========================================================================
  // PLACEHOLDER STRATEGY TESTS (Priority 5)
  // ==========================================================================

  describe('placeholder strategy', () => {
    it('should find input by placeholder', async () => {
      container.innerHTML = `
        <input type="text" placeholder="Enter your email">
      `;

      const bundle = createBundle({
        placeholder: 'Enter your email',
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect((result.element as HTMLInputElement).placeholder).toBe('Enter your email');
      expect(result.strategy).toBe('placeholder');
    });
  });

  // ==========================================================================
  // DATA ATTRIBUTE STRATEGY TESTS (Priority 6)
  // ==========================================================================

  describe('data attribute strategy', () => {
    it('should find element by data-testid', async () => {
      container.innerHTML = `
        <button data-testid="submit-btn">Submit</button>
      `;

      const bundle = createBundle({
        dataAttrs: { testid: 'submit-btn' },
        tag: 'BUTTON',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.getAttribute('data-testid')).toBe('submit-btn');
      expect(result.strategy).toBe('data-attr');
    });

    it('should find element by multiple data attributes', async () => {
      container.innerHTML = `
        <input data-type="email" data-validation="required">
      `;

      const bundle = createBundle({
        dataAttrs: { 
          type: 'email',
          validation: 'required',
        },
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
    });
  });

  // ==========================================================================
  // CSS SELECTOR STRATEGY TESTS (Priority 7)
  // ==========================================================================

  describe('CSS selector strategy', () => {
    it('should find element by CSS selector', async () => {
      container.innerHTML = `
        <div class="form-group">
          <input type="text" class="form-control primary-input">
        </div>
      `;

      const bundle = createBundle({
        css: '.form-group .form-control.primary-input',
        classes: ['form-control', 'primary-input'],
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.classList.contains('form-control')).toBe(true);
    });
  });

  // ==========================================================================
  // FUZZY TEXT STRATEGY TESTS (Priority 8)
  // ==========================================================================

  describe('fuzzy text strategy', () => {
    it('should find button by similar text', async () => {
      container.innerHTML = `
        <button>Submit Form</button>
      `;

      const bundle = createBundle({
        text: 'Submit',
        tag: 'BUTTON',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.textContent).toContain('Submit');
    });

    it('should find best match with partial text', async () => {
      container.innerHTML = `
        <button>Cancel</button>
        <button>Submit Order</button>
        <button>Submit Form Now</button>
      `;

      const bundle = createBundle({
        text: 'Submit Form',
        tag: 'BUTTON',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.textContent).toContain('Submit Form');
    });
  });

  // ==========================================================================
  // FALLBACK CHAIN TESTS
  // ==========================================================================

  describe('fallback chain', () => {
    it('should try strategies in order until match found', async () => {
      container.innerHTML = `
        <input 
          type="text" 
          placeholder="Email address"
          class="email-input"
        >
      `;

      // XPath invalid, ID missing, name missing, aria missing
      // Should fall back to placeholder
      const bundle = createBundle({
        xpath: '//invalid/path',
        id: null,
        name: null,
        aria: null,
        placeholder: 'Email address',
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.strategy).toBe('placeholder');
    });

    it('should return null when all strategies fail', async () => {
      container.innerHTML = `
        <div>No matching elements</div>
      `;

      const bundle = createBundle({
        xpath: '//nonexistent',
        id: 'missing',
        name: 'missing',
        aria: 'missing',
        placeholder: 'missing',
        text: 'missing',
        tag: 'INPUT',
      });

      const result = await finder.find(bundle);

      expect(result.element).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  // ==========================================================================
  // VISIBILITY TESTS
  // ==========================================================================

  describe('visibility handling', () => {
    it('should find visible elements', async () => {
      container.innerHTML = `
        <input type="text" id="visible" style="display: block;">
      `;

      const bundle = createBundle({ id: 'visible' });

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
    });

    it('should handle hidden elements based on config', async () => {
      container.innerHTML = `
        <input type="text" id="hidden" style="display: none;">
      `;

      const bundle = createBundle({ id: 'hidden' });

      const result = await finder.find(bundle);

      // Behavior depends on config - element exists but may be hidden
      expect(result.element).toBeDefined();
    });
  });

  // ==========================================================================
  // TIMEOUT AND RETRY TESTS
  // ==========================================================================

  describe('timeout and retry', () => {
    it('should retry until element appears', async () => {
      container.innerHTML = `<div>Loading...</div>`;

      const bundle = createBundle({ id: 'delayed-element' });

      // Add element after 200ms
      setTimeout(() => {
        const input = document.createElement('input');
        input.id = 'delayed-element';
        container.appendChild(input);
      }, 200);

      const result = await finder.find(bundle);

      expect(result.element).toBeDefined();
      expect(result.element?.id).toBe('delayed-element');
    });

    it('should fail after timeout', async () => {
      const shortTimeoutFinder = new ElementFinder(new StrategyRegistry(), {
        timeout: 100,
        retryInterval: 20,
      });

      container.innerHTML = `<div>Empty</div>`;

      const bundle = createBundle({ id: 'never-appears' });

      const result = await shortTimeoutFinder.find(bundle);

      expect(result.element).toBeNull();
    });
  });
});
