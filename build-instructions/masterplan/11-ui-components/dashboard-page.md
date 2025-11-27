# Dashboard Page
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Data Interfaces
3. Page Layout
4. Project Card
5. Create Project Dialog
6. Edit Project Modal
7. Quick Actions
8. State Management
9. Background Communication
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Dashboard page (1,286 lines) serves as the main project management interface, displaying all recordings with search, filter, and CRUD operations.

### 1.2 File Location
```
src/pages/Dashboard.tsx (1,286 lines)
```

### 1.3 Key Features

- Project listing with search/filter
- Create new project dialog
- Edit existing project modal
- Quick actions (duplicate, archive)
- Delete confirmation modal
- Stats display per project

---

## 2. Data Interfaces

### 2.1 Project Interface
```typescript
// CRITICAL: Status values must match existing system
interface Project {
  id: number;
  name: string;
  description: string;
  status: 'draft' | 'testing' | 'complete';  // NOT ready/running/archived
  created_at: string;
  updated_at: string;
  steps: Step[];
  step_count: number;
  last_run?: string;
  last_run_status?: 'passed' | 'failed';
}
```

### 2.2 Step Interface
```typescript
// CRITICAL: Must include path, x, y, bundle fields
interface Step {
  id: string;
  name: string;
  event: 'click' | 'input' | 'enter' | 'open';  // Limited event types
  path: string;           // XPath - required field
  value: string;
  label: string;
  x: number;              // Required coordinate
  y: number;              // Required coordinate
  bundle?: LocatorBundle; // Optional locator bundle
}

interface LocatorBundle {
  id?: string;
  className?: string;
  tag: string;
  textContent?: string;
  attributes: Record<string, string>;
  xpath: string;
  bounding?: { x: number; y: number; width: number; height: number };
}
```

### 2.3 Dashboard State
```typescript
interface DashboardState {
  projects: Project[];
  filteredProjects: Project[];
  searchQuery: string;
  statusFilter: 'all' | 'draft' | 'testing' | 'complete';
  sortBy: 'name' | 'updated_at' | 'created_at';
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  error: string | null;
}
```

---

## 3. Page Layout

