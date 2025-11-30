/**
 * @fileoverview Replay session coordinator for background service
 * @module background/replay-coordinator
 * @version 1.0.0
 * 
 * This module coordinates replay sessions between the background service,
 * content scripts, and UI components.
 * 
 * REPLAY FLOW:
 * 1. UI requests start_replay with project/steps
 * 2. Coordinator prepares CSV data (if data-driven)
 * 3. Coordinator sends steps to content script
 * 4. Content script executes steps sequentially
 * 5. Step results sent back to coordinator
 * 6. Coordinator creates TestRun on completion
 * 7. UI receives progress updates throughout
 * 
 * TESTRUN STATUS:
 * - 'pending' - Before replay starts
 * - 'running' - During replay
 * - 'passed' - All steps succeeded
 * - 'failed' - Any step failed
 * - 'stopped' - User stopped replay
 * 
 * @see PHASE_4_SPECIFICATIONS.md for replay specifications
 * @see replay-engine_breakdown.md for engine details
 */

import type { Step, TestRun, Field } from '../core/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay session state
 */
export interface ReplaySession {
  /** Session ID */
  id: string;
  /** Project ID being replayed (number from database) */
  projectId: number;
  /** Tab ID where replay is happening */
  tabId: number;
  /** Replay start time */
  startedAt: number;
  /** Replay end time (null if active) */
  endedAt: number | null;
  /** Steps to replay */
  steps: Step[];
  /** Current step index (0-based for internal tracking) */
  currentStepIndex: number;
  /** Step results */
  results: StepResult[];
  /** Session state */
  state: ReplaySessionState;
  /** CSV row index (for data-driven testing) */
  csvRowIndex: number | null;
  /** Error if any */
  error: string | null;
}

/**
 * Replay session state
 */
export type ReplaySessionState = 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'completed' | 'failed' | 'stopped';

/**
 * Step execution result
 */
export interface StepResult {
  /** Step that was executed */
  step: Step;
  /** Whether step succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution duration (ms) */
  duration: number;
  /** Retry count */
  retries: number;
  /** Value used (for input steps with CSV injection) */
  usedValue?: string;
  /** Locator strategy used */
  locatorStrategy?: string;
  /** Locator confidence */
  locatorConfidence?: number;
}

/**
 * Replay event types
 */
export type ReplayEventType =
  | 'session_started'
  | 'session_completed'
  | 'session_failed'
  | 'session_stopped'
  | 'session_paused'
  | 'session_resumed'
  | 'step_started'
  | 'step_completed'
  | 'progress_update'
  | 'error';

/**
 * Replay event
 */
export interface ReplayEvent {
  /** Event type */
  type: ReplayEventType;
  /** Session ID */
  sessionId: string;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data?: unknown;
}

/**
 * Replay event listener
 */
export type ReplayEventListener = (event: ReplayEvent) => void;

/**
 * Replay progress
 */
export interface ReplayProgress {
  /** Current step index (1-based for display) */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Completed steps count */
  completedSteps: number;
  /** Failed steps count */
  failedSteps: number;
  /** Session state */
  state: ReplaySessionState;
  /** Elapsed time (ms) */
  elapsedTime: number;
  /** Estimated remaining time (ms) */
  estimatedRemaining: number;
}

/**
 * Replay coordinator configuration
 */
