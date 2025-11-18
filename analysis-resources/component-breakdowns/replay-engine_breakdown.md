# REPLAY ENGINE BREAKDOWN

## 1. Summary

The Replay Engine is the **action execution system** that takes recorded steps and replays them on live web pages. It uses multi-strategy element finding to locate elements from bundle metadata, then simulates human-like interactions (clicks, typing, keyboard events). This component must be highly resilient to DOM changes, dynamic content, and framework-specific behaviors (React controlled inputs, Select2 dropdowns, shadow DOM).

**Importance**: ⭐⭐⭐⭐⭐ (Critical - determines automation success rate)

## 2. Primary Responsibilities

1. **Element Finding**: Locate elements using multi-strategy fallback (ID, name, XPath, aria, fuzzy text, bounding box)
2. **Action Execution**: Simulate user interactions (click, input, enter, select)
3. **React-Safe Input**: Handle controlled inputs by bypassing React's synthetic event system
4. **Value Injection**: Set input values, select options, toggle checkboxes/radios
5. **Human-Like Behavior**: Dispatch event sequences (mouseover → mousedown → mouseup → click)
6. **Visibility Management**: Temporarily show hidden elements during replay
7. **Shadow DOM Replay**: Navigate into open shadow roots, fallback for closed roots
8. **Google Autocomplete**: Special handling via page-context replay script
9. **Iframe Context Resolution**: Execute actions in correct iframe based on saved chain
10. **Error Handling**: Graceful degradation when elements not found

## 3. Dependencies

### Files
- `src/contentScript/content.tsx` (1,446 lines) - Main replay implementation (lines 850-1,446)
- `src/contentScript/replay.ts` (152 lines) - Page-context Google Autocomplete handler
- `src/pages/TestRunner.tsx` (809 lines) - Orchestrates replay execution

### External Libraries
- `xpath` - XPath evaluation for element finding
- Chrome APIs: `chrome.tabs.sendMessage`, `chrome.runtime.onMessage`

### Browser APIs
- DOM Manipulation (focus, blur, click, dispatchEvent)
- Event Constructors (MouseEvent, KeyboardEvent, InputEvent)
- Shadow DOM (shadowRoot, getRootNode)

## 4. Inputs / Outputs

### Inputs
- **Recorded Steps**: Array of action bundles from Recording Engine
- **CSV Data**: Optional data rows for parameterized execution (from Field Mapper)
- **Execution Context**: Tab ID, iframe chain, page state

### Step Format (Input)
```typescript
{
  event: 'click' | 'input' | 'enter',
  path: string,  // XPath
  value?: string,
  label: string,
  bundle: {
    id, name, xpath, aria, placeholder, dataAttrs,
    tag, visibleText, bounding, iframeChain, shadowHosts
  }
}
```

### Outputs
- **Execution Results**: Success/failure per step
  ```typescript
  {
    success: boolean,
    duration: number,
    error?: string
  }
  ```
- **Status Updates**: Real-time progress notifications to Test Runner UI
- **Logs**: Step-by-step execution trace (info, success, error levels)

### Message Protocol
**From Test Runner → Content Script**:
```typescript
chrome.tabs.sendMessage(tabId, {
  type: "runStep",
  data: { event, bundle, value, label }
});
```

**Response**:
```typescript
sendResponse(success: boolean);
```

## 5. Interactions with Other Subsystems

### Dependencies (Consumes)
- **Recording Engine** → Uses bundle structure and locator metadata
- **Test Runner** → Receives step execution commands via chrome.tabs.sendMessage
- **Page Replay Script** → Delegates Google Autocomplete actions via window.postMessage
- **Background Service** → Coordinates tab injection and lifecycle

### Dependents (Provides To)
- **Test Runner** ← Returns execution status and error details
- **Notification UI** ← Shows step progress overlay on target page

### Communication Mechanisms
- **chrome.tabs.sendMessage**: Receives replay commands from Test Runner
- **window.postMessage**: Sends autocomplete replay actions to page context
- **sendResponse callback**: Returns synchronous success/failure

## 6. Internal Structure

### Core Functions (in `content.tsx`)

#### Element Finding (lines 1050-1250)

**`findElementFromBundle(bundle, opts)`** (150 lines) ⚠️ COMPLEX
Multi-strategy element resolution:

1. **XPath Resolution** (highest priority)
   - Direct document.evaluate()
   - Shadow DOM XPath traversal via `resolveXPathInShadow()`
   - Contenteditable div special case

2. **ID + Attributes Match** (high confidence)
   - querySelector by ID
   - Cross-check name, className, aria, data-attrs
   - Bounding box proximity scoring

3. **Name/Aria/Placeholder Lookup** (medium confidence)
   - getElementsByName()
   - querySelector by aria-labelledby
   - querySelector by placeholder

4. **Fuzzy Text Matching** (low confidence)
   - textSimilarity() comparison (string-similarity library)
   - Match threshold: 0.4 (40% similarity)

5. **Bounding Box Fallback** (last resort)
   - Find nearest visible element to saved coordinates
   - Distance threshold: 200px

6. **Retry Logic** (dynamic content)
   - Retry with 150ms delay if element not found
   - Configurable timeout (default 2000ms)

