/**
 * @fileoverview Core recording engine for capturing user interactions
 * @module core/recording/recorder
 * @version 1.0.0
 * 
 * This module provides the core recording engine that captures user
 * interactions (click, input, enter) and builds Steps with LocatorBundles.
 * 
 * STEP EVENT TYPES (only 4 allowed):
 * - 'click' - Mouse click on element
 * - 'input' - Text input into field
 * - 'enter' - Enter key press
 * - 'open' - Page navigation (auto-added as first step)
 * 
 * RECORDING FLOW:
 * 1. Start recording → Add 'open' step with current URL
 * 2. User clicks element → Capture click, build bundle, add step
 * 3. User types in field → Capture input value, build bundle, add step
 * 4. User presses Enter → Capture enter, build bundle, add step
 * 5. Stop recording → Return all captured steps
 * 
 * @see PHASE_4_SPECIFICATIONS.md for recording specifications
 * @see recording-engine_breakdown.md for engine details
 */

import type { Step, StepEvent, LocatorBundle } from '../types';
import { createStep, createEmptyBundle } from '../types';
import { buildBundle } from '../locators';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recording state
 */
export type RecordingState = 'idle' | 'recording' | 'paused';

/**
 * Recording configuration
 */
export interface RecordingConfig {
  /** Capture click events */
  captureClicks?: boolean;
  /** Capture input events */
  captureInputs?: boolean;
  /** Capture enter key events */
  captureEnter?: boolean;
  /** Debounce input events (ms) */
  inputDebounce?: number;
  /** Highlight captured elements */
  highlightElements?: boolean;
  /** Highlight duration (ms) */
  highlightDuration?: number;
  /** Ignored element selectors */
  ignoredSelectors?: string[];
  /** Only capture within this selector */
  scopeSelector?: string;
  /** Auto-scroll to captured elements */
  autoScroll?: boolean;
}

/**
 * Captured step before finalization
 */
export interface CapturedStep {
  /** Event type */
  event: StepEvent;
  /** Element bundle */
  bundle: LocatorBundle;
  /** Input value (for input events) */
  value: string;
  /** Capture timestamp */
  timestamp: number;
  /** Element tag name */
  tagName: string;
  /** Whether step was merged with previous */
  merged?: boolean;
}

/**
 * Recording session data
 */
export interface RecordingSession {
  /** Session ID */
  id: string;
  /** Project ID being recorded */
  projectId: string;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp (if ended) */
  endedAt: number | null;
  /** Starting URL */
  startUrl: string;
  /** Captured steps */
  steps: CapturedStep[];
  /** Recording state */
  state: RecordingState;
}

/**
 * Recording event callback
 */
export type RecordingCallback = (step: CapturedStep, index: number) => void;

/**
 * State change callback
 */
export type StateChangeCallback = (
  newState: RecordingState,
  oldState: RecordingState
) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default recording configuration
 */
export const DEFAULT_RECORDING_CONFIG: Required<RecordingConfig> = {
  captureClicks: true,
  captureInputs: true,
  captureEnter: true,
  inputDebounce: 500,
  highlightElements: true,
  highlightDuration: 1000,
  ignoredSelectors: [
    '[data-sammy-ignore]',
    '.sammy-highlight-overlay',
    '.sammy-ui',
    '#sammy-extension'
  ],
  scopeSelector: '',
  autoScroll: false
};

/**
 * Elements that should capture input events
 */
const INPUT_ELEMENTS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Input types that should capture input events
 */
const CAPTURABLE_INPUT_TYPES = [
  'text', 'email', 'password', 'search', 'tel', 'url',
  'number', 'date', 'time', 'datetime-local', 'month', 'week'
];

// ============================================================================
// RECORDER CLASS
// ============================================================================

/**
 * Recording Engine
 * 
 * Captures user interactions and builds Steps with LocatorBundles.
 * 
 * @example
 * ```typescript
 * const recorder = new Recorder('project-123');
 * 
 * // Start recording
 * recorder.start('https://example.com');
 * 
 * // Listen for captured steps
 * recorder.onStepCaptured((step, index) => {
 *   console.log(`Step ${index + 1}: ${step.event}`);
 * });
 * 
 * // Stop and get steps
 * const steps = recorder.stop();
 * ```
 */
