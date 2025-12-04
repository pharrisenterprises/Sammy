/**
 * EventRecorder - User Interaction Capture
 * @module core/content/EventRecorder
 * @version 1.0.0
 * 
 * Implements IEventRecorder for capturing user interactions during
 * recording mode. Attaches event listeners to document and builds
 * LocatorBundle for each captured element.
 * 
 * ## Event Types Captured
 * - mousedown: Click events (buttons, links, etc.)
 * - input: Text input and value changes
 * - keydown: Keyboard events (Enter key submission)
 * - change: Select and checkbox changes
 * - focus/blur: Focus tracking for context
 * 
 * @example
 * ```typescript
 * const recorder = new EventRecorder();
 * 
 * recorder.onEvent((event) => {
 *   console.log('Captured:', event.eventType, event.label);
 * });
 * 
 * recorder.start();
 * // User interacts with page...
 * recorder.stop();
 * ```
 */

import type {
  IEventRecorder,
  RecordingState,
  RecordedEvent,
  RecordedEventType,
  RecordedEventHandler,
} from './IContentScript';

import {
  createEmptyRecordingState,
  createRecordedEvent,
} from './IContentScript';

import type { LocatorBundle } from '../types';
import { createBundle } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event recorder configuration
 */
export interface EventRecorderConfig {
  /** Debounce delay for input events in ms */
  inputDebounceMs?: number;
  
  /** Whether to capture focus/blur events */
  captureFocusEvents?: boolean;
  
  /** Whether to capture navigation events */
  captureNavigationEvents?: boolean;
  
  /** Elements to ignore (selectors) */
  ignoreSelectors?: string[];
  
  /** Whether to log debug info */
  debug?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_RECORDER_CONFIG: Required<EventRecorderConfig> = {
  inputDebounceMs: 300,
  captureFocusEvents: false,
  captureNavigationEvents: true,
  ignoreSelectors: [
    '[data-recorder-ignore]',
    '.recorder-ignore',
  ],
  debug: false,
};

/**
 * Pending input event (for debouncing)
 */
interface PendingInput {
  element: HTMLElement;
  value: string;
  timeout: ReturnType<typeof setTimeout>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate XPath for element
 */
export function generateXPath(element: Element): string {
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
    let selector = current.tagName.toLowerCase();
    
    // Add index if needed
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `[${index}]`;
      }
    }
    
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return '/' + parts.join('/');
}

/**
 * Get element label (text content, aria-label, placeholder, etc.)
 */
export function getElementLabel(element: Element): string {
  // Aria label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  // Title attribute
  const title = element.getAttribute('title');
  if (title) return title;
  
  // Placeholder for inputs
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) return element.placeholder;
  }
  
  // Associated label
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }
  }
  
  // Text content (for buttons, links)
  const text = element.textContent?.trim();
  if (text && text.length < 100) {
    return text;
  }
  
  // Tag name fallback
  return element.tagName.toLowerCase();
}

/**
 * Get element value
 */
export function getElementValue(element: Element): string {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      return element.checked ? 'checked' : 'unchecked';
    }
    return element.value;
  }
  
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  
  if (element instanceof HTMLSelectElement) {
    return element.value;
  }
  
  return '';
}

/**
 * Build LocatorBundle from element
 */
export function buildLocatorBundle(element: Element): LocatorBundle {
  const rect = element.getBoundingClientRect();
  
  return createBundle({
    xpath: generateXPath(element),
    id: element.id || undefined,
    name: element.getAttribute('name') || undefined,
    tag: element.tagName.toLowerCase(),
    text: element.textContent?.trim().substring(0, 100) || undefined,
    placeholder: element.getAttribute('placeholder') || undefined,
    aria: element.getAttribute('aria-label') || undefined,
    classes: Array.from(element.classList),
    dataAttrs: getDataAttributes(element),
    css: generateCssSelector(element),
    pageUrl: window.location.href,
    bounding: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  });
}

/**
 * Get data attributes from element
 */
function getDataAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value;
    }
  }
  
  return attrs;
}

/**
 * Generate CSS selector for element
 */
function generateCssSelector(element: Element): string {
  // ID selector
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Build selector
  let selector = element.tagName.toLowerCase();
  
  // Add classes (first 3)
  const classes = Array.from(element.classList).slice(0, 3);
  if (classes.length > 0) {
    selector += '.' + classes.join('.');
  }
  
  // Add name attribute
  const name = element.getAttribute('name');
  if (name) {
    selector += `[name="${name}"]`;
  }
  
  return selector;
}

/**
 * Get actual target from event (handles shadow DOM)
 */
export function getEventTarget(event: Event): Element | null {
  // Use composedPath for shadow DOM
  const path = event.composedPath();
  
  if (path.length > 0 && path[0] instanceof Element) {
    return path[0];
  }
  
  return event.target instanceof Element ? event.target : null;
}

/**
 * Determine event type from DOM event
 */
