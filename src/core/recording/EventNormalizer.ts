/**
 * EventNormalizer - Cross-Browser Event Normalization
 * @module core/recording/EventNormalizer
 * @version 1.0.0
 * 
 * Normalizes captured DOM events into a consistent format across browsers.
 * Handles:
 * - Cross-browser event property differences
 * - Framework-specific event handling (React, Angular, Vue)
 * - Special element normalization (contenteditable, Select2)
 * - Event coalescing and deduplication
 * - Target resolution through shadow DOM
 * 
 * @see recording-engine_breakdown.md for context
 * @see EventCapture for raw event processing
 */

import type { CapturedEventData, ActionType, EventCoordinates } from './EventCapture';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Normalized event data with consistent structure
 */
export interface NormalizedEvent {
  /** Unique event ID */
  id: string;
  
  /** Normalized action type */
  action: ActionType;
  
  /** Original DOM event type */
  originalEventType: string;
  
  /** Target element (resolved through shadow DOM if needed) */
  target: Element;
  
  /** Effective target (may differ from target for delegation) */
  effectiveTarget: Element;
  
  /** Normalized value */
  value: string;
  
  /** Whether event originated from user interaction */
  isUserInitiated: boolean;
  
  /** Normalized coordinates */
  coordinates: NormalizedCoordinates | null;
  
  /** Event timestamp */
  timestamp: number;
  
  /** Browser/environment info */
  environment: EnvironmentInfo;
  
  /** Framework detection results */
  framework: FrameworkInfo;
  
  /** Element classification */
  elementInfo: ElementInfo;
  
  /** Related events (for coalescing) */
  relatedEvents: string[];
}

/**
 * Normalized coordinate system
 */
export interface NormalizedCoordinates {
  /** X relative to viewport */
  viewportX: number;
  
  /** Y relative to viewport */
  viewportY: number;
  
  /** X relative to document */
  documentX: number;
  
  /** Y relative to document */
  documentY: number;
  
  /** X relative to element */
  elementX: number;
  
  /** Y relative to element */
  elementY: number;
  
  /** Element's bounding rect at time of event */
  elementRect: DOMRect | null;
}

/**
 * Browser/environment information
 */
export interface EnvironmentInfo {
  /** Browser name (chrome, firefox, safari, edge) */
  browser: BrowserType;
  
  /** Browser version */
  browserVersion: string;
  
  /** Operating system */
  platform: PlatformType;
  
  /** Whether in iframe context */
  isIframe: boolean;
  
  /** Iframe depth (0 for main document) */
  iframeDepth: number;
  
  /** Whether in shadow DOM context */
  isInShadowDOM: boolean;
  
  /** Current page URL */
  pageUrl: string;
}

/**
 * Detected framework information
 */
export interface FrameworkInfo {
  /** Detected framework */
  name: FrameworkType;
  
  /** Framework version if detectable */
  version: string | null;
  
  /** Whether element is a framework component */
  isFrameworkComponent: boolean;
  
  /** Component name if detectable */
  componentName: string | null;
  
  /** Whether using controlled inputs (React) */
  hasControlledInput: boolean;
}

/**
 * Classified element information
 */
export interface ElementInfo {
  /** Element tag name (normalized to lowercase) */
  tagName: string;
  
  /** Element type classification */
  type: ElementType;
  
  /** Input subtype if applicable */
  inputType: InputType | null;
  
  /** Whether element is editable */
  isEditable: boolean;
  
  /** Whether element is focusable */
  isFocusable: boolean;
  
  /** Whether element is visible */
  isVisible: boolean;
  
  /** Whether element is enabled */
  isEnabled: boolean;
  
  /** Whether element is a custom component */
  isCustomElement: boolean;
  
  /** Custom element tag name */
  customElementName: string | null;
  
  /** Role attribute value */
  role: string | null;
  
  /** ARIA attributes */
  ariaAttributes: Record<string, string>;
}

