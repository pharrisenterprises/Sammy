/**
 * StorageManager - Unified storage facade
 * @module core/storage/StorageManager
 * @version 1.0.0
 * 
 * Single entry point for all storage operations. Automatically selects
 * the best available storage backend and provides high-level APIs for
 * domain objects like TestCase and RecordedStep.
 * 
 * Features:
 * - Auto-detection of available storage backends
 * - Provider fallback chain (Chrome → IndexedDB → Memory)
 * - High-level domain APIs
 * - In-memory caching
 * - Cross-provider migration
 * 
 * @see IStorageProvider for provider interface
 * @see storage-layer_breakdown.md for architecture details
 */

import {
  type IStorageProvider,
  type StorageArea,
  type StorableValue,
  type StorageEntry,
  type StorageQuery,
  type StorageQueryResult,
  type StorageQuota,
  type StorageStats,
  type StorageChange,
  type StorageChangeListener,
  type Unsubscribe,
} from './IStorageProvider';
import {
  createMemoryStorage,
} from './MemoryStorageProvider';
import {
  ChromeStorageProvider,
  createChromeStorage,
  isChromeStorageAvailable,
} from './ChromeStorageProvider';
import {
  IndexedDBStorageProvider,
  createIndexedDBStorage,
  isIndexedDBAvailable,
} from './IndexedDBStorageProvider';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default cache TTL (5 minutes)
 */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Maximum cache entries
 */
export const MAX_CACHE_ENTRIES = 1000;

/**
 * Storage provider priority order
 */
