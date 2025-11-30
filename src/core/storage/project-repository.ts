/**
 * @fileoverview Project repository with business logic for project operations
 * @module core/storage/project-repository
 * @version 1.0.0
 * 
 * This module provides a high-level API for Project operations,
 * encapsulating database access and business logic.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 3 for storage specifications
 * @see storage-layer_breakdown.md for architecture details
 */

import { Database, getDatabase } from './db';
import type {
  Project,
  ProjectStatus,
  Step,
  Field,
  CreateProjectInput,
  ProjectSummary
} from '../types';
import {
  createProject as createProjectObject,
  toProjectSummary,
  validateProject
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for listing projects
 */
export interface ListProjectsOptions {
  /** Filter by status */
  status?: ProjectStatus;
  /** Sort field */
  sortBy?: 'name' | 'updated_date' | 'created_date';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of a project operation
 */
export interface ProjectOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Project with computed metadata
 */
export interface ProjectWithMetadata extends Project {
  stepCount: number;
  mappedFieldCount: number;
  lastTestRunStatus?: string;
}

// ============================================================================
// PROJECT REPOSITORY CLASS
// ============================================================================

/**
 * Repository for Project operations
 * 
 * Provides high-level API with business logic for managing projects,
 * including validation, steps, and fields management.
 * 
 * @example
 * ```typescript
 * const repo = new ProjectRepository();
 * 
 * // Create a project
 * const result = await repo.create({
 *   name: 'Login Test',
 *   target_url: 'https://example.com/login'
 * });
 * 
 * if (result.success) {
 *   console.log('Created project:', result.data);
 * }
 * 
 * // Add steps to project
 * await repo.addStep(result.data.id, {
 *   event: 'click',
 *   path: '/html/body/button',
 *   x: 100,
 *   y: 200
 * });
 * ```
 */
export class ProjectRepository {
  private db: Database | null = null;

  /**
   * Get database instance (lazy initialization)
   */
  private async getDb(): Promise<Database> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new project
   * 
   * @param input - Project creation data
   * @returns Operation result with created project
   */
  async create(input: CreateProjectInput): Promise<ProjectOperationResult<Project>> {
    try {
      // Validate input
      const projectData = createProjectObject(input);
      const errors = validateProject(projectData);
      
      if (errors.length > 0) {
        return {
          success: false,
          error: errors.map(e => e.message).join(', ')
        };
      }

      const db = await this.getDb();
      const project = await db.addProject(projectData);

      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project'
      };
    }
  }

  /**
   * Get a project by ID
   * 
   * @param id - Project ID
   * @returns Operation result with project or null
   */
  async getById(id: number): Promise<ProjectOperationResult<Project | null>> {
    try {
      const db = await this.getDb();
      const project = await db.getProject(id);

      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project'
      };
    }
  }

  /**
   * Get all projects
   * 
   * @param options - List options (filtering, sorting, pagination)
   * @returns Operation result with projects array
   */
  async getAll(options: ListProjectsOptions = {}): Promise<ProjectOperationResult<Project[]>> {
    try {
      const db = await this.getDb();
      let projects: Project[];

      // Get projects (optionally filtered by status)
      if (options.status) {
        projects = await db.getProjectsByStatus(options.status);
      } else {
        projects = await db.getAllProjects();
      }

      // Sort
      if (options.sortBy) {
        const sortField = options.sortBy;
        const sortMultiplier = options.sortOrder === 'asc' ? 1 : -1;

        projects.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];

          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * sortMultiplier;
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return (aVal - bVal) * sortMultiplier;
          }
          return 0;
        });
      }

      // Pagination
      if (options.offset !== undefined || options.limit !== undefined) {
        const start = options.offset ?? 0;
        const end = options.limit ? start + options.limit : undefined;
        projects = projects.slice(start, end);
      }

      return { success: true, data: projects };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get projects'
      };
    }
  }

  /**
   * Get project summaries for list display
   * 
   * @param options - List options
   * @returns Operation result with project summaries
   */
  async getSummaries(options: ListProjectsOptions = {}): Promise<ProjectOperationResult<ProjectSummary[]>> {
    const result = await this.getAll(options);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const summaries = result.data
      .filter(p => p.id !== undefined)
      .map(p => toProjectSummary(p));

    return { success: true, data: summaries };
  }

  /**
   * Update a project
   * 
   * @param id - Project ID
   * @param updates - Fields to update
   * @returns Operation result with updated project
   */
  async update(
    id: number,
    updates: Partial<Omit<Project, 'id' | 'created_date'>>
  ): Promise<ProjectOperationResult<Project>> {
    try {
      const db = await this.getDb();
      
      // Check if project exists
      const existing = await db.getProject(id);
      if (!existing) {
        return { success: false, error: `Project not found: ${id}` };
      }

      // Validate status if provided
      if (updates.status !== undefined) {
        const validStatuses: ProjectStatus[] = ['draft', 'testing', 'complete'];
        if (!validStatuses.includes(updates.status)) {
          return { success: false, error: `Invalid status: ${updates.status}` };
        }
      }

      const project = await db.updateProject(id, updates);
      return { success: true, data: project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project'
      };
    }
  }

  /**
   * Delete a project
   * 
   * @param id - Project ID
   * @param deleteTestRuns - Whether to delete associated test runs
   * @returns Operation result
   */
  async delete(id: number, deleteTestRuns: boolean = true): Promise<ProjectOperationResult<boolean>> {
    try {
      const db = await this.getDb();

      // Check if project exists
      const existing = await db.getProject(id);
      if (!existing) {
        return { success: false, error: `Project not found: ${id}` };
      }

      // Delete associated test runs if requested
      if (deleteTestRuns) {
        await db.deleteTestRunsByProject(id);
      }

      await db.deleteProject(id);
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project'
      };
    }
  }

  // ==========================================================================
  // STATUS OPERATIONS
  // ==========================================================================

  /**
   * Update project status
   * 
   * @param id - Project ID
   * @param status - New status
   * @returns Operation result with updated project
   */
  async updateStatus(id: number, status: ProjectStatus): Promise<ProjectOperationResult<Project>> {
    return this.update(id, { status });
  }

  /**
   * Mark project as testing
   * 
   * @param id - Project ID
   * @returns Operation result with updated project
   */
  async markAsTesting(id: number): Promise<ProjectOperationResult<Project>> {
    return this.updateStatus(id, 'testing');
  }

  /**
   * Mark project as complete
   * 
   * @param id - Project ID
   * @returns Operation result with updated project
   */
  async markAsComplete(id: number): Promise<ProjectOperationResult<Project>> {
    return this.updateStatus(id, 'complete');
  }

  /**
   * Reset project to draft
   * 
   * @param id - Project ID
   * @returns Operation result with updated project
   */
  async resetToDraft(id: number): Promise<ProjectOperationResult<Project>> {
    return this.updateStatus(id, 'draft');
  }

  // ==========================================================================
  // STEP OPERATIONS
  // ==========================================================================

  /**
   * Get project steps
   * 
   * @param id - Project ID
   * @returns Operation result with steps array
   */
  async getSteps(id: number): Promise<ProjectOperationResult<Step[]>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    return { success: true, data: result.data.recorded_steps ?? [] };
  }

  /**
   * Update project steps (replace all)
   * 
   * @param id - Project ID
   * @param steps - New steps array
   * @returns Operation result with updated project
   */
  async updateSteps(id: number, steps: Step[]): Promise<ProjectOperationResult<Project>> {
    return this.update(id, { recorded_steps: steps });
  }

  /**
   * Add a step to project
   * 
   * @param id - Project ID
   * @param step - Step to add
   * @returns Operation result with updated steps
   */
  async addStep(id: number, step: Step): Promise<ProjectOperationResult<Step[]>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    const steps = [...(result.data.recorded_steps ?? []), step];
    const updateResult = await this.updateSteps(id, steps);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: steps };
  }

  /**
   * Update a specific step
   * 
   * @param projectId - Project ID
   * @param stepId - Step ID
   * @param updates - Step updates
   * @returns Operation result with updated steps
   */
  async updateStep(
    projectId: number,
    stepId: string,
    updates: Partial<Omit<Step, 'id'>>
  ): Promise<ProjectOperationResult<Step[]>> {
    const result = await this.getById(projectId);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    const steps = result.data.recorded_steps ?? [];
    const stepIndex = steps.findIndex(s => s.id === stepId);

    if (stepIndex === -1) {
      return { success: false, error: `Step not found: ${stepId}` };
    }

    const updatedSteps = [
      ...steps.slice(0, stepIndex),
      { ...steps[stepIndex], ...updates },
      ...steps.slice(stepIndex + 1)
    ];

    const updateResult = await this.updateSteps(projectId, updatedSteps);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: updatedSteps };
  }

  /**
   * Delete a step from project
   * 
   * @param projectId - Project ID
   * @param stepId - Step ID to delete
   * @returns Operation result with updated steps
   */
  async deleteStep(projectId: number, stepId: string): Promise<ProjectOperationResult<Step[]>> {
    const result = await this.getById(projectId);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    const steps = result.data.recorded_steps ?? [];
    const filteredSteps = steps.filter(s => s.id !== stepId);

    if (filteredSteps.length === steps.length) {
      return { success: false, error: `Step not found: ${stepId}` };
    }

    const updateResult = await this.updateSteps(projectId, filteredSteps);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: filteredSteps };
  }

  /**
   * Reorder steps
   * 
   * @param projectId - Project ID
   * @param fromIndex - Source index
   * @param toIndex - Target index
   * @returns Operation result with reordered steps
   */
  async reorderSteps(
    projectId: number,
    fromIndex: number,
    toIndex: number
  ): Promise<ProjectOperationResult<Step[]>> {
    const result = await this.getById(projectId);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    const steps = [...(result.data.recorded_steps ?? [])];

    if (fromIndex < 0 || fromIndex >= steps.length) {
      return { success: false, error: `Invalid source index: ${fromIndex}` };
    }
    if (toIndex < 0 || toIndex >= steps.length) {
      return { success: false, error: `Invalid target index: ${toIndex}` };
    }

    const [removed] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, removed);

    const updateResult = await this.updateSteps(projectId, steps);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: steps };
  }

  /**
   * Clear all steps from project
   * 
   * @param projectId - Project ID
   * @returns Operation result with empty steps array
   */
  async clearSteps(projectId: number): Promise<ProjectOperationResult<Step[]>> {
    const updateResult = await this.updateSteps(projectId, []);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: [] };
  }

  // ==========================================================================
  // FIELD OPERATIONS
  // ==========================================================================

  /**
   * Get project fields (CSV mappings)
   * 
   * @param id - Project ID
   * @returns Operation result with fields array
   */
  async getFields(id: number): Promise<ProjectOperationResult<Field[]>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    return { success: true, data: result.data.parsed_fields ?? [] };
  }

  /**
   * Update project fields (replace all)
   * 
   * @param id - Project ID
   * @param fields - New fields array
   * @returns Operation result with updated project
   */
  async updateFields(id: number, fields: Field[]): Promise<ProjectOperationResult<Project>> {
    return this.update(id, { parsed_fields: fields });
  }

  /**
   * Clear all fields from project
   * 
   * @param projectId - Project ID
   * @returns Operation result with empty fields array
   */
  async clearFields(projectId: number): Promise<ProjectOperationResult<Field[]>> {
    const updateResult = await this.updateFields(projectId, []);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: [] };
  }

  // ==========================================================================
  // CSV DATA OPERATIONS
  // ==========================================================================

  /**
   * Get project CSV data
   * 
   * @param id - Project ID
   * @returns Operation result with CSV data
   */
  async getCsvData(id: number): Promise<ProjectOperationResult<any[]>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    return { success: true, data: result.data.csv_data ?? [] };
  }

  /**
   * Update project CSV data
   * 
   * @param id - Project ID
   * @param csvData - New CSV data
   * @returns Operation result with updated project
   */
  async updateCsvData(id: number, csvData: any[]): Promise<ProjectOperationResult<Project>> {
    return this.update(id, { csv_data: csvData });
  }

  /**
   * Clear CSV data from project
   * 
   * @param projectId - Project ID
   * @returns Operation result with empty CSV data
   */
  async clearCsvData(projectId: number): Promise<ProjectOperationResult<any[]>> {
    const updateResult = await this.updateCsvData(projectId, []);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true, data: [] };
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  /**
   * Search projects by name
   * 
   * @param query - Search query
   * @returns Operation result with matching projects
   */
  async searchByName(query: string): Promise<ProjectOperationResult<Project[]>> {
    const result = await this.getAll();
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const lowerQuery = query.toLowerCase();
    const filtered = result.data.filter(p => 
      p.name.toLowerCase().includes(lowerQuery)
    );

    return { success: true, data: filtered };
  }

  /**
   * Get projects with metadata (step count, field count, etc.)
   * 
   * @returns Operation result with projects and metadata
   */
  async getAllWithMetadata(): Promise<ProjectOperationResult<ProjectWithMetadata[]>> {
    const result = await this.getAll();
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const projectsWithMetadata: ProjectWithMetadata[] = result.data.map(p => ({
      ...p,
      stepCount: p.recorded_steps?.length ?? 0,
      mappedFieldCount: p.parsed_fields?.filter(f => f.mapped).length ?? 0
    }));

    return { success: true, data: projectsWithMetadata };
  }

  /**
   * Check if project exists
   * 
   * @param id - Project ID
   * @returns True if project exists
   */
  async exists(id: number): Promise<boolean> {
    const result = await this.getById(id);
    return result.success && result.data !== null;
  }

  /**
   * Get project count
   * 
   * @param status - Optional status filter
   * @returns Operation result with count
   */
  async count(status?: ProjectStatus): Promise<ProjectOperationResult<number>> {
    try {
      const db = await this.getDb();
      
      if (status) {
        const projects = await db.getProjectsByStatus(status);
        return { success: true, data: projects.length };
      }
      
      const count = await db.getProjectCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count projects'
      };
    }
  }

  // ==========================================================================
  // DUPLICATE OPERATION
  // ==========================================================================

  /**
   * Duplicate a project
   * 
   * @param id - Project ID to duplicate
   * @param newName - Name for the duplicate (optional)
   * @returns Operation result with new project
   */
  async duplicate(id: number, newName?: string): Promise<ProjectOperationResult<Project>> {
    const result = await this.getById(id);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    const original = result.data;
    const duplicateName = newName ?? `${original.name} (Copy)`;

    return this.create({
      name: duplicateName,
      description: original.description,
      target_url: original.target_url
    }).then(async createResult => {
      if (!createResult.success || !createResult.data) {
        return createResult;
      }

      // Copy steps and fields to new project
      const newProject = createResult.data;
      
      if (original.recorded_steps?.length) {
        await this.updateSteps(newProject.id!, original.recorded_steps);
      }
      
      if (original.parsed_fields?.length) {
        await this.updateFields(newProject.id!, original.parsed_fields);
      }

      // Get the updated project with copied data
      return this.getById(newProject.id!);
    }).then(result => {
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return result as ProjectOperationResult<Project>;
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global project repository instance
 */
export const projectRepository = new ProjectRepository();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the project repository instance
 */
export function getProjectRepository(): ProjectRepository {
  return projectRepository;
}
