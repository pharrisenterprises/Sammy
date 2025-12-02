/**
 * AssociatedLabelDetector - HTML Form Label Association Detection
 * @module core/recording/labels/AssociatedLabelDetector
 * @version 1.0.0
 * 
 * Detects labels from standard HTML form label associations.
 * Supports:
 * - Explicit label[for] association
 * - Implicit label wrapping (ancestor label)
 * - Fieldset/legend for grouped controls
 * - Previous sibling label patterns
 * 
 * ## Confidence Scores
 * - label[for] explicit: 0.85 (standard association)
 * - Ancestor label: 0.80 (implicit association)
 * - Previous sibling label: 0.75 (common pattern)
 * - Fieldset legend: 0.70 (group label)
 * 
 * @see https://html.spec.whatwg.org/multipage/forms.html#the-label-element
 * @see ILabelDetector for interface contract
 */

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  DETECTOR_PRIORITIES,
  cleanLabelText,
  getVisibleText,
  isElementVisible,
} from './ILabelDetector';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for different association types
 */
export const ASSOCIATION_CONFIDENCE = {
  /** Explicit label[for] association */
  LABEL_FOR: 0.85,
  
  /** Ancestor label wrapping input */
  ANCESTOR_LABEL: 0.80,
  
  /** Previous sibling label element */
  SIBLING_LABEL: 0.75,
  
  /** Fieldset legend for groups */
  FIELDSET_LEGEND: 0.70,
  
  /** Output element label */
  OUTPUT_LABEL: 0.65,
} as const;

/**
 * Elements that can be labeled via label[for]
 */
export const LABELABLE_ELEMENTS = [
  'input',
  'select',
  'textarea',
  'button',
  'meter',
  'output',
  'progress',
] as const;

/**
 * Input types that benefit from fieldset/legend
 */
export const GROUPED_INPUT_TYPES = [
  'radio',
  'checkbox',
] as const;

// ============================================================================
// ASSOCIATED LABEL DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from HTML form label associations
 * 
 * @example
 * ```typescript
 * const detector = new AssociatedLabelDetector();
 * 
 * // HTML: <label for="email">Email Address</label>
 * //       <input id="email" type="text">
 * const input = document.getElementById('email');
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Email Address'
 * // result.confidence === 0.85
 * ```
 */
export class AssociatedLabelDetector extends BaseLabelDetector {
  constructor() {
    super(
      'associated-label',
      DETECTOR_PRIORITIES.LABEL_ASSOCIATION,
      ASSOCIATION_CONFIDENCE.LABEL_FOR,
      'Detects labels from HTML form label associations (label[for], ancestor label, fieldset/legend)'
    );
  }
  
  /**
   * Check if element can have associated labels
   */
  canDetect(context: LabelDetectionContext): boolean {
    const element = context.element;
    const tagName = element.tagName.toLowerCase();
    
    // Check if it's a labelable element
    if (LABELABLE_ELEMENTS.includes(tagName as any)) {
      return true;
    }
    
    // Check for contenteditable
    if (element.hasAttribute('contenteditable')) {
      return true;
    }
    
    // Check for custom form elements with role
    const role = element.getAttribute('role');
    if (role === 'textbox' || role === 'combobox' || role === 'listbox') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect label from form associations
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element, document: doc } = context;
    
    // Try explicit label[for] first (highest confidence)
    const forLabelResult = this.detectLabelFor(element, doc, options);
    if (forLabelResult) {
      return forLabelResult;
    }
    
    // Try ancestor label (implicit association)
    const ancestorResult = this.detectAncestorLabel(element, options);
    if (ancestorResult) {
      return ancestorResult;
    }
    
    // Try fieldset/legend for grouped controls (before sibling)
    const fieldsetResult = this.detectFieldsetLegend(element, options);
    if (fieldsetResult) {
      return fieldsetResult;
    }
    
    // Try previous sibling label
    const siblingResult = this.detectSiblingLabel(element, options);
    if (siblingResult) {
      return siblingResult;
    }
    
    // Try labels property (native browser API)
    const labelsResult = this.detectViaLabelsProperty(element, options);
    if (labelsResult) {
      return labelsResult;
    }
    
