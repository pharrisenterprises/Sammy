# STORAGE LAYER ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/storage-layer_breakdown.md` (300 lines)
- `modularization-plans/storage-layer_mod-plan.md` (empty - to be populated)
- `implementation-guides/storage-layer_impl.md` (empty - to be populated)

**Subsystem Purpose**: The Storage Layer provides persistent data management for projects, test runs, recorded steps, field mappings, and CSV data using IndexedDB (via Dexie.js). It abstracts storage complexity from UI components, enables offline operation, and handles large datasets without memory limits.

**Criticality**: ⭐⭐⭐⭐ (High - all user data flows through this layer)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Project CRUD**: Create, read, update, delete automation projects via Dexie tables
- **Test Run Management**: Store execution history (start/end times, passed/failed steps, logs)
- **Schema Definition**: Maintain IndexedDB schema with auto-increment keys and indexes
- **Message-Based Coordination**: Route all storage operations through background script to avoid context conflicts
- **Transaction Safety**: Ensure atomic operations (Dexie handles this internally)
- **Migration Support**: Handle schema upgrades via Dexie version system (currently v1)
- **Data Validation**: Background script validates payloads before passing to Dexie

### MUST NOT DO
- **Never access DB from content scripts**: Content scripts cannot use IndexedDB—must message background
- **Never block UI thread**: Use async/await for all DB operations (Dexie returns Promises)
- **Never store PII without encryption**: Currently stores URLs and data in plaintext (security concern)
- **Never mutate returned objects**: Dexie returns frozen objects in some cases—clone before modifying

---

## 3. Interfaces & Contracts (Compressed)

### Message Protocol (UI → Background)
```typescript
chrome.runtime.sendMessage({
  action: 'add_project' | 'update_project' | 'get_all_projects' | 
          'delete_project' | 'get_project_by_id' |
          'update_project_steps' | 'update_project_fields' | 
          'update_project_csv' | 'createTestRun' | 
          'updateTestRun' | 'getTestRunsByProject',
  payload: { /* operation-specific data */ }
}, (response) => {
  if (response.success) {
    // Handle success
  } else {
    // Handle error
  }
});
```

### Response Contract
```typescript
{
  success: boolean,       // Operation succeeded?
  data?: any,             // Query results (projects, test runs)
  error?: string,         // Error message if failed
  id?: number,            // Auto-generated ID for creates
  project?: Project       // Single project for get_project_by_id
}
```

### Data Schemas

#### Project Table
```typescript
interface Project {
  id?: number;              // Auto-increment PK
  name: string;             // Project name
  description: string;      // Optional description
  target_url: string;       // Starting URL for recording
  status: string;           // 'draft' | 'testing' | 'complete'
  created_date: number;     // Unix timestamp (milliseconds)
  updated_date: number;     // Unix timestamp (milliseconds)
  recorded_steps?: any[];   // Array of step objects (large!)
  parsed_fields?: any[];    // Field mapping configuration
  csv_data?: any[];         // Imported CSV rows (large!)
}

// Indexes: ++id, name, target_url, status, created_date, updated_date
```

#### TestRun Table
```typescript
interface TestRun {
  id?: number;              // Auto-increment PK
  project_id: number;       // Foreign key to Project
  status: string;           // 'pending' | 'running' | 'completed' | 'failed'
  start_time: string;       // ISO timestamp
  end_time?: string;        // ISO timestamp (optional)
  total_steps: number;      // Number of steps executed
  passed_steps: number;     // Successful steps
  failed_steps: number;     // Failed steps
  test_results: any[];      // Array of step results (large!)
  logs: string;             // Execution log text
}

// Indexes: ++id, project_id, status, start_time
```

