/**
 * IUIComponents - UI Component Interface Definitions
 * @module core/ui/IUIComponents
 * @version 1.0.0
 * 
 * Defines contracts for React UI components including Dashboard,
 * Recorder, Field Mapper, and Test Runner pages.
 * 
 * ## Component Architecture
 * 
 * ### Dashboard
 * - Project list with search/filter
 * - CRUD operations for projects
 * - Quick navigation to other pages
 * 
 * ### Recorder
 * - Live step capture display
 * - Drag-and-drop step reordering
 * - Real-time log panel
 * 
 * ### Field Mapper
 * - CSV upload and parsing
 * - Auto-mapping with fuzzy matching
 * - Manual field-to-step mapping
 * 
 * ### Test Runner
 * - Multi-row CSV execution
 * - Live progress tracking
 * - Console and results display
 * 
 * @example
 * ```typescript
 * // Dashboard props
 * const dashboardProps: DashboardProps = {
 *   projects: [],
 *   onCreateProject: (data) => {},
 *   onDeleteProject: (id) => {},
 * };
 * ```
 */

import type { Project, ProjectStatus } from '../types/Project';
import type { Step } from '../types/Step';
import type { TestRun, TestRunStatus } from '../types/TestRun';
import type { ParsedField } from '../types/ParsedField';
import type { FieldMapping } from '../csv/ICSVParser';

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Loading state for async operations
 */
export interface LoadingState {
  /** Whether loading */
  isLoading: boolean;
  
  /** Loading message */
  message?: string;
  
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Error state for error display
 */
export interface ErrorState {
  /** Whether there's an error */
  hasError: boolean;
  
  /** Error message */
  message?: string;
  
  /** Error code */
  code?: string;
  
  /** Whether error is recoverable */
  recoverable?: boolean;
}

/**
 * Pagination state
 */
export interface PaginationState {
  /** Current page (1-indexed) */
  page: number;
  
  /** Items per page */
  pageSize: number;
  
  /** Total items */
  totalItems: number;
  
  /** Total pages */
  totalPages: number;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  /** Field to sort by */
  field: string;
  
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Search query */
  search?: string;
  
  /** Status filter */
  status?: string[];
  
  /** Date range */
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

// ============================================================================
// LOG TYPES
// ============================================================================

/**
 * Log entry level
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Log entry
 */
export interface LogEntry {
  /** Unique ID */
  id: string;
  
  /** Timestamp */
  timestamp: number;
  
  /** Log level */
  level: LogLevel;
  
  /** Log message */
  message: string;
  
  /** Additional data */
  data?: unknown;
  
  /** Source component */
  source?: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

/**
 * Project summary for dashboard display
 */
export interface ProjectSummary {
  /** Project ID */
  id: number;
  
  /** Project name */
  name: string;
  
  /** Project description */
  description?: string;
  
  /** Project status */
  status: ProjectStatus;
  
  /** Target URL */
  targetUrl: string;
  
  /** Number of recorded steps */
  stepCount: number;
  
  /** Created date */
  createdAt: number;
  
  /** Last updated date */
  updatedAt: number;
  
  /** Last test run status */
  lastTestStatus?: TestRunStatus;
  
  /** Last test run date */
  lastTestDate?: number;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  /** Total projects count */
  totalProjects: number;
  
  /** Active tests count */
  activeTests: number;
  
  /** Completed tests count */
  completedTests: number;
  
  /** Overall success rate (0-100) */
  successRate: number;
  
  /** Projects by status */
  projectsByStatus: Record<ProjectStatus, number>;
}

/**
 * Create project form data
 */
export interface CreateProjectData {
  /** Project name */
  name: string;
  
  /** Project description */
  description?: string;
  
  /** Target URL */
  targetUrl: string;
}

/**
 * Edit project form data
 */
export interface EditProjectData extends CreateProjectData {
  /** Project ID */
  id: number;
}

/**
 * Dashboard props
 */
export interface DashboardProps {
  /** Projects to display */
  projects: ProjectSummary[];
  
