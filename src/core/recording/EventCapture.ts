/**
 * EventCapture - DOM event interception and processing
 * @module core/recording/EventCapture
 * @version 1.0.0
 * 
 * Intercepts DOM events and transforms them into recordable steps.
 * Provides specialized handlers for different event types with
 * support for Shadow DOM and iframes.
 * 
 * Features:
 * - Event delegation for efficient capture
 * - Specialized processors per event type
 * - Element filtering and sanitization
 * - Shadow DOM traversal
 * - Iframe content capture
 * 
 * @see recording-engine_breakdown.md for architecture details
 */

import type { RecordedStep, StepType } from '../types/step';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Events to capture
 */
export const CAPTURABLE_EVENTS = [
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'input',
  'change',
  'keydown',
  'keyup',
  'keypress',
  'focus',
  'blur',
  'submit',
  'scroll',
  'select',
  'copy',
  'cut',
  'paste',
  'dragstart',
  'dragend',
  'drop',
] as const;

/**
 * Event type union
 */
export type CapturableEvent = typeof CAPTURABLE_EVENTS[number];

/**
 * Elements to ignore
 */
export const IGNORED_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'meta',
  'link',
  'head',
] as const;

/**
 * Attributes indicating extension UI
 */
export const EXTENSION_MARKERS = [
  'data-copilot-extension',
  'data-copilot-overlay',
  'data-copilot-ignore',
] as const;

/**
 * Sensitive input types
 */
export const SENSITIVE_INPUT_TYPES = [
  'password',
  'credit-card',
  'cc-number',
  'cc-csc',
  'cc-exp',
] as const;

/**
 * Default capture options
 */
