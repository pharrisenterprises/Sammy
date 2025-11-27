# PHASE 4 SPECIFICATIONS
## Single Source of Truth for Code Generation

**Purpose:** Canonical technical specifications for Phase 4 code generation.  
**Version:** 1.0 | **Created:** November 27, 2025  
**Status:** AUTHORITATIVE - All generated code MUST match these specs.

---

## 1. CORE INTERFACES

### 1.1 Project Interface

**Target File:** `src/core/types/project.ts` (P4-001)
```typescript
export type ProjectStatus = 'draft' | 'testing' | 'complete';

export interface Project {
  id?: number;                    // Auto-increment PK
  name: string;                   // Required
  description: string;            // Required (can be empty string)
  status: ProjectStatus;          // Only 3 valid values
  target_url: string;             // Valid URL
  created_date: number;           // Unix timestamp (NOT ISO string)
  updated_date: number;           // Unix timestamp (NOT ISO string)
  recorded_steps?: Step[];        // Optional array
  parsed_fields?: Field[];        // Optional array
  csv_data?: any[];               // Optional array
}
```

**WRONG values for status:** 'ready', 'running', 'archived', 'active', 'inactive'

---

### 1.2 Step Interface

**Target File:** `src/core/types/step.ts` (P4-002)
```typescript
export type StepEvent = 'click' | 'input' | 'enter' | 'open';

export interface Step {
  id: string;                     // UUID format
  name: string;                   // Human-readable name
  event: StepEvent;               // ONLY 4 types allowed
  path: string;                   // XPath - REQUIRED
  value: string;                  // Input value
  label: string;                  // Detected field label
  x: number;                      // Click X coordinate - REQUIRED
  y: number;                      // Click Y coordinate - REQUIRED
  bundle?: LocatorBundle;         // Multi-strategy locator - REQUIRED for replay
}
```

**WRONG values for event:** 'submit', 'change', 'keydown', 'keyup', 'focus', 'blur', 'navigate'

---

### 1.3 Field Interface

**Target File:** `src/core/types/field.ts` (P4-003)
```typescript
export interface Field {
  field_name: string;             // CSV column header (snake_case property!)
  mapped: boolean;                // Is mapped to a step?
  inputvarfields: string;         // Target step label (snake_case property!)
}
```

**CRITICAL:** Property names are `field_name` and `inputvarfields` (snake_case)
**WRONG interface:** `{ variable: string, csvColumn: string }` ← NOT THIS

---

### 1.4 TestRun Interface

**Target File:** `src/core/types/test-run.ts` (P4-004)
```typescript
export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TestRun {
  id?: number;                    // Auto-increment PK
  project_id: number;             // FK to projects
  status: TestRunStatus;          // 4 valid values
  start_time: string;             // ISO 8601 string
  end_time?: string;              // ISO 8601 string (optional)
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  test_results: StepResult[];     // Array of results
  logs: string;                   // ← SINGLE STRING, NOT ARRAY
}

export interface StepResult {
  step_id: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;               // milliseconds
  error?: string;
}
```

**CRITICAL:** `logs` is `string` type. Parse with `logs.split('\n')` for display.
**WRONG:** `logs: string[]` or `logs: LogEntry[]` ← NOT THESE

---

### 1.5 LocatorBundle Interface

**Target File:** `src/core/types/locator-bundle.ts` (P4-005)
```typescript
export interface LocatorBundle {
  tag: string;                              // HTML tag name
  id: string | null;                        // ID attribute
  name: string | null;                      // name attribute
  placeholder: string | null;               // placeholder attribute
  aria: string | null;                      // aria-label value
  dataAttrs: Record<string, string>;        // All data-* attributes
  text: string;                             // Visible text content
  css: string;                              // CSS class string
  xpath: string;                            // Absolute XPath (always present)
  classes: string[];                        // CSS class array
  pageUrl: string;                          // URL when recorded
  bounding: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  iframeChain: number[] | null;             // Iframe indices
  shadowHosts: string[] | null;             // Shadow DOM XPaths
}
```

---

## 2. MESSAGE ACTIONS REGISTRY

