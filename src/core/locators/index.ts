/**
 * @fileoverview Barrel export for all locator-related types and utilities
 * @module core/locators
 * @version 1.0.0
 * 
 * This module re-exports all locator types, strategies, bundle building,
 * validation, and highlighting utilities.
 * 
 * 9-TIER FALLBACK STRATEGY (in priority order):
 * 1. XPath (100% confidence)
 * 2. ID (90%)
 * 3. Name (80%)
 * 4. Aria (75%)
 * 5. Placeholder (70%)
 * 6. Data Attributes (65%)
 * 7. Fuzzy Text (50%)
 * 8. Bounding Box (30%)
 * 9. CSS Selector (60%)
 * 
 * @example
 * ```typescript
 * // Import location utilities
 * import { locateElement, locateElementWithRetry } from '@/core/locators';
 * 
 * // Import bundle building
 * import { buildBundle, buildBundleFromEvent } from '@/core/locators';
 * 
 * // Import validation
 * import { validateBundle, verifyElementMatch } from '@/core/locators';
 * 
 * // Import highlighting
 * import { HighlightManager, highlightRecording } from '@/core/locators';
 * ```
 * 
 * @see PHASE_4_SPECIFICATIONS.md for locator specifications
 * @see locator-strategy_breakdown.md for strategy details
 */

// ============================================================================
// LOCATOR UTILITIES
// ============================================================================

export {
  // Types
  type LocateResult,
  type StrategyAttempt,
  type StrategyFunction,
  type StrategyDefinition,
  
  // Strategy Registry
  STRATEGIES,
  getAvailableStrategies,
  getStrategyByName,
  
  // Individual Strategy Functions
  locateByXPath,
  locateById,
  locateByName,
  locateByAria,
  locateByPlaceholder,
  locateByDataAttrs,
  locateByText,
  locateByBounding,
  locateByCss,
  
  // Main Location Functions
  locateElement,
  locateElementWithRetry,
  
  // Utility Functions
  escapeSelector,
  calculateTextSimilarity,
  isPointInBoundingBox,
  distanceToBoundingCenter,
  buildXPathFromElement,
  buildCssSelectorFromElement,
  extractBundleFromElement,
  verifyElementMatchesBundle,
  scoreElementMatch
} from './locator-utils';

// ============================================================================
// STRATEGIES
// ============================================================================

export {
  // Types
  type StrategyContext,
  type StrategyOptions,
  type FullLocateResult,
  type InteractionOptions,
  
  // Constants
  DEFAULT_STRATEGY_OPTIONS,
  DEFAULT_INTERACTION_OPTIONS,
  
  // Main Strategy Executor
  executeStrategy,
  
  // Element Interactions
  performClick,
  performInput,
  performEnter,
  
  // Highlighting (from strategies)
  highlightElement,
  createHighlightOverlay,
  removeHighlightOverlay,
  
  // Utilities
  waitForElementStable,
  isElementVisible,
  isElementInteractable,
  getElementVisibleText,
  getElementDocument,
  getFullXPath
} from './strategies';

// ============================================================================
// BUNDLE BUILDER
// ============================================================================

export {
  // Types
  type BundleBuildOptions,
  type BundleBuildContext,
  type BundleBuildResult,
  
  // Constants
  DEFAULT_BUILD_OPTIONS,
  
  // Build Functions
  buildBundle,
  buildBundleFromEvent,
  buildBundleFromPoint,
  
  // Context Detection
  getBuildContext,
  isInIframe,
  isInShadowDom,
  
  // XPath Building
  buildXPath,
  buildOptimizedXPath,
  
  // CSS Selector Building
  buildCssSelector,
  buildOptimizedCssSelector,
  
  // Bundle Manipulation
  enhanceBundle,
  mergeBundles,
  validateBundle as validateBundleStructure
} from './bundle-builder';

// ============================================================================
// VALIDATOR
// ============================================================================

export {
  // Types
  type ValidationSeverity,
  type ValidationIssue,
  type ValidationResult,
  type ValidationStats,
  type MatchResult,
  type PropertyMatch,
  type DiagnosticReport,
  type PageContext,
  
  // Constants
  VALIDATION_CODES,
  
  // Validation Functions
  validateBundle,
  verifyElementMatch,
  findMatchingElements,
  
  // Diagnostics
  generateDiagnosticReport,
  formatDiagnosticReport,
  
  // Utilities
  isValidBundle,
  getQualityLevel
} from './validator';

