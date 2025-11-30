/**
 * Locator Strategies - Central export barrel
 * @module core/locators/strategies
 * @version 1.0.0
 * 
 * Exports all implemented locator strategy implementations for the 9-tier
 * fallback chain plus supplementary strategies.
 * 
 * Strategy Tiers (by priority):
 * 1. XPath - 100% confidence, exact path match [NOT YET IMPLEMENTED]
 * 2. ID - 90% confidence, unique identifier [NOT YET IMPLEMENTED]
 * 3. Name - 80% confidence, form element name [NOT YET IMPLEMENTED]
 * 4. ARIA Label - 75% confidence, accessibility label [NOT YET IMPLEMENTED]
 * 5. Placeholder - 70% confidence, input placeholder [IMPLEMENTED]
 * 6. Data Attribute - 65% confidence, data-* attributes [IMPLEMENTED]
 * 7. Fuzzy Text - 40% confidence, text content match [IMPLEMENTED]
 * 8. Bounding Box - 35% confidence, spatial positioning [IMPLEMENTED]
 * 
 * Supplementary:
 * - CSS Selector - 60% confidence, generated selectors [IMPLEMENTED]
 * - Form Label - 72% confidence, label associations [IMPLEMENTED]
 * 
 * @example
 * ```typescript
 * import {
 *   PlaceholderStrategy,
 *   DataAttributeStrategy,
 *   getImplementedStrategies,
 * } from '@/core/locators/strategies';
 * 
 * const placeholder = new PlaceholderStrategy();
 * const result = placeholder.find(bundle, context);
 * ```
 */

// ============================================================================
// CORE INTERFACE
// ============================================================================

export type {
  ILocatorStrategy,
  LocatorResult,
  LocatorContext,
} from './ILocatorStrategy';

// ============================================================================
// TIER 5: PLACEHOLDER STRATEGY (70% confidence)
// ============================================================================

export {
  PlaceholderStrategy,
  getPlaceholderStrategy,
  createPlaceholderStrategy,
  normalizePlaceholder,
  buildPlaceholderSelector,
  placeholderSimilarity,
  supportsPlaceholder,
  getPlaceholder,
  STRATEGY_NAME as PLACEHOLDER_STRATEGY_NAME,
  STRATEGY_PRIORITY as PLACEHOLDER_PRIORITY,
  BASE_CONFIDENCE as PLACEHOLDER_CONFIDENCE,
  PARTIAL_MATCH_PENALTY as PLACEHOLDER_PARTIAL_MATCH_PENALTY,
  AMBIGUITY_PENALTY as PLACEHOLDER_AMBIGUITY_PENALTY,
  PLACEHOLDER_ELEMENTS,
  PLACEHOLDER_INPUT_TYPES,
} from './PlaceholderStrategy';

// ============================================================================
// TIER 6: DATA ATTRIBUTE STRATEGY (65% confidence)
// ============================================================================

export {
  DataAttributeStrategy,
  getDataAttributeStrategy,
  createDataAttributeStrategy,
  isTestingAttribute,
  shouldIgnoreAttribute,
  getAttributePriority,
  scanDataAttributes,
  buildDataAttrSelector,
  buildMultiAttrSelector,
  compareDataAttributes,
  extractDataAttrsFromElement,
  STRATEGY_NAME as DATA_ATTR_STRATEGY_NAME,
  STRATEGY_PRIORITY as DATA_ATTR_PRIORITY,
  BASE_CONFIDENCE as DATA_ATTR_CONFIDENCE,
  TESTING_ATTR_BONUS as DATA_ATTR_TESTING_BONUS,
  AMBIGUITY_PENALTY as DATA_ATTR_AMBIGUITY_PENALTY,
  PARTIAL_MATCH_PENALTY as DATA_ATTR_PARTIAL_MATCH_PENALTY,
  TESTING_DATA_ATTRIBUTES,
  IGNORED_DATA_ATTRIBUTES,
} from './DataAttributeStrategy';

