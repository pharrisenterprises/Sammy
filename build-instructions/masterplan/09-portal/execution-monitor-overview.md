# Execution Monitor Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Component Structure
4. Data Flow
5. Real-Time Communication
6. State Management
7. User Experience Flow
8. Performance Considerations
9. Integration Points
10. Future Enhancements

---

## 1. Overview

### 1.1 Purpose

The Execution Monitor provides real-time visibility into test execution, displaying progress, logs, and step status as tests run across multiple CSV rows.

### 1.2 Key Features

- **Live Progress Tracking**: Real-time percentage and step counts
- **Streaming Logs**: Color-coded execution events (info, success, error, warning)
- **Step Status Indicators**: Visual representation of passed/failed/running steps
- **Execution Controls**: Start, stop, pause (Phase 2), resume (Phase 2)
- **Multi-Row Monitoring**: Track progress across CSV data rows
- **Time Estimation**: Predict remaining execution time
- **History View**: Review past test runs with detailed results

### 1.3 User Workflow
```
1. User clicks "Start Test"
   ↓
2. Execution begins (tab opens, script injects)
   ↓
3. Monitor displays:
   - Progress bar (0% → 100%)
   - Current step highlight
   - Real-time log entries
   - Passed/Failed counters
   ↓
4. Logs stream as steps execute
   ↓
5. Completion:
   - Final statistics
   - Export results option
   - View history link
```

---

## 2. Architecture

### 2.1 High-Level Components
```
┌─────────────────────────────────────────────────────────────────┐
│                  EXECUTION MONITOR PAGE                         │
│                  (TestRunner.tsx - 809 lines)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Control Panel                                         │   │
│  │  • Start/Stop buttons                                  │   │
│  │  • Current project name                                │   │
│  │  • Execution status badge                              │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────┐  ┌────────────────────────────────────┐  │
│  │ Progress Panel  │  │  Step List (Left Side)             │  │
│  │                 │  │                                    │  │
│  │ • Progress bar  │  │  • Step 1: Navigate ✓              │  │
│  │ • Percentage    │  │  • Step 2: Click ✓                 │  │
│  │ • Time elapsed  │  │  • Step 3: Type → (running)        │  │
│  │ • Est. remaining│  │  • Step 4: Click (pending)         │  │
│  │ • CSV row N/M   │  │  • Step 5: Submit (pending)        │  │
│  └─────────────────┘  └────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Log Console (Right Side)                              │   │
│  │                                                         │   │
│  │  [12:34:01] ℹ Starting test execution...               │   │
│  │  [12:34:02] ✓ Opened tab: https://example.com         │   │
│  │  [12:34:03] ℹ Processing CSV row 1/10                  │   │
│  │  [12:34:04] ✓ Step 1: Navigate - SUCCESS              │   │
│  │  [12:34:05] ✓ Step 2: Click button - SUCCESS          │   │
│  │  [12:34:06] → Step 3: Type "John" - RUNNING...        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Statistics Cards                                       │   │
│  │                                                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Passed   │  │ Failed   │  │ Duration │            │   │
│  │  │   25     │  │    2     │  │  45.3s   │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘            │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ MESSAGE BUS (chrome.runtime.onMessage)                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKGROUND SERVICE + REPLAY ENGINE                             │
│ • Tab management                                                │
│ • Step execution via chrome.tabs.sendMessage                    │
│ • Result aggregation                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 File Structure
```
src/
├── pages/
│   └── TestRunner.tsx               (Main page - 809 lines)
├── components/
│   └── Runner/
│       ├── TestConsole.tsx          (Log display - 250 lines)
│       ├── TestResults.tsx          (Results summary - 150 lines)
│       ├── TestSteps.tsx            (Step list - 200 lines)
│       ├── ProgressBar.tsx          (Progress indicator - 100 lines)
│       ├── ExecutionControls.tsx   (Start/Stop buttons - 120 lines)
│       └── StatisticsCards.tsx      (Pass/fail counts - 80 lines)
└── hooks/
    └── useTestExecution.ts          (Execution state logic - 300 lines)
```

---

## 3. Component Structure

### 3.1 Main Page Component

#### File: `src/pages/TestRunner.tsx`

**Responsibilities:**
- Coordinate test execution lifecycle
- Manage execution state (running, stopped, completed)
- Handle chrome.runtime.onMessage events
- Update UI in real-time
- Save test run results to storage

**Key State:**
```typescript
const [isRunning, setIsRunning] = useState(false);
const [progress, setProgress] = useState(0);
const [currentStep, setCurrentStep] = useState(0);
const [logs, setLogs] = useState([]);
const [testSteps, setTestSteps] = useState([]);
const [passedCount, setPassedCount] = useState(0);
const [failedCount, setFailedCount] = useState(0);
const [startTime, setStartTime] = useState(null);
const [currentRow, setCurrentRow] = useState(0);
const [totalRows, setTotalRows] = useState(0);

