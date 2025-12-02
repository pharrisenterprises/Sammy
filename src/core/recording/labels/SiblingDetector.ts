/**
 * SiblingDetector - Sibling Element Label Detection
 * @module core/recording/labels/SiblingDetector
 * @version 1.0.0
 * 
 * Detects labels from sibling elements using DOM proximity.
 * This is a fallback strategy when more specific detectors fail.
 * 
 * ## Confidence Scores
 * - Previous sibling label/span: 0.60
 * - Next sibling label: 0.55
 * - Previous text node: 0.50
 * - Wrapper sibling: 0.55
 * 
 * ## Detection Strategy
 * 1. Check immediate previous siblings (elements and text nodes)
 * 2. Check immediate next siblings (less common pattern)
 * 3. Check parent's siblings (wrapper patterns)
 * 4. Apply distance-based confidence adjustments
 * 
 * @see ILabelDetector for interface contract
 */

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  DETECTOR_PRIORITIES,
  CONFIDENCE_SCORES,
  cleanLabelText,
  getVisibleText,
} from './ILabelDetector';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for sibling patterns
 */
export const SIBLING_CONFIDENCE = {
  /** Previous sibling label element */
  PREVIOUS_LABEL: 0.60,
  
  /** Previous sibling span/div with text */
  PREVIOUS_TEXT_ELEMENT: 0.60,
  
  /** Next sibling label element */
  NEXT_LABEL: 0.55,
  
  /** Previous sibling text node */
  PREVIOUS_TEXT_NODE: 0.50,
  
  /** Wrapper parent's sibling */
  WRAPPER_SIBLING: 0.55,
  
  /** Table cell sibling (th/td) */
  TABLE_CELL: 0.60,
  
  /** Minimum confidence floor */
  MINIMUM: 0.25,
} as const;

/**
 * Elements that can serve as labels
 */
export const LABEL_ELEMENTS = [
  'label',
  'span',
  'div',
  'p',
  'strong',
  'b',
  'em',
  'i',
  'small',
  'legend',
  'th',
  'dt',
] as const;

/**
 * Interactive elements to skip when traversing
 */
export const INTERACTIVE_ELEMENTS = [
  'input',
  'select',
  'textarea',
  'button',
  'a',
  'video',
  'audio',
  'iframe',
  'object',
  'embed',
] as const;

/**
 * Wrapper elements that may contain label siblings
 */
export const WRAPPER_ELEMENTS = [
  'div',
  'span',
  'p',
  'td',
  'li',
  'dd',
] as const;

/**
 * Maximum characters for a valid sibling label
 */
export const MAX_LABEL_LENGTH = 100;

/**
 * Maximum siblings to check in each direction
 */
export const MAX_SIBLINGS_TO_CHECK = 5;

/**
 * Maximum parent levels to check for wrapper pattern
 */
export const MAX_WRAPPER_LEVELS = 3;

// ============================================================================
// SIBLING DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from sibling elements
 * 
 * @example
 * ```typescript
 * const detector = new SiblingDetector();
 * 
 * // <label>Email</label>
 * // <input type="text">
 * const input = document.querySelector('input');
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Email'
 * // result.confidence === 0.60
 * ```
 */
export class SiblingDetector extends BaseLabelDetector {
  constructor() {
    super(
      'sibling',
      DETECTOR_PRIORITIES.PROXIMITY,
      CONFIDENCE_SCORES.SIBLING,
      'Detects labels from sibling elements using DOM proximity'
    );
  }
  
  /**
   * Check if element has potential sibling labels
   */
  canDetect(context: LabelDetectionContext): boolean {
    const { element } = context;
    
    // Must have a parent node
    if (!element.parentNode) {
      return false;
    }
    
    // Check if there are any siblings
    const parent = element.parentNode;
    return parent.childNodes.length > 1;
  }
  
