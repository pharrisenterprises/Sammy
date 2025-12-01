/**
 * ActionExecutor - Executes individual step actions
 * @module core/replay/ActionExecutor
 * @version 1.0.0
 * 
 * Executes recorded steps by locating elements and performing
 * actions on them. Supports all step types with configurable
 * waiting and interaction strategies.
 * 
 * Features:
 * - Action handlers for each step type
 * - Element location with fallback strategies
 * - Configurable wait conditions
 * - Input simulation (typing, clicking)
 * - Screenshot capture
 * 
 * @see replay-engine_breakdown.md for architecture details
 */

import type { RecordedStep, StepType, StepTarget } from '../types/step';
import type { LocatorBundle } from '../types/locator-bundle';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default action timeout (ms)
 */
export const DEFAULT_ACTION_TIMEOUT = 30000;

/**
 * Default wait poll interval (ms)
 */
export const DEFAULT_POLL_INTERVAL = 100;

/**
 * Default typing delay between characters (ms)
 */
export const DEFAULT_TYPING_DELAY = 50;

/**
 * Maximum wait time for element (ms)
 */
export const MAX_WAIT_TIME = 60000;

/**
 * Supported action types
 */
export const ACTION_TYPES: StepType[] = [
  'click',
  'dblclick',
  'input',
  'keypress',
  'select',
  'hover',
  'scroll',
  'focus',
  'blur',
  'submit',
  'navigate',
  'wait',
  'assert',
  'screenshot',
  'drag',
  'drop',
  'upload',
  'download',
];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action executor configuration
 */
export interface ActionExecutorConfig {
  /** Default timeout for actions (ms) */
  timeout?: number;
  /** Poll interval for waiting (ms) */
  pollInterval?: number;
  /** Delay between keystrokes (ms) */
  typingDelay?: number;
  /** Whether to highlight elements before action */
  highlightElements?: boolean;
  /** Highlight duration (ms) */
  highlightDuration?: number;
  /** Whether to scroll elements into view */
  scrollIntoView?: boolean;
  /** Whether to simulate human-like delays */
  humanizeDelays?: boolean;
  /** Screenshot capturer */
  screenshotCapturer?: ScreenshotCapturer;
  /** Custom locator resolver */
  locatorResolver?: LocatorResolver;
}

/**
 * Screenshot capturer interface
 */
export interface ScreenshotCapturer {
  capture(element?: Element): Promise<string>;
}

/**
 * Locator resolver interface
 */
export interface LocatorResolver {
  resolve(target: StepTarget, locatorBundle?: LocatorBundle): Promise<Element | null>;
}

/**
 * Action execution context
 */
export interface ActionContext {
  /** Step being executed */
  step: RecordedStep;
  /** Timeout for this action */
  timeout: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Previous action result */
  previousResult?: ActionResult;
  /** Session metadata */
  metadata: Record<string, unknown>;
}

/**
 * Action execution result
 */
export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Execution duration (ms) */
  duration: number;
  /** Element that was acted upon */
  element?: Element;
  /** Whether element was found */
  elementFound: boolean;
  /** Locator strategy that worked */
  locatorUsed?: string;
  /** Screenshot if captured */
  screenshot?: string;
  /** Actual value (for assertions) */
  actualValue?: string;
  /** Additional result data */
  data?: Record<string, unknown>;
}

/**
 * Action handler function
 */
export type ActionHandler = (
  element: Element | null,
  step: RecordedStep,
  context: ActionContext
) => Promise<ActionResult>;

/**
 * Wait condition function
 */
export type WaitCondition = (element: Element | null) => boolean | Promise<boolean>;

/**
 * Element state for waiting
 */
export type ElementState = 
  | 'attached'
  | 'detached'
  | 'visible'
  | 'hidden'
  | 'enabled'
  | 'disabled'
  | 'editable'
  | 'checked'
  | 'unchecked';

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * ActionExecutor - Executes individual step actions
 * 
 * Provides methods to execute each type of recorded step
 * by locating elements and performing actions on them.
 * 
 * @example
 * ```typescript
 * const executor = new ActionExecutor({
 *   timeout: 10000,
 *   highlightElements: true,
 * });
 * 
 * const result = await executor.execute(step, {
 *   step,
 *   timeout: 5000,
 *   metadata: {},
 * });
 * ```
 */
