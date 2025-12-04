/**
 * ErrorHandler - Handles execution errors during test runs
 * @module core/orchestrator/ErrorHandler
 * @version 1.0.0
 * 
 * Provides error classification, recovery strategies, retry logic,
 * and error aggregation for test execution.
 * 
 * @see test-orchestrator_breakdown.md for error handling patterns
 * @see replay-engine_breakdown.md for replay error scenarios
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'element_not_found'      // Element locator failed
  | 'element_not_visible'    // Element found but not visible/interactable
  | 'element_not_interactable' // Element blocked by overlay
  | 'timeout'                // Operation timed out
  | 'navigation'             // Page navigation failed
  | 'injection'              // Script injection failed
  | 'tab'                    // Tab operation failed
  | 'network'                // Network request failed
  | 'validation'             // Input validation failed
  | 'assertion'              // Test assertion failed
  | 'unknown';               // Unclassified error

/**
 * Failure policy - what to do when an error occurs
 */
export type FailurePolicy = 'continue' | 'skip' | 'abort' | 'retry';

/**
 * Structured error information
 */
export interface ExecutionError {
  /** Unique error ID */
  id: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Human-readable message */
  message: string;
  /** Original error object */
  originalError?: Error;
  /** Step index where error occurred */
  stepIndex?: number;
  /** Row index where error occurred */
  rowIndex?: number;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Whether error was recovered */
  recovered: boolean;
  /** Recovery action taken */
  recoveryAction?: string;
  /** Retry count */
  retryCount: number;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  /** Whether to continue execution */
  shouldContinue: boolean;
  /** Whether to skip current step */
  shouldSkip: boolean;
  /** Whether to retry */
  shouldRetry: boolean;
  /** Whether execution should abort */
  shouldAbort: boolean;
  /** Structured error information */
  error: ExecutionError;
  /** Recovery message */
  recoveryMessage?: string;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  /** Total errors encountered */
  total: number;
  /** Errors by category */
  byCategory: Record<ErrorCategory, number>;
  /** Errors by severity */
  bySeverity: Record<ErrorSeverity, number>;
  /** Recovered error count */
  recovered: number;
  /** Fatal error count */
  fatal: number;
  /** First error timestamp */
  firstErrorAt?: Date;
  /** Last error timestamp */
  lastErrorAt?: Date;
}

/**
 * Recovery strategy function
 */
export type RecoveryStrategy = (
  error: ExecutionError,
  context: ErrorContext
) => Promise<RecoveryResult>;

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery succeeded */
  success: boolean;
  /** Action taken */
  action: string;
  /** New value or element if recovered */
  result?: unknown;
}

/**
 * Error context for recovery
 */
export interface ErrorContext {
  /** Current step data */
  step?: unknown;
  /** Current row data */
  row?: unknown;
  /** Tab ID */
  tabId?: number;
  /** Retry attempt number */
  retryAttempt: number;
  /** Maximum retries allowed */
  maxRetries: number;
}

/**
 * Error event types
 */
export type ErrorEventType =
  | 'error_occurred'
  | 'error_recovered'
  | 'error_fatal'
  | 'retry_attempted';

/**
 * Error event payload
 */
export interface ErrorEvent {
  type: ErrorEventType;
  error: ExecutionError;
  context?: ErrorContext;
  timestamp: Date;
}

/**
 * Error event listener
 */
export type ErrorEventListener = (event: ErrorEvent) => void;

/**
 * ErrorHandler configuration
 */
