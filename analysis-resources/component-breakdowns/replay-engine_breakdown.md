# Replay Engine - Component Breakdown

## 1. Purpose

The Replay Engine is the action execution subsystem embedded in the content script that resolves recorded LocatorBundles to live DOM elements using a 9-tier fallback strategy, simulates user interactions with React-safe input patterns, and reports step outcomes back to the TestRunner UI.

**Core Responsibilities:**
- Resolve LocatorBundle objects to live DOM elements via 9 fallback strategies (XPath → ID → name → aria → placeholder → data-attrs → fuzzy text → bounding box → retry)
- Execute click, input, navigation actions with human-like timing and React compatibility
- Handle iframe traversal and Shadow DOM element access during replay
- Report step success/failure with detailed error messages via chrome.runtime.sendMessage
- Manage execution timing, timeouts (2s per step), and retry logic (150ms intervals)

## 2. Inputs

- **Recorded Steps Array:** Array of LocatorBundle objects from projects.recorded_steps (Dexie storage)
- **CSV Data Rows:** Optional test data for parameterized replay (e.g., login credentials, form values)
- **Replay Configuration:** Timeout values, retry intervals, human-like delay ranges (50-300ms)
- **Page Context:** Current document.location.href, active iframes, shadow roots
- **Execution State:** Current step index, paused/running status from TestRunner UI

## 3. Outputs

- **Step Execution Results:** Status (passed/failed), duration (ms), error messages sent via chrome.runtime.sendMessage({ action: "step_result", stepId, status, duration, error })
- **Progress Updates:** Current step index, percentage complete broadcast to TestRunner UI
- **Console Logs:** Debug output for element resolution attempts, locator strategy confidence scores, timing data
- **Final Test Report:** Summary with passed_steps, failed_steps, total_duration, error_log

## 4. Internal Architecture

**Primary Location:** src/contentScript/content.tsx lines 850-1446 (shared monolith with recording engine)

**Key Functions:**
- `findElementFromBundle(bundle, timeout=2000)` - 150 lines: Central element resolution orchestrator with 9-tier fallback and retry loop
- `humanClick(element)` - 40 lines: Simulates natural click sequence (mouseover → mousemove → mousedown → mouseup → click with 50-150ms delays)
- `humanInput(element, value)` - 60 lines: React-safe input simulation using property descriptors to bypass React's event system
- `executeStep(step, csvRow?)` - 80 lines: Step execution coordinator handling click, input, navigation, delay actions
- `waitForElement(selector, timeout)` - 30 lines: Async polling for element appearance with configurable timeout
- `resolveXPathInShadow(xpath, shadowRoot)` - 50 lines: XPath evaluation with shadow root context support

**9-Tier Fallback Strategy (Confidence Scoring):**
1. **XPath Absolute (100%):** document.evaluate(bundle.xpath) with shadow root traversal
2. **ID + Attributes (90%):** document.querySelector(`#${id}[name="${name}"]`)
3. **Name Attribute (80%):** document.querySelector(`[name="${name}"]`)
4. **Aria Labels (75%):** document.querySelector(`[aria-label="${aria}"]`)
5. **Placeholder (70%):** document.querySelector(`[placeholder="${placeholder}"]`)
6. **Data Attributes (65%):** document.querySelector(`[data-testid="${dataAttrs.testid}"]`)
7. **Fuzzy Text Match (40%):** Array.from(document.querySelectorAll(tag)).find(el => stringSimilarity(el.textContent, bundle.text) > 0.4)
8. **Bounding Box (200px threshold):** Find element with closest center coordinates (Euclidean distance < 200px)
9. **Retry Loop (150ms interval):** Re-execute strategies 1-8 every 150ms up to 2s timeout

**React-Safe Input Pattern:**
```javascript
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'value'
).set;
nativeInputValueSetter.call(element, value);
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
```

**Data Flow:**
1. TestRunner UI sends chrome.runtime.sendMessage({ action: "start_replay", projectId, csvRow })
2. Content script retrieves recorded_steps from background
3. For each step in steps:
   - Call executeStep(step, csvRow)
   - findElementFromBundle(step.bundle) resolves to element
   - humanClick(element) or humanInput(element, value) simulates action
   - Send chrome.runtime.sendMessage({ action: "step_result", status, duration, error })
4. After all steps, send chrome.runtime.sendMessage({ action: "replay_complete", passed, failed })

## 5. Critical Dependencies

- **chrome.runtime API:** sendMessage for TestRunner communication, onMessage for replay commands
- **XPath Library (xpath 0.0.34):** document.evaluate() for XPath resolution
- **string-similarity 4.0.4:** compareTwoStrings() for fuzzy text matching (Dice coefficient)
- **Shadow DOM APIs:** element.shadowRoot, getRootNode() for closed shadow root traversal
- **Iframe APIs:** contentWindow.document, window.parent for cross-frame element access
- **React Property Descriptors:** HTMLInputElement.prototype.value setter bypass for controlled inputs
- **DOM APIs:** querySelector, querySelectorAll, getBoundingClientRect, dispatchEvent
- **Background Storage:** Assumes Dexie.projects.recorded_steps available via message bus

**Breaking Changes Risk:**
- React v19+ may change controlled input descriptor implementation
- string-similarity algorithm changes could affect fuzzy matching threshold (current 0.4)
- Chrome v120+ XPath behavior changes in shadow DOM context

