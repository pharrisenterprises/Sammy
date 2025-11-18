# 0. META-ANALYSIS: SAMMY BROWSER AUTOMATION RECORDER

**Last Updated:** November 18, 2025  
**Analysis Version:** 1.0  
**Project Status:** Active Development (v1.0.9)

---

## 1. PROJECT OVERVIEW

### What This Project Does
Sammy is a **Chrome browser extension** that provides end-to-end web automation capabilities through a comprehensive recorder/replay system. It enables users to:
- **Record** user interactions on websites (clicks, inputs, navigation)
- **Map** recorded actions to CSV data fields for data-driven automation
- **Execute** automated test runs with multiple data rows
- **Track** test results and execution history

### High-Level Behavior
The extension operates in three distinct phases:
1. **Recording Phase**: Captures DOM interactions as structured steps with multiple locator strategies
2. **Mapping Phase**: Associates recorded steps with CSV columns for parameterized execution
3. **Execution Phase**: Replays recorded workflows with CSV data injection, simulating real user behavior

### Architecture Type
**Chrome Manifest V3 Extension** with:
- Background service worker (persistent state management)
- Content scripts (page-level DOM interaction)
- Multiple UI pages (popup, standalone dashboard, recorder, mapper, runner)
- IndexedDB persistence layer
- React-based SPA interface

### Interaction Model
- **Browser APIs**: chrome.tabs, chrome.storage, chrome.scripting, chrome.webNavigation, chrome.runtime
- **DOM Manipulation**: Direct DOM event capture and synthetic event dispatching
- **Cross-Context Messaging**: chrome.runtime.sendMessage, window.postMessage for iframe/shadow DOM
- **Storage**: IndexedDB (Dexie.js) for projects, test runs, recorded steps
- **Network**: No direct API calls (future: Firebase integration present but unused)

---

## 2. TECH STACK SUMMARY

### Core Languages
- **TypeScript** (5.0.2) - Primary language for all logic
- **JSX/TSX** - React component files
- **CSS** - Custom styling + Tailwind utilities

### Primary Frameworks & Libraries

#### Frontend Framework
- **React** (18.2.0) with React DOM
- **React Router DOM** (6.24.0) - Multi-page routing within extension

#### UI Component Libraries
- **Radix UI** - Headless accessible component primitives (accordion, dialog, dropdown, tabs, etc.)
- **Tailwind CSS** (3.4.17) + PostCSS + Autoprefixer
- **Material-UI** (@mui/material 5.16.4) - Limited usage
- **Flowbite React** - Additional UI components
- **Lucide React** - Icon library
- **FontAwesome** - Additional icons

#### State Management
- **Redux Toolkit** (@reduxjs/toolkit 2.2.5) + React-Redux (9.1.2)
- **Dexie.js** (4.0.11) - IndexedDB wrapper for persistence

#### Drag & Drop
- **@hello-pangea/dnd** (18.0.1) - For reordering recorded steps

#### Form & Data Handling
- **React Select** (5.10.1) - Enhanced select dropdowns
- **PapaParse** (5.5.3) - CSV parsing
- **XLSX** (0.18.5) - Excel import/export
- **date-fns** (4.1.0) - Date formatting

#### DOM & Automation Tools
- **get-xpath** (3.3.0) - XPath generation
- **xpath** (0.0.34) - XPath evaluation
- **string-similarity** (4.0.4) - Fuzzy field matching for auto-mapping
- **jQuery** (3.7.1) - Legacy DOM manipulation (minimal usage)

### Build Tools & Bundler
- **Vite** (6.3.5) - Build system and dev server
- **@vitejs/plugin-react-swc** - Fast React refresh
- **vite-plugin-html** - Multi-page HTML generation
- **vite-plugin-static-copy** - Asset copying
- **TypeScript** (5.0.2) - Type checking

### Chrome Extension Development
- **@types/chrome** (0.0.263) - TypeScript definitions
- **@crxjs/vite-plugin** (2.0.0-beta.21) - Chrome extension build plugin
- **@types/webextension-polyfill** - Cross-browser polyfill types

### Linting & Quality
- **ESLint** (8.45.0) with TypeScript plugin
- **@typescript-eslint/parser** + **@typescript-eslint/eslint-plugin**

### Manifest Version
**Manifest V3** - Latest Chrome extension standard
- Service worker background script (ES module)
- Permissions: tabs, storage, offscreen, scripting, activeTab, webNavigation
- Host permissions: `<all_urls>` (full web access)

