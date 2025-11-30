/**
 * @fileoverview Database migration system for schema upgrades
 * @module core/storage/migrations
 * @version 1.0.0
 * 
 * This module provides a migration framework for safely upgrading
 * the IndexedDB schema when the extension version changes.
 * 
 * Migrations are applied automatically during database initialization
 * when the version number increases.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 3 for storage specifications
 * @see storage-layer_breakdown.md for architecture details
 */

import { DB_VERSION, STORES, INDEXES } from './db';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Migration function signature
 * 
 * @param db - IDBDatabase instance
 * @param transaction - Upgrade transaction
 * @param oldVersion - Previous database version
 * @param newVersion - Target database version
 */
export type MigrationFunction = (
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number
) => void;

/**
 * Migration definition
 */
export interface Migration {
  /** Target version this migration upgrades to */
  version: number;
  /** Description of what this migration does */
  description: string;
  /** Migration function to execute */
  migrate: MigrationFunction;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /** Whether migrations were successful */
  success: boolean;
  /** Starting version */
  fromVersion: number;
  /** Ending version */
  toVersion: number;
  /** Migrations that were applied */
  appliedMigrations: number[];
  /** Error message if failed */
  error?: string;
}

/**
 * Migration log entry
 */
export interface MigrationLogEntry {
  /** Migration version */
  version: number;
  /** When migration was applied */
  appliedAt: number;
  /** Migration description */
  description: string;
}

// ============================================================================
// MIGRATION DEFINITIONS
// ============================================================================

/**
 * Migration to version 1: Initial schema
 * 
 * Creates the initial database schema with Projects and TestRuns stores.
 */
const migrationV1: Migration = {
  version: 1,
  description: 'Initial schema with Projects and TestRuns stores',
  migrate: (db: IDBDatabase) => {
    // Create Projects store
    if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
      const projectStore = db.createObjectStore(STORES.PROJECTS, {
        keyPath: 'id',
        autoIncrement: true
      });
      
      projectStore.createIndex(INDEXES.PROJECTS.BY_STATUS, 'status', { unique: false });
      projectStore.createIndex(INDEXES.PROJECTS.BY_UPDATED, 'updated_date', { unique: false });
    }

    // Create TestRuns store
    if (!db.objectStoreNames.contains(STORES.TEST_RUNS)) {
      const testRunStore = db.createObjectStore(STORES.TEST_RUNS, {
        keyPath: 'id'
      });
      
      testRunStore.createIndex(INDEXES.TEST_RUNS.BY_PROJECT, 'project_id', { unique: false });
      testRunStore.createIndex(INDEXES.TEST_RUNS.BY_STATUS, 'status', { unique: false });
      testRunStore.createIndex(INDEXES.TEST_RUNS.BY_STARTED, 'started_at', { unique: false });
    }
  }
};

/**
 * All registered migrations
 * 
 * IMPORTANT: Migrations must be ordered by version number.
 * Each migration should only handle the upgrade from version N-1 to N.
 */
export const MIGRATIONS: readonly Migration[] = [
  migrationV1
  // Future migrations will be added here:
  // migrationV2,
  // migrationV3,
  // etc.
];

// ============================================================================
// MIGRATION RUNNER
// ============================================================================

/**
 * Get migrations that need to be applied for a version upgrade
 * 
 * @param fromVersion - Current database version
 * @param toVersion - Target database version
 * @returns Array of migrations to apply
 */
export function getMigrationsToApply(
  fromVersion: number,
  toVersion: number
): Migration[] {
  return MIGRATIONS.filter(m => m.version > fromVersion && m.version <= toVersion);
}

/**
 * Apply migrations during database upgrade
 * 
 * This function should be called from the onupgradeneeded event handler.
 * 
 * @param db - IDBDatabase instance
 * @param transaction - Upgrade transaction
 * @param oldVersion - Previous database version (0 if new database)
 * @param newVersion - Target database version
 * @returns Migration result
 * 
 * @example
 * ```typescript
 * request.onupgradeneeded = (event) => {
 *   const db = event.target.result;
 *   const transaction = event.target.transaction;
 *   const result = applyMigrations(db, transaction, event.oldVersion, event.newVersion);
 *   if (!result.success) {
 *     console.error('Migration failed:', result.error);
 *   }
 * };
 * ```
 */
