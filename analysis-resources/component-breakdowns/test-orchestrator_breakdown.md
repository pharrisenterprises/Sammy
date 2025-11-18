# TEST ORCHESTRATOR BREAKDOWN

## 1. Summary

The Test Orchestrator is the **execution coordination system** that manages end-to-end test runs. It opens browser tabs, injects content scripts, iterates through CSV data rows, sends replay commands, tracks progress, collects results, and stores execution history. This component orchestrates all other subsystems to achieve fully automated data-driven testing.

**Importance**: ⭐⭐⭐⭐⭐ (Critical - brings entire automation system together)

## 2. Primary Responsibilities

1. **Test Lifecycle Management**: Start, pause, stop, reset test execution
2. **Multi-Row Execution**: Iterate through CSV data rows sequentially
3. **Tab Coordination**: Open/close browser tabs, manage tab state
4. **Script Injection**: Ensure content scripts loaded before execution
5. **Step Sequencing**: Execute steps in order with proper timing
6. **Value Injection**: Map CSV values to step inputs using field mappings
7. **Progress Tracking**: Real-time progress percentage and step status
8. **Error Handling**: Catch failures, log errors, continue or abort
9. **Result Collection**: Aggregate passed/failed steps, execution time
10. **History Storage**: Persist test run results for analysis

## 3. Dependencies

### Files
- `src/pages/TestRunner.tsx` (809 lines) - Main orchestrator
- `src/components/Runner/TestConsole.tsx` - Log display
- `src/components/Runner/TestResults.tsx` - Results summary
- `src/components/Runner/TestSteps.tsx` - Step progress display

### Dependencies (Other Subsystems)
- **Background Service** → Tab management, script injection
- **Replay Engine** → Step execution via chrome.tabs.sendMessage
- **Storage Layer** → Load projects, save test runs
- **Field Mapper** → CSV-to-step associations

### Browser APIs
- `chrome.runtime.sendMessage()` - Message background service
- `chrome.tabs.sendMessage()` - Send replay commands to content script

## 4. Inputs / Outputs

### Inputs
- **Project Data**: Recorded steps, field mappings, target URL
- **CSV Data**: Array of data rows (or empty array for no-data mode)
- **Execution Config**: Timeout settings, retry behavior

### Outputs
- **Real-Time Logs**: Timestamped execution events (info, success, error, warning)
- **Step Status Updates**: Per-step progress (pending → running → passed/failed)
- **Test Run Results**: Saved to IndexedDB for history
  ```typescript
  {
    id: number,
    project_id: number,
    status: 'completed' | 'failed' | 'pending',
    start_time: string,
    end_time: string,
    total_steps: number,
    passed_steps: number,
    failed_steps: number,
    test_results: Array<StepResult>,
    logs: string
  }
  ```

### Message Protocol

**Open Tab**:
```typescript
const response = await chrome.runtime.sendMessage({
  action: "openTab",
  url: target_url
});
// Response: { success: boolean, tabId: number }
```

**Execute Step**:
```typescript
await chrome.tabs.sendMessage(tabId, {
  type: "runStep",
  data: {
    event, path, value, selector, label, x, y, bundle
  }
});
// Response: boolean (success)
```

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Storage Layer** → Loads project, steps, CSV data, field mappings
- **Background Service** → Opens tabs, injects scripts
- **Replay Engine** → Executes individual steps
- **Message Bus** → Sends commands, receives responses

### Dependents (Provides To)
- **Users** ← Visual feedback (progress, logs, results)
- **Storage Layer** ← Test run history for analytics

### Orchestration Flow
```
User clicks "Run Test"
  ↓
Load project data (steps, CSV, mappings)
  ↓
Validate data (check mappings, CSV presence)
  ↓
FOR EACH CSV ROW:
  ↓
  Open new tab (target_url)
  ↓
  Wait for content script injection
  ↓
  FOR EACH STEP:
    ↓
    Map CSV value to step (if applicable)
    ↓
    Send runStep message to content script
    ↓
    Wait for response (success/failure)
    ↓
    Update UI (progress bar, step status, logs)
    ↓
    Add random delay (1-2 seconds)
  ↓
  Close tab (optional)
  ↓
  Save test run results
```

## 6. Internal Structure

### Main Execution Loop (`TestRunner.tsx` lines 150-700)

#### Initialization
```typescript
const runTest = async () => {
  if (!currentProject) {
    addLog("warning", "No project selected");
    return;
  }
  
  // Setup
  isRunningRef.current = true;
  setIsRunning(true);
  setProgress(0);
  setLogs([]);
  setActiveTab("console");
  
  const { csv_data, recorded_steps, parsed_fields, target_url } = currentProject;
  
  // Validation
  if (!recorded_steps || !target_url) {
    addLog("error", "Missing required project data");
    throw new Error("Invalid project configuration");
  }
  
  // Build mapping lookup
  const mappingLookup: Record<string, string> = {};
  parsed_fields.forEach(mapObj => {
    if (mapObj.mapped && mapObj.field_name && mapObj.inputvarfields) {
      mappingLookup[mapObj.field_name] = mapObj.inputvarfields;
    }
  });
  
  // Determine rows to process
  const rowsToProcess = (csv_data && csv_data.length > 0) 
    ? csv_data 
    : [{}]; // Single empty row if no CSV
```

