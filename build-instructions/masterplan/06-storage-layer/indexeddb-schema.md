# IndexedDB Schema Specification
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Database Configuration
3. Projects Table
4. TestRuns Table
5. Index Definitions
6. JSONB Field Structures
7. Schema Version History
8. Migration Scripts
9. Query Optimization
10. Storage Quotas
11. Backup and Recovery
12. Testing Utilities

---

## 1. Overview

### 1.1 Purpose

This document defines the complete IndexedDB schema used by the Chrome Extension Test Recorder. It specifies table structures, indexes, JSONB field formats, and migration strategies.

### 1.2 Database Identity

```typescript
const DATABASE_NAME = 'ProjectDatabase';
const CURRENT_VERSION = 1;
```

### 1.3 Schema Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INDEXEDDB SCHEMA                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Database: ProjectDatabase                                              │
│  Version: 1                                                             │
│  Engine: IndexedDB (via Dexie.js 4.0.11)                               │
│                                                                         │
│  Tables:                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  projects (Primary entity)                                      │    │
│  │  - 10 columns                                                   │    │
│  │  - 6 indexes                                                    │    │
│  │  - 3 JSONB array fields                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  testRuns (Child entity)                                        │    │
│  │  - 10 columns                                                   │    │
│  │  - 4 indexes                                                    │    │
│  │  - 2 JSONB array fields                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Configuration

### 2.1 Dexie Initialization

```typescript
import Dexie, { Table } from 'dexie';

class ProjectDB extends Dexie {
  // Typed table declarations
  public projects!: Table<Project, number>;
  public testRuns!: Table<TestRun, number>;
  
  constructor() {
    super('ProjectDatabase');
    
    // Schema definition
    this.version(1).stores({
      projects: '++id, name, target_url, status, created_date, updated_date',
      testRuns: '++id, project_id, status, start_time'
    });
  }
}

// Singleton instance
export const DB = new ProjectDB();
```

### 2.2 Dexie Schema Syntax Reference

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DEXIE SCHEMA SYNTAX                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Symbol  │ Meaning                                                      │
│  ────────┼─────────────────────────────────────────────────────────     │
│  ++      │ Auto-increment primary key                                   │
│  &       │ Unique index                                                 │
│  *       │ Multi-valued index (for arrays)                              │
│  [a+b]   │ Compound index on fields a and b                             │
│  (none)  │ Regular index                                                │
│                                                                         │
│  Examples:                                                              │
│  '++id'                    → Auto-increment PK named 'id'               │
│  '++id, name'              → Auto PK + indexed 'name' field             │
│  '++id, &email'            → Auto PK + unique 'email' index             │
│  '++id, *tags'             → Auto PK + multi-value 'tags' index         │
│  '++id, [firstName+lastName]' → Compound index                          │
│                                                                         │
│  Note: Non-indexed fields are still stored, just not queryable          │
│  via where() clause (must use filter() instead)                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Browser Storage Location

```
Chrome Profile Directory/
├── Default/
│   └── IndexedDB/
│       └── chrome-extension_[extension-id]_0.indexeddb.leveldb/
│           ├── 000003.log
│           ├── CURRENT
│           ├── LOCK
│           ├── LOG
│           └── MANIFEST-000001
```

---

## 3. Projects Table

### 3.1 Table Definition

```typescript
interface Project {
  // ============ PRIMARY KEY ============
  id?: number;  // Auto-increment, assigned on create
  
  // ============ CORE FIELDS ============
  name: string;          // Project display name (required)
  description: string;   // Optional description
  target_url: string;    // Starting URL for recording
  
  // ============ STATUS ============
  status: ProjectStatus; // Current state
  
  // ============ TIMESTAMPS ============
  created_date: number;  // Unix timestamp (ms)
  updated_date: number;  // Unix timestamp (ms)
  
  // ============ JSONB ARRAYS ============
  recorded_steps?: RecordedStep[];   // Automation steps
  parsed_fields?: FieldMapping[];    // CSV field mappings
  csv_data?: Record<string, string>[]; // Imported test data
}

type ProjectStatus = 'draft' | 'testing' | 'complete';
```

