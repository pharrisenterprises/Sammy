/**
 * ReplayHandlers - Message handlers for replay control
 * @module background/handlers/ReplayHandlers
 * @version 1.0.0
 * 
 * Handles replay lifecycle operations:
 * - Start/stop replay sessions
 * - Pause/resume replay
 * - Execute individual steps
 * - Track replay progress and results
 * 
 * @see replay-engine_breakdown.md for replay patterns
 * @see test-orchestrator_breakdown.md for test execution flow
 */

import type { MessageReceiver, MessageHandler, ActionCategory } from '../MessageReceiver';
import type { BackgroundMessage, BackgroundResponse, MessageSender } from '../IBackgroundService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay session status
 */
export type ReplayStatus = 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'failed';

/**
 * Step execution result
 */
export type StepResultStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Replay session state
 */
export interface ReplaySession {
  projectId: number;
  testRunId?: number;
  tabId: number;
  status: ReplayStatus;
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
  currentStepIndex: number;
  totalSteps: number;
  currentRowIndex: number;
  totalRows: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalPausedTime: number;
}

/**
 * Step to execute
 */
export interface ReplayStep {
  index: number;
  eventType: 'click' | 'input' | 'enter' | 'open' | 'navigation' | 'submit';
  xpath: string;
  value?: string;
  label?: string;
  bundle: ReplayBundle;
}

/**
 * Element locator bundle for replay
 */
export interface ReplayBundle {
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
  shadowHosts?: string[];
}

/**
 * Step execution result
 */
export interface StepResult {
  stepIndex: number;
  rowIndex: number;
  status: StepResultStatus;
  duration: number;
  error?: string;
  screenshot?: string;
  timestamp: number;
}

/**
 * Start replay payload
 */
export interface StartReplayPayload {
  projectId: number;
  tabId: number;
  testRunId?: number;
  steps: ReplayStep[];
  csvRows?: Record<string, string>[];
  startFromStep?: number;
  startFromRow?: number;
}

/**
 * Execute step payload
 */
export interface ExecuteStepPayload {
  step: ReplayStep;
  rowIndex?: number;
  csvValues?: Record<string, string>;
  timeout?: number;
}

/**
 * Replay state storage interface
 */
export interface IReplayStateStorage {
  saveReplayState(state: ReplaySession | null): Promise<void>;
  loadReplayState(): Promise<ReplaySession | null>;
}

/**
 * Tab communication interface
 */
export interface ITabCommunication {
  sendToTab(tabId: number, message: unknown): Promise<unknown>;
}

/**
 * Result storage interface
 */
export interface IResultStorage {
  addResult(testRunId: number, result: StepResult): Promise<void>;
  getResults(testRunId: number): Promise<StepResult[]>;
  clearResults(testRunId: number): Promise<void>;
}

/**
 * Replay event types
 */
export type ReplayEventType =
  | 'replay_started'
  | 'replay_stopped'
  | 'replay_paused'
  | 'replay_resumed'
  | 'replay_completed'
  | 'replay_failed'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_skipped'
  | 'row_started'
  | 'row_completed'
  | 'replay_error';

/**
 * Replay event
 */
export interface ReplayEvent {
  type: ReplayEventType;
  timestamp: Date;
  session?: ReplaySession;
  stepResult?: StepResult;
  rowIndex?: number;
  error?: string;
}

/**
 * Replay event listener
 */
export type ReplayEventListener = (event: ReplayEvent) => void;

/**
 * Replay action constants
 */
export const REPLAY_ACTIONS = {
  START_REPLAY: 'start_replay',
  STOP_REPLAY: 'stop_replay',
  PAUSE_REPLAY: 'pause_replay',
  RESUME_REPLAY: 'resume_replay',
  GET_REPLAY_STATUS: 'get_replay_status',
  EXECUTE_STEP: 'execute_step',
  EXECUTE_NEXT_STEP: 'execute_next_step',
  SKIP_STEP: 'skip_step',
  GET_REPLAY_RESULTS: 'get_replay_results',
  STEP_RESULT: 'step_result',
} as const;

