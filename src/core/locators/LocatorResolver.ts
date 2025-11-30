/**
 * LocatorResolver - Main orchestrator for element location
 * @module core/locators/LocatorResolver
 * @version 1.0.0
 * 
 * Executes the 9-tier fallback strategy chain to locate elements.
 * Iterates through registered strategies in priority order until
 * an element is found or all strategies are exhausted.
 * 
 * Features:
 * - Priority-based strategy execution
 * - Configurable timeout and retry intervals
 * - Confidence threshold filtering
 * - Detailed resolution metrics
 * 
 * @see StrategyRegistry for strategy management
 * @see ILocatorStrategy for strategy interface
 * @see locator-strategy_breakdown.md for fallback chain details
 */

import type { ILocatorStrategy, LocatorResult, LocatorContext } from './strategies/ILocatorStrategy';
import type { LocatorBundle } from '../types/locator-bundle';
import { StrategyRegistry, getStrategyRegistry } from './StrategyRegistry';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default timeout for element location (milliseconds)
 */
export const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Default retry interval (milliseconds)
 */
export const DEFAULT_RETRY_INTERVAL_MS = 150;

/**
 * Default minimum confidence threshold
 */
export const DEFAULT_MIN_CONFIDENCE = 0.0;

/**
 * High confidence threshold for early exit
 */
export const HIGH_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Maximum retry attempts (safety limit)
 */
export const MAX_RETRY_ATTEMPTS = 50;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Resolver configuration options
 */
export interface ResolverConfig {
  /** Timeout for element location (ms) */
  timeout?: number;
  /** Retry interval between attempts (ms) */
  retryInterval?: number;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Exit early if confidence exceeds this threshold */
  earlyExitConfidence?: number;
  /** Strategies to skip */
  skipStrategies?: string[];
  /** Only use these strategies */
  onlyStrategies?: string[];
  /** Whether to retry on failure */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Custom strategy registry */
  registry?: StrategyRegistry;
}

/**
 * Single strategy attempt result
 */
export interface StrategyAttempt {
  /** Strategy name */
  strategy: string;
  /** Whether strategy could handle the bundle */
  canHandle: boolean;
  /** Result if strategy was executed */
  result: LocatorResult | null;
  /** Execution duration (ms) */
  duration: number;
  /** Error if strategy threw */
  error?: string;
}

/**
 * Complete resolution result with metrics
 */
export interface ResolutionResult {
  /** Found element or null */
  element: HTMLElement | null;
  /** Final confidence score */
  confidence: number;
  /** Strategy that found the element */
  strategy: string | null;
  /** Total resolution duration (ms) */
  duration: number;
  /** Number of retry cycles */
  retryCycles: number;
  /** All strategy attempts */
  attempts: StrategyAttempt[];
  /** Whether resolution timed out */
  timedOut: boolean;
  /** Whether element was found */
  success: boolean;
  /** Best result across all attempts (even if below threshold) */
  bestResult: LocatorResult | null;
  /** Error message if failed */
  error?: string;
}

/**
 * Resolution progress callback
 */
export type ResolutionProgressCallback = (
  currentStrategy: string,
  attemptNumber: number,
  totalStrategies: number
) => void;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Delays execution for specified milliseconds
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a default resolver config with overrides
 * 
 * @param overrides - Config overrides
 * @returns Complete config object
 */
export function createResolverConfig(
  overrides: Partial<ResolverConfig> = {}
): Required<Omit<ResolverConfig, 'registry'>> & { registry?: StrategyRegistry } {
  return {
    timeout: DEFAULT_TIMEOUT_MS,
    retryInterval: DEFAULT_RETRY_INTERVAL_MS,
    minConfidence: DEFAULT_MIN_CONFIDENCE,
    earlyExitConfidence: HIGH_CONFIDENCE_THRESHOLD,
    skipStrategies: [],
    onlyStrategies: [],
    enableRetry: true,
    maxRetries: MAX_RETRY_ATTEMPTS,
    ...overrides,
  };
}

/**
 * Checks if a result meets the confidence threshold
 * 
 * @param result - Locator result
 * @param minConfidence - Minimum required confidence
 * @returns True if result meets threshold
 */
export function meetsConfidenceThreshold(
  result: LocatorResult | null,
  minConfidence: number
): boolean {
  if (!result || !result.element) return false;
  return result.confidence >= minConfidence;
}

/**
 * Compares two results and returns the better one
 * 
 * @param a - First result
 * @param b - Second result
 * @returns Better result (higher confidence with element)
 */
