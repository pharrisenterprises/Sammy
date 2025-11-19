# message-bus_breakdown.md

## Purpose
Communication infrastructure connecting all extension contexts (background, content scripts, popup, pages) using chrome.runtime, chrome.tabs, and window.postMessage APIs.

## Inputs
- **Background Messages**: { action: string, payload?: any } from extension pages (15+ action types)
- **Content Script Messages**: { type: string, data: any } from background (runStep, pageLoaded)
- **Cross-Context Messages**: { type: string, ...fields } via window.postMessage (logEvent, AUTOCOMPLETE_INPUT/SELECTION, REPLAY_AUTOCOMPLETE)

## Outputs
- Response format: { success: boolean, data?: any, error?: string, id?: number }
- Event broadcasts: one-way messages (logEvent) from content script to extension pages
- Command acknowledgements: async responses with operation results

## Internal Architecture
- **Background Router** (background.ts lines 15-270): chrome.runtime.onMessage listener with 20+ action handlers following pattern: extract payload → async operation → sendResponse → return true
- **Content Script Listener** (content.tsx lines 800-850): Handles runStep messages, executes playAction(), returns success/failure via sendResponse
- **Page Context Bridge** (page-interceptor.tsx + content.tsx): window.postMessage for shadow DOM events, window.addEventListener for message reception
- **Action Types**: Storage ops (add/update/get/delete_project, test runs), tab management (openTab, close_opened_tab), recording events (logEvent)

## Critical Dependencies
- **Files**: src/background/background.ts, src/contentScript/content.tsx, src/contentScript/page-interceptor.tsx, all UI pages
- **Browser APIs**: chrome.runtime.sendMessage/onMessage, chrome.tabs.sendMessage, window.postMessage/addEventListener
- **Subsystems**: Connects UI ↔ Background ↔ Content Scripts ↔ Page Context, enables Recording Engine → Recorder UI, Test Runner → Replay Engine

## Hidden Assumptions
- Message channel requires 'return true' in listener for async operations - forgetting causes silent failures
- Action names are magic strings - typos cause message routing failures ("get_all_project" vs "get_all_projects")
- Chrome message size limit (64MB) - large payloads (CSV data) could fail serialization
- No timeout handling - messages can hang indefinitely if handler never responds
- No request tracking - cannot correlate request/response pairs for debugging
- window.postMessage trusts origin="*" - no security validation of message source

## Stability Concerns
- **Missing Return True**: Forgetting 'return true' in async handlers causes responses to fail silently
- **Type Inconsistency**: Different message formats ("action" vs "type" field) across contexts creates confusion
- **No Message Registry**: Action names not centrally defined - easy to introduce typos
- **Context Confusion**: Hard to trace which context originated a message in distributed flow
- **Weak Type Safety**: TypeScript doesn't enforce message contracts at runtime
- **Race Conditions**: Messages can arrive out of order or be dropped without notification

## Edge Cases
- **Service Worker Suspension**: Background script (Manifest V3) can terminate mid-message - messages lost
- **Tab Closure**: chrome.tabs.sendMessage fails if target tab closed - no graceful degradation
- **Cross-Origin Iframes**: Cannot sendMessage to cross-origin content scripts - silently fails
- **Multiple Listeners**: If multiple handlers registered for same action, only first response used
- **Serialization Failures**: Complex objects with functions/DOM nodes cannot be passed via messages
- **Concurrent Requests**: No queuing mechanism - rapid-fire messages may overwhelm handlers

## Developer-Must-Know Notes
- Background router has 20+ action handlers - adding new actions requires modifying monolithic listener
- Message format differs by context: "action" in background messages, "type" in content/page messages
- chrome.runtime.sendMessage is async but uses callback pattern, not Promises (legacy API)
- window.postMessage requires checking event.source === window to prevent external message injection
- sendResponse must be called synchronously OR listener must return true - mixed semantics
- Content script logEvent() broadcasts to all extension pages - no targeted messaging
- Replay commands use chrome.tabs.sendMessage requiring specific tabId - stored in background global state
- Page-context scripts cannot access chrome APIs - must relay through content script via window.postMessage

## 2. Primary Responsibilities

1. **Message Routing**: Direct messages to appropriate handlers based on action/type
2. **Context Bridging**: Connect background ↔ extension pages ↔ content scripts ↔ page context
3. **Request/Response Pairing**: Match async responses to original requests
4. **Error Propagation**: Surface errors from any context back to callers
5. **Type Safety**: Ensure message contracts are respected (currently weak)
6. **Channel Management**: Keep message channels open for async responses
7. **Event Broadcasting**: Notify multiple listeners of system events

## 3. Dependencies

### Files
- `src/background/background.ts` (347 lines) - Main message router
- `src/contentScript/content.tsx` (1,446 lines) - Content script message handling
- `src/contentScript/page-interceptor.tsx` (107 lines) - Page context messaging
- All UI pages (Dashboard, Recorder, Mapper, Runner) - Message senders

