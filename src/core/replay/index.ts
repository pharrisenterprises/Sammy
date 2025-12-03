/**
 * Replay Module - Phase 4 Barrel Export
 * @module core/replay
 * 
 * Provides unified entry point for the Phase 4 replay layer.
 * 
 * Architecture:
 * - IReplayEngine: Core interface and execution types
 * - ReplayConfig: Configuration management with defaults and presets
 * - ReplayState: State machine with lifecycle tracking
 * - ElementFinder: 9-tier element finding strategies
 * - ActionExecutor: DOM action execution with retry
 * - StepExecutor: Step orchestration with field mapping
 * - ReplayEngine: Main replay orchestrator
 * - ReplaySession: Multi-row data-driven sessions
 * 
 * @example Quick Start
 * ```typescript
 * import { createReplayEngine, createReplaySession } from '@/core/replay';
 * 
 * // Single test execution
 * const engine = createReplayEngine();
 * const result = await engine.execute(steps);
 * 
 * // Data-driven testing
 * const session = createDataDrivenSession(steps, csvRows);
 * const summary = await session.start();
 * ```
 */

// ============================================================================
// CORE INTERFACE (IReplayEngine)
// ============================================================================

export {
  // Execution context and results
  type ExecutionContext,
  type ExecutionResult,
  type ExecutionStatus,
  type ExecutionSummary,
  
  // Retry configuration
  type RetryConfig,
  
  // Main interface
  type IReplayEngine,
} from './IReplayEngine';

// ============================================================================
// CONFIGURATION (ReplayConfig)
// ============================================================================

export {
  // Configuration sections
  type TimingConfig,
  type LocatorConfig,
  type BehaviorConfig,
  type VisualConfig,
  type ErrorConfig,
  type ReplayConfig,
  
  // Default configurations
  DEFAULT_TIMING_CONFIG,
  DEFAULT_LOCATOR_CONFIG,
  DEFAULT_BEHAVIOR_CONFIG,
  DEFAULT_VISUAL_CONFIG,
  DEFAULT_ERROR_CONFIG,
  DEFAULT_REPLAY_CONFIG,
  
  // Configuration presets
  REPLAY_CONFIG_PRESETS,
  type ReplayConfigPreset,
  
  // Validation
  validateReplayConfig,
  validatePartialConfig,
  
  // Factory functions
  createFastConfig,
  createRealisticConfig,
  createDebugConfig,
  
  // Configuration manager
  ReplayConfigManager,
} from './ReplayConfig';

// ============================================================================
// STATE MANAGEMENT (ReplayState)
// ============================================================================

export {
  // Lifecycle types
  type ReplayLifecycle,
  VALID_TRANSITIONS,
  
  // Progress tracking
  type ReplayProgress,
  
  // Timing information
  type ReplayTiming,
  
  // State snapshots
  type ReplayStateSnapshot,
  
  // State change events
  type StateChangeEvent,
  type StateChangeCallback,
  
  // State manager
  ReplayStateManager,
  
  // Helper factories
  createInitialProgress,
  createInitialTiming,
  createInitialState,
  
  // Utility functions
  formatElapsedTime,
  formatEta,
} from './ReplayState';

// ============================================================================
// ELEMENT FINDING (ElementFinder)
// ============================================================================

export {
  // Strategy types
  type FinderStrategyName,
  STRATEGY_CONFIDENCE,
  DEFAULT_STRATEGY_ORDER,
  
  // Find results
  type FindResult,
  type FindOptions,
  
  // Visibility helpers
  isElementVisible,
  isElementInViewport,
  
  // Similarity calculation
  calculateTextSimilarity,
  
  // Individual strategies
  findByXPath,
  findById,
  findByName,
  findByAriaLabel,
  findByPlaceholder,
  findByDataAttributes,
  findByCssSelector,
  findByFuzzyText,
  findByBoundingBox,
  
  // Element finder class
  ElementFinder,
  createElementFinder,
  createFastFinder,
  createAccurateFinder,
  
  // Singleton access
  getElementFinder,
  resetElementFinder,
  
  // Convenience functions
  findElement,
  findElementSync,
} from './ElementFinder';

// ============================================================================
// ACTION EXECUTION (ActionExecutor)
// ============================================================================

