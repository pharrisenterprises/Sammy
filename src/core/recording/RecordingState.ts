/**
 * RecordingState - Recording Engine State Machine
 * @module core/recording/RecordingState
 * @version 1.0.0
 * 
 * Provides state machine management for the Recording Engine including:
 * - Immutable state transitions
 * - Valid transition enforcement
 * - Event emission on state changes
 * - Duration tracking (excluding paused time)
 * 
 * ## State Machine Diagram
 * 
 * ```
 *                    ┌─────────┐
 *                    │  idle   │◄────────────────┐
 *                    └────┬────┘                 │
 *                         │ start()              │
 *                         ▼                      │
 *                    ┌─────────┐                 │
 *          ┌────────►│recording│◄───────┐       │
 *          │         └────┬────┘        │       │
 *          │              │             │       │
 *          │   pause()    │    resume() │       │ stop()
 *          │              ▼             │       │ reset()
 *          │         ┌─────────┐        │       │
 *          │         │ paused  │────────┘       │
 *          │         └────┬────┘                │
 *          │              │ stop()              │
 *          │              │                     │
 *          │         ┌────▼────┐                │
 *          └─────────│stopping │────────────────┘
 *                    └─────────┘
 *                         
 *          Any state ──error()──► error ──reset()──► idle
 * ```
 * 
 * @see IRecordingEngine for interface contract
 * @see recording-engine_breakdown.md for implementation context
 */

import type {
  RecordingStatus,
  RecordingState,
  RecordingConfig,
  StateChangedEvent,
  RecordingEventHandler,
} from './IRecordingEngine';

import { INITIAL_RECORDING_STATE } from './IRecordingEngine';

// ============================================================================
// STATE TRANSITION TYPES
// ============================================================================

/**
 * Actions that can trigger state transitions
 */
export type StateAction =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'reset'
  | 'error'
  | 'increment_step'
  | 'decrement_step'
  | 'set_step_count';

/**
 * Payload for state actions
 */
export interface StateActionPayload {
  /** Session ID (for start action) */
  sessionId?: string;
  
  /** Error (for error action) */
  error?: Error;
  
  /** Step count (for set_step_count action) */
  stepCount?: number;
}

/**
 * Result of a state transition attempt
 */
export interface TransitionResult {
  /** Whether the transition was successful */
  success: boolean;
  
  /** The new state (same as previous if transition failed) */
  state: RecordingState;
  
  /** Error message if transition failed */
  error?: string;
  
  /** Previous state (for event emission) */
  previousState: RecordingState;
}

// ============================================================================
// STATE TRANSITION RULES
// ============================================================================

/**
 * Valid transitions from each state
 */
export const VALID_TRANSITIONS: Record<RecordingStatus, StateAction[]> = {
  idle: ['start', 'reset'],
  recording: ['stop', 'pause', 'error', 'increment_step', 'decrement_step', 'set_step_count'],
  paused: ['resume', 'stop', 'error', 'reset'],
  stopping: ['reset', 'error'],
  error: ['reset'],
};

/**
 * Target status for each action from each state
 */
export const TRANSITION_TARGETS: Record<RecordingStatus, Partial<Record<StateAction, RecordingStatus>>> = {
  idle: {
    start: 'recording',
    reset: 'idle',
  },
  recording: {
    stop: 'stopping',
    pause: 'paused',
    error: 'error',
    increment_step: 'recording',
    decrement_step: 'recording',
    set_step_count: 'recording',
  },
  paused: {
    resume: 'recording',
    stop: 'stopping',
    error: 'error',
    reset: 'idle',
  },
  stopping: {
    reset: 'idle',
    error: 'error',
  },
  error: {
    reset: 'idle',
  },
};

// ============================================================================
// STATE MANAGER CLASS
// ============================================================================

/**
 * Manages recording state with immutable transitions
 * 
 * @example
 * ```typescript
 * const manager = new RecordingStateManager();
 * 
 * // Subscribe to state changes
 * manager.subscribe((event) => {
 *   console.log('State changed:', event.currentState.status);
 * });
 * 
 * // Start recording
 * const result = manager.transition('start', { sessionId: 'session-123' });
 * if (result.success) {
 *   console.log('Recording started');
 * }
 * 
 * // Pause recording
 * manager.transition('pause');
 * 
 * // Resume recording
 * manager.transition('resume');
 * 
 * // Stop recording
 * manager.transition('stop');
 * ```
 */
