/**
 * Test Management System - Central export barrel
 * @module core/test-management
 * @version 1.0.0
 * 
 * Provides a unified entry point for the test management layer.
 * 
 * Main Components:
 * - TestCaseManager: CRUD operations for test cases
 * - TestRunner: Executes test cases and collects results
 * 
 * @example
 * ```typescript
 * import {
 *   TestCaseManager,
 *   TestRunner,
 *   createTestCaseManager,
 *   createTestRunner,
 *   TEST_CASE_STATUS,
 *   RUN_STATUS,
 * } from '@/core/test-management';
 * 
 * // Create manager and runner
 * const manager = createTestCaseManager();
 * const runner = createTestRunner({
 *   onProgress: (p) => console.log(`${p.percentage}%`),
 * });
 * 
 * // Create and run a test
 * const testCase = await manager.create({
 *   name: 'Login Test',
 *   steps: recordedSteps,
 * });
 * 
 * const result = await runner.run(testCase);
 * ```
 */

// Import for internal use
import {
  createTestCaseManager as _createTestCaseManager,
  MAX_NAME_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
} from './TestCaseManager';
import { createTestRunner as _createTestRunner } from './TestRunner';

// ============================================================================
// TEST CASE MANAGER
// ============================================================================

export {
  // Main class
  TestCaseManager,
  
  // Factory function
  createTestCaseManager,
  
  // Constants
  STORAGE_KEY_PREFIX,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_STEPS,
  MAX_VERSIONS,
  TEST_CASE_STATUS,
  
  // Types
  type TestCaseStatus,
  type TestCase,
  type TestCaseVersion,
  type CreateTestCaseInput,
  type UpdateTestCaseInput,
  type TestCaseFilter,
  type TestCaseSort,
  type PaginationOptions,
  type PaginatedResult,
  type ValidationError,
  type ValidationResult,
  type TestCaseStorage,
  type TestCaseEventType,
  type TestCaseEventListener,
  type TestCaseManagerConfig,
} from './TestCaseManager';

// ============================================================================
// TEST RUNNER
// ============================================================================

export {
  // Main class
  TestRunner,
  
  // Factory function
  createTestRunner,
  
  // Constants
  DEFAULT_RUNNER_OPTIONS,
  RUN_STATUS,
  
  // Types
  type RunStatus,
  type RunnerOptions,
  type TestRunConfig,
  type TestExecutionResult,
  type TestRunResult,
  type RunProgress,
  type StepExecutorFn,
  type BeforeAllHook,
  type AfterAllHook,
  type BeforeEachHook,
  type AfterEachHook,
  type TestRunnerConfig,
  
  // Report generators
  generateSummaryReport,
  generateDetailedReport,
} from './TestRunner';

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Creates a complete test management system with manager and runner
 * 
 * @param config - Configuration options
 * @returns Configured test management components
 * 
 * @example
 * ```typescript
 * const { manager, runner } = createTestManagementSystem({
 *   onProgress: (p) => updateUI(p),
 *   onTestComplete: (r) => logResult(r),
 * });
 * 
 * // Create test case
 * const testCase = await manager.create({
 *   name: 'My Test',
 *   steps: recordedSteps,
 * });
 * 
 * // Run test
 * const result = await runner.run(testCase);
 * ```
 */
export function createTestManagementSystem(config?: {
  /** Test case manager config */
  managerConfig?: import('./TestCaseManager').TestCaseManagerConfig;
  /** Test runner config */
  runnerConfig?: import('./TestRunner').TestRunnerConfig;
  /** Progress callback */
  onProgress?: (progress: import('./TestRunner').RunProgress) => void;
  /** Test complete callback */
  onTestComplete?: (result: import('./TestRunner').TestExecutionResult) => void;
  /** Run complete callback */
  onRunComplete?: (result: import('./TestRunner').TestRunResult) => void;
}): {
  manager: import('./TestCaseManager').TestCaseManager;
  runner: import('./TestRunner').TestRunner;
} {
  const manager = _createTestCaseManager(config?.managerConfig);
  
  const runner = _createTestRunner({
    ...config?.runnerConfig,
    onProgress: config?.onProgress ?? config?.runnerConfig?.onProgress,
    onTestComplete: config?.onTestComplete ?? config?.runnerConfig?.onTestComplete,
    afterAll: config?.onRunComplete,
  });
  
  return { manager, runner };
}

