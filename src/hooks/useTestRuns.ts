/**
 * useTestRuns - React hook for test run management
 * @module hooks/useTestRuns
 * @version 1.0.0
 * 
 * Provides test run management interface:
 * - CRUD operations for test runs
 * - Real-time status tracking
 * - Execution history by project
 * - Run statistics and metrics
 * 
 * @example
 * ```tsx
 * const { 
 *   testRuns, 
 *   activeRun,
 *   createRun,
 *   updateRunStatus,
 *   stats 
 * } = useTestRuns(projectId);
 * ```
 * 
 * @see test-orchestrator_breakdown.md for orchestration patterns
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  useStorage,
  type CreateTestRunData,
  type TestRunData,
  type UseStorageOptions,
} from './useStorage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Test run status
 */
export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';

/**
 * Step result status
 */
export type StepResultStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Step result
 */
export interface StepResult {
  stepIndex: number;
  stepLabel?: string;
  status: StepResultStatus;
  duration: number;
  errorMessage?: string;
  timestamp: number;
  rowIndex?: number;
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  stepIndex?: number;
  rowIndex?: number;
}

/**
 * Full test run interface
 */
export interface TestRun {
  id: number;
  project_id: number;
  status: TestRunStatus;
  start_time: string;
  end_time?: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  total_rows: number;
  completed_rows: number;
  current_row: number;
  current_step: number;
  test_results: StepResult[];
  logs: LogEntry[];
  error_message?: string;
  duration?: number;
}

/**
 * Test run statistics
 */
export interface TestRunStats {
  totalRuns: number;
  byStatus: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    stopped: number;
  };
  successRate: number; // Percentage
  avgDuration: number; // ms
  avgPassRate: number; // Percentage
  totalStepsExecuted: number;
  totalStepsPassed: number;
  totalStepsFailed: number;
  lastRunAt: Date | null;
}

/**
 * Progress information
 */
export interface RunProgress {
  percentage: number;
  currentStep: number;
  totalSteps: number;
  currentRow: number;
  totalRows: number;
  passedSteps: number;
  failedSteps: number;
  elapsedTime: number;
  estimatedRemaining: number;
}

/**
 * Hook options
 */
export interface UseTestRunsOptions extends UseStorageOptions {
  projectId?: number;
  autoLoad?: boolean;
  limit?: number;
}

/**
 * Default options
 */
export const DEFAULT_TESTRUNS_OPTIONS: UseTestRunsOptions = {
  autoLoad: true,
  limit: 50,
};

/**
 * Input for creating a test run
 */
export interface CreateTestRunInput {
  project_id: number;
  total_steps: number;
  total_rows?: number;
}

/**
 * Input for updating test run progress
 */
export interface UpdateProgressInput {
  current_step?: number;
  current_row?: number;
  passed_steps?: number;
  failed_steps?: number;
  skipped_steps?: number;
  completed_rows?: number;
}

/**
 * Hook return type
 */
export interface UseTestRunsReturn {
  // Data
  testRuns: TestRun[];
  activeRun: TestRun | null;
  stats: TestRunStats;
  progress: RunProgress | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Operations
  loadTestRuns: (projectId?: number) => Promise<void>;
  getTestRun: (id: number) => Promise<TestRun | null>;
  createRun: (input: CreateTestRunInput) => Promise<number | null>;
  startRun: (id: number) => Promise<boolean>;
  completeRun: (id: number, results?: Partial<TestRun>) => Promise<boolean>;
  failRun: (id: number, errorMessage?: string) => Promise<boolean>;
  stopRun: (id: number) => Promise<boolean>;
  deleteRun: (id: number) => Promise<boolean>;
  
  // Progress updates
  updateProgress: (id: number, progress: UpdateProgressInput) => Promise<boolean>;
  addStepResult: (id: number, result: StepResult) => Promise<boolean>;
  addLog: (id: number, entry: LogEntry) => Promise<boolean>;
  
