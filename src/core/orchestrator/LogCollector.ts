/**
 * LogCollector - Collects execution logs as a single string
 * @module core/orchestrator/LogCollector
 * @version 1.0.0
 * 
 * Collects timestamped log entries during test execution and outputs
 * them as a single string for storage in TestRun.logs.
 * 
 * CRITICAL: TestRun.logs is a STRING type, not string[].
 * This collector outputs newline-separated log entries.
 * 
 * @see test-orchestrator_breakdown.md for logging patterns
 * @see storage-layer_breakdown.md for TestRun schema
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Log severity levels
 */
export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'debug';

/**
 * Individual log entry
 */
export interface LogEntry {
  /** Timestamp when log was created */
  timestamp: Date;
  /** Formatted timestamp string (HH:mm:ss) */
  formattedTime: string;
  /** Log severity level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Optional context data */
  context?: Record<string, unknown>;
  /** Optional step index */
  stepIndex?: number;
  /** Optional row index */
  rowIndex?: number;
}

/**
 * Log filter options
 */
export interface LogFilter {
  /** Filter by level(s) */
  levels?: LogLevel[];
  /** Filter by step index */
  stepIndex?: number;
  /** Filter by row index */
  rowIndex?: number;
  /** Filter by time range (start) */
  after?: Date;
  /** Filter by time range (end) */
  before?: Date;
  /** Search in message text */
  search?: string;
}

/**
 * Log statistics
 */
export interface LogStats {
  /** Total log count */
  total: number;
  /** Count by level */
  byLevel: Record<LogLevel, number>;
  /** First log timestamp */
  firstLogAt?: Date;
  /** Last log timestamp */
  lastLogAt?: Date;
  /** Duration between first and last log (ms) */
  duration: number;
}

/**
 * Configuration for LogCollector
 */
export interface LogCollectorConfig {
  /** Maximum number of logs to keep (0 = unlimited). Default: 10000 */
  maxLogs: number;
  /** Include debug logs. Default: false */
  includeDebug: boolean;
  /** Include timestamp in output. Default: true */
  includeTimestamp: boolean;
  /** Include level in output. Default: true */
  includeLevel: boolean;
  /** Line separator for string output. Default: '\n' */
  lineSeparator: string;
  /** Time format function. Default: HH:mm:ss */
  formatTime: (date: Date) => string;
}

/**
 * Log event listener
 */
export type LogEventListener = (entry: LogEntry) => void;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default time formatter (HH:mm:ss)
 */
function defaultFormatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Default configuration
 */
export const DEFAULT_LOG_COLLECTOR_CONFIG: LogCollectorConfig = {
  maxLogs: 10000,
  includeDebug: false,
  includeTimestamp: true,
  includeLevel: true,
  lineSeparator: '\n',
  formatTime: defaultFormatTime,
};

// ============================================================================
// LOG COLLECTOR CLASS
// ============================================================================

/**
 * LogCollector - Collects and formats execution logs
 * 
 * @example
 * ```typescript
 * const collector = new LogCollector();
 * 
 * collector.info('Test started');
 * collector.success('Step 1 passed', { stepIndex: 0 });
 * collector.error('Step 2 failed: Element not found', { stepIndex: 1 });
 * 
 * const logsString = collector.toString();
 * // "[10:30:45] [INFO] Test started\n[10:30:46] [SUCCESS] Step 1 passed\n..."
 * ```
 */
export class LogCollector {
  private config: LogCollectorConfig;
  private entries: LogEntry[] = [];
  private listeners: Set<LogEventListener> = new Set();

  /**
   * Create a new LogCollector
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<LogCollectorConfig> = {}) {
    this.config = { ...DEFAULT_LOG_COLLECTOR_CONFIG, ...config };
  }

  // ==========================================================================
  // LOGGING METHODS
  // ==========================================================================

  /**
   * Add an info log
   */
  public info(message: string, context?: Partial<LogEntry>): void {
    this.addLog('info', message, context);
  }

  /**
   * Add a success log
   */
  public success(message: string, context?: Partial<LogEntry>): void {
    this.addLog('success', message, context);
  }

  /**
   * Add an error log
   */
  public error(message: string, context?: Partial<LogEntry>): void {
    this.addLog('error', message, context);
  }

  /**
   * Add a warning log
   */
  public warning(message: string, context?: Partial<LogEntry>): void {
    this.addLog('warning', message, context);
  }

