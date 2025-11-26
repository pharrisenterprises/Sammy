# Progress Tracking System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Progress Architecture
3. Step Status Tracking
4. Progress Calculation
5. Log System
6. UI Components
7. Real-Time Updates
8. Performance Considerations
9. Future Enhancements

---

## 1. Overview

### 1.1 Purpose

The Progress Tracking System provides real-time feedback during test execution, displaying step statuses, progress percentage, execution logs, and timing information. It enables users to monitor test progress and quickly identify failures.

### 1.2 Tracking Dimensions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROGRESS TRACKING DIMENSIONS                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DIMENSION 1: Step Status                                              │
│  ├── Individual step state (pending/running/passed/failed/skipped)     │
│  ├── Duration per step                                                 │
│  └── Error messages for failures                                       │
│                                                                         │
│  DIMENSION 2: Overall Progress                                         │
│  ├── Percentage complete (0-100%)                                      │
│  ├── Steps completed vs total                                          │
│  └── Rows completed vs total (for CSV)                                 │
│                                                                         │
│  DIMENSION 3: Execution Logs                                           │
│  ├── Timestamped log entries                                           │
│  ├── Log levels (info/success/error/warning)                           │
│  └── Detailed execution trace                                          │
│                                                                         │
│  DIMENSION 4: Statistics                                               │
│  ├── Pass/fail counts                                                  │
│  ├── Total duration                                                    │
│  └── Success rate percentage                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Progress Architecture

### 2.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROGRESS DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EXECUTION ENGINE                             │   │
│  │                                                                 │   │
│  │  for (step of steps) {                                          │   │
│  │    updateStepStatus(index, 'running'); ──────┐                  │   │
│  │    const result = await executeStep();       │                  │   │
│  │    updateStepStatus(index, result ? 'passed' : 'failed'); ──┐   │   │
│  │    addLog('success', 'Step completed'); ─────┼─────────────┼─▶ │   │
│  │    setProgress(percentage); ─────────────────┼─────────────┼─▶ │   │
│  │  }                                            │             │   │   │
│  │                                               │             │   │   │
│  └───────────────────────────────────────────────┼─────────────┼───┘   │
│                                                  │             │       │
│                                                  ▼             ▼       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       REACT STATE                               │   │
│  │                                                                 │   │
│  │  const [testSteps, setTestSteps] = useState<StepStatus[]>([]);  │   │
│  │  const [progress, setProgress] = useState<number>(0);           │   │
│  │  const [logs, setLogs] = useState<LogEntry[]>([]);              │   │
│  │                                                                 │   │
│  └───────────────────────────────────────┬─────────────────────────┘   │
│                                          │                             │
│                                          │ Re-render                   │
│                                          ▼                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       UI COMPONENTS                             │   │
│  │                                                                 │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │   │
│  │  │ ProgressBar │   │  TestSteps  │   │ TestConsole │          │   │
│  │  │  (0-100%)   │   │   (list)    │   │   (logs)    │          │   │
│  │  └─────────────┘   └─────────────┘   └─────────────┘          │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 State Structure

```typescript
// Step status tracking
interface StepStatus {
  stepNumber: number;          // 1-based index
  label: string;               // Human-readable step name
  status: StepStatusValue;     // Current state
  duration: number;            // Execution time (ms)
  error_message: string | null; // Error details if failed
}

type StepStatusValue = 
  | 'pending'   // Not yet executed
  | 'running'   // Currently executing
  | 'passed'    // Completed successfully
  | 'failed'    // Completed with error
  | 'skipped';  // Skipped (stop requested)

// Log entry
interface LogEntry {
  timestamp: string;           // HH:mm:ss format
  level: LogLevel;             // Severity
  message: string;             // Log content
}

type LogLevel = 'info' | 'success' | 'error' | 'warning';

// Overall progress
interface ProgressState {
  percentage: number;          // 0-100
  currentStep: number;         // Current step index
  totalSteps: number;          // Total steps
  currentRow: number;          // Current CSV row
  totalRows: number;           // Total CSV rows
  elapsedTime: number;         // Time since start (ms)
}
```