  // Utilities
  setActiveRun: (run: TestRun | null) => void;
  clearHistory: (projectId: number) => Promise<boolean>;
  exportRun: (id: number) => Promise<ExportedTestRun | null>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Exported test run format
 */
export interface ExportedTestRun {
  id: number;
  project_id: number;
  status: TestRunStatus;
  start_time: string;
  end_time?: string;
  duration?: number;
  summary: {
    total_steps: number;
    passed: number;
    failed: number;
    skipped: number;
    pass_rate: number;
  };
  results: StepResult[];
  logs: LogEntry[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useTestRuns - Hook for test run management
 */
export function useTestRuns(options: UseTestRunsOptions = {}): UseTestRunsReturn {
  const opts = { ...DEFAULT_TESTRUNS_OPTIONS, ...options };
  
  // Storage hook
  const storage = useStorage(options);
  
  // State
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<number | undefined>(opts.projectId);

  // ==========================================================================
  // LOAD TEST RUNS
  // ==========================================================================

  /**
   * Load test runs for a project
   */
  const loadTestRuns = useCallback(async (projectId?: number): Promise<void> => {
    const pid = projectId ?? currentProjectId;
    if (!pid) return;

    setIsLoading(true);
    setCurrentProjectId(pid);
    
    const response = await storage.getTestRuns(pid);
    
    if (response.success && response.data) {
      const runs = (response.data.testRuns as TestRun[])
        .map(normalizeTestRun)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, opts.limit);
      
      setTestRuns(runs);
      
      // Set active run if one is running
      const running = runs.find(r => r.status === 'running');
      if (running) {
        setActiveRun(running);
      }
    }
    
    setIsLoading(false);
  }, [currentProjectId, storage.getTestRuns, opts.limit]);

  /**
   * Auto-load on mount when projectId provided
   */
  useEffect(() => {
    if (opts.autoLoad && opts.projectId) {
      loadTestRuns(opts.projectId);
    }
  }, [opts.autoLoad, opts.projectId, loadTestRuns]);

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Calculate test run statistics
   */
  const stats = useMemo((): TestRunStats => {
    if (testRuns.length === 0) {
      return {
        totalRuns: 0,
        byStatus: { pending: 0, running: 0, completed: 0, failed: 0, stopped: 0 },
        successRate: 0,
        avgDuration: 0,
        avgPassRate: 0,
        totalStepsExecuted: 0,
        totalStepsPassed: 0,
        totalStepsFailed: 0,
        lastRunAt: null,
      };
    }

    const completedRuns = testRuns.filter(r => r.status === 'completed' || r.status === 'failed');
    const successfulRuns = testRuns.filter(r => r.status === 'completed' && r.failed_steps === 0);
    
    const totalDuration = completedRuns.reduce((sum, r) => sum + (r.duration ?? 0), 0);
    const totalStepsExecuted = testRuns.reduce((sum, r) => sum + r.passed_steps + r.failed_steps, 0);
    const totalStepsPassed = testRuns.reduce((sum, r) => sum + r.passed_steps, 0);
    const totalStepsFailed = testRuns.reduce((sum, r) => sum + r.failed_steps, 0);
    
    // Calculate average pass rate across all runs
    const passRates = completedRuns.map(r => {
      const total = r.passed_steps + r.failed_steps;
      return total > 0 ? (r.passed_steps / total) * 100 : 0;
    });
    const avgPassRate = passRates.length > 0 
      ? passRates.reduce((a, b) => a + b, 0) / passRates.length 
      : 0;

    const sortedByDate = [...testRuns].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );

    return {
      totalRuns: testRuns.length,
      byStatus: {
        pending: testRuns.filter(r => r.status === 'pending').length,
        running: testRuns.filter(r => r.status === 'running').length,
        completed: testRuns.filter(r => r.status === 'completed').length,
        failed: testRuns.filter(r => r.status === 'failed').length,
        stopped: testRuns.filter(r => r.status === 'stopped').length,
      },
      successRate: completedRuns.length > 0 
        ? (successfulRuns.length / completedRuns.length) * 100 
        : 0,
      avgDuration: completedRuns.length > 0 
        ? totalDuration / completedRuns.length 
        : 0,
      avgPassRate,
      totalStepsExecuted,
      totalStepsPassed,
      totalStepsFailed,
      lastRunAt: sortedByDate.length > 0 
        ? new Date(sortedByDate[0].start_time) 
        : null,
    };
  }, [testRuns]);

  // ==========================================================================
  // PROGRESS CALCULATION
  // ==========================================================================

