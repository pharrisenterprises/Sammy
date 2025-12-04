/**
 * TestOrchestrator - Main orchestrator coordinating all execution components
 * @module core/orchestrator/TestOrchestrator
 * @version 1.0.0
 * 
 * Coordinates the complete test execution lifecycle:
 * - Tab management and script injection
 * - Row iteration and step sequencing
 * - Value injection from CSV data
 * - Progress tracking and logging
 * - Error handling and recovery
 * - Result aggregation and TestRun creation
 * 
 * @see test-orchestrator_breakdown.md for architecture details
 */

import { ProgressTracker } from './ProgressTracker';
import { LogCollector } from './LogCollector';
import { ResultAggregator, type ExecutionResult } from './ResultAggregator';
import { TestRunBuilder, type TestRun } from './TestRunBuilder';
import { ErrorHandler, type ErrorHandlingResult } from './ErrorHandler';
import { StopController, isStopRequestedError } from './StopController';
import { PauseController } from './PauseController';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Execution status
 */
export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

/**
 * Orchestrator event type
 */
export type OrchestratorEventType = 
  | 'started' 
  | 'completed' 
  | 'stopped' 
  | 'paused' 
  | 'resumed'
  | 'progress'
  | 'step_started'
  | 'step_completed'
  | 'row_started'
  | 'row_completed'
  | 'all';

/**
 * Orchestrator event
 */
export interface OrchestratorEvent {
  /** Event type */
  type: OrchestratorEventType;
  /** Event data */
  data: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Test execution configuration
 */
export interface TestConfig {
  /** Project ID */
  projectId: number;
  /** Target URL to open */
  targetUrl: string;
  /** Recorded steps to execute */
  steps: ExecutionStep[];
  /** CSV data rows (empty array for single run) */
  csvData: Record<string, string>[];
  /** Field mappings (CSV column → step label) */
  fieldMappings: FieldMapping[];
  /** Execution options */
  options?: ExecutionOptions;
}

/**
 * Execution step definition
 */
export interface ExecutionStep {
  /** Step index */
  index: number;
  /** Step ID */
  id?: string | number;
  /** Step name/label */
  label: string;
  /** Event type */
  event: 'click' | 'input' | 'enter' | 'open';
  /** XPath or selector */
  path?: string;
  /** Selector string */
  selector?: string;
  /** Input value */
  value?: string;
  /** Element bundle for location */
  bundle?: unknown;
  /** X coordinate */
  x?: number;
  /** Y coordinate */
  y?: number;
}

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** CSV column name */
  fieldName: string;
  /** Step label to map to */
  inputVarFields: string;
  /** Whether mapping is active */
  mapped: boolean;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Delay between steps (ms). Default: 1000 */
  stepDelay?: number;
  /** Delay between rows (ms). Default: 2000 */
  rowDelay?: number;
  /** Step timeout (ms). Default: 30000 */
  stepTimeout?: number;
  /** Continue on error. Default: true */
  continueOnError?: boolean;
  /** Close tab after each row. Default: false */
  closeTabAfterRow?: boolean;
  /** Close tab after completion. Default: true */
  closeTabAfterCompletion?: boolean;
  /** Include debug logs. Default: false */
  includeDebugLogs?: boolean;
}

/**
 * Test run result
 */
