/**
 * Tests for useProjects hook
 * @module hooks/useProjects.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useProjects,
  useProject,
  type Project,
  type ProjectStatus,
} from './useProjects';
import type { IChromeRuntime, StorageResponse } from './useStorage';

// ============================================================================
// MOCKS
// ============================================================================

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Test Project 1',
    description: 'Description 1',
    target_url: 'https://example1.com',
    status: 'draft',
    created_date: Date.now() - 86400000, // 1 day ago
    updated_date: Date.now(),
    recorded_steps: [{ eventType: 'click', xpath: '/button' }],
    parsed_fields: [],
    csv_data: [],
  },
  {
    id: 2,
    name: 'Test Project 2',
    description: 'Description 2',
    target_url: 'https://example2.com',
    status: 'testing',
    created_date: Date.now() - 172800000, // 2 days ago
    updated_date: Date.now() - 86400000,
    recorded_steps: [],
    parsed_fields: [],
    csv_data: [{ field1: 'value1' }],
  },
];

function createMockChromeRuntime(): IChromeRuntime {
  return {
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        if (message.action === 'get_all_projects') {
          callback?.({ success: true, data: { projects: mockProjects } });
        } else if (message.action === 'get_project_by_id') {
          const project = mockProjects.find(p => p.id === message.payload?.id);
          callback?.({ success: true, data: { project } });
        } else if (message.action === 'add_project') {
          callback?.({ success: true, data: { id: 3 } });
        } else if (message.action === 'update_project' || 
                   message.action === 'update_project_steps' ||
                   message.action === 'update_project_fields' ||
                   message.action === 'update_project_csv') {
          callback?.({ success: true });
        } else if (message.action === 'delete_project') {
          callback?.({ success: true });
        } else {
          callback?.({ success: true });
        }
      }, 0);
    }),
    lastError: undefined,
  };
}

let mockChrome: IChromeRuntime;

beforeEach(() => {
  mockChrome = createMockChromeRuntime();
  (global as unknown as { chrome: { runtime: IChromeRuntime } }).chrome = {
    runtime: mockChrome,
  };
  vi.clearAllMocks();
});

afterEach(() => {
  delete (global as unknown as { chrome?: unknown }).chrome;
});

// ============================================================================
// TESTS
// ============================================================================

describe('useProjects', () => {
  describe('loading', () => {
    it('should load projects on mount', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.projects.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      expect(result.current.projects).toHaveLength(2);
      expect(result.current.isLoading).toBe(false);
    });

    it('should not load when autoLoad is false', async () => {
      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });

      expect(result.current.projects).toHaveLength(0);
    });

    it('should allow manual loading', async () => {
      const { result } = renderHook(() => useProjects({ autoLoad: false }));

      await act(async () => {
        await result.current.loadProjects();
      });

      expect(result.current.projects).toHaveLength(2);
    });
  });

  describe('filtering', () => {
    it('should filter by search term', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSearchTerm('Project 1');
      });

      expect(result.current.filteredProjects).toHaveLength(1);
      expect(result.current.filteredProjects[0].name).toBe('Test Project 1');
    });

    it('should filter by status', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setFilters({ status: 'draft' });
      });

      expect(result.current.filteredProjects).toHaveLength(1);
      expect(result.current.filteredProjects[0].status).toBe('draft');
    });

    it('should filter by hasSteps', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setFilters({ hasSteps: true });
      });

      expect(result.current.filteredProjects).toHaveLength(1);
      expect(result.current.filteredProjects[0].recorded_steps.length).toBeGreaterThan(0);
    });

    it('should filter by hasCsvData', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setFilters({ hasCsvData: true });
      });

      expect(result.current.filteredProjects).toHaveLength(1);
      expect(result.current.filteredProjects[0].csv_data.length).toBeGreaterThan(0);
    });
  });

  describe('sorting', () => {
    it('should sort by name', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSortField('name');
        result.current.setSortOrder('asc');
      });

      expect(result.current.filteredProjects[0].name).toBe('Test Project 1');
    });

    it('should sort descending', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSortField('name');
        result.current.setSortOrder('desc');
      });

      expect(result.current.filteredProjects[0].name).toBe('Test Project 2');
    });
  });

  describe('statistics', () => {
    it('should calculate stats', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats.totalProjects).toBe(2);
      expect(result.current.stats.byStatus.draft).toBe(1);
      expect(result.current.stats.byStatus.testing).toBe(1);
      expect(result.current.stats.totalSteps).toBe(1);
    });
  });

  describe('CRUD operations', () => {
    it('should create project', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let newId: number | null;
      await act(async () => {
        newId = await result.current.createProject({
          name: 'New Project',
          target_url: 'https://new.com',
        });
      });

      expect(newId).toBe(3);
    });

    it('should update project', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.updateProject(1, { name: 'Updated Name' });
      });

      expect(success!).toBe(true);
      expect(result.current.projects.find(p => p.id === 1)?.name).toBe('Updated Name');
    });

    it('should delete project', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.deleteProject(1);
      });

      expect(success!).toBe(true);
      expect(result.current.projects.find(p => p.id === 1)).toBeUndefined();
    });

    it('should duplicate project', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let newId: number | null;
      await act(async () => {
        newId = await result.current.duplicateProject(1, 'Duplicated Project');
      });

      expect(newId).toBe(3);
    });
  });

  describe('step operations', () => {
    it('should update steps', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newSteps = [{ eventType: 'click', xpath: '/new' }];
      let success: boolean;
      
      await act(async () => {
        success = await result.current.updateProjectSteps(1, newSteps);
      });

      expect(success!).toBe(true);
    });

    it('should add step', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.addStep(1, { eventType: 'input', xpath: '/input' });
      });

      expect(success!).toBe(true);
    });

    it('should remove step', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.removeStep(1, 0);
      });

      expect(success!).toBe(true);
    });

    it('should reorder steps', async () => {
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First add another step so we can reorder
      await act(async () => {
        await result.current.addStep(1, { eventType: 'input', xpath: '/input' });
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.reorderSteps(1, 0, 1);
      });

      expect(success!).toBe(true);
    });
  });
});

describe('useProject', () => {
  it('should load single project', async () => {
    const { result } = renderHook(() => useProject(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.project?.name).toBe('Test Project 1');
  });

  it('should handle null projectId', async () => {
    const { result } = renderHook(() => useProject(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.project).toBeNull();
  });

  it('should update steps', async () => {
    const { result } = renderHook(() => useProject(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.updateSteps([{ eventType: 'click', xpath: '/new' }]);
    });

    expect(success!).toBe(true);
  });

  it('should update status', async () => {
    const { result } = renderHook(() => useProject(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.updateStatus('complete');
    });

    expect(success!).toBe(true);
  });
});