---

## 3. Step Status Tracking

### 3.1 Status Transitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP STATUS TRANSITIONS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         ┌─────────┐                                     │
│                         │ pending │ (initial state)                     │
│                         └────┬────┘                                     │
│                              │                                          │
│                              │ Step starts executing                    │
│                              ▼                                          │
│                         ┌─────────┐                                     │
│             ┌───────────│ running │───────────┐                         │
│             │           └─────────┘           │                         │
│             │                                 │                         │
│             │ Test stopped                    │ Step completes          │
│             │ before completion               │                         │
│             ▼                                 ▼                         │
│        ┌─────────┐                 ┌───────────────────┐                │
│        │ skipped │                 │    Result?        │                │
│        └─────────┘                 └─────────┬─────────┘                │
│                                              │                          │
│                              ┌───────────────┴───────────────┐          │
│                              │                               │          │
│                              ▼                               ▼          │
│                         ┌─────────┐                    ┌─────────┐      │
│                         │ passed  │                    │ failed  │      │
│                         └─────────┘                    └─────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Status Update Function

```typescript
const updateStepStatus = useCallback((
  index: number,
  status: StepStatusValue,
  duration: number = 0,
  errorMessage: string | null = null
) => {
  setTestSteps(prev => {
    // Create new array with updated step
    const updated = prev.map((step, i) => {
      if (i !== index) return step;
      
      return {
        ...step,
        status,
        duration,
        error_message: errorMessage
      };
    });
    
    return updated;
  });
}, []);
```

### 3.3 Initialization

```typescript
function initializeStepStatuses(recordedSteps: RecordedStep[]): void {
  const initialStatuses: StepStatus[] = recordedSteps.map((step, index) => ({
    stepNumber: index + 1,
    label: step.label,
    status: 'pending',
    duration: 0,
    error_message: null
  }));
  
  setTestSteps(initialStatuses);
}

// Reset for new row (keep labels, reset status)
function resetStepStatusesForNewRow(): void {
  setTestSteps(prev => prev.map(step => ({
    ...step,
    status: 'pending',
    duration: 0,
    error_message: null
  })));
}
```

### 3.4 Batch Status Updates

```typescript
// Mark remaining steps as skipped (when test is stopped)
function markRemainingAsSkipped(fromIndex: number): void {
  setTestSteps(prev => prev.map((step, i) => {
    if (i < fromIndex) return step; // Already processed
    if (step.status !== 'pending') return step; // Already has status
    
    return {
      ...step,
      status: 'skipped'
    };
  }));
}

// Get summary counts
function getStatusCounts(): Record<StepStatusValue, number> {
  return testSteps.reduce((counts, step) => {
    counts[step.status] = (counts[step.status] || 0) + 1;
    return counts;
  }, {} as Record<StepStatusValue, number>);
}
```

---

## 4. Progress Calculation

### 4.1 Simple Progress (Current Implementation)

```typescript
// Progress based on current step within row
function calculateStepProgress(
  currentStepIndex: number,
  totalSteps: number
): number {
  return ((currentStepIndex + 1) / totalSteps) * 100;
}

// Usage in execution loop
for (let i = 0; i < steps.length; i++) {
  await executeStep(steps[i]);
  
  const progress = calculateStepProgress(i, steps.length);
  setProgress(progress);
}
```

### 4.2 Multi-Row Progress (Enhanced)

