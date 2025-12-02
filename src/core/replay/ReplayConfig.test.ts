/**
 * Tests for ReplayConfig
 * @module core/replay/ReplayConfig.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type ReplayConfig,
  type FlatReplayConfig,
  type TimingConfig,
  type LocatorConfig,
  type ReplayPreset,
  type ValidationError,
  
  // Defaults
  DEFAULT_REPLAY_CONFIG,
  DEFAULT_TIMING_CONFIG,
  DEFAULT_LOCATOR_CONFIG,
  DEFAULT_BEHAVIOR_CONFIG,
  DEFAULT_FLAT_CONFIG,
  REPLAY_PRESETS,
  
  // Factory functions
  getDefaultReplayConfig,
  getReplayPreset,
  createReplayConfig,
  createFlatReplayConfig,
  mergeReplayConfig,
  flattenReplayConfig,
  unflattenReplayConfig,
  
  // Validation
  validateTimingConfig,
  validateLocatorConfig,
  validateReplayConfig,
  
  // Manager
  ReplayConfigManager,
  getReplayConfigManager,
  resetReplayConfigManager,
} from './ReplayConfig';

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('default configurations', () => {
  describe('DEFAULT_TIMING_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TIMING_CONFIG.findTimeout).toBe(2000);
      expect(DEFAULT_TIMING_CONFIG.retryInterval).toBe(150);
      expect(DEFAULT_TIMING_CONFIG.maxRetries).toBe(13);
      expect(DEFAULT_TIMING_CONFIG.stepDelay).toBe(0);
      expect(DEFAULT_TIMING_CONFIG.humanDelay).toBeNull();
      expect(DEFAULT_TIMING_CONFIG.actionTimeout).toBe(5000);
      expect(DEFAULT_TIMING_CONFIG.navigationTimeout).toBe(30000);
    });
  });
  
  describe('DEFAULT_LOCATOR_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_LOCATOR_CONFIG.fuzzyMatchThreshold).toBe(0.4);
      expect(DEFAULT_LOCATOR_CONFIG.boundingBoxThreshold).toBe(200);
      expect(DEFAULT_LOCATOR_CONFIG.enableShadowDom).toBe(true);
      expect(DEFAULT_LOCATOR_CONFIG.enableIframes).toBe(true);
      expect(DEFAULT_LOCATOR_CONFIG.strategyPriority).toContain('xpath');
    });
  });
  
  describe('DEFAULT_BEHAVIOR_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_BEHAVIOR_CONFIG.continueOnFailure).toBe(false);
      expect(DEFAULT_BEHAVIOR_CONFIG.scrollIntoView).toBe(true);
      expect(DEFAULT_BEHAVIOR_CONFIG.reactSafeInput).toBe(true);
      expect(DEFAULT_BEHAVIOR_CONFIG.humanLikeMouse).toBe(true);
    });
  });
  
  describe('DEFAULT_FLAT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_FLAT_CONFIG.findTimeout).toBe(2000);
      expect(DEFAULT_FLAT_CONFIG.fuzzyMatchThreshold).toBe(0.4);
      expect(DEFAULT_FLAT_CONFIG.continueOnFailure).toBe(false);
    });
  });
});

// ============================================================================
// PRESET TESTS
// ============================================================================

describe('REPLAY_PRESETS', () => {
  it('should have all expected presets', () => {
    expect(REPLAY_PRESETS.default).toBeDefined();
    expect(REPLAY_PRESETS.fast).toBeDefined();
    expect(REPLAY_PRESETS.realistic).toBeDefined();
    expect(REPLAY_PRESETS.debug).toBeDefined();
    expect(REPLAY_PRESETS.tolerant).toBeDefined();
  });
  
  describe('fast preset', () => {
    it('should have reduced timeouts', () => {
      const preset = REPLAY_PRESETS.fast;
      expect(preset.timing?.findTimeout).toBe(1000);
      expect(preset.timing?.retryInterval).toBe(50);
    });
    
    it('should disable human-like behavior', () => {
      const preset = REPLAY_PRESETS.fast;
      expect(preset.behavior?.humanLikeMouse).toBe(false);
    });
  });
  
  describe('realistic preset', () => {
    it('should have human delays', () => {
      const preset = REPLAY_PRESETS.realistic;
      expect(preset.timing?.humanDelay).toEqual([50, 300]);
      expect(preset.timing?.keystrokeDelay).toBe(50);
    });
  });
  
  describe('debug preset', () => {
    it('should enable visual feedback', () => {
      const preset = REPLAY_PRESETS.debug;
      expect(preset.visual?.highlightElements).toBe(true);
      expect(preset.visual?.showProgressOverlay).toBe(true);
    });
    
    it('should enable error capturing', () => {
      const preset = REPLAY_PRESETS.debug;
      expect(preset.error?.captureScreenshots).toBe(true);
      expect(preset.error?.verboseErrors).toBe(true);
    });
  });
  
  describe('tolerant preset', () => {
    it('should have relaxed thresholds', () => {
      const preset = REPLAY_PRESETS.tolerant;
      expect(preset.locator?.fuzzyMatchThreshold).toBe(0.3);
      expect(preset.locator?.boundingBoxThreshold).toBe(300);
    });
    
    it('should continue on failure', () => {
      const preset = REPLAY_PRESETS.tolerant;
      expect(preset.behavior?.continueOnFailure).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  describe('getDefaultReplayConfig', () => {
    it('should return default config', () => {
      const config = getDefaultReplayConfig();
      
      expect(config.timing.findTimeout).toBe(2000);
      expect(config.locator.fuzzyMatchThreshold).toBe(0.4);
    });
    
    it('should return a copy (not reference)', () => {
      const config1 = getDefaultReplayConfig();
      const config2 = getDefaultReplayConfig();
      
      config1.timing.findTimeout = 9999;
      
      expect(config2.timing.findTimeout).toBe(2000);
    });
  });
  
  describe('getReplayPreset', () => {
    it('should return preset config', () => {
      const config = getReplayPreset('fast');
      
      expect(config.timing.findTimeout).toBe(1000);
      expect(config.behavior.humanLikeMouse).toBe(false);
    });
    
    it('should merge preset with defaults', () => {
      const config = getReplayPreset('fast');
      
      // From preset
      expect(config.timing.findTimeout).toBe(1000);
      
      // From defaults (not overridden)
      expect(config.locator.fuzzyMatchThreshold).toBe(0.4);
    });
  });
  
  describe('createReplayConfig', () => {
    it('should create config with overrides', () => {
      const config = createReplayConfig({
        timing: { findTimeout: 5000 },
        behavior: { continueOnFailure: true },
      });
      
      expect(config.timing.findTimeout).toBe(5000);
      expect(config.behavior.continueOnFailure).toBe(true);
    });
    
    it('should preserve defaults for unspecified values', () => {
      const config = createReplayConfig({
        timing: { findTimeout: 5000 },
      });
      
      expect(config.timing.retryInterval).toBe(150);
      expect(config.locator.fuzzyMatchThreshold).toBe(0.4);
    });
  });
  
  describe('createFlatReplayConfig', () => {
    it('should create flat config with overrides', () => {
      const config = createFlatReplayConfig({
        findTimeout: 5000,
        continueOnFailure: true,
      });
      
      expect(config.findTimeout).toBe(5000);
      expect(config.continueOnFailure).toBe(true);
    });
  });
  
  describe('mergeReplayConfig', () => {
    it('should merge configs deeply', () => {
      const base = getDefaultReplayConfig();
      const overrides = {
        timing: { findTimeout: 5000 },
        locator: { fuzzyMatchThreshold: 0.5 },
      };
      
      const merged = mergeReplayConfig(base, overrides);
      
      expect(merged.timing.findTimeout).toBe(5000);
      expect(merged.timing.retryInterval).toBe(150); // From base
      expect(merged.locator.fuzzyMatchThreshold).toBe(0.5);
    });
  });
});

// ============================================================================
// CONVERSION TESTS
// ============================================================================

describe('config conversion', () => {
  describe('flattenReplayConfig', () => {
    it('should flatten structured config', () => {
      const config = getDefaultReplayConfig();
      const flat = flattenReplayConfig(config);
      
      expect(flat.findTimeout).toBe(config.timing.findTimeout);
      expect(flat.fuzzyMatchThreshold).toBe(config.locator.fuzzyMatchThreshold);
      expect(flat.continueOnFailure).toBe(config.behavior.continueOnFailure);
    });
  });
  
  describe('unflattenReplayConfig', () => {
    it('should unflatten flat config', () => {
      const flat: Partial<FlatReplayConfig> = {
        findTimeout: 5000,
        fuzzyMatchThreshold: 0.5,
        continueOnFailure: true,
      };
      
      const structured = unflattenReplayConfig(flat);
      
      expect(structured.timing?.findTimeout).toBe(5000);
      expect(structured.locator?.fuzzyMatchThreshold).toBe(0.5);
      expect(structured.behavior?.continueOnFailure).toBe(true);
    });
  });
  
  it('should roundtrip correctly', () => {
    const original = getDefaultReplayConfig();
    const flat = flattenReplayConfig(original);
    const unflat = unflattenReplayConfig(flat);
    const reconstructed = createReplayConfig(unflat);
    
    expect(reconstructed.timing.findTimeout).toBe(original.timing.findTimeout);
    expect(reconstructed.locator.fuzzyMatchThreshold).toBe(original.locator.fuzzyMatchThreshold);
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validation', () => {
  describe('validateTimingConfig', () => {
    it('should pass valid config', () => {
      const errors = validateTimingConfig({
        findTimeout: 2000,
        retryInterval: 150,
      });
      
      expect(errors).toHaveLength(0);
    });
    
    it('should fail for negative findTimeout', () => {
      const errors = validateTimingConfig({ findTimeout: -1 });
      
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('timing.findTimeout');
    });
    
    it('should fail for invalid humanDelay', () => {
      const errors = validateTimingConfig({ humanDelay: [500, 100] });
      
      expect(errors.some(e => e.field === 'timing.humanDelay')).toBe(true);
    });
  });
  
  describe('validateLocatorConfig', () => {
    it('should pass valid config', () => {
      const errors = validateLocatorConfig({
        fuzzyMatchThreshold: 0.4,
        boundingBoxThreshold: 200,
      });
      
      expect(errors).toHaveLength(0);
    });
    
    it('should fail for out-of-range threshold', () => {
      const errors = validateLocatorConfig({ fuzzyMatchThreshold: 1.5 });
      
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('locator.fuzzyMatchThreshold');
    });
  });
  
  describe('validateReplayConfig', () => {
    it('should validate complete config', () => {
      const config = createReplayConfig({
        timing: { findTimeout: -1 },
        locator: { fuzzyMatchThreshold: 2 },
      });
      
      const errors = validateReplayConfig(config);
      
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// CONFIG MANAGER TESTS
// ============================================================================

describe('ReplayConfigManager', () => {
  beforeEach(() => {
    resetReplayConfigManager();
  });
  
  afterEach(() => {
    resetReplayConfigManager();
  });
  
  it('should create with default config', () => {
    const manager = new ReplayConfigManager();
    const config = manager.getConfig();
    
    expect(config.timing.findTimeout).toBe(2000);
  });
  
  it('should create with custom config', () => {
    const manager = new ReplayConfigManager({
      timing: { findTimeout: 5000 },
    });
    
    expect(manager.getConfig().timing.findTimeout).toBe(5000);
  });
  
  it('should update config', () => {
    const manager = new ReplayConfigManager();
    
    manager.setConfig({ timing: { findTimeout: 3000 } });
    
    expect(manager.getConfig().timing.findTimeout).toBe(3000);
  });
  
  it('should apply preset', () => {
    const manager = new ReplayConfigManager();
    
    manager.applyPreset('fast');
    
    expect(manager.getConfig().timing.findTimeout).toBe(1000);
  });
  
  it('should reset to default', () => {
    const manager = new ReplayConfigManager({ timing: { findTimeout: 5000 } });
    
    manager.reset();
    
    expect(manager.getConfig().timing.findTimeout).toBe(2000);
  });
  
  it('should get specific category', () => {
    const manager = new ReplayConfigManager();
    
    const timing = manager.get('timing');
    
    expect(timing.findTimeout).toBe(2000);
  });
  
  it('should set specific category', () => {
    const manager = new ReplayConfigManager();
    
    manager.set('timing', { findTimeout: 3000 });
    
    expect(manager.getConfig().timing.findTimeout).toBe(3000);
  });
  
  it('should validate config', () => {
    const manager = new ReplayConfigManager();
    
    expect(manager.isValid()).toBe(true);
    expect(manager.validate()).toHaveLength(0);
  });
  
  it('should return flat config', () => {
    const manager = new ReplayConfigManager();
    
    const flat = manager.getFlatConfig();
    
    expect(flat.findTimeout).toBe(2000);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  beforeEach(() => {
    resetReplayConfigManager();
  });
  
  afterEach(() => {
    resetReplayConfigManager();
  });
  
  it('should return same instance', () => {
    const manager1 = getReplayConfigManager();
    const manager2 = getReplayConfigManager();
    
    expect(manager1).toBe(manager2);
  });
  
  it('should reset instance', () => {
    const manager1 = getReplayConfigManager();
    manager1.setConfig({ timing: { findTimeout: 9999 } });
    
    resetReplayConfigManager();
    
    const manager2 = getReplayConfigManager();
    expect(manager2.getConfig().timing.findTimeout).toBe(2000);
  });
});
