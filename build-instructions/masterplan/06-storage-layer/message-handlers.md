# Storage Message Handlers
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Message Protocol
3. Handler Architecture
4. Project Handlers
5. TestRun Handlers
6. Specialized Update Handlers
7. Query Handlers
8. Error Handling
9. Response Formatting
10. Handler Registration
11. Testing Handlers
12. Future: Batch Operations

---

## 1. Overview

### 1.1 Purpose

Storage Message Handlers route all data operations from UI components through the background service worker to IndexedDB. This document specifies the complete handler implementation for all storage actions.

### 1.2 Why Message-Based Storage?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WHY MESSAGE-BASED STORAGE?                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONSTRAINT: Chrome Extension Architecture                              │
│  ├── Content scripts have limited IndexedDB access                      │
│  ├── Popup/options pages may be destroyed mid-operation                 │
│  ├── Service worker is the only persistent context                      │
│  └── Cross-context communication requires chrome.runtime messages       │
│                                                                         │
│  SOLUTION: Centralized Storage in Background                            │
│  ├── Background script owns the database connection                     │
│  ├── All contexts send messages to background                           │
│  ├── Background performs operations and returns results                 │
│  └── Consistent error handling and logging                              │
│                                                                         │
│  BENEFITS:                                                              │
│  ├── Single source of truth                                             │
│  ├── Atomic operations guaranteed                                       │
│  ├── Centralized validation and error handling                          │
│  └── Easy to add caching, logging, sync                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Handler Location

**File:** `src/background/background.ts`  
**Lines:** 15-270 (storage handlers)

---

## 2. Message Protocol

### 2.1 Request Format

```typescript
interface StorageRequest {
  action: StorageAction;
  payload?: any;
}

type StorageAction =
  // Project CRUD
  | 'add_project'
  | 'update_project'
  | 'get_all_projects'
  | 'delete_project'
  | 'get_project_by_id'
  
  // Specialized Project Updates
  | 'update_project_steps'
  | 'update_project_fields'
  | 'update_project_csv'
  
  // TestRun CRUD
  | 'createTestRun'
  | 'updateTestRun'
  | 'getTestRunsByProject'
  
  // Future: Query Operations
  | 'query_projects'
  | 'get_project_stats';
```

### 2.2 Response Format

```typescript
interface StorageResponse {
  success: boolean;
  
  // Data field (for read operations)
  data?: any;
  
  // ID field (for create operations)
  id?: number;
  
  // Project field (for get_project_by_id)
  project?: Project;
  
  // Error field (for failures)
  error?: string;
}
```

### 2.3 Message Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MESSAGE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  UI Component (Popup, Dashboard, etc.)                                  │
│       │                                                                 │
│       │ chrome.runtime.sendMessage({                                    │
│       │   action: 'add_project',                                        │
│       │   payload: { name: 'My Project', ... }                          │
│       │ }, callback)                                                    │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  chrome.runtime.onMessage.addListener((message, sender, send)) │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Handler Selection (if/else chain on message.action)            │    │
│  │                                                                 │    │
│  │  if (message.action === 'add_project') {                        │    │
│  │    // Handle add_project                                        │    │
│  │  } else if (message.action === 'update_project') {              │    │
│  │    // Handle update_project                                     │    │
│  │  } // ... etc                                                   │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Database Operation (via Dexie)                                 │    │
│  │                                                                 │    │
│  │  DB.addProject(project)                                         │    │
│  │    .then(id => sendResponse({ success: true, id }))             │    │
│  │    .catch(err => sendResponse({ success: false, error: ... }))  │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
│                              │                                          │
│                              │ return true; // CRITICAL!                │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Response delivered to callback                                 │    │
│  │                                                                 │    │
│  │  callback({ success: true, id: 42 })                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Critical: Return True Pattern

