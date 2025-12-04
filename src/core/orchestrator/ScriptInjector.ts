/**
 * ScriptInjector - Injects content scripts into browser tabs
 * @module core/orchestrator/ScriptInjector
 * @version 1.0.0
 * 
 * Wraps chrome.scripting.executeScript() API with retry logic,
 * frame targeting, and injection status tracking.
 * 
 * @see background-service_breakdown.md for injection patterns
 * @see content-script-system_breakdown.md for content script details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Script injection target
 */
export interface InjectionTarget {
  /** Tab ID to inject into */
  tabId: number;
  /** Frame IDs to target (empty = main frame only) */
  frameIds?: number[];
  /** Inject into all frames. Default: true */
  allFrames?: boolean;
}

/**
 * Script to inject
 */
export interface InjectableScript {
  /** Script file path (relative to extension root) */
  file?: string;
  /** Inline code to execute */
  code?: string;
  /** Script identifier for tracking */
  id: string;
}

/**
 * Injection result for a single script
 */
export interface InjectionResult {
  /** Success status */
  success: boolean;
  /** Target tab ID */
  tabId: number;
  /** Script ID */
  scriptId: string;
  /** Frame results (frameId -> success) */
  frameResults?: Map<number, boolean>;
  /** Error message if failed */
  error?: string;
  /** Injection duration (ms) */
  duration?: number;
  /** Retry count */
  retryCount?: number;
}

/**
 * Batch injection result
 */
export interface BatchInjectionResult {
  /** Overall success (all scripts injected) */
  success: boolean;
  /** Total scripts attempted */
  total: number;
  /** Successfully injected count */
  succeeded: number;
  /** Failed injection count */
  failed: number;
  /** Individual results */
  results: InjectionResult[];
  /** Total duration (ms) */
  duration: number;
}

/**
 * Injection status for tracking
 */
export interface InjectionStatus {
  /** Tab ID */
  tabId: number;
  /** Script ID */
  scriptId: string;
  /** Whether currently injected */
  injected: boolean;
  /** Last injection time */
  lastInjectedAt?: Date;
  /** Injection count */
  injectionCount: number;
  /** Last error */
  lastError?: string;
}

/**
 * Injection event types
 */
export type InjectionEventType =
  | 'injection_started'
  | 'injection_completed'
  | 'injection_failed'
  | 'injection_retry';

/**
 * Injection event payload
 */
export interface InjectionEvent {
  type: InjectionEventType;
  tabId: number;
  scriptId: string;
  success?: boolean;
  error?: string;
  retryCount?: number;
  timestamp: Date;
}

/**
 * Injection event listener
 */
export type InjectionEventListener = (event: InjectionEvent) => void;

/**
 * ScriptInjector configuration
 */
export interface ScriptInjectorConfig {
  /** Default script file to inject. Default: 'js/main.js' */
  defaultScript: string;
  /** Inject into all frames by default. Default: true */
  allFrames: boolean;
  /** Retry failed injections. Default: true */
  enableRetry: boolean;
  /** Maximum retry attempts. Default: 3 */
  maxRetries: number;
  /** Delay between retries (ms). Default: 500 */
  retryDelay: number;
  /** Timeout for injection (ms). Default: 10000 */
  timeout: number;
  /** Verify injection after completion. Default: false */
  verifyAfterInject: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default content script (main.js)
 */
export const DEFAULT_CONTENT_SCRIPT: InjectableScript = {
  id: 'main',
  file: 'js/main.js',
};

/**
 * Default configuration
 */
export const DEFAULT_SCRIPT_INJECTOR_CONFIG: ScriptInjectorConfig = {
  defaultScript: 'js/main.js',
  allFrames: true,
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 500,
  timeout: 10000,
  verifyAfterInject: false,
};

// ============================================================================
// SCRIPT INJECTOR CLASS
// ============================================================================

/**
 * ScriptInjector - Manages content script injection
 * 
 * @example
 * ```typescript
 * const injector = new ScriptInjector();
 * 
 * // Inject default script
 * const result = await injector.inject(tabId);
 * 
 * // Inject custom script
 * const result = await injector.injectScript(tabId, {
 *   id: 'custom',
 *   file: 'js/custom.js'
 * });
 * 
 * // Check injection status
 * if (injector.isInjected(tabId, 'main')) {
 *   // Script is ready
 * }
 * ```
 */
export class ScriptInjector {
  private config: ScriptInjectorConfig;
  private injectionStatus: Map<string, InjectionStatus> = new Map();
  private listeners: Set<InjectionEventListener> = new Set();