  /**
   * Add a debug log (only if includeDebug is true)
   */
  public debug(message: string, context?: Partial<LogEntry>): void {
    if (this.config.includeDebug) {
      this.addLog('debug', message, context);
    }
  }

  /**
   * Add a log entry with specified level
   */
  public log(level: LogLevel, message: string, context?: Partial<LogEntry>): void {
    if (level === 'debug' && !this.config.includeDebug) {
      return;
    }
    this.addLog(level, message, context);
  }

  /**
   * Internal method to add a log entry
   */
  private addLog(level: LogLevel, message: string, context?: Partial<LogEntry>): void {
    const timestamp = new Date();
    
    const entry: LogEntry = {
      timestamp,
      formattedTime: this.config.formatTime(timestamp),
      level,
      message,
      context: context?.context,
      stepIndex: context?.stepIndex,
      rowIndex: context?.rowIndex,
    };

    this.entries.push(entry);

    // Enforce max logs limit
    if (this.config.maxLogs > 0 && this.entries.length > this.config.maxLogs) {
      // Remove oldest entries (keep newest)
      const overflow = this.entries.length - this.config.maxLogs;
      this.entries.splice(0, overflow);
    }

    // Notify listeners
    this.notifyListeners(entry);
  }

  // ==========================================================================
  // CONVENIENCE LOGGING METHODS
  // ==========================================================================

  /**
   * Log step started
   */
  public stepStarted(stepIndex: number, stepName: string): void {
    this.info(`Starting step ${stepIndex + 1}: ${stepName}`, { stepIndex });
  }

  /**
   * Log step completed successfully
   */
  public stepPassed(stepIndex: number, duration: number): void {
    this.success(`✓ Step ${stepIndex + 1} completed (${duration}ms)`, { stepIndex });
  }

  /**
   * Log step failed
   */
  public stepFailed(stepIndex: number, errorMessage: string): void {
    this.error(`✗ Step ${stepIndex + 1} failed: ${errorMessage}`, { stepIndex });
  }

  /**
   * Log step skipped
   */
  public stepSkipped(stepIndex: number, reason: string): void {
    this.warning(`⊘ Step ${stepIndex + 1} skipped: ${reason}`, { stepIndex });
  }

  /**
   * Log row started
   */
  public rowStarted(rowIndex: number, totalRows: number): void {
    this.info(`Starting row ${rowIndex + 1} of ${totalRows}`, { rowIndex });
  }

  /**
   * Log row completed
   */
  public rowCompleted(
    rowIndex: number,
    passed: number,
    failed: number,
    skipped: number
  ): void {
    this.info(
      `Row ${rowIndex + 1} completed: ${passed} passed, ${failed} failed, ${skipped} skipped`,
      { rowIndex }
    );
  }

  /**
   * Log execution started
   */
  public executionStarted(projectName: string, totalSteps: number, totalRows: number): void {
    this.info(`Test execution started: "${projectName}" (${totalSteps} steps, ${totalRows} rows)`);
  }

  /**
   * Log execution completed
   */
  public executionCompleted(
    passed: number,
    failed: number,
    duration: number
  ): void {
    const status = failed === 0 ? 'SUCCESS' : 'FAILED';
    this.info(`Test execution ${status}: ${passed} passed, ${failed} failed (${duration}ms)`);
  }

  /**
   * Log execution stopped
   */
  public executionStopped(): void {
    this.warning('Test execution stopped by user');
  }

  // ==========================================================================
  // OUTPUT METHODS
  // ==========================================================================

  /**
   * Get logs as a single string (for TestRun.logs)
   * 
   * CRITICAL: This is the primary output method.
   * TestRun.logs expects a single string, not an array.
   */
  public toString(): string {
    return this.entries
      .map(entry => this.formatEntry(entry))
      .join(this.config.lineSeparator);
  }

  /**
   * Get logs as a string (alias for toString)
   */
  public getLogsString(): string {
    return this.toString();
  }

  /**
   * Format a single log entry
   */
  private formatEntry(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(`[${entry.formattedTime}]`);
    }

    if (this.config.includeLevel) {
      parts.push(`[${entry.level.toUpperCase()}]`);
    }

    parts.push(entry.message);

