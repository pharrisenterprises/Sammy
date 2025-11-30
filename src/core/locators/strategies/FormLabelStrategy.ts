/**
 * FormLabelStrategy - Locates form inputs by their associated label text
 * @module core/locators/strategies/FormLabelStrategy
 * @version 1.0.0
 * 
 * Locates form elements by finding their associated label and matching
 * the label text. Supports multiple label association methods:
 * - Explicit: <label for="inputId">
 * - Implicit: <label><input></label>
 * - ARIA: aria-labelledby reference
 * - Proximity: Nearest preceding label element
 * 
 * @see ILocatorStrategy for interface contract
 * @see locator-strategy_breakdown.md for strategy details
 * @see recording-engine_breakdown.md for label detection strategies
 */

import type { ILocatorStrategy, LocatorResult, LocatorContext } from './ILocatorStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';

// Polyfill CSS.escape for jsdom environments
if (typeof CSS === 'undefined' || !CSS.escape) {
  (globalThis as any).CSS = {
    escape: (value: string): string => {
      return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    },
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Strategy name identifier
 */
export const STRATEGY_NAME = 'form-label';

/**
 * Strategy priority in fallback chain
 */
export const STRATEGY_PRIORITY = 10;

/**
 * Base confidence score for form label matches (72%)
 */
export const BASE_CONFIDENCE = 0.72;

/**
 * Confidence bonus for explicit for-attribute association
 */
export const EXPLICIT_LABEL_BONUS = 0.10;

/**
 * Confidence bonus for implicit label wrapping
 */
export const IMPLICIT_LABEL_BONUS = 0.08;

/**
 * Confidence bonus for aria-labelledby association
 */
export const ARIA_LABEL_BONUS = 0.05;

/**
 * Confidence penalty for proximity-based (less reliable)
 */
export const PROXIMITY_PENALTY = 0.10;

/**
 * Confidence penalty for multiple matching inputs
 */
export const AMBIGUITY_PENALTY = 0.15;

/**
 * Confidence bonus when tag also matches
 */
export const TAG_MATCH_BONUS = 0.05;

/**
 * Minimum similarity for fuzzy label matching
 */
export const LABEL_SIMILARITY_THRESHOLD = 0.7;

/**
 * Maximum distance (in DOM nodes) for proximity search
 */
export const MAX_PROXIMITY_DISTANCE = 5;

/**
 * Form input elements that can have labels
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
 * Input types that typically have labels
 */
export const LABELED_INPUT_TYPES = [
  'text',
  'email',
  'password',
  'tel',
  'url',
  'number',
  'search',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'file',
  'checkbox',
  'radio',
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Label association type
 */
export type LabelAssociationType = 
  | 'explicit'      // <label for="id">
  | 'implicit'      // <label><input></label>
  | 'aria'          // aria-labelledby
  | 'proximity'     // nearest preceding label
  | 'none';

/**
 * Label association result
 */
export interface LabelAssociation {
  /** The label element */
  label: HTMLLabelElement | HTMLElement;
  /** Label text content */
  text: string;
  /** Association type */
  type: LabelAssociationType;
  /** The associated input element */
  input: HTMLElement;
  /** Confidence modifier based on association type */
  confidenceModifier: number;
}

/**
 * Input candidate with label info
 */
export interface LabeledInputCandidate {
  /** The input element */
  element: HTMLElement;
  /** Associated label text */
  labelText: string;
  /** Association type */
  associationType: LabelAssociationType;
  /** Text similarity score */
  similarity: number;
  /** Combined score for ranking */
  score: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes text for comparison
 * 
 * @param text - Raw text
 * @returns Normalized text
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[:\*]/g, ''); // Remove common label punctuation
}

/**
 * Calculates similarity between two strings using word overlap
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score 0-1
 */
export function textSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);
  
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;
  
  // Check containment
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length >= norm2.length ? norm1 : norm2;
    return shorter.length / longer.length;
  }
  
  // Word-based comparison
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 1));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 1));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  return (2 * overlap) / (words1.size + words2.size);
}

/**
 * Checks if an element is a labelable form element
 * 
 * @param element - Element to check
 * @returns True if element can have a label
 */
export function isLabelableElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  
  if (!LABELABLE_ELEMENTS.includes(tagName as typeof LABELABLE_ELEMENTS[number])) {
    return false;
  }
  
  if (tagName === 'input') {
    const inputType = (element as HTMLInputElement).type?.toLowerCase() || 'text';
    // Hidden and submit inputs typically don't have labels
    if (inputType === 'hidden' || inputType === 'submit' || inputType === 'reset') {
      return false;
    }
  }
  
  return true;
}

/**
 * Gets the label element associated with an input via `for` attribute
 * 
 * @param input - Input element
 * @param doc - Document to search
 * @returns Label element or null
 */