export class Recorder {
  private session: RecordingSession | null = null;
  private config: Required<RecordingConfig>;
  private stepCallbacks: Set<RecordingCallback> = new Set();
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private inputDebounceTimers: Map<Element, number> = new Map();
  private lastInputValues: Map<Element, string> = new Map();

  constructor(
    private projectId: string,
    config: RecordingConfig = {}
  ) {
    this.config = { ...DEFAULT_RECORDING_CONFIG, ...config };
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Start recording session
   * 
   * @param startUrl - Starting URL for the recording
   * @returns Session ID
   */
  start(startUrl: string): string {
    if (this.session?.state === 'recording') {
      throw new Error('Recording already in progress');
    }

    const sessionId = generateSessionId();

    this.session = {
      id: sessionId,
      projectId: this.projectId,
      startedAt: Date.now(),
      endedAt: null,
      startUrl,
      steps: [],
      state: 'recording'
    };

    // Add initial 'open' step
    this.addOpenStep(startUrl);

    // Notify state change
    this.notifyStateChange('recording', 'idle');

    return sessionId;
  }

  /**
   * Stop recording and return captured steps
   * 
   * @returns Array of finalized Steps
   */
  stop(): Step[] {
    if (!this.session) {
      return [];
    }

    const previousState = this.session.state;
    this.session.state = 'idle';
    this.session.endedAt = Date.now();

    // Clear debounce timers
    this.clearDebounceTimers();

    // Finalize steps
    const steps = this.finalizeSteps();

    // Notify state change
    this.notifyStateChange('idle', previousState);

    // Clear session
    const finalSteps = steps;
    this.session = null;

    return finalSteps;
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.session?.state !== 'recording') {
      return;
    }

    const previousState = this.session.state;
    this.session.state = 'paused';
    this.notifyStateChange('paused', previousState);
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.session?.state !== 'paused') {
      return;
    }

