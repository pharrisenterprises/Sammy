/**
 * Tests for TestRunBuilder
 * @module core/orchestrator/TestRunBuilder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestRunBuilder,
  createTestRunBuilder,
  buildTestRun,
  buildTestRunUpdate,
  createCompletedTestRun,
  DEFAULT_TEST_RUN_BUILDER_CONFIG,
  type TestRun,
  type TestRunStatus,
  type CreateTestRunInput,
} from './TestRunBuilder';
import type { ExecutionResult, StepResult } from './ResultAggregator';

// ============================================================================
// TEST DATA HELPERS
// ============================================================================

function createMockExecutionResult(
  overrides: Partial<ExecutionResult> = {}
): ExecutionResult {
  return {
    status: 'completed',
    totalSteps: 10,
    passedSteps: 8,
    failedSteps: 2,
    skippedSteps: 0,
    totalRows: 1,
    completedRows: 1,
    failedRows: 0,
    duration: 5000,
    passRate: 80,
    startTime: '2025-01-01T10:00:00.000Z',
    endTime: '2025-01-01T10:00:05.000Z',
    testResults: [
      { index: 0, id: 1, name: 'Step 1', status: 'passed', duration: 100 },
      { index: 1, id: 2, name: 'Step 2', status: 'failed', duration: 200, errorMessage: 'Error' },
    ],
    rowResults: [],
    logs: 'Test execution logs',
    wasStopped: false,
    ...overrides,
  };
}

function createMockStepResult(
  overrides: Partial<StepResult> = {}
): StepResult {
  return {
    index: 0,
    id: 1,
    name: 'Test Step',
    status: 'passed',
    duration: 100,
    ...overrides,
  };
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('TestRunBuilder', () => {
  let builder: TestRunBuilder;

  beforeEach(() => {
    builder = new TestRunBuilder();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(builder).toBeInstanceOf(TestRunBuilder);
    });

    it('should accept custom config', () => {
      const custom = new TestRunBuilder({ defaultStatus: 'running' });
      const data = custom.setProjectId(1).buildUnsafe();
      expect(data.status).toBe('running');
    });
  });

  // ==========================================================================
  // STATIC FACTORY TESTS
  // ==========================================================================

  describe('fromExecutionResult', () => {
    it('should create builder from execution result', () => {
      const result = createMockExecutionResult();
      const testRun = TestRunBuilder.fromExecutionResult(result, 123).build();

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('completed');
      expect(testRun.total_steps).toBe(10);
      expect(testRun.passed_steps).toBe(8);
      expect(testRun.failed_steps).toBe(2);
      expect(testRun.logs).toBe('Test execution logs');
    });

    it('should map failed status correctly', () => {
      const result = createMockExecutionResult({ status: 'failed' });
      const testRun = TestRunBuilder.fromExecutionResult(result, 1).build();

      expect(testRun.status).toBe('failed');
    });

    it('should map stopped to failed', () => {
      const result = createMockExecutionResult({ status: 'stopped', wasStopped: true });
      const testRun = TestRunBuilder.fromExecutionResult(result, 1).build();

      expect(testRun.status).toBe('failed');
    });

    it('should include test results', () => {
      const result = createMockExecutionResult();
      const testRun = TestRunBuilder.fromExecutionResult(result, 1).build();

      expect(testRun.test_results.length).toBe(2);
      expect(testRun.test_results[0].name).toBe('Step 1');
    });
  });

  describe('createPending', () => {
    it('should create pending test run', () => {
      const testRun = TestRunBuilder.createPending(123, 10).build();

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('pending');
      expect(testRun.total_steps).toBe(10);
      expect(testRun.passed_steps).toBe(0);
      expect(testRun.failed_steps).toBe(0);
    });

    it('should default total steps to 0', () => {
      const testRun = TestRunBuilder.createPending(123).build();
      expect(testRun.total_steps).toBe(0);
    });
  });

  describe('createRunning', () => {
    it('should create running test run', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const testRun = TestRunBuilder.createRunning(123, startTime).build();

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('running');
      expect(testRun.start_time).toBe('2025-01-01T10:00:00.000Z');
    });
  });

  // ==========================================================================
  // FLUENT SETTER TESTS
  // ==========================================================================

  describe('fluent setters', () => {
    it('should set project ID', () => {
      const testRun = builder.setProjectId(456).buildUnsafe();
      expect(testRun.project_id).toBe(456);
    });

    it('should set status', () => {
      const testRun = builder.setProjectId(1).setStatus('completed').build();
      expect(testRun.status).toBe('completed');
    });

    it('should set start time from Date', () => {
      const date = new Date('2025-01-01T10:00:00Z');
      const testRun = builder.setProjectId(1).setStartTime(date).build();
      expect(testRun.start_time).toBe('2025-01-01T10:00:00.000Z');
    });

    it('should set start time from string', () => {
      const testRun = builder.setProjectId(1).setStartTime('2025-01-01T10:00:00Z').build();
      expect(testRun.start_time).toBe('2025-01-01T10:00:00Z');
    });

    it('should set end time', () => {
      const testRun = builder
        .setProjectId(1)
        .setEndTime(new Date('2025-01-01T11:00:00Z'))
        .build();
      expect(testRun.end_time).toBe('2025-01-01T11:00:00.000Z');
    });

    it('should handle undefined end time', () => {
      const testRun = builder.setProjectId(1).setEndTime(undefined).build();
      expect(testRun.end_time).toBeUndefined();
    });

    it('should set step counts individually', () => {
      const testRun = builder
        .setProjectId(1)
        .setTotalSteps(10)
        .setPassedSteps(7)
        .setFailedSteps(3)
        .build();

      expect(testRun.total_steps).toBe(10);
      expect(testRun.passed_steps).toBe(7);
      expect(testRun.failed_steps).toBe(3);
    });

    it('should set step counts at once', () => {
      const testRun = builder
        .setProjectId(1)
        .setStepCounts(20, 15, 5)
        .build();

      expect(testRun.total_steps).toBe(20);
      expect(testRun.passed_steps).toBe(15);
      expect(testRun.failed_steps).toBe(5);
    });

    it('should set test results', () => {
      const results = [createMockStepResult(), createMockStepResult({ index: 1 })];
      const testRun = builder.setProjectId(1).setTestResults(results).build();

      expect(testRun.test_results.length).toBe(2);
    });

    it('should add single test result', () => {
      const testRun = builder
        .setProjectId(1)
        .addTestResult(createMockStepResult())
        .addTestResult(createMockStepResult({ index: 1 }))
        .build();

      expect(testRun.test_results.length).toBe(2);
    });

    it('should set logs', () => {
      const testRun = builder.setProjectId(1).setLogs('Test logs here').build();
      expect(testRun.logs).toBe('Test logs here');
    });

    it('should append logs', () => {
      const testRun = builder
        .setProjectId(1)
        .setLogs('First line')
        .appendLogs('Second line')
        .build();

      expect(testRun.logs).toBe('First line\nSecond line');
    });

    it('should truncate logs when configured', () => {
      const truncatingBuilder = new TestRunBuilder({ maxLogLength: 20 });
      const testRun = truncatingBuilder
        .setProjectId(1)
        .setLogs('This is a very long log message that exceeds the limit')
        .build();

      expect(testRun.logs.length).toBeLessThanOrEqual(40); // 20 + suffix
      expect(testRun.logs).toContain('[truncated]');
    });

    it('should return this for chaining', () => {
      const result = builder
        .setProjectId(1)
        .setStatus('completed')
        .setStartTime(new Date())
        .setEndTime(new Date())
        .setStepCounts(10, 8, 2)
        .setTestResults([])
        .setLogs('');

      expect(result).toBe(builder);
    });
  });

  // ==========================================================================
  // BUILD TESTS
  // ==========================================================================

  describe('build', () => {
    it('should build valid TestRun', () => {
      const testRun = builder
        .setProjectId(123)
        .setStatus('completed')
        .setStartTime('2025-01-01T10:00:00Z')
        .setEndTime('2025-01-01T11:00:00Z')
        .setStepCounts(10, 8, 2)
        .setTestResults([])
        .setLogs('Test completed')
        .build();

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('completed');
      expect(testRun.total_steps).toBe(10);
      expect(testRun.logs).toBe('Test completed');
    });

    it('should apply defaults', () => {
      const testRun = builder.setProjectId(1).build();

      expect(testRun.status).toBe('pending');
      expect(testRun.total_steps).toBe(0);
      expect(testRun.passed_steps).toBe(0);
      expect(testRun.failed_steps).toBe(0);
      expect(testRun.test_results).toEqual([]);
      expect(testRun.logs).toBe('');
    });

    it('should throw on validation error', () => {
      expect(() => builder.build()).toThrow('project_id: Required field');
    });

    it('should include start_time in output', () => {
      const testRun = builder.setProjectId(1).build();
      expect(testRun.start_time).toBeDefined();
    });
  });

  describe('buildUnsafe', () => {
    it('should build without validation', () => {
      const testRun = builder.buildUnsafe();

      expect(testRun.project_id).toBe(0);
      expect(testRun.status).toBe('pending');
    });

    it('should use defaults for missing values', () => {
      const testRun = builder.buildUnsafe();

      expect(testRun.total_steps).toBe(0);
      expect(testRun.test_results).toEqual([]);
      expect(testRun.logs).toBe('');
    });
  });

  describe('buildForUpdate', () => {
    it('should only include set fields', () => {
      const update = builder
        .setStatus('completed')
        .setEndTime('2025-01-01T11:00:00Z')
        .buildForUpdate();

      expect(update.status).toBe('completed');
      expect(update.end_time).toBe('2025-01-01T11:00:00Z');
      expect(update.start_time).toBeUndefined();
      expect(update.total_steps).toBeUndefined();
    });

    it('should return empty object if nothing set', () => {
      const update = builder.buildForUpdate();
      expect(Object.keys(update).length).toBe(0);
    });
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('validation', () => {
    it('should validate required project_id', () => {
      const result = builder.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'project_id')).toBe(true);
    });

    it('should validate project_id type', () => {
      builder.setProjectId(-1);
      const result = builder.validate();

      expect(result.errors.some(e => e.field === 'project_id')).toBe(true);
    });

    it('should validate status values', () => {
      builder.setProjectId(1).setStatus('invalid' as TestRunStatus);
      const result = builder.validate();

      expect(result.errors.some(e => e.field === 'status')).toBe(true);
    });

    it('should validate start_time format', () => {
      builder.setProjectId(1).setStartTime('not-a-date');
      const result = builder.validate();

      expect(result.errors.some(e => e.field === 'start_time')).toBe(true);
    });

    it('should validate non-negative step counts', () => {
      builder.setProjectId(1).setPassedSteps(-1);
      const result = builder.validate();

      expect(result.errors.some(e => e.field === 'passed_steps')).toBe(true);
    });

    it('should validate step count consistency', () => {
      builder.setProjectId(1).setStepCounts(5, 3, 4); // 3+4 > 5
      const result = builder.validate();

      expect(result.errors.some(e => e.field === 'step_counts')).toBe(true);
    });

    it('should validate logs is string', () => {
      builder.setProjectId(1);
      (builder as any).data.logs = ['not', 'a', 'string'];
      const result = builder.validate();

      expect(result.errors.some(e => e.field === 'logs')).toBe(true);
    });

    it('should pass validation for valid data', () => {
      const result = builder
        .setProjectId(1)
        .setStatus('completed')
        .setStartTime(new Date())
        .setStepCounts(10, 8, 2)
        .validate();

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should check isValid()', () => {
      const freshBuilder = new TestRunBuilder();
      expect(freshBuilder.isValid()).toBe(false);
      
      freshBuilder.setProjectId(1).setStatus('completed').setStartTime(new Date());
      expect(freshBuilder.isValid()).toBe(true);
    });
  });

  // ==========================================================================
  // UTILITY METHODS TESTS
  // ==========================================================================

  describe('utility methods', () => {
    it('should get current data', () => {
      builder.setProjectId(123).setStatus('running');
      const data = builder.getData();

      expect(data.project_id).toBe(123);
      expect(data.status).toBe('running');
    });

    it('should reset builder', () => {
      builder.setProjectId(123).setStatus('completed');
      builder.reset();

      const data = builder.getData();
      expect(data.project_id).toBeUndefined();
      expect(data.status).toBeUndefined();
    });

    it('should clone builder', () => {
      builder.setProjectId(123).setTestResults([createMockStepResult()]);
      const cloned = builder.clone();

      // Modify original
      builder.setProjectId(456);

      // Clone should be independent
      expect(cloned.getData().project_id).toBe(123);
    });

    it('should deep clone test_results', () => {
      const results = [createMockStepResult()];
      builder.setProjectId(1).setTestResults(results);
      const cloned = builder.clone();

      results.push(createMockStepResult({ index: 1 }));

      expect(cloned.getData().test_results?.length).toBe(1);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  describe('createTestRunBuilder', () => {
    it('should create builder instance', () => {
      const builder = createTestRunBuilder();
      expect(builder).toBeInstanceOf(TestRunBuilder);
    });

    it('should accept config', () => {
      const builder = createTestRunBuilder({ defaultStatus: 'running' });
      const testRun = builder.setProjectId(1).buildUnsafe();
      expect(testRun.status).toBe('running');
    });
  });

  describe('buildTestRun', () => {
    it('should build directly from ExecutionResult', () => {
      const result = createMockExecutionResult();
      const testRun = buildTestRun(result, 123);

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('completed');
      expect(testRun.total_steps).toBe(10);
    });
  });

  describe('buildTestRunUpdate', () => {
    it('should create update payload', () => {
      const update = buildTestRunUpdate({
        status: 'completed',
        end_time: '2025-01-01T11:00:00Z',
      });

      expect(update.status).toBe('completed');
      expect(update.end_time).toBe('2025-01-01T11:00:00Z');
    });
  });

  describe('createCompletedTestRun', () => {
    it('should create completed test run', () => {
      const testRun = createCompletedTestRun(
        123,
        10,
        10,
        0,
        [],
        'All tests passed',
        '2025-01-01T10:00:00Z',
        '2025-01-01T11:00:00Z'
      );

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('completed');
      expect(testRun.passed_steps).toBe(10);
    });

    it('should set failed status when failures exist', () => {
      const testRun = createCompletedTestRun(
        123,
        10,
        8,
        2,
        [],
        'Some tests failed',
        new Date(),
        new Date()
      );

      expect(testRun.status).toBe('failed');
    });
  });
});

// ============================================================================
// LOGS TYPE TESTS (CRITICAL)
// ============================================================================

describe('logs type enforcement', () => {
  it('should always output logs as string', () => {
    const testRun = new TestRunBuilder()
      .setProjectId(1)
      .setLogs('Line 1\nLine 2\nLine 3')
      .build();

    expect(typeof testRun.logs).toBe('string');
  });

  it('should not accept array for logs', () => {
    const builder = new TestRunBuilder().setProjectId(1);
    (builder as any).data.logs = ['line1', 'line2'];
    
    const validation = builder.validate();
    expect(validation.errors.some(e => e.field === 'logs')).toBe(true);
  });

  it('should preserve newlines in logs', () => {
    const multilineLogs = 'First line\nSecond line\nThird line';
    const testRun = new TestRunBuilder()
      .setProjectId(1)
      .setLogs(multilineLogs)
      .build();

    expect(testRun.logs).toBe(multilineLogs);
    expect(testRun.logs.split('\n').length).toBe(3);
  });
});
