# UI COMPONENTS ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/ui-components_breakdown.md` (461 lines)
- `modularization-plans/ui-components_mod-plan.md` (empty - to be populated)
- `implementation-guides/ui-components_impl.md` (N/A - not planned)

**Subsystem Purpose**: The UI Components system is the presentation and interaction layer providing user-facing interfaces for project management, step recording, field mapping, and test execution. Built with React, Tailwind CSS, and Radix UI primitives, it offers a modern, accessible interface distributed across four major pages.

**Criticality**: ⭐⭐⭐⭐ (High - primary user interaction point)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Project Management**: Create/edit/delete/search automation projects with status tracking
- **Recording Interface**: Display captured steps in real-time, enable editing, drag-and-drop reordering
- **Field Mapping**: Visualize CSV-to-step associations, auto-mapping workflow, manual override controls
- **Test Execution**: Show progress bar, real-time logs, step status indicators, results summary
- **State Management**: Maintain UI state with React hooks (useState, useEffect), minimal Redux for theme
- **User Feedback**: Alerts, notifications, loading spinners, error messages, confirmation dialogs
- **Routing**: Navigate between pages via React Router (hash-based for extension compatibility)
- **Responsive Design**: Adapt layouts for different screen sizes (Tailwind breakpoints)

### MUST NOT DO
- **Never mutate props**: All component inputs are immutable—use callbacks to request changes
- **Never perform business logic**: UI components coordinate, not implement—delegate to background/content scripts
- **Never store sensitive data in state**: No passwords, tokens in React state (use chrome.storage if needed)
- **Never block render thread**: Long operations (DB queries, file parsing) must use async/await with loading states

---

## 3. Interfaces & Contracts (Compressed)

### Page Component Architecture

#### Dashboard.tsx (1,286 lines)
**Purpose**: Project list, search, create/edit/delete operations
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'testing' | 'complete';
  created_date: number;
  updated_date: number;
  target_url: string;
}

// State Management:
const [projects, setProjects] = useState<Project[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedProject, setSelectedProject] = useState<Project | null>(null);
```

**Key Operations**:
- Load projects: `chrome.runtime.sendMessage({ action: 'get_all_projects' })`
- Create project: `chrome.runtime.sendMessage({ action: 'add_project', payload: newProject })`
- Delete project: `chrome.runtime.sendMessage({ action: 'delete_project', payload: { id } })`
- Navigate to Recorder: `window.location.href = createPageUrl('index.html#/Recorder?project=123')`

#### Recorder.tsx (626 lines)
**Purpose**: Step recording interface, drag-and-drop reordering, export
```typescript
interface Step {
  id: string;
  name: string;
  event: 'click' | 'input' | 'enter' | 'open';
  path: string;      // XPath
  value: string;
  label: string;
  x: number;
  y: number;
  bundle?: LocatorBundle;
}

// State Management:
const [recordedSteps, setRecordedSteps] = useState<Step[]>([]);
const [isRecording, setIsRecording] = useState(false);
const [logs, setLogs] = useState<Log[]>([]);
```

**Key Operations**:
- Start recording: `chrome.runtime.sendMessage({ action: 'open_project_url_and_inject' })`
- Stop recording: `chrome.runtime.sendMessage({ action: 'close_opened_tab' })`
- Receive steps: `chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'logEvent') ... })`
- Update step: `chrome.runtime.sendMessage({ action: 'update_project_steps', payload: { id, recorded_steps } })`
- Drag-and-drop: `<DragDropContext onDragEnd={handleReorder}>`

#### FieldMapper.tsx (523 lines)
**Purpose**: CSV upload, auto-mapping, manual field associations
```typescript
interface Field {
  field_name: string;        // CSV column name
  mapped: boolean;
  inputvarfields: string;    // Mapped step label
}

// State Management:
const [csvData, setCsvData] = useState<any[]>([]);
const [parsedFields, setParsedFields] = useState<Field[]>([]);
const [recordedSteps, setRecordedSteps] = useState<Step[]>([]);
```

**Key Operations**:
- Upload CSV: `Papa.parse(file, { complete: (results) => setCsvData(results.data) })`
- Auto-map: `findBestMatch(csvColumn, stepLabels)` using string-similarity
- Save mappings: `chrome.runtime.sendMessage({ action: 'update_project_fields', payload: { id, parsed_fields } })`
- Navigate to Test Runner: `window.location.href = createPageUrl('index.html#/TestRunner?project=123')`

#### TestRunner.tsx (809 lines)
**Purpose**: Test execution, progress tracking, logs, results
```typescript
interface TestStep {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
}

