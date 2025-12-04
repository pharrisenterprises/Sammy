/**
 * Tests for ProjectHandlers
 * @module background/handlers/ProjectHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProjectHandlers,
  createProjectHandlers,
  PROJECT_ACTIONS,
  type IProjectStorage,
} from './ProjectHandlers';
import type { BackgroundMessage, MessageSender } from '../IBackgroundService';
import type { Project } from '../../storage/schemas/Project';

// ============================================================================
// MOCK FACTORY
// ============================================================================

function createMockStorage(): IProjectStorage {
  const projects = new Map<number, Project>();
  let nextId = 1;

  return {
    addProject: vi.fn(async (project) => {
      const id = nextId++;
      projects.set(id, { ...project, id } as Project);
      return id;
    }),
    updateProject: vi.fn(async (id, updates) => {
      const existing = projects.get(id);
      if (existing) {
        projects.set(id, { ...existing, ...updates });
      }
    }),
    getAllProjects: vi.fn(async () => {
      return Array.from(projects.values());
    }),
    getProjectById: vi.fn(async (id) => {
      return projects.get(id);
    }),
    deleteProject: vi.fn(async (id) => {
      projects.delete(id);
    }),
  };
}

function createMessage(action: string, payload?: unknown): BackgroundMessage {
  return { action, payload };
}

const mockSender: MessageSender = {};

// ============================================================================
// TESTS
// ============================================================================

describe('ProjectHandlers', () => {
  let handlers: ProjectHandlers;
  let mockStorage: IProjectStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    handlers = new ProjectHandlers(mockStorage);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // ADD PROJECT TESTS
  // ==========================================================================

  describe('handleAddProject', () => {
    it('should create a new project', async () => {
      const message = createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
        name: 'Test Project',
        target_url: 'https://example.com',
      });

      const response = await handlers.handleAddProject(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.id).toBe(1);
      expect(mockStorage.addProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Project',
          target_url: 'https://example.com',
          recorded_steps: [],
          parsed_fields: [],
          csv_data: [],
        })
      );
    });

    it('should set default status to draft', async () => {
      const message = createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
        name: 'Test Project',
        target_url: 'https://example.com',
      });

      await handlers.handleAddProject(message, mockSender);

      expect(mockStorage.addProject).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' })
      );
    });

    it('should accept optional description', async () => {
      const message = createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
        name: 'Test Project',
        target_url: 'https://example.com',
        description: 'Test description',
      });

      await handlers.handleAddProject(message, mockSender);

      expect(mockStorage.addProject).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Test description' })
      );
    });

    it('should fail without name', async () => {
      const message = createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
        target_url: 'https://example.com',
      });

      const response = await handlers.handleAddProject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('name');
    });

    it('should fail without target_url', async () => {
      const message = createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
        name: 'Test Project',
      });

      const response = await handlers.handleAddProject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('URL');
    });

    it('should handle storage errors', async () => {
      vi.mocked(mockStorage.addProject).mockRejectedValue(new Error('DB error'));

      const message = createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
        name: 'Test Project',
        target_url: 'https://example.com',
      });

      const response = await handlers.handleAddProject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toBe('DB error');
    });
  });

  // ==========================================================================
  // UPDATE PROJECT TESTS
  // ==========================================================================

  describe('handleUpdateProject', () => {
    it('should update project', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT, {
        id: 1,
        name: 'Updated Name',
      });

      const response = await handlers.handleUpdateProject(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Updated Name' })
      );
    });

    it('should update multiple fields', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT, {
        id: 1,
        name: 'Updated Name',
        description: 'Updated description',
        status: 'recorded',
      });

      await handlers.handleUpdateProject(message, mockSender);

      expect(mockStorage.updateProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          status: 'recorded',
        })
      );
    });

    it('should set updated_date', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT, {
        id: 1,
        name: 'Updated',
      });

      await handlers.handleUpdateProject(message, mockSender);

      expect(mockStorage.updateProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          updated_date: expect.any(String),
        })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT, {
        name: 'Updated Name',
      });

      const response = await handlers.handleUpdateProject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ID');
    });
  });

  // ==========================================================================
  // GET ALL PROJECTS TESTS
  // ==========================================================================

  describe('handleGetAllProjects', () => {
    it('should return all projects', async () => {
      // Add some projects first
      await handlers.handleAddProject(
        createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
          name: 'Project 1',
          target_url: 'https://example1.com',
        }),
        mockSender
      );
      await handlers.handleAddProject(
        createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
          name: 'Project 2',
          target_url: 'https://example2.com',
        }),
        mockSender
      );

      const message = createMessage(PROJECT_ACTIONS.GET_ALL_PROJECTS);
      const response = await handlers.handleGetAllProjects(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.projects).toHaveLength(2);
    });

    it('should return empty array when no projects', async () => {
      const message = createMessage(PROJECT_ACTIONS.GET_ALL_PROJECTS);
      const response = await handlers.handleGetAllProjects(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.projects).toHaveLength(0);
    });
  });

  // ==========================================================================
  // GET PROJECT BY ID TESTS
  // ==========================================================================

  describe('handleGetProjectById', () => {
    it('should return project by id', async () => {
      // Add a project first
      await handlers.handleAddProject(
        createMessage(PROJECT_ACTIONS.ADD_PROJECT, {
          name: 'Test Project',
          target_url: 'https://example.com',
        }),
        mockSender
      );

      const message = createMessage(PROJECT_ACTIONS.GET_PROJECT_BY_ID, { id: 1 });
      const response = await handlers.handleGetProjectById(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.project.name).toBe('Test Project');
    });

    it('should fail for non-existent project', async () => {
      const message = createMessage(PROJECT_ACTIONS.GET_PROJECT_BY_ID, { id: 999 });
      const response = await handlers.handleGetProjectById(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should fail without id', async () => {
      const message = createMessage(PROJECT_ACTIONS.GET_PROJECT_BY_ID, {});
      const response = await handlers.handleGetProjectById(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ID');
    });
  });

  // ==========================================================================
  // DELETE PROJECT TESTS
  // ==========================================================================

  describe('handleDeleteProject', () => {
    it('should delete project', async () => {
      const message = createMessage(PROJECT_ACTIONS.DELETE_PROJECT, { id: 1 });
      const response = await handlers.handleDeleteProject(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.deleteProject).toHaveBeenCalledWith(1);
    });

    it('should fail without id', async () => {
      const message = createMessage(PROJECT_ACTIONS.DELETE_PROJECT, {});
      const response = await handlers.handleDeleteProject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ID');
    });
  });

  // ==========================================================================
  // UPDATE PROJECT STEPS TESTS
  // ==========================================================================

  describe('handleUpdateProjectSteps', () => {
    it('should update recorded_steps', async () => {
      const steps = [
        { id: 1, event: 'click', label: 'Button', xpath: '//button' },
      ];
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_STEPS, {
        id: 1,
        recorded_steps: steps,
      });

      const response = await handlers.handleUpdateProjectSteps(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ recorded_steps: steps })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_STEPS, {
        recorded_steps: [],
      });

      const response = await handlers.handleUpdateProjectSteps(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('ID');
    });

    it('should fail without array', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_STEPS, {
        id: 1,
        recorded_steps: 'not an array',
      });

      const response = await handlers.handleUpdateProjectSteps(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('array');
    });
  });

  // ==========================================================================
  // UPDATE PROJECT FIELDS TESTS
  // ==========================================================================

  describe('handleUpdateProjectFields', () => {
    it('should update parsed_fields', async () => {
      const fields = [
        { field_name: 'email', mapped: true, inputvarfields: 'Email Field' },
      ];
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_FIELDS, {
        id: 1,
        parsed_fields: fields,
      });

      const response = await handlers.handleUpdateProjectFields(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ parsed_fields: fields })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_FIELDS, {
        parsed_fields: [],
      });

      const response = await handlers.handleUpdateProjectFields(message, mockSender);

      expect(response.success).toBe(false);
    });

    it('should fail without array', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_FIELDS, {
        id: 1,
        parsed_fields: null,
      });

      const response = await handlers.handleUpdateProjectFields(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('array');
    });
  });

  // ==========================================================================
  // UPDATE PROJECT CSV TESTS
  // ==========================================================================

  describe('handleUpdateProjectCsv', () => {
    it('should update csv_data', async () => {
      const csvData = [
        { email: 'test@example.com', name: 'Test User' },
      ];
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_CSV, {
        id: 1,
        csv_data: csvData,
      });

      const response = await handlers.handleUpdateProjectCsv(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockStorage.updateProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ csv_data: csvData })
      );
    });

    it('should fail without id', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_CSV, {
        csv_data: [],
      });

      const response = await handlers.handleUpdateProjectCsv(message, mockSender);

      expect(response.success).toBe(false);
    });

    it('should fail without array', async () => {
      const message = createMessage(PROJECT_ACTIONS.UPDATE_PROJECT_CSV, {
        id: 1,
        csv_data: {},
      });

      const response = await handlers.handleUpdateProjectCsv(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('array');
    });
  });

  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================

  describe('registration', () => {
    it('should return all handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(8);
      expect(entries.every(e => e.category === 'project')).toBe(true);
    });

    it('should have all action names', () => {
      const entries = handlers.getHandlerEntries();
      const actions = entries.map(e => e.action);

      expect(actions).toContain(PROJECT_ACTIONS.ADD_PROJECT);
      expect(actions).toContain(PROJECT_ACTIONS.UPDATE_PROJECT);
      expect(actions).toContain(PROJECT_ACTIONS.GET_ALL_PROJECTS);
      expect(actions).toContain(PROJECT_ACTIONS.GET_PROJECT_BY_ID);
      expect(actions).toContain(PROJECT_ACTIONS.DELETE_PROJECT);
      expect(actions).toContain(PROJECT_ACTIONS.UPDATE_PROJECT_STEPS);
      expect(actions).toContain(PROJECT_ACTIONS.UPDATE_PROJECT_FIELDS);
      expect(actions).toContain(PROJECT_ACTIONS.UPDATE_PROJECT_CSV);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createProjectHandlers', () => {
  it('should create instance', () => {
    const storage = createMockStorage();
    const handlers = createProjectHandlers(storage);

    expect(handlers).toBeInstanceOf(ProjectHandlers);
  });
});
