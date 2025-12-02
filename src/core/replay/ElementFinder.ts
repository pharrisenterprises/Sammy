/**
 * ElementFinder - Multi-Strategy Element Resolution
 * @module core/replay/ElementFinder
 * @version 1.0.0
 * 
 * Resolves LocatorBundle objects to live DOM elements using a 9-tier
 * fallback strategy with confidence scoring and retry logic.
 * 
 * ## Strategy Priority (highest to lowest)
 * 1. XPath (100%) - Absolute path resolution
 * 2. ID + Attributes (90%) - ID with attribute cross-check
 * 3. Name (80%) - Name attribute lookup
 * 4. Aria (75%) - Aria label/labelledby
 * 5. Placeholder (70%) - Placeholder text
 * 6. Data Attributes (65%) - data-testid, data-cy, etc.
 * 7. CSS Selector (60%) - Class-based selector
 * 8. Fuzzy Text (40%) - Text content similarity
 * 9. Bounding Box (variable) - Spatial proximity
 * 
 * @example
 * ```typescript
 * const finder = new ElementFinder();
 * const result = await finder.find(bundle, document);
 * 
 * if (result.element) {
 *   console.log('Found with', result.strategy, result.confidence);
 * }
 * ```
 */

import type { LocatorBundle } from '../types/locator-bundle';
import type { LocatorConfig } from './ReplayConfig';
import { DEFAULT_LOCATOR_CONFIG } from './ReplayConfig';

// ============================================================================
// POLYFILLS
// ============================================================================

/**
 * CSS.escape polyfill for environments that don't support it (like JSDOM)
 */
if (typeof CSS === 'undefined' || !CSS.escape) {
  (globalThis as any).CSS = {
    escape: (value: string) => {
      return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    },
  };
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Strategy name
 */
export type FinderStrategyName =
  | 'xpath'
  | 'id'
  | 'name'
  | 'aria'
  | 'placeholder'
  | 'dataAttributes'
  | 'css'
  | 'fuzzyText'
  | 'boundingBox';

/**
 * Strategy confidence levels
 */
export const STRATEGY_CONFIDENCE: Record<FinderStrategyName, number> = {
  xpath: 1.0,
  id: 0.9,
  name: 0.8,
  aria: 0.75,
  placeholder: 0.7,
  dataAttributes: 0.65,
  css: 0.6,
  fuzzyText: 0.4,
  boundingBox: 0.3,
};

/**
 * Default strategy priority order
 */
export const DEFAULT_STRATEGY_ORDER: FinderStrategyName[] = [
  'xpath',
  'id',
  'name',
  'aria',
  'placeholder',
  'dataAttributes',
  'css',
  'fuzzyText',
  'boundingBox',
];

/**
 * Find result
 */
export interface FindResult {
  /** Found element or null */
  element: Element | null;
  
  /** Strategy that found the element */
  strategy: FinderStrategyName | null;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Time taken to find in ms */
  duration: number;
  
  /** Number of retry attempts */
  retryAttempts: number;
  
  /** Strategies that were attempted */
  attemptedStrategies: FinderStrategyName[];
  
  /** Error message if failed */
  error?: string;
}

/**
 * Find options
 */
export interface FindOptions {
  /** Timeout in milliseconds (default: 2000) */
  timeout?: number;
  
  /** Retry interval in milliseconds (default: 150) */
  retryInterval?: number;
  
  /** Maximum retry attempts (default: 13) */
  maxRetries?: number;
  
  /** Fuzzy match threshold (default: 0.4) */
  fuzzyThreshold?: number;
  
  /** Bounding box proximity threshold in pixels (default: 200) */
  boundingBoxThreshold?: number;
  
  /** Strategies to skip */
  disabledStrategies?: FinderStrategyName[];
  
  /** Custom strategy order */
  strategyOrder?: FinderStrategyName[];
  
  /** Minimum confidence to accept (default: 0) */
  minConfidence?: number;
  
  /** Whether to check element visibility (default: true) */
  requireVisible?: boolean;
  
  /** Shadow root to search within */
  shadowRoot?: ShadowRoot;
  
  /** Iframe document to search within */
  iframeDocument?: Document;
}

/**
 * Default find options
 */
export const DEFAULT_FIND_OPTIONS: Required<Omit<FindOptions, 'shadowRoot' | 'iframeDocument'>> = {
  timeout: 2000,
  retryInterval: 150,
  maxRetries: 13,
  fuzzyThreshold: 0.4,
  boundingBoxThreshold: 200,
  disabledStrategies: [],
  strategyOrder: DEFAULT_STRATEGY_ORDER,
  minConfidence: 0,
  requireVisible: true,
};

/**
 * Strategy function type
 */
type StrategyFunction = (
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  options: FindOptions
) => Element | null;

// ============================================================================
// VISIBILITY HELPERS
// ============================================================================

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true; // Non-HTML elements (SVG, etc.) assumed visible
  }
  
  const style = window.getComputedStyle(element);
  
  // Check display
  if (style.display === 'none') {
    return false;
  }
  
  // Check visibility
  if (style.visibility === 'hidden') {
    return false;
  }
  
  // Check opacity
  if (parseFloat(style.opacity) === 0) {
    return false;
  }
  
  // Check dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  
  return true;
}

