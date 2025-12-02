/**
 * ILabelDetector - Label Detection Strategy Interface
 * @module core/recording/labels/ILabelDetector
 * @version 1.0.0
 * 
 * Defines the interface contract for label detection strategies used
 * to extract human-readable labels from form elements during recording.
 * 
 * ## Confidence Scoring
 * 
 * Each strategy reports a confidence score (0.0 - 1.0) indicating
 * reliability of the detected label:
 * 
 * - 0.90-1.00: Very High (aria-label, explicit label[for])
 * - 0.70-0.89: High (placeholder, framework-specific)
 * - 0.50-0.69: Medium (name attribute, sibling elements)
 * - 0.30-0.49: Low (text content, proximity-based)
 * - 0.00-0.29: Very Low (fallback, uncertain)
 * 
 * ## Priority Ordering
 * 
 * Detectors are executed in priority order (lower number = higher priority).
 * When multiple detectors find labels, the one with highest confidence wins.
 * If confidence is equal, priority breaks the tie.
 * 
 * @see recording-engine_breakdown.md for context
 * @see LabelDetectorRegistry for detector management
 */

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Result of label detection attempt
 */
export interface LabelDetectionResult {
  /** Detected label text */
  label: string;
  
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  
  /** Name of strategy that detected the label */
  strategy: string;
  
  /** Source element that provided the label (may differ from target) */
  source: LabelSource;
  
  /** Additional metadata about detection */
  metadata: LabelMetadata;
}

/**
 * Source of detected label
 */
export interface LabelSource {
  /** The element that provided the label text */
  element: Element | null;
  
  /** How the label was found */
  type: LabelSourceType;
  
  /** XPath to source element (for debugging) */
  xpath: string | null;
  
  /** Attribute name if label came from attribute */
  attribute: string | null;
}

/**
 * Types of label sources
 */
export type LabelSourceType =
  | 'attribute'        // From element attribute (aria-label, placeholder)
  | 'associated'       // From label[for] or aria-labelledby
  | 'ancestor'         // From ancestor element
  | 'sibling'          // From sibling element
  | 'child'            // From child element
  | 'text-content'     // From element's own text content
  | 'computed'         // Computed from multiple sources
  | 'framework'        // Framework-specific pattern
  | 'fallback';        // Default/fallback value

/**
 * Additional metadata about label detection
 */
export interface LabelMetadata {
  /** Original text before normalization */
  rawText: string;
  
  /** Whether label was truncated */
  truncated: boolean;
  
  /** Original length before truncation */
  originalLength: number;
  
  /** CSS selector used to find label (if applicable) */
  selector: string | null;
  
  /** Framework detected (if applicable) */
  framework: string | null;
  
  /** Additional context-specific data */
  extra: Record<string, unknown>;
}

/**
 * Context provided to label detectors
 */
export interface LabelDetectionContext {
  /** Target element to find label for */
  element: Element;
  
  /** Document containing the element */
  document: Document;
  
  /** Window containing the document */
  window: Window;
  
  /** Whether element is in an iframe */
  isInIframe: boolean;
  
  /** Whether element is in shadow DOM */
  isInShadowDOM: boolean;
  
  /** Shadow root if in shadow DOM */
  shadowRoot: ShadowRoot | null;
  
  /** Event that triggered recording (if available) */
  event: Event | null;
  
  /** Page URL */
  pageUrl: string;
  
  /** Additional context data */
  extra: Record<string, unknown>;
}

/**
 * Configuration options for label detection
 */
export interface LabelDetectionOptions {
  /** Maximum label length (default: 100) */
  maxLength: number;
  
  /** Minimum confidence threshold (default: 0.0) */
  minConfidence: number;
  
  /** Whether to normalize whitespace (default: true) */
  normalizeWhitespace: boolean;
  
  /** Whether to trim label (default: true) */
  trim: boolean;
  
  /** Whether to check element visibility (default: false) */
  checkVisibility: boolean;
  
  /** Custom text transform function */
  transform: ((text: string) => string) | null;
}

// ============================================================================
// LABEL DETECTOR INTERFACE
// ============================================================================

