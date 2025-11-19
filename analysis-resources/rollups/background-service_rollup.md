# BACKGROUND SERVICE ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/background-service_breakdown.md` (428 lines)
- `modularization-plans/background-service_mod-plan.md` (N/A - not created)
- `implementation-guides/background-service_impl.md` (N/A - not created)

**Subsystem Purpose**: The Background Service is the central coordinator running as a Manifest V3 service worker. It manages persistent state, routes messages between contexts, controls tab lifecycle, injects content scripts, and coordinates IndexedDB operations. It's the nervous system connecting all extension parts.

**Criticality**: ⭐⭐⭐⭐⭐ (Maximum - enables distributed architecture)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Message Routing**: Direct chrome.runtime messages to appropriate handlers based on `action` field (20+ action types)
- **Tab Management**: Open new tabs for automation, track opened tabs, close tabs on command
- **Script Injection**: Dynamically inject content scripts via chrome.scripting.executeScript (main.js, interceptor.js, replay.js)
- **Storage Coordination**: Route all IndexedDB operations from UI pages to Dexie singleton
- **Lifecycle Management**: Handle extension install (request persistent storage), icon clicks (open dashboard)
- **Re-injection on Navigation**: Listen to webNavigation events, re-inject content script after page navigation
- **Persistent State**: Track `lastOpenedTabId` for close_opened_tab action
- **Dashboard Launch**: Open extension pages when icon clicked or via openDashBoard action

### MUST NOT DO
- **Never perform business logic**: Background routes and coordinates—logic lives in UI or content scripts
- **Never block on long operations**: Use async/await for all DB queries, tab operations
- **Never trust sender context**: Validate sender.tab.id before privileged operations (not currently implemented)
- **Never leak tab IDs**: Close tabs after use, don't accumulate orphaned tabs

---

## 3. Interfaces & Contracts (Compressed)

### Message Protocol (Extension Pages → Background)
```typescript
{
  action: string,    // Operation identifier
  payload?: any      // Operation-specific data
}

// Response:
{
  success: boolean,
  data?: any,        // Query results
  id?: number,       // Created resource ID
  tabId?: number,    // Opened tab ID
  error?: string
}
```

### Action Catalog (20+ Actions)

**Storage Operations**:
- `add_project`: Create new project → `DB.projects.add(payload)`
- `update_project`: Update project → `DB.projects.update(id, updates)`
- `get_all_projects`: Query all → `DB.projects.toArray()`
- `delete_project`: Delete → `DB.projects.delete(id)`
- `get_project_by_id`: Get single → `DB.projects.get(id)`
- `update_project_steps`: Update recorded_steps → `DB.projects.update(id, {recorded_steps})`
- `update_project_fields`: Update parsed_fields → `DB.projects.update(id, {parsed_fields})`
- `update_project_csv`: Update csv_data → `DB.projects.update(id, {csv_data})`
- `createTestRun`: Create test run → `DB.testRuns.add(payload)`
- `updateTestRun`: Update test run → `DB.testRuns.update(id, updates)`
- `getTestRunsByProject`: Query test runs → `DB.testRuns.where('project_id').equals(pid).sortBy('start_time')`

**Tab Operations**:
- `openTab`: Open URL in new tab + inject content script
- `close_opened_tab`: Close last opened tab (tracked in `lastOpenedTabId`)
- `open_project_url_and_inject`: Load project, open target_url, inject script
- `openDashBoard`: Open extension dashboard page

### Script Injection Flow
```typescript
// 1. Create tab:
const tab = await chrome.tabs.create({ url: targetUrl });

// 2. Inject content script:
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['js/main.js']
});

// 3. Content script auto-injects page scripts:
const script = document.createElement('script');
script.src = chrome.runtime.getURL('js/interceptor.js');
document.head.appendChild(script);
```

### Re-injection on Navigation
```typescript
// Background listens for navigation:
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['js/main.js']
    });
  }
});
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Background = Service Worker**: Lives in background context, no UI, no DOM access
- **Message Hub**: All cross-context communication routes through background
- **Storage Owner**: Only context with direct Dexie access (UI pages must message)

### Layering Restrictions
- **No UI Components**: Cannot render UI—must open extension pages for that
- **No Content Script Imports**: Cannot import content script code—must inject as file

### Performance Constraints
- **Service Worker Lifecycle**: May sleep after 30s inactivity—must handle wake-up gracefully
- **Message Size Limit**: chrome.runtime.sendMessage limited to ~64MB (practical limit ~1MB)
- **Tab Accumulation**: If tabs not closed, can accumulate 100+ tabs—memory leak

### Error Handling Rules
- **Wrap All DB Operations**: Use try-catch, return `{success: false, error: msg}` on failure
- **Check chrome.runtime.lastError**: After every Chrome API call, check for errors
- **Log Injection Failures**: If script injection fails (CSP, permissions), log warning but don't throw

### Security Requirements
- **Validate Sender Context**: Should check `sender.tab.id` and `sender.frameId` (not implemented)
- **No eval()**: Never eval message payload data
- **Persistent Storage Request**: Request navigator.storage.persist() to prevent data loss

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Service Worker Sleep**: After 30s inactivity, service worker may sleep. Chrome APIs still work on wake, but in-memory state (e.g., `lastOpenedTabId`) is lost.

2. **Content Script Injection Failure**: If page has strict CSP, script injection fails silently. Background should check `chrome.runtime.lastError` and notify user.

3. **Navigation During Recording**: User navigates to new page while recording. webNavigation.onCommitted fires, re-injects content script, but recording state lost (content script doesn't know it was recording).

4. **Multiple onCommitted Events**: Single navigation may fire multiple onCommitted events (main frame + subframes). Must filter by `details.frameId === 0`.

5. **Tab Closed Before Message Sent**: If tab closes before chrome.tabs.sendMessage sent, throws "No tab with id" error. Must catch and handle gracefully.

### Common Pitfalls
- **Forgetting `return true`**: Async message handlers must `return true` to keep channel open—forgetting causes "sendResponse callback expired"
- **Mutating DB Objects**: Dexie returns frozen objects in some cases—direct mutation throws error
- **Service Worker State Assumptions**: Don't rely on in-memory state (e.g., `lastOpenedTabId`)—should store in chrome.storage.local
- **Injection Timing**: Injecting script immediately after tab.create may fail if page not loaded—should wait for webNavigation.onCompleted

### Maintenance Traps
- **347-Line Message Router**: Single onMessage handler with 20+ if/else branches—hard to maintain
- **No Type Safety**: `payload: any` means typos in property names fail silently
- **Magic String Actions**: Action names are literals—no enum or constants file
- **No Unit Tests**: Pure integration tests—refactoring is high-risk

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/background-service_breakdown.md`
  - Complete action catalog (storage, tab, lifecycle operations)
  - Message flow diagrams (UI ↔ background ↔ content script)
  - Script injection details (timing, error handling)
  - Service worker lifecycle management

### Modularization Roadmap
- **Modularization Plan**: N/A (not created—background service is already single-file coordinator)
  - Could extract message router to separate classes per action category
  - Could add typed message interfaces

### Implementation Guidelines
- **Implementation Guide**: N/A (not created—background service is Chrome extension-specific coordination layer)

### Related Systems
- **Storage Layer**: Hosts Dexie singleton, routes all DB operations
- **Message Bus**: Background is the central hub for message routing
- **Content Script System**: Background injects content scripts, relays messages
- **UI Components**: All UI pages message background for operations