/**
 * Check if element is in viewport
 */
export function isElementInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// ============================================================================
// STRING SIMILARITY (Dice Coefficient)
// ============================================================================

/**
 * Calculate Dice coefficient similarity between two strings
 * Used for fuzzy text matching
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }
  
  // Normalize strings
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) {
    return 1;
  }
  
  if (s1.length < 2 || s2.length < 2) {
    return 0;
  }
  
  // Get bigrams
  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);
  
  // Calculate intersection
  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersection++;
    }
  }
  
  // Dice coefficient
  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

// ============================================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================================

/**
 * Strategy: XPath resolution
 */
function findByXPath(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  if (!bundle.xpath) {
    return null;
  }
  
  try {
    // Get the document for evaluation
    const evalDoc = doc instanceof ShadowRoot ? doc.ownerDocument : doc;
    const contextNode = doc instanceof ShadowRoot ? doc : doc;
    
    const result = evalDoc.evaluate(
      bundle.xpath,
      contextNode,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    
    return result.singleNodeValue as Element | null;
  } catch {
    // XPath evaluation failed
    return null;
  }
}

/**
 * Strategy: ID + attribute cross-check
 */
function findById(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  if (!bundle.id) {
    return null;
  }
  
  // Direct ID lookup
  const element = doc instanceof ShadowRoot
    ? doc.getElementById?.(bundle.id) ?? doc.querySelector(`#${CSS.escape(bundle.id)}`)
    : doc.getElementById(bundle.id);
  
  if (!element) {
    return null;
  }
  
  // Cross-check attributes for confidence
  let score = 1; // Found by ID
  
  if (bundle.name && element.getAttribute('name') === bundle.name) {
    score++;
  }
  
  if (bundle.tag && element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
    score++;
  }
  
  // Require at least ID match plus one other attribute
  return score >= 1 ? element : null;
}

/**
 * Strategy: Name attribute
 */
function findByName(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  if (!bundle.name) {
    return null;
  }
  
  const elements = doc.querySelectorAll(`[name="${CSS.escape(bundle.name)}"]`);
  
  // Return first match
  return elements[0] || null;
}

/**
 * Strategy: Aria labels
 */
function findByAria(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  if (!bundle.aria) {
    return null;
  }
  
  // Try aria-label
  let element = doc.querySelector(`[aria-label="${CSS.escape(bundle.aria)}"]`);
  if (element) {
    return element;
  }
  
  // Try aria-labelledby
  element = doc.querySelector(`[aria-labelledby="${CSS.escape(bundle.aria)}"]`);
  if (element) {
    return element;
  }
  
  // Try aria-describedby
  element = doc.querySelector(`[aria-describedby="${CSS.escape(bundle.aria)}"]`);
  if (element) {
    return element;
  }
  
  return null;
}

/**
 * Strategy: Placeholder
 */
function findByPlaceholder(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  if (!bundle.placeholder) {
    return null;
  }
  
  const element = doc.querySelector(
    `[placeholder="${CSS.escape(bundle.placeholder)}"]`
  );
  
  return element || null;
}

/**
 * Strategy: Data attributes
 */
function findByDataAttributes(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  if (!bundle.dataAttrs || Object.keys(bundle.dataAttrs).length === 0) {
    return null;
  }
  
  // Priority order for data attributes
  const priorityAttrs = ['testid', 'test-id', 'cy', 'automation-id', 'id'];
  
  for (const attr of priorityAttrs) {
    const value = bundle.dataAttrs[attr];
    if (value) {
      const element = doc.querySelector(`[data-${attr}="${CSS.escape(value)}"]`);
      if (element) {
        return element;
      }
    }
  }
  
  // Try all other data attributes
  for (const [key, value] of Object.entries(bundle.dataAttrs)) {
    if (!priorityAttrs.includes(key)) {
      const element = doc.querySelector(`[data-${key}="${CSS.escape(value)}"]`);
      if (element) {
        return element;
      }
    }
  }
  
  return null;
}

/**
 * Strategy: CSS selector (class-based)
 */
function findByCss(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  _options: FindOptions
): Element | null {
  // Build selector from tag and classes
  if (!bundle.tag) {
    return null;
  }
  
  let selector = bundle.tag.toLowerCase();
  
  // Add classes if available
  if (bundle.classes && bundle.classes.length > 0) {
    // Use first few stable-looking classes
    const stableClasses = bundle.classes
      .filter(c => !c.match(/^(css-|sc-|jsx-|_)/)) // Filter generated class names
      .slice(0, 3);
    
    if (stableClasses.length > 0) {
      selector += '.' + stableClasses.map(c => CSS.escape(c)).join('.');
    }
  }
  
  // Add ID if available (but not as primary - that's the ID strategy)
  if (bundle.id && !selector.includes('#')) {
    // Don't add ID here, ID strategy handles it
  }
  
  try {
    const element = doc.querySelector(selector);
    return element || null;
  } catch {
    return null;
  }
}

/**
 * Strategy: Fuzzy text match
 */
function findByFuzzyText(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  options: FindOptions
): Element | null {
  const targetText = bundle.text;
  if (!targetText || targetText.trim().length === 0) {
    return null;
  }
  
  const threshold = options.fuzzyThreshold ?? DEFAULT_FIND_OPTIONS.fuzzyThreshold;
  const tag = bundle.tag?.toLowerCase() || '*';
  
  // Get all elements with matching tag
  const elements = doc.querySelectorAll(tag);
  
  let bestMatch: Element | null = null;
  let bestScore = 0;
  
  for (const element of elements) {
    // Get element text content
    const elementText = element.textContent?.trim() || '';
    if (!elementText) {
      continue;
    }
    
    // Calculate similarity
    const score = calculateSimilarity(targetText, elementText);
    
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = element;
    }
  }
  
  return bestMatch;
}

