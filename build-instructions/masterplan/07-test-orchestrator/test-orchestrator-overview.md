# Test Orchestrator Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture Summary
3. Core Responsibilities
4. Execution Flow
5. Data Structures
6. Tab Management
7. CSV Row Processing
8. Step Sequencing
9. Value Injection
10. Progress Tracking
11. Error Handling
12. Result Collection
13. Future Enhancements

---

## 1. Overview

### 1.1 Purpose

The **Test Orchestrator** is the execution coordination system that manages end-to-end test runs. It opens browser tabs, injects scripts, iterates through CSV data rows, sends replay commands to the Replay Engine, tracks progress, and stores execution history.

### 1.2 Complexity Rating

**🔴 HIGH (8/10)**

This is the most complex subsystem in the extension due to:
- Nested loops (rows × steps)
- Async coordination across multiple contexts
- State synchronization with UI
- Multi-level error handling
- Tab lifecycle management

### 1.3 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR PRINCIPLES                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SEQUENTIAL BY DEFAULT                                               │
│     - Steps execute in order, never parallel                            │
│     - Rows processed one at a time                                      │
│     - Predictable, debuggable execution                                 │
│                                                                         │
│  2. FAIL-SOFT APPROACH                                                  │
│     - One failed step doesn't stop the entire test                      │
│     - Errors logged, execution continues                                │
│     - Results aggregated at the end                                     │
│                                                                         │
│  3. REAL-TIME FEEDBACK                                                  │
│     - Progress updates after each step                                  │
│     - Logs appear immediately                                           │
│     - UI stays responsive during execution                              │
│                                                                         │
│  4. DATA-DRIVEN EXECUTION                                               │
│     - CSV values injected into steps                                    │
│     - Field mappings connect data to actions                            │
│     - Same test can run with different data                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Summary

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   TEST ORCHESTRATOR ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      TEST RUNNER UI                             │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │    │
│  │  │ Control │  │ Console │  │  Steps  │  │ Results │            │    │
│  │  │ Buttons │  │  Logs   │  │Progress │  │ Summary │            │    │
│  │  └────┬────┘  └────▲────┘  └────▲────┘  └────▲────┘            │    │
│  │       │            │            │            │                  │    │
│  └───────┼────────────┼────────────┼────────────┼──────────────────┘    │
│          │            │            │            │                       │
│          ▼            │            │            │                       │
│  ┌───────────────────┴────────────┴────────────┴───────────────────┐    │
│  │                    ORCHESTRATOR ENGINE                          │    │
│  │                                                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │    │
│  │  │  Lifecycle  │  │     Row     │  │    Step     │            │    │
│  │  │   Manager   │  │  Iterator   │  │  Executor   │            │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │    │
│  │         │                │                │                    │    │
│  │         └────────────────┼────────────────┘                    │    │
│  │                          │                                     │    │
│  │  ┌─────────────┐  ┌──────▼──────┐  ┌─────────────┐            │    │
│  │  │    Value    │  │  Progress   │  │   Result    │            │    │
│  │  │  Injector   │  │   Tracker   │  │  Collector  │            │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│  ┌───────────────────┬───────┴───────┬───────────────────┐             │
│  │                   │               │                   │             │
│  ▼                   ▼               ▼                   │             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐│             │
│  │  Background   │  │    Replay     │  │    Storage    ││             │
│  │   Service     │  │    Engine     │  │     Layer     ││             │
│  │ (Tab Mgmt)    │  │  (Step Exec)  │  │  (Results)    ││             │
│  └───────────────┘  └───────────────┘  └───────────────┘│             │
│                                                          │             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Locations

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Main Orchestrator | `src/pages/TestRunner.tsx` | 809 | Execution logic + UI |
| Console Display | `src/components/Runner/TestConsole.tsx` | ~150 | Log rendering |
| Results Display | `src/components/Runner/TestResults.tsx` | ~100 | Summary view |
| Steps Display | `src/components/Runner/TestSteps.tsx` | ~120 | Progress list |

