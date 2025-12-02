/**
 * Tests for LabelResolver
 * @module core/recording/labels/LabelResolver.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LabelResolver,
  createLabelResolver,
  createResolverWithRegistry,
  createFastResolver,
  createAccurateResolver,
  getResolver,
  resetResolver,
  resolveLabel,
  getLabelForElement,
  getAllLabelCandidates,
  elementHasLabel,
  sortByConfidence,
  sortByPriority,
  sortByWeightedScore,
  filterByConfidence,
  getUniqueLabels,
  findCandidateByDetector,
  DEFAULT_RESOLVER_CONFIG,
  type LabelCandidate,
  type ResolvedLabel,
  type ResolutionStrategy,
} from './LabelResolver';

import {
  LabelDetectorRegistry,
} from './LabelDetectorRegistry';

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  createDetectionContext,
} from './ILabelDetector';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Mock detector for testing
 */
class MockDetector extends BaseLabelDetector {
  private shouldDetect: boolean;
  private mockLabel: string;
  private mockConfidence: number;
  
  constructor(
    name: string,
    priority: number,
    shouldDetect: boolean = true,
    label: string = 'Mock Label',
    confidence: number = 0.75
  ) {
    super(name, priority, confidence, `Mock: ${name}`);
    this.shouldDetect = shouldDetect;
    this.mockLabel = label;
    this.mockConfidence = confidence;
  }
  
  canDetect(context: LabelDetectionContext): boolean {
    return this.shouldDetect;
  }
  
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    if (!this.shouldDetect) {
      return null;
    }
    
    return this.createResult(this.mockLabel, context.element, 'mock', {
      confidence: this.mockConfidence,
    });
  }
}

/**
 * Create a test registry with mock detectors
 */
function createTestRegistry(): LabelDetectorRegistry {
  const registry = LabelDetectorRegistry.createEmpty();
  
  registry.register(new MockDetector('high-priority', 10, true, 'High Priority Label', 0.70));
  registry.register(new MockDetector('medium-priority', 50, true, 'Medium Priority Label', 0.85));
  registry.register(new MockDetector('low-priority', 80, true, 'Low Priority Label', 0.60));
  
  return registry;
}

/**
 * Create a test element
 */
function createTestElement(): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'test-input';
  document.body.appendChild(input);
  return input;
}

// ============================================================================
// TESTS
// ============================================================================

