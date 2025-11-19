# UNIVERSAL MODULARIZATION BLUEPRINT

**Document Version:** 1.0  
**Created:** November 19, 2025  
**Project:** Sammy Browser Automation Recorder (v1.0.9)  
**Purpose:** Master architectural plan for modular rebuild of the automation system

---

## 1. Purpose of Modularization

### Why This Project Benefits from Modular Rebuild

The current Sammy codebase has evolved into a functional but monolithic structure with several critical pain points that modularization will address:

#### **Clarity**
- **Current State**: 1,446-line `content.tsx` combines recording, replay, label detection, iframe management, and shadow DOM handling in one file
- **After Modularization**: Each concern becomes a dedicated module with clear responsibilities, self-documenting interfaces, and single-purpose design
- **Benefit**: New developers can understand individual modules without parsing 1,000+ lines of mixed logic

#### **Testability**
- **Current State**: Monolithic files make unit testing nearly impossible; no test coverage exists
- **After Modularization**: Small, focused modules with dependency injection enable comprehensive unit testing
- **Benefit**: Test each locator strategy, label detection heuristic, and replay action independently with mocked dependencies

#### **Isolated Ownership**
- **Current State**: Changes to label detection risk breaking replay logic; all subsystems tightly coupled
- **After Modularization**: Teams or developers can own specific modules (Recording, Replay, Storage) without stepping on each other
- **Benefit**: Parallel development streams, faster iteration, reduced merge conflicts

#### **Concurrency-Friendly Development**
- **Current State**: Any two developers modifying `content.tsx` will encounter merge conflicts
- **After Modularization**: Recording Engine, Replay Engine, Locator Strategy can be developed simultaneously on separate branches
- **Benefit**: 3-5x faster feature development through true parallelization

#### **Better AI Codegen Alignment**
- **Current State**: AI assistants struggle with context windows when analyzing 1,400+ line files; hallucinate dependencies
- **After Modularization**: Each module fits within AI context limits (200-400 lines), enabling accurate code generation
- **Benefit**: AI tools can suggest refactors, write tests, and implement features module-by-module with high accuracy

#### **Decoupled Subsystems**
- **Current State**: 20+ message types scattered across files; changing one breaks others
- **After Modularization**: Well-defined interfaces (IRecorder, IReplayEngine, IStorageProvider) with typed contracts
- **Benefit**: Swap implementations (e.g., IndexedDB → Remote API) without touching dependent code

#### **Predictable Evolution**
- **Current State**: Adding new locator strategy requires modifying 150-line function; risk of regression
- **After Modularization**: Plugin architecture allows new strategies via class implementation, zero risk to existing strategies
- **Benefit**: Features added without fear of breaking production; rollback by simply disabling plugin

---

## 2. Identified Subsystems

Based on comprehensive analysis of `/workspaces/Sammy/analysis-resources/component-breakdowns/`, the following subsystems have been identified:

- **Background Service** — Service worker coordinator, message routing, tab lifecycle management, script injection orchestration
- **Content Script System** — Dual-mode recording/replay coordination, iframe traversal, shadow DOM penetration, cross-context messaging bridge
- **CSV Processing Engine** — File parsing (CSV/Excel), fuzzy auto-mapping, field validation, data transformation pipeline
- **Locator Strategy System** — Multi-tier element resolution (9 strategies: XPath, ID, name, aria, fuzzy text, bounding box, etc.)
- **Message Bus** — chrome.runtime/tabs messaging abstraction, typed message contracts, request/response pairing, timeout handling
- **Recording Engine** — Event capture, label detection (12+ heuristics), locator generation, bundle creation, real-time transmission
- **Replay Engine** — Element finding, action execution, React-safe input handling, human-like behavior simulation, error recovery
- **Storage Layer** — IndexedDB persistence (Dexie wrapper), project/test run CRUD, query interface, schema migration
- **Test Orchestrator** — Multi-row CSV execution loop, tab pool management, progress tracking, result aggregation, history storage
- **UI Components** — React pages (Dashboard, Recorder, Mapper, Runner), Radix UI primitives, state management, routing

---

## 3. Proposed Module Boundaries

### 3.1 Recording Engine

**External API**:
```typescript
interface IRecordingEngine {
  start(config: RecordingConfig): Promise<void>;
  stop(): Promise<RecordedStep[]>;
  pause(): void;
  resume(): void;
  addEventListener(event: RecordingEvent, handler: EventHandler): void;
  removeEventListener(event: RecordingEvent, handler: EventHandler): void;
}

interface RecordingConfig {
  captureEvents: ('click' | 'input' | 'keydown' | 'mousedown')[];
  labelStrategies: ILabelDetectionStrategy[];
  locatorStrategies: ILocatorStrategy[];
  includeIframes: boolean;
  includeShadowDOM: boolean;
}

interface RecordedStep {
  id: string;
  timestamp: number;
  event: string;
  label: string;
  bundle: LocatorBundle;
}
```

**Internal vs External**:
- **Internal**: Label detection heuristics, event filtering, synthetic event detection, iframe chain serialization
- **External**: Start/stop recording, step stream, configuration
- **Boundary Enforcement**: Private methods for heuristics, public interface for lifecycle control

