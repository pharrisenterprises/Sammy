/**
 * Recording System - Barrel Export
 * @module core/recording
 * @version 1.0.0
 * 
 * Comprehensive recording system for capturing user interactions.
 * Provides event capture, label detection, step building, and
 * iframe/shadow DOM handling.
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   startRecording, 
 *   stopRecording, 
 *   getRecordedSteps 
 * } from '@/core/recording';
 * 
 * // Start recording
 * await startRecording();
 * 
 * // User interacts with page...
 * 
 * // Stop and get steps
 * const steps = await stopRecording();
 * console.log(`Recorded ${steps.length} steps`);
 * ```
 * 
 * ## Custom Configuration
 * ```typescript
 * import { 
 *   RecordingCoordinator,
 *   StepBuilder,
 *   IframeHandler 
 * } from '@/core/recording';
 * 
 * const coordinator = new RecordingCoordinator({
 *   includeIframes: true,
 *   includeShadowDom: true,
 *   inputDebounceDelay: 500,
 *   highlightElements: true,
 * });
 * 
 * coordinator.onStep((step) => {
 *   console.log('Recorded:', step.label, step.event);
 * });
 * 
 * await coordinator.start();
 * ```
 * 
 * ## Components
 * - **RecordingCoordinator**: Main facade coordinating all components
 * - **StepBuilder**: Builds Step objects from DOM events
 * - **IframeHandler**: Handles iframe event capture
 * - **ShadowDomHandler**: Handles shadow DOM traversal
 * - **InputChangeTracker**: Tracks input value changes with debouncing
 * - **Labels**: Label detection system with multiple strategies
 */

// ============================================================================
// RECORDING COORDINATOR (Main Entry Point)
// ============================================================================

export {
  // Main class
  RecordingCoordinator,
  
  // Factory and singleton
  createRecordingCoordinator,
  getRecordingCoordinator,
  resetRecordingCoordinator,
  
  // Convenience functions
  startRecording,
  stopRecording,
  isRecording,
  getRecordedSteps,
  
  // Types
  type RecordingState,
  type RecordableEventType,
  type RecordingConfig,
  type RecordingEventType,
  type RecordingEvent,
  type RecordingEventCallback,
  type StepCallback,
  
  // Constants
  DEFAULT_RECORDING_CONFIG,
} from './RecordingCoordinator';

// ============================================================================
// STEP BUILDER
// ============================================================================

export {
  // Main class
  StepBuilder,
  
  // Factory and singleton
  createStepBuilder,
  createLightweightBuilder,
  getStepBuilder,
  resetStepBuilder,
  
  // Convenience functions
  buildClickStep,
  buildInputStep,
  buildNavigationStep,
  createLocatorBundle,
  
  // Types
  type Step,
  type StepEventType,
  type LocatorBundle,
  type BoundingInfo,
  type StepBuilderConfig,
  type BuildContext,
  
  // Constants
  DEFAULT_STEP_BUILDER_CONFIG,
} from './StepBuilder';

// ============================================================================
// IFRAME HANDLER
// ============================================================================

export {
  // Main class
  IframeHandler,
  
  // Factory and singleton
  createIframeHandler,
  getIframeHandler,
  resetIframeHandler,
  
  // Utility functions
  getIframeChainForElement,
  isInIframe,
  getIframeDepth,
  serializeIframeChain,
  deserializeIframeChain,
  
  // Types
  type IframeInfo,
  type IframeEventType,
  type IframeEvent,
  type IframeEventCallback,
  type DocumentListenerCallback,
  type IframeHandlerConfig,
  type AttachmentResult,
  
  // Constants
  DEFAULT_IFRAME_CONFIG,
} from './IframeHandler';

// ============================================================================
// SHADOW DOM HANDLER
// ============================================================================

export {
  // Main class
  ShadowDomHandler,
  
  // Factory and singleton
  createShadowDomHandler,
  getShadowDomHandler,
  resetShadowDomHandler,
  
  // Utility functions
  getShadowHostChainForElement,
  isElementInShadowDom,
  getShadowDepth,
  deepQuerySelector,
  getRealTarget,
  serializeShadowHostChain,
  deserializeShadowHostChain,
  
  // Types
  type ElementWithShadow,
  type ShadowHostInfo,
  type ShadowEventType,
  type ShadowEvent,
  type ShadowEventCallback,
  type ShadowListenerCallback,
  type ShadowDomHandlerConfig,
  
  // Constants
  DEFAULT_SHADOW_CONFIG,
} from './ShadowDomHandler';

// ============================================================================
// INPUT CHANGE TRACKER
// ============================================================================

export {
  // Main class
  InputChangeTracker,
  
  // Factory functions
  createInputChangeTracker,
  createFastTracker,
  createVerboseTracker,
  
  // Singleton
  getInputChangeTracker,
  resetInputChangeTracker,
  
  // Utility functions
  getElementValue,
  getElementInputType,
  isTrackableInput,
  isImmediateInputType,
  isDebouncedInputType,
  
  // Types
  type TrackableInputType,
  type TrackedState,
  type ValueChangeEvent,
  type ValueChangeCallback,
  type InputChangeTrackerConfig,
  
  // Constants
  DEFAULT_TRACKER_CONFIG,
} from './InputChangeTracker';

// ============================================================================
// LABEL DETECTION SYSTEM
// ============================================================================

// Re-export entire labels module
export * from './labels';

// ============================================================================
// CONVENIENCE COLLECTIONS
// ============================================================================

// Import for the collections
import { RecordingCoordinator, resetRecordingCoordinator } from './RecordingCoordinator';
import { StepBuilder, resetStepBuilder } from './StepBuilder';
import { IframeHandler, resetIframeHandler } from './IframeHandler';
import { ShadowDomHandler, resetShadowDomHandler } from './ShadowDomHandler';
import { InputChangeTracker, resetInputChangeTracker } from './InputChangeTracker';

/**
 * All recording component classes
 */
export const RecordingComponents = {
  RecordingCoordinator,
  StepBuilder,
  IframeHandler,
  ShadowDomHandler,
  InputChangeTracker,
} as const;

/**
 * All singleton reset functions (useful for testing)
 */
export const resetAllRecordingSingletons = (): void => {
  resetRecordingCoordinator();
  resetStepBuilder();
  resetIframeHandler();
  resetShadowDomHandler();
  resetInputChangeTracker();
};
