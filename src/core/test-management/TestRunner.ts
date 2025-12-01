/**
 * TestRunner - Executes test cases and collects results
 * @module core/test-management/TestRunner
 * @version 1.0.0
 * 
 * Coordinates test execution using the replay system, manages
 * execution queues, and generates detailed test reports.
 * 
 * Features:
 * - Single and batch test execution
 * - Execution queue with concurrency control
 * - Retry logic for flaky tests
 * - Before/after hooks
 * - Progress tracking and cancellation
 * - Result aggregation and reporting
 * 
 * @see test-orchestrator_breakdown.md for architecture details
 */

import type { TestCase } from './TestCaseManager';
import type { RecordedStep } from '../types/step';
import type { ReplayResult, StepResult, ReplayOptions } from '../types/replay';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default runner options
 */
export const DEFAULT_RUNNER_OPTIONS: RunnerOptions = {
  maxConcurrency: 1,
  retryFailedTests: true,
  maxRetries: 2,
  retryDelay: 1000,
  stopOnFirstFailure: false,
  timeout: 300000, // 5 minutes per test
  captureScreenshots: true,
  screenshotOnFailure: true,
  screenshotOnSuccess: false,
};

/**
 * Run status values
 */
export const RUN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
  ERROR: 'error',
} as const;

/**
 * Run status type
 */
export type RunStatus = typeof RUN_STATUS[keyof typeof RUN_STATUS];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Runner options
 */
export interface RunnerOptions {
  /** Maximum concurrent test executions */
  maxConcurrency: number;
  /** Whether to retry failed tests */
  retryFailedTests: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Delay between retries (ms) */
  retryDelay: number;
  /** Stop execution on first failure */
  stopOnFirstFailure: boolean;
  /** Timeout per test (ms) */
  timeout: number;
  /** Capture screenshots */
  captureScreenshots: boolean;
  /** Screenshot on failure */
  screenshotOnFailure: boolean;
  /** Screenshot on success */
  screenshotOnSuccess: boolean;
}

/**
 * Test run configuration
 */
export interface TestRunConfig {
  /** Run ID */
  runId?: string;
  /** Run name */
  name?: string;
  /** Environment */
  environment?: string;
  /** Base URL override */
  baseUrl?: string;
  /** Replay options override */
  replayOptions?: Partial<ReplayOptions>;
  /** Tags to filter tests */
  tags?: string[];
  /** Custom variables */
  variables?: Record<string, string>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  /** Test case ID */
  testCaseId: string;
  /** Test case name */
  testCaseName: string;
  /** Execution status */
  status: RunStatus;
  /** Replay result */
  replayResult?: ReplayResult;
  /** Error message if failed */
  error?: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration (ms) */
  duration: number;
  /** Retry attempt (0-based) */
  attempt: number;
  /** Screenshots captured */
  screenshots: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test run result
 */
export interface TestRunResult {
  /** Run ID */
  runId: string;
  /** Run name */
  name?: string;
  /** Overall status */
  status: RunStatus;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration (ms) */
  duration: number;
  /** Total tests */
  totalTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Individual test results */
  testResults: TestExecutionResult[];
  /** Environment */
  environment?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Run progress information
 */
export interface RunProgress {
  /** Run ID */
  runId: string;
  /** Current test index (0-based) */
  currentTestIndex: number;
  /** Total tests */
  totalTests: number;
  /** Completed tests */
  completedTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current test being executed */
  currentTest?: TestCase;
  /** Elapsed time (ms) */
  elapsedTime: number;
  /** Estimated remaining time (ms) */
  estimatedRemaining: number;
  /** Status */
  status: RunStatus;
}

/**
 * Queued test item
 */
interface QueuedTest {
  testCase: TestCase;
  priority: number;
  retryCount: number;
}

/**
 * Step executor function (injected dependency)
 */
export type StepExecutorFn = (
  step: RecordedStep,
  context: {
    testCase: TestCase;
    stepIndex: number;
    variables: Record<string, string>;
  }
) => Promise<StepResult>;

/**
 * Hook function types
 */
export type BeforeAllHook = (config: TestRunConfig) => Promise<void> | void;
export type AfterAllHook = (result: TestRunResult) => Promise<void> | void;
export type BeforeEachHook = (testCase: TestCase) => Promise<void> | void;
export type AfterEachHook = (result: TestExecutionResult) => Promise<void> | void;

/**
 * Runner configuration
 */
export interface TestRunnerConfig {
  /** Runner options */
  options?: Partial<RunnerOptions>;
  /** Step executor */
  stepExecutor?: StepExecutorFn;
  /** Before all hook */
  beforeAll?: BeforeAllHook;
  /** After all hook */
  afterAll?: AfterAllHook;
  /** Before each hook */
  beforeEach?: BeforeEachHook;
  /** After each hook */
  afterEach?: AfterEachHook;
  /** Progress callback */
  onProgress?: (progress: RunProgress) => void;
  /** Test complete callback */
  onTestComplete?: (result: TestExecutionResult) => void;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * TestRunner - Executes test cases and collects results
 * 
 * @example
 * ```typescript
 * const runner = new TestRunner({
 *   options: { maxConcurrency: 2 },
 *   onProgress: (p) => console.log(`${p.percentage}%`),
 * });
 * 
 * const result = await runner.runAll(testCases);
 * console.log(`Passed: ${result.passedTests}/${result.totalTests}`);
 * ```
 */
export class TestRunner {
  /**
   * Runner options
   */
  private options: RunnerOptions;
  
