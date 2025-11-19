# high-level-implementation.md

## Purpose
Systematic approach guide for AI code designers working on Sammy browser automation extension, establishing rules, priorities, and workflows for modular refactoring and feature implementation while maintaining quality and stability.

## Inputs
- Existing codebase: 1,446-line monolithic content.tsx, 809-line TestRunner, 1,286-line Dashboard
- Analysis resources: component breakdowns, modularization plans, architecture docs in analysis-resources/ directory
- Requirements: Feature requests, bug reports, refactoring goals
- Constraints: Zero test coverage, no CI/CD, Manifest V3 service worker limitations

## Outputs
- Refactored modules: Extracted services following single responsibility principle
- Unit tests: 80%+ coverage for core modules (Recording, Replay, Storage)
- Integration tests: Cross-module workflow validation
- Documentation: Updated breakdown docs, implementation guides, API docs
- Pull requests: Incremental changes with clear commit messages, test results, coverage reports

## Internal Architecture
- **Guiding Principles**: (1) Resource library first - read breakdowns/plans before coding, (2) Test-driven development - write tests before implementation, (3) Incremental migration - one module at a time with adapter layers, (4) Interface-first design - define TypeScript interfaces before implementation, (5) Configuration over hardcoding - externalize magic numbers and heuristics
- **Implementation Priorities**: Phase 1 Foundation (Weeks 1-5): Recording Engine, Replay Engine, Message Bus extraction; Phase 2 Infrastructure (Weeks 6-8): Storage abstraction, UI component refactoring; Phase 3 Application Logic (Weeks 9-10): CSV processing, Test orchestrator; Phase 4 Quality (Weeks 11-14): Test coverage, configuration system, performance optimization
- **Module Boundaries**: Dependency rules (UI → Application → Core Engine → Infrastructure → Foundation), forbidden circular dependencies, enforced via ESLint no-cycle rule
- **Code Quality Standards**: Max 400 lines per file, 50 lines per function, cyclomatic complexity < 10, JSDoc for all public interfaces
- **Testing Strategy**: Unit tests with mocks, integration tests with minimal mocking, E2E tests with Playwright for Chrome extension

## Critical Dependencies
- **Analysis Resources**: component-breakdowns/ (10 files), modularization-plans/ (9 files), implementation-guides/ (6 files), _RESOURCE_MAP.md master index
- **Testing Tools**: Jest for unit tests, React Testing Library for UI tests, Playwright for E2E extension testing
- **Quality Tools**: ESLint with no-cycle plugin, TypeScript strict mode, tsc --noEmit for type checking
- **Build Tools**: Vite for bundling, TypeScript for compilation, SWC for fast transpilation

## Hidden Assumptions
- Modularization plans are authoritative - follow prescribed boundaries unless explicitly revised
- Test coverage targets are minimums - 80% core, 70% UI, not maximums
- Incremental migration assumes backward compatibility via adapter pattern
- Interface-first design assumes TypeScript interfaces enforced at compile time (not runtime)
- Configuration layer assumes JSON format - no support for executable code in config
- Message bus refactoring assumes synchronous sendResponse callback pattern preserved

## Stability Concerns
- **No Test Coverage**: Existing code has zero tests - refactoring without tests risks regressions
- **Monolithic Files**: 1,446-line content.tsx requires careful extraction to avoid breaking dependencies
- **Service Worker Constraints**: Background script can suspend mid-operation - no in-memory state persistence
- **Type Safety Gaps**: TypeScript types only compile-time - runtime validation missing for messages, storage, config
- **Circular Dependency Risk**: Current architecture has implicit cycles - ESLint enforcement critical
- **Breaking Changes**: Interface changes break all recorded tests - must maintain bundle structure compatibility

## Edge Cases
- **Partial Migration**: If adapter layers not removed after migration, creates performance overhead
- **Test Fixture Maintenance**: Large DOM fixtures for testing may become stale as site structures evolve
- **Configuration Schema Evolution**: Adding new config options requires migration logic for existing projects
- **Concurrent Refactoring**: Multiple developers extracting different modules - merge conflicts likely
- **E2E Test Flakiness**: Playwright tests may fail intermittently due to timing issues or service worker suspension
- **Bundle Structure Changes**: Any modification to Bundle interface breaks all existing recorded tests - requires migration

