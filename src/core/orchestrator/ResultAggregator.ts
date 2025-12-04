/**
 * ResultAggregator - Aggregates test execution results
 * @module core/orchestrator/ResultAggregator
 * @version 1.0.0
 * 
 * Combines data from ProgressTracker and LogCollector into
 * a unified result structure for TestRun storage.
 * 
 * Aggregates:
 * - Step outcomes (passed/failed/skipped)
 * - Timing data (duration per step, total duration)
 * - Error messages and details
 * - Row-level and overall statistics
 * 
 * @see test-orchestrator_breakdown.md for result collection details
 */

import type { ProgressTracker, TrackedStep, TrackedRow, ProgressSnapshot } from './ProgressTracker';
import type { LogCollector } from './LogCollector';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Step result status
 */
export type StepResultStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Individual step result for test_results array
 */
export interface StepResult {
  /** Step index (0-based) */
  index: number;
  /** Step identifier */
  id: number | string;
  /** Step name/label */
  name: string;
  /** Execution status */
  status: StepResultStatus;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Row index this step belongs to (for CSV execution) */
  rowIndex?: number;
  /** Timestamp when step started */
  startedAt?: string;
  /** Timestamp when step completed */
  completedAt?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Row-level result summary
 */
export interface RowResult {
  /** Row index (0-based) */
  index: number;
  /** Row identifier */
  identifier?: string;
  /** Row status */
  status: 'completed' | 'failed' | 'skipped';
  /** Steps in this row */
  steps: StepResult[];
  /** Passed step count */
  passedSteps: number;
  /** Failed step count */
  failedSteps: number;
  /** Skipped step count */
  skippedSteps: number;
  /** Total duration for row */
  duration: number;
  /** Start timestamp */
  startedAt?: string;
  /** End timestamp */
  completedAt?: string;
}

/**
 * Overall execution result
 */
export interface ExecutionResult {
  /** Overall status */
  status: 'completed' | 'failed' | 'stopped' | 'pending';
  /** Total steps across all rows */
  totalSteps: number;
  /** Passed steps across all rows */
  passedSteps: number;
  /** Failed steps across all rows */
  failedSteps: number;
  /** Skipped steps across all rows */
  skippedSteps: number;
  /** Total rows */
  totalRows: number;
  /** Completed rows */
  completedRows: number;
  /** Failed rows (at least one failed step) */
  failedRows: number;
  /** Total execution duration (ms) */
  duration: number;
  /** Pass rate (0-100) */
  passRate: number;
  /** Start timestamp (ISO string) */
  startTime: string;
  /** End timestamp (ISO string) */
  endTime: string;
  /** All step results (flat array for test_results) */
  testResults: StepResult[];
  /** Row-level results */
  rowResults: RowResult[];
  /** Logs as string */
  logs: string;
  /** Was execution stopped by user */
  wasStopped: boolean;
}

/**
 * Partial result for in-progress aggregation
 */
export interface PartialResult {
  /** Current status */
  status: 'running' | 'paused';
  /** Progress percentage */
  progress: number;
  /** Current row index */
  currentRow: number;
  /** Current step index */
  currentStep: number;
  /** Steps completed so far */
  completedSteps: number;
  /** Passed so far */
  passedSteps: number;
  /** Failed so far */
  failedSteps: number;
  /** Elapsed time (ms) */
  elapsedTime: number;
  /** Estimated remaining time (ms) */
  estimatedRemaining: number;
}

/**
 * Configuration for ResultAggregator
 */
export interface ResultAggregatorConfig {
  /** Include pending steps in results. Default: false */
  includePending: boolean;
  /** Include row-level details. Default: true */
  includeRowDetails: boolean;
  /** Include step metadata. Default: false */
  includeMetadata: boolean;
  /** Timestamp format. Default: ISO string */
  timestampFormat: 'iso' | 'unix' | 'locale';
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_RESULT_AGGREGATOR_CONFIG: ResultAggregatorConfig = {
  includePending: false,
  includeRowDetails: true,
  includeMetadata: false,
  timestampFormat: 'iso',
};

// ============================================================================
// RESULT AGGREGATOR CLASS
// ============================================================================

/**
 * ResultAggregator - Aggregates test execution results
 * 
 * @example
 * ```typescript
 * const aggregator = new ResultAggregator();
 * 
 * // After execution completes
 * const result = aggregator.aggregate(progressTracker, logCollector);
 * 
 * // Use for TestRun creation
 * const testRun = {
 *   status: result.status,
 *   total_steps: result.totalSteps,
 *   passed_steps: result.passedSteps,
 *   failed_steps: result.failedSteps,
 *   test_results: result.testResults,
 *   logs: result.logs,
 * };
 * ```
 */
export class ResultAggregator {
  private config: ResultAggregatorConfig;
  private startTime: Date | null = null;
  private endTime: Date | null = null;
  private wasStopped: boolean = false;

