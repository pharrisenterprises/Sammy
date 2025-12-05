/**
 * ScriptInjector - Content Script Injection
 * @module background/ScriptInjector
 * @version 1.0.0
 * 
 * Handles dynamic injection of content scripts into tabs.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Target tab ID */
  tabId: number;
  /** Inject into all frames */
  allFrames?: boolean;
  /** Script files to inject */
  files?: string[];
  /** Execution world */
  world?: chrome.scripting.ExecutionWorld;
}

/**
 * Injection result
 */
export interface InjectionResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONTENT_SCRIPTS = ['js/main.js'];

// ============================================================================
// SCRIPT INJECTOR CLASS
// ============================================================================

/**
 * Handles content script injection
 */
export class ScriptInjector {
  private defaultScripts: string[];
  private injectedTabs: Set<number> = new Set();

  constructor(defaultScripts: string[] = DEFAULT_CONTENT_SCRIPTS) {
    this.defaultScripts = defaultScripts;
  }

  /**
   * Inject content scripts into a tab
   */
  async inject(tabId: number, options?: Partial<InjectionOptions>): Promise<InjectionResult> {
    const files = options?.files || this.defaultScripts;
    const allFrames = options?.allFrames ?? true;

    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames },
        files,
        world: options?.world,
      });

      this.injectedTabs.add(tabId);
      console.log(`Injected scripts into tab ${tabId}:`, files);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Injection failed';
      console.error(`Failed to inject scripts into tab ${tabId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Inject page interceptor script
   */
  async injectInterceptor(tabId: number): Promise<InjectionResult> {
    return this.inject(tabId, {
      files: ['js/interceptor.js'],
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
    });
  }

  /**
   * Inject replay script
   */
  async injectReplay(tabId: number): Promise<InjectionResult> {
    return this.inject(tabId, {
      files: ['js/replay.js'],
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
    });
  }

  /**
   * Check if tab has been injected
   */
  isInjected(tabId: number): boolean {
    return this.injectedTabs.has(tabId);
  }

  /**
   * Mark tab as not injected (e.g., after navigation)
   */
  markNotInjected(tabId: number): void {
    this.injectedTabs.delete(tabId);
  }

  /**
   * Clear injection tracking
   */
  clearTracking(): void {
    this.injectedTabs.clear();
  }

  /**
   * Inject and wait for content script ready
   */
  async injectAndWait(tabId: number, timeout: number = 5000): Promise<InjectionResult> {
    const result = await this.inject(tabId);
    
    if (!result.success) {
      return result;
    }

    // Wait for content script to signal ready
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkReady = async () => {
        try {
          const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
          if (response === 'pong') {
            resolve({ success: true });
            return;
          }
        } catch {
          // Content script not ready yet
        }

        if (Date.now() - startTime < timeout) {
          setTimeout(checkReady, 100);
        } else {
          resolve({ success: false, error: 'Content script not ready' });
        }
      };

      setTimeout(checkReady, 100);
    });
  }
}

export default ScriptInjector;
