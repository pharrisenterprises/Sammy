/**
 * Tests for RecordingConfig
 * @module core/recording/RecordingConfig.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Validation
  validateRecordingConfig,
  validateCaptureConfig,
  validateLabelDetectionConfig,
  CONFIG_LIMITS,
  VALID_CAPTURE_EVENTS,
  
  // Builder
  RecordingConfigBuilder,
  
  // Presets
  PRESET_MINIMAL,
  PRESET_STANDARD,
  PRESET_COMPREHENSIVE,
  PRESET_GOOGLE_FORMS,
  PRESETS,
  createFromPreset,
  
  // Serialization
  serializeConfig,
  deserializeConfig,
  
  // Merge utilities
  mergeConfig,
  updateConfig,
  
  // Types
  type ConfigValidationResult,
  type RecordingConfig,
} from './RecordingConfig';

import {
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_LABEL_DETECTION_CONFIG,
  createRecordingConfig,
} from './IRecordingEngine';

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateRecordingConfig', () => {
  it('should validate a correct configuration', () => {
    const config = createRecordingConfig('test-project');
    const result = validateRecordingConfig(config);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should require projectId', () => {
    const result = validateRecordingConfig({
      capture: DEFAULT_CAPTURE_CONFIG,
      labelDetection: DEFAULT_LABEL_DETECTION_CONFIG,
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'projectId')).toBe(true);
  });
  
  it('should reject empty projectId', () => {
    const result = validateRecordingConfig({
      projectId: '',
      capture: DEFAULT_CAPTURE_CONFIG,
      labelDetection: DEFAULT_LABEL_DETECTION_CONFIG,
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'projectId')).toBe(true);
  });
  
  it('should reject non-object config', () => {
    expect(validateRecordingConfig(null).valid).toBe(false);
    expect(validateRecordingConfig(undefined).valid).toBe(false);
    expect(validateRecordingConfig('string').valid).toBe(false);
    expect(validateRecordingConfig(123).valid).toBe(false);
  });
  
  it('should validate maxSteps', () => {
    const validConfig = createRecordingConfig('test', { maxSteps: 100 });
    expect(validateRecordingConfig(validConfig).valid).toBe(true);
    
    const negativeConfig = createRecordingConfig('test', { maxSteps: -1 });
    expect(validateRecordingConfig(negativeConfig).valid).toBe(false);
    
    // Non-integer should fail
    const result = validateRecordingConfig({
      projectId: 'test',
      maxSteps: 10.5,
    });
    expect(result.valid).toBe(false);
  });
  
  it('should warn for excessive maxSteps', () => {
    const config = createRecordingConfig('test', {
      maxSteps: CONFIG_LIMITS.MAX_STEPS_LIMIT + 1,
    });
    const result = validateRecordingConfig(config);
    
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.path === 'maxSteps')).toBe(true);
  });
  
  it('should validate maxDurationMs', () => {
    const validConfig = createRecordingConfig('test', { maxDurationMs: 60000 });
    expect(validateRecordingConfig(validConfig).valid).toBe(true);
    
    const negativeConfig = createRecordingConfig('test', { maxDurationMs: -1 });
    expect(validateRecordingConfig(negativeConfig).valid).toBe(false);
  });
  
  it('should validate autoSave and autoSaveIntervalMs', () => {
    const validConfig = createRecordingConfig('test', {
      autoSave: true,
      autoSaveIntervalMs: 5000,
    });
    expect(validateRecordingConfig(validConfig).valid).toBe(true);
    
    // Too small interval
    const smallInterval = createRecordingConfig('test', {
      autoSaveIntervalMs: 100,
    });
    expect(validateRecordingConfig(smallInterval).valid).toBe(false);
    
    // Too large interval
    const largeInterval = createRecordingConfig('test', {
      autoSaveIntervalMs: CONFIG_LIMITS.MAX_AUTO_SAVE_INTERVAL_MS + 1,
    });
    expect(validateRecordingConfig(largeInterval).valid).toBe(false);
  });
});

describe('validateCaptureConfig', () => {
  it('should validate correct capture config', () => {
    const errors = validateCaptureConfig(DEFAULT_CAPTURE_CONFIG);
    expect(errors).toHaveLength(0);
  });
  
  it('should validate captureEvents array', () => {
    const errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      captureEvents: ['click', 'input', 'change'],
    });
    expect(errors).toHaveLength(0);
  });
  
  it('should reject invalid event types', () => {
    const errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      captureEvents: ['click', 'invalid-event'],
    });
    expect(errors.some(e => e.path.includes('captureEvents'))).toBe(true);
  });
  
  it('should reject duplicate event types', () => {
    const errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      captureEvents: ['click', 'click'],
    });
    expect(errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });
  
  it('should validate inputDebounceMs range', () => {
    // Valid
    let errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      inputDebounceMs: 300,
    });
    expect(errors).toHaveLength(0);
    
    // Too low
    errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      inputDebounceMs: -1,
    });
    expect(errors.some(e => e.path === 'inputDebounceMs')).toBe(true);
    
    // Too high
    errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      inputDebounceMs: CONFIG_LIMITS.MAX_DEBOUNCE_MS + 1,
    });
    expect(errors.some(e => e.path === 'inputDebounceMs')).toBe(true);
  });
  
  it('should validate boolean fields', () => {
    const errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      includeIframes: 'yes' as unknown as boolean,
    });
    expect(errors.some(e => e.path === 'includeIframes')).toBe(true);
  });
  
  it('should allow null for optional selectors', () => {
    const errors = validateCaptureConfig({
      ...DEFAULT_CAPTURE_CONFIG,
      ignoreSelector: null,
      containerSelector: null,
    });
    expect(errors).toHaveLength(0);
  });
});

describe('validateLabelDetectionConfig', () => {
  it('should validate correct label detection config', () => {
    const errors = validateLabelDetectionConfig(DEFAULT_LABEL_DETECTION_CONFIG);
    expect(errors).toHaveLength(0);
  });
  
  it('should validate minConfidence range', () => {
    // Valid
    let errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      minConfidence: 0.5,
    });
    expect(errors).toHaveLength(0);
    
    // Too low
    errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      minConfidence: -0.1,
    });
    expect(errors.some(e => e.path === 'minConfidence')).toBe(true);
    
    // Too high
    errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      minConfidence: 1.5,
    });
    expect(errors.some(e => e.path === 'minConfidence')).toBe(true);
  });
  
  it('should validate maxLabelLength range', () => {
    // Valid
    let errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      maxLabelLength: 100,
    });
    expect(errors).toHaveLength(0);
    
    // Too low
    errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      maxLabelLength: 0,
    });
    expect(errors.some(e => e.path === 'maxLabelLength')).toBe(true);
  });
  
  it('should validate customStrategies', () => {
    const validStrategy = {
      name: 'custom',
      baseConfidence: 0.8,
      priority: 5,
      detect: () => null,
      canHandle: () => true,
    };
    
    const errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      customStrategies: [validStrategy],
    });
    expect(errors).toHaveLength(0);
  });
  
  it('should reject invalid customStrategies', () => {
    const errors = validateLabelDetectionConfig({
      ...DEFAULT_LABEL_DETECTION_CONFIG,
      customStrategies: [{ invalid: true }],
    });
    expect(errors.some(e => e.path.includes('customStrategies'))).toBe(true);
  });
});

// ============================================================================
// BUILDER TESTS
// ============================================================================

describe('RecordingConfigBuilder', () => {
  it('should create a config with required projectId', () => {
    const config = new RecordingConfigBuilder('test-project').build();
    expect(config.projectId).toBe('test-project');
  });
  
  it('should include defaults', () => {
    const config = new RecordingConfigBuilder('test').build();
    expect(config.capture).toBeDefined();
    expect(config.labelDetection).toBeDefined();
    expect(config.capture.includeIframes).toBe(true);
  });
  
  it('should support fluent configuration', () => {
    const config = new RecordingConfigBuilder('test')
      .withSessionName('My Session')
      .withMaxSteps(100)
      .withMaxDuration(60000)
      .captureEvents(['click', 'input'])
      .includeIframes(false)
      .includeShadowDOM(true)
      .withMinConfidence(0.7)
      .enableGoogleForms(true)
      .build();
    
    expect(config.sessionName).toBe('My Session');
    expect(config.maxSteps).toBe(100);
    expect(config.maxDurationMs).toBe(60000);
    expect(config.capture.captureEvents).toEqual(['click', 'input']);
    expect(config.capture.includeIframes).toBe(false);
    expect(config.capture.includeShadowDOM).toBe(true);
    expect(config.labelDetection.minConfidence).toBe(0.7);
    expect(config.labelDetection.enableGoogleForms).toBe(true);
  });
  
  it('should support adding capture events', () => {
    const config = new RecordingConfigBuilder('test')
      .captureEvents(['click'])
      .addCaptureEvent('input')
      .addCaptureEvent('change')
      .build();
    
    expect(config.capture.captureEvents).toContain('click');
    expect(config.capture.captureEvents).toContain('input');
    expect(config.capture.captureEvents).toContain('change');
  });
  
  it('should not add duplicate events', () => {
    const config = new RecordingConfigBuilder('test')
      .captureEvents(['click'])
      .addCaptureEvent('click')
      .build();
    
    const clickCount = config.capture.captureEvents.filter(e => e === 'click').length;
    expect(clickCount).toBe(1);
  });
  
  it('should support removing capture events', () => {
    const config = new RecordingConfigBuilder('test')
      .captureEvents(['click', 'input', 'change'])
      .removeCaptureEvent('input')
      .build();
    
    expect(config.capture.captureEvents).toContain('click');
    expect(config.capture.captureEvents).not.toContain('input');
    expect(config.capture.captureEvents).toContain('change');
  });
  
  it('should support visual feedback configuration', () => {
    const config = new RecordingConfigBuilder('test')
      .withVisualFeedback(true, 1000, 'my-highlight')
      .build();
    
    expect(config.capture.enableVisualFeedback).toBe(true);
    expect(config.capture.highlightDurationMs).toBe(1000);
    expect(config.capture.highlightClassName).toBe('my-highlight');
  });
  
  it('should support auto-save configuration', () => {
    const config = new RecordingConfigBuilder('test')
      .withAutoSave(true, 10000)
      .build();
    
    expect(config.autoSave).toBe(true);
    expect(config.autoSaveIntervalMs).toBe(10000);
  });
  
  it('should support adding custom label strategies', () => {
    const strategy = {
      name: 'custom',
      baseConfidence: 0.8,
      priority: 5,
      detect: () => null,
      canHandle: () => true,
    };
    
    const config = new RecordingConfigBuilder('test')
      .addLabelStrategy(strategy)
      .build();
    
    expect(config.labelDetection.customStrategies).toHaveLength(1);
    expect(config.labelDetection.customStrategies[0].name).toBe('custom');
  });
  
  it('should throw on invalid configuration', () => {
    expect(() => {
      new RecordingConfigBuilder('')
        .build();
    }).toThrow();
  });
  
  it('should support buildUnsafe', () => {
    const config = new RecordingConfigBuilder('')
      .buildUnsafe();
    
    // Should return config even though invalid
    expect(config.projectId).toBe('');
  });
  
  it('should support validation check', () => {
    const builder = new RecordingConfigBuilder('');
    const result = builder.validate();
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
  
  it('should support reset', () => {
    const builder = new RecordingConfigBuilder('test')
      .withMaxSteps(100)
      .captureEvents(['click'])
      .reset();
    
    const config = builder.build();
    
    expect(config.maxSteps).toBe(0);
    expect(config.capture.captureEvents).toEqual(DEFAULT_CAPTURE_CONFIG.captureEvents);
  });
  
  it('should support clone', () => {
    const builder1 = new RecordingConfigBuilder('test')
      .withMaxSteps(100);
    
    const builder2 = builder1.clone()
      .withMaxSteps(200);
    
    expect(builder1.build().maxSteps).toBe(100);
    expect(builder2.build().maxSteps).toBe(200);
  });
  
  it('should return frozen config', () => {
    const config = new RecordingConfigBuilder('test').build();
    
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as any).projectId = 'modified';
    }).toThrow();
  });
});

// ============================================================================
// PRESET TESTS
// ============================================================================

describe('Presets', () => {
  it('should have all expected presets', () => {
    expect(PRESETS['minimal']).toBeDefined();
    expect(PRESETS['standard']).toBeDefined();
    expect(PRESETS['comprehensive']).toBeDefined();
    expect(PRESETS['google-forms']).toBeDefined();
  });
  
  it('PRESET_MINIMAL should have reduced features', () => {
    expect(PRESET_MINIMAL.capture?.includeIframes).toBe(false);
    expect(PRESET_MINIMAL.capture?.includeShadowDOM).toBe(false);
    expect(PRESET_MINIMAL.capture?.enableVisualFeedback).toBe(false);
    expect(PRESET_MINIMAL.labelDetection?.enableGoogleForms).toBe(false);
  });
  
  it('PRESET_COMPREHENSIVE should have all features', () => {
    expect(PRESET_COMPREHENSIVE.capture?.includeIframes).toBe(true);
    expect(PRESET_COMPREHENSIVE.capture?.includeShadowDOM).toBe(true);
    expect(PRESET_COMPREHENSIVE.capture?.includeClosedShadowDOM).toBe(true);
    expect(PRESET_COMPREHENSIVE.labelDetection?.enableGoogleForms).toBe(true);
    expect(PRESET_COMPREHENSIVE.labelDetection?.enableBootstrap).toBe(true);
    expect(PRESET_COMPREHENSIVE.labelDetection?.enableMaterialUI).toBe(true);
  });
  
  it('PRESET_GOOGLE_FORMS should enable Google Forms detection', () => {
    expect(PRESET_GOOGLE_FORMS.labelDetection?.enableGoogleForms).toBe(true);
    expect(PRESET_GOOGLE_FORMS.capture?.includeClosedShadowDOM).toBe(true);
  });
});

describe('createFromPreset', () => {
  it('should create config from preset name', () => {
    const config = createFromPreset('test-project', 'minimal');
    
    expect(config.projectId).toBe('test-project');
    expect(config.capture.includeIframes).toBe(false);
  });
  
  it('should create config from preset object', () => {
    const config = createFromPreset('test-project', {
      maxSteps: 50,
      capture: {
        ...DEFAULT_CAPTURE_CONFIG,
        captureEvents: ['click'],
      },
    });
    
    expect(config.projectId).toBe('test-project');
    expect(config.maxSteps).toBe(50);
    expect(config.capture.captureEvents).toEqual(['click']);
  });
  
  it('should preserve defaults for unspecified fields', () => {
    const config = createFromPreset('test', 'minimal');
    
    // Should have default label detection settings not overridden by minimal
    expect(config.labelDetection.enableAria).toBe(true);
  });
});

// ============================================================================
// SERIALIZATION TESTS
// ============================================================================

describe('serializeConfig', () => {
  it('should serialize config to JSON-safe object', () => {
    const config = createRecordingConfig('test');
    const serialized = serializeConfig(config);
    
    // Should be JSON-serializable
    const json = JSON.stringify(serialized);
    expect(() => JSON.parse(json)).not.toThrow();
  });
  
  it('should remove custom strategies (functions)', () => {
    const strategy = {
      name: 'custom',
      baseConfidence: 0.8,
      priority: 5,
      detect: () => null,
      canHandle: () => true,
    };
    
    const config = new RecordingConfigBuilder('test')
      .addLabelStrategy(strategy)
      .buildUnsafe();
    
    const serialized = serializeConfig(config);
    
    expect(
      (serialized as any).labelDetection.customStrategies
    ).toHaveLength(0);
  });
});

describe('deserializeConfig', () => {
  it('should deserialize valid config', () => {
    const original = createRecordingConfig('test');
    const serialized = serializeConfig(original);
    const deserialized = deserializeConfig(serialized);
    
    expect(deserialized).not.toBeNull();
    expect(deserialized?.projectId).toBe('test');
  });
  
  it('should return null for invalid config', () => {
    const result = deserializeConfig({ invalid: true });
    expect(result).toBeNull();
  });
  
  it('should restore custom strategies if provided', () => {
    const original = createRecordingConfig('test');
    const serialized = serializeConfig(original);
    
    const strategy = {
      name: 'restored',
      baseConfidence: 0.9,
      priority: 1,
      detect: () => null,
      canHandle: () => true,
    };
    
    const deserialized = deserializeConfig(serialized, [strategy]);
    
    expect(deserialized?.labelDetection.customStrategies).toHaveLength(1);
    expect(deserialized?.labelDetection.customStrategies[0].name).toBe('restored');
  });
});

// ============================================================================
// MERGE TESTS
// ============================================================================

describe('mergeConfig', () => {
  it('should merge configurations', () => {
    const base = createRecordingConfig('test');
    const merged = mergeConfig(base, {
      maxSteps: 100,
      capture: {
        ...base.capture,
        includeIframes: false,
      },
    });
    
    expect(merged.projectId).toBe('test');
    expect(merged.maxSteps).toBe(100);
    expect(merged.capture.includeIframes).toBe(false);
    // Other capture settings should be preserved
    expect(merged.capture.includeShadowDOM).toBe(base.capture.includeShadowDOM);
  });
  
  it('should not mutate original config', () => {
    const base = createRecordingConfig('test');
    const originalMaxSteps = base.maxSteps;
    
    mergeConfig(base, { maxSteps: 999 });
    
    expect(base.maxSteps).toBe(originalMaxSteps);
  });
});

describe('updateConfig', () => {
  it('should update config with validation', () => {
    const config = createRecordingConfig('test');
    const updated = updateConfig(config, { maxSteps: 50 });
    
    expect(updated.maxSteps).toBe(50);
  });
  
  it('should throw on invalid update', () => {
    const config = createRecordingConfig('test');
    
    expect(() => {
      updateConfig(config, { maxSteps: -1 });
    }).toThrow();
  });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('VALID_CAPTURE_EVENTS', () => {
  it('should include all expected event types', () => {
    expect(VALID_CAPTURE_EVENTS).toContain('click');
    expect(VALID_CAPTURE_EVENTS).toContain('dblclick');
    expect(VALID_CAPTURE_EVENTS).toContain('input');
    expect(VALID_CAPTURE_EVENTS).toContain('change');
    expect(VALID_CAPTURE_EVENTS).toContain('keydown');
    expect(VALID_CAPTURE_EVENTS).toContain('submit');
  });
});

describe('CONFIG_LIMITS', () => {
  it('should have sensible limits', () => {
    expect(CONFIG_LIMITS.MIN_DEBOUNCE_MS).toBeLessThan(CONFIG_LIMITS.MAX_DEBOUNCE_MS);
    expect(CONFIG_LIMITS.MIN_CONFIDENCE).toBeLessThan(CONFIG_LIMITS.MAX_CONFIDENCE);
    expect(CONFIG_LIMITS.MIN_LABEL_LENGTH).toBeLessThan(CONFIG_LIMITS.MAX_LABEL_LENGTH);
  });
});
