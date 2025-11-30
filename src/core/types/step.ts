/**
 * @fileoverview Step type definitions for Chrome Extension Test Recorder
 * @module core/types/step
 * @version 1.0.0
 * 
 * This module defines the canonical Step interface and related types.
 * Steps represent individual recorded user interactions.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 1.2 for authoritative specification
 */

import type { LocatorBundle } from './locator-bundle';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Valid step event types
 * 
 * CRITICAL: Only these 4 event types are supported.
 * 
 * @remarks
 * - 'click': Mouse click on element
 * - 'input': Text input into field
 * - 'enter': Enter/Return key press
 * - 'open': Navigate to URL (initial page load)
 * 
 * DO NOT use: 'submit', 'change', 'keydown', 'keyup', 'focus', 'blur', 'navigate'
 */
export type StepEvent = 'click' | 'input' | 'enter' | 'open';

/**
 * Array of valid step events for runtime validation
 */
export const STEP_EVENTS: readonly StepEvent[] = [
  'click',
  'input',
  'enter',
  'open'
] as const;

/**
 * Human-readable labels for step events
 */
export const STEP_EVENT_LABELS: Record<StepEvent, string> = {
  click: 'Click',
  input: 'Type Text',
  enter: 'Press Enter',
  open: 'Open URL'
} as const;

/**
 * Icons for step events (for UI display)
 */
