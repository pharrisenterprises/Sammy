/**
 * IframeManager - Iframe Coordination
 * @module core/content/IframeManager
 * @version 1.0.0
 * 
 * Implements IIframeManager for coordinating with iframes on the page.
 * Handles recursive iframe discovery, dynamic iframe monitoring, and
 * cross-iframe element finding.
 * 
 * ## Features
 * - Recursive iframe discovery
 * - MutationObserver for dynamic iframes
 * - Cross-origin detection and graceful handling
 * - Iframe chain tracking for nested elements
 * - Element finding across iframe boundaries
 * 
 * @example
 * ```typescript
 * const iframeManager = new IframeManager();
 * 
 * iframeManager.start();
 * iframeManager.attachToAllIframes();
 * 
 * // Find element across iframes
 * const element = iframeManager.findElementInIframes(xpath, iframeChain);
 * 
 * iframeManager.stop();
 * ```
 */

import type {
  IIframeManager,
  IframeInfo,
} from './IContentScript';

import { serializeIframeChain } from './IContentScript';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Iframe manager configuration
 */
export interface IframeManagerConfig {
  /** Whether to auto-attach to new iframes */
  autoAttach?: boolean;
  
  /** Callback when iframe is attached */
  onAttach?: (iframe: HTMLIFrameElement, doc: Document) => void;
  
  /** Callback when iframe is detached */
  onDetach?: (iframe: HTMLIFrameElement) => void;
  
  /** Maximum depth for recursive discovery */
  maxDepth?: number;
  
  /** Whether to log debug info */
  debug?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_IFRAME_MANAGER_CONFIG: Required<IframeManagerConfig> = {
  autoAttach: true,
  onAttach: () => {},
  onDetach: () => {},
  maxDepth: 10,
  debug: false,
};

/**
 * Tracked iframe information
 */
interface TrackedIframe {
  /** The iframe element */
  iframe: HTMLIFrameElement;
  
  /** The iframe's content document (if accessible) */
  document: Document | null;
  
  /** Whether iframe is cross-origin */
  crossOrigin: boolean;
  
  /** Nesting depth */
  depth: number;
  
  /** Parent iframe (null for top-level) */
  parent: HTMLIFrameElement | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if iframe is cross-origin
 */
export function isCrossOriginIframe(iframe: HTMLIFrameElement): boolean {
  try {
    // Attempting to access contentDocument will throw for cross-origin
    const doc = iframe.contentDocument;
    return doc === null;
  } catch {
    return true;
  }
}

/**
 * Get iframe document safely
 */
export function getIframeDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument;
  } catch {
    return null;
  }
}

/**
 * Create IframeInfo from HTMLIFrameElement
 */
export function createIframeInfo(iframe: HTMLIFrameElement, index: number): IframeInfo {
  return {
    index,
    id: iframe.id || undefined,
    name: iframe.name || undefined,
    src: iframe.src || undefined,
  };
}

/**
 * Find all iframes in a document
 */
export function findIframesInDocument(doc: Document): HTMLIFrameElement[] {
  return Array.from(doc.querySelectorAll('iframe'));
}

/**
 * Get window from document
 */
function getWindowFromDocument(doc: Document): Window | null {
  return doc.defaultView;
}

// ============================================================================
// IFRAME MANAGER CLASS
// ============================================================================

/**
 * Iframe Manager implementation
 */
export class IframeManager implements IIframeManager {
  private config: Required<IframeManagerConfig>;
  private trackedIframes: Map<HTMLIFrameElement, TrackedIframe> = new Map();
  private observers: Map<Document, MutationObserver> = new Map();
  private started = false;
  private rootDocument: Document | null = null;
  
  constructor(config?: Partial<IframeManagerConfig>) {
    this.config = {
      ...DEFAULT_IFRAME_MANAGER_CONFIG,
      ...config,
    };
  }
  
  // ==========================================================================
  // IIframeManager IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Start iframe monitoring
   */
  start(): void {
    if (this.started) {
      return;
    }
    
    if (typeof document === 'undefined') {
      return;
    }
    
    this.started = true;
    this.rootDocument = document;
    
    // Set up observer for root document
    this.setupObserver(document);
    
    // Initial discovery
    if (this.config.autoAttach) {
      this.attachToAllIframes();
    }
    
    this.log('IframeManager started');
  }
  
  /**
   * Stop iframe monitoring
   */
  stop(): void {
    if (!this.started) {
      return;
    }
    
    // Disconnect all observers
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    
    // Clear tracked iframes
    for (const tracked of this.trackedIframes.values()) {
      if (!tracked.crossOrigin) {
        this.config.onDetach(tracked.iframe);
      }
    }
    this.trackedIframes.clear();
    
    this.started = false;
    this.rootDocument = null;
    
    this.log('IframeManager stopped');
  }
  