```typescript
// ❌ WRONG: Missing return true
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_all_projects') {
    DB.getAllProjects().then(data => {
      sendResponse({ success: true, data });
    });
    // BUG: Message channel closes immediately!
    // sendResponse is called after channel is closed
    // Callback never receives response
  }
});

// ✅ CORRECT: Return true to keep channel open
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_all_projects') {
    DB.getAllProjects().then(data => {
      sendResponse({ success: true, data });
    });
    return true; // Keeps message channel open for async response
  }
});
```

---

## 3. Handler Architecture

### 3.1 Main Listener Structure

```typescript
// src/background/background.ts

import { DB } from '../common/services/indexedDB';

// Main message listener
chrome.runtime.onMessage.addListener(
  (
    message: StorageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: StorageResponse) => void
  ) => {
    // Log incoming requests (debug mode)
    console.debug('[Storage] Request:', message.action, message.payload);
    
    // Route to appropriate handler
    const handled = handleStorageMessage(message, sender, sendResponse);
    
    // Return true if we're handling async
    return handled;
  }
);

function handleStorageMessage(
  message: StorageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: StorageResponse) => void
): boolean {
  switch (message.action) {
    // Project CRUD
    case 'add_project':
      return handleAddProject(message.payload, sendResponse);
    case 'update_project':
      return handleUpdateProject(message.payload, sendResponse);
    case 'get_all_projects':
      return handleGetAllProjects(sendResponse);
    case 'delete_project':
      return handleDeleteProject(message.payload, sendResponse);
    case 'get_project_by_id':
      return handleGetProjectById(message.payload, sendResponse);
    
    // Specialized Project Updates
    case 'update_project_steps':
      return handleUpdateProjectSteps(message.payload, sendResponse);
    case 'update_project_fields':
      return handleUpdateProjectFields(message.payload, sendResponse);
    case 'update_project_csv':
      return handleUpdateProjectCsv(message.payload, sendResponse);
    
    // TestRun CRUD
    case 'createTestRun':
      return handleCreateTestRun(message.payload, sendResponse);
    case 'updateTestRun':
      return handleUpdateTestRun(message.payload, sendResponse);
    case 'getTestRunsByProject':
      return handleGetTestRunsByProject(message.payload, sendResponse);
    
    default:
      // Unknown action - don't handle
      return false;
  }
}
```

### 3.2 Handler Function Signature

```typescript
type StorageHandler = (
  payload: any,
  sendResponse: (response: StorageResponse) => void
) => boolean; // Returns true to keep channel open
```

---

## 4. Project Handlers

### 4.1 Add Project Handler

```typescript
function handleAddProject(
  payload: Omit<Project, 'id'>,
  sendResponse: (response: StorageResponse) => void
): boolean {
  // Prepare project with defaults
  const newProject: Omit<Project, 'id'> = {
    name: payload.name || 'Untitled Project',
    description: payload.description || '',
    target_url: payload.target_url || '',
    status: payload.status || 'draft',
    created_date: Date.now(),
    updated_date: Date.now(),
    recorded_steps: payload.recorded_steps || [],
    parsed_fields: payload.parsed_fields || [],
    csv_data: payload.csv_data || []
  };
  
  // Validate required fields
  if (!newProject.name.trim()) {
    sendResponse({
      success: false,
      error: 'Project name is required'
    });
    return true;
  }
  
  if (!newProject.target_url.trim()) {
    sendResponse({
      success: false,
      error: 'Target URL is required'
    });
    return true;
  }
  
  // Validate URL format
  try {
    new URL(newProject.target_url);
  } catch {
    sendResponse({
      success: false,
      error: 'Invalid URL format'
    });
    return true;
  }
  
  // Perform database operation
  DB.addProject(newProject as Project)
    .then(id => {
      console.debug('[Storage] Project created with ID:', id);
      sendResponse({ success: true, id });
    })
    .catch(error => {
      console.error('[Storage] Failed to create project:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to create project'
      });
    });
  
  return true; // Async response
}
```

### 4.2 Update Project Handler

