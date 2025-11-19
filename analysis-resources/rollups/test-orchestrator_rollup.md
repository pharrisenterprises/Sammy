# TEST ORCHESTRATOR ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/test-orchestrator_breakdown.md` (553 lines)
- `modularization-plans/test-orchestrator_mod-plan.md` (empty - to be populated)
- `implementation-guides/test-orchestrator_impl.md` (N/A - not planned)

**Subsystem Purpose**: The Test Orchestrator is the execution coordination system that manages end-to-end test runs. It opens browser tabs, injects content scripts, iterates through CSV data rows, sends replay commands, tracks progress, collects results, and stores execution history. It's the conductor that brings all subsystems together.

**Criticality**: ⭐⭐⭐⭐⭐ (Maximum - orchestrates entire automation system)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Test Lifecycle**: Start/pause/stop/reset test execution with proper state management
- **Multi-Row Iteration**: Execute steps sequentially for each CSV row (or single run if no CSV)
- **Tab Coordination**: Open target URL in new tab, wait for page load, inject content script
- **Script Injection**: Ensure content script loaded before sending runStep commands
- **Step Sequencing**: Execute steps in order with proper timing (500-1000ms delay between steps)
- **Value Injection**: Map CSV values to step inputs using field mappings before execution
- **Progress Tracking**: Calculate and display real-time progress percentage (current step / total steps)
- **Error Handling**: Catch step failures, log errors, optionally continue or abort execution
- **Result Collection**: Aggregate passed/failed steps, execution time, error messages
- **History Storage**: Persist TestRun records to IndexedDB for analysis

### MUST NOT DO
- **Never execute in parallel**: Steps must run sequentially—concurrent execution causes race conditions
- **Never skip tab load confirmation**: Must wait for `pageLoaded` message before sending runStep
- **Never block UI thread**: Use async/await for all operations, keep UI responsive
- **Never lose error context**: Capture error message, step index, and timestamp for debugging

---

## 3. Interfaces & Contracts (Compressed)

### Input Requirements
```typescript
// From Storage Layer:
interface Project {
  id: number;
  name: string;
  target_url: string;
  recorded_steps: Step[];      // Recorded steps
  parsed_fields?: Field[];     // Field mappings (optional)
  csv_data?: any[];            // Data rows (optional)
}
```

### Execution Flow
```
1. User clicks "Start Test"
2. Load project from IndexedDB
3. Create TestRun record (status: 'pending')
4. FOR EACH CSV row (or single iteration if no CSV):
   a. Open tab with target_url
   b. Wait for pageLoaded message (timeout 30s)
   c. FOR EACH step in recorded_steps:
      i.   If field mapping exists, replace step.value with CSV value
      ii.  Send runStep message to content script
      iii. Wait for response (timeout 10s)
      iv.  If success, increment passed_steps; else increment failed_steps
      v.   Log result to UI console
      vi.  Wait 500-1000ms before next step
   d. Close tab
   e. If not last row, wait 2s before next iteration
5. Update TestRun record (status: 'completed' or 'failed')
6. Display summary (passed/failed counts, execution time)
```

### Message Protocol

**Open Tab**:
```typescript
const response = await chrome.runtime.sendMessage({
  action: 'openTab',
  url: project.target_url
});
// Response: { success: boolean, tabId: number }
```

**Wait for Page Load**:
```typescript
// Content script sends on load:
chrome.runtime.sendMessage({ type: 'pageLoaded' });

// Test Runner listens:
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'pageLoaded') {
    resolvePageLoadPromise();
  }
});
```

**Execute Step**:
```typescript
const success = await chrome.tabs.sendMessage(tabId, {
  type: 'runStep',
  data: {
    event: step.event,
    path: step.path,
    value: injectedValue || step.value,
    label: step.label,
    bundle: step.bundle
  }
});
// Response: boolean (true = success, false = failure)
```

