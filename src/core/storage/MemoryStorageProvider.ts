/**
 * MemoryStorageProvider - In-memory storage implementation
 * @module core/storage/MemoryStorageProvider
 * @version 1.0.0
 * 
 * Volatile in-memory storage provider for testing, development,
 * and temporary session data. All data is lost on page refresh
 * or extension reload.
 * 
 * Features:
 * - Fast Map-based storage
 * - Full metadata support
 * - Accurate size tracking
 * - TTL (time-to-live) support for cache entries
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
 * Default memory quota (50MB)
 */
export const DEFAULT_MEMORY_QUOTA = 50 * 1024 * 1024;

/**
 * Default TTL for cache area (5 minutes)
 */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Cleanup interval for expired entries (1 minute)
 */
export const CLEANUP_INTERVAL = 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Internal storage entry with full metadata
 */
interface InternalEntry<T = StorableValue> {
  /** Stored value */
  value: T;
  /** Entry metadata */
  metadata: StorageMetadata;
  /** Storage area */
  area: StorageArea;
  /** Expiration timestamp (for TTL) */
  expiresAt?: number;
}

/**
 * Memory provider specific options
 */
export interface MemoryStorageOptions extends Partial<StorageProviderOptions> {
  /** Maximum memory quota in bytes */
  maxQuota?: number;
  /** Default TTL for cache area (ms) */
  cacheTtl?: number;
  /** Enable automatic cleanup of expired entries */
  enableCleanup?: boolean;
  /** Cleanup interval in ms */
  cleanupInterval?: number;
  /** Initial data to populate */
  initialData?: Record<string, Record<string, StorableValue>>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimates the size of a value in bytes
 * 
 * @param value - Value to measure
 * @returns Estimated size in bytes
 */
export function estimateSize(value: StorableValue): number {
  if (value === null) return 4;
  
  switch (typeof value) {
    case 'boolean':
      return 4;
    case 'number':
      return 8;
    case 'string':
      return value.length * 2; // UTF-16
    case 'object':
      if (Array.isArray(value)) {
        let arraySize = 8;
        for (const item of value) {
          arraySize += estimateSize(item);
        }
        return arraySize;
      }
      let objectSize = 8;
      for (const [key, val] of Object.entries(value)) {
        objectSize += key.length * 2 + estimateSize(val);
      }
      return objectSize;
    default:
      return 0;
  }
}

/**
 * Deep clones a storable value
 * 
 * @param value - Value to clone
 * @returns Cloned value
 */
export function deepClone<T extends StorableValue>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as T;
  }
  
  const cloned: Record<string, StorableValue> = {};
  for (const [key, val] of Object.entries(value)) {
    cloned[key] = deepClone(val);
  }
  return cloned as T;
}

/**
 * Matches a key against a query pattern
 * 
 * @param key - Key to test
 * @param pattern - Pattern (string glob or RegExp)
 * @returns True if matches
 */