// ============================================================================
// TIER 7: FUZZY TEXT STRATEGY (40% confidence)
// ============================================================================

export {
  FuzzyTextStrategy,
  getFuzzyTextStrategy,
  createFuzzyTextStrategy,
  normalizeText as normalizeFuzzyText,
  extractWords,
  diceCoefficient,
  bigramSimilarity,
  compareText,
  getVisibleText as getElementVisibleText,
  isPriorityTag,
  findTextCandidates,
  STRATEGY_NAME as FUZZY_TEXT_STRATEGY_NAME,
  STRATEGY_PRIORITY as FUZZY_TEXT_PRIORITY,
  BASE_CONFIDENCE as FUZZY_TEXT_CONFIDENCE,
  SIMILARITY_THRESHOLD as FUZZY_TEXT_SIMILARITY_THRESHOLD,
  HIGH_SIMILARITY_THRESHOLD as FUZZY_TEXT_HIGH_SIMILARITY_THRESHOLD,
  EXACT_MATCH_THRESHOLD as FUZZY_TEXT_EXACT_MATCH_THRESHOLD,
  HIGH_SIMILARITY_BONUS as FUZZY_TEXT_HIGH_SIMILARITY_BONUS,
  EXACT_MATCH_BONUS as FUZZY_TEXT_EXACT_MATCH_BONUS,
  AMBIGUITY_PENALTY as FUZZY_TEXT_AMBIGUITY_PENALTY,
  MAX_TEXT_LENGTH as FUZZY_TEXT_MAX_LENGTH,
  MIN_TEXT_LENGTH as FUZZY_TEXT_MIN_LENGTH,
  PRIORITY_TAGS as FUZZY_TEXT_PRIORITY_TAGS,
  SKIP_TAGS as FUZZY_TEXT_SKIP_TAGS,
} from './FuzzyTextStrategy';

// ============================================================================
// TIER 8: BOUNDING BOX STRATEGY (35% confidence)
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
  getVisibleElements,
  findNearbyElements,
  spatialSearch,
  STRATEGY_NAME as BBOX_STRATEGY_NAME,
  STRATEGY_PRIORITY as BBOX_PRIORITY,
  BASE_CONFIDENCE as BBOX_CONFIDENCE,
  MAX_DISTANCE_THRESHOLD as BBOX_MAX_DISTANCE,
  HIGH_CONFIDENCE_DISTANCE as BBOX_HIGH_CONFIDENCE_DISTANCE,
  MEDIUM_CONFIDENCE_DISTANCE as BBOX_MEDIUM_CONFIDENCE_DISTANCE,
  CLOSE_MATCH_BONUS as BBOX_CLOSE_MATCH_BONUS,
  MEDIUM_MATCH_BONUS as BBOX_MEDIUM_MATCH_BONUS,
  TAG_MATCH_BONUS as BBOX_TAG_MATCH_BONUS,
  SIZE_MATCH_BONUS as BBOX_SIZE_MATCH_BONUS,
  AMBIGUITY_PENALTY as BBOX_AMBIGUITY_PENALTY,
  MIN_ELEMENT_SIZE as BBOX_MIN_ELEMENT_SIZE,
  MAX_CANDIDATES as BBOX_MAX_CANDIDATES,
  SIZE_TOLERANCE as BBOX_SIZE_TOLERANCE,
  type BoundingBox,
  type SpatialCandidate,
  type SpatialSearchResult,
} from './BoundingBoxStrategy';

// ============================================================================
// SUPPLEMENTARY: CSS SELECTOR STRATEGY (60% confidence)
// ============================================================================

