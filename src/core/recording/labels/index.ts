/**
 * Label Detection System - Barrel Export
 * @module core/recording/labels
 * @version 1.0.0
 * 
 * Comprehensive label detection system for form elements.
 * Provides multiple detection strategies with confidence scoring.
 * 
 * ## Quick Start
 * ```typescript
 * import { resolveLabel, getLabelForElement } from '@/core/recording/labels';
 * 
 * const result = resolveLabel(inputElement);
 * console.log(result.label, result.confidence);
 * 
 * // Or just get the label string
 * const label = getLabelForElement(inputElement);
 * ```
 * 
 * ## Custom Configuration
 * ```typescript
 * import { 
 *   LabelResolver, 
 *   LabelDetectorRegistry,
 *   AriaLabelDetector 
 * } from '@/core/recording/labels';
 * 
 * // Create custom registry
 * const registry = LabelDetectorRegistry.createWith(['aria-label', 'placeholder']);
 * 
 * // Create resolver with custom config
 * const resolver = new LabelResolver(registry, {
 *   strategy: 'best-confidence',
 *   minConfidence: 0.5,
 * });
 * ```
 * 
 * ## Available Detectors (Priority Order)
 * 1. GoogleFormsDetector (10) - Google Forms patterns (95%)
 * 2. AriaLabelDetector (20) - ARIA attributes (90%)
 * 3. AssociatedLabelDetector (25) - HTML form labels (85%)
 * 4. PlaceholderDetector (40) - Placeholder attributes (70%)
 * 5. BootstrapDetector (50) - Bootstrap CSS framework (75%)
 * 6. MaterialUIDetector (50) - Material-UI components (70%)
 * 7. SiblingDetector (60) - Sibling element proximity (60%)
 * 8. TextContentDetector (80) - Text content fallback (40-65%)
 */

// ============================================================================
// CORE INTERFACES AND TYPES
// ============================================================================

export {
  // Main interface
  type ILabelDetector,
  
  // Context and options
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  
  // Metadata types
  type LabelMetadata,
  type LabelSource,
  
  // Base class
  BaseLabelDetector,
  
  // Factory and utilities
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
  
  // Constants
  DETECTOR_PRIORITIES,
  CONFIDENCE_SCORES,
  
  // Helper functions
  cleanLabelText,
  getVisibleText,
} from './ILabelDetector';

// ============================================================================
// DETECTOR IMPLEMENTATIONS
// ============================================================================

// ARIA Label Detector (Priority: 20, Confidence: 90%)
export {
  AriaLabelDetector,
  createAriaLabelDetector,
  hasAriaLabel,
  ARIA_CONFIDENCE,
} from './AriaLabelDetector';

// Placeholder Detector (Priority: 40, Confidence: 70%)
export {
  PlaceholderDetector,
  createPlaceholderDetector,
  getPlaceholder,
  hasPlaceholder,
  PLACEHOLDER_CONFIDENCE,
} from './PlaceholderDetector';

// Associated Label Detector (Priority: 25, Confidence: 85%)
export {
  AssociatedLabelDetector,
  createAssociatedLabelDetector,
  getAssociatedLabels,
  hasAssociatedLabel,
  ASSOCIATION_CONFIDENCE,
} from './AssociatedLabelDetector';

// Text Content Detector (Priority: 80, Confidence: 40-65%)
export {
  TextContentDetector,
  createTextContentDetector,
  TEXT_CONTENT_CONFIDENCE,
} from './TextContentDetector';

// Google Forms Detector (Priority: 10, Confidence: 95%)
export {
  GoogleFormsDetector,
  createGoogleFormsDetector,
  isGoogleFormsElement,
  getGoogleFormsQuestionTitle,
  getGoogleFormsQuestionType,
  isGoogleFormsUrl,
  GOOGLE_FORMS_CONFIDENCE,
  QUESTION_TITLE_SELECTORS,
  QUESTION_CONTAINER_SELECTORS,
} from './GoogleFormsDetector';

// Bootstrap Detector (Priority: 50, Confidence: 75%)
export {
  BootstrapDetector,
  createBootstrapDetector,
  isBootstrapElement,
  getBootstrapVersion,
  isBootstrapFormControl,
  findBootstrapContainer,
  BOOTSTRAP_CONFIDENCE,
} from './BootstrapDetector';