## Developer-Must-Know Notes
- ALWAYS read component breakdown + modularization plan BEFORE starting extraction
- Write failing unit tests FIRST, then implement to pass tests (strict TDD)
- Use 'return true' pattern in chrome.runtime.onMessage for async responses - forgetting causes silent failures
- Dexie transactions auto-commit - no explicit .commit() required, failures auto-rollback
- Content script injection timing critical - page-interceptor.tsx must load before shadow components
- XPath strategy is highest priority fallback - changes to XPath generation break replay
- React controlled inputs require property descriptor bypass - fragile to React version changes
- Service worker global state (openedTabId, trackedTabs) lost on suspension - must persist to chrome.storage
- Tailwind CSS purging may remove dynamically added classes - use safelist for class name templates
- Message serialization uses Structured Clone - functions, DOM nodes, circular references cannot be passed
- Bundle structure is immutable contract between recording and replay - changes break all recorded tests
- File size limits: 400 lines max per file, 50 lines per function - extract to smaller modules if exceeded
- Commit message format: <type>(<scope>): <subject> with body explaining why, refs to analysis docs
- PR checklist: tests pass, types check, linting passes, coverage targets met, resource map updated

---

### 2. Test-Driven Development (TDD)
**Rule**: Write tests BEFORE implementing modules.

**TDD Workflow**:
1. Write failing unit test for desired behavior
2. Implement minimal code to pass test
3. Refactor while keeping tests green
4. Add integration test
5. Repeat

**Why**: The existing codebase has zero test coverage. Adding tests during refactoring:
- Prevents regressions
- Documents expected behavior
- Validates module boundaries
- Enables safe refactoring

**Test Coverage Targets**:
- Core modules (Recording, Replay): 90%+
- Infrastructure (Storage, Messaging): 80%+
- UI Components: 70%+
- Integration tests: 60%+

---

### 3. Incremental Migration
**Rule**: Never "big bang" refactor. Migrate one module at a time.

**Migration Strategy**:
1. Extract module with new interface
2. Add adapter layer for backward compatibility
3. Migrate callers incrementally
4. Remove adapter once migration complete
5. Delete old code

**Why**: Large-scale refactors are risky and hard to review. Incremental migration:
- Allows continuous testing
- Enables gradual rollback
- Reduces merge conflicts
- Maintains system stability

---

### 4. Interface-First Design
**Rule**: Define TypeScript interfaces before implementation.

**Interface Design Process**:
1. Identify module responsibilities
2. Define public interface (exported types/functions)
3. Document expected behavior (JSDoc)
4. Review interface with team
5. Implement against interface
6. Export only interface, hide implementation

**Why**: Well-defined interfaces:
- Enable parallel development
- Facilitate mocking/testing
- Prevent tight coupling
- Support future implementation swaps

---

### 5. Configuration Over Hardcoding
**Rule**: Extract magic numbers and heuristics to configuration files.

**Configurable Items**:
- Locator strategy priorities
- Replay timeouts and retry counts
- Label detection patterns
- UI theme values
- Feature flags

**Configuration Format** (JSON):
```json
{
  "recording": {
    "labelStrategies": ["bootstrap", "aria", "placeholder"],
    "locatorPriorities": ["id", "xpath", "aria"]
  },
  "replay": {
    "timeoutMs": 5000,
    "retryAttempts": 3,
    "scrollBehavior": "smooth"
  }
}
```

**Why**: Configuration:
- Enables runtime behavior changes without code changes
- Supports per-user customization
- Facilitates A/B testing
- Simplifies debugging

---

## IMPLEMENTATION PRIORITIES

### Phase 1: Foundation (Weeks 1-5)
**Goal**: Extract core engine logic from monolithic files

