/**
 * Tests for BackgroundMetrics
 * @module background/BackgroundMetrics.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BackgroundMetrics,
  createBackgroundMetrics,
  getBackgroundMetrics,
  resetBackgroundMetrics,
  DEFAULT_METRICS_CONFIG,
  type MetricsEvent,
  type OperationStats,
} from './BackgroundMetrics';

// ============================================================================
// TESTS
// ============================================================================

describe('BackgroundMetrics', () => {
  let metrics: BackgroundMetrics;

  beforeEach(() => {
    metrics = new BackgroundMetrics({ snapshotInterval: 0 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    metrics.destroy();
    resetBackgroundMetrics();
  });

  // ==========================================================================
  // OPERATION TRACKING TESTS
  // ==========================================================================

  describe('operation tracking', () => {
    it('should track operation timing', () => {
      const timer = metrics.startOperation('test_action');
      timer.success();

      const stats = metrics.getOperationStats('test_action');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.successCount).toBe(1);
    });

    it('should track operation errors', () => {
      const timer = metrics.startOperation('test_action');
      timer.error(new Error('Test error'));

      const stats = metrics.getOperationStats('test_action');
      expect(stats?.errorCount).toBe(1);
      expect(stats?.successCount).toBe(0);
    });

    it('should calculate average duration', () => {
      // Simulate multiple operations
      for (let i = 0; i < 3; i++) {
        const timer = metrics.startOperation('test_action');
        timer.success();
      }

      const stats = metrics.getOperationStats('test_action');
      expect(stats?.count).toBe(3);
      expect(stats?.avgDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track min/max duration', () => {
      const timer1 = metrics.startOperation('test_action');
      timer1.success();

      const timer2 = metrics.startOperation('test_action');
      timer2.success();

      const stats = metrics.getOperationStats('test_action');
      expect(stats?.minDuration).toBeLessThanOrEqual(stats?.maxDuration ?? 0);
    });

    it('should track active operations', () => {
      const timer1 = metrics.startOperation('action1');
      const timer2 = metrics.startOperation('action2');

      expect(metrics.getActiveOperationCount()).toBe(2);

      timer1.success();
      expect(metrics.getActiveOperationCount()).toBe(1);

      timer2.success();
      expect(metrics.getActiveOperationCount()).toBe(0);
    });
  });

  // ==========================================================================
  // MESSAGE TRACKING TESTS
  // ==========================================================================

  describe('message tracking', () => {
    it('should count received messages', () => {
      metrics.recordMessageReceived('action1');
      metrics.recordMessageReceived('action2');

      const counters = metrics.getMessageCounters();
      expect(counters.received).toBe(2);
    });

    it('should track errors separately', () => {
      metrics.recordError('test_action', new Error('Test'));

      const counters = metrics.getMessageCounters();
      expect(counters.errors).toBe(1);
    });

    it('should track processed count from operations', () => {
      const timer = metrics.startOperation('test');
      timer.success();

      const counters = metrics.getMessageCounters();
      expect(counters.processed).toBe(1);
    });
  });

  // ==========================================================================
  // HEALTH CALCULATION TESTS
  // ==========================================================================

  describe('health calculation', () => {
    it('should return 100 when no operations', () => {
      expect(metrics.calculateHealthScore()).toBe(100);
    });

    it('should return high score with no errors', () => {
      for (let i = 0; i < 10; i++) {
        const timer = metrics.startOperation('test');
        timer.success();
      }

      expect(metrics.calculateHealthScore()).toBeGreaterThanOrEqual(75);
    });

    it('should lower score with errors', () => {
      // Generate 20% error rate
      for (let i = 0; i < 8; i++) {
        const timer = metrics.startOperation('test');
        timer.success();
      }
      for (let i = 0; i < 2; i++) {
        const timer = metrics.startOperation('test');
        timer.error(new Error('Fail'));
      }

      const score = metrics.calculateHealthScore();
      expect(score).toBeLessThan(100);
    });

    it('should include warnings in snapshot', () => {
      // Generate high error rate
      for (let i = 0; i < 5; i++) {
        const timer = metrics.startOperation('test');
        timer.success();
      }
      for (let i = 0; i < 5; i++) {
        const timer = metrics.startOperation('test');
        timer.error(new Error('Fail'));
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.health.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SNAPSHOT TESTS
  // ==========================================================================

  describe('snapshot', () => {
    it('should create complete snapshot', () => {
      const timer = metrics.startOperation('test');
      timer.success();

      const snapshot = metrics.getSnapshot();

      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.messages).toBeDefined();
      expect(snapshot.health).toBeDefined();
      expect(snapshot.resources).toBeDefined();
      expect(snapshot.operations).toBeDefined();
    });

    it('should include timing entries', () => {
      const timer = metrics.startOperation('test');
      timer.success();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.recentTimings.length).toBe(1);
    });

    it('should include error entries', () => {
      metrics.recordError('test', new Error('Test error'));

      const snapshot = metrics.getSnapshot();
      expect(snapshot.errors.length).toBe(1);
    });

    it('should export as JSON-serializable', () => {
      const timer = metrics.startOperation('test');
      timer.success();

      const exported = metrics.exportSnapshot();
      const json = JSON.stringify(exported);
      const parsed = JSON.parse(json);

      expect(parsed.timestamp).toBeDefined();
      expect(parsed.messages).toBeDefined();
    });
  });

  // ==========================================================================
  // RESOURCE TRACKING TESTS
  // ==========================================================================

  describe('resource tracking', () => {
    it('should track tab count', () => {
      metrics.setTrackedTabsCount(5);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.resources.trackedTabsCount).toBe(5);
    });

    it('should track pending messages', () => {
      metrics.setPendingMessagesCount(3);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.resources.pendingMessages).toBe(3);
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit operation events', () => {
      const events: MetricsEvent[] = [];
      metrics.onEvent(e => events.push(e));

      const timer = metrics.startOperation('test');
      timer.success();

      expect(events.some(e => e.type === 'operation_start')).toBe(true);
      expect(events.some(e => e.type === 'operation_complete')).toBe(true);
    });

    it('should emit error events', () => {
      const events: MetricsEvent[] = [];
      metrics.onEvent(e => events.push(e));

      const timer = metrics.startOperation('test');
      timer.error(new Error('Fail'));

      expect(events.some(e => e.type === 'operation_error')).toBe(true);
    });

    it('should unsubscribe from events', () => {
      const events: MetricsEvent[] = [];
      const unsubscribe = metrics.onEvent(e => events.push(e));

      unsubscribe();

      const timer = metrics.startOperation('test');
      timer.success();

      expect(events.length).toBe(0);
    });
  });

  // ==========================================================================
  // LIMIT TESTS
  // ==========================================================================

  describe('entry limits', () => {
    it('should limit timing entries', () => {
      const limitedMetrics = new BackgroundMetrics({
        maxTimingEntries: 5,
        snapshotInterval: 0,
      });

      for (let i = 0; i < 10; i++) {
        const timer = limitedMetrics.startOperation('test');
        timer.success();
      }

      const snapshot = limitedMetrics.getSnapshot();
      expect(snapshot.recentTimings.length).toBe(5);

      limitedMetrics.destroy();
    });

    it('should limit error entries', () => {
      const limitedMetrics = new BackgroundMetrics({
        maxErrorEntries: 3,
        snapshotInterval: 0,
      });

      for (let i = 0; i < 5; i++) {
        limitedMetrics.recordError('test', new Error(`Error ${i}`));
      }

      const errors = limitedMetrics.getRecentErrors(10);
      expect(errors.length).toBe(3);

      limitedMetrics.destroy();
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('configuration', () => {
    it('should use default config', () => {
      const config = metrics.getConfig();
      expect(config.enabled).toBe(DEFAULT_METRICS_CONFIG.enabled);
    });

    it('should disable tracking when disabled', () => {
      const disabledMetrics = new BackgroundMetrics({
        enabled: false,
        snapshotInterval: 0,
      });

      const timer = disabledMetrics.startOperation('test');
      timer.success();

      const stats = disabledMetrics.getOperationStats('test');
      expect(stats).toBeUndefined();

      disabledMetrics.destroy();
    });
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should reset all data', () => {
      const timer = metrics.startOperation('test');
      timer.success();

      metrics.reset();

      const counters = metrics.getMessageCounters();
      expect(counters.processed).toBe(0);
      expect(metrics.getTrackedOperations().length).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createBackgroundMetrics', () => {
  afterEach(() => {
    resetBackgroundMetrics();
  });

  it('should create instance', () => {
    const metrics = createBackgroundMetrics({ snapshotInterval: 0 });
    expect(metrics).toBeInstanceOf(BackgroundMetrics);
    metrics.destroy();
  });
});

describe('getBackgroundMetrics', () => {
  afterEach(() => {
    resetBackgroundMetrics();
  });

  it('should return singleton', () => {
    const metrics1 = getBackgroundMetrics({ snapshotInterval: 0 });
    const metrics2 = getBackgroundMetrics();

    expect(metrics1).toBe(metrics2);
  });

  it('should reset singleton', () => {
    const metrics1 = getBackgroundMetrics({ snapshotInterval: 0 });
    resetBackgroundMetrics();
    const metrics2 = getBackgroundMetrics({ snapshotInterval: 0 });

    expect(metrics1).not.toBe(metrics2);
  });
});
