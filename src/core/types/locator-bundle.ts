/**
 * @fileoverview LocatorBundle type definitions for multi-strategy element location
 * @module core/types/locator-bundle
 * @version 1.0.0
 * 
 * This module defines the canonical LocatorBundle interface containing all
 * element attributes needed for the 9-tier fallback locator strategy.
 * 
 * CRITICAL: LocatorBundle has 14 properties (expanded from original 8).
 * All properties are required for reliable element location during replay.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 1.5 for authoritative specification
 * @see locator-strategy_breakdown.md for 9-tier fallback strategy
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * 9-Tier Locator Strategy with confidence levels
 * 
 * Strategy order (highest to lowest confidence):
 * 1. XPath (100%) - Absolute path, most reliable
 * 2. ID (90%) - Unique identifier
 * 3. Name (80%) - Form element name attribute
 * 4. Aria (75%) - Accessibility labels
 * 5. Placeholder (70%) - Input placeholder text
 * 6. Data Attributes (65%) - Custom data-* attributes
 * 7. Fuzzy Text (40-60%) - Text content matching
 * 8. Bounding Box (variable) - Coordinate-based fallback
 * 9. Retry with delay (2000ms/150ms) - Final attempt
 */
export const LOCATOR_TIERS = {
  XPATH: { tier: 1, confidence: 1.0, name: 'XPath' },
  ID: { tier: 2, confidence: 0.9, name: 'ID' },
  NAME: { tier: 3, confidence: 0.8, name: 'Name' },
  ARIA: { tier: 4, confidence: 0.75, name: 'Aria Label' },
  PLACEHOLDER: { tier: 5, confidence: 0.7, name: 'Placeholder' },
  DATA_ATTRS: { tier: 6, confidence: 0.65, name: 'Data Attributes' },
  FUZZY_TEXT: { tier: 7, confidence: 0.5, name: 'Fuzzy Text' },
  BOUNDING_BOX: { tier: 8, confidence: 0.3, name: 'Bounding Box' },
  RETRY: { tier: 9, confidence: 0.1, name: 'Retry' }
} as const;

export type LocatorTier = keyof typeof LOCATOR_TIERS;

/**
 * Timeout for element location attempts (milliseconds)
 */
export const ELEMENT_TIMEOUT_MS = 2000;

/**
 * Retry interval during element location (milliseconds)
 */
export const RETRY_INTERVAL_MS = 150;

/**
 * Bounding box radius for coordinate-based fallback (pixels)
 */
export const BOUNDING_BOX_RADIUS_PX = 200;

/**
 * Threshold for fuzzy text matching (0-1)
 * 0.4 = 40% similarity required
 */
export const FUZZY_TEXT_THRESHOLD = 0.4;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Bounding box coordinates for element location
 */
export interface BoundingBox {
  /** X coordinate of element center */
  x: number;
  /** Y coordinate of element center */
  y: number;
  /** Element width in pixels */
  width: number;
  /** Element height in pixels */
  height: number;
}

/**
 * Multi-strategy element locator bundle
 * 
 * Contains all attributes needed to locate an element during replay
 * using the 9-tier fallback strategy. Collected during recording
 * to maximize replay reliability across page changes.
 * 
 * CRITICAL: This interface has 14 properties. All must be present
 * (though some may be null/empty) for proper 9-tier fallback operation.
 * 
 * @example
 * ```typescript
 * const bundle: LocatorBundle = {
 *   tag: 'input',
 *   id: 'username',
 *   name: 'user',
 *   placeholder: 'Enter username',
 *   aria: 'Username field',
 *   dataAttrs: { testid: 'login-username' },
 *   text: '',
 *   css: 'input.form-control',
 *   xpath: '/html/body/form/div[1]/input',
 *   classes: ['form-control', 'input-lg'],
 *   pageUrl: 'https://example.com/login',
 *   bounding: { x: 150, y: 200, width: 300, height: 40 },
 *   iframeChain: null,
 *   shadowHosts: null
 * };
 * ```
 */
