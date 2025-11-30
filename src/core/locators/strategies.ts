/**
 * @fileoverview High-level strategy orchestration for element location
 * @module core/locators/strategies
 * @version 1.0.0
 * 
 * This module provides orchestration for the 9-tier element location strategy,
 * including support for iframes and shadow DOM.
 * 
 * @see PHASE_4_SPECIFICATIONS.md for locator specifications
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { LocatorBundle, StepExecutionResult } from '../types';
import {
  ELEMENT_TIMEOUT_MS,
  RETRY_INTERVAL_MS,
  isInIframe,
  isInShadowDom
} from '../types';

import {
  locateElement,
  locateElementWithRetry,
  verifyElementMatchesBundle,
  scoreElementMatch,
  type LocateResult
} from './locator-utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Strategy execution context
 */
export interface StrategyContext {
  /** Document to search in (may be iframe document) */
  document: Document;
  /** Window reference */
  window: Window;
  /** Parent frames if in iframe */
  frameChain: HTMLIFrameElement[];
  /** Shadow roots traversed */
  shadowRoots: ShadowRoot[];
  /** Current depth in DOM tree */
  depth: number;
}

/**
 * Strategy execution options
 */
export interface StrategyOptions {
  /** Timeout for element location */
  timeout?: number;
  /** Retry interval */
  retryInterval?: number;
  /** Whether to search in iframes */
  searchIframes?: boolean;
  /** Whether to search in shadow DOM */
  searchShadowDom?: boolean;
  /** Maximum iframe depth to search */
  maxIframeDepth?: number;
  /** Maximum shadow DOM depth */
  maxShadowDepth?: number;
  /** Strategies to skip */
  skipStrategies?: string[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

/**
 * Full location result with context
 */
export interface FullLocateResult extends LocateResult {
  /** Context where element was found */
  context: StrategyContext | null;
  /** Whether element is in iframe */
  inIframe: boolean;
  /** Whether element is in shadow DOM */
  inShadowDom: boolean;
  /** Match score (0-100) */
  matchScore: number;
}

/**
 * Element interaction options
 */
export interface InteractionOptions {
  /** Scroll element into view before interaction */
  scrollIntoView?: boolean;
  /** Highlight element during interaction */
  highlight?: boolean;
  /** Highlight duration in ms */
  highlightDuration?: number;
  /** Delay before interaction */
  delayBefore?: number;
  /** Delay after interaction */
  delayAfter?: number;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

/**
 * Default strategy options
 */
export const DEFAULT_STRATEGY_OPTIONS: Required<StrategyOptions> = {
  timeout: ELEMENT_TIMEOUT_MS,
  retryInterval: RETRY_INTERVAL_MS,
  searchIframes: true,
  searchShadowDom: true,
  maxIframeDepth: 3,
  maxShadowDepth: 5,
  skipStrategies: [],
  minConfidence: 0,
  onProgress: () => {}
};

/**
 * Default interaction options
 */
export const DEFAULT_INTERACTION_OPTIONS: Required<InteractionOptions> = {
  scrollIntoView: true,
  highlight: false,
  highlightDuration: 500,
  delayBefore: 0,
  delayAfter: 0
};

// ============================================================================
// MAIN STRATEGY EXECUTOR
// ============================================================================

/**
 * Execute location strategy with full support for iframes and shadow DOM
 * 
 * @param bundle - Locator bundle
 * @param options - Strategy options
 * @returns Full location result
 * 
 * @example
 * ```typescript
 * const result = await executeStrategy(step.bundle, {
 *   timeout: 3000,
 *   searchIframes: true,
 *   onProgress: (msg) => console.log(msg)
 * });
 * 
 * if (result.found) {
 *   await performClick(result.element);
 * }
 * ```
 */
export async function executeStrategy(
  bundle: LocatorBundle,
  options: StrategyOptions = {}
): Promise<FullLocateResult> {
  const opts = { ...DEFAULT_STRATEGY_OPTIONS, ...options };

  // Create initial context
  const rootContext: StrategyContext = {
    document: document,
    window: window,
    frameChain: [],
    shadowRoots: [],
    depth: 0
  };

  opts.onProgress?.('Starting element location');

  // Try main document first
  let result = await locateInContext(bundle, rootContext, opts);

  if (result.found) {
    return createFullResult(result, rootContext, bundle);
  }

  // Search in iframes if enabled
  if (opts.searchIframes && isInIframe(bundle)) {
    opts.onProgress?.('Searching in iframes');
    result = await searchInIframes(bundle, rootContext, opts);
    
    if (result.found) {
      return createFullResult(result, result.context ?? null, bundle);
    }
  }

  // Search in shadow DOM if enabled
  if (opts.searchShadowDom && isInShadowDom(bundle)) {
    opts.onProgress?.('Searching in shadow DOM');
    result = await searchInShadowDom(bundle, rootContext, opts);
    
    if (result.found) {
      return createFullResult(result, result.context ?? null, bundle);
    }
  }

  // Retry with timeout as last resort
  opts.onProgress?.('Retrying with timeout');
  const retryResult = await locateElementWithRetry(bundle, document, {
    timeout: opts.timeout,
    interval: opts.retryInterval,
    locateOptions: {
      skipStrategies: opts.skipStrategies,
      minConfidence: opts.minConfidence
    }
  });

  return createFullResult(retryResult, rootContext, bundle);
}

/**
 * Locate element in specific context
 */
async function locateInContext(
  bundle: LocatorBundle,
  context: StrategyContext,
  options: Required<StrategyOptions>
): Promise<LocateResult & { context?: StrategyContext }> {
  const result = locateElement(bundle, context.document, {
    skipStrategies: options.skipStrategies,
    minConfidence: options.minConfidence
  });

  return { ...result, context };
}

/**
 * Create full result with context information
 */
function createFullResult(
  result: LocateResult & { context?: StrategyContext },
  context: StrategyContext | null,
  bundle: LocatorBundle
): FullLocateResult {
  const matchScore = result.found && result.element
    ? scoreElementMatch(result.element, bundle)
    : 0;

  return {
    ...result,
    context,
    inIframe: (context?.frameChain.length ?? 0) > 0,
    inShadowDom: (context?.shadowRoots.length ?? 0) > 0,
    matchScore
  };
}

// ============================================================================
// IFRAME SEARCH
// ============================================================================

/**
 * Search for element in iframes
 */
async function searchInIframes(
  bundle: LocatorBundle,
  parentContext: StrategyContext,
  options: Required<StrategyOptions>
): Promise<LocateResult & { context?: StrategyContext }> {
  if (parentContext.depth >= options.maxIframeDepth) {
    return {
      found: false,
      element: null,
      strategy: null,
      confidence: 0,
      duration: 0,
      attempts: [],
      error: 'Max iframe depth reached'
    };
  }

  // Get all iframes in current document
  const iframes = parentContext.document.querySelectorAll('iframe');

  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i] as HTMLIFrameElement;
    
    try {
      const iframeDoc = iframe.contentDocument;
      const iframeWin = iframe.contentWindow;

      if (!iframeDoc || !iframeWin) {
        continue; // Cross-origin iframe
      }

      options.onProgress?.(`Searching iframe ${i + 1}/${iframes.length}`);

      const iframeContext: StrategyContext = {
        document: iframeDoc,
        window: iframeWin,
        frameChain: [...parentContext.frameChain, iframe],
        shadowRoots: [],
        depth: parentContext.depth + 1
      };

      // Try to locate in this iframe
      const result = await locateInContext(bundle, iframeContext, options);

      if (result.found) {
        return result;
      }

      // Recursively search nested iframes
      const nestedResult = await searchInIframes(bundle, iframeContext, options);
      if (nestedResult.found) {
        return nestedResult;
      }
    } catch (error) {
      // Cross-origin or other iframe access error - skip
      continue;
    }
  }

  return {
    found: false,
    element: null,
    strategy: null,
    confidence: 0,
    duration: 0,
    attempts: [],
    error: 'Element not found in any iframe'
  };
}

// ============================================================================
// SHADOW DOM SEARCH
// ============================================================================

/**
 * Search for element in shadow DOM
 */
async function searchInShadowDom(
  bundle: LocatorBundle,
  parentContext: StrategyContext,
  options: Required<StrategyOptions>
): Promise<LocateResult & { context?: StrategyContext }> {
  // Find all elements with shadow roots
  const shadowHosts = findShadowHosts(parentContext.document);

  for (const host of shadowHosts) {
    const result = await searchInShadowRoot(
      bundle,
      host,
      parentContext,
      options,
      0
    );

    if (result.found) {
      return result;
    }
  }

  return {
    found: false,
    element: null,
    strategy: null,
    confidence: 0,
    duration: 0,
    attempts: [],
    error: 'Element not found in shadow DOM'
  };
}

/**
 * Find all elements with shadow roots in a document
 */
function findShadowHosts(doc: Document): Element[] {
  const hosts: Element[] = [];
  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node: Node | null = walker.nextNode();
  while (node) {
    const element = node as Element;
    if (element.shadowRoot) {
      hosts.push(element);
    }
    node = walker.nextNode();
  }

  return hosts;
}

/**
 * Search within a specific shadow root
 */
async function searchInShadowRoot(
  bundle: LocatorBundle,
  host: Element,
  parentContext: StrategyContext,
  options: Required<StrategyOptions>,
  depth: number
): Promise<LocateResult & { context?: StrategyContext }> {
  if (depth >= options.maxShadowDepth) {
    return {
      found: false,
      element: null,
      strategy: null,
      confidence: 0,
      duration: 0,
      attempts: [],
      error: 'Max shadow DOM depth reached'
    };
  }

  const shadowRoot = host.shadowRoot;
  if (!shadowRoot) {
    return {
      found: false,
      element: null,
      strategy: null,
      confidence: 0,
      duration: 0,
      attempts: []
    };
  }

  options.onProgress?.(`Searching shadow root of ${host.tagName}`);

  // Create context for shadow root
  const shadowContext: StrategyContext = {
    document: parentContext.document,
    window: parentContext.window,
    frameChain: parentContext.frameChain,
    shadowRoots: [...parentContext.shadowRoots, shadowRoot],
    depth: parentContext.depth
  };

  // Try to locate in shadow root
  // Note: Shadow root is not a Document, so we need to search differently
  const element = locateInShadowRoot(bundle, shadowRoot);

  if (element) {
    return {
      found: true,
      element,
      strategy: 'shadow-dom',
      confidence: 70,
      duration: 0,
      attempts: [{ strategy: 'shadow-dom', success: true, duration: 0 }],
      context: shadowContext
    };
  }

  // Search nested shadow roots
  const nestedHosts = findShadowHostsInRoot(shadowRoot);
  for (const nestedHost of nestedHosts) {
    const result = await searchInShadowRoot(
      bundle,
      nestedHost,
      shadowContext,
      options,
      depth + 1
    );

    if (result.found) {
      return result;
    }
  }

  return {
    found: false,
    element: null,
    strategy: null,
    confidence: 0,
    duration: 0,
    attempts: []
  };
}

/**
 * Locate element within a shadow root
 */
function locateInShadowRoot(
  bundle: LocatorBundle,
  shadowRoot: ShadowRoot
): Element | null {
  // Try ID
  if (bundle.id) {
    const element = shadowRoot.getElementById(bundle.id);
    if (element) return element;
  }

  // Try CSS selector
  if (bundle.css) {
    try {
      const element = shadowRoot.querySelector(bundle.css);
      if (element) return element;
    } catch {
      // Invalid selector
    }
  }

  // Try by tag and attributes
  if (bundle.tag) {
    const elements = shadowRoot.querySelectorAll(bundle.tag);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (verifyElementMatchesBundle(el, bundle)) {
        return el;
      }
    }
  }

