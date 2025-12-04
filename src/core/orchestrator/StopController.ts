/**
 * StopController - Implements isRunningRef pattern for immediate stop control
 * @module core/orchestrator/StopController
 * @version 1.0.0
 * 
 * Provides synchronous stop checking that works immediately,
 * unlike React state which is async. Essential for responsive
 * stop button behavior during test execution.
 * 
 * CRITICAL: Uses synchronous flag (not async state) for immediate stop.
 * 
 * @see test-orchestrator_breakdown.md for isRunningRef pattern
 * @see COPILOT_REPO_REPORT.md for pattern verification
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Stop reason codes
 */
export type StopReason =
  | 'user_requested'      // User clicked stop button
  | 'max_errors'          // Too many errors occurred
  | 'fatal_error'         // Unrecoverable error
  | 'timeout'             // Execution timeout exceeded
  | 'external'            // External abort signal
  | 'completed'           // Normal completion (not really a stop)
  | 'unknown';            // Unknown reason

/**
 * Stop event payload
 */
export interface StopEvent {
  /** Stop reason */
  reason: StopReason;
  /** Human-readable message */
  message: string;
  /** When stop was requested */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Stop callback function
 */
export type StopCallback = (event: StopEvent) => void;

/**
 * Running state (for external queries)
 */
export interface RunningState {
  /** Whether currently running */
  isRunning: boolean;
  /** Whether stop has been requested */
  stopRequested: boolean;
  /** Stop reason if stopped */
  stopReason?: StopReason;
  /** Stop message if stopped */
  stopMessage?: string;
  /** When execution started */
  startedAt?: Date;
  /** When stop was requested */
  stoppedAt?: Date;
}

/**
 * StopController configuration
 */
export interface StopControllerConfig {
  /** Auto-reset on start. Default: true */
  autoResetOnStart: boolean;
  /** Emit events. Default: true */
  emitEvents: boolean;
  /** Log to console. Default: false */
  logToConsole: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_STOP_CONTROLLER_CONFIG: StopControllerConfig = {
  autoResetOnStart: true,
  emitEvents: true,
  logToConsole: false,
};

// ============================================================================
// STOP CONTROLLER CLASS
// ============================================================================

/**
 * StopController - Synchronous stop control for execution loops
 * 
 * Implements the isRunningRef pattern from TestRunner.tsx for immediate
 * stop response. Uses a synchronous boolean flag that can be checked
 * at any point in execution without waiting for React re-renders.
 * 
 * @example
 * ```typescript
 * const controller = new StopController();
 * 
 * // Start execution
 * controller.start();
 * 
 * // In execution loop
 * while (controller.isRunning()) {
 *   // Do work...
 *   
 *   // Check at safe points
 *   if (controller.shouldStop()) {
 *     break;
 *   }
 * }
 * 
 * // User clicks stop button
 * controller.stop('user_requested', 'Test stopped by user');
 * ```
 */
export class StopController {
  private config: StopControllerConfig;
  
  // CRITICAL: These are synchronous flags, NOT React state
  private _isRunning: boolean = false;
  private _stopRequested: boolean = false;
  
  private _stopReason: StopReason | undefined;
  private _stopMessage: string | undefined;
  private _startedAt: Date | undefined;
  private _stoppedAt: Date | undefined;
  
  private callbacks: Set<StopCallback> = new Set();
  private abortController: AbortController | null = null;

  /**
   * Create a new StopController
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<StopControllerConfig> = {}) {
    this.config = { ...DEFAULT_STOP_CONTROLLER_CONFIG, ...config };
  }

  // ==========================================================================
  // PRIMARY CONTROL METHODS
  // ==========================================================================

  /**
   * Start execution - marks as running
   * 
   * CRITICAL: Sets running flag synchronously
   */
  public start(): void {
    if (this.config.autoResetOnStart) {
      this.reset();
    }
    
    this._isRunning = true;
    this._stopRequested = false;
    this._startedAt = new Date();
    this._stoppedAt = undefined;
    this._stopReason = undefined;
    this._stopMessage = undefined;
    
    // Create new AbortController for this execution
    this.abortController = new AbortController();
    
    if (this.config.logToConsole) {
      console.log('[StopController] Execution started');
    }
  }

