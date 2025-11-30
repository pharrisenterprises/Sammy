/**
 * @fileoverview Centralized state management for extension
 * @module background/state-manager
 * @version 1.0.0
 * 
 * This module provides centralized state management with persistence,
 * subscriptions, and synchronization across all extension contexts.
 * 
 * STATE PERSISTENCE:
 * - Uses Chrome storage.local for persistence
 * - Survives service worker restarts
 * - Auto-saves on state changes
 * - Debounced saves for performance
 * 
 * SUBSCRIPTION MODEL:
 * - Subscribe to specific state keys
 * - Subscribe to all state changes
 * - Automatic unsubscribe on context close
 * 
 * @see PHASE_4_SPECIFICATIONS.md for state specifications
 * @see background-service_breakdown.md for architecture details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extension state shape
 */
export interface ExtensionState {
  /** Currently active project ID */
  activeProjectId: string | null;
  /** Recording tab ID */
  recordingTabId: number | null;
  /** Replaying tab ID */
  replayingTabId: number | null;
  /** Is recording active */
  isRecording: boolean;
  /** Is replaying active */
  isReplaying: boolean;
  /** Is paused (recording or replay) */
  isPaused: boolean;
  /** Current step index during replay */
  currentStepIndex: number;
  /** Total steps in current replay */
  totalSteps: number;
  /** Last error message */
  lastError: string | null;
  /** Last error timestamp */
  lastErrorTime: number | null;
  /** Service worker start time */
  startedAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Extension version */
  version: string;
  /** Debug mode enabled */
  debugMode: boolean;
}

/**
 * State change event
 */
export interface StateChangeEvent<K extends keyof ExtensionState = keyof ExtensionState> {
  /** Changed key */
  key: K;
  /** Previous value */
  previousValue: ExtensionState[K];
  /** New value */
  newValue: ExtensionState[K];
  /** Change timestamp */
  timestamp: number;
  /** Source of change */
  source: 'local' | 'sync' | 'reset';
}

/**
 * State subscriber callback
 */
export type StateSubscriber<K extends keyof ExtensionState = keyof ExtensionState> = (
  event: StateChangeEvent<K>
) => void;

/**
 * Global state subscriber (all changes)
 */
export type GlobalStateSubscriber = (
  event: StateChangeEvent,
  state: ExtensionState
) => void;

/**
 * State update function
 */
export type StateUpdater = (current: ExtensionState) => Partial<ExtensionState>;

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  /** Storage key for persistence */
  storageKey?: string;
  /** Auto-save delay (ms) */
  saveDebounceMs?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Broadcast state changes */
  broadcastChanges?: boolean;
}

/**
 * Subscription info
 */
interface Subscription {
  id: string;
  key: keyof ExtensionState | '*';
  callback: StateSubscriber | GlobalStateSubscriber;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default extension state
 */
export const DEFAULT_STATE: ExtensionState = {
  activeProjectId: null,
  recordingTabId: null,
  replayingTabId: null,
  isRecording: false,
  isReplaying: false,
  isPaused: false,
  currentStepIndex: 0,
  totalSteps: 0,
  lastError: null,
  lastErrorTime: null,
  startedAt: Date.now(),
  lastActivityAt: Date.now(),
  version: '1.0.0',
  debugMode: false
};

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Required<StateManagerConfig> = {
  storageKey: 'sammyExtensionState',
  saveDebounceMs: 500,
  debug: false,
  broadcastChanges: true
};

/**
 * State keys that should NOT persist (reset on restart)
 */
export const TRANSIENT_KEYS: Array<keyof ExtensionState> = [
  'isRecording',
  'isReplaying',
  'isPaused',
  'recordingTabId',
  'replayingTabId',
  'currentStepIndex',
  'totalSteps'
];

/**
 * State keys that should persist
 */
export const PERSISTENT_KEYS: Array<keyof ExtensionState> = [
  'activeProjectId',
  'lastError',
  'lastErrorTime',
  'version',
  'debugMode'
];

// ============================================================================
// STATE MANAGER CLASS
// ============================================================================

/**
 * State Manager
 * 
 * Centralized state management with persistence and subscriptions.
 * 
 * @example
 * ```typescript
 * const stateManager = new StateManager();
 * await stateManager.initialize();
 * 
 * // Subscribe to changes
 * stateManager.subscribe('isRecording', (event) => {
 *   console.log('Recording state changed:', event.newValue);
 * });
 * 
 * // Update state
 * stateManager.set('isRecording', true);
 * 
 * // Batch update
 * stateManager.update({ isRecording: true, recordingTabId: 123 });
 * ```
 */
export class StateManager {
  private state: ExtensionState;
  private config: Required<StateManagerConfig>;
  private subscriptions: Map<string, Subscription> = new Map();
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialized: boolean = false;
  private updateLock: boolean = false;

