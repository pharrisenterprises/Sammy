/**
 * ShadowDOMHandler - Shadow DOM Penetration
 * @module core/content/ShadowDOMHandler
 * @version 1.0.0
 * 
 * Implements IShadowDOMHandler for traversing shadow DOM boundaries.
 * Handles both open shadow roots (direct access) and closed shadow roots
 * (via page-context interception).
 * 
 * ## Features
 * - Shadow boundary traversal
 * - Shadow host chain tracking
 * - Closed shadow root support (via __realShadowRoot)
 * - Focus tracking across shadow boundaries
 * - XPath construction within shadow roots
 * 
 * @example
 * ```typescript
 * const shadowHandler = new ShadowDOMHandler();
 * 
 * // Find element in shadow DOM
 * const element = shadowHandler.findInShadowDOM(xpath, shadowHosts);
 * 
 * // Get shadow host chain for element
 * const hosts = shadowHandler.getShadowHostChain(element);
 * 
 * // Get currently focused element (traverses shadow boundaries)
 * const focused = shadowHandler.getFocusedElement();
 * ```
 */

import type { IShadowDOMHandler } from './IContentScript';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Shadow host information
 */
export interface ShadowHostInfo {
  /** Index in chain */
  index: number;
  
  /** Host element tag name */
  tagName: string;
  
  /** Host element ID (if any) */
  id?: string;
  
  /** Host element classes */
  classes?: string[];
  
  /** XPath to host element */
  xpath?: string;
  
  /** Whether shadow root is open or closed */
  mode: 'open' | 'closed' | 'unknown';
}

/**
 * Shadow DOM handler configuration
 */
export interface ShadowDOMHandlerConfig {
  /** Property name for intercepted shadow roots */
  interceptedProperty?: string;
  
  /** Whether to log debug info */
  debug?: boolean;
  
  /** Maximum depth for shadow traversal */
  maxDepth?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_SHADOW_HANDLER_CONFIG: Required<ShadowDOMHandlerConfig> = {
  interceptedProperty: '__realShadowRoot',
  debug: false,
  maxDepth: 10,
};

/**
 * Extended Element interface for intercepted shadow roots
 */
interface InterceptedElement extends Element {
  __realShadowRoot?: ShadowRoot;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if element has shadow root (open or intercepted)
 */
export function hasShadowRoot(element: Element): boolean {
  if (element.shadowRoot) {
    return true;
  }
  
  // Check for intercepted closed shadow root
  const intercepted = element as InterceptedElement;
  if (intercepted.__realShadowRoot) {
    return true;
  }
  
  return false;
}

/**
 * Get shadow root from element (open or intercepted)
 */
export function getShadowRoot(
  element: Element,
  interceptedProperty = '__realShadowRoot'
): ShadowRoot | null {
  // Try open shadow root first
  if (element.shadowRoot) {
    return element.shadowRoot;
  }
  
  // Try intercepted closed shadow root
  const intercepted = element as Record<string, unknown>;
  if (intercepted[interceptedProperty] instanceof ShadowRoot) {
    return intercepted[interceptedProperty] as ShadowRoot;
  }
  
  return null;
}

/**
 * Get shadow root mode
 */
export function getShadowRootMode(element: Element): 'open' | 'closed' | 'none' {
  if (element.shadowRoot) {
    return 'open';
  }
  
  const intercepted = element as InterceptedElement;
  if (intercepted.__realShadowRoot) {
    return 'closed';
  }
  
  return 'none';
}

/**
 * Create ShadowHostInfo from element
 */
export function createShadowHostInfo(
  element: Element,
  index: number,
  xpath?: string
): ShadowHostInfo {
  const mode = getShadowRootMode(element);
  
  return {
    index,
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classes: element.classList.length > 0 
      ? Array.from(element.classList) 
      : undefined,
    xpath,
    mode: mode === 'none' ? 'unknown' : mode,
  };
}

/**
 * Generate simple XPath for element within a root
 */
export function generateLocalXPath(element: Element, root: Document | ShadowRoot): string {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  // If element has ID, use it
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  // Build path from root
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    // Stop if we've reached the root
    const parent = current.parentElement;
    if (!parent || current.getRootNode() !== root) {
      break;
    }
    
    let selector = current.tagName.toLowerCase();
    
    // Add index if needed
    const siblings = Array.from(parent.children).filter(
      child => child.tagName === current!.tagName
    );
    
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `[${index}]`;
    }
    
    parts.unshift(selector);
    current = parent;
  }
  
