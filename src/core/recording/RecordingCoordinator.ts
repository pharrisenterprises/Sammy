/**
 * RecordingCoordinator - Unified Recording Engine
 * @module core/recording/RecordingCoordinator
 * @version 1.0.0
 * 
 * Coordinates all recording components into a unified recording engine.
 * Manages recording lifecycle, event handling, and step generation.
 * 
 * ## Features
 * - Unified recording lifecycle management
 * - Coordinated iframe and shadow DOM handling
 * - Debounced input change tracking
 * - Automatic label detection
 * - Step generation with full locator bundles
 * - Visual feedback on recorded elements
 * - Event filtering (trusted events only)
 * 
 * ## Architecture
 * The coordinator orchestrates:
 * - EventListenerManager: Attach/detach DOM event listeners
 * - IframeHandler: Handle events in iframes
 * - ShadowDomHandler: Handle events in shadow DOM
 * - InputChangeTracker: Track input value changes
 * - StepBuilder: Build Step objects from events
 * - LabelResolver: Detect element labels
 * 
 * @see IRecordingEngine for the public interface
 */

import { IframeHandler, getIframeHandler, type IframeInfo } from './IframeHandler';
import { ShadowDomHandler, getShadowDomHandler } from './ShadowDomHandler';
import { InputChangeTracker, getInputChangeTracker } from './InputChangeTracker';
import { StepBuilder, getStepBuilder, type Step, type LocatorBundle } from './StepBuilder';
import { LabelResolver, getResolver } from './labels/LabelResolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recording state enum
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Supported event types for recording
 */
export type RecordableEventType = 'click' | 'input' | 'change' | 'keydown' | 'focus' | 'blur';

/**
 * Recording configuration
 */
export interface RecordingConfig {
  /** Event types to capture (default: all) */
  captureEvents?: RecordableEventType[];
  
  /** Whether to include iframes (default: true) */
  includeIframes?: boolean;
  
  /** Whether to include shadow DOM (default: true) */
  includeShadowDom?: boolean;
  
  /** Debounce delay for input events (ms, default: 300) */
  inputDebounceDelay?: number;
  
  /** Whether to highlight recorded elements (default: true) */
  highlightElements?: boolean;
  
  /** Highlight duration (ms, default: 500) */
  highlightDuration?: number;
  
  /** CSS class for highlight (default: 'recorder-highlight') */
  highlightClass?: string;
  
  /** Filter for synthetic events (default: true - only trusted) */
  trustedEventsOnly?: boolean;
  
  /** Target document (default: current document) */
  targetDocument?: Document;
  
  /** Maximum steps to record (default: unlimited) */
  maxSteps?: number;
}

/**
 * Default recording configuration
 */
export const DEFAULT_RECORDING_CONFIG: Required<RecordingConfig> = {
  captureEvents: ['click', 'input', 'change', 'keydown'],
  includeIframes: true,
  includeShadowDom: true,
  inputDebounceDelay: 300,
  highlightElements: true,
  highlightDuration: 500,
  highlightClass: 'recorder-highlight',
  trustedEventsOnly: true,
  targetDocument: typeof document !== 'undefined' ? document : null as any,
  maxSteps: 0, // 0 = unlimited
};

/**
 * Recording event types
 */
export type RecordingEventType = 
  | 'started'
  | 'stopped'
  | 'paused'
  | 'resumed'
  | 'step-recorded'
  | 'error';

/**
 * Recording event data
 */
export interface RecordingEvent {
  /** Event type */
  type: RecordingEventType;
  
  /** Associated step (for step-recorded) */
  step?: Step;
  
  /** Error message (for error) */
  error?: string;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Recording event callback
 */
export type RecordingEventCallback = (event: RecordingEvent) => void;

/**
 * Step recorded callback (convenience type)
 */
export type StepCallback = (step: Step) => void;

// ============================================================================
// RECORDING COORDINATOR CLASS
// ============================================================================

/**
 * Coordinates all recording components into a unified recording engine
 * 
 * @example
 * ```typescript
 * const coordinator = new RecordingCoordinator();
 * 
 * // Listen for recorded steps
 * coordinator.onStep((step) => {
 *   console.log('Recorded:', step.label, step.event);
 * });
 * 
 * // Start recording
 * await coordinator.start();
 * 
 * // User interacts with page...
 * 
 * // Stop and get steps
 * const steps = await coordinator.stop();
 * ```
 */
export class RecordingCoordinator {
  // Component references
  private iframeHandler: IframeHandler;
  private shadowDomHandler: ShadowDomHandler;
  private inputTracker: InputChangeTracker;
  private stepBuilder: StepBuilder;
  private labelResolver: LabelResolver;
  