export {
  CssSelectorStrategy,
  getCssSelectorStrategy,
  createCssSelectorStrategy,
  shouldIgnoreClass,
  filterStableClasses,
  escapeCssValue,
  buildIdSelector,
  buildClassSelector,
  buildAttributeSelector,
  buildCombinedSelector,
  calculateSpecificity,
  testSelectorUniqueness,
  generateSelectorVariants,
  selectBestSelector,
  STRATEGY_NAME as CSS_STRATEGY_NAME,
  STRATEGY_PRIORITY as CSS_PRIORITY,
  BASE_CONFIDENCE as CSS_CONFIDENCE,
  UNIQUE_SELECTOR_BONUS as CSS_UNIQUE_SELECTOR_BONUS,
  ID_SELECTOR_BONUS as CSS_ID_SELECTOR_BONUS,
  AMBIGUITY_PENALTY as CSS_AMBIGUITY_PENALTY,
  CLASS_ONLY_PENALTY as CSS_CLASS_ONLY_PENALTY,
  MAX_CLASSES_IN_SELECTOR as CSS_MAX_CLASSES,
  IGNORED_CLASS_PATTERNS as CSS_IGNORED_CLASS_PATTERNS,
  SAFE_ATTRIBUTES as CSS_SAFE_ATTRIBUTES,
  type GeneratedSelector,
  type SelectorOptions,
} from './CssSelectorStrategy';

// ============================================================================
// SUPPLEMENTARY: FORM LABEL STRATEGY (72% confidence)
// ============================================================================

export {
  FormLabelStrategy,
  getFormLabelStrategy,
  createFormLabelStrategy,
  normalizeText as normalizeLabelText,
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
  STRATEGY_PRIORITY as FORM_LABEL_PRIORITY,
  BASE_CONFIDENCE as FORM_LABEL_CONFIDENCE,
  EXPLICIT_LABEL_BONUS as FORM_LABEL_EXPLICIT_BONUS,
  IMPLICIT_LABEL_BONUS as FORM_LABEL_IMPLICIT_BONUS,
  ARIA_LABEL_BONUS as FORM_LABEL_ARIA_BONUS,
  PROXIMITY_PENALTY as FORM_LABEL_PROXIMITY_PENALTY,
  AMBIGUITY_PENALTY as FORM_LABEL_AMBIGUITY_PENALTY,
  TAG_MATCH_BONUS as FORM_LABEL_TAG_MATCH_BONUS,
  LABEL_SIMILARITY_THRESHOLD,
  MAX_PROXIMITY_DISTANCE as FORM_LABEL_MAX_PROXIMITY_DISTANCE,
  LABELABLE_ELEMENTS,
  LABELED_INPUT_TYPES,
  type LabelAssociationType,
  type LabelAssociation,
  type LabeledInputCandidate,
} from './FormLabelStrategy';

// ============================================================================
// STRATEGY METADATA
// ============================================================================

/**
 * Strategy tier definitions (only implemented strategies)
 */
export const IMPLEMENTED_STRATEGY_TIERS = {
  /** Tier 5: Placeholder - input hint text */
  TIER_5: {
    name: 'placeholder',
    priority: 5,
    confidence: 0.7,
    description: 'Input placeholder text',
  },
  /** Tier 6: Data attributes - testing identifiers */
  TIER_6: {
    name: 'data-attribute',
    priority: 6,
    confidence: 0.65,
    description: 'Data-* attributes',
  },
  /** Tier 7: Fuzzy text - content matching */
  TIER_7: {
    name: 'fuzzy-text',
    priority: 7,
    confidence: 0.4,
    description: 'Text content similarity',
  },
  /** Tier 8: Bounding box - spatial positioning */
  TIER_8: {
    name: 'bounding-box',
    priority: 8,
    confidence: 0.35,
    description: 'Coordinate-based location',
  },
} as const;

/**
 * Supplementary strategy definitions (only implemented strategies)
 */
export const IMPLEMENTED_SUPPLEMENTARY_STRATEGIES = {
  /** CSS Selector - generated selectors */
  CSS_SELECTOR: {
    name: 'css-selector',
    priority: 9,
    confidence: 0.6,
    description: 'Generated CSS selectors',
  },
  /** Form Label - label associations */
  FORM_LABEL: {
    name: 'form-label',
    priority: 10,
    confidence: 0.72,
    description: 'Form label associations',
  },
} as const;

