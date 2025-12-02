/**
 * ReplayConfig - Replay Engine Configuration
 * @module core/replay/ReplayConfig
 * @version 1.0.0
 * 
 * Centralized configuration management for the replay engine.
 * Provides sensible defaults, preset configurations, and validation.
 * 
 * ## Configuration Categories
 * - **Timing**: Timeouts, delays, intervals
 * - **Locator**: Element finding thresholds and priorities
 * - **Behavior**: Action execution settings
 * - **Visual**: Highlighting and feedback options
 * - **Error Handling**: Retry and recovery settings
 * 
 * ## Presets
 * - **Default**: Balanced for most use cases
 * - **Fast**: Minimal delays for quick execution
 * - **Realistic**: Human-like timing and behavior
 * - **Debug**: Slow with visual feedback
 * - **Tolerant**: Relaxed thresholds, continue on failure
 * 
 * @example
 * ```typescript
 * // Use default config
 * const config = getDefaultReplayConfig();
 * 
 * // Use preset
 * const fastConfig = getReplayPreset('fast');
 * 
 * // Custom config
 * const customConfig = createReplayConfig({
 *   findTimeout: 5000,
 *   continueOnFailure: true,
 * });
 * ```
 */

// ============================================================================
// TIMING CONFIGURATION
// ============================================================================

/**
 * Timing-related configuration
 */
export interface TimingConfig {
  /** Element find timeout in milliseconds (default: 2000) */
  findTimeout: number;
  
  /** Retry interval in milliseconds (default: 150) */
  retryInterval: number;
  
  /** Maximum retry attempts (default: 13) */
  maxRetries: number;
  
  /** Fixed delay between steps in milliseconds (default: 0) */
  stepDelay: number;
  
  /** Human-like delay range [min, max] in milliseconds */
  humanDelay: [number, number] | null;
  
  /** Action timeout in milliseconds (default: 5000) */
  actionTimeout: number;
  
  /** Navigation timeout in milliseconds (default: 30000) */
  navigationTimeout: number;
  
  /** Delay before clicking an element in milliseconds (default: 0) */
  preClickDelay: number;
  
  /** Delay after clicking an element in milliseconds (default: 0) */
  postClickDelay: number;
  
  /** Delay before typing in milliseconds (default: 0) */
  preInputDelay: number;
  
  /** Delay after typing in milliseconds (default: 0) */
  postInputDelay: number;
  
  /** Delay between keystrokes in milliseconds (default: 0) */
  keystrokeDelay: number;
}

/**
 * Default timing configuration
 */
export const DEFAULT_TIMING_CONFIG: TimingConfig = {
  findTimeout: 2000,
  retryInterval: 150,
  maxRetries: 13,
  stepDelay: 0,
  humanDelay: null,
  actionTimeout: 5000,
  navigationTimeout: 30000,
  preClickDelay: 0,
  postClickDelay: 0,
  preInputDelay: 0,
  postInputDelay: 0,
  keystrokeDelay: 0,
};

// ============================================================================
// LOCATOR CONFIGURATION
// ============================================================================

/**
 * Locator strategy names
 */
export type LocatorStrategyName =
  | 'xpath'
  | 'id'
  | 'name'
  | 'aria'
  | 'placeholder'
  | 'dataAttributes'
  | 'fuzzyText'
  | 'boundingBox'
  | 'css';

/**
 * Locator-related configuration
 */
export interface LocatorConfig {
  /** Fuzzy text match threshold (0-1, default: 0.4) */
  fuzzyMatchThreshold: number;
  
  /** Bounding box proximity threshold in pixels (default: 200) */
  boundingBoxThreshold: number;
  
  /** Locator strategy priority order */
  strategyPriority: LocatorStrategyName[];
  
  /** Strategies to skip (disabled strategies) */
  disabledStrategies: LocatorStrategyName[];
  
  /** Whether to use shadow DOM traversal (default: true) */
  enableShadowDom: boolean;
  
  /** Whether to use iframe traversal (default: true) */
  enableIframes: boolean;
  
  /** Confidence threshold for accepting a match (0-1, default: 0.5) */
  minConfidence: number;
  
  /** Whether to prefer exact matches over fuzzy (default: true) */
  preferExactMatch: boolean;
}

/**
 * Default locator configuration
 */