### Browser APIs
- `chrome.runtime.sendMessage()` - Extension page → Background
- `chrome.runtime.onMessage` - Listen for messages in any context
- `chrome.tabs.sendMessage()` - Background → Content script (specific tab)
- `window.postMessage()` - Content script ↔ Page context
- `window.addEventListener("message")` - Listen to postMessage

## 4. Inputs / Outputs

### Message Format Standards

#### Background Messages (Extension → Background)
```typescript
{
  action: string,  // Operation identifier
  payload?: any    // Operation data
}
```

**Actions**:
- Storage: `add_project`, `update_project`, `get_all_projects`, `delete_project`, `get_project_by_id`, `update_project_steps`, `update_project_fields`, `update_project_csv`
- Test Runs: `createTestRun`, `updateTestRun`, `getTestRunsByProject`
- Tab Management: `openTab`, `close_opened_tab`, `openDashBoard`, `open_project_url_and_inject`

#### Content Script Messages (Extension → Content Script)
```typescript
{
  type: string,   // Message type
  data: any       // Message payload
}
```

**Types**:
- `runStep` - Execute recorded step in page
- `pageLoaded` - Page finished loading

#### Cross-Context Messages (Content ↔ Page)
```typescript
{
  type: string,   // Event type
  [key: string]: any  // Event-specific data
}
```

**Types**:
- `logEvent` - Step recorded (Content → Extension Pages)
- `AUTOCOMPLETE_INPUT` - User typed in autocomplete (Page → Content)
- `AUTOCOMPLETE_SELECTION` - User selected option (Page → Content)
- `REPLAY_AUTOCOMPLETE` - Replay autocomplete action (Content → Page)

### Response Format
```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  id?: number
}
```

## 5. Interactions with Other Subsystems

### Routes Messages Between
- **UI Components** ↔ **Background Service** (storage operations, tab management)
- **Background Service** ↔ **Content Scripts** (inject scripts, replay commands)
- **Content Scripts** ↔ **Page Context** (shadow DOM events, autocomplete)
- **Recording Engine** → **Recorder UI** (captured events)
- **Test Runner** → **Replay Engine** (execution commands)

### Communication Patterns

#### 1. Request/Response (Async)
```
Dashboard → Background (get_all_projects)
Background → IndexedDB query
Background ← Projects data
Background → Dashboard (response)
```

#### 2. Command/Acknowledgement
```
Test Runner → Background (openTab)
Background → chrome.tabs.create()
Background → Content Script (inject main.js)
Background → Test Runner (success + tabId)
```

#### 3. Event Broadcasting (One-Way)
```
User clicks element
Recording Engine captures event
Content Script → Extension Pages (logEvent)
Recorder UI updates step list
```

## 6. Internal Structure

### Background Message Router (`background.ts` lines 15-270)