  /**
   * Configuration
   */
  private config: TestRunnerConfig;
  
  /**
   * Test queue
   */
  private queue: QueuedTest[] = [];
  
  /**
   * Current run ID
   */
  private currentRunId: string | null = null;
  
  /**
   * Whether running
   */
  private isRunning = false;
  
  /**
   * Abort controller for cancellation
   */
  private abortController: AbortController | null = null;
  
  /**
   * Test results for current run
   */
  private testResults: TestExecutionResult[] = [];
  
  /**
   * Run start time
   */
  private runStartTime = 0;
  
  /**
   * Test timings for estimation
   */
  private testTimings: number[] = [];
  
  /**
   * Current run config
   */
  private currentConfig: TestRunConfig | null = null;
  
  /**
   * Statistics
   */
  private stats = {
    totalRuns: 0,
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalSkipped: 0,
    totalRetries: 0,
  };
  
  /**
   * Creates a new TestRunner
   * 
   * @param config - Runner configuration
   */
  constructor(config: TestRunnerConfig = {}) {
    this.config = config;
    this.options = {
      ...DEFAULT_RUNNER_OPTIONS,
      ...config.options,
    };
  }
  
  // ==========================================================================
  // EXECUTION METHODS
  // ==========================================================================
  
  /**
   * Runs a single test case
   * 
   * @param testCase - Test case to run
   * @param config - Run configuration
   * @returns Test execution result
   */
  async run(
    testCase: TestCase,
    config?: TestRunConfig
  ): Promise<TestExecutionResult> {
    const runResult = await this.runAll([testCase], config);
    return runResult.testResults[0];
  }
  
