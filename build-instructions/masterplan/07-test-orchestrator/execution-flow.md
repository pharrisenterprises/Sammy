# Test Execution Flow
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Lifecycle States
3. Initialization Phase
4. Tab Setup Phase
5. Row Iteration Phase
6. Step Execution Phase
7. Cleanup Phase
8. Control Operations
9. State Management
10. Timing and Delays
11. Implementation Reference
12. Testing the Flow

---

## 1. Overview

### 1.1 Purpose

This document details the complete execution flow of a test run, from user initiation through completion. It covers each phase, the state transitions, and the async coordination required.

### 1.2 Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXECUTION FLOW PHASES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐          │
│   │          │   │          │   │          │   │          │          │
│   │   INIT   │──▶│   TAB    │──▶│   ROW    │──▶│  CLEANUP │          │
│   │          │   │  SETUP   │   │ ITERATE  │   │          │          │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘          │
│        │              │              │              │                  │
│        │              │              │              │                  │
│   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐            │
│   │Validate │    │Open Tab │   │For Each │   │  Save   │            │
│   │Project  │    │Navigate │   │  Row:   │   │Results  │            │
│   │Reset UI │    │Inject   │   │ Execute │   │Update   │            │
│   │Build    │    │Script   │   │  Steps  │   │History  │            │
│   │Mappings │    │         │   │         │   │         │            │
│   └─────────┘    └─────────┘   └─────────┘   └─────────┘            │
│                                                                         │
│   Duration:       ~100ms       ~2000ms      Variable      ~500ms      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Lifecycle States

### 2.1 State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TEST LIFECYCLE STATES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ┌─────────┐                                         │
│                    │  IDLE   │◄───────────────────┐                    │
│                    └────┬────┘                    │                    │
│                         │                         │                    │
│                    runTest()                      │                    │
│                         │                         │                    │
│                         ▼                         │                    │
│                    ┌─────────┐                    │                    │
│              ┌───▶│  INIT   │                     │                    │
│              │    └────┬────┘                     │                    │
│              │         │                          │                    │
│              │    success                         │                    │
│              │         │                          │                    │
│         error│         ▼                          │                    │
│         ─────┘    ┌─────────┐◄──────┐            │                    │
│                   │ RUNNING │       │            │                    │
│                   └────┬────┘       │            │                    │
│                        │            │            │                    │
│          ┌──────────────┼────────────┼────────────┤                    │
│          │              │            │            │                    │
│          ▼              ▼            │            │                    │
│     ┌─────────┐    ┌─────────┐  ┌────┴────┐      │                    │
│     │ PAUSED  │    │ STOPPED │  │COMPLETE │      │                    │
│     └────┬────┘    └────┬────┘  └────┬────┘      │                    │
│          │              │            │            │                    │
│     resume()            │            │            │                    │
│          └─────────────┼─────────────┼───────────┘                    │
│                        │             │                                 │
│                        ▼             ▼                                 │
│                  ┌─────────────────────┐                               │
│                  │      CLEANUP        │                               │
│                  └──────────┬──────────┘                               │
│                             │                                          │
│                             ▼                                          │
│                        ┌─────────┐                                     │
│                        │  IDLE   │                                     │
│                        └─────────┘                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 State Definitions

```typescript
enum TestState {
  IDLE = 'IDLE',           // No test running, ready to start
  INIT = 'INIT',           // Validating, setting up
  RUNNING = 'RUNNING',     // Executing steps
  PAUSED = 'PAUSED',       // Temporarily halted (future)
  STOPPED = 'STOPPED',     // User requested stop
  COMPLETE = 'COMPLETE',   // All steps finished
  ERROR = 'ERROR'          // Unrecoverable error occurred
}

interface TestLifecycle {
  state: TestState;
  startTime?: number;
  endTime?: number;
  currentRow: number;
  currentStep: number;
  error?: Error;
}
```

### 2.3 State Transitions

| From     | To       | Trigger          | Action              |
|----------|----------|------------------|---------------------|
| IDLE     | INIT     | runTest()        | Begin validation    |
| INIT     | RUNNING  | Validation success| Start execution    |
| INIT     | ERROR    | Validation failure| Show error         |
| RUNNING  | RUNNING  | Step complete    | Execute next step   |
| RUNNING  | PAUSED   | pauseTest()      | Halt at current step|
| RUNNING  | STOPPED  | stopTest()       | Abort execution     |
| RUNNING  | COMPLETE | All steps done   | Begin cleanup       |
| RUNNING  | ERROR    | Unhandled exception| Begin cleanup     |
| PAUSED   | RUNNING  | resumeTest()     | Continue from step  |
| PAUSED   | STOPPED  | stopTest()       | Abort execution     |
| STOPPED  | IDLE     | Cleanup done     | Reset UI            |
| COMPLETE | IDLE     | Cleanup done     | Show results        |
| ERROR    | IDLE     | Cleanup done     | Show error          |