// ============================================================================
// HIGHLIGHTS
// ============================================================================

export {
  // Types
  type HighlightStyle,
  type HighlightConfig,
  type HighlightInstance,
  type HighlightManagerState,
  
  // Constants
  STYLE_PRESETS,
  DEFAULT_HIGHLIGHT_CONFIG,
  
  // Highlight Manager Class
  HighlightManager,
  
  // Standalone Functions
  quickHighlight,
  highlightSuccess,
  highlightError,
  highlightRecording,
  highlightReplay,
  clearAllHighlights,
  removeHighlight,
  highlightBoundingBox,
  flashHighlight,
  
  // Manager Singleton
  getDefaultManager,
  resetDefaultManager,
  
  // Styles
  removeInjectedStyles,
  
  // Scroll Integration
  scrollAndHighlight,
  ensureVisibleAndHighlight
} from './highlights';

// ============================================================================
// CONVENIENCE RE-EXPORTS FROM TYPES
// ============================================================================

// Re-export key types from core/types for convenience
export type {
  LocatorBundle,
  BoundingBox,
  LocatorTier
} from '../types';

export {
  LOCATOR_TIERS,
  ELEMENT_TIMEOUT_MS,
  RETRY_INTERVAL_MS,
  BOUNDING_BOX_RADIUS_PX,
  FUZZY_TEXT_THRESHOLD,
  createEmptyBundle,
  createBundle,
  createBoundingBox,
  hasXPath,
  hasId,
  hasName,
  hasAria,
  hasPlaceholder,
  hasDataAttrs,
  hasText,
  hasBounding,
  isInIframe as bundleIsInIframe,
  isInShadowDom as bundleIsInShadowDom,
  getBoundingCenter
} from '../types';

// ============================================================================
// COMPOSITE FUNCTIONS
// ============================================================================

/**
 * Complete element location workflow
 * 
 * Builds bundle, validates, and locates element with full diagnostics.
 * 
 * @param element - Element to locate (for bundle building)
 * @param doc - Document to search in
 * @returns Location result with diagnostics
 * 
 * @example
 * ```typescript
 * const result = await locateWithDiagnostics(recordedElement, document);
 * 
 * if (!result.found) {
 *   console.log('Diagnostic report:', result.diagnostics);
 * }
 * ```
 */
export async function locateWithDiagnostics(
  bundle: import('../types').LocatorBundle,
  doc: Document = document
): Promise<{
  result: import('./locator-utils').LocateResult;
  validation: import('./validator').ValidationResult;
  diagnostics: import('./validator').DiagnosticReport | null;
}> {
  const { validateBundle: validate } = await import('./validator');
  const { locateElementWithRetry } = await import('./locator-utils');
  const { generateDiagnosticReport } = await import('./validator');

  const validation = validate(bundle);
  const result = await locateElementWithRetry(bundle, doc);

  let diagnostics: import('./validator').DiagnosticReport | null = null;
  
  if (!result.found) {
    diagnostics = generateDiagnosticReport(bundle, doc);
  }

  return { result, validation, diagnostics };
}

/**
 * Record and highlight an element interaction
 * 
 * Builds bundle from element and highlights it for recording feedback.
 * 
 * @param element - Element being recorded
 * @param eventType - Type of event being recorded
 * @returns Built bundle and highlight ID
 */
export function recordElementInteraction(
  element: Element,
  eventType: string
): {
  bundle: import('../types').LocatorBundle;
  highlightId: string;
  qualityScore: number;
} {
  const { buildBundle: build } = require('./bundle-builder');
  const { highlightRecording: highlight } = require('./highlights');

  const buildResult = build(element);
  const highlightId = highlight(element, `Recording: ${eventType}`);

  return {
    bundle: buildResult.bundle,
    highlightId,
    qualityScore: buildResult.qualityScore
  };
}

/**
 * Replay step with visual feedback
 * 
 * Locates element, highlights it, and returns result.
 * 
 * @param bundle - Locator bundle from recorded step
 * @param stepNumber - Step number for display
 * @param doc - Document to search in
 * @returns Location result with highlight ID
 */
