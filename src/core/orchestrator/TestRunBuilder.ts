/**
 * TestRunBuilder - Builds TestRun objects for storage
 * @module core/orchestrator/TestRunBuilder
 * @version 1.0.0
 * 
 * Transforms ExecutionResult into TestRun format for IndexedDB storage.
 * Handles validation, default values, and status mapping.
 * 
 * CRITICAL: TestRun.logs is a STRING type, not string[].
 * 
 * @see storage-layer_breakdown.md for TestRun schema
 * @see ResultAggregator for ExecutionResult source
 */

import type { ExecutionResult, StepResult } from './ResultAggregator';

// ============================================================================
// TYPES
// ============================================================================

/**
 * TestRun status values (matches storage schema)
 */
export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * TestRun interface (matches storage-layer schema)
 */
export interface TestRun {
  /** Auto-increment primary key (omit when creating) */
  id?: number;
  /** Foreign key to Project */
  project_id: number;
  /** Execution status */
  status: TestRunStatus;
  /** Start timestamp (ISO string) */
  start_time: string;
  /** End timestamp (ISO string, optional) */
  end_time?: string;
  /** Total steps executed */
  total_steps: number;
  /** Passed steps count */
  passed_steps: number;
  /** Failed steps count */
  failed_steps: number;
  /** Array of step results */
  test_results: StepResult[];
  /** Execution logs as single string */
  logs: string;
}

/**
 * Input for creating a new TestRun (without id)
 */
export type CreateTestRunInput = Omit<TestRun, 'id'>;

/**
 * Partial TestRun for updates
 */
export type UpdateTestRunInput = Partial<Omit<TestRun, 'id' | 'project_id'>>;

/**
 * Builder configuration
 */
export interface TestRunBuilderConfig {
  /** Default status for new runs. Default: 'pending' */
  defaultStatus: TestRunStatus;
  /** Include empty test_results if none. Default: true */
  includeEmptyResults: boolean;
  /** Validate before build. Default: true */
  validateOnBuild: boolean;
  /** Maximum log length (0 = unlimited). Default: 0 */
  maxLogLength: number;
  /** Truncate logs with suffix. Default: '... [truncated]' */
  truncateSuffix: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_TEST_RUN_BUILDER_CONFIG: TestRunBuilderConfig = {
  defaultStatus: 'pending',
  includeEmptyResults: true,
  validateOnBuild: true,
  maxLogLength: 0,
  truncateSuffix: '... [truncated]',
};

// ============================================================================
// TEST RUN BUILDER CLASS
// ============================================================================

/**
 * TestRunBuilder - Fluent builder for TestRun objects
 * 
 * @example
 * ```typescript
 * // From ExecutionResult
 * const testRun = TestRunBuilder
 *   .fromExecutionResult(result, projectId)
 *   .build();
 * 
 * // Manual building
 * const testRun = new TestRunBuilder()
 *   .setProjectId(123)
 *   .setStatus('completed')
 *   .setStartTime(new Date())
 *   .setEndTime(new Date())
 *   .setStepCounts(10, 8, 2)
 *   .setTestResults(results)
 *   .setLogs('Test logs...')
 *   .build();
 * ```
 */
export class TestRunBuilder {
  private config: TestRunBuilderConfig;
  private data: Partial<TestRun> = {};

  /**
   * Create a new TestRunBuilder
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<TestRunBuilderConfig> = {}) {
    this.config = { ...DEFAULT_TEST_RUN_BUILDER_CONFIG, ...config };
  }

  // ==========================================================================
  // STATIC FACTORY METHODS
  // ==========================================================================

  /**
   * Create builder from ExecutionResult
   * 
   * @param result - Execution result from ResultAggregator
   * @param projectId - Project ID for the test run
   * @returns Configured TestRunBuilder
   */
  public static fromExecutionResult(
    result: ExecutionResult,
    projectId: number
  ): TestRunBuilder {
    const builder = new TestRunBuilder();
    
    return builder
      .setProjectId(projectId)
      .setStatus(mapExecutionStatus(result.status, result.wasStopped))
      .setStartTime(result.startTime)
      .setEndTime(result.endTime)
      .setStepCounts(result.totalSteps, result.passedSteps, result.failedSteps)
      .setTestResults(result.testResults)
      .setLogs(result.logs);
  }

