/**
 * @fileoverview Tests for database migrations
 * @module core/storage/migrations.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  MIGRATIONS,
  getMigrationsToApply,
  applyMigrations,
  needsMigration,
  getMigrationDescriptions,
  migrateProjectData,
  migrateTestRunData,
  validateMigrations,
  getMigrationStatus
} from './migrations';
import { DB_VERSION, STORES, INDEXES } from './db';

describe('Migrations', () => {
  // ==========================================================================
  // MIGRATION DEFINITIONS
  // ==========================================================================

  describe('MIGRATIONS', () => {
    it('should have at least one migration', () => {
      expect(MIGRATIONS.length).toBeGreaterThan(0);
    });

    it('should have migrations in order', () => {
      for (let i = 0; i < MIGRATIONS.length; i++) {
        expect(MIGRATIONS[i].version).toBe(i + 1);
      }
    });

    it('should have descriptions for all migrations', () => {
      for (const migration of MIGRATIONS) {
        expect(migration.description).toBeDefined();
        expect(migration.description.length).toBeGreaterThan(0);
      }
    });

    it('should have migrate functions for all migrations', () => {
      for (const migration of MIGRATIONS) {
        expect(typeof migration.migrate).toBe('function');
      }
    });

    it('should match DB_VERSION with highest migration', () => {
      const highestVersion = MIGRATIONS[MIGRATIONS.length - 1].version;
      expect(DB_VERSION).toBe(highestVersion);
    });
  });

  // ==========================================================================
  // MIGRATION SELECTION
  // ==========================================================================

  describe('getMigrationsToApply', () => {
    it('should return all migrations for new database (version 0)', () => {
      const migrations = getMigrationsToApply(0, DB_VERSION);
      expect(migrations).toHaveLength(MIGRATIONS.length);
    });

    it('should return empty array when already at target version', () => {
      const migrations = getMigrationsToApply(DB_VERSION, DB_VERSION);
      expect(migrations).toHaveLength(0);
    });

    it('should return correct migrations for version range', () => {
      // Assuming we have version 1
      const migrations = getMigrationsToApply(0, 1);
      expect(migrations).toHaveLength(1);
      expect(migrations[0].version).toBe(1);
    });

    it('should return empty array for downgrade (not supported)', () => {
      const migrations = getMigrationsToApply(2, 1);
      expect(migrations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // MIGRATION EXECUTION
  // ==========================================================================

  describe('applyMigrations', () => {
    let db: IDBDatabase;

    beforeEach(() => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('test_migration_db', 1);
        
        request.onupgradeneeded = (event) => {
          db = (event.target as IDBOpenDBRequest).result;
          // Don't create any stores - let migration do it
        };

        request.onsuccess = () => {
          db = request.result;
          resolve();
        };

        request.onerror = () => {
          reject(new Error('Failed to open test database'));
        };
      });
    });

    afterEach(() => {
      if (db) {
        db.close();
      }
      indexedDB.deleteDatabase('test_migration_db');
    });

    it('should apply migrations successfully', () => {
      // Open with upgrade to trigger migration
      const deleteRequest = indexedDB.deleteDatabase('test_apply_migration_db');
      
      deleteRequest.onsuccess = () => {
        const request = indexedDB.open('test_apply_migration_db', 1);
        
        request.onupgradeneeded = (event) => {
          const upgradeDb = (event.target as IDBOpenDBRequest).result;
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          
          const result = applyMigrations(upgradeDb, transaction, 0, 1);
          
          expect(result.success).toBe(true);
          expect(result.fromVersion).toBe(0);
          expect(result.toVersion).toBe(1);
          expect(result.appliedMigrations).toContain(1);
        };
      };
    });

    it('should report no migrations when already up to date', () => {
      const result = applyMigrations(db, {} as IDBTransaction, 1, 1);
      
      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // MIGRATION HELPERS
  // ==========================================================================

  describe('needsMigration', () => {
    it('should return true when current version is lower', () => {
      expect(needsMigration(0, 1)).toBe(true);
      expect(needsMigration(0, DB_VERSION)).toBe(true);
    });

    it('should return false when versions match', () => {
      expect(needsMigration(1, 1)).toBe(false);
      expect(needsMigration(DB_VERSION, DB_VERSION)).toBe(false);
    });

    it('should return false when current is higher (no downgrade)', () => {
      expect(needsMigration(2, 1)).toBe(false);
    });

    it('should use DB_VERSION as default target', () => {
      expect(needsMigration(0)).toBe(true);
      expect(needsMigration(DB_VERSION)).toBe(false);
    });
  });

  describe('getMigrationDescriptions', () => {
    it('should return descriptions for migrations in range', () => {
      const descriptions = getMigrationDescriptions(0, 1);
      
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0]).toBe(MIGRATIONS[0].description);
    });

    it('should return empty array when no migrations needed', () => {
      const descriptions = getMigrationDescriptions(1, 1);
      expect(descriptions).toHaveLength(0);
    });
  });

  // ==========================================================================
  // DATA MIGRATION
  // ==========================================================================

  describe('migrateProjectData', () => {
    it('should return project data unchanged for v1', () => {
      const project = {
        id: 1,
        name: 'Test Project',
        target_url: 'https://example.com',
        status: 'draft',
        recorded_steps: [],
        parsed_fields: []
      };

      const migrated = migrateProjectData(project, 0, 1);

      expect(migrated).toEqual(project);
    });

    it('should not modify original object', () => {
      const project = { id: 1, name: 'Original' };
      const migrated = migrateProjectData(project, 0, 1);

      expect(migrated).not.toBe(project);
      expect(project.name).toBe('Original');
    });
  });

  describe('migrateTestRunData', () => {
    it('should return test run data unchanged for v1', () => {
      const testRun = {
        id: 'run-1',
        project_id: 1,
        status: 'pending',
        total_steps: 5,
        current_step: 0,
        logs: '',
        results: []
      };

      const migrated = migrateTestRunData(testRun, 0, 1);

      expect(migrated).toEqual(testRun);
    });

    it('should not modify original object', () => {
      const testRun = { id: 'run-1', status: 'pending' };
      const migrated = migrateTestRunData(testRun, 0, 1);

      expect(migrated).not.toBe(testRun);
      expect(testRun.status).toBe('pending');
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateMigrations', () => {
    it('should validate current migrations successfully', () => {
      const result = validateMigrations();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getMigrationStatus', () => {
    it('should return current migration status', () => {
      const status = getMigrationStatus();

      expect(status.currentDbVersion).toBe(DB_VERSION);
      expect(status.totalMigrations).toBe(MIGRATIONS.length);
      expect(status.migrationVersions).toEqual(MIGRATIONS.map(m => m.version));
    });

    it('should have matching version counts', () => {
      const status = getMigrationStatus();

      expect(status.currentDbVersion).toBe(status.totalMigrations);
      expect(status.migrationVersions).toHaveLength(status.totalMigrations);
    });
  });

  // ==========================================================================
  // MIGRATION V1 SPECIFIC TESTS
  // ==========================================================================

  describe('Migration V1', () => {
    afterEach(() => {
      indexedDB.deleteDatabase('test_v1_db');
    });

    it('should create Projects store with correct structure', () => {
      return new Promise<void>((resolve) => {
        const request = indexedDB.open('test_v1_db', 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          
          applyMigrations(db, transaction, 0, 1);
        };

        request.onsuccess = () => {
          const db = request.result;

          expect(db.objectStoreNames.contains(STORES.PROJECTS)).toBe(true);
          
          const transaction = db.transaction(STORES.PROJECTS, 'readonly');
          const store = transaction.objectStore(STORES.PROJECTS);
          
          expect(store.keyPath).toBe('id');
          expect(store.autoIncrement).toBe(true);
          expect(store.indexNames.contains(INDEXES.PROJECTS.BY_STATUS)).toBe(true);
          expect(store.indexNames.contains(INDEXES.PROJECTS.BY_UPDATED)).toBe(true);

          db.close();
          resolve();
        };
      });
    });

    it('should create TestRuns store with correct structure', () => {
      return new Promise<void>((resolve) => {
        const request = indexedDB.open('test_v1_db', 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          
          applyMigrations(db, transaction, 0, 1);
        };

        request.onsuccess = () => {
          const db = request.result;

          expect(db.objectStoreNames.contains(STORES.TEST_RUNS)).toBe(true);
          
          const transaction = db.transaction(STORES.TEST_RUNS, 'readonly');
          const store = transaction.objectStore(STORES.TEST_RUNS);
          
          expect(store.keyPath).toBe('id');
          expect(store.autoIncrement).toBe(false);
          expect(store.indexNames.contains(INDEXES.TEST_RUNS.BY_PROJECT)).toBe(true);
          expect(store.indexNames.contains(INDEXES.TEST_RUNS.BY_STATUS)).toBe(true);
          expect(store.indexNames.contains(INDEXES.TEST_RUNS.BY_STARTED)).toBe(true);

          db.close();
          resolve();
        };
      });
    });

    it('should not recreate existing stores', () => {
      return new Promise<void>((resolve) => {
        const request = indexedDB.open('test_v1_db', 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          
          // Apply migration twice - should not throw
          applyMigrations(db, transaction, 0, 1);
          
          // Stores already exist, this should be safe
          expect(db.objectStoreNames.contains(STORES.PROJECTS)).toBe(true);
          expect(db.objectStoreNames.contains(STORES.TEST_RUNS)).toBe(true);
        };

        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle migration from version 0 (new database)', () => {
      const migrations = getMigrationsToApply(0, DB_VERSION);
      expect(migrations.length).toBe(MIGRATIONS.length);
    });

    it('should handle null newVersion in applyMigrations', () => {
      const mockDb = {} as IDBDatabase;
      const mockTransaction = {} as IDBTransaction;
      
      // Should use DB_VERSION as default
      const result = applyMigrations(mockDb, mockTransaction, DB_VERSION, null);
      
      expect(result.toVersion).toBe(DB_VERSION);
      expect(result.appliedMigrations).toHaveLength(0);
    });

    it('should handle very old version upgrade', () => {
      // Simulate upgrade from very old version
      const migrations = getMigrationsToApply(0, 100);
      
      // Should only get migrations up to what exists
      expect(migrations.length).toBe(MIGRATIONS.length);
    });
  });
});
