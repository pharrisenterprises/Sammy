/**
 * Locator System - Central export barrel
 * @module core/locators
 * @version 1.0.0
 * 
 * Provides a unified entry point for the 9-tier locator fallback system.
 * 
 * Main Components:
 * - LocatorResolver: Orchestrates element location during replay
 * - LocatorGenerator: Creates LocatorBundles during recording
 * - StrategyRegistry: Manages locator strategies
 * - Individual Strategies: Placeholder, DataAttribute, FuzzyText, BoundingBox, CssSelector, FormLabel
 * 
 * @example
 * ```typescript
 * import {
 *   LocatorResolver,
 *   LocatorGenerator,
 *   getStrategyRegistry,
 * } from '@/core/locators';
 * 
 * // Recording
 * const generator = new LocatorGenerator();
 * const bundle = generator.generate(element);
 * 
 * // Replay
 * const resolver = new LocatorResolver();
 * const result = await resolver.resolve(bundle, document);
 * ```
 */

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export type {
  ILocatorStrategy,
  LocatorResult,
  LocatorContext,
} from './strategies/ILocatorStrategy';

// ============================================================================
// STRATEGY REGISTRY
// ============================================================================

export {
  StrategyRegistry,
  getStrategyRegistry,
  createStrategyRegistry,
  resetStrategyRegistry,
  DEFAULT_STRATEGY_ORDER,
  type StrategyName,
  type RegistryEntry,
  type RegistryConfig,
  type StrategyFilter,
} from './StrategyRegistry';

// ============================================================================
// LOCATOR RESOLVER (Replay)
// ============================================================================

export {
  LocatorResolver,
  getLocatorResolver,
  createLocatorResolver,
  resetLocatorResolver,
  resolveElement,
  resolveElementSync,
  delay,
  createResolverConfig,
  meetsConfidenceThreshold,
  compareBestResult,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRY_INTERVAL_MS,
  HIGH_CONFIDENCE_THRESHOLD,
  MAX_RETRY_ATTEMPTS,
  type ResolverConfig,
  type StrategyAttempt,
  type ResolutionResult,
  type ResolutionProgressCallback,
} from './LocatorResolver';

// ============================================================================
// LOCATOR GENERATOR (Recording)
// ============================================================================

export {
  LocatorGenerator,
  getLocatorGenerator,
  createLocatorGenerator,
  resetLocatorGenerator,
  generateBundle,
  validateBundle,
  getVisibleText,
  shouldIgnoreDataAttr,
  extractDataAttributes,
  getIframeChain,
  getShadowHostChain,
  generateXPath,
  generateCssSelector,
  getBoundingBox,
  MAX_TEXT_LENGTH,
  MAX_CLASSES,
  MAX_DATA_ATTRS,
  IGNORED_DATA_ATTRS,
  IGNORED_DATA_PREFIXES,
  NO_TEXT_TAGS,
  type GeneratorConfig,
  type IframeInfo,
  type ShadowHostInfo,
  type ValidationResult,
} from './LocatorGenerator';

// ============================================================================
// STRATEGIES - Tier 5: Placeholder (70% confidence)
// ============================================================================

export {
  PlaceholderStrategy,
  getPlaceholderStrategy,
  createPlaceholderStrategy,
  normalizePlaceholder,
  buildPlaceholderSelector,
  placeholderSimilarity,
  supportsPlaceholder,
  STRATEGY_NAME as PLACEHOLDER_STRATEGY_NAME,
  STRATEGY_PRIORITY as PLACEHOLDER_STRATEGY_PRIORITY,
  BASE_CONFIDENCE as PLACEHOLDER_BASE_CONFIDENCE,
} from './strategies/PlaceholderStrategy';

// ============================================================================
// STRATEGIES - Tier 6: Data Attribute (65% confidence)
// ============================================================================

