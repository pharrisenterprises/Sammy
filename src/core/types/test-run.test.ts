/**
 * @fileoverview Tests for TestRun type definitions
 * @module core/types/test-run.test
 */

import { describe, it, expect } from 'vitest';
import type { StepExecutionResult } from './step';
import {
  type TestRun,
  type TestRunStatus,
  TEST_RUN_STATUSES,
  TERMINAL_STATUSES,
  DEFAULT_TEST_RUN_STATUS,
  isTestRunStatus,
  isTestRun,
  isTerminalStatus,
  isActiveStatus,
  isPassed,
  isFailed,
  generateTestRunId,
  createTestRun,
  toTestRunSummary,
  getTestRunProgress,
  formatLogTimestamp,
  createLogEntry,
  appendLog,
  appendLogs,
  parseLogLines,
  getLastLogLines,
  countLogsByLevel,
  startTestRun,
  passTestRun,
  failTestRun,
  stopTestRun,
  recordStepResult,
  calculateTestRunStats,
  formatDuration,
  validateTestRun,
  isValidTestRun
} from './test-run';

describe('TestRun Types', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('TEST_RUN_STATUSES', () => {
    it('should contain exactly 5 valid statuses', () => {
      expect(TEST_RUN_STATUSES).toHaveLength(5);
      expect(TEST_RUN_STATUSES).toContain('pending');
      expect(TEST_RUN_STATUSES).toContain('running');
      expect(TEST_RUN_STATUSES).toContain('passed');
      expect(TEST_RUN_STATUSES).toContain('failed');
      expect(TEST_RUN_STATUSES).toContain('stopped');
    });
  });

  describe('TERMINAL_STATUSES', () => {
    it('should contain passed, failed, and stopped', () => {
      expect(TERMINAL_STATUSES).toContain('passed');
      expect(TERMINAL_STATUSES).toContain('failed');
      expect(TERMINAL_STATUSES).toContain('stopped');
      expect(TERMINAL_STATUSES).not.toContain('pending');
      expect(TERMINAL_STATUSES).not.toContain('running');
    });
  });

  describe('DEFAULT_TEST_RUN_STATUS', () => {
    it('should be pending', () => {
      expect(DEFAULT_TEST_RUN_STATUS).toBe('pending');
    });
  });

  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe('isTestRunStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isTestRunStatus('pending')).toBe(true);
      expect(isTestRunStatus('running')).toBe(true);
      expect(isTestRunStatus('passed')).toBe(true);
      expect(isTestRunStatus('failed')).toBe(true);
      expect(isTestRunStatus('stopped')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isTestRunStatus('completed')).toBe(false);
      expect(isTestRunStatus('success')).toBe(false);
      expect(isTestRunStatus('')).toBe(false);
      expect(isTestRunStatus(null)).toBe(false);
      expect(isTestRunStatus(123)).toBe(false);
    });
  });

  describe('isTestRun', () => {
    const validTestRun: TestRun = {
      id: 'test-run-1',
      project_id: 1,
      status: 'pending',
      started_at: null,
      completed_at: null,
      current_step: 0,
      total_steps: 5,
      logs: '',  // CRITICAL: string, not array
      results: [],
      csv_row_index: null,
      error: null
    };

    it('should return true for valid test run', () => {
      expect(isTestRun(validTestRun)).toBe(true);
    });

    it('should return true for test run with data', () => {
      const runWithData = {
        ...validTestRun,
        status: 'running' as TestRunStatus,
        started_at: Date.now(),
        logs: '[INFO] Started\n[STEP] Step 1',
        results: [{ step_id: '1', status: 'passed', duration: 100 }],
        csv_row_index: 0
      };
      expect(isTestRun(runWithData)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isTestRun(null)).toBe(false);
      expect(isTestRun(undefined)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isTestRun({ id: 'test' })).toBe(false);
      expect(isTestRun({ ...validTestRun, id: '' })).toBe(false);
      expect(isTestRun({ ...validTestRun, project_id: undefined })).toBe(false);
    });

    it('should return false for invalid status', () => {
      expect(isTestRun({ ...validTestRun, status: 'completed' })).toBe(false);
    });

    it('CRITICAL: should return false if logs is array instead of string', () => {
      const wrongLogs = { ...validTestRun, logs: ['line 1', 'line 2'] };
      expect(isTestRun(wrongLogs)).toBe(false);
    });

    it('should return false for non-array results', () => {
      expect(isTestRun({ ...validTestRun, results: 'not array' })).toBe(false);
    });
  });

  describe('isTerminalStatus / isActiveStatus', () => {
    it('should correctly identify terminal statuses', () => {
      expect(isTerminalStatus('passed')).toBe(true);
      expect(isTerminalStatus('failed')).toBe(true);
      expect(isTerminalStatus('stopped')).toBe(true);
      expect(isTerminalStatus('pending')).toBe(false);
      expect(isTerminalStatus('running')).toBe(false);
    });

    it('should correctly identify active statuses', () => {
      expect(isActiveStatus('pending')).toBe(true);
      expect(isActiveStatus('running')).toBe(true);
      expect(isActiveStatus('passed')).toBe(false);
      expect(isActiveStatus('failed')).toBe(false);
    });
  });

  describe('isPassed / isFailed', () => {
    it('should correctly identify passed/failed runs', () => {
      const passedRun = { status: 'passed' } as TestRun;
      const failedRun = { status: 'failed' } as TestRun;
      const runningRun = { status: 'running' } as TestRun;

      expect(isPassed(passedRun)).toBe(true);
      expect(isPassed(failedRun)).toBe(false);
      expect(isFailed(failedRun)).toBe(true);
      expect(isFailed(runningRun)).toBe(false);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('generateTestRunId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateTestRunId();
      const id2 = generateTestRunId();
      expect(id1).not.toBe(id2);
    });

    it('should generate non-empty strings', () => {
      const id = generateTestRunId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('createTestRun', () => {
    it('should create test run with defaults', () => {
      const testRun = createTestRun({
        project_id: 1,
        total_steps: 10
      });

      expect(testRun.id).toBeDefined();
      expect(testRun.project_id).toBe(1);
      expect(testRun.status).toBe('pending');
      expect(testRun.started_at).toBeNull();
      expect(testRun.completed_at).toBeNull();
      expect(testRun.current_step).toBe(0);
      expect(testRun.total_steps).toBe(10);
      expect(testRun.logs).toBe('');  // CRITICAL: empty string, not []
      expect(testRun.results).toEqual([]);
      expect(testRun.csv_row_index).toBeNull();
      expect(testRun.error).toBeNull();
    });

    it('should use provided csv_row_index', () => {
      const testRun = createTestRun({
        project_id: 1,
        total_steps: 5,
        csv_row_index: 3
      });

      expect(testRun.csv_row_index).toBe(3);
    });
  });

  describe('toTestRunSummary', () => {
    it('should calculate correct summary', () => {
      const testRun: TestRun = {
        id: 'run-1',
        project_id: 1,
        status: 'passed',
        started_at: 1000,
        completed_at: 5000,
        current_step: 3,
        total_steps: 3,
        logs: '',
        results: [
          { step_id: '1', status: 'passed', duration: 100 },
          { step_id: '2', status: 'passed', duration: 200 },
          { step_id: '3', status: 'failed', duration: 50, error: 'Not found' }
        ],
        csv_row_index: null,
        error: null
      };

      const summary = toTestRunSummary(testRun);

      expect(summary.id).toBe('run-1');
      expect(summary.status).toBe('passed');
      expect(summary.duration_ms).toBe(4000);
      expect(summary.steps_passed).toBe(2);
      expect(summary.steps_failed).toBe(1);
      expect(summary.total_steps).toBe(3);
    });

    it('should handle null timestamps', () => {
      const testRun: TestRun = {
        id: 'run-1',
        project_id: 1,
        status: 'pending',
        started_at: null,
        completed_at: null,
        current_step: 0,
        total_steps: 5,
        logs: '',
        results: [],
        csv_row_index: null,
        error: null
      };

      const summary = toTestRunSummary(testRun);
      expect(summary.duration_ms).toBeNull();
    });
  });

  describe('getTestRunProgress', () => {
    it('should calculate correct progress', () => {
      const testRun: TestRun = {
        id: 'run-1',
        project_id: 1,
        status: 'running',
        started_at: Date.now(),
        completed_at: null,
        current_step: 3,
        total_steps: 10,
        logs: '',
        results: [],
        csv_row_index: null,
        error: null
      };

      const progress = getTestRunProgress(testRun, 'Click Submit');

      expect(progress.current_step).toBe(3);
      expect(progress.total_steps).toBe(10);
      expect(progress.percentage).toBe(30);
      expect(progress.status).toBe('running');
      expect(progress.current_step_name).toBe('Click Submit');
    });

    it('should handle zero total steps', () => {
      const testRun = {
        current_step: 0,
        total_steps: 0,
        status: 'pending'
      } as TestRun;

      const progress = getTestRunProgress(testRun);
      expect(progress.percentage).toBe(0);
    });
  });

  // ==========================================================================
  // LOG FUNCTIONS
  // ==========================================================================

  describe('formatLogTimestamp', () => {
    it('should format timestamp correctly', () => {
      // Create a known date: 2024-01-15 14:30:45.123
      const date = new Date(2024, 0, 15, 14, 30, 45, 123);
      const formatted = formatLogTimestamp(date.getTime());
      expect(formatted).toBe('14:30:45.123');
    });
  });

  describe('createLogEntry', () => {
    it('should create formatted log entry', () => {
      const entry = createLogEntry('INFO', 'Test message');
      expect(entry).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} \[INFO\] Test message/);
    });

    it('should use correct prefixes for each level', () => {
      expect(createLogEntry('INFO', 'msg')).toContain('[INFO]');
      expect(createLogEntry('WARN', 'msg')).toContain('[WARN]');
      expect(createLogEntry('ERROR', 'msg')).toContain('[ERROR]');
      expect(createLogEntry('DEBUG', 'msg')).toContain('[DEBUG]');
      expect(createLogEntry('STEP', 'msg')).toContain('[STEP]');
    });
  });

  describe('appendLog', () => {
    it('should append to empty logs', () => {
      const logs = appendLog('', 'INFO', 'First entry');
      expect(logs).toContain('[INFO] First entry');
      expect(logs).not.toContain('\n');
    });

    it('should append with newline to existing logs', () => {
      let logs = appendLog('', 'INFO', 'First');
      logs = appendLog(logs, 'INFO', 'Second');

      const lines = logs.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('First');
      expect(lines[1]).toContain('Second');
    });
  });

  describe('appendLogs', () => {
    it('should append multiple entries', () => {
      const logs = appendLogs('', [
        ['INFO', 'Entry 1'],
        ['WARN', 'Entry 2'],
        ['ERROR', 'Entry 3']
      ]);

      const lines = logs.split('\n');
      expect(lines).toHaveLength(3);
    });
  });

  describe('parseLogLines', () => {
    it('should parse logs into array', () => {
      const logs = 'Line 1\nLine 2\nLine 3';
      const lines = parseLogLines(logs);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should return empty array for empty string', () => {
      expect(parseLogLines('')).toEqual([]);
    });
  });

  describe('getLastLogLines', () => {
    it('should get last N lines', () => {
      const logs = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const last = getLastLogLines(logs, 2);
      expect(last).toBe('Line 4\nLine 5');
    });
  });

  describe('countLogsByLevel', () => {
    it('should count entries by level', () => {
      const logs = [
        '00:00:00.000 [INFO] Info 1',
        '00:00:00.001 [INFO] Info 2',
        '00:00:00.002 [ERROR] Error 1',
        '00:00:00.003 [STEP] Step 1'
      ].join('\n');

      const counts = countLogsByLevel(logs);

      expect(counts.INFO).toBe(2);
      expect(counts.ERROR).toBe(1);
      expect(counts.STEP).toBe(1);
      expect(counts.WARN).toBe(0);
      expect(counts.DEBUG).toBe(0);
    });
  });

  // ==========================================================================
  // STATUS TRANSITIONS
  // ==========================================================================

  describe('startTestRun', () => {
    it('should transition from pending to running', () => {
      const pending = createTestRun({ project_id: 1, total_steps: 5 });
      const running = startTestRun(pending);

      expect(running.status).toBe('running');
      expect(running.started_at).not.toBeNull();
      expect(running.logs).toContain('started');
    });

    it('should throw if not pending', () => {
      const running = { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'running' as TestRunStatus };
      expect(() => startTestRun(running)).toThrow();
    });
  });

  describe('passTestRun', () => {
    it('should transition from running to passed', () => {
      let testRun = createTestRun({ project_id: 1, total_steps: 5 });
      testRun = startTestRun(testRun);
      const passed = passTestRun(testRun);

      expect(passed.status).toBe('passed');
      expect(passed.completed_at).not.toBeNull();
      expect(passed.logs).toContain('successfully');
    });

    it('should throw if not running', () => {
      const pending = createTestRun({ project_id: 1, total_steps: 5 });
      expect(() => passTestRun(pending)).toThrow();
    });
  });

  describe('failTestRun', () => {
    it('should transition from running to failed with error', () => {
      let testRun = createTestRun({ project_id: 1, total_steps: 5 });
      testRun = startTestRun(testRun);
      const failed = failTestRun(testRun, 'Element not found');

      expect(failed.status).toBe('failed');
      expect(failed.completed_at).not.toBeNull();
      expect(failed.error).toBe('Element not found');
      expect(failed.logs).toContain('Element not found');
    });
  });

  describe('stopTestRun', () => {
    it('should transition from running to stopped', () => {
      let testRun = createTestRun({ project_id: 1, total_steps: 5 });
      testRun = startTestRun(testRun);
      const stopped = stopTestRun(testRun);

      expect(stopped.status).toBe('stopped');
      expect(stopped.completed_at).not.toBeNull();
      expect(stopped.logs).toContain('stopped by user');
    });
  });

  describe('recordStepResult', () => {
    it('should record passed step', () => {
      let testRun = createTestRun({ project_id: 1, total_steps: 5 });
      testRun = startTestRun(testRun);

      const result: StepExecutionResult = {
        step_id: 'step-1',
        status: 'passed',
        duration: 150
      };

      const updated = recordStepResult(testRun, result);

      expect(updated.current_step).toBe(1);
      expect(updated.results).toHaveLength(1);
      expect(updated.results[0]).toBe(result);
      expect(updated.logs).toContain('passed');
    });

    it('should record failed step', () => {
      let testRun = createTestRun({ project_id: 1, total_steps: 5 });
      testRun = startTestRun(testRun);

      const result: StepExecutionResult = {
        step_id: 'step-1',
        status: 'failed',
        duration: 50,
        error: 'Timeout'
      };

      const updated = recordStepResult(testRun, result);

      expect(updated.logs).toContain('failed');
      expect(updated.logs).toContain('Timeout');
    });
  });

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  describe('calculateTestRunStats', () => {
    it('should calculate correct statistics', () => {
      const runs: TestRun[] = [
        { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'passed', started_at: 1000, completed_at: 2000 },
        { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'passed', started_at: 1000, completed_at: 3000 },
        { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'failed', started_at: 1000, completed_at: 1500 },
        { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'stopped', started_at: 1000, completed_at: 1200 },
      ];

      const stats = calculateTestRunStats(runs);

      expect(stats.total_runs).toBe(4);
      expect(stats.passed_runs).toBe(2);
      expect(stats.failed_runs).toBe(1);
      expect(stats.stopped_runs).toBe(1);
      expect(stats.pass_rate).toBe(50);
      expect(stats.average_duration_ms).toBe(925); // (1000 + 2000 + 500 + 200) / 4
    });

    it('should handle empty array', () => {
      const stats = calculateTestRunStats([]);

      expect(stats.total_runs).toBe(0);
      expect(stats.pass_rate).toBe(0);
      expect(stats.average_duration_ms).toBeNull();
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('should handle null', () => {
      expect(formatDuration(null)).toBe('-');
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateTestRun', () => {
    it('should return empty array for valid test run', () => {
      const testRun = createTestRun({ project_id: 1, total_steps: 5 });
      expect(validateTestRun(testRun)).toEqual([]);
    });

    it('should return error for missing id', () => {
      const errors = validateTestRun({ project_id: 1, total_steps: 5 });
      expect(errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should return error for invalid project_id', () => {
      const errors = validateTestRun({ id: 'test', project_id: 0, total_steps: 5 });
      expect(errors.some(e => e.field === 'project_id')).toBe(true);
    });

    it('should return error for invalid status', () => {
      const errors = validateTestRun({
        id: 'test',
        project_id: 1,
        status: 'completed' as TestRunStatus,
        total_steps: 5,
        current_step: 0
      });
      expect(errors.some(e => e.field === 'status')).toBe(true);
    });

    it('CRITICAL: should return error if logs is not a string', () => {
      const errors = validateTestRun({
        id: 'test',
        project_id: 1,
        total_steps: 5,
        current_step: 0,
        logs: ['array', 'not', 'string'] as any
      });
      expect(errors.some(e => e.field === 'logs')).toBe(true);
    });

    it('should return error if current_step exceeds total_steps', () => {
      const errors = validateTestRun({
        id: 'test',
        project_id: 1,
        total_steps: 5,
        current_step: 10
      });
      expect(errors.some(e => e.field === 'current_step')).toBe(true);
    });
  });

  describe('isValidTestRun', () => {
    it('should return true for valid test run', () => {
      const testRun = createTestRun({ project_id: 1, total_steps: 5 });
      expect(isValidTestRun(testRun)).toBe(true);
    });

    it('should return false for invalid test run', () => {
      expect(isValidTestRun({})).toBe(false);
    });
  });
});
