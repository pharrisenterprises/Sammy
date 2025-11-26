# Data Access Patterns
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Repository Pattern
3. Project Repository
4. TestRun Repository
5. Message-Based Access
6. Caching Strategies
7. Batch Operations
8. Query Builder Patterns
9. Data Validation
10. Error Handling Patterns
11. Testing Strategies
12. Future: Sync Adapter

---

## 1. Overview

### 1.1 Purpose

This document defines the data access patterns used throughout the extension. It establishes consistent patterns for CRUD operations, caching, validation, and error handling to ensure reliable and maintainable data access.

### 1.2 Access Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DATA ACCESS LAYERS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      UI COMPONENTS                              │    │
│  │          (Dashboard, Recorder, Mapper, Runner)                  │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                   Uses helper functions                                 │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     STORAGE CLIENT                              │    │
│  │              - Type-safe wrapper functions                      │    │
│  │              - Promise-based API                                │    │
│  │              - Error normalization                              │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                 chrome.runtime.sendMessage                              │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   BACKGROUND SERVICE                            │    │
│  │              - Message routing                                  │    │
│  │              - Action handlers                                  │    │
│  │              - Response formatting                              │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                  Direct method calls                                    │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   REPOSITORY LAYER                              │    │
│  │              - ProjectRepository                                │    │
│  │              - TestRunRepository                                │    │
│  │              - Validation logic                                 │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                    Dexie API calls                                      │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   DEXIE / INDEXEDDB                             │    │
│  │              - Table operations                                 │    │
│  │              - Index queries                                    │    │
│  │              - Transactions                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA ACCESS PRINCIPLES                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SINGLE RESPONSIBILITY                                               │
│     - Each repository handles one entity type                           │
│     - Clear separation between read and write operations                │
│                                                                         │
│  2. DEPENDENCY INVERSION                                                │
│     - UI depends on abstract storage interface                          │
│     - Easy to swap IndexedDB for Supabase later                         │
│                                                                         │
│  3. FAIL-SAFE OPERATIONS                                                │
│     - All operations return typed results                               │
│     - Errors are caught and normalized                                  │
│     - Never throw from data layer                                       │
│                                                                         │
│  4. VALIDATION AT BOUNDARY                                              │
│     - Validate data before write operations                             │
│     - Sanitize data on read if needed                                   │
│                                                                         │
│  5. OPTIMISTIC UPDATES                                                  │
│     - UI updates immediately                                            │
│     - Background syncs and handles conflicts                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Pattern

### 2.1 Repository Interface

```typescript
// Base repository interface
interface IRepository<T, ID> {
  // Create
  create(entity: Omit<T, 'id'>): Promise<Result<ID>>;
  
  // Read
  get(id: ID): Promise<Result<T | null>>;
  getAll(): Promise<Result<T[]>>;
  
  // Update
  update(id: ID, updates: Partial<T>): Promise<Result<void>>;
  
  // Delete
  delete(id: ID): Promise<Result<void>>;
  
  // Query
  find(predicate: (entity: T) => boolean): Promise<Result<T[]>>;
  count(): Promise<Result<number>>;
}

// Result type for safe error handling
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: StorageError };

interface StorageError {
  code: StorageErrorCode;
  message: string;
  details?: any;
}

enum StorageErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONSTRAINT_ERROR = 'CONSTRAINT_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  UNKNOWN = 'UNKNOWN'
}
```

### 2.2 Base Repository Implementation

