/**
 * RecordingHandlers - Message handlers for recording control
 * @module background/handlers/RecordingHandlers
 * @version 1.0.0
 * 
 * Handles recording lifecycle operations:
 * - Start/stop recording sessions
 * - Pause/resume recording
 * - Capture and relay recorded steps
 * - Track recording state across tabs
 * 
 * @see recording-engine_breakdown.md for recording patterns
 */

import type { MessageReceiver, MessageHandler, ActionCategory } from '../MessageReceiver';
import type { BackgroundMessage, BackgroundResponse, MessageSender } from '../IBackgroundService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recording session status
 */
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopping';

/**
 * Recording session state
 */
export interface RecordingSession {
  projectId: number;
  tabId: number;
  status: RecordingStatus;
  startedAt: Date;
  pausedAt?: Date;
  stepCount: number;
  totalPausedTime: number;
}

/**
 * Recorded step from content script
 */
export interface RecordedStep {
  eventType: 'click' | 'input' | 'enter' | 'open' | 'navigation' | 'submit';
  xpath: string;
  value?: string;
  label?: string;
  x?: number;
  y?: number;
  timestamp: number;
  bundle: RecordedBundle;
  page?: string;
}

/**
 * Element locator bundle
 */
export interface RecordedBundle {
  tag: string;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  aria?: string;
  dataAttrs?: Record<string, string>;
  visibleText?: string;
  xpath: string;
  bounding?: { x: number; y: number; width: number; height: number };
  iframeChain?: number[];
}

/**
 * Start recording payload
 */
export interface StartRecordingPayload {
  projectId: number;
  tabId: number;
  url?: string;
}

/**
 * Stop recording payload
 */
export interface StopRecordingPayload {
  projectId?: number;
}

/**
 * Record step payload
 */
export interface RecordStepPayload {
  step: RecordedStep;
  projectId?: number;
}

/**
 * Recording state storage interface
 */
export interface IRecordingStateStorage {
  saveRecordingState(state: RecordingSession | null): Promise<void>;
  loadRecordingState(): Promise<RecordingSession | null>;
}

/**
 * Tab communication interface
 */
export interface ITabCommunication {
  sendToTab(tabId: number, message: unknown): Promise<unknown>;
}

/**
 * Step storage interface
 */
export interface IStepStorage {
  addStep(projectId: number, step: RecordedStep): Promise<void>;
  getSteps(projectId: number): Promise<RecordedStep[]>;
  clearSteps(projectId: number): Promise<void>;
}

/**
 * Recording event types
 */
export type RecordingEventType =
  | 'recording_started'
  | 'recording_stopped'
  | 'recording_paused'
  | 'recording_resumed'
  | 'step_recorded'
  | 'recording_error';

/**
 * Recording event
 */
export interface RecordingEvent {
  type: RecordingEventType;
  timestamp: Date;
  session?: RecordingSession;
  step?: RecordedStep;
  error?: string;
}

/**
 * Recording event listener
 */
export type RecordingEventListener = (event: RecordingEvent) => void;

/**
 * Recording action constants
 */
export const RECORDING_ACTIONS = {
  START_RECORDING: 'start_recording',
  STOP_RECORDING: 'stop_recording',
  PAUSE_RECORDING: 'pause_recording',
  RESUME_RECORDING: 'resume_recording',
  GET_RECORDING_STATUS: 'get_recording_status',
  RECORD_STEP: 'record_step',
  GET_RECORDED_STEPS: 'get_recorded_steps',
  CLEAR_RECORDED_STEPS: 'clear_recorded_steps',
} as const;

// ============================================================================
// RECORDING HANDLERS CLASS
// ============================================================================

/**
 * RecordingHandlers - Handles recording control messages
 * 
 * @example
 * ```typescript
 * const handlers = new RecordingHandlers(stateStorage, tabComm, stepStorage);
 * handlers.registerAll(messageReceiver);
 * 
 * // Or use factory function
 * const handlers = registerRecordingHandlers(receiver, deps);
 * ```
 */
export class RecordingHandlers {
  private stateStorage: IRecordingStateStorage;
  private tabCommunication: ITabCommunication;
  private stepStorage: IStepStorage;

  // Current session (in-memory for fast access)
  private currentSession: RecordingSession | null = null;