/**
 * Browser types
 */
export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'unknown';

/**
 * Platform types
 */
export type PlatformType = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';

/**
 * Framework types
 */
export type FrameworkType = 'react' | 'angular' | 'vue' | 'svelte' | 'jquery' | 'vanilla' | 'unknown';

/**
 * Element type classification
 */
export type ElementType = 
  | 'button'
  | 'link'
  | 'text-input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file-input'
  | 'date-input'
  | 'range-input'
  | 'color-input'
  | 'contenteditable'
  | 'custom-input'
  | 'container'
  | 'image'
  | 'media'
  | 'form'
  | 'table'
  | 'list'
  | 'navigation'
  | 'unknown';

/**
 * Input subtypes
 */
export type InputType = 
  | 'text'
  | 'password'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'month'
  | 'week'
  | 'color'
  | 'file'
  | 'range'
  | 'checkbox'
  | 'radio'
  | 'submit'
  | 'reset'
  | 'button'
  | 'hidden';

/**
 * Normalizer configuration
 */
export interface EventNormalizerConfig {
  /** Detect and handle framework-specific behaviors */
  detectFrameworks: boolean;
  
  /** Resolve targets through shadow DOM */
  resolveShadowDOM: boolean;
  
  /** Coalesce related events */
  coalesceEvents: boolean;
  
  /** Time window for event coalescing (ms) */
  coalesceWindowMs: number;
  
  /** Include element visibility checks */
  checkVisibility: boolean;
  
  /** Normalize coordinates to element-relative */
  normalizeCoordinates: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default normalizer configuration
 */
export const DEFAULT_NORMALIZER_CONFIG: EventNormalizerConfig = {
  detectFrameworks: true,
  resolveShadowDOM: true,
  coalesceEvents: true,
  coalesceWindowMs: 100,
  checkVisibility: true,
  normalizeCoordinates: true,
};

// ============================================================================
// EVENT NORMALIZER CLASS
// ============================================================================

/**
 * Normalizes DOM events for consistent cross-browser recording
 * 
 * @example
 * ```typescript
 * const normalizer = new EventNormalizer();
 * 
 * const captured = eventCapture.processEvent(domEvent);
 * if (captured) {
 *   const normalized = normalizer.normalize(captured);
 *   console.log('Normalized:', normalized.action, normalized.value);
 * }
 * ```
 */
export class EventNormalizer {
  private config: EventNormalizerConfig;
  private eventIdCounter: number;
  private recentEvents: Map<string, NormalizedEvent>;
  private environmentInfo: EnvironmentInfo | null;
  
  /**
   * Create a new EventNormalizer
   */
  constructor(config?: Partial<EventNormalizerConfig>) {
    this.config = { ...DEFAULT_NORMALIZER_CONFIG, ...config };
    this.eventIdCounter = 0;
    this.recentEvents = new Map();
    this.environmentInfo = null;
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EventNormalizerConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): EventNormalizerConfig {
    return { ...this.config };
  }
  
  // ==========================================================================
  // NORMALIZATION
  // ==========================================================================
  
  /**
   * Normalize a captured event
   * 
   * @param captured - Captured event data from EventCapture
   * @returns Normalized event with consistent structure
   */
  normalize(captured: CapturedEventData): NormalizedEvent {
    const id = this.generateEventId();
    
    // Resolve effective target
    const effectiveTarget = this.resolveEffectiveTarget(captured);
    
    // Detect environment (cached)
    const environment = this.getEnvironmentInfo();
    
    // Detect framework
    const framework = this.config.detectFrameworks
      ? this.detectFramework(effectiveTarget)
      : this.getDefaultFrameworkInfo();
    
    // Classify element
    const elementInfo = this.classifyElement(effectiveTarget);
    
    // Normalize coordinates
    const coordinates = captured.coordinates && this.config.normalizeCoordinates
      ? this.normalizeCoordinates(captured.coordinates, effectiveTarget)
      : null;
    
    // Normalize value
    const value = this.normalizeValue(captured.value, elementInfo);
    
    // Build normalized event
    const normalized: NormalizedEvent = {
      id,
      action: captured.actionType,
      originalEventType: captured.eventType,
      target: captured.target,
      effectiveTarget,
      value,
      isUserInitiated: captured.isTrusted,
      coordinates,
      timestamp: captured.timestamp,
      environment,
      framework,
      elementInfo,
      relatedEvents: [],
    };
    
    // Check for event coalescing
    if (this.config.coalesceEvents) {
      this.coalesceWithRecent(normalized);
    }
    
    // Store for future coalescing
    this.storeRecentEvent(normalized);
    
    return normalized;
  }
  
