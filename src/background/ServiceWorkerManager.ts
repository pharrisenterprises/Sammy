/**
 * ServiceWorkerManager - Manifest V3 Service Worker Lifecycle Management
 * @module background/ServiceWorkerManager
 * @version 1.0.0
 * 
 * Manages the service worker lifecycle including:
 * - Keepalive mechanism using chrome.alarms (prevents 30s termination)
 * - Startup initialization and state restoration
 * - Shutdown cleanup and state persistence
 * - Health monitoring and heartbeat
 * - Extension lifecycle events (install, update)
 * 
 * @see background-service_breakdown.md for architecture details
 */

import type { 
  IBackgroundService, 
  IBackgroundState,
  LifecycleEvent, 
  LifecycleEventListener,
  InstallDetails,
} from './IBackgroundService';
import type { BackgroundConfig, KeepaliveConfig } from './BackgroundConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Service worker status
 */
export type ServiceWorkerStatus =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'suspended'
  | 'error'
  | 'shutdown';

/**
 * Startup result
 */
export interface StartupResult {
  /** Whether startup succeeded */
  success: boolean;
  /** Status after startup */
  status: ServiceWorkerStatus;
  /** Startup duration (ms) */
  duration: number;
  /** Whether state was restored */
  stateRestored: boolean;
  /** Whether persistent storage was granted */
  persistentStorage: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Service worker status */
  status: ServiceWorkerStatus;
  /** Whether keepalive is active */
  keepaliveActive: boolean;
  /** Time since last heartbeat (ms) */
  timeSinceHeartbeat: number;
  /** Memory usage (if available) */
  memoryUsage?: number;
  /** Uptime (ms) */
  uptime: number;
  /** Whether healthy */
  healthy: boolean;
}

/**
 * Service worker event types
 */
export type ServiceWorkerEventType =
  | 'startup_started'
  | 'startup_completed'
  | 'shutdown_started'
  | 'shutdown_completed'
  | 'keepalive_tick'
  | 'state_restored'
  | 'state_saved'
  | 'health_check'
  | 'error';

/**
 * Service worker event
 */
export interface ServiceWorkerEvent {
  type: ServiceWorkerEventType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Service worker event listener
 */
export type ServiceWorkerEventListener = (event: ServiceWorkerEvent) => void;

// ============================================================================
// CHROME API ABSTRACTION (for testing)
// ============================================================================

/**
 * Chrome alarms API interface
 */
export interface IChromeAlarms {
  create(name: string, alarmInfo: { periodInMinutes?: number; delayInMinutes?: number }): void;
  clear(name: string): Promise<boolean>;
  get(name: string): Promise<chrome.alarms.Alarm | undefined>;
  onAlarm: {
    addListener(callback: (alarm: chrome.alarms.Alarm) => void): void;
    removeListener(callback: (alarm: chrome.alarms.Alarm) => void): void;
  };
}

/**
 * Chrome runtime API interface
 */
export interface IChromeRuntime {
  onInstalled: {
    addListener(callback: (details: chrome.runtime.InstalledDetails) => void): void;
    removeListener(callback: (details: chrome.runtime.InstalledDetails) => void): void;
  };
  onStartup: {
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  };
  onSuspend: {
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  };
  getURL(path: string): string;
}

/**
 * Navigator storage API interface
 */
export interface INavigatorStorage {
  persist(): Promise<boolean>;
  persisted(): Promise<boolean>;
}

// ============================================================================
// SERVICE WORKER MANAGER CLASS
// ============================================================================

/**
 * ServiceWorkerManager - Manages service worker lifecycle
 * 
 * @example
 * ```typescript
 * const manager = new ServiceWorkerManager(config, stateManager);
 * 
 * // Initialize on startup
 * await manager.startup();
 * 
 * // Start keepalive for long operations
 * manager.startKeepalive();
 * 
 * // Check health
 * const health = manager.checkHealth();
 * console.log(`Healthy: ${health.healthy}, Uptime: ${health.uptime}ms`);
 * 
 * // Shutdown gracefully
 * await manager.shutdown();
 * ```
 */
export class ServiceWorkerManager {
  private config: BackgroundConfig;
  private stateManager: IBackgroundState | null;
  
  // Chrome API references (injectable for testing)
  private chromeAlarms: IChromeAlarms;
  private chromeRuntime: IChromeRuntime;
  private navigatorStorage: INavigatorStorage | null;

