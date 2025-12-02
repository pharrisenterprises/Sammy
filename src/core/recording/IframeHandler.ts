/**
 * IframeHandler - Iframe Event Capture and Coordination
 * @module core/recording/IframeHandler
 * @version 1.0.0
 * 
 * Manages event listener attachment across iframes, detects dynamically
 * added iframes, and serializes iframe chains for element location.
 * 
 * ## Features
 * - Recursive iframe listener attachment
 * - MutationObserver for dynamic iframes
 * - Iframe chain serialization
 * - Cross-origin graceful handling
 * - Lifecycle event callbacks
 * 
 * ## Cross-Origin Handling
 * Cross-origin iframes cannot have listeners attached due to browser
 * security restrictions. The handler detects these and skips them
 * gracefully without throwing errors.
 * 
 * @see EventListenerManager for listener management
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about an iframe in the chain
 */
export interface IframeInfo {
  /** Index of iframe among siblings */
  index: number;
  
  /** Iframe ID if present */
  id?: string;
  
  /** Iframe name if present */
  name?: string;
  
  /** Iframe src URL */
  src?: string;
  
  /** XPath to iframe element */
  xpath?: string;
}

/**
 * Iframe lifecycle event types
 */
export type IframeEventType = 'attached' | 'detached' | 'error' | 'cross-origin';

/**
 * Iframe lifecycle event
 */
export interface IframeEvent {
  /** Event type */
  type: IframeEventType;
  
  /** The iframe element */
  iframe: HTMLIFrameElement;
  
  /** Error message if applicable */
  error?: string;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Iframe event listener callback
 */
export type IframeEventCallback = (event: IframeEvent) => void;

/**
 * Document listener attachment callback
 */
export type DocumentListenerCallback = (doc: Document, iframe?: HTMLIFrameElement) => void;

/**
 * IframeHandler configuration
 */
export interface IframeHandlerConfig {
  /** Whether to observe for dynamic iframes (default: true) */
  observeDynamic?: boolean;
  
  /** Maximum nesting depth to traverse (default: 10) */
  maxDepth?: number;
  
  /** Whether to log cross-origin errors (default: false) */
  logCrossOriginErrors?: boolean;
  
  /** Retry delay for iframes not yet loaded (ms, default: 100) */
  retryDelay?: number;
  
  /** Maximum retries for unloaded iframes (default: 3) */
  maxRetries?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_IFRAME_CONFIG: Required<IframeHandlerConfig> = {
  observeDynamic: true,
  maxDepth: 10,
  logCrossOriginErrors: false,
  retryDelay: 100,
  maxRetries: 3,
};

/**
 * Iframe attachment result
 */
export interface AttachmentResult {
  /** Whether attachment was successful */
  success: boolean;
  
  /** Number of iframes attached */
  attached: number;
  
  /** Number of cross-origin iframes skipped */
  crossOrigin: number;
  
  /** Number of errors encountered */
  errors: number;
  
  /** Total iframes found */
  total: number;
}

// ============================================================================
// IFRAME HANDLER CLASS
// ============================================================================

/**
 * Manages iframe event capture and coordination
 * 
 * @example
 * ```typescript
 * const handler = new IframeHandler();
 * 
 * // Set up listener attachment callback
 * handler.onAttach((doc, iframe) => {
 *   doc.addEventListener('click', handleClick, true);
 * });
 * 
 * // Attach to all iframes
 * handler.attachToAllIframes(window);
 * 
 * // Start observing for new iframes
 * handler.startObserving(document);
 * 
 * // Get iframe chain for an element
 * const chain = handler.getIframeChain(element);
 * ```
 */
export class IframeHandler {
  /** Set of iframes we've attached to */
  private attachedFrames: WeakSet<HTMLIFrameElement>;
  
  /** Map of iframes to their documents for cleanup */
  private iframeDocuments: WeakMap<HTMLIFrameElement, Document>;
  
  /** MutationObserver for dynamic iframes */
  private observer: MutationObserver | null;
  
  /** Documents being observed */
  private observedDocuments: Set<Document>;
  
  /** Callbacks for document attachment */
  private attachCallbacks: Set<DocumentListenerCallback>;
  
  /** Callbacks for document detachment */
  private detachCallbacks: Set<DocumentListenerCallback>;
  
  /** Event listeners */
  private eventListeners: Set<IframeEventCallback>;
  
  /** Configuration */
  private config: Required<IframeHandlerConfig>;
  
  /** Whether handler is active */
  private isActive: boolean;
  
