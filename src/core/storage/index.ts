/**
 * Storage System - Central export barrel
 * @module core/storage
 * @version 1.0.0
 * 
 * Provides a unified entry point for the storage layer.
 * 
 * Main Components:
 * - StorageManager: Unified facade for all storage operations
 * - IStorageProvider: Interface for storage backends
 * - MemoryStorageProvider: In-memory volatile storage
 * - ChromeStorageProvider: Chrome extension storage
 * - IndexedDBStorageProvider: Large-capacity persistent storage
 * 
 * @example
 * ```typescript
 * import {
 *   StorageManager,
 *   getStorageManager,
 *   storageGet,
 *   storageSet,
 * } from '@/core/storage';
 * 
 * // Using the manager
 * const manager = getStorageManager();
 * await manager.initialize();
 * await manager.set('key', { data: 'value' }, 'testCases');
 * 
 * // Using convenience functions
 * await storageSet('key', 'value');
 * const result = await storageGet('key');
 * ```
 */

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export type {
  IStorageProvider,
  StorageType,
  StorageArea,
  StorableValue,
  StorageEntry,
  StorageMetadata,
  StorageQuery,
  StorageQueryResult,
  StorageChangeType,
  StorageChange,
  StorageChangeListener,
  Unsubscribe,
  StorageQuota,
  StorageStats,
  TransactionOperation,
  TransactionResult,
  StorageProviderOptions,
} from './IStorageProvider';

// ============================================================================
// BASE STORAGE PROVIDER
// ============================================================================

export {
  BaseStorageProvider,
  isStorableValue,
  isStorageArea,
  isStorageType,
} from './IStorageProvider';

// ============================================================================
// MEMORY STORAGE PROVIDER
// ============================================================================

export {
  MemoryStorageProvider,
  getMemoryStorage,
  createMemoryStorage,
  resetMemoryStorage,
  estimateSize as estimateMemorySize,
  deepClone,
  matchesPattern,
  DEFAULT_MEMORY_QUOTA,
  DEFAULT_CACHE_TTL as MEMORY_CACHE_TTL,
  CLEANUP_INTERVAL,
  type MemoryStorageOptions,
} from './MemoryStorageProvider';

// ============================================================================
// CHROME STORAGE PROVIDER
// ============================================================================

export {
  ChromeStorageProvider,
  getChromeStorage,
  createChromeStorage,
  resetChromeStorage,
  isChromeStorageAvailable,
  estimateJsonSize,
  chromeGet,
  chromeSet,
  chromeRemove,
  chromeClear,
  chromeGetBytesInUse,
  getChromeStorageArea,
  CHROME_QUOTAS,
  CHROME_SYNC_LIMITS,
  METADATA_PREFIX,
  AREA_PREFIX,
  type ChromeStorageType,
  type ChromeStorageOptions,
} from './ChromeStorageProvider';

// ============================================================================
// INDEXEDDB STORAGE PROVIDER
// ============================================================================

export {
  IndexedDBStorageProvider,
  getIndexedDBStorage,
  createIndexedDBStorage,
  resetIndexedDBStorage,
  isIndexedDBAvailable,
  promisifyRequest,
  promisifyTransaction,
  openDatabase,
  deleteDatabase,
  estimateSize as estimateIndexedDBSize,
  DEFAULT_DB_NAME,
  DEFAULT_DB_VERSION,
  STORE_NAMES,
  INDEX_NAMES,
  DEFAULT_QUOTA_ESTIMATE,
  type IndexedDBStorageOptions,
} from './IndexedDBStorageProvider';

// ============================================================================
// STORAGE MANAGER
// ============================================================================

export {
  StorageManager,
  getStorageManager,
  createStorageManager,
  resetStorageManager,
  storageGet,
  storageSet,
  storageRemove,
  DEFAULT_CACHE_TTL,
  MAX_CACHE_ENTRIES,
  PROVIDER_PRIORITY,
  type StorageManagerConfig,
  type ProviderInfo,
  type MigrationResult,
} from './StorageManager';

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

/**
 * Creates a fully configured storage system
 * 
 * @param config - Optional configuration
 * @returns Initialized StorageManager
 */
export async function createStorageSystem(
  config?: import('./StorageManager').StorageManagerConfig
): Promise<import('./StorageManager').StorageManager> {
  const { createStorageManager } = await import('./StorageManager');
  const manager = createStorageManager(config);
  await manager.initialize();
  return manager;
}

/**
 * Storage provider factory
 * 
 * Creates a storage provider based on type
 * 
 * @param type - Provider type
 * @param options - Provider options
 * @returns Storage provider instance
 */
export function createStorageProvider(
  type: 'memory' | 'chrome' | 'indexeddb',
  options?: Record<string, unknown>
): import('./IStorageProvider').IStorageProvider {
  switch (type) {
    case 'memory': {
      const { createMemoryStorage } = require('./MemoryStorageProvider');
      return createMemoryStorage(options as import('./MemoryStorageProvider').MemoryStorageOptions);
    }
    case 'chrome': {
      const { createChromeStorage } = require('./ChromeStorageProvider');
      return createChromeStorage(options as import('./ChromeStorageProvider').ChromeStorageOptions);
    }
    case 'indexeddb': {
      const { createIndexedDBStorage } = require('./IndexedDBStorageProvider');
      return createIndexedDBStorage(options as import('./IndexedDBStorageProvider').IndexedDBStorageOptions);
    }
    default:
      throw new Error(`Unknown storage provider type: ${type}`);
  }
}

/**
 * Detects the best available storage provider
 * 
 * @returns Provider type string
 */
export function detectBestProvider(): 'chrome' | 'indexeddb' | 'memory' {
  const { isChromeStorageAvailable } = require('./ChromeStorageProvider');
  const { isIndexedDBAvailable } = require('./IndexedDBStorageProvider');
  
  if (isChromeStorageAvailable()) {
    return 'chrome';
  }
  
  if (isIndexedDBAvailable()) {
    return 'indexeddb';
  }
  
  return 'memory';
}

// ============================================================================
// STORAGE AREA CONSTANTS
// ============================================================================

/**
 * All available storage areas
 */
export const STORAGE_AREAS = [
  'testCases',
  'steps',
  'config',
  'state',
  'cache',
  'metadata',
] as const;

/**
 * Storage area descriptions
 */
export const STORAGE_AREA_DESCRIPTIONS: Record<import('./IStorageProvider').StorageArea, string> = {
  testCases: 'Test case definitions and configurations',
  steps: 'Recorded test steps and actions',
  config: 'User configuration and preferences',
  state: 'Runtime state and session data',
  cache: 'Temporary cached data',
  metadata: 'System metadata and indexes',
};

// ============================================================================
// TYPE RE-EXPORTS FOR CONVENIENCE
// ============================================================================

/**
 * Re-export common types at top level for convenience
 */
export type {
  StorageArea as Area,
  StorableValue as Value,
  StorageEntry as Entry,
  StorageQuery as Query,
} from './IStorageProvider';
