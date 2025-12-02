/**
 * TextContentDetector - Text Content Fallback Label Detection
 * @module core/recording/labels/TextContentDetector
 * @version 1.0.0
 * 
 * Fallback detector that extracts labels from text content.
 * Used when more reliable strategies (ARIA, label[for], etc.) fail.
 * 
 * ## Confidence Scores (Low - Fallback)
 * - Name attribute: 0.65 (reasonable identifier)
 * - Value attribute: 0.55 (for buttons)
 * - Previous sibling text: 0.50 (proximity-based)
 * - Element text content: 0.40 (often unreliable)
 * - Parent text content: 0.35 (very uncertain)
 * 
 * ## Filtering
 * - Excludes generic/meaningless text
 * - Filters out script/style content
 * - Limits text length
 * - Excludes text from nested interactive elements
 * 
 * @see ILabelDetector for interface contract
 */

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  DETECTOR_PRIORITIES,
  cleanLabelText,
  isGenericLabel,
  getVisibleText,
  isElementVisible,
} from './ILabelDetector';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for text content sources
 */
export const TEXT_CONTENT_CONFIDENCE = {
  /** Name attribute */
  NAME_ATTRIBUTE: 0.65,
  
  /** Value attribute (buttons) */
  VALUE_ATTRIBUTE: 0.55,
  
  /** Title attribute */
  TITLE_ATTRIBUTE: 0.50,
  
  /** Previous sibling text node */
  PREVIOUS_TEXT: 0.50,
  
  /** Element's own text content */
  SELF_TEXT: 0.40,
  
  /** Parent element text */
  PARENT_TEXT: 0.35,
  
  /** Minimum confidence floor */
  MINIMUM: 0.15,
} as const;

/**
 * Maximum text length to consider as label
 */
export const MAX_LABEL_LENGTH = 100;

/**
 * Minimum text length for valid label
 */
export const MIN_LABEL_LENGTH = 2;

/**
 * Elements to exclude when extracting text
 */
export const EXCLUDED_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'video',
  'audio',
  'iframe',
  'object',
  'embed',
] as const;

/**
 * Interactive elements whose text should be excluded from parent extraction
 */
export const INTERACTIVE_TAGS = [
  'input',
  'select',
  'textarea',
  'button',
  'a',
] as const;

/**
 * Patterns that indicate non-label text
 */
export const NON_LABEL_PATTERNS = [
  /^\d+$/,                    // Just numbers
  /^[.\-_\s]+$/,              // Just punctuation
  /^https?:\/\//i,            // URLs
  /^[a-f0-9-]{32,}$/i,        // UUIDs/hashes
  /^\s*$/,                    // Whitespace only
  /^(true|false|null|undefined)$/i, // Programming literals
  /^[\[\]{}()<>]+$/,          // Brackets only
] as const;

/**
 * Common non-label words to filter
 */
export const NON_LABEL_WORDS = [
  'loading',
  'please wait',
  'error',
  'success',
  'warning',
  'info',
  'close',
  'dismiss',
  'ok',
  'cancel',
  'yes',
  'no',
  'more',
  'less',
  'show',
  'hide',
  'expand',
  'collapse',
] as const;

// ============================================================================
// TEXT CONTENT DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from text content as fallback
 * 
 * @example
 * ```typescript
 * const detector = new TextContentDetector();
 * 
 * // Button with text
 * const button = document.createElement('button');
 * button.textContent = 'Submit Order';
 * 
 * const context = createDetectionContext(button);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Submit Order'
 * // result.confidence === 0.40
 * ```
 */
export class TextContentDetector extends BaseLabelDetector {
  constructor() {
    super(
      'text-content',
      DETECTOR_PRIORITIES.TEXT_CONTENT,
      TEXT_CONTENT_CONFIDENCE.SELF_TEXT,
      'Fallback detector that extracts labels from text content',
    );
  }
  
