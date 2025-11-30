/**
 * @fileoverview Tests for IndexedDB database wrapper
 * @module core/storage/db.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  Database,
  DB_NAME,
  DB_VERSION,
  STORES,
  INDEXES,
  getDatabase,
  deleteDatabase,
  isIndexedDBAvailable
} from './db';
import { createProject, createTestRun } from '../types';

describe('Database', () => {
  beforeEach(async () => {
    // Reset database before each test
    Database.resetInstance();
    await deleteDatabase();
  });

  afterEach(async () => {
    Database.resetInstance();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct database name', () => {
      expect(DB_NAME).toBe('SammyTestRecorderDB');
    });

    it('should have database version 1', () => {
      expect(DB_VERSION).toBe(1);
    });

    it('should have correct store names', () => {
      expect(STORES.PROJECTS).toBe('projects');
      expect(STORES.TEST_RUNS).toBe('testRuns');
    });

    it('should have correct index names', () => {
      expect(INDEXES.PROJECTS.BY_STATUS).toBe('by_status');
      expect(INDEXES.PROJECTS.BY_UPDATED).toBe('by_updated_date');
      expect(INDEXES.TEST_RUNS.BY_PROJECT).toBe('by_project_id');
      expect(INDEXES.TEST_RUNS.BY_STATUS).toBe('by_status');
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('should return same instance', async () => {
      const db1 = await Database.getInstance();
      const db2 = await Database.getInstance();
      expect(db1).toBe(db2);
    });

    it('should reset instance', async () => {
      const db1 = await Database.getInstance();
      Database.resetInstance();
      const db2 = await Database.getInstance();
      expect(db1).not.toBe(db2);
    });
  });

  // ==========================================================================
  // PROJECT OPERATIONS
  // ==========================================================================

  describe('Project Operations', () => {
    let db: Database;

    beforeEach(async () => {
      db = await Database.getInstance();
    });

    describe('addProject', () => {
      it('should add a project and return with id', async () => {
        const projectData = createProject({
          name: 'Test Project',
          target_url: 'https://example.com'
        });

        const project = await db.addProject(projectData);

        expect(project.id).toBeDefined();
        expect(project.id).toBeGreaterThan(0);
        expect(project.name).toBe('Test Project');
        expect(project.target_url).toBe('https://example.com');
      });

      it('should auto-increment project ids', async () => {
        const project1 = await db.addProject(createProject({
          name: 'Project 1',
          target_url: 'https://example1.com'
        }));

        const project2 = await db.addProject(createProject({
          name: 'Project 2',
          target_url: 'https://example2.com'
        }));

        expect(project2.id).toBeGreaterThan(project1.id!);
      });
    });

    describe('getProject', () => {
      it('should return project by id', async () => {
        const created = await db.addProject(createProject({
          name: 'Test Project',
          target_url: 'https://example.com'
        }));

        const retrieved = await db.getProject(created.id!);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.name).toBe('Test Project');
      });

      it('should return null for non-existent id', async () => {
        const result = await db.getProject(99999);
        expect(result).toBeNull();
      });
    });

    describe('getAllProjects', () => {
      it('should return empty array when no projects', async () => {
        const projects = await db.getAllProjects();
        expect(projects).toEqual([]);
      });

      it('should return all projects', async () => {
        await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addProject(createProject({ name: 'P2', target_url: 'https://2.com' }));
        await db.addProject(createProject({ name: 'P3', target_url: 'https://3.com' }));

        const projects = await db.getAllProjects();

        expect(projects).toHaveLength(3);
      });
    });

    describe('getProjectsByStatus', () => {
      it('should filter projects by status', async () => {
        await db.addProject(createProject({ name: 'Draft 1', target_url: 'https://1.com', status: 'draft' }));
        await db.addProject(createProject({ name: 'Testing 1', target_url: 'https://2.com', status: 'testing' }));
        await db.addProject(createProject({ name: 'Draft 2', target_url: 'https://3.com', status: 'draft' }));

        const draftProjects = await db.getProjectsByStatus('draft');
        const testingProjects = await db.getProjectsByStatus('testing');

        expect(draftProjects).toHaveLength(2);
        expect(testingProjects).toHaveLength(1);
      });
    });

    describe('updateProject', () => {
      it('should update project fields', async () => {
        const created = await db.addProject(createProject({
          name: 'Original Name',
          target_url: 'https://example.com'
        }));

        // Small delay to ensure updated_date is different
        await new Promise(resolve => setTimeout(resolve, 2));

        const updated = await db.updateProject(created.id!, {
          name: 'Updated Name',
          status: 'testing'
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.status).toBe('testing');
        expect(updated.updated_date).toBeGreaterThanOrEqual(created.updated_date);
      });

      it('should throw for non-existent project', async () => {
        await expect(
          db.updateProject(99999, { name: 'New Name' })
        ).rejects.toThrow('Project not found');
      });
    });

    describe('deleteProject', () => {
      it('should delete project', async () => {
        const created = await db.addProject(createProject({
          name: 'To Delete',
          target_url: 'https://example.com'
        }));

        const result = await db.deleteProject(created.id!);

        expect(result).toBe(true);
        expect(await db.getProject(created.id!)).toBeNull();
      });
    });

    describe('getProjectCount', () => {
      it('should return correct count', async () => {
        expect(await db.getProjectCount()).toBe(0);

        await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addProject(createProject({ name: 'P2', target_url: 'https://2.com' }));

        expect(await db.getProjectCount()).toBe(2);
      });
    });
  });

  // ==========================================================================
  // TEST RUN OPERATIONS
  // ==========================================================================

  describe('TestRun Operations', () => {
    let db: Database;

    beforeEach(async () => {
      db = await Database.getInstance();
    });

    describe('addTestRun', () => {
      it('should add a test run', async () => {
        const testRun = createTestRun({
          project_id: 1,
          total_steps: 5
        });

        const added = await db.addTestRun(testRun);

        expect(added.id).toBe(testRun.id);
        expect(added.project_id).toBe(1);
        expect(added.total_steps).toBe(5);
      });
    });

    describe('getTestRun', () => {
      it('should return test run by id', async () => {
        const testRun = createTestRun({ project_id: 1, total_steps: 5 });
        await db.addTestRun(testRun);

        const retrieved = await db.getTestRun(testRun.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.project_id).toBe(1);
      });

      it('should return null for non-existent id', async () => {
        const result = await db.getTestRun('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('getTestRunsByProject', () => {
      it('should return test runs for specific project', async () => {
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 3 }));
        await db.addTestRun(createTestRun({ project_id: 2, total_steps: 7 }));

        const project1Runs = await db.getTestRunsByProject(1);
        const project2Runs = await db.getTestRunsByProject(2);

        expect(project1Runs).toHaveLength(2);
        expect(project2Runs).toHaveLength(1);
      });
    });

    describe('getTestRunsByStatus', () => {
      it('should filter test runs by status', async () => {
        const pending = createTestRun({ project_id: 1, total_steps: 5 });
        const passed = { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'passed' as const };
        const failed = { ...createTestRun({ project_id: 1, total_steps: 5 }), status: 'failed' as const };

        await db.addTestRun(pending);
        await db.addTestRun(passed);
        await db.addTestRun(failed);

        const pendingRuns = await db.getTestRunsByStatus('pending');
        const passedRuns = await db.getTestRunsByStatus('passed');

        expect(pendingRuns).toHaveLength(1);
        expect(passedRuns).toHaveLength(1);
      });
    });

    describe('updateTestRun', () => {
      it('should update test run fields', async () => {
        const testRun = createTestRun({ project_id: 1, total_steps: 5 });
        await db.addTestRun(testRun);

        const updated = await db.updateTestRun(testRun.id, {
          status: 'running',
          current_step: 2,
          logs: 'Test log entry'
        });

        expect(updated.status).toBe('running');
        expect(updated.current_step).toBe(2);
        expect(updated.logs).toBe('Test log entry');
      });

      it('should throw for non-existent test run', async () => {
        await expect(
          db.updateTestRun('non-existent', { status: 'passed' })
        ).rejects.toThrow('Test run not found');
      });
    });

    describe('deleteTestRun', () => {
      it('should delete test run', async () => {
        const testRun = createTestRun({ project_id: 1, total_steps: 5 });
        await db.addTestRun(testRun);

        const result = await db.deleteTestRun(testRun.id);

        expect(result).toBe(true);
        expect(await db.getTestRun(testRun.id)).toBeNull();
      });
    });

    describe('deleteTestRunsByProject', () => {
      it('should delete all test runs for a project', async () => {
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 3 }));
        await db.addTestRun(createTestRun({ project_id: 2, total_steps: 7 }));

        const deleted = await db.deleteTestRunsByProject(1);

        expect(deleted).toBe(2);
        expect(await db.getTestRunsByProject(1)).toHaveLength(0);
        expect(await db.getTestRunsByProject(2)).toHaveLength(1);
      });
    });

    describe('getTestRunCount', () => {
      it('should return correct count', async () => {
        expect(await db.getTestRunCount()).toBe(0);

        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 3 }));

        expect(await db.getTestRunCount()).toBe(2);
      });
    });
  });

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  describe('Bulk Operations', () => {
    let db: Database;

    beforeEach(async () => {
      db = await Database.getInstance();
    });

    describe('clearAll', () => {
      it('should clear all data', async () => {
        await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));

        const result = await db.clearAll();

        expect(result).toBe(true);
        expect(await db.getProjectCount()).toBe(0);
        expect(await db.getTestRunCount()).toBe(0);
      });
    });

    describe('exportAll', () => {
      it('should export all data', async () => {
        await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addProject(createProject({ name: 'P2', target_url: 'https://2.com' }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));

        const exported = await db.exportAll();

        expect(exported.projects).toHaveLength(2);
        expect(exported.testRuns).toHaveLength(1);
        expect(exported.exportedAt).toBeGreaterThan(0);
      });
    });

    describe('importAll', () => {
      it('should import data', async () => {
        const project = createProject({ name: 'Imported', target_url: 'https://imported.com' });
        const testRun = createTestRun({ project_id: 1, total_steps: 5 });

        const result = await db.importAll({
          projects: [project],
          testRuns: [testRun]
        });

        expect(result.projectsImported).toBe(1);
        expect(result.testRunsImported).toBe(1);
        expect(await db.getProjectCount()).toBe(1);
        expect(await db.getTestRunCount()).toBe(1);
      });

      it('should overwrite existing data when requested', async () => {
        await db.addProject(createProject({ name: 'Existing', target_url: 'https://existing.com' }));

        await db.importAll(
          { projects: [createProject({ name: 'New', target_url: 'https://new.com' })] },
          true
        );

        const projects = await db.getAllProjects();
        expect(projects).toHaveLength(1);
        expect(projects[0].name).toBe('New');
      });
    });

    describe('getStats', () => {
      it('should return storage statistics', async () => {
        await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addProject(createProject({ name: 'P2', target_url: 'https://2.com' }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));

        const stats = await db.getStats();

        expect(stats.projectCount).toBe(2);
        expect(stats.testRunCount).toBe(1);
        expect(stats.databaseName).toBe(DB_NAME);
        expect(stats.databaseVersion).toBe(DB_VERSION);
      });
    });
  });

  // ==========================================================================
  // CONVENIENCE FUNCTIONS
  // ==========================================================================

  describe('Convenience Functions', () => {
    it('getDatabase should return database instance', async () => {
      const db = await getDatabase();
      expect(db).toBeInstanceOf(Database);
    });

    it('deleteDatabase should delete the database', async () => {
      const db = await getDatabase();
      await db.addProject(createProject({ name: 'Test', target_url: 'https://test.com' }));

      await deleteDatabase();

      const newDb = await getDatabase();
      expect(await newDb.getProjectCount()).toBe(0);
    });

    it('isIndexedDBAvailable should return true', () => {
      expect(isIndexedDBAvailable()).toBe(true);
    });
  });
});