### Output Contract (TestRun Record)
```typescript
interface TestRun {
  id?: number;
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time: string;          // ISO timestamp
  end_time?: string;           // ISO timestamp
  total_steps: number;         // Total steps executed
  passed_steps: number;        // Successful steps
  failed_steps: number;        // Failed steps
  test_results: StepResult[];  // Per-step results
  logs: string;                // Execution log text
}

interface StepResult {
  step_index: number;
  step_label: string;
  status: 'passed' | 'failed';
  error?: string;
  duration: number;            // Milliseconds
}
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Test Orchestrator = UI Layer**: Lives in `src/pages/TestRunner.tsx` (809 lines)
- **Coordinates All Systems**: Calls Storage Layer, Message Bus, Background Service, Replay Engine
- **No Direct DOM Access**: Cannot touch target page DOM—must send runStep messages to content script

### Layering Restrictions
- **Must operate in extension page context**: Cannot run in background (needs UI for logs/progress)
- **Must message background for tab operations**: Cannot directly call chrome.tabs.create (requires host permissions)

### Performance Constraints
- **Sequential Execution**: 1000 steps × 1000 CSV rows = 1 million operations—takes hours
- **Tab Lifecycle Overhead**: Opening/closing tab adds 2-5s per iteration
- **No Progress Persistence**: If user closes TestRunner page, execution aborts—no resume capability
- **Memory Leak Risk**: Keeping 1000 log entries in React state can slow UI—need log rotation

### Error Handling Rules
- **Continue on Step Failure**: By default, continue to next step even if current fails
- **Abort on Tab Close**: If target tab closes unexpectedly, abort current iteration
- **Timeout on No Response**: If runStep doesn't respond in 10s, mark as failed and continue
- **Graceful Degradation**: If CSV mapping missing, use original step.value (don't skip step)

### Security Requirements
- **Tab Isolation**: Each CSV row uses fresh tab—prevent data leakage between iterations
- **No Untrusted Code Execution**: CSV values are strings—never eval'd or executed
- **Rate Limiting**: No built-in rate limiting—rapid execution may trigger site anti-bot defenses

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Page Load Timeout**: If page never sends `pageLoaded` (e.g., infinite loading spinner), Test Runner hangs. Solution: 30s timeout, then abort iteration.

2. **Content Script Not Injected**: If page blocks script injection (CSP violation), runStep messages fail silently. Must check for `chrome.runtime.lastError`.

3. **Multi-Row Same Session**: If target site uses session cookies, subsequent CSV rows may see logged-in state from previous row. Solution: Open in incognito or clear cookies between iterations (not implemented).

4. **Dynamic Step Count**: If `open` step not counted in `total_steps`, progress percentage is wrong. Must normalize step counting.

5. **CSV Row with Missing Values**: If CSV row has fewer columns than headers, injected value is `undefined`. Replay Engine must handle undefined gracefully (skip input or use empty string).

### Common Pitfalls
- **Forgetting to Close Tab**: If tab not closed after iteration, accumulates 1000+ tabs—browser crashes
- **Race Condition on Fast Pages**: If page loads and executes steps before `pageLoaded` processed, first steps may fail
- **Log Array Unbounded Growth**: 10k log entries in React state causes UI lag—need circular buffer
- **TestRun Record Not Created**: If `createTestRun` call fails, results are lost—no error recovery

### Maintenance Traps
- **809-Line Monolith**: Orchestration, UI rendering, state management, logging all in one file
- **Magic Numbers**: 500ms step delay, 30s page load timeout, 10s runStep timeout—no configuration
- **No Unit Tests**: Pure integration tests—refactoring risks breaking execution logic

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/test-orchestrator_breakdown.md`
  - Execution flow diagram (tab lifecycle, step iteration)
  - CSV injection algorithm
  - Error handling strategies
  - TestRun storage schema

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/test-orchestrator_mod-plan.md` (to be populated)
  - Extract orchestration logic to TestExecutionService
  - Separate UI rendering from business logic
  - Add pause/resume capability with state persistence
  - Implement parallel execution for independent steps

### Implementation Guidelines
- **Implementation Guide**: N/A (not planned—orchestration is UI-specific coordination layer)

### Related Systems
- **Storage Layer**: Loads projects, saves TestRun records
- **Background Service**: Opens/closes tabs, injects scripts
- **Replay Engine**: Executes individual steps via runStep messages
- **CSV Processing Engine**: Provides data rows and field mappings
- **Message Bus**: Routes all communication (openTab, runStep, pageLoaded)