export class RecordingStateManager {
  private _state: RecordingState;
  private _listeners: Set<RecordingEventHandler<StateChangedEvent>>;
  private _pausedDuration: number;
  
  /**
   * Create a new state manager
   * 
   * @param initialState - Optional initial state (defaults to INITIAL_RECORDING_STATE)
   */
  constructor(initialState?: Partial<RecordingState>) {
    this._state = {
      ...INITIAL_RECORDING_STATE,
      ...initialState,
    };
    this._listeners = new Set();
    this._pausedDuration = 0;
  }
  
  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================
  
  /**
   * Get current state (immutable copy)
   */
  get state(): RecordingState {
    return { ...this._state };
  }
  
  /**
   * Get current status
   */
  get status(): RecordingStatus {
    return this._state.status;
  }
  
  /**
   * Check if currently recording
   */
  get isRecording(): boolean {
    return this._state.isRecording;
  }
  
  /**
   * Check if currently paused
   */
  get isPaused(): boolean {
    return this._state.isPaused;
  }
  
  /**
   * Get current step count
   */
  get stepCount(): number {
    return this._state.stepCount;
  }
  
  /**
   * Get current duration (excluding paused time)
   */
  get duration(): number {
    return this.calculateDuration();
  }
  
  /**
   * Get session ID
   */
  get sessionId(): string | null {
    return this._state.sessionId;
  }
  
  /**
   * Get error if any
   */
  get error(): Error | null {
    return this._state.error;
  }
  
  // ==========================================================================
  // STATE TRANSITIONS
  // ==========================================================================
  
  /**
   * Attempt a state transition
   * 
   * @param action - Action to perform
   * @param payload - Optional payload for the action
   * @returns Transition result
   */
  transition(action: StateAction, payload?: StateActionPayload): TransitionResult {
    const previousState = { ...this._state };
    
    // Check if transition is valid
    if (!this.canTransition(action)) {
      return {
        success: false,
        state: previousState,
        previousState,
        error: `Invalid transition: cannot perform '${action}' from '${this._state.status}'`,
      };
    }
    
    // Perform the transition
    const newState = this.applyTransition(action, payload);
    this._state = newState;
    
    // Emit state change event
    this.emitStateChange(previousState, newState);
    
    return {
      success: true,
      state: { ...newState },
      previousState,
    };
  }
  
  /**
   * Check if a transition is valid from current state
   */
  canTransition(action: StateAction): boolean {
    const validActions = VALID_TRANSITIONS[this._state.status];
    return validActions.includes(action);
  }
  
  /**
   * Get list of valid actions from current state
   */
  getValidActions(): StateAction[] {
    return [...VALID_TRANSITIONS[this._state.status]];
  }
  
  /**
   * Apply a transition and return new state
   */
  private applyTransition(
    action: StateAction,
    payload?: StateActionPayload
  ): RecordingState {
    const now = Date.now();
    const targetStatus = TRANSITION_TARGETS[this._state.status][action];
    
    switch (action) {
      case 'start':
        return {
          status: 'recording',
          isRecording: true,
          isPaused: false,
          startedAt: now,
          pausedAt: null,
          duration: 0,
          stepCount: 0,
          sessionId: payload?.sessionId ?? generateSessionId(),
          error: null,
        };
      
      case 'stop':
        return {
          ...this._state,
          status: 'stopping',
          isRecording: false,
          isPaused: false,
          duration: this.calculateDuration(),
          pausedAt: null,
        };
      
      case 'pause':
        return {
          ...this._state,
          status: 'paused',
          isRecording: false,
          isPaused: true,
          pausedAt: now,
          duration: this.calculateDuration(),
        };
      
      case 'resume':
        // Calculate time spent paused
        const pauseDuration = this._state.pausedAt 
          ? now - this._state.pausedAt 
          : 0;
        this._pausedDuration += pauseDuration;
        
        return {
          ...this._state,
          status: 'recording',
          isRecording: true,
          isPaused: false,
          pausedAt: null,
        };
      
      case 'reset':
        this._pausedDuration = 0;
        return { ...INITIAL_RECORDING_STATE };
      
      case 'error':
        return {
          ...this._state,
          status: 'error',
          isRecording: false,
          isPaused: false,
          error: payload?.error ?? new Error('Unknown error'),
          duration: this.calculateDuration(),
        };
      
      case 'increment_step':
        return {
          ...this._state,
          stepCount: this._state.stepCount + 1,
        };
      
      case 'decrement_step':
        return {
          ...this._state,
          stepCount: Math.max(0, this._state.stepCount - 1),
        };
      
      case 'set_step_count':
        return {
          ...this._state,
          stepCount: Math.max(0, payload?.stepCount ?? 0),
        };
      
      default:
        return this._state;
    }
  }
  