### 2.3 System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM INTERACTIONS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DEPENDENCIES (Consumes):                                               │
│  ├── Storage Layer → Load project, steps, CSV data, field mappings      │
│  ├── Background Service → Open tabs, inject scripts                     │
│  ├── Replay Engine → Execute individual steps                           │
│  └── Message Bus → Send commands, receive responses                     │
│                                                                         │
│  DEPENDENTS (Provides To):                                              │
│  ├── Users → Visual feedback (progress, logs, results)                  │
│  └── Storage Layer → Test run history for analytics                     │
│                                                                         │
│  COMMUNICATION:                                                         │
│  ├── chrome.runtime.sendMessage → Background service                    │
│  └── chrome.tabs.sendMessage → Content script (Replay Engine)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Responsibilities

### 3.1 MUST DO

| # | Responsibility | Implementation | Lines |
|---|----------------|----------------|-------|
| 1 | **Test Lifecycle Management** | Start, stop, reset execution | 100-200 |
| 2 | **Multi-Row Execution** | Iterate through CSV data rows | 200-400 |
| 3 | **Tab Coordination** | Open/close browser tabs | via Background |
| 4 | **Script Injection** | Ensure content scripts loaded | via Background |
| 5 | **Step Sequencing** | Execute steps in order | 400-500 |
| 6 | **Value Injection** | Map CSV values to step inputs | 250-300 |
| 7 | **Progress Tracking** | Real-time progress and status | 500-550 |
| 8 | **Error Handling** | Catch failures, log, continue | 550-600 |
| 9 | **Result Collection** | Aggregate pass/fail counts | 600-650 |
| 10 | **History Storage** | Persist test run results | via Storage |

### 3.2 MUST NOT DO

```typescript
// ❌ WRONG: Parallel step execution
await Promise.all(steps.map(step => executeStep(step)));
// Steps may have dependencies, must be sequential

// ✅ CORRECT: Sequential execution
for (const step of steps) {
  await executeStep(step);
}

// ❌ WRONG: Stop immediately on first failure
if (!stepResult.success) {
  throw new Error('Test failed');
}

// ✅ CORRECT: Log failure, continue to next step
if (!stepResult.success) {
  addLog('error', `Step ${step.stepNumber} failed`);
  failedSteps++;
  continue;
}

// ❌ WRONG: Direct DB access from orchestrator
const runs = await DB.testRuns.where('project_id').equals(id).toArray();

// ✅ CORRECT: Message through background
const response = await chrome.runtime.sendMessage({
  action: 'getTestRunsByProject',
  payload: { projectId: id }
});
```

---

## 4. Execution Flow

### 4.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TEST EXECUTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User clicks "Run Test"                                                 │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  INITIALIZATION                                                 │    │
│  │  1. Validate project has steps and target_url                   │    │
│  │  2. Set isRunningRef = true                                     │    │
│  │  3. Reset progress, logs, step statuses                         │    │
│  │  4. Build mapping lookup from parsed_fields                     │    │
│  │  5. Determine rows to process (CSV or single empty row)         │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TAB SETUP (per row or once)                                    │    │
│  │  1. Send "openTab" message to background                        │    │
│  │  2. Wait for tab creation response                              │    │
│  │  3. Background injects content script                           │    │
│  │  4. Wait for script ready signal                                │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ROW ITERATION                                                  │    │
│  │  FOR EACH row IN rowsToProcess:                                 │    │
│  │    │                                                            │    │
│  │    ├── Check isRunningRef (stop if false)                       │    │
│  │    │                                                            │    │
│  │    ├── Log "Starting row X of Y"                                │    │
│  │    │                                                            │    │
│  │    └── ┌─────────────────────────────────────────────────────┐ │    │
│  │        │  STEP ITERATION                                     │ │    │
│  │        │  FOR EACH step IN recorded_steps:                   │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Check isRunningRef (stop if false)           │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Update step status to "running"              │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Inject CSV value (if mapped)                 │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Send "runStep" to content script             │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Wait for response                            │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Update step status (passed/failed)           │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Log result                                   │ │    │
│  │        │    │                                                │ │    │
│  │        │    ├── Update progress percentage                   │ │    │
│  │        │    │                                                │ │    │
│  │        │    └── Add random delay (1-2 seconds)               │ │    │
│  │        └─────────────────────────────────────────────────────┘ │    │
│  │                                                                 │    │
│  │    Log "Row X completed: N passed, M failed"                    │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  CLEANUP & RESULTS                                              │    │
│  │  1. Set isRunningRef = false                                    │    │
│  │  2. Calculate final statistics                                  │    │
│  │  3. Save test run to database                                   │    │
│  │  4. Refresh test history in UI                                  │    │
│  │  5. Log completion summary                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Timing Diagram