/**
 * Default step timeout in ms
 */
export const DEFAULT_STEP_TIMEOUT = 30000;

// ============================================================================
// REPLAY HANDLERS CLASS
// ============================================================================

/**
 * ReplayHandlers - Handles replay control messages
 * 
 * @example
 * ```typescript
 * const handlers = new ReplayHandlers(stateStorage, tabComm, resultStorage);
 * handlers.registerAll(messageReceiver);
 * 
 * // Or use factory function
 * const handlers = registerReplayHandlers(receiver, deps);
 * ```
 */
export class ReplayHandlers {
  private stateStorage: IReplayStateStorage;
  private tabCommunication: ITabCommunication;
  private resultStorage: IResultStorage;

  // Current session (in-memory for fast access)
  private currentSession: ReplaySession | null = null;

  // Steps and data for current replay
  private replaySteps: ReplayStep[] = [];
  private csvRows: Record<string, string>[] = [];

  // Results buffer
  private resultsBuffer: StepResult[] = [];

  // Event listeners
  private eventListeners: Set<ReplayEventListener> = new Set();

  // Statistics
  private stats = {
    sessionsStarted: 0,
    sessionsCompleted: 0,
    sessionsFailed: 0,
    stepsExecuted: 0,
    stepsPassed: 0,
    stepsFailed: 0,
    stepsSkipped: 0,
  };

