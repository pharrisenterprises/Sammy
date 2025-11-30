/**
 * BoundingBoxStrategy - Locates elements by spatial coordinate proximity
 * @module core/locators/strategies/BoundingBoxStrategy
 * @version 1.0.0
 * 
 * Tier 8 (last resort) in the 9-tier fallback chain with 35% base confidence.
 * Uses Euclidean distance from recorded bounding box coordinates to find
 * the nearest matching element. This strategy is used when all identifier-based
 * strategies fail, relying purely on spatial positioning.
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
export const STRATEGY_NAME = 'bounding-box';

/**
 * Strategy priority in fallback chain (lower = higher priority)
 * Tier 8: Last resort before retry cycle
 */
export const STRATEGY_PRIORITY = 8;

/**
 * Base confidence score for bounding box matches (35%)
 * Low confidence because positions can change with layout shifts
 */
export const BASE_CONFIDENCE = 0.35;

/**
 * Maximum distance in pixels for a valid match (200px)
 */
export const MAX_DISTANCE_THRESHOLD = 200;

/**
 * Distance for high confidence match (within 50px)
 */
export const HIGH_CONFIDENCE_DISTANCE = 50;

/**
 * Distance for medium confidence match (within 100px)
 */
export const MEDIUM_CONFIDENCE_DISTANCE = 100;

/**
 * Confidence bonus for very close matches (< 50px)
 */
export const CLOSE_MATCH_BONUS = 0.20;

/**
 * Confidence bonus for medium distance matches (< 100px)
 */
export const MEDIUM_MATCH_BONUS = 0.10;

/**
 * Confidence bonus when tag matches
 */
export const TAG_MATCH_BONUS = 0.10;

/**
 * Confidence bonus when dimensions are similar
 */
export const SIZE_MATCH_BONUS = 0.05;

/**
 * Confidence penalty for multiple close candidates
 */
export const AMBIGUITY_PENALTY = 0.10;

/**
 * Minimum element dimension to be considered (filters tiny elements)
 */
export const MIN_ELEMENT_SIZE = 5;

/**
 * Maximum candidates to evaluate (performance limit)
 */
export const MAX_CANDIDATES = 100;

/**
 * Tolerance for size comparison (percentage)
 */
export const SIZE_TOLERANCE = 0.3; // 30%

// ============================================================================
// TYPES
// ============================================================================

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Element with distance and scoring information
 */
export interface SpatialCandidate {
  /** DOM element */
  element: HTMLElement;
  /** Bounding rectangle */
  rect: DOMRect;
  /** Euclidean distance from target */
  distance: number;
  /** Center point distance */
  centerDistance: number;
  /** Whether tag matches bundle */
  tagMatch: boolean;
  /** Whether size is similar */
  sizeMatch: boolean;
  /** Combined score for ranking */
  score: number;
}

/**
 * Result of spatial search
 */
