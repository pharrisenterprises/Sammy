/**
 * ShadowDomHandler - Shadow DOM Event Capture and Traversal
 * @module core/recording/ShadowDomHandler
 * @version 1.0.0
 * 
 * Manages shadow DOM event capture, traversal, and element location.
 * Handles both open and closed shadow roots with graceful degradation.
 * 
 * ## Features
 * - Open shadow root detection and attachment
 * - Closed shadow root access via __realShadowRoot
 * - Shadow host chain serialization
 * - Event composedPath() traversal
 * - Nested shadow DOM support
 * - Web Component special handling
 * 
 * ## Closed Shadow Root Handling
 * Closed shadow roots cannot be accessed directly. This handler
 * relies on page-interceptor.tsx to expose them via the
 * `__realShadowRoot` property on host elements.
 * 
 * @see IframeHandler for iframe coordination
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended Element with potential closed shadow root exposure
 */
export interface ElementWithShadow extends Element {
  /** Exposed closed shadow root (set by page-interceptor) */
  __realShadowRoot?: ShadowRoot;
  
  /** Google Autocomplete input element */
  __autocompleteInput?: HTMLInputElement;
}

/**
 * Shadow host information for chain tracking
 */
export interface ShadowHostInfo {
  /** XPath to the shadow host element */
  xpath: string;
  
  /** Tag name of the host */
  tagName: string;
  
  /** Host element ID if present */
  id?: string;
  
  /** Whether the shadow root is closed */
  isClosed: boolean;
  
  /** Custom element name if applicable */
  customElementName?: string;
}

/**
 * Shadow DOM event types
 */
export type ShadowEventType = 
  | 'attached'
  | 'detached'
  | 'closed-detected'
  | 'element-added'
  | 'element-removed';

/**
 * Shadow DOM lifecycle event
 */
export interface ShadowEvent {
  /** Event type */
  type: ShadowEventType;
  
  /** The shadow host element */
  host: Element;
  
  /** The shadow root (if accessible) */
  shadowRoot?: ShadowRoot;
  
  /** Whether the shadow root is closed */
  isClosed: boolean;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Shadow event listener callback
 */
export type ShadowEventCallback = (event: ShadowEvent) => void;

/**
 * Document listener callback for shadow roots
 */
export type ShadowListenerCallback = (
  shadowRoot: ShadowRoot,
  host: Element
) => void;

/**
 * ShadowDomHandler configuration
 */
export interface ShadowDomHandlerConfig {
  /** Whether to observe for dynamic shadow roots (default: true) */
  observeDynamic?: boolean;
  
  /** Whether to attempt closed shadow root access (default: true) */
  accessClosedRoots?: boolean;
  
  /** Maximum shadow DOM depth to traverse (default: 10) */
  maxDepth?: number;
  
  /** Custom element tags to specially handle */
  specialElements?: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_SHADOW_CONFIG: Required<ShadowDomHandlerConfig> = {
  observeDynamic: true,
  accessClosedRoots: true,
  maxDepth: 10,
  specialElements: ['gmp-place-autocomplete'],
};

// ============================================================================
// SHADOW DOM HANDLER CLASS
// ============================================================================

/**
 * Manages shadow DOM event capture and traversal
 * 
 * @example
 * ```typescript
 * const handler = new ShadowDomHandler();
 * 
 * // Set up listener attachment callback
 * handler.onAttach((shadowRoot, host) => {
 *   shadowRoot.addEventListener('click', handleClick, true);
 * });
 * 
 * // Start handling shadow DOM
 * handler.start(document);
 * 
 * // Get shadow host chain for an element
 * const chain = handler.getShadowHostChain(element);
 * ```
 */
export class ShadowDomHandler {
  /** Map of hosts to their shadow roots */
  private shadowRoots: WeakMap<Element, ShadowRoot>;
  
  /** Map of shadow roots to mutation observers */
  private observers: Map<ShadowRoot, MutationObserver>;
  
  /** Set of hosts we've attached to */
  private attachedHosts: WeakSet<Element>;
  
  /** Callbacks for shadow root attachment */
  private attachCallbacks: Set<ShadowListenerCallback>;
  
  /** Callbacks for shadow root detachment */
  private detachCallbacks: Set<ShadowListenerCallback>;
  
  /** Event listeners */
  private eventListeners: Set<ShadowEventCallback>;
  
  /** Configuration */
  private config: Required<ShadowDomHandlerConfig>;
  
