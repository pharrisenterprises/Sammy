/**
 * @fileoverview Tests for Project type definitions
 * @module core/types/project.test
 */

import { describe, it, expect } from 'vitest';
import {
  type Project,
  type ProjectStatus,
  type CreateProjectInput,
  PROJECT_STATUSES,
  DEFAULT_PROJECT_STATUS,
  isProjectStatus,
  isProject,
  createProject,
  toProjectSummary,
  validateProject,
  isValidProject
} from './project';

describe('Project Types', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('PROJECT_STATUSES', () => {
    it('should contain exactly 3 valid statuses', () => {
      expect(PROJECT_STATUSES).toHaveLength(3);
      expect(PROJECT_STATUSES).toContain('draft');
      expect(PROJECT_STATUSES).toContain('testing');
      expect(PROJECT_STATUSES).toContain('complete');
    });

    it('should NOT contain invalid statuses', () => {
      expect(PROJECT_STATUSES).not.toContain('ready');
      expect(PROJECT_STATUSES).not.toContain('running');
      expect(PROJECT_STATUSES).not.toContain('archived');
      expect(PROJECT_STATUSES).not.toContain('active');
      expect(PROJECT_STATUSES).not.toContain('inactive');
    });
  });

  describe('DEFAULT_PROJECT_STATUS', () => {
    it('should be draft', () => {
      expect(DEFAULT_PROJECT_STATUS).toBe('draft');
    });
  });

  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe('isProjectStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isProjectStatus('draft')).toBe(true);
      expect(isProjectStatus('testing')).toBe(true);
      expect(isProjectStatus('complete')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isProjectStatus('ready')).toBe(false);
      expect(isProjectStatus('running')).toBe(false);
      expect(isProjectStatus('archived')).toBe(false);
      expect(isProjectStatus('')).toBe(false);
      expect(isProjectStatus(null)).toBe(false);
      expect(isProjectStatus(undefined)).toBe(false);
      expect(isProjectStatus(123)).toBe(false);
      expect(isProjectStatus({})).toBe(false);
    });
  });

  describe('isProject', () => {
    const validProject: Project = {
      id: 1,
      name: 'Test Project',
      description: 'A test project',
      status: 'draft',
      target_url: 'https://example.com',
      created_date: Date.now(),
      updated_date: Date.now(),
      recorded_steps: [],
      parsed_fields: [],
      csv_data: []
    };

    it('should return true for valid project', () => {
      expect(isProject(validProject)).toBe(true);
    });

    it('should return true for project without optional id', () => {
      const { id, ...projectWithoutId } = validProject;
      expect(isProject(projectWithoutId)).toBe(true);
    });

    it('should return true for project without optional arrays', () => {
      const minimalProject = {
        name: 'Test',
        description: '',
        status: 'draft' as ProjectStatus,
        target_url: 'https://example.com',
        created_date: Date.now(),
        updated_date: Date.now()
      };
      expect(isProject(minimalProject)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isProject(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isProject(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isProject('string')).toBe(false);
      expect(isProject(123)).toBe(false);
      expect(isProject([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isProject({ name: 'Test' })).toBe(false);
      expect(isProject({ ...validProject, name: undefined })).toBe(false);
      expect(isProject({ ...validProject, status: undefined })).toBe(false);
    });

    it('should return false for invalid status', () => {
      expect(isProject({ ...validProject, status: 'invalid' })).toBe(false);
      expect(isProject({ ...validProject, status: 'ready' })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isProject({ ...validProject, name: 123 })).toBe(false);
      expect(isProject({ ...validProject, created_date: '2024-01-01' })).toBe(false);
      expect(isProject({ ...validProject, recorded_steps: 'not an array' })).toBe(false);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('createProject', () => {
    it('should create project with defaults', () => {
      const input: CreateProjectInput = {
        name: 'New Project',
        target_url: 'https://example.com'
      };

      const project = createProject(input);

      expect(project.name).toBe('New Project');
      expect(project.description).toBe('');
      expect(project.status).toBe('draft');
      expect(project.target_url).toBe('https://example.com');
      expect(typeof project.created_date).toBe('number');
      expect(typeof project.updated_date).toBe('number');
      expect(project.recorded_steps).toEqual([]);
      expect(project.parsed_fields).toEqual([]);
      expect(project.csv_data).toEqual([]);
    });

    it('should use provided description', () => {
      const project = createProject({
        name: 'Test',
        description: 'My description',
        target_url: 'https://example.com'
      });

      expect(project.description).toBe('My description');
    });

    it('should use provided status', () => {
      const project = createProject({
        name: 'Test',
        target_url: 'https://example.com',
        status: 'testing'
      });

      expect(project.status).toBe('testing');
    });

    it('should trim whitespace from name and url', () => {
      const project = createProject({
        name: '  Trimmed Name  ',
        target_url: '  https://example.com  '
      });

      expect(project.name).toBe('Trimmed Name');
      expect(project.target_url).toBe('https://example.com');
    });

    it('should set created_date and updated_date to same value', () => {
      const project = createProject({
        name: 'Test',
        target_url: 'https://example.com'
      });

      expect(project.created_date).toBe(project.updated_date);
    });
  });

  describe('toProjectSummary', () => {
    it('should convert project to summary', () => {
      const project: Project = {
        id: 1,
        name: 'Test Project',
        description: 'Description',
        status: 'testing',
        target_url: 'https://example.com',
        created_date: 1000,
        updated_date: 2000,
        recorded_steps: [{ id: '1' }, { id: '2' }, { id: '3' }] as any[],
        parsed_fields: [],
        csv_data: []
      };

      const summary = toProjectSummary(project);

      expect(summary.id).toBe(1);
      expect(summary.name).toBe('Test Project');
      expect(summary.status).toBe('testing');
      expect(summary.target_url).toBe('https://example.com');
      expect(summary.step_count).toBe(3);
      expect(summary.updated_date).toBe(2000);
    });

    it('should throw for unsaved project', () => {
      const project: Project = {
        name: 'Test',
        description: '',
        status: 'draft',
        target_url: 'https://example.com',
        created_date: Date.now(),
        updated_date: Date.now()
      };

      expect(() => toProjectSummary(project)).toThrow('Cannot convert unsaved project');
    });

    it('should handle missing recorded_steps', () => {
      const project: Project = {
        id: 1,
        name: 'Test',
        description: '',
        status: 'draft',
        target_url: 'https://example.com',
        created_date: Date.now(),
        updated_date: Date.now()
      };

      const summary = toProjectSummary(project);
      expect(summary.step_count).toBe(0);
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateProject', () => {
    it('should return empty array for valid project', () => {
      const project: Partial<Project> = {
        name: 'Valid Project',
        status: 'draft',
        target_url: 'https://example.com',
        created_date: Date.now(),
        updated_date: Date.now()
      };

      expect(validateProject(project)).toEqual([]);
    });

    it('should return error for missing name', () => {
      const errors = validateProject({ target_url: 'https://example.com' });
      expect(errors).toContainEqual({ field: 'name', message: expect.any(String) });
    });

    it('should return error for empty name', () => {
      const errors = validateProject({ name: '   ', target_url: 'https://example.com' });
      expect(errors).toContainEqual({ field: 'name', message: expect.any(String) });
    });

    it('should return error for name exceeding 255 characters', () => {
      const errors = validateProject({ 
        name: 'a'.repeat(256), 
        target_url: 'https://example.com' 
      });
      expect(errors).toContainEqual({ field: 'name', message: expect.any(String) });
    });

    it('should return error for invalid status', () => {
      const errors = validateProject({ 
        name: 'Test',
        status: 'invalid' as ProjectStatus,
        target_url: 'https://example.com'
      });
      expect(errors).toContainEqual({ field: 'status', message: expect.any(String) });
    });

    it('should return error for missing target_url', () => {
      const errors = validateProject({ name: 'Test' });
      expect(errors).toContainEqual({ field: 'target_url', message: expect.any(String) });
    });

    it('should return error for invalid URL format', () => {
      const errors = validateProject({ 
        name: 'Test',
        target_url: 'not a valid url'
      });
      expect(errors).toContainEqual({ field: 'target_url', message: expect.any(String) });
    });

    it('should return multiple errors for multiple issues', () => {
      const errors = validateProject({});
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('isValidProject', () => {
    it('should return true for valid project', () => {
      expect(isValidProject({
        name: 'Test',
        target_url: 'https://example.com'
      })).toBe(true);
    });

    it('should return false for invalid project', () => {
      expect(isValidProject({})).toBe(false);
      expect(isValidProject({ name: '' })).toBe(false);
    });
  });
});