  /** Dashboard statistics */
  stats?: DashboardStats;
  
  /** Loading state */
  loading?: LoadingState;
  
  /** Error state */
  error?: ErrorState;
  
  /** Filter configuration */
  filter?: FilterConfig;
  
  /** Sort configuration */
  sort?: SortConfig;
  
  /** Pagination state */
  pagination?: PaginationState;
  
  // Callbacks
  
  /** Create new project */
  onCreateProject?: (data: CreateProjectData) => Promise<void>;
  
  /** Edit project */
  onEditProject?: (data: EditProjectData) => Promise<void>;
  
  /** Delete project */
  onDeleteProject?: (id: number) => Promise<void>;
  
  /** Duplicate project */
  onDuplicateProject?: (id: number) => Promise<void>;
  
  /** Navigate to recorder */
  onOpenRecorder?: (projectId: number) => void;
  
  /** Navigate to field mapper */
  onOpenMapper?: (projectId: number) => void;
  
  /** Navigate to test runner */
  onOpenRunner?: (projectId: number) => void;
  
  /** Filter change */
  onFilterChange?: (filter: FilterConfig) => void;
  
  /** Sort change */
  onSortChange?: (sort: SortConfig) => void;
  
  /** Page change */
  onPageChange?: (page: number) => void;
  
  /** Refresh projects */
  onRefresh?: () => void;
}

// ============================================================================
// RECORDER TYPES
// ============================================================================

/**
 * Step display item for recorder
 */
export interface StepDisplayItem {
  /** Step index */
  index: number;
  
  /** Step data */
  step: Step;
  
  /** Whether step is selected */
  selected?: boolean;
  
  /** Whether step is being edited */
  editing?: boolean;
  
  /** Validation errors */
  errors?: string[];
}

/**
 * Recording status
 */
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'saving';

/**
 * Recorder state
 */
export interface RecorderState {
  /** Current recording status */
  status: RecordingStatus;
  
  /** Current project */
  project: Project | null;
  
  /** Recorded steps */
  steps: Step[];
  
  /** Log entries */
  logs: LogEntry[];
  
  /** Selected step indices */
  selectedSteps: number[];
  
  /** Has unsaved changes */
  hasChanges: boolean;
}

/**
 * Step edit data
 */
export interface StepEditData {
  /** Step index */
  index: number;
  
  /** Updated label */
  label?: string;
  
  /** Updated event type */
  event?: Step['event'];
  
  /** Updated value */
  value?: string;
  
  /** Updated path */
  path?: string;
}

/**
 * Recorder props
 */
export interface RecorderProps {
  /** Current project */
  project: Project | null;
  
  /** Recorded steps */
  steps: Step[];
  
  /** Recording status */
  status: RecordingStatus;
  
  /** Log entries */
  logs: LogEntry[];
  
  /** Loading state */
  loading?: LoadingState;
  
  /** Error state */
  error?: ErrorState;
  
  /** Has unsaved changes */
  hasChanges?: boolean;
  
  // Callbacks
  
  /** Start recording */
  onStartRecording?: () => void;
  
  /** Stop recording */
  onStopRecording?: () => void;
  
  /** Pause recording */
  onPauseRecording?: () => void;
  
  /** Resume recording */
  onResumeRecording?: () => void;
  
  /** Save steps */
  onSaveSteps?: () => Promise<void>;
  
  /** Add manual step */
  onAddStep?: (step: Partial<Step>) => void;
  
  /** Edit step */
  onEditStep?: (data: StepEditData) => void;
  
  /** Delete step */
  onDeleteStep?: (index: number) => void;
  
  /** Delete multiple steps */
  onDeleteSteps?: (indices: number[]) => void;
  
  /** Reorder steps (drag-and-drop) */
  onReorderSteps?: (fromIndex: number, toIndex: number) => void;
  
  /** Select step */
  onSelectStep?: (index: number, selected: boolean) => void;
  
  /** Select all steps */
  onSelectAllSteps?: (selected: boolean) => void;
  
