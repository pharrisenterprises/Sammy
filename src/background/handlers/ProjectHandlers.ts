/**
 * ProjectHandlers - Message handlers for Project CRUD operations
 * @module background/handlers/ProjectHandlers
 * @version 1.0.0
 * 
 * Handles project-related messages from extension pages:
 * - add_project: Create new project
 * - update_project: Update project metadata
 * - get_all_projects: List all projects
 * - get_project_by_id: Fetch single project
 * - delete_project: Delete project
 * - update_project_steps: Save recorded steps
 * - update_project_fields: Save field mappings
 * - update_project_csv: Save CSV data
 * 
 * @see background-service_breakdown.md for message patterns
 * @see storage-layer_breakdown.md for DB operations
 */

import type {
  BackgroundMessage,
  BackgroundResponse,
  MessageSender,
  MessageHandler,
  ActionCategory,
} from '../IBackgroundService';
import type { MessageReceiver } from '../MessageReceiver';
import type { Project, RecordedStep, ParsedField } from '../../storage/schemas/Project';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project storage operations interface
 * Abstracts DB operations for testability
 */
export interface IProjectStorage {
  /** Add a new project */
  addProject(project: Omit<Project, 'id'>): Promise<number>;
  
  /** Update an existing project */
  updateProject(id: number, updates: Partial<Project>): Promise<void>;
  
  /** Get all projects */
  getAllProjects(): Promise<Project[]>;
  
  /** Get project by ID */
  getProjectById(id: number): Promise<Project | undefined>;
  
  /** Delete a project */
  deleteProject(id: number): Promise<void>;
}

/**
 * Add project payload
 */
export interface AddProjectPayload {
  name: string;
  description?: string;
  target_url: string;
  status?: string;
}

/**
 * Update project payload
 */
export interface UpdateProjectPayload {
  id: number;
  name?: string;
  description?: string;
  target_url?: string;
  status?: string;
}

/**
 * Update project steps payload
 */
export interface UpdateProjectStepsPayload {
  id: number;
  recorded_steps: RecordedStep[];
}

/**
 * Update project fields payload
 */
export interface UpdateProjectFieldsPayload {
  id: number;
  parsed_fields: ParsedField[];
}

/**
 * Update project CSV payload
 */
export interface UpdateProjectCsvPayload {
  id: number;
  csv_data: Record<string, string>[];
}

/**
 * Project action names
 */
export const PROJECT_ACTIONS = {
  ADD_PROJECT: 'add_project',
  UPDATE_PROJECT: 'update_project',
  GET_ALL_PROJECTS: 'get_all_projects',
  GET_PROJECT_BY_ID: 'get_project_by_id',
  DELETE_PROJECT: 'delete_project',
  UPDATE_PROJECT_STEPS: 'update_project_steps',
  UPDATE_PROJECT_FIELDS: 'update_project_fields',
  UPDATE_PROJECT_CSV: 'update_project_csv',
} as const;

// ============================================================================
// PROJECT HANDLERS CLASS
// ============================================================================

/**
 * ProjectHandlers - Handles project-related messages
 * 
 * @example
 * ```typescript
 * const handlers = new ProjectHandlers(storage);
 * 
 * // Register with message receiver
 * handlers.registerAll(receiver);
 * 
 * // Or use individual handlers
 * const response = await handlers.handleAddProject(message, sender);
 * ```
 */
export class ProjectHandlers {
  private storage: IProjectStorage;