export async function replayStepWithHighlight(
  bundle: import('../types').LocatorBundle,
  stepNumber: number,
  doc: Document = document
): Promise<{
  found: boolean;
  element: Element | null;
  highlightId: string | null;
  strategy: string | null;
  confidence: number;
}> {
  const { locateElementWithRetry } = await import('./locator-utils');
  const { highlightReplay } = await import('./highlights');

  const result = await locateElementWithRetry(bundle, doc);

  let highlightId: string | null = null;

  if (result.found && result.element) {
    highlightId = highlightReplay(result.element, stepNumber);
  } else {
    // Highlight expected location if available
    if (bundle.bounding) {
      const { highlightBoundingBox } = await import('./highlights');
      highlightId = highlightBoundingBox(bundle.bounding, {
        style: 'error',
        showTooltip: true,
        tooltipText: `Step ${stepNumber}: Element not found`
      });
    }
  }

  return {
    found: result.found,
    element: result.element,
    highlightId,
    strategy: result.strategy,
    confidence: result.confidence
  };
}

/**
 * Validate and score a bundle for reliability
 * 
 * Quick assessment of how reliable a bundle is for element location.
 * 
 * @param bundle - Bundle to assess
 * @returns Assessment result
 */
export function assessBundleReliability(
  bundle: import('../types').LocatorBundle
): {
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: number;
  recommendations: string[];
} {
  const { validateBundle: validate, getQualityLevel } = require('./validator');
  
  const validation = validate(bundle);
  const { level } = getQualityLevel(validation.qualityScore);
  
  const recommendations: string[] = [];
  
  for (const issue of validation.issues) {
    if (issue.suggestion) {
      recommendations.push(issue.suggestion);
    }
  }

  return {
    score: validation.qualityScore,
    level,
    issues: validation.issues.length,
    recommendations: [...new Set(recommendations)]
  };
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * LOCATOR LAYER ARCHITECTURE
 * 
 * The locator layer provides element location capabilities:
 * 
 * 1. Locator Utils (locator-utils.ts)
 *    - Individual strategy implementations
 *    - Main location function with fallback
 *    - Text similarity and position utilities
 * 
 * 2. Strategies (strategies.ts)
 *    - High-level strategy orchestration
 *    - Iframe and shadow DOM support
 *    - Element interaction helpers
 * 
 * 3. Bundle Builder (bundle-builder.ts)
 *    - Build LocatorBundle from elements
 *    - Context detection (iframe, shadow DOM)
 *    - XPath and CSS selector generation
 * 
 * 4. Validator (validator.ts)
 *    - Bundle integrity validation
 *    - Element-bundle matching
 *    - Diagnostic reporting
 * 
 * 5. Highlights (highlights.ts)
 *    - Visual element highlighting
 *    - Recording and replay feedback
 *    - Animation effects
 * 
 * LOCATORBUNDLE PROPERTIES (14 total):
 * 1. tag - Element tag name
 * 2. id - Element ID
 * 3. name - Form element name
 * 4. placeholder - Input placeholder
 * 5. aria - Aria-label
 * 6. text - Text content
 * 7. dataAttrs - Data-* attributes
 * 8. css - CSS selector
 * 9. xpath - XPath expression
 * 10. classes - CSS classes array
 * 11. pageUrl - Page URL
 * 12. bounding - BoundingBox coordinates
 * 13. iframeChain - Iframe indices
 * 14. shadowHosts - Shadow host selectors
 * 
 * USAGE RECOMMENDATIONS:
 * 
 * - For recording: Use buildBundle() to capture element info
 * - For replay: Use executeStrategy() with full fallback
 * - For validation: Use validateBundle() before storing
 * - For debugging: Use generateDiagnosticReport()
 * - For feedback: Use HighlightManager or convenience functions
 * 
 * CRITICAL CONSTANTS:
 * - ELEMENT_TIMEOUT_MS: 2000 (default retry timeout)
 * - RETRY_INTERVAL_MS: 150 (retry check interval)
 * - BOUNDING_BOX_RADIUS_PX: 200 (position match radius)
 * - FUZZY_TEXT_THRESHOLD: 0.4 (40% text similarity minimum)
 */