  /** Clear logs */
  onClearLogs?: () => void;
  
  /** Export steps */
  onExportSteps?: (format: 'json' | 'csv' | 'excel') => void;
  
  /** Navigate back */
  onBack?: () => void;
}

// ============================================================================
// FIELD MAPPER TYPES
// ============================================================================

/**
 * CSV preview data
 */
export interface CSVPreview {
  /** Column headers */
  headers: string[];
  
  /** Preview rows (first N rows) */
  rows: Record<string, string>[];
  
  /** Total row count */
  totalRows: number;
  
  /** File name */
  fileName?: string;
}

/**
 * Field mapping display item
 */
export interface FieldMappingItem {
  /** CSV column name */
  csvColumn: string;
  
  /** Mapped step label (null if unmapped) */
  stepLabel: string | null;
  
  /** Step index (undefined if unmapped) */
  stepIndex?: number;
  
  /** Whether mapped */
  mapped: boolean;
  
  /** Auto-mapping confidence (0-1) */
  confidence?: number;
  
  /** Preview value from first row */
  previewValue?: string;
  
  /** Available step options for dropdown */
  availableSteps?: Array<{ label: string; index: number }>;
}

/**
 * Mapping validation result
 */
export interface MappingValidation {
  /** Whether mapping is valid */
  valid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Validation warnings */
  warnings: string[];
  
  /** Mapped count */
  mappedCount: number;
  
  /** Unmapped count */
  unmappedCount: number;
}

/**
 * Field mapper state
 */
export interface FieldMapperState {
  /** Current project */
  project: Project | null;
  
  /** CSV preview data */
  csvPreview: CSVPreview | null;
  
  /** Field mappings */
  mappings: FieldMappingItem[];
  
  /** Validation result */
  validation: MappingValidation | null;
  
  /** Has unsaved changes */
  hasChanges: boolean;
}

/**
 * Field mapper props
 */
export interface FieldMapperProps {
  /** Current project */
  project: Project | null;
  
  /** Recorded steps */
  steps: Step[];
  
  /** CSV preview data */
  csvPreview: CSVPreview | null;
  
  /** Field mappings */
  mappings: FieldMappingItem[];
  
  /** Validation result */
  validation?: MappingValidation;
  
  /** Loading state */
  loading?: LoadingState;
  
  /** Error state */
  error?: ErrorState;
  
  /** Has unsaved changes */
  hasChanges?: boolean;
  
  // Callbacks
  
  /** Upload CSV file */
  onUploadCSV?: (file: File) => Promise<void>;
  
  /** Remove CSV */
  onRemoveCSV?: () => void;
  
  /** Auto-map fields */
  onAutoMap?: () => void;
  
  /** Update single mapping */
  onUpdateMapping?: (csvColumn: string, stepIndex: number | null) => void;
  
  /** Clear all mappings */
  onClearMappings?: () => void;
  
  /** Save mappings */
  onSaveMappings?: () => Promise<void>;
  
  /** Validate mappings */
  onValidate?: () => void;
  
  /** Navigate to test runner */
  onRunTest?: () => void;
  
  /** Navigate back */
  onBack?: () => void;
}

// ============================================================================
// TEST RUNNER TYPES
// ============================================================================

/**
 * Test execution status
 */
export type TestExecutionStatus = 
  | 'idle'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Step execution status
 */
export type StepExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Step result for display
 */
export interface StepResult {
  /** Step index */
  index: number;
  
  /** Step label */
  label: string;
  
  /** Execution status */
  status: StepExecutionStatus;
  
  /** Duration in ms */
  duration?: number;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Locator strategy used */
  strategyUsed?: string;
  
  /** Screenshot (base64) */
  screenshot?: string;
}

/**
 * Row result for data-driven tests
 */
export interface RowResult {
  /** Row index */
  index: number;
  
  /** CSV data for this row */
  csvData: Record<string, string>;
  
  /** Step results */
  steps: StepResult[];
  
  /** Overall status */
  status: 'passed' | 'failed' | 'skipped';
  
