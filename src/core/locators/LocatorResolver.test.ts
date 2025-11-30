/**
 * LocatorResolver Test Suite
 * @module core/locators/LocatorResolver.test
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createLocatorResolver,
  getLocatorResolver,
  resetLocatorResolver,
  resolveElement,
  resolveElementSync,
  delay,
  createResolverConfig,
  meetsConfidenceThreshold,
  compareBestResult,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRY_INTERVAL_MS,
} from './LocatorResolver';
import {
  StrategyRegistry,
  createStrategyRegistry,
  resetStrategyRegistry,
} from './StrategyRegistry';
import type { ILocatorStrategy, LocatorResult } from './strategies/ILocatorStrategy';
import type { LocatorBundle } from '../types/locator-bundle';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock strategy
 */
function createMockStrategy(
  name: string,
  options: {
    priority?: number;
    confidence?: number;
    canHandle?: boolean;
    element?: HTMLElement | null;
    delay?: number;
  } = {}
): ILocatorStrategy {
  const {
    priority = 5,
    confidence = 0.8,
    canHandle = true,
    element = null,
    delay: strategyDelay = 0,
  } = options;
  
  return {
    name,
    priority,
    baseConfidence: confidence,
    canHandle: vi.fn().mockReturnValue(canHandle),
    find: vi.fn().mockImplementation(() => {
      if (strategyDelay > 0) {
        // Simulate async delay in sync context
      }
      return {
        element,
        confidence: element ? confidence : 0,
        strategy: name,
        duration: strategyDelay,
      };
    }),
    generateSelector: vi.fn().mockReturnValue(null),
    validate: vi.fn().mockReturnValue(true),
  };
}

/**
 * Creates a minimal test bundle
 */
