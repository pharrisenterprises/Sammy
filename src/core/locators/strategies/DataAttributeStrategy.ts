/**
 * DataAttributeStrategy - Locates elements by data-* attributes
 * @module core/locators/strategies/DataAttributeStrategy
 * @version 1.0.0
 * 
 * Tier 6 in the 9-tier fallback chain with 65% confidence.
 * Targets elements with testing-oriented data attributes like
 * data-testid, data-cy, data-qa, data-test, and custom data-* attributes.
 * 
 * @see ILocatorStrategy for interface contract
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { ILocatorStrategy, LocatorResult, LocatorContext } from './ILocatorStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';

/**
 * CSS.escape polyfill for test environments
 * jsdom doesn't implement CSS.escape, so we provide a simple polyfill
 */
if (typeof CSS === 'undefined') {
  (globalThis as any).CSS = {
    escape: (value: string): string => {
      return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    }
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Strategy name identifier
 */
export const STRATEGY_NAME = 'data-attribute';

/**
 * Strategy priority in fallback chain (lower = higher priority)
 * Tier 6: After Placeholder (tier 5), before Fuzzy Text (tier 7)
 */
export const STRATEGY_PRIORITY = 6;

/**
 * Base confidence score for data attribute matches (65%)
 * Data attributes are intentionally stable but may be removed in production
 */
export const BASE_CONFIDENCE = 0.65;

/**
 * Confidence bonus for testing-specific attributes
 */
export const TESTING_ATTR_BONUS = 0.10;

/**
 * Confidence penalty for ambiguous matches
 */
export const AMBIGUITY_PENALTY = 0.15;

/**
 * Confidence penalty when attribute value partially matches
 */
export const PARTIAL_MATCH_PENALTY = 0.10;

/**
 * Priority-ordered list of testing data attributes
 * Higher in list = more reliable for testing purposes
 */
export const TESTING_DATA_ATTRIBUTES = [
  'data-testid',      // React Testing Library convention
  'data-test-id',     // Alternative format
  'data-cy',          // Cypress convention
  'data-qa',          // QA team convention
  'data-test',        // Generic test attribute
  'data-automation',  // Automation convention
  'data-e2e',         // End-to-end testing
  'data-selenium',    // Selenium convention
] as const;

/**
 * Data attributes to ignore (typically dynamic/framework-generated)
 */
export const IGNORED_DATA_ATTRIBUTES = [
  'data-reactid',
  'data-reactroot',
  'data-react-checksum',
  'data-v-',          // Vue scoped styles (prefix)
  'data-emotion',
  'data-styled',
  'data-radix',
  'data-state',       // Often dynamic state
  'data-open',        // Often dynamic state
  'data-closed',      // Often dynamic state
  'data-highlighted', // Often dynamic state
  'data-disabled',    // Often dynamic state
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a single data attribute match
 */
export interface DataAttributeMatch {
  /** Attribute name (e.g., 'data-testid') */
  name: string;
  /** Attribute value */
  value: string;
  /** Whether this is a testing-specific attribute */
  isTestingAttr: boolean;
  /** Priority based on attribute type (lower = better) */
  priority: number;
}

/**
 * Result of scanning an element for data attributes
 */
export interface DataAttributeScan {
  /** All relevant data attributes found */
  attributes: DataAttributeMatch[];
  /** Best attribute for matching */
  bestAttribute: DataAttributeMatch | null;
  /** Total count of data attributes */
  totalCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if an attribute name is a testing-specific data attribute
 * 
 * @param attrName - Attribute name to check
 * @returns True if it's a known testing attribute
 */
export function isTestingAttribute(attrName: string): boolean {
  const lowerName = attrName.toLowerCase();
  return TESTING_DATA_ATTRIBUTES.some(
    testAttr => lowerName === testAttr || lowerName.startsWith(testAttr + '-')
  );
}

/**
 * Checks if an attribute should be ignored (dynamic/framework-generated)
 * 
 * @param attrName - Attribute name to check
 * @returns True if attribute should be ignored
 */
export function shouldIgnoreAttribute(attrName: string): boolean {
  const lowerName = attrName.toLowerCase();
  return IGNORED_DATA_ATTRIBUTES.some(
    ignored => lowerName === ignored || lowerName.startsWith(ignored)
  );
}

/**
 * Gets the priority of a data attribute (lower = higher priority)
 * 
 * @param attrName - Attribute name
 * @returns Priority number (0 = highest)
 */
export function getAttributePriority(attrName: string): number {
  const lowerName = attrName.toLowerCase();
  
  // Check testing attributes first
  const testingIndex = TESTING_DATA_ATTRIBUTES.findIndex(
    testAttr => lowerName === testAttr || lowerName.startsWith(testAttr + '-')
  );
  
  if (testingIndex !== -1) {
    return testingIndex;
  }
  
  // Generic data attributes get lower priority
  return TESTING_DATA_ATTRIBUTES.length + 1;
}

/**
 * Extracts all relevant data attributes from an element
 * 
 * @param element - DOM element to scan
 * @returns DataAttributeScan with all found attributes
 */
export function scanDataAttributes(element: Element): DataAttributeScan {
  const attributes: DataAttributeMatch[] = [];
  
  for (const attr of element.attributes) {
    if (!attr.name.startsWith('data-')) continue;
    if (shouldIgnoreAttribute(attr.name)) continue;
    if (!attr.value || attr.value.trim() === '') continue;
    
    const match: DataAttributeMatch = {
      name: attr.name,
      value: attr.value,
      isTestingAttr: isTestingAttribute(attr.name),
      priority: getAttributePriority(attr.name),
    };
    
    attributes.push(match);
  }
  
  // Sort by priority (lower = better)
  attributes.sort((a, b) => a.priority - b.priority);
  
  return {
    attributes,
    bestAttribute: attributes[0] || null,
    totalCount: attributes.length,
  };
}

/**
 * Builds a CSS selector for a data attribute
 * 
 * @param attrName - Attribute name
 * @param attrValue - Attribute value
 * @param tagName - Optional tag name constraint
 * @returns CSS selector string
 */
export function buildDataAttrSelector(
  attrName: string,
  attrValue: string,
  tagName?: string
): string {
  const escapedValue = CSS.escape(attrValue);
  const tag = tagName?.toLowerCase() || '';
  
  if (tag) {
    return `${tag}[${attrName}="${escapedValue}"]`;
  }
  
  return `[${attrName}="${escapedValue}"]`;
}

/**
 * Builds a selector that matches any of the provided data attributes
 * 
 * @param dataAttrs - Object with data attribute key-value pairs
 * @param tagName - Optional tag name constraint
 * @returns CSS selector string or null if no valid attributes
 */
export function buildMultiAttrSelector(
  dataAttrs: Record<string, string>,
  tagName?: string
): string | null {
  const selectors: string[] = [];
  
  // Prioritize testing attributes
  for (const testAttr of TESTING_DATA_ATTRIBUTES) {
    const key = testAttr.replace('data-', '');
    if (dataAttrs[key] || dataAttrs[testAttr]) {
      const value = dataAttrs[key] || dataAttrs[testAttr];
      selectors.push(buildDataAttrSelector(testAttr, value, tagName));
    }
  }
  
  // Add remaining attributes
  for (const [key, value] of Object.entries(dataAttrs)) {
    if (!value) continue;
    
    const attrName = key.startsWith('data-') ? key : `data-${key}`;
    if (shouldIgnoreAttribute(attrName)) continue;
    
    // Skip if already added
    const selector = buildDataAttrSelector(attrName, value, tagName);
    if (!selectors.includes(selector)) {
      selectors.push(selector);
    }
  }
  
  if (selectors.length === 0) return null;
  
  // Return first (highest priority) selector
  return selectors[0];
}

/**
 * Compares two data attribute objects for similarity
 * 
 * @param bundleAttrs - Attributes from bundle
 * @param elementAttrs - Attributes from element
 * @returns Similarity score 0-1
 */
export function compareDataAttributes(
  bundleAttrs: Record<string, string>,
  elementAttrs: Record<string, string>
): number {
  const bundleKeys = Object.keys(bundleAttrs).filter(k => bundleAttrs[k]);
  
  if (bundleKeys.length === 0) return 0;
  
  let matchCount = 0;
  let partialCount = 0;
  
  for (const key of bundleKeys) {
    const bundleValue = bundleAttrs[key];
    const elementValue = elementAttrs[key];
    
    if (elementValue === bundleValue) {
      matchCount++;
    } else if (elementValue && bundleValue) {
      // Check for partial match (contains)
      if (elementValue.includes(bundleValue) || bundleValue.includes(elementValue)) {
        partialCount++;
      }
    }
  }
  
  const fullMatchScore = matchCount / bundleKeys.length;
  const partialMatchScore = (partialCount / bundleKeys.length) * 0.5;
  
  return Math.min(1, fullMatchScore + partialMatchScore);
}

/**
 * Extracts data attributes from an element as a key-value object
 * 
 * @param element - DOM element
 * @returns Object with data attribute names (without 'data-' prefix) as keys
 */
export function extractDataAttrsFromElement(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  for (const attr of element.attributes) {
    if (!attr.name.startsWith('data-')) continue;
    if (shouldIgnoreAttribute(attr.name)) continue;
    
    // Store both with and without prefix for flexibility
    attrs[attr.name] = attr.value;
    attrs[attr.name.replace('data-', '')] = attr.value;
  }
  
  return attrs;
}

// ============================================================================
// MAIN STRATEGY CLASS
// ============================================================================

/**
 * DataAttributeStrategy implementation
 * 
 * Locates elements by matching their data-* attributes against
 * the recorded dataAttrs in the LocatorBundle. Prioritizes
 * testing-specific attributes (data-testid, data-cy, etc.).
 * 
 * @example
 * ```typescript
 * const strategy = new DataAttributeStrategy();
 * const result = strategy.find(bundle, document);
 * if (result.element) {
 *   console.log(`Found with ${result.confidence} confidence`);
 * }
 * ```
 */
export class DataAttributeStrategy implements ILocatorStrategy {
  /**
   * Strategy name for logging and debugging
   */
  readonly name: string = STRATEGY_NAME;
  
  /**
   * Priority in fallback chain (lower = tried first)
   */
  readonly priority: number = STRATEGY_PRIORITY;
  
  /**
   * Base confidence score for this strategy
   */
  readonly baseConfidence: number = BASE_CONFIDENCE;
  
  /**
   * Determines if this strategy can attempt to find an element
   * based on the bundle contents.
   * 
   * @param bundle - LocatorBundle with recorded element data
   * @returns True if bundle has usable data attributes
   */
  canHandle(bundle: LocatorBundle): boolean {
    if (!bundle.dataAttrs) return false;
    
    const keys = Object.keys(bundle.dataAttrs);
    if (keys.length === 0) return false;
    
    // Check if any attribute has a non-empty value
    return keys.some(key => {
      const value = bundle.dataAttrs[key];
      if (!value || value.trim() === '') return false;
      
      const attrName = key.startsWith('data-') ? key : `data-${key}`;
      return !shouldIgnoreAttribute(attrName);
    });
  }
  
  /**
   * Attempts to find an element matching the bundle's data attributes
   * 
   * @param bundle - LocatorBundle containing data attributes to match
   * @param context - Locator context with document and options
   * @returns LocatorResult with element (if found) and confidence
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult {
    const startTime = performance.now();
    
    // Validate bundle has data attributes
    if (!this.canHandle(bundle)) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'Bundle has no usable data attributes',
      };
    }
    
    const doc = context.document || document;
    
    try {
      // Try to find by best selector
      const selector = buildMultiAttrSelector(bundle.dataAttrs, bundle.tag);
      
      if (!selector) {
        return {
          element: null,
          confidence: 0,
          strategy: this.name,
          duration: performance.now() - startTime,
          error: 'Could not build selector from data attributes',
        };
      }
      
      const candidates = Array.from(doc.querySelectorAll(selector));
      
      if (candidates.length === 0) {
        // Try fallback: search by any matching data attribute
        return this.findByAnyAttribute(bundle, doc, startTime);
      }
      
      if (candidates.length === 1) {
        const element = candidates[0] as HTMLElement;
        const hasTestingAttr = this.hasTestingAttribute(element);
        
        return {
          element,
          confidence: this.calculateConfidence(element, bundle, 1, hasTestingAttr),
          strategy: this.name,
          duration: performance.now() - startTime,
          metadata: {
            matchedBy: selector,
            hasTestingAttr,
          },
        };
      }
      
      // Multiple matches - disambiguate
      return this.disambiguate(candidates as HTMLElement[], bundle, startTime);
      
    } catch (error) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Fallback: searches for elements matching any bundle data attribute
   * 
   * @param bundle - LocatorBundle with target data attributes
   * @param doc - Document to search
   * @param startTime - Performance timing start
   * @returns LocatorResult from fallback search
   */
  private findByAnyAttribute(
    bundle: LocatorBundle,
    doc: Document,
    startTime: number
  ): LocatorResult {
    const bundleAttrs = bundle.dataAttrs;
    let bestMatch: HTMLElement | null = null;
    let bestScore = 0;
    let matchedAttr = '';
    
    // Try each data attribute individually
    for (const [key, value] of Object.entries(bundleAttrs)) {
      if (!value) continue;
      
      const attrName = key.startsWith('data-') ? key : `data-${key}`;
      if (shouldIgnoreAttribute(attrName)) continue;
      
      const selector = `[${attrName}="${CSS.escape(value)}"]`;
      const elements = doc.querySelectorAll(selector);
      
      for (const element of elements) {
        const elementAttrs = extractDataAttrsFromElement(element);
        const score = compareDataAttributes(bundleAttrs, elementAttrs);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = element as HTMLElement;
          matchedAttr = attrName;
        }
      }
    }
    
    if (bestMatch && bestScore >= 0.3) {
      const hasTestingAttr = this.hasTestingAttribute(bestMatch);
      
      return {
        element: bestMatch,
        confidence: BASE_CONFIDENCE * bestScore - PARTIAL_MATCH_PENALTY,
        strategy: this.name,
        duration: performance.now() - startTime,
        metadata: {
          matchType: 'partial',
          matchedBy: matchedAttr,
          similarity: bestScore,
          hasTestingAttr,
        },
      };
    }
    
    return {
      element: null,
      confidence: 0,
      strategy: this.name,
      duration: performance.now() - startTime,
      error: 'No matching data attributes found',
    };
  }
  
  /**
   * Disambiguates between multiple elements with matching data attributes
   * 
   * @param candidates - Elements with matching attributes
   * @param bundle - LocatorBundle for additional matching criteria
   * @param startTime - Performance timing start
   * @returns LocatorResult with best match
   */
  private disambiguate(
    candidates: HTMLElement[],
    bundle: LocatorBundle,
    startTime: number
  ): LocatorResult {
    // Score each candidate
    const scored = candidates.map(element => ({
      element,
      score: this.scoreCandidate(element, bundle),
      hasTestingAttr: this.hasTestingAttribute(element),
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    const runnerUp = scored[1];
    
    // Check if best is clearly better
    const scoreDifference = best.score - (runnerUp?.score || 0);
    const isConfident = scoreDifference > 0.15;
    
    let confidence = this.calculateConfidence(
      best.element,
      bundle,
      candidates.length,
      best.hasTestingAttr
    );
    
    if (!isConfident) {
      confidence -= AMBIGUITY_PENALTY;
    }
    
    return {
      element: best.element,
      confidence: Math.max(0, confidence),
      strategy: this.name,
      duration: performance.now() - startTime,
      metadata: {
        candidateCount: candidates.length,
        bestScore: best.score,
        isAmbiguous: !isConfident,
        hasTestingAttr: best.hasTestingAttr,
      },
    };
  }
  
  /**
   * Checks if an element has any testing-specific data attribute
   * 
   * @param element - Element to check
   * @returns True if element has testing attribute
   */
  private hasTestingAttribute(element: Element): boolean {
    for (const attr of element.attributes) {
      if (isTestingAttribute(attr.name)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Scores a candidate element against the bundle
   * 
   * @param element - Candidate element
   * @param bundle - Original LocatorBundle
   * @returns Score 0-1
   */
  private scoreCandidate(element: HTMLElement, bundle: LocatorBundle): number {
    let score = 0.4; // Base score for having matching data attr
    
    // Data attribute similarity
    const elementAttrs = extractDataAttrsFromElement(element);
    const attrSimilarity = compareDataAttributes(bundle.dataAttrs, elementAttrs);
    score += attrSimilarity * 0.3;
    
    // Testing attribute bonus
    if (this.hasTestingAttribute(element)) {
      score += 0.1;
    }
    
    // Tag match bonus
    if (bundle.tag && element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      score += 0.1;
    }
    
    // Bounding box proximity bonus
    if (bundle.bounding) {
      const rect = element.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(rect.x - bundle.bounding.x, 2) +
        Math.pow(rect.y - bundle.bounding.y, 2)
      );
      
      if (distance < 50) {
        score += 0.1;
      } else if (distance < 150) {
        score += 0.05;
      }
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Calculates final confidence score
   * 
   * @param element - Found element
   * @param bundle - Original bundle
   * @param candidateCount - Number of matching elements found
   * @param hasTestingAttr - Whether element has testing attribute
   * @returns Confidence score 0-1
   */
  private calculateConfidence(
    element: HTMLElement,
    bundle: LocatorBundle,
    candidateCount: number,
    hasTestingAttr: boolean
  ): number {
    let confidence = BASE_CONFIDENCE;
    
    // Bonus for testing attributes
    if (hasTestingAttr) {
      confidence += TESTING_ATTR_BONUS;
    }
    
    // Penalty for multiple matches
    if (candidateCount > 1) {
      confidence -= AMBIGUITY_PENALTY * Math.min(candidateCount - 1, 3) * 0.25;
    }
    
    // Verify data attributes still match
    const elementAttrs = extractDataAttrsFromElement(element);
    const similarity = compareDataAttributes(bundle.dataAttrs, elementAttrs);
    
    if (similarity < 1) {
      confidence -= PARTIAL_MATCH_PENALTY * (1 - similarity);
    }
    
    // Tag match bonus
    if (bundle.tag && element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      confidence += 0.03;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Generates a data-attribute-based selector for an element
   * Used during recording to populate the bundle
   * 
   * @param element - Element to generate selector for
   * @returns CSS selector string or null
   */
  generateSelector(element: HTMLElement): string | null {
    const scan = scanDataAttributes(element);
    
    if (!scan.bestAttribute) return null;
    
    return buildDataAttrSelector(
      scan.bestAttribute.name,
      scan.bestAttribute.value,
      element.tagName
    );
  }
  
  /**
   * Validates that an element has expected data attributes
   * 
   * @param element - Element to validate
   * @param expectedValue - Expected data attributes (can be string or object)
   * @returns True if attributes match
   */
  validate(element: HTMLElement, expectedValue: string | Record<string, string>): boolean {
    // Handle both string and object formats
    const expectedAttrs = typeof expectedValue === 'string' 
      ? { testid: expectedValue } 
      : expectedValue;
    const elementAttrs = extractDataAttrsFromElement(element);
    
    for (const [key, value] of Object.entries(expectedAttrs)) {
      if (!value) continue;
      
      const attrName = key.startsWith('data-') ? key : `data-${key}`;
      const shortKey = key.replace('data-', '');
      
      if (elementAttrs[attrName] !== value && elementAttrs[shortKey] !== value) {
        return false;
      }
    }
    
    return true;
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of DataAttributeStrategy
 */
let instance: DataAttributeStrategy | null = null;

/**
 * Gets or creates the DataAttributeStrategy singleton
 * 
 * @returns DataAttributeStrategy instance
 */
export function getDataAttributeStrategy(): DataAttributeStrategy {
  if (!instance) {
    instance = new DataAttributeStrategy();
  }
  return instance;
}

/**
 * Creates a new DataAttributeStrategy instance (for testing)
 * 
 * @returns New DataAttributeStrategy instance
 */
export function createDataAttributeStrategy(): DataAttributeStrategy {
  return new DataAttributeStrategy();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default DataAttributeStrategy;