### 3.2 Column Specifications

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| id | number | No (auto) | Auto-increment | Yes (PK) | Primary key |
| name | string | No | - | Yes | Project name |
| description | string | Yes | '' | No | Description |
| target_url | string | No | - | Yes | Starting URL |
| status | string | No | 'draft' | Yes | Project status |
| created_date | number | No | Date.now() | Yes | Creation timestamp |
| updated_date | number | No | Date.now() | Yes | Last update timestamp |
| recorded_steps | array | Yes | [] | No | Step array (JSONB) |
| parsed_fields | array | Yes | [] | No | Field mappings (JSONB) |
| csv_data | array | Yes | [] | No | CSV rows (JSONB) |

### 3.3 Index Schema

```sql
-- Dexie creates these indexes automatically from schema string
PRIMARY KEY (id)                    -- Auto-increment
INDEX idx_projects_name (name)      -- For name search
INDEX idx_projects_url (target_url) -- For URL lookup
INDEX idx_projects_status (status)  -- For status filter
INDEX idx_projects_created (created_date)  -- For sorting
INDEX idx_projects_updated (updated_date)  -- For sorting
```

### 3.4 Example Project Record

```json
{
  "id": 1,
  "name": "Login Flow Test",
  "description": "Tests the user login process",
  "target_url": "https://app.example.com/login",
  "status": "testing",
  "created_date": 1700000000000,
  "updated_date": 1700100000000,
  "recorded_steps": [
    {
      "stepNumber": 1,
      "timestamp": 1700000001000,
      "label": "Type in Email field",
      "event": "input",
      "selector": "#email",
      "value": "",
      "bundle": {
        "id": "email",
        "name": "email",
        "xpath": "//input[@id='email']",
        "aria": null,
        "placeholder": "Enter your email",
        "tag": "input",
        "visibleText": "",
        "bounding": { "x": 100, "y": 200, "width": 300, "height": 40 }
      },
      "navigation": {
        "type": "same_page",
        "url": "https://app.example.com/login"
      }
    }
  ],
  "parsed_fields": [
    {
      "csvColumn": "email",
      "stepIndex": 0,
      "fieldType": "input",
      "required": true
    }
  ],
  "csv_data": [
    { "email": "user1@test.com", "password": "pass123" },
    { "email": "user2@test.com", "password": "pass456" }
  ]
}
```

---

## 4. TestRuns Table

### 4.1 Table Definition

```typescript
interface TestRun {
  // ============ PRIMARY KEY ============
  id?: number;  // Auto-increment
  
  // ============ FOREIGN KEY ============
  project_id: number;  // References projects.id
  
  // ============ STATUS ============
  status: TestRunStatus;
  
  // ============ TIMESTAMPS ============
  start_time: string;   // ISO 8601 string
  end_time?: string;    // ISO 8601 string (null if running)
  
  // ============ METRICS ============
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  
  // ============ JSONB ARRAYS ============
  test_results: StepResult[];  // Per-step results
  logs: string;                // Execution log text
}

type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
```

### 4.2 Column Specifications

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| id | number | No (auto) | Auto-increment | Yes (PK) | Primary key |
| project_id | number | No | - | Yes (FK) | Parent project |
| status | string | No | 'pending' | Yes | Run status |
| start_time | string | No | - | Yes | ISO timestamp |
| end_time | string | Yes | null | No | ISO timestamp |
| total_steps | number | No | 0 | No | Total step count |
| passed_steps | number | No | 0 | No | Successful steps |
| failed_steps | number | No | 0 | No | Failed steps |
| test_results | array | No | [] | No | Results (JSONB) |
| logs | string | No | '' | No | Log text |

### 4.3 Index Schema

```sql
PRIMARY KEY (id)
INDEX idx_testruns_project (project_id)  -- For project lookup
INDEX idx_testruns_status (status)       -- For status filter
INDEX idx_testruns_start (start_time)    -- For chronological sort
```

### 4.4 Example TestRun Record

