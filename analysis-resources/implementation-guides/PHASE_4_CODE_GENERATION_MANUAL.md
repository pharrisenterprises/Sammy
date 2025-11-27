# PHASE 4 CODE GENERATION MANUAL
## Complete Guide to Automated Code Generation via Smart Prompts

**Purpose:** This document defines the complete workflow, prompts, and execution plan for Phase 4 Code Generation. It includes pre-phase preparation steps, repo snapshot capture, and the complete registry of 225 code generation prompts.

**Version:** 2.0 (Regenerated Post-Nuclear Refresh)  
**Created:** November 27, 2025  
**Status:** READY FOR EXECUTION  
**Knowledge Base Sync:** ✅ ALIGNED WITH COMMIT fa5f8d9

---

## TABLE OF CONTENTS

1. [Core Principle](#1-core-principle)
2. [Pre-Phase 4 Process](#2-pre-phase-4-process)
3. [Code Prompt Structure Template](#3-code-prompt-structure-template)
4. [Complete Prompt Registry](#4-complete-prompt-registry)
5. [Module-to-File Mapping](#5-module-to-file-mapping)
6. [Interface Alignment Table](#6-interface-alignment-table)
7. [Dependency Graph](#7-dependency-graph)
8. [Quality Gates](#8-quality-gates)
9. [Error Handling & Recovery](#9-error-handling--recovery)

---

## 1. CORE PRINCIPLE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 CORE PRINCIPLE                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  • Claude generates COMPLETE TypeScript/TSX code embedded in prompts        │
│  • Copilot creates files at specified paths, runs tests, commits            │
│  • Copilot does NOT generate or modify code beyond what's provided          │
│  • Every prompt includes implementation + tests + commit command            │
│  • Tests must pass BEFORE commit                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Workflow Per Prompt

```
User: "continue" or "P4-XXX"
    ↓
Claude reads Phase 4 Manual → Identifies prompt
    ↓
Claude reads knowledge base → Gathers interfaces, types, dependencies
    ↓
Claude generates complete code prompt → 200-400 lines of TypeScript
    ↓
User copies to Copilot → Copilot creates files
    ↓
Copilot runs: npm run test (specific files)
    ↓
If tests pass → Copilot commits with message
    ↓
User: "continue" → Next prompt
```

---

## 2. PRE-PHASE 4 PROCESS

**CRITICAL: Complete these steps IN ORDER before generating any code prompts.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRE-PHASE 4 EXECUTION ORDER                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 0: Nuclear Knowledge Refresh ✅ COMPLETE (commit fa5f8d9)            │
│          └── All breakdowns updated to 9-section atomic format             │
│          └── All rollups regenerated                                        │
│          └── _RESOURCE_MAP.md updated                                       │
│                                                                             │
│  STEP 1: Repo Snapshot Capture (Run with Copilot)                          │
│          └── Captures actual current state of repository                    │
│          └── Output: /analysis-resources/repo-snapshot/CURRENT_STATE.md    │
│          └── Time: ~15 minutes                                              │
│                                                                             │
│  STEP 2: Alignment Verification (Run with Claude)                          │
│          └── Compares knowledge base interfaces with repo state            │
│          └── Output: Verified alignment or list of conflicts               │
│          └── Time: ~10 minutes                                              │
│                                                                             │
│  STEP 3: Begin Code Generation (Continue with prompts P4-001+)             │
│          └── Execute prompts in dependency order                            │
│          └── Output: Production code committed to repo                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### STEP 1: REPO SNAPSHOT CAPTURE

**Purpose:** Capture the actual current state of the repository so Claude can generate code that integrates correctly with existing files.

**When to Run:** Before code generation begins  
**Who Runs It:** Copilot  
**Output Location:** `/analysis-resources/repo-snapshot/CURRENT_STATE.md`

#### PROMPT TO SUBMIT TO COPILOT (Step 1)

```
**COPY FROM HERE ↓**

**REPO SNAPSHOT CAPTURE**

## Instructions for Copilot

Execute the following commands and create a snapshot file documenting the current repository state.

## Step 1: Create Directory

mkdir -p analysis-resources/repo-snapshot

## Step 2: Generate Snapshot File

Create the file `/analysis-resources/repo-snapshot/CURRENT_STATE.md` by examining the repository and filling in:

1. DIRECTORY STRUCTURE: find src -type f -name "*.ts" -o -name "*.tsx" | head -100
2. PACKAGE.JSON DEPENDENCIES: cat package.json
3. TSCONFIG SETTINGS: cat tsconfig.json
4. EXISTING TYPE DEFINITIONS: grep -r "interface Project" src/ -A 15
5. EXISTING SERVICE FILES: cat src/common/services/indexedDB.ts
6. EXISTING PAGE COMPONENTS: ls -la src/pages/ && wc -l src/pages/*.tsx
7. BUILD CONFIGURATION: cat vite.config.ts
8. MANIFEST FILE: cat public/manifest.json
9. TEST SETUP: cat vitest.config.ts 2>/dev/null || echo "No test config"

## Step 3: Commit Snapshot

git add analysis-resources/repo-snapshot/CURRENT_STATE.md
git commit -m "docs(snapshot): Capture repository state before Phase 4 code generation"

**COPY TO HERE ↑**
```

---

### STEP 2: ALIGNMENT VERIFICATION

**Purpose:** Verify that knowledge base interfaces align with actual repo state.

**When to Run:** After Step 1, before code generation  
**Who Runs It:** Claude  

#### PROMPT TO SUBMIT TO CLAUDE (Step 2)

```
**ALIGNMENT VERIFICATION PROMPT**

Compare the interfaces defined in the knowledge base against the repository state captured in `/analysis-resources/repo-snapshot/CURRENT_STATE.md`.

Verify alignment for: Project, Step, Field, TestRun, LocatorBundle interfaces and Message Actions.

Output a verification report with ALIGNED or CONFLICT status for each.
```

---

## 3. CODE PROMPT STRUCTURE TEMPLATE

Every Phase 4 code generation prompt follows this structure:

```
**PROMPT P4-XXX: [MODULE NAME IN CAPS]**

## Instructions for Copilot

Create the following TypeScript files at the specified paths. Run tests to verify, then commit.

**Files to create:**
1. `/src/core/[module]/[filename].ts`
2. `/src/core/[module]/[filename].test.ts`

## FILE 1: [filename].ts

/**
 * [Module Description]
 * @module core/[module]
 * @see /analysis-resources/component-breakdowns/[reference]_breakdown.md
 */

[COMPLETE TYPESCRIPT IMPLEMENTATION - 100-300 LINES]

## FILE 2: [filename].test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { [exports] } from './[filename]';

describe('[ModuleName]', () => {
  [COMPLETE TEST SUITE - 50-150 LINES]
});

## Verification Commands

npm run test -- src/core/[module]/[filename].test.ts
npm run type-check
npm run lint -- src/core/[module]/

## Commit Command

git add src/core/[module]/[filename].ts
git add src/core/[module]/[filename].test.ts
git commit -m "feat([module]): Add [description]

Refs: P4-XXX"
```

---

## 4. COMPLETE PROMPT REGISTRY

### Registry Overview

| Category | Prompt Range | Count | Description |
|----------|--------------|-------|-------------|
| 1. Types & Interfaces | P4-001 to P4-015 | 15 | Core type definitions |
| 2. Storage Layer | P4-016 to P4-030 | 15 | Storage adapter system |
| 3. Locator Strategy | P4-031 to P4-050 | 20 | Element finding strategies |
| 4. Message Bus | P4-051 to P4-070 | 20 | Communication system |
| 5. Recording Engine | P4-071 to P4-095 | 25 | Event capture system |
| 6. Replay Engine | P4-096 to P4-120 | 25 | Action execution system |
| 7. CSV Processing | P4-121 to P4-140 | 20 | Data import/mapping |
| 8. Test Orchestrator | P4-141 to P4-160 | 20 | Execution coordination |
| 9. Background Service | P4-161 to P4-180 | 20 | Service worker refactor |
| 10. UI Components | P4-181 to P4-210 | 30 | React component updates |
| 11. Integration | P4-211 to P4-225 | 15 | Cross-module integration |
| **TOTAL** | | **225** | |

---

### CATEGORY 1: TYPES & INTERFACES (P4-001 to P4-015)

**Dependency Layer:** 0 (No dependencies - execute first)  
**Source:** storage-layer_breakdown.md, ui-components_breakdown.md, locator-strategy_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-001 | `src/core/types/project.ts` | Project interface and ProjectStatus type | None |
| P4-002 | `src/core/types/step.ts` | Step interface and StepEvent type | None |
| P4-003 | `src/core/types/field.ts` | Field interface for CSV mapping | None |
| P4-004 | `src/core/types/test-run.ts` | TestRun interface and TestRunStatus type | None |
| P4-005 | `src/core/types/locator-bundle.ts` | LocatorBundle interface (15+ fields) | None |
| P4-006 | `src/core/types/message-types.ts` | Message action types and payloads | None |
| P4-007 | `src/core/types/storage-types.ts` | Storage operation types | P4-001 to P4-004 |
| P4-008 | `src/core/types/recording-types.ts` | Recording event types | P4-002, P4-005 |
| P4-009 | `src/core/types/replay-types.ts` | Replay command types | P4-002, P4-005 |
| P4-010 | `src/core/types/csv-types.ts` | CSV parsing types | P4-003 |
| P4-011 | `src/core/types/orchestrator-types.ts` | Orchestration types | P4-004 |
| P4-012 | `src/core/types/ui-types.ts` | UI state types | P4-001 to P4-004 |
| P4-013 | `src/core/types/config-types.ts` | Configuration types | None |
| P4-014 | `src/core/types/error-types.ts` | Custom error types | None |
| P4-015 | `src/core/types/index.ts` | Barrel export for all types | P4-001 to P4-014 |

---

### CATEGORY 2: STORAGE LAYER (P4-016 to P4-030)

**Dependency Layer:** 1 (Depends on Types)  
**Source:** storage-layer_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-016 | `src/core/storage/IStorageAdapter.ts` | Storage adapter interface | P4-007 |
| P4-017 | `src/core/storage/IProjectRepository.ts` | Project repository interface | P4-001, P4-016 |
| P4-018 | `src/core/storage/ITestRunRepository.ts` | TestRun repository interface | P4-004, P4-016 |
| P4-019 | `src/core/storage/validators/ProjectValidator.ts` | Project data validation | P4-001 |
| P4-020 | `src/core/storage/validators/TestRunValidator.ts` | TestRun data validation | P4-004 |
| P4-021 | `src/core/storage/validators/StepValidator.ts` | Step data validation | P4-002 |
| P4-022 | `src/core/storage/providers/InMemoryStorageProvider.ts` | In-memory storage (testing) | P4-016 to P4-018 |
| P4-023 | `src/core/storage/providers/DexieStorageProvider.ts` | Dexie IndexedDB provider | P4-016 to P4-018 |
| P4-024 | `src/core/storage/providers/DexieDatabase.ts` | Dexie database definition | P4-001, P4-004 |
| P4-025 | `src/core/storage/StorageAdapterFactory.ts` | Factory for storage providers | P4-022, P4-023 |
| P4-026 | `src/core/storage/repositories/ProjectRepository.ts` | Project CRUD operations | P4-017, P4-019 |
| P4-027 | `src/core/storage/repositories/TestRunRepository.ts` | TestRun CRUD operations | P4-018, P4-020 |
| P4-028 | `src/core/storage/migrations/v1-initial.ts` | Initial schema migration | P4-024 |
| P4-029 | `src/core/storage/migrations/MigrationRunner.ts` | Migration execution | P4-028 |
| P4-030 | `src/core/storage/index.ts` | Barrel export for storage | P4-016 to P4-029 |

---

### CATEGORY 3: LOCATOR STRATEGY (P4-031 to P4-050)

**Dependency Layer:** 1 (Depends on Types)  
**Source:** locator-strategy_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-031 | `src/core/locators/ILocatorStrategy.ts` | Locator strategy interface | P4-005 |
| P4-032 | `src/core/locators/LocatorConfig.ts` | Locator configuration | P4-013 |
| P4-033 | `src/core/locators/strategies/XPathStrategy.ts` | XPath element finding (100% confidence) | P4-031 |
| P4-034 | `src/core/locators/strategies/IdStrategy.ts` | ID attribute strategy (90% confidence) | P4-031 |
| P4-035 | `src/core/locators/strategies/NameStrategy.ts` | Name attribute strategy (80% confidence) | P4-031 |
| P4-036 | `src/core/locators/strategies/AriaLabelStrategy.ts` | ARIA label strategy (75% confidence) | P4-031 |
| P4-037 | `src/core/locators/strategies/PlaceholderStrategy.ts` | Placeholder text strategy (70% confidence) | P4-031 |
| P4-038 | `src/core/locators/strategies/DataAttributeStrategy.ts` | Data attribute strategy (65% confidence) | P4-031 |
| P4-039 | `src/core/locators/strategies/FuzzyTextStrategy.ts` | Fuzzy text matching (40% threshold) | P4-031 |
| P4-040 | `src/core/locators/strategies/BoundingBoxStrategy.ts` | Coordinate strategy (200px threshold) | P4-031 |
| P4-041 | `src/core/locators/strategies/CssSelectorStrategy.ts` | CSS selector strategy | P4-031 |
| P4-042 | `src/core/locators/strategies/FormLabelStrategy.ts` | Form label association | P4-031 |
| P4-043 | `src/core/locators/StrategyRegistry.ts` | Strategy registration | P4-033 to P4-042 |
| P4-044 | `src/core/locators/LocatorResolver.ts` | Multi-strategy resolver (9-tier fallback) | P4-043 |
| P4-045 | `src/core/locators/BundleBuilder.ts` | Build locator bundles | P4-005, P4-044 |
| P4-046 | `src/core/locators/BundleValidator.ts` | Validate bundles | P4-005 |
| P4-047 | `src/core/locators/FallbackChain.ts` | Fallback execution with retry | P4-044 |
| P4-048 | `src/core/locators/LocatorCache.ts` | Strategy result caching | P4-044 |
| P4-049 | `src/core/locators/LocatorMetrics.ts` | Strategy performance tracking | P4-044 |
| P4-050 | `src/core/locators/index.ts` | Barrel export for locators | P4-031 to P4-049 |

---

### CATEGORY 4: MESSAGE BUS (P4-051 to P4-070)

**Dependency Layer:** 1 (Depends on Types)  
**Source:** message-bus_breakdown.md, background-service_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-051 | `src/core/messages/IMessageBus.ts` | Message bus interface | P4-006 |
| P4-052 | `src/core/messages/MessageTypes.ts` | Typed message definitions (20+ actions) | P4-006 |
| P4-053 | `src/core/messages/MessagePayloads.ts` | Request/response payloads | P4-006 |
| P4-054 | `src/core/messages/MessageBus.ts` | Core message bus impl | P4-051 to P4-053 |
| P4-055 | `src/core/messages/ChromeMessageAdapter.ts` | Chrome runtime adapter | P4-054 |
| P4-056 | `src/core/messages/TabMessageAdapter.ts` | Chrome tabs adapter | P4-054 |
| P4-057 | `src/core/messages/middleware/IMiddleware.ts` | Middleware interface | P4-054 |
| P4-058 | `src/core/messages/middleware/LoggingMiddleware.ts` | Message logging | P4-057 |
| P4-059 | `src/core/messages/middleware/ValidationMiddleware.ts` | Payload validation | P4-057 |
| P4-060 | `src/core/messages/middleware/RetryMiddleware.ts` | Retry failed messages | P4-057 |
| P4-061 | `src/core/messages/middleware/TimeoutMiddleware.ts` | Message timeout | P4-057 |
| P4-062 | `src/core/messages/MessageRouter.ts` | Route to handlers | P4-054 |
| P4-063 | `src/core/messages/handlers/StorageHandlers.ts` | Storage message handlers | P4-062, P4-030 |
| P4-064 | `src/core/messages/handlers/RecordingHandlers.ts` | Recording handlers | P4-062 |
| P4-065 | `src/core/messages/handlers/ReplayHandlers.ts` | Replay handlers | P4-062 |
| P4-066 | `src/core/messages/handlers/TabHandlers.ts` | Tab management handlers | P4-062 |
| P4-067 | `src/core/messages/RequestResponsePairing.ts` | Request/response matching | P4-054 |
| P4-068 | `src/core/messages/MessageQueue.ts` | Queue for offline | P4-054 |
| P4-069 | `src/core/messages/MessageMetrics.ts` | Message performance | P4-054 |
| P4-070 | `src/core/messages/index.ts` | Barrel export for messages | P4-051 to P4-069 |

---

### CATEGORY 5: RECORDING ENGINE (P4-071 to P4-095)

**Dependency Layer:** 2 (Depends on Locators, Messages)  
**Source:** recording-engine_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-071 | `src/core/recording/IRecordingEngine.ts` | Recording engine interface | P4-008 |
| P4-072 | `src/core/recording/RecordingConfig.ts` | Recording configuration | P4-013 |
| P4-073 | `src/core/recording/RecordingState.ts` | State management | P4-071 |
| P4-074 | `src/core/recording/EventListenerManager.ts` | Attach/detach listeners | P4-071 |
| P4-075 | `src/core/recording/EventCapture.ts` | Capture DOM events | P4-074 |
| P4-076 | `src/core/recording/EventNormalizer.ts` | Normalize events | P4-075 |
| P4-077 | `src/core/recording/labels/ILabelDetector.ts` | Label detector interface | None |
| P4-078 | `src/core/recording/labels/AriaLabelDetector.ts` | ARIA label detection (90%) | P4-077 |
| P4-079 | `src/core/recording/labels/PlaceholderDetector.ts` | Placeholder detection (70%) | P4-077 |
| P4-080 | `src/core/recording/labels/AssociatedLabelDetector.ts` | Form label detection (85%) | P4-077 |
| P4-081 | `src/core/recording/labels/TextContentDetector.ts` | Text content detection (40%) | P4-077 |
| P4-082 | `src/core/recording/labels/GoogleFormsDetector.ts` | Google Forms patterns (95%) | P4-077 |
| P4-083 | `src/core/recording/labels/BootstrapDetector.ts` | Bootstrap layouts (75%) | P4-077 |
| P4-084 | `src/core/recording/labels/MaterialUIDetector.ts` | Material-UI patterns (70%) | P4-077 |
| P4-085 | `src/core/recording/labels/SiblingDetector.ts` | Sibling element detection (60%) | P4-077 |
| P4-086 | `src/core/recording/labels/LabelDetectorRegistry.ts` | Registry of detectors | P4-078 to P4-085 |
| P4-087 | `src/core/recording/labels/LabelResolver.ts` | Resolve best label | P4-086 |
| P4-088 | `src/core/recording/StepBuilder.ts` | Build Step objects | P4-002, P4-087, P4-045 |
| P4-089 | `src/core/recording/IframeHandler.ts` | Iframe event handling | P4-074 |
| P4-090 | `src/core/recording/ShadowDomHandler.ts` | Shadow DOM handling | P4-074 |
| P4-091 | `src/core/recording/InputChangeTracker.ts` | Track input changes | P4-075 |
| P4-092 | `src/core/recording/RecordingEngine.ts` | Main engine implementation | P4-071 to P4-091 |
| P4-093 | `src/core/recording/RecordingSession.ts` | Session management | P4-092 |
| P4-094 | `src/core/recording/RecordingMetrics.ts` | Recording performance | P4-092 |
| P4-095 | `src/core/recording/index.ts` | Barrel export for recording | P4-071 to P4-094 |

---

### CATEGORY 6: REPLAY ENGINE (P4-096 to P4-120)

**Dependency Layer:** 2 (Depends on Locators, Messages)  
**Source:** replay-engine_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-096 | `src/core/replay/IReplayEngine.ts` | Replay engine interface | P4-009 |
| P4-097 | `src/core/replay/ReplayConfig.ts` | Replay configuration (2s timeout, 150ms retry) | P4-013 |
| P4-098 | `src/core/replay/ReplayState.ts` | State management | P4-096 |
| P4-099 | `src/core/replay/ElementFinder.ts` | Find elements using locators | P4-050 |
| P4-100 | `src/core/replay/ElementWaiter.ts` | Wait for elements | P4-099 |
| P4-101 | `src/core/replay/actions/IActionExecutor.ts` | Action executor interface | P4-002 |
| P4-102 | `src/core/replay/actions/ClickExecutor.ts` | Click action execution (humanClick) | P4-101 |
| P4-103 | `src/core/replay/actions/InputExecutor.ts` | Input action execution (React-safe) | P4-101 |
| P4-104 | `src/core/replay/actions/EnterExecutor.ts` | Enter key execution | P4-101 |
| P4-105 | `src/core/replay/actions/OpenExecutor.ts` | Open/navigate execution | P4-101 |
| P4-106 | `src/core/replay/actions/ActionExecutorRegistry.ts` | Registry of executors | P4-102 to P4-105 |
| P4-107 | `src/core/replay/InputSimulator.ts` | React-safe input (property descriptor) | P4-103 |
| P4-108 | `src/core/replay/EventDispatcher.ts` | Dispatch DOM events | P4-107 |
| P4-109 | `src/core/replay/ScrollHandler.ts` | Scroll element into view | P4-099 |
| P4-110 | `src/core/replay/FocusManager.ts` | Manage element focus | P4-099 |
| P4-111 | `src/core/replay/DelayManager.ts` | Step delays (50-300ms human-like) | P4-097 |
| P4-112 | `src/core/replay/RetryHandler.ts` | Retry failed actions | P4-097 |
| P4-113 | `src/core/replay/ErrorRecovery.ts` | Error recovery strategies | P4-112 |
| P4-114 | `src/core/replay/StepExecutor.ts` | Execute single step | P4-106, P4-107 to P4-113 |
| P4-115 | `src/core/replay/ReplayEngine.ts` | Main engine implementation | P4-096 to P4-114 |
| P4-116 | `src/core/replay/ReplaySession.ts` | Session management | P4-115 |
| P4-117 | `src/core/replay/ReplayResult.ts` | Result types | P4-115 |
| P4-118 | `src/core/replay/ReplayMetrics.ts` | Replay performance | P4-115 |
| P4-119 | `src/core/replay/ShadowDomReplay.ts` | Shadow DOM replay | P4-115 |
| P4-120 | `src/core/replay/index.ts` | Barrel export for replay | P4-096 to P4-119 |

---

### CATEGORY 7: CSV PROCESSING (P4-121 to P4-140)

**Dependency Layer:** 1 (Depends on Types)  
**Source:** csv-processing_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-121 | `src/core/csv/ICsvProcessor.ts` | CSV processor interface | P4-010 |
| P4-122 | `src/core/csv/CsvConfig.ts` | CSV configuration | P4-013 |
| P4-123 | `src/core/csv/parsers/CsvParser.ts` | Parse CSV files (PapaParse) | P4-121 |
| P4-124 | `src/core/csv/parsers/ExcelParser.ts` | Parse Excel files | P4-121 |
| P4-125 | `src/core/csv/parsers/ParserFactory.ts` | Parser factory | P4-123, P4-124 |
| P4-126 | `src/core/csv/validation/CsvValidator.ts` | Validate CSV data | P4-121 |
| P4-127 | `src/core/csv/validation/HeaderValidator.ts` | Validate headers | P4-126 |
| P4-128 | `src/core/csv/validation/RowValidator.ts` | Validate rows | P4-126 |
| P4-129 | `src/core/csv/mapping/IFieldMapper.ts` | Field mapper interface | P4-003 |
| P4-130 | `src/core/csv/mapping/StringSimilarityMatcher.ts` | Fuzzy matching (0.3 threshold) | P4-129 |
| P4-131 | `src/core/csv/mapping/ExactMatcher.ts` | Exact name matching | P4-129 |
| P4-132 | `src/core/csv/mapping/FieldMapper.ts` | Main field mapper | P4-130, P4-131 |
| P4-133 | `src/core/csv/mapping/MappingValidator.ts` | Validate mappings | P4-132 |
| P4-134 | `src/core/csv/mapping/MappingSuggester.ts` | Suggest mappings | P4-132 |
| P4-135 | `src/core/csv/CsvProcessor.ts` | Main processor | P4-125, P4-126, P4-132 |
| P4-136 | `src/core/csv/DataInjector.ts` | Inject values into steps | P4-135 |
| P4-137 | `src/core/csv/RowIterator.ts` | Iterate CSV rows | P4-135 |
| P4-138 | `src/core/csv/CsvExporter.ts` | Export to CSV | P4-121 |
| P4-139 | `src/core/csv/CsvMetrics.ts` | CSV processing metrics | P4-135 |
| P4-140 | `src/core/csv/index.ts` | Barrel export for CSV | P4-121 to P4-139 |

---

### CATEGORY 8: TEST ORCHESTRATOR (P4-141 to P4-160)

**Dependency Layer:** 3 (Depends on Storage, Replay, CSV)  
**Source:** test-orchestrator_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-141 | `src/core/orchestrator/ITestOrchestrator.ts` | Orchestrator interface | P4-011 |
| P4-142 | `src/core/orchestrator/OrchestratorConfig.ts` | Orchestrator configuration | P4-013 |
| P4-143 | `src/core/orchestrator/OrchestratorState.ts` | State management | P4-141 |
| P4-144 | `src/core/orchestrator/ExecutionPlan.ts` | Test execution plan | P4-141 |
| P4-145 | `src/core/orchestrator/RowExecutor.ts` | Execute single row | P4-120, P4-140 |
| P4-146 | `src/core/orchestrator/StepSequencer.ts` | Sequence step execution | P4-145 |
| P4-147 | `src/core/orchestrator/ValueInjector.ts` | Inject CSV values | P4-136 |
| P4-148 | `src/core/orchestrator/ProgressTracker.ts` | Track progress | P4-143 |
| P4-149 | `src/core/orchestrator/LogCollector.ts` | Collect logs (as string) | P4-143 |
| P4-150 | `src/core/orchestrator/ResultAggregator.ts` | Aggregate results | P4-148, P4-149 |
| P4-151 | `src/core/orchestrator/TestRunBuilder.ts` | Build TestRun objects | P4-004, P4-150 |
| P4-152 | `src/core/orchestrator/TabManager.ts` | Manage browser tabs | P4-070 |
| P4-153 | `src/core/orchestrator/ScriptInjector.ts` | Inject content scripts | P4-152 |
| P4-154 | `src/core/orchestrator/ErrorHandler.ts` | Handle execution errors | P4-014 |
| P4-155 | `src/core/orchestrator/StopController.ts` | isRunningRef pattern (useRef) | P4-143 |
| P4-156 | `src/core/orchestrator/PauseController.ts` | Pause/resume | P4-143 |
| P4-157 | `src/core/orchestrator/TestOrchestrator.ts` | Main orchestrator | P4-141 to P4-156 |
| P4-158 | `src/core/orchestrator/OrchestratorSession.ts` | Session management | P4-157 |
| P4-159 | `src/core/orchestrator/OrchestratorMetrics.ts` | Orchestrator performance | P4-157 |
| P4-160 | `src/core/orchestrator/index.ts` | Barrel export | P4-141 to P4-159 |

---

### CATEGORY 9: BACKGROUND SERVICE (P4-161 to P4-180)

**Dependency Layer:** 3 (Depends on Messages, Storage)  
**Source:** background-service_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-161 | `src/background/IBackgroundService.ts` | Service interface | P4-070 |
| P4-162 | `src/background/BackgroundConfig.ts` | Service configuration | P4-013 |
| P4-163 | `src/background/ServiceWorkerManager.ts` | Service worker lifecycle | P4-161 |
| P4-164 | `src/background/MessageReceiver.ts` | Receive messages | P4-070 |
| P4-165 | `src/background/handlers/ProjectHandlers.ts` | Project CRUD handlers | P4-030, P4-062 |
| P4-166 | `src/background/handlers/TestRunHandlers.ts` | TestRun handlers | P4-030, P4-062 |
| P4-167 | `src/background/handlers/RecordingHandlers.ts` | Recording handlers | P4-095, P4-062 |
| P4-168 | `src/background/handlers/ReplayHandlers.ts` | Replay handlers | P4-120, P4-062 |
| P4-169 | `src/background/handlers/TabHandlers.ts` | Tab management | P4-062 |
| P4-170 | `src/background/TabController.ts` | Control browser tabs | P4-169 |
| P4-171 | `src/background/ScriptInjectionService.ts` | Inject content scripts | P4-170 |
| P4-172 | `src/background/StorageCoordinator.ts` | Coordinate storage | P4-030 |
| P4-173 | `src/background/SessionManager.ts` | Manage sessions | P4-163 |
| P4-174 | `src/background/NotificationService.ts` | Browser notifications | P4-161 |
| P4-175 | `src/background/ContextMenuService.ts` | Context menu | P4-161 |
| P4-176 | `src/background/AlarmService.ts` | Chrome alarms (keepalive) | P4-161 |
| P4-177 | `src/background/BackgroundService.ts` | Main service | P4-161 to P4-176 |
| P4-178 | `src/background/background.ts` | Entry point (refactored) | P4-177 |
| P4-179 | `src/background/BackgroundMetrics.ts` | Service metrics | P4-177 |
| P4-180 | `src/background/index.ts` | Barrel export | P4-161 to P4-179 |

---

### CATEGORY 10: UI COMPONENTS (P4-181 to P4-210)

**Dependency Layer:** 4 (Depends on all core modules)  
**Source:** ui-components_breakdown.md

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-181 | `src/hooks/useStorage.ts` | Storage hook | P4-030 |
| P4-182 | `src/hooks/useProjects.ts` | Projects hook | P4-181 |
| P4-183 | `src/hooks/useTestRuns.ts` | TestRuns hook | P4-181 |
| P4-184 | `src/hooks/useRecording.ts` | Recording hook | P4-095 |
| P4-185 | `src/hooks/useReplay.ts` | Replay hook | P4-120 |
| P4-186 | `src/hooks/useCsv.ts` | CSV hook | P4-140 |
| P4-187 | `src/hooks/useOrchestrator.ts` | Orchestrator hook | P4-160 |
| P4-188 | `src/hooks/useMessages.ts` | Message bus hook | P4-070 |
| P4-189 | `src/hooks/index.ts` | Barrel export for hooks | P4-181 to P4-188 |
| P4-190 | `src/context/StorageContext.tsx` | Storage context | P4-181 |
| P4-191 | `src/context/RecordingContext.tsx` | Recording context | P4-184 |
| P4-192 | `src/context/ReplayContext.tsx` | Replay context | P4-185 |
| P4-193 | `src/context/index.ts` | Barrel export for context | P4-190 to P4-192 |
| P4-194 | `src/pages/Dashboard.tsx` | Dashboard (refactored) | P4-182, P4-183 |
| P4-195 | `src/pages/Recorder.tsx` | Recorder (refactored) | P4-184 |
| P4-196 | `src/pages/FieldMapper.tsx` | FieldMapper (refactored) | P4-186 |
| P4-197 | `src/pages/TestRunner.tsx` | TestRunner (isRunningRef) | P4-187 |
| P4-198 | `src/components/Dashboard/ProjectList.tsx` | Project list | P4-194 |
| P4-199 | `src/components/Dashboard/ProjectCard.tsx` | Project card | P4-198 |
| P4-200 | `src/components/Dashboard/CreateProjectDialog.tsx` | Create dialog | P4-194 |
| P4-201 | `src/components/Recorder/StepsTable.tsx` | Steps table (drag-drop) | P4-195 |
| P4-202 | `src/components/Recorder/RecorderToolbar.tsx` | Toolbar | P4-195 |
| P4-203 | `src/components/Mapper/FieldMappingTable.tsx` | Mapping table | P4-196 |
| P4-204 | `src/components/Mapper/AutoMapButton.tsx` | Auto-map (0.3) | P4-196 |
| P4-205 | `src/components/Runner/TestConsole.tsx` | Console | P4-197 |
| P4-206 | `src/components/Runner/TestResults.tsx` | Results (parseLogs) | P4-197 |
| P4-207 | `src/components/Runner/ProgressBar.tsx` | Progress bar | P4-197 |
| P4-208 | `src/components/Runner/ControlPanel.tsx` | Control panel | P4-197 |
| P4-209 | `src/components/shared/ErrorBoundary.tsx` | Error boundary | P4-014 |
| P4-210 | `src/components/shared/LoadingSpinner.tsx` | Loading spinner | None |

---

### CATEGORY 11: INTEGRATION & POLISH (P4-211 to P4-225)

**Dependency Layer:** 5 (Final integration)

| Prompt | File | Description | Dependencies |
|--------|------|-------------|--------------|
| P4-211 | `src/contentScript/content.tsx` | Content script (refactored) | P4-095, P4-120 |
| P4-212 | `src/contentScript/RecordingMode.ts` | Recording mode | P4-211 |
| P4-213 | `src/contentScript/ReplayMode.ts` | Replay mode | P4-211 |
| P4-214 | `src/App.tsx` | App root (refactored) | P4-193 |
| P4-215 | `src/main.tsx` | Entry point (refactored) | P4-214 |
| P4-216 | `tests/integration/storage.test.ts` | Storage integration tests | P4-030 |
| P4-217 | `tests/integration/recording.test.ts` | Recording integration tests | P4-095 |
| P4-218 | `tests/integration/replay.test.ts` | Replay integration tests | P4-120 |
| P4-219 | `tests/integration/orchestrator.test.ts` | Orchestrator integration tests | P4-160 |
| P4-220 | `tests/e2e/full-workflow.test.ts` | E2E workflow test | All |
| P4-221 | `src/core/index.ts` | Core barrel export | All core modules |
| P4-222 | `vitest.config.ts` | Test configuration | None |
| P4-223 | `tsconfig.json` | TypeScript config (updated) | None |
| P4-224 | `.eslintrc.js` | ESLint config (updated) | None |
| P4-225 | `package.json` | Dependencies (updated) | None |

---

## 5. MODULE-TO-FILE MAPPING

See Section 4 prompt registry for complete file paths.

**Directory Structure Summary:**

```
src/
├── core/
│   ├── types/          (15 files) P4-001 to P4-015
│   ├── storage/        (15 files) P4-016 to P4-030
│   ├── locators/       (20 files) P4-031 to P4-050
│   ├── messages/       (20 files) P4-051 to P4-070
│   ├── recording/      (25 files) P4-071 to P4-095
│   ├── replay/         (25 files) P4-096 to P4-120
│   ├── csv/            (20 files) P4-121 to P4-140
│   ├── orchestrator/   (20 files) P4-141 to P4-160
│   └── index.ts
├── background/         (20 files) P4-161 to P4-180
├── contentScript/      (3 files)  P4-211 to P4-213
├── hooks/              (9 files)  P4-181 to P4-189
├── context/            (4 files)  P4-190 to P4-193
├── pages/              (4 files)  P4-194 to P4-197
├── components/         (13 files) P4-198 to P4-210
├── App.tsx                        P4-214
└── main.tsx                       P4-215
tests/
├── integration/        (4 files)  P4-216 to P4-219
└── e2e/                (1 file)   P4-220
```

---

## 6. INTERFACE ALIGNMENT TABLE

### Verified Interfaces (From Updated Knowledge Base - Commit fa5f8d9)

| Interface | Key Fields | Source |
|-----------|-----------|--------|
| **Project** | id, name, description, status: 'draft'\|'testing'\|'complete', target_url, created_date, updated_date, recorded_steps[], parsed_fields[], csv_data[] | storage-layer_breakdown.md |
| **Step** | id, name, event: 'click'\|'input'\|'enter'\|'open', path (XPath), value, label, x, y, bundle? | ui-components_breakdown.md |
| **Field** | field_name, mapped, inputvarfields | csv-processing_breakdown.md |
| **TestRun** | id, project_id, status: 'pending'\|'running'\|'completed'\|'failed', start_time, end_time, total_steps, passed_steps, failed_steps, test_results[], logs (string) | storage-layer_breakdown.md |
| **LocatorBundle** | tag, id, name, placeholder, aria, dataAttrs, text, css, xpath, classes, pageUrl, bounding, iframeChain, shadowHosts | locator-strategy_breakdown.md |

### Message Actions (lowercase snake_case)

add_project, update_project, get_all_projects, delete_project, get_project_by_id, update_project_steps, update_project_fields, update_project_csv, createTestRun, updateTestRun, getTestRunsByProject, open_project_url_and_inject, close_opened_tab, start_recording, stop_recording, start_replay, stop_replay, logEvent

### Critical Patterns

| Pattern | Description |
|---------|-------------|
| **isRunningRef** | useRef(false) for immediate stop (synchronous) |
| **return true** | Required in async chrome.runtime.onMessage handlers |
| **React-safe input** | Property descriptor bypass for controlled inputs |
| **0.3 threshold** | Auto-mapping fuzzy match threshold (30%) |
| **9-tier fallback** | XPath → ID → name → aria → placeholder → data → fuzzy → bbox → retry |
| **2s timeout** | Default element find timeout with 150ms retry interval |

---

## 7. DEPENDENCY GRAPH

```
LAYER 0: Types (P4-001 to P4-015)
    ▼
LAYER 1: Storage, Locators, Messages, CSV (P4-016 to P4-070, P4-121 to P4-140)
    ▼
LAYER 2: Recording, Replay (P4-071 to P4-120)
    ▼
LAYER 3: Orchestrator, Background (P4-141 to P4-180)
    ▼
LAYER 4: UI Components (P4-181 to P4-210)
    ▼
LAYER 5: Integration (P4-211 to P4-225)
```

---

## 8. QUALITY GATES

- Run tests before commit: `npm run test -- [file]`
- Type check: `npm run type-check`
- Lint: `npm run lint -- [folder]`
- 80%+ test coverage per file
- No `any` types

---

## 9. ERROR HANDLING & RECOVERY

**If tests fail:** Do not commit. Fix or re-request prompt.  
**If type errors:** Check imports and prerequisite prompts.  
**If dependency missing:** Execute prerequisite prompt first.  
**To revert:** `git revert HEAD`

---

**END OF PHASE 4 CODE GENERATION MANUAL**

*Version: 2.0 | Created: November 27, 2025 | Prompts: 225 | Estimated: 40-60 hours*
