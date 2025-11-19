# content-script-system_breakdown.md

## Purpose
Page-level automation infrastructure combining recording, replay, shadow DOM handling, and cross-context communication. Runs in content script context (isolated from page JavaScript) and coordinates with page-injected scripts.

## Inputs
- **Recording Mode**: User interactions (clicks, inputs, keyboard events), DOM element references, event coordinates
- **Replay Mode**: chrome.tabs.sendMessage with { type: "runStep", data: { event, bundle, value, label } }
- **Page Context**: window.postMessage with AUTOCOMPLETE_INPUT/SELECTION events from page-interceptor.tsx

## Outputs
- **Recording Events**: chrome.runtime.sendMessage({ type: "logEvent", data: { eventType, xpath, bundle, value, label, page, x, y } }) to extension pages
- **Replay Results**: sendResponse(success: boolean) back to Test Runner
- **Page Commands**: window.postMessage({ type: "REPLAY_AUTOCOMPLETE", actions: [...] }) to page context replay.ts
- **Notification UI**: Temporary overlay div showing step progress (loading/success/error)

## Internal Architecture
- **Dual-Mode Handler** (content.tsx lines 1-1,446): Recording logic (lines 1-800), replay logic (lines 850-1,446), shared helpers (lines 200-450)
- **Event Listeners** (lines 50-400): handleClick(), handleInput(), handleKeyDown() attached to document + all iframes recursively
- **Iframe Coordinator** (lines 550-650): attachToAllIframes() with MutationObserver for dynamic iframe detection, recursive injection
- **Shadow DOM Integration**: getFocusedElement() traverses shadow boundaries, resolveXPathInShadow() uses __realShadowRoot from interceptor
- **Script Injection** (lines 750-800): injectScript() dynamically adds page-interceptor.tsx and replay.ts to page context
- **Message Bridge** (lines 800-850): chrome.runtime.onMessage for replay commands, window.addEventListener("message") for page events
- **Page-Context Scripts**: page-interceptor.tsx (107 lines) monkey-patches Element.prototype.attachShadow, replay.ts (152 lines) handles Google Autocomplete

## Critical Dependencies
- **Files**: src/contentScript/content.tsx (1,446 lines monolith), page-interceptor.tsx (shadow DOM), replay.ts (autocomplete)
- **Libraries**: get-xpath (unused, custom implementation used), React (minimal usage in Layout component)
- **Browser APIs**: DOM Event API, Shadow DOM API (shadowRoot, getRootNode), MutationObserver, chrome.runtime messaging, window.postMessage
- **Subsystems**: Recording Engine (embedded), Replay Engine (embedded), Message Bus (chrome.runtime + window.postMessage)

## Hidden Assumptions
- Content script loads before any shadow DOM components initialize - page-interceptor must inject early
- Iframe recursion assumes cross-origin iframes fail gracefully with try-catch - no explicit CORS handling
- MutationObserver detects new iframes - assumes childList mutations fire reliably
- window.postMessage uses origin="*" - trusts all messages, no origin validation
- Notification overlay uses fixed z-index 999999 - assumes no page elements exceed this
- Script injection uses injectScript() helper - assumes scripts built to dist/ directory
- Shadow DOM __realShadowRoot property set by page-interceptor - timing dependent

## Stability Concerns
- **Monolithic Design**: 1,446 lines mixing recording, replay, helpers - difficult to test and maintain
- **Script Injection Timing**: page-interceptor.tsx must load before shadow components - race condition risk
- **Memory Leaks**: Event listeners attached recursively to iframes - not properly cleaned up when recording stops
- **Global State**: Recording state tracked in component scope - no persistence across page reloads
- **No Error Boundaries**: Uncaught errors in event handlers crash entire content script
- **Cross-Origin Limitations**: Cannot inject into cross-origin iframes - silently fails

## Edge Cases
- **Dynamic Iframes**: MutationObserver catches new iframes but may miss rapid additions/removals
- **Closed Shadow DOM**: Requires page-interceptor monkey patch - fails if script loads after component initialization
- **Google Autocomplete**: Special case requiring page-context replay.ts - doesn't work from content script alone
- **Nested Shadow Roots**: Multiple shadow boundaries require recursive traversal - limited by __realShadowRoot availability
- **Iframe Navigation**: If iframe src changes, event listeners lost - no automatic re-attachment
- **Multiple Content Scripts**: If page loads multiple times, duplicate listeners attached - events fire multiple times