  // State
  private state: RecordingState = 'idle';
  private config: Required<RecordingConfig>;
  private steps: Step[] = [];
  private startTime: number = 0;
  
  // Callbacks
  private eventCallbacks: Set<RecordingEventCallback> = new Set();
  private stepCallbacks: Set<StepCallback> = new Set();
  
  // Bound event handlers (for removal)
  private boundHandlers: Map<string, EventListener> = new Map();
  
  // Documents we've attached to
  private attachedDocuments: Set<Document> = new Set();
  
  /**
   * Create a new RecordingCoordinator
   */
  constructor(config: RecordingConfig = {}) {
    this.config = { ...DEFAULT_RECORDING_CONFIG, ...config };
    
    // Initialize components
    this.iframeHandler = getIframeHandler();
    this.shadowDomHandler = getShadowDomHandler();
    this.inputTracker = getInputChangeTracker();
    this.stepBuilder = getStepBuilder();
    this.labelResolver = getResolver();
    
    // Configure input tracker
    this.inputTracker.setDebounceDelay(this.config.inputDebounceDelay);
    
    // Bind event handlers
    this.bindHandlers();
  }
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Start recording
   */
  async start(config?: RecordingConfig): Promise<void> {
    if (this.state === 'recording') {
      throw new Error('Recording already in progress');
    }
    
    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Reset state
    this.steps = [];
    this.startTime = Date.now();
    this.stepBuilder.resetSequence();
    this.state = 'recording';
    
    // Start components
    this.inputTracker.start();
    
    // Attach listeners to main document
    this.attachListeners(this.config.targetDocument);
    
    // Handle iframes
    if (this.config.includeIframes) {
      this.setupIframeHandling();
    }
    
    // Handle shadow DOM
    if (this.config.includeShadowDom) {
      this.setupShadowDomHandling();
    }
    
    // Set up input change tracking
    this.setupInputTracking();
    
    // Emit started event
    this.emitEvent({ type: 'started', timestamp: Date.now() });
  }
  
  /**
   * Stop recording and return steps
   */
  async stop(): Promise<Step[]> {
    if (this.state === 'idle' || this.state === 'stopped') {
      return this.steps;
    }
    
    // Flush any pending input changes
    this.inputTracker.flushAllDebounces();
    
    // Detach all listeners
    this.detachAllListeners();
    
    // Stop components
    this.inputTracker.stop();
    this.iframeHandler.stop();
    this.shadowDomHandler.stop();
    
    this.state = 'stopped';
    
    // Emit stopped event
    this.emitEvent({ type: 'stopped', timestamp: Date.now() });
    
    return [...this.steps];
  }
  
  /**
   * Pause recording
   */
  pause(): void {
    if (this.state !== 'recording') {
      return;
    }
    
    this.state = 'paused';
    this.emitEvent({ type: 'paused', timestamp: Date.now() });
  }
  
  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== 'paused') {
      return;
    }
    
