/**
 * AriaLabelDetector - ARIA Accessibility Label Detection
 * @module core/recording/labels/AriaLabelDetector
 * @version 1.0.0
 * 
 * Detects labels from WAI-ARIA accessibility attributes.
 * Supports:
 * - aria-label: Direct label text on element
 * - aria-labelledby: Reference to labeling element(s)
 * - aria-describedby: Reference to describing element(s)
 * - aria-placeholder: Placeholder hint text
 * 
 * ## Confidence Scores
 * - aria-labelledby: 0.90 (explicit association)
 * - aria-label: 0.90 (direct label)
 * - aria-describedby: 0.75 (description, not label)
 * - aria-placeholder: 0.70 (hint text)
 * 
 * @see https://www.w3.org/WAI/ARIA/apg/
 * @see ILabelDetector for interface contract
 */

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  type LabelSourceType,
  CONFIDENCE_SCORES,
  DETECTOR_PRIORITIES,
  cleanLabelText,
  getVisibleText,
} from './ILabelDetector';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for different ARIA attributes
 */
export const ARIA_CONFIDENCE = {
  /** aria-labelledby references explicit label element(s) */
  LABELLEDBY: 0.90,
  
  /** aria-label provides direct label text */
  LABEL: 0.90,
  
  /** aria-describedby is descriptive, not a label */
  DESCRIBEDBY: 0.75,
  
  /** aria-placeholder is hint text */
  PLACEHOLDER: 0.70,
  
  /** Role-inferred label (e.g., button text) */
  ROLE_INFERRED: 0.65,
} as const;

/**
 * ARIA attributes to check, in priority order
 */
export const ARIA_ATTRIBUTES = [
  'aria-labelledby',
  'aria-label',
  'aria-describedby',
  'aria-placeholder',
] as const;

/**
 * Roles that typically have visible text as labels
 */
export const ROLES_WITH_TEXT_LABELS = [
  'button',
  'link',
  'menuitem',
  'tab',
  'option',
  'treeitem',
  'listitem',
  'heading',
] as const;

/**
 * Roles that are form controls
 */
export const FORM_CONTROL_ROLES = [
  'textbox',
  'searchbox',
  'spinbutton',
  'slider',
  'combobox',
  'listbox',
  'checkbox',
  'radio',
  'switch',
] as const;

// ============================================================================
// ARIA LABEL DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from ARIA accessibility attributes
 * 
 * @example
 * ```typescript
 * const detector = new AriaLabelDetector();
 * 
 * // Element with aria-label
 * const input = document.createElement('input');
 * input.setAttribute('aria-label', 'Email Address');
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Email Address'
 * // result.confidence === 0.90
 * ```
 */
export class AriaLabelDetector extends BaseLabelDetector {
  constructor() {
    super(
      'aria-label',
      DETECTOR_PRIORITIES.ARIA,
      CONFIDENCE_SCORES.ARIA_LABEL,
      'Detects labels from ARIA accessibility attributes (aria-label, aria-labelledby)'
    );
  }
  
  /**
   * Check if element has any ARIA label attributes
   */
  canDetect(context: LabelDetectionContext): boolean {
    const element = context.element;
    
    // Check for any ARIA label attributes
    for (const attr of ARIA_ATTRIBUTES) {
      if (element.hasAttribute(attr)) {
        return true;
      }
    }
    
    // Check for role with potential text label
    const role = element.getAttribute('role');
    if (role && ROLES_WITH_TEXT_LABELS.includes(role as any)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect label from ARIA attributes
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element, document: doc } = context;
    
    // Try aria-labelledby first (highest priority for ARIA)
    const labelledByResult = this.detectAriaLabelledBy(element, doc, options);
    if (labelledByResult) {
      return labelledByResult;
    }
    
    // Try aria-label
    const labelResult = this.detectAriaLabel(element, options);
    if (labelResult) {
      return labelResult;
    }
    
    // Try aria-describedby (lower confidence)
    const describedByResult = this.detectAriaDescribedBy(element, doc, options);
    if (describedByResult) {
      return describedByResult;
    }
    
    // Try aria-placeholder
    const placeholderResult = this.detectAriaPlaceholder(element, options);
    if (placeholderResult) {
      return placeholderResult;
    }
    
    // Try role-based text inference
    const roleResult = this.detectRoleBasedLabel(element, options);
    if (roleResult) {
      return roleResult;
    }
    
    return null;
  }
  
  // ==========================================================================
  // ARIA-LABELLEDBY DETECTION
  // ==========================================================================
  