export function determineEventType(event: Event, element: Element): RecordedEventType | null {
  if (event.type === 'mousedown' || event.type === 'click') {
    return 'click';
  }
  
  if (event.type === 'input' || event.type === 'change') {
    if (element instanceof HTMLSelectElement) {
      return 'select';
    }
    return 'input';
  }
  
  if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Enter') {
    return 'enter';
  }
  
  if (event.type === 'focus') {
    return 'focus';
  }
  
  if (event.type === 'blur') {
    return 'blur';
  }
  
  if (event.type === 'submit') {
    return 'submit';
  }
  
  return null;
}

// ============================================================================
// EVENT RECORDER CLASS
// ============================================================================

/**
 * Event Recorder implementation
 */
export class EventRecorder implements IEventRecorder {
  private config: Required<EventRecorderConfig>;
  private state: RecordingState;
  private handlers: Set<RecordedEventHandler> = new Set();
  private pendingInputs: Map<Element, PendingInput> = new Map();
  private boundHandlers: {
    click: (e: Event) => void;
    input: (e: Event) => void;
    keydown: (e: Event) => void;
    change: (e: Event) => void;
    focus: (e: Event) => void;
    blur: (e: Event) => void;
    submit: (e: Event) => void;
  };
  private attachedDocuments: Set<Document> = new Set();
  
  constructor(config?: Partial<EventRecorderConfig>) {
    this.config = {
      ...DEFAULT_RECORDER_CONFIG,
      ...config,
    };
    
    this.state = createEmptyRecordingState();
    
    // Bind handlers
    this.boundHandlers = {
      click: this.handleClick.bind(this),
      input: this.handleInput.bind(this),
      keydown: this.handleKeydown.bind(this),
      change: this.handleChange.bind(this),
      focus: this.handleFocus.bind(this),
      blur: this.handleBlur.bind(this),
      submit: this.handleSubmit.bind(this),
    };
  }
  
  // ==========================================================================
  // IEventRecorder IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Start recording
   */
  start(projectId?: number): void {
    if (this.state.active) {
      return;
    }
    
    this.state = {
      active: true,
      eventsCaptured: 0,
      lastEventTime: undefined,
      projectId,
    };
    
    // Attach to main document
    this.attachListeners(document);
    
    this.log('Recording started', { projectId });
  }
  