#### Handler Pattern
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message.action) return false;
  
  try {
    if (message.action === "ACTION_NAME") {
      // Handle action
      someAsyncOperation()
        .then(result => sendResponse({ success: true, ...result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;  // ⚠️ CRITICAL: Keep channel open
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
    return false;
  }
});
```

**Actions Handled** (20+ handlers):
1. `add_project` - Create new project
2. `update_project` - Update project metadata
3. `get_all_projects` - List all projects
4. `delete_project` - Delete project
5. `get_project_by_id` - Fetch single project
6. `open_project_url_and_inject` - Open tab + inject scripts
7. `update_project_steps` - Save recorded steps
8. `update_project_fields` - Save field mappings
9. `update_project_csv` - Save CSV data
10. `createTestRun` - Insert test run record
11. `updateTestRun` - Update test run status
12. `getTestRunsByProject` - Query test history
13. `openTab` - Open new tab + inject
14. `close_opened_tab` - Close tracked tab
15. `openDashBoard` - Open extension dashboard

### Content Script Message Listener (`content.tsx` lines 800-850)

#### Replay Message Handler
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'runStep') return false;
  
  try {
    const { event, bundle, value, label } = message.data;
    updateNotification({ label, value, status: "loading" });
    
    // Execute step
    const success = await playAction(bundle, action);
    
    updateNotification({ label, value, status: success ? "success" : "error" });
    sendResponse(success);
    return true;
  } catch (error) {
    updateNotification({ label: "Error", value: String(error), status: "error" });
    sendResponse(false);
    return true;
  }
});
```

#### Recording Event Broadcast
```typescript
const logEvent = (data) => {
  chrome.runtime.sendMessage({ type: "logEvent", data });
};
```

### Cross-Context Messaging (`content.tsx` + `page-interceptor.tsx`)

#### Page → Content (Autocomplete Events)
```typescript
// In page-interceptor.tsx
window.postMessage({
  type: "AUTOCOMPLETE_INPUT",
  value: input.value,
  xpath: getXPath(input),
  label: input.name
}, "*");

// In content.tsx
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.type === "AUTOCOMPLETE_INPUT") {
    logEvent({ eventType: 'input', ... });
  }
});
```

#### Content → Page (Replay Commands)
```typescript
// In content.tsx
window.postMessage({
  type: "REPLAY_AUTOCOMPLETE",
  actions: [{ type: "AUTOCOMPLETE_SELECTION", xpath, text }]
}, "*");

// In replay.ts
window.addEventListener("message", (e) => {
  if (e.data?.type === "REPLAY_AUTOCOMPLETE") {
    replayAutocompleteActions(e.data.actions);
  }
});
```

### UI Component Message Senders

#### Dashboard Example
```typescript
chrome.runtime.sendMessage(
  { action: "get_all_projects" },
  (response) => {
    if (response?.success) {
      setProjects(response.projects);
    }
  }
);
```

#### Test Runner Example
```typescript
const response = await chrome.runtime.sendMessage({
  action: "openTab",
  url: target_url
});

if (response.success) {
  const tabId = response.tabId;
  await chrome.tabs.sendMessage(tabId, {
    type: "runStep",
    data: stepData
  });
}
```

## 7. Complexity Assessment

**Complexity Rating**: 🟡 **MEDIUM** (6/10)

### Why Complexity Exists

1. **Multiple Contexts**: 4 different execution contexts (background, content, page, extension pages)
2. **Async Challenges**: Promises, callbacks, sendResponse timing issues
3. **Type Inconsistency**: Different message formats (`action` vs `type` field)
4. **Channel Management**: Must return `true` to keep async channels open
5. **Error Handling**: Errors can occur in any context, must propagate correctly
6. **Race Conditions**: Messages can arrive out of order or be dropped
7. **No Message Registry**: Action names are magic strings, easy to typo

### Risks

1. **Missing Return True**: Forgetting `return true` causes async responses to fail silently
2. **Message Name Typos**: `"get_all_project"` vs `"get_all_projects"` (easy to miss)
3. **Serialization Limits**: Chrome message size limit (64MB), can't send huge objects
4. **Context Confusion**: Hard to trace which context a message originates from
5. **No Timeout Handling**: Messages can hang indefinitely if handler fails
6. **No Request Tracking**: Can't correlate request/response pairs for debugging
7. **Weak Type Safety**: TypeScript doesn't enforce message contracts

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Create Typed Message Contracts**:
   ```typescript
   // Message definitions
   interface AddProjectMessage {
     action: 'add_project';
     payload: Omit<Project, 'id'>;
   }
   
   interface AddProjectResponse {
     success: boolean;
     id?: number;
     error?: string;
   }
   
   type BackgroundMessage = 
     | AddProjectMessage
     | UpdateProjectMessage
     | GetAllProjectsMessage
     | ...;
   ```

2. **Build Message Bus Abstraction**:
   ```typescript
   class MessageBus {
     // Send message with type safety
     send<T extends Message>(message: T): Promise<ResponseFor<T>> {
       return new Promise((resolve, reject) => {
         chrome.runtime.sendMessage(message, (response) => {
           if (response.success) resolve(response);
           else reject(new Error(response.error));
         });
       });
     }
     
     // Register typed handler
     on<T extends Message>(
       action: T['action'],
       handler: (message: T) => Promise<ResponseFor<T>>
     ): void {
       // Register with chrome.runtime.onMessage
     }
   }
   ```

3. **Add Request Tracking**:
   ```typescript
   class RequestTracker {
     private pending = new Map<string, PendingRequest>();
     
     track(requestId: string, timeout: number): Promise<Response> {
       // Create promise that resolves when response arrives
       // Reject if timeout expires
     }
     
     resolve(requestId: string, response: Response): void {
       // Match response to request
     }
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Unified Message Format**:
   - Standardize on single format across all contexts
   - Use `type` field everywhere (not `action` vs `type`)
   - Add metadata: `requestId`, `timestamp`, `sender`

5. **Message Middleware**:
   ```typescript
   interface MessageMiddleware {
     before?(message: Message): Message | void;
     after?(response: Response): Response | void;
     error?(error: Error): Error | void;
   }
   
   // Example middlewares:
   // - LoggingMiddleware (trace all messages)
   // - ValidationMiddleware (check message schemas)
   // - RetryMiddleware (auto-retry on failure)
   // - CachingMiddleware (cache responses)
   ```

6. **Add Message Queue**:
   - Buffer messages if recipient not ready
   - Retry failed messages with exponential backoff
   - Dead letter queue for permanently failed messages

7. **Implement Telemetry**:
   - Track message latency (request → response time)
   - Monitor message failure rates
   - Alert on abnormal patterns (spike in errors)

**Complexity Reduction Target**: Low-Medium (4/10) after refactoring

### Key Improvements from Refactoring

- **Type Safety**: Compile-time checking prevents message contract violations
- **Debuggability**: Request tracking enables message flow tracing
- **Reliability**: Timeouts and retries prevent hanging requests
- **Maintainability**: Central registry of messages (self-documenting)
- **Testability**: Mock message bus for unit tests
- **Observability**: Telemetry provides visibility into message patterns
