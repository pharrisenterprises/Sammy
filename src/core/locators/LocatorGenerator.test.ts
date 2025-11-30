/**
 * LocatorGenerator Test Suite
 * @module core/locators/LocatorGenerator.test
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocatorGenerator,
  createLocatorGenerator,
  getLocatorGenerator,
  resetLocatorGenerator,
  generateBundle,
  validateBundle,
  getVisibleText,
  shouldIgnoreDataAttr,
  extractDataAttributes,
  generateXPath,
  generateCssSelector,
  getBoundingBox,
  MAX_TEXT_LENGTH,
} from './LocatorGenerator';
import type { LocatorBundle } from '../types/locator-bundle';
import { createStrategyRegistry, resetStrategyRegistry } from './StrategyRegistry';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a test element with specified properties
 */
function createElement(
  tag: string,
  options: {
    id?: string;
    name?: string;
    placeholder?: string;
    ariaLabel?: string;
    classes?: string[];
    dataAttrs?: Record<string, string>;
    textContent?: string;
    type?: string;
    value?: string;
  } = {}
): HTMLElement {
  const element = document.createElement(tag);
  
  if (options.id) element.id = options.id;
  if (options.name) (element as HTMLInputElement).name = options.name;
  if (options.placeholder) (element as HTMLInputElement).placeholder = options.placeholder;
  if (options.ariaLabel) element.setAttribute('aria-label', options.ariaLabel);
  if (options.classes) options.classes.forEach(c => element.classList.add(c));
  if (options.dataAttrs) {
    Object.entries(options.dataAttrs).forEach(([key, value]) => {
      element.setAttribute(key.startsWith('data-') ? key : `data-${key}`, value);
    });
  }
  if (options.textContent) element.textContent = options.textContent;
  if (options.type) (element as HTMLInputElement).type = options.type;
  if (options.value) (element as HTMLInputElement).value = options.value;
  
  return element;
}

/**
 * Mock getBoundingClientRect for an element
 */
function mockBoundingRect(
  element: HTMLElement,
  rect: { x: number; y: number; width: number; height: number }
): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => rect,
  } as DOMRect);
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('getVisibleText', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should extract text content', () => {
    const element = createElement('button', { textContent: 'Click Me' });
    container.appendChild(element);
    
    expect(getVisibleText(element)).toBe('Click Me');
  });
  
  it('should trim whitespace', () => {
    const element = createElement('span', { textContent: '  Hello World  ' });
    container.appendChild(element);
    
    expect(getVisibleText(element)).toBe('Hello World');
  });
  
  it('should normalize multiple spaces', () => {
    const element = createElement('div');
    element.innerHTML = 'Hello    World';
    container.appendChild(element);
    
    expect(getVisibleText(element)).toBe('Hello World');
  });
  
  it('should truncate long text', () => {
    const longText = 'a'.repeat(1000);
    const element = createElement('div', { textContent: longText });
    container.appendChild(element);
    
    expect(getVisibleText(element).length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
  });
  
  it('should return empty for script tags', () => {
    const element = document.createElement('script');
    element.textContent = 'console.log("test")';
    container.appendChild(element);
    
    expect(getVisibleText(element as HTMLElement)).toBe('');
  });
  
  it('should get button input value', () => {
    const element = createElement('input', { type: 'submit', value: 'Submit' });
    container.appendChild(element);
    
    expect(getVisibleText(element)).toBe('Submit');
  });
  
  it('should return empty for password inputs', () => {
    const element = createElement('input', { type: 'password', value: 'secret' });
    container.appendChild(element);
    
    expect(getVisibleText(element)).toBe('');
  });
  
  it('should exclude nested inputs from text', () => {
    const element = document.createElement('label');
    element.textContent = 'Email: ';
    const input = document.createElement('input');
    element.appendChild(input);
    container.appendChild(element);
    
    expect(getVisibleText(element)).toBe('Email:');
  });
});

describe('shouldIgnoreDataAttr', () => {
  it('should ignore React data attributes', () => {
    expect(shouldIgnoreDataAttr('data-reactid')).toBe(true);
    expect(shouldIgnoreDataAttr('data-reactroot')).toBe(true);
  });
  
  it('should ignore Vue scoped styles', () => {
    expect(shouldIgnoreDataAttr('data-v-abc123')).toBe(true);
  });
  
  it('should not ignore test data attributes', () => {
    expect(shouldIgnoreDataAttr('data-testid')).toBe(false);
    expect(shouldIgnoreDataAttr('data-cy')).toBe(false);
  });
  
  it('should not ignore custom data attributes', () => {
    expect(shouldIgnoreDataAttr('data-custom')).toBe(false);
  });
});