export interface ErrorHandlerConfig {
  /** Default failure policy. Default: 'continue' */
  defaultPolicy: FailurePolicy;
  /** Policy per error category */
  categoryPolicies: Partial<Record<ErrorCategory, FailurePolicy>>;
  /** Maximum retries per error. Default: 2 */
  maxRetries: number;
  /** Delay between retries (ms). Default: 1000 */
  retryDelay: number;
  /** Capture screenshot on error. Default: true */
  captureScreenshot: boolean;
  /** Log errors to console. Default: true */
  logErrors: boolean;
  /** Maximum errors before force abort. Default: 50 */
  maxErrors: number;
  /** Treat warnings as errors. Default: false */
  strictMode: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  defaultPolicy: 'continue',
  categoryPolicies: {
    element_not_found: 'continue',
    element_not_visible: 'continue',
    element_not_interactable: 'retry',
    timeout: 'retry',
    navigation: 'abort',
    injection: 'abort',
    tab: 'abort',
    network: 'retry',
    validation: 'skip',
    assertion: 'continue',
    unknown: 'continue',
  },
  maxRetries: 2,
  retryDelay: 1000,
  captureScreenshot: true,
  logErrors: true,
  maxErrors: 50,
  strictMode: false,
};

// ============================================================================
// ERROR PATTERNS FOR CLASSIFICATION
// ============================================================================