  /**
   * Attach to all iframes (recursive)
   */
  attachToAllIframes(): void {
    if (!this.rootDocument) {
      return;
    }
    
    this.discoverIframes(this.rootDocument, null, 0);
  }
  
  /**
   * Attach to specific iframe
   */
  attachToIframe(iframe: HTMLIFrameElement): boolean {
    return this.trackIframe(iframe, null, 0);
  }
  
  /**
   * Detach from iframe
   */
  detachFromIframe(iframe: HTMLIFrameElement): void {
    const tracked = this.trackedIframes.get(iframe);
    if (!tracked) {
      return;
    }
    
    // Remove observer for iframe's document
    if (tracked.document) {
      const observer = this.observers.get(tracked.document);
      if (observer) {
        observer.disconnect();
        this.observers.delete(tracked.document);
      }
    }
    
    // Remove from tracking
    this.trackedIframes.delete(iframe);
    
    // Notify
    this.config.onDetach(iframe);
    
    this.log('Detached from iframe', { id: iframe.id, src: iframe.src });
  }
  
  /**
   * Get all attached iframes
   */
  getAttachedIframes(): HTMLIFrameElement[] {
    return Array.from(this.trackedIframes.keys()).filter(iframe => {
      const tracked = this.trackedIframes.get(iframe);
      return tracked && !tracked.crossOrigin;
    });
  }
  
  /**
   * Get iframe chain for element
   */
  getIframeChain(element: Element): IframeInfo[] {
    const chain: IframeInfo[] = [];
    let currentDoc = element.ownerDocument;
    let index = 0;
    
    while (currentDoc && currentDoc !== this.rootDocument) {
      // Find the iframe that contains this document
      const iframe = this.findIframeForDocument(currentDoc);
      if (!iframe) {
        break;
      }
      
      chain.unshift(createIframeInfo(iframe, index++));
      
      // Move to parent document
      const parentWindow = getWindowFromDocument(currentDoc)?.parent;
      if (!parentWindow || parentWindow === getWindowFromDocument(currentDoc)) {
        break;
      }
      
      currentDoc = parentWindow.document;
    }
    
    return chain;
  }
  
  /**
   * Find element in iframes using iframe chain
   */
  findElementInIframes(xpath: string, iframeChain?: IframeInfo[]): Element | null {
    let doc: Document | null = this.rootDocument;
    
    // Navigate through iframe chain
    if (iframeChain && iframeChain.length > 0) {
      for (const iframeInfo of iframeChain) {
        if (!doc) break;
        
        const iframe = this.findIframeByInfo(doc, iframeInfo);
        if (!iframe) {
          this.log('Iframe not found in chain', iframeInfo);
          return null;
        }
        
        doc = getIframeDocument(iframe);
      }
    }
    
    if (!doc) {
      return null;
    }
    
    // Evaluate XPath in target document
    try {
      const result = doc.evaluate(
        xpath,
        doc,
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
   * Check if iframe is cross-origin
   */
  isCrossOrigin(iframe: HTMLIFrameElement): boolean {
    const tracked = this.trackedIframes.get(iframe);
    if (tracked) {
      return tracked.crossOrigin;
    }
    return isCrossOriginIframe(iframe);
  }
  
  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================
  
  /**
   * Discover and track iframes recursively
   */
  private discoverIframes(
    doc: Document,
    parentIframe: HTMLIFrameElement | null,
    depth: number
  ): void {
    if (depth > this.config.maxDepth) {
      this.log('Max iframe depth reached', { depth });
      return;
    }
    
    const iframes = findIframesInDocument(doc);
    
    for (const iframe of iframes) {
      this.trackIframe(iframe, parentIframe, depth);
    }
  }
  
  /**
   * Track a single iframe
   */
  private trackIframe(
    iframe: HTMLIFrameElement,
    parent: HTMLIFrameElement | null,
    depth: number
  ): boolean {
    // Skip if already tracked
    if (this.trackedIframes.has(iframe)) {
      return true;
    }
    
    const crossOrigin = isCrossOriginIframe(iframe);
    const doc = crossOrigin ? null : getIframeDocument(iframe);
    
    const tracked: TrackedIframe = {
      iframe,
      document: doc,
      crossOrigin,
      depth,
      parent,
    };
    
    this.trackedIframes.set(iframe, tracked);
    
    if (crossOrigin) {
      this.log('Skipped cross-origin iframe', { src: iframe.src });
      return false;
    }
    
    if (!doc) {
      this.log('Iframe document not available', { id: iframe.id });
      return false;
    }
    
    // Set up observer for iframe document
    this.setupObserver(doc);
    
    // Notify callback
    this.config.onAttach(iframe, doc);
    
    // Recursively discover nested iframes
    this.discoverIframes(doc, iframe, depth + 1);
    
    this.log('Attached to iframe', { id: iframe.id, src: iframe.src, depth });
    
    return true;
  }
  
  /**
   * Set up MutationObserver for document
   */
  private setupObserver(doc: Document): void {
    if (this.observers.has(doc)) {
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations, doc);
    });
    
    observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
    });
    
