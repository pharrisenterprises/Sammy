/**
 * Tests for LabelDetectorRegistry
 * @module core/recording/labels/LabelDetectorRegistry.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LabelDetectorRegistry,
  createDefaultDetectors,
  getDefaultDetectorNames,
  createDetectorByName,
  getRegistry,
  getEnabledDetectors,
  registerDetector,
  unregisterDetector,
  type RegistryEvent,
  type RegistryEventListener,
} from './LabelDetectorRegistry';

import { BaseLabelDetector, type LabelDetectionContext, type LabelDetectionOptions, type LabelDetectionResult } from './ILabelDetector';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock detector for testing
 */
class MockDetector extends BaseLabelDetector {
  constructor(name: string, priority: number) {
    super(name, priority, 0.5, `Mock detector: ${name}`);
  }
  
  canDetect(context: LabelDetectionContext): boolean {
    return true;
  }
  
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    return null;
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('LabelDetectorRegistry', () => {
  beforeEach(() => {
    // Reset singleton for each test
    LabelDetectorRegistry.resetInstance();
  });
  
  afterEach(() => {
    LabelDetectorRegistry.resetInstance();
  });
  
  // ==========================================================================
  // CREATION
  // ==========================================================================
  
  describe('creation', () => {
    it('should create with default detectors', () => {
      const registry = LabelDetectorRegistry.createDefault();
      
      expect(registry.size).toBeGreaterThan(0);
      expect(registry.has('aria-label')).toBe(true);
      expect(registry.has('placeholder')).toBe(true);
    });
    
    it('should create empty registry', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      
      expect(registry.size).toBe(0);
    });
    
    it('should create with specific detectors', () => {
      const registry = LabelDetectorRegistry.createWith(['aria-label', 'placeholder']);
      
      expect(registry.size).toBe(2);
      expect(registry.has('aria-label')).toBe(true);
      expect(registry.has('placeholder')).toBe(true);
      expect(registry.has('bootstrap')).toBe(false);
    });
    
    it('should exclude specified defaults', () => {
      const registry = new LabelDetectorRegistry({
        loadDefaults: true,
        excludeDefaults: ['bootstrap', 'material-ui'],
      });
      
      expect(registry.has('aria-label')).toBe(true);
      expect(registry.has('bootstrap')).toBe(false);
      expect(registry.has('material-ui')).toBe(false);
    });
    
    it('should add custom detectors', () => {
      const custom = new MockDetector('custom', 15);
      const registry = new LabelDetectorRegistry({
        loadDefaults: false,
        customDetectors: [custom],
      });
      
      expect(registry.size).toBe(1);
      expect(registry.has('custom')).toBe(true);
    });
  });
  
  // ==========================================================================
  // SINGLETON
  // ==========================================================================
  
  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = LabelDetectorRegistry.getInstance();
      const instance2 = LabelDetectorRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should reset instance', () => {
      const instance1 = LabelDetectorRegistry.getInstance();
      LabelDetectorRegistry.resetInstance();
      const instance2 = LabelDetectorRegistry.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
    
    it('should set custom instance', () => {
      const custom = LabelDetectorRegistry.createEmpty();
      LabelDetectorRegistry.setInstance(custom);
      
      expect(LabelDetectorRegistry.getInstance()).toBe(custom);
    });
  });
  
  // ==========================================================================
  // REGISTRATION
  // ==========================================================================
  
  describe('registration', () => {
    it('should register a detector', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector = new MockDetector('test', 50);
      
      registry.register(detector);
      
      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(detector);
    });
    
    it('should throw on duplicate registration', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector1 = new MockDetector('test', 50);
      const detector2 = new MockDetector('test', 60);
      
      registry.register(detector1);
      
      expect(() => registry.register(detector2)).toThrow();
    });
    
    it('should allow replacement with option', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector1 = new MockDetector('test', 50);
      const detector2 = new MockDetector('test', 60);
      
      registry.register(detector1);
      registry.register(detector2, { replace: true });
      
      expect(registry.get('test')).toBe(detector2);
    });
    
    it('should register disabled', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector = new MockDetector('test', 50);
      
      registry.register(detector, { enabled: false });
      
      expect(registry.has('test')).toBe(true);
      expect(registry.isEnabled('test')).toBe(false);
    });
    
    it('should set priority override', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector = new MockDetector('test', 50);
      
      registry.register(detector, { priorityOverride: 5 });
      
      expect(registry.getPriority('test')).toBe(5);
    });
  });
  
  // ==========================================================================
  // UNREGISTRATION
  // ==========================================================================
  
  describe('unregistration', () => {
    it('should unregister a detector', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector = new MockDetector('test', 50);
      
      registry.register(detector);
      const result = registry.unregister('test');
      
      expect(result).toBe(true);
      expect(registry.has('test')).toBe(false);
    });
    
    it('should return false for non-existent', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      
      expect(registry.unregister('nonexistent')).toBe(false);
    });
    
    it('should clean up enabled set', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const detector = new MockDetector('test', 50);
      
      registry.register(detector);
      registry.unregister('test');
      
      expect(registry.isEnabled('test')).toBe(false);
    });
  });
  
  // ==========================================================================
  // RETRIEVAL
  // ==========================================================================
  
  describe('retrieval', () => {
    it('should get detector by name', () => {
      const registry = LabelDetectorRegistry.createDefault();
      
      const detector = registry.get('aria-label');
      
      expect(detector).toBeDefined();
      expect(detector?.name).toBe('aria-label');
    });
    
    it('should return undefined for non-existent', () => {
      const registry = LabelDetectorRegistry.createDefault();
      
      expect(registry.get('nonexistent')).toBeUndefined();
    });
    
    it('should get all detectors sorted by priority', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('low', 100));
      registry.register(new MockDetector('high', 10));
      registry.register(new MockDetector('mid', 50));
      
      const all = registry.getAll();
      
      expect(all[0].name).toBe('high');
      expect(all[1].name).toBe('mid');
      expect(all[2].name).toBe('low');
    });
    
    it('should get only enabled detectors', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('enabled1', 10));
      registry.register(new MockDetector('disabled', 20), { enabled: false });
      registry.register(new MockDetector('enabled2', 30));
      
      const enabled = registry.getEnabled();
      
      expect(enabled.length).toBe(2);
      expect(enabled.map(d => d.name)).toContain('enabled1');
      expect(enabled.map(d => d.name)).toContain('enabled2');
      expect(enabled.map(d => d.name)).not.toContain('disabled');
    });
    
    it('should get disabled detectors', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('enabled', 10));
      registry.register(new MockDetector('disabled', 20), { enabled: false });
      
      const disabled = registry.getDisabled();
      
      expect(disabled.length).toBe(1);
      expect(disabled[0].name).toBe('disabled');
    });
    
    it('should get detector names', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      
      const names = registry.getNames();
      
      expect(names).toContain('a');
      expect(names).toContain('b');
    });
  });
  
  // ==========================================================================
  // ENABLE/DISABLE
  // ==========================================================================
  
  describe('enable/disable', () => {
    it('should enable a detector', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50), { enabled: false });
      
      const result = registry.enable('test');
      
      expect(result).toBe(true);
      expect(registry.isEnabled('test')).toBe(true);
    });
    
    it('should disable a detector', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50));
      
      const result = registry.disable('test');
      
      expect(result).toBe(true);
      expect(registry.isEnabled('test')).toBe(false);
    });
    
    it('should return false for non-existent enable', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      
      expect(registry.enable('nonexistent')).toBe(false);
    });
    
    it('should enable all', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10), { enabled: false });
      registry.register(new MockDetector('b', 20), { enabled: false });
      
      registry.enableAll();
      
      expect(registry.isEnabled('a')).toBe(true);
      expect(registry.isEnabled('b')).toBe(true);
    });
    
    it('should disable all', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      
      registry.disableAll();
      
      expect(registry.isEnabled('a')).toBe(false);
      expect(registry.isEnabled('b')).toBe(false);
    });
    
    it('should enable only specified', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      registry.register(new MockDetector('c', 30));
      
      registry.enableOnly(['a', 'c']);
      
      expect(registry.isEnabled('a')).toBe(true);
      expect(registry.isEnabled('b')).toBe(false);
      expect(registry.isEnabled('c')).toBe(true);
    });
  });
  
  // ==========================================================================
  // PRIORITY
  // ==========================================================================
  
  describe('priority', () => {
    it('should get default priority', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 42));
      
      expect(registry.getPriority('test')).toBe(42);
    });
    
    it('should set priority override', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50));
      
      registry.setPriority('test', 5);
      
      expect(registry.getPriority('test')).toBe(5);
    });
    
    it('should reset priority', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50));
      registry.setPriority('test', 5);
      
      registry.resetPriority('test');
      
      expect(registry.getPriority('test')).toBe(50);
    });
    
    it('should reset all priorities', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      registry.setPriority('a', 100);
      registry.setPriority('b', 100);
      
      registry.resetAllPriorities();
      
      expect(registry.getPriority('a')).toBe(10);
      expect(registry.getPriority('b')).toBe(20);
    });
    
    it('should sort by overridden priority', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('high', 10));
      registry.register(new MockDetector('low', 100));
      
      // Override to swap order
      registry.setPriority('high', 200);
      registry.setPriority('low', 5);
      
      const sorted = registry.getAll();
      
      expect(sorted[0].name).toBe('low');
      expect(sorted[1].name).toBe('high');
    });
  });
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  describe('events', () => {
    it('should emit registered event', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const listener = vi.fn();
      
      registry.addEventListener(listener);
      registry.register(new MockDetector('test', 50));
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'registered',
          detectorName: 'test',
        })
      );
    });
    
    it('should emit unregistered event', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50));
      
      const listener = vi.fn();
      registry.addEventListener(listener);
      registry.unregister('test');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unregistered',
          detectorName: 'test',
        })
      );
    });
    
    it('should emit enabled event', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50), { enabled: false });
      
      const listener = vi.fn();
      registry.addEventListener(listener);
      registry.enable('test');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'enabled',
          detectorName: 'test',
        })
      );
    });
    
    it('should emit disabled event', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('test', 50));
      
      const listener = vi.fn();
      registry.addEventListener(listener);
      registry.disable('test');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disabled',
          detectorName: 'test',
        })
      );
    });
    
    it('should remove event listener', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const listener = vi.fn();
      
      registry.addEventListener(listener);
      registry.removeEventListener(listener);
      registry.register(new MockDetector('test', 50));
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should handle listener errors gracefully', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      const errorListener = vi.fn(() => { throw new Error('Test error'); });
      const normalListener = vi.fn();
      
      registry.addEventListener(errorListener);
      registry.addEventListener(normalListener);
      
      // Should not throw
      registry.register(new MockDetector('test', 50));
      
      expect(normalListener).toHaveBeenCalled();
    });
  });
  
  // ==========================================================================
  // STATISTICS
  // ==========================================================================
  
  describe('statistics', () => {
    it('should get registry stats', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      registry.register(new MockDetector('c', 30), { enabled: false });
      
      const stats = registry.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.byPriority).toEqual(['a', 'b', 'c']);
    });
    
    it('should get size', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      
      expect(registry.size).toBe(2);
    });
  });
  
  // ==========================================================================
  // CLEAR/RESET
  // ==========================================================================
  
  describe('clear/reset', () => {
    it('should clear all detectors', () => {
      const registry = LabelDetectorRegistry.createDefault();
      
      registry.clear();
      
      expect(registry.size).toBe(0);
    });
    
    it('should reset to defaults', () => {
      const registry = LabelDetectorRegistry.createDefault();
      registry.clear();
      
      registry.reset();
      
      expect(registry.size).toBeGreaterThan(0);
      expect(registry.has('aria-label')).toBe(true);
    });
    
    it('should emit cleared event', () => {
      const registry = LabelDetectorRegistry.createDefault();
      const listener = vi.fn();
      
      registry.addEventListener(listener);
      registry.clear();
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cleared' })
      );
    });
  });
  
  // ==========================================================================
  // ITERATION
  // ==========================================================================
  
  describe('iteration', () => {
    it('should be iterable', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 20));
      registry.register(new MockDetector('b', 10));
      
      const names: string[] = [];
      for (const detector of registry) {
        names.push(detector.name);
      }
      
      expect(names).toEqual(['b', 'a']); // Sorted by priority
    });
    
    it('should iterate enabled only', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('enabled', 10));
      registry.register(new MockDetector('disabled', 20), { enabled: false });
      
      const names: string[] = [];
      for (const detector of registry.enabledIterator()) {
        names.push(detector.name);
      }
      
      expect(names).toEqual(['enabled']);
    });
    
    it('should forEach over enabled', () => {
      const registry = LabelDetectorRegistry.createEmpty();
      registry.register(new MockDetector('a', 10));
      registry.register(new MockDetector('b', 20));
      
      const names: string[] = [];
      registry.forEachEnabled((detector) => {
        names.push(detector.name);
      });
      
      expect(names).toEqual(['a', 'b']);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createDefaultDetectors', () => {
  it('should create all default detectors', () => {
    const detectors = createDefaultDetectors();
    
    expect(detectors.length).toBe(8);
    expect(detectors.map(d => d.name)).toContain('google-forms');
    expect(detectors.map(d => d.name)).toContain('aria-label');
    expect(detectors.map(d => d.name)).toContain('placeholder');
  });
});