  /** Duration in ms */
  duration: number;
  
  /** Error message (if failed) */
  error?: string;
}

/**
 * Test execution progress
 */
export interface TestProgress {
  /** Current row (1-indexed) */
  currentRow: number;
  
  /** Total rows */
  totalRows: number;
  
  /** Current step (1-indexed) */
  currentStep: number;
  
  /** Total steps */
  totalSteps: number;
  
  /** Rows passed */
  rowsPassed: number;
  
  /** Rows failed */
  rowsFailed: number;
  
  /** Steps passed (current row) */
  stepsPassed: number;
  
  /** Steps failed (current row) */
  stepsFailed: number;
  
  /** Overall percentage (0-100) */
  percentage: number;
  
  /** Elapsed time in ms */
  elapsedTime: number;
  
  /** Estimated remaining time in ms */
  estimatedRemaining?: number;
}

/**
 * Test runner state
 */
export interface TestRunnerState {
  /** Current project */
  project: Project | null;
  
  /** Execution status */
  status: TestExecutionStatus;
  
  /** Progress */
  progress: TestProgress;
  
  /** Row results */
  rowResults: RowResult[];
  
  /** Log entries */
  logs: LogEntry[];
  
  /** Current test run */
  testRun: TestRun | null;
}

/**
 * Test runner props
 */
export interface TestRunnerProps {
  /** Current project */
  project: Project | null;
  
  /** Recorded steps */
  steps: Step[];
  
  /** CSV data rows */
  csvData: Record<string, string>[];
  
  /** Field mappings */
  mappings: FieldMapping[];
  
  /** Execution status */
  status: TestExecutionStatus;
  
  /** Progress */
  progress: TestProgress;
  
  /** Row results */
  rowResults: RowResult[];
  
  /** Log entries */
  logs: LogEntry[];
  
  /** Current test run */
  testRun?: TestRun;
  
  /** Test run history */
  testHistory?: TestRun[];
  
  /** Loading state */
  loading?: LoadingState;
  
  /** Error state */
  error?: ErrorState;
  
  // Callbacks
  
  /** Start test */
  onStartTest?: () => void;
  
  /** Stop test */
  onStopTest?: () => void;
  
  /** Pause test */
  onPauseTest?: () => void;
  
  /** Resume test */
  onResumeTest?: () => void;
  
  /** Reset test */
  onResetTest?: () => void;
  
  /** Retry failed rows */
  onRetryFailed?: () => void;
  
  /** Skip current step */
  onSkipStep?: () => void;
  
  /** Clear logs */
  onClearLogs?: () => void;
  
  /** Export results */
  onExportResults?: (format: 'json' | 'csv' | 'html') => void;
  
  /** View test run details */
  onViewTestRun?: (id: number) => void;
  
  /** Navigate back */
  onBack?: () => void;
}

// ============================================================================
// DIALOG/MODAL TYPES
// ============================================================================

/**
 * Confirmation dialog props
 */
export interface ConfirmDialogProps {
  /** Whether dialog is open */
  open: boolean;
  
  /** Dialog title */
  title: string;
  
  /** Dialog message */
  message: string;
  
  /** Confirm button text */
  confirmText?: string;
  
  /** Cancel button text */
  cancelText?: string;
  
  /** Whether action is destructive */
  destructive?: boolean;
  
  /** Loading state */
  loading?: boolean;
  
  /** On confirm */
  onConfirm: () => void;
  
  /** On cancel */
  onCancel: () => void;
}

/**
 * Alert dialog props
 */
export interface AlertDialogProps {
  /** Whether dialog is open */
  open: boolean;
  
  /** Alert type */
  type: 'info' | 'success' | 'warning' | 'error';
  
  /** Dialog title */
  title: string;
  
  /** Dialog message */
  message: string;
  
  /** Close button text */
  closeText?: string;
  
