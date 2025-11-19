# background-service_breakdown.md

## Purpose
Central coordinator running as Manifest V3 service worker that manages persistent state, routes messages between contexts, controls tab lifecycle, injects content scripts, and coordinates IndexedDB operations.

## Inputs
- Messages from extension pages: { action: string, payload?: any } with 15+ action types
- Tab events: webNavigation.onCommitted, onCompleted for page load monitoring
- Installation events: onInstalled for extension lifecycle
- Icon clicks: action.onClicked to open dashboard

## Outputs
- Responses to callers: { success: boolean, data?: any, id?: number, tabId?: number, error?: string }
- Tab operations: chrome.tabs.create() for new tabs, chrome.tabs.remove() for cleanup
- Script injections: chrome.scripting.executeScript() to inject content scripts
- Storage operations: proxied to Dexie DB singleton

## Internal Architecture
- **Message Router** (background.ts lines 15-270): chrome.runtime.onMessage listener with 20+ action handlers following pattern: extract payload → async DB operation → sendResponse → return true
- **Tab Manager** (lines 100-150): openedTabId global tracking, trackedTabs Set for multi-tab support, injectMain() helper for script injection
- **Storage Coordinator** (lines 15-200): Routes storage actions (add/update/get/delete_project, test run operations) to DB methods
- **Lifecycle Handlers** (lines 1-15): ensurePersistentStorage() on startup, onInstalled event listener
- **Navigation Listeners** (lines 270-320): webNavigation events for page load detection and script re-injection

## Critical Dependencies
- **Files**: src/background/background.ts (347 lines service worker)
- **Libraries**: dexie via DB singleton for IndexedDB operations
- **Browser APIs**: chrome.runtime (onMessage, sendMessage), chrome.tabs (create, remove, sendMessage), chrome.scripting (executeScript), chrome.webNavigation (onCommitted, onCompleted), chrome.action (onClicked), navigator.storage.persist()
- **Subsystems**: Routes between UI Components ↔ Storage Layer, Test Runner ↔ Content Scripts

## Hidden Assumptions
- Service worker can be suspended at any time (Manifest V3) - must not rely on in-memory state surviving
- openedTabId global tracks last opened tab - assumes single recording session at a time
- Script injection uses chrome.scripting.executeScript with files array - scripts must be in manifest web_accessible_resources
- navigator.storage.persist() requested but not guaranteed - browser may revoke at any time
- All message handlers return true to keep channel open - forgetting causes silent failures
- webNavigation events fire for all tabs - handlers must filter by trackedTabs Set

## Stability Concerns
- **Service Worker Suspension**: Can terminate mid-operation, losing openedTabId and trackedTabs state
- **No State Persistence**: Global variables (openedTabId, trackedTabs) not persisted to chrome.storage - lost on restart
- **Single Tab Tracking**: openedTabId assumes one active recording - doesn't support concurrent sessions
- **Injection Timing**: injectMain() called immediately after tab creation - may execute before page loads
- **No Retry Logic**: Failed injections not retried - content script missing causes replay failures
- **Message Handler Errors**: Try-catch only in some handlers - unhandled errors crash service worker

## Edge Cases
- **Rapid Tab Operations**: Opening/closing tabs quickly may cause race conditions with openedTabId tracking
- **Cross-Origin Frames**: Script injection fails silently for cross-origin iframes - no error notification
- **Tab Navigation**: If user navigates tracked tab to different URL, content script lost - no re-injection
- **Concurrent Projects**: Multiple projects opened in different tabs - trackedTabs doesn't associate tab with project
- **Service Worker Restart**: openedTabId reset to null, orphans any open recording tabs
- **Injection Failure**: chrome.scripting.executeScript errors not propagated to caller - assumes success

## Developer-Must-Know Notes
- background.ts runs in service worker context - no access to DOM, window, or localStorage
- All async operations must use 'return true' pattern in onMessage listener to keep response channel open
- DB singleton imported from indexedDB.ts - service worker has IndexedDB access via Dexie
- injectMain() injects js/main.js - path relative to extension root, must match build output
- trackedTabs Set stores tabIds but not project context - cannot determine which project tab belongs to
- ensurePersistentStorage() called on startup but persistence not guaranteed - quota limits still apply
- chrome.action.onClicked only fires if no popup defined in manifest - used to open dashboard
- webNavigation listeners fire for all navigation events - must check trackedTabs.has(tabId)

## 2. Primary Responsibilities

1. **Message Routing**: Direct chrome.runtime messages to appropriate handlers
2. **Tab Management**: Open, close, track browser tabs for automation
3. **Script Injection**: Dynamically inject content scripts into target pages
4. **Storage Coordination**: Route IndexedDB operations from UI to Dexie
5. **Lifecycle Management**: Handle extension install, update, uninstall events
6. **Persistent State**: Track opened tabs, recording state, active projects
7. **Dashboard Launch**: Open extension pages when icon clicked
8. **Storage Persistence**: Request and maintain persistent storage quota

