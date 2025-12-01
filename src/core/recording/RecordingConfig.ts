/**
 * RecordingConfig - Recording Engine Configuration Management
 * @module core/recording/RecordingConfig
 * @version 1.0.0
 * 
 * Provides configuration management for the Recording Engine including:
 * - Validation of all configuration options
 * - Builder pattern for fluent config creation
 * - Preset configurations for common scenarios
 * - Serialization support for storage
 * 
 * @see IRecordingEngine for interface contract
 * @see recording-engine_breakdown.md for implementation context
 */

import type {
  RecordingConfig,
  CaptureConfig,
  LabelDetectionConfig,
  CaptureEventType,
  ILabelDetectionStrategy,
} from './IRecordingEngine';

import {
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_LABEL_DETECTION_CONFIG,
  DEFAULT_RECORDING_CONFIG,
  isCaptureEventType,
} from './IRecordingEngine';

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of configuration validation
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  
  /** List of validation errors (empty if valid) */
  errors: ConfigValidationError[];
  
  /** List of validation warnings (non-fatal issues) */
  warnings: ConfigValidationWarning[];
}

/**
 * A validation error that prevents configuration use
 */
export interface ConfigValidationError {
  /** Path to the invalid field (e.g., 'capture.inputDebounceMs') */
  path: string;
  
  /** Error message */
  message: string;
  
  /** The invalid value */
  value: unknown;
  
  /** Expected type or constraint */
  expected: string;
}

/**
 * A validation warning (non-fatal issue)
 */
export interface ConfigValidationWarning {
  /** Path to the field with warning */
  path: string;
  
  /** Warning message */
  message: string;
  
