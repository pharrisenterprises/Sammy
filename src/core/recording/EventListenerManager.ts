/**
 * EventListenerManager - DOM Event Listener Management
 * @module core/recording/EventListenerManager
 * @version 1.0.0
 * 
 * Manages event listener attachment and cleanup for the Recording Engine.
 * Handles:
 * - Document-level event listeners
 * - Iframe traversal and listener attachment
 * - Shadow DOM event capture
 * - Dynamic iframe monitoring via MutationObserver
 * - Proper cleanup to prevent memory leaks
 * 
 * @see recording-engine_breakdown.md for context
 * @see content-script-system_breakdown.md for iframe handling
 */

import type { CaptureEventType } from './IRecordingEngine';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event handler function type
 */
export type EventHandler = (event: Event) => void;

/**
 * Registered listener information
 */
export interface RegisteredListener {
  /** Target element or document */
  target: EventTarget;
  
  /** Event type */
  eventType: CaptureEventType;
  
  /** Handler function */
  handler: EventHandler;
  
  /** Listener options */
  options: AddEventListenerOptions;
  
  /** When listener was attached */
  attachedAt: number;
  
  /** Source context (main, iframe index, shadow host xpath) */
  context: string;
}

/**
 * Iframe tracking information
 */
export interface TrackedIframe {
  /** The iframe element */
  element: HTMLIFrameElement;
  
  /** Unique identifier */
  id: string;
  
  /** Whether listeners are attached */
  hasListeners: boolean;
  
  /** Nested iframe depth */
  depth: number;
  
  /** Parent iframe ID (null for top-level) */
  parentId: string | null;
  
  /** When iframe was discovered */
  discoveredAt: number;
}

/**
 * Shadow root tracking information
 */
export interface TrackedShadowRoot {
  /** The shadow root */
  shadowRoot: ShadowRoot;
  
  /** Host element */
  host: Element;
  
  /** Host element XPath for identification */
  hostXPath: string;
  
  /** Whether listeners are attached */
  hasListeners: boolean;
  
  /** Whether it's a closed shadow root (exposed via __realShadowRoot) */
  isClosed: boolean;
}

/**
 * Event listener manager configuration
 */
export interface EventListenerManagerConfig {
  /** Event types to listen for */
  eventTypes: CaptureEventType[];
  
  /** Whether to attach to iframes */
  includeIframes: boolean;
  
  /** Whether to attach to shadow DOM */
  includeShadowDOM: boolean;
  
  /** Whether to try accessing closed shadow roots */
  includeClosedShadowDOM: boolean;
  
  /** Maximum iframe nesting depth to traverse */
  maxIframeDepth: number;
  
  /** Use capture phase for events */
  useCapture: boolean;
  
  /** Selector for elements to ignore */
  ignoreSelector: string | null;
  
  /** Selector for container to restrict to */
  containerSelector: string | null;
}

/**
 * Statistics about managed listeners
 */
export interface ListenerStats {
  /** Total listeners attached */
  totalListeners: number;
  
  /** Listeners by event type */
  byEventType: Record<string, number>;
  
  /** Number of tracked iframes */
  trackedIframes: number;
  
  /** Number of tracked shadow roots */
  trackedShadowRoots: number;
  
  /** Listeners in main document */
  mainDocumentListeners: number;
  
  /** Listeners in iframes */
  iframeListeners: number;
  
  /** Listeners in shadow DOM */
  shadowDomListeners: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration for EventListenerManager
 */
export const DEFAULT_LISTENER_CONFIG: EventListenerManagerConfig = {
  eventTypes: ['click', 'input', 'change', 'keydown'],
  includeIframes: true,
  includeShadowDOM: true,
  includeClosedShadowDOM: false,
  maxIframeDepth: 5,
  useCapture: true,
  ignoreSelector: null,
  containerSelector: null,
};

// ============================================================================
// EVENT LISTENER MANAGER CLASS
// ============================================================================

/**
 * Manages DOM event listener attachment and cleanup
 * 
 * @example
 * ```typescript
 * const manager = new EventListenerManager({
 *   eventTypes: ['click', 'input'],
 *   includeIframes: true,
 *   includeShadowDOM: true,
 * });
 * 
 * // Set up event handler
 * manager.setEventHandler((event) => {
 *   console.log('Event captured:', event.type);
 * });
 * 
 * // Start listening
 * manager.attach(document);
 * 
 * // Later, cleanup
 * manager.detachAll();
 * ```
 */
export class EventListenerManager {
  private config: EventListenerManagerConfig;
  private listeners: Map<string, RegisteredListener>;
  private iframes: Map<string, TrackedIframe>;
  private shadowRoots: Map<string, TrackedShadowRoot>;
  private iframeObserver: MutationObserver | null;
  private eventHandler: EventHandler | null;
  private isAttached: boolean;
  private listenerIdCounter: number;
  