## 3. Dependencies

### Files
- `src/background/background.ts` (347 lines) - Service worker implementation

### External Libraries
- `dexie` - IndexedDB operations via `DB` singleton

### Browser APIs
- `chrome.runtime.onMessage` - Receive messages from extension pages/content scripts
- `chrome.runtime.onInstalled` - Extension installation event
- `chrome.action.onClicked` - Extension icon click handler
- `chrome.tabs.create()` - Open new tabs
- `chrome.tabs.remove()` - Close tabs
- `chrome.scripting.executeScript()` - Inject scripts into tabs
- `chrome.webNavigation.onCommitted` - Tab navigation events
- `chrome.webNavigation.onCompleted` - Page load events
- `navigator.storage.persist()` - Request persistent storage

## 4. Inputs / Outputs

### Inputs (Messages from Extension Pages)
All messages follow this format:
```typescript
{
  action: string,  // Operation name
  payload?: any    // Operation data
}
```

**Storage Actions**:
- `add_project`, `update_project`, `get_all_projects`, `delete_project`, `get_project_by_id`
- `update_project_steps`, `update_project_fields`, `update_project_csv`
- `createTestRun`, `updateTestRun`, `getTestRunsByProject`

**Tab Actions**:
- `openTab` - Open new tab + inject content script
- `close_opened_tab` - Close last opened tab
- `open_project_url_and_inject` - Open project URL + inject
- `openDashBoard` - Open extension dashboard page

### Outputs (Responses to Callers)
```typescript
{
  success: boolean,
  data?: any,      // Query results (projects, test runs)
  id?: number,     // Created resource ID
  tabId?: number,  // Opened tab ID
  error?: string   // Error message if failed
}
```

## 5. Interactions with Other Subsystems

### Routes Between
- **UI Components** ↔ **Background** ↔ **Storage Layer**
- **Test Runner** ↔ **Background** ↔ **Content Scripts** (via tabs API)
- **Recorder** ↔ **Background** ↔ **Content Scripts**

### Message Flow Examples

**Example 1: Create Project**
```
Dashboard → Background (add_project)
Background → DB.addProject()
Background → Dashboard (success + id)
```

**Example 2: Run Test**
```
Test Runner → Background (openTab)
Background → chrome.tabs.create()
Background → chrome.scripting.executeScript()
Background → Test Runner (success + tabId)
Test Runner → chrome.tabs.sendMessage(tabId, runStep)
Content Script → Executes step
Content Script → Test Runner (success)
```

## 6. Internal Structure

### Initialization (`background.ts` lines 1-15)

```typescript
import { DB } from "../common/services/indexedDB";

// Request persistent storage on startup
async function ensurePersistentStorage() {
  if ('storage' in navigator && navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    console.log("Storage persisted?", isPersisted);
    
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log("Persistence granted:", granted);
    }
  }
}

ensurePersistentStorage();
```

### State Management (lines 15-18)

```typescript
let openedTabId: number | null = null;        // Last opened tab for recording
const trackedTabs = new Set<number>();        // All tabs with injected scripts
```

