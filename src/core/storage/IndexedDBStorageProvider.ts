/**
 * IndexedDBStorageProvider - IndexedDB storage implementation
 * @module core/storage/IndexedDBStorageProvider
 * @version 1.0.0
 * 
 * Large-capacity persistent storage using IndexedDB. Ideal for
 * storing test cases, recorded steps, and other data that may
 * exceed Chrome storage limits.
 * 
 * Features:
 * - Virtually unlimited storage capacity
 * - Indexed fields for fast queries
 * - Object stores per storage area
 * - Transaction support
 * - Database versioning and migrations
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
 * Default database name
 */
export const DEFAULT_DB_NAME = 'copilot-storage';

/**
 * Default database version
 */
export const DEFAULT_DB_VERSION = 1;

/**
 * Object store names (one per storage area)
 */
export const STORE_NAMES: Record<StorageArea, string> = {
  testCases: 'testCases',
  steps: 'steps',
  config: 'config',
  state: 'state',
  cache: 'cache',
  metadata: 'metadata',
};

/**
 * Index names for querying
 */
export const INDEX_NAMES = {
  createdAt: 'idx_createdAt',
  updatedAt: 'idx_updatedAt',
  tags: 'idx_tags',
} as const;

/**
 * Default quota estimate (500MB)
 */
export const DEFAULT_QUOTA_ESTIMATE = 500 * 1024 * 1024;

// ============================================================================
// TYPES
// ============================================================================

/**
 * IndexedDB provider specific options
 */
export interface IndexedDBStorageOptions extends Partial<StorageProviderOptions> {
  /** Database name */
  dbName?: string;
  /** Database version */
  dbVersion?: number;
  /** Fallback provider when IndexedDB unavailable */
  fallbackProvider?: BaseStorageProvider;
}

/**
 * Internal record format stored in IndexedDB
 */
interface StoredRecord<T = StorableValue> {
  /** Primary key */
  key: string;
  /** Stored value */
  value: T;
  /** Record metadata */
  metadata: StorageMetadata;
}

// ============================================================================
// INDEXEDDB DETECTION
// ============================================================================

/**
 * Checks if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return (
      typeof indexedDB !== 'undefined' &&
      indexedDB !== null
    );
  } catch {
    return false;
  }
}

// ============================================================================
// PROMISE WRAPPERS
// ============================================================================

/**
 * Wraps IDBRequest in a Promise
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Wraps IDBTransaction completion in a Promise
 */
export function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });
}

/**
 * Opens an IndexedDB database
 */
export function openDatabase(
  name: string,
  version: number,
  onUpgrade?: (db: IDBDatabase, oldVersion: number, newVersion: number | null) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;
      
      if (onUpgrade) {
        onUpgrade(db, oldVersion, newVersion);
      }
    };
  });
}

/**
 * Deletes an IndexedDB database
 */
export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimates the size of a value
 */
export function estimateSize(value: StorableValue): number {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
}

/**
 * Creates object stores for all storage areas
 */