export const STEP_EVENT_ICONS: Record<StepEvent, string> = {
  click: '🖱️',
  input: '⌨️',
  enter: '↵',
  open: '🌐'
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Single recorded user interaction step
 * 
 * A Step captures everything needed to replay a user action:
 * - What type of action (click, input, etc.)
 * - Where the action occurred (XPath, coordinates, locator bundle)
 * - What value was entered (for input events)
 * - Human-readable label for display
 * 
 * @example
 * ```typescript
 * const step: Step = {
 *   id: 'uuid-1234',
 *   name: 'Enter username',
 *   event: 'input',
 *   path: '/html/body/form/input[1]',
 *   value: 'testuser',
 *   label: 'Username',
 *   x: 150,
 *   y: 200,
 *   bundle: { ... }
 * };
 * ```
 */
export interface Step {
  /**
   * Unique step identifier (UUID format)
   * Generated during recording
   */
  id: string;

  /**
   * Human-readable step name/description
   * Auto-generated from event type and label
   */
  name: string;

  /**
   * Type of user interaction
   * @see StepEvent for valid values
   */
  event: StepEvent;

  /**
   * XPath to target element
   * REQUIRED - Primary locator strategy
   */
  path: string;

  /**
   * Input value for 'input' events
   * Empty string for non-input events
   */
  value: string;

  /**
   * Detected field label (from associated <label> or placeholder)
   * Used for CSV field mapping and display
   */
  label: string;

  /**
   * Click X coordinate relative to viewport
   * REQUIRED - Used for bounding box fallback (tier 8)
   */
  x: number;

  /**
   * Click Y coordinate relative to viewport
   * REQUIRED - Used for bounding box fallback (tier 8)
   */
  y: number;

  /**
   * Multi-strategy locator bundle
   * REQUIRED for reliable replay with 9-tier fallback
   */
  bundle?: LocatorBundle;
}

/**
 * Step with required bundle (for replay operations)
 */
export interface StepWithBundle extends Step {
  bundle: LocatorBundle;
}

/**
 * Minimal step data for creation during recording
 */
export interface CreateStepInput {
  event: StepEvent;
  path: string;
  value?: string;
  label?: string;
  x: number;
  y: number;
  bundle?: LocatorBundle;
}

/**
 * Step update data (all fields optional except id)
 */
export interface UpdateStepInput {
  id: string;
  name?: string;
  event?: StepEvent;
  path?: string;
  value?: string;
  label?: string;
  x?: number;
  y?: number;
  bundle?: LocatorBundle;
}

/**
 * Step execution result during replay
 */
export interface StepExecutionResult {
  step_id: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  strategy_used?: string;
  confidence?: number;
}

/**
 * Step display info for UI
 */
export interface StepDisplayInfo {
  id: string;
  index: number;
  name: string;
  event: StepEvent;
  eventLabel: string;
  eventIcon: string;
  label: string;
  hasBundle: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate StepEvent at runtime
 * 
 * @param value - Value to check
 * @returns True if value is a valid StepEvent
 * 
 * @example
 * ```typescript
 * if (isStepEvent(eventFromAPI)) {
 *   step.event = eventFromAPI; // Type-safe
 * }
 * ```
 */
export function isStepEvent(value: unknown): value is StepEvent {
  return typeof value === 'string' && 
    STEP_EVENTS.includes(value as StepEvent);
}

/**
 * Type guard to validate Step object structure
 * 
 * @param value - Value to check
 * @returns True if value conforms to Step interface
 */
export function isStep(value: unknown): value is Step {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.id !== 'string' || obj.id.length === 0) return false;
  if (typeof obj.name !== 'string') return false;
  if (!isStepEvent(obj.event)) return false;
  if (typeof obj.path !== 'string') return false;
  if (typeof obj.value !== 'string') return false;
  if (typeof obj.label !== 'string') return false;
  if (typeof obj.x !== 'number') return false;
  if (typeof obj.y !== 'number') return false;

  // Optional bundle (if present, must be object)
  if (obj.bundle !== undefined && (typeof obj.bundle !== 'object' || obj.bundle === null)) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if step has a bundle
 * 
 * @param step - Step to check
 * @returns True if step has a valid bundle
 */
export function hasBundle(step: Step): step is StepWithBundle {
  return step.bundle !== undefined && 
    typeof step.bundle === 'object' && 
    step.bundle !== null;
}

/**
 * Type guard to check if step is an input step
 * 
 * @param step - Step to check
 * @returns True if step is an input event
 */
export function isInputStep(step: Step): boolean {
  return step.event === 'input';
}

/**
 * Type guard to check if step is a navigation step
 * 
 * @param step - Step to check
 * @returns True if step is an open event
 */
export function isNavigationStep(step: Step): boolean {
  return step.event === 'open';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Generate a unique step ID
 * Uses crypto.randomUUID() if available, falls back to timestamp-based ID
 */
export function generateStepId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a human-readable step name from event and label
 * 
 * @param event - Step event type
 * @param label - Field label (optional)
 * @param value - Input value (optional, for input events)
 * @returns Human-readable step name
 */
export function generateStepName(
  event: StepEvent, 
  label?: string, 
  value?: string
): string {
  const eventLabel = STEP_EVENT_LABELS[event];
  
  if (label && label.trim().length > 0) {
    if (event === 'input' && value) {
      const truncatedValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
      return `${eventLabel} "${truncatedValue}" in ${label}`;
    }
    return `${eventLabel} ${label}`;
  }
  
  if (event === 'open' && value) {
    try {
      const url = new URL(value);
      return `${eventLabel} ${url.hostname}`;
    } catch {
      return `${eventLabel} page`;
    }
  }
  
  return eventLabel;
}

/**
 * Create a new Step with required fields and sensible defaults
 * 
 * @param input - Minimal required step data
 * @returns Complete Step object
 * 
 * @example
 * ```typescript
 * const step = createStep({
 *   event: 'click',
 *   path: '/html/body/button',
 *   x: 100,
 *   y: 200
 * });
 * ```
 */
export function createStep(input: CreateStepInput): Step {
  const id = generateStepId();
  const label = input.label?.trim() ?? '';
  const value = input.value?.trim() ?? '';
  const name = generateStepName(input.event, label, value);

  return {
    id,
    name,
    event: input.event,
    path: input.path,
    value,
    label,
    x: input.x,
    y: input.y,
    bundle: input.bundle
  };
}

/**
 * Convert Step to display info for UI
 * 
 * @param step - Step to convert
 * @param index - Step index in array (0-based)
 * @returns Display info object
 */
export function toStepDisplayInfo(step: Step, index: number): StepDisplayInfo {
  return {
    id: step.id,
    index,
    name: step.name,
    event: step.event,
    eventLabel: STEP_EVENT_LABELS[step.event],
    eventIcon: STEP_EVENT_ICONS[step.event],
    label: step.label,
    hasBundle: hasBundle(step)
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validation error for step data
 */
export interface StepValidationError {
  field: keyof Step | 'general';
  message: string;
}

/**
 * Validate step data
 * 
 * @param step - Step data to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateStep(step: Partial<Step>): StepValidationError[] {
  const errors: StepValidationError[] = [];

  // ID validation
  if (!step.id || step.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Step ID is required' });
  }

  // Event validation
  if (!step.event) {
    errors.push({ field: 'event', message: 'Event type is required' });
  } else if (!isStepEvent(step.event)) {
    errors.push({ 
      field: 'event', 
      message: `Invalid event type. Must be one of: ${STEP_EVENTS.join(', ')}` 
    });
  }

  // Path validation (required for all events except 'open')
  if (step.event !== 'open') {
    if (!step.path || step.path.trim().length === 0) {
      errors.push({ field: 'path', message: 'XPath is required for this event type' });
    }
  }

  // Coordinates validation
  if (typeof step.x !== 'number' || isNaN(step.x)) {
    errors.push({ field: 'x', message: 'X coordinate must be a valid number' });
  }
  if (typeof step.y !== 'number' || isNaN(step.y)) {
    errors.push({ field: 'y', message: 'Y coordinate must be a valid number' });
  }

  // Value validation for input events
  if (step.event === 'input' && (step.value === undefined || step.value === null)) {
    errors.push({ field: 'value', message: 'Value is required for input events' });
  }

  return errors;
}

/**
 * Check if step data is valid
 * 
 * @param step - Step data to validate
 * @returns True if step is valid
 */
export function isValidStep(step: Partial<Step>): boolean {
  return validateStep(step).length === 0;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clone a step with optional overrides
 * 
 * @param step - Step to clone
 * @param overrides - Optional field overrides
 * @returns New step with cloned/overridden values
 */
export function cloneStep(step: Step, overrides?: Partial<Step>): Step {
  return {
    ...step,
    ...overrides,
    id: overrides?.id ?? generateStepId(), // Always generate new ID unless explicitly provided
    bundle: step.bundle ? { ...step.bundle } : undefined
  };
}

/**
 * Find input steps that can be mapped to CSV fields
 * 
 * @param steps - Array of steps to filter
 * @returns Array of input steps with labels
 */
export function getMappableSteps(steps: Step[]): Step[] {
  return steps.filter(step => 
    step.event === 'input' && 
    step.label && 
    step.label.trim().length > 0
  );
}

/**
 * Get step by ID from array
 * 
 * @param steps - Array of steps
 * @param id - Step ID to find
 * @returns Step if found, undefined otherwise
 */
export function getStepById(steps: Step[], id: string): Step | undefined {
  return steps.find(step => step.id === id);
}

/**
 * Update a step in array immutably
 * 
 * @param steps - Original steps array
 * @param id - ID of step to update
 * @param updates - Fields to update
 * @returns New array with updated step
 */
export function updateStepInArray(
  steps: Step[], 
  id: string, 
  updates: Partial<Omit<Step, 'id'>>
): Step[] {
  return steps.map(step => 
    step.id === id ? { ...step, ...updates } : step
  );
}

/**
 * Remove a step from array immutably
 * 
 * @param steps - Original steps array
 * @param id - ID of step to remove
 * @returns New array without the specified step
 */
export function removeStepFromArray(steps: Step[], id: string): Step[] {
  return steps.filter(step => step.id !== id);
}

/**
 * Reorder steps in array immutably
 * 
 * @param steps - Original steps array
 * @param fromIndex - Current index of step
 * @param toIndex - Target index for step
 * @returns New array with reordered steps
 */
export function reorderSteps(
  steps: Step[], 
  fromIndex: number, 
  toIndex: number
): Step[] {
  if (fromIndex < 0 || fromIndex >= steps.length) return steps;
  if (toIndex < 0 || toIndex >= steps.length) return steps;
  if (fromIndex === toIndex) return steps;

  const result = [...steps];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
