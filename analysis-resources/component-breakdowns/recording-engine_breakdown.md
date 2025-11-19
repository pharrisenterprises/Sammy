# recording-engine_breakdown.md

## Purpose
Core event capture system that monitors and records all user interactions (clicks, inputs, keyboard events) on web pages, transforming them into structured, replay-able steps with multiple locator strategies.

## Inputs
- User interactions: mouse clicks, keyboard input, form interactions, navigation events
- DOM state: current page structure, iframe hierarchy, shadow DOM state
- Configuration: recording enabled/disabled state from Recorder UI

## Outputs
- Recorded steps: structured event objects with eventType, xpath, value, label, coordinates, and comprehensive element bundles
- Log events: real-time capture notifications broadcast to Recorder UI via chrome.runtime.sendMessage
- Element bundles: comprehensive metadata packages containing ID, name, className, data attributes, aria labels, XPath, bounding box, iframe chain

## Internal Architecture
- **Event Handlers** (content.tsx lines 1-700): handleClick(), handleInput(), handleKeyDown() with special cases for Select2, radio, checkbox, contenteditable
- **Label Detection Engine** (lines 200-450): 12+ heuristic strategies including Google Forms, Bootstrap layouts, aria-label, placeholder, label tags, nearest text nodes
- **Locator Generators** (lines 450-550): getXPath(), recordElement(), getOriginalSelect() for comprehensive bundle creation
- **Iframe Management** (lines 550-650): attachToAllIframes() recursive listener attachment, getIframeChain() path serialization
- **Shadow DOM Support** (lines 650-750): getFocusedElement() traversal, coordination with page-interceptor.tsx for closed shadow root exposure
- **Initialization** (lines 750-850): initContentScript() entry point, dynamic script injection helper

## Critical Dependencies
- **Files**: src/contentScript/content.tsx (1,446 lines monolith), src/contentScript/page-interceptor.tsx (shadow DOM interception)
- **Libraries**: get-xpath for path generation, Chrome APIs (chrome.runtime.sendMessage, chrome.tabs)
- **Browser APIs**: DOM Event API, Shadow DOM API, MutationObserver for dynamic content
- **Subsystems**: Background Service for injection commands, Page Interceptor for shadow DOM events via window.postMessage

## Hidden Assumptions
- Label detection relies on site-specific patterns (Bootstrap, Google Forms, Material-UI) that break with UI updates
- Shadow DOM monkey-patching via Element.prototype.attachShadow interception could break with browser updates
- Event listeners attached recursively to all iframes - assumes cross-origin frames will fail gracefully
- Synthetic events (React-generated) filtered out by checking event.isTrusted flag
- Select2 dropdowns resolved to original select elements using complex DOM traversal

## Stability Concerns
- **Monolithic Design**: 1,446 lines in single file makes testing and maintenance difficult
- **Brittle Heuristics**: Label detection patterns are site-specific and fragile
- **Memory Leaks**: Event listeners not properly cleaned up when recording stops
- **Race Conditions**: Async iframe loading vs. listener attachment timing issues
- **Performance**: Recursive iframe traversal can slow down complex pages with many nested frames

## Edge Cases
- **Dynamic iframes**: New iframes appearing after recording starts require MutationObserver detection
- **Closed shadow DOM**: Requires page-interceptor.tsx injection before components load
- **Google Autocomplete**: Special handling via closed shadow root exposure and event forwarding
- **Contenteditable divs**: Treated as input fields, extract innerText/textContent
- **Select2 dropdowns**: Click on styled div triggers lookup of hidden select element
- **Radio/checkbox groups**: Match by aria-label or role container, not individual inputs

## Developer-Must-Know Notes
- Recording Engine handles BOTH recording AND replay logic (dual responsibility - should be split)
- Bundle structure is critical contract between Recording and Replay - changes break compatibility
- Label detection strategies run in priority order - first match wins (no confidence scoring)
- XPath generation uses sibling indexing ([1], [2]) for uniqueness but fails if DOM reorders
- Page-interceptor.tsx MUST inject before shadow DOM components initialize - timing sensitive
- content.tsx contains ~600 lines of replay logic that belongs in separate module
- Event listeners use composedPath() to traverse shadow boundaries during event capture

