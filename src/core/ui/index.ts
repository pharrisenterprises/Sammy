/**
 * UI Module - Barrel Export
 * @module core/ui
 * @version 1.0.0
 * 
 * Provides UI component contracts, state management, and helpers
 * for React-based extension pages (Dashboard, Recorder, Mapper, Runner).
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   type DashboardProps,
 *   type RecorderProps,
 *   createUIStateManager,
 *   formatDuration,
 *   STATUS_COLORS,
 * } from '@/core/ui';
 * 
 * // Create state manager
 * const stateManager = createUIStateManager();
 * 
 * // Subscribe to changes
 * stateManager.subscribe((state) => {
 *   console.log('Loading:', state.loading.isLoading);
 * });
 * 
 * // Show toast
 * stateManager.toastSuccess('Project saved!');
 * ```
 * 
 * ## Module Structure
 * - **IUIComponents**: Type definitions and interfaces
 * - **UIStateManager**: Centralized state management
 */

// ============================================================================
// SHARED TYPES (IUIComponents)
// ============================================================================

export type {
  // State types
  LoadingState,
  ErrorState,
  PaginationState,
  SortConfig,
  FilterConfig,
  
  // Log types
  LogLevel,
  LogEntry,
} from './IUIComponents';

// ============================================================================
// DASHBOARD TYPES (IUIComponents)
// ============================================================================

export type {
  ProjectSummary,
  DashboardStats,
  CreateProjectData,
  EditProjectData,
  DashboardProps,
} from './IUIComponents';

// ============================================================================
// RECORDER TYPES (IUIComponents)
// ============================================================================

export type {
  StepDisplayItem,
  RecordingStatus,
  RecorderState,
  StepEditData,
  RecorderProps,
} from './IUIComponents';

// ============================================================================
// FIELD MAPPER TYPES (IUIComponents)
// ============================================================================

export type {
  CSVPreview,
  FieldMappingItem,
  MappingValidation,
  FieldMapperState,
  FieldMapperProps,
} from './IUIComponents';

// ============================================================================
// TEST RUNNER TYPES (IUIComponents)
// ============================================================================

export type {
  TestExecutionStatus,
  StepExecutionStatus,
  StepResult,
  RowResult,
  TestProgress,
  TestRunnerState,
  TestRunnerProps,
} from './IUIComponents';

// ============================================================================
// DIALOG TYPES (IUIComponents)
// ============================================================================

export type {
  ConfirmDialogProps,
  AlertDialogProps,
} from './IUIComponents';

// ============================================================================
// CONSTANTS (IUIComponents)
// ============================================================================

export {
  DEFAULT_PAGE_SIZE,
  DEFAULT_LOG_LIMIT,
  STATUS_COLORS,
  STATUS_LABELS,
  LOG_LEVEL_COLORS,
  LOG_LEVEL_ICONS,
} from './IUIComponents';

// ============================================================================
// HELPER FUNCTIONS (IUIComponents)
// ============================================================================

export {
  // State creation
  createEmptyLoadingState,
  createLoadingState,
  createEmptyErrorState,
  createErrorState,
  createLogEntry,
  createInitialTestProgress,
  createProjectSummary,
  
  // Calculations
  calculateDashboardStats,
  
  // Formatting
  formatDuration,
  formatTimestamp,
  formatRelativeTime,
} from './IUIComponents';

// ============================================================================
// UI STATE MANAGER
// ============================================================================

export {
  // Types
  type Toast,
  type UIState,
  type StateChangeListener,
  type PartialUIState,
  type UIStateManagerConfig,
  type StateSelector,
  
  // Constants
  DEFAULT_STATE_MANAGER_CONFIG,
  
  // State creation
  createInitialUIState,
  
  // Class
  UIStateManager,
  
  // Factory functions
  createUIStateManager,
  createLimitedLogManager,
  createTransientManager,
  
  // Singleton
  getUIStateManager,
  resetUIStateManager,
  
  // Selectors
  selectors,
} from './UIStateManager';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * UI module version
 */
export const UI_VERSION = '1.0.0';

/**
 * UI module defaults
 */
export const UI_DEFAULTS = {
  /** Default page size for pagination */
  PAGE_SIZE: 10,
  
  /** Default log limit */
  LOG_LIMIT: 500,
  
  /** Default toast duration in ms */
  TOAST_DURATION: 5000,
  
  /** Max active toasts */
  MAX_TOASTS: 5,
  
  /** Default animation duration in ms */
  ANIMATION_DURATION: 200,
} as const;

/**
 * Recording status values
 */
export const RECORDING_STATUSES = {
  IDLE: 'idle' as const,
  RECORDING: 'recording' as const,
  PAUSED: 'paused' as const,
  SAVING: 'saving' as const,
};

/**
 * Test execution status values
 */
