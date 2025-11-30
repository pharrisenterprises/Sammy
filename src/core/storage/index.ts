/**
 * @fileoverview Barrel export for all storage-related types and utilities
 * @module core/storage
 * @version 1.0.0
 * 
 * This module re-exports all storage types, database access, repositories,
 * migrations, and utility functions.
 * 
 * @example
 * ```typescript
 * // Import database access
 * import { Database, getDatabase, deleteDatabase } from '@/core/storage';
 * 
 * // Import repositories
 * import { projectRepository, testRunRepository } from '@/core/storage';
 * 
 * // Import utilities
 * import { exportAllData, importFromJson, getStorageStats } from '@/core/storage';
 * 
 * // Import migrations
 * import { applyMigrations, validateMigrations } from '@/core/storage';
 * ```
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 3 for storage specifications
 * @see storage-layer_breakdown.md for architecture details
 */

// ============================================================================
// DATABASE
// ============================================================================

export {
  // Constants
  DB_NAME,
  DB_VERSION,
  STORES,
  INDEXES,
  
  // Types
  type StoreName,
  
  // Database Class
  Database,
  
  // Convenience Functions
  getDatabase,
  deleteDatabase,
  isIndexedDBAvailable
} from './db';

// ============================================================================
// PROJECT REPOSITORY
// ============================================================================

export {
  // Types
  type ListProjectsOptions,
  type ProjectOperationResult,
  type ProjectWithMetadata,
  
  // Repository Class
  ProjectRepository,
  
  // Singleton Instance
  projectRepository,
  
  // Convenience Function
  getProjectRepository
} from './project-repository';

// ============================================================================
// TEST RUN REPOSITORY
// ============================================================================

export {
  // Types
  type ListTestRunsOptions,
  type TestRunOperationResult,
  type TestRunWithDuration,
  
  // Repository Class
  TestRunRepository,
  
  // Singleton Instance
  testRunRepository,
  
  // Convenience Function
  getTestRunRepository
} from './test-run-repository';

// ============================================================================
// MIGRATIONS
// ============================================================================

export {
  // Types
  type MigrationFunction,
  type Migration,
  type MigrationResult,
  type MigrationLogEntry,
  
  // Migration Registry
  MIGRATIONS,
  
  // Migration Functions
  getMigrationsToApply,
  applyMigrations,
  needsMigration,
  getMigrationDescriptions,
  
  // Data Migration
  migrateProjectData,
  migrateTestRunData,
  
  // Validation
  validateMigrations,
  getMigrationStatus,
  
  // Backup/Restore
  backupBeforeMigration,
  restoreFromBackup
} from './migrations';

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

export {
  // Types
  type ExportData,
  type ImportResult,
  type ValidationResult,
  type StorageStats,
  type SyncSettings,
  
  // Constants
  EXPORT_VERSION,
  APPLICATION_NAME,
  SYNC_STORAGE_KEY,
  DEFAULT_SYNC_SETTINGS,
  
  // Export Functions
  exportAllData,
  exportProject,
  exportToJson,
  createDownloadUrl,
  generateExportFilename,
  
  // Import Functions
  parseImportData,
  validateImportData,
  importData,
  importFromJson,
  
  // Statistics
  getStorageStats,
  formatBytes,
  
  // Chrome Sync Storage
  getSyncSettings,
  saveSyncSettings,
  clearSyncSettings,
  
  // Sanitization
  sanitizeProject,
  sanitizeTestRun,
  
  // Cleanup
  cleanupOldTestRuns,
  vacuumDatabase
} from './storage-utils';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Quick access to both repositories
 */
export const repositories = {
  get projects() {
    return import('./project-repository').then(m => m.projectRepository);
  },
  get testRuns() {
    return import('./test-run-repository').then(m => m.testRunRepository);
  }
};

/**
 * Initialize storage system
 * 
 * Call this during extension startup to ensure database is ready.
 * 
 * @returns Promise resolving to database instance
 * 
 * @example
 * ```typescript
 * // In background script:
 * import { initializeStorage } from '@/core/storage';
 * 
 * chrome.runtime.onInstalled.addListener(async () => {
 *   await initializeStorage();
 *   console.log('Storage initialized');
 * });
 * ```
 */
export async function initializeStorage(): Promise<void> {
  const { getDatabase } = await import('./db');
  await getDatabase();
}

/**
 * Reset all storage (for testing/development)
 * 
 * WARNING: This deletes ALL data!
 * 
 * @returns Promise resolving when reset is complete
 */
export async function resetStorage(): Promise<void> {
  const { Database, deleteDatabase } = await import('./db');
  Database.resetInstance();
  await deleteDatabase();
}

/**
 * Get comprehensive storage info
 * 
 * @returns Storage information including stats, migration status, settings
 */
