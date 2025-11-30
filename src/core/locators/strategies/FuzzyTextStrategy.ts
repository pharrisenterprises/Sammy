/**
 * FuzzyTextStrategy - Locates elements by fuzzy text content matching
 * @module core/locators/strategies/FuzzyTextStrategy
 * @version 1.0.0
 * 
 * Tier 7 in the 9-tier fallback chain with 40% base confidence.
 * Uses Dice coefficient (word set comparison) to match element text
 * content against the recorded bundle text. This is a fallback strategy
 * for when more reliable identifiers (ID, name, data-attrs) are unavailable.
 * 
 * @see ILocatorStrategy for interface contract
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { ILocatorStrategy, LocatorResult, LocatorContext } from './ILocatorStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Strategy name identifier
 */
export const STRATEGY_NAME = 'fuzzy-text';

/**
 * Strategy priority in fallback chain (lower = higher priority)
 * Tier 7: After Data Attributes (tier 6), before Bounding Box (tier 8)
 */
export const STRATEGY_PRIORITY = 7;

/**
 * Base confidence score for fuzzy text matches (40%)
 * Low confidence because text content is volatile and may change
 */
export const BASE_CONFIDENCE = 0.40;

/**
 * Minimum similarity threshold for a match (40%)
 * Elements with similarity below this are rejected
 */
export const SIMILARITY_THRESHOLD = 0.40;

/**
 * High similarity threshold for confidence boost (80%)
 */
export const HIGH_SIMILARITY_THRESHOLD = 0.80;

/**
 * Exact match threshold (95%+)
 */
export const EXACT_MATCH_THRESHOLD = 0.95;

/**
 * Confidence boost for high similarity matches
 */
export const HIGH_SIMILARITY_BONUS = 0.15;

/**
 * Confidence boost for exact matches
 */
export const EXACT_MATCH_BONUS = 0.25;

/**
 * Confidence penalty for ambiguous matches (multiple candidates)
 */
export const AMBIGUITY_PENALTY = 0.10;

/**
 * Maximum text length to consider (longer text is truncated)
 */
export const MAX_TEXT_LENGTH = 500;

/**
 * Minimum text length for meaningful comparison
 */
export const MIN_TEXT_LENGTH = 2;

/**
 * Elements to skip when scanning for text (typically containers)
 */
export const SKIP_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'head',
  'meta',
  'link',
] as const;

/**
 * Elements that typically contain meaningful clickable/input text
 */
export const PRIORITY_TAGS = [
  'button',
  'a',
  'label',
  'span',
  'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li',
  'td', 'th',
  'option',
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of text similarity comparison
 */
export interface SimilarityResult {
  /** Similarity score 0-1 */
  score: number;
  /** Whether threshold was met */
  isMatch: boolean;
  /** Normalized target text */
  normalizedTarget: string;
  /** Normalized candidate text */
  normalizedCandidate: string;
  /** Word overlap details */
  wordOverlap: {
    common: string[];
    targetOnly: string[];
    candidateOnly: string[];
  };
}

/**
 * Candidate element with similarity score
 */
export interface TextCandidate {
  /** DOM element */
  element: HTMLElement;
  /** Text content of element */
  text: string;
  /** Similarity score */
  similarity: number;
  /** Whether this is a priority tag */
  isPriorityTag: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes text for comparison
 * - Trims whitespace
 * - Collapses multiple spaces
 * - Converts to lowercase
 * - Removes punctuation (optional)
 * - Truncates to max length
 * 
 * @param text - Raw text content
 * @param removePunctuation - Whether to strip punctuation
 * @returns Normalized text
 */
export function normalizeText(
  text: string | null | undefined,
  removePunctuation = false
): string {
  if (!text) return '';
  
  let normalized = text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .substring(0, MAX_TEXT_LENGTH);
  
  if (removePunctuation) {
    normalized = normalized.replace(/[^\w\s]/g, '');
  }
  
  return normalized;
}

/**
 * Extracts words from text for set comparison
 * 
 * @param text - Normalized text
 * @returns Array of unique words
 */
export function extractWords(text: string): string[] {
  if (!text) return [];
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= MIN_TEXT_LENGTH);
  
  // Return unique words
  return [...new Set(words)];
}

/**
 * Calculates Dice coefficient between two word sets
 * Formula: 2 * |intersection| / (|set1| + |set2|)
 * 
 * @param words1 - First word set
 * @param words2 - Second word set
 * @returns Dice coefficient 0-1
 */
export function diceCoefficient(words1: string[], words2: string[]): number {
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  let intersectionSize = 0;
  for (const word of set1) {
    if (set2.has(word)) {
      intersectionSize++;
    }
  }
  
  return (2 * intersectionSize) / (set1.size + set2.size);
}

/**
 * Calculates character-level similarity using bigrams
 * Useful for short strings where word-based comparison fails
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score 0-1
 */
export function bigramSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const getBigrams = (s: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(str1.toLowerCase());
  const bigrams2 = getBigrams(str2.toLowerCase());
  
  if (bigrams1.size === 0 && bigrams2.size === 0) return 1;
  if (bigrams1.size === 0 || bigrams2.size === 0) return 0;
  
  let intersectionSize = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersectionSize++;
    }
  }
  
  return (2 * intersectionSize) / (bigrams1.size + bigrams2.size);
}

