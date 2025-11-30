/**
 * @fileoverview Barrel export for all core type definitions
 * @module core/types
 * @version 1.0.0
 * 
 * This module re-exports all type definitions for convenient importing.
 * 
 * @example
 * ```typescript
 * // Import types
 * import { Project, Step, Field, TestRun, LocatorBundle } from '@/core/types';
 * 
 * // Import type guards
 * import { isProject, isStep, isField, isTestRun, isLocatorBundle } from '@/core/types';
 * 
 * // Import factory functions
 * import { createProject, createStep, createField, createTestRun, createBundle } from '@/core/types';
 * 
 * // Import constants
 * import { PROJECT_STATUSES, STEP_EVENTS, AUTO_MAP_THRESHOLD, LOCATOR_TIERS } from '@/core/types';
 * ```
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 1 for type specifications
 */

// ============================================================================
// PROJECT TYPES
// ============================================================================

export {
  // Types
  type Project,
  type ProjectStatus,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectSummary,
  type ProjectValidationError,
  
  // Constants
  PROJECT_STATUSES,
  DEFAULT_PROJECT_STATUS,
  
  // Type Guards
  isProjectStatus,
  isProject,
  
  // Factory Functions
  createProject,
  toProjectSummary,
  
  // Validation
  validateProject,
  isValidProject
} from './project';

// ============================================================================
// STEP TYPES
// ============================================================================

export {
  // Types
  type Step,
  type StepEvent,
  type StepWithBundle,
  type CreateStepInput,
  type UpdateStepInput,
  type StepExecutionResult,
  type StepDisplayInfo,
  type StepValidationError,
  
  // Constants
  STEP_EVENTS,
  STEP_EVENT_LABELS,
  STEP_EVENT_ICONS,
  
  // Type Guards
  isStepEvent,
  isStep,
  hasBundle,
  isInputStep,
  isNavigationStep,
  
  // Factory Functions
  generateStepId,
  generateStepName,
  createStep,
  toStepDisplayInfo,
  
  // Utility Functions
  cloneStep,
  getMappableSteps,
  getStepById,
  updateStepInArray,
  removeStepFromArray,
  reorderSteps,
  
  // Validation
  validateStep,
  isValidStep
} from './step';

// ============================================================================
// FIELD TYPES
// ============================================================================

export {
  // Types
  type Field,
  type MappedField,
  type UnmappedField,
  type CreateFieldInput,
  type UpdateFieldInput,
  type AutoMapResult,
  type FieldMappingStats,
  type FieldDisplayInfo,
  type FieldValidationError,
  
  // Constants
  AUTO_MAP_THRESHOLD,
  MIN_FIELD_NAME_LENGTH,
  MAX_FIELD_NAME_LENGTH,
  
  // Type Guards
  isField,
  isMappedField,
  isUnmappedField,
  
  // Factory Functions
  createUnmappedField,
  createMappedField,
  createField,
  createFieldsFromHeaders,
  
  // Mapping Functions
  mapField,
  unmapField,
  toggleFieldMapping,
  updateFieldInArray,
  
  // Query Functions
  getMappedFields,
  getUnmappedFields,
  getFieldByName,
  getFieldByTarget,
  isTargetMapped,
  getAvailableTargets,
  
  // Statistics
  getFieldMappingStats,
  
  // Validation
  validateField,
  isValidField,
  validateFieldArray,
  
  // Serialization
  fieldToExportFormat,
  createFieldLookupMap,
  createReverseFieldLookupMap
} from './field';

// ============================================================================
// TEST RUN TYPES
// ============================================================================

export {
  // Types
  type TestRun,
  type TestRunStatus,
  type CreateTestRunInput,
  type UpdateTestRunInput,
  type TestRunSummary,
  type TestRunProgress,
  type TestRunStats,
  type TestRunValidationError,
  type LogLevel,
  
  // Constants
  TEST_RUN_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  DEFAULT_TEST_RUN_STATUS,
  LOG_LEVELS,
  
  // Type Guards
  isTestRunStatus,
  isTestRun,
  isTerminalStatus,
  isActiveStatus,
  isPassed,
  isFailed,
  
  // Factory Functions
  generateTestRunId,
  createTestRun,
  toTestRunSummary,
  getTestRunProgress,
  
  // Log Functions
  formatLogTimestamp,
  createLogEntry,
  appendLog,
  appendLogs,
  parseLogLines,
  getLastLogLines,
  countLogsByLevel,
  
  // Status Transitions
  startTestRun,
  passTestRun,
  failTestRun,
  stopTestRun,
  recordStepResult,
  
  // Statistics
  calculateTestRunStats,
  formatDuration,
  
  // Validation
  validateTestRun,
  isValidTestRun
} from './test-run';

// ============================================================================
// LOCATOR BUNDLE TYPES
// ============================================================================

export {
  // Types
  type LocatorBundle,
  type PartialLocatorBundle,
  type MinimalLocatorBundle,
  type BoundingBox,
  type LocatorResult,
  type LocatorStats,
  type LocatorTier,
  type LocatorBundleValidationError,
  
  // Constants
  LOCATOR_TIERS,
  ELEMENT_TIMEOUT_MS,
  RETRY_INTERVAL_MS,
  BOUNDING_BOX_RADIUS_PX,
  FUZZY_TEXT_THRESHOLD,
  
  // Type Guards
  isBoundingBox,
  isLocatorBundle,
  hasXPath,
  hasId,
  hasName,
  hasAria,
  hasPlaceholder,
  hasDataAttrs,
  hasText,
  hasBounding,
  isInIframe,
  isInShadowDom,
  
  // Factory Functions
  createEmptyBundle,
  createBundle,
  createBoundingBox,
  createBoundingBoxFromClick,
  createMinimalBundle,
  
  // Strategy Functions
  getAvailableStrategies,
  getBestStrategy,
  countAvailableStrategies,
  calculateBundleQuality,
  
  // Utility Functions
  mergeBundle,
  cloneBundle,
  extractCssSelector,
  bundleMatchesElement,
  getBoundingCenter,
  isPointInBounding,
  
  // Validation
  validateBundle,
  isValidBundle
} from './locator-bundle';

// ============================================================================
// CONVENIENCE RE-EXPORTS (Type Aliases for Common Patterns)
// ============================================================================

import type { Project, ProjectStatus, ProjectValidationError } from './project';
import type { StepValidationError } from './step';
import type { FieldValidationError } from './field';
import type { TestRun, TestRunStatus, TestRunValidationError } from './test-run';
import type { LocatorBundleValidationError } from './locator-bundle';

/**
 * All entity types that can be stored in IndexedDB
 */
export type StorableEntity = Project | TestRun;

/**
 * All status types used across the application
 */
export type AnyStatus = ProjectStatus | TestRunStatus;

/**
 * Union of all validation error types
 */
export type AnyValidationError = 
  | ProjectValidationError 
  | StepValidationError 
  | FieldValidationError 
  | TestRunValidationError 
  | LocatorBundleValidationError;

/**
 * Common ID types
 */
export type ProjectId = number;
export type StepId = string;
export type TestRunId = string;
export type FieldName = string;