function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'button',
    id: 'test-btn',
    name: '',
    placeholder: '',
    aria: '',
    dataAttrs: {},
    text: 'Test Button',
    css: '',
    xpath: '/html/body/button',
    classes: ['btn'],
    pageUrl: 'http://localhost',
    bounding: { x: 100, y: 100, width: 120, height: 40 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

/**
 * Creates a test element
 */
function createTestElement(tag: string = 'button'): HTMLElement {
  const element = document.createElement(tag);
  element.id = 'test-element';
  return element;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('delay', () => {
  it('should delay for specified time', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small variance
  });
});

describe('createResolverConfig', () => {
  it('should create config with defaults', () => {
    const config = createResolverConfig();
    
    expect(config.timeout).toBe(DEFAULT_TIMEOUT_MS);
    expect(config.retryInterval).toBe(DEFAULT_RETRY_INTERVAL_MS);
    expect(config.enableRetry).toBe(true);
  });
  
  it('should apply overrides', () => {
    const config = createResolverConfig({ timeout: 5000, enableRetry: false });
    
    expect(config.timeout).toBe(5000);
    expect(config.enableRetry).toBe(false);
    expect(config.retryInterval).toBe(DEFAULT_RETRY_INTERVAL_MS);
  });
});

describe('meetsConfidenceThreshold', () => {
  it('should return true when above threshold', () => {
    const result: LocatorResult = {
      element: document.createElement('div'),
      confidence: 0.8,
      strategy: 'test',
      duration: 0,
    };
    
    expect(meetsConfidenceThreshold(result, 0.5)).toBe(true);
  });
  
  it('should return false when below threshold', () => {
    const result: LocatorResult = {
      element: document.createElement('div'),
      confidence: 0.3,
      strategy: 'test',
      duration: 0,
    };
    
    expect(meetsConfidenceThreshold(result, 0.5)).toBe(false);
  });
  
  it('should return false when no element', () => {
    const result: LocatorResult = {
      element: null,
      confidence: 0.8,
      strategy: 'test',
      duration: 0,
    };
    
    expect(meetsConfidenceThreshold(result, 0.5)).toBe(false);
  });
  
  it('should return false for null result', () => {
    expect(meetsConfidenceThreshold(null, 0.5)).toBe(false);
  });
});

describe('compareBestResult', () => {
  it('should return non-null result', () => {
    const result: LocatorResult = {
      element: document.createElement('div'),
      confidence: 0.5,
      strategy: 'test',
      duration: 0,
    };
    
    expect(compareBestResult(null, result)).toBe(result);
    expect(compareBestResult(result, null)).toBe(result);
  });
  
  it('should prefer result with element', () => {
    const withElement: LocatorResult = {
      element: document.createElement('div'),
      confidence: 0.5,
      strategy: 'a',
      duration: 0,
    };
    const withoutElement: LocatorResult = {
      element: null,
      confidence: 0.9,
      strategy: 'b',
      duration: 0,
    };
    
    expect(compareBestResult(withElement, withoutElement)).toBe(withElement);
    expect(compareBestResult(withoutElement, withElement)).toBe(withElement);
  });
  
  it('should prefer higher confidence', () => {
    const high: LocatorResult = {
      element: document.createElement('div'),
      confidence: 0.9,
      strategy: 'a',
      duration: 0,
    };
    const low: LocatorResult = {
      element: document.createElement('div'),
      confidence: 0.5,
      strategy: 'b',
      duration: 0,
    };
    
    expect(compareBestResult(high, low)).toBe(high);
    expect(compareBestResult(low, high)).toBe(high);
  });
  
  it('should return null for two nulls', () => {
    expect(compareBestResult(null, null)).toBeNull();
  });
});

// ============================================================================
// RESOLVER CLASS TESTS
// ============================================================================

describe('LocatorResolver', () => {
  let container: HTMLDivElement;
  let registry: StrategyRegistry;
  
  beforeEach(() => {
    resetLocatorResolver();
    resetStrategyRegistry();
    
    container = document.createElement('div');
    document.body.appendChild(container);
    
    registry = createStrategyRegistry({ autoRegisterDefaults: false });
  });
  
  describe('constructor', () => {
    it('should use default registry', () => {
      const resolver = createLocatorResolver();
      
      expect(resolver.getRegistry()).toBeDefined();
    });
    
    it('should use custom registry', () => {
      const customRegistry = createStrategyRegistry({ autoRegisterDefaults: false });
      const resolver = createLocatorResolver({ registry: customRegistry });
      
      expect(resolver.getRegistry()).toBe(customRegistry);
    });
    
    it('should use default config values', () => {
      const resolver = createLocatorResolver();
      const config = resolver.getConfig();
      
      expect(config.timeout).toBe(DEFAULT_TIMEOUT_MS);
      expect(config.retryInterval).toBe(DEFAULT_RETRY_INTERVAL_MS);
    });
  });
  
  describe('resolveSync', () => {
    it('should find element with single strategy', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy = createMockStrategy('test', {
        priority: 1,
        confidence: 0.8,
        element,
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.success).toBe(true);
      expect(result.element).toBe(element);
      expect(result.confidence).toBe(0.8);
      expect(result.strategy).toBe('test');
    });
    
    it('should try strategies in priority order', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy1 = createMockStrategy('first', {
        priority: 1,
        confidence: 0.5,
        canHandle: false,
      });
      const strategy2 = createMockStrategy('second', {
        priority: 2,
        confidence: 0.8,
        element,
      });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('second');
      expect(strategy1.canHandle).toHaveBeenCalled();
    });
    
    it('should return best result even if below threshold', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy = createMockStrategy('test', {
        priority: 1,
        confidence: 0.3,
        element,
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({
        registry,
        minConfidence: 0.5,
      });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.success).toBe(false);
      expect(result.bestResult).not.toBeNull();
      expect(result.bestResult?.confidence).toBe(0.3);
    });
    
    it('should early exit on high confidence', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy1 = createMockStrategy('high', {
        priority: 1,
        confidence: 0.95,
        element,
      });
      const strategy2 = createMockStrategy('not-called', {
        priority: 2,
        confidence: 0.5,
        element,
      });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('high');
      // Second strategy should not be called due to early exit
      expect(result.attempts.length).toBe(1);
    });
    
    it('should skip specified strategies', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy1 = createMockStrategy('skip-me', {
        priority: 1,
        confidence: 0.9,
        element,
      });
      const strategy2 = createMockStrategy('use-me', {
        priority: 2,
        confidence: 0.7,
        element,
      });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle(), undefined, {
        skipStrategies: ['skip-me'],
      });
      
      expect(result.strategy).toBe('use-me');
    });
    
    it('should use only specified strategies', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy1 = createMockStrategy('allowed', {
        priority: 2,
        confidence: 0.7,
        element,
      });
      const strategy2 = createMockStrategy('not-allowed', {
        priority: 1,
        confidence: 0.9,
        element,
      });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle(), undefined, {
        onlyStrategies: ['allowed'],
      });
      
      expect(result.strategy).toBe('allowed');
      expect(result.attempts.length).toBe(1);
    });
    
    it('should return failure when no strategies available', () => {
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No strategies available');
    });
    
    it('should handle strategy errors', () => {
      const strategy = createMockStrategy('error', { priority: 1 });
      (strategy.find as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Strategy error');
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.success).toBe(false);
      expect(result.attempts[0].error).toBe('Strategy error');
    });
    
    it('should track all attempts', () => {
      const strategy1 = createMockStrategy('first', { priority: 1, canHandle: false });
      const strategy2 = createMockStrategy('second', { priority: 2, element: null });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveSync(createTestBundle());
      
      expect(result.attempts.length).toBe(2);
      expect(result.attempts[0].strategy).toBe('first');
      expect(result.attempts[0].canHandle).toBe(false);
      expect(result.attempts[1].strategy).toBe('second');
      expect(result.attempts[1].canHandle).toBe(true);
    });
  });
  
  describe('resolve (async)', () => {
    it('should find element', async () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy = createMockStrategy('test', {
        priority: 1,
        confidence: 0.8,
        element,
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({ registry, enableRetry: false });
      
      const result = await resolver.resolve(createTestBundle());
      
      expect(result.success).toBe(true);
      expect(result.element).toBe(element);
    });
    
    it('should retry until element found', async () => {
      const element = createTestElement();
      let callCount = 0;
      
      const strategy = createMockStrategy('test', { priority: 1 });
      (strategy.find as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        // Return element on third call
        return {
          element: callCount >= 3 ? element : null,
          confidence: callCount >= 3 ? 0.8 : 0,
          strategy: 'test',
          duration: 0,
        };
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({
        registry,
        timeout: 1000,
        retryInterval: 50,
      });
      
      const result = await resolver.resolve(createTestBundle());
      
      expect(result.success).toBe(true);
      expect(result.retryCycles).toBeGreaterThan(0);
    });
    
    it('should timeout after specified duration', async () => {
      const strategy = createMockStrategy('test', {
        priority: 1,
        confidence: 0,
        element: null,
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({
        registry,
        timeout: 100,
        retryInterval: 20,
      });
      
      const result = await resolver.resolve(createTestBundle());
      
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(80); // Allow timing variance
    });
    
    it('should not retry when disabled', async () => {
      const strategy = createMockStrategy('test', {
        priority: 1,
        confidence: 0,
        element: null,
      });
      
      registry.register(strategy);
      const resolver = createLocatorResolver({
        registry,
        enableRetry: false,
      });
      
      const result = await resolver.resolve(createTestBundle());
      
      expect(result.success).toBe(false);
      expect(result.retryCycles).toBe(0);
    });
  });
  
  describe('resolveWith', () => {
    it('should use specific strategy', () => {
      const element = createTestElement();
      container.appendChild(element);
      
      const strategy1 = createMockStrategy('not-used', { priority: 1, element });
      const strategy2 = createMockStrategy('use-this', { priority: 2, element });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveWith('use-this', createTestBundle());
      
      expect(result.strategy).toBe('use-this');
      expect(strategy1.find).not.toHaveBeenCalled();
    });
    
    it('should return error for unknown strategy', () => {
      const resolver = createLocatorResolver({ registry });
      
      const result = resolver.resolveWith('unknown', createTestBundle());
      
      expect(result.element).toBeNull();
      expect(result.error).toContain('not found');
    });
  });
  
  describe('testHandlers', () => {
    it('should return strategies that can handle bundle', () => {
      const strategy1 = createMockStrategy('can', { canHandle: true });
      const strategy2 = createMockStrategy('cannot', { canHandle: false });
      
      registry.register(strategy1);
      registry.register(strategy2);
      const resolver = createLocatorResolver({ registry });
      
      const handlers = resolver.testHandlers(createTestBundle());
      
      expect(handlers).toContain('can');
      expect(handlers).not.toContain('cannot');
    });
  });
  
  describe('configuration', () => {
    it('should get and update config', () => {
      const resolver = createLocatorResolver();
      
      const original = resolver.getConfig();
      expect(original.timeout).toBe(DEFAULT_TIMEOUT_MS);
      
      resolver.updateConfig({ timeout: 5000 });
      
      const updated = resolver.getConfig();
      expect(updated.timeout).toBe(5000);
    });
    
    it('should get and set registry', () => {
      const resolver = createLocatorResolver();
      const newRegistry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      resolver.setRegistry(newRegistry);
      
      expect(resolver.getRegistry()).toBe(newRegistry);
    });
  });
  
  describe('createContext', () => {
    it('should create context with defaults', () => {
      const resolver = createLocatorResolver();
      const context = resolver.createContext();
      
      expect(context.document).toBe(document);
    });
    
    it('should create context with custom document', () => {
      const resolver = createLocatorResolver();
      const customDoc = document.implementation.createHTMLDocument();
      const context = resolver.createContext(customDoc);
      
      expect(context.document).toBe(customDoc);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getLocatorResolver (singleton)', () => {
  beforeEach(() => {
    resetLocatorResolver();
  });
  
  it('should return same instance', () => {
    const instance1 = getLocatorResolver();
    const instance2 = getLocatorResolver();
    
    expect(instance1).toBe(instance2);
  });
  
  it('should reset on resetLocatorResolver', () => {
    const instance1 = getLocatorResolver();
    resetLocatorResolver();
    const instance2 = getLocatorResolver();
    
    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('resolveElement', () => {
  beforeEach(() => {
    resetLocatorResolver();
    resetStrategyRegistry();
  });
  
  it('should use global resolver', async () => {
    const result = await resolveElement(createTestBundle(), undefined, {
      enableRetry: false,
    });
    
    expect(result).toBeDefined();
    expect(result.attempts).toBeDefined();
  });
});

describe('resolveElementSync', () => {
  beforeEach(() => {
    resetLocatorResolver();
    resetStrategyRegistry();
  });
  
  it('should use global resolver', () => {
    const result = resolveElementSync(createTestBundle());
    
    expect(result).toBeDefined();
    expect(result.attempts).toBeDefined();
  });
});
