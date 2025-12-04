/**
 * TabHandlers - Message handlers for Tab management operations
 * @module background/handlers/TabHandlers
 * @version 1.0.0
 * 
 * Handles tab-related messages from extension pages:
 * - openTab: Open new tab and inject content script
 * - close_opened_tab: Close the last opened tab
 * - closeTab: Close specific tab by ID
 * - open_project_url_and_inject: Open project URL with injection
 * - openDashBoard: Open extension dashboard
 * - getTabStatus: Get status of tracked tabs
 * - sendToTab: Send message to specific tab
 * 
 * @see background-service_breakdown.md for tab management patterns
 */

import type {
  BackgroundMessage,
  BackgroundResponse,
  MessageSender,
  MessageHandler,
  ActionCategory,
  ITabManager,
  TabOpenOptions,
  InjectionOptions,
} from '../IBackgroundService';
import type { MessageReceiver } from '../MessageReceiver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome tabs API interface (for testing)
 */
export interface IChromeTabs {
  create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
  remove(tabId: number): Promise<void>;
  get(tabId: number): Promise<chrome.tabs.Tab>;
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  sendMessage(tabId: number, message: unknown): Promise<unknown>;
  update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab>;
}

/**
 * Chrome scripting API interface (for testing)
 */
export interface IChromeScripting {
  executeScript(injection: chrome.scripting.ScriptInjection): Promise<chrome.scripting.InjectionResult[]>;
}

/**
 * Chrome runtime API interface (for testing)
 */
export interface IChromeRuntime {
  getURL(path: string): string;
  lastError?: { message?: string };
}

/**
 * Open tab payload
 */
export interface OpenTabPayload {
  url: string;
  active?: boolean;
  projectId?: number;
  inject?: boolean;
}

/**
 * Close tab payload
 */
export interface CloseTabPayload {
  tabId?: number;
}

/**
 * Open project URL payload
 */
export interface OpenProjectUrlPayload {
  url: string;
  projectId: number;
}

/**
 * Send to tab payload
 */
export interface SendToTabPayload {
  tabId: number;
  message: unknown;
}

/**
 * Tab action names
 */
export const TAB_ACTIONS = {
  OPEN_TAB: 'openTab',
  CLOSE_OPENED_TAB: 'close_opened_tab',
  CLOSE_TAB: 'closeTab',
  OPEN_PROJECT_URL_AND_INJECT: 'open_project_url_and_inject',
  OPEN_DASHBOARD: 'openDashBoard',
  GET_TAB_STATUS: 'getTabStatus',
  GET_TRACKED_TABS: 'getTrackedTabs',
  SEND_TO_TAB: 'sendToTab',
  INJECT_INTO_TAB: 'injectIntoTab',
} as const;

/**
 * Default content script path
 */
export const DEFAULT_SCRIPT_PATH = 'js/main.js';

/**
 * Dashboard page path
 */
export const DASHBOARD_PATH = 'pages.html';

// ============================================================================
// TAB HANDLERS CLASS
// ============================================================================

/**
 * TabHandlers - Handles tab management messages
 * 
 * @example
 * ```typescript
 * const handlers = new TabHandlers(chromeTabs, chromeScripting, chromeRuntime);
 * 
 * // Register with message receiver
 * handlers.registerAll(receiver);
 * ```
 */
export class TabHandlers {
  private chromeTabs: IChromeTabs;
  private chromeScripting: IChromeScripting;
  private chromeRuntime: IChromeRuntime;

  // Tab tracking state
  private openedTabId: number | null = null;
  private trackedTabs: Map<number, { projectId?: number; injected: boolean; url: string }> = new Map();

  // Script path
  private scriptPath: string;