export interface LocatorBundle {
  // === Original 8 Properties ===
  
  /**
   * HTML tag name (lowercase)
   * e.g., 'input', 'button', 'div', 'a'
   */
  tag: string;

  /**
   * Element ID attribute
   * Tier 2 strategy (90% confidence)
   */
  id: string;

  /**
   * Element name attribute (for form elements)
   * Tier 3 strategy (80% confidence)
   */
  name: string;

  /**
   * Input placeholder text
   * Tier 5 strategy (70% confidence)
   */
  placeholder: string;

  /**
   * Aria-label or aria-labelledby text
   * Tier 4 strategy (75% confidence)
   */
  aria: string;

  /**
   * Data attributes as key-value pairs
   * Tier 6 strategy (65% confidence)
   * Keys should NOT include 'data-' prefix
   */
  dataAttrs: Record<string, string>;

  /**
   * Visible text content of element
   * Tier 7 strategy (40-60% confidence with fuzzy matching)
   */
  text: string;

  /**
   * CSS selector string
   * Used as backup/verification strategy
   */
  css: string;

  // === Added 6 Properties (Phase 0 expansion) ===

  /**
   * Absolute XPath to element
   * Tier 1 strategy (100% confidence) - HIGHEST PRIORITY
   * 
   * @example '/html/body/div[2]/form/input[1]'
   */
  xpath: string;

  /**
   * CSS class names as array
   * Used for fuzzy matching and verification
   */
  classes: string[];

  /**
   * URL where element was recorded
   * Used for context verification during replay
   */
  pageUrl: string;

  /**
   * Bounding box coordinates
   * Tier 8 strategy (variable confidence)
   * Falls back to click coordinates if element not found
   */
  bounding: BoundingBox | null;

  /**
   * Frame indices for cross-iframe element access
   * null if element is in main document
   * Array of frame indices to traverse (e.g., [0, 2] = first frame, then third frame inside it)
   */
  iframeChain: number[] | null;

  /**
   * Shadow DOM host element selectors
   * null if element is not in shadow DOM
   * Array of selectors to pierce shadow boundaries
   */
  shadowHosts: string[] | null;
}

/**
 * Partial bundle for updates (all fields optional)
 */
export type PartialLocatorBundle = Partial<LocatorBundle>;

/**
 * Minimal bundle with only required locator data
 */
export interface MinimalLocatorBundle {
  tag: string;
  xpath: string;
  bounding: BoundingBox | null;
}

/**
 * Result of locator strategy execution
 */
export interface LocatorResult {
  element: Element | null;
  strategy: LocatorTier;
  confidence: number;
  attempts: number;
  duration_ms: number;
}

/**
 * Locator strategy statistics for debugging
 */
export interface LocatorStats {
  strategy_used: LocatorTier;
  confidence: number;
  fallback_count: number;
  total_duration_ms: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate BoundingBox structure
 * 
 * @param value - Value to check
 * @returns True if value is a valid BoundingBox
 */
export function isBoundingBox(value: unknown): value is BoundingBox {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number'
  );
}

/**
 * Type guard to validate LocatorBundle structure
 * 
 * @param value - Value to check
 * @returns True if value conforms to LocatorBundle interface (14 properties)
 */
export function isLocatorBundle(value: unknown): value is LocatorBundle {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Original 8 properties
  if (typeof obj.tag !== 'string') return false;
  if (typeof obj.id !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.placeholder !== 'string') return false;
  if (typeof obj.aria !== 'string') return false;
  if (typeof obj.dataAttrs !== 'object' || obj.dataAttrs === null) return false;
  if (typeof obj.text !== 'string') return false;
  if (typeof obj.css !== 'string') return false;

  // Added 6 properties
  if (typeof obj.xpath !== 'string') return false;
  if (!Array.isArray(obj.classes)) return false;
  if (typeof obj.pageUrl !== 'string') return false;
  if (obj.bounding !== null && !isBoundingBox(obj.bounding)) return false;
  if (obj.iframeChain !== null && !Array.isArray(obj.iframeChain)) return false;
  if (obj.shadowHosts !== null && !Array.isArray(obj.shadowHosts)) return false;

  return true;
}

