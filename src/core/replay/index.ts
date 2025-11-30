/**
 * @fileoverview Barrel export for all replay-related types and utilities
 * @module core/replay
 * @version 1.0.0
 * 
 * This module re-exports all replay engine types, the Player class,
 * step executor, and utilities for test playback.
 * 
 * REPLAY WORKFLOW:
 * 1. Create Player with Steps
 * 2. Optionally set CSV data for data-driven testing
 * 3. Call play() to execute all steps
 * 4. Handle callbacks for progress/errors
 * 5. Get results and generate TestRun
 * 
 * STEP EVENT EXECUTION:
 * - 'open' - Verify/navigate to URL
 * - 'click' - Locate and click element
 * - 'input' - Locate element, inject value, type
 * - 'enter' - Locate element, press Enter
 * 
 * TESTRUN STATUS (set based on results):
 * - 'pending' - Before replay starts
 * - 'running' - During replay
 * - 'passed' - All steps succeeded
 * - 'failed' - Any step failed
 * - 'stopped' - User stopped replay
 * 
 * @example
 * ```typescript
 * // Simple replay
 * import { Player, runReplay } from '@/core/replay';
 * 
 * // Detailed execution
 * import { StepExecutor, executeStep } from '@/core/replay';
 * 
 * // Complete workflow
 * import { replayProject, createTestRunFromReplay } from '@/core/replay';
 * ```
 * 
 * @see PHASE_4_SPECIFICATIONS.md for replay specifications
 * @see replay-engine_breakdown.md for engine details
 */

// ============================================================================
// PLAYER
// ============================================================================

export {
  // Types
  type ReplayState,
  type ReplayConfig,
  type StepResult,
  type ReplayProgress,
  type CsvInjectionData,
  type ReplayCallbacks,
  
  // Constants
  DEFAULT_REPLAY_CONFIG,
  
  // Player Class
  Player,
  
  // Factory Functions
  createPlayer,
  runReplay,
  
  // Utilities
  generateLogFromResults
} from './player';

// ============================================================================
// STEP EXECUTOR
// ============================================================================

export {
  // Types
  type StepExecutionOptions,
  type StepExecutionContext,
  type StepExecutionResult,
  type ExecutionPhase,
  type StepExecutionError,
  type StepErrorCode,
  type PreExecuteHook,
  type PostExecuteHook,
  
  // Constants
  DEFAULT_EXECUTION_OPTIONS,
  ERROR_MESSAGES,
  
  // StepExecutor Class
  StepExecutor,
  
  // Standalone Functions
  executeStep,
  executeSteps,
  validateStep,
  describeStep,
  getErrorSummary,
  createExecutionReport
} from './step-executor';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

// Re-export types for convenience
export type { Step, StepEvent, TestRun, TestRunStatus, Field } from '../types';

// Re-export locator functions used during replay
export {
  executeStrategy,
  performClick,
  performInput,
  performEnter,
  highlightReplay,
  highlightSuccess,
  highlightError
} from '../locators';

// ============================================================================
// COMPOSITE FUNCTIONS
// ============================================================================

/**
 * Replay a project's steps
 * 
 * Complete workflow for replaying a project with optional CSV data.
 * 
 * @param steps - Steps to replay
 * @param options - Replay and execution options
 * @returns Replay result with TestRun data
 * 
 * @example
 * ```typescript
 * const result = await replayProject(project.steps, {
 *   csvData: project.csvData,
 *   fields: project.fields,
 *   rowIndex: 0,
 *   onProgress: (p) => console.log(`${p.completedSteps}/${p.totalSteps}`)
 * });
 * 
 * if (result.passed) {
 *   console.log('All tests passed!');
 * }
 * ```
 */