  /**
   * Detect label from aria-labelledby reference(s)
   * 
   * aria-labelledby can reference multiple elements (space-separated IDs)
   * The label text is the concatenation of all referenced elements' text.
   */
  private detectAriaLabelledBy(
    element: Element,
    doc: Document,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (!labelledBy) {
      return null;
    }
    
    // Split IDs (can be space-separated)
    const ids = labelledBy.trim().split(/\s+/);
    const labelParts: string[] = [];
    const sourceElements: Element[] = [];
    
    for (const id of ids) {
      if (!id) continue;
      
      // Find the referenced element
      const labelElement = this.findElementById(doc, id, element);
      if (labelElement) {
        const text = this.getElementLabelText(labelElement);
        if (text) {
          labelParts.push(text);
          sourceElements.push(labelElement);
        }
      }
    }
    
    if (labelParts.length === 0) {
      return null;
    }
    
    const label = labelParts.join(' ');
    const cleanedLabel = cleanLabelText(label);
    
    if (!cleanedLabel) {
      return null;
    }
    
    // Adjust confidence based on number of resolved references
    const resolvedRatio = sourceElements.length / ids.length;
    const confidence = this.adjustConfidence(
      ARIA_CONFIDENCE.LABELLEDBY,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    ) * resolvedRatio;
    
    return this.createResult(cleanedLabel, sourceElements[0], 'associated', {
      attribute: 'aria-labelledby',
      confidence,
      selector: ids.map(id => `#${id}`).join(', '),
      metadata: {
        referencedIds: ids,
        resolvedCount: sourceElements.length,
        totalCount: ids.length,
      },
    });
  }
  
  /**
   * Find element by ID, checking shadow DOM if needed
   */
  private findElementById(
    doc: Document,
    id: string,
    contextElement: Element
  ): Element | null {
    // First try standard getElementById
    let element = doc.getElementById(id);
    if (element) {
      return element;
    }
    
    // Check if we're in shadow DOM
    const root = contextElement.getRootNode();
    if (root instanceof ShadowRoot) {
      element = root.getElementById(id);
      if (element) {
        return element;
      }
    }
    
    // Try querySelector as fallback
    try {
      element = doc.querySelector(`#${CSS.escape(id)}`);
    } catch {
      // Invalid ID for CSS selector
    }
    
    return element;
  }
  