  /**
   * Calculate progress for active run
   */
  const progress = useMemo((): RunProgress | null => {
    if (!activeRun || activeRun.status !== 'running') {
      return null;
    }

    const completed = activeRun.passed_steps + activeRun.failed_steps + activeRun.skipped_steps;
    const total = activeRun.total_steps * Math.max(activeRun.total_rows, 1);
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    const startTime = new Date(activeRun.start_time).getTime();
    const elapsedTime = Date.now() - startTime;
    
    // Estimate remaining time based on current pace
    const stepsPerMs = completed > 0 ? elapsedTime / completed : 0;
    const remainingSteps = total - completed;
    const estimatedRemaining = stepsPerMs * remainingSteps;

    return {
      percentage,
      currentStep: activeRun.current_step,
      totalSteps: activeRun.total_steps,
      currentRow: activeRun.current_row,
      totalRows: activeRun.total_rows,
      passedSteps: activeRun.passed_steps,
      failedSteps: activeRun.failed_steps,
      elapsedTime,
      estimatedRemaining,
    };
  }, [activeRun]);

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get single test run by ID
   */
  const getTestRun = useCallback(async (id: number): Promise<TestRun | null> => {
    const response = await storage.sendMessage('getTestRunById', { id });
    
    if (response.success && response.data) {
      return normalizeTestRun((response.data as { testRun: TestRun }).testRun);
    }
    
    return null;
  }, [storage.sendMessage]);

  /**
   * Create new test run
   */
  const createRun = useCallback(async (
    input: CreateTestRunInput
  ): Promise<number | null> => {
    const runData: CreateTestRunData = {
      project_id: input.project_id,
      total_steps: input.total_steps,
      total_rows: input.total_rows ?? 1,
    };
    
    const response = await storage.createTestRun(runData);
    
    if (response.success && response.data?.id) {
      // Create the new run object
      const newRun: TestRun = {
        id: response.data.id,
        project_id: input.project_id,
        status: 'pending',
        start_time: new Date().toISOString(),
        total_steps: input.total_steps,
        passed_steps: 0,
        failed_steps: 0,
        skipped_steps: 0,
        total_rows: input.total_rows ?? 1,
        completed_rows: 0,
        current_row: 0,
        current_step: 0,
        test_results: [],
        logs: [],
      };
      
      // Update local state
      setTestRuns(prev => [newRun, ...prev]);
      
      return response.data.id;
    }
    
    return null;
  }, [storage.createTestRun]);

