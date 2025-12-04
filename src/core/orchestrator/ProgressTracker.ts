/**
 * ProgressTracker - Real-time progress tracking for test execution
 * @module core/orchestrator/ProgressTracker
 * @version 1.0.0
 * 
 * Tracks execution progress at multiple levels:
 * - Overall progress (percentage complete)
 * - Row progress (for CSV data-driven tests)
 * - Step progress (within current row)
 * 
 * Emits events for UI binding and calculates estimated time remaining.
 * 
 * @see test-orchestrator_breakdown.md for progress tracking details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Step execution status
 */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Individual step tracking data
 */
export interface TrackedStep {
  /** Step index (0-based) */
  index: number;
  /** Step identifier */
  id: number | string;
  /** Step name/label */
  name: string;
  /** Current status */
  status: StepStatus;
  /** Execution duration in ms (0 if not started) */
  duration: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Start timestamp */
  startedAt?: number;
  /** End timestamp */
  completedAt?: number;
}

/**
 * Row tracking data (for CSV execution)
 */
export interface TrackedRow {
  /** Row index (0-based) */
  index: number;
  /** Row identifier (e.g., first column value) */
  identifier?: string;
  /** Row status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Steps within this row */
  steps: TrackedStep[];
  /** Count of passed steps */
  passedSteps: number;
  /** Count of failed steps */
  failedSteps: number;
  /** Count of skipped steps */
  skippedSteps: number;
  /** Total duration for this row */
  duration: number;
  /** Start timestamp */
  startedAt?: number;
  /** End timestamp */
  completedAt?: number;
}

/**
 * Overall progress snapshot
 */
export interface ProgressSnapshot {
  /** Overall percentage (0-100) */
  percentage: number;
  /** Current row index (0-based, -1 if not started) */
  currentRowIndex: number;
  /** Current step index within row (0-based, -1 if not started) */
  currentStepIndex: number;
  /** Total rows to process */
  totalRows: number;
  /** Total steps per row */
  stepsPerRow: number;
  /** Total steps overall (rows * stepsPerRow) */
  totalSteps: number;
  /** Completed steps count */
  completedSteps: number;
  /** Passed steps count */
  passedSteps: number;
  /** Failed steps count */
  failedSteps: number;
  /** Skipped steps count */
  skippedSteps: number;
  /** Completed rows count */
  completedRows: number;
  /** Elapsed time in ms */
  elapsedTime: number;
  /** Estimated remaining time in ms */
  estimatedTimeRemaining: number;
  /** Average step duration in ms */
  averageStepDuration: number;
  /** Is execution running */
  isRunning: boolean;
  /** Is execution paused */
  isPaused: boolean;
  /** Execution start timestamp */
  startedAt?: number;
}

/**
 * Progress event types
 */
export type ProgressEventType = 
  | 'progress_update'
  | 'step_started'
  | 'step_completed'
  | 'row_started'
  | 'row_completed'
  | 'execution_started'
  | 'execution_completed'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_stopped';

/**
 * Progress event payload
 */
export interface ProgressEvent {
  type: ProgressEventType;
  timestamp: number;
  snapshot: ProgressSnapshot;
  step?: TrackedStep;
  row?: TrackedRow;
}

/**
 * Progress event listener
 */
export type ProgressEventListener = (event: ProgressEvent) => void;

/**
 * Configuration for ProgressTracker
 */
export interface ProgressTrackerConfig {
  /** Emit progress_update events at this interval (ms). 0 to disable. Default: 500 */
  updateInterval: number;
  /** Include skipped steps in percentage calculation. Default: false */
  includeSkippedInProgress: boolean;
  /** Store step timing history. Default: true */
  trackStepHistory: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_PROGRESS_TRACKER_CONFIG: ProgressTrackerConfig = {
  updateInterval: 500,
  includeSkippedInProgress: false,
  trackStepHistory: true,
};

// ============================================================================
// PROGRESS TRACKER CLASS
// ============================================================================

/**
 * ProgressTracker - Tracks test execution progress in real-time
 * 
 * @example
 * ```typescript
 * const tracker = new ProgressTracker(5, 10); // 5 rows, 10 steps each
 * tracker.on('progress_update', (event) => updateUI(event.snapshot));
 * 
 * tracker.startExecution();
 * tracker.startRow(0);
 * tracker.startStep(0, { id: 1, name: 'Click Login' });
 * tracker.completeStep(0, 'passed', 150);
 * // ... more steps
 * tracker.completeRow(0);
 * tracker.completeExecution();
 * ```
 */
export class ProgressTracker {
  private config: ProgressTrackerConfig;
  private listeners: Map<ProgressEventType | '*', Set<ProgressEventListener>>;
  