```typescript
abstract class BaseRepository<T extends { id?: number }, ID = number> 
  implements IRepository<T, ID> {
  
  protected abstract table: Dexie.Table<T, ID>;
  protected abstract entityName: string;
  
  async create(entity: Omit<T, 'id'>): Promise<Result<ID>> {
    try {
      const id = await this.table.add(entity as T);
      return { success: true, data: id as ID };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async get(id: ID): Promise<Result<T | null>> {
    try {
      const entity = await this.table.get(id);
      return { success: true, data: entity || null };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async getAll(): Promise<Result<T[]>> {
    try {
      const entities = await this.table.toArray();
      return { success: true, data: entities };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async update(id: ID, updates: Partial<T>): Promise<Result<void>> {
    try {
      const count = await this.table.update(id as any, updates);
      if (count === 0) {
        return {
          success: false,
          error: {
            code: StorageErrorCode.NOT_FOUND,
            message: `${this.entityName} with id ${id} not found`
          }
        };
      }
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async delete(id: ID): Promise<Result<void>> {
    try {
      await this.table.delete(id as any);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async find(predicate: (entity: T) => boolean): Promise<Result<T[]>> {
    try {
      const entities = await this.table.filter(predicate).toArray();
      return { success: true, data: entities };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async count(): Promise<Result<number>> {
    try {
      const count = await this.table.count();
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  protected normalizeError(error: unknown): StorageError {
    if (error instanceof Error) {
      // Dexie-specific errors
      if (error.name === 'QuotaExceededError') {
        return {
          code: StorageErrorCode.QUOTA_EXCEEDED,
          message: 'Storage quota exceeded',
          details: error.message
        };
      }
      if (error.name === 'ConstraintError') {
        return {
          code: StorageErrorCode.CONSTRAINT_ERROR,
          message: 'Constraint violation',
          details: error.message
        };
      }
      return {
        code: StorageErrorCode.UNKNOWN,
        message: error.message,
        details: error.stack
      };
    }
    return {
      code: StorageErrorCode.UNKNOWN,
      message: 'Unknown error occurred'
    };
  }
}
```

---

## 3. Project Repository

### 3.1 Interface Definition

```typescript
interface IProjectRepository extends IRepository<Project, number> {
  // Extended queries
  getByStatus(status: ProjectStatus): Promise<Result<Project[]>>;
  getRecent(limit: number): Promise<Result<Project[]>>;
  search(query: string): Promise<Result<Project[]>>;
  
  // Specialized updates
  updateSteps(id: number, steps: RecordedStep[]): Promise<Result<void>>;
  updateFields(id: number, fields: FieldMapping[]): Promise<Result<void>>;
  updateCsvData(id: number, csvData: Record<string, string>[]): Promise<Result<void>>;
  
  // Statistics
  getStats(): Promise<Result<ProjectStats>>;
}

interface ProjectStats {
  total: number;
  byStatus: Record<ProjectStatus, number>;
  totalSteps: number;
  averageStepsPerProject: number;
}
```

### 3.2 Implementation

```typescript
class ProjectRepository extends BaseRepository<Project, number> 
  implements IProjectRepository {
  
  protected table = DB.projects;
  protected entityName = 'Project';
  
  // Override create to add defaults
  async create(project: Omit<Project, 'id'>): Promise<Result<number>> {
    const now = Date.now();
    const fullProject: Omit<Project, 'id'> = {
      ...project,
      status: project.status || 'draft',
      created_date: now,
      updated_date: now,
      recorded_steps: project.recorded_steps || [],
      parsed_fields: project.parsed_fields || [],
      csv_data: project.csv_data || []
    };
    
    return super.create(fullProject);
  }
  
  // Override update to set updated_date
  async update(id: number, updates: Partial<Project>): Promise<Result<void>> {
    return super.update(id, {
      ...updates,
      updated_date: Date.now()
    });
  }
  
  // Extended queries
  async getByStatus(status: ProjectStatus): Promise<Result<Project[]>> {
    try {
      const projects = await this.table
        .where('status')
        .equals(status)
        .toArray();
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async getRecent(limit: number): Promise<Result<Project[]>> {
    try {
      const projects = await this.table
        .orderBy('updated_date')
        .reverse()
        .limit(limit)
        .toArray();
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async search(query: string): Promise<Result<Project[]>> {
    try {
      const lowerQuery = query.toLowerCase();
      const projects = await this.table
        .filter(p => 
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery) ||
          p.target_url.toLowerCase().includes(lowerQuery)
        )
        .toArray();
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  // Specialized updates
  async updateSteps(id: number, steps: RecordedStep[]): Promise<Result<void>> {
    return this.update(id, { recorded_steps: steps });
  }
  
  async updateFields(id: number, fields: FieldMapping[]): Promise<Result<void>> {
    return this.update(id, { parsed_fields: fields });
  }
  
  async updateCsvData(
    id: number, 
    csvData: Record<string, string>[]
  ): Promise<Result<void>> {
    return this.update(id, { csv_data: csvData });
  }
  
  // Statistics
  async getStats(): Promise<Result<ProjectStats>> {
    try {
      const projects = await this.table.toArray();
      
      const byStatus: Record<ProjectStatus, number> = {
        draft: 0,
        testing: 0,
        complete: 0
      };
      
      let totalSteps = 0;
      
      for (const project of projects) {
        byStatus[project.status as ProjectStatus]++;
        totalSteps += project.recorded_steps?.length || 0;
      }
      
      return {
        success: true,
        data: {
          total: projects.length,
          byStatus,
          totalSteps,
          averageStepsPerProject: projects.length > 0 
            ? totalSteps / projects.length 
            : 0
        }
      };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
}

// Singleton instance
export const projectRepository = new ProjectRepository();
```

