/**
 * ReplayState - Replay Execution State Management
 * @module core/replay/ReplayState
 * @version 1.0.0
 * 
 * Manages execution state for the replay engine including
 * lifecycle, progress, step results, and timing information.
 * 
 * ## State Machine
 * ```
 * idle → running → paused → running → completed
 *                ↘         ↗
 *                  stopped
 * ```
 * 
 * ## Features
 * - Lifecycle state machine with valid transitions
 * - Progress tracking (step index, percentage)
 * - Step result accumulation
 * - Timing information (start, elapsed, ETA)
 * - State change event emission
 * - Immutable state snapshots
 * 
 * @example
 * ```typescript
 * const state = new ReplayStateManager();
 * 
 * state.onStateChange((newState) => {
 *   console.log('State:', newState.lifecycle);
 *   console.log('Progress:', newState.progress.percentage);
 * });
 * 
 * state.start(10); // 10 total steps
 * state.completeStep(result);
 * state.pause();
 * state.resume();
 * state.complete();
 * ```
 */

import type { ExecutionResult, ExecutionStatus } from './IReplayEngine';

// ============================================================================
// LIFECYCLE TYPES
// ============================================================================

/**
 * Replay lifecycle states
 */
export type ReplayLifecycle = 
  | 'idle'      // Not started
  | 'running'   // Executing steps
  | 'paused'    // Temporarily stopped
  | 'stopped'   // Manually stopped (cannot resume)
  | 'completed' // Finished all steps
  | 'error';    // Fatal error occurred

/**
 * Valid state transitions
 */
export const VALID_TRANSITIONS: Record<ReplayLifecycle, ReplayLifecycle[]> = {
  idle: ['running'],
  running: ['paused', 'stopped', 'completed', 'error'],
  paused: ['running', 'stopped'],
  stopped: ['idle'],
  completed: ['idle'],
  error: ['idle'],
};

// ============================================================================
// PROGRESS TYPES
// ============================================================================

/**
 * Progress information
 */
export interface ReplayProgress {
  /** Current step index (0-based) */
  currentStep: number;
  
  /** Total number of steps */
  totalSteps: number;
  
  /** Progress percentage (0-100) */
  percentage: number;
  
  /** Number of passed steps */
  passedSteps: number;
  
  /** Number of failed steps */
  failedSteps: number;
  
  /** Number of skipped steps */
  skippedSteps: number;
  
  /** Number of remaining steps */
  remainingSteps: number;
}

/**
 * Create empty progress
 */
export function createEmptyProgress(): ReplayProgress {
  return {
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    passedSteps: 0,
    failedSteps: 0,
    skippedSteps: 0,
    remainingSteps: 0,
  };
}

// ============================================================================
// TIMING TYPES
// ============================================================================

/**
 * Timing information
 */
export interface ReplayTiming {
  /** Execution start time (timestamp) */
  startTime: number | null;
  
  /** Execution end time (timestamp) */
  endTime: number | null;
  
  /** Total elapsed time in milliseconds */
  elapsedTime: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedRemaining: number | null;
  
  /** Average step duration in milliseconds */
  averageStepDuration: number;
  
  /** Time spent paused in milliseconds */
  pausedTime: number;
  
  /** Timestamp when paused (null if not paused) */
  pausedAt: number | null;
}

/**
 * Create empty timing
 */
export function createEmptyTiming(): ReplayTiming {
  return {
    startTime: null,
    endTime: null,
    elapsedTime: 0,
    estimatedRemaining: null,
    averageStepDuration: 0,
    pausedTime: 0,
    pausedAt: null,
  };
}

// ============================================================================
// STATE SNAPSHOT
// ============================================================================

/**
 * Complete replay state snapshot
 */
export interface ReplayStateSnapshot {
  /** Lifecycle state */
  lifecycle: ReplayLifecycle;
  
  /** Progress information */
  progress: ReplayProgress;
  
  /** Timing information */
  timing: ReplayTiming;
  
  /** Step results */
  results: ExecutionResult[];
  
  /** Current error (if in error state) */
  error: string | null;
  
  /** Whether execution can be paused */
  canPause: boolean;
  
  /** Whether execution can be resumed */
  canResume: boolean;
  
  /** Whether execution can be stopped */
  canStop: boolean;
  
  /** Whether a new execution can be started */
  canStart: boolean;
}

/**
 * Create empty state snapshot
 */
export function createEmptySnapshot(): ReplayStateSnapshot {
  return {
    lifecycle: 'idle',
    progress: createEmptyProgress(),
    timing: createEmptyTiming(),
    results: [],
    error: null,
    canPause: false,
    canResume: false,
    canStop: false,
    canStart: true,
  };
}

// ============================================================================
// STATE CHANGE EVENT
// ============================================================================

