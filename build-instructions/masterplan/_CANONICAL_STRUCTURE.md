# Masterplan Canonical Directory Structure

**Purpose:** Define authoritative directory structure for Phase 3 documentation.  
**Created:** November 27, 2025  
**Reason:** Multiple duplicate directories existed; this file clarifies canonical locations.

---

## Canonical Structure (16 directories)

| Number | Directory | Purpose |
|--------|-----------|---------|
| 01 | overview/ | Project summary, architecture, tech stack |
| 02 | database-schema/ | Supabase, IndexedDB, data models |
| 03 | api-contracts/ | Message bus, storage, external APIs |
| 04 | recording-engine/ | Event capture, label detection, bundle format |
| 05 | replay-engine/ | Element finding, action execution, error recovery |
| 06 | storage-layer/ | Dexie schema, Supabase integration, sync |
| 07 | message-bus/ | Chrome messaging, action handlers |
| 08 | ui-components/ | Dashboard, recorder, mapper, runner components |
| 09 | content-script/ | Dual-mode coordinator, iframe, shadow DOM |
| 10 | background-service/ | Service worker, tab management, injection |
| 11 | test-orchestrator/ | CSV processing, execution loop, results |
| 12 | locator-strategy/ | XPath generation, fallback strategies, healing |
| 13 | portal/ | Web portal pages (dashboard, recording detail, etc.) |
| 14 | vdi-runner/ | Job poller, Playwright executor, AI healing |
| 15 | deployment/ | Fly.io, Supabase setup, CI/CD |
| 16 | testing/ | Unit, integration, E2E testing |

---

## Deprecated Directories (may exist but should not be used)

- **04-extension/** → Use **04-recording-engine/**
- **07-test-orchestrator/** → Use **11-test-orchestrator/**
- **08-portal-vdi/** → Split into **13-portal/** and **14-vdi-runner/**
- **09-portal/** → Use **13-portal/**
- **09-deployment/** → Use **15-deployment/**
- **10-vdi-runner/** → Use **14-vdi-runner/**
- **11-ui-components/** → Use **08-ui-components/**

---

## Notes

**Phase 4 code generation writes to `src/core/`, NOT to masterplan directories.**  
Masterplan directories are for Phase 3 documentation only.

**If duplicate directories exist:**
- Only use canonical numbered directories listed above
- Deprecated directories may contain .gitkeep files only
- New documentation should always go in canonical locations

---

## Directory Contents Summary

### 01-overview/
Project summary, architectural decisions, glossary, constraints, success metrics

### 02-database-schema/
Dexie.js schema, Supabase tables, migrations, field definitions

### 03-api-contracts/
Message bus actions, storage API, recording/replay interfaces, external APIs

### 04-recording-engine/
Event capture logic, 12+ label detection strategies, bundle generation, element targeting

### 05-replay-engine/
9-tier element resolution, action execution (click/input/enter), React-safe patterns

### 06-storage-layer/
IndexedDB via Dexie, Supabase PostgreSQL, sync strategies, caching

### 07-message-bus/
chrome.runtime.sendMessage, background handlers, error recovery, return true pattern

### 08-ui-components/
Dashboard (project CRUD), Recorder (steps table), TestRunner (orchestration), Mapper (CSV)

### 09-content-script/
Dual-mode coordinator, iframe handling, shadow DOM support, page-interceptor

### 10-background-service/
Service worker lifecycle, tab management, script injection, keepalive mechanisms

### 11-test-orchestrator/
CSV parsing, auto-mapping, execution loop, progress tracking, result aggregation

### 12-locator-strategy/
LocatorBundle contract, XPath generation, confidence scoring, self-healing

### 13-portal/
Web portal for managing tests, viewing results, team collaboration

### 14-vdi-runner/
Job polling, Playwright execution, AI-based element healing, result reporting

### 15-deployment/
Fly.io configuration, Supabase setup, CI/CD pipelines, environment management

### 16-testing/
Unit tests (Vitest), integration tests, E2E tests (Playwright), test strategies

---

**End of Canonical Structure Documentation**
