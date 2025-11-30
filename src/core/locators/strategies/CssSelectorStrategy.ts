/**
 * CssSelectorStrategy - Locates elements using generated CSS selectors
 * @module core/locators/strategies/CssSelectorStrategy
 * @version 1.0.0
 * 
 * Supplementary strategy with 60% base confidence. Constructs optimized
 * CSS selectors from bundle properties (tag, id, classes, attributes)
 * and validates uniqueness before use.
 * 
 * @see ILocatorStrategy for interface contract
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { ILocatorStrategy, LocatorResult, LocatorContext } from './ILocatorStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';

// Polyfill CSS.escape for jsdom
if (typeof CSS === 'undefined' || !CSS.escape) {
  (globalThis as any).CSS = {
    escape: (value: string) => value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&'),
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Strategy name identifier
 */
export const STRATEGY_NAME = 'css-selector';

/**
 * Strategy priority in fallback chain
 */
export const STRATEGY_PRIORITY = 9;

/**
 * Base confidence score for CSS selector matches (60%)
 */
export const BASE_CONFIDENCE = 0.60;

/**
 * Confidence bonus for unique selector (only one match)
 */
export const UNIQUE_SELECTOR_BONUS = 0.15;

/**
 * Confidence bonus for ID-based selector
 */
export const ID_SELECTOR_BONUS = 0.10;

/**
 * Confidence penalty for multiple matches
 */
export const AMBIGUITY_PENALTY = 0.15;

/**
 * Confidence penalty for class-only selectors
 */
export const CLASS_ONLY_PENALTY = 0.05;

/**
 * Maximum classes to include in selector
 */
export const MAX_CLASSES_IN_SELECTOR = 3;

/**
 * Classes to ignore (dynamic/utility classes)
 */
export const IGNORED_CLASS_PATTERNS = [
  /^hover:/,
  /^focus:/,
  /^active:/,
  /^disabled$/,
  /^hidden$/,
  /^visible$/,
  /^is-/,
  /^has-/,
  /^js-/,
  /^ng-/,           // Angular
  /^v-/,            // Vue
  /^_/,             // CSS modules hash
  /^css-/,          // Emotion
  /^sc-/,           // Styled components
  /^chakra-/,       // Chakra UI
  /^MuiPaper/,      // Material UI
  /^Mui[A-Z]/,      // Material UI
  /^[a-z0-9]{6,}$/, // Random hashes (6+ lowercase alphanumeric)
  /^[A-Z][a-z0-9]{5,}$/, // CamelCase hashes
] as const;

/**
 * Attributes safe to use in selectors
 */
