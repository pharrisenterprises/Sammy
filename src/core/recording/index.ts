/**
 * @fileoverview Barrel export for all recording-related types and utilities
 * @module core/recording
 * @version 1.0.0
 * 
 * This module re-exports all recording engine types, the Recorder class,
 * event handlers, and utilities for capturing user interactions.
 * 
 * RECORDING WORKFLOW:
 * 1. Create Recorder with project ID
 * 2. Start recording with initial URL (adds 'open' step)
 * 3. Attach event handlers to capture interactions
 * 4. User interactions create click/input/enter steps
 * 5. Stop recording to get finalized Step[]
 * 
 * STEP EVENT TYPES (only 4 allowed):
 * - 'open' - Page navigation (auto-added as first step)
 * - 'click' - Mouse click on element
 * - 'input' - Text input into field
 * - 'enter' - Enter key press
 * 
 * @example
 * ```typescript
 * // Import recorder
 * import { Recorder, createRecorder } from '@/core/recording';
 * 
 * // Import event handlers
 * import { EventHandlerManager, attachRecordingHandlers } from '@/core/recording';
 * 
 * // Quick setup
 * import { startRecording, stopRecording } from '@/core/recording';
 * ```
 * 
 * @see PHASE_4_SPECIFICATIONS.md for recording specifications
 * @see recording-engine_breakdown.md for engine details
 */

// ============================================================================
// RECORDER
// ============================================================================

export {
  // Types
  type RecordingState,
  type RecordingConfig,
  type CapturedStep,
  type RecordingSession,
  type RecordingCallback,
  type StateChangeCallback,
  
  // Constants
  DEFAULT_RECORDING_CONFIG,
  
  // Recorder Class
  Recorder,
  
  // Factory Function
  createRecorder,
  
  // Utility Functions
  shouldCaptureClickAs,
  shouldCaptureImmediately
} from './recorder';

// ============================================================================
// EVENT HANDLERS
// ============================================================================

export {
  // Types
  type EventHandlerConfig,
  type EventHandlerState,
  
  // Constants
  DEFAULT_EVENT_HANDLER_CONFIG,
  RECORDING_EVENTS,
  
  // Event Handler Manager
  EventHandlerManager,
  
  // Standalone Handlers
  createClickHandler,
  createInputHandler,
  createKeydownHandler,
  
  // Attach Function
  attachRecordingHandlers,
  
  // Filters
  createElementTypeFilter,
  createSelectorFilter,
  combineFilters,
  createExcludeFilter,
  
  // Iframe Support
  attachToIframe,
  attachToAllIframes
} from './event-handlers';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

// Re-export Step type for convenience
export type { Step, StepEvent } from '../types';

// Re-export highlight functions commonly used during recording
export {
  highlightRecording,
  highlightSuccess,
  highlightError,
  removeHighlight,
  clearAllHighlights
} from '../locators';

// ============================================================================
// COMPOSITE FUNCTIONS
// ============================================================================

/**
 * Start recording with full setup
 * 
 * Creates recorder, attaches handlers, and returns control object.
 * 
 * @param projectId - Project ID to record for
 * @param startUrl - Starting URL
 * @param config - Recording configuration
 * @returns Recording control object
 * 
 * @example
 * ```typescript
 * const recording = startRecording('project-123', window.location.href);
 * 
 * // Listen for steps
 * recording.onStep((step) => {
 *   console.log('Captured:', step.event);
 * });
 * 
 * // Later, stop and get steps
 * const steps = recording.stop();
 * ```
 */
export function startRecording(
  projectId: string,
  startUrl: string,
  config: {
    recorderConfig?: import('./recorder').RecordingConfig;
    handlerConfig?: import('./event-handlers').EventHandlerConfig;
  } = {}
): {
  recorder: import('./recorder').Recorder;
  sessionId: string;
  stop: () => import('../types').Step[];
  pause: () => void;
  resume: () => void;
  isRecording: () => boolean;
  isPaused: () => boolean;
  getStepCount: () => number;
  deleteLastStep: () => import('./recorder').CapturedStep | null;
  onStep: (callback: import('./recorder').RecordingCallback) => () => void;
  onStateChange: (callback: import('./recorder').StateChangeCallback) => () => void;
  destroy: () => void;
} {
  const { Recorder } = require('./recorder');
  const { attachRecordingHandlers } = require('./event-handlers');

  // Create recorder
  const recorder = new Recorder(projectId, config.recorderConfig || {});
  
  // Start recording
  const sessionId = recorder.start(startUrl);
  
  // Attach event handlers
  const detachHandlers = attachRecordingHandlers(recorder, config.handlerConfig || {});

  return {
    recorder,
    sessionId,
    
    stop: () => {
      detachHandlers();
      return recorder.stop();
    },
    
    pause: () => recorder.pause(),
    resume: () => recorder.resume(),
    isRecording: () => recorder.isRecording(),
    isPaused: () => recorder.isPaused(),
    getStepCount: () => recorder.getStepCount(),
    deleteLastStep: () => recorder.deleteLastStep(),
    
    onStep: (callback) => recorder.onStepCaptured(callback),
    onStateChange: (callback) => recorder.onStateChange(callback),
    
    destroy: () => {
      detachHandlers();
      recorder.destroy();
    }
  };
}

