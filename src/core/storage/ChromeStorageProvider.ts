/**
 * ChromeStorageProvider - Chrome extension storage implementation
 * @module core/storage/ChromeStorageProvider
 * @version 1.0.0
 * 
 * Persistent storage provider using Chrome extension storage APIs.
 * Supports local, sync, and session storage areas with automatic
 * quota management and change event handling.
 * 
 * Storage Areas:
 * - local: Large storage (10MB+), device-specific
 * - sync: Small storage (100KB), synced across devices
 * - session: Temporary, cleared on browser close
 * 
 * @see IStorageProvider for interface contract
 * @see storage-layer_breakdown.md for architecture details
 */

import {
  BaseStorageProvider,
  type StorageType,
  type StorageArea,
  type StorableValue,
  type StorageEntry,
  type StorageMetadata,
  type StorageQuery,
  type StorageQueryResult,
  type StorageQuota,
  type StorageStats,
  type StorageChange,
  type StorageProviderOptions,
  type TransactionOperation,
  type TransactionResult,
} from './IStorageProvider';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Chrome storage area quotas (in bytes)
 */
export const CHROME_QUOTAS = {
  local: 10 * 1024 * 1024,      // 10MB (QUOTA_BYTES)
  sync: 102400,                  // 100KB (QUOTA_BYTES)
  syncPerItem: 8192,             // 8KB (QUOTA_BYTES_PER_ITEM)
  session: 10 * 1024 * 1024,     // 10MB (estimate)
} as const;

/**
 * Chrome sync storage limits
 */
export const CHROME_SYNC_LIMITS = {
  maxItems: 512,                 // MAX_ITEMS
  maxWriteOperationsPerHour: 1800,
  maxWriteOperationsPerMinute: 120,
} as const;

/**
 * Key prefix for metadata storage
 */
export const METADATA_PREFIX = '__meta__';

/**
 * Key prefix for area namespacing
 */
export const AREA_PREFIX = '__area__';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chrome storage type (local, sync, or session)
 */
export type ChromeStorageType = 'chrome-local' | 'chrome-sync' | 'chrome-session';

/**
 * Chrome storage provider specific options
 */
export interface ChromeStorageOptions extends Partial<StorageProviderOptions> {
  /** Chrome storage area to use */
  chromeArea?: 'local' | 'sync' | 'session';
  /** Store metadata alongside values */
  storeMetadata?: boolean;
  /** Namespace prefix for all keys */
  namespace?: string;
  /** Fallback provider when chrome API unavailable */
  fallbackProvider?: BaseStorageProvider;
}

/**
 * Internal storage format with metadata
 */
interface StoredItem<T = StorableValue> {
  /** Stored value */
  value: T;
  /** Item metadata */
  metadata: StorageMetadata;
  /** Storage area (for filtering) */
  area: StorageArea;
}

// ============================================================================
// CHROME API DETECTION
// ============================================================================

/**
 * Checks if Chrome storage API is available
 */
export function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage !== undefined &&
    chrome.storage.local !== undefined
  );
}

/**
 * Gets the Chrome storage area object
 */
