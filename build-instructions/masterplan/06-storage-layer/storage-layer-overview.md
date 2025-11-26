# Storage Layer Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture Summary
3. Core Responsibilities
4. Data Models
5. Storage Providers
6. Message-Based Coordination
7. Dexie.js Integration
8. Query Patterns
9. Transaction Management
10. Error Handling
11. Migration Strategy
12. Performance Considerations
13. Security and Data Integrity

---

## 1. Overview

### 1.1 Purpose

The **Storage Layer** provides persistent data management for all extension data including projects, test runs, recorded steps, field mappings, and CSV data. It abstracts the complexity of IndexedDB through a Dexie.js wrapper and coordinates all storage operations through the background service worker.

### 1.2 Complexity Rating

**🟢 LOW-MEDIUM (4/10)**

The storage layer is relatively straightforward but introduces complexity through async messaging patterns, large array handling, and the need for future migration support.

### 1.3 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER PRINCIPLES                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SINGLE SOURCE OF TRUTH                                              │
│     - All data flows through IndexedDB                                  │
│     - Background script coordinates all access                          │
│     - No direct DB access from content scripts or UI                    │
│                                                                         │
│  2. MESSAGE-BASED COORDINATION                                          │
│     - UI components send messages to background                         │
│     - Background handles DB operations                                  │
│     - Responses returned via sendResponse callback                      │
│                                                                         │
│  3. OFFLINE-FIRST                                                       │
│     - IndexedDB persists data locally                                   │
│     - Works without network connectivity                                │
│     - Future: Sync to Supabase when online                              │
│                                                                         │
│  4. SCHEMA EVOLUTION                                                    │
│     - Dexie handles version upgrades                                    │
│     - Migrations preserve existing data                                 │
│     - Backward compatible changes preferred                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Summary

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       STORAGE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      UI COMPONENTS                             │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │    │
│  │  │Dashboard │ │ Recorder │ │  Mapper  │ │  Runner  │          │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │    │
│  │       │            │            │            │                 │    │
│  │       └────────────┴────────────┴────────────┘                 │    │
│  │                           │                                     │    │
│  │        chrome.runtime.sendMessage({ action, payload })         │    │
│  └───────────────────────────┼─────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              BACKGROUND SERVICE WORKER                         │    │
│  │                                                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │                 MESSAGE ROUTER                          │   │    │
│  │  │  - Parse action type                                    │   │    │
│  │  │  - Extract payload                                      │   │    │
│  │  │  - Route to handler                                     │   │    │
│  │  │  - Return response                                      │   │    │
│  │  └───────────────────────┬─────────────────────────────────┘   │    │
│  │                          │                                      │    │
│  │                          ▼                                      │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │                 DEXIE WRAPPER                           │   │    │
│  │  │  - ProjectDB class                                      │   │    │
│  │  │  - Table definitions                                    │   │    │
│  │  │  - CRUD methods                                         │   │    │
│  │  └───────────────────────┬─────────────────────────────────┘   │    │
│  └──────────────────────────┼─────────────────────────────────────┘    │
│                             │                                           │
│                             ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                       INDEXEDDB                                │    │
│  │  ┌─────────────────┐          ┌─────────────────┐             │    │
│  │  │    projects     │          │    testRuns     │             │    │
│  │  │  - id (PK)      │          │  - id (PK)      │             │    │
│  │  │  - name         │          │  - project_id   │             │    │
│  │  │  - steps[]      │          │  - status       │             │    │
│  │  │  - fields[]     │          │  - results[]    │             │    │
│  │  │  - csv_data[]   │          │  - logs         │             │    │
│  │  └─────────────────┘          └─────────────────┘             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Locations

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Dexie Wrapper | `src/common/services/indexedDB.ts` | 71 | Database class and methods |
| Message Router | `src/background/background.ts` | 15-270 | Storage action handlers |

