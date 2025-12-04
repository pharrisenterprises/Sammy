/**
 * BackgroundConfig - Configuration for Background Service
 * @module background/BackgroundConfig
 * @version 1.0.0
 * 
 * Configuration options for the Manifest V3 service worker including:
 * - Keepalive settings to prevent service worker termination
 * - Message handling timeouts and retry policies
 * - Script injection configuration
 * - State persistence options
 * - Tab management settings
 * 
 * @see background-service_breakdown.md for architecture details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Keepalive configuration for service worker
 * Prevents Chrome from terminating the service worker after 30s idle
 */
export interface KeepaliveConfig {
  /** Enable keepalive mechanism. Default: true */
  enabled: boolean;
  /** Alarm interval in minutes. Default: 0.5 (30 seconds) */
  intervalMinutes: number;
  /** Alarm name for chrome.alarms. Default: 'sw-keepalive' */
  alarmName: string;
  /** Use offscreen document for persistent keepalive. Default: false */
  useOffscreenDocument: boolean;
}

/**
 * Message handling configuration
 */
export interface MessageConfig {
  /** Default response timeout (ms). Default: 30000 */
  timeout: number;
  /** Enable message validation. Default: true */
  validateMessages: boolean;
  /** Log all messages (for debugging). Default: false */
  logMessages: boolean;
  /** Maximum message payload size (bytes). Default: 64MB */
  maxPayloadSize: number;
  /** Enable request ID tracking. Default: true */
  trackRequestIds: boolean;
}

/**
 * Retry configuration for failed operations
 */
export interface RetryConfig {
  /** Enable retry logic. Default: true */
  enabled: boolean;
  /** Maximum retry attempts. Default: 3 */
  maxAttempts: number;
  /** Base delay between retries (ms). Default: 1000 */
  baseDelay: number;
  /** Use exponential backoff. Default: true */
  exponentialBackoff: boolean;
  /** Maximum delay between retries (ms). Default: 10000 */
  maxDelay: number;
  /** Jitter factor (0-1) to randomize delays. Default: 0.1 */
  jitterFactor: number;
}

/**
 * Script injection configuration
 */
export interface InjectionConfig {
  /** Main content script path. Default: 'js/main.js' */
  mainScriptPath: string;
  /** Inject into all frames. Default: true */
  allFrames: boolean;
  /** Re-inject on navigation. Default: true */
  reinjectOnNavigation: boolean;
  /** Injection timeout (ms). Default: 5000 */
  timeout: number;
  /** Retry failed injections. Default: true */
  retryOnFailure: boolean;
  /** Max injection retries. Default: 2 */
  maxRetries: number;
  /** Delay before re-injection after navigation (ms). Default: 100 */
  navigationDelay: number;
  /** World to inject into. Default: 'ISOLATED' */
  world: 'MAIN' | 'ISOLATED';
}

/**
 * State persistence configuration
 */
export interface StateConfig {
  /** Enable state persistence. Default: true */
  enabled: boolean;
  /** Storage type. Default: 'local' */
  storageType: 'local' | 'session' | 'sync';
  /** Auto-restore on startup. Default: true */
  autoRestore: boolean;
  /** Debounce save operations (ms). Default: 500 */
  saveDebounce: number;
  /** State key prefix. Default: 'bg_' */
  keyPrefix: string;
  /** Request persistent storage quota. Default: true */
  requestPersistence: boolean;
}

/**
 * Tab management configuration
 */
export interface TabConfig {
  /** Maximum tracked tabs. Default: 50 */
  maxTrackedTabs: number;
  /** Auto-close orphaned tabs on shutdown. Default: false */
  autoCloseOnShutdown: boolean;
  /** Tab open timeout (ms). Default: 10000 */
  openTimeout: number;
  /** Cleanup stale tabs interval (ms). Default: 60000 */
  cleanupInterval: number;
  /** Make new tabs active. Default: true */
  makeActive: boolean;
  /** Default URL for new tabs. Default: 'about:blank' */
  defaultUrl: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Enable logging. Default: true */
  enabled: boolean;
  /** Log level. Default: 'info' */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Include timestamps. Default: true */
  timestamps: boolean;
  /** Log to console. Default: true */
  console: boolean;
  /** Buffer logs for export. Default: false */
  buffer: boolean;
  /** Max buffered logs. Default: 1000 */
  maxBuffered: number;
  /** Log prefix. Default: '[Background]' */
  prefix: string;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable telemetry. Default: false */
  enabled: boolean;
  /** Track message frequency. Default: false */
  trackMessageFrequency: boolean;
  /** Track message latency. Default: false */
  trackMessageLatency: boolean;
  /** Track injection failures. Default: true */
  trackInjectionFailures: boolean;
  /** Track tab lifecycle. Default: false */
  trackTabLifecycle: boolean;
  /** Metrics flush interval (ms). Default: 60000 */
  flushInterval: number;
}

