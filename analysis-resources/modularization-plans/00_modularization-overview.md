# MODULARIZATION OVERVIEW

## PURPOSE
This document defines the blueprint for decomposing the Sammy browser automation extension into independent, testable, and maintainable modules. It establishes the architectural boundaries, responsibilities, and interfaces for each subsystem to guide future rebuild efforts.

---

## CURRENT STATE ASSESSMENT

### Monolithic Components
The current codebase has three primary areas of excessive coupling:

1. **content.tsx (1,446 lines)** - Recording + Replay + Label Detection + Element Finding + Iframe Management
2. **Dashboard.tsx (1,286 lines)** - Project CRUD + UI + Navigation + Stats
3. **TestRunner.tsx (809 lines)** - Execution orchestration + Tab management + Result aggregation

### Key Problems
- **Low Testability**: Logic tightly coupled to DOM and Chrome APIs
- **High Cognitive Load**: 200+ line functions with nested conditionals
- **Brittle Behavior**: Hardcoded heuristics for site-specific patterns
- **Difficult Debugging**: No clear boundaries between concerns
- **Poor Reusability**: Cannot use recording logic without entire content script

---

## PROPOSED MODULE ARCHITECTURE

### Module Hierarchy

```
Sammy Extension
│
├── Core Engine Layer
│   ├── Recording Engine
│   ├── Replay Engine
│   └── Locator Strategy System
│
├── Infrastructure Layer
│   ├── Storage Abstraction
│   ├── Message Bus
│   └── Background Service Worker
│
├── Application Layer
│   ├── Test Execution Orchestrator
│   ├── CSV Processing Engine
│   └── Configuration Manager
│
└── Presentation Layer
    ├── UI Component Library
    ├── Dashboard
    ├── Recorder Interface
    ├── Mapper Interface
    └── Runner Interface
```

---

## MODULE DEFINITIONS

### 1. RECORDING ENGINE
**Location**: `src/core/recording/`

#### Responsibilities
- Attach/detach event listeners on target pages
- Capture user interactions (click, input, keydown, etc.)
- Generate element locators (XPath, ID, aria, data-*)
- Extract human-readable labels using pluggable strategies
- Track iframe hierarchy for cross-frame recording
- Handle shadow DOM (open and intercepted closed roots)
- Output structured `RecordedStep` objects

#### Submodules
- **EventListenerManager** - Lifecycle management for DOM event listeners
- **LabelDetectorRegistry** - Pluggable label extraction strategies
  - BootstrapStrategy
  - GoogleFormsStrategy
  - JotformStrategy
  - Select2Strategy
  - GenericAriaStrategy
  - PlaceholderFallbackStrategy
- **LocatorBundleGenerator** - Multi-strategy locator creation
- **IframeTracker** - Iframe chain serialization
- **ShadowDOMHandler** - Open/closed shadow root navigation

#### Interface
```typescript
interface IRecordingEngine {
  start(options: RecordingOptions): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getSteps(): RecordedStep[];
  clearSteps(): void;
  registerLabelStrategy(strategy: ILabelStrategy): void;
  unregisterLabelStrategy(name: string): void;
}

interface ILabelStrategy {
  name: string;
  priority: number;
  detect(element: HTMLElement, context: LabelContext): string | null;
}
```

#### Dependencies
- DOM APIs (addEventListener, querySelector, etc.)
- get-xpath library
- No dependencies on Replay or UI

#### Testing Strategy
- Unit tests: Label strategies with fixture HTML
- Integration tests: Capture events in test iframe
- Mock: Chrome messaging layer

---

### 2. REPLAY ENGINE
**Location**: `src/core/replay/`

#### Responsibilities
- Execute recorded steps in target page context
- Find elements using multi-strategy locator resolution
- Simulate user actions (click, input, focus, blur)
- Inject values into form fields (React-safe controlled input handling)
- Navigate iframe chains
- Handle element visibility and scroll-into-view
- Retry logic with configurable timeouts
- Report step-level success/failure