  /**
   * Create a new ResultAggregator
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<ResultAggregatorConfig> = {}) {
    this.config = { ...DEFAULT_RESULT_AGGREGATOR_CONFIG, ...config };
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Mark execution start
   */
  public markStart(): void {
    this.startTime = new Date();
    this.endTime = null;
    this.wasStopped = false;
  }

  /**
   * Mark execution end
   */
  public markEnd(): void {
    this.endTime = new Date();
  }

  /**
   * Mark execution as stopped by user
   */
  public markStopped(): void {
    this.wasStopped = true;
    this.markEnd();
  }

  // ==========================================================================
  // MAIN AGGREGATION
  // ==========================================================================

  /**
   * Aggregate results from ProgressTracker and LogCollector
   * 
   * @param progressTracker - Progress tracking data
   * @param logCollector - Log collection data
   * @returns Complete execution result
   */
  public aggregate(
    progressTracker: ProgressTracker,
    logCollector: LogCollector
  ): ExecutionResult {
    const snapshot = progressTracker.getSnapshot();
    const rows = progressTracker.getRows();
    
    // Ensure we have timestamps
    if (!this.startTime) {
      this.startTime = snapshot.startedAt ? new Date(snapshot.startedAt) : new Date();
    }
    if (!this.endTime) {
      this.endTime = new Date();
    }

    // Aggregate row results
    const rowResults = this.aggregateRows(rows);
    
    // Flatten step results for test_results array
    const testResults = this.flattenStepResults(rowResults);
    
    // Calculate summary statistics
    const passedSteps = rowResults.reduce((sum, r) => sum + r.passedSteps, 0);
    const failedSteps = rowResults.reduce((sum, r) => sum + r.failedSteps, 0);
    const skippedSteps = rowResults.reduce((sum, r) => sum + r.skippedSteps, 0);
    const totalSteps = passedSteps + failedSteps + skippedSteps;
    
    const completedRows = rowResults.filter(r => r.status === 'completed').length;
    const failedRows = rowResults.filter(r => r.status === 'failed').length;
    
    // Calculate pass rate
    const passRate = totalSteps > 0 
      ? Math.round((passedSteps / totalSteps) * 100 * 100) / 100
      : 0;
    
    // Determine overall status
    const status = this.determineStatus(failedSteps, this.wasStopped, snapshot);
    
    // Calculate duration
    const duration = this.endTime.getTime() - this.startTime.getTime();

    return {
      status,
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      totalRows: rows.length,
      completedRows,
      failedRows,
      duration,
      passRate,
      startTime: this.formatTimestamp(this.startTime),
      endTime: this.formatTimestamp(this.endTime),
      testResults,
      rowResults: this.config.includeRowDetails ? rowResults : [],
      logs: logCollector.toString(),
      wasStopped: this.wasStopped,
    };
  }