  // Recorded steps buffer
  private stepsBuffer: Map<number, RecordedStep[]> = new Map();

  // Event listeners
  private eventListeners: Set<RecordingEventListener> = new Set();

  // Statistics
  private stats = {
    sessionsStarted: 0,
    sessionsStopped: 0,
    stepsCaptured: 0,
    errors: 0,
  };

  /**
   * Create RecordingHandlers
   */
  constructor(
    stateStorage: IRecordingStateStorage,
    tabCommunication: ITabCommunication,
    stepStorage: IStepStorage
  ) {
    this.stateStorage = stateStorage;
    this.tabCommunication = tabCommunication;
    this.stepStorage = stepStorage;
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all handlers with message receiver
   */
  public registerAll(receiver: MessageReceiver): void {
    receiver.register(
      RECORDING_ACTIONS.START_RECORDING,
      this.handleStartRecording.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.STOP_RECORDING,
      this.handleStopRecording.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.PAUSE_RECORDING,
      this.handlePauseRecording.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.RESUME_RECORDING,
      this.handleResumeRecording.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.GET_RECORDING_STATUS,
      this.handleGetRecordingStatus.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.RECORD_STEP,
      this.handleRecordStep.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.GET_RECORDED_STEPS,
      this.handleGetRecordedSteps.bind(this),
      'recording'
    );
    receiver.register(
      RECORDING_ACTIONS.CLEAR_RECORDED_STEPS,
      this.handleClearRecordedSteps.bind(this),
      'recording'
    );
  }

  /**
   * Get handler entries for manual registration
   */
  public getHandlerEntries(): Array<{
    action: string;
    handler: MessageHandler;
    category: ActionCategory;
  }> {
    return [
      { action: RECORDING_ACTIONS.START_RECORDING, handler: this.handleStartRecording.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.STOP_RECORDING, handler: this.handleStopRecording.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.PAUSE_RECORDING, handler: this.handlePauseRecording.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.RESUME_RECORDING, handler: this.handleResumeRecording.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.GET_RECORDING_STATUS, handler: this.handleGetRecordingStatus.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.RECORD_STEP, handler: this.handleRecordStep.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.GET_RECORDED_STEPS, handler: this.handleGetRecordedSteps.bind(this), category: 'recording' },
      { action: RECORDING_ACTIONS.CLEAR_RECORDED_STEPS, handler: this.handleClearRecordedSteps.bind(this), category: 'recording' },
    ];
  }

  // ==========================================================================
  // HANDLER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Handle start_recording
   */
  public async handleStartRecording(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as StartRecordingPayload;

      // Validate required fields
      if (!payload?.projectId) {
        return { success: false, error: 'projectId is required' };
      }
      if (!payload?.tabId) {
        return { success: false, error: 'tabId is required' };
      }

      // Check if already recording
      if (this.currentSession && this.currentSession.status === 'recording') {
        return {
          success: false,
          error: `Already recording for project ${this.currentSession.projectId}`,
        };
      }

      // Create new session
      const session: RecordingSession = {
        projectId: payload.projectId,
        tabId: payload.tabId,
        status: 'recording',
        startedAt: new Date(),
        stepCount: 0,
        totalPausedTime: 0,
      };

      // Initialize steps buffer
      this.stepsBuffer.set(payload.projectId, []);

      // Save state
      this.currentSession = session;
      await this.stateStorage.saveRecordingState(session);

      // Notify content script to start capturing
      try {
        await this.tabCommunication.sendToTab(payload.tabId, {
          action: 'enable_recording',
          projectId: payload.projectId,
        });
      } catch (tabError) {
        // Tab communication failed, but recording state is set
        console.warn('[RecordingHandlers] Failed to notify tab:', tabError);
      }

      this.stats.sessionsStarted++;
      this.emitEvent({
        type: 'recording_started',
        timestamp: new Date(),
        session,
      });

      return {
        success: true,
        data: { session },
      };

    } catch (error) {
      this.stats.errors++;
      this.emitEvent({
        type: 'recording_error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      };
    }
  }

  /**
   * Handle stop_recording
   */
  public async handleStopRecording(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as StopRecordingPayload | undefined;

      // Check if recording
      if (!this.currentSession) {
        return { success: false, error: 'No active recording session' };
      }

      // Validate project if specified
      if (payload?.projectId && payload.projectId !== this.currentSession.projectId) {
        return {
          success: false,
          error: `Not recording project ${payload.projectId}`,
        };
      }

      const projectId = this.currentSession.projectId;
      const tabId = this.currentSession.tabId;

      // Mark as stopping
      this.currentSession.status = 'stopping';

      // Notify content script to stop capturing
      try {
        await this.tabCommunication.sendToTab(tabId, {
          action: 'disable_recording',
        });
      } catch (tabError) {
        console.warn('[RecordingHandlers] Failed to notify tab:', tabError);
      }

      // Get captured steps
      const steps = this.stepsBuffer.get(projectId) ?? [];

      // Save steps to persistent storage
      for (const step of steps) {
        await this.stepStorage.addStep(projectId, step);
      }

      // Clear session
      const finalSession = { ...this.currentSession, status: 'idle' as RecordingStatus };
      this.currentSession = null;
      await this.stateStorage.saveRecordingState(null);

      // Clear buffer
      this.stepsBuffer.delete(projectId);

      this.stats.sessionsStopped++;
      this.emitEvent({
        type: 'recording_stopped',
        timestamp: new Date(),
        session: finalSession,
      });

      return {
        success: true,
        data: {
          projectId,
          stepCount: steps.length,
          steps,
        },
      };

    } catch (error) {
      this.stats.errors++;
      this.emitEvent({
        type: 'recording_error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop recording',
      };
    }
  }

  /**
   * Handle pause_recording
   */
  public async handlePauseRecording(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active recording session' };
      }

      if (this.currentSession.status !== 'recording') {
        return { success: false, error: `Cannot pause: status is ${this.currentSession.status}` };
      }

      // Update status
      this.currentSession.status = 'paused';
      this.currentSession.pausedAt = new Date();

      // Save state
      await this.stateStorage.saveRecordingState(this.currentSession);

      // Notify content script
      try {
        await this.tabCommunication.sendToTab(this.currentSession.tabId, {
          action: 'pause_recording',
        });
      } catch (tabError) {
        console.warn('[RecordingHandlers] Failed to notify tab:', tabError);
      }

      this.emitEvent({
        type: 'recording_paused',
        timestamp: new Date(),
        session: this.currentSession,
      });

      return {
        success: true,
        data: { session: this.currentSession },
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause recording',
      };
    }
  }

