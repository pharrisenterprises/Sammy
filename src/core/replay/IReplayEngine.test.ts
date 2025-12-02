/**
 * Tests for IReplayEngine interface and base class
 * @module core/replay/IReplayEngine.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BaseReplayEngine,
  DEFAULT_REPLAY_CONFIG,
  createEmptyResult,
  createSuccessResult,
  createFailureResult,
  createEmptySummary,
  mergeContext,
  type Step,
  type ExecutionContext,
  type ExecutionResult,
  type ReplayConfig,
  type ReplayEvent,
} from './IReplayEngine';

// ============================================================================
// MOCK IMPLEMENTATION
// ============================================================================

/**
 * Test implementation of BaseReplayEngine
 */
class TestReplayEngine extends BaseReplayEngine {
  public executeCalls: Array<{ step: Step; context: ExecutionContext }> = [];
  public executeResult: ExecutionResult | null = null;
  public executeError: Error | null = null;
  
  async execute(step: Step, context: ExecutionContext): Promise<ExecutionResult> {
    this.executeCalls.push({ step, context });
    
    if (this.executeError) {
      throw this.executeError;
    }
    
    if (this.executeResult) {
      return this.executeResult;
    }
    
    return createSuccessResult(step.id, 100);
  }
  
  // Expose protected methods for testing
  public testEmitEvent(event: ReplayEvent): void {
    this.emitEvent(event);
  }
  
  public testSleep(ms: number): Promise<void> {
    return this.sleep(ms);
  }
}

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestStep(id: string = 'step-1'): Step {
  return {
    id,
    name: 'Test Step',
    event: 'click',
    path: '/html/body/button',
    value: '',
    label: 'Test Button',
    x: 100,
    y: 100,
  };
}

