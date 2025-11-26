# Replay Engine Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture Summary
3. Core Responsibilities
4. System Context
5. Element Finding Strategy
6. Action Execution Framework
7. React-Safe Input Handling
8. Shadow DOM Navigation
9. Iframe Context Resolution
10. Error Handling and Recovery
11. Performance Characteristics
12. Integration Points
13. Configuration Options
14. Security Considerations

---

## 1. Overview

### 1.1 Purpose

The **Replay Engine** is responsible for executing recorded automation steps on live web pages. It takes step bundles created by the Recording Engine and replays user interactions faithfully, handling the complexity of modern web frameworks, shadow DOM, and cross-frame execution.

### 1.2 Criticality Rating

**⭐⭐⭐⭐⭐ Maximum Criticality**

The Replay Engine directly determines automation success rate. A 1% improvement in element finding reliability translates to significant reduction in test failures across thousands of executions.

### 1.3 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REPLAY ENGINE PRINCIPLES                         │
├─────────────────────────────────────────────────────────────────────────┤
│  1. RESILIENCE OVER SPEED                                               │
│     - Multi-strategy fallback ensures element is found                  │
│     - Graceful degradation when strategies fail                         │
│                                                                         │
│  2. FRAMEWORK AGNOSTIC                                                  │
│     - Works with React, Vue, Angular, jQuery, vanilla JS                │
│     - Handles controlled inputs, synthetic events                       │
│                                                                         │
│  3. HUMAN-LIKE BEHAVIOR                                                 │
│     - Realistic event sequences mimic actual user interaction           │
│     - Prevents framework detection of synthetic events                  │
│                                                                         │
│  4. FAIL GRACEFULLY                                                     │
│     - Never throw exceptions to caller                                  │
│     - Return success/failure status for orchestrator handling           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Summary

### 2.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           TEST RUNNER (UI)                             │
│                    Orchestrates step execution                         │
└─────────────────────────────┬──────────────────────────────────────────┘
                              │
                              │ chrome.tabs.sendMessage
                              │ { type: "runStep", data: {...} }
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          REPLAY ENGINE                                 │
│                    (Content Script Context)                            │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ Element Finder   │  │ Action Executor  │  │ Value Injector    │   │
│  │ - 9-tier lookup  │  │ - Click handler  │  │ - React-safe set  │   │
│  │ - XPath resolve  │  │ - Input handler  │  │ - Contenteditable │   │
│  │ - Fuzzy match    │  │ - Enter handler  │  │ - Select/Select2  │   │
│  └────────┬─────────┘  └────────┬─────────┘  └─────────┬─────────┘   │
│           │                     │                       │             │
│           │                     │                       │             │
│           └─────────────────────┼───────────────────────┘             │
│                                 │                                     │
│                                 │                                     │
│      ┌──────────────────────────┴───────────────────────────────┐    │
│      │          Shadow DOM Navigator                            │    │
│      │          - Open root traversal                           │    │
│      │          - Closed root fallback                          │    │
│      │          - Google Autocomplete delegation                │    │
│      └──────────────────────────────────────────────────────────┘    │
│                                 │                                     │
│      ┌──────────────────────────┴───────────────────────────────┐    │
│      │          Iframe Resolver                                 │    │
│      │          - Chain resolution                              │    │
│      │          - Cross-frame XPath                             │    │
│      └──────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 │ sendResponse(success: boolean)
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           TEST RUNNER (UI)                             │
│                  Collects results, updates UI                          │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Locations

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Main Engine | `src/contentScript/content.tsx` | 850-1446 | Element finding, action execution |
| Page Script | `src/contentScript/replay.ts` | 152 | Google Autocomplete in page context |
| Orchestrator | `src/pages/TestRunner.tsx` | 809 | Step sequencing, result collection |

