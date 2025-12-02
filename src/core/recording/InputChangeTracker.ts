/**
 * InputChangeTracker - Track Input Value Changes for Recording
 * @module core/recording/InputChangeTracker
 * @version 1.0.0
 * 
 * Tracks input value changes with debouncing for text inputs and
 * immediate capture for discrete changes. Supports all standard
 * input types plus contenteditable and custom dropdowns.
 * 
 * ## Features
 * - Debounced text input tracking
 * - Immediate checkbox/radio/select tracking
 * - Contenteditable element support
 * - Select2 dropdown handling
 * - Initial value comparison
 * - Change event emission
 * 
 * @see EventCapture for event handling
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input element types that can be tracked
 */
export type TrackableInputType = 
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'contenteditable'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'month'
  | 'week'
  | 'color'
  | 'range'
  | 'file'
  | 'hidden'
  | 'unknown';

/**
 * State tracked for each input element
 */
export interface TrackedState {
  /** Initial value when tracking started */
  initialValue: string;
  
  /** Last recorded value */
  lastValue: string;
  
  /** Input type classification */
  inputType: TrackableInputType;
  
  /** Timestamp when tracking started */
  startTime: number;
  
  /** Timestamp of last change */
  lastChangeTime: number;
  
  /** Whether the value has changed from initial */
  hasChanged: boolean;
  
  /** Number of changes recorded */
  changeCount: number;
}

/**
 * Value change event data
 */
export interface ValueChangeEvent {
  /** The element that changed */
  element: Element;
  
  /** Previous value */
  previousValue: string;
  
  /** New value */
  newValue: string;
  
  /** Input type */
  inputType: TrackableInputType;
  
  /** Whether this is a final (debounced) value */
  isFinal: boolean;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Value change callback
 */
export type ValueChangeCallback = (event: ValueChangeEvent) => void;

/**
 * InputChangeTracker configuration
 */
export interface InputChangeTrackerConfig {
  /** Debounce delay for text inputs (ms, default: 300) */
  debounceDelay?: number;
  
  /** Whether to track initial values (default: true) */
  trackInitialValue?: boolean;
  
  /** Whether to emit intermediate changes (default: false) */
  emitIntermediateChanges?: boolean;
  
  /** Minimum change threshold for text (default: 0 - any change) */
  minChangeThreshold?: number;
  
  /** Input types to track (default: all) */
  trackedTypes?: TrackableInputType[];
}

/**
 * Default configuration
 */
export const DEFAULT_TRACKER_CONFIG: Required<InputChangeTrackerConfig> = {
  debounceDelay: 300,
  trackInitialValue: true,
  emitIntermediateChanges: false,
  minChangeThreshold: 0,
  trackedTypes: [
    'text', 'password', 'email', 'number', 'tel', 'url', 'search',
    'textarea', 'select', 'checkbox', 'radio', 'contenteditable',
    'date', 'time', 'datetime-local', 'month', 'week', 'color', 'range', 'file',
  ],
};

/**
 * Input types that should be tracked immediately (no debounce)
 */
const IMMEDIATE_TYPES: TrackableInputType[] = [
  'checkbox',
  'radio',
  'select',
  'file',
  'color',
];

/**
 * Input types that use text-based debouncing
 */
const DEBOUNCED_TYPES: TrackableInputType[] = [
  'text',
  'password',
  'email',
  'number',
  'tel',
  'url',
  'search',
  'textarea',
  'contenteditable',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'range',
];

// ============================================================================
// INPUT CHANGE TRACKER CLASS
// ============================================================================

/**
 * Tracks input value changes for recording
 * 
 * @example
 * ```typescript
 * const tracker = new InputChangeTracker();
 * 
 * // Register callback for value changes
 * tracker.onValueChange((event) => {
 *   console.log(`${event.element.id} changed to: ${event.newValue}`);
 * });
 * 
 * // Start tracking an input
 * tracker.startTracking(inputElement);
 * 
 * // Handle input events
 * inputElement.addEventListener('input', (e) => tracker.handleInput(e));
 * ```
 */
export class InputChangeTracker {
  /** Tracked element states */
  private trackedElements: WeakMap<Element, TrackedState>;
  
  /** Debounce timers for text inputs */
  private debounceTimers: Map<Element, ReturnType<typeof setTimeout>>;
  
  /** Value change callbacks */
  private callbacks: Set<ValueChangeCallback>;
  
  /** Configuration */
  private config: Required<InputChangeTrackerConfig>;
  
