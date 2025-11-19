# RESOURCE MAP (MASTER INDEX)
This file is the single source of truth for understanding the analysis-resource library structure.  
It must be updated automatically every time any analysis prompt, breakdown prompt, or design prompt adds new files or subfolders.

## DIRECTORY OVERVIEW
- **analysis-resources/**  
  Root folder for all analysis, architecture mapping, breakdowns, and planning documents used to guide code generation.

- **analysis-resources/project-analysis/**  
  Holds outputs from the initial repo analysis phase:  
  - **00_meta-analysis.md** — Master repo analysis: overview, stack, architecture, directory, dependencies, subsystem boundaries, and complexity map.
  - **00_project-summary.md** — High-level project summary (to be populated).
  - **01_stack-breakdown.md** — Detailed technology stack analysis (to be populated).
  - **02_architecture-map.md** — System architecture and communication flows (to be populated).
  - **03_folder-structure.md** — Directory structure and file organization (to be populated).
  - **04_dependencies.md** — Dependency analysis and roles (to be populated).

- **analysis-resources/component-breakdowns/**  
  Contains deep-dive documents for specific components and subsystems (standardized 7-section format):
  - **recording-engine_breakdown.md** — Event capture system, label detection, locator generation, interaction recording.
  - **replay-engine_breakdown.md** — Step execution engine, multi-strategy element finding, action replay, React input handling.
  - **locator-strategy_breakdown.md** — 9-tier element resolution system (XPath → ID → Name → fuzzy matching).
  - **storage-layer_breakdown.md** — Dexie IndexedDB wrapper, message-based CRUD, test run tracking.
  - **message-bus_breakdown.md** — chrome.runtime/tabs messaging infrastructure, 20+ action handlers, async coordination.
  - **ui-components_breakdown.md** — React UI pages (Dashboard, Recorder, Mapper, Runner), Radix UI components.
  - **csv-processing_breakdown.md** — PapaParse/XLSX parsing, auto-mapping with 0.3 threshold, field validation.
  - **test-orchestrator_breakdown.md** — Multi-row execution loop, tab lifecycle, CSV value injection, timing control.
  - **background-service_breakdown.md** — Service worker coordinator, message routing, tab management, script injection.
  - **content-script-system_breakdown.md** — Dual-mode recording/replay, iframe coordination, shadow DOM penetration, cross-context messaging.

- **analysis-resources/modularization-plans/**  
  Holds modular re-architecture plans for future rebuilding steps:
  - **00_modularization-overview.md** — Master modularization blueprint: module definitions, boundaries, and rebuild strategy.
  - **recording-engine_mod-plan.md** — Recording Engine modularization plan (to be populated).
  - **replay-engine_mod-plan.md** — Replay Engine modularization plan (to be populated).
  - **locator-strategy_mod-plan.md** — Locator Strategy System modularization plan (to be populated).
  - **storage-layer_mod-plan.md** — Storage Layer modularization plan (to be populated).
  - **message-bus_mod-plan.md** — Message Bus modularization plan (to be populated).
  - **ui-components_mod-plan.md** — UI Components modularization plan (to be populated).
  - **csv-processing_mod-plan.md** — CSV Processing Engine modularization plan (to be populated).
  - **test-orchestrator_mod-plan.md** — Test Orchestrator modularization plan (to be populated).

- **analysis-resources/build-instructions/**  
  Contains build pipeline designs and environment toolchain notes:
  - **build-pipeline-overview.md** — Complete build system documentation: Vite configs, TypeScript, bundling, optimization strategies.
  - **environment-requirements.md** — Development environment setup and requirements (to be populated).

- **analysis-resources/implementation-guides/**  
  Contains detailed instructions used during later code-generation phases:
  - **high-level-implementation.md** — Master implementation guide: principles, priorities, boundaries, workflows, quality standards.
  - **recording-engine_impl.md** — Recording Engine implementation details (to be populated).
  - **replay-engine_impl.md** — Replay Engine implementation details (to be populated).
  - **locator-strategy_impl.md** — Locator Strategy implementation details (to be populated).
  - **storage-layer_impl.md** — Storage Layer implementation details (to be populated).
  - **message-bus_impl.md** — Message Bus implementation details (to be populated).

- **analysis-resources/prompts/**  
  Contains saved standardized prompts for the automated code-factory system:
  - **prompt-history.md** — Record of prompts used during development phases (to be populated).
  - **future-prompts.md** — Templates and planned prompts for future work (to be populated).

- **analysis-resources/references/**  
  Contains external and internal reference material required for accurate code generation:
  - **tech-links.md** — Links to external documentation, libraries, and resources (to be populated).
  - **code-notes.md** — Internal code notes, patterns, and architectural decisions (to be populated).

- **analysis-resources/rollups/**  
  Contains mid-tier rollup summaries that compress multiple detailed resources (component breakdowns, modularization plans, implementation guides) into shorter, highly-structured overview files for efficient AI prompt usage. Each rollup aggregates all analysis for a single subsystem:
  - **background-service_rollup.md** — Aggregated summary of Background Service (central coordinator, message routing, tab management, script injection, storage coordination).
  - **content-script-system_rollup.md** — Aggregated summary of Content Script System (dual-mode recording/replay, iframe coordination, shadow DOM penetration, cross-context messaging).
  - **csv-processing_rollup.md** — Aggregated summary of CSV Processing Engine (file import, parsing, auto-mapping, field validation, data injection).
  - **locator-strategy_rollup.md** — Aggregated summary of Locator Strategy System (multi-strategy generation, 9-tier fallback resolution, XPath/bundle contracts).
  - **message-bus_rollup.md** — Aggregated summary of Message Bus (communication infrastructure, context bridging, request/response pairing, 20+ message actions).
  - **recording-engine_rollup.md** — Aggregated summary of Recording Engine (event capture, 12+ label heuristics, locator generation, iframe/shadow DOM handling).
  - **replay-engine_rollup.md** — Aggregated summary of Replay Engine (multi-strategy element finding, React-safe input handling, action execution, error recovery).
  - **storage-layer_rollup.md** — Aggregated summary of Storage Layer (Dexie IndexedDB wrapper, project/test run CRUD, message-based coordination).
  - **test-orchestrator_rollup.md** — Aggregated summary of Test Orchestrator (execution coordination, multi-row iteration, progress tracking, result collection).
  - **ui-components_rollup.md** — Aggregated summary of UI Components (React pages, state management, Radix UI primitives, routing, styling).

## UPDATE RULES
Every time a new file or folder is created in the analysis-resources tree:
1. Add a new section to this _RESOURCE_MAP.md
2. Add links to the new files
3. Add a description of what those files contain
4. Maintain logical ordering and consistent hierarchy
5. Never remove existing entries without explicit instruction

## USAGE RULES FOR FUTURE PROMPTS
- All analysis prompts MUST save outputs into the correct subfolder.  
- All design prompts MUST reference files listed in this map.  
- All code-generation prompts MUST reference modularization-plans and implementation-guides.  
- All resource updates MUST be mirrored in this map immediately.

---

## PERMANENT RULE
Every time ANY prompt, script, or automated process creates, deletes, or modifies
a file inside the `analysis-resources/` directory, you MUST:

1. Update `analysis-resources/_RESOURCE_MAP.md` accordingly  
2. Add or modify entries for the affected files  
3. Maintain alphabetical ordering within each section  
4. Maintain consistent indentation and markdown hierarchy  
5. Preserve ALL existing entries unless explicitly instructed otherwise  
6. Treat the Resource Map as the authoritative index for the entire library

Failure to update the Resource Map renders the task incomplete.
