/**
 * @fileoverview Locator utility functions for element location
 * @module core/locators/locator-utils
 * @version 1.0.0
 * 
 * This module provides utility functions for the 9-tier element location
 * fallback strategy used during test replay.
 * 
 * 9-TIER FALLBACK STRATEGY (in priority order):
 * 1. XPath (100% confidence) - Most reliable
 * 2. ID (90%) - Unique identifier
 * 3. Name (80%) - Form element name
 * 4. Aria (75%) - Accessibility label
 * 5. Placeholder (70%) - Input placeholder
 * 6. Data Attributes (65%) - Custom data-* attrs
 * 7. Fuzzy Text (50%) - Text content matching
 * 8. Bounding Box (30%) - Position-based fallback
 * 9. Retry (10%) - Final attempt with timeout
 * 
 * @see PHASE_4_SPECIFICATIONS.md for locator specifications
 * @see locator-strategy_breakdown.md for strategy details
 */

import type {
  LocatorBundle,
  BoundingBox
} from '../types';

import {
  ELEMENT_TIMEOUT_MS,
  RETRY_INTERVAL_MS,
  BOUNDING_BOX_RADIUS_PX,
  FUZZY_TEXT_THRESHOLD,
  hasXPath,
  hasId,
  hasName,
  hasAria,
  hasPlaceholder,
  hasDataAttrs,
  hasText,
  hasBounding,
  getBoundingCenter
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of an element location attempt
 */
export interface LocateResult {
  /** Whether element was found */
  found: boolean;
  /** The located element (null if not found) */
  element: Element | null;
  /** Strategy that succeeded (null if not found) */
  strategy: string | null;
  /** Confidence level (0-100) */
  confidence: number;
  /** Time taken in ms */
  duration: number;
  /** Strategies attempted */
  attempts: StrategyAttempt[];
  /** Error message if failed */
  error?: string;
}

/**
 * Single strategy attempt result
 */
export interface StrategyAttempt {
  /** Strategy name */
  strategy: string;
  /** Whether this strategy succeeded */
  success: boolean;
  /** Time taken for this attempt */
  duration: number;
  /** Error if failed */
  error?: string;
}

/**
 * Strategy function signature
 */
export type StrategyFunction = (
  bundle: LocatorBundle,
  document: Document
) => Element | null;

/**
 * Strategy definition
 */
export interface StrategyDefinition {
  /** Strategy name */
  name: string;
  /** Tier number (1-9) */
  tier: number;
  /** Base confidence (0-100) */
  confidence: number;
  /** Check if strategy is available for bundle */
  isAvailable: (bundle: LocatorBundle) => boolean;
  /** Execute strategy to find element */
  execute: StrategyFunction;
}

// ============================================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================================

/**
 * Strategy 1: XPath (Tier 1, 100% confidence)
 * 
 * Most reliable strategy - uses recorded XPath expression.
 */
export function locateByXPath(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.xpath || bundle.xpath.length === 0) {
    return null;
  }

  try {
    const result = doc.evaluate(
      bundle.xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}

/**
 * Strategy 2: ID (Tier 2, 90% confidence)
 * 
 * Uses element ID attribute - should be unique per page.
 */
export function locateById(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.id || bundle.id.length === 0) {
    return null;
  }

  return doc.getElementById(bundle.id);
}

/**
 * Strategy 3: Name (Tier 3, 80% confidence)
 * 
 * Uses form element name attribute.
 */
export function locateByName(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.name || bundle.name.length === 0) {
    return null;
  }

  const elements = doc.getElementsByName(bundle.name);
  if (elements.length === 0) {
    return null;
  }

  // If tag is specified, filter by tag
  if (bundle.tag) {
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].tagName.toLowerCase() === bundle.tag.toLowerCase()) {
        return elements[i];
      }
    }
  }

  return elements[0];
}

/**
 * Strategy 4: Aria (Tier 4, 75% confidence)
 * 
 * Uses aria-label attribute for accessibility.
 */
