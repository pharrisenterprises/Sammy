# Content Script System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Specification

## Table of Contents
1. Overview
2. Chrome Extension Context Model
3. Script Injection Strategy
4. Isolated World vs Main World
5. Iframe Traversal Logic
6. Shadow DOM Handling
7. Message Passing Architecture
8. Event Listener Attachment
9. Script Lifecycle Management
10. Debugging and Troubleshooting

---

## 1. Overview

### 1.1 Purpose

The **Content Script System** is responsible for injecting JavaScript into web pages to capture user interactions. It handles the complex challenge of running code in various page contexts (main page, iframes, shadow DOM) while maintaining isolation from page JavaScript.

### 1.2 Key Challenges

1. **Isolation** - Content scripts run in isolated world, separate from page JavaScript
2. **Iframes** - Pages can have nested iframes requiring recursive injection
3. **Shadow DOM** - Components can hide their DOM in shadow roots
4. **Timing** - Scripts must inject before user interactions occur
5. **Security** - Must not expose extension internals to page scripts

### 1.3 Design Goals

- ✅ **Universal Coverage** - Capture events in all DOM contexts
- ✅ **Non-Intrusive** - Zero impact on page functionality
- ✅ **Secure** - No data leakage to page scripts
- ✅ **Performant** - Minimal overhead on page load
- ✅ **Reliable** - Handle dynamic iframe/shadow DOM creation

---

## 2. Chrome Extension Context Model

### 2.1 Execution Contexts

Chrome extensions operate in multiple isolated contexts:

```
┌─────────────────────────────────────────────────────────────────┐
│                            WEB PAGE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         MAIN WORLD (Page JavaScript)                     │   │
│  │         - Runs page scripts                              │   │
│  │         - Has access to page variables                   │   │
│  │         - Can modify DOM                                 │   │
│  │         - No access to chrome.* APIs                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         ISOLATED WORLD (Content Scripts)                 │   │
│  │         - Runs extension content scripts                 │   │
│  │         - Has access to chrome.runtime API               │   │
│  │         - Can modify DOM                                 │   │
│  │         - Cannot see page variables/functions            │   │
│  │         - Protected from page script interference        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │                                │
           │ postMessage                    │ chrome.runtime
           │ (limited)                      │ (secure)
           ↓                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                       EXTENSION CONTEXT                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         BACKGROUND SERVICE WORKER                        │   │
│  │         - Persistent state management                    │   │
│  │         - Message routing                                │   │
│  │         - Full chrome.* API access                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Content Script Capabilities

**CAN:**
- ✅ Access and modify DOM
- ✅ Listen for DOM events
- ✅ Read computed styles
- ✅ Use chrome.runtime API
- ✅ Send messages to background

**CANNOT:**
- ❌ Access page JavaScript variables
- ❌ Call page JavaScript functions
- ❌ Access page's `window` object directly
- ❌ Use most chrome.* APIs (except runtime)

### 2.3 Manifest V3 Configuration

**manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Test Recorder",
  "version": "1.0.0",
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_start",
      "all_frames": true,
      "match_about_blank": true
    }
  ],
  
  "permissions": [
    "scripting",
    "activeTab",
    "tabs"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ]
}
```

Key configuration:
- `run_at: "document_start"` - Inject before DOM loads
- `all_frames: true` - Inject into all iframes
- `match_about_blank: true` - Handle about:blank iframes

---

## 3. Script Injection Strategy

### 3.1 Injection Methods

**Method 1: Declarative (manifest.json)**
- Defined in manifest.json
- Automatically injected by Chrome
- Runs on all matching pages
- Used for: Main content script

**Method 2: Programmatic (chrome.scripting)**
- Injected by background script
- Dynamic, on-demand injection
- Used for: Late-loaded iframes, dynamic content

### 3.2 Main Content Script Injection

Automatic injection via manifest:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

Content script initialization:

```typescript
// content-script.ts

// Check if already injected (prevent double injection)
if ((window as any).__TEST_RECORDER_INJECTED__) {
  console.log('[Content] Already injected, skipping');
} else {
  (window as any).__TEST_RECORDER_INJECTED__ = true;
  
  console.log('[Content] Injecting into:', {
    url: window.location.href,
    isTopFrame: window === window.top,
    frameDepth: getFrameDepth()
  });
  
  // Initialize recording system
  initializeRecorder();
}

function getFrameDepth(): number {
  let depth = 0;
  let current = window;
  
  while (current !== current.parent) {
    depth++;
    current = current.parent;
  }
  
  return depth;
}
```

### 3.3 Dynamic Iframe Injection

Inject into dynamically created iframes:

```typescript
// content-script.ts

// Watch for new iframes
const iframeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeName === 'IFRAME') {
        const iframe = node as HTMLIFrameElement;
        console.log('[Content] New iframe detected:', iframe.src);
        
        // Wait for iframe to load
        iframe.addEventListener('load', () => {
          injectIntoIframe(iframe);
        });
      }
    });
  });
});

iframeObserver.observe(document.documentElement, {
  childList: true,
  subtree: true
});

async function injectIntoIframe(iframe: HTMLIFrameElement) {
  try {
    // Check if iframe is accessible (same-origin)
    const iframeDoc = iframe.contentDocument;
    
    if (!iframeDoc) {
      console.warn('[Content] Cannot access iframe (cross-origin):', iframe.src);
      return;
    }
    
    // Check if already injected
    if ((iframe.contentWindow as any).__TEST_RECORDER_INJECTED__) {
      console.log('[Content] Iframe already has script');
      return;
    }
    
    // Programmatically inject
    await chrome.runtime.sendMessage({
      action: 'INJECT_INTO_IFRAME',
      payload: {
        frameId: getFrameId(iframe)
      }
    });
    
  } catch (error) {
    console.error('[Content] Failed to inject into iframe:', error);
  }
}

function getFrameId(iframe: HTMLIFrameElement): number {
  // Chrome assigns unique frame IDs
  // This would need to be tracked via chrome.webNavigation API
  // For simplicity, we'll use a placeholder
  return 0; // In real implementation, get from chrome.webNavigation
}
```

---

## 4. Isolated World vs Main World

### 4.1 Isolated World (Default)

Content scripts run in isolated world by default:

```typescript
// content-script.ts (Isolated World)

// ✅ CAN: Access chrome.runtime
chrome.runtime.sendMessage({ action: 'PING' });

// ✅ CAN: Access DOM
const button = document.querySelector('button');

// ✅ CAN: Attach event listeners
document.addEventListener('click', (e) => {
  console.log('Clicked:', e.target);
});

// ❌ CANNOT: Access page variables
console.log(window.myPageVariable); // undefined

// ❌ CANNOT: Call page functions
window.myPageFunction(); // Error: not a function
```

**Benefits:**
- ✅ Secure - Page scripts cannot interfere
- ✅ Clean - No variable collisions
- ✅ Reliable - Predictable execution

**Limitations:**
- ❌ Cannot read page state directly
- ❌ Cannot intercept page function calls
- ❌ Limited access to page-defined objects

### 4.2 Main World Injection (Advanced)

**When needed:**
- Reading page variables
- Intercepting page function calls
- Deep integration with page JavaScript

**Injection technique:**

```typescript
// content-script.ts (Isolated World)

function injectMainWorldScript() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      console.log('[Main World] Script injected');
      
      // Can access page variables
      console.log('Page variable:', window.myPageVariable);
      
      // Can intercept page functions
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        console.log('Fetch intercepted:', args);
        return originalFetch.apply(this, args);
      };
      
      // Send data to isolated world via CustomEvent
      document.dispatchEvent(new CustomEvent('pageData', {
        detail: { myPageVariable: window.myPageVariable }
      }));
    })();
  `;
  
  document.documentElement.appendChild(script);
  script.remove();
}