  /**
   * Get partial/in-progress results
   * 
   * @param progressTracker - Progress tracking data
   * @returns Partial result for UI updates
   */
  public getPartialResult(progressTracker: ProgressTracker): PartialResult {
    const snapshot = progressTracker.getSnapshot();
    
    return {
      status: snapshot.isPaused ? 'paused' : 'running',
      progress: snapshot.percentage,
      currentRow: snapshot.currentRowIndex,
      currentStep: snapshot.currentStepIndex,
      completedSteps: snapshot.completedSteps,
      passedSteps: snapshot.passedSteps,
      failedSteps: snapshot.failedSteps,
      elapsedTime: snapshot.elapsedTime,
      estimatedRemaining: snapshot.estimatedTimeRemaining,
    };
  }

  // ==========================================================================
  // ROW AGGREGATION
  // ==========================================================================

  /**
   * Aggregate results for all rows
   */
  private aggregateRows(rows: TrackedRow[]): RowResult[] {
    return rows.map(row => this.aggregateRow(row));
  }

  /**
   * Aggregate results for a single row
   */
  private aggregateRow(row: TrackedRow): RowResult {
    const steps = this.aggregateSteps(row.steps, row.index);
    
    // Determine row status
    let status: 'completed' | 'failed' | 'skipped';
    if (row.failedSteps > 0) {
      status = 'failed';
    } else if (row.passedSteps === 0 && row.skippedSteps > 0) {
      status = 'skipped';
    } else {
      status = 'completed';
    }

    return {
      index: row.index,
      identifier: row.identifier,
      status,
      steps,
      passedSteps: row.passedSteps,
      failedSteps: row.failedSteps,
      skippedSteps: row.skippedSteps,
      duration: row.duration,
      startedAt: row.startedAt ? this.formatTimestamp(new Date(row.startedAt)) : undefined,
      completedAt: row.completedAt ? this.formatTimestamp(new Date(row.completedAt)) : undefined,
    };
  }

  // ==========================================================================
  // STEP AGGREGATION
  // ==========================================================================

  /**
   * Aggregate results for steps in a row
   */
  private aggregateSteps(steps: TrackedStep[], rowIndex: number): StepResult[] {
    return steps
      .filter(step => this.config.includePending || step.status !== 'pending')
      .map(step => this.aggregateStep(step, rowIndex));
  }

  /**
   * Aggregate result for a single step
   */
  private aggregateStep(step: TrackedStep, rowIndex: number): StepResult {
    const result: StepResult = {
      index: step.index,
      id: step.id,
      name: step.name,
      status: step.status as StepResultStatus,
      duration: step.duration,
      rowIndex,
    };

    if (step.errorMessage) {
      result.errorMessage = step.errorMessage;
    }

    if (step.startedAt) {
      result.startedAt = this.formatTimestamp(new Date(step.startedAt));
    }

    if (step.completedAt) {
      result.completedAt = this.formatTimestamp(new Date(step.completedAt));
    }

    return result;
  }

  /**
   * Flatten row results into single step array
   */
  private flattenStepResults(rowResults: RowResult[]): StepResult[] {
    const flatResults: StepResult[] = [];
    
    for (const row of rowResults) {
      for (const step of row.steps) {
        flatResults.push(step);
      }
    }
    
    return flatResults;
  }

  // ==========================================================================
  // STATUS DETERMINATION
  // ==========================================================================

  /**
   * Determine overall execution status
   */
  private determineStatus(
    failedSteps: number,
    wasStopped: boolean,
    snapshot: ProgressSnapshot
  ): 'completed' | 'failed' | 'stopped' | 'pending' {
    if (wasStopped) {
      return 'stopped';
    }
    
    if (!snapshot.isRunning && snapshot.completedSteps === 0) {
      return 'pending';
    }
    
    if (failedSteps > 0) {
      return 'failed';
    }
    
    return 'completed';
  }

  // ==========================================================================
  // TIMESTAMP FORMATTING
  // ==========================================================================

