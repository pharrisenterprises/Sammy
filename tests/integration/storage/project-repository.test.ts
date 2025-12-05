/**
 * Project Repository Integration Tests
 * @module tests/integration/storage/project-repository.test
 * @version 1.0.0
 * 
 * Integration tests for ProjectRepository with real IndexedDB operations.
 * Uses fake-indexeddb for Node.js environment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

import { db } from '@/core/storage';
import { ProjectRepository } from '@/core/storage/repositories/ProjectRepository';
import type { Project, ProjectCreateInput, ProjectStatus } from '@/core/types';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('ProjectRepository Integration', () => {
  let repository: ProjectRepository;

  beforeEach(async () => {
    // Clear database before each test
    await db.projects.clear();
    await db.testRuns.clear();
    
    // Create fresh repository instance
    repository = new ProjectRepository(db);
  });

  afterEach(async () => {
    // Clean up after each test
    await db.projects.clear();
    await db.testRuns.clear();
  });

  // ==========================================================================
  // CREATE TESTS
  // ==========================================================================

  describe('create', () => {
    it('should create a new project with all fields', async () => {
      const input: ProjectCreateInput = {
        name: 'Test Project',
        description: 'A test project',
        target_url: 'https://example.com',
      };

      const id = await repository.create(input);

      expect(id).toBeTypeOf('number');
      expect(id).toBeGreaterThan(0);

      // Verify in database
      const project = await db.projects.get(id);
      expect(project).toBeDefined();
      expect(project?.name).toBe('Test Project');
      expect(project?.description).toBe('A test project');
      expect(project?.target_url).toBe('https://example.com');
      expect(project?.status).toBe('draft');
      expect(project?.recorded_steps).toEqual([]);
      expect(project?.parsed_fields).toEqual([]);
      expect(project?.csv_data).toEqual([]);
      expect(project?.created_date).toBeTypeOf('number');
      expect(project?.updated_date).toBeTypeOf('number');
    });

    it('should create project with minimal fields', async () => {
      const input: ProjectCreateInput = {
        name: 'Minimal Project',
      };

      const id = await repository.create(input);
      const project = await db.projects.get(id);

      expect(project?.name).toBe('Minimal Project');
      expect(project?.description).toBe('');
      expect(project?.target_url).toBe('');
    });

    it('should assign unique IDs to multiple projects', async () => {
      const id1 = await repository.create({ name: 'Project 1' });
      const id2 = await repository.create({ name: 'Project 2' });
      const id3 = await repository.create({ name: 'Project 3' });

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should set timestamps on creation', async () => {
      const beforeCreate = Date.now();
      const id = await repository.create({ name: 'Timestamped' });
      const afterCreate = Date.now();

      const project = await db.projects.get(id);

      expect(project?.created_date).toBeGreaterThanOrEqual(beforeCreate);
      expect(project?.created_date).toBeLessThanOrEqual(afterCreate);
      expect(project?.updated_date).toBe(project?.created_date);
    });
  });

  // ==========================================================================
  // READ TESTS
  // ==========================================================================

  describe('getById', () => {
    it('should retrieve existing project by ID', async () => {
      const id = await repository.create({
        name: 'Findable Project',
        description: 'Should be found',
        target_url: 'https://findable.com',
      });

      const project = await repository.getById(id);

      expect(project).toBeDefined();
      expect(project?.id).toBe(id);
      expect(project?.name).toBe('Findable Project');
    });

    it('should return undefined for non-existent ID', async () => {
      const project = await repository.getById(99999);

      expect(project).toBeUndefined();
    });

    it('should return undefined for ID 0', async () => {
      const project = await repository.getById(0);

      expect(project).toBeUndefined();
    });

    it('should return undefined for negative ID', async () => {
      const project = await repository.getById(-1);

      expect(project).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no projects exist', async () => {
      const projects = await repository.getAll();

      expect(projects).toEqual([]);
    });

    it('should return all projects', async () => {
      await repository.create({ name: 'Project A' });
      await repository.create({ name: 'Project B' });
      await repository.create({ name: 'Project C' });

      const projects = await repository.getAll();

      expect(projects).toHaveLength(3);
      expect(projects.map(p => p.name)).toContain('Project A');
      expect(projects.map(p => p.name)).toContain('Project B');
      expect(projects.map(p => p.name)).toContain('Project C');
    });

    it('should return projects in consistent order', async () => {
      const id1 = await repository.create({ name: 'First' });
      const id2 = await repository.create({ name: 'Second' });
      const id3 = await repository.create({ name: 'Third' });

      const projects = await repository.getAll();

      // Should be ordered by ID (insertion order)
      expect(projects[0].id).toBe(id1);
      expect(projects[1].id).toBe(id2);
      expect(projects[2].id).toBe(id3);
    });
  });

  // ==========================================================================
  // UPDATE TESTS
  // ==========================================================================

  describe('update', () => {
    it('should update project name', async () => {
      const id = await repository.create({ name: 'Original Name' });

      await repository.update(id, { name: 'Updated Name' });

      const project = await repository.getById(id);
      expect(project?.name).toBe('Updated Name');
    });

    it('should update multiple fields at once', async () => {
      const id = await repository.create({
        name: 'Original',
        description: 'Original description',
        target_url: 'https://original.com',
      });

      await repository.update(id, {
        name: 'Updated',
        description: 'Updated description',
        target_url: 'https://updated.com',
        status: 'testing' as ProjectStatus,
      });

      const project = await repository.getById(id);
      expect(project?.name).toBe('Updated');
      expect(project?.description).toBe('Updated description');
      expect(project?.target_url).toBe('https://updated.com');
      expect(project?.status).toBe('testing');
    });

    it('should update timestamp on update', async () => {
      const id = await repository.create({ name: 'Timestamped' });
      const originalProject = await repository.getById(id);
      const originalUpdatedDate = originalProject?.updated_date;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.update(id, { name: 'Updated' });

      const updatedProject = await repository.getById(id);
      expect(updatedProject?.updated_date).toBeGreaterThan(originalUpdatedDate!);
      expect(updatedProject?.created_date).toBe(originalProject?.created_date);
    });

    it('should preserve unchanged fields', async () => {
      const id = await repository.create({
        name: 'Original',
        description: 'Preserved description',
        target_url: 'https://preserved.com',
      });

      await repository.update(id, { name: 'Updated Name Only' });

      const project = await repository.getById(id);
      expect(project?.name).toBe('Updated Name Only');
      expect(project?.description).toBe('Preserved description');
      expect(project?.target_url).toBe('https://preserved.com');
    });

    it('should handle non-existent ID gracefully', async () => {
      // Should not throw
      await expect(
        repository.update(99999, { name: 'Ghost Update' })
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // DELETE TESTS
  // ==========================================================================

  describe('delete', () => {
    it('should delete existing project', async () => {
      const id = await repository.create({ name: 'To Be Deleted' });

      await repository.delete(id);

      const project = await repository.getById(id);
      expect(project).toBeUndefined();
    });

    it('should not affect other projects when deleting', async () => {
      const id1 = await repository.create({ name: 'Keep Me' });
      const id2 = await repository.create({ name: 'Delete Me' });
      const id3 = await repository.create({ name: 'Keep Me Too' });

      await repository.delete(id2);

      const projects = await repository.getAll();
      expect(projects).toHaveLength(2);
      expect(projects.map(p => p.name)).toContain('Keep Me');
      expect(projects.map(p => p.name)).toContain('Keep Me Too');
      expect(projects.map(p => p.name)).not.toContain('Delete Me');
    });

    it('should handle non-existent ID gracefully', async () => {
      await expect(repository.delete(99999)).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // STEPS UPDATE TESTS
  // ==========================================================================

  describe('updateSteps', () => {
    it('should update recorded steps', async () => {
      const id = await repository.create({ name: 'Steps Project' });

      const steps = [
        { id: '1', name: 'Click button', event: 'click', path: '//button', value: '', label: 'Submit' },
        { id: '2', name: 'Enter text', event: 'input', path: '//input', value: 'test', label: 'Name' },
      ];

      await repository.updateSteps(id, steps);

      const project = await repository.getById(id);
      expect(project?.recorded_steps).toHaveLength(2);
      expect(project?.recorded_steps?.[0].name).toBe('Click button');
      expect(project?.recorded_steps?.[1].name).toBe('Enter text');
    });

    it('should replace all steps', async () => {
      const id = await repository.create({ name: 'Steps Project' });

      // Add initial steps
      await repository.updateSteps(id, [
        { id: '1', name: 'Step 1', event: 'click', path: '//a', value: '', label: 'Link' },
      ]);

      // Replace with new steps
      await repository.updateSteps(id, [
        { id: '2', name: 'Step 2', event: 'input', path: '//input', value: 'x', label: 'Input' },
        { id: '3', name: 'Step 3', event: 'click', path: '//button', value: '', label: 'Btn' },
      ]);

      const project = await repository.getById(id);
      expect(project?.recorded_steps).toHaveLength(2);
      expect(project?.recorded_steps?.[0].name).toBe('Step 2');
      expect(project?.recorded_steps?.[1].name).toBe('Step 3');
    });
  });

  // ==========================================================================
  // FIELDS UPDATE TESTS
  // ==========================================================================

  describe('updateFields', () => {
    it('should update parsed fields', async () => {
      const id = await repository.create({ name: 'Fields Project' });

      const fields = [
        { field_name: 'username', mapped: true, inputvarfields: 'Username' },
        { field_name: 'password', mapped: false, inputvarfields: '' },
      ];

      await repository.updateFields(id, fields);

      const project = await repository.getById(id);
      expect(project?.parsed_fields).toHaveLength(2);
      expect(project?.parsed_fields?.[0].field_name).toBe('username');
      expect(project?.parsed_fields?.[0].mapped).toBe(true);
    });
  });

  // ==========================================================================
  // CSV DATA UPDATE TESTS
  // ==========================================================================

  describe('updateCsvData', () => {
    it('should update CSV data', async () => {
      const id = await repository.create({ name: 'CSV Project' });

      const csvData = [
        { username: 'user1', password: 'pass1' },
        { username: 'user2', password: 'pass2' },
        { username: 'user3', password: 'pass3' },
      ];

      await repository.updateCsvData(id, csvData);

      const project = await repository.getById(id);
      expect(project?.csv_data).toHaveLength(3);
      expect(project?.csv_data?.[0].username).toBe('user1');
      expect(project?.csv_data?.[2].password).toBe('pass3');
    });

    it('should handle large CSV datasets', async () => {
      const id = await repository.create({ name: 'Large CSV Project' });

      // Generate 1000 rows
      const csvData = Array.from({ length: 1000 }, (_, i) => ({
        row_id: i + 1,
        value: `Value ${i + 1}`,
      }));

      await repository.updateCsvData(id, csvData);

      const project = await repository.getById(id);
      expect(project?.csv_data).toHaveLength(1000);
      expect(project?.csv_data?.[999].row_id).toBe(1000);
    });
  });

  // ==========================================================================
  // CONCURRENT OPERATIONS TESTS
  // ==========================================================================

  describe('concurrent operations', () => {
    it('should handle concurrent creates', async () => {
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        repository.create({ name: `Concurrent ${i}` })
      );

      const ids = await Promise.all(createPromises);

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);

      // All projects should exist
      const projects = await repository.getAll();
      expect(projects).toHaveLength(10);
    });

    it('should handle concurrent reads and writes', async () => {
      const id = await repository.create({ name: 'Concurrent RW' });

      const operations = [
        repository.update(id, { name: 'Update 1' }),
        repository.getById(id),
        repository.update(id, { name: 'Update 2' }),
        repository.getById(id),
        repository.update(id, { name: 'Update 3' }),
      ];

      await Promise.all(operations);

      // Final state should reflect one of the updates
      const project = await repository.getById(id);
      expect(['Update 1', 'Update 2', 'Update 3']).toContain(project?.name);
    });
  });
});