## Developer-Must-Know Notes
- content.tsx contains BOTH recording AND replay logic - should be split into separate modules
- Layout component uses React but rest of file is plain TypeScript - inconsistent architecture
- Event listeners use composedPath() to traverse shadow boundaries during capture
- page-interceptor.tsx runs in page context - has full access to page JavaScript but no chrome APIs
- replay.ts also runs in page context - receives commands via window.postMessage from content script
- Notification UI created with document.createElement - not React components
- attachToAllIframes() uses recursive try-catch - assumes cross-origin failures throw errors
- window.postMessage messages must be JSON-serializable - cannot pass DOM nodes or functions

## 2. Primary Responsibilities

1. **Dual-Mode Operation**: Record mode (capture events) + Replay mode (execute steps)
2. **Event Listener Management**: Attach/detach listeners across document + iframes
3. **Iframe Coordination**: Recursively inject into nested iframes and monitor new ones
4. **Shadow DOM Penetration**: Handle open shadow roots, expose closed roots via interception
5. **Cross-Context Messaging**: Coordinate with page scripts via window.postMessage
6. **Script Injection**: Dynamically inject page-context scripts (interceptor, replay)
7. **Notification UI**: Show on-page progress overlay during replay
8. **Message Relay**: Bridge between extension pages and page context

## 3. Dependencies

### Files
- `src/contentScript/content.tsx` (1,446 lines) - Main content script (recording + replay)
- `src/contentScript/page-interceptor.tsx` (107 lines) - Page-context shadow DOM interceptor
- `src/contentScript/replay.ts` (152 lines) - Page-context Google Autocomplete replay handler

### External Libraries
- `get-xpath` (currently unused, XPath generation done manually)
- React (for Layout component, though minimal usage)

### Browser APIs
- DOM Event API - addEventListener, dispatchEvent
- Shadow DOM API - shadowRoot, getRootNode()
- MutationObserver - Monitor iframe additions
- chrome.runtime - sendMessage, onMessage

## 4. Inputs / Outputs

### Inputs

**From Recording Engine** (User Actions):
- Mouse clicks, keyboard input, form interactions
- DOM element references, event coordinates

**From Replay Engine** (Test Runner):
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

**From Page Context** (window.postMessage):
```typescript
{
  type: "AUTOCOMPLETE_INPUT" | "AUTOCOMPLETE_SELECTION",
  value?: string,
  text?: string,
  xpath?: string,
  label?: string
}
```

### Outputs

**To Extension Pages** (Recording Events):
```typescript
chrome.runtime.sendMessage({
  type: "logEvent",
  data: {
    eventType: 'click' | 'input' | 'enter' | 'open',
    xpath: string,
    bundle: LocatorBundle,
    value: string,
    label: string,
    page: string,
    x: number,
    y: number
  }
});
```

**To Test Runner** (Replay Results):
```typescript
sendResponse(success: boolean);
```

**To Page Context** (Replay Commands):
```typescript
window.postMessage({
  type: "REPLAY_AUTOCOMPLETE",
  actions: [
    { type: "AUTOCOMPLETE_INPUT", xpath, value },
    { type: "AUTOCOMPLETE_SELECTION", xpath, text }
  ]
}, "*");
```

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Recording Engine** → Event capture logic (embedded in content.tsx)
- **Replay Engine** → Step execution logic (embedded in content.tsx)
- **Locator Strategy** → Element finding logic (embedded in content.tsx)
- **Background Service** → Receives injection commands
- **Page Scripts** → Coordinates shadow DOM and autocomplete

### Dependents (Provides To)
- **Recorder UI** ← Sends captured events
- **Test Runner** ← Executes replay commands
- **Users** ← Shows notification overlay during execution

### Communication Channels

1. **chrome.runtime.sendMessage**: Content → Extension pages (unidirectional)
2. **chrome.runtime.onMessage**: Extension → Content (with response)
3. **window.postMessage**: Content ↔ Page scripts (bidirectional)

