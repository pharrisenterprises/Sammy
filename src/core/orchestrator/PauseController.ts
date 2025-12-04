/**
 * PauseController - Implements pause/resume functionality for test execution
 * @module core/orchestrator/PauseController
 * @version 1.0.0
 * 
 * Uses Promise-based blocking that suspends execution at safe points
 * until resumed. Unlike StopController (which terminates), PauseController
 * allows resumption from the pause point.
 * 
 * @see test-orchestrator_breakdown.md for orchestrator patterns
 * @see StopController.ts for stop pattern
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Pause reason codes
 */
export type PauseReason =
  | 'user_requested'     // User clicked pause button
  | 'breakpoint'         // Programmatic breakpoint
  | 'error_pause'        // Paused due to error (waiting for user)
  | 'step_mode'          // Step-by-step execution mode
  | 'external'           // External pause request
  | 'debug';             // Debug mode pause

/**
 * Pause event payload
 */
export interface PauseEvent {
  /** Event type */
  type: 'paused' | 'resumed' | 'step_executed';
  /** Pause reason (if paused) */
  reason?: PauseReason;
  /** Human-readable message */
  message?: string;
  /** When event occurred */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Pause callback function
 */
export type PauseCallback = (event: PauseEvent) => void;

/**
 * Pause state (for external queries)
 */
export interface PauseState {
  /** Whether currently paused */
  isPaused: boolean;
  /** Whether in step mode */
  isStepMode: boolean;
  /** Pause reason if paused */
  pauseReason?: PauseReason;
  /** When paused */
  pausedAt?: Date;
  /** Total pause duration (ms) */
  totalPauseDuration: number;
  /** Pause count */
  pauseCount: number;
}

/**
 * PauseController configuration
 */
export interface PauseControllerConfig {
  /** Start in step mode. Default: false */
  startInStepMode: boolean;
  /** Auto-pause on error. Default: false */
  pauseOnError: boolean;
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
export const DEFAULT_PAUSE_CONTROLLER_CONFIG: PauseControllerConfig = {
  startInStepMode: false,
  pauseOnError: false,
  emitEvents: true,
  logToConsole: false,
};

// ============================================================================
// PAUSE CONTROLLER CLASS
// ============================================================================

/**
 * PauseController - Promise-based pause/resume for execution loops
 * 
 * When paused, the waitIfPaused() method returns a Promise that doesn't
 * resolve until resume() is called. This blocks async execution at
 * safe points without busy-waiting.
 * 
 * @example
 * ```typescript
 * const controller = new PauseController();
 * 
 * // In execution loop
 * for (const step of steps) {
 *   // Wait here if paused
 *   await controller.waitIfPaused();
 *   
 *   // Execute step
 *   await executeStep(step);
 * }
 * 
 * // User clicks pause button
 * controller.pause('user_requested', 'Paused by user');
 * 
 * // User clicks resume button
 * controller.resume();
 * ```
 */
export class PauseController {
  private config: PauseControllerConfig;
  
  // Pause state
  private _isPaused: boolean = false;
  private _pauseReason: PauseReason | undefined;
  private _pauseMessage: string | undefined;
  private _pausedAt: Date | undefined;
  
  // Step mode state
  private _isStepMode: boolean = false;
  private _stepPending: boolean = false;
  
  // Statistics
  private _pauseCount: number = 0;
  private _totalPauseDuration: number = 0;
  
  // Promise resolution for blocking
  private _resumeResolver: (() => void) | null = null;
  private _stepResolver: (() => void) | null = null;
  
  // Event listeners
  private callbacks: Set<PauseCallback> = new Set();

  /**
   * Create a new PauseController
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<PauseControllerConfig> = {}) {
    this.config = { ...DEFAULT_PAUSE_CONTROLLER_CONFIG, ...config };
    this._isStepMode = this.config.startInStepMode;
  }

  // ==========================================================================
  // PRIMARY CONTROL METHODS
  // ==========================================================================

  /**
   * Pause execution
   * 
   * @param reason - Why execution is pausing
   * @param message - Human-readable message
   * @param context - Additional context
   */
  public pause(
    reason: PauseReason = 'user_requested',
    message: string = 'Execution paused',
    context?: Record<string, unknown>
  ): void {
    if (this._isPaused) {
      return; // Already paused
    }

    this._isPaused = true;
    this._pauseReason = reason;
    this._pauseMessage = message;
    this._pausedAt = new Date();
    this._pauseCount++;

    if (this.config.logToConsole) {
      console.log(`[PauseController] Paused: ${reason} - ${message}`);
    }

    if (this.config.emitEvents) {
      this.emitEvent({
        type: 'paused',
        reason,
        message,
        timestamp: new Date(),
        context,
      });
    }
  }