/**
 * Creates a simple test runner with default settings
 * 
 * @param onProgress - Progress callback
 * @returns Configured TestRunner
 */
export function createSimpleRunner(
  onProgress?: (progress: import('./TestRunner').RunProgress) => void
): import('./TestRunner').TestRunner {
  return _createTestRunner({
    onProgress,
    options: {
      maxConcurrency: 1,
      retryFailedTests: true,
      maxRetries: 2,
      stopOnFirstFailure: false,
    },
  });
}

// ============================================================================
// RUNNER PRESETS
// ============================================================================

/**
 * Test runner presets for common scenarios
 */
export const RUNNER_PRESETS = {
  /**
   * Fast runner - minimal retries, parallel execution
   */
  fast: {
    maxConcurrency: 4,
    retryFailedTests: false,
    maxRetries: 0,
    retryDelay: 0,
    stopOnFirstFailure: false,
    timeout: 60000,
    screenshotOnFailure: false,
    screenshotOnSuccess: false,
  },
  
  /**
   * Standard runner - balanced settings
   */
  standard: {
    maxConcurrency: 1,
    retryFailedTests: true,
    maxRetries: 2,
    retryDelay: 1000,
    stopOnFirstFailure: false,
    timeout: 300000,
    screenshotOnFailure: true,
    screenshotOnSuccess: false,
  },
  
  /**
   * Reliable runner - maximum retries for flaky tests
   */
  reliable: {
    maxConcurrency: 1,
    retryFailedTests: true,
    maxRetries: 5,
    retryDelay: 2000,
    stopOnFirstFailure: false,
    timeout: 600000,
    screenshotOnFailure: true,
    screenshotOnSuccess: false,
  },
  
  /**
   * CI runner - optimized for CI/CD pipelines
   */
  ci: {
    maxConcurrency: 2,
    retryFailedTests: true,
    maxRetries: 1,
    retryDelay: 500,
    stopOnFirstFailure: false,
    timeout: 180000,
    screenshotOnFailure: true,
    screenshotOnSuccess: false,
  },
  
  /**
   * Debug runner - stops on first failure
   */
  debug: {
    maxConcurrency: 1,
    retryFailedTests: false,
    maxRetries: 0,
    retryDelay: 0,
    stopOnFirstFailure: true,
    timeout: 600000,
    screenshotOnFailure: true,
    screenshotOnSuccess: true,
  },
  
  /**
   * Smoke runner - quick validation
   */
  smoke: {
    maxConcurrency: 4,
    retryFailedTests: true,
    maxRetries: 1,
    retryDelay: 500,
    stopOnFirstFailure: true,
    timeout: 60000,
    screenshotOnFailure: true,
    screenshotOnSuccess: false,
  },
} as const;

/**
 * Runner preset names
 */
export type RunnerPreset = keyof typeof RUNNER_PRESETS;

/**
 * Creates a test runner with a preset configuration
 * 
 * @param preset - Preset name
 * @param config - Additional configuration
 * @returns Configured TestRunner
 */
