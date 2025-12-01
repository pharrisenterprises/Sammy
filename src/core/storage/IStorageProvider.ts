/**
 * IStorageProvider - Interface for storage backends
 * @module core/storage/IStorageProvider
 * @version 1.0.0
 * 
 * Defines the contract for all storage providers in the system.
 * Supports Chrome extension storage, IndexedDB, and in-memory storage
 * through a unified async API.
 * 
 * Features:
 * - CRUD operations for any serializable data
 * - Namespace/bucket organization
 * - Batch operations for performance
 * - Change event notifications
 * - Storage quota management
 * 
 * @see storage-layer_breakdown.md for architecture details
 */

// ============================================================================
// STORAGE TYPES
// ============================================================================

/**
 * Supported storage backend types
 */
export type StorageType = 
  | 'chrome-local'    // chrome.storage.local
  | 'chrome-sync'     // chrome.storage.sync
  | 'chrome-session'  // chrome.storage.session
  | 'indexeddb'       // IndexedDB
  | 'memory'          // In-memory (volatile)
  | 'file';           // File system (future)

/**
 * Storage area/namespace for data organization
 */
export type StorageArea = 
  | 'testCases'       // Test case definitions
  | 'steps'           // Recorded steps
  | 'config'          // User configuration
  | 'state'           // Runtime state
  | 'cache'           // Temporary cache
  | 'metadata';       // System metadata

/**
 * Serializable value types for storage
 */
export type StorableValue = 
  | string
  | number
  | boolean
  | null
  | StorableValue[]
  | { [key: string]: StorableValue };

/**
 * Key-value pair for batch operations
 */
export interface StorageEntry<T = StorableValue> {
  /** Storage key */
  key: string;
  /** Stored value */
  value: T;
  /** Optional metadata */
  metadata?: StorageMetadata;
}

/**
 * Metadata associated with stored items
 */
export interface StorageMetadata {
  /** Creation timestamp (ms) */
  createdAt: number;
  /** Last update timestamp (ms) */
  updatedAt: number;
  /** Data version for migrations */
  version?: number;
  /** Size in bytes (if available) */
  size?: number;
  /** Content type hint */
  contentType?: string;
  /** Custom tags */
  tags?: string[];
}

// ============================================================================
// QUERY & FILTER TYPES
// ============================================================================

/**
 * Query options for listing/searching
 */
export interface StorageQuery {
  /** Key prefix filter */
  prefix?: string;
  /** Key suffix filter */
  suffix?: string;
  /** Key pattern (glob or regex) */
  pattern?: string | RegExp;
  /** Maximum results */
  limit?: number;
  /** Results offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: 'key' | 'createdAt' | 'updatedAt' | 'size';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Filter by tags */
  tags?: string[];
  /** Created after timestamp */
  createdAfter?: number;
  /** Created before timestamp */
  createdBefore?: number;
  /** Updated after timestamp */
  updatedAfter?: number;
  /** Updated before timestamp */
  updatedBefore?: number;
}

/**
 * Query result with pagination info
 */
export interface StorageQueryResult<T = StorableValue> {
  /** Matching entries */
  entries: StorageEntry<T>[];
  /** Total matching count (before limit) */
  total: number;
  /** Whether more results exist */
  hasMore: boolean;
  /** Offset for next page */
  nextOffset?: number;
}

// ============================================================================
// CHANGE EVENT TYPES
// ============================================================================

/**
 * Type of storage change
 */
export type StorageChangeType = 'set' | 'remove' | 'clear';

/**
 * Storage change event
 */
export interface StorageChange<T = StorableValue> {
  /** Changed key */
  key: string;
  /** Storage area */
  area: StorageArea;
  /** Type of change */
  type: StorageChangeType;
  /** Old value (if available) */
  oldValue?: T;
  /** New value (for set operations) */
  newValue?: T;
  /** Change timestamp */
  timestamp: number;
}

/**
 * Storage change listener
 */
export type StorageChangeListener<T = StorableValue> = (
  changes: StorageChange<T>[]
) => void;

/**
 * Listener unsubscribe function
 */
export type Unsubscribe = () => void;

// ============================================================================
// QUOTA & STATS TYPES
// ============================================================================

/**
 * Storage quota information
 */