```typescript
function handleUpdateProject(
  payload: { id: number } & Partial<Project>,
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { id, ...updates } = payload;
  
  // Validate ID
  if (!id || typeof id !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  // Validate URL if provided
  if (updates.target_url) {
    try {
      new URL(updates.target_url);
    } catch {
      sendResponse({
        success: false,
        error: 'Invalid URL format'
      });
      return true;
    }
  }
  
  // Always update timestamp
  updates.updated_date = Date.now();
  
  // Perform update
  DB.updateProject(id, updates)
    .then(count => {
      if (count === 0) {
        sendResponse({
          success: false,
          error: `Project with ID ${id} not found`
        });
      } else {
        console.debug('[Storage] Project updated:', id);
        sendResponse({ success: true });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to update project:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to update project'
      });
    });
  
  return true;
}
```

### 4.3 Get All Projects Handler

```typescript
function handleGetAllProjects(
  sendResponse: (response: StorageResponse) => void
): boolean {
  DB.getAllProjects()
    .then(projects => {
      // Sort by updated_date descending (most recent first)
      projects.sort((a, b) => b.updated_date - a.updated_date);
      
      console.debug('[Storage] Retrieved', projects.length, 'projects');
      sendResponse({ success: true, data: projects });
    })
    .catch(error => {
      console.error('[Storage] Failed to get projects:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to retrieve projects'
      });
    });
  
  return true;
}
```

### 4.4 Delete Project Handler

```typescript
function handleDeleteProject(
  payload: { id: number },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { id } = payload;
  
  if (!id || typeof id !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  // Delete project and associated test runs
  DB.transaction('rw', DB.projects, DB.testRuns, async () => {
    // First delete all test runs for this project
    await DB.testRuns
      .where('project_id')
      .equals(id)
      .delete();
    
    // Then delete the project
    await DB.projects.delete(id);
  })
    .then(() => {
      console.debug('[Storage] Project deleted:', id);
      sendResponse({ success: true });
    })
    .catch(error => {
      console.error('[Storage] Failed to delete project:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to delete project'
      });
    });
  
  return true;
}
```

### 4.5 Get Project By ID Handler

```typescript
function handleGetProjectById(
  payload: { id: number },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { id } = payload;
  
  if (!id || typeof id !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  DB.projects.get(id)
    .then(project => {
      if (!project) {
        sendResponse({
          success: false,
          error: `Project with ID ${id} not found`
        });
      } else {
        // Ensure arrays are initialized (defensive)
        project.recorded_steps = project.recorded_steps || [];
        project.parsed_fields = project.parsed_fields || [];
        project.csv_data = project.csv_data || [];
        
        console.debug('[Storage] Retrieved project:', id);
        sendResponse({ success: true, project });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to get project:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to retrieve project'
      });
    });
  
  return true;
}
```

---

## 5. TestRun Handlers

### 5.1 Create TestRun Handler

```typescript
function handleCreateTestRun(
  payload: Omit<TestRun, 'id'>,
  sendResponse: (response: StorageResponse) => void
): boolean {
  // Validate project_id
  if (!payload.project_id || typeof payload.project_id !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project_id is required'
    });
    return true;
  }
  
  // Prepare test run with defaults
  const newRun: Omit<TestRun, 'id'> = {
    project_id: payload.project_id,
    status: payload.status || 'pending',
    start_time: payload.start_time || new Date().toISOString(),
    end_time: payload.end_time || undefined,
    total_steps: payload.total_steps || 0,
    passed_steps: payload.passed_steps || 0,
    failed_steps: payload.failed_steps || 0,
    test_results: payload.test_results || [],
    logs: payload.logs || ''
  };
  
  // Verify project exists
  DB.projects.get(payload.project_id)
    .then(project => {
      if (!project) {
        sendResponse({
          success: false,
          error: `Project with ID ${payload.project_id} not found`
        });
        return;
      }
      
      // Create test run
      return DB.createTestRun(newRun as TestRun);
    })
    .then(id => {
      if (id) {
        console.debug('[Storage] TestRun created with ID:', id);
        sendResponse({ success: true, id });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to create test run:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to create test run'
      });
    });
  
  return true;
}
```

### 5.2 Update TestRun Handler

