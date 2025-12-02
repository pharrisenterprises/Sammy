/**
 * ReplaySession - Multi-Row Test Execution
 * @module core/replay/ReplaySession
 * @version 1.0.0
 * 
 * Manages test sessions with multi-row CSV data support. Iterates through
 * data rows, executes steps for each row, and aggregates results.
 * 
 * ## Session Lifecycle
 * - create: Initialize with steps and CSV data
 * - start: Begin row-by-row execution
 * - pause: Pause at current row boundary
 * - resume: Continue from paused row
 * - stop: Stop execution completely
 * - reset: Return to initial state
 * 
 * ## CSV Data Handling
 * - Empty CSV: Execute once with recorded values
 * - With CSV: Execute once per row with injected values
 * - Row validation: Skip rows with no matching fields
 * 
 * @example
 * ```typescript
 * const session = new ReplaySession({
 *   steps,
 *   csvData: [
 *     { email: 'user1@test.com', password: 'pass1' },
 *     { email: 'user2@test.com', password: 'pass2' },
 *   ],
 *   fieldMappings: { email: 'Email Field', password: 'Password' },
 * });
 * 
 * session.onRowComplete((result) => {
 *   console.log(`Row ${result.rowIndex + 1}: ${result.passed} passed`);
 * });
 * 
 * const summary = await session.start();
 * ```
 */

import type { Step } from '../types/Step';
import type { ExecutionContext, ExecutionSummary } from './IReplayEngine';
import {
  ReplayEngine,
  createReplayEngine,
  type ReplayEngineConfig,
} from './ReplayEngine';
import type { StepExecutionResult } from './StepExecutor';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Session lifecycle state
 */
export type SessionLifecycle = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'error';

/**
 * Row execution result
 */
export interface RowExecutionResult {
  /** Row index (0-based) */
  rowIndex: number;
  
  /** CSV row data (empty object if no CSV) */
  rowData: Record<string, string>;
  
  /** Whether row was skipped (no matching fields) */
  skipped: boolean;
  
  /** Skip reason if skipped */
  skipReason?: string;
  
  /** Whether all steps passed */
  success: boolean;
  
  /** Number of passed steps */
  passed: number;
  
  /** Number of failed steps */
  failed: number;
  
  /** Number of skipped steps */
  skippedSteps: number;
  
  /** Total duration in ms */
  duration: number;
  
  /** Step results */
  stepResults: StepExecutionResult[];
  
  /** Error message if failed */
  error?: string;
}

/**
 * Session summary
 */
export interface SessionSummary {
  /** Total rows processed */
  totalRows: number;
  
  /** Rows that passed (all steps succeeded) */
  passedRows: number;
  
  /** Rows that failed (at least one step failed) */
  failedRows: number;
  
  /** Rows that were skipped */
  skippedRows: number;
  
  /** Total steps across all rows */
  totalSteps: number;
  
  /** Total passed steps */
  passedSteps: number;
  
  /** Total failed steps */
  failedSteps: number;
  
  /** Total skipped steps */
  skippedStepsCount: number;
  
  /** Total duration in ms */
  duration: number;
  
  /** Overall success (all rows passed) */
  success: boolean;
  
  /** Per-row results */
  rowResults: RowExecutionResult[];
  
  /** Start time */
  startTime: number;
  
  /** End time */
  endTime: number;
}

/**
 * Session progress
 */
export interface SessionProgress {
  /** Current row index (0-based) */
  currentRow: number;
  
  /** Total rows */
  totalRows: number;
  
  /** Row percentage (0-100) */
  rowPercentage: number;
  
  /** Current step within row */
  currentStep: number;
  
  /** Total steps per row */
  stepsPerRow: number;
  
  /** Overall percentage (0-100) */
  overallPercentage: number;
  
  /** Passed rows so far */
  passedRows: number;
  
  /** Failed rows so far */
  failedRows: number;
}

/**
 * Session configuration
 */
