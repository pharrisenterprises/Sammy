/**
 * @fileoverview Project type definitions for Chrome Extension Test Recorder
 * @module core/types/project
 * @version 1.0.0
 * 
 * This module defines the canonical Project interface and related types.
 * All project-related code MUST use these types for consistency.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 1.1 for authoritative specification
 */

import type { Step } from './step';
import type { Field } from './field';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Valid project status values
 * 
 * Lifecycle: draft → testing → complete
 * 
 * @remarks
 * - 'draft': Project is being created/edited, not yet tested
 * - 'testing': Project is actively being tested
 * - 'complete': Project testing is finished
 * 
 * CRITICAL: Only these 3 values are valid. Do NOT use:
 * - 'ready', 'running', 'archived', 'active', 'inactive'
 */
export type ProjectStatus = 'draft' | 'testing' | 'complete';

/**
 * Array of valid project statuses for runtime validation
 */
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'draft',
  'testing', 
  'complete'
] as const;

/**
 * Default status for newly created projects
 */
export const DEFAULT_PROJECT_STATUS: ProjectStatus = 'draft';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Core project entity for test automation recordings
 * 
 * A Project represents a single automation workflow that can be:
 * - Recorded (capturing user interactions as steps)
 * - Configured (mapping CSV fields to input steps)
 * - Executed (replaying steps with variable substitution)
 * 
 * @example
 * ```typescript
 * const project: Project = {
 *   name: 'Login Flow Test',
 *   description: 'Tests the login functionality',
 *   status: 'draft',
 *   target_url: 'https://example.com/login',
 *   created_date: Date.now(),
 *   updated_date: Date.now(),
 *   recorded_steps: [],
 *   parsed_fields: [],
 *   csv_data: []
 * };
 * ```
 */
export interface Project {
  /**
   * Unique identifier (auto-increment primary key)
   * Optional on creation, assigned by database
   */
  id?: number;

  /**
   * Human-readable project name
   * @minLength 1
   * @maxLength 255
   */
  name: string;

  /**
   * Optional description of the project's purpose
   * Can be empty string but not undefined after creation
   */
  description: string;

  /**
   * Current lifecycle status
   * @see ProjectStatus for valid values
   */
  status: ProjectStatus;

  /**
   * Target website URL where recording/replay occurs
   * Must be a valid URL format
   */
  target_url: string;

  /**
   * Unix timestamp (milliseconds) when project was created
   * Set once at creation, never modified
   */
  created_date: number;

  /**
   * Unix timestamp (milliseconds) when project was last modified
   * Updated on any change to project data
   */
  updated_date: number;

  /**
   * Array of recorded user interaction steps
   * Populated during recording, used during replay
   */
  recorded_steps?: Step[];

  /**
   * CSV field-to-step mappings for data-driven testing
   * Populated via FieldMapper UI
   */
  parsed_fields?: Field[];

  /**
   * Imported CSV data rows for data-driven testing
   * Each inner array represents one row of CSV data
   */
  csv_data?: any[];
}

/**
 * Project data required for creation (omits auto-generated fields)
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  target_url: string;
  status?: ProjectStatus;
}

/**
 * Project data for updates (all fields optional except id)
 */
export interface UpdateProjectInput {
  id: number;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  target_url?: string;
  recorded_steps?: Step[];
  parsed_fields?: Field[];
  csv_data?: any[];
}

/**
 * Minimal project info for list displays
 */
export interface ProjectSummary {
  id: number;
  name: string;
  status: ProjectStatus;
  target_url: string;
  step_count: number;
  updated_date: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate ProjectStatus at runtime
 * 
 * @param value - Value to check
 * @returns True if value is a valid ProjectStatus
 * 
 * @example
 * ```typescript
 * const status = getStatusFromAPI();
 * if (isProjectStatus(status)) {
 *   project.status = status; // Type-safe assignment
 * }
 * ```
 */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && 
    PROJECT_STATUSES.includes(value as ProjectStatus);
}

/**
 * Type guard to validate Project object structure
 * 
 * @param value - Value to check
 * @returns True if value conforms to Project interface
 * 
 * @example
 * ```typescript
 * const data = await fetchProject(id);
 * if (isProject(data)) {
 *   console.log(data.name); // Type-safe access
 * }
 * ```
 */
export function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.description !== 'string') return false;
  if (!isProjectStatus(obj.status)) return false;
  if (typeof obj.target_url !== 'string') return false;
  if (typeof obj.created_date !== 'number') return false;
  if (typeof obj.updated_date !== 'number') return false;

  // Optional fields (if present, must be correct type)
  if (obj.id !== undefined && typeof obj.id !== 'number') return false;
  if (obj.recorded_steps !== undefined && !Array.isArray(obj.recorded_steps)) return false;
  if (obj.parsed_fields !== undefined && !Array.isArray(obj.parsed_fields)) return false;
  if (obj.csv_data !== undefined && !Array.isArray(obj.csv_data)) return false;

  return true;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new Project with required fields and sensible defaults
 * 
 * @param input - Minimal required project data
 * @returns Complete Project object ready for database insertion
 * 
 * @example
 * ```typescript
 * const project = createProject({
 *   name: 'My Test',
 *   target_url: 'https://example.com'
 * });
 * // project.status === 'draft'
 * // project.created_date === Date.now()
 * ```
 */