// State Management:
const [isRunning, setIsRunning] = useState(false);
const [progress, setProgress] = useState(0);
const [logs, setLogs] = useState<Log[]>([]);
const [testSteps, setTestSteps] = useState<TestStep[]>([]);
```

**Key Operations**:
- Start test: `executeTest(project, csvData, fieldMappings)`
- Execute step: `await chrome.tabs.sendMessage(tabId, { type: 'runStep', data: step })`
- Update progress: `setProgress((currentStep / totalSteps) * 100)`
- Save results: `chrome.runtime.sendMessage({ action: 'createTestRun', payload: testRun })`

### Component Library (Radix UI Wrappers)
- **Button**: `<Button variant="default|outline|destructive" size="sm|md|lg">`
- **Card**: `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>`
- **Dialog**: `<Dialog><DialogTrigger><DialogContent>...</DialogContent></Dialog>`
- **Input**: `<Input type="text|email|password" placeholder="..." />`
- **Table**: `<Table><TableHeader><TableRow><TableHead>...</TableHead></TableRow></TableHeader><TableBody>...</TableBody></Table>`
- **Select**: `<Select><SelectTrigger><SelectContent><SelectItem>...</SelectItem></SelectContent></SelectTrigger></Select>`

### Styling Patterns (Tailwind CSS)
```tsx
// Dark theme with gradient backgrounds
className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"

// Glass morphism cards
className="glass-effect bg-slate-800/30 border-slate-700/50"

// Status indicators
className="text-green-400"  // Success
className="text-red-400"    // Error
className="text-yellow-400" // Warning
className="text-blue-400"   // Info
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **UI Components = Presentation Layer**: No business logic, only coordination via messaging
- **React Hooks for State**: useState, useEffect, useCallback—no class components
- **Radix UI for Primitives**: Use Radix components for accessibility—don't rebuild from scratch

### Layering Restrictions
- **Must use chrome.runtime.sendMessage**: Cannot import background.ts or indexedDB.ts directly
- **Must operate in extension page context**: Cannot access page DOM—use content scripts for that

### Performance Constraints
- **Virtual Scrolling Needed**: Rendering 1000+ steps/projects causes lag—use react-window (not implemented)
- **Debounced Search**: Search input should debounce at 300ms to avoid excessive filtering
- **Lazy Loading**: Don't load all test run history at once—paginate or load on demand (not implemented)

### Error Handling Rules
- **Show User-Friendly Errors**: Never show raw exception messages—translate to human-readable text
- **Toast Notifications**: Use alerts for non-blocking feedback (success, info)
- **Modal Dialogs**: Use for blocking confirmations (delete project, discard changes)

### Security Requirements
- **No dangerouslySetInnerHTML**: Never render user input as HTML—XSS risk
- **Escape XPath/CSS Selectors**: Display selectors as code blocks, not executable
- **Validate File Uploads**: Check file type and size before parsing CSV

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **State Update After Unmount**: If component unmounts while async operation pending, setState throws "Can't perform state update on unmounted component". Solution: Use cleanup function in useEffect.

2. **Message Listener Memory Leak**: Adding `chrome.runtime.onMessage.addListener` in useEffect without cleanup causes multiple listeners. Must `removeListener` in cleanup.

3. **Drag-and-Drop State Sync**: When reordering steps, must update IndexedDB immediately—otherwise state and DB diverge. If update fails, must revert UI state.

4. **File Upload Large Files**: Parsing 100k-row CSV freezes UI for 10+ seconds. Need Web Worker or progressive parsing (not implemented).

5. **React Router Hash Mode**: Extension pages use hash-based routing (#/Dashboard) because file:// protocol doesn't support pushState. Must use `createPageUrl()` helper for navigation.

### Common Pitfalls
- **Forgetting Key Prop**: Rendering lists without `key` prop causes React reconciliation bugs (wrong items deleted)
- **Mutating State Directly**: `steps[0].value = 'new'` doesn't trigger re-render—must use `setSteps([...steps])`
- **Stale Closure in useEffect**: Using state variable in useEffect without including in dependency array causes stale reads
- **Double Message Listeners**: Multiple useEffect calls register multiple listeners—causes duplicate log entries

### Maintenance Traps
- **Component Size**: Dashboard (1,286 lines), TestRunner (809 lines) are too large—need decomposition
- **Prop Drilling**: Passing callbacks 3-4 levels deep (Dashboard → Modal → Form → Input)—need context or state management
- **No TypeScript Strictness**: `any` types in many props—loses type safety benefits

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/ui-components_breakdown.md`
  - Complete component tree (pages, sub-components, Radix wrappers)
  - State management patterns (hooks, Redux usage)
  - Routing configuration (React Router)
  - Styling system (Tailwind utilities, custom classes)

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/ui-components_mod-plan.md` (to be populated)
  - Decompose large pages into smaller, reusable components
  - Extract shared logic to custom hooks (useProjects, useTestExecution)
  - Implement proper state management (Context API or Zustand)
  - Add virtual scrolling for large lists

### Implementation Guidelines
- **Implementation Guide**: N/A (not planned—UI patterns are framework-specific, not core automation logic)

### Related Systems
- **Background Service**: All storage and tab operations routed through background
- **Recording Engine**: Sends logEvent messages to Recorder page
- **Test Orchestrator**: Coordinates with TestRunner page for execution
- **Storage Layer**: Provides data for all pages (projects, steps, CSV, test runs)
