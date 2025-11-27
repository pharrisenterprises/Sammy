# UI Components Overview
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Page Structure
4. Component Hierarchy
5. Design System
6. State Management
7. Styling Approach
8. Accessibility
9. Performance
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The UI Components subsystem provides all user-facing interfaces across both the Chrome Extension and Web Portal, including project management, recording, CSV mapping, test execution, and monitoring dashboards.

### 1.2 UI Contexts

| Context | Location | Purpose |
|---------|----------|---------|
| **Extension Popup** | popup.html | Quick access to recordings |
| **Extension Pages** | pages.html | Full recording/mapping UI |
| **Web Portal** | Next.js app | Dashboard, monitoring, settings |

### 1.3 Key Pages
```
Extension:
├── Popup (compact recording list)
├── Dashboard (full project management)
├── Recorder (recording interface)
├── Field Mapper (CSV mapping)
└── Test Runner (execution UI)

Portal:
├── Dashboard (recording library)
├── Recording Detail (step editor)
├── Execution Monitor (real-time logs)
├── Settings (user preferences)
└── Team Management (Phase 2)
```

### 1.4 Design Principles
```
1. CONSISTENCY
   - Shared design system
   - Reusable components
   - Unified color palette

2. RESPONSIVENESS
   - Mobile-first approach
   - Adaptive layouts
   - Touch-friendly targets

3. ACCESSIBILITY
   - WCAG 2.1 AA compliance
   - Keyboard navigation
   - Screen reader support

4. PERFORMANCE
   - Lazy loading
   - Virtual scrolling
   - Optimistic updates
```

---

## 2. Architecture

### 2.1 Component Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION SHELL                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Layout (Header, Sidebar, Footer)                         │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ Page Components                                  │   │  │
│  │  │                                                  │   │  │
│  │  │  ┌──────────────────────────────────────────┐  │   │  │
│  │  │  │ Feature Components                        │  │   │  │
│  │  │  │                                           │  │   │  │
│  │  │  │  ┌────────────────────────────────────┐ │  │   │  │
│  │  │  │  │ UI Primitives (Radix)              │ │  │   │  │
│  │  │  │  │ Button, Input, Dialog, Dropdown    │ │  │   │  │
│  │  │  │  └────────────────────────────────────┘ │  │   │  │
│  │  │  └──────────────────────────────────────────┘  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Categories
```typescript
// 1. UI Primitives (src/components/ui/)
// Radix-based, fully accessible, unstyled base components
export { Button } from './button';
export { Input } from './input';
export { Dialog } from './dialog';
export { DropdownMenu } from './dropdown-menu';
export { Tabs } from './tabs';
export { Card } from './card';

// 2. Feature Components (src/components/{feature}/)
// Domain-specific, composed from primitives
export { ProjectCard } from './Dashboard/ProjectCard';
export { StepsTable } from './Recorder/StepsTable';
export { MappingTable } from './Mapper/MappingTable';
export { TestConsole } from './Runner/TestConsole';

// 3. Page Components (src/pages/)
// Full page layouts with routing
export { Dashboard } from './pages/Dashboard';
export { Recorder } from './pages/Recorder';
export { FieldMapper } from './pages/FieldMapper';
export { TestRunner } from './pages/TestRunner';

// 4. Layout Components (src/components/)
// Structural components
export { Header } from './Header';
export { Sidebar } from './Sidebar';
export { Layout } from './Layout';
```

---

## 3. Page Structure