/**
 * Compares two text strings using combined similarity metrics
 * 
 * @param target - Target text to find
 * @param candidate - Candidate text to compare
 * @returns SimilarityResult with score and details
 */
export function compareText(target: string, candidate: string): SimilarityResult {
  const normalizedTarget = normalizeText(target);
  const normalizedCandidate = normalizeText(candidate);
  
  // Handle empty strings
  if (!normalizedTarget || !normalizedCandidate) {
    return {
      score: 0,
      isMatch: false,
      normalizedTarget,
      normalizedCandidate,
      wordOverlap: { common: [], targetOnly: [], candidateOnly: [] },
    };
  }
  
  // Exact match check
  if (normalizedTarget === normalizedCandidate) {
    const words = extractWords(normalizedTarget);
    return {
      score: 1,
      isMatch: true,
      normalizedTarget,
      normalizedCandidate,
      wordOverlap: { common: words, targetOnly: [], candidateOnly: [] },
    };
  }
  
  // Extract words for comparison
  const targetWords = extractWords(normalizedTarget);
  const candidateWords = extractWords(normalizedCandidate);
  
  // Calculate word-based similarity (Dice coefficient)
  const wordSimilarity = diceCoefficient(targetWords, candidateWords);
  
  // For short strings, also use bigram similarity
  let score = wordSimilarity;
  if (normalizedTarget.length < 20 || normalizedCandidate.length < 20) {
    const charSimilarity = bigramSimilarity(normalizedTarget, normalizedCandidate);
    // Weight: 60% word-based, 40% character-based for short strings
    score = wordSimilarity * 0.6 + charSimilarity * 0.4;
  }
  
  // Calculate word overlap details
  const targetSet = new Set(targetWords);
  const candidateSet = new Set(candidateWords);
  
  const common = targetWords.filter(w => candidateSet.has(w));
  const targetOnly = targetWords.filter(w => !candidateSet.has(w));
  const candidateOnly = candidateWords.filter(w => !targetSet.has(w));
  
  return {
    score,
    isMatch: score >= SIMILARITY_THRESHOLD,
    normalizedTarget,
    normalizedCandidate,
    wordOverlap: { common, targetOnly, candidateOnly },
  };
}

/**
 * Gets the visible text content of an element
 * Excludes text from hidden elements and script/style tags
 * 
 * @param element - DOM element
 * @returns Visible text content
 */
export function getVisibleText(element: Element): string {
  // Check if element is visible
  if (element instanceof HTMLElement) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return '';
    }
  }
  
  // Skip certain tags
  const tagName = element.tagName.toLowerCase();
  if (SKIP_TAGS.includes(tagName as typeof SKIP_TAGS[number])) {
    return '';
  }
  
  // For input elements, use value or placeholder
  if (tagName === 'input') {
    const input = element as HTMLInputElement;
    return input.value || input.placeholder || '';
  }
  
  // For textarea, use value
  if (tagName === 'textarea') {
    return (element as HTMLTextAreaElement).value || '';
  }
  
  // Get text content, preferring innerText for visible text
  if (element instanceof HTMLElement) {
    return element.innerText || element.textContent || '';
  }
  
  return element.textContent || '';
}

/**
 * Checks if an element is a priority tag for text matching
 * 
 * @param element - DOM element
 * @returns True if element is a priority tag
 */
export function isPriorityTag(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return PRIORITY_TAGS.includes(tagName as typeof PRIORITY_TAGS[number]);
}

/**
 * Scans document for elements with similar text content
 * 
 * @param targetText - Text to search for
 * @param doc - Document to search
 * @param tagFilter - Optional tag name filter
 * @returns Array of candidates sorted by similarity
 */
