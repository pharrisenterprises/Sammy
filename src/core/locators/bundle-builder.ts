/**
 * @fileoverview Bundle builder for capturing element locator information
 * @module core/locators/bundle-builder
 * @version 1.0.0
 * 
 * This module provides functionality to build LocatorBundle objects from
 * DOM elements during recording. It captures all 14 properties needed for
 * reliable element location during replay.
 * 
 * LOCATOR BUNDLE PROPERTIES (14 total):
 * 1. tag - Element tag name
 * 2. id - Element ID
 * 3. name - Form element name
 * 4. placeholder - Input placeholder
 * 5. aria - Aria-label
 * 6. text - Text content (truncated)
 * 7. dataAttrs - Data-* attributes
 * 8. css - Generated CSS selector
 * 9. xpath - Generated XPath
 * 10. classes - CSS classes array
 * 11. pageUrl - Current page URL
 * 12. bounding - BoundingBox coordinates
 * 13. iframeChain - Array of iframe indices
 * 14. shadowHosts - Array of shadow host selectors
 * 
 * @see PHASE_4_SPECIFICATIONS.md for locator specifications
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { LocatorBundle, BoundingBox } from '../types';

// JSDOM compatibility - check for global constructors
const hasShadowRoot = typeof ShadowRoot !== 'undefined';
const hasElement = typeof Element !== 'undefined';
const hasNode = typeof Node !== 'undefined';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for bundle building
 */
export interface BundleBuildOptions {
  /** Maximum text length to capture */
  maxTextLength?: number;
  /** Maximum number of classes to capture */
  maxClasses?: number;
  /** Maximum data attributes to capture */
  maxDataAttrs?: number;
  /** Include computed styles info */
  includeStyles?: boolean;
  /** Capture parent chain info */
  captureParentChain?: boolean;
  /** Custom attribute prefixes to capture (beyond data-*) */
  customAttrPrefixes?: string[];
}

/**
 * Context information for bundle building
 */
export interface BundleBuildContext {
  /** Window containing the element */
  window: Window;
  /** Document containing the element */
  document: Document;
  /** Parent iframe elements (if in iframe) */
  iframes: HTMLIFrameElement[];
  /** Shadow host elements (if in shadow DOM) */
  shadowHosts: Element[];
}

/**
 * Result of bundle building
 */
export interface BundleBuildResult {
  /** Built bundle */
  bundle: LocatorBundle;
  /** Quality score (0-100) */
  qualityScore: number;
  /** Warnings during build */
  warnings: string[];
  /** Build duration in ms */
  duration: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default build options
 */
export const DEFAULT_BUILD_OPTIONS: Required<BundleBuildOptions> = {
  maxTextLength: 100,
  maxClasses: 10,
  maxDataAttrs: 10,
  includeStyles: false,
  captureParentChain: false,
  customAttrPrefixes: []
};

/**
 * Common test ID attribute names
 */
const TEST_ID_ATTRS = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa'
];

// ============================================================================
// MAIN BUNDLE BUILDER
// ============================================================================

/**
 * Build a LocatorBundle from a DOM element
 * 
 * Captures all 14 properties needed for element location during replay.
 * 
 * @param element - Element to build bundle from
 * @param options - Build options
 * @returns Build result with bundle and metadata
 * 
 * @example
 * ```typescript
 * // During recording, when user clicks an element:
 * document.addEventListener('click', (e) => {
 *   const result = buildBundle(e.target as Element);
 *   console.log('Quality score:', result.qualityScore);
 *   recordStep({ bundle: result.bundle, event: 'click' });
 * });
 * ```
 */