  /**
   * Format timestamp according to config
   */
  private formatTimestamp(date: Date): string {
    switch (this.config.timestampFormat) {
      case 'unix':
        return date.getTime().toString();
      case 'locale':
        return date.toLocaleString();
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  // ==========================================================================
  // STATISTICS HELPERS
  // ==========================================================================

  /**
   * Calculate summary statistics from step results
   */
  public calculateStats(testResults: StepResult[]): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    avgDuration: number;
    totalDuration: number;
  } {
    const total = testResults.length;
    const passed = testResults.filter(r => r.status === 'passed').length;
    const failed = testResults.filter(r => r.status === 'failed').length;
    const skipped = testResults.filter(r => r.status === 'skipped').length;
    
    const durations = testResults
      .filter(r => r.duration > 0)
      .map(r => r.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = durations.length > 0 
      ? Math.round(totalDuration / durations.length)
      : 0;
    
    const passRate = total > 0 
      ? Math.round((passed / total) * 100 * 100) / 100
      : 0;

    return {
      total,
      passed,
      failed,
      skipped,
      passRate,
      avgDuration,
      totalDuration,
    };
  }

  /**
   * Get failed steps from results
   */
  public getFailedSteps(testResults: StepResult[]): StepResult[] {
    return testResults.filter(r => r.status === 'failed');
  }

  /**
   * Get error summary from failed steps
   */
  public getErrorSummary(testResults: StepResult[]): Array<{
    stepIndex: number;
    stepName: string;
    error: string;
    rowIndex?: number;
  }> {
    return this.getFailedSteps(testResults).map(step => ({
      stepIndex: step.index,
      stepName: step.name,
      error: step.errorMessage || 'Unknown error',
      rowIndex: step.rowIndex,
    }));
  }

  /**
   * Get slowest steps
   */
  public getSlowestSteps(testResults: StepResult[], count: number = 5): StepResult[] {
    return [...testResults]
      .filter(r => r.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count);
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Get current configuration
   */
  public getConfig(): ResultAggregatorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ResultAggregatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==========================================================================
  // RESET
  // ==========================================================================

  /**
   * Reset aggregator state
   */
  public reset(): void {
    this.startTime = null;
    this.endTime = null;
    this.wasStopped = false;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ResultAggregator instance
 * 
 * @param config - Optional configuration
 * @returns Configured ResultAggregator
 */
export function createResultAggregator(
  config?: Partial<ResultAggregatorConfig>
): ResultAggregator {
  return new ResultAggregator(config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert ExecutionResult to TestRun-compatible format
 * 
 * @param result - Execution result
 * @param projectId - Project ID for TestRun
 * @returns Object compatible with TestRun interface
 */
export function toTestRunFormat(
  result: ExecutionResult,
  projectId: number
): {
  project_id: number;
  status: string;
  start_time: string;
  end_time: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  test_results: StepResult[];
  logs: string;
} {
  // Map status to TestRun status values
  let testRunStatus: string;
  switch (result.status) {
    case 'completed':
      testRunStatus = 'completed';
      break;
    case 'failed':
      testRunStatus = 'failed';
      break;
    case 'stopped':
      testRunStatus = 'failed'; // Treat stopped as failed
      break;
    default:
      testRunStatus = 'pending';
  }

  return {
    project_id: projectId,
    status: testRunStatus,
    start_time: result.startTime,
    end_time: result.endTime,
    total_steps: result.totalSteps,
    passed_steps: result.passedSteps,
    failed_steps: result.failedSteps,
    test_results: result.testResults,
    logs: result.logs,
  };
}

/**
 * Generate a human-readable summary of results
 */
export function generateResultSummary(result: ExecutionResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════',
    '           TEST EXECUTION SUMMARY',
    '═══════════════════════════════════════',
    '',
    `Status: ${result.status.toUpperCase()}`,
    `Duration: ${formatDuration(result.duration)}`,
    '',
    '─── Steps ───',
    `Total: ${result.totalSteps}`,
    `Passed: ${result.passedSteps} (${result.passRate}%)`,
    `Failed: ${result.failedSteps}`,
    `Skipped: ${result.skippedSteps}`,
    '',
    '─── Rows ───',
    `Total: ${result.totalRows}`,
    `Completed: ${result.completedRows}`,
    `Failed: ${result.failedRows}`,
  ];

  if (result.wasStopped) {
    lines.push('', '⚠ Execution was stopped by user');
  }

  lines.push('', '═══════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
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
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}
