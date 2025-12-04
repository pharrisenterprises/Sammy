/**
 * Tests for BackgroundConfig
 * @module background/BackgroundConfig.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BackgroundConfig,
  createBackgroundConfig,
  createDevelopmentConfig,
  createProductionConfig,
  createTestingConfig,
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_KEEPALIVE_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEVELOPMENT_CONFIG,
  PRODUCTION_CONFIG,
  TESTING_CONFIG,
} from './BackgroundConfig';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('BackgroundConfig', () => {
  let config: BackgroundConfig;

  beforeEach(() => {
    config = new BackgroundConfig();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const result = config.getConfig();
      expect(result.keepalive.enabled).toBe(true);
      expect(result.retry.maxAttempts).toBe(3);
    });

    it('should accept overrides', () => {
      const custom = new BackgroundConfig({
        retry: { maxAttempts: 5 } as any,
      });
      expect(custom.getRetryConfig().maxAttempts).toBe(5);
    });

    it('should preserve defaults for non-overridden values', () => {
      const custom = new BackgroundConfig({
        retry: { maxAttempts: 5 } as any,
      });
      expect(custom.getRetryConfig().baseDelay).toBe(DEFAULT_RETRY_CONFIG.baseDelay);
    });
  });

  // ==========================================================================
  // GETTER TESTS
  // ==========================================================================

  describe('getters', () => {
    it('should return keepalive config', () => {
      const keepalive = config.getKeepaliveConfig();
      expect(keepalive.enabled).toBe(true);
      expect(keepalive.intervalMinutes).toBe(0.5);
    });

    it('should return message config', () => {
      const message = config.getMessageConfig();
      expect(message.timeout).toBe(30000);
      expect(message.validateMessages).toBe(true);
    });

    it('should return retry config', () => {
      const retry = config.getRetryConfig();
      expect(retry.maxAttempts).toBe(3);
      expect(retry.exponentialBackoff).toBe(true);
    });

    it('should return injection config', () => {
      const injection = config.getInjectionConfig();
      expect(injection.mainScriptPath).toBe('js/main.js');
      expect(injection.allFrames).toBe(true);
    });

    it('should return state config', () => {
      const state = config.getStateConfig();
      expect(state.enabled).toBe(true);
      expect(state.storageType).toBe('local');
    });

    it('should return tab config', () => {
      const tab = config.getTabConfig();
      expect(tab.maxTrackedTabs).toBe(50);
    });

    it('should return logging config', () => {
      const logging = config.getLoggingConfig();
      expect(logging.level).toBe('info');
    });

    it('should return telemetry config', () => {
      const telemetry = config.getTelemetryConfig();
      expect(telemetry.enabled).toBe(false);
    });

    it('should return copies, not references', () => {
      const keepalive1 = config.getKeepaliveConfig();
      const keepalive2 = config.getKeepaliveConfig();
      expect(keepalive1).not.toBe(keepalive2);
      expect(keepalive1).toEqual(keepalive2);
    });
  });

  // ==========================================================================
  // SETTER TESTS
  // ==========================================================================

  describe('setters', () => {
    it('should update keepalive config', () => {
      config.updateKeepalive({ intervalMinutes: 1 });
      expect(config.getKeepaliveConfig().intervalMinutes).toBe(1);
    });

    it('should update message config', () => {
      config.updateMessage({ timeout: 5000 });
      expect(config.getMessageConfig().timeout).toBe(5000);
    });

    it('should update retry config', () => {
      config.updateRetry({ maxAttempts: 5 });
      expect(config.getRetryConfig().maxAttempts).toBe(5);
    });

    it('should update injection config', () => {
      config.updateInjection({ allFrames: false });
      expect(config.getInjectionConfig().allFrames).toBe(false);
    });

    it('should update state config', () => {
      config.updateState({ storageType: 'sync' });
      expect(config.getStateConfig().storageType).toBe('sync');
    });

    it('should update tab config', () => {
      config.updateTab({ maxTrackedTabs: 100 });
      expect(config.getTabConfig().maxTrackedTabs).toBe(100);
    });

    it('should update logging config', () => {
      config.updateLogging({ level: 'debug' });
      expect(config.getLoggingConfig().level).toBe('debug');
    });

    it('should update telemetry config', () => {
      config.updateTelemetry({ enabled: true });
      expect(config.getTelemetryConfig().enabled).toBe(true);
    });

    it('should preserve other values when updating', () => {
      config.updateRetry({ maxAttempts: 5 });
      expect(config.getRetryConfig().baseDelay).toBe(1000);
    });
  });

  // ==========================================================================
  // PRESET TESTS
  // ==========================================================================

  describe('presets', () => {
    it('should apply development preset', () => {
      config.applyPreset('development');
      expect(config.getLoggingConfig().level).toBe('debug');
      expect(config.getMessageConfig().logMessages).toBe(true);
      expect(config.getTelemetryConfig().enabled).toBe(true);
    });

    it('should apply production preset', () => {
      config.applyPreset('production');
      expect(config.getLoggingConfig().level).toBe('warn');
      expect(config.getMessageConfig().logMessages).toBe(false);
      expect(config.getTelemetryConfig().enabled).toBe(false);
    });

    it('should apply testing preset', () => {
      config.applyPreset('testing');
      expect(config.getKeepaliveConfig().enabled).toBe(false);
      expect(config.getMessageConfig().timeout).toBe(5000);
      expect(config.getRetryConfig().maxAttempts).toBe(1);
    });

    it('should reset to defaults', () => {
      config.updateRetry({ maxAttempts: 10 });
      config.reset();
      expect(config.getRetryConfig().maxAttempts).toBe(3);
    });
  });

  // ==========================================================================
  // UTILITY TESTS
  // ==========================================================================

  describe('calculateRetryDelay', () => {
    it('should return base delay for first attempt', () => {
      const delay = config.calculateRetryDelay(0);
      // With jitter, should be approximately baseDelay
      expect(delay).toBeGreaterThan(800);
      expect(delay).toBeLessThan(1200);
    });

    it('should apply exponential backoff', () => {
      config.updateRetry({ jitterFactor: 0 }); // Disable jitter for testing
      expect(config.calculateRetryDelay(0)).toBe(1000);
      expect(config.calculateRetryDelay(1)).toBe(2000);
      expect(config.calculateRetryDelay(2)).toBe(4000);
    });

    it('should respect max delay', () => {
      config.updateRetry({ jitterFactor: 0, maxDelay: 3000 });
      expect(config.calculateRetryDelay(5)).toBe(3000);
    });

    it('should apply jitter', () => {
      config.updateRetry({ jitterFactor: 0.5 });
      const delays = Array.from({ length: 10 }, () => config.calculateRetryDelay(0));
      const uniqueDelays = new Set(delays);
      // Should have variation due to jitter
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when retries available', () => {
      expect(config.shouldRetry(0)).toBe(true);
      expect(config.shouldRetry(1)).toBe(true);
    });

    it('should return false when max attempts reached', () => {
      expect(config.shouldRetry(2)).toBe(false);
      expect(config.shouldRetry(3)).toBe(false);
    });

    it('should return false when retry disabled', () => {
      config.updateRetry({ enabled: false });
      expect(config.shouldRetry(0)).toBe(false);
    });
  });

  describe('isLogLevelEnabled', () => {
    it('should respect log level hierarchy', () => {
      config.updateLogging({ level: 'info' });
      expect(config.isLogLevelEnabled('debug')).toBe(false);
      expect(config.isLogLevelEnabled('info')).toBe(true);
      expect(config.isLogLevelEnabled('warn')).toBe(true);
      expect(config.isLogLevelEnabled('error')).toBe(true);
    });

    it('should return false when logging disabled', () => {
      config.updateLogging({ enabled: false });
      expect(config.isLogLevelEnabled('error')).toBe(false);
    });
  });

  describe('getStateKey', () => {
    it('should add prefix to key', () => {
      expect(config.getStateKey('openedTabId')).toBe('bg_openedTabId');
    });

    it('should use custom prefix', () => {
      config.updateState({ keyPrefix: 'custom_' });
      expect(config.getStateKey('test')).toBe('custom_test');
    });
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('validate', () => {
    it('should pass for default config', () => {
      const result = config.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid keepalive interval', () => {
      config.updateKeepalive({ intervalMinutes: 0 });
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('keepalive.intervalMinutes must be positive');
    });

    it('should fail for invalid retry attempts', () => {
      config.updateRetry({ maxAttempts: 0 });
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('retry.maxAttempts must be at least 1');
    });

    it('should fail for invalid jitter factor', () => {
      config.updateRetry({ jitterFactor: 1.5 });
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('retry.jitterFactor must be between 0 and 1');
    });

    it('should fail for missing script path', () => {
      config.updateInjection({ mainScriptPath: '' });
      const result = config.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('injection.mainScriptPath is required');
    });
  });

  // ==========================================================================
  // SERIALIZATION TESTS
  // ==========================================================================

  describe('serialization', () => {
    it('should export to JSON', () => {
      const json = config.toJSON();
      const parsed = JSON.parse(json);
      expect(parsed.retry.maxAttempts).toBe(3);
    });

    it('should import from JSON', () => {
      const json = JSON.stringify({ retry: { maxAttempts: 5 } });
      config.fromJSON(json);
      expect(config.getRetryConfig().maxAttempts).toBe(5);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('Factory Functions', () => {
  it('should create config with createBackgroundConfig', () => {
    const config = createBackgroundConfig({ retry: { maxAttempts: 5 } as any });
    expect(config).toBeInstanceOf(BackgroundConfig);
    expect(config.getRetryConfig().maxAttempts).toBe(5);
  });

  it('should create development config', () => {
    const config = createDevelopmentConfig();
    expect(config.getLoggingConfig().level).toBe('debug');
  });

  it('should create production config', () => {
    const config = createProductionConfig();
    expect(config.getLoggingConfig().level).toBe('warn');
  });

  it('should create testing config', () => {
    const config = createTestingConfig();
    expect(config.getKeepaliveConfig().enabled).toBe(false);
  });
});