**Coupling Rules**:
- **Must NOT** depend on: Replay Engine, Test Orchestrator, UI Components
- **May depend on**: Locator Strategy System, Message Bus (for transmission)
- **Injected dependencies**: ILabelDetectionStrategy[], ILocatorStrategy[]

**Well-Defined Interfaces**:
- Plugin architecture for label detection strategies (per-framework: Bootstrap, Material-UI, Google Forms)
- Observer pattern for real-time step events (UI subscribes to recording stream)

---

### 3.2 Replay Engine

**External API**:
```typescript
interface IReplayEngine {
  execute(step: RecordedStep, context: ExecutionContext): Promise<ExecutionResult>;
  executeAll(steps: RecordedStep[], context: ExecutionContext): Promise<ExecutionSummary>;
  setFindTimeout(ms: number): void;
  setRetryConfig(config: RetryConfig): void;
}

interface ExecutionContext {
  document: Document;
  tabId: number;
  iframeChain?: IframeInfo[];
  csvValues?: Record<string, string>;
}

interface ExecutionResult {
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
}
```

**Internal vs External**:
- **Internal**: Multi-strategy element finding, React input property descriptor hacks, event sequence generation, visibility restoration
- **External**: Execute step, configure timeouts/retries, execution results
- **Boundary Enforcement**: Element finding encapsulated in private `ElementFinder` class, not exposed

**Coupling Rules**:
- **Must NOT** depend on: Recording Engine, Test Orchestrator, UI Components
- **May depend on**: Locator Strategy System, Message Bus (for status updates)
- **Injected dependencies**: ILocatorStrategy[], IActionExecutor[]

**Well-Defined Interfaces**:
- Strategy pattern for action executors (ClickExecutor, InputExecutor, SelectExecutor)
- Adapter pattern for framework-specific handling (ReactInputAdapter, Select2Adapter, GoogleAutocompleteAdapter)

---

### 3.3 Locator Strategy System

**External API**:
```typescript
interface ILocatorStrategy {
  readonly name: string;
  readonly priority: number;
  find(bundle: LocatorBundle, document: Document): Element | null;
  confidence(element: Element, bundle: LocatorBundle): number; // 0-1 scale
}

interface ILocatorResolver {
  registerStrategy(strategy: ILocatorStrategy): void;
  unregisterStrategy(name: string): void;
  setStrategyPriority(name: string, priority: number): void;
  find(bundle: LocatorBundle, options: FindOptions): ElementResult | null;
}

interface ElementResult {
  element: Element;
  strategy: string;
  confidence: number;
  attempts: number;
  duration: number;
}
```

**Internal vs External**:
- **Internal**: XPath evaluation, fuzzy text matching algorithms, bounding box distance calculations
- **External**: Strategy registration, element finding, confidence scoring
- **Boundary Enforcement**: Strategy implementations are private classes, only interface exposed

**Coupling Rules**:
- **Must NOT** depend on: Recording Engine, Replay Engine, UI Components, Test Orchestrator
- **May depend on**: Message Bus (for telemetry)
- **Zero dependencies**: Pure DOM logic, fully isolated

**Well-Defined Interfaces**:
- Plugin system for custom strategies (user-defined or site-specific)
- Configuration-driven priority ordering (no hardcoded fallback order)

---

### 3.4 Storage Layer

**External API**:
```typescript
interface IStorageProvider {
  projects: IProjectRepository;
  testRuns: ITestRunRepository;
  settings: ISettingsRepository;
}

interface IProjectRepository {
  create(project: CreateProjectInput): Promise<number>;
  update(id: number, updates: Partial<Project>): Promise<void>;
  get(id: number): Promise<Project | null>;
  list(filter?: ProjectFilter): Promise<Project[]>;
  delete(id: number): Promise<void>;
}

interface ITestRunRepository {
  create(run: CreateTestRunInput): Promise<number>;
  update(id: number, updates: Partial<TestRun>): Promise<void>;
  getByProject(projectId: number): Promise<TestRun[]>;
  delete(id: number): Promise<void>;
}
```

**Internal vs External**:
- **Internal**: Dexie table definitions, query optimization, schema migrations, transaction management
- **External**: CRUD operations, query filters, validation
- **Boundary Enforcement**: Direct Dexie access forbidden; all storage through repository interfaces

**Coupling Rules**:
- **Must NOT** depend on: Any other subsystem (fully isolated)
- **May depend on**: None (lowest layer)
- **Injected dependencies**: None (pure data layer)

**Well-Defined Interfaces**:
- Factory pattern for provider selection (DexieStorageProvider, ChromeStorageProvider, InMemoryProvider)
- Repository pattern for data access (projects, testRuns, settings)

---

### 3.5 Message Bus

**External API**:
```typescript
interface IMessageBus {
  send<T extends Message>(message: T): Promise<ResponseFor<T>>;
  on<T extends Message>(
    messageType: T['type'],
    handler: MessageHandler<T>
  ): UnsubscribeFn;
  use(middleware: MessageMiddleware): void;
}

interface Message {
  type: string;
  requestId?: string;
  timestamp?: number;
  sender?: string;
}

interface MessageMiddleware {
  before?(message: Message): Message | void;
  after?(response: Response): Response | void;
  error?(error: Error): Error | void;
}
```