    const previousState = this.session.state;
    this.session.state = 'recording';
    this.notifyStateChange('recording', previousState);
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.session?.state === 'recording';
  }

  /**
   * Check if recording is paused
   */
  isPaused(): boolean {
    return this.session?.state === 'paused';
  }

  /**
   * Get current state
   */
  getState(): RecordingState {
    return this.session?.state ?? 'idle';
  }

  /**
   * Get current session
   */
  getSession(): RecordingSession | null {
    return this.session;
  }

  /**
   * Get captured steps count
   */
  getStepCount(): number {
    return this.session?.steps.length ?? 0;
  }

  // ==========================================================================
  // EVENT CAPTURE
  // ==========================================================================

  /**
   * Capture a click event
   * 
   * @param element - Clicked element
   * @returns Whether capture was successful
   */
  captureClick(element: Element): boolean {
    if (!this.canCapture() || !this.config.captureClicks) {
      return false;
    }

    if (this.shouldIgnoreElement(element)) {
      return false;
    }

    const bundleResult = buildBundle(element);
    
    const capturedStep: CapturedStep = {
      event: 'click',
      bundle: bundleResult.bundle,
      value: '',
      timestamp: Date.now(),
      tagName: element.tagName
    };

    this.addCapturedStep(capturedStep);
    return true;
  }

  /**
   * Capture an input event
   * 
   * @param element - Input element
   * @param value - Current input value
   * @returns Whether capture was successful
   */
  captureInput(element: Element, value: string): boolean {
    if (!this.canCapture() || !this.config.captureInputs) {
      return false;
    }

    if (this.shouldIgnoreElement(element)) {
      return false;
    }

    if (!this.isCapturableInput(element)) {
      return false;
    }

    // Debounce input captures
    const existingTimer = this.inputDebounceTimers.get(element);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store latest value
    this.lastInputValues.set(element, value);

    // Set debounce timer
    const timer = window.setTimeout(() => {
      this.finalizeInputCapture(element);
    }, this.config.inputDebounce);

    this.inputDebounceTimers.set(element, timer);
    return true;
  }

  /**
   * Capture an enter key event
   * 
   * @param element - Element where Enter was pressed
   * @returns Whether capture was successful
   */
  captureEnter(element: Element): boolean {
    if (!this.canCapture() || !this.config.captureEnter) {
      return false;
    }

    if (this.shouldIgnoreElement(element)) {
      return false;
    }

    // Finalize any pending input on this element first
    this.finalizeInputCapture(element);

    const bundleResult = buildBundle(element);
    
    const capturedStep: CapturedStep = {
      event: 'enter',
      bundle: bundleResult.bundle,
      value: '',
      timestamp: Date.now(),
      tagName: element.tagName
    };

    this.addCapturedStep(capturedStep);
    return true;
  }

  /**
   * Capture from DOM event
   * 
   * @param event - DOM Event
   * @returns Whether capture was successful
   */
  captureFromEvent(event: Event): boolean {
    const target = event.target;
    
    // Check if target is an element (JSDOM compatible)
    if (!target || !('tagName' in target)) {
      return false;
    }

    const element = target as Element;

    switch (event.type) {
      case 'click':
        return this.captureClick(element);
      
      case 'input':
      case 'change':
        // Check by tag name for JSDOM compatibility
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) && 'value' in element) {
          return this.captureInput(element, (element as HTMLInputElement).value);
        }
        return false;
      
      case 'keydown':
      case 'keypress':
        if ('key' in event && (event as KeyboardEvent).key === 'Enter') {
          return this.captureEnter(element);
        }
        return false;
      
      default:
        return false;
    }
  }

  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================

  /**
   * Add the initial 'open' step
   */
  private addOpenStep(url: string): void {
    const openBundle = createEmptyBundle();
    openBundle.pageUrl = url;
    openBundle.tag = 'document';

    const capturedStep: CapturedStep = {
      event: 'open',
      bundle: openBundle,
      value: url,
      timestamp: Date.now(),
      tagName: 'document'
    };

    this.addCapturedStep(capturedStep);
  }

  /**
   * Add a captured step to the session
   */
  private addCapturedStep(step: CapturedStep): void {
    if (!this.session) return;

    // Check for merge with previous input step
    const merged = this.tryMergeWithPrevious(step);
    
    if (!merged) {
      this.session.steps.push(step);
    }

    // Notify callbacks
    const index = this.session.steps.length - 1;
    this.notifyStepCaptured(this.session.steps[index], index);
  }

  /**
   * Try to merge input step with previous input on same element
   */
  private tryMergeWithPrevious(step: CapturedStep): boolean {
    if (!this.session || step.event !== 'input') {
      return false;
    }

    const steps = this.session.steps;
    if (steps.length === 0) return false;

    const lastStep = steps[steps.length - 1];
    
    // Merge if same element and same event type
    if (lastStep.event === 'input' && 
        lastStep.bundle.id === step.bundle.id &&
        lastStep.bundle.xpath === step.bundle.xpath) {
      // Update value to latest
      lastStep.value = step.value;
      lastStep.timestamp = step.timestamp;
      lastStep.merged = true;
      return true;
    }

    return false;
  }

  /**
   * Finalize pending input capture for element
   */
  private finalizeInputCapture(element: Element): void {
    const timer = this.inputDebounceTimers.get(element);
    if (timer) {
      clearTimeout(timer);
      this.inputDebounceTimers.delete(element);
    }

    const value = this.lastInputValues.get(element);
    if (value === undefined) return;

    this.lastInputValues.delete(element);

    const bundleResult = buildBundle(element);
    
    const capturedStep: CapturedStep = {
      event: 'input',
      bundle: bundleResult.bundle,
      value,
      timestamp: Date.now(),
      tagName: element.tagName
    };

    this.addCapturedStep(capturedStep);
  }

  /**
   * Convert captured steps to finalized Steps
   */
  private finalizeSteps(): Step[] {
    if (!this.session) return [];

    // Flush any pending input captures
    for (const element of this.inputDebounceTimers.keys()) {
      this.finalizeInputCapture(element);
    }

    return this.session.steps.map((captured) => 
      createStep({
        event: captured.event,
        path: captured.bundle.xpath,
        value: captured.value,
        x: captured.bundle.bounding?.x ?? 0,
        y: captured.bundle.bounding?.y ?? 0,
        bundle: captured.bundle
      })
    );
  }

  /**
   * Delete last captured step
   */
  deleteLastStep(): CapturedStep | null {
    if (!this.session || this.session.steps.length === 0) {
      return null;
    }

    return this.session.steps.pop() ?? null;
  }

  /**
   * Delete step at index
   */
  deleteStepAt(index: number): CapturedStep | null {
    if (!this.session || index < 0 || index >= this.session.steps.length) {
      return null;
    }

    const [removed] = this.session.steps.splice(index, 1);
    return removed ?? null;
  }

  /**
   * Get captured steps (not finalized)
   */
  getCapturedSteps(): CapturedStep[] {
    return this.session?.steps ?? [];
  }

  // ==========================================================================
  // CALLBACKS
  // ==========================================================================

  /**
   * Register callback for captured steps
   */
  onStepCaptured(callback: RecordingCallback): () => void {
    this.stepCallbacks.add(callback);
    return () => this.stepCallbacks.delete(callback);
  }

  /**
   * Register callback for state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Notify step captured callbacks
   */
  private notifyStepCaptured(step: CapturedStep, index: number): void {
    for (const callback of this.stepCallbacks) {
      try {
        callback(step, index);
      } catch (error) {
        console.error('Step callback error:', error);
      }
    }
  }

  /**
   * Notify state change callbacks
   */
  private notifyStateChange(
    newState: RecordingState,
    oldState: RecordingState
  ): void {
    for (const callback of this.stateCallbacks) {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('State callback error:', error);
      }
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Check if recording can capture
   */
  private canCapture(): boolean {
    return this.session?.state === 'recording';
  }

  /**
   * Check if element should be ignored
   */
  private shouldIgnoreElement(element: Element): boolean {
    // Check ignored selectors
    for (const selector of this.config.ignoredSelectors) {
      try {
        if (element.matches(selector) || element.closest(selector)) {
          return true;
        }
      } catch {
        // Invalid selector
      }
    }

    // Check scope selector
    if (this.config.scopeSelector) {
      try {
        if (!element.closest(this.config.scopeSelector)) {
          return true;
        }
      } catch {
        // Invalid selector
      }
    }

    return false;
  }

  /**
   * Check if element is a capturable input
   */
  private isCapturableInput(element: Element): boolean {
    if (!INPUT_ELEMENTS.includes(element.tagName)) {
      return false;
    }

    // Check if element is an input with proper type checking
    if (element.tagName === 'INPUT' && 'type' in element) {
      const type = (element as HTMLInputElement).type.toLowerCase();
      return CAPTURABLE_INPUT_TYPES.includes(type);
    }

    return true; // TEXTAREA and SELECT are always capturable
  }

  /**
   * Clear all debounce timers
   */
  private clearDebounceTimers(): void {
    for (const timer of this.inputDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.inputDebounceTimers.clear();
    this.lastInputValues.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RecordingConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RecordingConfig> {
    return { ...this.config };
  }

  /**
   * Destroy recorder and cleanup
   */
  destroy(): void {
    if (this.session?.state === 'recording') {
      this.stop();
    }
    this.clearDebounceTimers();
    this.stepCallbacks.clear();
    this.stateCallbacks.clear();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rec_${timestamp}_${random}`;
}

/**
 * Create a new recorder instance
 */
export function createRecorder(
  projectId: string,
  config?: RecordingConfig
): Recorder {
  return new Recorder(projectId, config);
}

/**
 * Check if element should trigger click capture
 * 
 * Some elements should capture click differently based on type.
 */
export function shouldCaptureClickAs(element: Element): StepEvent {
  // Buttons and links are always clicks
  if (element.tagName === 'BUTTON' || element.tagName === 'A') {
    return 'click';
  }

  // Submit inputs trigger click
  if (element.tagName === 'INPUT' && 'type' in element) {
    const type = (element as HTMLInputElement).type;
    if (type === 'submit' || type === 'button') {
      return 'click';
    }
    // Checkboxes and radios are clicks
    if (type === 'checkbox' || type === 'radio') {
      return 'click';
    }
  }

  // Default to click
  return 'click';
}

/**
 * Determine if input should be captured immediately vs debounced
 */
export function shouldCaptureImmediately(element: Element): boolean {
  if (element.tagName === 'SELECT') {
    return true; // Selects should capture immediately on change
  }

  if (element.tagName === 'INPUT' && 'type' in element) {
    // These types should capture immediately
    const immediateTypes = ['checkbox', 'radio', 'date', 'time', 'file'];
    return immediateTypes.includes((element as HTMLInputElement).type);
  }

  return false;
}