  /**
   * Handle resume_recording
   */
  public async handleResumeRecording(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active recording session' };
      }

      if (this.currentSession.status !== 'paused') {
        return { success: false, error: `Cannot resume: status is ${this.currentSession.status}` };
      }

      // Calculate paused time
      if (this.currentSession.pausedAt) {
        const pausedDuration = Date.now() - this.currentSession.pausedAt.getTime();
        this.currentSession.totalPausedTime += pausedDuration;
      }

      // Update status
      this.currentSession.status = 'recording';
      this.currentSession.pausedAt = undefined;

      // Save state
      await this.stateStorage.saveRecordingState(this.currentSession);

      // Notify content script
      try {
        await this.tabCommunication.sendToTab(this.currentSession.tabId, {
          action: 'resume_recording',
        });
      } catch (tabError) {
        console.warn('[RecordingHandlers] Failed to notify tab:', tabError);
      }

      this.emitEvent({
        type: 'recording_resumed',
        timestamp: new Date(),
        session: this.currentSession,
      });

      return {
        success: true,
        data: { session: this.currentSession },
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume recording',
      };
    }
  }

  /**
   * Handle get_recording_status
   */
  public async handleGetRecordingStatus(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      // Try to restore from storage if no current session
      if (!this.currentSession) {
        const storedSession = await this.stateStorage.loadRecordingState();
        if (storedSession) {
          this.currentSession = storedSession;
        }
      }

      return {
        success: true,
        data: {
          isRecording: this.currentSession?.status === 'recording',
          isPaused: this.currentSession?.status === 'paused',
          session: this.currentSession,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      };
    }
  }

  /**
   * Handle record_step (from content script)
   */
  public async handleRecordStep(
    message: BackgroundMessage,
    sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as RecordStepPayload;

      if (!payload?.step) {
        return { success: false, error: 'step is required' };
      }

      // Check if recording
      if (!this.currentSession || this.currentSession.status !== 'recording') {
        return { success: false, error: 'Not currently recording' };
      }

      // Use project from session if not specified
      const projectId = payload.projectId ?? this.currentSession.projectId;

      // Validate tab if sender has tab info
      if (sender.tab?.id && sender.tab.id !== this.currentSession.tabId) {
        // Step from different tab - might be iframe or popup
        // Allow it but log for debugging
        console.debug('[RecordingHandlers] Step from different tab:', sender.tab.id);
      }

      // Add to buffer
      let buffer = this.stepsBuffer.get(projectId);
      if (!buffer) {
        buffer = [];
        this.stepsBuffer.set(projectId, buffer);
      }

      // Add timestamp if not present
      const step: RecordedStep = {
        ...payload.step,
        timestamp: payload.step.timestamp ?? Date.now(),
      };

      buffer.push(step);
      this.currentSession.stepCount++;

      this.stats.stepsCaptured++;
      this.emitEvent({
        type: 'step_recorded',
        timestamp: new Date(),
        step,
        session: this.currentSession,
      });

      return {
        success: true,
        data: {
          stepIndex: buffer.length - 1,
          totalSteps: buffer.length,
        },
      };

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record step',
      };
    }
  }

  /**
   * Handle get_recorded_steps
   */
  public async handleGetRecordedSteps(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { projectId?: number } | undefined;
      const projectId = payload?.projectId ?? this.currentSession?.projectId;

      if (!projectId) {
        return { success: false, error: 'projectId is required' };
      }

      // First check buffer (current session)
      const bufferSteps = this.stepsBuffer.get(projectId) ?? [];

      // Then check persistent storage
      const storedSteps = await this.stepStorage.getSteps(projectId);

      // Combine (buffer has more recent)
      const allSteps = [...storedSteps, ...bufferSteps];

      return {
        success: true,
        data: {
          projectId,
          steps: allSteps,
          count: allSteps.length,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get steps',
      };
    }
  }

  /**
   * Handle clear_recorded_steps
   */
  public async handleClearRecordedSteps(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { projectId?: number } | undefined;
      const projectId = payload?.projectId ?? this.currentSession?.projectId;

      if (!projectId) {
        return { success: false, error: 'projectId is required' };
      }

      // Clear buffer
      this.stepsBuffer.delete(projectId);

      // Clear persistent storage
      await this.stepStorage.clearSteps(projectId);

      // Update session if active
      if (this.currentSession?.projectId === projectId) {
        this.currentSession.stepCount = 0;
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear steps',
      };
    }
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get current recording session
   */
  public getCurrentSession(): RecordingSession | null {
    return this.currentSession;
  }

  /**
   * Check if currently recording
   */
  public isRecording(): boolean {
    return this.currentSession?.status === 'recording';
  }

  /**
   * Check if paused
   */
  public isPaused(): boolean {
    return this.currentSession?.status === 'paused';
  }

  /**
   * Get buffered steps for project
   */
  public getBufferedSteps(projectId: number): RecordedStep[] {
    return this.stepsBuffer.get(projectId) ?? [];
  }

  /**
   * Get statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      sessionsStarted: 0,
      sessionsStopped: 0,
      stepsCaptured: 0,
      errors: 0,
    };
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to recording events
   */
  public onEvent(listener: RecordingEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: RecordingEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[RecordingHandlers] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // RESTORATION
  // ==========================================================================

  /**
   * Restore session from storage (on service worker wake)
   */
  public async restoreSession(): Promise<RecordingSession | null> {
    const stored = await this.stateStorage.loadRecordingState();
    if (stored) {
      this.currentSession = stored;
    }
    return stored;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create RecordingHandlers instance
 */
export function createRecordingHandlers(
  stateStorage: IRecordingStateStorage,
  tabCommunication: ITabCommunication,
  stepStorage: IStepStorage
): RecordingHandlers {
  return new RecordingHandlers(stateStorage, tabCommunication, stepStorage);
}

/**
 * Create and register RecordingHandlers
 */
export function registerRecordingHandlers(
  receiver: MessageReceiver,
  stateStorage: IRecordingStateStorage,
  tabCommunication: ITabCommunication,
  stepStorage: IStepStorage
): RecordingHandlers {
  const handlers = new RecordingHandlers(stateStorage, tabCommunication, stepStorage);
  handlers.registerAll(receiver);
  return handlers;
}
