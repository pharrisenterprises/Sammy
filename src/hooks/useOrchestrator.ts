/**
 * useOrchestrator - React hook for test orchestration
 * @module hooks/useOrchestrator
 * @version 1.0.0
 * 
 * Provides unified test execution interface:
 * - Coordinates replay, test runs, and CSV processing
 * - Tab management and script injection
 * - Multi-row CSV iteration
 * - Progress tracking and result persistence
 * - Lifecycle management (start, stop, pause, reset)
 * 
 * @example
 * ```tsx
 * const { 
 *   runTest,
 *   stopTest,
 *   progress,
 *   testStatus,
 *   logs 
 * } = useOrchestrator({ project });
 * ```
 * 
 * @see test-orchestrator_breakdown.md for orchestration patterns
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useStorage, type UseStorageOptions } from './useStorage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Test status
 */
export type TestStatus = 
  | 'idle' 
  | 'preparing' 
  | 'running' 
  | 'paused' 
  | 'stopping' 
  | 'completed' 
  | 'failed' 
  | 'stopped';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Project data
 */
export interface Project {
  id: number;
  name: string;
  target_url: string;
  recorded_steps: RecordedStep[];
  parsed_fields: FieldMapping[];
  csv_data: CsvRow[];
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
  x?: number;
  y?: number;
  bundle: Record<string, unknown>;
}

/**
 * Field mapping
 */
export interface FieldMapping {
  field_name: string;
  mapped: boolean;
  inputvarfields: string;
}

/**
 * CSV row
 */
export type CsvRow = Record<string, string>;

/**
 * Test step (with status)
 */
export interface TestStep extends RecordedStep {
  status: StepStatus;
  duration?: number;
  errorMessage?: string;
}

/**
 * Log entry
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  stepIndex?: number;
  rowIndex?: number;
}

/**
 * Progress info
 */
export interface OrchestratorProgress {
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
 * Test result
 */
export interface TestResult {
  stepIndex: number;
  rowIndex: number;
  status: StepStatus;
  duration: number;
  errorMessage?: string;
  timestamp: number;
}

/**
 * Row result
 */
export interface RowResult {
  rowIndex: number;
  status: 'passed' | 'failed' | 'skipped';
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
}

/**
 * Test run summary
 */
export interface TestRunSummary {
  id?: number;
  projectId: number;
  status: TestStatus;
  startTime: Date | null;
  endTime: Date | null;
  duration: number;
  totalRows: number;
  completedRows: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  passRate: number;
}

/**
 * Chrome runtime interface
 */
export interface IChromeRuntime {
  sendMessage<T = unknown>(
    message: unknown,
    callback?: (response: T) => void
  ): void;
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
 * Orchestrator options
 */
export interface UseOrchestratorOptions extends UseStorageOptions {
  project: Project;
  stepDelay?: number;
  stepTimeout?: number;
  stopOnError?: boolean;
  saveResults?: boolean;
  onStepComplete?: (result: TestResult) => void;
  onRowComplete?: (result: RowResult) => void;
  onTestComplete?: (summary: TestRunSummary) => void;
}

/**
 * Default options
 */
export const DEFAULT_ORCHESTRATOR_OPTIONS: Partial<UseOrchestratorOptions> = {
  stepDelay: 1500,
  stepTimeout: 30000,
  stopOnError: false,
  saveResults: true,
};

/**
 * Hook return type
 */
export interface UseOrchestratorReturn {
  // State
  testStatus: TestStatus;
  isRunning: boolean;
  isPaused: boolean;
  progress: OrchestratorProgress;
  testSteps: TestStep[];
  logs: LogEntry[];
  results: TestResult[];
  rowResults: RowResult[];
  summary: TestRunSummary | null;
  tabId: number | null;
  error: string | null;
  
  // Control
  runTest: () => Promise<void>;
  stopTest: () => void;
  pauseTest: () => void;
  resumeTest: () => void;
  resetTest: () => void;
  
  // Tab management
  openTab: (url: string) => Promise<number | null>;
  closeTab: () => Promise<void>;
  injectScript: (tabId: number) => Promise<boolean>;
  
