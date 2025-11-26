# Result Collection System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Result Data Structures
3. Result Aggregation
4. Test Run Persistence
5. History Management
6. Statistics Calculation
7. Result Display
8. Export Functionality
9. Future Analytics

---

## 1. Overview

### 1.1 Purpose

The Result Collection System aggregates test execution outcomes, persists test run history to IndexedDB, calculates statistics, and provides data for result display and analysis. It enables users to review past test runs and track testing progress over time.

### 1.2 Result Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESULT COLLECTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EXECUTION                                                              │
│      │                                                                  │
│      │  Step results                                                    │
│      ▼                                                                  │
│  ┌─────────────────┐                                                    │
│  │  ROW RESULTS    │  Per-row aggregation                              │
│  │  { passed: 5,   │  ────────────────────                             │
│  │    failed: 1,   │  - Count passed/failed                            │
│  │    stepResults }│  - Collect step details                           │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           │  All rows complete                                          │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │  TEST RUN       │  Cross-row aggregation                            │
│  │  RESULT         │  ─────────────────────                            │
│  │  { total_steps, │  - Sum all pass/fail                              │
│  │    passed_steps,│  - Calculate duration                             │
│  │    failed_steps,│  - Determine status                               │
│  │    test_results,│  - Serialize logs                                 │
│  │    logs }       │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           │  Save to storage                                            │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │  INDEXEDDB      │  Persistence                                      │
│  │  testRuns table │  ─────────────                                    │
│  │                 │  - Assigned ID                                     │
│  │                 │  - Queryable history                               │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           │  Load history                                               │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │  UI DISPLAY     │  Presentation                                     │
│  │  - Results tab  │  ────────────                                     │
│  │  - History list │  - Summary view                                   │
│  │  - Statistics   │  - Detail drill-down                              │
│  └─────────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Result Data Structures

### 2.1 Step Result

```typescript
interface StepResult {
  stepNumber: number;        // 1-based step index
  rowIndex: number;          // 0-based CSV row index
  success: boolean;          // Pass/fail outcome
  duration: number;          // Execution time in ms
  value?: string;            // Injected CSV value (if any)
  error?: string;            // Error message (if failed)
  timestamp?: string;        // When step completed
  screenshot?: string;       // Base64 screenshot (future)
}
```

### 2.2 Row Result

```typescript
interface RowResult {
  rowIndex: number;          // 0-based row index
  passed: number;            // Steps passed in this row
  failed: number;            // Steps failed in this row
  skipped: number;           // Steps skipped (test stopped)
  stepResults: StepResult[]; // Individual step outcomes
  duration: number;          // Total row execution time
  csvData?: Record<string, string>; // Row data for reference
}
```

### 2.3 Test Run Result

```typescript
interface TestRunResult {
  id?: number;               // Assigned by IndexedDB
  project_id: number;        // Parent project reference
  status: TestRunStatus;     // Overall outcome
  start_time: string;        // ISO timestamp
  end_time?: string;         // ISO timestamp
  total_steps: number;       // Total steps executed
  passed_steps: number;      // Steps that passed
  failed_steps: number;      // Steps that failed
  test_results: StepResult[];// All step details
  logs: string;              // Serialized log entries
}

type TestRunStatus = 
  | 'pending'    // Not yet started
  | 'running'    // Currently executing
  | 'completed'  // All steps passed
  | 'failed'     // One or more failures
  | 'stopped'    // Manually stopped
  | 'cancelled'; // Aborted due to error
```

### 2.4 Test History Entry

```typescript
interface TestHistoryEntry {
  id: number;
  project_id: number;
  status: TestRunStatus;
  start_time: string;
  end_time: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  pass_rate: number;         // Calculated percentage
  duration: number;          // Calculated from timestamps
}
```

---

## 3. Result Aggregation

### 3.1 Row-Level Aggregation

```typescript
function aggregateRowResult(
  stepResults: StepResult[],
  rowIndex: number,
  csvRow?: Record<string, string>
): RowResult {
  const passed = stepResults.filter(s => s.success).length;
  const failed = stepResults.filter(s => !s.success && !s.error?.includes('skipped')).length;
  const skipped = stepResults.filter(s => s.error?.includes('skipped')).length;
  
  const duration = stepResults.reduce((sum, s) => sum + s.duration, 0);
  
  return {
    rowIndex,
    passed,
    failed,
    skipped,
    stepResults,
    duration,
    csvData: csvRow
  };
}
```