**Internal vs External**:
- **Internal**: chrome.runtime/tabs API calls, request ID generation, timeout management, channel lifecycle
- **External**: Type-safe message sending, handler registration, middleware
- **Boundary Enforcement**: Chrome APIs encapsulated; consumers never touch chrome.runtime directly

**Coupling Rules**:
- **Must NOT** depend on: Any other subsystem (infrastructure layer)
- **May depend on**: None
- **Used by**: All other subsystems for communication

**Well-Defined Interfaces**:
- Typed message contracts (compile-time safety for message structure)
- Middleware pipeline (logging, validation, retry, caching)

---

### 3.6 Test Orchestrator

**External API**:
```typescript
interface ITestOrchestrator {
  run(config: TestConfig): Promise<TestRunResult>;
  pause(): void;
  resume(): void;
  stop(): void;
  on(event: OrchestratorEvent, handler: EventHandler): UnsubscribeFn;
}

interface TestConfig {
  projectId: number;
  csvRows?: any[];
  parallelism?: number; // 1 = sequential, >1 = parallel tabs
  retryConfig?: RetryConfig;
  delayConfig?: DelayConfig;
}

interface TestRunResult {
  totalRows: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  duration: number;
  rowResults: RowResult[];
}
```

**Internal vs External**:
- **Internal**: Row iteration loop, CSV value mapping, tab pool management, timing control
- **External**: Run/pause/stop, configuration, progress events, final results
- **Boundary Enforcement**: Execution logic private; only lifecycle and events exposed

**Coupling Rules**:
- **Must depend on**: Replay Engine, Storage Layer, Message Bus
- **Must NOT** depend on: Recording Engine, UI Components
- **Injected dependencies**: IReplayEngine, IStorageProvider, ITabManager

**Well-Defined Interfaces**:
- Observer pattern for progress events (UI subscribes to step completion, row completion)
- Strategy pattern for execution modes (sequential, parallel, debug)

---

### 3.7 CSV Processing Engine

**External API**:
```typescript
interface ICSVProcessor {
  parse(file: File): Promise<CSVData>;
  validate(data: CSVData): ValidationResult;
  preview(data: CSVData, rowCount: number): CSVRow[];
}

interface IFieldMapper {
  autoMap(
    csvHeaders: string[],
    stepLabels: string[],
    config: MappingConfig
  ): Mapping[];
  validateMappings(mappings: Mapping[]): ValidationResult;
}

interface MappingConfig {
  similarityThreshold: number; // 0-1 scale
  normalizationRules: NormalizationRules;
  requireAllFieldsMapped: boolean;
}
```

**Internal vs External**:
- **Internal**: PapaParse/XLSX parsing, string similarity algorithms, normalization logic
- **External**: Parse, validate, map, configure
- **Boundary Enforcement**: Parser libraries hidden; only parsed data exposed

**Coupling Rules**:
- **Must NOT** depend on: Recording, Replay, Orchestrator, UI
- **May depend on**: Storage Layer (to save mappings)
- **Injected dependencies**: None (pure data processing)

**Well-Defined Interfaces**:
- Provider pattern for file formats (CSVParser, ExcelParser, JSONParser)
- Configuration-driven mapping (no hardcoded thresholds)

---

### 3.8 Background Service

**External API**:
```typescript
interface IBackgroundService {
  // No public API (messaging only)
}

// Internal structure (not exposed)
interface MessageRouter {
  register(action: string, handler: MessageHandler): void;
  route(message: Message, sender: Sender): Promise<Response>;
}

interface TabManager {
  open(url: string): Promise<number>;
  close(tabId: number): Promise<void>;
  inject(tabId: number, scriptPath: string): Promise<void>;
  track(tabId: number): void;
}
```

**Internal vs External**:
- **Internal**: Message routing table, tab lifecycle tracking, script injection, state persistence
- **External**: None (service worker only responds to messages)
- **Boundary Enforcement**: All interactions via chrome.runtime.sendMessage

**Coupling Rules**:
- **Must depend on**: Storage Layer (for message-based CRUD routing)
- **Must NOT** depend on: UI Components, Recording, Replay
- **Injected dependencies**: IStorageProvider, IMessageBus

**Well-Defined Interfaces**:
- Message router with pluggable handlers (no if/else chain)
- Tab manager as separate concern (lifecycle, injection, tracking)

---

### 3.9 Content Script System

**External API**:
```typescript
interface IContentScriptCoordinator {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  setMode(mode: 'recording' | 'replay' | 'idle'): void;
}

// Internal coordinators (not exposed)
interface IframeCoordinator {
  attachToAll(): void;
  detachAll(): void;
  onIframeAdded(callback: IframeCallback): UnsubscribeFn;
}

interface ShadowDOMHandler {
  interceptClosedRoots(): void;
  findInShadow(xpath: string, root: ShadowRoot): Element | null;
}
```

**Internal vs External**:
- **Internal**: Iframe traversal, shadow DOM monkey-patching, script injection, message bridging
- **External**: Initialize/shutdown, mode switching
- **Boundary Enforcement**: Iframe and shadow DOM logic fully encapsulated

