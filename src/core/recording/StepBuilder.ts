/**
 * StepBuilder - Build Step Objects from DOM Events
 * @module core/recording/StepBuilder
 * @version 1.0.0
 * 
 * Constructs complete Step objects from captured DOM events and elements.
 * Handles label detection, locator bundle creation, and coordinate extraction.
 * 
 * ## Features
 * - Fluent builder pattern for Step construction
 * - Automatic label resolution via LabelResolver
 * - Complete LocatorBundle generation
 * - XPath generation with shadow DOM support
 * - Bounding box coordinate extraction
 * - Unique step ID generation
 * - Sequence number tracking
 * 
 * @see Step for step structure
 * @see LocatorBundle for locator data
 * @see LabelResolver for label detection
 */

import { LabelResolver, getResolver, type ResolvedLabel } from './labels/LabelResolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported step event types
 */
export type StepEventType = 'click' | 'input' | 'enter' | 'open';

/**
 * Step structure (matches P4-002)
 */
export interface Step {
  /** Unique step identifier */
  id: string;
  
  /** Step display name (derived from label) */
  name: string;
  
  /** Event type */
  event: StepEventType;
  
  /** XPath to element */
  path: string;
  
  /** Input value (for input events) */
  value: string;
  
  /** Human-readable label */
  label: string;
  
  /** X coordinate (center of element) */
  x: number;
  
  /** Y coordinate (center of element) */
  y: number;
  
  /** Comprehensive locator bundle */
  bundle?: LocatorBundle;
}

/**
 * Locator bundle structure (matches P4-045)
 */
export interface LocatorBundle {
  /** Element tag name */
  tag: string;
  
  /** Element ID */
  id: string | null;
  
  /** Element name attribute */
  name: string | null;
  
  /** Placeholder text */
  placeholder: string | null;
  
  /** ARIA label */
  aria: string | null;
  
  /** Data attributes */
  dataAttrs: Record<string, string>;
  
  /** Visible text content */
  text: string;
  
  /** CSS selector */
  css: string;
  
  /** XPath */
  xpath: string;
  
  /** CSS classes */
  classes: string[];
  
  /** Page URL */
  pageUrl: string;
  
  /** Bounding box */
  bounding: BoundingInfo;
  
  /** Iframe chain (indices) */
  iframeChain: number[] | null;
  
  /** Shadow host XPaths */
  shadowHosts: string[] | null;
}

/**
 * Bounding box information
 */
export interface BoundingInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Step builder configuration
 */
export interface StepBuilderConfig {
  /** Label resolver instance */
  resolver?: LabelResolver;
  
  /** Starting sequence number */
  startSequence?: number;
  
  /** ID prefix */
  idPrefix?: string;
  
  /** Include bundle in steps */
  includeBundle?: boolean;
  
  /** Default label for unlabeled elements */
  defaultLabel?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_STEP_BUILDER_CONFIG: Required<StepBuilderConfig> = {
  resolver: undefined as any, // Will use singleton
  startSequence: 1,
  idPrefix: 'step',
  includeBundle: true,
  defaultLabel: 'Unlabeled',
};

/**
 * Build context for step creation
 */
export interface BuildContext {
  /** The target element */
  element: Element;
  
  /** The DOM event */
  event?: Event;
  
  /** Event type override */
  eventType?: StepEventType;
  
  /** Input value */
  value?: string;
  
  /** Iframe chain */
  iframeChain?: number[];
  
  /** Shadow host chain */
  shadowHosts?: string[];
  
  /** Custom label override */
  labelOverride?: string;
}

// ============================================================================
// STEP BUILDER CLASS
// ============================================================================

/**
 * Builds Step objects from DOM events and elements
 * 
 * @example
 * ```typescript
 * const builder = new StepBuilder();
 * 
 * // Build from click event
 * const clickStep = builder.buildFromClick(buttonElement, clickEvent);
 * 
 * // Build from input event
 * const inputStep = builder.buildFromInput(inputElement, inputEvent, 'user@example.com');
 * 
 * // Fluent building
 * const step = builder
 *   .forElement(element)
 *   .withEvent('click')
 *   .withValue('')
 *   .build();
 * ```
 */
export class StepBuilder {
  private resolver: LabelResolver;
  private sequence: number;
  private config: Required<StepBuilderConfig>;
  