export function findTextCandidates(
  targetText: string,
  doc: Document,
  tagFilter?: string
): TextCandidate[] {
  const candidates: TextCandidate[] = [];
  const normalizedTarget = normalizeText(targetText);
  
  if (!normalizedTarget || normalizedTarget.length < MIN_TEXT_LENGTH) {
    return candidates;
  }
  
  // Determine which elements to scan
  let elements: Element[];
  if (tagFilter) {
    elements = Array.from(doc.getElementsByTagName(tagFilter));
  } else {
    // Start with priority tags, then fall back to all elements
    elements = [
      ...Array.from(doc.querySelectorAll(PRIORITY_TAGS.join(','))),
    ];
    
    // If no matches in priority tags, scan more broadly
    if (elements.length === 0) {
      elements = Array.from(doc.body?.getElementsByTagName('*') || []);
    }
  }
  
  // Score each element
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    
    const text = getVisibleText(element);
    if (!text || text.length < MIN_TEXT_LENGTH) continue;
    
    const comparison = compareText(normalizedTarget, text);
    
    if (comparison.isMatch) {
      candidates.push({
        element,
        text,
        similarity: comparison.score,
        isPriorityTag: isPriorityTag(element),
      });
    }
  }
  
  // Sort by similarity (descending), then by priority tag
  candidates.sort((a, b) => {
    if (Math.abs(a.similarity - b.similarity) > 0.05) {
      return b.similarity - a.similarity;
    }
    // Prefer priority tags when similarity is close
    if (a.isPriorityTag && !b.isPriorityTag) return -1;
    if (!a.isPriorityTag && b.isPriorityTag) return 1;
    return 0;
  });
  
  return candidates;
}

// ============================================================================
// MAIN STRATEGY CLASS
// ============================================================================

/**
 * FuzzyTextStrategy implementation
 * 
 * Locates elements by comparing their text content against the recorded
 * text in the LocatorBundle using fuzzy matching (Dice coefficient).
 * This is a fallback strategy with lower confidence due to text volatility.
 * 
 * @example
 * ```typescript
 * const strategy = new FuzzyTextStrategy();
 * const result = strategy.find(bundle, document);
 * if (result.element) {
 *   console.log(`Found with ${result.confidence} confidence`);
 * }
 * ```
 */
export class FuzzyTextStrategy implements ILocatorStrategy {
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
   * Minimum similarity threshold
   */
  readonly similarityThreshold: number = SIMILARITY_THRESHOLD;
  
  /**
   * Determines if this strategy can attempt to find an element
   * based on the bundle contents.
   * 
   * @param bundle - LocatorBundle with recorded element data
   * @returns True if bundle has usable text content
   */
  canHandle(bundle: LocatorBundle): boolean {
    const text = normalizeText(bundle.text);
    return text.length >= MIN_TEXT_LENGTH;
  }
  