export function applyMigrations(
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number | null
): MigrationResult {
  const targetVersion = newVersion ?? DB_VERSION;
  const migrations = getMigrationsToApply(oldVersion, targetVersion);
  const appliedMigrations: number[] = [];

  try {
    for (const migration of migrations) {
      migration.migrate(db, transaction, oldVersion, targetVersion);
      appliedMigrations.push(migration.version);
    }

    return {
      success: true,
      fromVersion: oldVersion,
      toVersion: targetVersion,
      appliedMigrations
    };
  } catch (error) {
    return {
      success: false,
      fromVersion: oldVersion,
      toVersion: targetVersion,
      appliedMigrations,
      error: error instanceof Error ? error.message : 'Unknown migration error'
    };
  }
}

/**
 * Check if migrations are needed
 * 
 * @param currentVersion - Current database version
 * @param targetVersion - Target database version (defaults to DB_VERSION)
 * @returns True if migrations need to be applied
 */
export function needsMigration(
  currentVersion: number,
  targetVersion: number = DB_VERSION
): boolean {
  return currentVersion < targetVersion;
}

/**
 * Get migration descriptions for a version range
 * 
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns Array of migration descriptions
 */
export function getMigrationDescriptions(
  fromVersion: number,
  toVersion: number
): string[] {
  return getMigrationsToApply(fromVersion, toVersion).map(m => m.description);
}

// ============================================================================
// DATA MIGRATION UTILITIES
// ============================================================================

/**
 * Migrate project data between versions
 * 
 * Use this for data transformations when schema changes require
 * updating existing records.
 * 
 * @param project - Project data
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @returns Migrated project data
 */
export function migrateProjectData(
  project: Record<string, unknown>,
  _fromVersion: number,
  _toVersion: number
): Record<string, unknown> {
  let migrated = { ...project };

  // Version 1: Initial schema - no data migration needed
  // Future migrations would add transformation logic here:
  // if (fromVersion < 2 && toVersion >= 2) {
  //   migrated = migrateProjectV1ToV2(migrated);
  // }

  return migrated;
}

/**
 * Migrate test run data between versions
 * 
 * @param testRun - TestRun data
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @returns Migrated test run data
 */
export function migrateTestRunData(
  testRun: Record<string, unknown>,
  _fromVersion: number,
  _toVersion: number
): Record<string, unknown> {
  let migrated = { ...testRun };

  // Version 1: Initial schema - no data migration needed
  // Future migrations would add transformation logic here:
  // if (fromVersion < 2 && toVersion >= 2) {
  //   migrated = migrateTestRunV1ToV2(migrated);
  // }

  return migrated;
}

// ============================================================================
// MIGRATION VALIDATION
// ============================================================================

/**
 * Validate migration integrity
 * 
 * Checks that:
 * - Migrations are in order
 * - No version gaps exist
 * - All migrations have required fields
 * 
 * @returns Validation result
 */
