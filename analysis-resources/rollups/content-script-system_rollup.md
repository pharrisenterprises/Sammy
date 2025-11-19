# CONTENT SCRIPT SYSTEM ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/content-script-system_breakdown.md` (573 lines)
- `modularization-plans/content-script-system_mod-plan.md` (N/A - not created)
- `implementation-guides/content-script-system_impl.md` (N/A - not created)

**Subsystem Purpose**: The Content Script System is the page-level automation infrastructure combining recording, replay, shadow DOM handling, and cross-context communication. It runs in Chrome's content script context (isolated from page JavaScript) and coordinates with page-injected scripts for special cases.

**Criticality**: ⭐⭐⭐⭐⭐ (Maximum - bridges extension and web pages)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Dual-Mode Operation**: Record mode (capture user events) + Replay mode (execute steps)—both in same file
- **Event Listener Lifecycle**: Attach listeners on init, detach on unmount, reattach after navigation
- **Iframe Coordination**: Recursively inject into all same-origin iframes, handle nested frames
- **Shadow DOM Penetration**: Traverse open shadow roots automatically, expose closed roots via monkey-patch
- **Page Script Injection**: Dynamically inject page-context scripts (interceptor.tsx, replay.ts) for closed shadow root access
- **Cross-Context Messaging**: Coordinate with page scripts via window.postMessage (autocomplete events, replay commands)
- **Notification UI**: Show on-page progress overlay during replay (loading/success/error states)
- **Message Relay**: Bridge between extension pages (Recorder, Test Runner) and page context

### MUST NOT DO
- **Never access page variables directly**: Content script is isolated—use window.postMessage to reach page context
- **Never assume single document**: Must handle main document + multiple iframes
- **Never skip iframe chain**: XPath is relative to innermost iframe—must resolve chain first
- **Never block on slow operations**: Use setTimeout for retries, keep UI responsive

---

## 3. Interfaces & Contracts (Compressed)

### Content Script Entry Point
```typescript
// src/contentScript/content.tsx
const Layout: React.FC = () => {
  useEffect(() => {
    initContentScript(); // Attach listeners, inject page scripts
    return () => removeListeners(document); // Cleanup on unmount
  }, []);
};

function initContentScript() {
  logOpenPageEvent();                  // Send "open" event
  attachListeners(document);           // Main document
  injectScript("interceptor");         // Page-context shadow interceptor
  attachToAllIframes(window);          // Recursive iframe injection
  chrome.runtime.onMessage.addListener(handleRuntimeMessage); // Replay handler
}
```

### Recording Mode Protocol

**Input**: User interactions (clicks, input, keydown)
**Output**: Broadcast to Recorder UI
```typescript
chrome.runtime.sendMessage({
  type: "logEvent",
  data: {
    eventType: 'click' | 'input' | 'enter' | 'open',
    xpath: string,
    bundle: LocatorBundle,
    value: string,
    label: string,
    page: window.location.href,
    x: number,
    y: number
  }
});
```

### Replay Mode Protocol

**Input**: Command from Test Runner
```typescript
chrome.tabs.sendMessage(tabId, {
  type: "runStep",
  data: {
    event: 'click' | 'input' | 'enter',
    bundle: LocatorBundle,
    value?: string,
    label?: string
  }
});
```

**Output**: Synchronous response
```typescript
sendResponse(success: boolean);
```

### Page Script Coordination (window.postMessage)

**Page → Content (Closed Shadow Root Events)**:
```typescript
// From page-interceptor.tsx:
window.postMessage({
  type: "AUTOCOMPLETE_INPUT",
  value: inputValue,
  xpath: '/html/body/...',
  label: 'Search Address'
}, '*');

// Content script receives:
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'AUTOCOMPLETE_INPUT') {
    chrome.runtime.sendMessage({ type: 'logEvent', data: event.data });
  }
});
```

**Content → Page (Replay Commands)**:
```typescript
// Content script sends:
window.postMessage({
  type: "REPLAY_AUTOCOMPLETE",
  actions: [
    { type: "AUTOCOMPLETE_INPUT", xpath, value },
    { type: "AUTOCOMPLETE_SELECTION", xpath, text }
  ]
}, '*');

// Page replay.ts receives and executes
```

### Iframe Injection Flow
```typescript
function attachToAllIframes(win: Window) {
  const iframes = win.document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentDocument) { // Same-origin only
        attachListeners(iframe.contentDocument);
        attachToAllIframes(iframe.contentWindow!); // Recursive
      }
    } catch (err) {
      // Cross-origin—skip silently
    }
  });
}
```

