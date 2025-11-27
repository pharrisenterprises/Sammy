# Analysis Resources - Master Index

## Overview
This directory contains comprehensive technical documentation for the Sammy Chrome Extension test automation recorder, organized by analysis type: project analysis, component breakdowns, modularization plans, implementation guides, rollups, build instructions, and reference materials.

**Last Updated:** 2025-01-XX (Phase 1: Full Atomic Rollup)
**Total Files:** 40+
**Primary Use:** Claude context for Phase 3 masterplan development, developer onboarding, architectural decision records

---

## Component Breakdowns (10 files)

### recording-engine_breakdown.md
**Purpose:** Monolithic user interaction capture system in content script (1,446-line monolith)  
**Key Sections:** Event handlers, 12+ label detection strategies, XPath/bundle generation, iframe/shadow DOM support  
**Line Count:** ~250 lines | **Format:** 9-section atomic rollup (Purpose, Inputs, Outputs, Architecture, Dependencies, Assumptions, Stability, Edge Cases, Developer Notes)

### replay-engine_breakdown.md
**Purpose:** Action execution subsystem with 9-tier fallback strategy for element resolution  
**Key Sections:** findElementFromBundle() with XPath→ID→aria→fuzzy→bounding box strategies, React-safe input patterns, timeout/retry logic  
**Line Count:** ~250 lines | **Format:** 9-section atomic rollup

### locator-strategy_breakdown.md
**Purpose:** Element identification protocol defining LocatorBundle contract and confidence-scored resolution  
**Key Sections:** Bundle interface definition, recording generation logic, replay resolution strategies, confidence scoring (100% XPath → 40% fuzzy text)  
**Line Count:** ~230 lines | **Format:** 9-section atomic rollup

### storage-layer_breakdown.md
**Purpose:** Dexie.js IndexedDB wrapper for projects/testRuns persistence coordinated via background script message bus  
**Key Sections:** Dexie schema (projects, testRuns tables), CRUD operations, background message handlers (15+ actions)  
**Line Count:** ~220 lines | **Format:** 9-section atomic rollup

### message-bus_breakdown.md
**Purpose:** Chrome Extension messaging infrastructure (chrome.runtime, chrome.tabs, window.postMessage)  
**Key Sections:** 4 message flow patterns (UI→background→DB, UI→background→content, content→UI broadcast, page→content postMessage), 20+ action types, "return true" async pattern  
**Line Count:** ~250 lines | **Format:** 9-section atomic rollup

### ui-components_breakdown.md
**Purpose:** React-based extension pages (Dashboard, Recorder, TestRunner) with Material-UI/Radix/Shadcn components  
**Key Sections:** Dashboard (project CRUD), Recorder (real-time steps table), TestRunner (replay orchestration), component dependencies (React Router, drag-and-drop, Papa Parse)  
**Line Count:** ~200 lines | **Format:** 9-section atomic rollup

### csv-processing_breakdown.md
**Purpose:** CSV parsing (Papa Parse), auto-detect field mappings, manual mapping UI, CSV row injection into replay  
**Key Sections:** Auto-mapping heuristic (fuzzy string match), manual mapping dropdowns, executeStep(step, csvRow) integration  
**Line Count:** ~60 lines | **Format:** 9-section atomic rollup (condensed)

### test-orchestrator_breakdown.md
**Purpose:** TestRunner page orchestrating execution loop (retrieve steps, iterate CSV rows, track progress, report results)  
**Key Sections:** runTest() main loop, progress tracking (setProgress), error handling per step, TestRuns storage integration  
**Line Count:** ~60 lines | **Format:** 9-section atomic rollup (condensed)

### background-service_breakdown.md
**Purpose:** Manifest V3 service worker providing message routing, IndexedDB coordination, tab management, script injection  
**Key Sections:** background.ts (323 lines), 20+ action handlers (if/else chain), Dexie operations, service worker lifecycle concerns  
**Line Count:** ~70 lines | **Format:** 9-section atomic rollup (condensed)

### content-script-system_breakdown.md
**Purpose:** Dual-mode coordinator (recording + replay) running in web page context with iframe/shadow DOM support  
**Key Sections:** content.tsx monolith structure (lines 1-850 recording, 850-1446 replay), isRecording toggle, page-interceptor.tsx coordination  
**Line Count:** ~70 lines | **Format:** 9-section atomic rollup (condensed)

---

## Build Instructions (2 files)

### build-pipeline-overview.md
**Purpose:** Vite-based build system with dual configuration (vite.config.ts for UI, vite.config.bg.ts for background)  
**Key Sections:** Entry points (main.tsx, background.ts, interceptor, replay), output structure (dist/js/, css/, manifest.json), scripts/postbuild.js (release zip creation)  
**Line Count:** ~140 lines | **Format:** 9-section atomic rollup