  /**
   * Resume execution
   * 
   * @param message - Optional resume message
   */
  public resume(message?: string): void {
    if (!this._isPaused) {
      return; // Not paused
    }

    // Calculate pause duration
    if (this._pausedAt) {
      this._totalPauseDuration += Date.now() - this._pausedAt.getTime();
    }

    this._isPaused = false;
    this._pauseReason = undefined;
    this._pauseMessage = undefined;
    this._pausedAt = undefined;

    // Resolve waiting promise
    if (this._resumeResolver) {
      this._resumeResolver();
      this._resumeResolver = null;
    }

    if (this.config.logToConsole) {
      console.log(`[PauseController] Resumed${message ? `: ${message}` : ''}`);
    }

    if (this.config.emitEvents) {
      this.emitEvent({
        type: 'resumed',
        message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Toggle pause state
   * 
   * @returns New pause state (true = paused)
   */
  public toggle(): boolean {
    if (this._isPaused) {
      this.resume();
      return false;
    } else {
      this.pause();
      return true;
    }
  }

  // ==========================================================================
  // BLOCKING WAIT METHODS
  // ==========================================================================

  /**
   * Wait if paused - blocks until resumed
   * 
   * Call this at safe points in execution (between steps, between rows).
   * Returns immediately if not paused.
   * 
   * @returns Promise that resolves when not paused
   */
  public async waitIfPaused(): Promise<void> {
    // If in step mode, wait for step signal
    if (this._isStepMode && this._stepPending) {
      await this.waitForStep();
      return;
    }

    // If not paused, return immediately
    if (!this._isPaused) {
      // In step mode, set pending for next call
      if (this._isStepMode) {
        this._stepPending = true;
      }
      return;
    }

    // Wait for resume
    await new Promise<void>((resolve) => {
      this._resumeResolver = resolve;
    });

    // After resume, check step mode
    if (this._isStepMode) {
      this._stepPending = true;
    }
  }

  /**
   * Wait for step signal in step mode
   */
  private async waitForStep(): Promise<void> {
    await new Promise<void>((resolve) => {
      this._stepResolver = resolve;
    });
    this._stepPending = true; // Ready for next step
  }

  /**
   * Check if should wait (without actually waiting)
   * 
   * Useful for pre-checking before long operations
   */
  public shouldWait(): boolean {
    return this._isPaused || (this._isStepMode && this._stepPending);
  }

  // ==========================================================================
  // STEP MODE METHODS
  // ==========================================================================

  /**
   * Enable step-by-step execution mode
   */
  public enableStepMode(): void {
    this._isStepMode = true;
    this._stepPending = false;

    if (this.config.logToConsole) {
      console.log('[PauseController] Step mode enabled');
    }
  }

  /**
   * Disable step-by-step execution mode
   */
  public disableStepMode(): void {
    this._isStepMode = false;
    this._stepPending = false;

    // Resolve any waiting step promise
    if (this._stepResolver) {
      this._stepResolver();
      this._stepResolver = null;
    }

    if (this.config.logToConsole) {
      console.log('[PauseController] Step mode disabled');
    }
  }

  /**
   * Toggle step mode
   */
  public toggleStepMode(): boolean {
    if (this._isStepMode) {
      this.disableStepMode();
      return false;
    } else {
      this.enableStepMode();
      return true;
    }
  }

  /**
   * Execute single step (in step mode)
   * 
   * Allows one step to execute, then pauses again
   */
  public step(): void {
    if (!this._isStepMode) {
      return; // Not in step mode
    }

    // Resolve step promise to allow one step
    if (this._stepResolver) {
      this._stepResolver();
      this._stepResolver = null;
    }

    this._stepPending = false; // Will be set again after step executes

    if (this.config.emitEvents) {
      this.emitEvent({
        type: 'step_executed',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check if in step mode
   */
  public isStepMode(): boolean {
    return this._isStepMode;
  }

  // ==========================================================================
  // STATE CHECK METHODS
  // ==========================================================================

  /**
   * Check if currently paused
   */
  public isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Get pause reason (if paused)
   */
  public getPauseReason(): PauseReason | undefined {
    return this._pauseReason;
  }

  /**
   * Get pause message (if paused)
   */
  public getPauseMessage(): string | undefined {
    return this._pauseMessage;
  }

  /**
   * Get full pause state
   */
  public getState(): PauseState {
    return {
      isPaused: this._isPaused,
      isStepMode: this._isStepMode,
      pauseReason: this._pauseReason,
      pausedAt: this._pausedAt,
      totalPauseDuration: this._totalPauseDuration,
      pauseCount: this._pauseCount,
    };
  }

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  /**
   * Pause on error (if configured)
   * 
   * @param error - Error that occurred
   */
  public onError(error: Error): void {
    if (this.config.pauseOnError && !this._isPaused) {
      this.pause('error_pause', `Paused due to error: ${error.message}`, {
        errorName: error.name,
        errorMessage: error.message,
      });
    }
  }

  // ==========================================================================
  // BREAKPOINTS
  // ==========================================================================

  /**
   * Set a programmatic breakpoint
   * 
   * Pauses execution with 'breakpoint' reason
   * 
   * @param name - Breakpoint name/identifier
   * @param context - Additional context
   */
  public breakpoint(name: string, context?: Record<string, unknown>): void {
    this.pause('breakpoint', `Breakpoint: ${name}`, {
      breakpointName: name,
      ...context,
    });
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get total pause duration in milliseconds
   * 
   * Includes current pause if still paused
   */
  public getTotalPauseDuration(): number {
    let duration = this._totalPauseDuration;
    
    // Add current pause duration if still paused
    if (this._isPaused && this._pausedAt) {
      duration += Date.now() - this._pausedAt.getTime();
    }
    
    return duration;
  }

  /**
   * Get current pause duration (if paused)
   */
  public getCurrentPauseDuration(): number {
    if (!this._isPaused || !this._pausedAt) {
      return 0;
    }
    return Date.now() - this._pausedAt.getTime();
  }

  /**
   * Get pause count
   */
  public getPauseCount(): number {
    return this._pauseCount;
  }

  // ==========================================================================
  // CALLBACK MANAGEMENT
  // ==========================================================================

  /**
   * Register a callback for pause events
   * 
   * @param callback - Function to call on pause/resume
   * @returns Unsubscribe function
   */
  public onPause(callback: PauseCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Remove a pause callback
   */
  public offPause(callback: PauseCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * Emit pause event to all callbacks
   */
  private emitEvent(event: PauseEvent): void {
    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[PauseController] Error in callback:', error);
      }
    });
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Get current configuration
   */
  public getConfig(): PauseControllerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PauseControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset controller to initial state
   */
  public reset(): void {
    // Resume if paused (to unblock any waiting promises)
    if (this._isPaused) {
      this.resume();
    }

    // Disable step mode (to unblock step promises)
    if (this._isStepMode) {
      this.disableStepMode();
    }

    this._pauseCount = 0;
    this._totalPauseDuration = 0;
    this._isStepMode = this.config.startInStepMode;
    this._stepPending = false;

    if (this.config.logToConsole) {
      console.log('[PauseController] Reset');
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a PauseController instance
 */
export function createPauseController(
  config?: Partial<PauseControllerConfig>
): PauseController {
  return new PauseController(config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a pause-aware delay
 * 
 * Delays execution, but the delay can be "paused" (time stops counting)
 * 
 * @param controller - PauseController instance
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay (excluding pause time)
 */
export async function pauseAwareDelay(
  controller: PauseController,
  ms: number
): Promise<void> {
  const startTime = Date.now();
  let elapsed = 0;

  while (elapsed < ms) {
    // Wait if paused
    await controller.waitIfPaused();

    // Calculate remaining time
    const remaining = ms - elapsed;
    const sleepTime = Math.min(remaining, 100); // Check pause every 100ms

    await new Promise(resolve => setTimeout(resolve, sleepTime));

    // Only count time when not paused
    if (!controller.isPaused()) {
      elapsed = Date.now() - startTime - controller.getTotalPauseDuration();
    }
  }
}

/**
 * Create a pause-aware iterator
 * 
 * Yields items from iterator, waiting if paused between items
 */
export async function* pauseAwareIterator<T>(
  controller: PauseController,
  items: Iterable<T>
): AsyncGenerator<T, void, undefined> {
  for (const item of items) {
    await controller.waitIfPaused();
    yield item;
  }
}

/**
 * Combine pause and stop control into a single wait
 * 
 * @param pauseController - PauseController instance
 * @param stopController - Object with shouldStop() method
 * @returns Promise that resolves when unpaused, or throws on stop
 */
export async function waitWithStopCheck(
  pauseController: PauseController,
  stopController: { shouldStop(): boolean; getStopReason?(): string | undefined }
): Promise<void> {
  // Check stop first
  if (stopController.shouldStop()) {
    const reason = stopController.getStopReason?.() ?? 'Stop requested';
    throw new Error(`Execution stopped: ${reason}`);
  }

  // Wait if paused
  await pauseController.waitIfPaused();

  // Check stop again after resume
  if (stopController.shouldStop()) {
    const reason = stopController.getStopReason?.() ?? 'Stop requested';
    throw new Error(`Execution stopped: ${reason}`);
  }
}
