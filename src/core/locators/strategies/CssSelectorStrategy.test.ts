/**
 * CssSelectorStrategy Test Suite
 * @module core/locators/strategies/CssSelectorStrategy.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CssSelectorStrategy,
  createCssSelectorStrategy,
  getCssSelectorStrategy,
  shouldIgnoreClass,
  filterStableClasses,
  escapeCssValue,
  buildIdSelector,
  buildClassSelector,
  buildAttributeSelector,
  buildCombinedSelector,
  calculateSpecificity,
  testSelectorUniqueness,
  generateSelectorVariants,
  selectBestSelector,
  STRATEGY_NAME,
  STRATEGY_PRIORITY,
  BASE_CONFIDENCE,
  MAX_CLASSES_IN_SELECTOR,
} from './CssSelectorStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';
import type { LocatorContext } from './ILocatorStrategy';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a minimal LocatorBundle for testing
 */
function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'button',
    id: '',
    name: '',
    placeholder: '',
    aria: '',
    dataAttrs: {},
    text: 'Submit',
    css: '',
    xpath: '/html/body/button',
    classes: ['btn', 'btn-primary'],
    pageUrl: 'http://localhost',
    bounding: { x: 100, y: 100, width: 120, height: 40 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

/**
 * Creates a test context
 */
function createTestContext(doc?: Document): LocatorContext {
  return {
    document: doc || document,
  };
}

/**
 * Creates a test element with specified properties
 */
function createElement(
  tagName: string,
  options: {
    id?: string;
    classes?: string[];
    name?: string;
    placeholder?: string;
    ariaLabel?: string;
  } = {}
): HTMLElement {
  const element = document.createElement(tagName);
  
  if (options.id) element.id = options.id;
  if (options.classes) {
    options.classes.forEach(c => element.classList.add(c));
  }
  if (options.name) (element as HTMLInputElement).name = options.name;
  if (options.placeholder) {
    (element as HTMLInputElement).placeholder = options.placeholder;
  }
  if (options.ariaLabel) element.setAttribute('aria-label', options.ariaLabel);
  
  return element;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('shouldIgnoreClass', () => {
  it('should ignore empty class', () => {
    expect(shouldIgnoreClass('')).toBe(true);
    expect(shouldIgnoreClass('   ')).toBe(true);
  });
  
  it('should ignore hover/focus prefixed classes', () => {
    expect(shouldIgnoreClass('hover:bg-blue')).toBe(true);
    expect(shouldIgnoreClass('focus:ring')).toBe(true);
  });
  
  it('should ignore framework classes', () => {
    expect(shouldIgnoreClass('ng-valid')).toBe(true);
    expect(shouldIgnoreClass('v-show')).toBe(true);
    expect(shouldIgnoreClass('css-1abc23')).toBe(true);
    expect(shouldIgnoreClass('sc-abc123')).toBe(true);
  });
  
  it('should ignore hash classes', () => {
    expect(shouldIgnoreClass('abc123')).toBe(true);
    expect(shouldIgnoreClass('abcdefgh')).toBe(true);
  });
  
  it('should not ignore normal classes', () => {
    expect(shouldIgnoreClass('btn')).toBe(false);
    expect(shouldIgnoreClass('btn-primary')).toBe(false);
    expect(shouldIgnoreClass('nav-link')).toBe(false);
    expect(shouldIgnoreClass('alert-box')).toBe(false);
  });
});

describe('filterStableClasses', () => {
  it('should filter out unstable classes', () => {
    const classes = ['btn', 'hover:bg-blue', 'btn-primary', 'css-1abc23'];
    const filtered = filterStableClasses(classes);
    
    expect(filtered).toContain('btn');
    expect(filtered).toContain('btn-primary');
    expect(filtered).not.toContain('hover:bg-blue');
    expect(filtered).not.toContain('css-1abc23');
  });
  
  it('should limit to max classes', () => {
    const classes = ['a', 'b', 'c', 'd', 'e'];
    const filtered = filterStableClasses(classes);
    
    expect(filtered.length).toBeLessThanOrEqual(MAX_CLASSES_IN_SELECTOR);
  });
  
  it('should handle empty array', () => {
    expect(filterStableClasses([])).toEqual([]);
  });
});

describe('escapeCssValue', () => {
  it('should escape special characters', () => {
    expect(escapeCssValue('my-id')).toBe('my-id');
    expect(escapeCssValue('id:with:colons')).toContain('\\');
  });
  
  it('should handle normal strings', () => {
    expect(escapeCssValue('simple')).toBe('simple');
  });
});

describe('buildIdSelector', () => {
  it('should build ID selector', () => {
    expect(buildIdSelector('myId')).toBe('#myId');
  });
  
  it('should include tag if provided', () => {
    expect(buildIdSelector('myId', 'button')).toBe('button#myId');
  });
  
  it('should escape special characters', () => {
    const selector = buildIdSelector('my:id');
    expect(selector).toContain('#');
  });
});

describe('buildClassSelector', () => {
  it('should build class selector', () => {
    const selector = buildClassSelector(['btn', 'btn-primary']);
    expect(selector).toBe('.btn.btn-primary');
  });
  
  it('should include tag if provided', () => {
    const selector = buildClassSelector(['btn'], 'button');
    expect(selector).toBe('button.btn');
  });
  
  it('should filter unstable classes', () => {
    const selector = buildClassSelector(['btn', 'hover:bg-blue']);
    expect(selector).toBe('.btn');
  });
  
  it('should return empty for no stable classes', () => {
    const selector = buildClassSelector(['hover:bg-blue', 'css-abc123']);
    expect(selector).toBe('');
  });
});

describe('buildAttributeSelector', () => {
  it('should build attribute selector', () => {
    const selector = buildAttributeSelector('name', 'email');
    expect(selector).toBe('[name="email"]');
  });
  
  it('should include tag if provided', () => {
    const selector = buildAttributeSelector('name', 'email', 'input');
    expect(selector).toBe('input[name="email"]');
  });
  
  it('should escape values', () => {
    const selector = buildAttributeSelector('name', 'my"value');
    expect(selector).toContain('\\');
  });
});

describe('buildCombinedSelector', () => {
  it('should build selector from ID', () => {
    const bundle = createTestBundle({ id: 'submitBtn', tag: 'button' });
    const selector = buildCombinedSelector(bundle);
    
    expect(selector).toBe('button#submitBtn');
  });
  
  it('should build selector from classes when no ID', () => {
    const bundle = createTestBundle({
      id: '',
      tag: 'button',
      classes: ['btn', 'btn-primary'],
    });
    const selector = buildCombinedSelector(bundle);
    
    expect(selector).toContain('button');
    expect(selector).toContain('.btn');
    expect(selector).toContain('.btn-primary');
  });
  
  it('should include name attribute', () => {
    const bundle = createTestBundle({
      id: '',
      tag: 'input',
      classes: [],
      name: 'email',
    });
    const selector = buildCombinedSelector(bundle);
    
    expect(selector).toContain('[name="email"]');
  });
  
  it('should respect options', () => {
    const bundle = createTestBundle({ tag: 'button', classes: ['btn'] });
    const selector = buildCombinedSelector(bundle, { includeTag: false });
    
    expect(selector).not.toMatch(/^button/);
  });
});

describe('calculateSpecificity', () => {
  it('should give highest score to IDs', () => {
    const idSpec = calculateSpecificity('#myId');
    const classSpec = calculateSpecificity('.myClass');
    
    expect(idSpec).toBeGreaterThan(classSpec);
  });
  
  it('should score classes and attributes equally', () => {
    const classSpec = calculateSpecificity('.myClass');
    const attrSpec = calculateSpecificity('[name="test"]');
    
    expect(classSpec).toBe(attrSpec);
  });
  
  it('should give lowest score to tags', () => {
    const tagSpec = calculateSpecificity('button');
    const classSpec = calculateSpecificity('.btn');
    
    expect(tagSpec).toBeLessThan(classSpec);
  });
  
  it('should sum multiple selectors', () => {
    const combined = calculateSpecificity('button.btn.primary');
    const tagOnly = calculateSpecificity('button');
    
    expect(combined).toBeGreaterThan(tagOnly);
  });
});

describe('testSelectorUniqueness', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should detect unique selector', () => {
    const btn = createElement('button', { id: 'unique' });
    container.appendChild(btn);
    
    const result = testSelectorUniqueness('#unique', document);
    
    expect(result.isUnique).toBe(true);
    expect(result.matchCount).toBe(1);
  });
  
  it('should detect non-unique selector', () => {
    container.appendChild(createElement('button', { classes: ['btn'] }));
    container.appendChild(createElement('button', { classes: ['btn'] }));
    
    const result = testSelectorUniqueness('.btn', document);
    
    expect(result.isUnique).toBe(false);
    expect(result.matchCount).toBe(2);
  });
  
  it('should handle no matches', () => {
    const result = testSelectorUniqueness('#nonexistent', document);
    
    expect(result.isUnique).toBe(false);
    expect(result.matchCount).toBe(0);
  });
  
  it('should handle invalid selector', () => {
    const result = testSelectorUniqueness('[[[invalid', document);
    
    expect(result.isUnique).toBe(false);
    expect(result.matchCount).toBe(0);
  });
});