export interface ReplayCoordinatorConfig {
  /** Default step delay (ms) */
  defaultStepDelay?: number;
  /** Default element timeout (ms) */
  defaultElementTimeout?: number;
  /** Default retry count */
  defaultRetryCount?: number;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Start replay options
 */
export interface StartReplayOptions {
  /** Project ID (number from database) */
  projectId: number;
  /** Tab ID for replay */
  tabId: number;
  /** Steps to replay */
  steps: Step[];
  /** Field mappings (for CSV injection) */
  fields?: Field[];
  /** CSV data (headers + rows) */
  csvData?: string[][] | null;
  /** CSV row index to use */
  csvRowIndex?: number;
  /** Override step delay */
  stepDelay?: number;
  /** Override element timeout */
  elementTimeout?: number;
  /** Override retry count */
  retryCount?: number;
  /** Stop on first failure */
  stopOnFailure?: boolean;
}

/**
 * Replay result
 */
export interface ReplayResult {
  /** Whether replay completed successfully */
  success: boolean;
  /** Whether all steps passed */
  passed: boolean;
  /** Session ID */
  sessionId: string;
  /** Project ID (number from database) */
  projectId: number;
  /** Step results */
  results: StepResult[];
  /** Replay duration (ms) */
  duration: number;
  /** TestRun status */
  status: TestRunStatus;
  /** Generated logs */
  logs: string;
  /** Error if failed */
  error?: string;
}

/**
 * TestRun status type
 */
type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'stopped';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_REPLAY_CONFIG: Required<ReplayCoordinatorConfig> = {
  defaultStepDelay: 500,
  defaultElementTimeout: 5000,
  defaultRetryCount: 3,
  stopOnFailure: true,
  debug: false
};

// ============================================================================
// REPLAY COORDINATOR CLASS
// ============================================================================

/**
 * Replay Coordinator
 * 
 * Coordinates replay sessions between components.
 * 
 * @example
 * ```typescript
 * const coordinator = new ReplayCoordinator(stateManager, tabManager);
 * 
 * // Listen for events
 * coordinator.on((event) => {
 *   if (event.type === 'progress_update') {
 *     updateProgressBar(event.data);
 *   }
 * });
 * 
 * // Start replay
 * await coordinator.startReplay({
 *   projectId: 'proj-123',
 *   tabId: 1,
 *   steps: project.steps
 * });
 * 
 * // Stop replay
 * const result = await coordinator.stopReplay();
 * ```
 */
export class ReplayCoordinator {
  private config: Required<ReplayCoordinatorConfig>;
  private session: ReplaySession | null = null;
  private listeners: Set<ReplayEventListener> = new Set();
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  // Dependencies (injected)
  private stateManager: StateManagerLike | null = null;
  private tabManager: TabManagerLike | null = null;
  private storage: StorageLike | null = null;

  // CSV injection data
  private csvHeaders: string[] = [];
  private csvRowData: Record<string, string> = {};
  private fieldMappings: Field[] = [];

  constructor(config: ReplayCoordinatorConfig = {}) {
    this.config = { ...DEFAULT_REPLAY_CONFIG, ...config };
  }

  // ==========================================================================
  // DEPENDENCY INJECTION
  // ==========================================================================

  /**
   * Set state manager dependency
   */
  setStateManager(stateManager: StateManagerLike): this {
    this.stateManager = stateManager;
    return this;
  }

  /**
   * Set tab manager dependency
   */
  setTabManager(tabManager: TabManagerLike): this {
    this.tabManager = tabManager;
    return this;
  }

  /**
   * Set storage dependency
   */
  setStorage(storage: StorageLike): this {
    this.storage = storage;
    return this;
  }

  // ==========================================================================
  // REPLAY LIFECYCLE
  // ==========================================================================

