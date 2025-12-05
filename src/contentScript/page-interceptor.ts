/**
 * Page Interceptor - Shadow DOM Interception Script
 * @module contentScript/page-interceptor
 * @version 1.0.0
 * 
 * Runs in PAGE CONTEXT (main world), not content script context.
 * Intercepts closed shadow roots and exposes them for automation.
 * 
 * Must be injected BEFORE shadow DOM components initialize.
 * 
 * @example
 * // Injected via content script:
 * const script = document.createElement('script');
 * script.src = chrome.runtime.getURL('js/interceptor.js');
 * document.head.appendChild(script);
 */

// ============================================================================
// IIFE TO PREVENT GLOBAL POLLUTION
// ============================================================================

(function PageInterceptor() {
  'use strict';

  // Prevent multiple executions
  if ((window as ExtendedWindow).__sammyInterceptorLoaded) {
    console.log('[Interceptor] Already loaded, skipping');
    return;
  }
  (window as ExtendedWindow).__sammyInterceptorLoaded = true;

  console.log('[Interceptor] 🔐 Shadow DOM interceptor initializing...');

  // ============================================================================
  // TYPES
  // ============================================================================

  interface ExtendedWindow extends Window {
    __sammyInterceptorLoaded?: boolean;
  }

  interface ExtendedElement extends Element {
    __realShadowRoot?: ShadowRoot;
    __autocompleteInput?: HTMLInputElement;
    __shadowMode?: 'open' | 'closed';
  }

  interface AutocompleteMessage {
    type: 'AUTOCOMPLETE_INPUT' | 'AUTOCOMPLETE_SELECTION' | 'SHADOW_ROOT_EXPOSED';
    value?: string;
    text?: string;
    xpath?: string;
    label?: string;
    tagName?: string;
  }

  // ============================================================================
  // SHADOW ROOT INTERCEPTION
  // ============================================================================

  /**
   * Original attachShadow method
   */
  const originalAttachShadow = Element.prototype.attachShadow;

  /**
   * Monkey-patch attachShadow to intercept closed shadow roots
   */
  Element.prototype.attachShadow = function(
    this: ExtendedElement,
    init: ShadowRootInit
  ): ShadowRoot {
    // Call original method
    const shadowRoot = originalAttachShadow.call(this, init);

    // Store shadow mode
    this.__shadowMode = init.mode;

    // If closed, expose for automation
    if (init.mode === 'closed') {
      console.log('[Interceptor] 🔓 Intercepted closed shadow root:', this.tagName);
      
      // Store reference for later access
      this.__realShadowRoot = shadowRoot;

      // Notify content script
      sendMessage({
        type: 'SHADOW_ROOT_EXPOSED',
        tagName: this.tagName,
      });

      // Special handling for known components
      handleSpecialComponent(this, shadowRoot);
    }

    return shadowRoot;
  };

  // ============================================================================
  // SPECIAL COMPONENT HANDLERS
  // ============================================================================

  /**
   * Handle special components that need extra setup
   */
  function handleSpecialComponent(host: ExtendedElement, shadow: ShadowRoot): void {
    const tagName = host.tagName.toUpperCase();

    switch (tagName) {
      case 'GMP-PLACE-AUTOCOMPLETE':
      case 'GMP-PLACE-PICKER':
        setupGoogleAutocomplete(host, shadow);
        break;

      case 'SL-INPUT':
      case 'SL-SELECT':
        // Shoelace components
        setupShoelaceComponent(host, shadow);
        break;

      default:
        // Generic shadow DOM monitoring
        setupGenericShadowMonitoring(host, shadow);
    }
  }

  // ============================================================================
  // GOOGLE AUTOCOMPLETE HANDLING
  // ============================================================================

  /**
   * Set up monitoring for Google Place Autocomplete
   */
  function setupGoogleAutocomplete(host: ExtendedElement, shadow: ShadowRoot): void {
    console.log('[Interceptor] 📍 Setting up Google Autocomplete:', host.tagName);

    // Find input element (may be lazy loaded)
    const input = shadow.querySelector<HTMLInputElement>('input');

    if (input) {
      setupAutocompleteListeners(host, input, shadow);
    } else {
      // Wait for input to appear
      waitForElement(shadow, 'input', (foundInput) => {
        setupAutocompleteListeners(host, foundInput as HTMLInputElement, shadow);
      });
    }
  }

  /**
   * Set up event listeners for autocomplete input
   */
  function setupAutocompleteListeners(
    host: ExtendedElement,
    input: HTMLInputElement,
    shadow: ShadowRoot
  ): void {
    console.log('[Interceptor] 🎯 Found autocomplete input, attaching listeners');

    // Store reference for replay
    host.__autocompleteInput = input;

    // Monitor input events
    input.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      sendMessage({
        type: 'AUTOCOMPLETE_INPUT',
        value: target.value,
        xpath: getSimpleXPath(host as HTMLElement),
        label: input.name || input.placeholder || 'autocomplete',
      });
    });

    // Monitor focus events (for tracking active state)
    input.addEventListener('focus', () => {
      console.log('[Interceptor] Autocomplete focused');
    });

    // Monitor selection from dropdown
    shadow.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const option = target.closest('li[role="option"], [data-option], .pac-item');

      if (option) {
        const text = option.textContent?.trim() || '';
        console.log('[Interceptor] 📍 Autocomplete selection:', text);
        
        sendMessage({
          type: 'AUTOCOMPLETE_SELECTION',
          text,
          xpath: getSimpleXPath(host as HTMLElement),
        });
      }
    }, true);

    // Monitor for programmatic value changes
    const originalValueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    );

    if (originalValueDescriptor?.set) {
      Object.defineProperty(input, 'value', {
        get: function() {
          return originalValueDescriptor.get?.call(this);
        },
        set: function(newValue) {
          originalValueDescriptor.set?.call(this, newValue);
          // Dispatch event for any programmatic changes
        },
        configurable: true,
      });
    }
  }

  // ============================================================================
  // SHOELACE COMPONENT HANDLING
  // ============================================================================

  /**
   * Set up monitoring for Shoelace components
   */
  function setupShoelaceComponent(host: ExtendedElement, shadow: ShadowRoot): void {
    const input = shadow.querySelector<HTMLInputElement>('input, select, textarea');
    
    if (input) {
      input.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        sendMessage({
          type: 'AUTOCOMPLETE_INPUT',
          value: target.value,
          xpath: getSimpleXPath(host as HTMLElement),
          label: host.getAttribute('label') || host.getAttribute('name') || '',
        });
      });
    }
  }

  // ============================================================================
  // GENERIC SHADOW MONITORING
  // ============================================================================

  /**
   * Set up generic monitoring for unknown shadow DOM components
   */
  function setupGenericShadowMonitoring(host: ExtendedElement, shadow: ShadowRoot): void {
    // Monitor for any input elements added later
    waitForElement(shadow, 'input, select, textarea', (element) => {
      const input = element as HTMLInputElement;
      
      input.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        sendMessage({
          type: 'AUTOCOMPLETE_INPUT',
          value: target.value,
          xpath: getSimpleXPath(host as HTMLElement),
          label: input.name || input.placeholder || host.tagName.toLowerCase(),
        });
      });
    });
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Wait for an element to appear in shadow DOM
   */
  function waitForElement(
    root: ShadowRoot | Document,
    selector: string,
    callback: (element: Element) => void,
    timeout: number = 5000
  ): void {
    // Check if already exists
    const existing = root.querySelector(selector);
    if (existing) {
      callback(existing);
      return;
    }

    // Watch for additions
    const observer = new MutationObserver((mutations, obs) => {
      const element = root.querySelector(selector);
      if (element) {
        obs.disconnect();
        callback(element);
      }
    });

    observer.observe(root as Node, {
      childList: true,
      subtree: true,
    });

    // Timeout cleanup
    setTimeout(() => {
      observer.disconnect();
    }, timeout);
  }

  /**
   * Generate simple XPath for element
   */
  function getSimpleXPath(element: HTMLElement): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = current.tagName.toLowerCase();
      parts.unshift(index > 1 ? `${tagName}[${index}]` : tagName);
      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  /**
   * Send message to content script via postMessage
   */
  function sendMessage(message: AutocompleteMessage): void {
    window.postMessage(message, '*');
  }

  // ============================================================================
  // EXISTING SHADOW ROOTS
  // ============================================================================

  /**
   * Try to find and expose existing shadow roots
   * (for components that initialized before this script loaded)
   */
  function scanExistingShadowRoots(): void {
    const elements = document.querySelectorAll('*');
    
    elements.forEach((element) => {
      const el = element as ExtendedElement;
      
      // Check for open shadow roots
      if (el.shadowRoot) {
        console.log('[Interceptor] Found existing open shadow root:', el.tagName);
        handleSpecialComponent(el, el.shadowRoot);
      }
    });
  }

  // Scan after a short delay (for late-initializing components)
  setTimeout(scanExistingShadowRoots, 100);
  setTimeout(scanExistingShadowRoots, 1000);

  console.log('[Interceptor] ✅ Shadow DOM interceptor ready');

})();
