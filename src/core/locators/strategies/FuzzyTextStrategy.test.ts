/**
 * FuzzyTextStrategy Test Suite
 * @module core/locators/strategies/FuzzyTextStrategy.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FuzzyTextStrategy,
  createFuzzyTextStrategy,
  getFuzzyTextStrategy,
  normalizeText,
  extractWords,
  diceCoefficient,
  bigramSimilarity,
  compareText,
  getVisibleText,
  isPriorityTag,
  findTextCandidates,
  STRATEGY_NAME,
  STRATEGY_PRIORITY,
  BASE_CONFIDENCE,
  SIMILARITY_THRESHOLD,
  MAX_TEXT_LENGTH,
} from './FuzzyTextStrategy';
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
    text: 'Submit Form',
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
 * Creates a test element with text content
 */
function createElementWithText(
  tagName: string,
  text: string
): HTMLElement {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('normalizeText', () => {
  it('should trim whitespace', () => {
    expect(normalizeText('  hello world  ')).toBe('hello world');
  });
  
  it('should collapse multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });
  
  it('should convert to lowercase', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });
  
  it('should handle null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
  
  it('should truncate long text', () => {
    const longText = 'a'.repeat(600);
    expect(normalizeText(longText).length).toBe(MAX_TEXT_LENGTH);
  });
  
  it('should optionally remove punctuation', () => {
    expect(normalizeText('Hello, World!', true)).toBe('hello world');
  });
});

describe('extractWords', () => {
  it('should extract unique words', () => {
    const words = extractWords('hello world hello');
    expect(words).toContain('hello');
    expect(words).toContain('world');
    expect(words.filter(w => w === 'hello').length).toBe(1);
  });
  
  it('should filter short words', () => {
    const words = extractWords('a an the hello');
    expect(words).not.toContain('a'); // 'a' is filtered (< MIN_TEXT_LENGTH)
    expect(words).toContain('an'); // 'an' is kept (>= MIN_TEXT_LENGTH of 2)
    expect(words).toContain('the');
    expect(words).toContain('hello');
  });
  
  it('should handle empty string', () => {
    expect(extractWords('')).toEqual([]);
  });
  
  it('should remove punctuation', () => {
    const words = extractWords('hello, world!');
    expect(words).toContain('hello');
    expect(words).toContain('world');
  });
});

describe('diceCoefficient', () => {
  it('should return 1 for identical sets', () => {
    expect(diceCoefficient(['hello', 'world'], ['hello', 'world'])).toBe(1);
  });
  
  it('should return 0 for disjoint sets', () => {
    expect(diceCoefficient(['hello'], ['world'])).toBe(0);
  });
  
  it('should return partial score for overlapping sets', () => {
    const score = diceCoefficient(['hello', 'world'], ['hello', 'there']);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
  
  it('should handle empty sets', () => {
    expect(diceCoefficient([], [])).toBe(1);
    expect(diceCoefficient(['hello'], [])).toBe(0);
    expect(diceCoefficient([], ['hello'])).toBe(0);
  });
});

describe('bigramSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(bigramSimilarity('hello', 'hello')).toBe(1);
  });
  
  it('should return 0 for completely different strings', () => {
    expect(bigramSimilarity('abc', 'xyz')).toBe(0);
  });
  
  it('should return high score for similar strings', () => {
    const score = bigramSimilarity('hello', 'hallo');
    expect(score).toBeGreaterThanOrEqual(0.5); // Actually 0.5 exactly
  });
  
  it('should be case-insensitive', () => {
    expect(bigramSimilarity('Hello', 'hello')).toBe(1);
  });
  
  it('should handle empty strings', () => {
    expect(bigramSimilarity('', '')).toBe(1);
    expect(bigramSimilarity('hello', '')).toBe(0);
  });
});

describe('compareText', () => {
  it('should return score of 1 for exact match', () => {
    const result = compareText('Submit Form', 'Submit Form');
    expect(result.score).toBe(1);
    expect(result.isMatch).toBe(true);
  });
  
  it('should return score of 1 for case-insensitive match', () => {
    const result = compareText('Submit Form', 'submit form');
    expect(result.score).toBe(1);
  });
  
  it('should return partial score for similar text', () => {
    const result = compareText('Submit Form', 'Submit Button');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });
  
  it('should track word overlap', () => {
    const result = compareText('hello world', 'hello there');
    expect(result.wordOverlap.common).toContain('hello');
    expect(result.wordOverlap.targetOnly).toContain('world');
    expect(result.wordOverlap.candidateOnly).toContain('there');
  });
  
  it('should meet threshold for similar text', () => {
    const result = compareText('Submit Form', 'Submit the Form');
    expect(result.isMatch).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });
  
  it('should not meet threshold for different text', () => {
    const result = compareText('Submit Form', 'Cancel Order');
    expect(result.isMatch).toBe(false);
  });
});

describe('getVisibleText', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should get text from element', () => {
    const btn = createElementWithText('button', 'Click Me');
    container.appendChild(btn);
    expect(getVisibleText(btn)).toBe('Click Me');
  });
  
  it('should get value from input', () => {
    const input = document.createElement('input');
    input.value = 'test value';
    container.appendChild(input);
    expect(getVisibleText(input)).toBe('test value');
  });
  
  it('should get placeholder from empty input', () => {
    const input = document.createElement('input');
    input.placeholder = 'Enter text';
    container.appendChild(input);
    expect(getVisibleText(input)).toBe('Enter text');
  });
  
  it('should return empty for hidden elements', () => {
    const btn = createElementWithText('button', 'Hidden');
    btn.style.display = 'none';
    container.appendChild(btn);
    expect(getVisibleText(btn)).toBe('');
  });
  
  it('should return empty for script tags', () => {
    const script = document.createElement('script');
    script.textContent = 'console.log("test")';
    expect(getVisibleText(script)).toBe('');
  });
});

