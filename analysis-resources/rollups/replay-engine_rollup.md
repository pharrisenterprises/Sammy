# REPLAY ENGINE ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/replay-engine_breakdown.md` (269 lines)
- `modularization-plans/replay-engine_mod-plan.md` (empty - to be populated)
- `implementation-guides/replay-engine_impl.md` (empty - to be populated)

**Subsystem Purpose**: The Replay Engine executes recorded steps on live web pages using multi-strategy element finding and human-like interaction simulation. It must be resilient to DOM changes, handle React controlled inputs, navigate shadow DOM, and gracefully degrade when elements cannot be found.

**Criticality**: ⭐⭐⭐⭐⭐ (Maximum - determines automation success rate)

---

## 2. Core Responsibilities (Compressed)

### MUST DO
- **Multi-Strategy Element Finding**: Try locators in order—XPath → ID → name → aria → placeholder → data-attrs → fuzzy text → bounding box → retry loop (2s timeout)
- **React-Safe Input Handling**: Bypass React's value setter using `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`, dispatch `InputEvent` with `bubbles: true`
- **Human-Like Click Sequences**: Dispatch `mouseover → mousemove → mousedown → mouseup → click` to trigger framework event handlers
- **Value Injection**: Set input values, select dropdown options, toggle checkboxes/radios, handle contenteditable divs
- **Visibility Management**: Temporarily set `display: block` on hidden parent elements, restore after action
- **Shadow DOM Traversal**: Automatically dive into open shadow roots during XPath resolution; fallback to host element click for closed roots
- **Iframe Context Resolution**: Resolve `iframeChain` metadata to correct document before applying XPath
- **Google Autocomplete Delegation**: Send autocomplete actions to page-context replay script via `window.postMessage`
- **Error Recovery**: Return `false` on element-not-found, log errors, continue to next step (no throw)

### MUST NOT DO
- **Never use `element.value = x` alone**: React won't re-render—must call native setter + dispatch events
- **Never assume XPath works**: Always have fallback strategies (ID, name, fuzzy match)
- **Never block on missing elements**: Return false immediately if element not found after timeout
- **Never ignore iframe chain**: XPath is relative to innermost iframe, not main document

---

## 3. Interfaces & Contracts (Compressed)

### Input Message Contract (From Test Runner)
```typescript
chrome.tabs.sendMessage(tabId, {
  type: "runStep",
  data: {
    event: 'click' | 'input' | 'enter',
    bundle: { /* full locator bundle */ },
    value?: string,
    label?: string
  }
});
```

### Response Contract (To Test Runner)
```typescript
sendResponse(success: boolean);
```

### Bundle Resolution Strategy (9-Tier Fallback)
1. **XPath Evaluation**: Try `bundle.xpath` with shadow root traversal
2. **ID Match**: `querySelector('#' + CSS.escape(bundle.id))` with attribute scoring
3. **Name Attribute**: `getElementsByName(bundle.name)` filtered by visibility
4. **ARIA Labels**: `querySelector('[aria-labelledby="..."]')` or `[aria-label="..."]`
5. **Placeholder**: `querySelector('[placeholder="..."]')`
6. **Data Attributes**: Try each `data-*` attribute as exact match
7. **Fuzzy Text Match**: Compare `innerText`/`value` to `bundle.visibleText` using string similarity (threshold 0.4)
8. **Bounding Box**: Find closest visible element by Euclidean distance (threshold 200px)
9. **Retry Loop**: Repeat strategies after 150ms delay until 2s timeout

### Action Execution Contracts

#### Click Action
- Resolve element from bundle
- Check for `[role="radio"]` or `[role="checkbox"]` parent → if present, click specific option matching `value`
- If element is `<select>`, set value instead of clicking
- Otherwise, dispatch `mouseover → mousemove → mousedown → mouseup → click`

#### Input Action
- Resolve element from bundle
- Focus element
- Check if Draft.js editor (`contenteditable` + `id.includes("placeholder")`) → use `document.execCommand('insertText')`
- Check if contenteditable → set `innerText`, dispatch `InputEvent`
- If input/textarea → call native setter, dispatch `InputEvent` + `change`
- If select → find matching option by value or text, set value, dispatch `input` + `change`
- Special case: Select2 → click option, trigger `mouseup` + `click` on dropdown