  return parts.length > 0 ? '//' + parts.join('/') : '';
}

/**
 * Find all shadow hosts in document
 */
export function findAllShadowHosts(root: Document | ShadowRoot = document): Element[] {
  const hosts: Element[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node instanceof Element && hasShadowRoot(node)) {
      hosts.push(node);
    }
    node = walker.nextNode();
  }
  
  return hosts;
}

// ============================================================================
// SHADOW DOM HANDLER CLASS
// ============================================================================

/**
 * Shadow DOM Handler implementation
 */
export class ShadowDOMHandler implements IShadowDOMHandler {
  private config: Required<ShadowDOMHandlerConfig>;
  
  constructor(config?: Partial<ShadowDOMHandlerConfig>) {
    this.config = {
      ...DEFAULT_SHADOW_HANDLER_CONFIG,
      ...config,
    };
  }
  
  // ==========================================================================
  // IShadowDOMHandler IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Find element in shadow DOM using shadow host chain
   */
  findInShadowDOM(xpath: string, shadowHosts?: string[]): Element | null {
    let root: Document | ShadowRoot = document;
    
    // Navigate through shadow host chain
    if (shadowHosts && shadowHosts.length > 0) {
      for (let i = 0; i < shadowHosts.length && i < this.config.maxDepth; i++) {
        const hostXPath = shadowHosts[i];
        
        // Find host element in current root
        const host = this.evaluateXPath(hostXPath, root);
        if (!host) {
          this.log('Shadow host not found', { hostXPath, depth: i });
          return null;
        }
        
        // Get shadow root of host
        const shadowRoot = getShadowRoot(host, this.config.interceptedProperty);
        if (!shadowRoot) {
          this.log('Shadow root not found', { hostXPath, depth: i });
          return null;
        }
        
        root = shadowRoot;
      }
    }
    
    // Find element in final root
    return this.evaluateXPath(xpath, root);
  }
  
  /**
   * Get shadow host chain for element
   */
  getShadowHostChain(element: Element): string[] {
    const chain: string[] = [];
    let current: Node | null = element;
    let depth = 0;
    
    while (current && depth < this.config.maxDepth) {
      const root = current.getRootNode();
      
      // If we're in a shadow root, add the host to chain
      if (root instanceof ShadowRoot) {
        const host = root.host;
        const hostXPath = this.generateHostXPath(host);
        chain.unshift(hostXPath);
        current = host;
        depth++;
      } else {
        // Reached document root
        break;
      }
    }
    
    return chain;
  }
  
  /**
   * Check if element is inside shadow DOM
   */
  isInShadowDOM(element: Element): boolean {
    const root = element.getRootNode();
    return root instanceof ShadowRoot;
  }
  
  /**
   * Get focused element (traverses shadow boundaries)
   */
  getFocusedElement(): Element | null {
    let focused: Element | null = document.activeElement;
    let depth = 0;
    
    while (focused && depth < this.config.maxDepth) {
      // Check if focused element has a shadow root with deeper focus
      const shadowRoot = getShadowRoot(focused, this.config.interceptedProperty);
      
      if (shadowRoot && shadowRoot.activeElement) {
        focused = shadowRoot.activeElement;
        depth++;
      } else {
        break;
      }
    }
    
    return focused;
  }
  
  /**
   * Get deepest element from event (using composedPath)
   */
  getDeepestElement(event: Event): Element | null {
    const path = event.composedPath();
    
    if (path.length > 0 && path[0] instanceof Element) {
      return path[0];
    }
    
    return event.target instanceof Element ? event.target : null;
  }
  
