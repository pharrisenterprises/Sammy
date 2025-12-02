/**
 * IReplayEngine - Replay Engine Interface
 * @module core/replay/IReplayEngine
 * @version 1.0.0
 * 
 * Defines the contract for replay engine implementations.
 * The replay engine executes recorded steps on live web pages
 * using multi-strategy element finding and action simulation.
 * 
 * ## Features
 * - Single step and batch execution
 * - Configurable timeouts and retry behavior
 * - Execution context with iframe/shadow DOM support
 * - Detailed execution results with timing
 * - Pause/resume/stop control
 * - Event-based progress tracking
 * 
 * @see Step for recorded step format
 * @see LocatorBundle for element locators
 */

import type { Step, StepEventType } from '../types/Step';
import type { LocatorBundle } from '../locators/LocatorBundle';

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

/**
 * Context for step execution
 * Provides all information needed to execute a step
 */
export interface ExecutionContext {
  /** Target document to execute in */
  document: Document;
  
  /** Chrome tab ID (for extension context) */
  tabId?: number;
  
  /** Iframe chain for nested iframe execution */
  iframeChain?: IframeChainInfo[];
  
  /** Shadow host chain for shadow DOM execution */
  shadowHosts?: string[];
  
  /** CSV values for parameterized execution */
  csvValues?: Record<string, string>;
  
  /** Current page URL */
  pageUrl?: string;
  
  /** Whether to capture screenshots on failure */
  captureScreenshots?: boolean;
}

/**
 * Iframe chain information
 */
export interface IframeChainInfo {
  /** Iframe index among siblings */
  index: number;
  
  /** Iframe id attribute */
  id?: string;
  
  /** Iframe name attribute */
  name?: string;
  
  /** Iframe src attribute */
  src?: string;
}

// ============================================================================
// EXECUTION RESULTS
// ============================================================================

/**
 * Step execution status
 */
export type ExecutionStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Result of executing a single step
 */
export interface ExecutionResult {
  /** Step ID */
  stepId: string;
  
  /** Execution status */
  status: ExecutionStatus;
  
  /** Whether execution succeeded */
  success: boolean;
  
  /** Execution duration in milliseconds */
  duration: number;
  
  /** Error message if failed */
  error?: string;
  
  /** Error stack trace */
  errorStack?: string;
  
  /** Which locator strategy succeeded */
  locatorStrategy?: string;
  
  /** Locator confidence score (0-1) */
  locatorConfidence?: number;
  
  /** Number of retry attempts */
  retryAttempts?: number;
  
  /** Screenshot data (base64) if captured */
  screenshot?: string;
  
  /** Timestamp when execution started */
  startTime: number;
  
  /** Timestamp when execution ended */
  endTime: number;
  
  /** Element that was found (for debugging) */
  foundElement?: {
    tagName: string;
    id?: string;
    className?: string;
    textContent?: string;
  };
}

/**
 * Summary of executing multiple steps
 */
export interface ExecutionSummary {
  /** Total number of steps */
  totalSteps: number;
  
  /** Number of passed steps */
  passedSteps: number;
  
  /** Number of failed steps */
  failedSteps: number;
  
  /** Number of skipped steps */
  skippedSteps: number;
  
  /** Total execution duration in milliseconds */
  totalDuration: number;
  
  /** Average step duration */
  averageDuration: number;
  
  /** Individual step results */
  results: ExecutionResult[];
  
  /** Overall success (all steps passed) */
  success: boolean;
  
  /** First error encountered */
  firstError?: string;
  
  /** Timestamp when execution started */
  startTime: number;
  
  /** Timestamp when execution ended */
  endTime: number;
  
  /** Whether execution was stopped early */
  stoppedEarly: boolean;
  
  /** Index of step where execution stopped (if stopped early) */
  stoppedAtStep?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Replay engine configuration
 */
export interface ReplayConfig {
  /** Element find timeout in milliseconds (default: 2000) */
  findTimeout: number;
  
  /** Retry interval in milliseconds (default: 150) */
  retryInterval: number;
  
  /** Maximum retry attempts (default: 13, ~2s with 150ms interval) */
  maxRetries: number;
  
  /** Delay between steps in milliseconds (default: 0) */
  stepDelay: number;
  
  /** Human-like delay range [min, max] in milliseconds */
  humanDelay?: [number, number];
  
  /** Whether to continue on step failure (default: false) */
  continueOnFailure: boolean;
  
  /** Whether to scroll elements into view (default: true) */
  scrollIntoView: boolean;
  
  /** Whether to highlight elements before action (default: false) */
  highlightElements: boolean;
  
