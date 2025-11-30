/**
 * LocatorGenerator - Generates LocatorBundles from DOM elements
 * @module core/locators/LocatorGenerator
 * @version 1.0.0
 * 
 * Recording-side component that extracts comprehensive element data
 * into LocatorBundle objects for later replay. Captures all relevant
 * identifiers, attributes, and positional data.
 * 
 * @see LocatorBundle for bundle structure
 * @see LocatorResolver for replay-side resolution
 * @see recording-engine_breakdown.md for recording details
 */

import type { LocatorBundle } from '../types/locator-bundle';
import { StrategyRegistry, getStrategyRegistry } from './StrategyRegistry';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum text content length to capture
 */
export const MAX_TEXT_LENGTH = 500;

/**
 * Maximum number of classes to capture
 */
export const MAX_CLASSES = 20;

/**
 * Maximum number of data attributes to capture
 */
export const MAX_DATA_ATTRS = 30;

/**
 * Data attributes to ignore (framework-generated)
 */
export const IGNORED_DATA_ATTRS = [
  'data-reactid',
  'data-reactroot',
  'data-react-checksum',
  'data-emotion',
  'data-styled',
  'data-radix',
] as const;

/**
 * Data attribute prefixes to ignore
 */
export const IGNORED_DATA_PREFIXES = [
  'data-v-',      // Vue scoped styles
  'data-rbd-',    // React Beautiful DnD
] as const;

/**
 * Tags that should not have text extracted
 */
export const NO_TEXT_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'head',
  'meta',
  'link',
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Generator configuration options
 */
export interface GeneratorConfig {
  /** Maximum text length to capture */
  maxTextLength?: number;
  /** Maximum classes to capture */
  maxClasses?: number;
  /** Maximum data attributes to capture */
  maxDataAttrs?: number;
  /** Whether to capture bounding box */
  captureBounding?: boolean;
  /** Whether to capture iframe chain */
  captureIframeChain?: boolean;
  /** Whether to capture shadow DOM hosts */
  captureShadowHosts?: boolean;
  /** Custom strategy registry for selector generation */
  registry?: StrategyRegistry;
}

/**
 * Iframe context information
 */
export interface IframeInfo {
  /** Iframe index in parent */
  index: number;
  /** Iframe src attribute */
  src: string | null;
  /** Iframe name attribute */
  name: string | null;
  /** Iframe id attribute */
  id: string | null;
}

/**
 * Shadow host information
 */
export interface ShadowHostInfo {
  /** Host element tag name */
  tag: string;
  /** Host element id */
  id: string | null;
  /** Host element classes */
  classes: string[];
}

/**
 * Validation result for generated bundle
 */