export interface StorageQuota {
  /** Total quota in bytes */
  total: number;
  /** Used space in bytes */
  used: number;
  /** Available space in bytes */
  available: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total item count */
  itemCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Size by area */
  sizeByArea: Record<StorageArea, number>;
  /** Item count by area */
  countByArea: Record<StorageArea, number>;
  /** Largest items */
  largestItems: Array<{ key: string; size: number }>;
  /** Last activity timestamp */
  lastActivity: number;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

/**
 * Transaction operation
 */
export interface TransactionOperation<T = StorableValue> {
  /** Operation type */
  type: 'set' | 'remove';
  /** Target key */
  key: string;
  /** Value for set operations */
  value?: T;
  /** Storage area */
  area?: StorageArea;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  /** Whether transaction succeeded */
  success: boolean;
  /** Number of operations completed */
  operationsCompleted: number;
  /** Error if failed */
  error?: Error;
  /** Partial results if some operations failed */
  partialResults?: Array<{
    operation: TransactionOperation;
    success: boolean;
    error?: Error;
  }>;
}

// ============================================================================
// PROVIDER OPTIONS
// ============================================================================

/**
 * Storage provider configuration
 */
export interface StorageProviderOptions {
  /** Provider type */
  type: StorageType;
  /** Default storage area */
  defaultArea?: StorageArea;
  /** Auto-add timestamps to metadata */
  autoTimestamp?: boolean;
  /** Compress large values */
  compression?: boolean;
  /** Compression threshold in bytes */
  compressionThreshold?: number;
  /** Encrypt sensitive data */
  encryption?: boolean;
  /** Encryption key (if encryption enabled) */
  encryptionKey?: string;
  /** Enable change notifications */
  enableChangeEvents?: boolean;
  /** Cache frequently accessed items */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Maximum cache size in bytes */
  maxCacheSize?: number;
  /** IndexedDB database name (for indexeddb type) */
  dbName?: string;
  /** IndexedDB version (for indexeddb type) */
  dbVersion?: number;
}

// ============================================================================
// MAIN INTERFACE
// ============================================================================

/**
 * IStorageProvider - Main storage provider interface
 * 
 * All storage backends must implement this interface to provide
 * a consistent API for data persistence.
 * 
 * @example
 * ```typescript
 * class ChromeStorageProvider implements IStorageProvider {
 *   async get<T>(key: string): Promise<T | null> {
 *     const result = await chrome.storage.local.get(key);
 *     return result[key] ?? null;
 *   }
 *   // ... implement other methods
 * }
 * ```
 */
export interface IStorageProvider {
  // ==========================================================================
  // PROVIDER INFO
  // ==========================================================================
  
  /**
   * Provider type identifier
   */
  readonly type: StorageType;
  
  /**
   * Whether provider is initialized and ready
   */
  readonly isReady: boolean;
  
  /**
   * Provider options
   */
  readonly options: StorageProviderOptions;
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Initializes the storage provider
   * Must be called before any operations
   * 
   * @returns Promise that resolves when ready
   */
  initialize(): Promise<void>;
  
  /**
   * Closes the storage provider and releases resources
   * 
   * @returns Promise that resolves when closed
   */
  close(): Promise<void>;
  
  // ==========================================================================
  // BASIC CRUD OPERATIONS
  // ==========================================================================
  
  /**
   * Gets a value by key
   * 
   * @param key - Storage key
   * @param area - Storage area (optional, uses default)
   * @returns Value or null if not found
   */
  get<T extends StorableValue = StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<T | null>;
  
  /**
   * Gets a value with metadata
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns Entry with value and metadata, or null
   */
  getWithMetadata<T extends StorableValue = StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<StorageEntry<T> | null>;
  
  /**
   * Sets a value by key
   * 
   * @param key - Storage key
   * @param value - Value to store
   * @param area - Storage area
   * @returns Promise that resolves when complete
   */
  set<T extends StorableValue = StorableValue>(
    key: string,
    value: T,
    area?: StorageArea
  ): Promise<void>;
  
  /**
   * Sets a value with custom metadata
   * 
   * @param key - Storage key
   * @param value - Value to store
   * @param metadata - Custom metadata
   * @param area - Storage area
   * @returns Promise that resolves when complete
   */
  setWithMetadata<T extends StorableValue = StorableValue>(
    key: string,
    value: T,
    metadata: Partial<StorageMetadata>,
    area?: StorageArea
  ): Promise<void>;
  
  /**
   * Removes a value by key
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns True if item existed and was removed
   */
  remove(key: string, area?: StorageArea): Promise<boolean>;
  