  /**
   * Start replay session
   */
  async startReplay(options: StartReplayOptions): Promise<ReplaySession> {
    const {
      projectId,
      tabId,
      steps,
      fields,
      csvData,
      csvRowIndex,
      stepDelay = this.config.defaultStepDelay,
      elementTimeout = this.config.defaultElementTimeout,
      retryCount = this.config.defaultRetryCount,
      stopOnFailure = this.config.stopOnFailure
    } = options;

    // Check if already replaying
    if (this.session && (this.session.state === 'running' || this.session.state === 'starting')) {
      throw new Error('Replay already in progress');
    }

    this.log('Starting replay:', { projectId, steps: steps.length, csvRowIndex });

    // Create session
    const sessionId = generateSessionId();
    const now = Date.now();

    this.session = {
      id: sessionId,
      projectId,
      tabId,
      startedAt: now,
      endedAt: null,
      steps: [...steps],
      currentStepIndex: 0,
      results: [],
      state: 'starting',
      csvRowIndex: csvRowIndex ?? null,
      error: null
    };

    // Set up CSV injection if provided
    if (csvData && csvRowIndex !== undefined && fields) {
      this.setupCsvInjection(csvData, csvRowIndex, fields);
    }

    try {
      // Ensure content script is injected
      if (this.tabManager) {
        const ready = await this.tabManager.ensureContentScript(tabId);
        if (!ready) {
          throw new Error('Failed to inject content script');
        }
      }

      // Send replay start to content script
      await this.sendToTab(tabId, {
        action: 'start_replay',
        data: {
          sessionId,
          projectId,
          steps,
          config: {
            stepDelay,
            elementTimeout,
            retryCount,
            stopOnFailure
          },
          csvInjection: csvRowIndex !== undefined ? {
            headers: this.csvHeaders,
            rowData: this.csvRowData,
            rowIndex: csvRowIndex,
            fieldMappings: this.fieldMappings
          } : null
        }
      });

      // Update state
      this.session.state = 'running';

      // Update state manager
      if (this.stateManager) {
        this.stateManager.update({
          isReplaying: true,
          replayingTabId: tabId,
          activeProjectId: projectId,
          isPaused: false,
          currentStepIndex: 0,
          totalSteps: steps.length
        });
      }

      // Start progress updates
      this.startProgressTimer();

      // Emit event
      this.emitEvent('session_started', sessionId, {
        projectId,
        tabId,
        stepCount: steps.length,
        csvRowIndex
      });

      this.log('Replay started:', sessionId);
      return this.session;

    } catch (error) {
      this.session.state = 'failed';
      this.session.error = error instanceof Error ? error.message : String(error);
      
      this.emitEvent('error', sessionId, { error: this.session.error });
      throw error;
    }
  }

  /**
   * Stop replay session
   */
  async stopReplay(): Promise<ReplayResult> {
    if (!this.session) {
      throw new Error('No active replay session');
    }

    if (this.session.state === 'completed' || this.session.state === 'stopped') {
      throw new Error('Replay already finished');
    }

    this.log('Stopping replay:', this.session.id);

    const sessionId = this.session.id;
    this.session.state = 'stopping';

    try {
      // Send stop message to content script
      await this.sendToTab(this.session.tabId, {
        action: 'stop_replay',
        data: { sessionId }
      });

      // Stop progress timer
      this.stopProgressTimer();

      // Finalize session
      this.session.state = 'stopped';
      this.session.endedAt = Date.now();

      // Create result
      const result = this.createReplayResult('stopped');

      // Save TestRun
      await this.saveTestRun(result);

      // Update state manager
      if (this.stateManager) {
        this.stateManager.update({
          isReplaying: false,
          replayingTabId: null,
          isPaused: false,
          currentStepIndex: 0,
          totalSteps: 0
        });
      }

      // Emit event
      this.emitEvent('session_stopped', sessionId, result);

      this.log('Replay stopped:', result);

      // Clear session
      this.clearSession();

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        passed: false,
        sessionId,
        projectId: this.session?.projectId || 0,
        results: this.session?.results || [],
        duration: Date.now() - (this.session?.startedAt || Date.now()),
        status: 'stopped',
        logs: this.generateLogs(),
        error: errorMessage
      };
    }
  }

  /**
   * Pause replay
   */
  pauseReplay(): void {
    if (!this.session || this.session.state !== 'running') {
      throw new Error('Cannot pause: not running');
    }

    this.session.state = 'paused';

    // Notify content script
    this.sendToTab(this.session.tabId, {
      action: 'pause_replay',
      data: { sessionId: this.session.id }
    }).catch(console.error);

    // Update state
    if (this.stateManager) {
      this.stateManager.set('isPaused', true);
    }

    this.emitEvent('session_paused', this.session.id);
    this.log('Replay paused');
  }

  /**
   * Resume replay
   */
  resumeReplay(): void {
    if (!this.session || this.session.state !== 'paused') {
      throw new Error('Cannot resume: not paused');
    }

    this.session.state = 'running';

    // Notify content script
    this.sendToTab(this.session.tabId, {
      action: 'resume_replay',
      data: { sessionId: this.session.id }
    }).catch(console.error);

    // Update state
    if (this.stateManager) {
      this.stateManager.set('isPaused', false);
    }

    this.emitEvent('session_resumed', this.session.id);
    this.log('Replay resumed');
  }