// Use ref for immediate stop response
const isRunningRef = useRef(false);
```

**Key Methods:**
```typescript
startTest(): Promise<void>
stopTest(): void
handleLogMessage(log: LogEntry): void
handleStepUpdate(stepIndex: number, status: StepStatus): void
saveTestRun(results: TestRunResult): Promise<void>
```

### 3.2 Child Components

#### TestConsole Component

**Purpose**: Display streaming logs with color-coding

**Props:**
```typescript
interface TestConsoleProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  maxHeight?: number;
}

interface LogEntry {
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
}
```

#### TestSteps Component

**Purpose**: Show step list with status indicators

**Props:**
```typescript
interface TestStepsProps {
  steps: TestStep[];
  currentStep: number;
}

interface TestStep {
  id: number;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
}
```

#### ProgressBar Component

**Purpose**: Visual progress indicator

**Props:**
```typescript
interface ProgressBarProps {
  progress: number;        // 0-100
  status: 'idle' | 'running' | 'completed' | 'failed';
  showPercentage?: boolean;
  animated?: boolean;
}
```

---

## 4. Data Flow

### 4.1 Complete Execution Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Click "Start Test"                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        setIsRunning(true)
        setStartTime(Date.now())
        Initialize state (logs: [], progress: 0, passedCount: 0)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. LOAD PROJECT DATA                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        chrome.runtime.sendMessage({
          action: 'get_project',
          payload: { id: projectId }
        })
                              ↓
        Receive: { recorded_steps, parsed_fields, csv_data, target_url }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CREATE TEST RUN RECORD                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        chrome.runtime.sendMessage({
          action: 'create_test_run',
          payload: {
            project_id: projectId,
            status: 'pending',
            total_steps: recorded_steps.length * csv_data.length
          }
        })
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. OPEN BROWSER TAB                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        chrome.runtime.sendMessage({
          action: 'openTab',
          url: target_url
        })
                              ↓
        Response: { success: true, tabId: 12345 }
                              ↓
        addLog({ level: 'success', message: 'Opened tab' })
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. ITERATE CSV ROWS                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        FOR EACH row in csv_data:
          setCurrentRow(rowIndex + 1)
          addLog({ level: 'info', message: `Processing row ${rowIndex + 1}/${totalRows}` })
          
          // Create mapping lookup
          mappingLookup = {}
          parsed_fields.forEach(field => {
            if (field.mapped) {
              mappingLookup[field.inputvarfields] = row[field.field_name]
            }
          })
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. EXECUTE STEPS SEQUENTIALLY                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
          FOR EACH step in recorded_steps:
            setCurrentStep(stepIndex)
            updateStepStatus(stepIndex, 'running')
            
            // Inject CSV value if mapped
            const injectedValue = mappingLookup[step.label] || step.value
            
            // Send to content script
            const success = await chrome.tabs.sendMessage(tabId, {
              type: 'runStep',
              data: {
                event: step.event,
                bundle: step.bundle,
                value: injectedValue,
                label: step.label
              }
            })
            
            // Update status
            if (success) {
              updateStepStatus(stepIndex, 'passed')
              setPassedCount(prev => prev + 1)
              addLog({ level: 'success', message: `✓ ${step.label}` })
            } else {
              updateStepStatus(stepIndex, 'failed')
              setFailedCount(prev => prev + 1)
              addLog({ level: 'error', message: `✗ ${step.label}` })
            }
            
            // Update progress
            const totalSteps = recorded_steps.length * csv_data.length
            const completedSteps = passedCount + failedCount
            setProgress((completedSteps / totalSteps) * 100)
            
            // Wait between steps
            await new Promise(resolve => setTimeout(resolve, 500))
          
          END FOR (steps)
                              ↓
        END FOR (rows)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. CLEANUP & SAVE RESULTS                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        chrome.runtime.sendMessage({
          action: 'closeTab',
          payload: { tabId }
        })
        
        const endTime = Date.now()
        const duration = endTime - startTime
        
        chrome.runtime.sendMessage({
          action: 'update_test_run',
          payload: {
            id: testRunId,
            status: failedCount > 0 ? 'failed' : 'completed',
            end_time: endTime,
            passed_steps: passedCount,
            failed_steps: failedCount,
            logs: logs.map(l => l.message).join('\n')
          }
        })
        
        setIsRunning(false)
        addLog({ level: 'success', message: `Test completed in ${duration}ms` })
```