  /**
   * Traverse shadow boundaries to find element by selector
   */
  querySelectorDeep(selector: string, root: Element | Document = document): Element | null {
    // First try in the root
    const direct = root.querySelector(selector);
    if (direct) {
      return direct;
    }
    
    // Search in shadow roots
    const hosts = this.findShadowHostsIn(root);
    
    for (const host of hosts) {
      const shadowRoot = getShadowRoot(host, this.config.interceptedProperty);
      if (shadowRoot) {
        const found = this.querySelectorDeep(selector, shadowRoot as unknown as Element);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Query all elements across shadow boundaries
   */
  querySelectorAllDeep(selector: string, root: Element | Document = document): Element[] {
    const results: Element[] = [];
    
    // Get elements in current root
    results.push(...Array.from(root.querySelectorAll(selector)));
    
    // Search in shadow roots
    const hosts = this.findShadowHostsIn(root);
    
    for (const host of hosts) {
      const shadowRoot = getShadowRoot(host, this.config.interceptedProperty);
      if (shadowRoot) {
        results.push(...this.querySelectorAllDeep(selector, shadowRoot as unknown as Element));
      }
    }
    
    return results;
  }
  
  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================
  
  /**
   * Evaluate XPath in root
   */
  private evaluateXPath(xpath: string, root: Document | ShadowRoot): Element | null {
    try {
      // XPath works differently in shadow roots, so we need special handling
      if (root instanceof ShadowRoot) {
        // Try to convert XPath to CSS selector for shadow roots
        // Handle simple ID selector: //*[@id="something"]
        const idMatch = xpath.match(/\/\/\*\[@id="([^"]+)"\]/);
        if (idMatch) {
          return root.querySelector(`#${idMatch[1]}`);
        }
        
        // For other XPath expressions in shadow roots, use querySelector fallback
        // This is a limitation - complex XPath doesn't work in shadow DOM
        this.log('XPath in shadow root - trying querySelector fallback', { xpath });
        
        // Try common patterns
        const tagMatch = xpath.match(/\/\/(\w+)/);
        if (tagMatch) {
          return root.querySelector(tagMatch[1]);
        }
        
        return null;
      }
      
      // For document root, use standard XPath evaluation
      const result = root.evaluate(
        xpath,
        root,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      return result.singleNodeValue as Element | null;
    } catch (error) {
      this.log('XPath evaluation failed', { xpath, error });
      return null;
    }
  }
  
  /**
   * Generate XPath for shadow host
   */
  private generateHostXPath(host: Element): string {
    // If host has ID, use it
    if (host.id) {
      return `//*[@id="${host.id}"]`;
    }
    
    // Build path from parent
    const parent = host.parentElement;
    if (!parent) {
      return `//${host.tagName.toLowerCase()}`;
    }
    
    const siblings = Array.from(parent.children).filter(
      child => child.tagName === host.tagName
    );
    
    let selector = host.tagName.toLowerCase();
    
    if (siblings.length > 1) {
      const index = siblings.indexOf(host) + 1;
      selector += `[${index}]`;
    }
    
    return `//${selector}`;
  }
  
  /**
   * Find shadow hosts in root
   */
  private findShadowHostsIn(root: Element | Document): Element[] {
    const hosts: Element[] = [];
    
    // Get all elements
    const elements = root.querySelectorAll('*');
    
    for (const el of Array.from(elements)) {
      if (hasShadowRoot(el)) {
        hosts.push(el);
      }
    }
    
    return hosts;
  }
  
  /**
   * Log debug message
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[ShadowDOMHandler] ${message}`, data);
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Get configuration
   */
  getConfig(): Required<ShadowDOMHandlerConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<ShadowDOMHandlerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get shadow host info for element
   */
  getShadowHostInfo(element: Element): ShadowHostInfo | null {
    if (!hasShadowRoot(element)) {
      return null;
    }
    
    return createShadowHostInfo(element, 0);
  }
  
  /**
   * Get full shadow host chain as ShadowHostInfo array
   */
  getShadowHostInfoChain(element: Element): ShadowHostInfo[] {
    const chain: ShadowHostInfo[] = [];
    let current: Node | null = element;
    let index = 0;
    
    while (current && index < this.config.maxDepth) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        const host = root.host;
        const xpath = this.generateHostXPath(host);
        chain.unshift(createShadowHostInfo(host, index, xpath));
        current = host;
        index++;
      } else {
        break;
      }
    }
    
    // Re-index from 0
    chain.forEach((info, i) => {
      info.index = i;
    });
    
    return chain;
  }
  
  /**
   * Count shadow hosts in document
   */
  countShadowHosts(root: Element | Document = document): number {
    return this.findShadowHostsIn(root).length;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a ShadowDOMHandler
 */
export function createShadowDOMHandler(
  config?: Partial<ShadowDOMHandlerConfig>
): ShadowDOMHandler {
  return new ShadowDOMHandler(config);
}

/**
 * Create shadow DOM handler with debug logging
 */
export function createDebugShadowHandler(): ShadowDOMHandler {
  return new ShadowDOMHandler({ debug: true });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultHandler: ShadowDOMHandler | null = null;

/**
 * Get default shadow DOM handler instance
 */
export function getShadowDOMHandler(): ShadowDOMHandler {
  if (!defaultHandler) {
    defaultHandler = new ShadowDOMHandler();
  }
  return defaultHandler;
}

/**
 * Reset default shadow DOM handler
 */
export function resetShadowDOMHandler(): void {
  defaultHandler = null;
}