**Priority Order**:
1. **Recording Engine** (Weeks 1-2)
   - Extract from `content.tsx` (1,446 lines → 5-7 modules)
   - Implement pluggable label detection strategies
   - Add unit tests for each strategy

2. **Replay Engine** (Weeks 3-4)
   - Extract from `content.tsx`
   - Implement multi-strategy element finder
   - Add action executor registry
   - Add unit tests for each action type

3. **Message Bus** (Week 5)
   - Centralize chrome.runtime and chrome.tabs messaging
   - Define strongly-typed message contracts
   - Migrate background.ts and UI pages
   - Add message tracing for debugging

**Success Criteria**:
- ✅ content.tsx reduced to < 200 lines (coordinator only)
- ✅ 80%+ test coverage for Recording and Replay modules
- ✅ All cross-context communication uses MessageBus
- ✅ No regression in existing functionality

---

### Phase 2: Infrastructure (Weeks 6-8)
**Goal**: Abstract persistence and improve maintainability

**Priority Order**:
1. **Storage Abstraction** (Week 6)
   - Create IStorageProvider interface
   - Wrap existing Dexie logic in IndexedDBProvider
   - Add InMemoryProvider for testing
   - Migrate background.ts to use abstraction

2. **UI Component Refactoring** (Weeks 7-8)
   - Split Dashboard.tsx (1,286 lines → 8-10 components)
   - Split TestRunner.tsx (809 lines → 5-7 components)
   - Extract shared UI components to component library
   - Add React Testing Library tests

**Success Criteria**:
- ✅ Storage operations use IStorageProvider interface
- ✅ No UI file exceeds 400 lines
- ✅ 70%+ test coverage for UI components
- ✅ Storybook documentation for UI library

---

### Phase 3: Application Logic (Weeks 9-10)
**Goal**: Isolate business logic from UI and infrastructure

**Priority Order**:
1. **CSV Processing Engine** (Week 9)
   - Extract CSV/Excel parsing logic
   - Implement auto-mapping with configurable fuzzy threshold
   - Add data validation
   - Add unit tests with fixture files

2. **Test Execution Orchestrator** (Week 10)
   - Extract orchestration logic from TestRunner.tsx
   - Coordinate MessageBus, StorageProvider, ReplayEngine
   - Add progress tracking
   - Add integration tests

**Success Criteria**:
- ✅ CSV logic isolated in dedicated module
- ✅ Test execution fully testable with mocks
- ✅ 80%+ test coverage for application logic
- ✅ End-to-end test for full workflow

---

### Phase 4: Quality & Optimization (Weeks 11-14)
**Goal**: Improve performance, documentation, and developer experience

**Priority Order**:
1. **Test Coverage** (Week 11)
   - Add integration tests for cross-module workflows
   - Add E2E tests with Playwright
   - Achieve 80%+ overall code coverage

2. **Configuration System** (Week 12)
   - Create config schema and validation
   - Move hardcoded values to config
   - Add UI for user settings

3. **Performance Optimization** (Week 13)
   - Implement code splitting (lazy loading)
   - Remove unused dependencies
   - Optimize bundle size
   - Add performance monitoring

4. **Documentation & Cleanup** (Week 14)
   - Generate API docs (TypeDoc)
   - Write developer onboarding guide
   - Create architecture diagrams
   - Final code cleanup

**Success Criteria**:
- ✅ 80%+ code coverage
- ✅ Bundle size < 500KB (from current ~1MB)
- ✅ Complete API documentation
- ✅ Developer onboarding time < 1 day

---

## MODULE BOUNDARIES & DEPENDENCIES

### Dependency Rules
**Rule**: Follow these dependency directions (no circular dependencies)

```
Presentation Layer (UI)
    ↓ depends on
Application Layer (Orchestrators, CSV Processor)
    ↓ depends on
Core Engine Layer (Recording, Replay, Locators)
    ↓ depends on
Infrastructure Layer (Storage, MessageBus, Background)
    ↓ depends on
Foundation (TypeScript types, utilities)
```

**Allowed**:
- ✅ UI → Application → Core → Infrastructure
- ✅ Horizontal dependencies within same layer (carefully)