### 2.3 Execution Context

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER TAB                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    MAIN WORLD                             │  │
│  │            (Page's JavaScript Context)                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐     │  │
│  │  │         replay.ts (injected)                    │     │  │
│  │  │    Google Autocomplete Handler                  │     │  │
│  │  └─────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   ISOLATED WORLD                          │  │
│  │           (Extension's Content Script)                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐     │  │
│  │  │           content.tsx                           │     │  │
│  │  │      Replay Engine Core Logic                   │     │  │
│  │  └─────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Communication: window.postMessage (for closed shadow roots)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Responsibilities

### 3.1 MUST DO

| Responsibility | Description | Implementation |
|----------------|-------------|----------------|
| **Multi-Strategy Finding** | Try locators in priority order until element found | 9-tier fallback in `findElementFromBundle()` |
| **React-Safe Input** | Bypass controlled input protection | Native property descriptor + InputEvent |
| **Human-Like Clicks** | Dispatch realistic event sequence | mouseover → mousedown → mouseup → click |
| **Value Injection** | Set values for all input types | Input, textarea, select, contenteditable |
| **Visibility Management** | Show hidden elements during action | Temporarily set `display: block` |
| **Shadow DOM Traversal** | Navigate into open shadow roots | XPath resolution with root switching |
| **Iframe Resolution** | Execute in correct frame context | Resolve `iframeChain` before lookup |
| **Google Autocomplete** | Handle closed shadow root components | Delegate to page-context script |
| **Error Recovery** | Return false, don't throw | Graceful degradation pattern |

### 3.2 MUST NOT DO

```typescript
// ❌ WRONG: Direct value assignment (React won't detect change)
element.value = "new value";

// ✅ CORRECT: Use native setter + dispatch events
const setter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype, 'value'
).set;
setter.call(element, "new value");
element.dispatchEvent(new InputEvent('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));

// ❌ WRONG: Assume XPath always works
const element = document.evaluate(xpath, document, ...).singleNodeValue;
// May return null if DOM changed!

// ✅ CORRECT: Multi-strategy with fallback
const element = await findElementFromBundle(bundle);
// Tries XPath, ID, name, aria, placeholder, fuzzy, bounding box

// ❌ WRONG: Block on missing element
while (!element) {
  element = findElement(); // Infinite loop risk
}

// ✅ CORRECT: Timeout with retry
const element = await findElementWithTimeout(bundle, 2000, 150);
if (!element) return false; // Graceful failure
```

---

## 4. System Context

### 4.1 Dependencies (Consumes)

| System | What Replay Engine Receives |
|--------|------------------------------|
| Recording Engine | Step bundles with locator metadata |
| Test Runner | runStep messages via chrome.tabs.sendMessage |
| Page Interceptor | __realShadowRoot references for closed roots |
| Background Service | Tab injection coordination |

### 4.2 Dependents (Provides To)

| System | What Replay Engine Provides |
|--------|------------------------------|
| Test Runner | Execution success/failure per step |
| Notification UI | Progress overlay on target page |
| Test Results | Duration and error details |

### 4.3 Communication Protocol

```typescript
// Test Runner sends command
chrome.tabs.sendMessage(tabId, {
  type: "runStep",
  data: {
    event: 'click' | 'input' | 'enter',
    bundle: {
      id: string | null,
      name: string | null,
      xpath: string,
      aria: string | null,
      placeholder: string | null,
      dataAttrs: Record<string, string>,
      tag: string,
      visibleText: string,
      bounding: { x: number, y: number, width: number, height: number },
      iframeChain: number[],
      shadowHosts: string[]
    },
    value?: string,
    label?: string
  }
});

// Replay Engine responds
sendResponse(success: boolean);
```

---

## 5. Element Finding Strategy

### 5.1 Nine-Tier Fallback System

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ELEMENT FINDING STRATEGY                         │
│                     (Priority High → Low)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tier 1: XPath Evaluation (Highest Confidence)                      │
│  ├── Direct document.evaluate() on bundle.xpath                     │
│  ├── Shadow DOM traversal via resolveXPathInShadow()                │
│  └── Contenteditable div special case handling                      │
│                                                                     │
│  Tier 2: ID + Attributes Match                                      │
│  ├── querySelector('#' + CSS.escape(bundle.id))                     │
│  ├── Cross-check name, className, aria, data-attrs                  │
│  └── Bounding box proximity scoring                                 │
│                                                                     │
│  Tier 3: Name Attribute                                             │
│  └── getElementsByName(bundle.name) filtered by visibility          │
│                                                                     │
│  Tier 4: ARIA Labels                                                │
│  ├── querySelector('[aria-labelledby="..."]')                       │
│  └── querySelector('[aria-label="..."]')                            │
│                                                                     │
│  Tier 5: Placeholder Text                                           │
│  └── querySelector('[placeholder="..."]')                           │
│                                                                     │
│  Tier 6: Data Attributes                                            │
│  └── Try each data-* attribute as exact match                       │
│                                                                     │
│  Tier 7: Fuzzy Text Match (0.4 threshold)                           │
│  └── Compare innerText/value to bundle.visibleText                  │
│                                                                     │
│  Tier 8: Bounding Box (200px threshold)                             │
│  └── Find nearest visible element by Euclidean distance             │
│                                                                     │
│  Tier 9: Retry Loop (150ms interval, 2s timeout)                    │
│  └── Repeat all strategies for dynamic content                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Confidence Scoring

| Tier | Strategy | Confidence | When to Use |
|------|----------|------------|-------------|
| 1 | XPath | 95% | Stable DOM structure |
| 2 | ID + Attrs | 90% | Elements with stable IDs |
| 3 | Name | 85% | Form inputs |
| 4 | ARIA | 80% | Accessible components |
| 5 | Placeholder | 75% | Input fields |
| 6 | Data Attrs | 70% | Custom attributes |
| 7 | Fuzzy Text | 60% | Last resort for text |
| 8 | Bounding Box | 40% | Absolute last resort |

### 5.3 Implementation

```typescript
async function findElementFromBundle(
  bundle: LocatorBundle,
  opts: FindOptions = {}
): Promise<HTMLElement | null> {
  const timeout = opts.timeout ?? 2000;
  const retryInterval = opts.retryInterval ?? 150;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Tier 1: XPath
    let element = resolveXPath(bundle.xpath, bundle.shadowHosts);
    if (element && visible(element)) return element;
    
    // Tier 2: ID with attribute verification
    if (bundle.id) {
      element = document.querySelector(`#${CSS.escape(bundle.id)}`);
      if (element && matchesAttributes(element, bundle)) return element;
    }
    
    // Tier 3: Name attribute
    if (bundle.name) {
      const elements = document.getElementsByName(bundle.name);
      element = Array.from(elements).find(el => visible(el));
      if (element) return element;
    }
    
    // Tier 4: ARIA labels
    if (bundle.aria) {
      element = document.querySelector(`[aria-label="${bundle.aria}"]`);
      if (element && visible(element)) return element;
    }
    
    // Tier 5: Placeholder
    if (bundle.placeholder) {
      element = document.querySelector(`[placeholder="${bundle.placeholder}"]`);
      if (element && visible(element)) return element;
    }
    
    // Tier 6: Data attributes
    for (const [key, value] of Object.entries(bundle.dataAttrs)) {
      element = document.querySelector(`[data-${key}="${value}"]`);
      if (element && visible(element)) return element;
    }
    
    // Tier 7: Fuzzy text match
    element = findByFuzzyText(bundle.visibleText, 0.4);
    if (element) return element;
    
    // Tier 8: Bounding box proximity
    element = findByBoundingBox(bundle.bounding, 200);
    if (element) return element;
    
    // Tier 9: Retry
    await sleep(retryInterval);
  }
  
  return null; // Element not found after timeout
}
```

---

## 6. Action Execution Framework

### 6.1 Action Types

| Action | Trigger | Execution Pattern |
|--------|---------|-------------------|
| click | User clicks element | Human-like mouse event sequence |
| input | User types in field | Focus + value injection + events |
| enter | User presses Enter | Optional value set + keyboard events |

### 6.2 Click Action Flow

```typescript
async function executeClick(element: HTMLElement): Promise<boolean> {
  // Check for radio/checkbox group
  const radioGroup = element.closest('[role="radio"], [role="checkbox"]');
  if (radioGroup) {
    return executeRadioCheckboxClick(radioGroup, value);
  }
  
  // Check for select dropdown
  if (element.tagName === 'SELECT') {
    return executeSelectChange(element, value);
  }
  
  // Standard click with human-like sequence
  return humanClick(element);
}

