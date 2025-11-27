# Claude Context Package - Repository State Snapshot

**Generated:** November 27, 2025  
**Repository:** pharrisenterprises/Sammy  
**Branch:** main  
**Commit:** fa5f8d9 (Phase 1: Full atomic rollup + resource map update)  
**Purpose:** Complete context transfer for Claude AI assistant

---

## 1. Repository Overview

### Project Identity
- **Name:** Sammy Chrome Extension Test Automation Recorder
- **Type:** Chrome Extension (Manifest V3)
- **Tech Stack:** React 18, TypeScript 5, Vite 6, Dexie.js 4, Tailwind CSS 3.4
- **Architecture:** Event-driven recording/replay system with IndexedDB persistence
- **Current Phase:** Phase 2 Complete (Robustness), Phase 3 In Progress (CSV Processing)

### Core Subsystems (8)
1. **Recording Engine** - content.tsx lines 1-850 (event capture, label detection, bundle generation)
2. **Replay Engine** - content.tsx lines 850-1446 (9-tier element resolution, action execution)
3. **Locator Strategy** - Multi-strategy element identification (XPath, ID, aria, fuzzy text, bounding box)
4. **Storage Layer** - Dexie.js wrapper with projects/testRuns tables, message-coordinated CRUD
5. **Message Bus** - chrome.runtime/tabs messaging, 20+ action handlers in background script
6. **UI Components** - Dashboard, Recorder, TestRunner, Mapper pages (React + Shadcn/Radix)
7. **CSV Processing** - Papa Parse integration, auto-mapping, manual mapping UI (Phase 3 in progress)
8. **Test Orchestrator** - TestRunner page execution loop with progress tracking

---

## 2. Critical File Locations

### Documentation (analysis-resources/)
```
analysis-resources/
├── _RESOURCE_MAP.md                    # Master index (THIS IS YOUR NAVIGATION FILE)
├── PHASE_3_META_MANUAL.md             # Smart Prompt generation rules v2.0 (743 lines)
│
├── component-breakdowns/ (10 files - ALL ATOMIC ROLLUPS)
│   ├── recording-engine_breakdown.md   # 250 lines, 9-section format
│   ├── replay-engine_breakdown.md      # 250 lines, 9-section format
│   ├── locator-strategy_breakdown.md   # 230 lines, 9-section format
│   ├── storage-layer_breakdown.md      # 220 lines, 9-section format
│   ├── message-bus_breakdown.md        # 250 lines, 9-section format
│   ├── ui-components_breakdown.md      # 200 lines, 9-section format
│   ├── csv-processing_breakdown.md     # 60 lines, 9-section format
│   ├── test-orchestrator_breakdown.md  # 60 lines, 9-section format
│   ├── background-service_breakdown.md # 70 lines, 9-section format
│   └── content-script-system_breakdown.md # 70 lines, 9-section format
│
├── build-instructions/ (2 files - ATOMIC ROLLUPS)
│   ├── build-pipeline-overview.md      # 140 lines, 9-section format
│   └── environment-requirements.md     # 130 lines, 9-section format
│
├── implementation-guides/ (2 files)
│   ├── high-level-implementation.md    # 200 lines, Phase 1-5 roadmap, 9-section format
│   └── PHASE_3_META_MANUAL.md         # 743 lines, Smart Prompt rules
│
├── rollups/ (10 files - ⚠️ DEPRECATED)
│   └── [All superseded by component-breakdowns/ atomic rollups]
│
├── modularization-plans/ (9 files)
│   └── [Refactoring plans for splitting content.tsx monolith]
│
├── project-analysis/ (5 files)
│   └── [00_project-summary.md, 01_stack-breakdown.md, etc.]
│
└── prompts/ (2 files)
    ├── prompt-history.md
    └── future-prompts.md
```

### Phase 3 Masterplan (build-instructions/masterplan/)
```
build-instructions/masterplan/
├── _PHASE_3_STATUS_TRACKER.md         # 428 lines, 69-file checklist, 12-batch plan
├── .gitkeep files in 16 subdirectories (01-overview through 16-testing)
└── [68 files to be generated via Smart Prompts - 1/69 complete]
```

### Source Code (src/)
```
src/
├── background/background.ts            # 323 lines - Message router, DB coordinator
├── contentScript/
│   ├── content.tsx                    # 1,446 lines - MONOLITH (recording + replay)
│   └── page-interceptor.tsx           # 107 lines - Shadow DOM exposure
├── pages/
│   ├── Dashboard.tsx                  # 342 lines - Project CRUD
│   ├── Recorder.tsx                   # 493 lines - Recording UI
│   ├── TestRunner.tsx                 # 610 lines - Replay orchestration
│   └── Mapper.tsx                     # Location TBD - CSV mapping UI
├── components/ (Shadcn/Radix UI components)
├── common/services/indexedDB.ts       # 71 lines - Dexie wrapper
└── [Other utility modules]
```