### 2.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DATA FLOW SEQUENCE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. UI Component (e.g., Dashboard)                                      │
│                                                                         │
│     chrome.runtime.sendMessage({                                        │
│       action: "get_all_projects",                                       │
│       payload: {}                                                       │
│     }, callback)                                                        │
│                                                                         │
│                          ▼                                              │
│  2. Background Script                                                   │
│                                                                         │
│     if (message.action === "get_all_projects") {                        │
│       DB.getAllProjects()                                               │
│         .then(projects => sendResponse({ success: true, data }))        │
│       return true; // Keep channel open                                 │
│     }                                                                   │
│                                                                         │
│                          ▼                                              │
│  3. Dexie Wrapper                                                       │
│                                                                         │
│     async getAllProjects() {                                            │
│       return this.projects.toArray();                                   │
│     }                                                                   │
│                                                                         │
│                          ▼                                              │
│  4. IndexedDB                                                           │
│                                                                         │
│     [Reads all records from "projects" object store]                    │
│                                                                         │
│                          ▼                                              │
│  5. Response flows back up the chain                                    │
│                                                                         │
│     callback({ success: true, data: [...projects] })                    │
│                                                                         │
│                          ▼                                              │
│  6. UI updates state with received data                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Responsibilities

### 3.1 MUST DO

| Responsibility | Description | Implementation |
|----------------|-------------|----------------|
| **Project CRUD** | Create, read, update, delete projects | `addProject`, `updateProject`, `getAllProjects`, `deleteProject` |
| **Test Run Management** | Store execution history and results | `createTestRun`, `updateTestRun`, `getTestRunsByProject` |
| **Schema Definition** | Define table structures and indexes | Dexie `version().stores()` |
| **Message Routing** | Handle storage messages from UI | Background script action handlers |
| **Async Coordination** | Keep message channels open for responses | `return true` pattern |
| **Error Handling** | Catch and report DB errors | Try-catch with error responses |

### 3.2 MUST NOT DO

```typescript
// ❌ WRONG: Direct DB access from content script
// Content scripts cannot access IndexedDB reliably
import { DB } from './indexedDB';
const projects = await DB.getAllProjects(); // FAILS

// ✅ CORRECT: Message through background
chrome.runtime.sendMessage(
  { action: 'get_all_projects' },
  (response) => {
    if (response.success) {
      const projects = response.data;
    }
  }
);

// ❌ WRONG: Forgetting to return true
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_all_projects') {
    DB.getAllProjects().then(data => sendResponse({ success: true, data }));
    // Missing return true! Response will never arrive.
  }
});

// ✅ CORRECT: Keep channel open
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_all_projects') {
    DB.getAllProjects().then(data => sendResponse({ success: true, data }));
    return true; // CRITICAL: Keep channel open for async response
  }
});
```

---

## 4. Data Models

### 4.1 Project Schema

```typescript
interface Project {
  // Primary key (auto-increment)
  id?: number;
  
  // Basic metadata
  name: string;
  description: string;
  target_url: string;
  
  // Status tracking
  status: 'draft' | 'testing' | 'complete';
  
  // Timestamps (Unix milliseconds)
  created_date: number;
  updated_date: number;
  
  // Large array fields
  recorded_steps?: RecordedStep[];  // Can be very large
  parsed_fields?: FieldMapping[];   // Field configurations
  csv_data?: CSVRow[];              // Imported test data
}
```

### 4.2 TestRun Schema

```typescript
interface TestRun {
  // Primary key (auto-increment)
  id?: number;
  
  // Foreign key
  project_id: number;
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // Timestamps (ISO strings)
  start_time: string;
  end_time?: string;
  
  // Metrics
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  
  // Results (can be large)
  test_results: StepResult[];
  logs: string;
}
```

### 4.3 Supporting Types

```typescript
interface RecordedStep {
  stepNumber: number;
  timestamp: number;
  label: string;
  event: string;
  selector?: string;
  value?: any;
  bundle: LocatorBundle;
  navigation: NavigationContext;
  metadata?: StepMetadata;
}

interface FieldMapping {
  csvColumn: string;
  stepIndex: number;
  fieldType: 'input' | 'select' | 'checkbox';
  required: boolean;
}

interface CSVRow {
  [columnName: string]: string;
}

interface StepResult {
  stepNumber: number;
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
}
```