  /**
   * Batch normalize multiple events
   */
  normalizeBatch(events: CapturedEventData[]): NormalizedEvent[] {
    return events.map(e => this.normalize(e));
  }
  
  // ==========================================================================
  // TARGET RESOLUTION
  // ==========================================================================
  
  /**
   * Resolve the effective target element
   */
  private resolveEffectiveTarget(captured: CapturedEventData): Element {
    let target = captured.target;
    
    // Resolve through shadow DOM if configured
    if (this.config.resolveShadowDOM && captured.metadata.composedPath.length > 0) {
      // Get the deepest element in the composed path
      target = captured.metadata.composedPath[0] || target;
    }
    
    // Handle special elements
    target = this.handleSpecialElements(target);
    
    return target;
  }
  
  /**
   * Handle special elements (Select2, custom components, etc.)
   */
  private handleSpecialElements(target: Element): Element {
    // Check for Select2
    if (this.isSelect2Element(target)) {
      const originalSelect = this.findSelect2Original(target);
      if (originalSelect) {
        return originalSelect;
      }
    }
    
    // Check for custom dropdown/autocomplete components
    if (this.isCustomDropdownItem(target)) {
      const trigger = this.findDropdownTrigger(target);
      if (trigger) {
        return trigger;
      }
    }
    
    // Check for label clicked (should target the input)
    if (target.tagName.toLowerCase() === 'label') {
      const forId = target.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input) {
          return input;
        }
      }
      // Check for nested input
      const nestedInput = target.querySelector('input, select, textarea');
      if (nestedInput) {
        return nestedInput;
      }
    }
    