  /**
   * Detect label from sibling elements
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element } = context;
    
    // Try previous sibling elements first (most common pattern)
    const previousResult = this.detectPreviousSibling(element, options);
    if (previousResult) {
      return previousResult;
    }
    
    // Try previous text nodes
    const textNodeResult = this.detectPreviousTextNode(element, options);
    if (textNodeResult) {
      return textNodeResult;
    }
    
    // Try table cell pattern
    const tableCellResult = this.detectTableCellLabel(element, options);
    if (tableCellResult) {
      return tableCellResult;
    }
    
    // Try next sibling (less common)
    const nextResult = this.detectNextSibling(element, options);
    if (nextResult) {
      return nextResult;
    }
    
    // Try wrapper sibling pattern
    const wrapperResult = this.detectWrapperSibling(element, options);
    if (wrapperResult) {
      return wrapperResult;
    }
    
    return null;
  }
  
  // ==========================================================================
  // PREVIOUS SIBLING DETECTION
  // ==========================================================================
  
  /**
   * Detect label from previous sibling elements
   */
  private detectPreviousSibling(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    let sibling = element.previousElementSibling;
    let distance = 0;
    
    while (sibling && distance < MAX_SIBLINGS_TO_CHECK) {
      distance++;
      
      // Skip interactive elements
      if (this.isInteractiveElement(sibling)) {
        sibling = sibling.previousElementSibling;
        continue;
      }
      
      // Skip hidden elements
      if (this.isHidden(sibling)) {
        sibling = sibling.previousElementSibling;
        continue;
      }
      
      // Check if sibling is a label element type
      if (this.isLabelElement(sibling)) {
        const result = this.extractLabelFromElement(sibling, distance, 'previous');
        if (result) {
          return result;
        }
      }
      
      // Check if sibling contains a label-like child
      const labelChild = this.findLabelChild(sibling);
      if (labelChild) {
        const result = this.extractLabelFromElement(labelChild, distance, 'previous-nested');
        if (result) {
          return result;
        }
      }
      
      sibling = sibling.previousElementSibling;
    }
    
    return null;
  }
  
  /**
   * Detect label from previous text nodes
   */
  private detectPreviousTextNode(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const parent = element.parentNode;
    if (!parent) {
      return null;
    }
    
    // Get all child nodes
    const children = Array.from(parent.childNodes);
    const elementIndex = children.indexOf(element);
    
    if (elementIndex <= 0) {
      return null;
    }
    
    // Walk backwards looking for text nodes
    for (let i = elementIndex - 1; i >= 0 && i >= elementIndex - MAX_SIBLINGS_TO_CHECK; i--) {
      const node = children[i];
      
      // Check text nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text && text.length > 0 && text.length <= MAX_LABEL_LENGTH) {
          const cleanedLabel = this.cleanTextNodeLabel(text);
          if (cleanedLabel) {
            const distance = elementIndex - i;
            const confidence = this.calculateConfidence(
              SIBLING_CONFIDENCE.PREVIOUS_TEXT_NODE,
              distance,
              cleanedLabel
            );
            
            return this.createResult(cleanedLabel, element, 'proximity', {
              confidence,
              metadata: {
                siblingType: 'text-node',
                direction: 'previous',
                distance,
              },
            });
          }
        }
      }
      
