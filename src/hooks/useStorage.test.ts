/**
 * Tests for useStorage hook
 * @module hooks/useStorage.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useStorage,
  useStorageQuery,
  useStorageMutation,
  STORAGE_ACTIONS,
  DEFAULT_STORAGE_OPTIONS,
  type IChromeRuntime,
  type StorageResponse,
} from './useStorage';

// ============================================================================
// MOCKS
// ============================================================================

function createMockChromeRuntime(defaultResponse: StorageResponse = { success: true }): IChromeRuntime & {
  _setResponse: (response: StorageResponse) => void;
  _setError: (error: string | undefined) => void;
} {
  let response = defaultResponse;
  let lastError: { message?: string } | undefined;

  return {
    _setResponse: (r) => { response = r; },
    _setError: (e) => { lastError = e ? { message: e } : undefined; },
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => callback?.(response), 0);
    }),
    get lastError() {
      return lastError;
    },
  };
}

// Setup chrome mock
let mockChrome: ReturnType<typeof createMockChromeRuntime>;

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

describe('useStorage', () => {
  describe('sendMessage', () => {
    it('should send message and receive response', async () => {
      mockChrome._setResponse({ success: true, data: { projects: [] } });

      const { result } = renderHook(() => useStorage());

      let response: StorageResponse;
      await act(async () => {
        response = await result.current.sendMessage('get_all_projects');
      });

      expect(response!.success).toBe(true);
      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        { action: 'get_all_projects', payload: undefined },
        expect.any(Function)
      );
    });

    it('should handle errors', async () => {
      mockChrome._setResponse({ success: false, error: 'Test error' });

      const { result } = renderHook(() => useStorage());

      let response: StorageResponse;
      await act(async () => {
        response = await result.current.sendMessage('get_all_projects');
      });

      expect(response!.success).toBe(false);
      expect(response!.error).toBe('Test error');
      expect(result.current.error).toBe('Test error');
    });

    it('should track loading state', async () => {
      mockChrome._setResponse({ success: true });

      const { result } = renderHook(() => useStorage());

      expect(result.current.isLoading).toBe(false);

      const promise = act(async () => {
        await result.current.sendMessage('test');
      });

      // Loading should be true during operation
      await promise;

      expect(result.current.isLoading).toBe(false);
    });

    it('should track last operation', async () => {
      mockChrome._setResponse({ success: true });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.sendMessage('test_action');
      });

      expect(result.current.lastOperation).toBe('test_action');
    });
  });

  describe('convenience methods', () => {
    it('should get all projects', async () => {
      const projects = [{ id: 1, name: 'Test' }];
      mockChrome._setResponse({ success: true, data: { projects } });

      const { result } = renderHook(() => useStorage());

      let response: StorageResponse;
      await act(async () => {
        response = await result.current.getProjects();
      });

      expect(response!.success).toBe(true);
      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        { action: STORAGE_ACTIONS.GET_ALL_PROJECTS, payload: undefined },
        expect.any(Function)
      );
    });

    it('should get project by id', async () => {
      mockChrome._setResponse({ success: true, data: { project: { id: 1 } } });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.getProject(1);
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        { action: STORAGE_ACTIONS.GET_PROJECT_BY_ID, payload: { id: 1 } },
        expect.any(Function)
      );
    });

    it('should add project', async () => {
      mockChrome._setResponse({ success: true, id: 1 });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.addProject({
          name: 'Test',
          target_url: 'https://example.com',
        });
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: STORAGE_ACTIONS.ADD_PROJECT }),
        expect.any(Function)
      );
    });

    it('should update project', async () => {
      mockChrome._setResponse({ success: true });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.updateProject(1, { name: 'Updated' });
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        { action: STORAGE_ACTIONS.UPDATE_PROJECT, payload: { id: 1, name: 'Updated' } },
        expect.any(Function)
      );
    });

    it('should delete project', async () => {
      mockChrome._setResponse({ success: true });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.deleteProject(1);
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        { action: STORAGE_ACTIONS.DELETE_PROJECT, payload: { id: 1 } },
        expect.any(Function)
      );
    });

    it('should get test runs', async () => {
      mockChrome._setResponse({ success: true, data: { testRuns: [] } });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.getTestRuns(1);
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        { action: STORAGE_ACTIONS.GET_TEST_RUNS_BY_PROJECT, payload: { project_id: 1 } },
        expect.any(Function)
      );
    });

    it('should create test run', async () => {
      mockChrome._setResponse({ success: true, id: 1 });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.createTestRun({
          project_id: 1,
          total_steps: 10,
        });
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: STORAGE_ACTIONS.CREATE_TEST_RUN }),
        expect.any(Function)
      );
    });
  });

  describe('cache', () => {
    it('should cache responses when enabled', async () => {
      mockChrome._setResponse({ success: true, data: { projects: [] } });

      const { result } = renderHook(() => useStorage({ cacheEnabled: true }));

      // First call
      await act(async () => {
        await result.current.sendMessage('get_all_projects');
      });

      // Second call should use cache
      await act(async () => {
        await result.current.sendMessage('get_all_projects');
      });

      // Should only be called once
      expect(mockChrome.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', async () => {
      mockChrome._setResponse({ success: true, data: { projects: [] } });

      const { result } = renderHook(() => useStorage({ cacheEnabled: true }));

      await act(async () => {
        await result.current.sendMessage('get_all_projects');
      });

      // Clear cache
      act(() => {
        result.current.clearCache();
      });

      // Should make new request
      await act(async () => {
        await result.current.sendMessage('get_all_projects');
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should invalidate specific cache', async () => {
      mockChrome._setResponse({ success: true, data: {} });

      const { result } = renderHook(() => useStorage({ cacheEnabled: true }));

      await act(async () => {
        await result.current.sendMessage('get_all_projects');
        await result.current.sendMessage('get_project_by_id', { id: 1 });
      });

      // Invalidate only projects
      act(() => {
        result.current.invalidateCache('get_all_projects');
      });

      // Projects should refetch
      await act(async () => {
        await result.current.sendMessage('get_all_projects');
      });

      expect(mockChrome.sendMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('state management', () => {
    it('should clear error', async () => {
      mockChrome._setResponse({ success: false, error: 'Test error' });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.sendMessage('test');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset state', async () => {
      mockChrome._setResponse({ success: false, error: 'Test error' });

      const { result } = renderHook(() => useStorage());

      await act(async () => {
        await result.current.sendMessage('test');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.lastOperation).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe('useStorageQuery', () => {
  it('should automatically fetch on mount', async () => {
    mockChrome._setResponse({ success: true, data: { projects: [{ id: 1 }] } });

    const { result } = renderHook(() => 
      useStorageQuery<{ projects: unknown[] }>('get_all_projects')
    );

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data?.projects).toHaveLength(1);
  });

  it('should not fetch when disabled', async () => {
    mockChrome._setResponse({ success: true, data: {} });

    renderHook(() => 
      useStorageQuery('get_all_projects', undefined, { enabled: false })
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(mockChrome.sendMessage).not.toHaveBeenCalled();
  });

  it('should refetch on demand', async () => {
    mockChrome._setResponse({ success: true, data: {} });

    const { result } = renderHook(() => 
      useStorageQuery('get_all_projects', undefined, { enabled: false })
    );

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockChrome.sendMessage).toHaveBeenCalled();
  });
});

describe('useStorageMutation', () => {
  it('should mutate on demand', async () => {
    mockChrome._setResponse({ success: true, id: 1 });

    const { result } = renderHook(() => 
      useStorageMutation<{ id: number }, { name: string }>('add_project')
    );

    let response: StorageResponse;
    await act(async () => {
      response = await result.current.mutate({ name: 'Test' });
    });

    expect(response!.success).toBe(true);
  });

  it('should call onSuccess callback', async () => {
    mockChrome._setResponse({ success: true, id: 1 });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => 
      useStorageMutation('add_project', { onSuccess })
    );

    await act(async () => {
      await result.current.mutate({ name: 'Test' });
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('should call onError callback', async () => {
    mockChrome._setResponse({ success: false, error: 'Failed' });
    const onError = vi.fn();

    const { result } = renderHook(() => 
      useStorageMutation('add_project', { onError })
    );

    await act(async () => {
      await result.current.mutate({ name: 'Test' });
    });

    expect(onError).toHaveBeenCalledWith('Failed');
  });
});
