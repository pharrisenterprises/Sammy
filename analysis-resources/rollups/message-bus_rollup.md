# MESSAGE BUS ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/message-bus_breakdown.md` (392 lines)
- `modularization-plans/message-bus_mod-plan.md` (empty - to be populated)
- `implementation-guides/message-bus_impl.md` (empty - to be populated)

**Subsystem Purpose**: The Message Bus is the communication infrastructure connecting all extension contexts (background, content scripts, popup, extension pages, page context). It routes messages, pairs requests with responses, and bridges isolated worlds without tight coupling.

**Criticality**: ⭐⭐⭐⭐ (High - enables distributed architecture across contexts)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Context Bridging**: Connect background ↔ extension pages ↔ content scripts ↔ page context
- **Message Routing**: Direct messages to appropriate handlers based on `action` or `type` field
- **Request/Response Pairing**: Match async responses to original requests via callback system
- **Error Propagation**: Surface errors from any context back to callers in standardized format
- **Channel Management**: Keep message channels open for async operations (`return true` in listeners)
- **Event Broadcasting**: Notify multiple listeners of system events (e.g., `logEvent` to all extension pages)
- **Cross-Context Serialization**: Handle structured cloning for complex objects across boundaries

### MUST NOT DO
- **Never block message handlers**: Long-running operations must use `sendResponse` callback or `return true`
- **Never trust message sender**: Validate sender context (tab ID, frame ID) before executing privileged operations
- **Never send Promises**: chrome.runtime.sendMessage cannot serialize Promises—must unwrap first
- **Never assume delivery**: Messages can fail silently if recipient context destroyed—check for `chrome.runtime.lastError`

---

## 3. Interfaces & Contracts (Compressed)

### Message Format Standards

#### Background Messages (Extension Pages → Background)
```typescript
{
  action: string,    // Operation identifier (e.g., 'add_project', 'openTab')
  payload?: any      // Operation-specific data
}

// Response:
{
  success: boolean,
  data?: any,
  error?: string,
  id?: number
}
```

**Catalog of Actions** (20+ total):
- **Storage**: `add_project`, `update_project`, `get_all_projects`, `delete_project`, `get_project_by_id`, `update_project_steps`, `update_project_fields`, `update_project_csv`
- **Test Runs**: `createTestRun`, `updateTestRun`, `getTestRunsByProject`
- **Tab Management**: `openTab`, `close_opened_tab`, `openDashBoard`, `open_project_url_and_inject`
- **Injection**: `injectMain` (internal)

#### Content Script Messages (Extension → Content Script)
```typescript
{
  type: string,      // Message type (e.g., 'runStep', 'pageLoaded')
  data?: any         // Type-specific payload
}

// Response: varies by type (often just boolean)
```

**Message Types**:
- `runStep`: Execute recorded step in page (from Test Runner)
- `pageLoaded`: Page finished loading (from content script to background)

#### Cross-Context Messages (Content Script ↔ Page Context)
```typescript
{
  type: string,      // Event type (e.g., 'logEvent', 'AUTOCOMPLETE_INPUT')
  [key: string]: any // Event-specific data
}

// No structured response—window.postMessage is fire-and-forget
```

**Event Types**:
- `logEvent`: Step recorded (Content → Extension Pages)
- `AUTOCOMPLETE_INPUT`: User typed in Google Autocomplete (Page → Content)
- `AUTOCOMPLETE_SELECTION`: User selected autocomplete option (Page → Content)
- `REPLAY_AUTOCOMPLETE`: Replay autocomplete action (Content → Page)

### Communication Patterns

#### 1. Request/Response (Async)
```typescript
// Sender (Dashboard):
chrome.runtime.sendMessage({ action: 'get_all_projects' }, (response) => {
  if (response.success) {
    setProjects(response.data);
  }
});

// Receiver (Background):
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'get_all_projects') {
    DB.projects.toArray().then(projects => {
      sendResponse({ success: true, data: projects });
    });
    return true; // Keep channel open for async response
  }
});
```

#### 2. Fire-and-Forget Broadcast
```typescript
// Sender (Content Script):
chrome.runtime.sendMessage({
  type: 'logEvent',
  data: { eventType: 'click', xpath: '...', ... }
});
// No response expected

// Receiver (Recorder UI):
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'logEvent') {
    setRecordedSteps(prev => [...prev, msg.data]);
  }
});
```

#### 3. Tab-Specific Messaging
```typescript
// Sender (Test Runner):
await chrome.tabs.sendMessage(tabId, {
  type: 'runStep',
  data: { event, bundle, value, label }
});

// Receiver (Content Script):
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'runStep') {
    playAction(msg.data.bundle, msg.data).then(success => {
      sendResponse(success);
    });
    return true;
  }
});
```