describe('generateSelectorVariants', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should generate ID variant first', () => {
    const btn = createElement('button', { id: 'submit', classes: ['btn'] });
    container.appendChild(btn);
    
    const bundle = createTestBundle({ id: 'submit', classes: ['btn'] });
    const variants = generateSelectorVariants(bundle, document);
    
    const idVariant = variants.find(v => v.type === 'id');
    expect(idVariant).toBeDefined();
    expect(idVariant?.selector).toContain('#submit');
  });
  
  it('should generate multiple variants', () => {
    const btn = createElement('button', {
      id: 'submit',
      classes: ['btn', 'primary'],
      name: 'submitBtn',
    });
    container.appendChild(btn);
    
    const bundle = createTestBundle({
      id: 'submit',
      classes: ['btn', 'primary'],
      name: 'submitBtn',
    });
    const variants = generateSelectorVariants(bundle, document);
    
    expect(variants.length).toBeGreaterThan(1);
  });
  
  it('should sort unique selectors first', () => {
    const btn = createElement('button', { id: 'unique' });
    container.appendChild(btn);
    container.appendChild(createElement('button'));
    
    const bundle = createTestBundle({ id: 'unique', tag: 'button' });
    const variants = generateSelectorVariants(bundle, document);
    
    // Unique selector should be first
    expect(variants[0].isUnique).toBe(true);
  });
});

