# Storage Layer - Component Breakdown

## 1. Purpose

The Storage Layer is a Dexie.js-based IndexedDB wrapper providing persistent, offline-capable storage for test automation projects, recorded user actions, test execution results, and CSV test data, with all database operations coordinated through the background service worker message bus.

**Core Responsibilities:**
- Define Dexie schema with `projects` and `testRuns` tables indexed for efficient queries
- Expose CRUD operations (add, update, get, delete) for projects and test runs
- Ensure data persistence across browser restarts via IndexedDB
- Coordinate all storage access through background script to avoid race conditions from multiple content scripts/UI pages
- Plan future Supabase cloud sync for multi-device test execution

## 2. Inputs

- **Project Data:** { name, description, target_url, status, recorded_steps: Step[], csv_data: [][], parsed_fields: Field[] }
- **Test Run Data:** { project_id, status, start_time, end_time, passed_steps, failed_steps, test_results: Result[] }
- **Chrome Message Payloads:** { action: "add_project", payload: {...} } routed through background.ts
- **IndexedDB Browser API:** Underlying Dexie.js persistence mechanism

## 3. Outputs

- **Query Results:** Projects array, single project by ID, test runs by project_id via chrome.runtime.sendMessage response
- **Operation Confirmations:** { success: true, id: number } for add operations, { success: true } for updates/deletes
- **Error Messages:** { success: false, error: string } for constraint violations, query failures
- **Storage Quota Status:** navigator.storage.persisted() for persistent storage grant

## 4. Internal Architecture

**Primary Files:**
- `src/common/services/indexedDB.ts` (71 lines) - Dexie schema and wrapper class
- `src/background/background.ts` (lines 15-100) - Message bus handlers for DB operations

**Dexie Schema Definition:**
```typescript
// src/common/services/indexedDB.ts
export class ProjectDB extends Dexie {
  projects!: Dexie.Table<IProject, number>;
  testRuns!: Dexie.Table<ITestRun, number>;

  constructor() {
    super('SammyDB');
    this.version(1).stores({
      projects: '++id, name, status, target_url, created_date, updated_date',
      testRuns: '++id, project_id, status, start_time, end_time'
    });
  }
}

export const DB = new ProjectDB();
```

**Table Structures:**
- **projects:** Auto-increment ID, name (string), status (draft/recorded/tested), target_url (string), recorded_steps (Step[]), csv_data ([][]), parsed_fields (Field[]), created_date (ISO string), updated_date (ISO string)
- **testRuns:** Auto-increment ID, project_id (foreign key), status (pending/running/completed/failed), start_time (timestamp), end_time (timestamp), passed_steps (number), failed_steps (number), test_results (Result[])

**Background Message Handlers (15+ actions):**
- `add_project` → DB.addProject(newProject) → returns { success: true, id }
- `update_project` → DB.updateProject(id, data) → returns { success: true }
- `get_all_projects` → DB.getAllProjects() → returns { success: true, projects: [] }
- `get_project_by_id` → DB.projects.get(id) → returns { success: true, project: {...} }
- `delete_project` → DB.deleteProject(id) → returns { success: true }
- `update_project_steps` → DB.projects.update(id, { recorded_steps }) → handles recording saves
- `getTestRunsByProject` → DB.testRuns.where('project_id').equals(projectId).toArray()

**Coordination Pattern:**
1. UI page (Dashboard, Recorder, TestRunner) calls `chrome.runtime.sendMessage({ action: "add_project", payload })`
2. Background script `chrome.runtime.onMessage.addListener` receives message
3. Background extracts action and payload, calls DB method
4. Dexie operation executes (async Promise)
5. Background calls `sendResponse({ success: true, data })` within handler
6. Background returns `true` to keep async channel open (critical pattern)
7. UI page receives response in callback: `(response) => { if (response.success) ... }`

## 5. Critical Dependencies

- **Dexie.js 4.0.11:** IndexedDB wrapper library providing schema, queries, transactions
- **IndexedDB Browser API:** Underlying persistent storage (quota: 20% of available disk, ~50GB typical)
- **Chrome Extension Background Script:** All DB operations must route through background.ts to avoid multi-context races
- **navigator.storage.persist():** Request persistent storage grant to prevent quota eviction
- **JSON Serialization:** All stored data must be JSON-serializable (no functions, DOM nodes, circular refs)

**Breaking Changes Risk:**
- Dexie 4 → 5 migration may require schema version bump
- IndexedDB spec changes (unlikely, stable since 2015)
- Chrome Extension Manifest V3 service worker lifecycle (background script may terminate mid-operation)

## 6. Hidden Assumptions