---

## 3. ARCHITECTURE & SUBSYSTEMS

### Major Subsystems

#### 3.1 Background Service Worker (`src/background/background.ts`)
**Role**: Centralized state coordinator and message broker
- Manages IndexedDB operations through message passing
- Controls tab lifecycle (open, close, track)
- Injects content scripts dynamically via chrome.scripting API
- Handles cross-tab communication
- Persists storage permissions

**Key Flows**:
- Project CRUD (add, update, delete, get_all_projects, get_project_by_id)
- Test run management (createTestRun, updateTestRun, getTestRunsByProject)
- Tab management (openTab, close_opened_tab, open_project_url_and_inject)
- Dynamic script injection (main.js into target tabs/iframes)

#### 3.2 Content Script System

##### 3.2.1 Main Content Script (`src/contentScript/content.tsx`)
**Role**: Event capture engine and replay executor
- **Event Listeners**: Captures click, input, keydown, mousedown events
- **Smart Recording**: Detects form fields, buttons, links, shadow DOM elements
- **Label Detection**: Advanced heuristics to extract human-readable field names
  - Handles: aria-label, aria-labelledby, placeholder, nearby text, parent labels
  - Special cases: Google Forms, Jotform, Select2 dropdowns, Bootstrap layouts
- **Locator Bundling**: Captures multiple identifiers per element:
  - ID, name, className, data-*, aria, placeholder, tag, xpath, bounding box, iframe chain
- **Iframe Traversal**: Recursively attaches listeners to nested iframes
- **Replay Engine**: Executes recorded steps with:
  - Smart element finding (multi-strategy fallback)
  - Value injection (React-safe, controlled input handling)
  - Human-like interaction simulation (mouseover, mousedown, click sequences)
  - Shadow DOM penetration (open roots)
  - Visibility restoration for hidden elements

##### 3.2.2 Page Interceptor (`src/contentScript/page-interceptor.tsx`)
**Role**: Intercepts closed shadow roots (Google Autocomplete)
- Monkey-patches `Element.prototype.attachShadow`
- Exposes closed shadow roots via `__realShadowRoot`
- Captures input/selection events from Google Place Autocomplete
- Sends events to main content script via `window.postMessage`

##### 3.2.3 Replay Script (`src/contentScript/replay.ts`)
**Role**: Page-context automation for special widgets
- Runs in page context (not content script context)
- Handles Google Autocomplete replay by:
  - Reading from exposed `__realShadowRoot`
  - Finding dropdown options by text matching
  - Simulating mouse events on shadow DOM elements

#### 3.3 UI Shell (React SPA)

##### 3.3.1 Dashboard (`src/pages/Dashboard.tsx`)
- Project listing with search/filter
- Project CRUD operations
- Quick navigation to Recorder/Mapper/Runner
- Stats display (project count, test run summaries)

##### 3.3.2 Recorder (`src/pages/Recorder.tsx`)
- Live step capture display
- Drag-and-drop step reordering (@hello-pangea/dnd)
- Manual step editing (label, event, path, value)
- Real-time log panel
- Export to Excel/CSV (headers + values)
- Step management (add, update, delete)

##### 3.3.3 Field Mapper (`src/pages/FieldMapper.tsx`)
- CSV upload and parsing
- Auto-mapping with fuzzy string matching
- Manual field-to-step mapping UI
- Mapping validation and preview

##### 3.3.4 Test Runner (`src/pages/TestRunner.tsx`)
- Multi-row CSV execution
- Live progress tracking
- Step-by-step status updates
- Console logging (color-coded: info, success, error, warning)
- Test history display
- Execution metrics (passed/failed steps, duration)

#### 3.4 Storage Layer (`src/common/services/indexedDB.ts`)
**Role**: Dexie-based persistence
- **Projects Table**: name, description, target_url, status, recorded_steps[], parsed_fields[], csv_data[]
- **TestRuns Table**: project_id, status, start_time, end_time, total_steps, passed_steps, failed_steps, test_results[], logs
- CRUD operations exposed via DB singleton

#### 3.5 State Management
- **Redux Store**: Minimal usage (theme state, unused user/header slices)
- **Local Component State**: Primary state management via React hooks
- **IndexedDB**: Persistent storage (projects, test runs)
- **chrome.storage**: Extension-level settings (unused currently)