// Material-UI Detector (Priority: 50, Confidence: 70%)
export {
  MaterialUIDetector,
  createMaterialUIDetector,
  isMUIElement,
  getMUIVersion,
  isMUIFormControl,
  findMUIFormControl,
  getMUITextFieldVariant,
  MUI_CONFIDENCE,
} from './MaterialUIDetector';

// Sibling Detector (Priority: 60, Confidence: 60%)
export {
  SiblingDetector,
  createSiblingDetector,
  getPreviousSiblingLabel,
  getPreviousTextNode,
  hasSiblingLabel,
  getTableHeaderForCell,
  SIBLING_CONFIDENCE,
  LABEL_ELEMENTS,
  INTERACTIVE_ELEMENTS,
} from './SiblingDetector';

// ============================================================================
// REGISTRY
// ============================================================================

export {
  // Main class
  LabelDetectorRegistry,
  
  // Factory methods
  createDefaultDetectors,
  getDefaultDetectorNames,
  createDetectorByName,
  
  // Convenience functions
  getRegistry,
  getEnabledDetectors,
  registerDetector,
  unregisterDetector,
  
  // Types
  type RegistryEventType,
  type RegistryEvent,
  type RegistryEventListener,
  type RegistrationOptions,
  type RegistryConfig,
  type RegistryStats,
} from './LabelDetectorRegistry';

// ============================================================================
// RESOLVER
// ============================================================================

export {
  // Main class
  LabelResolver,
  
  // Factory functions
  createLabelResolver,
  createResolverWithRegistry,
  createFastResolver,
  createAccurateResolver,
  
  // Singleton functions
  getResolver,
  resetResolver,
  resolveLabel,
  getLabelForElement,
  getAllLabelCandidates,
  elementHasLabel,
  
  // Utility functions
  sortByConfidence,
  sortByPriority,
  sortByWeightedScore,
  filterByConfidence,
  getUniqueLabels,
  findCandidateByDetector,
  
  // Types
  type ResolutionStrategy,
  type LabelCandidate,
  type ResolvedLabel,
  type ResolverConfig,
  
  // Constants
  DEFAULT_RESOLVER_CONFIG,
} from './LabelResolver';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

import { AriaLabelDetector } from './AriaLabelDetector';
import { PlaceholderDetector } from './PlaceholderDetector';
import { AssociatedLabelDetector } from './AssociatedLabelDetector';
import { TextContentDetector } from './TextContentDetector';
import { GoogleFormsDetector } from './GoogleFormsDetector';
import { BootstrapDetector } from './BootstrapDetector';
import { MaterialUIDetector } from './MaterialUIDetector';
import { SiblingDetector } from './SiblingDetector';

import {
  createAriaLabelDetector,
} from './AriaLabelDetector';

import {
  createPlaceholderDetector,
} from './PlaceholderDetector';

import {
  createAssociatedLabelDetector,
} from './AssociatedLabelDetector';

import {
  createTextContentDetector,
} from './TextContentDetector';

import {
  createGoogleFormsDetector,
} from './GoogleFormsDetector';

import {
  createBootstrapDetector,
} from './BootstrapDetector';

import {
  createMaterialUIDetector,
} from './MaterialUIDetector';

import {
  createSiblingDetector,
} from './SiblingDetector';

/**
 * All built-in detector classes
 */
export const Detectors = {
  AriaLabelDetector,
  PlaceholderDetector,
  AssociatedLabelDetector,
  TextContentDetector,
  GoogleFormsDetector,
  BootstrapDetector,
  MaterialUIDetector,
  SiblingDetector,
} as const;

/**
 * All detector factory functions
 */
export const DetectorFactories = {
  createAriaLabelDetector,
  createPlaceholderDetector,
  createAssociatedLabelDetector,
  createTextContentDetector,
  createGoogleFormsDetector,
  createBootstrapDetector,
  createMaterialUIDetector,
  createSiblingDetector,
} as const;

/**
 * Detector names for configuration
 */
export const DetectorNames = {
  ARIA_LABEL: 'aria-label',
  PLACEHOLDER: 'placeholder',
  ASSOCIATED_LABEL: 'associated-label',
  TEXT_CONTENT: 'text-content',
  GOOGLE_FORMS: 'google-forms',
  BOOTSTRAP: 'bootstrap',
  MATERIAL_UI: 'material-ui',
  SIBLING: 'sibling',
} as const;

/**
 * Type for detector names
 */
export type DetectorName = typeof DetectorNames[keyof typeof DetectorNames];
