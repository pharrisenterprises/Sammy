# Phase 3 Meta-Manual: How to Write Copilot Smart Prompts

**Purpose:** This document defines the exact rules Claude must follow when generating Smart Prompts for Copilot. This ensures consistent, high-quality prompts that Copilot can execute without modifications.

**Version:** 2.0 (Updated after successful Prompts 2a-2e)  
**Last Updated:** November 22, 2025

---

## CORE PRINCIPLE

**Claude generates the complete file content and embeds it in the prompt.**  
**Copilot copies the content and commits it to the repo.**  
**Copilot does NOT generate content.**

---

## PROMPT STRUCTURE TEMPLATE

Every Smart Prompt MUST follow this exact structure:

```
---

**COPY FROM HERE ↓**

**PROMPT [NUMBER][LETTER]: [SECTION NAME IN CAPS]**

---

## Instructions for Copilot

Copy the markdown content below between the START/END markers and create the file at the specified path. Then commit with the provided message.

**File path:** `/build-instructions/masterplan/[SECTION]/[filename].md`

---

## CONTENT START

```markdown
[COMPLETE 400-600 LINE MARKDOWN FILE HERE]
```

## CONTENT END

---

## Commit Command

```bash
git add /build-instructions/masterplan/[SECTION]/[filename].md
git commit -m "[Commit message describing what was added]"
```

---

**COPY TO HERE ↑**

---
```

---

## MANDATORY PROMPT ELEMENTS

### 1. Section Title (Large Characters)

**Format:** `**PROMPT [NUMBER][LETTER]: [SECTION NAME]**`

**Examples:**
- `**PROMPT 3a: SUPABASE SCHEMA**`
- `**PROMPT 5b: CONTENT SCRIPT SYSTEM**`
- `**PROMPT 10d: QUICK ACTIONS**`

**Rules:**
- Always bold with double asterisks
- Section name ALWAYS in ALL CAPS
- Use letter suffix (a, b, c) when section has multiple files
- Place immediately after "COPY FROM HERE ↓"

### 2. Instructions for Copilot Section

**Format:**
```
## Instructions for Copilot

Copy the markdown content below between the START/END markers and create the file at the specified path. Then commit with the provided message.

**File path:** `/build-instructions/masterplan/[SECTION]/[filename].md`
```

**Rules:**
- Always exactly this wording
- File path MUST be absolute path starting with `/build-instructions/masterplan/`
- File path MUST end with `.md`
- Use bold for "File path:"

### 3. Content Start/End Markers

**Format:**
```
## CONTENT START

```markdown
[ACTUAL FILE CONTENT HERE]
```

## CONTENT END
```

**Rules:**
- Always use exactly these markers: `## CONTENT START` and `## CONTENT END`
- ALWAYS wrap content in triple backticks with `markdown` language identifier
- Content between markers MUST be complete (400-600 lines)
- NO placeholders like "TODO", "[Content here]", "..." allowed
- Content must be production-ready documentation

### 4. Commit Command Section

**Format:**
```
## Commit Command

```bash
git add /build-instructions/masterplan/[SECTION]/[filename].md
git commit -m "[Descriptive commit message]"
```
```

**Rules:**
- Always include full git add + git commit commands
- File path MUST match the path in Instructions section
- Commit message should describe what documentation was added
- Use present tense ("Add", not "Added")
- Keep commit message under 72 characters for title line
- Can add multi-line commit body if needed

### 5. Copy Markers

**Format:**
```
---

**COPY FROM HERE ↓**

[ENTIRE PROMPT CONTENT]

**COPY TO HERE ↑**

---
```

**Rules:**
- Always use horizontal rules (---) before and after
- Always use down arrow (↓) for start, up arrow (↑) for end
- These markers tell user exactly what to copy
- Everything between markers must be complete and ready to paste

---

## CONTENT GENERATION RULES

### Content Length Requirements

**Target:** 400-600 lines of actual markdown content per file

**Why:**
- 400 lines minimum ensures comprehensive coverage
- 600 lines maximum keeps files manageable and focused
- Total prompt (with headers/footers) should be 500-700 lines
- Stays well under Copilot's ~1,500 line limit

**If content would exceed 600 lines:**
- Split into multiple files (3a, 3b, 3c, etc.)
- Each file covers a distinct sub-topic
- Create separate prompts for each file

### Content Quality Standards

