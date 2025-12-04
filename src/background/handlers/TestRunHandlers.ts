/**
 * TestRunHandlers - Message handlers for TestRun CRUD operations
 * @module background/handlers/TestRunHandlers
 * @version 1.0.0
 * 
 * Handles test run-related messages from extension pages:
 * - createTestRun: Create new test run record
 * - updateTestRun: Update test run status/results
 * - getTestRunsByProject: Get all runs for a project
 * - getTestRunById: Get single test run
 * - deleteTestRun: Delete test run
 * - getRecentTestRuns: Get recent runs across all projects
 * 
 * @see storage-layer_breakdown.md for DB operations
 */

import type {
  BackgroundMessage,
  BackgroundResponse,
  MessageSender,
  MessageHandler,
  ActionCategory,
} from '../IBackgroundService';
import type { MessageReceiver } from '../MessageReceiver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Test run status values
 */
export type TestRunStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'stopped';

/**
 * Step result within a test run
 */
export interface StepResult {
  stepIndex: number;
  rowIndex: number;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

/**
 * Test run record
 */
export interface TestRun {
  id?: number;
  project_id: number;
  status: TestRunStatus;
  start_time: string;
  end_time?: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  total_rows: number;
  completed_rows: number;
  test_results: StepResult[];
  logs: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Test run storage operations interface
 */
export interface ITestRunStorage {
  /** Create a new test run */
  createTestRun(run: Omit<TestRun, 'id'>): Promise<number>;
  
  /** Update an existing test run */
  updateTestRun(id: number, updates: Partial<TestRun>): Promise<void>;
  
  /** Get test run by ID */
  getTestRunById(id: number): Promise<TestRun | undefined>;
  
  /** Get all test runs for a project */
  getTestRunsByProject(projectId: number): Promise<TestRun[]>;
  
  /** Delete a test run */
  deleteTestRun(id: number): Promise<void>;
  
  /** Get recent test runs (across all projects) */
  getRecentTestRuns(limit: number): Promise<TestRun[]>;
}

/**
 * Create test run payload
 */
export interface CreateTestRunPayload {
  project_id: number;
  total_steps?: number;
  total_rows?: number;
  status?: TestRunStatus;
}

/**
 * Update test run payload
 */
export interface UpdateTestRunPayload {
  id: number;
  status?: TestRunStatus;
  end_time?: string;
  passed_steps?: number;
  failed_steps?: number;
  skipped_steps?: number;
  completed_rows?: number;
  test_results?: StepResult[];
  logs?: string;
  error_message?: string;
}

/**
 * Add step result payload
 */
export interface AddStepResultPayload {
  id: number;
  result: StepResult;
}

/**
 * Test run action names
 */
export const TESTRUN_ACTIONS = {
  CREATE_TEST_RUN: 'createTestRun',
  UPDATE_TEST_RUN: 'updateTestRun',
  GET_TEST_RUNS_BY_PROJECT: 'getTestRunsByProject',
  GET_TEST_RUN_BY_ID: 'getTestRunById',
  DELETE_TEST_RUN: 'deleteTestRun',
  GET_RECENT_TEST_RUNS: 'getRecentTestRuns',
  ADD_STEP_RESULT: 'addStepResult',
  APPEND_LOGS: 'appendLogs',
} as const;

// ============================================================================
// TEST RUN HANDLERS CLASS
// ============================================================================

/**
 * TestRunHandlers - Handles test run-related messages
 * 
 * @example
 * ```typescript
 * const handlers = new TestRunHandlers(storage);
 * 
 * // Register with message receiver
 * handlers.registerAll(receiver);
 * 
 * // Or use individual handlers
 * const response = await handlers.handleCreateTestRun(message, sender);
 * ```
 */
export class TestRunHandlers {
  private storage: ITestRunStorage;

