/**
 * Database Integration Tests
 * @module tests/integration/storage/database.test
 * @version 1.0.0
 * 
 * Integration tests for the Dexie database instance.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

import { db, initializeDatabase } from '@/core/storage';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Database Integration', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.testRuns.clear();
  });

  afterEach(async () => {
    await db.projects.clear();
    await db.testRuns.clear();
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('initialization', () => {
    it('should have projects table', () => {
      expect(db.projects).toBeDefined();
    });

    it('should have testRuns table', () => {
      expect(db.testRuns).toBeDefined();
    });

    it('should be open after initialization', async () => {
      await initializeDatabase();
      expect(db.isOpen()).toBe(true);
    });
  });

  // ==========================================================================
  // DIRECT TABLE OPERATIONS
  // ==========================================================================

  describe('direct table operations', () => {
    it('should add and retrieve from projects table', async () => {
      const id = await db.projects.add({
        name: 'Direct Add',
        description: 'Test',
        target_url: 'https://test.com',
        status: 'draft',
        created_date: Date.now(),
        updated_date: Date.now(),
        recorded_steps: [],
        parsed_fields: [],
        csv_data: [],
      });

      const project = await db.projects.get(id);
      expect(project?.name).toBe('Direct Add');
    });

    it('should add and retrieve from testRuns table', async () => {
      const id = await db.testRuns.add({
        project_id: 1,
        status: 'pending',
        start_time: new Date().toISOString(),
        total_steps: 5,
        passed_steps: 0,
        failed_steps: 0,
        test_results: [],
        logs: '',
      });

      const testRun = await db.testRuns.get(id);
      expect(testRun?.project_id).toBe(1);
    });
  });

  // ==========================================================================
  // QUERY TESTS
  // ==========================================================================

  describe('queries', () => {
    it('should query projects by status', async () => {
      await db.projects.bulkAdd([
        { name: 'Draft 1', description: '', target_url: '', status: 'draft', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
        { name: 'Testing 1', description: '', target_url: '', status: 'testing', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
        { name: 'Draft 2', description: '', target_url: '', status: 'draft', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
        { name: 'Complete 1', description: '', target_url: '', status: 'complete', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
      ]);

      const draftProjects = await db.projects
        .where('status')
        .equals('draft')
        .toArray();

      expect(draftProjects).toHaveLength(2);
    });

    it('should query testRuns by project_id', async () => {
      await db.testRuns.bulkAdd([
        { project_id: 1, status: 'completed', start_time: '', total_steps: 3, passed_steps: 3, failed_steps: 0, test_results: [], logs: '' },
        { project_id: 1, status: 'failed', start_time: '', total_steps: 3, passed_steps: 2, failed_steps: 1, test_results: [], logs: '' },
        { project_id: 2, status: 'completed', start_time: '', total_steps: 5, passed_steps: 5, failed_steps: 0, test_results: [], logs: '' },
      ]);

      const project1Runs = await db.testRuns
        .where('project_id')
        .equals(1)
        .toArray();

      expect(project1Runs).toHaveLength(2);
    });
  });

  // ==========================================================================
  // TRANSACTION TESTS
  // ==========================================================================

  describe('transactions', () => {
    it('should support transaction operations', async () => {
      await db.transaction('rw', db.projects, async () => {
        const id1 = await db.projects.add({
          name: 'Transaction 1',
          description: '',
          target_url: '',
          status: 'draft',
          created_date: Date.now(),
          updated_date: Date.now(),
          recorded_steps: [],
          parsed_fields: [],
          csv_data: [],
        });

        const id2 = await db.projects.add({
          name: 'Transaction 2',
          description: '',
          target_url: '',
          status: 'draft',
          created_date: Date.now(),
          updated_date: Date.now(),
          recorded_steps: [],
          parsed_fields: [],
          csv_data: [],
        });

        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
      });

      const allProjects = await db.projects.toArray();
      expect(allProjects).toHaveLength(2);
    });
  });

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  describe('bulk operations', () => {
    it('should support bulkAdd', async () => {
      const projects = Array.from({ length: 100 }, (_, i) => ({
        name: `Bulk Project ${i}`,
        description: '',
        target_url: '',
        status: 'draft' as const,
        created_date: Date.now(),
        updated_date: Date.now(),
        recorded_steps: [],
        parsed_fields: [],
        csv_data: [],
      }));

      await db.projects.bulkAdd(projects);

      const count = await db.projects.count();
      expect(count).toBe(100);
    });

    it('should support bulkDelete', async () => {
      const ids = await db.projects.bulkAdd([
        { name: 'Delete 1', description: '', target_url: '', status: 'draft', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
        { name: 'Delete 2', description: '', target_url: '', status: 'draft', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
        { name: 'Delete 3', description: '', target_url: '', status: 'draft', created_date: Date.now(), updated_date: Date.now(), recorded_steps: [], parsed_fields: [], csv_data: [] },
      ]);

      await db.projects.bulkDelete(ids as number[]);

      const count = await db.projects.count();
      expect(count).toBe(0);
    });
  });
});