```typescript
function handleUpdateTestRun(
  payload: { id: number } & Partial<TestRun>,
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { id, ...updates } = payload;
  
  if (!id || typeof id !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid test run ID is required'
    });
    return true;
  }
  
  // Validate status if provided
  const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
  if (updates.status && !validStatuses.includes(updates.status)) {
    sendResponse({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
    return true;
  }
  
  DB.updateTestRun(id, updates)
    .then(count => {
      if (count === 0) {
        sendResponse({
          success: false,
          error: `Test run with ID ${id} not found`
        });
      } else {
        console.debug('[Storage] TestRun updated:', id);
        sendResponse({ success: true });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to update test run:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to update test run'
      });
    });
  
  return true;
}
```

### 5.3 Get TestRuns By Project Handler

```typescript
function handleGetTestRunsByProject(
  payload: { projectId: number },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { projectId } = payload;
  
  if (!projectId || typeof projectId !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  DB.getTestRunsByProject(projectId)
    .then(runs => {
      // Sort by start_time descending (most recent first)
      runs.sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
      
      console.debug('[Storage] Retrieved', runs.length, 'test runs for project', projectId);
      sendResponse({ success: true, data: runs });
    })
    .catch(error => {
      console.error('[Storage] Failed to get test runs:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to retrieve test runs'
      });
    });
  
  return true;
}
```

---

## 6. Specialized Update Handlers

### 6.1 Update Project Steps Handler

```typescript
function handleUpdateProjectSteps(
  payload: { projectId: number; steps: RecordedStep[] },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { projectId, steps } = payload;
  
  if (!projectId || typeof projectId !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  if (!Array.isArray(steps)) {
    sendResponse({
      success: false,
      error: 'Steps must be an array'
    });
    return true;
  }
  
  // Validate step structure (basic checks)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.event || !step.bundle) {
      sendResponse({
        success: false,
        error: `Invalid step at index ${i}: missing event or bundle`
      });
      return true;
    }
  }
  
  DB.updateProject(projectId, {
    recorded_steps: steps,
    updated_date: Date.now()
  })
    .then(count => {
      if (count === 0) {
        sendResponse({
          success: false,
          error: `Project with ID ${projectId} not found`
        });
      } else {
        console.debug('[Storage] Updated', steps.length, 'steps for project', projectId);
        sendResponse({ success: true });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to update steps:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to update steps'
      });
    });
  
  return true;
}
```

### 6.2 Update Project Fields Handler

```typescript
function handleUpdateProjectFields(
  payload: { projectId: number; fields: FieldMapping[] },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { projectId, fields } = payload;
  
  if (!projectId || typeof projectId !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  if (!Array.isArray(fields)) {
    sendResponse({
      success: false,
      error: 'Fields must be an array'
    });
    return true;
  }
  
  // Validate field mappings
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field.csvColumn || typeof field.stepIndex !== 'number') {
      sendResponse({
        success: false,
        error: `Invalid field at index ${i}: missing csvColumn or stepIndex`
      });
      return true;
    }
  }
  
  DB.updateProject(projectId, {
    parsed_fields: fields,
    updated_date: Date.now()
  })
    .then(count => {
      if (count === 0) {
        sendResponse({
          success: false,
          error: `Project with ID ${projectId} not found`
        });
      } else {
        console.debug('[Storage] Updated', fields.length, 'field mappings for project', projectId);
        sendResponse({ success: true });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to update fields:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to update field mappings'
      });
    });
  
  return true;
}
```

### 6.3 Update Project CSV Handler