export function getExplicitLabel(
  input: HTMLElement,
  doc: Document
): HTMLLabelElement | null {
  if (!input.id) return null;
  
  const label = doc.querySelector(`label[for="${CSS.escape(input.id)}"]`);
  return label as HTMLLabelElement | null;
}

/**
 * Gets the label element that wraps an input (implicit association)
 * 
 * @param input - Input element
 * @returns Label element or null
 */
export function getImplicitLabel(input: HTMLElement): HTMLLabelElement | null {
  let parent = input.parentElement;
  
  while (parent) {
    if (parent.tagName.toLowerCase() === 'label') {
      return parent as HTMLLabelElement;
    }
    parent = parent.parentElement;
  }
  
  return null;
}

/**
 * Gets the element referenced by aria-labelledby
 * 
 * @param input - Input element
 * @param doc - Document to search
 * @returns Referenced element or null
 */
export function getAriaLabelElement(
  input: HTMLElement,
  doc: Document
): HTMLElement | null {
  const labelledBy = input.getAttribute('aria-labelledby');
  if (!labelledBy) return null;
  
  // Can be space-separated list of IDs
  const ids = labelledBy.split(/\s+/).filter(Boolean);
  if (ids.length === 0) return null;
  
  // Return first referenced element
  const element = doc.getElementById(ids[0]);
  return element;
}

/**
 * Gets the nearest preceding label element (proximity-based)
 * 
 * @param input - Input element
 * @param maxDistance - Maximum DOM distance to search
 * @returns Label element or null
 */
export function getProximityLabel(
  input: HTMLElement,
  maxDistance: number = MAX_PROXIMITY_DISTANCE
): HTMLLabelElement | null {
  let current: Node | null = input;
  let distance = 0;
  
  while (current && distance < maxDistance) {
    // Check previous sibling
    let sibling = current.previousSibling;
    
    while (sibling) {
      if (sibling instanceof HTMLLabelElement) {
        return sibling;
      }
      if (sibling instanceof HTMLElement) {
        // Check if sibling contains a label
        const label = sibling.querySelector('label');
        if (label) return label;
      }
      sibling = sibling.previousSibling;
      distance++;
      if (distance >= maxDistance) break;
    }
    
    // Move to parent
    current = current.parentNode;
    distance++;
  }
  
  return null;
}

/**
 * Gets all label associations for an input element
 * 
 * @param input - Input element
 * @param doc - Document to search
 * @returns Array of label associations
 */
export function getLabelAssociations(
  input: HTMLElement,
  doc: Document
): LabelAssociation[] {
  const associations: LabelAssociation[] = [];
  
  // Check explicit label (for attribute)
  const explicitLabel = getExplicitLabel(input, doc);
  if (explicitLabel) {
    associations.push({
      label: explicitLabel,
      text: explicitLabel.textContent || '',
      type: 'explicit',
      input,
      confidenceModifier: EXPLICIT_LABEL_BONUS,
    });
  }
  
  // Check implicit label (wrapping)
  const implicitLabel = getImplicitLabel(input);
  if (implicitLabel && implicitLabel !== explicitLabel) {
    // Get text excluding the input's own text
    const labelClone = implicitLabel.cloneNode(true) as HTMLElement;
    const inputsInLabel = labelClone.querySelectorAll('input, select, textarea');
    inputsInLabel.forEach(el => el.remove());
    
    associations.push({
      label: implicitLabel,
      text: labelClone.textContent || '',
      type: 'implicit',
      input,
      confidenceModifier: IMPLICIT_LABEL_BONUS,
    });
  }
  
  // Check aria-labelledby
  const ariaLabel = getAriaLabelElement(input, doc);
  if (ariaLabel) {
    associations.push({
      label: ariaLabel,
      text: ariaLabel.textContent || '',
      type: 'aria',
      input,
      confidenceModifier: ARIA_LABEL_BONUS,
    });
  }
  
  // Check proximity label (fallback)
  if (associations.length === 0) {
    const proximityLabel = getProximityLabel(input);
    if (proximityLabel) {
      associations.push({
        label: proximityLabel,
        text: proximityLabel.textContent || '',
        type: 'proximity',
        input,
        confidenceModifier: -PROXIMITY_PENALTY,
      });
    }
  }
  
  return associations;
}

/**
 * Gets the label text for an input element
 * 
 * @param input - Input element
 * @param doc - Document to search
 * @returns Label text and association type
 */
