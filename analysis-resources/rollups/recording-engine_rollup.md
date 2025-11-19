# RECORDING ENGINE ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/recording-engine_breakdown.md` (205 lines)
- `modularization-plans/recording-engine_mod-plan.md` (empty - to be populated)
- `implementation-guides/recording-engine_impl.md` (empty - to be populated)

**Subsystem Purpose**: The Recording Engine is the core event capture system that monitors all user interactions on web pages (clicks, inputs, keyboard events, navigation) and transforms them into structured, replay-able steps with multiple locator strategies. It's the foundation of the entire automation system—recording quality directly determines replay success rates.

**Criticality**: ⭐⭐⭐⭐⭐ (Maximum - system cannot function without this)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Event Listening**: Attach capture-phase listeners for `mousedown`, `input`, `keydown` across main document and all same-origin iframes
- **Label Detection**: Extract human-readable field names using 12+ heuristic strategies (Google Forms, aria-label, label[for], placeholder, Bootstrap row headers, etc.)
- **Locator Generation**: Create comprehensive element bundles containing XPath, ID, name, className, aria, data-attrs, bounding box, visible text
- **Iframe Serialization**: Track iframe chains (id, name, index) for cross-frame element resolution
- **Shadow DOM Handling**: Monkey-patch `attachShadow` to expose closed shadow roots via `__realShadowRoot` property
- **Event Filtering**: Reject synthetic (untrusted) events to prevent recording JavaScript-triggered actions
- **Step Broadcasting**: Send captured events to Recorder UI via `chrome.runtime.sendMessage` with type "logEvent"
- **Special Handling**: Detect Select2 dropdowns, Google Forms radio/checkboxes, contenteditable divs, Google Places Autocomplete

### MUST NOT DO
- **Never record cross-origin iframes**: Try-catch silently skips iframes that throw security errors
- **Never record hidden elements**: Only track visible, clickable elements (display !== 'none', cursor: pointer, semantic tags)
- **Never attach listeners post-init**: Dynamic iframes/elements added after `initContentScript()` are missed (no mutation observer for general DOM)
- **Never trust event.target alone**: Use `composedPath()` to pierce shadow DOM boundaries

---

## 3. Interfaces & Contracts (Compressed)

### Output Message Contract
```typescript
chrome.runtime.sendMessage({
  type: "logEvent",
  data: {
    eventType: 'click' | 'input' | 'enter' | 'open',
    xpath: string,           // Primary selector
    value?: string,          // Input text or selected option
    label?: string,          // Human-readable field name
    x?: number,              // Click X coordinate
    y?: number,              // Click Y coordinate
    page: string,            // window.location.href
    bundle: {
      id, name, className, dataAttrs, aria, placeholder,
      tag, visibleText, xpath, bounding, iframeChain,
      shadowHosts, isClosedShadow
    }
  }
});
```

### Bundle Structure (Critical for Replay)
- **Primary Locator**: XPath with sibling indexing (e.g., `div[3]/input[2]`)
- **Fallback Locators**: ID, name, aria, placeholder, data-* attributes
- **Fuzzy Matching**: Bounding box (left/top/width/height), visible text
- **Context Metadata**: Iframe chain, shadow host XPaths, tag name

### Cross-Context Communication
- **Page → Content Script**: `window.postMessage` for closed shadow root events (Google Autocomplete)
- **Content Script → Extension Pages**: `chrome.runtime.sendMessage` for recorded steps
- **Background → Content Script**: Re-injection on navigation via `chrome.tabs.executeScript`

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Recording Engine = Content Script**: Lives exclusively in content script context (src/contentScript/content.tsx)
- **Dual-Mode Design**: Same file handles recording AND replay—separation needed in refactor
- **No Direct Storage Access**: Must send steps via messaging; background service persists to IndexedDB

### Layering Restrictions
- **Must operate in isolated world**: Cannot directly access page variables (use window.postMessage bridge for closed shadow roots)
- **Must survive navigation**: Background script re-injects on `webNavigation.onCommitted` and `onHistoryStateUpdated`

### Performance Constraints
- **30ms Click Delay**: `setTimeout(30)` in `handleClick` waits for DOM updates (Select2, Bootstrap dropdowns)—arbitrary but empirically determined
- **No Debouncing**: Input events fire immediately; rapid typing may flood message queue
- **Recursive Iframe Crawl**: `attachToAllIframes()` queries ALL iframes at once—pages with 50+ nested frames may lag

### Error Handling Rules
- **Silent Failures**: Cross-origin iframe errors are `console.warn`ed, not surfaced to user
- **No Retry Logic**: If label detection fails, returns undefined—no fallback chain
- **Monkey-Patch Race Condition**: If page creates shadow root before page-interceptor.tsx loads, closed root is NOT exposed

### Security Requirements
- **Trusted Events Only**: Check `event.isTrusted` to filter synthetic clicks
- **Same-Origin Policy**: Cannot record or replay cross-origin iframe content
- **No XSS Risk**: XPath generation escapes special characters (via tagName.toLowerCase())

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Select2 Reverse Lookup**: When user clicks Select2 option, must walk back to original `<select>` via `data-select2-id` chain—fails if custom Select2 config alters naming
2. **Google Forms Specificity**: Hardcoded class names (`.M7eMe`, `.aDTYNe`)—breaks if Google updates UI
3. **Draft.js Detection**: Checks `id.includes("placeholder")` to identify Draft.js editors—fragile heuristic
4. **XPath SVG Skip**: Skips `<svg>` tags in XPath generation because SVG elements break Chrome XPath queries
5. **Iframe Chain Index Shift**: Uses `Array.indexOf(iframe)` for chain position—shifts if iframes dynamically added/removed before replay
6. **getFocusedElement() Iframe Traversal**: `document.activeElement` may be an `<iframe>`—must recursively dive into `iframe.contentDocument.activeElement`

### Common Pitfalls
- **Recording Button vs. Input Inside Button**: Always records `getFocusedElement()` (activeElement), NOT `event.target`—critical for inputs inside clickable containers
- **Label Priority Implicit**: Multiple heuristics may match; returns at first match (Google Forms > label parent > label[for] > aria > ...)
- **Bounding Box Stale Data**: Records element position at capture time—wrong if page scrolls/resizes before replay
- **Shadow Root Timing**: Monkey-patch must load BEFORE page creates shadow roots—race condition on fast-loading pages

### Maintenance Traps
- **1,446-Line Monolith**: All recording + replay logic in single file—changes risk breaking unrelated features
- **No Unit Tests**: Pure integration tests; refactoring is high-risk
- **Magic Numbers**: 30ms delay, 150ms retry interval—no documentation on why these values

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/recording-engine_breakdown.md`
  - Internal structure (event handlers, label detection, locator generators)
  - Dependencies (files, libraries, Browser APIs)
  - Complexity assessment (9/10 rating, risks, refactoring needs)

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/recording-engine_mod-plan.md` (to be populated)
  - Planned split into EventListenerManager, LabelDetectionEngine, LocatorGenerator, IframeCoordinator, ShadowDOMHandler, BundleBuilder
  - Pluggable label strategies, configuration layer

### Implementation Guidelines
- **Implementation Guide**: `analysis-resources/implementation-guides/recording-engine_impl.md` (to be populated)
  - Coding standards, error handling patterns, testing requirements
  - React-safe event handling, iframe traversal best practices

### Related Systems
- **Replay Engine**: Uses bundles generated by Recording Engine
- **Message Bus**: Routes logEvent messages to Recorder UI
- **Locator Strategy**: Embedded in Recording Engine (needs extraction)
