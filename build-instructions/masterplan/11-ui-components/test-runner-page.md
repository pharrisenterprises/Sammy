# Test Runner Page
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Data Interfaces
3. Page Layout
4. Execution Header
5. Progress Section
6. Test Console
7. Control Panel
8. Results Display
9. State Management
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Test Runner page (809 lines) provides the interface for executing recordings with CSV data, displaying real-time progress, logs, and results.

### 1.2 File Location
```
src/pages/TestRunner.tsx (809 lines)
```

### 1.3 Key Features

- Execute recordings with data-driven inputs
- Real-time progress tracking
- Live log streaming
- Start/Stop/Pause controls
- Results summary with pass/fail status

---

## 2. Data Interfaces

### 2.1 TestRun Interface (CRITICAL - Must Match Existing)
```typescript
// CRITICAL: TestRun interface MUST match existing system
interface TestRun {
  id?: number;
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  test_results: StepResult[];
  logs: string;           // CRITICAL: String, NOT array
}

interface StepResult {
  step_number: number;
  step_label: string;
  status: 'passed' | 'failed' | 'skipped';
  error_message?: string;
  duration_ms: number;
  screenshot_url?: string;
}
```

### 2.2 Execution State
```typescript
interface ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentRow: number;
  totalRows: number;
  currentStep: number;
  totalSteps: number;
  startTime: number | null;
  elapsedTime: number;
  estimatedRemaining: number;
}
```

### 2.3 Log Entry (for display)
```typescript
// Parsed from TestRun.logs string for display
interface ParsedLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

// Parse logs string into display entries
function parseLogs(logsString: string): ParsedLogEntry[] {
  if (!logsString) return [];
  return logsString.split('\n').filter(Boolean).map(line => {
    // Format: "[TIMESTAMP] [LEVEL] Message"
    const match = line.match(/^\[(.+?)\] \[(.+?)\] (.+)$/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toLowerCase() as ParsedLogEntry['level'],
        message: match[3]
      };
    }
    return { timestamp: '', level: 'info', message: line };
  });
}
```

---

## 3. Page Layout

### 3.1 Component Structure
```typescript
// src/pages/TestRunner.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Square, Pause, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export function TestRunner() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');

  // State
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: 'idle',
    currentRow: 0,
    totalRows: 0,
    currentStep: 0,
    totalSteps: 0,
    startTime: null,
    elapsedTime: 0,
    estimatedRemaining: 0
  });

  // CRITICAL: Use ref for immediate stop response
  // State updates are async, ref updates are immediate
  const isRunningRef = useRef(false);

  // Parsed logs for display
  const [displayLogs, setDisplayLogs] = useState<ParsedLogEntry[]>([]);

  // Update display logs when testRun.logs changes
  useEffect(() => {
    if (testRun?.logs) {
      setDisplayLogs(parseLogs(testRun.logs));
    }
  }, [testRun?.logs]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Execution Header */}
      <ExecutionHeader projectName="Project Name" status={executionState.status} />

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Progress Section */}
        <ProgressSection executionState={executionState} />

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Test Console */}
          <TestConsole
            logs={displayLogs}
            isRunning={executionState.status === 'running'}
          />

          {/* Results */}
          <TestResults testRun={testRun} executionState={executionState} />
        </div>

        {/* Control Panel */}
        <ControlPanel
          status={executionState.status}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
```

---

## 4. Execution Header

### 4.1 Header Component
```typescript
// src/components/Runner/ExecutionHeader.tsx
interface ExecutionHeaderProps {
  projectName: string;
  status: ExecutionState['status'];
}

export function ExecutionHeader({ projectName, status }: ExecutionHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {projectName}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Test Execution
          </p>
        </div>

        <StatusBadge status={status} />
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: ExecutionState['status'] }) {
  const styles = {
    idle: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700'
  };

  const labels = {
    idle: 'Ready',
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed'
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${styles[status]}`}>
      {status === 'running' && (
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      )}
      {labels[status]}
    </div>
  );
}
```

---

## 5. Progress Section

### 5.1 Progress Component
```typescript
// src/components/Runner/ProgressSection.tsx
interface ProgressSectionProps {
  executionState: ExecutionState;
}

export function ProgressSection({ executionState }: ProgressSectionProps) {
  const {
    currentRow,
    totalRows,
    currentStep,
    totalSteps,
    elapsedTime,
    estimatedRemaining
  } = executionState;

  const rowProgress = totalRows > 0 ? (currentRow / totalRows) * 100 : 0;
  const stepProgress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Row Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Row Progress
            </span>
            <span className="text-sm text-gray-600">
              {currentRow} / {totalRows}
            </span>
          </div>
          <Progress value={rowProgress} />
        </div>

        {/* Step Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step Progress
            </span>
            <span className="text-sm text-gray-600">
              {currentStep} / {totalSteps}
            </span>
          </div>
          <Progress value={stepProgress} />
        </div>
      </div>

      {/* Time Stats */}
      <div className="flex items-center gap-6 text-sm">
        <div>
          Elapsed: <span className="font-medium">{formatDuration(elapsedTime)}</span>
        </div>
        <div>
          Remaining: <span className="font-medium text-gray-600">
            {estimatedRemaining > 0 ? formatDuration(estimatedRemaining) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
```

---

## 6. Test Console

### 6.1 Console Component
```typescript
// src/components/Runner/TestConsole.tsx
interface TestConsoleProps {
  logs: ParsedLogEntry[];
  isRunning: boolean;
}

export function TestConsole({ logs, isRunning }: TestConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!consoleRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">Console</h3>
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Log Output */}
      <div
        ref={consoleRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500">Waiting for execution...</div>
        ) : (
          logs.map((log, index) => (
            <LogLine key={index} log={log} />
          ))
        )}
      </div>
    </div>
  );
}

