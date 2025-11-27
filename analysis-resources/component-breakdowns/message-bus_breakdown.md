# Message Bus - Component Breakdown

## 1. Purpose

The Message Bus is the Chrome Extension messaging infrastructure coordinating communication between background service worker, content scripts, UI pages (Dashboard/Recorder/TestRunner), and page context (interceptors), using chrome.runtime, chrome.tabs, and window.postMessage APIs.

**Core Responsibilities:**
- Route 20+ action types between extension components via chrome.runtime.sendMessage/onMessage
- Coordinate IndexedDB access through background script to avoid multi-context race conditions
- Forward replay commands from TestRunner UI to content script in target tab
- Relay recorded steps from content script to Recorder UI page in real-time
- Bridge page context (interceptors) and content script via window.postMessage for shadow DOM events
- Maintain async response channels with "return true" pattern for sendResponse

## 2. Inputs

- **UI Page Messages:** Dashboard, Recorder, TestRunner pages send chrome.runtime.sendMessage({ action, payload })
- **Content Script Messages:** Recording/replay logic sends chrome.runtime.sendMessage({ action, data })
- **Background Commands:** chrome.tabs.sendMessage({ action, payload }, { tabId }) from background to content scripts
- **Page Context Events:** window.postMessage({ type, data }, '*') from page-interceptor.tsx for shadow DOM exposure
- **Storage Operations:** IndexedDB CRUD requests routed through background

## 3. Outputs

- **Response Objects:** { success: true, data } or { success: false, error } via sendResponse callback
- **Broadcast Events:** Real-time step recording updates, replay progress, log messages
- **Tab-Specific Messages:** chrome.tabs.sendMessage to specific content script instances
- **Error Notifications:** chrome.runtime.lastError checked after message failures

## 4. Internal Architecture

**Primary Files:**
- `src/background/background.ts` (lines 15-270) - Message router with 20+ action handlers
- `src/contentScript/content.tsx` (lines 750-850) - Content script message listeners
- `src/contentScript/page-interceptor.tsx` (lines 50-100) - Page context postMessage bridge

**Message Flow Patterns:**

**Pattern 1: UI → Background → IndexedDB**
```typescript
// Dashboard.tsx
chrome.runtime.sendMessage({ action: "get_all_projects" }, (response) => {
  if (response.success) setProjects(response.projects);
});

// background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_all_projects") {
    DB.getAllProjects()
      .then(projects => sendResponse({ success: true, projects }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep async channel open
  }
});
```

**Pattern 2: UI → Background → Content Script**
```typescript
// TestRunner.tsx
chrome.runtime.sendMessage({ action: "start_replay", projectId, csvRow }, (response) => {
  if (response.success) setIsRunning(true);
});

// background.ts
if (message.action === "start_replay") {
  chrome.tabs.query({ active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "execute_replay", steps, csvRow }, (response) => {
      sendResponse(response);
    });
  });
  return true;
}

// content.tsx
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "execute_replay") {
    executeReplay(message.steps, message.csvRow)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
```

**Pattern 3: Content Script → UI (Real-Time Broadcast)**
```typescript
// content.tsx (during recording)
chrome.runtime.sendMessage({
  type: "logEvent",
  data: { eventType: "click", xpath: "...", label: "Submit", bundle: {...} }
});

// Recorder.tsx
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "logEvent") {
    setRecordedSteps(prev => [...prev, message.data]);
  }
});
```

**Pattern 4: Page Context → Content Script (Shadow DOM Bridge)**
```typescript
// page-interceptor.tsx (injected into page)
window.postMessage({
  type: "SHADOW_ROOT_EXPOSED",
  shadowRoot: element.__realShadowRoot,
  targetXPath: getXPath(element)
}, '*');

// content.tsx
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === "SHADOW_ROOT_EXPOSED") {
    exposedShadowRoots.set(event.data.targetXPath, event.data.shadowRoot);
  }
});
```

**20+ Action Types:**
- `add_project`, `update_project`, `delete_project`, `get_all_projects`, `get_project_by_id`
- `update_project_steps` (save recording progress)
- `getTestRunsByProject`, `add_test_run`, `update_test_run`
- `start_recording`, `stop_recording`, `start_replay`, `stop_replay`
- `execute_replay`, `step_result` (replay progress updates)
- `open_project_url_and_inject` (open tab + inject content script)
- `logEvent` (real-time recording broadcast)
- `SHADOW_ROOT_EXPOSED`, `AUTOCOMPLETE_INPUT` (page context events)