describe('LabelResolver', () => {
  let registry: LabelDetectorRegistry;
  let resolver: LabelResolver;
  let testElement: HTMLElement;
  
  beforeEach(() => {
    registry = createTestRegistry();
    resolver = new LabelResolver(registry);
    testElement = createTestElement();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    LabelDetectorRegistry.resetInstance();
    resetResolver();
  });
  
  // ==========================================================================
  // BASIC RESOLUTION
  // ==========================================================================
  
  describe('basic resolution', () => {
    it('should resolve label from element', () => {
      const result = resolver.resolve(testElement);
      
      expect(result.success).toBe(true);
      expect(result.label).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
    
    it('should return candidates from multiple detectors', () => {
      const result = resolver.resolve(testElement);
      
      expect(result.candidates.length).toBeGreaterThan(0);
    });
    
    it('should track resolution duration', () => {
      const result = resolver.resolve(testElement);
      
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
    
    it('should return fallback when no detection succeeds', () => {
      // Create registry with only failing detectors
      const failRegistry = LabelDetectorRegistry.createEmpty();
      failRegistry.register(new MockDetector('fail', 10, false));
      
      const failResolver = new LabelResolver(failRegistry);
      const result = failResolver.resolve(testElement);
      
      expect(result.success).toBe(false);
      expect(result.label).toBe(DEFAULT_RESOLVER_CONFIG.fallbackLabel);
      expect(result.confidence).toBe(0);
    });
  });
  
  // ==========================================================================
  // RESOLUTION STRATEGIES
  // ==========================================================================
  
  describe('first-match strategy', () => {
    it('should return first successful detection', () => {
      const result = resolver.resolveWithStrategy(testElement, 'first-match');
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('first-match');
      // First match should be from highest priority detector
      expect(result.detectorName).toBe('high-priority');
    });
    
    it('should stop after first match', () => {
      const result = resolver.resolveWithStrategy(testElement, 'first-match');
      
      // Only one candidate should be collected
      expect(result.candidates.length).toBe(1);
    });
  });
  
  describe('best-confidence strategy', () => {
    it('should return highest confidence result', () => {
      const result = resolver.resolveWithStrategy(testElement, 'best-confidence');
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('best-confidence');
      // Medium priority has highest confidence (0.85)
      expect(result.detectorName).toBe('medium-priority');
      expect(result.confidence).toBe(0.85);
    });
    
    it('should collect all candidates', () => {
      const result = resolver.resolveWithStrategy(testElement, 'best-confidence');
      
      expect(result.candidates.length).toBe(3);
    });
  });
  
  describe('priority-weighted strategy', () => {
    it('should balance confidence and priority', () => {
      const result = resolver.resolveWithStrategy(testElement, 'priority-weighted');
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('priority-weighted');
    });
    
    it('should calculate weighted scores', () => {
      const result = resolver.resolveWithStrategy(testElement, 'priority-weighted');
      
      for (const candidate of result.candidates) {
        expect(candidate.weightedScore).toBeDefined();
        expect(candidate.weightedScore).toBeGreaterThanOrEqual(candidate.confidence);
      }
    });
  });
  
  // ==========================================================================
  // MINIMUM CONFIDENCE
  // ==========================================================================
  
  describe('minimum confidence threshold', () => {
    it('should filter results below threshold', () => {
      // Create detector with low confidence
      const lowRegistry = LabelDetectorRegistry.createEmpty();
      lowRegistry.register(new MockDetector('low', 10, true, 'Low Conf', 0.20));
      
      const lowResolver = new LabelResolver(lowRegistry, {
        minConfidence: 0.50,
      });
      
      const result = lowResolver.resolve(testElement);
      
      expect(result.success).toBe(false);
    });
    
    it('should accept results above threshold', () => {
      const result = resolver.resolve(testElement, { minConfidence: 0.50 });
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.50);
    });
    
    it('should use config threshold by default', () => {
      resolver.setMinConfidence(0.90);
      const result = resolver.resolve(testElement);
      
      // Only medium-priority has 0.85, so should fail at 0.90 threshold
      expect(result.success).toBe(false);
    });
  });
  
  // ==========================================================================
  // RESOLVE ALL
  // ==========================================================================
  
  describe('resolveAll', () => {
    it('should return all candidates', () => {
      const candidates = resolver.resolveAll(testElement);
      
      expect(candidates.length).toBe(3);
    });
    
    it('should include all candidate properties', () => {
      const candidates = resolver.resolveAll(testElement);
      
      for (const candidate of candidates) {
        expect(candidate.label).toBeDefined();
        expect(candidate.confidence).toBeDefined();
        expect(candidate.detectorName).toBeDefined();
        expect(candidate.detectorPriority).toBeDefined();
        expect(candidate.result).toBeDefined();
      }
    });
  });
  
  // ==========================================================================
  // QUICK METHODS
  // ==========================================================================
  
  describe('quick methods', () => {
    it('resolveLabel should return just the label', () => {
      const label = resolver.resolveLabel(testElement);
      
      expect(typeof label).toBe('string');
    });
    
    it('hasLabel should return true for detectable elements', () => {
      expect(resolver.hasLabel(testElement)).toBe(true);
    });
    
    it('hasLabel should return false below confidence', () => {
      expect(resolver.hasLabel(testElement, 0.99)).toBe(false);
    });
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should update config', () => {
      resolver.setConfig({ minConfidence: 0.80 });
      
      const config = resolver.getConfig();
      expect(config.minConfidence).toBe(0.80);
    });
    
    it('should set strategy', () => {
      resolver.setStrategy('first-match');
      
      const config = resolver.getConfig();
      expect(config.strategy).toBe('first-match');
    });
    
    it('should clamp minConfidence to valid range', () => {
      resolver.setMinConfidence(1.5);
      expect(resolver.getConfig().minConfidence).toBe(1);
      
      resolver.setMinConfidence(-0.5);
      expect(resolver.getConfig().minConfidence).toBe(0);
    });
    
    it('should get and set registry', () => {
      const newRegistry = LabelDetectorRegistry.createEmpty();
      resolver.setRegistry(newRegistry);
      
      expect(resolver.getRegistry()).toBe(newRegistry);
    });
  });
  
  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================
  
  describe('error handling', () => {
    it('should handle detector errors gracefully', () => {
      // Create detector that throws
      class ThrowingDetector extends BaseLabelDetector {
        constructor() {
          super('throwing', 10, 0.5, 'Throws errors');
        }
        
        canDetect(): boolean {
          return true;
        }
        
        protected doDetect(): LabelDetectionResult | null {
          throw new Error('Test error');
        }
      }
      
      const errorRegistry = LabelDetectorRegistry.createEmpty();
      errorRegistry.register(new ThrowingDetector());
      errorRegistry.register(new MockDetector('good', 20, true, 'Good Label', 0.80));
      
      const errorResolver = new LabelResolver(errorRegistry);
      
      // Should not throw, should use good detector
      const result = errorResolver.resolve(testElement);
      
      expect(result.success).toBe(true);
      expect(result.label).toBe('Good Label');
    });
  });
  
  // ==========================================================================
  // DETECTOR FILTERING
  // ==========================================================================
  
  describe('detector filtering', () => {
    it('should skip detectors that cannot detect', () => {
      const mixedRegistry = LabelDetectorRegistry.createEmpty();
      mixedRegistry.register(new MockDetector('cannot', 10, false, 'Cannot', 0.90));
      mixedRegistry.register(new MockDetector('can', 20, true, 'Can Detect', 0.80));
      
      const mixedResolver = new LabelResolver(mixedRegistry);
      const result = mixedResolver.resolve(testElement);
      
      expect(result.label).toBe('Can Detect');
    });
    
    it('should respect maxDetectors limit', () => {
      const result = resolver.resolve(testElement, { maxDetectors: 1 });
      
      // With best-confidence, still collects from limited detectors
      expect(result.candidates.length).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  let testElement: HTMLElement;
  
  beforeEach(() => {
    testElement = document.createElement('input');
    document.body.appendChild(testElement);
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    LabelDetectorRegistry.resetInstance();
    resetResolver();
  });
  
  it('createLabelResolver should create default resolver', () => {
    const resolver = createLabelResolver();
    
    expect(resolver).toBeInstanceOf(LabelResolver);
  });
  
  it('createResolverWithRegistry should use provided registry', () => {
    const registry = LabelDetectorRegistry.createEmpty();
    const resolver = createResolverWithRegistry(registry);
    
    expect(resolver.getRegistry()).toBe(registry);
  });
  
  it('createFastResolver should use first-match strategy', () => {
    const resolver = createFastResolver();
    
    expect(resolver.getConfig().strategy).toBe('first-match');
  });
  
  it('createAccurateResolver should use best-confidence with low threshold', () => {
    const resolver = createAccurateResolver();
    
    expect(resolver.getConfig().strategy).toBe('best-confidence');
    expect(resolver.getConfig().minConfidence).toBe(0.20);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton functions', () => {
  let testElement: HTMLElement;
  
  beforeEach(() => {
    testElement = document.createElement('input');
    document.body.appendChild(testElement);
    resetResolver();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    LabelDetectorRegistry.resetInstance();
    resetResolver();
  });
  
  it('getResolver should return singleton', () => {
    const resolver1 = getResolver();
    const resolver2 = getResolver();
    
    expect(resolver1).toBe(resolver2);
  });
  
  it('resetResolver should clear singleton', () => {
    const resolver1 = getResolver();
    resetResolver();
    const resolver2 = getResolver();
    
    expect(resolver1).not.toBe(resolver2);
  });
  
  it('resolveLabel should use singleton', () => {
    const result = resolveLabel(testElement);
    
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });
  
  it('getLabelForElement should return string', () => {
    const label = getLabelForElement(testElement);
    
    expect(typeof label).toBe('string');
  });
  
  it('getAllLabelCandidates should return array', () => {
    const candidates = getAllLabelCandidates(testElement);
    
    expect(Array.isArray(candidates)).toBe(true);
  });
  
  it('elementHasLabel should return boolean', () => {
    const hasLabel = elementHasLabel(testElement);
    
    expect(typeof hasLabel).toBe('boolean');
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  const mockCandidates: LabelCandidate[] = [
    {
      label: 'Label A',
      confidence: 0.70,
      detectorName: 'detector-a',
      detectorPriority: 50,
      weightedScore: 0.73,
      result: {} as LabelDetectionResult,
    },
    {
      label: 'Label B',
      confidence: 0.85,
      detectorName: 'detector-b',
      detectorPriority: 20,
      weightedScore: 0.92,
      result: {} as LabelDetectionResult,
    },
    {
      label: 'Label A', // Duplicate label
      confidence: 0.60,
      detectorName: 'detector-c',
      detectorPriority: 80,
      weightedScore: 0.62,
      result: {} as LabelDetectionResult,
    },
  ];
  
  describe('sortByConfidence', () => {
    it('should sort by confidence descending', () => {
      const sorted = sortByConfidence(mockCandidates);
      
      expect(sorted[0].confidence).toBe(0.85);
      expect(sorted[1].confidence).toBe(0.70);
      expect(sorted[2].confidence).toBe(0.60);
    });
    
    it('should not mutate original array', () => {
      const original = [...mockCandidates];
      sortByConfidence(mockCandidates);
      
      expect(mockCandidates).toEqual(original);
    });
  });
  
  describe('sortByPriority', () => {
    it('should sort by priority ascending', () => {
      const sorted = sortByPriority(mockCandidates);
      
      expect(sorted[0].detectorPriority).toBe(20);
      expect(sorted[1].detectorPriority).toBe(50);
      expect(sorted[2].detectorPriority).toBe(80);
    });
  });
  
  describe('sortByWeightedScore', () => {
    it('should sort by weighted score descending', () => {
      const sorted = sortByWeightedScore(mockCandidates);
      
      expect(sorted[0].weightedScore).toBe(0.92);
      expect(sorted[1].weightedScore).toBe(0.73);
      expect(sorted[2].weightedScore).toBe(0.62);
    });
  });
  
  describe('filterByConfidence', () => {
    it('should filter below threshold', () => {
      const filtered = filterByConfidence(mockCandidates, 0.65);
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(c => c.confidence >= 0.65)).toBe(true);
    });
  });
  
  describe('getUniqueLabels', () => {
    it('should return unique labels', () => {
      const labels = getUniqueLabels(mockCandidates);
      
      expect(labels.length).toBe(2);
      expect(labels).toContain('Label A');
      expect(labels).toContain('Label B');
    });
  });
  
  describe('findCandidateByDetector', () => {
    it('should find by detector name', () => {
      const found = findCandidateByDetector(mockCandidates, 'detector-b');
      
      expect(found).toBeDefined();
      expect(found?.detectorName).toBe('detector-b');
    });
    
    it('should return undefined for unknown detector', () => {
      const found = findCandidateByDetector(mockCandidates, 'unknown');
      
      expect(found).toBeUndefined();
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_RESOLVER_CONFIG', () => {
  it('should have expected defaults', () => {
    expect(DEFAULT_RESOLVER_CONFIG.strategy).toBe('best-confidence');
    expect(DEFAULT_RESOLVER_CONFIG.minConfidence).toBe(0.30);
    expect(DEFAULT_RESOLVER_CONFIG.fallbackLabel).toBe('Unlabeled');
    expect(DEFAULT_RESOLVER_CONFIG.priorityWeight).toBe(0.1);
  });
});