export function buildBundle(
  element: Element,
  options: BundleBuildOptions = {}
): BundleBuildResult {
  const startTime = performance.now();
  const opts = { ...DEFAULT_BUILD_OPTIONS, ...options };
  const warnings: string[] = [];

  // Get context
  const context = getBuildContext(element);

  // Build bundle with all 14 properties
  const bundle: LocatorBundle = {
    // 1. Tag name
    tag: element.tagName.toLowerCase(),

    // 2. ID
    id: element.id || '',

    // 3. Name
    name: element.getAttribute('name') || '',

    // 4. Placeholder
    placeholder: element.getAttribute('placeholder') || '',

    // 5. Aria label
    aria: getAriaLabel(element),

    // 6. Text content (truncated)
    text: getTextContent(element, opts.maxTextLength),

    // 7. Data attributes
    dataAttrs: getDataAttributes(element, opts.maxDataAttrs, opts.customAttrPrefixes),

    // 8. CSS selector
    css: buildCssSelector(element),

    // 9. XPath
    xpath: buildXPath(element),

    // 10. Classes
    classes: getClasses(element, opts.maxClasses),

    // 11. Page URL
    pageUrl: context.window.location.href,

    // 12. Bounding box
    bounding: getBoundingBox(element),

    // 13. Iframe chain
    iframeChain: getIframeChain(context.iframes),

    // 14. Shadow hosts
    shadowHosts: getShadowHostSelectors(context.shadowHosts)
  };

  // Validate and add warnings
  if (!bundle.id && !bundle.name && !bundle.xpath) {
    warnings.push('Element has no ID, name, or reliable XPath');
  }

  if (!bundle.text && !bundle.placeholder && !bundle.aria) {
    warnings.push('Element has no text content for fuzzy matching');
  }

  if (Object.keys(bundle.dataAttrs).length === 0) {
    warnings.push('Element has no data attributes');
  }

  // Calculate quality score
  const qualityScore = calculateBundleQualityScore(bundle);

  return {
    bundle,
    qualityScore,
    warnings,
    duration: performance.now() - startTime
  };
}

/**
 * Build bundle from event target
 * 
 * Convenience function for use in event handlers.
 */
export function buildBundleFromEvent(
  event: Event,
  options: BundleBuildOptions = {}
): BundleBuildResult | null {
  const target = event.target;
  
  // JSDOM compatible Element check
  if (!target || (hasElement && !(target instanceof Element)) || (!hasElement && !('tagName' in target))) {
    return null;
  }

  return buildBundle(target as Element, options);
}

/**
 * Build bundle from coordinates
 * 
 * Finds element at given coordinates and builds bundle.
 */
export function buildBundleFromPoint(
  x: number,
  y: number,
  doc: Document = document,
  options: BundleBuildOptions = {}
): BundleBuildResult | null {
  // Check if elementFromPoint is available (not in JSDOM)
  if (typeof doc.elementFromPoint !== 'function') {
    return null;
  }
  
  const element = doc.elementFromPoint(x, y);
  
  if (!element) {
    return null;
  }

  return buildBundle(element, options);
}

// ============================================================================
// CONTEXT DETECTION
// ============================================================================

/**
 * Get build context for an element
 * 
 * Detects iframe and shadow DOM context.
 */
export function getBuildContext(element: Element): BundleBuildContext {
  const iframes: HTMLIFrameElement[] = [];
  const shadowHosts: Element[] = [];

  // Get owning document and window
  const doc = element.ownerDocument;
  const win = doc.defaultView || window;

  // Detect iframe chain
  let currentWindow: Window | null = win;
  while (currentWindow && currentWindow !== currentWindow.parent) {
    try {
      const parentDoc = currentWindow.parent.document;
      const iframeElements = parentDoc.querySelectorAll('iframe');
      
      for (let i = 0; i < iframeElements.length; i++) {
        const iframe = iframeElements[i] as HTMLIFrameElement;
        if (iframe.contentWindow === currentWindow) {
          iframes.unshift(iframe);
          break;
        }
      }
      
      currentWindow = currentWindow.parent;
    } catch {
      // Cross-origin iframe - stop traversal
      break;
    }
  }

  // Detect shadow DOM chain
  let currentNode: Node | null = element;
  while (currentNode) {
    const root = currentNode.getRootNode();
    
    // Check if root is a ShadowRoot (JSDOM compatible)
    if (hasShadowRoot && root instanceof ShadowRoot) {
      shadowHosts.unshift(root.host);
      currentNode = root.host;
    } else if (!hasShadowRoot && root && 'host' in root) {
      // Fallback for environments without ShadowRoot constructor
      shadowHosts.unshift((root as any).host);
      currentNode = (root as any).host;
    } else {
      break;
    }
  }

  return {
    window: win,
    document: doc,
    iframes,
    shadowHosts
  };
}