---

## 4. TestRun Repository

### 4.1 Interface Definition

```typescript
interface ITestRunRepository extends IRepository<TestRun, number> {
  // Queries by project
  getByProject(projectId: number): Promise<Result<TestRun[]>>;
  getLatestByProject(projectId: number): Promise<Result<TestRun | null>>;
  
  // Queries by status
  getByStatus(status: TestRunStatus): Promise<Result<TestRun[]>>;
  getRunning(): Promise<Result<TestRun[]>>;
  
  // Statistics
  getProjectStats(projectId: number): Promise<Result<TestRunStats>>;
  
  // Cleanup
  deleteByProject(projectId: number): Promise<Result<number>>;
  deleteOlderThan(date: Date): Promise<Result<number>>;
}

interface TestRunStats {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  averageDuration: number;
  successRate: number;
  lastRunDate: string | null;
}
```

### 4.2 Implementation

```typescript
class TestRunRepository extends BaseRepository<TestRun, number>
  implements ITestRunRepository {
  
  protected table = DB.testRuns;
  protected entityName = 'TestRun';
  
  // Override create to set defaults
  async create(run: Omit<TestRun, 'id'>): Promise<Result<number>> {
    const fullRun: Omit<TestRun, 'id'> = {
      ...run,
      status: run.status || 'pending',
      start_time: run.start_time || new Date().toISOString(),
      total_steps: run.total_steps || 0,
      passed_steps: run.passed_steps || 0,
      failed_steps: run.failed_steps || 0,
      test_results: run.test_results || [],
      logs: run.logs || ''
    };
    
    return super.create(fullRun);
  }
  
  // Queries by project
  async getByProject(projectId: number): Promise<Result<TestRun[]>> {
    try {
      const runs = await this.table
        .where('project_id')
        .equals(projectId)
        .reverse()
        .sortBy('start_time');
      return { success: true, data: runs };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async getLatestByProject(projectId: number): Promise<Result<TestRun | null>> {
    try {
      const runs = await this.table
        .where('project_id')
        .equals(projectId)
        .reverse()
        .sortBy('start_time');
      return { success: true, data: runs[0] || null };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  // Queries by status
  async getByStatus(status: TestRunStatus): Promise<Result<TestRun[]>> {
    try {
      const runs = await this.table
        .where('status')
        .equals(status)
        .toArray();
      return { success: true, data: runs };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async getRunning(): Promise<Result<TestRun[]>> {
    return this.getByStatus('running');
  }
  
  // Statistics
  async getProjectStats(projectId: number): Promise<Result<TestRunStats>> {
    try {
      const runs = await this.table
        .where('project_id')
        .equals(projectId)
        .toArray();
      
      if (runs.length === 0) {
        return {
          success: true,
          data: {
            totalRuns: 0,
            passedRuns: 0,
            failedRuns: 0,
            averageDuration: 0,
            successRate: 0,
            lastRunDate: null
          }
        };
      }
      
      let passedRuns = 0;
      let failedRuns = 0;
      let totalDuration = 0;
      
      for (const run of runs) {
        if (run.status === 'completed' && run.failed_steps === 0) {
          passedRuns++;
        } else if (run.status === 'failed' || run.failed_steps > 0) {
          failedRuns++;
        }
        
        if (run.start_time && run.end_time) {
          const start = new Date(run.start_time).getTime();
          const end = new Date(run.end_time).getTime();
          totalDuration += end - start;
        }
      }
      
      const sortedRuns = [...runs].sort((a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
      
      return {
        success: true,
        data: {
          totalRuns: runs.length,
          passedRuns,
          failedRuns,
          averageDuration: totalDuration / runs.length,
          successRate: runs.length > 0 ? (passedRuns / runs.length) * 100 : 0,
          lastRunDate: sortedRuns[0]?.start_time || null
        }
      };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  // Cleanup
  async deleteByProject(projectId: number): Promise<Result<number>> {
    try {
      const count = await this.table
        .where('project_id')
        .equals(projectId)
        .delete();
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
  
  async deleteOlderThan(date: Date): Promise<Result<number>> {
    try {
      const isoDate = date.toISOString();
      const count = await this.table
        .where('start_time')
        .below(isoDate)
        .delete();
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
}

// Singleton instance
export const testRunRepository = new TestRunRepository();
```