export function createRunnerWithPreset(
  preset: RunnerPreset,
  config?: Partial<import('./TestRunner').TestRunnerConfig>
): import('./TestRunner').TestRunner {
  return _createTestRunner({
    ...config,
    options: {
      ...RUNNER_PRESETS[preset],
      ...config?.options,
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates pass rate from run result
 * 
 * @param result - Test run result
 * @returns Pass rate as percentage (0-100)
 */
export function calculatePassRate(
  result: import('./TestRunner').TestRunResult
): number {
  if (result.totalTests === 0) return 100;
  return Math.round((result.passedTests / result.totalTests) * 100);
}

/**
 * Checks if run result is passing
 * 
 * @param result - Test run result
 * @returns Whether all tests passed
 */
export function isPassingRun(
  result: import('./TestRunner').TestRunResult
): boolean {
  return result.failedTests === 0 && result.status !== 'cancelled';
}

/**
 * Gets failed tests from run result
 * 
 * @param result - Test run result
 * @returns Array of failed test results
 */
export function getFailedTests(
  result: import('./TestRunner').TestRunResult
): import('./TestRunner').TestExecutionResult[] {
  return result.testResults.filter(
    r => r.status === 'failed' || r.status === 'error'
  );
}

/**
 * Gets passed tests from run result
 * 
 * @param result - Test run result
 * @returns Array of passed test results
 */
export function getPassedTests(
  result: import('./TestRunner').TestRunResult
): import('./TestRunner').TestExecutionResult[] {
  return result.testResults.filter(r => r.status === 'passed');
}

/**
 * Gets skipped tests from run result
 * 
 * @param result - Test run result
 * @returns Array of skipped test results
 */
export function getSkippedTests(
  result: import('./TestRunner').TestRunResult
): import('./TestRunner').TestExecutionResult[] {
  return result.testResults.filter(r => r.status === 'skipped');
}

/**
 * Formats run duration as human-readable string
 * 
 * @param result - Test run result
 * @returns Formatted duration string
 */
export function formatRunDuration(
  result: import('./TestRunner').TestRunResult
): string {
  const ms = result.duration;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Gets average test duration from run result
 * 
 * @param result - Test run result
 * @returns Average duration in ms
 */
export function getAverageTestDuration(
  result: import('./TestRunner').TestRunResult
): number {
  const completedTests = result.testResults.filter(
    r => r.status !== 'skipped'
  );
  
  if (completedTests.length === 0) return 0;
  
  const totalDuration = completedTests.reduce((sum, r) => sum + r.duration, 0);
  return Math.round(totalDuration / completedTests.length);
}

/**
 * Gets slowest tests from run result
 * 
 * @param result - Test run result
 * @param count - Number of tests to return
 * @returns Array of slowest test results
 */
export function getSlowestTests(
  result: import('./TestRunner').TestRunResult,
  count: number = 5
): import('./TestRunner').TestExecutionResult[] {
  return [...result.testResults]
    .filter(r => r.status !== 'skipped')
    .sort((a, b) => b.duration - a.duration)
    .slice(0, count);
}

/**
 * Groups test cases by tag
 * 
 * @param testCases - Test cases to group
 * @returns Map of tag to test cases
 */
export function groupTestCasesByTag(
  testCases: import('./TestCaseManager').TestCase[]
): Map<string, import('./TestCaseManager').TestCase[]> {
  const groups = new Map<string, import('./TestCaseManager').TestCase[]>();
  
  for (const tc of testCases) {
    for (const tag of tc.tags) {
      if (!groups.has(tag)) {
        groups.set(tag, []);
      }
      groups.get(tag)!.push(tc);
    }
  }
  
  return groups;
}

/**
 * Groups test cases by status
 * 
 * @param testCases - Test cases to group
 * @returns Map of status to test cases
 */
export function groupTestCasesByStatus(
  testCases: import('./TestCaseManager').TestCase[]
): Map<import('./TestCaseManager').TestCaseStatus, import('./TestCaseManager').TestCase[]> {
  const groups = new Map<import('./TestCaseManager').TestCaseStatus, import('./TestCaseManager').TestCase[]>();
  
  for (const tc of testCases) {
    if (!groups.has(tc.status)) {
      groups.set(tc.status, []);
    }
    groups.get(tc.status)!.push(tc);
  }
  
  return groups;
}

/**
 * Filters test cases by search query
 * 
 * @param testCases - Test cases to filter
 * @param query - Search query
 * @returns Filtered test cases
 */
export function searchTestCases(
  testCases: import('./TestCaseManager').TestCase[],
  query: string
): import('./TestCaseManager').TestCase[] {
  const lowerQuery = query.toLowerCase();
  
  return testCases.filter(tc => {
    const nameMatch = tc.name.toLowerCase().includes(lowerQuery);
    const descMatch = tc.description?.toLowerCase().includes(lowerQuery) ?? false;
    const tagMatch = tc.tags.some(t => t.includes(lowerQuery));
    
    return nameMatch || descMatch || tagMatch;
  });
}

/**
 * Sorts test cases by field
 * 
 * @param testCases - Test cases to sort
 * @param field - Field to sort by
 * @param direction - Sort direction
 * @returns Sorted test cases
 */
export function sortTestCases(
  testCases: import('./TestCaseManager').TestCase[],
  field: 'name' | 'createdAt' | 'updatedAt' | 'status',
  direction: 'asc' | 'desc' = 'asc'
): import('./TestCaseManager').TestCase[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  
  return [...testCases].sort((a, b) => {
    switch (field) {
      case 'name':
        return multiplier * a.name.localeCompare(b.name);
      case 'createdAt':
        return multiplier * (a.createdAt - b.createdAt);
      case 'updatedAt':
        return multiplier * (a.updatedAt - b.updatedAt);
      case 'status':
        return multiplier * a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a test case name
 * 
 * @param name - Name to validate
 * @returns Validation result
 */
export function validateTestCaseName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must be ${MAX_NAME_LENGTH} characters or less` };
  }
  
  return { valid: true };
}

/**
 * Validates test case tags
 * 
 * @param tags - Tags to validate
 * @returns Validation result
 */
export function validateTestCaseTags(tags: string[]): {
  valid: boolean;
  error?: string;
} {
  if (tags.length > MAX_TAGS) {
    return { valid: false, error: `Maximum ${MAX_TAGS} tags allowed` };
  }
  
  for (const tag of tags) {
    if (tag.length > MAX_TAG_LENGTH) {
      return { valid: false, error: `Tag "${tag}" exceeds ${MAX_TAG_LENGTH} characters` };
    }
  }
  
  return { valid: true };
}

/**
 * Normalizes tags (lowercase, trim, dedupe)
 * 
 * @param tags - Tags to normalize
 * @returns Normalized tags
 */
export function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 0);
  
  return Array.from(new Set(normalized));
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Converts test case to exportable format
 * 
 * @param testCase - Test case to convert
 * @returns Exportable object
 */
export function toExportFormat(
  testCase: import('./TestCaseManager').TestCase
): Record<string, unknown> {
  return {
    name: testCase.name,
    description: testCase.description,
    steps: testCase.steps,
    tags: testCase.tags,
    baseUrl: testCase.baseUrl,
    metadata: testCase.metadata,
    exportedAt: new Date().toISOString(),
    version: testCase.version,
  };
}

/**
 * Converts run result to exportable format
 * 
 * @param result - Run result to convert
 * @returns Exportable object
 */
export function runResultToExportFormat(
  result: import('./TestRunner').TestRunResult
): Record<string, unknown> {
  return {
    runId: result.runId,
    name: result.name,
    status: result.status,
    startTime: new Date(result.startTime).toISOString(),
    endTime: new Date(result.endTime).toISOString(),
    duration: result.duration,
    totalTests: result.totalTests,
    passedTests: result.passedTests,
    failedTests: result.failedTests,
    skippedTests: result.skippedTests,
    passRate: calculatePassRate(result),
    environment: result.environment,
    testResults: result.testResults.map(tr => ({
      testCaseName: tr.testCaseName,
      status: tr.status,
      duration: tr.duration,
      error: tr.error,
      attempt: tr.attempt,
    })),
  };
}

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

/**
 * Re-export step types
 */
export type { RecordedStep, StepType, StepTarget } from '../types/step';

/**
 * Re-export replay types
 */
export type {
  ReplayResult,
  StepResult,
  ReplayOptions,
} from '../types/replay';