  /**
   * Create TestRunHandlers
   * @param storage - Test run storage implementation
   */
  constructor(storage: ITestRunStorage) {
    this.storage = storage;
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all test run handlers with a MessageReceiver
   */
  public registerAll(receiver: MessageReceiver): void {
    receiver.register(
      TESTRUN_ACTIONS.CREATE_TEST_RUN,
      this.handleCreateTestRun.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.UPDATE_TEST_RUN,
      this.handleUpdateTestRun.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.GET_TEST_RUNS_BY_PROJECT,
      this.handleGetTestRunsByProject.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.GET_TEST_RUN_BY_ID,
      this.handleGetTestRunById.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.DELETE_TEST_RUN,
      this.handleDeleteTestRun.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.GET_RECENT_TEST_RUNS,
      this.handleGetRecentTestRuns.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.ADD_STEP_RESULT,
      this.handleAddStepResult.bind(this),
      'testrun'
    );
    
    receiver.register(
      TESTRUN_ACTIONS.APPEND_LOGS,
      this.handleAppendLogs.bind(this),
      'testrun'
    );
  }

  /**
   * Get all handler entries for manual registration
   */
  public getHandlerEntries(): Array<{
    action: string;
    handler: MessageHandler;
    category: ActionCategory;
  }> {
    return [
      {
        action: TESTRUN_ACTIONS.CREATE_TEST_RUN,
        handler: this.handleCreateTestRun.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.UPDATE_TEST_RUN,
        handler: this.handleUpdateTestRun.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.GET_TEST_RUNS_BY_PROJECT,
        handler: this.handleGetTestRunsByProject.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.GET_TEST_RUN_BY_ID,
        handler: this.handleGetTestRunById.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.DELETE_TEST_RUN,
        handler: this.handleDeleteTestRun.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.GET_RECENT_TEST_RUNS,
        handler: this.handleGetRecentTestRuns.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.ADD_STEP_RESULT,
        handler: this.handleAddStepResult.bind(this),
        category: 'testrun',
      },
      {
        action: TESTRUN_ACTIONS.APPEND_LOGS,
        handler: this.handleAppendLogs.bind(this),
        category: 'testrun',
      },
    ];
  }

  // ==========================================================================
  // HANDLER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Handle createTestRun action
   * Creates a new test run with default values
   */
  public async handleCreateTestRun(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as CreateTestRunPayload;

      // Validate required fields
      if (!payload?.project_id) {
        return { success: false, error: 'Project ID is required' };
      }

      // Create test run with defaults
      const now = new Date().toISOString();
      const newTestRun: Omit<TestRun, 'id'> = {
        project_id: payload.project_id,
        status: payload.status ?? 'pending',
        start_time: now,
        total_steps: payload.total_steps ?? 0,
        passed_steps: 0,
        failed_steps: 0,
        skipped_steps: 0,
        total_rows: payload.total_rows ?? 1,
        completed_rows: 0,
        test_results: [],
        logs: '',
        created_at: now,
        updated_at: now,
      };

      const id = await this.storage.createTestRun(newTestRun);

      return { success: true, id };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test run',
      };
    }
  }

