/**
 * @fileoverview Step execution utilities for replay engine
 * @module core/replay/step-executor
 * @version 1.0.0
 * 
 * This module provides detailed step execution utilities with validation,
 * error handling, and pre/post execution hooks.
 * 
 * STEP EXECUTION PHASES:
 * 1. Validate - Check step has required properties
 * 2. Pre-execute - Run pre-hooks, prepare context
 * 3. Locate - Find element using locator strategies
 * 4. Execute - Perform the action (click/input/enter)
 * 5. Verify - Confirm action completed
 * 6. Post-execute - Run post-hooks, cleanup
 * 
 * @see PHASE_4_SPECIFICATIONS.md for replay specifications
 * @see replay-engine_breakdown.md for engine details
 */

import type { Step, StepEvent } from '../types';
import {
  executeStrategy,
  performClick,
  performInput,
  performEnter,
  isElementVisible,
  isElementInteractable,
  waitForElementStable
} from '../locators';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Step execution options
 */
export interface StepExecutionOptions {
  /** Timeout for element location (ms) */
  timeout?: number;
  /** Wait for element to be stable before interacting */
  waitForStable?: boolean;
  /** Stability check interval (ms) */
  stabilityInterval?: number;
  /** Scroll element into view */
  scrollIntoView?: boolean;
  /** Verify element is interactable */
  verifyInteractable?: boolean;
  /** Custom value to inject (overrides step.value) */
  injectedValue?: string;
  /** Delay after execution (ms) */
  delayAfter?: number;
  /** Search in iframes */
  searchIframes?: boolean;
  /** Search in shadow DOM */
  searchShadowDom?: boolean;
}

/**
 * Step execution context
 */
export interface StepExecutionContext {
  /** Step being executed */
  step: Step;
  /** Options for execution */
  options: Required<StepExecutionOptions>;
  /** Located element (if found) */
  element: Element | null;
  /** Locator strategy used */
  strategy: string | null;
  /** Locator confidence */
  confidence: number;
  /** Execution start time */
  startTime: number;
  /** Any error that occurred */
  error: Error | null;
  /** Custom data from hooks */
  data: Record<string, unknown>;
}

/**
 * Detailed execution result
 */
export interface StepExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Step that was executed */
  step: Step;
  /** Error details if failed */
  error?: StepExecutionError;
  /** Located element */
  element?: Element;
  /** Value that was used (for input) */
  usedValue?: string;
  /** Locator strategy used */
  locatorStrategy?: string;
  /** Locator confidence (0-100) */
  locatorConfidence?: number;
  /** Execution duration (ms) */
  duration: number;
  /** Execution phases completed */
  phases: ExecutionPhase[];
}

/**
 * Execution phase info
 */
export interface ExecutionPhase {
  /** Phase name */
  name: string;
  /** Whether phase succeeded */
  success: boolean;
  /** Duration (ms) */
  duration: number;
  /** Error if failed */
  error?: string;
}

/**
 * Detailed error information
 */
export interface StepExecutionError {
  /** Error code */
  code: StepErrorCode;
  /** Human-readable message */
  message: string;
  /** Detailed description */
  details?: string;
  /** Phase where error occurred */
  phase: string;
  /** Suggestions for fixing */
  suggestions: string[];
  /** Original error */
  originalError?: Error;
}

/**
 * Error codes for step execution
 */
export type StepErrorCode =
  | 'VALIDATION_FAILED'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_NOT_VISIBLE'
  | 'ELEMENT_NOT_INTERACTABLE'
  | 'ELEMENT_NOT_STABLE'
  | 'CLICK_FAILED'
  | 'INPUT_FAILED'
  | 'ENTER_FAILED'
  | 'NAVIGATION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN_EVENT'
  | 'UNKNOWN_ERROR';

/**
 * Pre-execution hook
 */
export type PreExecuteHook = (
  context: StepExecutionContext
) => Promise<boolean> | boolean;

/**
 * Post-execution hook
 */
export type PostExecuteHook = (
  context: StepExecutionContext,
  result: StepExecutionResult
) => Promise<void> | void;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default execution options
 */