/**
 * Complete background service configuration
 */
export interface BackgroundServiceConfig {
  /** Keepalive settings */
  keepalive: KeepaliveConfig;
  /** Message handling settings */
  message: MessageConfig;
  /** Retry settings */
  retry: RetryConfig;
  /** Injection settings */
  injection: InjectionConfig;
  /** State persistence settings */
  state: StateConfig;
  /** Tab management settings */
  tab: TabConfig;
  /** Logging settings */
  logging: LoggingConfig;
  /** Telemetry settings */
  telemetry: TelemetryConfig;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default keepalive configuration
 */
export const DEFAULT_KEEPALIVE_CONFIG: KeepaliveConfig = {
  enabled: true,
  intervalMinutes: 0.5, // 30 seconds - just under Chrome's termination threshold
  alarmName: 'sw-keepalive',
  useOffscreenDocument: false,
};

/**
 * Default message configuration
 */
export const DEFAULT_MESSAGE_CONFIG: MessageConfig = {
  timeout: 30000,
  validateMessages: true,
  logMessages: false,
  maxPayloadSize: 64 * 1024 * 1024, // 64MB Chrome limit
  trackRequestIds: true,
};

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  maxAttempts: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
  maxDelay: 10000,
  jitterFactor: 0.1,
};

/**
 * Default injection configuration
 */
export const DEFAULT_INJECTION_CONFIG: InjectionConfig = {
  mainScriptPath: 'js/main.js',
  allFrames: true,
  reinjectOnNavigation: true,
  timeout: 5000,
  retryOnFailure: true,
  maxRetries: 2,
  navigationDelay: 100,
  world: 'ISOLATED',
};

/**
 * Default state configuration
 */
export const DEFAULT_STATE_CONFIG: StateConfig = {
  enabled: true,
  storageType: 'local',
  autoRestore: true,
  saveDebounce: 500,
  keyPrefix: 'bg_',
  requestPersistence: true,
};

/**
 * Default tab configuration
 */
export const DEFAULT_TAB_CONFIG: TabConfig = {
  maxTrackedTabs: 50,
  autoCloseOnShutdown: false,
  openTimeout: 10000,
  cleanupInterval: 60000,
  makeActive: true,
  defaultUrl: 'about:blank',
};

/**
 * Default logging configuration
 */
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  enabled: true,
  level: 'info',
  timestamps: true,
  console: true,
  buffer: false,
  maxBuffered: 1000,
  prefix: '[Background]',
};

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: false,
  trackMessageFrequency: false,
  trackMessageLatency: false,
  trackInjectionFailures: true,
  trackTabLifecycle: false,
  flushInterval: 60000,
};

/**
 * Complete default configuration
 */
export const DEFAULT_BACKGROUND_CONFIG: BackgroundServiceConfig = {
  keepalive: DEFAULT_KEEPALIVE_CONFIG,
  message: DEFAULT_MESSAGE_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  injection: DEFAULT_INJECTION_CONFIG,
  state: DEFAULT_STATE_CONFIG,
  tab: DEFAULT_TAB_CONFIG,
  logging: DEFAULT_LOGGING_CONFIG,
  telemetry: DEFAULT_TELEMETRY_CONFIG,
};

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Development configuration with verbose logging
 */
export const DEVELOPMENT_CONFIG: Partial<BackgroundServiceConfig> = {
  logging: {
    ...DEFAULT_LOGGING_CONFIG,
    level: 'debug',
    buffer: true,
  },
  message: {
    ...DEFAULT_MESSAGE_CONFIG,
    logMessages: true,
  },
  telemetry: {
    ...DEFAULT_TELEMETRY_CONFIG,
    enabled: true,
    trackMessageFrequency: true,
    trackMessageLatency: true,
  },
};

/**
 * Production configuration with minimal logging
 */
export const PRODUCTION_CONFIG: Partial<BackgroundServiceConfig> = {
  logging: {
    ...DEFAULT_LOGGING_CONFIG,
    level: 'warn',
    buffer: false,
  },
  message: {
    ...DEFAULT_MESSAGE_CONFIG,
    logMessages: false,
  },
  telemetry: {
    ...DEFAULT_TELEMETRY_CONFIG,
    enabled: false,
  },
};

/**
 * Testing configuration with fast timeouts
 */
