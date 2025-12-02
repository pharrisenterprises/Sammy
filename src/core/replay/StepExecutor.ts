/**
 * StepExecutor - Complete Step Execution
 * @module core/replay/StepExecutor
 * @version 1.0.0
 * 
 * Executes complete Step objects by combining ElementFinder and ActionExecutor.
 * Handles all step event types (click, input, enter, open) and provides
 * detailed execution results.
 * 
 * ## Execution Flow
 * 1. Validate step data
 * 2. Resolve target document (iframe/shadow DOM)
 * 3. Find element using LocatorBundle
 * 4. Execute action based on event type
 * 5. Return detailed result
 * 
 * ## CSV Value Injection
 * For input steps, values can be injected from CSV data:
 * - Direct match: csvRow[step.label]
 * - Mapped match: csvRow[mappedField] where mappedField → step.label
 * 
 * @example
 * ```typescript
 * const executor = new StepExecutor();
 * 
 * const result = await executor.execute(step, {
 *   document,
 *   csvValues: { email: 'test@example.com' },
 * });
 * 
 * if (result.success) {
 *   console.log('Step passed in', result.duration, 'ms');
 * }
 * ```
 */

import type { Step, StepEventType } from '../types/Step';
import type { LocatorBundle } from '../locators/LocatorBundle';
import type { ExecutionResult, ExecutionStatus } from './IReplayEngine';
import { ElementFinder, createElementFinder, type FindOptions, type FindResult } from './ElementFinder';
import { ActionExecutor, createActionExecutor, type ActionOptions, type ActionResult } from './ActionExecutor';
import { type ReplayConfig, DEFAULT_REPLAY_CONFIG, type TimingConfig } from './ReplayConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Execution context for step execution
 */
export interface StepExecutionContext {
  /** Target document (defaults to window.document) */
  document?: Document;
  
  /** Shadow root to search within */
  shadowRoot?: ShadowRoot;
  
  /** Iframe document to search within */
  iframeDocument?: Document;
  
  /** CSV values for parameterized input */
  csvValues?: Record<string, string>;
  
  /** Field mappings (csvColumn → stepLabel) */
  fieldMappings?: Record<string, string>;
  
  /** Current page URL */
  pageUrl?: string;
  
  /** Tab ID (for navigation) */
  tabId?: number;
}

/**
 * Step execution options
 */
export interface StepExecutionOptions {
  /** Element find timeout in ms (default: 2000) */
  findTimeout?: number;
  
  /** Retry interval in ms (default: 150) */
  retryInterval?: number;
  
  /** Maximum retries (default: 13) */
  maxRetries?: number;
  
  /** Whether to use human-like timing (default: true) */
  humanLike?: boolean;
  
  /** Whether to scroll into view (default: true) */
  scrollIntoView?: boolean;
  
  /** Whether to highlight element (default: false) */
  highlightElement?: boolean;
  
  /** Highlight duration in ms (default: 200) */
  highlightDuration?: number;
  
  /** Whether to continue on element not found (default: false) */
  skipOnNotFound?: boolean;
  
  /** Pre-action delay in ms (default: 0) */
  preActionDelay?: number;
  
  /** Post-action delay in ms (default: 0) */
  postActionDelay?: number;
}

/**
 * Default execution options
 */
export const DEFAULT_EXECUTION_OPTIONS: Required<StepExecutionOptions> = {
  findTimeout: 2000,
  retryInterval: 150,
  maxRetries: 13,
  humanLike: true,
  scrollIntoView: true,
  highlightElement: false,
  highlightDuration: 200,
  skipOnNotFound: false,
  preActionDelay: 0,
  postActionDelay: 0,
};

/**
 * Detailed step execution result
 */
export interface StepExecutionResult extends ExecutionResult {
  /** The step that was executed */
  step: Step;
  
  /** Element find result */
  findResult?: FindResult;
  
  /** Action execution result */
  actionResult?: ActionResult;
  
  /** Value that was used (for input steps) */
  usedValue?: string;
  
