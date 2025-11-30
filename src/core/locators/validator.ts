/**
 * @fileoverview Locator bundle validation and diagnostics
 * @module core/locators/validator
 * @version 1.0.0
 * 
 * This module provides validation for LocatorBundle integrity,
 * element matching verification, and diagnostic information for
 * debugging failed element locations.
 * 
 * @see PHASE_4_SPECIFICATIONS.md for locator specifications
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { LocatorBundle, BoundingBox } from '../types';
import {
  hasXPath,
  hasId,
  hasName,
  hasAria,
  hasPlaceholder,
  hasDataAttrs,
  hasText,
  hasBounding,
  FUZZY_TEXT_THRESHOLD,
  BOUNDING_BOX_RADIUS_PX
} from '../types';

import {
  calculateTextSimilarity,
  distanceToBoundingCenter
} from './locator-utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Validation severity level
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Single validation issue
 */
export interface ValidationIssue {
  /** Issue severity */
  severity: ValidationSeverity;
  /** Issue code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Property or area affected */
  property?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  /** Whether bundle is valid (no errors) */
  valid: boolean;
  /** Quality score (0-100) */
  qualityScore: number;
  /** List of issues found */
  issues: ValidationIssue[];
  /** Available strategies based on bundle properties */
  availableStrategies: string[];
  /** Recommended strategy to use first */
  recommendedStrategy: string | null;
  /** Summary statistics */
  stats: ValidationStats;
}

/**
 * Validation statistics
 */
export interface ValidationStats {
  /** Total properties populated */
  populatedProperties: number;
  /** Total properties checked */
  totalProperties: number;
  /** Percentage of properties populated */
  completeness: number;
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** Number of info messages */
  infoCount: number;
}

/**
 * Element match result
 */
export interface MatchResult {
  /** Whether element matches bundle */
  matches: boolean;
  /** Match confidence (0-100) */
  confidence: number;
  /** Individual property match results */
  propertyMatches: PropertyMatch[];
  /** Overall match summary */
  summary: string;
}

/**
 * Individual property match
 */
export interface PropertyMatch {
  /** Property name */
  property: string;
  /** Whether property matches */
  matches: boolean;
  /** Expected value */
  expected: string;
  /** Actual value */
  actual: string;
  /** Match weight for scoring */
  weight: number;
}

/**
 * Diagnostic report for debugging
 */
export interface DiagnosticReport {
  /** Bundle being diagnosed */
  bundle: LocatorBundle;
  /** Validation result */
  validation: ValidationResult;
  /** Page context information */
  pageContext: PageContext;
  /** Suggestions for improvement */
  suggestions: string[];
  /** Generated at timestamp */
  generatedAt: number;
}

/**
 * Page context for diagnostics
 */
export interface PageContext {
  /** Current page URL */
  url: string;
  /** Page title */
  title: string;
  /** Number of similar elements on page */
  similarElementCount: number;
  /** Whether page URL matches bundle */
  urlMatches: boolean;
}

// ============================================================================
// VALIDATION CODES
// ============================================================================

/**
 * Validation issue codes
 */
export const VALIDATION_CODES = {
  // Errors
  MISSING_TAG: 'MISSING_TAG',
  MISSING_LOCATOR: 'MISSING_LOCATOR',
  INVALID_XPATH: 'INVALID_XPATH',
  INVALID_CSS: 'INVALID_CSS',
  INVALID_BOUNDING: 'INVALID_BOUNDING',
  
  // Warnings
  NO_UNIQUE_ID: 'NO_UNIQUE_ID',
  NO_TEXT_CONTENT: 'NO_TEXT_CONTENT',
  NO_DATA_ATTRS: 'NO_DATA_ATTRS',
  WEAK_LOCATORS: 'WEAK_LOCATORS',
  DYNAMIC_CLASSES: 'DYNAMIC_CLASSES',
  URL_MISMATCH: 'URL_MISMATCH',
  
  // Info
  IFRAME_CONTEXT: 'IFRAME_CONTEXT',
  SHADOW_DOM_CONTEXT: 'SHADOW_DOM_CONTEXT',
  POSITIONAL_ONLY: 'POSITIONAL_ONLY',
  MULTIPLE_STRATEGIES: 'MULTIPLE_STRATEGIES'
} as const;

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