  /** Whether tracker is active */
  private isActive: boolean;
  
  /**
   * Create a new InputChangeTracker
   */
  constructor(config: InputChangeTrackerConfig = {}) {
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
    this.trackedElements = new WeakMap();
    this.debounceTimers = new Map();
    this.callbacks = new Set();
    this.isActive = false;
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Start the tracker
   */
  start(): void {
    this.isActive = true;
  }
  
  /**
   * Stop the tracker
   */
  stop(): void {
    this.isActive = false;
    
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
  
  /**
   * Check if tracker is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }
  
  // ==========================================================================
  // TRACKING
  // ==========================================================================
  
  /**
   * Start tracking an element
   */
  startTracking(element: Element): boolean {
    if (this.trackedElements.has(element)) {
      return false;
    }
    
    const inputType = this.getInputType(element);
    
    // Check if this type should be tracked
    if (!this.config.trackedTypes.includes(inputType)) {
      return false;
    }
    
    const initialValue = this.getValue(element);
    
    const state: TrackedState = {
      initialValue,
      lastValue: initialValue,
      inputType,
      startTime: Date.now(),
      lastChangeTime: Date.now(),
      hasChanged: false,
      changeCount: 0,
    };
    
    this.trackedElements.set(element, state);
    return true;
  }
  
  /**
   * Stop tracking an element
   */
  stopTracking(element: Element): boolean {
    if (!this.trackedElements.has(element)) {
      return false;
    }
    
    // Clear any pending debounce timer
    this.clearDebounceTimer(element);
    
    // Note: Can't delete from WeakMap, will be GC'd
    return true;
  }
  
  /**
   * Check if element is being tracked
   */
  isTracking(element: Element): boolean {
    return this.trackedElements.has(element);
  }
  
  /**
   * Get tracking state for an element
   */
  getState(element: Element): TrackedState | null {
    return this.trackedElements.get(element) || null;
  }
  
  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================
  
  /**
   * Handle input event
   */
  handleInput(event: Event): void {
    if (!this.isActive) return;
    
    const element = event.target as Element;
    if (!element) return;
    
    // Auto-track if not already tracked
    if (!this.trackedElements.has(element)) {
      this.startTracking(element);
    }
    
    const state = this.trackedElements.get(element);
    if (!state) return;
    
    const newValue = this.getValue(element);
    
    // Check if value actually changed
    if (newValue === state.lastValue) {
      return;
    }
    
    // Update state
    const previousValue = state.lastValue;
    state.lastValue = newValue;
    state.lastChangeTime = Date.now();
    state.hasChanged = newValue !== state.initialValue;
    state.changeCount++;
    
    // Determine if immediate or debounced
    if (this.shouldDebounce(state.inputType)) {
      // Emit intermediate change if configured
      if (this.config.emitIntermediateChanges) {
        this.emitChange(element, previousValue, newValue, state.inputType, false);
      }
      
      // Set up debounced final emission
      this.scheduleDebounce(element, previousValue, newValue, state.inputType);
    } else {
      // Immediate emission for discrete inputs
      this.emitChange(element, previousValue, newValue, state.inputType, true);
    }
  }
  
  /**
   * Handle change event
   */
  handleChange(event: Event): void {
    if (!this.isActive) return;
    
    const element = event.target as Element;
    if (!element) return;
    
    // Auto-track if not already tracked
    if (!this.trackedElements.has(element)) {
      this.startTracking(element);
    }
    
    const state = this.trackedElements.get(element);
    if (!state) return;
    
    const newValue = this.getValue(element);
    
    // For change events, always emit (this is the final value)
    if (newValue !== state.lastValue) {
      const previousValue = state.lastValue;
      state.lastValue = newValue;
      state.lastChangeTime = Date.now();
      state.hasChanged = newValue !== state.initialValue;
      state.changeCount++;
      
      // Clear any pending debounce
      this.clearDebounceTimer(element);
      
      // Emit as final
      this.emitChange(element, previousValue, newValue, state.inputType, true);
    }
  }
  
  /**
   * Handle blur event (finalize any pending changes)
   */
  handleBlur(event: Event): void {
    if (!this.isActive) return;
    
    const element = event.target as Element;
    if (!element) return;
    
    // Flush any pending debounced change
    this.flushDebounce(element);
  }
  
  // ==========================================================================
  // DEBOUNCING
  // ==========================================================================
  
  /**
   * Check if input type should be debounced
   */
  private shouldDebounce(inputType: TrackableInputType): boolean {
    return DEBOUNCED_TYPES.includes(inputType);
  }
  
  /**
   * Schedule debounced emission
   */
  private scheduleDebounce(
    element: Element,
    previousValue: string,
    newValue: string,
    inputType: TrackableInputType
  ): void {
    // Clear existing timer
    this.clearDebounceTimer(element);
    
    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(element);
      
      // Get current value (may have changed since scheduling)
      const currentValue = this.getValue(element);
      const state = this.trackedElements.get(element);
      
      if (state && currentValue !== state.initialValue) {
        // Emit with current value as the final
        this.emitChange(element, previousValue, currentValue, inputType, true);
      }
    }, this.config.debounceDelay);
    
    this.debounceTimers.set(element, timer);
  }
  