  /**
   * Attempts to find an element matching the bundle's text content
   * 
   * @param bundle - LocatorBundle containing text to match
   * @param context - Locator context with document and options
   * @returns LocatorResult with element (if found) and confidence
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult {
    const startTime = performance.now();
    
    // Validate bundle has text
    if (!this.canHandle(bundle)) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'Bundle has insufficient text content',
      };
    }
    
    const doc = context.document || document;
    const targetText = bundle.text;
    
    try {
      // Find candidates with similar text
      const candidates = findTextCandidates(targetText, doc, bundle.tag);
      
      if (candidates.length === 0) {
        // Try without tag filter as fallback
        const fallbackCandidates = bundle.tag
          ? findTextCandidates(targetText, doc)
          : [];
        
        if (fallbackCandidates.length === 0) {
          return {
            element: null,
            confidence: 0,
            strategy: this.name,
            duration: performance.now() - startTime,
            error: 'No elements with matching text found',
          };
        }
        
        return this.selectBestCandidate(fallbackCandidates, bundle, startTime);
      }
      
      return this.selectBestCandidate(candidates, bundle, startTime);
      
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
   * Selects the best candidate from a list of matches
   * 
   * @param candidates - Sorted list of text candidates
   * @param bundle - Original LocatorBundle
   * @param startTime - Performance timing start
   * @returns LocatorResult with best match
   */
  private selectBestCandidate(
    candidates: TextCandidate[],
    bundle: LocatorBundle,
    startTime: number
  ): LocatorResult {
    if (candidates.length === 0) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'No candidates provided',
      };
    }
    
    // Score candidates with additional criteria
    const scored = candidates.map(candidate => ({
      ...candidate,
      totalScore: this.scoreCandidate(candidate, bundle),
    }));
    
    // Re-sort by total score
    scored.sort((a, b) => b.totalScore - a.totalScore);
    
    const best = scored[0];
    const runnerUp = scored[1];
    
    // Check ambiguity
    const isAmbiguous = runnerUp && 
      Math.abs(best.totalScore - runnerUp.totalScore) < 0.1;
    
    const confidence = this.calculateConfidence(
      best.similarity,
      candidates.length,
      isAmbiguous,
      best.isPriorityTag
    );
    
    return {
      element: best.element,
      confidence,
      strategy: this.name,
      duration: performance.now() - startTime,
      metadata: {
        similarity: best.similarity,
        candidateCount: candidates.length,
        isAmbiguous,
        isPriorityTag: best.isPriorityTag,
        matchedText: best.text.substring(0, 100),
      },
    };
  }
  
  /**
   * Scores a candidate using multiple criteria
   * 
   * @param candidate - Text candidate
   * @param bundle - Original LocatorBundle
   * @returns Combined score 0-1
   */
  private scoreCandidate(candidate: TextCandidate, bundle: LocatorBundle): number {
    let score = candidate.similarity * 0.6; // Text similarity is primary factor
    
    // Tag match bonus
    if (bundle.tag && candidate.element.tagName.toLowerCase() === bundle.tag.toLowerCase()) {
      score += 0.15;
    }
    
    // Priority tag bonus
    if (candidate.isPriorityTag) {
      score += 0.05;
    }
    
    // Bounding box proximity bonus
    if (bundle.bounding) {
      const rect = candidate.element.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(rect.x - bundle.bounding.x, 2) +
        Math.pow(rect.y - bundle.bounding.y, 2)
      );
      
      if (distance < 50) {
        score += 0.15;
      } else if (distance < 100) {
        score += 0.10;
      } else if (distance < 200) {
        score += 0.05;
      }
    }
    
    // Class overlap bonus
    if (bundle.classes && bundle.classes.length > 0) {
      const elementClasses = Array.from(candidate.element.classList);
      const overlap = bundle.classes.filter(c => elementClasses.includes(c)).length;
      if (overlap > 0) {
        score += Math.min(0.1, overlap * 0.03);
      }
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Calculates final confidence score
   * 
   * @param similarity - Text similarity score
   * @param candidateCount - Number of matching elements
   * @param isAmbiguous - Whether match is ambiguous
   * @param isPriorityTag - Whether element is a priority tag
   * @returns Confidence score 0-1
   */
  private calculateConfidence(
    similarity: number,
    candidateCount: number,
    isAmbiguous: boolean,
    isPriorityTag: boolean
  ): number {
    let confidence = BASE_CONFIDENCE;
    
    // Similarity-based adjustments
    if (similarity >= EXACT_MATCH_THRESHOLD) {
      confidence += EXACT_MATCH_BONUS;
    } else if (similarity >= HIGH_SIMILARITY_THRESHOLD) {
      confidence += HIGH_SIMILARITY_BONUS;
    } else {
      // Scale confidence with similarity for lower matches
      const scaleFactor = (similarity - SIMILARITY_THRESHOLD) / 
        (HIGH_SIMILARITY_THRESHOLD - SIMILARITY_THRESHOLD);
      confidence += HIGH_SIMILARITY_BONUS * Math.max(0, scaleFactor);
    }
    
    // Penalty for multiple candidates
    if (candidateCount > 1) {
      confidence -= AMBIGUITY_PENALTY * Math.min(candidateCount - 1, 3) * 0.33;
    }
    
    // Additional penalty for ambiguous top candidates
    if (isAmbiguous) {
      confidence -= AMBIGUITY_PENALTY;
    }
    
    // Small bonus for priority tags
    if (isPriorityTag) {
      confidence += 0.03;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Generates a text-based description for an element
   * Used during recording to capture text content
   * 
   * @param element - Element to describe
   * @returns Text content or null
   */
  generateSelector(element: HTMLElement): string | null {
    const text = getVisibleText(element);
    if (!text || text.length < MIN_TEXT_LENGTH) return null;
    
    // Return normalized text (not a CSS selector for this strategy)
    return normalizeText(text).substring(0, 100);
  }
  
  /**
   * Validates that an element's text matches expected text
   * 
   * @param element - Element to validate
   * @param expectedValue - Expected text content
   * @returns True if text similarity meets threshold
   */
  validate(element: HTMLElement, expectedValue: string): boolean {
    const actualText = getVisibleText(element);
    const comparison = compareText(expectedValue, actualText);
    return comparison.isMatch;
  }
  
  /**
   * Gets the similarity score between element text and target
   * 
   * @param element - Element to check
   * @param targetText - Target text to compare
   * @returns Similarity score 0-1
   */
  getSimilarity(element: HTMLElement, targetText: string): number {
    const actualText = getVisibleText(element);
    const comparison = compareText(targetText, actualText);
    return comparison.score;
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of FuzzyTextStrategy
 */
let instance: FuzzyTextStrategy | null = null;

/**
 * Gets or creates the FuzzyTextStrategy singleton
 * 
 * @returns FuzzyTextStrategy instance
 */
export function getFuzzyTextStrategy(): FuzzyTextStrategy {
  if (!instance) {
    instance = new FuzzyTextStrategy();
  }
  return instance;
}

/**
 * Creates a new FuzzyTextStrategy instance (for testing)
 * 
 * @returns New FuzzyTextStrategy instance
 */
export function createFuzzyTextStrategy(): FuzzyTextStrategy {
  return new FuzzyTextStrategy();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default FuzzyTextStrategy;
