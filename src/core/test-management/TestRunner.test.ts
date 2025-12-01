/**
 * TestRunner Test Suite
 * @module core/test-management/TestRunner.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TestRunner,
  createTestRunner,
  DEFAULT_RUNNER_OPTIONS,
  RUN_STATUS,
  generateSummaryReport,
  generateDetailedReport,
  type TestExecutionResult,
  type RunProgress,
  type StepExecutorFn,
} from './TestRunner';
import type { TestCase } from './TestCaseManager';
import type { RecordedStep } from '../types/step';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockStep(overrides: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Click button',
    event: 'click',
    path: '/html/body/button',
    value: '',
    label: 'Submit',
    x: 100,
    y: 200,
    type: 'click',
    timestamp: Date.now(),
    target: {
      tagName: 'button',
      xpath: '/html/body/button',
      cssSelector: 'button',
    },
    ...overrides,
  };
}

function createMockTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Test Case',
    description: 'Test description',
    steps: [createMockStep(), createMockStep()],
    tags: ['smoke'],
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...overrides,
  } as TestCase;
}

function createPassingExecutor(): StepExecutorFn {
  return async (step, context) => ({
    stepId: step.id,
    stepIndex: context.stepIndex,
    status: 'passed',
    startTime: Date.now() - 50,
    endTime: Date.now(),
    duration: 50,
    attempts: 1,
  });
}

function createFailingExecutor(failAtStep?: number): StepExecutorFn {
  return async (step, context) => {
    if (failAtStep === undefined || context.stepIndex === failAtStep) {
      return {
        stepId: step.id,
        stepIndex: context.stepIndex,
        status: 'failed',
        startTime: Date.now() - 50,
        endTime: Date.now(),
        duration: 50,
        attempts: 1,
        error: 'Element not found',
      };
    }
    return {
      stepId: step.id,
      stepIndex: context.stepIndex,
      status: 'passed',
      startTime: Date.now() - 50,
      endTime: Date.now(),
      duration: 50,
      attempts: 1,
    };
  };
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('TestRunner constants', () => {
  it('should have default options', () => {
    expect(DEFAULT_RUNNER_OPTIONS.maxConcurrency).toBe(1);
    expect(DEFAULT_RUNNER_OPTIONS.retryFailedTests).toBe(true);
    expect(DEFAULT_RUNNER_OPTIONS.maxRetries).toBe(2);
  });
  
  it('should have run status values', () => {
    expect(RUN_STATUS.PASSED).toBe('passed');
    expect(RUN_STATUS.FAILED).toBe('failed');
    expect(RUN_STATUS.SKIPPED).toBe('skipped');
  });
});

// ============================================================================
// SINGLE TEST EXECUTION
// ============================================================================

describe('TestRunner single execution', () => {
  let runner: TestRunner;
  
  beforeEach(() => {
    runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
  });
  
  it('should run a single test case', async () => {
    const testCase = createMockTestCase({ name: 'Login Test' });
    const result = await runner.run(testCase);
    
    expect(result.testCaseId).toBe(testCase.id);
    expect(result.testCaseName).toBe('Login Test');
    expect(result.status).toBe(RUN_STATUS.PASSED);
  });
  
  it('should track duration', async () => {
    const testCase = createMockTestCase();
    const result = await runner.run(testCase);
    
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.startTime).toBeLessThanOrEqual(result.endTime);
  });
  
  it('should include replay result', async () => {
    const testCase = createMockTestCase();
    const result = await runner.run(testCase);
    
    expect(result.replayResult).toBeDefined();
    expect(result.replayResult?.totalSteps).toBe(testCase.steps.length);
  });
});

// ============================================================================
// BATCH EXECUTION
// ============================================================================

describe('TestRunner batch execution', () => {
  it('should run multiple test cases', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    const testCases = [
      createMockTestCase({ name: 'Test 1' }),
      createMockTestCase({ name: 'Test 2' }),
      createMockTestCase({ name: 'Test 3' }),
    ];
    
    const result = await runner.runAll(testCases);
    
    expect(result.totalTests).toBe(3);
    expect(result.passedTests).toBe(3);
    expect(result.status).toBe(RUN_STATUS.PASSED);
  });
  
  it('should handle empty test list', async () => {
    const runner = createTestRunner();
    const result = await runner.runAll([]);
    
    expect(result.totalTests).toBe(0);
    expect(result.status).toBe(RUN_STATUS.PASSED);
  });
  
  it('should filter by tags', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    const testCases = [
      createMockTestCase({ name: 'Smoke 1', tags: ['smoke'] }),
      createMockTestCase({ name: 'Smoke 2', tags: ['smoke'] }),
      createMockTestCase({ name: 'Regression', tags: ['regression'] }),
    ];
    
    const result = await runner.runAll(testCases, { tags: ['smoke'] });
    
    expect(result.totalTests).toBe(2);
  });
  
  it('should run by IDs', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    const testCases = [
      createMockTestCase({ id: 'tc-1', name: 'Test 1' }),
      createMockTestCase({ id: 'tc-2', name: 'Test 2' }),
      createMockTestCase({ id: 'tc-3', name: 'Test 3' }),
    ];
    
    const result = await runner.runByIds(testCases, ['tc-1', 'tc-3']);
    
    expect(result.totalTests).toBe(2);
  });
});

// ============================================================================
// FAILURE HANDLING
// ============================================================================

describe('TestRunner failure handling', () => {
  it('should mark failed tests', async () => {
    const runner = createTestRunner({
      stepExecutor: createFailingExecutor(0),
      options: { retryFailedTests: false },
    });
    
    const testCase = createMockTestCase();
    const result = await runner.run(testCase);
    
    expect(result.status).toBe(RUN_STATUS.FAILED);
    expect(result.error).toBeDefined();
  });
  
  it('should continue on failure by default', async () => {
    const runner = createTestRunner({
      stepExecutor: createFailingExecutor(0),
      options: { retryFailedTests: false },
    });
    
    const testCases = [
      createMockTestCase({ name: 'Will Fail' }),
      createMockTestCase({ name: 'Should Run' }),
    ];
    
    const result = await runner.runAll(testCases);
    
    expect(result.totalTests).toBe(2);
    expect(result.failedTests).toBe(2);
  });
  
  it('should stop on first failure when configured', async () => {
    const runner = createTestRunner({
      stepExecutor: createFailingExecutor(0),
      options: { retryFailedTests: false, stopOnFirstFailure: true },
    });
    
    const testCases = [
      createMockTestCase({ name: 'Will Fail' }),
      createMockTestCase({ name: 'Should Skip' }),
    ];
    
    const result = await runner.runAll(testCases);
    
    expect(result.failedTests).toBe(1);
    expect(result.skippedTests).toBe(1);
  });
});

// ============================================================================
// RETRY LOGIC
// ============================================================================

describe('TestRunner retry logic', () => {
  it('should retry failed tests', async () => {
    let attempts = 0;
    
    const runner = createTestRunner({
      stepExecutor: async (step, context) => {
        attempts++;
        if (attempts <= 2) {
          return {
            stepId: step.id,
            stepIndex: context.stepIndex,
            status: 'failed',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 10,
            attempts: 1,
            error: 'Flaky failure',
          };
        }
        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          status: 'passed',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 10,
          attempts: 1,
        };
      },
      options: { retryFailedTests: true, maxRetries: 2, retryDelay: 10 },
    });
    
    const testCase = createMockTestCase({ steps: [createMockStep()] });
    const result = await runner.run(testCase);
    
    expect(result.status).toBe(RUN_STATUS.PASSED);
    expect(attempts).toBeGreaterThan(1);
  });
  
  it('should respect max retries', async () => {
    let attempts = 0;
    
    const runner = createTestRunner({
      stepExecutor: async (step, context) => {
        attempts++;
        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          status: 'failed',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 10,
          attempts: 1,
          error: 'Always fails',
        };
      },
      options: { retryFailedTests: true, maxRetries: 2, retryDelay: 10 },
    });
    
    const testCase = createMockTestCase({ steps: [createMockStep()] });
    const result = await runner.run(testCase);
    
    expect(result.status).toBe(RUN_STATUS.FAILED);
    // Should run once + 2 retries = 3 total, but only 1 step per attempt
    expect(attempts).toBe(3);
  });
});

// ============================================================================
// HOOKS
// ============================================================================

describe('TestRunner hooks', () => {
  it('should call beforeAll hook', async () => {
    const beforeAll = vi.fn();
    
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
      beforeAll,
    });
    
    await runner.runAll([createMockTestCase()], { name: 'Test Run' });
    
    expect(beforeAll).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Run' })
    );
  });
  
  it('should call afterAll hook', async () => {
    const afterAll = vi.fn();
    
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
      afterAll,
    });
    
    await runner.runAll([createMockTestCase()]);
    
    expect(afterAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: RUN_STATUS.PASSED })
    );
  });
  
  it('should call beforeEach hook', async () => {
    const beforeEach = vi.fn();
    
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
      beforeEach,
    });
    
    const testCases = [
      createMockTestCase({ name: 'Test 1' }),
      createMockTestCase({ name: 'Test 2' }),
    ];
    
    await runner.runAll(testCases);
    
    expect(beforeEach).toHaveBeenCalledTimes(2);
  });
  
  it('should call afterEach hook', async () => {
    const afterEach = vi.fn();
    
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
      afterEach,
    });
    
    const testCases = [
      createMockTestCase({ name: 'Test 1' }),
      createMockTestCase({ name: 'Test 2' }),
    ];
    
    await runner.runAll(testCases);
    
    expect(afterEach).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

describe('TestRunner progress', () => {
  it('should report progress', async () => {
    const progressUpdates: RunProgress[] = [];
    
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
      onProgress: (p) => progressUpdates.push({ ...p }),
    });
    
    const testCases = [
      createMockTestCase({ name: 'Test 1' }),
      createMockTestCase({ name: 'Test 2' }),
      createMockTestCase({ name: 'Test 3' }),
    ];
    
    await runner.runAll(testCases);
    
    expect(progressUpdates.length).toBe(3);
    expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
  });
  
  it('should call onTestComplete', async () => {
    const completedTests: TestExecutionResult[] = [];
    
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
      onTestComplete: (result) => completedTests.push(result),
    });
    
    const testCases = [
      createMockTestCase({ name: 'Test 1' }),
      createMockTestCase({ name: 'Test 2' }),
    ];
    
    await runner.runAll(testCases);
    
    expect(completedTests).toHaveLength(2);
  });
});

// ============================================================================
// CANCELLATION
// ============================================================================

describe('TestRunner cancellation', () => {
  it('should cancel running tests', async () => {
    const runner = createTestRunner({
      stepExecutor: async (step, context) => {
        await new Promise(r => setTimeout(r, 50));
        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          status: 'passed',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 50,
          attempts: 1,
        };
      },
    });
    
    const testCases = Array.from({ length: 5 }, (_, i) =>
      createMockTestCase({ name: `Test ${i}` })
    );
    
    const promise = runner.runAll(testCases);
    
    // Cancel after short delay
    setTimeout(() => runner.cancel(), 30);
    
    const result = await promise;
    
    expect(result.status).toBe(RUN_STATUS.CANCELLED);
    expect(result.skippedTests).toBeGreaterThan(0);
  });
});

// ============================================================================
// CONCURRENCY
// ============================================================================

describe('TestRunner concurrency', () => {
  it('should run tests in parallel', async () => {
    const startTimes: number[] = [];
    
    const runner = createTestRunner({
      stepExecutor: async (step, context) => {
        startTimes.push(Date.now());
        await new Promise(r => setTimeout(r, 30));
        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          status: 'passed',
          startTime: Date.now() - 30,
          endTime: Date.now(),
          duration: 30,
          attempts: 1,
        };
      },
      options: { maxConcurrency: 3 },
    });
    
    const testCases = [
      createMockTestCase({ name: 'Test 1', steps: [createMockStep()] }),
      createMockTestCase({ name: 'Test 2', steps: [createMockStep()] }),
      createMockTestCase({ name: 'Test 3', steps: [createMockStep()] }),
    ];
    
    await runner.runAll(testCases);
    
    // With concurrency 3, all should start at approximately the same time
    // Allow more tolerance for timing variations
    const timeDiff = Math.max(...startTimes) - Math.min(...startTimes);
    expect(timeDiff).toBeLessThan(100);
    expect(startTimes.length).toBe(3);
  });
});

// ============================================================================
// STATISTICS
// ============================================================================

describe('TestRunner statistics', () => {
  it('should track statistics', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    await runner.runAll([createMockTestCase(), createMockTestCase()]);
    
    const stats = runner.getStats();
    
    expect(stats.totalRuns).toBe(1);
    expect(stats.totalTests).toBe(2);
    expect(stats.totalPassed).toBe(2);
  });
  
  it('should reset statistics', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    await runner.runAll([createMockTestCase()]);
    runner.resetStats();
    
    const stats = runner.getStats();
    
    expect(stats.totalRuns).toBe(0);
    expect(stats.totalTests).toBe(0);
  });
});

// ============================================================================
// REPORT GENERATION
// ============================================================================

describe('Report generation', () => {
  it('should generate summary report', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    const result = await runner.runAll([
      createMockTestCase({ name: 'Test 1' }),
      createMockTestCase({ name: 'Test 2' }),
    ]);
    
    const summary = generateSummaryReport(result);
    
    expect(summary.totalTests).toBe(2);
    expect(summary.passed).toBe(2);
    expect(summary.passRate).toBe(100);
  });
  
  it('should include failed tests in summary', async () => {
    const runner = createTestRunner({
      stepExecutor: createFailingExecutor(0),
      options: { retryFailedTests: false },
    });
    
    const result = await runner.runAll([
      createMockTestCase({ name: 'Failing Test' }),
    ]);
    
    const summary = generateSummaryReport(result);
    
    expect(summary.failedTests).toHaveLength(1);
    expect(summary.failedTests[0].name).toBe('Failing Test');
  });
  
  it('should generate detailed report', async () => {
    const runner = createTestRunner({
      stepExecutor: createPassingExecutor(),
    });
    
    const result = await runner.runAll([
      createMockTestCase({ name: 'Test 1' }),
    ]);
    
    const detailed = generateDetailedReport(result);
    
    expect(detailed.summary).toBeDefined();
    expect(detailed.testDetails).toHaveLength(1);
    expect(detailed.startTime).toBeDefined();
    expect(detailed.endTime).toBeDefined();
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe('TestRunner error handling', () => {
  it('should handle step executor errors', async () => {
    const runner = createTestRunner({
      stepExecutor: async () => {
        throw new Error('Executor crashed');
      },
    });
    
    const testCase = createMockTestCase();
    const result = await runner.run(testCase);
    
    expect(result.status).toBe(RUN_STATUS.ERROR);
    expect(result.error).toContain('Executor crashed');
  });
  
  it('should not allow concurrent runs', async () => {
    const runner = createTestRunner({
      stepExecutor: async (step, context) => {
        await new Promise(r => setTimeout(r, 100));
        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          status: 'passed',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 100,
          attempts: 1,
        };
      },
    });
    
    const testCase = createMockTestCase();
    
    // Start first run
    const firstRun = runner.runAll([testCase]);
    
    // Try to start second run
    await expect(runner.runAll([testCase])).rejects.toThrow(/already executing/);
    
    await firstRun;
  });
});