```typescript
function handleUpdateProjectCsv(
  payload: { projectId: number; csvData: Record<string, string>[] },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { projectId, csvData } = payload;
  
  if (!projectId || typeof projectId !== 'number') {
    sendResponse({
      success: false,
      error: 'Valid project ID is required'
    });
    return true;
  }
  
  if (!Array.isArray(csvData)) {
    sendResponse({
      success: false,
      error: 'CSV data must be an array'
    });
    return true;
  }
  
  // Check for oversized data
  const dataSize = JSON.stringify(csvData).length;
  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB limit
  
  if (dataSize > MAX_SIZE) {
    sendResponse({
      success: false,
      error: `CSV data too large (${Math.round(dataSize / 1024 / 1024)}MB). Maximum is 50MB.`
    });
    return true;
  }
  
  DB.updateProject(projectId, {
    csv_data: csvData,
    updated_date: Date.now()
  })
    .then(count => {
      if (count === 0) {
        sendResponse({
          success: false,
          error: `Project with ID ${projectId} not found`
        });
      } else {
        console.debug('[Storage] Updated CSV data for project', projectId, 
          '- rows:', csvData.length, '- size:', Math.round(dataSize / 1024), 'KB');
        sendResponse({ success: true });
      }
    })
    .catch(error => {
      console.error('[Storage] Failed to update CSV:', error);
      
      // Check for quota error
      if (error.name === 'QuotaExceededError') {
        sendResponse({
          success: false,
          error: 'Storage quota exceeded. Please delete some projects or reduce CSV size.'
        });
      } else {
        sendResponse({
          success: false,
          error: error.message || 'Failed to update CSV data'
        });
      }
    });
  
  return true;
}
```

---

## 7. Query Handlers

### 7.1 Query Projects Handler (Future)

```typescript
interface QueryOptions {
  status?: ProjectStatus;
  search?: string;
  orderBy?: 'name' | 'created_date' | 'updated_date';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

function handleQueryProjects(
  payload: QueryOptions,
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { status, search, orderBy, orderDir, limit, offset } = payload;
  
  let query = DB.projects.toCollection();
  
  // Filter by status
  if (status) {
    query = DB.projects.where('status').equals(status);
  }
  
  query.toArray()
    .then(projects => {
      let filtered = projects;
      
      // Search filter (not indexed, requires post-filter)
      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(lowerSearch) ||
          p.description.toLowerCase().includes(lowerSearch) ||
          p.target_url.toLowerCase().includes(lowerSearch)
        );
      }
      
      // Sort
      const sortField = orderBy || 'updated_date';
      const sortDir = orderDir || 'desc';
      
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        return sortDir === 'asc' 
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
      
      // Pagination
      const total = filtered.length;
      const start = offset || 0;
      const end = limit ? start + limit : undefined;
      const paginated = filtered.slice(start, end);
      
      sendResponse({
        success: true,
        data: {
          items: paginated,
          total,
          hasMore: end ? end < total : false
        }
      });
    })
    .catch(error => {
      console.error('[Storage] Query failed:', error);
      sendResponse({
        success: false,
        error: error.message || 'Query failed'
      });
    });
  
  return true;
}
```

### 7.2 Get Project Stats Handler (Future)

```typescript
interface ProjectStats {
  totalProjects: number;
  byStatus: Record<ProjectStatus, number>;
  totalSteps: number;
  totalTestRuns: number;
  recentActivity: Array<{
    projectId: number;
    projectName: string;
    action: string;
    timestamp: number;
  }>;
}

function handleGetProjectStats(
  sendResponse: (response: StorageResponse) => void
): boolean {
  Promise.all([
    DB.projects.toArray(),
    DB.testRuns.toArray()
  ])
    .then(([projects, testRuns]) => {
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
      
      // Get recent activity (last 10 updates)
      const recentProjects = [...projects]
        .sort((a, b) => b.updated_date - a.updated_date)
        .slice(0, 10)
        .map(p => ({
          projectId: p.id!,
          projectName: p.name,
          action: 'updated',
          timestamp: p.updated_date
        }));
      
      const stats: ProjectStats = {
        totalProjects: projects.length,
        byStatus,
        totalSteps,
        totalTestRuns: testRuns.length,
        recentActivity: recentProjects
      };
      
      sendResponse({ success: true, data: stats });
    })
    .catch(error => {
      console.error('[Storage] Stats query failed:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to get statistics'
      });
    });
  
  return true;
}
```

---

## 8. Error Handling

