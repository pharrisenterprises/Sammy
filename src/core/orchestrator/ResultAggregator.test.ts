/**
 * Tests for ResultAggregator
 * @module core/orchestrator/ResultAggregator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResultAggregator,
  createResultAggregator,
  toTestRunFormat,
  generateResultSummary,
  DEFAULT_RESULT_AGGREGATOR_CONFIG,
  type StepResult,
  type RowResult,
  type ExecutionResult,
} from './ResultAggregator';
import { ProgressTracker } from './ProgressTracker';
import { LogCollector } from './LogCollector';

// ============================================================================
// MOCK HELPERS
// ============================================================================

function createMockProgressTracker(
  rows: number = 2,
  stepsPerRow: number = 3,
  completedSteps: Array<{ row: number; step: number; status: 'passed' | 'failed' | 'skipped' }> = []
): ProgressTracker {
  const tracker = new ProgressTracker(rows, stepsPerRow, { updateInterval: 0 });
  
  tracker.startExecution();
  
  // Group completed steps by row
  const stepsByRow = new Map<number, Array<{ step: number; status: 'passed' | 'failed' | 'skipped' }>>();
  for (const s of completedSteps) {
    if (!stepsByRow.has(s.row)) {
      stepsByRow.set(s.row, []);
    }
    stepsByRow.get(s.row)!.push({ step: s.step, status: s.status });
  }
  
  // Execute steps
  for (const [rowIndex, steps] of stepsByRow) {
    tracker.startRow(rowIndex, `Row-${rowIndex + 1}`);
    for (const { step, status } of steps) {
      tracker.startStep(step, { id: step + 1, name: `Step ${step + 1}` });
      tracker.completeStep(step, status, 100 + step * 50, status === 'failed' ? 'Test error' : undefined);
    }
    tracker.completeRow(rowIndex);
  }
  
  return tracker;
}

function createMockLogCollector(): LogCollector {
  const collector = new LogCollector({ updateInterval: 0 });
  collector.info('Test started');
  collector.success('Step 1 passed');
  collector.error('Step 2 failed');
  collector.info('Test completed');
  return collector;
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ResultAggregator', () => {
  let aggregator: ResultAggregator;

  beforeEach(() => {
    aggregator = new ResultAggregator();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = aggregator.getConfig();
      expect(config.includePending).toBe(false);
      expect(config.includeRowDetails).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new ResultAggregator({ includePending: true });
      expect(custom.getConfig().includePending).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should mark start time', () => {
      const before = new Date();
      aggregator.markStart();
      const after = new Date();
      
      // Aggregate to check times are set
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      const result = aggregator.aggregate(tracker, logs);
      
      const startTime = new Date(result.startTime);
      expect(startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(startTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should mark end time', () => {
      aggregator.markStart();
      aggregator.markEnd();
      
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.endTime).toBeDefined();
    });

    it('should mark stopped', () => {
      aggregator.markStart();
      aggregator.markStopped();
      
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.wasStopped).toBe(true);
      expect(result.status).toBe('stopped');
    });

    it('should reset state', () => {
      aggregator.markStart();
      aggregator.markStopped();
      aggregator.reset();
      
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.wasStopped).toBe(false);
    });
  });

  // ==========================================================================
  // AGGREGATION TESTS
  // ==========================================================================

  describe('aggregate', () => {
    it('should aggregate basic results', () => {
      const tracker = createMockProgressTracker(1, 3, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
        { row: 0, step: 2, status: 'failed' },
      ]);
      const logs = createMockLogCollector();
      
      aggregator.markStart();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.totalSteps).toBe(3);
      expect(result.passedSteps).toBe(2);
      expect(result.failedSteps).toBe(1);
    });

    it('should aggregate multiple rows', () => {
      const tracker = createMockProgressTracker(2, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
        { row: 1, step: 0, status: 'passed' },
        { row: 1, step: 1, status: 'failed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.totalRows).toBe(2);
      expect(result.completedRows).toBe(1);
      expect(result.failedRows).toBe(1);
    });

    it('should include logs as string', () => {
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(typeof result.logs).toBe('string');
      expect(result.logs).toContain('Test started');
    });

    it('should calculate pass rate', () => {
      const tracker = createMockProgressTracker(1, 4, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
        { row: 0, step: 2, status: 'passed' },
        { row: 0, step: 3, status: 'failed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.passRate).toBe(75);
    });

    it('should calculate duration', () => {
      aggregator.markStart();
      
      // Small delay
      const start = Date.now();
      while (Date.now() - start < 10) { /* wait */ }
      
      aggregator.markEnd();
      
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.duration).toBeGreaterThanOrEqual(10);
    });
  });

  // ==========================================================================
  // STATUS DETERMINATION TESTS
  // ==========================================================================

  describe('status determination', () => {
    it('should return completed when all pass', () => {
      const tracker = createMockProgressTracker(1, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.status).toBe('completed');
    });

    it('should return failed when any fail', () => {
      const tracker = createMockProgressTracker(1, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'failed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.status).toBe('failed');
    });

    it('should return stopped when marked', () => {
      aggregator.markStopped();
      
      const tracker = createMockProgressTracker(1, 2, [
        { row: 0, step: 0, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.status).toBe('stopped');
    });

    it('should return pending when no steps completed', () => {
      const tracker = new ProgressTracker(1, 3, { updateInterval: 0 });
      // Don't execute any steps
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.status).toBe('pending');
    });
  });

  // ==========================================================================
  // TEST RESULTS ARRAY TESTS
  // ==========================================================================

  describe('testResults array', () => {
    it('should flatten all steps into single array', () => {
      const tracker = createMockProgressTracker(2, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
        { row: 1, step: 0, status: 'passed' },
        { row: 1, step: 1, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.testResults.length).toBe(4);
    });

    it('should include step details', () => {
      const tracker = createMockProgressTracker(1, 1, [
        { row: 0, step: 0, status: 'failed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      const step = result.testResults[0];
      
      expect(step.index).toBe(0);
      expect(step.status).toBe('failed');
      expect(step.errorMessage).toBe('Test error');
      expect(step.rowIndex).toBe(0);
    });

    it('should include duration per step', () => {
      const tracker = createMockProgressTracker(1, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.testResults[0].duration).toBe(100);
      expect(result.testResults[1].duration).toBe(150);
    });

    it('should not include pending steps by default', () => {
      const tracker = new ProgressTracker(1, 3, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      // Steps 1 and 2 are still pending
      
      const logs = createMockLogCollector();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.testResults.length).toBe(1);
    });

    it('should include pending steps when configured', () => {
      const customAggregator = new ResultAggregator({ includePending: true });
      
      const tracker = new ProgressTracker(1, 3, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      // Steps 1 and 2 are still pending
      tracker.completeRow(0);
      
      const logs = createMockLogCollector();
      const result = customAggregator.aggregate(tracker, logs);
      
      expect(result.testResults.length).toBe(3);
    });
  });

  // ==========================================================================
  // ROW RESULTS TESTS
  // ==========================================================================

  describe('rowResults', () => {
    it('should include row-level details', () => {
      const tracker = createMockProgressTracker(2, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
        { row: 1, step: 0, status: 'failed' },
        { row: 1, step: 1, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.rowResults.length).toBe(2);
      expect(result.rowResults[0].status).toBe('completed');
      expect(result.rowResults[1].status).toBe('failed');
    });

    it('should exclude row details when configured', () => {
      const noRowDetails = new ResultAggregator({ includeRowDetails: false });
      
      const tracker = createMockProgressTracker(2, 2, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = noRowDetails.aggregate(tracker, logs);
      
      expect(result.rowResults.length).toBe(0);
    });

    it('should include row identifier', () => {
      const tracker = createMockProgressTracker(1, 1, [
        { row: 0, step: 0, status: 'passed' },
      ]);
      const logs = createMockLogCollector();
      
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.rowResults[0].identifier).toBe('Row-1');
    });
  });

  // ==========================================================================
  // PARTIAL RESULT TESTS
  // ==========================================================================

  describe('getPartialResult', () => {
    it('should return in-progress status', () => {
      const tracker = new ProgressTracker(2, 3, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      
      const partial = aggregator.getPartialResult(tracker);
      
      expect(partial.status).toBe('running');
      expect(partial.currentRow).toBe(0);
      expect(partial.completedSteps).toBe(1);
    });

    it('should return paused status', () => {
      const tracker = new ProgressTracker(2, 3, { updateInterval: 0 });
      tracker.startExecution();
      tracker.pauseExecution();
      
      const partial = aggregator.getPartialResult(tracker);
      
      expect(partial.status).toBe('paused');
    });

    it('should include progress percentage', () => {
      const tracker = createMockProgressTracker(1, 4, [
        { row: 0, step: 0, status: 'passed' },
        { row: 0, step: 1, status: 'passed' },
      ]);
      
      const partial = aggregator.getPartialResult(tracker);
      
      expect(partial.progress).toBe(50);
    });
  });

  // ==========================================================================
  // STATISTICS HELPERS TESTS
  // ==========================================================================

  describe('statistics helpers', () => {
    const testResults: StepResult[] = [
      { index: 0, id: 1, name: 'Step 1', status: 'passed', duration: 100 },
      { index: 1, id: 2, name: 'Step 2', status: 'passed', duration: 200 },
      { index: 2, id: 3, name: 'Step 3', status: 'failed', duration: 150, errorMessage: 'Error' },
      { index: 3, id: 4, name: 'Step 4', status: 'skipped', duration: 0 },
    ];

    it('should calculate stats', () => {
      const stats = aggregator.calculateStats(testResults);
      
      expect(stats.total).toBe(4);
      expect(stats.passed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.passRate).toBe(50);
    });

    it('should calculate average duration', () => {
      const stats = aggregator.calculateStats(testResults);
      
      // Only 3 steps have duration > 0: 100, 200, 150
      expect(stats.avgDuration).toBe(150);
      expect(stats.totalDuration).toBe(450);
    });

    it('should get failed steps', () => {
      const failed = aggregator.getFailedSteps(testResults);
      
      expect(failed.length).toBe(1);
      expect(failed[0].name).toBe('Step 3');
    });

    it('should get error summary', () => {
      const errors = aggregator.getErrorSummary(testResults);
      
      expect(errors.length).toBe(1);
      expect(errors[0].stepName).toBe('Step 3');
      expect(errors[0].error).toBe('Error');
    });

    it('should get slowest steps', () => {
      const slowest = aggregator.getSlowestSteps(testResults, 2);
      
      expect(slowest.length).toBe(2);
      expect(slowest[0].duration).toBe(200);
      expect(slowest[1].duration).toBe(150);
    });
  });

  // ==========================================================================
  // TIMESTAMP FORMAT TESTS
  // ==========================================================================

  describe('timestamp formatting', () => {
    it('should format as ISO by default', () => {
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      
      aggregator.markStart();
      const result = aggregator.aggregate(tracker, logs);
      
      expect(result.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should format as unix timestamp', () => {
      const unixAggregator = new ResultAggregator({ timestampFormat: 'unix' });
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      
      unixAggregator.markStart();
      const result = unixAggregator.aggregate(tracker, logs);
      
      expect(result.startTime).toMatch(/^\d+$/);
    });

    it('should format as locale string', () => {
      const localeAggregator = new ResultAggregator({ timestampFormat: 'locale' });
      const tracker = createMockProgressTracker();
      const logs = createMockLogCollector();
      
      localeAggregator.markStart();
      const result = localeAggregator.aggregate(tracker, logs);
      
      // Locale format varies, just check it's not ISO or unix
      expect(result.startTime).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.startTime).not.toMatch(/^\d+$/);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  describe('toTestRunFormat', () => {
    it('should convert to TestRun format', () => {
      const result: ExecutionResult = {
        status: 'completed',
        totalSteps: 5,
        passedSteps: 4,
        failedSteps: 1,
        skippedSteps: 0,
        totalRows: 1,
        completedRows: 1,
        failedRows: 0,
        duration: 1000,
        passRate: 80,
        startTime: '2025-01-01T10:00:00.000Z',
        endTime: '2025-01-01T10:00:01.000Z',
        testResults: [],
        rowResults: [],
        logs: 'Test logs',
        wasStopped: false,
      };

      const testRun = toTestRunFormat(result, 123);

      expect(testRun.project_id).toBe(123);
      expect(testRun.status).toBe('completed');
      expect(testRun.total_steps).toBe(5);
      expect(testRun.passed_steps).toBe(4);
      expect(testRun.failed_steps).toBe(1);
      expect(testRun.logs).toBe('Test logs');
    });

    it('should map stopped to failed', () => {
      const result: ExecutionResult = {
        status: 'stopped',
        totalSteps: 5,
        passedSteps: 2,
        failedSteps: 0,
        skippedSteps: 3,
        totalRows: 1,
        completedRows: 0,
        failedRows: 0,
        duration: 500,
        passRate: 40,
        startTime: '2025-01-01T10:00:00.000Z',
        endTime: '2025-01-01T10:00:00.500Z',
        testResults: [],
        rowResults: [],
        logs: '',
        wasStopped: true,
      };

      const testRun = toTestRunFormat(result, 1);

      expect(testRun.status).toBe('failed');
    });
  });

  describe('generateResultSummary', () => {
    it('should generate human-readable summary', () => {
      const result: ExecutionResult = {
        status: 'completed',
        totalSteps: 10,
        passedSteps: 8,
        failedSteps: 2,
        skippedSteps: 0,
        totalRows: 2,
        completedRows: 1,
        failedRows: 1,
        duration: 5000,
        passRate: 80,
        startTime: '2025-01-01T10:00:00.000Z',
        endTime: '2025-01-01T10:00:05.000Z',
        testResults: [],
        rowResults: [],
        logs: '',
        wasStopped: false,
      };

      const summary = generateResultSummary(result);

      expect(summary).toContain('COMPLETED');
      expect(summary).toContain('Total: 10');
      expect(summary).toContain('Passed: 8');
      expect(summary).toContain('Failed: 2');
      expect(summary).toContain('80%');
    });

    it('should indicate stopped execution', () => {
      const result: ExecutionResult = {
        status: 'stopped',
        totalSteps: 5,
        passedSteps: 2,
        failedSteps: 0,
        skippedSteps: 3,
        totalRows: 1,
        completedRows: 0,
        failedRows: 0,
        duration: 500,
        passRate: 40,
        startTime: '',
        endTime: '',
        testResults: [],
        rowResults: [],
        logs: '',
        wasStopped: true,
      };

      const summary = generateResultSummary(result);

      expect(summary).toContain('stopped by user');
    });
  });

  describe('createResultAggregator', () => {
    it('should create instance with factory', () => {
      const agg = createResultAggregator({ includePending: true });
      
      expect(agg).toBeInstanceOf(ResultAggregator);
      expect(agg.getConfig().includePending).toBe(true);
    });
  });
});