  /** Whether handler is active */
  private isActive: boolean;
  
  /** Document observer for new shadow hosts */
  private documentObserver: MutationObserver | null;
  
  /** Documents being observed */
  private observedDocuments: Set<Document>;
  
  /**
   * Create a new ShadowDomHandler
   */
  constructor(config: ShadowDomHandlerConfig = {}) {
    this.config = { ...DEFAULT_SHADOW_CONFIG, ...config };
    this.shadowRoots = new WeakMap();
    this.observers = new Map();
    this.attachedHosts = new WeakSet();
    this.attachCallbacks = new Set();
    this.detachCallbacks = new Set();
    this.eventListeners = new Set();
    this.isActive = false;
    this.documentObserver = null;
    this.observedDocuments = new Set();
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Start the shadow DOM handler
   */
  start(doc: Document = document): void {
    this.isActive = true;
    
    // Scan for existing shadow hosts
    this.scanForShadowHosts(doc);
    
    // Start observing for new shadow hosts
    if (this.config.observeDynamic) {
      this.startObserving(doc);
    }
  }
  
  /**
   * Stop the shadow DOM handler
   */
  stop(): void {
    this.isActive = false;
    
    // Stop all observers
    this.stopObserving();
    
    // Clear shadow root observers
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }
  
  /**
   * Check if handler is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }
  
  // ==========================================================================
  // SHADOW ROOT ATTACHMENT
  // ==========================================================================
  
  /**
   * Attach to a shadow root
   */
  attachToShadowRoot(host: Element, shadowRoot: ShadowRoot): boolean {
    // Skip if already attached
    if (this.attachedHosts.has(host)) {
      return false;
    }
    
    // Mark as attached
    this.attachedHosts.add(host);
    this.shadowRoots.set(host, shadowRoot);
    
    // Set up mutation observer for the shadow root
    if (this.config.observeDynamic) {
      this.observeShadowRoot(shadowRoot, host);
    }
    
    // Notify callbacks
    this.notifyAttach(shadowRoot, host);
    
    // Emit event
    this.emitEvent({
      type: 'attached',
      host,
      shadowRoot,
      isClosed: shadowRoot.mode === 'closed',
      timestamp: Date.now(),
    });
    
    // Recursively handle nested shadow roots
    this.scanForNestedShadowHosts(shadowRoot);
    
    return true;
  }
  
  /**
   * Detach from a shadow root
   */
  detachFromShadowRoot(host: Element): boolean {
    const shadowRoot = this.shadowRoots.get(host);
    if (!shadowRoot) {
      return false;
    }
    
    // Stop observing
    const observer = this.observers.get(shadowRoot);
    if (observer) {
      observer.disconnect();
      this.observers.delete(shadowRoot);
    }
    
    // Notify callbacks
    this.notifyDetach(shadowRoot, host);
    
    // Emit event
    this.emitEvent({
      type: 'detached',
      host,
      shadowRoot,
      isClosed: shadowRoot.mode === 'closed',
      timestamp: Date.now(),
    });
    
    // Note: Can't remove from WeakSet/WeakMap, will be GC'd
    
    return true;
  }
  
  /**
   * Get shadow root for a host element
   */
  getShadowRoot(host: Element): ShadowRoot | null {
    // Check our cache first
    const cached = this.shadowRoots.get(host);
    if (cached) {
      return cached;
    }
    
    // Check open shadow root
    if (host.shadowRoot) {
      return host.shadowRoot;
    }
    
    // Check for exposed closed shadow root
    if (this.config.accessClosedRoots) {
      const exposed = (host as ElementWithShadow).__realShadowRoot;
      if (exposed) {
        return exposed;
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // SHADOW HOST CHAIN
  // ==========================================================================
  
  /**
   * Get the shadow host chain for an element
   * Returns array of XPaths from outermost to innermost shadow host
   */
  getShadowHostChain(element: Element): string[] {
    const chain: string[] = [];
    let current: Node | null = element;
    
    while (current) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        const host = root.host;
        chain.unshift(this.generateXPath(host));
        current = host;
      } else {
        break;
      }
    }
    
    return chain;
  }
  
  /**
   * Get detailed shadow host info chain
   */
  getShadowHostInfoChain(element: Element): ShadowHostInfo[] {
    const chain: ShadowHostInfo[] = [];
    let current: Node | null = element;
    
    while (current) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        const host = root.host;
        chain.unshift({
          xpath: this.generateXPath(host),
          tagName: host.tagName.toLowerCase(),
          id: host.id || undefined,
          isClosed: root.mode === 'closed',
          customElementName: this.getCustomElementName(host),
        });
        current = host;
      } else {
        break;
      }
    }
    
    return chain;
  }
  
