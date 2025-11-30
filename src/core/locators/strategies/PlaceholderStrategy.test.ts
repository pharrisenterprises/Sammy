/**
 * PlaceholderStrategy Test Suite
 * @module core/locators/strategies/PlaceholderStrategy.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PlaceholderStrategy,
  createPlaceholderStrategy,
  getPlaceholderStrategy,
  normalizePlaceholder,
  supportsPlaceholder,
  getPlaceholder,
  buildPlaceholderSelector,
  placeholderSimilarity,
  STRATEGY_NAME,
  STRATEGY_PRIORITY,
  BASE_CONFIDENCE,
} from './PlaceholderStrategy';
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
    tag: 'input',
    id: '',
    name: '',
    placeholder: 'Enter your email',
    aria: '',
    dataAttrs: {},
    text: '',
    css: '',
    xpath: '/html/body/input',
    classes: [],
    pageUrl: 'http://localhost',
    bounding: { x: 100, y: 100, width: 200, height: 40 },
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
 * Creates a test input element with placeholder
 */
function createInputWithPlaceholder(
  placeholder: string,
  type = 'text'
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.placeholder = placeholder;
  return input;
}

/**
 * Creates a test textarea with placeholder
 */
function createTextareaWithPlaceholder(placeholder: string): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.placeholder = placeholder;
  return textarea;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('normalizePlaceholder', () => {
  it('should trim whitespace', () => {
    expect(normalizePlaceholder('  hello  ')).toBe('hello');
  });
  
  it('should convert to lowercase', () => {
    expect(normalizePlaceholder('Enter Email')).toBe('enter email');
  });
  
  it('should handle null/undefined', () => {
    expect(normalizePlaceholder(null)).toBe('');
    expect(normalizePlaceholder(undefined)).toBe('');
  });
  
  it('should normalize Unicode', () => {
    expect(normalizePlaceholder('café')).toBe('café');
  });
});

describe('supportsPlaceholder', () => {
  it('should return true for text input', () => {
    const input = createInputWithPlaceholder('test', 'text');
    expect(supportsPlaceholder(input)).toBe(true);
  });
  
  it('should return true for email input', () => {
    const input = createInputWithPlaceholder('test', 'email');
    expect(supportsPlaceholder(input)).toBe(true);
  });
  
  it('should return true for textarea', () => {
    const textarea = createTextareaWithPlaceholder('test');
    expect(supportsPlaceholder(textarea)).toBe(true);
  });
  
  it('should return false for checkbox input', () => {
    const input = createInputWithPlaceholder('test', 'checkbox');
    expect(supportsPlaceholder(input)).toBe(false);
  });
  
  it('should return false for div', () => {
    const div = document.createElement('div');
    expect(supportsPlaceholder(div)).toBe(false);
  });
});

describe('getPlaceholder', () => {
  it('should return placeholder from input', () => {
    const input = createInputWithPlaceholder('Enter name');
    expect(getPlaceholder(input)).toBe('Enter name');
  });
  
  it('should return placeholder from textarea', () => {
    const textarea = createTextareaWithPlaceholder('Enter message');
    expect(getPlaceholder(textarea)).toBe('Enter message');
  });
  
  it('should return null for non-placeholder elements', () => {
    const div = document.createElement('div');
    expect(getPlaceholder(div)).toBeNull();
  });
  
  it('should return null for empty placeholder', () => {
    const input = document.createElement('input');
    input.type = 'text';
    expect(getPlaceholder(input)).toBeNull();
  });
});

describe('buildPlaceholderSelector', () => {
  it('should build selector for input tag', () => {
    const selector = buildPlaceholderSelector('Enter email', 'input');
    expect(selector).toBe('input[placeholder="Enter email"]');
  });
  
  it('should build selector for textarea tag', () => {
    const selector = buildPlaceholderSelector('Enter message', 'textarea');
    expect(selector).toBe('textarea[placeholder="Enter message"]');
  });
  
  it('should build combined selector without tag', () => {
    const selector = buildPlaceholderSelector('Enter text');
    expect(selector).toContain('input[placeholder="Enter text"]');
    expect(selector).toContain('textarea[placeholder="Enter text"]');
  });
  
  it('should escape special characters', () => {
    const selector = buildPlaceholderSelector('Enter "name"', 'input');
    expect(selector).toContain('\\"');
  });
});