export async function getStorageInfo(): Promise<{
  stats: import('./storage-utils').StorageStats;
  migrationStatus: ReturnType<typeof import('./migrations').getMigrationStatus>;
  settings: import('./storage-utils').SyncSettings;
  databaseName: string;
  databaseVersion: number;
}> {
  const [
    { getStorageStats, getSyncSettings },
    { getMigrationStatus }
  ] = await Promise.all([
    import('./storage-utils'),
    import('./migrations')
  ]);

  const { DB_NAME: dbName, DB_VERSION: dbVersion } = await import('./db');

  const [stats, settings] = await Promise.all([
    getStorageStats(),
    getSyncSettings()
  ]);

  return {
    stats,
    migrationStatus: getMigrationStatus(),
    settings,
    databaseName: dbName,
    databaseVersion: dbVersion
  };
}

// ============================================================================
// COMMON PATTERNS
// ============================================================================

/**
 * Create a new project and return it
 * 
 * Convenience wrapper for common operation.
 * 
 * @param name - Project name
 * @param targetUrl - Target URL
 * @param description - Optional description
 * @returns Created project or null on error
 */
export async function createNewProject(
  name: string,
  targetUrl: string,
  description?: string
): Promise<import('../types').Project | null> {
  const { projectRepository } = await import('./project-repository');
  
  const result = await projectRepository.create({
    name,
    target_url: targetUrl,
    description
  });

  return result.success ? result.data! : null;
}

/**
 * Get project with all related data
 * 
 * @param projectId - Project ID
 * @returns Project with test runs or null
 */
export async function getProjectWithTestRuns(projectId: number): Promise<{
  project: import('../types').Project;
  testRuns: import('../types').TestRun[];
  stats: import('./test-run-repository').TestRunOperationResult<import('../types').TestRunStats>;
} | null> {
  const [
    { projectRepository },
    { testRunRepository }
  ] = await Promise.all([
    import('./project-repository'),
    import('./test-run-repository')
  ]);

  const projectResult = await projectRepository.getById(projectId);
  if (!projectResult.success || !projectResult.data) {
    return null;
  }

  const [testRunsResult, statsResult] = await Promise.all([
    testRunRepository.getByProject(projectId),
    testRunRepository.getProjectStats(projectId)
  ]);

  return {
    project: projectResult.data,
    testRuns: testRunsResult.data ?? [],
    stats: statsResult
  };
}

/**
 * Delete project and all related data
 * 
 * @param projectId - Project ID
 * @returns True if deleted successfully
 */
export async function deleteProjectCompletely(projectId: number): Promise<boolean> {
  const { projectRepository } = await import('./project-repository');
  const result = await projectRepository.delete(projectId, true); // true = delete test runs
  return result.success;
}

/**
 * Perform storage maintenance
 * 
 * Cleans up old data and orphaned records.
 * 
 * @param options - Maintenance options
 * @returns Maintenance results
 */
export async function performStorageMaintenance(options: {
  maxTestRunAge?: number;
  maxTestRunsPerProject?: number;
} = {}): Promise<{
  testRunsDeleted: number;
  orphansDeleted: number;
}> {
  const { cleanupOldTestRuns, vacuumDatabase } = await import('./storage-utils');

  const testRunsDeleted = await cleanupOldTestRuns(
    options.maxTestRunAge ?? 30,
    options.maxTestRunsPerProject ?? 50
  );

  const orphansDeleted = await vacuumDatabase();

  return {
    testRunsDeleted,
    orphansDeleted
  };
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * STORAGE LAYER ARCHITECTURE
 * 
 * The storage layer is organized in three tiers:
 * 
 * 1. Database Layer (db.ts)
 *    - Direct IndexedDB access
 *    - Low-level CRUD operations
 *    - Schema management
 * 
 * 2. Repository Layer (project-repository.ts, test-run-repository.ts)
 *    - Business logic
 *    - Validation and sanitization
 *    - High-level operations (e.g., status transitions)
 * 
 * 3. Utility Layer (storage-utils.ts)
 *    - Export/Import
 *    - Statistics
 *    - Chrome sync storage
 *    - Maintenance operations
 * 
 * USAGE RECOMMENDATIONS:
 * 
 * - For UI components: Use repositories (projectRepository, testRunRepository)
 * - For background operations: Use Database class directly for performance
 * - For export/import: Use storage utilities
 * - For schema changes: Add new migrations
 * 
 * CRITICAL NOTES:
 * 
 * - TestRun.logs is type `string` (NOT `string[]`)
 * - Field properties use snake_case (field_name, inputvarfields)
 * - Project.status: 'draft' | 'testing' | 'complete' (3 values only)
 * - TestRun.status: 'pending' | 'running' | 'passed' | 'failed' | 'stopped' (5 values)
 * - Always validate data before storage using sanitization functions
 */