  /**
   * Runs multiple test cases
   * 
   * @param testCases - Test cases to run
   * @param config - Run configuration
   * @returns Test run result
   */
  async runAll(
    testCases: TestCase[],
    config?: TestRunConfig
  ): Promise<TestRunResult> {
    if (this.isRunning) {
      throw new Error('Runner is already executing tests');
    }
    
    if (testCases.length === 0) {
      return this.createEmptyResult(config);
    }
    
    // Initialize run
    this.isRunning = true;
    this.abortController = new AbortController();
    this.currentRunId = config?.runId ?? this.generateRunId();
    this.currentConfig = config ?? {};
    this.testResults = [];
    this.runStartTime = Date.now();
    this.testTimings = [];
    
    // Filter by tags if specified
    let filteredTests = testCases;
    if (config?.tags && config.tags.length > 0) {
      filteredTests = testCases.filter(tc =>
        config.tags!.some(tag => tc.tags.includes(tag.toLowerCase()))
      );
    }
    
    // Build queue
    this.queue = filteredTests.map((testCase, index) => ({
      testCase,
      priority: index,
      retryCount: 0,
    }));
    
    this.stats.totalRuns++;
    
    try {
      // Before all hook
      if (this.config.beforeAll) {
        await this.config.beforeAll(this.currentConfig);
      }
      
      // Execute tests
      await this.executeQueue();
      
      // Build result
      const result = this.buildRunResult();
      
      // After all hook
      if (this.config.afterAll) {
        await this.config.afterAll(result);
      }
      
      return result;
    } finally {
      this.isRunning = false;
      this.currentRunId = null;
      this.currentConfig = null;
      this.abortController = null;
    }
  }
  
  /**
   * Runs tests by IDs
   * 
   * @param testCases - All available test cases
   * @param ids - IDs to run
   * @param config - Run configuration
   * @returns Test run result
   */
  async runByIds(
    testCases: TestCase[],
    ids: string[],
    config?: TestRunConfig
  ): Promise<TestRunResult> {
    const idSet = new Set(ids);
    const filtered = testCases.filter(tc => idSet.has(tc.id));
    return this.runAll(filtered, config);
  }
  
  /**
   * Cancels the current run
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
  
  /**
   * Checks if runner is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }
  
  // ==========================================================================
  // QUEUE EXECUTION
  // ==========================================================================
  
  /**
   * Executes the test queue
   */
  private async executeQueue(): Promise<void> {
    const { maxConcurrency } = this.options;
    
    if (maxConcurrency === 1) {
      // Sequential execution
      await this.executeSequential();
    } else {
      // Parallel execution
      await this.executeParallel(maxConcurrency);
    }
  }
  
  /**
   * Executes tests sequentially
   */
  private async executeSequential(): Promise<void> {
    while (this.queue.length > 0) {
      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        this.markRemainingAsSkipped();
        break;
      }
      
      const queued = this.queue.shift()!;
      const result = await this.executeTest(queued);
      
      // Handle failure
      if (result.status === RUN_STATUS.FAILED) {
        // Retry if enabled
        if (
          this.options.retryFailedTests &&
          queued.retryCount < this.options.maxRetries
        ) {
          await this.delay(this.options.retryDelay);
          this.queue.unshift({
            ...queued,
            retryCount: queued.retryCount + 1,
          });
          this.stats.totalRetries++;
          continue;
        }
        
        // Record failed result
        this.testResults.push(result);
        this.testTimings.push(result.duration);
        this.updateStats(result);
        
        // Callbacks
        this.config.onTestComplete?.(result);
        this.reportProgress();
        
        // Stop if configured
        if (this.options.stopOnFirstFailure) {
          this.markRemainingAsSkipped();
          break;
        }
        
        continue;
      }
      
      // Record result
      this.testResults.push(result);
      this.testTimings.push(result.duration);
      
      // Update stats
      this.updateStats(result);
      
      // Callbacks
      this.config.onTestComplete?.(result);
      this.reportProgress();
    }
  }
  
