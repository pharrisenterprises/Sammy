/**
 * ReplayMode - Step Execution Handler
 * @module contentScript/ReplayMode
 * @version 1.0.0
 * 
 * Handles replaying recorded steps with element finding and action execution.
 */

import type { ContentScriptService } from './ContentScriptService';
import type { Step, LocatorBundle } from '@/core/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Step execution result
 */
export interface StepResult {
  success: boolean;
  stepIndex?: number;
  duration?: number;
  error?: string;
}

/**
 * Element find options
 */
export interface FindOptions {
  timeout?: number;
  retryInterval?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIMEOUT = 2000;
const DEFAULT_RETRY_INTERVAL = 150;

// ============================================================================
// REPLAY MODE
// ============================================================================

/**
 * Replay mode handler
 */
export class ReplayMode {
  private service: ContentScriptService;
  private isActive: boolean = false;
  private shouldStop: boolean = false;
  private currentStepIndex: number = 0;

  constructor(service: ContentScriptService) {
    this.service = service;
  }

  /**
   * Start replay mode
   */
  start(steps?: unknown[]): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.shouldStop = false;
    this.currentStepIndex = 0;
    this.service.log('Replay started');
  }

  /**
   * Stop replay mode
   */
  stop(): void {
    this.shouldStop = true;
    this.isActive = false;
    this.service.log('Replay stopped');
  }

  /**
   * Execute a single step
   */
  async executeStep(stepData: unknown): Promise<boolean> {
    const step = stepData as Step;
    const startTime = Date.now();

    try {
      this.service.showNotification({
        label: step.label || step.event,
        value: step.value,
        status: 'loading',
      });

      // Find element
      const element = await this.findElement(step.bundle, step.path);
      
      if (!element) {
        throw new Error('Element not found');
      }

      // Execute action
      await this.executeAction(element, step);

      const duration = Date.now() - startTime;

      this.service.showNotification({
        label: step.label || step.event,
        status: 'success',
      });

      this.service.log(`Step executed in ${duration}ms:`, step.label);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.service.showNotification({
        label: step.label || step.event,
        value: errorMessage,
        status: 'error',
      });

      console.error('Step execution failed:', errorMessage);
      return false;
    }
  }

  /**
   * Find element using bundle strategies
   */
  private async findElement(
    bundle: LocatorBundle | undefined,
    xpath: string,
    options: FindOptions = {}
  ): Promise<HTMLElement | null> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const retryInterval = options.retryInterval || DEFAULT_RETRY_INTERVAL;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.shouldStop) return null;

      // Try strategies in order
      const element = 
        this.findById(bundle) ||
        this.findByName(bundle) ||
        this.findByXPath(xpath) ||
        this.findByAriaLabel(bundle) ||
        this.findByPlaceholder(bundle) ||
        this.findByDataAttributes(bundle) ||
        this.findByCssSelector(bundle) ||
        this.findByFuzzyText(bundle);

      if (element) {
        // Ensure element is visible and interactable
        await this.ensureVisible(element);
        return element;
      }

      // Wait before retry
      await this.wait(retryInterval);
    }

    return null;
  }

  /**
   * Find by ID
   */
  private findById(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.id) return null;
    return document.getElementById(bundle.id);
  }

  /**
   * Find by name
   */
  private findByName(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.name) return null;
    return document.querySelector(`[name="${bundle.name}"]`) as HTMLElement;
  }

  /**
   * Find by XPath
   */
  private findByXPath(xpath?: string): HTMLElement | null {
    if (!xpath) return null;
    
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue as HTMLElement;
    } catch {
      return null;
    }
  }

  /**
   * Find by aria-label
   */
  private findByAriaLabel(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.aria) return null;
    return document.querySelector(`[aria-label="${bundle.aria}"]`) as HTMLElement;
  }

  /**
   * Find by placeholder
   */
  private findByPlaceholder(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.placeholder) return null;
    return document.querySelector(`[placeholder="${bundle.placeholder}"]`) as HTMLElement;
  }

  /**
   * Find by data attributes
   */
  private findByDataAttributes(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.dataAttrs || Object.keys(bundle.dataAttrs).length === 0) return null;

    const [key, value] = Object.entries(bundle.dataAttrs)[0];
    return document.querySelector(`[${key}="${value}"]`) as HTMLElement;
  }

  /**
   * Find by CSS selector
   */
  private findByCssSelector(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.css) return null;
    
    try {
      return document.querySelector(bundle.css) as HTMLElement;
    } catch {
      return null;
    }
  }

  /**
   * Find by fuzzy text match
   */
  private findByFuzzyText(bundle?: LocatorBundle): HTMLElement | null {
    if (!bundle?.text || bundle.text.length < 3) return null;

    const searchText = bundle.text.toLowerCase();
    const candidates = document.querySelectorAll(bundle.tag || '*');

    for (const candidate of Array.from(candidates)) {
      const text = candidate.textContent?.toLowerCase() || '';
      if (text.includes(searchText)) {
        return candidate as HTMLElement;
      }
    }

    return null;
  }

  /**
   * Execute action on element
   */
  private async executeAction(element: HTMLElement, step: Step): Promise<void> {
    switch (step.event) {
      case 'click':
        await this.simulateClick(element);
        break;

      case 'input':
        await this.simulateInput(element as HTMLInputElement, step.value);
        break;

      case 'enter':
        await this.simulateEnter(element);
        break;

      case 'open':
        // Navigation handled separately
        break;

      default:
        console.warn('Unknown action:', step.event);
    }
  }

  /**
   * Simulate click
   */
  private async simulateClick(element: HTMLElement): Promise<void> {
    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.wait(100);

    // Focus
    element.focus();

    // Dispatch mouse events
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    };

    element.dispatchEvent(new MouseEvent('mouseover', eventInit));
    element.dispatchEvent(new MouseEvent('mousedown', eventInit));
    element.dispatchEvent(new MouseEvent('mouseup', eventInit));
    element.dispatchEvent(new MouseEvent('click', eventInit));
  }

  /**
   * Simulate input
   */
  private async simulateInput(element: HTMLInputElement, value: string): Promise<void> {
    // Focus
    element.focus();
    await this.wait(50);

    // Clear existing value
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // Set value using property descriptor (React-safe)
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    );
    
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    // Dispatch events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Simulate enter key
   */
  private async simulateEnter(element: HTMLElement): Promise<void> {
    element.focus();

    const eventInit: KeyboardEventInit = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    };

    element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    element.dispatchEvent(new KeyboardEvent('keyup', eventInit));

    // If it's a form, submit
    const form = element.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  /**
   * Ensure element is visible
   */
  private async ensureVisible(element: HTMLElement): Promise<void> {
    const style = window.getComputedStyle(element);

    // Check if hidden
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      // Temporarily show
      const originalDisplay = element.style.display;
      const originalVisibility = element.style.visibility;
      const originalOpacity = element.style.opacity;

      element.style.display = 'block';
      element.style.visibility = 'visible';
      element.style.opacity = '1';

      // Restore after action (with delay)
      setTimeout(() => {
        element.style.display = originalDisplay;
        element.style.visibility = originalVisibility;
        element.style.opacity = originalOpacity;
      }, 500);
    }
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ReplayMode;