### environment-requirements.md
**Purpose:** Software versions, tools, configuration for development/build/test/deploy  
**Key Sections:** Node.js 18+, Chrome 120+, npm dependencies (React, TypeScript, Vite, Dexie), manifest.json requirements, debugging setup  
**Line Count:** ~130 lines | **Format:** 9-section atomic rollup

---

## Implementation Guides (2 files)

### high-level-implementation.md
**Purpose:** Architectural overview, development principles (TDD, modular design), phase-based roadmap (Phases 1-5), best practices  
**Key Sections:** Phase 1-2 complete (core MVP + robustness), Phase 3 in progress (CSV processing weeks 9-10), Phase 4 planned (Supabase cloud sync), Phase 5 planned (CI/CD, Chrome Web Store)  
**Line Count:** ~200 lines | **Format:** 9-section atomic rollup

### PHASE_3_META_MANUAL.md
**Purpose:** Smart Prompt generation rules v2.0 for Claude → Copilot workflow (69 masterplan files)  
**Key Sections:** Prompt structure template, mandatory elements (Context Declaration, File Specifications, Requirements, Success Criteria), content generation rules (400-600 lines per prompt), quality checklist  
**Line Count:** 743 lines | **Format:** Instruction manual (not 9-section rollup)

---

## Rollups (10 files)

### recording-engine_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by recording-engine_breakdown.md (atomic rollup)  
**Legacy Content:** Original 634-line analysis with Purpose, Inputs, Outputs, Internal Architecture, Dependencies, Complexity Assessment sections

### replay-engine_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by replay-engine_breakdown.md (atomic rollup)  
**Legacy Content:** Original analysis of element finding strategies and action execution

### locator-strategy_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by locator-strategy_breakdown.md (atomic rollup)  
**Legacy Content:** Original bundle structure and resolution strategy documentation

### storage-layer_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by storage-layer_breakdown.md (atomic rollup)  
**Legacy Content:** Original Dexie schema and message coordination analysis

### message-bus_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by message-bus_breakdown.md (atomic rollup)  
**Legacy Content:** Original chrome.runtime messaging pattern documentation

### ui-components_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by ui-components_breakdown.md (atomic rollup)  
**Legacy Content:** Original React UI page analysis

### csv-processing_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by csv-processing_breakdown.md (atomic rollup)  
**Legacy Content:** Original CSV parsing and mapping documentation

### test-orchestrator_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by test-orchestrator_breakdown.md (atomic rollup)  
**Legacy Content:** Original TestRunner orchestration analysis

### background-service_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by background-service_breakdown.md (atomic rollup)  
**Legacy Content:** Original background script message router documentation

### content-script-system_rollup.md
**Status:** ⚠️ DEPRECATED - Replaced by content-script-system_breakdown.md (atomic rollup)  
**Legacy Content:** Original dual-mode content script analysis

---

## Project Analysis (5 files)

### 00_project-summary.md
**Purpose:** Executive summary with tech stack, current status, Phase 1-5 roadmap  
**Key Sections:** 8 core subsystems (Recording, Replay, Locator, Storage, Message Bus, UI, CSV, Test Orchestrator), architectural patterns  
**Line Count:** ~150 lines

### 01_stack-breakdown.md
**Purpose:** Technology inventory (React 18, Dexie 4.0.11, Vite 6.3.5, TypeScript 5, Tailwind 3.4)  
**Key Sections:** Dependencies categorized (UI framework, storage, build tools, Chrome APIs)  
**Line Count:** ~100 lines

### 02_architecture-map.md
**Purpose:** Component interaction diagram, message flow patterns, data flow (recording → storage → replay)  
**Key Sections:** Background ↔ Content ↔ UI communication, IndexedDB coordination, Bundle lifecycle  
**Line Count:** ~120 lines

### 03_folder-structure.md
**Purpose:** Directory tree with file counts, size estimates, organization rationale  
**Key Sections:** src/ (background, contentScript, pages, components, common), public/ (manifest, HTML), build-instructions/  
**Line Count:** ~80 lines

### 04_dependencies.md
**Purpose:** package.json analysis with 60+ dependencies, version constraints, breaking change risks  
**Key Sections:** Critical dependencies (Dexie, React, Vite), optional dependencies (testing, linting)  
**Line Count:** ~90 lines

---

## Modularization Plans (9 files)

### 00_modularization-overview.md
**Purpose:** Master refactoring plan to split 1,446-line content.tsx into 5-7 focused modules  
**Key Sections:** Refactoring priorities, modularization strategy (extract → interface → test), timeline (Phase 3 weeks 1-4)  
**Line Count:** ~100 lines

### recording-engine_mod-plan.md
**Purpose:** Extract recording logic (lines 1-850) to `src/modules/recording-engine/`  
**Key Sections:** EventListenerManager, LabelDetectionEngine, BundleBuilder classes, testing strategy  
**Line Count:** ~80 lines