export {
  DataAttributeStrategy,
  getDataAttributeStrategy,
  createDataAttributeStrategy,
  isTestingAttribute,
  shouldIgnoreAttribute,
  getAttributePriority,
  scanDataAttributes,
  STRATEGY_NAME as DATA_ATTR_STRATEGY_NAME,
  STRATEGY_PRIORITY as DATA_ATTR_STRATEGY_PRIORITY,
  BASE_CONFIDENCE as DATA_ATTR_BASE_CONFIDENCE,
  TESTING_DATA_ATTRIBUTES,
  IGNORED_DATA_ATTRIBUTES,
} from './strategies/DataAttributeStrategy';

// ============================================================================
// STRATEGIES - Tier 7: Fuzzy Text (40% confidence)
// ============================================================================

export {
  FuzzyTextStrategy,
  getFuzzyTextStrategy,
  createFuzzyTextStrategy,
  normalizeText,
  extractWords,
  diceCoefficient,
  STRATEGY_NAME as FUZZY_TEXT_STRATEGY_NAME,
  STRATEGY_PRIORITY as FUZZY_TEXT_STRATEGY_PRIORITY,
  BASE_CONFIDENCE as FUZZY_TEXT_BASE_CONFIDENCE,
  SIMILARITY_THRESHOLD as FUZZY_TEXT_SIMILARITY_THRESHOLD,
} from './strategies/FuzzyTextStrategy';

// ============================================================================
// STRATEGIES - Tier 8: Bounding Box (35% confidence)
// ============================================================================

export {
  BoundingBoxStrategy,
  getBoundingBoxStrategy,
  createBoundingBoxStrategy,
  euclideanDistance,
  getCenter,
  boxDistance,
  sizesMatch,
  isElementVisible,
  isElementInteractable,
  findNearbyElements,
  spatialSearch,
  STRATEGY_NAME as BBOX_STRATEGY_NAME,
  STRATEGY_PRIORITY as BBOX_STRATEGY_PRIORITY,
  BASE_CONFIDENCE as BBOX_BASE_CONFIDENCE,
  MAX_DISTANCE_THRESHOLD,
  type BoundingBox,
  type SpatialCandidate,
  type SpatialSearchResult,
} from './strategies/BoundingBoxStrategy';

// ============================================================================
// STRATEGIES - Supplementary: CSS Selector (60% confidence)
// ============================================================================

export {
  CssSelectorStrategy,
  getCssSelectorStrategy,
  createCssSelectorStrategy,
  shouldIgnoreClass,
  filterStableClasses,
  escapeCssValue,
  buildClassSelector,
  buildAttributeSelector,
  buildCombinedSelector,
  calculateSpecificity,
  testSelectorUniqueness,
  generateSelectorVariants,
  selectBestSelector,
  STRATEGY_NAME as CSS_STRATEGY_NAME,
  STRATEGY_PRIORITY as CSS_STRATEGY_PRIORITY,
  BASE_CONFIDENCE as CSS_BASE_CONFIDENCE,
  IGNORED_CLASS_PATTERNS,
  SAFE_ATTRIBUTES,
  type GeneratedSelector,
  type SelectorOptions,
} from './strategies/CssSelectorStrategy';

// ============================================================================
// STRATEGIES - Supplementary: Form Label (72% confidence)
// ============================================================================

export {
  FormLabelStrategy,
  getFormLabelStrategy,
  createFormLabelStrategy,
  normalizeText as normalizeFormLabelText,
  textSimilarity,
  isLabelableElement,
  getExplicitLabel,
  getImplicitLabel,
  getAriaLabelElement,
  getProximityLabel,
  getLabelAssociations,
  getInputLabelText,
  findLabeledInputs,
  findInputsByLabelText,
  STRATEGY_NAME as FORM_LABEL_STRATEGY_NAME,
  STRATEGY_PRIORITY as FORM_LABEL_STRATEGY_PRIORITY,
  BASE_CONFIDENCE as FORM_LABEL_BASE_CONFIDENCE,
  LABELABLE_ELEMENTS,
  LABELED_INPUT_TYPES,
  type LabelAssociationType,
  type LabelAssociation,
  type LabeledInputCandidate,
} from './strategies/FormLabelStrategy';