## 2. Primary Responsibilities

1. **Event Capture**: Attach and manage event listeners (click, input, keydown, mousedown) across documents and iframes
2. **Label Detection**: Extract human-readable field names using 12+ heuristic strategies (aria-label, placeholder, nearby text, etc.)
3. **Locator Generation**: Create multi-strategy element identifiers (XPath, ID, name, CSS, data-*, aria, bounding box)
4. **Bundle Creation**: Package all element metadata into comprehensive "bundles" for replay resilience
5. **Iframe Tracking**: Serialize iframe chains for cross-frame element resolution
6. **Shadow DOM Handling**: Detect and expose closed shadow roots via monkey-patching
7. **Event Normalization**: Filter synthetic events, detect clickable elements, extract values correctly
8. **Step Transmission**: Send captured events to the Recorder UI via chrome.runtime messaging

## 3. Dependencies

### Files
- `src/contentScript/content.tsx` (1,446 lines) - Main implementation
- `src/contentScript/page-interceptor.tsx` (107 lines) - Shadow DOM interception
- `src/background/background.ts` - Message relay (indirect)

### External Libraries
- `get-xpath` - XPath generation
- Chrome APIs: `chrome.runtime.sendMessage`, `chrome.tabs`

### Browser APIs
- DOM Event API (addEventListener, Event constructors)
- Shadow DOM API (attachShadow, shadowRoot)
- MutationObserver (for dynamic iframe detection)

## 4. Inputs / Outputs

### Inputs
- **User Actions**: Mouse clicks, keyboard input, form interactions, navigation
- **DOM State**: Current page structure, iframe hierarchy, shadow DOM state
- **Configuration**: Recording enabled/disabled state (from Recorder UI)

### Outputs
- **Recorded Steps**: Structured event objects sent to Recorder UI
  ```typescript
  {
    eventType: 'click' | 'input' | 'enter' | 'open',
    xpath: string,
    value: string,
    label: string,
    x: number,
    y: number,
    bundle: {
      id, name, className, dataAttrs, aria, placeholder,
      tag, visibleText, xpath, bounding, iframeChain
    }
  }
  ```
- **Log Events**: Real-time capture notifications (timestamp, event type, selector)

### Message Format
```typescript
chrome.runtime.sendMessage({
  type: "logEvent",
  data: {
    eventType, xpath, value, label, x, y, bundle, page
  }
});
```

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Background Service** → Receives injection commands, provides tab context
- **Page Interceptor** → Receives shadow DOM exposure and autocomplete events via `window.postMessage`

### Dependents (Provides To)
- **Recorder UI** ← Sends recorded steps for display and storage
- **Replay Engine** ← Provides bundle structure used for element finding

### Communication Mechanisms
- **chrome.runtime.sendMessage**: Unidirectional step broadcasting to extension pages
- **window.postMessage**: Cross-context communication with page scripts
- **chrome.runtime.onMessage**: Receives replay commands (dual-mode: recording + replay)

## 6. Internal Structure

### Core Files

#### `src/contentScript/content.tsx` (1,446 lines) ⚠️ MONOLITHIC
**Sections**:
1. **Event Handlers** (lines 1-700)
   - `handleClick()` - Click event processing with Select2, radio, checkbox detection
   - `handleInput()` - Input event capture with contenteditable support
   - `handleKeyDown()` - Enter key detection

2. **Label Detection Engine** (lines 200-450)
   - `getLabelForTarget()` - 12+ heuristic strategies:
     - Google Forms question titles
     - Label tags (parent, for-attribute, aria-labelledby)
     - Placeholder attributes
     - Bootstrap row/column layouts
     - Select2 dropdown labels
     - Fallback to nearest text nodes