  // Utilities
  addLog: (level: LogEntry['level'], message: string, stepIndex?: number, rowIndex?: number) => void;
  clearLogs: () => void;
  updateStepStatus: (index: number, status: StepStatus, duration?: number, errorMessage?: string) => void;
  exportResults: () => ExportedTestResults;
  clearError: () => void;
}

/**
 * Exported test results
 */
export interface ExportedTestResults {
  projectId: number;
  projectName: string;
  exportedAt: string;
  summary: TestRunSummary | null;
  results: TestResult[];
  rowResults: RowResult[];
  logs: LogEntry[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useOrchestrator - Hook for test orchestration
 */
export function useOrchestrator(options: UseOrchestratorOptions): UseOrchestratorReturn {
  const opts = { ...DEFAULT_ORCHESTRATOR_OPTIONS, ...options };
  const { project } = opts;
  
  // Storage hook
  const storage = useStorage(options);
  
  // State
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [rowResults, setRowResults] = useState<RowResult[]>([]);
  const [tabId, setTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRow, setCurrentRow] = useState(0);
  const [passedSteps, setPassedSteps] = useState(0);
  const [failedSteps, setFailedSteps] = useState(0);
  const [skippedSteps, setSkippedSteps] = useState(0);
  const [testRunId, setTestRunId] = useState<number | null>(null);
  
  // Refs for immediate access
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const chromeRuntimeRef = useRef<IChromeRuntime | null>(
    typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime as IChromeRuntime : null
  );
  const chromeTabsRef = useRef<IChromeTabs | null>(
    typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs as IChromeTabs : null
  );
  const callbacksRef = useRef({
    onStepComplete: opts.onStepComplete,
    onRowComplete: opts.onRowComplete,
    onTestComplete: opts.onTestComplete,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onStepComplete: opts.onStepComplete,
      onRowComplete: opts.onRowComplete,
      onTestComplete: opts.onTestComplete,
    };
  }, [opts.onStepComplete, opts.onRowComplete, opts.onTestComplete]);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  const isRunning = testStatus === 'running';
  const isPaused = testStatus === 'paused';

  const totalRows = Math.max(project.csv_data?.length ?? 0, 1);
  const totalSteps = project.recorded_steps.length;
  const totalExecutions = totalSteps * totalRows;

  /**
   * Build mapping lookup for CSV injection
   */
  const mappingLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    project.parsed_fields?.forEach(mapping => {
      if (mapping.mapped && mapping.inputvarfields) {
        lookup[mapping.field_name] = mapping.inputvarfields;
      }
    });
    return lookup;
  }, [project.parsed_fields]);

  /**
   * Progress calculation
   */
  const progress = useMemo((): OrchestratorProgress => {
    const completed = passedSteps + failedSteps + skippedSteps;
    const percentage = totalExecutions > 0 ? (completed / totalExecutions) * 100 : 0;
    
    const elapsedTime = startTime ? Date.now() - startTime.getTime() : 0;
    const stepsPerMs = completed > 0 ? elapsedTime / completed : 0;
    const remainingSteps = totalExecutions - completed;
    const estimatedRemaining = stepsPerMs * remainingSteps;

    return {
      percentage,
      currentStep,
      totalSteps,
      currentRow,
      totalRows,
      passedSteps,
      failedSteps,
      skippedSteps,
      elapsedTime,
      estimatedRemaining,
    };
  }, [currentStep, currentRow, totalSteps, totalRows, passedSteps, failedSteps, skippedSteps, totalExecutions, startTime]);