export const DEFAULT_EXECUTION_OPTIONS: Required<StepExecutionOptions> = {
  timeout: 5000,
  waitForStable: true,
  stabilityInterval: 100,
  scrollIntoView: true,
  verifyInteractable: true,
  injectedValue: '',
  delayAfter: 100,
  searchIframes: true,
  searchShadowDom: true
};

/**
 * Error messages by code
 */
export const ERROR_MESSAGES: Record<StepErrorCode, string> = {
  VALIDATION_FAILED: 'Step validation failed',
  ELEMENT_NOT_FOUND: 'Could not find element on page',
  ELEMENT_NOT_VISIBLE: 'Element exists but is not visible',
  ELEMENT_NOT_INTERACTABLE: 'Element is not interactable (disabled or hidden)',
  ELEMENT_NOT_STABLE: 'Element position is not stable',
  CLICK_FAILED: 'Failed to click element',
  INPUT_FAILED: 'Failed to input value into element',
  ENTER_FAILED: 'Failed to press Enter on element',
  NAVIGATION_FAILED: 'Navigation to URL failed',
  TIMEOUT: 'Operation timed out',
  UNKNOWN_EVENT: 'Unknown step event type',
  UNKNOWN_ERROR: 'An unknown error occurred'
};

// ============================================================================
// STEP EXECUTOR CLASS
// ============================================================================

/**
 * Step Executor
 * 
 * Handles individual step execution with detailed phases and hooks.
 * 
 * @example
 * ```typescript
 * const executor = new StepExecutor();
 * 
 * // Add hooks
 * executor.addPreHook(async (ctx) => {
 *   console.log('Before step:', ctx.step.event);
 *   return true;
 * });
 * 
 * // Execute step
 * const result = await executor.execute(step, { timeout: 10000 });
 * 
 * if (!result.success) {
 *   console.error(result.error?.message);
 * }
 * ```
 */
export class StepExecutor {
  private preHooks: PreExecuteHook[] = [];
  private postHooks: PostExecuteHook[] = [];

  /**
   * Add pre-execution hook
   */
  addPreHook(hook: PreExecuteHook): void {
    this.preHooks.push(hook);
  }

  /**
   * Add post-execution hook
   */
  addPostHook(hook: PostExecuteHook): void {
    this.postHooks.push(hook);
  }

  /**
   * Remove all hooks
   */
  clearHooks(): void {
    this.preHooks = [];
    this.postHooks = [];
  }

