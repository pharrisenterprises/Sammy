# LOCATOR STRATEGY ROLLUP

## 1. Scope & Sources

**Sources**:
- `component-breakdowns/locator-strategy_breakdown.md` (302 lines)
- `modularization-plans/locator-strategy_mod-plan.md` (empty - to be populated)
- `implementation-guides/locator-strategy_impl.md` (empty - to be populated)

**Subsystem Purpose**: The Locator Strategy System bridges recording and replay by generating multiple element identifiers during recording (XPath, ID, name, CSS, aria, bounding box) and using fallback resolution during replay. It's the resilience layer that enables automation to survive DOM changes.

**Criticality**: ⭐⭐⭐⭐ (High - directly impacts replay success rate)

---

## 2. Core Responsibilities (Compressed)

### MUST DO (Generation Phase - Recording)
- **XPath Generation**: Build unique XPath with sibling indexing (e.g., `html/body/div[3]/input[2]`)—skip `<svg>` tags to avoid Chrome XPath bugs
- **Bundle Creation**: Package all available identifiers into single object: `id`, `name`, `className`, `dataAttrs` (all data-*), `aria`, `placeholder`, `tag`, `visibleText`, `xpath`, `bounding` (left/top/width/height), `iframeChain`, `shadowHosts`
- **Iframe Chain Serialization**: Capture parent iframe path as array of `{id, name, index}` objects
- **Shadow Host Tracking**: Store XPath of shadow host elements for shadow root traversal
- **Special Element Resolution**: Detect Select2 (resolve to original `<select>`), radio/checkbox groups (resolve to `[role="radio"]` parent)

### MUST DO (Resolution Phase - Replay)
- **9-Tier Fallback Execution**: Try strategies in priority order with confidence scoring
- **Visibility Filtering**: Skip `display: none`, `visibility: hidden`, `opacity: 0` elements
- **Confidence Scoring**: Rate element matches (ID+name+aria = high confidence, fuzzy text = low confidence)
- **Retry with Delay**: If not found, wait 150ms and retry (up to 2s timeout) for dynamic content
- **Shadow Root Navigation**: Automatically traverse open shadow roots during XPath evaluation

### MUST NOT DO
- **Never trust single locator**: Always generate multiple fallbacks (minimum: XPath + ID + name + aria)
- **Never skip bounding box**: Even if fragile, it's last-resort fallback for dynamic IDs
- **Never assume stable XPath**: Sibling indices shift with DOM changes—use as primary but have backups
- **Never return first match blindly**: Score candidates and return highest confidence

---

## 3. Interfaces & Contracts (Compressed)

### Bundle Structure (Generation Output)
```typescript
interface Bundle {
  // Direct attribute identifiers
  id?: string;              // element.id
  name?: string;            // element.name
  className?: string;       // element.className
  dataAttrs: Record<string, string>;  // All data-* attributes
  aria?: string;            // aria-labelledby or aria-label
  placeholder?: string;     // placeholder attribute
  
  // Content identifiers
  tag: string;              // tagName.toLowerCase()
  visibleText?: string;     // innerText or value for inputs
  
  // Position identifiers
  xpath: string;            // Primary locator with sibling indices
  bounding?: {              // Element position/size
    left: number;
    top: number;
    width?: number;
    height?: number;
  };
  
  // Context metadata
  iframeChain?: IframeInfo[];   // Parent iframe path
  shadowHosts?: string[];       // Shadow host XPaths
  isClosedShadow?: boolean;     // Closed shadow flag
}
```

### Resolution Strategy Priority (Replay)
1. **XPath (Primary)**: `document.evaluate(xpath)` with shadow root traversal
2. **ID + Attributes**: `querySelector('#id')` scored by matching name/className/aria/data-attrs (score ≥ 2 = return, else add to candidates)
3. **Name**: `getElementsByName(name)` filtered by visibility
4. **ARIA**: `querySelector('[aria-labelledby="..."]')` or `[aria-label="..."]`
5. **Placeholder**: `querySelector('[placeholder="..."]')`
6. **Data Attributes**: Try each `data-key="value"` as exact match
7. **Fuzzy Text Match**: Compare `innerText`/`value` to `bundle.visibleText` (threshold 0.4)
8. **Bounding Box**: Euclidean distance to all visible elements (threshold 200px)
9. **Retry**: Wait 150ms, repeat strategies (max 2s)

### Confidence Scoring Algorithm
```
Base score = 0
+ ID match AND (name OR className OR aria OR data-attr match) = +2
+ Name match = +1
+ ClassName match = +1
+ ARIA match = +1
+ Data attribute matches = +1
+ Bounding box within 5px = +1

If score ≥ 2, return immediately (high confidence)
Else, add to candidates for later evaluation
```

---

## 4. Cross-Cutting Rules & Constraints