  /**
   * Create ReplayHandlers
   */
  constructor(
    stateStorage: IReplayStateStorage,
    tabCommunication: ITabCommunication,
    resultStorage: IResultStorage
  ) {
    this.stateStorage = stateStorage;
    this.tabCommunication = tabCommunication;
    this.resultStorage = resultStorage;
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all handlers with message receiver
   */
  public registerAll(receiver: MessageReceiver): void {
    receiver.register(
      REPLAY_ACTIONS.START_REPLAY,
      this.handleStartReplay.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.STOP_REPLAY,
      this.handleStopReplay.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.PAUSE_REPLAY,
      this.handlePauseReplay.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.RESUME_REPLAY,
      this.handleResumeReplay.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.GET_REPLAY_STATUS,
      this.handleGetReplayStatus.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.EXECUTE_STEP,
      this.handleExecuteStep.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.EXECUTE_NEXT_STEP,
      this.handleExecuteNextStep.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.SKIP_STEP,
      this.handleSkipStep.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.GET_REPLAY_RESULTS,
      this.handleGetReplayResults.bind(this),
      'replay'
    );
    receiver.register(
      REPLAY_ACTIONS.STEP_RESULT,
      this.handleStepResult.bind(this),
      'replay'
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
      { action: REPLAY_ACTIONS.START_REPLAY, handler: this.handleStartReplay.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.STOP_REPLAY, handler: this.handleStopReplay.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.PAUSE_REPLAY, handler: this.handlePauseReplay.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.RESUME_REPLAY, handler: this.handleResumeReplay.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.GET_REPLAY_STATUS, handler: this.handleGetReplayStatus.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.EXECUTE_STEP, handler: this.handleExecuteStep.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.EXECUTE_NEXT_STEP, handler: this.handleExecuteNextStep.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.SKIP_STEP, handler: this.handleSkipStep.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.GET_REPLAY_RESULTS, handler: this.handleGetReplayResults.bind(this), category: 'replay' },
      { action: REPLAY_ACTIONS.STEP_RESULT, handler: this.handleStepResult.bind(this), category: 'replay' },
    ];
  }

  // ==========================================================================
  // HANDLER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Handle start_replay
   */
  public async handleStartReplay(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as StartReplayPayload;

      // Validate required fields
      if (!payload?.projectId) {
        return { success: false, error: 'projectId is required' };
      }
      if (!payload?.tabId) {
        return { success: false, error: 'tabId is required' };
      }
      if (!payload?.steps || payload.steps.length === 0) {
        return { success: false, error: 'steps are required' };
      }

      // Check if already running
      if (this.currentSession && this.currentSession.status === 'running') {
        return {
          success: false,
          error: `Already replaying project ${this.currentSession.projectId}`,
        };
      }

      // Store steps and CSV data
      this.replaySteps = payload.steps;
      this.csvRows = payload.csvRows ?? [{}]; // At least one empty row
      this.resultsBuffer = [];

      // Create new session
      const session: ReplaySession = {
        projectId: payload.projectId,
        testRunId: payload.testRunId,
        tabId: payload.tabId,
        status: 'running',
        startedAt: new Date(),
        currentStepIndex: payload.startFromStep ?? 0,
        totalSteps: payload.steps.length,
        currentRowIndex: payload.startFromRow ?? 0,
        totalRows: this.csvRows.length,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        totalPausedTime: 0,
      };

      // Save state
      this.currentSession = session;
      await this.stateStorage.saveReplayState(session);

      // Notify content script to prepare for replay
      try {
        await this.tabCommunication.sendToTab(payload.tabId, {
          action: 'prepare_replay',
          projectId: payload.projectId,
        });
      } catch (tabError) {
        console.warn('[ReplayHandlers] Failed to notify tab:', tabError);
      }

      this.stats.sessionsStarted++;
      this.emitEvent({
        type: 'replay_started',
        timestamp: new Date(),
        session,
      });

      return {
        success: true,
        data: { session },
      };

    } catch (error) {
      this.emitEvent({
        type: 'replay_error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start replay',
      };
    }
  }

  /**
   * Handle stop_replay
   */
  public async handleStopReplay(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active replay session' };
      }

      const tabId = this.currentSession.tabId;

      // Mark as stopping
      this.currentSession.status = 'stopping';

      // Notify content script
      try {
        await this.tabCommunication.sendToTab(tabId, {
          action: 'stop_replay',
        });
      } catch (tabError) {
        console.warn('[ReplayHandlers] Failed to notify tab:', tabError);
      }

      // Save results
      if (this.currentSession.testRunId) {
        for (const result of this.resultsBuffer) {
          await this.resultStorage.addResult(this.currentSession.testRunId, result);
        }
      }

      // Finalize session
      const finalSession = {
        ...this.currentSession,
        status: 'completed' as ReplayStatus,
        completedAt: new Date(),
      };

      // Clear session
      this.currentSession = null;
      this.replaySteps = [];
      this.csvRows = [];
      await this.stateStorage.saveReplayState(null);

      const results = [...this.resultsBuffer];
      this.resultsBuffer = [];

      this.stats.sessionsCompleted++;
      this.emitEvent({
        type: 'replay_stopped',
        timestamp: new Date(),
        session: finalSession,
      });

      return {
        success: true,
        data: {
          session: finalSession,
          results,
          summary: {
            passed: finalSession.passedSteps,
            failed: finalSession.failedSteps,
            skipped: finalSession.skippedSteps,
            total: finalSession.totalSteps * finalSession.totalRows,
          },
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop replay',
      };
    }
  }

  /**
   * Handle pause_replay
   */
  public async handlePauseReplay(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active replay session' };
      }

      if (this.currentSession.status !== 'running') {
        return { success: false, error: `Cannot pause: status is ${this.currentSession.status}` };
      }

      // Update status
      this.currentSession.status = 'paused';
      this.currentSession.pausedAt = new Date();

      // Save state
      await this.stateStorage.saveReplayState(this.currentSession);

      // Notify content script
      try {
        await this.tabCommunication.sendToTab(this.currentSession.tabId, {
          action: 'pause_replay',
        });
      } catch (tabError) {
        console.warn('[ReplayHandlers] Failed to notify tab:', tabError);
      }