export interface SpatialSearchResult {
  /** Best matching candidate */
  best: SpatialCandidate | null;
  /** All candidates within threshold */
  candidates: SpatialCandidate[];
  /** Whether match is ambiguous */
  isAmbiguous: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates Euclidean distance between two points
 * 
 * @param x1 - First point X
 * @param y1 - First point Y
 * @param x2 - Second point X
 * @param y2 - Second point Y
 * @returns Distance in pixels
 */
export function euclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Gets the center point of a bounding box
 * 
 * @param box - Bounding box or DOMRect
 * @returns Center coordinates
 */
export function getCenter(box: BoundingBox | DOMRect): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Calculates distance between two bounding boxes
 * Uses closest edge distance, not center distance
 * 
 * @param box1 - First bounding box
 * @param box2 - Second bounding box
 * @returns Minimum distance between boxes
 */
export function boxDistance(box1: BoundingBox, box2: BoundingBox | DOMRect): number {
  // Calculate horizontal distance
  let dx = 0;
  if (box2.x + box2.width < box1.x) {
    dx = box1.x - (box2.x + box2.width);
  } else if (box1.x + box1.width < box2.x) {
    dx = box2.x - (box1.x + box1.width);
  }
  
  // Calculate vertical distance
  let dy = 0;
  if (box2.y + box2.height < box1.y) {
    dy = box1.y - (box2.y + box2.height);
  } else if (box1.y + box1.height < box2.y) {
    dy = box2.y - (box1.y + box1.height);
  }
  
  // If boxes overlap, distance is 0
  if (dx === 0 && dy === 0) return 0;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if two bounding boxes have similar dimensions
 * 
 * @param box1 - First bounding box
 * @param box2 - Second bounding box
 * @param tolerance - Size tolerance (0-1)
 * @returns True if sizes are similar
 */
export function sizesMatch(
  box1: BoundingBox,
  box2: BoundingBox | DOMRect,
  tolerance: number = SIZE_TOLERANCE
): boolean {
  const widthRatio = Math.min(box1.width, box2.width) / Math.max(box1.width, box2.width);
  const heightRatio = Math.min(box1.height, box2.height) / Math.max(box1.height, box2.height);
  
  return widthRatio >= (1 - tolerance) && heightRatio >= (1 - tolerance);
}

/**
 * Checks if an element is visible and potentially interactable
 * 
 * @param element - DOM element to check
 * @returns True if element is visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  // Check computed style
  const style = window.getComputedStyle(element);
  
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  
  // Check dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) {
    return false;
  }
  
  // Check if in viewport (with some margin)
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 100;
  
  if (rect.right < -margin || rect.left > viewportWidth + margin) {
    return false;
  }
  if (rect.bottom < -margin || rect.top > viewportHeight + margin) {
    return false;
  }
  
  return true;
}

/**
 * Checks if an element is interactable (can receive clicks/input)
 * 
 * @param element - DOM element to check
 * @returns True if element is interactable
 */
export function isElementInteractable(element: HTMLElement): boolean {
  // Check if disabled
  if ((element as HTMLButtonElement).disabled) {
    return false;
  }
  
  // Check pointer-events
  const style = window.getComputedStyle(element);
  if (style.pointerEvents === 'none') {
    return false;
  }
  
  return true;
}

/**
 * Gets all potentially matchable elements from a document
 * 
 * @param doc - Document to search
 * @param tagFilter - Optional tag name filter
 * @returns Array of visible elements
 */
export function getVisibleElements(
  doc: Document,
  tagFilter?: string
): HTMLElement[] {
  let elements: HTMLElement[];
  
  if (tagFilter) {
    elements = Array.from(doc.getElementsByTagName(tagFilter)) as HTMLElement[];
  } else {
    elements = Array.from(doc.body?.getElementsByTagName('*') || []) as HTMLElement[];
  }
  
  // Filter to visible and interactable elements
  return elements.filter(el => {
    if (!(el instanceof HTMLElement)) return false;
    if (!isElementVisible(el)) return false;
    return true;
  }).slice(0, MAX_CANDIDATES * 2); // Pre-limit for performance
}

/**
 * Finds elements near a target bounding box
 * 
 * @param targetBox - Target bounding box coordinates
 * @param doc - Document to search
 * @param tagFilter - Optional tag name filter
 * @param maxDistance - Maximum distance threshold
 * @returns Array of candidates sorted by distance
 */
export function findNearbyElements(
  targetBox: BoundingBox,
  doc: Document,
  tagFilter?: string,
  maxDistance: number = MAX_DISTANCE_THRESHOLD
): SpatialCandidate[] {
  const elements = getVisibleElements(doc, tagFilter);
  const targetCenter = getCenter(targetBox);
  const candidates: SpatialCandidate[] = [];
  
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    
    // Skip elements that are too small
    if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) {
      continue;
    }
    
    // Calculate distances
    const distance = boxDistance(targetBox, rect);
    const elementCenter = getCenter(rect);
    const centerDistance = euclideanDistance(
      targetCenter.x,
      targetCenter.y,
      elementCenter.x,
      elementCenter.y
    );
    
    // Skip if too far
    if (distance > maxDistance) {
      continue;
    }
    
    // Check tag and size match
    const tagMatch = tagFilter 
      ? element.tagName.toLowerCase() === tagFilter.toLowerCase()
      : true;
    const sizeMatch = sizesMatch(targetBox, rect);
    
    // Calculate score (lower is better)
    let score = distance;
    if (tagMatch) score -= 20;
    if (sizeMatch) score -= 10;
    
    candidates.push({
      element,
      rect,
      distance,
      centerDistance,
      tagMatch,
      sizeMatch,
      score,
    });
  }
  
  // Sort by score (lower is better), then by distance
  candidates.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 5) {
      return a.score - b.score;
    }
    return a.distance - b.distance;
  });
  
  return candidates.slice(0, MAX_CANDIDATES);
}