### 4.4 Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐                                        │
│  │         projects            │                                        │
│  ├─────────────────────────────┤                                        │
│  │ ++id (PK, auto-increment)   │                                        │
│  │ name (indexed)              │                                        │
│  │ description                 │                                        │
│  │ target_url (indexed)        │                                        │
│  │ status (indexed)            │                                        │
│  │ created_date (indexed)      │                                        │
│  │ updated_date (indexed)      │                                        │
│  │ recorded_steps[] (JSONB)    │◄──── Can be 100+ KB                    │
│  │ parsed_fields[] (JSONB)     │                                        │
│  │ csv_data[] (JSONB)          │◄──── Can be 1+ MB                      │
│  └──────────────┬──────────────┘                                        │
│                 │                                                       │
│                 │ 1:N relationship                                      │
│                 │                                                       │
│  ┌──────────────▼──────────────┐                                        │
│  │         testRuns            │                                        │
│  ├─────────────────────────────┤                                        │
│  │ ++id (PK, auto-increment)   │                                        │
│  │ project_id (indexed, FK)    │                                        │
│  │ status (indexed)            │                                        │
│  │ start_time (indexed)        │                                        │
│  │ end_time                    │                                        │
│  │ total_steps                 │                                        │
│  │ passed_steps                │                                        │
│  │ failed_steps                │                                        │
│  │ test_results[] (JSONB)      │◄──── Can be 500+ KB                    │
│  │ logs (text)                 │◄──── Can be 100+ KB                    │
│  └─────────────────────────────┘                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Storage Providers

### 5.1 Current: Dexie/IndexedDB

```typescript
// src/common/services/indexedDB.ts
import Dexie, { Table } from 'dexie';

class ProjectDB extends Dexie {
  public projects!: Table<Project, number>;
  public testRuns!: Table<TestRun, number>;
  
  constructor() {
    super('ProjectDatabase');
    
    this.version(1).stores({
      projects: '++id, name, target_url, status, created_date, updated_date',
      testRuns: '++id, project_id, status, start_time'
    });
  }
  
  // Project methods
  async addProject(project: Omit<Project, 'id'>): Promise<number> {
    return this.projects.add(project as Project);
  }
  
  async updateProject(id: number, updates: Partial<Project>): Promise<number> {
    return this.projects.update(id, updates);
  }
  
  async getAllProjects(): Promise<Project[]> {
    return this.projects.toArray();
  }
  
  async deleteProject(id: number): Promise<void> {
    await this.projects.delete(id);
  }
  
  async getProjectById(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }
  
  // Test run methods
  async createTestRun(run: Omit<TestRun, 'id'>): Promise<number> {
    return this.testRuns.add(run as TestRun);
  }
  
  async updateTestRun(id: number, updates: Partial<TestRun>): Promise<number> {
    return this.testRuns.update(id, updates);
  }
  
  async getTestRunsByProject(projectId: number): Promise<TestRun[]> {
    return this.testRuns
      .where('project_id')
      .equals(projectId)
      .reverse()
      .sortBy('start_time');
  }
}

export const DB = new ProjectDB();
```

### 5.2 Future: Storage Abstraction Interface

```typescript
// Future implementation for multi-provider support
interface IStorageProvider {
  projects: IProjectRepository;
  testRuns: ITestRunRepository;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

interface IProjectRepository {
  create(project: Omit<Project, 'id'>): Promise<number>;
  update(id: number, updates: Partial<Project>): Promise<void>;
  get(id: number): Promise<Project | null>;
  list(options?: ListOptions): Promise<Project[]>;
  delete(id: number): Promise<void>;
  count(): Promise<number>;
}

interface ITestRunRepository {
  create(run: Omit<TestRun, 'id'>): Promise<number>;
  update(id: number, updates: Partial<TestRun>): Promise<void>;
  get(id: number): Promise<TestRun | null>;
  listByProject(projectId: number, options?: ListOptions): Promise<TestRun[]>;
  delete(id: number): Promise<void>;
}

interface ListOptions {
  offset?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}
```

### 5.3 Provider Implementations (Future)