---

## 3. 9-Section Atomic Rollup Format

**All component-breakdowns/ and build-instructions/ files follow this structure:**

1. **Purpose** - What the subsystem does, core responsibilities
2. **Inputs** - Data sources, user interactions, API calls, configuration
3. **Outputs** - Data produced, messages sent, UI updates, side effects
4. **Internal Architecture** - File locations, key functions, data flow, line numbers
5. **Critical Dependencies** - Libraries, APIs, other subsystems, breaking change risks
6. **Hidden Assumptions** - Implicit expectations, hardcoded values, untested scenarios
7. **Stability Concerns** - Technical debt, race conditions, memory leaks, monolithic design
8. **Edge Cases** - Boundary conditions, error scenarios, untested paths
9. **Developer-Must-Know Notes** - Best practices, gotchas, testing requirements, refactoring needs

**Example Structure:**
```markdown
# Subsystem Name - Component Breakdown

## 1. Purpose
[Concise description with bullet points of core responsibilities]

## 2. Inputs
- **Input Type 1:** Description
- **Input Type 2:** Description

## 3. Outputs
- **Output Type 1:** Description with code examples
```

---

## 4. Phase 3 Status

### What's Complete
- ✅ Phase 3 Status Tracker created (_PHASE_3_STATUS_TRACKER.md, commit 8d44eca)
- ✅ Phase 3 Meta-Manual stored (PHASE_3_META_MANUAL.md, commit 79173cc)
- ✅ 16 masterplan subdirectories created with .gitkeeps (commit 17fd508)
- ✅ Full atomic rollup regeneration complete (13 files, commit fa5f8d9)
- ✅ _RESOURCE_MAP.md updated with accurate file descriptions

### What's In Progress
- 🔄 **Phase 3 Masterplan Generation:** 1/69 files complete (tracker only)
- 🔄 **CSV Processing Implementation:** Papa Parse integrated, Mapper UI location TBD
- 🔄 **Test Orchestrator Enhancement:** Multi-row CSV execution loop planned

### What's Pending (68 files)
**12 Smart Prompt Batches to Generate:**
1. Overview (5 files) - Project vision, architecture, glossary, constraints, success metrics
2. Database Schema (6 files) - Dexie tables, Supabase schema, migrations
3. API Contracts (6 files) - Message bus, storage, recording, replay APIs
4. Recording Engine (6 files) - Event capture, label detection, bundle generation
5. Replay Engine (6 files) - Element resolution, action execution, timing
6. Storage Layer (6 files) - IndexedDB, Supabase, sync, caching
7. Message Bus (5 files) - chrome.runtime, action handlers, error recovery
8. UI Components (6 files) - Dashboard, Recorder, TestRunner, Mapper
9. Content Script (6 files) - Dual-mode coordinator, iframe, shadow DOM
10. Background Service (5 files) - Service worker, tab management, keepalive
11. Test Orchestrator (6 files) - Execution loop, progress, results aggregation
12. Locator Strategy (6 files) - Bundle contract, generation, resolution, confidence scoring

---

## 5. Smart Prompt Generation Rules (from PHASE_3_META_MANUAL.md)

### Copilot's Role (CRITICAL)
- **Copilot does NOT generate content** - Only copies and commits
- **Claude generates 100% of file content** and embeds in Smart Prompt
- **Smart Prompts are 400-600 lines** with embedded complete file content

### Prompt Structure Template
```markdown
# Smart Prompt: [Batch Name] - [File Name]

## Context Declaration
Repository: pharrisenterprises/Sammy
Phase: Phase 3 Masterplan Development
Target Directory: build-instructions/masterplan/[subdirectory]/
File: [filename].md
Purpose: [1-2 sentence description]
Dependencies: [List related files]

## File Specifications
Path: build-instructions/masterplan/[subdirectory]/[filename].md
Format: Markdown
Length: [target line count]
Sections: [section list]

## Requirements
[Detailed requirements with acceptance criteria]

## Success Criteria
- [ ] File created at exact path
- [ ] All required sections present
- [ ] Code examples included where applicable
- [ ] Cross-references to related files
- [ ] Committed with message "Phase 3: [description]"

---

## COMPLETE FILE CONTENT BELOW
## (Copilot: Copy exactly as-is, do not modify)

```markdown
[ENTIRE FILE CONTENT HERE - 400-600 LINES]
```

---

## Copilot Instructions
1. Copy the markdown content between the backticks above
2. Create file at: build-instructions/masterplan/[subdirectory]/[filename].md
3. Paste content exactly as provided (no modifications)
4. Commit with message: "Phase 3: [description]"
5. Confirm file created and committed
```

