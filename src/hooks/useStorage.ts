/**
 * useStorage - React hook for storage operations
 * @module hooks/useStorage
 * @version 1.0.0
 * 
 * Provides unified interface for storage operations via chrome.runtime.sendMessage.
 * Handles loading states, errors, caching, and retry logic.
 * 
 * @example
 * ```tsx
 * const { sendMessage, isLoading, error } = useStorage();
 * 
 * const loadProjects = async () => {
 *   const response = await sendMessage('get_all_projects');
 *   if (response.success) {
 *     setProjects(response.data.projects);
 *   }
 * };
 * ```
 * 
 * @see storage-layer_breakdown.md for storage architecture
 * @see ui-components_breakdown.md for UI patterns
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Storage message to send to background
 */
export interface StorageMessage<T = unknown> {
  action: string;
  payload?: T;
}

/**
 * Storage response from background
 */
export interface StorageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  id?: number;
}

/**
 * Chrome runtime interface (for testing)
 */
export interface IChromeRuntime {
  sendMessage<T = unknown>(
    message: StorageMessage,
    callback?: (response: StorageResponse<T>) => void
  ): void;
  lastError?: { message?: string };
}

/**
 * Storage hook options
 */
export interface UseStorageOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  debug?: boolean;
}

/**
 * Default options
 */
export const DEFAULT_STORAGE_OPTIONS: Required<UseStorageOptions> = {
  timeout: 30000,
  retryCount: 2,
  retryDelay: 500,
  cacheEnabled: false,
  cacheTTL: 60000, // 1 minute
  debug: false,
};

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Storage hook state
 */
export interface StorageState {
  isLoading: boolean;
  error: string | null;
  lastOperation: string | null;
  lastOperationTime: Date | null;
}

/**
 * Storage hook return type
 */
export interface UseStorageReturn {
  // State
  isLoading: boolean;
  error: string | null;
  lastOperation: string | null;
  
  // Methods
  sendMessage: <TResponse = unknown, TPayload = unknown>(
    action: string,
    payload?: TPayload
  ) => Promise<StorageResponse<TResponse>>;
  
  // Convenience methods
  getProjects: () => Promise<StorageResponse<{ projects: unknown[] }>>;
  getProject: (id: number) => Promise<StorageResponse<{ project: unknown }>>;
  addProject: (project: CreateProjectData) => Promise<StorageResponse<{ id: number }>>;
  updateProject: (id: number, updates: Partial<ProjectData>) => Promise<StorageResponse<void>>;
  deleteProject: (id: number) => Promise<StorageResponse<void>>;
  
  getTestRuns: (projectId: number) => Promise<StorageResponse<{ testRuns: unknown[] }>>;
  createTestRun: (testRun: CreateTestRunData) => Promise<StorageResponse<{ id: number }>>;
  updateTestRun: (id: number, updates: Partial<TestRunData>) => Promise<StorageResponse<void>>;
  
  // Cache
  clearCache: () => void;
  invalidateCache: (action: string) => void;
  
  // State management
  clearError: () => void;
  reset: () => void;
}

/**
 * Project data for creation
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  target_url: string;
}

/**
 * Project data
 */
export interface ProjectData {
  id?: number;
  name: string;
  description?: string;
  target_url: string;
  status: 'draft' | 'testing' | 'complete';
  created_date?: number;
  updated_date?: number;
  recorded_steps?: unknown[];
  parsed_fields?: unknown[];
  csv_data?: Record<string, string>[];
}

/**
 * Test run data for creation
 */
export interface CreateTestRunData {
  project_id: number;
  total_steps: number;
  total_rows?: number;
}

/**
 * Test run data
 */
export interface TestRunData {
  id?: number;
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  start_time: string;
  end_time?: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps?: number;
  total_rows?: number;
  completed_rows?: number;
  test_results?: unknown[];
  logs?: string;
  error_message?: string;
}

/**
 * Storage actions
 */