  constructor(config: StateManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = { ...DEFAULT_STATE };
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize state manager
   * 
   * Loads persisted state from storage.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Already initialized');
      return;
    }

    this.log('Initializing...');

    try {
      // Load persisted state
      await this.loadFromStorage();
      
      // Reset transient state
      this.resetTransientState();
      
      // Update timestamps
      this.state.startedAt = Date.now();
      this.state.lastActivityAt = Date.now();

      // Listen for storage changes from other contexts
      this.setupStorageListener();

      this.initialized = true;
      this.log('Initialized successfully');
    } catch (error) {
      console.error('[StateManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load state from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.config.storageKey);
      const savedState = result[this.config.storageKey];

      if (savedState && typeof savedState === 'object') {
        // Only restore persistent keys
        for (const key of PERSISTENT_KEYS) {
          if (key in savedState && savedState[key] !== undefined) {
            (this.state as unknown as Record<string, unknown>)[key] = savedState[key];
          }
        }
        this.log('State loaded from storage');
      }
    } catch (error) {
      console.error('[StateManager] Failed to load state:', error);
    }
  }

  /**
   * Save state to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      // Only save persistent keys
      const persistedState: Partial<ExtensionState> = {};
      for (const key of PERSISTENT_KEYS) {
        persistedState[key] = this.state[key] as never;
      }

      await chrome.storage.local.set({
        [this.config.storageKey]: persistedState
      });
      
      this.log('State saved to storage');
    } catch (error) {
      console.error('[StateManager] Failed to save state:', error);
    }
  }

  /**
   * Schedule debounced save
   */
  private scheduleSave(): void {
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
    }