```json
{
  "id": 42,
  "project_id": 1,
  "status": "completed",
  "start_time": "2024-11-24T10:30:00.000Z",
  "end_time": "2024-11-24T10:32:15.000Z",
  "total_steps": 5,
  "passed_steps": 4,
  "failed_steps": 1,
  "test_results": [
    {
      "stepNumber": 1,
      "success": true,
      "duration": 250,
      "error": null,
      "screenshot": null
    },
    {
      "stepNumber": 2,
      "success": true,
      "duration": 180,
      "error": null,
      "screenshot": null
    },
    {
      "stepNumber": 3,
      "success": false,
      "duration": 2000,
      "error": "Element not found: #submit-button",
      "screenshot": "data:image/png;base64,..."
    }
  ],
  "logs": "[10:30:00] Starting test run\n[10:30:00] Step 1: Type in Email field - PASSED\n[10:30:01] Step 2: Type in Password field - PASSED\n[10:30:03] Step 3: Click Submit button - FAILED: Element not found\n..."
}
```

---

## 5. Index Definitions

### 5.1 Projects Table Indexes

```typescript
// Primary Key Index
// Automatically created, unique, auto-increment
{
  name: 'id',
  keyPath: 'id',
  unique: true,
  autoIncrement: true
}

// Name Index (for search)
{
  name: 'name',
  keyPath: 'name',
  unique: false
}

// Target URL Index (for duplicate detection)
{
  name: 'target_url',
  keyPath: 'target_url',
  unique: false  // Multiple projects can have same URL
}

// Status Index (for filtering)
{
  name: 'status',
  keyPath: 'status',
  unique: false
}

// Created Date Index (for sorting)
{
  name: 'created_date',
  keyPath: 'created_date',
  unique: false
}

// Updated Date Index (for sorting)
{
  name: 'updated_date',
  keyPath: 'updated_date',
  unique: false
}
```

### 5.2 TestRuns Table Indexes

```typescript
// Primary Key Index
{
  name: 'id',
  keyPath: 'id',
  unique: true,
  autoIncrement: true
}

// Project ID Index (for parent lookup)
{
  name: 'project_id',
  keyPath: 'project_id',
  unique: false  // Many runs per project
}

// Status Index (for filtering)
{
  name: 'status',
  keyPath: 'status',
  unique: false
}

// Start Time Index (for chronological queries)
{
  name: 'start_time',
  keyPath: 'start_time',
  unique: false
}
```

### 5.3 Index Usage Patterns

| Query Pattern | Index Used | Performance |
|---------------|------------|-------------|
| projects.get(id) | Primary key | O(1) |
| projects.where('status').equals('draft') | status | O(log n) |
| projects.orderBy('updated_date') | updated_date | O(n) sorted |
| testRuns.where('project_id').equals(1) | project_id | O(log n) |
| projects.filter(p => p.name.includes('test')) | None (scan) | O(n) |

---

## 6. JSONB Field Structures

### 6.1 RecordedStep Structure

```typescript
interface RecordedStep {
  // Sequencing
  stepNumber: number;      // 1-based step index
  timestamp: number;       // Unix timestamp (ms)
  
  // User-facing
  label: string;           // Human-readable description
  
  // Action
  event: StepEventType;    // Action type
  selector?: string;       // CSS/XPath selector (deprecated)
  value?: any;             // Input value or click target
  
  // Navigation context
  navigation: NavigationContext;
  
  // Tab context
  tabId?: number;          // Chrome tab ID
  
  // Locator bundle
  bundle: LocatorBundle;
  
  // Optional metadata
  metadata?: StepMetadata;
}

type StepEventType = 
  | 'click' | 'dblclick' | 'rightclick'
  | 'input' | 'type' | 'clear' | 'select'
  | 'enter' | 'keyPress'
  | 'navigate' | 'reload' | 'back' | 'forward'
  | 'hover' | 'scroll' | 'scrollIntoView'
  | 'wait' | 'waitForSelector' | 'waitForNavigation'
  | 'assertText' | 'assertValue' | 'assertVisible'
  | 'screenshot' | 'download';

interface NavigationContext {
  type: 'url' | 'same_page' | 'new_tab' | 'switch_tab' | 'close_tab' | 'iframe';
  url?: string;
  parentStepNumber?: number;
  iframeSelector?: string;
}

interface LocatorBundle {
  id: string | null;
  name: string | null;
  xpath: string;
  aria: string | null;
  placeholder: string | null;
  dataAttrs: Record<string, string>;
  tag: string;
  visibleText: string;
  className: string;
  bounding: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  iframeChain: number[];
  shadowHosts: string[];
}

interface StepMetadata {
  dwellTime?: number;
  triggeredElementAppeared?: boolean;
  triggeredBy?: number;
  downloadId?: string;
  filename?: string;
  clipboardData?: string;
  variableName?: string;
  variableSource?: 'user_input' | 'clipboard' | 'extracted';
}
```