  /**
   * Stop execution - request immediate stop
   * 
   * CRITICAL: Sets stop flag synchronously for immediate response
   * 
   * @param reason - Why execution is stopping
   * @param message - Human-readable message
   * @param context - Additional context
   */
  public stop(
    reason: StopReason = 'user_requested',
    message: string = 'Execution stopped',
    context?: Record<string, unknown>
  ): void {
    // SYNCHRONOUS flag updates - this is the key to immediate response
    this._stopRequested = true;
    this._isRunning = false;
    this._stopReason = reason;
    this._stopMessage = message;
    this._stoppedAt = new Date();
    
    // Abort any pending operations
    if (this.abortController) {
      this.abortController.abort();
    }
    
    if (this.config.logToConsole) {
      console.log(`[StopController] Stop requested: ${reason} - ${message}`);
    }
    
    // Emit stop event
    if (this.config.emitEvents) {
      const event: StopEvent = {
        reason,
        message,
        timestamp: this._stoppedAt,
        context,
      };
      
      this.emitStopEvent(event);
    }
  }

  /**
   * Mark execution as completed normally
   */
  public complete(): void {
    this._isRunning = false;
    this._stoppedAt = new Date();
    this._stopReason = 'completed';
    this._stopMessage = 'Execution completed successfully';
    
    if (this.config.logToConsole) {
      console.log('[StopController] Execution completed');
    }
  }

  /**
   * Reset controller to initial state
   */
  public reset(): void {
    this._isRunning = false;
    this._stopRequested = false;
    this._stopReason = undefined;
    this._stopMessage = undefined;
    this._startedAt = undefined;
    this._stoppedAt = undefined;
    this.abortController = null;
    
    if (this.config.logToConsole) {
      console.log('[StopController] Reset');
    }
  }

  // ==========================================================================
  // STATE CHECK METHODS (SYNCHRONOUS)
  // ==========================================================================

  /**
   * Check if currently running
   * 
   * CRITICAL: Synchronous read - no async/await needed
   */
  public isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Check if stop has been requested
   * 
   * CRITICAL: Synchronous read for immediate stop detection
   */
  public shouldStop(): boolean {
    return this._stopRequested || !this._isRunning;
  }

  /**
   * Check if execution should continue
   * 
   * Inverse of shouldStop() for cleaner loop conditions
   */
  public shouldContinue(): boolean {
    return this._isRunning && !this._stopRequested;
  }

  /**
   * Get stop reason (if stopped)
   */
  public getStopReason(): StopReason | undefined {
    return this._stopReason;
  }

  /**
   * Get stop message (if stopped)
   */
  public getStopMessage(): string | undefined {
    return this._stopMessage;
  }

  /**
   * Get full running state
   */
  public getState(): RunningState {
    return {
      isRunning: this._isRunning,
      stopRequested: this._stopRequested,
      stopReason: this._stopReason,
      stopMessage: this._stopMessage,
      startedAt: this._startedAt,
      stoppedAt: this._stoppedAt,
    };
  }

  /**
   * Check if execution was stopped (vs completed normally)
   */
  public wasStopped(): boolean {
    return this._stopRequested && this._stopReason !== 'completed';
  }

  /**
   * Check if execution completed normally
   */
  public wasCompleted(): boolean {
    return this._stopReason === 'completed';
  }

  // ==========================================================================
  // ABORT SIGNAL
  // ==========================================================================

  /**
   * Get abort signal for async operations
   * 
   * Use with fetch(), Promise.race(), etc. for cancellable operations
   */
  public getAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  /**
   * Check if abort signal is aborted
   */
  public isAborted(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  /**
   * Create a promise that rejects when stop is requested
   * 
   * Use with Promise.race() to make any promise cancellable
   */
  public createAbortPromise(): Promise<never> {
    return new Promise((_, reject) => {
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          reject(new Error('Operation aborted'));
        });
      }
    });
  }

  // ==========================================================================
  // CHECKPOINT METHODS
  // ==========================================================================

