# IndexedDB Legacy Schema
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Legacy Reference (Phase 1 Migration Context)

## Table of Contents
1. Overview
2. Why IndexedDB Was Used
3. Dexie.js Wrapper Benefits
4. Schema Definition
5. Table Structures
6. Index Configurations
7. Migration History
8. Query Patterns
9. Limitations Encountered
10. Migration to Supabase Rationale

---

## 1. Overview

### 1.1 Purpose of This Document

This document serves as a **historical reference** for the IndexedDB schema used in the original `patricks-automation` codebase. It explains:

- Why IndexedDB was chosen initially
- How Dexie.js simplified IndexedDB operations
- The complete schema definition
- Migration versions and schema evolution
- Limitations that led to Supabase migration

**Note:** This schema is being **replaced by Supabase** in Phase 1 of the rebuild. However, understanding the legacy structure is critical for:
- Data migration from IndexedDB to Supabase
- Supporting users with existing local data
- Maintaining backward compatibility during transition

### 1.2 IndexedDB in Chrome Extensions

**What is IndexedDB?**
- Browser-native NoSQL database
- Key-value store with indexes
- Transactional and ACID-compliant
- No size limit (subject to browser quota, typically 50% of available disk space)
- Asynchronous API (callback-based or Promise-based with wrappers)