| Provider | Use Case | Status |
|----------|----------|--------|
| DexieStorageProvider | Local IndexedDB storage | ✅ Current |
| SupabaseStorageProvider | Cloud sync, team sharing | 🔮 Phase 2 |
| ChromeStorageProvider | Small data, cross-device sync | 🔮 Future |
| InMemoryProvider | Unit testing | 🔮 Future |

---

## 6. Message-Based Coordination

### 6.1 Message Protocol

```typescript
// Request format
interface StorageRequest {
  action: StorageAction;
  payload?: any;
}

type StorageAction =
  | 'add_project'
  | 'update_project'
  | 'get_all_projects'
  | 'delete_project'
  | 'get_project_by_id'
  | 'update_project_steps'
  | 'update_project_fields'
  | 'update_project_csv'
  | 'createTestRun'
  | 'updateTestRun'
  | 'getTestRunsByProject';

// Response format
interface StorageResponse {
  success: boolean;
  data?: any;
  error?: string;
  id?: number;  // For create operations
}
```

### 6.2 Action Handlers

```typescript
// src/background/background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Project CRUD
  if (message.action === 'add_project') {
    const newProject = {
      ...message.payload,
      recorded_steps: [],
      parsed_fields: [],
      csv_data: [],
      created_date: Date.now(),
      updated_date: Date.now()
    };
    
    DB.addProject(newProject)
      .then(id => sendResponse({ success: true, id }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'update_project') {
    const { id, ...updates } = message.payload;
    updates.updated_date = Date.now();
    
    DB.updateProject(id, updates)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'get_all_projects') {
    DB.getAllProjects()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'delete_project') {
    DB.deleteProject(message.payload.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'get_project_by_id') {
    DB.getProjectById(message.payload.id)
      .then(project => sendResponse({ success: true, project }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  // Specialized updates
  if (message.action === 'update_project_steps') {
    const { projectId, steps } = message.payload;
    
    DB.updateProject(projectId, {
      recorded_steps: steps,
      updated_date: Date.now()
    })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'update_project_fields') {
    const { projectId, fields } = message.payload;
    
    DB.updateProject(projectId, {
      parsed_fields: fields,
      updated_date: Date.now()
    })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'update_project_csv') {
    const { projectId, csvData } = message.payload;
    
    DB.updateProject(projectId, {
      csv_data: csvData,
      updated_date: Date.now()
    })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  // Test Run CRUD
  if (message.action === 'createTestRun') {
    DB.createTestRun(message.payload)
      .then(id => sendResponse({ success: true, id }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'updateTestRun') {
    const { id, ...updates } = message.payload;
    
    DB.updateTestRun(id, updates)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
  
  if (message.action === 'getTestRunsByProject') {
    DB.getTestRunsByProject(message.payload.projectId)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true;
  }
});
```

### 6.3 Client-Side Usage

```typescript
// Helper function for storage operations
async function storageRequest<T>(
  action: StorageAction,
  payload?: any
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response.success) {
        resolve(response.data ?? response.id ?? response.project);
      } else {
        reject(new Error(response.error || 'Storage operation failed'));
      }
    });
  });
}

// Usage in components
async function loadProjects(): Promise<Project[]> {
  return storageRequest<Project[]>('get_all_projects');
}

async function saveProject(project: Partial<Project>): Promise<number> {
  return storageRequest<number>('add_project', project);
}

async function updateProjectSteps(projectId: number, steps: RecordedStep[]): Promise<void> {
  await storageRequest<void>('update_project_steps', { projectId, steps });
}
```

---

## 7. Dexie.js Integration

### 7.1 Why Dexie?

| Feature | Benefit |
|---------|---------|
| Promise-based API | Clean async/await syntax |
| TypeScript support | Type-safe table definitions |
| Auto-indexing | Indexes created from schema string |
| Version management | Built-in schema migration |
| Query builder | Fluent API for complex queries |
| Bulk operations | Efficient batch inserts/updates |

### 7.2 Schema Definition Syntax