/**
 * Stop recording and get steps
 * 
 * Convenience function for stopping a recorder.
 */
export function stopRecording(
  recorder: import('./recorder').Recorder
): import('../types').Step[] {
  return recorder.stop();
}

/**
 * Create recording session for content script
 * 
 * Sets up recording in a content script context with message passing.
 * 
 * @param projectId - Project ID
 * @param sendMessage - Function to send messages to background
 * @returns Recording control object
 */
export function createContentScriptRecording(
  projectId: string,
  sendMessage: (message: unknown) => void
): {
  start: () => string;
  stop: () => import('../types').Step[];
  pause: () => void;
  resume: () => void;
  getState: () => import('./recorder').RecordingState;
  destroy: () => void;
} {
  const { Recorder } = require('./recorder');
  const { attachRecordingHandlers } = require('./event-handlers');

  const recorder = new Recorder(projectId, {
    highlightElements: true,
    highlightDuration: 1000
  });

  let detachHandlers: (() => void) | null = null;

  // Notify on each captured step
  recorder.onStepCaptured((step: import('./recorder').CapturedStep, index: number) => {
    sendMessage({
      action: 'step_captured',
      data: { step, index, projectId }
    });
  });

  // Notify on state changes
  recorder.onStateChange((newState: import('./recorder').RecordingState, oldState: import('./recorder').RecordingState) => {
    sendMessage({
      action: 'recording_state_changed',
      data: { newState, oldState, projectId }
    });
  });

  return {
    start: () => {
      const sessionId = recorder.start(window.location.href);
      detachHandlers = attachRecordingHandlers(recorder, {
        showHighlight: true,
        debugLog: false
      });
      
      sendMessage({
        action: 'recording_started',
        data: { sessionId, projectId, url: window.location.href }
      });
      
      return sessionId;
    },

    stop: () => {
      if (detachHandlers) {
        detachHandlers();
        detachHandlers = null;
      }
      
      const steps = recorder.stop();
      
      sendMessage({
        action: 'recording_stopped',
        data: { steps, projectId }
      });
      
      return steps;
    },

    pause: () => {
      recorder.pause();
    },

    resume: () => {
      recorder.resume();
    },

    getState: () => recorder.getState(),

    destroy: () => {
      if (detachHandlers) {
        detachHandlers();
      }
      recorder.destroy();
    }
  };
}

/**
 * Validate recorded steps
 * 
 * Check that steps have valid bundles and required properties.
 * 
 * @param steps - Steps to validate
 * @returns Validation result
 */
export function validateRecordedSteps(
  steps: import('../types').Step[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stepIssues: Array<{ index: number; issues: string[] }>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stepIssues: Array<{ index: number; issues: string[] }> = [];

  if (steps.length === 0) {
    errors.push('No steps recorded');
    return { valid: false, errors, warnings, stepIssues };
  }

  // First step should be 'open'
  if (steps[0].event !== 'open') {
    errors.push('First step should be "open" event');
  }

  // Check each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const issues: string[] = [];

    // Validate event type
    if (!['open', 'click', 'input', 'enter'].includes(step.event)) {
      issues.push(`Invalid event type: ${step.event}`);
    }

    // Note: Step type uses id field for order (1-indexed), verified above

    // Validate bundle for non-open steps
    if (step.event !== 'open' && step.bundle) {
      if (!step.bundle?.tag) {
        issues.push('Missing element tag in bundle');
      }
      if (!step.bundle?.xpath && !step.bundle?.id && !step.bundle?.css) {
        warnings.push(`Step ${i + 1}: No reliable locator (xpath, id, or css)`);
      }
    }

    // Input steps should have value
    if (step.event === 'input' && step.value === undefined) {
      issues.push('Input step missing value');
    }

    if (issues.length > 0) {
      stepIssues.push({ index: i, issues });
    }
  }

  const hasErrors = errors.length > 0 || stepIssues.some(s => s.issues.length > 0);

  return {
    valid: !hasErrors,
    errors,
    warnings,
    stepIssues
  };
}