// Listen for data from main world
document.addEventListener('pageData', (event: CustomEvent) => {
  console.log('[Isolated World] Received from main world:', event.detail);
});

// Inject main world script
injectMainWorldScript();
```

**Communication pattern:**

```
Isolated World (Content Script)
        ↓
   Create <script> element
        ↓
   Inject into page
        ↓
Main World (Page Context)
        ↓
   Execute script
        ↓
   Dispatch CustomEvent
        ↓
Isolated World (Content Script)
        ↓
   Listen for CustomEvent
```

### 4.3 Best Practices

**Prefer Isolated World:**
- Default for 99% of use cases
- More secure
- Less complex
- No risk of page interference

**Use Main World only when:**
- Must read page variables
- Must intercept page functions
- No alternative solution exists

**Security considerations:**
- Never expose sensitive data to main world
- Validate all data received from main world
- Assume page scripts are hostile

---

## 5. Iframe Traversal Logic

### 5.1 Iframe Detection

Detect all iframes in page:

```typescript
function getAllIframes(): HTMLIFrameElement[] {
  const iframes: HTMLIFrameElement[] = [];
  
  // Get direct iframes
  const directIframes = document.querySelectorAll('iframe');
  iframes.push(...Array.from(directIframes));
  
  // Recursively get nested iframes
  directIframes.forEach(iframe => {
    try {
      const nestedIframes = iframe.contentDocument?.querySelectorAll('iframe');
      if (nestedIframes) {
        iframes.push(...Array.from(nestedIframes));
      }
    } catch (error) {
      // Cross-origin iframe, cannot access
      console.warn('[Iframe] Cannot access nested iframes:', error);
    }
  });
  
  return iframes;
}
```

### 5.2 Iframe Chain Tracking

Build iframe ancestry chain:

```typescript
function getIframeChain(): string[] {
  const chain: string[] = [];
  let current = window;
  
  while (current !== current.parent) {
    try {
      // Find iframe element in parent
      const iframes = current.parent.document.querySelectorAll('iframe');
      
      for (const iframe of iframes) {
        if (iframe.contentWindow === current) {
          // Found our iframe
          const selector = getUniqueSelector(iframe);
          chain.unshift(selector); // Add to beginning
          break;
        }
      }
      
      current = current.parent;
    } catch (error) {
      // Cross-origin, cannot traverse further
      console.warn('[Iframe] Cannot traverse parent:', error);
      break;
    }
  }
  
  return chain;
}

function getUniqueSelector(iframe: HTMLIFrameElement): string {
  if (iframe.id) {
    return `#${iframe.id}`;
  }
  
  if (iframe.name) {
    return `iframe[name="${iframe.name}"]`;
  }
  
  // Use nth-child
  const parent = iframe.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(iframe);
    return `${parent.tagName.toLowerCase()} > iframe:nth-child(${index + 1})`;
  }
  
  return 'iframe';
}
```

**Example iframe chain:**

```typescript
// Page structure:
// <html>
//   <iframe id="container">
//     <iframe name="inner">
//       <button>Click Me</button>  ← User clicks here
//     </iframe>
//   </iframe>
// </html>

const chain = getIframeChain();
// Result: ['#container', 'iframe[name="inner"]']

// To replay: 
// 1. Find iframe with selector '#container'
// 2. Access its contentDocument
// 3. Find iframe with selector 'iframe[name="inner"]'
// 4. Access its contentDocument
// 5. Find button
```

### 5.3 Cross-Origin Iframe Handling

Detect and handle cross-origin iframes:

```typescript
function isAccessibleIframe(iframe: HTMLIFrameElement): boolean {
  try {
    // Attempt to access contentDocument
    const doc = iframe.contentDocument;
    return doc !== null;
  } catch (error) {
    // Security error = cross-origin
    return false;
  }
}