### 4.2 Message Flow Diagram
```
TestRunner.tsx                Background Service           Content Script
     │                               │                          │
     ├──────── openTab ───────────→ │                          │
     │                               ├──── chrome.tabs.create ─→│
     │ ←────── { tabId: 123 } ────── │                          │
     │                               │                          │
     ├──── runStep (step 1) ───────→│                          │
     │                               ├── tabs.sendMessage ─────→│
     │                               │                          ├─ execute
     │                               │ ←───── success ──────────┤
     │ ←────── success ───────────── │                          │
     │                               │                          │
     ├──── runStep (step 2) ───────→│                          │
     │                               ├── tabs.sendMessage ─────→│
     │                               │                          ├─ execute
     │                               │ ←───── success ──────────┤
     │ ←────── success ───────────── │                          │
     │                               │                          │
     └──────── closeTab ────────────→│                          │
                                     ├──── chrome.tabs.remove ──→│
```

---

## 5. Real-Time Communication

### 5.1 Message Listener Setup
```typescript
useEffect(() => {
  const messageListener = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.type === 'stepUpdate') {
      handleStepUpdate(message.stepIndex, message.status);
    } else if (message.type === 'logMessage') {
      handleLogMessage(message.log);
    } else if (message.type === 'progressUpdate') {
      setProgress(message.progress);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
  };
}, []);
```

### 5.2 Event Types

| Event Type | Payload | Purpose |
|------------|---------|---------|
| `stepUpdate` | `{ stepIndex: number, status: StepStatus }` | Update step status indicator |
| `logMessage` | `{ log: LogEntry }` | Add log entry to console |
| `progressUpdate` | `{ progress: number }` | Update progress bar |
| `executionComplete` | `{ success: boolean, results: TestRunResult }` | Handle completion |
| `executionError` | `{ error: string, stepIndex: number }` | Handle errors |

---

## 6. State Management

### 6.1 Execution State Machine
```typescript
type ExecutionStatus = 
  | 'idle'           // Not running
  | 'initializing'   // Loading project, opening tab
  | 'running'        // Executing steps
  | 'paused'         // Paused (Phase 2)
  | 'completed'      // All steps finished successfully
  | 'failed'         // Some steps failed
  | 'aborted';       // User stopped execution

interface ExecutionState {
  status: ExecutionStatus;
  progress: number;
  currentStep: number;
  currentRow: number;
  totalRows: number;
  passedCount: number;
  failedCount: number;
  startTime: number | null;
  endTime: number | null;
  testRunId: number | null;
}
```

### 6.2 State Transitions
```
idle → initializing → running → completed
                  ↓            ↓
                  └→ aborted   └→ failed
```

### 6.3 Custom Hook: `useTestExecution`
```typescript
export function useTestExecution(projectId: string) {
  const [state, setState] = useState<ExecutionState>({
    status: 'idle',
    progress: 0,
    currentStep: 0,
    currentRow: 0,
    totalRows: 0,
    passedCount: 0,
    failedCount: 0,
    startTime: null,
    endTime: null,
    testRunId: null
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);

  const startTest = async () => {
    setState(prev => ({ ...prev, status: 'initializing', startTime: Date.now() }));
    // ... execution logic
  };

  const stopTest = () => {
    setState(prev => ({ ...prev, status: 'aborted', endTime: Date.now() }));
  };

  const addLog = (log: LogEntry) => {
    setLogs(prev => [...prev, { ...log, timestamp: Date.now() }]);
  };

  const updateStepStatus = (stepIndex: number, status: StepStatus) => {
    setTestSteps(prev => prev.map((step, i) => 
      i === stepIndex ? { ...step, status } : step
    ));
  };

  return {
    state,
    logs,
    testSteps,
    startTest,
    stopTest,
    addLog,
    updateStepStatus
  };
}
```

---

## 7. User Experience Flow

### 7.1 Happy Path
```
1. User navigates to Test Runner page
   ↓
2. Project loaded, steps displayed in "pending" state
   ↓
3. User clicks "Start Test"
   ↓
4. Loading spinner appears briefly
   ↓
5. Progress bar starts at 0%
   ↓
6. Logs begin streaming:
   "[12:00:00] ℹ Starting execution..."
   "[12:00:01] ✓ Tab opened"
   "[12:00:02] ℹ Processing row 1/5"
   "[12:00:03] ✓ Step 1: Navigate - SUCCESS"
   "[12:00:04] ✓ Step 2: Click - SUCCESS"
   ↓
7. Progress bar updates: 20% → 40% → 60% → 80% → 100%
   ↓
8. Completion message:
   "✓ Test completed in 45.3s - 25 passed, 0 failed"
   ↓
9. Export button appears
   ↓
10. User downloads results as Excel/CSV
```