  /** Source of value (recorded, csv-direct, csv-mapped) */
  valueSource?: 'recorded' | 'csv-direct' | 'csv-mapped' | 'none';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get step ID from step
 */
function getStepId(step: Step): string {
  return step.id?.toString() || `step-${Date.now()}`;
}

/**
 * Validate step has required fields
 */
function validateStep(step: Step): { valid: boolean; error?: string } {
  if (!step) {
    return { valid: false, error: 'Step is null or undefined' };
  }
  
  if (!step.event) {
    return { valid: false, error: 'Step missing event type' };
  }
  
  const validEvents: StepEventType[] = ['click', 'input', 'enter', 'open'];
  if (!validEvents.includes(step.event as StepEventType)) {
    return { valid: false, error: `Invalid event type: ${step.event}` };
  }
  
  // Open events don't need a bundle
  if (step.event === 'open') {
    return { valid: true };
  }
  
  // Other events need either bundle or path
  if (!step.bundle && !step.path) {
    return { valid: false, error: 'Step missing bundle and path' };
  }
  
  return { valid: true };
}

/**
 * Resolve value for input step
 */
function resolveInputValue(
  step: Step,
  context: StepExecutionContext
): { value: string; source: 'recorded' | 'csv-direct' | 'csv-mapped' | 'none' } {
  const { csvValues, fieldMappings } = context;
  
  // Try direct CSV match by label
  if (csvValues && step.label && csvValues[step.label] !== undefined) {
    return { value: csvValues[step.label], source: 'csv-direct' };
  }
  
  // Try mapped CSV match
  if (csvValues && fieldMappings) {
    for (const [csvColumn, stepLabel] of Object.entries(fieldMappings)) {
      if (stepLabel === step.label && csvValues[csvColumn] !== undefined) {
        return { value: csvValues[csvColumn], source: 'csv-mapped' };
      }
    }
  }
  
  // Fall back to recorded value
  if (step.value !== undefined && step.value !== null && step.value !== '') {
    return { value: step.value, source: 'recorded' };
  }
  
  return { value: '', source: 'none' };
}

/**
 * Create bundle from step for element finding
 */
function getBundleFromStep(step: Step): LocatorBundle | null {
  if (step.bundle) {
    return step.bundle;
  }
  
  // Create minimal bundle from step properties
  if (step.path) {
    return {
      tag: 'input', // Default, will be overridden by actual element
      id: null,
      name: null,
      placeholder: null,
      aria: null,
      dataAttrs: {},
      text: step.label || '',
      visibleText: step.label || '',
      css: '',
      xpath: step.path,
      classes: [],
      pageUrl: '',
      bounding: step.x !== undefined && step.y !== undefined
        ? { x: step.x, y: step.y, width: 100, height: 30 }
        : null,
      iframeChain: null,
      shadowHosts: null,
    };
  }
  
  return null;
}

/**
 * Highlight element temporarily
 */
async function highlightElement(
  element: Element,
  duration: number
): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  
  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  
  element.style.outline = '2px solid #ff0000';
  element.style.outlineOffset = '2px';
  
  await sleep(duration);
  
  element.style.outline = originalOutline;
  element.style.outlineOffset = originalOutlineOffset;
}

// ============================================================================
// STEP EXECUTOR CLASS
// ============================================================================

/**
 * Executes complete Step objects
 */
export class StepExecutor {
  private elementFinder: ElementFinder;
  private actionExecutor: ActionExecutor;
  private options: Required<StepExecutionOptions>;
  
  constructor(options?: Partial<StepExecutionOptions>) {
    this.options = { ...DEFAULT_EXECUTION_OPTIONS, ...options };
    this.elementFinder = createElementFinder({
      timeout: this.options.findTimeout,
      retryInterval: this.options.retryInterval,
      maxRetries: this.options.maxRetries,
    });
    this.actionExecutor = createActionExecutor({
      humanLike: this.options.humanLike,
      scrollIntoView: this.options.scrollIntoView,
    });
  }
  
