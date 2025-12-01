/**
 * ReplayController - Coordinates replay state and execution
 * @module core/replay/ReplayController
 * @version 1.0.0
 * 
 * Main entry point for replay functionality. Manages the replay
 * lifecycle, coordinates step execution, and handles failures.
 * 
 * Features:
 * - State machine for replay lifecycle
 * - Step queue with priority support
 * - Retry logic with exponential backoff
 * - Timeout handling per step
 * - Progress tracking and reporting
 * - Breakpoint support for debugging
 * 
 * @see replay-engine_breakdown.md for architecture details
 */

import type {
  ReplayState,
  ReplaySession,
  ReplayOptions,
  ReplayResult,
  StepResult,
  ReplayStats,
} from '../types/replay';
import type { RecordedStep } from '../types/step';
import type { IMessageBus, Unsubscribe } from '../messaging/IMessageBus';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default replay options
 */
export const DEFAULT_REPLAY_OPTIONS: ReplayOptions = {
  stepTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  waitBetweenSteps: 100,
  continueOnFailure: false,
  screenshotOnFailure: true,
  screenshotOnSuccess: false,
  highlightElements: true,
  slowMotion: false,
  slowMotionDelay: 500,
  validateLocators: true,
  maxConcurrentSteps: 1,
};

/**
 * Replay state transitions
 */
export const STATE_TRANSITIONS: Record<ReplayState, ReplayState[]> = {
  idle: ['running'],
  running: ['paused', 'completed', 'failed', 'idle'],
  paused: ['running', 'idle', 'completed'],
  completed: ['idle'],
  failed: ['idle', 'running'],
};

/**
 * Default step timeout
 */
export const DEFAULT_STEP_TIMEOUT = 30000;

/**
 * Maximum retry attempts
 */
export const MAX_RETRY_ATTEMPTS = 10;

/**
 * Retry delay multiplier for exponential backoff
 */
export const RETRY_BACKOFF_MULTIPLIER = 1.5;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay controller configuration
 */
export interface ReplayControllerConfig {
  /** Message bus for communication */
  messageBus?: IMessageBus;
  /** Replay options */
  options?: Partial<ReplayOptions>;
  /** Step executor function */
  stepExecutor?: StepExecutor;
  /** Progress callback */
  onProgress?: (progress: ReplayProgress) => void;
  /** Step completed callback */
  onStepComplete?: (result: StepResult) => void;
  /** State change callback */
  onStateChange?: (state: ReplayState, prevState: ReplayState) => void;
  /** Error callback */
  onError?: (error: Error, step?: RecordedStep) => void;
  /** Completion callback */
  onComplete?: (result: ReplayResult) => void;
}

/**
 * Step executor function
 */
export type StepExecutor = (
  step: RecordedStep,
  context: StepExecutionContext
) => Promise<StepExecutionResult>;

/**
 * Step execution context
 */
export interface StepExecutionContext {
  /** Current attempt number (1-based) */
  attempt: number;
  /** Maximum attempts */
  maxAttempts: number;
  /** Step timeout in ms */
  timeout: number;
  /** Previous step result */
  previousResult?: StepResult;
  /** Session metadata */
  sessionMetadata: Record<string, unknown>;
  /** Abort signal */
  abortSignal: AbortSignal;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  /** Whether step succeeded */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Execution duration in ms */
  duration: number;
  /** Screenshot if captured */
  screenshot?: string;
  /** Actual value found */
  actualValue?: string;
  /** Element found */
  elementFound: boolean;
  /** Locator used */
  locatorUsed?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Replay progress information
 */
export interface ReplayProgress {
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Total steps */
  totalSteps: number;
  /** Completed steps */
  completedSteps: number;
  /** Failed steps */
  failedSteps: number;
  /** Skipped steps */
  skippedSteps: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current step being executed */
  currentStep?: RecordedStep;
  /** Elapsed time in ms */
  elapsedTime: number;
  /** Estimated remaining time in ms */
  estimatedRemaining: number;
  /** Current state */
  state: ReplayState;
}

/**
 * Breakpoint definition
 */
export interface Breakpoint {
  /** Step ID to break at */
  stepId?: string;
  /** Step index to break at */
  stepIndex?: number;
  /** Condition function */
  condition?: (step: RecordedStep, index: number) => boolean;
  /** Whether breakpoint is enabled */
  enabled: boolean;
}

/**
 * Step queue entry
 */
interface QueuedStep {
  step: RecordedStep;
  index: number;
  priority: number;
  retryCount: number;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * ReplayController - Coordinates replay state and execution
 * 
 * Manages the replay lifecycle including starting, stopping,
 * pausing, and stepping through recorded tests.
 * 
 * @example
 * ```typescript
 * const controller = new ReplayController({
 *   stepExecutor: async (step, ctx) => {
 *     // Execute step logic
 *     return { success: true, duration: 100, elementFound: true };
 *   },
 *   onProgress: (progress) => console.log(`${progress.percentage}%`),
 * });
 * 
 * const result = await controller.start(steps);
 * console.log(`Completed: ${result.passedSteps}/${result.totalSteps}`);
 * ```
 */
export class ReplayController {
  /**
   * Current replay state
   */
  private _state: ReplayState = 'idle';
  