describe('extractDataAttributes', () => {
  it('should extract data attributes', () => {
    const element = createElement('div', {
      dataAttrs: { testid: 'my-button', custom: 'value' },
    });
    
    const attrs = extractDataAttributes(element);
    
    expect(attrs['data-testid']).toBe('my-button');
    expect(attrs['testid']).toBe('my-button');
    expect(attrs['data-custom']).toBe('value');
  });
  
  it('should ignore framework attributes', () => {
    const element = document.createElement('div');
    element.setAttribute('data-reactid', '.0.1');
    element.setAttribute('data-testid', 'keep-me');
    
    const attrs = extractDataAttributes(element);
    
    expect(attrs['data-reactid']).toBeUndefined();
    expect(attrs['data-testid']).toBe('keep-me');
  });
  
  it('should respect max limit', () => {
    const element = document.createElement('div');
    for (let i = 0; i < 50; i++) {
      element.setAttribute(`data-attr-${i}`, `value-${i}`);
    }
    
    const attrs = extractDataAttributes(element, 5);
    const dataKeys = Object.keys(attrs).filter(k => k.startsWith('data-'));
    
    expect(dataKeys.length).toBeLessThanOrEqual(5);
  });
});

describe('generateXPath', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should generate simple xpath', () => {
    const element = document.createElement('button');
    container.appendChild(element);
    
    const xpath = generateXPath(element);
    
    expect(xpath).toContain('button');
    expect(xpath.startsWith('/')).toBe(true);
  });
  
  it('should include index for multiple siblings', () => {
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    container.appendChild(btn1);
    container.appendChild(btn2);
    
    const xpath1 = generateXPath(btn1);
    const xpath2 = generateXPath(btn2);
    
    expect(xpath1).toContain('button[1]');
    expect(xpath2).toContain('button[2]');
  });
});

describe('generateCssSelector', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should use ID if available', () => {
    const element = createElement('button', { id: 'submit-btn' });
    container.appendChild(element);
    
    const selector = generateCssSelector(element);
    
    expect(selector).toBe('#submit-btn');
  });
  
  it('should use classes if no ID', () => {
    const element = createElement('button', { classes: ['btn', 'primary'] });
    container.appendChild(element);
    
    const selector = generateCssSelector(element);
    
    expect(selector).toContain('button');
    expect(selector).toContain('.btn');
    expect(selector).toContain('.primary');
  });
  
  it('should use nth-child as fallback', () => {
    const div = document.createElement('div');
    const child1 = document.createElement('span');
    const child2 = document.createElement('span');
    div.appendChild(child1);
    div.appendChild(child2);
    container.appendChild(div);
    
    const selector = generateCssSelector(child2);
    
    expect(selector).toContain('nth-child');
  });
});

describe('getBoundingBox', () => {
  it('should return rounded values', () => {
    const element = document.createElement('div');
    mockBoundingRect(element, { x: 100.7, y: 200.3, width: 50.5, height: 30.9 });
    
    const box = getBoundingBox(element);
    
    expect(box.x).toBe(101);
    expect(box.y).toBe(200);
    expect(box.width).toBe(51);
    expect(box.height).toBe(31);
  });
});

// ============================================================================
// GENERATOR CLASS TESTS
// ============================================================================