#### Submodules
- **ElementFinder** - Multi-strategy element resolution with scoring
- **ActionExecutor** - User action simulation registry
  - ClickAction
  - InputAction
  - EnterAction
  - SelectAction
  - NavigateAction
- **ValueInjector** - React/Vue-safe input value setting
- **RetryManager** - Configurable timeout and retry logic
- **VisibilityHandler** - Element reveal and scroll management

#### Interface
```typescript
interface IReplayEngine {
  execute(step: RecordedStep, context: ExecutionContext): Promise<ExecutionResult>;
  executeMultiple(steps: RecordedStep[], context: ExecutionContext): Promise<ExecutionResult[]>;
  registerAction(action: IAction): void;
  configure(config: ReplayConfig): void;
}

interface IAction {
  name: string;
  canHandle(step: RecordedStep): boolean;
  execute(element: HTMLElement, step: RecordedStep): Promise<void>;
}
```

#### Dependencies
- xpath library
- ElementFinder (locator strategies)
- No dependencies on Recording or UI

#### Testing Strategy
- Unit tests: Action executors with mock elements
- Integration tests: Replay in test iframe with known HTML
- Mock: Chrome messaging, tab APIs

---

### 3. LOCATOR STRATEGY SYSTEM
**Location**: `src/core/locators/`

#### Responsibilities
- Provide pluggable element identification strategies
- Score each strategy's confidence for given element
- Return best-match element or null
- Support custom user-defined strategies

#### Built-in Strategies
1. **XPathStrategy** - XPath evaluation (highest priority if exact match)
2. **IDStrategy** - getElementById (fast, unique)
3. **NameStrategy** - querySelector by name attribute
4. **AriaLabelStrategy** - aria-label/aria-labelledby matching
5. **DataAttributeStrategy** - data-* attribute matching
6. **ClassNameStrategy** - className matching (low confidence)
7. **TextContentStrategy** - Fuzzy text matching (fallback)
8. **BoundingBoxStrategy** - Position-based (last resort)

#### Interface
```typescript
interface ILocatorStrategy {
  name: string;
  priority: number;
  find(bundle: LocatorBundle, doc: Document): LocatorResult | null;
}

interface LocatorResult {
  element: HTMLElement;
  confidence: number; // 0-1
  strategy: string;
}
```

#### Configuration
```typescript
interface LocatorConfig {
  strategyOrder: string[]; // Override priority
  enabledStrategies: string[]; // Allow/deny list
  timeoutMs: number;
  retryAttempts: number;
}
```

#### Testing Strategy
- Unit tests: Each strategy with fixture elements
- Integration tests: Multi-strategy scoring
- Performance tests: Large DOM trees

---

### 4. STORAGE ABSTRACTION LAYER
**Location**: `src/infrastructure/storage/`

#### Responsibilities
- Abstract persistence implementation details
- Support multiple storage backends (IndexedDB, chrome.storage, in-memory)
- Provide typed CRUD operations
- Handle migrations and schema versioning

#### Providers
- **IndexedDBProvider** - Dexie-based persistence (production)
- **ChromeStorageProvider** - chrome.storage API (lightweight)
- **InMemoryProvider** - Transient storage (testing)

#### Interface
```typescript
interface IStorageProvider {
  // Projects
  createProject(project: Project): Promise<string>;
  getProject(id: string): Promise<Project | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<void>;
  deleteProject(id: string): Promise<void>;
  listProjects(filter?: ProjectFilter): Promise<Project[]>;
  
  // Test Runs
  createTestRun(run: TestRun): Promise<string>;
  getTestRun(id: string): Promise<TestRun | null>;
  updateTestRun(id: string, updates: Partial<TestRun>): Promise<void>;
  listTestRuns(projectId: string): Promise<TestRun[]>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<Settings>): Promise<void>;
}
```

#### Testing Strategy
- Unit tests: Each provider with mock backends
- Integration tests: Cross-provider data migration
- Performance tests: Large dataset operations