### 6.2 FieldMapping Structure

```typescript
interface FieldMapping {
  // CSV column reference
  csvColumn: string;       // Column header name
  
  // Step reference
  stepIndex: number;       // Index in recorded_steps array
  
  // Field type
  fieldType: 'input' | 'select' | 'checkbox' | 'radio' | 'textarea';
  
  // Validation
  required: boolean;
  defaultValue?: string;
  
  // Transform (optional)
  transform?: {
    type: 'uppercase' | 'lowercase' | 'trim' | 'format';
    format?: string;  // For date/number formatting
  };
}
```

### 6.3 StepResult Structure

```typescript
interface StepResult {
  // Step reference
  stepNumber: number;
  
  // Outcome
  success: boolean;
  duration: number;  // Milliseconds
  
  // Error details (if failed)
  error?: string;
  errorType?: string;
  
  // Recovery info
  recovered?: boolean;
  recoveryStrategy?: string;
  
  // Evidence (optional)
  screenshot?: string;  // Base64 data URL
  
  // Timing breakdown
  timing?: {
    findElement: number;
    executeAction: number;
    verify: number;
  };
}
```

### 6.4 Size Estimates

| Field | Typical Size | Large Size | Maximum |
|-------|--------------|------------|---------|
| recorded_steps (per step) | 2-5 KB | 10 KB | 50 KB |
| recorded_steps (50 steps) | 100-250 KB | 500 KB | 2.5 MB |
| parsed_fields (10 fields) | 2 KB | 5 KB | 20 KB |
| csv_data (100 rows) | 10-50 KB | 100 KB | 500 KB |
| csv_data (10,000 rows) | 1-5 MB | 10 MB | 50 MB |
| test_results (50 steps) | 5-10 KB | 50 KB | 500 KB |
| test_results (w/ screenshots) | 500 KB | 5 MB | 50 MB |
| logs (per run) | 5-20 KB | 100 KB | 1 MB |

---

## 7. Schema Version History

### 7.1 Version 1 (Current)

```typescript
// Initial schema - November 2024
this.version(1).stores({
  projects: '++id, name, target_url, status, created_date, updated_date',
  testRuns: '++id, project_id, status, start_time'
});

// Changes: Initial release
// - Basic project CRUD
// - Test run tracking
// - No migrations needed
```

### 7.2 Version 2 (Planned)

```typescript
// Add tags and team support
this.version(2).stores({
  projects: '++id, name, target_url, status, created_date, updated_date, *tags, team_id',
  testRuns: '++id, project_id, status, start_time, runner_id'
}).upgrade(trans => {
  return trans.table('projects').toCollection().modify(project => {
    // Initialize new fields with defaults
    project.tags = [];
    project.team_id = null;
  });
});

// Changes:
// - Added multi-value 'tags' index for project categorization
// - Added 'team_id' for team ownership (Phase 3)
// - Added 'runner_id' to testRuns for VDI runner tracking
```

### 7.3 Version 3 (Planned)

```typescript
// Add user authentication and sync metadata
this.version(3).stores({
  projects: '++id, name, target_url, status, created_date, updated_date, *tags, team_id, user_id, supabase_id',
  testRuns: '++id, project_id, status, start_time, runner_id, user_id, supabase_id',
  syncQueue: '++id, entity_type, entity_id, operation, created_at'
}).upgrade(trans => {
  return Promise.all([
    trans.table('projects').toCollection().modify(p => {
      p.user_id = 'local_user';
      p.supabase_id = null;
    }),
    trans.table('testRuns').toCollection().modify(r => {
      r.user_id = 'local_user';
      r.supabase_id = null;
    })
  ]);
});

// Changes:
// - Added 'user_id' for multi-user support
// - Added 'supabase_id' for cloud sync correlation
// - Added 'syncQueue' table for offline sync operations
```

---

## 8. Migration Scripts