    return target;
  }
  
  /**
   * Check if element is part of Select2 component
   */
  private isSelect2Element(element: Element): boolean {
    return Boolean(
      element.closest('.select2-container') ||
      element.classList.contains('select2-selection') ||
      element.classList.contains('select2-results__option')
    );
  }
  
  /**
   * Find original select element for Select2
   */
  private findSelect2Original(element: Element): HTMLSelectElement | null {
    const container = element.closest('.select2-container');
    if (!container) return null;
    
    // Check data attribute
    const selectId = container.getAttribute('data-select2-id');
    if (selectId) {
      const select = document.querySelector(`select[data-select2-id="${selectId}"]`);
      if (select instanceof HTMLSelectElement) {
        return select;
      }
    }
    
    // Check previous sibling
    const sibling = container.previousElementSibling;
    if (sibling instanceof HTMLSelectElement) {
      return sibling;
    }
    
    return null;
  }
  
  /**
   * Check if element is a custom dropdown item
   */
  private isCustomDropdownItem(element: Element): boolean {
    const role = element.getAttribute('role');
    return role === 'option' || role === 'menuitem' || role === 'listbox';
  }
  
  /**
   * Find the trigger element for a dropdown
   */
  private findDropdownTrigger(element: Element): Element | null {
    // Look for aria-controls reference
    const listbox = element.closest('[role="listbox"]');
    if (listbox) {
      const id = listbox.id;
      if (id) {
        const trigger = document.querySelector(`[aria-controls="${id}"]`);
        if (trigger) {
          return trigger;
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // ENVIRONMENT DETECTION
  // ==========================================================================
  
  /**
   * Get environment information (cached)
   */
  private getEnvironmentInfo(): EnvironmentInfo {
    if (this.environmentInfo) {
      return this.environmentInfo;
    }
    
    this.environmentInfo = {
      browser: this.detectBrowser(),
      browserVersion: this.detectBrowserVersion(),
      platform: this.detectPlatform(),
      isIframe: window !== window.top,
      iframeDepth: this.calculateIframeDepth(),
      isInShadowDOM: false, // Set per-event
      pageUrl: window.location.href,
    };
    
    return this.environmentInfo;
  }
  
  /**
   * Detect browser type
   */
  private detectBrowser(): BrowserType {
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('opr/') || ua.includes('opera')) return 'opera';
    if (ua.includes('chrome')) return 'chrome';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('firefox')) return 'firefox';
    
    return 'unknown';
  }
  
  /**
   * Detect browser version
   */
  private detectBrowserVersion(): string {
    const ua = navigator.userAgent;
    
    // Chrome
    const chromeMatch = ua.match(/Chrome\/(\d+\.\d+)/);
    if (chromeMatch) return chromeMatch[1];
    
    // Firefox
    const firefoxMatch = ua.match(/Firefox\/(\d+\.\d+)/);
    if (firefoxMatch) return firefoxMatch[1];
    
    // Safari
    const safariMatch = ua.match(/Version\/(\d+\.\d+)/);
    if (safariMatch) return safariMatch[1];
    
    // Edge
    const edgeMatch = ua.match(/Edg\/(\d+\.\d+)/);
    if (edgeMatch) return edgeMatch[1];
    
    return 'unknown';
  }
  
  /**
   * Detect platform
   */
  private detectPlatform(): PlatformType {
    const platform = navigator.platform?.toLowerCase() || '';
    const ua = navigator.userAgent.toLowerCase();
    
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    
    return 'unknown';
  }
  
  /**
   * Calculate iframe nesting depth
   */
  private calculateIframeDepth(): number {
    let depth = 0;
    let win: Window | null = window;
    
    try {
      while (win && win !== win.parent) {
        depth++;
        win = win.parent;
      }
    } catch {
      // Cross-origin - can't determine exact depth
    }
    
    return depth;
  }
  
  // ==========================================================================
  // FRAMEWORK DETECTION
  // ==========================================================================
  
  /**
   * Detect JavaScript framework
   */
  private detectFramework(element: Element): FrameworkInfo {
    const info: FrameworkInfo = {
      name: 'vanilla',
      version: null,
      isFrameworkComponent: false,
      componentName: null,
      hasControlledInput: false,
    };
    
    // Check for React
    if (this.isReactElement(element)) {
      info.name = 'react';
      info.isFrameworkComponent = true;
      info.componentName = this.getReactComponentName(element);
      info.hasControlledInput = this.isReactControlledInput(element);
      info.version = this.getReactVersion();
    }
    // Check for Angular
    else if (this.isAngularElement(element)) {
      info.name = 'angular';
      info.isFrameworkComponent = true;
      info.componentName = this.getAngularComponentName(element);
      info.version = this.getAngularVersion();
    }
    // Check for Vue
    else if (this.isVueElement(element)) {
      info.name = 'vue';
      info.isFrameworkComponent = true;
      info.componentName = this.getVueComponentName(element);
      info.version = this.getVueVersion();
    }
    // Check for Svelte
    else if (this.isSvelteElement(element)) {
      info.name = 'svelte';
      info.isFrameworkComponent = true;
    }
    // Check for jQuery
    else if (this.hasJQuery()) {
      info.name = 'jquery';
    }
    
    return info;
  }
  
  /**
   * Check if element is a React element
   */
  private isReactElement(element: Element): boolean {
    // Check for React fiber
    const keys = Object.keys(element);
    return keys.some(key => 
      key.startsWith('__reactFiber$') || 
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactProps$')
    );
  }
  
  /**
   * Get React component name
   */
  private getReactComponentName(element: Element): string | null {
    const keys = Object.keys(element);
    const fiberKey = keys.find(key => key.startsWith('__reactFiber$'));
    
    if (fiberKey) {
      try {
        const fiber = (element as any)[fiberKey];
        if (fiber?.type?.name) {
          return fiber.type.name;
        }
        if (fiber?.type?.displayName) {
          return fiber.type.displayName;
        }
      } catch {
        // Ignore errors accessing fiber
      }
    }
    
    return null;
  }
  
  /**
   * Check if React input is controlled
   */
  private isReactControlledInput(element: Element): boolean {
    if (!(element instanceof HTMLInputElement)) {
      return false;
    }
    
    const keys = Object.keys(element);
    const propsKey = keys.find(key => key.startsWith('__reactProps$'));
    
    if (propsKey) {
      try {
        const props = (element as any)[propsKey];
        return props?.value !== undefined || props?.checked !== undefined;
      } catch {
        // Ignore errors
      }
    }
    
    return false;
  }
  
  /**
   * Get React version
   */
  private getReactVersion(): string | null {
    try {
      const react = (window as any).React;
      return react?.version || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Check if element is an Angular element
   */
  private isAngularElement(element: Element): boolean {
    return element.hasAttribute('ng-version') ||
           element.hasAttribute('_ngcontent') ||
           Boolean(element.className.match(/ng-[a-z]/)) ||
           Boolean((element as any).__ngContext__);
  }
  
  /**
   * Get Angular component name
   */
  private getAngularComponentName(element: Element): string | null {
    const tagName = element.tagName.toLowerCase();
    if (tagName.includes('-')) {
      return tagName;
    }
    return null;
  }
  
  /**
   * Get Angular version
   */
  private getAngularVersion(): string | null {
    const versionAttr = document.body?.getAttribute('ng-version');
    return versionAttr || null;
  }
  
  /**
   * Check if element is a Vue element
   */
  private isVueElement(element: Element): boolean {
    return Boolean((element as any).__vue__) ||
           Boolean((element as any).__vueParentComponent) ||
           Boolean((element as any)._vnode);
  }
  
  /**
   * Get Vue component name
   */
  private getVueComponentName(element: Element): string | null {
    try {
      const vue = (element as any).__vue__;
      if (vue?.$options?.name) {
        return vue.$options.name;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }
  
  /**
   * Get Vue version
   */
  private getVueVersion(): string | null {
    try {
      const vue = (window as any).Vue;
      return vue?.version || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Check if element is a Svelte element
   */
  private isSvelteElement(element: Element): boolean {
    const keys = Object.keys(element);
    return keys.some(key => key.startsWith('__svelte'));
  }
  
  /**
   * Check if jQuery is present
   */
  private hasJQuery(): boolean {
    return Boolean((window as any).jQuery || (window as any).$);
  }
  
  /**
   * Get default framework info
   */
  private getDefaultFrameworkInfo(): FrameworkInfo {
    return {
      name: 'unknown',
      version: null,
      isFrameworkComponent: false,
      componentName: null,
      hasControlledInput: false,
    };
  }
  
  // ==========================================================================
  // ELEMENT CLASSIFICATION
  // ==========================================================================
  
  /**
   * Classify an element
   */
  private classifyElement(element: Element): ElementInfo {
    const tagName = element.tagName.toLowerCase();
    
    return {
      tagName,
      type: this.determineElementType(element),
      inputType: this.determineInputType(element),
      isEditable: this.isEditable(element),
      isFocusable: this.isFocusable(element),
      isVisible: this.config.checkVisibility ? this.isVisible(element) : true,
      isEnabled: this.isEnabled(element),
      isCustomElement: tagName.includes('-'),
      customElementName: tagName.includes('-') ? tagName : null,
      role: element.getAttribute('role'),
      ariaAttributes: this.extractAriaAttributes(element),
    };
  }
  
  /**
   * Determine element type
   */
  private determineElementType(element: Element): ElementType {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    
    // Check by role first
    if (role === 'button') return 'button';
    if (role === 'link') return 'link';
    if (role === 'textbox') return 'text-input';
    if (role === 'checkbox') return 'checkbox';
    if (role === 'radio') return 'radio';
    if (role === 'listbox' || role === 'combobox') return 'select';
    
    // Check by tag
    switch (tagName) {
      case 'button':
        return 'button';
      case 'a':
        return 'link';
      case 'input':
        return this.classifyInputElement(element as HTMLInputElement);
      case 'textarea':
        return 'textarea';
      case 'select':
        return 'select';
      case 'img':
        return 'image';
      case 'video':
      case 'audio':
        return 'media';
      case 'form':
        return 'form';
      case 'table':
        return 'table';
      case 'ul':
      case 'ol':
        return 'list';
      case 'nav':
        return 'navigation';
      default:
        if (element.hasAttribute('contenteditable')) {
          return 'contenteditable';
        }
        return 'container';
    }
  }
  
  /**
   * Classify input element
   */
  private classifyInputElement(input: HTMLInputElement): ElementType {
    switch (input.type) {
      case 'text':
      case 'password':
      case 'email':
      case 'tel':
      case 'url':
      case 'search':
      case 'number':
        return 'text-input';
      case 'checkbox':
        return 'checkbox';
      case 'radio':
        return 'radio';
      case 'file':
        return 'file-input';
      case 'date':
      case 'time':
      case 'datetime-local':
      case 'month':
      case 'week':
        return 'date-input';
      case 'range':
        return 'range-input';
      case 'color':
        return 'color-input';
      case 'submit':
      case 'reset':
      case 'button':
        return 'button';
      default:
        return 'text-input';
    }
  }
  
  /**
   * Determine input type
   */
  private determineInputType(element: Element): InputType | null {
    if (element instanceof HTMLInputElement) {
      return element.type as InputType;
    }
    return null;
  }
  
  /**
   * Check if element is editable
   */
  private isEditable(element: Element): boolean {
    if (element instanceof HTMLInputElement) {
      const nonEditable = ['button', 'submit', 'reset', 'image', 'hidden', 'checkbox', 'radio'];
      return !nonEditable.includes(element.type) && !element.readOnly;
    }
    if (element instanceof HTMLTextAreaElement) {
      return !element.readOnly;
    }
    if (element instanceof HTMLSelectElement) {
      return !element.disabled;
    }
    return element.hasAttribute('contenteditable');
  }
  
  /**
   * Check if element is focusable
   */
  private isFocusable(element: Element): boolean {
    if (element instanceof HTMLElement) {
      // Check tabindex
      const tabindex = element.getAttribute('tabindex');
      if (tabindex !== null && parseInt(tabindex) >= 0) {
        return true;
      }
      
      // Naturally focusable elements
      const focusableTags = ['input', 'select', 'textarea', 'button', 'a'];
      if (focusableTags.includes(element.tagName.toLowerCase())) {
        return true;
      }
      
      // Contenteditable
      if (element.hasAttribute('contenteditable')) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check if element is visible
   */
  private isVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) {
      return true;
    }
    
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    
    return true;
  }
  
  /**
   * Check if element is enabled
   */
  private isEnabled(element: Element): boolean {
    if (element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLButtonElement) {
      return !element.disabled;
    }
    return !element.hasAttribute('disabled');
  }
  
  /**
   * Extract ARIA attributes
   */
  private extractAriaAttributes(element: Element): Record<string, string> {
    const aria: Record<string, string> = {};
    
    for (const attr of element.attributes) {
      if (attr.name.startsWith('aria-')) {
        aria[attr.name] = attr.value;
      }
    }
    
    return aria;
  }
  
  // ==========================================================================
  // COORDINATE NORMALIZATION
  // ==========================================================================
  
  /**
   * Normalize coordinates
   */
  private normalizeCoordinates(
    coords: EventCoordinates,
    element: Element
  ): NormalizedCoordinates {
    let elementRect: DOMRect | null = null;
    let elementX = coords.offsetX;
    let elementY = coords.offsetY;
    
    try {
      elementRect = element.getBoundingClientRect();
      // Recalculate element-relative coordinates
      elementX = coords.clientX - elementRect.left;
      elementY = coords.clientY - elementRect.top;
    } catch {
      // Element may not be in DOM
    }
    
    return {
      viewportX: coords.clientX,
      viewportY: coords.clientY,
      documentX: coords.pageX,
      documentY: coords.pageY,
      elementX,
      elementY,
      elementRect,
    };
  }
  
  // ==========================================================================
  // VALUE NORMALIZATION
  // ==========================================================================
  
  /**
   * Normalize value
   */
  private normalizeValue(
    value: string | null,
    elementInfo: ElementInfo
  ): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Trim whitespace for text inputs
    if (elementInfo.type === 'text-input' || elementInfo.type === 'textarea') {
      // Don't trim - preserve intentional whitespace
      return value;
    }
    
    // Boolean string for checkboxes
    if (elementInfo.type === 'checkbox') {
      return value === 'true' || value === 'on' ? 'true' : 'false';
    }
    
    return value;
  }
  
  // ==========================================================================
  // EVENT COALESCING
  // ==========================================================================
  
  /**
   * Coalesce with recent events
   */
  private coalesceWithRecent(event: NormalizedEvent): void {
    const key = this.getCoalesceKey(event);
    const recent = this.recentEvents.get(key);
    
    if (recent && event.timestamp - recent.timestamp < this.config.coalesceWindowMs) {
      // Link events
      recent.relatedEvents.push(event.id);
      event.relatedEvents.push(recent.id);
    }
  }
  
  /**
   * Generate coalesce key for event
   */
  private getCoalesceKey(event: NormalizedEvent): string {
    const target = event.effectiveTarget;
    const id = target.id || '';
    const className = target.className || '';
    return `${event.action}:${event.elementInfo.tagName}:${id}:${className}`;
  }
  
  /**
   * Store event for future coalescing
   */
  private storeRecentEvent(event: NormalizedEvent): void {
    const key = this.getCoalesceKey(event);
    this.recentEvents.set(key, event);
    
    // Cleanup old events
    const now = Date.now();
    for (const [k, e] of this.recentEvents) {
      if (now - e.timestamp > this.config.coalesceWindowMs * 2) {
        this.recentEvents.delete(k);
      }
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${++this.eventIdCounter}_${Date.now()}`;
  }
  
  /**
   * Clear cached environment info
   */
  clearEnvironmentCache(): void {
    this.environmentInfo = null;
  }
  
  /**
   * Clear recent events cache
   */
  clearRecentEvents(): void {
    this.recentEvents.clear();
  }
  
  /**
   * Dispose of normalizer
   */
  dispose(): void {
    this.recentEvents.clear();
    this.environmentInfo = null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an EventNormalizer instance
 */
export function createEventNormalizer(
  config?: Partial<EventNormalizerConfig>
): EventNormalizer {
  return new EventNormalizer(config);
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if an element is in shadow DOM
 */
export function isInShadowRoot(element: Element): boolean {
  const root = element.getRootNode();
  return root instanceof ShadowRoot;
}

/**
 * Get the shadow host chain for an element
 */
export function getShadowHostChain(element: Element): Element[] {
  const chain: Element[] = [];
  let current: Node = element;
  
  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      chain.push(root.host);
      current = root.host;
    } else {
      break;
    }
  }
  
  return chain;
}
