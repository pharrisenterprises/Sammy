# UI Components - Component Breakdown

## 1. Purpose

The UI Components subsystem provides React-based extension pages (Dashboard, Recorder, TestRunner, CSV Mapper) for project management, test recording/editing, execution monitoring, and CSV field mapping, built with Material-UI/Radix/Shadcn components and Redux state management.

**Core Responsibilities:**
- Dashboard: Display projects list, create/edit/delete/duplicate projects, search/filter, navigate to Recorder/TestRunner
- Recorder: Display real-time recorded steps, start/stop recording, edit/reorder/delete steps, save to projects table
- TestRunner: Execute replay with CSV data injection, display progress (percentage, current step), show pass/fail results, console logs
- CSV Mapper: Parse CSV files, auto-detect field mappings, manual mapping UI, validate mappings before test execution

## 2. Inputs

- **Chrome Storage:** Projects from IndexedDB via chrome.runtime.sendMessage({ action: "get_all_projects" })
- **Real-Time Messages:** Recorded steps via chrome.runtime.onMessage (logEvent broadcasts)
- **User Interactions:** Button clicks, form submissions, CSV file uploads, drag-and-drop step reordering
- **URL Parameters:** project ID from hash (#/recorder?project=123)
- **CSV Files:** File upload via <input type="file"> → Papa Parse → rows array

## 3. Outputs

- **Chrome Messages:** Project CRUD via chrome.runtime.sendMessage({ action: "add_project", payload })
- **Navigation:** react-router-dom navigation to /dashboard, /recorder?project=X, /test-runner?project=X
- **File Downloads:** Export test results as JSON/CSV (planned feature)
- **Visual Feedback:** Loading spinners, success/error toasts (sonner), progress bars (Radix Progress)

## 4. Internal Architecture

**Primary Files:**
- `src/pages/Dashboard.tsx` (342 lines) - Project list, CRUD operations, search
- `src/pages/Recorder.tsx` (493 lines) - Recording UI, steps table, log panel
- `src/pages/TestRunner.tsx` (610 lines) - Replay execution, progress tracking, results display
- `src/pages/Mapper.tsx` (file not found - CSV mapping UI location TBD)
- `src/components/Dashboard/` - CreateProjectDialog, ProjectStats, ConfirmationModal, EditProjectModal
- `src/components/Recorder/` - RecorderToolbar, StepsTable, LogPanel
- `src/components/Runner/` - TestConsole, TestResults, TestSteps
- `src/components/Ui/` - Reusable button, card, input, table, progress, tabs, dialog components (Shadcn/Radix)

**Dashboard Page Structure:**
- **Header:** Title "Test Automation Dashboard", search input, "Create New Project" button
- **Stats Cards:** Total projects, active tests, success rate (calculated from testRuns)
- **Projects Grid:** Card per project with name, description, created_date, action buttons (Edit, Duplicate, Delete, Start Recording, Run Test)
- **CreateProjectDialog:** Modal form with name, description, target_url fields
- **EditProjectModal:** Edit existing project fields
- **ConfirmationModal:** Delete confirmation with project name display

**Recorder Page Structure:**
- **RecorderToolbar:** Project name, Start/Stop Recording button, Save button, Back to Dashboard button
- **StepsTable:** Drag-and-drop table (hello-pangea/dnd) with columns: Step #, Event Type, Label, XPath, Value, Actions (Edit/Delete)
- **LogPanel:** Real-time console showing timestamp, level (info/success/error), message for each recorded action
- **Data Flow:** chrome.runtime.onMessage listener receives logEvent → setRecordedSteps(prev => [...prev, newStep])

**TestRunner Page Structure:**
- **Header:** Project name, CSV data row selector (if CSV uploaded), Start/Stop/Reset buttons
- **Progress Section:** Progress bar (Radix), current step display, elapsed time, passed/failed counters
- **Tabs:** Console (logs), Results (pass/fail per step), Steps (detailed step breakdown)
- **TestConsole:** Scrollable log with timestamp, level, message (auto-scrolls to bottom)
- **TestResults:** Table with step #, status badge (passed/failed), duration, error message
- **TestSteps:** Expandable step details with bundle preview, attempted locator strategies

**State Management:**
- **Local State:** useState for projects, testRuns, isRecording, isRunning, progress, logs (no global Redux store despite @reduxjs/toolkit dependency)
- **Chrome Message Sync:** useEffect hook sends chrome.runtime.sendMessage on mount → setProjects(response.projects)
- **Real-Time Updates:** chrome.runtime.onMessage.addListener in useEffect for logEvent, step_result messages

## 5. Critical Dependencies

- **React 18.2.0:** UI framework with hooks (useState, useEffect, useRef)
- **React Router 6.24.0:** Client-side routing with hash-based navigation (#/dashboard, #/recorder?project=X)
- **Shadcn/Radix UI:** Component library (Button, Card, Input, Dialog, Progress, Tabs, Table from @radix-ui/react-*)
- **@hello-pangea/dnd 18.0.1:** Drag-and-drop for step reordering in Recorder
- **date-fns 4.1.0:** Date formatting (format(new Date(created_date), 'MMM dd, yyyy'))
- **Papa Parse 5.5.3:** CSV parsing for test data upload
- **Lucide React 0.533.0:** Icon library (Play, Square, RotateCcw, CheckCircle, XCircle, etc.)
- **sonner 2.0.7:** Toast notifications for success/error messages (planned usage)
- **Tailwind CSS 3.4.17:** Utility-first styling with custom config

**Breaking Changes Risk:**
- React 19+ may deprecate current hooks patterns
- Radix UI major version changes (breaking component API changes)
- @hello-pangea/dnd fork may diverge from react-beautiful-dnd (original library abandoned)

## 6. Hidden Assumptions

- **Single Extension Page Open:** No multi-tab state sync; opening Recorder in 2 tabs causes duplicate step recordings
- **Chrome Message Bus Always Available:** No offline queue if background script dead
- **Recorded Steps Fit in Memory:** Displaying 10,000+ steps in StepsTable may freeze UI (no virtualization)
- **CSV File Size Reasonable:** Papa Parse loads entire CSV into memory; 100MB file crashes extension
- **English UI Only:** No i18n/localization support (all strings hardcoded)
- **Desktop Browser Only:** No responsive design for mobile (assumes 1920x1080 viewport)
- **Project IDs Sequential:** Assumes auto-increment IDs from Dexie (no UUID support)

## 7. Stability Concerns

- **No Redux Store Used:** Despite @reduxjs/toolkit dependency, all state in component-local useState (harder to debug, share state)
- **Prop Drilling:** Project data passed through 3+ component levels (Dashboard → ProjectCard → EditModal)
- **No Error Boundaries:** Unhandled errors crash entire extension page (white screen)
- **Message Listener Leaks:** chrome.runtime.onMessage.addListener in useEffect without cleanup (causes duplicate handlers on re-render)
- **Large Step Arrays:** Rendering 10,000 rows in StepsTable without virtualization freezes UI (react-window needed)
- **No Loading States:** Buttons clickable during async operations (double-submit risk)
- **CSV Parsing Blocks UI:** Papa Parse runs on main thread; 50MB CSV freezes extension for 5+ seconds

## 8. Edge Cases

- **Project Deleted Mid-Recording:** Recorder page crashes if project deleted in Dashboard while recording
- **Empty CSV Upload:** Papa Parse returns [['', '']] for empty file; causes invalid test data
- **CSV with Headers:** Auto-detection may misidentify first data row as headers
- **Special Characters in Project Name:** Name with quotes/backslashes breaks JSON serialization in chrome.runtime.sendMessage
- **10,000+ Steps Recording:** StepsTable render time >5s; drag-and-drop unusable
- **Concurrent Edits:** Two tabs editing same project; last save wins (no conflict resolution)
- **TestRunner Closed Mid-Replay:** Content script continues replay but progress updates lost (no UI to show)
- **URL Parameter Tampering:** #/recorder?project=abc (non-numeric ID) causes get_project_by_id to fail
- **File Input Not Cleared:** Uploading same CSV twice doesn't trigger onChange event (input.value persists)

## 9. Developer-Must-Know Notes

### Clean Up Message Listeners in useEffect
```typescript
useEffect(() => {
  const listener = (message) => {
    if (message.type === "logEvent") setSteps(prev => [...prev, message.data]);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener); // Critical cleanup
}, []);
```

### Virtualize Large Lists with react-window
- StepsTable rendering 10,000 rows causes 5s freeze
- Use react-window FixedSizeList for O(1) render performance

### Handle CSV Parsing Errors
```typescript
Papa.parse(file, {
  complete: (results) => {
    if (results.errors.length > 0) {
      toast.error(`CSV parse failed: ${results.errors[0].message}`);
      return;
    }
    setCsvData(results.data);
  },
  worker: true // Parse on Web Worker to avoid UI blocking
});
```

### Use Redux Store for Cross-Component State
- Current component-local state makes Dashboard ↔ Recorder sync impossible
- Implement Redux store with projects, testRuns, recordingState slices

### Add Error Boundaries
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    console.error("UI Error:", error, info);
    // Show fallback UI instead of white screen
  }
}
```

### Implement URL Validation in CreateProjectDialog
- Validate target_url format (must start with http:// or https://)
- Check URL reachability with fetch() before saving (optional)

### Add Loading States and Disable Buttons
```typescript
const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = async () => {
  setIsDeleting(true);
  await deleteProject(id);
  setIsDeleting(false);
};

<Button disabled={isDeleting}>
  {isDeleting ? "Deleting..." : "Delete"}
</Button>
```

### Use react-router-dom Navigate Instead of window.location
```typescript
// Bad: Full page reload
window.location.href = `#/recorder?project=${id}`;

// Good: Client-side navigation
const navigate = useNavigate();
navigate(`/recorder?project=${id}`);
```