export class ActionExecutor {
  /**
   * Configuration
   */
  private config: Required<ActionExecutorConfig>;
  
  /**
   * Action handlers by type
   */
  private handlers: Map<StepType, ActionHandler> = new Map();
  
  /**
   * Statistics
   */
  private stats = {
    actionsExecuted: 0,
    actionsSucceeded: 0,
    actionsFailed: 0,
    totalDuration: 0,
  };
  
  /**
   * Creates a new ActionExecutor
   * 
   * @param config - Executor configuration
   */
  constructor(config: ActionExecutorConfig = {}) {
    this.config = {
      timeout: config.timeout ?? DEFAULT_ACTION_TIMEOUT,
      pollInterval: config.pollInterval ?? DEFAULT_POLL_INTERVAL,
      typingDelay: config.typingDelay ?? DEFAULT_TYPING_DELAY,
      highlightElements: config.highlightElements ?? false,
      highlightDuration: config.highlightDuration ?? 200,
      scrollIntoView: config.scrollIntoView ?? true,
      humanizeDelays: config.humanizeDelays ?? false,
      screenshotCapturer: config.screenshotCapturer ?? null as unknown as ScreenshotCapturer,
      locatorResolver: config.locatorResolver ?? null as unknown as LocatorResolver,
    };
    
    // Register default handlers
    this.registerDefaultHandlers();
  }
  
  // ==========================================================================
  // EXECUTION
  // ==========================================================================
  