  /**
   * Current replay session
   */
  private _session: ReplaySession | null = null;
  
  /**
   * Replay options
   */
  private _options: ReplayOptions;
  
  /**
   * Configuration
   */
  private config: ReplayControllerConfig;
  
  /**
   * Step queue
   */
  private stepQueue: QueuedStep[] = [];
  
  /**
   * Current step index
   */
  private currentStepIndex: number = 0;
  
  /**
   * Step results
   */
  private stepResults: StepResult[] = [];
  
  /**
   * Breakpoints
   */
  private breakpoints: Map<string, Breakpoint> = new Map();
  
  /**
   * Abort controller for cancellation
   */
  private abortController: AbortController | null = null;
  
  /**
   * Message bus subscriptions
   */
  private subscriptions: Unsubscribe[] = [];
  
  /**
   * Start time for duration tracking
   */
  private startTime: number = 0;
  
  /**
   * Statistics
   */
  private stats: ReplayStats;
  
  /**
   * Step timing history for estimation
   */
  private stepTimings: number[] = [];
  
  /**
   * Pause promise resolver
   */
  private pauseResolver: (() => void) | null = null;
  
  /**
   * Creates a new ReplayController
   * 
   * @param config - Controller configuration
   */
  constructor(config: ReplayControllerConfig = {}) {
    this.config = config;
    this._options = {
      ...DEFAULT_REPLAY_OPTIONS,
      ...config.options,
    };
    
    this.stats = this.createEmptyStats();
  }
  
  // ==========================================================================
  // PROPERTIES
  // ==========================================================================
  
  /**
   * Current replay state
   */
  get state(): ReplayState {
    return this._state;
  }
  
  /**
   * Current replay session
   */
  get session(): ReplaySession | null {
    return this._session;
  }
  
  /**
   * Replay options
   */
  get options(): ReplayOptions {
    return { ...this._options };
  }
  
  /**
   * Whether currently running
   */
  get isRunning(): boolean {
    return this._state === 'running';
  }
  
  /**
   * Whether currently paused
   */
  get isPaused(): boolean {
    return this._state === 'paused';
  }
  
  /**
   * Whether idle
   */
  get isIdle(): boolean {
    return this._state === 'idle';
  }
  
  /**
   * Whether completed (success or failure)
   */
  get isCompleted(): boolean {
    return this._state === 'completed' || this._state === 'failed';
  }
  