export function compareBestResult(
  a: LocatorResult | null,
  b: LocatorResult | null
): LocatorResult | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  
  // Prefer results with elements
  if (a.element && !b.element) return a;
  if (!a.element && b.element) return b;
  
  // Compare confidence
  return a.confidence >= b.confidence ? a : b;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * LocatorResolver - Orchestrates element location through strategy chain
 * 
 * Executes registered strategies in priority order, with retry support,
 * to find elements matching a LocatorBundle.
 * 
 * @example
 * ```typescript
 * const resolver = new LocatorResolver();
 * const result = await resolver.resolve(bundle, document);
 * 
 * if (result.success) {
 *   console.log(`Found with ${result.strategy} at ${result.confidence} confidence`);
 * }
 * ```
 */
export class LocatorResolver {
  /**
   * Strategy registry
   */
  private registry: StrategyRegistry;
  
  /**
   * Default configuration
   */
  private defaultConfig: Required<Omit<ResolverConfig, 'registry'>>;
  
  /**
   * Creates a new LocatorResolver
   * 
   * @param config - Optional configuration
   */
  constructor(config: ResolverConfig = {}) {
    this.registry = config.registry || getStrategyRegistry();
    this.defaultConfig = createResolverConfig(config);
  }
  
  // ==========================================================================
  // MAIN RESOLUTION METHODS
  // ==========================================================================
  
  /**
   * Resolves a bundle to an element using the strategy chain
   * 
   * @param bundle - LocatorBundle to resolve
   * @param doc - Document to search (or use context)
   * @param config - Optional config overrides
   * @returns Resolution result with element and metrics
   */
  async resolve(
    bundle: LocatorBundle,
    doc?: Document,
    config?: Partial<ResolverConfig>
  ): Promise<ResolutionResult> {
    const startTime = performance.now();
    const cfg = { ...this.defaultConfig, ...config };
    
    const context: LocatorContext = {
      document: doc || document,
    };
    
    const attempts: StrategyAttempt[] = [];
    let bestResult: LocatorResult | null = null;
    let retryCycles = 0;
    let timedOut = false;
    
    // Get filtered strategies
    const strategies = this.getFilteredStrategies(cfg);
    
    if (strategies.length === 0) {
      return this.createFailureResult(
        startTime,
        attempts,
        'No strategies available',
        bestResult
      );
    }
    
    // Main resolution loop with retry
    const deadline = startTime + cfg.timeout;
    
    while (performance.now() < deadline && retryCycles <= cfg.maxRetries) {
      // Execute one cycle through all strategies
      const cycleResult = await this.executeCycle(
        bundle,
        context,
        strategies,
        cfg,
        attempts
      );
      
      // Update best result
      bestResult = compareBestResult(bestResult, cycleResult.bestResult);
      
      // Check if we found a good match
      if (cycleResult.found && meetsConfidenceThreshold(cycleResult.bestResult, cfg.minConfidence)) {
        // Check for early exit on high confidence
        if (cycleResult.bestResult!.confidence >= cfg.earlyExitConfidence) {
          return this.createSuccessResult(
            startTime,
            attempts,
            cycleResult.bestResult!,
            retryCycles
          );
        }
        
        // Found element meeting threshold
        return this.createSuccessResult(
          startTime,
          attempts,
          cycleResult.bestResult!,
          retryCycles
        );
      }
      
      // No retry if disabled or no time left
      if (!cfg.enableRetry) break;
      
      retryCycles++;
      
      // Wait before retry
      const timeRemaining = deadline - performance.now();
      if (timeRemaining > cfg.retryInterval) {
        await delay(cfg.retryInterval);
      } else {
        timedOut = true;
        break;
      }
    }
    
    // Check if we exceeded deadline
    if (performance.now() >= deadline) {
      timedOut = true;
    }
    
    // Check if we have any result that meets threshold
    if (bestResult && meetsConfidenceThreshold(bestResult, cfg.minConfidence)) {
      return this.createSuccessResult(
        startTime,
        attempts,
        bestResult,
        retryCycles,
        timedOut
      );
    }
    
    // Return failure with best attempt
    return this.createFailureResult(
      startTime,
      attempts,
      timedOut ? 'Resolution timed out' : 'No matching element found',
      bestResult,
      retryCycles,
      timedOut
    );
  }
  
