/**
 * ActionExecutor - DOM Action Execution
 * @module core/replay/ActionExecutor
 * @version 1.0.0
 * 
 * Executes user actions on DOM elements with framework-safe patterns
 * and human-like timing to simulate realistic user interactions.
 * 
 * ## Supported Actions
 * - **Click**: Human-like mouse event sequence
 * - **Input**: React-safe value setting with property descriptors
 * - **Keyboard**: Key press simulation (Enter, Tab, Escape)
 * - **Select**: Dropdown value selection
 * - **Checkbox/Radio**: Toggle and selection
 * - **Focus/Blur**: Focus management
 * 
 * ## React-Safe Input Pattern
 * ```typescript
 * const setter = Object.getOwnPropertyDescriptor(
 *   HTMLInputElement.prototype, 'value'
 * )?.set;
 * setter?.call(element, value);
 * element.dispatchEvent(new Event('input', { bubbles: true }));
 * ```
 * 
 * @example
 * ```typescript
 * const executor = new ActionExecutor();
 * 
 * await executor.click(button);
 * await executor.input(textField, 'Hello World');
 * await executor.pressEnter(form);
 * ```
 */

import type { BehaviorConfig } from './ReplayConfig';
import { DEFAULT_BEHAVIOR_CONFIG } from './ReplayConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action types
 */
export type ActionType = 
  | 'click'
  | 'input'
  | 'clear'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'focus'
  | 'blur'
  | 'keydown'
  | 'keypress'
  | 'keyup'
  | 'enter'
  | 'tab'
  | 'escape'
  | 'scroll';

/**
 * Action result
 */
export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  
  /** Action type executed */
  action: ActionType;
  
  /** Duration in milliseconds */
  duration: number;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Action options
 */
export interface ActionOptions {
  /** Whether to use human-like timing (default: true) */
  humanLike?: boolean;
  
  /** Delay before action in ms (default: 0) */
  preDelay?: number;
  
  /** Delay after action in ms (default: 0) */
  postDelay?: number;
  
  /** Whether to focus before action (default: true) */
  focusFirst?: boolean;
  
  /** Whether to blur after action (default: false) */
  blurAfter?: boolean;
  
  /** Whether to scroll into view (default: true) */
  scrollIntoView?: boolean;
  
  /** Whether to use React-safe input (default: true) */
  reactSafe?: boolean;
  
  /** Custom delay range for human-like timing [min, max] */
  humanDelayRange?: [number, number];
}

/**
 * Default action options
 */
export const DEFAULT_ACTION_OPTIONS: Required<ActionOptions> = {
  humanLike: true,
  preDelay: 0,
  postDelay: 0,
  focusFirst: true,
  blurAfter: false,
  scrollIntoView: true,
  reactSafe: true,
  humanDelayRange: [50, 150],
};

/**
 * Keyboard key configuration
 */
export interface KeyConfig {
  key: string;
  code: string;
  keyCode: number;
  which: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * Common key configurations
 */
export const KEYS: Record<string, KeyConfig> = {
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 },
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9, which: 9 },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27, which: 27 },
  Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8 },
  Delete: { key: 'Delete', code: 'Delete', keyCode: 46, which: 46 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39 },
  Space: { key: ' ', code: 'Space', keyCode: 32, which: 32 },
};

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
 * Get random delay within range
 */
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if element is an input element
 */
function isInputElement(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

/**
 * Check if element is a textarea
 */
function isTextareaElement(element: Element): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

/**
 * Check if element is a select
 */
function isSelectElement(element: Element): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement;
}

/**
 * Check if element is contenteditable
 */
function isContentEditable(element: Element): boolean {
  if (element instanceof HTMLElement) {
    return element.isContentEditable || element.contentEditable === 'true';
  }
  return false;
}

/**
 * Check if element is a checkbox
 */
function isCheckbox(element: Element): boolean {
  return isInputElement(element) && element.type === 'checkbox';
}

/**
 * Check if element is a radio button
 */
function isRadio(element: Element): boolean {
  return isInputElement(element) && element.type === 'radio';
}

/**
 * Get element center coordinates
 */
function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Create MouseEvent with JSDOM compatibility
 */
function createMouseEvent(type: string, init: MouseEventInit): MouseEvent {
  const eventInit = { ...init };
  
  // Only add view if window is a proper Window object (not in JSDOM)
  if (typeof window !== 'undefined' && window.constructor.name === 'Window') {
    eventInit.view = window;
  }
  
  return new MouseEvent(type, eventInit);
}

// ============================================================================
// ACTION EXECUTOR CLASS
// ============================================================================

/**
 * Executes DOM actions with framework-safe patterns
 */