  // ==========================================================================
  // ARIA-LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect label from aria-label attribute
   */
  private detectAriaLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const ariaLabel = element.getAttribute('aria-label');
    if (!ariaLabel) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(ariaLabel);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      ARIA_CONFIDENCE.LABEL,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, element, 'attribute', {
      attribute: 'aria-label',
      confidence,
    });
  }
  
  // ==========================================================================
  // ARIA-DESCRIBEDBY DETECTION
  // ==========================================================================
  
  /**
   * Detect label from aria-describedby reference(s)
   * 
   * This is a fallback - describedby provides description, not label.
   * Lower confidence than labelledby.
   */
  private detectAriaDescribedBy(
    element: Element,
    doc: Document,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const describedBy = element.getAttribute('aria-describedby');
    if (!describedBy) {
      return null;
    }
    
    // Split IDs
    const ids = describedBy.trim().split(/\s+/);
    const textParts: string[] = [];
    const sourceElements: Element[] = [];
    
    for (const id of ids) {
      if (!id) continue;
      
      const descElement = this.findElementById(doc, id, element);
      if (descElement) {
        const text = this.getElementLabelText(descElement);
        if (text) {
          textParts.push(text);
          sourceElements.push(descElement);
        }
      }
    }
    
    if (textParts.length === 0) {
      return null;
    }
    
    // For describedby, use first sentence/phrase as label
    const fullText = textParts.join(' ');
    const label = this.extractFirstPhrase(fullText);
    const cleanedLabel = cleanLabelText(label);
    
    if (!cleanedLabel) {
      return null;
    }
    
    const resolvedRatio = sourceElements.length / ids.length;
    const confidence = this.adjustConfidence(
      ARIA_CONFIDENCE.DESCRIBEDBY,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    ) * resolvedRatio;
    
    return this.createResult(cleanedLabel, sourceElements[0], 'associated', {
      attribute: 'aria-describedby',
      confidence,
      selector: ids.map(id => `#${id}`).join(', '),
      metadata: {
        referencedIds: ids,
        resolvedCount: sourceElements.length,
        isDescription: true,
      },
    });
  }
  
  // ==========================================================================
  // ARIA-PLACEHOLDER DETECTION
  // ==========================================================================
  
  /**
   * Detect label from aria-placeholder attribute
   */
  private detectAriaPlaceholder(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const ariaPlaceholder = element.getAttribute('aria-placeholder');
    if (!ariaPlaceholder) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(ariaPlaceholder);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      ARIA_CONFIDENCE.PLACEHOLDER,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, element, 'attribute', {
      attribute: 'aria-placeholder',
      confidence,
    });
  }
  
  // ==========================================================================
  // ROLE-BASED DETECTION
  // ==========================================================================
  
  /**
   * Detect label from element's role and text content
   * 
   * For elements with certain roles (button, link, etc.),
   * the visible text content serves as the accessible name.
   */
  private detectRoleBasedLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const role = element.getAttribute('role');
    
    // Check explicit role or implicit role from tag
    const effectiveRole = role || this.getImplicitRole(element);
    
    if (!effectiveRole || !ROLES_WITH_TEXT_LABELS.includes(effectiveRole as any)) {
      return null;
    }
    
    // Get visible text content
    const text = getVisibleText(element);
    if (!text) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    // Lower confidence for inferred labels
    const confidence = this.adjustConfidence(
      ARIA_CONFIDENCE.ROLE_INFERRED,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
        exactMatchBonus: cleanedLabel.length <= 30, // Bonus for concise labels
      }
    );
    
    return this.createResult(cleanedLabel, element, 'text-content', {
      confidence,
      metadata: {
        role: effectiveRole,
        inferredFromRole: true,
      },
    });
  }
  
  /**
   * Get implicit ARIA role from element tag
   */
  private getImplicitRole(element: Element): string | null {
    const tagName = element.tagName.toLowerCase();
    
    const implicitRoles: Record<string, string> = {
      'button': 'button',
      'a': 'link',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'li': 'listitem',
      'option': 'option',
      'input': this.getInputRole(element as HTMLInputElement),
    };
    
    return implicitRoles[tagName] || null;
  }
  
  /**
   * Get implicit role for input elements
   */
  private getInputRole(input: HTMLInputElement): string {
    const type = input.type?.toLowerCase() || 'text';
    
    const inputRoles: Record<string, string> = {
      'text': 'textbox',
      'search': 'searchbox',
      'tel': 'textbox',
      'url': 'textbox',
      'email': 'textbox',
      'password': 'textbox',
      'number': 'spinbutton',
      'range': 'slider',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'button': 'button',
      'submit': 'button',
      'reset': 'button',
    };
    
    return inputRoles[type] || 'textbox';
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Get label text from an element
   * 
   * Handles various element types appropriately.
   */
  private getElementLabelText(element: Element): string {
    // For inputs, use value or placeholder
    if (element instanceof HTMLInputElement) {
      return element.value || element.placeholder || '';
    }
    
    // For images, use alt text
    if (element instanceof HTMLImageElement) {
      return element.alt || '';
    }
    
    // For other elements, get visible text
    return getVisibleText(element);
  }
  
  /**
   * Extract first phrase from text (for descriptions)
   * 
   * Takes first sentence or first 100 characters.
   */
  private extractFirstPhrase(text: string): string {
    // Try to find first sentence
    const sentenceEnd = text.search(/[.!?]\s/);
    if (sentenceEnd > 0 && sentenceEnd < 100) {
      return text.substring(0, sentenceEnd + 1);
    }
    
    // Find first clause break
    const clauseBreak = text.search(/[,;:]\s/);
    if (clauseBreak > 0 && clauseBreak < 50) {
      return text.substring(0, clauseBreak);
    }
    
    // Take first N characters
    if (text.length > 50) {
      const wordBreak = text.lastIndexOf(' ', 50);
      if (wordBreak > 20) {
        return text.substring(0, wordBreak);
      }
      return text.substring(0, 50);
    }
    
    return text;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an AriaLabelDetector instance
 */
export function createAriaLabelDetector(): AriaLabelDetector {
  return new AriaLabelDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element has accessible name from ARIA
 */
export function hasAriaLabel(element: Element): boolean {
  return (
    element.hasAttribute('aria-label') ||
    element.hasAttribute('aria-labelledby')
  );
}

/**
 * Get all ARIA label-related attributes from element
 */
export function getAriaLabelAttributes(element: Element): Record<string, string | null> {
  return {
    'aria-label': element.getAttribute('aria-label'),
    'aria-labelledby': element.getAttribute('aria-labelledby'),
    'aria-describedby': element.getAttribute('aria-describedby'),
    'aria-placeholder': element.getAttribute('aria-placeholder'),
    'role': element.getAttribute('role'),
  };
}

/**
 * Resolve aria-labelledby IDs to text
 */
export function resolveAriaLabelledBy(
  element: Element,
  doc: Document = document
): string | null {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (!labelledBy) {
    return null;
  }
  
  const ids = labelledBy.trim().split(/\s+/);
  const texts: string[] = [];
  
  for (const id of ids) {
    const labelElement = doc.getElementById(id);
    if (labelElement) {
      const text = getVisibleText(labelElement);
      if (text) {
        texts.push(text);
      }
    }
  }
  
  return texts.length > 0 ? texts.join(' ') : null;
}

/**
 * Get the accessible name for an element following ARIA spec
 * 
 * This follows a simplified version of the ARIA accessible name computation:
 * 1. aria-labelledby
 * 2. aria-label
 * 3. Native labeling (label[for], etc.) - handled by other detectors
 */
export function getAccessibleName(
  element: Element,
  doc: Document = document
): string | null {
  // 1. aria-labelledby
  const labelledBy = resolveAriaLabelledBy(element, doc);
  if (labelledBy) {
    return labelledBy;
  }
  
  // 2. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return cleanLabelText(ariaLabel);
  }
  
  return null;
}