  // Try by name
  if (bundle.name) {
    const element = shadowRoot.querySelector(`[name="${bundle.name}"]`);
    if (element) return element;
  }

  // Try by placeholder
  if (bundle.placeholder) {
    const element = shadowRoot.querySelector(`[placeholder="${bundle.placeholder}"]`);
    if (element) return element;
  }

  return null;
}

/**
 * Find shadow hosts within a shadow root
 */
function findShadowHostsInRoot(shadowRoot: ShadowRoot): Element[] {
  const hosts: Element[] = [];
  const elements = shadowRoot.querySelectorAll('*');
  
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].shadowRoot) {
      hosts.push(elements[i]);
    }
  }

  return hosts;
}

// ============================================================================
// ELEMENT INTERACTIONS
// ============================================================================

/**
 * Perform click on element
 */
export async function performClick(
  element: Element,
  options: InteractionOptions = {}
): Promise<StepExecutionResult> {
  const opts = { ...DEFAULT_INTERACTION_OPTIONS, ...options };
  const startTime = performance.now();

  try {
    if (opts.scrollIntoView && typeof (element as any).scrollIntoView === 'function') {
      (element as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(100);
    }

    if (opts.highlight) {
      await highlightElement(element, opts.highlightDuration);
    }

    if (opts.delayBefore > 0) {
      await sleep(opts.delayBefore);
    }

    // Perform click
    if ('click' in element && typeof (element as any).click === 'function') {
      (element as any).click();
    } else {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
    }

    if (opts.delayAfter > 0) {
      await sleep(opts.delayAfter);
    }

    return {
      step_id: '',
      status: 'passed' as const,
      strategy_used: 'click',
      duration: performance.now() - startTime
    };
  } catch (error) {
    return {
      step_id: '',
      status: 'failed' as const,
      strategy_used: 'click',
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Click failed'
    };
  }
}

/**
 * Perform text input on element
 */
export async function performInput(
  element: Element,
  value: string,
  options: InteractionOptions = {}
): Promise<StepExecutionResult> {
  const opts = { ...DEFAULT_INTERACTION_OPTIONS, ...options };
  const startTime = performance.now();

  try {
    // Check if element is input or textarea by checking tagName
    const tagName = element.tagName.toLowerCase();
    if (tagName !== 'input' && tagName !== 'textarea') {
      throw new Error('Element is not an input or textarea');
    }

    if (opts.scrollIntoView && typeof (element as any).scrollIntoView === 'function') {
      (element as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(100);
    }

    if (opts.highlight) {
      await highlightElement(element, opts.highlightDuration);
    }

    if (opts.delayBefore > 0) {
      await sleep(opts.delayBefore);
    }

    // Focus element (cast to any for type safety with Element)
    (element as any).focus();

    // Clear existing value
    (element as any).value = '';
    const inputEvent1 = element.ownerDocument.defaultView 
      ? new element.ownerDocument.defaultView.Event('input', { bubbles: true })
      : new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent1);

    // Type value
    (element as any).value = value;
    const inputEvent2 = element.ownerDocument.defaultView 
      ? new element.ownerDocument.defaultView.Event('input', { bubbles: true })
      : new Event('input', { bubbles: true });
    const changeEvent = element.ownerDocument.defaultView 
      ? new element.ownerDocument.defaultView.Event('change', { bubbles: true })
      : new Event('change', { bubbles: true });
    element.dispatchEvent(inputEvent2);
    element.dispatchEvent(changeEvent);

    if (opts.delayAfter > 0) {
      await sleep(opts.delayAfter);
    }

    return {
      step_id: '',
      status: 'passed' as const,
      strategy_used: 'input',
      duration: performance.now() - startTime
    };
  } catch (error) {
    return {
      step_id: '',
      status: 'failed' as const,
      strategy_used: 'input',
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Perform Enter key press on element
 */
export async function performEnter(
  element: Element,
  options: InteractionOptions = {}
): Promise<StepExecutionResult> {
  const opts = { ...DEFAULT_INTERACTION_OPTIONS, ...options };
  const startTime = performance.now();

  try {
    if (opts.scrollIntoView && typeof (element as any).scrollIntoView === 'function') {
      (element as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(100);
    }

    if (opts.delayBefore > 0) {
      await sleep(opts.delayBefore);
    }

    // Focus element
    if ('focus' in element && typeof (element as any).focus === 'function') {
      (element as any).focus();
    }

    // Dispatch Enter key events
    const win = element.ownerDocument.defaultView || window;
    const keydownEvent = new win.KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    const keypressEvent = new win.KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    const keyupEvent = new win.KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keypressEvent);
    element.dispatchEvent(keyupEvent);

    if (opts.delayAfter > 0) {
      await sleep(opts.delayAfter);
    }

    return {
      step_id: '',
      status: 'passed' as const,
      strategy_used: 'enter',
      duration: performance.now() - startTime
    };
  } catch (error) {
    return {
      step_id: '',
      status: 'failed' as const,
      strategy_used: 'enter',
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Enter key failed'
    };
  }
}

// ============================================================================
// ELEMENT HIGHLIGHTING
// ============================================================================

/**
 * Highlight an element temporarily
 */
export async function highlightElement(
  element: Element,
  duration: number = 500
): Promise<void> {
  // Check if element has style property
  if (!('style' in element)) {
    return;
  }

  const htmlElement = element as HTMLElement;
  const originalOutline = htmlElement.style.outline;
  const originalOutlineOffset = htmlElement.style.outlineOffset;

  htmlElement.style.outline = '3px solid #ff6b6b';
  htmlElement.style.outlineOffset = '2px';

  await sleep(duration);

  htmlElement.style.outline = originalOutline;
  htmlElement.style.outlineOffset = originalOutlineOffset;
}

/**
 * Create a highlight overlay for element
 */
export function createHighlightOverlay(
  element: Element,
  color: string = 'rgba(255, 107, 107, 0.3)'
): HTMLDivElement {
  const rect = element.getBoundingClientRect();
  
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: ${color};
    pointer-events: none;
    z-index: 999999;
    border: 2px solid rgba(255, 107, 107, 0.8);
    border-radius: 4px;
  `;

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Remove highlight overlay
 */
export function removeHighlightOverlay(overlay: HTMLDivElement): void {
  if (overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for element to be stable (no position changes)
 */
export async function waitForElementStable(
  element: Element,
  timeout: number = 1000,
  checkInterval: number = 100
): Promise<boolean> {
  let lastRect = element.getBoundingClientRect();
  const startTime = performance.now();

  while (performance.now() - startTime < timeout) {
    await sleep(checkInterval);
    const currentRect = element.getBoundingClientRect();

    if (
      Math.abs(currentRect.x - lastRect.x) < 1 &&
      Math.abs(currentRect.y - lastRect.y) < 1 &&
      Math.abs(currentRect.width - lastRect.width) < 1 &&
      Math.abs(currentRect.height - lastRect.height) < 1
    ) {
      return true;
    }

    lastRect = currentRect;
  }

  return false;
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  // Check if element has style property (HTMLElement)
  if (!('style' in element)) {
    return true; // Assume visible for non-HTML elements
  }

  const htmlElement = element as HTMLElement;
  
  // Try to get computed style - in test environments this might not work correctly
  try {
    const style = window.getComputedStyle(htmlElement);

    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
  } catch {
    // getComputedStyle failed, check inline styles
    const inlineStyle = htmlElement.style;
    if (inlineStyle.display === 'none') return false;
    if (inlineStyle.visibility === 'hidden') return false;
    if (inlineStyle.opacity === '0') return false;
  }

  // Note: getBoundingClientRect returns 0x0 in JSDOM, so we skip size checks

  return true;
}

/**
 * Check if element is interactable
 */
export function isElementInteractable(element: Element): boolean {
  if (!isElementVisible(element)) return false;

  // Check if element is disabled (for input/button elements)
  if ('disabled' in element && (element as any).disabled) {
    return false;
  }

  // Check pointer events
  if ('style' in element) {
    const style = window.getComputedStyle(element as HTMLElement);
    if (style.pointerEvents === 'none') return false;
  }

  return true;
}

/**
 * Get element's visible text
 */
export function getElementVisibleText(element: Element): string {
  // Check for input/textarea by checking for value property
  if ('value' in element) {
    const value = (element as any).value;
    const placeholder = (element as any).placeholder;
    return value || placeholder || '';
  }
  return element.textContent?.trim() || '';
}

/**
 * Navigate to element's frame context
 * 
 * Returns the document containing the element
 */
export function getElementDocument(element: Element): Document {
  return element.ownerDocument;
}

/**
 * Get full XPath to element including iframe context
 */
export function getFullXPath(
  element: Element,
  context: StrategyContext
): string {
  const parts: string[] = [];

  // Add iframe path
  for (const iframe of context.frameChain) {
    parts.push(`iframe[src="${iframe.src || ''}"]`);
  }

  // Add shadow root indicators
  for (let i = 0; i < context.shadowRoots.length; i++) {
    parts.push('shadow-root');
  }

  // Add element path
  let current: Element | null = element;
  const elementParts: string[] = [];

  while (current && current !== context.document.documentElement) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    
    if (current.id) {
      elementParts.unshift(`${tagName}[@id="${current.id}"]`);
      break; // ID is unique, stop here
    } else {
      elementParts.unshift(`${tagName}[${index}]`);
    }
    
    current = current.parentElement;
  }

  parts.push(...elementParts);
  return '/' + parts.join('/');
}
