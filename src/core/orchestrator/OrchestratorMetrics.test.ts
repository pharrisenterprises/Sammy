/**
 * Tests for OrchestratorMetrics
 * @module core/orchestrator/OrchestratorMetrics.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestratorMetrics,
  createOrchestratorMetrics,
  DEFAULT_METRICS_CONFIG,
  type StepTiming,
  type RowTiming,
} from './OrchestratorMetrics';

// ============================================================================
// HELPERS
// ============================================================================

function createStepTiming(overrides: Partial<StepTiming> = {}): StepTiming {
  return {
    stepIndex: 0,
    label: 'Test Step',
    rowIndex: 0,
    duration: 100,
    success: true,
    retryCount: 0,
    ...overrides,
  };
}

function createRowTiming(overrides: Partial<RowTiming> = {}): RowTiming {
  return {
    rowIndex: 0,
    rowId: 'row-0',
    duration: 500,
    stepsPassed: 5,
    stepsFailed: 0,
    stepsSkipped: 0,
    success: true,
    ...overrides,
  };
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('OrchestratorMetrics', () => {
  let metrics: OrchestratorMetrics;

  beforeEach(() => {
    metrics = new OrchestratorMetrics();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = metrics.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.maxStepTimings).toBe(10000);
    });

    it('should accept custom config', () => {
      const custom = new OrchestratorMetrics({ maxStepTimings: 500 });
      expect(custom.getConfig().maxStepTimings).toBe(500);
    });

    it('should start with empty buffers', () => {
      const counts = metrics.getCounts();
      expect(counts.steps).toBe(0);
      expect(counts.rows).toBe(0);
      expect(counts.executions).toBe(0);
    });
  });

  // ==========================================================================
  // STEP RECORDING TESTS
  // ==========================================================================

  describe('step recording', () => {
    it('should record step timing', () => {
      metrics.recordStep(createStepTiming());

      expect(metrics.getCounts().steps).toBe(1);
    });

    it('should get all step timings', () => {
      metrics.recordStep(createStepTiming({ stepIndex: 0 }));
      metrics.recordStep(createStepTiming({ stepIndex: 1 }));
      metrics.recordStep(createStepTiming({ stepIndex: 2 }));

      const timings = metrics.getStepTimings();
      expect(timings.length).toBe(3);
    });

    it('should get recent step timings', () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordStep(createStepTiming({ stepIndex: i }));
      }

      const recent = metrics.getRecentStepTimings(3);
      expect(recent.length).toBe(3);
      expect(recent[0].stepIndex).toBe(7);
    });

    it('should not record when disabled', () => {
      metrics.disable();
      metrics.recordStep(createStepTiming());

      expect(metrics.getCounts().steps).toBe(0);
    });

    it('should respect maxStepTimings limit', () => {
      const small = new OrchestratorMetrics({ maxStepTimings: 5 });

      for (let i = 0; i < 10; i++) {
        small.recordStep(createStepTiming({ stepIndex: i }));
      }

      expect(small.getCounts().steps).toBe(5);
      // Should have most recent 5
      const timings = small.getStepTimings();
      expect(timings[0].stepIndex).toBe(5);
      expect(timings[4].stepIndex).toBe(9);
    });
  });

  // ==========================================================================
  // ROW RECORDING TESTS
  // ==========================================================================

  describe('row recording', () => {
    it('should record row timing', () => {
      metrics.recordRow(createRowTiming());

      expect(metrics.getCounts().rows).toBe(1);
    });

    it('should get all row timings', () => {
      metrics.recordRow(createRowTiming({ rowIndex: 0 }));
      metrics.recordRow(createRowTiming({ rowIndex: 1 }));

      const timings = metrics.getRowTimings();
      expect(timings.length).toBe(2);
    });
  });

  // ==========================================================================
  // EXECUTION RECORDING TESTS
  // ==========================================================================

  describe('execution recording', () => {
    it('should track execution lifecycle', () => {
      metrics.startExecution('exec-1', 1);

      const timing = metrics.endExecution(1, {
        rowsProcessed: 10,
        stepsExecuted: 50,
        stepsPassed: 48,
        stepsFailed: 2,
        stepsSkipped: 0,
        success: true,
        wasStopped: false,
      });

      expect(timing).not.toBeNull();
      expect(timing!.executionId).toBe('exec-1');
      expect(timing!.projectId).toBe(1);
      expect(timing!.stepsPassed).toBe(48);
    });

    it('should calculate duration', async () => {
      metrics.startExecution('exec-1', 1);

      await new Promise(resolve => setTimeout(resolve, 50));

      const timing = metrics.endExecution(1, {
        rowsProcessed: 1,
        stepsExecuted: 1,
        stepsPassed: 1,
        stepsFailed: 0,
        stepsSkipped: 0,
        success: true,
        wasStopped: false,
      });

      expect(timing!.duration).toBeGreaterThanOrEqual(50);
    });

    it('should track pause duration', async () => {
      metrics.startExecution('exec-1', 1);

      await new Promise(resolve => setTimeout(resolve, 20));
      metrics.recordPauseStart();
      await new Promise(resolve => setTimeout(resolve, 50));
      metrics.recordPauseEnd();
      await new Promise(resolve => setTimeout(resolve, 20));

      const timing = metrics.endExecution(1, {
        rowsProcessed: 1,
        stepsExecuted: 1,
        stepsPassed: 1,
        stepsFailed: 0,
        stepsSkipped: 0,
        success: true,
        wasStopped: false,
      });

      expect(timing!.pauseDuration).toBeGreaterThanOrEqual(50);
      expect(timing!.activeDuration).toBeLessThan(timing!.duration);
    });

    it('should return null when no execution started', () => {
      const timing = metrics.endExecution(1, {
        rowsProcessed: 0,
        stepsExecuted: 0,
        stepsPassed: 0,
        stepsFailed: 0,
        stepsSkipped: 0,
        success: false,
        wasStopped: false,
      });

      expect(timing).toBeNull();
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics calculation', () => {
    it('should calculate statistics for values', () => {
      const values = [10, 20, 30, 40, 50];
      const stats = metrics.calculateStatistics(values);

      expect(stats.count).toBe(5);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.mean).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.sum).toBe(150);
    });

    it('should handle empty array', () => {
      const stats = metrics.calculateStatistics([]);

      expect(stats.count).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.mean).toBe(0);
    });

    it('should calculate percentiles', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = metrics.calculateStatistics(values);

      expect(stats.p90).toBeGreaterThanOrEqual(90);
      expect(stats.p95).toBeGreaterThanOrEqual(95);
      expect(stats.p99).toBeGreaterThanOrEqual(99);
    });
  });

  // ==========================================================================
  // STEP PERFORMANCE TESTS
  // ==========================================================================

  describe('step performance tracking', () => {
    it('should track step performance by label', () => {
      metrics.recordStep(createStepTiming({ label: 'Fill Name', success: true }));
      metrics.recordStep(createStepTiming({ label: 'Fill Name', success: true }));
      metrics.recordStep(createStepTiming({ label: 'Fill Name', success: false }));

      const perf = metrics.getStepPerformance('Fill Name');

      expect(perf).not.toBeNull();
      expect(perf!.executionCount).toBe(3);
      expect(perf!.passCount).toBe(2);
      expect(perf!.failCount).toBe(1);
      expect(perf!.successRate).toBeCloseTo(0.667, 2);
    });

    it('should return null for unknown step', () => {
      expect(metrics.getStepPerformance('Unknown')).toBeNull();
    });

    it('should get all step performances', () => {
      metrics.recordStep(createStepTiming({ label: 'Step A' }));
      metrics.recordStep(createStepTiming({ label: 'Step B' }));
      metrics.recordStep(createStepTiming({ label: 'Step A' }));

      const performances = metrics.getAllStepPerformances();

      expect(performances.length).toBe(2);
      expect(performances[0].executionCount).toBe(2); // Step A
    });

    it('should calculate step failure rate', () => {
      metrics.recordStep(createStepTiming({ label: 'Flaky', success: true }));
      metrics.recordStep(createStepTiming({ label: 'Flaky', success: false }));

      const rate = metrics.getStepFailureRate('Flaky');
      expect(rate).toBe(0.5);
    });

    it('should get steps by failure rate', () => {
      metrics.recordStep(createStepTiming({ label: 'Reliable', success: true }));
      metrics.recordStep(createStepTiming({ label: 'Flaky', success: false }));

      const byFailure = metrics.getStepsByFailureRate();

      expect(byFailure[0].label).toBe('Flaky');
      expect(byFailure[0].failureRate).toBe(1);
    });

    it('should get steps by duration', () => {
      metrics.recordStep(createStepTiming({ label: 'Fast', duration: 50 }));
      metrics.recordStep(createStepTiming({ label: 'Slow', duration: 500 }));

      const byDuration = metrics.getStepsByDuration();

      expect(byDuration[0].label).toBe('Slow');
      expect(byDuration[0].averageDuration).toBe(500);
    });
  });

  // ==========================================================================
  // PERFORMANCE SUMMARY TESTS
  // ==========================================================================

  describe('performance summary', () => {
    beforeEach(() => {
      // Add some test data
      for (let i = 0; i < 5; i++) {
        metrics.startExecution(`exec-${i}`, 1);
        
        for (let s = 0; s < 10; s++) {
          metrics.recordStep(createStepTiming({
            stepIndex: s,
            label: `Step ${s}`,
            rowIndex: 0,
            duration: 100 + Math.random() * 100,
            success: Math.random() > 0.1,
          }));
        }

        metrics.recordRow(createRowTiming({
          rowIndex: 0,
          duration: 1000 + Math.random() * 500,
        }));

        metrics.endExecution(1, {
          rowsProcessed: 1,
          stepsExecuted: 10,
          stepsPassed: 9,
          stepsFailed: 1,
          stepsSkipped: 0,
          success: true,
          wasStopped: false,
        });
      }
    });

    it('should calculate performance summary', () => {
      const summary = metrics.getPerformanceSummary();

      expect(summary.totalExecutions).toBe(5);
      expect(summary.successfulExecutions).toBe(5);
      expect(summary.successRate).toBe(1);
      expect(summary.totalStepsExecuted).toBe(50);
    });

    it('should identify most failed step', () => {
      // Add some failures
      metrics.recordStep(createStepTiming({ label: 'Problematic', success: false }));
      metrics.recordStep(createStepTiming({ label: 'Problematic', success: false }));
      metrics.recordStep(createStepTiming({ label: 'Problematic', success: false }));

      const summary = metrics.getPerformanceSummary();

      expect(summary.mostFailedStep).toBeDefined();
      expect(summary.mostFailedStep!.label).toBe('Problematic');
    });

    it('should identify slowest step', () => {
      metrics.recordStep(createStepTiming({ label: 'Slow Step', duration: 5000 }));

      const summary = metrics.getPerformanceSummary();

      expect(summary.slowestStep).toBeDefined();
      expect(summary.slowestStep!.label).toBe('Slow Step');
    });
  });

  // ==========================================================================
  // RECENT METRICS TESTS
  // ==========================================================================

  describe('recent metrics', () => {
    it('should get recent success rate', () => {
      for (let i = 0; i < 5; i++) {
        metrics.startExecution(`exec-${i}`, 1);
        metrics.endExecution(1, {
          rowsProcessed: 1,
          stepsExecuted: 1,
          stepsPassed: i < 3 ? 1 : 0, // First 3 pass
          stepsFailed: i < 3 ? 0 : 1,
          stepsSkipped: 0,
          success: i < 3,
          wasStopped: false,
        });
      }

      const rate = metrics.getRecentSuccessRate(5);
      expect(rate).toBe(0.6); // 3/5
    });

    it('should get recent average step duration', () => {
      metrics.recordStep(createStepTiming({ duration: 100 }));
      metrics.recordStep(createStepTiming({ duration: 200 }));
      metrics.recordStep(createStepTiming({ duration: 300 }));

      const avg = metrics.getRecentAverageStepDuration(3);
      expect(avg).toBe(200);
    });
  });

  // ==========================================================================
  // EXPORT TESTS
  // ==========================================================================

  describe('export', () => {
    beforeEach(() => {
      metrics.recordStep(createStepTiming());
      metrics.startExecution('exec-1', 1);
      metrics.endExecution(1, {
        rowsProcessed: 1,
        stepsExecuted: 1,
        stepsPassed: 1,
        stepsFailed: 0,
        stepsSkipped: 0,
        success: true,
        wasStopped: false,
      });
    });

    it('should export to JSON', () => {
      const json = metrics.exportToJson();
      const parsed = JSON.parse(json);

      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.stepPerformances).toBeDefined();
    });

    it('should export step timings to CSV', () => {
      const csv = metrics.exportStepTimingsToCsv();

      expect(csv).toContain('stepIndex,label,rowIndex');
      expect(csv).toContain('"Test Step"');
    });

    it('should export execution timings to CSV', () => {
      const csv = metrics.exportExecutionTimingsToCsv();

      expect(csv).toContain('executionId,projectId');
      expect(csv).toContain('exec-1');
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit step_recorded event', () => {
      const listener = vi.fn();
      metrics.onEvent(listener);

      metrics.recordStep(createStepTiming());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'step_recorded' })
      );
    });

    it('should emit execution_recorded event', () => {
      const listener = vi.fn();
      metrics.onEvent(listener);

      metrics.startExecution('exec-1', 1);
      metrics.endExecution(1, {
        rowsProcessed: 0,
        stepsExecuted: 0,
        stepsPassed: 0,
        stepsFailed: 0,
        stepsSkipped: 0,
        success: false,
        wasStopped: false,
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'execution_recorded' })
      );
    });

    it('should unsubscribe from events', () => {
      const listener = vi.fn();
      const unsubscribe = metrics.onEvent(listener);

      unsubscribe();
      metrics.recordStep(createStepTiming());

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // MANAGEMENT TESTS
  // ==========================================================================

  describe('management', () => {
    it('should reset all metrics', () => {
      metrics.recordStep(createStepTiming());
      metrics.recordRow(createRowTiming());

      metrics.reset();

      const counts = metrics.getCounts();
      expect(counts.steps).toBe(0);
      expect(counts.rows).toBe(0);
      expect(counts.executions).toBe(0);
    });

    it('should enable/disable metrics', () => {
      metrics.disable();
      expect(metrics.isEnabled()).toBe(false);

      metrics.enable();
      expect(metrics.isEnabled()).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createOrchestratorMetrics', () => {
  it('should create instance', () => {
    const metrics = createOrchestratorMetrics({ maxStepTimings: 500 });
    expect(metrics).toBeInstanceOf(OrchestratorMetrics);
    expect(metrics.getConfig().maxStepTimings).toBe(500);
  });
});