    this.state = 'recording';
    this.emitEvent({ type: 'resumed', timestamp: Date.now() });
  }
  
  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }
  
  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.state === 'recording';
  }
  
  /**
   * Get recorded steps
   */
  getSteps(): Step[] {
    return [...this.steps];
  }
  
  /**
   * Get step count
   */
  getStepCount(): number {
    return this.steps.length;
  }
  
  /**
   * Clear recorded steps
   */
  clearSteps(): void {
    this.steps = [];
    this.stepBuilder.resetSequence();
  }
  
  // ==========================================================================
  // EVENT HANDLER BINDING
  // ==========================================================================
  
  /**
   * Bind event handlers
   */
  private bindHandlers(): void {
    this.boundHandlers.set('click', this.handleClick.bind(this));
    this.boundHandlers.set('mousedown', this.handleMouseDown.bind(this));
    this.boundHandlers.set('input', this.handleInput.bind(this));
    this.boundHandlers.set('change', this.handleChange.bind(this));
    this.boundHandlers.set('keydown', this.handleKeyDown.bind(this));
    this.boundHandlers.set('focus', this.handleFocus.bind(this));
    this.boundHandlers.set('blur', this.handleBlur.bind(this));
  }
  
  /**
   * Attach event listeners to a document
   */
  private attachListeners(doc: Document): void {
    if (this.attachedDocuments.has(doc)) {
      return;
    }
    
    this.attachedDocuments.add(doc);
    
    // Attach in capture phase to get events before page handlers
    const captureEvents = this.config.captureEvents;
    
    if (captureEvents.includes('click')) {
      doc.addEventListener('mousedown', this.boundHandlers.get('mousedown')!, true);
    }
    
    if (captureEvents.includes('input')) {
      doc.addEventListener('input', this.boundHandlers.get('input')!, true);
    }
    
    if (captureEvents.includes('change')) {
      doc.addEventListener('change', this.boundHandlers.get('change')!, true);
    }
    
    if (captureEvents.includes('keydown')) {
      doc.addEventListener('keydown', this.boundHandlers.get('keydown')!, true);
    }
    
    if (captureEvents.includes('focus')) {
      doc.addEventListener('focus', this.boundHandlers.get('focus')!, true);
    }
    
    if (captureEvents.includes('blur')) {
      doc.addEventListener('blur', this.boundHandlers.get('blur')!, true);
    }
  }
  
  /**
   * Detach event listeners from a document
   */
  private detachListeners(doc: Document): void {
    if (!this.attachedDocuments.has(doc)) {
      return;
    }
    
    doc.removeEventListener('mousedown', this.boundHandlers.get('mousedown')!, true);
    doc.removeEventListener('input', this.boundHandlers.get('input')!, true);
    doc.removeEventListener('change', this.boundHandlers.get('change')!, true);
    doc.removeEventListener('keydown', this.boundHandlers.get('keydown')!, true);
    doc.removeEventListener('focus', this.boundHandlers.get('focus')!, true);
    doc.removeEventListener('blur', this.boundHandlers.get('blur')!, true);
    
    this.attachedDocuments.delete(doc);
  }
  
  /**
   * Detach all listeners
   */
  private detachAllListeners(): void {
    for (const doc of this.attachedDocuments) {
      this.detachListeners(doc);
    }
    this.attachedDocuments.clear();
  }
  
  // ==========================================================================
  // IFRAME HANDLING
  // ==========================================================================
  
  /**
   * Set up iframe event handling
   */
  private setupIframeHandling(): void {
    // Attach to iframe documents
    this.iframeHandler.onAttach((doc, iframe) => {
      if (this.state === 'recording') {
        this.attachListeners(doc);
      }
    });
    
    // Detach from removed iframes
    this.iframeHandler.onDetach((doc) => {
      this.detachListeners(doc);
    });
    
    // Start handling
    this.iframeHandler.start(
      this.config.targetDocument.defaultView || window
    );
  }
  
  // ==========================================================================
  // SHADOW DOM HANDLING
  // ==========================================================================
  
  /**
   * Set up shadow DOM event handling
   */
  private setupShadowDomHandling(): void {
    // Attach listeners to shadow roots
    this.shadowDomHandler.onAttach((shadowRoot, host) => {
      if (this.state === 'recording') {
        // Shadow roots don't have addEventListener on Document
        // Events bubble through, so we listen on the host
        // But for capture phase, we need to listen on shadowRoot
        shadowRoot.addEventListener(
          'mousedown',
          this.boundHandlers.get('mousedown')!,
          true
        );
        shadowRoot.addEventListener(
          'input',
          this.boundHandlers.get('input')!,
          true
        );
        shadowRoot.addEventListener(
          'change',
          this.boundHandlers.get('change')!,
          true
        );
        shadowRoot.addEventListener(
          'keydown',
          this.boundHandlers.get('keydown')!,
          true
        );
      }
    });
    
    // Start handling
    this.shadowDomHandler.start(this.config.targetDocument);
  }
  
  // ==========================================================================
  // INPUT TRACKING
  // ==========================================================================
  
  /**
   * Set up input change tracking
   */
  private setupInputTracking(): void {
    this.inputTracker.onValueChange((event) => {
      if (this.state !== 'recording') {
        return;
      }
      
      // Only record final (debounced) values
      if (!event.isFinal) {
        return;
      }
      
      // Build step for the input change
      const step = this.stepBuilder.buildFromInput(
        event.element,
        undefined,
        event.newValue
      );
      
      this.recordStep(step, event.element);
    });
  }
  
  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================
  
  /**
   * Handle mousedown event (for clicks)
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.shouldHandleEvent(event)) {
      return;
    }
    
    const target = this.getEventTarget(event);
    if (!target) {
      return;
    }
    
    // Skip if this is an input (will be handled by input event)
    if (this.isInputElement(target)) {
      return;
    }
    
    // Build click step
    const iframeChain = this.getIframeChain(target);
    const shadowHosts = this.getShadowHostChain(target);
    
    const step = this.stepBuilder.build({
      element: target,
      event,
      eventType: 'click',
      iframeChain,
      shadowHosts,
    });
    
    this.recordStep(step, target);
  }
  
  /**
   * Handle click event
   */
  private handleClick(event: MouseEvent): void {
    // Click is handled in mousedown for better timing
    // This is kept for potential future use
  }
  
  /**
   * Handle input event
   */
  private handleInput(event: Event): void {
    if (!this.shouldHandleEvent(event)) {
      return;
    }
    
    const target = this.getEventTarget(event);
    if (!target) {
      return;
    }
    
    // Delegate to input tracker for debouncing
    this.inputTracker.handleInput(event);
  }
  
  /**
   * Handle change event
   */
  private handleChange(event: Event): void {
    if (!this.shouldHandleEvent(event)) {
      return;
    }
    
    const target = this.getEventTarget(event);
    if (!target) {
      return;
    }
    
    // For select, checkbox, radio - record immediately
    if (this.isDiscreteInput(target)) {
      const value = this.inputTracker.getValue(target);
      
      const iframeChain = this.getIframeChain(target);
      const shadowHosts = this.getShadowHostChain(target);
      
      const step = this.stepBuilder.build({
        element: target,
        event,
        eventType: 'input',
        value,
        iframeChain,
        shadowHosts,
      });
      
      this.recordStep(step, target);
    } else {
      // For text inputs, let input tracker handle debouncing
      this.inputTracker.handleChange(event);
    }
  }
  
  /**
   * Handle keydown event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.shouldHandleEvent(event)) {
      return;
    }
    
    // Only record Enter key
    if (event.key !== 'Enter') {
      return;
    }
    
    const target = this.getEventTarget(event);
    if (!target) {
      return;
    }
    
    // Flush any pending input
    this.inputTracker.flushDebounce(target);
    
    // Build enter step
    const iframeChain = this.getIframeChain(target);
    const shadowHosts = this.getShadowHostChain(target);
    
    const step = this.stepBuilder.build({
      element: target,
      event,
      eventType: 'enter',
      iframeChain,
      shadowHosts,
    });
    
    this.recordStep(step, target);
  }
  
  /**
   * Handle focus event
   */
  private handleFocus(event: FocusEvent): void {
    // Focus events are used to track input changes
    // Not recorded as steps themselves
  }
  
  /**
   * Handle blur event
   */
  private handleBlur(event: FocusEvent): void {
    if (!this.shouldHandleEvent(event)) {
      return;
    }
    
    const target = this.getEventTarget(event);
    if (!target) {
      return;
    }
    
    // Flush any pending input change
    this.inputTracker.handleBlur(event);
  }
  
  // ==========================================================================
  // STEP RECORDING
  // ==========================================================================
  
  /**
   * Record a step
   */
  private recordStep(step: Step, element: Element): void {
    // Check max steps
    if (this.config.maxSteps > 0 && this.steps.length >= this.config.maxSteps) {
      return;
    }
    
    // Add step
    this.steps.push(step);
    
    // Visual feedback
    if (this.config.highlightElements) {
      this.highlightElement(element);
    }
    
    // Emit step event
    this.emitEvent({
      type: 'step-recorded',
      step,
      timestamp: Date.now(),
    });
    
    // Notify step callbacks
    for (const callback of this.stepCallbacks) {
      try {
        callback(step);
      } catch (error) {
        console.error('Step callback error:', error);
      }
    }
  }
  
  /**
   * Highlight recorded element
   */
  private highlightElement(element: Element): void {
    const className = this.config.highlightClass;
    
    element.classList.add(className);
    
    setTimeout(() => {
      element.classList.remove(className);
    }, this.config.highlightDuration);
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Check if event should be handled
   */
  private shouldHandleEvent(event: Event): boolean {
    // Check recording state
    if (this.state !== 'recording') {
      return false;
    }
    
    // Check trusted events only
    if (this.config.trustedEventsOnly && !event.isTrusted) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the real target element from an event
   */
  private getEventTarget(event: Event): Element | null {
    // Use composedPath for shadow DOM traversal
    const path = event.composedPath();
    if (path.length > 0 && path[0] instanceof Element) {
      return path[0];
    }
    
    if (event.target instanceof Element) {
      return event.target;
    }
    
    return null;
  }
  
  /**
   * Check if element is an input element
   */
  private isInputElement(element: Element): boolean {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.getAttribute('contenteditable') === 'true'
    );
  }
  
  /**
   * Check if element is a discrete input (select, checkbox, radio)
   */
  private isDiscreteInput(element: Element): boolean {
    if (element instanceof HTMLSelectElement) {
      return true;
    }
    
    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      return type === 'checkbox' || type === 'radio' || type === 'file';
    }
    
    return false;
  }
  
  /**
   * Get iframe chain for an element
   */
  private getIframeChain(element: Element): number[] | undefined {
    const chain = this.iframeHandler.getIframeChain(element);
    return chain.length > 0 ? chain.map(info => info.index) : undefined;
  }
  
  /**
   * Get shadow host chain for an element
   */
  private getShadowHostChain(element: Element): string[] | undefined {
    const chain = this.shadowDomHandler.getShadowHostChain(element);
    return chain.length > 0 ? chain : undefined;
  }
  
  // ==========================================================================
  // CALLBACKS
  // ==========================================================================
  
  /**
   * Register callback for recording events
   */
  addEventListener(callback: RecordingEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }
  
  /**
   * Register callback for step events (convenience method)
   */
  onStep(callback: StepCallback): () => void {
    this.stepCallbacks.add(callback);
    return () => this.stepCallbacks.delete(callback);
  }
  
  /**
   * Emit recording event
   */
  private emitEvent(event: RecordingEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Recording event callback error:', error);
      }
    }
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<RecordingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update component configs
    if (config.inputDebounceDelay !== undefined) {
      this.inputTracker.setDebounceDelay(config.inputDebounceDelay);
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Required<RecordingConfig> {
    return { ...this.config };
  }
  
  /**
   * Get recording duration (ms)
   */
  getDuration(): number {
    if (this.startTime === 0) {
      return 0;
    }
    return Date.now() - this.startTime;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a RecordingCoordinator with default configuration
 */
export function createRecordingCoordinator(
  config?: RecordingConfig
): RecordingCoordinator {
  return new RecordingCoordinator(config);
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let defaultCoordinator: RecordingCoordinator | null = null;

/**
 * Get the default RecordingCoordinator instance
 */
export function getRecordingCoordinator(): RecordingCoordinator {
  if (!defaultCoordinator) {
    defaultCoordinator = new RecordingCoordinator();
  }
  return defaultCoordinator;
}

/**
 * Reset the default RecordingCoordinator
 */
export function resetRecordingCoordinator(): void {
  if (defaultCoordinator) {
    defaultCoordinator.stop();
  }
  defaultCoordinator = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Start recording with default coordinator
 */
export async function startRecording(config?: RecordingConfig): Promise<void> {
  return getRecordingCoordinator().start(config);
}

/**
 * Stop recording and get steps
 */
export async function stopRecording(): Promise<Step[]> {
  return getRecordingCoordinator().stop();
}

/**
 * Check if currently recording
 */
export function isRecording(): boolean {
  return getRecordingCoordinator().isRecording();
}

/**
 * Get recorded steps
 */
export function getRecordedSteps(): Step[] {
  return getRecordingCoordinator().getSteps();
}