### Dexie Operations (Internal)
- **Create**: `DB.projects.add(project)` returns Promise\<number\> (new ID)
- **Read**: `DB.projects.toArray()` or `DB.projects.get(id)`
- **Update**: `DB.projects.update(id, partialObject)` returns Promise\<number\> (affected count)
- **Delete**: `DB.projects.delete(id)` returns Promise\<void\>
- **Query**: `DB.testRuns.where('project_id').equals(pid).reverse().sortBy('start_time')`

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Storage Layer = Background Script**: Only background.ts has direct Dexie access
- **UI Components = Messaging Clients**: All UI pages send messages, never import Dexie
- **Content Scripts = Prohibited**: Cannot use IndexedDB due to Chrome extension architecture

### Layering Restrictions
- **Background is Single Entry Point**: All CRUD operations routed through `chrome.runtime.onMessage` listener
- **No Direct Imports**: UI pages must NOT import `indexedDB.ts` directly (causes context conflicts)

### Performance Constraints
- **Large Project Size**: Projects with 1000+ steps and 10,000+ CSV rows can reach 10MB+—IndexedDB handles this but queries slow down
- **No Pagination**: `get_all_projects` returns entire table—slow with 100+ projects
- **Synchronous UI Blocking**: UI components use `await chrome.runtime.sendMessage()`—blocks render during query

### Error Handling Rules
- **Dexie Errors Caught**: Background script wraps all DB operations in try-catch, returns `{success: false, error: message}`
- **No Retry Logic**: If DB operation fails, error is returned to caller—no automatic retry
- **Foreign Key Violations**: No enforcement—deleting project doesn't cascade delete test runs (manual cleanup required)

### Security Requirements
- **No Encryption**: Sensitive data (URLs, CSV values) stored in plaintext in IndexedDB
- **No Access Control**: Any extension page can read/write all data
- **No Audit Log**: No record of who changed what and when

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Partial Update Race Condition**: If UI calls `update_project_steps` while another component calls `update_project_fields`, last write wins—no merge logic.

2. **Concurrent Test Runs**: If two tabs run tests for same project simultaneously, test run records may interleave incorrectly (no locking).

3. **IndexedDB Quota Exceeded**: Chrome limits IndexedDB to ~60% of available disk space. Large CSV imports can hit quota—no warning or graceful degradation.

4. **Orphaned Test Runs**: Deleting a project doesn't delete associated test runs—creates dangling foreign keys.

5. **Schema Migration Failure**: If Dexie version bump fails (browser incompatibility), existing data may become inaccessible—no rollback.

### Common Pitfalls
- **Forgetting `await`**: `chrome.runtime.sendMessage` returns void synchronously—must wrap in Promise or use callback
- **Mutating Dexie Objects**: Some Dexie queries return frozen objects—direct mutation throws error in strict mode
- **Array Field Corruption**: If `recorded_steps` is set to non-array value (e.g., `null`, `undefined`), UI crashes on `.map()`—must default to `[]`

### Maintenance Traps
- **No Type Safety Across Message Boundary**: `payload: any` means typos in property names fail silently
- **No Validation Layer**: Background script assumes UI sends valid data—malformed payloads can corrupt DB
- **Magic Strings**: Action names like `"add_project"` are string literals—no enum or constants file

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/storage-layer_breakdown.md`
  - Dexie schema details (tables, indexes, version history)
  - Message action catalog (20+ actions documented)
  - Query patterns and performance considerations
  - Migration strategy for future schema changes

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/storage-layer_mod-plan.md` (to be populated)
  - Extract to separate service module with typed interfaces
  - Add repository pattern (ProjectRepository, TestRunRepository)
  - Implement data validation layer
  - Add pagination for large queries

### Implementation Guidelines
- **Implementation Guide**: `analysis-resources/implementation-guides/storage-layer_impl.md` (to be populated)
  - Best practices for IndexedDB usage in Chrome extensions
  - Message protocol design patterns
  - Error handling and retry strategies
  - Migration testing procedures

### Related Systems
- **Background Service**: Hosts the Dexie instance and message router
- **Dashboard**: Primary consumer (project list, search, stats)
- **Test Runner**: Reads projects, writes test run results
- **Field Mapper**: Reads/writes CSV data and field mappings