    this.saveTimeoutId = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeoutId = null;
    }, this.config.saveDebounceMs);
  }

  /**
   * Reset transient state values
   */
  private resetTransientState(): void {
    for (const key of TRANSIENT_KEYS) {
      (this.state as unknown as Record<string, unknown>)[key] = DEFAULT_STATE[key];
    }
  }

  /**
   * Set up storage change listener
   */
  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (!changes[this.config.storageKey]) return;

      const { newValue } = changes[this.config.storageKey];
      if (newValue) {
        this.handleExternalStateChange(newValue);
      }
    });
  }

  /**
   * Handle state change from another context
   */
  private handleExternalStateChange(externalState: Partial<ExtensionState>): void {
    // Only sync persistent keys from external changes
    for (const key of PERSISTENT_KEYS) {
      if (key in externalState && externalState[key] !== this.state[key]) {
        const previousValue = this.state[key];
        (this.state as unknown as Record<string, unknown>)[key] = externalState[key];
        
        this.notifySubscribers(key, previousValue, externalState[key]!, 'sync');
      }
    }
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get entire state (read-only copy)
   */
  getState(): Readonly<ExtensionState> {
    return { ...this.state };
  }

  /**
   * Get specific state value
   */
  get<K extends keyof ExtensionState>(key: K): ExtensionState[K] {
    return this.state[key];
  }

  /**
   * Check if a state key has a truthy value
   */
  has<K extends keyof ExtensionState>(key: K): boolean {
    return Boolean(this.state[key]);
  }

  /**
   * Get multiple state values
   */
  pick<K extends keyof ExtensionState>(...keys: K[]): Pick<ExtensionState, K> {
    const result = {} as Pick<ExtensionState, K>;
    for (const key of keys) {
      result[key] = this.state[key];
    }
    return result;
  }

  // ==========================================================================
  // STATE UPDATES
  // ==========================================================================

  /**
   * Set a single state value
   */
  set<K extends keyof ExtensionState>(
    key: K,
    value: ExtensionState[K]
  ): void {
    if (this.updateLock) {
      console.warn('[StateManager] Update blocked - lock active');
      return;
    }

    const previousValue = this.state[key];
    
    if (previousValue === value) {
      return; // No change
    }

    this.state[key] = value;
    this.state.lastActivityAt = Date.now();

    // Notify subscribers
    this.notifySubscribers(key, previousValue, value, 'local');

    // Schedule save if persistent key
    if (PERSISTENT_KEYS.includes(key)) {
      this.scheduleSave();
    }

    // Broadcast change
    if (this.config.broadcastChanges) {
      this.broadcastChange(key, previousValue, value);
    }
  }

  /**
   * Update multiple state values at once
   */
  update(updates: Partial<ExtensionState>): void {
    if (this.updateLock) {
      console.warn('[StateManager] Update blocked - lock active');
      return;
    }

    const changes: Array<{ key: keyof ExtensionState; prev: ExtensionState[keyof ExtensionState]; next: ExtensionState[keyof ExtensionState] }> = [];
    let hasPersistentChange = false;

    for (const [key, value] of Object.entries(updates)) {
      const k = key as keyof ExtensionState;
      const previousValue = this.state[k];

      if (previousValue !== value) {
        (this.state as unknown as Record<string, unknown>)[k] = value;
        changes.push({ key: k, prev: previousValue, next: value as ExtensionState[keyof ExtensionState] });

        if (PERSISTENT_KEYS.includes(k)) {
          hasPersistentChange = true;
        }
      }
    }

    if (changes.length > 0) {
      this.state.lastActivityAt = Date.now();

      // Notify subscribers for each change
      for (const change of changes) {
        this.notifySubscribers(change.key as never, change.prev as never, change.next as never, 'local');
      }

      // Schedule save if any persistent key changed
      if (hasPersistentChange) {
        this.scheduleSave();
      }

      // Broadcast changes
      if (this.config.broadcastChanges) {
        for (const change of changes) {
          this.broadcastChange(change.key, change.prev, change.next);
        }
      }
    }
  }

  /**
   * Update state using updater function
   */
  transform(updater: StateUpdater): void {
    const updates = updater(this.getState());
    this.update(updates);
  }

  /**
   * Reset state to defaults
   */
  reset(): void {
    const previousState = { ...this.state };
    this.state = { ...DEFAULT_STATE, startedAt: Date.now() };

    // Notify subscribers for each changed key
    for (const key of Object.keys(previousState) as Array<keyof ExtensionState>) {
      if (previousState[key] !== this.state[key]) {
        this.notifySubscribers(key, previousState[key], this.state[key], 'reset');
      }
    }

    this.saveToStorage();
  }

  /**
   * Lock state updates (for critical sections)
   */
  lock(): void {
    this.updateLock = true;
  }

  /**
   * Unlock state updates
   */
  unlock(): void {
    this.updateLock = false;
  }

  /**
   * Execute function with lock
   */
  async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    this.lock();
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  /**
   * Subscribe to changes for a specific key
   */
  subscribe<K extends keyof ExtensionState>(
    key: K,
    callback: StateSubscriber<K>
  ): () => void {
    const id = generateSubscriptionId();
    
    this.subscriptions.set(id, {
      id,
      key,
      callback: callback as StateSubscriber
    });

    this.log(`Subscription added: ${id} for key "${key}"`);

    // Return unsubscribe function
    return () => this.unsubscribe(id);
  }

  /**
   * Subscribe to all state changes
   */
  subscribeAll(callback: GlobalStateSubscriber): () => void {
    const id = generateSubscriptionId();
    
    this.subscriptions.set(id, {
      id,
      key: '*',
      callback
    });

    this.log(`Global subscription added: ${id}`);

    return () => this.unsubscribe(id);
  }

  /**
   * Unsubscribe by ID
   */
  private unsubscribe(id: string): void {
    this.subscriptions.delete(id);
    this.log(`Subscription removed: ${id}`);
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.log('All subscriptions cleared');
  }

  /**
   * Notify subscribers of state change
   */
  private notifySubscribers<K extends keyof ExtensionState>(
    key: K,
    previousValue: ExtensionState[K],
    newValue: ExtensionState[K],
    source: 'local' | 'sync' | 'reset'
  ): void {
    const event: StateChangeEvent<K> = {
      key,
      previousValue,
      newValue,
      timestamp: Date.now(),
      source
    };

    for (const subscription of this.subscriptions.values()) {
      try {
        if (subscription.key === key || subscription.key === '*') {
          if (subscription.key === '*') {
            (subscription.callback as GlobalStateSubscriber)(event, this.getState());
          } else {
            (subscription.callback as StateSubscriber<K>)(event);
          }
        }
      } catch (error) {
        console.error('[StateManager] Subscriber error:', error);
      }
    }
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // ==========================================================================
  // BROADCASTING
  // ==========================================================================

  /**
   * Broadcast state change to other contexts
   */
  private broadcastChange(
    key: keyof ExtensionState,
    previousValue: unknown,
    newValue: unknown
  ): void {
    try {
      chrome.runtime.sendMessage({
        action: 'state_changed',
        data: {
          key,
          previousValue,
          newValue,
          state: this.getState()
        }
      }).catch(() => {
        // Ignore errors when no receivers
      });
    } catch {
      // Ignore errors
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force save immediately
   */
  async forceSave(): Promise<void> {
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
    await this.saveToStorage();
  }

  /**
   * Get state snapshot for debugging
   */
  getSnapshot(): {
    state: ExtensionState;
    subscriptionCount: number;
    initialized: boolean;
    locked: boolean;
  } {
    return {
      state: this.getState(),
      subscriptionCount: this.subscriptions.size,
      initialized: this.initialized,
      locked: this.updateLock
    };
  }

  /**
   * Log message (if debug enabled)
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[StateManager]', ...args);
    }
  }

  /**
   * Destroy state manager
   */
  destroy(): void {
    this.clearSubscriptions();
    
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
    }
    
    this.initialized = false;
    this.log('Destroyed');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: StateManager | null = null;

/**
 * Get or create state manager instance
 */
export function getStateManager(): StateManager {
  if (!instance) {
    instance = new StateManager();
  }
  return instance;
}

/**
 * Initialize state manager singleton
 */
export async function initializeStateManager(
  config?: StateManagerConfig
): Promise<StateManager> {
  if (!instance) {
    instance = new StateManager(config);
  }
  await instance.initialize();
  return instance;
}

/**
 * Reset state manager singleton (for testing)
 */
export function resetStateManager(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique subscription ID
 */
function generateSubscriptionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sub_${timestamp}_${random}`;
}

/**
 * Create state selector hook (for React-like usage)
 */
export function createStateSelector<K extends keyof ExtensionState>(
  manager: StateManager,
  key: K
): {
  get: () => ExtensionState[K];
  subscribe: (callback: StateSubscriber<K>) => () => void;
} {
  return {
    get: () => manager.get(key),
    subscribe: (callback) => manager.subscribe(key, callback)
  };
}

/**
 * Create derived state (computed from other state)
 */
export function createDerivedState<T>(
  manager: StateManager,
  compute: (state: ExtensionState) => T,
  dependencies: Array<keyof ExtensionState>
): {
  get: () => T;
  subscribe: (callback: (value: T) => void) => () => void;
} {
  let cachedValue = compute(manager.getState());

  return {
    get: () => {
      cachedValue = compute(manager.getState());
      return cachedValue;
    },
    subscribe: (callback) => {
      const unsubscribes = dependencies.map(key =>
        manager.subscribe(key, () => {
          const newValue = compute(manager.getState());
          if (newValue !== cachedValue) {
            cachedValue = newValue;
            callback(newValue);
          }
        })
      );

      return () => unsubscribes.forEach(unsub => unsub());
    }
  };
}