**MUST have:**
- ✅ Table of contents (for files >300 lines)
- ✅ Section headers (##, ###, ####)
- ✅ Code examples with syntax highlighting
- ✅ Explanatory text (not just lists)
- ✅ ASCII diagrams where helpful
- ✅ Tables for structured data
- ✅ Inline code with backticks
- ✅ Proper markdown formatting throughout

**MUST NOT have:**
- ❌ Placeholder text ("TODO", "TBD", "Coming soon")
- ❌ Incomplete sections ("... more content here")
- ❌ Broken markdown formatting
- ❌ Missing code block closures
- ❌ Undefined abbreviations (define on first use)
- ❌ Dead links or references to non-existent sections
- ❌ Copy-paste errors or duplicated sections

### Knowledge Base Reference

**Before generating content, Claude MUST:**

1. **Search project knowledge base** for relevant files
2. **Read the relevant files** using exact filenames from search results
3. **Extract key information** (schemas, interfaces, flows, decisions)
4. **Synthesize into documentation** (don't just copy-paste)

**Example process:**
```
User says: "continue" (implying next prompt)

Claude thinks:
- Next prompt is 3b: indexeddb-legacy.md
- Need to reference: storage-layer_breakdown.md, storage-layer_rollup.md
- Search knowledge base for "storage layer indexeddb dexie"
- Read relevant files
- Generate 400-600 lines documenting IndexedDB schema
- Embed in prompt with proper structure
```

**Knowledge base files to reference by section:**

| Section | Primary References |
|---------|-------------------|
| Database Schema | storage-layer_breakdown.md, storage-layer_rollup.md, Master_Plan |
| API Contracts | message-bus_breakdown.md, message-bus_rollup.md, background-service_breakdown.md |
| Recording Engine | recording-engine_breakdown.md, recording-engine_rollup.md, content-script-system_breakdown.md, locator-strategy_breakdown.md |
| Replay Engine | replay-engine_breakdown.md, replay-engine_rollup.md |
| Storage Layer | storage-layer_breakdown.md, storage-layer_rollup.md |
| Message Bus | message-bus_breakdown.md, message-bus_rollup.md, background-service_breakdown.md |
| UI Components | ui-components_breakdown.md, ui-components_rollup.md |
| Portal | Master_Plan (portal sections), csv-processing_breakdown.md |
| VDI Runner | test-orchestrator_breakdown.md, test-orchestrator_rollup.md, Master_Plan (VDI sections) |
| Deployment | build-pipeline-overview.md, environment-requirements.md |
| Testing | high-level-implementation.md |
| Implementation | All relevant breakdown/rollup files for the phase |

---

## SECTION-SPECIFIC RULES

### Database Schema Files (Prompts 3a-3d)

**Must include:**
- Complete SQL CREATE TABLE statements
- Column definitions with types and constraints
- Index definitions with rationale
- JSONB structure examples (pretty-printed JSON)
- Migration scripts
- Example queries with EXPLAIN output (if relevant)

**Example structure:**
```markdown
# [Table Name] Schema

## Table Definition
```sql
CREATE TABLE [name] (...);
```

## Column Descriptions
| Column | Type | Purpose |
|--------|------|---------|

## Indexes
```sql
CREATE INDEX ...;
```

## JSONB Structure
```json
{
  "field": "value"
}
```

## Example Queries
```sql
SELECT ...;
```
```

### API Contract Files (Prompts 4a-4d)

**Must include:**
- TypeScript interface definitions
- Request/response format examples
- Error response formats
- Example usage code
- Authentication requirements
- Rate limiting details

**Example structure:**
```markdown
# [API Name] Contract

## Interface Definition
```typescript
interface RequestPayload {
  // ...
}
```

## Request Format
```typescript
const response = await api.call({...});
```

## Response Format
```json
{
  "success": true,
  "data": {...}
}
```

## Error Handling
```typescript
try {
  // ...
} catch (error) {
  // ...
}
```
```

### Engine/Module Files (Prompts 5-9)

**Must include:**
- Module purpose and responsibilities
- Architecture diagram (ASCII)
- Core interfaces (TypeScript)
- Data flow diagrams
- Integration points with other modules
- Configuration options
- Example implementations

**Example structure:**
```markdown
# [Module Name]

## Purpose
[2-3 sentences]

## Architecture
```
[ASCII diagram]
```

## Core Interfaces
```typescript
interface IModule {
  // ...
}
```

## Data Flow
[Step-by-step flow with arrows]

## Integration Points
[Which modules this depends on/provides to]

## Configuration
```typescript
interface Config {
  // ...
}
```

## Example Usage
```typescript
const module = new Module(config);
await module.execute();
```
```

### Portal/UI Files (Prompts 10-11)

**Must include:**
- Component hierarchy
- React component examples (TypeScript + JSX)
- State management approach
- Props interfaces
- Event handlers
- Responsive design notes
- Accessibility considerations

**Example structure:**
```markdown
# [Component Name]

## Component Hierarchy
```
Parent
├── Child1
└── Child2
```

## Props Interface
```typescript
interface Props {
  // ...
}
```

## Component Implementation
```tsx
export function Component({ ...props }: Props) {
  // ...
}
```

## State Management
[Describe state approach]

## Responsive Behavior
[Mobile vs desktop]

## Accessibility
[ARIA labels, keyboard navigation]
```

### Deployment/Testing Files (Prompt 12)

**Must include:**
- Complete configuration files
- Step-by-step procedures
- Command examples
- Troubleshooting sections
- Environment variables
- CI/CD workflow definitions

**Example structure:**
```markdown
# [Deployment Platform] Configuration

## Prerequisites
- [Requirement 1]
- [Requirement 2]

## Configuration File
```yaml
[complete config]
```

## Deployment Steps
1. [Step 1]
2. [Step 2]

## Environment Variables
| Variable | Purpose | Example |
|----------|---------|---------|

## Troubleshooting
### Issue: [Problem]
**Solution:** [Fix]

## Verification
```bash
[verification commands]
```
```

---

## PROMPT SEQUENCING LOGIC

### When User Says "continue"

Claude MUST:

1. **Determine next prompt in sequence:**
   - Check PHASE_3_BUILD_PLAN_UPDATED.md for current position
   - Identify next prompt number/letter (e.g., if just completed 3a, next is 3b)

2. **Identify file to generate:**
   - Look up in Phase 3 plan what file corresponds to that prompt
   - Confirm target directory and filename

3. **Search knowledge base:**
   - Query for relevant breakdown/rollup files
   - Read those files to extract key information

4. **Generate complete prompt:**
   - Follow template structure exactly
   - Generate 400-600 lines of embedded content
   - Include all mandatory elements (title, instructions, markers, commit)

5. **Output prompt ready to copy:**
   - Present complete prompt between copy markers
   - User can immediately copy and paste to Copilot

### Example Sequence

**User:** "continue"

**Claude thinks:**
- Last completed: Prompt 3a (supabase-schema.md)
- Next: Prompt 3b (indexeddb-legacy.md)
- References: storage-layer_breakdown.md, storage-layer_rollup.md
- Target: /build-instructions/masterplan/02-database-schema/indexeddb-legacy.md
- Generate 400 lines documenting Dexie.js schema

**Claude outputs:**
```
---

**COPY FROM HERE ↓**

**PROMPT 3b: INDEXEDDB LEGACY SCHEMA**

[Complete prompt with 400-line embedded content]

**COPY TO HERE ↑**

---
```

---

## QUALITY CHECKLIST

Before outputting any prompt, Claude MUST verify:

- [ ] Section title in ALL CAPS with proper numbering
- [ ] Instructions section includes exact file path
- [ ] Content START/END markers present
- [ ] Content is 400-600 lines of actual markdown
- [ ] No placeholder text or TODOs
- [ ] Code blocks properly closed
- [ ] Tables properly formatted
- [ ] Commit command matches file path
- [ ] Copy markers (↓ and ↑) present
- [ ] Total prompt length 500-700 lines
- [ ] Content based on knowledge base files
- [ ] All sections complete and production-ready

**If any item fails:** Regenerate the prompt until all checks pass.

---

## ERROR HANDLING

### If Copilot Reports "Can't process this"

**Likely causes:**
1. Prompt exceeds 1,500 lines (split into smaller files)
2. Special characters at start (remove any /, \\ etc. before "COPY FROM HERE")
3. Malformed markdown (check code block closures)

**Fix:**
- Reduce content to 400-500 lines
- Verify no special characters in copy markers
- Validate markdown syntax

### If File Not Created

**Likely causes:**
1. File path incorrect (must be absolute path starting with /)
2. Directory doesn't exist (Copilot may need to create directory first)
3. Permission issues

**Fix:**
- Verify exact path in Instructions section
- Create parent directory in separate prompt if needed
- Check Copilot has write access

### If Commit Fails

**Likely causes:**
1. File path mismatch between add and actual file location
2. Git not initialized
3. Merge conflicts

**Fix:**
- Verify git add path matches file path exactly
- Check git status in repo
- Resolve any conflicts before committing

---

## EXAMPLES OF GOOD VS BAD PROMPTS

### ✅ GOOD PROMPT

```
---

**COPY FROM HERE ↓**

**PROMPT 3a: SUPABASE SCHEMA**

---

## Instructions for Copilot

Copy the markdown content below between the START/END markers and create the file at the specified path. Then commit with the provided message.

**File path:** `/build-instructions/masterplan/02-database-schema/supabase-schema.md`

---

## CONTENT START

```markdown
# Supabase Database Schema
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0

## Table of Contents
1. Overview
2. Table Definitions
3. Indexes
[... 520 more lines of complete content ...]
```

## CONTENT END

---

## Commit Command

```bash
git add /build-instructions/masterplan/02-database-schema/supabase-schema.md
git commit -m "Phase 3: Add Supabase database schema documentation"
```

---

**COPY TO HERE ↑**

---
```

### ❌ BAD PROMPT

```
Generate a file about database schema.

Create /build-instructions/masterplan/02-database-schema/supabase-schema.md

Content:
- Tables
- Indexes
- [Add more content here]
- TODO: Add examples

Commit when done.
```

**Why it's bad:**
- ❌ No section title in required format
- ❌ No copy markers
- ❌ No embedded content (just instructions for Copilot to generate)
- ❌ Has placeholder text "[Add more content here]"
- ❌ Has TODO items
- ❌ No START/END markers
- ❌ Incomplete commit command
- ❌ Copilot would have to generate content (not our approach)

---

## INTEGRATION WITH PHASE 3 PLAN

This meta-manual works in conjunction with PHASE_3_BUILD_PLAN_UPDATED.md:

**Phase 3 Plan defines:**
- WHAT prompts to generate (3a, 3b, 3c, etc.)
- WHAT files each prompt creates
- WHAT knowledge base files to reference
- WHAT sections each file should contain

**This Meta-Manual defines:**
- HOW to structure each prompt
- HOW to format the content
- HOW to ensure Copilot can process it
- HOW to maintain quality standards

**Together they enable:**
```
User: "continue"
  ↓
Claude reads Phase 3 Plan → Identifies next prompt (e.g., 3b)
  ↓
Claude reads Meta-Manual → Learns HOW to write that prompt
  ↓
Claude searches knowledge base → Gathers source material
  ↓
Claude generates complete prompt → Following all rules
  ↓
User copies to Copilot → Copilot commits file
  ↓
User: "continue"
  ↓
[Repeat for next prompt]
```

---

## UPDATES AND VERSIONING

**Current Version:** 2.0

**Version History:**
- **v1.0** (Nov 22, 2025): Initial approach (Copilot generates content) - Deprecated
- **v2.0** (Nov 22, 2025): New approach (Claude generates embedded content) - Current

**When to update this manual:**
- When prompt format needs to change
- When new quality requirements emerge
- When Copilot's processing limits change
- When new section types are added to Phase 3

**How to update:**
- Edit this file directly
- Add version history entry
- Upload updated version to Claude's knowledge base
- Regenerate any prompts using new rules

---

## SUMMARY

This meta-manual ensures every Smart Prompt Claude generates:

1. ✅ Has consistent structure (title, instructions, markers, commit)
2. ✅ Contains complete embedded content (400-600 lines)
3. ✅ Is ready to copy/paste with zero modifications
4. ✅ Works reliably with Copilot
5. ✅ Maintains high quality standards
6. ✅ References appropriate knowledge base files
7. ✅ Follows project-specific conventions

**Claude's workflow when user says "continue":**
1. Check Phase 3 plan for next prompt
2. Read this meta-manual for structure rules
3. Search/read knowledge base for content
4. Generate complete prompt following all rules
5. Output ready-to-copy prompt

This systematic approach ensures all 60+ Phase 3 prompts are consistent, high-quality, and work seamlessly with Copilot.
(for your resources to reference)