  /**
   * Start a test run
   */
  const startRun = useCallback(async (id: number): Promise<boolean> => {
    const response = await storage.updateTestRun(id, {
      status: 'running',
      start_time: new Date().toISOString(),
    });
    
    if (response.success) {
      setTestRuns(prev => prev.map(r => 
        r.id === id 
          ? { ...r, status: 'running' as TestRunStatus, start_time: new Date().toISOString() }
          : r
      ));
      
      // Set as active
      const run = testRuns.find(r => r.id === id);
      if (run) {
        setActiveRun({ ...run, status: 'running', start_time: new Date().toISOString() });
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, testRuns]);

  /**
   * Complete a test run
   */
  const completeRun = useCallback(async (
    id: number,
    results?: Partial<TestRun>
  ): Promise<boolean> => {
    const endTime = new Date().toISOString();
    const run = testRuns.find(r => r.id === id) ?? activeRun;
    
    const duration = run 
      ? Date.now() - new Date(run.start_time).getTime()
      : 0;
    
    const updates: Partial<TestRunData> = {
      status: 'completed',
      end_time: endTime,
      ...results,
    };
    
    const response = await storage.updateTestRun(id, updates);
    
    if (response.success) {
      const updatedRun: Partial<TestRun> = {
        ...updates,
        duration,
      };
      
      setTestRuns(prev => prev.map(r => 
        r.id === id ? { ...r, ...updatedRun } : r
      ));
      
      if (activeRun?.id === id) {
        setActiveRun(prev => prev ? { ...prev, ...updatedRun } : null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, testRuns, activeRun]);

  /**
   * Fail a test run
   */
  const failRun = useCallback(async (
    id: number,
    errorMessage?: string
  ): Promise<boolean> => {
    const endTime = new Date().toISOString();
    const run = testRuns.find(r => r.id === id) ?? activeRun;
    
    const duration = run 
      ? Date.now() - new Date(run.start_time).getTime()
      : 0;
    
    const response = await storage.updateTestRun(id, {
      status: 'failed',
      end_time: endTime,
      error_message: errorMessage,
    });
    
    if (response.success) {
      const updates: Partial<TestRun> = {
        status: 'failed',
        end_time: endTime,
        error_message: errorMessage,
        duration,
      };
      
      setTestRuns(prev => prev.map(r => 
        r.id === id ? { ...r, ...updates } : r
      ));
      
      if (activeRun?.id === id) {
        setActiveRun(prev => prev ? { ...prev, ...updates } : null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, testRuns, activeRun]);

  /**
   * Stop a test run
   */
  const stopRun = useCallback(async (id: number): Promise<boolean> => {
    const endTime = new Date().toISOString();
    const run = testRuns.find(r => r.id === id) ?? activeRun;
    
    const duration = run 
      ? Date.now() - new Date(run.start_time).getTime()
      : 0;
    
    const response = await storage.updateTestRun(id, {
      status: 'stopped',
      end_time: endTime,
    });
    
    if (response.success) {
      const updates: Partial<TestRun> = {
        status: 'stopped',
        end_time: endTime,
        duration,
      };
      
      setTestRuns(prev => prev.map(r => 
        r.id === id ? { ...r, ...updates } : r
      ));
      
      if (activeRun?.id === id) {
        setActiveRun(null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, testRuns, activeRun]);

  /**
   * Delete a test run
   */
  const deleteRun = useCallback(async (id: number): Promise<boolean> => {
    const response = await storage.sendMessage('deleteTestRun', { id });
    
    if (response.success) {
      setTestRuns(prev => prev.filter(r => r.id !== id));
      
      if (activeRun?.id === id) {
        setActiveRun(null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.sendMessage, activeRun]);

  // ==========================================================================
  // PROGRESS UPDATES
  // ==========================================================================

  /**
   * Update run progress
   */
  const updateProgress = useCallback(async (
    id: number,
    progressUpdate: UpdateProgressInput
  ): Promise<boolean> => {
    const response = await storage.updateTestRun(id, progressUpdate);
    
    if (response.success) {
      setTestRuns(prev => prev.map(r => 
        r.id === id ? { ...r, ...progressUpdate } : r
      ));
      
      if (activeRun?.id === id) {
        setActiveRun(prev => prev ? { ...prev, ...progressUpdate } : null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, activeRun]);

  /**
   * Add step result
   */
  const addStepResult = useCallback(async (
    id: number,
    result: StepResult
  ): Promise<boolean> => {
    const run = testRuns.find(r => r.id === id) ?? activeRun;
    if (!run) return false;

    const newResults = [...run.test_results, result];
    
    // Update counters based on result
    const updates: UpdateProgressInput = {
      current_step: result.stepIndex + 1,
    };
    
    if (result.status === 'passed') {
      updates.passed_steps = run.passed_steps + 1;
    } else if (result.status === 'failed') {
      updates.failed_steps = run.failed_steps + 1;
    } else if (result.status === 'skipped') {
      updates.skipped_steps = run.skipped_steps + 1;
    }
    
    const response = await storage.updateTestRun(id, {
      ...updates,
      test_results: newResults,
    });
    
    if (response.success) {
      const fullUpdates = {
        ...updates,
        test_results: newResults,
      };
      
      setTestRuns(prev => prev.map(r => 
        r.id === id ? { ...r, ...fullUpdates } : r
      ));
      
      if (activeRun?.id === id) {
        setActiveRun(prev => prev ? { ...prev, ...fullUpdates } : null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, testRuns, activeRun]);

  /**
   * Add log entry
   */
  const addLog = useCallback(async (
    id: number,
    entry: LogEntry
  ): Promise<boolean> => {
    const run = testRuns.find(r => r.id === id) ?? activeRun;
    if (!run) return false;

    const newLogs = [...run.logs, entry];
    
    const response = await storage.updateTestRun(id, {
      logs: newLogs,
    });
    
    if (response.success) {
      setTestRuns(prev => prev.map(r => 
        r.id === id ? { ...r, logs: newLogs } : r
      ));
      
      if (activeRun?.id === id) {
        setActiveRun(prev => prev ? { ...prev, logs: newLogs } : null);
      }
      
      return true;
    }
    
    return false;
  }, [storage.updateTestRun, testRuns, activeRun]);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Clear all test history for a project
   */
  const clearHistory = useCallback(async (projectId: number): Promise<boolean> => {
    const runsToDelete = testRuns.filter(r => r.project_id === projectId);
    
    for (const run of runsToDelete) {
      await storage.sendMessage('deleteTestRun', { id: run.id });
    }
    
    setTestRuns(prev => prev.filter(r => r.project_id !== projectId));
    
    if (activeRun && activeRun.project_id === projectId) {
      setActiveRun(null);
    }
    
    return true;
  }, [storage.sendMessage, testRuns, activeRun]);

  /**
   * Export test run data
   */
  const exportRun = useCallback(async (id: number): Promise<ExportedTestRun | null> => {
    const run = testRuns.find(r => r.id === id) ?? await getTestRun(id);
    if (!run) return null;

    const total = run.passed_steps + run.failed_steps + run.skipped_steps;
    
    return {
      id: run.id,
      project_id: run.project_id,
      status: run.status,
      start_time: run.start_time,
      end_time: run.end_time,
      duration: run.duration,
      summary: {
        total_steps: run.total_steps,
        passed: run.passed_steps,
        failed: run.failed_steps,
        skipped: run.skipped_steps,
        pass_rate: total > 0 ? (run.passed_steps / total) * 100 : 0,
      },
      results: run.test_results,
      logs: run.logs,
    };
  }, [testRuns, getTestRun]);

  /**
   * Refresh test runs
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (currentProjectId) {
      await loadTestRuns(currentProjectId);
    }
  }, [loadTestRuns, currentProjectId]);

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
    testRuns,
    activeRun,
    stats,
    progress,
    
    // State
    isLoading,
    error: storage.error,
    
    // Operations
    loadTestRuns,
    getTestRun,
    createRun,
    startRun,
    completeRun,
    failRun,
    stopRun,
    deleteRun,
    
    // Progress updates
    updateProgress,
    addStepResult,
    addLog,
    
    // Utilities
    setActiveRun,
    clearHistory,
    exportRun,
    refresh,
    clearError,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize test run data
 */
function normalizeTestRun(run: Partial<TestRun>): TestRun {
  return {
    id: run.id ?? 0,
    project_id: run.project_id ?? 0,
    status: run.status ?? 'pending',
    start_time: run.start_time ?? new Date().toISOString(),
    end_time: run.end_time,
    total_steps: run.total_steps ?? 0,
    passed_steps: run.passed_steps ?? 0,
    failed_steps: run.failed_steps ?? 0,
    skipped_steps: run.skipped_steps ?? 0,
    total_rows: run.total_rows ?? 1,
    completed_rows: run.completed_rows ?? 0,
    current_row: run.current_row ?? 0,
    current_step: run.current_step ?? 0,
    test_results: run.test_results ?? [],
    logs: run.logs ?? [],
    error_message: run.error_message,
    duration: run.duration,
  };
}

// ============================================================================
// SINGLE TEST RUN HOOK
// ============================================================================

/**
 * useTestRun - Hook for single test run management
 */
export function useTestRun(
  runId: number | null,
  options: UseStorageOptions = {}
): {
  run: TestRun | null;
  isLoading: boolean;
  error: string | null;
  progress: RunProgress | null;
  reload: () => Promise<void>;
  start: () => Promise<boolean>;
  complete: (results?: Partial<TestRun>) => Promise<boolean>;
  fail: (errorMessage?: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
  addResult: (result: StepResult) => Promise<boolean>;
  addLog: (entry: LogEntry) => Promise<boolean>;
} {
  const storage = useStorage(options);
  const [run, setRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load test run
   */
  const loadRun = useCallback(async (): Promise<void> => {
    if (!runId) {
      setRun(null);
      return;
    }

    setIsLoading(true);
    const response = await storage.sendMessage('getTestRunById', { id: runId });
    
    if (response.success && response.data) {
      setRun(normalizeTestRun((response.data as { testRun: TestRun }).testRun));
    } else {
      setRun(null);
    }
    
    setIsLoading(false);
  }, [runId, storage.sendMessage]);

  // Load on mount
  useEffect(() => {
    loadRun();
  }, [loadRun]);

  /**
   * Calculate progress
   */
  const progress = useMemo((): RunProgress | null => {
    if (!run || run.status !== 'running') return null;

    const completed = run.passed_steps + run.failed_steps + run.skipped_steps;
    const total = run.total_steps * Math.max(run.total_rows, 1);
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    const startTime = new Date(run.start_time).getTime();
    const elapsedTime = Date.now() - startTime;
    
    const stepsPerMs = completed > 0 ? elapsedTime / completed : 0;
    const remainingSteps = total - completed;
    const estimatedRemaining = stepsPerMs * remainingSteps;

    return {
      percentage,
      currentStep: run.current_step,
      totalSteps: run.total_steps,
      currentRow: run.current_row,
      totalRows: run.total_rows,
      passedSteps: run.passed_steps,
      failedSteps: run.failed_steps,
      elapsedTime,
      estimatedRemaining,
    };
  }, [run]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!runId) return false;
    const response = await storage.updateTestRun(runId, { 
      status: 'running',
      start_time: new Date().toISOString(),
    });
    if (response.success) {
      setRun(prev => prev ? { ...prev, status: 'running', start_time: new Date().toISOString() } : null);
    }
    return response.success;
  }, [runId, storage.updateTestRun]);

  const complete = useCallback(async (results?: Partial<TestRun>): Promise<boolean> => {
    if (!runId) return false;
    const endTime = new Date().toISOString();
    const duration = run ? Date.now() - new Date(run.start_time).getTime() : 0;
    
    const response = await storage.updateTestRun(runId, {
      status: 'completed',
      end_time: endTime,
      ...results,
    });
    
    if (response.success) {
      setRun(prev => prev ? { ...prev, status: 'completed', end_time: endTime, duration, ...results } : null);
    }
    return response.success;
  }, [runId, run, storage.updateTestRun]);

  const fail = useCallback(async (errorMessage?: string): Promise<boolean> => {
    if (!runId) return false;
    const endTime = new Date().toISOString();
    const duration = run ? Date.now() - new Date(run.start_time).getTime() : 0;
    
    const response = await storage.updateTestRun(runId, {
      status: 'failed',
      end_time: endTime,
      error_message: errorMessage,
    });
    
    if (response.success) {
      setRun(prev => prev ? { ...prev, status: 'failed', end_time: endTime, duration, error_message: errorMessage } : null);
    }
    return response.success;
  }, [runId, run, storage.updateTestRun]);

  const stop = useCallback(async (): Promise<boolean> => {
    if (!runId) return false;
    const endTime = new Date().toISOString();
    const duration = run ? Date.now() - new Date(run.start_time).getTime() : 0;
    
    const response = await storage.updateTestRun(runId, {
      status: 'stopped',
      end_time: endTime,
    });
    
    if (response.success) {
      setRun(prev => prev ? { ...prev, status: 'stopped', end_time: endTime, duration } : null);
    }
    return response.success;
  }, [runId, run, storage.updateTestRun]);

  const addResult = useCallback(async (result: StepResult): Promise<boolean> => {
    if (!runId || !run) return false;
    
    const newResults = [...run.test_results, result];
    const updates: Partial<TestRunData> = {
      test_results: newResults,
      current_step: result.stepIndex + 1,
    };
    
    if (result.status === 'passed') updates.passed_steps = run.passed_steps + 1;
    else if (result.status === 'failed') updates.failed_steps = run.failed_steps + 1;
    else if (result.status === 'skipped') updates.skipped_steps = run.skipped_steps + 1;
    
    const response = await storage.updateTestRun(runId, updates);
    
    if (response.success) {
      setRun(prev => prev ? { ...prev, ...updates, test_results: newResults } : null);
    }
    return response.success;
  }, [runId, run, storage.updateTestRun]);

  const addLogEntry = useCallback(async (entry: LogEntry): Promise<boolean> => {
    if (!runId || !run) return false;
    
    const newLogs = [...run.logs, entry];
    const response = await storage.updateTestRun(runId, { logs: newLogs });
    
    if (response.success) {
      setRun(prev => prev ? { ...prev, logs: newLogs } : null);
    }
    return response.success;
  }, [runId, run, storage.updateTestRun]);

  return {
    run,
    isLoading,
    error: storage.error,
    progress,
    reload: loadRun,
    start,
    complete,
    fail,
    stop,
    addResult,
    addLog: addLogEntry,
  };
}
