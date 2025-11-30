/**
 * @fileoverview TestRun type definitions for test execution tracking
 * @module core/types/test-run
 * @version 1.0.0
 * 
 * This module defines the canonical TestRun interface and related types
 * for tracking test execution state, results, and logs.
 * 
 * CRITICAL: TestRun.logs is type `string` (NOT `string[]`)
 * Logs are appended as a single concatenated string with newlines.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 1.4 for authoritative specification
 * @see test-orchestrator_breakdown.md for execution flow
 */

import type { StepExecutionResult } from './step';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Valid test run status values
 * 
 * Lifecycle: pending → running → passed|failed|stopped
 * 
 * @remarks
 * - 'pending': Test is queued but not yet started
 * - 'running': Test is currently executing
 * - 'passed': All steps completed successfully
 * - 'failed': One or more steps failed
 * - 'stopped': Test was manually stopped by user
 */
export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'stopped';

/**
 * Array of valid test run statuses for runtime validation
 */
export const TEST_RUN_STATUSES: readonly TestRunStatus[] = [
  'pending',
  'running',
  'passed',
  'failed',
  'stopped'
] as const;

/**
 * Terminal statuses (test run is complete)
 */
export const TERMINAL_STATUSES: readonly TestRunStatus[] = [
  'passed',
  'failed',
  'stopped'
] as const;

/**
 * Active statuses (test run is in progress)
 */
export const ACTIVE_STATUSES: readonly TestRunStatus[] = [
  'pending',
  'running'
] as const;

/**
 * Default status for new test runs
 */
export const DEFAULT_TEST_RUN_STATUS: TestRunStatus = 'pending';

/**
 * Log level prefixes for structured logging
 */
