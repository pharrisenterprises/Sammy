# High-Level Implementation Guide

## 1. Purpose
Provide architectural overview, development principles, phase-based implementation roadmap, and best practices for building, testing, and maintaining the Sammy Chrome Extension test automation recorder.

## 2. Core Development Principles

### Test-Driven Development (TDD)
- Write unit tests before implementing features (not yet consistently applied)
- Integration tests for critical paths (recording, replay, storage)
- E2E tests using real Chrome extension context (Puppeteer planned)

### Modular Architecture
- Separate concerns: Recording, Replay, Storage, UI, Message Bus
- Avoid monolithic files (current content.tsx 1,446 lines needs refactoring)
- Dependency injection for testability

### Defensive Coding
- Validate all inputs (user input, chrome.runtime.sendMessage payloads, DOM queries)
- Handle errors gracefully (try/catch, sendResponse with error objects)
- Assume external systems unreliable (network, IndexedDB, background script)

## 3. Implementation Phases

### Phase 1: Core MVP (Weeks 1-6) ✅ COMPLETE
- ✅ Basic recording engine (click, input events)
- ✅ XPath locator generation
- ✅ IndexedDB storage with Dexie
- ✅ Dashboard UI for project management
- ✅ Recorder UI with steps table
- ✅ Basic replay engine (XPath resolution)
- ✅ Background service worker message routing

### Phase 2: Robustness (Weeks 7-8) ✅ COMPLETE
- ✅ Multi-strategy locator fallbacks (9-tier)
- ✅ Iframe and Shadow DOM support
- ✅ React-safe input simulation
- ✅ Label detection heuristics (12+ strategies)
- ✅ TestRunner UI with progress tracking

### Phase 3: Data-Driven Testing (Weeks 9-10) 🔄 IN PROGRESS
- 📝 CSV file upload and parsing (Papa Parse integrated)
- 📝 Auto-detect field mappings (string-similarity fuzzy match)
- 📝 Manual mapping UI (Mapper.tsx location TBD)
- 📝 CSV row iteration in TestRunner
- 📝 Test orchestrator for multi-row execution
- 📝 Results aggregation per CSV row

### Phase 4: Cloud Sync (Weeks 11-12) 📅 PLANNED
- ⏳ Supabase integration for project storage
- ⏳ Multi-device sync (offline edits, conflict resolution)
- ⏳ Team collaboration features (shared projects)
- ⏳ Cloud-based test execution (VDI runner)

### Phase 5: Advanced Features (Weeks 13-16) 📅 PLANNED
- ⏳ Visual regression testing (screenshot comparison)
- ⏳ Network request mocking/stubbing
- ⏳ API testing (REST/GraphQL)
- ⏳ CI/CD integration (GitHub Actions, Jenkins)
- ⏳ Chrome Web Store publication

## 4. Key Architectural Decisions

### Content Script Dual-Mode Design
- Single content.tsx handles both recording and replay (ANTI-PATTERN)
- **Rationale:** Simplifies initial development, shares DOM access code
- **Trade-Off:** 1,446-line monolith hard to test and maintain
- **Future:** Split into recording.ts and replay.ts modules (Phase 3 refactor priority)

### Message Bus Centralization
- All storage operations routed through background script
- **Rationale:** Avoids IndexedDB race conditions from multiple contexts
- **Trade-Off:** Single point of failure, no offline queue
- **Mitigation:** Implement retry logic, chrome.alarms keepalive

### LocatorBundle as Immutable Contract
- Bundle structure defines recording↔replay interface
- **Rationale:** Decouples recording engine from replay engine
- **Trade-Off:** Adding fields requires backward compatibility (optional properties)
- **Enforcement:** TypeScript interfaces, version checking in future

### Dexie Over Raw IndexedDB
- Dexie.js wrapper for schema management and queries
- **Rationale:** Reduces boilerplate, provides Promise-based API
- **Trade-Off:** Additional 50KB dependency, learning curve
- **Benefit:** Schema versioning, automatic migrations

## 5. Code Organization

### Directory Structure
```
src/
├── background/       # Service worker (message routing, DB coordination)
├── contentScript/    # Recording + Replay logic (needs split)
├── pages/            # UI pages (Dashboard, Recorder, TestRunner, Mapper)
├── components/       # Reusable React components (Shadcn/Radix)
├── common/           # Shared code (storage, types, constants)
├── hooks/            # Custom React hooks
├── redux/            # Redux store (not yet used)
└── utils/            # Helper functions
```