### Shadow DOM Handling
```typescript
// Open shadow roots: traverse automatically in XPath resolution
if (element.shadowRoot) {
  doc = element.shadowRoot; // Continue traversal
}

// Closed shadow roots: expose via monkey-patch
Element.prototype.attachShadow = function(init) {
  const shadow = origAttachShadow.call(this, init);
  if (init.mode === 'closed') {
    (this as any).__realShadowRoot = shadow; // Expose hidden root
  }
  return shadow;
};
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Content Script = Isolated World**: Shares DOM with page but separate JavaScript heap—cannot access page variables
- **Dual-Mode Design**: Recording + Replay in same file (content.tsx 1,446 lines)—needs separation
- **Page Scripts for Special Cases**: Closed shadow roots require page-context scripts (interceptor, replay)

### Layering Restrictions
- **Must inject page scripts dynamically**: Cannot directly bundle page scripts—use chrome.runtime.getURL + createElement('script')
- **Must use postMessage for page communication**: No direct function calls across contexts

### Performance Constraints
- **Recursive Iframe Crawl**: attachToAllIframes() queries ALL iframes at once—O(n) where n = iframe count
- **No Mutation Observer for General DOM**: Only used in page-interceptor for Google Autocomplete—dynamic iframes missed
- **Event Handler Overhead**: Every click/input/keydown fires handlers—high CPU on fast typing

### Error Handling Rules
- **Silent Cross-Origin Failures**: try-catch swallows errors for cross-origin iframes—no user notification
- **Graceful Degradation on Injection Failure**: If page script injection fails (CSP), log warning and continue
- **Closed Shadow Root Fallback**: If __realShadowRoot not exposed, click host element (may not work)

### Security Requirements
- **Origin Validation for postMessage**: Always check `event.source === window` and optionally `event.origin`
- **No eval()**: Never execute code from postMessage data
- **Same-Origin Policy**: Only inject into same-origin iframes—cross-origin blocked by browser

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Navigation Re-injection**: On page navigation, content script reloads. Background re-injects via webNavigation.onCommitted, but recording state lost—must coordinate with Recorder UI to resume.

2. **Monkey-Patch Timing**: page-interceptor.tsx must load BEFORE page creates shadow roots. If page script runs first, closed shadow not exposed.

3. **Multiple Content Script Instances**: If background injects multiple times (navigation + manual), multiple event listeners fire—causes duplicate step recordings.

4. **Cross-Origin Iframe Silence**: Cannot inject into cross-origin iframes, but fails silently. User may expect cross-origin elements to be recordable.

5. **Shadow Root Chain**: Elements inside shadow inside shadow (nested)—must resolve entire shadowHosts chain to reach target.

### Common Pitfalls
- **Forgetting composedPath()**: Using `event.target` instead of `composedPath()` misses shadow DOM elements
- **XPath in Wrong Context**: Applying main document XPath to iframe document—must resolve iframeChain first
- **postMessage Target Ambiguity**: `window.postMessage(data, '*')` delivers to all origins—malicious frames can intercept
- **Service Worker Sleep**: If background sleeps and reawakens, may re-inject content script—causes duplicate listeners

### Maintenance Traps
- **1,446-Line Monolith**: Recording + Replay + Locator + Shadow DOM all in one file
- **No Unit Tests**: Pure integration tests—refactoring risks breaking both modes
- **Magic Numbers**: 30ms click delay, 150ms retry—no documentation
- **React Wrapper Unused**: Layout component wraps content script but doesn't render UI—confusing architecture

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/content-script-system_breakdown.md`
  - Dual-mode design (recording vs. replay flows)
  - Iframe coordination algorithm
  - Shadow DOM handling (open vs. closed, monkey-patch details)
  - Page script injection timing and error handling

### Modularization Roadmap
- **Modularization Plan**: N/A (not created—would involve splitting recording/replay into separate files)
  - Separate RecordingContentScript and ReplayContentScript
  - Extract ShadowDOMHandler and IframeCoordinator
  - Extract PageScriptInjector

### Implementation Guidelines
- **Implementation Guide**: N/A (not created—content script is Chrome extension-specific infrastructure)

### Related Systems
- **Recording Engine**: Embedded in content.tsx (event handlers, label detection)
- **Replay Engine**: Embedded in content.tsx (element finding, action execution)
- **Background Service**: Injects content script, relays messages
- **Page Interceptor**: Exposes closed shadow roots, monitors autocomplete
- **Page Replay Script**: Handles Google Autocomplete replay in page context