  /**
   * Executes tests in parallel
   */
  private async executeParallel(maxConcurrency: number): Promise<void> {
    const executing: Promise<void>[] = [];
    
    while (this.queue.length > 0 || executing.length > 0) {
      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        this.markRemainingAsSkipped();
        break;
      }
      
      // Fill up to max concurrency
      while (executing.length < maxConcurrency && this.queue.length > 0) {
        const queued = this.queue.shift()!;
        
        const promise = this.executeTest(queued).then(async (result) => {
          // Handle retry
          if (
            result.status === RUN_STATUS.FAILED &&
            this.options.retryFailedTests &&
            queued.retryCount < this.options.maxRetries
          ) {
            await this.delay(this.options.retryDelay);
            this.queue.push({
              ...queued,
              retryCount: queued.retryCount + 1,
            });
            this.stats.totalRetries++;
            return;
          }
          
          // Record result
          this.testResults.push(result);
          this.testTimings.push(result.duration);
          
          // Update stats
          this.updateStats(result);
          
          // Callbacks
          this.config.onTestComplete?.(result);
          this.reportProgress();
          
          // Check stop on failure
          if (result.status === RUN_STATUS.FAILED && this.options.stopOnFirstFailure) {
            this.cancel();
          }
        });
        
        executing.push(promise);
      }
      
      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          const isSettled = await Promise.race([
            executing[i].then(() => true),
            Promise.resolve(false),
          ]);
          if (isSettled) {
            executing.splice(i, 1);
          }
        }
      }
    }
    
