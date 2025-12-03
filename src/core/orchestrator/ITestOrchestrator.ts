/**
 * ITestOrchestrator - Test Orchestration Interface
 * @module core/orchestrator/ITestOrchestrator
 * @version 1.0.0
 * 
 * Defines the contract for test execution orchestration including
 * tab management, script injection, multi-row execution, and result persistence.
 * 
 * ## Orchestration Flow
 * 1. Load project data (steps, CSV, mappings)
 * 2. Open target tab and inject content script
 * 3. For each CSV row (or single run):
 *    - Execute all steps via replay engine
 *    - Track progress and collect results
 * 4. Save test run to storage
 * 5. Clean up (close tab if configured)
 * 
 * ## Tab Management
 * - Opens new tab with target URL
 * - Waits for content script injection
 * - Sends replay commands via chrome.tabs.sendMessage
 * - Closes tab on completion (optional)
 * 
 * @example
 * ```typescript
 * const orchestrator: ITestOrchestrator = getOrchestrator();
 * 
 * orchestrator.onProgress((progress) => {
 *   updateUI(progress);
 * });
 * 
 * const result = await orchestrator.run(projectId);
 * ```
 */

import type { Step } from '../types/step';
import type { Project } from '../types/project';
import type { TestRun, TestRunStatus } from '../types/test-run';
import type { SessionSummary, RowExecutionResult } from '../replay/ReplaySession';
import type { StepExecutionResult } from '../replay/StepExecutor';

// ============================================================================
// ORCHESTRATOR LIFECYCLE
// ============================================================================

/**
 * Orchestrator lifecycle states
 */
export type OrchestratorLifecycle =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'error';

/**
 * Valid state transitions
 */
export const ORCHESTRATOR_TRANSITIONS: Record<OrchestratorLifecycle, OrchestratorLifecycle[]> = {
  idle: ['loading'],
  loading: ['ready', 'error'],
  ready: ['running', 'idle'],
  running: ['paused', 'stopping', 'completed', 'error'],
  paused: ['running', 'stopping'],
  stopping: ['stopped'],
  stopped: ['idle'],
  completed: ['idle'],
  error: ['idle'],
};

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Tab information
 */
export interface TabInfo {
  /** Chrome tab ID */
  tabId: number;
  
  /** Tab URL */
  url: string;
  
  /** Whether content script is injected */
  scriptInjected: boolean;
  
  /** Tab creation timestamp */
  createdAt: number;
}

/**
 * Tab management result
 */
export interface TabResult {
  /** Whether operation succeeded */
  success: boolean;
  
  /** Tab info if successful */
  tab?: TabInfo;
  
  /** Error message if failed */
  error?: string;
}

/**
 * Tab manager interface
 */
export interface ITabManager {
  /**
   * Open a new tab with URL
   */
  openTab(url: string): Promise<TabResult>;
  
  /**
   * Close a tab
   */
  closeTab(tabId: number): Promise<boolean>;
  
  /**
   * Inject content script into tab
   */
  injectScript(tabId: number): Promise<boolean>;
  
  /**
   * Check if tab is ready for commands
   */
  isTabReady(tabId: number): Promise<boolean>;
  
  /**
   * Get current tab info
   */
  getTabInfo(tabId: number): Promise<TabInfo | null>;
  
  /**
   * Send message to tab
   */
  sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>;
}

// ============================================================================
// EXECUTION CONFIGURATION
// ============================================================================

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Project ID to run */
  projectId: number;
  
  /** Specific CSV rows to run (empty = all rows) */
  rowIndices?: number[];
  
  /** Whether to close tab after execution (default: false) */
  closeTabOnComplete?: boolean;
  
  /** Whether to reuse existing tab (default: false) */
  reuseTab?: boolean;
  
  /** Existing tab ID to reuse */
  existingTabId?: number;
  
  /** Delay between rows in ms (default: 1000) */
  rowDelay?: number;
  
  /** Delay between steps in ms (default: 0) */
  stepDelay?: number;
  
  /** Human-like delay range [min, max] in ms */
  humanDelay?: [number, number] | null;
  
  /** Whether to continue after row failure (default: true) */
  continueOnRowFailure?: boolean;
  
  /** Maximum row failures before stopping (0 = unlimited) */
  maxRowFailures?: number;
  
  /** Step execution timeout in ms (default: 30000) */
  stepTimeout?: number;
  
  /** Whether to capture screenshots on failure (default: false) */
  captureScreenshots?: boolean;
  
  /** Whether to save test run to storage (default: true) */
  persistResults?: boolean;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: Required<Omit<OrchestratorConfig, 'projectId'>> = {
  rowIndices: [],
  closeTabOnComplete: false,
  reuseTab: false,
  existingTabId: 0,
  rowDelay: 1000,
  stepDelay: 0,
  humanDelay: [50, 300],
  continueOnRowFailure: true,
  maxRowFailures: 0,
  stepTimeout: 30000,
  captureScreenshots: false,
  persistResults: true,
};