export const PROVIDER_PRIORITY = [
  'chrome-local',
  'indexeddb',
  'memory',
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Storage manager configuration
 */
export interface StorageManagerConfig {
  /** Preferred provider type */
  preferredProvider?: 'chrome' | 'indexeddb' | 'memory' | 'auto';
  /** Chrome storage area (if using Chrome) */
  chromeArea?: 'local' | 'sync' | 'session';
  /** IndexedDB database name */
  dbName?: string;
  /** Enable in-memory caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Maximum cache entries */
  maxCacheEntries?: number;
  /** Namespace for storage keys */
  namespace?: string;
  /** Auto-initialize on creation */
  autoInitialize?: boolean;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T = StorableValue> {
  value: T;
  expiresAt: number;
  area: StorageArea;
}

/**
 * Provider info for debugging
 */
export interface ProviderInfo {
  type: string;
  isReady: boolean;
  isFallback: boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  itemsMigrated: number;
  itemsFailed: number;
  errors: string[];
  duration: number;
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * StorageManager - Unified storage facade
 * 
 * Provides a single entry point for all storage operations with
 * automatic provider selection and caching.
 * 
 * @example
 * ```typescript
 * const storage = new StorageManager();
 * await storage.initialize();
 * 
 * // Store a test case
 * await storage.set('test-1', testCase, 'testCases');
 * 
 * // Retrieve with caching
 * const test = await storage.get('test-1', 'testCases');
 * ```
 */
export class StorageManager {
  /**
   * Active storage provider
   */
  private provider: IStorageProvider | null = null;
  
  /**
   * Manager configuration
   */
  private config: Required<StorageManagerConfig>;
  
  /**
   * In-memory cache
   */
  private cache: Map<string, CacheEntry> = new Map();
  
  /**
   * Whether manager is initialized
   */
  private _isReady: boolean = false;
  
  /**
   * Change listeners
   */
  private changeListeners: Set<StorageChangeListener> = new Set();
  
  /**
   * Provider unsubscribe function
   */
  private providerUnsubscribe: Unsubscribe | null = null;
  
  /**
   * Creates a new StorageManager
   * 
   * @param config - Manager configuration
   */
  constructor(config: StorageManagerConfig = {}) {
    this.config = {
      preferredProvider: 'auto',
      chromeArea: 'local',
      dbName: 'copilot-storage',
      enableCache: true,
      cacheTtl: DEFAULT_CACHE_TTL,
      maxCacheEntries: MAX_CACHE_ENTRIES,
      namespace: 'copilot',
      autoInitialize: false,
      ...config,
    };
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Whether manager is initialized and ready
   */
  get isReady(): boolean {
    return this._isReady;
  }
  
  /**
   * Initializes the storage manager
   * 
   * Automatically selects the best available provider based on
   * configuration and environment capabilities.
   */
  async initialize(): Promise<void> {
    if (this._isReady) return;
    
    // Select and initialize provider
    this.provider = await this.selectProvider();
    await this.provider.initialize();
    
    // Subscribe to provider changes
    this.providerUnsubscribe = this.provider.onChange((changes) => {
      this.handleProviderChanges(changes);
    });
    
    this._isReady = true;
  }
  
  /**
   * Closes the storage manager
   */
  async close(): Promise<void> {
    if (this.providerUnsubscribe) {
      this.providerUnsubscribe();
      this.providerUnsubscribe = null;
    }
    
    if (this.provider) {
      await this.provider.close();
      this.provider = null;
    }
    
    this.cache.clear();
    this.changeListeners.clear();
    this._isReady = false;
  }
  
  /**
   * Selects the best available storage provider
   */
  private async selectProvider(): Promise<IStorageProvider> {
    const { preferredProvider, chromeArea, dbName, namespace } = this.config;
    
    // If specific provider requested
    if (preferredProvider !== 'auto') {
      switch (preferredProvider) {
        case 'chrome':
          if (isChromeStorageAvailable()) {
            return createChromeStorage({
              chromeArea,
              namespace,
              fallbackProvider: createMemoryStorage(),
            });
          }
          break;
        case 'indexeddb':
          if (isIndexedDBAvailable()) {
            return createIndexedDBStorage({
              dbName,
              fallbackProvider: createMemoryStorage(),
            });
          }
          break;
        case 'memory':
          return createMemoryStorage();
      }
    }
    
    // Auto-select best available
    if (isChromeStorageAvailable()) {
      return createChromeStorage({
        chromeArea,
        namespace,
        fallbackProvider: createMemoryStorage(),
      });
    }
    
    if (isIndexedDBAvailable()) {
      return createIndexedDBStorage({
        dbName,
        fallbackProvider: createMemoryStorage(),
      });
    }
    
    // Fallback to memory
    return createMemoryStorage();
  }
  
  /**
   * Gets the active provider
   */
  private getProvider(): IStorageProvider {
    if (!this.provider || !this._isReady) {
      throw new Error('StorageManager not initialized. Call initialize() first.');
    }
    return this.provider;
  }
  
  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================
  
  /**
   * Builds a cache key
   */
  private buildCacheKey(key: string, area: StorageArea): string {
    return `${area}:${key}`;
  }
  
  /**
   * Gets a value from cache
   */
  private getFromCache<T>(key: string, area: StorageArea): T | null {
    if (!this.config.enableCache) return null;
    
    const cacheKey = this.buildCacheKey(key, area);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry.value as T;
  }
  
  /**
   * Sets a value in cache
   */
  private setInCache<T extends StorableValue>(
    key: string,
    value: T,
    area: StorageArea
  ): void {
    if (!this.config.enableCache) return;
    
    // Enforce max cache size
    if (this.cache.size >= this.config.maxCacheEntries) {
      this.evictOldestCacheEntries();
    }
    
    const cacheKey = this.buildCacheKey(key, area);
    this.cache.set(cacheKey, {
      value,
      area,
      expiresAt: Date.now() + this.config.cacheTtl,
    });
  }
  
  /**
   * Removes a value from cache
   */
  private removeFromCache(key: string, area: StorageArea): void {
    const cacheKey = this.buildCacheKey(key, area);
    this.cache.delete(cacheKey);
  }
  
  /**
   * Clears cache for an area
   */
  private clearCacheArea(area: StorageArea): void {
    for (const [cacheKey, entry] of this.cache) {
      if (entry.area === area) {
        this.cache.delete(cacheKey);
      }
    }
  }
  
  /**
   * Evicts oldest cache entries
   */
  private evictOldestCacheEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    
    // Remove 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
  
  /**
   * Clears all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  // ==========================================================================
  // CHANGE HANDLING
  // ==========================================================================
  
  /**
   * Handles changes from the provider
   */
  private handleProviderChanges(changes: StorageChange[]): void {
    // Invalidate cache for changed keys
    for (const change of changes) {
      if (change.type === 'clear') {
        this.clearCacheArea(change.area);
      } else {
        this.removeFromCache(change.key, change.area);
      }
    }
    
    // Notify listeners
    for (const listener of this.changeListeners) {
      try {
        listener(changes);
      } catch {
        // Ignore listener errors
      }
    }
  }
  
  // ==========================================================================
  // BASIC CRUD OPERATIONS
  // ==========================================================================
  
  /**
   * Gets a value by key
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns Value or null if not found
   */
  async get<T extends StorableValue>(
    key: string,
    area: StorageArea = 'state'
  ): Promise<T | null> {
    // Check cache first
    const cached = this.getFromCache<T>(key, area);
    if (cached !== null) return cached;
    
    // Get from provider
    const value = await this.getProvider().get<T>(key, area);
    
    // Cache the result
    if (value !== null) {
      this.setInCache(key, value, area);
    }
    
    return value;
  }
  
  /**
   * Gets a value with metadata
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns Entry with value and metadata, or null
   */
  async getWithMetadata<T extends StorableValue>(
    key: string,
    area: StorageArea = 'state'
  ): Promise<StorageEntry<T> | null> {
    return this.getProvider().getWithMetadata<T>(key, area);
  }
  
  /**
   * Sets a value by key
   * 
   * @param key - Storage key
   * @param value - Value to store
   * @param area - Storage area
   */
  async set<T extends StorableValue>(
    key: string,
    value: T,
    area: StorageArea = 'state'
  ): Promise<void> {
    await this.getProvider().set(key, value, area);
    this.setInCache(key, value, area);
  }
  
  /**
   * Removes a value by key
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns True if item existed and was removed
   */
  async remove(key: string, area: StorageArea = 'state'): Promise<boolean> {
    const result = await this.getProvider().remove(key, area);
    this.removeFromCache(key, area);
    return result;
  }
  
  /**
   * Checks if a key exists
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns True if key exists
   */
  async has(key: string, area: StorageArea = 'state'): Promise<boolean> {
    // Check cache first
    const cached = this.getFromCache(key, area);
    if (cached !== null) return true;
    
    return this.getProvider().has(key, area);
  }
  
  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================
  
  /**
   * Gets multiple values by keys
   * 
   * @param keys - Array of keys
   * @param area - Storage area
   * @returns Map of key to value
   */
  async getMany<T extends StorableValue>(
    keys: string[],
    area: StorageArea = 'state'
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const uncachedKeys: string[] = [];
    
    // Check cache first
    for (const key of keys) {
      const cached = this.getFromCache<T>(key, area);
      if (cached !== null) {
        result.set(key, cached);
      } else {
        uncachedKeys.push(key);
      }
    }
    
    // Fetch uncached from provider
    if (uncachedKeys.length > 0) {
      const fetched = await this.getProvider().getMany<T>(uncachedKeys, area);
      
      for (const [key, value] of fetched) {
        result.set(key, value);
        this.setInCache(key, value, area);
      }
    }
    
    return result;
  }
  
  /**
   * Sets multiple values
   * 
   * @param entries - Key-value pairs to set
   * @param area - Storage area
   */
  async setMany<T extends StorableValue>(
    entries: Array<{ key: string; value: T }>,
    area: StorageArea = 'state'
  ): Promise<void> {
    await this.getProvider().setMany(entries, area);
    
    // Update cache
    for (const { key, value } of entries) {
      this.setInCache(key, value, area);
    }
  }
  
  /**
   * Removes multiple values by keys
   * 
   * @param keys - Array of keys to remove
   * @param area - Storage area
   * @returns Number of items removed
   */
  async removeMany(
    keys: string[],
    area: StorageArea = 'state'
  ): Promise<number> {
    const count = await this.getProvider().removeMany(keys, area);
    
    // Clear from cache
    for (const key of keys) {
      this.removeFromCache(key, area);
    }
    
    return count;
  }
  
  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================
  
  /**
   * Lists all keys in an area
   * 
   * @param area - Storage area
   * @returns Array of keys
   */
  async keys(area: StorageArea = 'state'): Promise<string[]> {
    return this.getProvider().keys(area);
  }
  
  /**
   * Lists all entries in an area
   * 
   * @param area - Storage area
   * @returns Array of entries
   */
  async entries<T extends StorableValue>(
    area: StorageArea = 'state'
  ): Promise<StorageEntry<T>[]> {
    return this.getProvider().entries<T>(area);
  }
  
  /**
   * Queries entries with filters
   * 
   * @param query - Query options
   * @param area - Storage area
   * @returns Query result with entries and pagination
   */
  async query<T extends StorableValue>(
    query: StorageQuery,
    area: StorageArea = 'state'
  ): Promise<StorageQueryResult<T>> {
    return this.getProvider().query<T>(query, area);
  }
  
  /**
   * Counts entries matching query
   * 
   * @param query - Query options
   * @param area - Storage area
   * @returns Count of matching entries
   */
  async count(
    query?: StorageQuery,
    area: StorageArea = 'state'
  ): Promise<number> {
    return this.getProvider().count(query, area);
  }
  
  // ==========================================================================
  // AREA OPERATIONS
  // ==========================================================================
  
  /**
   * Clears all data in an area
   * 
   * @param area - Storage area to clear
   * @returns Number of items cleared
   */
  async clear(area: StorageArea): Promise<number> {
    const count = await this.getProvider().clear(area);
    this.clearCacheArea(area);
    return count;
  }
  
  /**
   * Clears all data in all areas
   * 
   * @returns Total number of items cleared
   */
  async clearAll(): Promise<number> {
    const count = await this.getProvider().clearAll();
    this.cache.clear();
    return count;
  }
  
  // ==========================================================================
  // CHANGE EVENTS
  // ==========================================================================
  
  /**
   * Subscribes to storage changes
   * 
   * @param listener - Change listener function
   * @returns Unsubscribe function
   */
  onChange(listener: StorageChangeListener): Unsubscribe {
    this.changeListeners.add(listener);
    
    return () => {
      this.changeListeners.delete(listener);
    };
  }
  
  // ==========================================================================
  // QUOTA & STATS
  // ==========================================================================
  
  /**
   * Gets storage quota information
   * 
   * @returns Quota info
   */
  async getQuota(): Promise<StorageQuota> {
    return this.getProvider().getQuota();
  }
  
  /**
   * Gets storage statistics
   * 
   * @returns Storage stats
   */
  async getStats(): Promise<StorageStats> {
    return this.getProvider().getStats();
  }
  
  // ==========================================================================
  // EXPORT/IMPORT
  // ==========================================================================
  
  /**
   * Exports all data for backup
   * 
   * @param areas - Specific areas to export
   * @returns Serialized data blob
   */
  async export(areas?: StorageArea[]): Promise<string> {
    return this.getProvider().export(areas);
  }
  
  /**
   * Imports data from backup
   * 
   * @param data - Serialized data blob
   * @param merge - Whether to merge with existing
   * @returns Import result
   */
  async import(
    data: string,
    merge?: boolean
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    const result = await this.getProvider().import(data, merge);
    
    // Clear cache after import
    this.cache.clear();
    
    return result;
  }
  
  // ==========================================================================
  // MIGRATION
  // ==========================================================================
  
  /**
   * Migrates data from one provider to another
   * 
   * @param sourceProvider - Source provider
   * @param targetProvider - Target provider
   * @param areas - Areas to migrate
   * @returns Migration result
   */
  async migrate(
    sourceProvider: IStorageProvider,
    targetProvider: IStorageProvider,
    areas?: StorageArea[]
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let itemsMigrated = 0;
    let itemsFailed = 0;
    
    const targetAreas: StorageArea[] = areas ?? [
      'testCases',
      'steps',
      'config',
      'state',
      'metadata',
    ];
    
    try {
      for (const area of targetAreas) {
        const entries = await sourceProvider.entries(area);
        
        for (const entry of entries) {
          try {
            await targetProvider.set(entry.key, entry.value, area);
            itemsMigrated++;
          } catch (error) {
            itemsFailed++;
            errors.push(
              `Failed to migrate ${area}:${entry.key}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
      
      return {
        success: itemsFailed === 0,
        itemsMigrated,
        itemsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemsMigrated,
        itemsFailed,
        errors: [
          ...errors,
          `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        duration: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Migrates data to a new provider and switches to it
   * 
   * @param newProvider - New provider to migrate to
   * @param areas - Areas to migrate
   * @returns Migration result
   */
  async migrateAndSwitch(
    newProvider: IStorageProvider,
    areas?: StorageArea[]
  ): Promise<MigrationResult> {
    const currentProvider = this.getProvider();
    
    // Initialize new provider
    await newProvider.initialize();
    
    // Migrate data
    const result = await this.migrate(currentProvider, newProvider, areas);
    
    if (result.success) {
      // Unsubscribe from old provider
      if (this.providerUnsubscribe) {
        this.providerUnsubscribe();
      }
      
      // Close old provider
      await currentProvider.close();
      
      // Switch to new provider
      this.provider = newProvider;
      
      // Subscribe to new provider
      this.providerUnsubscribe = newProvider.onChange((changes) => {
        this.handleProviderChanges(changes);
      });
      
      // Clear cache
      this.cache.clear();
    } else {
      // Rollback - close new provider
      await newProvider.close();
    }
    
    return result;
  }
  
  // ==========================================================================
  // PROVIDER INFO
  // ==========================================================================
  
  /**
   * Gets information about the active provider
   * 
   * @returns Provider info
   */
  getProviderInfo(): ProviderInfo {
    const provider = this.provider;
    
    if (!provider) {
      return {
        type: 'none',
        isReady: false,
        isFallback: false,
      };
    }
    
    let isFallback = false;
    
    if (provider instanceof ChromeStorageProvider) {
      isFallback = provider.isFallbackActive();
    } else if (provider instanceof IndexedDBStorageProvider) {
      isFallback = provider.isFallbackActive();
    }
    
    return {
      type: provider.type,
      isReady: provider.isReady,
      isFallback,
    };
  }
  
  /**
   * Gets the raw provider instance
   * 
   * @returns Provider instance
   */
  getRawProvider(): IStorageProvider {
    return this.getProvider();
  }
  
  /**
   * Gets cache statistics
   * 
   * @returns Cache stats
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheEntries,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance
 */
let instance: StorageManager | null = null;

/**
 * Gets or creates the global StorageManager singleton
 * 
 * @returns StorageManager instance
 */
export function getStorageManager(): StorageManager {
  if (!instance) {
    instance = new StorageManager();
  }
  return instance;
}

/**
 * Creates a new StorageManager instance
 * 
 * @param config - Manager configuration
 * @returns New StorageManager instance
 */
export function createStorageManager(
  config?: StorageManagerConfig
): StorageManager {
  return new StorageManager(config);
}

/**
 * Resets the global singleton (for testing)
 */
export async function resetStorageManager(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Gets a value using the global storage manager
 * 
 * @param key - Storage key
 * @param area - Storage area
 * @returns Value or null
 */
export async function storageGet<T extends StorableValue>(
  key: string,
  area: StorageArea = 'state'
): Promise<T | null> {
  const manager = getStorageManager();
  if (!manager.isReady) {
    await manager.initialize();
  }
  return manager.get<T>(key, area);
}

/**
 * Sets a value using the global storage manager
 * 
 * @param key - Storage key
 * @param value - Value to store
 * @param area - Storage area
 */
export async function storageSet<T extends StorableValue>(
  key: string,
  value: T,
  area: StorageArea = 'state'
): Promise<void> {
  const manager = getStorageManager();
  if (!manager.isReady) {
    await manager.initialize();
  }
  return manager.set(key, value, area);
}

/**
 * Removes a value using the global storage manager
 * 
 * @param key - Storage key
 * @param area - Storage area
 * @returns True if removed
 */
export async function storageRemove(
  key: string,
  area: StorageArea = 'state'
): Promise<boolean> {
  const manager = getStorageManager();
  if (!manager.isReady) {
    await manager.initialize();
  }
  return manager.remove(key, area);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default StorageManager;