  /**
   * Executes a step action
   * 
   * @param step - Step to execute
   * @param context - Execution context
   * @returns Action result
   */
  async execute(step: RecordedStep, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();
    this.stats.actionsExecuted++;
    
    try {
      // Check for abort
      if (context.abortSignal?.aborted) {
        throw new DOMException('Action cancelled', 'AbortError');
      }
      
      // Get handler for step type
      const handler = this.handlers.get(step.type);
      if (!handler) {
        throw new Error(`No handler for step type: ${step.type}`);
      }
      
      // Locate element (if needed for this step type)
      let element: Element | null = null;
      let locatorUsed: string | undefined;
      
      if (this.requiresElement(step.type)) {
        const location = await this.locateElement(step, context.timeout);
        element = location.element;
        locatorUsed = location.locatorUsed;
        
        if (!element && !this.isOptionalElement(step.type)) {
          this.stats.actionsFailed++;
          return {
            success: false,
            error: new Error(`Element not found for step: ${step.type}`),
            duration: Date.now() - startTime,
            elementFound: false,
          };
        }
        
        // Scroll into view
        if (element && this.config.scrollIntoView) {
          await this.scrollIntoView(element);
        }
        
        // Highlight element
        if (element && this.config.highlightElements) {
          await this.highlightElement(element);
        }
      }
      
      // Execute handler
      const result = await handler(element, step, context);
      
      // Update stats
      if (result.success) {
        this.stats.actionsSucceeded++;
      } else {
        this.stats.actionsFailed++;
      }
      
      this.stats.totalDuration += result.duration;
      
      return {
        ...result,
        locatorUsed: locatorUsed ?? result.locatorUsed,
        elementFound: element !== null,
      };
    } catch (error) {
      this.stats.actionsFailed++;
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
  }
  
  /**
   * Registers a custom action handler
   */
  registerHandler(type: StepType, handler: ActionHandler): void {
    this.handlers.set(type, handler);
  }
  
  /**
   * Gets statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = {
      actionsExecuted: 0,
      actionsSucceeded: 0,
      actionsFailed: 0,
      totalDuration: 0,
    };
  }
  
  // ==========================================================================
  // ELEMENT LOCATION
  // ==========================================================================
  
  /**
   * Locates an element for a step
   */
  async locateElement(
    step: RecordedStep,
    timeout: number
  ): Promise<{ element: Element | null; locatorUsed?: string }> {
    const target = step.target;
    const bundle = step.locatorBundle;
    
    if (!target) {
      return { element: null, locatorUsed: undefined };
    }
    
    // Use custom resolver if provided
    if (this.config.locatorResolver) {
      const element = await this.config.locatorResolver.resolve(target, bundle);
      return { element, locatorUsed: 'custom' };
    }
    
    // Try locators in priority order
    const locators = this.buildLocatorList(target, bundle);
    
    const endTime = Date.now() + timeout;
    
    while (Date.now() < endTime) {
      for (const locator of locators) {
        const element = this.tryLocator(locator.type, locator.value);
        if (element) {
          return { element, locatorUsed: locator.type };
        }
      }
      
      await this.delay(this.config.pollInterval);
    }
    
    return { element: null };
  }
  
  /**
   * Builds list of locators to try
   */
  private buildLocatorList(
    target: StepTarget,
    _bundle?: LocatorBundle
  ): Array<{ type: string; value: string }> {
    const locators: Array<{ type: string; value: string }> = [];
    
    // Prefer data-testid
    if (target.attributes?.['data-testid']) {
      locators.push({
        type: 'data-testid',
        value: `[data-testid="${target.attributes['data-testid']}"]`,
      });
    }
    
    // ID
    if (target.id) {
      locators.push({ type: 'id', value: `#${target.id}` });
    }
    
    // CSS selector
    if (target.cssSelector) {
      locators.push({ type: 'css', value: target.cssSelector });
    }
    
    // XPath
    if (target.xpath) {
      locators.push({ type: 'xpath', value: target.xpath });
    }
    
    // Name attribute
    if (target.name) {
      locators.push({ type: 'name', value: `[name="${target.name}"]` });
    }
    
    // Aria label
    if (target.attributes?.['aria-label']) {
      locators.push({
        type: 'aria-label',
        value: `[aria-label="${target.attributes['aria-label']}"]`,
      });
    }
    
    // Text content (last resort)
    if (target.textContent && target.tagName) {
      locators.push({
        type: 'text',
        value: `//${target.tagName}[contains(text(),"${target.textContent.slice(0, 50)}")]`,
      });
    }
    
    return locators;
  }
  
  /**
   * Tries a single locator
   */
  private tryLocator(type: string, value: string): Element | null {
    try {
      if (type === 'xpath' || type === 'text') {
        const result = document.evaluate(
          value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue as Element | null;
      }
      
      return document.querySelector(value);
    } catch {
      return null;
    }
  }
  
  // ==========================================================================
  // WAIT CONDITIONS
  // ==========================================================================
  
  /**
   * Waits for element to reach a state
   */
  async waitForState(
    element: Element,
    state: ElementState,
    timeout: number
  ): Promise<boolean> {
    const condition = this.getStateCondition(state);
    return this.waitForCondition(element, condition, timeout);
  }
  
  /**
   * Waits for a condition to be true
   */
  async waitForCondition(
    element: Element | null,
    condition: WaitCondition,
    timeout: number
  ): Promise<boolean> {
    const endTime = Date.now() + timeout;
    
    while (Date.now() < endTime) {
      if (await condition(element)) {
        return true;
      }
      await this.delay(this.config.pollInterval);
    }
    
    return false;
  }
  
  /**
   * Gets condition function for state
   */
  private getStateCondition(state: ElementState): WaitCondition {
    switch (state) {
      case 'attached':
        return (el) => el !== null && document.contains(el);
      case 'detached':
        return (el) => el === null || !document.contains(el);
      case 'visible':
        return (el) => el !== null && this.isVisible(el);
      case 'hidden':
        return (el) => el === null || !this.isVisible(el);
      case 'enabled':
        return (el) => {
          if (!el) return false;
          const htmlEl = el as HTMLButtonElement | HTMLInputElement;
          return !('disabled' in htmlEl) || !htmlEl.disabled;
        };
      case 'disabled':
        return (el) => {
          if (!el) return false;
          const htmlEl = el as HTMLButtonElement | HTMLInputElement;
          return 'disabled' in htmlEl && htmlEl.disabled === true;
        };
      case 'editable':
        return (el) => el !== null && this.isEditable(el);
      case 'checked':
        return (el) => el !== null && (el as HTMLInputElement).checked === true;
      case 'unchecked':
        return (el) => el !== null && (el as HTMLInputElement).checked === false;
      default:
        return () => true;
    }
  }
  
  /**
   * Checks if element is visible
   */
  private isVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return true;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }
  
  /**
   * Checks if element is editable
   */
  private isEditable(element: Element): boolean {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return !element.disabled && !element.readOnly;
    }
    return element.hasAttribute('contenteditable');
  }
  