describe('LocatorGenerator', () => {
  let container: HTMLDivElement;
  let generator: LocatorGenerator;
  
  beforeEach(() => {
    resetLocatorGenerator();
    resetStrategyRegistry();
    
    container = document.createElement('div');
    document.body.appendChild(container);
    
    generator = createLocatorGenerator();
  });
  
  afterEach(() => {
    container.remove();
  });
  
  describe('generate', () => {
    it('should generate complete bundle', () => {
      const element = createElement('button', {
        id: 'submit-btn',
        name: 'submit',
        ariaLabel: 'Submit Form',
        classes: ['btn', 'primary'],
        dataAttrs: { testid: 'submit-button' },
        textContent: 'Submit',
      });
      container.appendChild(element);
      mockBoundingRect(element, { x: 100, y: 200, width: 120, height: 40 });
      
      const bundle = generator.generate(element);
      
      expect(bundle.tag).toBe('button');
      expect(bundle.id).toBe('submit-btn');
      expect(bundle.name).toBe('submit');
      expect(bundle.aria).toBe('Submit Form');
      expect(bundle.classes).toContain('btn');
      expect(bundle.classes).toContain('primary');
      expect(bundle.dataAttrs['data-testid']).toBe('submit-button');
      expect(bundle.text).toBe('Submit');
      expect(bundle.bounding?.x).toBe(100);
      expect(bundle.xpath).toContain('button');
    });
    
    it('should handle elements with no identifiers', () => {
      const element = document.createElement('div');
      container.appendChild(element);
      
      const bundle = generator.generate(element);
      
      expect(bundle.tag).toBe('div');
      expect(bundle.id).toBe('');
      expect(bundle.name).toBe('');
    });
    
    it('should respect config options', () => {
      const customGenerator = createLocatorGenerator({
        captureBounding: false,
        maxClasses: 2,
      });
      
      const element = createElement('div', {
        classes: ['a', 'b', 'c', 'd', 'e'],
      });
      container.appendChild(element);
      
      const bundle = customGenerator.generate(element);
      
      expect(bundle.bounding).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(bundle.classes.length).toBeLessThanOrEqual(2);
    });
  });
  
  describe('generateMinimal', () => {
    it('should generate minimal bundle', () => {
      const element = createElement('button', {
        id: 'btn',
        textContent: 'Click Me',
        classes: ['btn', 'primary'],
      });
      container.appendChild(element);
      
      const bundle = generator.generateMinimal(element);
      
      expect(bundle.tag).toBe('button');
      expect(bundle.id).toBe('btn');
      expect(bundle.text).toBe('');
      expect(bundle.classes).toEqual([]);
    });
  });
  
  describe('update', () => {
    it('should update bundle with current state', () => {
      const element = createElement('button', { textContent: 'Initial' });
      container.appendChild(element);
      mockBoundingRect(element, { x: 100, y: 100, width: 100, height: 40 });
      
      const originalBundle = generator.generate(element);
      
      // Simulate element change
      element.textContent = 'Updated';
      mockBoundingRect(element, { x: 200, y: 200, width: 150, height: 50 });
      
      const updatedBundle = generator.update(originalBundle, element);
      
      expect(updatedBundle.text).toBe('Updated');
      expect(updatedBundle.bounding?.x).toBe(200);
      expect(updatedBundle.tag).toBe(originalBundle.tag);
    });
  });
  
  describe('generateAllSelectors', () => {
    it('should generate selectors from all strategies', () => {
      const element = createElement('button', { id: 'test-btn' });
      container.appendChild(element);
      
      const selectors = generator.generateAllSelectors(element);
      
      expect(typeof selectors).toBe('object');
      // Should have some selectors (depends on registered strategies)
    });
  });
  
  describe('generateBestSelector', () => {
    it('should return best selector', () => {
      const element = createElement('button', { id: 'best-btn' });
      container.appendChild(element);
      
      const result = generator.generateBestSelector(element);
      
      expect(result.selector).not.toBeNull();
      expect(result.strategy).not.toBeNull();
    });
    
    it('should return null for element with no selectors', () => {
      // Create generator with empty registry
      const emptyRegistry = createStrategyRegistry({ autoRegisterDefaults: false });
      const customGenerator = createLocatorGenerator({ registry: emptyRegistry });
      
      const element = document.createElement('div');
      container.appendChild(element);
      
      const result = customGenerator.generateBestSelector(element);
      
      expect(result.selector).toBeNull();
      expect(result.strategy).toBeNull();
    });
  });
  
  describe('validate', () => {
    it('should validate complete bundle', () => {
      const element = createElement('button', {
        id: 'valid-btn',
        textContent: 'Click',
      });
      container.appendChild(element);
      mockBoundingRect(element, { x: 100, y: 100, width: 100, height: 40 });
      
      const bundle = generator.generate(element);
      const result = generator.validate(bundle);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should report missing tag', () => {
      const bundle = generator.createEmptyBundle('');
      bundle.tag = '';
      
      const result = generator.validate(bundle);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: tag');
    });
    
    it('should warn about missing identifiers', () => {
      const bundle = generator.createEmptyBundle('div');
      bundle.id = '';
      bundle.name = '';
      bundle.aria = '';
      bundle.xpath = '';
      bundle.css = '';
      bundle.classes = [];
      bundle.dataAttrs = {};
      
      const result = generator.validate(bundle);
      
      expect(result.warnings.some(w => w.includes('no identifiers'))).toBe(true);
    });
    
    it('should warn about zero dimensions', () => {
      const bundle = generator.createEmptyBundle('button');
      bundle.id = 'test';
      bundle.bounding = { x: 0, y: 0, width: 0, height: 0 };
      
      const result = generator.validate(bundle);
      
      expect(result.warnings.some(w => w.includes('zero'))).toBe(true);
    });
    
    it('should warn about ID starting with number', () => {
      const bundle = generator.createEmptyBundle('div');
      bundle.id = '123button';
      
      const result = generator.validate(bundle);
      
      expect(result.warnings.some(w => w.includes('starts with number'))).toBe(true);
    });
  });
  
  describe('hasReliableLocators', () => {
    it('should return true for ID', () => {
      const bundle = generator.createEmptyBundle('div');
      bundle.id = 'reliable-id';
      
      expect(generator.hasReliableLocators(bundle)).toBe(true);
    });
    
    it('should return true for name on form element', () => {
      const bundle = generator.createEmptyBundle('input');
      bundle.name = 'email';
      
      expect(generator.hasReliableLocators(bundle)).toBe(true);
    });
    
    it('should return true for aria label', () => {
      const bundle = generator.createEmptyBundle('button');
      bundle.aria = 'Submit form';
      
      expect(generator.hasReliableLocators(bundle)).toBe(true);
    });
    
    it('should return true for test data attribute', () => {
      const bundle = generator.createEmptyBundle('div');
      bundle.dataAttrs = { 'data-testid': 'my-component' };
      
      expect(generator.hasReliableLocators(bundle)).toBe(true);
    });
    
    it('should return false for no reliable locators', () => {
      const bundle = generator.createEmptyBundle('div');
      bundle.classes = ['some-class'];
      
      expect(generator.hasReliableLocators(bundle)).toBe(false);
    });
  });
  
  describe('extractIdentifiers', () => {
    it('should extract all identifiers', () => {
      const element = createElement('input', {
        id: 'email-input',
        name: 'email',
        ariaLabel: 'Email Address',
        dataAttrs: { testid: 'email-field' },
        classes: ['input', 'form-control'],
      });
      container.appendChild(element);
      
      const ids = generator.extractIdentifiers(element);
      
      expect(ids.id).toBe('email-input');
      expect(ids.name).toBe('email');
      expect(ids.aria).toBe('Email Address');
      expect(ids.testId).toBe('email-field');
      expect(ids.classes).toContain('input');
    });
  });
  
  describe('createEmptyBundle', () => {
    it('should create bundle with defaults', () => {
      const bundle = generator.createEmptyBundle('button');
      
      expect(bundle.tag).toBe('button');
      expect(bundle.id).toBe('');
      expect(bundle.classes).toEqual([]);
      expect(bundle.dataAttrs).toEqual({});
    });
  });
  
  describe('compareBundles', () => {
    it('should match by ID', () => {
      const a = generator.createEmptyBundle('button');
      a.id = 'same-id';
      
      const b = generator.createEmptyBundle('div');
      b.id = 'same-id';
      
      expect(generator.compareBundles(a, b)).toBe(true);
    });
    
    it('should match by xpath', () => {
      const a = generator.createEmptyBundle('button');
      a.xpath = '/html/body/div/button';
      
      const b = generator.createEmptyBundle('button');
      b.xpath = '/html/body/div/button';
      
      expect(generator.compareBundles(a, b)).toBe(true);
    });
    
    it('should match by tag + name', () => {
      const a = generator.createEmptyBundle('input');
      a.name = 'email';
      
      const b = generator.createEmptyBundle('input');
      b.name = 'email';
      
      expect(generator.compareBundles(a, b)).toBe(true);
    });
    
    it('should not match different elements', () => {
      const a = generator.createEmptyBundle('button');
      a.id = 'button-1';
      
      const b = generator.createEmptyBundle('button');
      b.id = 'button-2';
      
      expect(generator.compareBundles(a, b)).toBe(false);
    });
  });
  
  describe('configuration', () => {
    it('should get and update config', () => {
      const original = generator.getConfig();
      expect(original.maxTextLength).toBe(MAX_TEXT_LENGTH);
      
      generator.updateConfig({ maxTextLength: 100 });
      
      const updated = generator.getConfig();
      expect(updated.maxTextLength).toBe(100);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getLocatorGenerator (singleton)', () => {
  beforeEach(() => {
    resetLocatorGenerator();
  });
  
  it('should return same instance', () => {
    const instance1 = getLocatorGenerator();
    const instance2 = getLocatorGenerator();
    
    expect(instance1).toBe(instance2);
  });
  
  it('should reset on resetLocatorGenerator', () => {
    const instance1 = getLocatorGenerator();
    resetLocatorGenerator();
    const instance2 = getLocatorGenerator();
    
    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('generateBundle', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    resetLocatorGenerator();
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should generate bundle using global generator', () => {
    const element = createElement('button', { id: 'global-test' });
    container.appendChild(element);
    
    const bundle = generateBundle(element);
    
    expect(bundle.id).toBe('global-test');
  });
});

describe('validateBundle', () => {
  beforeEach(() => {
    resetLocatorGenerator();
  });
  
  it('should validate using global generator', () => {
    const bundle: LocatorBundle = {
      tag: 'button',
      id: 'test',
      name: '',
      placeholder: '',
      aria: '',
      dataAttrs: {},
      text: '',
      css: '',
      xpath: '',
      classes: [],
      pageUrl: '',
      bounding: { x: 0, y: 0, width: 100, height: 40 },
      iframeChain: null,
      shadowHosts: null,
    };
    
    const result = validateBundle(bundle);
    
    expect(result.valid).toBe(true);
  });
});
