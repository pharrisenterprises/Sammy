/**
 * PlaceholderStrategy - Locates elements by placeholder attribute
 * @module core/locators/strategies/PlaceholderStrategy
 * @version 1.0.0
 * 
 * Tier 5 in the 9-tier fallback chain with 70% confidence.
 * Primarily targets input and textarea elements that use placeholder text
 * as their primary identifier.
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
export const STRATEGY_NAME = 'placeholder';

/**
 * Strategy priority in fallback chain (lower = higher priority)
 * Tier 5: After ARIA (tier 4), before Data Attributes (tier 6)
 */
export const STRATEGY_PRIORITY = 5;

/**
 * Base confidence score for placeholder matches (70%)
 * Placeholder text is moderately stable but can change with i18n
 */
export const BASE_CONFIDENCE = 0.70;

/**
 * Confidence penalty for partial matches
 */
export const PARTIAL_MATCH_PENALTY = 0.15;

/**
 * Confidence penalty when multiple elements share same placeholder
 */
export const AMBIGUITY_PENALTY = 0.20;

/**
 * Elements that support placeholder attribute
 */
export const PLACEHOLDER_ELEMENTS = ['input', 'textarea'] as const;

/**
 * Input types that commonly use placeholder
 */
export const PLACEHOLDER_INPUT_TYPES = [
  'text',
  'email',
  'password',
  'search',
  'tel',
  'url',
  'number',
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes placeholder text for comparison
 * - Trims whitespace
 * - Converts to lowercase
 * - Normalizes Unicode characters
 * 
 * @param text - Raw placeholder text
 * @returns Normalized text for comparison
 */
export function normalizePlaceholder(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFKC');
}

/**
 * Checks if an element supports placeholder attribute
 * 
 * @param element - DOM element to check
 * @returns True if element can have placeholder
 */
export function supportsPlaceholder(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'textarea') {
    return true;
  }
  
  if (tagName === 'input') {
    const inputType = (element as HTMLInputElement).type?.toLowerCase() || 'text';
    return PLACEHOLDER_INPUT_TYPES.includes(inputType as typeof PLACEHOLDER_INPUT_TYPES[number]);
  }
  
  return false;
}

/**
 * Extracts placeholder value from an element
 * 
 * @param element - DOM element
 * @returns Placeholder text or null
 */
export function getPlaceholder(element: Element): string | null {
  if (!supportsPlaceholder(element)) {
    return null;
  }
  
  const placeholder = (element as HTMLInputElement | HTMLTextAreaElement).placeholder;
  return placeholder || null;
}

/**
 * Builds a CSS selector for placeholder matching
 * 
 * @param placeholder - Placeholder text to match
 * @param tagName - Optional tag name constraint
 * @returns CSS selector string
 */
export function buildPlaceholderSelector(
  placeholder: string,
  tagName?: string
): string {
  const escapedPlaceholder = CSS.escape(placeholder);
  const tag = tagName?.toLowerCase() || '';
  
  if (tag && PLACEHOLDER_ELEMENTS.includes(tag as typeof PLACEHOLDER_ELEMENTS[number])) {
    return `${tag}[placeholder="${escapedPlaceholder}"]`;
  }
  
  // Query both input and textarea
  return `input[placeholder="${escapedPlaceholder}"], textarea[placeholder="${escapedPlaceholder}"]`;
}

/**
 * Calculates similarity between two placeholder strings
 * Uses normalized comparison with partial match support
 * 
 * @param a - First placeholder
 * @param b - Second placeholder
 * @returns Similarity score 0-1
 */
export function placeholderSimilarity(a: string, b: string): number {
  const normalA = normalizePlaceholder(a);
  const normalB = normalizePlaceholder(b);
  
  if (!normalA || !normalB) return 0;
  if (normalA === normalB) return 1;
  
  // Check if one contains the other (partial match)
  if (normalA.includes(normalB) || normalB.includes(normalA)) {
    const shorter = normalA.length < normalB.length ? normalA : normalB;
    const longer = normalA.length >= normalB.length ? normalA : normalB;
    return shorter.length / longer.length;
  }
  
  return 0;
}

// ============================================================================
// MAIN STRATEGY CLASS
// ============================================================================

