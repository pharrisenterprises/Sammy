/**
 * Replay System - Central export barrel
 * @module core/replay
 * @version 1.0.0
 * 
 * Provides a unified entry point for the replay layer.
 * 
 * Main Components:
 * - ReplayController: Coordinates replay state and execution
 * - ActionExecutor: Executes individual step actions
 * - WaitStrategy: Element waiting and polling strategies
 * 
 * @example
 * ```typescript
 * import {
 *   ReplayController,
 *   createActionExecutor,
 *   createWaitStrategy,
 *   visible,
 *   enabled,
 * } from '@/core/replay';
 * 
 * // Create replay system
 * const controller = new ReplayController({
 *   stepExecutor: createStepExecutor(),
 *   onProgress: (p) => console.log(`${p.percentage}%`),
 * });
 * 
 * // Run replay
 * const result = await controller.start(steps);
 * ```
 */

// ============================================================================
// REPLAY CONTROLLER
// ============================================================================

export {
  // Main class
  ReplayController,
  
  // Factory function
  createReplayController,
  
  // Constants
  DEFAULT_REPLAY_OPTIONS,
  STATE_TRANSITIONS,
  DEFAULT_STEP_TIMEOUT,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_MULTIPLIER,
  
  // Types
  type ReplayControllerConfig,
  type StepExecutor,
  type StepExecutionContext,
  type StepExecutionResult,
  type ReplayProgress,
  type Breakpoint,
} from './ReplayController';

// ============================================================================
// ACTION EXECUTOR
// ============================================================================

export {
  // Main class
  ActionExecutor,
  
  // Factory function
  createActionExecutor,
  
  // Constants
  DEFAULT_ACTION_TIMEOUT,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_TYPING_DELAY,
  MAX_WAIT_TIME,
  ACTION_TYPES,
  
  // Types
  type ActionExecutorConfig,
  type ScreenshotCapturer,
  type LocatorResolver,
  type ActionContext,
  type ActionResult,
  type ActionHandler,
  type WaitCondition as ActionWaitCondition,
  type ElementState,
} from './ActionExecutor';

// ============================================================================
// WAIT STRATEGY
// ============================================================================

export {
  // Main class
  WaitStrategy,
  
  // Factory function
  createWaitStrategy,
  
  // Constants
  DEFAULT_WAIT_TIMEOUT,
  DEFAULT_POLL_INTERVAL as WAIT_POLL_INTERVAL,
  DEFAULT_STABILITY_THRESHOLD,
  DEFAULT_STABILITY_CHECKS,
  MIN_POLL_INTERVAL,
  MAX_POLL_INTERVAL,
  WAIT_CONDITIONS,
  
  // Types
  type WaitConditionType,
  type WaitCondition,
  type WaitOptions,
  type WaitResult,
  
  // Condition builders
  attached,
  detached,
  visible,
  hidden,
  enabled,
  disabled,
  stable,
  hasText,
  hasValue,
  hasAttribute,
  satisfies,
  not,
} from './WaitStrategy';

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Creates a complete replay system with all components wired together
 * 
 * @param config - Configuration options
 * @returns Configured replay system components
 * 
 * @example
 * ```typescript
 * const { controller, executor, waitStrategy } = createReplaySystem({
 *   onProgress: (p) => updateUI(p),
 *   actionTimeout: 10000,
 * });
 * 
 * const result = await controller.start(steps);
 * ```
 */
