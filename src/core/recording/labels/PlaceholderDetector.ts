/**
 * PlaceholderDetector - Placeholder Attribute Label Detection
 * @module core/recording/labels/PlaceholderDetector
 * @version 1.0.0
 * 
 * Detects labels from placeholder attributes on form elements.
 * Supports:
 * - Standard placeholder attribute on input/textarea
 * - Title attribute as fallback
 * - Custom data-placeholder attributes
 * 
 * ## Confidence Scores
 * - placeholder attribute: 0.70 (standard but not ideal for labels)
 * - data-placeholder: 0.65 (custom attribute)
 * - title attribute: 0.60 (tooltip, not label)
 * 
 * ## Quality Adjustments
 * - Generic placeholders ("Enter...", "Type here") get reduced confidence
 * - Descriptive placeholders ("john@example.com") get slight bonus
 * 
 * @see ILabelDetector for interface contract
 */

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  CONFIDENCE_SCORES,
  DETECTOR_PRIORITIES,
  cleanLabelText,
  isGenericLabel,
} from './ILabelDetector';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for different placeholder sources
 */
export const PLACEHOLDER_CONFIDENCE = {
  /** Standard placeholder attribute */
  PLACEHOLDER: 0.70,
  
  /** Custom data-placeholder attribute */
  DATA_PLACEHOLDER: 0.65,
  
  /** Title attribute (tooltip) */
  TITLE: 0.60,
  
  /** Minimum after penalties */
  MINIMUM: 0.30,
} as const;

/**
 * Input types that support placeholder attribute
 */
export const PLACEHOLDER_INPUT_TYPES = [
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
] as const;

/**
 * Input types that do NOT support placeholder
 */
export const NON_PLACEHOLDER_INPUT_TYPES = [
  'hidden',
  'checkbox',
  'radio',
  'file',
  'submit',
  'reset',
  'button',
  'image',
  'color',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'range',
] as const;

/**
 * Patterns indicating instructional (non-label) placeholders
 */
export const INSTRUCTIONAL_PATTERNS = [
  /^enter\s/i,
  /^type\s/i,
  /^input\s/i,
  /^write\s/i,
  /^fill\s/i,
  /^add\s/i,
  /^search\s/i,
  /^find\s/i,
  /here$/i,
  /\.{2,}$/,          // Ends with ...
  /^select\s/i,
  /^choose\s/i,
  /^click\s/i,
] as const;

/**
 * Common generic placeholder values
 */
export const GENERIC_PLACEHOLDERS = [
  'enter text',
  'type here',
  'enter value',
  'enter',
  'type',
  'search',
  'find',
  '...',
  'text',
  'value',
  'input',
] as const;

/**
 * Example patterns that indicate good label quality
 */
export const EXAMPLE_PATTERNS = [
  /^e\.?g\.?\s/i,          // e.g. or eg
  /^ex\.?\s/i,             // ex. or ex
  /^example:/i,
  /^for example/i,
  /@.*\.[a-z]{2,}/i,       // Email format
  /^\d{3}[-.\s]?\d{3}/,    // Phone format
  /^https?:\/\//i,         // URL format
] as const;

// ============================================================================
// PLACEHOLDER DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from placeholder attributes
 * 
 * @example
 * ```typescript
 * const detector = new PlaceholderDetector();
 * 
 * const input = document.createElement('input');
 * input.placeholder = 'john@example.com';
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'john@example.com'
 * // result.confidence === 0.70
 * ```
 */
export class PlaceholderDetector extends BaseLabelDetector {
  constructor() {
    super(
      'placeholder',
      DETECTOR_PRIORITIES.ATTRIBUTES,
      CONFIDENCE_SCORES.PLACEHOLDER,
      'Detects labels from placeholder attributes on form inputs',
      ['input', 'textarea']
    );
  }
  
  /**
   * Check if element has placeholder or related attributes
   */
  canDetect(context: LabelDetectionContext): boolean {
    const element = context.element;
    const tagName = element.tagName.toLowerCase();
    
    // Must be a form input element
    if (tagName !== 'input' && tagName !== 'textarea') {
      // Check for custom elements that might have placeholder
      if (!element.hasAttribute('placeholder') && 
          !element.hasAttribute('data-placeholder')) {
        return false;
      }
    }
    
    // For input elements, check type
    if (tagName === 'input') {
      const inputType = (element as HTMLInputElement).type?.toLowerCase() || 'text';
      if (NON_PLACEHOLDER_INPUT_TYPES.includes(inputType as any)) {
        return false;
      }
    }
    
    // Check for any placeholder-related attributes
    return (
      element.hasAttribute('placeholder') ||
      element.hasAttribute('data-placeholder') ||
      element.hasAttribute('title')
    );
  }
  