/**
 * Check if bundle has valid XPath (tier 1 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if XPath is present and non-empty
 */
export function hasXPath(bundle: LocatorBundle): boolean {
  return bundle.xpath.length > 0;
}

/**
 * Check if bundle has valid ID (tier 2 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if ID is present and non-empty
 */
export function hasId(bundle: LocatorBundle): boolean {
  return bundle.id.length > 0;
}

/**
 * Check if bundle has valid name (tier 3 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if name is present and non-empty
 */
export function hasName(bundle: LocatorBundle): boolean {
  return bundle.name.length > 0;
}

/**
 * Check if bundle has aria label (tier 4 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if aria is present and non-empty
 */
export function hasAria(bundle: LocatorBundle): boolean {
  return bundle.aria.length > 0;
}

/**
 * Check if bundle has placeholder (tier 5 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if placeholder is present and non-empty
 */
export function hasPlaceholder(bundle: LocatorBundle): boolean {
  return bundle.placeholder.length > 0;
}

/**
 * Check if bundle has data attributes (tier 6 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if dataAttrs has at least one entry
 */
export function hasDataAttrs(bundle: LocatorBundle): boolean {
  return Object.keys(bundle.dataAttrs).length > 0;
}

/**
 * Check if bundle has text content (tier 7 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if text is present and non-empty
 */
export function hasText(bundle: LocatorBundle): boolean {
  return bundle.text.trim().length > 0;
}

/**
 * Check if bundle has bounding box (tier 8 strategy available)
 * 
 * @param bundle - Bundle to check
 * @returns True if bounding is present and valid
 */
export function hasBounding(bundle: LocatorBundle): boolean {
  return bundle.bounding !== null;
}

/**
 * Check if element is inside an iframe
 * 
 * @param bundle - Bundle to check
 * @returns True if element requires iframe traversal
 */
export function isInIframe(bundle: LocatorBundle): boolean {
  return bundle.iframeChain !== null && bundle.iframeChain.length > 0;
}

/**
 * Check if element is inside shadow DOM
 * 
 * @param bundle - Bundle to check
 * @returns True if element requires shadow DOM traversal
 */