#### 4. Page Context Bridge (window.postMessage)
```typescript
// Sender (Page Script - closed shadow root):
window.postMessage({
  type: 'AUTOCOMPLETE_INPUT',
  value: inputElement.value,
  xpath: '/html/body/...',
  label: 'Search Address'
}, '*');

// Receiver (Content Script):
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'AUTOCOMPLETE_INPUT') {
    chrome.runtime.sendMessage({ type: 'logEvent', data: event.data });
  }
});
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Background = Central Router**: All cross-context communication flows through background script
- **Content Script = Bidirectional Bridge**: Relays messages between page context and extension
- **Extension Pages = Messaging Clients**: Cannot directly message each other—must route via background

### Layering Restrictions
- **Page Context Isolation**: Cannot use chrome.* APIs—must use window.postMessage to reach content script
- **Content Script Limits**: Can use chrome.runtime but not chrome.tabs—cannot send messages to other tabs
- **Background Privileges**: Only context that can use chrome.tabs.sendMessage to target specific tabs

### Performance Constraints
- **Message Size Limit**: chrome.runtime.sendMessage has ~64MB limit but practical limit ~1MB (large payloads slow)
- **No Batching**: Each step execution is separate message—1000 steps = 1000 messages
- **Synchronous Blocking**: UI components using `await chrome.runtime.sendMessage()` block render thread

### Error Handling Rules
- **Check chrome.runtime.lastError**: After sendMessage, always check `chrome.runtime.lastError.message` to detect delivery failure
- **Timeout on No Response**: If sendResponse never called, caller hangs indefinitely—add timeout wrapper
- **Sender Validation**: Background should validate `sender.tab.id` and `sender.frameId` before executing privileged actions

### Security Requirements
- **Origin Validation for postMessage**: Always check `event.origin` and `event.source === window` to prevent XSS
- **No eval() in Messages**: Never send code strings that are later eval'd
- **Tab ID Verification**: When using chrome.tabs.sendMessage, verify tab ID is expected (prevent message injection)

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Async Response Channel Closure**: If listener doesn't `return true`, sendResponse callback expires immediately—async operations fail silently.

2. **Multiple Listeners Same Message**: All registered listeners receive message. If multiple call `sendResponse`, only first response is sent—others ignored.

3. **Content Script Reinjection**: On navigation, content script reloads. In-flight messages to old script fail with "Receiving end does not exist" error.

4. **Tab Closure Race**: If tab closes while message in flight, sendMessage fails. Caller must handle `chrome.runtime.lastError`.

5. **postMessage Target Ambiguity**: `window.postMessage(data, '*')` delivers to all origins—malicious frames can intercept. Should use specific targetOrigin when possible.

### Common Pitfalls
- **Forgetting `return true`**: Async listener without `return true` causes "sendResponse callback expired" error
- **Serialization Failures**: Sending DOM elements, functions, or circular objects throws "could not be cloned" error
- **Race Condition on Injection**: Sending runStep before content script loaded causes "Receiving end does not exist"—must wait for pageLoaded confirmation
- **Lost Context in Callbacks**: Using `this` in sendResponse callback loses component context—use arrow functions or bind

### Maintenance Traps
- **No Type Safety**: `action` and `type` fields are string literals—typos fail silently at runtime
- **No Message Schema Validation**: Receivers assume payload structure—malformed messages cause undefined behavior
- **Magic Strings Everywhere**: Action/type names hardcoded in 10+ files—refactoring is error-prone

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/message-bus_breakdown.md`
  - Complete message action catalog (20+ actions)
  - Communication pattern examples (request/response, broadcast, tab-specific)
  - Error handling strategies
  - Performance considerations (batching, compression)

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/message-bus_mod-plan.md` (to be populated)
  - Extract to separate MessageBus class with typed methods
  - Add TypeScript interfaces for all message types
  - Implement request/response promise wrappers
  - Add message queue for batching

### Implementation Guidelines
- **Implementation Guide**: `analysis-resources/implementation-guides/message-bus_impl.md` (to be populated)
  - Best practices for Chrome extension messaging
  - Async response patterns
  - Error handling and retry logic
  - Security considerations (origin validation, tab ID verification)

### Related Systems
- **Background Service**: Hosts central message router
- **Recording Engine**: Broadcasts logEvent messages
- **Test Runner**: Sends runStep messages to content scripts
- **Storage Layer**: All CRUD operations routed through message bus
