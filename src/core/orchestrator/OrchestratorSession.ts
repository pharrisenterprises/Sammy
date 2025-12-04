/**
 * OrchestratorSession - Session management for test execution
 * @module core/orchestrator/OrchestratorSession
 * @version 1.0.0
 * 
 * Manages test execution sessions with lifecycle tracking, checkpointing
 * for resume capability, and session metadata.
 * 
 * Addresses: "No checkpoint/resume mechanism if replay fails mid-execution"
 * 
 * @see test-orchestrator_breakdown.md for session context
 * @see TestOrchestrator.ts for main orchestrator
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Session status
 */
export type SessionStatus =
  | 'created'      // Session created but not started
  | 'running'      // Actively executing
  | 'paused'       // Execution paused
  | 'stopped'      // Manually stopped
  | 'completed'    // Successfully finished
  | 'failed'       // Failed with error
  | 'crashed'      // Unexpectedly terminated
  | 'resuming';    // Resuming from checkpoint

/**
 * Checkpoint data for resume capability
 */
export interface Checkpoint {
  /** Checkpoint ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** When checkpoint was created */
  createdAt: Date;
  /** Current row index */
  rowIndex: number;
  /** Current step index within row */
  stepIndex: number;
  /** Completed rows */
  completedRows: number[];
  /** Step results so far */
  stepResults: CheckpointStepResult[];
  /** Logs collected so far */
  logs: string;
  /** Progress percentage at checkpoint */
  progress: number;
  /** Additional state data */
  stateData?: Record<string, unknown>;
}

/**
 * Step result stored in checkpoint
 */
export interface CheckpointStepResult {
  rowIndex: number;
  stepIndex: number;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Project ID being tested */
  projectId: number;
  /** Project name */
  projectName?: string;
  /** Target URL */
  targetUrl: string;
  /** Total steps per row */
  totalSteps: number;
  /** Total rows to process */
  totalRows: number;
  /** CSV data used */
  hasCsvData: boolean;
  /** Execution options */
  options?: Record<string, unknown>;
}

/**
 * Session summary statistics
 */
export interface SessionSummary {
  /** Session ID */
  sessionId: string;
  /** Final status */
  status: SessionStatus;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Total duration (ms) */
  duration: number;
  /** Pause duration (ms) */
  pauseDuration: number;
  /** Rows processed */
  rowsProcessed: number;
  /** Steps passed */
  stepsPassed: number;
  /** Steps failed */
  stepsFailed: number;
  /** Steps skipped */
  stepsSkipped: number;
  /** Whether was resumed from checkpoint */
  wasResumed: boolean;
  /** Number of checkpoints created */
  checkpointCount: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Session event types
 */
export type SessionEventType =
  | 'session_created'
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_stopped'
  | 'session_completed'
  | 'session_failed'
  | 'checkpoint_created'
  | 'checkpoint_restored';

/**
 * Session event payload
 */
export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Session event listener
 */
export type SessionEventListener = (event: SessionEvent) => void;

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Auto-create checkpoints. Default: true */
  autoCheckpoint: boolean;
  /** Checkpoint interval (rows). Default: 10 */
  checkpointInterval: number;
  /** Persist sessions to storage. Default: false */
  persistSessions: boolean;
  /** Max session history. Default: 100 */
  maxSessionHistory: number;
  /** Session timeout (ms). Default: 3600000 (1 hour) */
  sessionTimeout: number;
}

/**
 * Storage interface for session persistence
 */
export interface ISessionStorage {
  saveSession(session: SessionData): Promise<void>;
  loadSession(sessionId: string): Promise<SessionData | null>;
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
  loadLatestCheckpoint(sessionId: string): Promise<Checkpoint | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<SessionData[]>;
}

/**
 * Session data for persistence
 */