  // Execution state
  private totalRows: number;
  private stepsPerRow: number;
  private rows: TrackedRow[];
  private currentRowIndex: number = -1;
  private currentStepIndex: number = -1;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private totalPausedTime: number = 0;
  
  // Statistics
  private completedStepDurations: number[] = [];
  private updateIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Create a new ProgressTracker
   * 
   * @param totalRows - Number of rows to process (1 for non-CSV)
   * @param stepsPerRow - Number of steps per row
   * @param config - Optional configuration
   */
  constructor(
    totalRows: number,
    stepsPerRow: number,
    config: Partial<ProgressTrackerConfig> = {}
  ) {
    this.config = { ...DEFAULT_PROGRESS_TRACKER_CONFIG, ...config };
    this.listeners = new Map();
    this.totalRows = Math.max(1, totalRows);
    this.stepsPerRow = Math.max(0, stepsPerRow);
    
    // Initialize row tracking
    this.rows = [];
    for (let i = 0; i < this.totalRows; i++) {
      this.rows.push(this.createTrackedRow(i));
    }
  }

  // ==========================================================================
  // ROW/STEP INITIALIZATION
  // ==========================================================================

  /**
   * Create a tracked row with initialized steps
   */
  private createTrackedRow(index: number): TrackedRow {
    const steps: TrackedStep[] = [];
    for (let i = 0; i < this.stepsPerRow; i++) {
      steps.push({
        index: i,
        id: i,
        name: `Step ${i + 1}`,
        status: 'pending',
        duration: 0,
      });
    }
    
    return {
      index,
      status: 'pending',
      steps,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      duration: 0,
    };
  }

  /**
   * Initialize step metadata
   */
  public initializeStep(
    stepIndex: number,
    metadata: { id: number | string; name: string }
  ): void {
    if (this.currentRowIndex < 0 || this.currentRowIndex >= this.rows.length) {
      return;
    }
    
    const row = this.rows[this.currentRowIndex];
    if (stepIndex >= 0 && stepIndex < row.steps.length) {
      row.steps[stepIndex].id = metadata.id;
      row.steps[stepIndex].name = metadata.name;
    }
  }

  /**
   * Bulk initialize all steps for current row
   */
  public initializeSteps(
    steps: Array<{ id: number | string; name: string }>
  ): void {
    if (this.currentRowIndex < 0 || this.currentRowIndex >= this.rows.length) {
      return;
    }
    
    const row = this.rows[this.currentRowIndex];
    steps.forEach((step, index) => {
      if (index < row.steps.length) {
        row.steps[index].id = step.id;
        row.steps[index].name = step.name;
      }
    });
  }

  // ==========================================================================
  // EXECUTION LIFECYCLE
  // ==========================================================================

  /**
   * Start execution tracking
   */
  public startExecution(): void {
    this.isRunning = true;
    this.isPaused = false;
    this.startedAt = Date.now();
    this.totalPausedTime = 0;
    this.currentRowIndex = -1;
    this.currentStepIndex = -1;
    this.completedStepDurations = [];
    
    // Reset all rows
    this.rows = [];
    for (let i = 0; i < this.totalRows; i++) {
      this.rows.push(this.createTrackedRow(i));
    }
    
    // Start periodic updates
    if (this.config.updateInterval > 0) {
      this.updateIntervalId = setInterval(() => {
        this.emitProgressUpdate();
      }, this.config.updateInterval);
    }
    
    this.emit('execution_started');
  }