/**
 * Strategy: Bounding box proximity
 */
function findByBoundingBox(
  bundle: LocatorBundle,
  doc: Document | ShadowRoot,
  options: FindOptions
): Element | null {
  if (!bundle.bounding) {
    return null;
  }
  
  const threshold = options.boundingBoxThreshold ?? DEFAULT_FIND_OPTIONS.boundingBoxThreshold;
  const tag = bundle.tag?.toLowerCase() || '*';
  
  // Target center point
  const targetX = bundle.bounding.x + (bundle.bounding.width / 2);
  const targetY = bundle.bounding.y + (bundle.bounding.height / 2);
  
  const elements = doc.querySelectorAll(tag);
  
  let closestElement: Element | null = null;
  let closestDistance = Infinity;
  
  for (const element of elements) {
    if (!isElementVisible(element)) {
      continue;
    }
    
    const rect = element.getBoundingClientRect();
    const centerX = rect.x + (rect.width / 2);
    const centerY = rect.y + (rect.height / 2);
    
    // Euclidean distance
    const distance = Math.sqrt(
      Math.pow(centerX - targetX, 2) + Math.pow(centerY - targetY, 2)
    );
    
    if (distance < closestDistance && distance <= threshold) {
      closestDistance = distance;
      closestElement = element;
    }
  }
  
  return closestElement;
}