  /**
   * Calculate current duration excluding paused time
   */
  private calculateDuration(): number {
    if (!this._state.startedAt) {
      return 0;
    }
    
    const now = Date.now();
    const totalElapsed = now - this._state.startedAt;
    
    // If currently paused, don't include time since pause started
    if (this._state.isPaused && this._state.pausedAt) {
      const currentPauseDuration = now - this._state.pausedAt;
      return totalElapsed - this._pausedDuration - currentPauseDuration;
    }
    
    return totalElapsed - this._pausedDuration;
  }
  
  // ==========================================================================
  // EVENT SUBSCRIPTION
  // ==========================================================================
  
  /**
   * Subscribe to state changes
   * 
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  subscribe(handler: RecordingEventHandler<StateChangedEvent>): () => void {
    this._listeners.add(handler);
    return () => this._listeners.delete(handler);
  }
  
  /**
   * Unsubscribe from state changes
   */
  unsubscribe(handler: RecordingEventHandler<StateChangedEvent>): void {
    this._listeners.delete(handler);
  }
  
  /**
   * Remove all listeners
   */
  clearListeners(): void {
    this._listeners.clear();
  }
  
  /**
   * Emit state change event to all listeners
   */
  private emitStateChange(
    previousState: RecordingState,
    currentState: RecordingState
  ): void {
    const event: StateChangedEvent = {
      type: 'state:changed',
      timestamp: Date.now(),
      sessionId: currentState.sessionId,
      previousState,
      currentState,
    };
    
    for (const handler of this._listeners) {
      try {
        handler(event);
      } catch (error) {
        console.error('[RecordingStateManager] Error in state change handler:', error);
      }
    }
  }
  
  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================
  
  /**
   * Start recording
   * 
   * @param sessionId - Optional session ID
   * @returns Transition result
   */
  start(sessionId?: string): TransitionResult {
    return this.transition('start', { sessionId });
  }
  
  /**
   * Stop recording
   * 
   * @returns Transition result
   */
  stop(): TransitionResult {
    return this.transition('stop');
  }
  
  /**
   * Pause recording
   * 
   * @returns Transition result
   */
  pause(): TransitionResult {
    return this.transition('pause');
  }
  
  /**
   * Resume recording
   * 
   * @returns Transition result
   */
  resume(): TransitionResult {
    return this.transition('resume');
  }
  
  /**
   * Reset to initial state
   * 
   * @returns Transition result
   */
  reset(): TransitionResult {
    return this.transition('reset');
  }
  
  /**
   * Set error state
   * 
   * @param error - Error that occurred
   * @returns Transition result
   */
  setError(error: Error): TransitionResult {
    return this.transition('error', { error });
  }
  
  /**
   * Increment step count
   * 
   * @returns Transition result
   */
  incrementStep(): TransitionResult {
    return this.transition('increment_step');
  }
  
  /**
   * Decrement step count
   * 
   * @returns Transition result
   */
  decrementStep(): TransitionResult {
    return this.transition('decrement_step');
  }
  
  /**
   * Set step count
   * 
   * @param count - New step count
   * @returns Transition result
   */
  setStepCount(count: number): TransitionResult {
    return this.transition('set_step_count', { stepCount: count });
  }
  
  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================
  
  /**
   * Serialize state for storage
   */
  toJSON(): Record<string, unknown> {
    return {
      ...this._state,
      error: this._state.error?.message ?? null,
      _pausedDuration: this._pausedDuration,
    };
  }
  