/**
 * Check if element is in an iframe
 */
export function isInIframe(element: Element): boolean {
  const context = getBuildContext(element);
  return context.iframes.length > 0;
}

/**
 * Check if element is in shadow DOM
 */
export function isInShadowDom(element: Element): boolean {
  const root = element.getRootNode();
  if (hasShadowRoot) {
    return root instanceof ShadowRoot;
  }
  // Fallback: check if root has a 'host' property (ShadowRoot characteristic)
  return root !== element.ownerDocument && 'host' in root;
}

// ============================================================================
// PROPERTY EXTRACTORS
// ============================================================================

/**
 * Get aria label from element
 */
function getAriaLabel(element: Element): string {
  // Direct aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  // aria-labelledby reference
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = element.ownerDocument.getElementById(labelledBy);
    if (labelElement) {
      return labelElement.textContent?.trim() || '';
    }
  }

  // Associated label element (for inputs)
  if (element.id) {
    const label = element.ownerDocument.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent?.trim() || '';
    }
  }

  return '';
}

/**
 * Get text content from element (truncated)
 */
function getTextContent(element: Element, maxLength: number): string {
  const tagName = element.tagName.toLowerCase();
  
  // For inputs, get value or placeholder (JSDOM compatible)
  if (tagName === 'input' && 'value' in element) {
    const input = element as any;
    return (input.value || input.placeholder || '').slice(0, maxLength);
  }
  
  if (tagName === 'textarea' && 'value' in element) {
    const textarea = element as any;
    return (textarea.value || textarea.placeholder || '').slice(0, maxLength);
  }

  // For select, get selected option text
  if (tagName === 'select' && 'options' in element) {
    const select = element as any;
    const selected = select.options[select.selectedIndex];
    return (selected?.textContent?.trim() || '').slice(0, maxLength);
  }

  // For other elements, get direct text content (not nested)
  let text = '';
  
  // Use Node.TEXT_NODE if available, otherwise use constant 3
  const TEXT_NODE = hasNode && Node.TEXT_NODE ? Node.TEXT_NODE : 3;
  
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === TEXT_NODE) {
      text += node.textContent || '';
    }
  }

  text = text.trim();
  
  // If no direct text, fall back to full textContent
  if (!text) {
    text = element.textContent?.trim() || '';
  }

  return text.slice(0, maxLength);
}

/**
 * Get data attributes from element
 */
function getDataAttributes(
  element: Element,
  maxAttrs: number,
  customPrefixes: string[]
): Record<string, string> {
  const attrs: Record<string, string> = {};
  let count = 0;

  // Prioritize test IDs
  for (const testIdAttr of TEST_ID_ATTRS) {
    if (count >= maxAttrs) break;
    
    const value = element.getAttribute(testIdAttr);
    if (value) {
      const key = testIdAttr.replace('data-', '');
      attrs[key] = value;
      count++;
    }
  }

  // Get remaining data attributes
  for (const attr of Array.from(element.attributes)) {
    if (count >= maxAttrs) break;
    
    if (attr.name.startsWith('data-')) {
      const key = attr.name.slice(5); // Remove 'data-' prefix
      
      // Skip if already captured (test IDs)
      if (attrs[key]) continue;
      
      attrs[key] = attr.value;
      count++;
    }

    // Check custom prefixes
    for (const prefix of customPrefixes) {
      if (attr.name.startsWith(prefix)) {
        const key = attr.name;
        attrs[key] = attr.value;
        count++;
        break;
      }
    }
  }

  return attrs;
}

/**
 * Get CSS classes from element
 */
function getClasses(element: Element, maxClasses: number): string[] {
  if (!element.className || typeof element.className !== 'string') {
    return [];
  }

  return element.className
    .trim()
    .split(/\s+/)
    .filter(c => c.length > 0)
    .slice(0, maxClasses);
}

/**
 * Get bounding box from element
 */