  // Fluent builder state
  private currentElement: Element | null = null;
  private currentEventType: StepEventType = 'click';
  private currentValue: string = '';
  private currentIframeChain: number[] | null = null;
  private currentShadowHosts: string[] | null = null;
  private currentLabelOverride: string | null = null;
  
  /**
   * Create a new StepBuilder
   */
  constructor(config: StepBuilderConfig = {}) {
    this.config = { ...DEFAULT_STEP_BUILDER_CONFIG, ...config };
    this.resolver = config.resolver || getResolver();
    this.sequence = this.config.startSequence;
  }
  
  // ==========================================================================
  // PRIMARY BUILD METHODS
  // ==========================================================================
  
  /**
   * Build a Step from context
   */
  build(context: BuildContext): Step {
    const { element, event, eventType, value, iframeChain, shadowHosts, labelOverride } = context;
    
    // Determine event type
    const stepEventType = eventType || this.inferEventType(element, event);
    
    // Resolve label
    const resolvedLabel = labelOverride 
      ? { label: labelOverride, confidence: 1, success: true } as ResolvedLabel
      : this.resolver.resolve(element);
    
    const label = resolvedLabel.success 
      ? resolvedLabel.label 
      : this.config.defaultLabel;
    
    // Generate XPath
    const xpath = this.generateXPath(element);
    
    // Get coordinates
    const coordinates = this.extractCoordinates(element);
    
    // Build bundle if configured
    const bundle = this.config.includeBundle 
      ? this.createBundle(element, iframeChain, shadowHosts)
      : undefined;
    
    // Generate ID
    const id = this.generateId();
    
    // Create step
    const step: Step = {
      id,
      name: this.generateName(label, stepEventType),
      event: stepEventType,
      path: xpath,
      value: value || '',
      label,
      x: coordinates.x,
      y: coordinates.y,
      bundle,
    };
    
    // Increment sequence
    this.sequence++;
    
    return step;
  }
  
  /**
   * Build a Step from a click event
   */
  buildFromClick(element: Element, event?: MouseEvent): Step {
    return this.build({
      element,
      event,
      eventType: 'click',
      value: '',
    });
  }
  
  /**
   * Build a Step from an input event
   */
  buildFromInput(element: Element, event?: Event, value?: string): Step {
    const inputValue = value ?? this.extractValue(element);
    
    return this.build({
      element,
      event,
      eventType: 'input',
      value: inputValue,
    });
  }
  
  /**
   * Build a Step from a keyboard event (Enter key)
   */
  buildFromKeyboard(element: Element, event?: KeyboardEvent): Step {
    return this.build({
      element,
      event,
      eventType: 'enter',
      value: '',
    });
  }
  
  /**
   * Build a Step for page navigation
   */
  buildFromNavigation(url: string): Step {
    // Create a minimal pseudo-element for navigation
    const id = this.generateId();
    
    const step: Step = {
      id,
      name: `Navigate to ${new URL(url).hostname}`,
      event: 'open',
      path: '',
      value: url,
      label: 'Navigate',
      x: 0,
      y: 0,
    };
    
    this.sequence++;
    return step;
  }
  
  // ==========================================================================
  // FLUENT BUILDER API
  // ==========================================================================
  
  /**
   * Set the target element
   */
  forElement(element: Element): StepBuilder {
    this.currentElement = element;
    return this;
  }
  
  /**
   * Set the event type
   */
  withEvent(eventType: StepEventType): StepBuilder {
    this.currentEventType = eventType;
    return this;
  }
  
  /**
   * Set the input value
   */
  withValue(value: string): StepBuilder {
    this.currentValue = value;
    return this;
  }
  
  /**
   * Set iframe chain
   */
  withIframeChain(chain: number[]): StepBuilder {
    this.currentIframeChain = chain;
    return this;
  }
  
  /**
   * Set shadow hosts
   */
  withShadowHosts(hosts: string[]): StepBuilder {
    this.currentShadowHosts = hosts;
    return this;
  }
  