function LogLine({ log }: { log: ParsedLogEntry }) {
  const levelColors = {
    info: 'text-gray-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400'
  };

  return (
    <div className="flex gap-3">
      <span className="text-gray-500">{log.timestamp}</span>
      <span className={levelColors[log.level]}>
        [{log.level.toUpperCase()}]
      </span>
      <span className="text-gray-300">{log.message}</span>
    </div>
  );
}
```

---

## 7. Control Panel

### 7.1 Control Component
```typescript
// src/components/Runner/ControlPanel.tsx
interface ControlPanelProps {
  status: ExecutionState['status'];
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onExport: () => void;
}

export function ControlPanel({
  status,
  onStart,
  onStop,
  onPause,
  onResume,
  onExport
}: ControlPanelProps) {
  const isIdle = status === 'idle';
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed' || status === 'failed';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        {/* Left: Execution Controls */}
        <div className="flex items-center gap-3">
          {isIdle && (
            <Button onClick={onStart} size="lg">
              <Play className="w-5 h-5 mr-2" />
              Start Execution
            </Button>
          )}

          {isRunning && (
            <>
              <Button onClick={onPause} variant="outline" size="lg">
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
              <Button onClick={onStop} variant="destructive" size="lg">
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button onClick={onResume} size="lg">
                <Play className="w-5 h-5 mr-2" />
                Resume
              </Button>
              <Button onClick={onStop} variant="destructive" size="lg">
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </>
          )}

          {isCompleted && (
            <Button onClick={onStart} size="lg">
              <RotateCcw className="w-5 h-5 mr-2" />
              Run Again
            </Button>
          )}
        </div>

        {/* Right: Export */}
        <Button onClick={onExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Results
        </Button>
      </div>
    </div>
  );
}
```

### 7.2 Keyboard Shortcuts
```typescript
// Add keyboard shortcuts for controls
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + Enter = Start/Resume
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (executionState.status === 'idle') handleStart();
      if (executionState.status === 'paused') handleResume();
    }

    // Escape = Stop
    if (e.key === 'Escape' && isRunningRef.current) {
      e.preventDefault();
      handleStop();
    }

    // Space = Pause/Resume (when running)
    if (e.key === ' ' && isRunningRef.current) {
      e.preventDefault();
      if (executionState.status === 'running') handlePause();
      else if (executionState.status === 'paused') handleResume();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [executionState.status]);
```

---

## 8. Results Display

### 8.1 Results Component
```typescript
// src/components/Runner/TestResults.tsx
interface TestResultsProps {
  testRun: TestRun | null;
  executionState: ExecutionState;
}