### 2.1 Naming Convention

**RULE:** All actions use **lowercase snake_case**
```typescript
// ✅ CORRECT
{ action: 'get_all_projects' }
{ action: 'add_project' }
{ action: 'update_project_steps' }

// ❌ WRONG  
{ action: 'GET_ALL_PROJECTS' }
{ action: 'ADD_PROJECT' }
{ action: 'getProject' }
```

### 2.2 Complete Action Registry

**Project Actions:**
| Action | Request Payload | Response |
|--------|-----------------|----------|
| `add_project` | `{ name, description, target_url, status }` | `{ success: true, id: number }` |
| `update_project` | `{ id, ...partialProject }` | `{ success: true }` |
| `get_all_projects` | `{}` | `{ success: true, projects: Project[] }` |
| `delete_project` | `{ id }` | `{ success: true }` |
| `get_project_by_id` | `{ id }` | `{ success: true, project: Project }` |
| `update_project_steps` | `{ id, recorded_steps }` | `{ success: true }` |
| `update_project_fields` | `{ id, parsed_fields }` | `{ success: true }` |
| `update_project_csv` | `{ id, csv_data }` | `{ success: true }` |

**TestRun Actions:**
| Action | Request Payload | Response |
|--------|-----------------|----------|
| `createTestRun` | `{ project_id, status, start_time, ... }` | `{ success: true, id: number }` |
| `updateTestRun` | `{ id, ...partialTestRun }` | `{ success: true }` |
| `getTestRunsByProject` | `{ project_id }` | `{ success: true, testRuns: TestRun[] }` |

**Tab Actions:**
| Action | Request Payload | Response |
|--------|-----------------|----------|
| `open_project_url_and_inject` | `{ url, projectId }` | `{ success: true, tabId: number }` |
| `close_opened_tab` | `{ tabId }` | `{ success: true }` |

**Recording Actions:**
| Action | Request Payload | Response |
|--------|-----------------|----------|
| `start_recording` | `{ projectId }` | `{ success: true }` |
| `stop_recording` | `{}` | `{ success: true }` |
| `logEvent` | `{ eventType, xpath, value, label, x, y, bundle }` | (broadcast, no response) |

**Replay Actions:**
| Action | Request Payload | Response |
|--------|-----------------|----------|
| `start_replay` | `{ projectId, csvRow? }` | `{ success: true }` |
| `stop_replay` | `{}` | `{ success: true }` |
| `runStep` | `{ step, csvValues? }` | `{ success: true, duration: number }` |

---

## 3. CRITICAL IMPLEMENTATION PATTERNS

### 3.1 Async Message Handler (return true)
```typescript
// ✅ CORRECT - Channel stays open for async response
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_all_projects') {
    DB.getAllProjects()
      .then(projects => sendResponse({ success: true, projects }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // ← CRITICAL
  }
});

// ❌ WRONG - sendResponse never reaches caller
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_all_projects') {
    DB.getAllProjects().then(projects => sendResponse({ success: true, projects }));
    // Missing return true - response lost!
  }
});
```

### 3.2 isRunningRef Pattern (Synchronous Stop)
```typescript
// ✅ CORRECT - useRef for immediate stop
const isRunningRef = useRef(false);

const stopTest = () => {
  isRunningRef.current = false; // Immediate
};

const runTest = async () => {
  isRunningRef.current = true;
  for (const step of steps) {
    if (!isRunningRef.current) break; // Immediate check
    await executeStep(step);
  }
};

// ❌ WRONG - useState is async, may not stop immediately  
const [isRunning, setIsRunning] = useState(false);
const stopTest = () => setIsRunning(false); // Async update!
```

### 3.3 React-Safe Input Simulation
```typescript
// ✅ CORRECT - Bypass React's controlled input system
const setInputValue = (element: HTMLInputElement, value: string) => {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  
  nativeInputValueSetter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

// ❌ WRONG - React ignores direct value assignment
element.value = 'test';
element.dispatchEvent(new Event('input'));
```

