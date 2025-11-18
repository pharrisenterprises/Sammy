# RESOURCE MAP (MASTER INDEX)
This file is the single source of truth for understanding the analysis-resource library structure.  
It must be updated automatically every time any analysis prompt, breakdown prompt, or design prompt adds new files or subfolders.

## DIRECTORY OVERVIEW
- **analysis-resources/**  
  Root folder for all analysis, architecture mapping, breakdowns, and planning documents used to guide code generation.

- **analysis-resources/project-analysis/**  
  Holds outputs from the initial repo analysis phase:  
  - **00_meta-analysis.md** — Master repo analysis: overview, stack, architecture, directory, dependencies, subsystem boundaries, and complexity map.
  - 01_stack-breakdown.md  
  - 02_architecture-map.md  
  - 03_folder-structure.md  
  - 04_dependencies.md  

- **analysis-resources/component-breakdowns/**  
  Contains deep-dive documents for specific components.  
  Format: `<component-name>_breakdown.md`

- **analysis-resources/modularization-plans/**  
  Holds modular re-architecture plans for future rebuilding steps.

- **analysis-resources/build-instructions/**  
  Contains build pipeline designs and environment toolchain notes.

- **analysis-resources/implementation-guides/**  
  Contains detailed instructions used during later code-generation phases.

- **analysis-resources/prompts/**  
  Contains saved standardized prompts for the automated code-factory system.

- **analysis-resources/references/**  
  Contains external and internal reference material required for accurate code generation.

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
