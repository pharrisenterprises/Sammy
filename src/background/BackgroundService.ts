/**
 * BackgroundService - Main Background Service
 * @module background/BackgroundService
 * @version 1.0.0
 * 
 * Central coordinator for the extension background service worker.
 * Manages initialization, message routing, and lifecycle events.
 */

import { MessageRouter } from './MessageRouter';
import { TabManager } from './TabManager';
import { ScriptInjector } from './ScriptInjector';
import { registerAllHandlers } from './handlers/handlersP4';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Background service configuration
 */
export interface BackgroundServiceConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Keep alive interval (ms) */
  keepAliveInterval?: number;
  /** Enable persistent storage request */
  requestPersistentStorage?: boolean;
}

/**
 * Background service state
 */
export interface BackgroundServiceState {
  /** Is service initialized */
  initialized: boolean;
  /** Storage persistence granted */
  storagePersisted: boolean;
  /** Active recording project ID */
  activeRecordingProjectId: string | null;
  /** Is currently recording */
  isRecording: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: BackgroundServiceConfig = {
  debug: false,
  keepAliveInterval: 25000, // 25 seconds (before 30s timeout)
  requestPersistentStorage: true,
};

// ============================================================================
// BACKGROUND SERVICE CLASS
// ============================================================================

/**
 * Main background service class
 */
export class BackgroundService {
  private static instance: BackgroundService | null = null;
  
  private config: BackgroundServiceConfig;
  private state: BackgroundServiceState;
  private messageRouter: MessageRouter;
  private tabManager: TabManager;
  private scriptInjector: ScriptInjector;
  private keepAliveIntervalId: ReturnType<typeof setInterval> | null = null;

  private constructor(config: BackgroundServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      initialized: false,
      storagePersisted: false,
      activeRecordingProjectId: null,
      isRecording: false,
    };
    
    this.messageRouter = new MessageRouter();
    this.tabManager = new TabManager();
    this.scriptInjector = new ScriptInjector();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: BackgroundServiceConfig): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService(config);
    }
    return BackgroundService.instance;
  }

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    if (this.state.initialized) {
      this.log('Already initialized');
      return;
    }

    this.log('Initializing background service...');

    try {
      // Request persistent storage
      if (this.config.requestPersistentStorage) {
        await this.requestPersistentStorage();
      }

      // Register message handlers
      this.registerHandlers();

      // Set up event listeners
      this.setupEventListeners();

      // Start keep-alive (for service worker)
      this.startKeepAlive();

      this.state.initialized = true;
      this.log('Background service initialized');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
      throw error;
    }
  }

  /**
   * Request persistent storage
   */
  private async requestPersistentStorage(): Promise<void> {
    if (!('storage' in navigator) || !navigator.storage?.persist) {
      this.log('Persistent storage API not available');
      return;
    }

    try {
      const isPersisted = await navigator.storage.persisted();
      this.log(`Storage persisted: ${isPersisted}`);

      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        this.state.storagePersisted = granted;
        this.log(`Storage persistence granted: ${granted}`);
      } else {
        this.state.storagePersisted = true;
      }
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
    }
  }

  /**
   * Register all message handlers
   */
  private registerHandlers(): void {
    registerAllHandlers(
      this.messageRouter,
      this.tabManager,
      this.scriptInjector,
      this
    );
  }

  /**
   * Set up Chrome event listeners
   */
  private setupEventListeners(): void {
    // Message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.messageRouter.handleMessage(message, sender, sendResponse);
    });

    // Extension icon click
    chrome.action.onClicked.addListener(() => {
      this.openDashboard();
    });

    // Extension installed
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Tab removed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabManager.handleTabRemoved(tabId);
    });

    // Web navigation (for script re-injection)
    chrome.webNavigation.onCommitted.addListener((details) => {
      this.handleNavigation(details);
    });

    chrome.webNavigation.onCompleted.addListener((details) => {
      this.handleNavigationComplete(details);
    });
  }

  /**
   * Handle extension installation
   */
  private handleInstalled(details: chrome.runtime.InstalledDetails): void {
    this.log(`Extension ${details.reason}: ${details.previousVersion || 'new'}`);

    if (details.reason === 'install') {
      // Open dashboard on first install
      this.openDashboard();
    }
  }

  /**
   * Handle web navigation
   */
  private handleNavigation(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
    if (this.tabManager.isTracked(details.tabId)) {
      this.log(`Navigation in tracked tab ${details.tabId}: ${details.url}`);
      // Re-inject script after navigation
      this.scriptInjector.inject(details.tabId);
    }
  }

  /**
   * Handle navigation complete
   */
  private handleNavigationComplete(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    if (this.tabManager.isTracked(details.tabId) && details.frameId === 0) {
      this.log(`Page load complete in tracked tab ${details.tabId}`);
    }
  }

  /**
   * Open dashboard page
   */
  openDashboard(): void {
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages.html#/dashboard'),
    });
  }

  /**
   * Start keep-alive interval
   */
  private startKeepAlive(): void {
    if (this.keepAliveIntervalId) {
      clearInterval(this.keepAliveIntervalId);
    }

    this.keepAliveIntervalId = setInterval(() => {
      this.log('Keep-alive ping');
    }, this.config.keepAliveInterval);
  }

  /**
   * Stop keep-alive interval
   */
  stopKeepAlive(): void {
    if (this.keepAliveIntervalId) {
      clearInterval(this.keepAliveIntervalId);
      this.keepAliveIntervalId = null;
    }
  }

  /**
   * Set recording state
   */
  setRecordingState(isRecording: boolean, projectId: string | null = null): void {
    this.state.isRecording = isRecording;
    this.state.activeRecordingProjectId = projectId;
  }

  /**
   * Get current state
   */
  getState(): BackgroundServiceState {
    return { ...this.state };
  }

  /**
   * Get tab manager
   */
  getTabManager(): TabManager {
    return this.tabManager;
  }

  /**
   * Get script injector
   */
  getScriptInjector(): ScriptInjector {
    return this.scriptInjector;
  }

  /**
   * Log message (if debug enabled)
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[BackgroundService] ${message}`, ...args);
    }
  }
}

export default BackgroundService;