**Why Used in Extensions?**
- ✅ Local-first architecture (works offline)
- ✅ No backend required (reduces infrastructure costs)
- ✅ Fast read/write operations
- ✅ Privacy-friendly (data never leaves user's device by default)
- ✅ No authentication required

---

## 2. Why IndexedDB Was Used

### 2.1 Original Requirements

**patricks-automation** was built with these priorities:

1. **Offline-first:** Extension must work without internet connection
2. **No user accounts:** Reduce friction, no sign-up required
3. **Fast local storage:** Instant access to recordings without network latency
4. **Privacy:** User data stays on their device unless they opt-in to cloud sync
5. **Simple deployment:** No backend infrastructure to maintain

### 2.2 IndexedDB vs Alternatives

| Storage Option | Capacity | Complexity | Offline | Privacy | Verdict |
|----------------|----------|------------|---------|---------|---------|
| localStorage | 5-10MB | Low | ✅ | ✅ | ❌ Too small |
| chrome.storage.local | 10MB | Low | ✅ | ✅ | ❌ Size limit |
| IndexedDB | ~50GB+ | Medium | ✅ | ✅ | ✅ Chosen |
| Remote DB (MySQL) | Unlimited | High | ❌ | ❌ | ❌ Requires backend |
| Firebase | Unlimited | Medium | ⚠️ | ⚠️ | ⚠️ Optional (Phase 2) |

**Decision:** IndexedDB was the only option that met all requirements for Phase 1.

---

## 3. Dexie.js Wrapper Benefits

### 3.1 Raw IndexedDB API Problems

**Native IndexedDB is notoriously difficult:**

```javascript
// ❌ Raw IndexedDB: Verbose and error-prone
const request = indexedDB.open('TestRecorderDB', 1);

request.onerror = (event) => {
  console.error('Database error:', event.target.errorCode);
};

request.onsuccess = (event) => {
  const db = event.target.result;
  const transaction = db.transaction(['projects'], 'readwrite');
  const objectStore = transaction.objectStore('projects');
  const addRequest = objectStore.add({ name: 'My Project' });
  
  addRequest.onsuccess = () => {
    console.log('Project added');
  };
  
  addRequest.onerror = () => {
    console.error('Add error');
  };
};

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const objectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
  objectStore.createIndex('name', 'name', { unique: false });
};
```

### 3.2 Dexie.js Simplification

**Dexie.js provides:**
- Promise-based API (async/await support)
- Declarative schema definition
- Automatic version management
- Collection-based queries (similar to MongoDB)
- Only 20KB gzipped

```javascript
// ✅ Dexie.js: Clean and intuitive
import Dexie from 'dexie';

const db = new Dexie('TestRecorderDB');

db.version(1).stores({
  projects: '++id, name, status, created_date'
});

// Add project
await db.projects.add({ name: 'My Project', status: 'draft' });

// Query projects
const projects = await db.projects.where('status').equals('ready').toArray();
```

**Why Dexie was chosen:**
- ✅ Reduces IndexedDB boilerplate by ~80%
- ✅ Promise-based (works with async/await)
- ✅ Declarative schema migrations
- ✅ Better error handling
- ✅ Active maintenance and community support
- ✅ TypeScript types included

---

## 4. Schema Definition

### 4.1 Dexie Schema Declaration

**File:** `src/services/indexedDBService.ts` (legacy)

```typescript
import Dexie, { Table } from 'dexie';

// TypeScript Interfaces
interface Project {
  id?: number;
  name: string;
  description?: string;
  target_url: string;
  status: 'draft' | 'testing' | 'complete';
  created_date: number;
  updated_date: number;
  recorded_steps?: RecordedStep[];
  parsed_fields?: ParsedField[];
  csv_data?: CsvRow[];
}

interface TestRun {
  id?: number;
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time: number;
  end_time?: number;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  test_results?: TestResult[];
  logs?: string[];
}

interface TestResult {
  id?: number;
  test_run_id: number;
  step_number: number;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  error_message?: string;
  screenshot_url?: string;
}

// Dexie Database Class
class TestRecorderDB extends Dexie {
  projects!: Table<Project>;
  testRuns!: Table<TestRun>;
  testResults!: Table<TestResult>;

  constructor() {
    super('TestRecorderDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      projects: '++id, name, status, created_date',
      testRuns: '++id, project_id, status, start_time',
      testResults: '++id, test_run_id, step_number, status'
    });
  }
}

export const db = new TestRecorderDB();
```

### 4.2 Schema Syntax Explanation

**Dexie Store Declaration Format:**

```
'primaryKey, index1, index2, index3, ...'
```

**Key Prefixes:**
- `++` - Auto-incrementing integer primary key
- `&` - Unique index
- `*` - Multi-entry index (for arrays)
- (none) - Regular index

**Examples:**

```javascript
// Auto-increment ID + indexed columns
'++id, name, status, created_date'

// Composite index (not supported directly, use compound syntax)
'++id, [project_id+status], created_date'

// Unique constraint
'++id, &email, name'

// Multi-entry (for array fields)
'++id, *tags, name'
```

---

## 5. Table Structures

### 5.1 projects Table

**Purpose:** Store recorded workflows and associated data

**Schema:**

```javascript
this.version(1).stores({
  projects: '++id, name, status, created_date'
});
```

**Columns:**

| Column | Type | Description | Indexed |
|--------|------|-------------|---------|
| id | number | Auto-increment primary key | Yes (PK) |
| name | string | User-defined project name | Yes |
| description | string | Optional description | No |
| target_url | string | Starting URL for recording | No |
| status | string | draft / testing / complete | Yes |
| created_date | number | Unix timestamp (ms) | Yes |
| updated_date | number | Unix timestamp (ms) | No |
| recorded_steps | array | Array of step objects | No |
| parsed_fields | array | Extracted form fields | No |
| csv_data | array | Uploaded CSV rows | No |

**Example Record:**

```json
{
  "id": 1,
  "name": "Login Flow",
  "description": "Test login with multiple users",
  "target_url": "https://example.com/login",
  "status": "complete",
  "created_date": 1700145000000,
  "updated_date": 1700145500000,
  "recorded_steps": [
    {
      "stepNumber": 1,
      "event": "type",
      "selector": "input#email",
      "value": "test@example.com",
      "label": "Email Address"
    },
    {
      "stepNumber": 2,
      "event": "click",
      "selector": "button#submit",
      "label": "Submit Button"
    }
  ],
  "parsed_fields": [
    {
      "field_name": "email",
      "mapped": true,
      "inputvarfields": "Email Address"
    }
  ],
  "csv_data": [
    {"email": "john@example.com", "password": "pass123"},
    {"email": "jane@example.com", "password": "pass456"}
  ]
}
```

### 5.2 testRuns Table

**Purpose:** Track test execution history

**Schema:**

```javascript
this.version(1).stores({
  testRuns: '++id, project_id, status, start_time'
});
```

**Columns:**

| Column | Type | Description | Indexed |
|--------|------|-------------|---------|
| id | number | Auto-increment primary key | Yes (PK) |
| project_id | number | Foreign key to projects.id | Yes |
| status | string | pending / running / completed / failed | Yes |
| start_time | number | Unix timestamp (ms) | Yes |
| end_time | number | Unix timestamp (ms) | No |
| total_steps | number | Total steps in test | No |
| passed_steps | number | Count of successful steps | No |
| failed_steps | number | Count of failed steps | No |
| test_results | array | Detailed results per step | No |
| logs | array | Execution log messages | No |

**Example Record:**

```json
{
  "id": 1,
  "project_id": 1,
  "status": "completed",
  "start_time": 1700146000000,
  "end_time": 1700146120000,
  "total_steps": 5,
  "passed_steps": 4,
  "failed_steps": 1,
  "test_results": [
    {
      "step_number": 1,
      "status": "success",
      "duration": 234
    },
    {
      "step_number": 2,
      "status": "failed",
      "duration": 5000,
      "error_message": "Element not found"
    }
  ],
  "logs": [
    "Starting test run...",
    "Step 1: Element found using XPath",
    "Step 2: Element not found after 5000ms"
  ]
}
```

### 5.3 testResults Table

**Purpose:** Per-step execution results (normalized for querying)

**Schema:**

```javascript
this.version(1).stores({
  testResults: '++id, test_run_id, step_number, status'
});
```

**Columns:**

| Column | Type | Description | Indexed |
|--------|------|-------------|---------|
| id | number | Auto-increment primary key | Yes (PK) |
| test_run_id | number | Foreign key to testRuns.id | Yes |
| step_number | number | Step index (1-based) | Yes |
| status | string | success / failed / skipped | Yes |
| duration | number | Execution time (ms) | No |
| error_message | string | Error details if failed | No |
| screenshot_url | string | Screenshot URL if captured | No |

**Example Record:**

```json
{
  "id": 1,
  "test_run_id": 1,
  "step_number": 2,
  "status": "failed",
  "duration": 5000,
  "error_message": "Timeout: Element 'button#submit' not found after 5000ms",
  "screenshot_url": "blob:chrome-extension://abc123/screenshot.png"
}
```

---

## 6. Index Configurations

### 6.1 Primary Key Indexes

**Auto-increment primary keys:**

```javascript
'++id' // Automatically creates unique, auto-incrementing index
```

**Benefits:**
- ✅ Automatic ID assignment
- ✅ Guaranteed uniqueness
- ✅ Fast lookups by ID
- ✅ Sortable (chronological order)

### 6.2 Secondary Indexes

**projects table:**

```javascript
'++id, name, status, created_date'
```

**Enables queries:**

```javascript
// Find by name
await db.projects.where('name').equals('Login Flow').first();

// Find by status
await db.projects.where('status').equals('complete').toArray();

// Sort by creation date
await db.projects.orderBy('created_date').reverse().toArray();
```

**testRuns table:**

```javascript
'++id, project_id, status, start_time'
```

**Enables queries:**

```javascript
// Find all runs for a project
await db.testRuns.where('project_id').equals(1).toArray();

// Find running tests
await db.testRuns.where('status').equals('running').toArray();

// Sort by start time
await db.testRuns.orderBy('start_time').reverse().toArray();
```

### 6.3 Compound Indexes (Workaround)

**Dexie doesn't support true compound indexes, but you can:**

```javascript
// Option 1: Query with filter
const results = await db.testRuns
  .where('project_id').equals(1)
  .filter(run => run.status === 'completed')
  .toArray();

// Option 2: Create computed index field
this.version(2).stores({
  testRuns: '++id, project_id, status, start_time, [project_id+status]'
});

// Then query compound index
await db.testRuns.where('[project_id+status]').equals([1, 'completed']).toArray();
```

---

## 7. Migration History

### 7.1 Version 1 (Initial Schema)

```javascript
db.version(1).stores({
  projects: '++id, name, status, created_date',
  testRuns: '++id, project_id, status, start_time',
  testResults: '++id, test_run_id, step_number, status'
});
```

**Changes:**
- Initial schema creation
- Three core tables defined
- Basic indexes on commonly queried fields

### 7.2 Version 2 (Add CSV Support)

```javascript
db.version(2).stores({
  projects: '++id, name, status, created_date, updated_date',
  testRuns: '++id, project_id, status, start_time',
  testResults: '++id, test_run_id, step_number, status'
}).upgrade(async tx => {
  // Add default values for existing projects
  const projects = await tx.table('projects').toArray();
  await Promise.all(
    projects.map(project => 
      tx.table('projects').update(project.id, {
        updated_date: project.created_date,
        csv_data: [],
        parsed_fields: []
      })
    )
  );
});
```

**Changes:**
- Added `updated_date` index to projects
- Added `csv_data` and `parsed_fields` columns (not indexed)
- Upgrade function backfills existing records

### 7.3 Version 3 (Performance Optimization)

```javascript
db.version(3).stores({
  projects: '++id, name, status, created_date, updated_date',
  testRuns: '++id, project_id, status, start_time, end_time',
  testResults: '++id, test_run_id, step_number, status'
});
```

**Changes:**
- Added `end_time` index to testRuns for completed test queries
- No data migration needed (column already existed)

---

## 8. Query Patterns

### 8.1 CRUD Operations

**Create:**

```javascript
// Add new project
const id = await db.projects.add({
  name: 'New Project',
  target_url: 'https://example.com',
  status: 'draft',
  created_date: Date.now(),
  updated_date: Date.now(),
  recorded_steps: []
});
```

**Read:**

```javascript
// Get by ID
const project = await db.projects.get(1);

// Get all
const allProjects = await db.projects.toArray();

// Get with filter
const readyProjects = await db.projects
  .where('status')
  .equals('ready')
  .toArray();
```

**Update:**

```javascript
// Update specific fields
await db.projects.update(1, {
  name: 'Updated Name',
  updated_date: Date.now()
});

// Update with function
await db.projects.update(1, (project) => {
  project.recorded_steps.push(newStep);
  project.updated_date = Date.now();
});
```

**Delete:**

```javascript
// Delete by ID
await db.projects.delete(1);

// Delete with condition
await db.projects
  .where('status')
  .equals('archived')
  .delete();
```

### 8.2 Advanced Queries

**Sorting:**

```javascript
// Sort by created date (descending)
const projects = await db.projects
  .orderBy('created_date')
  .reverse()
  .toArray();
```

**Pagination:**

```javascript
// Get 10 projects, skip first 20
const projects = await db.projects
  .orderBy('created_date')
  .reverse()
  .offset(20)
  .limit(10)
  .toArray();
```

**Counting:**

```javascript
// Count all projects
const total = await db.projects.count();

// Count by status
const completeCount = await db.projects
  .where('status')
  .equals('complete')
  .count();
```

**Multi-condition Queries:**

```javascript
// Dexie doesn't support multi-index queries efficiently
// Use filter after initial query
const results = await db.projects
  .where('status')
  .equals('ready')
  .filter(p => p.created_date > Date.now() - 86400000) // Last 24 hours
  .toArray();
```

### 8.3 Transactions

```javascript
// Atomic operation across tables
await db.transaction('rw', db.projects, db.testRuns, async () => {
  // Create project
  const projectId = await db.projects.add({
    name: 'New Project',
    status: 'draft',
    created_date: Date.now()
  });
  
  // Create test run for that project
  await db.testRuns.add({
    project_id: projectId,
    status: 'pending',
    start_time: Date.now()
  });
});
```

---

## 9. Limitations Encountered

### 9.1 No Cross-Device Sync

**Problem:** IndexedDB is local to the browser. Users cannot access recordings on other devices.

**Impact:**
- Users lose data if browser cache cleared
- No collaboration features possible
- No backup or recovery

**Workaround:** Manual export/import as JSON files

### 9.2 No Full-Text Search

**Problem:** Dexie/IndexedDB doesn't support full-text search on strings.

**Impact:**
- Searching project names requires exact match or prefix match
- Cannot search within step labels or descriptions efficiently

**Workaround:**

```javascript
// Client-side filtering (slow for large datasets)
const results = await db.projects.toArray();
const filtered = results.filter(p => 
  p.name.toLowerCase().includes(query.toLowerCase())
);
```

### 9.3 Limited Query Capabilities

**Problem:** No SQL-like joins or complex queries.

**Impact:**
- Cannot efficiently query across tables
- Manual joins required in JavaScript
- Performance degrades with large datasets

**Example:**

```javascript
// ❌ Not possible: SELECT * FROM projects WHERE id IN (SELECT project_id FROM testRuns WHERE status = 'running')

// ✅ Workaround: Multiple queries + filter
const runningTests = await db.testRuns
  .where('status')
  .equals('running')
  .toArray();

const projectIds = [...new Set(runningTests.map(t => t.project_id))];

const projects = await Promise.all(
  projectIds.map(id => db.projects.get(id))
);
```

### 9.4 No Row-Level Permissions

**Problem:** All data accessible to anyone with browser access.

**Impact:**
- Cannot share recordings securely
- No team collaboration
- No audit trail

### 9.5 Storage Quota Limitations

**Problem:** Browser may throttle or clear IndexedDB if disk space low.

**Impact:**
- Users can lose data unexpectedly
- No warning before data loss
- Varies by browser and OS

**Typical Quotas:**
- **Chrome:** ~50% of available disk space (temporary storage)
- **Firefox:** ~50% of available disk space
- **Safari:** ~1GB

### 9.6 No Real-Time Updates

**Problem:** Changes in one tab don't reflect in other tabs automatically.

**Impact:**
- User opens extension in multiple tabs → inconsistent state
- No live collaboration

**Workaround:** Broadcast channel or storage events (complex)

---

## 10. Migration to Supabase Rationale

### 10.1 Why Move to Supabase

**Supabase Advantages:**

- **Cloud Sync:** Access recordings from any device
- **Full-Text Search:** PostgreSQL native search
- **SQL Queries:** Complex joins, aggregations, window functions
- **Real-Time Updates:** WebSocket subscriptions for live updates
- **Row-Level Security:** Built-in multi-tenancy and permissions
- **Backup & Recovery:** Automated daily backups
- **Team Collaboration:** Share recordings with team members
- **Scalability:** Handles millions of rows without browser limits

### 10.2 Migration Strategy

**Phase 1: Dual Storage:**
- Keep IndexedDB for offline-first
- Sync to Supabase when online
- Supabase becomes source of truth

**Phase 2: Gradual Migration:**
- Detect existing IndexedDB data on first load
- Offer one-click migration to Supabase
- Keep IndexedDB as fallback for offline

**Phase 3: Deprecate IndexedDB:**
- After 6 months, assume all users migrated
- Remove IndexedDB code
- Pure Supabase with offline cache

### 10.3 Data Transformation

**projects → recordings:**

```javascript
// IndexedDB format
{
  id: 1,
  name: 'Login Flow',
  status: 'complete',
  created_date: 1700145000000,
  recorded_steps: [...]
}

// Supabase format
{
  id: uuid(),
  user_id: auth.uid(),
  name: 'Login Flow',
  status: 'ready',
  created_at: '2024-11-16T12:30:00Z',
  steps: [...] // JSONB
}
```

**Mapping:**
- `id` → Generate new UUID
- `created_date` → Convert to ISO timestamp
- `status` → Rename values (`complete` → `ready`)
- Add `user_id` from Supabase Auth
- Rename `recorded_steps` → `steps`

---

## Summary

This IndexedDB schema served as the foundation for **patricks-automation** with:

**✅ Strengths:**
- Offline-first architecture
- No backend complexity
- Fast local operations
- Privacy-friendly

**❌ Limitations:**
- No cross-device sync
- No full-text search
- Limited query capabilities
- No collaboration features
- Storage quota concerns

**Migration to Supabase** addresses all limitations while maintaining offline support through strategic caching. The legacy schema provides the blueprint for data transformation during migration.