---

### 5. MESSAGE BUS
**Location**: `src/infrastructure/messaging/`

#### Responsibilities
- Centralize all chrome.runtime and chrome.tabs messaging
- Provide strongly-typed message contracts
- Handle request/response pairing
- Implement timeout and error handling
- Support message tracing for debugging

#### Message Types (Strongly Typed)
```typescript
type Message =
  | RecordingMessage
  | ReplayMessage
  | StorageMessage
  | TabManagementMessage
  | UIMessage;

interface RecordingMessage {
  type: 'recording:start' | 'recording:stop' | 'recording:step';
  payload: RecordingPayload;
  requestId?: string;
}

interface ReplayMessage {
  type: 'replay:execute' | 'replay:result' | 'replay:error';
  payload: ReplayPayload;
  requestId?: string;
}
```

#### Interface
```typescript
interface IMessageBus {
  send<T>(message: Message): Promise<T>;
  broadcast(message: Message): void;
  subscribe(type: MessageType, handler: MessageHandler): Unsubscribe;
  request<T>(message: Message, timeout?: number): Promise<T>;
}
```

#### Features
- Automatic request/response correlation via requestId
- Configurable timeouts
- Error propagation with stack traces
- Message history for debugging (dev mode only)

#### Testing Strategy
- Unit tests: Message routing with mock handlers
- Integration tests: Cross-context messaging (background ↔ content)
- Mock: chrome.runtime and chrome.tabs APIs

---

### 6. UI COMPONENT LIBRARY
**Location**: `src/presentation/components/`

#### Responsibilities
- Reusable, accessible UI components
- Consistent styling via Tailwind design system
- Component-level state management (React hooks)
- No business logic (presentation only)

#### Component Categories
- **Layout**: Header, Sidebar, Layout, Section
- **Forms**: Input, Select, Checkbox, Radio, Button
- **Data Display**: Table, Card, Badge, Avatar, Progress
- **Feedback**: Alert, Toast, Dialog, Loader
- **Navigation**: Tabs, Dropdown, Popover
- **Complex**: StepsTable, FieldMappingTable, TestConsole

#### Design System
```typescript
// Design tokens
const colors = { primary, secondary, success, error, warning, info };
const spacing = { xs, sm, md, lg, xl };
const typography = { h1, h2, h3, body, caption };
```

#### Testing Strategy
- Unit tests: Component rendering with React Testing Library
- Visual tests: Storybook snapshots
- Accessibility tests: axe-core integration

---

### 7. CSV PROCESSING ENGINE
**Location**: `src/application/csv/`

#### Responsibilities
- Parse CSV/Excel files
- Auto-map fields to recorded steps using fuzzy matching
- Validate mapped data (type checking, required fields)
- Export test data to CSV/Excel

#### Submodules
- **CSVParser** - PapaParse wrapper
- **ExcelParser** - XLSX wrapper
- **AutoMapper** - Fuzzy string matching for field mapping
- **DataValidator** - Schema validation
- **DataExporter** - CSV/Excel generation

#### Interface
```typescript
interface ICSVProcessor {
  parse(file: File): Promise<ParsedData>;
  autoMap(data: ParsedData, steps: RecordedStep[]): FieldMapping[];
  validate(mapping: FieldMapping[]): ValidationResult;
  export(data: any[], format: 'csv' | 'xlsx'): Blob;
}
```

#### Testing Strategy
- Unit tests: Parsing with fixture files
- Integration tests: Auto-mapping accuracy
- Edge cases: Malformed CSV, special characters

---

### 8. TEST EXECUTION ORCHESTRATOR
**Location**: `src/application/runner/`

#### Responsibilities
- Orchestrate multi-row test execution
- Manage tab lifecycle (open, inject scripts, close)
- Aggregate step-level results into test-level results
- Persist test runs to storage
- Emit progress events for UI updates