export function getChromeStorageArea(
  area: 'local' | 'sync' | 'session'
): chrome.storage.StorageArea | null {
  if (!isChromeStorageAvailable()) return null;
  
  switch (area) {
    case 'local':
      return chrome.storage.local;
    case 'sync':
      return chrome.storage.sync;
    case 'session':
      return chrome.storage.session || null;
    default:
      return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimates the size of a value when JSON stringified
 */
export function estimateJsonSize(value: StorableValue): number {
  try {
    return JSON.stringify(value).length * 2; // UTF-16
  } catch {
    return 0;
  }
}

/**
 * Wraps Chrome storage get in a Promise
 */
export function chromeGet(
  storage: chrome.storage.StorageArea,
  keys: string | string[] | null
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    storage.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Wraps Chrome storage set in a Promise
 */
export function chromeSet(
  storage: chrome.storage.StorageArea,
  items: Record<string, unknown>
): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Wraps Chrome storage remove in a Promise
 */
export function chromeRemove(
  storage: chrome.storage.StorageArea,
  keys: string | string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Wraps Chrome storage clear in a Promise
 */
export function chromeClear(
  storage: chrome.storage.StorageArea
): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Wraps Chrome storage getBytesInUse in a Promise
 */
export function chromeGetBytesInUse(
  storage: chrome.storage.StorageArea,
  keys?: string | string[] | null
): Promise<number> {
  return new Promise((resolve, reject) => {
    storage.getBytesInUse(keys ?? null, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(bytesInUse);
      }
    });
  });
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * ChromeStorageProvider - Chrome extension storage implementation
 * 
 * Provides persistent storage using Chrome's extension storage APIs.
 * Supports local, sync, and session storage with full metadata.
 * 
 * @example
 * ```typescript
 * const storage = new ChromeStorageProvider({ chromeArea: 'local' });
 * await storage.initialize();
 * 
 * await storage.set('settings', { theme: 'dark' }, 'config');
 * const settings = await storage.get('settings', 'config');
 * ```
 */
export class ChromeStorageProvider extends BaseStorageProvider {
  /**
   * Storage type identifier
   */
  readonly type: StorageType;
  
  /**
   * Chrome storage area ('local', 'sync', 'session')
   */
  private chromeArea: 'local' | 'sync' | 'session';
  
  /**
   * Chrome storage API reference
   */
  private storage: chrome.storage.StorageArea | null = null;
  
  /**
   * Namespace prefix for keys
   */
  private namespace: string;
  
  /**
   * Fallback provider for non-Chrome environments
   */
  private fallback: BaseStorageProvider | null = null;
  
  /**
   * Chrome change listener reference
   */
  private chromeListener: ((changes: Record<string, chrome.storage.StorageChange>) => void) | null = null;
  
  /**
   * Creates a new ChromeStorageProvider
   * 
   * @param options - Provider options
   */
  constructor(options: ChromeStorageOptions = {}) {
    const chromeArea = options.chromeArea ?? 'local';
    const type: StorageType = `chrome-${chromeArea}` as StorageType;
    
    super({
      type,
      defaultArea: 'state',
      autoTimestamp: true,
      enableChangeEvents: true,
      ...options,
    });
    
    this.type = type;
    this.chromeArea = chromeArea;
    this.namespace = options.namespace ?? 'copilot';
    this.fallback = options.fallbackProvider ?? null;
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Initializes the Chrome storage provider
   */
  async initialize(): Promise<void> {
    if (this._isReady) return;
    
    // Try to get Chrome storage
    this.storage = getChromeStorageArea(this.chromeArea);
    
    if (!this.storage) {
      if (this.fallback) {
        await this.fallback.initialize();
        this._isReady = true;
        return;
      }
      throw new Error(`Chrome storage '${this.chromeArea}' is not available`);
    }
    
    // Set up change listener
    if (this._options.enableChangeEvents) {
      this.setupChangeListener();
    }
    
    this._isReady = true;
  }
  
  /**
   * Closes the Chrome storage provider
   */
  async close(): Promise<void> {
    if (this.chromeListener && isChromeStorageAvailable()) {
      chrome.storage.onChanged.removeListener(this.chromeListener);
      this.chromeListener = null;
    }
    
    if (this.fallback) {
      await this.fallback.close();
    }
    
    this.storage = null;
    this._isReady = false;
  }
  
  /**
   * Sets up Chrome storage change listener
   */
  private setupChangeListener(): void {
    if (!isChromeStorageAvailable()) return;
    
    this.chromeListener = (changes) => {
      const storageChanges: StorageChange[] = [];
      const now = Date.now();
      
      for (const [fullKey, change] of Object.entries(changes)) {
        // Filter to our namespace
        if (!fullKey.startsWith(this.namespace)) continue;
        
        // Skip metadata keys
        if (fullKey.includes(METADATA_PREFIX)) continue;
        
        const { area, key } = this.parseFullKey(fullKey);
        
        const oldItem = change.oldValue as StoredItem | undefined;
        const newItem = change.newValue as StoredItem | undefined;
        
        storageChanges.push({
          key,
          area,
          type: newItem ? 'set' : 'remove',
          oldValue: oldItem?.value,
          newValue: newItem?.value,
          timestamp: now,
        });
      }
      
      if (storageChanges.length > 0) {
        this.notifyListeners(storageChanges);
      }
    };
    
    chrome.storage.onChanged.addListener(this.chromeListener);
  }
  
  // ==========================================================================
  // KEY MANAGEMENT
  // ==========================================================================
  
  /**
   * Builds a fully qualified storage key
   */
  private buildFullKey(key: string, area: StorageArea): string {
    return `${this.namespace}:${area}:${key}`;
  }
  
  /**
   * Parses a fully qualified storage key
   */
  private parseFullKey(fullKey: string): { area: StorageArea; key: string } {
    const parts = fullKey.split(':');
    if (parts.length >= 3) {
      const [, area, ...rest] = parts;
      return {
        area: area as StorageArea,
        key: rest.join(':'),
      };
    }
    return { area: 'state', key: fullKey };
  }
  
  // ==========================================================================
  // STORAGE ACCESS (with fallback)
  // ==========================================================================
  
  /**
   * Gets the active storage (Chrome or fallback)
   */
  private getActiveStorage(): chrome.storage.StorageArea | null {
    return this.storage;
  }
  
  /**
   * Checks if using fallback storage
   */
  private isUsingFallback(): boolean {
    return this.storage === null && this.fallback !== null;
  }
  
  // ==========================================================================
  // BASIC CRUD OPERATIONS
  // ==========================================================================
  
  /**
   * Gets a value by key
   */
  async get<T extends StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<T | null> {
    if (this.isUsingFallback()) {
      return this.fallback!.get<T>(key, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildFullKey(key, effectiveArea);
    
    const result = await chromeGet(storage, fullKey);
    const item = result[fullKey] as StoredItem<T> | undefined;
    
    if (!item) return null;
    
    return item.value;
  }
  
  /**
   * Gets a value with metadata
   */
  async getWithMetadata<T extends StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<StorageEntry<T> | null> {
    if (this.isUsingFallback()) {
      return this.fallback!.getWithMetadata<T>(key, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildFullKey(key, effectiveArea);
    
    const result = await chromeGet(storage, fullKey);
    const item = result[fullKey] as StoredItem<T> | undefined;
    
    if (!item) return null;
    
    return {
      key,
      value: item.value,
      metadata: item.metadata,
    };
  }
  
  /**
   * Sets a value by key
   */
  async set<T extends StorableValue>(
    key: string,
    value: T,
    area?: StorageArea
  ): Promise<void> {
    if (this.isUsingFallback()) {
      return this.fallback!.set<T>(key, value, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildFullKey(key, effectiveArea);
    const now = Date.now();
    
    // Get existing item for metadata update
    const existing = await chromeGet(storage, fullKey);
    const existingItem = existing[fullKey] as StoredItem<T> | undefined;
    
    const item: StoredItem<T> = {
      value,
      area: effectiveArea,
      metadata: {
        createdAt: existingItem?.metadata.createdAt ?? now,
        updatedAt: now,
        size: estimateJsonSize(value),
        version: (existingItem?.metadata.version ?? 0) + 1,
      },
    };
    
    await chromeSet(storage, { [fullKey]: item });
  }
  
  /**
   * Sets a value with custom metadata
   */
  async setWithMetadata<T extends StorableValue>(
    key: string,
    value: T,
    metadata: Partial<StorageMetadata>,
    area?: StorageArea
  ): Promise<void> {
    if (this.isUsingFallback()) {
      return this.fallback!.setWithMetadata<T>(key, value, metadata, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildFullKey(key, effectiveArea);
    const now = Date.now();
    
    const existing = await chromeGet(storage, fullKey);
    const existingItem = existing[fullKey] as StoredItem<T> | undefined;
    
    const item: StoredItem<T> = {
      value,
      area: effectiveArea,
      metadata: {
        createdAt: metadata.createdAt ?? existingItem?.metadata.createdAt ?? now,
        updatedAt: metadata.updatedAt ?? now,
        size: estimateJsonSize(value),
        version: metadata.version ?? (existingItem?.metadata.version ?? 0) + 1,
        contentType: metadata.contentType,
        tags: metadata.tags,
      },
    };
    
    await chromeSet(storage, { [fullKey]: item });
  }
  
  /**
   * Removes a value by key
   */
  async remove(key: string, area?: StorageArea): Promise<boolean> {
    if (this.isUsingFallback()) {
      return this.fallback!.remove(key, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildFullKey(key, effectiveArea);
    
    // Check if exists
    const existing = await chromeGet(storage, fullKey);
    if (!(fullKey in existing)) return false;
    
    await chromeRemove(storage, fullKey);
    return true;
  }
  
  /**
   * Checks if a key exists
   */
  async has(key: string, area?: StorageArea): Promise<boolean> {
    if (this.isUsingFallback()) {
      return this.fallback!.has(key, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildFullKey(key, effectiveArea);
    
    const result = await chromeGet(storage, fullKey);
    return fullKey in result;
  }
  
  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================
  
  /**
   * Gets multiple values by keys
   */
  async getMany<T extends StorableValue>(
    keys: string[],
    area?: StorageArea
  ): Promise<Map<string, T>> {
    if (this.isUsingFallback()) {
      return this.fallback!.getMany<T>(keys, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKeys = keys.map(k => this.buildFullKey(k, effectiveArea));
    
    const result = await chromeGet(storage, fullKeys);
    const output = new Map<string, T>();
    
    for (const [fullKey, item] of Object.entries(result)) {
      const { key } = this.parseFullKey(fullKey);
      output.set(key, (item as StoredItem<T>).value);
    }
    
    return output;
  }
  
  /**
   * Sets multiple values
   */
  async setMany<T extends StorableValue>(
    entries: Array<{ key: string; value: T }>,
    area?: StorageArea
  ): Promise<void> {
    if (this.isUsingFallback()) {
      return this.fallback!.setMany<T>(entries, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const now = Date.now();
    const items: Record<string, StoredItem<T>> = {};
    
    for (const { key, value } of entries) {
      const fullKey = this.buildFullKey(key, effectiveArea);
      
      items[fullKey] = {
        value,
        area: effectiveArea,
        metadata: {
          createdAt: now,
          updatedAt: now,
          size: estimateJsonSize(value),
          version: 1,
        },
      };
    }
    
    await chromeSet(storage, items);
  }
  
  /**
   * Removes multiple values by keys
   */
  async removeMany(keys: string[], area?: StorageArea): Promise<number> {
    if (this.isUsingFallback()) {
      return this.fallback!.removeMany(keys, area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const fullKeys = keys.map(k => this.buildFullKey(k, effectiveArea));
    
    // Count existing
    const existing = await chromeGet(storage, fullKeys);
    const count = Object.keys(existing).length;
    
    if (fullKeys.length > 0) {
      await chromeRemove(storage, fullKeys);
    }
    
    return count;
  }
  
  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================
  
  /**
   * Lists all keys in an area
   */
  async keys(area?: StorageArea): Promise<string[]> {
    if (this.isUsingFallback()) {
      return this.fallback!.keys(area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const prefix = `${this.namespace}:${effectiveArea}:`;
    
    const all = await chromeGet(storage, null);
    const keys: string[] = [];
    
    for (const fullKey of Object.keys(all)) {
      if (fullKey.startsWith(prefix)) {
        keys.push(fullKey.substring(prefix.length));
      }
    }
    
    return keys;
  }
  
  /**
   * Lists all entries in an area
   */
  async entries<T extends StorableValue>(
    area?: StorageArea
  ): Promise<StorageEntry<T>[]> {
    if (this.isUsingFallback()) {
      return this.fallback!.entries<T>(area);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const effectiveArea = this.getArea(area);
    const prefix = `${this.namespace}:${effectiveArea}:`;
    
    const all = await chromeGet(storage, null);
    const entries: StorageEntry<T>[] = [];
    
    for (const [fullKey, item] of Object.entries(all)) {
      if (fullKey.startsWith(prefix)) {
        const key = fullKey.substring(prefix.length);
        const storedItem = item as StoredItem<T>;
        
        entries.push({
          key,
          value: storedItem.value,
          metadata: storedItem.metadata,
        });
      }
    }
    
    return entries;
  }
  
  /**
   * Queries entries with filters
   */
  async query<T extends StorableValue>(
    query: StorageQuery,
    area?: StorageArea
  ): Promise<StorageQueryResult<T>> {
    // Use base class implementation for query logic
    if (this.isUsingFallback()) {
      return this.fallback!.query<T>(query, area);
    }
    
    let allEntries = await this.entries<T>(area);
    
    // Apply filters
    if (query.prefix) {
      allEntries = allEntries.filter(e => e.key.startsWith(query.prefix!));
    }
    
    if (query.suffix) {
      allEntries = allEntries.filter(e => e.key.endsWith(query.suffix!));
    }
    
    if (query.pattern) {
      const regex = typeof query.pattern === 'string'
        ? new RegExp(query.pattern)
        : query.pattern;
      allEntries = allEntries.filter(e => regex.test(e.key));
    }
    
    if (query.tags && query.tags.length > 0) {
      allEntries = allEntries.filter(e => {
        if (!e.metadata?.tags) return false;
        return query.tags!.some(tag => e.metadata!.tags!.includes(tag));
      });
    }
    
    if (query.createdAfter !== undefined) {
      allEntries = allEntries.filter(e =>
        e.metadata && e.metadata.createdAt >= query.createdAfter!
      );
    }
    
    if (query.createdBefore !== undefined) {
      allEntries = allEntries.filter(e =>
        e.metadata && e.metadata.createdAt <= query.createdBefore!
      );
    }
    
    // Sort
    if (query.sortBy) {
      allEntries.sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        
        switch (query.sortBy) {
          case 'key':
            aVal = a.key;
            bVal = b.key;
            break;
          case 'createdAt':
            aVal = a.metadata?.createdAt ?? 0;
            bVal = b.metadata?.createdAt ?? 0;
            break;
          case 'updatedAt':
            aVal = a.metadata?.updatedAt ?? 0;
            bVal = b.metadata?.updatedAt ?? 0;
            break;
          case 'size':
            aVal = a.metadata?.size ?? 0;
            bVal = b.metadata?.size ?? 0;
            break;
          default:
            return 0;
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal);
        }
        return (aVal as number) - (bVal as number);
      });
    }
    
    if (query.sortOrder === 'desc') {
      allEntries.reverse();
    }
    
    // Pagination
    const total = allEntries.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? allEntries.length;
    
    const entries = allEntries.slice(offset, offset + limit);
    const hasMore = offset + entries.length < total;
    
    return {
      entries,
      total,
      hasMore,
      nextOffset: hasMore ? offset + entries.length : undefined,
    };
  }
  
  /**
   * Counts entries matching query
   */
  async count(query?: StorageQuery, area?: StorageArea): Promise<number> {
    if (!query) {
      const keys = await this.keys(area);
      return keys.length;
    }
    
    const result = await this.query(query, area);
    return result.total;
  }
  
  // ==========================================================================
  // AREA OPERATIONS
  // ==========================================================================
  
  /**
   * Clears all data in an area
   */
  async clear(area: StorageArea): Promise<number> {
    if (this.isUsingFallback()) {
      return this.fallback!.clear(area);
    }
    
    const keys = await this.keys(area);
    
    if (keys.length > 0) {
      await this.removeMany(keys, area);
    }
    
    return keys.length;
  }
  
  /**
   * Clears all data in all areas
   */
  async clearAll(): Promise<number> {
    if (this.isUsingFallback()) {
      return this.fallback!.clearAll();
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    // Only clear our namespace
    const all = await chromeGet(storage, null);
    const keysToRemove = Object.keys(all).filter(k => k.startsWith(this.namespace));
    
    if (keysToRemove.length > 0) {
      await chromeRemove(storage, keysToRemove);
    }
    
    return keysToRemove.length;
  }
  
  // ==========================================================================
  // TRANSACTION OPERATIONS
  // ==========================================================================
  
  /**
   * Executes multiple operations atomically
   * 
   * Note: Chrome storage doesn't support true atomic transactions,
   * so this is a best-effort implementation.
   */
  async transaction(operations: TransactionOperation[]): Promise<TransactionResult> {
    if (this.isUsingFallback()) {
      return this.fallback!.transaction(operations);
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const partialResults: TransactionResult['partialResults'] = [];
    let operationsCompleted = 0;
    
    // Collect all operations into batch
    const toSet: Record<string, StoredItem> = {};
    const toRemove: string[] = [];
    const now = Date.now();
    
    try {
      for (const op of operations) {
        const effectiveArea = op.area ?? this.getArea(undefined);
        const fullKey = this.buildFullKey(op.key, effectiveArea);
        
        if (op.type === 'set' && op.value !== undefined) {
          toSet[fullKey] = {
            value: op.value,
            area: effectiveArea,
            metadata: {
              createdAt: now,
              updatedAt: now,
              size: estimateJsonSize(op.value),
              version: 1,
            },
          };
        } else if (op.type === 'remove') {
          toRemove.push(fullKey);
        }
        
        partialResults.push({ operation: op, success: true });
        operationsCompleted++;
      }
      
      // Execute batched operations
      if (Object.keys(toSet).length > 0) {
        await chromeSet(storage, toSet);
      }
      
      if (toRemove.length > 0) {
        await chromeRemove(storage, toRemove);
      }
      
      return {
        success: true,
        operationsCompleted,
        partialResults,
      };
    } catch (error) {
      return {
        success: false,
        operationsCompleted,
        error: error instanceof Error ? error : new Error(String(error)),
        partialResults,
      };
    }
  }
  
  // ==========================================================================
  // QUOTA & STATS
  // ==========================================================================
  
  /**
   * Gets storage quota information
   */
  async getQuota(): Promise<StorageQuota> {
    if (this.isUsingFallback()) {
      return this.fallback!.getQuota();
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const used = await chromeGetBytesInUse(storage, null);
    const total = CHROME_QUOTAS[this.chromeArea];
    
    return {
      total,
      used,
      available: total - used,
      usagePercent: (used / total) * 100,
    };
  }
  
  /**
   * Gets storage statistics
   */
  async getStats(): Promise<StorageStats> {
    if (this.isUsingFallback()) {
      return this.fallback!.getStats();
    }
    
    const areas: StorageArea[] = [
      'testCases',
      'steps',
      'config',
      'state',
      'cache',
      'metadata',
    ];
    
    const countByArea: Record<StorageArea, number> = {} as Record<StorageArea, number>;
    const sizeByArea: Record<StorageArea, number> = {} as Record<StorageArea, number>;
    const largestItems: Array<{ key: string; size: number }> = [];
    let lastActivity = 0;
    let totalSize = 0;
    let itemCount = 0;
    
    for (const area of areas) {
      countByArea[area] = 0;
      sizeByArea[area] = 0;
    }
    
    const storage = this.getActiveStorage();
    if (!storage) throw new Error('Storage not initialized');
    
    const all = await chromeGet(storage, null);
    
    for (const [fullKey, item] of Object.entries(all)) {
      if (!fullKey.startsWith(this.namespace)) continue;
      
      const { area, key } = this.parseFullKey(fullKey);
      const storedItem = item as StoredItem;
      const size = storedItem.metadata.size ?? 0;
      
      countByArea[area]++;
      sizeByArea[area] += size;
      totalSize += size;
      itemCount++;
      
      largestItems.push({ key: `${area}:${key}`, size });
      
      if (storedItem.metadata.updatedAt > lastActivity) {
        lastActivity = storedItem.metadata.updatedAt;
      }
    }
    
    // Sort and limit largest items
    largestItems.sort((a, b) => b.size - a.size);
    
    return {
      itemCount,
      totalSize,
      sizeByArea,
      countByArea,
      largestItems: largestItems.slice(0, 10),
      lastActivity,
    };
  }
  
  // ==========================================================================
  // CHROME-SPECIFIC METHODS
  // ==========================================================================
  
  /**
   * Gets the Chrome storage area being used
   */
  getChromeArea(): 'local' | 'sync' | 'session' {
    return this.chromeArea;
  }
  
  /**
   * Gets the namespace prefix
   */
  getNamespace(): string {
    return this.namespace;
  }
  
  /**
   * Checks if using fallback storage
   */
  isFallbackActive(): boolean {
    return this.isUsingFallback();
  }
  
  /**
   * Gets raw Chrome storage reference (for advanced use)
   */
  getRawStorage(): chrome.storage.StorageArea | null {
    return this.storage;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Singleton instances by type
 */
const instances: Map<StorageType, ChromeStorageProvider> = new Map();

/**
 * Gets or creates a ChromeStorageProvider singleton for the specified area
 * 
 * @param area - Chrome storage area
 * @returns ChromeStorageProvider instance
 */
export function getChromeStorage(
  area: 'local' | 'sync' | 'session' = 'local'
): ChromeStorageProvider {
  const type: StorageType = `chrome-${area}` as StorageType;
  
  if (!instances.has(type)) {
    instances.set(type, new ChromeStorageProvider({ chromeArea: area }));
  }
  
  return instances.get(type)!;
}

/**
 * Creates a new ChromeStorageProvider instance
 * 
 * @param options - Provider options
 * @returns New ChromeStorageProvider instance
 */
export function createChromeStorage(
  options?: ChromeStorageOptions
): ChromeStorageProvider {
  return new ChromeStorageProvider(options);
}

/**
 * Resets all Chrome storage singletons (for testing)
 */
export async function resetChromeStorage(): Promise<void> {
  for (const instance of instances.values()) {
    await instance.close();
  }
  instances.clear();
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ChromeStorageProvider;