// ============================================================================
// STRATEGY MAP
// ============================================================================

const STRATEGY_FUNCTIONS: Record<FinderStrategyName, StrategyFunction> = {
  xpath: findByXPath,
  id: findById,
  name: findByName,
  aria: findByAria,
  placeholder: findByPlaceholder,
  dataAttributes: findByDataAttributes,
  css: findByCss,
  fuzzyText: findByFuzzyText,
  boundingBox: findByBoundingBox,
};

// ============================================================================
// ELEMENT FINDER CLASS
// ============================================================================

/**
 * Multi-strategy element finder
 */
export class ElementFinder {
  private defaultOptions: FindOptions;
  
  constructor(options?: Partial<FindOptions>) {
    this.defaultOptions = { ...DEFAULT_FIND_OPTIONS, ...options };
  }
  
  /**
   * Find element using 9-tier fallback strategy
   */
  async find(
    bundle: LocatorBundle,
    doc: Document = document,
    options?: FindOptions
  ): Promise<FindResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const attemptedStrategies: FinderStrategyName[] = [];
    
    // Determine document to search
    const searchDoc = opts.shadowRoot || opts.iframeDocument || doc;
    
    // Get strategy order
    const strategyOrder = opts.strategyOrder || DEFAULT_STRATEGY_ORDER;
    const disabledStrategies = new Set(opts.disabledStrategies || []);
    
    let retryAttempts = 0;
    const maxRetries = opts.maxRetries ?? DEFAULT_FIND_OPTIONS.maxRetries;
    const retryInterval = opts.retryInterval ?? DEFAULT_FIND_OPTIONS.retryInterval;
    const timeout = opts.timeout ?? DEFAULT_FIND_OPTIONS.timeout;
    
    // Retry loop
    while (Date.now() - startTime < timeout) {
      // Try each strategy
      for (const strategyName of strategyOrder) {
        if (disabledStrategies.has(strategyName)) {
          continue;
        }
        
        if (!attemptedStrategies.includes(strategyName)) {
          attemptedStrategies.push(strategyName);
        }
        
        const strategyFn = STRATEGY_FUNCTIONS[strategyName];
        if (!strategyFn) {
          continue;
        }
        
        try {
          const element = strategyFn(bundle, searchDoc, opts);
          
          if (element) {
            // Check visibility if required
            if (opts.requireVisible && !isElementVisible(element)) {
              continue;
            }
            
            const confidence = STRATEGY_CONFIDENCE[strategyName];
            
            // Check minimum confidence
            if (opts.minConfidence && confidence < opts.minConfidence) {
              continue;
            }
            
            return {
              element,
              strategy: strategyName,
              confidence,
              duration: Date.now() - startTime,
              retryAttempts,
              attemptedStrategies,
            };
          }
        } catch (error) {
          // Strategy failed, continue to next
          console.debug(`Strategy ${strategyName} failed:`, error);
        }
      }
      
      // All strategies failed, retry after interval
      if (Date.now() - startTime + retryInterval < timeout) {
        await this.sleep(retryInterval);
        retryAttempts++;
        
        if (retryAttempts >= maxRetries) {
          break;
        }
      } else {
        break;
      }
    }
    
