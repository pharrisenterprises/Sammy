/**
 * EventCapture - DOM Event Processing and Data Extraction
 * @module core/recording/EventCapture
 * @version 1.0.0
 * 
 * Processes captured DOM events and extracts relevant data for recording.
 * Handles:
 * - Click events (buttons, links, checkboxes, radio buttons, Select2)
 * - Input events (text inputs, textareas, contenteditable)
 * - Keyboard events (Enter key for form submission)
 * - Event filtering (synthetic vs trusted events)
 * - Value extraction from various input types
 * 
 * @see recording-engine_breakdown.md for context
 * @see EventListenerManager for event attachment
 */

import type { CaptureEventType } from './IRecordingEngine';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Captured event data extracted from DOM event
 */
export interface CapturedEventData {
  /** Type of event that was captured */
  eventType: CaptureEventType;
  
  /** Normalized action type for recording */
  actionType: ActionType;
  
  /** Target element that received the event */
  target: Element;
  
  /** Original DOM event */
  originalEvent: Event;
  
  /** Value extracted from input (if applicable) */
  value: string | null;
  
  /** Whether this was a trusted (user-initiated) event */
  isTrusted: boolean;
  
  /** Click coordinates (for click events) */
  coordinates: EventCoordinates | null;
  
  /** Timestamp of the event */
  timestamp: number;
  
  /** Additional metadata about the event */
  metadata: EventMetadata;
}

/**
 * Normalized action types for recorded steps
 */
export type ActionType = 
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'enter'
  | 'tab'
  | 'escape'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'navigate';

/**
 * Event coordinates for click events
 */
export interface EventCoordinates {
  /** X coordinate relative to viewport */
  clientX: number;
  
  /** Y coordinate relative to viewport */
  clientY: number;
  
  /** X coordinate relative to page */
  pageX: number;
  
  /** Y coordinate relative to page */
  pageY: number;
  
  /** X coordinate relative to target element */
  offsetX: number;
  
  /** Y coordinate relative to target element */
  offsetY: number;
}

/**
 * Additional metadata about captured event
 */
export interface EventMetadata {
  /** Tag name of target element */
  tagName: string;
  
  /** Input type (for input elements) */
  inputType: string | null;
  
  /** Whether element is contenteditable */
  isContentEditable: boolean;
  
  /** Whether this is a form submission trigger */
  isFormSubmit: boolean;
  
  /** Whether this is a navigation trigger */
  isNavigation: boolean;
  
  /** Whether target is a Select2 component */
  isSelect2: boolean;
  
  /** Whether target is a checkbox */
  isCheckbox: boolean;
  
  /** Whether target is a radio button */
  isRadio: boolean;
  
  /** Checkbox/radio checked state */
  isChecked: boolean | null;
  
  /** Key pressed (for keyboard events) */
  key: string | null;
  
  /** Key code (for keyboard events) */
  keyCode: number | null;
  
  /** Modifier keys state */
  modifiers: ModifierKeys;
  
  /** Element path from composed path */
  composedPath: Element[];
}

/**
 * Modifier key states
 */
export interface ModifierKeys {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Configuration for event capture
 */
export interface EventCaptureConfig {
  /** Filter out synthetic (programmatic) events */
  filterSyntheticEvents: boolean;
  
  /** Debounce delay for input events (ms) */
  inputDebounceMs: number;
  
  /** Minimum time between duplicate events (ms) */
  dedupeIntervalMs: number;
  
  /** Whether to capture coordinates for clicks */
  captureCoordinates: boolean;
  
  /** Whether to capture modifier key state */
  captureModifiers: boolean;
  