      // Stop at interactive elements
      if (node.nodeType === Node.ELEMENT_NODE && 
          this.isInteractiveElement(node as Element)) {
        break;
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // NEXT SIBLING DETECTION
  // ==========================================================================
  
  /**
   * Detect label from next sibling elements (less common pattern)
   */
  private detectNextSibling(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    let sibling = element.nextElementSibling;
    let distance = 0;
    
    while (sibling && distance < MAX_SIBLINGS_TO_CHECK) {
      distance++;
      
      // Skip interactive elements
      if (this.isInteractiveElement(sibling)) {
        sibling = sibling.nextElementSibling;
        continue;
      }
      
      // Skip hidden elements
      if (this.isHidden(sibling)) {
        sibling = sibling.nextElementSibling;
        continue;
      }
      
      // Only accept explicit label elements for next sibling
      const tag = sibling.tagName.toLowerCase();
      if (tag === 'label' || tag === 'span') {
        const result = this.extractLabelFromElement(sibling, distance, 'next');
        if (result) {
          // Reduce confidence for next sibling (less common pattern)
          return {
            ...result,
            confidence: Math.max(
              result.confidence - 0.05,
              SIBLING_CONFIDENCE.MINIMUM
            ),
          };
        }
      }
      
      sibling = sibling.nextElementSibling;
    }
    
    return null;
  }
  
  // ==========================================================================
  // TABLE CELL DETECTION
  // ==========================================================================
  
  /**
   * Detect label from table header or adjacent cell
   * 
   * Pattern: <tr>
   *            <th>Name</th>
   *            <td><input></td>
   *          </tr>
   */
  private detectTableCellLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if in a table cell
    const cell = element.closest('td, th');
    if (!cell) {
      return null;
    }
    
    const row = cell.closest('tr');
    if (!row) {
      return null;
    }
    
    // Get cell index
    const cells = Array.from(row.querySelectorAll('td, th'));
    const cellIndex = cells.indexOf(cell);
    
    // Check previous cell
    if (cellIndex > 0) {
      const prevCell = cells[cellIndex - 1];
      if (prevCell && !this.hasInteractiveChild(prevCell)) {
        const text = getVisibleText(prevCell);
        if (text && text.length <= MAX_LABEL_LENGTH) {
          const cleanedLabel = cleanLabelText(text);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              SIBLING_CONFIDENCE.TABLE_CELL,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, prevCell, 'proximity', {
              confidence,
              xpath: this.getXPath(prevCell),
              metadata: {
                siblingType: 'table-cell',
                direction: 'previous',
                cellIndex,
              },
            });
          }
        }
      }
    }
    
    // Check for header row
    const table = row.closest('table');
    if (table && cellIndex >= 0) {
      const headerRow = table.querySelector('thead tr, tr:first-child');
      if (headerRow && headerRow !== row) {
        const headers = Array.from(headerRow.querySelectorAll('th, td'));
        const header = headers[cellIndex];
        if (header) {
          const text = getVisibleText(header);
          if (text && text.length <= MAX_LABEL_LENGTH) {
            const cleanedLabel = cleanLabelText(text);
            if (cleanedLabel) {
              const confidence = this.adjustConfidence(
                SIBLING_CONFIDENCE.TABLE_CELL - 0.05, // Slightly lower for header
                cleanedLabel,
                {
                  lengthBonus: true,
                  genericPenalty: true,
                }
              );
              
              return this.createResult(cleanedLabel, header, 'proximity', {
                confidence,
                xpath: this.getXPath(header),
                metadata: {
                  siblingType: 'table-header',
                  direction: 'column',
                  cellIndex,
                },
              });
            }
          }
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // WRAPPER SIBLING DETECTION
  // ==========================================================================
  
  /**
   * Detect label from wrapper parent's sibling
   * 
   * Pattern: <div>
   *            <span>Label</span>
   *            <div><input></div>
   *          </div>
   */
  private detectWrapperSibling(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    let current: Element | null = element;
    let level = 0;
    
    while (current && level < MAX_WRAPPER_LEVELS) {
      const parent = current.parentElement;
      if (!parent) {
        break;
      }
      
      // Check if parent is a wrapper element
      const parentTag = parent.tagName.toLowerCase();
      if (!WRAPPER_ELEMENTS.includes(parentTag as any)) {
        current = parent;
        level++;
        continue;
      }
      
      // Look for label sibling of the wrapper
      let sibling = current.previousElementSibling;
      let distance = 0;
      
      while (sibling && distance < 3) {
        distance++;
        
        if (this.isInteractiveElement(sibling)) {
          sibling = sibling.previousElementSibling;
          continue;
        }
        
        if (this.isLabelElement(sibling)) {
          const text = getVisibleText(sibling);
          if (text && text.length <= MAX_LABEL_LENGTH) {
            const cleanedLabel = cleanLabelText(text);
            if (cleanedLabel) {
              const confidence = this.calculateConfidence(
                SIBLING_CONFIDENCE.WRAPPER_SIBLING,
                distance + level, // Account for wrapper depth
                cleanedLabel
              );
              
              return this.createResult(cleanedLabel, sibling, 'proximity', {
                confidence,
                xpath: this.getXPath(sibling),
                metadata: {
                  siblingType: 'wrapper-sibling',
                  direction: 'previous',
                  wrapperLevel: level,
                  distance,
                },
              });
            }
          }
        }
        
        sibling = sibling.previousElementSibling;
      }
      
      current = parent;
      level++;
    }
    
    return null;
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Extract label from an element
   */
  private extractLabelFromElement(
    element: Element,
    distance: number,
    direction: string
  ): LabelDetectionResult | null {
    const text = getVisibleText(element);
    if (!text || text.length > MAX_LABEL_LENGTH) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    const tag = element.tagName.toLowerCase();
    const baseConfidence = tag === 'label' 
      ? SIBLING_CONFIDENCE.PREVIOUS_LABEL
      : SIBLING_CONFIDENCE.PREVIOUS_TEXT_ELEMENT;
    
    const confidence = this.calculateConfidence(baseConfidence, distance, cleanedLabel);
    
    return this.createResult(cleanedLabel, element, 'proximity', {
      confidence,
      selector: this.buildSelector(element),
      xpath: this.getXPath(element),
      metadata: {
        siblingType: tag,
        direction,
        distance,
      },
    });
  }
  
  /**
   * Calculate confidence with distance penalty
   */
  private calculateConfidence(
    baseConfidence: number,
    distance: number,
    label: string
  ): number {
    let confidence = baseConfidence;
    
    // Distance penalty: -0.05 per sibling away
    confidence -= (distance - 1) * 0.05;
    
    // Apply standard adjustments
    confidence = this.adjustConfidence(confidence, label, {
      lengthBonus: true,
      genericPenalty: true,
    });
    
    // Ensure minimum
    return Math.max(confidence, SIBLING_CONFIDENCE.MINIMUM);
  }
  
  /**
   * Check if element is an interactive element
   */
  private isInteractiveElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    return INTERACTIVE_ELEMENTS.includes(tag as any);
  }
  
  /**
   * Check if element has an interactive child
   */
  private hasInteractiveChild(element: Element): boolean {
    for (const tag of INTERACTIVE_ELEMENTS) {
      if (element.querySelector(tag)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check if element is a label-like element
   */
  private isLabelElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    return LABEL_ELEMENTS.includes(tag as any);
  }
  
  /**
   * Check if element is hidden
   */
  private isHidden(element: Element): boolean {
    // Check for hidden attribute
    if (element.hasAttribute('hidden')) {
      return true;
    }
    
    // Check for aria-hidden
    if (element.getAttribute('aria-hidden') === 'true') {
      return true;
    }
    
    // Check computed style if available
    if (typeof getComputedStyle === 'function') {
      try {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return true;
        }
      } catch {
        // Ignore style errors
      }
    }
    
    return false;
  }
  
  /**
   * Find a label-like child element
   */
  private findLabelChild(element: Element): Element | null {
    // Don't look in elements with many children (likely containers)
    if (element.children.length > 5) {
      return null;
    }
    
    for (const tag of ['label', 'span', 'strong', 'b']) {
      const child = element.querySelector(tag);
      if (child && !this.hasInteractiveChild(child)) {
        const text = getVisibleText(child);
        if (text && text.length > 0 && text.length <= MAX_LABEL_LENGTH) {
          return child;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Clean text from a text node label
   */
  private cleanTextNodeLabel(text: string): string | null {
    // Remove trailing colons, asterisks
    let cleaned = text.replace(/[:*]+$/, '').trim();
    
    // Skip if too short
    if (cleaned.length < 2) {
      return null;
    }
    
    return cleanLabelText(cleaned);
  }
  
  /**
   * Build a simple selector for an element
   */
  private buildSelector(element: Element): string {
    const tag = element.tagName.toLowerCase();
    
    if (element.id) {
      return `${tag}#${element.id}`;
    }
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0) {
        return `${tag}.${classes.join('.')}`;
      }
    }
    
    return tag;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a SiblingDetector instance
 */
export function createSiblingDetector(): SiblingDetector {
  return new SiblingDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the previous sibling label for an element
 */
export function getPreviousSiblingLabel(element: Element): string | null {
  const detector = new SiblingDetector();
  const result = (detector as any).detectPreviousSibling(element, {});
  return result?.label || null;
}

/**
 * Get the previous text node content
 */
export function getPreviousTextNode(element: Element): string | null {
  const parent = element.parentNode;
  if (!parent) {
    return null;
  }
  
  const children = Array.from(parent.childNodes);
  const elementIndex = children.indexOf(element);
  
  if (elementIndex <= 0) {
    return null;
  }
  
  for (let i = elementIndex - 1; i >= 0; i--) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        return text;
      }
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      break;
    }
  }
  
  return null;
}

/**
 * Check if element has a sibling that could be a label
 */
export function hasSiblingLabel(element: Element): boolean {
  const prev = element.previousElementSibling;
  if (prev) {
    const tag = prev.tagName.toLowerCase();
    if (LABEL_ELEMENTS.includes(tag as any)) {
      return true;
    }
  }
  
  // Check for text node
  const parent = element.parentNode;
  if (parent) {
    const children = Array.from(parent.childNodes);
    const index = children.indexOf(element);
    if (index > 0) {
      const prevNode = children[index - 1];
      if (prevNode.nodeType === Node.TEXT_NODE && prevNode.textContent?.trim()) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get table header for a cell
 */
export function getTableHeaderForCell(cell: Element): string | null {
  const row = cell.closest('tr');
  const table = cell.closest('table');
  
  if (!row || !table) {
    return null;
  }
  
  const cells = Array.from(row.querySelectorAll('td, th'));
  const cellIndex = cells.indexOf(cell);
  
  if (cellIndex < 0) {
    return null;
  }
  
  const headerRow = table.querySelector('thead tr, tr:first-child');
  if (headerRow && headerRow !== row) {
    const headers = Array.from(headerRow.querySelectorAll('th, td'));
    const header = headers[cellIndex];
    if (header) {
      return getVisibleText(header) || null;
    }
  }
  
  return null;
}