- **Single IndexedDB Database:** All data in `SammyDB` database; no sharding or partitioning
- **Auto-Increment IDs Sufficient:** Assumes < 2^53 projects (JavaScript safe integer limit); no UUID/GUID support
- **No Foreign Key Enforcement:** testRuns.project_id not validated; orphaned test runs possible if project deleted
- **Background Script Always Available:** No queue or retry if background script dead during sendMessage
- **Synchronous Schema Migrations:** version(1).stores() called at initialization; no async migrations for large datasets
- **No Multi-Tab Locking:** Concurrent updates from multiple extension pages may cause race conditions (Dexie handles IndexedDB locks, but app logic doesn't coordinate)
- **JSON-Serializable Data Only:** Assumes recorded_steps, csv_data don't contain non-serializable objects
- **No Storage Quota Management:** No monitoring of IndexedDB quota; may fail silently if quota exceeded

## 7. Stability Concerns

- **Message Bus Single Point of Failure:** If background script crashes, all DB operations fail; no local cache or fallback
- **No Transaction Boundaries:** update_project_steps sends individual messages per step; no atomic multi-step updates
- **Orphaned Data:** Deleting project doesn't cascade delete associated testRuns (foreign key not enforced)
- **Race Conditions:** Multiple tabs calling update_project simultaneously may overwrite each other's changes
- **Service Worker Lifecycle:** Manifest V3 background script terminates after 30s inactivity; mid-operation termination may corrupt IndexedDB
- **No Schema Versioning Strategy:** version(1) hardcoded; adding new fields requires version(2).stores() and migration logic
- **Large Data Blobs:** Storing 10,000-step recordings or 100MB CSV files in single IndexedDB row may hit browser limits

## 8. Edge Cases

- **Storage Quota Exceeded:** projects.add() may throw QuotaExceededError if IndexedDB quota (50GB) filled; no graceful handling
- **Persistent Storage Denied:** navigator.storage.persist() may return false (user setting); data subject to eviction under storage pressure
- **Background Script Restart:** Mid-operation termination may leave DB in inconsistent state (e.g., project added but not returned to UI)
- **Concurrent Writes:** Tab A updates project.name while Tab B updates project.recorded_steps; last write wins (potential data loss)
- **Orphaned Test Runs:** Deleting project ID 5 leaves testRuns with project_id=5 dangling; getTestRunsByProject(5) returns orphaned runs
- **Invalid Foreign Keys:** Manually setting project_id=999 in testRun when no project 999 exists; no validation
- **JSON Parse Errors:** Storing { recorded_steps: [circularRef] } may succeed but fail on retrieval (Dexie.toArray() throws)
- **Large Array Updates:** Updating 10,000-element recorded_steps array may block UI thread during JSON serialization
- **IndexedDB Corruption:** Browser crash during write may corrupt database; no backup/restore mechanism
- **Cross-Origin Isolation:** If extension runs in isolated context, IndexedDB may not persist (rare edge case)

## 9. Developer-Must-Know Notes

### All DB Operations Must Go Through Background Script
- Never instantiate Dexie in content scripts or UI pages directly (leads to race conditions)
- Always use chrome.runtime.sendMessage({ action: "..." }) pattern
- Background script is single source of truth for DB access

### Return True in Message Handlers
- Critical pattern: `chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { ... sendResponse(result); return true; })`
- `return true` keeps async channel open; forgetting it causes sendResponse to fail silently
- Symptom: UI callback never fires, no error message (hardest bug to debug)

### IndexedDB Has ~50GB Quota
- Quota is 20% of available disk space (Chrome heuristic)
- 10,000-step project with 200-char XPaths per step ≈ 2MB per project
- Theoretical capacity: 25,000 projects before quota limits
- Recommend archiving old projects to cloud storage (Supabase planned)

### Schema Migrations Require Version Bumps
- Adding field `project.tags` requires:
  ```typescript
  this.version(2).stores({
    projects: '++id, name, status, target_url, tags, created_date, updated_date'
  }).upgrade(tx => {
    return tx.table('projects').toCollection().modify(project => {
      project.tags = [];
    });
  });
  ```
- Forgetting upgrade() leaves existing projects without `tags` field (undefined)

### Foreign Keys Not Enforced
- Dexie doesn't support SQL-style foreign keys
- Must manually cascade deletes:
  ```typescript
  async deleteProject(id) {
    await DB.testRuns.where('project_id').equals(id).delete();
    await DB.projects.delete(id);
  }
  ```

### Concurrent Updates Need Locking
- Use Dexie transactions for atomic multi-step operations:
  ```typescript
  await DB.transaction('rw', DB.projects, DB.testRuns, async () => {
    const project = await DB.projects.get(id);
    project.status = 'tested';
    await DB.projects.put(project);
    await DB.testRuns.add({ project_id: id, status: 'completed' });
  });
  ```

### Service Worker May Terminate Mid-Operation
- Manifest V3 service workers stop after 30s inactivity
- Long-running operations (e.g., 500-step recording save) may fail
- Use chrome.alarms API to keep background alive or implement retry logic

### Supabase Sync Requires Conflict Resolution
- Future cloud sync must handle:
  - Offline edits synced when online
  - Multi-device concurrent edits (CRDT or last-write-wins)
  - Schema version mismatches between devices
- Recommend using Supabase Realtime subscriptions for live sync

### Testing Requires IndexedDB Mocking
- Unit tests cannot use real IndexedDB (test runner doesn't provide)
- Use fake-indexeddb npm package or mock Dexie methods
- Integration tests in real Chrome extension context recommended