#### Row Iteration
```typescript
  for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
    if (!isRunningRef.current) break; // Stop button pressed
    
    const row = rowsToProcess[rowIndex];
    const rowKeys = Object.keys(row);
    
    // Initialize step status
    const steps = recorded_steps.map((s, index) => ({
      id: index + 1,
      name: `Interact with ${s.label}`,
      selector: s.selector,
      event: s.event,
      status: 'pending',
      duration: 0,
      error_message: null
    }));
    setTestSteps(steps);
    
    // Validate row (for CSV mode)
    if (csv_data && csv_data.length > 0) {
      const stepsLabels = recorded_steps.map(s => s.label);
      const isValidRow = rowKeys.some(key =>
        stepsLabels.includes(key) ||
        (mappingLookup[key] && stepsLabels.includes(mappingLookup[key]))
      );
      
      if (!isValidRow) {
        addLog("info", `Row ${rowIndex + 1} skipped - no matching fields`);
        continue;
      }
    }
    
    addLog("info", 
      csv_data && csv_data.length > 0
        ? `Starting row ${rowIndex + 1} of ${rowsToProcess.length}`
        : `Starting test execution`
    );
```

#### Tab Management
```typescript
    // Open new tab
    let tabId;
    try {
      const response = await chrome.runtime.sendMessage({
        action: "openTab",
        url: target_url
      });
      
      if (!response.success || !response.tabId) {
        throw new Error("Failed to open tab or inject content script");
      }
      
      tabId = response.tabId;
      addLog("info", `Tab ${tabId} opened successfully`);
    } catch (error) {
      addLog("error", `Tab open failed: ${error}`);
      continue; // Skip to next row
    }
```

#### Step Execution
```typescript
    // Clone steps for modification
    const testSteps = JSON.parse(JSON.stringify(recorded_steps));
    
    for (let stepIndex = 0; stepIndex < testSteps.length; stepIndex++) {
      if (!isRunningRef.current) break;
      
      const step = testSteps[stepIndex];
      step.status = "pending";
      
      try {
        // Value injection (CSV mode)
        if (step.event === "input" || step.event === "click") {
          let inputValue;
          
          if (csv_data && csv_data.length > 0) {
            // Direct match
            if (row[step.label] !== undefined) {
              inputValue = row[step.label];
            } 
            // Mapped match
            else {
              const mappedKey = Object.keys(mappingLookup).find(
                key => mappingLookup[key] === step.label
              );
              if (mappedKey && row[mappedKey] !== undefined) {
                inputValue = row[mappedKey];
              }
            }
            
            if (inputValue !== undefined) {
              step.value = inputValue;
            } else if (step.event === "input") {
              // Skip input steps with no CSV value
              addLog("warning", `Step ${stepIndex + 1} skipped - no CSV value`);
              step.status = "skipped";
              continue;
            }
          } else {
            // No CSV mode - use recorded value
            step.value = step.value ?? "";
          }
        }
        
        // Random delay (human-like behavior)
        await new Promise(resolve => 
          setTimeout(resolve, 1000 + Math.random() * 2000)
        );
        
        if (!isRunningRef.current) break;
        
        // Execute step
        const stepData = {
          event: step.event,
          path: step.path,
          value: step.value,
          selector: step.selector,
          label: step.label,
          x: step.x,
          y: step.y,
          bundle: step.bundle
        };
        
        let stepSuccess = false;
        let executionError = "";
        const startTime = Date.now();
        
        // Delay before execution
        await new Promise(resolve => 
          setTimeout(resolve, 1000 + Math.random() * 2000)
        );
        
        if (stepData.event !== "open") {
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: "runStep",
              data: stepData
            });
            stepSuccess = true;
          } catch (error) {
            executionError = error.message;
            addLog("error", `Step ${stepIndex + 1} failed: ${executionError}`);
          }
        } else {
          stepSuccess = true; // "open" steps always succeed
        }
        
        const duration = Date.now() - startTime;
        
        // Update status
        if (stepSuccess) {
          step.status = "passed";
          updateStepStatus(stepIndex, "passed", duration);
          addLog("success", `✓ Step ${stepIndex + 1} completed`);
        } else {
          step.status = "failed";
          updateStepStatus(stepIndex, "failed", duration, executionError);
        }
        
        // Update progress bar
        setProgress(((stepIndex + 1) / testSteps.length) * 100);
        
      } catch (stepError) {
        addLog("error", `Unexpected error in step ${stepIndex + 1}: ${stepError}`);
        step.status = "failed";
        continue;
      }
    }
    
    // Calculate results
    const passedSteps = testSteps.filter(s => s.status === "passed").length;
    const failedSteps = testSteps.filter(s => s.status === "failed").length;
    const skippedSteps = testSteps.filter(s => s.status === "skipped").length;
    
    addLog("info",
      `${csv_data ? "Row " + (rowIndex + 1) : "Test"} completed: ` +
      `${passedSteps} passed, ${failedSteps} failed, ${skippedSteps} skipped`
    );
  }
```

