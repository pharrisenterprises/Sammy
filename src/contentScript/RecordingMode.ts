/**
 * RecordingMode - Event Recording Handler
 * @module contentScript/RecordingMode
 * @version 1.0.0
 * 
 * Handles recording user interactions and generating step data.
 */

import type { ContentScriptService } from './ContentScriptService';
import type { LocatorBundle, Step } from '@/core/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recorded event data
 */
export interface RecordedEvent {
  eventType: 'click' | 'input' | 'enter' | 'open';
  xpath: string;
  bundle: LocatorBundle;
  value: string;
  label: string;
  page: string;
  x: number;
  y: number;
}

// ============================================================================
// RECORDING MODE
// ============================================================================

/**
 * Recording mode handler
 */
export class RecordingMode {
  private service: ContentScriptService;
  private isActive: boolean = false;
  private boundHandlers: {
    click: (e: MouseEvent) => void;
    input: (e: Event) => void;
    keydown: (e: KeyboardEvent) => void;
  };

  constructor(service: ContentScriptService) {
    this.service = service;
    
    // Bind handlers
    this.boundHandlers = {
      click: this.handleClick.bind(this),
      input: this.handleInput.bind(this),
      keydown: this.handleKeyDown.bind(this),
    };
  }

  /**
   * Start recording
   */
  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.attachListeners(document);
    this.service.log('Recording started');
  }

  /**
   * Stop recording
   */
  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.detachListeners(document);
    this.service.log('Recording stopped');
  }

  /**
   * Attach event listeners
   */
  attachListeners(doc: Document): void {
    doc.addEventListener('click', this.boundHandlers.click, true);
    doc.addEventListener('input', this.boundHandlers.input, true);
    doc.addEventListener('keydown', this.boundHandlers.keydown, true);
  }

  /**
   * Detach event listeners
   */
  detachListeners(doc: Document): void {
    doc.removeEventListener('click', this.boundHandlers.click, true);
    doc.removeEventListener('input', this.boundHandlers.input, true);
    doc.removeEventListener('keydown', this.boundHandlers.keydown, true);
  }

  /**
   * Handle click event
   */
  private handleClick(event: MouseEvent): void {
    if (!this.isActive || !event.isTrusted) return;

    const target = event.target as HTMLElement;
    if (!target) return;

    // Skip certain elements
    if (this.shouldSkipElement(target)) return;

    const bundle = this.createBundle(target);
    const label = this.detectLabel(target);
    const xpath = this.generateXPath(target);

    const eventData: RecordedEvent = {
      eventType: 'click',
      xpath,
      bundle,
      value: '',
      label,
      page: window.location.href,
      x: event.clientX,
      y: event.clientY,
    };

    this.service.sendLogEvent(eventData);
    this.service.log('Recorded click:', label);
  }

  /**
   * Handle input event
   */
  private handleInput(event: Event): void {
    if (!this.isActive || !event.isTrusted) return;

    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;

    const bundle = this.createBundle(target);
    const label = this.detectLabel(target);
    const xpath = this.generateXPath(target);
    const value = target.value || '';

    const eventData: RecordedEvent = {
      eventType: 'input',
      xpath,
      bundle,
      value,
      label,
      page: window.location.href,
      x: 0,
      y: 0,
    };

    this.service.sendLogEvent(eventData);
    this.service.log('Recorded input:', label, value);
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isActive || !event.isTrusted) return;
    if (event.key !== 'Enter') return;

    const target = event.target as HTMLElement;
    if (!target) return;

    const bundle = this.createBundle(target);
    const label = this.detectLabel(target);
    const xpath = this.generateXPath(target);

    const eventData: RecordedEvent = {
      eventType: 'enter',
      xpath,
      bundle,
      value: '',
      label,
      page: window.location.href,
      x: 0,
      y: 0,
    };

    this.service.sendLogEvent(eventData);
    this.service.log('Recorded enter:', label);
  }

  /**
   * Handle autocomplete input from page context
   */
  handleAutocompleteInput(data: { value?: string; xpath?: string; label?: string }): void {
    const eventData: RecordedEvent = {
      eventType: 'input',
      xpath: data.xpath || '',
      bundle: {} as LocatorBundle,
      value: data.value || '',
      label: data.label || '',
      page: window.location.href,
      x: 0,
      y: 0,
    };

    this.service.sendLogEvent(eventData);
  }

  /**
   * Handle autocomplete selection from page context
   */
  handleAutocompleteSelection(data: { text?: string; xpath?: string }): void {
    const eventData: RecordedEvent = {
      eventType: 'click',
      xpath: data.xpath || '',
      bundle: {} as LocatorBundle,
      value: data.text || '',
      label: data.text || '',
      page: window.location.href,
      x: 0,
      y: 0,
    };

    this.service.sendLogEvent(eventData);
  }

  /**
   * Check if element should be skipped
   */
  private shouldSkipElement(element: HTMLElement): boolean {
    // Skip our notification overlay
    if (element.id === 'ext-test-notification') return true;
    if (element.closest('#ext-test-notification')) return true;

    // Skip script and style elements
    const tag = element.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) return true;

    return false;
  }

  /**
   * Create locator bundle for element
   */
  private createBundle(element: HTMLElement): LocatorBundle {
    const rect = element.getBoundingClientRect();

    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: element.getAttribute('name') || null,
      placeholder: element.getAttribute('placeholder') || null,
      aria: element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || null,
      dataAttrs: this.getDataAttributes(element),
      text: element.textContent?.trim().slice(0, 100) || '',
      css: this.getCssSelector(element),
      xpath: this.generateXPath(element),
      classes: Array.from(element.classList),
      attrs: this.getAttributes(element),
      role: element.getAttribute('role') || null,
      title: element.getAttribute('title') || null,
      href: element.getAttribute('href') || null,
      src: element.getAttribute('src') || null,
      bounding: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      pageUrl: window.location.href,
    };
  }

  /**
   * Get data attributes
   */
  private getDataAttributes(element: HTMLElement): Record<string, string> {
    const dataAttrs: Record<string, string> = {};
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-')) {
        dataAttrs[attr.name] = attr.value;
      }
    });
    return dataAttrs;
  }

  /**
   * Get all attributes
   */
  private getAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach((attr) => {
      attrs[attr.name] = attr.value;
    });
    return attrs;
  }

  /**
   * Generate CSS selector
   */
  private getCssSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        parts.unshift(selector);
        break;
      }

      if (current.className) {
        const classes = Array.from(current.classList).slice(0, 2).join('.');
        if (classes) selector += `.${classes}`;
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * Generate XPath
   */
  private generateXPath(element: HTMLElement): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = current.tagName.toLowerCase();
      const part = index > 1 ? `${tagName}[${index}]` : tagName;
      parts.unshift(part);

      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  /**
   * Detect label for element
   */
  private detectLabel(element: HTMLElement): string {
    // 1. Aria label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // 2. Aria labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement?.textContent) {
        return labelElement.textContent.trim();
      }
    }

    // 3. Associated label (for form inputs)
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label?.textContent) {
        return label.textContent.trim();
      }
    }

    // 4. Parent label
    const parentLabel = element.closest('label');
    if (parentLabel?.textContent) {
      return parentLabel.textContent.trim();
    }

    // 5. Placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    // 6. Title
    const title = element.getAttribute('title');
    if (title) return title;

    // 7. Name attribute
    const name = element.getAttribute('name');
    if (name) return name;

    // 8. Text content (for buttons, links)
    if (element.textContent?.trim()) {
      return element.textContent.trim().slice(0, 50);
    }

    // 9. Fallback to tag name
    return element.tagName.toLowerCase();
  }
}

export default RecordingMode;