// ============================================================================
// STRATEGY COLLECTION HELPERS
// ============================================================================

/**
 * Strategy names in tier order
 */
export const STRATEGY_TIERS = {
  // Not yet implemented
  TIER_1_XPATH: 'xpath',
  TIER_2_ID: 'id',
  TIER_3_NAME: 'name',
  TIER_4_ARIA: 'aria-label',
  // Implemented
  TIER_5_PLACEHOLDER: 'placeholder',
  TIER_6_DATA_ATTR: 'data-attribute',
  TIER_7_FUZZY_TEXT: 'fuzzy-text',
  TIER_8_BOUNDING_BOX: 'bounding-box',
  SUPPLEMENTARY_CSS: 'css-selector',
  SUPPLEMENTARY_FORM_LABEL: 'form-label',
} as const;

/**
 * Strategy confidence levels
 */
export const STRATEGY_CONFIDENCE = {
  XPATH: 1.0,
  ID: 0.9,
  NAME: 0.8,
  ARIA_LABEL: 0.75,
  PLACEHOLDER: 0.7,
  DATA_ATTRIBUTE: 0.65,
  CSS_SELECTOR: 0.6,
  FORM_LABEL: 0.72,
  FUZZY_TEXT: 0.4,
  BOUNDING_BOX: 0.35,
} as const;

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

/**
 * Creates a fully configured locator system
 * 
 * @returns Object with resolver, generator, and registry
 */
export function createLocatorSystem() {
  const {
    createStrategyRegistry,
    createLocatorResolver,
    createLocatorGenerator,
  } = require('./') as {
    createStrategyRegistry: typeof import('./StrategyRegistry').createStrategyRegistry;
    createLocatorResolver: typeof import('./LocatorResolver').createLocatorResolver;
    createLocatorGenerator: typeof import('./LocatorGenerator').createLocatorGenerator;
  };
  
  const registry = createStrategyRegistry();
  const resolver = createLocatorResolver({ registry });
  const generator = createLocatorGenerator({ registry });
  
  return { resolver, generator, registry };
}

/**
 * Gets the global locator system singletons
 * 
 * @returns Object with resolver, generator, and registry
 */
export function getLocatorSystem() {
  const {
    getStrategyRegistry,
    getLocatorResolver,
    getLocatorGenerator,
  } = require('./') as {
    getStrategyRegistry: typeof import('./StrategyRegistry').getStrategyRegistry;
    getLocatorResolver: typeof import('./LocatorResolver').getLocatorResolver;
    getLocatorGenerator: typeof import('./LocatorGenerator').getLocatorGenerator;
  };
  
  return {
    resolver: getLocatorResolver(),
    generator: getLocatorGenerator(),
    registry: getStrategyRegistry(),
  };
}

/**
 * Resets all locator system singletons (for testing)
 */
export function resetLocatorSystem(): void {
  const {
    resetStrategyRegistry,
    resetLocatorResolver,
    resetLocatorGenerator,
  } = require('./') as {
    resetStrategyRegistry: typeof import('./StrategyRegistry').resetStrategyRegistry;
    resetLocatorResolver: typeof import('./LocatorResolver').resetLocatorResolver;
    resetLocatorGenerator: typeof import('./LocatorGenerator').resetLocatorGenerator;
  };
  
  resetLocatorResolver();
  resetLocatorGenerator();
  resetStrategyRegistry();
}

// ============================================================================
// LEGACY EXPORTS (OLD ARCHITECTURE - TO BE REFACTORED)
// ============================================================================

// Re-export old locator utilities for backward compatibility
export * from './locator-utils';
export * from './strategies';
export * from './bundle-builder';
export * from './validator';
export * from './highlights';