/**
 * Interface for label detection strategies
 * 
 * Implement this interface to create custom label detection strategies.
 * Each detector should focus on a specific pattern or source of labels.
 * 
 * @example
 * ```typescript
 * class MyCustomDetector implements ILabelDetector {
 *   readonly name = 'my-custom';
 *   readonly priority = 50;
 *   readonly baseConfidence = 0.75;
 *   
 *   canDetect(context: LabelDetectionContext): boolean {
 *     return context.element.hasAttribute('data-my-label');
 *   }
 *   
 *   detect(context: LabelDetectionContext, options: LabelDetectionOptions): LabelDetectionResult | null {
 *     const label = context.element.getAttribute('data-my-label');
 *     if (!label) return null;
 *     
 *     return {
 *       label: normalizeLabel(label, options),
 *       confidence: this.baseConfidence,
 *       strategy: this.name,
 *       source: {
 *         element: context.element,
 *         type: 'attribute',
 *         xpath: null,
 *         attribute: 'data-my-label',
 *       },
 *       metadata: {
 *         rawText: label,
 *         truncated: false,
 *         originalLength: label.length,
 *         selector: '[data-my-label]',
 *         framework: null,
 *         extra: {},
 *       },
 *     };
 *   }
 * }
 * ```
 */
export interface ILabelDetector {
  /**
   * Unique name identifying this detector
   */
  readonly name: string;
  
  /**
   * Execution priority (lower = higher priority)
   * 
   * Suggested ranges:
   * - 0-19: Critical/framework-specific (Google Forms, etc.)
   * - 20-39: High priority (aria-label, label[for])
   * - 40-59: Medium priority (placeholder, name)
   * - 60-79: Low priority (siblings, proximity)
   * - 80-99: Fallback (text content, parent)
   */
  readonly priority: number;
  
  /**
   * Base confidence score for this detector (0.0 - 1.0)
   * 
   * This is the default confidence when detection succeeds.
   * Individual results may adjust this based on quality.
   */
  readonly baseConfidence: number;
  
  /**
   * Check if this detector can potentially find a label for the element
   * 
   * This is a quick pre-check before running full detection.
   * Return true if there's a reasonable chance of finding a label.
   * Return false to skip this detector entirely.
   * 
   * @param context - Detection context with element and document
   * @returns true if detector might find a label
   */
  canDetect(context: LabelDetectionContext): boolean;
  
  /**
   * Attempt to detect a label for the element
   * 
   * @param context - Detection context with element and document
   * @param options - Detection options
   * @returns Detection result, or null if no label found
   */
  detect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null;
  
  /**
   * Optional: Describe what this detector looks for (for debugging)
   */
  readonly description?: string;
  
  /**
   * Optional: List of element types this detector handles
   * If not specified, handles all elements
   */
  readonly supportedElements?: string[];
}

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