### Content Generation Rules
- **400-600 lines per file** minimum (comprehensive, not summaries)
- **Extract from CURRENT repo code** (src/, analysis-resources/)
- **Include code examples** (10-20 lines each, real patterns from codebase)
- **Cross-reference related files** (explicit paths to other masterplan files)
- **Markdown format** with clear hierarchy (##, ###, ####)
- **Developer-grade technical detail** (line numbers, file paths, function names)

---

## 6. Key Technical Patterns

### Message Bus Pattern (CRITICAL)
```typescript
// CORRECT: Return true for async operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_all_projects") {
    DB.getAllProjects()
      .then(projects => sendResponse({ success: true, projects }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // MUST return true to keep sendResponse channel open
  }
});
```

### React-Safe Input Pattern
```typescript
// Bypass React controlled input restrictions
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'value'
).set;
nativeInputValueSetter.call(element, value);
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
```

### LocatorBundle Contract (IMMUTABLE)
```typescript
interface LocatorBundle {
  tag: string;
  id: string | null;
  name: string | null;
  placeholder: string | null;
  aria: string | null;
  dataAttrs: Record<string, string>;
  text: string;
  css: string;
  xpath: string;
  classes: string[];
  pageUrl: string;
  bounding: { x, y, width, height };
  iframeChain: number[] | null;
  shadowHosts: string[] | null;
}
```

### 9-Tier Fallback Strategy (Replay)
1. XPath (100% confidence)
2. ID + Attributes (90%)
3. Name (80%)
4. Aria (75%)
5. Placeholder (70%)
6. Data Attributes (65%)
7. Fuzzy Text (40% threshold)
8. Bounding Box (200px)
9. Retry Loop (150ms interval, 2s timeout)

---

## 7. Known Issues & Technical Debt

### High Priority
1. **content.tsx Monolith** - 1,446 lines, needs split into recording.ts + replay.ts + locator-strategy.ts
2. **Service Worker Lifecycle** - No keepalive mechanism, terminates after 30s
3. **Message Bus Error Recovery** - No retry logic if chrome.runtime.sendMessage fails
4. **Large Step Arrays** - 10,000+ steps cause UI freeze, need virtualization (react-window)

### Medium Priority
5. **Fuzzy Text Matching Performance** - Iterates all elements of tag type, 500ms+ overhead
6. **XPath Brittleness** - Absolute XPath breaks on DOM structure changes
7. **No Redux Store** - Component-local state despite @reduxjs/toolkit dependency
8. **Message Listener Leaks** - chrome.runtime.onMessage.addListener not cleaned up in useEffect

### Low Priority (Future Phases)
9. **No Unit Tests** - Testing strategy planned but not implemented
10. **Source Maps in Production** - 2MB overhead, exposes source code

---

## 8. Phase Roadmap (from high-level-implementation.md)

### Phase 1: Core MVP (Weeks 1-6) ✅ COMPLETE
- Basic recording (click, input), XPath generation, IndexedDB storage, Dashboard/Recorder UI, basic replay

### Phase 2: Robustness (Weeks 7-8) ✅ COMPLETE
- 9-tier fallback, iframe/shadow DOM, React-safe input, 12+ label strategies, TestRunner UI

### Phase 3: CSV Processing (Weeks 9-10) 🔄 IN PROGRESS
- **Week 9:** CSV upload UI, Papa Parse, auto-mapping algorithm
- **Week 10:** Manual mapping UI (Mapper.tsx), TestRunner integration, multi-row execution loop
- **Masterplan Generation:** 69 files across 12 batches (Smart Prompts)

### Phase 4: Cloud Sync (Weeks 11-12) 📅 PLANNED
- Supabase integration, multi-device sync, team collaboration, cloud test execution

### Phase 5: Advanced Features (Weeks 13-16) 📅 PLANNED
- Visual regression, network mocking, API testing, CI/CD, Chrome Web Store publication

---

## 9. Git Commit History (Recent Phase 3 Activity)

```
fa5f8d9 - Phase 1: Full atomic rollup + resource map update (Nov 27, 2025)
          14 files changed, 1994 insertions(+), 5836 deletions(-)
          - Regenerated all 13 rollup files in 9-section atomic format
          - Updated _RESOURCE_MAP.md with accurate descriptions

17fd508 - Phase 3: Created 16 masterplan subdirectories with .gitkeeps (Nov 2025)
          - 01-overview/ through 16-testing/ directory structure
          - Preserves empty directories in git

79173cc - Phase 3: Added PHASE_3_META_MANUAL.md to analysis-resources (Nov 2025)
          - 743 lines, Smart Prompt generation rules v2.0
          - Stored in analysis-resources/implementation-guides/

8d44eca - Phase 3: Created _PHASE_3_STATUS_TRACKER.md (Nov 2025)
          - 428 lines, 69-file checklist, 12-batch plan
          - Copilot↔Claude sync model, verification commands
```

---

## 10. Usage Instructions for Claude

### On Context Refresh (When You Return)
1. **Read this file first** (CLAUDE_CONTEXT_PACKAGE.md) - 5 min overview
2. **Read _RESOURCE_MAP.md** - Navigation to all documentation
3. **Read PHASE_3_META_MANUAL.md** - Smart Prompt generation rules (CRITICAL)
4. **Read _PHASE_3_STATUS_TRACKER.md** - File checklist, batch plan
5. **Read component-breakdowns/** - Current implementation state (prioritize recording-engine, replay-engine, storage-layer)

### When Generating Smart Prompts
1. **Follow PHASE_3_META_MANUAL.md template exactly** (400-600 lines)
2. **Extract content from atomic rollups** (component-breakdowns/)
3. **Reference source code** (src/background/, src/contentScript/, src/pages/)
4. **Include real code examples** from codebase (10-20 lines each)
5. **Embed complete file content** in prompt (Copilot copies, doesn't generate)
6. **Use commit message format:** "Phase 3: [Batch Name] - [File Description]"

### When User Requests File Generation
**User says:** "Generate Smart Prompt for [file name]"

**You do:**
1. Check _PHASE_3_STATUS_TRACKER.md for file dependencies
2. Read relevant atomic rollup (e.g., recording-engine_breakdown.md)
3. Extract source code examples from src/
4. Generate 400-600 line Smart Prompt following PHASE_3_META_MANUAL.md template
5. Embed complete markdown file content in prompt
6. Provide prompt to user in single message

### When User Reports Copilot Completion
**User says:** "Copilot created [file name], commit [hash]"

**You do:**
1. Acknowledge completion
2. Update mental model of Phase 3 progress (X/69 files complete)
3. Suggest next file in batch or next batch to generate

---

## 11. Quick Reference - File Sizes

### Atomic Rollups (component-breakdowns/)
- recording-engine_breakdown.md: ~250 lines
- replay-engine_breakdown.md: ~250 lines
- locator-strategy_breakdown.md: ~230 lines
- storage-layer_breakdown.md: ~220 lines
- message-bus_breakdown.md: ~250 lines
- ui-components_breakdown.md: ~200 lines
- csv-processing_breakdown.md: ~60 lines
- test-orchestrator_breakdown.md: ~60 lines
- background-service_breakdown.md: ~70 lines
- content-script-system_breakdown.md: ~70 lines

### Build Instructions
- build-pipeline-overview.md: ~140 lines
- environment-requirements.md: ~130 lines

### Implementation Guides
- high-level-implementation.md: ~200 lines
- PHASE_3_META_MANUAL.md: 743 lines

### Phase 3 Masterplan
- _PHASE_3_STATUS_TRACKER.md: 428 lines
- Target per masterplan file: 400-600 lines

---

## 12. Critical Reminders

### For Claude
- **You generate content, Copilot commits** - Don't ask Copilot to write code
- **400-600 lines minimum per Smart Prompt** - Comprehensive, not summaries
- **Extract from repo only** - No external sources, no assumptions
- **Follow 9-section format** when creating technical docs
- **Embed complete file content** in Smart Prompts (not just outlines)

### For Understanding Codebase
- **content.tsx is a monolith** - 1,446 lines, recording + replay mixed
- **Bundle is immutable contract** - Never remove fields, only add optional ones
- **XPath is primary but brittle** - 100% confidence but breaks on DOM changes
- **"return true" is mandatory** - Async chrome.runtime.onMessage handlers
- **React input needs property descriptor** - Bypass React controlled input restrictions

### For Phase 3 Workflow
1. User requests Smart Prompt
2. Claude generates 400-600 line prompt with embedded file content
3. User provides prompt to Copilot
4. Copilot copies content and commits
5. User reports completion to Claude
6. Repeat for 68 remaining files

---

## End of Context Package

**Total Documentation:** 40+ files, ~5,000 lines of atomic rollups  
**Codebase Size:** ~3,500 lines core logic (background, content, pages)  
**Phase 3 Target:** 69 masterplan files (400-600 lines each) = ~35,000 lines documentation  
**Current Progress:** 1/69 files (tracker), 13/13 atomic rollups complete

**You are now up to date with repository state as of commit fa5f8d9 (November 27, 2025).**
