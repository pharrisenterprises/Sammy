/**
 * BackgroundState - Persistent state management for service worker
 * @module background/BackgroundState
 * @version 1.0.0
 * 
 * Addresses Manifest V3 service worker suspension:
 * - Service worker can terminate after 30s idle
 * - In-memory state (openedTabId, trackedTabs) lost on restart
 * - Critical state must persist to chrome.storage.local
 * 
 * Key features:
 * - Persist state to chrome.storage.local
 * - Auto-restore on service worker wake
 * - Debounced saves to reduce storage writes
 * - State change events for coordination
 * 
 * @see background-service_breakdown.md for stability concerns
 */

import type { IBackgroundState } from './IBackgroundService';
import type { BackgroundConfig } from './BackgroundConfig';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome storage API interface (for testing)
 */
export interface IChromeStorage {
  local: {
    get(keys: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    clear(): Promise<void>;
  };
  session?: {
    get(keys: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    clear(): Promise<void>;
  };
}

/**
 * State change event
 */
export interface StateChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
}

/**
 * State change listener
 */
export type StateChangeListener = (event: StateChangeEvent) => void;

/**
 * Serializable tracked tab info
 */
export interface TrackedTabInfo {
  tabId: number;
  projectId?: number;
  url: string;
  injected: boolean;
  trackedAt: string;
}

/**
 * Persisted state schema
 */
export interface PersistedState {
  openedTabId: number | null;
  trackedTabs: TrackedTabInfo[];
  activeProjectId: number | null;
  recordingState: RecordingState | null;
  lastUpdated: string;
  version: number;
}

/**
 * Recording state
 */
export interface RecordingState {
  projectId: number;
  tabId: number;
  isRecording: boolean;
  stepCount: number;
  startedAt: string;
}

/**
 * State keys
 */
export const STATE_KEYS = {
  OPENED_TAB_ID: 'bg_openedTabId',
  TRACKED_TABS: 'bg_trackedTabs',
  ACTIVE_PROJECT: 'bg_activeProject',
  RECORDING_STATE: 'bg_recordingState',
  PERSISTED_STATE: 'bg_persistedState',
  LAST_UPDATED: 'bg_lastUpdated',
} as const;

/**
 * Current state version for migrations
 */
export const STATE_VERSION = 1;

// ============================================================================
// BACKGROUND STATE CLASS
// ============================================================================

/**
 * BackgroundState - Manages persistent state for service worker
 * 
 * @example
 * ```typescript
 * const state = new BackgroundState(config);
 * 
 * // Restore state on service worker wake
 * await state.restore();
 * 
 * // Save state changes
 * await state.save('openedTabId', 123);
 * 
 * // Load state
 * const tabId = await state.load<number>('openedTabId');
 * 
 * // Listen for changes
 * state.onChange(event => console.log('State changed:', event));
 * ```
 */
export class BackgroundState implements IBackgroundState {
  private config: BackgroundConfig;
  private chromeStorage: IChromeStorage;

  // In-memory cache
  private cache: Map<string, unknown> = new Map();
  private cacheInitialized: boolean = false;

  // Debounce tracking
  private pendingSaves: Map<string, unknown> = new Map();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Event listeners
  private changeListeners: Set<StateChangeListener> = new Set();

  // Statistics
  private stats = {
    saves: 0,
    loads: 0,
    restores: 0,
    errors: 0,
  };

  /**
   * Create BackgroundState
   */
  constructor(
    config: BackgroundConfig,
    chromeStorage?: IChromeStorage
  ) {
    this.config = config;
    this.chromeStorage = chromeStorage ?? this.getDefaultChromeStorage();
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  /**
   * Save a value to persistent storage
   */
  public async save<T>(key: string, value: T): Promise<void> {
    const stateConfig = this.config.getStateConfig();
    const fullKey = this.getFullKey(key);

    // Update cache immediately
    const oldValue = this.cache.get(fullKey);
    this.cache.set(fullKey, value);

    // Emit change event
    this.emitChange({
      key,
      oldValue,
      newValue: value,
      timestamp: new Date(),
    });

    // Debounce storage write
    if (stateConfig.saveDebounce > 0) {
      this.pendingSaves.set(fullKey, value);
      this.scheduleSave();
    } else {
      await this.writeToStorage(fullKey, value);
    }

    this.stats.saves++;
  }

  /**
   * Load a value from persistent storage
   */
  public async load<T>(key: string): Promise<T | undefined> {
    const fullKey = this.getFullKey(key);

    // Check cache first
    if (this.cache.has(fullKey)) {
      this.stats.loads++;
      return this.cache.get(fullKey) as T;
    }

    // Load from storage
    const storage = this.getStorage();
    const result = await storage.get(fullKey);
    const value = result[fullKey] as T | undefined;

    // Update cache
    if (value !== undefined) {
      this.cache.set(fullKey, value);
    }

    this.stats.loads++;
    return value;
  }

  /**
   * Delete a value from storage
   */
  public async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    // Remove from cache
    const oldValue = this.cache.get(fullKey);
    this.cache.delete(fullKey);

    // Remove pending save
    this.pendingSaves.delete(fullKey);

    // Remove from storage
    const storage = this.getStorage();
    await storage.remove(fullKey);

    // Emit change event
    this.emitChange({
      key,
      oldValue,
      newValue: undefined,
      timestamp: new Date(),
    });
  }