**Coupling Rules**:
- **Must depend on**: Recording Engine, Replay Engine, Message Bus
- **Must NOT** depend on: Test Orchestrator, UI Components
- **Injected dependencies**: IRecordingEngine, IReplayEngine, IMessageBus

**Well-Defined Interfaces**:
- Coordinator pattern for mode switching (recording vs replay)
- Observer pattern for iframe lifecycle events

---

### 3.10 UI Components

**External API**:
```typescript
// React Components (no formal interface, component contracts)
<Dashboard />
<Recorder projectId={string} />
<FieldMapper projectId={string} />
<TestRunner projectId={string} />

// Custom Hooks
function useProjects(): ProjectsHook;
function useRecording(projectId: string): RecordingHook;
function useTestExecution(projectId: string): ExecutionHook;
```

**Internal vs External**:
- **Internal**: Component state, useEffect hooks, event handlers, form validation
- **External**: React components, custom hooks, prop contracts
- **Boundary Enforcement**: Business logic extracted to hooks; components are pure presentation

**Coupling Rules**:
- **Must depend on**: Message Bus (for backend communication), Storage Layer (indirect via messages)
- **Must NOT** depend on**: Recording, Replay, Orchestrator directly (only via Message Bus)
- **Injected dependencies**: None (uses hooks for dependency injection)

**Well-Defined Interfaces**:
- Custom hooks abstract business logic (useProjects, useRecording, useTestExecution)
- Component contracts via TypeScript prop interfaces

---

## 4. Migration & Rebuild Strategy

### 4.1 Dependency Graph & Build Order

```
Layer 1 (Foundation - No Dependencies):
  ├─ Storage Layer
  ├─ Locator Strategy System
  └─ CSV Processing Engine

Layer 2 (Infrastructure - Depends on Layer 1):
  ├─ Message Bus
  └─ (Message Bus has no storage deps)

Layer 3 (Core Logic - Depends on Layers 1-2):
  ├─ Recording Engine (depends on: Locator Strategy, Message Bus)
  ├─ Replay Engine (depends on: Locator Strategy, Message Bus)
  └─ Background Service (depends on: Storage Layer, Message Bus)

Layer 4 (Coordination - Depends on Layers 1-3):
  ├─ Content Script System (depends on: Recording, Replay, Message Bus)
  └─ Test Orchestrator (depends on: Replay, Storage, Message Bus)

Layer 5 (Presentation - Depends on Layers 1-4):
  └─ UI Components (depends on: Message Bus, Test Orchestrator)
```

### 4.2 Phase-by-Phase Rebuild Plan

#### **Phase 1: Foundation Layer (Weeks 1-3)**
**Goal**: Build lowest-risk, zero-dependency modules

**Subsystems**:
1. **Storage Layer** (Week 1)
   - Extract Dexie wrapper into `IStorageProvider` interface
   - Implement DexieStorageProvider, InMemoryProvider
   - Add validation layer (ProjectValidator, TestRunValidator)
   - Write unit tests (mock Dexie, test CRUD operations)
   - **Parallelizable**: Can be developed on separate branch

2. **Locator Strategy System** (Week 2)
   - Extract `findElementFromBundle()` into `LocatorResolver`
   - Implement strategy classes: XPathStrategy, IDStrategy, NameStrategy, AriaStrategy, FuzzyTextStrategy, BoundingBoxStrategy
   - Add configuration layer (priority, thresholds, timeouts)
   - Write unit tests (mock DOM, test each strategy independently)
   - **Parallelizable**: No dependencies on Storage Layer

3. **CSV Processing Engine** (Week 3)
   - Extract CSV/Excel parsing into `CSVProcessor`
   - Extract auto-mapping into `FieldMapper`
   - Add configuration for thresholds and normalization rules
   - Write unit tests (test with sample CSV files)
   - **Parallelizable**: Standalone data processing module

**Success Criteria**:
- All Layer 1 modules have >80% test coverage
- No circular dependencies
- Each module runs in isolation (unit tests pass without browser context)

---

#### **Phase 2: Infrastructure Layer (Weeks 4-5)**
**Goal**: Build communication backbone

**Subsystems**:
1. **Message Bus** (Weeks 4-5)
   - Define typed message contracts (TypeScript interfaces for all 20+ actions)
   - Implement MessageBus class with send/on/use methods
   - Add middleware support (logging, validation, retry, telemetry)
   - Extract Background Service message routing into MessageRouter
   - Write integration tests (test message flow between contexts)
   - **Depends on**: None (but will be used by all other modules)

**Success Criteria**:
- Compile-time type safety for all messages
- Middleware pipeline functional (logs, validates, retries)
- Background Service uses MessageRouter (no more if/else chain)

---

#### **Phase 3: Core Logic Layer (Weeks 6-9)**
**Goal**: Extract recording, replay, and background coordination

**Subsystems** (Can be parallelized across 3 developers):

1. **Recording Engine** (Weeks 6-7, Developer A)
   - Split `content.tsx` recording logic into modules:
     - EventListenerManager (attach/detach)
     - LabelDetectionEngine (12+ heuristics as plugins)
     - BundleBuilder (package locator data)
   - Implement IRecordingEngine interface
   - Add plugin system for label detection strategies
   - Write unit tests (mock DOM events, test label detection)
   - **Depends on**: Locator Strategy, Message Bus