describe('selectBestSelector', () => {
  it('should prefer unique selector', () => {
    const variants = [
      { selector: '.btn', type: 'class' as const, specificity: 10, isUnique: false, matchCount: 5 },
      { selector: '#unique', type: 'id' as const, specificity: 100, isUnique: true, matchCount: 1 },
    ];
    
    const best = selectBestSelector(variants);
    
    expect(best?.selector).toBe('#unique');
  });
  
  it('should prefer fewer matches', () => {
    // Note: selectBestSelector expects pre-sorted variants, so we pass them sorted
    const variants = [
      { selector: '.rare', type: 'class' as const, specificity: 10, isUnique: false, matchCount: 2 },
      { selector: '.common', type: 'class' as const, specificity: 10, isUnique: false, matchCount: 10 },
    ];
    
    const best = selectBestSelector(variants);
    
    expect(best?.selector).toBe('.rare');
  });
  
  it('should return null for empty variants', () => {
    expect(selectBestSelector([])).toBeNull();
  });
  
  it('should skip variants with no matches', () => {
    const variants = [
      { selector: '.none', type: 'class' as const, specificity: 10, isUnique: false, matchCount: 0 },
      { selector: '.some', type: 'class' as const, specificity: 10, isUnique: false, matchCount: 2 },
    ];
    
    const best = selectBestSelector(variants);
    
    expect(best?.selector).toBe('.some');
  });
});

// ============================================================================
// STRATEGY CLASS TESTS
// ============================================================================