describe('placeholderSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(placeholderSimilarity('Enter email', 'Enter email')).toBe(1);
  });
  
  it('should return 1 for case-insensitive match', () => {
    expect(placeholderSimilarity('Enter Email', 'enter email')).toBe(1);
  });
  
  it('should return partial score for substring', () => {
    const similarity = placeholderSimilarity('Enter', 'Enter email');
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });
  
  it('should return 0 for completely different strings', () => {
    expect(placeholderSimilarity('Enter email', 'Password')).toBe(0);
  });
  
  it('should return 0 for empty strings', () => {
    expect(placeholderSimilarity('', 'Enter email')).toBe(0);
  });
});

// ============================================================================
// STRATEGY CLASS TESTS
// ============================================================================

describe('PlaceholderStrategy', () => {
  let strategy: PlaceholderStrategy;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    strategy = createPlaceholderStrategy();
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
    it('should return true for bundle with placeholder', () => {
      const bundle = createTestBundle({ placeholder: 'Enter email' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return false for bundle without placeholder', () => {
      const bundle = createTestBundle({ placeholder: '' });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for empty placeholder', () => {
      const bundle = createTestBundle({ placeholder: '   ' });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
  });
  
  describe('find', () => {
    it('should find element with matching placeholder', () => {
      const input = createInputWithPlaceholder('Enter your email');
      container.appendChild(input);
      
      const bundle = createTestBundle({ placeholder: 'Enter your email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(input);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.strategy).toBe(STRATEGY_NAME);
    });
    
    it('should return null for no matches', () => {
      const input = createInputWithPlaceholder('Other placeholder');
      container.appendChild(input);
      
      const bundle = createTestBundle({ placeholder: 'Enter your email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
      expect(result.confidence).toBe(0);
    });
    
    it('should return error for bundle without placeholder', () => {
      const bundle = createTestBundle({ placeholder: '' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
      expect(result.error).toBeDefined();
    });
    
    it('should handle multiple matching elements', () => {
      const input1 = createInputWithPlaceholder('Enter email');
      const input2 = createInputWithPlaceholder('Enter email');
      container.appendChild(input1);
      container.appendChild(input2);
      
      const bundle = createTestBundle({ placeholder: 'Enter email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeDefined();
      expect(result.metadata?.candidateCount).toBe(2);
    });
    
    it('should prefer element with matching tag', () => {
      const input = createInputWithPlaceholder('Enter text');
      const textarea = createTextareaWithPlaceholder('Enter text');
      container.appendChild(input);
      container.appendChild(textarea);
      
      const bundle = createTestBundle({ placeholder: 'Enter text', tag: 'input' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(input);
    });
    
    it('should find by partial match when exact fails', () => {
      const input = createInputWithPlaceholder('Enter your email address');
      container.appendChild(input);
      
      const bundle = createTestBundle({ placeholder: 'Enter your email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(input);
      expect(result.metadata?.matchType).toBe('partial');
    });
  });
  
  describe('generateSelector', () => {
    it('should generate selector for input', () => {
      const input = createInputWithPlaceholder('Enter name');
      const selector = strategy.generateSelector(input);
      
      expect(selector).toContain('placeholder="Enter name"');
    });
    
    it('should return null for element without placeholder', () => {
      const div = document.createElement('div');
      const selector = strategy.generateSelector(div);
      
      expect(selector).toBeNull();
    });
  });
  
  describe('validate', () => {
    it('should return true for matching placeholder', () => {
      const input = createInputWithPlaceholder('Enter email');
      expect(strategy.validate(input, 'Enter email')).toBe(true);
    });
    
    it('should return true for case-insensitive match', () => {
      const input = createInputWithPlaceholder('Enter Email');
      expect(strategy.validate(input, 'enter email')).toBe(true);
    });
    
    it('should return false for non-matching placeholder', () => {
      const input = createInputWithPlaceholder('Enter email');
      expect(strategy.validate(input, 'Enter password')).toBe(false);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('getPlaceholderStrategy (singleton)', () => {
  it('should return same instance', () => {
    const instance1 = getPlaceholderStrategy();
    const instance2 = getPlaceholderStrategy();
    expect(instance1).toBe(instance2);
  });
});

describe('createPlaceholderStrategy (factory)', () => {
  it('should create new instance each time', () => {
    const instance1 = createPlaceholderStrategy();
    const instance2 = createPlaceholderStrategy();
    expect(instance1).not.toBe(instance2);
  });
});