/**
 * State change event type
 */
export type StateChangeType =
  | 'lifecycle'
  | 'progress'
  | 'step-completed'
  | 'timing'
  | 'error'
  | 'reset';

/**
 * State change event
 */
export interface StateChangeEvent {
  /** Type of change */
  type: StateChangeType;
  
  /** Previous state */
  previousState: ReplayStateSnapshot;
  
  /** New state */
  newState: ReplayStateSnapshot;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * State change callback
 */
export type StateChangeCallback = (event: StateChangeEvent) => void;

// ============================================================================
// REPLAY STATE MANAGER CLASS
// ============================================================================

/**
 * Manages replay execution state
 * 
 * @example
 * ```typescript
 * const manager = new ReplayStateManager();
 * 
 * // Subscribe to changes
 * manager.onStateChange((event) => {
 *   updateUI(event.newState);
 * });
 * 
 * // Start execution
 * manager.start(steps.length);
 * 
 * // Update progress
 * manager.setCurrentStep(0);
 * manager.completeStep(result);
 * 
 * // Control execution
 * manager.pause();
 * manager.resume();
 * manager.complete();
 * ```
 */
export class ReplayStateManager {
  // State
  private lifecycle: ReplayLifecycle = 'idle';
  private progress: ReplayProgress = createEmptyProgress();
  private timing: ReplayTiming = createEmptyTiming();
  private results: ExecutionResult[] = [];
  private error: string | null = null;
  
  // Callbacks
  private callbacks: Set<StateChangeCallback> = new Set();
  
  // Timing helpers
  private stepDurations: number[] = [];
  
  /**
   * Create a new ReplayStateManager
   */
  constructor() {
    // Initialize with empty state
  }
  
  // ==========================================================================
  // STATE GETTERS
  // ==========================================================================
  
  /**
   * Get current lifecycle state
   */
  getLifecycle(): ReplayLifecycle {
    return this.lifecycle;
  }
  
  /**
   * Get current progress
   */
  getProgress(): ReplayProgress {
    return { ...this.progress };
  }
  
  /**
   * Get current timing
   */
  getTiming(): ReplayTiming {
    return { ...this.timing, elapsedTime: this.calculateElapsedTime() };
  }
  
  /**
   * Get all results
   */
  getResults(): ExecutionResult[] {
    return [...this.results];
  }
  
  /**
   * Get current error
   */
  getError(): string | null {
    return this.error;
  }
  
  /**
   * Get complete state snapshot
   */
  getSnapshot(): ReplayStateSnapshot {
    return {
      lifecycle: this.lifecycle,
      progress: this.getProgress(),
      timing: this.getTiming(),
      results: this.getResults(),
      error: this.error,
      canPause: this.canPause(),
      canResume: this.canResume(),
      canStop: this.canStop(),
      canStart: this.canStart(),
    };
  }
  
  // ==========================================================================
  // STATE PREDICATES
  // ==========================================================================
  
  /**
   * Check if currently running
   */
  isRunning(): boolean {
    return this.lifecycle === 'running';
  }
  
  /**
   * Check if currently paused
   */
  isPaused(): boolean {
    return this.lifecycle === 'paused';
  }
  
  /**
   * Check if stopped
   */
  isStopped(): boolean {
    return this.lifecycle === 'stopped';
  }
  
  /**
   * Check if completed
   */
  isCompleted(): boolean {
    return this.lifecycle === 'completed';
  }
  
  /**
   * Check if in error state
   */
  isError(): boolean {
    return this.lifecycle === 'error';
  }
  
  /**
   * Check if idle
   */
  isIdle(): boolean {
    return this.lifecycle === 'idle';
  }
  
  /**
   * Check if execution is active (running or paused)
   */
  isActive(): boolean {
    return this.lifecycle === 'running' || this.lifecycle === 'paused';
  }
  
  /**
   * Check if can pause
   */
  canPause(): boolean {
    return this.lifecycle === 'running';
  }
  
  /**
   * Check if can resume
   */
  canResume(): boolean {
    return this.lifecycle === 'paused';
  }
  
  /**
   * Check if can stop
   */
  canStop(): boolean {
    return this.lifecycle === 'running' || this.lifecycle === 'paused';
  }
  
  /**
   * Check if can start
   */
  canStart(): boolean {
    return this.lifecycle === 'idle' || 
           this.lifecycle === 'completed' || 
           this.lifecycle === 'stopped' ||
           this.lifecycle === 'error';
  }
  
  // ==========================================================================
  // LIFECYCLE TRANSITIONS
  // ==========================================================================
  
