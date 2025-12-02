/**
 * Tests for ReplaySession
 * @module core/replay/ReplaySession.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ReplaySession,
  createReplaySession,
  createSingleRunSession,
  createDataDrivenSession,
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession,
  DEFAULT_SESSION_CONFIG,
  type RowExecutionResult,
  type SessionSummary,
  type SessionProgress,
} from './ReplaySession';
import type { Step } from '../types/Step';
import type { LocatorBundle } from '../locators/LocatorBundle';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'input',
    id: 'test-id',
    name: null,
    placeholder: null,
    aria: null,
    dataAttrs: {},
    text: '',
    visibleText: '',
    css: '',
    xpath: '/html/body/input',
    classes: [],
    pageUrl: 'http://test.com',
    bounding: { x: 100, y: 100, width: 100, height: 30 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

function createTestStep(overrides: Partial<Step> = {}): Step {
  return {
    id: '1',
    name: 'Test Step',
    event: 'input',
    path: '/html/body/input',
    value: 'default',
    label: 'Email',
    x: 100,
    y: 100,
    bundle: createTestBundle(),
    ...overrides,
  };
}

function createElement(
  tag: string,
  attrs: Record<string, string> = {}
): HTMLElement {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  document.body.appendChild(element);
  
  // Mock getBoundingClientRect for JSDOM
  element.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    top: 0,
    right: 100,
    bottom: 50,
    left: 0,
    toJSON: () => {},
  }));
  
  // Mock scrollIntoView for JSDOM
  element.scrollIntoView = vi.fn();
  
  return element;
}

function cleanupElements(): void {
  document.body.innerHTML = '';
}

// ============================================================================
// TESTS
// ============================================================================

describe('ReplaySession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearCurrentSession();
    cleanupElements();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    clearCurrentSession();
    cleanupElements();
  });
  
  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================
  
  describe('initialization', () => {
    it('should create session with steps', () => {
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      expect(session.getLifecycle()).toBe('idle');
    });
    
    it('should throw for empty steps', () => {
      expect(() => createReplaySession({ steps: [] })).toThrow('Steps are required');
    });
    
    it('should accept CSV data', () => {
      const steps = [createTestStep()];
      const csvData = [{ Email: 'test@example.com' }];
      
      const session = createReplaySession({ steps, csvData });
      
      expect(session.getLifecycle()).toBe('idle');
    });
  });
  
  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================
  
  describe('lifecycle', () => {
    it('should start in idle state', () => {
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      expect(session.isIdle()).toBe(true);
    });
    
    it('should transition to running on start', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      const promise = session.start();
      
      expect(session.isRunning()).toBe(true);
      
      await vi.runAllTimersAsync();
      await promise;
    });
    
    it('should transition to paused on pause', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      const promise = session.start();
      await vi.advanceTimersByTimeAsync(10);
      
      session.pause();
      
      expect(session.isPaused()).toBe(true);
      
      // Resume to finish
      session.resume();
      await vi.runAllTimersAsync();
      await promise;
    });
    
    it('should transition to stopped on stop', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      const promise = session.start();
      await vi.advanceTimersByTimeAsync(10);
      
      session.stop();
      
      expect(session.getLifecycle()).toBe('stopped');
      
      await promise;
    });
    
    it('should reset to idle', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      session.reset();
      
      expect(session.isIdle()).toBe(true);
    });
    
    it('should throw when starting from invalid state', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      const promise = session.start();
      
      await expect(session.start()).rejects.toThrow('Cannot start');
      
      await vi.runAllTimersAsync();
      await promise;
    });
  });
  
  // ==========================================================================
  // SINGLE RUN TESTS
  // ==========================================================================
  
  describe('single run (no CSV)', () => {
    it('should execute steps once', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createSingleRunSession(steps);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.totalRows).toBe(1);
      expect(summary.passedRows).toBe(1);
    });
    
    it('should use recorded values', async () => {
      const input = createElement('input', { id: 'test-id' }) as HTMLInputElement;
      const steps = [createTestStep({ value: 'recorded-value' })];
      const session = createSingleRunSession(steps);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(input.value).toBe('recorded-value');
    });
  });
  
  // ==========================================================================
  // CSV DATA TESTS
  // ==========================================================================
  
  describe('CSV data execution', () => {
    it('should execute once per CSV row', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [
        { Email: 'user1@test.com' },
        { Email: 'user2@test.com' },
        { Email: 'user3@test.com' },
      ];
      
      const session = createDataDrivenSession(steps, csvData);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.totalRows).toBe(3);
    });
    
    it('should inject CSV values into steps', async () => {
      const input = createElement('input', { id: 'test-id' }) as HTMLInputElement;
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [{ Email: 'csv@test.com' }];
      
      const session = createDataDrivenSession(steps, csvData);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(input.value).toBe('csv@test.com');
    });
    
    it('should use field mappings', async () => {
      const input = createElement('input', { id: 'test-id' }) as HTMLInputElement;
      const steps = [createTestStep({ label: 'Email Field' })];
      const csvData = [{ email_column: 'mapped@test.com' }];
      const fieldMappings = { email_column: 'Email Field' };
      
      const session = createDataDrivenSession(steps, csvData, fieldMappings);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(input.value).toBe('mapped@test.com');
    });
    
    it('should skip rows with no matching fields', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [
        { Email: 'user1@test.com' },
        { NoMatch: 'value' }, // Should be skipped
        { Email: 'user2@test.com' },
      ];
      
      const session = createDataDrivenSession(steps, csvData);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.skippedRows).toBe(1);
      expect(summary.passedRows).toBe(2);
    });
  });
  
  // ==========================================================================
  // PROGRESS TESTS
  // ==========================================================================
  
  describe('progress tracking', () => {
    it('should track row progress', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [
        { Email: 'user1@test.com' },
        { Email: 'user2@test.com' },
      ];
      
      const progressUpdates: SessionProgress[] = [];
      const session = createDataDrivenSession(steps, csvData);
      session.onProgress((p) => progressUpdates.push({ ...p }));
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].rowPercentage).toBe(100);
    });
    
    it('should provide current progress', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createSingleRunSession(steps);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      const progress = session.getProgress();
      expect(progress.rowPercentage).toBe(100);
    });
  });
  
  // ==========================================================================
  // EVENT CALLBACK TESTS
  // ==========================================================================
  
  describe('event callbacks', () => {
    it('should call onRowStart before each row', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [{ Email: 'test@test.com' }];
      
      const rowStarts: number[] = [];
      const session = createDataDrivenSession(steps, csvData);
      session.onRowStart((index) => rowStarts.push(index));
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(rowStarts).toContain(0);
    });
    
    it('should call onRowComplete after each row', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [{ Email: 'test@test.com' }];
      
      let rowResult: RowExecutionResult | null = null;
      const session = createDataDrivenSession(steps, csvData);
      session.onRowComplete((result) => { rowResult = result; });
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(rowResult).not.toBeNull();
      expect(rowResult!.rowIndex).toBe(0);
    });
    
    it('should call onComplete when finished', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      
      let summary: SessionSummary | null = null;
      const session = createSingleRunSession(steps);
      session.onComplete((s) => { summary = s; });
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      expect(summary).not.toBeNull();
      expect(summary!.success).toBe(true);
    });
  });
  
  // ==========================================================================
  // FAILURE HANDLING TESTS
  // ==========================================================================
  
  describe('failure handling', () => {
    it('should continue on row failure by default', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [
        { Email: 'user1@test.com' },
        { NoMatch: 'will-skip' },
        { Email: 'user2@test.com' },
      ];
      
      const session = createDataDrivenSession(steps, csvData);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.totalRows).toBe(3);
    });
    
    it('should stop on row failure when configured', async () => {
      const steps = [
        createTestStep({ bundle: createTestBundle({ id: 'nonexistent', tag: 'span', xpath: '//span[@id="nonexistent"]' }) }),
      ];
      const csvData = [
        { Email: 'user1@test.com' },
        { Email: 'user2@test.com' },
      ];
      
      const session = createReplaySession({
        steps,
        csvData,
        continueOnRowFailure: false,
        engineConfig: { execution: { findTimeout: 50 } },
      });
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.rowResults.length).toBe(1); // Stopped after first
    });
    
    it('should stop after max row failures', async () => {
      const steps = [
        createTestStep({ bundle: createTestBundle({ id: 'nonexistent', tag: 'span', xpath: '//span[@id="nonexistent"]' }) }),
      ];
      const csvData = [
        { Email: 'user1@test.com' },
        { Email: 'user2@test.com' },
        { Email: 'user3@test.com' },
      ];
      
      const session = createReplaySession({
        steps,
        csvData,
        continueOnRowFailure: true,
        maxRowFailures: 2,
        engineConfig: { execution: { findTimeout: 50 } },
      });
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.rowResults.length).toBe(2); // Stopped after 2 failures
    });
  });
  
  // ==========================================================================
  // RESULT TESTS
  // ==========================================================================
  
  describe('results', () => {
    it('should track row results', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep({ label: 'Email' })];
      const csvData = [
        { Email: 'user1@test.com' },
        { Email: 'user2@test.com' },
      ];
      
      const session = createDataDrivenSession(steps, csvData);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      await promise;
      
      const results = session.getRowResults();
      expect(results).toHaveLength(2);
    });
    
    it('should provide session summary', async () => {
      createElement('input', { id: 'test-id' });
      const steps = [createTestStep()];
      const session = createSingleRunSession(steps);
      
      const promise = session.start();
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.totalRows).toBe(1);
      expect(summary.totalSteps).toBe(1);
      expect(summary.startTime).toBeGreaterThan(0);
      expect(summary.endTime).toBeGreaterThan(summary.startTime);
    });
  });
});

// ============================================================================
// FACTORY AND SINGLETON TESTS
// ============================================================================

describe('factory and singleton', () => {
  beforeEach(() => {
    clearCurrentSession();
    cleanupElements();
  });
  
  afterEach(() => {
    clearCurrentSession();
    cleanupElements();
  });
  
  describe('createReplaySession', () => {
    it('should create session with config', () => {
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      expect(session.isIdle()).toBe(true);
    });
  });
  
  describe('createSingleRunSession', () => {
    it('should create session for single run', () => {
      const steps = [createTestStep()];
      const session = createSingleRunSession(steps);
      
      expect(session.isIdle()).toBe(true);
    });
  });
  
  describe('createDataDrivenSession', () => {
    it('should create session with CSV data', () => {
      const steps = [createTestStep()];
      const csvData = [{ Email: 'test@test.com' }];
      const session = createDataDrivenSession(steps, csvData);
      
      expect(session.isIdle()).toBe(true);
    });
  });
  
  describe('current session management', () => {
    it('should track current session', () => {
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      setCurrentSession(session);
      
      expect(getCurrentSession()).toBe(session);
    });
    
    it('should clear current session', () => {
      const steps = [createTestStep()];
      const session = createReplaySession({ steps });
      
      setCurrentSession(session);
      clearCurrentSession();
      
      expect(getCurrentSession()).toBeNull();
    });
  });
});
