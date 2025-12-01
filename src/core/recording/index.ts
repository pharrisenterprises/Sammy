/**
 * Recording System - Central export barrel
 * @module core/recording
 * @version 1.0.0
 * 
 * Provides a unified entry point for the recording layer.
 * 
 * Main Components:
 * - RecordingController: Coordinates recording state and flow
 * - EventCapture: DOM event interception and processing
 * - StepBuilder: Creates RecordedStep objects from events
 * 
 * @example
 * ```typescript
 * import {
 *   RecordingController,
 *   createEventCapture,
 *   createStepBuilder,
 * } from '@/core/recording';
 * 
 * // Create controller
 * const controller = new RecordingController({
 *   onStepRecorded: (step) => console.log('Recorded:', step),
 * });
 * 
 * // Start recording
 * await controller.start({ testCaseName: 'Login Test' });
 * \`\`\`
 */

// ============================================================================
// RECORDING CONTROLLER
// ============================================================================

export {
  // Main class
  RecordingController,
  
  // Factory function
  createRecordingController,
  
  // Constants
  DEFAULT_RECORDING_OPTIONS,
  BUFFER_FLUSH_THRESHOLD,
  MAX_UNDO_HISTORY,
  STATE_TRANSITIONS,
  
  // Types
  type RecordingControllerConfig,
  type RecordingEventType,
  type EventHandler,
  type ControllerStats,
} from './RecordingController';

// ============================================================================
// EVENT CAPTURE
// ============================================================================

export {
  // Main class
  EventCapture,
  
  // Factory function
  createEventCapture,
  
  // Conversion utilities
  capturedEventToStep,
  
  // Constants
  CAPTURABLE_EVENTS,
  IGNORED_ELEMENTS,
  EXTENSION_MARKERS,
  SENSITIVE_INPUT_TYPES,
  DEFAULT_CAPTURE_OPTIONS,
  
  // Types
  type CapturableEvent,
  type EventCaptureOptions,
  type CapturedEvent,
  type ElementInfo,
  type FrameInfo,
  type EventData,
  type ClickEventData,
  type InputEventData,
  type KeyboardEventData,
  type ScrollEventData,
  type FocusEventData,
  type DragEventData,
  type ClipboardEventData,
  type NavigationEventData,
  type EventProcessor,
  type EventFilter,
  type CaptureCallback,
} from './EventCapture';

// ============================================================================
// STEP BUILDER
// ============================================================================

