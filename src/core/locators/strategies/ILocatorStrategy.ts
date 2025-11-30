/**
 * ILocatorStrategy - Interface for element locator strategies
 * @module core/locators/strategies/ILocatorStrategy
 * @version 1.0.0
 * 
 * Defines the contract for all element location strategies in the 9-tier fallback chain.
 * Each strategy attempts to locate elements using different attributes and techniques.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 4 for strategy configuration
 * @see locator-strategy_breakdown.md for implementation details
 */

import type { LocatorBundle } from '../../types/locator-bundle';

/**
 * Context provided to locator strategies for element location
 */
export interface LocatorContext {
  /** Document to search in (may be iframe document) */
  document: Document;
  /** Window reference */
  window?: Window;
  /** Parent frames if in iframe */
  frameChain?: HTMLIFrameElement[];
  /** Shadow roots traversed */
  shadowRoots?: ShadowRoot[];
  /** Current search depth in DOM tree */
  depth?: number;
}

/**
 * Result returned by a locator strategy
 */
export interface LocatorResult {
  /** Located element, null if not found */
  element: HTMLElement | null;
  /** Confidence score 0-1 indicating match quality */
  confidence: number;
  /** Strategy name that located the element */
  strategy: string;
  /** Time taken to locate element in milliseconds */
  duration: number;
  /** Error message if location failed */
  error?: string;
  /** Optional metadata about the location process */
  metadata?: {
    /** Type of match: 'exact', 'partial', 'fuzzy', etc. */
    matchType?: string;
    /** Number of candidate elements considered */
    candidateCount?: number;
    /** Additional strategy-specific data */
    [key: string]: any;
  };
}

/**
 * Interface for element locator strategies
 * 
 * Each strategy implements a specific method for locating elements
 * using attributes from the LocatorBundle. Strategies are organized
 * in a 9-tier fallback chain with decreasing confidence levels.
 */
export interface ILocatorStrategy {
  /** Strategy name identifier (e.g., 'xpath', 'id', 'placeholder') */
  readonly name: string;
  
  /** Priority in fallback chain (lower = higher priority) */
  readonly priority: number;
  
  /** Base confidence score for this strategy 0-1 */
  readonly baseConfidence: number;
  
  /**
   * Check if this strategy can handle the given bundle
   * 
   * @param bundle - LocatorBundle to check
   * @returns true if strategy has required attributes to attempt location
   */
  canHandle(bundle: LocatorBundle): boolean;
  
  /**
   * Attempt to locate an element using this strategy
   * 
   * @param bundle - LocatorBundle containing element attributes
   * @param context - Context for element location
   * @returns LocatorResult with element and confidence, or null if not found
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult;
  
  /**
   * Generate a selector string for recording
   * 
   * @param element - Element to generate selector for
   * @returns Selector string, or null if not applicable
   */
  generateSelector(element: HTMLElement): string | null;
  
  /**
   * Validate that an element matches the expected attributes
   * 
   * @param element - Element to validate
   * @param expectedValue - Expected value for this strategy's attribute
   * @returns true if element matches expected value
   */
  validate(element: HTMLElement, expectedValue: string): boolean;
}