export interface ValidationResult {
  /** Whether bundle is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets visible text content from an element
 * 
 * @param element - Element to extract text from
 * @param maxLength - Maximum text length
 * @returns Trimmed text content
 */
export function getVisibleText(element: HTMLElement, maxLength: number = MAX_TEXT_LENGTH): string {
  const tagName = element.tagName.toLowerCase();
  
  // Skip certain tags
  if (NO_TEXT_TAGS.includes(tagName as typeof NO_TEXT_TAGS[number])) {
    return '';
  }
  
  // For inputs, get value or placeholder
  if (tagName === 'input') {
    const input = element as HTMLInputElement;
    const type = input.type?.toLowerCase() || 'text';
    
    if (type === 'button' || type === 'submit' || type === 'reset') {
      return (input.value || '').trim().substring(0, maxLength);
    }
    
    // Don't capture sensitive input values
    if (type === 'password') {
      return '';
    }
    
    return '';
  }
  
  // For textareas, don't capture user input
  if (tagName === 'textarea') {
    return '';
  }
  
  // For select, get selected option text
  if (tagName === 'select') {
    const select = element as HTMLSelectElement;
    const selectedOption = select.options[select.selectedIndex];
    return (selectedOption?.text || '').trim().substring(0, maxLength);
  }
  
  // Get text content, excluding child inputs
  const clone = element.cloneNode(true) as HTMLElement;
  const inputs = clone.querySelectorAll('input, textarea, select');
  inputs.forEach(el => el.remove());
  
  const text = (clone.textContent || '').trim();
  
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ');
  
  return normalized.substring(0, maxLength);
}

/**
 * Checks if a data attribute should be ignored
 * 
 * @param attrName - Attribute name
 * @returns True if should be ignored
 */
export function shouldIgnoreDataAttr(attrName: string): boolean {
  if (IGNORED_DATA_ATTRS.includes(attrName as typeof IGNORED_DATA_ATTRS[number])) {
    return true;
  }
  
  for (const prefix of IGNORED_DATA_PREFIXES) {
    if (attrName.startsWith(prefix)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extracts data attributes from an element
 * 
 * @param element - Element to extract from
 * @param maxAttrs - Maximum attributes to capture
 * @returns Object of data attribute key-value pairs
 */
export function extractDataAttributes(
  element: HTMLElement,
  maxAttrs: number = MAX_DATA_ATTRS
): Record<string, string> {
  const dataAttrs: Record<string, string> = {};
  let count = 0;
  
  for (const attr of element.attributes) {
    if (!attr.name.startsWith('data-')) continue;
    if (shouldIgnoreDataAttr(attr.name)) continue;
    if (count >= maxAttrs) break;
    
    // Store with both prefixed and unprefixed keys
    dataAttrs[attr.name] = attr.value;
    
    // Also store unprefixed version for convenience
    const unprefixed = attr.name.replace(/^data-/, '');
    dataAttrs[unprefixed] = attr.value;
    
    count++;
  }
  
  return dataAttrs;
}

/**
 * Gets the iframe chain for an element
 * 
 * @param element - Element to trace
 * @returns Array of iframe indices from top to element's frame
 */
export function getIframeChain(element: HTMLElement): number[] | null {
  const chain: number[] = [];
  let currentWindow: Window | null = element.ownerDocument.defaultView;
  
  while (currentWindow && currentWindow !== currentWindow.parent) {
    try {
      const parentWindow = currentWindow.parent;
      const parentDoc = parentWindow.document;
      
      // Find the iframe containing currentWindow
      const iframes = parentDoc.getElementsByTagName('iframe');
      let found = false;
      
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        if (iframe.contentWindow === currentWindow) {
          chain.unshift(i);
          found = true;
          break;
        }
      }
      
      if (!found) break;
      currentWindow = parentWindow;
      
    } catch {
      // Cross-origin iframe, can't traverse further
      break;
    }
  }
  
  return chain.length > 0 ? chain : null;
}

/**
 * Gets shadow DOM host chain for an element
 * 
 * @param element - Element to trace
 * @returns Array of CSS selectors for shadow hosts from outermost to innermost
 */
export function getShadowHostChain(element: HTMLElement): string[] | null {
  const chain: string[] = [];
  let current: Node | null = element;
  
  while (current) {
    const root = current.getRootNode();
    
    if (root instanceof ShadowRoot) {
      const host = root.host as HTMLElement;
      // Generate selector for the host
      const selector = host.id 
        ? `#${CSS.escape(host.id)}`
        : host.classList.length > 0
        ? `${host.tagName.toLowerCase()}.${Array.from(host.classList).map(c => CSS.escape(c)).join('.')}`
        : host.tagName.toLowerCase();
      
      chain.unshift(selector);
      current = host;
    } else {
      break;
    }
  }
  
  return chain.length > 0 ? chain : null;
}

/**
 * Generates an XPath for an element
 * 
 * @param element - Element to generate XPath for
 * @returns XPath string
 */
export function generateXPath(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let part = current.tagName.toLowerCase();
    
    // Add index if there are siblings with same tag
    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child): child is HTMLElement => child.tagName === current!.tagName
      );
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `[${index}]`;
      }
    }
    
    parts.unshift(part);
    current = parent;
  }
  
  return '/' + parts.join('/');
}

/**
 * Generates a CSS selector for an element
 * 
 * @param element - Element to generate selector for
 * @returns CSS selector string
 */
