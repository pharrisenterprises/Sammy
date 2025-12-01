/**
 * Replay Type Definitions
 * @module core/types/replay
 * 
 * Type definitions for replay functionality.
 * These types are used by ReplayController and related components.
 */

import type { RecordedStep } from './step';

/**
 * Replay state values
 */
export type ReplayState = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Replay session
 */
export interface ReplaySession {
  /** Session identifier */
  id: string;
  /** Test case ID */
  testCaseId?: string;
  /** Test case name */
  testCaseName: string;
  /** Session start time */
  startTime: number;
  /** Session end time */
  endTime: number | null;
  /** Current state */
  state: ReplayState;
  /** Steps to replay */
  steps: RecordedStep[];
  /** Step results */
  results: StepResult[];
  /** Session metadata */
  metadata: Record<string, unknown>;
}

/**
 * Replay options
 */
export interface ReplayOptions {
  /** Timeout for each step in ms */
  stepTimeout: number;
  /** Number of retry attempts per step */
  retryAttempts: number;
  /** Delay between retries in ms */
  retryDelay: number;
  /** Delay between steps in ms */
  waitBetweenSteps: number;
  /** Continue execution on step failure */
  continueOnFailure: boolean;
  /** Capture screenshot on failure */
  screenshotOnFailure: boolean;
  /** Capture screenshot on success */
  screenshotOnSuccess: boolean;
  /** Highlight elements during replay */
  highlightElements: boolean;
  /** Slow motion mode */
  slowMotion: boolean;
  /** Slow motion delay in ms */
  slowMotionDelay: number;
  /** Validate locators before execution */
  validateLocators: boolean;
  /** Maximum concurrent steps */
  maxConcurrentSteps: number;
}

/**
 * Step execution result
 */
export interface StepResult {
  /** Step ID */
  stepId: string;
  /** Step index in sequence */
  stepIndex: number;
  /** Result status */
  status: 'passed' | 'failed' | 'skipped';
  /** Execution start time */
  startTime: number;
  /** Execution end time */
  endTime: number;
  /** Execution duration in ms */
  duration: number;
  /** Number of attempts */
  attempts: number;
  /** Error message if failed */
  error?: string;
  /** Screenshot if captured */
  screenshot?: string;
  /** Actual value found */
  actualValue?: string;
  /** Whether element was found */
  elementFound?: boolean;
  /** Locator used */
  locatorUsed?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Replay result
 */
export interface ReplayResult {
  /** Session ID */
  sessionId: string;
  /** Test case ID */
  testCaseId?: string;
  /** Test case name */
  testCaseName: string;
  /** Whether replay succeeded */
  success: boolean;
  /** Total steps */
  totalSteps: number;
  /** Passed steps */
  passedSteps: number;
  /** Failed steps */
  failedSteps: number;
  /** Skipped steps */
  skippedSteps: number;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Total duration in ms */
  duration: number;
  /** Step results */
  stepResults: StepResult[];
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Replay statistics
 */
export interface ReplayStats {
  /** Number of replays started */
  replaysStarted: number;
  /** Number of replays completed successfully */
  replaysCompleted: number;
  /** Number of replays failed */
  replaysFailed: number;
  /** Number of steps passed */
  stepsPassed: number;
  /** Number of steps failed */
  stepsFailed: number;
  /** Number of steps skipped */
  stepsSkipped: number;
  /** Total duration across all replays */
  totalDuration: number;
  /** Number of errors encountered */
  errors: number;
}
