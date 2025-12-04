/**
 * BackgroundEntry - Main entry point for background service worker
 * @module background/BackgroundEntry
 * @version 1.0.0
 * 
 * Bootstraps and initializes all background service components:
 * - Creates configuration
 * - Instantiates all managers and handlers
 * - Wires dependencies via ServiceCoordinator
 * - Starts the service
 * 
 * This file is the entry point for vite.config.bg.ts
 * 
 * @see background-service_breakdown.md for architecture
 */

import { BackgroundConfig, createBackgroundConfig } from './BackgroundConfig';
import { ServiceCoordinator, createServiceCoordinator } from './ServiceCoordinator';
import { MessageReceiver, createMessageReceiver } from './MessageReceiver';
import { BackgroundState, createBackgroundState } from './BackgroundState';
import { NavigationManager, createNavigationManager } from './NavigationManager';
import { LifecycleManager, createLifecycleManager } from './LifecycleManager';

// Import handlers (these will be created in subsequent prompts)
// import { createProjectHandlers } from './handlers/ProjectHandlers';
// import { createTestRunHandlers } from './handlers/TestRunHandlers';
// import { createRecordingHandlers } from './handlers/RecordingHandlers';
// import { createReplayHandlers } from './handlers/ReplayHandlers';
// import { createStorageHandlers } from './handlers/StorageHandlers';
// import { createInjectionHandlers } from './handlers/InjectionHandlers';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  success: boolean;
  coordinator: ServiceCoordinator | null;
  errors: string[];
  duration: number;
}

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  autoStart: boolean;
  requestPersistence: boolean;
  openDashboardOnInstall: boolean;
  debug: boolean;
}

/**
 * Default bootstrap config
 */
export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapConfig = {
  autoStart: true,
  requestPersistence: true,
  openDashboardOnInstall: true,
  debug: false,
};

/**
 * Chrome API interfaces for testing
 */
export interface IChromeAPIs {
  runtime: typeof chrome.runtime;
  tabs: typeof chrome.tabs;
  scripting: typeof chrome.scripting;
  webNavigation: typeof chrome.webNavigation;
  action: typeof chrome.action;
  storage: typeof chrome.storage;
}

// ============================================================================
// PERSISTENT STORAGE
// ============================================================================

/**
 * Request persistent storage from browser
 * Prevents quota eviction for IndexedDB data
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) {
      console.log('[BackgroundEntry] navigator.storage not available');
      return false;
    }

    const isPersisted = await navigator.storage.persisted();
    console.log('[BackgroundEntry] Storage persisted?', isPersisted);

    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log('[BackgroundEntry] Persistence granted:', granted);
      return granted;
    }

    return true;
  } catch (error) {
    console.error('[BackgroundEntry] Failed to request persistent storage:', error);
    return false;
  }
}

// ============================================================================
// BOOTSTRAP CLASS
// ============================================================================

/**
 * BackgroundBootstrap - Bootstraps the background service
 * 
 * @example
 * ```typescript
 * // Standard bootstrap (auto-starts)
 * const result = await BackgroundBootstrap.bootstrap();
 * 
 * // Access coordinator
 * const coordinator = BackgroundBootstrap.getCoordinator();
 * ```
 */
export class BackgroundBootstrap {
  private static instance: BackgroundBootstrap | null = null;
  private static coordinator: ServiceCoordinator | null = null;
  private static isBootstrapped: boolean = false;

  // Components
  private config: BackgroundConfig;
  private bootstrapConfig: BootstrapConfig;
  private messageReceiver: MessageReceiver | null = null;
  private stateManager: BackgroundState | null = null;
  private navigationManager: NavigationManager | null = null;
  private lifecycleManager: LifecycleManager | null = null;
  private serviceCoordinator: ServiceCoordinator | null = null;

  // Chrome APIs (injectable for testing)
  private chromeAPIs: Partial<IChromeAPIs>;

  /**
   * Create bootstrap instance
   */
  constructor(
    bootstrapConfig: Partial<BootstrapConfig> = {},
    chromeAPIs?: Partial<IChromeAPIs>
  ) {
    this.bootstrapConfig = { ...DEFAULT_BOOTSTRAP_CONFIG, ...bootstrapConfig };
    this.config = createBackgroundConfig();
    this.chromeAPIs = chromeAPIs ?? this.getDefaultChromeAPIs();
  }