  /**
   * Execute a step
   */
  async execute(
    step: Step,
    context: StepExecutionContext = {},
    options?: Partial<StepExecutionOptions>
  ): Promise<StepExecutionResult> {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    
    // Validate step first (handles null/undefined)
    const validation = validateStep(step);
    const stepId = validation.valid ? getStepId(step) : `invalid-${Date.now()}`;
    
    if (!validation.valid) {
      return this.createFailedResult(step, stepId, validation.error!, startTime);
    }
    
    // Handle 'open' event (navigation)
    if (step.event === 'open') {
      return this.executeOpen(step, context, startTime);
    }
    
    // Pre-action delay
    if (opts.preActionDelay > 0) {
      await sleep(opts.preActionDelay);
    }
    
    // Get bundle for element finding
    const bundle = getBundleFromStep(step);
    if (!bundle) {
      return this.createFailedResult(step, stepId, 'No locator bundle available', startTime);
    }
    
    // Determine target document
    const targetDoc = context.iframeDocument || context.document || document;
    
    // Find element
    const findResult = await this.elementFinder.find(bundle, targetDoc, {
      timeout: opts.findTimeout,
      retryInterval: opts.retryInterval,
      maxRetries: opts.maxRetries,
      shadowRoot: context.shadowRoot,
    });
    
    if (!findResult.element) {
      if (opts.skipOnNotFound) {
        return this.createSkippedResult(step, stepId, 'Element not found', startTime, findResult);
      }
      return this.createFailedResult(
        step,
        stepId,
        findResult.error || 'Element not found',
        startTime,
        findResult
      );
    }
    
    // Highlight element if requested
    if (opts.highlightElement) {
      await highlightElement(findResult.element, opts.highlightDuration);
    }
    
    // Execute action based on event type
    let actionResult: ActionResult;
    let usedValue: string | undefined;
    let valueSource: 'recorded' | 'csv-direct' | 'csv-mapped' | 'none' | undefined;
    
    switch (step.event) {
      case 'click':
        actionResult = await this.executeClick(findResult.element, opts);
        break;
        
      case 'input':
        const resolved = resolveInputValue(step, context);
        usedValue = resolved.value;
        valueSource = resolved.source;
        actionResult = await this.executeInput(findResult.element, usedValue, opts);
        break;
        
      case 'enter':
        // For enter events, optionally set value first
        const enterResolved = resolveInputValue(step, context);
        if (enterResolved.source !== 'none' && enterResolved.value) {
          usedValue = enterResolved.value;
          valueSource = enterResolved.source;
          await this.executeInput(findResult.element, usedValue, opts);
        }
        actionResult = await this.executeEnter(findResult.element, opts);
        break;
        
      default:
        return this.createFailedResult(
          step,
          stepId,
          `Unknown event type: ${step.event}`,
          startTime,
          findResult
        );
    }
    
    // Post-action delay
    if (opts.postActionDelay > 0) {
      await sleep(opts.postActionDelay);
    }
    
    // Build result
    const duration = Date.now() - startTime;
    
    if (actionResult.success) {
      return {
        stepId,
        status: 'passed',
        success: true,
        duration,
        startTime,
        endTime: Date.now(),
        locatorStrategy: findResult.strategy || undefined,
        locatorConfidence: findResult.confidence,
        retryAttempts: findResult.retryAttempts,
        step,
        findResult,
        actionResult,
        usedValue,
        valueSource,
      };
    } else {
      return {
        stepId,
        status: 'failed',
        success: false,
        duration,
        error: actionResult.error,
        startTime,
        endTime: Date.now(),
        locatorStrategy: findResult.strategy || undefined,
        locatorConfidence: findResult.confidence,
        retryAttempts: findResult.retryAttempts,
        step,
        findResult,
        actionResult,
        usedValue,
        valueSource,
      };
    }
  }
  
  /**
   * Execute click action
   */
  private async executeClick(
    element: Element,
    options: Required<StepExecutionOptions>
  ): Promise<ActionResult> {
    return this.actionExecutor.click(element, {
      humanLike: options.humanLike,
      scrollIntoView: options.scrollIntoView,
    });
  }
  
  /**
   * Execute input action
   */
  private async executeInput(
    element: Element,
    value: string,
    options: Required<StepExecutionOptions>
  ): Promise<ActionResult> {
    return this.actionExecutor.input(element, value, {
      humanLike: options.humanLike,
      scrollIntoView: options.scrollIntoView,
      reactSafe: true,
    });
  }
  
  /**
   * Execute enter key action
   */
  private async executeEnter(
    element: Element,
    options: Required<StepExecutionOptions>
  ): Promise<ActionResult> {
    return this.actionExecutor.pressEnter(element, {
      humanLike: options.humanLike,
    });
  }
  
  /**
   * Execute open/navigation action
   */
  private async executeOpen(
    step: Step,
    context: StepExecutionContext,
    startTime: number
  ): Promise<StepExecutionResult> {
    const stepId = getStepId(step);
    
    // For 'open' events, we typically just record that we're on a page
    // Actual navigation is handled by the orchestrator
    const targetUrl = step.path || step.value || context.pageUrl;
    
    if (!targetUrl) {
      return this.createFailedResult(step, stepId, 'No URL specified for open event', startTime);
    }
    
    // Verify current page matches expected URL (optional)
    const currentUrl = context.document?.location?.href || window.location.href;
    const urlMatch = currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl);
    