export class ActionExecutor {
  private options: Required<ActionOptions>;
  
  constructor(options?: Partial<ActionOptions>) {
    this.options = { ...DEFAULT_ACTION_OPTIONS, ...options };
  }
  
  // ==========================================================================
  // CLICK ACTIONS
  // ==========================================================================
  
  /**
   * Execute human-like click on element
   */
  async click(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    
    try {
      // Pre-delay
      if (opts.preDelay > 0) {
        await sleep(opts.preDelay);
      }
      
      // Scroll into view
      if (opts.scrollIntoView && element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100); // Wait for scroll
      }
      
      // Focus if needed
      if (opts.focusFirst && element instanceof HTMLElement) {
        element.focus();
      }
      
      // Get coordinates
      const { x, y } = getElementCenter(element);
      
      // Human-like click sequence
      if (opts.humanLike) {
        await this.humanClick(element, x, y, opts.humanDelayRange);
      } else {
        this.dispatchClick(element, x, y);
      }
      
      // Blur if requested
      if (opts.blurAfter && element instanceof HTMLElement) {
        element.blur();
      }
      
      // Post-delay
      if (opts.postDelay > 0) {
        await sleep(opts.postDelay);
      }
      
      return {
        success: true,
        action: 'click',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'click',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Execute human-like click sequence
   */
  private async humanClick(
    element: Element,
    x: number,
    y: number,
    delayRange: [number, number]
  ): Promise<void> {
    const [minDelay, maxDelay] = delayRange;
    
    // Mouseover
    element.dispatchEvent(createMouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }));
    
    await sleep(getRandomDelay(minDelay, maxDelay));
    
    // Mousemove
    element.dispatchEvent(createMouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }));
    
    await sleep(getRandomDelay(minDelay / 2, maxDelay / 2));
    
    // Mousedown
    element.dispatchEvent(createMouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
    }));
    
    await sleep(getRandomDelay(minDelay / 2, maxDelay / 2));
    
    // Mouseup
    element.dispatchEvent(createMouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 0,
      clientX: x,
      clientY: y,
    }));
    
    // Click
    element.dispatchEvent(createMouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
    }));
  }
  
  /**
   * Dispatch simple click
   */
  private dispatchClick(element: Element, x: number, y: number): void {
    element.dispatchEvent(createMouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
    }));
  }
  
  // ==========================================================================
  // INPUT ACTIONS
  // ==========================================================================
  
  /**
   * Set input value with React-safe pattern
   */
  async input(
    element: Element,
    value: string,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    
    try {
      // Pre-delay
      if (opts.preDelay > 0) {
        await sleep(opts.preDelay);
      }
      
      // Scroll into view
      if (opts.scrollIntoView && element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);
      }
      
      // Focus
      if (opts.focusFirst && element instanceof HTMLElement) {
        element.focus();
        await sleep(50);
      }
      
      // Set value based on element type
      if (isInputElement(element) || isTextareaElement(element)) {
        if (opts.reactSafe) {
          this.setValueReactSafe(element, value);
        } else {
          element.value = value;
        }
        
        // Dispatch events
        this.dispatchInputEvents(element);
      } else if (isContentEditable(element)) {
        this.setContentEditableValue(element as HTMLElement, value);
      } else if (isSelectElement(element)) {
        return this.select(element, value, options);
      }
      
      // Blur if requested
      if (opts.blurAfter && element instanceof HTMLElement) {
        element.blur();
      }
      
      // Post-delay
      if (opts.postDelay > 0) {
        await sleep(opts.postDelay);
      }
      
      return {
        success: true,
        action: 'input',
        duration: Date.now() - startTime,
        details: { value },
      };
    } catch (error) {
      return {
        success: false,
        action: 'input',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Set value using React-safe property descriptor
   */
  private setValueReactSafe(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ): void {
    // Get the native value setter
    const prototype = element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
    
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    
    if (descriptor?.set) {
      // Use native setter to bypass React
      descriptor.set.call(element, value);
    } else {
      // Fallback to direct assignment
      element.value = value;
    }
  }
  
  /**
   * Set contenteditable value
   */
  private setContentEditableValue(element: HTMLElement, value: string): void {
    element.focus();
    
    // Clear existing content
    element.innerHTML = '';
    
    // Set new content
    element.innerText = value;
    
    // Dispatch input event
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value,
    }));
  }
  
  /**
   * Dispatch input events
   */
  private dispatchInputEvents(element: Element): void {
    // Input event
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
    }));
    
    // Change event
    element.dispatchEvent(new Event('change', {
      bubbles: true,
      cancelable: true,
    }));
  }
  
  /**
   * Clear input value
   */
  async clear(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    return this.input(element, '', options);
  }
  
  // ==========================================================================
  // SELECT ACTIONS
  // ==========================================================================
  
  /**
   * Select option in dropdown
   */
  async select(
    element: Element,
    value: string,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    
    try {
      if (!isSelectElement(element)) {
        return {
          success: false,
          action: 'select',
          duration: Date.now() - startTime,
          error: 'Element is not a select',
        };
      }
      
      // Pre-delay
      if (opts.preDelay > 0) {
        await sleep(opts.preDelay);
      }
      
      // Focus
      if (opts.focusFirst) {
        element.focus();
      }
      
      // Find option by value or text
      let found = false;
      for (let i = 0; i < element.options.length; i++) {
        const option = element.options[i];
        if (option.value === value || option.text === value) {
          option.selected = true;
          found = true;
          break;
        }
      }
      
      if (!found) {
        return {
          success: false,
          action: 'select',
          duration: Date.now() - startTime,
          error: `Option not found: ${value}`,
        };
      }
      
      // Dispatch events
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Blur if requested
      if (opts.blurAfter) {
        element.blur();
      }
      
      // Post-delay
      if (opts.postDelay > 0) {
        await sleep(opts.postDelay);
      }
      
      return {
        success: true,
        action: 'select',
        duration: Date.now() - startTime,
        details: { value },
      };
    } catch (error) {
      return {
        success: false,
        action: 'select',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ==========================================================================
  // CHECKBOX/RADIO ACTIONS
  // ==========================================================================
  
  /**
   * Check a checkbox
   */
  async check(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!isCheckbox(element) && !isRadio(element)) {
      return {
        success: false,
        action: 'check',
        duration: Date.now() - startTime,
        error: 'Element is not a checkbox or radio',
      };
    }
    
    const input = element as HTMLInputElement;
    
    if (!input.checked) {
      return this.click(element, options).then(result => ({
        ...result,
        action: 'check' as ActionType,
      }));
    }
    
    return {
      success: true,
      action: 'check',
      duration: Date.now() - startTime,
      details: { alreadyChecked: true },
    };
  }
  
  /**
   * Uncheck a checkbox
   */
  async uncheck(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    if (!isCheckbox(element)) {
      return {
        success: false,
        action: 'uncheck',
        duration: Date.now() - startTime,
        error: 'Element is not a checkbox',
      };
    }
    
    const input = element as HTMLInputElement;
    
    if (input.checked) {
      return this.click(element, options).then(result => ({
        ...result,
        action: 'uncheck' as ActionType,
      }));
    }
    
    return {
      success: true,
      action: 'uncheck',
      duration: Date.now() - startTime,
      details: { alreadyUnchecked: true },
    };
  }
  
  /**
   * Toggle checkbox state
   */
  async toggle(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    if (!isCheckbox(element)) {
      return {
        success: false,
        action: 'check',
        duration: 0,
        error: 'Element is not a checkbox',
      };
    }
    
    const input = element as HTMLInputElement;
    return input.checked ? this.uncheck(element, options) : this.check(element, options);
  }
  
  // ==========================================================================
  // KEYBOARD ACTIONS
  // ==========================================================================
  
  /**
   * Press a key
   */
  async pressKey(
    element: Element,
    keyConfig: KeyConfig,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();
    
    try {
      // Pre-delay
      if (opts.preDelay > 0) {
        await sleep(opts.preDelay);
      }
      
      // Focus
      if (opts.focusFirst && element instanceof HTMLElement) {
        element.focus();
      }
      
      const eventInit: KeyboardEventInit = {
        bubbles: true,
        cancelable: true,
        key: keyConfig.key,
        code: keyConfig.code,
        keyCode: keyConfig.keyCode,
        which: keyConfig.which,
        shiftKey: keyConfig.shiftKey || false,
        ctrlKey: keyConfig.ctrlKey || false,
        altKey: keyConfig.altKey || false,
        metaKey: keyConfig.metaKey || false,
      };
      
      // Keydown
      element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      
      if (opts.humanLike) {
        await sleep(getRandomDelay(10, 30));
      }
      
      // Keypress (deprecated but some sites still use it)
      element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
      
      if (opts.humanLike) {
        await sleep(getRandomDelay(10, 30));
      }
      
      // Keyup
      element.dispatchEvent(new KeyboardEvent('keyup', eventInit));
      
      // Post-delay
      if (opts.postDelay > 0) {
        await sleep(opts.postDelay);
      }
      
      return {
        success: true,
        action: 'keydown',
        duration: Date.now() - startTime,
        details: { key: keyConfig.key },
      };
    } catch (error) {
      return {
        success: false,
        action: 'keydown',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Press Enter key
   */
  async pressEnter(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const result = await this.pressKey(element, KEYS.Enter, options);
    return { ...result, action: 'enter' };
  }
  
  /**
   * Press Tab key
   */
  async pressTab(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const result = await this.pressKey(element, KEYS.Tab, options);
    return { ...result, action: 'tab' };
  }
  
  /**
   * Press Escape key
   */
  async pressEscape(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const result = await this.pressKey(element, KEYS.Escape, options);
    return { ...result, action: 'escape' };
  }
  
  /**
   * Type text character by character
   */
  async type(
    element: Element,
    text: string,
    options?: Partial<ActionOptions> & { charDelay?: number }
  ): Promise<ActionResult> {
    const opts = { ...this.options, ...options };
    const charDelay = options?.charDelay ?? 50;
    const startTime = Date.now();
    
    try {
      // Focus
      if (opts.focusFirst && element instanceof HTMLElement) {
        element.focus();
      }
      
      // Type each character
      for (const char of text) {
        if (isInputElement(element) || isTextareaElement(element)) {
          const currentValue = element.value;
          if (opts.reactSafe) {
            this.setValueReactSafe(element, currentValue + char);
          } else {
            element.value = currentValue + char;
          }
          
          // Dispatch input event for each character
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: char,
          }));
        }
        
        if (charDelay > 0) {
          await sleep(charDelay);
        }
      }
      
      // Final change event
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return {
        success: true,
        action: 'input',
        duration: Date.now() - startTime,
        details: { text, charCount: text.length },
      };
    } catch (error) {
      return {
        success: false,
        action: 'input',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ==========================================================================
  // FOCUS ACTIONS
  // ==========================================================================
  
  /**
   * Focus element
   */
  async focus(
    element: Element,
    options?: Partial<ActionOptions>
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      if (!(element instanceof HTMLElement)) {
        return {
          success: false,
          action: 'focus',
          duration: Date.now() - startTime,
          error: 'Element is not focusable',
        };
      }
      
      // Scroll into view if needed
      if (options?.scrollIntoView ?? this.options.scrollIntoView) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);
      }
      
      element.focus();
      
      // Dispatch focus event
      element.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
      element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      
      return {
        success: true,
        action: 'focus',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'focus',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Blur element
   */
  async blur(element: Element): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      if (!(element instanceof HTMLElement)) {
        return {
          success: false,
          action: 'blur',
          duration: Date.now() - startTime,
          error: 'Element is not blurrable',
        };
      }
      
      element.blur();
      
      // Dispatch blur events
      element.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
      element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      
      return {
        success: true,
        action: 'blur',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'blur',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ==========================================================================
  // SCROLL ACTIONS
  // ==========================================================================
  
  /**
   * Scroll element into view
   */
  async scrollIntoView(
    element: Element,
    options?: ScrollIntoViewOptions
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      element.scrollIntoView(options ?? { behavior: 'smooth', block: 'center' });
      
      // Wait for scroll to complete
      await sleep(300);
      
      return {
        success: true,
        action: 'scroll',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action: 'scroll',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get current options
   */
  getOptions(): Required<ActionOptions> {
    return { ...this.options };
  }
  
  /**
   * Update options
   */
  setOptions(options: Partial<ActionOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create action executor
 */
export function createActionExecutor(options?: Partial<ActionOptions>): ActionExecutor {
  return new ActionExecutor(options);
}

/**
 * Create fast executor (no human-like delays)
 */
export function createFastExecutor(): ActionExecutor {
  return new ActionExecutor({
    humanLike: false,
    preDelay: 0,
    postDelay: 0,
  });
}

/**
 * Create realistic executor (human-like timing)
 */
export function createRealisticExecutor(): ActionExecutor {
  return new ActionExecutor({
    humanLike: true,
    preDelay: 100,
    postDelay: 200,
    humanDelayRange: [100, 300],
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultExecutor: ActionExecutor | null = null;

/**
 * Get default executor
 */
export function getActionExecutor(): ActionExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new ActionExecutor();
  }
  return defaultExecutor;
}

/**
 * Reset default executor
 */
export function resetActionExecutor(): void {
  defaultExecutor = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Click element with default executor
 */
export async function clickElement(
  element: Element,
  options?: Partial<ActionOptions>
): Promise<ActionResult> {
  return getActionExecutor().click(element, options);
}

/**
 * Input value with default executor
 */
export async function inputValue(
  element: Element,
  value: string,
  options?: Partial<ActionOptions>
): Promise<ActionResult> {
  return getActionExecutor().input(element, value, options);
}

/**
 * Press Enter with default executor
 */
export async function pressEnter(
  element: Element,
  options?: Partial<ActionOptions>
): Promise<ActionResult> {
  return getActionExecutor().pressEnter(element, options);
}
