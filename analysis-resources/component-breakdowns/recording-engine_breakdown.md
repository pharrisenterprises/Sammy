# Recording Engine - Component Breakdown

## 1. Purpose

The Recording Engine is a monolithic user interaction capture system embedded in the content script that observes DOM events, generates multi-strategy element locators, detects contextual labels, and serializes user actions into immutable Bundle structures for reliable replay.

**Core Responsibilities:**
- Listen for click, input, change, submit events via addEventListener on shadowRoot-aware document
- Generate XPath + 8 fallback locator strategies per interaction
- Detect associated labels through 12+ heuristics (aria-label, Google Forms patterns, label[for], placeholder, Bootstrap layouts, etc.)
- Construct LocatorBundle objects containing tag, id, name, placeholder, aria, dataAttrs, text, css, xpath, classes, pageUrl, bounding box, iframeChain, shadowHosts
- Stream recorded steps to background service via chrome.runtime.sendMessage for persistent storage
- Support iframe and Shadow DOM traversal during recording

## 2. Inputs

- **User Interactions:** DOM Events (click, input, change, submit, keyup, focus, blur)
- **Recording State:** isRecording flag (controlled by background script via chrome.runtime.sendMessage)
- **Page Context:** document.location.href, document.activeElement, event.target
- **Project Context:** projectId from chrome.storage.local (set by Recorder UI page)
- **Element Attributes:** id, name, className, placeholder, aria-*, data-*, tag, textContent, computedStyle
- **Structural Context:** parentNode chains, shadowRoot traversal, iframe contentWindow, getComputedStyle, getBoundingClientRect

## 3. Outputs

- **LocatorBundle Objects:** Serialized JSON structures containing 15+ element identification strategies
  ```typescript
  {
    tag: string,
    id: string | null,
    name: string | null,
    placeholder: string | null,
    aria: string | null,
    dataAttrs: Record<string, string>,
    text: string,
    css: string,
    xpath: string,
    classes: string[],
    pageUrl: string,
    bounding: { x, y, width, height },
    iframeChain: number[] | null,
    shadowHosts: string[] | null
  }
  ```
- **Recorded Steps Array:** Sent to background script via message bus with action "record_step"
- **Console Logs:** Debug output for label detection, XPath generation, bundle construction
- **Visual Feedback:** Highlight flashes on recorded elements (classList.add "recorder-highlight")

## 4. Internal Architecture

**Primary Location:** src/contentScript/content.tsx lines 1-850 (1,446-line monolith)

**Key Functions:**
- `handleClick(event)` - 80 lines: Captures click events, prevents default for <a> tags during recording, calls recordElement
- `handleInput(event)` - 50 lines: Captures input/change events, records value for text inputs, calls recordElement
- `recordElement(target, event, value?)` - 120 lines: Central orchestrator constructing LocatorBundle from element + context
- `getXPath(element)` - 50 lines: Generates XPath with shadow root traversal support, uses `/html/body/...` absolute paths
- `getLabelForTarget(element)` - 200 lines: 12+ label detection strategies returning { label: string, confidence: number }
- `getDataAttributes(element)` - 20 lines: Extracts all data-* attributes into object
- `getBoundingInfo(element)` - 15 lines: Returns { x, y, width, height } via getBoundingClientRect
- `getIframeChain(element)` - 40 lines: Walks window.frameElement chain returning array of frame indices
- `getShadowHosts(element)` - 30 lines: Walks shadowRoot.host chain returning XPath array

**Label Detection Strategies (Confidence Scoring):**
1. Google Forms: .freebirdFormviewerComponentsQuestionBaseTitle (95%)
2. aria-label attribute (90%)
3. aria-labelledby reference (90%)
4. label[for] via document.getElementById (85%)
5. Ancestor <label> with textContent (80%)
6. Placeholder attribute (70%)
7. name attribute (65%)
8. Adjacent sibling <label> or <span> (60%)
9. Bootstrap form-label within .form-group (75%)
10. Material-UI label with data-shrink (70%)
11. Previous sibling text node (50%)
12. Parent element textContent (40%)

**Data Flow:**
1. User interacts with page element
2. Event listener fires (handleClick/handleInput)
3. recordElement() constructs Bundle:
   - getXPath(element) → xpath field
   - getLabelForTarget(element) → label field  
   - getDataAttributes(element) → dataAttrs field
   - getBoundingInfo(element) → bounding field
   - element.id, name, className → id, name, css fields
4. Bundle sent to background: `chrome.runtime.sendMessage({ action: "record_step", bundle })`
5. Background stores in Dexie projects.recorded_steps array
6. Visual feedback: element.classList.add("recorder-highlight") for 500ms

## 5. Critical Dependencies

- **chrome.runtime API:** sendMessage for background communication, ~64MB message size limit
- **XPath Library (xpath 0.0.34):** document.evaluate() for XPath generation and validation
- **Shadow DOM APIs:** element.shadowRoot, shadowRoot.host for closed shadow trees
- **Iframe APIs:** window.parent, window.frameElement, iframe.contentWindow
- **CSS Selectors:** document.querySelector, element.matches for pattern matching
- **DOM APIs:** getBoundingClientRect, getComputedStyle, textContent, classList
- **Event Handling:** addEventListener, preventDefault, stopPropagation, event.target
- **Background Storage Coordination:** Assumes background script maintains Dexie.projects.recorded_steps