export function generateCssSelector(element: HTMLElement): string {
  // Try ID first
  if (element.id) {
    const escaped = CSS.escape(element.id);
    return `#${escaped}`;
  }
  
  // Try unique class combination
  if (element.classList.length > 0) {
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList)
      .slice(0, 3)
      .map(c => `.${CSS.escape(c)}`)
      .join('');
    
    return `${tag}${classes}`;
  }
  
  // Fall back to tag with nth-child
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element) + 1;
    return `${element.tagName.toLowerCase()}:nth-child(${index})`;
  }
  
  return element.tagName.toLowerCase();
}

/**
 * Gets bounding box for an element
 * 
 * @param element - Element to measure
 * @returns Bounding box object
 */
export function getBoundingBox(element: HTMLElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * LocatorGenerator - Creates LocatorBundles from DOM elements
 * 
 * Extracts comprehensive element data during recording for replay.
 * Captures identifiers, attributes, text, and positional data.
 * 
 * @example
 * ```typescript
 * const generator = new LocatorGenerator();
 * const bundle = generator.generate(element);
 * 
 * // Later during replay
 * const resolver = new LocatorResolver();
 * const result = await resolver.resolve(bundle, document);
 * ```
 */
export class LocatorGenerator {
  /**
   * Generator configuration
   */
  private config: Required<Omit<GeneratorConfig, 'registry'>> & { registry?: StrategyRegistry };
  
  /**
   * Strategy registry for selector generation
   */
  private registry: StrategyRegistry;
  
  /**
   * Creates a new LocatorGenerator
   * 
   * @param config - Optional configuration
   */
  constructor(config: GeneratorConfig = {}) {
    this.config = {
      maxTextLength: MAX_TEXT_LENGTH,
      maxClasses: MAX_CLASSES,
      maxDataAttrs: MAX_DATA_ATTRS,
      captureBounding: true,
      captureIframeChain: true,
      captureShadowHosts: true,
      ...config,
    };
    
    this.registry = config.registry || getStrategyRegistry();
  }
  
  // ==========================================================================
  // MAIN GENERATION METHODS
  // ==========================================================================
  
  /**
   * Generates a LocatorBundle from a DOM element
   * 
   * @param element - Element to generate bundle for
   * @returns Complete LocatorBundle
   */
  generate(element: HTMLElement): LocatorBundle {
    const doc = element.ownerDocument;
    const tagName = element.tagName.toLowerCase();
    
    // Extract basic properties
    const id = element.id || '';
    const name = (element as HTMLInputElement).name || '';
    const placeholder = (element as HTMLInputElement).placeholder || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    
    // Extract classes (limited)
    const classes = Array.from(element.classList).slice(0, this.config.maxClasses);
    
    // Extract data attributes
    const dataAttrs = extractDataAttributes(element, this.config.maxDataAttrs);
    
    // Extract text content
    const text = getVisibleText(element, this.config.maxTextLength);
    
    // Generate selectors
    const xpath = generateXPath(element);
    const css = generateCssSelector(element);
    
    // Get bounding box
    const bounding = this.config.captureBounding
      ? getBoundingBox(element)
      : { x: 0, y: 0, width: 0, height: 0 };
    
    // Get iframe chain
    const iframeChain = this.config.captureIframeChain
      ? getIframeChain(element)
      : null;
    
    // Get shadow host chain
    const shadowHosts = this.config.captureShadowHosts
      ? getShadowHostChain(element)
      : null;
    
    // Get page URL
    const pageUrl = doc.defaultView?.location?.href || '';
    
    return {
      tag: tagName,
      id,
      name,
      placeholder,
      aria: ariaLabel,
      dataAttrs,
      text,
      css,
      xpath,
      classes,
      pageUrl,
      bounding,
      iframeChain,
      shadowHosts,
    };
  }
  
  /**
   * Generates a minimal bundle with only essential data
   * 
   * @param element - Element to generate bundle for
   * @returns Minimal LocatorBundle
   */
  generateMinimal(element: HTMLElement): LocatorBundle {
    const tagName = element.tagName.toLowerCase();
    
    return {
      tag: tagName,
      id: element.id || '',
      name: (element as HTMLInputElement).name || '',
      placeholder: '',
      aria: element.getAttribute('aria-label') || '',
      dataAttrs: {},
      text: '',
      css: generateCssSelector(element),
      xpath: '',
      classes: [],
      pageUrl: '',
      bounding: { x: 0, y: 0, width: 0, height: 0 },
      iframeChain: null,
      shadowHosts: null,
    };
  }
  
  /**
   * Updates an existing bundle with current element state
   * 
   * @param bundle - Existing bundle to update
   * @param element - Element to extract data from
   * @returns Updated bundle
   */
  update(bundle: LocatorBundle, element: HTMLElement): LocatorBundle {
    return {
      ...bundle,
      bounding: this.config.captureBounding
        ? getBoundingBox(element)
        : bundle.bounding,
      text: getVisibleText(element, this.config.maxTextLength),
    };
  }
  
  // ==========================================================================
  // STRATEGY-BASED GENERATION
  // ==========================================================================
  
  /**
   * Generates selectors using all registered strategies
   * 
   * @param element - Element to generate selectors for
   * @returns Object mapping strategy names to generated selectors
   */
  generateAllSelectors(element: HTMLElement): Record<string, string | null> {
    const selectors: Record<string, string | null> = {};
    
    for (const strategy of this.registry.getStrategies()) {
      try {
        selectors[strategy.name] = strategy.generateSelector(element);
      } catch {
        selectors[strategy.name] = null;
      }
    }
    
    return selectors;
  }
  
  /**
   * Generates the best selector for an element
   * 
   * @param element - Element to generate selector for
   * @returns Best selector with strategy name
   */
  generateBestSelector(element: HTMLElement): {
    selector: string | null;
    strategy: string | null;
  } {
    // Try strategies in priority order
    for (const strategy of this.registry.getStrategies()) {
      try {
        const selector = strategy.generateSelector(element);
        if (selector) {
          return { selector, strategy: strategy.name };
        }
      } catch {
        // Continue to next strategy
      }
    }
    
    return { selector: null, strategy: null };
  }
  
  // ==========================================================================
  // VALIDATION METHODS
  // ==========================================================================
  
  /**
   * Validates a generated bundle
   * 
   * @param bundle - Bundle to validate
   * @returns Validation result
   */
  validate(bundle: LocatorBundle): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!bundle.tag) {
      errors.push('Missing required field: tag');
    }
    
    // Check for at least one identifier
    const hasIdentifier = !!(
      bundle.id ||
      bundle.name ||
      bundle.aria ||
      bundle.xpath ||
      bundle.css ||
      (bundle.classes && bundle.classes.length > 0) ||
      (bundle.dataAttrs && Object.keys(bundle.dataAttrs).length > 0)
    );
    
    if (!hasIdentifier) {
      warnings.push('Bundle has no identifiers - replay may be unreliable');
    }
    
    // Check bounding box validity
    if (bundle.bounding) {
      if (bundle.bounding.width <= 0 || bundle.bounding.height <= 0) {
        warnings.push('Element has zero or negative dimensions');
      }
    }
    
    // Check for common issues
    if (bundle.id && /^[0-9]/.test(bundle.id)) {
      warnings.push('ID starts with number - may cause selector issues');
    }
    
    if (bundle.xpath && bundle.xpath.length > 500) {
      warnings.push('XPath is very long - may indicate fragile locator');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Checks if bundle has sufficient data for reliable replay
   * 
   * @param bundle - Bundle to check
   * @returns True if bundle has good replay potential
   */
  hasReliableLocators(bundle: LocatorBundle): boolean {
    // ID is highly reliable
    if (bundle.id) return true;
    
    // Name is reliable for form elements
    if (bundle.name && ['input', 'select', 'textarea'].includes(bundle.tag)) {
      return true;
    }
    
    // ARIA label is fairly reliable
    if (bundle.aria) return true;
    
    // Test data attributes are reliable
    if (bundle.dataAttrs) {
      const testAttrs = ['testid', 'test-id', 'cy', 'qa', 'test', 'automation'];
      for (const key of testAttrs) {
        if (bundle.dataAttrs[key] || bundle.dataAttrs[`data-${key}`]) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /**
   * Extracts only the identifying properties from an element
   * 
   * @param element - Element to extract from
   * @returns Object with identifier properties
   */
  extractIdentifiers(element: HTMLElement): {
    id: string | null;
    name: string | null;
    aria: string | null;
    testId: string | null;
    classes: string[];
  } {
    return {
      id: element.id || null,
      name: (element as HTMLInputElement).name || null,
      aria: element.getAttribute('aria-label') || null,
      testId: element.getAttribute('data-testid') ||
              element.getAttribute('data-test-id') ||
              element.getAttribute('data-cy') ||
              null,
      classes: Array.from(element.classList),
    };
  }
  
  /**
   * Creates an empty bundle template
   * 
   * @param tag - Element tag name
   * @returns Empty bundle with default values
   */
  createEmptyBundle(tag: string = 'div'): LocatorBundle {
    return {
      tag,
      id: '',
      name: '',
      placeholder: '',
      aria: '',
      dataAttrs: {},
      text: '',
      css: '',
      xpath: '',
      classes: [],
      pageUrl: '',
      bounding: { x: 0, y: 0, width: 0, height: 0 },
      iframeChain: null,
      shadowHosts: null,
    };
  }
  
  /**
   * Compares two bundles for equality
   * 
   * @param a - First bundle
   * @param b - Second bundle
   * @returns True if bundles represent same element
   */
  compareBundles(a: LocatorBundle, b: LocatorBundle): boolean {
    // Same ID is definitive
    if (a.id && b.id) return a.id === b.id;
    
    // Same xpath is very likely same element
    if (a.xpath && b.xpath && a.xpath === b.xpath) return true;
    
    // Same tag + name for form elements
    if (a.tag === b.tag && a.name && a.name === b.name) return true;
    
    // Same aria label + tag
    if (a.tag === b.tag && a.aria && a.aria === b.aria) return true;
    
    return false;
  }
  
  // ==========================================================================
  // CONFIGURATION METHODS
  // ==========================================================================
  
  /**
   * Gets the current configuration
   * 
   * @returns Config object
   */
  getConfig(): GeneratorConfig {
    return { ...this.config };
  }
  
  /**
   * Updates the configuration
   * 
   * @param config - Config updates
   */
  updateConfig(config: Partial<GeneratorConfig>): void {
    Object.assign(this.config, config);
    if (config.registry) {
      this.registry = config.registry;
    }
  }
  
  /**
   * Gets the strategy registry
   * 
   * @returns Strategy registry
   */
  getRegistry(): StrategyRegistry {
    return this.registry;
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance
 */
let instance: LocatorGenerator | null = null;

/**
 * Gets or creates the global LocatorGenerator singleton
 * 
 * @returns LocatorGenerator instance
 */
export function getLocatorGenerator(): LocatorGenerator {
  if (!instance) {
    instance = new LocatorGenerator();
  }
  return instance;
}

/**
 * Creates a new LocatorGenerator instance
 * 
 * @param config - Optional configuration
 * @returns New LocatorGenerator instance
 */
export function createLocatorGenerator(config?: GeneratorConfig): LocatorGenerator {
  return new LocatorGenerator(config);
}

/**
 * Resets the global singleton (for testing)
 */
export function resetLocatorGenerator(): void {
  instance = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Generates a bundle using the global generator
 * 
 * @param element - Element to generate bundle for
 * @returns LocatorBundle
 */
export function generateBundle(element: HTMLElement): LocatorBundle {
  return getLocatorGenerator().generate(element);
}

/**
 * Validates a bundle using the global generator
 * 
 * @param bundle - Bundle to validate
 * @returns Validation result
 */
export function validateBundle(bundle: LocatorBundle): ValidationResult {
  return getLocatorGenerator().validate(bundle);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default LocatorGenerator;