function getBoundingBox(element: Element): BoundingBox {
  const rect = element.getBoundingClientRect();
  
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

/**
 * Get iframe chain as array of indices
 */
function getIframeChain(iframes: HTMLIFrameElement[]): number[] | null {
  if (iframes.length === 0) {
    return null;
  }

  return iframes.map(iframe => {
    const parent = iframe.parentElement;
    if (!parent) return 0;
    
    const siblings = Array.from(parent.querySelectorAll('iframe'));
    return siblings.indexOf(iframe);
  });
}

/**
 * Get shadow host selectors
 */
function getShadowHostSelectors(hosts: Element[]): string[] | null {
  if (hosts.length === 0) {
    return null;
  }

  return hosts.map(host => {
    if (host.id) {
      return `#${host.id}`;
    }
    
    const tagName = host.tagName.toLowerCase();
    
    // Try to find unique identifier
    if (host.className && typeof host.className === 'string') {
      const classes = host.className.trim().split(/\s+/);
      if (classes.length > 0) {
        return `${tagName}.${classes[0]}`;
      }
    }

    // Use tag name with position
    const parent = host.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        c => c.tagName === host.tagName
      );
      const index = siblings.indexOf(host) + 1;
      return `${tagName}:nth-of-type(${index})`;
    }

    return tagName;
  });
}

// ============================================================================
// XPATH BUILDER
// ============================================================================

/**
 * Build XPath expression for element
 */