export function createProject(input: CreateProjectInput): Omit<Project, 'id'> {
  const now = Date.now();
  
  return {
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    status: input.status ?? DEFAULT_PROJECT_STATUS,
    target_url: input.target_url.trim(),
    created_date: now,
    updated_date: now,
    recorded_steps: [],
    parsed_fields: [],
    csv_data: []
  };
}

/**
 * Convert a Project to a ProjectSummary for list views
 * 
 * @param project - Full project object
 * @returns Minimal project info for display
 */
export function toProjectSummary(project: Project): ProjectSummary {
  if (project.id === undefined) {
    throw new Error('Cannot convert unsaved project to summary');
  }

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    target_url: project.target_url,
    step_count: project.recorded_steps?.length ?? 0,
    updated_date: project.updated_date
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validation error for project data
 */
export interface ProjectValidationError {
  field: keyof Project | 'general';
  message: string;
}

/**
 * Validate project data before saving
 * 
 * @param project - Project data to validate
 * @returns Array of validation errors (empty if valid)
 * 
 * @example
 * ```typescript
 * const errors = validateProject(project);
 * if (errors.length > 0) {
 *   console.error('Validation failed:', errors);
 * }
 * ```
 */
export function validateProject(
  project: Partial<Project>
): ProjectValidationError[] {
  const errors: ProjectValidationError[] = [];

  // Name validation
  if (!project.name || project.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Project name is required' });
  } else if (project.name.length > 255) {
    errors.push({ field: 'name', message: 'Project name must be 255 characters or less' });
  }

  // Status validation
  if (project.status !== undefined && !isProjectStatus(project.status)) {
    errors.push({ 
      field: 'status', 
      message: `Invalid status. Must be one of: ${PROJECT_STATUSES.join(', ')}` 
    });
  }

  // URL validation
  if (!project.target_url || project.target_url.trim().length === 0) {
    errors.push({ field: 'target_url', message: 'Target URL is required' });
  } else {
    try {
      new URL(project.target_url);
    } catch {
      errors.push({ field: 'target_url', message: 'Invalid URL format' });
    }
  }

  // Timestamp validation
  if (project.created_date !== undefined && 
      (typeof project.created_date !== 'number' || project.created_date <= 0)) {
    errors.push({ field: 'created_date', message: 'Invalid creation timestamp' });
  }

  if (project.updated_date !== undefined && 
      (typeof project.updated_date !== 'number' || project.updated_date <= 0)) {
    errors.push({ field: 'updated_date', message: 'Invalid update timestamp' });
  }

  return errors;
}

/**
 * Check if project data is valid
 * 
 * @param project - Project data to validate
 * @returns True if project is valid
 */
export function isValidProject(project: Partial<Project>): boolean {
  return validateProject(project).length === 0;
}

// ============================================================================
// PHASE 4 RECORDING TYPES
// ============================================================================

/**
 * Recording state for Phase 4 recording controller
 */
export type RecordingState = 
  | 'idle'        // Not recording
  | 'starting'    // Initializing recording
  | 'recording'   // Actively capturing events
  | 'paused'      // Recording paused
  | 'stopping'    // Finalizing recording
  | 'stopped'     // Recording complete
  | 'error';      // Recording error

/**
 * Recording session information
 */
export interface RecordingSession {
  /**
   * Unique session identifier
   */
  id: string;
  
  /**
   * Project ID being recorded
   */
  projectId?: string;
  
  /**
   * Session start timestamp
   */
  startTime: number;
  
  /**
   * Session end timestamp (if ended)
   */
  endTime?: number;
  
  /**
   * Starting URL for recording
   */
  startUrl: string;
  
  /**
   * Current tab ID
   */
  tabId?: number;
  
  /**
   * Current recording state
   */
  state: RecordingState;
  
  /**
   * Recorded steps
   */
  steps: any[];
  
  /**
   * Step count
   */
  stepCount: number;
  
  /**
   * Last activity timestamp
   */
  lastActivityTime: number;
}

/**
 * Recording configuration options
 */
export interface RecordingOptions {
  /**
   * Capture click events
   */
  captureClicks?: boolean;
  
  /**
   * Capture input events
   */
  captureInput?: boolean;
  
  /**
   * Capture navigation events
   */
  captureNavigation?: boolean;
  
  /**
   * Capture scroll events
   */
  captureScrolls?: boolean;
  
  /**
   * Capture hover events
   */
  captureHovers?: boolean;
  
  /**
   * Capture keyboard events
   */
  captureKeyboard?: boolean;
  
  /**
   * Input debounce delay (ms)
   */
  inputDebounceMs?: number;
  
  /**
   * Scroll debounce delay (ms)
   */
  scrollDebounceMs?: number;
  
  /**
   * Hover delay before capture (ms)
   */
  hoverDelayMs?: number;
  
  /**
   * Maximum steps per session
   */
  maxStepsPerSession?: number;
  
  /**
   * Auto-save interval (ms)
   */
  autoSaveIntervalMs?: number;
}
