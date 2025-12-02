/**
 * LabelResolver - Resolve Best Label from Multiple Detectors
 * @module core/recording/labels/LabelResolver
 * @version 1.0.0
 * 
 * Orchestrates multiple label detectors to find the best label for an element.
 * Supports multiple resolution strategies and provides detailed metadata.
 * 
 * ## Resolution Strategies
 * - `first-match`: Return first successful detection (fastest)
 * - `best-confidence`: Run all detectors, return highest confidence
 * - `priority-weighted`: Balance confidence with detector priority
 * 
 * ## Default Behavior
 * - Uses `best-confidence` strategy
 * - Minimum confidence threshold: 0.30
 * - Returns "Unlabeled" with confidence 0 if all detectors fail
 * 
 * @see LabelDetectorRegistry for detector management
 * @see ILabelDetector for detector interface
 */

import {
  type ILabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

import {
  LabelDetectorRegistry,
  getRegistry,
} from './LabelDetectorRegistry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Resolution strategy types
 */
export type ResolutionStrategy = 
  | 'first-match'
  | 'best-confidence'
  | 'priority-weighted';

/**
 * Label candidate from a detector
 */
export interface LabelCandidate {
  /** The detected label text */
  label: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Detector that produced this result */
  detectorName: string;
  
  /** Detector priority */
  detectorPriority: number;
  
  /** Full detection result */
  result: LabelDetectionResult;
  
  /** Weighted score (for priority-weighted strategy) */
  weightedScore?: number;
}

/**
 * Resolved label result
 */
export interface ResolvedLabel {
  /** The selected label text */
  label: string;
  
  /** Confidence score of selected label */
  confidence: number;
  
  /** Name of detector that produced the label */
  detectorName: string;
  
  /** Resolution strategy used */
  strategy: ResolutionStrategy;
  
  /** Whether resolution was successful */
  success: boolean;
  
  /** All candidates considered */
  candidates: LabelCandidate[];
  
  /** Number of detectors that ran */
  detectorsRun: number;
  
  /** Number of detectors that produced results */
  detectorsSucceeded: number;
  
  /** Resolution duration in milliseconds */
  duration: number;
  
  /** Full detection result (if successful) */
  result?: LabelDetectionResult;
}

/**
 * Resolver configuration
 */
export interface ResolverConfig {
  /** Resolution strategy (default: 'best-confidence') */
  strategy?: ResolutionStrategy;
  
  /** Minimum confidence threshold (default: 0.30) */
  minConfidence?: number;
  
  /** Maximum detectors to run (default: all) */
  maxDetectors?: number;
  
  /** Stop on first match (for first-match strategy) */
  stopOnFirstMatch?: boolean;
  
  /** Label detection options passed to detectors */
  detectionOptions?: Partial<LabelDetectionOptions>;
  
  /** Priority weight factor for priority-weighted strategy (default: 0.1) */
  priorityWeight?: number;
  
  /** Fallback label when no detection succeeds */
  fallbackLabel?: string;
}

/**
 * Default resolver configuration
 */
export const DEFAULT_RESOLVER_CONFIG: Required<ResolverConfig> = {
  strategy: 'best-confidence',
  minConfidence: 0.30,
  maxDetectors: Infinity,
  stopOnFirstMatch: false,
  detectionOptions: {},
  priorityWeight: 0.1,
  fallbackLabel: 'Unlabeled',
};

// ============================================================================
// LABEL RESOLVER CLASS
// ============================================================================

/**
 * Resolves the best label for an element using multiple detectors
 * 
 * @example
 * ```typescript
 * // Basic usage with default registry
 * const resolver = new LabelResolver();
 * const result = resolver.resolve(inputElement);
 * console.log(result.label); // "Email Address"
 * console.log(result.confidence); // 0.85
 * 
 * // With custom configuration
 * const resolver = new LabelResolver(registry, {
 *   strategy: 'first-match',
 *   minConfidence: 0.5,
 * });
 * ```
 */
export class LabelResolver {
  private registry: LabelDetectorRegistry;
  private config: Required<ResolverConfig>;
  
  /**
   * Create a new LabelResolver
   */
  constructor(
    registry?: LabelDetectorRegistry,
    config: ResolverConfig = {}
  ) {
    this.registry = registry || getRegistry();
    this.config = { ...DEFAULT_RESOLVER_CONFIG, ...config };
  }
  
  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  
  /**
   * Resolve the best label for an element
   */
  resolve(element: Element, options?: Partial<ResolverConfig>): ResolvedLabel {
    const config = options ? { ...this.config, ...options } : this.config;
    return this.resolveWithStrategy(element, config.strategy, config);
  }
  
  /**
   * Resolve using a specific strategy
   */
  resolveWithStrategy(
    element: Element,
    strategy: ResolutionStrategy,
    config?: ResolverConfig
  ): ResolvedLabel {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;
    const startTime = performance.now();
    
    // Create detection context
    const context = createDetectionContext(element);
    const detectionOptions: LabelDetectionOptions = {
      ...DEFAULT_DETECTION_OPTIONS,
      ...effectiveConfig.detectionOptions,
    };
    
    // Get candidates based on strategy
    let candidates: LabelCandidate[];
    
    if (strategy === 'first-match') {
      candidates = this.collectFirstMatch(context, detectionOptions, effectiveConfig);
    } else {
      candidates = this.collectAllCandidates(context, detectionOptions, effectiveConfig);
    }
    
    // Select best candidate
    const selected = this.selectBestCandidate(candidates, strategy, effectiveConfig);
    
    const duration = performance.now() - startTime;
    
    // Build result
    if (selected && selected.confidence >= effectiveConfig.minConfidence) {
      return {
        label: selected.label,
        confidence: selected.confidence,
        detectorName: selected.detectorName,
        strategy,
        success: true,
        candidates,
        detectorsRun: this.countDetectorsRun(candidates),
        detectorsSucceeded: candidates.length,
        duration,
        result: selected.result,
      };
    }
    
    // No valid label found
    return {
      label: effectiveConfig.fallbackLabel,
      confidence: 0,
      detectorName: 'none',
      strategy,
      success: false,
      candidates,
      detectorsRun: this.countDetectorsRun(candidates),
      detectorsSucceeded: candidates.length,
      duration,
    };
  }
  
  /**
   * Get all label candidates for an element
   */
  resolveAll(element: Element, options?: Partial<LabelDetectionOptions>): LabelCandidate[] {
    const context = createDetectionContext(element);
    const detectionOptions: LabelDetectionOptions = {
      ...DEFAULT_DETECTION_OPTIONS,
      ...options,
    };
    
    return this.collectAllCandidates(context, detectionOptions, this.config);
  }
  
  /**
   * Quick resolve - returns just the label string
   */
  resolveLabel(element: Element): string {
    const result = this.resolve(element);
    return result.label;
  }
  
  /**
   * Check if element has a detectable label
   */
  hasLabel(element: Element, minConfidence?: number): boolean {
    const result = this.resolve(element);
    const threshold = minConfidence ?? this.config.minConfidence;
    return result.success && result.confidence >= threshold;
  }
  
  // ==========================================================================
  // CANDIDATE COLLECTION
  // ==========================================================================
  
  /**
   * Collect first matching candidate (for first-match strategy)
   */
  private collectFirstMatch(
    context: LabelDetectionContext,
    options: LabelDetectionOptions,
    config: Required<ResolverConfig>
  ): LabelCandidate[] {
    const detectors = this.registry.getEnabled();
    const candidates: LabelCandidate[] = [];
    let count = 0;
    
    for (const detector of detectors) {
      if (count >= config.maxDetectors) break;
      count++;
      
      try {
        // Check if detector can handle this element
        if (!detector.canDetect(context)) {
          continue;
        }
        
        // Try to detect
        const result = detector.detect(context, options);
        
        if (result && result.confidence >= config.minConfidence) {
          candidates.push(this.createCandidate(detector, result));
          break; // Stop on first match
        }
      } catch (error) {
        console.warn(`Detector "${detector.name}" threw error:`, error);
      }
    }
    
    return candidates;
  }
  
  /**
   * Collect all candidates from all detectors
   */
  private collectAllCandidates(
    context: LabelDetectionContext,
    options: LabelDetectionOptions,
    config: Required<ResolverConfig>
  ): LabelCandidate[] {
    const detectors = this.registry.getEnabled();
    const candidates: LabelCandidate[] = [];
    let count = 0;
    
    for (const detector of detectors) {
      if (count >= config.maxDetectors) break;
      count++;
      
      try {
        // Check if detector can handle this element
        if (!detector.canDetect(context)) {
          continue;
        }
        
        // Try to detect
        const result = detector.detect(context, options);
        
        if (result) {
          const candidate = this.createCandidate(detector, result);
          
          // Calculate weighted score for priority-weighted strategy
          candidate.weightedScore = this.calculateWeightedScore(
            candidate,
            config.priorityWeight
          );
          
          candidates.push(candidate);
        }
      } catch (error) {
        console.warn(`Detector "${detector.name}" threw error:`, error);
      }
    }
    
    return candidates;
  }
  
  /**
   * Create a candidate from detector result
   */
  private createCandidate(
    detector: ILabelDetector,
    result: LabelDetectionResult
  ): LabelCandidate {
    return {
      label: result.label,
      confidence: result.confidence,
      detectorName: detector.name,
      detectorPriority: this.registry.getPriority(detector.name),
      result,
    };
  }
  
  /**
   * Calculate weighted score for priority-weighted strategy
   * 
   * Formula: confidence * (1 + priorityWeight * (100 - priority) / 100)
   * Higher priority (lower number) gets bonus
   */
  private calculateWeightedScore(
    candidate: LabelCandidate,
    priorityWeight: number
  ): number {
    const priorityBonus = (100 - candidate.detectorPriority) / 100;
    return candidate.confidence * (1 + priorityWeight * priorityBonus);
  }
  
  // ==========================================================================
  // CANDIDATE SELECTION
  // ==========================================================================
  
  /**
   * Select the best candidate based on strategy
   */
  private selectBestCandidate(
    candidates: LabelCandidate[],
    strategy: ResolutionStrategy,
    config: Required<ResolverConfig>
  ): LabelCandidate | null {
    if (candidates.length === 0) {
      return null;
    }
    
    // Filter by minimum confidence
    const validCandidates = candidates.filter(
      c => c.confidence >= config.minConfidence
    );
    
    if (validCandidates.length === 0) {
      return null;
    }
    
    switch (strategy) {
      case 'first-match':
        // Already handled in collection - return first
        return validCandidates[0];
        
      case 'best-confidence':
        return this.selectByConfidence(validCandidates);
        
      case 'priority-weighted':
        return this.selectByWeightedScore(validCandidates);
        
      default:
        return this.selectByConfidence(validCandidates);
    }
  }
  
  /**
   * Select candidate with highest confidence
   */
  private selectByConfidence(candidates: LabelCandidate[]): LabelCandidate {
    return candidates.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }
  
  /**
   * Select candidate with highest weighted score
   */
  private selectByWeightedScore(candidates: LabelCandidate[]): LabelCandidate {
    return candidates.reduce((best, current) => {
      const currentScore = current.weightedScore ?? current.confidence;
      const bestScore = best.weightedScore ?? best.confidence;
      return currentScore > bestScore ? current : best;
    });
  }
  
  /**
   * Count unique detectors that ran (for stats)
   */
  private countDetectorsRun(candidates: LabelCandidate[]): number {
    // This is an approximation - actual count would need tracking
    return this.registry.getEnabled().length;
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Update resolver configuration
   */
  setConfig(config: Partial<ResolverConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<ResolverConfig> {
    return { ...this.config };
  }
  
  /**
   * Set resolution strategy
   */
  setStrategy(strategy: ResolutionStrategy): void {
    this.config.strategy = strategy;
  }
  
  /**
   * Set minimum confidence threshold
   */
  setMinConfidence(threshold: number): void {
    this.config.minConfidence = Math.max(0, Math.min(1, threshold));
  }
  
  /**
   * Get the registry
   */
  getRegistry(): LabelDetectorRegistry {
    return this.registry;
  }
  
  /**
   * Set a new registry
   */
  setRegistry(registry: LabelDetectorRegistry): void {
    this.registry = registry;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a LabelResolver with default configuration
 */
export function createLabelResolver(
  config?: ResolverConfig
): LabelResolver {
  return new LabelResolver(undefined, config);
}

/**
 * Create a LabelResolver with custom registry
 */
export function createResolverWithRegistry(
  registry: LabelDetectorRegistry,
  config?: ResolverConfig
): LabelResolver {
  return new LabelResolver(registry, config);
}

/**
 * Create a fast resolver (first-match strategy)
 */
export function createFastResolver(): LabelResolver {
  return new LabelResolver(undefined, {
    strategy: 'first-match',
    stopOnFirstMatch: true,
  });
}

/**
 * Create an accurate resolver (best-confidence with low threshold)
 */
export function createAccurateResolver(): LabelResolver {
  return new LabelResolver(undefined, {
    strategy: 'best-confidence',
    minConfidence: 0.20,
  });
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/** Singleton resolver instance */
let defaultResolver: LabelResolver | null = null;

/**
 * Get the default resolver instance
 */
export function getResolver(): LabelResolver {
  if (!defaultResolver) {
    defaultResolver = new LabelResolver();
  }
  return defaultResolver;
}

/**
 * Reset the default resolver
 */
export function resetResolver(): void {
  defaultResolver = null;
}

/**
 * Resolve label for an element using default resolver
 */
export function resolveLabel(element: Element): ResolvedLabel {
  return getResolver().resolve(element);
}

/**
 * Get label string for an element
 */
export function getLabelForElement(element: Element): string {
  return getResolver().resolveLabel(element);
}

/**
 * Get all label candidates for an element
 */
export function getAllLabelCandidates(element: Element): LabelCandidate[] {
  return getResolver().resolveAll(element);
}

/**
 * Check if element has a valid label
 */
export function elementHasLabel(element: Element, minConfidence?: number): boolean {
  return getResolver().hasLabel(element, minConfidence);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sort candidates by confidence (descending)
 */
export function sortByConfidence(candidates: LabelCandidate[]): LabelCandidate[] {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Sort candidates by priority (ascending - lower is better)
 */
export function sortByPriority(candidates: LabelCandidate[]): LabelCandidate[] {
  return [...candidates].sort((a, b) => a.detectorPriority - b.detectorPriority);
}

/**
 * Sort candidates by weighted score (descending)
 */
export function sortByWeightedScore(candidates: LabelCandidate[]): LabelCandidate[] {
  return [...candidates].sort((a, b) => 
    (b.weightedScore ?? b.confidence) - (a.weightedScore ?? a.confidence)
  );
}

/**
 * Filter candidates by minimum confidence
 */
export function filterByConfidence(
  candidates: LabelCandidate[],
  minConfidence: number
): LabelCandidate[] {
  return candidates.filter(c => c.confidence >= minConfidence);
}

/**
 * Get unique labels from candidates
 */
export function getUniqueLabels(candidates: LabelCandidate[]): string[] {
  return [...new Set(candidates.map(c => c.label))];
}

/**
 * Find candidate by detector name
 */
export function findCandidateByDetector(
  candidates: LabelCandidate[],
  detectorName: string
): LabelCandidate | undefined {
  return candidates.find(c => c.detectorName === detectorName);
}