### 3.1 Page Files
```
src/
├── pages/
│   ├── Dashboard.tsx        (1,286 lines) - Project management
│   ├── Recorder.tsx         (626 lines)  - Recording interface
│   ├── FieldMapper.tsx      (523 lines)  - CSV mapping
│   ├── TestRunner.tsx       (809 lines)  - Test execution
│   └── Layout.tsx           (minimal)    - Wrapper layout
│
├── components/
│   ├── Dashboard/
│   │   ├── CreateProjectDialog.tsx
│   │   ├── EditProjectModal.tsx
│   │   ├── ProjectStats.tsx
│   │   └── ConfirmationModal.tsx
│   │
│   ├── Recorder/
│   │   ├── RecorderToolbar.tsx
│   │   ├── StepsTable.tsx
│   │   └── LogPanel.tsx
│   │
│   ├── Mapper/
│   │   ├── FieldMappingPanel.tsx
│   │   ├── FieldMappingTable.tsx
│   │   ├── MappingSummary.tsx
│   │   └── WebPreview.tsx
│   │
│   ├── Runner/
│   │   ├── TestConsole.tsx
│   │   ├── TestResults.tsx
│   │   └── TestSteps.tsx
│   │
│   ├── Ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   │
│   ├── Header.tsx
│   └── Loader/
│       └── Loader.tsx
```

### 3.2 Page Routing
```typescript
// src/routes/Router.tsx
import { createHashRouter, RouterProvider } from 'react-router-dom';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'recorder', element: <Recorder /> },
      { path: 'mapper', element: <FieldMapper /> },
      { path: 'runner', element: <TestRunner /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

---

## 4. Component Hierarchy

### 4.1 Dashboard Hierarchy
```
Dashboard
├── Header
│   ├── Logo
│   ├── Navigation
│   └── UserMenu
├── ProjectList
│   ├── SearchBar
│   ├── FilterDropdown
│   └── ProjectCard[]
│       ├── ProjectStats
│       ├── QuickActions
│       └── ActionMenu
├── CreateProjectDialog
│   ├── DialogHeader
│   ├── ProjectForm
│   └── DialogFooter
└── ConfirmationModal
```

### 4.2 Recorder Hierarchy
```
Recorder
├── RecorderToolbar
│   ├── RecordButton
│   ├── StopButton
│   ├── PauseButton
│   └── SettingsDropdown
├── StepsTable
│   ├── TableHeader
│   ├── DraggableRow[]
│   │   ├── StepNumber
│   │   ├── EventType
│   │   ├── Selector
│   │   ├── Value
│   │   └── Actions
│   └── TableFooter
├── LogPanel
│   ├── LogEntry[]
│   └── ClearButton
└── WebPreview (iframe)
```

### 4.3 Field Mapper Hierarchy
```
FieldMapper
├── CSVUploadZone
│   ├── DropArea
│   ├── FileInput
│   └── UploadProgress
├── MappingTable
│   ├── CSVColumnHeader[]
│   ├── StepLabelHeader[]
│   └── MappingRow[]
│       ├── CSVColumn
│       ├── Arrow
│       └── StepDropdown
├── MappingSummary
│   ├── MappedCount
│   ├── UnmappedWarnings
│   └── ConfirmButton
└── PreviewPanel
    └── SampleDataTable
```

### 4.4 Test Runner Hierarchy
```
TestRunner
├── ExecutionHeader
│   ├── RecordingName
│   ├── CSVInfo
│   └── ActionButtons
├── ProgressSection
│   ├── ProgressBar
│   ├── RowCounter
│   ├── StepCounter
│   └── TimeEstimate
├── TestConsole
│   ├── LogStream
│   │   └── LogEntry[]
│   └── ScrollControls
├── TestResults
│   ├── SummaryStats
│   ├── RowResults[]
│   └── FailureDetails
└── ControlPanel
    ├── StartButton
    ├── StopButton
    ├── PauseButton
    └── ExportButton
```

---

## 5. Design System

### 5.1 Color Palette
```typescript
const colors = {
  // Primary
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8'
  },

  // Semantic
  success: {
    light: '#dcfce7',
    main: '#22c55e',
    dark: '#16a34a'
  },

  error: {
    light: '#fee2e2',
    main: '#ef4444',
    dark: '#dc2626'
  },

  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#d97706'
  },

  // Neutral
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  }
};
```

### 5.2 Typography
```typescript
const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace']
  },

  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem'  // 30px
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};
```

### 5.3 Spacing
```typescript
const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem'      // 64px
};
```

---

## 6. State Management

### 6.1 State Patterns
```typescript
// Local state (useState)
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');

