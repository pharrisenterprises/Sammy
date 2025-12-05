/**
 * Page Replay - Special Widget Replay Script
 * @module contentScript/page-replay
 * @version 1.0.0
 * 
 * Runs in PAGE CONTEXT (main world), not content script context.
 * Handles replay actions for special widgets like Google Autocomplete
 * that require access to closed shadow roots.
 * 
 * Receives commands from content script via window.postMessage.
 * 
 * @example
 * // Send replay command from content script:
 * window.postMessage({
 *   type: 'REPLAY_AUTOCOMPLETE',
 *   actions: [
 *     { type: 'AUTOCOMPLETE_INPUT', value: 'New York' },
 *     { type: 'AUTOCOMPLETE_SELECTION', text: 'New York, NY, USA' }
 *   ]
 * }, '*');
 */

// ============================================================================
// IIFE TO PREVENT GLOBAL POLLUTION
// ============================================================================

(function PageReplay() {
  'use strict';

  // Prevent multiple executions
  if ((window as ExtendedWindow).__sammyReplayLoaded) {
    console.log('[Replay] Already loaded, skipping');
    return;
  }
  (window as ExtendedWindow).__sammyReplayLoaded = true;

  console.log('[Replay] 🎬 Page replay script initializing...');

  // ============================================================================
  // TYPES
  // ============================================================================

  interface ExtendedWindow extends Window {
    __sammyReplayLoaded?: boolean;
  }

  interface ExtendedElement extends Element {
    __realShadowRoot?: ShadowRoot;
    __autocompleteInput?: HTMLInputElement;
  }

  interface ReplayAction {
    type: 'AUTOCOMPLETE_INPUT' | 'AUTOCOMPLETE_SELECTION' | 'SHADOW_INPUT' | 'SHADOW_CLICK';
    value?: string;
    text?: string;
    xpath?: string;
    selector?: string;
    hostXPath?: string;
  }

  interface ReplayMessage {
    type: 'REPLAY_AUTOCOMPLETE' | 'REPLAY_SHADOW_ACTION' | 'REPLAY_PING';
    actions?: ReplayAction[];
    action?: ReplayAction;
  }

  // ============================================================================
  // MESSAGE LISTENER
  // ============================================================================

  /**
   * Listen for replay commands from content script
   */
  window.addEventListener('message', async (event) => {
    // Only accept messages from same window
    if (event.source !== window) return;
    
    const data = event.data as ReplayMessage;
    if (!data || !data.type) return;

    // Handle different message types
    switch (data.type) {
      case 'REPLAY_PING':
        // Respond to health check
        window.postMessage({ type: 'REPLAY_PONG' }, '*');
        break;

      case 'REPLAY_AUTOCOMPLETE':
        if (data.actions) {
          await replayAutocompleteActions(data.actions);
        }
        break;

      case 'REPLAY_SHADOW_ACTION':
        if (data.action) {
          await replayShadowAction(data.action);
        }
        break;
    }
  });

  // ============================================================================
  // AUTOCOMPLETE REPLAY
  // ============================================================================

  /**
   * Replay autocomplete actions sequence
   */
  async function replayAutocompleteActions(actions: ReplayAction[]): Promise<void> {
    console.log('[Replay] 🎯 Replaying autocomplete actions:', actions.length);

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'AUTOCOMPLETE_INPUT':
            await replayAutocompleteInput(action);
            break;

          case 'AUTOCOMPLETE_SELECTION':
            await replayAutocompleteSelection(action);
            break;

          default:
            console.warn('[Replay] Unknown action type:', action.type);
        }

        // Small delay between actions
        await wait(100);
      } catch (error) {
        console.error('[Replay] Action failed:', action, error);
        sendResult(false, String(error));
      }
    }

    sendResult(true);
  }

  /**
   * Replay autocomplete input action
   */
  async function replayAutocompleteInput(action: ReplayAction): Promise<void> {
    const { value, xpath, hostXPath } = action;
    if (!value) return;

    console.log('[Replay] 📝 Inputting value:', value);

    // Find the autocomplete host
    const host = findAutocompleteHost(xpath, hostXPath);
    if (!host) {
      throw new Error('Autocomplete host not found');
    }

    // Get the input element
    const input = getAutocompleteInput(host);
    if (!input) {
      throw new Error('Autocomplete input not found');
    }

    // Focus the input
    input.focus();
    await wait(50);

    // Clear existing value
    input.value = '';
    dispatchInputEvent(input);

    // Set new value using React-safe method
    setInputValue(input, value);
    dispatchInputEvent(input);

    // Wait for dropdown to appear
    await wait(300);
  }

  /**
   * Replay autocomplete selection action
   */
  async function replayAutocompleteSelection(action: ReplayAction): Promise<void> {
    const { text, xpath, hostXPath } = action;
    if (!text) return;

    console.log('[Replay] 🖱️ Selecting option:', text);

    // Find the autocomplete host
    const host = findAutocompleteHost(xpath, hostXPath);
    if (!host) {
      throw new Error('Autocomplete host not found');
    }

    // Get the shadow root
    const shadow = getShadowRoot(host);
    if (!shadow) {
      throw new Error('Shadow root not accessible');
    }

    // Find the matching option
    const option = findOptionByText(shadow, text);
    if (!option) {
      throw new Error(`Option not found: ${text}`);
    }

    // Simulate click
    simulateClick(option);
  }

  // ============================================================================
  // SHADOW ACTION REPLAY
  // ============================================================================

  /**
   * Replay generic shadow DOM action
   */
  async function replayShadowAction(action: ReplayAction): Promise<void> {
    const { type, value, text, xpath, selector, hostXPath } = action;

    console.log('[Replay] 🎭 Replaying shadow action:', type);

    // Find the shadow host
    let host: ExtendedElement | null = null;
    
    if (hostXPath) {
      host = evaluateXPath(hostXPath) as ExtendedElement;
    } else if (xpath) {
      const element = evaluateXPath(xpath);
      host = element?.closest('[__realShadowRoot]') as ExtendedElement;
    }

    if (!host) {
      throw new Error('Shadow host not found');
    }

    const shadow = getShadowRoot(host);
    if (!shadow) {
      throw new Error('Shadow root not accessible');
    }

    // Find target element in shadow
    let target: Element | null = null;
    
    if (selector) {
      target = shadow.querySelector(selector);
    } else if (xpath) {
      // Try to evaluate XPath within shadow
      target = evaluateXPathInShadow(shadow, xpath);
    }

    if (!target) {
      throw new Error('Target element not found in shadow');
    }

    // Execute action
    switch (type) {
      case 'SHADOW_INPUT':
        if (value !== undefined) {
          setInputValue(target as HTMLInputElement, value);
          dispatchInputEvent(target as HTMLInputElement);
        }
        break;

      case 'SHADOW_CLICK':
        simulateClick(target as HTMLElement);
        break;
    }

    sendResult(true);
  }

  // ============================================================================
  // ELEMENT FINDING
  // ============================================================================

  /**
   * Find autocomplete host element
   */
  function findAutocompleteHost(
    xpath?: string,
    hostXPath?: string
  ): ExtendedElement | null {
    // Try hostXPath first
    if (hostXPath) {
      const host = evaluateXPath(hostXPath) as ExtendedElement;
      if (host) return host;
    }

    // Try xpath
    if (xpath) {
      const element = evaluateXPath(xpath) as ExtendedElement;
      if (element) {
        // Check if this is the host or find parent host
        if (element.__realShadowRoot || element.__autocompleteInput) {
          return element;
        }
        // Look for parent with shadow root
        let parent = element.parentElement as ExtendedElement;
        while (parent) {
          if (parent.__realShadowRoot || parent.__autocompleteInput) {
            return parent;
          }
          parent = parent.parentElement as ExtendedElement;
        }
      }
    }

    // Fallback: find known autocomplete components
    const selectors = [
      'gmp-place-autocomplete',
      'gmp-place-picker',
      '[__realShadowRoot]',
      '[__autocompleteInput]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector) as ExtendedElement;
      if (element) return element;
    }

    return null;
  }

  /**
   * Get autocomplete input from host
   */
  function getAutocompleteInput(host: ExtendedElement): HTMLInputElement | null {
    // Check for stored reference
    if (host.__autocompleteInput) {
      return host.__autocompleteInput;
    }

    // Try shadow root
    const shadow = getShadowRoot(host);
    if (shadow) {
      const input = shadow.querySelector<HTMLInputElement>('input');
      if (input) return input;
    }

    // Try direct child
    const directInput = host.querySelector<HTMLInputElement>('input');
    if (directInput) return directInput;

    return null;
  }

  /**
   * Get shadow root (exposed or open)
   */
  function getShadowRoot(element: ExtendedElement): ShadowRoot | null {
    // Check for exposed closed shadow root
    if (element.__realShadowRoot) {
      return element.__realShadowRoot;
    }

    // Check for open shadow root
    if (element.shadowRoot) {
      return element.shadowRoot;
    }

    return null;
  }

  /**
   * Find option by text content
   */
  function findOptionByText(shadow: ShadowRoot, text: string): HTMLElement | null {
    const normalizedText = text.trim().toLowerCase();

    // Try different option selectors
    const selectors = [
      'li[role="option"]',
      '[data-option]',
      '.pac-item',
      '[role="listbox"] > *',
      '.autocomplete-item',
      '.dropdown-item',
    ];

    for (const selector of selectors) {
      const options = shadow.querySelectorAll<HTMLElement>(selector);
      
      for (const option of Array.from(options)) {
        const optionText = option.textContent?.trim().toLowerCase() || '';
        
        // Exact match or contains
        if (optionText === normalizedText || optionText.includes(normalizedText)) {
          return option;
        }
      }
    }

    return null;
  }

  // ============================================================================
  // XPATH UTILITIES
  // ============================================================================

  /**
   * Evaluate XPath expression
   */
  function evaluateXPath(xpath: string): Element | null {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue as Element;
    } catch (error) {
      console.error('[Replay] XPath evaluation failed:', xpath, error);
      return null;
    }
  }

  /**
   * Evaluate XPath within shadow root
   */
  function evaluateXPathInShadow(shadow: ShadowRoot, xpath: string): Element | null {
    try {
      // Simple XPath evaluation within shadow - limited support
      // For complex XPaths, use querySelector instead
      const result = document.evaluate(
        xpath,
        shadow as unknown as Node,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue as Element;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  /**
   * Set input value using React-safe method
   */
  function setInputValue(input: HTMLInputElement, value: string): void {
    // Get the native value setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    // Use appropriate setter
    if (input.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
      nativeTextareaValueSetter.call(input, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      // Fallback
      input.value = value;
    }
  }

  /**
   * Dispatch input event
   */
  function dispatchInputEvent(element: HTMLInputElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  // ============================================================================
  // CLICK SIMULATION
  // ============================================================================

  /**
   * Simulate human-like click
   */
  function simulateClick(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
    };

    // Mouse event sequence
    element.dispatchEvent(new MouseEvent('mouseover', eventInit));
    element.dispatchEvent(new MouseEvent('mouseenter', eventInit));
    element.dispatchEvent(new MouseEvent('mousedown', eventInit));
    element.dispatchEvent(new MouseEvent('mouseup', eventInit));
    element.dispatchEvent(new MouseEvent('click', eventInit));
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Wait helper
   */
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send result back to content script
   */
  function sendResult(success: boolean, error?: string): void {
    window.postMessage({
      type: 'REPLAY_RESULT',
      success,
      error,
    }, '*');
  }

  console.log('[Replay] ✅ Page replay script ready');

})();