/**
 * Merge consecutive input steps on same element
 * 
 * Reduces step count by combining rapid inputs.
 * 
 * @param steps - Steps to merge
 * @returns Merged steps with new order
 */
export function mergeConsecutiveInputs(
  steps: import('../types').Step[]
): import('../types').Step[] {
  if (steps.length === 0) return [];

  const merged: import('../types').Step[] = [];

  for (const step of steps) {
    const last = merged[merged.length - 1];

    // Check if should merge with previous
    if (
      last &&
      last.event === 'input' &&
      step.event === 'input' &&
      last.bundle?.id === step.bundle?.id &&
      last.bundle?.xpath === step.bundle?.xpath
    ) {
      // Update last step's value
      last.value = step.value;
    } else {
      merged.push({ ...step });
    }
  }

  // Reorder
  return merged.map((step, index) => ({
    ...step,
    order: index + 1
  }));
}

/**
 * Get recording statistics
 * 
 * @param steps - Recorded steps
 * @returns Statistics about the recording
 */
export function getRecordingStats(
  steps: import('../types').Step[]
): {
  totalSteps: number;
  clickCount: number;
  inputCount: number;
  enterCount: number;
  openCount: number;
  uniqueElements: number;
  averageBundleQuality: number;
} {
  const { calculateBundleQualityScore } = require('../types');

  const stats = {
    totalSteps: steps.length,
    clickCount: 0,
    inputCount: 0,
    enterCount: 0,
    openCount: 0,
    uniqueElements: 0,
    averageBundleQuality: 0
  };

  const elementIds = new Set<string>();
  let totalQuality = 0;

  for (const step of steps) {
    switch (step.event) {
      case 'click': stats.clickCount++; break;
      case 'input': stats.inputCount++; break;
      case 'enter': stats.enterCount++; break;
      case 'open': stats.openCount++; break;
    }

    // Track unique elements
    const elementKey = step.bundle?.id || step.bundle?.xpath || step.bundle?.css || '';
    if (elementKey) {
      elementIds.add(elementKey);
    }

    // Calculate quality
    totalQuality += calculateBundleQualityScore(step.bundle);
  }

  stats.uniqueElements = elementIds.size;
  stats.averageBundleQuality = steps.length > 0 
    ? Math.round(totalQuality / steps.length)
    : 0;

  return stats;
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * RECORDING LAYER ARCHITECTURE
 * 
 * The recording layer captures user interactions:
 * 
 * 1. Recorder (recorder.ts)
 *    - Core recording engine
 *    - Session management (start/stop/pause/resume)
 *    - Step capture with debouncing
 *    - Callbacks for step/state changes
 * 
 * 2. Event Handlers (event-handlers.ts)
 *    - DOM event listeners (capture phase)
 *    - Click, input, change, keydown handling
 *    - Visual feedback via highlights
 *    - Element filtering
 *    - Iframe support
 * 
 * STEP EVENT TYPES:
 * - 'open': First step, contains URL in value
 * - 'click': Mouse click, no value
 * - 'input': Text input, value contains text
 * - 'enter': Enter key, no value
 * 
 * RECORDING FLOW:
 * 
 * 1. User clicks "Start Recording" in UI
 * 2. Content script creates Recorder and attaches handlers
 * 3. recorder.start() adds 'open' step with current URL
 * 4. User interacts with page:
 *    - Click → captureClick() → CapturedStep with 'click'
 *    - Type → captureInput() (debounced) → CapturedStep with 'input'
 *    - Enter → captureEnter() → CapturedStep with 'enter'
 * 5. Visual highlight shows on each capture
 * 6. User clicks "Stop Recording"
 * 7. recorder.stop() returns finalized Step[] with 1-indexed order
 * 8. Steps saved to Project.steps
 * 
 * CONFIGURATION OPTIONS:
 * 
 * RecordingConfig:
 * - captureClicks: boolean (default: true)
 * - captureInputs: boolean (default: true)
 * - captureEnter: boolean (default: true)
 * - inputDebounce: ms (default: 500)
 * - highlightElements: boolean (default: true)
 * - ignoredSelectors: string[] (elements to skip)
 * 
 * EventHandlerConfig:
 * - useCapture: boolean (default: true)
 * - showHighlight: boolean (default: true)
 * - eventFilter: custom filter function
 * 
 * CRITICAL NOTES:
 * 
 * - Step.event MUST be 'click' | 'input' | 'enter' | 'open'
 * - Step.order is 1-indexed
 * - First step is always 'open' with URL
 * - Input events are debounced to avoid duplicate steps
 * - Elements with [data-sammy-ignore] are skipped
 * - Capture phase ensures events are caught before handlers
 */