export function getInputLabelText(
  input: HTMLElement,
  doc: Document
): { text: string; type: LabelAssociationType } {
  const associations = getLabelAssociations(input, doc);
  
  if (associations.length === 0) {
    // Fall back to aria-label attribute
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) {
      return { text: ariaLabel, type: 'aria' };
    }
    
    // Fall back to placeholder
    const placeholder = (input as HTMLInputElement).placeholder;
    if (placeholder) {
      return { text: placeholder, type: 'none' };
    }
    
    return { text: '', type: 'none' };
  }
  
  // Return the best association (explicit > implicit > aria > proximity)
  return { text: associations[0].text, type: associations[0].type };
}

/**
 * Finds all form inputs with their label associations
 * 
 * @param doc - Document to search
 * @param tagFilter - Optional tag name filter
 * @returns Array of inputs with label info
 */
export function findLabeledInputs(
  doc: Document,
  tagFilter?: string
): Array<{ input: HTMLElement; labelText: string; type: LabelAssociationType }> {
  const results: Array<{ input: HTMLElement; labelText: string; type: LabelAssociationType }> = [];
  
  // Get all labelable elements
  let elements: HTMLElement[];
  if (tagFilter) {
    elements = Array.from(doc.getElementsByTagName(tagFilter)) as HTMLElement[];
  } else {
    elements = Array.from(
      doc.querySelectorAll(LABELABLE_ELEMENTS.join(','))
    ) as HTMLElement[];
  }
  
  for (const element of elements) {
    if (!isLabelableElement(element)) continue;
    
    const { text, type } = getInputLabelText(element, doc);
    if (text) {
      results.push({ input: element, labelText: text, type });
    }
  }
  
  return results;
}

/**
 * Finds input elements by matching label text
 * 
 * @param targetLabelText - Label text to search for
 * @param doc - Document to search
 * @param tagFilter - Optional tag name filter
 * @returns Array of candidates sorted by match quality
 */
