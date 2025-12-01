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