  /** Suggested fix or alternative */
  suggestion?: string;
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Valid capture event types
 */
export const VALID_CAPTURE_EVENTS: readonly CaptureEventType[] = [
  'click',
  'dblclick',
  'input',
  'change',
  'keydown',
  'keyup',
  'keypress',
  'focus',
  'blur',
  'mousedown',
  'mouseup',
  'submit',
  'scroll',
] as const;

/**
 * Configuration limits
 */
export const CONFIG_LIMITS = {
  /** Minimum debounce delay in ms */
  MIN_DEBOUNCE_MS: 0,
  
  /** Maximum debounce delay in ms */
  MAX_DEBOUNCE_MS: 5000,
  
  /** Minimum highlight duration in ms */
  MIN_HIGHLIGHT_MS: 0,
  
  /** Maximum highlight duration in ms */
  MAX_HIGHLIGHT_MS: 10000,
  
  /** Minimum confidence threshold */
  MIN_CONFIDENCE: 0,
  
  /** Maximum confidence threshold */
  MAX_CONFIDENCE: 1,
  
  /** Minimum label length */
  MIN_LABEL_LENGTH: 1,
  
  /** Maximum label length */
  MAX_LABEL_LENGTH: 1000,
  
  /** Minimum auto-save interval in ms */
  MIN_AUTO_SAVE_INTERVAL_MS: 1000,
  
  /** Maximum auto-save interval in ms */
  MAX_AUTO_SAVE_INTERVAL_MS: 300000,
  
  /** Maximum max steps (0 = unlimited) */
  MAX_STEPS_LIMIT: 10000,
  
  /** Maximum duration in ms (0 = unlimited) */
  MAX_DURATION_LIMIT_MS: 86400000, // 24 hours
} as const;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a complete RecordingConfig
 * 
 * @param config - Configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateRecordingConfig(
  config: unknown
): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationWarning[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push({
      path: '',
      message: 'Configuration must be an object',
      value: config,
      expected: 'object',
    });
    return { valid: false, errors, warnings };
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Validate projectId (required)
  if (!cfg.projectId || typeof cfg.projectId !== 'string') {
    errors.push({
      path: 'projectId',
      message: 'projectId is required and must be a string',
      value: cfg.projectId,
      expected: 'non-empty string',
    });
  } else if (cfg.projectId.trim().length === 0) {
    errors.push({
      path: 'projectId',
      message: 'projectId cannot be empty',
      value: cfg.projectId,
      expected: 'non-empty string',
    });
  }
  
  // Validate sessionName (optional)
  if (cfg.sessionName !== undefined && typeof cfg.sessionName !== 'string') {
    errors.push({
      path: 'sessionName',
      message: 'sessionName must be a string',
      value: cfg.sessionName,
      expected: 'string',
    });
  }
  
  // Validate capture config
  if (cfg.capture !== undefined) {
    const captureErrors = validateCaptureConfig(cfg.capture);
    errors.push(...captureErrors.map(e => ({
      ...e,
      path: `capture.${e.path}`,
    })));
  }
  
  // Validate label detection config
  if (cfg.labelDetection !== undefined) {
    const labelErrors = validateLabelDetectionConfig(cfg.labelDetection);
    errors.push(...labelErrors.map(e => ({
      ...e,
      path: `labelDetection.${e.path}`,
    })));
  }
  
  // Validate maxSteps
  if (cfg.maxSteps !== undefined) {
    if (typeof cfg.maxSteps !== 'number' || !Number.isInteger(cfg.maxSteps)) {
      errors.push({
        path: 'maxSteps',
        message: 'maxSteps must be an integer',
        value: cfg.maxSteps,
        expected: 'integer >= 0',
      });
    } else if (cfg.maxSteps < 0) {
      errors.push({
        path: 'maxSteps',
        message: 'maxSteps cannot be negative',
        value: cfg.maxSteps,
        expected: 'integer >= 0',
      });
    } else if (cfg.maxSteps > CONFIG_LIMITS.MAX_STEPS_LIMIT) {
      warnings.push({
        path: 'maxSteps',
        message: `maxSteps exceeds recommended limit of ${CONFIG_LIMITS.MAX_STEPS_LIMIT}`,
        suggestion: 'Consider splitting into multiple recording sessions',
      });
    }
  }
  
  // Validate maxDurationMs
  if (cfg.maxDurationMs !== undefined) {
    if (typeof cfg.maxDurationMs !== 'number' || !Number.isInteger(cfg.maxDurationMs)) {
      errors.push({
        path: 'maxDurationMs',
        message: 'maxDurationMs must be an integer',
        value: cfg.maxDurationMs,
        expected: 'integer >= 0',
      });
    } else if (cfg.maxDurationMs < 0) {
      errors.push({
        path: 'maxDurationMs',
        message: 'maxDurationMs cannot be negative',
        value: cfg.maxDurationMs,
        expected: 'integer >= 0',
      });
    } else if (cfg.maxDurationMs > CONFIG_LIMITS.MAX_DURATION_LIMIT_MS) {
      warnings.push({
        path: 'maxDurationMs',
        message: `maxDurationMs exceeds ${CONFIG_LIMITS.MAX_DURATION_LIMIT_MS / 3600000} hours`,
        suggestion: 'Consider splitting into multiple recording sessions',
      });
    }
  }
  
  // Validate autoSave
  if (cfg.autoSave !== undefined && typeof cfg.autoSave !== 'boolean') {
    errors.push({
      path: 'autoSave',
      message: 'autoSave must be a boolean',
      value: cfg.autoSave,
      expected: 'boolean',
    });
  }
  
  // Validate autoSaveIntervalMs
  if (cfg.autoSaveIntervalMs !== undefined) {
    if (typeof cfg.autoSaveIntervalMs !== 'number') {
      errors.push({
        path: 'autoSaveIntervalMs',
        message: 'autoSaveIntervalMs must be a number',
        value: cfg.autoSaveIntervalMs,
        expected: `number between ${CONFIG_LIMITS.MIN_AUTO_SAVE_INTERVAL_MS} and ${CONFIG_LIMITS.MAX_AUTO_SAVE_INTERVAL_MS}`,
      });
    } else if (
      cfg.autoSaveIntervalMs < CONFIG_LIMITS.MIN_AUTO_SAVE_INTERVAL_MS ||
      cfg.autoSaveIntervalMs > CONFIG_LIMITS.MAX_AUTO_SAVE_INTERVAL_MS
    ) {
      errors.push({
        path: 'autoSaveIntervalMs',
        message: `autoSaveIntervalMs must be between ${CONFIG_LIMITS.MIN_AUTO_SAVE_INTERVAL_MS} and ${CONFIG_LIMITS.MAX_AUTO_SAVE_INTERVAL_MS}`,
        value: cfg.autoSaveIntervalMs,
        expected: `number between ${CONFIG_LIMITS.MIN_AUTO_SAVE_INTERVAL_MS} and ${CONFIG_LIMITS.MAX_AUTO_SAVE_INTERVAL_MS}`,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate CaptureConfig
 */
export function validateCaptureConfig(
  config: unknown
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push({
      path: '',
      message: 'capture config must be an object',
      value: config,
      expected: 'object',
    });
    return errors;
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Validate captureEvents
  if (cfg.captureEvents !== undefined) {
    if (!Array.isArray(cfg.captureEvents)) {
      errors.push({
        path: 'captureEvents',
        message: 'captureEvents must be an array',
        value: cfg.captureEvents,
        expected: 'array of event types',
      });
    } else {
      for (let i = 0; i < cfg.captureEvents.length; i++) {
        const event = cfg.captureEvents[i];
        if (!isCaptureEventType(event)) {
          errors.push({
            path: `captureEvents[${i}]`,
            message: `Invalid capture event type: ${event}`,
            value: event,
            expected: `one of: ${VALID_CAPTURE_EVENTS.join(', ')}`,
          });
        }
      }
      
      // Check for duplicates
      const seen = new Set<string>();
      for (const event of cfg.captureEvents) {
        if (seen.has(event as string)) {
          errors.push({
            path: 'captureEvents',
            message: `Duplicate event type: ${event}`,
            value: cfg.captureEvents,
            expected: 'array with unique event types',
          });
          break;
        }
        seen.add(event as string);
      }
    }
  }
  
  // Validate boolean fields
  const booleanFields = [
    'includeIframes',
    'includeShadowDOM',
    'includeClosedShadowDOM',
    'filterSyntheticEvents',
    'enableVisualFeedback',
  ] as const;
  
  for (const field of booleanFields) {
    if (cfg[field] !== undefined && typeof cfg[field] !== 'boolean') {
      errors.push({
        path: field,
        message: `${field} must be a boolean`,
        value: cfg[field],
        expected: 'boolean',
      });
    }
  }
  
  // Validate inputDebounceMs
  if (cfg.inputDebounceMs !== undefined) {
    if (typeof cfg.inputDebounceMs !== 'number') {
      errors.push({
        path: 'inputDebounceMs',
        message: 'inputDebounceMs must be a number',
        value: cfg.inputDebounceMs,
        expected: `number between ${CONFIG_LIMITS.MIN_DEBOUNCE_MS} and ${CONFIG_LIMITS.MAX_DEBOUNCE_MS}`,
      });
    } else if (
      cfg.inputDebounceMs < CONFIG_LIMITS.MIN_DEBOUNCE_MS ||
      cfg.inputDebounceMs > CONFIG_LIMITS.MAX_DEBOUNCE_MS
    ) {
      errors.push({
        path: 'inputDebounceMs',
        message: `inputDebounceMs must be between ${CONFIG_LIMITS.MIN_DEBOUNCE_MS} and ${CONFIG_LIMITS.MAX_DEBOUNCE_MS}`,
        value: cfg.inputDebounceMs,
        expected: `number between ${CONFIG_LIMITS.MIN_DEBOUNCE_MS} and ${CONFIG_LIMITS.MAX_DEBOUNCE_MS}`,
      });
    }
  }
  
  // Validate highlightDurationMs
  if (cfg.highlightDurationMs !== undefined) {
    if (typeof cfg.highlightDurationMs !== 'number') {
      errors.push({
        path: 'highlightDurationMs',
        message: 'highlightDurationMs must be a number',
        value: cfg.highlightDurationMs,
        expected: `number between ${CONFIG_LIMITS.MIN_HIGHLIGHT_MS} and ${CONFIG_LIMITS.MAX_HIGHLIGHT_MS}`,
      });
    } else if (
      cfg.highlightDurationMs < CONFIG_LIMITS.MIN_HIGHLIGHT_MS ||
      cfg.highlightDurationMs > CONFIG_LIMITS.MAX_HIGHLIGHT_MS
    ) {
      errors.push({
        path: 'highlightDurationMs',
        message: `highlightDurationMs must be between ${CONFIG_LIMITS.MIN_HIGHLIGHT_MS} and ${CONFIG_LIMITS.MAX_HIGHLIGHT_MS}`,
        value: cfg.highlightDurationMs,
        expected: `number between ${CONFIG_LIMITS.MIN_HIGHLIGHT_MS} and ${CONFIG_LIMITS.MAX_HIGHLIGHT_MS}`,
      });
    }
  }
  
  // Validate selectors (allow null or string)
  const selectorFields = ['ignoreSelector', 'containerSelector'] as const;
  for (const field of selectorFields) {
    if (cfg[field] !== undefined && cfg[field] !== null && typeof cfg[field] !== 'string') {
      errors.push({
        path: field,
        message: `${field} must be a string or null`,
        value: cfg[field],
        expected: 'string or null',
      });
    }
  }
  
  // Validate highlightClassName
  if (cfg.highlightClassName !== undefined && typeof cfg.highlightClassName !== 'string') {
    errors.push({
      path: 'highlightClassName',
      message: 'highlightClassName must be a string',
      value: cfg.highlightClassName,
      expected: 'string',
    });
  }
  
  return errors;
}

/**
 * Validate LabelDetectionConfig
 */
export function validateLabelDetectionConfig(
  config: unknown
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push({
      path: '',
      message: 'labelDetection config must be an object',
      value: config,
      expected: 'object',
    });
    return errors;
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Validate boolean fields
  const booleanFields = [
    'enableGoogleForms',
    'enableBootstrap',
    'enableMaterialUI',
    'enableAria',
    'enablePlaceholder',
  ] as const;
  
  for (const field of booleanFields) {
    if (cfg[field] !== undefined && typeof cfg[field] !== 'boolean') {
      errors.push({
        path: field,
        message: `${field} must be a boolean`,
        value: cfg[field],
        expected: 'boolean',
      });
    }
  }
  
  // Validate minConfidence
  if (cfg.minConfidence !== undefined) {
    if (typeof cfg.minConfidence !== 'number') {
      errors.push({
        path: 'minConfidence',
        message: 'minConfidence must be a number',
        value: cfg.minConfidence,
        expected: `number between ${CONFIG_LIMITS.MIN_CONFIDENCE} and ${CONFIG_LIMITS.MAX_CONFIDENCE}`,
      });
    } else if (
      cfg.minConfidence < CONFIG_LIMITS.MIN_CONFIDENCE ||
      cfg.minConfidence > CONFIG_LIMITS.MAX_CONFIDENCE
    ) {
      errors.push({
        path: 'minConfidence',
        message: `minConfidence must be between ${CONFIG_LIMITS.MIN_CONFIDENCE} and ${CONFIG_LIMITS.MAX_CONFIDENCE}`,
        value: cfg.minConfidence,
        expected: `number between ${CONFIG_LIMITS.MIN_CONFIDENCE} and ${CONFIG_LIMITS.MAX_CONFIDENCE}`,
      });
    }
  }
  
  // Validate maxLabelLength
  if (cfg.maxLabelLength !== undefined) {
    if (typeof cfg.maxLabelLength !== 'number' || !Number.isInteger(cfg.maxLabelLength)) {
      errors.push({
        path: 'maxLabelLength',
        message: 'maxLabelLength must be an integer',
        value: cfg.maxLabelLength,
        expected: `integer between ${CONFIG_LIMITS.MIN_LABEL_LENGTH} and ${CONFIG_LIMITS.MAX_LABEL_LENGTH}`,
      });
    } else if (
      cfg.maxLabelLength < CONFIG_LIMITS.MIN_LABEL_LENGTH ||
      cfg.maxLabelLength > CONFIG_LIMITS.MAX_LABEL_LENGTH
    ) {
      errors.push({
        path: 'maxLabelLength',
        message: `maxLabelLength must be between ${CONFIG_LIMITS.MIN_LABEL_LENGTH} and ${CONFIG_LIMITS.MAX_LABEL_LENGTH}`,
        value: cfg.maxLabelLength,
        expected: `integer between ${CONFIG_LIMITS.MIN_LABEL_LENGTH} and ${CONFIG_LIMITS.MAX_LABEL_LENGTH}`,
      });
    }
  }
  
  // Validate customStrategies
  if (cfg.customStrategies !== undefined) {
    if (!Array.isArray(cfg.customStrategies)) {
      errors.push({
        path: 'customStrategies',
        message: 'customStrategies must be an array',
        value: cfg.customStrategies,
        expected: 'array of ILabelDetectionStrategy',
      });
    } else {
      for (let i = 0; i < cfg.customStrategies.length; i++) {
        const strategy = cfg.customStrategies[i] as unknown;
        if (!isValidLabelStrategy(strategy)) {
          errors.push({
            path: `customStrategies[${i}]`,
            message: 'Invalid label detection strategy',
            value: strategy,
            expected: 'object with name, baseConfidence, priority, detect, canHandle',
          });
        }
      }
    }
  }
  
  return errors;
}

/**
 * Check if a value is a valid ILabelDetectionStrategy
 */
function isValidLabelStrategy(value: unknown): value is ILabelDetectionStrategy {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.name === 'string' &&
    typeof obj.baseConfidence === 'number' &&
    typeof obj.priority === 'number' &&
    typeof obj.detect === 'function' &&
    typeof obj.canHandle === 'function'
  );
}

// ============================================================================
// CONFIG BUILDER
// ============================================================================

/**
 * Builder class for creating RecordingConfig fluently
 * 
 * @example
 * ```typescript
 * const config = new RecordingConfigBuilder('my-project')
 *   .withSessionName('Login Test Recording')
 *   .captureEvents(['click', 'input'])
 *   .includeIframes(true)
 *   .includeShadowDOM(true)
 *   .withMinConfidence(0.6)
 *   .enableGoogleForms(true)
 *   .withMaxSteps(100)
 *   .build();
 * ```
 */
export class RecordingConfigBuilder {
  private config: RecordingConfig;
  
  /**
   * Create a new builder with required project ID
   * 
   * @param projectId - Project ID (required)
   */
  constructor(projectId: string) {
    this.config = {
      projectId,
      ...DEFAULT_RECORDING_CONFIG,
      capture: { ...DEFAULT_CAPTURE_CONFIG },
      labelDetection: { ...DEFAULT_LABEL_DETECTION_CONFIG },
    };
  }
  
  // ==========================================================================
  // TOP-LEVEL METHODS
  // ==========================================================================
  
  /**
   * Set session name
   */
  withSessionName(name: string): this {
    this.config.sessionName = name;
    return this;
  }
  
  /**
   * Set maximum number of steps
   */
  withMaxSteps(max: number): this {
    this.config.maxSteps = max;
    return this;
  }
  
  /**
   * Set maximum recording duration
   */
  withMaxDuration(ms: number): this {
    this.config.maxDurationMs = ms;
    return this;
  }
  
  /**
   * Enable or disable auto-save
   */
  withAutoSave(enabled: boolean, intervalMs?: number): this {
    this.config.autoSave = enabled;
    if (intervalMs !== undefined) {
      this.config.autoSaveIntervalMs = intervalMs;
    }
    return this;
  }
  
  // ==========================================================================
  // CAPTURE CONFIG METHODS
  // ==========================================================================
  
  /**
   * Set which events to capture
   */
  captureEvents(events: CaptureEventType[]): this {
    this.config.capture.captureEvents = [...events];
    return this;
  }
  
  /**
   * Add an event type to capture
   */
  addCaptureEvent(event: CaptureEventType): this {
    if (!this.config.capture.captureEvents.includes(event)) {
      this.config.capture.captureEvents.push(event);
    }
    return this;
  }
  
  /**
   * Remove an event type from capture
   */
  removeCaptureEvent(event: CaptureEventType): this {
    this.config.capture.captureEvents = this.config.capture.captureEvents.filter(
      e => e !== event
    );
    return this;
  }
  
  /**
   * Enable or disable iframe capture
   */
  includeIframes(include: boolean): this {
    this.config.capture.includeIframes = include;
    return this;
  }
  
  /**
   * Enable or disable shadow DOM capture
   */
  includeShadowDOM(include: boolean): this {
    this.config.capture.includeShadowDOM = include;
    return this;
  }
  
  /**
   * Enable or disable closed shadow DOM capture
   */
  includeClosedShadowDOM(include: boolean): this {
    this.config.capture.includeClosedShadowDOM = include;
    return this;
  }
  
  /**
   * Enable or disable synthetic event filtering
   */
  filterSyntheticEvents(filter: boolean): this {
    this.config.capture.filterSyntheticEvents = filter;
    return this;
  }
  
  /**
   * Set input debounce delay
   */
  withInputDebounce(ms: number): this {
    this.config.capture.inputDebounceMs = ms;
    return this;
  }
  
  /**
   * Set selector for elements to ignore
   */
  withIgnoreSelector(selector: string | null): this {
    this.config.capture.ignoreSelector = selector;
    return this;
  }
  
  /**
   * Set selector for container to restrict recording to
   */
  withContainerSelector(selector: string | null): this {
    this.config.capture.containerSelector = selector;
    return this;
  }
  
  /**
   * Enable or disable visual feedback
   */
  withVisualFeedback(enabled: boolean, durationMs?: number, className?: string): this {
    this.config.capture.enableVisualFeedback = enabled;
    if (durationMs !== undefined) {
      this.config.capture.highlightDurationMs = durationMs;
    }
    if (className !== undefined) {
      this.config.capture.highlightClassName = className;
    }
    return this;
  }
  
  // ==========================================================================
  // LABEL DETECTION CONFIG METHODS
  // ==========================================================================
  
  /**
   * Enable or disable Google Forms detection
   */
  enableGoogleForms(enable: boolean): this {
    this.config.labelDetection.enableGoogleForms = enable;
    return this;
  }
  
  /**
   * Enable or disable Bootstrap detection
   */
  enableBootstrap(enable: boolean): this {
    this.config.labelDetection.enableBootstrap = enable;
    return this;
  }
  
  /**
   * Enable or disable Material-UI detection
   */
  enableMaterialUI(enable: boolean): this {
    this.config.labelDetection.enableMaterialUI = enable;
    return this;
  }
  
  /**
   * Enable or disable ARIA detection
   */
  enableAria(enable: boolean): this {
    this.config.labelDetection.enableAria = enable;
    return this;
  }
  
  /**
   * Enable or disable placeholder detection
   */
  enablePlaceholder(enable: boolean): this {
    this.config.labelDetection.enablePlaceholder = enable;
    return this;
  }
  
  /**
   * Set minimum confidence threshold
   */
  withMinConfidence(confidence: number): this {
    this.config.labelDetection.minConfidence = confidence;
    return this;
  }
  
  /**
   * Set maximum label length
   */
  withMaxLabelLength(length: number): this {
    this.config.labelDetection.maxLabelLength = length;
    return this;
  }
  
  /**
   * Add a custom label detection strategy
   */
  addLabelStrategy(strategy: ILabelDetectionStrategy): this {
    this.config.labelDetection.customStrategies.push(strategy);
    return this;
  }
  
  /**
   * Set all custom label detection strategies
   */
  withLabelStrategies(strategies: ILabelDetectionStrategy[]): this {
    this.config.labelDetection.customStrategies = [...strategies];
    return this;
  }
  
  // ==========================================================================
  // BUILD METHODS
  // ==========================================================================
  
  /**
   * Build and validate the configuration
   * 
   * @returns The validated configuration
   * @throws Error if validation fails
   */
  build(): RecordingConfig {
    const result = validateRecordingConfig(this.config);
    
    if (!result.valid) {
      const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`).join('\n');
      throw new Error(`Invalid recording configuration:\n${errorMessages}`);
    }
    
    // Return a frozen copy for immutability
    return deepFreeze(deepClone(this.config));
  }
  
  /**
   * Build without validation (for testing/partial configs)
   * 
   * @returns The configuration (may be invalid)
   */
  buildUnsafe(): RecordingConfig {
    return deepClone(this.config);
  }
  
  /**
   * Get validation result without building
   */
  validate(): ConfigValidationResult {
    return validateRecordingConfig(this.config);
  }
  
  /**
   * Reset to defaults
   */
  reset(): this {
    const projectId = this.config.projectId;
    this.config = {
      projectId,
      ...DEFAULT_RECORDING_CONFIG,
      capture: { ...DEFAULT_CAPTURE_CONFIG },
      labelDetection: { ...DEFAULT_LABEL_DETECTION_CONFIG },
    };
    return this;
  }
  
  /**
   * Clone this builder
   */
  clone(): RecordingConfigBuilder {
    const builder = new RecordingConfigBuilder(this.config.projectId);
    builder.config = deepClone(this.config);
    return builder;
  }
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Preset configuration for minimal recording (fastest performance)
 */
export const PRESET_MINIMAL: Partial<Omit<RecordingConfig, 'projectId'>> = {
  capture: {
    ...DEFAULT_CAPTURE_CONFIG,
    captureEvents: ['click', 'input'],
    includeIframes: false,
    includeShadowDOM: false,
    includeClosedShadowDOM: false,
    enableVisualFeedback: false,
  },
  labelDetection: {
    ...DEFAULT_LABEL_DETECTION_CONFIG,
    enableGoogleForms: false,
    enableBootstrap: false,
    enableMaterialUI: false,
    minConfidence: 0.6,
  },
};

/**
 * Preset configuration for standard recording (balanced)
 */
export const PRESET_STANDARD: Partial<Omit<RecordingConfig, 'projectId'>> = {
  capture: {
    ...DEFAULT_CAPTURE_CONFIG,
    captureEvents: ['click', 'input', 'change', 'keydown'],
    includeIframes: true,
    includeShadowDOM: true,
    includeClosedShadowDOM: false,
  },
  labelDetection: {
    ...DEFAULT_LABEL_DETECTION_CONFIG,
    minConfidence: 0.5,
  },
};

/**
 * Preset configuration for comprehensive recording (maximum compatibility)
 */
export const PRESET_COMPREHENSIVE: Partial<Omit<RecordingConfig, 'projectId'>> = {
  capture: {
    ...DEFAULT_CAPTURE_CONFIG,
    captureEvents: ['click', 'dblclick', 'input', 'change', 'keydown', 'submit', 'focus', 'blur'],
    includeIframes: true,
    includeShadowDOM: true,
    includeClosedShadowDOM: true,
    filterSyntheticEvents: false,
    inputDebounceMs: 100,
  },
  labelDetection: {
    ...DEFAULT_LABEL_DETECTION_CONFIG,
    enableGoogleForms: true,
    enableBootstrap: true,
    enableMaterialUI: true,
    enableAria: true,
    enablePlaceholder: true,
    minConfidence: 0.3,
    maxLabelLength: 200,
  },
};

/**
 * Preset configuration for Google Forms
 */
export const PRESET_GOOGLE_FORMS: Partial<Omit<RecordingConfig, 'projectId'>> = {
  capture: {
    ...DEFAULT_CAPTURE_CONFIG,
    captureEvents: ['click', 'input', 'change'],
    includeShadowDOM: true,
    includeClosedShadowDOM: true,
  },
  labelDetection: {
    ...DEFAULT_LABEL_DETECTION_CONFIG,
    enableGoogleForms: true,
    enableAria: true,
    minConfidence: 0.4,
  },
};

/**
 * Preset names for easy reference
 */
export type PresetName = 'minimal' | 'standard' | 'comprehensive' | 'google-forms';

/**
 * Map of preset names to configurations
 */
export const PRESETS: Record<PresetName, Partial<Omit<RecordingConfig, 'projectId'>>> = {
  'minimal': PRESET_MINIMAL,
  'standard': PRESET_STANDARD,
  'comprehensive': PRESET_COMPREHENSIVE,
  'google-forms': PRESET_GOOGLE_FORMS,
};

/**
 * Create a configuration from a preset
 * 
 * @param projectId - Project ID
 * @param preset - Preset name or configuration
 * @returns Complete recording configuration
 */
export function createFromPreset(
  projectId: string,
  preset: PresetName | Partial<Omit<RecordingConfig, 'projectId'>>
): RecordingConfig {
  const presetConfig = typeof preset === 'string' ? PRESETS[preset] : preset;
  
  const base: RecordingConfig = {
    ...DEFAULT_RECORDING_CONFIG,
    projectId,
    capture: { ...DEFAULT_CAPTURE_CONFIG },
    labelDetection: { ...DEFAULT_LABEL_DETECTION_CONFIG },
  };
  
  return deepMerge(base, presetConfig as Partial<RecordingConfig>) as RecordingConfig;
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize configuration for storage
 * 
 * Removes non-serializable fields (functions like custom strategies)
 * 
 * @param config - Configuration to serialize
 * @returns JSON-serializable configuration
 */
export function serializeConfig(
  config: RecordingConfig
): Record<string, unknown> {
  const serializable = deepClone(config);
  
  // Remove custom strategies (functions can't be serialized)
  if (serializable.labelDetection?.customStrategies) {
    serializable.labelDetection.customStrategies = [];
  }
  
  return serializable as unknown as Record<string, unknown>;
}

/**
 * Deserialize configuration from storage
 * 
 * @param data - Serialized configuration data
 * @param customStrategies - Optional custom strategies to restore
 * @returns Deserialized configuration or null if invalid
 */
export function deserializeConfig(
  data: unknown,
  customStrategies?: ILabelDetectionStrategy[]
): RecordingConfig | null {
  const result = validateRecordingConfig(data);
  
  if (!result.valid) {
    console.warn('Invalid configuration data:', result.errors);
    return null;
  }
  
  const config = data as RecordingConfig;
  
  // Restore custom strategies if provided
  if (customStrategies && config.labelDetection) {
    config.labelDetection.customStrategies = customStrategies;
  }
  
  return config;
}

// ============================================================================
// MERGE UTILITIES
// ============================================================================

/**
 * Deep merge two configuration objects
 * 
 * @param base - Base configuration
 * @param overrides - Override values
 * @returns Merged configuration
 */
export function mergeConfig(
  base: RecordingConfig,
  overrides: Partial<RecordingConfig>
): RecordingConfig {
  return deepMerge(base, overrides) as RecordingConfig;
}

/**
 * Update a configuration with partial changes
 * 
 * @param config - Original configuration
 * @param updates - Partial updates
 * @returns New configuration with updates applied
 */
export function updateConfig(
  config: RecordingConfig,
  updates: Partial<RecordingConfig>
): RecordingConfig {
  const merged = mergeConfig(config, updates);
  const result = validateRecordingConfig(merged);
  
  if (!result.valid) {
    throw new Error(
      `Invalid configuration update: ${result.errors.map(e => e.message).join(', ')}`
    );
  }
  
  return merged;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object)) {
    const value = (obj as Record<string, unknown>)[key];
    // Don't clone functions
    if (typeof value === 'function') {
      cloned[key] = value;
    } else {
      cloned[key] = deepClone(value);
    }
  }
  
  return cloned as T;
}

/**
 * Deep freeze an object
 */
function deepFreeze<T extends object>(obj: T): T {
  const propNames = Object.getOwnPropertyNames(obj);
  
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === 'object' && typeof value !== 'function') {
      deepFreeze(value as object);
    }
  }
  
  return Object.freeze(obj);
}

/**
 * Deep merge objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }
  
  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Re-export types from interface for convenience
  type RecordingConfig,
  type CaptureConfig,
  type LabelDetectionConfig,
  type CaptureEventType,
  type ILabelDetectionStrategy,
  
  // Re-export defaults
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_LABEL_DETECTION_CONFIG,
  DEFAULT_RECORDING_CONFIG,
};