export const TEST_EXECUTION_STATUSES = {
  IDLE: 'idle' as const,
  PREPARING: 'preparing' as const,
  RUNNING: 'running' as const,
  PAUSED: 'paused' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const,
};

/**
 * Step execution status values
 */
export const STEP_EXECUTION_STATUSES = {
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  PASSED: 'passed' as const,
  FAILED: 'failed' as const,
  SKIPPED: 'skipped' as const,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import type {
  RecordingStatus,
  TestExecutionStatus,
  StepExecutionStatus,
  TestProgress,
} from './IUIComponents';
import { 
  STATUS_COLORS as _STATUS_COLORS, 
  STATUS_LABELS as _STATUS_LABELS,
  LOG_LEVEL_COLORS as _LOG_LEVEL_COLORS,
  LOG_LEVEL_ICONS as _LOG_LEVEL_ICONS,
} from './IUIComponents';
import { resetUIStateManager as _resetUIStateManager } from './UIStateManager';

/**
 * Check if recording is active
 */
export function isRecordingActive(status: RecordingStatus): boolean {
  return status === 'recording';
}

/**
 * Check if recording can be started
 */
export function canStartRecording(status: RecordingStatus): boolean {
  return status === 'idle' || status === 'paused';
}

/**
 * Check if recording can be stopped
 */
export function canStopRecording(status: RecordingStatus): boolean {
  return status === 'recording' || status === 'paused';
}

/**
 * Check if test is running
 */
export function isTestRunning(status: TestExecutionStatus): boolean {
  return status === 'running' || status === 'preparing';
}

/**
 * Check if test is terminal (completed/failed/cancelled)
 */
export function isTestTerminal(status: TestExecutionStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Check if test can be started
 */
export function canStartTest(status: TestExecutionStatus): boolean {
  return status === 'idle' || isTestTerminal(status);
}

/**
 * Check if test can be stopped
 */
export function canStopTest(status: TestExecutionStatus): boolean {
  return status === 'running' || status === 'paused' || status === 'preparing';
}

/**
 * Check if test can be paused
 */
export function canPauseTest(status: TestExecutionStatus): boolean {
  return status === 'running';
}

/**
 * Check if test can be resumed
 */
export function canResumeTest(status: TestExecutionStatus): boolean {
  return status === 'paused';
}

/**
 * Check if step passed
 */
export function isStepPassed(status: StepExecutionStatus): boolean {
  return status === 'passed';
}

/**
 * Check if step failed
 */
export function isStepFailed(status: StepExecutionStatus): boolean {
  return status === 'failed';
}

/**
 * Check if step is pending
 */
export function isStepPending(status: StepExecutionStatus): boolean {
  return status === 'pending';
}

/**
 * Check if step is complete (passed/failed/skipped)
 */
export function isStepComplete(status: StepExecutionStatus): boolean {
  return status === 'passed' || status === 'failed' || status === 'skipped';
}

/**
 * Calculate progress percentage
 */
export function calculateProgressPercentage(progress: TestProgress): number {
  if (progress.totalRows === 0 || progress.totalSteps === 0) {
    return 0;
  }
  
  const totalOperations = progress.totalRows * progress.totalSteps;
  const completedOperations = 
    ((progress.currentRow - 1) * progress.totalSteps) + 
    (progress.stepsPassed + progress.stepsFailed);
  
  return Math.min(100, Math.round((completedOperations / totalOperations) * 100));
}

/**
 * Get status color for a given status
 */
export function getStatusColor(status: string): string {
  return _STATUS_COLORS[status] ?? 'gray';
}

/**
 * Get status label for a given status
 */
export function getStatusLabel(status: string): string {
  return _STATUS_LABELS[status] ?? status;
}

/**
 * Format progress text
 */
export function formatProgressText(progress: TestProgress): string {
  if (progress.totalRows === 0) {
    return 'No data';
  }
  
  if (progress.totalRows === 1) {
    return `Step ${progress.currentStep} of ${progress.totalSteps}`;
  }
  
  return `Row ${progress.currentRow}/${progress.totalRows} - Step ${progress.currentStep}/${progress.totalSteps}`;
}

/**
 * Format pass rate percentage
 */
export function formatPassRate(passed: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((passed / total) * 100)}%`;
}

/**
 * Get log level color
 */
export function getLogLevelColor(level: string): string {
  return _LOG_LEVEL_COLORS[level as keyof typeof _LOG_LEVEL_COLORS] ?? 'gray';
}

/**
 * Get log level icon name
 */
export function getLogLevelIcon(level: string): string {
  return _LOG_LEVEL_ICONS[level as keyof typeof _LOG_LEVEL_ICONS] ?? 'Circle';
}

// ============================================================================
// RESET FUNCTION
// ============================================================================

/**
 * Reset all UI module singletons (for testing)
 */
export function resetAllUISingletons(): void {
  _resetUIStateManager();
}