  /**
   * Start execution
   */
  start(totalSteps: number): boolean {
    if (!this.canStart()) {
      return false;
    }
    
    const previousState = this.getSnapshot();
    
    // Reset state
    this.progress = {
      currentStep: 0,
      totalSteps,
      percentage: 0,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      remainingSteps: totalSteps,
    };
    
    this.timing = {
      startTime: Date.now(),
      endTime: null,
      elapsedTime: 0,
      estimatedRemaining: null,
      averageStepDuration: 0,
      pausedTime: 0,
      pausedAt: null,
    };
    
    this.results = [];
    this.stepDurations = [];
    this.error = null;
    
    this.lifecycle = 'running';
    
    this.emitChange('lifecycle', previousState);
    return true;
  }
  
  /**
   * Pause execution
   */
  pause(): boolean {
    if (!this.canPause()) {
      return false;
    }
    
    const previousState = this.getSnapshot();
    
    this.lifecycle = 'paused';
    this.timing.pausedAt = Date.now();
    
    this.emitChange('lifecycle', previousState);
    return true;
  }
  
  /**
   * Resume execution
   */
  resume(): boolean {
    if (!this.canResume()) {
      return false;
    }
    
    const previousState = this.getSnapshot();
    
    // Calculate paused time
    if (this.timing.pausedAt) {
      this.timing.pausedTime += Date.now() - this.timing.pausedAt;
      this.timing.pausedAt = null;
    }
    
    this.lifecycle = 'running';
    
    this.emitChange('lifecycle', previousState);
    return true;
  }
  
  /**
   * Stop execution
   */
  stop(): boolean {
    if (!this.canStop()) {
      return false;
    }
    
    const previousState = this.getSnapshot();
    
    this.lifecycle = 'stopped';
    this.timing.endTime = Date.now();
    
    // Clear pause state
    if (this.timing.pausedAt) {
      this.timing.pausedTime += Date.now() - this.timing.pausedAt;
      this.timing.pausedAt = null;
    }
    
    this.emitChange('lifecycle', previousState);
    return true;
  }
  
  /**
   * Complete execution
   */
  complete(): boolean {
    if (this.lifecycle !== 'running') {
      return false;
    }
    
    const previousState = this.getSnapshot();
    
    this.lifecycle = 'completed';
    this.timing.endTime = Date.now();
    this.progress.percentage = 100;
    
    this.emitChange('lifecycle', previousState);
    return true;
  }
  
  /**
   * Set error state
   */
  setError(error: string): boolean {
    if (this.lifecycle !== 'running') {
      return false;
    }
    
    const previousState = this.getSnapshot();
    
    this.lifecycle = 'error';
    this.error = error;
    this.timing.endTime = Date.now();
    
    this.emitChange('error', previousState);
    return true;
  }
  
  /**
   * Reset to idle state
   */
  reset(): void {
    const previousState = this.getSnapshot();
    
    this.lifecycle = 'idle';
    this.progress = createEmptyProgress();
    this.timing = createEmptyTiming();
    this.results = [];
    this.stepDurations = [];
    this.error = null;
    
    this.emitChange('reset', previousState);
  }
  
  // ==========================================================================
  // PROGRESS UPDATES
  // ==========================================================================
  
  /**
   * Set current step index
   */
  setCurrentStep(index: number): void {
    if (!this.isActive()) {
      return;
    }
    
    const previousState = this.getSnapshot();
    
    this.progress.currentStep = index;
    this.progress.percentage = this.calculatePercentage();
    this.progress.remainingSteps = this.progress.totalSteps - index;
    
    this.emitChange('progress', previousState);
  }
  
  /**
   * Complete a step with result
   */
  completeStep(result: ExecutionResult): void {
    if (!this.isActive()) {
      return;
    }
    
    const previousState = this.getSnapshot();
    
    // Add result
    this.results.push(result);
    
    // Update counters
    if (result.status === 'passed') {
      this.progress.passedSteps++;
    } else if (result.status === 'failed') {
      this.progress.failedSteps++;
    } else if (result.status === 'skipped') {
      this.progress.skippedSteps++;
    }
    
    // Track duration for ETA
    this.stepDurations.push(result.duration);
    this.timing.averageStepDuration = this.calculateAverageDuration();
    
    // Update progress
    this.progress.currentStep++;
    this.progress.percentage = this.calculatePercentage();
    this.progress.remainingSteps = this.progress.totalSteps - this.progress.currentStep;
    
    // Calculate ETA after updating remaining steps
    this.timing.estimatedRemaining = this.calculateEstimatedRemaining();
    
    this.emitChange('step-completed', previousState);
  }
  
  /**
   * Skip a step
   */
  skipStep(stepId: string): void {
    const result: ExecutionResult = {
      stepId,
      status: 'skipped',
      success: false,
      duration: 0,
      startTime: Date.now(),
      endTime: Date.now(),
    };
    this.completeStep(result);
  }
  
  // ==========================================================================
  // TIMING CALCULATIONS
  // ==========================================================================
  
