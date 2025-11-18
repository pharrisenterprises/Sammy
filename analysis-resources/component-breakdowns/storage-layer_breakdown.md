# STORAGE LAYER BREAKDOWN

## 1. Summary

The Storage Layer provides **persistent data management** for projects, test runs, recorded steps, field mappings, and CSV data. It uses IndexedDB (via Dexie.js wrapper) for structured storage with relational queries and Chrome extension storage for settings. This layer abstracts storage complexity from UI components, enabling offline operation and large dataset handling.

**Importance**: ⭐⭐⭐⭐ (High - all user data flows through this layer)

## 2. Primary Responsibilities

1. **Project CRUD**: Create, read, update, delete automation projects
2. **Test Run Management**: Store execution history, results, logs
3. **Schema Management**: Define table structures, indexes, relationships
4. **Query Interface**: Provide high-level query methods (getAll, getById, filter)
5. **Transaction Safety**: Ensure atomic operations (all-or-nothing writes)
6. **Migration Support**: Handle schema upgrades between versions
7. **Data Integrity**: Validate data before writes, handle constraint violations
8. **Background Coordination**: Route storage operations through background script

## 3. Dependencies

### Files
- `src/common/services/indexedDB.ts` (71 lines) - Dexie DB wrapper
- `src/background/background.ts` (347 lines) - Message-based storage coordinator

### External Libraries
- `dexie` (4.0.11) - IndexedDB wrapper with TypeScript support
- Chrome APIs: `chrome.storage.local`, `chrome.storage.sync` (minimal usage)

### Browser APIs
- IndexedDB - Underlying storage engine
- Structured Clone Algorithm - Object serialization

## 4. Inputs / Outputs

### Inputs (From UI Components)
- **Messages from Extension Pages**:
  ```typescript
  chrome.runtime.sendMessage({
    action: "add_project" | "update_project" | "get_all_projects" | 
            "delete_project" | "get_project_by_id" |
            "update_project_steps" | "update_project_fields" | 
            "update_project_csv" | "createTestRun" | "updateTestRun" |
            "getTestRunsByProject",
    payload: { /* data */ }
  });
  ```

### Outputs (To UI Components)
- **Response Messages**:
  ```typescript
  {
    success: boolean,
    data?: any,
    error?: string,
    id?: number  // for create operations
  }
  ```

### Data Models

#### Project Schema
```typescript
interface Project {
  id?: number;           // Auto-increment primary key
  name: string;          // Project name
  description: string;   // Optional description
  target_url: string;    // Starting URL for recording
  status: string;        // 'draft' | 'testing' | 'complete'
  created_date: number;  // Unix timestamp
  updated_date: number;  // Unix timestamp
  recorded_steps?: any[]; // Array of step objects
  parsed_fields?: any[];  // Field mapping configuration
  csv_data?: any[];       // Imported CSV rows
}
```

#### TestRun Schema
```typescript
interface TestRun {
  id?: number;           // Auto-increment primary key
  project_id: number;    // Foreign key to Project
  status: string;        // 'pending' | 'running' | 'completed' | 'failed'
  start_time: string;    // ISO timestamp
  end_time?: string;     // ISO timestamp (optional)
  total_steps: number;   // Number of steps executed
  passed_steps: number;  // Successful steps
  failed_steps: number;  // Failed steps
  test_results: any[];   // Array of step results
  logs: string;          // Execution log text
}
```

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Browser IndexedDB** → Low-level storage operations
- **Background Service** → Routes messages, manages DB lifecycle

### Dependents (Provides To)
- **Dashboard UI** ← Project list, stats queries
- **Recorder UI** ← Step persistence, project metadata
- **Field Mapper UI** ← Field mappings, CSV data
- **Test Runner UI** ← Test run CRUD, history queries
- **All Extension Pages** ← Unified storage interface

### Communication Mechanisms
- **chrome.runtime.sendMessage**: Async message passing from UI → Background
- **sendResponse callback**: Return data from Background → UI
- **Dexie Promises**: Async DB operations with error handling

## 6. Internal Structure

### Dexie Wrapper (`src/common/services/indexedDB.ts`)

#### Class Structure
```typescript
class ProjectDB extends Dexie {
  public projects!: Table<Project, number>;
  public testRuns!: Table<TestRun, number>;
  
  constructor() {
    super("ProjectDatabase");
    this.version(1).stores({
      projects: "++id, name, description, target_url, status, created_date, updated_date, recorded_steps, parsed_fields, csv_data",
      testRuns: "++id, project_id, status, start_time, end_time, total_steps, passed_steps, failed_steps"
    });
  }
}

export const DB = new ProjectDB();
```

#### Public Methods

**Project Operations**:
- `addProject(project: Project): Promise<number>` - Insert new project
- `updateProject(id: number, updates: Partial<Project>): Promise<number>` - Update existing
- `getAllProjects(): Promise<Project[]>` - List all projects
- `deleteProject(projectId: number): Promise<void>` - Delete by ID
- Direct access: `DB.projects.get(id)`, `DB.projects.where(...).toArray()`

