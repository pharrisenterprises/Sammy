# Locator Strategy - Component Breakdown

## 1. Purpose

The Locator Strategy subsystem is the element identification protocol embedded in both recording and replay engines, defining how elements are captured as multi-dimensional LocatorBundles during recording and resolved back to live DOM nodes during replay using confidence-scored fallback chains.

**Core Responsibilities:**
- Define LocatorBundle interface as immutable contract between recording and replay
- Generate 15+ element identifiers during recording (XPath, ID, name, CSS, aria, data-attrs, placeholder, text, bounding box, iframe chain, shadow hosts)
- Resolve bundles to elements during replay via 9-tier fallback strategy with confidence scoring
- Provide resilience against DOM structure changes, dynamic IDs, and framework re-renders
- Support cross-frame and shadow DOM element identification

## 2. Inputs

**During Recording:**
- **DOM Element:** Target element from event.target or event.currentTarget
- **Page Context:** document.location.href, window.frameElement, shadowRoot.host chains
- **Element Properties:** id, name, className, placeholder, aria-*, data-*, tagName, textContent, computedStyle
- **Spatial Data:** getBoundingClientRect() for x, y, width, height

**During Replay:**
- **LocatorBundle Object:** Serialized bundle from projects.recorded_steps
- **Current Page State:** document with all iframes and shadow roots
- **Timing Constraints:** Timeout (default 2s), retry interval (default 150ms)

## 3. Outputs

**During Recording:**
- **LocatorBundle Object:**
  ```typescript
  interface LocatorBundle {
    tag: string;                       // Element tag name (e.g., "input", "button")
    id: string | null;                 // Element ID attribute
    name: string | null;               // name attribute
    placeholder: string | null;        // placeholder attribute
    aria: string | null;               // aria-label or aria-labelledby
    dataAttrs: Record<string, string>; // All data-* attributes
    text: string;                      // textContent or innerText
    css: string;                       // className string
    xpath: string;                     // Absolute XPath
    classes: string[];                 // classList array
    pageUrl: string;                   // document.location.href
    bounding: { x, y, width, height }; // Bounding box coordinates
    iframeChain: number[] | null;      // Array of iframe indices (null if top frame)
    shadowHosts: string[] | null;      // Array of shadow host XPaths (null if no shadow DOM)
  }
  ```

**During Replay:**
- **Element Reference:** Live HTMLElement | null
- **Resolution Metadata:** { strategy: string, confidence: number, duration: number }
- **Error Details:** { error: string, attemptedStrategies: string[] } on failure

## 4. Internal Architecture

**Not a Separate Module:** Locator strategy logic is embedded in content.tsx (1,446 lines)

**Recording Functions (src/contentScript/content.tsx lines 450-650):**
- `recordElement(target, event, value?)` - 120 lines: Orchestrates bundle creation
- `getXPath(element)` - 50 lines: Generates absolute XPath with sibling indexing (`/html/body/div[2]/...`)
- `getDataAttributes(element)` - 20 lines: Extracts all `data-*` attributes as object
- `getBoundingInfo(element)` - 15 lines: Returns {x, y, width, height} from getBoundingClientRect
- `getIframeChain(element)` - 40 lines: Walks window.frameElement ancestry returning indices
- `getShadowHosts(element)` - 30 lines: Walks shadowRoot.host chain returning XPath array

**Replay Functions (src/contentScript/content.tsx lines 850-1050):**
- `findElementFromBundle(bundle, timeout=2000)` - 150 lines: 9-tier fallback with retry loop
- Strategy implementations embedded inline (no separate functions per strategy)
- Confidence scoring hardcoded per strategy (100% XPath → 40% fuzzy text)

**9-Tier Fallback Priority:**
1. **XPath (100%):** `document.evaluate(bundle.xpath)` with shadow root support
2. **ID + Attributes (90%):** `querySelector(`#${id}[name="${name}"]`)`
3. **Name (80%):** `querySelector(`[name="${name}"]`)`
4. **Aria (75%):** `querySelector(`[aria-label="${aria}"]`)`
5. **Placeholder (70%):** `querySelector(`[placeholder="${placeholder}"]`)`
6. **Data Attributes (65%):** `querySelector(`[data-testid="${dataAttrs.testid}"]`)`
7. **Fuzzy Text (40%):** `stringSimilarity.compareTwoStrings(el.textContent, bundle.text) > 0.4`
8. **Bounding Box (spatial):** Euclidean distance < 200px from recorded coordinates
9. **Retry:** Re-execute strategies 1-8 every 150ms up to 2s timeout

**Confidence Scoring Logic:**
- Strategies ordered by perceived stability (XPath absolute > fuzzy text)
- No machine learning or adaptive scoring
- Thresholds chosen empirically (e.g., 0.4 for fuzzy text, 200px for bounding box)
- First strategy to find element wins; no "best match" across multiple strategies

## 5. Critical Dependencies

- **XPath Library (xpath 0.0.34):** document.evaluate() for generation and resolution
- **string-similarity 4.0.4:** Dice coefficient algorithm for fuzzy text matching
- **DOM APIs:** querySelector, querySelectorAll, getBoundingClientRect, classList
- **Shadow DOM APIs:** element.shadowRoot, shadowRoot.host, getRootNode()
- **Iframe APIs:** window.parent, window.frameElement, iframe.contentWindow
- **Chrome Extension Context:** Must run in content script with access to page DOM

**Breaking Changes Risk:**
- XPath spec changes (unlikely but catastrophic)
- string-similarity API changes (e.g., algorithm switch from Dice to Levenshtein)
- Shadow DOM v2 spec changes (closed shadowRoot access restrictions)

## 6. Hidden Assumptions