  // State
  private status: ServiceWorkerStatus = 'uninitialized';
  private startupTime: Date | null = null;
  private lastHeartbeat: Date | null = null;
  private keepaliveActive: boolean = false;

  // Event listeners
  private lifecycleListeners: Set<LifecycleEventListener> = new Set();
  private eventListeners: Set<ServiceWorkerEventListener> = new Set();

  // Alarm handler reference (for cleanup)
  private alarmHandler: ((alarm: chrome.alarms.Alarm) => void) | null = null;
  private installHandler: ((details: chrome.runtime.InstalledDetails) => void) | null = null;
  private startupHandler: (() => void) | null = null;
  private suspendHandler: (() => void) | null = null;

  /**
   * Create a new ServiceWorkerManager
   * 
   * @param config - Background configuration
   * @param stateManager - Optional state manager for persistence
   * @param chromeAlarms - Chrome alarms API (defaults to chrome.alarms)
   * @param chromeRuntime - Chrome runtime API (defaults to chrome.runtime)
   * @param navigatorStorage - Navigator storage API (defaults to navigator.storage)
   */
  constructor(
    config: BackgroundConfig,
    stateManager?: IBackgroundState,
    chromeAlarms?: IChromeAlarms,
    chromeRuntime?: IChromeRuntime,
    navigatorStorage?: INavigatorStorage | null
  ) {
    this.config = config;
    this.stateManager = stateManager ?? null;

    // Use provided APIs or defaults (in browser context)
    this.chromeAlarms = chromeAlarms ?? (typeof chrome !== 'undefined' ? chrome.alarms : this.createMockAlarms());
    this.chromeRuntime = chromeRuntime ?? (typeof chrome !== 'undefined' ? chrome.runtime : this.createMockRuntime());
    this.navigatorStorage = navigatorStorage ?? (typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null);
  }

  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================

  /**
   * Initialize the service worker
   */
  public async startup(): Promise<StartupResult> {
    const startTime = Date.now();
    
    this.status = 'initializing';
    this.startupTime = new Date();
    this.lastHeartbeat = new Date();

    this.emitEvent({
      type: 'startup_started',
      timestamp: new Date(),
    });

    let stateRestored = false;
    let persistentStorage = false;

    try {
      // Setup Chrome event listeners
      this.setupChromeListeners();

      // Restore state if configured
      if (this.config.getStateConfig().autoRestore && this.stateManager) {
        await this.stateManager.restore();
        stateRestored = true;
        this.emitEvent({
          type: 'state_restored',
          timestamp: new Date(),
        });
      }

      // Request persistent storage if configured
      if (this.config.getStateConfig().requestPersistence && this.navigatorStorage) {
        try {
          persistentStorage = await this.navigatorStorage.persist();
        } catch (e) {
          // Persist request failed - not critical
          console.warn('[ServiceWorkerManager] Persistent storage request failed:', e);
        }
      }

      // Start keepalive if configured
      if (this.config.getKeepaliveConfig().enabled) {
        await this.startKeepalive();
      }

      this.status = 'ready';

      const result: StartupResult = {
        success: true,
        status: this.status,
        duration: Date.now() - startTime,
        stateRestored,
        persistentStorage,
      };

      this.emitEvent({
        type: 'startup_completed',
        timestamp: new Date(),
        data: result,
      });

      return result;

    } catch (error) {
      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { error: errorMessage, phase: 'startup' },
      });