  /**
   * Check at a safe point if execution should continue
   * 
   * Use at natural boundaries (between steps, between rows)
   * Throws if stop requested for easy control flow
   * 
   * @throws StopRequestedError if stop was requested
   */
  public checkpoint(): void {
    if (this.shouldStop()) {
      throw new StopRequestedError(
        this._stopReason ?? 'unknown',
        this._stopMessage ?? 'Execution stopped'
      );
    }
  }

  /**
   * Check if should stop without throwing
   * 
   * Returns true if should stop, false to continue
   */
  public checkpointSafe(): boolean {
    return this.shouldStop();
  }

  /**
   * Assert execution is still running
   * 
   * @throws Error if not running
   */
  public assertRunning(): void {
    if (!this._isRunning) {
      throw new Error('Execution is not running');
    }
  }

  // ==========================================================================
  // CALLBACK MANAGEMENT
  // ==========================================================================

  /**
   * Register a callback for stop events
   * 
   * @param callback - Function to call when stop is requested
   * @returns Unsubscribe function
   */
  public onStop(callback: StopCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Remove a stop callback
   */
  public offStop(callback: StopCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * Emit stop event to all callbacks
   */
  private emitStopEvent(event: StopEvent): void {
    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[StopController] Error in stop callback:', error);
      }
    });
  }

  // ==========================================================================
  // TIMING METHODS
  // ==========================================================================

  /**
   * Get execution duration in milliseconds
   */
  public getDuration(): number {
    if (!this._startedAt) return 0;
    
    const endTime = this._stoppedAt ?? new Date();
    return endTime.getTime() - this._startedAt.getTime();
  }

  /**
   * Get when execution started
   */
  public getStartedAt(): Date | undefined {
    return this._startedAt;
  }

  /**
   * Get when execution stopped
   */
  public getStoppedAt(): Date | undefined {
    return this._stoppedAt;
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Get current configuration
   */
  public getConfig(): StopControllerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<StopControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// STOP REQUESTED ERROR
// ============================================================================

/**
 * Error thrown when stop is requested and checkpoint() is called
 */
export class StopRequestedError extends Error {
  public readonly reason: StopReason;
  public readonly stopMessage: string;

  constructor(reason: StopReason, message: string) {
    super(`Execution stopped: ${message}`);
    this.name = 'StopRequestedError';
    this.reason = reason;
    this.stopMessage = message;
  }
}

/**
 * Check if an error is a StopRequestedError
 */
export function isStopRequestedError(error: unknown): error is StopRequestedError {
  return error instanceof StopRequestedError;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a StopController instance
 */
export function createStopController(
  config?: Partial<StopControllerConfig>
): StopController {
  return new StopController(config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Run a function with stop control
 * 
 * @param controller - StopController instance
 * @param fn - Async function to run
 * @returns Promise that resolves with result or rejects on stop
 */
export async function withStopControl<T>(
  controller: StopController,
  fn: (controller: StopController) => Promise<T>
): Promise<T> {
  controller.start();
  
  try {
    const result = await fn(controller);
    controller.complete();
    return result;
  } catch (error) {
    if (!isStopRequestedError(error)) {
      controller.stop('fatal_error', error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

/**
 * Create a cancellable delay
 * 
 * @param controller - StopController instance
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay or rejects on stop
 */
export function cancellableDelay(
  controller: StopController,
  ms: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (controller.shouldStop()) {
        reject(new StopRequestedError(
          controller.getStopReason() ?? 'unknown',
          'Delay cancelled'
        ));
      } else {
        resolve();
      }
    }, ms);

    // Listen for abort
    const signal = controller.getAbortSignal();
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new StopRequestedError(
          controller.getStopReason() ?? 'unknown',
          'Delay cancelled'
        ));
      });
    }
  });
}

/**
 * Create an iterator that checks stop at each iteration
 * 
 * @param controller - StopController instance
 * @param items - Items to iterate
 * @returns Generator that yields items until stop
 */
export function* stoppableIterator<T>(
  controller: StopController,
  items: Iterable<T>
): Generator<T, void, undefined> {
  for (const item of items) {
    if (controller.shouldStop()) {
      return;
    }
    yield item;
  }
}