  /**
   * Handle updateTestRun action
   * Updates test run status and results
   */
  public async handleUpdateTestRun(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as UpdateTestRunPayload;

      // Validate ID
      if (!payload?.id) {
        return { success: false, error: 'Test run ID is required' };
      }

      // Build updates object
      const updates: Partial<TestRun> = {
        updated_at: new Date().toISOString(),
      };

      if (payload.status !== undefined) {
        updates.status = payload.status;
        
        // Auto-set end_time when completing
        if (['completed', 'failed', 'stopped'].includes(payload.status) && !payload.end_time) {
          updates.end_time = new Date().toISOString();
        }
      }
      
      if (payload.end_time !== undefined) {
        updates.end_time = payload.end_time;
      }
      if (payload.passed_steps !== undefined) {
        updates.passed_steps = payload.passed_steps;
      }
      if (payload.failed_steps !== undefined) {
        updates.failed_steps = payload.failed_steps;
      }
      if (payload.skipped_steps !== undefined) {
        updates.skipped_steps = payload.skipped_steps;
      }
      if (payload.completed_rows !== undefined) {
        updates.completed_rows = payload.completed_rows;
      }
      if (payload.test_results !== undefined) {
        updates.test_results = payload.test_results;
      }
      if (payload.logs !== undefined) {
        updates.logs = payload.logs;
      }
      if (payload.error_message !== undefined) {
        updates.error_message = payload.error_message;
      }

      await this.storage.updateTestRun(payload.id, updates);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update test run',
      };
    }
  }

  /**
   * Handle getTestRunsByProject action
   * Returns all test runs for a project
   */
  public async handleGetTestRunsByProject(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { project_id: number };

      // Validate
      if (!payload?.project_id) {
        return { success: false, error: 'Project ID is required' };
      }

      const testRuns = await this.storage.getTestRunsByProject(payload.project_id);

      // Sort by start_time descending (most recent first)
      testRuns.sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      return { success: true, data: { testRuns } };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get test runs',
      };
    }
  }

  /**
   * Handle getTestRunById action
   * Returns a single test run or error if not found
   */
  public async handleGetTestRunById(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { id: number };

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Test run ID is required' };
      }

      const testRun = await this.storage.getTestRunById(payload.id);

      if (!testRun) {
        return { success: false, error: `Test run not found: ${payload.id}` };
      }

      return { success: true, data: { testRun } };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get test run',
      };
    }
  }

  /**
   * Handle deleteTestRun action
   * Deletes a test run by ID
   */
  public async handleDeleteTestRun(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { id: number };

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Test run ID is required' };
      }

      await this.storage.deleteTestRun(payload.id);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete test run',
      };
    }
  }

  /**
   * Handle getRecentTestRuns action
   * Returns recent test runs across all projects
   */
  public async handleGetRecentTestRuns(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { limit?: number } | undefined;
      const limit = payload?.limit ?? 10;

      const testRuns = await this.storage.getRecentTestRuns(limit);

      return { success: true, data: { testRuns } };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent test runs',
      };
    }
  }

  /**
   * Handle addStepResult action
   * Adds a step result to an existing test run
   */
  public async handleAddStepResult(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as AddStepResultPayload;

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Test run ID is required' };
      }
      if (!payload?.result) {
        return { success: false, error: 'Step result is required' };
      }

      // Get existing test run
      const testRun = await this.storage.getTestRunById(payload.id);
      if (!testRun) {
        return { success: false, error: `Test run not found: ${payload.id}` };
      }

      // Add result and update counts
      const updatedResults = [...testRun.test_results, payload.result];
      const updates: Partial<TestRun> = {
        test_results: updatedResults,
        updated_at: new Date().toISOString(),
      };

      // Update step counts based on result status
      if (payload.result.status === 'passed') {
        updates.passed_steps = (testRun.passed_steps || 0) + 1;
      } else if (payload.result.status === 'failed') {
        updates.failed_steps = (testRun.failed_steps || 0) + 1;
      } else if (payload.result.status === 'skipped') {
        updates.skipped_steps = (testRun.skipped_steps || 0) + 1;
      }

      await this.storage.updateTestRun(payload.id, updates);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add step result',
      };
    }
  }

  /**
   * Handle appendLogs action
   * Appends log text to an existing test run
   */
  public async handleAppendLogs(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { id: number; logs: string };

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Test run ID is required' };
      }
      if (typeof payload?.logs !== 'string') {
        return { success: false, error: 'Logs must be a string' };
      }

      // Get existing test run
      const testRun = await this.storage.getTestRunById(payload.id);
      if (!testRun) {
        return { success: false, error: `Test run not found: ${payload.id}` };
      }

      // Append logs
      const updatedLogs = testRun.logs + payload.logs;
      await this.storage.updateTestRun(payload.id, {
        logs: updatedLogs,
        updated_at: new Date().toISOString(),
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to append logs',
      };
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create TestRunHandlers instance
 */
export function createTestRunHandlers(storage: ITestRunStorage): TestRunHandlers {
  return new TestRunHandlers(storage);
}

/**
 * Create and register all test run handlers with a MessageReceiver
 */
export function registerTestRunHandlers(
  receiver: MessageReceiver,
  storage: ITestRunStorage
): TestRunHandlers {
  const handlers = new TestRunHandlers(storage);
  handlers.registerAll(receiver);
  return handlers;
}