    return null;
  }
  
  // ==========================================================================
  // LABEL[FOR] DETECTION
  // ==========================================================================
  
  /**
   * Detect label via label[for] attribute
   * 
   * HTML pattern: <label for="inputId">Label Text</label>
   *               <input id="inputId">
   */
  private detectLabelFor(
    element: Element,
    doc: Document,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const id = element.id;
    if (!id) {
      return null;
    }
    
    // Find label with for attribute matching this ID
    const label = this.findLabelForId(doc, id, element);
    if (!label) {
      return null;
    }
    
    // Get label text, excluding nested form controls
    const labelText = this.getLabelText(label);
    if (!labelText) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(labelText);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      ASSOCIATION_CONFIDENCE.LABEL_FOR,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, label, 'associated', {
      attribute: 'for',
      confidence,
      selector: `label[for="${id}"]`,
      xpath: this.getXPath(label),
      metadata: {
        associationType: 'explicit',
        targetId: id,
      },
    });
  }
  
  /**
   * Find label element for a given ID
   */
  private findLabelForId(
    doc: Document,
    id: string,
    contextElement: Element
  ): HTMLLabelElement | null {
    // Try standard querySelector
    try {
      const label = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label instanceof HTMLLabelElement) {
        return label;
      }
    } catch {
      // Invalid ID for CSS selector
    }
    
    // Check shadow DOM if in shadow context
    const root = contextElement.getRootNode();
    if (root instanceof ShadowRoot) {
      const label = root.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label instanceof HTMLLabelElement) {
        return label;
      }
    }
    
    // Fallback: search all labels
    const labels = doc.querySelectorAll('label[for]');
    for (const label of labels) {
      if (label.getAttribute('for') === id && label instanceof HTMLLabelElement) {
        return label;
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // ANCESTOR LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect label from ancestor label element
   * 
   * HTML pattern: <label>Label Text <input></label>
   */
  private detectAncestorLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Walk up the DOM tree looking for a label
    let current = element.parentElement;
    
    while (current) {
      if (current.tagName.toLowerCase() === 'label') {
        const labelText = this.getLabelText(current, element);
        if (labelText) {
          const cleanedLabel = cleanLabelText(labelText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL,
              cleanedLabel,
              {
                lengthBonus: true,
                shortPenalty: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, current, 'ancestor', {
              confidence,
              selector: 'label',
              xpath: this.getXPath(current),
              metadata: {
                associationType: 'implicit',
                nestingDepth: this.getNestingDepth(element, current),
              },
            });
          }
        }
      }
      current = current.parentElement;
    }
    
    return null;
  }
  
  /**
   * Calculate nesting depth between element and ancestor
   */
  private getNestingDepth(element: Element, ancestor: Element): number {
    let depth = 0;
    let current = element.parentElement;
    
    while (current && current !== ancestor) {
      depth++;
      current = current.parentElement;
    }
    
    return depth;
  }
  
  // ==========================================================================
  // SIBLING LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect label from previous sibling
   * 
   * HTML pattern: <label>Label Text</label>
   *               <input>
   */
  private detectSiblingLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check previous sibling
    let sibling = element.previousElementSibling;
    
    // Skip whitespace-only text nodes
    while (sibling && this.isEmptyElement(sibling)) {
      sibling = sibling.previousElementSibling;
    }
    
    if (!sibling) {
      return null;
    }
    
    // Check if sibling is a label
    if (sibling.tagName.toLowerCase() === 'label') {
      const labelText = this.getLabelText(sibling);
      if (labelText) {
        const cleanedLabel = cleanLabelText(labelText);
        if (cleanedLabel) {
          const confidence = this.adjustConfidence(
            ASSOCIATION_CONFIDENCE.SIBLING_LABEL,
            cleanedLabel,
            {
              lengthBonus: true,
              shortPenalty: true,
              genericPenalty: true,
            }
          );
          
          return this.createResult(cleanedLabel, sibling, 'sibling', {
            confidence,
            xpath: this.getXPath(sibling),
            metadata: {
              associationType: 'sibling',
              position: 'previous',
            },
          });
        }
      }
    }
    
    // Check if sibling contains a label (e.g., <div><label>...</label></div>)
    const nestedLabel = sibling.querySelector('label');
    if (nestedLabel) {
      const labelText = this.getLabelText(nestedLabel);
      if (labelText) {
        const cleanedLabel = cleanLabelText(labelText);
        if (cleanedLabel) {
          // Slightly lower confidence for nested
          const confidence = this.adjustConfidence(
            ASSOCIATION_CONFIDENCE.SIBLING_LABEL - 0.05,
            cleanedLabel,
            {
              lengthBonus: true,
              genericPenalty: true,
            }
          );
          
          return this.createResult(cleanedLabel, nestedLabel, 'sibling', {
            confidence,
            xpath: this.getXPath(nestedLabel),
            metadata: {
              associationType: 'nested-sibling',
            },
          });
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if element is empty or whitespace-only
   */
  private isEmptyElement(element: Element): boolean {
    const text = element.textContent?.trim();
    return !text || text === '';
  }
  
  // ==========================================================================
  // FIELDSET/LEGEND DETECTION
  // ==========================================================================
  
  /**
   * Detect label from fieldset/legend
   * 
   * HTML pattern: <fieldset>
   *                 <legend>Group Label</legend>
   *                 <input type="radio" name="group" value="1">
   *                 <input type="radio" name="group" value="2">
   *               </fieldset>
   */
  private detectFieldsetLegend(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if this is a grouped input type
    if (element instanceof HTMLInputElement) {
      const type = element.type?.toLowerCase();
      if (!GROUPED_INPUT_TYPES.includes(type as any)) {
        return null; // Only for radio/checkbox
      }
    }
    
    // Find parent fieldset
    const fieldset = element.closest('fieldset');
    if (!fieldset) {
      return null;
    }
    
    // Find legend (must be first child of fieldset per HTML spec)
    const legend = fieldset.querySelector(':scope > legend');
    if (!legend) {
      return null;
    }
    
    const legendText = getVisibleText(legend);
    if (!legendText) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(legendText);
    if (!cleanedLabel) {
      return null;
    }
    
    // For individual radio/checkbox, try to get specific label too
    const specificLabel = this.getSpecificLabelForGroupedInput(element, options);
    
    let finalLabel = cleanedLabel;
    let confidence = ASSOCIATION_CONFIDENCE.FIELDSET_LEGEND;
    
    if (specificLabel) {
      // Combine: "Group Label: Specific Option"
      finalLabel = `${cleanedLabel}: ${specificLabel}`;
      confidence = Math.min(confidence + 0.05, 0.85); // Bonus for specific label
    }
    
    confidence = this.adjustConfidence(confidence, finalLabel, {
      lengthBonus: true,
      genericPenalty: true,
    });
    
    return this.createResult(finalLabel, legend, 'ancestor', {
      confidence,
      selector: 'fieldset > legend',
      xpath: this.getXPath(legend),
      metadata: {
        associationType: 'fieldset-legend',
        hasSpecificLabel: Boolean(specificLabel),
        specificLabel,
      },
    });
  }
  
  /**
   * Get specific label for radio/checkbox within group
   */
  private getSpecificLabelForGroupedInput(
    element: Element,
    options: LabelDetectionOptions
  ): string | null {
    // Try label[for]
    if (element.id) {
      const label = element.ownerDocument.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return cleanLabelText(this.getLabelText(label));
      }
    }
    
    // Try adjacent text/label
    const nextSibling = element.nextSibling;
    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      const text = nextSibling.textContent?.trim();
      if (text) {
        return cleanLabelText(text);
      }
    }
    
    // Try next element sibling
    const nextElement = element.nextElementSibling;
    if (nextElement) {
      if (nextElement.tagName.toLowerCase() === 'label') {
        return cleanLabelText(this.getLabelText(nextElement));
      }
      // Check for text in span/div
      if (['span', 'div', 'p'].includes(nextElement.tagName.toLowerCase())) {
        const text = nextElement.textContent?.trim();
        if (text && text.length < 50) {
          return cleanLabelText(text);
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // LABELS PROPERTY DETECTION
  // ==========================================================================
  
  /**
   * Detect via native labels property
   * 
   * Uses HTMLInputElement.labels which returns all associated labels
   */
  private detectViaLabelsProperty(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if element has labels property
    if (!('labels' in element)) {
      return null;
    }
    
    const labeledElement = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const labels = labeledElement.labels;
    
    if (!labels || labels.length === 0) {
      return null;
    }
    
    // Use first label
    const label = labels[0];
    const labelText = this.getLabelText(label);
    
    if (!labelText) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(labelText);
    if (!cleanedLabel) {
      return null;
    }
    
    // Determine confidence based on how label is associated
    let confidence = ASSOCIATION_CONFIDENCE.LABEL_FOR;
    
    // Check if it's explicit (for attribute) or implicit (wrapping)
    if (label.htmlFor && label.htmlFor === element.id) {
      // Explicit association - highest confidence
      confidence = ASSOCIATION_CONFIDENCE.LABEL_FOR;
    } else if (label.contains(element)) {
      // Implicit association - slightly lower
      confidence = ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL;
    }
    
    confidence = this.adjustConfidence(confidence, cleanedLabel, {
      lengthBonus: true,
      shortPenalty: true,
      genericPenalty: true,
    });
    
    return this.createResult(cleanedLabel, label, 'associated', {
      confidence,
      xpath: this.getXPath(label),
      metadata: {
        associationType: 'native-labels',
        labelCount: labels.length,
      },
    });
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Get text from label, excluding nested form controls
   */
  private getLabelText(label: Element, excludeElement?: Element): string {
    // Clone the label to manipulate
    const clone = label.cloneNode(true) as Element;
    
    // Remove nested form controls
    const controls = clone.querySelectorAll('input, select, textarea, button');
    controls.forEach(control => control.remove());
    
    // Get remaining text
    let text = getVisibleText(clone);
    
    // If we have an exclude element, try to remove its text
    if (excludeElement && !text) {
      text = this.getTextExcludingElement(label, excludeElement);
    }
    
    return text;
  }
  
  /**
   * Get text from element excluding a specific child
   */
  private getTextExcludingElement(parent: Element, exclude: Element): string {
    const texts: string[] = [];
    
    const walker = document.createTreeWalker(
      parent,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip if inside excluded element
          if (exclude.contains(node.parentNode as Node)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text) {
        texts.push(text);
      }
    }
    
    return texts.join(' ');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an AssociatedLabelDetector instance
 */
export function createAssociatedLabelDetector(): AssociatedLabelDetector {
  return new AssociatedLabelDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element has an associated label
 */
export function hasAssociatedLabel(element: Element): boolean {
  // Check for label[for]
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return true;
    }
  }
  
  // Check for ancestor label
  if (element.closest('label')) {
    return true;
  }
  
  // Check native labels property
  if ('labels' in element) {
    const labels = (element as HTMLInputElement).labels;
    if (labels && labels.length > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get all associated labels for an element
 */
export function getAssociatedLabels(element: Element): HTMLLabelElement[] {
  const labels: HTMLLabelElement[] = [];
  
  // Check label[for]
  if (element.id) {
    const forLabels = document.querySelectorAll(`label[for="${element.id}"]`);
    forLabels.forEach(label => {
      if (label instanceof HTMLLabelElement) {
        labels.push(label);
      }
    });
  }
  
  // Check ancestor labels
  let parent = element.parentElement;
  while (parent) {
    if (parent instanceof HTMLLabelElement) {
      if (!labels.includes(parent)) {
        labels.push(parent);
      }
    }
    parent = parent.parentElement;
  }
  
  // Check native labels property
  if ('labels' in element) {
    const nativeLabels = (element as HTMLInputElement).labels;
    if (nativeLabels) {
      for (const label of nativeLabels) {
        if (!labels.includes(label)) {
          labels.push(label);
        }
      }
    }
  }
  
  return labels;
}

/**
 * Check if element is labelable per HTML5 spec
 */
export function isLabelableElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return LABELABLE_ELEMENTS.includes(tagName as any);
}

/**
 * Get the labeled control for a label element
 */
export function getLabeledControl(label: HTMLLabelElement): Element | null {
  // Check for attribute
  if (label.htmlFor) {
    return document.getElementById(label.htmlFor);
  }
  
  // Check for nested control
  return label.querySelector('input, select, textarea, button');
}

/**
 * Get fieldset legend for an element
 */
export function getFieldsetLegend(element: Element): HTMLLegendElement | null {
  const fieldset = element.closest('fieldset');
  if (!fieldset) {
    return null;
  }
  
  const legend = fieldset.querySelector(':scope > legend');
  return legend instanceof HTMLLegendElement ? legend : null;
}