export function createReplaySystem(config?: {
  /** Replay controller config */
  controllerConfig?: import('./ReplayController').ReplayControllerConfig;
  /** Action executor config */
  executorConfig?: import('./ActionExecutor').ActionExecutorConfig;
  /** Wait strategy options */
  waitOptions?: import('./WaitStrategy').WaitOptions;
  /** Progress callback */
  onProgress?: (progress: import('./ReplayController').ReplayProgress) => void;
  /** Completion callback */
  onComplete?: (result: import('../types/replay').ReplayResult) => void;
  /** Error callback */
  onError?: (error: Error, step?: import('../types/step').RecordedStep) => void;
}): {
  controller: import('./ReplayController').ReplayController;
  executor: import('./ActionExecutor').ActionExecutor;
  waitStrategy: import('./WaitStrategy').WaitStrategy;
} {
  // Import from the modules
  const WaitStrategyModule = require('./WaitStrategy');
  const ActionExecutorModule = require('./ActionExecutor');
  const ReplayControllerModule = require('./ReplayController');
  
  // Create wait strategy
  const waitStrategy = WaitStrategyModule.createWaitStrategy(config?.waitOptions);
  
  // Create action executor
  const executor = ActionExecutorModule.createActionExecutor(config?.executorConfig);
  
  // Create step executor that uses action executor
  const stepExecutor: import('./ReplayController').StepExecutor = async (step, context) => {
    const result = await executor.execute(step, {
      step,
      timeout: context.timeout,
      abortSignal: context.abortSignal,
      previousResult: context.previousResult ? {
        success: context.previousResult.status === 'passed',
        duration: context.previousResult.duration,
        elementFound: context.previousResult.elementFound ?? false,
      } : undefined,
      metadata: context.sessionMetadata,
    });
    
    return {
      success: result.success,
      error: result.error,
      duration: result.duration,
      screenshot: result.screenshot,
      actualValue: result.actualValue,
      elementFound: result.elementFound,
      locatorUsed: result.locatorUsed,
      metadata: result.data,
    };
  };
  
  // Create controller
  const controller = ReplayControllerModule.createReplayController({
    ...config?.controllerConfig,
    stepExecutor,
    onProgress: config?.onProgress,
    onComplete: config?.onComplete,
    onError: config?.onError,
  });
  
  return { controller, executor, waitStrategy };
}

/**
 * Creates a simple replay controller with sensible defaults
 * 
 * @param onProgress - Progress callback
 * @returns Configured ReplayController
 */
export function createSimpleReplayer(
  onProgress?: (progress: import('./ReplayController').ReplayProgress) => void
): import('./ReplayController').ReplayController {
  const { controller } = createReplaySystem({
    onProgress,
    executorConfig: {
      highlightElements: true,
      scrollIntoView: true,
    },
  });
  
  return controller;
}

// ============================================================================
// REPLAY PRESETS
// ============================================================================

/**
 * Replay option presets for common scenarios
 */
export const REPLAY_PRESETS = {
  /**
   * Fast replay - minimal delays
   */
  fast: {
    stepTimeout: 10000,
    retryAttempts: 1,
    retryDelay: 100,
    waitBetweenSteps: 0,
    slowMotion: false,
  },
  
  /**
   * Standard replay - balanced settings
   */
  standard: {
    stepTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    waitBetweenSteps: 100,
    slowMotion: false,
  },
  
  /**
   * Slow replay - for debugging
   */
  slow: {
    stepTimeout: 60000,
    retryAttempts: 5,
    retryDelay: 2000,
    waitBetweenSteps: 500,
    slowMotion: true,
    slowMotionDelay: 1000,
  },
  
  /**
   * Debug replay - maximum visibility
   */
  debug: {
    stepTimeout: 60000,
    retryAttempts: 1,
    retryDelay: 500,
    waitBetweenSteps: 1000,
    slowMotion: true,
    slowMotionDelay: 2000,
    highlightElements: true,
    screenshotOnSuccess: true,
    screenshotOnFailure: true,
  },
  
  /**
   * CI replay - for automated testing
   */
  ci: {
    stepTimeout: 30000,
    retryAttempts: 2,
    retryDelay: 500,
    waitBetweenSteps: 50,
    slowMotion: false,
    continueOnFailure: true,
    screenshotOnFailure: true,
  },
  
  /**
   * Resilient replay - handles flaky tests
   */
  resilient: {
    stepTimeout: 45000,
    retryAttempts: 5,
    retryDelay: 2000,
    waitBetweenSteps: 200,
    continueOnFailure: true,
    validateLocators: true,
  },
} as const;

/**
 * Replay preset names
 */
export type ReplayPreset = keyof typeof REPLAY_PRESETS;

/**
 * Creates a replay controller with a preset configuration
 * 
 * @param preset - Preset name
 * @param overrides - Option overrides
 * @returns Configured ReplayController
 */