export const SAFE_ATTRIBUTES = [
  'type',
  'name',
  'role',
  'href',
  'src',
  'alt',
  'title',
  'for',
  'value',
  'checked',
  'selected',
  'readonly',
  'required',
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Generated selector with metadata
 */
export interface GeneratedSelector {
  /** CSS selector string */
  selector: string;
  /** Type of selector (id, class, attribute, combined) */
  type: 'id' | 'class' | 'attribute' | 'combined' | 'tag-only';
  /** Specificity score (higher = more specific) */
  specificity: number;
  /** Whether selector is unique in document */
  isUnique: boolean;
  /** Number of matches in document */
  matchCount: number;
}

/**
 * Selector generation options
 */
export interface SelectorOptions {
  /** Include tag name in selector */
  includeTag?: boolean;
  /** Maximum classes to use */
  maxClasses?: number;
  /** Include attributes */
  includeAttributes?: boolean;
  /** Prefer shorter selectors */
  preferShort?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a class name should be ignored
 * 
 * @param className - Class name to check
 * @returns True if class should be ignored
 */
export function shouldIgnoreClass(className: string): boolean {
  if (!className || className.trim() === '') return true;
  
  return IGNORED_CLASS_PATTERNS.some(pattern => pattern.test(className));
}

/**
 * Filters classes to only include stable, meaningful ones
 * 
 * @param classes - Array of class names
 * @returns Filtered array of stable classes
 */
export function filterStableClasses(classes: string[]): string[] {
  if (!classes || classes.length === 0) return [];
  
  return classes
    .filter(c => !shouldIgnoreClass(c))
    .slice(0, MAX_CLASSES_IN_SELECTOR);
}

/**
 * Escapes a string for use in CSS selector
 * 
 * @param value - Value to escape
 * @returns Escaped string
 */
export function escapeCssValue(value: string): string {
  return CSS.escape(value);
}

/**
 * Builds an ID selector
 * 
 * @param id - Element ID
 * @param tag - Optional tag name
 * @returns CSS selector string
 */
export function buildIdSelector(id: string, tag?: string): string {
  const escapedId = escapeCssValue(id);
  return tag ? `${tag.toLowerCase()}#${escapedId}` : `#${escapedId}`;
}

/**
 * Builds a class selector
 * 
 * @param classes - Array of class names
 * @param tag - Optional tag name
 * @returns CSS selector string
 */
export function buildClassSelector(classes: string[], tag?: string): string {
  if (classes.length === 0) return '';
  
  const stableClasses = filterStableClasses(classes);
  if (stableClasses.length === 0) return '';
  
  const classSelector = stableClasses
    .map(c => `.${escapeCssValue(c)}`)
    .join('');
  
  return tag ? `${tag.toLowerCase()}${classSelector}` : classSelector;
}

/**
 * Builds an attribute selector
 * 
 * @param attrName - Attribute name
 * @param attrValue - Attribute value
 * @param tag - Optional tag name
 * @returns CSS selector string
 */
export function buildAttributeSelector(
  attrName: string,
  attrValue: string,
  tag?: string
): string {
  const escapedValue = escapeCssValue(attrValue);
  const attrSelector = `[${attrName}="${escapedValue}"]`;
  
  return tag ? `${tag.toLowerCase()}${attrSelector}` : attrSelector;
}

/**
 * Builds a combined selector from multiple properties
 * 
 * @param bundle - LocatorBundle with element properties
 * @param options - Selector generation options
 * @returns CSS selector string
 */
export function buildCombinedSelector(
  bundle: LocatorBundle,
  options: SelectorOptions = {}
): string {
  const parts: string[] = [];
  const {
    includeTag = true,
    maxClasses = MAX_CLASSES_IN_SELECTOR,
    includeAttributes = true,
  } = options;
  
  // Start with tag
  if (includeTag && bundle.tag) {
    parts.push(bundle.tag.toLowerCase());
  }
  
  // Add ID if available (most specific)
  if (bundle.id) {
    parts.push(`#${escapeCssValue(bundle.id)}`);
    // ID is usually unique enough, return early
    return parts.join('');
  }
  
  // Add classes
  if (bundle.classes && bundle.classes.length > 0) {
    const stableClasses = filterStableClasses(bundle.classes).slice(0, maxClasses);
    for (const className of stableClasses) {
      parts.push(`.${escapeCssValue(className)}`);
    }
  }
  
  // Add name attribute if available
  if (includeAttributes && bundle.name) {
    parts.push(`[name="${escapeCssValue(bundle.name)}"]`);
  }
  
  // Add placeholder if available
  if (includeAttributes && bundle.placeholder) {
    parts.push(`[placeholder="${escapeCssValue(bundle.placeholder)}"]`);
  }
  
  // Add aria-label if available
  if (includeAttributes && bundle.aria) {
    parts.push(`[aria-label="${escapeCssValue(bundle.aria)}"]`);
  }
  
  return parts.join('');
}

/**
 * Calculates specificity score for a selector
 * Based on simplified CSS specificity rules
 * 
 * @param selector - CSS selector string
 * @returns Specificity score
 */
export function calculateSpecificity(selector: string): number {
  let score = 0;
  
  // Count IDs (100 points each)
  const idMatches = selector.match(/#[^.[\s]+/g);
  score += (idMatches?.length || 0) * 100;
  
  // Count classes (10 points each)
  const classMatches = selector.match(/\.[^.[\s#]+/g);
  score += (classMatches?.length || 0) * 10;
  
  // Count attributes (10 points each)
  const attrMatches = selector.match(/\[[^\]]+\]/g);
  score += (attrMatches?.length || 0) * 10;
  
  // Count tags (1 point each)
  const tagMatch = selector.match(/^[a-z]+/i);
  score += tagMatch ? 1 : 0;
  
  return score;
}

/**
 * Tests if a selector is unique in the document
 * 
 * @param selector - CSS selector to test
 * @param doc - Document to search
 * @returns Object with uniqueness info
 */
export function testSelectorUniqueness(
  selector: string,
  doc: Document
): { isUnique: boolean; matchCount: number } {
  try {
    const matches = doc.querySelectorAll(selector);
    return {
      isUnique: matches.length === 1,
      matchCount: matches.length,
    };
  } catch {
    return { isUnique: false, matchCount: 0 };
  }
}

/**
 * Generates multiple selector variants from a bundle
 * 
 * @param bundle - LocatorBundle with element properties
 * @param doc - Document for uniqueness testing
 * @returns Array of generated selectors sorted by quality
 */
export function generateSelectorVariants(
  bundle: LocatorBundle,
  doc: Document
): GeneratedSelector[] {
  const variants: GeneratedSelector[] = [];
  
  // Variant 1: ID-based (if available)
  if (bundle.id) {
    const selector = buildIdSelector(bundle.id, bundle.tag);
    const { isUnique, matchCount } = testSelectorUniqueness(selector, doc);
    variants.push({
      selector,
      type: 'id',
      specificity: calculateSpecificity(selector),
      isUnique,
      matchCount,
    });
  }
  
  // Variant 2: Combined (tag + classes + attributes)
  const combinedSelector = buildCombinedSelector(bundle);
  if (combinedSelector) {
    const { isUnique, matchCount } = testSelectorUniqueness(combinedSelector, doc);
    variants.push({
      selector: combinedSelector,
      type: 'combined',
      specificity: calculateSpecificity(combinedSelector),
      isUnique,
      matchCount,
    });
  }
  
  // Variant 3: Class-based only
  if (bundle.classes && bundle.classes.length > 0) {
    const classSelector = buildClassSelector(bundle.classes, bundle.tag);
    if (classSelector && classSelector !== combinedSelector) {
      const { isUnique, matchCount } = testSelectorUniqueness(classSelector, doc);
      variants.push({
        selector: classSelector,
        type: 'class',
        specificity: calculateSpecificity(classSelector),
        isUnique,
        matchCount,
      });
    }
  }
  
  // Variant 4: Name attribute
  if (bundle.name) {
    const nameSelector = buildAttributeSelector('name', bundle.name, bundle.tag);
    const { isUnique, matchCount } = testSelectorUniqueness(nameSelector, doc);
    variants.push({
      selector: nameSelector,
      type: 'attribute',
      specificity: calculateSpecificity(nameSelector),
      isUnique,
      matchCount,
    });
  }
  
  // Variant 5: Placeholder attribute
  if (bundle.placeholder) {
    const placeholderSelector = buildAttributeSelector(
      'placeholder',
      bundle.placeholder,
      bundle.tag
    );
    const { isUnique, matchCount } = testSelectorUniqueness(placeholderSelector, doc);
    variants.push({
      selector: placeholderSelector,
      type: 'attribute',
      specificity: calculateSpecificity(placeholderSelector),
      isUnique,
      matchCount,
    });
  }
  
  // Variant 6: Tag only (fallback)
  if (bundle.tag) {
    const tagSelector = bundle.tag.toLowerCase();
    const { isUnique, matchCount } = testSelectorUniqueness(tagSelector, doc);
    variants.push({
      selector: tagSelector,
      type: 'tag-only',
      specificity: calculateSpecificity(tagSelector),
      isUnique,
      matchCount,
    });
  }
  
  // Sort by: unique first, then by specificity, then by match count
  variants.sort((a, b) => {
    // Prefer unique selectors
    if (a.isUnique && !b.isUnique) return -1;
    if (!a.isUnique && b.isUnique) return 1;
    
    // Prefer fewer matches
    if (a.matchCount !== b.matchCount) {
      return a.matchCount - b.matchCount;
    }
    
    // Prefer higher specificity
    return b.specificity - a.specificity;
  });
  
  return variants;
}

/**
 * Selects the best selector from variants
 * 
 * @param variants - Array of generated selectors
 * @returns Best selector or null
 */
export function selectBestSelector(
  variants: GeneratedSelector[]
): GeneratedSelector | null {
  if (variants.length === 0) return null;
  
  // Prefer unique selectors
  const uniqueVariant = variants.find(v => v.isUnique);
  if (uniqueVariant) return uniqueVariant;
  
  // Prefer selectors with fewer matches (but at least 1)
  const validVariants = variants.filter(v => v.matchCount > 0);
  if (validVariants.length === 0) return null;
  
  // Return the first (already sorted by quality)
  return validVariants[0];
}

// ============================================================================
// MAIN STRATEGY CLASS
// ============================================================================

/**
 * CssSelectorStrategy implementation
 * 
 * Generates and tests CSS selectors from bundle properties to find elements.
 * Creates multiple selector variants and selects the most specific unique one.
 * 
 * @example
 * ```typescript
 * const strategy = new CssSelectorStrategy();
 * const result = strategy.find(bundle, context);
 * if (result.element) {
 *   console.log(`Found with selector: ${result.metadata.usedSelector}`);
 * }
 * ```
 */
export class CssSelectorStrategy implements ILocatorStrategy {
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
   * @returns True if bundle has properties for selector generation
   */
  canHandle(bundle: LocatorBundle): boolean {
    // Need at least tag, id, classes, or attributes
    if (bundle.id) return true;
    if (bundle.tag) return true;
    if (bundle.classes && bundle.classes.length > 0) {
      const stableClasses = filterStableClasses(bundle.classes);
      if (stableClasses.length > 0) return true;
    }
    if (bundle.name) return true;
    if (bundle.placeholder) return true;
    if (bundle.aria) return true;
    
    return false;
  }
  
  /**
   * Attempts to find an element using generated CSS selectors
   * 
   * @param bundle - LocatorBundle containing properties for selector generation
   * @param context - Locator context with document and options
   * @returns LocatorResult with element (if found) and confidence
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult {
    const startTime = performance.now();
    
    // Validate bundle has usable properties
    if (!this.canHandle(bundle)) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'Bundle has insufficient properties for CSS selector',
      };
    }
    
    const doc = context.document || document;
    
    try {
      // Generate selector variants
      const variants = generateSelectorVariants(bundle, doc);
      
      if (variants.length === 0) {
        return {
          element: null,
          confidence: 0,
          strategy: this.name,
          duration: performance.now() - startTime,
          error: 'Could not generate any valid selectors',
        };
      }
      
      // Select best selector
      const bestVariant = selectBestSelector(variants);
      
      if (!bestVariant || bestVariant.matchCount === 0) {
        return {
          element: null,
          confidence: 0,
          strategy: this.name,
          duration: performance.now() - startTime,
          error: 'No selectors matched any elements',
          metadata: {
            variantsGenerated: variants.length,
            selectors: variants.map(v => v.selector),
          },
        };
      }
      
      // Get the element
      const element = doc.querySelector(bestVariant.selector) as HTMLElement | null;
      
      if (!element) {
        return {
          element: null,
          confidence: 0,
          strategy: this.name,
          duration: performance.now() - startTime,
          error: 'Selector matched but element not found',
        };
      }
      
      // Calculate confidence
      const confidence = this.calculateConfidence(bestVariant);
      
      return {
        element,
        confidence,
        strategy: this.name,
        duration: performance.now() - startTime,
        metadata: {
          usedSelector: bestVariant.selector,
          selectorType: bestVariant.type,
          specificity: bestVariant.specificity,
          isUnique: bestVariant.isUnique,
          matchCount: bestVariant.matchCount,
          variantsGenerated: variants.length,
        },
      };
      
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
   * Calculates confidence score based on selector quality
   * 
   * @param variant - Selected selector variant
   * @returns Confidence score 0-1
   */
  private calculateConfidence(variant: GeneratedSelector): number {
    let confidence = BASE_CONFIDENCE;
    
    // Bonus for unique selector
    if (variant.isUnique) {
      confidence += UNIQUE_SELECTOR_BONUS;
    }
    
    // Bonus for ID-based selector
    if (variant.type === 'id') {
      confidence += ID_SELECTOR_BONUS;
    }
    
    // Penalty for multiple matches
    if (variant.matchCount > 1) {
      const penalty = Math.min(
        AMBIGUITY_PENALTY,
        AMBIGUITY_PENALTY * (variant.matchCount - 1) * 0.5
      );
      confidence -= penalty;
    }
    
    // Penalty for class-only selector
    if (variant.type === 'class') {
      confidence -= CLASS_ONLY_PENALTY;
    }
    
    // Penalty for tag-only selector
    if (variant.type === 'tag-only') {
      confidence -= 0.20;
    }
    
    // Specificity bonus (scaled)
    const specificityBonus = Math.min(0.05, variant.specificity / 1000);
    confidence += specificityBonus;
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Generates the best CSS selector for an element
   * Used during recording to create a selector
   * 
   * @param element - Element to generate selector for
   * @returns Best CSS selector string or null
   */
  generateSelector(element: HTMLElement): string | null {
    // Build a temporary bundle from the element
    const bundle: Partial<LocatorBundle> = {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      name: (element as HTMLInputElement).name || '',
      placeholder: (element as HTMLInputElement).placeholder || '',
      aria: element.getAttribute('aria-label') || '',
      classes: Array.from(element.classList),
    };
    
    const variants = generateSelectorVariants(bundle as LocatorBundle, element.ownerDocument);
    const best = selectBestSelector(variants);
    
    return best?.selector || null;
  }
  
  /**
   * Validates that a selector matches the expected element
   * 
   * @param element - Expected element
   * @param expectedValue - CSS selector to test
   * @returns True if selector uniquely matches element
   */
  validate(element: HTMLElement, expectedValue: string): boolean {
    const targetDoc = element.ownerDocument;
    
    try {
      const found = targetDoc.querySelector(expectedValue);
      return found === element;
    } catch {
      return false;
    }
  }
  
  /**
   * Tests multiple selectors and returns the best one
   * 
   * @param selectors - Array of selectors to test
   * @param doc - Document to search
   * @returns Best selector with metadata
   */
  testSelectors(
    selectors: string[],
    doc: Document
  ): GeneratedSelector | null {
    const results: GeneratedSelector[] = [];
    
    for (const selector of selectors) {
      try {
        const { isUnique, matchCount } = testSelectorUniqueness(selector, doc);
        results.push({
          selector,
          type: 'combined',
          specificity: calculateSpecificity(selector),
          isUnique,
          matchCount,
        });
      } catch {
        // Invalid selector, skip
      }
    }
    
    return selectBestSelector(results);
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of CssSelectorStrategy
 */
let instance: CssSelectorStrategy | null = null;

/**
 * Gets or creates the CssSelectorStrategy singleton
 * 
 * @returns CssSelectorStrategy instance
 */
export function getCssSelectorStrategy(): CssSelectorStrategy {
  if (!instance) {
    instance = new CssSelectorStrategy();
  }
  return instance;
}

/**
 * Creates a new CssSelectorStrategy instance (for testing)
 * 
 * @returns New CssSelectorStrategy instance
 */
export function createCssSelectorStrategy(): CssSelectorStrategy {
  return new CssSelectorStrategy();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default CssSelectorStrategy;