  /** Highlight duration in milliseconds (default: 200) */
  highlightDuration: number;
  
  /** Whether to use human-like mouse movement (default: true) */
  humanLikeMouse: boolean;
  
  /** Whether to use React-safe input (default: true) */
  reactSafeInput: boolean;
  
  /** Action timeout in milliseconds (default: 5000) */
  actionTimeout: number;
  
  /** Navigation timeout in milliseconds (default: 30000) */
  navigationTimeout: number;
  
  /** Fuzzy text match threshold (default: 0.4) */
  fuzzyMatchThreshold: number;
  
  /** Bounding box proximity threshold in pixels (default: 200) */
  boundingBoxThreshold: number;
  
  /** Whether to capture screenshots on failure (default: false) */
  captureScreenshots: boolean;
  
  /** Locator strategy priority order */
  locatorPriority?: string[];
}

/**
 * Default replay configuration
 */
export const DEFAULT_REPLAY_CONFIG: ReplayConfig = {
  findTimeout: 2000,
  retryInterval: 150,
  maxRetries: 13,
  stepDelay: 0,
  humanDelay: undefined,
  continueOnFailure: false,
  scrollIntoView: true,
  highlightElements: false,
  highlightDuration: 200,
  humanLikeMouse: true,
  reactSafeInput: true,
  actionTimeout: 5000,
  navigationTimeout: 30000,
  fuzzyMatchThreshold: 0.4,
  boundingBoxThreshold: 200,
  captureScreenshots: false,
  locatorPriority: undefined,
};

/**
 * Retry configuration subset
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  
  /** Retry interval in milliseconds */
  retryInterval: number;
  
  /** Whether to use exponential backoff */
  exponentialBackoff?: boolean;
  
  /** Maximum backoff delay */
  maxBackoffDelay?: number;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Replay event types
 */
export type ReplayEventType =
  | 'execution-started'
  | 'execution-completed'
  | 'execution-stopped'
  | 'execution-paused'
  | 'execution-resumed'
  | 'step-started'
  | 'step-completed'
  | 'step-failed'
  | 'step-skipped'
  | 'element-found'
  | 'element-not-found'
  | 'action-executed'
  | 'retry-attempt'
  | 'error';

/**
 * Replay event data
 */
export interface ReplayEvent {
  /** Event type */
  type: ReplayEventType;
  
  /** Associated step (if applicable) */
  step?: Step;
  
  /** Step index (if applicable) */
  stepIndex?: number;
  
  /** Execution result (for step-completed/step-failed) */
  result?: ExecutionResult;
  
  /** Execution summary (for execution-completed) */
  summary?: ExecutionSummary;
  
  /** Error message (for error events) */
  error?: string;
  
  /** Additional data */
  data?: Record<string, unknown>;
  
  /** Event timestamp */
  timestamp: number;
}

/**
 * Replay event callback
 */
export type ReplayEventCallback = (event: ReplayEvent) => void;

// ============================================================================
// REPLAY ENGINE INTERFACE
// ============================================================================

/**
 * Interface for replay engine implementations
 * 
 * @example
 * ```typescript
 * class MyReplayEngine implements IReplayEngine {
 *   async execute(step: Step, context: ExecutionContext): Promise<ExecutionResult> {
 *     // Find element
 *     const element = await this.findElement(step.bundle, context);
 *     
 *     // Execute action
 *     await this.executeAction(step.event, element, step.value);
 *     
 *     return { success: true, ... };
 *   }
 * }
 * ```
 */
export interface IReplayEngine {
  // ==========================================================================
  // EXECUTION
  // ==========================================================================
  
  /**
   * Execute a single step
   * 
   * @param step - The step to execute
   * @param context - Execution context
   * @returns Promise resolving to execution result
   */
  execute(step: Step, context: ExecutionContext): Promise<ExecutionResult>;
  
  /**
   * Execute multiple steps in sequence
   * 
   * @param steps - Array of steps to execute
   * @param context - Execution context
   * @returns Promise resolving to execution summary
   */
  executeAll(steps: Step[], context: ExecutionContext): Promise<ExecutionSummary>;
  
  // ==========================================================================
  // CONTROL
  // ==========================================================================
  
  /**
   * Pause execution
   * Does nothing if not currently executing
   */
  pause(): void;
  
  /**
   * Resume paused execution
   * Does nothing if not paused
   */
  resume(): void;
  
  /**
   * Stop execution
   * Stops at current step, does not revert
   */
  stop(): void;
  
  /**
   * Check if currently executing
   */
  isExecuting(): boolean;
  