#### Cleanup
```typescript
  } catch (mainError) {
    addLog("error", `Test execution failed: ${mainError}`);
  } finally {
    isRunningRef.current = false;
    setIsRunning(false);
    
    // Reload history
    if (currentProject?.id) {
      loadTestHistory(currentProject.id);
    }
  }
};
```

### Control Functions

**Stop Test**:
```typescript
const stopTest = () => {
  isRunningRef.current = false;
  setIsRunning(false);
  addLog('warning', 'Test execution stopped by user');
};
```

**Reset Test**:
```typescript
const resetTest = () => {
  isRunningRef.current = false;
  setIsRunning(false);
  setProgress(0);
  setLogs([]);
  setTestSteps([]);
  addLog('info', 'Test execution reset');
};
```

### Helper Functions

**Add Log**:
```typescript
const addLog = (level: 'info' | 'success' | 'error' | 'warning', message: string) => {
  const newLog = {
    timestamp: format(new Date(), 'HH:mm:ss'),
    level,
    message
  };
  setLogs(prev => [...prev, newLog]);
};
```

**Update Step Status**:
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

## 7. Complexity Assessment

**Complexity Rating**: 🔴 **HIGH** (8/10)

### Why Complexity Exists

1. **Nested Loops**: Row iteration + step iteration creates O(n*m) complexity
2. **Async Coordination**: Multiple await points, promise chains, timeout management
3. **State Synchronization**: UI updates (progress, logs, steps) must stay in sync
4. **Error Recovery**: Must handle failures at row level, step level, tab level
5. **CSV Value Mapping**: Complex logic to match columns to steps (direct + mapped)
6. **Timing Control**: Random delays, timeouts, retry logic
7. **Tab Lifecycle**: Open, inject, execute, close (with error handling at each stage)

### Risks

1. **Race Conditions**: Content script injection may not complete before step execution
2. **Tab Leaks**: Tabs may not close properly if execution interrupted
3. **Memory Growth**: Logs array grows indefinitely during long runs
4. **No Concurrency**: Executes one row at a time (slow for large CSV files)
5. **Hard-Coded Delays**: 1-2 second delays may be too fast or slow for different sites
6. **Stop Button Lag**: isRunningRef check only at loop boundaries
7. **No Checkpointing**: Cannot resume from middle of failed run

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Extract Execution Engine**:
   ```typescript
   class TestExecutor {
     async executeRow(
       row: CSVRow,
       steps: Step[],
       mappings: Mapping[],
       tabId: number
     ): Promise<RowResult> {
       // Execute all steps for one row
     }
     
     async executeStep(
       step: Step,
       value: string,
       tabId: number
     ): Promise<StepResult> {
       // Execute single step
     }
   }
   ```

2. **Create Orchestration Controller**:
   ```typescript
   class TestOrchestrator {
     private executor: TestExecutor;
     private tabManager: TabManager;
     private resultCollector: ResultCollector;
     
     async run(config: TestConfig): Promise<TestRunResult> {
       // Coordinate row iteration, tab lifecycle, result aggregation
     }
     
     pause(): void {}
     resume(): void {}
     stop(): void {}
   }
   ```

3. **Add Tab Pool**:
   ```typescript
   class TabPool {
     private tabs: Map<number, TabState>;
     
     async acquire(): Promise<number> {
       // Get available tab or create new one
     }
     
     release(tabId: number): void {
       // Return tab to pool (don't close)
     }
     
     cleanup(): void {
       // Close all tabs in pool
     }
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Add Parallel Execution**:
   - Execute multiple rows concurrently (configurable max parallelism)
   - Use tab pool to manage multiple open tabs
   - Aggregate results from parallel workers

5. **Implement Checkpointing**:
   - Save progress after each row
   - Resume from last completed row if interrupted
   - Handle "resume" button in UI

6. **Add Retry Logic**:
   ```typescript
   interface RetryConfig {
     maxAttempts: number;        // Default 3
     retryOnFailure: boolean;    // Retry failed steps
     exponentialBackoff: boolean; // Increase delay each retry
   }
   ```

7. **Improve Timing Control**:
   - Adaptive delays (measure page load time, adjust dynamically)
   - Configurable min/max delays
   - Wait strategies (wait for element, wait for AJAX, wait for animation)

8. **Add Result Analytics**:
   - Success rate trending over time
   - Step failure frequency heatmap
   - Average execution time per step/row
   - Export results to CSV/PDF

**Complexity Reduction Target**: Medium (6/10) after refactoring

### Key Improvements from Refactoring

- **Performance**: Parallel execution reduces total test time
- **Reliability**: Retry logic handles transient failures
- **Resumability**: Checkpointing enables recovery from crashes
- **Maintainability**: Smaller, focused classes easier to test
- **Observability**: Better logging and telemetry for debugging