describe('getDefaultDetectorNames', () => {
  it('should return all default names', () => {
    const names = getDefaultDetectorNames();
    
    expect(names).toContain('google-forms');
    expect(names).toContain('aria-label');
    expect(names).toContain('associated-label');
    expect(names).toContain('placeholder');
    expect(names).toContain('bootstrap');
    expect(names).toContain('material-ui');
    expect(names).toContain('sibling');
    expect(names).toContain('text-content');
  });
});

describe('createDetectorByName', () => {
  it('should create detector by name', () => {
    const detector = createDetectorByName('aria-label');
    
    expect(detector).not.toBeNull();
    expect(detector?.name).toBe('aria-label');
  });
  
  it('should return null for unknown name', () => {
    const detector = createDetectorByName('unknown');
    
    expect(detector).toBeNull();
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    LabelDetectorRegistry.resetInstance();
  });
  
  afterEach(() => {
    LabelDetectorRegistry.resetInstance();
  });
  
  it('getRegistry should return singleton', () => {
    const registry = getRegistry();
    
    expect(registry).toBe(LabelDetectorRegistry.getInstance());
  });
  
  it('getEnabledDetectors should return enabled from singleton', () => {
    const detectors = getEnabledDetectors();
    
    expect(detectors.length).toBeGreaterThan(0);
  });
  
  it('registerDetector should add to singleton', () => {
    const detector = new MockDetector('custom', 5);
    
    registerDetector(detector);
    
    expect(getRegistry().has('custom')).toBe(true);
  });
  
  it('unregisterDetector should remove from singleton', () => {
    const detector = new MockDetector('custom', 5);
    registerDetector(detector);
    
    const result = unregisterDetector('custom');
    
    expect(result).toBe(true);
    expect(getRegistry().has('custom')).toBe(false);
  });
});