## 6. Hidden Assumptions

- **2-Second Timeout Sufficient:** Assumes all elements load/render within 2s (SPAs with lazy loading may fail)
- **150ms Retry Interval Optimal:** Hardcoded retry timing may be too fast for slow networks or too slow for fast pages
- **Fuzzy Match Threshold 0.4:** Dice coefficient threshold chosen empirically; not validated across diverse sites
- **Bounding Box Stability:** Assumes element positions don't shift during replay (e.g., animations, lazy images)
- **Single Element Match:** Strategies return first match; no disambiguation if multiple elements match selector
- **React Version Agnostic:** Property descriptor bypass tested on React 16-18 only
- **No Dynamic Wait Logic:** Timeouts are fixed; no adaptive waiting based on page load indicators (network idle, DOMContentLoaded)
- **English Text Matching:** Fuzzy text matching assumes English character sets; may fail for non-Latin scripts

## 7. Stability Concerns

- **Shared Monolith with Recording:** 1,446-line content.tsx contains both recording and replay; changes to one risk breaking the other
- **Fallback Strategy Complexity:** 9 strategies with nested conditions make debugging failures difficult
- **No Graceful Degradation:** If all 9 strategies fail, step marked failed immediately; no user-configurable fallback (e.g., "skip and continue")
- **Hardcoded Timeouts:** 2s timeout, 150ms retry interval not configurable per step or project
- **Memory Leaks:** Retry loops may accumulate setTimeout handles if replay stopped mid-step
- **No Transaction Safety:** Steps executed independently; if replay crashes, partial execution state unrecoverable
- **React Descriptor Brittleness:** Property descriptor bypass may fail for custom input components (e.g., Material-UI, Chakra UI)

## 8. Edge Cases

- **Hidden Elements at Replay:** Element found but `display: none`; click/input fail silently or throw DOMException
- **Overlapping Elements:** XPath resolves to element behind modal; click intercepted by overlay
- **Dynamic IDs:** XPath /html/body/div[@id="root-123"] fails if ID randomized on page load
- **Iframe Timing:** Iframe not fully loaded when step executed; contentWindow.document throws SecurityError
- **Shadow DOM Slots:** Slotted elements may have XPath pointing to <slot> rather than actual element
- **React Portal Elements:** Portals rendered outside parent tree; XPath resolution fails
- **Lazy-Loaded Content:** Element not in DOM until scroll/user interaction; findElementFromBundle times out
- **Canvas/SVG Elements:** Bounding box match finds canvas, but click coordinates incorrect for sub-element
- **File Upload Inputs:** Cannot programmatically set value; replay fails for `<input type="file">`
- **Select2 Dropdowns:** Styled select may not respond to React-safe input; requires custom logic

## 9. Developer-Must-Know Notes

### Bundle Structure is Immutable Contract
- Replay engine depends on exact LocatorBundle fields from recording engine
- Never remove fields from Bundle interface (breaks old recordings)
- Optional fields must have null checks in findElementFromBundle

### XPath is Primary, But Not Always Best
- XPath at 100% confidence, but most brittle strategy (fails on DOM structure changes)
- Prefer data-testid or aria-label for SPAs with dynamic DOMs
- Consider generating relative XPath (//*[@id='root']//button) instead of absolute (/html/body/div/div/button)

### Fuzzy Matching is Expensive
- stringSimilarity.compareTwoStrings() runs on every element of tag type (e.g., all <button>s)
- For pages with 100+ buttons, fuzzy strategy adds 500ms+ overhead
- Consider disabling fuzzy matching for performance-critical replays

### React-Safe Input is Essential for Controlled Components
- React controlled inputs ignore .value = directly; must use property descriptor
- Must fire both 'input' and 'change' events in sequence
- For non-React inputs, property descriptor still works (backward compatible)

### Timeout Tuning is Project-Specific
- 2s timeout adequate for static sites, insufficient for SPAs with code-splitting
- TestRunner should expose per-step timeout configuration
- Consider network speed detection (navigator.connection.effectiveType) for adaptive timeouts

### Shadow DOM Resolution is Partial
- resolveXPathInShadow() works for open shadowRoot only
- Closed shadow roots require element.openOrClosedShadowRoot polyfill (not present)
- Deeply nested shadow DOMs (3+ levels) untested

### Iframe Replay Requires Same-Origin
- Cross-origin iframes block contentWindow.document access
- Replay silently fails for embedded third-party content (e.g., Stripe payment forms)
- Consider using chrome.tabs.sendMessage to inject content script into iframe origin

### Error Messages are Critical for Debugging
- findElementFromBundle returns { element, strategy, confidence } on success, { error, attemptedStrategies } on failure
- TestRunner UI should display attempted strategies and confidence scores
- Logs should include bundle snapshot for post-mortem analysis

### Performance Degrades with Many Steps
- 500-step replay with 2s timeout per step = 1000s (16 minutes) maximum duration
- Consider parallel execution for independent steps (e.g., multiple form fills)
- Batch step results to reduce chrome.runtime.sendMessage overhead (currently per-step)

### Testing Requires Live DOM State
- Cannot unit test findElementFromBundle without real DOM
- Mock fixtures for XPath, querySelector insufficient (doesn't test integration)
- Recommend recording test cases on stable sandbox sites for regression tests