  /**
   * Current progress
   */
  get progress(): ReplayProgress {
    return this.calculateProgress();
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Starts replay execution
   * 
   * @param steps - Steps to replay
   * @param options - Optional session options
   * @returns Replay result
   */
  async start(
    steps: RecordedStep[],
    options?: {
      sessionId?: string;
      testCaseId?: string;
      testCaseName?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ReplayResult> {
    // Validate state transition
    if (!this.canTransitionTo('running')) {
      throw new Error(`Cannot start replay from state: ${this._state}`);
    }
    
    if (steps.length === 0) {
      throw new Error('No steps to replay');
    }
    
    // Create session
    this._session = {
      id: options?.sessionId ?? this.generateSessionId(),
      testCaseId: options?.testCaseId,
      testCaseName: options?.testCaseName ?? 'Unnamed Test',
      startTime: Date.now(),
      endTime: null,
      state: 'running',
      steps,
      results: [],
      metadata: options?.metadata ?? {},
    };
    
    // Initialize
    this.stepQueue = steps.map((step, index) => ({
      step,
      index,
      priority: 0,
      retryCount: 0,
    }));
    this.currentStepIndex = 0;
    this.stepResults = [];
    this.startTime = Date.now();
    this.stepTimings = [];
    this.abortController = new AbortController();
    
    // Transition state
    this.transitionTo('running');
    this.notifyStateChange();
    
    this.stats.replaysStarted++;
    
    // Execute steps
    try {
      await this.executeSteps();
      
      // Determine final state
      const hasFailures = this.stepResults.some(r => r.status === 'failed');
      const finalState = hasFailures && !this._options.continueOnFailure ? 'failed' : 'completed';
      
      this.transitionTo(finalState);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Cancelled by user
        this.transitionTo('idle');
      } else {
        this.transitionTo('failed');
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    // Complete session
    this._session.endTime = Date.now();
    this._session.state = this._state;
    this._session.results = this.stepResults;
    
    // Build result
    const result = this.buildResult();
    
    // Notify completion
    this.config.onComplete?.(result);
    this.notifyStateChange();
    
    if (result.success) {
      this.stats.replaysCompleted++;
    } else {
      this.stats.replaysFailed++;
    }
    
    return result;
  }
  
  /**
   * Stops replay execution
   */
  async stop(): Promise<void> {
    if (this._state === 'idle') {
      return;
    }
    
    // Abort current execution
    this.abortController?.abort();
    
    // Transition to idle
    this.transitionTo('idle');
    this.notifyStateChange();
  }
  
  /**
   * Pauses replay execution
   */
  async pause(): Promise<void> {
    if (this._state !== 'running') {
      throw new Error(`Cannot pause from state: ${this._state}`);
    }
    
    this.transitionTo('paused');
    
    if (this._session) {
      this._session.state = 'paused';
    }
    
    this.notifyStateChange();
  }
  
  /**
   * Resumes replay execution
   */
  async resume(): Promise<void> {
    if (this._state !== 'paused') {
      throw new Error(`Cannot resume from state: ${this._state}`);
    }
    
    this.transitionTo('running');
    
    if (this._session) {
      this._session.state = 'running';
    }
    
    // Resolve pause promise to continue execution
    this.pauseResolver?.();
    this.pauseResolver = null;
    
    this.notifyStateChange();
  }
  
  /**
   * Executes a single step (for stepping through)
   */
  async stepOnce(): Promise<StepResult | null> {
    if (this._state !== 'paused') {
      throw new Error('Can only step when paused');
    }
    
    if (this.currentStepIndex >= this.stepQueue.length) {
      return null;
    }
    
    const queued = this.stepQueue[this.currentStepIndex];
    const result = await this.executeStep(queued);
    
    this.currentStepIndex++;
    this.reportProgress();
    
    return result;
  }
  
  /**
   * Skips the current step
   */
  skipCurrentStep(): void {
    if (this.currentStepIndex >= this.stepQueue.length) {
      return;
    }
    
    const queued = this.stepQueue[this.currentStepIndex];
    
    const result: StepResult = {
      stepId: queued.step.id,
      stepIndex: queued.index,
      status: 'skipped',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      attempts: 0,
    };
    
    this.stepResults.push(result);
    this.currentStepIndex++;
    this.stats.stepsSkipped++;
    
    this.reportProgress();
  }
  
  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================
  
  /**
   * Executes all steps in the queue
   */
  private async executeSteps(): Promise<void> {
    while (this.currentStepIndex < this.stepQueue.length) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new DOMException('Replay cancelled', 'AbortError');
      }
      
      // Check for pause
      if (this._state === 'paused') {
        await this.waitForResume();
        continue;
      }
      
      const queued = this.stepQueue[this.currentStepIndex];
      
      // Check breakpoints
      if (this.shouldBreak(queued.step, queued.index)) {
        await this.pause();
        await this.waitForResume();
        continue;
      }
      
      // Execute step
      const result = await this.executeStep(queued);
      
      // Handle failure
      if (result.status === 'failed' && !this._options.continueOnFailure) {
        throw new Error(`Step failed: ${result.error}`);
      }
      
      // Wait between steps
      if (this._options.waitBetweenSteps > 0) {
        await this.delay(this._options.waitBetweenSteps);
      }
      
      // Slow motion delay
      if (this._options.slowMotion && this._options.slowMotionDelay > 0) {
        await this.delay(this._options.slowMotionDelay);
      }
      
      this.currentStepIndex++;
      this.reportProgress();
    }
  }
  
  /**
   * Executes a single step with retries
   */
  private async executeStep(queued: QueuedStep): Promise<StepResult> {
    const { step, index } = queued;
    const startTime = Date.now();
    
    let lastError: Error | undefined;
    let lastExecutionResult: StepExecutionResult | undefined;
    let attempts = 0;
    
    const maxAttempts = step.metadata?.retryAttempts as number ?? this._options.retryAttempts;
    const timeout = step.metadata?.timeout as number ?? this._options.stepTimeout;
    
    // Retry loop
    for (attempts = 1; attempts <= maxAttempts; attempts++) {
      try {
        // Check for abort
        if (this.abortController?.signal.aborted) {
          throw new DOMException('Replay cancelled', 'AbortError');
        }
        
        // Create execution context
        const context: StepExecutionContext = {
          attempt: attempts,
          maxAttempts,
          timeout,
          previousResult: this.stepResults[this.stepResults.length - 1],
          sessionMetadata: this._session?.metadata ?? {},
          abortSignal: this.abortController!.signal,
        };
        
        // Execute with timeout
        const executionResult = await this.executeWithTimeout(
          () => this.executeStepInternal(step, context),
          timeout
        );
        
        lastExecutionResult = executionResult;
        
        if (executionResult.success) {
          // Success
          const result: StepResult = {
            stepId: step.id,
            stepIndex: index,
            status: 'passed',
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            attempts,
            screenshot: executionResult.screenshot,
            actualValue: executionResult.actualValue,
            locatorUsed: executionResult.locatorUsed,
            metadata: executionResult.metadata,
          };
          
          this.stepResults.push(result);
          this.stepTimings.push(result.duration);
          this.stats.stepsPassed++;
          
          this.config.onStepComplete?.(result);
          
          return result;
        }
        
        // Failed, will retry
        lastError = executionResult.error;
        
        // Wait before retry with exponential backoff
        if (attempts < maxAttempts) {
          const delay = this._options.retryDelay * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempts - 1);
          await this.delay(delay);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    
    // All retries exhausted
    const result: StepResult = {
      stepId: step.id,
      stepIndex: index,
      status: 'failed',
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      attempts,
      error: lastError?.message ?? 'Unknown error',
      screenshot: lastExecutionResult?.screenshot,
      elementFound: lastExecutionResult?.elementFound ?? false,
      locatorUsed: lastExecutionResult?.locatorUsed,
      metadata: lastExecutionResult?.metadata,
    };
    
    this.stepResults.push(result);
    this.stepTimings.push(result.duration);
    this.stats.stepsFailed++;
    
    this.config.onStepComplete?.(result);
    this.config.onError?.(lastError ?? new Error('Step failed'), step);
    
    return result;
  }
  
  /**
   * Executes step using the configured executor
   */
  private async executeStepInternal(
    step: RecordedStep,
    context: StepExecutionContext
  ): Promise<StepExecutionResult> {
    // Use custom executor if provided
    if (this.config.stepExecutor) {
      return this.config.stepExecutor(step, context);
    }
    
    // Default executor (placeholder)
    return this.defaultStepExecutor(step, context);
  }
  
  /**
   * Default step executor (placeholder implementation)
   */
  private async defaultStepExecutor(
    step: RecordedStep,
    _context: StepExecutionContext
  ): Promise<StepExecutionResult> {
    // This is a placeholder that should be replaced with actual execution logic
    // In a real implementation, this would dispatch to ActionExecutor
    
    const startTime = Date.now();
    
    // Simulate execution
    await this.delay(50);
    
    return {
      success: true,
      duration: Date.now() - startTime,
      elementFound: true,
      locatorUsed: step.target?.cssSelector ?? step.target?.xpath,
    };
  }
  
  /**
   * Executes with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step timeout after ${timeout}ms`));
      }, timeout);
      
      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  // ==========================================================================
  // BREAKPOINTS
  // ==========================================================================
  
  /**
   * Adds a breakpoint
   */
  addBreakpoint(breakpoint: Breakpoint): string {
    const id = `bp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.breakpoints.set(id, { ...breakpoint, enabled: true });
    return id;
  }
  
  /**
   * Removes a breakpoint
   */
  removeBreakpoint(id: string): boolean {
    return this.breakpoints.delete(id);
  }
  
  /**
   * Enables/disables a breakpoint
   */
  setBreakpointEnabled(id: string, enabled: boolean): void {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.enabled = enabled;
    }
  }
  
  /**
   * Clears all breakpoints
   */
  clearBreakpoints(): void {
    this.breakpoints.clear();
  }
  
  /**
   * Checks if should break at step
   */
  private shouldBreak(step: RecordedStep, index: number): boolean {
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue;
      
      if (bp.stepId && bp.stepId === step.id) {
        return true;
      }
      
      if (bp.stepIndex !== undefined && bp.stepIndex === index) {
        return true;
      }
      
      if (bp.condition && bp.condition(step, index)) {
        return true;
      }
    }
    
    return false;
  }
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  /**
   * Checks if can transition to state
   */
  private canTransitionTo(newState: ReplayState): boolean {
    return STATE_TRANSITIONS[this._state].includes(newState);
  }
  
  /**
   * Transitions to new state
   */
  private transitionTo(newState: ReplayState): void {
    const prevState = this._state;
    this._state = newState;
    this.config.onStateChange?.(newState, prevState);
  }
  
  /**
   * Notifies state change via message bus
   */
  private notifyStateChange(): void {
    const bus = this.config.messageBus;
    if (bus) {
      bus.broadcast('REPLAY_STATUS', {
        state: this._state,
        sessionId: this._session?.id,
        progress: this.calculateProgress(),
      });
    }
  }
  
  /**
   * Waits for resume from pause
   */
  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      this.pauseResolver = resolve;
    });
  }
  
  // ==========================================================================
  // PROGRESS & REPORTING
  // ==========================================================================
  
  /**
   * Calculates current progress
   */
  private calculateProgress(): ReplayProgress {
    const totalSteps = this.stepQueue.length;
    const completedSteps = this.stepResults.filter(r => r.status === 'passed').length;
    const failedSteps = this.stepResults.filter(r => r.status === 'failed').length;
    const skippedSteps = this.stepResults.filter(r => r.status === 'skipped').length;
    const elapsedTime = this.startTime > 0 ? Date.now() - this.startTime : 0;
    
    // Estimate remaining time
    const avgStepTime = this.stepTimings.length > 0
      ? this.stepTimings.reduce((a, b) => a + b, 0) / this.stepTimings.length
      : 1000;
    const remainingSteps = totalSteps - this.currentStepIndex;
    const estimatedRemaining = remainingSteps * avgStepTime;
    
    return {
      currentStepIndex: this.currentStepIndex,
      totalSteps,
      completedSteps,
      failedSteps,
      skippedSteps,
      percentage: totalSteps > 0 ? Math.round((this.currentStepIndex / totalSteps) * 100) : 0,
      currentStep: this.stepQueue[this.currentStepIndex]?.step,
      elapsedTime,
      estimatedRemaining,
      state: this._state,
    };
  }
  
  /**
   * Reports progress
   */
  private reportProgress(): void {
    const progress = this.calculateProgress();
    this.config.onProgress?.(progress);
    
    // Broadcast progress
    const bus = this.config.messageBus;
    if (bus) {
      bus.broadcast('REPLAY_PROGRESS', progress);
    }
  }
  
  /**
   * Builds final result
   */
  private buildResult(): ReplayResult {
    const passedSteps = this.stepResults.filter(r => r.status === 'passed').length;
    const failedSteps = this.stepResults.filter(r => r.status === 'failed').length;
    const skippedSteps = this.stepResults.filter(r => r.status === 'skipped').length;
    
    return {
      sessionId: this._session?.id ?? '',
      testCaseId: this._session?.testCaseId,
      testCaseName: this._session?.testCaseName ?? '',
      success: failedSteps === 0,
      totalSteps: this.stepQueue.length,
      passedSteps,
      failedSteps,
      skippedSteps,
      startTime: this.startTime,
      endTime: Date.now(),
      duration: Date.now() - this.startTime,
      stepResults: this.stepResults,
      errorMessage: failedSteps > 0
        ? this.stepResults.find(r => r.status === 'failed')?.error
        : undefined,
    };
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Generates session ID
   */
  private generateSessionId(): string {
    return `replay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Handles errors
   */
  private handleError(error: Error): void {
    this.stats.errors++;
    console.error('[ReplayController]', error);
  }
  
  /**
   * Creates empty stats
   */
  private createEmptyStats(): ReplayStats {
    return {
      replaysStarted: 0,
      replaysCompleted: 0,
      replaysFailed: 0,
      stepsPassed: 0,
      stepsFailed: 0,
      stepsSkipped: 0,
      totalDuration: 0,
      errors: 0,
    };
  }
  
  /**
   * Gets replay statistics
   */
  getStats(): ReplayStats {
    return { ...this.stats };
  }
  
  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }
  
  /**
   * Gets step results
   */
  getStepResults(): StepResult[] {
    return [...this.stepResults];
  }
  
  /**
   * Updates replay options
   */
  updateOptions(options: Partial<ReplayOptions>): void {
    this._options = { ...this._options, ...options };
  }
  
  /**
   * Destroys the controller
   */
  async destroy(): Promise<void> {
    await this.stop();
    
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];
    
    this.breakpoints.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new ReplayController
 * 
 * @param config - Controller configuration
 * @returns New ReplayController instance
 */
export function createReplayController(
  config?: ReplayControllerConfig
): ReplayController {
  return new ReplayController(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ReplayController;
