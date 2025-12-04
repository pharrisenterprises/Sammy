/**
 * Tests for ProgressTracker
 * @module core/orchestrator/ProgressTracker.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProgressTracker,
  createProgressTracker,
  DEFAULT_PROGRESS_TRACKER_CONFIG,
  type TrackedStep,
  type TrackedRow,
  type ProgressSnapshot,
  type ProgressEvent,
  type ProgressTrackerConfig,
} from './ProgressTracker';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  afterEach(() => {
    tracker?.dispose();
  });

  describe('constructor', () => {
    it('should create tracker with correct dimensions', () => {
      tracker = new ProgressTracker(5, 10);
      const snapshot = tracker.getSnapshot();
      
      expect(snapshot.totalRows).toBe(5);
      expect(snapshot.stepsPerRow).toBe(10);
      expect(snapshot.totalSteps).toBe(50);
    });

    it('should initialize all rows with pending status', () => {
      tracker = new ProgressTracker(3, 5);
      const rows = tracker.getRows();
      
      expect(rows.length).toBe(3);
      rows.forEach(row => {
        expect(row.status).toBe('pending');
        expect(row.steps.length).toBe(5);
        row.steps.forEach(step => {
          expect(step.status).toBe('pending');
        });
      });
    });

    it('should handle minimum values', () => {
      tracker = new ProgressTracker(0, 0);
      const snapshot = tracker.getSnapshot();
      
      expect(snapshot.totalRows).toBe(1); // Minimum 1 row
      expect(snapshot.stepsPerRow).toBe(0);
    });

    it('should apply custom configuration', () => {
      const config: Partial<ProgressTrackerConfig> = {
        updateInterval: 1000,
        includeSkippedInProgress: true,
      };
      
      tracker = new ProgressTracker(1, 1, config);
      const trackerConfig = tracker.getConfig();
      
      expect(trackerConfig.updateInterval).toBe(1000);
      expect(trackerConfig.includeSkippedInProgress).toBe(true);
    });
  });

  // ==========================================================================
  // EXECUTION LIFECYCLE TESTS
  // ==========================================================================

  describe('execution lifecycle', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(2, 3, { updateInterval: 0 });
    });

    it('should track execution start', () => {
      tracker.startExecution();
      const snapshot = tracker.getSnapshot();
      
      expect(snapshot.isRunning).toBe(true);
      expect(snapshot.isPaused).toBe(false);
      expect(snapshot.startedAt).toBeDefined();
    });

    it('should track execution completion', () => {
      tracker.startExecution();
      tracker.completeExecution();
      const snapshot = tracker.getSnapshot();
      
      expect(snapshot.isRunning).toBe(false);
    });

    it('should track execution stop', () => {
      tracker.startExecution();
      tracker.stopExecution();
      
      expect(tracker.getIsRunning()).toBe(false);
    });

    it('should track pause and resume', () => {
      tracker.startExecution();
      
      tracker.pauseExecution();
      expect(tracker.getIsPaused()).toBe(true);
      
      tracker.resumeExecution();
      expect(tracker.getIsPaused()).toBe(false);
    });

    it('should not pause if not running', () => {
      tracker.pauseExecution();
      expect(tracker.getIsPaused()).toBe(false);
    });

    it('should reset all state', () => {
      tracker.startExecution();
      tracker.startRow(0);
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      
      tracker.reset();
      const snapshot = tracker.getSnapshot();
      
      expect(snapshot.isRunning).toBe(false);
      expect(snapshot.completedSteps).toBe(0);
      expect(snapshot.currentRowIndex).toBe(-1);
    });
  });

  // ==========================================================================
  // ROW TRACKING TESTS
  // ==========================================================================

  describe('row tracking', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(3, 5, { updateInterval: 0 });
      tracker.startExecution();
    });

    it('should start row with running status', () => {
      tracker.startRow(0, 'Row-001');
      const row = tracker.getRow(0);
      
      expect(row?.status).toBe('running');
      expect(row?.identifier).toBe('Row-001');
      expect(row?.startedAt).toBeDefined();
    });

    it('should complete row with correct status (all passed)', () => {
      tracker.startRow(0);
      
      // Complete all steps as passed
      for (let i = 0; i < 5; i++) {
        tracker.startStep(i);
        tracker.completeStep(i, 'passed', 100);
      }
      
      tracker.completeRow(0);
      const row = tracker.getRow(0);
      
      expect(row?.status).toBe('completed');
      expect(row?.passedSteps).toBe(5);
    });

    it('should complete row with failed status (has failures)', () => {
      tracker.startRow(0);
      
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      tracker.startStep(1);
      tracker.completeStep(1, 'failed', 100, 'Element not found');
      
      tracker.completeRow(0);
      const row = tracker.getRow(0);
      
      expect(row?.status).toBe('failed');
      expect(row?.failedSteps).toBe(1);
    });

    it('should track row duration', () => {
      tracker.startRow(0);
      
      // Simulate some time passing
      const row = tracker.getRow(0);
      const startTime = row?.startedAt;
      
      tracker.completeRow(0);
      
      expect(row?.completedAt).toBeDefined();
      expect(row?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should reset steps when starting a new row iteration', () => {
      tracker.startRow(0);
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      
      // Start row again (second iteration)
      tracker.startRow(0);
      const row = tracker.getRow(0);
      
      expect(row?.passedSteps).toBe(0);
      expect(row?.steps[0].status).toBe('pending');
    });
  });

  // ==========================================================================
  // STEP TRACKING TESTS
  // ==========================================================================

  describe('step tracking', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(2, 5, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
    });

    it('should start step with running status', () => {
      tracker.startStep(0, { id: 1, name: 'Click Login' });
      const step = tracker.getCurrentStep();
      
      expect(step?.status).toBe('running');
      expect(step?.name).toBe('Click Login');
      expect(step?.startedAt).toBeDefined();
    });

    it('should complete step with passed status', () => {
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 150);
      
      const row = tracker.getRow(0);
      expect(row?.steps[0].status).toBe('passed');
      expect(row?.steps[0].duration).toBe(150);
      expect(row?.passedSteps).toBe(1);
    });

    it('should complete step with failed status', () => {
      tracker.startStep(0);
      tracker.completeStep(0, 'failed', 200, 'Timeout');
      
      const row = tracker.getRow(0);
      expect(row?.steps[0].status).toBe('failed');
      expect(row?.steps[0].errorMessage).toBe('Timeout');
      expect(row?.failedSteps).toBe(1);
    });

    it('should complete step with skipped status', () => {
      tracker.startStep(0);
      tracker.completeStep(0, 'skipped');
      
      const row = tracker.getRow(0);
      expect(row?.steps[0].status).toBe('skipped');
      expect(row?.skippedSteps).toBe(1);
    });

    it('should initialize step metadata', () => {
      tracker.initializeStep(2, { id: 'step-3', name: 'Fill Form' });
      
      const row = tracker.getRow(0);
      expect(row?.steps[2].id).toBe('step-3');
      expect(row?.steps[2].name).toBe('Fill Form');
    });

    it('should bulk initialize steps', () => {
      const stepMeta = [
        { id: 1, name: 'Step One' },
        { id: 2, name: 'Step Two' },
        { id: 3, name: 'Step Three' },
      ];
      
      tracker.initializeSteps(stepMeta);
      const row = tracker.getRow(0);
      
      expect(row?.steps[0].name).toBe('Step One');
      expect(row?.steps[1].name).toBe('Step Two');
      expect(row?.steps[2].name).toBe('Step Three');
    });
  });

  // ==========================================================================
  // PROGRESS CALCULATION TESTS
  // ==========================================================================

  describe('progress calculation', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(2, 5, { updateInterval: 0 }); // 10 total steps
      tracker.startExecution();
    });

    it('should calculate 0% at start', () => {
      expect(tracker.getPercentage()).toBe(0);
    });

    it('should calculate correct percentage (passed + failed)', () => {
      tracker.startRow(0);
      
      // 2 passed + 1 failed = 3/10 = 30%
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      tracker.startStep(1);
      tracker.completeStep(1, 'passed', 100);
      tracker.startStep(2);
      tracker.completeStep(2, 'failed', 100);
      
      expect(tracker.getPercentage()).toBe(30);
    });

    it('should not include skipped in progress by default', () => {
      tracker.startRow(0);
      
      // 1 passed + 1 skipped = 1/10 = 10% (skipped not counted)
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      tracker.startStep(1);
      tracker.completeStep(1, 'skipped');
      
      expect(tracker.getPercentage()).toBe(10);
    });

    it('should include skipped when configured', () => {
      tracker.dispose();
      tracker = new ProgressTracker(2, 5, { 
        updateInterval: 0,
        includeSkippedInProgress: true 
      });
      tracker.startExecution();
      tracker.startRow(0);
      
      // 1 passed + 1 skipped = 2/10 = 20%
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      tracker.startStep(1);
      tracker.completeStep(1, 'skipped');
      
      expect(tracker.getPercentage()).toBe(20);
    });

    it('should reach 100% when all steps complete', () => {
      // Complete all steps in both rows
      for (let row = 0; row < 2; row++) {
        tracker.startRow(row);
        for (let step = 0; step < 5; step++) {
          tracker.startStep(step);
          tracker.completeStep(step, 'passed', 100);
        }
        tracker.completeRow(row);
      }
      
      expect(tracker.getPercentage()).toBe(100);
    });

    it('should count completed rows', () => {
      tracker.startRow(0);
      for (let step = 0; step < 5; step++) {
        tracker.startStep(step);
        tracker.completeStep(step, 'passed', 100);
      }
      tracker.completeRow(0);
      
      const snapshot = tracker.getSnapshot();
      expect(snapshot.completedRows).toBe(1);
    });
  });

  // ==========================================================================
  // TIME ESTIMATION TESTS
  // ==========================================================================

  describe('time estimation', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(1, 10, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
    });

    it('should calculate average step duration', () => {
      // Complete 3 steps with durations 100, 200, 300
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      tracker.startStep(1);
      tracker.completeStep(1, 'passed', 200);
      tracker.startStep(2);
      tracker.completeStep(2, 'passed', 300);
      
      const snapshot = tracker.getSnapshot();
      expect(snapshot.averageStepDuration).toBe(200); // (100+200+300)/3
    });

    it('should estimate remaining time', () => {
      // Complete 3 steps, 7 remaining
      // Average 100ms per step → 700ms remaining
      for (let i = 0; i < 3; i++) {
        tracker.startStep(i);
        tracker.completeStep(i, 'passed', 100);
      }
      
      const snapshot = tracker.getSnapshot();
      expect(snapshot.estimatedTimeRemaining).toBe(700);
    });

    it('should track elapsed time', async () => {
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const snapshot = tracker.getSnapshot();
      expect(snapshot.elapsedTime).toBeGreaterThanOrEqual(40);
    });

    it('should exclude paused time from elapsed', async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      
      tracker.pauseExecution();
      await new Promise(resolve => setTimeout(resolve, 50)); // Paused for 50ms
      tracker.resumeExecution();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const snapshot = tracker.getSnapshot();
      // Total ~90ms but paused for ~50ms, so elapsed should be ~40ms
      expect(snapshot.elapsedTime).toBeLessThan(80);
    });
  });

  // ==========================================================================
  // EVENT SYSTEM TESTS
  // ==========================================================================

  describe('event system', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(2, 3, { updateInterval: 0 });
    });

    it('should emit execution_started event', () => {
      const listener = vi.fn();
      tracker.on('execution_started', listener);
      
      tracker.startExecution();
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe('execution_started');
    });

    it('should emit row_started event', () => {
      const listener = vi.fn();
      tracker.on('row_started', listener);
      
      tracker.startExecution();
      tracker.startRow(0);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].row?.index).toBe(0);
    });

    it('should emit step_started event', () => {
      const listener = vi.fn();
      tracker.on('step_started', listener);
      
      tracker.startExecution();
      tracker.startRow(0);
      tracker.startStep(0, { id: 1, name: 'Test Step' });
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].step?.name).toBe('Test Step');
    });

    it('should emit step_completed event', () => {
      const listener = vi.fn();
      tracker.on('step_completed', listener);
      
      tracker.startExecution();
      tracker.startRow(0);
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].step?.status).toBe('passed');
    });

    it('should emit to wildcard listeners', () => {
      const listener = vi.fn();
      tracker.on('*', listener);
      
      tracker.startExecution();
      tracker.startRow(0);
      
      expect(listener).toHaveBeenCalledTimes(2); // started + row_started
    });

    it('should unsubscribe with returned function', () => {
      const listener = vi.fn();
      const unsubscribe = tracker.on('execution_started', listener);
      
      unsubscribe();
      tracker.startExecution();
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should unsubscribe with off()', () => {
      const listener = vi.fn();
      tracker.on('execution_started', listener);
      tracker.off('execution_started', listener);
      
      tracker.startExecution();
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should include snapshot in events', () => {
      const listener = vi.fn();
      tracker.on('execution_started', listener);
      
      tracker.startExecution();
      
      const event = listener.mock.calls[0][0] as ProgressEvent;
      expect(event.snapshot).toBeDefined();
      expect(event.snapshot.isRunning).toBe(true);
    });
  });

  // ==========================================================================
  // PERIODIC UPDATE TESTS
  // ==========================================================================

  describe('periodic updates', () => {
    it('should emit progress_update at interval', async () => {
      tracker = new ProgressTracker(1, 5, { updateInterval: 50 });
      const listener = vi.fn();
      tracker.on('progress_update', listener);
      
      tracker.startExecution();
      
      await new Promise(resolve => setTimeout(resolve, 120));
      
      tracker.dispose();
      
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should not emit updates when paused', async () => {
      tracker = new ProgressTracker(1, 5, { updateInterval: 30 });
      const listener = vi.fn();
      tracker.on('progress_update', listener);
      
      tracker.startExecution();
      tracker.pauseExecution();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      tracker.dispose();
      
      // Should have 0 updates while paused
      expect(listener).not.toHaveBeenCalled();
    });

    it('should stop updates on dispose', async () => {
      tracker = new ProgressTracker(1, 5, { updateInterval: 20 });
      const listener = vi.fn();
      tracker.on('progress_update', listener);
      
      tracker.startExecution();
      tracker.dispose();
      
      const countAfterDispose = listener.mock.calls.length;
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(listener.mock.calls.length).toBe(countAfterDispose);
    });
  });

  // ==========================================================================
  // GETTER TESTS
  // ==========================================================================

  describe('getters', () => {
    beforeEach(() => {
      tracker = new ProgressTracker(3, 5, { updateInterval: 0 });
      tracker.startExecution();
    });

    it('should get all rows', () => {
      const rows = tracker.getRows();
      expect(rows.length).toBe(3);
    });

    it('should get specific row', () => {
      const row = tracker.getRow(1);
      expect(row?.index).toBe(1);
    });

    it('should return undefined for invalid row index', () => {
      expect(tracker.getRow(-1)).toBeUndefined();
      expect(tracker.getRow(99)).toBeUndefined();
    });

    it('should get current row', () => {
      expect(tracker.getCurrentRow()).toBeUndefined();
      
      tracker.startRow(1);
      expect(tracker.getCurrentRow()?.index).toBe(1);
    });

    it('should get current step', () => {
      expect(tracker.getCurrentStep()).toBeUndefined();
      
      tracker.startRow(0);
      tracker.startStep(2);
      expect(tracker.getCurrentStep()?.index).toBe(2);
    });

    it('should get current row steps', () => {
      tracker.startRow(0);
      const steps = tracker.getCurrentRowSteps();
      
      expect(steps.length).toBe(5);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTION TEST
  // ==========================================================================

  describe('createProgressTracker', () => {
    it('should create ProgressTracker instance', () => {
      tracker = createProgressTracker(2, 5);
      expect(tracker).toBeInstanceOf(ProgressTracker);
    });

    it('should accept configuration', () => {
      tracker = createProgressTracker(2, 5, { updateInterval: 1000 });
      expect(tracker.getConfig().updateInterval).toBe(1000);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle step operations without starting row', () => {
      tracker = new ProgressTracker(2, 5, { updateInterval: 0 });
      tracker.startExecution();
      
      // Should not throw
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      
      // No row started, so no progress
      expect(tracker.getPercentage()).toBe(0);
    });

    it('should handle invalid step indices', () => {
      tracker = new ProgressTracker(1, 3, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
      
      // Should not throw
      tracker.startStep(-1);
      tracker.startStep(99);
      tracker.completeStep(-1, 'passed', 100);
      tracker.completeStep(99, 'passed', 100);
      
      expect(tracker.getSnapshot().passedSteps).toBe(0);
    });

    it('should handle updateStepStatus for status changes', () => {
      tracker = new ProgressTracker(1, 3, { updateInterval: 0 });
      tracker.startExecution();
      tracker.startRow(0);
      
      tracker.startStep(0);
      tracker.completeStep(0, 'passed', 100);
      
      // Change status from passed to failed
      tracker.updateStepStatus(0, 0, 'failed', 100, 'Changed');
      
      const row = tracker.getRow(0);
      expect(row?.passedSteps).toBe(0);
      expect(row?.failedSteps).toBe(1);
    });

    it('should handle listener errors gracefully', () => {
      tracker = new ProgressTracker(1, 3, { updateInterval: 0 });
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      
      tracker.on('execution_started', errorListener);
      tracker.on('execution_started', goodListener);
      
      // Should not throw, and good listener should still be called
      expect(() => tracker.startExecution()).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });
  });
});
