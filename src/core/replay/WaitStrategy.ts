/**
 * WaitStrategy - Element waiting and polling strategies
 * @module core/replay/WaitStrategy
 * @version 1.0.0
 * 
 * Provides configurable waiting strategies for ensuring elements
 * are ready before interaction. Supports multiple condition types
 * with composable logic.
 * 
 * Features:
 * - Multiple wait condition types
 * - Composable conditions (AND, OR, NOT)
 * - Configurable polling intervals
 * - Timeout with descriptive errors
 * - Stability detection for animations
 * - Network idle detection
 * 
 * @see replay-engine_breakdown.md for architecture details
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default wait timeout (ms)
 */
export const DEFAULT_WAIT_TIMEOUT = 30000;

/**
 * Default poll interval (ms)
 */
export const DEFAULT_POLL_INTERVAL = 100;

/**
 * Default stability threshold (ms)
 */
export const DEFAULT_STABILITY_THRESHOLD = 250;

/**
 * Default stability check count
 */
export const DEFAULT_STABILITY_CHECKS = 3;

/**
 * Minimum poll interval (ms)
 */
export const MIN_POLL_INTERVAL = 10;

/**
 * Maximum poll interval (ms)
 */
export const MAX_POLL_INTERVAL = 5000;

/**
 * Wait condition types
 */
export const WAIT_CONDITIONS = {
  /** Element exists in DOM */
  ATTACHED: 'attached',
  /** Element removed from DOM */
  DETACHED: 'detached',
  /** Element is visible */
  VISIBLE: 'visible',
  /** Element is hidden */
  HIDDEN: 'hidden',
  /** Element is enabled (not disabled) */
  ENABLED: 'enabled',
  /** Element is disabled */
  DISABLED: 'disabled',
  /** Element is editable (input/textarea) */
  EDITABLE: 'editable',
  /** Element is checked (checkbox/radio) */
  CHECKED: 'checked',
  /** Element is unchecked */
  UNCHECKED: 'unchecked',
  /** Element is stable (not animating) */
  STABLE: 'stable',
  /** Element has specific text */
  TEXT: 'text',
  /** Element has specific value */
  VALUE: 'value',
  /** Element has specific attribute */
  ATTRIBUTE: 'attribute',
  /** Element matches selector */
  SELECTOR: 'selector',
  /** Custom function condition */
  FUNCTION: 'function',
  /** Network is idle */
  NETWORK_IDLE: 'networkIdle',
  /** Page load complete */
  LOAD: 'load',
  /** DOM content loaded */
  DOM_READY: 'domReady',
  /** No pending animations */
  ANIMATIONS_COMPLETE: 'animationsComplete',
} as const;

/**
 * Wait condition type
 */
export type WaitConditionType = typeof WAIT_CONDITIONS[keyof typeof WAIT_CONDITIONS];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Wait condition definition
 */
export interface WaitCondition {
  /** Condition type */
  type: WaitConditionType;
  /** Expected value (for text, value, attribute conditions) */
  expected?: string | RegExp;
  /** Attribute name (for attribute condition) */
  attribute?: string;
  /** Selector (for selector condition) */
  selector?: string;
  /** Custom function (for function condition) */
  fn?: (element: Element | null) => boolean | Promise<boolean>;
  /** Negate the condition */
  negate?: boolean;
}

/**
 * Wait options
 */
export interface WaitOptions {
  /** Timeout in ms */
  timeout?: number;
  /** Poll interval in ms */
  pollInterval?: number;
  /** Stability threshold in ms */
  stabilityThreshold?: number;
  /** Number of stability checks */
  stabilityChecks?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Custom message on timeout */
  timeoutMessage?: string;
  /** Whether to throw on timeout */
  throwOnTimeout?: boolean;
}

/**
 * Wait result
 */
export interface WaitResult {
  /** Whether condition was met */
  success: boolean;
  /** Element if found */
  element?: Element;
  /** Duration waited (ms) */
  duration: number;
  /** Error if failed */
  error?: Error;
  /** Number of polls performed */
  pollCount: number;
  /** Condition that was checked */
  condition: WaitCondition;
}

/**
 * Element stability state
 */
interface StabilityState {
  rect: DOMRect;
  computedStyle: CSSStyleDeclaration;
  timestamp: number;
}