- **XPath Always Most Reliable:** Assumes DOM structure stable between recording and replay (often false for SPAs)
- **Single Match Sufficient:** First element matching strategy returned; no check for ambiguity (e.g., multiple buttons with same name)
- **English Text Content:** Fuzzy text matching assumes Latin characters; may fail for CJK, Arabic, RTL scripts
- **Fixed Thresholds Universal:** 0.4 fuzzy similarity, 200px bounding box distance chosen for generic sites; not tuned per-project
- **Bounding Box Coordinates Stable:** Assumes page layout identical at replay (fails for responsive designs, different screen sizes)
- **No Element Visibility Check:** Strategies find element in DOM but don't verify `display: block`, `opacity: 1`, etc.
- **Iframe Indices Stable:** Assumes iframe order in DOM unchanged (fails if iframes dynamically added/removed)
- **Shadow DOM Depth Limited:** Tested for 1-2 shadow root levels; deep nesting (3+) untested

## 7. Stability Concerns

- **Embedded in Monolith:** Locator logic mixed with recording/replay in 1,446-line file; cannot independently test or version
- **No Strategy Extensibility:** Adding new strategies requires editing content.tsx; cannot plugin custom strategies
- **Hardcoded Confidence Scores:** Changing thresholds requires code change and re-deployment; no runtime configuration
- **XPath Brittleness:** Absolute XPath (`/html/body/div[2]/...`) breaks on any DOM structure change (most common failure mode)
- **No Fallback Validation:** Strategies tried in sequence; if strategy 2 fails, no re-attempt after strategy 9 completes
- **Memory Leaks in Retry Loop:** Polling loop may leak setTimeout handles if replay aborted mid-step
- **No Performance Metrics:** No tracking of which strategies succeed most often (data-driven optimization impossible)

## 8. Edge Cases

- **Multiple Elements Match:** If querySelector(`[name="email"]`) finds 5 inputs, returns first (may be wrong one)
- **Dynamic IDs:** XPath `//*[@id="form-abc123"]` fails if ID includes timestamp/session token
- **Shadow DOM Slots:** XPath may point to <slot> element, not slotted content
- **Iframe Cross-Origin:** contentWindow.document blocked by CORS; iframeChain resolution fails silently
- **Elements Outside Viewport:** Bounding box strategy may match element at (x: -500, y: -500) if coordinates recorded during scroll
- **Hidden Elements:** Element found but `display: none`; click/input operations fail
- **React Portals:** Element rendered outside parent tree; XPath traversal from parent fails
- **SVG/Canvas Sub-Elements:** XPath points to <svg> element; coordinates don't identify <path> or canvas sub-region
- **Text Content Changes:** Fuzzy match fails if button text "Submit" changed to "Save" (similarity < 0.4 threshold)
- **Lazy-Loaded Elements:** Element not in DOM at 0ms; requires full 2s timeout before fallback strategies tried

## 9. Developer-Must-Know Notes

### Bundle Interface is Sacred
- LocatorBundle is the only contract between recording and replay
- Never remove fields (breaks old recordings)
- Adding fields requires optional properties (`newField?: string`) to maintain backward compatibility
- Bundle serialization must support JSON.stringify (no functions, DOM nodes, circular references)

### XPath is Both Best and Worst Strategy
- 100% confidence for static sites with stable DOM
- 0% reliability for SPAs with dynamic rendering, React keys, conditional classes
- Prefer data-testid or aria-label for framework-heavy sites
- Consider switching to relative XPath (`//*[@id="root"]//button`) instead of absolute

### Fuzzy Text Matching is Slow
- Iterates through all elements of tag type (`document.querySelectorAll(bundle.tag)`)
- For <button> tag on page with 200 buttons, 200 compareTwoStrings() calls
- Each comparison ~5ms → 1s overhead for single button
- Consider disabling fuzzy strategy for performance-critical replays

### Bounding Box Strategy is Last Resort
- Assumes identical viewport size, scroll position, screen resolution at replay
- Fails for responsive designs (mobile vs desktop)
- Euclidean distance calculation: `Math.sqrt((x1 - x2)**2 + (y1 - y2)**2) < 200`
- 200px threshold chosen arbitrarily; may need tuning per project

### Confidence Scores are Heuristic, Not Statistical
- Percentages (100%, 90%, 75%) represent developer intuition, not measured accuracy
- No A/B testing or ML training to validate scores
- Consider instrumenting replay failures to build data-driven confidence model

### Strategy Execution is Sequential, Not Parallel
- Strategies tried in order 1 → 2 → 3 ... → 9
- If XPath fails but ID succeeds, no re-validation that ID element is correct one
- Parallel execution with "best match" voting not implemented (would improve accuracy but add complexity)

### No Built-In Strategy Customization
- Cannot disable specific strategies per project (e.g., "never use fuzzy text")
- Cannot re-order strategies per site (e.g., "try data-testid before XPath for SPAs")
- Requires forking content.tsx to customize behavior

### Iframe and Shadow DOM Support is Partial
- iframeChain assumes same-origin iframes (cross-origin blocked by browser)
- shadowHosts assumes open shadow roots (closed roots require polyfill)
- Nested combinations (iframe inside shadow DOM inside iframe) untested

### Locator Strategy Should Be Separate Module
- Current embedding in content.tsx makes testing impossible
- Recommend extracting to `src/common/locator-strategy.ts` with:
  - `interface IStrategy { name: string; confidence: number; resolve(bundle: Bundle): HTMLElement | null }`
  - `class LocatorResolver { constructor(strategies: IStrategy[]); resolve(bundle): Promise<Element> }`
  - Enables unit tests, strategy plugins, runtime configuration