// ============================================================================
// PROGRESS & LOGGING
// ============================================================================

/**
 * Log levels
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Log entry
 */
export interface LogEntry {
  /** Timestamp (ISO string) */
  timestamp: string;
  
  /** Log level */
  level: LogLevel;
  
  /** Log message */
  message: string;
  
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Orchestrator progress
 */
export interface OrchestratorProgress {
  /** Current lifecycle state */
  lifecycle: OrchestratorLifecycle;
  
  /** Current row index (0-based) */
  currentRow: number;
  
  /** Total rows to process */
  totalRows: number;
  
  /** Current step within row (0-based) */
  currentStep: number;
  
  /** Total steps per row */
  totalSteps: number;
  
  /** Row percentage (0-100) */
  rowPercentage: number;
  
  /** Overall percentage (0-100) */
  overallPercentage: number;
  
  /** Passed rows count */
  passedRows: number;
  
  /** Failed rows count */
  failedRows: number;
  
  /** Skipped rows count */
  skippedRows: number;
  
  /** Elapsed time in ms */
  elapsedTime: number;
  
  /** Estimated remaining time in ms (null if unknown) */
  estimatedRemaining: number | null;
}

/**
 * Step status for UI display
 */
export interface StepStatus {
  /** Step index */
  index: number;
  
  /** Step name/label */
  name: string;
  
  /** Step event type */
  event: string;
  
  /** Current status */
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  
  /** Execution duration in ms */
  duration: number;
  
  /** Error message if failed */
  errorMessage?: string;
}

// ============================================================================
// EXECUTION RESULTS
// ============================================================================

/**
 * Orchestrator execution result
 */
export interface OrchestratorResult {
  /** Whether execution completed successfully */
  success: boolean;
  
  /** Final lifecycle state */
  finalState: OrchestratorLifecycle;
  
  /** Project that was executed */
  project: Project;
  
  /** Test run record (if persisted) */
  testRun?: TestRun;
  
  /** Session summary */
  summary: SessionSummary;
  
  /** All logs */
  logs: LogEntry[];
  
  /** Tab info (if tab is still open) */
  tab?: TabInfo;
  
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// CALLBACKS
// ============================================================================

/**
 * Callback when project is loaded
 */
export type ProjectLoadedCallback = (project: Project) => void;

/**
 * Callback when tab is opened
 */
export type TabOpenedCallback = (tab: TabInfo) => void;

/**
 * Callback when row starts
 */
export type RowStartCallback = (rowIndex: number, rowData: Record<string, string>) => void;

/**
 * Callback when row completes
 */
export type RowCompleteCallback = (result: RowExecutionResult) => void;

/**
 * Callback when step starts
 */
export type StepStartCallback = (step: Step, stepIndex: number, rowIndex: number) => void;

/**
 * Callback when step completes
 */
export type StepCompleteCallback = (result: StepExecutionResult, stepIndex: number, rowIndex: number) => void;

/**
 * Callback for progress updates
 */
export type ProgressCallback = (progress: OrchestratorProgress) => void;

/**
 * Callback for log entries
 */
export type LogCallback = (entry: LogEntry) => void;

/**
 * Callback when execution completes
 */
export type CompleteCallback = (result: OrchestratorResult) => void;

/**
 * Callback for errors
 */
export type ErrorCallback = (error: Error, context?: string) => void;

/**
 * Callback for lifecycle changes
 */
export type LifecycleCallback = (
  newState: OrchestratorLifecycle,
  previousState: OrchestratorLifecycle
) => void;

/**
 * All orchestrator events
 */
export interface OrchestratorEvents {
  onProjectLoaded?: ProjectLoadedCallback;
  onTabOpened?: TabOpenedCallback;
  onRowStart?: RowStartCallback;
  onRowComplete?: RowCompleteCallback;
  onStepStart?: StepStartCallback;
  onStepComplete?: StepCompleteCallback;
  onProgress?: ProgressCallback;
  onLog?: LogCallback;
  onComplete?: CompleteCallback;
  onError?: ErrorCallback;
  onLifecycleChange?: LifecycleCallback;
}

// ============================================================================
// MAIN INTERFACE
// ============================================================================

/**
 * Test Orchestrator Interface
 * 
 * Coordinates test execution including tab management, script injection,
 * multi-row CSV execution, and result persistence.
 */
export interface ITestOrchestrator {
  // ===========================================================================
  // LIFECYCLE METHODS
  // ===========================================================================
  