#### Enter Action
- Resolve element, optionally set value first
- Dispatch `keydown`, `keypress`, `keyup` with `key: "Enter"`, `keyCode: 13`
- If element is `<button>`, also dispatch click sequence

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Replay Engine = Content Script**: Lives in `src/contentScript/content.tsx` (lines 850-1446)
- **Dual-Mode Design**: Same file as Recording Engine—separation needed
- **No Direct Storage**: Receives steps via chrome.tabs.sendMessage from Test Runner

### Layering Restrictions
- **Must operate in isolated world**: Cannot access page variables directly (use page-context script for Google Autocomplete)
- **Must handle cross-frame execution**: Resolve iframe chain before element lookup

### Performance Constraints
- **2s Element Finding Timeout**: After 2 seconds, returns `null` and reports failure
- **150ms Retry Interval**: Waits 150ms between fallback attempts for dynamic content
- **50ms React Settle Delay**: After setting input value, waits 50ms for React state update before dispatching Enter
- **No Parallel Execution**: Steps run sequentially (no concurrency)

### Error Handling Rules
- **Graceful Degradation**: Element-not-found returns `false`, logs warning, doesn't throw
- **Closed Shadow Root Fallback**: If `__realShadowRoot` unavailable, clicks host element (may not trigger internal component)
- **Visibility Restoration**: Always restore hidden elements via `finally` block after action

### Security Requirements
- **No eval() or innerHTML**: Use `dispatchEvent` for all interactions
- **Respect Content Security Policy**: All scripts injected via manifest-declared files
- **Same-Origin Only**: Cannot replay in cross-origin iframes

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **React Controlled Input Bypass**: Standard `element.value = x` doesn't trigger React re-render. Must:
   - Get native setter: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`
   - Call setter: `setter.call(element, value)`
   - Dispatch: `new InputEvent('input', { bubbles: true, data: value })`
   - Dispatch: `new Event('change', { bubbles: true })`

2. **Draft.js (X.com) Special Handling**: Detect via `contenteditable + id.includes("placeholder")`, use `document.execCommand('insertText')` instead of `innerText` assignment

3. **Select2 Dropdown Resolution**: Visual span is NOT the real `<select>`. Must:
   - Find original select via `id.replace('select2-', '').replace('-container', '')`
   - Set value on original `<select>`
   - Dispatch events on original element

4. **Closed Shadow Root Degradation**: If `__realShadowRoot` not exposed (timing race), clicks host element—may not activate internal input

5. **Iframe Chain Index Drift**: If iframes added/removed between record and replay, chain indices shift—XPath applied to wrong frame

6. **Hidden Element Click Failures**: If parent has `display: none`, click doesn't register. Solution:
   - Walk parent chain, set `display: block` on all hidden ancestors
   - Perform action
   - Restore `display: none` in `finally` block

### Common Pitfalls
- **XPath Fragility**: Sibling-index-based XPath breaks if DOM structure changes (e.g., `div[3]` becomes `div[4]` if new div inserted)
- **Bounding Box Stale Coordinates**: Position recorded at capture time—wrong if page scrolled or resized
- **Shadow Root Traversal Assumption**: Auto-dives into open shadow roots during XPath resolution, but fails silently if shadow root not found
- **Fuzzy Match Threshold**: 0.4 similarity score may be too low (false positives) or too high (false negatives) depending on content

### Maintenance Traps
- **No Type Safety in Bundles**: Bundle structure is `any`—typos in property names fail silently
- **Magic Numbers**: 2000ms timeout, 150ms retry, 50ms React delay—no documentation on why
- **Embedded in Recording Logic**: Refactoring risks breaking recording (1,446-line monolith)

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/replay-engine_breakdown.md`
  - Element finding algorithm (9-tier fallback)
  - Action execution flows (click, input, enter)
  - Shadow DOM and iframe handling details
  - Complexity assessment (8/10 rating, refactoring priorities)

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/replay-engine_mod-plan.md` (to be populated)
  - Planned split into ElementFinder, ActionExecutor, ValueInjector, ShadowDOMNavigator, IframeResolver
  - Configurable timeout and retry strategies

### Implementation Guidelines
- **Implementation Guide**: `analysis-resources/implementation-guides/replay-engine_impl.md` (to be populated)
  - React-safe input patterns, Draft.js detection, Select2 handling
  - Testing strategies for replay reliability

### Related Systems
- **Recording Engine**: Generates bundles consumed by Replay Engine
- **Test Orchestrator**: Sends runStep commands, collects success/failure responses
- **Locator Strategy**: Embedded fallback logic (needs extraction)