export const DEFAULT_CAPTURE_OPTIONS: EventCaptureOptions = {
  captureClicks: true,
  captureDoubleClicks: true,
  captureInput: true,
  captureKeyboard: true,
  captureNavigation: true,
  captureScroll: false,
  captureFocus: false,
  captureDrag: false,
  captureCopyPaste: false,
  captureIframes: true,
  captureShadowDom: true,
  sanitizeSensitive: true,
  maxTextLength: 1000,
  ignoreHidden: true,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event capture options
 */
export interface EventCaptureOptions {
  /** Capture click events */
  captureClicks: boolean;
  /** Capture double-click events */
  captureDoubleClicks: boolean;
  /** Capture input/change events */
  captureInput: boolean;
  /** Capture keyboard events */
  captureKeyboard: boolean;
  /** Capture navigation events */
  captureNavigation: boolean;
  /** Capture scroll events */
  captureScroll: boolean;
  /** Capture focus/blur events */
  captureFocus: boolean;
  /** Capture drag events */
  captureDrag: boolean;
  /** Capture copy/cut/paste events */
  captureCopyPaste: boolean;
  /** Capture events in iframes */
  captureIframes: boolean;
  /** Capture events in Shadow DOM */
  captureShadowDom: boolean;
  /** Sanitize sensitive data */
  sanitizeSensitive: boolean;
  /** Maximum text content length */
  maxTextLength: number;
  /** Ignore hidden elements */
  ignoreHidden: boolean;
}

/**
 * Captured event data
 */
export interface CapturedEvent {
  /** Event type */
  type: CapturableEvent;
  /** Target element info */
  target: ElementInfo;
  /** Event timestamp */
  timestamp: number;
  /** Event-specific data */
  data: EventData;
  /** Whether event was trusted */
  isTrusted: boolean;
  /** Iframe chain if applicable */
  iframeChain?: FrameInfo[];
  /** Shadow host chain if applicable */
  shadowHostChain?: ElementInfo[];
}

/**
 * Element information
 */
export interface ElementInfo {
  /** Tag name */
  tagName: string;
  /** Element ID */
  id?: string;
  /** Class names */
  classNames: string[];
  /** Element name attribute */
  name?: string;
  /** Visible text content */
  textContent?: string;
  /** Input value (sanitized) */
  value?: string;
  /** Input type */
  inputType?: string;
  /** Relevant attributes */
  attributes: Record<string, string>;
  /** Bounding rect */
  rect?: DOMRect;
  /** Computed XPath */
  xpath: string;
  /** Computed CSS selector */
  cssSelector: string;
  /** ARIA attributes */
  aria: Record<string, string>;
  /** Data attributes */
  dataAttrs: Record<string, string>;
  /** Whether element is visible */
  isVisible: boolean;
  /** Whether element is in viewport */
  isInViewport: boolean;
}

/**
 * Frame information
 */
export interface FrameInfo {
  /** Frame ID */
  id?: string;
  /** Frame name */
  name?: string;
  /** Frame src */
  src?: string;
  /** Frame index */
  index: number;
}

/**
 * Event-specific data union
 */
export type EventData =
  | ClickEventData
  | InputEventData
  | KeyboardEventData
  | ScrollEventData
  | FocusEventData
  | DragEventData
  | ClipboardEventData
  | NavigationEventData;

/**
 * Click event data
 */
export interface ClickEventData {
  type: 'click' | 'dblclick';
  button: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  offsetX: number;
  offsetY: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Input event data
 */
export interface InputEventData {
  type: 'input' | 'change';
  value: string;
  inputType?: string;
  isComposing: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}

/**
 * Keyboard event data
 */
export interface KeyboardEventData {
  type: 'keydown' | 'keyup' | 'keypress';
  key: string;
  code: string;
  keyCode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing: boolean;
}

/**
 * Scroll event data
 */
export interface ScrollEventData {
  type: 'scroll';
  scrollX: number;
  scrollY: number;
  scrollTop: number;
  scrollLeft: number;
  scrollWidth: number;
  scrollHeight: number;
}

/**
 * Focus event data
 */
export interface FocusEventData {
  type: 'focus' | 'blur';
  relatedTarget?: ElementInfo;
}

/**
 * Drag event data
 */
export interface DragEventData {
  type: 'dragstart' | 'dragend' | 'drop';
  clientX: number;
  clientY: number;
  dataTransfer?: {
    types: string[];
    effectAllowed: string;
    dropEffect: string;
  };
}

/**
 * Clipboard event data
 */
export interface ClipboardEventData {
  type: 'copy' | 'cut' | 'paste';
  clipboardData?: {
    types: string[];
    hasText: boolean;
    hasHtml: boolean;
  };
}

/**
 * Navigation event data
 */
export interface NavigationEventData {
  type: 'navigation';
  url: string;
  title: string;
  referrer: string;
  navigationType: 'push' | 'replace' | 'pop' | 'reload';
}

/**
 * Event processor function
 */
export type EventProcessor = (event: Event) => CapturedEvent | null;

/**
 * Event filter function
 */
export type EventFilter = (event: Event, target: Element) => boolean;

/**
 * Event capture callback
 */
export type CaptureCallback = (captured: CapturedEvent) => void;

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * EventCapture - DOM event interception and processing
 * 
 * Intercepts DOM events and transforms them into structured
 * data suitable for recording.
 * 
 * @example
 * ```typescript
 * const capture = new EventCapture({
 *   onCapture: (event) => console.log('Captured:', event),
 * });
 * 
 * capture.start();
 * // ... user interactions are captured ...
 * capture.stop();
 * ```
 */
export class EventCapture {
  /**
   * Capture options
   */
  private options: EventCaptureOptions;
  
  /**
   * Capture callback
   */
  private onCapture: CaptureCallback;
  
  /**
   * Custom event filters
   */
  private filters: EventFilter[] = [];
  
  /**
   * Custom event processors
   */
  private processors: Map<CapturableEvent, EventProcessor> = new Map();
  
  /**
   * Registered event listeners
   */
  private listeners: Map<string, EventListener> = new Map();
  
  /**
   * Whether capturing is active
   */
  private _isCapturing: boolean = false;
  
  /**
   * Observed iframes
   */
  private observedIframes: WeakSet<HTMLIFrameElement> = new WeakSet();
  
  /**
   * Observed shadow roots
   */
  private observedShadowRoots: WeakSet<ShadowRoot> = new WeakSet();
  
  /**
   * MutationObserver for dynamic content
   */
  private mutationObserver: MutationObserver | null = null;
  
  /**
   * Statistics
   */
  private stats = {
    eventsProcessed: 0,
    eventsFiltered: 0,
    eventsCaptured: 0,
    errors: 0,
  };
  
  /**
   * Creates a new EventCapture
   * 
   * @param config - Configuration object
   */
  constructor(config: {
    options?: Partial<EventCaptureOptions>;
    onCapture: CaptureCallback;
  }) {
    this.options = { ...DEFAULT_CAPTURE_OPTIONS, ...config.options };
    this.onCapture = config.onCapture;
    
    // Set up default processors
    this.setupDefaultProcessors();
  }
  
  // ==========================================================================
  // PROPERTIES
  // ==========================================================================
  
  /**
   * Whether currently capturing
   */
  get isCapturing(): boolean {
    return this._isCapturing;
  }
  
  /**
   * Get capture statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Starts event capture
   */
  start(): void {
    if (this._isCapturing) return;
    
    this._isCapturing = true;
    
    // Attach event listeners
    this.attachListeners(document);
    
    // Set up iframe observer
    if (this.options.captureIframes) {
      this.observeIframes();
    }
    
    // Set up shadow DOM observer
    if (this.options.captureShadowDom) {
      this.observeShadowRoots();
    }
    
    // Set up mutation observer for dynamic content
    this.setupMutationObserver();
  }
  
  /**
   * Stops event capture
   */
  stop(): void {
    if (!this._isCapturing) return;
    
    this._isCapturing = false;
    
    // Remove all listeners
    this.removeAllListeners();
    
    // Stop mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
  
  /**
   * Resets capture state
   */
  reset(): void {
    this.stop();
    this.stats = {
      eventsProcessed: 0,
      eventsFiltered: 0,
      eventsCaptured: 0,
      errors: 0,
    };
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Adds a custom event filter
   */
  addFilter(filter: EventFilter): void {
    this.filters.push(filter);
  }
  
  /**
   * Removes a custom event filter
   */
  removeFilter(filter: EventFilter): void {
    const index = this.filters.indexOf(filter);
    if (index >= 0) {
      this.filters.splice(index, 1);
    }
  }
  
  /**
   * Sets a custom event processor
   */
  setProcessor(eventType: CapturableEvent, processor: EventProcessor): void {
    this.processors.set(eventType, processor);
  }
  
  /**
   * Updates capture options
   */
  updateOptions(options: Partial<EventCaptureOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Restart if capturing to apply new options
    if (this._isCapturing) {
      this.stop();
      this.start();
    }
  }
  
  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================
  
  /**
   * Attaches event listeners to a target
   */
  private attachListeners(target: Document | ShadowRoot): void {
    const eventsToCapture = this.getEventsToCapture();
    
    for (const eventType of eventsToCapture) {
      const listener = this.createListener(eventType);
      const key = this.getListenerKey(target, eventType);
      
      target.addEventListener(eventType, listener, { capture: true, passive: true });
      this.listeners.set(key, listener);
    }
  }
  
  /**
   * Removes all event listeners
   */
  private removeAllListeners(): void {
    for (const [key, listener] of this.listeners) {
      const [targetId, eventType] = key.split(':');
      const target = this.getTargetById(targetId);
      
      if (target) {
        target.removeEventListener(eventType, listener, { capture: true });
      }
    }
    
    this.listeners.clear();
  }
  
  /**
   * Creates an event listener
   */
  private createListener(eventType: CapturableEvent): EventListener {
    return (event: Event) => {
      this.handleEvent(event, eventType);
    };
  }
  
  /**
   * Gets listener key
   */
  private getListenerKey(target: Document | ShadowRoot, eventType: string): string {
    const targetId = target === document ? 'document' : `shadow-${Date.now()}`;
    return `${targetId}:${eventType}`;
  }
  
  /**
   * Gets target by ID
   */
  private getTargetById(targetId: string): Document | ShadowRoot | null {
    if (targetId === 'document') return document;
    return null; // Shadow roots would need tracking
  }
  
  /**
   * Gets events to capture based on options
   */
  private getEventsToCapture(): CapturableEvent[] {
    const events: CapturableEvent[] = [];
    
    if (this.options.captureClicks) {
      events.push('click', 'mousedown', 'mouseup');
    }
    
    if (this.options.captureDoubleClicks) {
      events.push('dblclick');
    }
    
    if (this.options.captureInput) {
      events.push('input', 'change', 'select');
    }
    
    if (this.options.captureKeyboard) {
      events.push('keydown', 'keyup');
    }
    
    if (this.options.captureFocus) {
      events.push('focus', 'blur');
    }
    
    if (this.options.captureScroll) {
      events.push('scroll');
    }
    
    if (this.options.captureDrag) {
      events.push('dragstart', 'dragend', 'drop');
    }
    
    if (this.options.captureCopyPaste) {
      events.push('copy', 'cut', 'paste');
    }
    
    return events;
  }
  
  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================
  
  /**
   * Handles a captured event
   */
  private handleEvent(event: Event, eventType: CapturableEvent): void {
    this.stats.eventsProcessed++;
    
    try {
      const target = this.getEventTarget(event);
      if (!target) return;
      
      // Apply filters
      if (!this.shouldCapture(event, target)) {
        this.stats.eventsFiltered++;
        return;
      }
      
      // Process event
      const processor = this.processors.get(eventType);
      if (!processor) return;
      
      const captured = processor(event);
      if (!captured) return;
      
      // Deliver captured event
      this.stats.eventsCaptured++;
      this.onCapture(captured);
    } catch (error) {
      this.stats.errors++;
      console.error('[EventCapture] Error handling event:', error);
    }
  }
  
  /**
   * Gets the actual target element
   */
  private getEventTarget(event: Event): Element | null {
    // Handle Shadow DOM
    const path = event.composedPath();
    if (path.length > 0) {
      const first = path[0];
      if (first instanceof Element) {
        return first;
      }
    }
    
    return event.target instanceof Element ? event.target : null;
  }
  
  /**
   * Determines if event should be captured
   */
  private shouldCapture(event: Event, target: Element): boolean {
    // Check if element should be ignored
    if (this.shouldIgnoreElement(target)) {
      return false;
    }
    
    // Check visibility
    if (this.options.ignoreHidden && !this.isElementVisible(target)) {
      return false;
    }
    
    // Check trusted
    if (!event.isTrusted) {
      return false;
    }
    
    // Apply custom filters
    for (const filter of this.filters) {
      if (!filter(event, target)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Checks if element should be ignored
   */
  private shouldIgnoreElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    
    // Check ignored elements
    if (IGNORED_ELEMENTS.includes(tagName as typeof IGNORED_ELEMENTS[number])) {
      return true;
    }
    
    // Check extension markers
    for (const marker of EXTENSION_MARKERS) {
      if (element.hasAttribute(marker)) {
        return true;
      }
      
      // Check ancestors
      if (element.closest(`[${marker}]`)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Checks if element is visible
   */
  private isElementVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) {
      return true;
    }
    
    const style = window.getComputedStyle(element);
    
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }
  
  // ==========================================================================
  // DEFAULT PROCESSORS
  // ==========================================================================
  
  /**
   * Sets up default event processors
   */
  private setupDefaultProcessors(): void {
    // Click events
    this.processors.set('click', this.processClickEvent.bind(this));
    this.processors.set('dblclick', this.processClickEvent.bind(this));
    this.processors.set('mousedown', this.processClickEvent.bind(this));
    this.processors.set('mouseup', this.processClickEvent.bind(this));
    
    // Input events
    this.processors.set('input', this.processInputEvent.bind(this));
    this.processors.set('change', this.processInputEvent.bind(this));
    
    // Keyboard events
    this.processors.set('keydown', this.processKeyboardEvent.bind(this));
    this.processors.set('keyup', this.processKeyboardEvent.bind(this));
    
    // Focus events
    this.processors.set('focus', this.processFocusEvent.bind(this));
    this.processors.set('blur', this.processFocusEvent.bind(this));
    
    // Scroll events
    this.processors.set('scroll', this.processScrollEvent.bind(this));
    
    // Drag events
    this.processors.set('dragstart', this.processDragEvent.bind(this));
    this.processors.set('dragend', this.processDragEvent.bind(this));
    this.processors.set('drop', this.processDragEvent.bind(this));
    
    // Clipboard events
    this.processors.set('copy', this.processClipboardEvent.bind(this));
    this.processors.set('cut', this.processClipboardEvent.bind(this));
    this.processors.set('paste', this.processClipboardEvent.bind(this));
  }
  
  /**
   * Processes click events
   */
  private processClickEvent(event: Event): CapturedEvent | null {
    const mouseEvent = event as MouseEvent;
    const target = this.getEventTarget(event);
    if (!target) return null;
    
    const data: ClickEventData = {
      type: event.type as 'click' | 'dblclick',
      button: mouseEvent.button,
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
      offsetX: mouseEvent.offsetX,
      offsetY: mouseEvent.offsetY,
      ctrlKey: mouseEvent.ctrlKey,
      shiftKey: mouseEvent.shiftKey,
      altKey: mouseEvent.altKey,
      metaKey: mouseEvent.metaKey,
    };
    
    return this.createCapturedEvent(event.type as CapturableEvent, target, data, event.isTrusted);
  }
  
  /**
   * Processes input events
   */
  private processInputEvent(event: Event): CapturedEvent | null {
    const inputEvent = event as InputEvent;
    const target = this.getEventTarget(event);
    if (!target) return null;
    
    const inputElement = target as HTMLInputElement | HTMLTextAreaElement;
    let value = inputElement.value ?? '';
    
    // Sanitize sensitive data
    if (this.options.sanitizeSensitive && this.isSensitiveInput(inputElement)) {
      value = '********';
    }
    
    // Truncate long values
    if (value.length > this.options.maxTextLength) {
      value = value.slice(0, this.options.maxTextLength) + '...';
    }
    
    const data: InputEventData = {
      type: event.type as 'input' | 'change',
      value,
      inputType: inputEvent.inputType,
      isComposing: inputEvent.isComposing ?? false,
      selectionStart: inputElement.selectionStart ?? undefined,
      selectionEnd: inputElement.selectionEnd ?? undefined,
    };
    
    return this.createCapturedEvent(event.type as CapturableEvent, target, data, event.isTrusted);
  }
  
  /**
   * Processes keyboard events
   */
  private processKeyboardEvent(event: Event): CapturedEvent | null {
    const keyEvent = event as KeyboardEvent;
    const target = this.getEventTarget(event);
    if (!target) return null;
    
    const data: KeyboardEventData = {
      type: event.type as 'keydown' | 'keyup' | 'keypress',
      key: keyEvent.key,
      code: keyEvent.code,
      keyCode: keyEvent.keyCode,
      ctrlKey: keyEvent.ctrlKey,
      shiftKey: keyEvent.shiftKey,
      altKey: keyEvent.altKey,
      metaKey: keyEvent.metaKey,
      repeat: keyEvent.repeat,
      isComposing: keyEvent.isComposing,
    };
    
    return this.createCapturedEvent(event.type as CapturableEvent, target, data, event.isTrusted);
  }
  
  /**
   * Processes focus events
   */
  private processFocusEvent(event: Event): CapturedEvent | null {
    const focusEvent = event as FocusEvent;
    const target = this.getEventTarget(event);
    if (!target) return null;
    
    const data: FocusEventData = {
      type: event.type as 'focus' | 'blur',
      relatedTarget: focusEvent.relatedTarget instanceof Element
        ? this.extractElementInfo(focusEvent.relatedTarget)
        : undefined,
    };
    
    return this.createCapturedEvent(event.type as CapturableEvent, target, data, event.isTrusted);
  }
  
  /**
   * Processes scroll events
   */
  private processScrollEvent(event: Event): CapturedEvent | null {
    const target = this.getEventTarget(event) ?? document.documentElement;
    
    const scrollTarget = target instanceof Element ? target : document.documentElement;
    
    const data: ScrollEventData = {
      type: 'scroll',
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollTop: scrollTarget.scrollTop,
      scrollLeft: scrollTarget.scrollLeft,
      scrollWidth: scrollTarget.scrollWidth,
      scrollHeight: scrollTarget.scrollHeight,
    };
    
    return this.createCapturedEvent('scroll', scrollTarget, data, event.isTrusted);
  }
  
  /**
   * Processes drag events
   */
  private processDragEvent(event: Event): CapturedEvent | null {
    const dragEvent = event as DragEvent;
    const target = this.getEventTarget(event);
    if (!target) return null;
    
    const data: DragEventData = {
      type: event.type as 'dragstart' | 'dragend' | 'drop',
      clientX: dragEvent.clientX,
      clientY: dragEvent.clientY,
      dataTransfer: dragEvent.dataTransfer ? {
        types: Array.from(dragEvent.dataTransfer.types),
        effectAllowed: dragEvent.dataTransfer.effectAllowed,
        dropEffect: dragEvent.dataTransfer.dropEffect,
      } : undefined,
    };
    
    return this.createCapturedEvent(event.type as CapturableEvent, target, data, event.isTrusted);
  }
  
  /**
   * Processes clipboard events
   */
  private processClipboardEvent(event: Event): CapturedEvent | null {
    const clipEvent = event as ClipboardEvent;
    const target = this.getEventTarget(event);
    if (!target) return null;
    
    const data: ClipboardEventData = {
      type: event.type as 'copy' | 'cut' | 'paste',
      clipboardData: clipEvent.clipboardData ? {
        types: Array.from(clipEvent.clipboardData.types),
        hasText: clipEvent.clipboardData.types.includes('text/plain'),
        hasHtml: clipEvent.clipboardData.types.includes('text/html'),
      } : undefined,
    };
    
    return this.createCapturedEvent(event.type as CapturableEvent, target, data, event.isTrusted);
  }
  
  // ==========================================================================
  // ELEMENT INFO EXTRACTION
  // ==========================================================================
  
  /**
   * Creates a captured event
   */
  private createCapturedEvent(
    type: CapturableEvent,
    target: Element,
    data: EventData,
    isTrusted: boolean
  ): CapturedEvent {
    return {
      type,
      target: this.extractElementInfo(target),
      timestamp: Date.now(),
      data,
      isTrusted,
      iframeChain: this.getIframeChain(target),
      shadowHostChain: this.getShadowHostChain(target),
    };
  }
  
  /**
   * Extracts element information
   */
  extractElementInfo(element: Element): ElementInfo {
    const rect = element.getBoundingClientRect();
    
    let textContent = element.textContent?.trim() ?? '';
    if (textContent.length > this.options.maxTextLength) {
      textContent = textContent.slice(0, this.options.maxTextLength) + '...';
    }
    
    let value: string | undefined;
    if ('value' in element) {
      const inputElement = element as HTMLInputElement;
      if (this.options.sanitizeSensitive && this.isSensitiveInput(inputElement)) {
        value = '********';
      } else {
        value = inputElement.value;
      }
    }
    
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      classNames: Array.from(element.classList),
      name: element.getAttribute('name') ?? undefined,
      textContent,
      value,
      inputType: element.getAttribute('type') ?? undefined,
      attributes: this.extractRelevantAttributes(element),
      rect,
      xpath: this.generateXPath(element),
      cssSelector: this.generateCssSelector(element),
      aria: this.extractAriaAttributes(element),
      dataAttrs: this.extractDataAttributes(element),
      isVisible: this.isElementVisible(element),
      isInViewport: this.isInViewport(rect),
    };
  }
  
  /**
   * Extracts relevant attributes
   */
  private extractRelevantAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    const relevant = [
      'type', 'name', 'placeholder', 'href', 'src', 'alt', 'title',
      'role', 'for', 'action', 'method', 'target', 'rel',
    ];
    
    for (const attr of relevant) {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    }
    
    return attrs;
  }
  
  /**
   * Extracts ARIA attributes
   */
  private extractAriaAttributes(element: Element): Record<string, string> {
    const aria: Record<string, string> = {};
    
    for (const attr of element.getAttributeNames()) {
      if (attr.startsWith('aria-')) {
        aria[attr] = element.getAttribute(attr) ?? '';
      }
    }
    
    return aria;
  }
  
  /**
   * Extracts data attributes
   */
  private extractDataAttributes(element: Element): Record<string, string> {
    const data: Record<string, string> = {};
    const testingAttrs = ['data-testid', 'data-test', 'data-test-id', 'data-cy', 'data-qa'];
    
    for (const attr of testingAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        data[attr] = value;
      }
    }
    
    return data;
  }
  
  /**
   * Generates XPath for element
   */
  generateXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling: Element | null = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      const part = index > 1 || this.hasSameTagSibling(current)
        ? `${tagName}[${index}]`
        : tagName;
      parts.unshift(part);
      
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }
  
  /**
   * Checks if element has sibling with same tag
   */
  private hasSameTagSibling(element: Element): boolean {
    let sibling = element.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === element.tagName) {
        return true;
      }
      sibling = sibling.nextElementSibling;
    }
    return false;
  }
  
  /**
   * Generates CSS selector for element
   */
  generateCssSelector(element: Element): string {
    // Prefer ID
    if (element.id && !element.id.match(/^\d/)) {
      return `#${CSS.escape(element.id)}`;
    }
    
    // Try data-testid
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${CSS.escape(testId)}"]`;
    }
    
    // Build selector path
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body && parts.length < 5) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id && !current.id.match(/^\d/)) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      
      // Add stable classes
      const stableClasses = Array.from(current.classList)
        .filter(c => !this.isDynamicClass(c))
        .slice(0, 2);
      
      if (stableClasses.length > 0) {
        selector += '.' + stableClasses.map(c => CSS.escape(c)).join('.');
      }
      
      // Add nth-child if needed
      const siblings = current.parentElement?.children ?? [];
      const sameTagSiblings = Array.from(siblings).filter(
        s => s.tagName === current!.tagName
      );
      
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
      
      parts.unshift(selector);
      current = current.parentElement;
    }
    
    return parts.join(' > ');
  }
  
  /**
   * Checks if class name appears dynamic
   */
  private isDynamicClass(className: string): boolean {
    // Common patterns for dynamic classes
    const dynamicPatterns = [
      /^[a-z]{1,3}[_-][a-zA-Z0-9]{5,}$/, // CSS modules
      /^[A-Z][a-z]+__[a-z]+--[a-z]+$/, // BEM with hash
      /^css-[a-zA-Z0-9]+$/, // Emotion
      /^sc-[a-zA-Z]+$/, // Styled components
      /^_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/, // CSS modules variant
      /^ng-[a-z]+$/, // Angular
    ];
    
    return dynamicPatterns.some(p => p.test(className));
  }
  
  // ==========================================================================
  // IFRAME & SHADOW DOM
  // ==========================================================================
  
  /**
   * Gets iframe chain for element
   */
  private getIframeChain(element: Element): FrameInfo[] | undefined {
    const chain: FrameInfo[] = [];
    let current: Window | null = element.ownerDocument?.defaultView ?? null;
    
    while (current && current !== window.top) {
      const frameElement = current.frameElement as HTMLIFrameElement | null;
      
      if (frameElement) {
        chain.unshift({
          id: frameElement.id || undefined,
          name: frameElement.name || undefined,
          src: frameElement.src || undefined,
          index: this.getFrameIndex(frameElement),
        });
      }
      
      current = current.parent;
    }
    
    return chain.length > 0 ? chain : undefined;
  }
  
  /**
   * Gets frame index among siblings
   */
  private getFrameIndex(frame: HTMLIFrameElement): number {
    const frames = frame.parentElement?.querySelectorAll('iframe') ?? [];
    return Array.from(frames).indexOf(frame);
  }
  
  /**
   * Gets shadow host chain for element
   */
  private getShadowHostChain(element: Element): ElementInfo[] | undefined {
    const chain: ElementInfo[] = [];
    let current: Node | null = element;
    
    while (current) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        chain.unshift(this.extractElementInfo(root.host));
        current = root.host;
      } else {
        break;
      }
    }
    
    return chain.length > 0 ? chain : undefined;
  }
  
  /**
   * Observes iframes for event capture
   */
  private observeIframes(): void {
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      this.attachToIframe(iframe as HTMLIFrameElement);
    }
  }
  
  /**
   * Attaches listeners to iframe
   */
  private attachToIframe(iframe: HTMLIFrameElement): void {
    if (this.observedIframes.has(iframe)) return;
    
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) {
        this.attachListeners(iframeDoc);
        this.observedIframes.add(iframe);
      }
    } catch {
      // Cross-origin iframe, cannot access
    }
  }
  
  /**
   * Observes shadow roots for event capture
   */
  private observeShadowRoots(): void {
    // Query all elements and check for shadow roots
    const elements = document.querySelectorAll('*');
    
    for (const element of elements) {
      if (element.shadowRoot && !this.observedShadowRoots.has(element.shadowRoot)) {
        this.attachListeners(element.shadowRoot);
        this.observedShadowRoots.add(element.shadowRoot);
      }
    }
  }
  
  /**
   * Sets up mutation observer for dynamic content
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement && this.options.captureIframes) {
            this.attachToIframe(node);
          }
          
          if (node instanceof Element && node.shadowRoot && this.options.captureShadowDom) {
            if (!this.observedShadowRoots.has(node.shadowRoot)) {
              this.attachListeners(node.shadowRoot);
              this.observedShadowRoots.add(node.shadowRoot);
            }
          }
        }
      }
    });
    
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Checks if input is sensitive
   */
  private isSensitiveInput(element: HTMLInputElement | HTMLTextAreaElement): boolean {
    const type = element.getAttribute('type')?.toLowerCase() ?? '';
    const autocomplete = element.getAttribute('autocomplete')?.toLowerCase() ?? '';
    const name = element.getAttribute('name')?.toLowerCase() ?? '';
    
    // Check type
    if (SENSITIVE_INPUT_TYPES.includes(type as typeof SENSITIVE_INPUT_TYPES[number])) {
      return true;
    }
    
    // Check autocomplete hints
    const sensitiveAutocomplete = ['cc-', 'password', 'current-password', 'new-password'];
    if (sensitiveAutocomplete.some(s => autocomplete.includes(s))) {
      return true;
    }
    
    // Check name patterns
    const sensitiveNames = ['password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey'];
    if (sensitiveNames.some(s => name.includes(s))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Checks if rect is in viewport
   */
  private isInViewport(rect: DOMRect): boolean {
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new EventCapture instance
 * 
 * @param config - Configuration
 * @returns New EventCapture instance
 */
export function createEventCapture(config: {
  options?: Partial<EventCaptureOptions>;
  onCapture: CaptureCallback;
}): EventCapture {
  return new EventCapture(config);
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Converts captured event to recorded step
 */
export function capturedEventToStep(captured: CapturedEvent): Partial<RecordedStep> {
  const stepType = mapEventTypeToStepType(captured.type);
  
  return {
    type: stepType,
    timestamp: captured.timestamp,
    target: {
      tagName: captured.target.tagName,
      id: captured.target.id,
      className: captured.target.classNames.join(' '),
      name: captured.target.name,
      xpath: captured.target.xpath,
      cssSelector: captured.target.cssSelector,
      textContent: captured.target.textContent,
      attributes: captured.target.attributes,
    },
    value: getStepValue(captured),
    metadata: {
      ...captured.data,
      iframeChain: captured.iframeChain,
      shadowHostChain: captured.shadowHostChain,
    },
  };
}

/**
 * Maps event type to step type
 */
function mapEventTypeToStepType(eventType: CapturableEvent): StepType {
  switch (eventType) {
    case 'click':
    case 'mousedown':
    case 'mouseup':
      return 'click';
    case 'dblclick':
      return 'dblclick';
    case 'input':
    case 'change':
      return 'input';
    case 'keydown':
    case 'keyup':
    case 'keypress':
      return 'keypress';
    case 'scroll':
      return 'scroll';
    case 'select':
      return 'select';
    case 'focus':
      return 'focus';
    case 'blur':
      return 'blur';
    case 'submit':
      return 'submit';
    case 'dragstart':
    case 'dragend':
    case 'drop':
      return 'drag';
    case 'copy':
    case 'cut':
    case 'paste':
      return 'keypress'; // Map to keypress for now
    default:
      return 'click';
  }
}

/**
 * Gets step value from captured event
 */
function getStepValue(captured: CapturedEvent): string | undefined {
  const data = captured.data;
  
  if ('value' in data && typeof data.value === 'string') {
    return data.value;
  }
  
  if ('key' in data) {
    return data.key;
  }
  
  return undefined;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default EventCapture;