### 3.2 Test Run Aggregation

```typescript
function aggregateTestRunResult(
  rowResults: RowResult[],
  projectId: number,
  startTime: number,
  logs: LogEntry[],
  wasManualStop: boolean = false
): TestRunResult {
  // Flatten all step results
  const allStepResults = rowResults.flatMap(r => r.stepResults);
  
  // Calculate totals
  const totalPassed = rowResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = rowResults.reduce((sum, r) => sum + r.failed, 0);
  const totalSteps = totalPassed + totalFailed;
  
  // Determine status
  let status: TestRunStatus;
  if (wasManualStop) {
    status = 'stopped';
  } else if (totalFailed === 0 && totalPassed > 0) {
    status = 'completed';
  } else if (totalFailed > 0) {
    status = 'failed';
  } else {
    status = 'cancelled';
  }
  
  return {
    project_id: projectId,
    status,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date().toISOString(),
    total_steps: totalSteps,
    passed_steps: totalPassed,
    failed_steps: totalFailed,
    test_results: allStepResults,
    logs: JSON.stringify(logs)
  };
}
```

### 3.3 Incremental Aggregation

```typescript
// For real-time updates during execution
class ResultAggregator {
  private stepResults: StepResult[] = [];
  private rowResults: RowResult[] = [];
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }
  
  addStepResult(result: StepResult): void {
    this.stepResults.push(result);
  }
  
  finalizeRow(rowIndex: number, csvRow?: Record<string, string>): RowResult {
    // Get steps for this row
    const rowSteps = this.stepResults.filter(s => s.rowIndex === rowIndex);
    
    const rowResult = aggregateRowResult(rowSteps, rowIndex, csvRow);
    this.rowResults.push(rowResult);
    
    return rowResult;
  }
  
  getCurrentStats(): {
    totalPassed: number;
    totalFailed: number;
    completedRows: number;
  } {
    return {
      totalPassed: this.rowResults.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: this.rowResults.reduce((sum, r) => sum + r.failed, 0),
      completedRows: this.rowResults.length
    };
  }
  
  finalize(
    projectId: number,
    logs: LogEntry[],
    wasManualStop: boolean
  ): TestRunResult {
    return aggregateTestRunResult(
      this.rowResults,
      projectId,
      this.startTime,
      logs,
      wasManualStop
    );
  }
  
  reset(): void {
    this.stepResults = [];
    this.rowResults = [];
    this.startTime = Date.now();
  }
}
```

---

## 4. Test Run Persistence

### 4.1 Save Test Run

```typescript
async function saveTestRun(result: TestRunResult): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'createTestRun',
        payload: result
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.success && response.id) {
          resolve(response.id);
        } else {
          reject(new Error(response.error || 'Failed to save test run'));
        }
      }
    );
  });
}
```

### 4.2 Update Test Run

```typescript
async function updateTestRun(
  id: number,
  updates: Partial<TestRunResult>
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'updateTestRun',
        payload: { id, ...updates }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to update test run'));
        }
      }
    );
  });
}
```

### 4.3 Load Test Runs

```typescript
async function loadTestRunsByProject(projectId: number): Promise<TestRunResult[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'getTestRunsByProject',
        payload: { projectId }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.success) {
          resolve(response.data || []);
        } else {
          reject(new Error(response.error || 'Failed to load test runs'));
        }
      }
    );
  });
}
```

### 4.4 Delete Test Runs

```typescript
async function deleteTestRun(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'deleteTestRun',
        payload: { id }
      },
      (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to delete test run'));
        }
      }
    );
  });
}

async function deleteOldTestRuns(
  projectId: number,
  keepCount: number = 10
): Promise<number> {
  const runs = await loadTestRunsByProject(projectId);
  
  // Sort by start_time descending
  runs.sort((a, b) => 
    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );
  
  // Keep only the most recent
  const toDelete = runs.slice(keepCount);
  
  for (const run of toDelete) {
    if (run.id) {
      await deleteTestRun(run.id);
    }
  }
  
  return toDelete.length;
}
```