// Complex state (useReducer)
const [state, dispatch] = useReducer(recorderReducer, initialState);

// Shared state (Context)
const { theme, setTheme } = useContext(ThemeContext);

// Server state (React Query - Phase 2)
const { data, isLoading } = useQuery(['projects'], fetchProjects);

// Global state (Redux - minimal usage)
const theme = useSelector(selectTheme);
```

### 6.2 Data Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Action   │ →  │  State Update   │ →  │   Re-render     │
│   (onClick)     │    │  (setState)     │    │   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │         ┌─────────────────┐                 │
         └───────→ │  Side Effect    │ ←───────────────┘
                   │  (useEffect)    │
                   └─────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Background     │
                   │  Service        │
                   │  (sendMessage)  │
                   └─────────────────┘
```

---

## 7. Styling Approach

### 7.1 Tailwind CSS
```typescript
// Utility-first styling
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
  Click me
</button>

// With variants
<button className={cn(
  "px-4 py-2 rounded-lg font-medium transition-colors",
  variant === 'primary' && "bg-blue-600 text-white hover:bg-blue-700",
  variant === 'secondary' && "bg-gray-200 text-gray-800 hover:bg-gray-300",
  variant === 'destructive' && "bg-red-600 text-white hover:bg-red-700",
  disabled && "opacity-50 cursor-not-allowed"
)}>
  {children}
</button>
```

### 7.2 CSS Modules (when needed)
```css
/* dashboard.module.css */
.projectGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.projectCard {
  background: var(--card-bg);
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

---

## 8. Accessibility

### 8.1 ARIA Guidelines
```typescript
// Proper labeling
<button aria-label="Close dialog" onClick={onClose}>
  <XIcon />
</button>

<input
  type="text"
  id="search"
  aria-describedby="search-help"
/>
<span id="search-help">Enter project name to search</span>

// Live regions
<div role="status" aria-live="polite">
  {statusMessage}
</div>

// Focus management
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger>
    Open
  </DialogTrigger>
  <DialogContent>
    {/* Focus trapped inside */}
  </DialogContent>
</Dialog>
```

### 8.2 Keyboard Navigation
```typescript
// Tab order
<div>
  <button tabIndex={0}>Item 1</button>
  <button tabIndex={0}>Item 2</button>
</div>

// Keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.metaKey) onSubmit();
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## 9. Performance

### 9.1 Optimization Techniques
```typescript
// Memoization
const MemoizedComponent = React.memo(ExpensiveComponent);

// Lazy loading
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

// Virtual scrolling (for large lists)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={1000}
  itemSize={50}
>
  {Row}
</FixedSizeList>

// Debounced search
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
);
```

### 9.2 Bundle Optimization
```typescript
// Code splitting
const routes = [
  {
    path: '/dashboard',
    element: <Suspense fallback={<Loader />}>
      <Dashboard />
    </Suspense>
  }
];

// Tree shaking (import only what's needed)
import { Button } from '@radix-ui/react-button';
// NOT: import * as RadixUI from '@radix-ui';
```

---

## 10. Testing Strategy

### 10.1 Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 10.2 Integration Testing
```typescript
describe('Dashboard', () => {
  it('loads and displays projects', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
    });
  });

  it('creates new project', async () => {
    render(<Dashboard />);
    
    fireEvent.click(screen.getByText('New Project'));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Test Project' }
    });
    fireEvent.click(screen.getByText('Create'));
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });
});
```

---

## Summary

UI Components provides:
- ✅ **Component architecture** (primitives → features → pages)
- ✅ **Page structure** (Dashboard, Recorder, FieldMapper, TestRunner)
- ✅ **Component hierarchy** for all major pages
- ✅ **Design system** (colors, typography, spacing)
- ✅ **State management** patterns (local, context, effects)
- ✅ **Styling approach** (Tailwind utility-first)
- ✅ **Accessibility** (ARIA, keyboard navigation)
- ✅ **Performance optimization** (memoization, lazy loading, virtualization)
- ✅ **Testing strategy** (component and integration tests)

This provides the foundation for all user-facing interfaces.