function handleIframe(iframe: HTMLIFrameElement) {
  if (isAccessibleIframe(iframe)) {
    console.log('[Iframe] Accessible iframe:', iframe.src);
    injectIntoIframe(iframe);
  } else {
    console.warn('[Iframe] Cross-origin iframe, cannot inject:', iframe.src);
    
    // Log for user awareness
    chrome.runtime.sendMessage({
      action: 'LOG_WARNING',
      payload: {
        message: 'Cannot record interactions in cross-origin iframe',
        url: iframe.src
      }
    });
  }
}
```

---

## 6. Shadow DOM Handling

### 6.1 Shadow DOM Basics

Shadow DOM encapsulates component DOM:

```html
<!-- Light DOM (visible) -->
<my-component>
  #shadow-root (open)
    <!-- Shadow DOM (encapsulated) -->
    <style>...</style>
    <button>Click Me</button>
</my-component>
```

**Types:**
- **Open Shadow Root** - Accessible via `element.shadowRoot`
- **Closed Shadow Root** - Not accessible (rare in practice)

### 6.2 Shadow Root Detection

Find all shadow roots in page:

```typescript
function findAllShadowRoots(root: Document | ShadowRoot = document): ShadowRoot[] {
  const shadowRoots: ShadowRoot[] = [];
  
  // Get all elements
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  let node: Node | null;
  while (node = walker.nextNode()) {
    const element = node as Element;
    
    if (element.shadowRoot) {
      shadowRoots.push(element.shadowRoot);
      
      // Recursively find nested shadow roots
      const nested = findAllShadowRoots(element.shadowRoot);
      shadowRoots.push(...nested);
    }
  }
  
  return shadowRoots;
}
```

### 6.3 Event Listener Attachment in Shadow DOM

Attach listeners to shadow roots:

```typescript
function attachShadowDOMListeners() {
  const shadowRoots = findAllShadowRoots();
  
  console.log(`[Shadow] Found ${shadowRoots.length} shadow roots`);
  
  shadowRoots.forEach(shadowRoot => {
    // Attach event listeners to shadow root
    shadowRoot.addEventListener('click', handleClick, true);
    shadowRoot.addEventListener('input', handleInput, true);
    
    console.log('[Shadow] Listeners attached to shadow root');
  });
  
  // Watch for new shadow roots
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          if (element.shadowRoot) {
            console.log('[Shadow] New shadow root detected');
            element.shadowRoot.addEventListener('click', handleClick, true);
            element.shadowRoot.addEventListener('input', handleInput, true);
          }
        }
      });
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}
```

### 6.4 Shadow Host Tracking

Track shadow host ancestry:

```typescript
function getShadowHostChain(element: Element): string[] {
  const hosts: string[] = [];
  let current: Node | null = element;
  
  while (current) {
    // Check if in shadow root
    if (current instanceof ShadowRoot) {
      const host = current.host;
      const selector = getUniqueSelector(host);
      hosts.unshift(selector); // Add to beginning
      current = host;
    } else {
      current = current.parentNode;
    }
  }
  
  return hosts;
}

// Example:
// <my-app>
//   #shadow-root
//     <my-dialog>
//       #shadow-root
//         <button>Click Me</button>  ← User clicks here
//     </my-dialog>
// </my-app>

const hosts = getShadowHostChain(button);
// Result: ['my-app', 'my-dialog']

// To replay:
// 1. Find element matching 'my-app'
// 2. Access its shadowRoot
// 3. Find element matching 'my-dialog'
// 4. Access its shadowRoot
// 5. Find button
```

### 6.5 Closed Shadow Root Handling

Detect and handle closed shadow roots:

```typescript
function hasClosedShadowRoot(element: Element): boolean {
  // Closed shadow roots are not accessible via shadowRoot property
  // We can only detect them indirectly
  
  // Check if element has shadow-related attributes
  const hasSlot = element.querySelector('slot') !== null;
  const hasShadowParts = element.hasAttribute('part');
  
  // If element seems to use shadow DOM but shadowRoot is null, likely closed
  if ((hasSlot || hasShadowParts) && !element.shadowRoot) {
    return true;
  }
  
  return false;
}