function createObjectStores(db: IDBDatabase): void {
  const areas: StorageArea[] = [
    'testCases',
    'steps',
    'config',
    'state',
    'cache',
    'metadata',
  ];
  
  for (const area of areas) {
    if (!db.objectStoreNames.contains(area)) {
      const store = db.createObjectStore(area, { keyPath: 'key' });
      
      // Create indexes
      store.createIndex(INDEX_NAMES.createdAt, 'metadata.createdAt', { unique: false });
      store.createIndex(INDEX_NAMES.updatedAt, 'metadata.updatedAt', { unique: false });
      store.createIndex(INDEX_NAMES.tags, 'metadata.tags', { unique: false, multiEntry: true });
    }
  }
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * IndexedDBStorageProvider - IndexedDB storage implementation
 * 
 * Provides large-capacity persistent storage using IndexedDB.
 * Supports efficient indexing and querying for test data.
 * 
 * @example
 * ```typescript
 * const storage = new IndexedDBStorageProvider({ dbName: 'my-app' });
 * await storage.initialize();
 * 
 * await storage.set('test-1', { name: 'Login Test' }, 'testCases');
 * const test = await storage.get('test-1', 'testCases');
 * ```
 */
export class IndexedDBStorageProvider extends BaseStorageProvider {
  /**
   * Storage type identifier
   */
  readonly type: StorageType = 'indexeddb';
  
  /**
   * Database name
   */
  private dbName: string;
  
  /**
   * Database version
   */
  private dbVersion: number;
  
  /**
   * IndexedDB database reference
   */
  private db: IDBDatabase | null = null;
  
  /**
   * Fallback provider for non-IndexedDB environments
   */
  private fallback: BaseStorageProvider | null = null;
  
  /**
   * Creates a new IndexedDBStorageProvider
   * 
   * @param options - Provider options
   */
  constructor(options: IndexedDBStorageOptions = {}) {
    super({
      type: 'indexeddb',
      defaultArea: 'state',
      autoTimestamp: true,
      enableChangeEvents: true,
      ...options,
    });
    
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.dbVersion = options.dbVersion ?? DEFAULT_DB_VERSION;
    this.fallback = options.fallbackProvider ?? null;
  }
  
  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================
  
  /**
   * Initializes the IndexedDB storage provider
   */
  async initialize(): Promise<void> {
    if (this._isReady) return;
    
    if (!isIndexedDBAvailable()) {
      if (this.fallback) {
        await this.fallback.initialize();
        this._isReady = true;
        return;
      }
      throw new Error('IndexedDB is not available');
    }
    
    try {
      this.db = await openDatabase(
        this.dbName,
        this.dbVersion,
        (db, oldVersion) => {
          // Handle migrations
          if (oldVersion < 1) {
            createObjectStores(db);
          }
        }
      );
      
      this._isReady = true;
    } catch (error) {
      if (this.fallback) {
        await this.fallback.initialize();
        this._isReady = true;
        return;
      }
      throw error;
    }
  }
  
  /**
   * Closes the IndexedDB storage provider
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    if (this.fallback) {
      await this.fallback.close();
    }
    
    this._isReady = false;
  }
  
  // ==========================================================================
  // STORAGE ACCESS
  // ==========================================================================
  
  /**
   * Gets the active database
   */
  private getDatabase(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
  
  /**
   * Checks if using fallback storage
   */
  private isUsingFallback(): boolean {
    return this.db === null && this.fallback !== null && this.fallback.isReady;
  }
  
  /**
   * Gets an object store for the given area
   */
  private getStore(
    area: StorageArea,
    mode: IDBTransactionMode = 'readonly'
  ): IDBObjectStore {
    const db = this.getDatabase();
    const transaction = db.transaction(area, mode);
    return transaction.objectStore(area);
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
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    
    const record = await promisifyRequest<StoredRecord<T> | undefined>(
      store.get(key)
    );
    
    if (!record) return null;
    
    return record.value;
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
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    
    const record = await promisifyRequest<StoredRecord<T> | undefined>(
      store.get(key)
    );
    
    if (!record) return null;
    
    return {
      key: record.key,
      value: record.value,
      metadata: record.metadata,
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
    
    const effectiveArea = this.getArea(area);
    const db = this.getDatabase();
    const now = Date.now();
    
    // Get existing for metadata update
    const transaction = db.transaction(effectiveArea, 'readwrite');
    const store = transaction.objectStore(effectiveArea);
    
    const existing = await promisifyRequest<StoredRecord<T> | undefined>(
      store.get(key)
    );
    
    const record: StoredRecord<T> = {
      key,
      value,
      metadata: {
        createdAt: existing?.metadata.createdAt ?? now,
        updatedAt: now,
        size: estimateSize(value),
        version: (existing?.metadata.version ?? 0) + 1,
      },
    };
    
    await promisifyRequest(store.put(record));
    await promisifyTransaction(transaction);
    
    // Notify listeners
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'set',
      oldValue: existing?.value,
      newValue: value,
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
    if (this.isUsingFallback()) {
      return this.fallback!.setWithMetadata<T>(key, value, metadata, area);
    }
    
    const effectiveArea = this.getArea(area);
    const db = this.getDatabase();
    const now = Date.now();
    
    const transaction = db.transaction(effectiveArea, 'readwrite');
    const store = transaction.objectStore(effectiveArea);
    
    const existing = await promisifyRequest<StoredRecord<T> | undefined>(
      store.get(key)
    );
    
    const record: StoredRecord<T> = {
      key,
      value,
      metadata: {
        createdAt: metadata.createdAt ?? existing?.metadata.createdAt ?? now,
        updatedAt: metadata.updatedAt ?? now,
        size: estimateSize(value),
        version: metadata.version ?? (existing?.metadata.version ?? 0) + 1,
        contentType: metadata.contentType,
        tags: metadata.tags,
      },
    };
    
    await promisifyRequest(store.put(record));
    await promisifyTransaction(transaction);
    
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'set',
      oldValue: existing?.value,
      newValue: value,
      timestamp: now,
    }]);
  }
  
  /**
   * Removes a value by key
   */
  async remove(key: string, area?: StorageArea): Promise<boolean> {
    if (this.isUsingFallback()) {
      return this.fallback!.remove(key, area);
    }
    
    const effectiveArea = this.getArea(area);
    const db = this.getDatabase();
    
    const transaction = db.transaction(effectiveArea, 'readwrite');
    const store = transaction.objectStore(effectiveArea);
    
    // Check if exists
    const existing = await promisifyRequest<StoredRecord | undefined>(
      store.get(key)
    );
    
    if (!existing) return false;
    
    await promisifyRequest(store.delete(key));
    await promisifyTransaction(transaction);
    
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'remove',
      oldValue: existing.value,
      timestamp: Date.now(),
    }]);
    
    return true;
  }
  
  /**
   * Checks if a key exists
   */
  async has(key: string, area?: StorageArea): Promise<boolean> {
    if (this.isUsingFallback()) {
      return this.fallback!.has(key, area);
    }
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    
    const count = await promisifyRequest(store.count(key));
    return count > 0;
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
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    const result = new Map<string, T>();
    
    for (const key of keys) {
      const record = await promisifyRequest<StoredRecord<T> | undefined>(
        store.get(key)
      );
      
      if (record) {
        result.set(key, record.value);
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
    if (this.isUsingFallback()) {
      return this.fallback!.setMany<T>(entries, area);
    }
    
    const effectiveArea = this.getArea(area);
    const db = this.getDatabase();
    const now = Date.now();
    
    const transaction = db.transaction(effectiveArea, 'readwrite');
    const store = transaction.objectStore(effectiveArea);
    const changes: StorageChange[] = [];
    
    for (const { key, value } of entries) {
      const record: StoredRecord<T> = {
        key,
        value,
        metadata: {
          createdAt: now,
          updatedAt: now,
          size: estimateSize(value),
          version: 1,
        },
      };
      
      store.put(record);
      
      changes.push({
        key,
        area: effectiveArea,
        type: 'set',
        newValue: value,
        timestamp: now,
      });
    }
    
    await promisifyTransaction(transaction);
    
    if (changes.length > 0) {
      this.notifyListeners(changes);
    }
  }
  
  /**
   * Removes multiple values by keys
   */
  async removeMany(keys: string[], area?: StorageArea): Promise<number> {
    if (this.isUsingFallback()) {
      return this.fallback!.removeMany(keys, area);
    }
    
    const effectiveArea = this.getArea(area);
    const db = this.getDatabase();
    
    const transaction = db.transaction(effectiveArea, 'readwrite');
    const store = transaction.objectStore(effectiveArea);
    const changes: StorageChange[] = [];
    let removed = 0;
    const now = Date.now();
    
    for (const key of keys) {
      const existing = await promisifyRequest<StoredRecord | undefined>(
        store.get(key)
      );
      
      if (existing) {
        store.delete(key);
        removed++;
        
        changes.push({
          key,
          area: effectiveArea,
          type: 'remove',
          oldValue: existing.value,
          timestamp: now,
        });
      }
    }
    
    await promisifyTransaction(transaction);
    
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
    if (this.isUsingFallback()) {
      return this.fallback!.keys(area);
    }
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    
    const keys = await promisifyRequest(store.getAllKeys());
    return keys as string[];
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
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    
    const records = await promisifyRequest<StoredRecord<T>[]>(store.getAll());
    
    return records.map(record => ({
      key: record.key,
      value: record.value,
      metadata: record.metadata,
    }));
  }
  
  /**
   * Queries entries with filters
   */
  async query<T extends StorableValue>(
    query: StorageQuery,
    area?: StorageArea
  ): Promise<StorageQueryResult<T>> {
    if (this.isUsingFallback()) {
      return this.fallback!.query<T>(query, area);
    }
    
    // Get all entries and filter in memory
    // (For more complex queries, we could use indexes)
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
    
    return {
      entries,
      total,
      hasMore,
      nextOffset: hasMore ? offset + entries.length : undefined,
    };
  }
  
  /**
   * Queries using an index (optimized for large datasets)
   */
  async queryByIndex<T extends StorableValue>(
    indexName: keyof typeof INDEX_NAMES,
    range: IDBKeyRange | null,
    area?: StorageArea,
    limit?: number
  ): Promise<StorageEntry<T>[]> {
    if (this.isUsingFallback()) {
      // Fallback doesn't support index queries
      return this.entries<T>(area);
    }
    
    const effectiveArea = this.getArea(area);
    const store = this.getStore(effectiveArea);
    const index = store.index(INDEX_NAMES[indexName]);
    
    return new Promise((resolve, reject) => {
      const results: StorageEntry<T>[] = [];
      const request = index.openCursor(range);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        
        if (cursor && (!limit || results.length < limit)) {
          const record = cursor.value as StoredRecord<T>;
          results.push({
            key: record.key,
            value: record.value,
            metadata: record.metadata,
          });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }
  
  /**
   * Counts entries matching query
   */
  async count(query?: StorageQuery, area?: StorageArea): Promise<number> {
    if (this.isUsingFallback()) {
      return this.fallback!.count(query, area);
    }
    
    if (!query) {
      const effectiveArea = this.getArea(area);
      const store = this.getStore(effectiveArea);
      return promisifyRequest(store.count());
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
    
    const db = this.getDatabase();
    const transaction = db.transaction(area, 'readwrite');
    const store = transaction.objectStore(area);
    
    const count = await promisifyRequest(store.count());
    await promisifyRequest(store.clear());
    await promisifyTransaction(transaction);
    
    this.notifyListeners([{
      key: '*',
      area,
      type: 'clear',
      timestamp: Date.now(),
    }]);
    
    return count;
  }
  
  /**
   * Clears all data in all areas
   */
  async clearAll(): Promise<number> {
    if (this.isUsingFallback()) {
      return this.fallback!.clearAll();
    }
    
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
  
  // ==========================================================================
  // TRANSACTION OPERATIONS
  // ==========================================================================
  
  /**
   * Executes multiple operations atomically
   */
  async transaction(operations: TransactionOperation[]): Promise<TransactionResult> {
    if (this.isUsingFallback()) {
      return this.fallback!.transaction(operations);
    }
    
    const db = this.getDatabase();
    
    // Group operations by area
    const operationsByArea = new Map<StorageArea, TransactionOperation[]>();
    
    for (const op of operations) {
      const area = op.area ?? this.getArea(undefined);
      if (!operationsByArea.has(area)) {
        operationsByArea.set(area, []);
      }
      operationsByArea.get(area)!.push(op);
    }
    
    const partialResults: TransactionResult['partialResults'] = [];
    let operationsCompleted = 0;
    const now = Date.now();
    const changes: StorageChange[] = [];
    
    try {
      // Execute operations for each area
      for (const [area, areaOps] of operationsByArea) {
        const transaction = db.transaction(area, 'readwrite');
        const store = transaction.objectStore(area);
        
        for (const op of areaOps) {
          try {
            if (op.type === 'set' && op.value !== undefined) {
              const record: StoredRecord = {
                key: op.key,
                value: op.value,
                metadata: {
                  createdAt: now,
                  updatedAt: now,
                  size: estimateSize(op.value),
                  version: 1,
                },
              };
              
              store.put(record);
              
              changes.push({
                key: op.key,
                area,
                type: 'set',
                newValue: op.value,
                timestamp: now,
              });
            } else if (op.type === 'remove') {
              store.delete(op.key);
              
              changes.push({
                key: op.key,
                area,
                type: 'remove',
                timestamp: now,
              });
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
        
        await promisifyTransaction(transaction);
      }
      
      if (changes.length > 0) {
        this.notifyListeners(changes);
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
    
    // Try to use Storage API if available
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const total = estimate.quota ?? DEFAULT_QUOTA_ESTIMATE;
        const used = estimate.usage ?? 0;
        
        return {
          total,
          used,
          available: total - used,
          usagePercent: (used / total) * 100,
        };
      } catch {
        // Fall through to estimate
      }
    }
    
    // Estimate based on stored data
    const stats = await this.getStats();
    
    return {
      total: DEFAULT_QUOTA_ESTIMATE,
      used: stats.totalSize,
      available: DEFAULT_QUOTA_ESTIMATE - stats.totalSize,
      usagePercent: (stats.totalSize / DEFAULT_QUOTA_ESTIMATE) * 100,
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
      
      const entries = await this.entries(area);
      
      for (const entry of entries) {
        const size = entry.metadata?.size ?? 0;
        
        countByArea[area]++;
        sizeByArea[area] += size;
        totalSize += size;
        itemCount++;
        
        largestItems.push({ key: `${area}:${entry.key}`, size });
        
        if (entry.metadata && entry.metadata.updatedAt > lastActivity) {
          lastActivity = entry.metadata.updatedAt;
        }
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
  // INDEXEDDB-SPECIFIC METHODS
  // ==========================================================================
  
  /**
   * Gets the database name
   */
  getDatabaseName(): string {
    return this.dbName;
  }
  
  /**
   * Gets the database version
   */
  getDatabaseVersion(): number {
    return this.dbVersion;
  }
  
  /**
   * Checks if using fallback storage
   */
  isFallbackActive(): boolean {
    return this.isUsingFallback();
  }
  
  /**
   * Gets raw database reference (for advanced use)
   */
  getRawDatabase(): IDBDatabase | null {
    return this.db;
  }
  
  /**
   * Deletes the entire database
   */
  async deleteDatabase(): Promise<void> {
    await this.close();
    await deleteDatabase(this.dbName);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Singleton instance
 */
let instance: IndexedDBStorageProvider | null = null;

/**
 * Gets or creates the global IndexedDBStorageProvider singleton
 * 
 * @returns IndexedDBStorageProvider instance
 */
export function getIndexedDBStorage(): IndexedDBStorageProvider {
  if (!instance) {
    instance = new IndexedDBStorageProvider();
  }
  return instance;
}

/**
 * Creates a new IndexedDBStorageProvider instance
 * 
 * @param options - Provider options
 * @returns New IndexedDBStorageProvider instance
 */
export function createIndexedDBStorage(
  options?: IndexedDBStorageOptions
): IndexedDBStorageProvider {
  return new IndexedDBStorageProvider(options);
}

/**
 * Resets the global singleton (for testing)
 */
export async function resetIndexedDBStorage(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default IndexedDBStorageProvider;
