/**
 * Tests for TestRunHandlers
 * @module background/handlers/TestRunHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TestRunHandlers,
  createTestRunHandlers,
  TESTRUN_ACTIONS,
  type ITestRunStorage,
  type TestRun,
  type StepResult,
} from './TestRunHandlers';
import type { BackgroundMessage, MessageSender } from '../IBackgroundService';

// ============================================================================
// MOCK FACTORY
// ============================================================================

function createMockStorage(): ITestRunStorage {
  const testRuns = new Map<number, TestRun>();
  let nextId = 1;

  return {
    createTestRun: vi.fn(async (run) => {
      const id = nextId++;
      testRuns.set(id, { ...run, id } as TestRun);
      return id;
    }),
    updateTestRun: vi.fn(async (id, updates) => {
      const existing = testRuns.get(id);
      if (existing) {
        testRuns.set(id, { ...existing, ...updates });
      }
    }),
    getTestRunById: vi.fn(async (id) => {
      return testRuns.get(id);
    }),
    getTestRunsByProject: vi.fn(async (projectId) => {
      return Array.from(testRuns.values()).filter(r => r.project_id === projectId);
    }),
    deleteTestRun: vi.fn(async (id) => {
      testRuns.delete(id);
    }),
    getRecentTestRuns: vi.fn(async (limit) => {
      return Array.from(testRuns.values())
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, limit);
    }),
  };
}

function createMessage(action: string, payload?: unknown): BackgroundMessage {
  return { action, payload };
}

const mockSender: MessageSender = {};

// ============================================================================
// TESTS
// ============================================================================

describe('TestRunHandlers', () => {
  let handlers: TestRunHandlers;
  let mockStorage: ITestRunStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    handlers = new TestRunHandlers(mockStorage);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // CREATE TEST RUN TESTS
  // ==========================================================================

  describe('handleCreateTestRun', () => {
    it('should create a new test run', async () => {
      const message = createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, {
        project_id: 1,
        total_steps: 10,
        total_rows: 5,
      });

      const response = await handlers.handleCreateTestRun(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.id).toBe(1);
      expect(mockStorage.createTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 1,
          total_steps: 10,
          total_rows: 5,
          status: 'pending',
          passed_steps: 0,
          failed_steps: 0,
          skipped_steps: 0,
          test_results: [],
          logs: '',
        })
      );
    });

    it('should set default status to pending', async () => {
      const message = createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, {
        project_id: 1,
      });

      await handlers.handleCreateTestRun(message, mockSender);

      expect(mockStorage.createTestRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('should accept custom status', async () => {
      const message = createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, {
        project_id: 1,
        status: 'running',
      });

      await handlers.handleCreateTestRun(message, mockSender);

      expect(mockStorage.createTestRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' })
      );
    });

    it('should fail without project_id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, {
        total_steps: 10,
      });

      const response = await handlers.handleCreateTestRun(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Project ID');
    });

    it('should handle storage errors', async () => {
      vi.mocked(mockStorage.createTestRun).mockRejectedValue(new Error('DB error'));

      const message = createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, {
        project_id: 1,
      });

      const response = await handlers.handleCreateTestRun(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toBe('DB error');
    });
  });

  // ==========================================================================
  // UPDATE TEST RUN TESTS
  // ==========================================================================

  describe('handleUpdateTestRun', () => {
    beforeEach(async () => {
      // Create a test run first
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
    });

    it('should update test run status', async () => {
      const message = createMessage(TESTRUN_ACTIONS.UPDATE_TEST_RUN, {
        id: 1,
        status: 'running',
      });

      const response = await handlers.handleUpdateTestRun(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateTestRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'running' })
      );
    });

    it('should auto-set end_time when completing', async () => {
      const message = createMessage(TESTRUN_ACTIONS.UPDATE_TEST_RUN, {
        id: 1,
        status: 'completed',
      });

      await handlers.handleUpdateTestRun(message, mockSender);

      expect(mockStorage.updateTestRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'completed',
          end_time: expect.any(String),
        })
      );
    });

    it('should update multiple fields', async () => {
      const message = createMessage(TESTRUN_ACTIONS.UPDATE_TEST_RUN, {
        id: 1,
        status: 'completed',
        passed_steps: 8,
        failed_steps: 2,
        completed_rows: 5,
      });

      await handlers.handleUpdateTestRun(message, mockSender);

      expect(mockStorage.updateTestRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'completed',
          passed_steps: 8,
          failed_steps: 2,
          completed_rows: 5,
        })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.UPDATE_TEST_RUN, {
        status: 'running',
      });

      const response = await handlers.handleUpdateTestRun(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ID');
    });
  });

  // ==========================================================================
  // GET TEST RUNS BY PROJECT TESTS
  // ==========================================================================

  describe('handleGetTestRunsByProject', () => {
    beforeEach(async () => {
      // Create test runs for different projects
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 2 }),
        mockSender
      );
    });

    it('should return test runs for project', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_TEST_RUNS_BY_PROJECT, {
        project_id: 1,
      });

      const response = await handlers.handleGetTestRunsByProject(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.testRuns).toHaveLength(2);
    });

    it('should return empty array for project with no runs', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_TEST_RUNS_BY_PROJECT, {
        project_id: 999,
      });

      const response = await handlers.handleGetTestRunsByProject(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.testRuns).toHaveLength(0);
    });

    it('should fail without project_id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_TEST_RUNS_BY_PROJECT, {});

      const response = await handlers.handleGetTestRunsByProject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Project ID');
    });
  });

  // ==========================================================================
  // GET TEST RUN BY ID TESTS
  // ==========================================================================

  describe('handleGetTestRunById', () => {
    beforeEach(async () => {
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
    });

    it('should return test run by id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_TEST_RUN_BY_ID, { id: 1 });

      const response = await handlers.handleGetTestRunById(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.testRun.project_id).toBe(1);
    });

    it('should fail for non-existent test run', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_TEST_RUN_BY_ID, { id: 999 });

      const response = await handlers.handleGetTestRunById(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should fail without id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_TEST_RUN_BY_ID, {});

      const response = await handlers.handleGetTestRunById(message, mockSender);

      expect(response.success).toBe(false);
    });
  });

  // ==========================================================================
  // DELETE TEST RUN TESTS
  // ==========================================================================

  describe('handleDeleteTestRun', () => {
    it('should delete test run', async () => {
      const message = createMessage(TESTRUN_ACTIONS.DELETE_TEST_RUN, { id: 1 });

      const response = await handlers.handleDeleteTestRun(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.deleteTestRun).toHaveBeenCalledWith(1);
    });

    it('should fail without id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.DELETE_TEST_RUN, {});

      const response = await handlers.handleDeleteTestRun(message, mockSender);

      expect(response.success).toBe(false);
    });
  });

  // ==========================================================================
  // GET RECENT TEST RUNS TESTS
  // ==========================================================================

  describe('handleGetRecentTestRuns', () => {
    it('should return recent test runs', async () => {
      // Create some runs
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 2 }),
        mockSender
      );

      const message = createMessage(TESTRUN_ACTIONS.GET_RECENT_TEST_RUNS, { limit: 5 });

      const response = await handlers.handleGetRecentTestRuns(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.testRuns).toHaveLength(2);
    });

    it('should use default limit', async () => {
      const message = createMessage(TESTRUN_ACTIONS.GET_RECENT_TEST_RUNS, {});

      const response = await handlers.handleGetRecentTestRuns(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.getRecentTestRuns).toHaveBeenCalledWith(10);
    });
  });

  // ==========================================================================
  // ADD STEP RESULT TESTS
  // ==========================================================================

  describe('handleAddStepResult', () => {
    beforeEach(async () => {
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
    });

    it('should add step result', async () => {
      const result: StepResult = {
        stepIndex: 0,
        rowIndex: 0,
        status: 'passed',
        duration: 100,
      };

      const message = createMessage(TESTRUN_ACTIONS.ADD_STEP_RESULT, {
        id: 1,
        result,
      });

      const response = await handlers.handleAddStepResult(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateTestRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          test_results: expect.arrayContaining([result]),
          passed_steps: 1,
        })
      );
    });

    it('should increment failed_steps for failed result', async () => {
      const result: StepResult = {
        stepIndex: 0,
        rowIndex: 0,
        status: 'failed',
        duration: 100,
        error: 'Element not found',
      };

      const message = createMessage(TESTRUN_ACTIONS.ADD_STEP_RESULT, {
        id: 1,
        result,
      });

      await handlers.handleAddStepResult(message, mockSender);

      expect(mockStorage.updateTestRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          failed_steps: 1,
        })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.ADD_STEP_RESULT, {
        result: { stepIndex: 0, rowIndex: 0, status: 'passed', duration: 100 },
      });

      const response = await handlers.handleAddStepResult(message, mockSender);

      expect(response.success).toBe(false);
    });

    it('should fail for non-existent test run', async () => {
      const message = createMessage(TESTRUN_ACTIONS.ADD_STEP_RESULT, {
        id: 999,
        result: { stepIndex: 0, rowIndex: 0, status: 'passed', duration: 100 },
      });

      const response = await handlers.handleAddStepResult(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });

  // ==========================================================================
  // APPEND LOGS TESTS
  // ==========================================================================

  describe('handleAppendLogs', () => {
    beforeEach(async () => {
      await handlers.handleCreateTestRun(
        createMessage(TESTRUN_ACTIONS.CREATE_TEST_RUN, { project_id: 1 }),
        mockSender
      );
    });

    it('should append logs', async () => {
      const message = createMessage(TESTRUN_ACTIONS.APPEND_LOGS, {
        id: 1,
        logs: '[INFO] Step 1 started\n',
      });

      const response = await handlers.handleAppendLogs(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateTestRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          logs: '[INFO] Step 1 started\n',
        })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(TESTRUN_ACTIONS.APPEND_LOGS, {
        logs: 'test',
      });

      const response = await handlers.handleAppendLogs(message, mockSender);

      expect(response.success).toBe(false);
    });

    it('should fail without string logs', async () => {
      const message = createMessage(TESTRUN_ACTIONS.APPEND_LOGS, {
        id: 1,
        logs: 123,
      });

      const response = await handlers.handleAppendLogs(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('string');
    });
  });

  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================

  describe('registration', () => {
    it('should return all handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(8);
      expect(entries.every(e => e.category === 'testrun')).toBe(true);
    });

    it('should have all action names', () => {
      const entries = handlers.getHandlerEntries();
      const actions = entries.map(e => e.action);

      expect(actions).toContain(TESTRUN_ACTIONS.CREATE_TEST_RUN);
      expect(actions).toContain(TESTRUN_ACTIONS.UPDATE_TEST_RUN);
      expect(actions).toContain(TESTRUN_ACTIONS.GET_TEST_RUNS_BY_PROJECT);
      expect(actions).toContain(TESTRUN_ACTIONS.GET_TEST_RUN_BY_ID);
      expect(actions).toContain(TESTRUN_ACTIONS.DELETE_TEST_RUN);
      expect(actions).toContain(TESTRUN_ACTIONS.ADD_STEP_RESULT);
      expect(actions).toContain(TESTRUN_ACTIONS.APPEND_LOGS);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createTestRunHandlers', () => {
  it('should create instance', () => {
    const storage = createMockStorage();
    const handlers = createTestRunHandlers(storage);

    expect(handlers).toBeInstanceOf(TestRunHandlers);
  });
});