---

## 5. Message-Based Access

### 5.1 Storage Client

```typescript
// Client-side storage access via messages
class StorageClient {
  private sendMessage<T>(
    action: string,
    payload?: any
  ): Promise<Result<T>> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: {
              code: StorageErrorCode.UNKNOWN,
              message: chrome.runtime.lastError.message || 'Message failed'
            }
          });
          return;
        }
        
        if (response.success) {
          resolve({
            success: true,
            data: response.data ?? response.id ?? response.project
          });
        } else {
          resolve({
            success: false,
            error: {
              code: StorageErrorCode.UNKNOWN,
              message: response.error || 'Operation failed'
            }
          });
        }
      });
    });
  }
  
  // Project operations
  projects = {
    create: (project: Omit<Project, 'id'>) =>
      this.sendMessage<number>('add_project', project),
    
    get: (id: number) =>
      this.sendMessage<Project | null>('get_project_by_id', { id }),
    
    getAll: () =>
      this.sendMessage<Project[]>('get_all_projects'),
    
    update: (id: number, updates: Partial<Project>) =>
      this.sendMessage<void>('update_project', { id, ...updates }),
    
    delete: (id: number) =>
      this.sendMessage<void>('delete_project', { id }),
    
    updateSteps: (projectId: number, steps: RecordedStep[]) =>
      this.sendMessage<void>('update_project_steps', { projectId, steps }),
    
    updateFields: (projectId: number, fields: FieldMapping[]) =>
      this.sendMessage<void>('update_project_fields', { projectId, fields }),
    
    updateCsvData: (projectId: number, csvData: Record<string, string>[]) =>
      this.sendMessage<void>('update_project_csv', { projectId, csvData })
  };
  
  // TestRun operations
  testRuns = {
    create: (run: Omit<TestRun, 'id'>) =>
      this.sendMessage<number>('createTestRun', run),
    
    update: (id: number, updates: Partial<TestRun>) =>
      this.sendMessage<void>('updateTestRun', { id, ...updates }),
    
    getByProject: (projectId: number) =>
      this.sendMessage<TestRun[]>('getTestRunsByProject', { projectId })
  };
}

// Singleton instance
export const storage = new StorageClient();
```

### 5.2 Usage in Components

```typescript
// React component usage example
function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadProjects();
  }, []);
  
  async function loadProjects() {
    setLoading(true);
    setError(null);
    
    const result = await storage.projects.getAll();
    
    if (result.success) {
      setProjects(result.data);
    } else {
      setError(result.error.message);
    }
    
    setLoading(false);
  }
  
  async function createProject(name: string, url: string) {
    const result = await storage.projects.create({
      name,
      description: '',
      target_url: url,
      status: 'draft',
      created_date: Date.now(),
      updated_date: Date.now()
    });
    
    if (result.success) {
      await loadProjects(); // Refresh list
      return result.data; // Return new ID
    } else {
      setError(result.error.message);
      return null;
    }
  }
  
  async function deleteProject(id: number) {
    const result = await storage.projects.delete(id);
    
    if (result.success) {
      setProjects(projects.filter(p => p.id !== id));
    } else {
      setError(result.error.message);
    }
  }
  
  // ... render
}
```