export interface TestRunResult {
  /** Success status */
  success: boolean;
  /** Execution result data */
  result: ExecutionResult;
  /** Created TestRun (if saved) */
  testRun?: TestRun;
  /** Execution duration (ms) */
  duration: number;
  /** Whether execution was stopped */
  wasStopped: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  /** Success status */
  success: boolean;
  /** Step index */
  stepIndex: number;
  /** Execution duration (ms) */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Row execution result
 */
export interface RowExecutionResult {
  /** Success status */
  success: boolean;
  /** Row index */
  rowIndex: number;
  /** Steps passed */
  passedSteps: number;
  /** Steps failed */
  failedSteps: number;
  /** Steps skipped */
  skippedSteps: number;
  /** Row duration (ms) */
  duration: number;
}

/**
 * Orchestrator event listener
 */
export type OrchestratorEventListener = (event: OrchestratorEvent) => void;

/**
 * Tab operations interface (injected dependency)
 */
export interface ITabOperations {
  openTab(url: string): Promise<{ success: boolean; tabId?: number; error?: string }>;
  closeTab(tabId: number): Promise<{ success: boolean; error?: string }>;
  injectScript(tabId: number): Promise<{ success: boolean; error?: string }>;
  sendStepCommand(tabId: number, step: ExecutionStep): Promise<boolean>;
}

/**
 * Storage operations interface (injected dependency)
 */
export interface IStorageOperations {
  saveTestRun(testRun: TestRun): Promise<number>;
}

/**
 * Orchestrator state snapshot
 */
export interface OrchestratorState {
  /** Current execution status */
  status: ExecutionStatus;
  /** Progress data */
  progress: {
    percentage: number;
    currentStep: number;
    currentRow: number;
    totalSteps: number;
    totalRows: number;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };
  /** Current tab ID */
  currentTabId: number | null;
  /** Execution start time */
  startTime: Date | null;
  /** Execution end time */
  endTime: Date | null;
  /** Error count */
  errorCount: number;
  /** Whether paused */
  isPaused: boolean;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

/**
 * Default execution options
 */
export const DEFAULT_EXECUTION_OPTIONS: Required<ExecutionOptions> = {
  stepDelay: 1000,
  rowDelay: 2000,
  stepTimeout: 30000,
  continueOnError: true,
  closeTabAfterRow: false,
  closeTabAfterCompletion: true,
  includeDebugLogs: false,
};

// ============================================================================
// TEST ORCHESTRATOR CLASS
// ============================================================================

/**
 * TestOrchestrator - Main test execution coordinator
 * 
 * @example
 * ```typescript
 * const orchestrator = new TestOrchestrator(tabOps, storageOps);
 * 
 * // Subscribe to events
 * orchestrator.on('progress', (event) => {
 *   console.log(`Progress: ${event.data.percentage}%`);
 * });
 * 
 * // Run test
 * const result = await orchestrator.run({
 *   projectId: 1,
 *   targetUrl: 'https://example.com',
 *   steps: recordedSteps,
 *   csvData: csvRows,
 *   fieldMappings: mappings,
 * });
 * 
 * // Control execution
 * orchestrator.pause();
 * orchestrator.resume();
 * orchestrator.stop();
 * ```
 */
export class TestOrchestrator {
  // Dependencies
  private tabOperations: ITabOperations;
  private storageOperations: IStorageOperations | null;

  // Controllers
  private stopController: StopController;
  private pauseController: PauseController;
  private errorHandler: ErrorHandler;

  // Trackers
  private progressTracker: ProgressTracker | null = null;
  private logCollector: LogCollector | null = null;
  private resultAggregator: ResultAggregator | null = null;

  // State
  private currentConfig: TestConfig | null = null;
  private currentTabId: number | null = null;
  private status: ExecutionStatus = 'idle';
  private startTime: Date | null = null;
  private endTime: Date | null = null;

  // Event listeners
  private listeners: Map<OrchestratorEventType, Set<OrchestratorEventListener>> = new Map();

  /**
   * Create a new TestOrchestrator
   * 
   * @param tabOperations - Tab management operations
   * @param storageOperations - Optional storage operations for saving results
   */
  constructor(
    tabOperations: ITabOperations,
    storageOperations?: IStorageOperations
  ) {
    this.tabOperations = tabOperations;
    this.storageOperations = storageOperations ?? null;

    // Initialize controllers
    this.stopController = new StopController();
    this.pauseController = new PauseController();
    this.errorHandler = new ErrorHandler();

    // Wire up controller events
    this.setupControllerListeners();
  }

  // ==========================================================================
  // PRIMARY EXECUTION METHOD
  // ==========================================================================