  /**
   * Bootstrap the background service (static entry point)
   */
  public static async bootstrap(
    config?: Partial<BootstrapConfig>
  ): Promise<BootstrapResult> {
    if (BackgroundBootstrap.isBootstrapped) {
      return {
        success: true,
        coordinator: BackgroundBootstrap.coordinator,
        errors: [],
        duration: 0,
      };
    }

    const bootstrap = new BackgroundBootstrap(config);
    return bootstrap.run();
  }

  /**
   * Get the service coordinator
   */
  public static getCoordinator(): ServiceCoordinator | null {
    return BackgroundBootstrap.coordinator;
  }

  /**
   * Check if bootstrapped
   */
  public static isInitialized(): boolean {
    return BackgroundBootstrap.isBootstrapped;
  }

  /**
   * Reset bootstrap (for testing)
   */
  public static async reset(): Promise<void> {
    if (BackgroundBootstrap.coordinator) {
      await BackgroundBootstrap.coordinator.stop();
    }
    BackgroundBootstrap.coordinator = null;
    BackgroundBootstrap.isBootstrapped = false;
    BackgroundBootstrap.instance = null;
  }

  /**
   * Run bootstrap sequence
   */
  public async run(): Promise<BootstrapResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Step 1: Request persistent storage
      if (this.bootstrapConfig.requestPersistence) {
        await ensurePersistentStorage();
      }

      // Step 2: Create components
      this.createComponents();

      // Step 3: Create coordinator
      this.createCoordinator();

      // Step 4: Register handlers
      this.registerHandlers();

      // Step 5: Setup lifecycle callbacks
      this.setupLifecycleCallbacks();

      // Step 6: Initialize coordinator
      const initResult = await this.serviceCoordinator!.initialize();
      if (!initResult.success) {
        errors.push(...initResult.errors);
      }

      // Step 7: Start if configured
      if (this.bootstrapConfig.autoStart) {
        await this.serviceCoordinator!.start();
      }

      // Store static references
      BackgroundBootstrap.coordinator = this.serviceCoordinator;
      BackgroundBootstrap.isBootstrapped = true;
      BackgroundBootstrap.instance = this;

      if (this.bootstrapConfig.debug) {
        console.log('[BackgroundEntry] Bootstrap complete in', Date.now() - startTime, 'ms');
      }