```typescript
// Dexie schema syntax
this.version(1).stores({
  // ++id = auto-increment primary key
  // Comma-separated fields = indexed columns
  projects: '++id, name, target_url, status, created_date, updated_date',
  testRuns: '++id, project_id, status, start_time'
});

// Schema symbols:
// ++  = Auto-increment
// &   = Unique index
// *   = Multi-valued index (arrays)
// [x+y] = Compound index
```

### 7.3 Common Dexie Operations

```typescript
// Create (returns new ID)
const id = await DB.projects.add(project);

// Read single
const project = await DB.projects.get(id);

// Read all
const all = await DB.projects.toArray();

// Update (returns count updated: 0 or 1)
const updated = await DB.projects.update(id, { name: 'New Name' });

// Delete
await DB.projects.delete(id);

// Query with where
const drafts = await DB.projects
  .where('status')
  .equals('draft')
  .toArray();

// Query with filter (slower, no index)
const recent = await DB.projects
  .filter(p => p.created_date > lastWeek)
  .toArray();

// Order by
const sorted = await DB.projects
  .orderBy('created_date')
  .reverse()
  .toArray();

// Limit
const top10 = await DB.projects
  .orderBy('updated_date')
  .reverse()
  .limit(10)
  .toArray();
```

---

## 8. Query Patterns

### 8.1 Common Queries

```typescript
// Get all projects ordered by last update
async function getProjectsRecent(): Promise<Project[]> {
  return DB.projects
    .orderBy('updated_date')
    .reverse()
    .toArray();
}

// Get projects by status
async function getProjectsByStatus(status: string): Promise<Project[]> {
  return DB.projects
    .where('status')
    .equals(status)
    .toArray();
}

// Search projects by name (case-insensitive)
async function searchProjects(query: string): Promise<Project[]> {
  const lowerQuery = query.toLowerCase();
  return DB.projects
    .filter(p => p.name.toLowerCase().includes(lowerQuery))
    .toArray();
}

// Get test runs with pagination
async function getTestRunsPaginated(
  projectId: number,
  offset: number,
  limit: number
): Promise<{ runs: TestRun[]; total: number }> {
  const total = await DB.testRuns
    .where('project_id')
    .equals(projectId)
    .count();
  
  const runs = await DB.testRuns
    .where('project_id')
    .equals(projectId)
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
  
  return { runs, total };
}

// Get test run statistics
async function getProjectStats(projectId: number): Promise<{
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  lastRun?: TestRun;
}> {
  const runs = await DB.testRuns
    .where('project_id')
    .equals(projectId)
    .toArray();
  
  return {
    totalRuns: runs.length,
    passedRuns: runs.filter(r => r.status === 'completed' && r.failed_steps === 0).length,
    failedRuns: runs.filter(r => r.status === 'failed' || r.failed_steps > 0).length,
    lastRun: runs.sort((a, b) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    )[0]
  };
}
```

---

## 9. Transaction Management

### 9.1 Dexie Transactions

```typescript
// Single operation (auto-transaction)
await DB.projects.add(project);

// Explicit transaction for multiple operations
await DB.transaction('rw', DB.projects, DB.testRuns, async () => {
  // Delete project
  await DB.projects.delete(projectId);
  
  // Delete all related test runs
  await DB.testRuns
    .where('project_id')
    .equals(projectId)
    .delete();
});
// If any operation fails, entire transaction rolls back
```

### 9.2 Transaction Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| r | Read-only | Queries, reports |
| rw | Read-write | Create, update, delete |
| rw! | Read-write (upgrade lock) | Schema changes |

### 9.3 Current Limitations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 TRANSACTION GAPS (Current State)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ⚠️  NO GROUPED TRANSACTIONS                                            │
│      - Project create + first step are separate operations              │
│      - Delete project doesn't cascade to test runs                      │
│      - Partial failures leave inconsistent state                        │
│                                                                         │
│  ⚠️  NO CONFLICT RESOLUTION                                             │
│      - Two tabs editing same project = last write wins                  │
│      - No optimistic locking or versioning                              │
│                                                                         │
│  ⚠️  NO RETRY LOGIC                                                     │
│      - Transient failures not retried                                   │
│      - User must manually retry failed operations                       │
│                                                                         │
│  FUTURE: Implement transaction wrapper with:                            │
│      - Atomic multi-operation transactions                              │
│      - Automatic retry with backoff                                     │
│      - Conflict detection via version field                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Error Handling