  /** On close */
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default page size for pagination
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Default log limit
 */
export const DEFAULT_LOG_LIMIT = 500;

/**
 * Status colors for UI display
 */
export const STATUS_COLORS: Record<string, string> = {
  // Project status
  draft: 'gray',
  recording: 'blue',
  recorded: 'yellow',
  mapped: 'purple',
  testing: 'orange',
  completed: 'green',
  
  // Test run status
  pending: 'gray',
  running: 'blue',
  passed: 'green',
  failed: 'red',
  cancelled: 'yellow',
  
  // Step status
  skipped: 'gray',
};

/**
 * Status labels for UI display
 */
export const STATUS_LABELS: Record<string, string> = {
  // Project status
  draft: 'Draft',
  recording: 'Recording',
  recorded: 'Recorded',
  mapped: 'Mapped',
  testing: 'Testing',
  completed: 'Completed',
  
  // Test run status
  pending: 'Pending',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  
  // Step status
  skipped: 'Skipped',
};

/**
 * Log level colors
 */
export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  debug: 'gray',
};

/**
 * Log level icons (Lucide icon names)
 */
export const LOG_LEVEL_ICONS: Record<LogLevel, string> = {
  info: 'Info',
  success: 'CheckCircle',
  warning: 'AlertTriangle',
  error: 'XCircle',
  debug: 'Bug',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create empty loading state
 */
export function createEmptyLoadingState(): LoadingState {
  return {
    isLoading: false,
    message: undefined,
    progress: undefined,
  };
}

/**
 * Create loading state
 */
export function createLoadingState(
  message?: string,
  progress?: number
): LoadingState {
  return {
    isLoading: true,
    message,
    progress,
  };
}

/**
 * Create empty error state
 */
export function createEmptyErrorState(): ErrorState {
  return {
    hasError: false,
    message: undefined,
    code: undefined,
    recoverable: undefined,
  };
}

/**
 * Create error state
 */
export function createErrorState(
  message: string,
  options?: {
    code?: string;
    recoverable?: boolean;
  }
): ErrorState {
  return {
    hasError: true,
    message,
    code: options?.code,
    recoverable: options?.recoverable ?? true,
  };
}

/**
 * Create log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  options?: {
    data?: unknown;
    source?: string;
  }
): LogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    level,
    message,
    data: options?.data,
    source: options?.source,
  };
}

/**
 * Create initial test progress
 */
export function createInitialTestProgress(): TestProgress {
  return {
    currentRow: 0,
    totalRows: 0,
    currentStep: 0,
    totalSteps: 0,
    rowsPassed: 0,
    rowsFailed: 0,
    stepsPassed: 0,
    stepsFailed: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedRemaining: undefined,
  };
}

/**
 * Create project summary from project
 */
export function createProjectSummary(
  project: Project,
  lastTestRun?: TestRun
): ProjectSummary {
  return {
    id: project.id!,
    name: project.name,
    description: project.description,
    status: project.status,
    targetUrl: project.target_url,
    stepCount: project.recorded_steps?.length ?? 0,
    createdAt: project.created_date,
    updatedAt: project.updated_date,
    lastTestStatus: lastTestRun?.status,
    lastTestDate: lastTestRun?.completed_at,
  };
}

/**
 * Calculate dashboard stats from projects and test runs
 */
export function calculateDashboardStats(
  projects: Project[],
  testRuns: TestRun[]
): DashboardStats {
  const projectsByStatus: Record<ProjectStatus, number> = {
    draft: 0,
    recording: 0,
    recorded: 0,
    mapped: 0,
    testing: 0,
    completed: 0,
  };
  
  for (const project of projects) {
    projectsByStatus[project.status]++;
  }
  
  const completedTests = testRuns.filter(r => r.status === 'completed').length;
  const passedTests = testRuns.filter(r => r.status === 'passed').length;
  const activeTests = testRuns.filter(r => r.status === 'running').length;
  
  return {
    totalProjects: projects.length,
    activeTests,
    completedTests,
    successRate: completedTests > 0 
      ? Math.round((passedTests / completedTests) * 100) 
      : 0,
    projectsByStatus,
  };
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
