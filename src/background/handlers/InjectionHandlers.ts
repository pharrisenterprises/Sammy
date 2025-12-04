/**
 * InjectionHandlers - Message handlers for content script injection
 * @module background/handlers/InjectionHandlers
 * @version 1.0.0
 * 
 * Handles content script injection operations:
 * - injectScript: Inject content script into tab
 * - injectIntoAllFrames: Inject into main frame and all iframes
 * - getInjectionStatus: Check if tab has script injected
 * - reinjectAll: Re-inject into all tracked tabs
 * - setupNavigationListeners: Auto-reinject on navigation
 * 
 * Addresses stability concerns:
 * - Retry logic for failed injections
 * - Re-injection on navigation events
 * - Injection status tracking
 * 
 * @see background-service_breakdown.md for injection patterns
 */

import type {
  BackgroundMessage,
  BackgroundResponse,
  MessageSender,
  MessageHandler,
  ActionCategory,
  InjectionResult,
} from '../IBackgroundService';
import type { MessageReceiver } from '../MessageReceiver';
import type { BackgroundConfig } from '../BackgroundConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome scripting API interface (for testing)
 */
export interface IChromeScripting {
  executeScript(
    injection: chrome.scripting.ScriptInjection
  ): Promise<chrome.scripting.InjectionResult[]>;
}

/**
 * Chrome web navigation API interface (for testing)
 */
export interface IChromeWebNavigation {
  onCommitted: {
    addListener(
      callback: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void
    ): void;
    removeListener(
      callback: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void
    ): void;
  };
  onCompleted: {
    addListener(
      callback: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void
    ): void;
    removeListener(
      callback: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void
    ): void;
  };
}

/**
 * Injection status for a tab
 */
export interface InjectionStatus {
  tabId: number;
  injected: boolean;
  lastInjected?: Date;
  injectionCount: number;
  lastError?: string;
  frames: number;
}

/**
 * Inject script payload
 */
export interface InjectScriptPayload {
  tabId: number;
  files?: string[];
  allFrames?: boolean;
  world?: 'MAIN' | 'ISOLATED';
  retry?: boolean;
}

/**
 * Execute code payload
 */
export interface ExecuteCodePayload {
  tabId: number;
  code: string;
  allFrames?: boolean;
  world?: 'MAIN' | 'ISOLATED';
}

/**
 * Injection event types
 */
export type InjectionEventType =
  | 'injection_started'
  | 'injection_completed'
  | 'injection_failed'
  | 'injection_retried'
  | 'navigation_detected'
  | 'reinjection_triggered';

/**
 * Injection event
 */
export interface InjectionEvent {
  type: InjectionEventType;
  tabId: number;
  timestamp: Date;
  frameId?: number;
  url?: string;
  error?: string;
}

/**
 * Injection event listener
 */
export type InjectionEventListener = (event: InjectionEvent) => void;

/**
 * Injection action names
 */
export const INJECTION_ACTIONS = {
  INJECT_SCRIPT: 'injectScript',
  INJECT_INTO_ALL_FRAMES: 'injectIntoAllFrames',
  EXECUTE_CODE: 'executeCode',
  GET_INJECTION_STATUS: 'getInjectionStatus',
  REINJECT_ALL: 'reinjectAll',
  MARK_FOR_REINJECTION: 'markForReinjection',
  CLEAR_INJECTION_STATUS: 'clearInjectionStatus',
} as const;

/**
 * Default script paths
 */
export const DEFAULT_SCRIPTS = {
  MAIN: 'js/main.js',
  INTERCEPTOR: 'js/interceptor.js',
  REPLAY: 'js/replay.js',
} as const;

// ============================================================================
// INJECTION HANDLERS CLASS
// ============================================================================

/**
 * InjectionHandlers - Handles content script injection
 * 
 * @example
 * ```typescript
 * const handlers = new InjectionHandlers(config, chromeScripting, chromeWebNavigation);
 * 
 * // Register with message receiver
 * handlers.registerAll(receiver);
 * 
 * // Setup auto-reinject on navigation
 * handlers.setupNavigationListeners(trackedTabIds);
 * ```
 */
export class InjectionHandlers {
  private config: BackgroundConfig;
  private chromeScripting: IChromeScripting;
  private chromeWebNavigation: IChromeWebNavigation | null;

  // Injection status tracking
  private injectionStatus: Map<number, InjectionStatus> = new Map();

  // Tabs that should auto-reinject on navigation
  private autoReinjectTabs: Set<number> = new Set();

