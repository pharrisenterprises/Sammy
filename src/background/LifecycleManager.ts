/**
 * LifecycleManager - Extension lifecycle event handling
 * @module background/LifecycleManager
 * @version 1.0.0
 * 
 * Manages extension lifecycle:
 * - Installation (first install, update, chrome update)
 * - Browser startup
 * - Extension icon click
 * - Persistent storage grants
 * - Service worker suspend/resume
 * 
 * @see background-service_breakdown.md for lifecycle patterns
 */

import type { BackgroundConfig } from './BackgroundConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome runtime API interface (for testing)
 */
export interface IChromeRuntime {
  onInstalled: ChromeEvent<chrome.runtime.InstalledDetails>;
  onStartup: ChromeEvent<void>;
  onSuspend: ChromeEvent<void>;
  onSuspendCanceled: ChromeEvent<void>;
  getURL(path: string): string;
  getManifest(): chrome.runtime.Manifest;
}

/**
 * Chrome action API interface (for testing)
 */
export interface IChromeAction {
  onClicked: ChromeEvent<chrome.tabs.Tab>;
}

/**
 * Chrome tabs API interface (for testing)
 */
export interface IChromeTabs {
  create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab>;
}

/**
 * Navigator storage API interface (for testing)
 */
export interface INavigatorStorage {
  persist(): Promise<boolean>;
  persisted(): Promise<boolean>;
  estimate?(): Promise<StorageEstimate>;
}

/**
 * Chrome event interface
 */
interface ChromeEvent<T> {
  addListener(callback: T extends void ? () => void : (arg: T) => void): void;
  removeListener(callback: T extends void ? () => void : (arg: T) => void): void;
  hasListener(callback: T extends void ? () => void : (arg: T) => void): boolean;
}

/**
 * Lifecycle event types
 */
export type LifecycleEventType =
  | 'installed'
  | 'updated'
  | 'chrome_updated'
  | 'shared_module_updated'
  | 'startup'
  | 'suspend'
  | 'suspend_canceled'
  | 'icon_clicked'
  | 'storage_persisted'
  | 'storage_denied'
  | 'initialized'
  | 'shutdown';

/**
 * Lifecycle event
 */
export interface LifecycleEvent {
  type: LifecycleEventType;
  timestamp: Date;
  details?: {
    previousVersion?: string;
    reason?: string;
    tabId?: number;
    storagePersisted?: boolean;
    storageQuota?: number;
    storageUsage?: number;
  };
}

/**
 * Lifecycle event listener
 */
export type LifecycleEventListener = (event: LifecycleEvent) => void;

/**
 * Installation handler callback
 */
export type InstallHandler = (details: chrome.runtime.InstalledDetails) => Promise<void> | void;

/**
 * Startup handler callback
 */
export type StartupHandler = () => Promise<void> | void;

/**
 * Icon click handler callback
 */
export type IconClickHandler = (tab: chrome.tabs.Tab) => Promise<void> | void;

/**
 * Dashboard paths
 */
export const DASHBOARD_PATHS = {
  MAIN: 'pages.html',
  DASHBOARD: 'pages.html#dashboard',
  RECORDER: 'pages.html#recorder',
  RUNNER: 'pages.html#runner',
} as const;

// ============================================================================
// LIFECYCLE MANAGER CLASS
// ============================================================================

/**
 * LifecycleManager - Handles extension lifecycle events
 * 
 * @example
 * ```typescript
 * const manager = new LifecycleManager(config);
 * 
 * // Register custom handlers
 * manager.onInstall(async (details) => {
 *   if (details.reason === 'install') {
 *     await initializeDatabase();
 *   }
 * });
 * 
 * // Start listening
 * await manager.start();
 * 
 * // Get storage status
 * const status = await manager.getStorageStatus();
 * ```
 */
export class LifecycleManager {
  private config: BackgroundConfig;
  private chromeRuntime: IChromeRuntime | null;
  private chromeAction: IChromeAction | null;
  private chromeTabs: IChromeTabs | null;
  private navigatorStorage: INavigatorStorage | null;

  // Custom handlers
  private installHandlers: Set<InstallHandler> = new Set();
  private startupHandlers: Set<StartupHandler> = new Set();
  private iconClickHandlers: Set<IconClickHandler> = new Set();

  // Event listeners
  private eventListeners: Set<LifecycleEventListener> = new Set();