3. **Locator Generators** (lines 450-550)
   - `getXPath()` - Generate unique XPath with sibling indexing
   - `recordElement()` - Create comprehensive bundle with all identifiers
   - `getOriginalSelect()` - Resolve Select2 to original `<select>`

4. **Iframe Management** (lines 550-650)
   - `attachToAllIframes()` - Recursive iframe listener attachment
   - `getIframeChain()` - Build parent iframe path
   - `serializeIframeChain()` - Convert to JSON-serializable structure

5. **Shadow DOM Support** (lines 650-750)
   - `getFocusedElement()` - Traverse into iframe activeElement
   - Shadow root detection and exposure coordination

6. **Initialization** (lines 750-850)
   - `initContentScript()` - Main entry point
   - `attachListeners()` - Event listener registration
   - `injectScript()` - Dynamic script injection helper

#### `src/contentScript/page-interceptor.tsx` (107 lines)
**Purpose**: Intercept closed shadow roots before they're sealed
- Monkey-patches `Element.prototype.attachShadow`
- Exposes closed shadow roots via `__realShadowRoot` property
- Special handling for `<gmp-place-autocomplete>` (Google Places)
- Monitors for input/selection events inside closed shadow roots
- Sends events back to content script via `window.postMessage`

### Data Structures

#### Bundle (Primary Data Model)
```typescript
interface Bundle {
  id?: string;
  name?: string;
  className?: string;
  dataAttrs: Record<string, string>;
  aria?: string;
  placeholder?: string;
  tag: string;
  visibleText?: string;
  xpath: string;
  bounding?: { left, top, width, height };
  iframeChain?: IframeInfo[];
  shadowHosts?: string[];
  isClosedShadow?: boolean;
}
```

## 7. Complexity Assessment

**Complexity Rating**: 🔴 **HIGH** (9/10)

### Why Complexity Exists

1. **Browser Inconsistencies**: Must handle Chrome, Firefox, Edge quirks
2. **Dynamic DOM**: Pages load content asynchronously, iframes appear/disappear
3. **Shadow DOM Variety**: Open roots, closed roots, nested shadow DOM, Web Components
4. **Form Framework Diversity**: React forms, Bootstrap layouts, Material-UI, Select2, Jotform, Google Forms
5. **Label Ambiguity**: No standard way to associate labels with inputs across frameworks
6. **Event Timing**: Synthetic vs. trusted events, React re-renders, debouncing
7. **Monolithic Design**: 1,446 lines in single file makes testing and maintenance difficult

### Risks

1. **Brittle Heuristics**: Label detection relies on site-specific patterns that break with UI updates
2. **Monkey-Patch Fragility**: Shadow DOM interception could break with browser updates
3. **Performance**: Attaching listeners to all iframes recursively can slow down complex pages
4. **Memory Leaks**: Event listeners not properly cleaned up when recording stops
5. **Race Conditions**: Async iframe loading vs. listener attachment timing
6. **Maintenance Burden**: Changes require understanding 1,400+ line file

### Refactoring Implications

**Immediate Needs** (Phase 1):
1. Split into 5-7 focused modules:
   - `EventListenerManager` - Attach/detach/lifecycle
   - `LabelDetectionEngine` - Pluggable strategy pattern
   - `LocatorGenerator` - XPath, CSS, ID generation
   - `IframeCoordinator` - Cross-frame tracking
   - `ShadowDOMHandler` - Open/closed root handling
   - `BundleBuilder` - Data packaging

**Long-Term Vision** (Phase 2):
2. Make label detection pluggable:
   - Define `ILabelStrategy` interface
   - Implement per-framework strategies (Bootstrap, Material-UI, etc.)
   - Allow user-defined custom strategies

3. Add configuration layer:
   - Which events to capture (click, hover, focus)
   - Locator priority (prefer ID over XPath)
   - Performance tuning (debounce, throttle)

4. Improve testability:
   - Unit tests for label detection strategies
   - Integration tests for iframe traversal
   - Mock DOM fixtures for edge cases

**Complexity Reduction Target**: Medium (6/10) after refactoring