/**
 * Abstract base class for label detectors
 * 
 * Provides common functionality and default implementations.
 * Extend this class to create new detectors more easily.
 * 
 * @example
 * ```typescript
 * class PlaceholderDetector extends BaseLabelDetector {
 *   constructor() {
 *     super('placeholder', 45, 0.70);
 *   }
 *   
 *   canDetect(context: LabelDetectionContext): boolean {
 *     return context.element.hasAttribute('placeholder');
 *   }
 *   
 *   protected doDetect(
 *     context: LabelDetectionContext,
 *     options: LabelDetectionOptions
 *   ): LabelDetectionResult | null {
 *     const placeholder = context.element.getAttribute('placeholder');
 *     if (!placeholder) return null;
 *     
 *     return this.createResult(placeholder, context.element, 'attribute', {
 *       attribute: 'placeholder',
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseLabelDetector implements ILabelDetector {
  readonly name: string;
  readonly priority: number;
  readonly baseConfidence: number;
  readonly description?: string;
  readonly supportedElements?: string[];
  
  protected currentOptions: LabelDetectionOptions = DEFAULT_DETECTION_OPTIONS;
  
  constructor(
    name: string,
    priority: number,
    baseConfidence: number,
    description?: string,
    supportedElements?: string[]
  ) {
    this.name = name;
    this.priority = priority;
    this.baseConfidence = baseConfidence;
    this.description = description;
    this.supportedElements = supportedElements;
  }
  
  /**
   * Check if detector can potentially find a label
   * 
   * Override this in subclasses for element-specific checks.
   */
  abstract canDetect(context: LabelDetectionContext): boolean;
  
  /**
   * Main detection method - calls doDetect with validation
   */
  detect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    this.currentOptions = options;
    
    // Check if element type is supported
    if (this.supportedElements && this.supportedElements.length > 0) {
      const tagName = context.element.tagName.toLowerCase();
      if (!this.supportedElements.includes(tagName)) {
        return null;
      }
    }
    
    // Run detection
    const result = this.doDetect(context, options);
    
    // Validate result
    if (result) {
      // Check minimum confidence
      if (result.confidence < options.minConfidence) {
        return null;
      }
      
      // Normalize label
      result.label = normalizeLabel(result.label, options);
      
      // Check if label is empty after normalization
      if (!result.label || result.label.trim() === '') {
        return null;
      }
    }
    
    return result;
  }
  
  /**
   * Implement actual detection logic in subclasses
   */
  protected abstract doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null;
  
  /**
   * Helper to create a detection result
   */
  protected createResult(
    label: string,
    sourceElement: Element | null,
    sourceType: LabelSourceType,
    extra: {
      attribute?: string;
      selector?: string;
      framework?: string;
      confidence?: number;
      xpath?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): LabelDetectionResult {
    const rawText = label;
    const normalizedLabel = normalizeLabel(label, this.currentOptions);
    
    return {
      label: normalizedLabel,
      confidence: extra.confidence ?? this.baseConfidence,
      strategy: this.name,
      source: {
        element: sourceElement,
        type: sourceType,
        xpath: extra.xpath ?? null,
        attribute: extra.attribute ?? null,
      },
      metadata: {
        rawText,
        truncated: normalizedLabel.length < rawText.length,
        originalLength: rawText.length,
        selector: extra.selector ?? null,
        framework: extra.framework ?? null,
        extra: extra.metadata ?? {},
      },
    };
  }
  
  /**
   * Helper to adjust confidence based on label quality
   */
  protected adjustConfidence(
    baseConfidence: number,
    label: string,
    factors: {
      /** Bonus for longer, more descriptive labels */
      lengthBonus?: boolean;
      /** Penalty for very short labels */
      shortPenalty?: boolean;
      /** Penalty for generic labels (e.g., "Input", "Field") */
      genericPenalty?: boolean;
      /** Bonus for exact match patterns */
      exactMatchBonus?: boolean;
    } = {}
  ): number {
    let confidence = baseConfidence;
    
    // Length bonus (3-50 chars is ideal)
    if (factors.lengthBonus && label.length >= 3 && label.length <= 50) {
      confidence = Math.min(1.0, confidence + 0.05);
    }
    
    // Short penalty (less than 3 chars)
    if (factors.shortPenalty && label.length < 3) {
      confidence = Math.max(0, confidence - 0.1);
    }
    
    // Generic penalty
    if (factors.genericPenalty && isGenericLabel(label)) {
      confidence = Math.max(0, confidence - 0.15);
    }
    
    // Exact match bonus
    if (factors.exactMatchBonus) {
      confidence = Math.min(1.0, confidence + 0.1);
    }
    
    return confidence;
  }
  
  /**
   * Helper to get element's XPath for debugging
   */
  protected getXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;
    
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
      parts.unshift(`${tagName}[${index}]`);
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

/**
 * Default label detection options
 */
export const DEFAULT_DETECTION_OPTIONS: LabelDetectionOptions = {
  maxLength: 100,
  minConfidence: 0.0,
  normalizeWhitespace: true,
  trim: true,
  checkVisibility: false,
  transform: null,
};

// ============================================================================
// CONFIDENCE SCORE CONSTANTS
// ============================================================================

/**
 * Standard confidence scores for common detection strategies
 */
export const CONFIDENCE_SCORES = {
  /** Google Forms specific patterns */
  GOOGLE_FORMS: 0.95,
  
  /** aria-label attribute */
  ARIA_LABEL: 0.90,
  
  /** aria-labelledby reference */
  ARIA_LABELLEDBY: 0.90,
  
  /** label[for] association */
  LABEL_FOR: 0.85,
  
  /** Ancestor label element */
  ANCESTOR_LABEL: 0.80,
  
  /** Bootstrap form-label */
  BOOTSTRAP: 0.75,
  
  /** Placeholder attribute */
  PLACEHOLDER: 0.70,
  
  /** Material-UI patterns */
  MATERIAL_UI: 0.70,
  
  /** Name attribute */
  NAME_ATTRIBUTE: 0.65,
  
  /** Sibling label/span */
  SIBLING: 0.60,
  
  /** Previous sibling text */
  PREVIOUS_TEXT: 0.50,
  
  /** Parent text content */
  PARENT_TEXT: 0.40,
  
  /** Fallback/default */
  FALLBACK: 0.20,
} as const;

/**
 * Standard priority values for detectors
 */
export const DETECTOR_PRIORITIES = {
  /** Framework-specific (Google Forms, etc.) */
  FRAMEWORK: 10,
  
  /** ARIA attributes */
  ARIA: 20,
  
  /** Explicit label association */
  LABEL_ASSOCIATION: 25,
  
  /** Common attributes (placeholder, name) */
  ATTRIBUTES: 40,
  
  /** Bootstrap/Material-UI patterns */
  CSS_FRAMEWORK: 50,
  
  /** Sibling/proximity-based */
  PROXIMITY: 60,
  
  /** Text content fallbacks */
  TEXT_CONTENT: 80,
  
  /** Last resort */
  FALLBACK: 90,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize a label string
 */
export function normalizeLabel(
  label: string,
  options: LabelDetectionOptions
): string {
  if (!label) return '';
  
  let normalized = label;
  
  // Apply custom transform first
  if (options.transform) {
    normalized = options.transform(normalized);
  }
  
  // Normalize whitespace
  if (options.normalizeWhitespace) {
    normalized = normalized.replace(/\s+/g, ' ');
  }
  
  // Trim
  if (options.trim) {
    normalized = normalized.trim();
  }
  
  // Truncate
  if (normalized.length > options.maxLength) {
    normalized = normalized.substring(0, options.maxLength - 3) + '...';
  }
  
  return normalized;
}

/**
 * Check if a label is generic/uninformative
 */
export function isGenericLabel(label: string): boolean {
  const genericPatterns = [
    /^input$/i,
    /^field$/i,
    /^text$/i,
    /^value$/i,
    /^enter$/i,
    /^type$/i,
    /^select$/i,
    /^choose$/i,
    /^click$/i,
    /^button$/i,
    /^submit$/i,
    /^form$/i,
    /^required$/i,
    /^\*$/,
    /^\.{3,}$/,
  ];
  
  const normalized = label.trim().toLowerCase();
  return genericPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Clean label text by removing common noise
 */
export function cleanLabelText(text: string): string {
  return text
    // Remove parenthetical content like "(required)" first
    .replace(/\s*\(required\)\s*/gi, '')
    .replace(/\s*\(optional\)\s*/gi, '')
    // Remove colons
    .replace(/:\s*$/, '')
    // Remove required indicators
    .replace(/\s*\*\s*$/, '')
    .replace(/^\s*\*\s*/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract visible text from element, excluding hidden children
 */
export function getVisibleText(element: Element): string {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  
  const texts: string[] = [];
  let node: Node | null;
  
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text) {
      texts.push(text);
    }
  }
  
  return texts.join(' ');
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true;
  }
  
  const style = window.getComputedStyle(element);
  
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Create a default detection context
 */
export function createDetectionContext(
  element: Element,
  extra: Partial<LabelDetectionContext> = {}
): LabelDetectionContext {
  const doc = element.ownerDocument;
  const win = doc.defaultView || window;
  
  return {
    element,
    document: doc,
    window: win,
    isInIframe: win !== win.top,
    isInShadowDOM: element.getRootNode() instanceof ShadowRoot,
    shadowRoot: element.getRootNode() instanceof ShadowRoot 
      ? element.getRootNode() as ShadowRoot 
      : null,
    event: null,
    pageUrl: win.location.href,
    extra: {},
    ...extra,
  };
}

/**
 * Merge detection options with defaults
 */
export function mergeDetectionOptions(
  options?: Partial<LabelDetectionOptions>
): LabelDetectionOptions {
  return {
    ...DEFAULT_DETECTION_OPTIONS,
    ...options,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is a valid LabelDetectionResult
 */
export function isLabelDetectionResult(value: unknown): value is LabelDetectionResult {
  if (!value || typeof value !== 'object') return false;
  
  const result = value as LabelDetectionResult;
  
  return (
    typeof result.label === 'string' &&
    typeof result.confidence === 'number' &&
    result.confidence >= 0 &&
    result.confidence <= 1 &&
    typeof result.strategy === 'string' &&
    result.source !== undefined &&
    result.metadata !== undefined
  );
}

/**
 * Check if value implements ILabelDetector
 */
export function isLabelDetector(value: unknown): value is ILabelDetector {
  if (!value || typeof value !== 'object') return false;
  
  const detector = value as ILabelDetector;
  
  return (
    typeof detector.name === 'string' &&
    typeof detector.priority === 'number' &&
    typeof detector.baseConfidence === 'number' &&
    typeof detector.canDetect === 'function' &&
    typeof detector.detect === 'function'
  );
}