---

## 3. Initialization Phase

### 3.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INITIALIZATION PHASE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: User clicks "Run Test" button                                  │
│  Duration: ~50-100ms                                                    │
│  Output: Validated config, reset UI, ready for tab setup               │
│                                                                         │
│  Steps:                                                                 │
│  1. Validate project is selected                                       │
│  2. Validate project has recorded_steps                                │
│  3. Validate project has target_url                                    │
│  4. Set isRunningRef = true                                            │
│  5. Reset progress to 0%                                               │
│  6. Clear previous logs                                                │
│  7. Initialize step statuses to 'pending'                              │
│  8. Build mapping lookup from parsed_fields                            │
│  9. Determine rows to process (CSV or empty row)                       │
│  10. Log "Starting test execution..."                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Implementation

```typescript
async function initializeTest(): Promise<TestInitResult> {
  // Step 1-3: Validation
  if (!currentProject) {
    throw new InitializationError('No project selected');
  }
  
  const { recorded_steps, target_url, csv_data, parsed_fields } = currentProject;
  
  if (!recorded_steps || recorded_steps.length === 0) {
    throw new InitializationError('Project has no recorded steps');
  }
  
  if (!target_url) {
    throw new InitializationError('Project has no target URL');
  }
  
  // Validate URL format
  try {
    new URL(target_url);
  } catch {
    throw new InitializationError(`Invalid target URL: ${target_url}`);
  }
  
  // Step 4: Set running flag
  isRunningRef.current = true;
  setIsRunning(true);
  
  // Step 5-6: Reset UI state
  setProgress(0);
  setLogs([]);
  setActiveTab('console');
  
  // Step 7: Initialize step statuses
  const initialSteps: StepStatus[] = recorded_steps.map((step, index) => ({
    stepNumber: index + 1,
    label: step.label,
    status: 'pending',
    duration: 0,
    error_message: null
  }));
  setTestSteps(initialSteps);
  
  // Step 8: Build mapping lookup
  const mappingLookup: Record<string, string> = {};
  if (parsed_fields && parsed_fields.length > 0) {
    for (const mapping of parsed_fields) {
      if (mapping.mapped && mapping.field_name && mapping.inputvarfields) {
        mappingLookup[mapping.field_name] = mapping.inputvarfields;
      }
    }
  }
  
  // Step 9: Determine rows to process
  const rowsToProcess = (csv_data && csv_data.length > 0)
    ? csv_data
    : [{}]; // Single empty row if no CSV
  
  // Step 10: Log start
  addLog('info', `Starting test execution with ${rowsToProcess.length} row(s)`);
  addLog('info', `Project: ${currentProject.name}`);
  addLog('info', `Steps: ${recorded_steps.length}`);
  
  return {
    steps: recorded_steps,
    targetUrl: target_url,
    rows: rowsToProcess,
    mappings: mappingLookup
  };
}

interface TestInitResult {
  steps: RecordedStep[];
  targetUrl: string;
  rows: Record<string, string>[];
  mappings: Record<string, string>;
}

class InitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitializationError';
  }
}
```

### 3.3 Validation Rules

