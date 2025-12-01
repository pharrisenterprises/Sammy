/**
 * ReplayController Test Suite
 * @module core/replay/ReplayController.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ReplayController,
  createReplayController,
  DEFAULT_REPLAY_OPTIONS,
  STATE_TRANSITIONS,
  type StepExecutor,
  type ReplayProgress,
} from './ReplayController';
import type { RecordedStep } from '../types/step';
import type { StepResult } from '../types/replay';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockStep(overrides: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Test Step',
    type: 'click',
    event: 'click',
    path: '/html/body/button',
    value: '',
    label: 'Test Button',
    x: 100,
    y: 100,
    timestamp: Date.now(),
    target: {
      tagName: 'button',
      xpath: '/html/body/button',
      cssSelector: 'button',
    },
    ...overrides,
  };
}

function createMockSteps(count: number): RecordedStep[] {
  return Array.from({ length: count }, (_, i) =>
    createMockStep({ id: `step-${i}` })
  );
}

function createSuccessExecutor(): StepExecutor {
  return async () => ({
    success: true,
    duration: 50,
    elementFound: true,
  });
}

function createFailingExecutor(failAfter: number = 0): StepExecutor {
  let callCount = 0;
  return async () => {
    callCount++;
    if (callCount > failAfter) {
      return {
        success: false,
        duration: 50,
        elementFound: false,
        error: new Error('Element not found'),
      };
    }
    return {
      success: true,
      duration: 50,
      elementFound: true,
    };
  };
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('ReplayController constants', () => {
  it('should have default replay options', () => {
    expect(DEFAULT_REPLAY_OPTIONS.stepTimeout).toBe(30000);
    expect(DEFAULT_REPLAY_OPTIONS.retryAttempts).toBe(3);
    expect(DEFAULT_REPLAY_OPTIONS.continueOnFailure).toBe(false);
  });
  
  it('should have valid state transitions', () => {
    expect(STATE_TRANSITIONS.idle).toContain('running');
    expect(STATE_TRANSITIONS.running).toContain('paused');
    expect(STATE_TRANSITIONS.running).toContain('completed');
    expect(STATE_TRANSITIONS.paused).toContain('running');
  });
});

// ============================================================================
// LIFECYCLE TESTS
// ============================================================================

describe('ReplayController lifecycle', () => {
  let controller: ReplayController;
  
  beforeEach(() => {
    controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
    });
  });
  
  afterEach(async () => {
    await controller.destroy();
  });
  
  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(controller.state).toBe('idle');
      expect(controller.isIdle).toBe(true);
      expect(controller.isRunning).toBe(false);
    });
    
    it('should have no session', () => {
      expect(controller.session).toBeNull();
    });
    
    it('should have default options', () => {
      expect(controller.options.stepTimeout).toBe(30000);
      expect(controller.options.retryAttempts).toBe(3);
    });
  });
  
  describe('start()', () => {
    it('should start replay', async () => {
      const steps = createMockSteps(3);
      const result = await controller.start(steps);
      
      expect(result.success).toBe(true);
      expect(result.totalSteps).toBe(3);
      expect(result.passedSteps).toBe(3);
    });
    
    it('should create session', async () => {
      const steps = createMockSteps(2);
      let capturedTestCaseId: string | undefined;
      
      // Check session during execution
      controller = createReplayController({
        stepExecutor: async () => {
          capturedTestCaseId = controller.session?.testCaseId;
          return { success: true, duration: 10, elementFound: true };
        },
      });
      
      await controller.start(steps, {
        testCaseId: 'test-1',
        testCaseName: 'My Test',
      });
      
      expect(capturedTestCaseId).toBe('test-1');
    });
    
    it('should throw on empty steps', async () => {
      await expect(controller.start([])).rejects.toThrow('No steps');
    });
    
    it('should throw when already running', async () => {
      const steps = createMockSteps(10);
      
      // Start but don't await
      const promise = controller.start(steps);
      
      // Try to start again
      await expect(controller.start(steps)).rejects.toThrow(/Cannot start/);
      
      await promise;
    });
  });
  
  describe('stop()', () => {
    it('should stop replay', async () => {
      const steps = createMockSteps(100);
      
      // Start with slow executor
      controller = createReplayController({
        stepExecutor: async () => {
          await new Promise(r => setTimeout(r, 100));
          return { success: true, duration: 100, elementFound: true };
        },
      });
      
      const promise = controller.start(steps);
      
      // Stop after short delay
      await new Promise(r => setTimeout(r, 50));
      await controller.stop();
      
      expect(controller.state).toBe('idle');
      
      // Wait for start to complete (it will be cancelled)
      await promise.catch(() => {});
    });
  });
  
  describe('pause() and resume()', () => {
    it('should pause and resume replay', async () => {
      const steps = createMockSteps(10);
      let stepCount = 0;
      
      controller = createReplayController({
        stepExecutor: async () => {
          stepCount++;
          await new Promise(r => setTimeout(r, 20));
          return { success: true, duration: 20, elementFound: true };
        },
      });
      
      const promise = controller.start(steps);
      
      // Pause after a bit
      await new Promise(r => setTimeout(r, 100));
      await controller.pause();
      
      expect(controller.state).toBe('paused');
      expect(controller.isPaused).toBe(true);
      
      const stepsAtPause = stepCount;
      
      // Wait and verify no more steps executed
      await new Promise(r => setTimeout(r, 100));
      expect(stepCount).toBe(stepsAtPause);
      
      // Resume
      await controller.resume();
      expect(controller.state).toBe('running');
      
      await promise;
      expect(stepCount).toBe(10);
    });
  });
  
  describe('stepOnce()', () => {
    it('should execute single step when paused', async () => {
      const steps = createMockSteps(3);
      
      controller = createReplayController({
        stepExecutor: createSuccessExecutor(),
      });
      
      // Start and immediately pause
      const promise = controller.start(steps);
      await controller.pause();
      
      // Step once
      const result = await controller.stepOnce();
      
      expect(result).not.toBeNull();
      expect(result?.status).toBe('passed');
      
      // Resume to complete
      await controller.resume();
      await promise;
    });
    
    it('should throw when not paused', async () => {
      await expect(controller.stepOnce()).rejects.toThrow(/paused/);
    });
  });
});

// ============================================================================
// STEP EXECUTION TESTS
// ============================================================================

describe('ReplayController step execution', () => {
  describe('successful execution', () => {
    it('should execute all steps', async () => {
      const steps = createMockSteps(5);
      const executedSteps: string[] = [];
      
      const controller = createReplayController({
        stepExecutor: async (step) => {
          executedSteps.push(step.id);
          return { success: true, duration: 10, elementFound: true };
        },
      });
      
      const result = await controller.start(steps);
      
      expect(result.success).toBe(true);
      expect(executedSteps).toHaveLength(5);
      expect(result.passedSteps).toBe(5);
      expect(result.failedSteps).toBe(0);
      
      await controller.destroy();
    });
    
    it('should track step results', async () => {
      const steps = createMockSteps(3);
      
      const controller = createReplayController({
        stepExecutor: async () => ({
          success: true,
          duration: 50,
          elementFound: true,
          locatorUsed: 'button',
        }),
      });
      
      await controller.start(steps);
      
      const results = controller.getStepResults();
      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('passed');
      expect(results[0].locatorUsed).toBe('button');
      
      await controller.destroy();
    });
  });
  
  describe('failed execution', () => {
    it('should stop on failure by default', async () => {
      const steps = createMockSteps(5);
      
      const controller = createReplayController({
        stepExecutor: createFailingExecutor(2), // Fail after 2 steps
        options: { retryAttempts: 1 }, // No retries for faster test
      });
      
      const result = await controller.start(steps);
      
      expect(result.success).toBe(false);
      expect(result.passedSteps).toBe(2);
      expect(result.failedSteps).toBe(1);
      
      await controller.destroy();
    });
    
    it('should continue on failure when configured', async () => {
      const steps = createMockSteps(5);
      
      const controller = createReplayController({
        stepExecutor: createFailingExecutor(2),
        options: {
          continueOnFailure: true,
          retryAttempts: 1,
        },
      });
      
      const result = await controller.start(steps);
      
      expect(result.success).toBe(false);
      expect(result.passedSteps).toBe(2);
      expect(result.failedSteps).toBe(3);
      expect(result.totalSteps).toBe(5);
      
      await controller.destroy();
    });
  });
  
  describe('retries', () => {
    it('should retry failed steps', async () => {
      const steps = createMockSteps(1);
      let attempts = 0;
      
      const controller = createReplayController({
        stepExecutor: async () => {
          attempts++;
          if (attempts < 3) {
            return { success: false, duration: 10, elementFound: false, error: new Error('fail') };
          }
          return { success: true, duration: 10, elementFound: true };
        },
        options: { retryAttempts: 3, retryDelay: 10 },
      });
      
      const result = await controller.start(steps);
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
      
      await controller.destroy();
    });
    
    it('should respect max retry attempts', async () => {
      const steps = createMockSteps(1);
      let attempts = 0;
      
      const controller = createReplayController({
        stepExecutor: async () => {
          attempts++;
          return { success: false, duration: 10, elementFound: false, error: new Error('fail') };
        },
        options: { retryAttempts: 2, retryDelay: 10 },
      });
      
      const result = await controller.start(steps);
      
      expect(result.success).toBe(false);
      expect(attempts).toBe(2);
      
      await controller.destroy();
    });
  });
});

// ============================================================================
// PROGRESS TESTS
// ============================================================================

describe('ReplayController progress', () => {
  it('should report progress', async () => {
    const steps = createMockSteps(5);
    const progressUpdates: ReplayProgress[] = [];
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
      onProgress: (progress) => progressUpdates.push({ ...progress }),
    });
    
    await controller.start(steps);
    
    expect(progressUpdates.length).toBeGreaterThan(0);
    
    // Final progress should be 100%
    const finalProgress = progressUpdates[progressUpdates.length - 1];
    expect(finalProgress.percentage).toBe(100);
    expect(finalProgress.completedSteps).toBe(5);
    
    await controller.destroy();
  });
  
  it('should calculate estimated remaining time', async () => {
    const steps = createMockSteps(10);
    let capturedProgress: ReplayProgress | null = null;
    
    const controller = createReplayController({
      stepExecutor: async () => {
        await new Promise(r => setTimeout(r, 10));
        return { success: true, duration: 10, elementFound: true };
      },
      onProgress: (progress) => {
        if (progress.currentStepIndex === 5) {
          capturedProgress = { ...progress };
        }
      },
    });
    
    await controller.start(steps);
    
    expect(capturedProgress).not.toBeNull();
    expect(capturedProgress!.estimatedRemaining).toBeGreaterThan(0);
    
    await controller.destroy();
  });
});

// ============================================================================
// BREAKPOINT TESTS
// ============================================================================

describe('ReplayController breakpoints', () => {
  it.skip('should pause at breakpoint', async () => {
    const steps = createMockSteps(5);
    let pausedAtIndex = -1;
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
      options: { waitBetweenSteps: 0 },
      onStateChange: (state) => {
        if (state === 'paused') {
          pausedAtIndex = controller.progress.currentStepIndex;
        }
      },
    });
    
    // Add breakpoint at step 2
    controller.addBreakpoint({ stepIndex: 2, enabled: true });
    
    const promise = controller.start(steps);
    
    // Wait for pause
    await new Promise(r => setTimeout(r, 100));
    
    // Should have paused at step 2
    expect(controller.state).toBe('paused');
    expect(pausedAtIndex).toBe(2);
    
    // Resume to complete
    await controller.resume();
    await promise;
    
    await controller.destroy();
  });
  
  it.skip('should support conditional breakpoints', async () => {
    const steps = createMockSteps(5);
    steps[3].type = 'input'; // Make step 3 an input
    let pausedAtIndex = -1;
    let pausedStep: RecordedStep | undefined;
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
      options: { waitBetweenSteps: 0 },
      onStateChange: (state) => {
        if (state === 'paused') {
          pausedAtIndex = controller.progress.currentStepIndex;
          pausedStep = controller.progress.currentStep;
        }
      },
    });
    
    // Break on input steps
    controller.addBreakpoint({
      condition: (step) => step.type === 'input',
      enabled: true,
    });
    
    const promise = controller.start(steps);
    
    await new Promise(r => setTimeout(r, 200));
    
    expect(controller.state).toBe('paused');
    expect(pausedAtIndex).toBe(3);
    expect(pausedStep?.type).toBe('input');
    
    await controller.resume();
    await promise;
    
    await controller.destroy();
  });
  
  it('should disable breakpoints', async () => {
    const steps = createMockSteps(5);
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
    });
    
    const bpId = controller.addBreakpoint({ stepIndex: 2, enabled: true });
    controller.setBreakpointEnabled(bpId, false);
    
    const result = await controller.start(steps);
    
    // Should complete without pausing
    expect(result.success).toBe(true);
    expect(result.passedSteps).toBe(5);
    
    await controller.destroy();
  });
});

// ============================================================================
// CALLBACK TESTS
// ============================================================================

describe('ReplayController callbacks', () => {
  it('should call onStepComplete', async () => {
    const steps = createMockSteps(3);
    const completedSteps: StepResult[] = [];
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
      onStepComplete: (result) => completedSteps.push(result),
    });
    
    await controller.start(steps);
    
    expect(completedSteps).toHaveLength(3);
    
    await controller.destroy();
  });
  
  it('should call onStateChange', async () => {
    const steps = createMockSteps(2);
    const stateChanges: Array<{ state: string; prevState: string }> = [];
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
      onStateChange: (state, prevState) => stateChanges.push({ state, prevState }),
    });
    
    await controller.start(steps);
    
    expect(stateChanges.some(c => c.state === 'running' && c.prevState === 'idle')).toBe(true);
    expect(stateChanges.some(c => c.state === 'completed')).toBe(true);
    
    await controller.destroy();
  });
  
  it('should call onComplete', async () => {
    const steps = createMockSteps(2);
    let completionResult: any = null;
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
      onComplete: (result) => { completionResult = result; },
    });
    
    await controller.start(steps);
    
    expect(completionResult).not.toBeNull();
    expect(completionResult.success).toBe(true);
    
    await controller.destroy();
  });
  
  it('should call onError on failure', async () => {
    const steps = createMockSteps(2);
    const errors: Error[] = [];
    
    const controller = createReplayController({
      stepExecutor: async () => ({
        success: false,
        duration: 10,
        elementFound: false,
        error: new Error('Test error'),
      }),
      options: { retryAttempts: 1 },
      onError: (error) => errors.push(error),
    });
    
    await controller.start(steps);
    
    expect(errors.length).toBeGreaterThan(0);
    
    await controller.destroy();
  });
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

describe('ReplayController statistics', () => {
  it('should track replay statistics', async () => {
    const steps = createMockSteps(3);
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
    });
    
    await controller.start(steps);
    
    const stats = controller.getStats();
    expect(stats.replaysStarted).toBe(1);
    expect(stats.replaysCompleted).toBe(1);
    expect(stats.stepsPassed).toBe(3);
    
    await controller.destroy();
  });
  
  it('should track failed replays', async () => {
    const steps = createMockSteps(3);
    
    const controller = createReplayController({
      stepExecutor: createFailingExecutor(1),
      options: { retryAttempts: 1 },
    });
    
    await controller.start(steps);
    
    const stats = controller.getStats();
    expect(stats.replaysFailed).toBe(1);
    expect(stats.stepsFailed).toBeGreaterThan(0);
    
    await controller.destroy();
  });
  
  it('should reset statistics', async () => {
    const steps = createMockSteps(2);
    
    const controller = createReplayController({
      stepExecutor: createSuccessExecutor(),
    });
    
    await controller.start(steps);
    controller.resetStats();
    
    const stats = controller.getStats();
    expect(stats.replaysStarted).toBe(0);
    expect(stats.stepsPassed).toBe(0);
    
    await controller.destroy();
  });
});

// ============================================================================
// OPTIONS TESTS
// ============================================================================

describe('ReplayController options', () => {
  it('should respect wait between steps', async () => {
    const steps = createMockSteps(3);
    const timestamps: number[] = [];
    
    const controller = createReplayController({
      stepExecutor: async () => {
        timestamps.push(Date.now());
        return { success: true, duration: 1, elementFound: true };
      },
      options: { waitBetweenSteps: 50 },
    });
    
    await controller.start(steps);
    
    // Check intervals between steps
    for (let i = 1; i < timestamps.length; i++) {
      const diff = timestamps[i] - timestamps[i - 1];
      expect(diff).toBeGreaterThanOrEqual(45); // Allow some variance
    }
    
    await controller.destroy();
  });
  
  it('should update options', () => {
    const controller = createReplayController();
    
    controller.updateOptions({ stepTimeout: 5000 });
    
    expect(controller.options.stepTimeout).toBe(5000);
  });
});