export {
  // Main class
  StepBuilder,
  
  // Factory functions
  createStepBuilder,
  buildStepFromEvent,
  buildClickStep,
  buildInputStep,
  buildNavigationStep,
  buildAssertStep,
  
  // Constants
  DEFAULT_STEP_TIMEOUT,
  MAX_DESCRIPTION_LENGTH,
  MAX_VALUE_LENGTH,
  MERGEABLE_STEP_TYPES,
  MERGE_WINDOW_MS,
  VALIDATION_ERRORS,
  STEP_TEMPLATES,
  
  // Types
  type StepBuilderConfig,
  type LocatorGeneratorInterface,
  type ScreenshotCapturerInterface,
  type StepValidationResult,
  type StepValidationError,
  type StepValidationWarning,
  type StepBuildContext,
  type StepTemplate,
} from './StepBuilder';

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Creates a complete recording system with all components wired together
 * 
 * @param config - Configuration options
 * @returns Configured recording system components
 * 
 * @example
 * \`\`\`typescript
 * const { controller, capture, builder } = createRecordingSystem({
 *   onStepRecorded: (step) => saveStep(step),
 *   captureOptions: { captureScrolls: true },
 * });
 * 
 * await controller.start();
 * \`\`\`
 */
export function createRecordingSystem(config?: {
  /** Recording controller config */
  controllerConfig?: import('./RecordingController').RecordingControllerConfig;
  /** Event capture options */
  captureOptions?: Partial<import('./EventCapture').EventCaptureOptions>;
  /** Step builder config */
  builderConfig?: import('./StepBuilder').StepBuilderConfig;
  /** Callback when step is recorded */
  onStepRecorded?: (step: import('../types/step').RecordedStep) => void;
  /** Callback when state changes */
  onStateChange?: (state: import('../types/project').RecordingState, prevState: import('../types/project').RecordingState) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}): {
  controller: import('./RecordingController').RecordingController;
  capture: import('./EventCapture').EventCapture;
  builder: import('./StepBuilder').StepBuilder;
} {
  const { createStepBuilder } = require('./StepBuilder');
  const { createEventCapture } = require('./EventCapture');
  const { createRecordingController } = require('./RecordingController');
  
  // Create step builder
  const builder = createStepBuilder(config?.builderConfig);
  
  // Create event capture that builds steps
  const capture = createEventCapture({
    options: config?.captureOptions,
    onCapture: (event: import('./EventCapture').CapturedEvent) => {
      const step = builder.fromCapturedEvent(event).build();
      config?.onStepRecorded?.(step);
    },
  });
  
  // Create controller
  const controller = createRecordingController({
    ...config?.controllerConfig,
    onStepRecorded: config?.onStepRecorded,
    onStateChange: config?.onStateChange,
    onError: config?.onError,
  });
  
  return { controller, capture, builder };
}

/**
 * Creates a simple recording controller with sensible defaults
 * 
 * @param onStep - Callback for each recorded step
 * @returns Configured RecordingController
 */
export function createSimpleRecorder(
  onStep: (step: import('../types/step').RecordedStep) => void
): import('./RecordingController').RecordingController {
  const { createRecordingController } = require('./RecordingController');
  return createRecordingController({
    onStepRecorded: onStep,
    options: {
      captureClicks: true,
      captureInput: true,
      captureNavigation: true,
      captureKeyboard: true,
      captureScrolls: false,
      captureHovers: false,
    },
  });
}

// ============================================================================
// RECORDING PRESETS
// ============================================================================

/**
 * Recording option presets for common scenarios
 */
export const RECORDING_PRESETS = {
  /**
   * Minimal recording - only essential interactions
   */
  minimal: {
    captureClicks: true,
    captureInput: true,
    captureNavigation: true,
    captureScrolls: false,
    captureHovers: false,
    captureKeyboard: false,
    inputDebounceMs: 500,
  },
  
  /**
   * Standard recording - balanced coverage
   */
  standard: {
    captureClicks: true,
    captureInput: true,
    captureNavigation: true,
    captureScrolls: false,
    captureHovers: false,
    captureKeyboard: true,
    inputDebounceMs: 300,
  },
  
  /**
   * Comprehensive recording - captures everything
   */
  comprehensive: {
    captureClicks: true,
    captureInput: true,
    captureNavigation: true,
    captureScrolls: true,
    captureHovers: true,
    captureKeyboard: true,
    inputDebounceMs: 200,
    scrollDebounceMs: 300,
    hoverDelayMs: 500,
  },
  
  /**
   * Form-focused recording - optimized for form testing
   */
  formFocused: {
    captureClicks: true,
    captureInput: true,
    captureNavigation: true,
    captureScrolls: false,
    captureHovers: false,
    captureKeyboard: true,
    inputDebounceMs: 100,
  },
  
  /**
   * E2E recording - for end-to-end test scenarios
   */
  e2e: {
    captureClicks: true,
    captureInput: true,
    captureNavigation: true,
    captureScrolls: true,
    captureHovers: false,
    captureKeyboard: true,
    inputDebounceMs: 300,
    scrollDebounceMs: 500,
    maxStepsPerSession: 500,
    autoSaveIntervalMs: 60000,
  },
} as const;

/**
 * Recording preset names
 */
export type RecordingPreset = keyof typeof RECORDING_PRESETS;

/**
 * Creates a recording controller with a preset configuration
 * 
 * @param preset - Preset name
 * @param overrides - Option overrides
 * @returns Configured RecordingController
 */
export function createRecorderWithPreset(
  preset: RecordingPreset,
  overrides?: Partial<import('./RecordingController').RecordingControllerConfig>
): import('./RecordingController').RecordingController {
  const { createRecordingController } = require('./RecordingController');
  return createRecordingController({
    ...overrides,
    options: {
      ...RECORDING_PRESETS[preset],
      ...overrides?.options,
    },
  });
}

// ============================================================================
// CAPTURE PRESETS
// ============================================================================

/**
 * Event capture option presets
 */
export const CAPTURE_PRESETS = {
  /**
   * Basic capture - clicks and inputs only
   */
  basic: {
    captureClicks: true,
    captureDoubleClicks: false,
    captureInput: true,
    captureKeyboard: false,
    captureNavigation: false,
    captureScroll: false,
    captureFocus: false,
    captureDrag: false,
    captureCopyPaste: false,
  },
  
  /**
   * Interactive capture - user interactions
   */
  interactive: {
    captureClicks: true,
    captureDoubleClicks: true,
    captureInput: true,
    captureKeyboard: true,
    captureNavigation: true,
    captureScroll: false,
    captureFocus: true,
    captureDrag: false,
    captureCopyPaste: false,
  },
  
  /**
   * Full capture - all events
   */
  full: {
    captureClicks: true,
    captureDoubleClicks: true,
    captureInput: true,
    captureKeyboard: true,
    captureNavigation: true,
    captureScroll: true,
    captureFocus: true,
    captureDrag: true,
    captureCopyPaste: true,
    captureIframes: true,
    captureShadowDom: true,
  },
} as const;

/**
 * Capture preset names
 */
export type CapturePreset = keyof typeof CAPTURE_PRESETS;

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Re-export recording types from types module
 */
export type {
  RecordingState,
  RecordingSession,
  RecordingOptions,
} from '../types/project';

/**
 * Re-export step types from types module
 */
export type {
  RecordedStep,
  StepType,
  StepTarget,
  StepMetadata,
} from '../types/step';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if an element should be recorded
 * 
 * @param element - Element to check
 * @returns Whether element is recordable
 */
export function isRecordableElement(element: Element): boolean {
  const { IGNORED_ELEMENTS, EXTENSION_MARKERS } = require('./EventCapture');
  const tagName = element.tagName.toLowerCase();
  
  // Skip ignored elements
  if (IGNORED_ELEMENTS.includes(tagName as typeof IGNORED_ELEMENTS[number])) {
    return false;
  }
  
  // Skip extension UI
  for (const marker of EXTENSION_MARKERS) {
    if (element.hasAttribute(marker) || element.closest(`[${marker}]`)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Sanitizes sensitive input value
 * 
 * @param element - Input element
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
export function sanitizeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): string {
  const { SENSITIVE_INPUT_TYPES } = require('./EventCapture');
  const type = element.getAttribute('type')?.toLowerCase() ?? '';
  const autocomplete = element.getAttribute('autocomplete')?.toLowerCase() ?? '';
  const name = element.getAttribute('name')?.toLowerCase() ?? '';
  
  // Check if sensitive
  const isSensitive =
    SENSITIVE_INPUT_TYPES.includes(type as typeof SENSITIVE_INPUT_TYPES[number]) ||
    autocomplete.includes('password') ||
    autocomplete.includes('cc-') ||
    name.includes('password') ||
    name.includes('secret') ||
    name.includes('token');
  
  return isSensitive ? '********' : value;
}

/**
 * Generates a human-readable step summary
 * 
 * @param step - Recorded step
 * @returns Human-readable summary
 */
export function getStepSummary(step: import('../types/step').RecordedStep): string {
  const target = step.target;
  
  if (!target) {
    return `${step.type} action`;
  }
  
  // Get element identifier
  let elementId = target.tagName;
  if (target.id) {
    elementId = `#${target.id}`;
  } else if (target.name) {
    elementId = `[name="${target.name}"]`;
  } else if (target.textContent) {
    const text = target.textContent.slice(0, 20);
    elementId = `"${text}${target.textContent.length > 20 ? '...' : ''}"`;
  }
  
  switch (step.type) {
    case 'click':
      return `Click ${elementId}`;
    case 'dblclick':
      return `Double-click ${elementId}`;
    case 'input':
      return `Type in ${elementId}`;
    case 'keypress':
      return `Press ${step.value ?? 'key'}`;
    case 'select':
      return `Select in ${elementId}`;
    case 'scroll':
      return `Scroll`;
    case 'navigate':
      return `Navigate to ${step.value ?? 'page'}`;
    case 'wait':
      return `Wait for ${elementId}`;
    case 'assert':
      return `Assert ${elementId}`;
    default:
      return `${step.type} on ${elementId}`;
  }
}

/**
 * Groups steps by page URL
 * 
 * @param steps - Array of recorded steps
 * @returns Steps grouped by page URL
 */
export function groupStepsByPage(
  steps: import('../types/step').RecordedStep[]
): Map<string, import('../types/step').RecordedStep[]> {
  const groups = new Map<string, import('../types/step').RecordedStep[]>();
  
  for (const step of steps) {
    const url = step.metadata?.pageUrl ?? 'unknown';
    
    if (!groups.has(url)) {
      groups.set(url, []);
    }
    
    groups.get(url)!.push(step);
  }
  
  return groups;
}

/**
 * Calculates recording duration
 * 
 * @param session - Recording session
 * @returns Duration in milliseconds
 */
export function getRecordingDuration(
  session: import('../types/project').RecordingSession
): number {
  const endTime = session.endTime ?? Date.now();
  return endTime - session.startTime;
}

/**
 * Formats recording duration as human-readable string
 * 
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  
  return `${seconds}s`;
}