  /**
   * Create ProjectHandlers
   * @param storage - Project storage implementation
   */
  constructor(storage: IProjectStorage) {
    this.storage = storage;
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all project handlers with a MessageReceiver
   */
  public registerAll(receiver: MessageReceiver): void {
    receiver.register(
      PROJECT_ACTIONS.ADD_PROJECT,
      this.handleAddProject.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.UPDATE_PROJECT,
      this.handleUpdateProject.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.GET_ALL_PROJECTS,
      this.handleGetAllProjects.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.GET_PROJECT_BY_ID,
      this.handleGetProjectById.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.DELETE_PROJECT,
      this.handleDeleteProject.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.UPDATE_PROJECT_STEPS,
      this.handleUpdateProjectSteps.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.UPDATE_PROJECT_FIELDS,
      this.handleUpdateProjectFields.bind(this),
      'project'
    );
    
    receiver.register(
      PROJECT_ACTIONS.UPDATE_PROJECT_CSV,
      this.handleUpdateProjectCsv.bind(this),
      'project'
    );
  }

  /**
   * Get all handler entries for manual registration
   */
  public getHandlerEntries(): Array<{
    action: string;
    handler: MessageHandler;
    category: ActionCategory;
  }> {
    return [
      {
        action: PROJECT_ACTIONS.ADD_PROJECT,
        handler: this.handleAddProject.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.UPDATE_PROJECT,
        handler: this.handleUpdateProject.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.GET_ALL_PROJECTS,
        handler: this.handleGetAllProjects.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.GET_PROJECT_BY_ID,
        handler: this.handleGetProjectById.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.DELETE_PROJECT,
        handler: this.handleDeleteProject.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.UPDATE_PROJECT_STEPS,
        handler: this.handleUpdateProjectSteps.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.UPDATE_PROJECT_FIELDS,
        handler: this.handleUpdateProjectFields.bind(this),
        category: 'project',
      },
      {
        action: PROJECT_ACTIONS.UPDATE_PROJECT_CSV,
        handler: this.handleUpdateProjectCsv.bind(this),
        category: 'project',
      },
    ];
  }

  // ==========================================================================
  // HANDLER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Handle add_project action
   * Creates a new project with default values for arrays
   */
  public async handleAddProject(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as AddProjectPayload;

      // Validate required fields
      if (!payload?.name) {
        return { success: false, error: 'Project name is required' };
      }
      if (!payload?.target_url) {
        return { success: false, error: 'Target URL is required' };
      }

      // Create project with defaults
      const now = new Date().toISOString();
      const newProject: Omit<Project, 'id'> = {
        name: payload.name,
        description: payload.description ?? '',
        target_url: payload.target_url,
        status: payload.status ?? 'draft',
        recorded_steps: [],
        parsed_fields: [],
        csv_data: [],
        created_date: now,
        updated_date: now,
      };

      const id = await this.storage.addProject(newProject);

      return { success: true, id };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add project',
      };
    }
  }

  /**
   * Handle update_project action
   * Updates project metadata (not steps/fields/csv)
   */
  public async handleUpdateProject(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as UpdateProjectPayload;

      // Validate ID
      if (!payload?.id) {
        return { success: false, error: 'Project ID is required' };
      }

      // Build updates object
      const updates: Partial<Project> = {
        updated_date: new Date().toISOString(),
      };

      if (payload.name !== undefined) {
        updates.name = payload.name;
      }
      if (payload.description !== undefined) {
        updates.description = payload.description;
      }
      if (payload.target_url !== undefined) {
        updates.target_url = payload.target_url;
      }
      if (payload.status !== undefined) {
        updates.status = payload.status;
      }

      await this.storage.updateProject(payload.id, updates);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project',
      };
    }
  }

  /**
   * Handle get_all_projects action
   * Returns all projects
   */
  public async handleGetAllProjects(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const projects = await this.storage.getAllProjects();

      return { success: true, data: { projects } };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get projects',
      };
    }
  }

  /**
   * Handle get_project_by_id action
   * Returns a single project or error if not found
   */
  public async handleGetProjectById(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { id: number };

      // Validate ID
      if (!payload?.id) {
        return { success: false, error: 'Project ID is required' };
      }

      const project = await this.storage.getProjectById(payload.id);

      if (!project) {
        return { success: false, error: `Project not found: ${payload.id}` };
      }

      return { success: true, data: { project } };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project',
      };
    }
  }

  /**
   * Handle delete_project action
   * Deletes a project by ID
   */
  public async handleDeleteProject(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { id: number };

      // Validate ID
      if (!payload?.id) {
        return { success: false, error: 'Project ID is required' };
      }

      await this.storage.deleteProject(payload.id);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      };
    }
  }

  /**
   * Handle update_project_steps action
   * Updates only the recorded_steps array
   */
  public async handleUpdateProjectSteps(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as UpdateProjectStepsPayload;

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Project ID is required' };
      }
      if (!Array.isArray(payload?.recorded_steps)) {
        return { success: false, error: 'recorded_steps must be an array' };
      }

      await this.storage.updateProject(payload.id, {
        recorded_steps: payload.recorded_steps,
        updated_date: new Date().toISOString(),
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project steps',
      };
    }
  }

  /**
   * Handle update_project_fields action
   * Updates only the parsed_fields array
   */
  public async handleUpdateProjectFields(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as UpdateProjectFieldsPayload;

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Project ID is required' };
      }
      if (!Array.isArray(payload?.parsed_fields)) {
        return { success: false, error: 'parsed_fields must be an array' };
      }

      await this.storage.updateProject(payload.id, {
        parsed_fields: payload.parsed_fields,
        updated_date: new Date().toISOString(),
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project fields',
      };
    }
  }

  /**
   * Handle update_project_csv action
   * Updates only the csv_data array
   */
  public async handleUpdateProjectCsv(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as UpdateProjectCsvPayload;

      // Validate
      if (!payload?.id) {
        return { success: false, error: 'Project ID is required' };
      }
      if (!Array.isArray(payload?.csv_data)) {
        return { success: false, error: 'csv_data must be an array' };
      }

      await this.storage.updateProject(payload.id, {
        csv_data: payload.csv_data,
        updated_date: new Date().toISOString(),
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project CSV',
      };
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create ProjectHandlers instance
 */
export function createProjectHandlers(storage: IProjectStorage): ProjectHandlers {
  return new ProjectHandlers(storage);
}

/**
 * Create and register all project handlers with a MessageReceiver
 */
export function registerProjectHandlers(
  receiver: MessageReceiver,
  storage: IProjectStorage
): ProjectHandlers {
  const handlers = new ProjectHandlers(storage);
  handlers.registerAll(receiver);
  return handlers;
}
