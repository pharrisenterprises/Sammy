# Quick Actions System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Duplicate Recording
4. Archive/Restore Functionality
5. Bulk Operations
6. Confirmation Modals
7. Action Buttons
8. State Management
9. Error Handling
10. Accessibility
11. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Quick Actions System provides users with rapid access to common operations on recordings, projects, and test runs through context menus, keyboard shortcuts, and toolbar buttons.

### 1.2 Key Features

- **Duplicate Recording**: Clone existing recordings with all steps
- **Archive/Restore**: Soft-delete projects without permanent removal
- **Bulk Operations**: Select multiple items for batch actions
- **Export Actions**: Quick CSV/Excel export buttons
- **Share Actions**: Generate shareable links (Phase 3)
- **Keyboard Shortcuts**: Power-user productivity

### 1.3 Design Principles

- **One-Click Actions**: Minimize steps for common tasks
- **Undo-Friendly**: Reversible operations where possible
- **Confirmation Gates**: Prevent accidental destructive actions
- **Visual Feedback**: Loading states and success/error messages

---

## 2. Architecture

### 2.1 Component Structure

```
src/components/QuickActions/
├── QuickActionBar.tsx          (Main toolbar)
├── DuplicateButton.tsx          (Clone recording logic)
├── ArchiveButton.tsx            (Archive/restore toggle)
├── BulkActionMenu.tsx           (Multi-select operations)
├── ExportButton.tsx             (CSV/Excel export)
├── ShareButton.tsx              (Phase 3 - shareable links)
├── ConfirmationDialog.tsx       (Reusable confirmation modal)
└── useQuickActions.ts           (Custom hook for action handlers)
```

### 2.2 State Flow

```
User clicks action button
        ↓
QuickActionBar dispatches event
        ↓
useQuickActions hook processes
        ↓
Confirmation modal (if needed)
        ↓
chrome.runtime.sendMessage({ action: 'duplicate_project', payload })
        ↓
Background service processes
        ↓
Success/error notification
        ↓
UI updates (refetch data)
```

---

## 3. Duplicate Recording

### 3.1 Purpose

Create an exact copy of an existing recording with independent ID, allowing users to create variations without starting from scratch.

### 3.2 Implementation

#### Component: `DuplicateButton.tsx`

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { Project } from '@/types';

interface DuplicateButtonProps {
  project: Project;
  onSuccess: () => void;
}