/**
 * Complete strategy tier definitions (including not-yet-implemented)
 */
export const ALL_STRATEGY_TIERS = {
  /** Tier 1: XPath - highest confidence [NOT IMPLEMENTED] */
  TIER_1: {
    name: 'xpath',
    priority: 1,
    confidence: 1.0,
    description: 'Exact XPath match',
    implemented: false,
  },
  /** Tier 2: ID - very high confidence [NOT IMPLEMENTED] */
  TIER_2: {
    name: 'id',
    priority: 2,
    confidence: 0.9,
    description: 'Unique element ID',
    implemented: false,
  },
  /** Tier 3: Name - high confidence for forms [NOT IMPLEMENTED] */
  TIER_3: {
    name: 'name',
    priority: 3,
    confidence: 0.8,
    description: 'Form element name attribute',
    implemented: false,
  },
  /** Tier 4: ARIA - accessibility-based [NOT IMPLEMENTED] */
  TIER_4: {
    name: 'aria-label',
    priority: 4,
    confidence: 0.75,
    description: 'ARIA label attribute',
    implemented: false,
  },
  /** Tier 5: Placeholder - input hint text */
  TIER_5: {
    name: 'placeholder',
    priority: 5,
    confidence: 0.7,
    description: 'Input placeholder text',
    implemented: true,
  },
  /** Tier 6: Data attributes - testing identifiers */
  TIER_6: {
    name: 'data-attribute',
    priority: 6,
    confidence: 0.65,
    description: 'Data-* attributes',
    implemented: true,
  },
  /** Tier 7: Fuzzy text - content matching */
  TIER_7: {
    name: 'fuzzy-text',
    priority: 7,
    confidence: 0.4,
    description: 'Text content similarity',
    implemented: true,
  },
  /** Tier 8: Bounding box - spatial positioning */
  TIER_8: {
    name: 'bounding-box',
    priority: 8,
    confidence: 0.35,
    description: 'Coordinate-based location',
    implemented: true,
  },
} as const;

/**
 * All supplementary strategy definitions (including not-yet-implemented)
 */
export const ALL_SUPPLEMENTARY_STRATEGIES = {
  /** CSS Selector - generated selectors */
  CSS_SELECTOR: {
    name: 'css-selector',
    priority: 9,
    confidence: 0.6,
    description: 'Generated CSS selectors',
    implemented: true,
  },
  /** Form Label - label associations */
  FORM_LABEL: {
    name: 'form-label',
    priority: 10,
    confidence: 0.72,
    description: 'Form label associations',
    implemented: true,
  },
} as const;

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

import type { ILocatorStrategy } from './ILocatorStrategy';

/**
 * Gets all implemented strategy singleton instances in priority order
 * 
 * @returns Array of strategy instances (6 total)
 */
export function getImplementedStrategies(): ILocatorStrategy[] {
  const {
    getPlaceholderStrategy,
    getDataAttributeStrategy,
    getFuzzyTextStrategy,
    getBoundingBoxStrategy,
    getCssSelectorStrategy,
    getFormLabelStrategy,
  } = require('./') as {
    getPlaceholderStrategy: typeof import('./PlaceholderStrategy').getPlaceholderStrategy;
    getDataAttributeStrategy: typeof import('./DataAttributeStrategy').getDataAttributeStrategy;
    getFuzzyTextStrategy: typeof import('./FuzzyTextStrategy').getFuzzyTextStrategy;
    getBoundingBoxStrategy: typeof import('./BoundingBoxStrategy').getBoundingBoxStrategy;
    getCssSelectorStrategy: typeof import('./CssSelectorStrategy').getCssSelectorStrategy;
    getFormLabelStrategy: typeof import('./FormLabelStrategy').getFormLabelStrategy;
  };
  
  return [
    getPlaceholderStrategy(),
    getDataAttributeStrategy(),
    getFuzzyTextStrategy(),
    getBoundingBoxStrategy(),
    getCssSelectorStrategy(),
    getFormLabelStrategy(),
  ];
}