  /**
   * Complete execution tracking
   */
  public completeExecution(): void {
    this.stopPeriodicUpdates();
    this.isRunning = false;
    this.isPaused = false;
    this.emit('execution_completed');
  }

  /**
   * Stop execution (user-initiated)
   */
  public stopExecution(): void {
    this.stopPeriodicUpdates();
    this.isRunning = false;
    this.isPaused = false;
    this.emit('execution_stopped');
  }

  /**
   * Pause execution
   */
  public pauseExecution(): void {
    if (!this.isRunning || this.isPaused) return;
    
    this.isPaused = true;
    this.pausedAt = Date.now();
    this.emit('execution_paused');
  }

  /**
   * Resume execution
   */
  public resumeExecution(): void {
    if (!this.isRunning || !this.isPaused) return;
    
    if (this.pausedAt) {
      this.totalPausedTime += Date.now() - this.pausedAt;
    }
    this.isPaused = false;
    this.pausedAt = null;
    this.emit('execution_resumed');
  }

  /**
   * Stop periodic update timer
   */
  private stopPeriodicUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  // ==========================================================================
  // ROW TRACKING
  // ==========================================================================

  /**
   * Start tracking a row
   */
  public startRow(rowIndex: number, identifier?: string): void {
    if (rowIndex < 0 || rowIndex >= this.rows.length) return;
    
    this.currentRowIndex = rowIndex;
    this.currentStepIndex = -1;
    
    const row = this.rows[rowIndex];
    row.status = 'running';
    row.startedAt = Date.now();
    row.identifier = identifier;
    
    // Reset row counters
    row.passedSteps = 0;
    row.failedSteps = 0;
    row.skippedSteps = 0;
    
    // Reset steps for this row
    row.steps.forEach(step => {
      step.status = 'pending';
      step.duration = 0;
      step.errorMessage = undefined;
      step.startedAt = undefined;
      step.completedAt = undefined;
    });
    
    this.emit('row_started', undefined, row);
  }

  /**
   * Complete tracking a row
   */
  public completeRow(rowIndex: number): void {
    if (rowIndex < 0 || rowIndex >= this.rows.length) return;
    
    const row = this.rows[rowIndex];
    row.completedAt = Date.now();
    row.duration = row.startedAt ? row.completedAt - row.startedAt : 0;
    
    // Determine row status based on step results
    if (row.failedSteps > 0) {
      row.status = 'failed';
    } else {
      row.status = 'completed';
    }
    
    this.emit('row_completed', undefined, row);
  }

  // ==========================================================================
  // STEP TRACKING
  // ==========================================================================

  /**
   * Start tracking a step
   */
  public startStep(
    stepIndex: number,
    metadata?: { id: number | string; name: string }
  ): void {
    if (this.currentRowIndex < 0 || this.currentRowIndex >= this.rows.length) {
      return;
    }
    
    const row = this.rows[this.currentRowIndex];
    if (stepIndex < 0 || stepIndex >= row.steps.length) return;
    
    this.currentStepIndex = stepIndex;
    
    const step = row.steps[stepIndex];
    step.status = 'running';
    step.startedAt = Date.now();
    
    if (metadata) {
      step.id = metadata.id;
      step.name = metadata.name;
    }
    
    this.emit('step_started', step);
  }

  /**
   * Complete tracking a step
   */
  public completeStep(
    stepIndex: number,
    status: 'passed' | 'failed' | 'skipped',
    duration?: number,
    errorMessage?: string
  ): void {
    if (this.currentRowIndex < 0 || this.currentRowIndex >= this.rows.length) {
      return;
    }
    
    const row = this.rows[this.currentRowIndex];
    if (stepIndex < 0 || stepIndex >= row.steps.length) return;
    
    const step = row.steps[stepIndex];
    step.status = status;
    step.completedAt = Date.now();
    step.duration = duration ?? (step.startedAt ? step.completedAt - step.startedAt : 0);
    step.errorMessage = errorMessage;
    
    // Update row counters
    switch (status) {
      case 'passed':
        row.passedSteps++;
        break;
      case 'failed':
        row.failedSteps++;
        break;
      case 'skipped':
        row.skippedSteps++;
        break;
    }
    
    // Track duration for time estimation
    if (this.config.trackStepHistory && step.duration > 0) {
      this.completedStepDurations.push(step.duration);
    }
    
    this.emit('step_completed', step);
  }