  // ==========================================================================
  // DEFAULT ACTION HANDLERS
  // ==========================================================================
  
  /**
   * Registers default action handlers
   */
  private registerDefaultHandlers(): void {
    this.handlers.set('click', this.handleClick.bind(this));
    this.handlers.set('dblclick', this.handleDoubleClick.bind(this));
    this.handlers.set('input', this.handleInput.bind(this));
    this.handlers.set('keypress', this.handleKeypress.bind(this));
    this.handlers.set('select', this.handleSelect.bind(this));
    this.handlers.set('hover', this.handleHover.bind(this));
    this.handlers.set('scroll', this.handleScroll.bind(this));
    this.handlers.set('focus', this.handleFocus.bind(this));
    this.handlers.set('blur', this.handleBlur.bind(this));
    this.handlers.set('submit', this.handleSubmit.bind(this));
    this.handlers.set('navigate', this.handleNavigate.bind(this));
    this.handlers.set('wait', this.handleWait.bind(this));
    this.handlers.set('assert', this.handleAssert.bind(this));
    this.handlers.set('screenshot', this.handleScreenshot.bind(this));
    this.handlers.set('drag', this.handleDrag.bind(this));
    this.handlers.set('drop', this.handleDrop.bind(this));
    this.handlers.set('upload', this.handleUpload.bind(this));
    this.handlers.set('download', this.handleDownload.bind(this));
  }
  
  /**
   * Click action handler
   */
  private async handleClick(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for click'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    // Perform click
    const htmlElement = element as HTMLElement;
    
    // Dispatch events
    this.dispatchMouseEvent(element, 'mousedown');
    this.dispatchMouseEvent(element, 'mouseup');
    this.dispatchMouseEvent(element, 'click');
    
    // Also call click() for native handling
    if (typeof htmlElement.click === 'function') {
      htmlElement.click();
    }
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Double-click action handler
   */
  private async handleDoubleClick(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for double-click'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    // Dispatch double-click sequence
    this.dispatchMouseEvent(element, 'mousedown');
    this.dispatchMouseEvent(element, 'mouseup');
    this.dispatchMouseEvent(element, 'click');
    this.dispatchMouseEvent(element, 'mousedown');
    this.dispatchMouseEvent(element, 'mouseup');
    this.dispatchMouseEvent(element, 'click');
    this.dispatchMouseEvent(element, 'dblclick');
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Input action handler
   */
  private async handleInput(
    element: Element | null,
    step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for input'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
    const value = step.value ?? '';
    
    // Focus element
    inputElement.focus();
    this.dispatchEvent(element, 'focus');
    
    // Clear existing value
    inputElement.value = '';
    this.dispatchEvent(element, 'input', { inputType: 'deleteContent' });
    
    // Type value character by character (or instant)
    if (this.config.humanizeDelays && this.config.typingDelay > 0) {
      for (const char of value) {
        inputElement.value += char;
        this.dispatchKeyboardEvent(element, 'keydown', char);
        this.dispatchKeyboardEvent(element, 'keypress', char);
        this.dispatchEvent(element, 'input', { inputType: 'insertText', data: char });
        this.dispatchKeyboardEvent(element, 'keyup', char);
        await this.delay(this.config.typingDelay);
      }
    } else {
      inputElement.value = value;
      this.dispatchEvent(element, 'input', { inputType: 'insertText', data: value });
    }
    
    // Dispatch change
    this.dispatchEvent(element, 'change');
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
      actualValue: inputElement.value,
    };
  }
  
  /**
   * Keypress action handler
   */
  private async handleKeypress(
    element: Element | null,
    step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const target = element ?? document.activeElement ?? document.body;
    const key = step.value ?? '';
    
    // Get modifier keys from metadata
    const modifiers = step.metadata?.modifiers as {
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
      meta?: boolean;
    } ?? {};
    
    // Dispatch key events
    this.dispatchKeyboardEvent(target, 'keydown', key, modifiers);
    this.dispatchKeyboardEvent(target, 'keypress', key, modifiers);
    this.dispatchKeyboardEvent(target, 'keyup', key, modifiers);
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element: target,
      elementFound: true,
    };
  }
  