#### Workflow
1. Open target URL in new tab
2. Inject content scripts (replay engine)
3. For each CSV row:
   - Send steps to content script with data injection
   - Collect step results
   - Update progress
4. Close tab
5. Aggregate results
6. Save TestRun to storage

#### Interface
```typescript
interface ITestOrchestrator {
  run(project: Project, data: CSVData[]): Promise<TestRunResult>;
  pause(): void;
  resume(): void;
  cancel(): void;
  onProgress(callback: ProgressCallback): Unsubscribe;
}
```

#### Testing Strategy
- Unit tests: Mock tab management and messaging
- Integration tests: End-to-end execution with test project
- Performance tests: Large CSV datasets (100+ rows)

---

### 9. BACKGROUND SERVICE WORKER
**Location**: `src/infrastructure/background/`

#### Responsibilities
- Message routing between UI and content scripts
- Tab lifecycle management
- Script injection coordination
- Storage operation delegation
- Extension lifecycle event handling

#### Refactoring Strategy
- Migrate from procedural message handling to MessageBus
- Delegate storage operations to StorageProvider
- Keep as thin coordinator layer

#### Interface
```typescript
// Background service listens to MessageBus
// and delegates to appropriate subsystems
```

#### Testing Strategy
- Unit tests: Message routing logic
- Integration tests: Cross-context communication
- Mock: Chrome extension APIs

---

### 10. CONTENT SCRIPT SYSTEM
**Location**: `src/infrastructure/content/`

#### Responsibilities
- Load Recording Engine and Replay Engine into target pages
- Coordinate iframe traversal
- Handle shadow DOM interception
- Bridge page context and extension context

#### Modules
- **content-coordinator.ts** - Entry point, loads engines
- **iframe-injector.ts** - Recursive iframe script injection
- **shadow-interceptor.ts** - Monkey-patch attachShadow
- **page-bridge.ts** - window.postMessage coordination

#### Testing Strategy
- Unit tests: Iframe detection logic
- Integration tests: Multi-iframe page scenarios
- Mock: Chrome messaging

---

## MODULARIZATION PRINCIPLES

### 1. Single Responsibility
Each module has one clear, focused purpose. No module should handle recording AND replay.

### 2. Interface-First Design
Define TypeScript interfaces before implementation. All modules expose well-defined contracts.

### 3. Dependency Inversion
High-level modules (UI, Orchestrator) depend on abstractions (interfaces), not concrete implementations.

### 4. Pluggable Strategies
Use strategy pattern for extensible behavior:
- Label detection strategies
- Locator strategies
- Action executors
- Storage providers

### 5. Testability
Every module can be unit tested in isolation with mocked dependencies.

### 6. Configuration Over Hardcoding
Replace hardcoded heuristics with configuration files:
```json
{
  "labelStrategies": ["bootstrap", "aria", "placeholder"],
  "locatorPriorities": ["id", "xpath", "aria"],
  "replayConfig": {
    "timeoutMs": 5000,
    "retryAttempts": 3,
    "scrollBehavior": "smooth"
  }
}
```

### 7. Clear Boundaries
No circular dependencies. Module graph should be acyclic (DAG).

---

## MIGRATION PATH

### Phase 1: Extract Recording Engine (Week 1-2)
**Goal**: Isolate recording logic from content.tsx
- Create `src/core/recording/` structure
- Extract EventListenerManager
- Extract LabelDetectorRegistry with pluggable strategies
- Extract LocatorBundleGenerator
- Write unit tests for each submodule
- Integration test: Record in test iframe
- Update content.tsx to use new RecordingEngine

### Phase 2: Extract Replay Engine (Week 3-4)
**Goal**: Isolate replay logic from content.tsx
- Create `src/core/replay/` structure
- Extract ElementFinder with strategy system
- Extract ActionExecutor registry
- Extract ValueInjector
- Write unit tests for each submodule
- Integration test: Replay in test iframe
- Update content.tsx to use new ReplayEngine