  /**
   * Checks if a key exists
   * 
   * @param key - Storage key
   * @param area - Storage area
   * @returns True if key exists
   */
  has(key: string, area?: StorageArea): Promise<boolean>;
  
  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================
  
  /**
   * Gets multiple values by keys
   * 
   * @param keys - Array of keys
   * @param area - Storage area
   * @returns Map of key to value (missing keys not included)
   */
  getMany<T extends StorableValue = StorableValue>(
    keys: string[],
    area?: StorageArea
  ): Promise<Map<string, T>>;
  
  /**
   * Sets multiple values
   * 
   * @param entries - Key-value pairs to set
   * @param area - Storage area
   * @returns Promise that resolves when complete
   */
  setMany<T extends StorableValue = StorableValue>(
    entries: Array<{ key: string; value: T }>,
    area?: StorageArea
  ): Promise<void>;
  
  /**
   * Removes multiple values by keys
   * 
   * @param keys - Array of keys to remove
   * @param area - Storage area
   * @returns Number of items removed
   */
  removeMany(keys: string[], area?: StorageArea): Promise<number>;
  
  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================
  
  /**
   * Lists all keys in an area
   * 
   * @param area - Storage area
   * @returns Array of keys
   */
  keys(area?: StorageArea): Promise<string[]>;
  
  /**
   * Lists all entries in an area
   * 
   * @param area - Storage area
   * @returns Array of entries
   */
  entries<T extends StorableValue = StorableValue>(
    area?: StorageArea
  ): Promise<StorageEntry<T>[]>;
  
  /**
   * Queries entries with filters
   * 
   * @param query - Query options
   * @param area - Storage area
   * @returns Query result with entries and pagination
   */
  query<T extends StorableValue = StorableValue>(
    query: StorageQuery,
    area?: StorageArea
  ): Promise<StorageQueryResult<T>>;
  
  /**
   * Counts entries matching query
   * 
   * @param query - Query options (limit/offset ignored)
   * @param area - Storage area
   * @returns Count of matching entries
   */
  count(query?: StorageQuery, area?: StorageArea): Promise<number>;
  
  // ==========================================================================
  // AREA OPERATIONS
  // ==========================================================================
  
  /**
   * Clears all data in an area
   * 
   * @param area - Storage area to clear
   * @returns Number of items cleared
   */
  clear(area: StorageArea): Promise<number>;
  
  /**
   * Clears all data in all areas
   * 
   * @returns Total number of items cleared
   */
  clearAll(): Promise<number>;
  
  // ==========================================================================
  // TRANSACTION OPERATIONS
  // ==========================================================================
  
  /**
   * Executes multiple operations atomically
   * 
   * @param operations - Array of operations
   * @returns Transaction result
   */
  transaction(operations: TransactionOperation[]): Promise<TransactionResult>;
  
  // ==========================================================================
  // QUOTA & STATS
  // ==========================================================================
  
  /**
   * Gets storage quota information
   * 
   * @returns Quota info
   */
  getQuota(): Promise<StorageQuota>;
  
  /**
   * Gets storage statistics
   * 
   * @returns Storage stats
   */
  getStats(): Promise<StorageStats>;
  
  // ==========================================================================
  // CHANGE EVENTS
  // ==========================================================================
  
  /**
   * Subscribes to storage changes
   * 
   * @param listener - Change listener function
   * @param area - Optional area filter
   * @returns Unsubscribe function
   */
  onChange<T extends StorableValue = StorableValue>(
    listener: StorageChangeListener<T>,
    area?: StorageArea
  ): Unsubscribe;
  
  // ==========================================================================
  // IMPORT/EXPORT
  // ==========================================================================
  
  /**
   * Exports all data for backup
   * 
   * @param areas - Specific areas to export (all if not specified)
   * @returns Serialized data blob
   */
  export(areas?: StorageArea[]): Promise<string>;
  
  /**
   * Imports data from backup
   * 
   * @param data - Serialized data blob
   * @param merge - Whether to merge with existing (true) or replace (false)
   * @returns Import result with counts
   */
  import(
    data: string,
    merge?: boolean
  ): Promise<{ imported: number; skipped: number; errors: number }>;
}

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

/**
 * Abstract base class with common functionality
 * 
 * Provides default implementations for some methods and
 * utility functions for derived classes.
 */
export abstract class BaseStorageProvider implements IStorageProvider {
  abstract readonly type: StorageType;
  