### 3.4 Auto-Mapping Threshold
```typescript
// ✅ CORRECT - 0.3 (30%) threshold
const AUTO_MAP_THRESHOLD = 0.3;

// ❌ WRONG - 0.8 is too strict
const AUTO_MAP_THRESHOLD = 0.8;
```

---

## 4. LOCATOR STRATEGY CONFIGURATION

### 4.1 9-Tier Fallback Order

| Priority | Strategy | Confidence | Notes |
|----------|----------|------------|-------|
| 1 | XPath | 100% | Always attempted first |
| 2 | ID + Attributes | 90% | Cross-validated with name/class |
| 3 | Name Attribute | 80% | `[name="value"]` |
| 4 | ARIA Label | 75% | `[aria-label="value"]` |
| 5 | Placeholder | 70% | `[placeholder="value"]` |
| 6 | Data Attributes | 65% | `[data-testid="value"]` |
| 7 | Fuzzy Text | 40-60% | 0.4 similarity threshold |
| 8 | Bounding Box | Variable | 200px proximity |
| 9 | Retry Loop | - | 150ms interval, 2000ms timeout |

### 4.2 Timing Configuration
```typescript
const LOCATOR_CONFIG = {
  timeout: 2000,              // Total timeout (ms)
  retryInterval: 150,         // Retry interval (ms)
  fuzzyTextThreshold: 0.4,    // 40% text similarity
  boundingBoxRadius: 200,     // 200px proximity
  humanDelayMin: 50,          // Min delay between actions
  humanDelayMax: 300,         // Max delay between actions
};
```

---

## 5. FILE STRUCTURE

### 5.1 Phase 4 Creates (src/core/)
```
src/core/
├── types/              P4-001 to P4-015  (15 files)
├── storage/            P4-016 to P4-030  (15 files)
├── locators/           P4-031 to P4-050  (20 files)
├── messages/           P4-051 to P4-070  (20 files)
├── recording/          P4-071 to P4-095  (25 files)
├── replay/             P4-096 to P4-120  (25 files)
├── csv/                P4-121 to P4-140  (20 files)
├── orchestrator/       P4-141 to P4-160  (20 files)
└── index.ts            P4-221            (1 file)
```

### 5.2 Phase 4 Refactors (existing files)
```
src/background/background.ts      → P4-178
src/contentScript/content.tsx     → P4-211
src/pages/Dashboard.tsx           → P4-194
src/pages/Recorder.tsx            → P4-195
src/pages/FieldMapper.tsx         → P4-196
src/pages/TestRunner.tsx          → P4-197
```

---

## 6. VALIDATION RULES

### 6.1 Interface Validation

| Interface | Field | Valid Values | Invalid Values |
|-----------|-------|--------------|----------------|
| Project | status | draft, testing, complete | ready, running, archived |
| Step | event | click, input, enter, open | submit, change, keydown |
| TestRun | logs | string | string[], LogEntry[] |
| Field | properties | field_name, mapped, inputvarfields | variable, csvColumn |

### 6.2 Code Generation Checklist

Before committing any P4-XXX generated code:

- [ ] Interfaces match Section 1 exactly
- [ ] Message actions are lowercase snake_case
- [ ] Async handlers have `return true`
- [ ] useRef used for isRunningRef (not useState)
- [ ] Tests pass: `npm run test -- [file]`
- [ ] Types pass: `npm run type-check`

---

## QUICK REFERENCE CARD
```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4 QUICK REFERENCE                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Project.status    → 'draft' | 'testing' | 'complete'       │
│ Step.event        → 'click' | 'input' | 'enter' | 'open'   │
│ TestRun.logs      → string (NOT string[])                  │
│ Field             → { field_name, mapped, inputvarfields } │
│                                                             │
│ Message actions   → lowercase_snake_case                   │
│ Async handlers    → return true (ALWAYS)                   │
│ Stop control      → useRef (NOT useState)                  │
│ Auto-map          → 0.3 threshold                          │
│ Element timeout   → 2000ms                                 │
│ Retry interval    → 150ms                                  │
│ Fuzzy threshold   → 0.4                                    │
│ Bounding box      → 200px                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**END OF SPECIFICATIONS**