---

## 5. History Management

### 5.1 History State

```typescript
interface HistoryState {
  runs: TestHistoryEntry[];
  loading: boolean;
  error: string | null;
  selectedRunId: number | null;
}

function useTestHistory(projectId: number | null): HistoryState & {
  refresh: () => Promise<void>;
  selectRun: (id: number | null) => void;
  deleteRun: (id: number) => Promise<void>;
} {
  const [runs, setRuns] = useState<TestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  
  const refresh = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const rawRuns = await loadTestRunsByProject(projectId);
      
      // Transform to history entries
      const historyEntries: TestHistoryEntry[] = rawRuns.map(run => ({
        id: run.id!,
        project_id: run.project_id,
        status: run.status,
        start_time: run.start_time,
        end_time: run.end_time || run.start_time,
        total_steps: run.total_steps,
        passed_steps: run.passed_steps,
        failed_steps: run.failed_steps,
        pass_rate: run.total_steps > 0 
          ? (run.passed_steps / run.total_steps) * 100 
          : 0,
        duration: run.end_time 
          ? new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
          : 0
      }));
      
      // Sort by start_time descending
      historyEntries.sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
      
      setRuns(historyEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  const selectRun = useCallback((id: number | null) => {
    setSelectedRunId(id);
  }, []);
  
  const deleteRunHandler = useCallback(async (id: number) => {
    await deleteTestRun(id);
    await refresh();
  }, [refresh]);
  
  // Load on mount and when projectId changes
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return {
    runs,
    loading,
    error,
    selectedRunId,
    refresh,
    selectRun,
    deleteRun: deleteRunHandler
  };
}
```

### 5.2 History Filtering

```typescript
interface HistoryFilter {
  status?: TestRunStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  minPassRate?: number;
  maxPassRate?: number;
}

function filterHistory(
  runs: TestHistoryEntry[],
  filter: HistoryFilter
): TestHistoryEntry[] {
  return runs.filter(run => {
    // Status filter
    if (filter.status && !filter.status.includes(run.status)) {
      return false;
    }
    
    // Date range filter
    if (filter.dateRange) {
      const runDate = new Date(run.start_time);
      if (runDate < filter.dateRange.start || runDate > filter.dateRange.end) {
        return false;
      }
    }
    
    // Pass rate filter
    if (filter.minPassRate !== undefined && run.pass_rate < filter.minPassRate) {
      return false;
    }
    if (filter.maxPassRate !== undefined && run.pass_rate > filter.maxPassRate) {
      return false;
    }
    
    return true;
  });
}
```

### 5.3 History Comparison

```typescript
interface RunComparison {
  run1: TestHistoryEntry;
  run2: TestHistoryEntry;
  passRateDiff: number;
  durationDiff: number;
  stepChanges: {
    improved: number;    // Failed → Passed
    regressed: number;   // Passed → Failed
    unchanged: number;
  };
}

async function compareRuns(
  runId1: number,
  runId2: number
): Promise<RunComparison | null> {
  // Load full run details
  const [run1Details, run2Details] = await Promise.all([
    loadTestRunDetails(runId1),
    loadTestRunDetails(runId2)
  ]);
  
  if (!run1Details || !run2Details) return null;
  
  // Compare step results
  let improved = 0;
  let regressed = 0;
  let unchanged = 0;
  
  const maxSteps = Math.max(
    run1Details.test_results.length,
    run2Details.test_results.length
  );
  
  for (let i = 0; i < maxSteps; i++) {
    const step1 = run1Details.test_results[i];
    const step2 = run2Details.test_results[i];
    
    if (!step1 || !step2) continue;
    
    if (step1.success === step2.success) {
      unchanged++;
    } else if (!step1.success && step2.success) {
      improved++;
    } else {
      regressed++;
    }
  }
  
  const run1Entry = transformToHistoryEntry(run1Details);
  const run2Entry = transformToHistoryEntry(run2Details);
  
  return {
    run1: run1Entry,
    run2: run2Entry,
    passRateDiff: run2Entry.pass_rate - run1Entry.pass_rate,
    durationDiff: run2Entry.duration - run1Entry.duration,
    stepChanges: { improved, regressed, unchanged }
  };
}
```