      return {
        success: false,
        status: this.status,
        duration: Date.now() - startTime,
        stateRestored,
        persistentStorage,
        error: errorMessage,
      };
    }
  }

  /**
   * Shutdown the service worker gracefully
   */
  public async shutdown(): Promise<void> {
    this.emitEvent({
      type: 'shutdown_started',
      timestamp: new Date(),
    });

    try {
      // Stop keepalive
      await this.stopKeepalive();

      // Save state if configured
      if (this.config.getStateConfig().enabled && this.stateManager) {
        // State manager should handle saving current state
        this.emitEvent({
          type: 'state_saved',
          timestamp: new Date(),
        });
      }

      // Remove Chrome listeners
      this.removeChromeListeners();

      this.status = 'shutdown';

      this.emitEvent({
        type: 'shutdown_completed',
        timestamp: new Date(),
      });

    } catch (error) {
      this.status = 'error';
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : String(error), phase: 'shutdown' },
      });
      throw error;
    }
  }

  // ==========================================================================
  // KEEPALIVE METHODS
  // ==========================================================================

  /**
   * Start the keepalive alarm
   * Prevents Chrome from terminating the service worker after 30s
   */
  public async startKeepalive(): Promise<void> {
    const keepaliveConfig = this.config.getKeepaliveConfig();
    
    if (!keepaliveConfig.enabled) {
      return;
    }

    // Create alarm
    this.chromeAlarms.create(keepaliveConfig.alarmName, {
      periodInMinutes: keepaliveConfig.intervalMinutes,
    });

    this.keepaliveActive = true;

    // Log for debugging
    if (this.config.getLoggingConfig().level === 'debug') {
      console.log(`[ServiceWorkerManager] Keepalive started: ${keepaliveConfig.alarmName} every ${keepaliveConfig.intervalMinutes} minutes`);
    }
  }

  /**
   * Stop the keepalive alarm
   */
  public async stopKeepalive(): Promise<void> {
    const keepaliveConfig = this.config.getKeepaliveConfig();

    try {
      await this.chromeAlarms.clear(keepaliveConfig.alarmName);
      this.keepaliveActive = false;

      if (this.config.getLoggingConfig().level === 'debug') {
        console.log(`[ServiceWorkerManager] Keepalive stopped: ${keepaliveConfig.alarmName}`);
      }
    } catch (e) {
      console.warn('[ServiceWorkerManager] Failed to clear keepalive alarm:', e);
    }
  }

  /**
   * Check if keepalive is active
   */
  public isKeepaliveActive(): boolean {
    return this.keepaliveActive;
  }

  /**
   * Handle keepalive alarm tick
   */
  private handleKeepaliveTick(): void {
    this.lastHeartbeat = new Date();

    this.emitEvent({
      type: 'keepalive_tick',
      timestamp: new Date(),
      data: { uptime: this.getUptime() },
    });

    // Log if debug
    if (this.config.getLoggingConfig().level === 'debug') {
      console.log(`[ServiceWorkerManager] Keepalive tick - uptime: ${this.getUptime()}ms`);
    }
  }

  // ==========================================================================
  // HEALTH MONITORING
  // ==========================================================================

  /**
   * Check service worker health
   */
  public checkHealth(): HealthCheckResult {
    const timeSinceHeartbeat = this.lastHeartbeat 
      ? Date.now() - this.lastHeartbeat.getTime()
      : Infinity;

    // Consider unhealthy if no heartbeat in 2x keepalive interval
    const keepaliveMs = this.config.getKeepaliveConfig().intervalMinutes * 60 * 1000;
    const heartbeatThreshold = keepaliveMs * 2;

    const result: HealthCheckResult = {
      status: this.status,
      keepaliveActive: this.keepaliveActive,
      timeSinceHeartbeat,
      uptime: this.getUptime(),
      healthy: this.status === 'ready' && 
               (!this.keepaliveActive || timeSinceHeartbeat < heartbeatThreshold),
    };

    // Try to get memory usage (Chrome-specific)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      result.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    this.emitEvent({
      type: 'health_check',
      timestamp: new Date(),
      data: result,
    });

    return result;
  }

  /**
   * Get uptime in milliseconds
   */
  public getUptime(): number {
    if (!this.startupTime) return 0;
    return Date.now() - this.startupTime.getTime();
  }

  /**
   * Get current status
   */
  public getStatus(): ServiceWorkerStatus {
    return this.status;
  }

  /**
   * Check if ready
   */
  public isReady(): boolean {
    return this.status === 'ready';
  }

  // ==========================================================================
  // CHROME EVENT HANDLERS
  // ==========================================================================

  /**
   * Setup Chrome event listeners
   */
  private setupChromeListeners(): void {
    // Alarm handler
    this.alarmHandler = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === this.config.getKeepaliveConfig().alarmName) {
        this.handleKeepaliveTick();
      }
    };
    this.chromeAlarms.onAlarm.addListener(this.alarmHandler);

    // Install handler
    this.installHandler = (details: chrome.runtime.InstalledDetails) => {
      this.handleInstalled(details);
    };
    this.chromeRuntime.onInstalled.addListener(this.installHandler);

    // Startup handler
    this.startupHandler = () => {
      this.handleChromeStartup();
    };
    this.chromeRuntime.onStartup.addListener(this.startupHandler);

    // Suspend handler (fired before service worker terminates)
    this.suspendHandler = () => {
      this.handleSuspend();
    };
    this.chromeRuntime.onSuspend.addListener(this.suspendHandler);
  }

  /**
   * Remove Chrome event listeners
   */
  private removeChromeListeners(): void {
    if (this.alarmHandler) {
      this.chromeAlarms.onAlarm.removeListener(this.alarmHandler);
      this.alarmHandler = null;
    }
    if (this.installHandler) {
      this.chromeRuntime.onInstalled.removeListener(this.installHandler);
      this.installHandler = null;
    }
    if (this.startupHandler) {
      this.chromeRuntime.onStartup.removeListener(this.startupHandler);
      this.startupHandler = null;
    }
    if (this.suspendHandler) {
      this.chromeRuntime.onSuspend.removeListener(this.suspendHandler);
      this.suspendHandler = null;
    }
  }

  /**
   * Handle extension installed/updated
   */
  private handleInstalled(details: chrome.runtime.InstalledDetails): void {
    let event: LifecycleEvent;
    const installDetails: InstallDetails = {
      reason: details.reason as InstallDetails['reason'],
      previousVersion: details.previousVersion,
    };

    switch (details.reason) {
      case 'install':
        event = 'installed';
        break;
      case 'update':
        event = 'updated';
        break;
      case 'chrome_update':
      case 'shared_module_update':
        event = 'updated';
        break;
      default:
        return;
    }

    this.emitLifecycleEvent(event, installDetails);
  }

  /**
   * Handle Chrome startup (browser opened)
   */
  private handleChromeStartup(): void {
    this.emitLifecycleEvent('startup');
  }

  /**
   * Handle service worker suspension
   */
  private handleSuspend(): void {
    this.status = 'suspended';
    this.emitLifecycleEvent('suspend');
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to lifecycle events
   */
  public onLifecycle(listener: LifecycleEventListener): () => void {
    this.lifecycleListeners.add(listener);
    return () => this.lifecycleListeners.delete(listener);
  }

  /**
   * Subscribe to service worker events
   */
  public onEvent(listener: ServiceWorkerEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit lifecycle event
   */
  private emitLifecycleEvent(event: LifecycleEvent, details?: InstallDetails): void {
    this.lifecycleListeners.forEach(listener => {
      try {
        listener(event, details);
      } catch (error) {
        console.error('[ServiceWorkerManager] Error in lifecycle listener:', error);
      }
    });
  }

  /**
   * Emit service worker event
   */
  private emitEvent(event: ServiceWorkerEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ServiceWorkerManager] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // MOCK APIS (for testing outside browser)
  // ==========================================================================

  /**
   * Create mock alarms API
   */
  private createMockAlarms(): IChromeAlarms {
    const listeners: Array<(alarm: chrome.alarms.Alarm) => void> = [];
    const alarms = new Map<string, chrome.alarms.Alarm>();

    return {
      create: (name, alarmInfo) => {
        alarms.set(name, {
          name,
          scheduledTime: Date.now() + (alarmInfo.delayInMinutes ?? alarmInfo.periodInMinutes ?? 1) * 60 * 1000,
          periodInMinutes: alarmInfo.periodInMinutes,
        });
      },
      clear: async (name) => {
        return alarms.delete(name);
      },
      get: async (name) => {
        return alarms.get(name);
      },
      onAlarm: {
        addListener: (callback) => {
          listeners.push(callback);
        },
        removeListener: (callback) => {
          const index = listeners.indexOf(callback);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
    };
  }

  /**
   * Create mock runtime API
   */
  private createMockRuntime(): IChromeRuntime {
    return {
      onInstalled: {
        addListener: () => {},
        removeListener: () => {},
      },
      onStartup: {
        addListener: () => {},
        removeListener: () => {},
      },
      onSuspend: {
        addListener: () => {},
        removeListener: () => {},
      },
      getURL: (path) => `chrome-extension://mock-id/${path}`,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ServiceWorkerManager instance
 */
export function createServiceWorkerManager(
  config: BackgroundConfig,
  stateManager?: IBackgroundState
): ServiceWorkerManager {
  return new ServiceWorkerManager(config, stateManager);
}
