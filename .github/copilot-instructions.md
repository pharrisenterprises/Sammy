# Copilot Custom Instructions for Sammy Project

## Overview

This is a Chrome Extension test automation recorder being refactored into modular architecture. Phase 4 involves 225 code generation prompts executed via Claude → Copilot workflow.

## Primary Reference Documents

**ALWAYS read these before executing any P4-XXX prompt:**

1. `/analysis-resources/PHASE_4_SPECIFICATIONS.md` - Interface definitions, message contracts, patterns
2. `/analysis-resources/implementation-guides/PHASE_4_CODE_GENERATION_MANUAL.md` - Prompt registry, execution order

## Code Generation Protocol

1. **DO NOT generate code** - Claude provides complete TypeScript code in prompts
2. **Copy code exactly** as provided between START/END markers
3. **Create files** at the exact paths specified
4. **Validate** against PHASE_4_SPECIFICATIONS.md before committing
5. **Run tests** before committing: `npm run test -- [file]`
6. **Use exact commit messages** provided in prompts

## Interface Quick Reference
```typescript
// Project.status - ONLY these 3 values
type ProjectStatus = 'draft' | 'testing' | 'complete';

// Step.event - ONLY these 4 values  
type StepEvent = 'click' | 'input' | 'enter' | 'open';

// TestRun.logs - string, NOT array
logs: string;  // Parse with split('\n')

// Field - snake_case properties
interface Field {
  field_name: string;
  mapped: boolean;
  inputvarfields: string;
}

// Message actions - lowercase snake_case
{ action: 'get_all_projects' }  // ✅ Correct
{ action: 'GET_ALL_PROJECTS' }  // ❌ Wrong
```

## Critical Patterns to Verify

1. **Async handlers:** Must have `return true` at end
2. **Stop control:** Must use `useRef`, not `useState`
3. **Input simulation:** Must use property descriptor bypass
4. **Auto-map threshold:** Must be `0.3`, not `0.8`

## Pre-Commit Checklist

Before committing ANY generated code:

- [ ] Interfaces match PHASE_4_SPECIFICATIONS.md
- [ ] Message actions are lowercase snake_case
- [ ] `return true` present in async handlers
- [ ] `useRef` used for isRunningRef
- [ ] Tests pass: `npm run test`
- [ ] Types pass: `npm run type-check`

## File Locations

- Specifications: `/analysis-resources/PHASE_4_SPECIFICATIONS.md`
- Phase 4 Manual: `/analysis-resources/implementation-guides/PHASE_4_CODE_GENERATION_MANUAL.md`
- Component Breakdowns: `/analysis-resources/component-breakdowns/`
- New code: `/src/core/` (created by Phase 4)