  /**
   * Create a pending test run (before execution)
   * 
   * @param projectId - Project ID
   * @param totalSteps - Expected total steps
   * @returns Configured TestRunBuilder
   */
  public static createPending(
    projectId: number,
    totalSteps: number = 0
  ): TestRunBuilder {
    const builder = new TestRunBuilder();
    
    return builder
      .setProjectId(projectId)
      .setStatus('pending')
      .setStartTime(new Date())
      .setStepCounts(totalSteps, 0, 0)
      .setTestResults([])
      .setLogs('');
  }

  /**
   * Create a running test run (during execution)
   * 
   * @param projectId - Project ID
   * @param startTime - Execution start time
   * @returns Configured TestRunBuilder
   */
  public static createRunning(
    projectId: number,
    startTime: Date | string = new Date()
  ): TestRunBuilder {
    const builder = new TestRunBuilder();
    
    return builder
      .setProjectId(projectId)
      .setStatus('running')
      .setStartTime(startTime)
      .setStepCounts(0, 0, 0)
      .setTestResults([])
      .setLogs('');
  }

  // ==========================================================================
  // FLUENT SETTERS
  // ==========================================================================

  /**
   * Set project ID
   */
  public setProjectId(projectId: number): this {
    this.data.project_id = projectId;
    return this;
  }

  /**
   * Set status
   */
  public setStatus(status: TestRunStatus): this {
    this.data.status = status;
    return this;
  }

  /**
   * Set start time
   */
  public setStartTime(time: Date | string): this {
    this.data.start_time = typeof time === 'string' ? time : time.toISOString();
    return this;
  }

  /**
   * Set end time
   */
  public setEndTime(time: Date | string | undefined): this {
    if (time) {
      this.data.end_time = typeof time === 'string' ? time : time.toISOString();
    }
    return this;
  }

  /**
   * Set total steps
   */
  public setTotalSteps(count: number): this {
    this.data.total_steps = count;
    return this;
  }

  /**
   * Set passed steps
   */
  public setPassedSteps(count: number): this {
    this.data.passed_steps = count;
    return this;
  }

  /**
   * Set failed steps
   */
  public setFailedSteps(count: number): this {
    this.data.failed_steps = count;
    return this;
  }

  /**
   * Set all step counts at once
   */
  public setStepCounts(total: number, passed: number, failed: number): this {
    this.data.total_steps = total;
    this.data.passed_steps = passed;
    this.data.failed_steps = failed;
    return this;
  }

  /**
   * Set test results array
   */
  public setTestResults(results: StepResult[]): this {
    this.data.test_results = results;
    return this;
  }

  /**
   * Add a single test result
   */
  public addTestResult(result: StepResult): this {
    if (!this.data.test_results) {
      this.data.test_results = [];
    }
    this.data.test_results.push(result);
    return this;
  }

  /**
   * Set logs string
   * 
   * CRITICAL: logs must be a string, not array
   */
  public setLogs(logs: string): this {
    if (this.config.maxLogLength > 0 && logs.length > this.config.maxLogLength) {
      this.data.logs = logs.substring(0, this.config.maxLogLength) + this.config.truncateSuffix;
    } else {
      this.data.logs = logs;
    }
    return this;
  }

  /**
   * Append to logs
   */
  public appendLogs(additionalLogs: string): this {
    const currentLogs = this.data.logs || '';
    const newLogs = currentLogs ? `${currentLogs}\n${additionalLogs}` : additionalLogs;
    return this.setLogs(newLogs);
  }

  // ==========================================================================
  // BUILD METHODS
  // ==========================================================================