---

## 6. Caching Strategies

### 6.1 In-Memory Cache

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private defaultTtl: number;
  
  constructor(defaultTtl: number = 60000) { // 1 minute default
    this.defaultTtl = defaultTtl;
  }
  
  get(key: K): V | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: K, value: V, ttl?: number): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl
    });
  }
  
  invalidate(key: K): void {
    this.cache.delete(key);
  }
  
  invalidateAll(): void {
    this.cache.clear();
  }
  
  invalidateMatching(predicate: (key: K) => boolean): void {
    for (const key of this.cache.keys()) {
      if (predicate(key)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 6.2 Cached Repository

```typescript
class CachedProjectRepository implements IProjectRepository {
  private repository: ProjectRepository;
  private cache: MemoryCache<string, any>;
  
  constructor(repository: ProjectRepository) {
    this.repository = repository;
    this.cache = new MemoryCache(60000); // 1 minute TTL
  }
  
  async get(id: number): Promise<Result<Project | null>> {
    const cacheKey = `project:${id}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return { success: true, data: cached };
    }
    
    const result = await this.repository.get(id);
    
    if (result.success && result.data) {
      this.cache.set(cacheKey, result.data);
    }
    
    return result;
  }
  
  async getAll(): Promise<Result<Project[]>> {
    const cacheKey = 'projects:all';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return { success: true, data: cached };
    }
    
    const result = await this.repository.getAll();
    
    if (result.success) {
      this.cache.set(cacheKey, result.data);
    }
    
    return result;
  }
  
  async create(project: Omit<Project, 'id'>): Promise<Result<number>> {
    const result = await this.repository.create(project);
    
    if (result.success) {
      this.cache.invalidate('projects:all');
    }
    
    return result;
  }
  
  async update(id: number, updates: Partial<Project>): Promise<Result<void>> {
    const result = await this.repository.update(id, updates);
    
    if (result.success) {
      this.cache.invalidate(`project:${id}`);
      this.cache.invalidate('projects:all');
    }
    
    return result;
  }
  
  async delete(id: number): Promise<Result<void>> {
    const result = await this.repository.delete(id);
    
    if (result.success) {
      this.cache.invalidate(`project:${id}`);
      this.cache.invalidate('projects:all');
    }
    
    return result;
  }
  
  // Delegate other methods...
  async getByStatus(status: ProjectStatus) {
    return this.repository.getByStatus(status);
  }
  
  // ... etc
}
```

### 6.3 Cache Invalidation Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   CACHE INVALIDATION RULES                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Operation         │ Invalidate                                         │
│  ──────────────────┼──────────────────────────────────────────────      │
│  create(project)   │ 'projects:all'                                     │
│  update(id, ...)   │ 'project:{id}', 'projects:all'                     │
│  delete(id)        │ 'project:{id}', 'projects:all'                     │
│  updateSteps(...)  │ 'project:{id}'                                     │
│                                                                         │
│  TTL Strategy:                                                          │
│  ├── Single project: 60 seconds                                         │
│  ├── Project list: 30 seconds                                           │
│  └── Statistics: 120 seconds                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Batch Operations

### 7.1 Bulk Insert

```typescript
async function bulkCreateProjects(
  projects: Omit<Project, 'id'>[]
): Promise<Result<number[]>> {
  try {
    const ids = await DB.projects.bulkAdd(projects as Project[], {
      allKeys: true
    });
    return { success: true, data: ids as number[] };
  } catch (error) {
    return {
      success: false,
      error: {
        code: StorageErrorCode.UNKNOWN,
        message: error instanceof Error ? error.message : 'Bulk insert failed'
      }
    };
  }
}
```

### 7.2 Bulk Update

```typescript
async function bulkUpdateProjects(
  updates: Array<{ id: number; changes: Partial<Project> }>
): Promise<Result<number>> {
  try {
    let updatedCount = 0;
    
    await DB.transaction('rw', DB.projects, async () => {
      for (const { id, changes } of updates) {
        const count = await DB.projects.update(id, {
          ...changes,
          updated_date: Date.now()
        });
        updatedCount += count;
      }
    });
    
    return { success: true, data: updatedCount };
  } catch (error) {
    return {
      success: false,
      error: {
        code: StorageErrorCode.TRANSACTION_ERROR,
        message: error instanceof Error ? error.message : 'Bulk update failed'
      }
    };
  }
}
```

### 7.3 Bulk Delete

```typescript
async function bulkDeleteProjects(ids: number[]): Promise<Result<number>> {
  try {
    await DB.transaction('rw', DB.projects, DB.testRuns, async () => {
      // Delete related test runs first
      for (const id of ids) {
        await DB.testRuns.where('project_id').equals(id).delete();
      }
      
      // Delete projects
      await DB.projects.bulkDelete(ids);
    });
    
    return { success: true, data: ids.length };
  } catch (error) {
    return {
      success: false,
      error: {
        code: StorageErrorCode.TRANSACTION_ERROR,
        message: error instanceof Error ? error.message : 'Bulk delete failed'
      }
    };
  }
}
```

---

## 8. Query Builder Patterns

### 8.1 Fluent Query Builder

```typescript
class ProjectQueryBuilder {
  private query: Dexie.Collection<Project, number>;
  