  /**
   * Summary calculation
   */
  const summary = useMemo((): TestRunSummary | null => {
    if (testStatus === 'idle') return null;

    const duration = startTime 
      ? (endTime?.getTime() ?? Date.now()) - startTime.getTime()
      : 0;
    
    const total = passedSteps + failedSteps;
    const passRate = total > 0 ? (passedSteps / total) * 100 : 0;

    return {
      id: testRunId ?? undefined,
      projectId: project.id,
      status: testStatus,
      startTime,
      endTime,
      duration,
      totalRows,
      completedRows: rowResults.length,
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      passRate,
    };
  }, [testStatus, startTime, endTime, totalRows, totalSteps, passedSteps, failedSteps, skippedSteps, rowResults.length, testRunId, project.id]);

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  /**
   * Add log entry
   */
  const addLog = useCallback((
    level: LogEntry['level'],
    message: string,
    stepIndex?: number,
    rowIndex?: number
  ) => {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level,
      message,
      stepIndex,
      rowIndex,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  /**
   * Clear logs
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // ==========================================================================
  // STEP STATUS
  // ==========================================================================

  /**
   * Update step status
   */
  const updateStepStatus = useCallback((
    index: number,
    status: StepStatus,
    duration: number = 0,
    errorMessage?: string
  ) => {
    setTestSteps(prev => prev.map((step, i) =>
      i === index
        ? { ...step, status, duration, errorMessage }
        : step
    ));
  }, []);

  // ==========================================================================
  // TAB MANAGEMENT
  // ==========================================================================

  /**
   * Open tab
   */
  const openTab = useCallback(async (url: string): Promise<number | null> => {
    const runtime = chromeRuntimeRef.current;
    if (!runtime) {
      setError('Chrome runtime not available');
      return null;
    }

    return new Promise((resolve) => {
      runtime.sendMessage<{ success: boolean; tabId?: number }>(
        { action: 'openTab', url },
        (response) => {
          if (response?.success && response.tabId) {
            setTabId(response.tabId);
            resolve(response.tabId);
          } else {
            resolve(null);
          }
        }
      );
    });
  }, []);

  /**
   * Close tab
   */
  const closeTab = useCallback(async (): Promise<void> => {
    if (!tabId) return;

    const runtime = chromeRuntimeRef.current;
    if (!runtime) return;

    return new Promise((resolve) => {
      runtime.sendMessage({ action: 'closeTab', tabId }, () => {
        setTabId(null);
        resolve();
      });
    });
  }, [tabId]);

  /**
   * Inject content script
   */
  const injectScript = useCallback(async (targetTabId: number): Promise<boolean> => {
    const runtime = chromeRuntimeRef.current;
    if (!runtime) return false;

    return new Promise((resolve) => {
      runtime.sendMessage<{ success: boolean }>(
        { action: 'injectScript', tabId: targetTabId },
        (response) => {
          resolve(response?.success ?? false);
        }
      );
    });
  }, []);

  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================

  /**
   * Inject CSV value into step
   */
  const injectCsvValue = useCallback((
    step: RecordedStep,
    rowData: CsvRow
  ): RecordedStep => {
    if (!rowData || Object.keys(rowData).length === 0) {
      return step;
    }

    // Direct label match
    if (step.label && rowData[step.label] !== undefined) {
      return { ...step, value: rowData[step.label] };
    }

    // Mapped match via lookup
    for (const [csvKey, stepLabel] of Object.entries(mappingLookup)) {
      if (stepLabel === step.label && rowData[csvKey] !== undefined) {
        return { ...step, value: rowData[csvKey] };
      }
    }

    return step;
  }, [mappingLookup]);

  /**
   * Execute single step
   */
  const executeStep = useCallback(async (
    step: RecordedStep,
    stepIndex: number,
    rowIndex: number,
    rowData: CsvRow
  ): Promise<TestResult> => {
    const tabs = chromeTabsRef.current;
    const startMs = Date.now();

    // Inject CSV value
    const stepWithValue = injectCsvValue(step, rowData);

    // Update UI
    setCurrentStep(stepIndex);
    updateStepStatus(stepIndex, 'running');

    // Check for "open" events (auto-pass)
    if (stepWithValue.eventType === 'open') {
      const result: TestResult = {
        stepIndex,
        rowIndex,
        status: 'passed',
        duration: 0,
        timestamp: Date.now(),
      };
      updateStepStatus(stepIndex, 'passed', 0);
      setPassedSteps(prev => prev + 1);
      addLog('success', `✓ Step ${stepIndex + 1}: Open (auto-pass)`, stepIndex, rowIndex);
      
      // Call callback
      callbacksRef.current.onStepComplete?.(result);
      return result;
    }

    // Check tab availability
    if (!tabs || !tabId) {
      const result: TestResult = {
        stepIndex,
        rowIndex,
        status: 'failed',
        duration: Date.now() - startMs,
        errorMessage: 'Tab not available',
        timestamp: Date.now(),
      };
      updateStepStatus(stepIndex, 'failed', result.duration, result.errorMessage);
      setFailedSteps(prev => prev + 1);
      addLog('error', `✗ Step ${stepIndex + 1}: Tab not available`, stepIndex, rowIndex);
      
      // Call callback
      callbacksRef.current.onStepComplete?.(result);
      return result;
    }

    // Execute via content script
    try {
      addLog('info', `Running step ${stepIndex + 1}: ${stepWithValue.eventType} "${stepWithValue.label || stepWithValue.xpath}"`, stepIndex, rowIndex);

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

      const duration = Date.now() - startMs;
      const result: TestResult = {
        stepIndex,
        rowIndex,
        status: success ? 'passed' : 'failed',
        duration,
        errorMessage: success ? undefined : 'Step execution failed',
        timestamp: Date.now(),
      };

      updateStepStatus(stepIndex, result.status, duration, result.errorMessage);
      
      if (success) {
        setPassedSteps(prev => prev + 1);
        addLog('success', `✓ Step ${stepIndex + 1} completed (${duration}ms)`, stepIndex, rowIndex);
      } else {
        setFailedSteps(prev => prev + 1);
        addLog('error', `✗ Step ${stepIndex + 1} failed`, stepIndex, rowIndex);
      }

      callbacksRef.current.onStepComplete?.(result);
      return result;
    } catch (err) {
      const duration = Date.now() - startMs;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      const result: TestResult = {
        stepIndex,
        rowIndex,
        status: 'failed',
        duration,
        errorMessage,
        timestamp: Date.now(),
      };

      updateStepStatus(stepIndex, 'failed', duration, errorMessage);
      setFailedSteps(prev => prev + 1);
      addLog('error', `✗ Step ${stepIndex + 1}: ${errorMessage}`, stepIndex, rowIndex);

      callbacksRef.current.onStepComplete?.(result);
      return result;
    }
  }, [tabId, opts.stepTimeout, injectCsvValue, updateStepStatus, addLog]);

  // ==========================================================================
  // TEST EXECUTION
  // ==========================================================================

  /**
   * Run test
   */
  const runTest = useCallback(async (): Promise<void> => {
    if (isRunningRef.current) return;
    if (project.recorded_steps.length === 0) {
      setError('No steps to execute');
      return;
    }

    // Initialize state
    setTestStatus('preparing');
    setError(null);
    setStartTime(new Date());
    setEndTime(null);
    setResults([]);
    setRowResults([]);
    setPassedSteps(0);
    setFailedSteps(0);
    setSkippedSteps(0);
    setCurrentStep(0);
    setCurrentRow(0);

    // Initialize test steps
    const initialSteps: TestStep[] = project.recorded_steps.map(step => ({
      ...step,
      status: 'pending' as StepStatus,
    }));
    setTestSteps(initialSteps);

    addLog('info', `Starting test: ${project.name}`);
    addLog('info', `${totalSteps} steps, ${totalRows} row(s)`);

    // Create test run record
    if (opts.saveResults) {
      const createResponse = await storage.sendMessage<{ id: number }>('createTestRun', {
        project_id: project.id,
        total_steps: totalSteps,
        total_rows: totalRows,
      });
      if (createResponse.success && createResponse.data?.id) {
        setTestRunId(createResponse.data.id);
      }
    }

    // Open tab
    const targetTabId = await openTab(project.target_url);
    if (!targetTabId) {
      setTestStatus('failed');
      setError('Failed to open tab');
      addLog('error', 'Failed to open tab');
      return;
    }

    addLog('info', `Tab ${targetTabId} opened`);

    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start execution
    isRunningRef.current = true;
    setTestStatus('running');

    // Determine rows to process
    const rowsToProcess = project.csv_data && project.csv_data.length > 0
      ? project.csv_data
      : [{}]; // Single empty row for no-CSV mode

    // Execute rows
    for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
      if (!isRunningRef.current) break;

      const rowData = rowsToProcess[rowIndex];
      setCurrentRow(rowIndex);

      if (project.csv_data && project.csv_data.length > 0) {
        addLog('info', `Starting row ${rowIndex + 1} of ${rowsToProcess.length}`, undefined, rowIndex);
      }

      let rowPassedSteps = 0;
      let rowFailedSteps = 0;
      let rowSkippedSteps = 0;
      const rowStartTime = Date.now();

      // Reset step statuses for this row
      setTestSteps(prev => prev.map(step => ({ ...step, status: 'pending' as StepStatus })));

      // Execute steps
      for (let stepIndex = 0; stepIndex < project.recorded_steps.length; stepIndex++) {
        // Check for pause
        while (isPausedRef.current && isRunningRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!isRunningRef.current) break;

        // Random delay for human-like behavior
        if (stepIndex > 0 && opts.stepDelay) {
          const delay = opts.stepDelay + Math.random() * (opts.stepDelay * 0.5);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const step = project.recorded_steps[stepIndex];
        const result = await executeStep(step, stepIndex, rowIndex, rowData);

        setResults(prev => [...prev, result]);

        if (result.status === 'passed') {
          rowPassedSteps++;
        } else if (result.status === 'failed') {
          rowFailedSteps++;
          if (opts.stopOnError) {
            addLog('warning', 'Stopping on error (stopOnError=true)');
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
      callbacksRef.current.onRowComplete?.(rowResult);

      if (project.csv_data && project.csv_data.length > 0) {
        addLog(
          rowFailedSteps === 0 ? 'success' : 'warning',
          `Row ${rowIndex + 1} completed: ${rowPassedSteps} passed, ${rowFailedSteps} failed`,
          undefined,
          rowIndex
        );
      }
    }

    // Finalize
    const wasRunning = isRunningRef.current;
    isRunningRef.current = false;
    const finalEndTime = new Date();
    setEndTime(finalEndTime);

    const finalStatus: TestStatus = !wasRunning 
      ? 'stopped' 
      : failedSteps > 0 
        ? 'completed' 
        : 'completed';
    
    setTestStatus(finalStatus);

    addLog('info', `Test ${finalStatus}: ${passedSteps} passed, ${failedSteps} failed, ${skippedSteps} skipped`);

    // Save test run
    if (opts.saveResults && testRunId) {
      await storage.sendMessage('updateTestRun', {
        id: testRunId,
        status: finalStatus,
        end_time: finalEndTime.toISOString(),
        passed_steps: passedSteps,
        failed_steps: failedSteps,
        test_results: results,
      });
    }

    callbacksRef.current.onTestComplete?.(summary!);
  }, [
    project, totalSteps, totalRows, opts.saveResults, opts.stepDelay, opts.stopOnError, storage,
    openTab, executeStep, addLog, summary, passedSteps, failedSteps, skippedSteps, results, testRunId
  ]);

  /**
   * Stop test
   */
  const stopTest = useCallback(() => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setTestStatus('stopped');
    setEndTime(new Date());
    addLog('warning', 'Test stopped by user');
  }, [addLog]);

  /**
   * Pause test
   */
  const pauseTest = useCallback(() => {
    if (!isRunningRef.current) return;
    isPausedRef.current = true;
    setTestStatus('paused');
    addLog('info', 'Test paused');
  }, [addLog]);

  /**
   * Resume test
   */
  const resumeTest = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setTestStatus('running');
    addLog('info', 'Test resumed');
  }, [addLog]);

  /**
   * Reset test
   */
  const resetTest = useCallback(() => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setTestStatus('idle');
    setTestSteps([]);
    setLogs([]);
    setResults([]);
    setRowResults([]);
    setError(null);
    setStartTime(null);
    setEndTime(null);
    setCurrentStep(0);
    setCurrentRow(0);
    setPassedSteps(0);
    setFailedSteps(0);
    setSkippedSteps(0);
    setTestRunId(null);
    setTabId(null);
  }, []);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Export results
   */
  const exportResults = useCallback((): ExportedTestResults => {
    return {
      projectId: project.id,
      projectName: project.name,
      exportedAt: new Date().toISOString(),
      summary,
      results,
      rowResults,
      logs,
    };
  }, [project.id, project.name, summary, results, rowResults, logs]);

  /**
   * Clear error
   */
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
    testStatus,
    isRunning,
    isPaused,
    progress,
    testSteps,
    logs,
    results,
    rowResults,
    summary,
    tabId,
    error,
    
    // Control
    runTest,
    stopTest,
    pauseTest,
    resumeTest,
    resetTest,
    
    // Tab management
    openTab,
    closeTab,
    injectScript,
    
    // Utilities
    addLog,
    clearLogs,
    updateStepStatus,
    exportResults,
    clearError,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format test duration
 */
export function formatTestDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate pass rate
 */
export function calculatePassRate(passed: number, failed: number): number {
  const total = passed + failed;
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

/**
 * Get status badge color
 */
export function getStatusBadgeColor(status: TestStatus | StepStatus): string {
  const colors: Record<string, string> = {
    idle: 'gray',
    preparing: 'blue',
    running: 'blue',
    paused: 'purple',
    stopping: 'orange',
    completed: 'green',
    failed: 'red',
    stopped: 'orange',
    pending: 'gray',
    passed: 'green',
    skipped: 'yellow',
  };
  return colors[status] ?? 'gray';
}