### 8.1 Generic Migration Template

```typescript
// Migration helper
interface Migration {
  version: number;
  description: string;
  upgrade: (trans: Dexie.Transaction) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 2,
    description: 'Add tags and team support',
    upgrade: async (trans) => {
      await trans.table('projects').toCollection().modify(project => {
        if (!project.tags) project.tags = [];
        if (!project.team_id) project.team_id = null;
      });
    }
  },
  {
    version: 3,
    description: 'Add user and sync support',
    upgrade: async (trans) => {
      // Projects
      await trans.table('projects').toCollection().modify(project => {
        if (!project.user_id) project.user_id = 'local_user';
        if (!project.supabase_id) project.supabase_id = null;
      });
      
      // TestRuns
      await trans.table('testRuns').toCollection().modify(run => {
        if (!run.user_id) run.user_id = 'local_user';
        if (!run.supabase_id) run.supabase_id = null;
      });
    }
  }
];
```

### 8.2 Data Transformation Examples

```typescript
// Transform recorded_steps format (if schema changes)
async function migrateStepsFormat(trans: Dexie.Transaction): Promise<void> {
  await trans.table('projects').toCollection().modify(project => {
    if (project.recorded_steps) {
      project.recorded_steps = project.recorded_steps.map((step: any) => {
        // Example: Rename 'path' to 'xpath' in bundle
        if (step.bundle && step.bundle.path && !step.bundle.xpath) {
          step.bundle.xpath = step.bundle.path;
          delete step.bundle.path;
        }
        
        // Example: Add missing stepNumber
        if (typeof step.stepNumber !== 'number') {
          step.stepNumber = project.recorded_steps.indexOf(step) + 1;
        }
        
        return step;
      });
    }
  });
}

// Transform status values (if enum changes)
async function migrateStatusValues(trans: Dexie.Transaction): Promise<void> {
  const statusMap: Record<string, string> = {
    'active': 'testing',
    'done': 'complete',
    'archived': 'complete'
  };
  
  await trans.table('projects').toCollection().modify(project => {
    if (statusMap[project.status]) {
      project.status = statusMap[project.status];
    }
  });
}
```

### 8.3 Rollback Strategy

```typescript
// IndexedDB doesn't support true rollback
// Best practice: Create backup before migration

async function createBackup(): Promise<string> {
  const backup = {
    version: DB.verno,
    timestamp: new Date().toISOString(),
    projects: await DB.projects.toArray(),
    testRuns: await DB.testRuns.toArray()
  };
  
  return JSON.stringify(backup);
}

async function restoreBackup(backupJson: string): Promise<void> {
  const backup = JSON.parse(backupJson);
  
  // Clear existing data
  await DB.projects.clear();
  await DB.testRuns.clear();
  
  // Restore from backup
  await DB.projects.bulkAdd(backup.projects);
  await DB.testRuns.bulkAdd(backup.testRuns);
}
```

---

## 9. Query Optimization

### 9.1 Efficient Queries

```typescript
// ✅ GOOD: Use indexed field with where()
const drafts = await DB.projects
  .where('status')
  .equals('draft')
  .toArray();

// ✅ GOOD: Use primary key for single record
const project = await DB.projects.get(projectId);

// ✅ GOOD: Use compound conditions on same index
const recentDrafts = await DB.projects
  .where('status')
  .equals('draft')
  .and(p => p.updated_date > lastWeek)
  .toArray();

// ✅ GOOD: Limit results for pagination
const page = await DB.projects
  .orderBy('updated_date')
  .reverse()
  .offset(20)
  .limit(10)
  .toArray();
```

### 9.2 Inefficient Queries (Avoid)

```typescript
// ❌ BAD: Filter without index (full table scan)
const withTest = await DB.projects
  .filter(p => p.name.includes('test'))
  .toArray();

// ❌ BAD: Loading all then filtering in JS
const all = await DB.projects.toArray();
const filtered = all.filter(p => p.status === 'draft');

// ❌ BAD: Multiple separate queries
for (const id of projectIds) {
  const project = await DB.projects.get(id);
  // Process each...
}

// ✅ BETTER: Batch query
const projects = await DB.projects
  .where('id')
  .anyOf(projectIds)
  .toArray();
```