  /** Whether to resolve Select2 to original select */
  resolveSelect2: boolean;
}

/**
 * Callback for processed events
 */
export type EventCaptureCallback = (data: CapturedEventData) => void;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default event capture configuration
 */
export const DEFAULT_CAPTURE_CONFIG: EventCaptureConfig = {
  filterSyntheticEvents: true,
  inputDebounceMs: 300,
  dedupeIntervalMs: 50,
  captureCoordinates: true,
  captureModifiers: true,
  resolveSelect2: true,
};

// ============================================================================
// EVENT CAPTURE CLASS
// ============================================================================

/**
 * Processes DOM events and extracts recording data
 * 
 * @example
 * ```typescript
 * const capture = new EventCapture({
 *   filterSyntheticEvents: true,
 *   inputDebounceMs: 300,
 * });
 * 
 * capture.setCallback((data) => {
 *   console.log('Captured:', data.actionType, data.target);
 * });
 * 
 * // Process an event
 * capture.processEvent(clickEvent);
 * ```
 */
export class EventCapture {
  private config: EventCaptureConfig;
  private callback: EventCaptureCallback | null;
  private inputDebounceTimers: Map<Element, NodeJS.Timeout>;
  private lastEventTimestamps: Map<string, number>;
  private pendingInputValues: Map<Element, string>;
  private pendingInputEvents: Map<Element, Event>;
  private pendingInputMetadata: Map<Element, EventMetadata>;
  