  constructor() {
    this.query = DB.projects.toCollection();
  }
  
  whereStatus(status: ProjectStatus): this {
    this.query = DB.projects.where('status').equals(status);
    return this;
  }
  
  whereCreatedAfter(date: Date): this {
    const timestamp = date.getTime();
    this.query = this.query.and(p => p.created_date > timestamp);
    return this;
  }
  
  whereNameContains(text: string): this {
    const lower = text.toLowerCase();
    this.query = this.query.and(p => 
      p.name.toLowerCase().includes(lower)
    );
    return this;
  }
  
  orderByUpdated(direction: 'asc' | 'desc' = 'desc'): this {
    if (direction === 'desc') {
      this.query = this.query.reverse();
    }
    return this;
  }
  
  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }
  
  offset(count: number): this {
    this.query = this.query.offset(count);
    return this;
  }
  
  async execute(): Promise<Result<Project[]>> {
    try {
      const results = await this.query.toArray();
      return { success: true, data: results };
    } catch (error) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : 'Query failed'
        }
      };
    }
  }
  
  async count(): Promise<Result<number>> {
    try {
      const count = await this.query.count();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : 'Count failed'
        }
      };
    }
  }
}

// Usage
const result = await new ProjectQueryBuilder()
  .whereStatus('draft')
  .whereCreatedAfter(new Date('2024-01-01'))
  .orderByUpdated('desc')
  .limit(10)
  .execute();
```

---

## 9. Data Validation

### 9.1 Validation Schema

```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().default(''),
  target_url: z.string().url('Invalid URL format'),
  status: z.enum(['draft', 'testing', 'complete']).default('draft'),
  recorded_steps: z.array(z.any()).optional().default([]),
  parsed_fields: z.array(z.any()).optional().default([]),
  csv_data: z.array(z.record(z.string())).optional().default([])
});

const TestRunSchema = z.object({
  project_id: z.number().positive('Invalid project ID'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  total_steps: z.number().nonnegative().default(0),
  passed_steps: z.number().nonnegative().default(0),
  failed_steps: z.number().nonnegative().default(0),
  test_results: z.array(z.any()).default([]),
  logs: z.string().default('')
});
```

### 9.2 Validation Helper

```typescript
interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

function validateProject(
  data: unknown
): ValidationResult<Omit<Project, 'id'>> {
  const result = ProjectSchema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    )
  };
}

function validateTestRun(
  data: unknown
): ValidationResult<Omit<TestRun, 'id'>> {
  const result = TestRunSchema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  return {
    valid: false,
    errors: result.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    )
  };
}
```

### 9.3 Validated Repository

```typescript
class ValidatedProjectRepository implements IProjectRepository {
  private repository: ProjectRepository;
  
