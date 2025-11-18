# RECORDING ENGINE BREAKDOWN

## 1. Summary

The Recording Engine is the **core event capture system** responsible for monitoring and recording all user interactions on web pages. It captures clicks, inputs, keyboard events, and navigation actions, then transforms them into structured, replay-able steps with multiple locator strategies. This is one of the most critical and complex components in the entire system, as the quality of recordings directly determines replay success rates.

**Importance**: ⭐⭐⭐⭐⭐ (Critical - foundation of the entire automation system)

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
