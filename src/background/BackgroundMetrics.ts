/**
 * BackgroundMetrics - Performance metrics for background service
 * @module background/BackgroundMetrics
 * @version 1.0.0
 * 
 * Tracks and reports background service performance:
 * - Message handling latency and throughput
 * - Operation counts by type
 * - Error rates and patterns
 * - Service uptime and health
 * - Memory usage estimates
 * 
 * @see background-service_breakdown.md for telemetry requirements
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Operation timing entry
 */
export interface TimingEntry {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Operation statistics
 */
export interface OperationStats {
  count: number;
  successCount: number;
  errorCount: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecution: Date | null;
}

/**
 * Message metrics
 */
export interface MessageMetrics {
  totalReceived: number;
  totalProcessed: number;
  totalErrors: number;
  byAction: Map<string, OperationStats>;
  avgProcessingTime: number;
}

/**
 * Service health metrics
 */
export interface HealthMetrics {
  uptime: number;
  startedAt: Date | null;
  lastActivity: Date | null;
  isHealthy: boolean;
  healthScore: number; // 0-100
  warnings: string[];
}

/**
 * Resource metrics
 */
export interface ResourceMetrics {
  estimatedMemoryMB: number;
  trackedTabsCount: number;
  activeOperations: number;
  pendingMessages: number;
}

/**
 * Complete metrics snapshot
 */
export interface MetricsSnapshot {
  timestamp: Date;
  messages: MessageMetrics;
  health: HealthMetrics;
  resources: ResourceMetrics;
  operations: Record<string, OperationStats>;
  recentTimings: TimingEntry[];
  errors: ErrorEntry[];
}

/**
 * Error entry
 */
export interface ErrorEntry {
  timestamp: Date;
  operation: string;
  message: string;
  stack?: string;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  enabled: boolean;
  maxTimingEntries: number;
  maxErrorEntries: number;
  healthCheckThresholds: {
    errorRateWarning: number;    // Percentage
    errorRateCritical: number;
    avgLatencyWarning: number;   // ms
    avgLatencyCritical: number;
  };
  snapshotInterval: number;     // ms, 0 to disable
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  maxTimingEntries: 100,
  maxErrorEntries: 50,
  healthCheckThresholds: {
    errorRateWarning: 5,       // 5% error rate warning
    errorRateCritical: 15,     // 15% error rate critical
    avgLatencyWarning: 500,    // 500ms avg latency warning
    avgLatencyCritical: 2000,  // 2s avg latency critical
  },
  snapshotInterval: 0, // Disabled by default
};

/**
 * Metrics event types
 */
export type MetricsEventType =
  | 'operation_start'
  | 'operation_complete'
  | 'operation_error'
  | 'health_warning'
  | 'health_critical'
  | 'snapshot_created';

/**
 * Metrics event
 */
export interface MetricsEvent {
  type: MetricsEventType;
  timestamp: Date;
  operation?: string;
  duration?: number;
  error?: string;
  healthScore?: number;
}

/**
 * Metrics event listener
 */
export type MetricsEventListener = (event: MetricsEvent) => void;

// ============================================================================
// BACKGROUND METRICS CLASS
// ============================================================================

/**
 * BackgroundMetrics - Tracks background service performance
 * 
 * @example
 * ```typescript
 * const metrics = new BackgroundMetrics();
 * 
 * // Track an operation
 * const timer = metrics.startOperation('add_project');
 * try {
 *   await doOperation();
 *   timer.success();
 * } catch (error) {
 *   timer.error(error);
 * }
 * 
 * // Get snapshot
 * const snapshot = metrics.getSnapshot();
 * console.log('Error rate:', snapshot.health.healthScore);
 * ```
 */
export class BackgroundMetrics {
  private config: MetricsConfig;

  // Timing data
  private timingEntries: TimingEntry[] = [];
  private activeOperations: Map<string, number> = new Map();

  // Message counters
  private messageCounters = {
    received: 0,
    processed: 0,
    errors: 0,
  };

  // Operation stats by action
  private operationStats: Map<string, OperationStats> = new Map();

  // Error log
  private errorEntries: ErrorEntry[] = [];

  // Service state
  private startedAt: Date | null = null;
  private lastActivity: Date | null = null;
  private trackedTabsCount: number = 0;
  private pendingMessagesCount: number = 0;

  // Snapshot interval
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;

  // Event listeners
  private eventListeners: Set<MetricsEventListener> = new Set();

