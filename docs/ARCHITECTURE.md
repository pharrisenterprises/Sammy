# Architecture Overview

This document describes the high-level architecture of Sammy Test Automation.

## Table of Contents

- [System Overview](#system-overview)
- [Module Layers](#module-layers)
- [Core Modules](#core-modules)
- [Data Flow](#data-flow)
- [Message Bus](#message-bus)
- [Storage Layer](#storage-layer)

---

## System Overview

Sammy is a Chrome Manifest V3 extension with a modular architecture organized into five distinct layers.

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │ Popup   │ │Dashboard│ │Recorder │ │   Test Runner   │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    COORDINATION LAYER                        │
│  ┌─────────────────────┐ ┌─────────────────────────────┐   │
│  │   Test Orchestrator │ │      Content Script         │   │
│  └─────────────────────┘ └─────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    CORE LOGIC LAYER                          │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │   Recording  │ │    Replay    │ │  Background Svc    │  │
│  │    Engine    │ │    Engine    │ │                    │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                       │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │   Storage    │ │   Locators   │ │    Message Bus     │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    FOUNDATION LAYER                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  TypeScript Types                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Layers

### Layer 1: Foundation
Core type definitions shared across all modules.

| Module | Purpose |
|--------|---------|
| `core/types` | TypeScript interfaces (Project, Step, TestRun, etc.) |

### Layer 2: Infrastructure
Low-level services with no business logic dependencies.

| Module | Purpose |
|--------|---------|
| `core/storage` | IndexedDB persistence via Dexie.js |
| `core/locators` | Element finding strategies |
| `core/messages` | Chrome runtime messaging |
| `core/csv` | CSV parsing and field mapping |

### Layer 3: Core Logic
Business logic that depends on infrastructure.

| Module | Purpose |
|--------|---------|
| `core/recording` | Event capture and bundle creation |
| `core/replay` | Step execution and element interaction |
| `background` | Service worker and tab management |

### Layer 4: Coordination
Orchestrates multiple core modules.

| Module | Purpose |
|--------|---------|
| `core/orchestrator` | Test execution management |
| `contentScript` | Page-level coordination |

### Layer 5: Presentation
React UI components and pages.

| Module | Purpose |
|--------|---------|
| `pages` | Dashboard, Recorder, FieldMapper, TestRunner |
| `components` | Reusable UI components |
| `hooks` | Custom React hooks |
| `context` | React context providers |

---

## Core Modules

### Recording Engine

Captures user interactions and generates element locators.

```typescript
interface RecordedEvent {
  eventType: 'click' | 'input' | 'enter' | 'open';
  xpath: string;
  value: string;
  label: string;
  bundle: LocatorBundle;
  x: number;
  y: number;
}
```

**Label Detection Strategies (12+):**
1. `aria-label` attribute
2. `aria-labelledby` reference
3. Associated `<label>` element
4. Parent `<label>` element
5. `placeholder` attribute
6. `title` attribute
7. `name` attribute
8. Visible text content
9. Google Forms question patterns
10. Bootstrap form layouts
11. Select2 dropdown labels
12. Nearest text node fallback

### Replay Engine

Executes recorded steps with robust element finding.

**9-Tier Fallback Strategy:**
1. XPath exact match
2. ID attribute
3. Name attribute
4. Aria-label
5. Placeholder
6. Data attributes
7. CSS selector
8. Fuzzy text matching
9. Bounding box proximity

### Locator Bundle

Comprehensive element identifier for replay resilience.

```typescript
interface LocatorBundle {
  tag: string;
  id: string | null;
  name: string | null;
  placeholder: string | null;
  aria: string | null;
  dataAttrs: Record<string, string>;
  text: string;
  css: string;
  xpath: string;
  classes: string[];
  attrs: Record<string, string>;
  role: string | null;
  title: string | null;
  href: string | null;
  src: string | null;
  bounding: BoundingBox;
  pageUrl: string;
}
```

---

## Data Flow

### Recording Flow

```
User Action → DOM Event → Content Script → Recording Engine
    ↓
Bundle Creation → Label Detection → XPath Generation
    ↓
chrome.runtime.sendMessage → Background Service
    ↓
IndexedDB (Dexie) → Project.recorded_steps[]
```

### Replay Flow

```
Test Runner UI → Start Replay Request
    ↓
Background Service → Inject Content Script
    ↓
Content Script → Replay Engine
    ↓
For each step:
    Element Finding (9-tier) → Action Execution → Result
    ↓
chrome.runtime.sendMessage → Background → UI Update
```

---

## Message Bus

Chrome runtime messaging patterns for cross-context communication.

### Message Format

```typescript
interface Message<T = unknown> {
  action: string;
  payload?: T;
}

interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Action Categories

| Category | Actions |
|----------|---------|
| Project | `add_project`, `get_all_projects`, `update_project`, `delete_project` |
| Steps | `update_project_steps`, `update_project_fields`, `update_project_csv` |
| Test Run | `createTestRun`, `updateTestRun`, `getTestRunsByProject` |
| Recording | `start_recording`, `stop_recording`, `logEvent` |
| Replay | `start_replay`, `stop_replay`, `runStep`, `step_result` |
| Tabs | `openTab`, `closeTab`, `sendToTab` |

---

## Storage Layer

IndexedDB persistence using Dexie.js.

### Schema

```typescript
// Projects table
interface Project {
  id?: number;
  name: string;
  description: string;
  status: 'draft' | 'testing' | 'complete';
  target_url: string;
  created_date: number;
  updated_date: number;
  recorded_steps: Step[];
  parsed_fields: Field[];
  csv_data: CsvRow[];
}

// TestRuns table
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
  logs: string;
}
```

### Repositories

```typescript
// Project operations
projectRepository.create(input): Promise<number>
projectRepository.update(id, updates): Promise<void>
projectRepository.getById(id): Promise<Project | undefined>
projectRepository.getAll(): Promise<Project[]>
projectRepository.delete(id): Promise<void>

// TestRun operations
testRunRepository.create(input): Promise<number>
testRunRepository.update(id, updates): Promise<void>
testRunRepository.getByProjectId(projectId): Promise<TestRun[]>
```

---

## Extension Contexts

### Background (Service Worker)

- Runs in isolated context
- Manages persistent state
- Routes messages between contexts
- Handles tab lifecycle

### Content Script

- Injected into web pages
- Captures DOM events
- Executes replay actions
- Communicates via `chrome.runtime`

### Page Context

- Injected scripts (`interceptor.js`, `replay.js`)
- Access to page JavaScript
- Shadow DOM interception
- Communicates via `window.postMessage`

### Extension Pages

- React SPA
- IndexedDB access via Background
- User interface

---

## Security Considerations

1. **Content Security Policy**: Strict CSP for extension pages
2. **Isolated Contexts**: Content scripts run in isolated world
3. **Local Storage Only**: No external API calls
4. **Permission Model**: Minimal required permissions
5. **Input Validation**: All message payloads validated

---

## Performance Considerations

1. **Lazy Loading**: Routes loaded on demand
2. **Debounced Updates**: Storage writes debounced
3. **Virtual Lists**: Large step lists virtualized
4. **Worker Threads**: Heavy computation offloaded
5. **Efficient Queries**: Indexed database queries

---

## For More Information

- [README.md](../README.md) - Getting started
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guide
- [Component Breakdowns](../analysis-resources/component-breakdowns/) - Detailed module docs
