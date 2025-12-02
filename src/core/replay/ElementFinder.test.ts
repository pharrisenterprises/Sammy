/**
 * Tests for ElementFinder
 * @module core/replay/ElementFinder.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ElementFinder,
  createElementFinder,
  createFastFinder,
  createTolerantFinder,
  getElementFinder,
  resetElementFinder,
  findElement,
  findElementSync,
  isElementVisible,
  calculateSimilarity,
  STRATEGY_CONFIDENCE,
  DEFAULT_STRATEGY_ORDER,
  DEFAULT_FIND_OPTIONS,
  type FinderStrategyName,
  type FindResult,
} from './ElementFinder';
import type { LocatorBundle } from '../types/locator-bundle';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'input',
    id: null,
    name: null,
    placeholder: null,
    aria: null,
    dataAttrs: {},
    text: '',
    css: '',
    xpath: '',
    classes: [],
    pageUrl: 'http://test.com',
    bounding: { x: 100, y: 100, width: 100, height: 30 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

function createElement(
  tag: string,
  attrs: Record<string, string> = {},
  textContent?: string
): HTMLElement {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
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
// TESTS
// ============================================================================

describe('ElementFinder', () => {
  let finder: ElementFinder;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetElementFinder();
    cleanupElements();
    finder = new ElementFinder({ requireVisible: false });
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetElementFinder();
    cleanupElements();
  });
  
  // ==========================================================================
  // STRATEGY TESTS
  // ==========================================================================
  
  describe('findByStrategy', () => {
    describe('id strategy', () => {
      it('should find element by ID', () => {
        document.body.innerHTML = '<input id="test-input" />';
        const el = document.getElementById('test-input');
        const bundle = createTestBundle({ id: 'test-input' });
        
        const result = finder.findByStrategy('id', bundle, document);
        
        expect(result).toBe(el);
      });
      
      it('should return null if ID not found', () => {
        const bundle = createTestBundle({ id: 'nonexistent' });
        
        const result = finder.findByStrategy('id', bundle, document);
        
        expect(result).toBeNull();
      });
    });
    
    describe('name strategy', () => {
      it('should find element by name', () => {
        document.body.innerHTML = '<input name="email" />';
        const el = document.querySelector('[name="email"]');
        const bundle = createTestBundle({ name: 'email' });
        
        const result = finder.findByStrategy('name', bundle, document);
        
        expect(result).toBe(el);
      });
    });
    
    describe('placeholder strategy', () => {
      it('should find element by placeholder', () => {
        document.body.innerHTML = '<input placeholder="Enter email" />';
        const el = document.querySelector('[placeholder="Enter email"]');
        const bundle = createTestBundle({ placeholder: 'Enter email' });
        
        const result = finder.findByStrategy('placeholder', bundle, document);
        
        expect(result).toBe(el);
      });
    });
    
    describe('aria strategy', () => {
      it('should find element by aria-label', () => {
        document.body.innerHTML = '<button aria-label="Submit form"></button>';
        const el = document.querySelector('[aria-label="Submit form"]');
        const bundle = createTestBundle({ aria: 'Submit form' });
        
        const result = finder.findByStrategy('aria', bundle, document);
        
        expect(result).toBe(el);
      });
    });
    
    describe('dataAttributes strategy', () => {
      it('should find element by data-testid', () => {
        document.body.innerHTML = '<button data-testid="submit-btn"></button>';
        const el = document.querySelector('[data-testid="submit-btn"]');
        const bundle = createTestBundle({
          tag: 'button',
          dataAttrs: { testid: 'submit-btn' },
        });
        
        const result = finder.findByStrategy('dataAttributes', bundle, document);
        
        expect(result).toBe(el);
      });
    });
    
    describe('css strategy', () => {
      it('should find element by tag and classes', () => {
        document.body.innerHTML = '<button class="btn primary"></button>';
        const el = document.querySelector('button.btn.primary');
        const bundle = createTestBundle({
          tag: 'button',
          classes: ['btn', 'primary'],
        });
        
        const result = finder.findByStrategy('css', bundle, document);
        
        expect(result).toBe(el);
      });
    });
    
    describe('fuzzyText strategy', () => {
      it('should find element by similar text', () => {
        document.body.innerHTML = '<button>Submit Form</button>';
        const el = document.querySelector('button');
        const bundle = createTestBundle({
          tag: 'button',
          text: 'Submit Forms', // Slightly different
        });
        
        const result = finder.findByStrategy('fuzzyText', bundle, document);
        
        expect(result).toBe(el);
      });
      
      it('should not match below threshold', () => {
        document.body.innerHTML = '<button>Completely Different</button>';
        const bundle = createTestBundle({
          tag: 'button',
          text: 'Submit Form',
        });
        
        const result = finder.findByStrategy('fuzzyText', bundle, document);
        
        expect(result).toBeNull();
      });
    });
    
    describe('boundingBox strategy', () => {
      it('should find closest element within threshold', () => {
        document.body.innerHTML = '<input />';
        const el = document.querySelector('input') as HTMLElement;
        // Mock getBoundingClientRect
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          x: 110,
          y: 110,
          width: 100,
          height: 30,
          top: 110,
          left: 110,
          bottom: 140,
          right: 210,
          toJSON: () => ({}),
        });
        
        const bundle = createTestBundle({
          bounding: { x: 100, y: 100, width: 100, height: 30 },
        });
        
        const result = finder.findByStrategy('boundingBox', bundle, document);
        
        expect(result).toBe(el);
      });
    });
  });
  
  // ==========================================================================
  // ASYNC FIND TESTS
  // ==========================================================================
  
  describe('find (async)', () => {
    it('should find element immediately if present', async () => {
      const el = createElement('input', { id: 'test-input' });
      const bundle = createTestBundle({ id: 'test-input' });
      
      const resultPromise = finder.find(bundle);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.element).toBe(el);
      expect(result.strategy).toBe('id');
      expect(result.confidence).toBe(0.9);
    });
    
    it('should try multiple strategies', async () => {
      const el = createElement('input', { name: 'email' });
      const bundle = createTestBundle({ 
        id: 'nonexistent', 
        name: 'email' 
      });
      
      const resultPromise = finder.find(bundle);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.element).toBe(el);
      expect(result.strategy).toBe('name');
      expect(result.attemptedStrategies).toContain('id');
      expect(result.attemptedStrategies).toContain('name');
    });
    
    it('should retry if not found initially', async () => {
      const bundle = createTestBundle({ id: 'delayed-input' });
      
      // Start find
      const resultPromise = finder.find(bundle, document, { timeout: 500 });
      
      // Add element after 200ms
      vi.advanceTimersByTime(200);
      createElement('input', { id: 'delayed-input' });
      
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.element).not.toBeNull();
      expect(result.retryAttempts).toBeGreaterThan(0);
    });
    
    it('should timeout if element not found', async () => {
      const bundle = createTestBundle({ id: 'nonexistent' });
      
      const resultPromise = finder.find(bundle, document, { 
        timeout: 300,
        maxRetries: 2,
      });
      
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.element).toBeNull();
      expect(result.error).toBeDefined();
    });
  });
  
  // ==========================================================================
  // SYNC FIND TESTS
  // ==========================================================================
  
  describe('findSync', () => {
    it('should find element without retry', () => {
      const el = createElement('input', { id: 'test-input' });
      const bundle = createTestBundle({ id: 'test-input' });
      
      const result = finder.findSync(bundle);
      
      expect(result.element).toBe(el);
      expect(result.retryAttempts).toBe(0);
    });
    
    it('should return null if not found', () => {
      const bundle = createTestBundle({ id: 'nonexistent' });
      
      const result = finder.findSync(bundle);
      
      expect(result.element).toBeNull();
      expect(result.error).toBe('Element not found');
    });
  });
  
  // ==========================================================================
  // OPTIONS TESTS
  // ==========================================================================
  
  describe('options', () => {
    it('should respect disabled strategies', async () => {
      createElement('input', { id: 'test-input' });
      const bundle = createTestBundle({ id: 'test-input' });
      
      const resultPromise = finder.find(bundle, document, {
        disabledStrategies: ['id'],
        timeout: 100,
      });
      
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.strategy).not.toBe('id');
    });
    
    it('should respect custom strategy order', async () => {
      createElement('input', { name: 'email', id: 'test-input' });
      const bundle = createTestBundle({ id: 'test-input', name: 'email' });
      
      const resultPromise = finder.find(bundle, document, {
        strategyOrder: ['name', 'id'],
      });
      
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.strategy).toBe('name');
    });
    
    it('should respect minConfidence', async () => {
      createElement('button', {}, 'Submit');
      const bundle = createTestBundle({ tag: 'button', text: 'Submit' });
      
      const resultPromise = finder.find(bundle, document, {
        minConfidence: 0.9,
        timeout: 100,
      });
      
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      // fuzzyText has 0.4 confidence, should be rejected
      expect(result.element).toBeNull();
    });
  });
  
  // ==========================================================================
  // TEST ALL STRATEGIES
  // ==========================================================================
  
  describe('testAllStrategies', () => {
    it('should return results for all strategies', () => {
      createElement('input', { 
        id: 'test-id',
        name: 'test-name',
      });
      
      const bundle = createTestBundle({ 
        id: 'test-id',
        name: 'test-name',
      });
      
      const results = finder.testAllStrategies(bundle);
      
      expect(results.size).toBe(DEFAULT_STRATEGY_ORDER.length);
      expect(results.get('id')).not.toBeNull();
      expect(results.get('name')).not.toBeNull();
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('helper functions', () => {
  beforeEach(() => {
    cleanupElements();
  });
  
  afterEach(() => {
    cleanupElements();
  });
  
  describe('isElementVisible', () => {
    it('should return true for visible element', () => {
      const el = createElement('div', {});
      el.style.display = 'block';
      el.style.width = '100px';
      el.style.height = '100px';
      
      // Mock getBoundingClientRect for JSDOM
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 100,
        toJSON: () => ({}),
      });
      
      expect(isElementVisible(el)).toBe(true);
    });
    
    it('should return false for hidden element', () => {
      const el = createElement('div', {});
      el.style.display = 'none';
      
      expect(isElementVisible(el)).toBe(false);
    });
    
    it('should return false for invisible element', () => {
      const el = createElement('div', {});
      el.style.visibility = 'hidden';
      
      expect(isElementVisible(el)).toBe(false);
    });
    
    it('should return false for zero opacity', () => {
      const el = createElement('div', {});
      el.style.opacity = '0';
      
      expect(isElementVisible(el)).toBe(false);
    });
  });
  
  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('hello', 'hello')).toBe(1);
    });
    
    it('should return 0 for empty strings', () => {
      expect(calculateSimilarity('', 'hello')).toBe(0);
      expect(calculateSimilarity('hello', '')).toBe(0);
    });
    
    it('should be case insensitive', () => {
      expect(calculateSimilarity('Hello', 'hello')).toBe(1);
    });
    
    it('should return high score for similar strings', () => {
      const score = calculateSimilarity('Submit Form', 'Submit Forms');
      expect(score).toBeGreaterThan(0.8);
    });
    
    it('should return low score for different strings', () => {
      const score = calculateSimilarity('Hello', 'Goodbye');
      expect(score).toBeLessThan(0.3);
    });
  });
});

// ============================================================================
// FACTORY AND SINGLETON TESTS
// ============================================================================

describe('factory and singleton', () => {
  beforeEach(() => {
    resetElementFinder();
    cleanupElements();
  });
  
  afterEach(() => {
    resetElementFinder();
    cleanupElements();
  });
  
  describe('createElementFinder', () => {
    it('should create finder with default options', () => {
      const finder = createElementFinder();
      expect(finder.getOptions().timeout).toBe(2000);
    });
    
    it('should create finder with custom options', () => {
      const finder = createElementFinder({ timeout: 5000 });
      expect(finder.getOptions().timeout).toBe(5000);
    });
  });
  
  describe('createFastFinder', () => {
    it('should create finder with fast options', () => {
      const finder = createFastFinder();
      expect(finder.getOptions().timeout).toBe(500);
      expect(finder.getOptions().maxRetries).toBe(3);
    });
  });
  
  describe('createTolerantFinder', () => {
    it('should create finder with tolerant options', () => {
      const finder = createTolerantFinder();
      expect(finder.getOptions().timeout).toBe(5000);
      expect(finder.getOptions().fuzzyThreshold).toBe(0.3);
    });
  });
  
  describe('getElementFinder', () => {
    it('should return same instance', () => {
      const f1 = getElementFinder();
      const f2 = getElementFinder();
      expect(f1).toBe(f2);
    });
  });
  
  describe('resetElementFinder', () => {
    it('should reset instance', () => {
      const f1 = getElementFinder();
      resetElementFinder();
      const f2 = getElementFinder();
      expect(f2).not.toBe(f1);
    });
  });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('constants', () => {
  describe('STRATEGY_CONFIDENCE', () => {
    it('should have confidence for all strategies', () => {
      for (const strategy of DEFAULT_STRATEGY_ORDER) {
        expect(STRATEGY_CONFIDENCE[strategy]).toBeDefined();
        expect(STRATEGY_CONFIDENCE[strategy]).toBeGreaterThan(0);
        expect(STRATEGY_CONFIDENCE[strategy]).toBeLessThanOrEqual(1);
      }
    });
    
    it('should have xpath as highest confidence', () => {
      expect(STRATEGY_CONFIDENCE.xpath).toBe(1.0);
    });
    
    it('should have boundingBox as lowest confidence', () => {
      expect(STRATEGY_CONFIDENCE.boundingBox).toBe(0.3);
    });
  });
  
  describe('DEFAULT_FIND_OPTIONS', () => {
    it('should have correct timeout', () => {
      expect(DEFAULT_FIND_OPTIONS.timeout).toBe(2000);
    });
    
    it('should have correct retry interval', () => {
      expect(DEFAULT_FIND_OPTIONS.retryInterval).toBe(150);
    });
    
    it('should have correct fuzzy threshold', () => {
      expect(DEFAULT_FIND_OPTIONS.fuzzyThreshold).toBe(0.4);
    });
    
    it('should have correct bounding box threshold', () => {
      expect(DEFAULT_FIND_OPTIONS.boundingBoxThreshold).toBe(200);
    });
  });
});