/**
 * Validate a LocatorBundle
 * 
 * Checks bundle integrity, identifies issues, and provides recommendations.
 * 
 * @param bundle - Bundle to validate
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const result = validateBundle(step.bundle);
 * 
 * if (!result.valid) {
 *   console.error('Bundle has errors:', result.issues);
 * }
 * 
 * console.log('Quality score:', result.qualityScore);
 * console.log('Use strategy:', result.recommendedStrategy);
 * ```
 */
export function validateBundle(bundle: LocatorBundle): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  // Check required properties
  validateRequiredProperties(bundle, issues);
  
  // Check locator availability
  validateLocators(bundle, issues);
  
  // Check optional properties for completeness
  validateOptionalProperties(bundle, issues);
  
  // Check for potential issues
  validatePotentialIssues(bundle, issues);
  
  // Determine available strategies
  const availableStrategies = getAvailableStrategies(bundle);
  
  // Get recommended strategy
  const recommendedStrategy = getRecommendedStrategy(bundle, availableStrategies);
  
  // Calculate stats
  const stats = calculateStats(bundle, issues);
  
  // Calculate quality score
  const qualityScore = calculateBundleQualityScore(bundle);
  
  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    qualityScore,
    issues,
    availableStrategies,
    recommendedStrategy,
    stats
  };
}

/**
 * Validate required properties
 */
function validateRequiredProperties(
  bundle: LocatorBundle,
  issues: ValidationIssue[]
): void {
  // Tag is required
  if (!bundle.tag || bundle.tag.length === 0) {
    issues.push({
      severity: 'error',
      code: VALIDATION_CODES.MISSING_TAG,
      message: 'Bundle is missing tag name',
      property: 'tag',
      suggestion: 'Ensure element tag is captured during recording'
    });
  }
  
  // Must have at least one locator strategy
  if (!hasXPath(bundle) && !hasId(bundle) && !bundle.css) {
    issues.push({
      severity: 'error',
      code: VALIDATION_CODES.MISSING_LOCATOR,
      message: 'Bundle has no reliable locator (xpath, id, or css)',
      suggestion: 'Re-record the step to capture locator information'
    });
  }
}

/**
 * Validate locator properties
 */
function validateLocators(
  bundle: LocatorBundle,
  issues: ValidationIssue[]
): void {
  // Validate XPath syntax
  if (bundle.xpath && bundle.xpath.length > 0) {
    if (!isValidXPath(bundle.xpath)) {
      issues.push({
        severity: 'error',
        code: VALIDATION_CODES.INVALID_XPATH,
        message: `Invalid XPath syntax: ${bundle.xpath}`,
        property: 'xpath',
        suggestion: 'XPath may have been corrupted. Re-record the step.'
      });
    }
  }
  
  // Validate CSS selector syntax
  if (bundle.css && bundle.css.length > 0) {
    if (!isValidCssSelector(bundle.css)) {
      issues.push({
        severity: 'error',
        code: VALIDATION_CODES.INVALID_CSS,
        message: `Invalid CSS selector: ${bundle.css}`,
        property: 'css',
        suggestion: 'CSS selector may be malformed. Re-record the step.'
      });
    }
  }
  
  // Validate bounding box
  if (bundle.bounding) {
    if (!isValidBoundingBox(bundle.bounding)) {
      issues.push({
        severity: 'error',
        code: VALIDATION_CODES.INVALID_BOUNDING,
        message: 'Bounding box has invalid dimensions',
        property: 'bounding',
        suggestion: 'Element may have been hidden during recording'
      });
    }
  }
}

/**
 * Validate optional properties
 */
function validateOptionalProperties(
  bundle: LocatorBundle,
  issues: ValidationIssue[]
): void {
  // Check for unique identifier
  if (!hasId(bundle) && !hasName(bundle)) {
    issues.push({
      severity: 'warning',
      code: VALIDATION_CODES.NO_UNIQUE_ID,
      message: 'Element has no ID or name attribute',
      suggestion: 'Element may be harder to locate reliably'
    });
  }
  
  // Check for text content
  if (!hasText(bundle) && !hasPlaceholder(bundle) && !hasAria(bundle)) {
    issues.push({
      severity: 'warning',
      code: VALIDATION_CODES.NO_TEXT_CONTENT,
      message: 'Element has no text content, placeholder, or aria label',
      suggestion: 'Fuzzy text matching will not be available'
    });
  }
  
  // Check for data attributes
  if (!hasDataAttrs(bundle)) {
    issues.push({
      severity: 'info',
      code: VALIDATION_CODES.NO_DATA_ATTRS,
      message: 'Element has no data-* attributes',
      property: 'dataAttrs',
      suggestion: 'Consider adding data-testid to target elements'
    });
  }
}