### replay-engine_mod-plan.md
**Purpose:** Extract replay logic (lines 850-1446) to `src/modules/replay-engine/`  
**Key Sections:** ElementResolver, ActionExecutor, TimeoutManager classes, strategy pattern for fallbacks  
**Line Count:** ~80 lines

### locator-strategy_mod-plan.md
**Purpose:** Extract locator logic to `src/modules/locator-strategy/` with IStrategy interface  
**Key Sections:** XPathStrategy, IDStrategy, FuzzyTextStrategy implementations, confidence scoring system  
**Line Count:** ~70 lines

### storage-layer_mod-plan.md
**Purpose:** Formalize Dexie wrapper, add repository pattern, schema versioning  
**Key Sections:** ProjectRepository, TestRunRepository classes, migration scripts  
**Line Count:** ~60 lines

### message-bus_mod-plan.md
**Purpose:** Extract message routing to `src/modules/message-bus/` with action map  
**Key Sections:** MessageRouter, ActionHandler interface, handler registration, error recovery  
**Line Count:** ~60 lines

### test-orchestrator_mod-plan.md
**Purpose:** Extract TestRunner orchestration logic to separate module  
**Key Sections:** ExecutionLoop, ProgressTracker, ResultAggregator classes  
**Line Count:** ~50 lines

### ui-components_mod-plan.md
**Purpose:** Implement Redux store, add error boundaries, virtualize large lists  
**Key Sections:** Redux slices (projects, testRuns, recording), react-window for StepsTable  
**Line Count:** ~70 lines

### csv-processing_mod-plan.md
**Purpose:** Formalize CSV parsing and mapping logic as separate service  
**Key Sections:** CSVParser, AutoMapper, ManualMapper classes, validation rules  
**Line Count:** ~50 lines

---

## Prompts (2 files)

### prompt-history.md
**Purpose:** Chronological log of significant Claude prompts and outcomes  
**Key Sections:** Phase 3 tracker creation, meta-manual storage, atomic rollup command  
**Line Count:** ~200 lines

### future-prompts.md
**Purpose:** Template prompts for recurring tasks (create new subsystem, debug issue, refactor module)  
**Key Sections:** Smart Prompt templates, checklist for new features, debugging workflow  
**Line Count:** ~100 lines

---

## References (2 files)

### code-notes.md
**Purpose:** Inline code snippets, copy-paste templates, common patterns (message handlers, Dexie queries)  
**Key Sections:** Return true pattern, findElementFromBundle usage, React-safe input code  
**Line Count:** ~150 lines

### tech-links.md
**Purpose:** External documentation links (Chrome Extension APIs, Dexie docs, React patterns)  
**Key Sections:** Official docs, Stack Overflow threads, GitHub issues  
**Line Count:** ~80 lines

---

## Usage Guidelines

### For Claude (Phase 3 Development)
1. **Read PHASE_3_META_MANUAL.md** for Smart Prompt generation rules
2. **Read component-breakdowns/** for current implementation state (atomic rollups)
3. **Read build-instructions/masterplan/_PHASE_3_STATUS_TRACKER.md** for file checklist
4. **Generate Smart Prompts** following meta-manual template (400-600 lines per prompt)
5. **Reference high-level-implementation.md** for phase roadmap and priorities

### For Developers (Onboarding)
1. **Read 00_project-summary.md** for executive overview
2. **Read component-breakdowns/** for subsystem deep dives (start with recording-engine, replay-engine, storage-layer)
3. **Read build-instructions/** for build/dev setup
4. **Read environment-requirements.md** for tooling setup
5. **Read modularization-plans/** to understand refactoring roadmap

### For Copilot (File Creation)
1. **Receive Smart Prompt from Claude** with embedded file content
2. **Copy exact content** from prompt (do NOT generate/modify)
3. **Create file** at specified path in build-instructions/masterplan/
4. **Commit with message** "Phase 3: [description]"
5. **Report status** back to Claude

---

## Document Status Legend

- ✅ **CURRENT:** Active reference, updated in Phase 1 atomic rollup (Jan 2025)
- ⚠️ **DEPRECATED:** Superseded by component-breakdowns/ atomic rollups (rollups/ directory)
- 📝 **DRAFT:** Work in progress, incomplete sections
- 📅 **PLANNED:** Future documentation (Phase 4-5)
- 🔄 **IN PROGRESS:** Currently being updated

---

## Maintenance Notes

**Last Full Audit:** 2025-01-XX (Phase 1: Full atomic rollup)  
**Next Audit:** After Phase 3 completion (expected: weeks 9-10)  
**Update Frequency:** After each phase milestone  
**Owner:** Development Team  
**Primary Consumers:** Claude (AI assistant), Copilot (file creation), Human Developers (onboarding/reference)

**Critical Files for Phase 3:**
- component-breakdowns/ (10 atomic rollups) - Source of truth for current implementation
- PHASE_3_META_MANUAL.md - Smart Prompt generation rules
- high-level-implementation.md - Phase roadmap and CSV processing timeline (weeks 9-10)