---

## 6. Statistics Calculation

### 6.1 Single Run Statistics

```typescript
interface RunStatistics {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  passRate: number;
  totalDuration: number;
  avgStepDuration: number;
  minStepDuration: number;
  maxStepDuration: number;
  slowestStep: { index: number; duration: number; label: string } | null;
  fastestStep: { index: number; duration: number; label: string } | null;
  failedStepIndices: number[];
}

function calculateRunStatistics(
  result: TestRunResult,
  steps: RecordedStep[]
): RunStatistics {
  const stepResults = result.test_results;
  
  const durations = stepResults
    .filter(s => s.duration > 0)
    .map(s => s.duration);
  
  const sortedDurations = [...durations].sort((a, b) => a - b);
  
  // Find slowest and fastest
  let slowestStep = null;
  let fastestStep = null;
  
  if (stepResults.length > 0) {
    const slowestResult = stepResults.reduce((max, s) => 
      s.duration > max.duration ? s : max
    );
    const fastestResult = stepResults.reduce((min, s) => 
      s.duration > 0 && s.duration < min.duration ? s : min
    , stepResults.find(s => s.duration > 0) || stepResults[0]);
    
    slowestStep = {
      index: slowestResult.stepNumber,
      duration: slowestResult.duration,
      label: steps[slowestResult.stepNumber - 1]?.label || 'Unknown'
    };
    
    fastestStep = {
      index: fastestResult.stepNumber,
      duration: fastestResult.duration,
      label: steps[fastestResult.stepNumber - 1]?.label || 'Unknown'
    };
  }
  
  // Find failed step indices
  const failedStepIndices = stepResults
    .filter(s => !s.success)
    .map(s => s.stepNumber);
  
  return {
    totalSteps: result.total_steps,
    passedSteps: result.passed_steps,
    failedSteps: result.failed_steps,
    skippedSteps: stepResults.filter(s => s.error?.includes('skipped')).length,
    passRate: result.total_steps > 0 
      ? (result.passed_steps / result.total_steps) * 100 
      : 0,
    totalDuration: result.end_time 
      ? new Date(result.end_time).getTime() - new Date(result.start_time).getTime()
      : 0,
    avgStepDuration: durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0,
    minStepDuration: sortedDurations[0] || 0,
    maxStepDuration: sortedDurations[sortedDurations.length - 1] || 0,
    slowestStep,
    fastestStep,
    failedStepIndices
  };
}
```

### 6.2 Project-Wide Statistics

```typescript
interface ProjectStatistics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  stoppedRuns: number;
  overallPassRate: number;
  avgPassRate: number;
  avgDuration: number;
  totalDuration: number;
  trend: 'improving' | 'declining' | 'stable';
  recentRuns: TestHistoryEntry[];
}

function calculateProjectStatistics(
  runs: TestHistoryEntry[]
): ProjectStatistics {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      stoppedRuns: 0,
      overallPassRate: 0,
      avgPassRate: 0,
      avgDuration: 0,
      totalDuration: 0,
      trend: 'stable',
      recentRuns: []
    };
  }
  
  const successfulRuns = runs.filter(r => r.status === 'completed').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const stoppedRuns = runs.filter(r => r.status === 'stopped').length;
  
  const totalSteps = runs.reduce((sum, r) => sum + r.total_steps, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.passed_steps, 0);
  const overallPassRate = totalSteps > 0 ? (totalPassed / totalSteps) * 100 : 0;
  
  const avgPassRate = runs.reduce((sum, r) => sum + r.pass_rate, 0) / runs.length;
  const totalDuration = runs.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = totalDuration / runs.length;
  
  // Calculate trend (compare last 5 runs to previous 5)
  const sortedRuns = [...runs].sort((a, b) => 
    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );
  
  const recentRuns = sortedRuns.slice(0, 5);
  const olderRuns = sortedRuns.slice(5, 10);
  
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  
  if (recentRuns.length >= 3 && olderRuns.length >= 3) {
    const recentAvg = recentRuns.reduce((sum, r) => sum + r.pass_rate, 0) / recentRuns.length;
    const olderAvg = olderRuns.reduce((sum, r) => sum + r.pass_rate, 0) / olderRuns.length;
    
    if (recentAvg > olderAvg + 5) {
      trend = 'improving';
    } else if (recentAvg < olderAvg - 5) {
      trend = 'declining';
    }
  }
  
  return {
    totalRuns: runs.length,
    successfulRuns,
    failedRuns,
    stoppedRuns,
    overallPassRate,
    avgPassRate,
    avgDuration,
    totalDuration,
    trend,
    recentRuns
  };
}
```