  /**
   * Detect label from placeholder attributes
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element } = context;
    
    // Try standard placeholder first
    const placeholderResult = this.detectPlaceholder(element, options);
    if (placeholderResult) {
      return placeholderResult;
    }
    
    // Try data-placeholder
    const dataPlaceholderResult = this.detectDataPlaceholder(element, options);
    if (dataPlaceholderResult) {
      return dataPlaceholderResult;
    }
    
    // Try title attribute as fallback
    const titleResult = this.detectTitle(element, options);
    if (titleResult) {
      return titleResult;
    }
    
    return null;
  }
  
  // ==========================================================================
  // PLACEHOLDER DETECTION
  // ==========================================================================
  
  /**
   * Detect label from standard placeholder attribute
   */
  private detectPlaceholder(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const placeholder = element.getAttribute('placeholder');
    if (!placeholder) {
      return null;
    }
    
    const cleanedLabel = this.cleanPlaceholderText(placeholder);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.calculatePlaceholderConfidence(
      cleanedLabel,
      PLACEHOLDER_CONFIDENCE.PLACEHOLDER
    );
    
    return this.createResult(cleanedLabel, element, 'attribute', {
      attribute: 'placeholder',
      confidence,
      metadata: {
        isInstructional: this.isInstructionalPlaceholder(placeholder),
        isExample: this.isExamplePlaceholder(placeholder),
      },
    });
  }
  
