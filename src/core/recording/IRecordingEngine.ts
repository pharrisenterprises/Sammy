/**
 * IRecordingEngine - Recording Engine Interface Contract
 * @module core/recording/IRecordingEngine
 * @version 1.0.0
 * 
 * Defines the public API for the Recording Engine subsystem.
 * All recording engine implementations must conform to this interface.
 * 
 * The Recording Engine is responsible for:
 * - Capturing user interactions (clicks, inputs, keyboard events)
 * - Generating comprehensive element bundles with locators
 * - Detecting human-readable labels using multiple strategies
 * - Managing iframe and shadow DOM traversal
 * - Broadcasting recorded steps in real-time
 * 
 * @see recording-engine_breakdown.md for implementation details
 * @see 00_modularization-overview.md for architectural context
 */

import type { RecordedStep, StepType } from '../types/step';
import type { LocatorBundle } from '../types/locator-bundle';

// ============================================================================
// RECORDING STATE TYPES
// ============================================================================

/**
 * Possible states of the recording engine
 */
export type RecordingStatus = 
  | 'idle'      // Not recording, ready to start
  | 'recording' // Actively capturing events
  | 'paused'    // Temporarily stopped, can resume
  | 'stopping'  // In process of cleanup
  | 'error';    // Error state, requires reset

/**
 * Current state of the recording engine
 */
export interface RecordingState {
  /** Current recording status */
  readonly status: RecordingStatus;
  
  /** Whether recording is currently active */
  readonly isRecording: boolean;
  
  /** Whether recording is paused */
  readonly isPaused: boolean;
  
  /** Timestamp when recording started (null if not started) */
  readonly startedAt: number | null;
  
  /** Timestamp when recording was paused (null if not paused) */
  readonly pausedAt: number | null;
  
  /** Total duration in milliseconds (excludes paused time) */
  readonly duration: number;
  
  /** Number of steps recorded in current session */
  readonly stepCount: number;
  
  /** ID of current recording session */
  readonly sessionId: string | null;
  
  /** Any error that occurred */
  readonly error: Error | null;
}

// ============================================================================
// RECORDING CONFIGURATION
// ============================================================================

/**
 * Event types that can be captured during recording
 */
export type CaptureEventType = 
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'keydown'
  | 'keyup'
  | 'keypress'
  | 'focus'
  | 'blur'
  | 'mousedown'
  | 'mouseup'
  | 'submit'
  | 'scroll';

/**
 * Configuration for label detection strategies
 */
export interface LabelDetectionConfig {
  /** Enable Google Forms-specific detection (95% confidence) */
  enableGoogleForms: boolean;
  
  /** Enable Bootstrap layout detection (75% confidence) */
  enableBootstrap: boolean;
  
  /** Enable Material-UI pattern detection (70% confidence) */
  enableMaterialUI: boolean;
  
  /** Enable ARIA attribute detection (90% confidence) */
  enableAria: boolean;
  
  /** Enable placeholder text detection (70% confidence) */
  enablePlaceholder: boolean;
  
  /** Minimum confidence threshold (0-1) for label acceptance */
  minConfidence: number;
  
  /** Maximum characters for label text */
  maxLabelLength: number;
  
  /** Custom label detection strategies to include */
  customStrategies: ILabelDetectionStrategy[];
}

/**
 * Configuration for element capture behavior
 */
export interface CaptureConfig {
  /** Event types to capture */
  captureEvents: CaptureEventType[];
  
  /** Whether to capture events in iframes */
  includeIframes: boolean;
  
  /** Whether to penetrate shadow DOM boundaries */
  includeShadowDOM: boolean;
  
  /** Whether to capture closed shadow roots (requires page-interceptor) */
  includeClosedShadowDOM: boolean;
  
  /** Whether to filter out synthetic/programmatic events */
  filterSyntheticEvents: boolean;
  
  /** Debounce delay for rapid input events (ms) */
  inputDebounceMs: number;
  
  /** Selector for elements to ignore during recording */
  ignoreSelector: string | null;
  
  /** Selector for container to restrict recording to */
  containerSelector: string | null;
  
  /** Whether to highlight recorded elements visually */
  enableVisualFeedback: boolean;
  
  /** Duration of visual highlight (ms) */
  highlightDurationMs: number;
  
  /** CSS class to apply for highlight */
  highlightClassName: string;
}

/**
 * Full recording engine configuration
 */