### Communication Flows

#### Recording Flow
```
User Action (webpage)
  ↓
Content Script Event Listener (content.tsx)
  ↓
Bundle Creation (id, xpath, label, bundle{...})
  ↓
chrome.runtime.sendMessage({ type: "logEvent" })
  ↓
Background Script (ignored, no listener needed)
  ↓
Extension Page (Recorder.tsx) receives via chrome.runtime.onMessage
  ↓
Update recordedSteps state
  ↓
Save to IndexedDB via background script
```

#### Replay Flow
```
Runner UI (TestRunner.tsx)
  ↓
chrome.runtime.sendMessage({ action: "openTab", url })
  ↓
Background opens tab + injects main.js
  ↓
For each step:
  chrome.tabs.sendMessage(tabId, { type: "runStep", data: stepBundle })
  ↓
Content Script (content.tsx) receives message
  ↓
findElementFromBundle(bundle) → multi-strategy element search
  ↓
playAction(bundle, action) → simulate user interaction
  ↓
Return success/failure to Runner
```

#### Cross-Context Messaging
- **Extension → Background**: `chrome.runtime.sendMessage()`
- **Background → Tab**: `chrome.tabs.sendMessage(tabId, ...)`
- **Content Script → Page Context**: `window.postMessage()` (for interceptor)
- **Page Context → Content Script**: `window.addEventListener("message")`

---

## 4. DIRECTORY & FILE STRUCTURE

### Root Configuration Files
- `package.json` - Dependencies and build scripts
- `tsconfig.json` / `tsconfig.node.json` - TypeScript configurations
- `vite.config.ts` - Main UI build config (popup, dashboard, pages)
- `vite.config.bg.ts` - Background script build config
- `tailwind.config.js` + `postcss.config.js` - Styling setup
- `scripts/postbuild.js` - Post-build manifest injection

### `public/` - Static Assets
- `manifest.json` - Chrome extension manifest (V3)
- `index.html`, `popup.html`, `pages.html` - Entry HTML files
- `icon/` - Extension icons (16-128px)
- `fonts/` - Custom fonts

### `src/` - Source Code

#### Application Entry Points
- `main.tsx` - React app initialization with Redux Provider
- `App.tsx` - Root component, router setup

#### Pages (`src/pages/`)
- `Dashboard.tsx` (1,286 lines) - Project management UI
- `Recorder.tsx` (626 lines) - Recording interface
- `FieldMapper.tsx` (523 lines) - CSV mapping UI
- `TestRunner.tsx` (809 lines) - Test execution UI
- `Layout.tsx` - Wrapper layout (minimal)

#### Background (`src/background/`)
- `background.ts` (347 lines) - Service worker logic

#### Content Scripts (`src/contentScript/`)
- `content.tsx` (1,446 lines) ⚠️ **LARGEST FILE** - Main event capture + replay engine
- `page-interceptor.tsx` (107 lines) - Shadow DOM interceptor
- `replay.ts` (152 lines) - Page-context automation

#### Components (`src/components/`)
Organized by feature:
- `Dashboard/` - CreateProjectDialog, EditProjectModal, ProjectStats, ConfirmationModal
- `Recorder/` - RecorderToolbar, StepsTable, LogPanel
- `Mapper/` - FieldMappingPanel, FieldMappingTable, MappingSummary, WebPreview
- `Runner/` - TestConsole, TestResults, TestSteps
- `Ui/` - Radix UI wrapper components (button, card, dialog, input, etc.)
- `Header.tsx` - Top navigation
- `Loader/` - Loading spinner

#### Common Utilities (`src/common/`)
- `services/indexedDB.ts` (71 lines) - Dexie DB wrapper
- `helpers/` - commonHelpers, storageHelper
- `config/` - apiService, constMessage
- `utils/` - fontsUtils, types

#### Redux (`src/redux/`)
- `store.ts` - Redux store configuration
- `themeSlice.ts` - Theme state (light/dark mode)
- `reducer/` - users.ts, header.ts (mostly unused)
- `selector/` - State selectors

#### Routes (`src/routes/`)
- `Router.tsx` - React Router configuration

#### Constants (`src/constants/`)
- `constants.ts` - App-wide constants
- `types.ts` - TypeScript type definitions

#### CSS (`src/css/`)
- `content.css` - Content script styles
- `dashboard.css` - Dashboard-specific styles
- `InputAiPopup.css` - AI popup styles