### 6.3 Step-Level Statistics

```typescript
interface StepStatistics {
  stepNumber: number;
  label: string;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  commonErrors: Array<{ error: string; count: number }>;
}

function calculateStepStatistics(
  runs: TestRunResult[],
  steps: RecordedStep[]
): StepStatistics[] {
  const stepStats: Map<number, {
    successes: number;
    failures: number;
    durations: number[];
    errors: string[];
  }> = new Map();
  
  // Initialize for all steps
  steps.forEach((_, index) => {
    stepStats.set(index + 1, {
      successes: 0,
      failures: 0,
      durations: [],
      errors: []
    });
  });
  
  // Aggregate across all runs
  for (const run of runs) {
    for (const result of run.test_results) {
      const stats = stepStats.get(result.stepNumber);
      if (!stats) continue;
      
      if (result.success) {
        stats.successes++;
      } else {
        stats.failures++;
        if (result.error) {
          stats.errors.push(result.error);
        }
      }
      
      if (result.duration > 0) {
        stats.durations.push(result.duration);
      }
    }
  }
  
  // Convert to output format
  return steps.map((step, index) => {
    const stats = stepStats.get(index + 1)!;
    const total = stats.successes + stats.failures;
    
    // Count error occurrences
    const errorCounts = new Map<string, number>();
    for (const error of stats.errors) {
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    }
    
    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    return {
      stepNumber: index + 1,
      label: step.label,
      successCount: stats.successes,
      failureCount: stats.failures,
      successRate: total > 0 ? (stats.successes / total) * 100 : 0,
      avgDuration: stats.durations.length > 0
        ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        : 0,
      commonErrors
    };
  });
}
```

---

## 7. Result Display

### 7.1 Results Summary Component