  // Navigation listeners
  private onCommittedListener: ((details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void) | null = null;
  private onCompletedListener: ((details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void) | null = null;

  // Event listeners
  private eventListeners: Set<InjectionEventListener> = new Set();

  // Statistics
  private stats = {
    totalInjections: 0,
    successfulInjections: 0,
    failedInjections: 0,
    retries: 0,
    reinjections: 0,
  };

  /**
   * Create InjectionHandlers
   */
  constructor(
    config: BackgroundConfig,
    chromeScripting?: IChromeScripting,
    chromeWebNavigation?: IChromeWebNavigation | null
  ) {
    this.config = config;
    this.chromeScripting = chromeScripting ?? this.getDefaultChromeScripting();
    this.chromeWebNavigation = chromeWebNavigation ?? this.getDefaultChromeWebNavigation();
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all injection handlers with a MessageReceiver
   */
  public registerAll(receiver: MessageReceiver): void {
    receiver.register(
      INJECTION_ACTIONS.INJECT_SCRIPT,
      this.handleInjectScript.bind(this),
      'injection'
    );

    receiver.register(
      INJECTION_ACTIONS.INJECT_INTO_ALL_FRAMES,
      this.handleInjectIntoAllFrames.bind(this),
      'injection'
    );

    receiver.register(
      INJECTION_ACTIONS.EXECUTE_CODE,
      this.handleExecuteCode.bind(this),
      'injection'
    );

    receiver.register(
      INJECTION_ACTIONS.GET_INJECTION_STATUS,
      this.handleGetInjectionStatus.bind(this),
      'injection'
    );

    receiver.register(
      INJECTION_ACTIONS.REINJECT_ALL,
      this.handleReinjectAll.bind(this),
      'injection'
    );

    receiver.register(
      INJECTION_ACTIONS.MARK_FOR_REINJECTION,
      this.handleMarkForReinjection.bind(this),
      'injection'
    );

    receiver.register(
      INJECTION_ACTIONS.CLEAR_INJECTION_STATUS,
      this.handleClearInjectionStatus.bind(this),
      'injection'
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
      { action: INJECTION_ACTIONS.INJECT_SCRIPT, handler: this.handleInjectScript.bind(this), category: 'injection' },
      { action: INJECTION_ACTIONS.INJECT_INTO_ALL_FRAMES, handler: this.handleInjectIntoAllFrames.bind(this), category: 'injection' },
      { action: INJECTION_ACTIONS.EXECUTE_CODE, handler: this.handleExecuteCode.bind(this), category: 'injection' },
      { action: INJECTION_ACTIONS.GET_INJECTION_STATUS, handler: this.handleGetInjectionStatus.bind(this), category: 'injection' },
      { action: INJECTION_ACTIONS.REINJECT_ALL, handler: this.handleReinjectAll.bind(this), category: 'injection' },
      { action: INJECTION_ACTIONS.MARK_FOR_REINJECTION, handler: this.handleMarkForReinjection.bind(this), category: 'injection' },
      { action: INJECTION_ACTIONS.CLEAR_INJECTION_STATUS, handler: this.handleClearInjectionStatus.bind(this), category: 'injection' },
    ];
  }

  // ==========================================================================
  // HANDLER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Handle injectScript action
   * Injects content script files into a tab
   */
  public async handleInjectScript(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as InjectScriptPayload;

      if (!payload?.tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const files = payload.files ?? [DEFAULT_SCRIPTS.MAIN];
      const allFrames = payload.allFrames ?? true;
      const world = payload.world ?? 'ISOLATED';

      const result = await this.injectScripts(
        payload.tabId,
        files,
        allFrames,
        world,
        payload.retry ?? true
      );

      return result.success
        ? { success: true, data: { frames: result.frameResults?.length ?? 0 } }
        : { success: false, error: result.error };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inject script',
      };
    }
  }

  /**
   * Handle injectIntoAllFrames action
   * Injects main script into tab and all iframes
   */
  public async handleInjectIntoAllFrames(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { tabId: number };

      if (!payload?.tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      const result = await this.injectScripts(
        payload.tabId,
        [DEFAULT_SCRIPTS.MAIN],
        true,
        'ISOLATED',
        true
      );

      // Also enable auto-reinject for this tab
      this.autoReinjectTabs.add(payload.tabId);

      return result.success
        ? { success: true, data: { frames: result.frameResults?.length ?? 0 } }
        : { success: false, error: result.error };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inject into all frames',
      };
    }
  }

  /**
   * Handle executeCode action
   * Executes inline code in a tab
   */
  public async handleExecuteCode(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as ExecuteCodePayload;

      if (!payload?.tabId) {
        return { success: false, error: 'Tab ID is required' };
      }
      if (!payload?.code) {
        return { success: false, error: 'Code is required' };
      }

      const results = await this.chromeScripting.executeScript({
        target: {
          tabId: payload.tabId,
          allFrames: payload.allFrames ?? false,
        },
        func: new Function(payload.code) as () => unknown,
        world: payload.world ?? 'ISOLATED',
      });

      return {
        success: true,
        data: { results: results.map(r => r.result) },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute code',
      };
    }
  }