### Key Complexity Hotspots

#### **Largest Files (by line count):**
1. `content.tsx` (1,446 lines) ⚠️ - Monolithic recording + replay engine
2. `Dashboard.tsx` (1,286 lines) ⚠️ - Complex project management UI
3. `TestRunner.tsx` (809 lines) - Multi-phase execution logic
4. `Recorder.tsx` (626 lines) - Step management UI
5. `FieldMapper.tsx` (523 lines) - CSV mapping logic

#### **Deeply Nested Logic:**
- `content.tsx::getLabelForTarget()` - 200+ lines of label detection heuristics
- `content.tsx::findElementFromBundle()` - 100+ lines of multi-strategy element finding
- `content.tsx::playAction()` - 150+ lines of action replay logic

---

## 5. DEPENDENCIES & ROLES

### Core Infrastructure
| Dependency | Role | Critical? |
|------------|------|-----------|
| **React** | UI framework | ✅ Core |
| **Dexie.js** | IndexedDB persistence | ✅ Core |
| **Vite** | Build system | ✅ Core |
| **TypeScript** | Type safety | ✅ Core |
| **chrome APIs** | Browser integration | ✅ Core |

### UI & Styling
| Dependency | Role | Critical? |
|------------|------|-----------|
| **Radix UI** | Accessible component primitives | ⚠️ Replaceable |
| **Tailwind CSS** | Utility-first styling | ⚠️ Replaceable |
| **Lucide React** | Icons | ⚠️ Replaceable |
| **@hello-pangea/dnd** | Drag-and-drop | ⚠️ Feature-specific |

### Data Handling
| Dependency | Role | Critical? |
|------------|------|-----------|
| **PapaParse** | CSV parsing | ✅ Core (for CSV feature) |
| **XLSX** | Excel import/export | ⚠️ Feature-specific |
| **date-fns** | Date formatting | ⚠️ Replaceable |
| **string-similarity** | Auto-mapping fuzzy match | ⚠️ Feature-specific |

### DOM & Automation
| Dependency | Role | Critical? |
|------------|------|-----------|
| **get-xpath** | XPath generation | ✅ Core (recording) |
| **xpath** | XPath evaluation | ✅ Core (replay) |
| **jQuery** | Legacy DOM manipulation | ❌ Removable |

### State Management
| Dependency | Role | Critical? |
|------------|------|-----------|
| **Redux Toolkit** | Global state | ⚠️ Underutilized (theme only) |
| **React-Redux** | React-Redux bindings | ⚠️ Underutilized |

### Unused/Overprovisioned
- **Firebase** (11.9.1) - Included but not used anywhere
- **Axios** (1.7.3) - No HTTP requests in codebase
- **Material-UI** - Minimal usage, mostly Radix UI
- **@emotion/react** - MUI dependency, underutilized
- **next-themes** - Theme switching (minimal use)
- **jQuery** - Legacy, should be removed

---

## 6. RISKS, COMPLEXITY, AND HOTSPOTS

### Technical Debt

#### 1. Monolithic Content Script
**File**: `content.tsx` (1,446 lines)
- **Problem**: Recording + replay logic + label detection + iframe handling + shadow DOM + event listeners all in one file
- **Risk**: Hard to test, maintain, debug
- **Refactor Opportunity**: Split into:
  - `recorder.ts` (event capture)
  - `labelDetector.ts` (heuristics)
  - `replayEngine.ts` (action execution)
  - `elementFinder.ts` (locator strategies)
  - `iframeManager.ts` (cross-frame handling)

#### 2. Label Detection Complexity
**Function**: `getLabelForTarget()` - 200+ lines
- **Problem**: 12+ hardcoded heuristics for different form patterns (Bootstrap, Google Forms, Jotform, Select2, etc.)
- **Risk**: Brittle, site-specific, requires constant updates
- **Refactor Opportunity**: Plugin-based label detection strategy pattern

#### 3. Element Finding Logic
**Function**: `findElementFromBundle()` - 100+ lines
- **Problem**: 6+ fallback strategies with complex scoring
- **Risk**: Unpredictable behavior, timeout issues
- **Refactor Opportunity**: Configurable locator priority, better logging

#### 4. Redux Store Underutilized
- **Problem**: Redux is set up but only used for theme state (minimal)
- **Risk**: Unnecessary dependency, confusion about state management approach
- **Decision Needed**: Remove Redux OR migrate more state to Redux