2. **Replay Engine** (Weeks 6-7, Developer B)
   - Split `content.tsx` replay logic into modules:
     - ElementFinder (uses Locator Strategy System)
     - ActionExecutor (ClickExecutor, InputExecutor, SelectExecutor)
     - FrameworkAdapters (ReactInputAdapter, Select2Adapter, GoogleAutocompleteAdapter)
   - Implement IReplayEngine interface
   - Write integration tests (test with mock DOM)
   - **Depends on**: Locator Strategy, Message Bus

3. **Background Service** (Week 8, Developer C)
   - Extract TabManager (open, close, inject, track)
   - Refactor message handlers to use MessageRouter
   - Add state persistence (chrome.storage for tab tracking)
   - Write integration tests (test tab lifecycle, message routing)
   - **Depends on**: Storage Layer, Message Bus

**Success Criteria**:
- Recording and Replay engines testable without full extension context
- Background Service no longer has 20+ if/else handlers
- No regressions (current functionality preserved)

---

#### **Phase 4: Coordination Layer (Weeks 10-12)**
**Goal**: Orchestrate subsystems

**Subsystems**:

1. **Content Script System** (Week 10)
   - Extract IframeCoordinator (attach listeners, track iframes)
   - Extract ShadowDOMHandler (intercept closed roots, traverse)
   - Implement ContentScriptCoordinator (mode switching: recording/replay/idle)
   - Write integration tests (test iframe traversal, shadow DOM)
   - **Depends on**: Recording Engine, Replay Engine, Message Bus

2. **Test Orchestrator** (Weeks 11-12)
   - Extract TestExecutor (row iteration, step sequencing)
   - Extract TabPool (manage multiple tabs for parallel execution)
   - Extract ResultCollector (aggregate results, save to storage)
   - Implement ITestOrchestrator interface
   - Add configuration (parallelism, retries, delays)
   - Write integration tests (test multi-row execution, error handling)
   - **Depends on**: Replay Engine, Storage Layer, Message Bus

**Success Criteria**:
- Content Script System cleanly separates recording/replay concerns
- Test Orchestrator supports parallel execution (configurable tab count)
- Checkpointing enabled (can resume from middle of test run)

---

#### **Phase 5: Presentation Layer (Weeks 13-14)**
**Goal**: Refactor UI components

**Subsystems**:
1. **UI Components** (Weeks 13-14)
   - Split large page components:
     - Dashboard → ProjectList, ProjectCard, ProjectActions, ProjectStats
     - Recorder → RecordingToolbar, StepsList, StepEditor, LogViewer
     - Field Mapper → CSVUploader, MappingTable, AutoMapper
     - Test Runner → ExecutionControls, StepProgress, ConsoleOutput, ResultsView
   - Extract custom hooks (useProjects, useRecording, useTestExecution)
   - Add React Context for cross-component state
   - Write component tests (React Testing Library)
   - **Depends on**: Message Bus, Test Orchestrator (indirect)

**Success Criteria**:
- All page components <400 lines
- Custom hooks encapsulate business logic
- Component tests cover user flows (create project, record step, run test)

---

### 4.3 What Can Be Parallelized

**Concurrent Development Streams**:

**Stream 1: Storage & Data (Developer A)**
- Phase 1: Storage Layer (Week 1)
- Phase 1: CSV Processing Engine (Week 3)
- Phase 3: Background Service storage coordination (Week 8)

**Stream 2: Locators & Recording (Developer B)**
- Phase 1: Locator Strategy System (Week 2)
- Phase 3: Recording Engine (Weeks 6-7)
- Phase 4: Content Script System (Week 10)

**Stream 3: Replay & Execution (Developer C)**
- Phase 2: Message Bus (Weeks 4-5)
- Phase 3: Replay Engine (Weeks 6-7)
- Phase 4: Test Orchestrator (Weeks 11-12)

**Stream 4: UI (Developer D, starts Week 13)**
- Phase 5: UI Components (Weeks 13-14)

**Cross-Stream Synchronization Points**:
- **Week 3 End**: Layer 1 integration (all three streams merge, test together)
- **Week 5 End**: Message Bus complete (all streams switch to using it)
- **Week 9 End**: Core Logic integration (recording + replay + background tested together)
- **Week 12 End**: Full system integration (all layers tested together)
- **Week 14 End**: Final release (UI + all subsystems)

---

### 4.4 Rebuild Order Summary

**Must Be Rebuilt First**:
1. Storage Layer (foundation for all persistence)
2. Locator Strategy System (used by both Recording and Replay)
3. Message Bus (infrastructure for all communication)

**Can Be Rebuilt in Parallel**:
- Recording Engine + Replay Engine (both depend on Locator Strategy + Message Bus, but independent of each other)
- CSV Processing Engine (standalone, no dependencies)

**Must Be Rebuilt Last**:
1. Content Script System (depends on Recording + Replay)
2. Test Orchestrator (depends on Replay + Storage)
3. UI Components (depends on all subsystems)