function humanClick(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y
  };
  
  element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  element.dispatchEvent(new MouseEvent('mousemove', eventOptions));
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  element.dispatchEvent(new MouseEvent('click', eventOptions));
  
  return true;
}
```

### 6.3 Input Action Flow

```typescript
async function executeInput(
  element: HTMLElement,
  value: string
): Promise<boolean> {
  // Focus the element
  element.focus();
  
  // Check for contenteditable
  if (element.isContentEditable) {
    return executeContentEditableInput(element, value);
  }
  
  // Check for Draft.js editor
  if (isDraftJsEditor(element)) {
    return executeDraftJsInput(element, value);
  }
  
  // Check for Select2
  if (isSelect2(element)) {
    return executeSelect2Input(element, value);
  }
  
  // Standard input/textarea
  return executeStandardInput(element, value);
}
```

### 6.4 Enter Action Flow

```typescript
async function executeEnter(
  element: HTMLElement,
  value?: string
): Promise<boolean> {
  // Optionally set value first
  if (value !== undefined) {
    await executeInput(element, value);
    await sleep(50); // React settle delay
  }
  
  // Dispatch keyboard events
  const keyOptions = {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    keyCode: 13,
    which: 13
  };
  
  element.dispatchEvent(new KeyboardEvent('keydown', keyOptions));
  element.dispatchEvent(new KeyboardEvent('keypress', keyOptions));
  element.dispatchEvent(new KeyboardEvent('keyup', keyOptions));
  
  // If button, also click
  if (element.tagName === 'BUTTON') {
    humanClick(element);
  }
  
  return true;
}
```

---

## 7. React-Safe Input Handling

### 7.1 The Problem

React's controlled inputs maintain state internally. Setting `element.value` directly bypasses React's change detection, leaving the component out of sync with the DOM.

### 7.2 The Solution

```typescript
function focusAndSetValue(element: HTMLInputElement, value: string): void {
  // Step 1: Get native property descriptor
  const proto = HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const nativeSetter = descriptor?.set;
  
  if (!nativeSetter) {
    // Fallback for non-input elements
    element.value = value;
    return;
  }
  
  // Step 2: Focus element
  element.focus();
  
  // Step 3: Call native setter (bypasses React's getter/setter)
  nativeSetter.call(element, value);
  
  // Step 4: Dispatch input event (triggers React's onChange)
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    data: value,
    inputType: 'insertText'
  }));
  
  // Step 5: Dispatch change event (for onBlur handlers)
  element.dispatchEvent(new Event('change', {
    bubbles: true,
    cancelable: true
  }));
}
```

### 7.3 Framework Compatibility

| Framework | Technique | Notes |
|-----------|-----------|-------|
| React | Native setter + InputEvent | Works with controlled inputs |
| Vue | Native setter + InputEvent | Works with v-model |
| Angular | Native setter + InputEvent | Works with ngModel |
| jQuery | Direct value + trigger | Legacy support |
| Vanilla | Direct value + events | Standard approach |

---

## 8. Shadow DOM Navigation

### 8.1 Open vs Closed Shadow Roots

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHADOW DOM TYPES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OPEN SHADOW ROOT                                               │
│  ├── Accessible via element.shadowRoot                          │
│  ├── XPath can traverse into root                               │
│  └── Full element finding capability                            │
│                                                                 │
│  CLOSED SHADOW ROOT                                             │
│  ├── element.shadowRoot returns null                            │
│  ├── Requires __realShadowRoot from page-interceptor            │
│  └── Fallback: click host element (limited functionality)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Shadow DOM Traversal

```typescript
function resolveXPathInShadow(
  xpath: string,
  shadowHosts: string[]
): Element | null {
  let context: Document | ShadowRoot = document;
  
  // Navigate through shadow host chain
  for (const hostXPath of shadowHosts) {
    const host = document.evaluate(
      hostXPath,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue as Element;
    
    if (!host) return null;
    
    // Try open shadow root first
    let shadowRoot = host.shadowRoot;
    
    // Fall back to exposed closed root
    if (!shadowRoot) {
      shadowRoot = (host as any).__realShadowRoot;
    }
    
    if (!shadowRoot) return null;
    context = shadowRoot;
  }
  
  // Evaluate final XPath in innermost context
  return context.evaluate(
    xpath,
    context,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue as Element;
}
```

### 8.3 Google Autocomplete Special Case

```typescript
// Content script delegates to page context
function handleGoogleAutocomplete(bundle: LocatorBundle, action: string, value?: string): void {
  window.postMessage({
    type: 'REPLAY_AUTOCOMPLETE',
    action: action, // 'AUTOCOMPLETE_INPUT' or 'AUTOCOMPLETE_SELECTION'
    bundle: bundle,
    value: value
  }, '*');
}
```

---

## 9. Iframe Context Resolution

### 9.1 Chain Resolution

```typescript
function getDocumentFromIframeChain(chain: number[]): Document {
  let doc = document;
  
  for (const index of chain) {
    const iframes = doc.querySelectorAll('iframe');
    const iframe = iframes[index] as HTMLIFrameElement;
    
    if (!iframe) {
      throw new Error(`Iframe at index ${index} not found`);
    }
    
    // Check same-origin access
    try {
      doc = iframe.contentDocument!;
    } catch (e) {
      throw new Error(`Cross-origin iframe at index ${index}`);
    }
  }
  
  return doc;
}
```

### 9.2 Cross-Frame XPath Execution

```typescript
async function findElementInIframe(
  bundle: LocatorBundle
): Promise<HTMLElement | null> {
  // Resolve iframe chain to get correct document
  const targetDoc = getDocumentFromIframeChain(bundle.iframeChain);
  
  // Execute XPath in target document context
  const result = targetDoc.evaluate(
    bundle.xpath,
    targetDoc,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  
  return result.singleNodeValue as HTMLElement;
}
```

---

## 10. Error Handling and Recovery

### 10.1 Graceful Degradation Pattern

```typescript
async function playAction(
  bundle: LocatorBundle,
  action: ActionType,
  value?: string
): Promise<boolean> {
  try {
    // Find element with timeout
    const element = await findElementFromBundle(bundle);
    
    if (!element) {
      console.warn(`Element not found: ${bundle.label}`);
      return false; // Don't throw, return failure
    }
    
    // Ensure element is visible
    const restore = temporarilyShow(element);
    
    try {
      // Execute action
      switch (action) {
        case 'click':
          return await executeClick(element);
        case 'input':
          return await executeInput(element, value!);
        case 'enter':
          return await executeEnter(element, value);
        default:
          console.warn(`Unknown action: ${action}`);
          return false;
      }
    } finally {
      // Always restore visibility
      restore();
    }
  } catch (error) {
    console.error(`Action failed: ${error.message}`);
    return false; // Never throw to caller
  }
}
```

### 10.2 Visibility Restoration

```typescript
function temporarilyShow(element: HTMLElement): () => void {
  const hiddenElements: Array<{ el: HTMLElement; display: string }> = [];
  
  // Walk up the DOM tree
  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    if (style.display === 'none') {
      hiddenElements.push({
        el: current,
        display: current.style.display
      });
      current.style.display = 'block';
    }
    current = current.parentElement;
  }
  
  // Return restore function
  return () => {
    for (const { el, display } of hiddenElements) {
      el.style.display = display;
    }
  };
}
```

---

## 11. Performance Characteristics

### 11.1 Timing Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Element finding timeout | 2000ms | Max time to find element |
| Retry interval | 150ms | Delay between fallback attempts |
| React settle delay | 50ms | Wait after value set before Enter |
| Animation buffer | 0ms | No current animation detection |

### 11.2 Execution Profile

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEP EXECUTION TIMELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [0ms]      Message received from Test Runner                   │
│  [5ms]      Begin element finding (Tier 1: XPath)               │
│  [10ms]     XPath found element → proceed                       │
│  [12ms]     Visibility check/restoration                        │
│  [15ms]     Execute action (click/input/enter)                  │
│  [20ms]     Dispatch all events                                 │
│  [25ms]     Send response to Test Runner                        │
│                                                                 │
│  TOTAL: ~25ms per successful step (best case)                   │
│  WORST CASE: 2025ms (full timeout + retries)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Integration Points

### 12.1 Message Listener Setup

```typescript
// In content.tsx initialization
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'runStep') {
    const { event, bundle, value, label } = message.data;
    
    playAction(bundle, event, value)
      .then(success => sendResponse(success))
      .catch(() => sendResponse(false));
    
    return true; // Keep channel open for async response
  }
});
```

### 12.2 Test Runner Integration

```typescript
// In TestRunner.tsx
async function executeStep(step: RecordedStep): Promise<StepResult> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'runStep',
      data: {
        event: step.event,
        bundle: step.bundle,
        value: step.value,
        label: step.label
      }
    }, (success) => {
      resolve({
        success,
        duration: Date.now() - startTime,
        error: success ? undefined : 'Element not found or action failed'
      });
    });
  });
}
```

---

## 13. Configuration Options

### 13.1 Current Hardcoded Values

```typescript
// These should become configurable
const CONFIG = {
  elementFinding: {
    timeout: 2000,           // ms
    retryInterval: 150,      // ms
    fuzzyThreshold: 0.4,     // 40% similarity
    boundingBoxThreshold: 200 // px
  },
  timing: {
    reactSettleDelay: 50,    // ms
    humanClickDelay: 0       // ms between events
  }
};
```

### 13.2 Future Configuration Schema

```typescript
interface ReplayConfig {
  elementFinding: {
    timeout: number;
    retryInterval: number;
    fuzzyThreshold: number;
    boundingBoxThreshold: number;
    strategyPriority: LocatorStrategy[];
  };
  timing: {
    reactSettleDelay: number;
    humanClickDelay: number;
    animationWait: boolean;
  };
  errorHandling: {
    screenshotOnFailure: boolean;
    retryCount: number;
    skipOnFailure: boolean;
  };
}
```

---

## 14. Security Considerations

### 14.1 Content Security Policy Compliance

- All scripts injected via manifest-declared files
- No use of `eval()` or `innerHTML` for dynamic code
- Event dispatch uses standard DOM APIs

### 14.2 Same-Origin Restrictions

- Cannot replay in cross-origin iframes
- Iframe chain resolution fails silently for cross-origin frames
- No bypass attempts for security boundaries

### 14.3 Input Sanitization

```typescript
// Values are passed through without modification
// The target page's own validation handles sanitization
// No SQL/XSS concerns as we're simulating user input
```

---

## Summary

The Replay Engine provides:

✅ Multi-strategy element finding with 9-tier fallback  
✅ Framework-agnostic execution supporting React, Vue, Angular  
✅ Human-like interaction preventing bot detection  
✅ Shadow DOM navigation including closed root fallbacks  
✅ Iframe context resolution for cross-frame automation  
✅ Graceful error handling with no exceptions to callers  
✅ Performance profiling with configurable timeouts

This overview document serves as the foundation for detailed implementation guides covering element finding, action execution, and special case handling.