```typescript
interface ValidationRule {
  check: () => boolean;
  errorMessage: string;
  severity: 'error' | 'warning';
}

const validationRules: ValidationRule[] = [
  {
    check: () => !!currentProject,
    errorMessage: 'No project selected',
    severity: 'error'
  },
  {
    check: () => currentProject?.recorded_steps?.length > 0,
    errorMessage: 'Project has no recorded steps',
    severity: 'error'
  },
  {
    check: () => !!currentProject?.target_url,
    errorMessage: 'Project has no target URL',
    severity: 'error'
  },
  {
    check: () => {
      try {
        new URL(currentProject?.target_url || '');
        return true;
      } catch {
        return false;
      }
    },
    errorMessage: 'Invalid target URL format',
    severity: 'error'
  },
  {
    check: () => !currentProject?.csv_data?.length || 
                 currentProject.parsed_fields?.some(f => f.mapped),
    errorMessage: 'CSV data present but no field mappings configured',
    severity: 'warning'
  }
];

function validateProject(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const rule of validationRules) {
    if (!rule.check()) {
      if (rule.severity === 'error') {
        errors.push(rule.errorMessage);
      } else {
        warnings.push(rule.errorMessage);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## 4. Tab Setup Phase

### 4.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TAB SETUP PHASE                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: Target URL from project                                        │
│  Duration: ~500-2000ms (depends on page load)                          │
│  Output: Tab ID with content script ready                              │
│                                                                         │
│  Steps:                                                                 │
│  1. Send "openTab" message to background service                       │
│  2. Background creates new tab with target URL                         │
│  3. Background injects content script                                  │
│  4. Wait for page to finish loading                                    │
│  5. Verify content script is responsive (ping/pong)                    │
│  6. Log "Tab ready for testing"                                        │
│                                                                         │
│  Error Handling:                                                       │
│  - Tab creation failure → Abort test                                   │
│  - Navigation failure → Retry once, then abort                         │
│  - Script injection failure → Retry once, then abort                   │
│  - Script not responsive → Wait longer, then abort                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Implementation

```typescript
async function setupTestTab(targetUrl: string): Promise<number> {
  addLog('info', `Opening tab: ${targetUrl}`);
  
  // Step 1-3: Open tab via background
  const tabId = await openTab(targetUrl);
  addLog('info', `Tab created with ID: ${tabId}`);
  
  // Step 4-5: Wait for content script
  await waitForContentScript(tabId);
  addLog('info', 'Content script ready');
  
  return tabId;
}

async function openTab(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tab creation timed out'));
    }, 10000); // 10 second timeout
    
    chrome.runtime.sendMessage(
      {
        action: 'openTab',
        url: url
      },
      (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response?.success && response?.tabId) {
          resolve(response.tabId);
        } else {
          reject(new Error(response?.error || 'Failed to open tab'));
        }
      }
    );
  });
}

async function waitForContentScript(
  tabId: number,
  timeout: number = 10000
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 200;
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await sendTabMessage(tabId, { type: 'ping' });
      
      if (response === 'pong') {
        return; // Script is ready
      }
    } catch (error) {
      // Script not ready yet, continue polling
    }
    
    await sleep(pollInterval);
  }
  
  throw new Error(`Content script did not respond within ${timeout}ms`);
}

function sendTabMessage(tabId: number, message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
```

### 4.3 Tab Navigation

```typescript
async function navigateTab(tabId: number, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'navigateTab',
        tabId: tabId,
        url: url
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || 'Navigation failed'));
        }
      }
    );
  });
}

