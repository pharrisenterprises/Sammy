/**
 * @fileoverview TestRun repository with business logic for test execution tracking
 * @module core/storage/test-run-repository
 * @version 1.0.0
 * 
 * This module provides a high-level API for TestRun operations,
 * encapsulating database access and business logic for test execution tracking.
 * 
 * CRITICAL: TestRun.logs is type `string` (NOT `string[]`)
 * Logs are concatenated with newlines for efficient storage and display.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 3 for storage specifications
 * @see storage-layer_breakdown.md for architecture details
 */

import { Database, getDatabase } from './db';
import type {
  TestRun,
  TestRunStatus,
  CreateTestRunInput,
  TestRunSummary,
  TestRunProgress,
  TestRunStats,
  StepExecutionResult
} from '../types';
import {
  createTestRun as createTestRunObject,
  toTestRunSummary,
  getTestRunProgress,
  startTestRun as startTestRunTransition,
  passTestRun as passTestRunTransition,
  failTestRun as failTestRunTransition,
  stopTestRun as stopTestRunTransition,
  recordStepResult as recordStepResultTransition,
  appendLog,
  calculateTestRunStats,
  isTerminalStatus,
  isActiveStatus,
  LOG_LEVELS,
  validateTestRun
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for listing test runs
 */
export interface ListTestRunsOptions {
  /** Filter by project ID */
  projectId?: number;
  /** Filter by status */
  status?: TestRunStatus;
  /** Sort field */
  sortBy?: 'started_at' | 'completed_at' | 'status';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of a test run operation
 */
export interface TestRunOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Test run with computed duration
 */
export interface TestRunWithDuration extends TestRun {
  duration_ms: number | null;
}

// ============================================================================
// TESTRUN REPOSITORY CLASS
// ============================================================================

/**
 * Repository for TestRun operations
 * 
 * Provides high-level API with business logic for managing test runs,
 * including status transitions, logging, and step result recording.
 * 
 * @example
 * ```typescript
 * const repo = new TestRunRepository();
 * 
 * // Create and start a test run
 * const result = await repo.create({
 *   project_id: 1,
 *   total_steps: 5
 * });
 * 
 * await repo.start(result.data.id);
 * 
 * // Log progress
 * await repo.log(result.data.id, 'INFO', 'Starting step 1');
 * 
 * // Record step result
 * await repo.recordStep(result.data.id, {
 *   stepId: 'step-1',
 *   success: true,
 *   strategy: 'xpath',
 *   duration: 150
 * });
 * ```
 */
export class TestRunRepository {
  private db: Database | null = null;

  /**
   * Get database instance (lazy initialization)
   */
  private async getDb(): Promise<Database> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new test run
   * 
   * @param input - Test run creation data
   * @returns Operation result with created test run
   */
  async create(input: CreateTestRunInput): Promise<TestRunOperationResult<TestRun>> {
    try {
      const testRun = createTestRunObject(input);
      const errors = validateTestRun(testRun);
      
      if (errors.length > 0) {
        return {
          success: false,
          error: errors.map(e => e.message).join(', ')
        };
      }

      const db = await this.getDb();
      const created = await db.addTestRun(testRun);

      return { success: true, data: created };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test run'
      };
    }
  }

  /**
   * Get a test run by ID
   * 
   * @param id - Test run ID
   * @returns Operation result with test run or null
   */
  async getById(id: string): Promise<TestRunOperationResult<TestRun | null>> {
    try {
      const db = await this.getDb();
      const testRun = await db.getTestRun(id);

      return { success: true, data: testRun };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get test run'
      };
    }
  }

  /**
   * Get all test runs
   * 
   * @param options - List options (filtering, sorting, pagination)
   * @returns Operation result with test runs array
   */
  async getAll(options: ListTestRunsOptions = {}): Promise<TestRunOperationResult<TestRun[]>> {
    try {
      const db = await this.getDb();
      let testRuns: TestRun[];

      // Get test runs with optional filtering
      if (options.projectId !== undefined) {
        testRuns = await db.getTestRunsByProject(options.projectId);
      } else if (options.status) {
        testRuns = await db.getTestRunsByStatus(options.status);
      } else {
        testRuns = await db.getAllTestRuns();
      }

      // Additional status filter if projectId was used
      if (options.projectId !== undefined && options.status) {
        testRuns = testRuns.filter(tr => tr.status === options.status);
      }

      // Sort
      if (options.sortBy) {
        const sortField = options.sortBy;
        const sortMultiplier = options.sortOrder === 'asc' ? 1 : -1;

        testRuns.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];

          if (aVal === null && bVal === null) return 0;
          if (aVal === null) return 1;
          if (bVal === null) return -1;

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * sortMultiplier;
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return (aVal - bVal) * sortMultiplier;
          }
          return 0;
        });
      }

      // Pagination
      if (options.offset !== undefined || options.limit !== undefined) {
        const start = options.offset ?? 0;
        const end = options.limit ? start + options.limit : undefined;
        testRuns = testRuns.slice(start, end);
      }

      return { success: true, data: testRuns };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get test runs'
      };
    }
  }

  /**
   * Get test runs for a specific project
   * 
   * @param projectId - Project ID
   * @param options - Additional list options
   * @returns Operation result with test runs array
   */
  async getByProject(
    projectId: number,
    options: Omit<ListTestRunsOptions, 'projectId'> = {}
  ): Promise<TestRunOperationResult<TestRun[]>> {
    return this.getAll({ ...options, projectId });
  }

  /**
   * Get test run summaries for list display
   * 
   * @param options - List options
   * @returns Operation result with test run summaries
   */
  async getSummaries(options: ListTestRunsOptions = {}): Promise<TestRunOperationResult<TestRunSummary[]>> {
    const result = await this.getAll(options);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const summaries = result.data.map(tr => toTestRunSummary(tr));
    return { success: true, data: summaries };
  }

  /**
   * Update a test run
   * 
   * @param id - Test run ID
   * @param updates - Fields to update
   * @returns Operation result with updated test run
   */
  async update(
    id: string,
    updates: Partial<Omit<TestRun, 'id' | 'project_id'>>
  ): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      
      // Check if test run exists
      const existing = await db.getTestRun(id);
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      const updated = await db.updateTestRun(id, updates);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update test run'
      };
    }
  }

  /**
   * Delete a test run
   * 
   * @param id - Test run ID
   * @returns Operation result
   */
  async delete(id: string): Promise<TestRunOperationResult<boolean>> {
    try {
      const db = await this.getDb();

      // Check if test run exists
      const existing = await db.getTestRun(id);
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      await db.deleteTestRun(id);
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete test run'
      };
    }
  }

  /**
   * Delete all test runs for a project
   * 
   * @param projectId - Project ID
   * @returns Operation result with count of deleted runs
   */
  async deleteByProject(projectId: number): Promise<TestRunOperationResult<number>> {
    try {
      const db = await this.getDb();
      const count = await db.deleteTestRunsByProject(projectId);
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete test runs'
      };
    }
  }

  // ==========================================================================
  // STATUS TRANSITIONS
  // ==========================================================================

  /**
   * Start a test run (pending -> running)
   * 
   * @param id - Test run ID
   * @returns Operation result with updated test run
   */
  async start(id: string): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      const existing = await db.getTestRun(id);
      
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      if (existing.status !== 'pending') {
        return { success: false, error: `Cannot start test run with status: ${existing.status}` };
      }

      const started = startTestRunTransition(existing);
      const updated = await db.updateTestRun(id, started);
      
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start test run'
      };
    }
  }

  /**
   * Mark test run as passed (running -> passed)
   * 
   * @param id - Test run ID
   * @returns Operation result with updated test run
   */
  async pass(id: string): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      const existing = await db.getTestRun(id);
      
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      if (existing.status !== 'running') {
        return { success: false, error: `Cannot pass test run with status: ${existing.status}` };
      }

      const passed = passTestRunTransition(existing);
      const updated = await db.updateTestRun(id, passed);
      
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pass test run'
      };
    }
  }

  /**
   * Mark test run as failed (running -> failed)
   * 
   * @param id - Test run ID
   * @param errorMessage - Error message describing the failure
   * @returns Operation result with updated test run
   */
  async fail(id: string, errorMessage: string): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      const existing = await db.getTestRun(id);
      
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      if (existing.status !== 'running') {
        return { success: false, error: `Cannot fail test run with status: ${existing.status}` };
      }

      const failed = failTestRunTransition(existing, errorMessage);
      const updated = await db.updateTestRun(id, failed);
      
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fail test run'
      };
    }
  }

  /**
   * Stop a test run (running -> stopped)
   * 
   * @param id - Test run ID
   * @returns Operation result with updated test run
   */
  async stop(id: string): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      const existing = await db.getTestRun(id);
      
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      if (existing.status !== 'running') {
        return { success: false, error: `Cannot stop test run with status: ${existing.status}` };
      }

      const stopped = stopTestRunTransition(existing);
      const updated = await db.updateTestRun(id, stopped);
      
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop test run'
      };
    }
  }

  // ==========================================================================
  // LOGGING OPERATIONS
  // ==========================================================================

  /**
   * Append a log entry to test run
   * 
   * CRITICAL: Logs are stored as a single string with newline separators
   * 
   * @param id - Test run ID
   * @param level - Log level (INFO, WARN, ERROR, DEBUG, STEP)
   * @param message - Log message
   * @returns Operation result with updated test run
   */
  async log(
    id: string,
    level: keyof typeof LOG_LEVELS,
    message: string
  ): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      const existing = await db.getTestRun(id);
      
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      const newLogs = appendLog(existing.logs, level, message);
      const updated = await db.updateTestRun(id, { logs: newLogs });
      
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log to test run'
      };
    }
  }

  /**
   * Log info message
   */
  async logInfo(id: string, message: string): Promise<TestRunOperationResult<TestRun>> {
    return this.log(id, 'INFO', message);
  }

  /**
   * Log warning message
   */
  async logWarn(id: string, message: string): Promise<TestRunOperationResult<TestRun>> {
    return this.log(id, 'WARN', message);
  }

  /**
   * Log error message
   */
  async logError(id: string, message: string): Promise<TestRunOperationResult<TestRun>> {
    return this.log(id, 'ERROR', message);
  }

  /**
   * Log debug message
   */
  async logDebug(id: string, message: string): Promise<TestRunOperationResult<TestRun>> {
    return this.log(id, 'DEBUG', message);
  }

  /**
   * Log step execution
   */
  async logStep(id: string, message: string): Promise<TestRunOperationResult<TestRun>> {
    return this.log(id, 'STEP', message);
  }

  /**
   * Get logs for a test run
   * 
   * @param id - Test run ID
   * @returns Operation result with logs string
   */
  async getLogs(id: string): Promise<TestRunOperationResult<string>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Test run not found' };
    }

    return { success: true, data: result.data.logs };
  }

  // ==========================================================================
  // STEP RECORDING
  // ==========================================================================

  /**
   * Record a step execution result
   * 
   * @param id - Test run ID
   * @param result - Step execution result
   * @returns Operation result with updated test run
   */
  async recordStep(
    id: string,
    stepResult: StepExecutionResult
  ): Promise<TestRunOperationResult<TestRun>> {
    try {
      const db = await this.getDb();
      const existing = await db.getTestRun(id);
      
      if (!existing) {
        return { success: false, error: `Test run not found: ${id}` };
      }

      if (existing.status !== 'running') {
        return { success: false, error: `Cannot record step for test run with status: ${existing.status}` };
      }

      const withStep = recordStepResultTransition(existing, stepResult);
      const updated = await db.updateTestRun(id, withStep);
      
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record step'
      };
    }
  }

  /**
   * Get step results for a test run
   * 
   * @param id - Test run ID
   * @returns Operation result with step results array
   */
  async getStepResults(id: string): Promise<TestRunOperationResult<StepExecutionResult[]>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Test run not found' };
    }

    return { success: true, data: result.data.results ?? [] };
  }

  // ==========================================================================
  // PROGRESS AND STATISTICS
  // ==========================================================================

  /**
   * Get test run progress
   * 
   * @param id - Test run ID
   * @param currentStepName - Optional name of current step
   * @returns Operation result with progress info
   */
  async getProgress(
    id: string,
    currentStepName?: string
  ): Promise<TestRunOperationResult<TestRunProgress>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Test run not found' };
    }

    const progress = getTestRunProgress(result.data, currentStepName);
    return { success: true, data: progress };
  }

  /**
   * Get statistics for test runs
   * 
   * @param options - Filter options (projectId, status)
   * @returns Operation result with statistics
   */
  async getStats(options: ListTestRunsOptions = {}): Promise<TestRunOperationResult<TestRunStats>> {
    const result = await this.getAll(options);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const stats = calculateTestRunStats(result.data);
    return { success: true, data: stats };
  }

  /**
   * Get statistics for a specific project
   * 
   * @param projectId - Project ID
   * @returns Operation result with statistics
   */
  async getProjectStats(projectId: number): Promise<TestRunOperationResult<TestRunStats>> {
    return this.getStats({ projectId });
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  /**
   * Check if test run exists
   * 
   * @param id - Test run ID
   * @returns True if test run exists
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.getById(id);
    return result.success && result.data !== null;
  }

  /**
   * Get count of test runs
   * 
   * @param options - Filter options
   * @returns Operation result with count
   */
  async count(options: ListTestRunsOptions = {}): Promise<TestRunOperationResult<number>> {
    try {
      const result = await this.getAll(options);
      
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data.length };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count test runs'
      };
    }
  }

  /**
   * Get active (pending or running) test runs
   * 
   * @param projectId - Optional project ID filter
   * @returns Operation result with active test runs
   */
  async getActive(projectId?: number): Promise<TestRunOperationResult<TestRun[]>> {
    const result = await this.getAll({ projectId });
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const active = result.data.filter(tr => isActiveStatus(tr.status));
    return { success: true, data: active };
  }

  /**
   * Get completed (terminal status) test runs
   * 
   * @param projectId - Optional project ID filter
   * @returns Operation result with completed test runs
   */
  async getCompleted(projectId?: number): Promise<TestRunOperationResult<TestRun[]>> {
    const result = await this.getAll({ projectId });
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const completed = result.data.filter(tr => isTerminalStatus(tr.status));
    return { success: true, data: completed };
  }

  /**
   * Get the most recent test run for a project
   * 
   * @param projectId - Project ID
   * @returns Operation result with most recent test run or null
   */
  async getMostRecent(projectId: number): Promise<TestRunOperationResult<TestRun | null>> {
    const result = await this.getAll({
      projectId,
      sortBy: 'started_at',
      sortOrder: 'desc',
      limit: 1
    });
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data[0] || null };
  }

  /**
   * Get test runs with duration calculated
   * 
   * @param options - Filter options
   * @returns Operation result with test runs including duration
   */
  async getAllWithDuration(options: ListTestRunsOptions = {}): Promise<TestRunOperationResult<TestRunWithDuration[]>> {
    const result = await this.getAll(options);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const withDuration: TestRunWithDuration[] = result.data.map(tr => {
      let duration_ms: number | null = null;
      
      if (tr.started_at && tr.completed_at) {
        duration_ms = tr.completed_at - tr.started_at;
      }
      
      return { ...tr, duration_ms };
    });

    return { success: true, data: withDuration };
  }

  // ==========================================================================
  // CLEANUP OPERATIONS
  // ==========================================================================

  /**
   * Delete old test runs (older than specified days)
   * 
   * @param daysOld - Number of days
   * @param projectId - Optional project ID filter
   * @returns Operation result with count of deleted runs
   */
  async deleteOlderThan(
    daysOld: number,
    projectId?: number
  ): Promise<TestRunOperationResult<number>> {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const result = await this.getAll({ projectId });
      
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const toDelete = result.data.filter(tr => 
        tr.started_at && tr.started_at < cutoffTime
      );

      const db = await this.getDb();
      for (const tr of toDelete) {
        await db.deleteTestRun(tr.id);
      }

      return { success: true, data: toDelete.length };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete old test runs'
      };
    }
  }

  /**
   * Delete all failed test runs for a project
   * 
   * @param projectId - Project ID
   * @returns Operation result with count of deleted runs
   */
  async deleteFailedByProject(projectId: number): Promise<TestRunOperationResult<number>> {
    try {
      const result = await this.getAll({ projectId, status: 'failed' });
      
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const db = await this.getDb();
      for (const tr of result.data) {
        await db.deleteTestRun(tr.id);
      }

      return { success: true, data: result.data.length };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete failed test runs'
      };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global test run repository instance
 */
export const testRunRepository = new TestRunRepository();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the test run repository instance
 */
export function getTestRunRepository(): TestRunRepository {
  return testRunRepository;
}