export const DEFAULT_LOCATOR_CONFIG: LocatorConfig = {
  fuzzyMatchThreshold: 0.4,
  boundingBoxThreshold: 200,
  strategyPriority: [
    'xpath',
    'id',
    'name',
    'aria',
    'placeholder',
    'dataAttributes',
    'css',
    'fuzzyText',
    'boundingBox',
  ],
  disabledStrategies: [],
  enableShadowDom: true,
  enableIframes: true,
  minConfidence: 0.5,
  preferExactMatch: true,
};

// ============================================================================
// BEHAVIOR CONFIGURATION
// ============================================================================

/**
 * Behavior-related configuration
 */
export interface BehaviorConfig {
  /** Whether to continue on step failure (default: false) */
  continueOnFailure: boolean;
  
  /** Whether to scroll elements into view (default: true) */
  scrollIntoView: boolean;
  
  /** Scroll behavior (default: 'smooth') */
  scrollBehavior: 'auto' | 'smooth';
  
  /** Scroll block position (default: 'center') */
  scrollBlock: 'start' | 'center' | 'end' | 'nearest';
  
  /** Whether to use human-like mouse movement (default: true) */
  humanLikeMouse: boolean;
  
  /** Whether to use React-safe input (default: true) */
  reactSafeInput: boolean;
  
  /** Whether to focus elements before actions (default: true) */
  focusBeforeAction: boolean;
  
  /** Whether to wait for animations (default: true) */
  waitForAnimations: boolean;
  
  /** Animation wait timeout in milliseconds (default: 500) */
  animationTimeout: number;
  
  /** Whether to temporarily show hidden elements (default: true) */
  showHiddenElements: boolean;
  
  /** Whether to verify element is actionable (default: true) */
  verifyActionable: boolean;
}

/**
 * Default behavior configuration
 */
export const DEFAULT_BEHAVIOR_CONFIG: BehaviorConfig = {
  continueOnFailure: false,
  scrollIntoView: true,
  scrollBehavior: 'smooth',
  scrollBlock: 'center',
  humanLikeMouse: true,
  reactSafeInput: true,
  focusBeforeAction: true,
  waitForAnimations: true,
  animationTimeout: 500,
  showHiddenElements: true,
  verifyActionable: true,
};

// ============================================================================
// VISUAL CONFIGURATION
// ============================================================================

/**
 * Visual feedback configuration
 */
export interface VisualConfig {
  /** Whether to highlight elements before action (default: false) */
  highlightElements: boolean;
  
  /** Highlight duration in milliseconds (default: 200) */
  highlightDuration: number;
  
  /** Highlight color (default: '#ff0000') */
  highlightColor: string;
  
  /** Highlight border width in pixels (default: 2) */
  highlightBorderWidth: number;
  
  /** CSS class for highlight (default: 'replay-highlight') */
  highlightClass: string;
  
  /** Whether to show progress overlay (default: false) */
  showProgressOverlay: boolean;
  
  /** Whether to show step notifications (default: false) */
  showStepNotifications: boolean;
}

/**
 * Default visual configuration
 */
export const DEFAULT_VISUAL_CONFIG: VisualConfig = {
  highlightElements: false,
  highlightDuration: 200,
  highlightColor: '#ff0000',
  highlightBorderWidth: 2,
  highlightClass: 'replay-highlight',
  showProgressOverlay: false,
  showStepNotifications: false,
};

// ============================================================================
// ERROR HANDLING CONFIGURATION
// ============================================================================

/**
 * Error handling configuration
 */
export interface ErrorConfig {
  /** Whether to capture screenshots on failure (default: false) */
  captureScreenshots: boolean;
  
  /** Screenshot quality (0-1, default: 0.8) */
  screenshotQuality: number;
  
  /** Whether to capture page HTML on failure (default: false) */
  captureHtml: boolean;
  
  /** Whether to use exponential backoff for retries (default: false) */
  exponentialBackoff: boolean;
  
  /** Maximum backoff delay in milliseconds (default: 2000) */
  maxBackoffDelay: number;
  
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier: number;
  
  /** Maximum consecutive failures before aborting (default: 0 = unlimited) */
  maxConsecutiveFailures: number;
  
  /** Whether to log verbose error information (default: false) */
  verboseErrors: boolean;
}

/**
 * Default error configuration
 */
export const DEFAULT_ERROR_CONFIG: ErrorConfig = {
  captureScreenshots: false,
  screenshotQuality: 0.8,
  captureHtml: false,
  exponentialBackoff: false,
  maxBackoffDelay: 2000,
  backoffMultiplier: 1.5,
  maxConsecutiveFailures: 0,
  verboseErrors: false,
};

// ============================================================================
// COMPLETE REPLAY CONFIG
// ============================================================================

/**
 * Complete replay configuration
 */