  /**
   * Update step status directly (for external status updates)
   */
  public updateStepStatus(
    rowIndex: number,
    stepIndex: number,
    status: StepStatus,
    duration?: number,
    errorMessage?: string
  ): void {
    if (rowIndex < 0 || rowIndex >= this.rows.length) return;
    
    const row = this.rows[rowIndex];
    if (stepIndex < 0 || stepIndex >= row.steps.length) return;
    
    const step = row.steps[stepIndex];
    const previousStatus = step.status;
    
    // Adjust counters if status changed from a completed state
    if (previousStatus === 'passed') row.passedSteps--;
    if (previousStatus === 'failed') row.failedSteps--;
    if (previousStatus === 'skipped') row.skippedSteps--;
    
    step.status = status;
    if (duration !== undefined) step.duration = duration;
    if (errorMessage !== undefined) step.errorMessage = errorMessage;
    
    // Update counters for new status
    if (status === 'passed') row.passedSteps++;
    if (status === 'failed') row.failedSteps++;
    if (status === 'skipped') row.skippedSteps++;
  }

  // ==========================================================================
  // PROGRESS CALCULATION
  // ==========================================================================

  /**
   * Get current progress snapshot
   */
  public getSnapshot(): ProgressSnapshot {
    const completedSteps = this.calculateCompletedSteps();
    const passedSteps = this.calculatePassedSteps();
    const failedSteps = this.calculateFailedSteps();
    const skippedSteps = this.calculateSkippedSteps();
    const completedRows = this.calculateCompletedRows();
    const totalSteps = this.totalRows * this.stepsPerRow;
    
    const elapsedTime = this.calculateElapsedTime();
    const averageStepDuration = this.calculateAverageStepDuration();
    const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(
      completedSteps,
      totalSteps,
      averageStepDuration
    );
    
    // Calculate percentage
    // Original pattern: (passed + failed) / total * 100
    const progressDenominator = this.config.includeSkippedInProgress
      ? passedSteps + failedSteps + skippedSteps
      : passedSteps + failedSteps;
    const percentage = totalSteps > 0
      ? Math.min(100, (progressDenominator / totalSteps) * 100)
      : 0;
    
    return {
      percentage: Math.round(percentage * 100) / 100, // 2 decimal places
      currentRowIndex: this.currentRowIndex,
      currentStepIndex: this.currentStepIndex,
      totalRows: this.totalRows,
      stepsPerRow: this.stepsPerRow,
      totalSteps,
      completedSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      completedRows,
      elapsedTime,
      estimatedTimeRemaining,
      averageStepDuration,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      startedAt: this.startedAt ?? undefined,
    };
  }

  /**
   * Get progress percentage (0-100)
   */
  public getPercentage(): number {
    return this.getSnapshot().percentage;
  }

  /**
   * Calculate total completed steps across all rows
   */
  private calculateCompletedSteps(): number {
    let count = 0;
    for (const row of this.rows) {
      count += row.passedSteps + row.failedSteps + row.skippedSteps;
    }
    return count;
  }

  /**
   * Calculate total passed steps
   */
  private calculatePassedSteps(): number {
    return this.rows.reduce((sum, row) => sum + row.passedSteps, 0);
  }

  /**
   * Calculate total failed steps
   */
  private calculateFailedSteps(): number {
    return this.rows.reduce((sum, row) => sum + row.failedSteps, 0);
  }

  /**
   * Calculate total skipped steps
   */
  private calculateSkippedSteps(): number {
    return this.rows.reduce((sum, row) => sum + row.skippedSteps, 0);
  }

  /**
   * Calculate completed rows
   */
  private calculateCompletedRows(): number {
    return this.rows.filter(
      row => row.status === 'completed' || row.status === 'failed'
    ).length;
  }

  /**
   * Calculate elapsed time (excluding paused time)
   */
  private calculateElapsedTime(): number {
    if (!this.startedAt) return 0;
    
    const now = this.isPaused && this.pausedAt ? this.pausedAt : Date.now();
    return now - this.startedAt - this.totalPausedTime;
  }