  /**
   * Check if element might have text-based label
   * 
   * This detector can attempt detection on any element,
   * but returns false for elements that definitely won't have useful text.
   */
  canDetect(context: LabelDetectionContext): boolean {
    const element = context.element;
    const tagName = element.tagName.toLowerCase();
    
    // Exclude certain element types
    if (EXCLUDED_TAGS.includes(tagName as any)) {
      return false;
    }
    
    // Hidden inputs have no visible text
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type?.toLowerCase();
      if (type === 'hidden') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Detect label from text content sources
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element } = context;
    
    // Try name attribute first (higher confidence)
    const nameResult = this.detectNameAttribute(element, options);
    if (nameResult) {
      return nameResult;
    }
    
    // Try value attribute (for buttons/inputs)
    const valueResult = this.detectValueAttribute(element, options);
    if (valueResult) {
      return valueResult;
    }
    
    // Try title attribute
    const titleResult = this.detectTitleAttribute(element, options);
    if (titleResult) {
      return titleResult;
    }
    
    // Try previous sibling text
    const siblingResult = this.detectPreviousSiblingText(element, options);
    if (siblingResult) {
      return siblingResult;
    }
    
    // Try element's own text content
    const selfResult = this.detectSelfText(element, options);
    if (selfResult) {
      return selfResult;
    }
    
    // Try parent text as last resort
    const parentResult = this.detectParentText(element, options);
    if (parentResult) {
      return parentResult;
    }
    