export function locateByAria(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.aria || bundle.aria.length === 0) {
    return null;
  }

  // Try exact match first
  let selector = `[aria-label="${escapeSelector(bundle.aria)}"]`;
  if (bundle.tag) {
    selector = `${bundle.tag}${selector}`;
  }

  let element = doc.querySelector(selector);
  if (element) {
    return element;
  }

  // Try aria-labelledby
  const labelledByElements = doc.querySelectorAll('[aria-labelledby]');
  for (let i = 0; i < labelledByElements.length; i++) {
    const el = labelledByElements[i];
    const labelId = el.getAttribute('aria-labelledby');
    if (labelId) {
      const labelEl = doc.getElementById(labelId);
      if (labelEl && labelEl.textContent?.includes(bundle.aria)) {
        return el;
      }
    }
  }

  return null;
}

/**
 * Strategy 5: Placeholder (Tier 5, 70% confidence)
 * 
 * Uses input placeholder attribute.
 */
export function locateByPlaceholder(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.placeholder || bundle.placeholder.length === 0) {
    return null;
  }

  let selector = `[placeholder="${escapeSelector(bundle.placeholder)}"]`;
  if (bundle.tag) {
    selector = `${bundle.tag}${selector}`;
  }

  return doc.querySelector(selector);
}

/**
 * Strategy 6: Data Attributes (Tier 6, 65% confidence)
 * 
 * Uses custom data-* attributes.
 */
export function locateByDataAttrs(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.dataAttrs || Object.keys(bundle.dataAttrs).length === 0) {
    return null;
  }

  // Build selector from data attributes
  let selector = bundle.tag || '*';
  
  for (const [key, value] of Object.entries(bundle.dataAttrs)) {
    if (value) {
      selector += `[data-${key}="${escapeSelector(value)}"]`;
    } else {
      selector += `[data-${key}]`;
    }
  }

  return doc.querySelector(selector);
}

/**
 * Strategy 7: Fuzzy Text (Tier 7, 50% confidence)
 * 
 * Uses text content matching with fuzzy comparison.
 */
export function locateByText(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.text || bundle.text.trim().length === 0) {
    return null;
  }

  const targetText = bundle.text.trim().toLowerCase();
  const tagName = bundle.tag?.toLowerCase() || '*';

  // Get all elements of the specified tag
  const elements = doc.getElementsByTagName(tagName === '*' ? '*' : tagName);

  let bestMatch: Element | null = null;
  let bestScore = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const elText = el.textContent?.trim().toLowerCase() || '';

    // Calculate similarity score
    const score = calculateTextSimilarity(targetText, elText);

    if (score > bestScore && score >= FUZZY_TEXT_THRESHOLD) {
      bestScore = score;
      bestMatch = el;
    }

    // Exact match - return immediately
    if (score === 1) {
      return el;
    }
  }

  return bestMatch;
}

/**
 * Strategy 8: Bounding Box (Tier 8, 30% confidence)
 * 
 * Uses recorded coordinates to find element at position.
 */
export function locateByBounding(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.bounding) {
    return null;
  }

  const center = getBoundingCenter(bundle.bounding);
  const tagName = bundle.tag?.toLowerCase();

  // Get element at center point
  let element = doc.elementFromPoint(center.x, center.y);

  if (!element) {
    return null;
  }

  // If tag specified, walk up to find matching tag
  if (tagName) {
    let current: Element | null = element;
    while (current && current !== doc.documentElement) {
      if (current.tagName.toLowerCase() === tagName) {
        return current;
      }
      current = current.parentElement;
    }

    // Try nearby points if center didn't work
    const offsets = [
      { x: -10, y: 0 }, { x: 10, y: 0 },
      { x: 0, y: -10 }, { x: 0, y: 10 }
    ];

    for (const offset of offsets) {
      element = doc.elementFromPoint(center.x + offset.x, center.y + offset.y);
      if (element?.tagName.toLowerCase() === tagName) {
        return element;
      }
    }

    return null;
  }

  return element;
}