## 6. Internal Structure

### Main Entry Point (`content.tsx` lines 1-50)

```typescript
const Layout: React.FC = () => {
  useEffect(() => {
    initContentScript();
    return () => {
      removeListeners(document);
    };
  }, []);
  
  return null; // No UI rendered
};

export default Layout;
```

### Initialization (`content.tsx` lines 800-850)

```typescript
const initContentScript = (): void => {
  // Log page open event
  logOpenPageEvent();
  
  // Attach listeners to main document
  attachListeners(document);
  
  // Inject page-context interceptor script
  injectScript("interceptor");
  
  // Recursively attach to all iframes
  attachToAllIframes(window);
  
  // Set up message listener for replay commands
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
};

window.addEventListener("load", () => {
  chrome.runtime.sendMessage({ type: "pageLoaded" });
});
```

### Event Listener Management

**Attach Listeners** (lines 850-900):
```typescript
function attachListeners(doc: Document) {
  // Capture phase ensures we see events before page handlers
  ["mousedown"].forEach(eventType => {
    doc.addEventListener(eventType, handleClick, true);
  });
  
  doc.addEventListener("input", handleInput, true);
  doc.addEventListener("keydown", handleKeyDown, true);
}

function removeListeners(doc: Document) {
  doc.removeEventListener("mousedown", handleClick, true);
  doc.removeEventListener("input", handleInput, true);
  doc.removeEventListener("keydown", handleKeyDown, true);
}
```

### Iframe Coordination

**Recursive Attachment** (lines 900-950):
```typescript
const attachToAllIframes = (win: Window) => {
  try {
    const iframes = win.document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentDocument) {
          attachListeners(iframe.contentDocument);
          
          // Recursively handle nested iframes
          attachToAllIframes(iframe.contentWindow!);
        }
      } catch (err) {
        console.warn("Cannot attach to iframe:", iframe.src, err);
      }
    });
  } catch (err) {
    console.warn("Cannot access window:", err);
  }
};
```

### Script Injection

**Dynamic Injection** (lines 950-1000):
```typescript
function injectScript(fileName: string) {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL(`js/${fileName}.js`);
  s.onload = () => s.remove(); // Clean up after execution
  (document.head || document.documentElement).appendChild(s);
}

// Usage:
injectScript("interceptor");  // Shadow DOM monkey-patch
injectScript("replay");       // Google Autocomplete handler
```

### Cross-Context Message Listener

**Page → Content** (lines 1000-1050):
```typescript
window.addEventListener("message", (event) => {
  if (event.source !== window) return; // Only accept from same window
  
  const data = event.data;
  if (!data || !data.type) return;
  
  switch (data.type) {
    case "AUTOCOMPLETE_INPUT":
      const inputEl = document.activeElement as HTMLElement;
      if (inputEl) {
        const focusedEl = getFocusedElement(inputEl);
        let bundle;
        if (focusedEl) bundle = recordElement(focusedEl);
        if (bundle) {
          bundle.xpath = data.xpath;
        }
        logEvent({
          eventType: 'input',
          xpath: data.xpath,
          bundle,
          value: data.value,
          label: data.label,
          page: window.location.href
        });
      }
      break;
    
    case "AUTOCOMPLETE_SELECTION":
      const selectedEl = document.activeElement as HTMLElement;
      if (selectedEl) {
        const focusedEl = getFocusedElement(selectedEl);
        let bundle;
        if (focusedEl) bundle = recordElement(focusedEl);
        if (bundle) {
          bundle.xpath = data.xpath;
        }
        logEvent({
          eventType: 'click',
          xpath: data.xpath,
          bundle,
          value: data.text,
          label: getLabelForTarget(focusedEl),
          page: window.location.href
        });
      }
      break;
  }
});
```

### Notification Overlay (`content.tsx` lines 1050-1150)