/**
 * Creates new instances of all implemented strategies
 * 
 * @returns Array of new strategy instances (6 total)
 */
export function createImplementedStrategies(): ILocatorStrategy[] {
  const {
    createPlaceholderStrategy,
    createDataAttributeStrategy,
    createFuzzyTextStrategy,
    createBoundingBoxStrategy,
    createCssSelectorStrategy,
    createFormLabelStrategy,
  } = require('./') as {
    createPlaceholderStrategy: typeof import('./PlaceholderStrategy').createPlaceholderStrategy;
    createDataAttributeStrategy: typeof import('./DataAttributeStrategy').createDataAttributeStrategy;
    createFuzzyTextStrategy: typeof import('./FuzzyTextStrategy').createFuzzyTextStrategy;
    createBoundingBoxStrategy: typeof import('./BoundingBoxStrategy').createBoundingBoxStrategy;
    createCssSelectorStrategy: typeof import('./CssSelectorStrategy').createCssSelectorStrategy;
    createFormLabelStrategy: typeof import('./FormLabelStrategy').createFormLabelStrategy;
  };
  
  return [
    createPlaceholderStrategy(),
    createDataAttributeStrategy(),
    createFuzzyTextStrategy(),
    createBoundingBoxStrategy(),
    createCssSelectorStrategy(),
    createFormLabelStrategy(),
  ];
}

/**
 * Gets strategies for the main tier fallback chain only (implemented)
 * 
 * @returns Array of main tier strategies (4 total: tiers 5-8)
 */
export function getMainTierStrategies(): ILocatorStrategy[] {
  const {
    getPlaceholderStrategy,
    getDataAttributeStrategy,
    getFuzzyTextStrategy,
    getBoundingBoxStrategy,
  } = require('./') as {
    getPlaceholderStrategy: typeof import('./PlaceholderStrategy').getPlaceholderStrategy;
    getDataAttributeStrategy: typeof import('./DataAttributeStrategy').getDataAttributeStrategy;
    getFuzzyTextStrategy: typeof import('./FuzzyTextStrategy').getFuzzyTextStrategy;
    getBoundingBoxStrategy: typeof import('./BoundingBoxStrategy').getBoundingBoxStrategy;
  };
  
  return [
    getPlaceholderStrategy(),
    getDataAttributeStrategy(),
    getFuzzyTextStrategy(),
    getBoundingBoxStrategy(),
  ];
}

/**
 * Gets only high-confidence strategies (>= 70%)
 * 
 * @returns Array of high-confidence strategies (2 total)
 */
export function getHighConfidenceStrategies(): ILocatorStrategy[] {
  const {
    getPlaceholderStrategy,
    getFormLabelStrategy,
  } = require('./') as {
    getPlaceholderStrategy: typeof import('./PlaceholderStrategy').getPlaceholderStrategy;
    getFormLabelStrategy: typeof import('./FormLabelStrategy').getFormLabelStrategy;
  };
  
  return [
    getPlaceholderStrategy(), // 70%
    getFormLabelStrategy(),   // 72%
  ];
}

/**
 * Gets only low-confidence/fallback strategies (< 50%)
 * 
 * @returns Array of fallback strategies (2 total)
 */
export function getFallbackStrategies(): ILocatorStrategy[] {
  const {
    getFuzzyTextStrategy,
    getBoundingBoxStrategy,
  } = require('./') as {
    getFuzzyTextStrategy: typeof import('./FuzzyTextStrategy').getFuzzyTextStrategy;
    getBoundingBoxStrategy: typeof import('./BoundingBoxStrategy').getBoundingBoxStrategy;
  };
  
  return [
    getFuzzyTextStrategy(),   // 40%
    getBoundingBoxStrategy(), // 35%
  ];
}

/**
 * Gets a strategy by name (only implemented strategies)
 * 
 * @param name - Strategy name
 * @returns Strategy instance or undefined
 */