export function createReplayerWithPreset(
  preset: ReplayPreset,
  overrides?: Partial<import('./ReplayController').ReplayControllerConfig>
): import('./ReplayController').ReplayController {
  const ReplayControllerModule = require('./ReplayController');
  return ReplayControllerModule.createReplayController({
    ...overrides,
    options: {
      ...REPLAY_PRESETS[preset],
      ...overrides?.options,
    },
  });
}

// ============================================================================
// EXECUTOR PRESETS
// ============================================================================

/**
 * Action executor presets
 */
export const EXECUTOR_PRESETS = {
  /**
   * Default executor settings
   */
  default: {
    timeout: 30000,
    pollInterval: 100,
    highlightElements: false,
    scrollIntoView: true,
    humanizeDelays: false,
  },
  
  /**
   * Visual executor - highlights actions
   */
  visual: {
    timeout: 30000,
    pollInterval: 100,
    highlightElements: true,
    highlightDuration: 500,
    scrollIntoView: true,
    humanizeDelays: true,
    typingDelay: 100,
  },
  
  /**
   * Fast executor - minimal delays
   */
  fast: {
    timeout: 10000,
    pollInterval: 50,
    highlightElements: false,
    scrollIntoView: false,
    humanizeDelays: false,
    typingDelay: 0,
  },
} as const;

/**
 * Executor preset names
 */
export type ExecutorPreset = keyof typeof EXECUTOR_PRESETS;

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

/**
 * Re-export replay types from types module
 */
export type {
  ReplayState,
  ReplaySession,
  ReplayOptions,
  ReplayResult,
  StepResult,
  ReplayStats,
} from '../types/replay';

/**
 * Re-export step types from types module
 */
export type {
  RecordedStep,
  StepType,
  StepTarget,
} from '../types/step';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates replay success rate
 * 
 * @param result - Replay result
 * @returns Success rate as percentage (0-100)
 */
export function getSuccessRate(result: import('../types/replay').ReplayResult): number {
  if (result.totalSteps === 0) return 100;
  return Math.round((result.passedSteps / result.totalSteps) * 100);
}

/**
 * Gets failed step details from a replay result
 * 
 * @param result - Replay result
 * @returns Array of failed step results
 */
export function getFailedSteps(
  result: import('../types/replay').ReplayResult
): import('../types/replay').StepResult[] {
  return result.stepResults.filter(r => r.status === 'failed');
}

/**
 * Gets passed step details from a replay result
 * 
 * @param result - Replay result
 * @returns Array of passed step results
 */
export function getPassedSteps(
  result: import('../types/replay').ReplayResult
): import('../types/replay').StepResult[] {
  return result.stepResults.filter(r => r.status === 'passed');
}

/**
 * Gets skipped step details from a replay result
 * 
 * @param result - Replay result
 * @returns Array of skipped step results
 */
export function getSkippedSteps(
  result: import('../types/replay').ReplayResult
): import('../types/replay').StepResult[] {
  return result.stepResults.filter(r => r.status === 'skipped');
}

/**
 * Formats replay duration as human-readable string
 * 
 * @param result - Replay result
 * @returns Formatted duration string
 */
export function formatReplayDuration(
  result: import('../types/replay').ReplayResult
): string {
  const seconds = Math.floor(result.duration / 1000);
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
 * Generates a summary report from replay result
 * 
 * @param result - Replay result
 * @returns Summary object
 */
export function generateReplaySummary(result: import('../types/replay').ReplayResult): {
  testName: string;
  success: boolean;
  successRate: number;
  duration: string;
  totalSteps: number;
  passed: number;
  failed: number;
  skipped: number;
  firstFailure?: {
    stepIndex: number;
    error: string;
  };
} {
  const failedSteps = getFailedSteps(result);
  
  return {
    testName: result.testCaseName,
    success: result.success,
    successRate: getSuccessRate(result),
    duration: formatReplayDuration(result),
    totalSteps: result.totalSteps,
    passed: result.passedSteps,
    failed: result.failedSteps,
    skipped: result.skippedSteps,
    firstFailure: failedSteps.length > 0 ? {
      stepIndex: failedSteps[0].stepIndex,
      error: failedSteps[0].error ?? 'Unknown error',
    } : undefined,
  };
}

/**
 * Calculates average step duration
 * 
 * @param result - Replay result
 * @returns Average duration in ms
 */
export function getAverageStepDuration(
  result: import('../types/replay').ReplayResult
): number {
  const completedSteps = result.stepResults.filter(
    r => r.status === 'passed' || r.status === 'failed'
  );
  
  if (completedSteps.length === 0) return 0;
  
  const totalDuration = completedSteps.reduce((sum, r) => sum + r.duration, 0);
  return Math.round(totalDuration / completedSteps.length);
}

/**
 * Finds the slowest steps in a replay
 * 
 * @param result - Replay result
 * @param count - Number of steps to return
 * @returns Array of step results sorted by duration
 */
export function getSlowestSteps(
  result: import('../types/replay').ReplayResult,
  count: number = 5
): import('../types/replay').StepResult[] {
  return [...result.stepResults]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, count);
}