export interface SessionData {
  id: string;
  status: SessionStatus;
  metadata: SessionMetadata;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  summary?: SessionSummary;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  autoCheckpoint: true,
  checkpointInterval: 10,
  persistSessions: false,
  maxSessionHistory: 100,
  sessionTimeout: 3600000, // 1 hour
};

// ============================================================================
// ORCHESTRATOR SESSION CLASS
// ============================================================================

/**
 * OrchestratorSession - Manages test execution session lifecycle
 * 
 * @example
 * ```typescript
 * const sessionManager = new OrchestratorSession();
 * 
 * // Create and start session
 * const sessionId = sessionManager.create({
 *   projectId: 1,
 *   targetUrl: 'https://example.com',
 *   totalSteps: 5,
 *   totalRows: 100,
 *   hasCsvData: true,
 * });
 * 
 * sessionManager.start(sessionId);
 * 
 * // Create checkpoints during execution
 * sessionManager.createCheckpoint(sessionId, {
 *   rowIndex: 50,
 *   stepIndex: 0,
 *   completedRows: [...],
 *   stepResults: [...],
 * });
 * 
 * // Resume from checkpoint after crash
 * const checkpoint = sessionManager.getLatestCheckpoint(sessionId);
 * if (checkpoint) {
 *   sessionManager.resumeFromCheckpoint(sessionId, checkpoint);
 * }
 * ```
 */
export class OrchestratorSession {
  private config: SessionConfig;
  private storage: ISessionStorage | null;
  
  // Active session
  private activeSessionId: string | null = null;
  private sessions: Map<string, SessionData> = new Map();
  private checkpoints: Map<string, Checkpoint[]> = new Map();
  
  // Timing
  private sessionStartTime: Map<string, Date> = new Map();
  private pauseStartTime: Map<string, Date> = new Map();
  private totalPauseDuration: Map<string, number> = new Map();
  
  // Progress tracking
  private sessionProgress: Map<string, {
    rowsProcessed: number;
    stepsPassed: number;
    stepsFailed: number;
    stepsSkipped: number;
  }> = new Map();
  
  // Event listeners
  private listeners: Set<SessionEventListener> = new Set();