function handleClosedShadowRoot(element: Element) {
  console.warn('[Shadow] Closed shadow root detected:', element.tagName);
  
  // Cannot directly access closed shadow roots
  // Options:
  // 1. Log warning for user
  // 2. Use bounding box coordinates instead of selectors
  // 3. Attempt to find element by visible text
  
  chrome.runtime.sendMessage({
    action: 'LOG_WARNING',
    payload: {
      message: 'Element is in closed shadow root, using coordinates',
      element: element.tagName
    }
  });
  
  return {
    isClosedShadow: true,
    fallbackStrategy: 'coordinates'
  };
}
```

---

## 7. Message Passing Architecture

### 7.1 Content Script → Background

Send messages from content script:

```typescript
// content-script.ts

async function sendStepToBackground(step: RecordedStep) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ADD_STEP',
      payload: { step }
    });
    
    if (response.success) {
      console.log('[Content] Step added:', step.stepNumber);
    } else {
      console.error('[Content] Failed to add step:', response.error);
    }
  } catch (error) {
    console.error('[Content] Failed to send message:', error);
  }
}
```

### 7.2 Background → Content Script

Send messages from background:

```typescript
// background.ts

async function sendToContentScript(tabId: number, message: any) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    console.error('[Background] Failed to send to content script:', error);
    throw error;
  }
}

// Usage
async function startRecording(tabId: number) {
  await sendToContentScript(tabId, {
    action: 'START_CAPTURING'
  });
}
```

### 7.3 Broadcast to All Frames

Send message to all frames in tab:

```typescript
// background.ts

async function broadcastToAllFrames(tabId: number, message: any) {
  // Get all frames in tab
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  
  // Send to each frame
  const promises = frames.map(frame => 
    chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId })
      .catch(error => {
        console.warn(`[Background] Failed to send to frame ${frame.frameId}:`, error);
      })
  );
  
  await Promise.allSettled(promises);
}

// Usage
await broadcastToAllFrames(tabId, {
  action: 'STOP_CAPTURING'
});
```

### 7.4 Error Handling

Handle connection errors:

```typescript
function sendMessageSafe(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Connection error (e.g., background script unloaded)
          console.error('[Content] Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('[Content] Send failed:', error);
      reject(error);
    }
  });
}
```

---

## 8. Event Listener Attachment

### 8.1 Capture Phase Listeners

Use capture phase to intercept events before page handlers:

```typescript
// Attach in capture phase (true parameter)
document.addEventListener('click', handleClick, true);
document.addEventListener('input', handleInput, true);
document.addEventListener('change', handleChange, true);
document.addEventListener('submit', handleSubmit, true);
document.addEventListener('keydown', handleKeydown, true);

// Why capture phase?
// 1. Runs before page handlers
// 2. Cannot be cancelled by page scripts
// 3. Sees events even if stopPropagation called
```

**Event propagation phases:**

```
      ┌─────────────┐
      │   Window    │
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │  Document   │
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │   <html>    │
      └──────┬──────┘
             │
      ┌──────▼──────┐         CAPTURE PHASE ↓
      │   <body>    │
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │  <button>   │  ←── Target
      └──────┬──────┘
             │
      ┌──────▼──────┐         BUBBLE PHASE ↑
      │   <body>    │
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │   <html>    │
      └──────────────┘
```

### 8.2 Listener Management

Track and manage listeners:

```typescript
class ListenerManager {
  private listeners: Map<string, EventListener> = new Map();
  private active: boolean = false;
  
  start() {
    if (this.active) return;
    
    this.attachListeners();
    this.active = true;
    console.log('[Listeners] Started');
  }
  