/**
 * Performs spatial search for best matching element
 * 
 * @param targetBox - Target bounding box
 * @param doc - Document to search
 * @param tagFilter - Optional tag filter
 * @returns Search result with best match and candidates
 */
export function spatialSearch(
  targetBox: BoundingBox,
  doc: Document,
  tagFilter?: string
): SpatialSearchResult {
  const candidates = findNearbyElements(targetBox, doc, tagFilter);
  
  if (candidates.length === 0) {
    // Try without tag filter if no matches
    if (tagFilter) {
      const fallbackCandidates = findNearbyElements(targetBox, doc);
      if (fallbackCandidates.length > 0) {
        return {
          best: fallbackCandidates[0],
          candidates: fallbackCandidates,
          isAmbiguous: fallbackCandidates.length > 1 && 
            fallbackCandidates[1].distance - fallbackCandidates[0].distance < 20,
        };
      }
    }
    
    return {
      best: null,
      candidates: [],
      isAmbiguous: false,
    };
  }
  
  // Check for ambiguity (multiple candidates very close in distance)
  const isAmbiguous = candidates.length > 1 &&
    candidates[1].distance - candidates[0].distance < 20;
  
  return {
    best: candidates[0],
    candidates,
    isAmbiguous,
  };
}

// ============================================================================
// MAIN STRATEGY CLASS
// ============================================================================

/**
 * BoundingBoxStrategy implementation
 * 
 * Locates elements by finding the nearest element to the recorded
 * bounding box coordinates. This is a last-resort strategy used when
 * all identifier-based strategies fail.
 * 
 * @example
 * ```typescript
 * const strategy = new BoundingBoxStrategy();
 * const result = strategy.find(bundle, document);
 * if (result.element) {
 *   console.log(`Found element ${result.metadata.distance}px away`);
 * }
 * ```
 */
export class BoundingBoxStrategy implements ILocatorStrategy {
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
   * Maximum distance threshold for matches
   */
  readonly maxDistance: number = MAX_DISTANCE_THRESHOLD;
  
  /**
   * Determines if this strategy can attempt to find an element
   * based on the bundle contents.
   * 
   * @param bundle - LocatorBundle with recorded element data
   * @returns True if bundle has valid bounding box data
   */
  canHandle(bundle: LocatorBundle): boolean {
    if (!bundle.bounding) return false;
    
    const { x, y, width, height } = bundle.bounding;
    
    // Validate coordinates are reasonable
    if (typeof x !== 'number' || typeof y !== 'number') return false;
    if (typeof width !== 'number' || typeof height !== 'number') return false;
    if (width < MIN_ELEMENT_SIZE || height < MIN_ELEMENT_SIZE) return false;
    
    // Coordinates should be non-negative (visible area)
    if (x < -1000 || y < -1000) return false;
    
    return true;
  }
  
