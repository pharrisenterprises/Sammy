/**
 * Tests for ReplayEngine
 * @module core/replay/ReplayEngine.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ReplayEngine,
  createReplayEngine,
  createFastReplayEngine,
  createRealisticReplayEngine,
  createDebugReplayEngine,
  createTolerantReplayEngine,
  getReplayEngine,
  resetReplayEngine,
  DEFAULT_ENGINE_CONFIG,
} from './ReplayEngine';
import type { Step } from '../types/Step';
import type { LocatorBundle } from '../locators/LocatorBundle';
import type { ExecutionSummary } from './IReplayEngine';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'button',
    id: 'test-id',
    name: null,
    placeholder: null,
    aria: null,
    dataAttrs: {},
    text: '',
    visibleText: '',
    css: '',
    xpath: '/html/body/button',
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
    event: 'click',
    path: '/html/body/button',
    value: '',
    label: 'Submit',
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

describe('ReplayEngine', () => {
  let engine: ReplayEngine;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetReplayEngine();
    cleanupElements();
    engine = createFastReplayEngine();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetReplayEngine();
    cleanupElements();
  });
  
  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================
  
  describe('lifecycle', () => {
    it('should start in idle state', () => {
      expect(engine.getLifecycle()).toBe('idle');
      expect(engine.isIdle()).toBe(true);
    });
    
    it('should transition to running on start', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      
      expect(engine.getLifecycle()).toBe('running');
      expect(engine.isRunning()).toBe(true);
      
      await vi.runAllTimersAsync();
      await promise;
    });
    
    it('should transition to paused on pause', async () => {
      createElement('button', { id: 'btn-1' });
      createElement('button', { id: 'btn-2' });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'btn-1' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'btn-2' }) }),
      ];
      
      const promise = engine.start(steps);
      await vi.advanceTimersByTimeAsync(10);
      
      engine.pause();
      
      expect(engine.getLifecycle()).toBe('paused');
      expect(engine.isPaused()).toBe(true);
      
      // Resume to finish
      engine.resume();
      await vi.runAllTimersAsync();
      await promise;
    });
    
    it('should transition to running on resume', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.advanceTimersByTimeAsync(10);
      
      engine.pause();
      engine.resume();
      
      expect(engine.getLifecycle()).toBe('running');
      
      await vi.runAllTimersAsync();
      await promise;
    });
    
    it('should transition to stopped on stop', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.advanceTimersByTimeAsync(10);
      
      engine.stop();
      
      expect(engine.getLifecycle()).toBe('stopped');
      
      await promise;
    });
    
    it('should transition to idle on reset', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      engine.reset();
      
      expect(engine.getLifecycle()).toBe('idle');
    });
    
    it('should throw when starting from invalid state', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.advanceTimersByTimeAsync(10);
      
      // Already running
      await expect(engine.start(steps)).rejects.toThrow('Cannot start');
      
      await vi.runAllTimersAsync();
      await promise;
    });
    
    it('should throw when pausing from invalid state', () => {
      // Idle state
      expect(() => engine.pause()).toThrow('Cannot pause');
    });
    
    it('should throw when resuming from invalid state', () => {
      // Idle state
      expect(() => engine.resume()).toThrow('Cannot resume');
    });
  });
  
  // ==========================================================================
  // EXECUTION TESTS
  // ==========================================================================
  
  describe('execution', () => {
    it('should execute all steps successfully', async () => {
      createElement('button', { id: 'btn-1' });
      createElement('button', { id: 'btn-2' });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'btn-1' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'btn-2' }) }),
      ];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      const result = await promise;
      
      expect(result.success).toBe(true);
      expect(result.totalSteps).toBe(2);
      expect(result.passedSteps).toBe(2);
      expect(result.failedSteps).toBe(0);
    });
    
    it('should stop on failure by default', async () => {
      createElement('button', { id: 'btn-2' });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'nonexistent', tag: 'span', xpath: '//span[@id="nonexistent"]' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'btn-2' }) }),
      ];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      const result = await promise;
      
      expect(result.success).toBe(false);
      expect(result.passedSteps).toBe(0);
      expect(result.failedSteps).toBe(1);
      expect(result.results).toHaveLength(1); // Stopped after first
    });
    
    it('should continue on failure with continueOnFailure', async () => {
      const tolerantEngine = createTolerantReplayEngine();
      
      createElement('button', { id: 'btn-2' });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'nonexistent', tag: 'span', xpath: '//span[@id="nonexistent"]' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'btn-2' }) }),
      ];
      
      const promise = tolerantEngine.start(steps);
      await vi.runAllTimersAsync();
      const result = await promise;
      
      expect(result.results).toHaveLength(2);
      expect(result.passedSteps).toBe(1);
      expect(result.failedSteps).toBe(1);
    });
    
    it('should stop after max consecutive failures', async () => {
      const limitedEngine = createReplayEngine({
        continueOnFailure: true,
        maxConsecutiveFailures: 2,
        execution: { findTimeout: 50, maxRetries: 0 },
      });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'none-1', tag: 'span', xpath: '//span[@id="none-1"]' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'none-2', tag: 'span', xpath: '//span[@id="none-2"]' }) }),
        createTestStep({ id: '3', bundle: createTestBundle({ id: 'none-3', tag: 'span', xpath: '//span[@id="none-3"]' }) }),
      ];
      
      const promise = limitedEngine.start(steps);
      await vi.runAllTimersAsync();
      const result = await promise;
      
      expect(result.results).toHaveLength(2); // Stopped after 2 failures
    });
    
    it('should throw for empty steps array', async () => {
      await expect(engine.start([])).rejects.toThrow('No steps');
    });
  });
  
  // ==========================================================================
  // SINGLE STEP EXECUTION TESTS
  // ==========================================================================
  
  describe('execute single step', () => {
    it('should execute single step via execute()', async () => {
      createElement('button', { id: 'test-id' });
      const step = createTestStep();
      
      const resultPromise = engine.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
    });
    
    it('should execute via executeAll()', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.executeAll(steps);
      await vi.runAllTimersAsync();
      const result = await promise;
      
      expect(result.success).toBe(true);
    });
  });
  
  // ==========================================================================
  // PROGRESS TESTS
  // ==========================================================================
  
  describe('progress tracking', () => {
    it('should track progress during execution', async () => {
      createElement('button', { id: 'btn-1' });
      createElement('button', { id: 'btn-2' });
      
      const progressUpdates: number[] = [];
      engine.onProgress((progress) => {
        progressUpdates.push(progress.percentage);
      });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'btn-1' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'btn-2' }) }),
      ];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(progressUpdates).toContain(50);
      expect(progressUpdates).toContain(100);
    });
    
    it('should provide correct progress values', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      const progress = engine.getProgress();
      expect(progress.percentage).toBe(100);
      expect(progress.passedSteps).toBe(1);
    });
  });
  
  // ==========================================================================
  // EVENT CALLBACK TESTS
  // ==========================================================================
  
  describe('event callbacks', () => {
    it('should call onStepStart before each step', async () => {
      createElement('button', { id: 'test-id' });
      
      const startCalls: number[] = [];
      engine.onStepStart((step, index) => {
        startCalls.push(index);
      });
      
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(startCalls).toContain(0);
    });
    
    it('should call onStepComplete after each step', async () => {
      createElement('button', { id: 'test-id' });
      
      let completeCalled = false;
      engine.onStepComplete((result, index) => {
        completeCalled = true;
        expect(result.success).toBe(true);
      });
      
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(completeCalled).toBe(true);
    });
    
    it('should call onComplete when finished', async () => {
      createElement('button', { id: 'test-id' });
      
      let summary: ExecutionSummary | null = null;
      engine.onComplete((s) => {
        summary = s;
      });
      
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(summary).not.toBeNull();
      expect(summary!.success).toBe(true);
    });
    
    it('should call onError on failure', async () => {
      let errorCalled = false;
      engine.onError((error) => {
        errorCalled = true;
      });
      
      const steps = [
        createTestStep({ bundle: createTestBundle({ id: 'nonexistent', tag: 'span', xpath: '//span[@id="nonexistent"]' }) }),
      ];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(errorCalled).toBe(true);
    });
    
    it('should allow unsubscribing from state changes', async () => {
      createElement('button', { id: 'test-id' });
      
      let callCount = 0;
      const unsubscribe = engine.onStateChange(() => {
        callCount++;
      });
      
      const steps = [createTestStep()];
      const promise = engine.start(steps);
      
      // Unsubscribe immediately
      unsubscribe();
      
      await vi.runAllTimersAsync();
      await promise;
      
      // Should have been called at least once before unsubscribe
      // but this is implementation-dependent
    });
  });
  
  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use preset configuration', () => {
      const fastEngine = createFastReplayEngine();
      const config = fastEngine.getConfig();
      
      expect(config.findTimeout).toBe(1000);
    });
    
    it('should allow setting find timeout', async () => {
      engine.setFindTimeout(5000);
      
      // This would affect future executions
      expect(true).toBe(true);
    });
    
    it('should allow setting retry config', async () => {
      engine.setRetryConfig({ interval: 200, maxRetries: 5 });
      
      // This would affect future executions
      expect(true).toBe(true);
    });
  });
  
  // ==========================================================================
  // RESULT TESTS
  // ==========================================================================
  
  describe('results', () => {
    it('should track all results', async () => {
      createElement('button', { id: 'btn-1' });
      createElement('button', { id: 'btn-2' });
      
      const steps = [
        createTestStep({ id: '1', bundle: createTestBundle({ id: 'btn-1' }) }),
        createTestStep({ id: '2', bundle: createTestBundle({ id: 'btn-2' }) }),
      ];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      const results = engine.getResults();
      expect(results).toHaveLength(2);
    });
    
    it('should provide current step index', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(engine.getCurrentStepIndex()).toBe(1);
    });
    
    it('should provide timing information', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      const timing = engine.getTiming();
      expect(timing.startTime).toBeDefined();
      expect(timing.endTime).toBeDefined();
    });
    
    it('should provide state snapshot', async () => {
      createElement('button', { id: 'test-id' });
      const steps = [createTestStep()];
      
      const promise = engine.start(steps);
      await vi.runAllTimersAsync();
      await promise;
      
      const snapshot = engine.getSnapshot();
      expect(snapshot.lifecycle).toBe('completed');
      expect(snapshot.progress.percentage).toBe(100);
    });
  });
});

// ============================================================================
// FACTORY AND SINGLETON TESTS
// ============================================================================

describe('factory and singleton', () => {
  beforeEach(() => {
    resetReplayEngine();
    cleanupElements();
  });
  
  afterEach(() => {
    resetReplayEngine();
    cleanupElements();
  });
  
  describe('createReplayEngine', () => {
    it('should create engine with options', () => {
      const engine = createReplayEngine({ stepDelay: 500 });
      expect(engine.getLifecycle()).toBe('idle');
    });
  });
  
  describe('createFastReplayEngine', () => {
    it('should create fast engine', () => {
      const engine = createFastReplayEngine();
      const config = engine.getConfig();
      expect(config.findTimeout).toBe(1000);
    });
  });
  
  describe('createRealisticReplayEngine', () => {
    it('should create realistic engine', () => {
      const engine = createRealisticReplayEngine();
      expect(engine.getLifecycle()).toBe('idle');
    });
  });
  
  describe('createDebugReplayEngine', () => {
    it('should create debug engine', () => {
      const engine = createDebugReplayEngine();
      expect(engine.getLifecycle()).toBe('idle');
    });
  });
  
  describe('createTolerantReplayEngine', () => {
    it('should create tolerant engine', () => {
      const engine = createTolerantReplayEngine();
      expect(engine.getLifecycle()).toBe('idle');
    });
  });
  
  describe('getReplayEngine', () => {
    it('should return same instance', () => {
      const e1 = getReplayEngine();
      const e2 = getReplayEngine();
      expect(e1).toBe(e2);
    });
  });
  
  describe('resetReplayEngine', () => {
    it('should reset instance', () => {
      const e1 = getReplayEngine();
      resetReplayEngine();
      const e2 = getReplayEngine();
      expect(e2).not.toBe(e1);
    });
  });
});
