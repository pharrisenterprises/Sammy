/**
 * @fileoverview Tests for storage utilities
 * @module core/storage/storage-utils.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  EXPORT_VERSION,
  APPLICATION_NAME,
  DEFAULT_SYNC_SETTINGS,
  exportAllData,
  exportProject,
  exportToJson,
  generateExportFilename,
  parseImportData,
  validateImportData,
  importData,
  importFromJson,
  getStorageStats,
  formatBytes,
  getSyncSettings,
  sanitizeProject,
  sanitizeTestRun,
  cleanupOldTestRuns,
  vacuumDatabase,
  type ExportData
} from './storage-utils';
import { Database, deleteDatabase } from './db';
import { createProject, createTestRun, createStep } from '../types';

describe('Storage Utils', () => {
  beforeEach(async () => {
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
    it('should have correct export version', () => {
      expect(EXPORT_VERSION).toBe('1.0.0');
    });

    it('should have correct application name', () => {
      expect(APPLICATION_NAME).toBe('SammyTestRecorder');
    });

    it('should have default sync settings', () => {
      expect(DEFAULT_SYNC_SETTINGS.autoSaveInterval).toBe(5000);
      expect(DEFAULT_SYNC_SETTINGS.maxTestRunsPerProject).toBe(50);
      expect(DEFAULT_SYNC_SETTINGS.debugLogging).toBe(false);
    });
  });

  // ==========================================================================
  // EXPORT FUNCTIONS
  // ==========================================================================

  describe('Export Functions', () => {
    describe('exportAllData', () => {
      it('should export empty data when database is empty', async () => {
        const data = await exportAllData();

        expect(data.version).toBe(EXPORT_VERSION);
        expect(data.application).toBe(APPLICATION_NAME);
        expect(data.exportedAt).toBeGreaterThan(0);
        expect(data.projects).toEqual([]);
        expect(data.testRuns).toEqual([]);
        expect(data.metadata.projectCount).toBe(0);
      });

      it('should export all projects and test runs', async () => {
        const db = await Database.getInstance();
        await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addProject(createProject({ name: 'P2', target_url: 'https://2.com' }));
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));

        const data = await exportAllData();

        expect(data.projects).toHaveLength(2);
        expect(data.testRuns).toHaveLength(1);
        expect(data.metadata.projectCount).toBe(2);
        expect(data.metadata.testRunCount).toBe(1);
      });

      it('should include step and field counts in metadata', async () => {
        const db = await Database.getInstance();
        const project = createProject({ name: 'P1', target_url: 'https://1.com' });
        project.recorded_steps = [
          createStep({ event: 'click', path: '/x', x: 0, y: 0 }),
          createStep({ event: 'click', path: '/y', x: 0, y: 0 })
        ];
        project.parsed_fields = [
          { field_name: 'f1', mapped: false, inputvarfields: '' }
        ];
        await db.addProject(project);

        const data = await exportAllData();

        expect(data.metadata.totalSteps).toBe(2);
        expect(data.metadata.totalFields).toBe(1);
      });
    });

    describe('exportProject', () => {
      it('should export single project with test runs', async () => {
        const db = await Database.getInstance();
        const project = await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addTestRun(createTestRun({ project_id: project.id!, total_steps: 5 }));
        await db.addTestRun(createTestRun({ project_id: 999, total_steps: 3 })); // Different project

        const data = await exportProject(project.id!);

        expect(data).not.toBeNull();
        expect(data!.projects).toHaveLength(1);
        expect(data!.testRuns).toHaveLength(1);
      });

      it('should return null for non-existent project', async () => {
        const data = await exportProject(99999);
        expect(data).toBeNull();
      });
    });

    describe('exportToJson', () => {
      it('should convert to JSON string', () => {
        const data: ExportData = {
          version: '1.0.0',
          exportedAt: Date.now(),
          application: 'test',
          projects: [],
          testRuns: [],
          metadata: { projectCount: 0, testRunCount: 0, totalSteps: 0, totalFields: 0 }
        };

        const json = exportToJson(data);

        expect(typeof json).toBe('string');
        expect(JSON.parse(json)).toEqual(data);
      });

      it('should format with indentation when pretty=true', () => {
        const data: ExportData = {
          version: '1.0.0',
          exportedAt: Date.now(),
          application: 'test',
          projects: [],
          testRuns: [],
          metadata: { projectCount: 0, testRunCount: 0, totalSteps: 0, totalFields: 0 }
        };

        const pretty = exportToJson(data, true);
        const compact = exportToJson(data, false);

        expect(pretty.includes('\n')).toBe(true);
        expect(compact.includes('\n')).toBe(false);
      });
    });

    describe('generateExportFilename', () => {
      it('should generate filename with timestamp', () => {
        const filename = generateExportFilename();

        expect(filename).toMatch(/^sammy-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      });

      it('should use custom prefix', () => {
        const filename = generateExportFilename('my-export');

        expect(filename).toMatch(/^my-export-/);
      });
    });
  });

  // ==========================================================================
  // IMPORT FUNCTIONS
  // ==========================================================================

  describe('Import Functions', () => {
    describe('parseImportData', () => {
      it('should parse valid JSON', () => {
        const json = JSON.stringify({
          version: '1.0.0',
          projects: []
        });

        const data = parseImportData(json);

        expect(data).not.toBeNull();
        expect(data!.version).toBe('1.0.0');
      });

      it('should return null for invalid JSON', () => {
        const data = parseImportData('not json');
        expect(data).toBeNull();
      });

      it('should return null for missing required fields', () => {
        const data = parseImportData(JSON.stringify({ foo: 'bar' }));
        expect(data).toBeNull();
      });
    });

    describe('validateImportData', () => {
      it('should validate correct data', () => {
        const data: ExportData = {
          version: EXPORT_VERSION,
          exportedAt: Date.now(),
          application: APPLICATION_NAME,
          projects: [{
            id: 1,
            name: 'Test',
            target_url: 'https://test.com',
            status: 'draft',
            description: '',
            created_date: Date.now(),
            updated_date: Date.now(),
            recorded_steps: [],
            parsed_fields: [],
            csv_data: []
          }],
          testRuns: [],
          metadata: { projectCount: 1, testRunCount: 0, totalSteps: 0, totalFields: 0 }
        };

        const result = validateImportData(data);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid project data', () => {
        const data = {
          version: EXPORT_VERSION,
          projects: [{ invalid: 'project' }]
        };

        const result = validateImportData(data);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should warn about version mismatch', () => {
        const data = {
          version: '0.9.0',
          projects: []
        };

        const result = validateImportData(data);

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Version mismatch');
      });
    });

    describe('importData', () => {
      it('should import valid data', async () => {
        const data: ExportData = {
          version: EXPORT_VERSION,
          exportedAt: Date.now(),
          application: APPLICATION_NAME,
          projects: [{
            id: 1,
            name: 'Imported Project',
            target_url: 'https://imported.com',
            status: 'draft',
            description: '',
            created_date: Date.now(),
            updated_date: Date.now(),
            recorded_steps: [],
            parsed_fields: [],
            csv_data: []
          }],
          testRuns: [],
          metadata: { projectCount: 1, testRunCount: 0, totalSteps: 0, totalFields: 0 }
        };

        const result = await importData(data);

        expect(result.success).toBe(true);
        expect(result.projectsImported).toBe(1);
      });

      it('should overwrite existing data when requested', async () => {
        const db = await Database.getInstance();
        await db.addProject(createProject({ name: 'Existing', target_url: 'https://existing.com' }));

        const data: ExportData = {
          version: EXPORT_VERSION,
          exportedAt: Date.now(),
          application: APPLICATION_NAME,
          projects: [{
            id: 1,
            name: 'New',
            target_url: 'https://new.com',
            status: 'draft',
            description: '',
            created_date: Date.now(),
            updated_date: Date.now(),
            recorded_steps: [],
            parsed_fields: [],
            csv_data: []
          }],
          testRuns: [],
          metadata: { projectCount: 1, testRunCount: 0, totalSteps: 0, totalFields: 0 }
        };

        await importData(data, true);

        const projects = await db.getAllProjects();
        expect(projects).toHaveLength(1);
        expect(projects[0].name).toBe('New');
      });
    });

    describe('importFromJson', () => {
      it('should import from JSON string', async () => {
        const data: ExportData = {
          version: EXPORT_VERSION,
          exportedAt: Date.now(),
          application: APPLICATION_NAME,
          projects: [{
            id: 1,
            name: 'Test',
            target_url: 'https://test.com',
            status: 'draft',
            description: '',
            created_date: Date.now(),
            updated_date: Date.now(),
            recorded_steps: [],
            parsed_fields: [],
            csv_data: []
          }],
          testRuns: [],
          metadata: { projectCount: 1, testRunCount: 0, totalSteps: 0, totalFields: 0 }
        };

        const result = await importFromJson(JSON.stringify(data));

        expect(result.success).toBe(true);
        expect(result.projectsImported).toBe(1);
      });

      it('should handle invalid JSON', async () => {
        const result = await importFromJson('not json');

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Failed to parse JSON data');
      });
    });
  });

  // ==========================================================================
  // STORAGE STATISTICS
  // ==========================================================================

  describe('Storage Statistics', () => {
    describe('getStorageStats', () => {
      it('should return stats for empty database', async () => {
        const stats = await getStorageStats();

        expect(stats.projectCount).toBe(0);
        expect(stats.testRunCount).toBe(0);
        expect(stats.totalSteps).toBe(0);
        expect(stats.estimatedSizeBytes).toBeGreaterThanOrEqual(0);
      });

      it('should return correct counts', async () => {
        const db = await Database.getInstance();
        const project = createProject({ name: 'P1', target_url: 'https://1.com' });
        project.recorded_steps = [
          createStep({ event: 'click', path: '/x', x: 0, y: 0 })
        ];
        await db.addProject(project);
        await db.addTestRun(createTestRun({ project_id: 1, total_steps: 5 }));

        const stats = await getStorageStats();

        expect(stats.projectCount).toBe(1);
        expect(stats.testRunCount).toBe(1);
        expect(stats.totalSteps).toBe(1);
      });
    });

    describe('formatBytes', () => {
      it('should format zero bytes', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
      });

      it('should format bytes', () => {
        expect(formatBytes(500)).toBe('500 Bytes');
      });

      it('should format kilobytes', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(2048)).toBe('2 KB');
      });

      it('should format megabytes', () => {
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
      });
    });
  });

  // ==========================================================================
  // SANITIZATION
  // ==========================================================================

  describe('Sanitization', () => {
    describe('sanitizeProject', () => {
      it('should trim and limit name length', () => {
        const result = sanitizeProject({
          name: '  Test  ',
          target_url: 'https://test.com'
        });

        expect(result.name).toBe('Test');
      });

      it('should validate status', () => {
        const validResult = sanitizeProject({ status: 'draft' });
        const invalidResult = sanitizeProject({ status: 'invalid' as any });

        expect(validResult.status).toBe('draft');
        expect(invalidResult.status).toBeUndefined();
      });

      it('should filter invalid steps', () => {
        const result = sanitizeProject({
          recorded_steps: [
            { id: 'valid', event: 'click' } as any,
            { invalid: true } as any
          ]
        });

        expect(result.recorded_steps).toHaveLength(1);
      });
    });

    describe('sanitizeTestRun', () => {
      it('should ensure logs is string', () => {
        const result = sanitizeTestRun({
          id: 'test',
          logs: 'string logs'
        });

        expect(typeof result.logs).toBe('string');
      });

      it('should convert array logs to string (CRITICAL)', () => {
        const result = sanitizeTestRun({
          id: 'test',
          logs: ['line1', 'line2'] as any
        });

        expect(typeof result.logs).toBe('string');
        expect(result.logs).toBe('line1\nline2');
      });

      it('should validate status', () => {
        const validResult = sanitizeTestRun({ status: 'running' });
        const invalidResult = sanitizeTestRun({ status: 'invalid' as any });

        expect(validResult.status).toBe('running');
        expect(invalidResult.status).toBeUndefined();
      });

      it('should ensure non-negative numeric fields', () => {
        const result = sanitizeTestRun({
          total_steps: -5,
          current_step: -1
        });

        expect(result.total_steps).toBe(0);
        expect(result.current_step).toBe(0);
      });
    });
  });

  // ==========================================================================
  // CLEANUP UTILITIES
  // ==========================================================================

  describe('Cleanup Utilities', () => {
    describe('cleanupOldTestRuns', () => {
      it('should delete old test runs', async () => {
        const db = await Database.getInstance();
        const project = await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));

        // Create old test run
        const oldRun = createTestRun({ project_id: project.id!, total_steps: 5 });
        oldRun.started_at = Date.now() - (60 * 24 * 60 * 60 * 1000); // 60 days ago
        await db.addTestRun(oldRun);

        // Create recent test run
        const newRun = createTestRun({ project_id: project.id!, total_steps: 5 });
        newRun.started_at = Date.now();
        await db.addTestRun(newRun);

        const deleted = await cleanupOldTestRuns(30, 100);

        expect(deleted).toBe(1);
        expect(await db.getTestRunCount()).toBe(1);
      });

      it('should respect maxPerProject limit', async () => {
        const db = await Database.getInstance();
        const project = await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));

        // Create 5 test runs
        for (let i = 0; i < 5; i++) {
          const run = createTestRun({ project_id: project.id!, total_steps: 5 });
          run.started_at = Date.now() + i; // Different times
          await db.addTestRun(run);
        }

        const deleted = await cleanupOldTestRuns(365, 2); // Keep only 2

        expect(deleted).toBe(3);
        expect(await db.getTestRunCount()).toBe(2);
      });
    });

    describe('vacuumDatabase', () => {
      it('should delete orphaned test runs', async () => {
        const db = await Database.getInstance();
        const project = await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));

        // Create valid test run
        await db.addTestRun(createTestRun({ project_id: project.id!, total_steps: 5 }));

        // Create orphaned test run (project doesn't exist)
        await db.addTestRun(createTestRun({ project_id: 99999, total_steps: 5 }));

        const deleted = await vacuumDatabase();

        expect(deleted).toBe(1);
        expect(await db.getTestRunCount()).toBe(1);
      });

      it('should return 0 when no orphans exist', async () => {
        const db = await Database.getInstance();
        const project = await db.addProject(createProject({ name: 'P1', target_url: 'https://1.com' }));
        await db.addTestRun(createTestRun({ project_id: project.id!, total_steps: 5 }));

        const deleted = await vacuumDatabase();

        expect(deleted).toBe(0);
      });
    });
  });

  // ==========================================================================
  // CHROME SYNC STORAGE
  // ==========================================================================

  describe('Chrome Sync Storage', () => {
    describe('getSyncSettings', () => {
      it('should return default settings when chrome is unavailable', async () => {
        const settings = await getSyncSettings();

        expect(settings).toEqual(DEFAULT_SYNC_SETTINGS);
      });
    });
  });
});