**Create Notification Box**:
```typescript
const ensureNotificationBox = () => {
  let box = document.getElementById("ext-test-notification");
  if (!box) {
    box = document.createElement("div");
    box.id = "ext-test-notification";
    box.style.position = "fixed";
    box.style.top = "62px";
    box.style.right = "20px";
    box.style.width = "280px";
    box.style.padding = "12px";
    box.style.borderRadius = "10px";
    box.style.background = "rgba(0,0,0,0.85)";
    box.style.color = "#fff";
    box.style.fontSize = "14px";
    box.style.zIndex = "999999";
    box.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    
    if (window.self !== window.top) return null; // Only in top frame
    document.body.appendChild(box);
  }
  return box;
};

function updateNotification({
  label,
  value,
  status
}: {
  label: string;
  value?: string;
  status: "loading" | "success" | "error";
}) {
  const box = ensureNotificationBox();
  if (!box) return;
  
  let statusText = "";
  let statusColor = "";
  
  switch (status) {
    case "loading":
      statusText = "⏳ Processing...";
      statusColor = "#3b82f6";
      break;
    case "success":
      statusText = "✅ Success";
      statusColor = "#16a34a";
      break;
    case "error":
      statusText = "❌ Failed";
      statusColor = "#dc2626";
      break;
  }
  
  box.innerHTML = `
    <div style="font-weight:600; margin-bottom:4px;">${label}</div>
    <div style="opacity:0.8; margin-bottom:6px;">${value ?? ""}</div>
    <div style="color:${statusColor}; font-weight:500;">${statusText}</div>
  `;
}
```

### Page-Context Scripts

#### Shadow DOM Interceptor (`page-interceptor.tsx`)

**Monkey-Patch attachShadow**:
```typescript
(function () {
  const origAttachShadow = Element.prototype.attachShadow;
  
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const shadow = origAttachShadow.call(this, init);
    
    if (init.mode === "closed") {
      console.log("🔍 Intercepted closed shadow root on:", this);
      
      // Expose for automation
      (this as any).__realShadowRoot = shadow;
      
      // Auto-detect Google Autocomplete
      if (this.tagName === "GMP-PLACE-AUTOCOMPLETE") {
        monitorAutocomplete(this, shadow);
      }
    }
    return shadow;
  };
})();
```

**Monitor Autocomplete**:
```typescript
function monitorAutocomplete(host: Element, shadow: ShadowRoot | Node) {
  const input = (shadow as ShadowRoot).querySelector<HTMLInputElement>("input");
  
  if (!input) {
    // Wait for lazy loading
    const observer = new MutationObserver(() => {
      const input2 = (shadow as ShadowRoot).querySelector<HTMLInputElement>("input");
      if (input2) {
        observer.disconnect();
        setupListeners(host, input2, shadow);
      }
    });
    observer.observe(shadow, { childList: true, subtree: true });
  } else {
    setupListeners(host, input, shadow);
  }
}

function setupListeners(host, input, shadow) {
  // Listen for input events
  input.addEventListener("input", (e) => {
    window.postMessage({
      type: "AUTOCOMPLETE_INPUT",
      value: e.target.value,
      xpath: getXPath(e.target),
      label: e.target.name
    }, "*");
  });
  
  // Listen for selection clicks
  shadow.addEventListener("click", (e) => {
    const li = e.target.closest("li[role='option']");
    if (li) {
      window.postMessage({
        type: "AUTOCOMPLETE_SELECTION",
        text: li.innerText || li.textContent,
        xpath: getXPath(li)
      }, "*");
    }
  });
  
  // Expose for replay
  (host as any).__autocompleteInput = input;
}
```

#### Replay Script (`replay.ts`)

**Listen for Replay Commands**:
```typescript
(function () {
  window.addEventListener("message", (e) => {
    if (e.data?.type === "REPLAY_AUTOCOMPLETE") {
      const actions = e.data.actions ?? [];
      replayAutocompleteActions(actions);
    }
  });
  
  async function replayAutocompleteActions(actions) {
    for (const action of actions) {
      if (action.type === "AUTOCOMPLETE_INPUT") {
        const host = document.querySelector("gmp-place-autocomplete");
        const input = host?.__autocompleteInput;
        if (input) {
          input.value = action.value;
          input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
      }
      
      if (action.type === "AUTOCOMPLETE_SELECTION") {
        const host = document.querySelector("gmp-place-autocomplete");
        const shadow = host?.__realShadowRoot;
        if (shadow) {
          const options = Array.from(shadow.querySelectorAll("li[role='option']"));
          const match = options.find(o =>
            o.textContent?.trim().toLowerCase() === action.text?.trim().toLowerCase()
          );
          if (match) {
            match.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          }
        }
      }
    }
  }
})();
```