export function getStrategyByName(name: string): ILocatorStrategy | undefined {
  const strategies = getImplementedStrategies();
  return strategies.find(s => s.name === name);
}

/**
 * Gets strategies filtered by minimum confidence (only implemented)
 * 
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @returns Array of strategies meeting threshold
 */
export function getStrategiesByConfidence(minConfidence: number): ILocatorStrategy[] {
  return getImplementedStrategies().filter(s => s.baseConfidence >= minConfidence);
}

// ============================================================================
// STRATEGY NAME CONSTANTS
// ============================================================================

/**
 * Implemented strategy names
 */
export const IMPLEMENTED_STRATEGY_NAMES = {
  PLACEHOLDER: 'placeholder',
  DATA_ATTRIBUTE: 'data-attribute',
  FUZZY_TEXT: 'fuzzy-text',
  BOUNDING_BOX: 'bounding-box',
  CSS_SELECTOR: 'css-selector',
  FORM_LABEL: 'form-label',
} as const;

/**
 * All strategy names (including not-yet-implemented)
 */
export const ALL_STRATEGY_NAMES = {
  XPATH: 'xpath',
  ID: 'id',
  NAME: 'name',
  ARIA_LABEL: 'aria-label',
  PLACEHOLDER: 'placeholder',
  DATA_ATTRIBUTE: 'data-attribute',
  FUZZY_TEXT: 'fuzzy-text',
  BOUNDING_BOX: 'bounding-box',
  CSS_SELECTOR: 'css-selector',
  FORM_LABEL: 'form-label',
} as const;

/**
 * Implemented strategy names in priority order
 */
export const IMPLEMENTED_STRATEGY_PRIORITY_ORDER = [
  'placeholder',
  'data-attribute',
  'fuzzy-text',
  'bounding-box',
  'css-selector',
  'form-label',
] as const;

/**
 * All strategy names in priority order (including not-yet-implemented)
 */
export const ALL_STRATEGY_PRIORITY_ORDER = [
  'xpath',
  'id',
  'name',
  'aria-label',
  'placeholder',
  'data-attribute',
  'fuzzy-text',
  'bounding-box',
  'css-selector',
  'form-label',
] as const;

/**
 * Strategy type union (implemented only)
 */
export type ImplementedStrategyName = typeof IMPLEMENTED_STRATEGY_PRIORITY_ORDER[number];

/**
 * Strategy type union (all strategies)
 */
export type AllStrategyName = typeof ALL_STRATEGY_PRIORITY_ORDER[number];

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

/**
 * Confidence level categories
 */
export const CONFIDENCE_LEVELS = {
  /** Perfect match (100%) */
  PERFECT: 1.0,
  /** Very high confidence (90%+) */
  VERY_HIGH: 0.9,
  /** High confidence (75%+) */
  HIGH: 0.75,
  /** Medium confidence (60%+) */
  MEDIUM: 0.6,
  /** Low confidence (40%+) */
  LOW: 0.4,
  /** Very low confidence (<40%) */
  VERY_LOW: 0.35,
} as const;

/**
 * Maps implemented strategy names to their base confidence
 */
export const IMPLEMENTED_STRATEGY_BASE_CONFIDENCE: Record<string, number> = {
  'placeholder': 0.7,
  'data-attribute': 0.65,
  'fuzzy-text': 0.4,
  'bounding-box': 0.35,
  'css-selector': 0.6,
  'form-label': 0.72,
};

/**
 * Maps all strategy names to their base confidence (including not-yet-implemented)
 */
export const ALL_STRATEGY_BASE_CONFIDENCE: Record<string, number> = {
  'xpath': 1.0,
  'id': 0.9,
  'name': 0.8,
  'aria-label': 0.75,
  'placeholder': 0.7,
  'data-attribute': 0.65,
  'css-selector': 0.6,
  'form-label': 0.72,
  'fuzzy-text': 0.4,
  'bounding-box': 0.35,
};