/**
 * Error message patterns for classification
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory }> = [
  { pattern: /element.*not.*found/i, category: 'element_not_found' },
  { pattern: /no.*element.*found/i, category: 'element_not_found' },
  { pattern: /cannot.*find.*element/i, category: 'element_not_found' },
  { pattern: /element.*not.*visible/i, category: 'element_not_visible' },
  { pattern: /element.*hidden/i, category: 'element_not_visible' },
  { pattern: /element.*not.*interactable/i, category: 'element_not_interactable' },
  { pattern: /element.*obscured/i, category: 'element_not_interactable' },
  { pattern: /click.*intercepted/i, category: 'element_not_interactable' },
  { pattern: /timeout/i, category: 'timeout' },
  { pattern: /timed.*out/i, category: 'timeout' },
  { pattern: /navigation/i, category: 'navigation' },
  { pattern: /page.*load/i, category: 'navigation' },
  { pattern: /inject/i, category: 'injection' },
  { pattern: /script.*execution/i, category: 'injection' },
  { pattern: /tab.*not.*found/i, category: 'tab' },
  { pattern: /tab.*closed/i, category: 'tab' },
  { pattern: /network/i, category: 'network' },
  { pattern: /fetch.*failed/i, category: 'network' },
  { pattern: /connection/i, category: 'network' },
  { pattern: /validation/i, category: 'validation' },
  { pattern: /invalid/i, category: 'validation' },
  { pattern: /assertion/i, category: 'assertion' },
  { pattern: /expect/i, category: 'assertion' },
];

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

/**
 * ErrorHandler - Manages error handling during test execution
 * 
 * @example
 * ```typescript
 * const handler = new ErrorHandler();
 * 
 * try {
 *   await executeStep(step);
 * } catch (error) {
 *   const result = handler.handle(error, { stepIndex: 0 });
 *   
 *   if (result.shouldAbort) {
 *     throw new Error('Execution aborted');
 *   }
 *   
 *   if (result.shouldRetry) {
 *     // Retry the step
 *   }
 *   
 *   if (result.shouldContinue) {
 *     // Continue to next step
 *   }
 * }
 * ```
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errors: ExecutionError[] = [];
  private listeners: Set<ErrorEventListener> = new Set();
  private recoveryStrategies: Map<ErrorCategory, RecoveryStrategy> = new Map();
  private retryCounters: Map<string, number> = new Map();

  /**
   * Create a new ErrorHandler
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      ...DEFAULT_ERROR_HANDLER_CONFIG,
      ...config,
      // Deep copy categoryPolicies to prevent mutation
      categoryPolicies: {
        ...DEFAULT_ERROR_HANDLER_CONFIG.categoryPolicies,
        ...config.categoryPolicies,
      },
    };
  }

  // ==========================================================================
  // PRIMARY ERROR HANDLING
  // ==========================================================================

  /**
   * Handle an error during execution
   * 
   * @param error - Error to handle (Error object or string)
   * @param context - Error context
   * @returns Error handling result
   */
  public handle(
    error: Error | string,
    context: Partial<ErrorContext> = {}
  ): ErrorHandlingResult {
    // Create structured error
    const executionError = this.createExecutionError(error, context);
    
    // Store error
    this.errors.push(executionError);
    
    // Log if configured
    if (this.config.logErrors) {
      this.logError(executionError);
    }

    // Check max errors threshold
    if (this.errors.length >= this.config.maxErrors) {
      executionError.severity = 'fatal';
      
      this.emitEvent({
        type: 'error_fatal',
        error: executionError,
        context: context as ErrorContext,
        timestamp: new Date(),
      });

      return {
        shouldContinue: false,
        shouldSkip: false,
        shouldRetry: false,
        shouldAbort: true,
        error: executionError,
        recoveryMessage: `Maximum errors (${this.config.maxErrors}) exceeded`,
      };
    }

    // Emit error event
    this.emitEvent({
      type: 'error_occurred',
      error: executionError,
      context: context as ErrorContext,
      timestamp: new Date(),
    });

    // Get policy for this error
    const policy = this.getPolicy(executionError.category);
    
    // Handle based on policy
    return this.applyPolicy(executionError, policy, context);
  }

  /**
   * Handle error with async recovery attempt
   * 
   * @param error - Error to handle
   * @param context - Error context
   * @returns Promise resolving to handling result
   */
  public async handleWithRecovery(
    error: Error | string,
    context: Partial<ErrorContext> = {}
  ): Promise<ErrorHandlingResult> {
    const result = this.handle(error, context);
    
    // Attempt recovery if strategy exists
    const strategy = this.recoveryStrategies.get(result.error.category);
    if (strategy && !result.shouldAbort) {
      try {
        const recoveryResult = await strategy(result.error, context as ErrorContext);
        
        if (recoveryResult.success) {
          result.error.recovered = true;
          result.error.recoveryAction = recoveryResult.action;
          result.shouldContinue = true;
          result.shouldSkip = false;
          result.recoveryMessage = `Recovered via ${recoveryResult.action}`;
          
          this.emitEvent({
            type: 'error_recovered',
            error: result.error,
            context: context as ErrorContext,
            timestamp: new Date(),
          });
        }
      } catch (recoveryError) {
        // Recovery failed, keep original result
        if (this.config.logErrors) {
          console.warn('[ErrorHandler] Recovery failed:', recoveryError);
        }
      }
    }
    
    return result;
  }

  // ==========================================================================
  // ERROR CREATION & CLASSIFICATION
  // ==========================================================================

  /**
   * Create a structured execution error
   */
  private createExecutionError(
    error: Error | string,
    context: Partial<ErrorContext>
  ): ExecutionError {
    const message = typeof error === 'string' ? error : error.message;
    const originalError = typeof error === 'string' ? undefined : error;
    
    const category = this.classifyError(message);
    const severity = this.determineSeverity(category);
    
    return {
      id: this.generateErrorId(),
      category,
      severity,
      message,
      originalError,
      stepIndex: (context as any).stepIndex,
      rowIndex: (context as any).rowIndex,
      timestamp: new Date(),
      context: this.sanitizeContext(context),
      recovered: false,
      retryCount: 0,
    };
  }

  /**
   * Classify error based on message patterns
   */
  public classifyError(message: string): ErrorCategory {
    for (const { pattern, category } of ERROR_PATTERNS) {
      if (pattern.test(message)) {
        return category;
      }
    }
    return 'unknown';
  }

  /**
   * Determine severity based on category
   */
  private determineSeverity(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case 'navigation':
      case 'injection':
      case 'tab':
        return 'fatal';
      case 'element_not_found':
      case 'element_not_visible':
      case 'element_not_interactable':
      case 'timeout':
      case 'network':
        return 'error';
      case 'validation':
      case 'assertion':
        return this.config.strictMode ? 'error' : 'warning';
      default:
        return 'error';
    }
  }

  // ==========================================================================
  // POLICY APPLICATION
  // ==========================================================================

  /**
   * Get policy for error category
   */
  private getPolicy(category: ErrorCategory): FailurePolicy {
    return this.config.categoryPolicies[category] ?? this.config.defaultPolicy;
  }

  /**
   * Apply policy to determine handling result
   */
  private applyPolicy(
    error: ExecutionError,
    policy: FailurePolicy,
    context: Partial<ErrorContext>
  ): ErrorHandlingResult {
    const retryKey = `${error.stepIndex ?? 'unknown'}-${error.category}`;
    const currentRetries = this.retryCounters.get(retryKey) ?? 0;
    
    // Check if we should retry
    if (policy === 'retry' && currentRetries < this.config.maxRetries) {
      this.retryCounters.set(retryKey, currentRetries + 1);
      error.retryCount = currentRetries + 1;
      
      this.emitEvent({
        type: 'retry_attempted',
        error,
        context: context as ErrorContext,
        timestamp: new Date(),
      });

      return {
        shouldContinue: false,
        shouldSkip: false,
        shouldRetry: true,
        shouldAbort: false,
        error,
        recoveryMessage: `Retrying (attempt ${currentRetries + 1}/${this.config.maxRetries})`,
      };
    }

    // Clear retry counter if not retrying
    this.retryCounters.delete(retryKey);

    switch (policy) {
      case 'continue':
        return {
          shouldContinue: true,
          shouldSkip: false,
          shouldRetry: false,
          shouldAbort: false,
          error,
          recoveryMessage: 'Continuing to next step',
        };

      case 'skip':
        return {
          shouldContinue: true,
          shouldSkip: true,
          shouldRetry: false,
          shouldAbort: false,
          error,
          recoveryMessage: 'Skipping failed step',
        };

      case 'abort':
        error.severity = 'fatal';
        return {
          shouldContinue: false,
          shouldSkip: false,
          shouldRetry: false,
          shouldAbort: true,
          error,
          recoveryMessage: 'Aborting execution due to fatal error',
        };

      case 'retry':
        // Max retries exceeded
        return {
          shouldContinue: true,
          shouldSkip: false,
          shouldRetry: false,
          shouldAbort: false,
          error,
          recoveryMessage: `Max retries (${this.config.maxRetries}) exceeded, continuing`,
        };

      default:
        return {
          shouldContinue: true,
          shouldSkip: false,
          shouldRetry: false,
          shouldAbort: false,
          error,
        };
    }
  }

  // ==========================================================================
  // RECOVERY STRATEGIES
  // ==========================================================================

  /**
   * Register a recovery strategy for an error category
   */
  public registerRecoveryStrategy(
    category: ErrorCategory,
    strategy: RecoveryStrategy
  ): void {
    this.recoveryStrategies.set(category, strategy);
  }

  /**
   * Remove a recovery strategy
   */
  public removeRecoveryStrategy(category: ErrorCategory): void {
    this.recoveryStrategies.delete(category);
  }

  /**
   * Check if recovery strategy exists
   */
  public hasRecoveryStrategy(category: ErrorCategory): boolean {
    return this.recoveryStrategies.has(category);
  }

  // ==========================================================================
  // ERROR QUERIES
  // ==========================================================================

  /**
   * Get all errors
   */
  public getErrors(): ExecutionError[] {
    return [...this.errors];
  }

  /**
   * Get errors by category
   */
  public getErrorsByCategory(category: ErrorCategory): ExecutionError[] {
    return this.errors.filter(e => e.category === category);
  }

  /**
   * Get errors by severity
   */
  public getErrorsBySeverity(severity: ErrorSeverity): ExecutionError[] {
    return this.errors.filter(e => e.severity === severity);
  }

  /**
   * Get errors for a specific step
   */
  public getStepErrors(stepIndex: number): ExecutionError[] {
    return this.errors.filter(e => e.stepIndex === stepIndex);
  }

  /**
   * Get fatal errors
   */
  public getFatalErrors(): ExecutionError[] {
    return this.errors.filter(e => e.severity === 'fatal');
  }

  /**
   * Check if there are fatal errors
   */
  public hasFatalErrors(): boolean {
    return this.getFatalErrors().length > 0;
  }

  /**
   * Get error count
   */
  public getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Check if any errors occurred
   */
  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get last error
   */
  public getLastError(): ExecutionError | undefined {
    return this.errors[this.errors.length - 1];
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get error statistics
   */
  public getStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.errors.length,
      byCategory: {
        element_not_found: 0,
        element_not_visible: 0,
        element_not_interactable: 0,
        timeout: 0,
        navigation: 0,
        injection: 0,
        tab: 0,
        network: 0,
        validation: 0,
        assertion: 0,
        unknown: 0,
      },
      bySeverity: {
        fatal: 0,
        error: 0,
        warning: 0,
        info: 0,
      },
      recovered: 0,
      fatal: 0,
    };

    for (const error of this.errors) {
      stats.byCategory[error.category]++;
      stats.bySeverity[error.severity]++;
      
      if (error.recovered) stats.recovered++;
      if (error.severity === 'fatal') stats.fatal++;
      
      if (!stats.firstErrorAt || error.timestamp < stats.firstErrorAt) {
        stats.firstErrorAt = error.timestamp;
      }
      if (!stats.lastErrorAt || error.timestamp > stats.lastErrorAt) {
        stats.lastErrorAt = error.timestamp;
      }
    }

    return stats;
  }

  /**
   * Generate error summary string
   */
  public getSummary(): string {
    const stats = this.getStats();
    const lines: string[] = [
      `Total Errors: ${stats.total}`,
      `Fatal: ${stats.fatal}`,
      `Recovered: ${stats.recovered}`,
    ];

    // Add top categories
    const topCategories = Object.entries(stats.byCategory)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topCategories.length > 0) {
      lines.push('Top Categories:');
      topCategories.forEach(([cat, count]) => {
        lines.push(`  - ${cat}: ${count}`);
      });
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to error events
   */
  public onEvent(listener: ErrorEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  public offEvent(listener: ErrorEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit an error event
   */
  private emitEvent(event: ErrorEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ErrorHandler] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize context for storage
   */
  private sanitizeContext(context: Partial<ErrorContext>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && typeof value !== 'function') {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Log error to console
   */
  private logError(error: ExecutionError): void {
    const prefix = `[ErrorHandler] [${error.severity.toUpperCase()}]`;
    const location = error.stepIndex !== undefined 
      ? ` Step ${error.stepIndex}:` 
      : '';
    
    console.error(`${prefix}${location} ${error.message}`);
    
    if (error.originalError?.stack) {
      console.error(error.originalError.stack);
    }
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Get current configuration
   */
  public getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set policy for a category
   */
  public setPolicy(category: ErrorCategory, policy: FailurePolicy): void {
    this.config.categoryPolicies[category] = policy;
  }

  /**
   * Reset handler state
   */
  public reset(): void {
    this.errors = [];
    this.retryCounters.clear();
  }

  /**
   * Clear errors but keep configuration
   */
  public clearErrors(): void {
    this.errors = [];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an ErrorHandler instance
 */
export function createErrorHandler(
  config?: Partial<ErrorHandlerConfig>
): ErrorHandler {
  return new ErrorHandler(config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a simple error handler with default continue policy
 */
export function createContinueOnErrorHandler(): ErrorHandler {
  return new ErrorHandler({ defaultPolicy: 'continue' });
}

/**
 * Create a strict error handler that aborts on any error
 */
export function createStrictErrorHandler(): ErrorHandler {
  return new ErrorHandler({
    defaultPolicy: 'abort',
    strictMode: true,
    maxRetries: 0,
  });
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T>(
  handler: ErrorHandler,
  fn: () => Promise<T>,
  context?: Partial<ErrorContext>
): Promise<{ result?: T; error?: ErrorHandlingResult }> {
  return fn()
    .then(result => ({ result }))
    .catch(error => ({ error: handler.handle(error, context) }));
}