**Test Run Operations**:
- `createTestRun(run: TestRun): Promise<number>` - Insert new test run
- `updateTestRun(id: number, updates: Partial<TestRun>): Promise<number>` - Update existing
- `getTestRunsByProject(projectId: number): Promise<TestRun[]>` - Query by project

### Background Message Handlers (`src/background/background.ts`)

#### Message Routing (lines 15-270)
Each storage action has a dedicated handler:

**Project Handlers**:
```typescript
if (message.action === "add_project") {
  const newProject = {
    ...message.payload,
    recorded_steps: [],
    parsed_fields: [],
    csv_data: []
  };
  DB.addProject(newProject)
    .then(id => sendResponse({ success: true, id }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true;  // Keep message channel open for async response
}
```

**Pattern**: All handlers follow:
1. Extract payload from message
2. Call DB method
3. Send success/failure response
4. Return `true` to keep channel open

### Data Flow Diagram

```
UI Component (Dashboard, Recorder, etc.)
  ↓ chrome.runtime.sendMessage({ action, payload })
Background Script (background.ts)
  ↓ Parse action
  ↓ Route to handler
  ↓ DB.projects.method() or DB.testRuns.method()
Dexie Wrapper (indexedDB.ts)
  ↓ Dexie API calls
IndexedDB (Browser Storage)
  ↓ Read/Write data
Dexie Wrapper
  ↓ Return Promise<result>
Background Script
  ↓ sendResponse({ success, data })
UI Component
  ↓ Update state with data
```

## 7. Complexity Assessment

**Complexity Rating**: 🟢 **LOW-MEDIUM** (4/10)

### Why Complexity Exists

1. **Async Messaging**: Message passing introduces timing complexity (sendResponse, return true)
2. **Error Handling**: Must handle DB errors, message failures, serialization issues
3. **Data Validation**: No schema validation layer (relies on TypeScript types)
4. **Migration Management**: Version changes require careful schema updates
5. **Large Arrays**: recorded_steps[], csv_data[] can grow large, no pagination

### Risks

1. **No Schema Validation**: Invalid data can be written (e.g., missing required fields)
2. **No Migration Strategy**: Upgrading from version 1 to 2 requires manual planning
3. **Message Channel Races**: Async responses may arrive out of order
4. **Large Object Serialization**: Chrome message size limit (64MB) could be exceeded
5. **No Caching**: Repeated getAllProjects() calls re-query DB each time
6. **No Transactions**: Multiple operations not grouped (e.g., create project + first step)
7. **Unused chrome.storage**: Chrome storage API present but not utilized

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Add Storage Abstraction Interface**:
   ```typescript
   interface IStorageProvider {
     projects: IProjectRepository;
     testRuns: ITestRunRepository;
   }
   
   interface IProjectRepository {
     create(project: Omit<Project, 'id'>): Promise<number>;
     update(id: number, updates: Partial<Project>): Promise<void>;
     get(id: number): Promise<Project | null>;
     list(): Promise<Project[]>;
     delete(id: number): Promise<void>;
   }
   ```

2. **Implement Providers**:
   - `DexieStorageProvider` (current implementation)
   - `ChromeStorageProvider` (for small data, sync across devices)
   - `InMemoryProvider` (for testing)

3. **Add Validation Layer**:
   ```typescript
   class ProjectValidator {
     static validate(project: Partial<Project>): ValidationResult {
       if (!project.name) return { valid: false, error: "Name required" };
       if (!project.target_url) return { valid: false, error: "URL required" };
       // ... more checks
       return { valid: true };
     }
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Add Migration System**:
   ```typescript
   this.version(2).stores({
     projects: "++id, name, ..., tags",  // Add tags field
   }).upgrade(trans => {
     return trans.projects.toCollection().modify(proj => {
       proj.tags = [];  // Initialize new field
     });
   });
   ```

5. **Implement Pagination**:
   - Add `list(offset, limit)` methods
   - Return `{ items: [], total: number, hasMore: boolean }`
   - UI implements infinite scroll or page buttons

6. **Add Caching Layer**:
   - Cache recently accessed projects in memory
   - Invalidate on write operations
   - Reduce DB queries for frequently accessed data

7. **Batch Operations**:
   ```typescript
   interface IBatchStorage {
     batch(operations: StorageOperation[]): Promise<BatchResult>;
   }
   ```

8. **Add Telemetry**:
   - Track DB operation latency
   - Monitor storage quota usage
   - Alert on quota approaching limit

**Complexity Reduction Target**: Low (3/10) after refactoring

### Key Improvements from Refactoring

- **Testability**: Mock storage providers for unit tests
- **Portability**: Swap IndexedDB for chrome.storage or remote backend
- **Reliability**: Schema validation prevents corrupt data
- **Performance**: Caching reduces redundant queries
- **Scalability**: Pagination handles large datasets
- **Maintainability**: Clear interfaces, easier to extend