export {
  // Action types
  type ActionType,
  type ActionResult,
  type ActionOptions,
  DEFAULT_ACTION_OPTIONS,
  
  // Key configuration
  type KeyConfig,
  KEYS,
  
  // Action executor class
  ActionExecutor,
  createActionExecutor,
  createFastExecutor,
  createRealisticExecutor,
  getActionExecutor,
  resetActionExecutor,
  
  // Convenience functions
  clickElement,
  inputValue,
  pressEnter,
} from './ActionExecutor';

// ============================================================================
// STEP EXECUTION (StepExecutor)
// ============================================================================

export {
  // Execution context and options
  type StepExecutionContext,
  type StepExecutionOptions,
  DEFAULT_STEP_EXECUTION_OPTIONS,
  
  // Execution results
  type StepExecutionResult,
  
  // Step executor class
  StepExecutor,
  createStepExecutor,
  createFastStepExecutor,
  createRealisticStepExecutor,
  getStepExecutor,
  resetStepExecutor,
  
  // Convenience functions
  executeStep,
  executeSteps,
} from './StepExecutor';

// ============================================================================
// REPLAY ENGINE (ReplayEngine)
// ============================================================================

export {
  // Engine configuration
  type ReplayEngineConfig,
  DEFAULT_ENGINE_CONFIG,
  
  // Engine events
  type ReplayEngineEvents,
  
  // Callback types
  type OnStateChangeCallback,
  type OnStepCompleteCallback,
  type OnErrorCallback,
  
  // Replay engine class
  ReplayEngine,
  createReplayEngine,
  createFastEngine,
  createRealisticEngine,
} from './ReplayEngine';

// ============================================================================
// REPLAY SESSION (ReplaySession)
// ============================================================================

export {
  // Session lifecycle
  type SessionLifecycle,
  
  // Session results
  type RowExecutionResult,
  type SessionSummary,
  
  // Session progress
  type SessionProgress,
  
  // Session configuration
  type ReplaySessionConfig,
  DEFAULT_SESSION_CONFIG,
  
  // Session events
  type ReplaySessionEvents,
  
  // Replay session class
  ReplaySession,
  createReplaySession,
  createDataDrivenSession,
  createRealisticSession,
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession,
} from './ReplaySession';

// ============================================================================
// CONVENIENCE CONSTANTS
// ============================================================================

/**
 * Common replay defaults for quick access
 */
export const REPLAY_DEFAULTS = {
  /** Default element find timeout (ms) */
  FIND_TIMEOUT: 2000,
  
  /** Default retry interval between find attempts (ms) */
  RETRY_INTERVAL: 150,
  
  /** Default maximum retry attempts */
  MAX_RETRIES: 13,
  
  /** Default fuzzy text matching threshold (0-1) */
  FUZZY_THRESHOLD: 0.4,
  
  /** Default bounding box distance threshold (px) */
  BOUNDING_BOX_THRESHOLD: 200,
  
  /** Default navigation/page load timeout (ms) */
  NAVIGATION_TIMEOUT: 30000,
  
  /** Default human-like delay range [min, max] (ms) */
  HUMAN_DELAY_RANGE: [50, 300] as [number, number],
  
  /** Default action timeout (ms) */
  ACTION_TIMEOUT: 5000,
} as const;

/**
 * Element finder strategy confidence scores
 * Higher scores = more reliable strategies
 */
export const STRATEGY_SCORES = {
  /** XPath selector - highest reliability */
  XPATH: 1.0,
  
  /** ID attribute - very reliable */
  ID: 0.9,
  
  /** Name attribute - reliable */
  NAME: 0.8,
  
  /** ARIA label - accessible and reliable */
  ARIA: 0.75,
  
  /** Placeholder text - moderately reliable */
  PLACEHOLDER: 0.7,
  
  /** Data attributes - moderately reliable */
  DATA_ATTRIBUTES: 0.65,
  
  /** CSS selector - less reliable (can be fragile) */
  CSS: 0.6,
  
  /** Fuzzy text match - heuristic-based */
  FUZZY_TEXT: 0.4,
  
  /** Bounding box position - least reliable (layout-dependent) */
  BOUNDING_BOX: 0.3,
} as const;