export const LOG_LEVELS = {
  INFO: '[INFO]',
  WARN: '[WARN]',
  ERROR: '[ERROR]',
  DEBUG: '[DEBUG]',
  STEP: '[STEP]'
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Test execution run record
 * 
 * A TestRun tracks a single execution of a project's recorded steps,
 * potentially with CSV data substitution for data-driven testing.
 * 
 * CRITICAL: The `logs` property is a single string, NOT an array.
 * Log entries are concatenated with newlines for efficient storage
 * and display in a textarea/pre element.
 * 
 * @example
 * ```typescript
 * const testRun: TestRun = {
 *   id: 'run-uuid-1234',
 *   project_id: 1,
 *   status: 'running',
 *   started_at: Date.now(),
 *   completed_at: null,
 *   current_step: 3,
 *   total_steps: 10,
 *   logs: '[INFO] Starting test run...\n[STEP] Step 1: Click Submit\n',
 *   results: [],
 *   csv_row_index: 0,
 *   error: null
 * };
 * ```
 */
export interface TestRun {
  /**
   * Unique test run identifier (UUID format)
   */
  id: string;

  /**
   * Reference to the project being tested
   */
  project_id: number;

  /**
   * Current execution status
   * @see TestRunStatus for valid values
   */
  status: TestRunStatus;

  /**
   * Unix timestamp (milliseconds) when execution started
   * Set when status changes to 'running'
   */
  started_at: number | null;

  /**
   * Unix timestamp (milliseconds) when execution completed
   * Set when status changes to terminal state
   */
  completed_at: number | null;

  /**
   * Index of currently executing step (0-based)
   * Updated during execution for progress tracking
   */
  current_step: number;

  /**
   * Total number of steps to execute
   * Set at start of execution
   */
  total_steps: number;

  /**
   * Execution log as a single concatenated string
   * 
   * CRITICAL: This is type `string`, NOT `string[]`
   * 
   * Log entries are newline-separated for display.
   * Use appendLog() to add entries properly.
   */
  logs: string;

  /**
   * Results for each executed step
   */
  results: StepExecutionResult[];

  /**
   * Current CSV row being used for data substitution (0-based)
   * null if not using CSV data
   */
  csv_row_index: number | null;

  /**
   * Error message if test failed
   * null if no error or test still running
   */
  error: string | null;
}

/**
 * Input for creating a new test run
 */
export interface CreateTestRunInput {
  project_id: number;
  total_steps: number;
  csv_row_index?: number | null;
}

/**
 * Input for updating a test run
 */
export interface UpdateTestRunInput {
  id: string;
  status?: TestRunStatus;
  current_step?: number;
  logs?: string;
  results?: StepExecutionResult[];
  error?: string | null;
}

/**
 * Summary of test run for list displays
 */
export interface TestRunSummary {
  id: string;
  project_id: number;
  status: TestRunStatus;
  started_at: number | null;
  completed_at: number | null;
  duration_ms: number | null;
  steps_passed: number;
  steps_failed: number;
  total_steps: number;
}

/**
 * Progress information during test execution
 */
export interface TestRunProgress {
  current_step: number;
  total_steps: number;
  percentage: number;
  status: TestRunStatus;
  current_step_name?: string;
}

/**
 * Aggregated statistics for multiple test runs
 */
export interface TestRunStats {
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  stopped_runs: number;
  pass_rate: number;
  average_duration_ms: number | null;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate TestRunStatus at runtime
 * 
 * @param value - Value to check
 * @returns True if value is a valid TestRunStatus
 */
export function isTestRunStatus(value: unknown): value is TestRunStatus {
  return typeof value === 'string' && 
    TEST_RUN_STATUSES.includes(value as TestRunStatus);
}

/**
 * Type guard to validate TestRun object structure
 * 
 * @param value - Value to check
 * @returns True if value conforms to TestRun interface
 */
export function isTestRun(value: unknown): value is TestRun {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.id !== 'string' || obj.id.length === 0) return false;
  if (typeof obj.project_id !== 'number') return false;
  if (!isTestRunStatus(obj.status)) return false;
  if (typeof obj.current_step !== 'number') return false;
  if (typeof obj.total_steps !== 'number') return false;
  
  // CRITICAL: logs must be string, NOT array
  if (typeof obj.logs !== 'string') return false;
  
  if (!Array.isArray(obj.results)) return false;

  // Nullable fields
  if (obj.started_at !== null && typeof obj.started_at !== 'number') return false;
  if (obj.completed_at !== null && typeof obj.completed_at !== 'number') return false;
  if (obj.csv_row_index !== null && typeof obj.csv_row_index !== 'number') return false;
  if (obj.error !== null && typeof obj.error !== 'string') return false;

  return true;
}

/**
 * Check if test run is in a terminal state
 * 
 * @param testRun - Test run to check
 * @returns True if test run is complete (passed, failed, or stopped)
 */
export function isTerminalStatus(status: TestRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if test run is active
 * 
 * @param status - Status to check
 * @returns True if test run is pending or running
 */
export function isActiveStatus(status: TestRunStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Check if test run completed successfully
 * 
 * @param testRun - Test run to check
 * @returns True if status is 'passed'
 */
export function isPassed(testRun: TestRun): boolean {
  return testRun.status === 'passed';
}

/**
 * Check if test run failed
 * 
 * @param testRun - Test run to check
 * @returns True if status is 'failed'
 */
export function isFailed(testRun: TestRun): boolean {
  return testRun.status === 'failed';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Generate a unique test run ID
 */
export function generateTestRunId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new TestRun with default values
 * 
 * @param input - Required test run data
 * @returns Complete TestRun object ready for execution
 * 
 * @example
 * ```typescript
 * const testRun = createTestRun({
 *   project_id: 1,
 *   total_steps: 10
 * });
 * // testRun.status === 'pending'
 * // testRun.logs === ''
 * ```
 */
export function createTestRun(input: CreateTestRunInput): TestRun {
  return {
    id: generateTestRunId(),
    project_id: input.project_id,
    status: DEFAULT_TEST_RUN_STATUS,
    started_at: null,
    completed_at: null,
    current_step: 0,
    total_steps: input.total_steps,
    logs: '',
    results: [],
    csv_row_index: input.csv_row_index ?? null,
    error: null
  };
}

/**
 * Convert TestRun to summary for list display
 * 
 * @param testRun - Full test run object
 * @returns Summary with calculated fields
 */
export function toTestRunSummary(testRun: TestRun): TestRunSummary {
  const stepsPassed = testRun.results.filter(r => r.status === 'passed').length;
  const stepsFailed = testRun.results.filter(r => r.status === 'failed').length;
  
  let durationMs: number | null = null;
  if (testRun.started_at !== null && testRun.completed_at !== null) {
    durationMs = testRun.completed_at - testRun.started_at;
  }

  return {
    id: testRun.id,
    project_id: testRun.project_id,
    status: testRun.status,
    started_at: testRun.started_at,
    completed_at: testRun.completed_at,
    duration_ms: durationMs,
    steps_passed: stepsPassed,
    steps_failed: stepsFailed,
    total_steps: testRun.total_steps
  };
}

/**
 * Get progress information from test run
 * 
 * @param testRun - Test run to get progress from
 * @param currentStepName - Optional name of current step
 * @returns Progress info object
 */
export function getTestRunProgress(
  testRun: TestRun, 
  currentStepName?: string
): TestRunProgress {
  const percentage = testRun.total_steps > 0
    ? Math.round((testRun.current_step / testRun.total_steps) * 100)
    : 0;

  return {
    current_step: testRun.current_step,
    total_steps: testRun.total_steps,
    percentage,
    status: testRun.status,
    current_step_name: currentStepName
  };
}

// ============================================================================
// LOG FUNCTIONS
// ============================================================================

/**
 * Format a timestamp for log entries
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (HH:MM:SS.mmm)
 */
export function formatLogTimestamp(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const millis = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

/**
 * Create a formatted log entry
 * 
 * @param level - Log level (INFO, WARN, ERROR, DEBUG, STEP)
 * @param message - Log message
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Formatted log line
 */
export function createLogEntry(
  level: LogLevel, 
  message: string, 
  timestamp?: number
): string {
  const time = formatLogTimestamp(timestamp);
  const prefix = LOG_LEVELS[level];
  return `${time} ${prefix} ${message}`;
}

/**
 * Append a log entry to test run logs
 * 
 * CRITICAL: This returns a NEW string, does not mutate.
 * TestRun.logs is a string, not an array.
 * 
 * @param currentLogs - Current logs string
 * @param level - Log level
 * @param message - Message to log
 * @returns New logs string with entry appended
 * 
 * @example
 * ```typescript
 * testRun.logs = appendLog(testRun.logs, 'INFO', 'Test started');
 * testRun.logs = appendLog(testRun.logs, 'STEP', 'Executing step 1');
 * ```
 */
export function appendLog(
  currentLogs: string, 
  level: LogLevel, 
  message: string
): string {
  const entry = createLogEntry(level, message);
  if (currentLogs.length === 0) {
    return entry;
  }
  return `${currentLogs}\n${entry}`;
}

/**
 * Append multiple log entries at once
 * 
 * @param currentLogs - Current logs string
 * @param entries - Array of [level, message] tuples
 * @returns New logs string with all entries appended
 */
export function appendLogs(
  currentLogs: string, 
  entries: Array<[LogLevel, string]>
): string {
  let logs = currentLogs;
  for (const [level, message] of entries) {
    logs = appendLog(logs, level, message);
  }
  return logs;
}

/**
 * Parse logs string into array of lines
 * 
 * @param logs - Logs string
 * @returns Array of log lines
 */
export function parseLogLines(logs: string): string[] {
  if (logs.length === 0) {
    return [];
  }
  return logs.split('\n');
}

/**
 * Get the last N log lines
 * 
 * @param logs - Logs string
 * @param count - Number of lines to get
 * @returns Last N lines as string
 */
export function getLastLogLines(logs: string, count: number): string {
  const lines = parseLogLines(logs);
  return lines.slice(-count).join('\n');
}

/**
 * Count log entries by level
 * 
 * @param logs - Logs string
 * @returns Object with counts per level
 */
export function countLogsByLevel(logs: string): Record<LogLevel, number> {
  const counts: Record<LogLevel, number> = {
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    DEBUG: 0,
    STEP: 0
  };

  const lines = parseLogLines(logs);
  for (const line of lines) {
    for (const level of Object.keys(LOG_LEVELS) as LogLevel[]) {
      if (line.includes(LOG_LEVELS[level])) {
        counts[level]++;
        break;
      }
    }
  }

  return counts;
}

// ============================================================================
// STATUS TRANSITION FUNCTIONS
// ============================================================================

/**
 * Start a test run (pending → running)
 * 
 * @param testRun - Test run to start
 * @returns New test run with updated status and timestamp
 */
export function startTestRun(testRun: TestRun): TestRun {
  if (testRun.status !== 'pending') {
    throw new Error(`Cannot start test run with status '${testRun.status}'`);
  }

  const now = Date.now();
  return {
    ...testRun,
    status: 'running',
    started_at: now,
    logs: appendLog(testRun.logs, 'INFO', 'Test run started')
  };
}

/**
 * Complete a test run successfully (running → passed)
 * 
 * @param testRun - Test run to complete
 * @returns New test run with passed status
 */
export function passTestRun(testRun: TestRun): TestRun {
  if (testRun.status !== 'running') {
    throw new Error(`Cannot pass test run with status '${testRun.status}'`);
  }

  const now = Date.now();
  return {
    ...testRun,
    status: 'passed',
    completed_at: now,
    logs: appendLog(testRun.logs, 'INFO', 'Test run completed successfully')
  };
}

/**
 * Fail a test run (running → failed)
 * 
 * @param testRun - Test run to fail
 * @param error - Error message
 * @returns New test run with failed status
 */
export function failTestRun(testRun: TestRun, error: string): TestRun {
  if (testRun.status !== 'running') {
    throw new Error(`Cannot fail test run with status '${testRun.status}'`);
  }

  const now = Date.now();
  return {
    ...testRun,
    status: 'failed',
    completed_at: now,
    error,
    logs: appendLog(testRun.logs, 'ERROR', `Test run failed: ${error}`)
  };
}

/**
 * Stop a test run manually (running → stopped)
 * 
 * @param testRun - Test run to stop
 * @returns New test run with stopped status
 */
export function stopTestRun(testRun: TestRun): TestRun {
  if (testRun.status !== 'running') {
    throw new Error(`Cannot stop test run with status '${testRun.status}'`);
  }

  const now = Date.now();
  return {
    ...testRun,
    status: 'stopped',
    completed_at: now,
    logs: appendLog(testRun.logs, 'WARN', 'Test run stopped by user')
  };
}

/**
 * Record step completion in test run
 * 
 * @param testRun - Test run to update
 * @param result - Step execution result
 * @returns New test run with updated step and results
 */
export function recordStepResult(
  testRun: TestRun, 
  result: StepExecutionResult
): TestRun {
  const logLevel: LogLevel = result.status === 'passed' ? 'STEP' : 'ERROR';
  const logMessage = result.status === 'passed'
    ? `Step ${testRun.current_step + 1} passed (${result.duration}ms)`
    : `Step ${testRun.current_step + 1} failed: ${result.error || 'Unknown error'}`;

  return {
    ...testRun,
    current_step: testRun.current_step + 1,
    results: [...testRun.results, result],
    logs: appendLog(testRun.logs, logLevel, logMessage)
  };
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

/**
 * Calculate statistics from multiple test runs
 * 
 * @param testRuns - Array of test runs
 * @returns Aggregated statistics
 */
export function calculateTestRunStats(testRuns: TestRun[]): TestRunStats {
  const total = testRuns.length;
  const passed = testRuns.filter(r => r.status === 'passed').length;
  const failed = testRuns.filter(r => r.status === 'failed').length;
  const stopped = testRuns.filter(r => r.status === 'stopped').length;

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Calculate average duration for completed runs
  const completedRuns = testRuns.filter(r => 
    r.started_at !== null && r.completed_at !== null
  );
  
  let averageDuration: number | null = null;
  if (completedRuns.length > 0) {
    const totalDuration = completedRuns.reduce((sum, run) => 
      sum + (run.completed_at! - run.started_at!), 0
    );
    averageDuration = Math.round(totalDuration / completedRuns.length);
  }

  return {
    total_runs: total,
    passed_runs: passed,
    failed_runs: failed,
    stopped_runs: stopped,
    pass_rate: passRate,
    average_duration_ms: averageDuration
  };
}

/**
 * Format duration in milliseconds to human-readable string
 * 
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string (e.g., "1m 23s", "456ms")
 */
export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return '-';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validation error for test run data
 */
export interface TestRunValidationError {
  field: keyof TestRun | 'general';
  message: string;
}

/**
 * Validate test run data
 * 
 * @param testRun - Test run data to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTestRun(testRun: Partial<TestRun>): TestRunValidationError[] {
  const errors: TestRunValidationError[] = [];

  // ID validation
  if (!testRun.id || testRun.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Test run ID is required' });
  }

  // Project ID validation
  if (typeof testRun.project_id !== 'number' || testRun.project_id <= 0) {
    errors.push({ field: 'project_id', message: 'Valid project ID is required' });
  }

  // Status validation
  if (testRun.status !== undefined && !isTestRunStatus(testRun.status)) {
    errors.push({ 
      field: 'status', 
      message: `Invalid status. Must be one of: ${TEST_RUN_STATUSES.join(', ')}` 
    });
  }

  // Step count validation
  if (typeof testRun.total_steps !== 'number' || testRun.total_steps < 0) {
    errors.push({ field: 'total_steps', message: 'Total steps must be a non-negative number' });
  }

  if (typeof testRun.current_step !== 'number' || testRun.current_step < 0) {
    errors.push({ field: 'current_step', message: 'Current step must be a non-negative number' });
  }

  // CRITICAL: logs must be string
  if (testRun.logs !== undefined && typeof testRun.logs !== 'string') {
    errors.push({ field: 'logs', message: 'Logs must be a string (not array)' });
  }

  // Consistency checks
  if (testRun.current_step !== undefined && 
      testRun.total_steps !== undefined && 
      testRun.current_step > testRun.total_steps) {
    errors.push({ 
      field: 'current_step', 
      message: 'Current step cannot exceed total steps' 
    });
  }

  return errors;
}

/**
 * Check if test run data is valid
 * 
 * @param testRun - Test run data to validate
 * @returns True if test run is valid
 */
export function isValidTestRun(testRun: Partial<TestRun>): boolean {
  return validateTestRun(testRun).length === 0;
}