export async function replayProject(
  steps: import('../types').Step[],
  options: {
    config?: import('./player').ReplayConfig;
    csvData?: string[][] | null;
    fields?: import('../types').Field[];
    rowIndex?: number;
    onProgress?: (progress: import('./player').ReplayProgress) => void;
    onStepComplete?: (result: import('./player').StepResult, index: number) => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<{
  passed: boolean;
  results: import('./player').StepResult[];
  duration: number;
  logs: string;
  status: import('../types').TestRunStatus;
}> {
  const { Player, generateLogFromResults } = require('./player');

  const player = new Player(steps, options.config || {}, {
    onProgress: options.onProgress,
    onStepComplete: options.onStepComplete,
    onError: options.onError
  });

  // Set CSV data if provided
  if (options.csvData && options.fields && options.rowIndex !== undefined) {
    const headers = options.csvData[0] || [];
    const dataRows = options.csvData.slice(1);
    const rowData: Record<string, string> = {};
    
    const row = dataRows[options.rowIndex];
    if (row) {
      headers.forEach((header, i) => {
        rowData[header] = row[i] || '';
      });
    }

    player.setCsvData(headers, rowData, options.rowIndex, options.fields);
  }

  const startTime = Date.now();
  const results = await player.play();
  const duration = Date.now() - startTime;
  
  const passed = results.every((r: import('./player').StepResult) => r.success);
  const logs = generateLogFromResults(results);
  
  let status: import('../types').TestRunStatus;
  if (player.getState() === 'stopped') {
    status = 'stopped';
  } else if (passed) {
    status = 'passed';
  } else {
    status = 'failed';
  }

  return {
    passed,
    results,
    duration,
    logs,
    status
  };
}

/**
 * Create TestRun from replay results
 * 
 * Converts replay results into a TestRun object for storage.
 * 
 * CRITICAL: TestRun.logs is string (NOT string[])
 * 
 * @param projectId - Project ID
 * @param results - Step results from replay
 * @param options - Additional TestRun options
 * @returns TestRun object ready for storage
 */
export function createTestRunFromReplay(
  projectId: string,
  results: import('./player').StepResult[],
  options: {
    csvRowIndex?: number;
    duration?: number;
    status?: import('../types').TestRunStatus;
  } = {}
): import('../types').TestRun {
  const { createTestRun } = require('../types');
  const { generateLogFromResults } = require('./player');

  const passed = results.every(r => r.success);
  const logs = generateLogFromResults(results);

  let status = options.status;
  if (!status) {
    status = passed ? 'passed' : 'failed';
  }

  return createTestRun({
    projectId,
    status,
    logs, // CRITICAL: string, not string[]
    csvRowIndex: options.csvRowIndex ?? null,
    duration: options.duration ?? results.reduce((sum, r) => sum + r.duration, 0)
  });
}

/**
 * Run data-driven replay for all CSV rows
 * 
 * Executes replay once for each row in CSV data.
 * 
 * @param steps - Steps to replay
 * @param csvData - CSV data including headers
 * @param fields - Field definitions with mappings
 * @param options - Replay options
 * @returns Array of results for each row
 */
export async function runDataDrivenReplay(
  steps: import('../types').Step[],
  csvData: string[][],
  fields: import('../types').Field[],
  options: {
    config?: import('./player').ReplayConfig;
    stopOnFailure?: boolean;
    onRowStart?: (rowIndex: number, totalRows: number) => void;
    onRowComplete?: (rowIndex: number, passed: boolean) => void;
  } = {}
): Promise<Array<{
  rowIndex: number;
  passed: boolean;
  results: import('./player').StepResult[];
  duration: number;
  logs: string;
}>> {
  const dataRows = csvData.slice(1);
  const allResults: Array<{
    rowIndex: number;
    passed: boolean;
    results: import('./player').StepResult[];
    duration: number;
    logs: string;
  }> = [];

  for (let i = 0; i < dataRows.length; i++) {
    options.onRowStart?.(i, dataRows.length);

    const result = await replayProject(steps, {
      config: options.config,
      csvData,
      fields,
      rowIndex: i
    });

    allResults.push({
      rowIndex: i,
      passed: result.passed,
      results: result.results,
      duration: result.duration,
      logs: result.logs
    });

    options.onRowComplete?.(i, result.passed);

    if (!result.passed && options.stopOnFailure) {
      break;
    }
  }

  return allResults;
}

/**
 * Validate steps before replay
 * 
 * Checks all steps are valid before starting replay.
 * 
 * @param steps - Steps to validate
 * @returns Validation result
 */
export function validateStepsForReplay(
  steps: import('../types').Step[]
): {
  valid: boolean;
  errors: Array<{ stepIndex: number; errors: string[] }>;
  warnings: string[];
} {
  const { validateStep } = require('./step-executor');
  
  const errors: Array<{ stepIndex: number; errors: string[] }> = [];
  const warnings: string[] = [];

  if (steps.length === 0) {
    warnings.push('No steps to replay');
    return { valid: true, errors, warnings };
  }

  // First step should be 'open'
  if (steps[0].event !== 'open') {
    warnings.push('First step should be "open" event');
  }

  // Validate each step
  for (let i = 0; i < steps.length; i++) {
    const result = validateStep(steps[i]);
    if (!result.valid) {
      errors.push({ stepIndex: i, errors: result.errors });
    }
  }

  // Note: Steps use array position for ordering, not an 'order' field

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get replay statistics
 * 
 * @param results - Step results from replay
 * @returns Statistics about the replay
 */
export function getReplayStats(
  results: import('./player').StepResult[]
): {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  totalDuration: number;
  averageStepDuration: number;
  locatorStats: {
    byStrategy: Record<string, number>;
    averageConfidence: number;
  };
  errorStats: {
    byCode: Record<string, number>;
  };
} {
  const totalSteps = results.length;
  const passedSteps = results.filter(r => r.success).length;
  const failedSteps = totalSteps - passedSteps;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const averageStepDuration = totalSteps > 0 ? totalDuration / totalSteps : 0;

  // Locator stats
  const byStrategy: Record<string, number> = {};
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const result of results) {
    if (result.locatorStrategy) {
      byStrategy[result.locatorStrategy] = (byStrategy[result.locatorStrategy] || 0) + 1;
    }
    if (result.locatorConfidence !== undefined) {
      totalConfidence += result.locatorConfidence;
      confidenceCount++;
    }
  }

  // Error stats (extract error codes from error messages)
  const byCode: Record<string, number> = {};
  for (const result of results) {
    if (!result.success && result.error) {
      // Extract error code from message (format: "ERROR_CODE: message")
      const match = result.error.match(/^([A-Z_]+):/);
      const code = match ? match[1] : 'UNKNOWN_ERROR';
      byCode[code] = (byCode[code] || 0) + 1;
    }
  }

  return {
    totalSteps,
    passedSteps,
    failedSteps,
    totalDuration: Math.round(totalDuration),
    averageStepDuration: Math.round(averageStepDuration),
    locatorStats: {
      byStrategy,
      averageConfidence: confidenceCount > 0 ? Math.round(totalConfidence / confidenceCount) : 0
    },
    errorStats: {
      byCode
    }
  };
}

/**
 * Create content script replay handler
 * 
 * Sets up replay in content script context with message passing.
 * 
 * @param sendMessage - Function to send messages to background
 * @returns Replay control object
 */
export function createContentScriptReplay(
  sendMessage: (message: unknown) => void
): {
  start: (steps: import('../types').Step[], config?: import('./player').ReplayConfig) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getState: () => import('./player').ReplayState;
} {
  const { Player } = require('./player');
  
  let player: InstanceType<typeof Player> | null = null;

  return {
    start: async (steps, config) => {
      if (player?.isRunning()) {
        throw new Error('Replay already in progress');
      }

      player = new Player(steps, config || {}, {
        onStepStart: (step: import('../types').Step, index: number) => {
          sendMessage({
            action: 'replay_step_start',
            data: { step, index }
          });
        },
        onStepComplete: (result: import('./player').StepResult, index: number) => {
          sendMessage({
            action: 'replay_step_complete',
            data: { result, index }
          });
        },
        onProgress: (progress: import('./player').ReplayProgress) => {
          sendMessage({
            action: 'replay_progress',
            data: { progress }
          });
        },
        onComplete: (results: import('./player').StepResult[], passed: boolean) => {
          sendMessage({
            action: 'replay_complete',
            data: { results, passed }
          });
        },
        onError: (error: Error) => {
          sendMessage({
            action: 'replay_error',
            data: { error: error.message }
          });
        }
      });

      sendMessage({
        action: 'replay_started',
        data: { stepCount: steps.length }
      });

      await player.play();
    },

    stop: () => {
      player?.stop();
      sendMessage({ action: 'replay_stopped', data: {} });
    },

    pause: () => {
      player?.pause();
      sendMessage({ action: 'replay_paused', data: {} });
    },

    resume: () => {
      player?.resume();
      sendMessage({ action: 'replay_resumed', data: {} });
    },

    getState: () => player?.getState() ?? 'idle'
  };
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * REPLAY LAYER ARCHITECTURE
 * 
 * The replay layer executes recorded steps:
 * 
 * 1. Player (player.ts)
 *    - Core replay engine
 *    - Sequential step execution
 *    - CSV data injection
 *    - State management (running/paused/stopped)
 *    - Progress tracking
 *    - Callbacks for UI updates
 * 
 * 2. Step Executor (step-executor.ts)
 *    - Individual step execution
 *    - Phased execution with timing
 *    - Pre/post execution hooks
 *    - Detailed error information
 *    - Validation and reporting
 * 
 * STEP EVENT EXECUTION:
 * - 'open': Verify URL matches expected
 * - 'click': Locate element → verify interactable → click
 * - 'input': Locate element → inject value → type
 * - 'enter': Locate element → dispatch Enter key
 * 
 * CSV DATA INJECTION:
 * 1. setCsvData() configures field mappings
 * 2. For each 'input' step, check if bundle matches a field
 * 3. If matched, use CSV value instead of recorded value
 * 4. Falls back to original value if no mapping
 * 
 * TESTRUN CREATION:
 * 1. Replay completes
 * 2. generateLogFromResults() creates log string
 * 3. createTestRunFromReplay() creates TestRun object
 * 4. TestRun saved to storage
 * 
 * CRITICAL NOTES:
 * 
 * - Step.event MUST be 'click' | 'input' | 'enter' | 'open'
 * - TestRun.status: 'pending' | 'running' | 'passed' | 'failed' | 'stopped'
 * - TestRun.logs is string (NOT string[]) - use newlines
 * - Use locator strategies with retry for element finding
 * - Show highlights for visual feedback
 * - Support stopOnFailure option
 * 
 * USAGE RECOMMENDATIONS:
 * 
 * - Use replayProject() for complete workflow
 * - Use runDataDrivenReplay() for CSV batch testing
 * - Use StepExecutor with hooks for custom behavior
 * - Use validateStepsForReplay() before starting
 * - Use getReplayStats() for reporting
 */