### 3.1 Component Structure
```typescript
// src/pages/Dashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { CreateProjectDialog } from '@/components/Dashboard/CreateProjectDialog';
import { EditProjectModal } from '@/components/Dashboard/EditProjectModal';
import { ProjectStats } from '@/components/Dashboard/ProjectStats';
import { ConfirmationModal } from '@/components/Dashboard/ConfirmationModal';

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'testing' | 'complete'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              My Recordings
            </h1>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Recording
          </Button>
        </div>
      </header>

      {/* Search and Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <FilterDropdown value={statusFilter} onChange={setStatusFilter} />
        </div>
      </div>

      {/* Project Grid */}
      <div className="p-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : filteredProjects.length === 0 ? (
          <EmptyState onCreateClick={() => setIsCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setEditingProject(project)}
                onDelete={() => setDeletingProject(project)}
                onDuplicate={() => handleDuplicate(project)}
                onClick={() => navigate(`/recorder?id=${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleProjectCreated}
      />

      <EditProjectModal
        project={editingProject}
        open={!!editingProject}
        onOpenChange={(open) => !open && setEditingProject(null)}
        onSaved={handleProjectUpdated}
      />

      <ConfirmationModal
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
        title="Delete Recording"
        message={`Are you sure you want to delete "${deletingProject?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => handleDelete(deletingProject!)}
        variant="destructive"
      />
    </div>
  );
}
```

---

## 4. Project Card

### 4.1 Card Component
```typescript
// src/components/Dashboard/ProjectCard.tsx
interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClick: () => void;
}

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  onDuplicate,
  onClick
}: ProjectCardProps) {
  return (
    <Card
      className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-gray-600">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                Duplicate
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                className="text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>{project.step_count} steps</span>
        <StatusBadge status={project.status} />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
        Updated {formatRelativeTime(project.updated_at)}
      </div>
    </Card>
  );
}
```

### 4.2 Status Badge
```typescript
// CRITICAL: Use correct status values
function StatusBadge({ status }: { status: 'draft' | 'testing' | 'complete' }) {
  const styles = {
    draft: 'bg-gray-100 text-gray-700',
    testing: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700'
  };

  const labels = {
    draft: 'Draft',
    testing: 'Testing',
    complete: 'Complete'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
```

---

## 5. Create Project Dialog

### 5.1 Dialog Component
```typescript
// src/components/Dashboard/CreateProjectDialog.tsx
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: Project) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // CRITICAL: Use lowercase snake_case action names
      const response = await chrome.runtime.sendMessage({
        action: 'add_project',  // NOT 'ADD_PROJECT'
        data: {
          name: name.trim(),
          description: description.trim(),
          status: 'draft',
          steps: []
        }
      });

      if (response.success) {
        onCreated(response.project);
        onOpenChange(false);
        resetForm();
      } else {
        setError(response.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            Create New Recording
          </Dialog.Title>
          <Dialog.Description>
            Create a new test recording to automate browser actions.
          </Dialog.Description>
        </Dialog.Header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name *
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Login Flow Test"
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this recording tests..."
                className="mt-1"
                rows={3}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Recording'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
```

---

## 6. Edit Project Modal

### 6.1 Modal Component
```typescript
// src/components/Dashboard/EditProjectModal.tsx
interface EditProjectModalProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (project: Project) => void;
}

export function EditProjectModal({
  project,
  open,
  onOpenChange,
  onSaved
}: EditProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'testing' | 'complete'>('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync form with project prop
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setStatus(project.status);
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!project) return;

    setIsSubmitting(true);

    try {
      // CRITICAL: Use lowercase snake_case action names
      const response = await chrome.runtime.sendMessage({
        action: 'update_project',  // NOT 'UPDATE_PROJECT'
        data: {
          id: project.id,
          name: name.trim(),
          description: description.trim(),
          status
        }
      });

      if (response.success) {
        onSaved({ ...project, name, description, status });
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            Edit Recording
          </Dialog.Title>
        </Dialog.Header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                <option value="draft">Draft</option>
                <option value="testing">Testing</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
```

---

## 7. Quick Actions

### 7.1 Duplicate Project
```typescript
async function handleDuplicate(project: Project): Promise<void> {
  try {
    // CRITICAL: Use lowercase snake_case action names
    const response = await chrome.runtime.sendMessage({
      action: 'add_project',  // Create new project with copied data
      data: {
        name: `${project.name} (Copy)`,
        description: project.description,
        status: 'draft',  // Always start as draft
        steps: project.steps.map(step => ({
          ...step,
          id: generateId()  // New IDs for copied steps
        }))
      }
    });

    if (response.success) {
      // Refresh project list
      await loadProjects();
    }
  } catch (error) {
    console.error('Failed to duplicate project:', error);
  }
}
```

### 7.2 Delete Project
```typescript
async function handleDelete(project: Project): Promise<void> {
  try {
    // CRITICAL: Use lowercase snake_case action names
    const response = await chrome.runtime.sendMessage({
      action: 'delete_project',  // NOT 'DELETE_PROJECT'
      data: { id: project.id }
    });

    if (response.success) {
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setDeletingProject(null);
    }
  } catch (error) {
    console.error('Failed to delete project:', error);
  }
}
```

---

## 8. State Management

### 8.1 Filtering Logic
```typescript
const filteredProjects = useMemo(() => {
  let result = [...projects];

  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }

  // Status filter
  if (statusFilter !== 'all') {
    result = result.filter(p => p.status === statusFilter);
  }

  // Sort
  result.sort((a, b) => {
    const aVal = a.updated_at;
    const bVal = b.updated_at;
    return new Date(bVal).getTime() - new Date(aVal).getTime();
  });

  return result;
}, [projects, searchQuery, statusFilter]);
```

---

## 9. Background Communication

### 9.1 Load Projects
```typescript
// CRITICAL: All messages use lowercase snake_case action names
async function loadProjects(): Promise<void> {
  setIsLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'get_all_projects'  // NOT 'GET_ALL_PROJECTS'
    });

    if (response.success) {
      setProjects(response.projects);
    } else {
      console.error('Failed to load projects:', response.error);
    }
  } catch (error) {
    console.error('Failed to load projects:', error);
  } finally {
    setIsLoading(false);
  }
}
```

### 9.2 Message Types Reference
```typescript
// All valid message actions (lowercase snake_case)
type MessageAction =
  | 'get_all_projects'
  | 'get_project'
  | 'add_project'
  | 'update_project'
  | 'delete_project'
  | 'update_project_steps'
  | 'get_project_steps';
```

---

## 10. Testing Strategy

### 10.1 Component Tests
```typescript
describe('Dashboard', () => {
  it('loads and displays projects', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      projects: [
        { id: 1, name: 'Test Project', status: 'draft', steps: [] }
      ]
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  it('filters by status', async () => {
    // Setup with multiple projects of different statuses
    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      projects: [
        { id: 1, name: 'Draft Project', status: 'draft' },
        { id: 2, name: 'Complete Project', status: 'complete' }
      ]
    });

    render(<Dashboard />);

    // Filter to complete only
    fireEvent.click(screen.getByText('Complete'));

    expect(screen.queryByText('Draft Project')).not.toBeInTheDocument();
    expect(screen.getByText('Complete Project')).toBeInTheDocument();
  });
});
```

---

## Summary

Dashboard Page provides:
- ✅ **Project listing** with search and filter
- ✅ **Correct status values** (`draft`, `testing`, `complete`)
- ✅ **Correct Step interface** with `path`, `x`, `y`, `bundle` fields
- ✅ **Correct message actions** (lowercase snake_case)
- ✅ **Create/Edit/Delete** CRUD operations
- ✅ **Quick actions** (duplicate projects)
- ✅ **State management** with filtering/sorting
- ✅ **Testing strategy** with mocked chrome API

Aligns with existing project knowledge base interfaces.