  /**
   * Stop recording
   */
  stop(): void {
    if (!this.state.active) {
      return;
    }
    
    // Flush pending inputs
    this.flushPendingInputs();
    
    // Detach from all documents
    for (const doc of this.attachedDocuments) {
      this.detachListeners(doc);
    }
    this.attachedDocuments.clear();
    
    this.state = {
      ...this.state,
      active: false,
    };
    
    this.log('Recording stopped', { eventsCaptured: this.state.eventsCaptured });
  }
  
  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.state.active;
  }
  
  /**
   * Get recording state
   */
  getState(): RecordingState {
    return { ...this.state };
  }
  
  /**
   * Register event handler
   */
  onEvent(handler: RecordedEventHandler): void {
    this.handlers.add(handler);
  }
  
  /**
   * Remove event handler
   */
  offEvent(handler: RecordedEventHandler): void {
    this.handlers.delete(handler);
  }
  
  /**
   * Get captured event count
   */
  getEventCount(): number {
    return this.state.eventsCaptured;
  }
  
  /**
   * Clear captured events (resets count)
   */
  clearEvents(): void {
    this.state = {
      ...this.state,
      eventsCaptured: 0,
      lastEventTime: undefined,
    };
  }
  
  // ==========================================================================
  // LISTENER MANAGEMENT
  // ==========================================================================
  
  /**
   * Attach listeners to document
   */
  attachListeners(doc: Document): void {
    if (this.attachedDocuments.has(doc)) {
      return;
    }
    
    // Use capture phase (true) to see events before page handlers
    doc.addEventListener('mousedown', this.boundHandlers.click, true);
    doc.addEventListener('input', this.boundHandlers.input, true);
    doc.addEventListener('keydown', this.boundHandlers.keydown, true);
    doc.addEventListener('change', this.boundHandlers.change, true);
    doc.addEventListener('submit', this.boundHandlers.submit, true);
    
    if (this.config.captureFocusEvents) {
      doc.addEventListener('focus', this.boundHandlers.focus, true);
      doc.addEventListener('blur', this.boundHandlers.blur, true);
    }
    
    this.attachedDocuments.add(doc);
    this.log('Listeners attached', { documentTitle: doc.title });
  }
  
  /**
   * Detach listeners from document
   */
  detachListeners(doc: Document): void {
    doc.removeEventListener('mousedown', this.boundHandlers.click, true);
    doc.removeEventListener('input', this.boundHandlers.input, true);
    doc.removeEventListener('keydown', this.boundHandlers.keydown, true);
    doc.removeEventListener('change', this.boundHandlers.change, true);
    doc.removeEventListener('submit', this.boundHandlers.submit, true);
    
    if (this.config.captureFocusEvents) {
      doc.removeEventListener('focus', this.boundHandlers.focus, true);
      doc.removeEventListener('blur', this.boundHandlers.blur, true);
    }
    
    this.attachedDocuments.delete(doc);
  }
  
  /**
   * Attach to iframe document
   */
  attachToIframe(iframe: HTMLIFrameElement): boolean {
    try {
      const doc = iframe.contentDocument;
      if (doc) {
        this.attachListeners(doc);
        return true;
      }
    } catch {
      // Cross-origin iframe - cannot attach
    }
    return false;
  }
  
  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================
  
  /**
   * Handle click event
   */
  private handleClick(event: Event): void {
    if (!this.state.active) return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    
    const eventType = determineEventType(event, element);
    if (eventType !== 'click') return;
    
    const mouseEvent = event as MouseEvent;
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('click', bundle, {
      label: getElementLabel(element),
      value: getElementValue(element),
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  /**
   * Handle input event (debounced)
   */
  private handleInput(event: Event): void {
    if (!this.state.active) return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
    
    // Cancel existing pending input for this element
    const pending = this.pendingInputs.get(element);
    if (pending) {
      clearTimeout(pending.timeout);
    }
    
    // Create new pending input with debounce
    const timeout = setTimeout(() => {
      this.flushInput(element as HTMLInputElement | HTMLTextAreaElement);
    }, this.config.inputDebounceMs);
    
    this.pendingInputs.set(element, {
      element: element as HTMLElement,
      value: getElementValue(element),
      timeout,
    });
  }
  
  /**
   * Handle keydown event
   */
  private handleKeydown(event: Event): void {
    if (!this.state.active) return;
    
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'Enter') return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    
    // Flush any pending input first
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      this.flushInput(element);
    }
    
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('enter', bundle, {
      label: getElementLabel(element),
      value: getElementValue(element),
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  /**
   * Handle change event (for selects)
   */
  private handleChange(event: Event): void {
    if (!this.state.active) return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    
    // Only handle select elements here (input handled by handleInput)
    if (!(element instanceof HTMLSelectElement)) return;
    
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('select', bundle, {
      label: getElementLabel(element),
      value: element.value,
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  /**
   * Handle focus event
   */
  private handleFocus(event: Event): void {
    if (!this.state.active) return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('focus', bundle, {
      label: getElementLabel(element),
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  /**
   * Handle blur event
   */
  private handleBlur(event: Event): void {
    if (!this.state.active) return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    
    // Flush any pending input on blur
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      this.flushInput(element);
    }
    
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('blur', bundle, {
      label: getElementLabel(element),
      value: getElementValue(element),
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  /**
   * Handle form submit event
   */
  private handleSubmit(event: Event): void {
    if (!this.state.active) return;
    
    const element = getEventTarget(event);
    if (!element || this.shouldIgnore(element)) return;
    
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('submit', bundle, {
      label: getElementLabel(element),
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  /**
   * Flush pending input for element
   */
  private flushInput(element: HTMLInputElement | HTMLTextAreaElement): void {
    const pending = this.pendingInputs.get(element);
    if (!pending) return;
    
    clearTimeout(pending.timeout);
    this.pendingInputs.delete(element);
    
    const bundle = buildLocatorBundle(element);
    
    const recordedEvent = createRecordedEvent('input', bundle, {
      label: getElementLabel(element),
      value: pending.value,
      page: window.location.href,
    });
    
    this.dispatchEvent(recordedEvent);
  }
  
  /**
   * Flush all pending inputs
   */
  private flushPendingInputs(): void {
    for (const [element] of this.pendingInputs) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        this.flushInput(element);
      }
    }
  }
  
  /**
   * Check if element should be ignored
   */
  private shouldIgnore(element: Element): boolean {
    for (const selector of this.config.ignoreSelectors) {
      if (element.matches(selector)) {
        return true;
      }
      if (element.closest(selector)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Dispatch event to handlers
   */
  private dispatchEvent(event: RecordedEvent): void {
    this.state = {
      ...this.state,
      eventsCaptured: this.state.eventsCaptured + 1,
      lastEventTime: event.timestamp,
    };
    
    this.log('Event captured', { type: event.eventType, label: event.label });
    
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }
  
  /**
   * Log debug message
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[EventRecorder] ${message}`, data);
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Get configuration
   */
  getConfig(): Required<EventRecorderConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<EventRecorderConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
  
  /**
   * Get attached document count
   */
  getAttachedDocumentCount(): number {
    return this.attachedDocuments.size;
  }
  
  /**
   * Get handler count
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an EventRecorder
 */
export function createEventRecorder(
  config?: Partial<EventRecorderConfig>
): EventRecorder {
  return new EventRecorder(config);
}

/**
 * Create event recorder with debug logging
 */
export function createDebugRecorder(): EventRecorder {
  return new EventRecorder({ debug: true });
}

/**
 * Create event recorder with focus events
 */
export function createFullRecorder(): EventRecorder {
  return new EventRecorder({ 
    captureFocusEvents: true,
    debug: false,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultRecorder: EventRecorder | null = null;

/**
 * Get default event recorder instance
 */
export function getEventRecorder(): EventRecorder {
  if (!defaultRecorder) {
    defaultRecorder = new EventRecorder();
  }
  return defaultRecorder;
}

/**
 * Reset default event recorder
 */
export function resetEventRecorder(): void {
  if (defaultRecorder) {
    defaultRecorder.stop();
    defaultRecorder = null;
  }
}