  /**
   * Run test execution
   * 
   * @param config - Test configuration
   * @returns Promise resolving to test run result
   */
  public async run(config: TestConfig): Promise<TestRunResult> {
    // Validate config
    this.validateConfig(config);

    // Initialize
    this.currentConfig = config;
    this.status = 'running';
    this.startTime = new Date();
    this.endTime = null;

    const options = { ...DEFAULT_EXECUTION_OPTIONS, ...config.options };

    // Initialize trackers
    this.initializeTrackers(config, options);

    // Start execution tracking
    this.progressTracker!.startExecution();

    // Start controllers
    this.stopController.start();
    this.pauseController.reset();

    // Emit start event
    this.emitEvent('started', {
      projectId: config.projectId,
      totalSteps: config.steps.length,
      totalRows: config.csvData.length || 1,
    });

    this.logCollector!.executionStarted(config.projectId);

    try {
      // Open tab and inject script
      await this.setupTab(config.targetUrl);

      // Build mapping lookup for O(1) access
      const mappingLookup = this.buildMappingLookup(config.fieldMappings);

      // Determine rows to process
      const rowsToProcess = config.csvData.length > 0 
        ? config.csvData 
        : [{}]; // Single empty row for no-CSV mode

      // Execute rows
      for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
        // Check stop/pause
        await this.checkControllers();

        const row = rowsToProcess[rowIndex];
        await this.executeRow(config, row, rowIndex, mappingLookup, options);

        // Delay between rows (except last)
        if (rowIndex < rowsToProcess.length - 1 && options.rowDelay > 0) {
          await this.delayWithPauseCheck(options.rowDelay);
        }
      }

      // Mark complete
      this.stopController.complete();
      this.progressTracker!.completeExecution();
      this.resultAggregator!.markEnd();

    } catch (error) {
      // Handle stop request
      if (isStopRequestedError(error)) {
        this.logCollector!.executionStopped(
          this.stopController.getStopReason() ?? 'user_requested'
        );
        this.progressTracker!.stopExecution();
        this.resultAggregator!.markStopped();
      } else {
        // Unexpected error
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logCollector!.error(`Execution failed: ${errorMessage}`);
        this.errorHandler.handle(error as Error, {});
        this.progressTracker!.completeExecution();
        this.resultAggregator!.markEnd();
      }
    } finally {
      // Cleanup
      await this.cleanup(options);
    }

    // Aggregate results
    const result = this.resultAggregator!.aggregate(
      this.progressTracker!,
      this.logCollector!
    );

    // Build TestRun
    let testRun: TestRun | undefined;
    if (this.storageOperations) {
      try {
        const builder = TestRunBuilder.fromExecutionResult(result, config.projectId);
        testRun = builder.build();
        await this.storageOperations.saveTestRun(testRun);
      } catch (saveError) {
        this.logCollector!.error(`Failed to save test run: ${saveError}`);
      }
    }

    // Calculate duration
    this.endTime = new Date();
    const duration = this.endTime.getTime() - this.startTime!.getTime();

    // Update status
    this.status = this.stopController.wasStopped() ? 'stopped' : 
                  result.status === 'failed' ? 'failed' : 'completed';

    // Emit completion event
    this.emitEvent('completed', {
      success: result.status === 'completed',
      result,
      duration,
    });

    return {
      success: result.status === 'completed',
      result,
      testRun,
      duration,
      wasStopped: this.stopController.wasStopped(),
      error: result.status === 'failed' ? 'Test execution had failures' : undefined,
    };
  }

  // ==========================================================================
  // CONTROL METHODS
  // ==========================================================================

  /**
   * Pause execution
   */
  public pause(): void {
    this.pauseController.pause('user_requested', 'Paused by user');
    this.status = 'paused';
    this.logCollector?.warning('Execution paused by user');
    this.emitEvent('paused', { reason: 'user_requested' });
  }

  /**
   * Resume execution
   */
  public resume(): void {
    this.pauseController.resume();
    this.status = 'running';
    this.logCollector?.info('Execution resumed');
    this.emitEvent('resumed', {});
  }

  /**
   * Stop execution
   */
  public stop(): void {
    this.stopController.stop('user_requested', 'Stopped by user');
    this.status = 'stopped';
    this.logCollector?.warning('Execution stopped by user');
    this.emitEvent('stopped', { reason: 'user_requested' });
  }

  /**
   * Check if currently running
   */
  public isRunning(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }

  /**
   * Check if paused
   */
  public isPaused(): boolean {
    return this.status === 'paused';
  }

