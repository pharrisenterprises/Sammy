/**
 * useReplay - React hook for replay/test execution
 * @module hooks/useReplay
 * @version 1.0.0
 * 
 * Provides replay execution interface:
 * - Start/stop/pause replay sessions
 * - Step-by-step execution with progress tracking
 * - CSV data injection for parameterized tests
 * - Real-time status and result updates
 * - Multi-row iteration support
 * 
 * @example
 * ```tsx
 * const { 
 *   isRunning,
 *   progress,
 *   startReplay,
 *   stopReplay,
 *   stepResults 
 * } = useReplay({ projectId: 123, steps, csvData });
 * ```
 * 
 * @see replay-engine_breakdown.md for execution patterns
 * @see test-orchestrator_breakdown.md for orchestration
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useStorage, type UseStorageOptions } from './useStorage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay status
 */
export type ReplayStatus = 'idle' | 'preparing' | 'running' | 'paused' | 'stopping' | 'completed' | 'failed' | 'stopped';

/**
 * Step execution status
 */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Replay step (from recording)
 */
export interface ReplayStep {
  id: string;
  eventType: string;
  xpath: string;
  value?: string;
  label?: string;
  x?: number;
  y?: number;
  bundle: Record<string, unknown>;
}

/**
 * Step execution result
 */
export interface StepResult {
  stepIndex: number;
  stepId: string;
  rowIndex: number;
  status: StepStatus;
  duration: number;
  errorMessage?: string;
  timestamp: number;
}

/**
 * Row execution result
 */
export interface RowResult {
  rowIndex: number;
  status: 'passed' | 'failed' | 'skipped';
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
  errorMessage?: string;
}

/**
 * Replay progress
 */
export interface ReplayProgress {
  percentage: number;
  currentStep: number;
  totalSteps: number;
  currentRow: number;
  totalRows: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  elapsedTime: number;
  estimatedRemaining: number;
}

/**
 * Replay session
 */
export interface ReplaySession {
  projectId: number;
  tabId: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  status: ReplayStatus;
  totalSteps: number;
  totalRows: number;
}

/**
 * Log entry
 */
export interface ReplayLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  stepIndex?: number;
  rowIndex?: number;
}

/**
 * Field mapping for CSV injection
 */
export interface FieldMapping {
  field_name: string;
  mapped: boolean;
  inputvarfields: string; // Step label to inject into
}

/**
 * Chrome runtime interface
 */
export interface IChromeRuntime {
  sendMessage<T = unknown>(
    message: unknown,
    callback?: (response: T) => void
  ): void;
  onMessage: {
    addListener(listener: (message: unknown, sender: unknown, sendResponse: unknown) => void): void;
    removeListener(listener: (message: unknown, sender: unknown, sendResponse: unknown) => void): void;
  };
  lastError?: { message?: string };
}

/**
 * Chrome tabs interface
 */
export interface IChromeTabs {
  sendMessage<T = unknown>(
    tabId: number,
    message: unknown,
    callback?: (response: T) => void
  ): void;
}

/**
 * Hook options
 */
export interface UseReplayOptions extends UseStorageOptions {
  projectId: number;
  steps: ReplayStep[];
  csvData?: Record<string, string>[];
  fieldMappings?: FieldMapping[];
  targetUrl?: string;
  stepDelay?: number; // ms between steps
  stepTimeout?: number; // ms timeout per step
  retryCount?: number;
  stopOnError?: boolean;
}

/**
 * Default options
 */
export const DEFAULT_REPLAY_OPTIONS: Partial<UseReplayOptions> = {
  stepDelay: 1000,
  stepTimeout: 30000,
  retryCount: 0,
  stopOnError: false,
};

/**
 * Hook return type
 */
export interface UseReplayReturn {
  // State
  status: ReplayStatus;
  isRunning: boolean;
  isPaused: boolean;
  progress: ReplayProgress;
  session: ReplaySession;
  stepResults: StepResult[];
  rowResults: RowResult[];
  logs: ReplayLog[];
  error: string | null;
  
  // Control
  startReplay: () => Promise<boolean>;
  stopReplay: () => Promise<void>;
  pauseReplay: () => void;
  resumeReplay: () => void;
  resetReplay: () => void;
  