export interface RecordingConfig {
  /** Project ID to associate steps with */
  projectId: string;
  
  /** Optional session name/description */
  sessionName?: string;
  
  /** Event capture configuration */
  capture: CaptureConfig;
  
  /** Label detection configuration */
  labelDetection: LabelDetectionConfig;
  
  /** Maximum number of steps to record (0 = unlimited) */
  maxSteps: number;
  
  /** Maximum recording duration in ms (0 = unlimited) */
  maxDurationMs: number;
  
  /** Whether to auto-save steps to storage */
  autoSave: boolean;
  
  /** Interval for auto-save in ms (if enabled) */
  autoSaveIntervalMs: number;
}

// ============================================================================
// RECORDING EVENTS
// ============================================================================

/**
 * Event types emitted by the recording engine
 */
export type RecordingEventType =
  | 'recording:started'
  | 'recording:stopped'
  | 'recording:paused'
  | 'recording:resumed'
  | 'recording:error'
  | 'step:captured'
  | 'step:updated'
  | 'step:removed'
  | 'state:changed';

/**
 * Base event structure
 */
export interface RecordingEventBase {
  /** Event type identifier */
  readonly type: RecordingEventType;
  
  /** Timestamp of event */
  readonly timestamp: number;
  
  /** Session ID if applicable */
  readonly sessionId: string | null;
}

/**
 * Event emitted when recording starts
 */
export interface RecordingStartedEvent extends RecordingEventBase {
  readonly type: 'recording:started';
  readonly config: RecordingConfig;
}

/**
 * Event emitted when recording stops
 */
export interface RecordingStoppedEvent extends RecordingEventBase {
  readonly type: 'recording:stopped';
  readonly steps: RecordedStep[];
  readonly duration: number;
  readonly reason: 'manual' | 'max_steps' | 'max_duration' | 'error';
}

/**
 * Event emitted when recording pauses
 */
export interface RecordingPausedEvent extends RecordingEventBase {
  readonly type: 'recording:paused';
  readonly stepCount: number;
}

/**
 * Event emitted when recording resumes
 */
export interface RecordingResumedEvent extends RecordingEventBase {
  readonly type: 'recording:resumed';
  readonly pauseDuration: number;
}

/**
 * Event emitted when an error occurs
 */
export interface RecordingErrorEvent extends RecordingEventBase {
  readonly type: 'recording:error';
  readonly error: Error;
  readonly recoverable: boolean;
}

/**
 * Event emitted when a step is captured
 */
export interface StepCapturedEvent extends RecordingEventBase {
  readonly type: 'step:captured';
  readonly step: RecordedStep;
  readonly index: number;
}

/**
 * Event emitted when a step is updated
 */
export interface StepUpdatedEvent extends RecordingEventBase {
  readonly type: 'step:updated';
  readonly step: RecordedStep;
  readonly index: number;
  readonly previousStep: RecordedStep;
}

/**
 * Event emitted when a step is removed
 */
export interface StepRemovedEvent extends RecordingEventBase {
  readonly type: 'step:removed';
  readonly step: RecordedStep;
  readonly index: number;
}

/**
 * Event emitted when state changes
 */
export interface StateChangedEvent extends RecordingEventBase {
  readonly type: 'state:changed';
  readonly previousState: RecordingState;
  readonly currentState: RecordingState;
}

/**
 * Union of all recording events
 */
export type RecordingEvent =
  | RecordingStartedEvent
  | RecordingStoppedEvent
  | RecordingPausedEvent
  | RecordingResumedEvent
  | RecordingErrorEvent
  | StepCapturedEvent
  | StepUpdatedEvent
  | StepRemovedEvent
  | StateChangedEvent;

/**
 * Event handler function type
 */
export type RecordingEventHandler<T extends RecordingEvent = RecordingEvent> = 
  (event: T) => void;

/**
 * Map of event types to their handler types
 */
export interface RecordingEventHandlerMap {
  'recording:started': RecordingEventHandler<RecordingStartedEvent>;
  'recording:stopped': RecordingEventHandler<RecordingStoppedEvent>;
  'recording:paused': RecordingEventHandler<RecordingPausedEvent>;
  'recording:resumed': RecordingEventHandler<RecordingResumedEvent>;
  'recording:error': RecordingEventHandler<RecordingErrorEvent>;
  'step:captured': RecordingEventHandler<StepCapturedEvent>;
  'step:updated': RecordingEventHandler<StepUpdatedEvent>;
  'step:removed': RecordingEventHandler<StepRemovedEvent>;
  'state:changed': RecordingEventHandler<StateChangedEvent>;
}