### Phase 3: Create Message Bus (Week 5)
**Goal**: Centralize all messaging logic
- Create `src/infrastructure/messaging/`
- Define strongly-typed message contracts
- Implement MessageBus with request/response pairing
- Migrate background.ts to use MessageBus
- Migrate UI pages to use MessageBus
- Add message tracing for debugging

### Phase 4: Extract Storage Layer (Week 6)
**Goal**: Abstract storage implementation
- Create `src/infrastructure/storage/`
- Define IStorageProvider interface
- Implement IndexedDBProvider (wrap existing Dexie)
- Migrate background.ts to delegate to StorageProvider
- Write unit tests with InMemoryProvider

### Phase 5: Refactor UI Components (Week 7-8)
**Goal**: Break down large UI files
- Split Dashboard.tsx into ProjectList, ProjectCard, CreateProjectDialog
- Split Recorder.tsx into RecorderToolbar, StepsTable, LogPanel
- Split TestRunner.tsx into TestControls, TestProgress, TestConsole
- Extract shared components to UI library
- Add React Testing Library tests

### Phase 6: Extract CSV Processor (Week 9)
**Goal**: Isolate CSV/Excel logic
- Create `src/application/csv/`
- Extract CSVParser, ExcelParser
- Extract AutoMapper with configurable fuzzy threshold
- Extract DataValidator
- Write unit tests with fixture files

### Phase 7: Extract Test Orchestrator (Week 10)
**Goal**: Isolate test execution logic
- Create `src/application/runner/`
- Extract TestOrchestrator from TestRunner.tsx
- Coordinate with MessageBus and StorageProvider
- Write integration tests with mock project

### Phase 8: Add Test Coverage (Week 11-12)
**Goal**: Achieve 80%+ code coverage
- Unit tests for all core modules
- Integration tests for cross-module workflows
- End-to-end tests with Playwright
- Mock Chrome APIs with chrome-extension-mock

### Phase 9: Configuration System (Week 13)
**Goal**: Replace hardcoded values with config
- Create `src/config/` with JSON schemas
- Move label strategies to config
- Move locator priorities to config
- Move replay timeouts to config
- Add UI for user-configurable settings

### Phase 10: Documentation & Cleanup (Week 14)
**Goal**: Finalize modular architecture
- Generate API documentation (TypeDoc)
- Write developer guide
- Remove unused dependencies (Firebase, Axios, jQuery)
- Optimize bundle size
- Performance audit

---

## SUCCESS METRICS

### Code Quality
- [ ] No file exceeds 400 lines
- [ ] No function exceeds 50 lines
- [ ] Cyclomatic complexity < 10 per function
- [ ] Zero circular dependencies

### Test Coverage
- [ ] 80%+ unit test coverage
- [ ] 70%+ integration test coverage
- [ ] 100% coverage for core recording/replay logic

### Performance
- [ ] Content script bundle < 200KB
- [ ] Popup load time < 500ms
- [ ] Recording latency < 50ms per event
- [ ] Replay step execution < 2s average

### Maintainability
- [ ] New developer onboarding < 1 day
- [ ] New label strategy addition < 1 hour
- [ ] New locator strategy addition < 1 hour
- [ ] Bug fix time reduced by 50%

---

## RISKS & MITIGATIONS

### Risk 1: Breaking Changes During Refactor
**Mitigation**: Feature flags, gradual migration, extensive regression testing

### Risk 2: Performance Degradation
**Mitigation**: Benchmark before/after, profiling, bundle size monitoring

### Risk 3: Incomplete Test Coverage
**Mitigation**: Test-driven development, coverage gates in CI

### Risk 4: Over-Engineering
**Mitigation**: Start simple, add abstractions only when needed (YAGNI principle)

---

## NEXT STEPS
1. Review this document with team
2. Prioritize Phase 1 (Recording Engine extraction)
3. Set up testing infrastructure (Jest, React Testing Library, Playwright)
4. Create feature branch for Phase 1
5. Begin implementation with TDD approach