  /**
   * Override the label
   */
  withLabel(label: string): StepBuilder {
    this.currentLabelOverride = label;
    return this;
  }
  
  /**
   * Build the step from fluent state
   */
  buildStep(): Step {
    if (!this.currentElement) {
      throw new Error('Element is required. Call forElement() first.');
    }
    
    const step = this.build({
      element: this.currentElement,
      eventType: this.currentEventType,
      value: this.currentValue,
      iframeChain: this.currentIframeChain || undefined,
      shadowHosts: this.currentShadowHosts || undefined,
      labelOverride: this.currentLabelOverride || undefined,
    });
    
    // Reset fluent state
    this.resetFluentState();
    
    return step;
  }
  
  /**
   * Reset fluent builder state
   */
  private resetFluentState(): void {
    this.currentElement = null;
    this.currentEventType = 'click';
    this.currentValue = '';
    this.currentIframeChain = null;
    this.currentShadowHosts = null;
    this.currentLabelOverride = null;
  }
  
  // ==========================================================================
  // BUNDLE CREATION
  // ==========================================================================
  
  /**
   * Create a LocatorBundle for an element
   */
  createBundle(
    element: Element,
    iframeChain?: number[],
    shadowHosts?: string[]
  ): LocatorBundle {
    const rect = element.getBoundingClientRect();
    
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: element.getAttribute('name'),
      placeholder: element.getAttribute('placeholder'),
      aria: element.getAttribute('aria-label'),
      dataAttrs: this.extractDataAttributes(element),
      text: this.extractVisibleText(element),
      css: this.generateCssSelector(element),
      xpath: this.generateXPath(element),
      classes: this.extractClasses(element),
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      bounding: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
      iframeChain: iframeChain || null,
      shadowHosts: shadowHosts || null,
    };
  }
  
  // ==========================================================================
  // XPATH GENERATION
  // ==========================================================================
  
