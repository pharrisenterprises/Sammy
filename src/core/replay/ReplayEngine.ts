/**
 * ReplayEngine - Main Replay Orchestrator
 * @module core/replay/ReplayEngine
 * @version 1.0.0
 * 
 * Orchestrates the execution of recorded steps with lifecycle management,
 * state tracking, and event callbacks. Implements the IReplayEngine interface.
 * 
 * ## Lifecycle
 * - start(steps): Begin executing steps
 * - pause(): Pause execution at current step
 * - resume(): Continue from paused state
 * - stop(): Stop execution completely
 * - reset(): Return to idle state
 * 
 * ## Events
 * - onStepStart: Called before each step
 * - onStepComplete: Called after each step
 * - onProgress: Called with progress updates
 * - onComplete: Called when all steps finish
 * - onError: Called on fatal errors
 * 
 * @example
 * ```typescript
 * const engine = new ReplayEngine();
 * 
 * engine.onProgress((progress) => {
 *   console.log(`${progress.percentage}% complete`);
 * });
 * 
 * const result = await engine.start(steps, { csvValues });
 * ```
 */

import type { Step } from '../types/Step';
import type {
  IReplayEngine,
  ExecutionContext,
  ExecutionResult,
  ExecutionSummary,
} from './IReplayEngine';
import {
  ReplayStateManager,
  createReplayStateManager,
  type ReplayLifecycle,
  type ReplayProgress,
  type ReplayTiming,
  type StateChangeEvent,
} from './ReplayState';
import {
  type ReplayConfig,
  type FlatReplayConfig,
  getDefaultReplayConfig,
  getReplayPreset,
  flattenReplayConfig,
  type ReplayPreset,
} from './ReplayConfig';
import {
  StepExecutor,
  createStepExecutor,
  type StepExecutionContext,
  type StepExecutionResult,
  type StepExecutionOptions,
} from './StepExecutor';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay engine configuration
 */
export interface ReplayEngineConfig {
  /** Step execution options */
  execution?: Partial<StepExecutionOptions>;
  
  /** Replay configuration preset */
  preset?: ReplayPreset;
  
  /** Custom replay configuration */
  config?: Partial<ReplayConfig>;
  
  /** Whether to continue on step failure (default: false) */
  continueOnFailure?: boolean;
  
  /** Maximum consecutive failures before stopping (0 = unlimited) */
  maxConsecutiveFailures?: number;
  
  /** Delay between steps in ms (default: 0) */
  stepDelay?: number;
  
  /** Human-like delay range [min, max] in ms */
  humanDelay?: [number, number] | null;
}

/**
 * Default engine configuration
 */
export const DEFAULT_ENGINE_CONFIG: Required<ReplayEngineConfig> = {
  execution: {},
  preset: 'default',
  config: {},
  continueOnFailure: false,
  maxConsecutiveFailures: 0,
  stepDelay: 0,
  humanDelay: null,
};

/**
 * Callback types
 */
export type StepStartCallback = (step: Step, index: number) => void;
export type StepCompleteCallback = (result: StepExecutionResult, index: number) => void;
export type ProgressCallback = (progress: ReplayProgress) => void;
export type CompleteCallback = (summary: ExecutionSummary) => void;
export type ErrorCallback = (error: Error, step?: Step, index?: number) => void;
export type StateChangeCallback = (event: StateChangeEvent) => void;

/**
 * Replay engine events
 */
export interface ReplayEngineEvents {
  onStepStart?: StepStartCallback;
  onStepComplete?: StepCompleteCallback;
  onProgress?: ProgressCallback;
  onComplete?: CompleteCallback;
  onError?: ErrorCallback;
  onStateChange?: StateChangeCallback;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get random delay within range
 */
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Create execution summary from results
 */
function createSummary(
  results: StepExecutionResult[],
  startTime: number,
  endTime: number
): ExecutionSummary {
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  
  return {
    totalSteps: results.length,
    passedSteps: passed,
    failedSteps: failed,
    skippedSteps: skipped,
    duration: endTime - startTime,
    success: failed === 0,
    results,
  };
}

// ============================================================================
// REPLAY ENGINE CLASS
// ============================================================================

/**
 * Main replay engine implementation
 */
export class ReplayEngine implements IReplayEngine {
  private stateManager: ReplayStateManager;
  private stepExecutor: StepExecutor;
  private config: Required<ReplayEngineConfig>;
  private events: ReplayEngineEvents;
  