  // ==========================================================================
  // STEP HANDLING
  // ==========================================================================

  /**
   * Handle step started from content script
   */
  handleStepStarted(stepIndex: number): void {
    if (!this.session) return;

    this.session.currentStepIndex = stepIndex;

    // Update state manager
    if (this.stateManager) {
      this.stateManager.set('currentStepIndex', stepIndex);
    }

    const step = this.session.steps[stepIndex];
    this.emitEvent('step_started', this.session.id, {
      stepIndex,
      step,
      totalSteps: this.session.steps.length
    });

    this.log('Step started:', stepIndex + 1, step?.event);
  }

  /**
   * Handle step completed from content script
   */
  handleStepCompleted(result: StepResult): void {
    if (!this.session) return;

    this.session.results.push(result);

    this.emitEvent('step_completed', this.session.id, {
      result,
      completedSteps: this.session.results.length,
      totalSteps: this.session.steps.length
    });

    this.log('Step completed:', this.session.results.length, result.success ? 'PASS' : 'FAIL');

    // Emit progress update
    this.emitProgressUpdate();
  }

  /**
   * Handle replay completed from content script
   */
  async handleReplayCompleted(results: StepResult[]): Promise<void> {
    if (!this.session) return;

    this.log('Replay completed from content script');

    // Stop progress timer
    this.stopProgressTimer();

    // Update session
    this.session.results = results;
    this.session.endedAt = Date.now();

    const allPassed = results.every(r => r.success);
    this.session.state = allPassed ? 'completed' : 'failed';

    // Create result
    const status: TestRunStatus = allPassed ? 'passed' : 'failed';
    const result = this.createReplayResult(status);

    // Save TestRun
    await this.saveTestRun(result);

    // Update state manager
    if (this.stateManager) {
      this.stateManager.update({
        isReplaying: false,
        replayingTabId: null,
        isPaused: false,
        currentStepIndex: 0,
        totalSteps: 0
      });
    }

    // Emit event
    const eventType = allPassed ? 'session_completed' : 'session_failed';
    this.emitEvent(eventType, this.session.id, result);

    // Clear session
    this.clearSession();
  }

  /**
   * Handle replay error from content script
   */
  handleReplayError(error: string): void {
    if (!this.session) return;

    this.session.error = error;
    this.session.state = 'failed';

    this.emitEvent('error', this.session.id, { error });
    this.log('Replay error:', error);
  }

  // ==========================================================================
  // CSV INJECTION
  // ==========================================================================

  /**
   * Set up CSV injection for data-driven testing
   */
  private setupCsvInjection(
    csvData: string[][],
    rowIndex: number,
    fields: Field[]
  ): void {
    this.csvHeaders = csvData[0] || [];
    this.fieldMappings = fields;
    this.csvRowData = {};

    // Get the specific row data
    const dataRows = csvData.slice(1);
    const row = dataRows[rowIndex];

    if (row) {
      this.csvHeaders.forEach((header, i) => {
        this.csvRowData[header] = row[i] || '';
      });
    }

    this.log('CSV injection set up:', {
      headers: this.csvHeaders,
      rowIndex,
      rowData: this.csvRowData
    });
  }

  /**
   * Get injected value for a field
   */
  getInjectedValue(fieldName: string): string | null {
    // Find field mapping
    const field = this.fieldMappings.find(f => 
      f.field_name === fieldName && f.mapped && f.inputvarfields
    );

    if (!field || !field.inputvarfields) {
      return null;
    }

    // Get value from CSV row data
    return this.csvRowData[field.inputvarfields] ?? null;
  }

  // ==========================================================================
  // TESTRUN CREATION
  // ==========================================================================

  /**
   * Create replay result
   */
  private createReplayResult(status: TestRunStatus): ReplayResult {
    if (!this.session) {
      throw new Error('No session');
    }

    const passed = status === 'passed';
    const duration = (this.session.endedAt || Date.now()) - this.session.startedAt;
    const logs = this.generateLogs();

    return {
      success: status !== 'failed' || this.session.error === null,
      passed,
      sessionId: this.session.id,
      projectId: this.session.projectId,
      results: [...this.session.results],
      duration,
      status,
      logs,
      error: this.session.error || undefined
    };
  }