  constructor(repository: ProjectRepository) {
    this.repository = repository;
  }
  
  async create(project: Omit<Project, 'id'>): Promise<Result<number>> {
    const validation = validateProject(project);
    
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.VALIDATION_ERROR,
          message: validation.errors?.join(', ') || 'Validation failed'
        }
      };
    }
    
    return this.repository.create(validation.data!);
  }
  
  async update(id: number, updates: Partial<Project>): Promise<Result<void>> {
    // Partial validation for updates
    if (updates.name !== undefined && updates.name.length === 0) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.VALIDATION_ERROR,
          message: 'Name cannot be empty'
        }
      };
    }
    
    if (updates.target_url !== undefined) {
      try {
        new URL(updates.target_url);
      } catch {
        return {
          success: false,
          error: {
            code: StorageErrorCode.VALIDATION_ERROR,
            message: 'Invalid URL format'
          }
        };
      }
    }
    
    return this.repository.update(id, updates);
  }
  
  // Delegate other methods...
}
```

---

## 10. Error Handling Patterns

### 10.1 Error Wrapper

```typescript
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error(`Storage error in ${context}:`, error);
    
    return {
      success: false,
      error: normalizeStorageError(error)
    };
  }
}

function normalizeStorageError(error: unknown): StorageError {
  if (error instanceof Dexie.DexieError) {
    switch (error.name) {
      case 'QuotaExceededError':
        return {
          code: StorageErrorCode.QUOTA_EXCEEDED,
          message: 'Storage quota exceeded. Please delete some data.',
          details: error.message
        };
      case 'ConstraintError':
        return {
          code: StorageErrorCode.CONSTRAINT_ERROR,
          message: 'Data constraint violated.',
          details: error.message
        };
      case 'NotFoundError':
        return {
          code: StorageErrorCode.NOT_FOUND,
          message: 'Record not found.',
          details: error.message
        };
      default:
        return {
          code: StorageErrorCode.UNKNOWN,
          message: error.message,
          details: error.stack
        };
    }
  }
  
  if (error instanceof Error) {
    return {
      code: StorageErrorCode.UNKNOWN,
      message: error.message,
      details: error.stack
    };
  }
  
  return {
    code: StorageErrorCode.UNKNOWN,
    message: 'An unknown error occurred'
  };
}
```

### 10.2 Retry Pattern

```typescript
async function withRetry<T>(
  operation: () => Promise<Result<T>>,
  maxRetries: number = 3,
  delay: number = 100
): Promise<Result<T>> {
  let lastError: StorageError | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await operation();
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error;
    
    // Don't retry validation errors
    if (result.error.code === StorageErrorCode.VALIDATION_ERROR) {
      return result;
    }
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  
  return {
    success: false,
    error: lastError || {
      code: StorageErrorCode.UNKNOWN,
      message: 'Operation failed after retries'
    }
  };
}
```

---

## 11. Testing Strategies

### 11.1 Mock Repository

```typescript
class MockProjectRepository implements IProjectRepository {
  private projects: Map<number, Project> = new Map();
  private nextId = 1;
  
  async create(project: Omit<Project, 'id'>): Promise<Result<number>> {
    const id = this.nextId++;
    this.projects.set(id, { ...project, id } as Project);
    return { success: true, data: id };
  }
  
  async get(id: number): Promise<Result<Project | null>> {
    return { success: true, data: this.projects.get(id) || null };
  }
  
  async getAll(): Promise<Result<Project[]>> {
    return { success: true, data: Array.from(this.projects.values()) };
  }
  
  async update(id: number, updates: Partial<Project>): Promise<Result<void>> {
    const project = this.projects.get(id);
    if (!project) {
      return {
        success: false,
        error: { code: StorageErrorCode.NOT_FOUND, message: 'Not found' }
      };
    }
    this.projects.set(id, { ...project, ...updates });
    return { success: true, data: undefined };
  }
  
  async delete(id: number): Promise<Result<void>> {
    this.projects.delete(id);
    return { success: true, data: undefined };
  }
  