async function navigateToStartUrl(tabId: number): Promise<void> {
  const { target_url } = currentProject!;
  
  addLog('info', `Navigating to start URL: ${target_url}`);
  await navigateTab(tabId, target_url);
  
  // Wait for page load and script ready
  await sleep(1000); // Allow page to settle
  await waitForContentScript(tabId, 5000);
  
  addLog('info', 'Page ready for next row');
}
```

---

## 5. Row Iteration Phase

### 5.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROW ITERATION PHASE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: CSV rows (or single empty row), steps, mappings, tabId         │
│  Duration: Variable (rows × steps × avg_step_time)                     │
│  Output: Aggregated results for all rows                               │
│                                                                         │
│  For each row:                                                          │
│  1. Check isRunningRef (stop if false)                                 │
│  2. Log "Starting row X of Y"                                          │
│  3. Validate row has matching fields (optional)                        │
│  4. Execute all steps for this row                                     │
│  5. Log row summary                                                    │
│  6. Navigate back to start URL (if not last row)                       │
│  7. Update overall progress                                            │
│                                                                         │
│  Stop Conditions:                                                      │
│  - isRunningRef becomes false (user stop)                              │
│  - Unrecoverable error (tab closed, etc.)                              │
│  - All rows processed                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Implementation

```typescript
async function iterateRows(
  rows: Record<string, string>[],
  steps: RecordedStep[],
  mappings: Record<string, string>,
  tabId: number
): Promise<TestRunResult> {
  const startTime = Date.now();
  const allResults: RowResult[] = [];
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    // Step 1: Check for stop signal
    if (!isRunningRef.current) {
      addLog('warning', 'Test execution stopped by user');
      break;
    }
    
    const row = rows[rowIndex];
    
    // Step 2: Log row start
    addLog('info', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    addLog('info', `Starting row ${rowIndex + 1} of ${rows.length}`);
    
    // Log row data (if not empty)
    if (Object.keys(row).length > 0) {
      const rowPreview = Object.entries(row)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${v.substring(0, 20)}${v.length > 20 ? '...' : ''}`)
        .join(', ');
      addLog('info', `Row data: ${rowPreview}`);
    }
    
    // Step 3: Validate row (optional - warn but continue)
    const hasMatchingFields = validateRowFields(row, steps, mappings);
    if (!hasMatchingFields && Object.keys(row).length > 0) {
      addLog('warning', 'Row has no matching field mappings');
    }
    
    // Step 4: Execute steps for this row
    const rowResult = await executeRowSteps(
      row,
      steps,
      mappings,
      tabId,
      rowIndex
    );
    
    allResults.push(rowResult);
    
    // Step 5: Log row summary
    addLog('info', 
      `Row ${rowIndex + 1} complete: ` +
      `${rowResult.passed} passed, ${rowResult.failed} failed`
    );
    
    // Step 6: Navigate back to start URL for next row
    if (rowIndex < rows.length - 1 && isRunningRef.current) {
      addLog('info', 'Preparing for next row...');
      await navigateToStartUrl(tabId);
    }
    
    // Step 7: Update overall progress (row-level)
    const overallProgress = ((rowIndex + 1) / rows.length) * 100;
    // Note: Step-level progress updates happen in executeRowSteps
  }
  
  // Aggregate results
  return aggregateResults(allResults, startTime);
}

interface RowResult {
  rowIndex: number;
  passed: number;
  failed: number;
  skipped: number;
  stepResults: StepResult[];
}

function validateRowFields(
  row: Record<string, string>,
  steps: RecordedStep[],
  mappings: Record<string, string>
): boolean {
  if (Object.keys(row).length === 0) {
    return true; // Empty row is valid (no-data mode)
  }
  
  // Check if any CSV column matches a mapping or step label
  for (const csvColumn of Object.keys(row)) {
    // Check direct mapping
    if (mappings[csvColumn]) {
      return true;
    }
    
    // Check step labels
    for (const step of steps) {
      if (step.label.toLowerCase().includes(csvColumn.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}
```

### 5.3 Row Processing Patterns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROW PROCESSING PATTERNS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PATTERN 1: Single execution (no CSV)                                  │
│  ───────────────────────────────────────                               │
│  csv_data = []                                                          │
│  rowsToProcess = [{}]  // One empty row                                │
│  Result: Steps executed once with original values                      │
│                                                                         │
│  PATTERN 2: Data-driven testing                                        │
│  ───────────────────────────────────────                               │
│  csv_data = [                                                           │
│    { email: "a@test.com", pass: "123" },                               │
│    { email: "b@test.com", pass: "456" }                                │
│  ]                                                                      │
│  Result: Steps executed twice, with different values each time         │
│                                                                         │
│  PATTERN 3: Partial mapping                                            │
│  ───────────────────────────────────────                               │
│  csv_data = [{ email: "a@test.com" }]  // No password column           │
│  mappings = { email: "Type in Email" }  // Only email mapped           │
│  Result: Email injected, password uses recorded value                  │
│                                                                         │
│  PATTERN 4: Column name mismatch                                       │
│  ───────────────────────────────────────                               │
│  csv_data = [{ user_email: "a@test.com" }]                             │
│  mappings = { email: "Type in Email" }  // user_email not mapped       │
│  Result: Warning logged, no value injection occurs                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Step Execution Phase

### 6.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP EXECUTION PHASE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: Single step, current row data, mappings, tabId                 │
│  Duration: 25-2025ms per step + delay                                  │
│  Output: StepResult with success/failure                               │
│                                                                         │
│  For each step:                                                         │
│  1. Check isRunningRef (stop if false)                                 │
│  2. Update step status to "running"                                    │
│  3. Resolve injected value from CSV                                    │
│  4. Build step payload with bundle                                     │
│  5. Send "runStep" message to content script                           │
│  6. Wait for response                                                  │
│  7. Update step status (passed/failed)                                 │
│  8. Log result                                                         │
│  9. Update progress percentage                                         │
│  10. Add random delay before next step                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Implementation

```typescript
async function executeRowSteps(
  row: Record<string, string>,
  steps: RecordedStep[],
  mappings: Record<string, string>,
  tabId: number,
  rowIndex: number
): Promise<RowResult> {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const stepResults: StepResult[] = [];
  
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    // Step 1: Check for stop signal
    if (!isRunningRef.current) {
      // Mark remaining steps as skipped
      skipped = steps.length - stepIndex;
      break;
    }
    
    const step = steps[stepIndex];
    const stepStartTime = Date.now();
    
    // Step 2: Update UI to "running"
    updateStepStatus(stepIndex, 'running');
    
    try {
      // Step 3: Resolve injected value
      const injectedValue = resolveStepValue(step, row, mappings);
      
      // Log with value info
      if (injectedValue !== undefined) {
        addLog('info', 
          `Step ${stepIndex + 1}: ${step.label} [value: "${injectedValue.substring(0, 30)}${injectedValue.length > 30 ? '...' : ''}"]`
        );
      } else {
        addLog('info', `Step ${stepIndex + 1}: ${step.label}`);
      }
      
      // Step 4-6: Execute step
      const success = await executeStep(tabId, step, injectedValue);
      
      const duration = Date.now() - stepStartTime;
      
      // Step 7-8: Update status and log
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
      const duration = Date.now() - stepStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      failed++;
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
    
    // Step 9: Update progress
    const stepProgress = ((stepIndex + 1) / steps.length) * 100;
    setProgress(stepProgress);
    
    // Step 10: Add delay before next step
    if (stepIndex < steps.length - 1 && isRunningRef.current) {
      const delay = getStepDelay();
      await sleep(delay);
    }
  }
  
  return { rowIndex, passed, failed, skipped, stepResults };
}

async function executeStep(
  tabId: number,
  step: RecordedStep,
  injectedValue?: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Step execution timed out'));
    }, 30000); // 30 second timeout
    
    const stepPayload = {
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
        data: stepPayload
      },
      (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(response === true);
      }
    );
  });
}
```

### 6.3 Value Resolution

```typescript
function resolveStepValue(
  step: RecordedStep,
  row: Record<string, string>,
  mappings: Record<string, string>
): string | undefined {
  // Empty row = no injection
  if (Object.keys(row).length === 0) {
    return undefined;
  }
  
  // Strategy 1: Direct mapping lookup
  // If a CSV column is mapped to this step's label
  for (const [csvColumn, stepLabel] of Object.entries(mappings)) {
    if (step.label === stepLabel && row[csvColumn] !== undefined) {
      return row[csvColumn];
    }
  }
  
  // Strategy 2: Label contains CSV column name
  // If step label contains the column name (case-insensitive)
  for (const [csvColumn, value] of Object.entries(row)) {
    if (step.label.toLowerCase().includes(csvColumn.toLowerCase())) {
      return value;
    }
  }
  
  // Strategy 3: No match, use original value
  return undefined;
}
```

---

## 7. Cleanup Phase

### 7.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLEANUP PHASE                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: Execution results, test state                                  │
│  Duration: ~100-500ms                                                   │
│  Output: Saved test run, updated UI, reset state                       │
│                                                                         │
│  Steps:                                                                 │
│  1. Set isRunningRef = false                                           │
│  2. Set isRunning state = false                                        │
│  3. Calculate final statistics                                         │
│  4. Determine final status (completed/failed/stopped)                  │
│  5. Save test run to database                                          │
│  6. Log completion summary                                             │
│  7. Refresh test history in UI                                         │
│  8. Switch to results tab                                              │
│                                                                         │
│  Always runs (finally block):                                          │
│  - Even if test was stopped or errored                                 │
│  - Ensures state is properly reset                                     │
│  - Prevents stuck "running" state                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Implementation

```typescript
async function cleanupTest(
  results: TestRunResult,
  wasManualStop: boolean = false
): Promise<void> {
  // Step 1-2: Reset running state
  isRunningRef.current = false;
  setIsRunning(false);
  
  // Step 3: Calculate statistics
  const stats = calculateStatistics(results);
  
  // Step 4: Determine final status
  let finalStatus: TestRunResult['status'];
  if (wasManualStop) {
    finalStatus = 'stopped';
  } else if (results.failed_steps === 0) {
    finalStatus = 'completed';
  } else {
    finalStatus = 'failed';
  }
  
  results.status = finalStatus;
  results.end_time = new Date().toISOString();
  
  // Step 5: Save test run
  try {
    const testRunId = await saveTestRun(results);
    addLog('info', `Test run saved with ID: ${testRunId}`);
  } catch (saveError) {
    addLog('error', `Failed to save test run: ${saveError}`);
  }
  
  // Step 6: Log completion summary
  addLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  addLog('info', 'TEST EXECUTION COMPLETE');
  addLog('info', `Status: ${finalStatus.toUpperCase()}`);
  addLog('info', `Total steps: ${stats.totalSteps}`);
  addLog('info', `Passed: ${stats.passedSteps} (${stats.passRate.toFixed(1)}%)`);
  addLog('info', `Failed: ${stats.failedSteps}`);
  addLog('info', `Duration: ${formatDuration(stats.totalDuration)}`);
  addLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Step 7: Refresh test history
  if (currentProject?.id) {
    await loadTestHistory(currentProject.id);
  }
  
  // Step 8: Switch to results tab
  setActiveTab('results');
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

interface TestStatistics {
  totalRows: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  passRate: number;
  totalDuration: number;
}

function calculateStatistics(results: TestRunResult): TestStatistics {
  return {
    totalRows: 1, // Future: track actual rows
    totalSteps: results.total_steps,
    passedSteps: results.passed_steps,
    failedSteps: results.failed_steps,
    passRate: results.total_steps > 0 
      ? (results.passed_steps / results.total_steps) * 100 
      : 0,
    totalDuration: results.end_time 
      ? new Date(results.end_time).getTime() - new Date(results.start_time).getTime()
      : 0
  };
}
```

---

## 8. Control Operations

### 8.1 Stop Test

```typescript
function stopTest(): void {
  // Immediate flag set (ref for synchronous check)
  isRunningRef.current = false;
  
  // State update (async, triggers re-render)
  setIsRunning(false);
  
  // Log
  addLog('warning', '⚠ Test execution stopped by user');
  
  // Note: Actual cleanup happens in finally block of runTest()
  // Current step will complete, then loop exits
}
```

### 8.2 Reset Test

```typescript
function resetTest(): void {
  // Stop if running
  if (isRunningRef.current) {
    stopTest();
  }
  
  // Reset all state
  setProgress(0);
  setLogs([]);
  setTestSteps([]);
  setActiveTab('console');
  
  addLog('info', 'Test execution reset');
}
```

### 8.3 Pause/Resume (Future)

```typescript
// Future implementation
const isPausedRef = useRef<boolean>(false);

function pauseTest(): void {
  if (!isRunningRef.current) return;
  
  isPausedRef.current = true;
  addLog('info', '⏸ Test paused');
}

function resumeTest(): void {
  if (!isPausedRef.current) return;
  
  isPausedRef.current = false;
  addLog('info', '▶ Test resumed');
}

// In step loop:
async function waitIfPaused(): Promise<void> {
  while (isPausedRef.current && isRunningRef.current) {
    await sleep(100);
  }
}
```

---

## 9. State Management

### 9.1 State Variables

```typescript
// Running state (dual tracking)
const [isRunning, setIsRunning] = useState<boolean>(false);
const isRunningRef = useRef<boolean>(false);
// Why both? State for UI re-renders, ref for immediate sync checks in loops

// Progress
const [progress, setProgress] = useState<number>(0);  // 0-100

// Logs
const [logs, setLogs] = useState<LogEntry[]>([]);

// Step statuses
const [testSteps, setTestSteps] = useState<StepStatus[]>([]);

// Active tab in UI
const [activeTab, setActiveTab] = useState<'console' | 'steps' | 'results'>('console');

// Current project (from parent)
const [currentProject, setCurrentProject] = useState<Project | null>(null);

// Test history
const [testHistory, setTestHistory] = useState<TestRun[]>([]);
```

### 9.2 State Update Helpers

```typescript
const addLog = useCallback((
  level: LogEntry['level'],
  message: string
) => {
  const newLog: LogEntry = {
    timestamp: format(new Date(), 'HH:mm:ss'),
    level,
    message
  };
  
  setLogs(prev => [...prev, newLog]);
}, []);

const updateStepStatus = useCallback((
  index: number,
  status: StepStatus['status'],
  duration: number = 0,
  errorMessage: string | null = null
) => {
  setTestSteps(prev => prev.map((step, i) =>
    i === index
      ? { ...step, status, duration, error_message: errorMessage }
      : step
  ));
}, []);
```

### 9.3 State Synchronization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATE SYNCHRONIZATION                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WHY DUAL STATE TRACKING (isRunning + isRunningRef)?                   │
│                                                                         │
│  React state updates are asynchronous:                                 │
│  setIsRunning(false);  // Queued, not immediate                        │
│  if (isRunning) { }    // Still true! Not updated yet                  │
│                                                                         │
│  Refs are synchronous:                                                 │
│  isRunningRef.current = false;  // Immediate                           │
│  if (isRunningRef.current) { }  // False, correctly updated            │
│                                                                         │
│  Usage Pattern:                                                        │
│  - Use isRunning for UI display (button disabled state)                │
│  - Use isRunningRef.current for control flow (loop exit)               │
│  - Always update BOTH when changing running state                      │
│                                                                         │
│  Example:                                                              │
│  function stopTest() {                                                 │
│    isRunningRef.current = false;  // For immediate loop exit           │
│    setIsRunning(false);           // For UI update                     │
│  }                                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Timing and Delays

### 10.1 Delay Configuration

```typescript
interface TimingConfig {
  // Delays between actions
  stepDelay: {
    min: number;     // Minimum delay between steps (ms)
    max: number;     // Maximum delay between steps (ms)
  };
  
  // Timeouts
  tabCreationTimeout: number;   // Max time to create tab
  scriptReadyTimeout: number;   // Max time for script ping
  stepExecutionTimeout: number; // Max time per step
  navigationTimeout: number;    // Max time for page navigation
}

const DEFAULT_TIMING: TimingConfig = {
  stepDelay: {
    min: 1000,   // 1 second
    max: 2000    // 2 seconds
  },
  tabCreationTimeout: 10000,    // 10 seconds
  scriptReadyTimeout: 10000,    // 10 seconds
  stepExecutionTimeout: 30000,  // 30 seconds
  navigationTimeout: 15000      // 15 seconds
};
```

### 10.2 Delay Functions

```typescript
function getStepDelay(): number {
  const { min, max } = DEFAULT_TIMING.stepDelay;
  return min + Math.random() * (max - min);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Future: Adaptive delay based on page complexity
async function getAdaptiveDelay(tabId: number): Promise<number> {
  // Check if page is still loading
  const isLoading = await checkPageLoading(tabId);
  if (isLoading) {
    return 2000; // Longer delay if still loading
  }
  
  // Check for animations
  const hasAnimations = await checkAnimations(tabId);
  if (hasAnimations) {
    return 1500; // Medium delay for animations
  }
  
  // Default random delay
  return getStepDelay();
}
```

### 10.3 Timing Diagram

```
Time →
────────────────────────────────────────────────────────────────────────

Step 1 Start                    Step 1 End
    │                               │
    │◄────── Step Duration ────────▶│◄──── Delay ────▶│
    │        (25-2025ms)            │    (1000-2000ms) │
    │                               │                  │
    ├───────────────────────────────┼──────────────────┤
    │  Find element (25-2000ms)     │                  │
    │  Execute action (varies)      │  Random sleep    │
    │  Verify result                │                  │
    │                               │                  │
                                                       │
                                                  Step 2 Start
                                                       │
                                                       ├─────────...
```

---

## 11. Implementation Reference

### 11.1 Complete runTest Function

```typescript
const runTest = async () => {
  let testResults: TestRunResult | null = null;
  let wasManualStop = false;
  
  try {
    // === INITIALIZATION PHASE ===
    const initResult = await initializeTest();
    const { steps, targetUrl, rows, mappings } = initResult;
    
    // === TAB SETUP PHASE ===
    const tabId = await setupTestTab(targetUrl);
    
    // === ROW ITERATION PHASE ===
    testResults = await iterateRows(rows, steps, mappings, tabId);
    
  } catch (error) {
    // Handle initialization or tab errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    addLog('error', `Test execution failed: ${errorMessage}`);
    
    // Create minimal result for failed test
    testResults = {
      project_id: currentProject?.id || 0,
      status: 'failed',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      total_steps: 0,
      passed_steps: 0,
      failed_steps: 0,
      test_results: [],
      logs: JSON.stringify(logs)
    };
    
  } finally {
    // === CLEANUP PHASE ===
    wasManualStop = !isRunningRef.current && testResults?.status !== 'failed';
    
    if (testResults) {
      await cleanupTest(testResults, wasManualStop);
    } else {
      // Ensure state is reset even without results
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }
};
```

### 11.2 File Structure

```
src/pages/TestRunner.tsx
├── State declarations (lines 20-50)
├── Helper functions
│   ├── addLog (lines 60-70)
│   ├── updateStepStatus (lines 75-85)
│   ├── sleep (lines 90-92)
│   └── formatDuration (lines 95-105)
├── Initialization functions
│   ├── initializeTest (lines 110-180)
│   └── validateProject (lines 185-220)
├── Tab management
│   ├── setupTestTab (lines 225-250)
│   ├── openTab (lines 255-290)
│   ├── waitForContentScript (lines 295-325)
│   └── navigateToStartUrl (lines 330-350)
├── Execution functions
│   ├── iterateRows (lines 355-450)
│   ├── executeRowSteps (lines 455-550)
│   ├── executeStep (lines 555-600)
│   └── resolveStepValue (lines 605-640)
├── Cleanup functions
│   ├── cleanupTest (lines 645-720)
│   ├── saveTestRun (lines 725-755)
│   └── calculateStatistics (lines 760-780)
├── Control functions
│   ├── runTest (lines 785-850)
│   ├── stopTest (lines 855-865)
│   └── resetTest (lines 870-885)
└── Render (lines 890-1000)
```

---

## 12. Testing the Flow

### 12.1 Unit Test Scenarios

```typescript
describe('Test Execution Flow', () => {
  describe('Initialization Phase', () => {
    test('should reject if no project selected', async () => {
      currentProject = null;
      await expect(initializeTest()).rejects.toThrow('No project selected');
    });
    
    test('should reject if no recorded steps', async () => {
      currentProject = { ...mockProject, recorded_steps: [] };
      await expect(initializeTest()).rejects.toThrow('no recorded steps');
    });
    
    test('should build mapping lookup correctly', async () => {
      currentProject = {
        ...mockProject,
        parsed_fields: [
          { field_name: 'email', inputvarfields: 'Email Input', mapped: true }
        ]
      };
      const result = await initializeTest();
      expect(result.mappings).toEqual({ email: 'Email Input' });
    });
  });
  
  describe('Row Iteration', () => {
    test('should process single empty row when no CSV', async () => {
      currentProject = { ...mockProject, csv_data: [] };
      const result = await initializeTest();
      expect(result.rows).toEqual([{}]);
    });
    
    test('should stop when isRunningRef is false', async () => {
      // Start test
      runTest();
      // Immediately stop
      isRunningRef.current = false;
      // Should exit cleanly
    });
  });
  
  describe('Value Resolution', () => {
    test('should use mapping for injection', () => {
      const step = { label: 'Email Input' };
      const row = { email: 'test@example.com' };
      const mappings = { email: 'Email Input' };
      
      const value = resolveStepValue(step, row, mappings);
      expect(value).toBe('test@example.com');
    });
    
    test('should return undefined for empty row', () => {
      const step = { label: 'Email Input' };
      const row = {};
      const mappings = {};
      
      const value = resolveStepValue(step, row, mappings);
      expect(value).toBeUndefined();
    });
  });
});
```

### 12.2 Integration Test

```typescript
describe('Full Execution Flow', () => {
  test('should complete test with all steps passed', async () => {
    // Setup mock project
    currentProject = createMockProject({
      steps: [
        { label: 'Click button', event: 'click' },
        { label: 'Type email', event: 'input' }
      ],
      csv_data: [{ email: 'test@example.com' }]
    });
    
    // Mock chrome APIs
    mockChrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.action === 'openTab') {
        cb({ success: true, tabId: 123 });
      }
    });
    
    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, cb) => {
      if (msg.type === 'ping') cb('pong');
      if (msg.type === 'runStep') cb(true);
    });
    
    // Run test
    await runTest();
    
    // Verify results
    expect(logs.some(l => l.message.includes('TEST EXECUTION COMPLETE'))).toBe(true);
    expect(testSteps.every(s => s.status === 'passed')).toBe(true);
  });
});
```

---

## Summary

The Test Execution Flow document provides:

✅ Complete lifecycle states with transitions  
✅ Initialization phase with validation rules  
✅ Tab setup phase with script injection  
✅ Row iteration with multiple patterns  
✅ Step execution with value injection  
✅ Cleanup phase with result persistence  
✅ Control operations (stop, reset, future pause)  
✅ State management patterns  
✅ Timing and delays configuration  
✅ Implementation reference with file structure  
✅ Testing scenarios for validation  

This document enables developers to understand and implement the complete test execution flow.