export interface ReplaySessionConfig {
  /** Steps to execute */
  steps: Step[];
  
  /** CSV data rows (optional) */
  csvData?: Record<string, string>[];
  
  /** Field mappings (csvColumn → stepLabel) */
  fieldMappings?: Record<string, string>;
  
  /** Execution context */
  context?: Partial<ExecutionContext>;
  
  /** Replay engine configuration */
  engineConfig?: Partial<ReplayEngineConfig>;
  
  /** Whether to skip rows with no matching fields (default: true) */
  skipUnmatchedRows?: boolean;
  
  /** Whether to continue after row failure (default: true) */
  continueOnRowFailure?: boolean;
  
  /** Maximum row failures before stopping (0 = unlimited) */
  maxRowFailures?: number;
  
  /** Delay between rows in ms (default: 0) */
  rowDelay?: number;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: Required<Omit<ReplaySessionConfig, 'steps'>> = {
  csvData: [],
  fieldMappings: {},
  context: {},
  engineConfig: {},
  skipUnmatchedRows: true,
  continueOnRowFailure: true,
  maxRowFailures: 0,
  rowDelay: 0,
};

/**
 * Callback types
 */
export type RowStartCallback = (rowIndex: number, rowData: Record<string, string>) => void;
export type RowCompleteCallback = (result: RowExecutionResult) => void;
export type SessionProgressCallback = (progress: SessionProgress) => void;
export type SessionCompleteCallback = (summary: SessionSummary) => void;
export type SessionErrorCallback = (error: Error, rowIndex?: number) => void;

/**
 * Session events
 */
export interface ReplaySessionEvents {
  onRowStart?: RowStartCallback;
  onRowComplete?: RowCompleteCallback;
  onProgress?: SessionProgressCallback;
  onComplete?: SessionCompleteCallback;
  onError?: SessionErrorCallback;
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
 * Check if row has matching fields for steps
 */
function rowHasMatchingFields(
  row: Record<string, string>,
  steps: Step[],
  fieldMappings: Record<string, string>
): boolean {
  const stepLabels = steps.map(s => s.label).filter(Boolean);
  const rowKeys = Object.keys(row);
  
  // Check direct matches
  for (const key of rowKeys) {
    if (stepLabels.includes(key)) {
      return true;
    }
  }
  
  // Check mapped matches
  for (const [csvColumn, stepLabel] of Object.entries(fieldMappings)) {
    if (rowKeys.includes(csvColumn) && stepLabels.includes(stepLabel)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create empty row result
 */
function createSkippedRowResult(
  rowIndex: number,
  rowData: Record<string, string>,
  reason: string
): RowExecutionResult {
  return {
    rowIndex,
    rowData,
    skipped: true,
    skipReason: reason,
    success: false,
    passed: 0,
    failed: 0,
    skippedSteps: 0,
    duration: 0,
    stepResults: [],
  };
}

/**
 * Create session summary from row results
 */
function createSessionSummary(
  rowResults: RowExecutionResult[],
  stepsPerRow: number,
  startTime: number,
  endTime: number
): SessionSummary {
  const passedRows = rowResults.filter(r => r.success && !r.skipped).length;
  const failedRows = rowResults.filter(r => !r.success && !r.skipped).length;
  const skippedRows = rowResults.filter(r => r.skipped).length;
  
  const passedSteps = rowResults.reduce((sum, r) => sum + r.passed, 0);
  const failedSteps = rowResults.reduce((sum, r) => sum + r.failed, 0);
  const skippedStepsCount = rowResults.reduce((sum, r) => sum + r.skippedSteps, 0);
  
  return {
    totalRows: rowResults.length,
    passedRows,
    failedRows,
    skippedRows,
    totalSteps: rowResults.length * stepsPerRow,
    passedSteps,
    failedSteps,
    skippedStepsCount,
    duration: endTime - startTime,
    success: failedRows === 0 && skippedRows < rowResults.length,
    rowResults,
    startTime,
    endTime,
  };
}

// ============================================================================
// REPLAY SESSION CLASS
// ============================================================================

/**
 * Manages multi-row test execution sessions
 */
export class ReplaySession {
  private config: Required<Omit<ReplaySessionConfig, 'steps'>> & { steps: Step[] };
  private engine: ReplayEngine;
  private events: ReplaySessionEvents;
  
  // Session state
  private lifecycle: SessionLifecycle = 'idle';
  private rowResults: RowExecutionResult[] = [];
  private currentRowIndex: number = 0;
  private consecutiveRowFailures: number = 0;
  private startTime: number = 0;
  private endTime: number = 0;
  
  // Execution control
  private executionPromise: Promise<SessionSummary> | null = null;
  private resolveExecution: ((summary: SessionSummary) => void) | null = null;
  
  constructor(config: ReplaySessionConfig) {
    if (!config.steps || config.steps.length === 0) {
      throw new Error('Steps are required');
    }
    
    this.config = {
      ...DEFAULT_SESSION_CONFIG,
      ...config,
      steps: config.steps,
    };
    
    this.events = {};
    this.engine = createReplayEngine(this.config.engineConfig);
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Start session execution
   */
  async start(): Promise<SessionSummary> {
    if (this.lifecycle !== 'idle') {
      throw new Error(`Cannot start from state: ${this.lifecycle}`);
    }
    
    // Initialize state
    this.lifecycle = 'running';
    this.rowResults = [];
    this.currentRowIndex = 0;
    this.consecutiveRowFailures = 0;
    this.startTime = Date.now();
    
    // Create execution promise
    this.executionPromise = new Promise((resolve) => {
      this.resolveExecution = resolve;
    });
    
    // Get rows to process
    const rowsToProcess = this.getRowsToProcess();
    
    // Begin execution loop
    this.executeRowLoop(rowsToProcess);
    
    return this.executionPromise;
  }
  
  /**
   * Pause session at row boundary
   */
  pause(): void {
    if (this.lifecycle !== 'running') {
      throw new Error(`Cannot pause from state: ${this.lifecycle}`);
    }
    
    this.lifecycle = 'paused';
    
    // Also pause the engine if running
    if (this.engine.isRunning()) {
      this.engine.pause();
    }
  }
  
  /**
   * Resume session from paused state
   */
  resume(): void {
    if (this.lifecycle !== 'paused') {
      throw new Error(`Cannot resume from state: ${this.lifecycle}`);
    }
    
    this.lifecycle = 'running';
    
    // Resume engine if paused
    if (this.engine.isPaused()) {
      this.engine.resume();
    } else {
      // Continue row loop
      const rowsToProcess = this.getRowsToProcess();
      this.executeRowLoop(rowsToProcess);
    }
  }
  
  /**
   * Stop session
   */
  stop(): void {
    if (this.lifecycle !== 'running' && this.lifecycle !== 'paused') {
      throw new Error(`Cannot stop from state: ${this.lifecycle}`);
    }
    
    this.lifecycle = 'stopped';
    
    // Stop engine
    if (this.engine.isRunning() || this.engine.isPaused()) {
      this.engine.stop();
    }
    
    // Finish session
    this.finishSession('stopped');
  }
  
  /**
   * Reset session
   */
  reset(): void {
    this.lifecycle = 'idle';
    this.rowResults = [];
    this.currentRowIndex = 0;
    this.consecutiveRowFailures = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.executionPromise = null;
    this.resolveExecution = null;
    
    this.engine.reset();
  }
  
  // ==========================================================================
  // EXECUTION LOOP
  // ==========================================================================
  
  /**
   * Get rows to process
   */
  private getRowsToProcess(): Record<string, string>[] {
    if (this.config.csvData && this.config.csvData.length > 0) {
      return this.config.csvData;
    }
    
    // No CSV data - execute once with empty row
    return [{}];
  }
  
  /**
   * Main row execution loop
   */
  private async executeRowLoop(rows: Record<string, string>[]): Promise<void> {
    while (this.currentRowIndex < rows.length) {
      // Check lifecycle
      if (this.lifecycle === 'paused' || this.lifecycle === 'stopped') {
        return;
      }
      
      if (this.lifecycle === 'error') {
        return;
      }
      
      const rowData = rows[this.currentRowIndex];
      
      try {
        // Apply row delay (except for first row)
        if (this.currentRowIndex > 0 && this.config.rowDelay > 0) {
          await sleep(this.config.rowDelay);
        }
        
        // Check again after delay
        if (this.lifecycle !== 'running') {
          return;
        }
        
        // Emit row start
        this.events.onRowStart?.(this.currentRowIndex, rowData);
        
        // Check if row has matching fields
        const hasMatching = rowHasMatchingFields(rowData, this.config.steps, this.config.fieldMappings);
        if (
          this.config.skipUnmatchedRows &&
          Object.keys(rowData).length > 0 &&
          !hasMatching
        ) {
          const result = createSkippedRowResult(
            this.currentRowIndex,
            rowData,
            'No matching fields'
          );
          this.rowResults.push(result);
          this.events.onRowComplete?.(result);
          this.emitProgress();
          this.currentRowIndex++;
          continue;
        }
        
        // Execute steps for this row
        const rowResult = await this.executeRow(rowData);
        this.rowResults.push(rowResult);
        
        // Emit row complete
        this.events.onRowComplete?.(rowResult);
        this.emitProgress();
        
        // Handle row failure
        if (!rowResult.success && !rowResult.skipped) {
          this.consecutiveRowFailures++;
          
          // Check max row failures
          if (
            this.config.maxRowFailures > 0 &&
            this.consecutiveRowFailures >= this.config.maxRowFailures
          ) {
            this.lifecycle = 'error';
            this.finishSession('error');
            return;
          }
          
          // Stop if not continuing on failure
          if (!this.config.continueOnRowFailure) {
            this.lifecycle = 'error';
            this.finishSession('error');
            return;
          }
        } else {
          this.consecutiveRowFailures = 0;
        }
        
        // Move to next row
        this.currentRowIndex++;
        
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.events.onError?.(err, this.currentRowIndex);
        this.lifecycle = 'error';
        this.finishSession('error');
        return;
      }
    }
    
    // All rows completed
    this.lifecycle = 'completed';
    this.finishSession('completed');
  }
  
  /**
   * Execute steps for a single row
   */
  private async executeRow(rowData: Record<string, string>): Promise<RowExecutionResult> {
    const startTime = Date.now();
    
    // Build execution context
    const context: ExecutionContext = {
      ...this.config.context,
      csvValues: rowData,
      fieldMappings: this.config.fieldMappings,
    };
    
    // Execute via engine
    const engineResult = await this.engine.executeAll(this.config.steps, context);
    
    // Reset engine for next row
    this.engine.reset();
    
    // Build row result
    return {
      rowIndex: this.currentRowIndex,
      rowData,
      skipped: false,
      success: engineResult.success,
      passed: engineResult.passedSteps,
      failed: engineResult.failedSteps,
      skippedSteps: engineResult.skippedSteps || 0,
      duration: Date.now() - startTime,
      stepResults: engineResult.results as StepExecutionResult[],
      error: engineResult.success ? undefined : 'One or more steps failed',
    };
  }
  
  /**
   * Emit progress update
   */
  private emitProgress(): void {
    const rows = this.getRowsToProcess();
    const progress = this.getProgress();
    this.events.onProgress?.(progress);
  }
  
  /**
   * Finish session and resolve promise
   */
  private finishSession(reason: 'completed' | 'stopped' | 'error'): void {
    this.endTime = Date.now();
    
    const summary = createSessionSummary(
      this.rowResults,
      this.config.steps.length,
      this.startTime,
      this.endTime
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
  // STATE ACCESSORS
  // ==========================================================================
  
  /**
   * Get current lifecycle
   */
  getLifecycle(): SessionLifecycle {
    return this.lifecycle;
  }
  
  /**
   * Get session progress
   */
  getProgress(): SessionProgress {
    const rows = this.getRowsToProcess();
    const totalRows = rows.length;
    const stepsPerRow = this.config.steps.length;
    
    const passedRows = this.rowResults.filter(r => r.success && !r.skipped).length;
    const failedRows = this.rowResults.filter(r => !r.success && !r.skipped).length;
    
    const completedRows = this.rowResults.length;
    const rowPercentage = totalRows > 0 ? (completedRows / totalRows) * 100 : 0;
    
    // Get current step from engine
    const engineProgress = this.engine.getProgress();
    const currentStep = engineProgress.currentStep;
    
    // Overall percentage accounts for rows and steps
    const totalOperations = totalRows * stepsPerRow;
    const completedOperations = (completedRows * stepsPerRow) + currentStep;
    const overallPercentage = totalOperations > 0
      ? (completedOperations / totalOperations) * 100
      : 0;
    
    return {
      currentRow: this.currentRowIndex,
      totalRows,
      rowPercentage,
      currentStep,
      stepsPerRow,
      overallPercentage,
      passedRows,
      failedRows,
    };
  }
  
  /**
   * Get all row results
   */
  getRowResults(): RowExecutionResult[] {
    return [...this.rowResults];
  }
  
  /**
   * Get current row index
   */
  getCurrentRowIndex(): number {
    return this.currentRowIndex;
  }
  
  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.lifecycle === 'running';
  }
  
  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.lifecycle === 'paused';
  }
  
  /**
   * Check if idle
   */
  isIdle(): boolean {
    return this.lifecycle === 'idle';
  }
  
  /**
   * Check if completed
   */
  isCompleted(): boolean {
    return this.lifecycle === 'completed';
  }
  
  // ==========================================================================
  // EVENT REGISTRATION
  // ==========================================================================
  
  /**
   * Register row start callback
   */
  onRowStart(callback: RowStartCallback): void {
    this.events.onRowStart = callback;
  }
  
  /**
   * Register row complete callback
   */
  onRowComplete(callback: RowCompleteCallback): void {
    this.events.onRowComplete = callback;
  }
  
  /**
   * Register progress callback
   */
  onProgress(callback: SessionProgressCallback): void {
    this.events.onProgress = callback;
  }
  
  /**
   * Register complete callback
   */
  onComplete(callback: SessionCompleteCallback): void {
    this.events.onComplete = callback;
  }
  
  /**
   * Register error callback
   */
  onError(callback: SessionErrorCallback): void {
    this.events.onError = callback;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a ReplaySession
 */
export function createReplaySession(config: ReplaySessionConfig): ReplaySession {
  return new ReplaySession(config);
}

/**
 * Create a single-run session (no CSV)
 */
export function createSingleRunSession(
  steps: Step[],
  context?: Partial<ExecutionContext>
): ReplaySession {
  return new ReplaySession({
    steps,
    context,
  });
}

/**
 * Create a data-driven session (with CSV)
 */
export function createDataDrivenSession(
  steps: Step[],
  csvData: Record<string, string>[],
  fieldMappings?: Record<string, string>
): ReplaySession {
  return new ReplaySession({
    steps,
    csvData,
    ...(fieldMappings && { fieldMappings }),
  });
}

// ============================================================================
// SINGLETON (optional, for simple use cases)
// ============================================================================

let currentSession: ReplaySession | null = null;

/**
 * Get current session
 */
export function getCurrentSession(): ReplaySession | null {
  return currentSession;
}

/**
 * Set current session
 */
export function setCurrentSession(session: ReplaySession | null): void {
  currentSession = session;
}

/**
 * Clear current session
 */
export function clearCurrentSession(): void {
  if (currentSession) {
    currentSession.reset();
  }
  currentSession = null;
}