  /**
   * Resolve element from shadow host chain
   */
  resolveFromShadowHostChain(
    chain: string[],
    selector: string,
    rootDocument: Document = document
  ): Element | null {
    let currentRoot: Document | ShadowRoot = rootDocument;
    
    for (const hostXPath of chain) {
      const host = this.evaluateXPath(hostXPath, currentRoot);
      if (!host) {
        return null;
      }
      
      const shadowRoot = this.getShadowRoot(host);
      if (!shadowRoot) {
        return null;
      }
      
      currentRoot = shadowRoot;
    }
    
    // Now find the element in the final shadow root
    return currentRoot.querySelector(selector);
  }
  
  // ==========================================================================
  // ELEMENT FINDING IN SHADOW DOM
  // ==========================================================================
  
  /**
   * Find element within a shadow host's shadow DOM
   */
  findElementInShadow(host: Element, selector: string): Element | null {
    const shadowRoot = this.getShadowRoot(host);
    if (!shadowRoot) {
      return null;
    }
    
    return shadowRoot.querySelector(selector);
  }
  
  /**
   * Find all elements within a shadow host's shadow DOM
   */
  findAllElementsInShadow(host: Element, selector: string): Element[] {
    const shadowRoot = this.getShadowRoot(host);
    if (!shadowRoot) {
      return [];
    }
    
    return Array.from(shadowRoot.querySelectorAll(selector));
  }
  
  /**
   * Deep query selector that crosses shadow boundaries
   */
  deepQuerySelector(selector: string, root: Document | Element = document): Element | null {
    // First try in the root
    const inRoot = root.querySelector(selector);
    if (inRoot) {
      return inRoot;
    }
    
    // Search in shadow roots
    const hosts = this.getAllShadowHosts(root);
    for (const host of hosts) {
      const shadowRoot = this.getShadowRoot(host);
      if (shadowRoot) {
        const found = this.deepQuerySelector(selector, shadowRoot as unknown as Element);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get all shadow hosts within a root
   */
  private getAllShadowHosts(root: Document | Element | ShadowRoot): Element[] {
    const hosts: Element[] = [];
    
    const walker = document.createTreeWalker(
      root instanceof Document ? root.body : root,
      NodeFilter.SHOW_ELEMENT
    );
    
    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      if (element.shadowRoot || (element as ElementWithShadow).__realShadowRoot) {
        hosts.push(element);
      }
      node = walker.nextNode();
    }
    
    return hosts;
  }
  
  // ==========================================================================
  // SHADOW BOUNDARY TRAVERSAL
  // ==========================================================================
  
  /**
   * Traverse shadow boundary to get actual target element
   * Uses event's composedPath() if available
   */
  traverseShadowBoundary(event: Event): Element | null {
    // Use composedPath for accurate target in shadow DOM
    const path = event.composedPath();
    if (path.length > 0) {
      const target = path[0];
      if (target instanceof Element) {
        return target;
      }
    }
    
    // Fallback to event target
    const target = event.target;
    if (target instanceof Element) {
      return target;
    }
    
    return null;
  }
  
  /**
   * Get the real target from an event (crossing shadow boundaries)
   */
  getRealEventTarget(event: Event): Element | null {
    return this.traverseShadowBoundary(event);
  }
  
  /**
   * Check if element is inside shadow DOM
   */
  isInShadowDom(element: Element): boolean {
    const root = element.getRootNode();
    return root instanceof ShadowRoot;
  }
  
  /**
   * Get the shadow root containing an element
   */
  getContainingShadowRoot(element: Element): ShadowRoot | null {
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
      return root;
    }
    return null;
  }
  
  /**
   * Get the outermost light DOM ancestor of an element
   */
  getLightDomAncestor(element: Element): Element {
    let current: Node = element;
    
    while (true) {
      const root = current.getRootNode();
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else {
        break;
      }
    }
    
    return current as Element;
  }
  
  // ==========================================================================
  // SPECIAL ELEMENT HANDLING
  // ==========================================================================
  
  /**
   * Check if element is a special element requiring custom handling
   */
  isSpecialElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    return this.config.specialElements.includes(tagName);
  }
  