export function isInShadowDom(bundle: LocatorBundle): boolean {
  return bundle.shadowHosts !== null && bundle.shadowHosts.length > 0;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an empty LocatorBundle with all default values
 * 
 * @returns Empty bundle with all 14 properties initialized
 */
export function createEmptyBundle(): LocatorBundle {
  return {
    tag: '',
    id: '',
    name: '',
    placeholder: '',
    aria: '',
    dataAttrs: {},
    text: '',
    css: '',
    xpath: '',
    classes: [],
    pageUrl: '',
    bounding: null,
    iframeChain: null,
    shadowHosts: null
  };
}

/**
 * Create a LocatorBundle from partial data
 * Fills in missing properties with defaults
 * 
 * @param partial - Partial bundle data
 * @returns Complete bundle with all 14 properties
 */
export function createBundle(partial: PartialLocatorBundle): LocatorBundle {
  return {
    tag: partial.tag ?? '',
    id: partial.id ?? '',
    name: partial.name ?? '',
    placeholder: partial.placeholder ?? '',
    aria: partial.aria ?? '',
    dataAttrs: partial.dataAttrs ?? {},
    text: partial.text ?? '',
    css: partial.css ?? '',
    xpath: partial.xpath ?? '',
    classes: partial.classes ?? [],
    pageUrl: partial.pageUrl ?? '',
    bounding: partial.bounding ?? null,
    iframeChain: partial.iframeChain ?? null,
    shadowHosts: partial.shadowHosts ?? null
  };
}

/**
 * Create a BoundingBox from coordinates
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param width - Element width
 * @param height - Element height
 * @returns BoundingBox object
 */
export function createBoundingBox(
  x: number, 
  y: number, 
  width: number, 
  height: number
): BoundingBox {
  return { x, y, width, height };
}

/**
 * Create BoundingBox from click coordinates (centered)
 * Used when only click position is available
 * 
 * @param clickX - Click X coordinate
 * @param clickY - Click Y coordinate
 * @param estimatedSize - Estimated element size (default 100x40)
 * @returns BoundingBox centered on click coordinates
 */
export function createBoundingBoxFromClick(
  clickX: number,
  clickY: number,
  estimatedSize: { width: number; height: number } = { width: 100, height: 40 }
): BoundingBox {
  return {
    x: clickX - estimatedSize.width / 2,
    y: clickY - estimatedSize.height / 2,
    width: estimatedSize.width,
    height: estimatedSize.height
  };
}

/**
 * Create a MinimalLocatorBundle with only required fields
 * 
 * @param tag - Element tag name
 * @param xpath - XPath to element
 * @param bounding - Bounding box (optional)
 * @returns Minimal bundle
 */
export function createMinimalBundle(
  tag: string,
  xpath: string,
  bounding?: BoundingBox | null
): MinimalLocatorBundle {
  return {
    tag,
    xpath,
    bounding: bounding ?? null
  };
}

// ============================================================================
// STRATEGY FUNCTIONS
// ============================================================================

/**
 * Get available locator strategies for a bundle
 * Returns strategies in priority order (highest confidence first)
 * 
 * @param bundle - Bundle to analyze
 * @returns Array of available strategies with confidence levels
 */
export function getAvailableStrategies(bundle: LocatorBundle): Array<{
  tier: LocatorTier;
  confidence: number;
  value: string | Record<string, string> | BoundingBox;
}> {
  const strategies: Array<{
    tier: LocatorTier;
    confidence: number;
    value: string | Record<string, string> | BoundingBox;
  }> = [];

  if (hasXPath(bundle)) {
    strategies.push({ tier: 'XPATH', confidence: 1.0, value: bundle.xpath });
  }
  if (hasId(bundle)) {
    strategies.push({ tier: 'ID', confidence: 0.9, value: bundle.id });
  }
  if (hasName(bundle)) {
    strategies.push({ tier: 'NAME', confidence: 0.8, value: bundle.name });
  }
  if (hasAria(bundle)) {
    strategies.push({ tier: 'ARIA', confidence: 0.75, value: bundle.aria });
  }
  if (hasPlaceholder(bundle)) {
    strategies.push({ tier: 'PLACEHOLDER', confidence: 0.7, value: bundle.placeholder });
  }
  if (hasDataAttrs(bundle)) {
    strategies.push({ tier: 'DATA_ATTRS', confidence: 0.65, value: bundle.dataAttrs });
  }
  if (hasText(bundle)) {
    strategies.push({ tier: 'FUZZY_TEXT', confidence: 0.5, value: bundle.text });
  }
  if (hasBounding(bundle)) {
    strategies.push({ tier: 'BOUNDING_BOX', confidence: 0.3, value: bundle.bounding! });
  }

  return strategies;
}

/**
 * Get the highest confidence strategy available
 * 
 * @param bundle - Bundle to analyze
 * @returns Best available strategy or null if none available
 */
export function getBestStrategy(bundle: LocatorBundle): {
  tier: LocatorTier;
  confidence: number;
} | null {
  const strategies = getAvailableStrategies(bundle);
  return strategies.length > 0 ? { tier: strategies[0].tier, confidence: strategies[0].confidence } : null;
}

/**
 * Count how many locator strategies are available
 * 
 * @param bundle - Bundle to analyze
 * @returns Number of available strategies (0-8)
 */
export function countAvailableStrategies(bundle: LocatorBundle): number {
  return getAvailableStrategies(bundle).length;
}

/**
 * Calculate overall bundle quality score
 * Higher score = more reliable element location
 * 
 * @param bundle - Bundle to analyze
 * @returns Quality score 0-100
 */
export function calculateBundleQuality(bundle: LocatorBundle): number {
  let score = 0;
  
  // Primary strategies (higher weight)
  if (hasXPath(bundle)) score += 25;
  if (hasId(bundle)) score += 20;
  if (hasName(bundle)) score += 15;
  
  // Secondary strategies
  if (hasAria(bundle)) score += 10;
  if (hasPlaceholder(bundle)) score += 10;
  if (hasDataAttrs(bundle)) score += 8;
  if (hasText(bundle)) score += 7;
  if (hasBounding(bundle)) score += 5;
  
  return Math.min(score, 100);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Merge two bundles, preferring non-empty values from second bundle
 * 
 * @param base - Base bundle
 * @param override - Override bundle (non-empty values win)
 * @returns Merged bundle
 */
export function mergeBundle(
  base: LocatorBundle, 
  override: PartialLocatorBundle
): LocatorBundle {
  return {
    tag: override.tag || base.tag,
    id: override.id || base.id,
    name: override.name || base.name,
    placeholder: override.placeholder || base.placeholder,
    aria: override.aria || base.aria,
    dataAttrs: Object.keys(override.dataAttrs ?? {}).length > 0 
      ? { ...base.dataAttrs, ...override.dataAttrs } 
      : base.dataAttrs,
    text: override.text || base.text,
    css: override.css || base.css,
    xpath: override.xpath || base.xpath,
    classes: override.classes?.length ? override.classes : base.classes,
    pageUrl: override.pageUrl || base.pageUrl,
    bounding: override.bounding ?? base.bounding,
    iframeChain: override.iframeChain ?? base.iframeChain,
    shadowHosts: override.shadowHosts ?? base.shadowHosts
  };
}

/**
 * Clone a bundle (deep copy)
 * 
 * @param bundle - Bundle to clone
 * @returns New bundle with same values
 */
export function cloneBundle(bundle: LocatorBundle): LocatorBundle {
  return {
    ...bundle,
    dataAttrs: { ...bundle.dataAttrs },
    classes: [...bundle.classes],
    bounding: bundle.bounding ? { ...bundle.bounding } : null,
    iframeChain: bundle.iframeChain ? [...bundle.iframeChain] : null,
    shadowHosts: bundle.shadowHosts ? [...bundle.shadowHosts] : null
  };
}

/**
 * Simple CSS escape function (polyfill for CSS.escape)
 * 
 * @param value - Value to escape
 * @returns Escaped CSS identifier
 */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Simple polyfill for Node environment
  return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

/**
 * Extract a CSS selector from bundle attributes
 * 
 * @param bundle - Bundle to extract selector from
 * @returns CSS selector string
 */
export function extractCssSelector(bundle: LocatorBundle): string {
  const parts: string[] = [bundle.tag || '*'];

  if (bundle.id) {
    parts.push(`#${cssEscape(bundle.id)}`);
  }
  if (bundle.classes.length > 0) {
    parts.push(bundle.classes.map(c => `.${cssEscape(c)}`).join(''));
  }
  if (bundle.name) {
    parts.push(`[name="${cssEscape(bundle.name)}"]`);
  }

  return parts.join('');
}

/**
 * Check if bundle matches an element (basic verification)
 * 
 * @param bundle - Bundle to match
 * @param element - Element to check
 * @returns True if element matches bundle attributes
 */
export function bundleMatchesElement(
  bundle: LocatorBundle, 
  element: Element
): boolean {
  // Tag must match
  if (bundle.tag && element.tagName.toLowerCase() !== bundle.tag.toLowerCase()) {
    return false;
  }

  // ID must match if specified
  if (bundle.id && element.id !== bundle.id) {
    return false;
  }

  // Name must match if specified
  if (bundle.name && element.getAttribute('name') !== bundle.name) {
    return false;
  }

  return true;
}

/**
 * Get center coordinates from bounding box
 * 
 * @param bounding - Bounding box
 * @returns Center coordinates { x, y }
 */
export function getBoundingCenter(bounding: BoundingBox): { x: number; y: number } {
  return {
    x: bounding.x + bounding.width / 2,
    y: bounding.y + bounding.height / 2
  };
}

/**
 * Check if a point is within bounding box (with radius tolerance)
 * 
 * @param bounding - Bounding box
 * @param x - X coordinate to check
 * @param y - Y coordinate to check
 * @param radiusPx - Tolerance radius in pixels
 * @returns True if point is within expanded bounding box
 */
export function isPointInBounding(
  bounding: BoundingBox,
  x: number,
  y: number,
  radiusPx: number = BOUNDING_BOX_RADIUS_PX
): boolean {
  const expandedX = bounding.x - radiusPx;
  const expandedY = bounding.y - radiusPx;
  const expandedWidth = bounding.width + 2 * radiusPx;
  const expandedHeight = bounding.height + 2 * radiusPx;

  return (
    x >= expandedX &&
    x <= expandedX + expandedWidth &&
    y >= expandedY &&
    y <= expandedY + expandedHeight
  );
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validation error for locator bundle
 */
export interface LocatorBundleValidationError {
  field: keyof LocatorBundle | 'general';
  message: string;
}

/**
 * Validate locator bundle data
 * 
 * @param bundle - Bundle to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateBundle(bundle: Partial<LocatorBundle>): LocatorBundleValidationError[] {
  const errors: LocatorBundleValidationError[] = [];

  // At least one locator strategy should be available
  const hasAnyStrategy = 
    (bundle.xpath && bundle.xpath.length > 0) ||
    (bundle.id && bundle.id.length > 0) ||
    (bundle.name && bundle.name.length > 0) ||
    (bundle.css && bundle.css.length > 0) ||
    (bundle.bounding !== undefined && bundle.bounding !== null);

  if (!hasAnyStrategy) {
    errors.push({ 
      field: 'general', 
      message: 'Bundle must have at least one locator strategy (xpath, id, name, css, or bounding)' 
    });
  }

  // Validate bounding if present
  if (bundle.bounding !== undefined && bundle.bounding !== null) {
    if (!isBoundingBox(bundle.bounding)) {
      errors.push({ field: 'bounding', message: 'Invalid bounding box structure' });
    }
  }

  // Validate iframeChain if present
  if (bundle.iframeChain !== undefined && bundle.iframeChain !== null) {
    if (!Array.isArray(bundle.iframeChain)) {
      errors.push({ field: 'iframeChain', message: 'iframeChain must be an array' });
    } else if (bundle.iframeChain.some(i => typeof i !== 'number')) {
      errors.push({ field: 'iframeChain', message: 'iframeChain must contain only numbers' });
    }
  }

  // Validate shadowHosts if present
  if (bundle.shadowHosts !== undefined && bundle.shadowHosts !== null) {
    if (!Array.isArray(bundle.shadowHosts)) {
      errors.push({ field: 'shadowHosts', message: 'shadowHosts must be an array' });
    } else if (bundle.shadowHosts.some(s => typeof s !== 'string')) {
      errors.push({ field: 'shadowHosts', message: 'shadowHosts must contain only strings' });
    }
  }

  return errors;
}

/**
 * Check if bundle is valid
 * 
 * @param bundle - Bundle to validate
 * @returns True if bundle is valid
 */
export function isValidBundle(bundle: Partial<LocatorBundle>): boolean {
  return validateBundle(bundle).length === 0;
}