export function findInputsByLabelText(
  targetLabelText: string,
  doc: Document,
  tagFilter?: string
): LabeledInputCandidate[] {
  const labeledInputs = findLabeledInputs(doc, tagFilter);
  const candidates: LabeledInputCandidate[] = [];
  
  const normalizedTarget = normalizeText(targetLabelText);
  if (!normalizedTarget) return candidates;
  
  for (const { input, labelText, type } of labeledInputs) {
    const similarity = textSimilarity(targetLabelText, labelText);
    
    if (similarity >= LABEL_SIMILARITY_THRESHOLD) {
      // Calculate score
      let score = similarity;
      
      // Bonus for association type
      if (type === 'explicit') score += 0.1;
      else if (type === 'implicit') score += 0.08;
      else if (type === 'aria') score += 0.05;
      else if (type === 'proximity') score -= 0.05;
      
      candidates.push({
        element: input,
        labelText,
        associationType: type,
        similarity,
        score,
      });
    }
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  return candidates;
}

// ============================================================================
// MAIN STRATEGY CLASS
// ============================================================================

/**
 * FormLabelStrategy implementation
 * 
 * Locates form input elements by finding matching label text.
 * Supports explicit (for attribute), implicit (wrapping), ARIA,
 * and proximity-based label associations.
 * 
 * @example
 * ```typescript
 * const strategy = new FormLabelStrategy();
 * const result = strategy.find(bundle, context);
 * if (result.element) {
 *   console.log(`Found input for label: ${result.metadata.matchedLabel}`);
 * }
 * ```
 */
export class FormLabelStrategy implements ILocatorStrategy {
  /**
   * Strategy name for logging and debugging
   */
  readonly name: string = STRATEGY_NAME;
  
  /**
   * Priority in fallback chain (lower = tried first)
   */
  readonly priority: number = STRATEGY_PRIORITY;
  
  /**
   * Base confidence score for this strategy
   */
  readonly baseConfidence: number = BASE_CONFIDENCE;
  
  /**
   * Determines if this strategy can attempt to find an element
   * based on the bundle contents.
   * 
   * @param bundle - LocatorBundle with recorded element data
   * @returns True if bundle has label-related data
   */
  canHandle(bundle: LocatorBundle): boolean {
    // Check if element is a labelable type
    if (bundle.tag) {
      const tag = bundle.tag.toLowerCase();
      if (!LABELABLE_ELEMENTS.includes(tag as typeof LABELABLE_ELEMENTS[number])) {
        return false;
      }
    }
    
    // Need some text that could be a label
    // Check aria-label
    if (bundle.aria && bundle.aria.trim().length > 0) return true;
    
    // Check text content (might be from label)
    if (bundle.text && bundle.text.trim().length > 0) return true;
    
    // Check placeholder (fallback label)
    if (bundle.placeholder && bundle.placeholder.trim().length > 0) return true;
    
    return false;
  }
  
  /**
   * Attempts to find an element by matching its label text
   * 
   * @param bundle - LocatorBundle containing label text to match
   * @param context - Locator context with document and options
   * @returns LocatorResult with element (if found) and confidence
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult {
    const startTime = performance.now();
    
    // Validate bundle
    if (!this.canHandle(bundle)) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'Bundle does not contain label-related data',
      };
    }
    
    const doc = context.document || document;
    
    // Determine target label text (priority: aria > text > placeholder)
    const targetLabel = bundle.aria || bundle.text || bundle.placeholder || '';
    
    if (!targetLabel.trim()) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'No label text to search for',
      };
    }
    
    try {
      // Find candidates by label text
      const candidates = findInputsByLabelText(targetLabel, doc, bundle.tag);
      
      if (candidates.length === 0) {
        return {
          element: null,
          confidence: 0,
          strategy: this.name,
          duration: performance.now() - startTime,
          error: `No inputs found with label matching "${targetLabel.substring(0, 50)}"`,
        };
      }
      
      // Select best candidate
      const best = candidates[0];
      
      // Calculate confidence
      const confidence = this.calculateConfidence(
        best,
        candidates.length,
        bundle
      );
      
      return {
        element: best.element,
        confidence,
        strategy: this.name,
        duration: performance.now() - startTime,
        metadata: {
          matchedLabel: best.labelText,
          associationType: best.associationType,
          similarity: best.similarity,
          candidateCount: candidates.length,
        },
      };
      
    } catch (error) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Calculates confidence score based on match quality
   * 
   * @param candidate - Best matching candidate
   * @param candidateCount - Total candidates found
   * @param bundle - Original bundle for additional matching
   * @returns Confidence score 0-1
   */
  private calculateConfidence(
    candidate: LabeledInputCandidate,
    candidateCount: number,
    bundle: LocatorBundle
  ): number {
    let confidence = BASE_CONFIDENCE;
    
    // Association type modifiers
    switch (candidate.associationType) {
      case 'explicit':
        confidence += EXPLICIT_LABEL_BONUS;
        break;
      case 'implicit':
        confidence += IMPLICIT_LABEL_BONUS;
        break;
      case 'aria':
        confidence += ARIA_LABEL_BONUS;
        break;
      case 'proximity':
        confidence -= PROXIMITY_PENALTY;
        break;
    }
    
    // Similarity modifier
    if (candidate.similarity >= 0.95) {
      confidence += 0.05;
    } else if (candidate.similarity < 0.8) {
      confidence -= 0.05;
    }
    
    // Ambiguity penalty
    if (candidateCount > 1) {
      const penalty = Math.min(
        AMBIGUITY_PENALTY,
        AMBIGUITY_PENALTY * (candidateCount - 1) * 0.4
      );
      confidence -= penalty;
    }
    
    // Tag match bonus
    if (bundle.tag && 
        candidate.element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      confidence += TAG_MATCH_BONUS;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Gets the label text for an element
   * Used during recording to capture label association
   * 
   * @param element - Element to get label for
   * @returns Label text or null
   */
  generateSelector(element: HTMLElement): string | null {
    if (!isLabelableElement(element)) return null;
    
    const { text, type } = getInputLabelText(element, element.ownerDocument);
    
    if (!text || type === 'none') return null;
    
    return text.trim();
  }
  
  /**
   * Validates that an element has expected label text
   * 
   * @param element - Element to validate
   * @param expectedLabel - Expected label text
   * @returns True if label matches
   */
  validate(element: HTMLElement, expectedLabel: string): boolean {
    if (!isLabelableElement(element)) return false;
    
    const { text } = getInputLabelText(element, element.ownerDocument);
    
    return textSimilarity(text, expectedLabel) >= LABEL_SIMILARITY_THRESHOLD;
  }
  
  /**
   * Gets the association type for an element's label
   * 
   * @param element - Element to check
   * @returns Association type
   */
  getAssociationType(element: HTMLElement): LabelAssociationType {
    const { type } = getInputLabelText(element, element.ownerDocument);
    return type;
  }
  
  /**
   * Finds all inputs with a specific label text
   * 
   * @param labelText - Label text to search for
   * @param doc - Document to search
   * @returns Array of matching elements
   */
  findByLabel(labelText: string, doc: Document): HTMLElement[] {
    const candidates = findInputsByLabelText(labelText, doc);
    return candidates.map(c => c.element);
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of FormLabelStrategy
 */
let instance: FormLabelStrategy | null = null;

/**
 * Gets or creates the FormLabelStrategy singleton
 * 
 * @returns FormLabelStrategy instance
 */
export function getFormLabelStrategy(): FormLabelStrategy {
  if (!instance) {
    instance = new FormLabelStrategy();
  }
  return instance;
}

/**
 * Creates a new FormLabelStrategy instance (for testing)
 * 
 * @returns New FormLabelStrategy instance
 */
export function createFormLabelStrategy(): FormLabelStrategy {
  return new FormLabelStrategy();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default FormLabelStrategy;
