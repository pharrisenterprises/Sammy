/**
 * OrchestratorMetrics - Performance metrics for test orchestration
 * @module core/orchestrator/OrchestratorMetrics
 * @version 1.0.0
 * 
 * Tracks and analyzes orchestrator performance including:
 * - Execution timing (total, per-row, per-step)
 * - Success/failure rates
 * - Performance statistics
 * - Trend analysis
 * 
 * @see test-orchestrator_breakdown.md for context
 * @see TestOrchestrator.ts for main orchestrator
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Timing measurement for a single operation
 */
export interface TimingMeasurement {
  /** Operation identifier */
  id: string;
  /** Operation name */
  name: string;
  /** Start time (ms since epoch) */
  startTime: number;
  /** End time (ms since epoch) */
  endTime: number;
  /** Duration (ms) */
  duration: number;
  /** Whether operation was successful */
  success: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Step timing record
 */
export interface StepTiming {
  /** Step index */
  stepIndex: number;
  /** Step label */
  label: string;
  /** Row index (for CSV execution) */
  rowIndex: number;
  /** Duration (ms) */
  duration: number;
  /** Whether step passed */
  success: boolean;
  /** Retry count */
  retryCount: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Row timing record
 */
export interface RowTiming {
  /** Row index */
  rowIndex: number;
  /** Row identifier (CSV key values) */
  rowId: string;
  /** Total duration (ms) */
  duration: number;
  /** Steps passed */
  stepsPassed: number;
  /** Steps failed */
  stepsFailed: number;
  /** Steps skipped */
  stepsSkipped: number;
  /** Whether row passed (all steps passed) */
  success: boolean;
}

/**
 * Execution timing record
 */
export interface ExecutionTiming {
  /** Execution ID */
  executionId: string;
  /** Project ID */
  projectId: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Total duration (ms) */
  duration: number;
  /** Pause duration (ms) */
  pauseDuration: number;
  /** Active duration (excluding pauses) */
  activeDuration: number;
  /** Rows processed */
  rowsProcessed: number;
  /** Steps executed */
  stepsExecuted: number;
  /** Steps passed */
  stepsPassed: number;
  /** Steps failed */
  stepsFailed: number;
  /** Steps skipped */
  stepsSkipped: number;
  /** Overall success */
  success: boolean;
  /** Whether was stopped */
  wasStopped: boolean;
}

/**
 * Statistics summary
 */
export interface Statistics {
  /** Number of samples */
  count: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Mean/average value */
  mean: number;
  /** Median value (p50) */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Sum of all values */
  sum: number;
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  /** Total executions tracked */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Step statistics */
  stepDuration: Statistics;
  /** Row statistics */
  rowDuration: Statistics;
  /** Execution statistics */
  executionDuration: Statistics;
  /** Average steps per second */
  averageStepsPerSecond: number;
  /** Total steps executed */
  totalStepsExecuted: number;
  /** Total rows processed */
  totalRowsProcessed: number;
  /** Most failed step (by failure count) */
  mostFailedStep?: { label: string; failureCount: number };
  /** Slowest step (by average duration) */
  slowestStep?: { label: string; averageDuration: number };
}

/**
 * Step performance analysis
 */
export interface StepPerformance {
  /** Step label */
  label: string;
  /** Times executed */
  executionCount: number;
  /** Times passed */
  passCount: number;
  /** Times failed */
  failCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Duration statistics */
  durationStats: Statistics;
  /** Average retry count */
  averageRetries: number;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Enable metrics collection. Default: true */
  enabled: boolean;
  /** Max step timings to keep. Default: 10000 */
  maxStepTimings: number;
  /** Max row timings to keep. Default: 1000 */
  maxRowTimings: number;
  /** Max execution timings to keep. Default: 100 */
  maxExecutionTimings: number;
  /** Track individual step timings. Default: true */
  trackStepTimings: boolean;
  /** Track individual row timings. Default: true */
  trackRowTimings: boolean;
}

/**
 * Metrics event types
 */
export type MetricsEventType =
  | 'step_recorded'
  | 'row_recorded'
  | 'execution_recorded'
  | 'metrics_reset';

/**
 * Metrics event
 */
export interface MetricsEvent {
  type: MetricsEventType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Metrics event listener
 */
export type MetricsEventListener = (event: MetricsEvent) => void;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  maxStepTimings: 10000,
  maxRowTimings: 1000,
  maxExecutionTimings: 100,
  trackStepTimings: true,
  trackRowTimings: true,
};

// ============================================================================
// CIRCULAR BUFFER
// ============================================================================

/**
 * Memory-efficient circular buffer for metrics history
 */
class CircularBuffer<T> {
  private buffer: T[];
  private maxSize: number;
  private head: number = 0;
  private count: number = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  getAll(): T[] {
    if (this.count === 0) return [];
    if (this.count < this.maxSize) {
      return this.buffer.slice(0, this.count);
    }
    // Buffer is full - return in order (oldest to newest)
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ];
  }