**Dependency Order**:
```
Storage Layer → Background Service
Locator Strategy → Recording Engine → Content Script System
Locator Strategy → Replay Engine → Test Orchestrator
Message Bus → All subsystems
CSV Processing → Field Mapper UI
All subsystems → UI Components
```

---

## 5. Risks & Constraints

### 5.1 Potential Breakages

#### **High-Risk Areas**:

1. **Shadow DOM Monkey-Patching**
   - **Risk**: Refactoring shadow DOM interception could break Google Autocomplete handling
   - **Current**: `Element.prototype.attachShadow` override in page-interceptor.tsx
   - **Mitigation**: Isolate shadow DOM logic in ShadowDOMHandler module; extensive testing with Google Forms
   - **Fallback**: Graceful degradation if closed shadow roots inaccessible

2. **React Input Property Descriptor Hack**
   - **Risk**: Extracting React input handling could break value injection
   - **Current**: Uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set`
   - **Mitigation**: Create ReactInputAdapter with comprehensive tests on controlled inputs
   - **Fallback**: Fallback to standard `element.value = x` if property descriptor unavailable

3. **XPath Generation for Dynamic Content**
   - **Risk**: Changing XPath generation logic could break replay on dynamic pages
   - **Current**: Sibling-indexed XPath in `getXPath()`
   - **Mitigation**: Extensive regression testing with recorded projects; version XPath strategy
   - **Fallback**: Fallback to ID/name/aria strategies if XPath fails

4. **Chrome Message Channel Timing**
   - **Risk**: Refactoring message passing could introduce race conditions
   - **Current**: Relies on `return true` to keep async channels open
   - **Mitigation**: Message Bus handles channel lifecycle transparently; integration tests
   - **Fallback**: Add timeout + retry logic in Message Bus middleware

5. **Service Worker Termination State Loss**
   - **Risk**: Moving tab tracking to TabManager could lose state on worker restart
   - **Current**: `openedTabId` and `trackedTabs` are in-memory only
   - **Mitigation**: Persist tab state to chrome.storage.local; restore on wake
   - **Fallback**: Re-inject scripts if state lost (detected via health check ping)

---

### 5.2 Tight Couplings That Must Be Loosened

#### **Current Tight Couplings**:

1. **Recording + Replay in Same File (content.tsx)**
   - **Coupling**: Both share same event listener infrastructure, label detection code
   - **Loosening**: Split into separate IRecordingEngine and IReplayEngine with shared dependencies injected
   - **Benefit**: Test recording without replay logic; swap replay engine without touching recording

2. **Label Detection Hardcoded to Recording**
   - **Coupling**: 12+ heuristics embedded in `getLabelForTarget()` function
   - **Loosening**: Extract to plugin-based LabelDetectionEngine with strategy registration
   - **Benefit**: Add site-specific strategies (e.g., SalesforceStrategy) without modifying core

3. **Message Types as Magic Strings**
   - **Coupling**: `message.action === "add_project"` repeated across files
   - **Loosening**: Define typed message contracts with discriminated unions
   - **Benefit**: Compile-time safety; refactoring action names becomes safe

4. **UI Components Directly Calling chrome.runtime.sendMessage**
   - **Coupling**: Every UI component knows Chrome extension API details
   - **Loosening**: Abstract behind hooks (useProjects, useRecording) that use Message Bus
   - **Benefit**: UI testable without chrome APIs; portable to web version

5. **Storage Operations in Background Script**
   - **Coupling**: Background script contains Dexie calls mixed with message routing
   - **Loosening**: Extract storage to IStorageProvider; background only routes messages
   - **Benefit**: Swap storage backend (IndexedDB → Remote API) without touching background script

6. **Test Orchestrator Embedded in UI (TestRunner.tsx)**
   - **Coupling**: 809-line TestRunner.tsx contains execution loop + UI rendering
   - **Loosening**: Extract TestOrchestrator as separate module; UI subscribes to events
   - **Benefit**: Test orchestration logic without rendering React components

---

### 5.3 Technical Debt Blocking Modularity

#### **Must Be Resolved Before Modularization**:

1. **No Unit Tests**
   - **Debt**: Zero test coverage makes refactoring risky
   - **Blocker**: Can't verify module correctness after extraction
   - **Resolution**: Write integration tests for current system BEFORE refactoring; these become regression tests

2. **Inconsistent Error Handling**
   - **Debt**: Some functions throw, some return null, some set error state
   - **Blocker**: Module interfaces need consistent error contracts
   - **Resolution**: Define error handling strategy (all modules return Result<T, Error> or throw exceptions)

3. **Mixed Async Patterns**
   - **Debt**: Callbacks, Promises, async/await all mixed
   - **Blocker**: Message Bus requires consistent async patterns
   - **Resolution**: Standardize on Promises/async-await; convert callbacks to Promises

4. **Global State in Content Scripts**
   - **Debt**: `isRecording`, `recordedSteps` are module-level globals in content.tsx
   - **Blocker**: Stateful modules can't be tested in isolation
   - **Resolution**: Encapsulate state in classes (RecordingEngine has internal state, not global)

5. **Unused Dependencies**
   - **Debt**: Firebase, Axios, jQuery included but unused
   - **Blocker**: Bundle size bloat; confusion about what's actually needed
   - **Resolution**: Remove unused deps; audit package.json before rebuild

6. **Redux Underutilized**
   - **Debt**: Redux setup for theme only; most state in local hooks
   - **Blocker**: Unclear whether to use Redux for global state in modular design
   - **Resolution**: Decide: Fully commit to Redux OR remove it entirely; Document decision

---

### 5.4 Unclear Responsibilities

#### **Areas Needing Clarification**:

1. **Who Manages Tab Lifecycle?**
   - **Current**: Background Service opens tabs, Test Orchestrator tracks them, UI closes them
   - **Unclear**: Single owner for tab state
   - **Resolution**: TabManager module owns all tab operations; other modules request via interface

2. **Where Should CSV Value Injection Happen?**
   - **Current**: Test Orchestrator injects CSV values into steps before sending to Replay Engine
   - **Unclear**: Should Replay Engine handle this?
   - **Resolution**: Keep in Orchestrator (data preparation); Replay Engine only executes pre-populated steps

3. **Is Message Bus or Background Service the Coordinator?**
   - **Current**: Background routes messages, but also manages tabs and storage
   - **Unclear**: Too many responsibilities
   - **Resolution**: Background Service uses Message Bus for routing; delegates storage to IStorageProvider, tabs to TabManager

4. **Should Content Script System Own Shadow DOM Handling?**
   - **Current**: Page-interceptor.tsx runs in page context, content.tsx in content script context
   - **Unclear**: Two separate concerns or one subsystem?
   - **Resolution**: Content Script System coordinates both (IframeCoordinator + ShadowDOMHandler as internal modules)

5. **Who Owns Retry Logic?**
   - **Current**: Element finding has timeouts, Test Orchestrator has step retries
   - **Unclear**: Duplicate retry logic in multiple places
   - **Resolution**: Locator Strategy has find-level retries; Test Orchestrator has step-level retries; Message Bus has message-level retries (layered approach)

---

### 5.5 High-Risk Refactor Areas

#### **Proceed with Extreme Caution**:

1. **content.tsx Splitting** (Highest Risk)
   - **Reason**: 1,446 lines with recording + replay + iframe + shadow DOM + label detection
   - **Risk**: Breaking existing projects, replay failures, missed edge cases
   - **Caution**: Incremental extraction (one subsystem at a time), extensive regression testing, feature flags for new code

2. **Label Detection Extraction**
   - **Reason**: 200+ lines of hardcoded heuristics for 12+ site patterns
   - **Risk**: Regressions on specific sites (Google Forms, Jotform, Bootstrap layouts)
   - **Caution**: Test suite with examples from each site type; fallback to old heuristics if new plugin system fails

3. **XPath Strategy Changes**
   - **Reason**: Recorded steps rely on XPath format staying consistent
   - **Risk**: Existing recordings become unplayable
   - **Caution**: Version XPath strategies (v1 = current, v2 = new); auto-migrate or support both

4. **Message Protocol Changes**
   - **Reason**: 20+ message types used across extension
   - **Risk**: Incompatibility between old and new message formats
   - **Caution**: Maintain backward compatibility; add version field to messages; graceful fallback

5. **Storage Schema Migration**
   - **Reason**: Adding fields to Project/TestRun tables
   - **Risk**: Data loss, query failures on old data
   - **Caution**: Use Dexie migration system; test on copies of production data; provide rollback path

---

## 6. Modularization Success Criteria

### 6.1 Stable External API

**Definition**: Module interfaces do not change frequently; breaking changes are rare.

**Metrics**:
- [ ] All modules have documented TypeScript interfaces (IRecordingEngine, IReplayEngine, IStorageProvider, etc.)
- [ ] Semantic versioning for each module (major.minor.patch)
- [ ] Breaking changes require major version bump and migration guide
- [ ] Public API surface <20% of module code (most code is internal)
- [ ] API documentation generated from TypeScript (e.g., TypeDoc)

**Measurement**:
- Track API change frequency per module (goal: <1 breaking change per quarter)
- Consumer satisfaction: Internal developers rate API stability (goal: 4/5 average)

---

### 6.2 No Circular Dependencies

**Definition**: Module dependency graph is a DAG (directed acyclic graph); no cycles.

**Metrics**:
- [ ] Automated dependency graph generation (e.g., madge, dependency-cruiser)
- [ ] CI pipeline fails if circular dependency detected
- [ ] Each module lists its dependencies in package.json or module manifest
- [ ] Layer architecture enforced (Layer N can only depend on Layer N-1 or lower)

**Measurement**:
- Run `madge --circular src/` (must output: "No circular dependencies found")
- Dependency graph visualization shows clear layering (no backward arrows)

**Example Allowed**:
```
UI → Test Orchestrator → Replay Engine → Locator Strategy
```

**Example Forbidden**:
```
Recording Engine → Message Bus → Background Service → Recording Engine (cycle!)
```

---

### 6.3 Strict Layering Rules

**Definition**: Modules respect layer boundaries; higher layers depend on lower, never reverse.

**Layers** (from bottom to top):
1. **Foundation**: Storage Layer, Locator Strategy, CSV Processing
2. **Infrastructure**: Message Bus
3. **Core Logic**: Recording Engine, Replay Engine, Background Service
4. **Coordination**: Content Script System, Test Orchestrator
5. **Presentation**: UI Components

**Rules**:
- Layer N can import from Layer N-1, N-2, ..., 1
- Layer N cannot import from Layer N+1 or higher
- Modules within same layer can import each other ONLY if no circular dependency

**Enforcement**:
- [ ] ESLint plugin (e.g., eslint-plugin-import) enforces layer rules
- [ ] CI pipeline rejects PRs violating layering
- [ ] Folder structure mirrors layers (`src/foundation/`, `src/infrastructure/`, etc.)

**Measurement**:
- Zero lint errors for layer violations
- Dependency graph grouped by layer (clear visual separation)

---

### 6.4 Testable Without Browser

**Definition**: Core logic modules run in Node.js test environment; no browser required.

**Metrics**:
- [ ] Storage Layer tests run with in-memory provider (no IndexedDB)
- [ ] Locator Strategy tests run with jsdom (mock DOM)
- [ ] Recording Engine tests use synthetic events (no real browser interactions)
- [ ] Replay Engine tests use mock elements (no chrome.tabs API)
- [ ] Message Bus tests use mock chrome APIs (no extension runtime)

**Coverage Targets**:
- Foundation Layer: 90% coverage (Storage, Locator, CSV)
- Infrastructure Layer: 85% coverage (Message Bus)
- Core Logic Layer: 80% coverage (Recording, Replay, Background)
- Coordination Layer: 75% coverage (Content Script, Orchestrator)
- Presentation Layer: 70% coverage (UI Components)

**Measurement**:
- `npm test` runs without browser (jest with jsdom)
- Code coverage report shows per-module coverage
- CI fails if coverage drops below thresholds

---

### 6.5 Each Module Shippable Independently

**Definition**: Modules can be published, versioned, and updated without touching other modules.

**Requirements**:
- [ ] Each module has own package.json (if using npm workspaces or monorepo)
- [ ] Module can be imported standalone: `import { IRecordingEngine } from '@sammy/recording-engine'`
- [ ] Module has independent changelog (CHANGELOG.md per module)
- [ ] Module has independent tests (tests pass with only module + its dependencies)
- [ ] Module has independent build output (dist/ folder per module)

**Example Structure**:
```
src/
  modules/
    recording-engine/
      package.json
      src/
        index.ts (exports IRecordingEngine, RecordingEngine class)
        EventListenerManager.ts
        LabelDetectionEngine.ts
        BundleBuilder.ts
      tests/
        RecordingEngine.test.ts
      dist/
        index.js
        index.d.ts
      CHANGELOG.md

    replay-engine/
      package.json
      src/
        index.ts (exports IReplayEngine, ReplayEngine class)
      tests/
      dist/
      CHANGELOG.md