```
Time →
──────────────────────────────────────────────────────────────────────────

User Click
    │
    ├─────────────────────────────────────────────────────────────────────
    │ INIT (50-100ms)
    │ ├── Validate project
    │ ├── Reset state
    │ └── Build mappings
    │
    ├─────────────────────────────────────────────────────────────────────
    │ TAB OPEN (500-2000ms)
    │ ├── Create tab
    │ ├── Navigate to URL
    │ └── Inject script
    │
    ├─────────────────────────────────────────────────────────────────────
    │ ROW 1
    │ ├── Step 1 (25-2025ms) + delay (1000-2000ms)
    │ ├── Step 2 (25-2025ms) + delay (1000-2000ms)
    │ ├── Step 3 (25-2025ms) + delay (1000-2000ms)
    │ └── ...
    │
    ├─────────────────────────────────────────────────────────────────────
    │ ROW 2
    │ ├── (Navigate to start URL)
    │ ├── Step 1...
    │ └── ...
    │
    ├─────────────────────────────────────────────────────────────────────
    │ CLEANUP (100-500ms)
    │ ├── Save results
    │ └── Update UI
    │
    └─────────────────────────────────────────────────────────────────────
                                                                    Complete
```

---

## 5. Data Structures

### 5.1 Test Configuration

```typescript
interface TestConfig {
  project: Project;
  csvData: Record<string, string>[];
  fieldMappings: FieldMapping[];
  options: ExecutionOptions;
}

interface ExecutionOptions {
  stopOnFirstFailure: boolean;  // Default: false
  delayBetweenSteps: number;    // Default: 1000-2000ms (random)
  timeout: number;               // Default: 30000ms per step
  retryCount: number;            // Default: 0 (future)
}
```

### 5.2 Execution State

```typescript
interface ExecutionState {
  isRunning: boolean;
  progress: number;              // 0-100
  currentRow: number;
  currentStep: number;
  logs: LogEntry[];
  stepStatuses: StepStatus[];
}

interface LogEntry {
  timestamp: string;             // HH:mm:ss format
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface StepStatus {
  stepNumber: number;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;              // Milliseconds
  error_message: string | null;
}
```

### 5.3 Test Run Result

```typescript
interface TestRunResult {
  id?: number;                   // Assigned by DB
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time: string;            // ISO timestamp
  end_time?: string;             // ISO timestamp
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  test_results: StepResult[];
  logs: string;                  // Serialized log entries
}

interface StepResult {
  stepNumber: number;
  rowIndex: number;
  success: boolean;
  duration: number;
  error?: string;
  value?: string;                // Injected value (for debugging)
}
```

---

## 6. Tab Management

### 6.1 Opening Tabs

```typescript
async function openTestTab(targetUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'openTab',
        url: targetUrl
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.success && response.tabId) {
          resolve(response.tabId);
        } else {
          reject(new Error(response.error || 'Failed to open tab'));
        }
      }
    );
  });
}
```

### 6.2 Script Injection Wait

```typescript
async function waitForContentScript(tabId: number, timeout: number = 5000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      if (response === 'pong') {
        return;
      }
    } catch {
      // Script not ready yet
    }
    
    await sleep(100);
  }
  
  throw new Error('Content script did not respond in time');
}
```

### 6.3 Tab Reuse Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TAB MANAGEMENT STRATEGY                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CURRENT IMPLEMENTATION:                                                │
│  ├── Single tab opened at start of test                                 │
│  ├── Same tab reused for all CSV rows                                   │
│  ├── Navigate to target_url before each row                             │
│  └── Tab closed manually by user (not auto-closed)                      │
│                                                                         │
│  ASSUMPTIONS:                                                           │
│  ├── Content script persists across navigations                         │
│  ├── Tab state doesn't affect next row execution                        │
│  └── User doesn't close tab during test                                 │
│                                                                         │
│  RISKS:                                                                 │
│  ├── Cookies/localStorage accumulate between rows                       │
│  ├── Memory leaks from repeated page loads                              │
│  └── Previous row's state may affect next row                           │
│                                                                         │
│  FUTURE: Tab pool with fresh tabs per row (configurable)                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. CSV Row Processing