### 8.1 Error Categories

```typescript
enum StorageErrorCategory {
  VALIDATION = 'VALIDATION',    // Bad input data
  NOT_FOUND = 'NOT_FOUND',      // Record doesn't exist
  CONSTRAINT = 'CONSTRAINT',    // Duplicate key, etc
  QUOTA = 'QUOTA',              // Storage full
  TRANSACTION = 'TRANSACTION',  // Transaction failed
  UNKNOWN = 'UNKNOWN'           // Catch-all
}

function categorizeError(error: Error): StorageErrorCategory {
  const message = error.message.toLowerCase();
  
  if (error.name === 'QuotaExceededError') {
    return StorageErrorCategory.QUOTA;
  }
  
  if (error.name === 'ConstraintError') {
    return StorageErrorCategory.CONSTRAINT;
  }
  
  if (message.includes('not found')) {
    return StorageErrorCategory.NOT_FOUND;
  }
  
  if (message.includes('transaction')) {
    return StorageErrorCategory.TRANSACTION;
  }
  
  return StorageErrorCategory.UNKNOWN;
}
```

### 8.2 Error Response Helper

```typescript
function sendErrorResponse(
  sendResponse: (response: StorageResponse) => void,
  error: Error | string,
  category?: StorageErrorCategory
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCategory = category || 
    (typeof error === 'string' ? StorageErrorCategory.VALIDATION : categorizeError(error as Error));
  
  console.error(`[Storage] Error (${errorCategory}):`, errorMessage);
  
  // Map to user-friendly messages
  let userMessage = errorMessage;
  
  switch (errorCategory) {
    case StorageErrorCategory.QUOTA:
      userMessage = 'Storage space is full. Please delete some projects to continue.';
      break;
    case StorageErrorCategory.NOT_FOUND:
      userMessage = 'The requested item was not found.';
      break;
    case StorageErrorCategory.CONSTRAINT:
      userMessage = 'This operation conflicts with existing data.';
      break;
    case StorageErrorCategory.TRANSACTION:
      userMessage = 'The operation failed. Please try again.';
      break;
  }
  
  sendResponse({
    success: false,
    error: userMessage
  });
}
```

### 8.3 Wrapper with Error Handling

```typescript
function withErrorHandling<T>(
  operation: () => Promise<T>,
  sendResponse: (response: StorageResponse) => void,
  onSuccess: (result: T) => StorageResponse
): boolean {
  operation()
    .then(result => {
      sendResponse(onSuccess(result));
    })
    .catch(error => {
      sendErrorResponse(sendResponse, error);
    });
  
  return true; // Always async
}

// Usage example
function handleGetAllProjectsRefactored(
  sendResponse: (response: StorageResponse) => void
): boolean {
  return withErrorHandling(
    () => DB.getAllProjects(),
    sendResponse,
    (projects) => ({ success: true, data: projects })
  );
}
```

---

## 9. Response Formatting

### 9.1 Standard Response Helpers

```typescript
const StorageResponses = {
  success: (data?: any): StorageResponse => ({
    success: true,
    data
  }),
  
  created: (id: number): StorageResponse => ({
    success: true,
    id
  }),
  
  project: (project: Project): StorageResponse => ({
    success: true,
    project
  }),
  
  error: (message: string): StorageResponse => ({
    success: false,
    error: message
  }),
  
  notFound: (entity: string, id: number): StorageResponse => ({
    success: false,
    error: `${entity} with ID ${id} not found`
  }),
  
  validationError: (field: string, message: string): StorageResponse => ({
    success: false,
    error: `Validation error: ${field} - ${message}`
  })
};
```

### 9.2 Consistent Response Format

```typescript
// All handlers should use consistent response patterns:

// For CREATE operations:
sendResponse({ success: true, id: newId });

// For READ single:
sendResponse({ success: true, project: project });
// or
sendResponse({ success: true, data: item });

// For READ list:
sendResponse({ success: true, data: items });

// For UPDATE/DELETE:
sendResponse({ success: true });

// For ERRORS:
sendResponse({ success: false, error: 'Error message' });
```