#### 5. Message Passing Complexity
- **Problem**: Multiple message types with inconsistent patterns:
  - `chrome.runtime.sendMessage({ action: "..." })` (background calls)
  - `chrome.tabs.sendMessage(tabId, { type: "..." })` (content script calls)
  - `window.postMessage({ type: "..." })` (cross-context)
- **Risk**: Hard to trace message flow, easy to create race conditions
- **Refactor Opportunity**: Centralized message bus with typed events

#### 6. No Unit Tests
- **Problem**: Zero test coverage
- **Risk**: Regressions during refactoring
- **Action**: Add Jest + React Testing Library for critical paths

### Complexity Hotspots

#### High Complexity Functions (Cyclomatic Complexity)
1. `content.tsx::handleClick()` - 50+ conditional branches
2. `content.tsx::playAction()` - 40+ conditional branches
3. `content.tsx::getLabelForTarget()` - 35+ conditional branches
4. `TestRunner.tsx::runTest()` - Nested loops + async error handling
5. `FieldMapper.tsx::autoMapFields()` - Nested iterations

#### Shadow DOM Handling
- **Current Approach**: Monkey-patching `attachShadow`, exposing closed roots
- **Risk**: Fragile, browser updates could break
- **Alternative**: Focus on open shadow roots, graceful degradation for closed

#### Iframe Chain Serialization
- **Current**: Stores iframe id/name/index for later traversal
- **Risk**: Dynamic iframes (lazy-loaded ads, modals) may break replay
- **Improvement**: Iframe fingerprinting via stable attributes

### Known Limitations

1. **Closed Shadow DOM**: Limited support, relies on monkey-patching
2. **Dynamic Content**: Elements that load after page load may not be captured properly
3. **CAPTCHA/Auth**: Cannot handle human verification steps
4. **File Uploads**: Not supported in replay
5. **Canvas/WebGL**: Cannot record interactions on canvas elements
6. **Drag-and-Drop**: Recording supported, replay may be unreliable
7. **Hover-Only Menus**: May miss hover-triggered elements

---

## 7. SUGGESTED SUBSYSTEM BOUNDARIES (FOR FUTURE REBUILD)

### Proposed Modular Architecture

#### Module 1: **Recording Engine**
**Purpose**: Capture user interactions as structured events
- **Submodules**:
  - Event Listener Manager (attach/detach)
  - Label Detector (pluggable strategies)
  - Locator Generator (XPath, CSS, ID, data-*)
  - Iframe Tracker
  - Shadow DOM Handler
- **Interface**: `IRecorder` with `start()`, `stop()`, `getSteps()`
- **Output**: Array of `RecordedStep` objects

#### Module 2: **Replay Engine**
**Purpose**: Execute recorded steps with element finding and action simulation
- **Submodules**:
  - Element Finder (multi-strategy with scoring)
  - Action Executor (click, input, enter, select)
  - Value Injector (React-safe input handling)
  - Retry Manager (configurable timeouts)
- **Interface**: `IReplayEngine` with `execute(step, context)`
- **Input**: `RecordedStep[]` + execution context
- **Output**: `ExecutionResult[]`

#### Module 3: **Locator Strategy System**
**Purpose**: Pluggable element identification strategies
- **Built-in Strategies**:
  - XPath Resolver
  - ID Matcher
  - Name Matcher
  - Aria Label Matcher
  - Data Attribute Matcher
  - Fuzzy Text Matcher
  - Bounding Box Matcher
- **Interface**: `ILocatorStrategy` with `find(bundle, doc): Element | null`
- **Scoring**: Each strategy returns confidence score

#### Module 4: **Storage Abstraction Layer**
**Purpose**: Unified persistence interface
- **Implementations**:
  - IndexedDB Provider (Dexie wrapper)
  - Chrome Storage Provider
  - In-Memory Provider (testing)
- **Interface**: `IStorageProvider` with CRUD operations
- **Models**: Project, TestRun, Settings

#### Module 5: **Message Bus**
**Purpose**: Centralized communication layer
- **Message Types** (strongly typed):
  - Recording events
  - Replay commands
  - Storage operations
  - Tab management
- **Features**:
  - Request/response pairing
  - Timeout handling
  - Error propagation
  - Event tracing (for debugging)