### Architectural Boundaries
- **Pure Logic Layer**: No messaging, no UI, no storage—just generation and resolution functions
- **Embedded in Content Script**: Lives in `src/contentScript/content.tsx` (needs extraction to separate module)
- **Used by Both Engines**: Recording Engine calls generation functions, Replay Engine calls resolution functions

### Layering Restrictions
- **Must be stateless**: No global variables, all context passed via parameters
- **Must be synchronous (generation)**: XPath/bundle generation happens in event handlers—cannot be async
- **Must support async (resolution)**: Element finding uses `setTimeout` for retries

### Performance Constraints
- **XPath Generation**: O(depth) where depth = distance from target to `<body>` (typically 10-20 nodes)
- **Sibling Indexing**: O(siblings) for each level—slow on pages with 100+ sibling elements
- **Fuzzy Text Matching**: O(all visible elements) when fallback strategies fail—expensive
- **Bounding Box Scan**: O(all visible elements)—avoid on pages with 1000+ elements

### Error Handling Rules
- **Generation Never Fails**: If attribute unavailable, set as `undefined` in bundle (not null)
- **Resolution Returns Null**: If no element found after timeout, return `null` (don't throw)
- **Shadow Root Failures**: If shadow root not accessible, continue with main document context

### Security Requirements
- **CSS.escape() for IDs**: Prevent CSS injection via malicious IDs (e.g., `id="foo]#bar"`)
- **No eval()**: XPath strings never executed as code
- **No innerHTML**: All text extracted via `textContent` or `innerText`

---

## 5. Edge Cases & Pitfalls

### Critical Edge Cases
1. **Dynamic ID Generation**: Frameworks like React generate IDs like `input-1234`—changes on every render. Bundle includes ID but must rely on other locators during replay.

2. **SVG XPath Bug**: Chrome's `document.evaluate()` breaks on XPath containing `<svg>` elements. Solution: Skip `svg` tags during generation (line 386 in content.tsx).

3. **Shadow Root Traversal**: XPath is relative to innermost document (main doc or shadow root). Must resolve `shadowHosts` chain first, then apply XPath to final context.

4. **Iframe Index Drift**: Iframe chain uses `Array.indexOf(iframe)` for position. If iframes added/removed dynamically, index shifts. Fallback: Try `id` or `name` from chain metadata.

5. **Closed Shadow Root Fallback**: If `__realShadowRoot` not exposed, cannot traverse into closed shadow. Replay falls back to clicking host element—may not trigger internal component.

6. **Fuzzy Match False Positives**: 0.4 similarity threshold catches partial matches but risks matching wrong element. Example: "First Name" matches "First Name (Optional)" at 0.7 similarity.

### Common Pitfalls
- **XPath Assumed Unique**: Sibling indexing only counts same tagName—multiple `<div>` with different classes still get indices. Not globally unique.
- **Bounding Box Stale Coordinates**: Position recorded at capture time. If page scrolls or resizes before replay, coordinates are wrong.
- **Visibility Check Race**: Element may be visible during XPath evaluation but hidden by the time action executes (CSS transitions, animations).
- **Data Attribute Case Sensitivity**: `data-user-id` and `data-userId` are different attributes—bundle captures both but query must match exactly.

### Maintenance Traps
- **No Unit Tests**: Pure logic functions are testable but have no tests—refactoring is risky
- **Magic Numbers**: 0.4 fuzzy threshold, 200px bounding box distance, 150ms retry delay—no documentation
- **Embedded in Monolith**: Cannot extract locator logic without refactoring 1,446-line file

---

## 6. Pointers to Detailed Docs

### Full Technical Specifications
- **Component Breakdown**: `analysis-resources/component-breakdowns/locator-strategy_breakdown.md`
  - XPath generation algorithm (sibling indexing, SVG skipping)
  - 9-tier resolution strategy (priority order, confidence scoring)
  - Shadow DOM and iframe handling
  - Performance analysis (O(n) complexities)

### Modularization Roadmap
- **Modularization Plan**: `analysis-resources/modularization-plans/locator-strategy_mod-plan.md` (to be populated)
  - Extract to standalone module: `LocatorGenerator` and `ElementResolver`
  - Pluggable strategies (enable/disable specific locators)
  - Configurable thresholds (fuzzy match, bounding box distance)

### Implementation Guidelines
- **Implementation Guide**: `analysis-resources/implementation-guides/locator-strategy_impl.md` (to be populated)
  - Best practices for XPath generation
  - Fuzzy matching tuning, bounding box heuristics
  - Testing strategies for locator reliability

### Related Systems
- **Recording Engine**: Calls `getXPath()`, `recordElement()` during event capture
- **Replay Engine**: Calls `findElementFromBundle()` during step execution
- **Shadow DOM Handler**: Provides shadow root traversal context