### 7.1 Row Iteration Logic

```typescript
async function processRows(
  csvData: Record<string, string>[],
  steps: RecordedStep[],
  mappings: FieldMapping[],
  tabId: number
): Promise<RowResult[]> {
  // If no CSV data, create single empty row for one-time execution
  const rowsToProcess = csvData.length > 0 ? csvData : [{}];
  
  const results: RowResult[] = [];
  
  for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
    // Check for stop signal
    if (!isRunningRef.current) {
      addLog('warning', 'Test stopped by user');
      break;
    }
    
    const row = rowsToProcess[rowIndex];
    
    addLog('info', `Starting row ${rowIndex + 1} of ${rowsToProcess.length}`);
    
    // Execute all steps for this row
    const rowResult = await executeRowSteps(row, steps, mappings, tabId, rowIndex);
    results.push(rowResult);
    
    addLog('info', 
      `Row ${rowIndex + 1} completed: ${rowResult.passed} passed, ${rowResult.failed} failed`
    );
    
    // Navigate back to start URL for next row (if not last)
    if (rowIndex < rowsToProcess.length - 1) {
      await navigateToStartUrl(tabId);
    }
  }
  
  return results;
}
```

### 7.2 Row Validation

```typescript
function shouldProcessRow(
  row: Record<string, string>,
  mappings: FieldMapping[]
): boolean {
  // Skip row if no CSV keys match any step labels or mappings
  const rowKeys = Object.keys(row);
  
  if (rowKeys.length === 0) {
    return true; // Empty row = single execution without data
  }
  
  // Check if any key matches
  const mappedLabels = mappings.map(m => m.inputvarfields);
  const hasMatch = rowKeys.some(key =>
    mappedLabels.includes(key) || 
    steps.some(s => s.label.toLowerCase().includes(key.toLowerCase()))
  );
  
  if (!hasMatch) {
    addLog('warning', `Row has no matching fields, skipping`);
    return false;
  }
  
  return true;
}
```

---

## 8. Step Sequencing

### 8.1 Step Execution Loop

```typescript
async function executeRowSteps(
  row: Record<string, string>,
  steps: RecordedStep[],
  mappings: FieldMapping[],
  tabId: number,
  rowIndex: number
): Promise<RowResult> {
  let passed = 0;
  let failed = 0;
  const stepResults: StepResult[] = [];
  
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    // Check for stop signal
    if (!isRunningRef.current) {
      break;
    }
    
    const step = steps[stepIndex];
    
    // Update UI: step is running
    updateStepStatus(stepIndex, 'running');
    addLog('info', `Executing step ${stepIndex + 1}: ${step.label}`);
    
    const startTime = Date.now();
    
    try {
      // Inject CSV value if applicable
      const injectedValue = getInjectedValue(step, row, mappings);
      
      // Execute step
      const success = await executeStep(tabId, step, injectedValue);
      
      const duration = Date.now() - startTime;
      
      if (success) {
        passed++;
        updateStepStatus(stepIndex, 'passed', duration);
        addLog('success', `✓ Step ${stepIndex + 1} completed (${duration}ms)`);
      } else {
        failed++;
        updateStepStatus(stepIndex, 'failed', duration, 'Step returned failure');
        addLog('error', `✗ Step ${stepIndex + 1} failed (${duration}ms)`);
      }
      
      stepResults.push({
        stepNumber: stepIndex + 1,
        rowIndex,
        success,
        duration,
        value: injectedValue
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      failed++;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateStepStatus(stepIndex, 'failed', duration, errorMessage);
      addLog('error', `✗ Step ${stepIndex + 1} error: ${errorMessage}`);
      
      stepResults.push({
        stepNumber: stepIndex + 1,
        rowIndex,
        success: false,
        duration,
        error: errorMessage
      });
    }
    
    // Update progress
    const progress = ((stepIndex + 1) / steps.length) * 100;
    setProgress(progress);
    
    // Random delay between steps (1-2 seconds)
    if (stepIndex < steps.length - 1) {
      const delay = 1000 + Math.random() * 1000;
      await sleep(delay);
    }
  }
  
  return { passed, failed, stepResults };
}
```