```

**Measurement**:
- Each module builds independently: `cd src/modules/recording-engine && npm run build`
- Modules published to internal npm registry (or used as local packages)
- Version bumps only affect changed modules (not entire monolith)

---

### 6.6 Additional Success Criteria

#### **Performance**:
- [ ] Modular build time <2x slower than monolithic build (acceptable overhead)
- [ ] Runtime performance unchanged (no regression in recording/replay speed)
- [ ] Bundle size reduced by 20% (tree-shaking unused modules)

#### **Developer Experience**:
- [ ] Onboarding time reduced by 50% (new developers understand one module at a time)
- [ ] Module documentation complete (README.md per module with usage examples)
- [ ] Hot module reload works per-module (change Recording Engine, only it rebuilds)

#### **Observability**:
- [ ] Each module emits telemetry (execution time, success/failure rates)
- [ ] Module health dashboard (monitor Recording Engine success rate, Replay Engine latency, etc.)
- [ ] Error logging includes module name + version (easier debugging)

---

## 7. Conclusion

This modularization blueprint provides a comprehensive, actionable plan to transform Sammy from a monolithic extension into a maintainable, testable, and extensible modular system. The phased approach (14 weeks) balances risk mitigation with development velocity, enabling parallel workstreams while enforcing strict architectural boundaries.

**Key Outcomes**:
- **10 Well-Defined Modules**: Each with clear responsibilities, interfaces, and boundaries
- **5-Layer Architecture**: Foundation → Infrastructure → Core Logic → Coordination → Presentation
- **4 Parallelizable Workstreams**: Independent development reduces total time by 40%
- **6 Success Criteria**: Measurable metrics ensure modularization goals are achieved
- **Zero Functionality Regression**: Incremental migration preserves all existing features

**Next Steps**:
1. Review and approve blueprint with stakeholders
2. Set up project tracking (Jira/GitHub issues per module)
3. Begin Phase 1 (Foundation Layer) with Storage Layer extraction
4. Iterate weekly with integration tests to catch regressions early

**Long-Term Vision**:
- Modular architecture enables AI-assisted development (each module fits in context window)
- Plugin system allows community contributions (custom label detection strategies, locator strategies)
- Clean boundaries support future features (cloud sync, team collaboration, browser portability)

---

**Blueprint Version:** 1.0  
**Status:** Ready for Implementation  
**Estimated Effort:** 14 weeks (4 developers, parallel workstreams)  
**Risk Level:** Medium (mitigated by phased approach and extensive testing)