export function buildXPath(element: Element): string {
  // If element has ID, use it directly
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  // Use Node.ELEMENT_NODE if available, otherwise use constant 1
  const ELEMENT_NODE = hasNode && Node.ELEMENT_NODE ? Node.ELEMENT_NODE : 1;

  while (current && current.nodeType === ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    
    // Check if index is needed (multiple siblings with same tag)
    let needsIndex = false;
    let nextSibling = current.nextElementSibling;
    while (nextSibling) {
      if (nextSibling.tagName === current.tagName) {
        needsIndex = true;
        break;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    
    if (index > 1 || needsIndex) {
      parts.unshift(`${tagName}[${index}]`);
    } else {
      parts.unshift(tagName);
    }

    // Stop at body or html
    if (tagName === 'body' || tagName === 'html') {
      break;
    }

    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Build optimized XPath with attributes
 */
export function buildOptimizedXPath(element: Element): string {
  // Try ID first
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  // Try unique attributes
  const tag = element.tagName.toLowerCase();
  
  // Try name
  const name = element.getAttribute('name');
  if (name) {
    return `//${tag}[@name="${name}"]`;
  }

  // Try data-testid
  for (const testIdAttr of TEST_ID_ATTRS) {
    const testId = element.getAttribute(testIdAttr);
    if (testId) {
      return `//${tag}[@${testIdAttr}="${testId}"]`;
    }
  }

  // Try placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    return `//${tag}[@placeholder="${placeholder}"]`;
  }

  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `//${tag}[@aria-label="${ariaLabel}"]`;
  }

  // Fall back to positional XPath
  return buildXPath(element);
}

// ============================================================================
// CSS SELECTOR BUILDER
// ============================================================================

/**
 * Build CSS selector for element
 */
export function buildCssSelector(element: Element): string {
  // If element has ID, use it
  if (element.id) {
    return `#${escapeCssIdentifier(element.id)}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== current.ownerDocument.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add classes (limited to avoid overly specific selectors)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0);
      if (classes.length > 0) {
        // Use first 2 classes max
        const limitedClasses = classes.slice(0, 2);
        selector += '.' + limitedClasses.map(c => escapeCssIdentifier(c)).join('.');
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName);
      
      if (sameTagSiblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);

    // Stop if we have a unique path (check if current selector is unique)
    const fullSelector = parts.join(' > ');
    try {
      const matches = current.ownerDocument.querySelectorAll(fullSelector);
      if (matches.length === 1) {
        return fullSelector;
      }
    } catch {
      // Invalid selector, continue building
    }

    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Build optimized CSS selector with unique attributes
 */
export function buildOptimizedCssSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();

  // Try ID first
  if (element.id) {
    return `#${escapeCssIdentifier(element.id)}`;
  }

  // Try data-testid
  for (const testIdAttr of TEST_ID_ATTRS) {
    const testId = element.getAttribute(testIdAttr);
    if (testId) {
      const selector = `${tag}[${testIdAttr}="${testId}"]`;
      if (isUniqueSelector(selector, element)) {
        return selector;
      }
    }
  }

  // Try name
  const name = element.getAttribute('name');
  if (name) {
    const selector = `${tag}[name="${name}"]`;
    if (isUniqueSelector(selector, element)) {
      return selector;
    }
  }

  // Try placeholder
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    const selector = `${tag}[placeholder="${placeholder}"]`;
    if (isUniqueSelector(selector, element)) {
      return selector;
    }
  }

  // Fall back to path-based selector
  return buildCssSelector(element);
}

/**
 * Check if CSS selector uniquely identifies an element
 */
function isUniqueSelector(selector: string, element: Element): boolean {
  try {
    const matches = element.ownerDocument.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

/**
 * Escape CSS identifier
 */
function escapeCssIdentifier(str: string): string {
  return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// ============================================================================
// BUNDLE ENHANCEMENT
// ============================================================================

/**
 * Enhance an existing bundle with additional properties
 */
export function enhanceBundle(
  bundle: LocatorBundle,
  element: Element
): LocatorBundle {
  const newResult = buildBundle(element);
  
  return {
    ...bundle,
    // Update properties that might have changed
    bounding: newResult.bundle.bounding,
    pageUrl: newResult.bundle.pageUrl,
    // Preserve original properties if they exist
    xpath: bundle.xpath || newResult.bundle.xpath,
    css: bundle.css || newResult.bundle.css,
    // Merge data attributes
    dataAttrs: { ...bundle.dataAttrs, ...newResult.bundle.dataAttrs }
  };
}

/**
 * Merge two bundles, preferring non-empty values from first
 */
export function mergeBundles(
  primary: LocatorBundle,
  secondary: LocatorBundle
): LocatorBundle {
  return {
    tag: primary.tag || secondary.tag,
    id: primary.id || secondary.id,
    name: primary.name || secondary.name,
    placeholder: primary.placeholder || secondary.placeholder,
    aria: primary.aria || secondary.aria,
    text: primary.text || secondary.text,
    dataAttrs: { ...secondary.dataAttrs, ...primary.dataAttrs },
    css: primary.css || secondary.css,
    xpath: primary.xpath || secondary.xpath,
    classes: primary.classes.length > 0 ? primary.classes : secondary.classes,
    pageUrl: primary.pageUrl || secondary.pageUrl,
    bounding: primary.bounding || secondary.bounding,
    iframeChain: primary.iframeChain ?? secondary.iframeChain,
    shadowHosts: primary.shadowHosts ?? secondary.shadowHosts
  };
}

/**
 * Calculate quality score for a bundle (0-100)
 * 
 * Scoring weights:
 * - ID: 30 points (most reliable)
 * - Name: 15 points
 * - Data attributes: 15 points
 * - Placeholder/Aria: 10 points each
 * - Text: 10 points
 * - XPath/CSS: 5 points each
 */
function calculateBundleQualityScore(bundle: LocatorBundle): number {
  let score = 0;

  // ID is the most reliable locator
  if (bundle.id) score += 30;

  // Name attribute is very reliable for forms
  if (bundle.name) score += 15;

  // Data attributes (especially test IDs) are reliable
  const dataAttrCount = Object.keys(bundle.dataAttrs).length;
  if (dataAttrCount > 0) {
    score += Math.min(15, dataAttrCount * 5);
  }

  // Placeholder and aria provide good context
  if (bundle.placeholder) score += 10;
  if (bundle.aria) score += 10;

  // Text content helps with fuzzy matching
  if (bundle.text && bundle.text.length > 0) score += 10;

  // XPath and CSS selectors
  if (bundle.xpath) score += 5;
  if (bundle.css) score += 5;

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Validate a bundle has minimum required properties
 */
export function validateBundle(bundle: LocatorBundle): {
  valid: boolean;
  missingProperties: string[];
  score: number;
} {
  const missingProperties: string[] = [];

  if (!bundle.tag) missingProperties.push('tag');
  if (!bundle.xpath && !bundle.css && !bundle.id) {
    missingProperties.push('locator (xpath, css, or id)');
  }

  const score = calculateBundleQualityScore(bundle);

  return {
    valid: missingProperties.length === 0,
    missingProperties,
    score
  };
}