  /**
   * Generate XPath for an element
   */
  generateXPath(element: Element): string {
    const segments: string[] = [];
    let current: Element | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let segment = current.tagName.toLowerCase();
      
      // Add index if there are siblings with same tag
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          segment += `[${index}]`;
        }
      }
      
      segments.unshift(segment);
      
      // Stop at document body
      if (current.tagName.toLowerCase() === 'body') {
        segments.unshift('html');
        break;
      }
      
      current = parent;
    }
    
    return '/' + segments.join('/');
  }
  
  /**
   * Generate CSS selector for an element
   */
  generateCssSelector(element: Element): string {
    const tag = element.tagName.toLowerCase();
    
    // Try ID first
    if (element.id) {
      return `${tag}#${element.id}`;
    }
    
    // Try name attribute
    const name = element.getAttribute('name');
    if (name) {
      return `${tag}[name="${name}"]`;
    }
    
    // Try classes
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0]) {
        return `${tag}.${classes.join('.')}`;
      }
    }
    
    // Fallback to tag only
    return tag;
  }
  
  // ==========================================================================
  // ATTRIBUTE EXTRACTION
  // ==========================================================================
  
  /**
   * Extract data attributes from element
   */
  extractDataAttributes(element: Element): Record<string, string> {
    const dataAttrs: Record<string, string> = {};
    
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) {
        const key = attr.name.substring(5); // Remove 'data-' prefix
        dataAttrs[key] = attr.value;
      }
    }
    
    return dataAttrs;
  }
  
  /**
   * Extract CSS classes from element
   */
  extractClasses(element: Element): string[] {
    if (!element.className || typeof element.className !== 'string') {
      return [];
    }
    
    return element.className.trim().split(/\s+/).filter(Boolean);
  }
  
  /**
   * Extract visible text from element
   */
  extractVisibleText(element: Element): string {
    // For inputs, get value or placeholder
    if (element instanceof HTMLInputElement) {
      return element.value || element.placeholder || '';
    }
    
    if (element instanceof HTMLTextAreaElement) {
      return element.value || element.placeholder || '';
    }
    
    // For other elements, get text content
    const text = element.textContent?.trim() || '';
    
    // Limit length
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  }
  
  /**
   * Extract input value from element
   */
  extractValue(element: Element): string {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked ? 'true' : 'false';
      }
      return element.value;
    }
    
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    
    if (element instanceof HTMLSelectElement) {
      return element.value;
    }
    
    // Contenteditable
    if (element.getAttribute('contenteditable') === 'true') {
      return element.textContent || '';
    }
    
    return '';
  }
  
  // ==========================================================================
  // COORDINATE EXTRACTION
  // ==========================================================================
  
  /**
   * Extract center coordinates from element
   */
  extractCoordinates(element: Element): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  }
  
  // ==========================================================================
  // ID AND NAME GENERATION
  // ==========================================================================
  
  /**
   * Generate unique step ID
   */
  generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${this.config.idPrefix}_${this.sequence}_${timestamp}_${random}`;
  }
  
  /**
   * Generate step name from label and event type
   */
  generateName(label: string, eventType: StepEventType): string {
    const actionVerb = this.getActionVerb(eventType);
    return `${actionVerb} "${label}"`;
  }
  
  /**
   * Get action verb for event type
   */
  private getActionVerb(eventType: StepEventType): string {
    switch (eventType) {
      case 'click':
        return 'Click';
      case 'input':
        return 'Type in';
      case 'enter':
        return 'Press Enter on';
      case 'open':
        return 'Navigate to';
      default:
        return 'Interact with';
    }
  }
  
  // ==========================================================================
  // EVENT TYPE INFERENCE
  // ==========================================================================
  
  /**
   * Infer event type from element and event
   */
  inferEventType(element: Element, event?: Event): StepEventType {
    // Check event type first
    if (event) {
      if (event.type === 'click') return 'click';
      if (event.type === 'input' || event.type === 'change') return 'input';
      if (event.type === 'keydown' || event.type === 'keyup') {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key === 'Enter') return 'enter';
      }
    }
    
    // Infer from element type
    const tag = element.tagName.toLowerCase();
    
    if (tag === 'input') {
      const inputType = (element as HTMLInputElement).type;
      if (inputType === 'submit' || inputType === 'button') return 'click';
      return 'input';
    }
    
    if (tag === 'textarea' || tag === 'select') return 'input';
    if (tag === 'button' || tag === 'a') return 'click';
    
    // Default to click
    return 'click';
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get current sequence number
   */
  getSequence(): number {
    return this.sequence;
  }
  
  /**
   * Reset sequence number
   */
  resetSequence(start?: number): void {
    this.sequence = start ?? this.config.startSequence;
  }
  
  /**
   * Get the label resolver
   */
  getResolver(): LabelResolver {
    return this.resolver;
  }
  
  /**
   * Set a new label resolver
   */
  setResolver(resolver: LabelResolver): void {
    this.resolver = resolver;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a StepBuilder with default configuration
 */
export function createStepBuilder(config?: StepBuilderConfig): StepBuilder {
  return new StepBuilder(config);
}

/**
 * Create a StepBuilder without bundles (lightweight)
 */
export function createLightweightBuilder(): StepBuilder {
  return new StepBuilder({ includeBundle: false });
}

// ============================================================================
// SINGLETON ACCESS
// ============================================================================

let defaultBuilder: StepBuilder | null = null;

/**
 * Get the default StepBuilder instance
 */
export function getStepBuilder(): StepBuilder {
  if (!defaultBuilder) {
    defaultBuilder = new StepBuilder();
  }
  return defaultBuilder;
}

/**
 * Reset the default StepBuilder
 */
export function resetStepBuilder(): void {
  defaultBuilder = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Build a step from a click
 */
export function buildClickStep(element: Element, event?: MouseEvent): Step {
  return getStepBuilder().buildFromClick(element, event);
}

/**
 * Build a step from an input
 */
export function buildInputStep(element: Element, value: string, event?: Event): Step {
  return getStepBuilder().buildFromInput(element, event, value);
}

/**
 * Build a step for navigation
 */
export function buildNavigationStep(url: string): Step {
  return getStepBuilder().buildFromNavigation(url);
}

/**
 * Create a LocatorBundle for an element
 */
export function createLocatorBundle(element: Element): LocatorBundle {
  return getStepBuilder().createBundle(element);
}
