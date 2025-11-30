/**
 * @fileoverview Core replay engine for executing recorded steps
 * @module core/replay/player
 * @version 1.0.0
 * 
 * This module provides the core replay engine that executes recorded
 * steps during test playback, with support for CSV data injection.
 * 
 * STEP EVENT EXECUTION:
 * - 'open' - Navigate to URL
 * - 'click' - Click on located element
 * - 'input' - Type value into located element (supports CSV injection)
 * - 'enter' - Press Enter on located element
 * 
 * TESTRUN STATUS TRANSITIONS:
 * - pending → running (on start)
 * - running → passed (all steps pass)
 * - running → failed (any step fails)
 * - running → stopped (user stops)
 * 
 * @see PHASE_4_SPECIFICATIONS.md for replay specifications
 * @see replay-engine_breakdown.md for engine details
 */

import type { Step, LocatorBundle, Field } from '../types';
import {
  executeStrategy,
  performClick,
  performInput,
  performEnter,
  highlightReplay,
  removeHighlight
} from '../locators';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay state
 */
export type ReplayState = 'idle' | 'running' | 'paused' | 'stopped';

/**
 * Replay configuration
 */
export interface ReplayConfig {
  /** Delay between steps (ms) */
  stepDelay?: number;
  /** Timeout for element location (ms) */
  elementTimeout?: number;
  /** Retry count for failed steps */
  retryCount?: number;
  /** Delay between retries (ms) */
  retryDelay?: number;
  /** Show visual highlights */
  showHighlights?: boolean;
  /** Highlight duration (ms) */
  highlightDuration?: number;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Take screenshot on failure */
  screenshotOnFailure?: boolean;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Step execution result
 */
export interface StepResult {
  /** Step that was executed */
  step: Step;
  /** Whether step succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution duration (ms) */
  duration: number;
  /** Number of retries attempted */
  retries: number;
  /** Element that was interacted with */
  element?: Element;
  /** Value that was injected (for input steps) */
  injectedValue?: string;
  /** Strategy used to locate element */
  locatorStrategy?: string;
  /** Confidence of element match */
  locatorConfidence?: number;
}

/**
 * Replay progress info
 */
export interface ReplayProgress {
  /** Current step index (0-indexed) */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Completed steps count */
  completedSteps: number;
  /** Failed steps count */
  failedSteps: number;
  /** Current state */
  state: ReplayState;
  /** Elapsed time (ms) */
  elapsedTime: number;
  /** Estimated remaining time (ms) */
  estimatedRemaining: number;
}

/**
 * CSV data for injection
 */
export interface CsvInjectionData {
  /** Headers (column names) */
  headers: string[];
  /** Current row data */
  rowData: Record<string, string>;
  /** Current row index */
  rowIndex: number;
  /** Field mappings */
  fieldMappings: Map<string, string>; // field_name -> csv column
}

/**
 * Replay callbacks
 */
export interface ReplayCallbacks {
  /** Called before each step */
  onStepStart?: (step: Step, index: number) => void;
  /** Called after each step */
  onStepComplete?: (result: StepResult, index: number) => void;
  /** Called on state change */
  onStateChange?: (newState: ReplayState, oldState: ReplayState) => void;
  /** Called on progress update */
  onProgress?: (progress: ReplayProgress) => void;
  /** Called when replay completes */
  onComplete?: (results: StepResult[], passed: boolean) => void;
  /** Called on error */
  onError?: (error: Error, step?: Step) => void;
  /** Called for logging */
  onLog?: (message: string, level: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default replay configuration
 */
export const DEFAULT_REPLAY_CONFIG: Required<ReplayConfig> = {
  stepDelay: 500,
  elementTimeout: 5000,
  retryCount: 3,
  retryDelay: 1000,
  showHighlights: true,
  highlightDuration: 1000,
  stopOnFailure: true,
  screenshotOnFailure: false,
  logLevel: 'info'
};

// ============================================================================
// PLAYER CLASS
// ============================================================================

/**
 * Replay Player
 * 
 * Executes recorded steps during test playback.
 * 
 * @example
 * ```typescript
 * const player = new Player(steps, {
 *   stepDelay: 1000,
 *   showHighlights: true
 * });
 * 
 * // Set callbacks
 * player.onStepComplete((result, index) => {
 *   console.log(`Step ${index + 1}: ${result.success ? 'PASS' : 'FAIL'}`);
 * });
 * 
 * // Run replay
 * const results = await player.play();
 * console.log('All passed:', results.every(r => r.success));
 * ```
 */
export class Player {
  private steps: Step[];
  private config: Required<ReplayConfig>;
  private callbacks: ReplayCallbacks;
  private state: ReplayState = 'idle';
  private results: StepResult[] = [];
  private currentStepIndex: number = 0;
  private startTime: number = 0;
  private csvData: CsvInjectionData | null = null;
  private fields: Field[] = [];
  private currentHighlightId: string | null = null;
  private abortController: AbortController | null = null;

  constructor(
    steps: Step[],
    config: ReplayConfig = {},
    callbacks: ReplayCallbacks = {}
  ) {
    this.steps = [...steps];
    this.config = { ...DEFAULT_REPLAY_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Start replay
   * 
   * @returns Promise resolving to step results
   */
  async play(): Promise<StepResult[]> {
    if (this.state === 'running') {
      throw new Error('Replay already in progress');
    }

    this.reset();
    this.setState('running');
    this.startTime = Date.now();
    this.abortController = new AbortController();

    this.log('info', `Starting replay with ${this.steps.length} steps`);

    try {
      for (let i = 0; i < this.steps.length; i++) {
        // Check for abort
        if (this.abortController.signal.aborted) {
          this.log('info', 'Replay aborted');
          break;
        }

        // Check for pause
        while (this.state === 'paused') {
          await this.delay(100);
          if (this.state !== 'paused') break;
        }

        if (this.state === 'stopped') {
          this.log('info', 'Replay stopped');
          break;
        }

        this.currentStepIndex = i;
        const step = this.steps[i];

        // Notify step start
        this.callbacks.onStepStart?.(step, i);

        // Execute step
        const result = await this.executeStep(step, i);
        this.results.push(result);

        // Notify step complete
        this.callbacks.onStepComplete?.(result, i);

        // Update progress
        this.notifyProgress();

        // Check for failure
        if (!result.success && this.config.stopOnFailure) {
          this.log('error', `Step ${i + 1} failed: ${result.error}`);
          break;
        }

        // Delay between steps
        if (i < this.steps.length - 1 && this.isRunning()) {
          await this.delay(this.config.stepDelay);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('error', `Replay error: ${err.message}`);
      this.callbacks.onError?.(err);
    } finally {
      this.clearHighlight();
    }

    const passed = this.results.every(r => r.success);
    
    if (this.state !== 'stopped') {
      this.setState('idle');
    }

    this.log('info', `Replay complete: ${passed ? 'PASSED' : 'FAILED'}`);
    this.callbacks.onComplete?.(this.results, passed);

    return this.results;
  }

  /**
   * Stop replay
   */
  stop(): void {
    if (this.state === 'idle') return;

    this.setState('stopped');
    this.abortController?.abort();
    this.clearHighlight();
    this.log('info', 'Replay stopped by user');
  }

  /**
   * Pause replay
   */
  pause(): void {
    if (this.state !== 'running') return;

    this.setState('paused');
    this.log('info', 'Replay paused');
  }

  /**
   * Resume replay
   */
  resume(): void {
    if (this.state !== 'paused') return;

    this.setState('running');
    this.log('info', 'Replay resumed');
  }

  /**
   * Reset player state
   */
  reset(): void {
    this.results = [];
    this.currentStepIndex = 0;
    this.startTime = 0;
    this.clearHighlight();
  }

  // ==========================================================================
  // CSV DATA INJECTION
  // ==========================================================================

  /**
   * Set CSV data for injection
   * 
   * @param headers - CSV headers
   * @param rowData - Current row data as object
   * @param rowIndex - Current row index
   * @param fields - Field definitions with mappings
   */
  setCsvData(
    headers: string[],
    rowData: Record<string, string>,
    rowIndex: number,
    fields: Field[]
  ): void {
    // Build field mappings
    const fieldMappings = new Map<string, string>();
    
    for (const field of fields) {
      if (field.mapped && field.inputvarfields) {
        fieldMappings.set(field.field_name, field.inputvarfields);
      }
    }

    this.csvData = {
      headers,
      rowData,
      rowIndex,
      fieldMappings
    };
    this.fields = fields;

    this.log('debug', `CSV data set for row ${rowIndex + 1}`);
  }

  /**
   * Clear CSV data
   */
  clearCsvData(): void {
    this.csvData = null;
    this.fields = [];
  }

  /**
   * Get injected value for a step
   */
  private getInjectedValue(step: Step): string {
    if (step.event !== 'input') {
      return step.value;
    }

    // If no CSV data, use step's original value
    if (!this.csvData) {
      return step.value;
    }

    // Try to find mapped value from CSV
    // Check if bundle has a matching field
    if (!step.bundle) {
      return step.value;
    }
    
    const fieldName = this.findFieldForBundle(step.bundle);
    
    if (fieldName) {
      const csvColumn = this.csvData.fieldMappings.get(fieldName);
      if (csvColumn && this.csvData.rowData[csvColumn] !== undefined) {
        return this.csvData.rowData[csvColumn];
      }
    }

    // Fall back to original value
    return step.value;
  }

  /**
   * Find field name that matches bundle
   */
  private findFieldForBundle(bundle: LocatorBundle): string | null {
    for (const field of this.fields) {
      // Match by name attribute
      if (bundle.name && bundle.name === field.field_name) {
        return field.field_name;
      }
      // Match by ID
      if (bundle.id && bundle.id === field.field_name) {
        return field.field_name;
      }
      // Match by placeholder
      if (bundle.placeholder && bundle.placeholder.toLowerCase().includes(field.field_name.toLowerCase())) {
        return field.field_name;
      }
    }
    return null;
  }

  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================

  /**
   * Execute a single step
   */
  private async executeStep(step: Step, index: number): Promise<StepResult> {
    const startTime = performance.now();
    let retries = 0;
    let lastError: string | undefined;
    let lastResult: StepResult | null = null;

    while (retries <= this.config.retryCount) {
      try {
        const result = await this.executeStepOnce(step, index);
        
        // If successful, return with retry count
        if (result.success) {
          return {
            ...result,
            duration: performance.now() - startTime,
            retries
          };
        }
        
        // Failed - retry if allowed
        lastResult = result;
        lastError = result.error;
        retries++;

        if (retries <= this.config.retryCount) {
          this.log('warn', `Step ${index + 1} retry ${retries}/${this.config.retryCount}`);
          await this.delay(this.config.retryDelay);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retries++;

        if (retries <= this.config.retryCount) {
          this.log('warn', `Step ${index + 1} retry ${retries}/${this.config.retryCount}`);
          await this.delay(this.config.retryDelay);
        }
      }
    }

    // All retries failed
    return {
      step,
      success: false,
      error: lastError || 'Unknown error',
      duration: performance.now() - startTime,
      retries: this.config.retryCount,
      ...(lastResult && {
        locatorStrategy: lastResult.locatorStrategy,
        locatorConfidence: lastResult.locatorConfidence
      })
    };
  }

  /**
   * Execute step once (no retry)
   */
  private async executeStepOnce(step: Step, index: number): Promise<StepResult> {
    this.log('debug', `Executing step ${index + 1}: ${step.event}`);

    switch (step.event) {
      case 'open':
        return this.executeOpenStep(step);
      
      case 'click':
        return this.executeClickStep(step, index);
      
      case 'input':
        return this.executeInputStep(step, index);
      
      case 'enter':
        return this.executeEnterStep(step, index);
      
      default:
        throw new Error(`Unknown step event: ${step.event}`);
    }
  }

  /**
   * Execute 'open' step (navigation)
   */
  private async executeOpenStep(step: Step): Promise<StepResult> {
    const url = step.value || step.bundle?.pageUrl;
    
    if (!url) {
      return {
        step,
        success: false,
        error: 'No URL specified for open step',
        duration: 0,
        retries: 0
      };
    }

    this.log('info', `Navigating to: ${url}`);

    // In content script context, navigation is handled differently
    // For now, just verify we're on the right page or log the URL
    const currentUrl = window.location.href;
    
    if (currentUrl !== url && !currentUrl.includes(new URL(url).pathname)) {
      this.log('warn', `Current URL (${currentUrl}) differs from expected (${url})`);
      // Note: Actual navigation would be handled by background script
    }

    return {
      step,
      success: true,
      duration: 0,
      retries: 0
    };
  }

  /**
   * Execute 'click' step
   */
  private async executeClickStep(step: Step, index: number): Promise<StepResult> {
    if (!step.bundle) {
      return {
        step,
        success: false,
        error: 'No bundle provided for click step',
        duration: 0,
        retries: 0
      };
    }

    // Locate element
    const locateResult = await executeStrategy(step.bundle, {
      timeout: this.config.elementTimeout,
      searchIframes: true,
      searchShadowDom: true
    });

    if (!locateResult.found || !locateResult.element) {
      return {
        step,
        success: false,
        error: `Element not found for click step`,
        duration: 0,
        retries: 0,
        locatorStrategy: locateResult.strategy || undefined,
        locatorConfidence: locateResult.confidence
      };
    }

    // Show highlight
    this.showStepHighlight(locateResult.element, index);

    // Perform click
    await performClick(locateResult.element, {
      scrollIntoView: true,
      highlight: false, // We handle highlighting ourselves
      delayAfter: 100
    });

    this.log('debug', `Clicked element: ${step.bundle?.tag}#${step.bundle?.id || 'unknown'}`);

    return {
      step,
      success: true,
      duration: 0,
      retries: 0,
      element: locateResult.element,
      locatorStrategy: locateResult.strategy || undefined,
      locatorConfidence: locateResult.confidence
    };
  }

  /**
   * Execute 'input' step
   */
  private async executeInputStep(step: Step, index: number): Promise<StepResult> {
    if (!step.bundle) {
      return {
        step,
        success: false,
        error: 'No bundle provided for input step',
        duration: 0,
        retries: 0
      };
    }

    // Locate element
    const locateResult = await executeStrategy(step.bundle, {
      timeout: this.config.elementTimeout,
      searchIframes: true,
      searchShadowDom: true
    });

    if (!locateResult.found || !locateResult.element) {
      return {
        step,
        success: false,
        error: `Element not found for input step`,
        duration: 0,
        retries: 0,
        locatorStrategy: locateResult.strategy || undefined,
        locatorConfidence: locateResult.confidence
      };
    }

    // Get value (with CSV injection)
    const value = this.getInjectedValue(step);

    // Show highlight
    this.showStepHighlight(locateResult.element, index);

    // Perform input
    await performInput(locateResult.element, value, {
      scrollIntoView: true,
      highlight: false,
      delayAfter: 100
    });

    this.log('debug', `Input value to ${step.bundle?.tag}#${step.bundle?.id || 'unknown'}: "${value}"`);

    return {
      step,
      success: true,
      duration: 0,
      retries: 0,
      element: locateResult.element,
      injectedValue: value,
      locatorStrategy: locateResult.strategy || undefined,
      locatorConfidence: locateResult.confidence
    };
  }

  /**
   * Execute 'enter' step
   */
  private async executeEnterStep(step: Step, index: number): Promise<StepResult> {
    if (!step.bundle) {
      return {
        step,
        success: false,
        error: 'No bundle provided for enter step',
        duration: 0,
        retries: 0
      };
    }

    // Locate element
    const locateResult = await executeStrategy(step.bundle, {
      timeout: this.config.elementTimeout,
      searchIframes: true,
      searchShadowDom: true
    });

    if (!locateResult.found || !locateResult.element) {
      return {
        step,
        success: false,
        error: `Element not found for enter step`,
        duration: 0,
        retries: 0,
        locatorStrategy: locateResult.strategy || undefined,
        locatorConfidence: locateResult.confidence
      };
    }

    // Show highlight
    this.showStepHighlight(locateResult.element, index);

    // Perform enter
    await performEnter(locateResult.element, {
      scrollIntoView: true,
      highlight: false,
      delayAfter: 100
    });

    this.log('debug', `Pressed Enter on ${step.bundle?.tag}#${step.bundle?.id || 'unknown'}`);

    return {
      step,
      success: true,
      duration: 0,
      retries: 0,
      element: locateResult.element,
      locatorStrategy: locateResult.strategy || undefined,
      locatorConfidence: locateResult.confidence
    };
  }

  // ==========================================================================
  // STATE
  // ==========================================================================

  /**
   * Get current state
   */
  getState(): ReplayState {
    return this.state;
  }

  /**
   * Get current results
   */
  getResults(): StepResult[] {
    return [...this.results];
  }

  /**
   * Get progress info
   */
  getProgress(): ReplayProgress {
    const elapsed = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const completedSteps = this.results.length;
    const avgStepTime = completedSteps > 0 ? elapsed / completedSteps : this.config.stepDelay;
    const remainingSteps = this.steps.length - completedSteps;

    return {
      currentStep: this.currentStepIndex,
      totalSteps: this.steps.length,
      completedSteps,
      failedSteps: this.results.filter(r => !r.success).length,
      state: this.state,
      elapsedTime: elapsed,
      estimatedRemaining: remainingSteps * avgStepTime
    };
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.state === 'paused';
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Set state and notify
   */
  private setState(newState: ReplayState): void {
    const oldState = this.state;
    this.state = newState;
    this.callbacks.onStateChange?.(newState, oldState);
  }

  /**
   * Notify progress
   */
  private notifyProgress(): void {
    this.callbacks.onProgress?.(this.getProgress());
  }

  /**
   * Show highlight for step
   */
  private showStepHighlight(element: Element, stepIndex: number): void {
    if (!this.config.showHighlights) return;

    this.clearHighlight();
    this.currentHighlightId = highlightReplay(element, stepIndex + 1);

    // Auto-clear after duration
    setTimeout(() => {
      if (this.currentHighlightId) {
        removeHighlight(this.currentHighlightId);
        this.currentHighlightId = null;
      }
    }, this.config.highlightDuration);
  }

  /**
   * Clear current highlight
   */
  private clearHighlight(): void {
    if (this.currentHighlightId) {
      removeHighlight(this.currentHighlightId);
      this.currentHighlightId = null;
    }
  }

  /**
   * Log message
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      this.callbacks.onLog?.(message, level);
      
      if (level === 'error') {
        console.error('[SammyReplay]', message);
      } else if (level === 'warn') {
        console.warn('[SammyReplay]', message);
      } else if (this.config.logLevel === 'debug') {
        console.log('[SammyReplay]', message);
      }
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Destroy player
   */
  destroy(): void {
    this.stop();
    this.clearHighlight();
    this.callbacks = {};
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new player instance
 */
export function createPlayer(
  steps: Step[],
  config?: ReplayConfig,
  callbacks?: ReplayCallbacks
): Player {
  return new Player(steps, config, callbacks);
}

/**
 * Run replay and return results
 * 
 * Convenience function for simple replay.
 */
export async function runReplay(
  steps: Step[],
  config?: ReplayConfig
): Promise<{
  results: StepResult[];
  passed: boolean;
  duration: number;
}> {
  const player = new Player(steps, config);
  const startTime = Date.now();
  
  const results = await player.play();
  const passed = results.every(r => r.success);
  
  return {
    results,
    passed,
    duration: Date.now() - startTime
  };
}

/**
 * Generate log string from results
 * 
 * CRITICAL: Returns string (NOT string[]) for TestRun.logs
 */
export function generateLogFromResults(results: StepResult[]): string {
  const lines: string[] = [];
  
  lines.push(`Replay started at ${new Date().toISOString()}`);
  lines.push(`Total steps: ${results.length}`);
  lines.push('---');

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const status = result.success ? 'PASS' : 'FAIL';
    const stepInfo = `Step ${i + 1}: ${result.step.event} - ${status}`;
    lines.push(stepInfo);
    
    if (result.injectedValue) {
      lines.push(`  Value: "${result.injectedValue}"`);
    }
    
    if (result.locatorStrategy) {
      lines.push(`  Locator: ${result.locatorStrategy} (${result.locatorConfidence}%)`);
    }
    
    if (result.error) {
      lines.push(`  Error: ${result.error}`);
    }
    
    if (result.retries > 0) {
      lines.push(`  Retries: ${result.retries}`);
    }
    
    lines.push(`  Duration: ${Math.round(result.duration)}ms`);
  }

  lines.push('---');
  const passed = results.every(r => r.success);
  lines.push(`Result: ${passed ? 'PASSED' : 'FAILED'}`);
  lines.push(`Replay ended at ${new Date().toISOString()}`);

  return lines.join('\n');
}