**Helper Functions**:
- `visible(el)` - Check computed style (display, visibility, opacity)
- `textSimilarity(a, b)` - Fuzzy string matching with word set comparison
- `getIframeChain(el)` - Build parent iframe path
- `getDocumentFromIframeChain(chain)` - Resolve iframe document context

#### Action Execution (lines 1250-1446)

**`playAction(bundle, action)`** (200 lines) ⚠️ COMPLEX
Executes recorded actions with framework-specific handling:

**Action Types**:

1. **Click Actions**
   - Google Autocomplete: Inject page script via `window.postMessage`
   - Select dropdowns: Focus + set value + dispatch change events
   - Radio/Checkbox: Find option by aria-label, simulate mouse events
   - Buttons/Links: Human-like click sequence (mouseover → mousedown → click)

2. **Input Actions**
   - Contenteditable: Set innerText + dispatch InputEvent
   - React Inputs: Bypass React's controlled input via property setter:
     ```typescript
     const proto = HTMLInputElement.prototype;
     const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
     setter.call(element, value);
     element.dispatchEvent(new InputEvent("input", { bubbles: true }));
     ```
   - Select2 Dropdowns: Find original `<select>`, set value, trigger events
   - Textarea: Same as input with multi-line support

3. **Enter Actions**
   - Set value first (if provided)
   - Dispatch KeyboardEvent sequence: keydown → keypress → keyup
   - If button: Also trigger click

**Helper Functions**:
- `focusAndSetValue(element, value)` - React-safe value setter
- `humanClick(element)` - Realistic mouse event sequence
- `temporarilyShow(el)` - Unhide element, return restore function
- `getOriginalSelect(el)` - Resolve Select2 spans to `<select>`

### Page-Context Replay Script

#### `src/contentScript/replay.ts` (152 lines)

**Purpose**: Handle Google Autocomplete inside closed shadow roots

**Architecture**:
- Injected into page context (not content script context)
- Listens for `window.postMessage({ type: "REPLAY_AUTOCOMPLETE" })`
- Accesses exposed `__realShadowRoot` from interceptor

**Actions**:

1. **AUTOCOMPLETE_INPUT**
   - Find input via XPath or shadowHost fallback
   - Set value using property descriptor
   - Dispatch input + change events

2. **AUTOCOMPLETE_SELECTION**
   - Query shadow root for `li[role='option']`
   - Match by text content (case-insensitive)
   - Simulate mouseover → mousedown → click sequence

**Fallback Logic**:
- Try bundle.xpath first
- Fall back to bundle.hostXPath (shadow host)
- Search for `__autocompleteInput` property on host

## 7. Complexity Assessment

**Complexity Rating**: 🔴 **HIGH** (9/10)

### Why Complexity Exists

1. **Element Volatility**: DOM structure changes between recording and replay (class names, IDs, dynamic content)
2. **Framework Diversity**: Must handle React, Vue, Angular, jQuery, vanilla JS differently
3. **Event System Complexity**: Trusted vs. synthetic events, bubbling, capturing, composed paths
4. **Shadow DOM Barriers**: Closed shadow roots block standard DOM queries
5. **Controlled Inputs**: React prevents direct value changes, requires property descriptor hacks
6. **Timing Issues**: Elements not yet loaded, animations in progress, lazy rendering
7. **Locator Fragility**: Single strategy failure requires multi-tier fallback logic

### Risks

1. **Replay Brittleness**: Minor DOM changes break element finding
2. **Performance Degradation**: Multiple fallback strategies slow down execution
3. **False Positives**: Fuzzy text matching may click wrong elements
4. **React Version Issues**: Property descriptor approach may break with React updates
5. **Shadow DOM Breakage**: Monkey-patching vulnerable to browser changes
6. **Timeout Tuning**: Hard-coded 2000ms may be too short for slow pages
7. **Concurrency Issues**: Parallel step execution could interfere with page state

### Refactoring Implications

**Immediate Needs** (Phase 1):
1. Extract element finding into `ElementFinderService`:
   - Interface: `ILocatorStrategy` with `find(bundle): Element | null`
   - Implementations: XPathStrategy, IDStrategy, AriaStrategy, FuzzyTextStrategy
   - Configurable priority and timeout per strategy

2. Split action execution by type:
   - `ClickExecutor` - Mouse interactions
   - `InputExecutor` - Text input handling
   - `SelectExecutor` - Dropdown selection
   - `KeyboardExecutor` - Enter, Tab, Arrow keys

3. Separate framework adapters:
   - `ReactInputAdapter` - Handle controlled inputs
   - `Select2Adapter` - Custom dropdown logic
   - `GoogleAutocompleteAdapter` - Shadow DOM handling

**Long-Term Vision** (Phase 2):
4. Add smart wait strategies:
   - Wait for element visibility
   - Wait for animations to complete
   - Wait for AJAX requests to finish
   - Configurable wait conditions

5. Improve error recovery:
   - Screenshot on failure
   - Retry with alternative locators
   - Graceful degradation (skip vs. fail)

6. Add execution modes:
   - Fast mode (no delays)
   - Realistic mode (human-like timing)
   - Debug mode (pause between steps)

**Complexity Reduction Target**: Medium (6/10) after refactoring