  /**
   * Execute a step
   * 
   * @param step - Step to execute
   * @param options - Execution options
   * @returns Detailed execution result
   */
  async execute(
    step: Step,
    options: StepExecutionOptions = {}
  ): Promise<StepExecutionResult> {
    const opts = { ...DEFAULT_EXECUTION_OPTIONS, ...options };
    const phases: ExecutionPhase[] = [];
    const startTime = performance.now();

    // Create context
    const context: StepExecutionContext = {
      step,
      options: opts,
      element: null,
      strategy: null,
      confidence: 0,
      startTime,
      error: null,
      data: {}
    };

    try {
      // Phase 1: Validate
      const validateResult = await this.executePhase(
        'validate',
        () => this.validateStep(step),
        phases
      );
      
      if (!validateResult.success) {
        return this.createErrorResult(step, 'VALIDATION_FAILED', phases, startTime, {
          details: validateResult.error,
          phase: 'validate'
        });
      }

      // Phase 2: Pre-execute hooks
      const preHookResult = await this.executePhase(
        'pre-execute',
        () => this.runPreHooks(context),
        phases
      );

      if (!preHookResult.success) {
        return this.createErrorResult(step, 'VALIDATION_FAILED', phases, startTime, {
          details: 'Pre-execution hook returned false',
          phase: 'pre-execute'
        });
      }

      // Phase 3: Execute based on event type
      let result: StepExecutionResult;

      switch (step.event) {
        case 'open':
          result = await this.executeOpen(step, context, phases);
          break;
        
        case 'click':
          result = await this.executeClick(step, context, phases);
          break;
        
        case 'input':
          result = await this.executeInput(step, context, phases);
          break;
        
        case 'enter':
          result = await this.executeEnter(step, context, phases);
          break;
        
        default:
          return this.createErrorResult(step, 'UNKNOWN_EVENT', phases, startTime, {
            details: `Unknown event type: ${step.event}`,
            phase: 'execute'
          });
      }

      // Phase 4: Post-execute hooks
      await this.executePhase(
        'post-execute',
        () => this.runPostHooks(context, result),
        phases
      );

      // Add delay after
      if (opts.delayAfter > 0) {
        await this.delay(opts.delayAfter);
      }

      return {
        ...result,
        phases,
        duration: performance.now() - startTime
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.error = err;

      return this.createErrorResult(step, 'UNKNOWN_ERROR', phases, startTime, {
        details: err.message,
        phase: 'unknown',
        originalError: err
      });
    }
  }

  // ==========================================================================
  // EVENT EXECUTORS
  // ==========================================================================

  /**
   * Execute 'open' step
   */
  private async executeOpen(
    step: Step,
    context: StepExecutionContext,
    phases: ExecutionPhase[]
  ): Promise<StepExecutionResult> {
    const startTime = context.startTime;
    const url = step.value || step.bundle?.pageUrl;

    if (!url) {
      return this.createErrorResult(step, 'NAVIGATION_FAILED', phases, startTime, {
        details: 'No URL specified',
        phase: 'execute'
      });
    }

    const executeResult = await this.executePhase(
      'navigate',
      async () => {
        // In content script, we verify URL rather than navigate
        const currentUrl = window.location.href;
        const targetPath = new URL(url).pathname;
        
        if (!currentUrl.includes(targetPath)) {
          console.warn(`URL mismatch: expected ${url}, got ${currentUrl}`);
        }
        return true;
      },
      phases
    );

    return {
      success: executeResult.success,
      step,
      usedValue: url,
      duration: performance.now() - startTime,
      phases
    };
  }

  /**
   * Execute 'click' step
   */
  private async executeClick(
    step: Step,
    context: StepExecutionContext,
    phases: ExecutionPhase[]
  ): Promise<StepExecutionResult> {
    const startTime = context.startTime;
    const opts = context.options;

    if (!step.bundle) {
      return this.createErrorResult(step, 'VALIDATION_FAILED', phases, startTime, {
        details: 'No bundle provided',
        phase: 'validate'
      });
    }

    // Locate element
    const locateResult = await this.executePhase(
      'locate',
      async () => {
        const result = await executeStrategy(step.bundle!, {
          timeout: opts.timeout,
          searchIframes: opts.searchIframes,
          searchShadowDom: opts.searchShadowDom
        });

        if (!result.found || !result.element) {
          throw new Error('Element not found');
        }

        context.element = result.element;
        context.strategy = result.strategy;
        context.confidence = result.confidence;
        return true;
      },
      phases
    );

    if (!locateResult.success) {
      return this.createErrorResult(step, 'ELEMENT_NOT_FOUND', phases, startTime, {
        phase: 'locate'
      });
    }

    // Verify interactable
    if (opts.verifyInteractable) {
      const verifyResult = await this.executePhase(
        'verify',
        () => this.verifyElement(context.element!),
        phases
      );

      if (!verifyResult.success) {
        return this.createErrorResult(step, 'ELEMENT_NOT_INTERACTABLE', phases, startTime, {
          phase: 'verify',
          details: verifyResult.error
        });
      }
    }

    // Wait for stable
    if (opts.waitForStable) {
      await this.executePhase(
        'stabilize',
        () => waitForElementStable(context.element!, opts.timeout, opts.stabilityInterval),
        phases
      );
    }

    // Execute click
    const clickResult = await this.executePhase(
      'click',
      async () => {
        await performClick(context.element!, {
          scrollIntoView: opts.scrollIntoView,
          highlight: false
        });
        return true;
      },
      phases
    );

    if (!clickResult.success) {
      return this.createErrorResult(step, 'CLICK_FAILED', phases, startTime, {
        phase: 'click',
        details: clickResult.error
      });
    }

    return {
      success: true,
      step,
      element: context.element!,
      locatorStrategy: context.strategy || undefined,
      locatorConfidence: context.confidence,
      duration: performance.now() - startTime,
      phases
    };
  }

  /**
   * Execute 'input' step
   */
  private async executeInput(
    step: Step,
    context: StepExecutionContext,
    phases: ExecutionPhase[]
  ): Promise<StepExecutionResult> {
    const startTime = context.startTime;
    const opts = context.options;
    const value = opts.injectedValue || step.value;

    if (!step.bundle) {
      return this.createErrorResult(step, 'VALIDATION_FAILED', phases, startTime, {
        details: 'No bundle provided',
        phase: 'validate'
      });
    }

    // Locate element
    const locateResult = await this.executePhase(
      'locate',
      async () => {
        const result = await executeStrategy(step.bundle!, {
          timeout: opts.timeout,
          searchIframes: opts.searchIframes,
          searchShadowDom: opts.searchShadowDom
        });

        if (!result.found || !result.element) {
          throw new Error('Element not found');
        }

        context.element = result.element;
        context.strategy = result.strategy;
        context.confidence = result.confidence;
        return true;
      },
      phases
    );

    if (!locateResult.success) {
      return this.createErrorResult(step, 'ELEMENT_NOT_FOUND', phases, startTime, {
        phase: 'locate'
      });
    }

    // Verify interactable
    if (opts.verifyInteractable) {
      const verifyResult = await this.executePhase(
        'verify',
        () => this.verifyElement(context.element!),
        phases
      );

      if (!verifyResult.success) {
        return this.createErrorResult(step, 'ELEMENT_NOT_INTERACTABLE', phases, startTime, {
          phase: 'verify',
          details: verifyResult.error
        });
      }
    }

    // Wait for stable
    if (opts.waitForStable) {
      await this.executePhase(
        'stabilize',
        () => waitForElementStable(context.element!, opts.timeout, opts.stabilityInterval),
        phases
      );
    }

    // Execute input
    const inputResult = await this.executePhase(
      'input',
      async () => {
        await performInput(context.element!, value, {
          scrollIntoView: opts.scrollIntoView,
          highlight: false
        });
        return true;
      },
      phases
    );

    if (!inputResult.success) {
      return this.createErrorResult(step, 'INPUT_FAILED', phases, startTime, {
        phase: 'input',
        details: inputResult.error
      });
    }

    return {
      success: true,
      step,
      element: context.element!,
      usedValue: value,
      locatorStrategy: context.strategy || undefined,
      locatorConfidence: context.confidence,
      duration: performance.now() - startTime,
      phases
    };
  }

  /**
   * Execute 'enter' step
   */
  private async executeEnter(
    step: Step,
    context: StepExecutionContext,
    phases: ExecutionPhase[]
  ): Promise<StepExecutionResult> {
    const startTime = context.startTime;
    const opts = context.options;

    if (!step.bundle) {
      return this.createErrorResult(step, 'VALIDATION_FAILED', phases, startTime, {
        details: 'No bundle provided',
        phase: 'validate'
      });
    }

    // Locate element
    const locateResult = await this.executePhase(
      'locate',
      async () => {
        const result = await executeStrategy(step.bundle!, {
          timeout: opts.timeout,
          searchIframes: opts.searchIframes,
          searchShadowDom: opts.searchShadowDom
        });

        if (!result.found || !result.element) {
          throw new Error('Element not found');
        }

        context.element = result.element;
        context.strategy = result.strategy;
        context.confidence = result.confidence;
        return true;
      },
      phases
    );

    if (!locateResult.success) {
      return this.createErrorResult(step, 'ELEMENT_NOT_FOUND', phases, startTime, {
        phase: 'locate'
      });
    }

    // Wait for stable
    if (opts.waitForStable) {
      await this.executePhase(
        'stabilize',
        () => waitForElementStable(context.element!, opts.timeout, opts.stabilityInterval),
        phases
      );
    }

    // Execute enter
    const enterResult = await this.executePhase(
      'enter',
      async () => {
        await performEnter(context.element!, {
          scrollIntoView: opts.scrollIntoView,
          highlight: false
        });
        return true;
      },
      phases
    );

    if (!enterResult.success) {
      return this.createErrorResult(step, 'ENTER_FAILED', phases, startTime, {
        phase: 'enter',
        details: enterResult.error
      });
    }

    return {
      success: true,
      step,
      element: context.element!,
      locatorStrategy: context.strategy || undefined,
      locatorConfidence: context.confidence,
      duration: performance.now() - startTime,
      phases
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Execute a phase and track timing
   */
  private async executePhase(
    name: string,
    fn: () => Promise<boolean | void> | boolean | void,
    phases: ExecutionPhase[]
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const success = result === false ? false : true; // void/undefined = success
      phases.push({
        name,
        success,
        duration: performance.now() - startTime
      });
      return { success };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      phases.push({
        name,
        success: false,
        duration: performance.now() - startTime,
        error: message
      });
      return { success: false, error: message };
    }
  }

  /**
   * Validate step has required properties
   */
  private validateStep(step: Step): boolean {
    if (!step) {
      throw new Error('Step is null or undefined');
    }

    if (!step.event) {
      throw new Error('Step is missing event type');
    }

    const validEvents: StepEvent[] = ['open', 'click', 'input', 'enter'];
    if (!validEvents.includes(step.event)) {
      throw new Error(`Invalid event type: ${step.event}`);
    }

    if (!step.bundle) {
      throw new Error('Step is missing bundle');
    }

    if (step.event !== 'open' && !step.bundle.tag) {
      throw new Error('Bundle is missing tag for non-open step');
    }

    return true;
  }

  /**
   * Verify element is usable
   */
  private verifyElement(element: Element): boolean {
    if (!isElementVisible(element)) {
      throw new Error('Element is not visible');
    }

    if (!isElementInteractable(element)) {
      throw new Error('Element is not interactable');
    }

    return true;
  }

  /**
   * Run pre-execution hooks
   */
  private async runPreHooks(context: StepExecutionContext): Promise<boolean> {
    for (const hook of this.preHooks) {
      const result = await hook(context);
      if (!result) return false;
    }
    return true;
  }

  /**
   * Run post-execution hooks
   */
  private async runPostHooks(
    context: StepExecutionContext,
    result: StepExecutionResult
  ): Promise<void> {
    for (const hook of this.postHooks) {
      await hook(context, result);
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(
    step: Step,
    code: StepErrorCode,
    phases: ExecutionPhase[],
    startTime: number,
    errorInfo: {
      details?: string;
      phase: string;
      originalError?: Error;
    }
  ): StepExecutionResult {
    const error: StepExecutionError = {
      code,
      message: ERROR_MESSAGES[code],
      details: errorInfo.details,
      phase: errorInfo.phase,
      suggestions: this.getSuggestions(code),
      originalError: errorInfo.originalError
    };

    return {
      success: false,
      step,
      error,
      duration: performance.now() - startTime,
      phases
    };
  }

  /**
   * Get suggestions for error code
   */
  private getSuggestions(code: StepErrorCode): string[] {
    const suggestions: Record<StepErrorCode, string[]> = {
      VALIDATION_FAILED: ['Check step has valid event type', 'Ensure bundle is present'],
      ELEMENT_NOT_FOUND: [
        'Verify the page is fully loaded',
        'Check if element is dynamically generated',
        'Try increasing timeout',
        'Re-record the step with updated locators'
      ],
      ELEMENT_NOT_VISIBLE: [
        'Check if element is hidden by CSS',
        'Scroll the page to reveal element',
        'Wait for animations to complete'
      ],
      ELEMENT_NOT_INTERACTABLE: [
        'Check if element is disabled',
        'Verify no overlay is blocking the element',
        'Wait for element to become enabled'
      ],
      ELEMENT_NOT_STABLE: [
        'Wait for page animations to complete',
        'Increase stability check interval'
      ],
      CLICK_FAILED: [
        'Verify element is clickable',
        'Check for overlaying elements'
      ],
      INPUT_FAILED: [
        'Verify element accepts input',
        'Check if element is readonly'
      ],
      ENTER_FAILED: [
        'Verify element can receive keyboard events',
        'Try focusing the element first'
      ],
      NAVIGATION_FAILED: [
        'Check if URL is correct',
        'Verify network connectivity'
      ],
      TIMEOUT: [
        'Increase timeout value',
        'Check page load speed'
      ],
      UNKNOWN_EVENT: [
        'Check step event is one of: open, click, input, enter'
      ],
      UNKNOWN_ERROR: [
        'Check browser console for errors',
        'Try re-recording the step'
      ]
    };

    return suggestions[code] || [];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Execute a single step
 */
export async function executeStep(
  step: Step,
  options?: StepExecutionOptions
): Promise<StepExecutionResult> {
  const executor = new StepExecutor();
  return executor.execute(step, options);
}

/**
 * Execute multiple steps sequentially
 */
export async function executeSteps(
  steps: Step[],
  options?: StepExecutionOptions & {
    stopOnFailure?: boolean;
    delayBetween?: number;
  }
): Promise<StepExecutionResult[]> {
  const executor = new StepExecutor();
  const results: StepExecutionResult[] = [];
  const { stopOnFailure = true, delayBetween = 500, ...execOptions } = options || {};

  for (const step of steps) {
    const result = await executor.execute(step, execOptions);
    results.push(result);

    if (!result.success && stopOnFailure) {
      break;
    }

    if (delayBetween > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }

  return results;
}

/**
 * Validate step before execution
 */
export function validateStep(step: Step): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!step) {
    errors.push('Step is null or undefined');
    return { valid: false, errors };
  }

  if (!step.event) {
    errors.push('Step is missing event type');
  } else if (!['open', 'click', 'input', 'enter'].includes(step.event)) {
    errors.push(`Invalid event type: ${step.event}`);
  }

  if (!step.bundle) {
    errors.push('Step is missing bundle');
  } else {
    if (step.event !== 'open' && !step.bundle.tag) {
      errors.push('Bundle is missing tag for non-open step');
    }
    if (step.event !== 'open' && !step.bundle.xpath && !step.bundle.id && !step.bundle.css) {
      errors.push('Bundle has no reliable locator');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get human-readable step description
 */
export function describeStep(step: Step): string {
  const target = step.bundle?.id || step.bundle?.name || step.bundle?.tag || 'element';
  
  switch (step.event) {
    case 'open':
      return `Navigate to ${step.value || step.bundle?.pageUrl || 'URL'}`;
    case 'click':
      return `Click on ${target}`;
    case 'input':
      return `Enter "${step.value}" into ${target}`;
    case 'enter':
      return `Press Enter on ${target}`;
    default:
      return `Unknown action on ${target}`;
  }
}

/**
 * Get error summary from result
 */
export function getErrorSummary(result: StepExecutionResult): string | null {
  if (result.success) return null;
  
  if (!result.error) return 'Unknown error';
  
  let summary = result.error.message;
  
  if (result.error.details) {
    summary += `: ${result.error.details}`;
  }
  
  return summary;
}

/**
 * Create execution report
 */
export function createExecutionReport(results: StepExecutionResult[]): {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  totalDuration: number;
  averageDuration: number;
  errors: Array<{ step: number; error: string }>;
  summary: string;
} {
  const totalSteps = results.length;
  const passedSteps = results.filter(r => r.success).length;
  const failedSteps = totalSteps - passedSteps;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const averageDuration = totalSteps > 0 ? totalDuration / totalSteps : 0;

  const errors = results
    .map((r, index) => ({ result: r, index }))
    .filter(({ result }) => !result.success)
    .map(({ result, index }) => ({
      step: index + 1,
      error: getErrorSummary(result) || 'Unknown error'
    }));

  const passed = failedSteps === 0;
  const summary = passed
    ? `All ${totalSteps} steps passed in ${Math.round(totalDuration)}ms`
    : `${failedSteps}/${totalSteps} steps failed`;

  return {
    totalSteps,
    passedSteps,
    failedSteps,
    totalDuration: Math.round(totalDuration),
    averageDuration: Math.round(averageDuration),
    errors,
    summary
  };
}
