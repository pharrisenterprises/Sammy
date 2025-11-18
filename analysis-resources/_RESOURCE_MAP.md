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
  Contains deep-dive documents for specific components and subsystems:
  - **recording-engine_breakdown.md** — Recording Engine architecture, event capture, label detection strategies.
  - **replay-engine_breakdown.md** — Replay Engine architecture, element finding, action execution.
  - **locator-strategy_breakdown.md** — Locator Strategy System, multi-strategy resolution, confidence scoring.
  - **storage-layer_breakdown.md** — Storage abstraction layer, providers, data models.
  - **message-bus_breakdown.md** — Centralized messaging system, typed contracts, request/response handling.
  - **ui-components_breakdown.md** — UI component library, design system, presentation layer.
  - **csv-processing_breakdown.md** — CSV/Excel parsing, auto-mapping, data validation.
  - **test-orchestrator_breakdown.md** — Test execution orchestrator, multi-row execution, result aggregation.
  - **background-service_breakdown.md** — Background service worker coordination and lifecycle management.
  - **content-script-system_breakdown.md** — Content script coordination, iframe injection, shadow DOM handling.

- **analysis-resources/modularization-plans/**  
  Holds modular re-architecture plans for future rebuilding steps:
  - **00_modularization-overview.md** — Master modularization blueprint: module definitions, boundaries, migration path, success metrics.
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