```typescript
// Progress across all rows and steps
function calculateOverallProgress(
  currentRow: number,
  totalRows: number,
  currentStep: number,
  totalSteps: number
): number {
  // Total work = rows × steps
  const totalWork = totalRows * totalSteps;
  
  // Completed work = (completed rows × steps) + current row steps
  const completedRows = currentRow;
  const completedWork = (completedRows * totalSteps) + currentStep;
  
  return (completedWork / totalWork) * 100;
}

// Usage
const progress = calculateOverallProgress(
  rowIndex,      // 0-based current row
  totalRows,     // Total CSV rows
  stepIndex + 1, // 1-based completed steps in current row
  totalSteps     // Total steps per row
);
```

### 4.3 Progress State Component

```typescript
interface ProgressInfo {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  completedRows: number;
  totalRows: number;
  estimatedTimeRemaining: number | null;
}

function useProgressInfo(): ProgressInfo {
  const [startTime] = useState<number>(Date.now());
  
  const completedSteps = testSteps.filter(
    s => s.status === 'passed' || s.status === 'failed'
  ).length;
  
  const percentage = (completedSteps / testSteps.length) * 100;
  
  // Estimate remaining time based on average step duration
  const avgDuration = testSteps
    .filter(s => s.duration > 0)
    .reduce((sum, s) => sum + s.duration, 0) / completedSteps || 0;
  
  const remainingSteps = testSteps.length - completedSteps;
  const estimatedTimeRemaining = remainingSteps > 0 && avgDuration > 0
    ? remainingSteps * avgDuration
    : null;
  
  return {
    percentage,
    completedSteps,
    totalSteps: testSteps.length,
    completedRows: currentRow,
    totalRows,
    estimatedTimeRemaining
  };
}
```

### 4.4 Progress Display Formats

```typescript
// Percentage format
function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

// Step count format
function formatStepCount(completed: number, total: number): string {
  return `${completed}/${total} steps`;
}

// Row count format
function formatRowCount(completed: number, total: number): string {
  if (total === 1) return ''; // Hide for single row
  return `Row ${completed + 1} of ${total}`;
}

// Time remaining format
function formatTimeRemaining(ms: number | null): string {
  if (ms === null) return '';
  
  if (ms < 1000) return 'Less than 1 second remaining';
  if (ms < 60000) return `~${Math.ceil(ms / 1000)} seconds remaining`;
  
  const minutes = Math.ceil(ms / 60000);
  return `~${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
}
```

---

## 5. Log System

### 5.1 Log Entry Creation

```typescript
const addLog = useCallback((
  level: LogLevel,
  message: string
) => {
  const entry: LogEntry = {
    timestamp: format(new Date(), 'HH:mm:ss'),
    level,
    message
  };
  
  setLogs(prev => [...prev, entry]);
  
  // Also log to console for debugging
  const consoleMethod = {
    info: console.log,
    success: console.log,
    error: console.error,
    warning: console.warn
  }[level];
  
  consoleMethod(`[${entry.timestamp}] ${message}`);
}, []);
```

### 5.2 Log Levels and Styling

```typescript
const LOG_STYLES: Record<LogLevel, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  info: {
    icon: 'ℹ️',
    color: '#3b82f6',    // Blue
    bgColor: '#eff6ff'
  },
  success: {
    icon: '✓',
    color: '#22c55e',    // Green
    bgColor: '#f0fdf4'
  },
  error: {
    icon: '✗',
    color: '#ef4444',    // Red
    bgColor: '#fef2f2'
  },
  warning: {
    icon: '⚠',
    color: '#f59e0b',    // Amber
    bgColor: '#fffbeb'
  }
};
```

### 5.3 Standard Log Messages

```typescript
// Test lifecycle logs
const LIFECYCLE_LOGS = {
  start: (name: string, rows: number) =>
    `Starting test execution: ${name} (${rows} row${rows > 1 ? 's' : ''})`,
  
  rowStart: (current: number, total: number) =>
    `━━━ Row ${current} of ${total} ━━━`,
  
  rowComplete: (passed: number, failed: number) =>
    `Row complete: ${passed} passed, ${failed} failed`,
  
  testComplete: (status: string) =>
    `TEST ${status.toUpperCase()}`,
  
  stopped: () =>
    'Test execution stopped by user',
  
  error: (message: string) =>
    `Error: ${message}`
};