    // All strategies failed
    return {
      element: null,
      strategy: null,
      confidence: 0,
      duration: Date.now() - startTime,
      retryAttempts,
      attemptedStrategies,
      error: `Element not found after ${retryAttempts} retries and ${attemptedStrategies.length} strategies`,
    };
  }
  
  /**
   * Find element synchronously (no retry)
   */
  findSync(
    bundle: LocatorBundle,
    doc: Document = document,
    options?: FindOptions
  ): FindResult {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const attemptedStrategies: FinderStrategyName[] = [];
    
    const searchDoc = opts.shadowRoot || opts.iframeDocument || doc;
    const strategyOrder = opts.strategyOrder || DEFAULT_STRATEGY_ORDER;
    const disabledStrategies = new Set(opts.disabledStrategies || []);
    
    for (const strategyName of strategyOrder) {
      if (disabledStrategies.has(strategyName)) {
        continue;
      }
      
      attemptedStrategies.push(strategyName);
      
      const strategyFn = STRATEGY_FUNCTIONS[strategyName];
      if (!strategyFn) {
        continue;
      }
      
      try {
        const element = strategyFn(bundle, searchDoc, opts);
        
        if (element) {
          if (opts.requireVisible && !isElementVisible(element)) {
            continue;
          }
          
          const confidence = STRATEGY_CONFIDENCE[strategyName];
          
          if (opts.minConfidence && confidence < opts.minConfidence) {
            continue;
          }
          
          return {
            element,
            strategy: strategyName,
            confidence,
            duration: Date.now() - startTime,
            retryAttempts: 0,
            attemptedStrategies,
          };
        }
      } catch {
        // Continue to next strategy
      }
    }
    
    return {
      element: null,
      strategy: null,
      confidence: 0,
      duration: Date.now() - startTime,
      retryAttempts: 0,
      attemptedStrategies,
      error: 'Element not found',
    };
  }
  
  /**
   * Find element by specific strategy
   */
  findByStrategy(
    strategy: FinderStrategyName,
    bundle: LocatorBundle,
    doc: Document = document,
    options?: FindOptions
  ): Element | null {
    const opts = { ...this.defaultOptions, ...options };
    const searchDoc = opts.shadowRoot || opts.iframeDocument || doc;
    
    const strategyFn = STRATEGY_FUNCTIONS[strategy];
    if (!strategyFn) {
      return null;
    }
    
    try {
      const element = strategyFn(bundle, searchDoc, opts);
      
      if (element && opts.requireVisible && !isElementVisible(element)) {
        return null;
      }
      
      return element;
    } catch {
      return null;
    }
  }
  
  /**
   * Test all strategies and return results
   */
  testAllStrategies(
    bundle: LocatorBundle,
    doc: Document = document,
    options?: FindOptions
  ): Map<FinderStrategyName, Element | null> {
    const opts = { ...this.defaultOptions, ...options };
    const searchDoc = opts.shadowRoot || opts.iframeDocument || doc;
    const results = new Map<FinderStrategyName, Element | null>();
    
    for (const [name, fn] of Object.entries(STRATEGY_FUNCTIONS)) {
      try {
        const element = fn(bundle, searchDoc, opts);
        results.set(name as FinderStrategyName, element);
      } catch {
        results.set(name as FinderStrategyName, null);
      }
    }
    
    return results;
  }
  
  /**
   * Get default options
   */
  getOptions(): FindOptions {
    return { ...this.defaultOptions };
  }
  
  /**
   * Update options
   */
  setOptions(options: Partial<FindOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new ElementFinder
 */
export function createElementFinder(options?: Partial<FindOptions>): ElementFinder {
  return new ElementFinder(options);
}

/**
 * Create a fast finder (short timeout, fewer retries)
 */
export function createFastFinder(): ElementFinder {
  return new ElementFinder({
    timeout: 500,
    maxRetries: 3,
    retryInterval: 50,
  });
}

/**
 * Create a tolerant finder (longer timeout, relaxed thresholds)
 */
export function createTolerantFinder(): ElementFinder {
  return new ElementFinder({
    timeout: 5000,
    maxRetries: 30,
    fuzzyThreshold: 0.3,
    boundingBoxThreshold: 300,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultFinder: ElementFinder | null = null;

/**
 * Get the default ElementFinder instance
 */
export function getElementFinder(): ElementFinder {
  if (!defaultFinder) {
    defaultFinder = new ElementFinder();
  }
  return defaultFinder;
}

/**
 * Reset the default ElementFinder
 */
export function resetElementFinder(): void {
  defaultFinder = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Find element with default finder
 */
export async function findElement(
  bundle: LocatorBundle,
  doc?: Document,
  options?: FindOptions
): Promise<FindResult> {
  return getElementFinder().find(bundle, doc, options);
}

/**
 * Find element synchronously with default finder
 */
export function findElementSync(
  bundle: LocatorBundle,
  doc?: Document,
  options?: FindOptions
): FindResult {
  return getElementFinder().findSync(bundle, doc, options);
}
