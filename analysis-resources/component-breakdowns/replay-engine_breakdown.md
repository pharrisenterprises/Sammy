# replay-engine_breakdown.md

## Purpose
Action execution system that takes recorded steps and replays them on live web pages using multi-strategy element finding and framework-safe interaction simulation.

## Inputs
- Recorded steps: array of action bundles from Recording Engine with event type, bundle metadata, value, label
- CSV data: optional data rows for parameterized execution from Field Mapper
- Execution context: tab ID, iframe chain, page state from Test Runner
- Step format: { event: 'click'|'input'|'enter', path: string, value?: string, label: string, bundle: {...} }

## Outputs
- Execution results: success/failure per step with { success: boolean, duration: number, error?: string }
- Status updates: real-time progress notifications to Test Runner UI via chrome.tabs.sendMessage response
- Logs: step-by-step execution trace with info/success/error levels
- Notification overlay: temporary UI feedback on target page showing current step progress

## Internal Architecture
- **Element Finding** (content.tsx lines 1050-1250): findElementFromBundle() with 9-tier fallback strategy (XPath → ID → name → aria → placeholder → fuzzy text → bounding box → data attributes → retry)
- **Action Execution** (lines 1250-1446): playAction() with framework-specific handling for React inputs, Select2, radio/checkbox, Google Autocomplete
- **React-Safe Input** (focusAndSetValue): Property descriptor bypass to set value on controlled inputs without triggering React warnings
- **Human-Like Behavior** (humanClick): Realistic event sequence (mouseover → mousedown → mouseup → click)
- **Visibility Management** (temporarilyShow): Unhide hidden elements during replay, restore after execution
- **Page-Context Script** (replay.ts 152 lines): Handles Google Autocomplete inside closed shadow roots via window.postMessage

## Critical Dependencies
- **Files**: src/contentScript/content.tsx (lines 850-1,446), src/contentScript/replay.ts, src/pages/TestRunner.tsx
- **Libraries**: xpath for evaluation, string-similarity for fuzzy matching
- **Browser APIs**: DOM manipulation (focus, blur, dispatchEvent), Event constructors (MouseEvent, KeyboardEvent, InputEvent), Shadow DOM (shadowRoot, getRootNode)
- **Subsystems**: Recording Engine for bundle structure, Test Runner for orchestration, Page Replay Script for autocomplete delegation

## Hidden Assumptions
- XPath resolution is highest priority fallback - assumes XPath stability between recording and replay
- React controlled inputs require property descriptor hack - assumes React internals don't change
- Fuzzy text matching threshold of 0.4 (40%) is universal - may be too low/high for different sites
- Fixed 2000ms timeout for element finding - assumes page load completes within this window
- Bounding box proximity threshold of 200px - assumes elements don't move beyond this distance
- Select2 dropdowns always have .select2-hidden-accessible class - framework version dependent
- Google Autocomplete always uses gmp-place-autocomplete tag - Google Maps API specific

## Stability Concerns
- **Element Volatility**: Minor DOM changes (class names, IDs) break element finding between recording and replay
- **Framework Diversity**: React/Vue/Angular/jQuery each require different event dispatching patterns
- **Property Descriptor Hack**: React value setter bypass may break with major React version updates
- **Shadow DOM Barriers**: Closed shadow roots without interception are completely inaccessible
- **Timing Issues**: Elements not yet loaded, animations in progress, lazy rendering cause false failures
- **False Positives**: Fuzzy text matching at 40% threshold may click wrong similar elements

## Edge Cases
- **Dynamic IDs**: Elements with auto-generated IDs (react-1234) fail ID strategy, fall back to XPath/fuzzy
- **Stale XPath**: DOM restructuring between recording and replay invalidates XPath, requires fallback strategies
- **React Strict Mode**: Double-rendering in development can interfere with property descriptor timing
- **Select2 Multiple**: Multi-select dropdowns require special handling not currently implemented
- **Iframe Navigation**: If iframe src changes between recording and replay, element finding fails completely
- **Shadow DOM Interception Failure**: If page-interceptor.tsx loads after shadow component, closed roots remain inaccessible
- **Concurrent Step Execution**: Parallel execution interferes with page state (e.g., two inputs focus same element)

## Developer-Must-Know Notes
- Replay logic is embedded in same file as recording (content.tsx) - should be extracted to separate module
- Element finding tries 9 strategies sequentially - no parallel attempts or confidence scoring
- React input handling waits 50ms after value set before sending Enter - timing critical for form submission
- Google Autocomplete requires page-context script injection - cannot work from content script context alone
- Bundle structure is immutable contract - changing fields breaks all recorded tests
- temporarilyShow() manipulates display style - may conflict with CSS transitions or animations
- findElementFromBundle() has exponential retry backoff - can hang for up to 2 seconds per failed step
- XPath resolution in shadow DOM uses __realShadowRoot property - relies on page-interceptor monkey patch

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