      return {
        success: errors.length === 0,
        coordinator: this.serviceCoordinator,
        errors,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      console.error('[BackgroundEntry] Bootstrap failed:', error);

      return {
        success: false,
        coordinator: null,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // COMPONENT CREATION
  // ==========================================================================

  /**
   * Create all components
   */
  private createComponents(): void {
    // Message receiver
    this.messageReceiver = createMessageReceiver(this.config);

    // State manager (pass chrome storage if available)
    this.stateManager = this.chromeAPIs.storage 
      ? createBackgroundState(this.config, this.chromeAPIs.storage)
      : createBackgroundState(this.config);

    // Navigation manager
    this.navigationManager = createNavigationManager(this.config);

    // Lifecycle manager
    this.lifecycleManager = createLifecycleManager(this.config);

    if (this.bootstrapConfig.debug) {
      console.log('[BackgroundEntry] Components created');
    }
  }

  /**
   * Create service coordinator
   */
  private createCoordinator(): void {
    this.serviceCoordinator = createServiceCoordinator(
      this.config,
      {
        messageReceiver: this.messageReceiver!,
        stateManager: this.stateManager!,
        lifecycleManager: this.lifecycleManager!,
        navigationManager: this.navigationManager!,
      },
      {
        autoStart: false, // We control startup
        restoreStateOnStart: true,
        saveStateOnStop: true,
      }
    );

    if (this.bootstrapConfig.debug) {
      console.log('[BackgroundEntry] Coordinator created');
    }
  }

  /**
   * Register all message handlers
   */
  private registerHandlers(): void {
    if (!this.messageReceiver) return;

    // Register handler registries here
    // These would be imported and registered when available:
    // this.serviceCoordinator!.registerHandlers(createProjectHandlers(storage));
    // this.serviceCoordinator!.registerHandlers(createTestRunHandlers(storage));
    // this.serviceCoordinator!.registerHandlers(createRecordingHandlers());
    // this.serviceCoordinator!.registerHandlers(createReplayHandlers());
    // this.serviceCoordinator!.registerHandlers(createStorageHandlers());
    // this.serviceCoordinator!.registerHandlers(createInjectionHandlers());

    if (this.bootstrapConfig.debug) {
      console.log('[BackgroundEntry] Handlers registered');
    }
  }

  /**
   * Setup lifecycle callbacks
   */
  private setupLifecycleCallbacks(): void {
    if (!this.lifecycleManager) return;

    // Open dashboard on fresh install
    if (this.bootstrapConfig.openDashboardOnInstall) {
      this.lifecycleManager.onInstall((details) => {
        if (this.lifecycleManager?.isFreshInstall()) {
          this.openDashboard();
        }
      });
    }

    // Setup extension icon click
    this.setupActionClickHandler();

    if (this.bootstrapConfig.debug) {
      console.log('[BackgroundEntry] Lifecycle callbacks setup');
    }
  }

  /**
   * Setup extension icon click handler
   */
  private setupActionClickHandler(): void {
    if (this.chromeAPIs.action?.onClicked) {
      this.chromeAPIs.action.onClicked.addListener(() => {
        this.openDashboard();
      });
    }
  }

  /**
   * Open dashboard page
   */
  private openDashboard(): void {
    if (this.chromeAPIs.tabs?.create && this.chromeAPIs.runtime?.getURL) {
      const dashboardUrl = this.chromeAPIs.runtime.getURL('pages.html#/dashboard');
      this.chromeAPIs.tabs.create({ url: dashboardUrl });
    }
  }

  // ==========================================================================
  // ACCESSORS
  // ==========================================================================

  /**
   * Get config
   */
  public getConfig(): BackgroundConfig {
    return this.config;
  }

  /**
   * Get message receiver
   */
  public getMessageReceiver(): MessageReceiver | null {
    return this.messageReceiver;
  }

  /**
   * Get state manager
   */
  public getStateManager(): BackgroundState | null {
    return this.stateManager;
  }

  /**
   * Get navigation manager
   */
  public getNavigationManager(): NavigationManager | null {
    return this.navigationManager;
  }

  /**
   * Get lifecycle manager
   */
  public getLifecycleManager(): LifecycleManager | null {
    return this.lifecycleManager;
  }

  /**
   * Get coordinator
   */
  public getCoordinator(): ServiceCoordinator | null {
    return this.serviceCoordinator;
  }

  // ==========================================================================
  // DEFAULT CHROME APIS
  // ==========================================================================

  private getDefaultChromeAPIs(): Partial<IChromeAPIs> {
    if (typeof chrome === 'undefined') {
      return {};
    }

    return {
      runtime: chrome.runtime,
      tabs: chrome.tabs,
      scripting: chrome.scripting,
      webNavigation: chrome.webNavigation,
      action: chrome.action,
      storage: chrome.storage,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Bootstrap the background service
 */
export async function bootstrapBackground(
  config?: Partial<BootstrapConfig>
): Promise<BootstrapResult> {
  return BackgroundBootstrap.bootstrap(config);
}

/**
 * Get the service coordinator
 */
export function getBackgroundCoordinator(): ServiceCoordinator | null {
  return BackgroundBootstrap.getCoordinator();
}

/**
 * Check if background is initialized
 */
export function isBackgroundInitialized(): boolean {
  return BackgroundBootstrap.isInitialized();
}

// ============================================================================
// AUTO-BOOTSTRAP (when loaded as service worker entry point)
// ============================================================================

/**
 * Auto-bootstrap when this module is loaded as the service worker entry point.
 * This is detected by checking if we're in a service worker context.
 */
function autoBootstrap(): void {
  // Check if we're in a service worker context
  const isServiceWorker = typeof self !== 'undefined' && 
    typeof ServiceWorkerGlobalScope !== 'undefined' &&
    self instanceof ServiceWorkerGlobalScope;

  // Also bootstrap if we detect Chrome extension context
  const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime?.id;

  if (isServiceWorker || isChromeExtension) {
    // Don't await - let it run async
    bootstrapBackground({
      autoStart: true,
      requestPersistence: true,
      openDashboardOnInstall: true,
      debug: false,
    }).then((result) => {
      if (result.success) {
        console.log('[BackgroundEntry] Auto-bootstrap successful');
      } else {
        console.error('[BackgroundEntry] Auto-bootstrap failed:', result.errors);
      }
    }).catch((error) => {
      console.error('[BackgroundEntry] Auto-bootstrap error:', error);
    });
  }
}

// Run auto-bootstrap
autoBootstrap();