export interface ReplayConfig {
  /** Timing settings */
  timing: TimingConfig;
  
  /** Locator settings */
  locator: LocatorConfig;
  
  /** Behavior settings */
  behavior: BehaviorConfig;
  
  /** Visual feedback settings */
  visual: VisualConfig;
  
  /** Error handling settings */
  error: ErrorConfig;
}

/**
 * Default complete replay configuration
 */
export const DEFAULT_REPLAY_CONFIG: ReplayConfig = {
  timing: DEFAULT_TIMING_CONFIG,
  locator: DEFAULT_LOCATOR_CONFIG,
  behavior: DEFAULT_BEHAVIOR_CONFIG,
  visual: DEFAULT_VISUAL_CONFIG,
  error: DEFAULT_ERROR_CONFIG,
};

// ============================================================================
// FLAT CONFIG (for backward compatibility)
// ============================================================================

/**
 * Flat replay configuration (all settings at top level)
 * Used for backward compatibility with IReplayEngine
 */
export interface FlatReplayConfig {
  // Timing
  findTimeout: number;
  retryInterval: number;
  maxRetries: number;
  stepDelay: number;
  humanDelay?: [number, number];
  actionTimeout: number;
  navigationTimeout: number;
  
  // Locator
  fuzzyMatchThreshold: number;
  boundingBoxThreshold: number;
  locatorPriority?: LocatorStrategyName[];
  
  // Behavior
  continueOnFailure: boolean;
  scrollIntoView: boolean;
  humanLikeMouse: boolean;
  reactSafeInput: boolean;
  
  // Visual
  highlightElements: boolean;
  highlightDuration: number;
  
  // Error
  captureScreenshots: boolean;
}

/**
 * Default flat configuration
 */
export const DEFAULT_FLAT_CONFIG: FlatReplayConfig = {
  findTimeout: 2000,
  retryInterval: 150,
  maxRetries: 13,
  stepDelay: 0,
  humanDelay: undefined,
  actionTimeout: 5000,
  navigationTimeout: 30000,
  fuzzyMatchThreshold: 0.4,
  boundingBoxThreshold: 200,
  locatorPriority: undefined,
  continueOnFailure: false,
  scrollIntoView: true,
  humanLikeMouse: true,
  reactSafeInput: true,
  highlightElements: false,
  highlightDuration: 200,
  captureScreenshots: false,
};

// ============================================================================
// PRESETS
// ============================================================================

/**
 * Preset names
 */
export type ReplayPreset = 'default' | 'fast' | 'realistic' | 'debug' | 'tolerant';

/**
 * Preset configurations
 */
export const REPLAY_PRESETS: Record<ReplayPreset, Partial<ReplayConfig>> = {
  /** Default balanced configuration */
  default: {},
  
  /** Fast execution with minimal delays */
  fast: {
    timing: {
      ...DEFAULT_TIMING_CONFIG,
      findTimeout: 1000,
      retryInterval: 50,
      maxRetries: 10,
      stepDelay: 0,
      humanDelay: null,
      actionTimeout: 2000,
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_CONFIG,
      humanLikeMouse: false,
      waitForAnimations: false,
      scrollBehavior: 'auto',
    },
    visual: {
      ...DEFAULT_VISUAL_CONFIG,
      highlightElements: false,
    },
  },
  
  /** Human-like realistic timing */
  realistic: {
    timing: {
      ...DEFAULT_TIMING_CONFIG,
      stepDelay: 500,
      humanDelay: [50, 300],
      preClickDelay: 100,
      postClickDelay: 200,
      preInputDelay: 50,
      postInputDelay: 100,
      keystrokeDelay: 50,
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_CONFIG,
      humanLikeMouse: true,
      scrollBehavior: 'smooth',
    },
  },
  
  /** Debug mode with visual feedback and slow execution */
  debug: {
    timing: {
      ...DEFAULT_TIMING_CONFIG,
      findTimeout: 5000,
      stepDelay: 1000,
      humanDelay: [200, 500],
    },
    visual: {
      ...DEFAULT_VISUAL_CONFIG,
      highlightElements: true,
      highlightDuration: 500,
      showProgressOverlay: true,
      showStepNotifications: true,
    },
    error: {
      ...DEFAULT_ERROR_CONFIG,
      captureScreenshots: true,
      captureHtml: true,
      verboseErrors: true,
    },
  },
  
  /** Tolerant mode with relaxed thresholds */
  tolerant: {
    timing: {
      ...DEFAULT_TIMING_CONFIG,
      findTimeout: 5000,
      maxRetries: 20,
    },
    locator: {
      ...DEFAULT_LOCATOR_CONFIG,
      fuzzyMatchThreshold: 0.3,
      boundingBoxThreshold: 300,
      minConfidence: 0.3,
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_CONFIG,
      continueOnFailure: true,
    },
    error: {
      ...DEFAULT_ERROR_CONFIG,
      maxConsecutiveFailures: 5,
    },
  },
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

/**
 * Validate timing configuration
 */
export function validateTimingConfig(config: Partial<TimingConfig>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (config.findTimeout !== undefined && config.findTimeout < 0) {
    errors.push({
      field: 'timing.findTimeout',
      message: 'findTimeout must be non-negative',
      value: config.findTimeout,
    });
  }
  
  if (config.retryInterval !== undefined && config.retryInterval < 0) {
    errors.push({
      field: 'timing.retryInterval',
      message: 'retryInterval must be non-negative',
      value: config.retryInterval,
    });
  }
  
  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    errors.push({
      field: 'timing.maxRetries',
      message: 'maxRetries must be non-negative',
      value: config.maxRetries,
    });
  }
  
  if (config.humanDelay !== undefined && config.humanDelay !== null) {
    const [min, max] = config.humanDelay;
    if (min < 0 || max < 0) {
      errors.push({
        field: 'timing.humanDelay',
        message: 'humanDelay values must be non-negative',
        value: config.humanDelay,
      });
    }
    if (min > max) {
      errors.push({
        field: 'timing.humanDelay',
        message: 'humanDelay min must be less than or equal to max',
        value: config.humanDelay,
      });
    }
  }
  
  return errors;
}