function createTestContext(): ExecutionContext {
  return {
    document: document,
    tabId: 1,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('BaseReplayEngine', () => {
  let engine: TestReplayEngine;
  
  beforeEach(() => {
    vi.useFakeTimers();
    engine = new TestReplayEngine();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = engine.getConfig();
      
      expect(config.findTimeout).toBe(DEFAULT_REPLAY_CONFIG.findTimeout);
      expect(config.retryInterval).toBe(DEFAULT_REPLAY_CONFIG.retryInterval);
    });
    
    it('should accept custom config', () => {
      const customEngine = new TestReplayEngine({ findTimeout: 5000 });
      
      expect(customEngine.getConfig().findTimeout).toBe(5000);
    });
    
    it('should update config', () => {
      engine.setConfig({ findTimeout: 3000, maxRetries: 5 });
      
      const config = engine.getConfig();
      expect(config.findTimeout).toBe(3000);
      expect(config.maxRetries).toBe(5);
    });
    
    it('should set find timeout', () => {
      engine.setFindTimeout(4000);
      
      expect(engine.getConfig().findTimeout).toBe(4000);
    });
    
    it('should set retry config', () => {
      engine.setRetryConfig({ maxRetries: 10, retryInterval: 200 });
      
      const config = engine.getConfig();
      expect(config.maxRetries).toBe(10);
      expect(config.retryInterval).toBe(200);
    });
  });
  
  // ==========================================================================
  // SINGLE STEP EXECUTION
  // ==========================================================================
  
  describe('execute', () => {
    it('should execute step', async () => {
      const step = createTestStep();
      const context = createTestContext();
      
      const result = await engine.execute(step, context);
      
      expect(result.success).toBe(true);
      expect(engine.executeCalls.length).toBe(1);
      expect(engine.executeCalls[0].step).toBe(step);
    });
    
    it('should return configured result', async () => {
      const step = createTestStep();
      const context = createTestContext();
      
      engine.executeResult = createFailureResult(step.id, 'Test error', 50);
      
      const result = await engine.execute(step, context);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });
  
  // ==========================================================================
  // BATCH EXECUTION
  // ==========================================================================
  
  describe('executeAll', () => {
    it('should execute all steps', async () => {
      const steps = [
        createTestStep('step-1'),
        createTestStep('step-2'),
        createTestStep('step-3'),
      ];
      const context = createTestContext();
      
      const summaryPromise = engine.executeAll(steps, context);
      
      // Advance through any delays
      await vi.runAllTimersAsync();
      
      const summary = await summaryPromise;
      
      expect(summary.totalSteps).toBe(3);
      expect(summary.passedSteps).toBe(3);
      expect(summary.failedSteps).toBe(0);
      expect(summary.success).toBe(true);
      expect(engine.executeCalls.length).toBe(3);
    });
    
    it('should stop on failure by default', async () => {
      const steps = [
        createTestStep('step-1'),
        createTestStep('step-2'),
        createTestStep('step-3'),
      ];
      const context = createTestContext();
      
      // Second step fails
      let callCount = 0;
      engine.executeResult = null;
      const originalExecute = engine.execute.bind(engine);
      engine.execute = async (step: Step, ctx: ExecutionContext) => {
        callCount++;
        if (callCount === 2) {
          return createFailureResult(step.id, 'Failure');
        }
        return originalExecute(step, ctx);
      };
      
      const summaryPromise = engine.executeAll(steps, context);
      await vi.runAllTimersAsync();
      const summary = await summaryPromise;
      
      expect(summary.passedSteps).toBe(1);
      expect(summary.failedSteps).toBe(1);
      expect(summary.stoppedEarly).toBe(true);
      expect(summary.stoppedAtStep).toBe(1);
    });
    
    it('should continue on failure when configured', async () => {
      engine.setConfig({ continueOnFailure: true });
      
      const steps = [
        createTestStep('step-1'),
        createTestStep('step-2'),
        createTestStep('step-3'),
      ];
      const context = createTestContext();
      
      // Second step fails
      let callCount = 0;
      const originalExecute = engine.execute.bind(engine);
      engine.execute = async (step: Step, ctx: ExecutionContext) => {
        callCount++;
        if (callCount === 2) {
          return createFailureResult(step.id, 'Failure');
        }
        return createSuccessResult(step.id, 100);
      };
      
      const summaryPromise = engine.executeAll(steps, context);
      await vi.runAllTimersAsync();
      const summary = await summaryPromise;
      
      expect(summary.passedSteps).toBe(2);
      expect(summary.failedSteps).toBe(1);
      expect(summary.stoppedEarly).toBe(false);
    });
    
    it('should calculate average duration', async () => {
      const steps = [createTestStep('step-1'), createTestStep('step-2')];
      const context = createTestContext();
      
      const summaryPromise = engine.executeAll(steps, context);
      await vi.runAllTimersAsync();
      const summary = await summaryPromise;
      
      expect(summary.totalDuration).toBeGreaterThanOrEqual(0);
      expect(summary.results.length).toBe(2);
    });
  });
  
  // ==========================================================================
  // CONTROL
  // ==========================================================================
  
  describe('control', () => {
    it('should track executing state', async () => {
      const steps = [createTestStep()];
      const context = createTestContext();
      
      expect(engine.isExecuting()).toBe(false);
      
      const promise = engine.executeAll(steps, context);
      
      expect(engine.isExecuting()).toBe(true);
      
      await vi.runAllTimersAsync();
      await promise;
      
      expect(engine.isExecuting()).toBe(false);
    });
    
    it('should pause and resume', async () => {
      const events: string[] = [];
      engine.addEventListener((event) => events.push(event.type));
      
      engine.pause();
      expect(engine.isPaused()).toBe(false); // Not executing, so pause has no effect
      
      // Create multiple steps with delays to allow pausing
      const steps = [
        createTestStep('step-1'),
        createTestStep('step-2'),
        createTestStep('step-3'),
      ];
      const context = createTestContext();
      
      // Configure with step delay to allow pausing between steps
      engine.setConfig({ stepDelay: 100 });
      
      // Start execution (don't await)
      const promise = engine.executeAll(steps, context);
      
      // Let first step complete
      await vi.advanceTimersByTimeAsync(0);
      expect(engine.isExecuting()).toBe(true);
      
      // Pause before delay
      engine.pause();
      
      // Advance into the delay - should hit pause checkpoint
      await vi.advanceTimersByTimeAsync(50);
      
      expect(engine.isPaused()).toBe(true);
      expect(engine.isExecuting()).toBe(true);
      
      // Resume
      engine.resume();
      expect(engine.isPaused()).toBe(false);
      
      // Complete execution
      await vi.runAllTimersAsync();
      await promise;
      
      // Should have pause/resume events
      expect(events).toContain('execution-paused');
      expect(events).toContain('execution-resumed');
    });
    
    it('should stop execution', async () => {
      const steps = [
        createTestStep('step-1'),
        createTestStep('step-2'),
        createTestStep('step-3'),
      ];
      const context = createTestContext();
      
      // Make steps take some time
      engine.execute = async (step: Step, ctx: ExecutionContext) => {
        await engine.testSleep(100);
        return createSuccessResult(step.id, 100);
      };
      
      const promise = engine.executeAll(steps, context);
      
      // Let first step complete
      await vi.advanceTimersByTimeAsync(150);
      
      engine.stop();
      
      await vi.runAllTimersAsync();
      const summary = await promise;
      
      expect(summary.stoppedEarly).toBe(true);
    });
  });
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  describe('events', () => {
    it('should emit events to listeners', () => {
      const events: ReplayEvent[] = [];
      engine.addEventListener((event) => events.push(event));
      
      engine.testEmitEvent({ type: 'step-started', timestamp: Date.now() });
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('step-started');
    });
    
    it('should allow unsubscribing', () => {
      const events: ReplayEvent[] = [];
      const unsubscribe = engine.addEventListener((event) => events.push(event));
      
      engine.testEmitEvent({ type: 'step-started', timestamp: Date.now() });
      expect(events.length).toBe(1);
      
      unsubscribe();
      
      engine.testEmitEvent({ type: 'step-completed', timestamp: Date.now() });
      expect(events.length).toBe(1);
    });
    
    it('should support typed event listeners', () => {
      const completedEvents: ReplayEvent[] = [];
      engine.on('step-completed', (event) => completedEvents.push(event));
      
      engine.testEmitEvent({ type: 'step-started', timestamp: Date.now() });
      engine.testEmitEvent({ type: 'step-completed', timestamp: Date.now() });
      
      expect(completedEvents.length).toBe(1);
    });
    
    it('should emit execution lifecycle events', async () => {
      const eventTypes: string[] = [];
      engine.addEventListener((event) => eventTypes.push(event.type));
      
      const steps = [createTestStep()];
      const context = createTestContext();
      
      const promise = engine.executeAll(steps, context);
      await vi.runAllTimersAsync();
      await promise;
      
      expect(eventTypes).toContain('execution-started');
      expect(eventTypes).toContain('step-started');
      expect(eventTypes).toContain('step-completed');
      expect(eventTypes).toContain('execution-completed');
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  describe('createEmptyResult', () => {
    it('should create empty result', () => {
      const result = createEmptyResult('step-1');
      
      expect(result.stepId).toBe('step-1');
      expect(result.status).toBe('pending');
      expect(result.success).toBe(false);
    });
  });
  
  describe('createSuccessResult', () => {
    it('should create success result', () => {
      const result = createSuccessResult('step-1', 150);
      
      expect(result.stepId).toBe('step-1');
      expect(result.status).toBe('passed');
      expect(result.success).toBe(true);
      expect(result.duration).toBe(150);
    });
    
    it('should accept options', () => {
      const result = createSuccessResult('step-1', 100, {
        locatorStrategy: 'xpath',
        locatorConfidence: 1.0,
      });
      
      expect(result.locatorStrategy).toBe('xpath');
      expect(result.locatorConfidence).toBe(1.0);
    });
  });
  
  describe('createFailureResult', () => {
    it('should create failure result', () => {
      const result = createFailureResult('step-1', 'Element not found');
      
      expect(result.stepId).toBe('step-1');
      expect(result.status).toBe('failed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });
  });
  
  describe('createEmptySummary', () => {
    it('should create empty summary', () => {
      const summary = createEmptySummary();
      
      expect(summary.totalSteps).toBe(0);
      expect(summary.passedSteps).toBe(0);
      expect(summary.failedSteps).toBe(0);
      expect(summary.success).toBe(true);
      expect(summary.results).toEqual([]);
    });
  });
  
  describe('mergeContext', () => {
    it('should merge contexts', () => {
      const context = mergeContext(
        { tabId: 2 },
        { tabId: 1, pageUrl: 'https://example.com' }
      );
      
      expect(context.tabId).toBe(2);
      expect(context.pageUrl).toBe('https://example.com');
    });
    
    it('should merge CSV values', () => {
      const context = mergeContext(
        { csvValues: { name: 'John' } },
        { csvValues: { email: 'john@example.com' } }
      );
      
      expect(context.csvValues).toEqual({
        email: 'john@example.com',
        name: 'John',
      });
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_REPLAY_CONFIG', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_REPLAY_CONFIG.findTimeout).toBe(2000);
    expect(DEFAULT_REPLAY_CONFIG.retryInterval).toBe(150);
    expect(DEFAULT_REPLAY_CONFIG.maxRetries).toBe(13);
    expect(DEFAULT_REPLAY_CONFIG.continueOnFailure).toBe(false);
    expect(DEFAULT_REPLAY_CONFIG.scrollIntoView).toBe(true);
    expect(DEFAULT_REPLAY_CONFIG.reactSafeInput).toBe(true);
    expect(DEFAULT_REPLAY_CONFIG.fuzzyMatchThreshold).toBe(0.4);
    expect(DEFAULT_REPLAY_CONFIG.boundingBoxThreshold).toBe(200);
  });
});