  /**
   * Resolves synchronously without retry (single pass)
   * 
   * @param bundle - LocatorBundle to resolve
   * @param doc - Document to search
   * @param config - Optional config overrides
   * @returns Resolution result
   */
  resolveSync(
    bundle: LocatorBundle,
    doc?: Document,
    config?: Partial<ResolverConfig>
  ): ResolutionResult {
    const startTime = performance.now();
    const cfg = { ...this.defaultConfig, ...config, enableRetry: false };
    
    const context: LocatorContext = {
      document: doc || document,
    };
    
    const attempts: StrategyAttempt[] = [];
    const strategies = this.getFilteredStrategies(cfg);
    
    if (strategies.length === 0) {
      return this.createFailureResult(
        startTime,
        attempts,
        'No strategies available',
        null
      );
    }
    
    // Single pass through strategies
    let bestResult: LocatorResult | null = null;
    
    for (const strategy of strategies) {
      const attempt = this.executeStrategy(strategy, bundle, context);
      attempts.push(attempt);
      
      if (attempt.result) {
        bestResult = compareBestResult(bestResult, attempt.result);
        
        // Early exit on high confidence
        if (attempt.result.element && 
            attempt.result.confidence >= cfg.earlyExitConfidence) {
          return this.createSuccessResult(startTime, attempts, attempt.result, 0);
        }
      }
    }
    
    if (bestResult && meetsConfidenceThreshold(bestResult, cfg.minConfidence)) {
      return this.createSuccessResult(startTime, attempts, bestResult, 0);
    }
    
    return this.createFailureResult(
      startTime,
      attempts,
      'No matching element found',
      bestResult
    );
  }
  
  /**
   * Finds element using a specific strategy only
   * 
   * @param strategyName - Name of strategy to use
   * @param bundle - LocatorBundle to resolve
   * @param doc - Document to search
   * @returns Locator result
   */
  resolveWith(
    strategyName: string,
    bundle: LocatorBundle,
    doc?: Document
  ): LocatorResult {
    const strategy = this.registry.get(strategyName);
    
    if (!strategy) {
      return {
        element: null,
        confidence: 0,
        strategy: strategyName,
        duration: 0,
        error: `Strategy '${strategyName}' not found`,
      };
    }
    
    const context: LocatorContext = {
      document: doc || document,
    };
    
    const attempt = this.executeStrategy(strategy, bundle, context);
    return attempt.result || {
      element: null,
      confidence: 0,
      strategy: strategyName,
      duration: attempt.duration,
      error: attempt.error || 'Strategy could not handle bundle',
    };
  }
  
  // ==========================================================================
  // STRATEGY EXECUTION METHODS
  // ==========================================================================
  
  /**
   * Executes a single cycle through all strategies
   * 
   * @param bundle - Bundle to resolve
   * @param context - Locator context
   * @param strategies - Strategies to execute
   * @param config - Resolver config
   * @param attempts - Attempts array to append to
   * @returns Cycle result
   */
  private async executeCycle(
    bundle: LocatorBundle,
    context: LocatorContext,
    strategies: ILocatorStrategy[],
    config: Required<Omit<ResolverConfig, 'registry'>>,
    attempts: StrategyAttempt[]
  ): Promise<{ found: boolean; bestResult: LocatorResult | null }> {
    let bestResult: LocatorResult | null = null;
    
    for (const strategy of strategies) {
      const attempt = this.executeStrategy(strategy, bundle, context);
      attempts.push(attempt);
      
      if (attempt.result) {
        bestResult = compareBestResult(bestResult, attempt.result);
        
        // Early exit on high confidence match
        if (attempt.result.element && 
            attempt.result.confidence >= config.earlyExitConfidence) {
          return { found: true, bestResult: attempt.result };
        }
      }
    }
    
    const found = bestResult !== null && bestResult.element !== null;
    return { found, bestResult };
  }
  