  /**
   * Get special element type
   */
  getSpecialElementType(element: Element): string | null {
    const tagName = element.tagName.toLowerCase();
    if (this.config.specialElements.includes(tagName)) {
      return tagName;
    }
    return null;
  }
  
  /**
   * Get Google Autocomplete input from host
   */
  getAutocompleteInput(host: Element): HTMLInputElement | null {
    // Check for exposed input
    const exposed = (host as ElementWithShadow).__autocompleteInput;
    if (exposed) {
      return exposed;
    }
    
    // Try to find in shadow root
    const shadowRoot = this.getShadowRoot(host);
    if (shadowRoot) {
      return shadowRoot.querySelector('input');
    }
    
    return null;
  }
  
  // ==========================================================================
  // SCANNING AND OBSERVATION
  // ==========================================================================
  
  /**
   * Scan document for existing shadow hosts
   */
  private scanForShadowHosts(doc: Document, depth: number = 0): void {
    if (depth >= this.config.maxDepth) {
      return;
    }
    
    const walker = document.createTreeWalker(
      doc.body || doc.documentElement,
      NodeFilter.SHOW_ELEMENT
    );
    
    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      this.checkAndAttachShadowRoot(element, depth);
      node = walker.nextNode();
    }
  }
  
  /**
   * Scan shadow root for nested shadow hosts
   */
  private scanForNestedShadowHosts(shadowRoot: ShadowRoot, depth: number = 0): void {
    if (depth >= this.config.maxDepth) {
      return;
    }
    
    const walker = document.createTreeWalker(
      shadowRoot,
      NodeFilter.SHOW_ELEMENT
    );
    
    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      this.checkAndAttachShadowRoot(element, depth + 1);
      node = walker.nextNode();
    }
  }
  
  /**
   * Check element for shadow root and attach if found
   */
  private checkAndAttachShadowRoot(element: Element, depth: number): void {
    // Check open shadow root
    if (element.shadowRoot) {
      this.attachToShadowRoot(element, element.shadowRoot);
      return;
    }
    
    // Check for exposed closed shadow root
    if (this.config.accessClosedRoots) {
      const exposed = (element as ElementWithShadow).__realShadowRoot;
      if (exposed) {
        this.emitEvent({
          type: 'closed-detected',
          host: element,
          shadowRoot: exposed,
          isClosed: true,
          timestamp: Date.now(),
        });
        this.attachToShadowRoot(element, exposed);
      }
    }
  }
  
  /**
   * Start observing a document for shadow DOM changes
   */
  startObserving(doc: Document): void {
    if (this.observedDocuments.has(doc)) {
      return;
    }
    
    this.observedDocuments.add(doc);
    
    if (!this.documentObserver) {
      this.documentObserver = new MutationObserver((mutations) => {
        this.handleDocumentMutations(mutations);
      });
    }
    
    this.documentObserver.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }
  
  /**
   * Stop all document observation
   */
  stopObserving(): void {
    if (this.documentObserver) {
      this.documentObserver.disconnect();
      this.documentObserver = null;
    }
    
    this.observedDocuments.clear();
  }
  
  /**
   * Observe a shadow root for changes
   */
  private observeShadowRoot(shadowRoot: ShadowRoot, host: Element): void {
    if (this.observers.has(shadowRoot)) {
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      this.handleShadowMutations(mutations, host);
    });
    
    observer.observe(shadowRoot, {
      childList: true,
      subtree: true,
    });
    