  /**
   * Get current status
   */
  public getStatus(): ExecutionStatus {
    return this.status;
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to orchestrator events
   * 
   * @param eventType - Event type to subscribe to
   * @param listener - Event listener function
   * @returns Unsubscribe function
   */
  public on(eventType: OrchestratorEventType, listener: OrchestratorEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return () => this.off(eventType, listener);
  }

  /**
   * Unsubscribe from events
   */
  public off(eventType: OrchestratorEventType, listener: OrchestratorEventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(type: OrchestratorEventType, data: Record<string, unknown>): void {
    const event: OrchestratorEvent = {
      type,
      data,
      timestamp: new Date(),
    };

    // Emit to specific type listeners
    this.listeners.get(type)?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[TestOrchestrator] Error in event listener:`, error);
      }
    });

    // Emit to 'all' listeners
    this.listeners.get('all')?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[TestOrchestrator] Error in event listener:`, error);
      }
    });
  }

  // ==========================================================================
  // ROW EXECUTION
  // ==========================================================================

  /**
   * Execute a single row
   */
  private async executeRow(
    config: TestConfig,
    row: Record<string, string>,
    rowIndex: number,
    mappingLookup: Record<string, string>,
    options: Required<ExecutionOptions>
  ): Promise<RowExecutionResult> {
    const startTime = Date.now();
    let passedSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;

    // Start row tracking
    this.progressTracker!.startRow(rowIndex, Object.keys(row).join(','));
    this.logCollector!.rowStarted(rowIndex, config.csvData.length || 1);

    // Emit row started event
    this.emitEvent('row_started', { rowIndex, totalRows: config.csvData.length || 1 });

    // Execute each step
    for (let stepIndex = 0; stepIndex < config.steps.length; stepIndex++) {
      // Check stop/pause
      await this.checkControllers();

      const step = config.steps[stepIndex];
      const stepResult = await this.executeStep(step, stepIndex, row, rowIndex, mappingLookup, options);

      if (stepResult.success) {
        passedSteps++;
      } else if (stepResult.error === 'skipped') {
        skippedSteps++;
      } else {
        failedSteps++;
      }

      // Delay between steps (except last)
      if (stepIndex < config.steps.length - 1 && options.stepDelay > 0) {
        await this.delayWithPauseCheck(options.stepDelay);
      }
    }

    // Complete row tracking
    this.progressTracker!.completeRow(rowIndex);
    this.logCollector!.rowCompleted(rowIndex, passedSteps, failedSteps, skippedSteps);

    // Emit row completed event
    this.emitEvent('row_completed', {
      rowIndex,
      passedSteps,
      failedSteps,
      skippedSteps,
    });

    return {
      success: failedSteps === 0,
      rowIndex,
      passedSteps,
      failedSteps,
      skippedSteps,
      duration: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep,
    stepIndex: number,
    row: Record<string, string>,
    rowIndex: number,
    mappingLookup: Record<string, string>,
    options: Required<ExecutionOptions>
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    // Start step tracking
    this.progressTracker!.startStep(stepIndex, { id: stepIndex, name: step.label });
    this.logCollector!.log('info', `[Step ${stepIndex}] Started: ${step.label}`);

    // Emit step started event
    this.emitEvent('step_started', { stepIndex, stepLabel: step.label, rowIndex });

    // Inject value from CSV if applicable
    const stepWithValue = this.injectValue(step, row, mappingLookup);

    // Check if step should be skipped (input with no value)
    if (step.event === 'input' && !stepWithValue.value && Object.keys(row).length > 0) {
      this.progressTracker!.completeStep(stepIndex, 'skipped', 0, 'No CSV value available');
      this.logCollector!.log('info', `[Step ${stepIndex}] Skipped: No CSV value for input step`);
      
      this.emitEvent('step_completed', {
        stepIndex,
        success: false,
        skipped: true,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        stepIndex,
        duration: Date.now() - startTime,
        error: 'skipped',
      };
    }

    try {
      // Execute step via tab operations
      if (!this.currentTabId) {
        throw new Error('No active tab');
      }

      const success = await this.tabOperations.sendStepCommand(
        this.currentTabId,
        stepWithValue
      );

      const duration = Date.now() - startTime;

      if (success) {
        this.progressTracker!.completeStep(stepIndex, 'passed', duration);
        this.logCollector!.log('info', `[Step ${stepIndex}] Passed (${duration}ms)`);
        
        this.emitEvent('step_completed', {
          stepIndex,
          success: true,
          duration,
        });

        return { success: true, stepIndex, duration };
      } else {
        const error = 'Step execution returned false';
        this.progressTracker!.completeStep(stepIndex, 'failed', duration, error);
        this.logCollector!.log('error', `[Step ${stepIndex}] Failed: ${error} (${duration}ms)`);

        const errorResult = this.errorHandler.handle(new Error(error), {
          step,
          row,
          retryAttempt: 0,
          maxRetries: 0,
        });

        this.emitEvent('step_completed', {
          stepIndex,
          success: false,
          error,
          duration,
        });

        if (!options.continueOnError && errorResult.shouldAbort) {
          throw new Error(error);
        }

        return { success: false, stepIndex, duration, error };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.progressTracker!.completeStep(stepIndex, 'failed', duration, errorMessage);
      this.logCollector!.log('error', `[Step ${stepIndex}] Failed: ${errorMessage} (${duration}ms)`);

      const errorResult = this.errorHandler.handle(error as Error, {
        step,
        row,
        retryAttempt: 0,
        maxRetries: 0,
      });

      this.emitEvent('step_completed', {
        stepIndex,
        success: false,
        error: errorMessage,
        duration,
      });

      if (!options.continueOnError && errorResult.shouldAbort) {
        throw error;
      }

      return { success: false, stepIndex, duration, error: errorMessage };
    }
  }

  // ==========================================================================
  // VALUE INJECTION
  // ==========================================================================

  /**
   * Inject CSV value into step
   */
  private injectValue(
    step: ExecutionStep,
    row: Record<string, string>,
    mappingLookup: Record<string, string>
  ): ExecutionStep {
    if (step.event !== 'input' && step.event !== 'click') {
      return step;
    }

    // Direct match: CSV column matches step label
    if (row[step.label] !== undefined) {
      return { ...step, value: row[step.label] };
    }

    // Mapped match: CSV column mapped to step label
    const mappedKey = Object.keys(mappingLookup).find(
      key => mappingLookup[key] === step.label
    );
    if (mappedKey && row[mappedKey] !== undefined) {
      return { ...step, value: row[mappedKey] };
    }

    // No match - return original step
    return step;
  }

  /**
   * Build mapping lookup object for O(1) access
   */
  private buildMappingLookup(mappings: FieldMapping[]): Record<string, string> {
    const lookup: Record<string, string> = {};
    
    for (const mapping of mappings) {
      if (mapping.mapped && mapping.fieldName && mapping.inputVarFields) {
        lookup[mapping.fieldName] = mapping.inputVarFields;
      }
    }
    
    return lookup;
  }

  // ==========================================================================
  // TAB MANAGEMENT
  // ==========================================================================

  /**
   * Setup tab for execution
   */
  private async setupTab(url: string): Promise<void> {
    this.logCollector!.info(`Opening tab: ${url}`);

    // Open tab
    const openResult = await this.tabOperations.openTab(url);
    if (!openResult.success || !openResult.tabId) {
      throw new Error(`Failed to open tab: ${openResult.error || 'Unknown error'}`);
    }

    this.currentTabId = openResult.tabId;
    this.logCollector!.info(`Tab opened: ${this.currentTabId}`);

    // Inject script
    const injectResult = await this.tabOperations.injectScript(this.currentTabId);
    if (!injectResult.success) {
      throw new Error(`Failed to inject script: ${injectResult.error || 'Unknown error'}`);
    }

    this.logCollector!.info('Content script injected');
  }

  /**
   * Cleanup after execution
   */
  private async cleanup(options: Required<ExecutionOptions>): Promise<void> {
    // Close tab if configured
    if (options.closeTabAfterCompletion && this.currentTabId) {
      try {
        await this.tabOperations.closeTab(this.currentTabId);
        this.logCollector!.info('Tab closed');
      } catch (error) {
        this.logCollector!.warning(`Failed to close tab: ${error}`);
      }
    }

    this.currentTabId = null;
  }

  // ==========================================================================
  // CONTROL HELPERS
  // ==========================================================================

  /**
   * Check stop and pause controllers
   */
  private async checkControllers(): Promise<void> {
    // Check stop first
    this.stopController.checkpoint();

    // Wait if paused
    await this.pauseController.waitIfPaused();

    // Check stop again after resume
    this.stopController.checkpoint();
  }

  /**
   * Delay with pause checking
   */
  private async delayWithPauseCheck(ms: number): Promise<void> {
    const checkInterval = 100;
    let elapsed = 0;

    while (elapsed < ms) {
      // Check stop
      if (this.stopController.shouldStop()) {
        this.stopController.checkpoint();
      }

      // Wait if paused (doesn't count toward delay)
      await this.pauseController.waitIfPaused();

      // Sleep
      const sleepTime = Math.min(checkInterval, ms - elapsed);
      await new Promise(resolve => setTimeout(resolve, sleepTime));
      elapsed += sleepTime;
    }
  }

  /**
   * Setup controller event listeners
   */
  private setupControllerListeners(): void {
    // Stop controller events
    this.stopController.onStop((event) => {
      this.emitEvent('stopped', { reason: event.reason, message: event.message });
    });

    // Pause controller events
    this.pauseController.onPause((event) => {
      if (event.type === 'paused') {
        this.emitEvent('paused', { reason: event.reason });
      } else if (event.type === 'resumed') {
        this.emitEvent('resumed', {});
      }
    });
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Validate configuration
   */
  private validateConfig(config: TestConfig): void {
    if (!config.projectId) {
      throw new Error('Project ID is required');
    }
    if (!config.targetUrl) {
      throw new Error('Target URL is required');
    }
    if (!config.steps || config.steps.length === 0) {
      throw new Error('At least one step is required');
    }
  }

  /**
   * Initialize trackers for execution
   */
  private initializeTrackers(config: TestConfig, options: Required<ExecutionOptions>): void {
    const totalRows = config.csvData.length || 1;

    // Progress tracker
    this.progressTracker = new ProgressTracker(
      totalRows,
      config.steps.length
    );

    // Log collector
    this.logCollector = new LogCollector({
      includeDebug: options.includeDebugLogs,
    });

    // Result aggregator
    this.resultAggregator = new ResultAggregator();
    this.resultAggregator.markStart();

    // Error handler reset
    this.errorHandler.reset();

    // Wire up progress events
    this.progressTracker.on('progress_update', (event) => {
      this.emitEvent('progress', {
        percentage: event.snapshot.percentage,
        currentStep: event.snapshot.currentStepIndex,
        currentRow: event.snapshot.currentRowIndex,
        passedSteps: event.snapshot.passedSteps,
        failedSteps: event.snapshot.failedSteps,
      });
    });
  }

  // ==========================================================================
  // STATE QUERIES
  // ==========================================================================

  /**
   * Get current progress
   */
  public getProgress(): number {
    return this.progressTracker?.getSnapshot().percentage ?? 0;
  }

  /**
   * Get logs as string
   */
  public getLogs(): string {
    return this.logCollector?.toString() ?? '';
  }

  /**
   * Get error count
   */
  public getErrorCount(): number {
    return this.errorHandler.getErrorCount();
  }

  /**
   * Get current state snapshot
   */
  public getState(): OrchestratorState {
    return {
      status: this.status,
      progress: this.progressTracker?.getSnapshot() ?? {
        percentage: 0,
        currentStep: 0,
        currentRow: 0,
        totalSteps: 0,
        totalRows: 0,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
      },
      currentTabId: this.currentTabId,
      startTime: this.startTime,
      endTime: this.endTime,
      errorCount: this.errorHandler.getErrorCount(),
      isPaused: this.pauseController.isPaused(),
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a TestOrchestrator instance
 */
export function createTestOrchestrator(
  tabOperations: ITabOperations,
  storageOperations?: IStorageOperations
): TestOrchestrator {
  return new TestOrchestrator(tabOperations, storageOperations);
}