    this.observers.set(doc, observer);
  }
  
  /**
   * Handle DOM mutations
   */
  private handleMutations(mutations: MutationRecord[], doc: Document): void {
    if (!this.config.autoAttach) {
      return;
    }
    
    for (const mutation of mutations) {
      // Check added nodes for iframes
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLIFrameElement) {
          // Wait for iframe to load
          this.waitForIframeLoad(node, doc);
        } else if (node instanceof Element) {
          // Check for nested iframes
          const nestedIframes = node.querySelectorAll('iframe');
          for (const iframe of Array.from(nestedIframes)) {
            this.waitForIframeLoad(iframe as HTMLIFrameElement, doc);
          }
        }
      }
      
      // Check removed nodes
      for (const node of Array.from(mutation.removedNodes)) {
        if (node instanceof HTMLIFrameElement) {
          this.detachFromIframe(node);
        } else if (node instanceof Element) {
          const nestedIframes = node.querySelectorAll('iframe');
          for (const iframe of Array.from(nestedIframes)) {
            this.detachFromIframe(iframe as HTMLIFrameElement);
          }
        }
      }
    }
  }
  
  /**
   * Wait for iframe to load before attaching
   */
  private waitForIframeLoad(iframe: HTMLIFrameElement, parentDoc: Document): void {
    // Find parent iframe
    const parentIframe = this.findIframeForDocument(parentDoc);
    const depth = parentIframe 
      ? (this.trackedIframes.get(parentIframe)?.depth ?? 0) + 1 
      : 0;
    
    // Try to attach immediately
    if (this.trackIframe(iframe, parentIframe, depth)) {
      return;
    }
    
    // Wait for load event
    const onLoad = () => {
      iframe.removeEventListener('load', onLoad);
      this.trackIframe(iframe, parentIframe, depth);
    };
    
    iframe.addEventListener('load', onLoad);
  }
  
  /**
   * Find iframe that contains a document
   */
  private findIframeForDocument(doc: Document): HTMLIFrameElement | null {
    for (const [iframe, tracked] of this.trackedIframes) {
      if (tracked.document === doc) {
        return iframe;
      }
    }
    return null;
  }
  
  /**
   * Find iframe in document by IframeInfo
   */
  private findIframeByInfo(doc: Document, info: IframeInfo): HTMLIFrameElement | null {
    const iframes = findIframesInDocument(doc);
    
    // Try to find by ID first
    if (info.id) {
      const byId = iframes.find(f => f.id === info.id);
      if (byId) return byId;
    }
    
    // Try by name
    if (info.name) {
      const byName = iframes.find(f => f.name === info.name);
      if (byName) return byName;
    }
    
    // Try by src
    if (info.src) {
      const bySrc = iframes.find(f => f.src === info.src);
      if (bySrc) return bySrc;
    }
    
    // Fall back to index
    if (info.index !== undefined && info.index < iframes.length) {
      return iframes[info.index];
    }
    
    return null;
  }
  
  /**
   * Log debug message
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[IframeManager] ${message}`, data);
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Check if manager is running
   */
  isRunning(): boolean {
    return this.started;
  }
  
  /**
   * Get configuration
   */
  getConfig(): Required<IframeManagerConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<IframeManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get tracked iframe count
   */
  getTrackedCount(): number {
    return this.trackedIframes.size;
  }
  
  /**
   * Get accessible iframe count (non-cross-origin)
   */
  getAccessibleCount(): number {
    let count = 0;
    for (const tracked of this.trackedIframes.values()) {
      if (!tracked.crossOrigin) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * Get cross-origin iframe count
   */
  getCrossOriginCount(): number {
    let count = 0;
    for (const tracked of this.trackedIframes.values()) {
      if (tracked.crossOrigin) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * Get max depth of tracked iframes
   */
  getMaxDepth(): number {
    let max = 0;
    for (const tracked of this.trackedIframes.values()) {
      if (tracked.depth > max) {
        max = tracked.depth;
      }
    }
    return max;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an IframeManager
 */
export function createIframeManager(
  config?: Partial<IframeManagerConfig>
): IframeManager {
  return new IframeManager(config);
}

/**
 * Create iframe manager with debug logging
 */
export function createDebugIframeManager(): IframeManager {
  return new IframeManager({ debug: true });
}

/**
 * Create iframe manager without auto-attach
 */
export function createManualIframeManager(): IframeManager {
  return new IframeManager({ autoAttach: false });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultManager: IframeManager | null = null;

/**
 * Get default iframe manager instance
 */
export function getIframeManager(): IframeManager {
  if (!defaultManager) {
    defaultManager = new IframeManager();
  }
  return defaultManager;
}

/**
 * Reset default iframe manager
 */
export function resetIframeManager(): void {
  if (defaultManager) {
    defaultManager.stop();
    defaultManager = null;
  }
}