### 10.1 Error Types

```typescript
enum StorageErrorType {
  // Database errors
  DB_NOT_FOUND = 'DB_NOT_FOUND',
  DB_QUOTA_EXCEEDED = 'DB_QUOTA_EXCEEDED',
  DB_CONSTRAINT_ERROR = 'DB_CONSTRAINT_ERROR',
  DB_VERSION_ERROR = 'DB_VERSION_ERROR',
  
  // Operation errors
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  
  // Communication errors
  MESSAGE_CHANNEL_CLOSED = 'MESSAGE_CHANNEL_CLOSED',
  RESPONSE_TIMEOUT = 'RESPONSE_TIMEOUT',
  
  // Unknown
  UNKNOWN = 'UNKNOWN'
}
```

### 10.2 Error Handling Pattern

```typescript
// Background script error handling
async function handleStorageAction(
  action: string,
  payload: any,
  sendResponse: (response: StorageResponse) => void
): Promise<void> {
  try {
    let result: any;
    
    switch (action) {
      case 'add_project':
        result = await DB.addProject(payload);
        sendResponse({ success: true, id: result });
        break;
      
      case 'get_all_projects':
        result = await DB.getAllProjects();
        sendResponse({ success: true, data: result });
        break;
      
      // ... other actions
      
      default:
        sendResponse({ 
          success: false, 
          error: `Unknown action: ${action}` 
        });
    }
  } catch (error) {
    console.error(`Storage error for ${action}:`, error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
    
    // Check for specific Dexie errors
    if (error.name === 'QuotaExceededError') {
      sendResponse({
        success: false,
        error: 'Storage quota exceeded. Please delete some projects.'
      });
    } else if (error.name === 'ConstraintError') {
      sendResponse({
        success: false,
        error: 'Duplicate entry or constraint violation.'
      });
    } else {
      sendResponse({
        success: false,
        error: errorMessage
      });
    }
  }
}
```

---

## 11. Migration Strategy

### 11.1 Version Upgrade Pattern

```typescript
class ProjectDB extends Dexie {
  constructor() {
    super('ProjectDatabase');
    
    // Version 1: Initial schema
    this.version(1).stores({
      projects: '++id, name, target_url, status, created_date, updated_date',
      testRuns: '++id, project_id, status, start_time'
    });
    
    // Version 2: Add tags field (example)
    this.version(2).stores({
      projects: '++id, name, target_url, status, created_date, updated_date, *tags',
      testRuns: '++id, project_id, status, start_time'
    }).upgrade(trans => {
      // Migrate existing projects
      return trans.table('projects').toCollection().modify(project => {
        project.tags = []; // Initialize new field
      });
    });
    
    // Version 3: Add user_id for multi-user (example)
    this.version(3).stores({
      projects: '++id, name, target_url, status, created_date, updated_date, *tags, user_id',
      testRuns: '++id, project_id, status, start_time, user_id'
    }).upgrade(trans => {
      // Assign default user
      return Promise.all([
        trans.table('projects').toCollection().modify(p => { p.user_id = 'local'; }),
        trans.table('testRuns').toCollection().modify(r => { r.user_id = 'local'; })
      ]);
    });
  }
}
```

### 11.2 Migration Best Practices

| Practice | Reason |
|----------|--------|
| Never delete columns | Breaks older data |
| Add nullable columns | Existing rows don't need values |
| Use upgrade() for data migration | Transforms existing data |
| Test with real data | Edge cases in production data |
| Backup before migration | Recovery if migration fails |

---

## 12. Performance Considerations