  /**
   * Create a new IframeHandler
   */
  constructor(config: IframeHandlerConfig = {}) {
    this.config = { ...DEFAULT_IFRAME_CONFIG, ...config };
    this.attachedFrames = new WeakSet();
    this.iframeDocuments = new WeakMap();
    this.observer = null;
    this.observedDocuments = new Set();
    this.attachCallbacks = new Set();
    this.detachCallbacks = new Set();
    this.eventListeners = new Set();
    this.isActive = false;
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Start the iframe handler
   */
  start(rootWindow: Window = window): AttachmentResult {
    this.isActive = true;
    
    // Attach to all existing iframes
    const result = this.attachToAllIframes(rootWindow);
    
    // Start observing for new iframes if configured
    if (this.config.observeDynamic) {
      this.startObserving(rootWindow.document);
    }
    
    return result;
  }
  
  /**
   * Stop the iframe handler
   */
  stop(): void {
    this.isActive = false;
    
    // Stop observing
    this.stopObserving();
    
    // Detach from all iframes
    this.detachFromAllIframes();
  }
  
  /**
   * Check if handler is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }
  
  // ==========================================================================
  // ATTACHMENT
  // ==========================================================================
  
  /**
   * Attach to all iframes recursively
   */
  attachToAllIframes(win: Window, depth: number = 0): AttachmentResult {
    const result: AttachmentResult = {
      success: true,
      attached: 0,
      crossOrigin: 0,
      errors: 0,
      total: 0,
    };
    
    // Check depth limit
    if (depth >= this.config.maxDepth) {
      return result;
    }
    
    try {
      const iframes = win.document.querySelectorAll('iframe');
      result.total = iframes.length;
      
      iframes.forEach((iframe) => {
        const attachResult = this.attachToIframe(iframe as HTMLIFrameElement, depth);
        
        if (attachResult === 'attached') {
          result.attached++;
        } else if (attachResult === 'cross-origin') {
          result.crossOrigin++;
        } else if (attachResult === 'error') {
          result.errors++;
        }
      });
    } catch (error) {
      // Window access might fail for cross-origin
      result.success = false;
      result.errors++;
    }
    
    return result;
  }
  
  /**
   * Attach to a single iframe
   */
  attachToIframe(
    iframe: HTMLIFrameElement,
    depth: number = 0
  ): 'attached' | 'already-attached' | 'cross-origin' | 'error' | 'not-loaded' {
    // Skip if already attached
    if (this.attachedFrames.has(iframe)) {
      return 'already-attached';
    }
    
    try {
      // Check if iframe is loaded and accessible
      const contentDocument = iframe.contentDocument;
      const contentWindow = iframe.contentWindow;
      
      if (!contentDocument || !contentWindow) {
        // Iframe not loaded yet
        this.scheduleRetry(iframe, depth);
        return 'not-loaded';
      }
      
      // Try to access the document (will throw for cross-origin)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = contentDocument.body;
      
      // Mark as attached
      this.attachedFrames.add(iframe);
      this.iframeDocuments.set(iframe, contentDocument);
      
      // Call attach callbacks
      this.notifyAttach(contentDocument, iframe);
      
      // Emit event
      this.emitEvent({
        type: 'attached',
        iframe,
        timestamp: Date.now(),
      });
      
      // Recursively attach to nested iframes
      if (depth < this.config.maxDepth) {
        this.attachToAllIframes(contentWindow, depth + 1);
      }
      
      // Observe this document for new iframes
      if (this.config.observeDynamic) {
        this.observeDocument(contentDocument);
      }
      
      return 'attached';
    } catch (error) {
      // Cross-origin or other access error
      if (this.isCrossOriginError(error)) {
        if (this.config.logCrossOriginErrors) {
          console.debug(`Cross-origin iframe skipped: ${iframe.src}`);
        }
        
        this.emitEvent({
          type: 'cross-origin',
          iframe,
          error: 'Cross-origin access denied',
          timestamp: Date.now(),
        });
        
        return 'cross-origin';
      }
      
      this.emitEvent({
        type: 'error',
        iframe,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
      
      return 'error';
    }
  }
  
  /**
   * Schedule retry for unloaded iframe
   */
  private scheduleRetry(iframe: HTMLIFrameElement, depth: number, attempt: number = 0): void {
    if (attempt >= this.config.maxRetries) {
      return;
    }
    
    setTimeout(() => {
      if (this.isActive && !this.attachedFrames.has(iframe)) {
        const result = this.attachToIframe(iframe, depth);
        if (result === 'not-loaded') {
          this.scheduleRetry(iframe, depth, attempt + 1);
        }
      }
    }, this.config.retryDelay);
  }
  
  /**
   * Detach from all iframes
   */
  detachFromAllIframes(): void {
    // We can't iterate WeakSet, so we rely on detach callbacks
    // being called when iframes are removed
    
    // Clear observation
    this.observedDocuments.clear();
    
    // Note: WeakSet entries will be garbage collected when iframes are removed
  }
  
  /**
   * Detach from a specific iframe
   */
  detachFromIframe(iframe: HTMLIFrameElement): boolean {
    if (!this.attachedFrames.has(iframe)) {
      return false;
    }
    
    const doc = this.iframeDocuments.get(iframe);
    if (doc) {
      this.notifyDetach(doc, iframe);
      this.iframeDocuments.delete(iframe);
    }
    
    // Note: Can't delete from WeakSet, but it will be GC'd
    
    this.emitEvent({
      type: 'detached',
      iframe,
      timestamp: Date.now(),
    });
    
    return true;
  }
  
  // ==========================================================================
  // IFRAME CHAIN
  // ==========================================================================
  
  /**
   * Get the iframe chain for an element
   * Returns array of iframe info from top to element's frame
   */
  getIframeChain(element: Element): IframeInfo[] {
    const chain: IframeInfo[] = [];
    
    // Walk up through window.frameElement chain
    let currentWindow: Window | null = this.getElementWindow(element);
    
    while (currentWindow && currentWindow !== window.top) {
      const frameElement = currentWindow.frameElement as HTMLIFrameElement | null;
      
      if (frameElement) {
        const info = this.getIframeInfo(frameElement);
        chain.unshift(info); // Add to beginning (top-down order)
      }
      
      currentWindow = currentWindow.parent;
    }
    
    return chain;
  }
  
  /**
   * Get info about a single iframe
   */
  getIframeInfo(iframe: HTMLIFrameElement): IframeInfo {
    const parent = iframe.parentElement;
    let index = 0;
    
    if (parent) {
      const siblings = Array.from(parent.querySelectorAll('iframe'));
      index = siblings.indexOf(iframe);
    }
    
    return {
      index,
      id: iframe.id || undefined,
      name: iframe.name || undefined,
      src: iframe.src || undefined,
      xpath: this.generateIframeXPath(iframe),
    };
  }
  
  /**
   * Generate XPath for an iframe
   */
  private generateIframeXPath(iframe: HTMLIFrameElement): string {
    const segments: string[] = [];
    let current: Element | null = iframe;
    
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
   * Get the window containing an element
   */
  private getElementWindow(element: Element): Window | null {
    const doc = element.ownerDocument;
    return doc?.defaultView || null;
  }
  
  /**
   * Resolve element from iframe chain
   */
  resolveIframeChain(chain: IframeInfo[], rootDocument: Document = document): Document | null {
    let currentDoc = rootDocument;
    
    for (const info of chain) {
      const iframes = currentDoc.querySelectorAll('iframe');
      const iframe = iframes[info.index] as HTMLIFrameElement | undefined;
      
      if (!iframe) {
        // Try by ID
        if (info.id) {
          const byId = currentDoc.getElementById(info.id) as HTMLIFrameElement | null;
          if (byId?.contentDocument) {
            currentDoc = byId.contentDocument;
            continue;
          }
        }
        
        // Try by name
        if (info.name) {
          const byName = currentDoc.querySelector(
            `iframe[name="${info.name}"]`
          ) as HTMLIFrameElement | null;
          if (byName?.contentDocument) {
            currentDoc = byName.contentDocument;
            continue;
          }
        }
        
        return null;
      }
      
      if (!iframe.contentDocument) {
        return null;
      }
      
      currentDoc = iframe.contentDocument;
    }
    
    return currentDoc;
  }
  
  // ==========================================================================
  // MUTATION OBSERVER
  // ==========================================================================
  
  /**
   * Start observing a document for iframe additions
   */
  startObserving(doc: Document): void {
    this.observeDocument(doc);
  }
  
  /**
   * Observe a document for iframe changes
   */
  private observeDocument(doc: Document): void {
    if (this.observedDocuments.has(doc)) {
      return;
    }
    
    this.observedDocuments.add(doc);
    
    // Create observer if needed
    if (!this.observer) {
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });
    }
    
    // Observe the document
    this.observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }
  
  /**
   * Stop all observation
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.observedDocuments.clear();
  }
  
  /**
   * Handle mutation observer events
   */
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      // Check added nodes for iframes
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLIFrameElement) {
          this.handleIframeAdded(node);
        } else if (node instanceof Element) {
          // Check for iframes in subtree
          const iframes = node.querySelectorAll('iframe');
          iframes.forEach((iframe) => {
            this.handleIframeAdded(iframe as HTMLIFrameElement);
          });
        }
      }
      