  protected _isReady: boolean = false;
  protected _options: StorageProviderOptions;
  protected _listeners: Map<StorageArea | '*', Set<StorageChangeListener>> = new Map();
  
  get isReady(): boolean {
    return this._isReady;
  }
  
  get options(): StorageProviderOptions {
    return this._options;
  }
  
  constructor(options: StorageProviderOptions) {
    this._options = {
      defaultArea: 'state',
      autoTimestamp: true,
      compression: false,
      compressionThreshold: 1024,
      encryption: false,
      enableChangeEvents: true,
      enableCache: false,
      cacheTtl: 60000,
      maxCacheSize: 1024 * 1024,
      ...options,
    };
  }
  
  // Abstract methods to be implemented
  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract get<T extends StorableValue>(key: string, area?: StorageArea): Promise<T | null>;
  abstract set<T extends StorableValue>(key: string, value: T, area?: StorageArea): Promise<void>;
  abstract remove(key: string, area?: StorageArea): Promise<boolean>;
  abstract has(key: string, area?: StorageArea): Promise<boolean>;
  abstract keys(area?: StorageArea): Promise<string[]>;
  abstract clear(area: StorageArea): Promise<number>;
  abstract getQuota(): Promise<StorageQuota>;
  
  // Default implementations
  
  async getWithMetadata<T extends StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<StorageEntry<T> | null> {
    const value = await this.get<T>(key, area);
    if (value === null) return null;
    
    return {
      key,
      value,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }
  
  async setWithMetadata<T extends StorableValue>(
    key: string,
    value: T,
    _metadata: Partial<StorageMetadata>,
    area?: StorageArea
  ): Promise<void> {
    await this.set(key, value, area);
  }
  
  async getMany<T extends StorableValue>(
    keys: string[],
    area?: StorageArea
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    
    await Promise.all(
      keys.map(async key => {
        const value = await this.get<T>(key, area);
        if (value !== null) {
          result.set(key, value);
        }
      })
    );
    
    return result;
  }
  
  async setMany<T extends StorableValue>(
    entries: Array<{ key: string; value: T }>,
    area?: StorageArea
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, value }) => this.set(key, value, area))
    );
  }
  
  async removeMany(keys: string[], area?: StorageArea): Promise<number> {
    let removed = 0;
    
    await Promise.all(
      keys.map(async key => {
        const wasRemoved = await this.remove(key, area);
        if (wasRemoved) removed++;
      })
    );
    
    return removed;
  }
  
  async entries<T extends StorableValue>(
    area?: StorageArea
  ): Promise<StorageEntry<T>[]> {
    const allKeys = await this.keys(area);
    const entries: StorageEntry<T>[] = [];
    
    for (const key of allKeys) {
      const value = await this.get<T>(key, area);
      if (value !== null) {
        entries.push({ key, value });
      }
    }
    
    return entries;
  }
  
  async query<T extends StorableValue>(
    query: StorageQuery,
    area?: StorageArea
  ): Promise<StorageQueryResult<T>> {
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
    
    // Sort
    if (query.sortBy === 'key') {
      allEntries.sort((a, b) => a.key.localeCompare(b.key));
    }
    if (query.sortOrder === 'desc') {
      allEntries.reverse();
    }
    
    const total = allEntries.length;
    const offset = query.offset || 0;
    const limit = query.limit || allEntries.length;
    
    const entries = allEntries.slice(offset, offset + limit);
    const hasMore = offset + entries.length < total;
    
    return {
      entries,
      total,
      hasMore,
      nextOffset: hasMore ? offset + entries.length : undefined,
    };
  }
  
  async count(query?: StorageQuery, area?: StorageArea): Promise<number> {
    if (!query) {
      const allKeys = await this.keys(area);
      return allKeys.length;
    }
    
    const result = await this.query(query, area);
    return result.total;
  }
  
  async clearAll(): Promise<number> {
    const areas: StorageArea[] = [
      'testCases',
      'steps',
      'config',
      'state',
      'cache',
      'metadata',
    ];
    
    let total = 0;
    for (const area of areas) {
      total += await this.clear(area);
    }
    
    return total;
  }
  
  async transaction(operations: TransactionOperation[]): Promise<TransactionResult> {
    const partialResults: TransactionResult['partialResults'] = [];
    let operationsCompleted = 0;
    
    try {
      for (const op of operations) {
        try {
          if (op.type === 'set' && op.value !== undefined) {
            await this.set(op.key, op.value, op.area);
          } else if (op.type === 'remove') {
            await this.remove(op.key, op.area);
          }
          
          partialResults.push({ operation: op, success: true });
          operationsCompleted++;
        } catch (error) {
          partialResults.push({
            operation: op,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
      
      return {
        success: operationsCompleted === operations.length,
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
    const totalSize = 0;
    let itemCount = 0;
    
    for (const area of areas) {
      const keys = await this.keys(area);
      countByArea[area] = keys.length;
      sizeByArea[area] = 0; // Size estimation would require implementation
      itemCount += keys.length;
    }
    
    return {
      itemCount,
      totalSize,
      sizeByArea,
      countByArea,
      largestItems: [],
      lastActivity: Date.now(),
    };
  }
  
  onChange<T extends StorableValue>(
    listener: StorageChangeListener<T>,
    area?: StorageArea
  ): Unsubscribe {
    const key = area || '*';
    
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    
    this._listeners.get(key)!.add(listener as StorageChangeListener);
    
    return () => {
      this._listeners.get(key)?.delete(listener as StorageChangeListener);
    };
  }
  
  protected notifyListeners(changes: StorageChange[]): void {
    if (!this._options.enableChangeEvents) return;
    
    // Notify area-specific listeners
    for (const change of changes) {
      const areaListeners = this._listeners.get(change.area);
      if (areaListeners) {
        for (const listener of areaListeners) {
          try {
            listener([change]);
          } catch {
            // Ignore listener errors
          }
        }
      }
    }
    
    // Notify global listeners
    const globalListeners = this._listeners.get('*');
    if (globalListeners) {
      for (const listener of globalListeners) {
        try {
          listener(changes);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }
  
  async export(areas?: StorageArea[]): Promise<string> {
    const targetAreas = areas || [
      'testCases',
      'steps',
      'config',
      'state',
      'metadata',
    ];
    
    const data: Record<string, StorageEntry[]> = {};
    
    for (const area of targetAreas) {
      data[area] = await this.entries(area);
    }
    
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      data,
    });
  }
  
  async import(
    dataStr: string,
    merge: boolean = true
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    try {
      const { data } = JSON.parse(dataStr);
      
      for (const [area, entries] of Object.entries(data)) {
        for (const entry of entries as StorageEntry[]) {
          try {
            const exists = await this.has(entry.key, area as StorageArea);
            
            if (exists && !merge) {
              skipped++;
              continue;
            }
            
            await this.set(entry.key, entry.value, area as StorageArea);
            imported++;
          } catch {
            errors++;
          }
        }
      }
    } catch {
      errors++;
    }
    
    return { imported, skipped, errors };
  }
  
  /**
   * Gets the effective area (uses default if not specified)
   */
  protected getArea(area?: StorageArea): StorageArea {
    return area || this._options.defaultArea || 'state';
  }
  
  /**
   * Builds a namespaced key
   */
  protected buildKey(key: string, area: StorageArea): string {
    return `${area}:${key}`;
  }
  
  /**
   * Parses a namespaced key
   */
  protected parseKey(namespacedKey: string): { area: StorageArea; key: string } {
    const colonIndex = namespacedKey.indexOf(':');
    if (colonIndex === -1) {
      return { area: 'state', key: namespacedKey };
    }
    
    return {
      area: namespacedKey.substring(0, colonIndex) as StorageArea,
      key: namespacedKey.substring(colonIndex + 1),
    };
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for StorableValue
 */
export function isStorableValue(value: unknown): value is StorableValue {
  if (value === null) return true;
  if (typeof value === 'string') return true;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  
  if (Array.isArray(value)) {
    return value.every(isStorableValue);
  }
  
  if (typeof value === 'object') {
    return Object.values(value as object).every(isStorableValue);
  }
  
  return false;
}

/**
 * Type guard for StorageArea
 */
export function isStorageArea(value: string): value is StorageArea {
  return [
    'testCases',
    'steps',
    'config',
    'state',
    'cache',
    'metadata',
  ].includes(value);
}

/**
 * Type guard for StorageType
 */
export function isStorageType(value: string): value is StorageType {
  return [
    'chrome-local',
    'chrome-sync',
    'chrome-session',
    'indexeddb',
    'memory',
    'file',
  ].includes(value);
}