describe('CssSelectorStrategy', () => {
  let strategy: CssSelectorStrategy;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    strategy = createCssSelectorStrategy();
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  describe('constructor and properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe(STRATEGY_NAME);
    });
    
    it('should have correct priority', () => {
      expect(strategy.priority).toBe(STRATEGY_PRIORITY);
    });
    
    it('should have correct base confidence', () => {
      expect(strategy.baseConfidence).toBe(BASE_CONFIDENCE);
    });
  });
  
  describe('canHandle', () => {
    it('should return true for bundle with ID', () => {
      const bundle = createTestBundle({ id: 'myId' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return true for bundle with tag', () => {
      const bundle = createTestBundle({ tag: 'button' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return true for bundle with stable classes', () => {
      const bundle = createTestBundle({ classes: ['btn', 'primary'] });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return false for bundle with only unstable classes', () => {
      const bundle = createTestBundle({
        id: '',
        tag: '',
        classes: ['hover:bg-blue', 'css-abc123'],
        name: '',
        placeholder: '',
        aria: '',
      });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return true for bundle with name', () => {
      const bundle = createTestBundle({ name: 'email' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
  });
  
  describe('find', () => {
    it('should find element by ID', () => {
      const btn = createElement('button', { id: 'submitBtn' });
      container.appendChild(btn);
      
      const bundle = createTestBundle({ id: 'submitBtn', tag: 'button' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
      expect(result.confidence).toBeGreaterThan(BASE_CONFIDENCE);
      expect(result.metadata?.selectorType).toBe('id');
    });
    
    it('should find element by classes', () => {
      const btn = createElement('button', { classes: ['btn', 'submit'] });
      container.appendChild(btn);
      
      const bundle = createTestBundle({
        id: '',
        tag: 'button',
        classes: ['btn', 'submit'],
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
      expect(result.confidence).toBeGreaterThan(0);
    });
    
    it('should find element by name attribute', () => {
      const input = createElement('input', { name: 'email' }) as HTMLInputElement;
      container.appendChild(input);
      
      const bundle = createTestBundle({
        id: '',
        tag: 'input',
        classes: [],
        name: 'email',
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(input);
    });
    
    it('should return null for no matches', () => {
      const bundle = createTestBundle({ id: 'nonexistent' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
      expect(result.confidence).toBe(0);
    });
    
    it('should have higher confidence for unique selector', () => {
      const btn1 = createElement('button', { id: 'unique' });
      const btn2 = createElement('button', { classes: ['common'] });
      const btn3 = createElement('button', { classes: ['common'] });
      container.appendChild(btn1);
      container.appendChild(btn2);
      container.appendChild(btn3);
      
      const bundle1 = createTestBundle({ id: 'unique' });
      const bundle2 = createTestBundle({ id: '', classes: ['common'] });
      const context = createTestContext();
      
      const result1 = strategy.find(bundle1, context);
      const result2 = strategy.find(bundle2, context);
      
      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });
    
    it('should report metadata', () => {
      const btn = createElement('button', { id: 'test', classes: ['btn'] });
      container.appendChild(btn);
      
      const bundle = createTestBundle({ id: 'test', classes: ['btn'] });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.usedSelector).toBeDefined();
      expect(result.metadata?.specificity).toBeGreaterThan(0);
      expect(result.metadata?.variantsGenerated).toBeGreaterThan(0);
    });
  });
  
  describe('generateSelector', () => {
    it('should generate ID selector', () => {
      const btn = createElement('button', { id: 'myBtn' });
      container.appendChild(btn);
      
      const selector = strategy.generateSelector(btn);
      
      expect(selector).toContain('#myBtn');
    });
    
    it('should generate class selector', () => {
      const btn = createElement('button', { classes: ['btn', 'primary'] });
      container.appendChild(btn);
      
      const selector = strategy.generateSelector(btn);
      
      expect(selector).toContain('.btn');
    });
    
    it('should return best unique selector', () => {
      const btn = createElement('button', { id: 'unique', classes: ['btn'] });
      container.appendChild(btn);
      
      const selector = strategy.generateSelector(btn);
      
      // Should prefer ID over classes
      expect(selector).toContain('#unique');
    });
  });
  
  describe('validate', () => {
    it('should return true for matching selector', () => {
      const btn = createElement('button', { id: 'test' });
      container.appendChild(btn);
      
      expect(strategy.validate(btn, '#test')).toBe(true);
    });
    
    it('should return false for non-matching selector', () => {
      const btn = createElement('button', { id: 'test' });
      container.appendChild(btn);
      
      expect(strategy.validate(btn, '#other')).toBe(false);
    });
    
    it('should return false for selector matching different element', () => {
      const btn1 = createElement('button', { id: 'test1' });
      const btn2 = createElement('button', { id: 'test2' });
      container.appendChild(btn1);
      container.appendChild(btn2);
      
      expect(strategy.validate(btn2, '#test1')).toBe(false);
    });
  });
  
  describe('testSelectors', () => {
    it('should find best selector', () => {
      const btn = createElement('button', { id: 'unique', classes: ['btn'] });
      container.appendChild(btn);
      container.appendChild(createElement('button', { classes: ['btn'] }));
      
      const result = strategy.testSelectors(['#unique', '.btn'], document);
      
      expect(result?.selector).toBe('#unique');
      expect(result?.isUnique).toBe(true);
    });
    
    it('should skip invalid selectors', () => {
      const btn = createElement('button', { classes: ['btn'] });
      container.appendChild(btn);
      
      const result = strategy.testSelectors(['[[[invalid', '.btn'], document);
      
      expect(result?.selector).toBe('.btn');
    });
    
    it('should return null if all invalid', () => {
      const result = strategy.testSelectors(['[[[invalid', '...bad'], document);
      
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('getCssSelectorStrategy (singleton)', () => {
  it('should return same instance', () => {
    const instance1 = getCssSelectorStrategy();
    const instance2 = getCssSelectorStrategy();
    expect(instance1).toBe(instance2);
  });
});

describe('createCssSelectorStrategy (factory)', () => {
  it('should create new instance each time', () => {
    const instance1 = createCssSelectorStrategy();
    const instance2 = createCssSelectorStrategy();
    expect(instance1).not.toBe(instance2);
  });
});