  /**
   * Executes a single strategy
   * 
   * @param strategy - Strategy to execute
   * @param bundle - Bundle to resolve
   * @param context - Locator context
   * @returns Strategy attempt result
   */
  private executeStrategy(
    strategy: ILocatorStrategy,
    bundle: LocatorBundle,
    context: LocatorContext
  ): StrategyAttempt {
    const startTime = performance.now();
    
    try {
      // Check if strategy can handle this bundle
      const canHandle = strategy.canHandle(bundle);
      
      if (!canHandle) {
        return {
          strategy: strategy.name,
          canHandle: false,
          result: null,
          duration: performance.now() - startTime,
        };
      }
      
      // Execute strategy
      const result = strategy.find(bundle, context);
      
      return {
        strategy: strategy.name,
        canHandle: true,
        result,
        duration: performance.now() - startTime,
      };
      
    } catch (error) {
      return {
        strategy: strategy.name,
        canHandle: true,
        result: null,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Gets filtered strategies based on config
   * 
   * @param config - Resolver config
   * @returns Filtered strategy array
   */
  private getFilteredStrategies(
    config: Required<Omit<ResolverConfig, 'registry'>>
  ): ILocatorStrategy[] {
    let strategies = this.registry.getStrategies();
    
    // Filter to only specified strategies
    if (config.onlyStrategies.length > 0) {
      const allowed = new Set(config.onlyStrategies);
      strategies = strategies.filter(s => allowed.has(s.name));
    }
    
    // Skip specified strategies
    if (config.skipStrategies.length > 0) {
      const skip = new Set(config.skipStrategies);
      strategies = strategies.filter(s => !skip.has(s.name));
    }
    
    return strategies;
  }
  
  /**
   * Creates a success result
   */
  private createSuccessResult(
    startTime: number,
    attempts: StrategyAttempt[],
    result: LocatorResult,
    retryCycles: number,
    timedOut: boolean = false
  ): ResolutionResult {
    return {
      element: result.element,
      confidence: result.confidence,
      strategy: result.strategy,
      duration: performance.now() - startTime,
      retryCycles,
      attempts,
      timedOut,
      success: true,
      bestResult: result,
    };
  }
  
  /**
   * Creates a failure result
   */
  private createFailureResult(
    startTime: number,
    attempts: StrategyAttempt[],
    error: string,
    bestResult: LocatorResult | null,
    retryCycles: number = 0,
    timedOut: boolean = false
  ): ResolutionResult {
    return {
      element: null,
      confidence: bestResult?.confidence || 0,
      strategy: bestResult?.strategy || null,
      duration: performance.now() - startTime,
      retryCycles,
      attempts,
      timedOut,
      success: false,
      bestResult,
      error,
    };
  }
  
  // ==========================================================================
  // CONFIGURATION METHODS
  // ==========================================================================
  
  /**
   * Gets the strategy registry
   * 
   * @returns Strategy registry instance
   */
  getRegistry(): StrategyRegistry {
    return this.registry;
  }
  
  /**
   * Sets the strategy registry
   * 
   * @param registry - New registry to use
   */
  setRegistry(registry: StrategyRegistry): void {
    this.registry = registry;
  }
  
  /**
   * Gets the default configuration
   * 
   * @returns Default config object
   */
  getConfig(): Required<Omit<ResolverConfig, 'registry'>> {
    return { ...this.defaultConfig };
  }
  
  /**
   * Updates the default configuration
   * 
   * @param config - Config updates
   */
  updateConfig(config: Partial<ResolverConfig>): void {
    Object.assign(this.defaultConfig, config);
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /**
   * Tests which strategies can handle a bundle
   * 
   * @param bundle - Bundle to test
   * @returns Array of strategy names that can handle the bundle
   */
  testHandlers(bundle: LocatorBundle): string[] {
    const strategies = this.registry.getStrategies();
    return strategies
      .filter(s => s.canHandle(bundle))
      .map(s => s.name);
  }
  
  /**
   * Gets available strategy names
   * 
   * @returns Array of enabled strategy names
   */
  getAvailableStrategies(): string[] {
    return this.registry.getNames();
  }
  
  /**
   * Creates a context object for strategies
   * 
   * @param doc - Document to use
   * @returns Locator context
   */
  createContext(
    doc?: Document
  ): LocatorContext {
    return {
      document: doc || document,
    };
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of LocatorResolver
 */
let instance: LocatorResolver | null = null;

/**
 * Gets or creates the global LocatorResolver singleton
 * 
 * @returns LocatorResolver instance
 */
export function getLocatorResolver(): LocatorResolver {
  if (!instance) {
    instance = new LocatorResolver();
  }
  return instance;
}

/**
 * Creates a new LocatorResolver instance
 * 
 * @param config - Optional configuration
 * @returns New LocatorResolver instance
 */
export function createLocatorResolver(config?: ResolverConfig): LocatorResolver {
  return new LocatorResolver(config);
}

/**
 * Resets the global singleton (for testing)
 */
export function resetLocatorResolver(): void {
  instance = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Resolves a bundle using the global resolver
 * 
 * @param bundle - Bundle to resolve
 * @param doc - Document to search
 * @param config - Optional config
 * @returns Resolution result
 */
export async function resolveElement(
  bundle: LocatorBundle,
  doc?: Document,
  config?: Partial<ResolverConfig>
): Promise<ResolutionResult> {
  return getLocatorResolver().resolve(bundle, doc, config);
}

/**
 * Resolves a bundle synchronously using the global resolver
 * 
 * @param bundle - Bundle to resolve
 * @param doc - Document to search
 * @param config - Optional config
 * @returns Resolution result
 */
export function resolveElementSync(
  bundle: LocatorBundle,
  doc?: Document,
  config?: Partial<ResolverConfig>
): ResolutionResult {
  return getLocatorResolver().resolveSync(bundle, doc, config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default LocatorResolver;