  stop() {
    if (!this.active) return;
    
    this.detachListeners();
    this.active = false;
    console.log('[Listeners] Stopped');
  }
  
  private attachListeners() {
    const clickListener = (e: MouseEvent) => this.handleClick(e);
    const inputListener = (e: InputEvent) => this.handleInput(e);
    const keydownListener = (e: KeyboardEvent) => this.handleKeydown(e);
    
    document.addEventListener('click', clickListener, true);
    document.addEventListener('input', inputListener, true);
    document.addEventListener('keydown', keydownListener, true);
    
    this.listeners.set('click', clickListener);
    this.listeners.set('input', inputListener);
    this.listeners.set('keydown', keydownListener);
  }
  
  private detachListeners() {
    this.listeners.forEach((listener, event) => {
      document.removeEventListener(event, listener, true);
    });
    this.listeners.clear();
  }
  
  private handleClick(event: MouseEvent) {
    // Process click event
  }
  
  private handleInput(event: InputEvent) {
    // Process input event
  }
  
  private handleKeydown(event: KeyboardEvent) {
    // Process keyboard event
  }
}

const listenerManager = new ListenerManager();

// Listen for commands from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'START_CAPTURING') {
    listenerManager.start();
  } else if (message.action === 'STOP_CAPTURING') {
    listenerManager.stop();
  }
});
```

### 8.3 Event Delegation

Use event delegation for performance:

```typescript
// ❌ BAD: Attach listener to every button
document.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', handleClick);
});

// ✅ GOOD: Single listener on document
document.addEventListener('click', (event) => {
  const target = event.target as Element;
  
  if (target.matches('button')) {
    handleClick(event);
  }
}, true);
```

---

## 9. Script Lifecycle Management

### 9.1 Initialization

Initialize content script on page load:

```typescript
// content-script.ts

(function initialize() {
  console.log('[Content] Initializing...');
  
  // Check if already initialized
  if ((window as any).__TEST_RECORDER_INITIALIZED__) {
    console.log('[Content] Already initialized');
    return;
  }
  
  (window as any).__TEST_RECORDER_INITIALIZED__ = true;
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Content] DOM ready');
      setup();
    });
  } else {
    console.log('[Content] DOM already ready');
    setup();
  }
})();

function setup() {
  // Initialize listener manager
  const listenerManager = new ListenerManager();
  
  // Check if recording is active
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
    if (response.data.isRecording) {
      listenerManager.start();
    }
  });
  
  // Listen for commands
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'START_CAPTURING') {
      listenerManager.start();
    } else if (message.action === 'STOP_CAPTURING') {
      listenerManager.stop();
    }
  });
  
  // Setup iframe and shadow DOM monitoring
  setupFrameMonitoring();
  setupShadowDOMMonitoring();
  
  console.log('[Content] Setup complete');
}
```

### 9.2 Cleanup

Clean up resources when page unloads:

```typescript
window.addEventListener('beforeunload', () => {
  console.log('[Content] Page unloading, cleaning up...');
  
  // Stop all listeners
  listenerManager.stop();
  
  // Disconnect observers
  iframeObserver.disconnect();
  shadowObserver.disconnect();
  
  // Notify background
  chrome.runtime.sendMessage({
    action: 'CONTENT_SCRIPT_UNLOAD',
    payload: { url: window.location.href }
  });
});
```

### 9.3 Hot Reload Support

Support extension reload during development:

```typescript
// Detect extension reload
chrome.runtime.connect({ name: 'content-script' });

chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    console.log('[Content] Extension reloaded, reinitializing...');
    
    // Clean up old listeners
    listenerManager.stop();
    
    // Reinitialize
    setup();
  });
});
```

---

## 10. Debugging and Troubleshooting

### 10.1 Debug Logging

Comprehensive logging:

```typescript
class Logger {
  private prefix = '[Content]';
  private enabled = true; // Set to false in production
  