  /**
   * Attempts to find an element near the bundle's bounding box coordinates
   * 
   * @param bundle - LocatorBundle containing bounding box to match
   * @param context - Locator context with document and options
   * @returns LocatorResult with element (if found) and confidence
   */
  find(bundle: LocatorBundle, context: LocatorContext): LocatorResult {
    const startTime = performance.now();
    
    // Validate bundle has bounding box
    if (!this.canHandle(bundle)) {
      return {
        element: null,
        confidence: 0,
        strategy: this.name,
        duration: performance.now() - startTime,
        error: 'Bundle has invalid or missing bounding box data',
      };
    }
    
    const doc = context.document || document;
    const targetBox = bundle.bounding!;
    
    try {
      // Perform spatial search
      const searchResult = spatialSearch(targetBox, doc, bundle.tag);
      
      if (!searchResult.best) {
        return {
          element: null,
          confidence: 0,
          strategy: this.name,
          duration: performance.now() - startTime,
          error: `No elements found within ${this.maxDistance}px of target`,
        };
      }
      
      const best = searchResult.best;
      
      // Calculate confidence based on distance and other factors
      const confidence = this.calculateConfidence(
        best,
        searchResult.candidates.length,
        searchResult.isAmbiguous
      );
      
      return {
        element: best.element,
        confidence,
        strategy: this.name,
        duration: performance.now() - startTime,
        metadata: {
          distance: Math.round(best.distance),
          centerDistance: Math.round(best.centerDistance),
          tagMatch: best.tagMatch,
          sizeMatch: best.sizeMatch,
          candidateCount: searchResult.candidates.length,
          isAmbiguous: searchResult.isAmbiguous,
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
   * @param isAmbiguous - Whether match is ambiguous
   * @returns Confidence score 0-1
   */
  private calculateConfidence(
    candidate: SpatialCandidate,
    candidateCount: number,
    isAmbiguous: boolean
  ): number {
    let confidence = BASE_CONFIDENCE;
    
    // Distance-based adjustments
    if (candidate.distance < HIGH_CONFIDENCE_DISTANCE) {
      confidence += CLOSE_MATCH_BONUS;
    } else if (candidate.distance < MEDIUM_CONFIDENCE_DISTANCE) {
      confidence += MEDIUM_MATCH_BONUS;
    } else {
      // Reduce confidence for distant matches
      const distancePenalty = 
        (candidate.distance - MEDIUM_CONFIDENCE_DISTANCE) / 
        (MAX_DISTANCE_THRESHOLD - MEDIUM_CONFIDENCE_DISTANCE) * 0.15;
      confidence -= distancePenalty;
    }
    
    // Tag match bonus
    if (candidate.tagMatch) {
      confidence += TAG_MATCH_BONUS;
    }
    
    // Size match bonus
    if (candidate.sizeMatch) {
      confidence += SIZE_MATCH_BONUS;
    }
    
    // Ambiguity penalty
    if (isAmbiguous) {
      confidence -= AMBIGUITY_PENALTY;
    }
    
    // Multiple candidates penalty (scaled)
    if (candidateCount > 3) {
      confidence -= Math.min(0.1, (candidateCount - 3) * 0.02);
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Generates bounding box data for an element
   * Used during recording to populate the bundle
   * 
   * @param element - Element to measure
   * @returns Bounding box object or null
   */
  generateSelector(element: HTMLElement): string | null {
    const rect = element.getBoundingClientRect();
    
    if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) {
      return null;
    }
    
    // Return a JSON representation (not a CSS selector for this strategy)
    return JSON.stringify({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }
  
  /**
   * Extracts bounding box from an element
   * 
   * @param element - Element to measure
   * @returns BoundingBox object
   */
  getBoundingBox(element: HTMLElement): BoundingBox {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }
  
  /**
   * Validates that an element is near expected coordinates
   * 
   * @param element - Element to validate
   * @param expectedValue - Expected bounding box (JSON string or object)
   * @param tolerance - Distance tolerance in pixels
   * @returns True if element is within tolerance
   */
  validate(
    element: HTMLElement,
    expectedValue: string | BoundingBox,
    tolerance: number = MAX_DISTANCE_THRESHOLD
  ): boolean {
    // Parse if string
    const expectedBox: BoundingBox = typeof expectedValue === 'string'
      ? JSON.parse(expectedValue)
      : expectedValue;
    
    const rect = element.getBoundingClientRect();
    const distance = boxDistance(expectedBox, rect);
    return distance <= tolerance;
  }
  
  /**
   * Gets the distance between an element and target coordinates
   * 
   * @param element - Element to check
   * @param targetBox - Target bounding box
   * @returns Distance in pixels
   */
  getDistance(element: HTMLElement, targetBox: BoundingBox): number {
    const rect = element.getBoundingClientRect();
    return boxDistance(targetBox, rect);
  }
  
  /**
   * Finds all elements within a radius of target coordinates
   * 
   * @param targetBox - Target bounding box
   * @param doc - Document to search
   * @param radius - Search radius in pixels
   * @returns Array of elements within radius
   */
  findWithinRadius(
    targetBox: BoundingBox,
    doc: Document,
    radius: number = MAX_DISTANCE_THRESHOLD
  ): HTMLElement[] {
    const candidates = findNearbyElements(targetBox, doc, undefined, radius);
    return candidates.map(c => c.element);
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of BoundingBoxStrategy
 */
let instance: BoundingBoxStrategy | null = null;

/**
 * Gets or creates the BoundingBoxStrategy singleton
 * 
 * @returns BoundingBoxStrategy instance
 */
export function getBoundingBoxStrategy(): BoundingBoxStrategy {
  if (!instance) {
    instance = new BoundingBoxStrategy();
  }
  return instance;
}

/**
 * Creates a new BoundingBoxStrategy instance (for testing)
 * 
 * @returns New BoundingBoxStrategy instance
 */
export function createBoundingBoxStrategy(): BoundingBoxStrategy {
  return new BoundingBoxStrategy();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default BoundingBoxStrategy;