**Forbidden**:
- ❌ Infrastructure → Core
- ❌ Core → Application
- ❌ Infrastructure → Application
- ❌ Any circular dependency (A → B → A)

**Enforcement**:
- Use ESLint plugin: `eslint-plugin-import` with `no-cycle` rule
- Run dependency graph check: `npm run check-deps` (to be added)

---

## RESPECTING BOUNDARIES

### When Extracting a Module
**Checklist**:
1. [ ] Read the corresponding breakdown doc:
   - `analysis-resources/component-breakdowns/<module>_breakdown.md`
2. [ ] Read the modularization plan:
   - `analysis-resources/modularization-plans/<module>_mod-plan.md`
3. [ ] Define interface first (TypeScript)
4. [ ] Write failing unit tests
5. [ ] Implement module (pass tests)
6. [ ] Add integration tests
7. [ ] Update resource map:
   - `analysis-resources/_RESOURCE_MAP.md`
8. [ ] Document implementation decisions

### When Calling Another Module
**Rules**:
- ✅ Call via interface (IRecordingEngine, IStorageProvider)
- ✅ Inject dependencies via constructor or function args
- ❌ Never import concrete implementation directly
- ❌ Never access internal module state directly

**Example (Good)**:
```typescript
// Good: Depends on interface
class TestOrchestrator {
  constructor(
    private storage: IStorageProvider,
    private replay: IReplayEngine,
    private messageBus: IMessageBus
  ) {}
}
```

**Example (Bad)**:
```typescript
// Bad: Direct concrete dependency
import { IndexedDBProvider } from './storage/indexeddb';

class TestOrchestrator {
  private storage = new IndexedDBProvider(); // Hardcoded!
}
```

---

## CODE QUALITY STANDARDS

### File Size Limits
- **Maximum File Size**: 400 lines
- **Maximum Function Size**: 50 lines
- **Maximum Class Size**: 300 lines

**If Exceeding**:
1. Identify distinct responsibilities
2. Extract to separate files/modules
3. Use composition over inheritance

### Complexity Limits
- **Cyclomatic Complexity**: < 10 per function
- **Nesting Depth**: < 4 levels

**If Exceeding**:
1. Extract helper functions
2. Use early returns (guard clauses)
3. Replace conditionals with polymorphism (strategy pattern)