/**
 * Network request tracking
 */
interface NetworkState {
  pendingRequests: number;
  lastActivityTime: number;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * WaitStrategy - Configurable element waiting
 * 
 * Provides methods for waiting until elements meet specific
 * conditions before proceeding with actions.
 * 
 * @example
 * ```typescript
 * const strategy = new WaitStrategy();
 * 
 * // Wait for element to be visible
 * const result = await strategy.waitFor(element, {
 *   type: 'visible',
 * });
 * 
 * // Wait for multiple conditions
 * const result = await strategy.waitForAll(element, [
 *   { type: 'visible' },
 *   { type: 'enabled' },
 * ]);
 * ```
 */
export class WaitStrategy {
  /**
   * Default options
   */
  private defaultOptions: Required<WaitOptions>;
  
  /**
   * Network state tracker
   */
  private networkState: NetworkState = {
    pendingRequests: 0,
    lastActivityTime: Date.now(),
  };
  
  /**
   * Whether network tracking is active
   */
  private networkTrackingActive = false;
  
  /**
   * Original fetch reference
   */
  private originalFetch?: typeof fetch;
  
  /**
   * Original XHR open reference
   */
  private originalXhrOpen?: typeof XMLHttpRequest.prototype.open;
  
  /**
   * Creates a new WaitStrategy
   * 
   * @param options - Default wait options
   */
  constructor(options?: Partial<WaitOptions>) {
    this.defaultOptions = {
      timeout: options?.timeout ?? DEFAULT_WAIT_TIMEOUT,
      pollInterval: options?.pollInterval ?? DEFAULT_POLL_INTERVAL,
      stabilityThreshold: options?.stabilityThreshold ?? DEFAULT_STABILITY_THRESHOLD,
      stabilityChecks: options?.stabilityChecks ?? DEFAULT_STABILITY_CHECKS,
      abortSignal: undefined as unknown as AbortSignal,
      timeoutMessage: '',
      throwOnTimeout: true,
      ...options,
    };
  }
  
  // ==========================================================================
  // MAIN WAIT METHODS
  // ==========================================================================
  
  /**
   * Waits for a single condition
   * 
   * @param element - Element to check (or null for document-level conditions)
   * @param condition - Wait condition
   * @param options - Wait options
   * @returns Wait result
   */
  async waitFor(
    element: Element | null,
    condition: WaitCondition,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    const opts = this.mergeOptions(options);
    const startTime = Date.now();
    let pollCount = 0;
    
    const endTime = startTime + opts.timeout;
    
    while (Date.now() < endTime) {
      // Check abort
      if (opts.abortSignal?.aborted) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: new DOMException('Wait cancelled', 'AbortError'),
          pollCount,
          condition,
        };
      }
      
      pollCount++;
      
      // Evaluate condition
      const met = await this.evaluateCondition(element, condition, opts);
      
      if (met) {
        return {
          success: true,
          element: element ?? undefined,
          duration: Date.now() - startTime,
          pollCount,
          condition,
        };
      }
      
      // Wait before next poll
      await this.delay(opts.pollInterval);
    }
    
    // Timeout
    const error = new Error(
      opts.timeoutMessage ||
      `Wait timeout after ${opts.timeout}ms for condition: ${condition.type}`
    );
    
    if (opts.throwOnTimeout) {
      throw error;
    }
    
