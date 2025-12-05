/**
 * TestRun Test Fixtures
 * @module test/fixtures/testRuns
 * @version 1.0.0
 */

import type { TestRun, StepResult } from '@/core/types';

// ============================================================================
// BASE TEST RUN
// ============================================================================

export const createTestRun = (overrides: Partial<TestRun> = {}): TestRun => ({
  id: 1,
  project_id: 1,
  status: 'pending',
  start_time: new Date().toISOString(),
  end_time: undefined,
  total_steps: 5,
  passed_steps: 0,
  failed_steps: 0,
  test_results: [],
  logs: '',
  ...overrides,
});

// ============================================================================
// STEP RESULTS
// ============================================================================

export const createStepResult = (overrides: Partial<StepResult> = {}): StepResult => ({
  step_id: '1',
  status: 'passed',
  duration: 100,
  error_message: null,
  screenshot: null,
  ...overrides,
});

// ============================================================================
// PRESET TEST RUNS
// ============================================================================

export const pendingTestRun = createTestRun({
  id: 1,
  status: 'pending',
  total_steps: 5,
});

export const runningTestRun = createTestRun({
  id: 2,
  status: 'running',
  total_steps: 5,
  passed_steps: 2,
  test_results: [
    createStepResult({ step_id: '1', status: 'passed', duration: 150 }),
    createStepResult({ step_id: '2', status: 'passed', duration: 200 }),
  ],
});

export const completedTestRun = createTestRun({
  id: 3,
  status: 'completed',
  end_time: new Date().toISOString(),
  total_steps: 5,
  passed_steps: 5,
  failed_steps: 0,
  test_results: [
    createStepResult({ step_id: '1', status: 'passed', duration: 150 }),
    createStepResult({ step_id: '2', status: 'passed', duration: 200 }),
    createStepResult({ step_id: '3', status: 'passed', duration: 100 }),
    createStepResult({ step_id: '4', status: 'passed', duration: 180 }),
    createStepResult({ step_id: '5', status: 'passed', duration: 120 }),
  ],
  logs: 'All steps passed successfully',
});

export const failedTestRun = createTestRun({
  id: 4,
  status: 'failed',
  end_time: new Date().toISOString(),
  total_steps: 5,
  passed_steps: 2,
  failed_steps: 1,
  test_results: [
    createStepResult({ step_id: '1', status: 'passed', duration: 150 }),
    createStepResult({ step_id: '2', status: 'passed', duration: 200 }),
    createStepResult({
      step_id: '3',
      status: 'failed',
      duration: 2000,
      error_message: 'Element not found',
    }),
  ],
  logs: 'Test failed at step 3: Element not found',
});

// ============================================================================
// MULTIPLE TEST RUNS
// ============================================================================

export const mockTestRuns: TestRun[] = [
  completedTestRun,
  failedTestRun,
  runningTestRun,
  pendingTestRun,
];