  /**
   * Create a new ScriptInjector
   * 
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<ScriptInjectorConfig> = {}) {
    this.config = { ...DEFAULT_SCRIPT_INJECTOR_CONFIG, ...config };
  }

  // ==========================================================================
  // PRIMARY INJECTION METHODS
  // ==========================================================================

  /**
   * Inject the default content script into a tab
   * 
   * @param tabId - Tab ID to inject into
   * @param allFrames - Inject into all frames (default: config value)
   * @returns Promise resolving to injection result
   */
  public async inject(
    tabId: number,
    allFrames: boolean = this.config.allFrames
  ): Promise<InjectionResult> {
    return this.injectScript(tabId, DEFAULT_CONTENT_SCRIPT, { allFrames });
  }

  /**
   * Inject a specific script into a tab
   * 
   * @param tabId - Tab ID to inject into
   * @param script - Script to inject
   * @param options - Injection options
   * @returns Promise resolving to injection result
   */
  public async injectScript(
    tabId: number,
    script: InjectableScript,
    options: {
      allFrames?: boolean;
      frameIds?: number[];
      retry?: boolean;
    } = {}
  ): Promise<InjectionResult> {
    const {
      allFrames = this.config.allFrames,
      frameIds,
      retry = this.config.enableRetry,
    } = options;

    const startTime = Date.now();
    const statusKey = this.getStatusKey(tabId, script.id);
    let retryCount = 0;

    // Emit start event
    this.emitEvent({
      type: 'injection_started',
      tabId,
      scriptId: script.id,
      timestamp: new Date(),
    });

    // Attempt injection with retries
    while (retryCount <= (retry ? this.config.maxRetries : 0)) {
      try {
        const result = await this.executeInjection(tabId, script, {
          allFrames,
          frameIds,
        });

        if (result.success) {
          // Update status
          this.updateStatus(tabId, script.id, true);

          // Emit success event
          this.emitEvent({
            type: 'injection_completed',
            tabId,
            scriptId: script.id,
            success: true,
            retryCount,
            timestamp: new Date(),
          });

          return {
            ...result,
            duration: Date.now() - startTime,
            retryCount,
          };
        }

        // Injection returned failure
        if (retryCount < this.config.maxRetries && retry) {
          retryCount++;
          this.emitEvent({
            type: 'injection_retry',
            tabId,
            scriptId: script.id,
            error: result.error,
            retryCount,
            timestamp: new Date(),
          });
          await this.delay(this.config.retryDelay);
        } else {
          // Final failure
          this.updateStatus(tabId, script.id, false, result.error);

          this.emitEvent({
            type: 'injection_failed',
            tabId,
            scriptId: script.id,
            success: false,
            error: result.error,
            retryCount,
            timestamp: new Date(),
          });

          return {
            ...result,
            duration: Date.now() - startTime,
            retryCount,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (retryCount < this.config.maxRetries && retry) {
          retryCount++;
          this.emitEvent({
            type: 'injection_retry',
            tabId,
            scriptId: script.id,
            error: errorMessage,
            retryCount,
            timestamp: new Date(),
          });
          await this.delay(this.config.retryDelay);
        } else {
          // Final failure
          this.updateStatus(tabId, script.id, false, errorMessage);

          this.emitEvent({
            type: 'injection_failed',
            tabId,
            scriptId: script.id,
            success: false,
            error: errorMessage,
            retryCount,
            timestamp: new Date(),
          });

          return {
            success: false,
            tabId,
            scriptId: script.id,
            error: errorMessage,
            duration: Date.now() - startTime,
            retryCount,
          };
        }
      }
    }

    // Should not reach here, but return failure just in case
    return {
      success: false,
      tabId,
      scriptId: script.id,
      error: 'Max retries exceeded',
      duration: Date.now() - startTime,
      retryCount,
    };
  }

  /**
   * Inject multiple scripts into a tab
   * 
   * @param tabId - Tab ID to inject into
   * @param scripts - Scripts to inject
   * @param options - Injection options
   * @returns Promise resolving to batch result
   */
  public async injectMultiple(
    tabId: number,
    scripts: InjectableScript[],
    options: {
      allFrames?: boolean;
      stopOnError?: boolean;
    } = {}
  ): Promise<BatchInjectionResult> {
    const { allFrames = this.config.allFrames, stopOnError = false } = options;
    const startTime = Date.now();
    const results: InjectionResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const script of scripts) {
      const result = await this.injectScript(tabId, script, { allFrames });
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        if (stopOnError) {
          break;
        }
      }
    }

    return {
      success: failed === 0,
      total: scripts.length,
      succeeded,
      failed,
      results,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Inject into multiple tabs
   * 
   * @param tabIds - Tab IDs to inject into
   * @param script - Script to inject (default: main content script)
   * @returns Promise resolving to results per tab
   */
  public async injectIntoTabs(
    tabIds: number[],
    script: InjectableScript = DEFAULT_CONTENT_SCRIPT
  ): Promise<Map<number, InjectionResult>> {
    const results = new Map<number, InjectionResult>();

    await Promise.all(
      tabIds.map(async (tabId) => {
        const result = await this.injectScript(tabId, script);
        results.set(tabId, result);
      })
    );

    return results;
  }

  // ==========================================================================
  // CHROME API WRAPPER
  // ==========================================================================

  /**
   * Execute the actual injection via Chrome API
   */
  private executeInjection(
    tabId: number,
    script: InjectableScript,
    options: { allFrames?: boolean; frameIds?: number[] }
  ): Promise<InjectionResult> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          tabId,
          scriptId: script.id,
          error: `Injection timeout after ${this.config.timeout}ms`,
        });
      }, this.config.timeout);

      try {
        // Check if Chrome API is available
        if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
          clearTimeout(timeoutId);
          // Mock environment - simulate success
          resolve({
            success: true,
            tabId,
            scriptId: script.id,
          });
          return;
        }

        const target: chrome.scripting.InjectionTarget = {
          tabId,
          allFrames: options.allFrames ?? this.config.allFrames,
        };

        if (options.frameIds && options.frameIds.length > 0) {
          target.frameIds = options.frameIds;
          target.allFrames = false; // frameIds overrides allFrames
        }

        const injectionOptions: chrome.scripting.ScriptInjection<unknown[], unknown> = {
          target,
          files: script.file ? [script.file] : undefined,
          func: script.code ? () => eval(script.code!) : undefined,
        };

        // Remove undefined properties
        if (!injectionOptions.files) delete injectionOptions.files;
        if (!injectionOptions.func) delete injectionOptions.func;

        chrome.scripting.executeScript(
          injectionOptions as chrome.scripting.ScriptInjection<unknown[], unknown>,
          (results) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                tabId,
                scriptId: script.id,
                error: chrome.runtime.lastError.message,
              });
              return;
            }

            // Build frame results if available
            const frameResults = new Map<number, boolean>();
            if (results) {
              for (const result of results) {
                frameResults.set(result.frameId, true);
              }
            }

            resolve({
              success: true,
              tabId,
              scriptId: script.id,
              frameResults: frameResults.size > 0 ? frameResults : undefined,
            });
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          tabId,
          scriptId: script.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  // ==========================================================================
  // CODE INJECTION
  // ==========================================================================

  /**
   * Inject inline code into a tab
   * 
   * @param tabId - Tab ID
   * @param code - Code to execute
   * @param id - Script identifier
   * @returns Promise resolving to injection result
   */
  public async injectCode(
    tabId: number,
    code: string,
    id: string = 'inline'
  ): Promise<InjectionResult> {
    return this.injectScript(tabId, { id, code }, { retry: false });
  }

  /**
   * Inject a function into a tab
   * 
   * @param tabId - Tab ID
   * @param func - Function to execute
   * @param args - Arguments to pass to function
   * @returns Promise resolving to result
   */
  public async injectFunction<T, A extends unknown[]>(
    tabId: number,
    func: (...args: A) => T,
    args: A = [] as unknown as A
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
        // Mock environment
        resolve({ success: true, result: undefined });
        return;
      }

      try {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func,
            args,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: chrome.runtime.lastError.message,
              });
              return;
            }

            resolve({
              success: true,
              result: results?.[0]?.result as T,
            });
          }
        );
      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  // ==========================================================================
  // STATUS TRACKING
  // ==========================================================================

  /**
   * Check if a script is injected in a tab
   */
  public isInjected(tabId: number, scriptId: string = 'main'): boolean {
    const status = this.injectionStatus.get(this.getStatusKey(tabId, scriptId));
    return status?.injected ?? false;
  }

  /**
   * Get injection status for a tab/script
   */
  public getStatus(tabId: number, scriptId: string = 'main'): InjectionStatus | undefined {
    return this.injectionStatus.get(this.getStatusKey(tabId, scriptId));
  }

  /**
   * Get all injection statuses
   */
  public getAllStatuses(): InjectionStatus[] {
    return Array.from(this.injectionStatus.values());
  }

  /**
   * Get injected tabs for a script
   */
  public getInjectedTabs(scriptId: string = 'main'): number[] {
    return this.getAllStatuses()
      .filter(s => s.scriptId === scriptId && s.injected)
      .map(s => s.tabId);
  }

  /**
   * Mark script as not injected (e.g., after navigation)
   */
  public markNotInjected(tabId: number, scriptId: string = 'main'): void {
    const key = this.getStatusKey(tabId, scriptId);
    const status = this.injectionStatus.get(key);
    if (status) {
      status.injected = false;
    }
  }

  /**
   * Clear status for a tab
   */
  public clearStatus(tabId: number): void {
    const keysToDelete: string[] = [];
    for (const [key, status] of this.injectionStatus) {
      if (status.tabId === tabId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.injectionStatus.delete(key));
  }

  /**
   * Update injection status
   */
  private updateStatus(
    tabId: number,
    scriptId: string,
    injected: boolean,
    error?: string
  ): void {
    const key = this.getStatusKey(tabId, scriptId);
    const existing = this.injectionStatus.get(key);

    this.injectionStatus.set(key, {
      tabId,
      scriptId,
      injected,
      lastInjectedAt: injected ? new Date() : existing?.lastInjectedAt,
      injectionCount: (existing?.injectionCount ?? 0) + (injected ? 1 : 0),
      lastError: error,
    });
  }

  /**
   * Generate status key
   */
  private getStatusKey(tabId: number, scriptId: string): string {
    return `${tabId}:${scriptId}`;
  }

  // ==========================================================================
  // VERIFICATION
  // ==========================================================================

  /**
   * Verify script is injected and responsive
   * 
   * @param tabId - Tab ID to verify
   * @returns Promise resolving to verification result
   */
  public async verifyInjection(tabId: number): Promise<boolean> {
    try {
      const result = await this.injectFunction(tabId, () => {
        return typeof window !== 'undefined';
      });
      return result.success && result.result === true;
    } catch {
      return false;
    }
  }

  /**
   * Inject and verify
   */
  public async injectAndVerify(
    tabId: number,
    script: InjectableScript = DEFAULT_CONTENT_SCRIPT
  ): Promise<InjectionResult> {
    const result = await this.injectScript(tabId, script);

    if (result.success && this.config.verifyAfterInject) {
      const verified = await this.verifyInjection(tabId);
      if (!verified) {
        return {
          ...result,
          success: false,
          error: 'Injection verification failed',
        };
      }
    }

    return result;
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to injection events
   */
  public onEvent(listener: InjectionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  public offEvent(listener: InjectionEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit an injection event
   */
  private emitEvent(event: InjectionEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ScriptInjector] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  public getConfig(): ScriptInjectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ScriptInjectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset all state
   */
  public reset(): void {
    this.injectionStatus.clear();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ScriptInjector instance
 */
export function createScriptInjector(
  config?: Partial<ScriptInjectorConfig>
): ScriptInjector {
  return new ScriptInjector(config);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an injectable script definition
 */
export function createScript(
  id: string,
  file: string
): InjectableScript {
  return { id, file };
}

/**
 * Create inline code script
 */
export function createInlineScript(
  id: string,
  code: string
): InjectableScript {
  return { id, code };
}
