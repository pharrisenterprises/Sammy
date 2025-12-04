/**
 * Tests for LogCollector
 * @module core/orchestrator/LogCollector.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LogCollector,
  createLogCollector,
  getLogCollector,
  resetLogCollector,
  DEFAULT_LOG_COLLECTOR_CONFIG,
  type LogEntry,
  type LogLevel,
  type LogFilter,
  type LogCollectorConfig,
} from './LogCollector';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('LogCollector', () => {
  let collector: LogCollector;

  beforeEach(() => {
    collector = new LogCollector();
  });

  afterEach(() => {
    resetLogCollector();
  });

  describe('constructor', () => {
    it('should create empty collector', () => {
      expect(collector.getCount()).toBe(0);
      expect(collector.isEmpty()).toBe(true);
    });

    it('should apply default configuration', () => {
      const config = collector.getConfig();
      expect(config.maxLogs).toBe(DEFAULT_LOG_COLLECTOR_CONFIG.maxLogs);
      expect(config.includeTimestamp).toBe(true);
      expect(config.includeLevel).toBe(true);
    });

    it('should apply custom configuration', () => {
      const customCollector = new LogCollector({
        maxLogs: 100,
        includeDebug: true,
      });
      
      const config = customCollector.getConfig();
      expect(config.maxLogs).toBe(100);
      expect(config.includeDebug).toBe(true);
    });
  });

  // ==========================================================================
  // LOGGING METHODS TESTS
  // ==========================================================================

  describe('logging methods', () => {
    it('should add info log', () => {
      collector.info('Test message');
      
      const entries = collector.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('Test message');
    });

    it('should add success log', () => {
      collector.success('Success message');
      
      const entries = collector.getEntries();
      expect(entries[0].level).toBe('success');
    });

    it('should add error log', () => {
      collector.error('Error message');
      
      const entries = collector.getEntries();
      expect(entries[0].level).toBe('error');
    });

    it('should add warning log', () => {
      collector.warning('Warning message');
      
      const entries = collector.getEntries();
      expect(entries[0].level).toBe('warning');
    });

    it('should not add debug log by default', () => {
      collector.debug('Debug message');
      
      expect(collector.getCount()).toBe(0);
    });

    it('should add debug log when enabled', () => {
      const debugCollector = new LogCollector({ includeDebug: true });
      debugCollector.debug('Debug message');
      
      expect(debugCollector.getCount()).toBe(1);
      expect(debugCollector.getEntries()[0].level).toBe('debug');
    });

    it('should include context data', () => {
      collector.info('Step message', { stepIndex: 5, rowIndex: 2 });
      
      const entry = collector.getEntries()[0];
      expect(entry.stepIndex).toBe(5);
      expect(entry.rowIndex).toBe(2);
    });

    it('should include timestamp', () => {
      const before = new Date();
      collector.info('Test');
      const after = new Date();
      
      const entry = collector.getEntries()[0];
      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should format timestamp as HH:mm:ss', () => {
      collector.info('Test');
      
      const entry = collector.getEntries()[0];
      expect(entry.formattedTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  // ==========================================================================
  // CONVENIENCE METHODS TESTS
  // ==========================================================================

  describe('convenience logging methods', () => {
    it('should log step started', () => {
      collector.stepStarted(0, 'Click Login');
      
      const log = collector.toString();
      expect(log).toContain('Starting step 1');
      expect(log).toContain('Click Login');
    });

    it('should log step passed', () => {
      collector.stepPassed(0, 150);
      
      const log = collector.toString();
      expect(log).toContain('✓');
      expect(log).toContain('Step 1');
      expect(log).toContain('150ms');
    });

    it('should log step failed', () => {
      collector.stepFailed(2, 'Element not found');
      
      const log = collector.toString();
      expect(log).toContain('✗');
      expect(log).toContain('Step 3');
      expect(log).toContain('Element not found');
    });

    it('should log step skipped', () => {
      collector.stepSkipped(1, 'No CSV value');
      
      const log = collector.toString();
      expect(log).toContain('Step 2');
      expect(log).toContain('skipped');
    });

    it('should log row started', () => {
      collector.rowStarted(0, 10);
      
      const log = collector.toString();
      expect(log).toContain('row 1 of 10');
    });

    it('should log row completed', () => {
      collector.rowCompleted(0, 5, 2, 1);
      
      const log = collector.toString();
      expect(log).toContain('5 passed');
      expect(log).toContain('2 failed');
      expect(log).toContain('1 skipped');
    });

    it('should log execution started', () => {
      collector.executionStarted('My Project', 10, 5);
      
      const log = collector.toString();
      expect(log).toContain('My Project');
      expect(log).toContain('10 steps');
      expect(log).toContain('5 rows');
    });

    it('should log execution completed with success', () => {
      collector.executionCompleted(10, 0, 5000);
      
      const log = collector.toString();
      expect(log).toContain('SUCCESS');
      expect(log).toContain('10 passed');
      expect(log).toContain('0 failed');
    });

    it('should log execution completed with failure', () => {
      collector.executionCompleted(8, 2, 5000);
      
      const log = collector.toString();
      expect(log).toContain('FAILED');
      expect(log).toContain('2 failed');
    });

    it('should log execution stopped', () => {
      collector.executionStopped();
      
      const log = collector.toString();
      expect(log).toContain('stopped by user');
    });
  });

  // ==========================================================================
  // OUTPUT METHODS TESTS
  // ==========================================================================

  describe('output methods', () => {
    beforeEach(() => {
      collector.info('First message');
      collector.success('Second message');
      collector.error('Third message');
    });

    it('should output as string with newlines', () => {
      const output = collector.toString();
      const lines = output.split('\n');
      
      expect(lines.length).toBe(3);
    });

    it('should include timestamp in output', () => {
      const output = collector.toString();
      
      expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });

    it('should include level in output', () => {
      const output = collector.toString();
      
      expect(output).toContain('[INFO]');
      expect(output).toContain('[SUCCESS]');
      expect(output).toContain('[ERROR]');
    });

    it('should respect custom line separator', () => {
      const customCollector = new LogCollector({ lineSeparator: '|||' });
      customCollector.info('A');
      customCollector.info('B');
      
      const output = customCollector.toString();
      expect(output).toContain('|||');
      expect(output.split('|||').length).toBe(2);
    });

    it('should output without timestamp when disabled', () => {
      const noTimestamp = new LogCollector({ includeTimestamp: false });
      noTimestamp.info('Test');
      
      const output = noTimestamp.toString();
      expect(output).not.toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });

    it('should output without level when disabled', () => {
      const noLevel = new LogCollector({ includeLevel: false });
      noLevel.info('Test');
      
      const output = noLevel.toString();
      expect(output).not.toContain('[INFO]');
    });

    it('should return same result from toString and getLogsString', () => {
      expect(collector.toString()).toBe(collector.getLogsString());
    });
  });

  // ==========================================================================
  // FILTERING TESTS
  // ==========================================================================

  describe('filtering', () => {
    beforeEach(() => {
      collector.info('Info 1', { stepIndex: 0, rowIndex: 0 });
      collector.success('Success 1', { stepIndex: 1, rowIndex: 0 });
      collector.error('Error 1', { stepIndex: 2, rowIndex: 0 });
      collector.info('Info 2', { stepIndex: 0, rowIndex: 1 });
      collector.warning('Warning 1', { stepIndex: 1, rowIndex: 1 });
    });

    it('should filter by level', () => {
      const filter: LogFilter = { levels: ['error', 'warning'] };
      const filtered = collector.getFilteredEntries(filter);
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(e => e.level === 'error' || e.level === 'warning')).toBe(true);
    });

    it('should filter by step index', () => {
      const filtered = collector.getFilteredEntries({ stepIndex: 0 });
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(e => e.stepIndex === 0)).toBe(true);
    });

    it('should filter by row index', () => {
      const filtered = collector.getFilteredEntries({ rowIndex: 1 });
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(e => e.rowIndex === 1)).toBe(true);
    });

    it('should filter by search text', () => {
      const filtered = collector.getFilteredEntries({ search: 'Info' });
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(e => e.message.includes('Info'))).toBe(true);
    });

    it('should filter by search text case-insensitively', () => {
      const filtered = collector.getFilteredEntries({ search: 'info' });
      
      expect(filtered.length).toBe(2);
    });

    it('should get step logs', () => {
      const stepLogs = collector.getStepLogs(1);
      
      expect(stepLogs).toContain('Success 1');
      expect(stepLogs).toContain('Warning 1');
      expect(stepLogs).not.toContain('Info 1');
    });

    it('should get row logs', () => {
      const rowLogs = collector.getRowLogs(0);
      
      expect(rowLogs).toContain('Info 1');
      expect(rowLogs).toContain('Success 1');
      expect(rowLogs).not.toContain('Info 2');
    });

    it('should get error logs only', () => {
      const errorLogs = collector.getErrorLogs();
      
      expect(errorLogs).toContain('Error 1');
      expect(errorLogs).not.toContain('Info');
      expect(errorLogs).not.toContain('Warning');
    });

    it('should get problems logs (errors + warnings)', () => {
      const problems = collector.getProblemsLogs();
      
      expect(problems).toContain('Error 1');
      expect(problems).toContain('Warning 1');
      expect(problems).not.toContain('Info');
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    beforeEach(() => {
      collector.info('Info');
      collector.info('Info 2');
      collector.success('Success');
      collector.error('Error');
      collector.warning('Warning');
    });

    it('should count total logs', () => {
      const stats = collector.getStats();
      expect(stats.total).toBe(5);
    });

    it('should count logs by level', () => {
      const stats = collector.getStats();
      
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.success).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.byLevel.warning).toBe(1);
      expect(stats.byLevel.debug).toBe(0);
    });

    it('should track first and last timestamps', () => {
      const stats = collector.getStats();
      
      expect(stats.firstLogAt).toBeDefined();
      expect(stats.lastLogAt).toBeDefined();
      expect(stats.lastLogAt!.getTime()).toBeGreaterThanOrEqual(stats.firstLogAt!.getTime());
    });

    it('should get count by level', () => {
      expect(collector.getCount('info')).toBe(2);
      expect(collector.getCount('error')).toBe(1);
      expect(collector.getCount()).toBe(5);
    });

    it('should detect errors', () => {
      expect(collector.hasErrors()).toBe(true);
      
      const noErrors = new LogCollector();
      noErrors.info('OK');
      expect(noErrors.hasErrors()).toBe(false);
    });

    it('should detect warnings', () => {
      expect(collector.hasWarnings()).toBe(true);
      
      const noWarnings = new LogCollector();
      noWarnings.info('OK');
      expect(noWarnings.hasWarnings()).toBe(false);
    });
  });

  // ==========================================================================
  // MAX LOGS LIMIT TESTS
  // ==========================================================================

  describe('max logs limit', () => {
    it('should enforce max logs limit', () => {
      const limited = new LogCollector({ maxLogs: 5 });
      
      for (let i = 0; i < 10; i++) {
        limited.info(`Message ${i}`);
      }
      
      expect(limited.getCount()).toBe(5);
    });

    it('should keep newest logs when limit exceeded', () => {
      const limited = new LogCollector({ maxLogs: 3 });
      
      limited.info('First');
      limited.info('Second');
      limited.info('Third');
      limited.info('Fourth');
      limited.info('Fifth');
      
      const entries = limited.getEntries();
      expect(entries[0].message).toBe('Third');
      expect(entries[2].message).toBe('Fifth');
    });

    it('should allow unlimited logs when maxLogs is 0', () => {
      const unlimited = new LogCollector({ maxLogs: 0 });
      
      for (let i = 0; i < 100; i++) {
        unlimited.info(`Message ${i}`);
      }
      
      expect(unlimited.getCount()).toBe(100);
    });
  });

  // ==========================================================================
  // EVENT LISTENER TESTS
  // ==========================================================================

  describe('event listeners', () => {
    it('should notify listeners on new log', () => {
      const listener = vi.fn();
      collector.onLog(listener);
      
      collector.info('Test message');
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].message).toBe('Test message');
    });

    it('should unsubscribe with returned function', () => {
      const listener = vi.fn();
      const unsubscribe = collector.onLog(listener);
      
      collector.info('Before');
      unsubscribe();
      collector.info('After');
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe with offLog', () => {
      const listener = vi.fn();
      collector.onLog(listener);
      collector.offLog(listener);
      
      collector.info('Test');
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      
      collector.onLog(badListener);
      collector.onLog(goodListener);
      
      expect(() => collector.info('Test')).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // MANAGEMENT TESTS
  // ==========================================================================

  describe('management', () => {
    it('should clear all logs', () => {
      collector.info('Test 1');
      collector.info('Test 2');
      
      collector.clear();
      
      expect(collector.getCount()).toBe(0);
      expect(collector.isEmpty()).toBe(true);
    });

    it('should get last N entries', () => {
      for (let i = 0; i < 10; i++) {
        collector.info(`Message ${i}`);
      }
      
      const last3 = collector.getLastEntries(3);
      
      expect(last3.length).toBe(3);
      expect(last3[0].message).toBe('Message 7');
      expect(last3[2].message).toBe('Message 9');
    });

    it('should get last N entries as string', () => {
      collector.info('A');
      collector.info('B');
      collector.info('C');
      
      const lastLogs = collector.getLastLogsString(2);
      
      expect(lastLogs).toContain('B');
      expect(lastLogs).toContain('C');
      expect(lastLogs).not.toContain('A');
    });

    it('should update configuration', () => {
      collector.updateConfig({ includeDebug: true });
      
      expect(collector.getConfig().includeDebug).toBe(true);
    });

    it('should clone collector with entries', () => {
      collector.info('Test');
      collector.error('Error');
      
      const cloned = collector.clone();
      
      expect(cloned.getCount()).toBe(2);
      expect(cloned.toString()).toBe(collector.toString());
      
      // Verify independence
      cloned.info('New');
      expect(cloned.getCount()).toBe(3);
      expect(collector.getCount()).toBe(2);
    });
  });

  // ==========================================================================
  // FACTORY AND SINGLETON TESTS
  // ==========================================================================

  describe('factory and singleton', () => {
    it('should create collector with factory', () => {
      const created = createLogCollector({ maxLogs: 50 });
      
      expect(created).toBeInstanceOf(LogCollector);
      expect(created.getConfig().maxLogs).toBe(50);
    });

    it('should get global singleton', () => {
      const global1 = getLogCollector();
      const global2 = getLogCollector();
      
      expect(global1).toBe(global2);
    });

    it('should reset global singleton', () => {
      const global1 = getLogCollector();
      global1.info('Test');
      
      resetLogCollector();
      const global2 = getLogCollector();
      
      expect(global2).not.toBe(global1);
      expect(global2.getCount()).toBe(0);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty message', () => {
      collector.info('');
      
      expect(collector.getCount()).toBe(1);
      expect(collector.getEntries()[0].message).toBe('');
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(10000);
      collector.info(longMessage);
      
      expect(collector.getEntries()[0].message.length).toBe(10000);
    });

    it('should handle special characters', () => {
      collector.info('Test\nwith\nnewlines');
      collector.info('Test with "quotes" and \'apostrophes\'');
      
      expect(collector.getCount()).toBe(2);
    });

    it('should handle unicode characters', () => {
      collector.info('Test with emoji 🎉 and unicode: 日本語');
      
      const entry = collector.getEntries()[0];
      expect(entry.message).toContain('🎉');
      expect(entry.message).toContain('日本語');
    });

    it('should handle rapid logging', () => {
      for (let i = 0; i < 1000; i++) {
        collector.info(`Rapid ${i}`);
      }
      
      expect(collector.getCount()).toBe(1000);
    });

    it('should maintain entry order', () => {
      collector.info('First');
      collector.info('Second');
      collector.info('Third');
      
      const entries = collector.getEntries();
      expect(entries[0].message).toBe('First');
      expect(entries[1].message).toBe('Second');
      expect(entries[2].message).toBe('Third');
    });
  });
});