// ============================================================================
// LABEL DETECTION STRATEGY INTERFACE
// ============================================================================

/**
 * Result from a label detection attempt
 */
export interface LabelDetectionResult {
  /** The detected label text */
  label: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Strategy that produced this result */
  strategy: string;
  
  /** Source element that contained the label */
  sourceElement?: Element;
  
  /** Additional metadata about the detection */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for pluggable label detection strategies
 * 
 * Implementations detect human-readable labels for form elements
 * using framework-specific patterns (Bootstrap, Material-UI, etc.)
 */
export interface ILabelDetectionStrategy {
  /** Unique identifier for this strategy */
  readonly name: string;
  
  /** Base confidence level for this strategy (0-1) */
  readonly baseConfidence: number;
  
  /** Priority order (lower = checked first) */
  readonly priority: number;
  
  /**
   * Detect label for the given element
   * 
   * @param element - Target element to find label for
   * @param document - Document context
   * @returns Detection result or null if no label found
   */
  detect(element: Element, document: Document): LabelDetectionResult | null;
  
  /**
   * Check if this strategy applies to the given element
   * 
   * @param element - Element to check
   * @param document - Document context
   * @returns True if strategy should be attempted
   */
  canHandle(element: Element, document: Document): boolean;
}

// ============================================================================
// RECORDING SESSION
// ============================================================================

/**
 * Represents a recording session with its captured steps
 */
export interface RecordingSession {
  /** Unique session identifier */
  readonly id: string;
  
  /** Project this session belongs to */
  readonly projectId: string;
  
  /** Session name/description */
  readonly name: string;
  
  /** When session was created */
  readonly createdAt: number;
  
  /** When session was last updated */
  readonly updatedAt: number;
  
  /** Total recording duration (excludes paused time) */
  readonly duration: number;
  
  /** Steps recorded in this session */
  readonly steps: RecordedStep[];
  
  /** Starting URL when recording began */
  readonly startUrl: string;
  
  /** Configuration used for this session */
  readonly config: RecordingConfig;
}

// ============================================================================
// RECORDING ENGINE INTERFACE
// ============================================================================

/**
 * Recording Engine Interface
 * 
 * The Recording Engine captures user interactions and transforms them
 * into structured, replay-able steps. It handles:
 * 
 * - Event capture across documents, iframes, and shadow DOM
 * - Label detection using 12+ heuristic strategies
 * - Comprehensive locator bundle generation
 * - Real-time step broadcasting
 * 
 * ## Lifecycle
 * 
 * ```
 * idle -> start() -> recording
 *                      |
 *                   pause() -> paused -> resume() -> recording
 *                      |                    |
 *                   stop() <----------------+
 *                      |
 *                    idle
 * ```
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const engine = new RecordingEngine();
 * 
 * // Subscribe to step events
 * engine.addEventListener('step:captured', (event) => {
 *   console.log('Captured:', event.step);
 * });
 * 
 * // Start recording
 * await engine.start({
 *   projectId: 'project-123',
 *   capture: {
 *     captureEvents: ['click', 'input', 'keydown'],
 *     includeIframes: true,
 *     includeShadowDOM: true,
 *   },
 *   labelDetection: {
 *     enableGoogleForms: true,
 *     enableAria: true,
 *     minConfidence: 0.5,
 *   },
 * });
 * 
 * // Later, stop and get results
 * const steps = await engine.stop();
 * ```
 * 
 * @see RecordingConfig for configuration options
 * @see RecordingEvent for event types
 */
export interface IRecordingEngine {
  // ==========================================================================
  // STATE PROPERTIES
  // ==========================================================================
  
  /**
   * Current recording state
   */
  readonly state: RecordingState;
  
  /**
   * Current configuration (null if not started)
   */
  readonly config: RecordingConfig | null;
  
  /**
   * Currently recorded steps
   */
  readonly steps: readonly RecordedStep[];
  
