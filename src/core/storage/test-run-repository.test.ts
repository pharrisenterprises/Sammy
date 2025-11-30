/**
 * @fileoverview Tests for TestRun repository
 * @module core/storage/test-run-repository.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  TestRunRepository,
  testRunRepository,
  getTestRunRepository
} from './test-run-repository';
import { Database, deleteDatabase } from './db';
import type { StepExecutionResult } from '../types';

describe('TestRunRepository', () => {
  let repo: TestRunRepository;

  beforeEach(async () => {
    Database.resetInstance();
    await deleteDatabase();
    repo = new TestRunRepository();
  });

  afterEach(async () => {
    Database.resetInstance();
  });

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create a test run', async () => {
        const result = await repo.create({
          project_id: 1,
          total_steps: 5
        });

        expect(result.success).toBe(true);
        expect(result.data?.id).toBeDefined();
        expect(result.data?.project_id).toBe(1);
        expect(result.data?.total_steps).toBe(5);
        expect(result.data?.status).toBe('pending');
        expect(result.data?.logs).toBe(''); // CRITICAL: logs is string, not array
      });

      it('should create with csv_row_index', async () => {
        const result = await repo.create({
          project_id: 1,
          total_steps: 5,
          csv_row_index: 2
        });

        expect(result.success).toBe(true);
        expect(result.data?.csv_row_index).toBe(2);
      });
    });

    describe('getById', () => {
      it('should return test run by id', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.getById(created.data!.id);

        expect(result.success).toBe(true);
        expect(result.data?.project_id).toBe(1);
      });

      it('should return null for non-existent id', async () => {
        const result = await repo.getById('non-existent');

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });
    });

    describe('getAll', () => {
      it('should return empty array when no test runs', async () => {
        const result = await repo.getAll();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should return all test runs', async () => {
        await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 1, total_steps: 3 });
        await repo.create({ project_id: 2, total_steps: 7 });

        const result = await repo.getAll();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
      });

      it('should filter by projectId', async () => {
        await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 1, total_steps: 3 });
        await repo.create({ project_id: 2, total_steps: 7 });

        const result = await repo.getAll({ projectId: 1 });

        expect(result.data).toHaveLength(2);
      });

      it('should filter by status', async () => {
        const tr1 = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 1, total_steps: 3 });
        await repo.start(tr1.data!.id);

        const result = await repo.getAll({ status: 'running' });

        expect(result.data).toHaveLength(1);
      });

      it('should apply pagination', async () => {
        await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 1, total_steps: 3 });
        await repo.create({ project_id: 1, total_steps: 7 });
        await repo.create({ project_id: 1, total_steps: 2 });

        const result = await repo.getAll({ offset: 1, limit: 2 });

        expect(result.data).toHaveLength(2);
      });
    });

    describe('getByProject', () => {
      it('should return test runs for project', async () => {
        await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 2, total_steps: 3 });

        const result = await repo.getByProject(1);

        expect(result.data).toHaveLength(1);
        expect(result.data![0].project_id).toBe(1);
      });
    });

    describe('update', () => {
      it('should update test run fields', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.update(created.data!.id, {
          current_step: 2,
          logs: 'Updated logs'
        });

        expect(result.success).toBe(true);
        expect(result.data?.current_step).toBe(2);
        expect(result.data?.logs).toBe('Updated logs');
      });

      it('should return error for non-existent test run', async () => {
        const result = await repo.update('non-existent', { current_step: 1 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('delete', () => {
      it('should delete test run', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.delete(created.data!.id);

        expect(result.success).toBe(true);
        
        const check = await repo.getById(created.data!.id);
        expect(check.data).toBeNull();
      });
    });

    describe('deleteByProject', () => {
      it('should delete all test runs for project', async () => {
        await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 1, total_steps: 3 });
        await repo.create({ project_id: 2, total_steps: 7 });

        const result = await repo.deleteByProject(1);

        expect(result.success).toBe(true);
        expect(result.data).toBe(2);
        
        const remaining = await repo.getAll();
        expect(remaining.data).toHaveLength(1);
      });
    });
  });

  // ==========================================================================
  // STATUS TRANSITIONS
  // ==========================================================================

  describe('Status Transitions', () => {
    describe('start', () => {
      it('should transition pending -> running', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.start(created.data!.id);

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('running');
        expect(result.data?.started_at).toBeDefined();
      });

      it('should fail for non-pending status', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);

        const result = await repo.start(created.data!.id);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot start');
      });
    });

    describe('pass', () => {
      it('should transition running -> passed', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);

        const result = await repo.pass(created.data!.id);

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('passed');
        expect(result.data?.completed_at).toBeDefined();
      });

      it('should fail for non-running status', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.pass(created.data!.id);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot pass');
      });
    });

    describe('fail', () => {
      it('should transition running -> failed', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);

        const result = await repo.fail(created.data!.id, 'Element not found');

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('failed');
        expect(result.data?.error).toBe('Element not found');
        expect(result.data?.completed_at).toBeDefined();
      });
    });

    describe('stop', () => {
      it('should transition running -> stopped', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);

        const result = await repo.stop(created.data!.id);

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('stopped');
        expect(result.data?.completed_at).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // LOGGING OPERATIONS
  // ==========================================================================

  describe('Logging Operations', () => {
    describe('log', () => {
      it('should append log entry (logs is STRING, not array)', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.log(created.data!.id, 'INFO', 'Test message');

        expect(result.success).toBe(true);
        expect(typeof result.data?.logs).toBe('string'); // CRITICAL CHECK
        expect(result.data?.logs).toContain('[INFO]');
        expect(result.data?.logs).toContain('Test message');
      });

      it('should append multiple log entries', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        await repo.log(created.data!.id, 'INFO', 'First message');
        const result = await repo.log(created.data!.id, 'WARN', 'Second message');

        expect(result.data?.logs).toContain('First message');
        expect(result.data?.logs).toContain('Second message');
        expect(result.data?.logs).toContain('[INFO]');
        expect(result.data?.logs).toContain('[WARN]');
      });
    });

    describe('log convenience methods', () => {
      let testRunId: string;

      beforeEach(async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        testRunId = created.data!.id;
      });

      it('logInfo should log with INFO level', async () => {
        const result = await repo.logInfo(testRunId, 'Info message');
        expect(result.data?.logs).toContain('[INFO]');
      });

      it('logWarn should log with WARN level', async () => {
        const result = await repo.logWarn(testRunId, 'Warning message');
        expect(result.data?.logs).toContain('[WARN]');
      });

      it('logError should log with ERROR level', async () => {
        const result = await repo.logError(testRunId, 'Error message');
        expect(result.data?.logs).toContain('[ERROR]');
      });

      it('logDebug should log with DEBUG level', async () => {
        const result = await repo.logDebug(testRunId, 'Debug message');
        expect(result.data?.logs).toContain('[DEBUG]');
      });

      it('logStep should log with STEP level', async () => {
        const result = await repo.logStep(testRunId, 'Step message');
        expect(result.data?.logs).toContain('[STEP]');
      });
    });

    describe('getLogs', () => {
      it('should return logs string', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.logInfo(created.data!.id, 'Test log');

        const result = await repo.getLogs(created.data!.id);

        expect(result.success).toBe(true);
        expect(typeof result.data).toBe('string');
        expect(result.data).toContain('Test log');
      });
    });
  });

  // ==========================================================================
  // STEP RECORDING
  // ==========================================================================

  describe('Step Recording', () => {
    describe('recordStep', () => {
      it('should record step result', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);

        const stepResult: StepExecutionResult = {
          step_id: 'step-1',
          status: 'passed',
          strategy_used: 'xpath',
          duration: 150
        };

        const result = await repo.recordStep(created.data!.id, stepResult);

        expect(result.success).toBe(true);
        expect(result.data?.current_step).toBe(1);
        expect(result.data?.results).toHaveLength(1);
        expect(result.data?.results![0].step_id).toBe('step-1');
      });

      it('should fail for non-running test run', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });

        const result = await repo.recordStep(created.data!.id, {
          step_id: 'step-1',
          status: 'passed',
          strategy_used: 'xpath',
          duration: 150
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot record step');
      });
    });

    describe('getStepResults', () => {
      it('should return step results', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);
        await repo.recordStep(created.data!.id, {
          step_id: 'step-1',
          status: 'passed',
          strategy_used: 'xpath',
          duration: 150
        });

        const result = await repo.getStepResults(created.data!.id);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
      });
    });
  });

  // ==========================================================================
  // PROGRESS AND STATISTICS
  // ==========================================================================

  describe('Progress and Statistics', () => {
    describe('getProgress', () => {
      it('should return progress info', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.start(created.data!.id);
        await repo.recordStep(created.data!.id, {
          step_id: 'step-1',
          status: 'passed',
          strategy_used: 'xpath',
          duration: 150
        });

        const result = await repo.getProgress(created.data!.id);

        expect(result.success).toBe(true);
        expect(result.data?.current_step).toBe(1);
        expect(result.data?.total_steps).toBe(5);
        expect(result.data?.percentage).toBe(20);
      });
    });

    describe('getStats', () => {
      it('should return statistics', async () => {
        const tr1 = await repo.create({ project_id: 1, total_steps: 5 });
        const tr2 = await repo.create({ project_id: 1, total_steps: 3 });
        await repo.start(tr1.data!.id);
        await repo.pass(tr1.data!.id);
        await repo.start(tr2.data!.id);
        await repo.fail(tr2.data!.id, 'Error');

        const result = await repo.getStats();

        expect(result.success).toBe(true);
        expect(result.data?.total_runs).toBe(2);
        expect(result.data?.passed_runs).toBe(1);
        expect(result.data?.failed_runs).toBe(1);
      });
    });

    describe('getProjectStats', () => {
      it('should return stats for specific project', async () => {
        const tr1 = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 2, total_steps: 3 });
        await repo.start(tr1.data!.id);
        await repo.pass(tr1.data!.id);

        const result = await repo.getProjectStats(1);

        expect(result.data?.total_runs).toBe(1);
        expect(result.data?.passed_runs).toBe(1);
      });
    });
  });

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  describe('Query Operations', () => {
    describe('exists', () => {
      it('should return true for existing test run', async () => {
        const created = await repo.create({ project_id: 1, total_steps: 5 });
        expect(await repo.exists(created.data!.id)).toBe(true);
      });

      it('should return false for non-existent test run', async () => {
        expect(await repo.exists('non-existent')).toBe(false);
      });
    });

    describe('getActive', () => {
      it('should return active test runs', async () => {
        const tr1 = await repo.create({ project_id: 1, total_steps: 5 });
        const tr2 = await repo.create({ project_id: 1, total_steps: 3 });
        await repo.start(tr1.data!.id);
        await repo.pass(tr1.data!.id);
        await repo.start(tr2.data!.id);

        const result = await repo.getActive();

        expect(result.data).toHaveLength(1);
        expect(result.data![0].status).toBe('running');
      });
    });

    describe('getCompleted', () => {
      it('should return completed test runs', async () => {
        const tr1 = await repo.create({ project_id: 1, total_steps: 5 });
        await repo.create({ project_id: 1, total_steps: 3 });
        await repo.start(tr1.data!.id);
        await repo.pass(tr1.data!.id);

        const result = await repo.getCompleted();

        expect(result.data).toHaveLength(1);
        expect(result.data![0].status).toBe('passed');
      });
    });

    describe('getMostRecent', () => {
      it('should return most recent test run', async () => {
        await repo.create({ project_id: 1, total_steps: 5 });
        await new Promise(r => setTimeout(r, 10));
        const second = await repo.create({ project_id: 1, total_steps: 3 });
        await repo.start(second.data!.id);

        const result = await repo.getMostRecent(1);

        expect(result.success).toBe(true);
        expect(result.data?.id).toBe(second.data!.id);
      });

      it('should return null for project with no test runs', async () => {
        const result = await repo.getMostRecent(999);
        expect(result.data).toBeNull();
      });
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('testRunRepository should be available', () => {
      expect(testRunRepository).toBeInstanceOf(TestRunRepository);
    });

    it('getTestRunRepository should return instance', () => {
      expect(getTestRunRepository()).toBe(testRunRepository);
    });
  });
});