**Critical Pattern: Return True for Async**
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "async_operation") {
    someAsyncFunction()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // CRITICAL: Keeps sendResponse channel open
  }
});
```

## 5. Critical Dependencies

- **chrome.runtime API:** sendMessage (extension page → background), onMessage (receive messages)
- **chrome.tabs API:** sendMessage (background → specific tab), query (find active tab)
- **window.postMessage:** Cross-context communication (page ↔ content script)
- **chrome.storage.local:** Persist recording state across page reloads (projectId, isRecording)
- **Background Service Worker:** Must stay alive to route messages; chrome.alarms for keepalive
- **Promise Handling:** All async operations wrapped in .then/.catch with sendResponse in both paths

**Breaking Changes Risk:**
- Manifest V3 service worker lifecycle (background may terminate after 30s)
- chrome.runtime.sendMessage ~64MB size limit (large CSV/step arrays may exceed)
- window.postMessage unreliable in cross-origin iframes (blocked by CSP)

## 6. Hidden Assumptions

- **Background Script Always Alive:** No retry logic if chrome.runtime.sendMessage fails due to background termination
- **Message Order Preserved:** Assumes messages from content script processed in sequence (not guaranteed by spec)
- **Single Tab Recording:** Recording state (isRecording) stored globally; concurrent multi-tab recording not supported
- **Synchronous Message Handling:** Assumes handlers complete <5s; longer operations may timeout
- **No Message Queue:** If background busy, incoming messages may be dropped (no queue or backpressure)
- **window.postMessage Unrestricted:** Uses `targetOrigin: '*'` assuming same-origin content script (security risk if page compromised)
- **Sender Tab Always Available:** Assumes sender.tab.id exists for content script messages (fails for popup/options pages)

## 7. Stability Concerns

- **No Error Recovery:** If sendResponse fails (background dead), UI callback never fires with no error indication
- **Service Worker Termination:** Manifest V3 background script stops after 30s inactivity; mid-operation termination orphans messages
- **Message Size Limit:** Sending 10,000-step array (2MB JSON) via chrome.runtime.sendMessage may hit 64MB limit
- **Race Conditions:** Multiple tabs sending update_project simultaneously may cause last-write-wins data loss
- **No Acknowledgement Protocol:** Fire-and-forget logEvent messages not confirmed; if Recorder UI closed, events lost
- **Tight Coupling:** 20+ action types hardcoded in background.ts; adding actions requires editing central router
- **No Message Versioning:** Changing payload structure breaks compatibility between extension versions

## 8. Edge Cases

- **Background Script Restart:** Pending sendResponse callbacks invalidated; UI waits forever for response
- **Cross-Origin Iframes:** window.postMessage blocked by CSP; shadow DOM events from iframe not received
- **Large Payloads:** Sending 100MB CSV via chrome.runtime.sendMessage throws DataCloneError
- **Concurrent Recording:** Tab A and Tab B both recording; logEvent messages interleaved, corrupting recorded_steps array
- **Orphaned Messages:** Recorder UI closes mid-recording; logEvent messages from content script lost (no queue)
- **Popup Message Timing:** Popup opens, sends chrome.runtime.sendMessage before background fully initialized; message lost
- **Nested Message Handlers:** Handler A calls chrome.tabs.sendMessage, handler B in content script calls chrome.runtime.sendMessage back; creates message loop
- **Chrome Extension Context Loss:** Page reload during replay terminates content script; in-flight messages lost
- **window.postMessage Spoofing:** Malicious page can send fake SHADOW_ROOT_EXPOSED messages; no origin validation
- **Tab ID Mismatch:** chrome.tabs.sendMessage to closed tab throws "Receiving end does not exist" error

## 9. Developer-Must-Know Notes

### Return True is Non-Negotiable
- Forgetting `return true` in async onMessage handlers is #1 bug source
- Symptom: sendResponse called but UI callback never receives response
- Chrome silently closes message channel if handler doesn't return true immediately
- Use ESLint rule to enforce: `chrome-extension/no-return-missing-listener`

### Message Size Limit is 64MB
- chrome.runtime.sendMessage serializes payload via structuredClone (not JSON.stringify)
- Limit applies to total message size after serialization
- 10,000-step recording ≈ 2MB; 100,000 steps may exceed limit
- Workaround: Paginate large arrays (send in chunks) or use IndexedDB with ID references

### Background Service Worker Lifecycle is Critical
- Manifest V3 service workers terminate after 30s no activity
- Use chrome.alarms.create('keepalive', { periodInMinutes: 1 }) to prevent termination
- Long-running operations (e.g., 500-step replay) must keep worker alive

### window.postMessage Requires Origin Validation
- Current code uses `targetOrigin: '*'` (accepts messages from any origin)
- Security risk: Malicious page can spoof SHADOW_ROOT_EXPOSED events
- Fix: Use `targetOrigin: window.location.origin` and validate event.origin in listener

### No Built-In Retry Logic
- If chrome.runtime.sendMessage fails (background dead), message silently lost
- UI must implement retry: `sendWithRetry(message, maxRetries=3, delay=1000)`
- Check chrome.runtime.lastError after sendMessage:
  ```typescript
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message failed:", chrome.runtime.lastError.message);
      // Retry logic here
    }
  });
  ```

### Tab-Specific Messaging Requires Active Tab Query
- chrome.tabs.sendMessage needs tab ID; must query first:
  ```typescript
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
  ```
- Fails if no active tab (user switched windows)

### Real-Time Broadcast Pattern Has No Delivery Guarantee
- logEvent messages sent during recording; if Recorder UI not open, messages lost
- Consider buffering messages in background script if no listeners detected
- Use chrome.storage.local for critical state (e.g., isRecording flag)

### Message Versioning Critical for Updates
- Extension v1.0 sends { action: "add_project", name, url }
- Extension v1.1 expects { action: "add_project", name, url, tags }
- Background script must handle both formats:
  ```typescript
  const project = {
    name: message.payload.name,
    url: message.payload.url,
    tags: message.payload.tags || [] // Backward compatible
  };
  ```

### Testing Requires Chrome Extension Test Environment
- Cannot mock chrome.runtime in jsdom/jest (missing structuredClone, MessagePort)
- Use Puppeteer with chrome.debugger API for E2E tests
- Or test-extension package with real Chrome instance