  /**
   * Generate logs from results
   * CRITICAL: Returns string (NOT string[])
   */
  private generateLogs(): string {
    if (!this.session) return '';

    const lines: string[] = [];
    const startTime = new Date(this.session.startedAt).toISOString();
    
    lines.push(`Replay started at ${startTime}`);
    lines.push(`Project: ${this.session.projectId}`);
    lines.push(`Total steps: ${this.session.steps.length}`);
    
    if (this.session.csvRowIndex !== null) {
      lines.push(`CSV Row: ${this.session.csvRowIndex + 1}`);
    }
    
    lines.push('---');

    for (let i = 0; i < this.session.results.length; i++) {
      const result = this.session.results[i];
      const status = result.success ? 'PASS' : 'FAIL';
      const stepNum = i + 1; // 1-indexed for display
      const stepInfo = `Step ${stepNum}: ${result.step.event} - ${status}`;
      lines.push(stepInfo);

      if (result.usedValue) {
        lines.push(`  Value: "${result.usedValue}"`);
      }

      if (result.locatorStrategy) {
        lines.push(`  Locator: ${result.locatorStrategy} (${result.locatorConfidence}%)`);
      }

      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }

      if (result.retries > 0) {
        lines.push(`  Retries: ${result.retries}`);
      }

      lines.push(`  Duration: ${result.duration}ms`);
    }

    lines.push('---');
    
    const endTime = this.session.endedAt 
      ? new Date(this.session.endedAt).toISOString()
      : 'In Progress';
    lines.push(`Replay ended at ${endTime}`);

    const passedCount = this.session.results.filter(r => r.success).length;
    const failedCount = this.session.results.length - passedCount;
    lines.push(`Results: ${passedCount} passed, ${failedCount} failed`);