    return parts.join(' ');
  }

  /**
   * Get all log entries as array
   */
  public getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get filtered log entries
   */
  public getFilteredEntries(filter: LogFilter): LogEntry[] {
    return this.entries.filter(entry => {
      // Filter by levels
      if (filter.levels && !filter.levels.includes(entry.level)) {
        return false;
      }

      // Filter by step index
      if (filter.stepIndex !== undefined && entry.stepIndex !== filter.stepIndex) {
        return false;
      }

      // Filter by row index
      if (filter.rowIndex !== undefined && entry.rowIndex !== filter.rowIndex) {
        return false;
      }

      // Filter by time range
      if (filter.after && entry.timestamp < filter.after) {
        return false;
      }
      if (filter.before && entry.timestamp > filter.before) {
        return false;
      }

      // Filter by search text
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        if (!entry.message.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get filtered logs as string
   */
  public getFilteredLogsString(filter: LogFilter): string {
    return this.getFilteredEntries(filter)
      .map(entry => this.formatEntry(entry))
      .join(this.config.lineSeparator);
  }

  /**
   * Get logs for a specific step
   */
  public getStepLogs(stepIndex: number): string {
    return this.getFilteredLogsString({ stepIndex });
  }

  /**
   * Get logs for a specific row
   */
  public getRowLogs(rowIndex: number): string {
    return this.getFilteredLogsString({ rowIndex });
  }

  /**
   * Get only error logs
   */
  public getErrorLogs(): string {
    return this.getFilteredLogsString({ levels: ['error'] });
  }

  /**
   * Get error and warning logs
   */
  public getProblemsLogs(): string {
    return this.getFilteredLogsString({ levels: ['error', 'warning'] });
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get log statistics
   */
  public getStats(): LogStats {
    const stats: LogStats = {
      total: this.entries.length,
      byLevel: {
        info: 0,
        success: 0,
        error: 0,
        warning: 0,
        debug: 0,
      },
      duration: 0,
    };

    if (this.entries.length > 0) {
      stats.firstLogAt = this.entries[0].timestamp;
      stats.lastLogAt = this.entries[this.entries.length - 1].timestamp;
      stats.duration = stats.lastLogAt.getTime() - stats.firstLogAt.getTime();
    }

    for (const entry of this.entries) {
      stats.byLevel[entry.level]++;
    }

    return stats;
  }

  /**
   * Get count of logs by level
   */
  public getCount(level?: LogLevel): number {
    if (!level) {
      return this.entries.length;
    }
    return this.entries.filter(e => e.level === level).length;
  }

  /**
   * Check if there are any errors
   */
  public hasErrors(): boolean {
    return this.entries.some(e => e.level === 'error');
  }

  /**
   * Check if there are any warnings
   */
  public hasWarnings(): boolean {
    return this.entries.some(e => e.level === 'warning');
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  /**
   * Subscribe to new log entries
   * 
   * @param listener - Callback for new entries
   * @returns Unsubscribe function
   */
  public onLog(listener: LogEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a log listener
   */
  public offLog(listener: LogEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of new entry
   */
  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        console.error('[LogCollector] Error in listener:', error);
      }
    });
  }

  // ==========================================================================
  // MANAGEMENT
  // ==========================================================================

  /**
   * Clear all logs
   */
  public clear(): void {
    this.entries = [];
  }

  /**
   * Get current configuration
   */
  public getConfig(): LogCollectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LogCollectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the last N entries
   */
  public getLastEntries(count: number): LogEntry[] {
    const start = Math.max(0, this.entries.length - count);
    return this.entries.slice(start);
  }

  /**
   * Get the last N entries as string
   */
  public getLastLogsString(count: number): string {
    return this.getLastEntries(count)
      .map(entry => this.formatEntry(entry))
      .join(this.config.lineSeparator);
  }

  /**
   * Check if collector is empty
   */
  public isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Clone the collector (with all entries)
   */
  public clone(): LogCollector {
    const cloned = new LogCollector(this.config);
    cloned.entries = [...this.entries];
    return cloned;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a LogCollector instance
 * 
 * @param config - Optional configuration
 * @returns Configured LogCollector
 */
export function createLogCollector(
  config?: Partial<LogCollectorConfig>
): LogCollector {
  return new LogCollector(config);
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalLogCollector: LogCollector | null = null;

/**
 * Get the global LogCollector instance
 */
export function getLogCollector(): LogCollector {
  if (!globalLogCollector) {
    globalLogCollector = new LogCollector();
  }
  return globalLogCollector;
}

/**
 * Reset the global LogCollector (for testing)
 */
export function resetLogCollector(): void {
  globalLogCollector = null;
}
