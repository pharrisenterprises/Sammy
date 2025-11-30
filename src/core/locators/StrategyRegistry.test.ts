/**
 * StrategyRegistry Test Suite
 * @module core/locators/StrategyRegistry.test
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStrategyRegistry,
  getStrategyRegistry,
  resetStrategyRegistry,
  type RegistryEntry,
} from './StrategyRegistry';
import type { ILocatorStrategy } from './strategies/ILocatorStrategy';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock strategy for testing
 */
function createMockStrategy(
  name: string,
  priority: number,
  baseConfidence: number = 0.5
): ILocatorStrategy {
  return {
    name,
    priority,
    baseConfidence,
    canHandle: vi.fn().mockReturnValue(true),
    find: vi.fn().mockReturnValue({
      element: null,
      confidence: 0,
      strategy: name,
      duration: 0,
    }),
    generateSelector: vi.fn().mockReturnValue(null),
    validate: vi.fn().mockReturnValue(true),
  };
}



// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('StrategyRegistry', () => {
  beforeEach(() => {
    resetStrategyRegistry();
  });
  
  describe('constructor', () => {
    it('should auto-register defaults by default', () => {
      const registry = createStrategyRegistry();
      
      expect(registry.count()).toBeGreaterThan(0);
      expect(registry.has('placeholder')).toBe(true);
      expect(registry.has('data-attribute')).toBe(true);
    });
    
    it('should skip auto-registration when configured', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      expect(registry.count()).toBe(0);
    });
    
    it('should disable strategies from config', () => {
      const registry = createStrategyRegistry({
        disabledStrategies: ['placeholder', 'bounding-box'],
      });
      
      expect(registry.isEnabled('placeholder')).toBe(false);
      expect(registry.isEnabled('bounding-box')).toBe(false);
      expect(registry.isEnabled('data-attribute')).toBe(true);
    });
    
    it('should apply priority overrides from config', () => {
      const registry = createStrategyRegistry({
        priorityOverrides: { 'placeholder': 100, 'data-attribute': 1 },
      });
      
      expect(registry.getPriority('placeholder')).toBe(100);
      expect(registry.getPriority('data-attribute')).toBe(1);
    });
  });
  
  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================
  
  describe('register', () => {
    it('should register a strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy = createMockStrategy('test', 5);
      
      registry.register(strategy);
      
      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(strategy);
    });
    
    it('should allow chaining', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy1 = createMockStrategy('test1', 1);
      const strategy2 = createMockStrategy('test2', 2);
      
      registry.register(strategy1).register(strategy2);
      
      expect(registry.count()).toBe(2);
    });
    
    it('should register as disabled when specified', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy = createMockStrategy('test', 5);
      
      registry.register(strategy, false);
      
      expect(registry.has('test')).toBe(true);
      expect(registry.isEnabled('test')).toBe(false);
    });
    
    it('should override existing strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy1 = createMockStrategy('test', 5, 0.5);
      const strategy2 = createMockStrategy('test', 10, 0.8);
      
      registry.register(strategy1);
      registry.register(strategy2);
      
      expect(registry.count()).toBe(1);
      expect(registry.get('test')).toBe(strategy2);
    });
  });
  
  describe('unregister', () => {
    it('should remove a strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy = createMockStrategy('test', 5);
      
      registry.register(strategy);
      const removed = registry.unregister('test');
      
      expect(removed).toBe(true);
      expect(registry.has('test')).toBe(false);
    });
    
    it('should return false for non-existent strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      const removed = registry.unregister('nonexistent');
      
      expect(removed).toBe(false);
    });
  });
  
  describe('registerDefaults', () => {
    it('should register available strategies', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.registerDefaults();
      
      // Check that implemented strategies are registered
      expect(registry.has('placeholder')).toBe(true);
      expect(registry.has('data-attribute')).toBe(true);
      expect(registry.has('fuzzy-text')).toBe(true);
      expect(registry.has('bounding-box')).toBe(true);
      expect(registry.has('css-selector')).toBe(true);
      expect(registry.has('form-label')).toBe(true);
    });
  });
  
  describe('clear', () => {
    it('should remove all strategies', () => {
      const registry = createStrategyRegistry();
      
      registry.clear();
      
      expect(registry.count()).toBe(0);
    });
  });
  
  // ==========================================================================
  // RETRIEVAL TESTS
  // ==========================================================================
  
  describe('get', () => {
    it('should return strategy by name', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy = createMockStrategy('test', 5);
      
      registry.register(strategy);
      
      expect(registry.get('test')).toBe(strategy);
    });
    
    it('should return undefined for non-existent strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });
  
  describe('getEntry', () => {
    it('should return full entry', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy = createMockStrategy('test', 5);
      
      registry.register(strategy);
      const entry = registry.getEntry('test');
      
      expect(entry).toBeDefined();
      expect(entry?.strategy).toBe(strategy);
      expect(entry?.enabled).toBe(true);
      expect(entry?.registeredAt).toBeGreaterThan(0);
    });
  });
  
  describe('getStrategies', () => {
    it('should return strategies in priority order', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('low', 10));
      registry.register(createMockStrategy('high', 1));
      registry.register(createMockStrategy('mid', 5));
      
      const strategies = registry.getStrategies();
      
      expect(strategies[0].name).toBe('high');
      expect(strategies[1].name).toBe('mid');
      expect(strategies[2].name).toBe('low');
    });
    
    it('should only return enabled strategies by default', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('enabled', 1), true);
      registry.register(createMockStrategy('disabled', 2), false);
      
      const strategies = registry.getStrategies();
      
      expect(strategies.length).toBe(1);
      expect(strategies[0].name).toBe('enabled');
    });
    
    it('should return all strategies when specified', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('enabled', 1), true);
      registry.register(createMockStrategy('disabled', 2), false);
      
      const strategies = registry.getStrategies(false);
      
      expect(strategies.length).toBe(2);
    });
    
    it('should use cached result for subsequent calls', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      registry.register(createMockStrategy('test', 1));
      
      const first = registry.getStrategies();
      const second = registry.getStrategies();
      
      expect(first).toBe(second);
    });
  });
  
  describe('getNames', () => {
    it('should return strategy names in order', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('b', 2));
      registry.register(createMockStrategy('a', 1));
      
      const names = registry.getNames();
      
      expect(names).toEqual(['a', 'b']);
    });
  });
  
  describe('count', () => {
    it('should return total count', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1), true);
      registry.register(createMockStrategy('b', 2), false);
      
      expect(registry.count()).toBe(2);
    });
    
    it('should return enabled count when specified', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1), true);
      registry.register(createMockStrategy('b', 2), false);
      
      expect(registry.count(true)).toBe(1);
    });
  });
  
  // ==========================================================================
  // ENABLE/DISABLE TESTS
  // ==========================================================================
  
  describe('enable', () => {
    it('should enable a disabled strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('test', 1), false);
      registry.enable('test');
      
      expect(registry.isEnabled('test')).toBe(true);
    });
    
    it('should return false for non-existent strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      expect(registry.enable('nonexistent')).toBe(false);
    });
    
    it('should invalidate cache', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      registry.register(createMockStrategy('test', 1), false);
      
      const before = registry.getStrategies();
      registry.enable('test');
      const after = registry.getStrategies();
      
      expect(before).not.toBe(after);
    });
  });
  
  describe('disable', () => {
    it('should disable an enabled strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('test', 1), true);
      registry.disable('test');
      
      expect(registry.isEnabled('test')).toBe(false);
    });
  });
  
  describe('toggle', () => {
    it('should toggle enabled state', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('test', 1), true);
      
      expect(registry.toggle('test')).toBe(false);
      expect(registry.toggle('test')).toBe(true);
    });
    
    it('should return undefined for non-existent strategy', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      expect(registry.toggle('nonexistent')).toBeUndefined();
    });
  });
  
  describe('enableOnly', () => {
    it('should enable only specified strategies', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1));
      registry.register(createMockStrategy('b', 2));
      registry.register(createMockStrategy('c', 3));
      
      registry.enableOnly(['a', 'c']);
      
      expect(registry.isEnabled('a')).toBe(true);
      expect(registry.isEnabled('b')).toBe(false);
      expect(registry.isEnabled('c')).toBe(true);
    });
  });
  
  // ==========================================================================
  // PRIORITY TESTS
  // ==========================================================================
  
  describe('setPriority', () => {
    it('should set custom priority', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('test', 5));
      registry.setPriority('test', 100);
      
      expect(registry.getPriority('test')).toBe(100);
    });
    
    it('should affect ordering', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('high', 1));
      registry.register(createMockStrategy('low', 10));
      
      // Override to swap order
      registry.setPriority('high', 100);
      registry.setPriority('low', 1);
      
      const strategies = registry.getStrategies();
      
      expect(strategies[0].name).toBe('low');
      expect(strategies[1].name).toBe('high');
    });
  });
  
  describe('resetPriority', () => {
    it('should reset to default priority', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      const strategy = createMockStrategy('test', 5);
      
      registry.register(strategy);
      registry.setPriority('test', 100);
      registry.resetPriority('test');
      
      expect(registry.getPriority('test')).toBe(5);
    });
  });
  
  describe('reorder', () => {
    it('should reorder strategies', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1));
      registry.register(createMockStrategy('b', 2));
      registry.register(createMockStrategy('c', 3));
      
      registry.reorder(['c', 'a', 'b']);
      
      const names = registry.getNames();
      
      expect(names).toEqual(['c', 'a', 'b']);
    });
  });
  
  // ==========================================================================
  // FILTERING TESTS
  // ==========================================================================
  
  describe('filter', () => {
    it('should filter strategies by predicate', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('high', 1, 0.8));
      registry.register(createMockStrategy('low', 2, 0.3));
      
      const filtered = registry.filter(e => e.strategy.baseConfidence > 0.5);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('high');
    });
  });
  
  describe('getByMinConfidence', () => {
    it('should return strategies above threshold', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('high', 1, 0.8));
      registry.register(createMockStrategy('med', 2, 0.6));
      registry.register(createMockStrategy('low', 3, 0.3));
      
      const strategies = registry.getByMinConfidence(0.5);
      
      expect(strategies.length).toBe(2);
      expect(strategies.map(s => s.name)).toContain('high');
      expect(strategies.map(s => s.name)).toContain('med');
    });
  });
  
  describe('getHighConfidence', () => {
    it('should return strategies >= 70%', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('high', 1, 0.8));
      registry.register(createMockStrategy('med', 2, 0.6));
      
      const strategies = registry.getHighConfidence();
      
      expect(strategies.length).toBe(1);
      expect(strategies[0].name).toBe('high');
    });
  });
  
  describe('getFallback', () => {
    it('should return strategies < 50%', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('high', 1, 0.8));
      registry.register(createMockStrategy('low', 2, 0.3));
      
      const strategies = registry.getFallback();
      
      expect(strategies.length).toBe(1);
      expect(strategies[0].name).toBe('low');
    });
  });
  
  // ==========================================================================
  // ITERATION TESTS
  // ==========================================================================
  
  describe('Symbol.iterator', () => {
    it('should iterate over enabled strategies', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1));
      registry.register(createMockStrategy('b', 2));
      
      const names: string[] = [];
      for (const strategy of registry) {
        names.push(strategy.name);
      }
      
      expect(names).toEqual(['a', 'b']);
    });
  });
  
  describe('entries', () => {
    it('should iterate over entries', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1));
      registry.register(createMockStrategy('b', 2));
      
      const entries: RegistryEntry[] = [];
      for (const entry of registry.entries()) {
        entries.push(entry);
      }
      
      expect(entries.length).toBe(2);
      expect(entries[0].strategy.name).toBe('a');
    });
  });
  
  // ==========================================================================
  // SERIALIZATION TESTS
  // ==========================================================================
  
  describe('export', () => {
    it('should export registry state', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1), true);
      registry.register(createMockStrategy('b', 2), false);
      registry.setPriority('a', 100);
      
      const state = registry.export();
      
      expect(state.strategies.length).toBe(2);
      expect(state.strategies.find(s => s.name === 'a')?.enabled).toBe(true);
      expect(state.strategies.find(s => s.name === 'a')?.priorityOverride).toBe(100);
      expect(state.strategies.find(s => s.name === 'b')?.enabled).toBe(false);
    });
  });
  
  describe('import', () => {
    it('should import registry state', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1), true);
      registry.register(createMockStrategy('b', 2), true);
      
      registry.import({
        strategies: [
          { name: 'a', enabled: false, priorityOverride: 50 },
          { name: 'b', enabled: true, priorityOverride: null },
        ],
      });
      
      expect(registry.isEnabled('a')).toBe(false);
      expect(registry.getPriority('a')).toBe(50);
      expect(registry.isEnabled('b')).toBe(true);
    });
    
    it('should ignore non-existent strategies', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1));
      
      registry.import({
        strategies: [
          { name: 'nonexistent', enabled: true, priorityOverride: null },
        ],
      });
      
      expect(registry.has('nonexistent')).toBe(false);
    });
  });
  
  // ==========================================================================
  // DEBUG TESTS
  // ==========================================================================
  
  describe('debug', () => {
    it('should return debug summary', () => {
      const registry = createStrategyRegistry({ autoRegisterDefaults: false });
      
      registry.register(createMockStrategy('a', 1, 0.8), true);
      registry.register(createMockStrategy('b', 2, 0.5), false);
      
      const debug = registry.debug();
      
      expect(debug.total).toBe(2);
      expect(debug.enabled).toBe(1);
      expect(debug.disabled).toBe(1);
      expect(debug.order.length).toBe(2);
      expect(debug.order[0].name).toBe('a');
      expect(debug.order[0].confidence).toBe(0.8);
    });
  });
  
  // ==========================================================================
  // SINGLETON TESTS
  // ==========================================================================
  
  describe('getStrategyRegistry (singleton)', () => {
    it('should return same instance', () => {
      const instance1 = getStrategyRegistry();
      const instance2 = getStrategyRegistry();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should reset on resetStrategyRegistry', () => {
      const instance1 = getStrategyRegistry();
      resetStrategyRegistry();
      const instance2 = getStrategyRegistry();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});