      this.emitEvent({
        type: 'replay_paused',
        timestamp: new Date(),
        session: this.currentSession,
      });

      return {
        success: true,
        data: { session: this.currentSession },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause replay',
      };
    }
  }

  /**
   * Handle resume_replay
   */
  public async handleResumeReplay(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active replay session' };
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
      this.currentSession.status = 'running';
      this.currentSession.pausedAt = undefined;

      // Save state
      await this.stateStorage.saveReplayState(this.currentSession);

      // Notify content script
      try {
        await this.tabCommunication.sendToTab(this.currentSession.tabId, {
          action: 'resume_replay',
        });
      } catch (tabError) {
        console.warn('[ReplayHandlers] Failed to notify tab:', tabError);
      }

      this.emitEvent({
        type: 'replay_resumed',
        timestamp: new Date(),
        session: this.currentSession,
      });

      return {
        success: true,
        data: { session: this.currentSession },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume replay',
      };
    }
  }

  /**
   * Handle get_replay_status
   */
  public async handleGetReplayStatus(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      // Try to restore from storage if no current session
      if (!this.currentSession) {
        const storedSession = await this.stateStorage.loadReplayState();
        if (storedSession) {
          this.currentSession = storedSession;
        }
      }

      return {
        success: true,
        data: {
          isRunning: this.currentSession?.status === 'running',
          isPaused: this.currentSession?.status === 'paused',
          session: this.currentSession,
          progress: this.currentSession ? this.calculateProgress() : null,
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
   * Handle execute_step - Execute a specific step
   */
  public async handleExecuteStep(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as ExecuteStepPayload;

      if (!payload?.step) {
        return { success: false, error: 'step is required' };
      }

      if (!this.currentSession) {
        return { success: false, error: 'No active replay session' };
      }

      if (this.currentSession.status !== 'running') {
        return { success: false, error: `Cannot execute: status is ${this.currentSession.status}` };
      }

      const startTime = Date.now();
      const rowIndex = payload.rowIndex ?? this.currentSession.currentRowIndex;

      // Emit step started
      this.emitEvent({
        type: 'step_started',
        timestamp: new Date(),
        session: this.currentSession,
      });

      // Send step to content script
      try {
        const response = await this.tabCommunication.sendToTab(this.currentSession.tabId, {
          type: 'runStep',
          data: {
            event: payload.step.eventType,
            path: payload.step.xpath,
            value: this.substituteValue(payload.step.value, payload.csvValues),
            label: payload.step.label,
            bundle: payload.step.bundle,
          },
        }) as boolean | { success: boolean; error?: string };

        const duration = Date.now() - startTime;
        const success = typeof response === 'boolean' ? response : response?.success ?? false;

        // Create result
        const result: StepResult = {
          stepIndex: payload.step.index,
          rowIndex,
          status: success ? 'passed' : 'failed',
          duration,
          error: success ? undefined : (typeof response === 'object' ? response.error : 'Step execution failed'),
          timestamp: Date.now(),
        };

        // Update session
        if (success) {
          this.currentSession.passedSteps++;
          this.stats.stepsPassed++;
        } else {
          this.currentSession.failedSteps++;
          this.stats.stepsFailed++;
        }

        // Store result
        this.resultsBuffer.push(result);
        this.stats.stepsExecuted++;

        // Emit result
        this.emitEvent({
          type: success ? 'step_completed' : 'step_failed',
          timestamp: new Date(),
          session: this.currentSession,
          stepResult: result,
        });

        return {
          success: true,
          data: { result },
        };

      } catch (tabError) {
        const duration = Date.now() - startTime;
        const result: StepResult = {
          stepIndex: payload.step.index,
          rowIndex,
          status: 'failed',
          duration,
          error: tabError instanceof Error ? tabError.message : 'Tab communication failed',
          timestamp: Date.now(),
        };

        this.currentSession.failedSteps++;
        this.resultsBuffer.push(result);
        this.stats.stepsFailed++;
        this.stats.stepsExecuted++;

        this.emitEvent({
          type: 'step_failed',
          timestamp: new Date(),
          session: this.currentSession,
          stepResult: result,
        });

        return {
          success: false,
          error: result.error,
          data: { result },
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute step',
      };
    }
  }

  /**
   * Handle execute_next_step - Execute the next step in sequence
   */
  public async handleExecuteNextStep(
    message: BackgroundMessage,
    sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active replay session' };
      }

      if (this.currentSession.status !== 'running') {
        return { success: false, error: `Cannot execute: status is ${this.currentSession.status}` };
      }

      // Check if all steps completed for current row
      if (this.currentSession.currentStepIndex >= this.replaySteps.length) {
        // Move to next row
        this.currentSession.currentRowIndex++;
        this.currentSession.currentStepIndex = 0;

        this.emitEvent({
          type: 'row_completed',
          timestamp: new Date(),
          session: this.currentSession,
          rowIndex: this.currentSession.currentRowIndex - 1,
        });

        // Check if all rows completed
        if (this.currentSession.currentRowIndex >= this.csvRows.length) {
          // Replay complete
          this.currentSession.status = 'completed';
          this.currentSession.completedAt = new Date();

          await this.stateStorage.saveReplayState(this.currentSession);

          this.stats.sessionsCompleted++;
          this.emitEvent({
            type: 'replay_completed',
            timestamp: new Date(),
            session: this.currentSession,
          });

          return {
            success: true,
            data: {
              complete: true,
              session: this.currentSession,
            },
          };
        }

        // Start next row
        this.emitEvent({
          type: 'row_started',
          timestamp: new Date(),
          session: this.currentSession,
          rowIndex: this.currentSession.currentRowIndex,
        });
      }

      // Get next step
      const step = this.replaySteps[this.currentSession.currentStepIndex];
      const csvValues = this.csvRows[this.currentSession.currentRowIndex];

      // Increment step index
      this.currentSession.currentStepIndex++;
      await this.stateStorage.saveReplayState(this.currentSession);

      // Execute the step
      return this.handleExecuteStep(
        {
          action: REPLAY_ACTIONS.EXECUTE_STEP,
          payload: {
            step,
            rowIndex: this.currentSession.currentRowIndex,
            csvValues,
          },
        },
        sender
      );

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute next step',
      };
    }
  }

  /**
   * Handle skip_step - Skip the current step
   */
  public async handleSkipStep(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active replay session' };
      }

      if (this.currentSession.currentStepIndex >= this.replaySteps.length) {
        return { success: false, error: 'No step to skip' };
      }

      const stepIndex = this.currentSession.currentStepIndex;
      const rowIndex = this.currentSession.currentRowIndex;

      // Create skipped result
      const result: StepResult = {
        stepIndex,
        rowIndex,
        status: 'skipped',
        duration: 0,
        timestamp: Date.now(),
      };

      // Update session
      this.currentSession.skippedSteps++;
      this.currentSession.currentStepIndex++;
      this.resultsBuffer.push(result);
      this.stats.stepsSkipped++;

      await this.stateStorage.saveReplayState(this.currentSession);

      this.emitEvent({
        type: 'step_skipped',
        timestamp: new Date(),
        session: this.currentSession,
        stepResult: result,
      });

      return {
        success: true,
        data: { result },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to skip step',
      };
    }
  }

  /**
   * Handle get_replay_results - Get results for a test run
   */
  public async handleGetReplayResults(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { testRunId?: number } | undefined;
      const testRunId = payload?.testRunId ?? this.currentSession?.testRunId;

      // Current session buffer
      const bufferResults = [...this.resultsBuffer];

      // Stored results
      let storedResults: StepResult[] = [];
      if (testRunId) {
        storedResults = await this.resultStorage.getResults(testRunId);
      }

      // Combine (buffer is more recent)
      const allResults = [...storedResults, ...bufferResults];

      return {
        success: true,
        data: {
          testRunId,
          results: allResults,
          summary: {
            total: allResults.length,
            passed: allResults.filter(r => r.status === 'passed').length,
            failed: allResults.filter(r => r.status === 'failed').length,
            skipped: allResults.filter(r => r.status === 'skipped').length,
          },
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get results',
      };
    }
  }

  /**
   * Handle step_result - Receive step result from content script
   */
  public async handleStepResult(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { result: StepResult } | undefined;

      if (!payload?.result) {
        return { success: false, error: 'result is required' };
      }

      // Store result
      this.resultsBuffer.push(payload.result);

      // Update session if active
      if (this.currentSession) {
        if (payload.result.status === 'passed') {
          this.currentSession.passedSteps++;
        } else if (payload.result.status === 'failed') {
          this.currentSession.failedSteps++;
        } else if (payload.result.status === 'skipped') {
          this.currentSession.skippedSteps++;
        }
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record result',
      };
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Substitute CSV values into step value
   */
  private substituteValue(value: string | undefined, csvValues?: Record<string, string>): string | undefined {
    if (!value || !csvValues) {
      return value;
    }

    // Replace {{fieldName}} with CSV values
    return value.replace(/\{\{(\w+)\}\}/g, (_match, field) => {
      return csvValues[field] ?? '';
    });
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(): { percentage: number; stepsComplete: number; rowsComplete: number } {
    if (!this.currentSession) {
      return { percentage: 0, stepsComplete: 0, rowsComplete: 0 };
    }

    const totalOperations = this.currentSession.totalSteps * this.currentSession.totalRows;
    const completedOperations = 
      (this.currentSession.currentRowIndex * this.currentSession.totalSteps) +
      this.currentSession.currentStepIndex;

    return {
      percentage: totalOperations > 0 
        ? Math.round((completedOperations / totalOperations) * 100)
        : 0,
      stepsComplete: this.currentSession.currentStepIndex,
      rowsComplete: this.currentSession.currentRowIndex,
    };
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get current replay session
   */
  public getCurrentSession(): ReplaySession | null {
    return this.currentSession;
  }

  /**
   * Check if currently replaying
   */
  public isRunning(): boolean {
    return this.currentSession?.status === 'running';
  }

  /**
   * Check if paused
   */
  public isPaused(): boolean {
    return this.currentSession?.status === 'paused';
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
      sessionsCompleted: 0,
      sessionsFailed: 0,
      stepsExecuted: 0,
      stepsPassed: 0,
      stepsFailed: 0,
      stepsSkipped: 0,
    };
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to replay events
   */
  public onEvent(listener: ReplayEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: ReplayEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ReplayHandlers] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // RESTORATION
  // ==========================================================================

  /**
   * Restore session from storage (on service worker wake)
   */
  public async restoreSession(): Promise<ReplaySession | null> {
    const stored = await this.stateStorage.loadReplayState();
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
 * Create ReplayHandlers instance
 */
export function createReplayHandlers(
  stateStorage: IReplayStateStorage,
  tabCommunication: ITabCommunication,
  resultStorage: IResultStorage
): ReplayHandlers {
  return new ReplayHandlers(stateStorage, tabCommunication, resultStorage);
}

/**
 * Create and register ReplayHandlers
 */
export function registerReplayHandlers(
  receiver: MessageReceiver,
  stateStorage: IReplayStateStorage,
  tabCommunication: ITabCommunication,
  resultStorage: IResultStorage
): ReplayHandlers {
  const handlers = new ReplayHandlers(stateStorage, tabCommunication, resultStorage);
  handlers.registerAll(receiver);
  return handlers;
}