    return null;
  }
  
  // ==========================================================================
  // NAME ATTRIBUTE DETECTION
  // ==========================================================================
  
  /**
   * Detect label from name attribute
   * 
   * Name attributes often contain meaningful identifiers like
   * "email", "firstName", "phone_number"
   */
  private detectNameAttribute(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const name = element.getAttribute('name');
    if (!name) {
      return null;
    }
    
    // Convert name to human-readable label
    const label = this.nameToLabel(name);
    if (!label || !this.isValidLabel(label)) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      TEXT_CONTENT_CONFIDENCE.NAME_ATTRIBUTE,
      label,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(label, element, 'attribute', {
      attribute: 'name',
      confidence,
      metadata: {
        originalName: name,
        transformed: label !== name,
      },
    });
  }
  
  /**
   * Convert name attribute to human-readable label
   * 
   * "firstName" -> "First Name"
   * "email_address" -> "Email Address"
   * "phone-number" -> "Phone Number"
   */
  private nameToLabel(name: string): string {
    // Skip if it looks like a generated ID
    if (/^[a-z0-9]{20,}$/i.test(name)) {
      return '';
    }
    
    // Skip if it's just numbers or special chars
    if (/^[\d_\-\[\]]+$/.test(name)) {
      return '';
    }
    
    // Split on common separators
    let words = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase
      .replace(/[_\-\.]+/g, ' ')             // snake_case, kebab-case
      .replace(/\[\d+\]/g, '')               // array indices [0]
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    // Capitalize each word
    words = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    
    return words.join(' ').trim();
  }
  
  // ==========================================================================
  // VALUE ATTRIBUTE DETECTION
  // ==========================================================================
  
  /**
   * Detect label from value attribute
   * 
   * Useful for buttons: <input type="submit" value="Submit">
   */
  private detectValueAttribute(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Only for button-type inputs
    if (element.tagName.toLowerCase() !== 'input') {
      return null;
    }
    
    const input = element as HTMLInputElement;
    const type = input.type?.toLowerCase();
    
    // Only for button types
    if (!['submit', 'reset', 'button'].includes(type)) {
      return null;
    }
    
    const value = input.value;
    if (!value || !this.isValidLabel(value)) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(value);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      TEXT_CONTENT_CONFIDENCE.VALUE_ATTRIBUTE,
      cleanedLabel,
      {
        lengthBonus: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, element, 'attribute', {
      attribute: 'value',
      confidence,
      metadata: {
        inputType: type,
      },
    });
  }
  
  // ==========================================================================
  // TITLE ATTRIBUTE DETECTION
  // ==========================================================================
  
  /**
   * Detect label from title attribute
   */
  private detectTitleAttribute(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const title = element.getAttribute('title');
    if (!title) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(title);
    if (!cleanedLabel || !this.isValidLabel(cleanedLabel)) {
      return null;
    }
    
    // Title is often a tooltip, lower confidence
    const confidence = this.adjustConfidence(
      TEXT_CONTENT_CONFIDENCE.TITLE_ATTRIBUTE,
      cleanedLabel,
      {
        lengthBonus: true,
        genericPenalty: true,
      }
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
  // PREVIOUS SIBLING TEXT DETECTION
  // ==========================================================================
  
  /**
   * Detect label from previous sibling text nodes
   * 
   * Pattern: "Label: " <input>
   */
  private detectPreviousSiblingText(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check previous sibling node (could be text node)
    let sibling = element.previousSibling;
    
    while (sibling) {
      // Text node
      if (sibling.nodeType === Node.TEXT_NODE) {
        const text = sibling.textContent?.trim();
        if (text && this.isValidLabel(text)) {
          const cleanedLabel = cleanLabelText(text);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              TEXT_CONTENT_CONFIDENCE.PREVIOUS_TEXT,
              cleanedLabel,
              {
                lengthBonus: true,
                shortPenalty: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, null, 'sibling', {
              confidence,
              metadata: {
                sourceType: 'text-node',
                position: 'previous',
              },
            });
          }
        }
      }
      
      // Element node - check if it's a simple text container
      if (sibling.nodeType === Node.ELEMENT_NODE) {
        const sibElement = sibling as Element;
        const tagName = sibElement.tagName.toLowerCase();
        
        // Skip interactive elements
        if (INTERACTIVE_TAGS.includes(tagName as any)) {
          break;
        }
        
        // Check simple text containers (span, div, p, etc.)
        if (['span', 'div', 'p', 'strong', 'b', 'em', 'i', 'small'].includes(tagName)) {
          const text = getVisibleText(sibElement);
          if (text && text.length <= 50 && this.isValidLabel(text)) {
            const cleanedLabel = cleanLabelText(text);
            if (cleanedLabel) {
              const confidence = this.adjustConfidence(
                TEXT_CONTENT_CONFIDENCE.PREVIOUS_TEXT - 0.05, // Slightly lower for elements
                cleanedLabel,
                {
                  lengthBonus: true,
                  genericPenalty: true,
                }
              );
              
              return this.createResult(cleanedLabel, sibElement, 'sibling', {
                confidence,
                xpath: this.getXPath(sibElement),
                metadata: {
                  sourceType: 'element',
                  sourceTag: tagName,
                },
              });
            }
          }
        }
        
        break; // Stop at first element sibling
      }
      
      sibling = sibling.previousSibling;
    }
    
    return null;
  }
  
  // ==========================================================================
  // SELF TEXT DETECTION
  // ==========================================================================
  
  /**
   * Detect label from element's own text content
   */
  private detectSelfText(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const tagName = element.tagName.toLowerCase();
    
    // For form inputs, text content is usually not the label
    if (['input', 'select', 'textarea'].includes(tagName)) {
      return null;
    }
    
    // Get text, excluding nested interactive elements
    const text = this.getElementText(element);
    if (!text || !this.isValidLabel(text)) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    // Adjust confidence based on element type
    let baseConfidence = TEXT_CONTENT_CONFIDENCE.SELF_TEXT;
    
    // Higher confidence for button-like elements
    if (['button', 'a'].includes(tagName)) {
      baseConfidence += 0.10;
    }
    
    // Higher confidence for headings
    if (/^h[1-6]$/.test(tagName)) {
      baseConfidence += 0.05;
    }
    
    const confidence = this.adjustConfidence(
      baseConfidence,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, element, 'text-content', {
      confidence,
      metadata: {
        elementTag: tagName,
      },
    });
  }
  
  /**
   * Get text from element, excluding nested interactive elements
   */
  private getElementText(element: Element): string {
    // Clone to manipulate
    const clone = element.cloneNode(true) as Element;
    
    // Remove interactive elements
    INTERACTIVE_TAGS.forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => el.remove());
    });
    
    // Remove excluded tags
    EXCLUDED_TAGS.forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => el.remove());
    });
    
    // Get remaining text
    const text = clone.textContent || '';
    
    // Normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  }
  
  // ==========================================================================
  // PARENT TEXT DETECTION
  // ==========================================================================
  
  /**
   * Detect label from parent element text
   * 
   * Last resort - very low confidence
   */
  private detectParentText(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const parent = element.parentElement;
    if (!parent) {
      return null;
    }
    
    const tagName = parent.tagName.toLowerCase();
    
    // Skip if parent is a large container
    if (['body', 'html', 'main', 'article', 'section', 'form'].includes(tagName)) {
      return null;
    }
    
    // Get parent text, excluding the target element
    const text = this.getParentTextExcluding(parent, element);
    if (!text || !this.isValidLabel(text)) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      TEXT_CONTENT_CONFIDENCE.PARENT_TEXT,
      cleanedLabel,
      {
        lengthBonus: true,
        shortPenalty: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, parent, 'ancestor', {
      confidence,
      xpath: this.getXPath(parent),
      metadata: {
        parentTag: tagName,
      },
    });
  }
  
  /**
   * Get parent text excluding a specific child element
   */
  private getParentTextExcluding(parent: Element, exclude: Element): string {
    const texts: string[] = [];
    
    for (const child of parent.childNodes) {
      // Skip the excluded element
      if (child === exclude || (child instanceof Element && child.contains(exclude))) {
        continue;
      }
      
      // Skip interactive elements
      if (child instanceof Element) {
        const tagName = child.tagName.toLowerCase();
        if (INTERACTIVE_TAGS.includes(tagName as any)) {
          continue;
        }
        if (EXCLUDED_TAGS.includes(tagName as any)) {
          continue;
        }
      }
      
      const text = child.textContent?.trim();
      if (text && text.length > 0 && text.length <= 50) {
        texts.push(text);
      }
    }
    
    return texts.join(' ').trim();
  }
  
  // ==========================================================================
  // VALIDATION
  // ==========================================================================
  
  /**
   * Check if text is a valid label
   */
  private isValidLabel(text: string): boolean {
    // Check length
    if (text.length < MIN_LABEL_LENGTH || text.length > MAX_LABEL_LENGTH) {
      return false;
    }
    
    // Check against non-label patterns
    for (const pattern of NON_LABEL_PATTERNS) {
      if (pattern.test(text)) {
        return false;
      }
    }
    
    // Check against non-label words
    const normalized = text.toLowerCase().trim();
    if (NON_LABEL_WORDS.includes(normalized as any)) {
      return false;
    }
    
    // Check generic label
    if (isGenericLabel(text)) {
      return false;
    }
    
    return true;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a TextContentDetector instance
 */
export function createTextContentDetector(): TextContentDetector {
  return new TextContentDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract visible text from element
 */
export function extractVisibleText(element: Element): string {
  const detector = new TextContentDetector();
  return (detector as any).getElementText(element);
}

/**
 * Convert attribute name to human-readable label
 */
export function nameToHumanLabel(name: string): string {
  const detector = new TextContentDetector();
  return (detector as any).nameToLabel(name);
}

/**
 * Check if text is suitable as a label
 */
export function isValidLabelText(text: string): boolean {
  const detector = new TextContentDetector();
  return (detector as any).isValidLabel(text);
}

/**
 * Get text from previous sibling elements
 */
export function getPreviousSiblingText(element: Element): string | null {
  let sibling = element.previousSibling;
  
  while (sibling) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const text = sibling.textContent?.trim();
      if (text && text.length >= MIN_LABEL_LENGTH && text.length <= MAX_LABEL_LENGTH) {
        return text;
      }
    }
    sibling = sibling.previousSibling;
  }
  
  return null;
}