      // Check removed nodes for cleanup
      for (const node of Array.from(mutation.removedNodes)) {
        if (node instanceof HTMLIFrameElement) {
          this.handleIframeRemoved(node);
        } else if (node instanceof Element) {
          const iframes = node.querySelectorAll('iframe');
          iframes.forEach((iframe) => {
            this.handleIframeRemoved(iframe as HTMLIFrameElement);
          });
        }
      }
    }
  }
  
  /**
   * Handle dynamically added iframe
   */
  private handleIframeAdded(iframe: HTMLIFrameElement): void {
    if (!this.isActive) return;
    
    // Wait for iframe to load
    if (iframe.contentDocument?.readyState === 'complete') {
      this.attachToIframe(iframe);
    } else {
      iframe.addEventListener('load', () => {
        this.attachToIframe(iframe);
      }, { once: true });
    }
  }
  
  /**
   * Handle iframe removal
   */
  private handleIframeRemoved(iframe: HTMLIFrameElement): void {
    this.detachFromIframe(iframe);
  }
  
  // ==========================================================================
  // CALLBACKS
  // ==========================================================================
  
  /**
   * Register callback for when a document is attached
   */
  onAttach(callback: DocumentListenerCallback): () => void {
    this.attachCallbacks.add(callback);
    return () => this.attachCallbacks.delete(callback);
  }
  
