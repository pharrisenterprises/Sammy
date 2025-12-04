/**
 * useProjects - React hook for project management
 * @module hooks/useProjects
 * @version 1.0.0
 * 
 * Provides complete project management interface:
 * - CRUD operations (create, read, update, delete)
 * - Search and filter functionality
 * - Project statistics
 * - Duplicate project support
 * 
 * @example
 * ```tsx
 * const { 
 *   projects, 
 *   isLoading, 
 *   createProject, 
 *   deleteProject,
 *   searchTerm,
 *   setSearchTerm,
 *   filteredProjects 
 * } = useProjects();
 * ```
 * 
 * @see ui-components_breakdown.md for UI patterns
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  useStorage,
  type CreateProjectData,
  type ProjectData,
  type UseStorageOptions,
} from './useStorage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project status types
 */
export type ProjectStatus = 'draft' | 'testing' | 'complete';

/**
 * Full project interface
 */
export interface Project {
  id: number;
  name: string;
  description: string;
  target_url: string;
  status: ProjectStatus;
  created_date: number;
  updated_date: number;
  recorded_steps: RecordedStep[];
  parsed_fields: ParsedField[];
  csv_data: Record<string, string>[];
}

/**
 * Recorded step
 */
export interface RecordedStep {
  id?: string;
  eventType: string;
  xpath: string;
  value?: string;
  label?: string;
  timestamp?: number;
  bundle?: Record<string, unknown>;
}

/**
 * Parsed field for CSV mapping
 */
export interface ParsedField {
  field_name: string;
  mapped: boolean;
  inputvarfields: string;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  totalProjects: number;
  byStatus: {
    draft: number;
    testing: number;
    complete: number;
  };
  totalSteps: number;
  avgStepsPerProject: number;
  recentlyUpdated: number; // Updated in last 7 days
}

/**
 * Sort options
 */
export type ProjectSortField = 'name' | 'created_date' | 'updated_date' | 'status';
export type ProjectSortOrder = 'asc' | 'desc';

/**
 * Filter options
 */
export interface ProjectFilters {
  status?: ProjectStatus | 'all';
  hasSteps?: boolean;
  hasCsvData?: boolean;
}

/**
 * Hook options
 */
export interface UseProjectsOptions extends UseStorageOptions {
  autoLoad?: boolean;
  sortField?: ProjectSortField;
  sortOrder?: ProjectSortOrder;
  filters?: ProjectFilters;
}

/**
 * Default options
 */
export const DEFAULT_PROJECTS_OPTIONS: UseProjectsOptions = {
  autoLoad: true,
  sortField: 'updated_date',
  sortOrder: 'desc',
  filters: { status: 'all' },
};

/**
 * Hook return type
 */
export interface UseProjectsReturn {
  // Data
  projects: Project[];
  filteredProjects: Project[];
  selectedProject: Project | null;
  stats: ProjectStats;
  
  // State
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  sortField: ProjectSortField;
  sortOrder: ProjectSortOrder;
  filters: ProjectFilters;
  
  // Setters
  setSearchTerm: (term: string) => void;
  setSortField: (field: ProjectSortField) => void;
  setSortOrder: (order: ProjectSortOrder) => void;
  setFilters: (filters: ProjectFilters) => void;
  setSelectedProject: (project: Project | null) => void;
  
  // Operations
  loadProjects: () => Promise<void>;
  getProject: (id: number) => Promise<Project | null>;
  createProject: (data: CreateProjectInput) => Promise<number | null>;
  updateProject: (id: number, updates: Partial<ProjectUpdateInput>) => Promise<boolean>;
  deleteProject: (id: number) => Promise<boolean>;
  duplicateProject: (id: number, newName?: string) => Promise<number | null>;
  
  // Step operations
  updateProjectSteps: (id: number, steps: RecordedStep[]) => Promise<boolean>;
  addStep: (id: number, step: RecordedStep) => Promise<boolean>;
  removeStep: (id: number, stepIndex: number) => Promise<boolean>;
  reorderSteps: (id: number, fromIndex: number, toIndex: number) => Promise<boolean>;
  
  // Field operations
  updateProjectFields: (id: number, fields: ParsedField[]) => Promise<boolean>;
  
  // CSV operations
  updateProjectCsv: (id: number, csvData: Record<string, string>[]) => Promise<boolean>;
  
  // Utilities
  clearError: () => void;
  refresh: () => Promise<void>;
}