#### Module 6: **UI Component Library**
**Purpose**: Reusable UI primitives
- **Components**:
  - Dashboard (project list, stats)
  - Recorder (step table, log panel)
  - Mapper (field mapping table, auto-map)
  - Runner (progress bar, console, results)
- **Styling**: Tailwind-based design system
- **State**: React Context for shared UI state

#### Module 7: **CSV Processing Engine**
**Purpose**: Data import/export and field mapping
- **Features**:
  - CSV/Excel parsing (PapaParse, XLSX)
  - Auto-mapping (fuzzy string matching)
  - Manual mapping UI
  - Validation (missing fields, type checking)
- **Interface**: `IDataMapper` with `mapFields(csv, steps)`

#### Module 8: **Test Execution Orchestrator**
**Purpose**: Multi-row test execution with reporting
- **Features**:
  - Row-by-row iteration
  - Tab lifecycle management (open, inject, close)
  - Progress tracking
  - Result aggregation
  - History storage
- **Interface**: `ITestRunner` with `run(project, data)`

### Modularization Principles
1. **Single Responsibility**: Each module has one clear purpose
2. **Interface-First**: Define contracts before implementation
3. **Pluggable**: Strategies and providers are swappable
4. **Testable**: Modules can be unit tested in isolation
5. **Loosely Coupled**: Modules communicate via well-defined interfaces
6. **Configuration-Driven**: Behavior configurable via settings (no hardcoding)

### Migration Path
**Phase 1**: Extract Recording Engine from `content.tsx`
**Phase 2**: Extract Replay Engine from `content.tsx`
**Phase 3**: Create Message Bus, migrate all message passing
**Phase 4**: Extract Storage Layer, add abstraction
**Phase 5**: Refactor UI into modular components
**Phase 6**: Add unit tests for each module
**Phase 7**: Build integration test suite

---

## 8. ADDITIONAL OBSERVATIONS

### Strengths
1. **Comprehensive Locator Strategy**: Multi-fallback approach increases resilience
2. **Iframe Support**: Full traversal and serialization
3. **Shadow DOM Awareness**: Attempts to handle closed shadow roots
4. **CSV-Driven Execution**: Data parameterization is well-implemented
5. **User-Friendly UI**: Clean React-based interface with good UX

### Weaknesses
1. **Monolithic Files**: Several 500+ line files that should be split
2. **Hardcoded Heuristics**: Label detection relies on site-specific patterns
3. **No Error Boundaries**: React error boundaries missing
4. **No Logging Framework**: Console.log scattered everywhere
5. **No Telemetry**: No usage analytics or error reporting
6. **Underutilized Redux**: Adds complexity without benefit

### Security Considerations
- **Host Permissions**: `<all_urls>` grants access to all websites (necessary but powerful)
- **Script Injection**: Dynamically injects scripts into user tabs (carefully scoped)
- **Data Storage**: Projects stored locally in IndexedDB (no cloud sync, good for privacy)
- **No Authentication**: No user accounts or cloud storage (fully local)

### Performance Concerns
- **Large Bundle Size**: Multiple UI libraries (Radix, Material-UI, Flowbite) increase bundle size
- **Content Script Size**: 1,446-line content.tsx loads on every page
- **IndexedDB Queries**: No indexing optimization for large project counts
- **Replay Delays**: Fixed delays (1000-2000ms) may slow down execution

### Browser Compatibility
- **Chrome Only**: Designed for Chrome Manifest V3
- **Portability**: Could be adapted for Firefox with minimal changes (polyfill needed)
- **Edge/Brave**: Should work with minor adjustments

---

## CONCLUSION

This is a **well-architected browser automation tool** with a clear three-phase workflow (record, map, run). The codebase demonstrates solid React/TypeScript practices and comprehensive DOM interaction handling.

**Primary Refactoring Need**: The `content.tsx` file (1,446 lines) is the main technical debt hotspot and should be the first target for modularization.

**Recommended Next Steps**:
1. Split `content.tsx` into 5-7 focused modules
2. Add unit tests for recording and replay logic
3. Remove unused dependencies (Firebase, Axios, jQuery)
4. Decide on Redux usage (migrate more state OR remove entirely)
5. Implement centralized message bus with typed events
6. Add configuration system for locator priorities and timeouts

This analysis provides sufficient detail for an AI code designer to understand the system architecture, identify refactoring opportunities, and plan modular decomposition without re-reading the entire codebase.