### Naming Conventions
- **Interfaces**: `I` prefix (e.g., `IRecordingEngine`)
- **Types**: PascalCase (e.g., `RecordedStep`)
- **Functions**: camelCase, verb-first (e.g., `findElement()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **Private Members**: `_` prefix (e.g., `_internalState`)

### Documentation Requirements
- **Every Module**: JSDoc header with purpose, responsibilities, usage
- **Every Public Interface**: JSDoc for each method
- **Every Complex Function**: Inline comments explaining "why", not "what"

**Example**:
```typescript
/**
 * Recording Engine - Captures user interactions on web pages.
 * 
 * Responsibilities:
 * - Attach event listeners to target page
 * - Extract element locators and labels
 * - Generate structured RecordedStep objects
 * 
 * Usage:
 * ```
 * const recorder = new RecordingEngine();
 * recorder.start({ target: document.body });
 * const steps = recorder.getSteps();
 * ```
 */
export class RecordingEngine implements IRecordingEngine {
  // ...
}
```

---

## TESTING STRATEGY

### Unit Tests
**Location**: `src/__tests__/unit/`

**Requirements**:
- Test each module in isolation
- Mock all external dependencies
- Cover happy path + error cases
- Use fixtures for complex inputs

**Example**:
```typescript
// src/__tests__/unit/recording/label-detector.test.ts
describe('BootstrapLabelStrategy', () => {
  it('detects label from Bootstrap form-group', () => {
    const html = `
      <div class="form-group">
        <label>Email</label>
        <input type="text" />
      </div>
    `;
    const element = parseHTML(html).querySelector('input');
    const strategy = new BootstrapLabelStrategy();
    const label = strategy.detect(element);
    
    expect(label).toBe('Email');
  });
});
```

### Integration Tests
**Location**: `src/__tests__/integration/`

**Requirements**:
- Test interactions between modules
- Use minimal mocking (real implementations preferred)
- Test cross-boundary communication

**Example**:
```typescript
// src/__tests__/integration/recording-replay.test.ts
describe('Recording and Replay Flow', () => {
  it('records and replays a form submission', async () => {
    const recorder = new RecordingEngine();
    const replay = new ReplayEngine();
    
    // Record
    recorder.start();
    simulateUserInput(testForm);
    const steps = recorder.getSteps();
    recorder.stop();
    
    // Replay
    const results = await replay.executeMultiple(steps);
    
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

### E2E Tests
**Location**: `tests/e2e/`

**Requirements**:
- Test full user workflows in real browser
- Use Playwright for Chrome extension testing
- Test happy path + critical error scenarios

**Example**:
```typescript
// tests/e2e/record-replay.spec.ts
test('user can record and replay a test', async ({ page, extensionId }) => {
  // Open extension popup
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  
  // Create project
  await page.click('[data-testid="create-project"]');
  await page.fill('[name="project-name"]', 'Test Project');
  await page.click('[data-testid="save-project"]');
  
  // Start recording
  await page.click('[data-testid="start-recording"]');
  
  // Interact with target page
  await page.goto('https://example.com/form');
  await page.fill('#email', 'test@example.com');
  await page.click('#submit');
  
  // Stop recording
  await page.bringToFront(popupPage);
  await page.click('[data-testid="stop-recording"]');
  
  // Verify steps recorded
  const steps = await page.$$('[data-testid="recorded-step"]');
  expect(steps.length).toBeGreaterThan(0);
  
  // Run test
  await page.click('[data-testid="run-test"]');
  await page.waitForSelector('[data-testid="test-passed"]');
});
```

---

## DEBUGGING & TRACING

### MessageBus Tracing
**Enable in Development**:
```typescript
const messageBus = new MessageBus({ traceEnabled: true });
```

**Output**:
```
[MessageBus] SEND: recording:step
  { type: "click", target: "button#submit", timestamp: 123456789 }
[MessageBus] RECEIVE: recording:step
  Handled by: RecordingEngine
  Duration: 5ms
```

### Locator Strategy Debugging
**Enable in Configuration**:
```json
{
  "replay": {
    "debugLocators": true
  }
}
```

**Output**:
```
[ElementFinder] Attempting strategies for element:
  ✅ XPathStrategy: Found (confidence: 1.0)
  ⏭️ IDStrategy: Skipped (XPath succeeded)
  ⏭️ AriaStrategy: Skipped (XPath succeeded)
Selected: XPathStrategy (confidence: 1.0)
```

### Performance Profiling
**Add performance marks**:
```typescript
performance.mark('replay-start');
await replayEngine.execute(step);
performance.mark('replay-end');
performance.measure('replay-duration', 'replay-start', 'replay-end');
```

**View in DevTools**: Performance panel → User Timing

---

## RESOURCE LIBRARY UPDATES

### When Creating New Files
**Rule**: ALWAYS update `_RESOURCE_MAP.md`

**Required Changes**:
1. Add file path to appropriate section
2. Add one-line description
3. Link to any related files
4. Update modification date

**Example**:
```markdown
## Component Breakdowns
- **recording-engine_breakdown.md** - Deep dive into Recording Engine architecture, responsibilities, and implementation details.
- **replay-engine_breakdown.md** - Deep dive into Replay Engine architecture, element finding, and action execution.
```

### When Implementing from a Plan
**Rule**: Document deviations and decisions

**Process**:
1. Read the modularization plan
2. Implement as specified
3. If deviations needed, document in:
   - `analysis-resources/implementation-guides/<module>_impl.md`
4. Update `_RESOURCE_MAP.md` with new file

---

## COMMIT MESSAGE CONVENTIONS

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **refactor**: Code refactoring (no behavior change)
- **test**: Adding tests
- **docs**: Documentation changes
- **chore**: Build, tooling, dependencies

### Examples
```
feat(recording): Extract label detection strategies

- Create LabelDetectorRegistry
- Implement Bootstrap, Aria, Placeholder strategies
- Add unit tests for each strategy

Refs: analysis-resources/modularization-plans/recording-engine_mod-plan.md
```

```
refactor(content): Migrate to RecordingEngine interface

- Replace inline event listeners with RecordingEngine
- Remove 500 lines of legacy code
- Maintain backward compatibility with adapter

Refs: #123
```

---

## ROLLBACK STRATEGY

### If Implementation Breaks
**Immediate Actions**:
1. Revert last commit: `git revert HEAD`
2. Push revert: `git push origin main`
3. Document issue in:
   - `analysis-resources/implementation-guides/rollback-log.md`
4. Analyze root cause
5. Update tests to catch issue
6. Re-implement with fix

### If Module Boundary Wrong
**Actions**:
1. Stop implementation
2. Update modularization plan:
   - `analysis-resources/modularization-plans/<module>_mod-plan.md`
3. Document revised boundary decision
4. Get review/approval
5. Resume implementation with new boundary

---

## REVIEW CHECKLIST

### Before Submitting PR
- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] No file exceeds 400 lines
- [ ] No function exceeds 50 lines
- [ ] Cyclomatic complexity < 10
- [ ] Code coverage meets targets (80%+)
- [ ] Resource map updated
- [ ] Implementation guide created (if new module)
- [ ] Commit message follows convention
- [ ] No console.log statements (use proper logging)

### PR Description Template
```markdown
## Summary
Brief description of changes

## Related Documents
- Modularization Plan: `analysis-resources/modularization-plans/<module>_mod-plan.md`
- Component Breakdown: `analysis-resources/component-breakdowns/<module>_breakdown.md`

## Changes
- [ ] Extracted <Module> from <File>
- [ ] Added unit tests (coverage: X%)
- [ ] Added integration tests
- [ ] Updated resource map

## Testing
- Unit tests: X passing
- Integration tests: Y passing
- E2E tests: Z passing

## Breaking Changes
None / List breaking changes

## Screenshots (if UI changes)
[Add screenshots]
```

---

## NEXT ACTIONS FOR AI DESIGNERS

### When Starting New Work
1. **Read**:
   - `analysis-resources/project-analysis/00_meta-analysis.md`
   - `analysis-resources/modularization-plans/00_modularization-overview.md`
   - Relevant component breakdown
   - Relevant modularization plan

2. **Plan**:
   - Identify module to extract
   - Define interface
   - Write test cases
   - Estimate effort

3. **Implement**:
   - Follow TDD workflow
   - Respect module boundaries
   - Update resource library
   - Submit PR with checklist

4. **Review**:
   - Ensure tests pass
   - Check code quality metrics
   - Validate no regressions
   - Update documentation

### When Blocked
1. **Check Resources**:
   - Is there a breakdown doc for this module?
   - Is there a modularization plan?
   - Are interfaces defined?

2. **Create Resources if Missing**:
   - Write breakdown doc
   - Write modularization plan
   - Define interfaces
   - Get review

3. **Ask for Clarification**:
   - Document question in:
     - `analysis-resources/references/questions.md`
   - Provide context (what you're trying to implement)
   - Wait for answer before proceeding

---

## SUMMARY

**Key Takeaways**:
1. ✅ Resource library is source of truth - read it first
2. ✅ Test-driven development - write tests first
3. ✅ Incremental migration - one module at a time
4. ✅ Interface-first design - define contracts early
5. ✅ Configuration over hardcoding - externalize behavior
6. ✅ Respect boundaries - follow dependency rules
7. ✅ Update documentation - keep resource library current
8. ✅ Quality gates - meet coverage and complexity targets

**Workflow Summary**:
```
Read Resources → Define Interface → Write Tests → Implement → Update Docs → Submit PR
```

**Success Metrics**:
- 80%+ test coverage
- No file > 400 lines
- No function > 50 lines
- Cyclomatic complexity < 10
- Zero circular dependencies
- All PRs reviewed within 24 hours
```