  // Step execution
  executeStep: (stepIndex: number, rowData?: Record<string, string>) => Promise<StepResult>;
  skipStep: (stepIndex: number) => void;
  retryStep: (stepIndex: number) => Promise<StepResult>;
  
  // Logs
  addLog: (level: ReplayLog['level'], message: string, stepIndex?: number, rowIndex?: number) => void;
  clearLogs: () => void;
  
  // Results
  getStepResult: (stepIndex: number, rowIndex?: number) => StepResult | undefined;
  getRowResult: (rowIndex: number) => RowResult | undefined;
  exportResults: () => ExportedResults;
  
  // Utilities
  setTabId: (tabId: number | null) => void;
  clearError: () => void;
}

/**
 * Exported results format
 */
export interface ExportedResults {
  projectId: number;
  exportedAt: string;
  session: ReplaySession;
  progress: ReplayProgress;
  stepResults: StepResult[];
  rowResults: RowResult[];
  logs: ReplayLog[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useReplay - Hook for replay execution
 */
export function useReplay(options: UseReplayOptions): UseReplayReturn {
  const opts = { ...DEFAULT_REPLAY_OPTIONS, ...options };
  
  // Storage hook
  const storage = useStorage(options);
  
  // State
  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [tabId, setTabIdState] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [rowResults, setRowResults] = useState<RowResult[]>([]);
  const [logs, setLogs] = useState<ReplayLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRow, setCurrentRow] = useState(0);
  const [passedSteps, setPassedSteps] = useState(0);
  const [failedSteps, setFailedSteps] = useState(0);
  const [skippedSteps, setSkippedSteps] = useState(0);
  
  // Refs
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const chromeRuntimeRef = useRef<IChromeRuntime | null>(
    typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime as IChromeRuntime : null
  );
  const chromeTabsRef = useRef<IChromeTabs | null>(
    typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs as IChromeTabs : null
  );

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  
  const totalRows = Math.max(opts.csvData?.length ?? 0, 1);
  const totalSteps = opts.steps.length * totalRows;

  const progress = useMemo((): ReplayProgress => {
    const completed = passedSteps + failedSteps + skippedSteps;
    const percentage = totalSteps > 0 ? (completed / totalSteps) * 100 : 0;
    
    const elapsedTime = startedAt ? Date.now() - startedAt.getTime() : 0;
    const stepsPerMs = completed > 0 ? elapsedTime / completed : 0;
    const remainingSteps = totalSteps - completed;
    const estimatedRemaining = stepsPerMs * remainingSteps;

    return {
      percentage,
      currentStep,
      totalSteps: opts.steps.length,
      currentRow,
      totalRows,
      passedSteps,
      failedSteps,
      skippedSteps,
      elapsedTime,
      estimatedRemaining,
    };
  }, [currentStep, currentRow, totalRows, passedSteps, failedSteps, skippedSteps, totalSteps, startedAt, opts.steps.length]);

  const session = useMemo((): ReplaySession => ({
    projectId: opts.projectId,
    tabId,
    startedAt,
    endedAt,
    status,
    totalSteps: opts.steps.length,
    totalRows,
  }), [opts.projectId, tabId, startedAt, endedAt, status, opts.steps.length, totalRows]);

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  const addLogInternal = useCallback((
    level: ReplayLog['level'],
    message: string,
    stepIndex?: number,
    rowIndex?: number
  ) => {
    const entry: ReplayLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      stepIndex,
      rowIndex,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  // ==========================================================================
  // CSV VALUE INJECTION
  // ==========================================================================

  /**
   * Build mapping lookup from field mappings
   */
  const mappingLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    opts.fieldMappings?.forEach(mapping => {
      if (mapping.mapped && mapping.inputvarfields) {
        lookup[mapping.field_name] = mapping.inputvarfields;
      }
    });
    return lookup;
  }, [opts.fieldMappings]);

  /**
   * Inject CSV value into step
   */
  const injectCsvValue = useCallback((
    step: ReplayStep,
    rowData: Record<string, string>
  ): ReplayStep => {
    if (!rowData || Object.keys(rowData).length === 0) {
      return step;
    }

    // Find CSV key that maps to this step's label
    for (const [csvKey, stepLabel] of Object.entries(mappingLookup)) {
      if (stepLabel === step.label && rowData[csvKey] !== undefined) {
        return { ...step, value: rowData[csvKey] };
      }
    }

    // Direct label match
    if (step.label && rowData[step.label] !== undefined) {
      return { ...step, value: rowData[step.label] };
    }

    return step;
  }, [mappingLookup]);

  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================

  /**
   * Execute a single step
   */
  const executeStep = useCallback(async (
    stepIndex: number,
    rowData?: Record<string, string>
  ): Promise<StepResult> => {
    const step = opts.steps[stepIndex];
    if (!step) {
      return {
        stepIndex,
        stepId: '',
        rowIndex: currentRow,
        status: 'failed',
        duration: 0,
        errorMessage: 'Step not found',
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();

    // Inject CSV value if provided
    const stepWithValue = rowData ? injectCsvValue(step, rowData) : step;

    // Update current step
    setCurrentStep(stepIndex);

    // Check if we should skip "open" events (they're navigation, not actions)
    if (stepWithValue.eventType === 'open') {
      const result: StepResult = {
        stepIndex,
        stepId: step.id,
        rowIndex: currentRow,
        status: 'passed',
        duration: 0,
        timestamp: Date.now(),
      };
      
      setStepResults(prev => [...prev, result]);
      setPassedSteps(prev => prev + 1);
      addLogInternal('success', `✓ Step ${stepIndex + 1}: Open (auto-pass)`, stepIndex, currentRow);
      
      return result;
    }

    // Execute via content script
    const tabs = chromeTabsRef.current;
    if (!tabs || !tabId) {
      const result: StepResult = {
        stepIndex,
        stepId: step.id,
        rowIndex: currentRow,
        status: 'failed',
        duration: Date.now() - startTime,
        errorMessage: 'Tab not available',
        timestamp: Date.now(),
      };
      
      setStepResults(prev => [...prev, result]);
      setFailedSteps(prev => prev + 1);
      addLogInternal('error', `✗ Step ${stepIndex + 1}: Tab not available`, stepIndex, currentRow);
      
      return result;
    }

    try {
      addLogInternal('info', `Running step ${stepIndex + 1}: ${stepWithValue.eventType} "${stepWithValue.label || stepWithValue.xpath}"`, stepIndex, currentRow);

      const success = await new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve(false);
        }, opts.stepTimeout);

        tabs.sendMessage(tabId, {
          type: 'runStep',
          data: {
            event: stepWithValue.eventType,
            path: stepWithValue.xpath,
            value: stepWithValue.value,
            label: stepWithValue.label,
            x: stepWithValue.x,
            y: stepWithValue.y,
            bundle: stepWithValue.bundle,
          },
        }, (response: unknown) => {
          clearTimeout(timeoutId);
          resolve(response === true || (response as { success?: boolean })?.success === true);
        });
      });

      const duration = Date.now() - startTime;
      const result: StepResult = {
        stepIndex,
        stepId: step.id,
        rowIndex: currentRow,
        status: success ? 'passed' : 'failed',
        duration,
        errorMessage: success ? undefined : 'Step execution failed',
        timestamp: Date.now(),
      };

      setStepResults(prev => [...prev, result]);
      
      if (success) {
        setPassedSteps(prev => prev + 1);
        addLogInternal('success', `✓ Step ${stepIndex + 1} completed in ${duration}ms`, stepIndex, currentRow);
      } else {
        setFailedSteps(prev => prev + 1);
        addLogInternal('error', `✗ Step ${stepIndex + 1} failed`, stepIndex, currentRow);
      }

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      const result: StepResult = {
        stepIndex,
        stepId: step.id,
        rowIndex: currentRow,
        status: 'failed',
        duration,
        errorMessage,
        timestamp: Date.now(),
      };

      setStepResults(prev => [...prev, result]);
      setFailedSteps(prev => prev + 1);
      addLogInternal('error', `✗ Step ${stepIndex + 1}: ${errorMessage}`, stepIndex, currentRow);

      return result;
    }
  }, [opts.steps, opts.stepTimeout, tabId, currentRow, injectCsvValue, addLogInternal]);

  /**
   * Skip a step
   */
  const skipStep = useCallback((stepIndex: number) => {
    const step = opts.steps[stepIndex];
    if (!step) return;

    const result: StepResult = {
      stepIndex,
      stepId: step.id,
      rowIndex: currentRow,
      status: 'skipped',
      duration: 0,
      timestamp: Date.now(),
    };

    setStepResults(prev => [...prev, result]);
    setSkippedSteps(prev => prev + 1);
    addLogInternal('warning', `⊘ Step ${stepIndex + 1} skipped`, stepIndex, currentRow);
  }, [opts.steps, currentRow, addLogInternal]);

  /**
   * Retry a failed step
   */
  const retryStep = useCallback(async (stepIndex: number): Promise<StepResult> => {
    const rowData = opts.csvData?.[currentRow];
    return executeStep(stepIndex, rowData);
  }, [executeStep, opts.csvData, currentRow]);

  // ==========================================================================
  // REPLAY CONTROL
  // ==========================================================================

  /**
   * Open tab and inject content script
   */
  const prepareTab = useCallback(async (): Promise<number | null> => {
    if (!opts.targetUrl) {
      setError('No target URL specified');
      return null;
    }

    const response = await new Promise<{ success: boolean; tabId?: number }>((resolve) => {
      storage.sendMessage<{ success: boolean; tabId?: number }>('openTab', {
        url: opts.targetUrl,
        inject: true,
      }).then(resolve);
    });

    if (response.success && response.tabId) {
      setTabIdState(response.tabId);
      return response.tabId;
    }

    return null;
  }, [storage.sendMessage, opts.targetUrl]);

  /**
   * Start replay execution
   */
  const startReplay = useCallback(async (): Promise<boolean> => {
    if (isRunningRef.current) return false;
    if (opts.steps.length === 0) {
      setError('No steps to execute');
      return false;
    }

    setStatus('preparing');
    setError(null);
    setStartedAt(new Date());
    setEndedAt(null);
    setStepResults([]);
    setRowResults([]);
    setPassedSteps(0);
    setFailedSteps(0);
    setSkippedSteps(0);
    setCurrentStep(0);
    setCurrentRow(0);

    addLogInternal('info', `Starting replay: ${opts.steps.length} steps, ${totalRows} row(s)`);

    // Open tab if needed
    let activeTabId = tabId;
    if (!activeTabId) {
      activeTabId = await prepareTab();
      if (!activeTabId) {
        setStatus('failed');
        setError('Failed to open tab');
        addLogInternal('error', 'Failed to open tab');
        return false;
      }
    }

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    isRunningRef.current = true;
    setStatus('running');

    // Execute rows
    const rowsToProcess = opts.csvData && opts.csvData.length > 0 
      ? opts.csvData 
      : [{}]; // Single empty row for no-CSV mode

    for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
      if (!isRunningRef.current) break;

      const rowData = rowsToProcess[rowIndex];
      setCurrentRow(rowIndex);
      
      if (opts.csvData && opts.csvData.length > 0) {
        addLogInternal('info', `Starting row ${rowIndex + 1} of ${rowsToProcess.length}`, undefined, rowIndex);
      }

      let rowPassedSteps = 0;
      let rowFailedSteps = 0;
      let rowSkippedSteps = 0;
      const rowStartTime = Date.now();

      // Execute steps
      for (let stepIndex = 0; stepIndex < opts.steps.length; stepIndex++) {
        // Check for pause
        while (isPausedRef.current && isRunningRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!isRunningRef.current) break;

        // Random delay for human-like behavior
        if (stepIndex > 0 && opts.stepDelay) {
          const delay = opts.stepDelay + Math.random() * opts.stepDelay;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await executeStep(stepIndex, rowData);

        if (result.status === 'passed') {
          rowPassedSteps++;
        } else if (result.status === 'failed') {
          rowFailedSteps++;
          
          if (opts.stopOnError) {
            addLogInternal('warning', 'Stopping on error (stopOnError=true)');
            isRunningRef.current = false;
            break;
          }
        } else if (result.status === 'skipped') {
          rowSkippedSteps++;
        }
      }

      // Record row result
      const rowResult: RowResult = {
        rowIndex,
        status: rowFailedSteps === 0 ? 'passed' : 'failed',
        passedSteps: rowPassedSteps,
        failedSteps: rowFailedSteps,
        skippedSteps: rowSkippedSteps,
        duration: Date.now() - rowStartTime,
      };

      setRowResults(prev => [...prev, rowResult]);

      if (opts.csvData && opts.csvData.length > 0) {
        addLogInternal(
          rowFailedSteps === 0 ? 'success' : 'warning',
          `Row ${rowIndex + 1} completed: ${rowPassedSteps} passed, ${rowFailedSteps} failed`,
          undefined,
          rowIndex
        );
      }
    }

    // Finalize
    isRunningRef.current = false;
    setEndedAt(new Date());

    const finalStatus = failedSteps > 0 || !isRunningRef.current ? 'completed' : 'completed';
    setStatus(finalStatus);
    
    addLogInternal(
      'info',
      `Replay ${finalStatus}: ${passedSteps} passed, ${failedSteps} failed, ${skippedSteps} skipped`
    );

    return true;
  }, [
    opts.steps, opts.csvData, opts.stepDelay, opts.stopOnError,
    tabId, totalRows, prepareTab, executeStep, addLogInternal,
    passedSteps, failedSteps, skippedSteps
  ]);

  /**
   * Stop replay
   */
  const stopReplay = useCallback(async (): Promise<void> => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setStatus('stopped');
    setEndedAt(new Date());
    addLogInternal('warning', 'Replay stopped by user');
  }, [addLogInternal]);

  /**
   * Pause replay
   */
  const pauseReplay = useCallback(() => {
    if (!isRunningRef.current) return;
    isPausedRef.current = true;
    setStatus('paused');
    addLogInternal('info', 'Replay paused');
  }, [addLogInternal]);

  /**
   * Resume replay
   */
  const resumeReplay = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setStatus('running');
    addLogInternal('info', 'Replay resumed');
  }, [addLogInternal]);

  /**
   * Reset replay state
   */
  const resetReplay = useCallback(() => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setStatus('idle');
    setStepResults([]);
    setRowResults([]);
    setLogs([]);
    setError(null);
    setStartedAt(null);
    setEndedAt(null);
    setCurrentStep(0);
    setCurrentRow(0);
    setPassedSteps(0);
    setFailedSteps(0);
    setSkippedSteps(0);
  }, []);

  // ==========================================================================
  // RESULTS
  // ==========================================================================

  /**
   * Get result for specific step
   */
  const getStepResult = useCallback((
    stepIndex: number,
    rowIndex?: number
  ): StepResult | undefined => {
    const targetRow = rowIndex ?? currentRow;
    return stepResults.find(
      r => r.stepIndex === stepIndex && r.rowIndex === targetRow
    );
  }, [stepResults, currentRow]);

  /**
   * Get result for specific row
   */
  const getRowResult = useCallback((rowIndex: number): RowResult | undefined => {
    return rowResults.find(r => r.rowIndex === rowIndex);
  }, [rowResults]);

  /**
   * Export results
   */
  const exportResults = useCallback((): ExportedResults => {
    return {
      projectId: opts.projectId,
      exportedAt: new Date().toISOString(),
      session,
      progress,
      stepResults,
      rowResults,
      logs,
    };
  }, [opts.projectId, session, progress, stepResults, rowResults, logs]);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  const addLog = useCallback((
    level: ReplayLog['level'],
    message: string,
    stepIndex?: number,
    rowIndex?: number
  ) => {
    addLogInternal(level, message, stepIndex, rowIndex);
  }, [addLogInternal]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const setTabId = useCallback((newTabId: number | null) => {
    setTabIdState(newTabId);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      isPausedRef.current = false;
    };
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // State
    status,
    isRunning,
    isPaused,
    progress,
    session,
    stepResults,
    rowResults,
    logs,
    error,
    
    // Control
    startReplay,
    stopReplay,
    pauseReplay,
    resumeReplay,
    resetReplay,
    
    // Step execution
    executeStep,
    skipStep,
    retryStep,
    
    // Logs
    addLog,
    clearLogs,
    
    // Results
    getStepResult,
    getRowResult,
    exportResults,
    
    // Utilities
    setTabId,
    clearError,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate pass rate percentage
 */
export function calculatePassRate(passed: number, failed: number): number {
  const total = passed + failed;
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: StepStatus | ReplayStatus): string {
  const colors: Record<string, string> = {
    pending: 'gray',
    running: 'blue',
    passed: 'green',
    completed: 'green',
    failed: 'red',
    skipped: 'yellow',
    stopped: 'orange',
    paused: 'purple',
    idle: 'gray',
    preparing: 'blue',
    stopping: 'orange',
  };
  return colors[status] ?? 'gray';
}
