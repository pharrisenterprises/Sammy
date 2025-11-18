# UI COMPONENTS BREAKDOWN

## 1. Summary

The UI Components system is the **presentation and interaction layer** that provides user-facing interfaces for project management, step recording, field mapping, and test execution. Built with React, Tailwind CSS, and Radix UI primitives, it offers a modern, accessible interface distributed across four major pages: Dashboard, Recorder, Field Mapper, and Test Runner.

**Importance**: ⭐⭐⭐⭐ (High - primary user interaction point)

## 2. Primary Responsibilities

1. **Project Management**: Create, edit, delete, search automation projects
2. **Recording Interface**: Display captured steps, enable editing and reordering
3. **Field Mapping**: Visualize CSV-to-step associations, auto-mapping
4. **Test Execution**: Show progress, logs, results, history
5. **State Management**: Maintain UI state (local React hooks + minimal Redux)
6. **User Feedback**: Alerts, notifications, loading states, error messages
7. **Routing**: Navigate between pages (React Router)
8. **Responsive Design**: Adapt to different screen sizes

## 3. Dependencies

### Files (Pages)
- `src/pages/Dashboard.tsx` (1,286 lines) - Project list and management
- `src/pages/Recorder.tsx` (626 lines) - Step recording interface
- `src/pages/FieldMapper.tsx` (523 lines) - CSV mapping UI
- `src/pages/TestRunner.tsx` (809 lines) - Test execution interface

### Component Libraries
- `src/components/Dashboard/` - CreateProjectDialog, EditProjectModal, ProjectStats, ConfirmationModal
- `src/components/Recorder/` - RecorderToolbar, StepsTable, LogPanel
- `src/components/Mapper/` - FieldMappingTable, FieldMappingPanel, MappingSummary, WebPreview
- `src/components/Runner/` - TestConsole, TestResults, TestSteps
- `src/components/Ui/` - Radix UI wrappers (button, card, dialog, input, table, etc.)
- `src/components/Header.tsx` - Top navigation bar

### External Libraries
- **React** (18.2.0) - UI framework
- **React Router DOM** (6.24.0) - Routing
- **Radix UI** - Component primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS** (3.4.17) - Styling
- **Lucide React** - Icons
- **@hello-pangea/dnd** - Drag-and-drop for step reordering
- **date-fns** - Date formatting
- **Redux Toolkit** - Minimal state management (theme only)

## 4. Inputs / Outputs

### Inputs (From Background/Storage)
- **Project Data**: List of projects, project details, recorded steps
- **Test Run History**: Past executions with results
- **CSV Data**: Imported data rows for mapping
- **Real-Time Events**: Recording events, replay progress updates

### Outputs (To Background/Storage)
- **User Actions**: Create/update/delete projects, start recording, run tests
- **Configuration**: Field mappings, CSV associations, project settings
- **Commands**: Start/stop recording, execute steps, export data

### Component Props Patterns