  /**
   * Register callback for when a document is detached
   */
  onDetach(callback: DocumentListenerCallback): () => void {
    this.detachCallbacks.add(callback);
    return () => this.detachCallbacks.delete(callback);
  }
  
  /**
   * Register iframe event listener
   */
  addEventListener(callback: IframeEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }
  
  /**
   * Notify attach callbacks
   */
  private notifyAttach(doc: Document, iframe?: HTMLIFrameElement): void {
    for (const callback of this.attachCallbacks) {
      try {
        callback(doc, iframe);
      } catch (error) {
        console.error('Attach callback error:', error);
      }
    }
  }
  
  /**
   * Notify detach callbacks
   */
  private notifyDetach(doc: Document, iframe?: HTMLIFrameElement): void {
    for (const callback of this.detachCallbacks) {
      try {
        callback(doc, iframe);
      } catch (error) {
        console.error('Detach callback error:', error);
      }
    }
  }
  
  /**
   * Emit iframe event
   */
  private emitEvent(event: IframeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Check if an error is a cross-origin error
   */
  private isCrossOriginError(error: unknown): boolean {
    if (error instanceof DOMException) {
      return error.name === 'SecurityError';
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('cross-origin') ||
        message.includes('blocked a frame') ||
        message.includes('same origin policy')
      );
    }
    
    return false;
  }
  
  /**
   * Check if an iframe is same-origin
   */
  isSameOrigin(iframe: HTMLIFrameElement): boolean {
    try {
      // Attempt to access contentDocument
      const doc = iframe.contentDocument;
      // Try to read something
      if (doc) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = doc.body;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Get all attached iframes (for debugging)
   * Note: This creates a snapshot, not a live list
   */
  getAttachedIframeCount(): number {
    // WeakSet doesn't have size, so we track via iframeDocuments
    let count = 0;
    // This is a workaround - we can't iterate WeakMap
    // In production, you'd maintain a separate count
    this.observedDocuments.forEach(() => count++);
    return Math.max(0, count - 1); // Subtract main document
  }
  
  /**
   * Check if iframe is attached
   */
  isAttached(iframe: HTMLIFrameElement): boolean {
    return this.attachedFrames.has(iframe);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an IframeHandler with default configuration
 */
export function createIframeHandler(config?: IframeHandlerConfig): IframeHandler {
  return new IframeHandler(config);
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let defaultHandler: IframeHandler | null = null;

/**
 * Get the default IframeHandler instance
 */
export function getIframeHandler(): IframeHandler {
  if (!defaultHandler) {
    defaultHandler = new IframeHandler();
  }
  return defaultHandler;
}

/**
 * Reset the default IframeHandler
 */
export function resetIframeHandler(): void {
  if (defaultHandler) {
    defaultHandler.stop();
  }
  defaultHandler = null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get iframe chain for an element
 */
export function getIframeChainForElement(element: Element): IframeInfo[] {
  return getIframeHandler().getIframeChain(element);
}

/**
 * Check if element is in an iframe
 */
export function isInIframe(element: Element): boolean {
  const win = element.ownerDocument?.defaultView;
  return win !== window.top;
}

/**
 * Get the depth of iframe nesting for an element
 */
export function getIframeDepth(element: Element): number {
  return getIframeHandler().getIframeChain(element).length;
}

/**
 * Serialize iframe chain to JSON-safe format
 */
export function serializeIframeChain(chain: IframeInfo[]): string {
  return JSON.stringify(chain);
}

/**
 * Deserialize iframe chain from JSON
 */
export function deserializeIframeChain(json: string): IframeInfo[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
