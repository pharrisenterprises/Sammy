/**
 * DataAttributeStrategy Test Suite
 * @module core/locators/strategies/DataAttributeStrategy.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DataAttributeStrategy,
  createDataAttributeStrategy,
  getDataAttributeStrategy,
  isTestingAttribute,
  shouldIgnoreAttribute,
  getAttributePriority,
  scanDataAttributes,
  buildDataAttrSelector,
  buildMultiAttrSelector,
  compareDataAttributes,
  extractDataAttrsFromElement,
  STRATEGY_NAME,
  STRATEGY_PRIORITY,
  BASE_CONFIDENCE,
  TESTING_DATA_ATTRIBUTES,
} from './DataAttributeStrategy';
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
    dataAttrs: { testid: 'submit-button' },
    text: 'Submit',
    css: '',
    xpath: '/html/body/button',
    classes: [],
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
 * Creates a test element with data attributes
 */
function createElementWithDataAttrs(
  tagName: string,
  dataAttrs: Record<string, string>
): HTMLElement {
  const element = document.createElement(tagName);
  
  for (const [key, value] of Object.entries(dataAttrs)) {
    const attrName = key.startsWith('data-') ? key : `data-${key}`;
    element.setAttribute(attrName, value);
  }
  
  return element;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('isTestingAttribute', () => {
  it('should return true for data-testid', () => {
    expect(isTestingAttribute('data-testid')).toBe(true);
  });
  
  it('should return true for data-cy', () => {
    expect(isTestingAttribute('data-cy')).toBe(true);
  });
  
  it('should return true for data-qa', () => {
    expect(isTestingAttribute('data-qa')).toBe(true);
  });
  
  it('should return true for data-test', () => {
    expect(isTestingAttribute('data-test')).toBe(true);
  });
  
  it('should return false for arbitrary data attribute', () => {
    expect(isTestingAttribute('data-custom')).toBe(false);
  });
  
  it('should be case-insensitive', () => {
    expect(isTestingAttribute('DATA-TESTID')).toBe(true);
  });
});

describe('shouldIgnoreAttribute', () => {
  it('should ignore data-reactid', () => {
    expect(shouldIgnoreAttribute('data-reactid')).toBe(true);
  });
  
  it('should ignore data-v- prefixed attributes', () => {
    expect(shouldIgnoreAttribute('data-v-abc123')).toBe(true);
  });
  
  it('should ignore data-state', () => {
    expect(shouldIgnoreAttribute('data-state')).toBe(true);
  });
  
  it('should not ignore data-testid', () => {
    expect(shouldIgnoreAttribute('data-testid')).toBe(false);
  });
  
  it('should not ignore custom attributes', () => {
    expect(shouldIgnoreAttribute('data-custom-id')).toBe(false);
  });
});

describe('getAttributePriority', () => {
  it('should give highest priority to data-testid', () => {
    const priority = getAttributePriority('data-testid');
    expect(priority).toBe(0);
  });
  
  it('should give lower priority to data-cy than data-testid', () => {
    const testidPriority = getAttributePriority('data-testid');
    const cyPriority = getAttributePriority('data-cy');
    expect(cyPriority).toBeGreaterThan(testidPriority);
  });
  
  it('should give lowest priority to custom attributes', () => {
    const customPriority = getAttributePriority('data-custom');
    expect(customPriority).toBeGreaterThan(TESTING_DATA_ATTRIBUTES.length);
  });
});

describe('scanDataAttributes', () => {
  it('should extract all data attributes', () => {
    const element = createElementWithDataAttrs('button', {
      'data-testid': 'btn',
      'data-custom': 'value',
    });
    
    const scan = scanDataAttributes(element);
    
    expect(scan.totalCount).toBe(2);
    expect(scan.attributes.length).toBe(2);
  });
  
  it('should prioritize testing attributes', () => {
    const element = createElementWithDataAttrs('button', {
      'data-custom': 'value',
      'data-testid': 'btn',
    });
    
    const scan = scanDataAttributes(element);
    
    expect(scan.bestAttribute?.name).toBe('data-testid');
  });
  
  it('should ignore framework attributes', () => {
    const element = createElementWithDataAttrs('div', {
      'data-reactid': '123',
      'data-testid': 'test',
    });
    
    const scan = scanDataAttributes(element);
    
    expect(scan.totalCount).toBe(1);
    expect(scan.bestAttribute?.name).toBe('data-testid');
  });
  
  it('should handle elements with no data attributes', () => {
    const element = document.createElement('div');
    const scan = scanDataAttributes(element);
    
    expect(scan.totalCount).toBe(0);
    expect(scan.bestAttribute).toBeNull();
  });
});

describe('buildDataAttrSelector', () => {
  it('should build selector with tag', () => {
    const selector = buildDataAttrSelector('data-testid', 'submit', 'button');
    expect(selector).toBe('button[data-testid="submit"]');
  });
  
  it('should build selector without tag', () => {
    const selector = buildDataAttrSelector('data-testid', 'submit');
    expect(selector).toBe('[data-testid="submit"]');
  });
  
  it('should escape special characters', () => {
    const selector = buildDataAttrSelector('data-testid', 'my"value', 'div');
    expect(selector).toContain('\\"');
  });
});

describe('buildMultiAttrSelector', () => {
  it('should prioritize testing attributes', () => {
    const selector = buildMultiAttrSelector({
      custom: 'value',
      testid: 'btn',
    });
    
    expect(selector).toContain('data-testid');
  });
  
  it('should return null for empty attrs', () => {
    const selector = buildMultiAttrSelector({});
    expect(selector).toBeNull();
  });
  
  it('should handle both prefixed and unprefixed keys', () => {
    const selector1 = buildMultiAttrSelector({ testid: 'btn' });
    const selector2 = buildMultiAttrSelector({ 'data-testid': 'btn' });
    
    expect(selector1).toContain('data-testid="btn"');
    expect(selector2).toContain('data-testid="btn"');
  });
});

describe('compareDataAttributes', () => {
  it('should return 1 for identical attributes', () => {
    const attrs = { testid: 'btn', custom: 'value' };
    expect(compareDataAttributes(attrs, attrs)).toBe(1);
  });
  
  it('should return 0 for completely different attributes', () => {
    const bundle = { testid: 'btn1' };
    const element = { other: 'value' };
    expect(compareDataAttributes(bundle, element)).toBe(0);
  });
  
  it('should return partial score for partial matches', () => {
    const bundle = { testid: 'btn', custom: 'value1' };
    const element = { testid: 'btn', custom: 'value2' };
    
    const score = compareDataAttributes(bundle, element);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
  
  it('should handle empty bundle', () => {
    expect(compareDataAttributes({}, { testid: 'btn' })).toBe(0);
  });
});

describe('extractDataAttrsFromElement', () => {
  it('should extract data attributes', () => {
    const element = createElementWithDataAttrs('div', {
      'data-testid': 'test',
      'data-custom': 'value',
    });
    
    const attrs = extractDataAttrsFromElement(element);
    
    expect(attrs['data-testid']).toBe('test');
    expect(attrs['testid']).toBe('test');
  });
  
  it('should ignore framework attributes', () => {
    const element = createElementWithDataAttrs('div', {
      'data-reactid': '123',
      'data-testid': 'test',
    });
    
    const attrs = extractDataAttrsFromElement(element);
    
    expect(attrs['data-reactid']).toBeUndefined();
    expect(attrs['data-testid']).toBe('test');
  });
});

// ============================================================================
// STRATEGY CLASS TESTS
// ============================================================================

describe('DataAttributeStrategy', () => {
  let strategy: DataAttributeStrategy;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    strategy = createDataAttributeStrategy();
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
    it('should return true for bundle with data attrs', () => {
      const bundle = createTestBundle({ dataAttrs: { testid: 'btn' } });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return false for empty dataAttrs', () => {
      const bundle = createTestBundle({ dataAttrs: {} });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for null dataAttrs', () => {
      const bundle = createTestBundle({ dataAttrs: undefined as any });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for only ignored attrs', () => {
      const bundle = createTestBundle({ dataAttrs: { reactid: '123' } });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
  });
  
  describe('find', () => {
    it('should find element with matching data-testid', () => {
      const button = createElementWithDataAttrs('button', { testid: 'submit' });
      container.appendChild(button);
      
      const bundle = createTestBundle({ dataAttrs: { testid: 'submit' } });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(button);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
    
    it('should return null for no matches', () => {
      const button = createElementWithDataAttrs('button', { testid: 'other' });
      container.appendChild(button);
      
      const bundle = createTestBundle({ dataAttrs: { testid: 'submit' } });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
    });
    
    it('should have higher confidence for testing attrs', () => {
      const button1 = createElementWithDataAttrs('button', { testid: 'btn' });
      const button2 = createElementWithDataAttrs('button', { custom: 'btn' });
      container.appendChild(button1);
      container.appendChild(button2);
      
      const bundle1 = createTestBundle({ dataAttrs: { testid: 'btn' } });
      const bundle2 = createTestBundle({ dataAttrs: { custom: 'btn' } });
      const context = createTestContext();
      
      const result1 = strategy.find(bundle1, context);
      const result2 = strategy.find(bundle2, context);
      
      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });
    
    it('should handle multiple matching elements', () => {
      const btn1 = createElementWithDataAttrs('button', { testid: 'btn' });
      const btn2 = createElementWithDataAttrs('button', { testid: 'btn' });
      container.appendChild(btn1);
      container.appendChild(btn2);
      
      const bundle = createTestBundle({ dataAttrs: { testid: 'btn' } });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeDefined();
      expect(result.metadata?.candidateCount).toBe(2);
    });
    
    it('should prefer element with matching tag', () => {
      const button = createElementWithDataAttrs('button', { testid: 'action' });
      const div = createElementWithDataAttrs('div', { testid: 'action' });
      container.appendChild(div);
      container.appendChild(button);
      
      const bundle = createTestBundle({
        tag: 'button',
        dataAttrs: { testid: 'action' },
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(button);
    });
  });
  
  describe('generateSelector', () => {
    it('should generate selector with testid', () => {
      const element = createElementWithDataAttrs('button', { testid: 'submit' });
      const selector = strategy.generateSelector(element);
      
      expect(selector).toContain('data-testid');
      expect(selector).toContain('submit');
    });
    
    it('should return null for element without data attrs', () => {
      const element = document.createElement('button');
      const selector = strategy.generateSelector(element);
      
      expect(selector).toBeNull();
    });
    
    it('should prioritize testing attributes', () => {
      const element = createElementWithDataAttrs('button', {
        custom: 'value',
        testid: 'btn',
      });
      
      const selector = strategy.generateSelector(element);
      
      expect(selector).toContain('data-testid');
    });
  });
  
  describe('validate', () => {
    it('should return true for matching attrs', () => {
      const element = createElementWithDataAttrs('button', { testid: 'btn' });
      expect(strategy.validate(element, { testid: 'btn' })).toBe(true);
    });
    
    it('should return false for non-matching attrs', () => {
      const element = createElementWithDataAttrs('button', { testid: 'btn1' });
      expect(strategy.validate(element, { testid: 'btn2' })).toBe(false);
    });
    
    it('should handle both prefixed and unprefixed keys', () => {
      const element = createElementWithDataAttrs('button', { testid: 'btn' });
      
      expect(strategy.validate(element, { testid: 'btn' })).toBe(true);
      expect(strategy.validate(element, { 'data-testid': 'btn' })).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('getDataAttributeStrategy (singleton)', () => {
  it('should return same instance', () => {
    const instance1 = getDataAttributeStrategy();
    const instance2 = getDataAttributeStrategy();
    expect(instance1).toBe(instance2);
  });
});

describe('createDataAttributeStrategy (factory)', () => {
  it('should create new instance each time', () => {
    const instance1 = createDataAttributeStrategy();
    const instance2 = createDataAttributeStrategy();
    expect(instance1).not.toBe(instance2);
  });
});