  /**
   * Create TabHandlers
   */
  constructor(
    chromeTabs?: IChromeTabs,
    chromeScripting?: IChromeScripting,
    chromeRuntime?: IChromeRuntime,
    scriptPath: string = DEFAULT_SCRIPT_PATH
  ) {
    // Use provided APIs or defaults (in browser context)
    this.chromeTabs = chromeTabs ?? this.getDefaultChromeTabs();
    this.chromeScripting = chromeScripting ?? this.getDefaultChromeScripting();
    this.chromeRuntime = chromeRuntime ?? this.getDefaultChromeRuntime();
    this.scriptPath = scriptPath;
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all tab handlers with a MessageReceiver
   */
  public registerAll(receiver: MessageReceiver): void {
    receiver.register(
      TAB_ACTIONS.OPEN_TAB,
      this.handleOpenTab.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.CLOSE_OPENED_TAB,
      this.handleCloseOpenedTab.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.CLOSE_TAB,
      this.handleCloseTab.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.OPEN_PROJECT_URL_AND_INJECT,
      this.handleOpenProjectUrlAndInject.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.OPEN_DASHBOARD,
      this.handleOpenDashboard.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.GET_TAB_STATUS,
      this.handleGetTabStatus.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.GET_TRACKED_TABS,
      this.handleGetTrackedTabs.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.SEND_TO_TAB,
      this.handleSendToTab.bind(this),
      'tab'
    );
    
    receiver.register(
      TAB_ACTIONS.INJECT_INTO_TAB,
      this.handleInjectIntoTab.bind(this),
      'tab'
    );
  }

  /**
   * Get all handler entries for manual registration
   */
  public getHandlerEntries(): Array<{
    action: string;
    handler: MessageHandler;
    category: ActionCategory;
  }> {
    return [
      { action: TAB_ACTIONS.OPEN_TAB, handler: this.handleOpenTab.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.CLOSE_OPENED_TAB, handler: this.handleCloseOpenedTab.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.CLOSE_TAB, handler: this.handleCloseTab.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.OPEN_PROJECT_URL_AND_INJECT, handler: this.handleOpenProjectUrlAndInject.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.OPEN_DASHBOARD, handler: this.handleOpenDashboard.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.GET_TAB_STATUS, handler: this.handleGetTabStatus.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.GET_TRACKED_TABS, handler: this.handleGetTrackedTabs.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.SEND_TO_TAB, handler: this.handleSendToTab.bind(this), category: 'tab' },
      { action: TAB_ACTIONS.INJECT_INTO_TAB, handler: this.handleInjectIntoTab.bind(this), category: 'tab' },
    ];
  }

  // ==========================================================================
  // HANDLER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Handle openTab action
   * Opens a new tab and optionally injects content script
   */
  public async handleOpenTab(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      // Support both payload.url and message.url (legacy)
      const payload = message.payload as OpenTabPayload | undefined;
      const url = payload?.url ?? (message as any).url;

      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      // Create tab
      const tab = await this.chromeTabs.create({
        url,
        active: payload?.active ?? true,
      });

      if (!tab.id) {
        return { success: false, error: 'No tab ID returned' };
      }

      const tabId = tab.id;

      // Inject content script if requested (default: true)
      const shouldInject = payload?.inject !== false;
      let injected = false;

      if (shouldInject) {
        try {
          await this.injectScript(tabId);
          injected = true;
        } catch (error) {
          // Log but don't fail - injection may succeed after page loads
          console.warn('[TabHandlers] Initial injection failed, will retry:', error);
        }
      }

      // Track tab
      this.openedTabId = tabId;
      this.trackedTabs.set(tabId, {
        projectId: payload?.projectId,
        injected,
        url,
      });

      return { success: true, tabId };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open tab',
      };
    }
  }

  /**
   * Handle close_opened_tab action
   * Closes the last opened tab
   */
  public async handleCloseOpenedTab(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (this.openedTabId === null) {
        return { success: false, error: 'No opened tab to close' };
      }

      const tabId = this.openedTabId;
      
      await this.chromeTabs.remove(tabId);
      
      // Clean up tracking
      this.trackedTabs.delete(tabId);
      this.openedTabId = null;

      return { success: true };

    } catch (error) {
      // Tab may already be closed
      this.openedTabId = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close tab',
      };
    }
  }

  /**
   * Handle closeTab action
   * Closes a specific tab by ID
   */
  public async handleCloseTab(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as CloseTabPayload;
      const tabId = payload?.tabId;

      if (!tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      await this.chromeTabs.remove(tabId);
      
      // Clean up tracking
      this.trackedTabs.delete(tabId);
      if (this.openedTabId === tabId) {
        this.openedTabId = null;
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close tab',
      };
    }
  }

  /**
   * Handle open_project_url_and_inject action
   * Opens project URL and injects content script
   */
  public async handleOpenProjectUrlAndInject(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as OpenProjectUrlPayload;

      if (!payload?.url) {
        return { success: false, error: 'URL is required' };
      }
      if (!payload?.projectId) {
        return { success: false, error: 'Project ID is required' };
      }

      // Create tab
      const tab = await this.chromeTabs.create({
        url: payload.url,
        active: true,
      });

      if (!tab.id) {
        return { success: false, error: 'No tab ID returned' };
      }

      const tabId = tab.id;

      // Inject content script
      let injected = false;
      try {
        await this.injectScript(tabId);
        injected = true;
      } catch (error) {
        console.warn('[TabHandlers] Initial injection failed:', error);
      }

      // Track tab with project association
      this.openedTabId = tabId;
      this.trackedTabs.set(tabId, {
        projectId: payload.projectId,
        injected,
        url: payload.url,
      });

      return { success: true, tabId };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open project URL',
      };
    }
  }

  /**
   * Handle openDashBoard action
   * Opens the extension dashboard page
   */
  public async handleOpenDashboard(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const dashboardUrl = this.chromeRuntime.getURL(DASHBOARD_PATH);

      // Check if dashboard is already open
      const existingTabs = await this.chromeTabs.query({ url: dashboardUrl + '*' });
      
      if (existingTabs.length > 0 && existingTabs[0].id) {
        // Focus existing tab
        await this.chromeTabs.update(existingTabs[0].id, { active: true });
        return { success: true, tabId: existingTabs[0].id };
      }

      // Open new dashboard tab
      const tab = await this.chromeTabs.create({
        url: dashboardUrl,
        active: true,
      });

      return { success: true, tabId: tab.id };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open dashboard',
      };
    }
  }

  /**
   * Handle getTabStatus action
   * Returns status of a specific tab or all tracked tabs
   */
  public async handleGetTabStatus(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { tabId?: number };

      if (payload?.tabId) {
        // Get specific tab status
        const tracked = this.trackedTabs.get(payload.tabId);
        
        if (!tracked) {
          return { success: false, error: `Tab ${payload.tabId} is not tracked` };
        }

        try {
          const tab = await this.chromeTabs.get(payload.tabId);
          return {
            success: true,
            data: {
              tabId: payload.tabId,
              url: tab.url,
              title: tab.title,
              status: tab.status,
              projectId: tracked.projectId,
              injected: tracked.injected,
            },
          };
        } catch {
          // Tab no longer exists
          this.trackedTabs.delete(payload.tabId);
          return { success: false, error: 'Tab no longer exists' };
        }
      }

      // Return status of opened tab
      if (this.openedTabId === null) {
        return { success: true, data: { openedTabId: null } };
      }

      try {
        const tab = await this.chromeTabs.get(this.openedTabId);
        const tracked = this.trackedTabs.get(this.openedTabId);
        
        return {
          success: true,
          data: {
            openedTabId: this.openedTabId,
            url: tab.url,
            title: tab.title,
            status: tab.status,
            projectId: tracked?.projectId,
            injected: tracked?.injected,
          },
        };
      } catch {
        // Tab no longer exists
        this.openedTabId = null;
        return { success: true, data: { openedTabId: null } };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tab status',
      };
    }
  }

  /**
   * Handle getTrackedTabs action
   * Returns all tracked tabs
   */
  public async handleGetTrackedTabs(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const tabs: Array<{
        tabId: number;
        url: string;
        projectId?: number;
        injected: boolean;
      }> = [];

      for (const [tabId, info] of this.trackedTabs) {
        tabs.push({
          tabId,
          url: info.url,
          projectId: info.projectId,
          injected: info.injected,
        });
      }

      return {
        success: true,
        data: {
          openedTabId: this.openedTabId,
          trackedTabs: tabs,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tracked tabs',
      };
    }
  }

  /**
   * Handle sendToTab action
   * Sends a message to a specific tab
   */
  public async handleSendToTab(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as SendToTabPayload;

      if (!payload?.tabId) {
        return { success: false, error: 'Tab ID is required' };
      }
      if (payload.message === undefined) {
        return { success: false, error: 'Message is required' };
      }

      const response = await this.chromeTabs.sendMessage(payload.tabId, payload.message);

      return { success: true, data: { response } };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message to tab',
      };
    }
  }

  /**
   * Handle injectIntoTab action
   * Injects content script into a specific tab
   */
  public async handleInjectIntoTab(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { tabId: number; allFrames?: boolean };

      if (!payload?.tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      await this.injectScript(payload.tabId, payload.allFrames ?? true);

      // Update tracking
      const tracked = this.trackedTabs.get(payload.tabId);
      if (tracked) {
        tracked.injected = true;
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inject into tab',
      };
    }
  }

  // ==========================================================================
  // INTERNAL METHODS
  // ==========================================================================

  /**
   * Inject content script into tab
   */
  private async injectScript(tabId: number, allFrames: boolean = true): Promise<void> {
    await this.chromeScripting.executeScript({
      target: { tabId, allFrames },
      files: [this.scriptPath],
    });
  }

  /**
   * Get opened tab ID
   */
  public getOpenedTabId(): number | null {
    return this.openedTabId;
  }

  /**
   * Set opened tab ID (for state restoration)
   */
  public setOpenedTabId(tabId: number | null): void {
    this.openedTabId = tabId;
  }

  /**
   * Get tracked tabs
   */
  public getTrackedTabs(): Map<number, { projectId?: number; injected: boolean; url: string }> {
    return new Map(this.trackedTabs);
  }

  /**
   * Track a tab manually
   */
  public trackTab(tabId: number, info: { projectId?: number; injected: boolean; url: string }): void {
    this.trackedTabs.set(tabId, info);
  }

  /**
   * Untrack a tab
   */
  public untrackTab(tabId: number): void {
    this.trackedTabs.delete(tabId);
    if (this.openedTabId === tabId) {
      this.openedTabId = null;
    }
  }

  /**
   * Clear all tracking
   */
  public clearTracking(): void {
    this.trackedTabs.clear();
    this.openedTabId = null;
  }

  // ==========================================================================
  // DEFAULT API IMPLEMENTATIONS
  // ==========================================================================

  private getDefaultChromeTabs(): IChromeTabs {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      return {
        create: (props) => chrome.tabs.create(props),
        remove: (tabId) => chrome.tabs.remove(tabId),
        get: (tabId) => chrome.tabs.get(tabId),
        query: (queryInfo) => chrome.tabs.query(queryInfo),
        sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
        update: (tabId, props) => chrome.tabs.update(tabId, props),
      };
    }
    throw new Error('Chrome tabs API not available');
  }

  private getDefaultChromeScripting(): IChromeScripting {
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      return {
        executeScript: (injection) => chrome.scripting.executeScript(injection),
      };
    }
    throw new Error('Chrome scripting API not available');
  }

  private getDefaultChromeRuntime(): IChromeRuntime {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return {
        getURL: (path) => chrome.runtime.getURL(path),
        get lastError() { return chrome.runtime.lastError; },
      };
    }
    return {
      getURL: (path) => `chrome-extension://mock-id/${path}`,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create TabHandlers instance
 */
export function createTabHandlers(
  chromeTabs?: IChromeTabs,
  chromeScripting?: IChromeScripting,
  chromeRuntime?: IChromeRuntime
): TabHandlers {
  return new TabHandlers(chromeTabs, chromeScripting, chromeRuntime);
}

/**
 * Create and register all tab handlers with a MessageReceiver
 */
export function registerTabHandlers(
  receiver: MessageReceiver,
  chromeTabs?: IChromeTabs,
  chromeScripting?: IChromeScripting,
  chromeRuntime?: IChromeRuntime
): TabHandlers {
  const handlers = new TabHandlers(chromeTabs, chromeScripting, chromeRuntime);
  handlers.registerAll(receiver);
  return handlers;
}