export const TESTING_CONFIG: Partial<BackgroundServiceConfig> = {
  keepalive: {
    ...DEFAULT_KEEPALIVE_CONFIG,
    enabled: false, // Disable in tests
  },
  message: {
    ...DEFAULT_MESSAGE_CONFIG,
    timeout: 5000, // Faster timeout for tests
  },
  retry: {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 1, // Fail fast in tests
    baseDelay: 100,
  },
  injection: {
    ...DEFAULT_INJECTION_CONFIG,
    timeout: 2000,
    maxRetries: 1,
  },
};

// ============================================================================
// BACKGROUND CONFIG CLASS
// ============================================================================

/**
 * BackgroundConfig - Manages background service configuration
 * 
 * @example
 * ```typescript
 * // Create with defaults
 * const config = new BackgroundConfig();
 * 
 * // Create with custom settings
 * const config = new BackgroundConfig({
 *   keepalive: { intervalMinutes: 1 },
 *   logging: { level: 'debug' },
 * });
 * 
 * // Apply preset
 * config.applyPreset('development');
 * 
 * // Get specific config
 * const retryConfig = config.getRetryConfig();
 * ```
 */
export class BackgroundConfig {
  private config: BackgroundServiceConfig;

  /**
   * Create a new BackgroundConfig
   * @param overrides - Configuration overrides
   */
  constructor(overrides?: Partial<BackgroundServiceConfig>) {
    this.config = this.mergeConfig(DEFAULT_BACKGROUND_CONFIG, overrides);
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  /**
   * Get complete configuration
   */
  public getConfig(): BackgroundServiceConfig {
    return { ...this.config };
  }

  /**
   * Get keepalive configuration
   */
  public getKeepaliveConfig(): KeepaliveConfig {
    return { ...this.config.keepalive };
  }

  /**
   * Get message configuration
   */
  public getMessageConfig(): MessageConfig {
    return { ...this.config.message };
  }

  /**
   * Get retry configuration
   */
  public getRetryConfig(): RetryConfig {
    return { ...this.config.retry };
  }

  /**
   * Get injection configuration
   */
  public getInjectionConfig(): InjectionConfig {
    return { ...this.config.injection };
  }

  /**
   * Get state configuration
   */
  public getStateConfig(): StateConfig {
    return { ...this.config.state };
  }

  /**
   * Get tab configuration
   */
  public getTabConfig(): TabConfig {
    return { ...this.config.tab };
  }

  /**
   * Get logging configuration
   */
  public getLoggingConfig(): LoggingConfig {
    return { ...this.config.logging };
  }

  /**
   * Get telemetry configuration
   */
  public getTelemetryConfig(): TelemetryConfig {
    return { ...this.config.telemetry };
  }

  // ==========================================================================
  // SETTERS
  // ==========================================================================

  /**
   * Update configuration
   * @param overrides - Configuration overrides
   */
  public update(overrides: Partial<BackgroundServiceConfig>): void {
    this.config = this.mergeConfig(this.config, overrides);
  }

  /**
   * Update keepalive configuration
   */
  public updateKeepalive(overrides: Partial<KeepaliveConfig>): void {
    this.config.keepalive = { ...this.config.keepalive, ...overrides };
  }

  /**
   * Update message configuration
   */
  public updateMessage(overrides: Partial<MessageConfig>): void {
    this.config.message = { ...this.config.message, ...overrides };
  }

  /**
   * Update retry configuration
   */
  public updateRetry(overrides: Partial<RetryConfig>): void {
    this.config.retry = { ...this.config.retry, ...overrides };
  }

  /**
   * Update injection configuration
   */
  public updateInjection(overrides: Partial<InjectionConfig>): void {
    this.config.injection = { ...this.config.injection, ...overrides };
  }

  /**
   * Update state configuration
   */
  public updateState(overrides: Partial<StateConfig>): void {
    this.config.state = { ...this.config.state, ...overrides };
  }

  /**
   * Update tab configuration
   */
  public updateTab(overrides: Partial<TabConfig>): void {
    this.config.tab = { ...this.config.tab, ...overrides };
  }

  /**
   * Update logging configuration
   */
  public updateLogging(overrides: Partial<LoggingConfig>): void {
    this.config.logging = { ...this.config.logging, ...overrides };
  }

  /**
   * Update telemetry configuration
   */
  public updateTelemetry(overrides: Partial<TelemetryConfig>): void {
    this.config.telemetry = { ...this.config.telemetry, ...overrides };
  }

  // ==========================================================================
  // PRESETS
  // ==========================================================================

  /**
   * Apply a preset configuration
   * @param preset - Preset name
   */
  public applyPreset(preset: 'development' | 'production' | 'testing'): void {
    switch (preset) {
      case 'development':
        this.update(DEVELOPMENT_CONFIG);
        break;
      case 'production':
        this.update(PRODUCTION_CONFIG);
        break;
      case 'testing':
        this.update(TESTING_CONFIG);
        break;
    }
  }

  /**
   * Reset to default configuration
   */
  public reset(): void {
    this.config = { ...DEFAULT_BACKGROUND_CONFIG };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Calculate retry delay with exponential backoff and jitter
   * @param attempt - Current attempt number (0-indexed)
   */
  public calculateRetryDelay(attempt: number): number {
    const { baseDelay, exponentialBackoff, maxDelay, jitterFactor } = this.config.retry;

    let delay = exponentialBackoff
      ? baseDelay * Math.pow(2, attempt)
      : baseDelay;

    // Apply max delay cap
    delay = Math.min(delay, maxDelay);

    // Apply jitter
    if (jitterFactor > 0) {
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
      delay = Math.max(0, delay + jitter);
    }

    return Math.round(delay);
  }

  /**
   * Check if should retry based on attempt count
   * @param attempt - Current attempt number (0-indexed)
   */
  public shouldRetry(attempt: number): boolean {
    return this.config.retry.enabled && attempt < this.config.retry.maxAttempts - 1;
  }

  /**
   * Check if logging is enabled at level
   * @param level - Log level to check
   */
  public isLogLevelEnabled(level: LoggingConfig['level']): boolean {
    if (!this.config.logging.enabled) return false;

    const levels: LoggingConfig['level'][] = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logging.level);
    const checkLevel = levels.indexOf(level);

    return checkLevel >= configLevel;
  }

  /**
   * Get state storage key with prefix
   * @param key - Base key name
   */
  public getStateKey(key: string): string {
    return `${this.config.state.keyPrefix}${key}`;
  }

  /**
   * Validate configuration
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Keepalive validation
    if (this.config.keepalive.intervalMinutes <= 0) {
      errors.push('keepalive.intervalMinutes must be positive');
    }

    // Message validation
    if (this.config.message.timeout <= 0) {
      errors.push('message.timeout must be positive');
    }
    if (this.config.message.maxPayloadSize <= 0) {
      errors.push('message.maxPayloadSize must be positive');
    }

    // Retry validation
    if (this.config.retry.maxAttempts < 1) {
      errors.push('retry.maxAttempts must be at least 1');
    }
    if (this.config.retry.baseDelay < 0) {
      errors.push('retry.baseDelay must be non-negative');
    }
    if (this.config.retry.jitterFactor < 0 || this.config.retry.jitterFactor > 1) {
      errors.push('retry.jitterFactor must be between 0 and 1');
    }

    // Injection validation
    if (!this.config.injection.mainScriptPath) {
      errors.push('injection.mainScriptPath is required');
    }

    // Tab validation
    if (this.config.tab.maxTrackedTabs < 1) {
      errors.push('tab.maxTrackedTabs must be at least 1');
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(
    base: BackgroundServiceConfig,
    overrides?: Partial<BackgroundServiceConfig>
  ): BackgroundServiceConfig {
    if (!overrides) return { ...base };

    return {
      keepalive: { ...base.keepalive, ...overrides.keepalive },
      message: { ...base.message, ...overrides.message },
      retry: { ...base.retry, ...overrides.retry },
      injection: { ...base.injection, ...overrides.injection },
      state: { ...base.state, ...overrides.state },
      tab: { ...base.tab, ...overrides.tab },
      logging: { ...base.logging, ...overrides.logging },
      telemetry: { ...base.telemetry, ...overrides.telemetry },
    };
  }

  /**
   * Export configuration as JSON
   */
  public toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public fromJSON(json: string): void {
    const parsed = JSON.parse(json);
    this.update(parsed);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a BackgroundConfig instance
 */
export function createBackgroundConfig(
  overrides?: Partial<BackgroundServiceConfig>
): BackgroundConfig {
  return new BackgroundConfig(overrides);
}

/**
 * Create a development BackgroundConfig
 */
export function createDevelopmentConfig(): BackgroundConfig {
  const config = new BackgroundConfig();
  config.applyPreset('development');
  return config;
}

/**
 * Create a production BackgroundConfig
 */
export function createProductionConfig(): BackgroundConfig {
  const config = new BackgroundConfig();
  config.applyPreset('production');
  return config;
}

/**
 * Create a testing BackgroundConfig
 */
export function createTestingConfig(): BackgroundConfig {
  const config = new BackgroundConfig();
  config.applyPreset('testing');
  return config;
}