  /**
   * Load project and prepare for execution
   * @param projectId Project ID to load
   * @returns Loaded project
   */
  load(projectId: number): Promise<Project>;
  
  /**
   * Run test execution
   * @param config Execution configuration
   * @returns Execution result
   */
  run(config: OrchestratorConfig): Promise<OrchestratorResult>;
  
  /**
   * Pause execution at next step boundary
   */
  pause(): void;
  
  /**
   * Resume from paused state
   */
  resume(): void;
  
  /**
   * Stop execution
   */
  stop(): void;
  
  /**
   * Reset to idle state
   */
  reset(): void;
  
  // ===========================================================================
  // STATE ACCESSORS
  // ===========================================================================
  
  /**
   * Get current lifecycle state
   */
  getLifecycle(): OrchestratorLifecycle;
  
  /**
   * Get current progress
   */
  getProgress(): OrchestratorProgress;
  
  /**
   * Get all logs
   */
  getLogs(): LogEntry[];
  
  /**
   * Get step statuses for UI
   */
  getStepStatuses(): StepStatus[];
  
  /**
   * Get current project (if loaded)
   */
  getProject(): Project | null;
  
  /**
   * Get current tab info (if open)
   */
  getTab(): TabInfo | null;
  
  /**
   * Check if orchestrator can start
   */
  canStart(): boolean;
  
  /**
   * Check if orchestrator can pause
   */
  canPause(): boolean;
  
  /**
   * Check if orchestrator can resume
   */
  canResume(): boolean;
  
  /**
   * Check if orchestrator can stop
   */
  canStop(): boolean;
  
  // ===========================================================================
  // EVENT REGISTRATION
  // ===========================================================================
  
  /**
   * Register project loaded callback
   */
  onProjectLoaded(callback: ProjectLoadedCallback): void;
  
  /**
   * Register tab opened callback
   */
  onTabOpened(callback: TabOpenedCallback): void;
  
  /**
   * Register row start callback
   */
  onRowStart(callback: RowStartCallback): void;
  
  /**
   * Register row complete callback
   */
  onRowComplete(callback: RowCompleteCallback): void;
  
  /**
   * Register step start callback
   */
  onStepStart(callback: StepStartCallback): void;
  
  /**
   * Register step complete callback
   */
  onStepComplete(callback: StepCompleteCallback): void;
  
  /**
   * Register progress callback
   */
  onProgress(callback: ProgressCallback): void;
  
  /**
   * Register log callback
   */
  onLog(callback: LogCallback): void;
  
  /**
   * Register complete callback
   */
  onComplete(callback: CompleteCallback): void;
  
  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void;
  
  /**
   * Register lifecycle change callback
   */
  onLifecycleChange(callback: LifecycleCallback): void;
  
  // ===========================================================================
  // LOGGING
  // ===========================================================================
  
  /**
   * Add a log entry
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Test run creation data
 */
export interface TestRunCreateData {
  project_id: number;
  status: TestRunStatus;
  start_time: string;
  total_steps: number;
}

/**
 * Test run update data
 */
export interface TestRunUpdateData {
  status?: TestRunStatus;
  end_time?: string;
  passed_steps?: number;
  failed_steps?: number;
  test_results?: StepExecutionResult[];
  logs?: string;
}

// ============================================================================
// FACTORY TYPE
// ============================================================================

/**
 * Factory function type for creating orchestrators
 */
export type OrchestratorFactory = (
  tabManager: ITabManager,
  events?: Partial<OrchestratorEvents>
) => ITestOrchestrator;