  /**
   * Clear debounce timer for an element
   */
  private clearDebounceTimer(element: Element): void {
    const timer = this.debounceTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(element);
    }
  }
  
  /**
   * Flush pending debounce immediately
   */
  flushDebounce(element: Element): void {
    const timer = this.debounceTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(element);
      
      const state = this.trackedElements.get(element);
      if (state) {
        const currentValue = this.getValue(element);
        if (currentValue !== state.initialValue) {
          this.emitChange(
            element,
            state.initialValue,
            currentValue,
            state.inputType,
            true
          );
        }
      }
    }
  }
  
  /**
   * Flush all pending debounces
   */
  flushAllDebounces(): void {
    const elements = Array.from(this.debounceTimers.keys());
    for (const element of elements) {
      this.flushDebounce(element);
    }
  }
  
  // ==========================================================================
  // VALUE EXTRACTION
  // ==========================================================================
  
  /**
   * Get current value from element
   */
  getValue(element: Element): string {
    // HTML Input elements
    if (element instanceof HTMLInputElement) {
      return this.getInputValue(element);
    }
    
    // Textarea
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    
    // Select
    if (element instanceof HTMLSelectElement) {
      return this.getSelectValue(element);
    }
    
    // Contenteditable
    if (element.getAttribute('contenteditable') === 'true') {
      return element.textContent?.trim() || '';
    }
    
    // Select2 or custom dropdown
    if (this.isSelect2Element(element)) {
      return this.getSelect2Value(element);
    }
    
    // Generic fallback
    return '';
  }
  
  /**
   * Get value from input element
   */
  private getInputValue(input: HTMLInputElement): string {
    switch (input.type) {
      case 'checkbox':
        return input.checked ? 'true' : 'false';
        
      case 'radio':
        return input.checked ? input.value : '';
        
      case 'file':
        return input.files?.[0]?.name || '';
        
      default:
        return input.value;
    }
  }
  
  /**
   * Get value from select element
   */
  private getSelectValue(select: HTMLSelectElement): string {
    if (select.multiple) {
      return Array.from(select.selectedOptions)
        .map(opt => opt.value)
        .join(',');
    }
    return select.value;
  }
  
  /**
   * Check if element is a Select2 element
   */
  private isSelect2Element(element: Element): boolean {
    return (
      element.classList.contains('select2-selection') ||
      element.classList.contains('select2-choice') ||
      element.closest('.select2-container') !== null
    );
  }
  
  /**
   * Get value from Select2 element
   */
  private getSelect2Value(element: Element): string {
    // Find the original select
    const container = element.closest('.select2-container');
    if (container) {
      const originalSelect = container.previousElementSibling as HTMLSelectElement;
      if (originalSelect instanceof HTMLSelectElement) {
        return this.getSelectValue(originalSelect);
      }
    }
    
    // Try to find hidden accessible select
    const parent = element.parentElement;
    if (parent) {
      const hiddenSelect = parent.querySelector('.select2-hidden-accessible') as HTMLSelectElement;
      if (hiddenSelect instanceof HTMLSelectElement) {
        return this.getSelectValue(hiddenSelect);
      }
    }
    
    return '';
  }
  
  // ==========================================================================
  // INPUT TYPE DETECTION
  // ==========================================================================
  
  /**
   * Get input type for an element
   */
  getInputType(element: Element): TrackableInputType {
    // HTML Input
    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      if (this.isValidInputType(type)) {
        return type as TrackableInputType;
      }
      return 'text';
    }
    
    // Textarea
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }
    
    // Select
    if (element instanceof HTMLSelectElement) {
      return 'select';
    }
    
    // Contenteditable
    if (element.getAttribute('contenteditable') === 'true') {
      return 'contenteditable';
    }
    
    // Select2
    if (this.isSelect2Element(element)) {
      return 'select';
    }
    
    return 'unknown';
  }
  
  /**
   * Check if a string is a valid input type
   */
  private isValidInputType(type: string): boolean {
    const validTypes: TrackableInputType[] = [
      'text', 'password', 'email', 'number', 'tel', 'url', 'search',
      'checkbox', 'radio', 'date', 'time', 'datetime-local',
      'month', 'week', 'color', 'range', 'file', 'hidden',
    ];
    return validTypes.includes(type as TrackableInputType);
  }
  
  // ==========================================================================
  // CHANGE DETECTION
  // ==========================================================================
  
  /**
   * Check if element value has changed from initial
   */
  hasChanged(element: Element): boolean {
    const state = this.trackedElements.get(element);
    if (!state) {
      return false;
    }
    return state.hasChanged;
  }
  
  /**
   * Get the initial value for a tracked element
   */
  getInitialValue(element: Element): string | null {
    const state = this.trackedElements.get(element);
    return state?.initialValue ?? null;
  }
  
  /**
   * Reset tracking for an element (captures new initial value)
   */
  resetTracking(element: Element): void {
    const state = this.trackedElements.get(element);
    if (state) {
      const currentValue = this.getValue(element);
      state.initialValue = currentValue;
      state.lastValue = currentValue;
      state.hasChanged = false;
      state.changeCount = 0;
    }
  }
  
  // ==========================================================================
  // CALLBACKS
  // ==========================================================================
  
  /**
   * Register callback for value changes
   */
  onValueChange(callback: ValueChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * Emit value change event
   */
  private emitChange(
    element: Element,
    previousValue: string,
    newValue: string,
    inputType: TrackableInputType,
    isFinal: boolean
  ): void {
    // Check minimum change threshold
    if (this.config.minChangeThreshold > 0) {
      const changeLength = Math.abs(newValue.length - previousValue.length);
      if (changeLength < this.config.minChangeThreshold) {
        return;
      }
    }
    
    const event: ValueChangeEvent = {
      element,
      previousValue,
      newValue,
      inputType,
      isFinal,
      timestamp: Date.now(),
    };
    
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Value change callback error:', error);
      }
    }
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<InputChangeTrackerConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<InputChangeTrackerConfig> {
    return { ...this.config };
  }
  
  /**
   * Set debounce delay
   */
  setDebounceDelay(delay: number): void {
    this.config.debounceDelay = Math.max(0, delay);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an InputChangeTracker with default configuration
 */
export function createInputChangeTracker(
  config?: InputChangeTrackerConfig
): InputChangeTracker {
  return new InputChangeTracker(config);
}

/**
 * Create a tracker optimized for fast typing
 */
export function createFastTracker(): InputChangeTracker {
  return new InputChangeTracker({
    debounceDelay: 150,
    emitIntermediateChanges: false,
  });
}

/**
 * Create a tracker that emits all changes
 */
export function createVerboseTracker(): InputChangeTracker {
  return new InputChangeTracker({
    debounceDelay: 100,
    emitIntermediateChanges: true,
  });
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let defaultTracker: InputChangeTracker | null = null;

/**
 * Get the default InputChangeTracker instance
 */
export function getInputChangeTracker(): InputChangeTracker {
  if (!defaultTracker) {
    defaultTracker = new InputChangeTracker();
  }
  return defaultTracker;
}

/**
 * Reset the default InputChangeTracker
 */
export function resetInputChangeTracker(): void {
  if (defaultTracker) {
    defaultTracker.stop();
  }
  defaultTracker = null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get value from any input-like element
 */
export function getElementValue(element: Element): string {
  return getInputChangeTracker().getValue(element);
}

/**
 * Get input type classification for an element
 */
export function getElementInputType(element: Element): TrackableInputType {
  return getInputChangeTracker().getInputType(element);
}

/**
 * Check if an element is a trackable input
 */
export function isTrackableInput(element: Element): boolean {
  const tracker = getInputChangeTracker();
  const type = tracker.getInputType(element);
  return type !== 'unknown' && type !== 'hidden';
}

/**
 * Check if input type should have immediate change tracking
 */
export function isImmediateInputType(type: TrackableInputType): boolean {
  return IMMEDIATE_TYPES.includes(type);
}

/**
 * Check if input type should be debounced
 */
export function isDebouncedInputType(type: TrackableInputType): boolean {
  return DEBOUNCED_TYPES.includes(type);
}