// Step logs
const STEP_LOGS = {
  start: (index: number, label: string) =>
    `Step ${index}: ${label}`,
  
  startWithValue: (index: number, label: string, value: string) =>
    `Step ${index}: ${label} [value: "${truncate(value, 30)}"]`,
  
  passed: (index: number, duration: number) =>
    `✓ Step ${index} completed (${duration}ms)`,
  
  failed: (index: number, duration: number) =>
    `✗ Step ${index} failed (${duration}ms)`,
  
  error: (index: number, error: string) =>
    `✗ Step ${index} error: ${error}`
};

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
```

### 5.4 Log Filtering

```typescript
function filterLogs(
  logs: LogEntry[],
  filters: {
    levels?: LogLevel[];
    search?: string;
    startTime?: string;
    endTime?: string;
  }
): LogEntry[] {
  return logs.filter(log => {
    // Filter by level
    if (filters.levels && !filters.levels.includes(log.level)) {
      return false;
    }
    
    // Filter by search text
    if (filters.search && 
        !log.message.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    // Filter by time range
    if (filters.startTime && log.timestamp < filters.startTime) {
      return false;
    }
    if (filters.endTime && log.timestamp > filters.endTime) {
      return false;
    }
    
    return true;
  });
}

// Get error logs only
function getErrorLogs(logs: LogEntry[]): LogEntry[] {
  return logs.filter(log => log.level === 'error');
}

// Get logs for specific step
function getStepLogs(logs: LogEntry[], stepIndex: number): LogEntry[] {
  const stepPrefix = `Step ${stepIndex}`;
  return logs.filter(log => log.message.includes(stepPrefix));
}
```

### 5.5 Log Export

```typescript
function exportLogsAsText(logs: LogEntry[]): string {
  return logs
    .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
    .join('\n');
}

function exportLogsAsJSON(logs: LogEntry[]): string {
  return JSON.stringify(logs, null, 2);
}

function downloadLogs(logs: LogEntry[], format: 'txt' | 'json'): void {
  const content = format === 'txt' 
    ? exportLogsAsText(logs)
    : exportLogsAsJSON(logs);
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `test-logs-${new Date().toISOString().split('T')[0]}.${format}`;
  link.click();
  
  URL.revokeObjectURL(url);
}
```

---

## 6. UI Components

### 6.1 Progress Bar Component

```typescript
interface ProgressBarProps {
  percentage: number;
  status: 'running' | 'complete' | 'failed' | 'stopped';
}

function ProgressBar({ percentage, status }: ProgressBarProps) {
  const colorClass = {
    running: 'bg-blue-500',
    complete: 'bg-green-500',
    failed: 'bg-red-500',
    stopped: 'bg-yellow-500'
  }[status];
  
  return (
    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${percentage}%` }}
      >
        <span className="sr-only">{Math.round(percentage)}% complete</span>
      </div>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
```

### 6.2 Step List Component

```typescript
interface TestStepsProps {
  steps: StepStatus[];
  currentStep: number;
}

function TestSteps({ steps, currentStep }: TestStepsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to current step
  useEffect(() => {
    if (scrollRef.current) {
      const currentElement = scrollRef.current.children[currentStep];
      currentElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);
  
  return (
    <div ref={scrollRef} className="space-y-2 max-h-96 overflow-y-auto">
      {steps.map((step, index) => (
        <StepItem
          key={step.stepNumber}
          step={step}
          isCurrent={index === currentStep}
        />
      ))}
    </div>
  );
}

interface StepItemProps {
  step: StepStatus;
  isCurrent: boolean;
}

function StepItem({ step, isCurrent }: StepItemProps) {
  const statusConfig = {
    pending: { icon: '○', color: 'text-gray-400', bg: 'bg-gray-50' },
    running: { icon: '◉', color: 'text-blue-500', bg: 'bg-blue-50', animate: true },
    passed: { icon: '✓', color: 'text-green-500', bg: 'bg-green-50' },
    failed: { icon: '✗', color: 'text-red-500', bg: 'bg-red-50' },
    skipped: { icon: '○', color: 'text-gray-400', bg: 'bg-gray-50' }
  }[step.status];
  
  return (
    <div
      className={`
        flex items-center p-2 rounded 
        ${statusConfig.bg}
        ${isCurrent ? 'ring-2 ring-blue-300' : ''}
        ${statusConfig.animate ? 'animate-pulse' : ''}
      `}
    >
      <span className={`mr-2 ${statusConfig.color}`}>
        {statusConfig.icon}
      </span>
      
      <span className="flex-1 truncate">
        {step.stepNumber}. {step.label}
      </span>
      
      {step.duration > 0 && (
        <span className="text-xs text-gray-500 ml-2">
          {step.duration}ms
        </span>
      )}
      
      {step.error_message && (
        <span className="text-xs text-red-500 ml-2 truncate max-w-32" title={step.error_message}>
          {step.error_message}
        </span>
      )}
    </div>
  );
}
```

### 6.3 Console Log Component

```typescript
interface TestConsoleProps {
  logs: LogEntry[];
  autoScroll?: boolean;
}

function TestConsole({ logs, autoScroll = true }: TestConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);
  
  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(l => l.level === filter);
  
  return (
    <div className="flex flex-col h-full">
      {/* Filter buttons */}
      <div className="flex gap-2 p-2 border-b">
        {(['all', 'info', 'success', 'error', 'warning'] as const).map(level => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`
              px-2 py-1 text-xs rounded
              ${filter === level ? 'bg-blue-500 text-white' : 'bg-gray-100'}
            `}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
            {level !== 'all' && (
              <span className="ml-1">
                ({logs.filter(l => l.level === level).length})
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Log entries */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-sm bg-gray-900 text-gray-100"
      >
        {filteredLogs.map((log, index) => (
          <LogLine key={index} log={log} />
        ))}
        
        {filteredLogs.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            No logs to display
          </div>
        )}
      </div>
    </div>
  );
}

function LogLine({ log }: { log: LogEntry }) {
  const style = LOG_STYLES[log.level];
  
  return (
    <div className="py-0.5 flex">
      <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
      <span style={{ color: style.color }}>{style.icon}</span>
      <span className="ml-2 flex-1 break-all">{log.message}</span>
    </div>
  );
}
```

### 6.4 Summary Statistics Component

```typescript
interface TestSummaryProps {
  steps: StepStatus[];
  startTime: number | null;
  endTime: number | null;
}

function TestSummary({ steps, startTime, endTime }: TestSummaryProps) {
  const counts = useMemo(() => {
    return {
      total: steps.length,
      passed: steps.filter(s => s.status === 'passed').length,
      failed: steps.filter(s => s.status === 'failed').length,
      skipped: steps.filter(s => s.status === 'skipped').length,
      pending: steps.filter(s => s.status === 'pending').length
    };
  }, [steps]);
  
  const duration = startTime && endTime ? endTime - startTime : null;
  const passRate = counts.total > 0 
    ? ((counts.passed / counts.total) * 100).toFixed(1)
    : '0.0';
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
      <StatCard
        label="Total Steps"
        value={counts.total}
        icon="📊"
      />
      <StatCard
        label="Passed"
        value={counts.passed}
        icon="✓"
        color="green"
      />
      <StatCard
        label="Failed"
        value={counts.failed}
        icon="✗"
        color="red"
      />
      <StatCard
        label="Pass Rate"
        value={`${passRate}%`}
        icon="📈"
        color={parseFloat(passRate) >= 80 ? 'green' : parseFloat(passRate) >= 50 ? 'yellow' : 'red'}
      />
      {duration !== null && (
        <StatCard
          label="Duration"
          value={formatDuration(duration)}
          icon="⏱"
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color = 'gray' }: {
  label: string;
  value: string | number;
  icon: string;
  color?: 'gray' | 'green' | 'red' | 'yellow';
}) {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-900',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700'
  }[color];
  
  return (
    <div className={`rounded-lg p-4 ${colorClasses}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm opacity-75">{label}</div>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Real-Time Updates

### 7.1 Update Batching

```typescript
// Batch multiple state updates to reduce re-renders
function useBatchedUpdates() {
  const pendingUpdates = useRef<Array<() => void>>([]);
  const frameId = useRef<number | null>(null);
  
  const scheduleUpdate = useCallback((update: () => void) => {
    pendingUpdates.current.push(update);
    
    if (frameId.current === null) {
      frameId.current = requestAnimationFrame(() => {
        // Apply all pending updates in one batch
        ReactDOM.unstable_batchedUpdates(() => {
          pendingUpdates.current.forEach(fn => fn());
          pendingUpdates.current = [];
        });
        frameId.current = null;
      });
    }
  }, []);
  
  return scheduleUpdate;
}

// Usage
const scheduleUpdate = useBatchedUpdates();

// Instead of:
setProgress(50);
setTestSteps([...]);
addLog('info', '...');

// Use:
scheduleUpdate(() => {
  setProgress(50);
  setTestSteps([...]);
  addLog('info', '...');
});
```

### 7.2 Throttled Progress Updates

```typescript
function useThrottledProgress(
  rawProgress: number,
  throttleMs: number = 100
): number {
  const [displayProgress, setDisplayProgress] = useState(0);
  const lastUpdate = useRef<number>(0);
  
  useEffect(() => {
    const now = Date.now();
    
    if (now - lastUpdate.current >= throttleMs) {
      setDisplayProgress(rawProgress);
      lastUpdate.current = now;
    } else {
      // Schedule update for when throttle period ends
      const timeout = setTimeout(() => {
        setDisplayProgress(rawProgress);
        lastUpdate.current = Date.now();
      }, throttleMs - (now - lastUpdate.current));
      
      return () => clearTimeout(timeout);
    }
  }, [rawProgress, throttleMs]);
  
  return displayProgress;
}
```

### 7.3 Virtual Scrolling for Large Log Lists

```typescript
import { FixedSizeList as List } from 'react-window';

function VirtualizedConsole({ logs }: { logs: LogEntry[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = logs[index];
    return (
      <div style={style}>
        <LogLine log={log} />
      </div>
    );
  };
  
  return (
    <List
      height={400}
      itemCount={logs.length}
      itemSize={24}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

---

## 8. Performance Considerations

### 8.1 Memory Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MEMORY CONSIDERATIONS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONCERN: Unbounded log growth                                          │
│  ─────────────────────────────────────                                  │
│  Current: logs array grows indefinitely                                 │
│  Risk: Long tests with many rows can accumulate 10,000+ log entries    │
│  Each entry: ~100-500 bytes → 5MB+ memory for logs alone               │
│                                                                         │
│  MITIGATION OPTIONS:                                                    │
│                                                                         │
│  Option 1: Circular buffer (keep last N entries)                       │
│  const MAX_LOGS = 5000;                                                 │
│  setLogs(prev => {                                                      │
│    const updated = [...prev, newLog];                                   │
│    return updated.length > MAX_LOGS                                     │
│      ? updated.slice(-MAX_LOGS)                                         │
│      : updated;                                                         │
│  });                                                                    │
│                                                                         │
│  Option 2: Log archiving (persist old logs, keep recent in memory)     │
│  Option 3: Log streaming (write to IndexedDB during execution)         │
│  Option 4: Lazy loading (only load visible logs)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Circular Buffer Implementation

```typescript
const MAX_LOG_ENTRIES = 5000;

function addLogWithLimit(
  logs: LogEntry[],
  newLog: LogEntry
): LogEntry[] {
  const updated = [...logs, newLog];
  
  if (updated.length > MAX_LOG_ENTRIES) {
    // Keep last MAX_LOG_ENTRIES entries
    return updated.slice(-MAX_LOG_ENTRIES);
  }
  
  return updated;
}

// Enhanced version with overflow notification
function addLogWithOverflowNotice(
  logs: LogEntry[],
  newLog: LogEntry,
  onOverflow?: () => void
): LogEntry[] {
  const updated = [...logs, newLog];
  
  if (updated.length > MAX_LOG_ENTRIES) {
    if (onOverflow) onOverflow();
    
    // Insert overflow notice if not already present
    const overflowNotice: LogEntry = {
      timestamp: '...',
      level: 'warning',
      message: `[${updated.length - MAX_LOG_ENTRIES} earlier log entries truncated]`
    };
    
    return [
      overflowNotice,
      ...updated.slice(-(MAX_LOG_ENTRIES - 1))
    ];
  }
  
  return updated;
}
```

### 8.3 Update Debouncing

```typescript
// Debounce rapid progress updates
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Usage
const debouncedProgress = useDebouncedValue(progress, 50);
```

---

## 9. Future Enhancements

### 9.1 Enhanced Progress Features

| Feature          | Description                                    | Priority |
|------------------|------------------------------------------------|----------|
| Time Estimation  | Predict remaining time based on average step duration | High     |
| Step Grouping    | Group related steps visually                   | Medium   |
| Diff View        | Compare current run with previous runs         | Medium   |
| Live Screenshots | Show screenshots during execution              | Low      |
| Network Monitor  | Track network requests during test             | Low      |

### 9.2 Time Estimation Implementation

```typescript
interface TimeEstimate {
  remaining: number | null;   // Milliseconds
  confidence: 'high' | 'medium' | 'low';
  completionTime: Date | null;
}

function estimateRemainingTime(
  completedSteps: StepStatus[],
  remainingSteps: number
): TimeEstimate {
  const durations = completedSteps
    .filter(s => s.duration > 0)
    .map(s => s.duration);
  
  if (durations.length < 3) {
    return { remaining: null, confidence: 'low', completionTime: null };
  }
  
  // Calculate average and standard deviation
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  
  // Confidence based on variance
  const confidence = stdDev / avg < 0.3 ? 'high' 
    : stdDev / avg < 0.6 ? 'medium' 
    : 'low';
  
  const remaining = avg * remainingSteps;
  const completionTime = new Date(Date.now() + remaining);
  
  return { remaining, confidence, completionTime };
}
```

### 9.3 Progress Persistence

```typescript
// Save progress state for recovery after crash
interface PersistedProgress {
  projectId: number;
  currentRow: number;
  currentStep: number;
  completedSteps: number[];
  logs: LogEntry[];
  timestamp: number;
}

async function persistProgress(state: PersistedProgress): Promise<void> {
  await chrome.storage.local.set({
    [`progress_${state.projectId}`]: state
  });
}

async function recoverProgress(projectId: number): Promise<PersistedProgress | null> {
  const result = await chrome.storage.local.get(`progress_${projectId}`);
  return result[`progress_${projectId}`] || null;
}

async function clearProgress(projectId: number): Promise<void> {
  await chrome.storage.local.remove(`progress_${projectId}`);
}
```

---

## Summary

The Progress Tracking System provides:

✅ Step status tracking with transitions and batch updates  
✅ Progress calculation for single and multi-row tests  
✅ Log system with levels, filtering, and export  
✅ UI components for progress bar, step list, console, summary  
✅ Real-time updates with batching and throttling  
✅ Performance optimizations for memory and rendering  
✅ Future enhancements for time estimation and persistence  

This system enables users to monitor test execution and identify issues in real-time.