/**
 * Input for creating a project
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  target_url: string;
}

/**
 * Input for updating a project
 */
export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  target_url?: string;
  status?: ProjectStatus;
  recorded_steps?: RecordedStep[];
  parsed_fields?: ParsedField[];
  csv_data?: Record<string, string>[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useProjects - Hook for project management
 */
export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const opts = { ...DEFAULT_PROJECTS_OPTIONS, ...options };
  
  // Storage hook (pass full opts to maintain stability)
  const storage = useStorage(opts);
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<ProjectSortField>(opts.sortField!);
  const [sortOrder, setSortOrder] = useState<ProjectSortOrder>(opts.sortOrder!);
  const [filters, setFilters] = useState<ProjectFilters>(opts.filters!);

  // ==========================================================================
  // LOAD PROJECTS
  // ==========================================================================

  /**
   * Load all projects from storage
   */
  const loadProjects = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    
    const response = await storage.getProjects();
    
    if (response.success && response.data) {
      const loadedProjects = (response.data.projects as Project[]).map(normalizeProject);
      setProjects(loadedProjects);
    }
    
    setIsLoading(false);
  }, [storage.getProjects]);

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    if (opts.autoLoad) {
      loadProjects();
    }
  }, [opts.autoLoad, loadProjects]);

  // ==========================================================================
  // FILTERING AND SORTING
  // ==========================================================================

  /**
   * Filter and sort projects
   */
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(project =>
        project.name.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term) ||
        project.target_url.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter(project => project.status === filters.status);
    }

    // Apply hasSteps filter
    if (filters.hasSteps !== undefined) {
      result = result.filter(project => 
        filters.hasSteps 
          ? project.recorded_steps.length > 0 
          : project.recorded_steps.length === 0
      );
    }

    // Apply hasCsvData filter
    if (filters.hasCsvData !== undefined) {
      result = result.filter(project =>
        filters.hasCsvData
          ? project.csv_data.length > 0
          : project.csv_data.length === 0
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_date':
          comparison = a.created_date - b.created_date;
          break;
        case 'updated_date':
          comparison = a.updated_date - b.updated_date;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [projects, searchTerm, filters, sortField, sortOrder]);

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Calculate project statistics
   */
  const stats = useMemo((): ProjectStats => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const totalSteps = projects.reduce(
      (sum, p) => sum + p.recorded_steps.length, 
      0
    );

    return {
      totalProjects: projects.length,
      byStatus: {
        draft: projects.filter(p => p.status === 'draft').length,
        testing: projects.filter(p => p.status === 'testing').length,
        complete: projects.filter(p => p.status === 'complete').length,
      },
      totalSteps,
      avgStepsPerProject: projects.length > 0 
        ? Math.round(totalSteps / projects.length) 
        : 0,
      recentlyUpdated: projects.filter(p => p.updated_date > sevenDaysAgo).length,
    };
  }, [projects]);

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get single project by ID
   */
  const getProject = useCallback(async (id: number): Promise<Project | null> => {
    const response = await storage.getProject(id);
    
    if (response.success && response.data) {
      return normalizeProject(response.data.project as Project);
    }
    
    return null;
  }, [storage.getProject]);

  /**
   * Create new project
   */
  const createProject = useCallback(async (
    data: CreateProjectInput
  ): Promise<number | null> => {
    const projectData: CreateProjectData = {
      name: data.name,
      description: data.description ?? '',
      target_url: data.target_url,
    };
    
    const response = await storage.addProject(projectData);
    
    if (response.success && response.data?.id) {
      // Reload projects to get the new one
      await loadProjects();
      return response.data.id;
    }
    
    return null;
  }, [storage.addProject, loadProjects]);

  /**
   * Update existing project
   */
  const updateProject = useCallback(async (
    id: number,
    updates: Partial<ProjectUpdateInput>
  ): Promise<boolean> => {
    const response = await storage.updateProject(id, {
      ...updates,
      updated_date: Date.now(),
    });
    
    if (response.success) {
      // Update local state
      setProjects(prev => prev.map(p => 
        p.id === id 
          ? { ...p, ...updates, updated_date: Date.now() }
          : p
      ));
      
      // Update selected if same
      if (selectedProject?.id === id) {
        setSelectedProject(prev => prev ? { ...prev, ...updates, updated_date: Date.now() } : null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateProject, selectedProject]);

  /**
   * Delete project
   */
  const deleteProject = useCallback(async (id: number): Promise<boolean> => {
    const response = await storage.deleteProject(id);
    
    if (response.success) {
      // Update local state
      setProjects(prev => prev.filter(p => p.id !== id));
      
      // Clear selected if same
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.deleteProject, selectedProject]);

  /**
   * Duplicate project
   */
  const duplicateProject = useCallback(async (
    id: number,
    newName?: string
  ): Promise<number | null> => {
    // Get original project
    const original = await getProject(id);
    if (!original) return null;

    // Create duplicate
    const duplicateName = newName ?? `${original.name} (Copy)`;
    
    const response = await storage.addProject({
      name: duplicateName,
      description: original.description,
      target_url: original.target_url,
    });
    
    if (!response.success || !response.data?.id) {
      return null;
    }
    
    const newId = response.data.id;

    // Copy steps, fields, and CSV data
    await storage.updateProject(newId, {
      recorded_steps: original.recorded_steps,
      parsed_fields: original.parsed_fields,
      csv_data: original.csv_data,
      status: 'draft',
    });

    // Reload projects
    await loadProjects();
    
    return newId;
  }, [getProject, storage.addProject, storage.updateProject, loadProjects]);

  // ==========================================================================
  // STEP OPERATIONS
  // ==========================================================================

  /**
   * Update all steps for a project
   */
  const updateProjectSteps = useCallback(async (
    id: number,
    steps: RecordedStep[]
  ): Promise<boolean> => {
    const response = await storage.sendMessage('update_project_steps', {
      id,
      recorded_steps: steps,
    });
    
    if (response.success) {
      setProjects(prev => prev.map(p => 
        p.id === id 
          ? { ...p, recorded_steps: steps, updated_date: Date.now() }
          : p
      ));
      return true;
    }
    
    return false;
  }, [storage.sendMessage]);

  /**
   * Add a single step
   */
  const addStep = useCallback(async (
    id: number,
    step: RecordedStep
  ): Promise<boolean> => {
    const project = projects.find(p => p.id === id);
    if (!project) return false;

    const newSteps = [...project.recorded_steps, step];
    return updateProjectSteps(id, newSteps);
  }, [projects, updateProjectSteps]);

  /**
   * Remove a step by index
   */
  const removeStep = useCallback(async (
    id: number,
    stepIndex: number
  ): Promise<boolean> => {
    const project = projects.find(p => p.id === id);
    if (!project) return false;

    const newSteps = project.recorded_steps.filter((_, i) => i !== stepIndex);
    return updateProjectSteps(id, newSteps);
  }, [projects, updateProjectSteps]);

  /**
   * Reorder steps (for drag-and-drop)
   */
  const reorderSteps = useCallback(async (
    id: number,
    fromIndex: number,
    toIndex: number
  ): Promise<boolean> => {
    const project = projects.find(p => p.id === id);
    if (!project) return false;

    const newSteps = [...project.recorded_steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    
    return updateProjectSteps(id, newSteps);
  }, [projects, updateProjectSteps]);

  // ==========================================================================
  // FIELD OPERATIONS
  // ==========================================================================

  /**
   * Update parsed fields
   */
  const updateProjectFields = useCallback(async (
    id: number,
    fields: ParsedField[]
  ): Promise<boolean> => {
    const response = await storage.sendMessage('update_project_fields', {
      id,
      parsed_fields: fields,
    });
    
    if (response.success) {
      setProjects(prev => prev.map(p => 
        p.id === id 
          ? { ...p, parsed_fields: fields, updated_date: Date.now() }
          : p
      ));
      return true;
    }
    
    return false;
  }, [storage.sendMessage]);

  // ==========================================================================
  // CSV OPERATIONS
  // ==========================================================================

  /**
   * Update CSV data
   */
  const updateProjectCsv = useCallback(async (
    id: number,
    csvData: Record<string, string>[]
  ): Promise<boolean> => {
    const response = await storage.sendMessage('update_project_csv', {
      id,
      csv_data: csvData,
    });
    
    if (response.success) {
      setProjects(prev => prev.map(p => 
        p.id === id 
          ? { ...p, csv_data: csvData, updated_date: Date.now() }
          : p
      ));
      return true;
    }
    
    return false;
  }, [storage.sendMessage]);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Refresh projects from storage
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadProjects();
  }, [loadProjects]);

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    storage.clearError();
  }, [storage.clearError]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    projects,
    filteredProjects,
    selectedProject,
    stats,
    
    // State
    isLoading,
    error: storage.error,
    searchTerm,
    sortField,
    sortOrder,
    filters,
    
    // Setters
    setSearchTerm,
    setSortField,
    setSortOrder,
    setFilters,
    setSelectedProject,
    
    // Operations
    loadProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    
    // Step operations
    updateProjectSteps,
    addStep,
    removeStep,
    reorderSteps,
    
    // Field operations
    updateProjectFields,
    
    // CSV operations
    updateProjectCsv,
    
    // Utilities
    clearError,
    refresh,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize project data (ensure all fields exist)
 */
function normalizeProject(project: Partial<Project>): Project {
  return {
    id: project.id ?? 0,
    name: project.name ?? '',
    description: project.description ?? '',
    target_url: project.target_url ?? '',
    status: project.status ?? 'draft',
    created_date: project.created_date ?? Date.now(),
    updated_date: project.updated_date ?? Date.now(),
    recorded_steps: project.recorded_steps ?? [],
    parsed_fields: project.parsed_fields ?? [],
    csv_data: project.csv_data ?? [],
  };
}

// ============================================================================
// SINGLE PROJECT HOOK
// ============================================================================

/**
 * useProject - Hook for single project management
 * 
 * @example
 * ```tsx
 * const { project, isLoading, updateSteps } = useProject(projectId);
 * ```
 */
export function useProject(
  projectId: number | null,
  options: UseStorageOptions = {}
): {
  project: Project | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateSteps: (steps: RecordedStep[]) => Promise<boolean>;
  updateFields: (fields: ParsedField[]) => Promise<boolean>;
  updateCsv: (csvData: Record<string, string>[]) => Promise<boolean>;
  updateStatus: (status: ProjectStatus) => Promise<boolean>;
} {
  const storage = useStorage(options);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load project
   */
  const loadProject = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setProject(null);
      return;
    }

    setIsLoading(true);
    const response = await storage.getProject(projectId);
    
    if (response.success && response.data) {
      setProject(normalizeProject(response.data.project as Project));
    } else {
      setProject(null);
    }
    
    setIsLoading(false);
  }, [projectId, storage.getProject]);

  // Load on mount and when ID changes
  useEffect(() => {
    loadProject();
  }, [loadProject]);

  /**
   * Update steps
   */
  const updateSteps = useCallback(async (steps: RecordedStep[]): Promise<boolean> => {
    if (!projectId) return false;
    
    const response = await storage.sendMessage('update_project_steps', {
      id: projectId,
      recorded_steps: steps,
    });
    
    if (response.success) {
      setProject(prev => prev ? { ...prev, recorded_steps: steps, updated_date: Date.now() } : null);
      return true;
    }
    
    return false;
  }, [projectId, storage.sendMessage]);

  /**
   * Update fields
   */
  const updateFields = useCallback(async (fields: ParsedField[]): Promise<boolean> => {
    if (!projectId) return false;
    
    const response = await storage.sendMessage('update_project_fields', {
      id: projectId,
      parsed_fields: fields,
    });
    
    if (response.success) {
      setProject(prev => prev ? { ...prev, parsed_fields: fields, updated_date: Date.now() } : null);
      return true;
    }
    
    return false;
  }, [projectId, storage.sendMessage]);

  /**
   * Update CSV data
   */
  const updateCsv = useCallback(async (csvData: Record<string, string>[]): Promise<boolean> => {
    if (!projectId) return false;
    
    const response = await storage.sendMessage('update_project_csv', {
      id: projectId,
      csv_data: csvData,
    });
    
    if (response.success) {
      setProject(prev => prev ? { ...prev, csv_data: csvData, updated_date: Date.now() } : null);
      return true;
    }
    
    return false;
  }, [projectId, storage.sendMessage]);

  /**
   * Update status
   */
  const updateStatus = useCallback(async (status: ProjectStatus): Promise<boolean> => {
    if (!projectId) return false;
    
    const response = await storage.updateProject(projectId, { status });
    
    if (response.success) {
      setProject(prev => prev ? { ...prev, status, updated_date: Date.now() } : null);
      return true;
    }
    
    return false;
  }, [projectId, storage.updateProject]);

  return {
    project,
    isLoading,
    error: storage.error,
    reload: loadProject,
    updateSteps,
    updateFields,
    updateCsv,
    updateStatus,
  };
}