  // ... implement other methods
}
```

### 11.2 Test Utilities

```typescript
// Test helper to set up database state
async function setupTestData(data: {
  projects?: Omit<Project, 'id'>[];
  testRuns?: Omit<TestRun, 'id'>[];
}): Promise<{ projectIds: number[]; testRunIds: number[] }> {
  await DB.projects.clear();
  await DB.testRuns.clear();
  
  const projectIds: number[] = [];
  const testRunIds: number[] = [];
  
  if (data.projects) {
    for (const project of data.projects) {
      const id = await DB.projects.add(project as Project);
      projectIds.push(id);
    }
  }
  
  if (data.testRuns) {
    for (const run of data.testRuns) {
      const id = await DB.testRuns.add(run as TestRun);
      testRunIds.push(id);
    }
  }
  
  return { projectIds, testRunIds };
}

// Example test
describe('ProjectRepository', () => {
  beforeEach(async () => {
    await DB.projects.clear();
  });
  
  test('create should return new ID', async () => {
    const result = await projectRepository.create({
      name: 'Test Project',
      description: '',
      target_url: 'https://example.com',
      status: 'draft',
      created_date: Date.now(),
      updated_date: Date.now()
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeGreaterThan(0);
  });
  
  test('get should return project by ID', async () => {
    const { projectIds } = await setupTestData({
      projects: [{ name: 'Test', description: '', target_url: 'https://example.com', status: 'draft', created_date: Date.now(), updated_date: Date.now() }]
    });
    
    const result = await projectRepository.get(projectIds[0]);
    
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Test');
  });
});
```

---

## 12. Future: Sync Adapter

### 12.1 Sync Interface (Phase 2)

```typescript
interface ISyncAdapter {
  // Push local changes to remote
  push(changes: SyncChange[]): Promise<Result<SyncResult>>;
  
  // Pull remote changes
  pull(since: Date): Promise<Result<SyncChange[]>>;
  
  // Resolve conflicts
  resolveConflict(
    local: any,
    remote: any,
    strategy: ConflictStrategy
  ): Promise<Result<any>>;
}

interface SyncChange {
  entityType: 'project' | 'testRun';
  entityId: number;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: Date;
  localId?: number;
  remoteId?: string;
}

interface SyncResult {
  pushed: number;
  conflicts: number;
  errors: string[];
}

type ConflictStrategy = 'local_wins' | 'remote_wins' | 'merge' | 'manual';
```

### 12.2 Hybrid Repository (Future)

```typescript
class HybridProjectRepository implements IProjectRepository {
  private localRepo: ProjectRepository;
  private syncAdapter: ISyncAdapter;
  private syncQueue: SyncChange[] = [];
  
  async create(project: Omit<Project, 'id'>): Promise<Result<number>> {
    // Create locally first
    const result = await this.localRepo.create(project);
    
    if (result.success) {
      // Queue for sync
      this.syncQueue.push({
        entityType: 'project',
        entityId: result.data,
        operation: 'create',
        data: project,
        timestamp: new Date()
      });
      
      // Attempt sync (non-blocking)
      this.trySyncInBackground();
    }
    
    return result;
  }
  
  private async trySyncInBackground(): Promise<void> {
    if (this.syncQueue.length === 0) return;
    if (!navigator.onLine) return;
    
    try {
      const result = await this.syncAdapter.push(this.syncQueue);
      if (result.success) {
        this.syncQueue = [];
      }
    } catch (error) {
      console.warn('Background sync failed:', error);
    }
  }
}
```

---

## Summary

The Data Access Patterns document provides:

✅ Repository pattern with typed interfaces  
✅ Project and TestRun repositories with full CRUD  
✅ Message-based access for UI components  
✅ Caching strategies with TTL and invalidation  
✅ Batch operations for bulk data handling  
✅ Query builder for fluent queries  
✅ Data validation with Zod schemas  
✅ Error handling with normalization and retry  
✅ Testing utilities with mocks and helpers  
✅ Future sync adapter design for Supabase  

These patterns ensure consistent, reliable, and testable data access throughout the extension.