  /**
   * Calculate elapsed time
   */
  private calculateElapsedTime(): number {
    if (!this.timing.startTime) {
      return 0;
    }
    
    const endTime = this.timing.endTime || Date.now();
    let elapsed = endTime - this.timing.startTime;
    
    // Subtract paused time
    elapsed -= this.timing.pausedTime;
    
    // Subtract current pause duration
    if (this.timing.pausedAt) {
      elapsed -= (Date.now() - this.timing.pausedAt);
    }
    
    return Math.max(0, elapsed);
  }
  
  /**
   * Calculate progress percentage
   */
  private calculatePercentage(): number {
    if (this.progress.totalSteps === 0) {
      return 0;
    }
    return Math.round((this.progress.currentStep / this.progress.totalSteps) * 100);
  }
  
  /**
   * Calculate average step duration
   */
  private calculateAverageDuration(): number {
    if (this.stepDurations.length === 0) {
      return 0;
    }
    const sum = this.stepDurations.reduce((a, b) => a + b, 0);
    return sum / this.stepDurations.length;
  }
  
  /**
   * Calculate estimated remaining time
   */
  private calculateEstimatedRemaining(): number | null {
    if (this.progress.remainingSteps === 0) {
      return 0;
    }
    
    if (this.timing.averageStepDuration === 0) {
      return null;
    }
    
    return this.progress.remainingSteps * this.timing.averageStepDuration;
  }
  
  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================
  
  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * Emit state change event
   */
  private emitChange(type: StateChangeType, previousState: ReplayStateSnapshot): void {
    const event: StateChangeEvent = {
      type,
      previousState,
      newState: this.getSnapshot(),
      timestamp: Date.now(),
    };
    
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('State change callback error:', error);
      }
    }
  }
  
  // ==========================================================================
  // RESULT QUERIES
  // ==========================================================================
  
  /**
   * Get result for a specific step
   */
  getResultForStep(stepIndex: number): ExecutionResult | null {
    return this.results[stepIndex] || null;
  }
  
  /**
   * Get last result
   */
  getLastResult(): ExecutionResult | null {
    return this.results[this.results.length - 1] || null;
  }
  
  /**
   * Get failed results
   */
  getFailedResults(): ExecutionResult[] {
    return this.results.filter(r => r.status === 'failed');
  }
  
  /**
   * Get passed results
   */
  getPassedResults(): ExecutionResult[] {
    return this.results.filter(r => r.status === 'passed');
  }
  
  /**
   * Check if all steps passed
   */
  allStepsPassed(): boolean {
    return this.progress.failedSteps === 0 && 
           this.progress.skippedSteps === 0 &&
           this.progress.passedSteps === this.progress.totalSteps;
  }
  
  /**
   * Get success rate (0-1)
   */
  getSuccessRate(): number {
    const completed = this.progress.passedSteps + this.progress.failedSteps;
    if (completed === 0) {
      return 0;
    }
    return this.progress.passedSteps / completed;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new ReplayStateManager
 */
export function createReplayStateManager(): ReplayStateManager {
  return new ReplayStateManager();
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let defaultStateManager: ReplayStateManager | null = null;

/**
 * Get the default state manager instance
 */
export function getReplayStateManager(): ReplayStateManager {
  if (!defaultStateManager) {
    defaultStateManager = new ReplayStateManager();
  }
  return defaultStateManager;
}

/**
 * Reset the default state manager
 */
export function resetReplayStateManager(): void {
  if (defaultStateManager) {
    defaultStateManager.reset();
  }
  defaultStateManager = null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format elapsed time as human-readable string
 */
export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Format ETA as human-readable string
 */
export function formatEta(ms: number | null): string {
  if (ms === null) {
    return 'Calculating...';
  }
  
  if (ms === 0) {
    return 'Complete';
  }
  
  return `~${formatElapsedTime(ms)} remaining`;
}

/**
 * Get lifecycle display name
 */
export function getLifecycleDisplayName(lifecycle: ReplayLifecycle): string {
  const names: Record<ReplayLifecycle, string> = {
    idle: 'Ready',
    running: 'Running',
    paused: 'Paused',
    stopped: 'Stopped',
    completed: 'Completed',
    error: 'Error',
  };
  return names[lifecycle];
}

/**
 * Get lifecycle color for UI
 */
export function getLifecycleColor(lifecycle: ReplayLifecycle): string {
  const colors: Record<ReplayLifecycle, string> = {
    idle: 'gray',
    running: 'blue',
    paused: 'yellow',
    stopped: 'orange',
    completed: 'green',
    error: 'red',
  };
  return colors[lifecycle];
}

/**
 * Check if transition is valid
 */
export function isValidTransition(from: ReplayLifecycle, to: ReplayLifecycle): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