  /**
   * Create a new EventCapture instance
   */
  constructor(config?: Partial<EventCaptureConfig>) {
    this.config = { ...DEFAULT_CAPTURE_CONFIG, ...config };
    this.callback = null;
    this.inputDebounceTimers = new Map();
    this.lastEventTimestamps = new Map();
    this.pendingInputValues = new Map();
    this.pendingInputEvents = new Map();
    this.pendingInputMetadata = new Map();
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Set the callback for processed events
   */
  setCallback(callback: EventCaptureCallback): void {
    this.callback = callback;
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EventCaptureConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): EventCaptureConfig {
    return { ...this.config };
  }
  
  // ==========================================================================
  // EVENT PROCESSING
  // ==========================================================================
  
  /**
   * Process a captured DOM event
   * 
   * @param event - The DOM event to process
   * @returns Captured event data, or null if event should be ignored
   */
  processEvent(event: Event): CapturedEventData | null {
    // Filter synthetic events if configured
    if (this.config.filterSyntheticEvents && !event.isTrusted) {
      return null;
    }
    
    // Get the target element
    const target = this.resolveTarget(event);
    if (!target) {
      return null;
    }
    
    // Check for duplicate events
    if (this.isDuplicateEvent(event, target)) {
      return null;
    }
    
    // Process based on event type
    const eventType = event.type as CaptureEventType;
    let capturedData: CapturedEventData | null = null;
    
    switch (eventType) {
      case 'click':
      case 'mousedown':
      case 'mouseup':
        capturedData = this.processClickEvent(event as MouseEvent, target);
        break;
        
      case 'dblclick':
        capturedData = this.processDblClickEvent(event as MouseEvent, target);
        break;
        
      case 'input':
      case 'change':
        capturedData = this.processInputEvent(event, target);
        break;
        
      case 'keydown':
      case 'keyup':
      case 'keypress':
        capturedData = this.processKeyboardEvent(event as KeyboardEvent, target);
        break;
        
      case 'focus':
        capturedData = this.processFocusEvent(event as FocusEvent, target);
        break;
        
      case 'blur':
        capturedData = this.processBlurEvent(event as FocusEvent, target);
        break;
        
      case 'submit':
        capturedData = this.processSubmitEvent(event, target);
        break;
        
      case 'scroll':
        capturedData = this.processScrollEvent(event, target);
        break;
        
      default:
        capturedData = this.processGenericEvent(event, target);
    }
    
    // Emit to callback if we have captured data
    if (capturedData && this.callback) {
      this.callback(capturedData);
    }
    
    return capturedData;
  }
  
  // ==========================================================================
  // CLICK EVENT PROCESSING
  // ==========================================================================
  
  /**
   * Process a click event
   */
  private processClickEvent(event: MouseEvent, target: Element): CapturedEventData | null {
    const metadata = this.extractMetadata(event, target);
    
    // Determine action type based on element
    let actionType: ActionType = 'click';
    
    if (metadata.isCheckbox) {
      actionType = metadata.isChecked ? 'check' : 'uncheck';
    } else if (metadata.isRadio) {
      actionType = 'select';
    } else if (metadata.isNavigation) {
      actionType = 'navigate';
    }
    
    // Extract value for checkboxes/radios
    let value: string | null = null;
    if (metadata.isCheckbox || metadata.isRadio) {
      value = (target as HTMLInputElement).value || null;
    }
    
    return {
      eventType: event.type as CaptureEventType,
      actionType,
      target: this.config.resolveSelect2 ? this.resolveSelect2Element(target) : target,
      originalEvent: event,
      value,
      isTrusted: event.isTrusted,
      coordinates: this.config.captureCoordinates ? this.extractCoordinates(event) : null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  /**
   * Process a double-click event
   */
  private processDblClickEvent(event: MouseEvent, target: Element): CapturedEventData {
    const metadata = this.extractMetadata(event, target);
    
    return {
      eventType: 'dblclick',
      actionType: 'dblclick',
      target,
      originalEvent: event,
      value: null,
      isTrusted: event.isTrusted,
      coordinates: this.config.captureCoordinates ? this.extractCoordinates(event) : null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  // ==========================================================================
  // INPUT EVENT PROCESSING
  // ==========================================================================
  
  /**
   * Process an input or change event
   */
  private processInputEvent(event: Event, target: Element): CapturedEventData | null {
    const metadata = this.extractMetadata(event, target);
    const value = this.extractValue(target);
    
    // For input events, apply debouncing
    if (event.type === 'input' && this.config.inputDebounceMs > 0) {
      return this.handleDebouncedInput(event, target, value, metadata);
    }
    
    return {
      eventType: event.type as CaptureEventType,
      actionType: metadata.isCheckbox || metadata.isRadio ? 'change' : 'input',
      target,
      originalEvent: event,
      value,
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  /**
   * Handle debounced input events
   */
  private handleDebouncedInput(
    event: Event,
    target: Element,
    value: string | null,
    metadata: EventMetadata
  ): CapturedEventData | null {
    // Store pending value, event, and metadata
    this.pendingInputValues.set(target, value || '');
    this.pendingInputEvents.set(target, event);
    this.pendingInputMetadata.set(target, metadata);
    
    // Clear existing timer
    const existingTimer = this.inputDebounceTimers.get(target);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      const finalValue = this.pendingInputValues.get(target) || '';
      const finalEvent = this.pendingInputEvents.get(target);
      const finalMetadata = this.pendingInputMetadata.get(target);
      
      this.pendingInputValues.delete(target);
      this.pendingInputEvents.delete(target);
      this.pendingInputMetadata.delete(target);
      this.inputDebounceTimers.delete(target);
      
      if (finalEvent && finalMetadata) {
        const capturedData: CapturedEventData = {
          eventType: 'input',
          actionType: 'input',
          target,
          originalEvent: finalEvent,
          value: finalValue,
          isTrusted: finalEvent.isTrusted,
          coordinates: null,
          timestamp: Date.now(),
          metadata: finalMetadata,
        };
        
        if (this.callback) {
          this.callback(capturedData);
        }
      }
    }, this.config.inputDebounceMs);
    
    this.inputDebounceTimers.set(target, timer);
    
    // Return null - the debounced callback will emit the event
    return null;
  }
  
  // ==========================================================================
  // KEYBOARD EVENT PROCESSING
  // ==========================================================================
  
  /**
   * Process a keyboard event
   */
  private processKeyboardEvent(event: KeyboardEvent, target: Element): CapturedEventData | null {
    const metadata = this.extractMetadata(event, target);
    
    // Only capture specific keys
    let actionType: ActionType | null = null;
    
    switch (event.key) {
      case 'Enter':
        actionType = 'enter';
        break;
      case 'Tab':
        actionType = 'tab';
        break;
      case 'Escape':
        actionType = 'escape';
        break;
      default:
        // Don't capture other key events
        return null;
    }
    
    // For keydown only (avoid duplicates with keyup)
    if (event.type !== 'keydown') {
      return null;
    }
    
    return {
      eventType: event.type as CaptureEventType,
      actionType,
      target,
      originalEvent: event,
      value: this.extractValue(target),
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  // ==========================================================================
  // FOCUS/BLUR EVENT PROCESSING
  // ==========================================================================
  
  /**
   * Process a focus event
   */
  private processFocusEvent(event: FocusEvent, target: Element): CapturedEventData {
    const metadata = this.extractMetadata(event, target);
    
    return {
      eventType: 'focus',
      actionType: 'focus',
      target,
      originalEvent: event,
      value: null,
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  /**
   * Process a blur event
   */
  private processBlurEvent(event: FocusEvent, target: Element): CapturedEventData {
    const metadata = this.extractMetadata(event, target);
    
    // Flush any pending input value
    this.flushPendingInput(target);
    
    return {
      eventType: 'blur',
      actionType: 'blur',
      target,
      originalEvent: event,
      value: this.extractValue(target),
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  // ==========================================================================
  // OTHER EVENT PROCESSING
  // ==========================================================================
  
  /**
   * Process a form submit event
   */
  private processSubmitEvent(event: Event, target: Element): CapturedEventData {
    const metadata = this.extractMetadata(event, target);
    metadata.isFormSubmit = true;
    
    return {
      eventType: 'submit',
      actionType: 'enter',
      target,
      originalEvent: event,
      value: null,
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  /**
   * Process a scroll event
   */
  private processScrollEvent(event: Event, target: Element): CapturedEventData {
    const metadata = this.extractMetadata(event, target);
    
    return {
      eventType: 'scroll',
      actionType: 'scroll',
      target,
      originalEvent: event,
      value: null,
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  /**
   * Process a generic event
   */
  private processGenericEvent(event: Event, target: Element): CapturedEventData {
    const metadata = this.extractMetadata(event, target);
    
    return {
      eventType: event.type as CaptureEventType,
      actionType: 'click', // Default to click for unknown events
      target,
      originalEvent: event,
      value: null,
      isTrusted: event.isTrusted,
      coordinates: null,
      timestamp: Date.now(),
      metadata,
    };
  }
  
  // ==========================================================================
  // TARGET RESOLUTION
  // ==========================================================================
  
  /**
   * Resolve the actual target element from event
   */
  private resolveTarget(event: Event): Element | null {
    // Try composed path first (handles shadow DOM)
    if (event.composedPath) {
      const path = event.composedPath();
      for (const node of path) {
        if (node instanceof Element) {
          return node;
        }
      }
    }
    
    // Fall back to event.target
    const target = event.target;
    if (target instanceof Element) {
      return target;
    }
    
    return null;
  }
  
  /**
   * Resolve Select2 styled element to original select
   */
  private resolveSelect2Element(target: Element): Element {
    if (!this.config.resolveSelect2) {
      return target;
    }
    
    // Check if this is a Select2 container
    const isSelect2 = 
      target.classList.contains('select2-selection') ||
      target.classList.contains('select2-selection__rendered') ||
      target.closest('.select2-container');
    
    if (!isSelect2) {
      return target;
    }
    
    // Find the original select element
    const container = target.closest('.select2-container');
    if (!container) {
      return target;
    }
    
    // Select2 stores reference to original in data attribute
    const selectId = container.getAttribute('data-select2-id');
    if (selectId) {
      const originalSelect = document.querySelector(`select[data-select2-id="${selectId}"]`);
      if (originalSelect) {
        return originalSelect;
      }
    }
    
    // Try finding adjacent select
    const sibling = container.previousElementSibling;
    if (sibling instanceof HTMLSelectElement) {
      return sibling;
    }
    
    return target;
  }
  
  // ==========================================================================
  // VALUE EXTRACTION
  // ==========================================================================
  
  /**
   * Extract value from an element
   */
  private extractValue(element: Element): string | null {
    // Input elements
    if (element instanceof HTMLInputElement) {
      switch (element.type) {
        case 'checkbox':
        case 'radio':
          return element.checked ? element.value || 'on' : '';
        case 'file':
          return element.files?.[0]?.name || null;
        default:
          return element.value;
      }
    }
    
    // Textarea
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    
    // Select
    if (element instanceof HTMLSelectElement) {
      return element.value;
    }
    
    // Contenteditable
    if (element.hasAttribute('contenteditable')) {
      return element.textContent || element.innerHTML;
    }
    
    return null;
  }
  
  // ==========================================================================
  // METADATA EXTRACTION
  // ==========================================================================
  
  /**
   * Extract metadata from event and target
   */
  private extractMetadata(event: Event, target: Element): EventMetadata {
    const tagName = target.tagName.toLowerCase();
    const inputType = target instanceof HTMLInputElement ? target.type : null;
    
    // Detect element types
    const isCheckbox = inputType === 'checkbox';
    const isRadio = inputType === 'radio';
    const isContentEditable = target.hasAttribute('contenteditable');
    
    // Detect Select2
    const isSelect2 = Boolean(
      target.classList.contains('select2-selection') ||
      target.closest('.select2-container')
    );
    
    // Detect navigation (links with href)
    const isNavigation = Boolean(
      tagName === 'a' && target.hasAttribute('href')
    );
    
    // Detect form submit triggers
    const isFormSubmit = Boolean(
      (tagName === 'button' && (target as HTMLButtonElement).type === 'submit') ||
      (tagName === 'input' && inputType === 'submit')
    );
    
    // Get checked state
    let isChecked: boolean | null = null;
    if (isCheckbox || isRadio) {
      isChecked = (target as HTMLInputElement).checked;
    }
    
    // Extract keyboard info
    let key: string | null = null;
    let keyCode: number | null = null;
    if (event instanceof KeyboardEvent) {
      key = event.key;
      keyCode = event.keyCode;
    }
    
    // Extract modifier keys
    const modifiers: ModifierKeys = {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    };
    
    if (this.config.captureModifiers) {
      if (event instanceof MouseEvent || event instanceof KeyboardEvent) {
        modifiers.altKey = event.altKey;
        modifiers.ctrlKey = event.ctrlKey;
        modifiers.metaKey = event.metaKey;
        modifiers.shiftKey = event.shiftKey;
      }
    }
    
    // Get composed path
    const composedPath: Element[] = [];
    if (event.composedPath) {
      for (const node of event.composedPath()) {
        if (node instanceof Element) {
          composedPath.push(node);
        }
      }
    }
    
    return {
      tagName,
      inputType,
      isContentEditable,
      isFormSubmit,
      isNavigation,
      isSelect2,
      isCheckbox,
      isRadio,
      isChecked,
      key,
      keyCode,
      modifiers,
      composedPath,
    };
  }
  
  /**
   * Extract coordinates from mouse event
   */
  private extractCoordinates(event: MouseEvent): EventCoordinates {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    };
  }
  
  // ==========================================================================
  // DEDUPLICATION
  // ==========================================================================
  
  /**
   * Check if event is a duplicate
   */
  private isDuplicateEvent(event: Event, target: Element): boolean {
    if (this.config.dedupeIntervalMs <= 0) {
      return false;
    }
    
    const key = this.getDedupeKey(event, target);
    const lastTimestamp = this.lastEventTimestamps.get(key);
    const now = Date.now();
    
    if (lastTimestamp && now - lastTimestamp < this.config.dedupeIntervalMs) {
      return true;
    }
    
    this.lastEventTimestamps.set(key, now);
    return false;
  }
  
  /**
   * Generate deduplication key for event
   */
  private getDedupeKey(event: Event, target: Element): string {
    const tagName = target.tagName;
    const id = target.id || '';
    const className = target.className || '';
    return `${event.type}:${tagName}:${id}:${className}`;
  }
  
  // ==========================================================================
  // CLEANUP
  // ==========================================================================
  
  /**
   * Flush pending input for an element
   */
  flushPendingInput(element: Element): void {
    const timer = this.inputDebounceTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      this.inputDebounceTimers.delete(element);
    }
    
    const pendingValue = this.pendingInputValues.get(element);
    const pendingEvent = this.pendingInputEvents.get(element);
    const pendingMetadata = this.pendingInputMetadata.get(element);
    
    if (pendingValue !== undefined && this.callback) {
      const event = pendingEvent || new Event('input');
      const metadata = pendingMetadata || this.extractMetadata(event, element);
      
      this.callback({
        eventType: 'input',
        actionType: 'input',
        target: element,
        originalEvent: event,
        value: pendingValue,
        isTrusted: event.isTrusted,
        coordinates: null,
        timestamp: Date.now(),
        metadata,
      });
    }
    
    this.pendingInputValues.delete(element);
    this.pendingInputEvents.delete(element);
    this.pendingInputMetadata.delete(element);
  }
  
  /**
   * Flush all pending inputs
   */
  flushAllPendingInputs(): void {
    for (const element of this.pendingInputValues.keys()) {
      this.flushPendingInput(element);
    }
  }
  
  /**
   * Clear all pending timers and state
   */
  clear(): void {
    for (const timer of this.inputDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.inputDebounceTimers.clear();
    this.pendingInputValues.clear();
    this.pendingInputEvents.clear();
    this.pendingInputMetadata.clear();
    this.lastEventTimestamps.clear();
  }
  
  /**
   * Dispose of the capture instance
   */
  dispose(): void {
    this.clear();
    this.callback = null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an EventCapture instance with defaults
 */
export function createEventCapture(
  config?: Partial<EventCaptureConfig>
): EventCapture {
  return new EventCapture(config);
}

/**
 * Check if an element is an input-like element
 */
export function isInputElement(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.hasAttribute('contenteditable')
  );
}

/**
 * Check if an element is clickable
 */
export function isClickableElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  // Obvious clickables
  if (['a', 'button', 'input', 'select', 'textarea', 'label'].includes(tagName)) {
    return true;
  }
  
  // Check for click handlers via attributes
  if (element.hasAttribute('onclick') || element.hasAttribute('ng-click')) {
    return true;
  }
  
  // Check for role
  const role = element.getAttribute('role');
  if (role && ['button', 'link', 'menuitem', 'tab', 'option'].includes(role)) {
    return true;
  }
  
  // Check for tabindex (makes element focusable/clickable)
  if (element.hasAttribute('tabindex')) {
    return true;
  }
  
  // Check computed cursor style
  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') {
    return true;
  }
  
  return false;
}

/**
 * Get the clickable ancestor of an element
 */
export function getClickableAncestor(element: Element): Element | null {
  let current: Element | null = element;
  
  while (current) {
    if (isClickableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  
  return null;
}

/**
 * Determine if an event should be recorded
 */
export function shouldRecordEvent(event: Event, target: Element): boolean {
  // Always record input events on input elements
  if (event.type === 'input' && isInputElement(target)) {
    return true;
  }
  
  // Record click events on clickable elements
  if (event.type === 'click' || event.type === 'mousedown') {
    return isClickableElement(target) || getClickableAncestor(target) !== null;
  }
  
  // Record keyboard events for special keys
  if (event instanceof KeyboardEvent) {
    return ['Enter', 'Tab', 'Escape'].includes(event.key);
  }
  
  return true;
}

/**
 * Get a human-readable description of a captured event
 */
export function describeEvent(data: CapturedEventData): string {
  const tagName = data.metadata.tagName;
  const action = data.actionType;
  
  switch (action) {
    case 'click':
      return `Click on <${tagName}>`;
    case 'dblclick':
      return `Double-click on <${tagName}>`;
    case 'input':
      return `Type "${truncate(data.value || '', 20)}" in <${tagName}>`;
    case 'enter':
      return `Press Enter in <${tagName}>`;
    case 'check':
      return `Check <${tagName}>`;
    case 'uncheck':
      return `Uncheck <${tagName}>`;
    case 'select':
      return `Select option in <${tagName}>`;
    case 'navigate':
      return `Navigate via <${tagName}>`;
    default:
      return `${action} on <${tagName}>`;
  }
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}