  /**
   * Handle getInjectionStatus action
   * Returns injection status for a tab
   */
  public async handleGetInjectionStatus(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { tabId?: number };

      if (payload?.tabId) {
        // Get specific tab status
        const status = this.injectionStatus.get(payload.tabId);
        
        if (!status) {
          return {
            success: true,
            data: {
              tabId: payload.tabId,
              injected: false,
              injectionCount: 0,
            },
          };
        }

        return { success: true, data: status };
      }

      // Get all injection statuses
      const statuses: InjectionStatus[] = [];
      for (const [tabId, status] of this.injectionStatus) {
        statuses.push({ ...status, tabId });
      }

      return {
        success: true,
        data: {
          statuses,
          autoReinjectTabs: Array.from(this.autoReinjectTabs),
          stats: this.stats,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get injection status',
      };
    }
  }

  /**
   * Handle reinjectAll action
   * Re-injects into all tabs marked for auto-reinject
   */
  public async handleReinjectAll(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const results: Array<{ tabId: number; success: boolean; error?: string }> = [];

      for (const tabId of this.autoReinjectTabs) {
        const result = await this.injectScripts(
          tabId,
          [DEFAULT_SCRIPTS.MAIN],
          true,
          'ISOLATED',
          false // Don't retry during bulk reinject
        );

        results.push({
          tabId,
          success: result.success,
          error: result.error,
        });

        this.stats.reinjections++;
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: true,
        data: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
          results,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reinject all',
      };
    }
  }

  /**
   * Handle markForReinjection action
   * Marks a tab for auto-reinjection on navigation
   */
  public async handleMarkForReinjection(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { tabId: number; enabled?: boolean };

      if (!payload?.tabId) {
        return { success: false, error: 'Tab ID is required' };
      }

      if (payload.enabled === false) {
        this.autoReinjectTabs.delete(payload.tabId);
      } else {
        this.autoReinjectTabs.add(payload.tabId);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark for reinjection',
      };
    }
  }

  /**
   * Handle clearInjectionStatus action
   * Clears injection status for a tab
   */
  public async handleClearInjectionStatus(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { tabId?: number };

      if (payload?.tabId) {
        this.injectionStatus.delete(payload.tabId);
        this.autoReinjectTabs.delete(payload.tabId);
      } else {
        this.injectionStatus.clear();
        this.autoReinjectTabs.clear();
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear injection status',
      };
    }
  }

  // ==========================================================================
  // CORE INJECTION LOGIC
  // ==========================================================================

  /**
   * Inject scripts into tab with retry logic
   */
  public async injectScripts(
    tabId: number,
    files: string[],
    allFrames: boolean,
    world: 'MAIN' | 'ISOLATED',
    retry: boolean
  ): Promise<InjectionResult> {
    this.stats.totalInjections++;

    this.emitEvent({
      type: 'injection_started',
      tabId,
      timestamp: new Date(),
    });

    const injectionConfig = this.config.getInjectionConfig();
    const maxRetries = retry ? injectionConfig.maxRetries : 0;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        this.stats.retries++;
        this.emitEvent({
          type: 'injection_retried',
          tabId,
          timestamp: new Date(),
        });

        // Wait before retry
        await this.delay(injectionConfig.navigationDelay * attempt);
      }

      try {
        const results = await this.chromeScripting.executeScript({
          target: { tabId, allFrames },
          files,
          world,
        });

        // Update status
        this.updateInjectionStatus(tabId, true, results.length);

        this.stats.successfulInjections++;

        this.emitEvent({
          type: 'injection_completed',
          tabId,
          timestamp: new Date(),
        });

        return {
          success: true,
          frameResults: results.map((r, i) => ({
            frameId: i,
            success: true,
          })),
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    // All attempts failed
    this.stats.failedInjections++;
    this.updateInjectionStatus(tabId, false, 0, lastError);

    this.emitEvent({
      type: 'injection_failed',
      tabId,
      timestamp: new Date(),
      error: lastError,
    });

    return {
      success: false,
      error: lastError,
    };
  }

  /**
   * Update injection status for a tab
   */
  private updateInjectionStatus(
    tabId: number,
    success: boolean,
    frames: number,
    error?: string
  ): void {
    const existing = this.injectionStatus.get(tabId);

    this.injectionStatus.set(tabId, {
      tabId,
      injected: success,
      lastInjected: success ? new Date() : existing?.lastInjected,
      injectionCount: (existing?.injectionCount ?? 0) + (success ? 1 : 0),
      lastError: error ?? existing?.lastError,
      frames,
    });
  }

  // ==========================================================================
  // NAVIGATION LISTENERS
  // ==========================================================================

  /**
   * Setup navigation listeners for auto-reinjection
   */
  public setupNavigationListeners(): void {
    if (!this.chromeWebNavigation) {
      console.warn('[InjectionHandlers] WebNavigation API not available');
      return;
    }

    // Clean up existing listeners
    this.removeNavigationListeners();

    // onCommitted - fires when navigation is committed
    this.onCommittedListener = (details) => {
      if (details.frameId !== 0) return; // Only main frame
      if (!this.autoReinjectTabs.has(details.tabId)) return;

      this.emitEvent({
        type: 'navigation_detected',
        tabId: details.tabId,
        frameId: details.frameId,
        url: details.url,
        timestamp: new Date(),
      });

      // Schedule reinjection after short delay
      setTimeout(() => {
        this.triggerReinjection(details.tabId, 'onCommitted');
      }, this.config.getInjectionConfig().navigationDelay);
    };

    // onCompleted - fires when page load completes
    this.onCompletedListener = (details) => {
      if (details.frameId !== 0) return; // Only main frame
      if (!this.autoReinjectTabs.has(details.tabId)) return;

      // Reinject on completion as well
      this.triggerReinjection(details.tabId, 'onCompleted');
    };

    this.chromeWebNavigation.onCommitted.addListener(this.onCommittedListener);
    this.chromeWebNavigation.onCompleted.addListener(this.onCompletedListener);
  }

  /**
   * Remove navigation listeners
   */
  public removeNavigationListeners(): void {
    if (!this.chromeWebNavigation) return;

    if (this.onCommittedListener) {
      this.chromeWebNavigation.onCommitted.removeListener(this.onCommittedListener);
      this.onCommittedListener = null;
    }
    if (this.onCompletedListener) {
      this.chromeWebNavigation.onCompleted.removeListener(this.onCompletedListener);
      this.onCompletedListener = null;
    }
  }

  /**
   * Trigger reinjection for a tab
   */
  private async triggerReinjection(tabId: number, source: string): Promise<void> {
    this.emitEvent({
      type: 'reinjection_triggered',
      tabId,
      timestamp: new Date(),
    });

    await this.injectScripts(
      tabId,
      [DEFAULT_SCRIPTS.MAIN],
      true,
      'ISOLATED',
      true
    );

    this.stats.reinjections++;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Check if tab is injected
   */
  public isInjected(tabId: number): boolean {
    const status = this.injectionStatus.get(tabId);
    return status?.injected ?? false;
  }

  /**
   * Get tabs marked for auto-reinject
   */
  public getAutoReinjectTabs(): Set<number> {
    return new Set(this.autoReinjectTabs);
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
      totalInjections: 0,
      successfulInjections: 0,
      failedInjections: 0,
      retries: 0,
      reinjections: 0,
    };
  }

  /**
   * Clear all state
   */
  public clearAll(): void {
    this.injectionStatus.clear();
    this.autoReinjectTabs.clear();
    this.resetStats();
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to injection events
   */
  public onEvent(listener: InjectionEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: InjectionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[InjectionHandlers] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getDefaultChromeScripting(): IChromeScripting {
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      return {
        executeScript: (injection) => chrome.scripting.executeScript(injection),
      };
    }
    throw new Error('Chrome scripting API not available');
  }

  private getDefaultChromeWebNavigation(): IChromeWebNavigation | null {
    if (typeof chrome !== 'undefined' && chrome.webNavigation) {
      return {
        onCommitted: chrome.webNavigation.onCommitted,
        onCompleted: chrome.webNavigation.onCompleted,
      };
    }
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create InjectionHandlers instance
 */
export function createInjectionHandlers(
  config: BackgroundConfig,
  chromeScripting?: IChromeScripting,
  chromeWebNavigation?: IChromeWebNavigation | null
): InjectionHandlers {
  return new InjectionHandlers(config, chromeScripting, chromeWebNavigation);
}

/**
 * Create and register all injection handlers with a MessageReceiver
 */
export function registerInjectionHandlers(
  receiver: MessageReceiver,
  config: BackgroundConfig,
  chromeScripting?: IChromeScripting,
  chromeWebNavigation?: IChromeWebNavigation | null
): InjectionHandlers {
  const handlers = new InjectionHandlers(config, chromeScripting, chromeWebNavigation);
  handlers.registerAll(receiver);
  return handlers;
}