### Message Router (lines 18-270)

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message.action) return false;
  
  try {
    // Route based on action field
    if (message.action === "ACTION_NAME") {
      // Handle action
      asyncOperation()
        .then(result => sendResponse({ success: true, ...result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
    return false;
  }
});
```

#### Storage Handlers (20+ handlers)

**Add Project**:
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
  return true;
}
```

**Get All Projects**:
```typescript
if (message.action === "get_all_projects") {
  DB.getAllProjects()
    .then(projects => sendResponse({ success: true, projects }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true;
}
```

**Update Project Steps**:
```typescript
if (message.action === "update_project_steps") {
  const { id, recorded_steps } = message.payload;
  DB.projects.update(id, { recorded_steps })
    .then(() => sendResponse({ success: true }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true;
}
```

#### Tab Management Handlers

**Open Tab + Inject**:
```typescript
if (message.action === "openTab") {
  const target_url = message.url;
  
  chrome.tabs.create({ url: target_url }, (tab) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    
    if (!tab?.id) {
      sendResponse({ success: false, error: "No tab ID returned" });
      return;
    }
    
    // Inject content script
    injectMain(tab.id, (result) => {
      if (result.success) {
        openedTabId = tab.id;
        trackedTabs.add(tab.id);
        sendResponse({ success: true, tabId: tab.id });
      } else {
        sendResponse({ success: false, error: result.error });
      }
    });
  });
  
  return true;
}
```

**Close Opened Tab**:
```typescript
if (message.action === "close_opened_tab") {
  if (openedTabId !== null) {
    chrome.tabs.remove(openedTabId, () => {
      openedTabId = null;
      sendResponse({ success: true });
    });
  } else {
    sendResponse({ success: false, error: "No opened tab to close" });
  }
  return true;
}
```

### Script Injection Helper (lines 270-290)

```typescript
function injectMain(tabId: number, cb?: (result: any) => void) {
  chrome.scripting.executeScript(
    {
      target: { tabId, allFrames: true }, // Inject into main + all iframes
      files: ["js/main.js"]
    },
    () => {
      if (chrome.runtime.lastError) {
        console.warn("Inject failed:", chrome.runtime.lastError.message);
        cb?.({ success: false });
      } else {
        console.log("Injected main.js into tab", tabId);
        cb?.({ success: true });
      }
    }
  );
}
```

### Navigation Listeners (lines 290-320)

**Re-inject on Navigation**:
```typescript
chrome.webNavigation.onCommitted.addListener((details) => {
  if (trackedTabs.has(details.tabId)) {
    console.log("Frame navigated:", details.frameId, details.url);
    injectMain(details.tabId); // Re-inject after navigation
  }
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (trackedTabs.has(details.tabId)) {
    injectMain(details.tabId); // Re-inject after page load
  }
});
```

### Extension Lifecycle Handlers (lines 320-347)

**Icon Click**:
```typescript
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("pages.html")
  });
});
```

**First Install**:
```typescript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages.html#dashboard")
    });
  }
});
```

## 7. Complexity Assessment

**Complexity Rating**: 🟡 **MEDIUM** (6/10)

### Why Complexity Exists

1. **Message Volume**: 20+ different message types to handle
2. **Async Coordination**: Must return `true` to keep channels open, easy to forget
3. **Tab Tracking**: Maintain set of tracked tabs, re-inject on navigation
4. **Error Handling**: Different error sources (DB, tabs API, injection failures)
5. **Injection Timing**: Scripts may need re-injection after navigation, iframe loads
6. **State Persistence**: Service worker can be terminated, state must be recoverable

### Risks

1. **Service Worker Termination**: Chrome can kill service worker after 30 seconds idle
2. **Lost State**: `openedTabId` and `trackedTabs` lost if service worker restarted
3. **Injection Races**: Content script may not be ready when Test Runner sends messages
4. **No Request Validation**: Malformed messages not validated before processing
5. **Missing Return True**: Forgetting `return true` causes async responses to fail
6. **Tab Leaks**: Tabs may not be cleaned up if error occurs during lifecycle
7. **No Rate Limiting**: No protection against message flooding

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Extract Message Router**:
   ```typescript
   class MessageRouter {
     private handlers = new Map<string, MessageHandler>();
     
     register(action: string, handler: MessageHandler): void {
       this.handlers.set(action, handler);
     }
     
     handle(message: Message, sender: Sender, sendResponse: Response): boolean {
       const handler = this.handlers.get(message.action);
       if (!handler) return false;
       return handler(message, sender, sendResponse);
     }
   }
   ```

2. **Create Tab Manager Service**:
   ```typescript
   class TabManager {
     private openTabs = new Map<number, TabState>();
     
     async open(url: string): Promise<number> {
       // Create tab, inject script, return tab ID
     }
     
     async close(tabId: number): Promise<void> {
       // Close tab, remove from tracking
     }
     
     isTracked(tabId: number): boolean {
       return this.openTabs.has(tabId);
     }
     
     async reinjectAll(): Promise<void> {
       // Re-inject scripts into all tracked tabs
     }
   }
   ```

3. **Add State Persistence**:
   ```typescript
   class BackgroundState {
     async save(key: string, value: any): Promise<void> {
       await chrome.storage.local.set({ [key]: value });
     }
     
     async load(key: string): Promise<any> {
       const result = await chrome.storage.local.get(key);
       return result[key];
     }
     
     async restore(): Promise<void> {
       // Restore openedTabId, trackedTabs from chrome.storage
     }
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Add Health Checks**:
   - Verify service worker alive
   - Ping tabs to check script injection status
   - Auto-reinject if scripts lost

5. **Implement Keep-Alive**:
   - Use chrome.alarms to prevent service worker termination
   - Maintain WebSocket connection (if needed)
   - Periodic heartbeat messages

6. **Add Request Validation**:
   ```typescript
   interface MessageValidator {
     validate(message: Message): ValidationResult;
   }
   
   class AddProjectValidator implements MessageValidator {
     validate(message) {
       if (!message.payload.name) return { valid: false, error: "Name required" };
       // ... more checks
       return { valid: true };
     }
   }
   ```

7. **Add Telemetry**:
   - Log message frequency and latency
   - Track tab lifecycle events
   - Monitor injection failures
   - Alert on abnormal patterns

**Complexity Reduction Target**: Low-Medium (4/10) after refactoring

### Key Improvements from Refactoring

- **Reliability**: State persistence survives service worker termination
- **Maintainability**: Modular handlers easier to test and extend
- **Debuggability**: Better logging and telemetry
- **Robustness**: Validation prevents invalid operations
- **Performance**: Health checks prevent redundant operations
