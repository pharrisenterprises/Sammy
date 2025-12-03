/**
 * TestOrchestrator - Test Execution Coordinator
 * @module core/orchestrator/TestOrchestrator
 * @version 1.0.0
 * 
 * Coordinates end-to-end test execution including tab management,
 * script injection, multi-row CSV execution, and result persistence.
 * 
 * ## Execution Flow
 * 1. Load project data from storage
 * 2. Open target tab and inject content script
 * 3. Execute replay session (single or multi-row)
 * 4. Track progress and emit events
 * 5. Persist test run results
 * 6. Clean up resources
 * 
 * @example
 * ```typescript
 * const orchestrator = new TestOrchestrator(tabManager);
 * 
 * orchestrator.onProgress((progress) => {
 *   console.log(`Progress: ${progress.overallPercentage}%`);
 * });
 * 
 * const result = await orchestrator.run({ projectId: 42 });
 * ```
 */

import type { Step } from '../types/step';
import type { Project } from '../types/project';
import type { TestRunStatus } from '../types/test-run';
import {
  ReplaySession,
  createReplaySession,
  type SessionSummary,
} from '../replay/ReplaySession';
import type { StepExecutionResult } from '../replay/StepExecutor';
import {
  type ITestOrchestrator,
  type ITabManager,
  type OrchestratorLifecycle,
  type OrchestratorConfig,
  type OrchestratorProgress,
  type OrchestratorResult,
  type OrchestratorEvents,
  type TabInfo,
  type LogLevel,
  type LogEntry,
  type StepStatus,
  type ProjectLoadedCallback,
  type TabOpenedCallback,
  type RowStartCallback,
  type RowCompleteCallback,
  type StepStartCallback,
  type StepCompleteCallback,
  type ProgressCallback,
  type LogCallback,
  type CompleteCallback,
  type ErrorCallback,
  type LifecycleCallback,
  ORCHESTRATOR_TRANSITIONS,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './ITestOrchestrator';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format timestamp for logs
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Check if state transition is valid
 */
function isValidTransition(
  from: OrchestratorLifecycle,
  to: OrchestratorLifecycle
): boolean {
  return ORCHESTRATOR_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Build field mappings lookup from project parsed_fields
 */
function buildFieldMappings(
  parsedFields: Array<{ field_name: string; mapped: boolean; inputvarfields: string }>
): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  for (const field of parsedFields) {
    if (field.mapped && field.field_name && field.inputvarfields) {
      mappings[field.field_name] = field.inputvarfields;
    }
  }
  
  return mappings;
}

/**
 * Create initial step statuses from steps
 */
function createStepStatuses(steps: Step[]): StepStatus[] {
  return steps.map((step, index) => ({
    index,
    name: step.label || `Step ${index + 1}`,
    event: step.event,
    status: 'pending',
    duration: 0,
  }));
}

// ============================================================================
// TEST ORCHESTRATOR CLASS
// ============================================================================

/**
 * Coordinates test execution with tab management and result persistence
 */
export class TestOrchestrator implements ITestOrchestrator {
  private tabManager: ITabManager;
  private events: OrchestratorEvents;
  
  // State
  private lifecycle: OrchestratorLifecycle = 'idle';
  private project: Project | null = null;
  private config: Required<Omit<OrchestratorConfig, 'projectId'>> & { projectId: number } | null = null;
  private tab: TabInfo | null = null;
  private session: ReplaySession | null = null;
  private testRunId: number | null = null;
  
  // Progress tracking
  private logs: LogEntry[] = [];
  private stepStatuses: StepStatus[] = [];
  private startTime: number = 0;
  
  // Execution control
  private executionPromise: Promise<OrchestratorResult> | null = null;
  private resolveExecution: ((result: OrchestratorResult) => void) | null = null;
  
  constructor(tabManager: ITabManager, events?: Partial<OrchestratorEvents>) {
    this.tabManager = tabManager;
    this.events = events || {};
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Load project and prepare for execution
   */
  async load(projectId: number): Promise<Project> {
    this.transitionTo('loading');
    
    try {
      // Request project from storage via messaging
      const project = await this.loadProjectFromStorage(projectId);
      
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      
      // Validate project has required data
      if (!project.recorded_steps || project.recorded_steps.length === 0) {
        throw new Error('Project has no recorded steps');
      }
      
      if (!project.target_url) {
        throw new Error('Project has no target URL');
      }
      
      this.project = project;
      this.transitionTo('ready');
      
      this.log('info', `Loaded project: ${project.name}`);
      this.events.onProjectLoaded?.(project);
      
      return project;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('error', `Failed to load project: ${err.message}`);
      this.transitionTo('error');
      throw err;
    }
  }
  
  /**
   * Run test execution
   */
  async run(config: OrchestratorConfig): Promise<OrchestratorResult> {
    // Load project if not already loaded
    if (!this.project || this.project.id !== config.projectId) {
      await this.load(config.projectId);
    }
    
    if (this.lifecycle !== 'ready') {
      throw new Error(`Cannot run from state: ${this.lifecycle}`);
    }
    
    // Merge config with defaults
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config,
    };
    
    // Initialize execution state
    this.logs = [];
    this.startTime = Date.now();
    this.stepStatuses = createStepStatuses(this.project!.recorded_steps || []);
    
    // Create test run record
    if (this.config.persistResults) {
      await this.createTestRun();
    }
    
    // Transition to running
    this.transitionTo('running');
    
    // Create execution promise
    this.executionPromise = new Promise((resolve) => {
      this.resolveExecution = resolve;
    });
    
    // Start execution
    this.executeTest();
    
    return this.executionPromise;
  }
  
  /**
   * Pause execution
   */
  pause(): void {
    if (!this.canPause()) {
      throw new Error(`Cannot pause from state: ${this.lifecycle}`);
    }
    
    this.transitionTo('paused');
    this.log('warning', 'Execution paused');
    
    if (this.session) {
      this.session.pause();
    }
  }
  
  /**
   * Resume execution
   */
  resume(): void {
    if (!this.canResume()) {
      throw new Error(`Cannot resume from state: ${this.lifecycle}`);
    }
    
    this.transitionTo('running');
    this.log('info', 'Execution resumed');
    
    if (this.session) {
      this.session.resume();
    }
  }
  
  /**
   * Stop execution
   */
  stop(): void {
    if (!this.canStop()) {
      throw new Error(`Cannot stop from state: ${this.lifecycle}`);
    }
    
    this.transitionTo('stopping');
    this.log('warning', 'Execution stopping...');
    
    if (this.session) {
      this.session.stop();
    }
    
    // Finish will be called by session complete handler
  }
  
  /**
   * Reset to idle state
   */
  reset(): void {
    // Stop if running
    if (this.lifecycle === 'running' || this.lifecycle === 'paused') {
      this.session?.stop();
    }
    
    // Clean up
    this.project = null;
    this.config = null;
    this.tab = null;
    this.session = null;
    this.testRunId = null;
    this.logs = [];
    this.stepStatuses = [];
    this.startTime = 0;
    this.executionPromise = null;
    this.resolveExecution = null;
    
    this.transitionTo('idle');
    this.log('info', 'Orchestrator reset');
  }
  
  // ==========================================================================
  // STATE ACCESSORS
  // ==========================================================================
  
  getLifecycle(): OrchestratorLifecycle {
    return this.lifecycle;
  }
  
  getProgress(): OrchestratorProgress {
    const sessionProgress = this.session?.getProgress();
    const elapsedTime = this.startTime > 0 ? Date.now() - this.startTime : 0;
    
    if (!sessionProgress) {
      return {
        lifecycle: this.lifecycle,
        currentRow: 0,
        totalRows: 0,
        currentStep: 0,
        totalSteps: this.project?.recorded_steps?.length || 0,
        rowPercentage: 0,
        overallPercentage: 0,
        passedRows: 0,
        failedRows: 0,
        skippedRows: 0,
        elapsedTime,
        estimatedRemaining: null,
      };
    }
    
    // Estimate remaining time based on progress
    const estimatedRemaining = sessionProgress.overallPercentage > 0
      ? (elapsedTime / sessionProgress.overallPercentage) * (100 - sessionProgress.overallPercentage)
      : null;
    
    return {
      lifecycle: this.lifecycle,
      currentRow: sessionProgress.currentRow,
      totalRows: sessionProgress.totalRows,
      currentStep: sessionProgress.currentStep,
      totalSteps: sessionProgress.stepsPerRow,
      rowPercentage: sessionProgress.rowPercentage,
      overallPercentage: sessionProgress.overallPercentage,
      passedRows: sessionProgress.passedRows,
      failedRows: sessionProgress.failedRows,
      skippedRows: 0, // TODO: track from session
      elapsedTime,
      estimatedRemaining,
    };
  }
  
  getLogs(): LogEntry[] {
    return [...this.logs];
  }
  
  getStepStatuses(): StepStatus[] {
    return [...this.stepStatuses];
  }
  
  getProject(): Project | null {
    return this.project;
  }
  
  getTab(): TabInfo | null {
    return this.tab;
  }
  
  canStart(): boolean {
    return this.lifecycle === 'ready';
  }
  
  canPause(): boolean {
    return this.lifecycle === 'running';
  }
  
  canResume(): boolean {
    return this.lifecycle === 'paused';
  }
  
  canStop(): boolean {
    return this.lifecycle === 'running' || this.lifecycle === 'paused';
  }
  
  // ==========================================================================
  // EVENT REGISTRATION
  // ==========================================================================
  
  onProjectLoaded(callback: ProjectLoadedCallback): void {
    this.events.onProjectLoaded = callback;
  }
  
  onTabOpened(callback: TabOpenedCallback): void {
    this.events.onTabOpened = callback;
  }
  
  onRowStart(callback: RowStartCallback): void {
    this.events.onRowStart = callback;
  }
  
  onRowComplete(callback: RowCompleteCallback): void {
    this.events.onRowComplete = callback;
  }
  
  onStepStart(callback: StepStartCallback): void {
    this.events.onStepStart = callback;
  }
  
  onStepComplete(callback: StepCompleteCallback): void {
    this.events.onStepComplete = callback;
  }
  
  onProgress(callback: ProgressCallback): void {
    this.events.onProgress = callback;
  }
  
  onLog(callback: LogCallback): void {
    this.events.onLog = callback;
  }
  
  onComplete(callback: CompleteCallback): void {
    this.events.onComplete = callback;
  }
  
  onError(callback: ErrorCallback): void {
    this.events.onError = callback;
  }
  
  onLifecycleChange(callback: LifecycleCallback): void {
    this.events.onLifecycleChange = callback;
  }
  
  // ==========================================================================
  // LOGGING
  // ==========================================================================
  
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      message,
      data,
    };
    
    this.logs.push(entry);
    this.events.onLog?.(entry);
  }
  
  // ==========================================================================
  // PRIVATE: STATE MANAGEMENT
  // ==========================================================================
  
  private transitionTo(newState: OrchestratorLifecycle): void {
    const previousState = this.lifecycle;
    
    if (previousState !== newState && !isValidTransition(previousState, newState)) {
      throw new Error(`Invalid transition: ${previousState} → ${newState}`);
    }
    
    this.lifecycle = newState;
    
    if (previousState !== newState) {
      this.events.onLifecycleChange?.(newState, previousState);
    }
  }
  
  // ==========================================================================
  // PRIVATE: STORAGE OPERATIONS
  // ==========================================================================
  
  private async loadProjectFromStorage(projectId: number): Promise<Project | null> {
    // This would typically use chrome.runtime.sendMessage
    // For now, we'll define the interface and let the implementation
    // be provided by the actual runtime environment
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          action: 'get_project_by_id',
          id: projectId,
        });
        return response?.project || null;
      }
      
      // Fallback for testing
      return null;
    } catch (error) {
      this.log('error', `Storage error: ${error}`);
      return null;
    }
  }
  
  private async createTestRun(): Promise<void> {
    if (!this.project || !this.config) return;
    
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          action: 'createTestRun',
          testRun: {
            project_id: this.project.id!,
            status: 'running' as TestRunStatus,
            start_time: new Date().toISOString(),
            total_steps: this.project.recorded_steps?.length || 0,
            passed_steps: 0,
            failed_steps: 0,
            test_results: [],
            logs: '',
          },
        });
        
        this.testRunId = response?.id || null;
        this.log('info', `Created test run: ${this.testRunId}`);
      }
    } catch (error) {
      this.log('warning', `Failed to create test run: ${error}`);
    }
  }
  
  private async updateTestRun(
    status: TestRunStatus,
    passedSteps: number,
    failedSteps: number,
    results: StepExecutionResult[]
  ): Promise<void> {
    if (!this.testRunId) return;
    
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({
          action: 'updateTestRun',
          id: this.testRunId,
          updates: {
            status,
            end_time: new Date().toISOString(),
            passed_steps: passedSteps,
            failed_steps: failedSteps,
            test_results: results,
            logs: this.logs.map(l => `[${l.timestamp}] ${l.level}: ${l.message}`).join('\n'),
          },
        });
      }
    } catch (error) {
      this.log('warning', `Failed to update test run: ${error}`);
    }
  }
  
  // ==========================================================================
  // PRIVATE: TAB MANAGEMENT
  // ==========================================================================
  
  private async openTab(): Promise<TabInfo | null> {
    if (!this.project || !this.config) return null;
    
    // Check if reusing existing tab
    if (this.config.reuseTab && this.config.existingTabId) {
      const tabInfo = await this.tabManager.getTabInfo(this.config.existingTabId);
      if (tabInfo) {
        this.log('info', `Reusing existing tab: ${tabInfo.tabId}`);
        return tabInfo;
      }
    }
    
    // Open new tab
    this.log('info', `Opening tab: ${this.project.target_url}`);
    
    const result = await this.tabManager.openTab(this.project.target_url);
    
    if (!result.success || !result.tab) {
      this.log('error', `Failed to open tab: ${result.error}`);
      return null;
    }
    
    this.log('success', `Tab opened: ${result.tab.tabId}`);
    return result.tab;
  }
  
  private async closeTab(): Promise<void> {
    if (!this.tab) return;
    
    if (this.config?.closeTabOnComplete) {
      this.log('info', `Closing tab: ${this.tab.tabId}`);
      await this.tabManager.closeTab(this.tab.tabId);
      this.tab = null;
    }
  }
  
  // ==========================================================================
  // PRIVATE: EXECUTION
  // ==========================================================================
  
  private async executeTest(): Promise<void> {
    if (!this.project || !this.config) {
      this.finishExecution('error', 'No project or config');
      return;
    }
    
    try {
      // Open tab
      this.tab = await this.openTab();
      
      if (!this.tab) {
        this.finishExecution('error', 'Failed to open tab');
        return;
      }
      
      this.events.onTabOpened?.(this.tab);
      
      // Wait for script injection
      const isReady = await this.tabManager.isTabReady(this.tab.tabId);
      if (!isReady) {
        this.log('warning', 'Tab not ready, attempting to inject script');
        const injected = await this.tabManager.injectScript(this.tab.tabId);
        if (!injected) {
          this.finishExecution('error', 'Failed to inject content script');
          return;
        }
      }
      
      // Build field mappings
      const fieldMappings = buildFieldMappings(this.project.parsed_fields || []);
      
      // Get CSV data
      const csvData = this.config.rowIndices && this.config.rowIndices.length > 0
        ? this.config.rowIndices.map(i => (this.project!.csv_data || [])[i] || {})
        : this.project.csv_data || [];
      
      // Create replay session
      this.session = createReplaySession({
        steps: this.project.recorded_steps || [],
        csvData: csvData.length > 0 ? csvData : undefined,
        fieldMappings,
        context: {
          tabId: this.tab.tabId,
          pageUrl: this.project.target_url,
        },
        engineConfig: {
          execution: {
            findTimeout: this.config.stepTimeout,
          },
          continueOnFailure: this.config.continueOnRowFailure,
          maxConsecutiveFailures: this.config.maxRowFailures,
          stepDelay: this.config.stepDelay,
          humanDelay: this.config.humanDelay,
        },
        continueOnRowFailure: this.config.continueOnRowFailure,
        maxRowFailures: this.config.maxRowFailures,
        rowDelay: this.config.rowDelay,
      });
      
      // Wire up session events
      this.wireSessionEvents();
      
      // Start session
      this.log('info', `Starting test with ${this.project.recorded_steps?.length || 0} steps`);
      const summary = await this.session.start();
      
      // Handle completion
      this.handleSessionComplete(summary);
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('error', `Execution error: ${err.message}`);
      this.events.onError?.(err, 'executeTest');
      this.finishExecution('error', err.message);
    }
  }
  
  private wireSessionEvents(): void {
    if (!this.session) return;
    
    this.session.onRowStart((rowIndex, rowData) => {
      const rowNum = rowIndex + 1;
      const totalRows = this.session?.getProgress().totalRows || 1;
      
      if (totalRows > 1) {
        this.log('info', `Starting row ${rowNum} of ${totalRows}`);
      } else {
        this.log('info', 'Starting test execution');
      }
      
      // Reset step statuses for new row
      if (this.project) {
        this.stepStatuses = createStepStatuses(this.project.recorded_steps || []);
      }
      
      this.events.onRowStart?.(rowIndex, rowData);
    });
    
    this.session.onRowComplete((result) => {
      const rowNum = result.rowIndex + 1;
      
      if (result.skipped) {
        this.log('warning', `Row ${rowNum} skipped: ${result.skipReason}`);
      } else if (result.success) {
        this.log('success', `Row ${rowNum} completed: ${result.passed} passed`);
      } else {
        this.log('error', `Row ${rowNum} failed: ${result.failed} failed`);
      }
      
      this.events.onRowComplete?.(result);
    });
    
    this.session.onProgress(() => {
      // Update overall progress
      const orchestratorProgress = this.getProgress();
      this.events.onProgress?.(orchestratorProgress);
    });
    
    this.session.onError((error, rowIndex) => {
      this.log('error', `Error at row ${(rowIndex || 0) + 1}: ${error.message}`);
      this.events.onError?.(error, `row-${rowIndex}`);
    });
  }
  
  private handleSessionComplete(summary: SessionSummary): void {
    // Calculate totals
    const passedSteps = summary.passedSteps;
    const failedSteps = summary.failedSteps;
    const allResults = summary.rowResults.flatMap(r => r.stepResults);
    
    // Determine final status - use casting as TestRunStatus enum may vary
    const status = (summary.success ? 'completed' : 'failed') as TestRunStatus;
    
    // Log summary
    this.log(
      summary.success ? 'success' : 'error',
      `Test ${status}: ${summary.passedRows}/${summary.totalRows} rows passed, ` +
      `${passedSteps}/${summary.totalSteps} steps passed`
    );
    
    // Update test run
    if (this.config?.persistResults) {
      this.updateTestRun(status, passedSteps, failedSteps, allResults);
    }
    
    // Determine final state
    if (this.lifecycle === 'stopping') {
      this.finishExecution('stopped', 'User stopped');
    } else if (summary.success) {
      this.finishExecution('completed');
    } else {
      this.finishExecution('completed'); // Still completed, just with failures
    }
  }
  
  private async finishExecution(
    finalState: 'completed' | 'stopped' | 'error',
    error?: string
  ): Promise<void> {
    // Close tab if configured
    await this.closeTab();
    
    // Transition to final state
    if (finalState === 'stopped') {
      this.transitionTo('stopped');
    } else if (finalState === 'error') {
      this.transitionTo('error');
    } else {
      this.transitionTo('completed');
    }
    
    // Build result
    const summary = this.session?.getRowResults() || [];
    const sessionSummary: SessionSummary = {
      totalRows: summary.length,
      passedRows: summary.filter(r => r.success && !r.skipped).length,
      failedRows: summary.filter(r => !r.success && !r.skipped).length,
      skippedRows: summary.filter(r => r.skipped).length,
      totalSteps: summary.length * (this.project?.recorded_steps?.length || 0),
      passedSteps: summary.reduce((sum, r) => sum + r.passed, 0),
      failedSteps: summary.reduce((sum, r) => sum + r.failed, 0),
      skippedStepsCount: summary.reduce((sum, r) => sum + r.skippedSteps, 0),
      duration: Date.now() - this.startTime,
      success: finalState === 'completed' && summary.every(r => r.success || r.skipped),
      rowResults: summary,
      startTime: this.startTime,
      endTime: Date.now(),
    };
    
    const result: OrchestratorResult = {
      success: finalState === 'completed' && sessionSummary.success,
      finalState: this.lifecycle,
      project: this.project!,
      summary: sessionSummary,
      logs: this.logs,
      tab: this.tab || undefined,
      error,
    };
    
    // Emit complete
    this.events.onComplete?.(result);
    
    // Resolve promise
    if (this.resolveExecution) {
      this.resolveExecution(result);
      this.resolveExecution = null;
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a TestOrchestrator
 */
export function createTestOrchestrator(
  tabManager: ITabManager,
  events?: Partial<OrchestratorEvents>
): TestOrchestrator {
  return new TestOrchestrator(tabManager, events);
}

// ============================================================================
// MOCK TAB MANAGER (for testing)
// ============================================================================

/**
 * Create a mock tab manager for testing
 */
export function createMockTabManager(options: {
  openSuccess?: boolean;
  tabId?: number;
  scriptInjected?: boolean;
} = {}): ITabManager {
  const {
    openSuccess = true,
    tabId = 123,
    scriptInjected = true,
  } = options;
  
  const mockTab: TabInfo = {
    tabId,
    url: 'https://example.com',
    scriptInjected,
    createdAt: Date.now(),
  };
  
  return {
    async openTab(url: string) {
      if (openSuccess) {
        return { success: true, tab: { ...mockTab, url } };
      }
      return { success: false, error: 'Failed to open tab' };
    },
    
    async closeTab(_tabId: number) {
      return true;
    },
    
    async injectScript(_tabId: number) {
      return scriptInjected;
    },
    
    async isTabReady(_tabId: number) {
      return scriptInjected;
    },
    
    async getTabInfo(_tabId: number) {
      return mockTab;
    },
    
    async sendMessage<T>(_tabId: number, _message: unknown): Promise<T> {
      return true as unknown as T;
    },
  };
}