export function DuplicateButton({ project, onSuccess }: DuplicateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDuplicate = async () => {
    setIsLoading(true);
    
    try {
      const duplicatedProject = {
        ...project,
        id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${project.name} (Copy)`,
        status: 'draft',
        created_date: Date.now(),
        updated_date: Date.now()
      };

      chrome.runtime.sendMessage(
        {
          action: 'create_project',
          payload: duplicatedProject
        },
        (response) => {
          if (response.success) {
            onSuccess();
            showNotification('Recording duplicated successfully', 'success');
          } else {
            showNotification(response.error || 'Failed to duplicate', 'error');
          }
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Duplication error:', error);
      showNotification('An error occurred', 'error');
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDuplicate}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      <Copy className="h-4 w-4 mr-2" />
      {isLoading ? 'Duplicating...' : 'Duplicate'}
    </Button>
  );
}
```

### 3.3 Deep Copy Considerations

**What Gets Copied:**
- All recorded steps (complete array)
- Field mappings (CSV associations)
- Target URL
- Project metadata (name, description)
- Variables configuration

**What Gets Reset:**
- New unique ID
- Status reset to 'draft'
- Created/updated timestamps
- Test run history (not copied)
- CSV data (reference only, not file)

### 3.4 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Project has 500+ steps | Show progress modal during copy |
| CSV file >10MB | Copy mapping config, prompt user to re-upload file |
| Duplicate during recording | Disabled - only works on completed recordings |
| Name conflict | Append " (Copy N)" where N increments |

---

## 4. Archive/Restore Functionality

### 4.1 Purpose

Soft-delete projects to declutter the dashboard without permanent data loss, with easy restoration capability.

### 4.2 Implementation

#### Component: `ArchiveButton.tsx`

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmationDialog } from './ConfirmationDialog';

interface ArchiveButtonProps {
  projectId: string;
  isArchived: boolean;
  onToggle: () => void;
}

export function ArchiveButton({ projectId, isArchived, onToggle }: ArchiveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleArchiveToggle = async () => {
    setIsLoading(true);
    setShowConfirm(false);

    chrome.runtime.sendMessage(
      {
        action: 'update_project',
        payload: {
          id: projectId,
          archived: !isArchived,
          updated_date: Date.now()
        }
      },
      (response) => {
        if (response.success) {
          onToggle();
          showNotification(
            isArchived ? 'Project restored' : 'Project archived',
            'success'
          );
        } else {
          showNotification('Operation failed', 'error');
        }
        setIsLoading(false);
      }
    );
  };

  return (
    <>
      <Button
        onClick={() => setShowConfirm(true)}
        disabled={isLoading}
        variant={isArchived ? 'default' : 'outline'}
        size="sm"
      >
        {isArchived ? (
          <>
            <ArchiveRestore className="h-4 w-4 mr-2" />
            Restore
          </>
        ) : (
          <>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </>
        )}
      </Button>

      <ConfirmationDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleArchiveToggle}
        title={isArchived ? 'Restore Project?' : 'Archive Project?'}
        description={
          isArchived
            ? 'This project will be moved back to your active projects.'
            : 'This project will be hidden from your dashboard. You can restore it later from the archived projects view.'
        }
        confirmText={isArchived ? 'Restore' : 'Archive'}
        cancelText="Cancel"
        variant={isArchived ? 'default' : 'destructive'}
      />
    </>
  );
}
```

### 4.3 Database Schema Addition

```typescript
// Add to Project interface
interface Project {
  // ... existing fields
  archived: boolean;           // Default: false
  archived_at?: number;        // Timestamp when archived
  archived_by?: string;        // User ID (Phase 3)
}
```

### 4.4 Dashboard Filtering

```tsx
// In Dashboard.tsx
const [showArchived, setShowArchived] = useState(false);

const filteredProjects = projects.filter(p => 
  p.archived === showArchived &&
  p.name.toLowerCase().includes(searchTerm.toLowerCase())
);

// Toggle button
<Button onClick={() => setShowArchived(!showArchived)}>
  {showArchived ? 'Show Active' : 'Show Archived'}
  <Badge className="ml-2">
    {projects.filter(p => p.archived === showArchived).length}
  </Badge>
</Button>
```

---

## 5. Bulk Operations

### 5.1 Purpose

Allow users to select multiple recordings and perform batch operations (archive, delete, export, tag in Phase 3).

### 5.2 Implementation

#### Component: `BulkActionMenu.tsx`

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Archive, Trash2, Download } from 'lucide-react';
import { ConfirmationDialog } from './ConfirmationDialog';

interface BulkActionMenuProps {
  selectedIds: string[];
  onComplete: () => void;
}

export function BulkActionMenu({ selectedIds, onComplete }: BulkActionMenuProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBulkArchive = async () => {
    setIsLoading(true);
    
    const promises = selectedIds.map(id =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'update_project',
            payload: { id, archived: true, updated_date: Date.now() }
          },
          resolve
        );
      })
    );

    await Promise.all(promises);
    showNotification(`${selectedIds.length} projects archived`, 'success');
    onComplete();
    setIsLoading(false);
  };

  const handleBulkDelete = async () => {
    setIsLoading(true);
    setShowDeleteConfirm(false);

    const promises = selectedIds.map(id =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'delete_project', payload: { id } },
          resolve
        );
      })
    );

    await Promise.all(promises);
    showNotification(`${selectedIds.length} projects deleted`, 'success');
    onComplete();
    setIsLoading(false);
  };

  const handleBulkExport = async () => {
    setIsLoading(true);

    chrome.runtime.sendMessage(
      {
        action: 'export_projects',
        payload: { ids: selectedIds, format: 'excel' }
      },
      (response) => {
        if (response.success) {
          const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `recordings_${Date.now()}.xlsx`;
          link.click();
          URL.revokeObjectURL(url);
          showNotification('Export complete', 'success');
        } else {
          showNotification('Export failed', 'error');
        }
        setIsLoading(false);
      }
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={isLoading || selectedIds.length === 0}>
            Bulk Actions ({selectedIds.length})
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleBulkArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive Selected
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleBulkExport}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Projects?"
        description={`This will permanently delete ${selectedIds.length} projects. This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
```

### 5.3 Selection State Management

```tsx
// In Dashboard.tsx
const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

const toggleSelection = (id: string) => {
  setSelectedProjects(prev => {
    const updated = new Set(prev);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    return updated;
  });
};

const selectAll = () => {
  setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
};

const clearSelection = () => {
  setSelectedProjects(new Set());
};
```

### 5.4 Checkbox UI

```tsx
<Checkbox
  checked={selectedProjects.has(project.id)}
  onCheckedChange={() => toggleSelection(project.id)}
  aria-label={`Select ${project.name}`}
/>
```

---

## 6. Confirmation Modals

### 6.1 Reusable Confirmation Dialog

#### Component: `ConfirmationDialog.tsx`

```tsx
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default'
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 6.2 Usage Patterns

| Action | Requires Confirmation? | Variant |
|--------|------------------------|---------|
| Duplicate | No | - |
| Archive | Yes | default |
| Restore | Yes | default |
| Delete Single | Yes | destructive |
| Delete Multiple | Yes | destructive |
| Export | No | - |
| Share | No | - |

---

## 7. Action Buttons

### 7.1 Quick Action Bar

```tsx
// In Dashboard.tsx or Recorder.tsx
<div className="flex items-center gap-2">
  <DuplicateButton project={currentProject} onSuccess={refetchProjects} />
  <ArchiveButton 
    projectId={currentProject.id}
    isArchived={currentProject.archived}
    onToggle={refetchProjects}
  />
  <ExportButton projectId={currentProject.id} format="excel" />
  <ShareButton projectId={currentProject.id} /> {/* Phase 3 */}
</div>
```

### 7.2 Context Menu (Right-Click)

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu';

<ContextMenu>
  <ContextMenuTrigger>
    <ProjectCard project={project} />
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => handleDuplicate(project.id)}>
      <Copy className="mr-2 h-4 w-4" />
      Duplicate
    </ContextMenuItem>
    <ContextMenuItem onClick={() => handleArchive(project.id)}>
      <Archive className="mr-2 h-4 w-4" />
      Archive
    </ContextMenuItem>
    <ContextMenuItem onClick={() => handleExport(project.id)}>
      <Download className="mr-2 h-4 w-4" />
      Export
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

---

## 8. State Management

### 8.1 Custom Hook: `useQuickActions.ts`

```typescript
import { useState, useCallback } from 'react';

interface UseQuickActionsReturn {
  duplicate: (projectId: string) => Promise<void>;
  archive: (projectId: string) => Promise<void>;
  restore: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  exportProject: (projectId: string, format: 'excel' | 'csv') => Promise<void>;
  isLoading: boolean;
}

export function useQuickActions(onSuccess?: () => void): UseQuickActionsReturn {
  const [isLoading, setIsLoading] = useState(false);

  const duplicate = useCallback(async (projectId: string) => {
    setIsLoading(true);
    
    chrome.runtime.sendMessage(
      { action: 'get_project', payload: { id: projectId } },
      (response) => {
        if (response.success) {
          const duplicated = {
            ...response.data,
            id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${response.data.name} (Copy)`,
            status: 'draft',
            created_date: Date.now(),
            updated_date: Date.now()
          };

          chrome.runtime.sendMessage(
            { action: 'create_project', payload: duplicated },
            (createResponse) => {
              if (createResponse.success) {
                showNotification('Project duplicated', 'success');
                onSuccess?.();
              } else {
                showNotification('Failed to duplicate', 'error');
              }
              setIsLoading(false);
            }
          );
        } else {
          showNotification('Failed to load project', 'error');
          setIsLoading(false);
        }
      }
    );
  }, [onSuccess]);

  const archive = useCallback(async (projectId: string) => {
    setIsLoading(true);

    chrome.runtime.sendMessage(
      {
        action: 'update_project',
        payload: { id: projectId, archived: true, archived_at: Date.now() }
      },
      (response) => {
        if (response.success) {
          showNotification('Project archived', 'success');
          onSuccess?.();
        } else {
          showNotification('Failed to archive', 'error');
        }
        setIsLoading(false);
      }
    );
  }, [onSuccess]);

  const restore = useCallback(async (projectId: string) => {
    setIsLoading(true);

    chrome.runtime.sendMessage(
      {
        action: 'update_project',
        payload: { id: projectId, archived: false }
      },
      (response) => {
        if (response.success) {
          showNotification('Project restored', 'success');
          onSuccess?.();
        } else {
          showNotification('Failed to restore', 'error');
        }
        setIsLoading(false);
      }
    );
  }, [onSuccess]);

  const deleteProject = useCallback(async (projectId: string) => {
    setIsLoading(true);

    chrome.runtime.sendMessage(
      { action: 'delete_project', payload: { id: projectId } },
      (response) => {
        if (response.success) {
          showNotification('Project deleted', 'success');
          onSuccess?.();
        } else {
          showNotification('Failed to delete', 'error');
        }
        setIsLoading(false);
      }
    );
  }, [onSuccess]);

  const exportProject = useCallback(async (projectId: string, format: 'excel' | 'csv') => {
    setIsLoading(true);

    chrome.runtime.sendMessage(
      {
        action: 'export_project',
        payload: { id: projectId, format }
      },
      (response) => {
        if (response.success) {
          // Trigger download
          const blob = new Blob([response.data], {
            type: format === 'excel'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'text/csv'
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `recording_${projectId}.${format === 'excel' ? 'xlsx' : 'csv'}`;
          link.click();
          URL.revokeObjectURL(url);
          showNotification('Export complete', 'success');
        } else {
          showNotification('Export failed', 'error');
        }
        setIsLoading(false);
      }
    );
  }, []);

  return {
    duplicate,
    archive,
    restore,
    deleteProject,
    exportProject,
    isLoading
  };
}
```

---

## 9. Error Handling

### 9.1 Error Types

| Error | User Message | Recovery Action |
|-------|-------------|-----------------|
| Network timeout | "Operation timed out" | Retry button |
| Permission denied | "Insufficient permissions" | Contact admin message (Phase 3) |
| Invalid project ID | "Project not found" | Redirect to dashboard |
| Storage quota exceeded | "Storage full" | Archive old projects prompt |
| Concurrent modification | "Project was modified" | Refresh and retry |

### 9.2 Error Boundary

```tsx
class QuickActionsErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Quick Actions Error:', error, errorInfo);
    // Log to Sentry in production
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">
            An error occurred. Please refresh the page.
          </p>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 10. Accessibility

### 10.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+D | Duplicate selected project |
| Ctrl+A | Select all projects |
| Ctrl+Shift+A | Clear selection |
| Delete | Delete selected (with confirmation) |
| Ctrl+E | Export selected |
| Esc | Close modals/cancel |

### 10.2 Screen Reader Support

```tsx
<Button
  onClick={handleDuplicate}
  aria-label={`Duplicate ${project.name}`}
  aria-describedby="duplicate-help-text"
>
  <Copy aria-hidden="true" />
  Duplicate
</Button>

<span id="duplicate-help-text" className="sr-only">
  Creates an exact copy of this recording with a new ID
</span>
```

### 10.3 Focus Management

- Trap focus in confirmation dialogs
- Return focus to trigger button after dialog closes
- Show focus indicators on all interactive elements
- Support keyboard navigation in dropdown menus

---

## 11. Testing Strategy

### 11.1 Unit Tests

```tsx
describe('DuplicateButton', () => {
  it('creates a copy with new ID', async () => {
    const mockProject = { id: '123', name: 'Test', recorded_steps: [] };
    render(<DuplicateButton project={mockProject} onSuccess={jest.fn()} />);
    
    const button = screen.getByText('Duplicate');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create_project',
          payload: expect.objectContaining({
            name: 'Test (Copy)',
            id: expect.not.stringContaining('123')
          })
        }),
        expect.any(Function)
      );
    });
  });
});
```

### 11.2 Integration Tests

```tsx
describe('Bulk Operations', () => {
  it('archives multiple projects', async () => {
    const projects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' }
    ];
    
    render(<Dashboard initialProjects={projects} />);
    
    // Select multiple
    fireEvent.click(screen.getByLabelText('Select Project 1'));
    fireEvent.click(screen.getByLabelText('Select Project 2'));
    
    // Bulk archive
    fireEvent.click(screen.getByText('Bulk Actions (2)'));
    fireEvent.click(screen.getByText('Archive Selected'));
    
    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });
  });
});
```

---

## Summary

The Quick Actions System provides:

✅ One-click duplication with deep copy of all step data  
✅ Soft-delete archive system with restore capability  
✅ Bulk operations for efficient multi-project management  
✅ Reusable confirmation modals with destructive variant support  
✅ Custom useQuickActions hook for consistent state management  
✅ Keyboard shortcuts for power users  
✅ Accessibility support with ARIA labels and focus management  
✅ Comprehensive error handling with user-friendly messages  
✅ Testable architecture with clear component boundaries  

This system significantly improves user productivity by reducing multi-step workflows to single actions with appropriate safeguards.