/**
 * Check for potential issues
 */
function validatePotentialIssues(
  bundle: LocatorBundle,
  issues: ValidationIssue[]
): void {
  // Check for dynamic class names
  if (bundle.classes && bundle.classes.length > 0) {
    const dynamicPatterns = [/^[a-z]{1,3}-[a-f0-9]{4,}$/i, /^_[a-zA-Z0-9]{6,}$/];
    const hasDynamicClasses = bundle.classes.some(c => 
      dynamicPatterns.some(p => p.test(c))
    );
    
    if (hasDynamicClasses) {
      issues.push({
        severity: 'warning',
        code: VALIDATION_CODES.DYNAMIC_CLASSES,
        message: 'Element has potentially dynamic class names',
        property: 'classes',
        suggestion: 'CSS selectors using these classes may be unreliable'
      });
    }
  }
  
  // Check iframe context
  if (bundle.iframeChain && bundle.iframeChain.length > 0) {
    issues.push({
      severity: 'info',
      code: VALIDATION_CODES.IFRAME_CONTEXT,
      message: `Element is inside ${bundle.iframeChain.length} iframe(s)`,
      property: 'iframeChain',
      suggestion: 'Element location will search within iframes'
    });
  }
  
  // Check shadow DOM context
  if (bundle.shadowHosts && bundle.shadowHosts.length > 0) {
    issues.push({
      severity: 'info',
      code: VALIDATION_CODES.SHADOW_DOM_CONTEXT,
      message: `Element is inside ${bundle.shadowHosts.length} shadow root(s)`,
      property: 'shadowHosts',
      suggestion: 'Element location will search within shadow DOM'
    });
  }
  
  // Check if only positional strategy available
  if (hasBounding(bundle) && !hasXPath(bundle) && !hasId(bundle) && !bundle.css) {
    issues.push({
      severity: 'warning',
      code: VALIDATION_CODES.POSITIONAL_ONLY,
      message: 'Only positional (bounding box) strategy available',
      suggestion: 'Element location may fail if page layout changes'
    });
  }
}

// ============================================================================
// ELEMENT MATCHING
// ============================================================================

/**
 * Verify if an element matches a bundle
 * 
 * @param element - Element to check
 * @param bundle - Bundle to match against
 * @returns Match result with confidence score
 */
