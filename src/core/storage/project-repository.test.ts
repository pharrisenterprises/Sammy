/**
 * @fileoverview Tests for Project repository
 * @module core/storage/project-repository.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  ProjectRepository,
  projectRepository,
  getProjectRepository
} from './project-repository';
import { Database, deleteDatabase } from './db';
import type { Step, Field } from '../types';
import { createStep } from '../types';

describe('ProjectRepository', () => {
  let repo: ProjectRepository;

  beforeEach(async () => {
    Database.resetInstance();
    await deleteDatabase();
    repo = new ProjectRepository();
  });

  afterEach(async () => {
    Database.resetInstance();
  });

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create a project', async () => {
        const result = await repo.create({
          name: 'Test Project',
          target_url: 'https://example.com'
        });

        expect(result.success).toBe(true);
        expect(result.data?.id).toBeDefined();
        expect(result.data?.name).toBe('Test Project');
        expect(result.data?.status).toBe('draft');
      });

      it('should create with optional description', async () => {
        const result = await repo.create({
          name: 'Test',
          description: 'My description',
          target_url: 'https://example.com'
        });

        expect(result.success).toBe(true);
        expect(result.data?.description).toBe('My description');
      });

      it('should return error for invalid input', async () => {
        const result = await repo.create({
          name: '',
          target_url: 'https://example.com'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('getById', () => {
      it('should return project by id', async () => {
        const createResult = await repo.create({
          name: 'Test',
          target_url: 'https://example.com'
        });

        const result = await repo.getById(createResult.data!.id!);

        expect(result.success).toBe(true);
        expect(result.data?.name).toBe('Test');
      });

      it('should return null for non-existent id', async () => {
        const result = await repo.getById(99999);

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });
    });

    describe('getAll', () => {
      it('should return empty array when no projects', async () => {
        const result = await repo.getAll();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should return all projects', async () => {
        await repo.create({ name: 'P1', target_url: 'https://1.com' });
        await repo.create({ name: 'P2', target_url: 'https://2.com' });
        await repo.create({ name: 'P3', target_url: 'https://3.com' });

        const result = await repo.getAll();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
      });

      it('should filter by status', async () => {
        await repo.create({ name: 'Draft', target_url: 'https://1.com' });
        const testing = await repo.create({ name: 'Testing', target_url: 'https://2.com' });
        await repo.updateStatus(testing.data!.id!, 'testing');

        const result = await repo.getAll({ status: 'testing' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].name).toBe('Testing');
      });

      it('should sort by name ascending', async () => {
        await repo.create({ name: 'Charlie', target_url: 'https://c.com' });
        await repo.create({ name: 'Alpha', target_url: 'https://a.com' });
        await repo.create({ name: 'Beta', target_url: 'https://b.com' });

        const result = await repo.getAll({ sortBy: 'name', sortOrder: 'asc' });

        expect(result.data![0].name).toBe('Alpha');
        expect(result.data![1].name).toBe('Beta');
        expect(result.data![2].name).toBe('Charlie');
      });

      it('should sort by updated_date descending', async () => {
        await repo.create({ name: 'First', target_url: 'https://1.com' });
        await new Promise(r => setTimeout(r, 10)); // Small delay
        await repo.create({ name: 'Second', target_url: 'https://2.com' });

        const result = await repo.getAll({ sortBy: 'updated_date', sortOrder: 'desc' });

        expect(result.data![0].name).toBe('Second');
        expect(result.data![1].name).toBe('First');
      });

      it('should apply pagination', async () => {
        await repo.create({ name: 'P1', target_url: 'https://1.com' });
        await repo.create({ name: 'P2', target_url: 'https://2.com' });
        await repo.create({ name: 'P3', target_url: 'https://3.com' });
        await repo.create({ name: 'P4', target_url: 'https://4.com' });

        const result = await repo.getAll({ offset: 1, limit: 2 });

        expect(result.data).toHaveLength(2);
      });
    });

    describe('getSummaries', () => {
      it('should return project summaries', async () => {
        await repo.create({ name: 'Test', target_url: 'https://test.com' });

        const result = await repo.getSummaries();

        expect(result.success).toBe(true);
        expect(result.data![0]).toHaveProperty('step_count');
        expect(result.data![0]).not.toHaveProperty('recorded_steps');
      });
    });

    describe('update', () => {
      it('should update project fields', async () => {
        const created = await repo.create({
          name: 'Original',
          target_url: 'https://original.com'
        });

        const result = await repo.update(created.data!.id!, {
          name: 'Updated',
          description: 'New description'
        });

        expect(result.success).toBe(true);
        expect(result.data?.name).toBe('Updated');
        expect(result.data?.description).toBe('New description');
      });

      it('should return error for non-existent project', async () => {
        const result = await repo.update(99999, { name: 'New' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });

      it('should validate status', async () => {
        const created = await repo.create({
          name: 'Test',
          target_url: 'https://test.com'
        });

        const result = await repo.update(created.data!.id!, {
          status: 'invalid' as any
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });
    });

    describe('delete', () => {
      it('should delete project', async () => {
        const created = await repo.create({
          name: 'To Delete',
          target_url: 'https://delete.com'
        });

        const result = await repo.delete(created.data!.id!);

        expect(result.success).toBe(true);
        
        const check = await repo.getById(created.data!.id!);
        expect(check.data).toBeNull();
      });

      it('should return error for non-existent project', async () => {
        const result = await repo.delete(99999);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });
  });

  // ==========================================================================
  // STATUS OPERATIONS
  // ==========================================================================

  describe('Status Operations', () => {
    it('should update status', async () => {
      const created = await repo.create({
        name: 'Test',
        target_url: 'https://test.com'
      });

      const result = await repo.updateStatus(created.data!.id!, 'testing');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('testing');
    });

    it('should mark as testing', async () => {
      const created = await repo.create({
        name: 'Test',
        target_url: 'https://test.com'
      });

      const result = await repo.markAsTesting(created.data!.id!);

      expect(result.data?.status).toBe('testing');
    });

    it('should mark as complete', async () => {
      const created = await repo.create({
        name: 'Test',
        target_url: 'https://test.com'
      });

      const result = await repo.markAsComplete(created.data!.id!);

      expect(result.data?.status).toBe('complete');
    });

    it('should reset to draft', async () => {
      const created = await repo.create({
        name: 'Test',
        target_url: 'https://test.com'
      });
      await repo.markAsComplete(created.data!.id!);

      const result = await repo.resetToDraft(created.data!.id!);

      expect(result.data?.status).toBe('draft');
    });
  });

  // ==========================================================================
  // STEP OPERATIONS
  // ==========================================================================

  describe('Step Operations', () => {
    let projectId: number;

    beforeEach(async () => {
      const created = await repo.create({
        name: 'Step Test',
        target_url: 'https://step.com'
      });
      projectId = created.data!.id!;
    });

    describe('getSteps', () => {
      it('should return empty array initially', async () => {
        const result = await repo.getSteps(projectId);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });

    describe('updateSteps', () => {
      it('should update all steps', async () => {
        const steps: Step[] = [
          createStep({ event: 'click', path: '/x', x: 0, y: 0 }),
          createStep({ event: 'input', path: '/y', x: 10, y: 20, value: 'test' })
        ];

        const result = await repo.updateSteps(projectId, steps);

        expect(result.success).toBe(true);
        
        const getResult = await repo.getSteps(projectId);
        expect(getResult.data).toHaveLength(2);
      });
    });

    describe('addStep', () => {
      it('should add a step', async () => {
        const step = createStep({ event: 'click', path: '/button', x: 100, y: 200 });

        const result = await repo.addStep(projectId, step);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].event).toBe('click');
      });

      it('should append to existing steps', async () => {
        const step1 = createStep({ event: 'click', path: '/btn1', x: 0, y: 0 });
        const step2 = createStep({ event: 'click', path: '/btn2', x: 10, y: 10 });

        await repo.addStep(projectId, step1);
        const result = await repo.addStep(projectId, step2);

        expect(result.data).toHaveLength(2);
      });
    });

    describe('updateStep', () => {
      it('should update a specific step', async () => {
        const step = createStep({ event: 'click', path: '/button', x: 100, y: 200, label: 'Old' });
        await repo.addStep(projectId, step);

        const result = await repo.updateStep(projectId, step.id, { label: 'New' });

        expect(result.success).toBe(true);
        expect(result.data![0].label).toBe('New');
      });

      it('should return error for non-existent step', async () => {
        const result = await repo.updateStep(projectId, 'non-existent', { label: 'New' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Step not found');
      });
    });

    describe('deleteStep', () => {
      it('should delete a step', async () => {
        const step1 = createStep({ event: 'click', path: '/btn1', x: 0, y: 0 });
        const step2 = createStep({ event: 'click', path: '/btn2', x: 10, y: 10 });
        await repo.addStep(projectId, step1);
        await repo.addStep(projectId, step2);

        const result = await repo.deleteStep(projectId, step1.id);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].id).toBe(step2.id);
      });
    });

    describe('reorderSteps', () => {
      it('should reorder steps', async () => {
        const step1 = createStep({ event: 'click', path: '/btn1', x: 0, y: 0, label: 'First' });
        const step2 = createStep({ event: 'click', path: '/btn2', x: 10, y: 10, label: 'Second' });
        const step3 = createStep({ event: 'click', path: '/btn3', x: 20, y: 20, label: 'Third' });
        await repo.addStep(projectId, step1);
        await repo.addStep(projectId, step2);
        await repo.addStep(projectId, step3);

        const result = await repo.reorderSteps(projectId, 0, 2);

        expect(result.success).toBe(true);
        expect(result.data![0].label).toBe('Second');
        expect(result.data![1].label).toBe('Third');
        expect(result.data![2].label).toBe('First');
      });

      it('should validate indices', async () => {
        const result = await repo.reorderSteps(projectId, -1, 0);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid');
      });
    });

    describe('clearSteps', () => {
      it('should clear all steps', async () => {
        await repo.addStep(projectId, createStep({ event: 'click', path: '/x', x: 0, y: 0 }));
        await repo.addStep(projectId, createStep({ event: 'click', path: '/y', x: 0, y: 0 }));

        const result = await repo.clearSteps(projectId);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // FIELD OPERATIONS
  // ==========================================================================

  describe('Field Operations', () => {
    let projectId: number;

    beforeEach(async () => {
      const created = await repo.create({
        name: 'Field Test',
        target_url: 'https://field.com'
      });
      projectId = created.data!.id!;
    });

    describe('getFields', () => {
      it('should return empty array initially', async () => {
        const result = await repo.getFields(projectId);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });

    describe('updateFields', () => {
      it('should update all fields', async () => {
        const fields: Field[] = [
          { field_name: 'username', mapped: true, inputvarfields: 'Username' },
          { field_name: 'password', mapped: true, inputvarfields: 'Password' }
        ];

        const result = await repo.updateFields(projectId, fields);

        expect(result.success).toBe(true);
        
        const getResult = await repo.getFields(projectId);
        expect(getResult.data).toHaveLength(2);
      });
    });

    describe('clearFields', () => {
      it('should clear all fields', async () => {
        await repo.updateFields(projectId, [
          { field_name: 'test', mapped: false, inputvarfields: '' }
        ]);

        const result = await repo.clearFields(projectId);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  describe('Query Operations', () => {
    describe('searchByName', () => {
      it('should find projects by name', async () => {
        await repo.create({ name: 'Login Test', target_url: 'https://1.com' });
        await repo.create({ name: 'Signup Test', target_url: 'https://2.com' });
        await repo.create({ name: 'Dashboard', target_url: 'https://3.com' });

        const result = await repo.searchByName('test');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });

      it('should be case-insensitive', async () => {
        await repo.create({ name: 'LOGIN Test', target_url: 'https://1.com' });

        const result = await repo.searchByName('login');

        expect(result.data).toHaveLength(1);
      });
    });

    describe('exists', () => {
      it('should return true for existing project', async () => {
        const created = await repo.create({
          name: 'Test',
          target_url: 'https://test.com'
        });

        const exists = await repo.exists(created.data!.id!);

        expect(exists).toBe(true);
      });

      it('should return false for non-existent project', async () => {
        const exists = await repo.exists(99999);

        expect(exists).toBe(false);
      });
    });

    describe('count', () => {
      it('should return total count', async () => {
        await repo.create({ name: 'P1', target_url: 'https://1.com' });
        await repo.create({ name: 'P2', target_url: 'https://2.com' });

        const result = await repo.count();

        expect(result.success).toBe(true);
        expect(result.data).toBe(2);
      });

      it('should count by status', async () => {
        await repo.create({ name: 'P1', target_url: 'https://1.com' });
        const p2 = await repo.create({ name: 'P2', target_url: 'https://2.com' });
        await repo.markAsTesting(p2.data!.id!);

        const result = await repo.count('testing');

        expect(result.data).toBe(1);
      });
    });
  });

  // ==========================================================================
  // DUPLICATE OPERATION
  // ==========================================================================

  describe('Duplicate Operation', () => {
    it('should duplicate a project', async () => {
      const original = await repo.create({
        name: 'Original',
        description: 'Original description',
        target_url: 'https://original.com'
      });

      const result = await repo.duplicate(original.data!.id!);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Original (Copy)');
      expect(result.data?.description).toBe('Original description');
      expect(result.data?.id).not.toBe(original.data!.id);
    });

    it('should use custom name', async () => {
      const original = await repo.create({
        name: 'Original',
        target_url: 'https://original.com'
      });

      const result = await repo.duplicate(original.data!.id!, 'My Custom Name');

      expect(result.data?.name).toBe('My Custom Name');
    });

    it('should copy steps', async () => {
      const original = await repo.create({
        name: 'Original',
        target_url: 'https://original.com'
      });
      await repo.addStep(original.data!.id!, createStep({ event: 'click', path: '/x', x: 0, y: 0 }));

      const result = await repo.duplicate(original.data!.id!);
      const steps = await repo.getSteps(result.data!.id!);

      expect(steps.data).toHaveLength(1);
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('projectRepository should be available', () => {
      expect(projectRepository).toBeInstanceOf(ProjectRepository);
    });

    it('getProjectRepository should return instance', () => {
      expect(getProjectRepository()).toBe(projectRepository);
    });
  });
});