export function validateMigrations(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check ordering
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i];
    const expectedVersion = i + 1;

    if (migration.version !== expectedVersion) {
      errors.push(
        `Migration at index ${i} has version ${migration.version}, expected ${expectedVersion}`
      );
    }

    if (!migration.description) {
      errors.push(`Migration ${migration.version} is missing description`);
    }

    if (typeof migration.migrate !== 'function') {
      errors.push(`Migration ${migration.version} is missing migrate function`);
    }
  }

  // Check that DB_VERSION matches highest migration
  if (MIGRATIONS.length > 0) {
    const highestMigration = MIGRATIONS[MIGRATIONS.length - 1].version;
    if (DB_VERSION !== highestMigration) {
      errors.push(
        `DB_VERSION (${DB_VERSION}) does not match highest migration version (${highestMigration})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get current migration status
 * 
 * @returns Migration status info
 */
export function getMigrationStatus(): {
  currentDbVersion: number;
  totalMigrations: number;
  migrationVersions: number[];
} {
  return {
    currentDbVersion: DB_VERSION,
    totalMigrations: MIGRATIONS.length,
    migrationVersions: MIGRATIONS.map(m => m.version)
  };
}

// ============================================================================
// BACKUP AND RESTORE (for safe migrations)
// ============================================================================

/**
 * Export all data for backup before migration
 * 
 * Call this before applying migrations to allow rollback if needed.
 * 
 * @param db - IDBDatabase instance
 * @returns Promise resolving to backup data
 */
export async function backupBeforeMigration(
  db: IDBDatabase
): Promise<{
  version: number;
  timestamp: number;
  projects: unknown[];
  testRuns: unknown[];
}> {
  const projects: unknown[] = [];
  const testRuns: unknown[] = [];

  // Backup projects if store exists
  if (db.objectStoreNames.contains(STORES.PROJECTS)) {
    const projectData = await getAllFromStore(db, STORES.PROJECTS);
    projects.push(...projectData);
  }

  // Backup test runs if store exists
  if (db.objectStoreNames.contains(STORES.TEST_RUNS)) {
    const testRunData = await getAllFromStore(db, STORES.TEST_RUNS);
    testRuns.push(...testRunData);
  }

  return {
    version: db.version,
    timestamp: Date.now(),
    projects,
    testRuns
  };
}

/**
 * Helper to get all records from an object store
 */
async function getAllFromStore(
  db: IDBDatabase,
  storeName: string
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Restore data from backup
 * 
 * Use this to rollback after a failed migration.
 * 
 * @param db - IDBDatabase instance
 * @param backup - Backup data from backupBeforeMigration
 * @returns Promise resolving when restore is complete
 */
export async function restoreFromBackup(
  db: IDBDatabase,
  backup: {
    projects: unknown[];
    testRuns: unknown[];
  }
): Promise<void> {
  // Clear existing data
  if (db.objectStoreNames.contains(STORES.PROJECTS)) {
    await clearStore(db, STORES.PROJECTS);
  }
  if (db.objectStoreNames.contains(STORES.TEST_RUNS)) {
    await clearStore(db, STORES.TEST_RUNS);
  }

  // Restore projects
  if (backup.projects.length > 0 && db.objectStoreNames.contains(STORES.PROJECTS)) {
    await addToStore(db, STORES.PROJECTS, backup.projects);
  }

  // Restore test runs
  if (backup.testRuns.length > 0 && db.objectStoreNames.contains(STORES.TEST_RUNS)) {
    await addToStore(db, STORES.TEST_RUNS, backup.testRuns);
  }
}

/**
 * Helper to clear an object store
 */
async function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Helper to add records to an object store
 */
async function addToStore(
  db: IDBDatabase,
  storeName: string,
  records: unknown[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    for (const record of records) {
      store.add(record);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================================================
// FUTURE MIGRATION TEMPLATE
// ============================================================================

/**
 * Template for future migrations
 * 
 * Copy this template when adding new migrations:
 * 
 * ```typescript
 * const migrationV2: Migration = {
 *   version: 2,
 *   description: 'Add new index for faster queries',
 *   migrate: (db: IDBDatabase, transaction: IDBTransaction) => {
 *     // Get existing store from transaction
 *     const store = transaction.objectStore(STORES.PROJECTS);
 *     
 *     // Add new index
 *     if (!store.indexNames.contains('new_index_name')) {
 *       store.createIndex('new_index_name', 'field_name', { unique: false });
 *     }
 *   }
 * };
 * ```
 * 
 * Then add to MIGRATIONS array:
 * ```typescript
 * export const MIGRATIONS: readonly Migration[] = [
 *   migrationV1,
 *   migrationV2  // Add new migration here
 * ];
 * ```
 * 
 * And update DB_VERSION in db.ts:
 * ```typescript
 * export const DB_VERSION = 2;  // Increment version
 * ```
 */