### 8.2 Step Execution Message

```typescript
async function executeStep(
  tabId: number,
  step: RecordedStep,
  injectedValue?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const stepData = {
      event: step.event,
      path: step.bundle?.xpath,
      value: injectedValue ?? step.value,
      selector: step.selector,
      label: step.label,
      x: step.bundle?.bounding?.x,
      y: step.bundle?.bounding?.y,
      bundle: step.bundle
    };
    
    chrome.tabs.sendMessage(
      tabId,
      {
        type: 'runStep',
        data: stepData
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Step message error:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        resolve(response === true);
      }
    );
  });
}
```

---

## 9. Value Injection

### 9.1 Mapping Lookup

```typescript
function buildMappingLookup(
  fieldMappings: FieldMapping[]
): Record<string, string> {
  const lookup: Record<string, string> = {};
  
  for (const mapping of fieldMappings) {
    if (mapping.mapped && mapping.field_name && mapping.inputvarfields) {
      // CSV column name → Step label
      lookup[mapping.field_name] = mapping.inputvarfields;
    }
  }
  
  return lookup;
}

// Example:
// Input: [{ field_name: 'email', inputvarfields: 'Type in Email field', mapped: true }]
// Output: { 'email': 'Type in Email field' }
```

### 9.2 Value Resolution

```typescript
function getInjectedValue(
  step: RecordedStep,
  row: Record<string, string>,
  mappings: FieldMapping[]
): string | undefined {
  const mappingLookup = buildMappingLookup(mappings);
  
  // Strategy 1: Direct label match with CSV column
  // If step.label matches a CSV column name
  for (const [csvColumn, value] of Object.entries(row)) {
    if (step.label.toLowerCase().includes(csvColumn.toLowerCase())) {
      return value;
    }
  }
  
  // Strategy 2: Use field mapping
  // If step.label matches a mapped field
  for (const [csvColumn, stepLabel] of Object.entries(mappingLookup)) {
    if (step.label === stepLabel && row[csvColumn] !== undefined) {
      return row[csvColumn];
    }
  }
  
  // Strategy 3: No injection, use original value
  return undefined;
}
```

### 9.3 Value Injection Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VALUE INJECTION FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CSV Row: { email: "test@example.com", password: "secret123" }          │
│                                                                         │
│  Field Mappings:                                                        │
│  ├── email → "Type in Email field"                                      │
│  └── password → "Type in Password field"                                │
│                                                                         │
│  Step: { label: "Type in Email field", event: "input", value: "" }      │
│                                                                         │
│  Resolution:                                                            │
│  1. Check direct match: "Type in Email field" contains "email"? No      │
│  2. Check mapping: "Type in Email field" === mapping target? Yes        │
│  3. Get CSV value: row["email"] = "test@example.com"                    │
│                                                                         │
│  Result: Step executed with value = "test@example.com"                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Progress Tracking

### 10.1 Progress Calculation

```typescript
function calculateProgress(
  completedSteps: number,
  totalSteps: number,
  completedRows: number,
  totalRows: number
): number {
  // Progress = (completed steps across all rows) / (total steps × total rows)
  const stepsCompleted = (completedRows * totalSteps) + completedSteps;
  const stepsTotal = totalSteps * totalRows;
  
  return (stepsCompleted / stepsTotal) * 100;
}

// Simplified version (current implementation)
function calculateSimpleProgress(
  currentStepIndex: number,
  totalSteps: number
): number {
  return ((currentStepIndex + 1) / totalSteps) * 100;
}
```

### 10.2 Step Status Updates

```typescript
const updateStepStatus = (
  index: number,
  status: 'pending' | 'running' | 'passed' | 'failed',
  duration: number = 0,
  errorMessage: string | null = null
) => {
  setTestSteps(prev => prev.map((step, i) =>
    i === index
      ? { ...step, status, duration, error_message: errorMessage }
      : step
  ));
};
```

