/**
 * RecordingController - Coordinates recording state and flow
 * @module core/recording/RecordingController
 * @version 1.0.0
 * 
 * Main entry point for recording functionality. Manages the recording
 * lifecycle, coordinates event capture, and handles communication
 * with background script.
 * 
 * Features:
 * - State machine for recording lifecycle
 * - Event capture coordination
 * - Step buffering and batching
 * - Undo/redo support
 * - Message bus integration
 * 
 * @see recording-engine_breakdown.md for architecture details
 */

import type {
  RecordingState,
  RecordingSession,
  RecordingOptions,
} from '../types/project';
import type {
  RecordedStep,
  StepType,
} from '../types/step';
import type { IMessageBus, Unsubscribe } from '../messaging/IMessageBus';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default recording options
 */
export const DEFAULT_RECORDING_OPTIONS: RecordingOptions = {
  captureClicks: true,
  captureInput: true,
  captureNavigation: true,
  captureScrolls: false,
  captureHovers: false,
  captureKeyboard: true,
  inputDebounceMs: 300,
  scrollDebounceMs: 500,
  hoverDelayMs: 1000,
  maxStepsPerSession: 1000,
  autoSaveIntervalMs: 30000,
};

/**
 * Step buffer flush threshold
 */
export const BUFFER_FLUSH_THRESHOLD = 10;

/**
 * Maximum undo history size
 */
export const MAX_UNDO_HISTORY = 50;

/**
 * Recording state transitions
 */