/**
 * Strategy 9: CSS Selector (Additional strategy, 60% confidence)
 * 
 * Uses generated CSS selector from bundle properties.
 */
export function locateByCss(bundle: LocatorBundle, doc: Document): Element | null {
  if (!bundle.css || bundle.css.length === 0) {
    return null;
  }

  try {
    return doc.querySelector(bundle.css);
  } catch {
    return null;
  }
}

// ============================================================================
// STRATEGY REGISTRY
// ============================================================================

/**
 * All available strategies in priority order
 */
export const STRATEGIES: readonly StrategyDefinition[] = [
  {
    name: 'xpath',
    tier: 1,
    confidence: 100,
    isAvailable: hasXPath,
    execute: locateByXPath
  },
  {
    name: 'id',
    tier: 2,
    confidence: 90,
    isAvailable: hasId,
    execute: locateById
  },
  {
    name: 'name',
    tier: 3,
    confidence: 80,
    isAvailable: hasName,
    execute: locateByName
  },
  {
    name: 'aria',
    tier: 4,
    confidence: 75,
    isAvailable: hasAria,
    execute: locateByAria
  },
  {
    name: 'placeholder',
    tier: 5,
    confidence: 70,
    isAvailable: hasPlaceholder,
    execute: locateByPlaceholder
  },
  {
    name: 'data-attrs',
    tier: 6,
    confidence: 65,
    isAvailable: hasDataAttrs,
    execute: locateByDataAttrs
  },
  {
    name: 'text',
    tier: 7,
    confidence: 50,
    isAvailable: hasText,
    execute: locateByText
  },
  {
    name: 'bounding',
    tier: 8,
    confidence: 30,
    isAvailable: hasBounding,
    execute: locateByBounding
  },
  {
    name: 'css',
    tier: 6, // Same tier as data-attrs
    confidence: 60,
    isAvailable: (bundle) => !!bundle.css && bundle.css.length > 0,
    execute: locateByCss
  }
];

/**
 * Get strategies available for a bundle
 */
export function getAvailableStrategies(bundle: LocatorBundle): StrategyDefinition[] {
  return STRATEGIES.filter(s => s.isAvailable(bundle));
}

/**
 * Get strategy by name
 */
export function getStrategyByName(name: string): StrategyDefinition | undefined {
  return STRATEGIES.find(s => s.name === name);
}

// ============================================================================
// MAIN LOCATION FUNCTION
// ============================================================================

/**
 * Locate element using 9-tier fallback strategy
 * 
 * Tries each available strategy in priority order until one succeeds.
 * 
 * @param bundle - Locator bundle with element information
 * @param doc - Document to search in
 * @param options - Location options
 * @returns Location result
 * 
 * @example
 * ```typescript
 * const result = locateElement(step.bundle, document);
 * 
 * if (result.found) {
 *   console.log(`Found using ${result.strategy} with ${result.confidence}% confidence`);
 *   result.element.click();
 * } else {
 *   console.error('Element not found:', result.error);
 * }
 * ```
 */