---

## 10. Handler Registration

### 10.1 Complete Handler Map

```typescript
// Handler registry for cleaner code organization
const storageHandlers: Record<StorageAction, StorageHandler | (() => boolean)> = {
  // Project CRUD
  'add_project': handleAddProject,
  'update_project': handleUpdateProject,
  'get_all_projects': handleGetAllProjects,
  'delete_project': handleDeleteProject,
  'get_project_by_id': handleGetProjectById,
  
  // Specialized Updates
  'update_project_steps': handleUpdateProjectSteps,
  'update_project_fields': handleUpdateProjectFields,
  'update_project_csv': handleUpdateProjectCsv,
  
  // TestRun CRUD
  'createTestRun': handleCreateTestRun,
  'updateTestRun': handleUpdateTestRun,
  'getTestRunsByProject': handleGetTestRunsByProject,
  
  // Future: Queries
  'query_projects': handleQueryProjects,
  'get_project_stats': handleGetProjectStats
};

// Simplified main listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = storageHandlers[message.action as StorageAction];
  
  if (handler) {
    // Some handlers need payload, some don't
    if (handler.length === 1) {
      return (handler as () => boolean)();
    } else {
      return (handler as StorageHandler)(message.payload, sendResponse);
    }
  }
  
  // Not a storage action, let other listeners handle it
  return false;
});
```

### 10.2 Action Constants

```typescript
// Constants file: src/common/constants/storage-actions.ts

export const StorageActions = {
  // Project CRUD
  ADD_PROJECT: 'add_project',
  UPDATE_PROJECT: 'update_project',
  GET_ALL_PROJECTS: 'get_all_projects',
  DELETE_PROJECT: 'delete_project',
  GET_PROJECT_BY_ID: 'get_project_by_id',
  
  // Specialized Updates
  UPDATE_PROJECT_STEPS: 'update_project_steps',
  UPDATE_PROJECT_FIELDS: 'update_project_fields',
  UPDATE_PROJECT_CSV: 'update_project_csv',
  
  // TestRun CRUD
  CREATE_TEST_RUN: 'createTestRun',
  UPDATE_TEST_RUN: 'updateTestRun',
  GET_TEST_RUNS_BY_PROJECT: 'getTestRunsByProject',
  
  // Queries
  QUERY_PROJECTS: 'query_projects',
  GET_PROJECT_STATS: 'get_project_stats'
} as const;

export type StorageAction = typeof StorageActions[keyof typeof StorageActions];
```

---

## 11. Testing Handlers

### 11.1 Mock Message System

```typescript
// Test utility to simulate chrome.runtime messaging
class MockMessageSystem {
  private handlers: Array<(
    message: any,
    sender: any,
    sendResponse: (response: any) => void
  ) => boolean | undefined> = [];
  
  addListener(handler: typeof this.handlers[0]): void {
    this.handlers.push(handler);
  }
  
  async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const sendResponse = (response: any) => {
        resolve(response);
      };
      
      for (const handler of this.handlers) {
        const handled = handler(message, {}, sendResponse);
        if (handled) return;
      }
      
      reject(new Error('No handler for message'));
    });
  }
}
```

### 11.2 Handler Tests