export const STATE_TRANSITIONS: Record<RecordingState, RecordingState[]> = {
  idle: ['starting'],
  starting: ['recording', 'error', 'idle'],
  recording: ['paused', 'stopping'],
  paused: ['recording', 'stopping'],
  stopping: ['stopped', 'error'],
  stopped: ['idle'],
  error: ['idle'],
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recording controller configuration
 */
export interface RecordingControllerConfig {
  /** Message bus for communication */
  messageBus?: IMessageBus;
  /** Recording options */
  options?: Partial<RecordingOptions>;
  /** Auto-save callback */
  onAutoSave?: (session: RecordingSession) => Promise<void>;
  /** Step recorded callback */
  onStepRecorded?: (step: RecordedStep) => void;
  /** State change callback */
  onStateChange?: (state: RecordingState, prevState: RecordingState) => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Step with undo information
 */
interface UndoableStep {
  step: RecordedStep;
  index: number;
}

/**
 * Recording event types that can be captured
 */
export type RecordingEventType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'keydown'
  | 'keyup'
  | 'scroll'
  | 'mouseover'
  | 'focus'
  | 'blur'
  | 'submit'
  | 'select';

/**
 * Event handler function
 */
export type EventHandler = (event: Event) => void;

/**
 * Controller statistics
 */
export interface ControllerStats {
  /** Total steps recorded */
  totalSteps: number;
  /** Steps by type */
  stepsByType: Record<string, number>;
  /** Total errors */
  errors: number;
  /** Sessions started */
  sessionsStarted: number;
  /** Sessions completed */
  sessionsCompleted: number;
  /** Current buffer size */
  bufferSize: number;
  /** Undo history size */
  undoHistorySize: number;
  /** Redo history size */
  redoHistorySize: number;
  /** Auto-save count */
  autoSaveCount: number;
  /** Last auto-save timestamp */
  lastAutoSave: number | null;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * RecordingController - Coordinates recording state and flow
 * 
 * Manages the recording lifecycle including starting, stopping,
 * pausing, and resuming recordings. Coordinates event capture
 * and step creation.
 * 
 * @example
 * ```typescript
 * const controller = new RecordingController({
 *   messageBus: bus,
 *   onStepRecorded: (step) => console.log('Recorded:', step),
 * });
 * 
 * await controller.start({ testCaseId: 'test-1' });
 * // ... user interactions are recorded ...
 * const session = await controller.stop();
 * ```
 */
export class RecordingController {
  /**
   * Current recording state
   */
  private _state: RecordingState = 'idle';
  
  /**
   * Current recording session
   */
  private _session: RecordingSession | null = null;
  
  /**
   * Recording options
   */
  private _options: RecordingOptions;
  
  /**
   * Configuration
   */
  private config: RecordingControllerConfig;
  
  /**
   * Step buffer for batching
   */
  private stepBuffer: RecordedStep[] = [];
  
  /**
   * Undo history
   */
  private undoHistory: UndoableStep[] = [];
  
  /**
   * Redo history
   */
  private redoHistory: UndoableStep[] = [];
  
  /**
   * Registered event handlers
   */
  private eventHandlers: Map<RecordingEventType, EventHandler> = new Map();
  
  /**
   * Auto-save interval reference
   */
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  
  /**
   * Message bus subscriptions
   */
  private subscriptions: Unsubscribe[] = [];
  
  /**
   * Step counter for IDs
   */
  private stepCounter: number = 0;
  
  /**
   * Statistics
   */
  private stats: ControllerStats;
  
  /**
   * Input debounce timers
   */
  private inputTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  
  /**
   * Scroll debounce timer
   */
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  
  /**
   * Creates a new RecordingController
   * 
   * @param config - Controller configuration
   */
  constructor(config: RecordingControllerConfig = {}) {
    this.config = config;
    this._options = {
      ...DEFAULT_RECORDING_OPTIONS,
      ...config.options,
    };
    
    this.stats = this.createEmptyStats();
  }
  
  // ==========================================================================
  // PROPERTIES
  // ==========================================================================
  
  /**
   * Current recording state
   */
  get state(): RecordingState {
    return this._state;
  }
  
  /**
   * Current recording session
   */
  get session(): RecordingSession | null {
    return this._session;
  }
  
  /**
   * Recording options
   */
  get options(): RecordingOptions {
    return { ...this._options };
  }
  
  /**
   * Whether currently recording
   */
  get isRecording(): boolean {
    return this._state === 'recording';
  }
  
  /**
   * Whether currently paused
   */
  get isPaused(): boolean {
    return this._state === 'paused';
  }
  
  /**
   * Whether idle (not recording)
   */
  get isIdle(): boolean {
    return this._state === 'idle';
  }
  
  /**
   * Current step count
   */
  get stepCount(): number {
    return this._session?.steps.length ?? 0;
  }
  
  /**
   * Whether undo is available
   */
  get canUndo(): boolean {
    return this.undoHistory.length > 0;
  }
  
  /**
   * Whether redo is available
   */
  get canRedo(): boolean {
    return this.redoHistory.length > 0;
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Starts recording
   * 
   * @param options - Session options
   * @returns The new recording session
   */
  async start(options: {
    testCaseId?: string;
    testCaseName?: string;
    description?: string;
    baseUrl?: string;
    tabId?: number;
  } = {}): Promise<RecordingSession> {
    // Validate state transition
    if (!this.canTransitionTo('recording')) {
      throw new Error(`Cannot start recording from state: ${this._state}`);
    }
    
    // Create new session
    const session: RecordingSession = {
      id: this.generateSessionId(),
      projectId: options.testCaseId,
      startUrl: options.baseUrl ?? window.location.origin,
      startTime: Date.now(),
      state: 'recording',
      steps: [],
      stepCount: 0,
      lastActivityTime: Date.now(),
      tabId: options.tabId,
    };
    
    this._session = session;
    this.stepCounter = 0;
    this.undoHistory = [];
    this.redoHistory = [];
    
    // Transition state
    this.transitionTo('recording');
    
    // Set up event listeners
    this.attachEventListeners();
    
    // Start auto-save if configured
    if (this._options.autoSaveIntervalMs && this._options.autoSaveIntervalMs > 0 && this.config.onAutoSave) {
      this.startAutoSave();
    }
    
    // Notify via message bus
    this.notifyStateChange();
    
    this.stats.sessionsStarted++;
    
    return session;
  }
  
  /**
   * Stops recording
   * 
   * @returns The completed recording session
   */
  async stop(): Promise<RecordingSession> {
    if (!this._session) {
      throw new Error('No active recording session');
    }
    
    if (!this.canTransitionTo('idle')) {
      throw new Error(`Cannot stop recording from state: ${this._state}`);
    }
    
    // Flush any buffered steps
    this.flushBuffer();
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Remove event listeners
    this.detachEventListeners();
    
    // Clear timers
    this.clearTimers();
    
    // Complete session
    this._session.endTime = Date.now();
    this._session.state = 'idle';
    
    const completedSession = { ...this._session };
    
    // Transition state
    this.transitionTo('idle');
    
    // Clear session
    this._session = null;
    
    // Notify via message bus
    this.notifyStateChange();
    
    this.stats.sessionsCompleted++;
    
    return completedSession;
  }
  
  /**
   * Pauses recording
   */
  async pause(): Promise<void> {
    if (!this._session) {
      throw new Error('No active recording session');
    }
    
    if (!this.canTransitionTo('paused')) {
      throw new Error(`Cannot pause recording from state: ${this._state}`);
    }
    
    // Flush buffer before pausing
    this.flushBuffer();
    
    // Transition state
    this.transitionTo('paused');
    this._session.state = 'paused';
    
    // Notify
    this.notifyStateChange();
  }
  
  /**
   * Resumes recording
   */
  async resume(): Promise<void> {
    if (!this._session) {
      throw new Error('No active recording session');
    }
    
    if (!this.canTransitionTo('recording')) {
      throw new Error(`Cannot resume recording from state: ${this._state}`);
    }
    
    // Transition state
    this.transitionTo('recording');
    this._session.state = 'recording';
    
    // Notify
    this.notifyStateChange();
  }
  
  /**
   * Cancels recording without saving
   */
  async cancel(): Promise<void> {
    if (!this._session) {
      return;
    }
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Remove event listeners
    this.detachEventListeners();
    
    // Clear timers
    this.clearTimers();
    
    // Clear session
    this._session = null;
    this.stepBuffer = [];
    this.undoHistory = [];
    this.redoHistory = [];
    
    // Transition state
    this.transitionTo('idle');
    
    // Notify
    this.notifyStateChange();
  }
  
  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================
  
  /**
   * Records a step
   * 
   * @param step - Partial step data
   * @returns The recorded step
   */
  recordStep(step: Partial<RecordedStep> & { type: StepType }): RecordedStep {
    if (!this._session || this._state !== 'recording') {
      throw new Error('Not currently recording');
    }
    
    // Check step limit
    if (this._options.maxStepsPerSession && this._session.steps.length >= this._options.maxStepsPerSession) {
      this.handleError(new Error('Maximum steps per session reached'));
      throw new Error('Maximum steps per session reached');
    }
    
    // Create full step
    const fullStep: RecordedStep = {
      id: this.generateStepId(),
      name: step.name || `Step ${this.stepCounter + 1}`,
      event: step.event || 'click',
      path: step.path || '',
      value: step.value || '',
      label: step.label || '',
      x: step.x || 0,
      y: step.y || 0,
      bundle: step.bundle,
      type: step.type,
      timestamp: step.timestamp ?? Date.now(),
      target: step.target ?? {
        tagName: 'unknown',
        xpath: '',
        cssSelector: '',
      },
      metadata: step.metadata ?? {},
      screenshot: step.screenshot,
      locatorBundle: step.locatorBundle,
    };
    
    // Add to buffer
    this.stepBuffer.push(fullStep);
    
    // Update stats
    this.stats.totalSteps++;
    this.stats.stepsByType[step.type] = (this.stats.stepsByType[step.type] ?? 0) + 1;
    
    // Notify callback
    this.config.onStepRecorded?.(fullStep);
    
    // Flush buffer if threshold reached
    if (this.stepBuffer.length >= BUFFER_FLUSH_THRESHOLD) {
      this.flushBuffer();
    }
    
    return fullStep;
  }
  
  /**
   * Flushes the step buffer to the session
   */
  flushBuffer(): void {
    if (!this._session || this.stepBuffer.length === 0) {
      return;
    }
    
    // Add buffered steps to session
    for (const step of this.stepBuffer) {
      this._session.steps.push(step);
      
      // Add to undo history
      this.undoHistory.push({
        step,
        index: this._session.steps.length - 1,
      });
      
      // Limit undo history
      if (this.undoHistory.length > MAX_UNDO_HISTORY) {
        this.undoHistory.shift();
      }
    }
    
    // Clear redo history on new steps
    this.redoHistory = [];
    
    // Clear buffer
    this.stepBuffer = [];
    
    // Update stats
    this.stats.bufferSize = 0;
  }
  
  /**
   * Undoes the last recorded step
   * 
   * @returns The undone step or null
   */
  undo(): RecordedStep | null {
    if (!this._session || this.undoHistory.length === 0) {
      return null;
    }
    
    // Flush buffer first
    this.flushBuffer();
    
    const undoable = this.undoHistory.pop()!;
    
    // Remove from session
    this._session.steps.splice(undoable.index, 1);
    
    // Add to redo history
    this.redoHistory.push(undoable);
    
    // Update stats
    this.stats.totalSteps--;
    this.stats.stepsByType[undoable.step.type] = 
      Math.max(0, (this.stats.stepsByType[undoable.step.type] ?? 1) - 1);
    
    return undoable.step;
  }
  
  /**
   * Redoes the last undone step
   * 
   * @returns The redone step or null
   */
  redo(): RecordedStep | null {
    if (!this._session || this.redoHistory.length === 0) {
      return null;
    }
    
    const redoable = this.redoHistory.pop()!;
    
    // Add back to session
    this._session.steps.splice(redoable.index, 0, redoable.step);
    
    // Add to undo history
    this.undoHistory.push(redoable);
    
    // Update stats
    this.stats.totalSteps++;
    this.stats.stepsByType[redoable.step.type] = 
      (this.stats.stepsByType[redoable.step.type] ?? 0) + 1;
    
    return redoable.step;
  }
  
  /**
   * Deletes a step by ID
   * 
   * @param stepId - Step ID to delete
   * @returns Whether step was deleted
   */
  deleteStep(stepId: string): boolean {
    if (!this._session) {
      return false;
    }
    
    // Flush buffer first
    this.flushBuffer();
    
    const index = this._session.steps.findIndex((s: RecordedStep) => s.id === stepId);
    if (index === -1) {
      return false;
    }
    
    const step = this._session.steps[index];
    this._session.steps.splice(index, 1);
    
    // Update stats
    this.stats.totalSteps--;
    this.stats.stepsByType[step.type] = 
      Math.max(0, (this.stats.stepsByType[step.type] ?? 1) - 1);
    
    return true;
  }
  
  /**
   * Updates a step
   * 
   * @param stepId - Step ID to update
   * @param updates - Partial step updates
   * @returns The updated step or null
   */
  updateStep(stepId: string, updates: Partial<RecordedStep>): RecordedStep | null {
    if (!this._session) {
      return null;
    }
    
    // Flush buffer first
    this.flushBuffer();
    
    const step = this._session.steps.find((s: RecordedStep) => s.id === stepId);
    if (!step) {
      return null;
    }
    
    // Apply updates (excluding id and type)
    Object.assign(step, {
      ...updates,
      id: step.id,
      type: step.type,
    });
    
    return step;
  }
  
  /**
   * Gets all recorded steps
   */
  getSteps(): RecordedStep[] {
    if (!this._session) {
      return [];
    }
    
    // Include buffer
    return [...this._session.steps, ...this.stepBuffer];
  }
  
  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================
  
  /**
   * Attaches event listeners for recording
   */
  private attachEventListeners(): void {
    const options = { capture: true, passive: true };
    
    if (this._options.captureClicks) {
      this.addEventHandler('click', this.handleClick.bind(this), options);
      this.addEventHandler('dblclick', this.handleDoubleClick.bind(this), options);
    }
    
    if (this._options.captureInput) {
      this.addEventHandler('input', this.handleInput.bind(this), options);
      this.addEventHandler('change', this.handleChange.bind(this), options);
    }
    
    if (this._options.captureKeyboard) {
      this.addEventHandler('keydown', this.handleKeyDown.bind(this), { capture: true, passive: false });
    }
    
    if (this._options.captureScrolls) {
      this.addEventHandler('scroll', this.handleScroll.bind(this), options);
    }
    
    if (this._options.captureNavigation) {
      // Navigation is handled via message bus or History API
    }
  }
  
  /**
   * Detaches event listeners
   */
  private detachEventListeners(): void {
    for (const [eventType, handler] of this.eventHandlers) {
      document.removeEventListener(eventType, handler, { capture: true });
    }
    this.eventHandlers.clear();
  }
  
  /**
   * Adds an event handler
   */
  private addEventHandler(
    eventType: RecordingEventType,
    handler: EventHandler,
    options?: AddEventListenerOptions
  ): void {
    document.addEventListener(eventType, handler, options);
    this.eventHandlers.set(eventType, handler);
  }
  
  /**
   * Handles click events
   */
  private handleClick(event: Event): void {
    if (this._state !== 'recording') return;
    
    const target = event.target as HTMLElement;
    if (!target) return;
    
    // Skip if it's part of the extension UI
    if (this.isExtensionElement(target)) return;
    
    this.recordStep({
      type: 'click',
      target: this.extractTarget(target),
      metadata: {
        button: (event as MouseEvent).button,
        clientX: (event as MouseEvent).clientX,
        clientY: (event as MouseEvent).clientY,
      },
    });
  }
  
  /**
   * Handles double-click events
   */
  private handleDoubleClick(event: Event): void {
    if (this._state !== 'recording') return;
    
    const target = event.target as HTMLElement;
    if (!target || this.isExtensionElement(target)) return;
    
    this.recordStep({
      type: 'dblclick',
      target: this.extractTarget(target),
      metadata: {
        clientX: (event as MouseEvent).clientX,
        clientY: (event as MouseEvent).clientY,
      },
    });
  }
  
  /**
   * Handles input events with debouncing
   */
  private handleInput(event: Event): void {
    if (this._state !== 'recording') return;
    
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || this.isExtensionElement(target)) return;
    
    // Generate unique key for this input
    const inputKey = this.getInputKey(target);
    
    // Clear existing timer
    const existingTimer = this.inputTimers.get(inputKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set debounced recording
    const timer = setTimeout(() => {
      this.inputTimers.delete(inputKey);
      
      if (this._state !== 'recording') return;
      
      this.recordStep({
        type: 'input',
        target: this.extractTarget(target),
        value: this.getInputValue(target),
        metadata: {
          inputType: target.type,
        },
      });
    }, this._options.inputDebounceMs);
    
    this.inputTimers.set(inputKey, timer);
  }
  
  /**
   * Handles change events
   */
  private handleChange(event: Event): void {
    if (this._state !== 'recording') return;
    
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (!target || this.isExtensionElement(target)) return;
    
    // For select elements, record immediately
    if (target.tagName === 'SELECT') {
      this.recordStep({
        type: 'select',
        target: this.extractTarget(target),
        value: (target as HTMLSelectElement).value,
        metadata: {
          selectedIndex: (target as HTMLSelectElement).selectedIndex,
          selectedText: (target as HTMLSelectElement).selectedOptions[0]?.text,
        },
      });
    }
  }
  
  /**
   * Handles keydown events
   */
  private handleKeyDown(event: Event): void {
    if (this._state !== 'recording') return;
    
    const keyEvent = event as KeyboardEvent;
    const target = event.target as HTMLElement;
    
    // Only record special keys (Enter, Tab, Escape, etc.)
    const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'];
    
    if (specialKeys.includes(keyEvent.key) || keyEvent.ctrlKey || keyEvent.metaKey) {
      this.recordStep({
        type: 'keypress',
        target: this.extractTarget(target),
        value: keyEvent.key,
        metadata: {
          key: keyEvent.key,
          code: keyEvent.code,
          ctrlKey: keyEvent.ctrlKey,
          shiftKey: keyEvent.shiftKey,
          altKey: keyEvent.altKey,
          metaKey: keyEvent.metaKey,
        },
      });
    }
  }
  
  /**
   * Handles scroll events with debouncing
   */
  private handleScroll(event: Event): void {
    if (this._state !== 'recording') return;
    
    // Clear existing timer
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      
      if (this._state !== 'recording') return;
      
      const target = event.target as HTMLElement;
      
      this.recordStep({
        type: 'scroll',
        target: this.extractTarget(target),
        metadata: {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          scrollTop: target.scrollTop,
          scrollLeft: target.scrollLeft,
        },
      });
    }, this._options.scrollDebounceMs);
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Extracts target information from element
   */
  private extractTarget(element: HTMLElement): RecordedStep['target'] {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      name: (element as HTMLInputElement).name || undefined,
      xpath: this.generateXPath(element),
      cssSelector: this.generateCssSelector(element),
      textContent: element.textContent?.slice(0, 100),
      attributes: this.extractAttributes(element),
    };
  }
  
  /**
   * Generates XPath for element
   */
  private generateXPath(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    
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
      const part = index > 1 ? `${tagName}[${index}]` : tagName;
      parts.unshift(part);
      
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }
  
  /**
   * Generates CSS selector for element
   */
  private generateCssSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${current.id}`;
        parts.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.split(/\s+/).filter(c => c && !c.startsWith('ng-'));
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }
      
      parts.unshift(selector);
      current = current.parentElement;
    }
    
    return parts.join(' > ');
  }
  
  /**
   * Extracts relevant attributes from element
   */
  private extractAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    const relevantAttrs = ['data-testid', 'data-test', 'aria-label', 'role', 'type', 'placeholder'];
    
    for (const attr of relevantAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    }
    
    return attrs;
  }
  
  /**
   * Gets input value, handling password masking
   */
  private getInputValue(element: HTMLInputElement | HTMLTextAreaElement): string {
    if ((element as HTMLInputElement).type === 'password') {
      return '********';
    }
    return element.value;
  }
  
  /**
   * Generates unique input key
   */
  private getInputKey(element: HTMLElement): string {
    return element.id || this.generateXPath(element);
  }
  
  /**
   * Checks if element is part of extension UI
   */
  private isExtensionElement(element: HTMLElement): boolean {
    // Check for extension-specific attributes or classes
    return element.closest('[data-copilot-extension]') !== null;
  }
  
  /**
   * Generates session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Generates step ID
   */
  private generateStepId(): string {
    this.stepCounter++;
    return `step-${this._session?.id ?? 'unknown'}-${this.stepCounter}`;
  }
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  /**
   * Checks if can transition to state
   */
  private canTransitionTo(newState: RecordingState): boolean {
    return STATE_TRANSITIONS[this._state].includes(newState);
  }
  
  /**
   * Transitions to new state
   */
  private transitionTo(newState: RecordingState): void {
    const prevState = this._state;
    this._state = newState;
    this.config.onStateChange?.(newState, prevState);
  }
  
  /**
   * Notifies state change via message bus
   */
  private notifyStateChange(): void {
    const bus = this.config.messageBus;
    if (bus) {
      bus.broadcast('RECORDING_STATUS', {
        state: this._state,
        sessionId: this._session?.id,
        stepCount: this.stepCount,
      });
    }
  }
  
  // ==========================================================================
  // AUTO-SAVE
  // ==========================================================================
  
  /**
   * Starts auto-save interval
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      if (this._session && this.config.onAutoSave) {
        this.flushBuffer();
        try {
          await this.config.onAutoSave(this._session);
          this.stats.autoSaveCount++;
          this.stats.lastAutoSave = Date.now();
        } catch (error) {
          this.handleError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }, this._options.autoSaveIntervalMs);
  }
  
  /**
   * Stops auto-save interval
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
  
  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================
  
  /**
   * Handles errors
   */
  private handleError(error: Error): void {
    this.stats.errors++;
    this.config.onError?.(error);
    console.error('[RecordingController]', error);
  }
  
  // ==========================================================================
  // CLEANUP
  // ==========================================================================
  
  /**
   * Clears all timers
   */
  private clearTimers(): void {
    // Clear input timers
    for (const timer of this.inputTimers.values()) {
      clearTimeout(timer);
    }
    this.inputTimers.clear();
    
    // Clear scroll timer
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
  }
  
  /**
   * Destroys the controller
   */
  async destroy(): Promise<void> {
    await this.cancel();
    
    // Unsubscribe from message bus
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];
  }
  
  // ==========================================================================
  // STATISTICS
  // ==========================================================================
  
  /**
   * Creates empty stats object
   */
  private createEmptyStats(): ControllerStats {
    return {
      totalSteps: 0,
      stepsByType: {},
      errors: 0,
      sessionsStarted: 0,
      sessionsCompleted: 0,
      bufferSize: 0,
      undoHistorySize: 0,
      redoHistorySize: 0,
      autoSaveCount: 0,
      lastAutoSave: null,
    };
  }
  
  /**
   * Gets controller statistics
   */
  getStats(): ControllerStats {
    return {
      ...this.stats,
      bufferSize: this.stepBuffer.length,
      undoHistorySize: this.undoHistory.length,
      redoHistorySize: this.redoHistory.length,
    };
  }
  
  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new RecordingController
 * 
 * @param config - Controller configuration
 * @returns New RecordingController instance
 */
export function createRecordingController(
  config?: RecordingControllerConfig
): RecordingController {
  return new RecordingController(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default RecordingController;