export function locateElement(
  bundle: LocatorBundle,
  doc: Document,
  options: {
    /** Strategies to skip */
    skipStrategies?: string[];
    /** Only use specific strategies */
    onlyStrategies?: string[];
    /** Minimum confidence threshold */
    minConfidence?: number;
  } = {}
): LocateResult {
  const startTime = performance.now();
  const attempts: StrategyAttempt[] = [];

  // Get available strategies
  let strategies = getAvailableStrategies(bundle);

  // Filter strategies based on options
  if (options.onlyStrategies && options.onlyStrategies.length > 0) {
    strategies = strategies.filter(s => options.onlyStrategies!.includes(s.name));
  }
  if (options.skipStrategies && options.skipStrategies.length > 0) {
    strategies = strategies.filter(s => !options.skipStrategies!.includes(s.name));
  }
  if (options.minConfidence) {
    strategies = strategies.filter(s => s.confidence >= options.minConfidence!);
  }

  // Sort by tier (priority)
  strategies.sort((a, b) => a.tier - b.tier);

  // Try each strategy
  for (const strategy of strategies) {
    const attemptStart = performance.now();
    
    try {
      const element = strategy.execute(bundle, doc);
      const attemptDuration = performance.now() - attemptStart;

      if (element) {
        attempts.push({
          strategy: strategy.name,
          success: true,
          duration: attemptDuration
        });

        return {
          found: true,
          element,
          strategy: strategy.name,
          confidence: strategy.confidence,
          duration: performance.now() - startTime,
          attempts
        };
      }

      attempts.push({
        strategy: strategy.name,
        success: false,
        duration: attemptDuration
      });
    } catch (error) {
      attempts.push({
        strategy: strategy.name,
        success: false,
        duration: performance.now() - attemptStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return {
    found: false,
    element: null,
    strategy: null,
    confidence: 0,
    duration: performance.now() - startTime,
    attempts,
    error: `Element not found after trying ${attempts.length} strategies`
  };
}

/**
 * Locate element with retry logic
 * 
 * Retries location with timeout for dynamically loaded elements.
 * 
 * @param bundle - Locator bundle
 * @param doc - Document to search in
 * @param options - Retry options
 * @returns Promise resolving to location result
 */
export async function locateElementWithRetry(
  bundle: LocatorBundle,
  doc: Document,
  options: {
    /** Maximum time to wait (default: ELEMENT_TIMEOUT_MS) */
    timeout?: number;
    /** Retry interval (default: RETRY_INTERVAL_MS) */
    interval?: number;
    /** Location options */
    locateOptions?: Parameters<typeof locateElement>[2];
  } = {}
): Promise<LocateResult> {
  const timeout = options.timeout ?? ELEMENT_TIMEOUT_MS;
  const interval = options.interval ?? RETRY_INTERVAL_MS;
  const startTime = performance.now();

  let lastResult: LocateResult | null = null;
  let retryCount = 0;

  while (performance.now() - startTime < timeout) {
    lastResult = locateElement(bundle, doc, options.locateOptions);

    if (lastResult.found) {
      return lastResult;
    }

    retryCount++;
    await sleep(interval);
  }

  // Final attempt
  lastResult = locateElement(bundle, doc, options.locateOptions);

  if (!lastResult.found) {
    lastResult.error = `Element not found after ${retryCount + 1} attempts over ${timeout}ms`;
  }

  return lastResult;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape special characters in CSS selector value
 */
export function escapeSelector(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * Calculate text similarity using Levenshtein distance
 * 
 * @returns Similarity score 0-1 (1 = identical)
 */
export function calculateTextSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Check for containment
  if (b.includes(a) || a.includes(b)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLength = Math.max(a.length, b.length);
  
  return 1 - distance / maxLength;
}

/**
 * Check if point is within bounding box (with radius expansion)
 */
export function isPointInBoundingBox(
  x: number,
  y: number,
  box: BoundingBox,
  radius: number = BOUNDING_BOX_RADIUS_PX
): boolean {
  return (
    x >= box.x - radius &&
    x <= box.x + box.width + radius &&
    y >= box.y - radius &&
    y <= box.y + box.height + radius
  );
}

/**
 * Calculate distance between point and bounding box center
 */
export function distanceToBoundingCenter(
  x: number,
  y: number,
  box: BoundingBox
): number {
  const center = getBoundingCenter(box);
  return Math.sqrt(
    Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2)
  );
}

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build XPath from element
 * 
 * @param element - Element to build XPath for
 * @param doc - Document context
 * @returns XPath string
 */
export function buildXPathFromElement(element: Element, doc?: Document): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  const documentElement = (doc || (typeof document !== 'undefined' ? document : null))?.documentElement;

  while (current && current !== documentElement) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Build CSS selector from element
 * 
 * @param element - Element to build selector for
 * @param doc - Document context
 * @returns CSS selector string
 */
export function buildCssSelectorFromElement(element: Element, doc?: Document): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  const documentElement = (doc || (typeof document !== 'undefined' ? document : null))?.documentElement;

  while (current && current !== documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.'); // Limit to 2 classes
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        c => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Extract locator bundle from element
 * 
 * Captures all available locator information from an element.
 * 
 * @param element - Element to extract from
 * @param doc - Document context
 * @returns Partial locator bundle
 */
export function extractBundleFromElement(element: Element, doc?: Document): Partial<LocatorBundle> {
  const rect = element.getBoundingClientRect();
  
  const bundle: Partial<LocatorBundle> = {
    tag: element.tagName.toLowerCase(),
    id: element.id || '',
    name: element.getAttribute('name') || '',
    placeholder: element.getAttribute('placeholder') || '',
    aria: element.getAttribute('aria-label') || '',
    text: element.textContent?.trim().slice(0, 100) || '',
    xpath: buildXPathFromElement(element, doc),
    css: buildCssSelectorFromElement(element, doc),
    classes: element.className && typeof element.className === 'string' 
      ? element.className.trim().split(/\s+/).filter(c => c.length > 0)
      : [],
    bounding: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    },
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    dataAttrs: {},
    iframeChain: null,
    shadowHosts: null
  };

  // Extract data attributes
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('data-')) {
      const key = attr.name.slice(5); // Remove 'data-' prefix
      bundle.dataAttrs![key] = attr.value;
    }
  }

  return bundle;
}

/**
 * Verify element matches bundle
 * 
 * Quick check to see if an element matches key properties of a bundle.
 * 
 * @param element - Element to verify
 * @param bundle - Bundle to match against
 * @returns True if element matches
 */
export function verifyElementMatchesBundle(
  element: Element,
  bundle: LocatorBundle
): boolean {
  // Tag must match if specified
  if (bundle.tag && element.tagName.toLowerCase() !== bundle.tag.toLowerCase()) {
    return false;
  }

  // ID must match if specified
  if (bundle.id && element.id !== bundle.id) {
    return false;
  }

  // Name must match if specified
  if (bundle.name && element.getAttribute('name') !== bundle.name) {
    return false;
  }

  return true;
}

/**
 * Score how well an element matches a bundle
 * 
 * @param element - Element to score
 * @param bundle - Bundle to match against
 * @returns Score 0-100
 */
export function scoreElementMatch(
  element: Element,
  bundle: LocatorBundle
): number {
  let score = 0;
  let maxScore = 0;

  // Tag match (10 points)
  if (bundle.tag) {
    maxScore += 10;
    if (element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      score += 10;
    }
  }

  // ID match (25 points)
  if (bundle.id) {
    maxScore += 25;
    if (element.id === bundle.id) {
      score += 25;
    }
  }

  // Name match (15 points)
  if (bundle.name) {
    maxScore += 15;
    if (element.getAttribute('name') === bundle.name) {
      score += 15;
    }
  }

  // Aria match (15 points)
  if (bundle.aria) {
    maxScore += 15;
    if (element.getAttribute('aria-label') === bundle.aria) {
      score += 15;
    }
  }

  // Placeholder match (15 points)
  if (bundle.placeholder) {
    maxScore += 15;
    if (element.getAttribute('placeholder') === bundle.placeholder) {
      score += 15;
    }
  }

  // Text match (10 points, fuzzy)
  if (bundle.text) {
    maxScore += 10;
    const elText = element.textContent?.trim() || '';
    const similarity = calculateTextSimilarity(bundle.text.toLowerCase(), elText.toLowerCase());
    score += Math.round(similarity * 10);
  }

  // Position match (10 points)
  if (bundle.bounding) {
    maxScore += 10;
    const rect = element.getBoundingClientRect();
    const distance = distanceToBoundingCenter(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      bundle.bounding
    );
    // Score based on proximity (within 200px = full points)
    if (distance < BOUNDING_BOX_RADIUS_PX) {
      score += Math.round(10 * (1 - distance / BOUNDING_BOX_RADIUS_PX));
    }
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}