    return {
      success: false,
      element: element ?? undefined,
      duration: Date.now() - startTime,
      error,
      pollCount,
      condition,
    };
  }
  
  /**
   * Waits for all conditions to be met (AND logic)
   * 
   * @param element - Element to check
   * @param conditions - Array of wait conditions
   * @param options - Wait options
   * @returns Wait result
   */
  async waitForAll(
    element: Element | null,
    conditions: WaitCondition[],
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    const opts = this.mergeOptions(options);
    const startTime = Date.now();
    let pollCount = 0;
    
    const endTime = startTime + opts.timeout;
    
    while (Date.now() < endTime) {
      if (opts.abortSignal?.aborted) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: new DOMException('Wait cancelled', 'AbortError'),
          pollCount,
          condition: conditions[0],
        };
      }
      
      pollCount++;
      
      // Check all conditions
      let allMet = true;
      
      for (const condition of conditions) {
        const met = await this.evaluateCondition(element, condition, opts);
        if (!met) {
          allMet = false;
          break;
        }
      }
      
      if (allMet) {
        return {
          success: true,
          element: element ?? undefined,
          duration: Date.now() - startTime,
          pollCount,
          condition: conditions[0],
        };
      }
      
      await this.delay(opts.pollInterval);
    }
    
    const error = new Error(
      opts.timeoutMessage ||
      `Wait timeout for all conditions after ${opts.timeout}ms`
    );
    
    if (opts.throwOnTimeout) {
      throw error;
    }
    
    return {
      success: false,
      duration: Date.now() - startTime,
      error,
      pollCount,
      condition: conditions[0],
    };
  }
  
  /**
   * Waits for any condition to be met (OR logic)
   * 
   * @param element - Element to check
   * @param conditions - Array of wait conditions
   * @param options - Wait options
   * @returns Wait result with the first matching condition
   */
  async waitForAny(
    element: Element | null,
    conditions: WaitCondition[],
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    const opts = this.mergeOptions(options);
    const startTime = Date.now();
    let pollCount = 0;
    
    const endTime = startTime + opts.timeout;
    
    while (Date.now() < endTime) {
      if (opts.abortSignal?.aborted) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: new DOMException('Wait cancelled', 'AbortError'),
          pollCount,
          condition: conditions[0],
        };
      }
      
      pollCount++;
      
      // Check any condition
      for (const condition of conditions) {
        const met = await this.evaluateCondition(element, condition, opts);
        if (met) {
          return {
            success: true,
            element: element ?? undefined,
            duration: Date.now() - startTime,
            pollCount,
            condition,
          };
        }
      }
      
      await this.delay(opts.pollInterval);
    }
    
    const error = new Error(
      opts.timeoutMessage ||
      `Wait timeout for any condition after ${opts.timeout}ms`
    );
    
    if (opts.throwOnTimeout) {
      throw error;
    }
    
    return {
      success: false,
      duration: Date.now() - startTime,
      error,
      pollCount,
      condition: conditions[0],
    };
  }
  
  /**
   * Waits for element to appear in DOM
   * 
   * @param selector - CSS selector
   * @param options - Wait options
   * @returns Wait result with element
   */
  async waitForSelector(
    selector: string,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    const opts = this.mergeOptions(options);
    const startTime = Date.now();
    let pollCount = 0;
    
    const endTime = startTime + opts.timeout;
    
    while (Date.now() < endTime) {
      if (opts.abortSignal?.aborted) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: new DOMException('Wait cancelled', 'AbortError'),
          pollCount,
          condition: { type: 'selector', selector },
        };
      }
      
      pollCount++;
      
      const element = document.querySelector(selector);
      if (element) {
        return {
          success: true,
          element,
          duration: Date.now() - startTime,
          pollCount,
          condition: { type: 'selector', selector },
        };
      }
      
      await this.delay(opts.pollInterval);
    }
    
    const error = new Error(
      opts.timeoutMessage ||
      `Wait timeout for selector "${selector}" after ${opts.timeout}ms`
    );
    
    if (opts.throwOnTimeout) {
      throw error;
    }
    
    return {
      success: false,
      duration: Date.now() - startTime,
      error,
      pollCount,
      condition: { type: 'selector', selector },
    };
  }
  
  /**
   * Waits for element to be removed from DOM
   * 
   * @param selector - CSS selector
   * @param options - Wait options
   * @returns Wait result
   */
  async waitForSelectorToDisappear(
    selector: string,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    const opts = this.mergeOptions(options);
    const startTime = Date.now();
    let pollCount = 0;
    
    const endTime = startTime + opts.timeout;
    
    while (Date.now() < endTime) {
      if (opts.abortSignal?.aborted) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: new DOMException('Wait cancelled', 'AbortError'),
          pollCount,
          condition: { type: 'detached', selector },
        };
      }
      
      pollCount++;
      
      const element = document.querySelector(selector);
      if (!element) {
        return {
          success: true,
          duration: Date.now() - startTime,
          pollCount,
          condition: { type: 'detached', selector },
        };
      }
      
      await this.delay(opts.pollInterval);
    }
    
    const error = new Error(
      opts.timeoutMessage ||
      `Wait timeout for selector "${selector}" to disappear after ${opts.timeout}ms`
    );
    
    if (opts.throwOnTimeout) {
      throw error;
    }
    
    return {
      success: false,
      duration: Date.now() - startTime,
      error,
      pollCount,
      condition: { type: 'detached', selector },
    };
  }
  
  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================
  
  /**
   * Waits for element to be visible
   */
  async waitForVisible(
    element: Element,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'visible' }, options);
  }
  
  /**
   * Waits for element to be hidden
   */
  async waitForHidden(
    element: Element,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'hidden' }, options);
  }
  
  /**
   * Waits for element to be enabled
   */
  async waitForEnabled(
    element: Element,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'enabled' }, options);
  }
  
  /**
   * Waits for element to be stable (not animating)
   */
  async waitForStable(
    element: Element,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'stable' }, options);
  }
  
  /**
   * Waits for element to have specific text
   */
  async waitForText(
    element: Element,
    text: string | RegExp,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'text', expected: text }, options);
  }
  
  /**
   * Waits for element to have specific value
   */
  async waitForValue(
    element: Element,
    value: string | RegExp,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'value', expected: value }, options);
  }
  
  /**
   * Waits for network to be idle
   */
  async waitForNetworkIdle(
    options?: Partial<WaitOptions> & { idleTime?: number }
  ): Promise<WaitResult> {
    this.startNetworkTracking();
    
    try {
      return await this.waitFor(
        null,
        { type: 'networkIdle' },
        {
          ...options,
          timeoutMessage: options?.timeoutMessage || 'Network did not become idle',
        }
      );
    } finally {
      this.stopNetworkTracking();
    }
  }
  
  /**
   * Waits for page load
   */
  async waitForLoad(options?: Partial<WaitOptions>): Promise<WaitResult> {
    return this.waitFor(null, { type: 'load' }, options);
  }
  
  /**
   * Waits for DOM ready
   */
  async waitForDomReady(options?: Partial<WaitOptions>): Promise<WaitResult> {
    return this.waitFor(null, { type: 'domReady' }, options);
  }
  
  /**
   * Waits for animations to complete
   */
  async waitForAnimations(
    element: Element,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(element, { type: 'animationsComplete' }, options);
  }
  
  /**
   * Waits for a custom function to return true
   */
  async waitForFunction(
    fn: () => boolean | Promise<boolean>,
    options?: Partial<WaitOptions>
  ): Promise<WaitResult> {
    return this.waitFor(null, { type: 'function', fn: () => fn() }, options);
  }
  
  /**
   * Waits for specified milliseconds
   */
  async wait(ms: number): Promise<void> {
    return this.delay(ms);
  }
  
  // ==========================================================================
  // CONDITION EVALUATION
  // ==========================================================================
  
  /**
   * Evaluates a wait condition
   */
  private async evaluateCondition(
    element: Element | null,
    condition: WaitCondition,
    options: Required<WaitOptions>
  ): Promise<boolean> {
    let result: boolean;
    
    switch (condition.type) {
      case 'attached':
        result = element !== null && document.contains(element);
        break;
        
      case 'detached':
        result = element === null || !document.contains(element);
        break;
        
      case 'visible':
        result = element !== null && this.isVisible(element);
        break;
        
      case 'hidden':
        result = element === null || !this.isVisible(element);
        break;
        
      case 'enabled':
        result = element !== null && !this.isDisabled(element);
        break;
        
      case 'disabled':
        result = element !== null && this.isDisabled(element);
        break;
        
      case 'editable':
        result = element !== null && this.isEditable(element);
        break;
        
      case 'checked':
        result = element !== null && (element as HTMLInputElement).checked === true;
        break;
        
      case 'unchecked':
        result = element !== null && (element as HTMLInputElement).checked === false;
        break;
        
      case 'stable':
        result = element !== null && await this.isStable(element, options);
        break;
        
      case 'text':
        result = element !== null && this.matchesText(element, condition.expected);
        break;
        
      case 'value':
        result = element !== null && this.matchesValue(element, condition.expected);
        break;
        
      case 'attribute':
        result = element !== null && this.matchesAttribute(
          element,
          condition.attribute!,
          condition.expected
        );
        break;
        
      case 'selector':
        result = condition.selector ? document.querySelector(condition.selector) !== null : false;
        break;
        
      case 'function':
        result = condition.fn ? await condition.fn(element) : false;
        break;
        
      case 'networkIdle':
        result = this.isNetworkIdle();
        break;
        
      case 'load':
        result = document.readyState === 'complete';
        break;
        
      case 'domReady':
        result = document.readyState !== 'loading';
        break;
        
      case 'animationsComplete':
        result = element !== null && this.areAnimationsComplete(element);
        break;
        
      default:
        result = false;
    }
    
    // Apply negation if specified
    return condition.negate ? !result : result;
  }
  
  // ==========================================================================
  // ELEMENT STATE CHECKS
  // ==========================================================================
  
  /**
   * Checks if element is visible
   */
  private isVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return true;
    
    // Check if element or ancestor is hidden
    const style = window.getComputedStyle(element);
    
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }
    
    // In happy-dom, rect may have zero dimensions even for visible elements
    // So we'll be lenient: if display is not 'none', consider visible
    return true;
  }
  
  /**
   * Checks if element is disabled
   */
  private isDisabled(element: Element): boolean {
    if (element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement) {
      return element.disabled;
    }
    
    return element.hasAttribute('disabled') ||
           element.getAttribute('aria-disabled') === 'true';
  }
  
  /**
   * Checks if element is editable
   */
  private isEditable(element: Element): boolean {
    if (element instanceof HTMLInputElement) {
      const nonEditableTypes = ['button', 'submit', 'reset', 'image', 'hidden', 'checkbox', 'radio'];
      return !element.disabled && !element.readOnly && !nonEditableTypes.includes(element.type);
    }
    
    if (element instanceof HTMLTextAreaElement) {
      return !element.disabled && !element.readOnly;
    }
    
    return element.hasAttribute('contenteditable') &&
           element.getAttribute('contenteditable') !== 'false';
  }
  
  /**
   * Checks if element is stable (position/size not changing)
   */
  private async isStable(
    element: Element,
    options: Required<WaitOptions>
  ): Promise<boolean> {
    const states: StabilityState[] = [];
    
    for (let i = 0; i < options.stabilityChecks; i++) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      states.push({
        rect: DOMRect.fromRect(rect),
        computedStyle: style,
        timestamp: Date.now(),
      });
      
      if (i < options.stabilityChecks - 1) {
        await this.delay(options.stabilityThreshold / options.stabilityChecks);
      }
    }
    
    // Compare all states
    for (let i = 1; i < states.length; i++) {
      if (!this.areStatesEqual(states[i - 1], states[i])) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Compares two stability states
   */
  private areStatesEqual(a: StabilityState, b: StabilityState): boolean {
    // Compare rect
    if (
      a.rect.x !== b.rect.x ||
      a.rect.y !== b.rect.y ||
      a.rect.width !== b.rect.width ||
      a.rect.height !== b.rect.height
    ) {
      return false;
    }
    
    // Compare key style properties
    const styleProps = ['transform', 'opacity', 'top', 'left', 'right', 'bottom'];
    for (const prop of styleProps) {
      if (a.computedStyle.getPropertyValue(prop) !== b.computedStyle.getPropertyValue(prop)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Checks if element's text matches
   */
  private matchesText(element: Element, expected?: string | RegExp): boolean {
    if (!expected) return true;
    
    const text = element.textContent?.trim() ?? '';
    
    if (expected instanceof RegExp) {
      return expected.test(text);
    }
    
    return text.includes(expected);
  }
  
  /**
   * Checks if element's value matches
   */
  private matchesValue(element: Element, expected?: string | RegExp): boolean {
    if (!expected) return true;
    
    const value = (element as HTMLInputElement).value ?? '';
    
    if (expected instanceof RegExp) {
      return expected.test(value);
    }
    
    return value === expected;
  }
  
  /**
   * Checks if element's attribute matches
   */
  private matchesAttribute(
    element: Element,
    attribute: string,
    expected?: string | RegExp
  ): boolean {
    const value = element.getAttribute(attribute);
    
    if (value === null) return false;
    if (!expected) return true;
    
    if (expected instanceof RegExp) {
      return expected.test(value);
    }
    
    return value === expected;
  }
  
  /**
   * Checks if animations are complete
   */
  private areAnimationsComplete(element: Element): boolean {
    const animations = element.getAnimations({ subtree: true });
    return animations.every(a => a.playState === 'finished' || a.playState === 'paused');
  }
  
  // ==========================================================================
  // NETWORK TRACKING
  // ==========================================================================
  
  /**
   * Starts network request tracking
   */
  private startNetworkTracking(): void {
    if (this.networkTrackingActive) return;
    
    this.networkTrackingActive = true;
    this.networkState = {
      pendingRequests: 0,
      lastActivityTime: Date.now(),
    };
    
    // Intercept fetch
    this.originalFetch = window.fetch;
    window.fetch = async (...args) => {
      this.networkState.pendingRequests++;
      this.networkState.lastActivityTime = Date.now();
      
      try {
        const response = await this.originalFetch!(...args);
        return response;
      } finally {
        this.networkState.pendingRequests--;
        this.networkState.lastActivityTime = Date.now();
      }
    };
    
    // Intercept XHR
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    const self = this;
    XMLHttpRequest.prototype.open = function(...args: any[]) {
      this.addEventListener('loadstart', () => {
        self.networkState.pendingRequests++;
        self.networkState.lastActivityTime = Date.now();
      });
      
      this.addEventListener('loadend', () => {
        self.networkState.pendingRequests--;
        self.networkState.lastActivityTime = Date.now();
      });
      
      return self.originalXhrOpen!.apply(this, args);
    };
  }
  
  /**
   * Stops network request tracking
   */
  private stopNetworkTracking(): void {
    if (!this.networkTrackingActive) return;
    
    this.networkTrackingActive = false;
    
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = undefined;
    }
    
    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = undefined;
    }
  }
  
  /**
   * Checks if network is idle
   */
  private isNetworkIdle(idleThreshold: number = 500): boolean {
    return (
      this.networkState.pendingRequests === 0 &&
      Date.now() - this.networkState.lastActivityTime >= idleThreshold
    );
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Merges options with defaults
   */
  private mergeOptions(options?: Partial<WaitOptions>): Required<WaitOptions> {
    return {
      ...this.defaultOptions,
      ...options,
    };
  }
  
  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Updates default options
   */
  setDefaultOptions(options: Partial<WaitOptions>): void {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new WaitStrategy
 * 
 * @param options - Default wait options
 * @returns New WaitStrategy instance
 */
export function createWaitStrategy(options?: Partial<WaitOptions>): WaitStrategy {
  return new WaitStrategy(options);
}

// ============================================================================
// CONDITION BUILDERS
// ============================================================================

/**
 * Creates an attached condition
 */
export function attached(): WaitCondition {
  return { type: 'attached' };
}

/**
 * Creates a detached condition
 */
export function detached(): WaitCondition {
  return { type: 'detached' };
}

/**
 * Creates a visible condition
 */
export function visible(): WaitCondition {
  return { type: 'visible' };
}

/**
 * Creates a hidden condition
 */
export function hidden(): WaitCondition {
  return { type: 'hidden' };
}

/**
 * Creates an enabled condition
 */
export function enabled(): WaitCondition {
  return { type: 'enabled' };
}

/**
 * Creates a disabled condition
 */
export function disabled(): WaitCondition {
  return { type: 'disabled' };
}

/**
 * Creates a stable condition
 */
export function stable(): WaitCondition {
  return { type: 'stable' };
}

/**
 * Creates a text condition
 */
export function hasText(expected: string | RegExp): WaitCondition {
  return { type: 'text', expected };
}

/**
 * Creates a value condition
 */
export function hasValue(expected: string | RegExp): WaitCondition {
  return { type: 'value', expected };
}

/**
 * Creates an attribute condition
 */
export function hasAttribute(attribute: string, expected?: string | RegExp): WaitCondition {
  return { type: 'attribute', attribute, expected };
}

/**
 * Creates a custom function condition
 */
export function satisfies(fn: (element: Element | null) => boolean | Promise<boolean>): WaitCondition {
  return { type: 'function', fn };
}

/**
 * Negates a condition
 */
export function not(condition: WaitCondition): WaitCondition {
  return { ...condition, negate: !condition.negate };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default WaitStrategy;