/**
 * Checks if replay should be retried based on failure patterns
 * 
 * @param result - Replay result
 * @returns Whether retry is recommended
 */
export function shouldRetryReplay(
  result: import('../types/replay').ReplayResult
): boolean {
  // Don't retry if succeeded
  if (result.success) return false;
  
  // Don't retry if most steps failed
  const failureRate = result.failedSteps / result.totalSteps;
  if (failureRate > 0.5) return false;
  
  // Retry if only 1-2 steps failed (might be flaky)
  if (result.failedSteps <= 2) return true;
  
  // Retry if failures were at the end (might be timing)
  const failedSteps = getFailedSteps(result);
  const lastStepIndex = result.totalSteps - 1;
  const failuresAtEnd = failedSteps.filter(
    s => s.stepIndex >= lastStepIndex - 2
  ).length;
  
  return failuresAtEnd === result.failedSteps;
}

// ============================================================================
// WAIT CONDITION COMBINATORS
// ============================================================================

/**
 * Creates an AND combination of conditions
 * 
 * @param conditions - Conditions to combine
 * @returns Combined condition check function
 */
export function allOf(
  ...conditions: import('./WaitStrategy').WaitCondition[]
): (strategy: import('./WaitStrategy').WaitStrategy, element: Element | null, options?: import('./WaitStrategy').WaitOptions) => Promise<import('./WaitStrategy').WaitResult> {
  return (strategy, element, options) => strategy.waitForAll(element, conditions, options);
}

/**
 * Creates an OR combination of conditions
 * 
 * @param conditions - Conditions to combine
 * @returns Combined condition check function
 */
export function anyOf(
  ...conditions: import('./WaitStrategy').WaitCondition[]
): (strategy: import('./WaitStrategy').WaitStrategy, element: Element | null, options?: import('./WaitStrategy').WaitOptions) => Promise<import('./WaitStrategy').WaitResult> {
  return (strategy, element, options) => strategy.waitForAny(element, conditions, options);
}

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

/**
 * Creates a debug-enabled replay controller
 * 
 * @param options - Additional options
 * @returns Debug-configured controller with logging
 */
export function createDebugReplayer(options?: {
  logToConsole?: boolean;
  onStepStart?: (step: import('../types/step').RecordedStep, index: number) => void;
  onStepEnd?: (result: import('../types/replay').StepResult) => void;
}): import('./ReplayController').ReplayController {
  const { controller } = createReplaySystem({
    controllerConfig: {
      options: REPLAY_PRESETS.debug,
      onStepComplete: (result) => {
        if (options?.logToConsole) {
          const status = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '○';
          console.log(`[Replay] ${status} Step ${result.stepIndex}: ${result.duration}ms`);
          if (result.error) {
            console.error(`[Replay] Error: ${result.error}`);
          }
        }
        options?.onStepEnd?.(result);
      },
      onProgress: (progress) => {
        if (options?.logToConsole) {
          console.log(`[Replay] Progress: ${progress.percentage}% (${progress.completedSteps}/${progress.totalSteps})`);
        }
        if (progress.currentStep) {
          options?.onStepStart?.(progress.currentStep, progress.currentStepIndex);
        }
      },
    },
    executorConfig: EXECUTOR_PRESETS.visual,
  });
  
  return controller;
}