### 10.3 Progress UI State

```typescript
// State variables
const [progress, setProgress] = useState<number>(0);
const [testSteps, setTestSteps] = useState<StepStatus[]>([]);
const [logs, setLogs] = useState<LogEntry[]>([]);

// Initialize steps from recorded_steps
function initializeSteps(recordedSteps: RecordedStep[]): void {
  const initialSteps: StepStatus[] = recordedSteps.map((step, index) => ({
    stepNumber: index + 1,
    label: step.label,
    status: 'pending',
    duration: 0,
    error_message: null
  }));
  
  setTestSteps(initialSteps);
}
```

---

## 11. Error Handling

### 11.1 Error Levels

```typescript
enum ErrorLevel {
  STEP = 'STEP',           // Single step failed
  ROW = 'ROW',             // Entire row failed
  TAB = 'TAB',             // Tab crashed/closed
  ORCHESTRATOR = 'ORCHESTRATOR'  // Top-level failure
}

function handleError(
  error: Error,
  level: ErrorLevel,
  context: { stepIndex?: number; rowIndex?: number }
): void {
  const { stepIndex, rowIndex } = context;
  
  switch (level) {
    case ErrorLevel.STEP:
      addLog('error', `Step ${stepIndex! + 1} failed: ${error.message}`);
      // Continue to next step
      break;
      
    case ErrorLevel.ROW:
      addLog('error', `Row ${rowIndex! + 1} failed: ${error.message}`);
      // Continue to next row
      break;
      
    case ErrorLevel.TAB:
      addLog('error', `Tab error: ${error.message}`);
      // Try to recover or stop test
      break;
      
    case ErrorLevel.ORCHESTRATOR:
      addLog('error', `Test execution failed: ${error.message}`);
      // Stop entire test
      isRunningRef.current = false;
      break;
  }
}
```

### 11.2 Try-Catch Structure

```typescript
const runTest = async () => {
  try {
    // ORCHESTRATOR level try
    await initializeTest();
    
    for (const row of rowsToProcess) {
      try {
        // ROW level try
        for (const step of steps) {
          try {
            // STEP level try
            await executeStep(step);
          } catch (stepError) {
            handleError(stepError, ErrorLevel.STEP, { stepIndex });
            continue; // Continue to next step
          }
        }
      } catch (rowError) {
        handleError(rowError, ErrorLevel.ROW, { rowIndex });
        continue; // Continue to next row
      }
    }
    
  } catch (mainError) {
    handleError(mainError, ErrorLevel.ORCHESTRATOR, {});
  } finally {
    await cleanup();
  }
};
```

### 11.3 Recovery Strategies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ERROR RECOVERY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Error Type         │ Current Behavior     │ Future Enhancement         │
│  ───────────────────┼──────────────────────┼─────────────────────────── │
│  Step timeout       │ Log, mark failed     │ Retry with backoff         │
│  Element not found  │ Log, mark failed     │ Try alternate locator      │
│  Tab closed         │ Log, stop test       │ Open new tab, continue     │
│  Network error      │ Log, mark failed     │ Wait and retry             │
│  Script not ready   │ Log, stop test       │ Re-inject script           │
│  Unexpected error   │ Log, continue        │ Capture screenshot         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Result Collection

### 12.1 Aggregating Results

```typescript
function aggregateResults(rowResults: RowResult[]): TestRunResult {
  let totalPassed = 0;
  let totalFailed = 0;
  const allStepResults: StepResult[] = [];
  
  for (const row of rowResults) {
    totalPassed += row.passed;
    totalFailed += row.failed;
    allStepResults.push(...row.stepResults);
  }
  
  const status: TestRunResult['status'] = 
    totalFailed === 0 ? 'completed' : 'failed';
  
  return {
    project_id: currentProject.id!,
    status,
    start_time: testStartTime,
    end_time: new Date().toISOString(),
    total_steps: totalPassed + totalFailed,
    passed_steps: totalPassed,
    failed_steps: totalFailed,
    test_results: allStepResults,
    logs: JSON.stringify(logs)
  };
}
```