/**
 * PlaceholderStrategy implementation
 * 
 * Locates elements by matching their placeholder attribute against
 * the recorded placeholder in the LocatorBundle.
 * 
 * @example
 * ```typescript
 * const strategy = new PlaceholderStrategy();
 * const result = strategy.find(bundle, document);
 * if (result.element) {
 *   console.log(`Found with ${result.confidence} confidence`);
 * }
 * ```
 */
export class PlaceholderStrategy implements ILocatorStrategy {
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
   * @returns True if bundle has placeholder data
   */
  canHandle(bundle: LocatorBundle): boolean {
    return Boolean(bundle.placeholder && bundle.placeholder.trim().length > 0);
  }
  
  /**
   * Attempts to find an element matching the bundle's placeholder
   * 
   * @param bundle - LocatorBundle containing placeholder to match
   * @param context - Locator context with document and options
   * @returns LocatorResult with element (if found) and confidence
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult {
    const startTime = performance.now();
    
    // Validate bundle has placeholder
    if (!this.canHandle(bundle)) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'Bundle has no placeholder attribute',
      };
    }
    
    const targetPlaceholder = bundle.placeholder!;
    const doc = context.document || document;
    
    try {
      // Build selector and query
      const selector = buildPlaceholderSelector(targetPlaceholder, bundle.tag);
      const candidates = Array.from(doc.querySelectorAll(selector));
      
      if (candidates.length === 0) {
        // Try normalized/partial match as fallback
        return this.findByPartialMatch(bundle, doc, startTime);
      }
      
      if (candidates.length === 1) {
        // Single match - high confidence
        const element = candidates[0] as HTMLElement;
        return {
          element,
          confidence: this.calculateConfidence(element, bundle, 1),
          strategy: this.name,
          duration: performance.now() - startTime,
        };
      }
      
      // Multiple matches - need disambiguation
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
   * Attempts partial placeholder matching when exact match fails
   * 
   * @param bundle - LocatorBundle with target placeholder
   * @param doc - Document to search
   * @param startTime - Performance timing start
   * @returns LocatorResult from partial matching
   */
  private findByPartialMatch(
    bundle: LocatorBundle,
    doc: Document,
    startTime: number
  ): LocatorResult {
    const targetPlaceholder = normalizePlaceholder(bundle.placeholder);
    
    // Query all elements with any placeholder
    const allWithPlaceholder = doc.querySelectorAll(
      'input[placeholder], textarea[placeholder]'
    );
    
    let bestMatch: HTMLElement | null = null;
    let bestSimilarity = 0;
    
    for (const element of allWithPlaceholder) {
      const elementPlaceholder = getPlaceholder(element);
      if (!elementPlaceholder) continue;
      
      const similarity = placeholderSimilarity(targetPlaceholder, elementPlaceholder);
      
      if (similarity > bestSimilarity && similarity >= 0.5) {
        bestSimilarity = similarity;
        bestMatch = element as HTMLElement;
      }
    }
    
    if (bestMatch) {
      const confidence = BASE_CONFIDENCE * bestSimilarity - PARTIAL_MATCH_PENALTY;
      return {
        element: bestMatch,
        confidence: Math.max(0, confidence),
        strategy: this.name,
        duration: performance.now() - startTime,
        metadata: {
          matchType: 'partial',
          similarity: bestSimilarity,
        },
      };
    }
    
    return {
      element: null,
      confidence: 0,
      strategy: this.name,
      duration: performance.now() - startTime,
      error: 'No matching placeholder found',
    };
  }
  