export function TestResults({ testRun, executionState }: TestResultsProps) {
  if (!testRun) {
    return (
      <div className="bg-white rounded-lg shadow p-6 h-[600px] flex items-center justify-center">
        <p className="text-gray-500">
          Results will appear here after execution
        </p>
      </div>
    );
  }

  const { passed_steps, failed_steps, total_steps, test_results } = testRun;
  const passRate = total_steps > 0
    ? Math.round((passed_steps / total_steps) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[600px]">
      {/* Summary Header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Results Summary
        </h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-200">
        <StatCard label="Passed" value={passed_steps} color="green" />
        <StatCard label="Failed" value={failed_steps} color="red" />
        <StatCard
          label="Pass Rate"
          value={`${passRate}%`}
          color={passRate >= 80 ? 'green' : passRate >= 50 ? 'yellow' : 'red'}
        />
      </div>

      {/* Step Results */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {test_results.map((result, index) => (
          <StepResultRow key={index} result={result} />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color
}: {
  label: string;
  value: string | number;
  color: 'green' | 'red' | 'yellow';
}) {
  const colorStyles = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700'
  };

  return (
    <div className="text-center">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorStyles[color]}`}>{value}</div>
    </div>
  );
}

function StepResultRow({ result }: { result: StepResult }) {
  const statusStyles = {
    passed: 'text-green-600',
    failed: 'text-red-600',
    skipped: 'text-gray-400'
  };

  const statusIcons = {
    passed: '✓',
    failed: '✗',
    skipped: '○'
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
      <div className="flex items-center gap-3">
        <span className={`text-lg font-bold ${statusStyles[result.status]}`}>
          {statusIcons[result.status]}
        </span>
        <span className="text-sm text-gray-900">{result.step_label}</span>
      </div>
      <span className="text-xs text-gray-500">
        {result.duration_ms}ms
      </span>
    </div>
  );
}
```

---

## 9. State Management

### 9.1 Start Execution
```typescript
async function handleStart(): Promise<void> {
  // CRITICAL: Set ref immediately for instant response
  isRunningRef.current = true;

  setExecutionState(prev => ({
    ...prev,
    status: 'running',
    startTime: Date.now(),
    currentRow: 0,
    currentStep: 0
  }));

  try {
    // CRITICAL: Use lowercase snake_case action
    const response = await chrome.runtime.sendMessage({
      action: 'start_test_run',
      data: { projectId: parseInt(projectId!) }
    });

    if (response.success) {
      setTestRun(response.testRun);
    }
  } catch (error) {
    console.error('Failed to start execution:', error);
    isRunningRef.current = false;
    setExecutionState(prev => ({ ...prev, status: 'failed' }));
  }
}
```

### 9.2 Stop Execution
```typescript
async function handleStop(): Promise<void> {
  // CRITICAL: Set ref immediately for instant response
  // State updates are async, but ref update is synchronous
  isRunningRef.current = false;

  // Update state (will render on next tick)
  setExecutionState(prev => ({
    ...prev,
    status: 'completed'
  }));

  try {
    await chrome.runtime.sendMessage({
      action: 'stop_test_run',
      data: { testRunId: testRun?.id }
    });
  } catch (error) {
    console.error('Failed to stop execution:', error);
  }
}
```

### 9.3 Pause/Resume
```typescript
async function handlePause(): Promise<void> {
  isRunningRef.current = false;

  setExecutionState(prev => ({
    ...prev,
    status: 'paused'
  }));

  await chrome.runtime.sendMessage({
    action: 'pause_test_run',
    data: { testRunId: testRun?.id }
  });
}

async function handleResume(): Promise<void> {
  isRunningRef.current = true;

  setExecutionState(prev => ({
    ...prev,
    status: 'running'
  }));

  await chrome.runtime.sendMessage({
    action: 'resume_test_run',
    data: { testRunId: testRun?.id }
  });
}
```

### 9.4 Progress Updates
```typescript
// Listen for progress updates from background
useEffect(() => {
  const handleMessage = (message: any) => {
    if (message.action === 'test_progress_update') {
      setExecutionState(prev => ({
        ...prev,
        currentRow: message.currentRow,
        totalRows: message.totalRows,
        currentStep: message.currentStep,
        totalSteps: message.totalSteps,
        elapsedTime: Date.now() - (prev.startTime || Date.now()),
        estimatedRemaining: message.estimatedRemaining
      }));
    }

    if (message.action === 'test_log_update') {
      // Append to logs string
      setTestRun(prev => prev ? {
        ...prev,
        logs: prev.logs + '\n' + message.log
      } : null);
    }

    if (message.action === 'test_completed') {
      isRunningRef.current = false;
      setExecutionState(prev => ({
        ...prev,
        status: message.success ? 'completed' : 'failed'
      }));
      setTestRun(message.testRun);
    }
  };

  chrome.runtime.onMessage.addListener(handleMessage);
  return () => chrome.runtime.onMessage.removeListener(handleMessage);
}, []);
```

---

## 10. Testing Strategy

### 10.1 Component Tests
```typescript
describe('TestRunner', () => {
  it('uses isRunningRef for immediate stop', async () => {
    const { result } = renderHook(() => {
      const isRunningRef = useRef(false);
      const [status, setStatus] = useState('running');

      const handleStop = () => {
        isRunningRef.current = false; // Immediate
        setStatus('completed'); // Async
      };

      return { isRunningRef, status, handleStop };
    });

    // Start running
    act(() => {
      result.current.isRunningRef.current = true;
    });

    // Stop - ref should update immediately
    act(() => {
      result.current.handleStop();
    });

    // Ref is already false (synchronous)
    expect(result.current.isRunningRef.current).toBe(false);
  });

  it('parses logs string into display entries', () => {
    const logsString = '[10:00:00] [INFO] Starting test\n[10:00:01] [SUCCESS] Step 1 passed';

    const parsed = parseLogs(logsString);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].level).toBe('info');
    expect(parsed[1].level).toBe('success');
  });
});
```

---

## Summary

Test Runner Page provides:
- ✅ **Correct TestRun interface** with `logs: string` (NOT array)
- ✅ **isRunningRef pattern** for immediate stop response
- ✅ **ExecutionHeader** with status badge
- ✅ **ProgressSection** with row/step progress
- ✅ **TestConsole** with log parsing from string
- ✅ **ControlPanel** with keyboard shortcuts
- ✅ **TestResults** with pass/fail summary
- ✅ **Correct message actions** (lowercase snake_case)
- ✅ **Testing strategy** validating ref pattern

Aligns with existing project knowledge base interfaces.