  /**
   * Create BackgroundMetrics instance
   */
  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };
    this.startedAt = new Date();

    if (this.config.snapshotInterval > 0) {
      this.startSnapshotInterval();
    }
  }

  // ==========================================================================
  // OPERATION TRACKING
  // ==========================================================================

  /**
   * Start tracking an operation
   * Returns a timer object with success/error methods
   */
  public startOperation(operation: string): OperationTimer {
    if (!this.config.enabled) {
      return this.createNoOpTimer();
    }

    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    const startTime = performance.now();

    this.activeOperations.set(operationId, startTime);
    this.lastActivity = new Date();

    this.emitEvent({
      type: 'operation_start',
      timestamp: new Date(),
      operation,
    });

    return {
      success: () => this.completeOperation(operationId, operation, startTime, true),
      error: (error?: unknown) => this.completeOperation(operationId, operation, startTime, false, error),
    };
  }

  /**
   * Complete an operation
   */
  private completeOperation(
    operationId: string,
    operation: string,
    startTime: number,
    success: boolean,
    error?: unknown
  ): void {
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.activeOperations.delete(operationId);

    // Record timing
    const entry: TimingEntry = {
      operation,
      startTime,
      endTime,
      duration,
      success,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
    };

    this.addTimingEntry(entry);

    // Update stats
    this.updateOperationStats(operation, duration, success);

    // Update counters
    this.messageCounters.processed++;
    if (!success) {
      this.messageCounters.errors++;
      this.addError(operation, error);
    }

    // Emit event
    this.emitEvent({
      type: success ? 'operation_complete' : 'operation_error',
      timestamp: new Date(),
      operation,
      duration,
      error: entry.error,
    });

    // Check health
    this.checkHealth();
  }

  /**
   * Create a no-op timer for when metrics are disabled
   */
  private createNoOpTimer(): OperationTimer {
    return {
      success: () => {},
      error: () => {},
    };
  }

  // ==========================================================================
  // MESSAGE TRACKING
  // ==========================================================================

  /**
   * Record a message received
   */
  public recordMessageReceived(action?: string): void {
    if (!this.config.enabled) return;

    this.messageCounters.received++;
    this.lastActivity = new Date();

    if (action) {
      this.ensureOperationStats(action);
    }
  }

  /**
   * Record a message error (without timing)
   */
  public recordError(operation: string, error: unknown): void {
    if (!this.config.enabled) return;

    this.messageCounters.errors++;
    this.addError(operation, error);
    this.updateOperationStats(operation, 0, false);

    this.emitEvent({
      type: 'operation_error',
      timestamp: new Date(),
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ==========================================================================
  // RESOURCE TRACKING
  // ==========================================================================

  /**
   * Update tracked tabs count
   */
  public setTrackedTabsCount(count: number): void {
    this.trackedTabsCount = count;
  }

  /**
   * Update pending messages count
   */
  public setPendingMessagesCount(count: number): void {
    this.pendingMessagesCount = count;
  }

  // ==========================================================================
  // STATISTICS MANAGEMENT
  // ==========================================================================

  /**
   * Ensure operation stats exist for an action
   */
  private ensureOperationStats(action: string): OperationStats {
    let stats = this.operationStats.get(action);
    if (!stats) {
      stats = {
        count: 0,
        successCount: 0,
        errorCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastExecution: null,
      };
      this.operationStats.set(action, stats);
    }
    return stats;
  }

  /**
   * Update operation statistics
   */
  private updateOperationStats(operation: string, duration: number, success: boolean): void {
    const stats = this.ensureOperationStats(operation);

    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.lastExecution = new Date();

    if (duration > 0) {
      stats.minDuration = Math.min(stats.minDuration, duration);
      stats.maxDuration = Math.max(stats.maxDuration, duration);
    }

    if (success) {
      stats.successCount++;
    } else {
      stats.errorCount++;
    }
  }

  /**
   * Add timing entry (with limit)
   */
  private addTimingEntry(entry: TimingEntry): void {
    this.timingEntries.push(entry);

    // Trim to max entries
    if (this.timingEntries.length > this.config.maxTimingEntries) {
      this.timingEntries = this.timingEntries.slice(-this.config.maxTimingEntries);
    }
  }

  /**
   * Add error entry (with limit)
   */
  private addError(operation: string, error: unknown): void {
    const entry: ErrorEntry = {
      timestamp: new Date(),
      operation,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    this.errorEntries.push(entry);

    // Trim to max entries
    if (this.errorEntries.length > this.config.maxErrorEntries) {
      this.errorEntries = this.errorEntries.slice(-this.config.maxErrorEntries);
    }
  }

  // ==========================================================================
  // HEALTH MONITORING
  // ==========================================================================

  /**
   * Calculate health score (0-100)
   */
  public calculateHealthScore(): number {
    const { processed, errors } = this.messageCounters;

    if (processed === 0) {
      return 100; // No operations yet
    }

    // Error rate component (50% of score)
    const errorRate = (errors / processed) * 100;
    let errorScore = 50;
    if (errorRate >= this.config.healthCheckThresholds.errorRateCritical) {
      errorScore = 0;
    } else if (errorRate >= this.config.healthCheckThresholds.errorRateWarning) {
      errorScore = 25;
    }

    // Latency component (50% of score)
    const avgLatency = this.calculateAverageLatency();
    let latencyScore = 50;
    if (avgLatency >= this.config.healthCheckThresholds.avgLatencyCritical) {
      latencyScore = 0;
    } else if (avgLatency >= this.config.healthCheckThresholds.avgLatencyWarning) {
      latencyScore = 25;
    }

    return errorScore + latencyScore;
  }

  /**
   * Calculate average latency from recent operations
   */
  private calculateAverageLatency(): number {
    if (this.timingEntries.length === 0) {
      return 0;
    }

    const total = this.timingEntries.reduce((sum, entry) => sum + entry.duration, 0);
    return total / this.timingEntries.length;
  }

  /**
   * Get health warnings
   */
  private getHealthWarnings(): string[] {
    const warnings: string[] = [];
    const { processed, errors } = this.messageCounters;

    if (processed > 0) {
      const errorRate = (errors / processed) * 100;
      if (errorRate >= this.config.healthCheckThresholds.errorRateCritical) {
        warnings.push(`Critical error rate: ${errorRate.toFixed(1)}%`);
      } else if (errorRate >= this.config.healthCheckThresholds.errorRateWarning) {
        warnings.push(`High error rate: ${errorRate.toFixed(1)}%`);
      }
    }

    const avgLatency = this.calculateAverageLatency();
    if (avgLatency >= this.config.healthCheckThresholds.avgLatencyCritical) {
      warnings.push(`Critical latency: ${avgLatency.toFixed(0)}ms avg`);
    } else if (avgLatency >= this.config.healthCheckThresholds.avgLatencyWarning) {
      warnings.push(`High latency: ${avgLatency.toFixed(0)}ms avg`);
    }

    if (this.activeOperations.size > 10) {
      warnings.push(`Many active operations: ${this.activeOperations.size}`);
    }

    return warnings;
  }

  /**
   * Check health and emit warnings
   */
  private checkHealth(): void {
    const healthScore = this.calculateHealthScore();

    if (healthScore < 50) {
      this.emitEvent({
        type: 'health_critical',
        timestamp: new Date(),
        healthScore,
      });
    } else if (healthScore < 75) {
      this.emitEvent({
        type: 'health_warning',
        timestamp: new Date(),
        healthScore,
      });
    }
  }

  // ==========================================================================
  // SNAPSHOT AND EXPORT
  // ==========================================================================

  /**
   * Get complete metrics snapshot
   */
  public getSnapshot(): MetricsSnapshot {
    const healthScore = this.calculateHealthScore();
    const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : 0;

    // Convert operation stats to record
    const operations: Record<string, OperationStats> = {};
    this.operationStats.forEach((stats, action) => {
      operations[action] = { ...stats };
    });

    return {
      timestamp: new Date(),
      messages: {
        totalReceived: this.messageCounters.received,
        totalProcessed: this.messageCounters.processed,
        totalErrors: this.messageCounters.errors,
        byAction: new Map(this.operationStats),
        avgProcessingTime: this.calculateAverageLatency(),
      },
      health: {
        uptime,
        startedAt: this.startedAt,
        lastActivity: this.lastActivity,
        isHealthy: healthScore >= 75,
        healthScore,
        warnings: this.getHealthWarnings(),
      },
      resources: {
        estimatedMemoryMB: this.estimateMemoryUsage(),
        trackedTabsCount: this.trackedTabsCount,
        activeOperations: this.activeOperations.size,
        pendingMessages: this.pendingMessagesCount,
      },
      operations,
      recentTimings: [...this.timingEntries],
      errors: [...this.errorEntries],
    };
  }

  /**
   * Estimate memory usage (rough)
   */
  private estimateMemoryUsage(): number {
    const timingsSize = this.timingEntries.length * 100; // ~100 bytes per entry
    const errorsSize = this.errorEntries.length * 500;   // ~500 bytes per error
    const statsSize = this.operationStats.size * 200;    // ~200 bytes per stat

    return (timingsSize + errorsSize + statsSize) / (1024 * 1024);
  }

  /**
   * Export snapshot as JSON-serializable object
   */
  public exportSnapshot(): Record<string, unknown> {
    const snapshot = this.getSnapshot();

    return {
      timestamp: snapshot.timestamp.toISOString(),
      messages: {
        totalReceived: snapshot.messages.totalReceived,
        totalProcessed: snapshot.messages.totalProcessed,
        totalErrors: snapshot.messages.totalErrors,
        avgProcessingTime: snapshot.messages.avgProcessingTime,
        byAction: Object.fromEntries(snapshot.messages.byAction),
      },
      health: {
        ...snapshot.health,
        startedAt: snapshot.health.startedAt?.toISOString() ?? null,
        lastActivity: snapshot.health.lastActivity?.toISOString() ?? null,
      },
      resources: snapshot.resources,
      operations: snapshot.operations,
      recentTimings: snapshot.recentTimings.map(t => ({
        ...t,
        error: t.error ?? null,
      })),
      errors: snapshot.errors.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
    };
  }

  // ==========================================================================
  // SNAPSHOT INTERVAL
  // ==========================================================================

  /**
   * Start automatic snapshot interval
   */
  private startSnapshotInterval(): void {
    if (this.config.snapshotInterval > 0) {
      this.snapshotInterval = setInterval(() => {
        this.emitEvent({
          type: 'snapshot_created',
          timestamp: new Date(),
          healthScore: this.calculateHealthScore(),
        });
      }, this.config.snapshotInterval);
    }
  }

  /**
   * Stop snapshot interval
   */
  private stopSnapshotInterval(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.timingEntries = [];
    this.activeOperations.clear();
    this.messageCounters = { received: 0, processed: 0, errors: 0 };
    this.operationStats.clear();
    this.errorEntries = [];
    this.startedAt = new Date();
    this.lastActivity = null;
    this.trackedTabsCount = 0;
    this.pendingMessagesCount = 0;
  }

  /**
   * Destroy metrics instance
   */
  public destroy(): void {
    this.stopSnapshotInterval();
    this.eventListeners.clear();
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to metrics events
   */
  public onEvent(listener: MetricsEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit metrics event
   */
  private emitEvent(event: MetricsEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[BackgroundMetrics] Event listener error:', error);
      }
    });
  }

  // ==========================================================================
  // ACCESSORS
  // ==========================================================================

  /**
   * Get config
   */
  public getConfig(): MetricsConfig {
    return { ...this.config };
  }

  /**
   * Get message counters
   */
  public getMessageCounters(): typeof this.messageCounters {
    return { ...this.messageCounters };
  }

  /**
   * Get operation stats for specific action
   */
  public getOperationStats(action: string): OperationStats | undefined {
    const stats = this.operationStats.get(action);
    return stats ? { ...stats } : undefined;
  }

  /**
   * Get all operation names
   */
  public getTrackedOperations(): string[] {
    return Array.from(this.operationStats.keys());
  }

  /**
   * Get recent errors
   */
  public getRecentErrors(limit: number = 10): ErrorEntry[] {
    return this.errorEntries.slice(-limit);
  }

  /**
   * Get active operation count
   */
  public getActiveOperationCount(): number {
    return this.activeOperations.size;
  }

  /**
   * Check if metrics are enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// OPERATION TIMER TYPE
// ============================================================================

/**
 * Timer returned by startOperation
 */
export interface OperationTimer {
  success: () => void;
  error: (error?: unknown) => void;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create BackgroundMetrics instance
 */
export function createBackgroundMetrics(
  config?: Partial<MetricsConfig>
): BackgroundMetrics {
  return new BackgroundMetrics(config);
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let metricsInstance: BackgroundMetrics | null = null;

/**
 * Get singleton metrics instance
 */
export function getBackgroundMetrics(config?: Partial<MetricsConfig>): BackgroundMetrics {
  if (!metricsInstance) {
    metricsInstance = new BackgroundMetrics(config);
  }
  return metricsInstance;
}

/**
 * Reset singleton instance
 */
export function resetBackgroundMetrics(): void {
  if (metricsInstance) {
    metricsInstance.destroy();
    metricsInstance = null;
  }
}