```typescript
interface ResultsSummaryProps {
  result: TestRunResult | null;
  steps: RecordedStep[];
}

function ResultsSummary({ result, steps }: ResultsSummaryProps) {
  if (!result) {
    return (
      <div className="text-center text-gray-500 py-8">
        No test results yet. Run a test to see results.
      </div>
    );
  }
  
  const stats = calculateRunStatistics(result, steps);
  
  const statusConfig = {
    completed: { label: 'Passed', color: 'green', icon: '✓' },
    failed: { label: 'Failed', color: 'red', icon: '✗' },
    stopped: { label: 'Stopped', color: 'yellow', icon: '⚠' },
    cancelled: { label: 'Cancelled', color: 'gray', icon: '○' },
    pending: { label: 'Pending', color: 'gray', icon: '○' },
    running: { label: 'Running', color: 'blue', icon: '◉' }
  }[result.status];
  
  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`
        p-4 rounded-lg text-center
        bg-${statusConfig.color}-50 text-${statusConfig.color}-700
      `}>
        <span className="text-3xl mr-2">{statusConfig.icon}</span>
        <span className="text-2xl font-bold">{statusConfig.label}</span>
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pass Rate"
          value={`${stats.passRate.toFixed(1)}%`}
          color={stats.passRate >= 80 ? 'green' : stats.passRate >= 50 ? 'yellow' : 'red'}
        />
        <StatCard
          label="Passed"
          value={stats.passedSteps}
          color="green"
        />
        <StatCard
          label="Failed"
          value={stats.failedSteps}
          color={stats.failedSteps > 0 ? 'red' : 'gray'}
        />
        <StatCard
          label="Duration"
          value={formatDuration(stats.totalDuration)}
        />
      </div>
      
      {/* Failed steps */}
      {stats.failedStepIndices.length > 0 && (
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="font-semibold text-red-700 mb-2">Failed Steps</h3>
          <ul className="space-y-1">
            {stats.failedStepIndices.map(index => {
              const step = steps[index - 1];
              const stepResult = result.test_results.find(r => r.stepNumber === index);
              return (
                <li key={index} className="text-sm">
                  <span className="font-medium">Step {index}:</span>{' '}
                  {step?.label || 'Unknown'}{' '}
                  {stepResult?.error && (
                    <span className="text-red-600">- {stepResult.error}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {/* Timing insights */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Timing</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Avg Step:</span>{' '}
            {stats.avgStepDuration.toFixed(0)}ms
          </div>
          <div>
            <span className="text-gray-500">Slowest:</span>{' '}
            {stats.slowestStep ? `${stats.slowestStep.duration}ms (Step ${stats.slowestStep.index})` : 'N/A'}
          </div>
          <div>
            <span className="text-gray-500">Fastest:</span>{' '}
            {stats.fastestStep ? `${stats.fastestStep.duration}ms` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 7.2 History List Component

```typescript
interface HistoryListProps {
  runs: TestHistoryEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

function HistoryList({ runs, selectedId, onSelect, onDelete }: HistoryListProps) {
  if (runs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No test history yet.
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {runs.map(run => (
        <HistoryItem
          key={run.id}
          run={run}
          isSelected={run.id === selectedId}
          onClick={() => onSelect(run.id)}
          onDelete={() => onDelete(run.id)}
        />
      ))}
    </div>
  );
}

function HistoryItem({ run, isSelected, onClick, onDelete }: {
  run: TestHistoryEntry;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusIcon = {
    completed: '✓',
    failed: '✗',
    stopped: '⚠',
    cancelled: '○',
    pending: '○',
    running: '◉'
  }[run.status];
  
  const statusColor = {
    completed: 'text-green-500',
    failed: 'text-red-500',
    stopped: 'text-yellow-500',
    cancelled: 'text-gray-500',
    pending: 'text-gray-500',
    running: 'text-blue-500'
  }[run.status];
  
  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50 hover:bg-gray-100'}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={statusColor}>{statusIcon}</span>
          <span className="font-medium">
            {format(new Date(run.start_time), 'MMM d, yyyy HH:mm')}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-400 hover:text-red-500"
          title="Delete"
        >
          🗑
        </button>
      </div>
      
      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
        <span>{run.passed_steps}/{run.total_steps} passed</span>
        <span>{run.pass_rate.toFixed(0)}%</span>
        <span>{formatDuration(run.duration)}</span>
      </div>
    </div>
  );
}
```

### 7.3 Step Results Detail Component

```typescript
interface StepResultsDetailProps {
  result: TestRunResult;
  steps: RecordedStep[];
}

function StepResultsDetail({ result, steps }: StepResultsDetailProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const stepResult = result.test_results.find(r => r.stepNumber === index + 1);
        
        return (
          <div
            key={index}
            className={`
              p-3 rounded border
              ${stepResult?.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={stepResult?.success ? 'text-green-500' : 'text-red-500'}>
                  {stepResult?.success ? '✓' : '✗'}
                </span>
                <span className="font-medium">Step {index + 1}</span>
                <span className="text-gray-600">{step.label}</span>
              </div>
              {stepResult?.duration && (
                <span className="text-sm text-gray-500">
                  {stepResult.duration}ms
                </span>
              )}
            </div>
            
            {stepResult?.value && (
              <div className="mt-1 text-sm text-gray-600">
                Value: "{stepResult.value}"
              </div>
            )}
            
            {stepResult?.error && (
              <div className="mt-1 text-sm text-red-600">
                Error: {stepResult.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 8. Export Functionality

### 8.1 Export Formats

```typescript
type ExportFormat = 'json' | 'csv' | 'html';

interface ExportOptions {
  format: ExportFormat;
  includeStepDetails: boolean;
  includeLogs: boolean;
  includeTimestamps: boolean;
}

function exportTestRun(
  result: TestRunResult,
  steps: RecordedStep[],
  options: ExportOptions
): string {
  switch (options.format) {
    case 'json':
      return exportAsJSON(result, steps, options);
    case 'csv':
      return exportAsCSV(result, steps, options);
    case 'html':
      return exportAsHTML(result, steps, options);
  }
}
```

### 8.2 JSON Export

```typescript
function exportAsJSON(
  result: TestRunResult,
  steps: RecordedStep[],
  options: ExportOptions
): string {
  const exportData: any = {
    summary: {
      status: result.status,
      startTime: result.start_time,
      endTime: result.end_time,
      totalSteps: result.total_steps,
      passedSteps: result.passed_steps,
      failedSteps: result.failed_steps,
      passRate: result.total_steps > 0 
        ? (result.passed_steps / result.total_steps) * 100 
        : 0
    }
  };
  
  if (options.includeStepDetails) {
    exportData.steps = result.test_results.map((r, index) => ({
      stepNumber: r.stepNumber,
      label: steps[r.stepNumber - 1]?.label || 'Unknown',
      success: r.success,
      duration: r.duration,
      value: r.value,
      error: r.error,
      ...(options.includeTimestamps && { timestamp: r.timestamp })
    }));
  }
  
  if (options.includeLogs) {
    try {
      exportData.logs = JSON.parse(result.logs);
    } catch {
      exportData.logs = [];
    }
  }
  
  return JSON.stringify(exportData, null, 2);
}
```

### 8.3 CSV Export

```typescript
function exportAsCSV(
  result: TestRunResult,
  steps: RecordedStep[],
  options: ExportOptions
): string {
  const headers = ['Step Number', 'Label', 'Status', 'Duration (ms)'];
  
  if (options.includeStepDetails) {
    headers.push('Value', 'Error');
  }
  
  if (options.includeTimestamps) {
    headers.push('Timestamp');
  }
  
  const rows = result.test_results.map(r => {
    const row = [
      r.stepNumber.toString(),
      steps[r.stepNumber - 1]?.label || 'Unknown',
      r.success ? 'Passed' : 'Failed',
      r.duration.toString()
    ];
    
    if (options.includeStepDetails) {
      row.push(r.value || '', r.error || '');
    }
    
    if (options.includeTimestamps) {
      row.push(r.timestamp || '');
    }
    
    return row;
  });
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return csvContent;
}
```

### 8.4 HTML Report Export

```typescript
function exportAsHTML(
  result: TestRunResult,
  steps: RecordedStep[],
  options: ExportOptions
): string {
  const stats = calculateRunStatistics(result, steps);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${new Date(result.start_time).toLocaleString()}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .status-passed { color: #22c55e; }
    .status-failed { color: #ef4444; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .stat { background: #f3f4f6; padding: 10px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .steps { margin-top: 20px; }
    .step { padding: 10px; margin: 5px 0; border-radius: 4px; }
    .step-passed { background: #f0fdf4; border-left: 4px solid #22c55e; }
    .step-failed { background: #fef2f2; border-left: 4px solid #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Report</h1>
    <p>${new Date(result.start_time).toLocaleString()}</p>
    <h2 class="status-${result.status === 'completed' ? 'passed' : 'failed'}">
      ${result.status.toUpperCase()}
    </h2>
  </div>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${stats.passRate.toFixed(1)}%</div>
      <div>Pass Rate</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats.passedSteps}</div>
      <div>Passed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats.failedSteps}</div>
      <div>Failed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${formatDuration(stats.totalDuration)}</div>
      <div>Duration</div>
    </div>
  </div>
  
  ${options.includeStepDetails ? `
  <div class="steps">
    <h3>Step Details</h3>
    ${result.test_results.map(r => `
      <div class="step step-${r.success ? 'passed' : 'failed'}">
        <strong>Step ${r.stepNumber}:</strong> ${steps[r.stepNumber - 1]?.label || 'Unknown'}
        <span style="float: right">${r.duration}ms</span>
        ${r.error ? `<div style="color: #ef4444; font-size: 14px">Error: ${r.error}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>
  `.trim();
}
```

### 8.5 Download Helper

```typescript
function downloadExport(
  content: string,
  filename: string,
  format: ExportFormat
): void {
  const mimeTypes = {
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html'
  };
  
  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${format}`;
  link.click();
  
  URL.revokeObjectURL(url);
}

// Usage
function handleExport(result: TestRunResult, steps: RecordedStep[], format: ExportFormat) {
  const content = exportTestRun(result, steps, {
    format,
    includeStepDetails: true,
    includeLogs: format === 'json',
    includeTimestamps: true
  });
  
  const timestamp = format(new Date(result.start_time), 'yyyy-MM-dd_HHmmss');
  downloadExport(content, `test-report_${timestamp}`, format);
}
```

---

## 9. Future Analytics

### 9.1 Trend Analysis

```typescript
interface TrendData {
  date: string;
  passRate: number;
  avgDuration: number;
  totalRuns: number;
}

function calculateTrends(
  runs: TestHistoryEntry[],
  groupBy: 'day' | 'week' | 'month' = 'day'
): TrendData[] {
  // Group runs by date
  const grouped = new Map<string, TestHistoryEntry[]>();
  
  for (const run of runs) {
    const date = new Date(run.start_time);
    let key: string;
    
    switch (groupBy) {
      case 'day':
        key = format(date, 'yyyy-MM-dd');
        break;
      case 'week':
        key = format(startOfWeek(date), 'yyyy-MM-dd');
        break;
      case 'month':
        key = format(date, 'yyyy-MM');
        break;
    }
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(run);
  }
  
  // Calculate stats for each group
  return Array.from(grouped.entries())
    .map(([date, groupRuns]) => ({
      date,
      passRate: groupRuns.reduce((sum, r) => sum + r.pass_rate, 0) / groupRuns.length,
      avgDuration: groupRuns.reduce((sum, r) => sum + r.duration, 0) / groupRuns.length,
      totalRuns: groupRuns.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

### 9.2 Failure Heatmap

```typescript
interface FailureHeatmapData {
  stepNumber: number;
  label: string;
  failureRate: number;
  totalFailures: number;
  recentTrend: 'improving' | 'worsening' | 'stable';
}

function calculateFailureHeatmap(
  runs: TestRunResult[],
  steps: RecordedStep[]
): FailureHeatmapData[] {
  // ... implementation similar to calculateStepStatistics
  // with additional trend calculation
}
```

### 9.3 Performance Insights

```typescript
interface PerformanceInsight {
  type: 'slow_step' | 'flaky_step' | 'consistent_failure' | 'improving';
  stepNumber?: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

function generatePerformanceInsights(
  runs: TestRunResult[],
  steps: RecordedStep[]
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  const stepStats = calculateStepStatistics(runs, steps);
  
  for (const stat of stepStats) {
    // Slow step detection
    if (stat.avgDuration > 5000) {
      insights.push({
        type: 'slow_step',
        stepNumber: stat.stepNumber,
        message: `Step ${stat.stepNumber} (${stat.label}) averages ${(stat.avgDuration / 1000).toFixed(1)}s`,
        severity: stat.avgDuration > 10000 ? 'warning' : 'info'
      });
    }
    
    // Flaky step detection (fails sometimes but not always)
    if (stat.successRate > 20 && stat.successRate < 80) {
      insights.push({
        type: 'flaky_step',
        stepNumber: stat.stepNumber,
        message: `Step ${stat.stepNumber} (${stat.label}) is flaky with ${stat.successRate.toFixed(0)}% success rate`,
        severity: 'warning'
      });
    }
    
    // Consistent failure
    if (stat.successRate < 20 && stat.failureCount >= 3) {
      insights.push({
        type: 'consistent_failure',
        stepNumber: stat.stepNumber,
        message: `Step ${stat.stepNumber} (${stat.label}) consistently fails`,
        severity: 'critical'
      });
    }
  }
  
  return insights;
}
```

---

## Summary

The Result Collection System provides:

✅ Result data structures for steps, rows, and test runs  
✅ Result aggregation at row and test level  
✅ Incremental aggregation during execution  
✅ Test run persistence via message-based storage  
✅ History management with filtering and comparison  
✅ Statistics calculation at multiple levels  
✅ Result display components (summary, history, details)  
✅ Export functionality (JSON, CSV, HTML formats)  
✅ Future analytics (trends, heatmaps, insights)  

This system enables comprehensive result tracking and analysis for test executions.