  /**
   * Build the TestRun object
   * 
   * @throws Error if validation fails and validateOnBuild is true
   * @returns Complete TestRun object (without id)
   */
  public build(): CreateTestRunInput {
    // Apply defaults
    this.applyDefaults();
    
    // Validate if configured
    if (this.config.validateOnBuild) {
      const validation = this.validate();
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`);
        throw new Error(`TestRun validation failed: ${errorMessages.join(', ')}`);
      }
    }

    return {
      project_id: this.data.project_id!,
      status: this.data.status!,
      start_time: this.data.start_time!,
      end_time: this.data.end_time,
      total_steps: this.data.total_steps!,
      passed_steps: this.data.passed_steps!,
      failed_steps: this.data.failed_steps!,
      test_results: this.data.test_results!,
      logs: this.data.logs!,
    };
  }

  /**
   * Build without validation
   */
  public buildUnsafe(): CreateTestRunInput {
    this.applyDefaults();
    
    return {
      project_id: this.data.project_id ?? 0,
      status: this.data.status ?? this.config.defaultStatus,
      start_time: this.data.start_time ?? new Date().toISOString(),
      end_time: this.data.end_time,
      total_steps: this.data.total_steps ?? 0,
      passed_steps: this.data.passed_steps ?? 0,
      failed_steps: this.data.failed_steps ?? 0,
      test_results: this.data.test_results ?? [],
      logs: this.data.logs ?? '',
    };
  }

  /**
   * Build as update payload (partial)
   */
  public buildForUpdate(): UpdateTestRunInput {
    const update: UpdateTestRunInput = {};
    
    if (this.data.status !== undefined) update.status = this.data.status;
    if (this.data.start_time !== undefined) update.start_time = this.data.start_time;
    if (this.data.end_time !== undefined) update.end_time = this.data.end_time;
    if (this.data.total_steps !== undefined) update.total_steps = this.data.total_steps;
    if (this.data.passed_steps !== undefined) update.passed_steps = this.data.passed_steps;
    if (this.data.failed_steps !== undefined) update.failed_steps = this.data.failed_steps;
    if (this.data.test_results !== undefined) update.test_results = this.data.test_results;
    if (this.data.logs !== undefined) update.logs = this.data.logs;
    
    return update;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate the current data
   */
  public validate(): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (this.data.project_id === undefined || this.data.project_id === null) {
      errors.push({ field: 'project_id', message: 'Required field' });
    } else if (typeof this.data.project_id !== 'number' || this.data.project_id < 0) {
      errors.push({ 
        field: 'project_id', 
        message: 'Must be a non-negative number',
        value: this.data.project_id 
      });
    }

    if (!this.data.status) {
      errors.push({ field: 'status', message: 'Required field' });
    } else if (!isValidStatus(this.data.status)) {
      errors.push({ 
        field: 'status', 
        message: 'Must be pending, running, completed, or failed',
        value: this.data.status 
      });
    }

    if (!this.data.start_time) {
      errors.push({ field: 'start_time', message: 'Required field' });
    } else if (!isValidISODate(this.data.start_time)) {
      errors.push({ 
        field: 'start_time', 
        message: 'Must be valid ISO date string',
        value: this.data.start_time 
      });
    }

    // Numeric fields
    if (this.data.total_steps !== undefined && this.data.total_steps < 0) {
      errors.push({ 
        field: 'total_steps', 
        message: 'Must be non-negative',
        value: this.data.total_steps 
      });
    }

    if (this.data.passed_steps !== undefined && this.data.passed_steps < 0) {
      errors.push({ 
        field: 'passed_steps', 
        message: 'Must be non-negative',
        value: this.data.passed_steps 
      });
    }

    if (this.data.failed_steps !== undefined && this.data.failed_steps < 0) {
      errors.push({ 
        field: 'failed_steps', 
        message: 'Must be non-negative',
        value: this.data.failed_steps 
      });
    }

    // Consistency checks
    if (
      this.data.total_steps !== undefined &&
      this.data.passed_steps !== undefined &&
      this.data.failed_steps !== undefined
    ) {
      const sum = this.data.passed_steps + this.data.failed_steps;
      if (sum > this.data.total_steps) {
        errors.push({
          field: 'step_counts',
          message: 'passed_steps + failed_steps cannot exceed total_steps',
          value: { total: this.data.total_steps, passed: this.data.passed_steps, failed: this.data.failed_steps }
        });
      }
    }

    // Type checks
    if (this.data.test_results !== undefined && !Array.isArray(this.data.test_results)) {
      errors.push({ 
        field: 'test_results', 
        message: 'Must be an array',
        value: typeof this.data.test_results 
      });
    }

    if (this.data.logs !== undefined && typeof this.data.logs !== 'string') {
      errors.push({ 
        field: 'logs', 
        message: 'Must be a string (not array)',
        value: typeof this.data.logs 
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if valid without throwing
   */
  public isValid(): boolean {
    return this.validate().valid;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Apply default values for missing fields
   */
  private applyDefaults(): void {
    if (this.data.status === undefined) {
      this.data.status = this.config.defaultStatus;
    }
    
    if (this.data.start_time === undefined) {
      this.data.start_time = new Date().toISOString();
    }
    
    if (this.data.total_steps === undefined) {
      this.data.total_steps = 0;
    }
    
    if (this.data.passed_steps === undefined) {
      this.data.passed_steps = 0;
    }
    
    if (this.data.failed_steps === undefined) {
      this.data.failed_steps = 0;
    }
    
    if (this.data.test_results === undefined && this.config.includeEmptyResults) {
      this.data.test_results = [];
    }
    
    if (this.data.logs === undefined) {
      this.data.logs = '';
    }
  }

  /**
   * Get current data (for inspection)
   */
  public getData(): Partial<TestRun> {
    return { ...this.data };
  }

  /**
   * Get configuration
   */
  public getConfig(): TestRunBuilderConfig {
    return { ...this.config };
  }

  /**
   * Reset builder to initial state
   */
  public reset(): this {
    this.data = {};
    return this;
  }

  /**
   * Clone the builder
   */
  public clone(): TestRunBuilder {
    const cloned = new TestRunBuilder(this.config);
    cloned.data = { ...this.data };
    if (this.data.test_results) {
      cloned.data.test_results = [...this.data.test_results];
    }
    return cloned;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map ExecutionResult status to TestRun status
 */
function mapExecutionStatus(
  status: 'completed' | 'failed' | 'stopped' | 'pending',
  wasStopped: boolean
): TestRunStatus {
  if (wasStopped) {
    return 'failed'; // Treat stopped as failed
  }
  
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'stopped':
      return 'failed';
    case 'pending':
    default:
      return 'pending';
  }
}

/**
 * Check if status is valid
 */
function isValidStatus(status: string): status is TestRunStatus {
  return ['pending', 'running', 'completed', 'failed'].includes(status);
}

/**
 * Check if string is valid ISO date
 */
function isValidISODate(str: string): boolean {
  const date = new Date(str);
  return !isNaN(date.getTime());
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a TestRunBuilder instance
 */
export function createTestRunBuilder(
  config?: Partial<TestRunBuilderConfig>
): TestRunBuilder {
  return new TestRunBuilder(config);
}

/**
 * Build a TestRun directly from ExecutionResult
 * 
 * @param result - Execution result
 * @param projectId - Project ID
 * @returns TestRun ready for storage
 */
export function buildTestRun(
  result: ExecutionResult,
  projectId: number
): CreateTestRunInput {
  return TestRunBuilder.fromExecutionResult(result, projectId).build();
}

/**
 * Build an update payload from partial data
 * 
 * @param updates - Partial TestRun data
 * @returns Update payload
 */
export function buildTestRunUpdate(
  updates: Partial<Omit<TestRun, 'id' | 'project_id'>>
): UpdateTestRunInput {
  return { ...updates };
}

/**
 * Create a completed TestRun
 */
export function createCompletedTestRun(
  projectId: number,
  totalSteps: number,
  passedSteps: number,
  failedSteps: number,
  testResults: StepResult[],
  logs: string,
  startTime: Date | string,
  endTime: Date | string
): CreateTestRunInput {
  return new TestRunBuilder()
    .setProjectId(projectId)
    .setStatus(failedSteps > 0 ? 'failed' : 'completed')
    .setStartTime(startTime)
    .setEndTime(endTime)
    .setStepCounts(totalSteps, passedSteps, failedSteps)
    .setTestResults(testResults)
    .setLogs(logs)
    .build();
}