  /**
   * Current session (null if not started)
   */
  readonly session: RecordingSession | null;
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Start recording user interactions
   * 
   * Initializes event listeners, sets up iframe traversal,
   * and begins capturing user actions.
   * 
   * @param config - Recording configuration
   * @returns Promise resolving when recording has started
   * @throws Error if already recording or invalid config
   * 
   * @example
   * ```typescript
   * await engine.start({
   *   projectId: 'my-project',
   *   capture: { captureEvents: ['click', 'input'] },
   *   labelDetection: { enableAria: true },
   * });
   * ```
   */
  start(config: RecordingConfig): Promise<void>;
  
  /**
   * Stop recording and return captured steps
   * 
   * Cleans up event listeners, finalizes the session,
   * and returns all captured steps.
   * 
   * @returns Promise resolving with array of recorded steps
   * @throws Error if not currently recording
   * 
   * @example
   * ```typescript
   * const steps = await engine.stop();
   * console.log(`Recorded ${steps.length} steps`);
   * ```
   */
  stop(): Promise<RecordedStep[]>;
  
  /**
   * Pause recording temporarily
   * 
   * Suspends event capture without losing recorded steps.
   * Useful for user interactions with extension UI.
   * 
   * @throws Error if not recording or already paused
   * 
   * @example
   * ```typescript
   * engine.pause();
   * // ... user interacts with extension ...
   * engine.resume();
   * ```
   */
  pause(): void;
  
  /**
   * Resume recording after pause
   * 
   * @throws Error if not paused
   */
  resume(): void;
  
  /**
   * Reset the engine to initial state
   * 
   * Clears all recorded steps and resets state.
   * Use after an error or to start fresh.
   */
  reset(): void;
  
  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================
  
  /**
   * Get a specific step by index
   * 
   * @param index - Step index (0-based)
   * @returns The step at the given index, or undefined
   */
  getStep(index: number): RecordedStep | undefined;
  
  /**
   * Get a step by its ID
   * 
   * @param id - Step ID
   * @returns The step with the given ID, or undefined
   */
  getStepById(id: string): RecordedStep | undefined;
  
  /**
   * Update an existing step
   * 
   * @param index - Step index to update
   * @param updates - Partial step data to merge
   * @returns The updated step
   * @throws Error if index out of bounds
   */
  updateStep(index: number, updates: Partial<RecordedStep>): RecordedStep;
  
  /**
   * Remove a step by index
   * 
   * @param index - Step index to remove
   * @returns The removed step
   * @throws Error if index out of bounds
   */
  removeStep(index: number): RecordedStep;
  
  /**
   * Insert a step at a specific position
   * 
   * @param index - Position to insert at
   * @param step - Step to insert
   */
  insertStep(index: number, step: RecordedStep): void;
  
  /**
   * Reorder steps
   * 
   * @param fromIndex - Current index of step
   * @param toIndex - Target index
   */
  reorderStep(fromIndex: number, toIndex: number): void;
  
  /**
   * Clear all recorded steps
   * 
   * Does not stop recording, just clears the step list.
   */
  clearSteps(): void;
  
  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================
  
  /**
   * Add an event listener
   * 
   * @param event - Event type to listen for
   * @param handler - Event handler function
   * 
   * @example
   * ```typescript
   * engine.addEventListener('step:captured', (event) => {
   *   console.log('New step:', event.step);
   * });
   * ```
   */
  addEventListener<K extends RecordingEventType>(
    event: K,
    handler: RecordingEventHandlerMap[K]
  ): void;
  
  /**
   * Remove an event listener
   * 
   * @param event - Event type
   * @param handler - Handler to remove
   */
  removeEventListener<K extends RecordingEventType>(
    event: K,
    handler: RecordingEventHandlerMap[K]
  ): void;
  
  /**
   * Remove all listeners for an event type
   * 
   * @param event - Event type, or undefined to remove all
   */
  removeAllListeners(event?: RecordingEventType): void;
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Update configuration during recording
   * 
   * Only certain config properties can be updated while recording.
   * Changes take effect for subsequent captures.
   * 
   * @param updates - Partial configuration updates
   * @throws Error if not recording or invalid updates
   */
  updateConfig(updates: Partial<RecordingConfig>): void;
  
  /**
   * Register a custom label detection strategy
   * 
   * @param strategy - Strategy to register
   */
  registerLabelStrategy(strategy: ILabelDetectionStrategy): void;
  