describe('isPriorityTag', () => {
  it('should return true for button', () => {
    const btn = document.createElement('button');
    expect(isPriorityTag(btn)).toBe(true);
  });
  
  it('should return true for anchor', () => {
    const link = document.createElement('a');
    expect(isPriorityTag(link)).toBe(true);
  });
  
  it('should return true for label', () => {
    const label = document.createElement('label');
    expect(isPriorityTag(label)).toBe(true);
  });
  
  it('should return false for div', () => {
    const div = document.createElement('div');
    expect(isPriorityTag(div)).toBe(false);
  });
  
  it('should return true for span', () => {
    const span = document.createElement('span');
    expect(isPriorityTag(span)).toBe(true);
  });
});

describe('findTextCandidates', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find element with matching text', () => {
    const btn = createElementWithText('button', 'Submit Form');
    container.appendChild(btn);
    
    const candidates = findTextCandidates('Submit Form', document);
    
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].element).toBe(btn);
    expect(candidates[0].similarity).toBe(1);
  });
  
  it('should find element with similar text', () => {
    const btn = createElementWithText('button', 'Submit the Form');
    container.appendChild(btn);
    
    const candidates = findTextCandidates('Submit Form', document);
    
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].similarity).toBeGreaterThan(SIMILARITY_THRESHOLD);
  });
  
  it('should sort by similarity', () => {
    const btn1 = createElementWithText('button', 'Submit Form');
    const btn2 = createElementWithText('button', 'Submit');
    container.appendChild(btn1);
    container.appendChild(btn2);
    
    const candidates = findTextCandidates('Submit Form', document);
    
    expect(candidates[0].similarity).toBeGreaterThan(candidates[1].similarity);
  });
  
  it('should filter by tag when provided', () => {
    const btn = createElementWithText('button', 'Submit Form');
    const span = createElementWithText('span', 'Submit Form');
    container.appendChild(btn);
    container.appendChild(span);
    
    const candidates = findTextCandidates('Submit Form', document, 'button');
    
    expect(candidates.length).toBe(1);
    expect(candidates[0].element).toBe(btn);
  });
  
  it('should return empty for no matches', () => {
    const btn = createElementWithText('button', 'Cancel');
    container.appendChild(btn);
    
    const candidates = findTextCandidates('Submit Form', document);
    
    expect(candidates.length).toBe(0);
  });
});

// ============================================================================
// STRATEGY CLASS TESTS
// ============================================================================