  /**
   * Check if currently paused
   */
  isPaused(): boolean;
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Set configuration
   * 
   * @param config - Partial configuration to merge
   */
  setConfig(config: Partial<ReplayConfig>): void;
  
  /**
   * Get current configuration
   */
  getConfig(): ReplayConfig;
  
  /**
   * Set find timeout
   * 
   * @param ms - Timeout in milliseconds
   */
  setFindTimeout(ms: number): void;
  
  /**
   * Set retry configuration
   * 
   * @param config - Retry configuration
   */
  setRetryConfig(config: RetryConfig): void;
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  /**
   * Register event callback
   * 
   * @param callback - Callback for replay events
   * @returns Unsubscribe function
   */
  addEventListener(callback: ReplayEventCallback): () => void;
  
  /**
   * Register callback for specific event type
   * 
   * @param eventType - Event type to listen for
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  on(eventType: ReplayEventType, callback: ReplayEventCallback): () => void;
}

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

/**
 * Abstract base class for replay engine implementations
 * Provides common functionality for event handling and configuration
 */
export abstract class BaseReplayEngine implements IReplayEngine {
  protected config: ReplayConfig;
  protected eventCallbacks: Set<ReplayEventCallback> = new Set();
  protected typedCallbacks: Map<ReplayEventType, Set<ReplayEventCallback>> = new Map();
  protected executing: boolean = false;
  protected paused: boolean = false;
  protected shouldStop: boolean = false;
  
  constructor(config: Partial<ReplayConfig> = {}) {
    this.config = { ...DEFAULT_REPLAY_CONFIG, ...config };
  }
  
  // ==========================================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ==========================================================================
  
  abstract execute(step: Step, context: ExecutionContext): Promise<ExecutionResult>;
  
  // ==========================================================================
  // BATCH EXECUTION
  // ==========================================================================
  
  async executeAll(steps: Step[], context: ExecutionContext): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const results: ExecutionResult[] = [];
    
    this.executing = true;
    this.shouldStop = false;
    this.paused = false;
    
    this.emitEvent({
      type: 'execution-started',
      timestamp: Date.now(),
      data: { totalSteps: steps.length },
    });
    
    let stoppedEarly = false;
    let stoppedAtStep: number | undefined;
    
    for (let i = 0; i < steps.length; i++) {
      // Check for stop
      if (this.shouldStop) {
        stoppedEarly = true;
        stoppedAtStep = i;
        break;
      }
      
      // Handle pause
      while (this.paused && !this.shouldStop) {
        await this.sleep(100);
      }
      
      if (this.shouldStop) {
        stoppedEarly = true;
        stoppedAtStep = i;
        break;
      }
      
      const step = steps[i];
      
      this.emitEvent({
        type: 'step-started',
        step,
        stepIndex: i,
        timestamp: Date.now(),
      });
      
      try {
        const result = await this.execute(step, context);
        results.push(result);
        
        if (result.success) {
          this.emitEvent({
            type: 'step-completed',
            step,
            stepIndex: i,
            result,
            timestamp: Date.now(),
          });
        } else {
          this.emitEvent({
            type: 'step-failed',
            step,
            stepIndex: i,
            result,
            error: result.error,
            timestamp: Date.now(),
          });
          
          if (!this.config.continueOnFailure) {
            stoppedEarly = true;
            stoppedAtStep = i;
            break;
          }
        }
      } catch (error) {
        const errorResult: ExecutionResult = {
          stepId: step.id,
          status: 'failed',
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          startTime: Date.now(),
          endTime: Date.now(),
        };
        results.push(errorResult);
        
        this.emitEvent({
          type: 'step-failed',
          step,
          stepIndex: i,
          result: errorResult,
          error: errorResult.error,
          timestamp: Date.now(),
        });
        
        if (!this.config.continueOnFailure) {
          stoppedEarly = true;
          stoppedAtStep = i;
          break;
        }
      }
      
      // Step delay
      if (this.config.stepDelay > 0 && i < steps.length - 1) {
        await this.sleep(this.config.stepDelay);
      }
      
      // Human-like delay
      if (this.config.humanDelay && i < steps.length - 1) {
        const [min, max] = this.config.humanDelay;
        const delay = min + Math.random() * (max - min);
        await this.sleep(delay);
      }
    }
    
    this.executing = false;
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    const passedSteps = results.filter(r => r.status === 'passed').length;
    const failedSteps = results.filter(r => r.status === 'failed').length;
    const skippedSteps = steps.length - results.length;
    