  /**
   * Disambiguates between multiple elements with same placeholder
   * Uses additional bundle properties (tag, bounding box) to narrow down
   * 
   * @param candidates - Elements with matching placeholder
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
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    const runnerUp = scored[1];
    
    // Check if best is clearly better than runner-up
    const scoreDifference = best.score - (runnerUp?.score || 0);
    const isConfident = scoreDifference > 0.2 || candidates.length === 1;
    
    const confidence = isConfident
      ? this.calculateConfidence(best.element, bundle, candidates.length)
      : this.calculateConfidence(best.element, bundle, candidates.length) - AMBIGUITY_PENALTY;
    
    return {
      element: best.element,
      confidence: Math.max(0, confidence),
      strategy: this.name,
      duration: performance.now() - startTime,
      metadata: {
        candidateCount: candidates.length,
        bestScore: best.score,
        isAmbiguous: !isConfident,
      },
    };
  }
  
  /**
   * Scores a candidate element against the bundle
   * Uses multiple factors: tag match, bounding box proximity, attributes
   * 
   * @param element - Candidate element
   * @param bundle - Original LocatorBundle
   * @returns Score 0-1
   */
  private scoreCandidate(element: HTMLElement, bundle: LocatorBundle): number {
    let score = 0.5; // Base score for placeholder match
    
    // Tag match bonus
    if (bundle.tag && element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      score += 0.15;
    }
    
    // ID match bonus (if present)
    if (bundle.id && element.id === bundle.id) {
      score += 0.2;
    }
    
    // Name match bonus
    if (bundle.name && (element as HTMLInputElement).name === bundle.name) {
      score += 0.1;
    }
    
    // Bounding box proximity bonus
    if (bundle.bounding) {
      const rect = element.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(rect.x - bundle.bounding.x, 2) +
        Math.pow(rect.y - bundle.bounding.y, 2)
      );
      
      // Within 50px = full bonus, degrades with distance
      if (distance < 50) {
        score += 0.15;
      } else if (distance < 100) {
        score += 0.1;
      } else if (distance < 200) {
        score += 0.05;
      }
    }
    
    // Class overlap bonus
    if (bundle.classes && bundle.classes.length > 0) {
      const elementClasses = Array.from(element.classList);
      const overlap = bundle.classes.filter(c => elementClasses.includes(c)).length;
      const overlapRatio = overlap / bundle.classes.length;
      score += overlapRatio * 0.1;
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Calculates final confidence score
   * 
   * @param element - Found element
   * @param bundle - Original bundle
   * @param candidateCount - Number of matching elements found
   * @returns Confidence score 0-1
   */
  private calculateConfidence(
    element: HTMLElement,
    bundle: LocatorBundle,
    candidateCount: number
  ): number {
    let confidence = BASE_CONFIDENCE;
    
    // Reduce confidence for multiple matches
    if (candidateCount > 1) {
      confidence -= AMBIGUITY_PENALTY * Math.min(candidateCount - 1, 3) * 0.33;
    }
    
    // Verify placeholder still matches exactly
    const currentPlaceholder = getPlaceholder(element);
    if (currentPlaceholder !== bundle.placeholder) {
      confidence -= PARTIAL_MATCH_PENALTY;
    }
    
    // Bonus for matching tag
    if (bundle.tag && element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      confidence += 0.05;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Generates a placeholder-based selector for an element
   * Used during recording to create the bundle
   * 
   * @param element - Element to generate selector for
   * @returns CSS selector string or null
   */
  generateSelector(element: HTMLElement): string | null {
    const placeholder = getPlaceholder(element);
    if (!placeholder) return null;
    
    return buildPlaceholderSelector(placeholder, element.tagName);
  }
  
  /**
   * Validates that an element matches expected placeholder
   * 
   * @param element - Element to validate
   * @param expectedPlaceholder - Expected placeholder text
   * @returns True if placeholder matches
   */
  validate(element: HTMLElement, expectedPlaceholder: string): boolean {
    const actualPlaceholder = getPlaceholder(element);
    if (!actualPlaceholder) return false;
    
    return normalizePlaceholder(actualPlaceholder) === normalizePlaceholder(expectedPlaceholder);
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of PlaceholderStrategy
 */
let instance: PlaceholderStrategy | null = null;

/**
 * Gets or creates the PlaceholderStrategy singleton
 * 
 * @returns PlaceholderStrategy instance
 */
export function getPlaceholderStrategy(): PlaceholderStrategy {
  if (!instance) {
    instance = new PlaceholderStrategy();
  }
  return instance;
}

/**
 * Creates a new PlaceholderStrategy instance (for testing)
 * 
 * @returns New PlaceholderStrategy instance
 */
export function createPlaceholderStrategy(): PlaceholderStrategy {
  return new PlaceholderStrategy();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default PlaceholderStrategy;