  /**
   * Detect label from data-placeholder attribute
   */
  private detectDataPlaceholder(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check various data-placeholder variants
    const dataAttrs = [
      'data-placeholder',
      'data-original-placeholder',
      'data-label',
    ];
    
    for (const attr of dataAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        const cleanedLabel = this.cleanPlaceholderText(value);
        if (cleanedLabel) {
          const confidence = this.calculatePlaceholderConfidence(
            cleanedLabel,
            PLACEHOLDER_CONFIDENCE.DATA_PLACEHOLDER
          );
          
          return this.createResult(cleanedLabel, element, 'attribute', {
            attribute: attr,
            confidence,
          });
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detect label from title attribute
   */
  private detectTitle(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const title = element.getAttribute('title');
    if (!title) {
      return null;
    }
    
    const cleanedLabel = this.cleanPlaceholderText(title);
    if (!cleanedLabel) {
      return null;
    }
    
    // Title is often a tooltip, not a label - lower confidence
    const confidence = this.calculatePlaceholderConfidence(
      cleanedLabel,
      PLACEHOLDER_CONFIDENCE.TITLE
    );
    
    return this.createResult(cleanedLabel, element, 'attribute', {
      attribute: 'title',
      confidence,
      metadata: {
        isTooltip: true,
      },
    });
  }
  
  // ==========================================================================
  // CONFIDENCE CALCULATION
  // ==========================================================================
  
  /**
   * Calculate confidence based on placeholder quality
   */
  private calculatePlaceholderConfidence(
    text: string,
    baseConfidence: number
  ): number {
    let confidence = baseConfidence;
    
    // Check if it's a generic/instructional placeholder
    if (this.isGenericPlaceholder(text)) {
      confidence -= 0.15;
    }
    
    // Check if it's instructional ("Enter your...")
    if (this.isInstructionalPlaceholder(text)) {
      // Extract the actual label from instructional text
      const extractedLabel = this.extractLabelFromInstruction(text);
      if (extractedLabel && extractedLabel !== text) {
        confidence -= 0.05; // Small penalty for needing extraction
      } else {
        confidence -= 0.10;
      }
    }
    
    // Bonus for example-style placeholders (they're descriptive)
    if (this.isExamplePlaceholder(text)) {
      confidence += 0.05;
    }
    
    // Bonus for good length (3-30 chars is ideal)
    if (text.length >= 3 && text.length <= 30) {
      confidence += 0.02;
    }
    
    // Penalty for very short placeholders
    if (text.length < 3) {
      confidence -= 0.10;
    }
    
    // Penalty for very long placeholders (likely instructions)
    if (text.length > 50) {
      confidence -= 0.10;
    }
    
    // Check using base class generic detection
    if (isGenericLabel(text)) {
      confidence -= 0.10;
    }
    
    // Ensure confidence stays in valid range
    return Math.max(PLACEHOLDER_CONFIDENCE.MINIMUM, Math.min(1.0, confidence));
  }
  
  /**
   * Check if placeholder is generic/uninformative
   */
  private isGenericPlaceholder(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    
    // Check exact matches
    if (GENERIC_PLACEHOLDERS.includes(normalized as any)) {
      return true;
    }
    
    // Check if it's just punctuation
    if (/^[.\-_\s]+$/.test(normalized)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if placeholder is instructional ("Enter your email")
   */
  private isInstructionalPlaceholder(text: string): boolean {
    for (const pattern of INSTRUCTIONAL_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check if placeholder is an example value
   */
  private isExamplePlaceholder(text: string): boolean {
    for (const pattern of EXAMPLE_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }
  
  // ==========================================================================
  // TEXT PROCESSING
  // ==========================================================================
  
  /**
   * Clean placeholder text for use as label
   */
  private cleanPlaceholderText(text: string): string {
    let cleaned = cleanLabelText(text);
    
    // Remove common prefixes
    cleaned = cleaned
      .replace(/^e\.?g\.?\s*:?\s*/i, '')
      .replace(/^ex\.?\s*:?\s*/i, '')
      .replace(/^example\s*:?\s*/i, '')
      .replace(/^for example\s*:?\s*/i, '');
    
    // If it's instructional, try to extract the label
    if (this.isInstructionalPlaceholder(cleaned)) {
      const extracted = this.extractLabelFromInstruction(cleaned);
      if (extracted) {
        cleaned = extracted;
      }
    }
    
    return cleaned.trim();
  }
  
  /**
   * Extract label from instructional placeholder
   * 
   * "Enter your email" -> "email"
   * "Type your password here" -> "password"
   */
  private extractLabelFromInstruction(text: string): string {
    // Remove common instruction prefixes
    let label = text
      .replace(/^enter\s+(your\s+)?/i, '')
      .replace(/^type\s+(your\s+)?/i, '')
      .replace(/^input\s+(your\s+)?/i, '')
      .replace(/^write\s+(your\s+)?/i, '')
      .replace(/^fill\s+(in\s+)?(your\s+)?/i, '')
      .replace(/^add\s+(your\s+)?/i, '')
      .replace(/^search\s+(for\s+)?/i, '')
      .replace(/^find\s+/i, '')
      .replace(/^select\s+(a\s+|your\s+)?/i, '')
      .replace(/^choose\s+(a\s+|your\s+)?/i, '');
    
    // Remove common suffixes
    label = label
      .replace(/\s+here$/i, '')
      .replace(/\s*\.{2,}$/i, '')
      .replace(/\s*\.$/i, '');
    
    return label.trim();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a PlaceholderDetector instance
 */
export function createPlaceholderDetector(): PlaceholderDetector {
  return new PlaceholderDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element has a placeholder attribute
 */
export function hasPlaceholder(element: Element): boolean {
  return element.hasAttribute('placeholder');
}

/**
 * Get placeholder value from element
 */
export function getPlaceholder(element: Element): string | null {
  return element.getAttribute('placeholder');
}

/**
 * Check if input type supports placeholder attribute
 */
export function supportsPlaceholder(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'textarea') {
    return true;
  }
  
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type?.toLowerCase() || 'text';
    return PLACEHOLDER_INPUT_TYPES.includes(type as any);
  }
  
  return false;
}

/**
 * Check if a placeholder value appears to be instructional
 */
export function isInstructionalText(text: string): boolean {
  for (const pattern of INSTRUCTIONAL_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract meaningful label from instructional placeholder
 */
export function extractLabelFromPlaceholder(placeholder: string): string {
  const detector = new PlaceholderDetector();
  return (detector as any).extractLabelFromInstruction(placeholder);
}

/**
 * Get all placeholder-related attributes from element
 */
export function getPlaceholderAttributes(element: Element): Record<string, string | null> {
  return {
    'placeholder': element.getAttribute('placeholder'),
    'data-placeholder': element.getAttribute('data-placeholder'),
    'data-original-placeholder': element.getAttribute('data-original-placeholder'),
    'title': element.getAttribute('title'),
  };
}