### Key Files by Subsystem
- **Recording:** `contentScript/content.tsx` lines 1-850
- **Replay:** `contentScript/content.tsx` lines 850-1446
- **Storage:** `common/services/indexedDB.ts` (71 lines)
- **Message Bus:** `background/background.ts` (323 lines)
- **UI Pages:** `pages/Dashboard.tsx` (342 lines), `pages/Recorder.tsx` (493 lines), `pages/TestRunner.tsx` (610 lines)

## 6. Testing Strategy

### Unit Tests (To Be Implemented)
- Locator strategy functions (getXPath, getLabelForTarget)
- Bundle generation (recordElement)
- CSV parsing and mapping logic
- Test with Vitest + jsdom (React components)

### Integration Tests (To Be Implemented)
- Recording → Storage → Replay full flow
- Message bus communication (UI ↔ background ↔ content script)
- IndexedDB CRUD operations
- Test with Vitest + fake-indexeddb

### E2E Tests (To Be Implemented)
- Record test on demo site (e.g., Google Forms)
- Replay recorded test and verify outcomes
- CSV data injection and multi-row execution
- Test with Puppeteer + Chrome --load-extension

## 7. Performance Considerations

### Recording Performance
- Event handler execution <10ms (avoid blocking UI)
- Label detection <50ms per element (12+ strategies expensive)
- Bundle generation <100ms (XPath, data-attrs, bounding box)
- Message bus send <5ms (chrome.runtime.sendMessage serialization)

### Replay Performance
- Element finding 2s timeout (configurable per step)
- Retry interval 150ms (10+ attempts before failure)
- Fuzzy text matching <500ms (iterate all elements of tag type)
- Step execution target <200ms (humanClick delays 50-150ms)

### Storage Performance
- IndexedDB query <50ms for <1000 projects
- Large step arrays (10,000+ steps) cause serialization lag (>1s)
- Solution: Paginate steps, use IndexedDB blob storage for large datasets

## 8. Security Considerations

### Content Script Isolation
- Runs in isolated world (cannot access page JavaScript directly)
- Use page-interceptor.tsx for controlled page context access
- Validate window.postMessage origin to prevent spoofing

### Storage Security
- IndexedDB not encrypted (sensitive data like passwords stored in plaintext)
- Future: Implement encryption for recorded values (crypto.subtle.encrypt)
- Supabase row-level security for cloud sync

### Permissions Minimization
- Request only necessary permissions in manifest.json
- Current: storage, activeTab, tabs, scripting (all justified)
- Avoid <all_urls> in content_scripts if possible (use activeTab instead)

## 9. Developer-Must-Know Notes

### Phase 3 Priority: Refactor content.tsx
- Split 1,446-line monolith into:
  - `recording-engine.ts` (event handlers, label detection, bundle generation)
  - `replay-engine.ts` (findElementFromBundle, humanClick, humanInput)
  - `locator-strategy.ts` (strategy interface, 9-tier fallback logic)
  - `message-coordinator.ts` (chrome.runtime.onMessage listeners)

### CSV Processing Implementation (Phase 3 Week 9-10)
- **Week 9:** CSV upload UI, Papa Parse integration, auto-mapping algorithm
- **Week 10:** Manual mapping UI (Mapper.tsx), TestRunner integration, multi-row execution loop

### Test Orchestrator Design (Phase 3 Week 10)
- Iterate CSV rows: `for (const row of csvData) { await executeReplay(steps, row); }`
- Track results per row: `{ rowIndex, passed, failed, duration, errors }`
- Save testRuns with row-level granularity

### Supabase Schema Design (Phase 4 Week 11)
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT,
  target_url TEXT,
  recorded_steps JSONB,
  user_id UUID REFERENCES auth.users
);

CREATE TABLE test_runs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  csv_row_index INT,
  status TEXT,
  passed_steps INT,
  failed_steps INT,
  created_at TIMESTAMP
);
```

### CI/CD Pipeline (Phase 5 Week 13)
```yaml
# .github/workflows/build.yml
name: Build Extension
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with: { name: extension, path: release/extension.zip }
```

### Chrome Web Store Submission (Phase 5 Week 16)
- Create developer account ($5 one-time fee)
- Upload release/extension.zip
- Provide screenshots, description, privacy policy
- Review process: 1-3 days