    // Wait for all remaining
    await Promise.all(executing);
  }
  
  /**
   * Executes a single test
   */
  private async executeTest(queued: QueuedTest): Promise<TestExecutionResult> {
    const { testCase, retryCount } = queued;
    const startTime = Date.now();
    const screenshots: string[] = [];
    
    try {
      // Before each hook
      if (this.config.beforeEach) {
        await this.config.beforeEach(testCase);
      }
      
      // Execute with timeout
      const replayResult = await this.executeWithTimeout(
        () => this.executeTestSteps(testCase, screenshots),
        this.options.timeout
      );
      
      const endTime = Date.now();
      const status = replayResult.success ? RUN_STATUS.PASSED : RUN_STATUS.FAILED;
      
      const result: TestExecutionResult = {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status,
        replayResult,
        error: replayResult.errorMessage,
        startTime,
        endTime,
        duration: endTime - startTime,
        attempt: retryCount,
        screenshots,
        metadata: {
          environment: this.currentConfig?.environment,
          variables: this.currentConfig?.variables,
        },
      };
      
      // After each hook
      if (this.config.afterEach) {
        await this.config.afterEach(result);
      }
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      
      const result: TestExecutionResult = {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: RUN_STATUS.ERROR,
        error: error instanceof Error ? error.message : String(error),
        startTime,
        endTime,
        duration: endTime - startTime,
        attempt: retryCount,
        screenshots,
      };
      
      // After each hook (even on error)
      if (this.config.afterEach) {
        try {
          await this.config.afterEach(result);
        } catch {
          // Ignore hook errors
        }
      }
      
      return result;
    }
  }
  
  /**
   * Executes test steps using the step executor
   */
  private async executeTestSteps(
    testCase: TestCase,
    screenshots: string[]
  ): Promise<ReplayResult> {
    const stepResults: StepResult[] = [];
    const startTime = Date.now();
    let hasFailure = false;
    let errorMessage: string | undefined;
    
    const variables = {
      ...this.currentConfig?.variables,
    };
    
    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i];
      
      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        // Mark remaining as skipped
        for (let j = i; j < testCase.steps.length; j++) {
          stepResults.push({
            stepId: testCase.steps[j].id,
            stepIndex: j,
            status: 'skipped',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            attempts: 0,
          });
        }
        break;
      }
      
      // Execute step
      let stepResult: StepResult;
      
      if (this.config.stepExecutor) {
        stepResult = await this.config.stepExecutor(step, {
          testCase,
          stepIndex: i,
          variables,
        });
      } else {
        // Default step execution (placeholder)
        stepResult = await this.defaultStepExecutor(step, i);
      }
      
      stepResults.push(stepResult);
      
      // Capture screenshot on failure
      if (stepResult.status === 'failed' && stepResult.screenshot) {
        screenshots.push(stepResult.screenshot);
      }
      
      // Track failure
      if (stepResult.status === 'failed') {
        hasFailure = true;
        errorMessage = stepResult.error;
        
        // Continue or stop based on test case config
        if (!testCase.retryConfig) {
          break;
        }
      }
    }
    
    const endTime = Date.now();
    const passedSteps = stepResults.filter(r => r.status === 'passed').length;
    const failedSteps = stepResults.filter(r => r.status === 'failed').length;
    const skippedSteps = stepResults.filter(r => r.status === 'skipped').length;
    
    return {
      sessionId: `session-${Date.now()}`,
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      success: !hasFailure,
      totalSteps: testCase.steps.length,
      passedSteps,
      failedSteps,
      skippedSteps,
      startTime,
      endTime,
      duration: endTime - startTime,
      stepResults,
      errorMessage,
    };
  }
  
  /**
   * Default step executor (placeholder)
   */
  private async defaultStepExecutor(
    step: RecordedStep,
    index: number
  ): Promise<StepResult> {
    // Simulate execution
    await this.delay(50);
    
    return {
      stepId: step.id,
      stepIndex: index,
      status: 'passed',
      startTime: Date.now() - 50,
      endTime: Date.now(),
      duration: 50,
      attempts: 1,
    };
  }
  
  /**
   * Executes with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);
      
      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Marks remaining queue items as skipped
   */
  private markRemainingAsSkipped(): void {
    for (const queued of this.queue) {
      this.testResults.push({
        testCaseId: queued.testCase.id,
        testCaseName: queued.testCase.name,
        status: RUN_STATUS.SKIPPED,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        attempt: 0,
        screenshots: [],
      });
      this.stats.totalSkipped++;
    }
    this.queue = [];
  }
  
  // ==========================================================================
  // RESULT BUILDING
  // ==========================================================================
  
  /**
   * Builds the run result
   */
  private buildRunResult(): TestRunResult {
    const endTime = Date.now();
    const passedTests = this.testResults.filter(r => r.status === RUN_STATUS.PASSED).length;
    const failedTests = this.testResults.filter(
      r => r.status === RUN_STATUS.FAILED || r.status === RUN_STATUS.ERROR
    ).length;
    const skippedTests = this.testResults.filter(r => r.status === RUN_STATUS.SKIPPED).length;
    
    let status: RunStatus;
    if (this.abortController?.signal.aborted) {
      status = RUN_STATUS.CANCELLED;
    } else if (failedTests > 0) {
      status = RUN_STATUS.FAILED;
    } else {
      status = RUN_STATUS.PASSED;
    }
    
    return {
      runId: this.currentRunId!,
      name: this.currentConfig?.name,
      status,
      startTime: this.runStartTime,
      endTime,
      duration: endTime - this.runStartTime,
      totalTests: this.testResults.length,
      passedTests,
      failedTests,
      skippedTests,
      testResults: this.testResults,
      environment: this.currentConfig?.environment,
      metadata: this.currentConfig?.metadata,
    };
  }
  
  /**
   * Creates an empty result
   */
  private createEmptyResult(config?: TestRunConfig): TestRunResult {
    const now = Date.now();
    return {
      runId: config?.runId ?? this.generateRunId(),
      name: config?.name,
      status: RUN_STATUS.PASSED,
      startTime: now,
      endTime: now,
      duration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testResults: [],
      environment: config?.environment,
      metadata: config?.metadata,
    };
  }
  
  // ==========================================================================
  // PROGRESS REPORTING
  // ==========================================================================
  
  /**
   * Reports progress
   */
  private reportProgress(): void {
    if (!this.config.onProgress) return;
    
    const completedTests = this.testResults.length;
    const totalTests = completedTests + this.queue.length;
    const passedTests = this.testResults.filter(r => r.status === RUN_STATUS.PASSED).length;
    const failedTests = this.testResults.filter(
      r => r.status === RUN_STATUS.FAILED || r.status === RUN_STATUS.ERROR
    ).length;
    const skippedTests = this.testResults.filter(r => r.status === RUN_STATUS.SKIPPED).length;
    
    const elapsedTime = Date.now() - this.runStartTime;
    
    // Estimate remaining time
    const avgTestTime = this.testTimings.length > 0
      ? this.testTimings.reduce((a, b) => a + b, 0) / this.testTimings.length
      : 10000;
    const remainingTests = this.queue.length;
    const estimatedRemaining = remainingTests * avgTestTime;
    
    const progress: RunProgress = {
      runId: this.currentRunId!,
      currentTestIndex: completedTests,
      totalTests,
      completedTests,
      passedTests,
      failedTests,
      skippedTests,
      percentage: totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 100,
      currentTest: this.queue[0]?.testCase,
      elapsedTime,
      estimatedRemaining,
      status: this.isRunning ? RUN_STATUS.RUNNING : RUN_STATUS.PENDING,
    };
    
    this.config.onProgress(progress);
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Updates statistics
   */
  private updateStats(result: TestExecutionResult): void {
    this.stats.totalTests++;
    
    switch (result.status) {
      case RUN_STATUS.PASSED:
        this.stats.totalPassed++;
        break;
      case RUN_STATUS.FAILED:
      case RUN_STATUS.ERROR:
        this.stats.totalFailed++;
        break;
      case RUN_STATUS.SKIPPED:
        this.stats.totalSkipped++;
        break;
    }
  }
  
  /**
   * Generates a run ID
   */
  private generateRunId(): string {
    return `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Gets statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = {
      totalRuns: 0,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      totalRetries: 0,
    };
  }
  
  /**
   * Updates options
   */
  updateOptions(options: Partial<RunnerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new TestRunner
 * 
 * @param config - Runner configuration
 * @returns New TestRunner instance
 */
export function createTestRunner(config?: TestRunnerConfig): TestRunner {
  return new TestRunner(config);
}

// ============================================================================
// REPORT GENERATORS
// ============================================================================

/**
 * Generates a summary report from run result
 * 
 * @param result - Test run result
 * @returns Summary report object
 */
export function generateSummaryReport(result: TestRunResult): {
  runId: string;
  name?: string;
  status: RunStatus;
  duration: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  failedTests: Array<{ name: string; error?: string }>;
} {
  const passRate = result.totalTests > 0
    ? Math.round((result.passedTests / result.totalTests) * 100)
    : 100;
  
  const failedTests = result.testResults
    .filter(r => r.status === RUN_STATUS.FAILED || r.status === RUN_STATUS.ERROR)
    .map(r => ({ name: r.testCaseName, error: r.error }));
  
  return {
    runId: result.runId,
    name: result.name,
    status: result.status,
    duration: formatDuration(result.duration),
    totalTests: result.totalTests,
    passed: result.passedTests,
    failed: result.failedTests,
    skipped: result.skippedTests,
    passRate,
    failedTests,
  };
}

/**
 * Formats duration as string
 */
function formatDuration(ms: number): string {
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
 * Generates a detailed report
 * 
 * @param result - Test run result
 * @returns Detailed report object
 */
export function generateDetailedReport(result: TestRunResult): {
  summary: ReturnType<typeof generateSummaryReport>;
  testDetails: Array<{
    name: string;
    status: RunStatus;
    duration: string;
    steps: number;
    passedSteps: number;
    failedSteps: number;
    error?: string;
    attempt: number;
  }>;
  environment?: string;
  startTime: string;
  endTime: string;
} {
  return {
    summary: generateSummaryReport(result),
    testDetails: result.testResults.map(tr => ({
      name: tr.testCaseName,
      status: tr.status,
      duration: formatDuration(tr.duration),
      steps: tr.replayResult?.totalSteps ?? 0,
      passedSteps: tr.replayResult?.passedSteps ?? 0,
      failedSteps: tr.replayResult?.failedSteps ?? 0,
      error: tr.error,
      attempt: tr.attempt,
    })),
    environment: result.environment,
    startTime: new Date(result.startTime).toISOString(),
    endTime: new Date(result.endTime).toISOString(),
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default TestRunner;