export const STORAGE_ACTIONS = {
  // Projects
  GET_ALL_PROJECTS: 'get_all_projects',
  GET_PROJECT_BY_ID: 'get_project_by_id',
  ADD_PROJECT: 'add_project',
  UPDATE_PROJECT: 'update_project',
  DELETE_PROJECT: 'delete_project',
  UPDATE_PROJECT_STEPS: 'update_project_steps',
  UPDATE_PROJECT_FIELDS: 'update_project_fields',
  UPDATE_PROJECT_CSV: 'update_project_csv',
  
  // Test Runs
  GET_TEST_RUNS_BY_PROJECT: 'getTestRunsByProject',
  CREATE_TEST_RUN: 'createTestRun',
  UPDATE_TEST_RUN: 'updateTestRun',
  GET_TEST_RUN_BY_ID: 'getTestRunById',
  DELETE_TEST_RUN: 'deleteTestRun',
} as const;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useStorage - Hook for storage operations
 * 
 * @param options - Configuration options
 * @returns Storage hook interface
 */
export function useStorage(options: UseStorageOptions = {}): UseStorageReturn {
  const opts = { ...DEFAULT_STORAGE_OPTIONS, ...options };
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<string | null>(null);
  
  // Refs for cache and pending operations
  const cacheRef = useRef<Map<string, CacheEntry<unknown>>>(new Map());
  const pendingRef = useRef<Map<string, Promise<StorageResponse<unknown>>>>(new Map());
  const mountedRef = useRef(true);
  
  // Chrome runtime (can be injected for testing)
  const chromeRuntimeRef = useRef<IChromeRuntime | null>(
    typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : null
  );

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ==========================================================================
  // CORE MESSAGING
  // ==========================================================================

  /**
   * Send message with Promise wrapper
   */
  const sendMessageRaw = useCallback(<TResponse>(
    message: StorageMessage
  ): Promise<StorageResponse<TResponse>> => {
    return new Promise((resolve) => {
      const runtime = chromeRuntimeRef.current;
      
      if (!runtime) {
        resolve({
          success: false,
          error: 'Chrome runtime not available',
        });
        return;
      }

      // Timeout handler
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: `Operation timeout after ${opts.timeout}ms`,
        });
      }, opts.timeout);

      try {
        runtime.sendMessage<TResponse>(message, (response) => {
          clearTimeout(timeoutId);

          // Check for Chrome runtime error
          if (runtime.lastError) {
            resolve({
              success: false,
              error: runtime.lastError.message ?? 'Unknown error',
            });
            return;
          }

          // Handle undefined response
          if (response === undefined) {
            resolve({
              success: false,
              error: 'No response from background',
            });
            return;
          }

          resolve(response);
        });
      } catch (err) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: err instanceof Error ? err.message : 'Message send failed',
        });
      }
    });
  }, [opts.timeout]);

  /**
   * Send message with retry
   */
  const sendMessageWithRetry = useCallback(async <TResponse>(
    message: StorageMessage,
    retriesLeft: number
  ): Promise<StorageResponse<TResponse>> => {
    const response = await sendMessageRaw<TResponse>(message);

    if (!response.success && retriesLeft > 0) {
      if (opts.debug) {
        console.log(`[useStorage] Retry ${opts.retryCount - retriesLeft + 1}:`, message.action);
      }
      
      await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
      return sendMessageWithRetry<TResponse>(message, retriesLeft - 1);
    }

    return response;
  }, [sendMessageRaw, opts.retryCount, opts.retryDelay, opts.debug]);

  /**
   * Generate cache key
   */
  const getCacheKey = useCallback((action: string, payload?: unknown): string => {
    return `${action}:${JSON.stringify(payload ?? {})}`;
  }, []);

  /**
   * Check cache for response
   */
  const checkCache = useCallback(<TResponse>(
    action: string,
    payload?: unknown
  ): StorageResponse<TResponse> | null => {
    if (!opts.cacheEnabled) return null;

    const key = getCacheKey(action, payload);
    const entry = cacheRef.current.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      if (opts.debug) {
        console.log(`[useStorage] Cache hit:`, action);
      }
      return { success: true, data: entry.data as TResponse };
    }

    // Remove expired entry
    if (entry) {
      cacheRef.current.delete(key);
    }

    return null;
  }, [opts.cacheEnabled, opts.debug, getCacheKey]);

  /**
   * Store response in cache
   */
  const cacheResponse = useCallback(<TResponse>(
    action: string,
    payload: unknown,
    response: StorageResponse<TResponse>
  ): void => {
    if (!opts.cacheEnabled || !response.success) return;

    const key = getCacheKey(action, payload);
    const now = Date.now();

    cacheRef.current.set(key, {
      data: response.data,
      timestamp: now,
      expiresAt: now + opts.cacheTTL,
    });
  }, [opts.cacheEnabled, opts.cacheTTL, getCacheKey]);

  /**
   * Main send message function
   */
  const sendMessage = useCallback(async <TResponse = unknown, TPayload = unknown>(
    action: string,
    payload?: TPayload
  ): Promise<StorageResponse<TResponse>> => {
    // Check cache first
    const cached = checkCache<TResponse>(action, payload);
    if (cached) return cached;

    // Check for pending request with same key (deduplication)
    const key = getCacheKey(action, payload);
    const pending = pendingRef.current.get(key);
    if (pending) {
      if (opts.debug) {
        console.log(`[useStorage] Deduplicating request:`, action);
      }
      return pending as Promise<StorageResponse<TResponse>>;
    }

    // Update state
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
      setLastOperation(action);
    }

    const message: StorageMessage<TPayload> = { action, payload };

    // Create promise and store for deduplication
    const promise = sendMessageWithRetry<TResponse>(message, opts.retryCount);
    pendingRef.current.set(key, promise as Promise<StorageResponse<unknown>>);

    try {
      const response = await promise;

      if (mountedRef.current) {
        setIsLoading(false);
        if (!response.success && response.error) {
          setError(response.error);
        }
      }

      // Cache successful response
      cacheResponse(action, payload, response);

      return response;
    } finally {
      pendingRef.current.delete(key);
    }
  }, [
    checkCache,
    getCacheKey,
    sendMessageWithRetry,
    cacheResponse,
    opts.retryCount,
    opts.debug,
  ]);

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Invalidate cache entries for specific action
   */
  const invalidateCache = useCallback((action: string): void => {
    const keysToDelete: string[] = [];
    
    cacheRef.current.forEach((_, key) => {
      if (key.startsWith(`${action}:`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => cacheRef.current.delete(key));
  }, []);

  /**
   * Get all projects
   */
  const getProjects = useCallback(async (): Promise<StorageResponse<{ projects: unknown[] }>> => {
    return sendMessage(STORAGE_ACTIONS.GET_ALL_PROJECTS);
  }, [sendMessage]);

  /**
   * Get project by ID
   */
  const getProject = useCallback(async (
    id: number
  ): Promise<StorageResponse<{ project: unknown }>> => {
    return sendMessage(STORAGE_ACTIONS.GET_PROJECT_BY_ID, { id });
  }, [sendMessage]);

  /**
   * Add new project
   */
  const addProject = useCallback(async (
    project: CreateProjectData
  ): Promise<StorageResponse<{ id: number }>> => {
    const response = await sendMessage<{ id: number }>(
      STORAGE_ACTIONS.ADD_PROJECT,
      project
    );
    
    // Invalidate projects cache on success
    if (response.success) {
      invalidateCache(STORAGE_ACTIONS.GET_ALL_PROJECTS);
    }
    
    return response;
  }, [sendMessage, invalidateCache]);

  /**
   * Update project
   */
  const updateProject = useCallback(async (
    id: number,
    updates: Partial<ProjectData>
  ): Promise<StorageResponse<void>> => {
    const response = await sendMessage<void>(
      STORAGE_ACTIONS.UPDATE_PROJECT,
      { id, ...updates }
    );
    
    // Invalidate caches on success
    if (response.success) {
      invalidateCache(STORAGE_ACTIONS.GET_ALL_PROJECTS);
      invalidateCache(STORAGE_ACTIONS.GET_PROJECT_BY_ID);
    }
    
    return response;
  }, [sendMessage, invalidateCache]);

  /**
   * Delete project
   */
  const deleteProject = useCallback(async (
    id: number
  ): Promise<StorageResponse<void>> => {
    const response = await sendMessage<void>(STORAGE_ACTIONS.DELETE_PROJECT, { id });
    
    // Invalidate caches on success
    if (response.success) {
      invalidateCache(STORAGE_ACTIONS.GET_ALL_PROJECTS);
      invalidateCache(STORAGE_ACTIONS.GET_PROJECT_BY_ID);
    }
    
    return response;
  }, [sendMessage, invalidateCache]);

  /**
   * Get test runs for project
   */
  const getTestRuns = useCallback(async (
    projectId: number
  ): Promise<StorageResponse<{ testRuns: unknown[] }>> => {
    return sendMessage(STORAGE_ACTIONS.GET_TEST_RUNS_BY_PROJECT, { project_id: projectId });
  }, [sendMessage]);

  /**
   * Create test run
   */
  const createTestRun = useCallback(async (
    testRun: CreateTestRunData
  ): Promise<StorageResponse<{ id: number }>> => {
    return sendMessage(STORAGE_ACTIONS.CREATE_TEST_RUN, testRun);
  }, [sendMessage]);

  /**
   * Update test run
   */
  const updateTestRun = useCallback(async (
    id: number,
    updates: Partial<TestRunData>
  ): Promise<StorageResponse<void>> => {
    return sendMessage(STORAGE_ACTIONS.UPDATE_TEST_RUN, { id, ...updates });
  }, [sendMessage]);

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Clear entire cache
   */
  const clearCache = useCallback((): void => {
    cacheRef.current.clear();
  }, []);

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback((): void => {
    setIsLoading(false);
    setError(null);
    setLastOperation(null);
    clearCache();
  }, [clearCache]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // State
    isLoading,
    error,
    lastOperation,
    
    // Methods
    sendMessage,
    
    // Convenience methods
    getProjects,
    getProject,
    addProject,
    updateProject,
    deleteProject,
    getTestRuns,
    createTestRun,
    updateTestRun,
    
    // Cache
    clearCache,
    invalidateCache,
    
    // State management
    clearError,
    reset,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * useStorageQuery - Hook for single query with automatic loading
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useStorageQuery('get_all_projects');
 * ```
 */
export function useStorageQuery<TResponse = unknown>(
  action: string,
  payload?: unknown,
  options: UseStorageOptions & { enabled?: boolean } = {}
): {
  data: TResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { enabled = true, ...storageOptions } = options;
  const { sendMessage, isLoading, error } = useStorage(storageOptions);
  const [data, setData] = useState<TResponse | null>(null);

  const refetch = useCallback(async () => {
    const response = await sendMessage<TResponse>(action, payload);
    if (response.success && response.data) {
      setData(response.data);
    }
  }, [sendMessage, action, payload]);

  useEffect(() => {
    if (enabled) {
      refetch();
    }
  }, [enabled, refetch]);

  return { data, isLoading, error, refetch };
}

/**
 * useStorageMutation - Hook for mutations
 * 
 * @example
 * ```tsx
 * const { mutate, isLoading, error } = useStorageMutation('add_project');
 * await mutate({ name: 'Test', target_url: 'https://example.com' });
 * ```
 */
export function useStorageMutation<TResponse = unknown, TPayload = unknown>(
  action: string,
  options: UseStorageOptions & {
    onSuccess?: (response: StorageResponse<TResponse>) => void;
    onError?: (error: string) => void;
  } = {}
): {
  mutate: (payload: TPayload) => Promise<StorageResponse<TResponse>>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
} {
  const { onSuccess, onError, ...storageOptions } = options;
  const { sendMessage, isLoading, error, clearError } = useStorage(storageOptions);

  const mutate = useCallback(async (payload: TPayload): Promise<StorageResponse<TResponse>> => {
    const response = await sendMessage<TResponse, TPayload>(action, payload);
    
    if (response.success) {
      onSuccess?.(response);
    } else if (response.error) {
      onError?.(response.error);
    }
    
    return response;
  }, [sendMessage, action, onSuccess, onError]);

  return { mutate, isLoading, error, reset: clearError };
}