  /**
   * Create a new OrchestratorSession manager
   */
  constructor(
    config: Partial<SessionConfig> = {},
    storage?: ISessionStorage
  ) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.storage = storage ?? null;
  }

  // ==========================================================================
  // SESSION LIFECYCLE
  // ==========================================================================

  /**
   * Create a new session
   * 
   * @param metadata - Session metadata
   * @returns Session ID
   */
  public create(metadata: SessionMetadata): string {
    // Check for existing active session
    if (this.activeSessionId) {
      const activeSession = this.sessions.get(this.activeSessionId);
      if (activeSession && ['running', 'paused'].includes(activeSession.status)) {
        throw new Error(`Active session exists: ${this.activeSessionId}`);
      }
    }

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Create session data
    const sessionData: SessionData = {
      id: sessionId,
      status: 'created',
      metadata,
      createdAt: new Date(),
    };

    // Store session
    this.sessions.set(sessionId, sessionData);
    this.checkpoints.set(sessionId, []);
    this.totalPauseDuration.set(sessionId, 0);
    this.sessionProgress.set(sessionId, {
      rowsProcessed: 0,
      stepsPassed: 0,
      stepsFailed: 0,
      stepsSkipped: 0,
    });

    // Persist if configured
    if (this.config.persistSessions && this.storage) {
      this.storage.saveSession(sessionData).catch(console.error);
    }

    // Emit event
    this.emitEvent({
      type: 'session_created',
      sessionId,
      timestamp: new Date(),
      data: { metadata },
    });

    return sessionId;
  }

  /**
   * Start a session
   */
  public start(sessionId: string): void {
    const session = this.getSession(sessionId);
    
    if (!['created', 'resuming'].includes(session.status)) {
      throw new Error(`Cannot start session in ${session.status} status`);
    }

    session.status = 'running';
    session.startedAt = new Date();
    this.sessionStartTime.set(sessionId, new Date());
    this.activeSessionId = sessionId;

    // Persist
    this.persistSession(session);

    // Emit event
    this.emitEvent({
      type: 'session_started',
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Pause a session
   */
  public pause(sessionId: string): void {
    const session = this.getSession(sessionId);
    
    if (session.status !== 'running') {
      throw new Error(`Cannot pause session in ${session.status} status`);
    }

    session.status = 'paused';
    this.pauseStartTime.set(sessionId, new Date());

    // Persist
    this.persistSession(session);

    // Emit event
    this.emitEvent({
      type: 'session_paused',
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Resume a paused session
   */
  public resume(sessionId: string): void {
    const session = this.getSession(sessionId);
    
    if (session.status !== 'paused') {
      throw new Error(`Cannot resume session in ${session.status} status`);
    }

    // Calculate pause duration
    const pauseStart = this.pauseStartTime.get(sessionId);
    if (pauseStart) {
      const pauseDuration = Date.now() - pauseStart.getTime();
      const currentTotal = this.totalPauseDuration.get(sessionId) ?? 0;
      this.totalPauseDuration.set(sessionId, currentTotal + pauseDuration);
    }
    this.pauseStartTime.delete(sessionId);

    session.status = 'running';

    // Persist
    this.persistSession(session);

    // Emit event
    this.emitEvent({
      type: 'session_resumed',
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Stop a session
   */
  public stop(sessionId: string, error?: string): void {
    const session = this.getSession(sessionId);
    
    if (!['running', 'paused'].includes(session.status)) {
      throw new Error(`Cannot stop session in ${session.status} status`);
    }

    session.status = 'stopped';
    session.endedAt = new Date();
    session.summary = this.buildSummary(sessionId, 'stopped', error);

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    // Persist
    this.persistSession(session);

    // Emit event
    this.emitEvent({
      type: 'session_stopped',
      sessionId,
      timestamp: new Date(),
      data: { error },
    });
  }

  /**
   * Complete a session successfully
   */
  public complete(sessionId: string): void {
    const session = this.getSession(sessionId);
    
    if (session.status !== 'running') {
      throw new Error(`Cannot complete session in ${session.status} status`);
    }

    session.status = 'completed';
    session.endedAt = new Date();
    session.summary = this.buildSummary(sessionId, 'completed');

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    // Persist
    this.persistSession(session);

    // Emit event
    this.emitEvent({
      type: 'session_completed',
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Mark a session as failed
   */
  public fail(sessionId: string, error: string): void {
    const session = this.getSession(sessionId);
    
    session.status = 'failed';
    session.endedAt = new Date();
    session.summary = this.buildSummary(sessionId, 'failed', error);

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    // Persist
    this.persistSession(session);

    // Emit event
    this.emitEvent({
      type: 'session_failed',
      sessionId,
      timestamp: new Date(),
      data: { error },
    });
  }

  // ==========================================================================
  // CHECKPOINT MANAGEMENT
  // ==========================================================================

  /**
   * Create a checkpoint for the session
   */
  public createCheckpoint(
    sessionId: string,
    data: Omit<Checkpoint, 'id' | 'sessionId' | 'createdAt'>
  ): Checkpoint {
    const session = this.getSession(sessionId);
    
    if (!['running', 'paused'].includes(session.status)) {
      throw new Error(`Cannot checkpoint session in ${session.status} status`);
    }

    const checkpoint: Checkpoint = {
      id: this.generateCheckpointId(),
      sessionId,
      createdAt: new Date(),
      ...data,
    };

    // Store checkpoint
    const sessionCheckpoints = this.checkpoints.get(sessionId) ?? [];
    sessionCheckpoints.push(checkpoint);
    this.checkpoints.set(sessionId, sessionCheckpoints);

    // Persist checkpoint
    if (this.config.persistSessions && this.storage) {
      this.storage.saveCheckpoint(checkpoint).catch(console.error);
    }

    // Emit event
    this.emitEvent({
      type: 'checkpoint_created',
      sessionId,
      timestamp: new Date(),
      data: {
        checkpointId: checkpoint.id,
        rowIndex: checkpoint.rowIndex,
        progress: checkpoint.progress,
      },
    });

    return checkpoint;
  }

  /**
   * Get latest checkpoint for a session
   */
  public getLatestCheckpoint(sessionId: string): Checkpoint | null {
    const sessionCheckpoints = this.checkpoints.get(sessionId);
    if (!sessionCheckpoints || sessionCheckpoints.length === 0) {
      return null;
    }
    return sessionCheckpoints[sessionCheckpoints.length - 1];
  }

  /**
   * Get all checkpoints for a session
   */
  public getCheckpoints(sessionId: string): Checkpoint[] {
    return [...(this.checkpoints.get(sessionId) ?? [])];
  }

  /**
   * Resume from a checkpoint
   */
  public resumeFromCheckpoint(sessionId: string, checkpoint: Checkpoint): void {
    const session = this.getSession(sessionId);
    
    if (!['stopped', 'failed', 'crashed'].includes(session.status)) {
      throw new Error(`Cannot resume session in ${session.status} status`);
    }

    session.status = 'resuming';

    // Emit event
    this.emitEvent({
      type: 'checkpoint_restored',
      sessionId,
      timestamp: new Date(),
      data: {
        checkpointId: checkpoint.id,
        rowIndex: checkpoint.rowIndex,
        stepIndex: checkpoint.stepIndex,
      },
    });
  }

  /**
   * Check if auto-checkpoint should be created
   */
  public shouldAutoCheckpoint(rowIndex: number): boolean {
    if (!this.config.autoCheckpoint) {
      return false;
    }
    return rowIndex > 0 && rowIndex % this.config.checkpointInterval === 0;
  }

  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================

  /**
   * Update progress for a session
   */
  public updateProgress(
    sessionId: string,
    update: {
      rowsProcessed?: number;
      stepsPassed?: number;
      stepsFailed?: number;
      stepsSkipped?: number;
    }
  ): void {
    const progress = this.sessionProgress.get(sessionId);
    if (!progress) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (update.rowsProcessed !== undefined) {
      progress.rowsProcessed = update.rowsProcessed;
    }
    if (update.stepsPassed !== undefined) {
      progress.stepsPassed = update.stepsPassed;
    }
    if (update.stepsFailed !== undefined) {
      progress.stepsFailed = update.stepsFailed;
    }
    if (update.stepsSkipped !== undefined) {
      progress.stepsSkipped = update.stepsSkipped;
    }
  }

  /**
   * Increment step counts
   */
  public incrementStep(
    sessionId: string,
    result: 'passed' | 'failed' | 'skipped'
  ): void {
    const progress = this.sessionProgress.get(sessionId);
    if (!progress) return;

    switch (result) {
      case 'passed':
        progress.stepsPassed++;
        break;
      case 'failed':
        progress.stepsFailed++;
        break;
      case 'skipped':
        progress.stepsSkipped++;
        break;
    }
  }

  /**
   * Mark row as completed
   */
  public completeRow(sessionId: string): void {
    const progress = this.sessionProgress.get(sessionId);
    if (progress) {
      progress.rowsProcessed++;
    }
  }

  // ==========================================================================
  // SESSION QUERIES
  // ==========================================================================

  /**
   * Get session data
   */
  public getSession(sessionId: string): SessionData {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Get session if exists (no throw)
   */
  public findSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session ID
   */
  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get active session
   */
  public getActiveSession(): SessionData | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  /**
   * Check if there is an active session
   */
  public hasActiveSession(): boolean {
    return this.activeSessionId !== null;
  }

  /**
   * Get session status
   */
  public getStatus(sessionId: string): SessionStatus {
    return this.getSession(sessionId).status;
  }

  /**
   * Get session summary
   */
  public getSummary(sessionId: string): SessionSummary {
    const session = this.getSession(sessionId);
    return session.summary ?? this.buildSummary(sessionId, session.status);
  }

  /**
   * Get session duration (ms)
   */
  public getDuration(sessionId: string): number {
    const startTime = this.sessionStartTime.get(sessionId);
    if (!startTime) return 0;

    const session = this.sessions.get(sessionId);
    const endTime = session?.endedAt ?? new Date();
    const pauseDuration = this.totalPauseDuration.get(sessionId) ?? 0;

    return endTime.getTime() - startTime.getTime() - pauseDuration;
  }

  /**
   * Get all sessions
   */
  public getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session history (completed/failed sessions)
   */
  public getSessionHistory(): SessionData[] {
    return this.getAllSessions()
      .filter(s => ['completed', 'failed', 'stopped'].includes(s.status))
      .sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0))
      .slice(0, this.config.maxSessionHistory);
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to session events
   */
  public onEvent(listener: SessionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Unsubscribe from events
   */
  public offEvent(listener: SessionEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit session event
   */
  private emitEvent(event: SessionEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[OrchestratorSession] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateCheckpointId(): string {
    return `cp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Build session summary
   */
  private buildSummary(
    sessionId: string,
    status: SessionStatus,
    error?: string
  ): SessionSummary {
    const session = this.sessions.get(sessionId);
    const progress = this.sessionProgress.get(sessionId);
    const checkpoints = this.checkpoints.get(sessionId) ?? [];

    return {
      sessionId,
      status,
      startTime: session?.startedAt ?? new Date(),
      endTime: session?.endedAt,
      duration: this.getDuration(sessionId),
      pauseDuration: this.totalPauseDuration.get(sessionId) ?? 0,
      rowsProcessed: progress?.rowsProcessed ?? 0,
      stepsPassed: progress?.stepsPassed ?? 0,
      stepsFailed: progress?.stepsFailed ?? 0,
      stepsSkipped: progress?.stepsSkipped ?? 0,
      wasResumed: session?.status === 'resuming' || checkpoints.some(
        c => c.rowIndex > 0 || c.stepIndex > 0
      ),
      checkpointCount: checkpoints.length,
      error,
    };
  }

  /**
   * Persist session to storage
   */
  private persistSession(session: SessionData): void {
    if (this.config.persistSessions && this.storage) {
      this.storage.saveSession(session).catch(console.error);
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up old sessions
   */
  public cleanup(): void {
    const history = this.getSessionHistory();
    const keepIds = new Set(history.map(s => s.id));

    // Add active session
    if (this.activeSessionId) {
      keepIds.add(this.activeSessionId);
    }

    // Remove old sessions
    for (const [sessionId] of this.sessions) {
      if (!keepIds.has(sessionId)) {
        this.sessions.delete(sessionId);
        this.checkpoints.delete(sessionId);
        this.sessionStartTime.delete(sessionId);
        this.pauseStartTime.delete(sessionId);
        this.totalPauseDuration.delete(sessionId);
        this.sessionProgress.delete(sessionId);
      }
    }
  }

  /**
   * Reset all sessions
   */
  public reset(): void {
    this.activeSessionId = null;
    this.sessions.clear();
    this.checkpoints.clear();
    this.sessionStartTime.clear();
    this.pauseStartTime.clear();
    this.totalPauseDuration.clear();
    this.sessionProgress.clear();
  }

  /**
   * Get configuration
   */
  public getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an OrchestratorSession instance
 */
export function createOrchestratorSession(
  config?: Partial<SessionConfig>,
  storage?: ISessionStorage
): OrchestratorSession {
  return new OrchestratorSession(config, storage);
}