### 9.3 Query Performance Tips

| Tip | Impact |
|-----|--------|
| Use indexed fields in where() | 10-100x faster |
| Use get(id) for single records | O(1) vs O(n) |
| Use limit() for pagination | Reduces memory |
| Avoid filter() on large tables | Causes full scan |
| Use bulkAdd/bulkPut for batch writes | 10x faster |
| Clone objects before modifying | Prevents Dexie errors |

---

## 10. Storage Quotas

### 10.1 Browser Limits

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STORAGE QUOTAS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Chrome Extension Storage Limits:                                       │
│  ├── IndexedDB: ~80% of available disk space (soft limit)               │
│  ├── Per-origin limit: Varies by device (typically 2-50 GB)             │
│  └── Extension context: Shared with all extension pages                 │
│                                                                         │
│  Practical Limits for Our Use Case:                                     │
│  ├── Safe target: < 100 MB total                                        │
│  ├── Per project: < 5 MB (including CSV data)                           │
│  ├── Per test run: < 2 MB (including screenshots)                       │
│  └── Total projects: ~50-100 with full data                             │
│                                                                         │
│  Chrome Message Size Limit:                                             │
│  └── 64 MB per message (affects large project transfers)                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Quota Monitoring

```typescript
async function getStorageUsage(): Promise<{
  used: number;
  available: number;
  percentUsed: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const available = estimate.quota || 0;
    
    return {
      used,
      available,
      percentUsed: available > 0 ? (used / available) * 100 : 0
    };
  }
  
  // Fallback: estimate from data
  const projects = await DB.projects.toArray();
  const testRuns = await DB.testRuns.toArray();
  
  const estimatedSize = 
    JSON.stringify(projects).length + 
    JSON.stringify(testRuns).length;
  
  return {
    used: estimatedSize,
    available: 100 * 1024 * 1024, // Assume 100 MB
    percentUsed: (estimatedSize / (100 * 1024 * 1024)) * 100
  };
}

async function checkQuotaWarning(): Promise<boolean> {
  const { percentUsed } = await getStorageUsage();
  return percentUsed > 80; // Warn at 80% usage
}
```

### 10.3 Cleanup Utilities

```typescript
// Delete old test runs to free space
async function cleanupOldTestRuns(
  maxAge: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): Promise<number> {
  const cutoffDate = new Date(Date.now() - maxAge).toISOString();
  
  const oldRuns = await DB.testRuns
    .where('start_time')
    .below(cutoffDate)
    .toArray();
  
  const idsToDelete = oldRuns.map(r => r.id!);
  await DB.testRuns.bulkDelete(idsToDelete);
  
  return idsToDelete.length;
}

// Clear screenshots from test results
async function stripScreenshots(projectId: number): Promise<void> {
  const runs = await DB.testRuns
    .where('project_id')
    .equals(projectId)
    .toArray();
  
  for (const run of runs) {
    const strippedResults = run.test_results.map(r => ({
      ...r,
      screenshot: undefined
    }));
    
    await DB.testRuns.update(run.id!, {
      test_results: strippedResults
    });
  }
}

// Archive project (remove large fields)
async function archiveProject(projectId: number): Promise<void> {
  await DB.projects.update(projectId, {
    csv_data: [],
    status: 'complete'
  });
}
```

---

## 11. Backup and Recovery

### 11.1 Export Functions

```typescript
interface DatabaseExport {
  version: number;
  exportDate: string;
  projects: Project[];
  testRuns: TestRun[];
}

async function exportDatabase(): Promise<DatabaseExport> {
  return {
    version: DB.verno,
    exportDate: new Date().toISOString(),
    projects: await DB.projects.toArray(),
    testRuns: await DB.testRuns.toArray()
  };
}

async function exportToFile(): Promise<void> {
  const data = await exportDatabase();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `automater-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportProject(projectId: number): Promise<string> {
  const project = await DB.projects.get(projectId);
  const testRuns = await DB.testRuns
    .where('project_id')
    .equals(projectId)
    .toArray();
  
  return JSON.stringify({ project, testRuns }, null, 2);
}
```

### 11.2 Import Functions

```typescript
async function importDatabase(data: DatabaseExport): Promise<{
  projectsImported: number;
  testRunsImported: number;
}> {
  // Validate structure
  if (!data.projects || !data.testRuns) {
    throw new Error('Invalid backup format');
  }
  
  // Import projects (assign new IDs)
  const idMap = new Map<number, number>();
  
  for (const project of data.projects) {
    const oldId = project.id!;
    delete project.id; // Let Dexie assign new ID
    
    const newId = await DB.projects.add(project);
    idMap.set(oldId, newId);
  }
  
  // Import test runs with updated project_ids
  for (const run of data.testRuns) {
    const oldProjectId = run.project_id;
    const newProjectId = idMap.get(oldProjectId);
    
    if (newProjectId) {
      delete run.id;
      run.project_id = newProjectId;
      await DB.testRuns.add(run);
    }
  }
  
  return {
    projectsImported: data.projects.length,
    testRunsImported: data.testRuns.length
  };
}