export function matchesPattern(key: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(key);
  }
  
  // Simple glob pattern support (* matches anything)
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regexStr}$`).test(key);
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * MemoryStorageProvider - In-memory storage implementation
 * 
 * Provides a fully functional storage backend using JavaScript Maps.
 * Ideal for testing, development, and volatile session data.
 * 
 * @example
 * ```typescript
 * const storage = new MemoryStorageProvider();
 * await storage.initialize();
 * 
 * await storage.set('key', { data: 'value' }, 'testCases');
 * const result = await storage.get('key', 'testCases');
 * ```
 */
export class MemoryStorageProvider extends BaseStorageProvider {
  /**
   * Storage type identifier
   */
  readonly type: StorageType = 'memory';
  
  /**
   * Internal storage map (namespaced key -> entry)
   */
  private store: Map<string, InternalEntry> = new Map();
  
  /**
   * Current total size in bytes
   */
  private currentSize: number = 0;
  
  /**
   * Maximum quota in bytes
   */
  private maxQuota: number;
  
  /**
   * TTL for cache entries
   */
  private cacheTtl: number;
  
  /**
   * Cleanup timer reference
   */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  
  /**
   * Creates a new MemoryStorageProvider
   * 
   * @param options - Provider options
   */
  constructor(options: MemoryStorageOptions = {}) {
    super({
      type: 'memory',
      defaultArea: 'state',
      autoTimestamp: true,
      enableChangeEvents: true,
      ...options,
    });
    
    this.maxQuota = options.maxQuota ?? DEFAULT_MEMORY_QUOTA;
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Initializes the memory storage provider
   */
  async initialize(): Promise<void> {
    if (this._isReady) return;
    
    // Load initial data if provided
    const options = this._options as MemoryStorageOptions;
    if (options.initialData) {
      for (const [area, entries] of Object.entries(options.initialData)) {
        for (const [key, value] of Object.entries(entries)) {
          await this.set(key, value, area as StorageArea);
        }
      }
    }
    
    // Start cleanup timer if enabled
    if ((options as MemoryStorageOptions).enableCleanup !== false) {
      const interval = (options as MemoryStorageOptions).cleanupInterval ?? CLEANUP_INTERVAL;
      this.cleanupTimer = setInterval(() => this.cleanupExpired(), interval);
    }
    
    this._isReady = true;
  }
  
  /**
   * Closes the memory storage provider
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.store.clear();
    this.currentSize = 0;
    this._isReady = false;
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
    const fullKey = this.buildKey(key, this.getArea(area));
    const entry = this.store.get(fullKey);
    
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(fullKey);
      this.currentSize -= estimateSize(entry.value);
      return null;
    }
    
    // Return deep clone to prevent external mutation
    return deepClone(entry.value) as T;
  }
  
  /**
   * Gets a value with metadata
   */
  async getWithMetadata<T extends StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<StorageEntry<T> | null> {
    const fullKey = this.buildKey(key, this.getArea(area));
    const entry = this.store.get(fullKey);
    
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(fullKey);
      this.currentSize -= estimateSize(entry.value);
      return null;
    }
    
    return {
      key,
      value: deepClone(entry.value) as T,
      metadata: { ...entry.metadata },
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
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildKey(key, effectiveArea);
    const now = Date.now();
    
    // Calculate size change
    const newSize = estimateSize(value);
    const existingEntry = this.store.get(fullKey);
    const oldSize = existingEntry ? estimateSize(existingEntry.value) : 0;
    const sizeDelta = newSize - oldSize;
    
    // Check quota
    if (this.currentSize + sizeDelta > this.maxQuota) {
      throw new Error(`Storage quota exceeded. Required: ${sizeDelta}, Available: ${this.maxQuota - this.currentSize}`);
    }
    
    // Determine TTL for cache area
    let expiresAt: number | undefined;
    if (effectiveArea === 'cache') {
      expiresAt = now + this.cacheTtl;
    }
    
    // Create entry
    const entry: InternalEntry<T> = {
      value: deepClone(value),
      area: effectiveArea,
      expiresAt,
      metadata: {
        createdAt: existingEntry?.metadata.createdAt ?? now,
        updatedAt: now,
        size: newSize,
        version: (existingEntry?.metadata.version ?? 0) + 1,
      },
    };
    
    // Store
    const oldValue = existingEntry?.value;
    this.store.set(fullKey, entry);
    this.currentSize += sizeDelta;
    
    // Notify listeners
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'set',
      oldValue: oldValue ? deepClone(oldValue) : undefined,
      newValue: deepClone(value),
      timestamp: now,
    }]);
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
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildKey(key, effectiveArea);
    const now = Date.now();
    
    // Calculate size
    const newSize = estimateSize(value);
    const existingEntry = this.store.get(fullKey);
    const oldSize = existingEntry ? estimateSize(existingEntry.value) : 0;
    const sizeDelta = newSize - oldSize;
    
    // Check quota
    if (this.currentSize + sizeDelta > this.maxQuota) {
      throw new Error('Storage quota exceeded');
    }
    
    // Create entry with custom metadata
    const entry: InternalEntry<T> = {
      value: deepClone(value),
      area: effectiveArea,
      metadata: {
        createdAt: metadata.createdAt ?? existingEntry?.metadata.createdAt ?? now,
        updatedAt: metadata.updatedAt ?? now,
        size: newSize,
        version: metadata.version ?? (existingEntry?.metadata.version ?? 0) + 1,
        contentType: metadata.contentType,
        tags: metadata.tags ? [...metadata.tags] : undefined,
      },
    };
    
    const oldValue = existingEntry?.value;
    this.store.set(fullKey, entry);
    this.currentSize += sizeDelta;
    
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'set',
      oldValue: oldValue ? deepClone(oldValue) : undefined,
      newValue: deepClone(value),
      timestamp: now,
    }]);
  }
  
  /**
   * Removes a value by key
   */
  async remove(key: string, area?: StorageArea): Promise<boolean> {
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildKey(key, effectiveArea);
    const entry = this.store.get(fullKey);
    
    if (!entry) return false;
    
    this.store.delete(fullKey);
    this.currentSize -= estimateSize(entry.value);
    
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'remove',
      oldValue: deepClone(entry.value),
      timestamp: Date.now(),
    }]);
    
    return true;
  }
  
  /**
   * Checks if a key exists
   */
  async has(key: string, area?: StorageArea): Promise<boolean> {
    const fullKey = this.buildKey(key, this.getArea(area));
    const entry = this.store.get(fullKey);
    
    if (!entry) return false;
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(fullKey);
      this.currentSize -= estimateSize(entry.value);
      return false;
    }
    
    return true;
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
    const result = new Map<string, T>();
    const effectiveArea = this.getArea(area);
    
    for (const key of keys) {
      const value = await this.get<T>(key, effectiveArea);
      if (value !== null) {
        result.set(key, value);
      }
    }
    
    return result;
  }
  
  /**
   * Sets multiple values
   */
  async setMany<T extends StorableValue>(
    entries: Array<{ key: string; value: T }>,
    area?: StorageArea
  ): Promise<void> {
    const effectiveArea = this.getArea(area);
    const changes: StorageChange[] = [];
    const now = Date.now();
    
    for (const { key, value } of entries) {
      const fullKey = this.buildKey(key, effectiveArea);
      const existingEntry = this.store.get(fullKey);
      
      const newSize = estimateSize(value);
      const oldSize = existingEntry ? estimateSize(existingEntry.value) : 0;
      
      const entry: InternalEntry<T> = {
        value: deepClone(value),
        area: effectiveArea,
        metadata: {
          createdAt: existingEntry?.metadata.createdAt ?? now,
          updatedAt: now,
          size: newSize,
        },
      };
      
      this.store.set(fullKey, entry);
      this.currentSize += (newSize - oldSize);
      
      changes.push({
        key,
        area: effectiveArea,
        type: 'set',
        oldValue: existingEntry ? deepClone(existingEntry.value) : undefined,
        newValue: deepClone(value),
        timestamp: now,
      });
    }
    
    if (changes.length > 0) {
      this.notifyListeners(changes);
    }
  }
  
  /**
   * Removes multiple values by keys
   */
  async removeMany(keys: string[], area?: StorageArea): Promise<number> {
    const effectiveArea = this.getArea(area);
    const changes: StorageChange[] = [];
    let removed = 0;
    const now = Date.now();
    
    for (const key of keys) {
      const fullKey = this.buildKey(key, effectiveArea);
      const entry = this.store.get(fullKey);
      
      if (entry) {
        this.store.delete(fullKey);
        this.currentSize -= estimateSize(entry.value);
        removed++;
        
        changes.push({
          key,
          area: effectiveArea,
          type: 'remove',
          oldValue: deepClone(entry.value),
          timestamp: now,
        });
      }
    }
    
    if (changes.length > 0) {
      this.notifyListeners(changes);
    }
    
    return removed;
  }
  
  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================
  
  /**
   * Lists all keys in an area
   */
  async keys(area?: StorageArea): Promise<string[]> {
    const effectiveArea = this.getArea(area);
    const prefix = `${effectiveArea}:`;
    const result: string[] = [];
    const now = Date.now();
    
    for (const [fullKey, entry] of this.store) {
      if (!fullKey.startsWith(prefix)) continue;
      
      // Skip expired entries
      if (entry.expiresAt && entry.expiresAt < now) continue;
      
      result.push(fullKey.substring(prefix.length));
    }
    
    return result;
  }
  
  /**
   * Lists all entries in an area
   */
  async entries<T extends StorableValue>(
    area?: StorageArea
  ): Promise<StorageEntry<T>[]> {
    const effectiveArea = this.getArea(area);
    const prefix = `${effectiveArea}:`;
    const result: StorageEntry<T>[] = [];
    const now = Date.now();
    
    for (const [fullKey, entry] of this.store) {
      if (!fullKey.startsWith(prefix)) continue;
      
      // Skip expired entries
      if (entry.expiresAt && entry.expiresAt < now) continue;
      
      result.push({
        key: fullKey.substring(prefix.length),
        value: deepClone(entry.value) as T,
        metadata: { ...entry.metadata },
      });
    }
    
    return result;
  }
  
  /**
   * Queries entries with filters
   */
  async query<T extends StorableValue>(
    query: StorageQuery,
    area?: StorageArea
  ): Promise<StorageQueryResult<T>> {
    const effectiveArea = this.getArea(area);
    let allEntries = await this.entries<T>(effectiveArea);
    
    // Apply filters
    if (query.prefix) {
      allEntries = allEntries.filter(e => e.key.startsWith(query.prefix!));
    }
    
    if (query.suffix) {
      allEntries = allEntries.filter(e => e.key.endsWith(query.suffix!));
    }
    
    if (query.pattern) {
      allEntries = allEntries.filter(e => matchesPattern(e.key, query.pattern!));
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
    
    if (query.updatedAfter !== undefined) {
      allEntries = allEntries.filter(e =>
        e.metadata && e.metadata.updatedAt >= query.updatedAfter!
      );
    }
    
    if (query.updatedBefore !== undefined) {
      allEntries = allEntries.filter(e =>
        e.metadata && e.metadata.updatedAt <= query.updatedBefore!
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
    
    // Include or exclude metadata
    const resultEntries = query.includeMetadata === false
      ? entries.map(e => ({ key: e.key, value: e.value }))
      : entries;
    
    return {
      entries: resultEntries,
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
    const prefix = `${area}:`;
    const keysToDelete: string[] = [];
    const changes: StorageChange[] = [];
    const now = Date.now();
    
    for (const [fullKey, entry] of this.store) {
      if (fullKey.startsWith(prefix)) {
        keysToDelete.push(fullKey);
        this.currentSize -= estimateSize(entry.value);
        
        changes.push({
          key: fullKey.substring(prefix.length),
          area,
          type: 'remove',
          oldValue: deepClone(entry.value),
          timestamp: now,
        });
      }
    }
    
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
    
    if (changes.length > 0) {
      this.notifyListeners([{
        key: '*',
        area,
        type: 'clear',
        timestamp: now,
      }]);
    }
    
    return keysToDelete.length;
  }
  
  /**
   * Clears all data in all areas
   */
  async clearAll(): Promise<number> {
    const count = this.store.size;
    this.store.clear();
    this.currentSize = 0;
    
    return count;
  }
  
  // ==========================================================================
  // TRANSACTION OPERATIONS
  // ==========================================================================
  
  /**
   * Executes multiple operations atomically
   */
  async transaction(operations: TransactionOperation[]): Promise<TransactionResult> {
    // Create snapshot for rollback
    const snapshot = new Map(this.store);
    const snapshotSize = this.currentSize;
    
    const partialResults: TransactionResult['partialResults'] = [];
    let operationsCompleted = 0;
    
    try {
      for (const op of operations) {
        try {
          const effectiveArea = op.area ?? this.getArea(undefined);
          
          if (op.type === 'set' && op.value !== undefined) {
            await this.set(op.key, op.value, effectiveArea);
          } else if (op.type === 'remove') {
            await this.remove(op.key, effectiveArea);
          }
          
          partialResults.push({ operation: op, success: true });
          operationsCompleted++;
        } catch (error) {
          // Rollback on error
          this.store = snapshot;
          this.currentSize = snapshotSize;
          
          partialResults.push({
            operation: op,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          
          return {
            success: false,
            operationsCompleted,
            error: error instanceof Error ? error : new Error(String(error)),
            partialResults,
          };
        }
      }
      
      return {
        success: true,
        operationsCompleted,
        partialResults,
      };
    } catch (error) {
      // Rollback on unexpected error
      this.store = snapshot;
      this.currentSize = snapshotSize;
      
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
    return {
      total: this.maxQuota,
      used: this.currentSize,
      available: this.maxQuota - this.currentSize,
      usagePercent: (this.currentSize / this.maxQuota) * 100,
    };
  }
  
  /**
   * Gets storage statistics
   */
  async getStats(): Promise<StorageStats> {
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
    
    for (const area of areas) {
      countByArea[area] = 0;
      sizeByArea[area] = 0;
    }
    
    for (const [fullKey, entry] of this.store) {
      const { area, key } = this.parseKey(fullKey);
      const size = estimateSize(entry.value);
      
      countByArea[area]++;
      sizeByArea[area] += size;
      
      largestItems.push({ key: `${area}:${key}`, size });
      
      if (entry.metadata.updatedAt > lastActivity) {
        lastActivity = entry.metadata.updatedAt;
      }
    }
    
    // Sort and limit largest items
    largestItems.sort((a, b) => b.size - a.size);
    const topLargest = largestItems.slice(0, 10);
    
    return {
      itemCount: this.store.size,
      totalSize: this.currentSize,
      sizeByArea,
      countByArea,
      largestItems: topLargest,
      lastActivity,
    };
  }
  
  // ==========================================================================
  // MEMORY-SPECIFIC METHODS
  // ==========================================================================
  
  /**
   * Removes expired cache entries
   * 
   * @returns Number of entries removed
   */
  cleanupExpired(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && entry.expiresAt < now) {
        keysToDelete.push(key);
        this.currentSize -= estimateSize(entry.value);
      }
    }
    
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
    
    return keysToDelete.length;
  }
  
  /**
   * Sets a value with TTL
   * 
   * @param key - Storage key
   * @param value - Value to store
   * @param ttl - Time to live in milliseconds
   * @param area - Storage area
   */
  async setWithTtl<T extends StorableValue>(
    key: string,
    value: T,
    ttl: number,
    area?: StorageArea
  ): Promise<void> {
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildKey(key, effectiveArea);
    const now = Date.now();
    
    const newSize = estimateSize(value);
    const existingEntry = this.store.get(fullKey);
    const oldSize = existingEntry ? estimateSize(existingEntry.value) : 0;
    
    const entry: InternalEntry<T> = {
      value: deepClone(value),
      area: effectiveArea,
      expiresAt: now + ttl,
      metadata: {
        createdAt: existingEntry?.metadata.createdAt ?? now,
        updatedAt: now,
        size: newSize,
      },
    };
    
    this.store.set(fullKey, entry);
    this.currentSize += (newSize - oldSize);
  }
  
  /**
   * Gets the remaining TTL for a key
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns Remaining TTL in ms, or -1 if no TTL, or null if not found
   */
  async getTtl(key: string, area?: StorageArea): Promise<number | null> {
    const fullKey = this.buildKey(key, this.getArea(area));
    const entry = this.store.get(fullKey);
    
    if (!entry) return null;
    if (!entry.expiresAt) return -1;
    
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }
  
  /**
   * Gets raw internal storage size
   * 
   * @returns Number of entries in store
   */
  get size(): number {
    return this.store.size;
  }
  
  /**
   * Gets current memory usage
   * 
   * @returns Current size in bytes
   */
  get memoryUsage(): number {
    return this.currentSize;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Singleton instance
 */
let instance: MemoryStorageProvider | null = null;

/**
 * Gets or creates the global MemoryStorageProvider singleton
 * 
 * @returns MemoryStorageProvider instance
 */
export function getMemoryStorage(): MemoryStorageProvider {
  if (!instance) {
    instance = new MemoryStorageProvider();
  }
  return instance;
}

/**
 * Creates a new MemoryStorageProvider instance
 * 
 * @param options - Provider options
 * @returns New MemoryStorageProvider instance
 */
export function createMemoryStorage(options?: MemoryStorageOptions): MemoryStorageProvider {
  return new MemoryStorageProvider(options);
}

/**
 * Resets the global singleton (for testing)
 */
export function resetMemoryStorage(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default MemoryStorageProvider;