  /**
   * Select action handler
   */
  private async handleSelect(
    element: Element | null,
    step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element || !(element instanceof HTMLSelectElement)) {
      return {
        success: false,
        error: new Error('Element not found or not a select'),
        duration: Date.now() - startTime,
        elementFound: element !== null,
      };
    }
    
    const selectElement = element;
    const value = step.value ?? '';
    
    // Find option
    const option = Array.from(selectElement.options).find(
      opt => opt.value === value || opt.text === value
    );
    
    if (!option) {
      return {
        success: false,
        error: new Error(`Option not found: ${value}`),
        duration: Date.now() - startTime,
        elementFound: true,
      };
    }
    
    // Select option
    selectElement.value = option.value;
    this.dispatchEvent(element, 'change');
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
      actualValue: selectElement.value,
    };
  }
  
  /**
   * Hover action handler
   */
  private async handleHover(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for hover'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    this.dispatchMouseEvent(element, 'mouseenter');
    this.dispatchMouseEvent(element, 'mouseover');
    
    // Wait for hover effect
    const hoverDuration = (_step.metadata?.hoverDuration as number) ?? 100;
    await this.delay(hoverDuration);
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Scroll action handler
   */
  private async handleScroll(
    element: Element | null,
    step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const target = element ?? document.documentElement;
    
    const scrollX = (step.metadata?.scrollX as number) ?? 0;
    const scrollY = (step.metadata?.scrollY as number) ?? 0;
    
    if (target === document.documentElement) {
      window.scrollTo(scrollX, scrollY);
    } else {
      target.scrollTop = scrollY;
      target.scrollLeft = scrollX;
    }
    
    this.dispatchEvent(target, 'scroll');
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element: target,
      elementFound: true,
    };
  }
  
  /**
   * Focus action handler
   */
  private async handleFocus(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for focus'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    (element as HTMLElement).focus();
    this.dispatchEvent(element, 'focus');
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Blur action handler
   */
  private async handleBlur(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for blur'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    (element as HTMLElement).blur();
    this.dispatchEvent(element, 'blur');
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Submit action handler
   */
  private async handleSubmit(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    // Find form
    const form = element instanceof HTMLFormElement
      ? element
      : element?.closest('form');
    
    if (!form) {
      return {
        success: false,
        error: new Error('Form not found for submit'),
        duration: Date.now() - startTime,
        elementFound: element !== null,
      };
    }
    
    // Dispatch submit event
    const event = new SubmitEvent('submit', { bubbles: true, cancelable: true });
    const submitted = form.dispatchEvent(event);
    
    // If not prevented, submit the form
    if (submitted) {
      form.submit();
    }
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element: form,
      elementFound: true,
    };
  }
  
  /**
   * Navigate action handler
   */
  private async handleNavigate(
    _element: Element | null,
    step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const url = step.value ?? '';
    
    if (!url) {
      return {
        success: false,
        error: new Error('No URL provided for navigation'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    // Navigate
    window.location.href = url;
    
    return {
      success: true,
      duration: Date.now() - startTime,
      elementFound: false,
      data: { url },
    };
  }
  
  /**
   * Wait action handler
   */
  private async handleWait(
    element: Element | null,
    step: RecordedStep,
    context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const waitType = (step.metadata?.waitType as string) ?? 'element';
    const waitTime = (step.metadata?.waitTime as number) ?? 1000;
    
    switch (waitType) {
      case 'time':
        await this.delay(waitTime);
        break;
        
      case 'element':
        if (element) {
          await this.waitForState(element, 'visible', context.timeout);
        }
        break;
        
      case 'navigation':
        // Wait for page load
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(true);
          } else {
            window.addEventListener('load', () => resolve(true), { once: true });
          }
        });
        break;
    }
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element: element ?? undefined,
      elementFound: element !== null,
    };
  }
  
  /**
   * Assert action handler
   */
  private async handleAssert(
    element: Element | null,
    step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const assertion = step.metadata?.assertion as {
      type: string;
      expected?: string;
      attribute?: string;
    };
    
    if (!assertion) {
      return {
        success: false,
        error: new Error('No assertion defined'),
        duration: Date.now() - startTime,
        elementFound: element !== null,
      };
    }
    
    let success = false;
    let actualValue: string | undefined;
    
    switch (assertion.type) {
      case 'exists':
        success = element !== null;
        break;
        
      case 'visible':
        success = element !== null && this.isVisible(element);
        break;
        
      case 'text':
        actualValue = element?.textContent?.trim() ?? '';
        success = actualValue === assertion.expected;
        break;
        
      case 'value':
        actualValue = (element as HTMLInputElement)?.value ?? '';
        success = actualValue === assertion.expected;
        break;
        
      case 'attribute':
        if (assertion.attribute) {
          actualValue = element?.getAttribute(assertion.attribute) ?? '';
          success = assertion.expected
            ? actualValue === assertion.expected
            : actualValue !== '';
        }
        break;
        
      default:
        return {
          success: false,
          error: new Error(`Unknown assertion type: ${assertion.type}`),
          duration: Date.now() - startTime,
          elementFound: element !== null,
        };
    }
    
    return {
      success,
      error: success ? undefined : new Error(
        `Assertion failed: expected ${assertion.expected}, got ${actualValue}`
      ),
      duration: Date.now() - startTime,
      element: element ?? undefined,
      elementFound: element !== null,
      actualValue,
    };
  }
  
  /**
   * Screenshot action handler
   */
  private async handleScreenshot(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    let screenshot: string | undefined;
    
    if (this.config.screenshotCapturer) {
      screenshot = await this.config.screenshotCapturer.capture(element ?? undefined);
    }
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element: element ?? undefined,
      elementFound: element !== null,
      screenshot,
    };
  }
  
  /**
   * Drag action handler
   */
  private async handleDrag(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for drag'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    const dataTransfer = new DataTransfer();
    
    this.dispatchDragEvent(element, 'dragstart', dataTransfer);
    this.dispatchDragEvent(element, 'drag', dataTransfer);
    
    // Store for drop
    _context.metadata.dragElement = element;
    _context.metadata.dataTransfer = dataTransfer;
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Drop action handler
   */
  private async handleDrop(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element) {
      return {
        success: false,
        error: new Error('Element not found for drop'),
        duration: Date.now() - startTime,
        elementFound: false,
      };
    }
    
    const dataTransfer = (_context.metadata.dataTransfer as DataTransfer) ?? new DataTransfer();
    const dragElement = _context.metadata.dragElement as Element | undefined;
    
    this.dispatchDragEvent(element, 'dragenter', dataTransfer);
    this.dispatchDragEvent(element, 'dragover', dataTransfer);
    this.dispatchDragEvent(element, 'drop', dataTransfer);
    
    if (dragElement) {
      this.dispatchDragEvent(dragElement, 'dragend', dataTransfer);
    }
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
    };
  }
  
  /**
   * Upload action handler
   */
  private async handleUpload(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!element || !(element instanceof HTMLInputElement) || element.type !== 'file') {
      return {
        success: false,
        error: new Error('Element not found or not a file input'),
        duration: Date.now() - startTime,
        elementFound: element !== null,
      };
    }
    
    // Note: Actual file upload requires user interaction
    // This handler is a placeholder for the action
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element,
      elementFound: true,
      data: { note: 'File upload requires user interaction' },
    };
  }
  
  /**
   * Download action handler
   */
  private async handleDownload(
    element: Element | null,
    _step: RecordedStep,
    _context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (element instanceof HTMLAnchorElement) {
      // Trigger download link
      element.click();
    }
    
    return {
      success: true,
      duration: Date.now() - startTime,
      element: element ?? undefined,
      elementFound: element !== null,
    };
  }
  
  // ==========================================================================
  // EVENT DISPATCHING
  // ==========================================================================
  
  /**
   * Dispatches a generic event
   */
  private dispatchEvent(
    element: Element,
    type: string,
    detail?: Record<string, unknown>
  ): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, detail);
    element.dispatchEvent(event);
  }
  
  /**
   * Dispatches a mouse event
   */
  private dispatchMouseEvent(
    element: Element,
    type: string,
    options?: MouseEventInit
  ): void {
    const rect = element.getBoundingClientRect();
    
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      ...options,
    });
    
    element.dispatchEvent(event);
  }
  
  /**
   * Dispatches a keyboard event
   */
  private dispatchKeyboardEvent(
    element: Element,
    type: string,
    key: string,
    modifiers?: {
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
      meta?: boolean;
    }
  ): void {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key,
      code: this.keyToCode(key),
      ctrlKey: modifiers?.ctrl ?? false,
      shiftKey: modifiers?.shift ?? false,
      altKey: modifiers?.alt ?? false,
      metaKey: modifiers?.meta ?? false,
    });
    
    element.dispatchEvent(event);
  }
  
  /**
   * Dispatches a drag event
   */
  private dispatchDragEvent(
    element: Element,
    type: string,
    dataTransfer: DataTransfer
  ): void {
    const event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    
    element.dispatchEvent(event);
  }
  
  /**
   * Converts key to code
   */
  private keyToCode(key: string): string {
    const keyMap: Record<string, string> = {
      Enter: 'Enter',
      Tab: 'Tab',
      Escape: 'Escape',
      Backspace: 'Backspace',
      Delete: 'Delete',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
      ' ': 'Space',
    };
    
    if (keyMap[key]) return keyMap[key];
    if (key.length === 1) return `Key${key.toUpperCase()}`;
    return key;
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Checks if step type requires element
   */
  private requiresElement(type: StepType): boolean {
    const noElementTypes: StepType[] = ['navigate', 'wait', 'screenshot'];
    return !noElementTypes.includes(type);
  }
  
  /**
   * Checks if element is optional for step type
   */
  private isOptionalElement(type: StepType): boolean {
    const optionalTypes: StepType[] = ['keypress', 'scroll', 'wait', 'screenshot'];
    return optionalTypes.includes(type);
  }
  
  /**
   * Scrolls element into view
   */
  private async scrollIntoView(element: Element): Promise<void> {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
    
    // Wait for scroll
    await this.delay(100);
  }
  
  /**
   * Highlights element temporarily
   */
  private async highlightElement(element: Element): Promise<void> {
    const htmlElement = element as HTMLElement;
    const originalOutline = htmlElement.style.outline;
    const originalOutlineOffset = htmlElement.style.outlineOffset;
    
    htmlElement.style.outline = '2px solid #ff6b00';
    htmlElement.style.outlineOffset = '2px';
    
    await this.delay(this.config.highlightDuration);
    
    htmlElement.style.outline = originalOutline;
    htmlElement.style.outlineOffset = originalOutlineOffset;
  }
  
  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new ActionExecutor
 * 
 * @param config - Executor configuration
 * @returns New ActionExecutor instance
 */
export function createActionExecutor(config?: ActionExecutorConfig): ActionExecutor {
  return new ActionExecutor(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ActionExecutor;