    // CRITICAL: Return string, not string[]
    return lines.join('\n');
  }

  /**
   * Save TestRun to storage
   */
  private async saveTestRun(result: ReplayResult): Promise<TestRun | null> {
    if (!this.storage || !this.session) return null;

    try {
      // Convert StepResult to StepExecutionResult format
      const executionResults = result.results.map(r => ({
        step_id: r.step.id,
        status: r.success ? 'passed' as const : 'failed' as const,
        duration: r.duration,
        error: r.error,
        strategy_used: r.locatorStrategy,
        confidence: r.locatorConfidence
      }));

      const testRun: TestRun = {
        id: generateTestRunId(),
        project_id: this.session.projectId, // Note: This is string in session, may need conversion
        status: result.status,
        started_at: this.session.startedAt,
        completed_at: this.session.endedAt || Date.now(),
        current_step: this.session.currentStepIndex,
        total_steps: this.session.steps.length,
        logs: result.logs, // CRITICAL: string, not string[]
        results: executionResults,
        csv_row_index: this.session.csvRowIndex,
        error: result.error || null
      };

      await this.storage.createTestRun(testRun);
      this.log('TestRun saved:', testRun.id);
      return testRun;

    } catch (error) {
      console.error('[ReplayCoordinator] Failed to save TestRun:', error);
      return null;
    }
  }

  // ==========================================================================
  // TAB COMMUNICATION
  // ==========================================================================

  /**
   * Send message to replay tab
   */
  private async sendToTab(tabId: number, message: unknown): Promise<unknown> {
    if (this.tabManager) {
      return this.tabManager.sendToTab(tabId, message, { ensureInjected: false });
    }

    // Fallback to direct Chrome API
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      throw new Error(`Failed to send message to tab: ${error}`);
    }
  }

  /**
   * Handle tab closed during replay
   */
  handleTabClosed(tabId: number): void {
    if (!this.session || this.session.tabId !== tabId) return;

    this.log('Replay tab closed, stopping replay');
    
    this.stopReplay().catch(error => {
      console.error('[ReplayCoordinator] Stop on tab close failed:', error);
    });
  }

  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================

  /**
   * Start progress update timer
   */
  private startProgressTimer(): void {
    if (this.progressTimer) return;

    this.progressTimer = setInterval(() => {
      this.emitProgressUpdate();
    }, 500);
  }

  /**
   * Stop progress update timer
   */
  private stopProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /**
   * Emit progress update event
   */
  private emitProgressUpdate(): void {
    if (!this.session) return;

    const progress = this.getProgress();
    this.emitEvent('progress_update', this.session.id, progress);
  }

  /**
   * Get current progress
   */
  getProgress(): ReplayProgress | null {
    if (!this.session) return null;

    const completedSteps = this.session.results.length;
    const failedSteps = this.session.results.filter(r => !r.success).length;
    const elapsedTime = Date.now() - this.session.startedAt;
    
    // Estimate remaining time
    const avgStepTime = completedSteps > 0 
      ? elapsedTime / completedSteps 
      : this.config.defaultStepDelay;
    const remainingSteps = this.session.steps.length - completedSteps;
    const estimatedRemaining = remainingSteps * avgStepTime;

    return {
      currentStep: this.session.currentStepIndex + 1, // 1-based for display
      totalSteps: this.session.steps.length,
      completedSteps,
      failedSteps,
      state: this.session.state,
      elapsedTime,
      estimatedRemaining: Math.round(estimatedRemaining)
    };
  }

  // ==========================================================================
  // EVENT EMITTER
  // ==========================================================================

  /**
   * Add event listener
   */
  on(listener: ReplayEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: ReplayEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(
    type: ReplayEventType,
    sessionId: string,
    data?: unknown
  ): void {
    const event: ReplayEvent = {
      type,
      sessionId,
      timestamp: Date.now(),
      data
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[ReplayCoordinator] Listener error:', error);
      }
    }
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  /**
   * Get current session
   */
  getSession(): ReplaySession | null {
    return this.session ? { ...this.session, results: [...this.session.results] } : null;
  }

  /**
   * Check if replay is active
   */
  isReplaying(): boolean {
    return this.session?.state === 'running';
  }

  /**
   * Check if replay is paused
   */
  isPaused(): boolean {
    return this.session?.state === 'paused';
  }

  /**
   * Get session state
   */
  getState(): ReplaySessionState {
    return this.session?.state || 'idle';
  }

  /**
   * Get replay tab ID
   */
  getReplayingTabId(): number | null {
    return this.session?.tabId || null;
  }

  /**
   * Get results
   */
  getResults(): StepResult[] {
    return this.session ? [...this.session.results] : [];
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Clear session data
   */
  private clearSession(): void {
    this.session = null;
    this.csvHeaders = [];
    this.csvRowData = {};
    this.fieldMappings = [];
  }

  /**
   * Log message (if debug enabled)
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[ReplayCoordinator]', ...args);
    }
  }

  /**
   * Destroy coordinator
   */
  destroy(): void {
    this.stopProgressTimer();
    this.listeners.clear();
    this.clearSession();
    this.log('Destroyed');
  }
}

// ============================================================================
// DEPENDENCY INTERFACES
// ============================================================================

/**
 * State manager interface (for dependency injection)
 */
interface StateManagerLike {
  update(updates: Record<string, unknown>): void;
  set(key: string, value: unknown): void;
}

/**
 * Tab manager interface (for dependency injection)
 */
interface TabManagerLike {
  ensureContentScript(tabId: number): Promise<boolean>;
  sendToTab(tabId: number, message: unknown, options?: unknown): Promise<unknown>;
}

/**
 * Storage interface (for dependency injection)
 */
interface StorageLike {
  createTestRun(testRun: TestRun): Promise<void>;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `replay_${timestamp}_${random}`;
}

/**
 * Generate unique TestRun ID
 */
function generateTestRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `run_${timestamp}_${random}`;
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: ReplayCoordinator | null = null;

/**
 * Get or create replay coordinator instance
 */
export function getReplayCoordinator(): ReplayCoordinator {
  if (!instance) {
    instance = new ReplayCoordinator();
  }
  return instance;
}

/**
 * Reset replay coordinator singleton (for testing)
 */
export function resetReplayCoordinator(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