#### Dashboard Props
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'testing' | 'complete';
  created_date: number;
  updated_date: number;
}
```

#### Recorder Props
```typescript
interface Step {
  id: string;
  name: string;
  event: 'click' | 'input' | 'enter' | 'open';
  path: string;  // XPath
  value: string;
  label: string;
  x: number;
  y: number;
  bundle?: LocatorBundle;
}
```

#### Field Mapper Props
```typescript
interface Field {
  field_name: string;    // CSV column name
  mapped: boolean;       // Is mapped to a step?
  inputvarfields: string; // Mapped step label
}
```

#### Test Runner Props
```typescript
interface TestStep {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration: number;
  error_message: string | null;
}
```

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Storage Layer** → Fetches projects, test runs, steps via messages
- **Recording Engine** → Receives real-time step events
- **Replay Engine** → Sends execution commands, receives status updates
- **Message Bus** → All communication with background/content scripts

### Dependents (Provides To)
- **Users** ← Visual interface for all automation operations
- **Background Service** ← User-initiated actions (create, update, delete)
- **Content Scripts** ← Recording start/stop, replay commands

### Communication Flow
```
User clicks "Record" button
Dashboard → Background (open_project_url_and_inject)
Background → Opens tab + injects content script
Recording Engine → Captures events
Content Script → Extension (logEvent)
Recorder UI → Updates step list in real-time
User clicks "Save"
Recorder UI → Background (update_project_steps)
Background → IndexedDB write
```

## 6. Internal Structure

### Page Components

#### Dashboard (`src/pages/Dashboard.tsx` - 1,286 lines)

**Sections**:
1. **Header** (lines 1-100)
   - Project count display
   - Search bar
   - "New Project" button

2. **Stats Cards** (lines 100-200)
   - Total projects count
   - Projects by status (draft, testing, complete)
   - Recent test runs summary

3. **Project Grid** (lines 200-400)
   - Card-based project list
   - Search/filter functionality
   - Action buttons (Open, Edit, Delete, Duplicate)
   - Status badges
   - Last updated timestamps

4. **Modals** (lines 400-500)
   - CreateProjectDialog (name, description, target URL)
   - EditProjectModal (update metadata)
   - ConfirmationModal (delete confirmation)

**State Management**:
```typescript
const [projects, setProjects] = useState<Project[]>([]);
const [searchTerm, setSearchTerm] = useState<string>("");
const [isLoading, setIsLoading] = useState<boolean>(true);
const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
```

**Key Operations**:
- Load projects: `chrome.runtime.sendMessage({ action: "get_all_projects" })`
- Create project: `CreateProjectDialog` → background message
- Delete project: `ConfirmationModal` → background message
- Navigate to Recorder: `<Link to={createPageUrl(\`Recorder?project=${id}\`)}>`

#### Recorder (`src/pages/Recorder.tsx` - 626 lines)

**Sections**:
1. **Toolbar** (lines 1-150)
   - Record/Stop button (toggles recording state)
   - Add Step (manual step insertion)
   - Export Steps (Excel/CSV export)
   - Export Headers (CSV headers only)

2. **Steps Table** (lines 150-400)
   - Drag-and-drop reordering (@hello-pangea/dnd)
   - Editable cells (label, event, path, value)
   - Delete button per row
   - Real-time updates from recording events

3. **Log Panel** (lines 400-500)
   - Timestamped log entries
   - Color-coded levels (info, success, error)
   - Auto-scroll to latest entry
   - Clear logs button

**State Management**:
```typescript
const [recordedSteps, setRecordedSteps] = useState<Step[]>([]);
const [logs, setLogs] = useState<Log[]>([]);
const [isRecording, setIsRecording] = useState<boolean>(false);
const [currentProject, setCurrentProject] = useState<Project | null>(null);
```

**Real-Time Event Handling**:
```typescript
useEffect(() => {
  const listener = (message, sender, sendResponse) => {
    if (message.type === "logEvent" && isRecording) {
      const newStep = {
        id: `step_${Date.now()}`,
        name: `${eventType} Event`,
        event: eventType,
        label, path, value, x, y, bundle
      };
      setRecordedSteps(prev => [...prev, newStep]);
      updateProjectSteps(projectId, updatedSteps);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}, [isRecording, recordedSteps]);
```

#### Field Mapper (`src/pages/FieldMapper.tsx` - 523 lines)

**Sections**:
1. **Header** (lines 1-100)
   - Progress bar (mapped fields / total fields)
   - Upload CSV button
   - Auto-Map button (fuzzy matching)
   - Save button
   - Run Test button

2. **Target URL Card** (lines 100-150)
   - Editable input for starting URL
   - Used by Test Runner to know where to begin

3. **Mapping Table** (lines 150-400)
   - CSV field names (left column)
   - Dropdown selector (right column) - select from recorded steps
   - Mapped status indicator (checkmark or empty)
   - Preview of first CSV row value

4. **Auto-Mapping Logic** (lines 400-500)
   - Uses `string-similarity` library
   - Compares CSV column names to step labels
   - Threshold: 0.3 (30% similarity)
   - Normalizes strings (lowercase, remove spaces/underscores)

**State Management**:
```typescript
const [fields, setFields] = useState<Field[]>([]);
const [recordedSteps, setRecordedSteps] = useState<RecordedStep[]>([]);
const [csvdata, setCsvdata] = useState<[]>([]);
const [isMapping, setIsMapping] = useState<boolean>(false);
```

**CSV Upload Flow**:
```typescript
handleCSVUpload(file) {
  Papa.parse(file, { header: true }, (result) => {
    const headers = Object.keys(result.data[0]);
    const fields = headers.map(h => ({ field_name: h, mapped: false, inputvarfields: "" }));
    setFields(fields);
    setCsvdata(result.data.slice(0, 10)); // Preview first 10 rows
  });
}
```

#### Test Runner (`src/pages/TestRunner.tsx` - 809 lines)

**Sections**:
1. **Control Bar** (lines 1-100)
   - Run/Stop/Reset buttons
   - Current project name display

2. **Status Cards** (lines 100-200)
   - Test status (running, completed, failed)
   - Progress percentage
   - Steps passed count
   - Steps failed count

3. **Steps Panel** (lines 200-400) - Left side
   - List of all steps with status icons
   - Current step highlighted
   - Duration per step
   - Error messages (if failed)

4. **Tabs Panel** (lines 400-700) - Right side
   - **Console Tab**: Real-time log output (color-coded)
   - **Results Tab**: Summary of current run (passed/failed breakdown)
   - **History Tab**: Past test runs with timestamps

**Execution Loop** (lines 500-700):
```typescript
const runTest = async () => {
  const rows = csv_data || [{}]; // CSV rows or single empty row
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const steps = recorded_steps.map(s => ({ ...s }));
    
    // Open tab
    const { tabId } = await chrome.runtime.sendMessage({ action: "openTab", url });
    
    // Execute each step
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      
      // Inject CSV value if available
      if (row[step.label]) step.value = row[step.label];
      
      // Send to content script
      await chrome.tabs.sendMessage(tabId, {
        type: "runStep",
        data: step
      });
      
      // Update UI
      updateStepStatus(stepIndex, "passed", duration);
      setProgress((stepIndex + 1) / steps.length * 100);
    }
  }
};
```

### Shared UI Components (`src/components/Ui/`)

Radix UI wrappers with Tailwind styling:
- `button.tsx` - Button variants (default, outline, destructive, ghost)
- `card.tsx` - Card, CardHeader, CardTitle, CardContent
- `dialog.tsx` - Modal dialogs
- `input.tsx` - Text inputs with validation styling
- `table.tsx` - Table, TableHeader, TableRow, TableCell
- `tabs.tsx` - Tabbed interface
- `badge.tsx` - Status badges
- `progress.tsx` - Progress bar
- `alert.tsx` - Alert messages (success, error, warning, info)

**Styling Pattern**:
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-blue-500 text-white hover:bg-blue-600",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-slate-600 bg-transparent hover:bg-slate-700"
      }
    }
  }
);
```

## 7. Complexity Assessment

**Complexity Rating**: 🟡 **MEDIUM** (6/10)

### Why Complexity Exists

1. **Large Page Components**: Dashboard (1,286 lines), Test Runner (809 lines) are too large
2. **Mixed Concerns**: Pages handle UI + state + messaging + business logic
3. **Real-Time Updates**: Event listeners in useEffect with complex dependencies
4. **CSV Processing**: Parsing, validation, mapping logic embedded in UI
5. **Drag-and-Drop**: @hello-pangea/dnd requires verbose setup
6. **Multiple Modal States**: Create, Edit, Delete modals with separate state management

### Risks

1. **Component Size**: Large files hard to maintain, test, refactor
2. **State Complexity**: Many useState hooks per page (6-10 per component)
3. **Effect Dependencies**: useEffect with many dependencies prone to bugs
4. **Prop Drilling**: Some data passed through 3+ component levels
5. **No Error Boundaries**: React errors crash entire page
6. **Inconsistent Patterns**: Different pages handle similar operations differently
7. **Minimal Redux Usage**: Redux setup but rarely used (theme only)

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Split Large Pages**:
   - Dashboard → `ProjectList` + `ProjectCard` + `ProjectActions` + `ProjectStats`
   - Recorder → `RecordingToolbar` + `StepsList` + `StepEditor` + `LogViewer`
   - Field Mapper → `CSVUploader` + `MappingTable` + `MappingRow` + `AutoMapper`
   - Test Runner → `ExecutionControls` + `StepProgress` + `ConsoleOutput` + `ResultsView`

2. **Extract Custom Hooks**:
   ```typescript
   // useProjects.ts
   function useProjects() {
     const [projects, setProjects] = useState<Project[]>([]);
     const [isLoading, setIsLoading] = useState(true);
     
     const loadProjects = async () => { /* ... */ };
     const createProject = async (data) => { /* ... */ };
     const deleteProject = async (id) => { /* ... */ };
     
     return { projects, isLoading, loadProjects, createProject, deleteProject };
   }
   
   // useRecording.ts
   function useRecording(projectId) {
     const [steps, setSteps] = useState<Step[]>([]);
     const [isRecording, setIsRecording] = useState(false);
     
     const startRecording = () => { /* ... */ };
     const stopRecording = () => { /* ... */ };
     
     return { steps, isRecording, startRecording, stopRecording };
   }
   ```

3. **Add React Context for Global State**:
   ```typescript
   const ProjectContext = createContext<ProjectContextType | null>(null);
   
   function useProject() {
     const context = useContext(ProjectContext);
     if (!context) throw new Error("useProject must be within ProjectProvider");
     return context;
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Component Library Organization**:
   - Atomic Design: atoms (button, input) → molecules (form field) → organisms (project card) → templates (page layout)
   - Storybook for component documentation and testing
   - Design tokens for consistent spacing, colors, typography

5. **Add Error Boundaries**:
   ```typescript
   <ErrorBoundary fallback={<ErrorPage />}>
     <Dashboard />
   </ErrorBoundary>
   ```

6. **Improve State Management**:
   - Decide: Fully commit to Redux OR remove it entirely
   - If Redux: Migrate all cross-page state (projects, currentProject, etc.)
   - If no Redux: Use React Context + useReducer for complex state

7. **Add Testing**:
   - Jest + React Testing Library for component tests
   - Mock chrome APIs for extension context
   - Test user flows (create project, record step, run test)

**Complexity Reduction Target**: Low-Medium (4/10) after refactoring

### Key Improvements from Refactoring

- **Maintainability**: Smaller components easier to understand and modify
- **Reusability**: Extracted hooks and components used across pages
- **Testability**: Small units easier to test in isolation
- **Performance**: Smaller components re-render less frequently
- **Developer Experience**: Clear separation of concerns, easier onboarding