### 12.2 Saving Test Run

```typescript
async function saveTestRun(result: TestRunResult): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'createTestRun',
        payload: result
      },
      (response) => {
        if (response.success) {
          addLog('info', `Test run saved with ID: ${response.id}`);
          resolve(response.id);
        } else {
          addLog('error', `Failed to save test run: ${response.error}`);
          reject(new Error(response.error));
        }
      }
    );
  });
}
```

### 12.3 Result Statistics

```typescript
interface TestStatistics {
  totalRows: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  passRate: number;           // Percentage
  totalDuration: number;      // Milliseconds
  averageStepDuration: number;
  slowestStep: { index: number; duration: number };
  fastestStep: { index: number; duration: number };
}

function calculateStatistics(
  rowResults: RowResult[],
  startTime: number
): TestStatistics {
  const allSteps = rowResults.flatMap(r => r.stepResults);
  
  const passed = allSteps.filter(s => s.success).length;
  const failed = allSteps.filter(s => !s.success).length;
  const totalDuration = Date.now() - startTime;
  
  const durations = allSteps.map(s => s.duration);
  const sorted = [...durations].sort((a, b) => a - b);
  
  return {
    totalRows: rowResults.length,
    totalSteps: allSteps.length,
    passedSteps: passed,
    failedSteps: failed,
    skippedSteps: 0, // Future: track skipped
    passRate: (passed / allSteps.length) * 100,
    totalDuration,
    averageStepDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    slowestStep: {
      index: durations.indexOf(sorted[sorted.length - 1]),
      duration: sorted[sorted.length - 1]
    },
    fastestStep: {
      index: durations.indexOf(sorted[0]),
      duration: sorted[0]
    }
  };
}
```

---

## 13. Future Enhancements

### 13.1 Planned Improvements

| Enhancement | Priority | Phase | Description |
|-------------|----------|-------|-------------|
| Retry Logic | High | 1 | Retry failed steps with configurable attempts |
| Parallel Execution | High | 2 | Run multiple rows concurrently |
| Checkpointing | Medium | 2 | Resume from last completed row |
| Tab Pool | Medium | 2 | Manage multiple tabs efficiently |
| Adaptive Delays | Medium | 2 | Dynamic delays based on page load |
| Result Analytics | Low | 3 | Trending, heatmaps, comparisons |
| Export Results | Low | 3 | CSV/PDF export of test results |

### 13.2 Refactored Architecture (Future)

```typescript
// Separate concerns into focused classes

class TestOrchestrator {
  private executor: TestExecutor;
  private tabManager: TabManager;
  private resultCollector: ResultCollector;
  private progressReporter: ProgressReporter;
  
  async run(config: TestConfig): Promise<TestRunResult> {
    // Coordinate all components
  }
  
  pause(): void { /* ... */ }
  resume(): void { /* ... */ }
  stop(): void { /* ... */ }
}

class TestExecutor {
  async executeRow(row: CSVRow, steps: Step[], tabId: number): Promise<RowResult> {
    // Execute all steps for one row
  }
  
  async executeStep(step: Step, value: string, tabId: number): Promise<StepResult> {
    // Execute single step with retry
  }
}

class TabManager {
  private pool: Map<number, TabState>;
  
  async acquire(): Promise<number> { /* ... */ }
  release(tabId: number): void { /* ... */ }
  cleanup(): void { /* ... */ }
}

class ResultCollector {
  private results: RowResult[] = [];
  
  add(result: RowResult): void { /* ... */ }
  aggregate(): TestRunResult { /* ... */ }
  getStatistics(): TestStatistics { /* ... */ }
}
```

---

## Summary

The Test Orchestrator provides:

✅ Complete execution coordination from start to finish  
✅ CSV row iteration with data-driven testing  
✅ Step sequencing with proper timing  
✅ Value injection from CSV to steps  
✅ Progress tracking with real-time updates  
✅ Error handling at multiple levels  
✅ Result collection and persistence  
✅ Tab management through background service  

This is the most complex subsystem requiring careful attention during implementation due to its coordination of multiple async operations across different browser contexts.