    const summary: ExecutionSummary = {
      totalSteps: steps.length,
      passedSteps,
      failedSteps,
      skippedSteps,
      totalDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0,
      results,
      success: failedSteps === 0 && !stoppedEarly,
      firstError: results.find(r => r.error)?.error,
      startTime,
      endTime,
      stoppedEarly,
      stoppedAtStep,
    };
    
    if (stoppedEarly && this.shouldStop) {
      this.emitEvent({
        type: 'execution-stopped',
        summary,
        timestamp: Date.now(),
      });
    } else {
      this.emitEvent({
        type: 'execution-completed',
        summary,
        timestamp: Date.now(),
      });
    }
    
    return summary;
  }
  
  // ==========================================================================
  // CONTROL
  // ==========================================================================
  
  pause(): void {
    if (this.executing && !this.paused) {
      this.paused = true;
      this.emitEvent({
        type: 'execution-paused',
        timestamp: Date.now(),
      });
    }
  }
  
  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.emitEvent({
        type: 'execution-resumed',
        timestamp: Date.now(),
      });
    }
  }
  
  stop(): void {
    if (this.executing) {
      this.shouldStop = true;
    }
  }
  
  isExecuting(): boolean {
    return this.executing;
  }
  
  isPaused(): boolean {
    return this.paused;
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  setConfig(config: Partial<ReplayConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): ReplayConfig {
    return { ...this.config };
  }
  
  setFindTimeout(ms: number): void {
    this.config.findTimeout = ms;
  }
  
  setRetryConfig(config: RetryConfig): void {
    this.config.maxRetries = config.maxRetries;
    this.config.retryInterval = config.retryInterval;
  }
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  addEventListener(callback: ReplayEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }
  
  on(eventType: ReplayEventType, callback: ReplayEventCallback): () => void {
    if (!this.typedCallbacks.has(eventType)) {
      this.typedCallbacks.set(eventType, new Set());
    }
    this.typedCallbacks.get(eventType)!.add(callback);
    return () => this.typedCallbacks.get(eventType)?.delete(callback);
  }
  
  protected emitEvent(event: ReplayEvent): void {
    // Notify general callbacks
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Replay event callback error:', error);
      }
    }
    
    // Notify typed callbacks
    const typedSet = this.typedCallbacks.get(event.type);
    if (typedSet) {
      for (const callback of typedSet) {
        try {
          callback(event);
        } catch (error) {
          console.error('Replay event callback error:', error);
        }
      }
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY TYPES
// ============================================================================

/**
 * Factory function type for creating replay engines
 */
export type ReplayEngineFactory = (config?: Partial<ReplayConfig>) => IReplayEngine;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an empty execution result
 */
export function createEmptyResult(stepId: string): ExecutionResult {
  const now = Date.now();
  return {
    stepId,
    status: 'pending',
    success: false,
    duration: 0,
    startTime: now,
    endTime: now,
  };
}

/**
 * Create a success result
 */
export function createSuccessResult(
  stepId: string,
  duration: number,
  options?: Partial<ExecutionResult>
): ExecutionResult {
  const now = Date.now();
  return {
    stepId,
    status: 'passed',
    success: true,
    duration,
    startTime: now - duration,
    endTime: now,
    ...options,
  };
}

/**
 * Create a failure result
 */
export function createFailureResult(
  stepId: string,
  error: string,
  duration: number = 0,
  options?: Partial<ExecutionResult>
): ExecutionResult {
  const now = Date.now();
  return {
    stepId,
    status: 'failed',
    success: false,
    duration,
    error,
    startTime: now - duration,
    endTime: now,
    ...options,
  };
}

/**
 * Create an empty execution summary
 */
export function createEmptySummary(): ExecutionSummary {
  const now = Date.now();
  return {
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: 0,
    skippedSteps: 0,
    totalDuration: 0,
    averageDuration: 0,
    results: [],
    success: true,
    startTime: now,
    endTime: now,
    stoppedEarly: false,
  };
}

/**
 * Merge execution context with defaults
 */
export function mergeContext(
  context: Partial<ExecutionContext>,
  defaults: Partial<ExecutionContext>
): ExecutionContext {
  return {
    document: context.document || defaults.document || document,
    tabId: context.tabId ?? defaults.tabId,
    iframeChain: context.iframeChain || defaults.iframeChain,
    shadowHosts: context.shadowHosts || defaults.shadowHosts,
    csvValues: { ...defaults.csvValues, ...context.csvValues },
    pageUrl: context.pageUrl || defaults.pageUrl,
    captureScreenshots: context.captureScreenshots ?? defaults.captureScreenshots,
  };
}