async function importFromFile(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as DatabaseExport;
  await importDatabase(data);
}
```

---

## 12. Testing Utilities

### 12.1 Test Data Generators

```typescript
function generateTestProject(overrides: Partial<Project> = {}): Omit<Project, 'id'> {
  return {
    name: `Test Project ${Date.now()}`,
    description: 'Generated test project',
    target_url: 'https://example.com',
    status: 'draft',
    created_date: Date.now(),
    updated_date: Date.now(),
    recorded_steps: [],
    parsed_fields: [],
    csv_data: [],
    ...overrides
  };
}

function generateTestRun(
  projectId: number,
  overrides: Partial<TestRun> = {}
): Omit<TestRun, 'id'> {
  return {
    project_id: projectId,
    status: 'completed',
    start_time: new Date().toISOString(),
    end_time: new Date().toISOString(),
    total_steps: 5,
    passed_steps: 5,
    failed_steps: 0,
    test_results: [],
    logs: '',
    ...overrides
  };
}

function generateRecordedStep(
  stepNumber: number,
  overrides: Partial<RecordedStep> = {}
): RecordedStep {
  return {
    stepNumber,
    timestamp: Date.now(),
    label: `Step ${stepNumber}`,
    event: 'click',
    bundle: {
      id: `element-${stepNumber}`,
      name: null,
      xpath: `//*[@id='element-${stepNumber}']`,
      aria: null,
      placeholder: null,
      dataAttrs: {},
      tag: 'button',
      visibleText: `Button ${stepNumber}`,
      className: 'btn',
      bounding: { x: 100, y: 100 * stepNumber, width: 100, height: 40 },
      iframeChain: [],
      shadowHosts: []
    },
    navigation: {
      type: 'same_page',
      url: 'https://example.com'
    },
    ...overrides
  };
}
```

### 12.2 Database Reset

```typescript
async function resetDatabase(): Promise<void> {
  await DB.projects.clear();
  await DB.testRuns.clear();
}

async function seedTestData(): Promise<void> {
  // Create test projects
  const project1Id = await DB.projects.add(generateTestProject({
    name: 'Login Flow',
    recorded_steps: [
      generateRecordedStep(1, { event: 'input', label: 'Enter email' }),
      generateRecordedStep(2, { event: 'input', label: 'Enter password' }),
      generateRecordedStep(3, { event: 'click', label: 'Click submit' })
    ]
  }));
  
  const project2Id = await DB.projects.add(generateTestProject({
    name: 'Checkout Flow',
    status: 'testing'
  }));
  
  // Create test runs
  await DB.testRuns.add(generateTestRun(project1Id, {
    passed_steps: 3,
    failed_steps: 0
  }));
  
  await DB.testRuns.add(generateTestRun(project1Id, {
    passed_steps: 2,
    failed_steps: 1,
    status: 'failed'
  }));
}
```

---

## Summary

This IndexedDB schema specification provides:

✅ Complete table definitions for projects and testRuns  
✅ Index specifications for efficient queries  
✅ JSONB field structures for complex nested data  
✅ Version history with migration path  
✅ Migration scripts for schema evolution  
✅ Query optimization guidelines  
✅ Storage quota monitoring and cleanup  
✅ Backup/recovery utilities  
✅ Testing utilities for development  

This schema supports offline-first operation with planned evolution toward cloud sync with Supabase.