  // Bound listener references
  private boundOnInstalled: ((details: chrome.runtime.InstalledDetails) => void) | null = null;
  private boundOnStartup: (() => void) | null = null;
  private boundOnSuspend: (() => void) | null = null;
  private boundOnSuspendCanceled: (() => void) | null = null;
  private boundOnIconClicked: ((tab: chrome.tabs.Tab) => void) | null = null;

  // State
  private isListening: boolean = false;
  private isInitialized: boolean = false;
  private installReason: string | null = null;
  private previousVersion: string | null = null;
  private storagePersisted: boolean = false;

  // Statistics
  private stats = {
    installs: 0,
    updates: 0,
    startups: 0,
    suspends: 0,
    iconClicks: 0,
  };

  /**
   * Create LifecycleManager
   */
  constructor(
    config: BackgroundConfig,
    chromeRuntime?: IChromeRuntime | null,
    chromeAction?: IChromeAction | null,
    chromeTabs?: IChromeTabs | null,
    navigatorStorage?: INavigatorStorage | null
  ) {
    this.config = config;
    this.chromeRuntime = chromeRuntime ?? this.getDefaultChromeRuntime();
    this.chromeAction = chromeAction ?? this.getDefaultChromeAction();
    this.chromeTabs = chromeTabs ?? this.getDefaultChromeTabs();
    this.navigatorStorage = navigatorStorage ?? this.getDefaultNavigatorStorage();
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Start lifecycle management
   */
  public async start(): Promise<void> {
    if (this.isListening) {
      return;
    }

    // Setup listeners
    this.setupListeners();

    // Request persistent storage
    if (this.config.getStateConfig().requestPersistence) {
      await this.requestPersistentStorage();
    }

    this.isListening = true;
    this.isInitialized = true;

    this.emitEvent({
      type: 'initialized',
      timestamp: new Date(),
    });
  }

  /**
   * Stop lifecycle management
   */
  public stop(): void {
    if (!this.isListening) {
      return;
    }

    this.removeListeners();
    this.isListening = false;

    this.emitEvent({
      type: 'shutdown',
      timestamp: new Date(),
    });
  }

  /**
   * Check if listening
   */
  public isActive(): boolean {
    return this.isListening;
  }

  /**
   * Check if initialized
   */
  public hasInitialized(): boolean {
    return this.isInitialized;
  }

  // ==========================================================================
  // LISTENER SETUP
  // ==========================================================================

  /**
   * Setup all lifecycle listeners
   */
  private setupListeners(): void {
    // onInstalled
    if (this.chromeRuntime) {
      this.boundOnInstalled = this.handleInstalled.bind(this);
      this.chromeRuntime.onInstalled.addListener(this.boundOnInstalled);

      this.boundOnStartup = this.handleStartup.bind(this);
      this.chromeRuntime.onStartup.addListener(this.boundOnStartup);

      this.boundOnSuspend = this.handleSuspend.bind(this);
      this.chromeRuntime.onSuspend.addListener(this.boundOnSuspend);

      this.boundOnSuspendCanceled = this.handleSuspendCanceled.bind(this);
      this.chromeRuntime.onSuspendCanceled.addListener(this.boundOnSuspendCanceled);
    }

    // onClicked (extension icon)
    if (this.chromeAction) {
      this.boundOnIconClicked = this.handleIconClicked.bind(this);
      this.chromeAction.onClicked.addListener(this.boundOnIconClicked);
    }
  }

  /**
   * Remove all lifecycle listeners
   */
  private removeListeners(): void {
    if (this.chromeRuntime) {
      if (this.boundOnInstalled) {
        this.chromeRuntime.onInstalled.removeListener(this.boundOnInstalled);
      }
      if (this.boundOnStartup) {
        this.chromeRuntime.onStartup.removeListener(this.boundOnStartup);
      }
      if (this.boundOnSuspend) {
        this.chromeRuntime.onSuspend.removeListener(this.boundOnSuspend);
      }
      if (this.boundOnSuspendCanceled) {
        this.chromeRuntime.onSuspendCanceled.removeListener(this.boundOnSuspendCanceled);
      }
    }

    if (this.chromeAction && this.boundOnIconClicked) {
      this.chromeAction.onClicked.removeListener(this.boundOnIconClicked);
    }
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle onInstalled event
   */
  private handleInstalled(details: chrome.runtime.InstalledDetails): void {
    // Wrap async logic in immediately invoked function
    (async () => {
      this.installReason = details.reason;
      this.previousVersion = details.previousVersion ?? null;

      // Map reason to event type
      let eventType: LifecycleEventType;
      switch (details.reason) {
        case 'install':
          eventType = 'installed';
          this.stats.installs++;
          break;
        case 'update':
          eventType = 'updated';
          this.stats.updates++;
          break;
        case 'chrome_update':
          eventType = 'chrome_updated';
          break;
        case 'shared_module_update':
          eventType = 'shared_module_updated';
          break;
        default:
          eventType = 'installed';
      }

      this.emitEvent({
        type: eventType,
        timestamp: new Date(),
        details: {
          previousVersion: details.previousVersion,
          reason: details.reason,
        },
      });

      // Call custom handlers
      for (const handler of this.installHandlers) {
        try {
          await handler(details);
        } catch (error) {
          console.error('[LifecycleManager] Error in install handler:', error);
        }
      }

      // Open dashboard on first install
      if (details.reason === 'install') {
        await this.openDashboard(DASHBOARD_PATHS.DASHBOARD);
      }
    })();
  }

  /**
   * Handle onStartup event
   */
  private handleStartup(): void {
    // Wrap async logic in immediately invoked function
    (async () => {
      this.stats.startups++;

      this.emitEvent({
        type: 'startup',
        timestamp: new Date(),
      });

      // Call custom handlers
      for (const handler of this.startupHandlers) {
        try {
          await handler();
        } catch (error) {
          console.error('[LifecycleManager] Error in startup handler:', error);
        }
      }
    })();
  }

  /**
   * Handle onSuspend event
   */
  private handleSuspend(): void {
    this.stats.suspends++;

    this.emitEvent({
      type: 'suspend',
      timestamp: new Date(),
    });
  }

  /**
   * Handle onSuspendCanceled event
   */
  private handleSuspendCanceled(): void {
    this.emitEvent({
      type: 'suspend_canceled',
      timestamp: new Date(),
    });
  }

  /**
   * Handle icon clicked event
   */
  private handleIconClicked(tab: chrome.tabs.Tab): void {
    // Wrap async logic in immediately invoked function
    (async () => {
      this.stats.iconClicks++;

      this.emitEvent({
        type: 'icon_clicked',
        timestamp: new Date(),
        details: {
          tabId: tab.id,
        },
      });

      // Call custom handlers first
      for (const handler of this.iconClickHandlers) {
        try {
          await handler(tab);
        } catch (error) {
          console.error('[LifecycleManager] Error in icon click handler:', error);
        }
      }

      // Default behavior: open dashboard if no custom handlers prevented it
      if (this.iconClickHandlers.size === 0) {
        await this.openDashboard(DASHBOARD_PATHS.MAIN);
      }
    })();
  }

  // ==========================================================================
  // CUSTOM HANDLERS
  // ==========================================================================

  /**
   * Register install handler
   */
  public onInstall(handler: InstallHandler): () => void {
    this.installHandlers.add(handler);
    return () => this.installHandlers.delete(handler);
  }

  /**
   * Register startup handler
   */
  public onStartup(handler: StartupHandler): () => void {
    this.startupHandlers.add(handler);
    return () => this.startupHandlers.delete(handler);
  }

  /**
   * Register icon click handler
   */
  public onIconClick(handler: IconClickHandler): () => void {
    this.iconClickHandlers.add(handler);
    return () => this.iconClickHandlers.delete(handler);
  }

  // ==========================================================================
  // PERSISTENT STORAGE
  // ==========================================================================

  /**
   * Request persistent storage
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (!this.navigatorStorage) {
      console.warn('[LifecycleManager] Navigator storage API not available');
      return false;
    }

    try {
      // Check if already persisted
      const isPersisted = await this.navigatorStorage.persisted();
      
      if (isPersisted) {
        this.storagePersisted = true;
        this.emitEvent({
          type: 'storage_persisted',
          timestamp: new Date(),
          details: { storagePersisted: true },
        });
        return true;
      }

      // Request persistence
      const granted = await this.navigatorStorage.persist();
      this.storagePersisted = granted;

      this.emitEvent({
        type: granted ? 'storage_persisted' : 'storage_denied',
        timestamp: new Date(),
        details: { storagePersisted: granted },
      });

      return granted;

    } catch (error) {
      console.error('[LifecycleManager] Failed to request persistent storage:', error);
      return false;
    }
  }

  /**
   * Get storage status
   */
  public async getStorageStatus(): Promise<{
    persisted: boolean;
    quota?: number;
    usage?: number;
    percentUsed?: number;
  }> {
    if (!this.navigatorStorage) {
      return { persisted: false };
    }

    try {
      const persisted = await this.navigatorStorage.persisted();
      
      if (this.navigatorStorage.estimate) {
        const estimate = await this.navigatorStorage.estimate();
        return {
          persisted,
          quota: estimate.quota,
          usage: estimate.usage,
          percentUsed: estimate.quota && estimate.usage 
            ? Math.round((estimate.usage / estimate.quota) * 100)
            : undefined,
        };
      }

      return { persisted };

    } catch (error) {
      console.error('[LifecycleManager] Failed to get storage status:', error);
      return { persisted: false };
    }
  }

  /**
   * Check if storage is persisted
   */
  public isStoragePersisted(): boolean {
    return this.storagePersisted;
  }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Open dashboard page
   */
  public async openDashboard(path: string = DASHBOARD_PATHS.MAIN): Promise<number | undefined> {
    if (!this.chromeTabs || !this.chromeRuntime) {
      return undefined;
    }

    const dashboardUrl = this.chromeRuntime.getURL(path);

    try {
      // Check if dashboard is already open
      const existingTabs = await this.chromeTabs.query({ url: dashboardUrl + '*' });
      
      if (existingTabs.length > 0 && existingTabs[0].id) {
        // Focus existing tab
        await this.chromeTabs.update(existingTabs[0].id, { active: true });
        return existingTabs[0].id;
      }

      // Open new tab
      const tab = await this.chromeTabs.create({
        url: dashboardUrl,
        active: true,
      });

      return tab.id;

    } catch (error) {
      console.error('[LifecycleManager] Failed to open dashboard:', error);
      return undefined;
    }
  }

  /**
   * Get extension URL
   */
  public getExtensionURL(path: string): string {
    if (!this.chromeRuntime) {
      return path;
    }
    return this.chromeRuntime.getURL(path);
  }

  /**
   * Get manifest
   */
  public getManifest(): chrome.runtime.Manifest | null {
    if (!this.chromeRuntime) {
      return null;
    }
    return this.chromeRuntime.getManifest();
  }

  /**
   * Get extension version
   */
  public getVersion(): string | null {
    const manifest = this.getManifest();
    return manifest?.version ?? null;
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get install reason
   */
  public getInstallReason(): string | null {
    return this.installReason;
  }

  /**
   * Get previous version (after update)
   */
  public getPreviousVersion(): string | null {
    return this.previousVersion;
  }

  /**
   * Check if this is a fresh install
   */
  public isFreshInstall(): boolean {
    return this.installReason === 'install';
  }

  /**
   * Check if this is an update
   */
  public isUpdate(): boolean {
    return this.installReason === 'update';
  }

  /**
   * Get statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      installs: 0,
      updates: 0,
      startups: 0,
      suspends: 0,
      iconClicks: 0,
    };
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to lifecycle events
   */
  public onEvent(listener: LifecycleEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: LifecycleEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[LifecycleManager] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // DEFAULT APIS
  // ==========================================================================

  private getDefaultChromeRuntime(): IChromeRuntime | null {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return {
        onInstalled: chrome.runtime.onInstalled,
        onStartup: chrome.runtime.onStartup,
        onSuspend: chrome.runtime.onSuspend,
        onSuspendCanceled: chrome.runtime.onSuspendCanceled,
        getURL: (path) => chrome.runtime.getURL(path),
        getManifest: () => chrome.runtime.getManifest(),
      };
    }
    return null;
  }

  private getDefaultChromeAction(): IChromeAction | null {
    if (typeof chrome !== 'undefined' && chrome.action) {
      return {
        onClicked: chrome.action.onClicked,
      };
    }
    return null;
  }

  private getDefaultChromeTabs(): IChromeTabs | null {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      return {
        create: (props) => chrome.tabs.create(props),
        query: (queryInfo) => chrome.tabs.query(queryInfo),
        update: (tabId, props) => chrome.tabs.update(tabId, props),
      };
    }
    return null;
  }

  private getDefaultNavigatorStorage(): INavigatorStorage | null {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      return {
        persist: () => navigator.storage.persist(),
        persisted: () => navigator.storage.persisted(),
        estimate: navigator.storage.estimate 
          ? () => navigator.storage.estimate()
          : undefined,
      };
    }
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create LifecycleManager instance
 */
export function createLifecycleManager(
  config: BackgroundConfig,
  chromeRuntime?: IChromeRuntime | null,
  chromeAction?: IChromeAction | null,
  chromeTabs?: IChromeTabs | null,
  navigatorStorage?: INavigatorStorage | null
): LifecycleManager {
  return new LifecycleManager(config, chromeRuntime, chromeAction, chromeTabs, navigatorStorage);
}