    this.observers.set(shadowRoot, observer);
  }
  
  /**
   * Handle document mutations
   */
  private handleDocumentMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          this.checkAndAttachShadowRoot(node, 0);
          
          // Check children
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
          let child = walker.nextNode();
          while (child) {
            this.checkAndAttachShadowRoot(child as Element, 0);
            child = walker.nextNode();
          }
        }
      }
    }
  }
  
  /**
   * Handle shadow root mutations
   */
  private handleShadowMutations(mutations: MutationRecord[], host: Element): void {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          this.emitEvent({
            type: 'element-added',
            host,
            isClosed: false,
            timestamp: Date.now(),
          });
          
          // Check for nested shadow roots
          this.checkAndAttachShadowRoot(node, 0);
        }
      }
      
      for (const node of Array.from(mutation.removedNodes)) {
        if (node instanceof Element) {
          this.emitEvent({
            type: 'element-removed',
            host,
            isClosed: false,
            timestamp: Date.now(),
          });
        }
      }
    }
  }
  
  // ==========================================================================
  // CALLBACKS AND EVENTS
  // ==========================================================================
  
  /**
   * Register callback for shadow root attachment
   */
  onAttach(callback: ShadowListenerCallback): () => void {
    this.attachCallbacks.add(callback);
    return () => this.attachCallbacks.delete(callback);
  }
  
  /**
   * Register callback for shadow root detachment
   */
  onDetach(callback: ShadowListenerCallback): () => void {
    this.detachCallbacks.add(callback);
    return () => this.detachCallbacks.delete(callback);
  }
  
  /**
   * Register shadow event listener
   */
  addEventListener(callback: ShadowEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }
  
  /**
   * Notify attach callbacks
   */
  private notifyAttach(shadowRoot: ShadowRoot, host: Element): void {
    for (const callback of this.attachCallbacks) {
      try {
        callback(shadowRoot, host);
      } catch (error) {
        console.error('Shadow attach callback error:', error);
      }
    }
  }
  
  /**
   * Notify detach callbacks
   */
  private notifyDetach(shadowRoot: ShadowRoot, host: Element): void {
    for (const callback of this.detachCallbacks) {
      try {
        callback(shadowRoot, host);
      } catch (error) {
        console.error('Shadow detach callback error:', error);
      }
    }
  }
  
  /**
   * Emit shadow event
   */
  private emitEvent(event: ShadowEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Shadow event listener error:', error);
      }
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Generate XPath for an element
   */
  private generateXPath(element: Element): string {
    const segments: string[] = [];
    let current: Element | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let segment = current.tagName.toLowerCase();
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          segment += `[${index}]`;
        }
      }
      
      segments.unshift(segment);
      
      if (current.tagName.toLowerCase() === 'body') {
        segments.unshift('html');
        break;
      }
      
      current = parent;
    }
    
    return '/' + segments.join('/');
  }
  
  /**
   * Evaluate XPath in a document or shadow root
   */
  private evaluateXPath(
    xpath: string,
    context: Document | ShadowRoot
  ): Element | null {
    try {
      const doc = context instanceof Document 
        ? context 
        : context.ownerDocument || document;
      
      const contextNode = context instanceof Document
        ? context
        : context;
      
      const result = doc.evaluate(
        xpath,
        contextNode,
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
   * Get custom element name if applicable
   */
  private getCustomElementName(element: Element): string | undefined {
    const tagName = element.tagName.toLowerCase();
    if (tagName.includes('-')) {
      return tagName;
    }
    return undefined;
  }
  
  /**
   * Check if shadow root is accessible
   */
  isAccessible(host: Element): boolean {
    return this.getShadowRoot(host) !== null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a ShadowDomHandler with default configuration
 */
export function createShadowDomHandler(
  config?: ShadowDomHandlerConfig
): ShadowDomHandler {
  return new ShadowDomHandler(config);
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let defaultHandler: ShadowDomHandler | null = null;

/**
 * Get the default ShadowDomHandler instance
 */
export function getShadowDomHandler(): ShadowDomHandler {
  if (!defaultHandler) {
    defaultHandler = new ShadowDomHandler();
  }
  return defaultHandler;
}

/**
 * Reset the default ShadowDomHandler
 */
export function resetShadowDomHandler(): void {
  if (defaultHandler) {
    defaultHandler.stop();
  }
  defaultHandler = null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get shadow host chain for an element
 */
export function getShadowHostChainForElement(element: Element): string[] {
  return getShadowDomHandler().getShadowHostChain(element);
}

/**
 * Check if element is in shadow DOM
 */
export function isElementInShadowDom(element: Element): boolean {
  return getShadowDomHandler().isInShadowDom(element);
}

/**
 * Get the shadow depth of an element
 */
export function getShadowDepth(element: Element): number {
  return getShadowDomHandler().getShadowHostChain(element).length;
}

/**
 * Find element crossing shadow boundaries
 */
export function deepQuerySelector(
  selector: string,
  root?: Document | Element
): Element | null {
  return getShadowDomHandler().deepQuerySelector(selector, root);
}

/**
 * Get real event target from shadow DOM event
 */
export function getRealTarget(event: Event): Element | null {
  return getShadowDomHandler().getRealEventTarget(event);
}

/**
 * Serialize shadow host chain
 */
export function serializeShadowHostChain(chain: ShadowHostInfo[]): string {
  return JSON.stringify(chain);
}

/**
 * Deserialize shadow host chain
 */
export function deserializeShadowHostChain(json: string): ShadowHostInfo[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