### 12.1 Large Array Handling

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       LARGE DATA CONCERNS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  recorded_steps[]                                                       │
│  ├── Average: 20-50 steps per project                                   │
│  ├── Large: 200+ steps                                                  │
│  ├── Each step: ~2-5 KB (with bundle)                                   │
│  └── Risk: 1 MB+ project objects                                        │
│                                                                         │
│  csv_data[]                                                             │
│  ├── Average: 100-500 rows                                              │
│  ├── Large: 10,000+ rows                                                │
│  ├── Each row: ~100 bytes - 1 KB                                        │
│  └── Risk: 10 MB+ CSV data                                              │
│                                                                         │
│  test_results[]                                                         │
│  ├── One per step executed                                              │
│  ├── Screenshots: 50-200 KB each (if enabled)                           │
│  └── Risk: 5 MB+ per test run                                           │
│                                                                         │
│  CURRENT MITIGATION: None                                               │
│  FUTURE: Pagination, lazy loading, separate object stores               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Optimization Strategies (Future)

```typescript
// Strategy 1: Separate steps into own table
this.version(4).stores({
  projects: '++id, name, target_url, status',
  projectSteps: '++id, project_id, stepNumber',
  testRuns: '++id, project_id, status, start_time'
});

// Strategy 2: Pagination for large arrays
async function getStepsPaginated(
  projectId: number,
  page: number,
  pageSize: number = 50
): Promise<{ steps: RecordedStep[]; total: number }> {
  const project = await DB.projects.get(projectId);
  const allSteps = project?.recorded_steps || [];
  
  return {
    steps: allSteps.slice(page * pageSize, (page + 1) * pageSize),
    total: allSteps.length
  };
}

// Strategy 3: Caching layer
class ProjectCache {
  private cache = new Map<number, { project: Project; timestamp: number }>();
  private ttl = 60000; // 1 minute
  
  async get(id: number): Promise<Project | null> {
    const cached = this.cache.get(id);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.project;
    }
    
    const project = await DB.projects.get(id);
    if (project) {
      this.cache.set(id, { project, timestamp: Date.now() });
    }
    
    return project || null;
  }
  
  invalidate(id: number): void {
    this.cache.delete(id);
  }
}
```

---

## 13. Security and Data Integrity

### 13.1 Current State

| Concern | Current State | Risk Level |
|---------|---------------|------------|
| Encryption | None | Medium (local data) |
| Validation | TypeScript only (compile-time) | Medium |
| Access Control | None | Low (single user) |
| Backup | None | High |
| PII Handling | Stored in plaintext | Medium |

### 13.2 Validation Layer (Future)

```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  target_url: z.string().url(),
  status: z.enum(['draft', 'testing', 'complete']),
  recorded_steps: z.array(z.any()).optional(),
  parsed_fields: z.array(z.any()).optional(),
  csv_data: z.array(z.record(z.string())).optional()
});

function validateProject(project: unknown): { valid: boolean; errors?: string[] } {
  const result = ProjectSchema.safeParse(project);
  
  if (result.success) {
    return { valid: true };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  };
}
```

### 13.3 Data Integrity Rules

```typescript
// Enforce referential integrity
async function deleteProjectWithCascade(projectId: number): Promise<void> {
  await DB.transaction('rw', DB.projects, DB.testRuns, async () => {
    // Delete all test runs first
    await DB.testRuns
      .where('project_id')
      .equals(projectId)
      .delete();
    
    // Then delete project
    await DB.projects.delete(projectId);
  });
}

// Enforce status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'draft': ['testing', 'complete'],
  'testing': ['draft', 'complete'],
  'complete': ['draft', 'testing']
};

function isValidStatusTransition(from: string, to: string): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## Summary

The Storage Layer provides:

✅ Dexie/IndexedDB persistence for offline-first operation  
✅ Message-based coordination through background script  
✅ Project and TestRun CRUD with typed schemas  
✅ Async messaging pattern with proper channel handling  
✅ Index-based queries for efficient lookups  
✅ Version management for schema evolution  
✅ Error handling with typed responses  

Future enhancements planned:

🔮 Storage provider abstraction  
🔮 Supabase cloud sync  
🔮 Schema validation with Zod  
🔮 Pagination for large datasets  
🔮 Caching layer  
🔮 Transaction grouping  

This layer is the foundation for all data persistence in the extension.