  /**
   * Create a new EventListenerManager
   * 
   * @param config - Configuration options
   */
  constructor(config?: Partial<EventListenerManagerConfig>) {
    this.config = { ...DEFAULT_LISTENER_CONFIG, ...config };
    this.listeners = new Map();
    this.iframes = new Map();
    this.shadowRoots = new Map();
    this.iframeObserver = null;
    this.eventHandler = null;
    this.isAttached = false;
    this.listenerIdCounter = 0;
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get current configuration
   */
  getConfig(): EventListenerManagerConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   * 
   * Note: Changes take effect on next attach() call
   */
  updateConfig(updates: Partial<EventListenerManagerConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Set the event handler for captured events
   * 
   * @param handler - Handler function to call for each event
   */
  setEventHandler(handler: EventHandler): void {
    this.eventHandler = handler;
  }
  
  // ==========================================================================
  // ATTACHMENT
  // ==========================================================================
  
  /**
   * Attach event listeners to a document
   * 
   * @param doc - Document to attach to (defaults to window.document)
   * @param context - Context identifier for tracking
   */
  attach(doc: Document = document, context: string = 'main'): void {
    if (!this.eventHandler) {
      console.warn('[EventListenerManager] No event handler set, events will not be processed');
    }
    
    // Attach to main document
    this.attachToDocument(doc, context);
    
    // Set up iframe monitoring
    if (this.config.includeIframes) {
      this.startIframeMonitoring(doc);
      this.attachToAllIframes(doc, 0, null);
    }
    
    // Attach to shadow roots
    if (this.config.includeShadowDOM) {
      this.attachToAllShadowRoots(doc);
    }
    
    this.isAttached = true;
  }
  
  /**
   * Attach listeners to a specific document
   */
  private attachToDocument(doc: Document, context: string): void {
    const target = this.getListenerTarget(doc);
    
    for (const eventType of this.config.eventTypes) {
      const handler = this.createBoundHandler(eventType);
      const options: AddEventListenerOptions = {
        capture: this.config.useCapture,
        passive: this.isPassiveEvent(eventType),
      };
      
      target.addEventListener(eventType, handler, options);
      
      const id = this.generateListenerId();
      this.listeners.set(id, {
        target,
        eventType,
        handler,
        options,
        attachedAt: Date.now(),
        context,
      });
    }
  }
  
  /**
   * Get the appropriate target for event listeners
   */
  private getListenerTarget(doc: Document): EventTarget {
    if (this.config.containerSelector) {
      const container = doc.querySelector(this.config.containerSelector);
      if (container) {
        return container;
      }
      console.warn(
        `[EventListenerManager] Container selector "${this.config.containerSelector}" not found, using document`
      );
    }
    return doc;
  }
  
  /**
   * Create a bound event handler
   */
  private createBoundHandler(eventType: CaptureEventType): EventHandler {
    return (event: Event) => {
      // Filter ignored elements
      if (this.shouldIgnoreEvent(event)) {
        return;
      }
      
      // Call the registered handler
      if (this.eventHandler) {
        try {
          this.eventHandler(event);
        } catch (error) {
          console.error(`[EventListenerManager] Error in event handler for ${eventType}:`, error);
        }
      }
    };
  }
  
  /**
   * Check if an event should be ignored
   */
  private shouldIgnoreEvent(event: Event): boolean {
    if (!this.config.ignoreSelector) {
      return false;
    }
    
    const target = event.target as Element;
    if (!target || typeof target.matches !== 'function') {
      return false;
    }
    
    // Check if target matches ignore selector
    if (target.matches(this.config.ignoreSelector)) {
      return true;
    }
    
    // Check if any ancestor matches ignore selector
    if (target.closest(this.config.ignoreSelector)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if event type should use passive listener
   */
  private isPassiveEvent(eventType: CaptureEventType): boolean {
    // Scroll events benefit from passive listeners
    return eventType === 'scroll';
  }
  
  // ==========================================================================
  // IFRAME HANDLING
  // ==========================================================================
  
  /**
   * Attach listeners to all iframes in a document
   */
  private attachToAllIframes(
    doc: Document,
    depth: number,
    parentId: string | null
  ): void {
    if (depth >= this.config.maxIframeDepth) {
      return;
    }
    
    const iframes = doc.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      this.attachToIframe(iframe, depth, parentId);
    }
  }
  
  /**
   * Attach listeners to a single iframe
   */
  private attachToIframe(
    iframe: HTMLIFrameElement,
    depth: number,
    parentId: string | null
  ): void {
    const iframeId = this.generateIframeId(iframe);
    
    // Skip if already tracked
    if (this.iframes.has(iframeId)) {
      return;
    }
    
    // Track the iframe
    const tracked: TrackedIframe = {
      element: iframe,
      id: iframeId,
      hasListeners: false,
      depth,
      parentId,
      discoveredAt: Date.now(),
    };
    this.iframes.set(iframeId, tracked);
    
    // Try to attach listeners
    try {
      const iframeDoc = iframe.contentDocument;
      const iframeWin = iframe.contentWindow;
      
      if (!iframeDoc || !iframeWin) {
        // Cross-origin or not loaded yet
        this.waitForIframeLoad(iframe, iframeId, depth, parentId);
        return;
      }
      
      // Attach to iframe document
      const context = `iframe:${iframeId}`;
      this.attachToDocument(iframeDoc, context);
      tracked.hasListeners = true;
      
      // Recursively attach to nested iframes
      this.attachToAllIframes(iframeDoc, depth + 1, iframeId);
      
      // Attach to shadow roots in iframe
      if (this.config.includeShadowDOM) {
        this.attachToAllShadowRoots(iframeDoc);
      }
      
    } catch (error) {
      // Cross-origin iframe - cannot access
      console.debug(`[EventListenerManager] Cannot access iframe (likely cross-origin):`, error);
    }
  }
  
  /**
   * Wait for iframe to load and then attach
   */
  private waitForIframeLoad(
    iframe: HTMLIFrameElement,
    iframeId: string,
    depth: number,
    _parentId: string | null
  ): void {
    const loadHandler = () => {
      iframe.removeEventListener('load', loadHandler);
      
      // Re-attempt attachment
      const tracked = this.iframes.get(iframeId);
      if (tracked && !tracked.hasListeners) {
        try {
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            const context = `iframe:${iframeId}`;
            this.attachToDocument(iframeDoc, context);
            tracked.hasListeners = true;
            
            // Recursively attach to nested iframes
            this.attachToAllIframes(iframeDoc, depth + 1, iframeId);
            
            if (this.config.includeShadowDOM) {
              this.attachToAllShadowRoots(iframeDoc);
            }
          }
        } catch (error) {
          console.debug(`[EventListenerManager] Cannot access iframe after load:`, error);
        }
      }
    };
    
    iframe.addEventListener('load', loadHandler);
  }
  
  /**
   * Generate unique ID for iframe
   */
  private generateIframeId(iframe: HTMLIFrameElement): string {
    // Use combination of attributes and position
    const src = iframe.src || 'no-src';
    const name = iframe.name || 'unnamed';
    const index = this.getIframeIndex(iframe);
    return `iframe_${name}_${index}_${hashString(src)}`;
  }
  
  /**
   * Get iframe index among siblings
   */
  private getIframeIndex(iframe: HTMLIFrameElement): number {
    const parent = iframe.parentElement;
    if (!parent) return 0;
    
    const siblings = parent.querySelectorAll('iframe');
    return Array.from(siblings).indexOf(iframe);
  }
  
  /**
   * Start monitoring for new iframes
   */
  private startIframeMonitoring(doc: Document): void {
    if (this.iframeObserver) {
      return;
    }
    
    this.iframeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            this.attachToIframe(node, 0, null);
          } else if (node instanceof Element) {
            // Check for iframes in added subtree
            const iframes = node.querySelectorAll('iframe');
            for (const iframe of iframes) {
              this.attachToIframe(iframe, 0, null);
            }
          }
        }
        
        // Handle removed iframes
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLIFrameElement) {
            this.handleIframeRemoved(node);
          }
        }
      }
    });
    
    this.iframeObserver.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }
  
  /**
   * Handle iframe removal
   */
  private handleIframeRemoved(iframe: HTMLIFrameElement): void {
    // Find and remove tracking
    for (const [id, tracked] of this.iframes) {
      if (tracked.element === iframe) {
        this.iframes.delete(id);
        
        // Remove associated listeners
        for (const [listenerId, listener] of this.listeners) {
          if (listener.context === `iframe:${id}`) {
            this.removeListener(listenerId);
          }
        }
        break;
      }
    }
  }
  
  // ==========================================================================
  // SHADOW DOM HANDLING
  // ==========================================================================
  
  /**
   * Attach listeners to all shadow roots in a document
   */
  private attachToAllShadowRoots(doc: Document): void {
    // Find elements with shadow roots
    const walker = doc.createTreeWalker(
      doc.body || doc.documentElement,
      NodeFilter.SHOW_ELEMENT
    );
    
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node instanceof Element) {
        this.checkAndAttachShadowRoot(node);
      }
      node = walker.nextNode();
    }
  }
  
  /**
   * Check element for shadow root and attach listeners
   */
  private checkAndAttachShadowRoot(element: Element): void {
    // Check for open shadow root
    let shadowRoot = element.shadowRoot;
    let isClosed = false;
    
    // Check for closed shadow root (exposed via __realShadowRoot)
    if (!shadowRoot && this.config.includeClosedShadowDOM) {
      shadowRoot = (element as any).__realShadowRoot;
      isClosed = true;
    }
    
    if (!shadowRoot) {
      return;
    }
    
    const hostXPath = this.getElementXPath(element);
    
    // Skip if already tracked
    if (this.shadowRoots.has(hostXPath)) {
      return;
    }
    
    // Track the shadow root
    const tracked: TrackedShadowRoot = {
      shadowRoot,
      host: element,
      hostXPath,
      hasListeners: false,
      isClosed,
    };
    this.shadowRoots.set(hostXPath, tracked);
    
    // Attach listeners to shadow root
    this.attachToShadowRoot(shadowRoot, hostXPath);
    tracked.hasListeners = true;
    
    // Recursively check for nested shadow roots
    this.attachToNestedShadowRoots(shadowRoot);
  }
  
  /**
   * Attach listeners to a shadow root
   */
  private attachToShadowRoot(shadowRoot: ShadowRoot, hostXPath: string): void {
    const context = `shadow:${hostXPath}`;
    
    for (const eventType of this.config.eventTypes) {
      const handler = this.createBoundHandler(eventType);
      const options: AddEventListenerOptions = {
        capture: this.config.useCapture,
        passive: this.isPassiveEvent(eventType),
      };
      
      shadowRoot.addEventListener(eventType, handler, options);
      
      const id = this.generateListenerId();
      this.listeners.set(id, {
        target: shadowRoot,
        eventType,
        handler,
        options,
        attachedAt: Date.now(),
        context,
      });
    }
  }
  
  /**
   * Attach to nested shadow roots within a shadow root
   */
  private attachToNestedShadowRoots(shadowRoot: ShadowRoot): void {
    const walker = document.createTreeWalker(
      shadowRoot,
      NodeFilter.SHOW_ELEMENT
    );
    
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node instanceof Element) {
        this.checkAndAttachShadowRoot(node);
      }
      node = walker.nextNode();
    }
  }
  
  /**
   * Get simple XPath for element (for identification)
   */
  private getElementXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.documentElement) {
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
  
  // ==========================================================================
  // DETACHMENT
  // ==========================================================================
  
  /**
   * Detach all event listeners
   */
  detachAll(): void {
    // Remove all listeners
    for (const [id] of this.listeners) {
      this.removeListener(id);
    }
    this.listeners.clear();
    
    // Stop iframe monitoring
    if (this.iframeObserver) {
      this.iframeObserver.disconnect();
      this.iframeObserver = null;
    }
    
    // Clear tracking
    this.iframes.clear();
    this.shadowRoots.clear();
    
    this.isAttached = false;
  }
  
  /**
   * Remove a specific listener
   */
  private removeListener(id: string): void {
    const listener = this.listeners.get(id);
    if (!listener) {
      return;
    }
    
    try {
      listener.target.removeEventListener(
        listener.eventType,
        listener.handler,
        listener.options
      );
    } catch (error) {
      // Target may have been removed from DOM
      console.debug(`[EventListenerManager] Error removing listener ${id}:`, error);
    }
    
    this.listeners.delete(id);
  }
  
  /**
   * Detach listeners for a specific event type
   */
  detachEventType(eventType: CaptureEventType): void {
    for (const [id, listener] of this.listeners) {
      if (listener.eventType === eventType) {
        this.removeListener(id);
      }
    }
  }
  
  /**
   * Detach listeners from a specific context
   */
  detachContext(context: string): void {
    for (const [id, listener] of this.listeners) {
      if (listener.context === context) {
        this.removeListener(id);
      }
    }
  }
  
  // ==========================================================================
  // STATISTICS & INSPECTION
  // ==========================================================================
  
  /**
   * Get statistics about managed listeners
   */
  getStats(): ListenerStats {
    const stats: ListenerStats = {
      totalListeners: this.listeners.size,
      byEventType: {},
      trackedIframes: this.iframes.size,
      trackedShadowRoots: this.shadowRoots.size,
      mainDocumentListeners: 0,
      iframeListeners: 0,
      shadowDomListeners: 0,
    };
    
    for (const listener of this.listeners.values()) {
      // Count by event type
      stats.byEventType[listener.eventType] = 
        (stats.byEventType[listener.eventType] || 0) + 1;
      
      // Count by context
      if (listener.context === 'main') {
        stats.mainDocumentListeners++;
      } else if (listener.context.startsWith('iframe:')) {
        stats.iframeListeners++;
      } else if (listener.context.startsWith('shadow:')) {
        stats.shadowDomListeners++;
      }
    }
    
    return stats;
  }
  
  /**
   * Get list of all registered listeners
   */
  getListeners(): RegisteredListener[] {
    return Array.from(this.listeners.values());
  }
  
  /**
   * Get list of tracked iframes
   */
  getTrackedIframes(): TrackedIframe[] {
    return Array.from(this.iframes.values());
  }
  
  /**
   * Get list of tracked shadow roots
   */
  getTrackedShadowRoots(): TrackedShadowRoot[] {
    return Array.from(this.shadowRoots.values());
  }
  
  /**
   * Check if manager is currently attached
   */
  isCurrentlyAttached(): boolean {
    return this.isAttached;
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Generate unique listener ID
   */
  private generateListenerId(): string {
    return `listener_${++this.listenerIdCounter}_${Date.now()}`;
  }
  
  /**
   * Dispose of manager and all resources
   */
  dispose(): void {
    this.detachAll();
    this.eventHandler = null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Simple string hash for generating IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create an EventListenerManager with common defaults
 */
export function createEventListenerManager(
  config?: Partial<EventListenerManagerConfig>
): EventListenerManager {
  return new EventListenerManager(config);
}

/**
 * Check if an element is in a shadow DOM
 */
export function isInShadowDOM(element: Element): boolean {
  let root = element.getRootNode();
  return root instanceof ShadowRoot;
}

/**
 * Get the shadow root containing an element (if any)
 */
export function getShadowRootOf(element: Element): ShadowRoot | null {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root : null;
}

/**
 * Get all shadow hosts in the path to document
 */
export function getShadowHostChain(element: Element): Element[] {
  const hosts: Element[] = [];
  let current: Node = element;
  
  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      hosts.push(root.host);
      current = root.host;
    } else {
      break;
    }
  }
  
  return hosts;
}

/**
 * Get the composed path of an event
 * Returns elements from target to document, crossing shadow boundaries
 */
export function getEventPath(event: Event): EventTarget[] {
  if (event.composedPath) {
    return event.composedPath();
  }
  
  // Fallback for older browsers
  const path: EventTarget[] = [];
  let target = event.target as Element | null;
  
  while (target) {
    path.push(target);
    target = target.parentElement;
  }
  
  path.push(window);
  return path;
}