  getLast(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.count = 0;
  }
}

// ============================================================================
// ORCHESTRATOR METRICS CLASS
// ============================================================================

/**
 * OrchestratorMetrics - Track and analyze orchestrator performance
 * 
 * @example
 * ```typescript
 * const metrics = new OrchestratorMetrics();
 * 
 * // Record step timing
 * metrics.recordStep({
 *   stepIndex: 0,
 *   label: 'Fill Name',
 *   rowIndex: 0,
 *   duration: 150,
 *   success: true,
 *   retryCount: 0,
 * });
 * 
 * // Get performance summary
 * const summary = metrics.getPerformanceSummary();
 * console.log(`Success rate: ${summary.successRate * 100}%`);
 * console.log(`Avg step duration: ${summary.stepDuration.mean}ms`);
 * ```
 */
export class OrchestratorMetrics {
  private config: MetricsConfig;

  // Circular buffers for memory efficiency
  private stepTimings: CircularBuffer<StepTiming>;
  private rowTimings: CircularBuffer<RowTiming>;
  private executionTimings: CircularBuffer<ExecutionTiming>;

  // Active execution tracking
  private currentExecutionId: string | null = null;
  private currentExecutionStart: Date | null = null;
  private currentPauseStart: Date | null = null;
  private currentPauseDuration: number = 0;

  // Aggregated step performance
  private stepPerformanceMap: Map<string, {
    executionCount: number;
    passCount: number;
    failCount: number;
    totalDuration: number;
    totalRetries: number;
    durations: number[];
  }> = new Map();

  // Event listeners
  private listeners: Set<MetricsEventListener> = new Set();

  /**
   * Create a new OrchestratorMetrics instance
   */
  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };

    this.stepTimings = new CircularBuffer(this.config.maxStepTimings);
    this.rowTimings = new CircularBuffer(this.config.maxRowTimings);
    this.executionTimings = new CircularBuffer(this.config.maxExecutionTimings);
  }

  // ==========================================================================
  // RECORDING METHODS
  // ==========================================================================

  /**
   * Start tracking an execution
   */
  public startExecution(executionId: string, projectId: number): void {
    if (!this.config.enabled) return;

    this.currentExecutionId = executionId;
    this.currentExecutionStart = new Date();
    this.currentPauseDuration = 0;
    this.currentPauseStart = null;
  }

  /**
   * Record pause start
   */
  public recordPauseStart(): void {
    if (!this.config.enabled) return;
    this.currentPauseStart = new Date();
  }

  /**
   * Record pause end
   */
  public recordPauseEnd(): void {
    if (!this.config.enabled || !this.currentPauseStart) return;

    this.currentPauseDuration += Date.now() - this.currentPauseStart.getTime();
    this.currentPauseStart = null;
  }

  /**
   * Record a step timing
   */
  public recordStep(timing: StepTiming): void {
    if (!this.config.enabled || !this.config.trackStepTimings) return;

    this.stepTimings.push(timing);

    // Update step performance map
    this.updateStepPerformance(timing);

    // Emit event
    this.emitEvent({
      type: 'step_recorded',
      timestamp: new Date(),
      data: { stepIndex: timing.stepIndex, label: timing.label, success: timing.success },
    });
  }

  /**
   * Record a row timing
   */
  public recordRow(timing: RowTiming): void {
    if (!this.config.enabled || !this.config.trackRowTimings) return;

    this.rowTimings.push(timing);

    // Emit event
    this.emitEvent({
      type: 'row_recorded',
      timestamp: new Date(),
      data: { rowIndex: timing.rowIndex, success: timing.success },
    });
  }

  /**
   * End tracking an execution and record final timing
   */
  public endExecution(
    projectId: number,
    result: {
      rowsProcessed: number;
      stepsExecuted: number;
      stepsPassed: number;
      stepsFailed: number;
      stepsSkipped: number;
      success: boolean;
      wasStopped: boolean;
    }
  ): ExecutionTiming | null {
    if (!this.config.enabled || !this.currentExecutionId || !this.currentExecutionStart) {
      return null;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - this.currentExecutionStart.getTime();
    const activeDuration = duration - this.currentPauseDuration;

    const timing: ExecutionTiming = {
      executionId: this.currentExecutionId,
      projectId,
      startTime: this.currentExecutionStart,
      endTime,
      duration,
      pauseDuration: this.currentPauseDuration,
      activeDuration,
      ...result,
    };

    this.executionTimings.push(timing);

    // Reset current execution
    this.currentExecutionId = null;
    this.currentExecutionStart = null;
    this.currentPauseDuration = 0;
    this.currentPauseStart = null;

    // Emit event
    this.emitEvent({
      type: 'execution_recorded',
      timestamp: new Date(),
      data: { executionId: timing.executionId, success: timing.success },
    });

    return timing;
  }

  // ==========================================================================
  // STATISTICS CALCULATION
  // ==========================================================================

  /**
   * Calculate statistics for an array of numbers
   */
  public calculateStatistics(values: number[]): Statistics {
    if (values.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        sum: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Standard deviation
    const squaredDiffs = sorted.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Percentiles
    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, Math.min(index, count - 1))];
    };

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: percentile(50),
      stdDev,
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      sum,
    };
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get all step timings
   */
  public getStepTimings(): StepTiming[] {
    return this.stepTimings.getAll();
  }

  /**
   * Get recent step timings
   */
  public getRecentStepTimings(count: number): StepTiming[] {
    return this.stepTimings.getLast(count);
  }

  /**
   * Get all row timings
   */
  public getRowTimings(): RowTiming[] {
    return this.rowTimings.getAll();
  }

  /**
   * Get recent row timings
   */
  public getRecentRowTimings(count: number): RowTiming[] {
    return this.rowTimings.getLast(count);
  }

  /**
   * Get all execution timings
   */
  public getExecutionTimings(): ExecutionTiming[] {
    return this.executionTimings.getAll();
  }

  /**
   * Get recent execution timings
   */
  public getRecentExecutionTimings(count: number): ExecutionTiming[] {
    return this.executionTimings.getLast(count);
  }

  /**
   * Get step performance by label
   */
  public getStepPerformance(label: string): StepPerformance | null {
    const perf = this.stepPerformanceMap.get(label);
    if (!perf) return null;

    return {
      label,
      executionCount: perf.executionCount,
      passCount: perf.passCount,
      failCount: perf.failCount,
      successRate: perf.executionCount > 0 
        ? perf.passCount / perf.executionCount 
        : 0,
      durationStats: this.calculateStatistics(perf.durations),
      averageRetries: perf.executionCount > 0
        ? perf.totalRetries / perf.executionCount
        : 0,
    };
  }

  /**
   * Get all step performances
   */
  public getAllStepPerformances(): StepPerformance[] {
    const performances: StepPerformance[] = [];

    for (const label of this.stepPerformanceMap.keys()) {
      const perf = this.getStepPerformance(label);
      if (perf) performances.push(perf);
    }

    return performances.sort((a, b) => b.executionCount - a.executionCount);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): PerformanceSummary {
    const executions = this.executionTimings.getAll();
    const steps = this.stepTimings.getAll();
    const rows = this.rowTimings.getAll();

    const successfulExecutions = executions.filter(e => e.success).length;
    const totalExecutions = executions.length;

    // Step performance analysis
    const stepPerformances = this.getAllStepPerformances();
    const mostFailedStep = stepPerformances
      .filter(s => s.failCount > 0)
      .sort((a, b) => b.failCount - a.failCount)[0];
    const slowestStep = stepPerformances
      .filter(s => s.executionCount > 0)
      .sort((a, b) => b.durationStats.mean - a.durationStats.mean)[0];

    // Total steps per second
    const totalActiveDuration = executions.reduce((sum, e) => sum + e.activeDuration, 0);
    const totalStepsExecuted = executions.reduce((sum, e) => sum + e.stepsExecuted, 0);
    const averageStepsPerSecond = totalActiveDuration > 0
      ? (totalStepsExecuted / totalActiveDuration) * 1000
      : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions: totalExecutions - successfulExecutions,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      stepDuration: this.calculateStatistics(steps.map(s => s.duration)),
      rowDuration: this.calculateStatistics(rows.map(r => r.duration)),
      executionDuration: this.calculateStatistics(executions.map(e => e.duration)),
      averageStepsPerSecond,
      totalStepsExecuted,
      totalRowsProcessed: executions.reduce((sum, e) => sum + e.rowsProcessed, 0),
      mostFailedStep: mostFailedStep
        ? { label: mostFailedStep.label, failureCount: mostFailedStep.failCount }
        : undefined,
      slowestStep: slowestStep
        ? { label: slowestStep.label, averageDuration: slowestStep.durationStats.mean }
        : undefined,
    };
  }

  /**
   * Get success rate for recent executions
   */
  public getRecentSuccessRate(count: number = 10): number {
    const recent = this.executionTimings.getLast(count);
    if (recent.length === 0) return 0;

    const successful = recent.filter(e => e.success).length;
    return successful / recent.length;
  }

  /**
   * Get average step duration for recent steps
   */
  public getRecentAverageStepDuration(count: number = 100): number {
    const recent = this.stepTimings.getLast(count);
    if (recent.length === 0) return 0;

    const sum = recent.reduce((total, s) => total + s.duration, 0);
    return sum / recent.length;
  }

  /**
   * Get step failure rate by label
   */
  public getStepFailureRate(label: string): number {
    const perf = this.stepPerformanceMap.get(label);
    if (!perf || perf.executionCount === 0) return 0;

    return perf.failCount / perf.executionCount;
  }

  /**
   * Get steps sorted by failure rate (descending)
   */
  public getStepsByFailureRate(): Array<{ label: string; failureRate: number }> {
    const performances = this.getAllStepPerformances();

    return performances
      .map(p => ({
        label: p.label,
        failureRate: 1 - p.successRate,
      }))
      .filter(p => p.failureRate > 0)
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Get steps sorted by average duration (descending)
   */
  public getStepsByDuration(): Array<{ label: string; averageDuration: number }> {
    const performances = this.getAllStepPerformances();

    return performances
      .map(p => ({
        label: p.label,
        averageDuration: p.durationStats.mean,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration);
  }

  // ==========================================================================
  // EXPORT METHODS
  // ==========================================================================

  /**
   * Export metrics to JSON
   */
  public exportToJson(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      summary: this.getPerformanceSummary(),
      stepPerformances: this.getAllStepPerformances(),
      recentExecutions: this.getRecentExecutionTimings(10),
    }, null, 2);
  }

  /**
   * Export step timings to CSV format
   */
  public exportStepTimingsToCsv(): string {
    const timings = this.stepTimings.getAll();
    const headers = ['stepIndex', 'label', 'rowIndex', 'duration', 'success', 'retryCount', 'error'];
    
    const rows = timings.map(t => [
      t.stepIndex,
      `"${t.label.replace(/"/g, '""')}"`,
      t.rowIndex,
      t.duration,
      t.success,
      t.retryCount,
      t.error ? `"${t.error.replace(/"/g, '""')}"` : '',
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Export execution timings to CSV format
   */
  public exportExecutionTimingsToCsv(): string {
    const timings = this.executionTimings.getAll();
    const headers = [
      'executionId', 'projectId', 'startTime', 'endTime', 'duration',
      'activeDuration', 'rowsProcessed', 'stepsExecuted', 'stepsPassed',
      'stepsFailed', 'stepsSkipped', 'success', 'wasStopped'
    ];

    const rows = timings.map(t => [
      t.executionId,
      t.projectId,
      t.startTime.toISOString(),
      t.endTime.toISOString(),
      t.duration,
      t.activeDuration,
      t.rowsProcessed,
      t.stepsExecuted,
      t.stepsPassed,
      t.stepsFailed,
      t.stepsSkipped,
      t.success,
      t.wasStopped,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Update step performance map
   */
  private updateStepPerformance(timing: StepTiming): void {
    let perf = this.stepPerformanceMap.get(timing.label);

    if (!perf) {
      perf = {
        executionCount: 0,
        passCount: 0,
        failCount: 0,
        totalDuration: 0,
        totalRetries: 0,
        durations: [],
      };
      this.stepPerformanceMap.set(timing.label, perf);
    }

    perf.executionCount++;
    perf.totalDuration += timing.duration;
    perf.totalRetries += timing.retryCount;
    perf.durations.push(timing.duration);

    // Keep durations array bounded
    if (perf.durations.length > 1000) {
      perf.durations = perf.durations.slice(-1000);
    }

    if (timing.success) {
      perf.passCount++;
    } else {
      perf.failCount++;
    }
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to metrics events
   */
  public onEvent(listener: MetricsEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Unsubscribe from events
   */
  public offEvent(listener: MetricsEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit metrics event
   */
  private emitEvent(event: MetricsEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[OrchestratorMetrics] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // MANAGEMENT
  // ==========================================================================

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.stepTimings.clear();
    this.rowTimings.clear();
    this.executionTimings.clear();
    this.stepPerformanceMap.clear();

    this.currentExecutionId = null;
    this.currentExecutionStart = null;
    this.currentPauseDuration = 0;
    this.currentPauseStart = null;

    this.emitEvent({
      type: 'metrics_reset',
      timestamp: new Date(),
    });
  }

  /**
   * Get configuration
   */
  public getConfig(): MetricsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MetricsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if metrics collection is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable metrics collection
   */
  public enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable metrics collection
   */
  public disable(): void {
    this.config.enabled = false;
  }

  /**
   * Get counts for each buffer
   */
  public getCounts(): { steps: number; rows: number; executions: number } {
    return {
      steps: this.stepTimings.size(),
      rows: this.rowTimings.size(),
      executions: this.executionTimings.size(),
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an OrchestratorMetrics instance
 */
export function createOrchestratorMetrics(
  config?: Partial<MetricsConfig>
): OrchestratorMetrics {
  return new OrchestratorMetrics(config);
}