  /**
   * Unregister a label detection strategy
   * 
   * @param name - Strategy name to unregister
   */
  unregisterLabelStrategy(name: string): void;
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /**
   * Manually capture an element
   * 
   * Creates a step for the given element without user interaction.
   * Useful for programmatic step creation.
   * 
   * @param element - Element to capture
   * @param eventType - Event type for the step
   * @param value - Optional value (for input events)
   * @returns The captured step
   */
  captureElement(
    element: Element,
    eventType: StepType,
    value?: string
  ): RecordedStep;
  
  /**
   * Get the label for an element using configured strategies
   * 
   * @param element - Element to get label for
   * @returns Label detection result
   */
  detectLabel(element: Element): LabelDetectionResult | null;
  
  /**
   * Generate a locator bundle for an element
   * 
   * @param element - Element to generate bundle for
   * @returns Comprehensive locator bundle
   */
  generateBundle(element: Element): LocatorBundle;
  
  /**
   * Check if an element should be captured
   * 
   * Applies ignore selectors and container restrictions.
   * 
   * @param element - Element to check
   * @returns True if element should be captured
   */
  shouldCapture(element: Element): boolean;
  
  /**
   * Export recording session data
   * 
   * @returns Serializable session data
   */
  exportSession(): RecordingSession;
  
  /**
   * Import a previous session
   * 
   * @param session - Session data to import
   */
  importSession(session: RecordingSession): void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default capture configuration
 */
export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  captureEvents: ['click', 'input', 'change', 'keydown'],
  includeIframes: true,
  includeShadowDOM: true,
  includeClosedShadowDOM: false,
  filterSyntheticEvents: true,
  inputDebounceMs: 300,
  ignoreSelector: null,
  containerSelector: null,
  enableVisualFeedback: true,
  highlightDurationMs: 500,
  highlightClassName: 'recorder-highlight',
};

/**
 * Default label detection configuration
 */
export const DEFAULT_LABEL_DETECTION_CONFIG: LabelDetectionConfig = {
  enableGoogleForms: true,
  enableBootstrap: true,
  enableMaterialUI: true,
  enableAria: true,
  enablePlaceholder: true,
  minConfidence: 0.4,
  maxLabelLength: 100,
  customStrategies: [],
};

/**
 * Default recording configuration
 */
export const DEFAULT_RECORDING_CONFIG: Omit<RecordingConfig, 'projectId'> = {
  capture: DEFAULT_CAPTURE_CONFIG,
  labelDetection: DEFAULT_LABEL_DETECTION_CONFIG,
  maxSteps: 0,
  maxDurationMs: 0,
  autoSave: true,
  autoSaveIntervalMs: 5000,
};

/**
 * Create a recording configuration with defaults
 * 
 * @param projectId - Required project ID
 * @param overrides - Optional configuration overrides
 * @returns Complete recording configuration
 */
export function createRecordingConfig(
  projectId: string,
  overrides?: Partial<Omit<RecordingConfig, 'projectId'>>
): RecordingConfig {
  return {
    ...DEFAULT_RECORDING_CONFIG,
    ...overrides,
    projectId,
    capture: {
      ...DEFAULT_CAPTURE_CONFIG,
      ...overrides?.capture,
    },
    labelDetection: {
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      ...overrides?.labelDetection,
    },
  };
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Initial recording state
 */
export const INITIAL_RECORDING_STATE: RecordingState = {
  status: 'idle',
  isRecording: false,
  isPaused: false,
  startedAt: null,
  pausedAt: null,
  duration: 0,
  stepCount: 0,
  sessionId: null,
  error: null,
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid RecordingStatus
 */
export function isRecordingStatus(value: unknown): value is RecordingStatus {
  return (
    typeof value === 'string' &&
    ['idle', 'recording', 'paused', 'stopping', 'error'].includes(value)
  );
}

/**
 * Check if a value is a valid RecordingEventType
 */
export function isRecordingEventType(value: unknown): value is RecordingEventType {
  return (
    typeof value === 'string' &&
    [
      'recording:started',
      'recording:stopped',
      'recording:paused',
      'recording:resumed',
      'recording:error',
      'step:captured',
      'step:updated',
      'step:removed',
      'state:changed',
    ].includes(value)
  );
}

/**
 * Check if a value is a valid CaptureEventType
 */
export function isCaptureEventType(value: unknown): value is CaptureEventType {
  return (
    typeof value === 'string' &&
    [
      'click', 'dblclick', 'input', 'change', 'keydown',
      'keyup', 'keypress', 'focus', 'blur', 'mousedown',
      'mouseup', 'submit', 'scroll',
    ].includes(value)
  );
}