  /**
   * Calculate average step duration from history
   */
  private calculateAverageStepDuration(): number {
    if (this.completedStepDurations.length === 0) return 0;
    
    const sum = this.completedStepDurations.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.completedStepDurations.length);
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTimeRemaining(
    completedSteps: number,
    totalSteps: number,
    averageStepDuration: number
  ): number {
    const remainingSteps = totalSteps - completedSteps;
    if (remainingSteps <= 0 || averageStepDuration <= 0) return 0;
    
    return remainingSteps * averageStepDuration;
  }

  // ==========================================================================
  // EVENT SYSTEM
  // ==========================================================================

  /**
   * Subscribe to progress events
   * 
   * @param type - Event type or '*' for all events
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  public on(
    type: ProgressEventType | '*',
    listener: ProgressEventListener
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Unsubscribe from progress events
   */
  public off(
    type: ProgressEventType | '*',
    listener: ProgressEventListener
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  /**
   * Emit a progress event
   */
  private emit(
    type: ProgressEventType,
    step?: TrackedStep,
    row?: TrackedRow
  ): void {
    const event: ProgressEvent = {
      type,
      timestamp: Date.now(),
      snapshot: this.getSnapshot(),
      step,
      row,
    };
    
    // Emit to specific listeners
    this.listeners.get(type)?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[ProgressTracker] Error in ${type} listener:`, error);
      }
    });
    
    // Emit to wildcard listeners
    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[ProgressTracker] Error in wildcard listener:`, error);
      }
    });
  }

  /**
   * Emit a progress update event
   */
  private emitProgressUpdate(): void {
    if (this.isRunning && !this.isPaused) {
      this.emit('progress_update');
    }
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  /**
   * Get all tracked rows
   */
  public getRows(): TrackedRow[] {
    return [...this.rows];
  }

  /**
   * Get a specific row
   */
  public getRow(index: number): TrackedRow | undefined {
    return this.rows[index];
  }

  /**
   * Get current row
   */
  public getCurrentRow(): TrackedRow | undefined {
    if (this.currentRowIndex < 0) return undefined;
    return this.rows[this.currentRowIndex];
  }

  /**
   * Get current step
   */
  public getCurrentStep(): TrackedStep | undefined {
    const row = this.getCurrentRow();
    if (!row || this.currentStepIndex < 0) return undefined;
    return row.steps[this.currentStepIndex];
  }

  /**
   * Get steps for current row
   */
  public getCurrentRowSteps(): TrackedStep[] {
    const row = this.getCurrentRow();
    return row ? [...row.steps] : [];
  }

  /**
   * Get configuration
   */
  public getConfig(): ProgressTrackerConfig {
    return { ...this.config };
  }

  /**
   * Check if execution is running
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if execution is paused
   */
  public getIsPaused(): boolean {
    return this.isPaused;
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Reset tracker to initial state
   */
  public reset(): void {
    this.stopPeriodicUpdates();
    this.isRunning = false;
    this.isPaused = false;
    this.startedAt = null;
    this.pausedAt = null;
    this.totalPausedTime = 0;
    this.currentRowIndex = -1;
    this.currentStepIndex = -1;
    this.completedStepDurations = [];
    
    // Reinitialize rows
    this.rows = [];
    for (let i = 0; i < this.totalRows; i++) {
      this.rows.push(this.createTrackedRow(i));
    }
  }

  /**
   * Dispose of tracker resources
   */
  public dispose(): void {
    this.stopPeriodicUpdates();
    this.listeners.clear();
    this.rows = [];
    this.completedStepDurations = [];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ProgressTracker instance
 * 
 * @param totalRows - Number of rows (1 for non-CSV tests)
 * @param stepsPerRow - Number of steps per row
 * @param config - Optional configuration
 * @returns Configured ProgressTracker
 */
export function createProgressTracker(
  totalRows: number,
  stepsPerRow: number,
  config?: Partial<ProgressTrackerConfig>
): ProgressTracker {
  return new ProgressTracker(totalRows, stepsPerRow, config);
}