  /**
   * Restore state from serialized data
   */
  static fromJSON(data: Record<string, unknown>): RecordingStateManager {
    const manager = new RecordingStateManager();
    
    manager._state = {
      status: (data.status as RecordingStatus) ?? 'idle',
      isRecording: (data.isRecording as boolean) ?? false,
      isPaused: (data.isPaused as boolean) ?? false,
      startedAt: (data.startedAt as number) ?? null,
      pausedAt: (data.pausedAt as number) ?? null,
      duration: (data.duration as number) ?? 0,
      stepCount: (data.stepCount as number) ?? 0,
      sessionId: (data.sessionId as string) ?? null,
      error: data.error ? new Error(data.error as string) : null,
    };
    
    manager._pausedDuration = (data._pausedDuration as number) ?? 0;
    
    return manager;
  }
  
  /**
   * Create a snapshot of current state
   */
  snapshot(): RecordingStateSnapshot {
    return {
      state: { ...this._state },
      pausedDuration: this._pausedDuration,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Restore from snapshot
   */
  restore(snapshot: RecordingStateSnapshot): void {
    this._state = { ...snapshot.state };
    this._pausedDuration = snapshot.pausedDuration;
    
    // Emit state change (no previous state available)
    this.emitStateChange(INITIAL_RECORDING_STATE, this._state);
  }
}

// ============================================================================
// SNAPSHOT TYPE
// ============================================================================

/**
 * Snapshot of state manager for persistence
 */
export interface RecordingStateSnapshot {
  /** State at time of snapshot */
  state: RecordingState;
  
  /** Accumulated paused duration */
  pausedDuration: number;
  
  /** When snapshot was taken */
  timestamp: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `session_${timestamp}_${randomPart}`;
}

/**
 * Check if a status is active (recording or paused)
 */
export function isActiveStatus(status: RecordingStatus): boolean {
  return status === 'recording' || status === 'paused';
}

/**
 * Check if a status is terminal (idle or error)
 */
export function isTerminalStatus(status: RecordingStatus): boolean {
  return status === 'idle' || status === 'error';
}

/**
 * Check if a status allows step capture
 */
export function canCaptureSteps(status: RecordingStatus): boolean {
  return status === 'recording';
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: RecordingStatus): string {
  const labels: Record<RecordingStatus, string> = {
    idle: 'Ready',
    recording: 'Recording',
    paused: 'Paused',
    stopping: 'Stopping',
    error: 'Error',
  };
  return labels[status];
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: RecordingStatus): string {
  const colors: Record<RecordingStatus, string> = {
    idle: '#6b7280',     // gray
    recording: '#ef4444', // red (recording indicator)
    paused: '#f59e0b',   // amber
    stopping: '#3b82f6', // blue
    error: '#dc2626',    // dark red
  };
  return colors[status];
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

// ============================================================================
// STATE MACHINE VALIDATOR
// ============================================================================

/**
 * Validate state machine configuration
 * 
 * Ensures all states have valid transitions and no orphaned states
 */
export function validateStateMachine(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allStates = Object.keys(VALID_TRANSITIONS) as RecordingStatus[];
  
  for (const state of allStates) {
    const actions = VALID_TRANSITIONS[state];
    const targets = TRANSITION_TARGETS[state];
    
    // Check each action has a target
    for (const action of actions) {
      if (!(action in targets) && !['increment_step', 'decrement_step', 'set_step_count'].includes(action)) {
        errors.push(`State '${state}' has action '${action}' without target`);
      }
    }
    
    // Check each target is a valid state
    for (const [action, target] of Object.entries(targets)) {
      if (target && !allStates.includes(target)) {
        errors.push(`State '${state}' action '${action}' targets invalid state '${target}'`);
      }
    }
  }
  
  // Ensure 'idle' is reachable from all states via reset
  for (const state of allStates) {
    if (state !== 'idle' && !VALID_TRANSITIONS[state].includes('reset') && state !== 'recording') {
      // recording can reach idle via stop -> stopping -> reset
      if (state !== 'stopping') {
        errors.push(`State '${state}' cannot reach 'idle' state`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Re-export types from interface
  type RecordingStatus,
  type RecordingState,
  INITIAL_RECORDING_STATE,
};