### 7.2 Error Path
```
1. User starts test
   ↓
2. Step 3 fails (element not found)
   ↓
3. Log entry: "[12:00:04] ✗ Step 3: Type - ERROR: Element not found"
   ↓
4. Step 3 marked as failed (red X)
   ↓
5. Execution continues to next step
   ↓
6. Test completes with mixed results:
   "⚠ Test completed with errors - 22 passed, 3 failed"
   ↓
7. User reviews failed steps
   ↓
8. User clicks "View Details" on failed step
   ↓
9. Error details displayed in modal
```

---

## 8. Performance Considerations

### 8.1 Log Management

**Problem:** Logs array grows unbounded
```typescript
// Bad: Keeps all logs in memory
const [logs, setLogs] = useState([]);

// Good: Limit to last N entries
const MAX_LOGS = 1000;
const addLog = (log: LogEntry) => {
  setLogs(prev => {
    const updated = [...prev, log];
    if (updated.length > MAX_LOGS) {
      return updated.slice(-MAX_LOGS);
    }
    return updated;
  });
};
```

### 8.2 UI Update Throttling

**Problem:** Too many state updates per second
```typescript
// Bad: Updates on every log
addLog(log);

// Good: Batch updates every 100ms
const logBuffer = useRef<LogEntry[]>([]);

const addLogThrottled = useCallback((log: LogEntry) => {
  logBuffer.current.push(log);
}, []);

useEffect(() => {
  const interval = setInterval(() => {
    if (logBuffer.current.length > 0) {
      setLogs(prev => [...prev, ...logBuffer.current]);
      logBuffer.current = [];
    }
  }, 100);

  return () => clearInterval(interval);
}, []);
```

### 8.3 Virtual Scrolling for Steps
```tsx
import { FixedSizeList } from 'react-window';

export function TestStepsList({ steps }: { steps: TestStep[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={steps.length}
      itemSize={40}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <TestStepItem step={steps[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

---

## 9. Integration Points

### 9.1 Dependencies (Consumes)

**Background Service:**
- Provides: Tab management, script injection
- Messages: `openTab`, `closeTab`, `runStep`

**Replay Engine:**
- Provides: Step execution results
- Protocol: `chrome.tabs.sendMessage` with response callback

**Storage Layer:**
- Provides: Project data, test run persistence
- Messages: `get_project`, `create_test_run`, `update_test_run`

**Field Mapper:**
- Provides: CSV data and field mappings
- Data: `parsed_fields[]`, `csv_data[]`

### 9.2 Dependents (Provides To)

**Test History:**
- Provides: Completed test run data
- Format: TestRun records with results and logs

**Export Functionality:**
- Provides: Execution logs and results
- Formats: Excel, CSV, JSON

**Dashboard Statistics:**
- Provides: Test run counts, pass/fail ratios
- Updates: On test completion

---

## 10. Future Enhancements

### 10.1 Phase 2 Features

**Pause/Resume:**
```typescript
const pauseTest = () => {
  isPaused.current = true;
  setState(prev => ({ ...prev, status: 'paused' }));
};

const resumeTest = () => {
  isPaused.current = false;
  setState(prev => ({ ...prev, status: 'running' }));
  // Continue from currentStep
};
```

**Live Screenshot Preview:**
```typescript
// Capture screenshot on each step
const screenshot = await chrome.tabs.captureVisibleTab(tabId);
setCurrentScreenshot(screenshot);
```

### 10.2 Phase 3 Features

**WebSocket Real-Time (VDI):**
```typescript
const ws = new WebSocket('wss://api.example.com/execution/stream');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  if (update.type === 'stepComplete') {
    updateStepStatus(update.stepIndex, update.status);
  } else if (update.type === 'log') {
    addLog(update.log);
  }
};
```

**Parallel Execution Monitoring:**
```typescript
// Monitor multiple concurrent test runs
const [activeRuns, setActiveRuns] = useState<Map<string, ExecutionState>>(new Map());
```

---

## Summary

The Execution Monitor provides:
- ✅ **Real-time progress tracking** with percentage and step counts
- ✅ **Streaming log console** with color-coded entries (4 levels)
- ✅ **Visual step status** (pending, running, passed, failed indicators)
- ✅ **Execution controls** (start, stop, with pause/resume in Phase 2)
- ✅ **Multi-row monitoring** for CSV-driven tests
- ✅ **Time tracking** (elapsed, estimated remaining)
- ✅ **Performance optimization** (log limits, update throttling, virtual scrolling)
- ✅ **Comprehensive state management** with custom useTestExecution hook
- ✅ **Integration ready** for WebSocket (Phase 3 VDI)

This provides complete visibility into test execution with responsive UI and efficient resource usage.