  log(...args: any[]) {
    if (this.enabled) {
      console.log(this.prefix, ...args);
    }
  }
  
  warn(...args: any[]) {
    console.warn(this.prefix, ...args);
  }
  
  error(...args: any[]) {
    console.error(this.prefix, ...args);
  }
  
  group(label: string) {
    if (this.enabled) {
      console.group(this.prefix, label);
    }
  }
  
  groupEnd() {
    if (this.enabled) {
      console.groupEnd();
    }
  }
}

const logger = new Logger();

// Usage
logger.log('Content script initialized');
logger.group('Event captured');
logger.log('Type:', event.type);
logger.log('Target:', event.target);
logger.groupEnd();
```

### 10.2 Common Issues

**Issue 1: Content script not injecting**

```typescript
// Symptom: No logs, events not captured

// Check:
// 1. Manifest permissions
console.log('Permissions:', chrome.runtime.getManifest().permissions);

// 2. URL matches
console.log('Current URL:', window.location.href);

// 3. Frame detection
console.log('Is top frame:', window === window.top);
console.log('Frame depth:', getFrameDepth());

// Fix: Update manifest.json matches pattern
```

**Issue 2: Cross-origin iframe blocking**

```typescript
// Symptom: Cannot access iframe contentDocument

// Detect
function diagnoseIframe(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument;
    console.log('✓ Iframe accessible');
  } catch (error) {
    console.error('✗ Iframe blocked (cross-origin):', iframe.src);
    console.error('Error:', error);
  }
}

// Workaround: Use coordinates instead of selectors
```

**Issue 3: Shadow DOM not detected**

```typescript
// Symptom: Events in shadow DOM not captured

// Detect
function diagnoseShadowDOM() {
  const shadowRoots = findAllShadowRoots();
  console.log('Shadow roots found:', shadowRoots.length);
  
  shadowRoots.forEach((root, index) => {
    console.log(`Shadow root ${index}:`, root.host);
    console.log('Mode:', root.mode);
  });
  
  if (shadowRoots.length === 0) {
    console.warn('No shadow roots detected');
  }
}

// Fix: Call attachShadowDOMListeners()
```

### 10.3 Performance Monitoring

Track content script performance:

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  time(label: string) {
    performance.mark(`${label}_start`);
  }
  
  timeEnd(label: string) {
    performance.mark(`${label}_end`);
    performance.measure(label, `${label}_start`, `${label}_end`);
    
    const measure = performance.getEntriesByName(label)[0];
    const duration = measure.duration;
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    this.metrics.get(label)!.push(duration);
    
    console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
  }
  
  report() {
    console.group('[Perf] Performance Report');
    
    this.metrics.forEach((durations, label) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      
      console.log(`${label}:`, {
        avg: avg.toFixed(2) + 'ms',
        max: max.toFixed(2) + 'ms',
        min: min.toFixed(2) + 'ms',
        count: durations.length
      });
    });
    
    console.groupEnd();
  }
}

const perfMonitor = new PerformanceMonitor();

// Usage
perfMonitor.time('capture_event');
// ... capture event logic
perfMonitor.timeEnd('capture_event');

// Report every 10 seconds
setInterval(() => perfMonitor.report(), 10000);
```

---

## Summary

The Content Script System provides:

✅ Complete injection strategy (declarative + programmatic)  
✅ Isolated world execution with secure message passing  
✅ Iframe traversal with chain tracking and cross-origin handling  
✅ Shadow DOM support with open/closed root handling  
✅ Event listener management with capture phase interception  
✅ Lifecycle management with initialization and cleanup  
✅ Debugging tools with logging and performance monitoring  
✅ Troubleshooting guide for common issues

The content script system ensures events are captured reliably across all DOM contexts (main page, iframes, shadow DOM) while maintaining security isolation from page JavaScript.