    return {
      stepId,
      status: 'passed',
      success: true,
      duration: Date.now() - startTime,
      startTime,
      endTime: Date.now(),
      step,
      usedValue: targetUrl,
      valueSource: 'recorded',
      details: { targetUrl, currentUrl, urlMatch },
    } as StepExecutionResult;
  }
  
  /**
   * Create a failed result
   */
  private createFailedResult(
    step: Step,
    stepId: string,
    error: string,
    startTime: number,
    findResult?: FindResult
  ): StepExecutionResult {
    return {
      stepId,
      status: 'failed',
      success: false,
      duration: Date.now() - startTime,
      error,
      startTime,
      endTime: Date.now(),
      step,
      findResult,
      locatorStrategy: findResult?.strategy || undefined,
      locatorConfidence: findResult?.confidence || 0,
      retryAttempts: findResult?.retryAttempts || 0,
    };
  }
  
  /**
   * Create a skipped result
   */
  private createSkippedResult(
    step: Step,
    stepId: string,
    reason: string,
    startTime: number,
    findResult?: FindResult
  ): StepExecutionResult {
    return {
      stepId,
      status: 'skipped',
      success: false,
      duration: Date.now() - startTime,
      error: reason,
      startTime,
      endTime: Date.now(),
      step,
      findResult,
    };
  }
  
  /**
   * Execute multiple steps
   */
  async executeAll(
    steps: Step[],
    context: StepExecutionContext = {},
    options?: Partial<StepExecutionOptions>
  ): Promise<StepExecutionResult[]> {
    const results: StepExecutionResult[] = [];
    const opts = { ...this.options, ...options };
    
    for (const step of steps) {
      const result = await this.execute(step, context, options);
      results.push(result);
      
      // Stop on failure unless skipOnNotFound is enabled
      if (!result.success && result.status !== 'skipped' && !opts.skipOnNotFound) {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Get current options
   */
  getOptions(): Required<StepExecutionOptions> {
    return { ...this.options };
  }
  
  /**
   * Update options
   */
  setOptions(options: Partial<StepExecutionOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Update child components
    this.elementFinder.setOptions({
      timeout: this.options.findTimeout,
      retryInterval: this.options.retryInterval,
      maxRetries: this.options.maxRetries,
    });
    
    this.actionExecutor.setOptions({
      humanLike: this.options.humanLike,
      scrollIntoView: this.options.scrollIntoView,
    });
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a StepExecutor
 */
export function createStepExecutor(
  options?: Partial<StepExecutionOptions>
): StepExecutor {
  return new StepExecutor(options);
}

/**
 * Create a fast StepExecutor (minimal delays)
 */
export function createFastStepExecutor(): StepExecutor {
  return new StepExecutor({
    findTimeout: 500,
    maxRetries: 3,
    humanLike: false,
    preActionDelay: 0,
    postActionDelay: 0,
  });
}

/**
 * Create a tolerant StepExecutor (longer timeouts, skip on failure)
 */
export function createTolerantStepExecutor(): StepExecutor {
  return new StepExecutor({
    findTimeout: 5000,
    maxRetries: 30,
    skipOnNotFound: true,
    preActionDelay: 100,
    postActionDelay: 200,
  });
}

/**
 * Create a debug StepExecutor (with highlighting)
 */
export function createDebugStepExecutor(): StepExecutor {
  return new StepExecutor({
    findTimeout: 5000,
    highlightElement: true,
    highlightDuration: 500,
    preActionDelay: 200,
    postActionDelay: 300,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultExecutor: StepExecutor | null = null;

/**
 * Get default StepExecutor
 */
export function getStepExecutor(): StepExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new StepExecutor();
  }
  return defaultExecutor;
}

/**
 * Reset default StepExecutor
 */
export function resetStepExecutor(): void {
  defaultExecutor = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute a step with default executor
 */
export async function executeStep(
  step: Step,
  context?: StepExecutionContext,
  options?: Partial<StepExecutionOptions>
): Promise<StepExecutionResult> {
  return getStepExecutor().execute(step, context, options);
}

/**
 * Execute multiple steps with default executor
 */
export async function executeSteps(
  steps: Step[],
  context?: StepExecutionContext,
  options?: Partial<StepExecutionOptions>
): Promise<StepExecutionResult[]> {
  return getStepExecutor().executeAll(steps, context, options);
}