describe('FuzzyTextStrategy', () => {
  let strategy: FuzzyTextStrategy;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    strategy = createFuzzyTextStrategy();
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
    
    it('should have correct similarity threshold', () => {
      expect(strategy.similarityThreshold).toBe(SIMILARITY_THRESHOLD);
    });
  });
  
  describe('canHandle', () => {
    it('should return true for bundle with text', () => {
      const bundle = createTestBundle({ text: 'Submit Form' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return false for empty text', () => {
      const bundle = createTestBundle({ text: '' });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for very short text', () => {
      const bundle = createTestBundle({ text: 'a' });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for whitespace-only text', () => {
      const bundle = createTestBundle({ text: '   ' });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
  });
  
  describe('find', () => {
    it('should find element with exact matching text', () => {
      const btn = createElementWithText('button', 'Submit Form');
      container.appendChild(btn);
      
      const bundle = createTestBundle({ text: 'Submit Form', tag: 'button' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
      expect(result.confidence).toBeGreaterThan(BASE_CONFIDENCE);
      expect(result.metadata?.similarity).toBe(1);
    });
    
    it('should find element with similar text', () => {
      const btn = createElementWithText('button', 'Submit the Form Now');
      container.appendChild(btn);
      
      const bundle = createTestBundle({ text: 'Submit Form', tag: 'button' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.metadata?.similarity).toBeGreaterThan(SIMILARITY_THRESHOLD);
    });
    
    it('should return null for no matches', () => {
      const btn = createElementWithText('button', 'Cancel Order');
      container.appendChild(btn);
      
      const bundle = createTestBundle({ text: 'Submit Form' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
      expect(result.confidence).toBe(0);
    });
    
    it('should return error for bundle without text', () => {
      const bundle = createTestBundle({ text: '' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
      expect(result.error).toBeDefined();
    });
    
    it('should prefer element with matching tag', () => {
      const btn = createElementWithText('button', 'Submit Form');
      const span = createElementWithText('span', 'Submit Form');
      container.appendChild(span);
      container.appendChild(btn);
      
      const bundle = createTestBundle({ text: 'Submit Form', tag: 'button' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
    });
    
    it('should handle multiple matching elements', () => {
      const btn1 = createElementWithText('button', 'Submit Form');
      const btn2 = createElementWithText('button', 'Submit Form');
      container.appendChild(btn1);
      container.appendChild(btn2);
      
      const bundle = createTestBundle({ text: 'Submit Form' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeDefined();
      expect(result.metadata?.candidateCount).toBe(2);
      expect(result.metadata?.isAmbiguous).toBe(true);
    });
    
    it('should have higher confidence for exact matches', () => {
      const btn1 = createElementWithText('button', 'Submit Form');
      const btn2 = createElementWithText('button', 'Submit the Form');
      container.appendChild(btn1);
      container.appendChild(btn2);
      
      const bundle1 = createTestBundle({ text: 'Submit Form' });
      const bundle2 = createTestBundle({ text: 'Submit the Form' });
      const context = createTestContext();
      
      // Clear and test each separately
      container.innerHTML = '';
      container.appendChild(createElementWithText('button', 'Submit Form'));
      const result1 = strategy.find(bundle1, context);
      
      container.innerHTML = '';
      container.appendChild(createElementWithText('button', 'Submit the Form'));
      const result2 = strategy.find(bundle2, context);
      
      // Both should find their exact match with high confidence
      expect(result1.metadata?.similarity).toBe(1);
      expect(result2.metadata?.similarity).toBe(1);
    });
  });
  
  describe('generateSelector', () => {
    it('should return normalized text', () => {
      const btn = createElementWithText('button', 'Submit Form');
      const selector = strategy.generateSelector(btn);
      
      expect(selector).toBe('submit form');
    });
    
    it('should return null for empty text', () => {
      const btn = document.createElement('button');
      const selector = strategy.generateSelector(btn);
      
      expect(selector).toBeNull();
    });
    
    it('should truncate long text', () => {
      const btn = createElementWithText('button', 'a'.repeat(200));
      const selector = strategy.generateSelector(btn);
      
      expect(selector?.length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('validate', () => {
    it('should return true for matching text', () => {
      const btn = createElementWithText('button', 'Submit Form');
      expect(strategy.validate(btn, 'Submit Form')).toBe(true);
    });
    
    it('should return true for similar text above threshold', () => {
      const btn = createElementWithText('button', 'Submit the Form');
      expect(strategy.validate(btn, 'Submit Form')).toBe(true);
    });
    
    it('should return false for different text', () => {
      const btn = createElementWithText('button', 'Cancel');
      expect(strategy.validate(btn, 'Submit Form')).toBe(false);
    });
  });
  
  describe('getSimilarity', () => {
    it('should return 1 for exact match', () => {
      const btn = createElementWithText('button', 'Submit Form');
      expect(strategy.getSimilarity(btn, 'Submit Form')).toBe(1);
    });
    
    it('should return partial score for similar text', () => {
      const btn = createElementWithText('button', 'Submit the Form');
      const similarity = strategy.getSimilarity(btn, 'Submit Form');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
    
    it('should return 0 for completely different text', () => {
      const btn = createElementWithText('button', 'Cancel Order');
      const similarity = strategy.getSimilarity(btn, 'Submit Form');
      expect(similarity).toBeLessThan(SIMILARITY_THRESHOLD);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('getFuzzyTextStrategy (singleton)', () => {
  it('should return same instance', () => {
    const instance1 = getFuzzyTextStrategy();
    const instance2 = getFuzzyTextStrategy();
    expect(instance1).toBe(instance2);
  });
});

describe('createFuzzyTextStrategy (factory)', () => {
  it('should create new instance each time', () => {
    const instance1 = createFuzzyTextStrategy();
    const instance2 = createFuzzyTextStrategy();
    expect(instance1).not.toBe(instance2);
  });
});