export function verifyElementMatch(
  element: Element,
  bundle: LocatorBundle
): MatchResult {
  const propertyMatches: PropertyMatch[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  // Tag match (required)
  const tagMatches = element.tagName.toLowerCase() === bundle.tag.toLowerCase();
  propertyMatches.push({
    property: 'tag',
    matches: tagMatches,
    expected: bundle.tag,
    actual: element.tagName.toLowerCase(),
    weight: 10
  });
  totalWeight += 10;
  if (tagMatches) matchedWeight += 10;

  // ID match
  if (bundle.id) {
    const matches = element.id === bundle.id;
    propertyMatches.push({
      property: 'id',
      matches,
      expected: bundle.id,
      actual: element.id,
      weight: 25
    });
    totalWeight += 25;
    if (matches) matchedWeight += 25;
  }

  // Name match
  if (bundle.name) {
    const actual = element.getAttribute('name') || '';
    const matches = actual === bundle.name;
    propertyMatches.push({
      property: 'name',
      matches,
      expected: bundle.name,
      actual,
      weight: 15
    });
    totalWeight += 15;
    if (matches) matchedWeight += 15;
  }

  // Placeholder match
  if (bundle.placeholder) {
    const actual = element.getAttribute('placeholder') || '';
    const matches = actual === bundle.placeholder;
    propertyMatches.push({
      property: 'placeholder',
      matches,
      expected: bundle.placeholder,
      actual,
      weight: 10
    });
    totalWeight += 10;
    if (matches) matchedWeight += 10;
  }

  // Aria match
  if (bundle.aria) {
    const actual = element.getAttribute('aria-label') || '';
    const matches = actual === bundle.aria;
    propertyMatches.push({
      property: 'aria',
      matches,
      expected: bundle.aria,
      actual,
      weight: 10
    });
    totalWeight += 10;
    if (matches) matchedWeight += 10;
  }

  // Text match (fuzzy)
  if (bundle.text) {
    const actual = element.textContent?.trim() || '';
    const similarity = calculateTextSimilarity(
      bundle.text.toLowerCase(),
      actual.toLowerCase()
    );
    const matches = similarity >= FUZZY_TEXT_THRESHOLD;
    propertyMatches.push({
      property: 'text',
      matches,
      expected: bundle.text,
      actual: actual.slice(0, 100),
      weight: 10
    });
    totalWeight += 10;
    if (matches) matchedWeight += 10 * similarity;
  }

  // Bounding box match (proximity)
  if (bundle.bounding) {
    const rect = element.getBoundingClientRect();
    const distance = distanceToBoundingCenter(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      bundle.bounding
    );
    const matches = distance < BOUNDING_BOX_RADIUS_PX;
    propertyMatches.push({
      property: 'bounding',
      matches,
      expected: `(${bundle.bounding.x}, ${bundle.bounding.y})`,
      actual: `(${Math.round(rect.x)}, ${Math.round(rect.y)})`,
      weight: 10
    });
    totalWeight += 10;
    if (matches) {
      matchedWeight += 10 * (1 - distance / BOUNDING_BOX_RADIUS_PX);
    }
  }

  // Data attributes match
  if (bundle.dataAttrs && Object.keys(bundle.dataAttrs).length > 0) {
    let dataMatches = 0;
    let dataTotal = 0;
    
    for (const [key, value] of Object.entries(bundle.dataAttrs)) {
      const actual = element.getAttribute(`data-${key}`);
      if (actual === value) {
        dataMatches++;
      }
      dataTotal++;
    }
    
    const matches = dataTotal > 0 && dataMatches === dataTotal;
    propertyMatches.push({
      property: 'dataAttrs',
      matches,
      expected: `${Object.keys(bundle.dataAttrs).length} attributes`,
      actual: `${dataMatches}/${dataTotal} matching`,
      weight: 10
    });
    totalWeight += 10;
    if (dataTotal > 0) {
      matchedWeight += 10 * (dataMatches / dataTotal);
    }
  }

  const confidence = totalWeight > 0 
    ? Math.round((matchedWeight / totalWeight) * 100)
    : 0;

  const matchingProps = propertyMatches.filter(p => p.matches).length;
  const totalProps = propertyMatches.length;

  return {
    matches: confidence >= 70 && tagMatches,
    confidence,
    propertyMatches,
    summary: `${matchingProps}/${totalProps} properties match (${confidence}% confidence)`
  };
}

/**
 * Find all elements that match a bundle
 * 
 * @param bundle - Bundle to match
 * @param doc - Document to search
 * @returns Array of matching elements with confidence scores
 */
export function findMatchingElements(
  bundle: LocatorBundle,
  doc: Document
): Array<{ element: Element; confidence: number }> {
  const matches: Array<{ element: Element; confidence: number }> = [];
  
  // Get candidate elements
  let candidates: Element[];
  
  if (bundle.tag) {
    candidates = Array.from(doc.getElementsByTagName(bundle.tag));
  } else {
    candidates = Array.from(doc.body.getElementsByTagName('*'));
  }

  // Score each candidate
  for (const element of candidates) {
    const result = verifyElementMatch(element, bundle);
    
    if (result.confidence >= 30) {
      matches.push({
        element,
        confidence: result.confidence
      });
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Generate diagnostic report for a bundle
 * 
 * @param bundle - Bundle to diagnose
 * @param doc - Current document
 * @returns Diagnostic report
 */
export function generateDiagnosticReport(
  bundle: LocatorBundle,
  doc: Document = document
): DiagnosticReport {
  const validation = validateBundle(bundle);
  const suggestions: string[] = [];

  // Generate suggestions based on validation
  for (const issue of validation.issues) {
    if (issue.suggestion) {
      suggestions.push(issue.suggestion);
    }
  }

  // Check page context
  const currentUrl = doc.defaultView?.location.href || '';
  const urlMatches = bundle.pageUrl 
    ? currentUrl.includes(new URL(bundle.pageUrl).pathname)
    : true;

  if (!urlMatches) {
    suggestions.push('Current page URL differs from recorded URL. Navigate to the correct page.');
  }

  // Count similar elements
  const similarElements = findMatchingElements(bundle, doc);
  
  if (similarElements.length === 0) {
    suggestions.push('No matching elements found on page. The element may not exist or page structure changed.');
  } else if (similarElements.length > 1) {
    suggestions.push(`Found ${similarElements.length} similar elements. Consider adding more specific locators.`);
  }

  // Additional suggestions based on quality
  if (validation.qualityScore < 50) {
    suggestions.push('Bundle quality is low. Re-record the step for better locator capture.');
  }

  if (!hasId(bundle) && !hasDataAttrs(bundle)) {
    suggestions.push('Add data-testid attributes to target elements for more reliable testing.');
  }

  const pageContext: PageContext = {
    url: currentUrl,
    title: doc.title,
    similarElementCount: similarElements.length,
    urlMatches
  };

  return {
    bundle,
    validation,
    pageContext,
    suggestions: [...new Set(suggestions)], // Remove duplicates
    generatedAt: Date.now()
  };
}

/**
 * Format diagnostic report as string
 */
export function formatDiagnosticReport(report: DiagnosticReport): string {
  const lines: string[] = [
    '=== LOCATOR DIAGNOSTIC REPORT ===',
    '',
    `Generated: ${new Date(report.generatedAt).toISOString()}`,
    `Quality Score: ${report.validation.qualityScore}/100`,
    `Valid: ${report.validation.valid ? 'Yes' : 'No'}`,
    '',
    '--- Bundle Properties ---',
    `Tag: ${report.bundle.tag}`,
    `ID: ${report.bundle.id || '(none)'}`,
    `Name: ${report.bundle.name || '(none)'}`,
    `XPath: ${report.bundle.xpath || '(none)'}`,
    `CSS: ${report.bundle.css || '(none)'}`,
    '',
    '--- Page Context ---',
    `Current URL: ${report.pageContext.url}`,
    `URL Match: ${report.pageContext.urlMatches ? 'Yes' : 'No'}`,
    `Similar Elements: ${report.pageContext.similarElementCount}`,
    '',
    '--- Issues ---'
  ];

  if (report.validation.issues.length === 0) {
    lines.push('No issues found.');
  } else {
    for (const issue of report.validation.issues) {
      lines.push(`[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
    }
  }

  lines.push('', '--- Suggestions ---');
  
  if (report.suggestions.length === 0) {
    lines.push('No suggestions.');
  } else {
    for (const suggestion of report.suggestions) {
      lines.push(`• ${suggestion}`);
    }
  }

  lines.push('', '=================================');

  return lines.join('\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate quality score for a bundle (0-100)
 * 
 * Scoring weights:
 * - ID: 30 points (most reliable)
 * - Name: 15 points
 * - Data attributes: 15 points
 * - Placeholder/Aria: 10 points each
 * - Text: 10 points
 * - XPath/CSS: 5 points each
 */
function calculateBundleQualityScore(bundle: LocatorBundle): number {
  let score = 0;

  // ID is the most reliable locator
  if (bundle.id) score += 30;

  // Name attribute is very reliable for forms
  if (bundle.name) score += 15;

  // Data attributes (especially test IDs) are reliable
  const dataAttrCount = Object.keys(bundle.dataAttrs).length;
  if (dataAttrCount > 0) {
    score += Math.min(15, dataAttrCount * 5);
  }

  // Placeholder and aria provide good context
  if (bundle.placeholder) score += 10;
  if (bundle.aria) score += 10;

  // Text content helps with fuzzy matching
  if (bundle.text && bundle.text.length > 0) score += 10;

  // XPath and CSS selectors
  if (bundle.xpath) score += 5;
  if (bundle.css) score += 5;

  // Cap at 100
  return Math.min(100, score);
}

/**
 * Get available strategies for a bundle
 */
function getAvailableStrategies(bundle: LocatorBundle): string[] {
  const strategies: string[] = [];
  
  if (hasXPath(bundle)) strategies.push('xpath');
  if (hasId(bundle)) strategies.push('id');
  if (hasName(bundle)) strategies.push('name');
  if (hasAria(bundle)) strategies.push('aria');
  if (hasPlaceholder(bundle)) strategies.push('placeholder');
  if (hasDataAttrs(bundle)) strategies.push('data-attrs');
  if (hasText(bundle)) strategies.push('text');
  if (hasBounding(bundle)) strategies.push('bounding');
  if (bundle.css && bundle.css.length > 0) strategies.push('css');
  
  return strategies;
}

/**
 * Get recommended strategy based on bundle
 */
function getRecommendedStrategy(
  _bundle: LocatorBundle,
  available: string[]
): string | null {
  // Priority order
  const priority = ['xpath', 'id', 'name', 'aria', 'placeholder', 'data-attrs', 'css', 'text', 'bounding'];
  
  for (const strategy of priority) {
    if (available.includes(strategy)) {
      return strategy;
    }
  }
  
  return null;
}

/**
 * Calculate validation stats
 */
function calculateStats(
  bundle: LocatorBundle,
  issues: ValidationIssue[]
): ValidationStats {
  const properties = [
    'tag', 'id', 'name', 'placeholder', 'aria', 'text',
    'dataAttrs', 'css', 'xpath', 'classes', 'pageUrl', 'bounding'
  ];
  
  let populated = 0;
  
  if (bundle.tag) populated++;
  if (bundle.id) populated++;
  if (bundle.name) populated++;
  if (bundle.placeholder) populated++;
  if (bundle.aria) populated++;
  if (bundle.text) populated++;
  if (bundle.dataAttrs && Object.keys(bundle.dataAttrs).length > 0) populated++;
  if (bundle.css) populated++;
  if (bundle.xpath) populated++;
  if (bundle.classes && bundle.classes.length > 0) populated++;
  if (bundle.pageUrl) populated++;
  if (bundle.bounding) populated++;

  return {
    populatedProperties: populated,
    totalProperties: properties.length,
    completeness: Math.round((populated / properties.length) * 100),
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    infoCount: issues.filter(i => i.severity === 'info').length
  };
}

/**
 * Validate XPath syntax
 */
function isValidXPath(xpath: string): boolean {
  if (!xpath || xpath.length === 0) return false;
  
  // Basic syntax check
  if (!xpath.startsWith('/') && !xpath.startsWith('(')) {
    return false;
  }
  
  // Try to evaluate (may not work in all environments)
  try {
    if (typeof document !== 'undefined' && document.evaluate) {
      // Check if XPathResult is available (JSDOM compatibility)
      const resultType = typeof XPathResult !== 'undefined' 
        ? XPathResult.ANY_TYPE 
        : 0;
      document.evaluate(xpath, document, null, resultType, null);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate CSS selector syntax
 */
function isValidCssSelector(selector: string): boolean {
  if (!selector || selector.length === 0) return false;
  
  try {
    if (typeof document !== 'undefined') {
      document.querySelector(selector);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate bounding box
 */
function isValidBoundingBox(box: BoundingBox): boolean {
  return (
    typeof box.x === 'number' &&
    typeof box.y === 'number' &&
    typeof box.width === 'number' &&
    typeof box.height === 'number' &&
    box.width >= 0 &&
    box.height >= 0 &&
    isFinite(box.x) &&
    isFinite(box.y)
  );
}

/**
 * Quick validation check
 */
export function isValidBundle(bundle: LocatorBundle): boolean {
  return validateBundle(bundle).valid;
}

/**
 * Get quality level description
 */
export function getQualityLevel(score: number): {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
} {
  if (score >= 80) {
    return { level: 'excellent', description: 'Bundle has reliable locators' };
  }
  if (score >= 60) {
    return { level: 'good', description: 'Bundle should work in most cases' };
  }
  if (score >= 40) {
    return { level: 'fair', description: 'Bundle may have reliability issues' };
  }
  return { level: 'poor', description: 'Bundle needs improvement' };
}