/**
 * Validate locator configuration
 */
export function validateLocatorConfig(config: Partial<LocatorConfig>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (config.fuzzyMatchThreshold !== undefined) {
    if (config.fuzzyMatchThreshold < 0 || config.fuzzyMatchThreshold > 1) {
      errors.push({
        field: 'locator.fuzzyMatchThreshold',
        message: 'fuzzyMatchThreshold must be between 0 and 1',
        value: config.fuzzyMatchThreshold,
      });
    }
  }
  
  if (config.boundingBoxThreshold !== undefined && config.boundingBoxThreshold < 0) {
    errors.push({
      field: 'locator.boundingBoxThreshold',
      message: 'boundingBoxThreshold must be non-negative',
      value: config.boundingBoxThreshold,
    });
  }
  
  if (config.minConfidence !== undefined) {
    if (config.minConfidence < 0 || config.minConfidence > 1) {
      errors.push({
        field: 'locator.minConfidence',
        message: 'minConfidence must be between 0 and 1',
        value: config.minConfidence,
      });
    }
  }
  
  return errors;
}

/**
 * Validate complete configuration
 */
export function validateReplayConfig(config: Partial<ReplayConfig>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (config.timing) {
    errors.push(...validateTimingConfig(config.timing));
  }
  
  if (config.locator) {
    errors.push(...validateLocatorConfig(config.locator));
  }
  
  return errors;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Get the default replay configuration
 */
export function getDefaultReplayConfig(): ReplayConfig {
  return deepClone(DEFAULT_REPLAY_CONFIG);
}

/**
 * Get a preset configuration
 */
export function getReplayPreset(preset: ReplayPreset): ReplayConfig {
  return mergeReplayConfig(DEFAULT_REPLAY_CONFIG, REPLAY_PRESETS[preset]);
}

/**
 * Create a custom replay configuration
 */
export function createReplayConfig(
  overrides: DeepPartial<ReplayConfig>
): ReplayConfig {
  const config = mergeReplayConfig(DEFAULT_REPLAY_CONFIG, overrides);
  
  // Validate
  const errors = validateReplayConfig(config);
  if (errors.length > 0) {
    console.warn('ReplayConfig validation warnings:', errors);
  }
  
  return config;
}

/**
 * Create a flat replay configuration
 */
export function createFlatReplayConfig(
  overrides: Partial<FlatReplayConfig>
): FlatReplayConfig {
  return { ...DEFAULT_FLAT_CONFIG, ...overrides };
}

/**
 * Merge two configurations
 */
export function mergeReplayConfig(
  base: ReplayConfig,
  overrides: DeepPartial<ReplayConfig>
): ReplayConfig {
  return {
    timing: { ...base.timing, ...overrides.timing },
    locator: { ...base.locator, ...overrides.locator },
    behavior: { ...base.behavior, ...overrides.behavior },
    visual: { ...base.visual, ...overrides.visual },
    error: { ...base.error, ...overrides.error },
  };
}

/**
 * Convert structured config to flat config
 */
export function flattenReplayConfig(config: ReplayConfig): FlatReplayConfig {
  return {
    findTimeout: config.timing.findTimeout,
    retryInterval: config.timing.retryInterval,
    maxRetries: config.timing.maxRetries,
    stepDelay: config.timing.stepDelay,
    humanDelay: config.timing.humanDelay ?? undefined,
    actionTimeout: config.timing.actionTimeout,
    navigationTimeout: config.timing.navigationTimeout,
    fuzzyMatchThreshold: config.locator.fuzzyMatchThreshold,
    boundingBoxThreshold: config.locator.boundingBoxThreshold,
    locatorPriority: config.locator.strategyPriority,
    continueOnFailure: config.behavior.continueOnFailure,
    scrollIntoView: config.behavior.scrollIntoView,
    humanLikeMouse: config.behavior.humanLikeMouse,
    reactSafeInput: config.behavior.reactSafeInput,
    highlightElements: config.visual.highlightElements,
    highlightDuration: config.visual.highlightDuration,
    captureScreenshots: config.error.captureScreenshots,
  };
}

/**
 * Convert flat config to structured config
 */
export function unflattenReplayConfig(flat: Partial<FlatReplayConfig>): DeepPartial<ReplayConfig> {
  return {
    timing: {
      findTimeout: flat.findTimeout,
      retryInterval: flat.retryInterval,
      maxRetries: flat.maxRetries,
      stepDelay: flat.stepDelay,
      humanDelay: flat.humanDelay ?? null,
      actionTimeout: flat.actionTimeout,
      navigationTimeout: flat.navigationTimeout,
    },
    locator: {
      fuzzyMatchThreshold: flat.fuzzyMatchThreshold,
      boundingBoxThreshold: flat.boundingBoxThreshold,
      strategyPriority: flat.locatorPriority,
    },
    behavior: {
      continueOnFailure: flat.continueOnFailure,
      scrollIntoView: flat.scrollIntoView,
      humanLikeMouse: flat.humanLikeMouse,
      reactSafeInput: flat.reactSafeInput,
    },
    visual: {
      highlightElements: flat.highlightElements,
      highlightDuration: flat.highlightDuration,
    },
    error: {
      captureScreenshots: flat.captureScreenshots,
    },
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type for nested objects
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep clone utility
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// CONFIG MANAGER CLASS
// ============================================================================

/**
 * Configuration manager for replay engine
 * Provides a stateful way to manage configuration
 */
export class ReplayConfigManager {
  private config: ReplayConfig;
  
  constructor(config?: DeepPartial<ReplayConfig>) {
    this.config = config 
      ? createReplayConfig(config)
      : getDefaultReplayConfig();
  }
  
  /**
   * Get the current configuration
   */
  getConfig(): ReplayConfig {
    return deepClone(this.config);
  }
  
  /**
   * Get flat configuration
   */
  getFlatConfig(): FlatReplayConfig {
    return flattenReplayConfig(this.config);
  }
  
  /**
   * Update configuration
   */
  setConfig(overrides: DeepPartial<ReplayConfig>): void {
    this.config = mergeReplayConfig(this.config, overrides);
  }
  
  /**
   * Apply a preset
   */
  applyPreset(preset: ReplayPreset): void {
    this.config = getReplayPreset(preset);
  }
  
  /**
   * Reset to default
   */
  reset(): void {
    this.config = getDefaultReplayConfig();
  }
  
  /**
   * Get a specific setting
   */
  get<K extends keyof ReplayConfig>(category: K): ReplayConfig[K] {
    return deepClone(this.config[category]);
  }
  
  /**
   * Set a specific category
   */
  set<K extends keyof ReplayConfig>(
    category: K,
    value: Partial<ReplayConfig[K]>
  ): void {
    this.config[category] = { ...this.config[category], ...value };
  }
  
  /**
   * Validate current configuration
   */
  validate(): ValidationError[] {
    return validateReplayConfig(this.config);
  }
  
  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    return this.validate().length === 0;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultConfigManager: ReplayConfigManager | null = null;

/**
 * Get the default config manager instance
 */
export function getReplayConfigManager(): ReplayConfigManager {
  if (!defaultConfigManager) {
    defaultConfigManager = new ReplayConfigManager();
  }
  return defaultConfigManager;
}

/**
 * Reset the default config manager
 */
export function resetReplayConfigManager(): void {
  defaultConfigManager = null;
}