```typescript
describe('Storage Handlers', () => {
  let mockMessages: MockMessageSystem;
  
  beforeEach(async () => {
    mockMessages = new MockMessageSystem();
    
    // Register handlers
    mockMessages.addListener((message, sender, sendResponse) => {
      return handleStorageMessage(message, sender, sendResponse);
    });
    
    // Clear database
    await DB.projects.clear();
    await DB.testRuns.clear();
  });
  
  describe('add_project', () => {
    test('should create project and return ID', async () => {
      const response = await mockMessages.sendMessage({
        action: 'add_project',
        payload: {
          name: 'Test Project',
          target_url: 'https://example.com'
        }
      });
      
      expect(response.success).toBe(true);
      expect(response.id).toBeGreaterThan(0);
      
      // Verify in database
      const project = await DB.projects.get(response.id);
      expect(project?.name).toBe('Test Project');
    });
    
    test('should fail without name', async () => {
      const response = await mockMessages.sendMessage({
        action: 'add_project',
        payload: {
          target_url: 'https://example.com'
        }
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('name');
    });
    
    test('should fail with invalid URL', async () => {
      const response = await mockMessages.sendMessage({
        action: 'add_project',
        payload: {
          name: 'Test',
          target_url: 'not-a-url'
        }
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('URL');
    });
  });
  
  describe('delete_project', () => {
    test('should delete project and test runs', async () => {
      // Create project
      const projectId = await DB.projects.add({
        name: 'To Delete',
        description: '',
        target_url: 'https://example.com',
        status: 'draft',
        created_date: Date.now(),
        updated_date: Date.now()
      } as Project);
      
      // Create test run
      await DB.testRuns.add({
        project_id: projectId,
        status: 'completed',
        start_time: new Date().toISOString(),
        total_steps: 5,
        passed_steps: 5,
        failed_steps: 0,
        test_results: [],
        logs: ''
      } as TestRun);
      
      // Delete
      const response = await mockMessages.sendMessage({
        action: 'delete_project',
        payload: { id: projectId }
      });
      
      expect(response.success).toBe(true);
      
      // Verify deleted
      const project = await DB.projects.get(projectId);
      expect(project).toBeUndefined();
      
      const runs = await DB.testRuns
        .where('project_id')
        .equals(projectId)
        .toArray();
      expect(runs).toHaveLength(0);
    });
  });
});
```

---

## 12. Future: Batch Operations

### 12.1 Batch Handler Design

```typescript
interface BatchOperation {
  action: StorageAction;
  payload: any;
  id?: string; // Client-side identifier for matching responses
}

interface BatchResult {
  id?: string;
  success: boolean;
  data?: any;
  error?: string;
}

function handleBatchOperations(
  payload: { operations: BatchOperation[] },
  sendResponse: (response: StorageResponse) => void
): boolean {
  const { operations } = payload;
  
  if (!Array.isArray(operations) || operations.length === 0) {
    sendResponse({
      success: false,
      error: 'Operations array is required'
    });
    return true;
  }
  
  // Limit batch size
  if (operations.length > 100) {
    sendResponse({
      success: false,
      error: 'Maximum 100 operations per batch'
    });
    return true;
  }
  
  // Execute all operations
  const results: BatchResult[] = [];
  
  DB.transaction('rw', DB.projects, DB.testRuns, async () => {
    for (const op of operations) {
      try {
        const result = await executeSingleOperation(op);
        results.push({
          id: op.id,
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : 'Operation failed'
        });
      }
    }
  })
    .then(() => {
      const allSuccess = results.every(r => r.success);
      sendResponse({
        success: allSuccess,
        data: results
      });
    })
    .catch(error => {
      sendResponse({
        success: false,
        error: `Batch transaction failed: ${error.message}`
      });
    });
  
  return true;
}

async function executeSingleOperation(op: BatchOperation): Promise<any> {
  switch (op.action) {
    case 'add_project':
      return DB.addProject(op.payload);
    case 'update_project':
      return DB.updateProject(op.payload.id, op.payload);
    case 'delete_project':
      return DB.projects.delete(op.payload.id);
    // ... etc
    default:
      throw new Error(`Unknown action: ${op.action}`);
  }
}
```

---

## Summary

The Storage Message Handlers document provides:

✅ Complete message protocol with request/response formats  
✅ Handler architecture with routing and registration  
✅ Project CRUD handlers with validation  
✅ TestRun CRUD handlers with validation  
✅ Specialized update handlers for steps, fields, CSV  
✅ Query handlers for filtering and statistics  
✅ Error handling with categories and user-friendly messages  
✅ Response formatting helpers  
✅ Handler registration patterns  
✅ Testing utilities for handler validation  
✅ Future batch operations design  

This completes Section 7 (Storage Layer) of the masterplan documentation.