## 7. Complexity Assessment

**Complexity Rating**: 🔴 **HIGH** (9/10)

### Why Complexity Exists

1. **Dual Responsibility**: Recording + Replay in same file (1,446 lines)
2. **Cross-Context Coordination**: 3 different execution contexts (content, page, extension)
3. **Iframe Management**: Recursive traversal, mutation observers, re-injection
4. **Shadow DOM Complexity**: Open roots, closed roots, monkey-patching, expose/hide
5. **Event Capture**: Must distinguish trusted vs. synthetic, clickable vs. non-clickable
6. **Timing Issues**: Scripts may load in wrong order, iframes appear dynamically
7. **Special Cases**: Google Autocomplete, Select2, contenteditable, React inputs

### Risks

1. **Monolithic File**: 1,446 lines makes maintenance, testing, debugging difficult
2. **Script Injection Order**: Interceptor must run before shadow roots attached
3. **Iframe Race Conditions**: New iframes may not get listeners attached
4. **Memory Leaks**: Event listeners not cleaned up when recording stops
5. **Context Isolation**: Page scripts can't access content script variables (by design)
6. **Monkey-Patch Fragility**: Browser updates may break attachShadow interception
7. **No Error Boundaries**: Errors in one part crash entire content script

### Refactoring Implications

**Immediate Needs** (Phase 1):

1. **Split into Separate Files**:
   - `content-coordinator.ts` - Main entry, initialization, message routing
   - `event-recorder.ts` - Recording logic (extracted from content.tsx)
   - `step-replayer.ts` - Replay logic (extracted from content.tsx)
   - `iframe-manager.ts` - Iframe traversal, listener attachment
   - `shadow-dom-handler.ts` - Open/closed shadow root handling
   - `notification-ui.ts` - On-page overlay

2. **Create Context Bridge**:
   ```typescript
   class ContextBridge {
     sendToPage(message: PageMessage): void {
       window.postMessage(message, "*");
     }
     
     sendToExtension(message: ExtensionMessage): void {
       chrome.runtime.sendMessage(message);
     }
     
     onPageMessage(handler: (message: PageMessage) => void): void {
       window.addEventListener("message", (e) => {
         if (e.source === window) handler(e.data);
       });
     }
   }
   ```

3. **Iframe Lifecycle Manager**:
   ```typescript
   class IframeCoordinator {
     private attachedFrames = new Set<HTMLIFrameElement>();
     private observer: MutationObserver;
     
     start(): void {
       // Attach to existing iframes
       // Set up MutationObserver for new iframes
     }
     
     stop(): void {
       // Clean up listeners, disconnect observer
     }
     
     private onIframeAdded(iframe: HTMLIFrameElement): void {
       // Attach listeners, track frame
     }
   }
   ```

**Long-Term Vision** (Phase 2):

4. **Decouple Recording and Replay**:
   - Separate entry points: `recorder.js`, `replayer.js`
   - Load only needed script based on mode
   - Reduce bundle size, improve performance

5. **Improve Shadow DOM Strategy**:
   - Use Chrome Extension API (if available) instead of monkey-patching
   - Graceful degradation for closed shadow roots
   - Better error messages when shadow DOM inaccessible

6. **Add Health Monitoring**:
   - Heartbeat ping to verify content script alive
   - Auto-reinject if script terminated
   - Report health status to background service

7. **Implement Cleanup**:
   - Proper event listener removal
   - Observer disconnection
   - Memory leak prevention

**Complexity Reduction Target**: Medium (6/10) after refactoring

### Key Improvements from Refactoring

- **Maintainability**: Smaller files easier to understand and modify
- **Testability**: Isolated modules can be unit tested
- **Performance**: Load only needed code, reduce memory footprint
- **Reliability**: Better error handling, cleanup, resource management
- **Debuggability**: Clear separation of concerns, easier to trace issues