**Breaking Changes Risk:**
- Shadow DOM changes in Chrome v116+ (closed shadowRoot access restrictions)
- XPath spec changes (unlikely but possible)
- Chrome Extension Manifest V3 message size limits (current 64MB)

## 6. Hidden Assumptions

- **Synchronous XPath Generation:** Assumes getXPath() completes <100ms (no await, blocks event handler)
- **Stable DOM Structure:** XPath generated at recording time must be valid at replay time (no dynamic ID changes)
- **Single Iframe Depth:** iframeChain logic tested primarily for 1-2 levels, not deeply nested structures
- **English Text Patterns:** Label detection heuristics optimized for English form patterns (Google Forms, Bootstrap)
- **No Replay Feedback Loop:** Recording engine assumes bundles are write-only; no validation if replay can resolve them
- **Background Script Always Available:** No retry logic if chrome.runtime.sendMessage fails (network error, background restart)
- **Single Recording Session:** isRecording flag not designed for concurrent multi-tab recording
- **Static Page Loads:** Does not record SPA route transitions or dynamic content loads without user interaction

## 7. Stability Concerns

- **1,446-Line Monolith:** content.tsx contains recording + replay + message handling; difficult to unit test in isolation
- **12+ Label Strategies:** High complexity in getLabelForTarget() with nested conditions; edge cases may return incorrect labels
- **XPath Brittleness:** Absolute XPath (/html/body/div[2]/...) breaks if page structure changes between recording and replay
- **Shadow DOM Reliability:** getShadowHosts() may fail for closed shadow roots without proper element.openOrClosedShadowRoot polyfill
- **Message Bus Capacity:** Sending 500+ bundles in rapid succession may exceed chrome.runtime buffer, causing dropped messages
- **Memory Leaks:** Event listeners never removed if recording disabled mid-session (no cleanup handler)
- **No Transaction Safety:** Multiple record_step messages sent without acknowledgement; if background crashes, steps lost

## 8. Edge Cases

- **Hidden Elements:** `display: none` elements recorded but bounding box returns { x: 0, y: 0, width: 0, height: 0 }
- **Overlapping Elements:** Click on element behind another may record wrong target (event.target vs event.currentTarget)
- **Dynamic Forms:** Google Forms adding/removing fields mid-recording causes XPath indices to shift
- **React Portals:** Elements rendered outside parent tree may have incorrect iframeChain (shadowHosts tracked but not React portals)
- **Canvas/SVG Clicks:** Clicks on <canvas> record canvas element, not sub-coordinates; SVG may record <svg> vs <path>
- **Rapid Clicks:** Double-click, triple-click may record duplicate bundles without deduplication
- **Iframe Cross-Origin:** contentWindow.document access blocked by CORS; iframeChain returns partial path
- **Shadow DOM Slots:** <slot> elements may resolve to wrong label if slotted content not in shadowRoot
- **Custom Elements:** Web components with closed shadowRoot may fail label detection entirely
- **File Inputs:** `<input type="file">` records click but value is empty (security restriction)

## 9. Developer-Must-Know Notes

### Bundle Structure is Immutable Contract
- LocatorBundle format is shared with replay engine; changing fields breaks existing recordings
- Always maintain backward compatibility when adding fields (use optional properties)
- Never remove fields (breaks replay for old projects)

### XPath is Primary, Fallbacks are Secondary
- Replay engine prioritizes xpath (100% confidence) over all other strategies
- Only generate XPath if element is in static DOM (not for ephemeral modals)
- Use data-testid attributes for stable identification in SPAs

### Label Detection is Best-Effort, Not Guaranteed
- getLabelForTarget() returns `{ label: "Unlabeled", confidence: 0 }` if all strategies fail
- Confidence scoring is heuristic-based, not ML-trained; tuning required per site
- Google Forms detection is most reliable (95%), generic patterns less so (40-60%)

### Recording Does Not Validate Replayability
- No check if generated XPath/selectors will resolve at replay time
- No simulation of element finding strategies during recording
- Developers must manually test replay after recording in diverse DOM states

### Performance Impact on High-Frequency Events
- Input events on text fields fire per keystroke; recordElement() called 50+ times for paragraph
- No debouncing or throttling; may cause UI lag on slow machines
- Consider batching bundles before chrome.runtime.sendMessage

### Shadow DOM and Iframe Support is Partial
- getShadowHosts() works for open shadowRoot only; closed shadowRoot requires element.openOrClosedShadowRoot polyfill
- Iframe traversal tested for same-origin iframes only; cross-origin blocked by browser
- Deeply nested iframes (3+ levels) may have incomplete iframeChain

### No Error Recovery for Message Bus Failures
- If chrome.runtime.sendMessage fails (background script dead), bundle is silently lost
- No local queue or retry mechanism
- Developers must monitor chrome.runtime.lastError in production

### Testing Requires Real Chrome Extension Context
- Cannot unit test in jsdom or puppeteer without chrome.runtime mock
- Bundle generation logic tightly coupled to DOM traversal (hard to extract)
- Recommend E2E tests in real extension environment over unit tests