  /**
   * Clear all state
   */
  public async clear(): Promise<void> {
    // Clear cache
    this.cache.clear();
    this.pendingSaves.clear();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Clear storage with our prefix
    const storage = this.getStorage();
    const prefix = this.config.getStateConfig().keyPrefix;
    const allKeys = await storage.get(null);
    
    const keysToRemove = Object.keys(allKeys).filter(k => k.startsWith(prefix));
    if (keysToRemove.length > 0) {
      await storage.remove(keysToRemove);
    }

    this.cacheInitialized = false;
  }

  /**
   * Restore all persisted state on service worker wake
   */
  public async restore(): Promise<void> {
    const stateConfig = this.config.getStateConfig();
    
    if (!stateConfig.autoRestore) {
      return;
    }

    try {
      const storage = this.getStorage();
      const prefix = stateConfig.keyPrefix;

      // Load all keys with our prefix
      const allData = await storage.get(null);
      
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(prefix)) {
          this.cache.set(key, value);
        }
      }

      this.cacheInitialized = true;
      this.stats.restores++;

    } catch (error) {
      this.stats.errors++;
      console.error('[BackgroundState] Failed to restore state:', error);
      throw error;
    }
  }

  /**
   * Get all keys in storage
   */
  public async keys(): Promise<string[]> {
    const storage = this.getStorage();
    const prefix = this.config.getStateConfig().keyPrefix;
    const allData = await storage.get(null);
    
    return Object.keys(allData)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length)); // Remove prefix
  }

  // ==========================================================================
  // CONVENIENCE METHODS FOR COMMON STATE
  // ==========================================================================

  /**
   * Save opened tab ID
   */
  public async saveOpenedTabId(tabId: number | null): Promise<void> {
    await this.save(STATE_KEYS.OPENED_TAB_ID, tabId);
  }

  /**
   * Load opened tab ID
   */
  public async loadOpenedTabId(): Promise<number | null> {
    return (await this.load<number | null>(STATE_KEYS.OPENED_TAB_ID)) ?? null;
  }

  /**
   * Save tracked tabs
   */
  public async saveTrackedTabs(tabs: TrackedTabInfo[]): Promise<void> {
    await this.save(STATE_KEYS.TRACKED_TABS, tabs);
  }

  /**
   * Load tracked tabs
   */
  public async loadTrackedTabs(): Promise<TrackedTabInfo[]> {
    return (await this.load<TrackedTabInfo[]>(STATE_KEYS.TRACKED_TABS)) ?? [];
  }

  /**
   * Add tracked tab
   */
  public async addTrackedTab(info: TrackedTabInfo): Promise<void> {
    const tabs = await this.loadTrackedTabs();
    const existing = tabs.findIndex(t => t.tabId === info.tabId);
    
    if (existing >= 0) {
      tabs[existing] = info;
    } else {
      tabs.push(info);
    }
    
    await this.saveTrackedTabs(tabs);
  }

  /**
   * Remove tracked tab
   */
  public async removeTrackedTab(tabId: number): Promise<void> {
    const tabs = await this.loadTrackedTabs();
    const filtered = tabs.filter(t => t.tabId !== tabId);
    await this.saveTrackedTabs(filtered);
  }

  /**
   * Save active project ID
   */
  public async saveActiveProject(projectId: number | null): Promise<void> {
    await this.save(STATE_KEYS.ACTIVE_PROJECT, projectId);
  }

  /**
   * Load active project ID
   */
  public async loadActiveProject(): Promise<number | null> {
    return (await this.load<number | null>(STATE_KEYS.ACTIVE_PROJECT)) ?? null;
  }

  /**
   * Save recording state
   */
  public async saveRecordingState(state: RecordingState | null): Promise<void> {
    await this.save(STATE_KEYS.RECORDING_STATE, state);
  }

  /**
   * Load recording state
   */
  public async loadRecordingState(): Promise<RecordingState | null> {
    return (await this.load<RecordingState | null>(STATE_KEYS.RECORDING_STATE)) ?? null;
  }

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  /**
   * Save complete state snapshot
   */
  public async saveSnapshot(): Promise<void> {
    const snapshot: PersistedState = {
      openedTabId: await this.loadOpenedTabId(),
      trackedTabs: await this.loadTrackedTabs(),
      activeProjectId: await this.loadActiveProject(),
      recordingState: await this.loadRecordingState(),
      lastUpdated: new Date().toISOString(),
      version: STATE_VERSION,
    };

    await this.save(STATE_KEYS.PERSISTED_STATE, snapshot);
  }

  /**
   * Load complete state snapshot
   */
  public async loadSnapshot(): Promise<PersistedState | null> {
    return await this.load<PersistedState>(STATE_KEYS.PERSISTED_STATE) ?? null;
  }

  /**
   * Restore from snapshot
   */
  public async restoreFromSnapshot(snapshot: PersistedState): Promise<void> {
    await this.saveOpenedTabId(snapshot.openedTabId);
    await this.saveTrackedTabs(snapshot.trackedTabs);
    await this.saveActiveProject(snapshot.activeProjectId);
    await this.saveRecordingState(snapshot.recordingState);
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to state changes
   */
  public onChange(listener: StateChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Emit state change event
   */
  private emitChange(event: StateChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[BackgroundState] Error in change listener:', error);
      }
    });
  }

  // ==========================================================================
  // DEBOUNCED SAVE
  // ==========================================================================

  /**
   * Schedule debounced save
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      return; // Already scheduled
    }

    const debounce = this.config.getStateConfig().saveDebounce;

    this.saveTimeout = setTimeout(async () => {
      await this.flushPendingSaves();
    }, debounce);
  }

  /**
   * Flush all pending saves to storage
   */
  public async flushPendingSaves(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.pendingSaves.size === 0) {
      return;
    }

    const storage = this.getStorage();
    const items: Record<string, unknown> = {};

    for (const [key, value] of this.pendingSaves) {
      items[key] = value;
    }

    this.pendingSaves.clear();

    try {
      await storage.set(items);
    } catch (error) {
      this.stats.errors++;
      console.error('[BackgroundState] Failed to flush saves:', error);
      throw error;
    }
  }

  /**
   * Write single value to storage
   */
  private async writeToStorage(key: string, value: unknown): Promise<void> {
    const storage = this.getStorage();
    
    try {
      await storage.set({ [key]: value });
    } catch (error) {
      this.stats.errors++;
      console.error('[BackgroundState] Failed to write:', key, error);
      throw error;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Get full storage key with prefix
   */
  private getFullKey(key: string): string {
    const prefix = this.config.getStateConfig().keyPrefix;
    
    // Don't double-prefix
    if (key.startsWith(prefix)) {
      return key;
    }
    
    return `${prefix}${key}`;
  }

  /**
   * Get storage based on config
   */
  private getStorage(): IChromeStorage['local'] {
    const storageType = this.config.getStateConfig().storageType;
    
    if (storageType === 'session' && this.chromeStorage.session) {
      return this.chromeStorage.session;
    }
    
    return this.chromeStorage.local;
  }

  /**
   * Get cache status
   */
  public isCacheInitialized(): boolean {
    return this.cacheInitialized;
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
      saves: 0,
      loads: 0,
      restores: 0,
      errors: 0,
    };
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get pending saves count
   */
  public getPendingSavesCount(): number {
    return this.pendingSaves.size;
  }

  // ==========================================================================
  // DEFAULT STORAGE
  // ==========================================================================

  private getDefaultChromeStorage(): IChromeStorage {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return {
        local: {
          get: (keys) => chrome.storage.local.get(keys),
          set: (items) => chrome.storage.local.set(items),
          remove: (keys) => chrome.storage.local.remove(keys),
          clear: () => chrome.storage.local.clear(),
        },
        session: chrome.storage.session ? {
          get: (keys) => chrome.storage.session.get(keys),
          set: (items) => chrome.storage.session.set(items),
          remove: (keys) => chrome.storage.session.remove(keys),
          clear: () => chrome.storage.session.clear(),
        } : undefined,
      };
    }
    throw new Error('Chrome storage API not available');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create BackgroundState instance
 */
export function createBackgroundState(
  config: BackgroundConfig,
  chromeStorage?: IChromeStorage
): BackgroundState {
  return new BackgroundState(config, chromeStorage);
}