  // Execution state
  private steps: Step[] = [];
  private results: StepExecutionResult[] = [];
  private context: StepExecutionContext = {};
  private currentStepIndex: number = 0;
  private consecutiveFailures: number = 0;
  private executionPromise: Promise<ExecutionSummary> | null = null;
  private resolveExecution: ((summary: ExecutionSummary) => void) | null = null;
  
  constructor(config?: Partial<ReplayEngineConfig>) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.events = {};
    
    // Initialize state manager
    this.stateManager = createReplayStateManager();
    this.stateManager.onStateChange((event) => {
      this.events.onStateChange?.(event);
    });
    
    // Initialize step executor with configuration
    const executionOptions = this.buildExecutionOptions();
    this.stepExecutor = createStepExecutor(executionOptions);
  }
  
  /**
   * Build execution options from config
   */
  private buildExecutionOptions(): Partial<StepExecutionOptions> {
    const replayConfig = this.config.preset
      ? getReplayPreset(this.config.preset)
      : getDefaultReplayConfig();
    
    return {
      findTimeout: replayConfig.timing.findTimeout,
      retryInterval: replayConfig.timing.retryInterval,
      maxRetries: replayConfig.timing.maxRetries,
      humanLike: replayConfig.behavior.humanLikeMouse,
      scrollIntoView: replayConfig.behavior.scrollIntoView,
      highlightElement: replayConfig.visual.highlightElements,
      highlightDuration: replayConfig.visual.highlightDuration,
      skipOnNotFound: false, // Don't skip - let ReplayEngine handle continueOnFailure
      preActionDelay: replayConfig.timing.preClickDelay,
      postActionDelay: replayConfig.timing.postClickDelay,
      ...this.config.execution,
    };
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Start executing steps
   */
  async start(
    steps: Step[],
    context?: ExecutionContext
  ): Promise<ExecutionSummary> {
    // Validate state
    if (!this.stateManager.canStart()) {
      throw new Error(`Cannot start from state: ${this.stateManager.getLifecycle()}`);
    }
    
    // Validate steps
    if (!steps || steps.length === 0) {
      throw new Error('No steps to execute');
    }
    
    // Initialize execution state
    this.steps = [...steps];
    this.results = [];
    this.currentStepIndex = 0;
    this.consecutiveFailures = 0;
    
    // Set context
    this.context = {
      document: context?.document,
      csvValues: context?.csvValues,
      fieldMappings: context?.fieldMappings,
      pageUrl: context?.pageUrl,
      tabId: context?.tabId,
    };
    
    // Start state machine
    this.stateManager.start(steps.length);
    
    // Create execution promise
    this.executionPromise = new Promise((resolve) => {
      this.resolveExecution = resolve;
    });
    
    // Begin execution loop
    this.executeLoop();
    
    return this.executionPromise;
  }
  
  /**
   * Pause execution
   */
  pause(): void {
    if (!this.stateManager.canPause()) {
      throw new Error(`Cannot pause from state: ${this.stateManager.getLifecycle()}`);
    }
    
    this.stateManager.pause();
  }
  
  /**
   * Resume execution
   */
  resume(): void {
    if (!this.stateManager.canResume()) {
      throw new Error(`Cannot resume from state: ${this.stateManager.getLifecycle()}`);
    }
    
    this.stateManager.resume();
    
    // Continue execution loop
    this.executeLoop();
  }
  
  /**
   * Stop execution
   */
  stop(): void {
    if (!this.stateManager.canStop()) {
      throw new Error(`Cannot stop from state: ${this.stateManager.getLifecycle()}`);
    }
    
    this.stateManager.stop();
    
    // Resolve with current results
    this.finishExecution('stopped');
  }
  
  /**
   * Reset to idle state
   */
  reset(): void {
    this.stateManager.reset();
    
    this.steps = [];
    this.results = [];
    this.currentStepIndex = 0;
    this.consecutiveFailures = 0;
    this.executionPromise = null;
    this.resolveExecution = null;
  }
  
  // ==========================================================================
  // EXECUTION LOOP
  // ==========================================================================
  
  /**
   * Main execution loop
   */
  private async executeLoop(): Promise<void> {
    while (this.currentStepIndex < this.steps.length) {
      // Check if paused or stopped
      if (this.stateManager.isPaused() || this.stateManager.isStopped()) {
        return;
      }
      
      // Check for error state
      if (this.stateManager.isError()) {
        return;
      }
      
      const step = this.steps[this.currentStepIndex];
      
      try {
        // Apply step delay
        await this.applyStepDelay();
        
        // Check again after delay
        if (this.stateManager.isPaused() || this.stateManager.isStopped()) {
          return;
        }
        
        // Update current step
        this.stateManager.setCurrentStep(this.currentStepIndex);
        
        // Emit step start
        this.events.onStepStart?.(step, this.currentStepIndex);
        
        // Execute step
        const result = await this.stepExecutor.execute(step, this.context);
        
        // Record result
        this.results.push(result);
        this.stateManager.completeStep(result);
        
        // Emit step complete
        this.events.onStepComplete?.(result, this.currentStepIndex);
        
        // Emit progress
        this.events.onProgress?.(this.stateManager.getProgress());
        
        // Handle failure
        if (!result.success) {
          this.consecutiveFailures++;
          
          // Emit error event
          const error = new Error(result.error || 'Step failed');
          this.events.onError?.(error, step, this.currentStepIndex);
          
          // Check max consecutive failures
          if (
            this.config.maxConsecutiveFailures > 0 &&
            this.consecutiveFailures >= this.config.maxConsecutiveFailures
          ) {
            this.stateManager.setError(
              `Max consecutive failures (${this.config.maxConsecutiveFailures}) reached`
            );
            this.finishExecution('error');
            return;
          }
          
          // Stop on failure unless continueOnFailure is true
          if (!this.config.continueOnFailure) {
            this.stateManager.setError(result.error || 'Step failed');
            this.finishExecution('error');
            return;
          }
        } else {
          this.consecutiveFailures = 0;
        }
        
        // Move to next step
        this.currentStepIndex++;
        
      } catch (error) {
        // Handle unexpected errors
        const err = error instanceof Error ? error : new Error(String(error));
        
        this.events.onError?.(err, step, this.currentStepIndex);
        this.stateManager.setError(err.message);
        this.finishExecution('error');
        return;
      }
    }
    
    // All steps completed
    this.stateManager.complete();
    this.finishExecution('completed');
  }
  
  /**
   * Apply delay between steps
   */
  private async applyStepDelay(): Promise<void> {
    let delay = this.config.stepDelay;
    
    if (this.config.humanDelay) {
      const [min, max] = this.config.humanDelay;
      delay = getRandomDelay(min, max);
    }
    
    if (delay > 0) {
      await sleep(delay);
    }
  }
  
  /**
   * Finish execution and resolve promise
   */
  private finishExecution(reason: 'completed' | 'stopped' | 'error'): void {
    const timing = this.stateManager.getTiming();
    const summary = createSummary(
      this.results,
      timing.startTime || Date.now(),
      timing.endTime || Date.now()
    );
    
    // Emit complete callback
    this.events.onComplete?.(summary);
    
    // Resolve promise
    if (this.resolveExecution) {
      this.resolveExecution(summary);
      this.resolveExecution = null;
    }
  }
  
  // ==========================================================================
  // SINGLE STEP EXECUTION (IReplayEngine interface)
  // ==========================================================================
  
  /**
   * Execute a single step
   */
  async execute(
    step: Step,
    context?: ExecutionContext
  ): Promise<ExecutionResult> {
    const execContext: StepExecutionContext = {
      document: context?.document,
      csvValues: context?.csvValues,
      fieldMappings: context?.fieldMappings,
      pageUrl: context?.pageUrl,
      tabId: context?.tabId,
    };
    
    return this.stepExecutor.execute(step, execContext);
  }
  
  /**
   * Execute all steps (wrapper for start)
   */
  async executeAll(
    steps: Step[],
    context?: ExecutionContext
  ): Promise<ExecutionSummary> {
    return this.start(steps, context);
  }
  
  // ==========================================================================
  // STATE ACCESSORS
  // ==========================================================================
  
  /**
   * Get current lifecycle state
   */
  getLifecycle(): ReplayLifecycle {
    return this.stateManager.getLifecycle();
  }
  
  /**
   * Get current progress
   */
  getProgress(): ReplayProgress {
    return this.stateManager.getProgress();
  }
  
  /**
   * Get timing information
   */
  getTiming(): ReplayTiming {
    return this.stateManager.getTiming();
  }
  
  /**
   * Get all results
   */
  getResults(): StepExecutionResult[] {
    return [...this.results];
  }
  
  /**
   * Get current step index
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }
  
  /**
   * Get state snapshot
   */
  getSnapshot() {
    return this.stateManager.getSnapshot();
  }
  
  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.stateManager.isRunning();
  }
  
  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.stateManager.isPaused();
  }
  
  /**
   * Check if idle
   */
  isIdle(): boolean {
    return this.stateManager.isIdle();
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get configuration
   */
  getConfig(): FlatReplayConfig {
    const replayConfig = this.config.preset
      ? getReplayPreset(this.config.preset)
      : getDefaultReplayConfig();
    return flattenReplayConfig(replayConfig);
  }
  
  /**
   * Set find timeout
   */
  setFindTimeout(ms: number): void {
    this.stepExecutor.setOptions({ findTimeout: ms });
  }
  
  /**
   * Set retry configuration
   */
  setRetryConfig(config: { interval?: number; maxRetries?: number }): void {
    this.stepExecutor.setOptions({
      retryInterval: config.interval,
      maxRetries: config.maxRetries,
    });
  }
  
  // ==========================================================================
  // EVENT REGISTRATION
  // ==========================================================================
  
  /**
   * Register step start callback
   */
  onStepStart(callback: StepStartCallback): void {
    this.events.onStepStart = callback;
  }
  
  /**
   * Register step complete callback
   */
  onStepComplete(callback: StepCompleteCallback): void {
    this.events.onStepComplete = callback;
  }
  
  /**
   * Register progress callback
   */
  onProgress(callback: ProgressCallback): void {
    this.events.onProgress = callback;
  }
  
  /**
   * Register complete callback
   */
  onComplete(callback: CompleteCallback): void {
    this.events.onComplete = callback;
  }
  
  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void {
    this.events.onError = callback;
  }
  
  /**
   * Register state change callback
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.events.onStateChange = callback;
    return () => {
      if (this.events.onStateChange === callback) {
        this.events.onStateChange = undefined;
      }
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a ReplayEngine
 */
export function createReplayEngine(
  config?: Partial<ReplayEngineConfig>
): ReplayEngine {
  return new ReplayEngine(config);
}

/**
 * Create a fast ReplayEngine (minimal delays)
 */
export function createFastReplayEngine(): ReplayEngine {
  return new ReplayEngine({
    preset: 'fast',
    stepDelay: 0,
    humanDelay: null,
  });
}

/**
 * Create a realistic ReplayEngine (human-like timing)
 */
export function createRealisticReplayEngine(): ReplayEngine {
  return new ReplayEngine({
    preset: 'realistic',
    stepDelay: 500,
    humanDelay: [50, 300],
  });
}

/**
 * Create a debug ReplayEngine (slow with visual feedback)
 */
export function createDebugReplayEngine(): ReplayEngine {
  return new ReplayEngine({
    preset: 'debug',
    stepDelay: 1000,
    humanDelay: [200, 500],
    continueOnFailure: true,
  });
}

/**
 * Create a tolerant ReplayEngine (continues on failure)
 */
export function createTolerantReplayEngine(): ReplayEngine {
  return new ReplayEngine({
    preset: 'tolerant',
    continueOnFailure: true,
    maxConsecutiveFailures: 5,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultEngine: ReplayEngine | null = null;

/**
 * Get default ReplayEngine
 */
export function getReplayEngine(): ReplayEngine {
  if (!defaultEngine) {
    defaultEngine = new ReplayEngine();
  }
  return defaultEngine;
}

/**
 * Reset default ReplayEngine
 */
export function resetReplayEngine(): void {
  if (defaultEngine) {
    defaultEngine.reset();
  }
  defaultEngine = null;
}
