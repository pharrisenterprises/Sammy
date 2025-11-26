# Element Finding System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Nine-Tier Fallback Strategy
3. XPath Resolution
4. ID and Attribute Matching
5. ARIA and Accessibility Lookup
6. Fuzzy Text Matching
7. Bounding Box Proximity
8. Retry Logic and Timeouts
9. Shadow DOM Traversal
10. Iframe Chain Resolution
11. Visibility Detection
12. Helper Functions
13. Configuration and Tuning
14. Edge Cases and Pitfalls

---

## 1. Overview

### 1.1 Purpose

The Element Finding System locates DOM elements during replay using metadata captured at recording time. It must handle DOM changes between recording and replay, dynamic content loading, and framework-specific element structures.

### 1.2 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ELEMENT FINDING PRINCIPLES                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. MULTIPLE STRATEGIES                                                 │
│     - Never rely on single locator                                      │
│     - Fallback chain ensures resilience                                 │
│                                                                         │
│  2. CONFIDENCE ORDERING                                                 │
│     - High-confidence strategies first (XPath, ID)                      │
│     - Low-confidence last resort (fuzzy, bounding box)                  │
│                                                                         │
│  3. VISIBILITY REQUIRED                                                 │
│     - Only return visible, interactable elements                        │
│     - Hidden elements cause action failures                             │
│                                                                         │
│  4. TIMEOUT BOUNDED                                                     │
│     - Never hang indefinitely                                           │
│     - Return null after timeout, let caller handle                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Bundle Structure (Input)

```typescript
interface LocatorBundle {
  // Primary identifiers
  id: string | null;
  name: string | null;
  xpath: string;
  
  // Accessibility
  aria: string | null;
  placeholder: string | null;
  
  // Data attributes
  dataAttrs: Record<string, string>;
  
  // Element metadata
  tag: string;
  visibleText: string;
  className: string;
  
  // Position data
  bounding: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Context chain
  iframeChain: number[];
  shadowHosts: string[];
}
```

---

## 2. Nine-Tier Fallback Strategy

### 2.1 Strategy Priority Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FALLBACK PRIORITY                                  │
│                   (Top = Highest Confidence)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 1: XPath Evaluation                              [95%]    │   │
│  │ Direct path to element, handles shadow DOM traversal           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓ (if not found)                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 2: ID + Attribute Verification                   [90%]    │   │
│  │ querySelector by ID, cross-check other attributes              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 3: Name Attribute                                [85%]    │   │
│  │ getElementsByName, filter by visibility                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 4: ARIA Labels                                   [80%]    │   │
│  │ aria-label, aria-labelledby attributes                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 5: Placeholder Text                              [75%]    │   │
│  │ Input placeholder attribute match                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 6: Data Attributes                               [70%]    │   │
│  │ Custom data-* attribute matching                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 7: Fuzzy Text Match                              [60%]    │   │
│  │ String similarity comparison (0.4 threshold)                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 8: Bounding Box Proximity                        [40%]    │   │
│  │ Euclidean distance to saved coordinates (200px)                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TIER 9: Retry Loop                                    [---%]   │   │
│  │ Repeat all strategies after 150ms delay (2s timeout)           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│                      RETURN NULL (element not found)                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Master Implementation

```typescript
async function findElementFromBundle(
  bundle: LocatorBundle,
  options: FindOptions = {}
): Promise<HTMLElement | null> {
  const {
    timeout = 2000,
    retryInterval = 150,
    fuzzyThreshold = 0.4,
    boundingThreshold = 200
  } = options;
  
  const startTime = Date.now();
  
  // Resolve iframe context first
  const targetDoc = resolveIframeChain(bundle.iframeChain);
  if (!targetDoc) {
    console.warn('Failed to resolve iframe chain');
    return null;
  }
  
  while (Date.now() - startTime < timeout) {
    let element: HTMLElement | null = null;
    
    // TIER 1: XPath
    element = resolveXPath(bundle.xpath, bundle.shadowHosts, targetDoc);
    if (element && isVisible(element)) {
      logFindSuccess('xpath', bundle);
      return element;
    }
    
    // TIER 2: ID + Attributes
    if (bundle.id) {
      element = findById(bundle.id, bundle, targetDoc);
      if (element && isVisible(element)) {
        logFindSuccess('id', bundle);
        return element;
      }
    }
    
    // TIER 3: Name
    if (bundle.name) {
      element = findByName(bundle.name, targetDoc);
      if (element && isVisible(element)) {
        logFindSuccess('name', bundle);
        return element;
      }
    }
    
    // TIER 4: ARIA
    if (bundle.aria) {
      element = findByAria(bundle.aria, targetDoc);
      if (element && isVisible(element)) {
        logFindSuccess('aria', bundle);
        return element;
      }
    }
    
    // TIER 5: Placeholder
    if (bundle.placeholder) {
      element = findByPlaceholder(bundle.placeholder, targetDoc);
      if (element && isVisible(element)) {
        logFindSuccess('placeholder', bundle);
        return element;
      }
    }
    
    // TIER 6: Data Attributes
    if (Object.keys(bundle.dataAttrs).length > 0) {
      element = findByDataAttrs(bundle.dataAttrs, targetDoc);
      if (element && isVisible(element)) {
        logFindSuccess('data-attrs', bundle);
        return element;
      }
    }
    
    // TIER 7: Fuzzy Text
    if (bundle.visibleText) {
      element = findByFuzzyText(bundle.visibleText, fuzzyThreshold, targetDoc);
      if (element) {
        logFindSuccess('fuzzy-text', bundle);
        return element;
      }
    }
    
    // TIER 8: Bounding Box
    if (bundle.bounding) {
      element = findByBoundingBox(bundle.bounding, boundingThreshold, targetDoc);
      if (element) {
        logFindSuccess('bounding-box', bundle);
        return element;
      }
    }
    
    // TIER 9: Retry
    await sleep(retryInterval);
  }
  
  logFindFailure(bundle);
  return null;
}
```

---

## 3. XPath Resolution

### 3.1 Standard XPath Evaluation

```typescript
function evaluateXPath(
  xpath: string,
  context: Document | ShadowRoot = document
): HTMLElement | null {
  try {
    const result = document.evaluate(
      xpath,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as HTMLElement;
  } catch (e) {
    // Invalid XPath syntax
    console.warn(`XPath evaluation failed: ${xpath}`, e);
    return null;
  }
}
```

### 3.2 Shadow DOM XPath Traversal

```typescript
function resolveXPath(
  xpath: string,
  shadowHosts: string[],
  doc: Document = document
): HTMLElement | null {
  // No shadow hosts - direct evaluation
  if (!shadowHosts || shadowHosts.length === 0) {
    return evaluateXPath(xpath, doc);
  }
  
  // Navigate through shadow host chain
  let context: Document | ShadowRoot = doc;
  
  for (const hostXPath of shadowHosts) {
    // Find shadow host element
    const host = evaluateXPath(hostXPath, context);
    if (!host) {
      console.warn(`Shadow host not found: ${hostXPath}`);
      return null;
    }
    
    // Get shadow root (try open first, then exposed closed)
    let shadowRoot = host.shadowRoot;
    if (!shadowRoot) {
      shadowRoot = (host as any).__realShadowRoot;
    }
    
    if (!shadowRoot) {
      console.warn(`Shadow root not accessible for: ${hostXPath}`);
      return null;
    }
    
    context = shadowRoot;
  }
  
  // Evaluate final XPath in innermost shadow context
  return evaluateXPath(xpath, context);
}
```

### 3.3 XPath Edge Cases

```typescript
// Handle contenteditable divs (XPath may point to text node)
function resolveXPathWithContentEditable(
  xpath: string,
  context: Document | ShadowRoot
): HTMLElement | null {
  const result = document.evaluate(
    xpath,
    context,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  
  let node = result.singleNodeValue;
  
  // If text node, get parent element
  if (node && node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  
  // If contenteditable, find the editable container
  if (node instanceof HTMLElement) {
    const editable = node.closest('[contenteditable="true"]');
    if (editable) {
      return editable as HTMLElement;
    }
  }
  
  return node as HTMLElement;
}
```

---

## 4. ID and Attribute Matching

### 4.1 ID Lookup with Verification

```typescript
function findById(
  id: string,
  bundle: LocatorBundle,
  doc: Document = document
): HTMLElement | null {
  // Escape special characters in ID
  const escapedId = CSS.escape(id);
  const element = doc.querySelector(`#${escapedId}`) as HTMLElement;
  
  if (!element) return null;
  
  // Verify with additional attributes for confidence
  const score = calculateAttributeScore(element, bundle);
  
  // Require minimum 50% attribute match
  if (score < 0.5) {
    console.warn(`ID found but attributes mismatch: ${id} (score: ${score})`);
    return null;
  }
  
  return element;
}
```

### 4.2 Attribute Scoring

```typescript
function calculateAttributeScore(
  element: HTMLElement,
  bundle: LocatorBundle
): number {
  let matches = 0;
  let total = 0;
  
  // Check name attribute
  if (bundle.name) {
    total++;
    if (element.getAttribute('name') === bundle.name) matches++;
  }
  
  // Check tag name
  if (bundle.tag) {
    total++;
    if (element.tagName.toLowerCase() === bundle.tag.toLowerCase()) matches++;
  }
  
  // Check class name (partial match)
  if (bundle.className) {
    total++;
    const classes = bundle.className.split(' ').filter(c => c);
    const elementClasses = element.className.split(' ').filter(c => c);
    const classOverlap = classes.filter(c => elementClasses.includes(c));
    if (classOverlap.length > 0) matches++;
  }
  
  // Check ARIA label
  if (bundle.aria) {
    total++;
    const ariaLabel = element.getAttribute('aria-label') || 
                      element.getAttribute('aria-labelledby');
    if (ariaLabel === bundle.aria) matches++;
  }
  
  // Check bounding box proximity
  if (bundle.bounding) {
    total++;
    const rect = element.getBoundingClientRect();
    const distance = Math.sqrt(
      Math.pow(rect.x - bundle.bounding.x, 2) +
      Math.pow(rect.y - bundle.bounding.y, 2)
    );
    if (distance < 100) matches++; // Within 100px
  }
  
  return total > 0 ? matches / total : 0;
}
```

---

## 5. ARIA and Accessibility Lookup

### 5.1 ARIA Label Strategies

```typescript
function findByAria(
  ariaValue: string,
  doc: Document = document
): HTMLElement | null {
  // Strategy 1: Direct aria-label match
  let element = doc.querySelector(
    `[aria-label="${CSS.escape(ariaValue)}"]`
  ) as HTMLElement;
  if (element && isVisible(element)) return element;
  
  // Strategy 2: aria-labelledby reference
  element = doc.querySelector(
    `[aria-labelledby="${CSS.escape(ariaValue)}"]`
  ) as HTMLElement;
  if (element && isVisible(element)) return element;
  
  // Strategy 3: Find by referenced label element
  const labelElement = doc.getElementById(ariaValue);
  if (labelElement) {
    // Find element that references this label
    element = doc.querySelector(
      `[aria-labelledby="${ariaValue}"]`
    ) as HTMLElement;
    if (element && isVisible(element)) return element;
  }
  
  // Strategy 4: Partial aria-label match
  const allWithAria = doc.querySelectorAll('[aria-label]');
  for (const el of allWithAria) {
    const label = el.getAttribute('aria-label') || '';
    if (label.includes(ariaValue) || ariaValue.includes(label)) {
      if (isVisible(el as HTMLElement)) {
        return el as HTMLElement;
      }
    }
  }
  
  return null;
}
```

### 5.2 Role-Based Lookup

```typescript
function findByRole(
  role: string,
  name: string,
  doc: Document = document
): HTMLElement | null {
  const elements = doc.querySelectorAll(`[role="${role}"]`);
  
  for (const el of elements) {
    const elName = el.getAttribute('aria-label') || 
                   el.textContent?.trim() || '';
    
    if (elName === name && isVisible(el as HTMLElement)) {
      return el as HTMLElement;
    }
  }
  
  return null;
}
```

---

## 6. Fuzzy Text Matching

### 6.1 String Similarity Algorithm

```typescript
function textSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  // Normalize strings
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1;
  
  // Word set comparison
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  // Calculate Jaccard similarity
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return intersection / union;
}
```

### 6.2 Fuzzy Element Search

```typescript
function findByFuzzyText(
  targetText: string,
  threshold: number = 0.4,
  doc: Document = document
): HTMLElement | null {
  // Collect all text-containing elements
  const candidates: Array<{ element: HTMLElement; score: number }> = [];
  
  // Check input values
  const inputs = doc.querySelectorAll('input, textarea');
  for (const input of inputs) {
    const value = (input as HTMLInputElement).value || '';
    const score = textSimilarity(targetText, value);
    if (score >= threshold && isVisible(input as HTMLElement)) {
      candidates.push({ element: input as HTMLElement, score });
    }
  }
  
  // Check visible text content
  const textElements = doc.querySelectorAll(
    'button, a, label, span, div, p, h1, h2, h3, h4, h5, h6'
  );
  for (const el of textElements) {
    const text = el.textContent?.trim() || '';
    const score = textSimilarity(targetText, text);
    if (score >= threshold && isVisible(el as HTMLElement)) {
      candidates.push({ element: el as HTMLElement, score });
    }
  }
  
  // Return highest scoring match
  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].element;
}
```

### 6.3 Threshold Tuning Guide

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| 0.2 | Very loose matching | Last resort, high false positive risk |
| 0.4 | Default balance | General purpose (current setting) |
| 0.6 | Moderate strictness | Reduce false positives |
| 0.8 | High confidence only | Near-exact matches |

---

## 7. Bounding Box Proximity

### 7.1 Distance Calculation

```typescript
function findByBoundingBox(
  targetBounds: { x: number; y: number; width: number; height: number },
  threshold: number = 200,
  doc: Document = document
): HTMLElement | null {
  // Calculate target center point
  const targetCenter = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height / 2
  };
  
  // Find all visible, interactive elements
  const interactiveSelectors = [
    'input', 'button', 'a', 'select', 'textarea',
    '[role="button"]', '[role="link"]', '[onclick]',
    '[tabindex]', 'label'
  ].join(', ');
  
  const elements = doc.querySelectorAll(interactiveSelectors);
  let closest: { element: HTMLElement; distance: number } | null = null;
  
  for (const el of elements) {
    if (!isVisible(el as HTMLElement)) continue;
    
    const rect = el.getBoundingClientRect();
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };
    
    // Euclidean distance
    const distance = Math.sqrt(
      Math.pow(center.x - targetCenter.x, 2) +
      Math.pow(center.y - targetCenter.y, 2)
    );
    
    if (distance <= threshold) {
      if (!closest || distance < closest.distance) {
        closest = { element: el as HTMLElement, distance };
      }
    }
  }
  
  return closest?.element || null;
}
```

### 7.2 Bounding Box Limitations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOUNDING BOX PITFALLS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ⚠️  POSITION CHANGES                                                   │
│      - Window resize shifts coordinates                                 │
│      - Page scroll affects getBoundingClientRect                        │
│      - Responsive layouts move elements                                 │
│                                                                         │
│  ⚠️  DYNAMIC CONTENT                                                    │
│      - Lazy-loaded content shifts layout                                │
│      - Animations move elements during transition                       │
│      - Ads/banners push content down                                    │
│                                                                         │
│  ⚠️  VIEWPORT DEPENDENCY                                                │
│      - Coordinates relative to viewport, not document                   │
│      - Off-screen elements have negative coordinates                    │
│      - Zoom level affects pixel coordinates                             │
│                                                                         │
│  RECOMMENDATION: Use bounding box as LAST RESORT only                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Retry Logic and Timeouts

### 8.1 Retry Configuration

```typescript
interface RetryConfig {
  timeout: number;        // Total time to wait (default: 2000ms)
  interval: number;       // Time between retries (default: 150ms)
  maxAttempts?: number;   // Optional max retry count
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  timeout: 2000,
  interval: 150
};
```

### 8.2 Exponential Backoff (Future Enhancement)

```typescript
async function findWithBackoff(
  bundle: LocatorBundle,
  config: RetryConfig
): Promise<HTMLElement | null> {
  const startTime = Date.now();
  let attempt = 0;
  let interval = config.interval;
  
  while (Date.now() - startTime < config.timeout) {
    attempt++;
    
    const element = tryAllStrategies(bundle);
    if (element) return element;
    
    // Exponential backoff: 150ms, 300ms, 600ms, 1200ms...
    await sleep(interval);
    interval = Math.min(interval * 2, 1000); // Cap at 1 second
  }
  
  console.warn(`Element not found after ${attempt} attempts`);
  return null;
}
```

### 8.3 Why Fixed Timeout?

**Current:** 2000ms fixed timeout

**Rationale:**
- Most pages load interactive elements within 2 seconds
- Longer timeout delays test execution significantly
- User perception of "stuck" beyond 2 seconds

**Future considerations:**
- Configurable per-step timeout
- Smart-wait for specific conditions (network idle, animations)
- Page-specific timeout profiles

---

## 9. Shadow DOM Traversal

### 9.1 Open Shadow Root Navigation

```typescript
function traverseOpenShadowRoots(
  startElement: Element,
  targetSelector: string
): HTMLElement | null {
  // Try in current context first
  let result = startElement.querySelector(targetSelector) as HTMLElement;
  if (result) return result;
  
  // Find all shadow hosts
  const shadowHosts = startElement.querySelectorAll('*');
  
  for (const host of shadowHosts) {
    if (host.shadowRoot) {
      // Recursively search in shadow root
      result = traverseOpenShadowRoots(host.shadowRoot, targetSelector);
      if (result) return result;
    }
  }
  
  return null;
}
```

### 9.2 Closed Shadow Root Access

```typescript
function accessClosedShadowRoot(host: Element): ShadowRoot | null {
  // Try standard access first (open roots)
  if (host.shadowRoot) {
    return host.shadowRoot;
  }
  
  // Try exposed closed root (from page-interceptor)
  const exposedRoot = (host as any).__realShadowRoot;
  if (exposedRoot) {
    return exposedRoot;
  }
  
  // Cannot access - closed root without interception
  console.warn('Closed shadow root not accessible:', host);
  return null;
}
```

### 9.3 Shadow Host Chain Resolution

```typescript
function resolveShadowHostChain(
  hostXPaths: string[],
  doc: Document = document
): ShadowRoot | null {
  let context: Document | ShadowRoot = doc;
  
  for (let i = 0; i < hostXPaths.length; i++) {
    const hostXPath = hostXPaths[i];
    
    // Find host element in current context
    const host = evaluateXPath(hostXPath, context);
    if (!host) {
      console.warn(`Shadow host not found at index ${i}: ${hostXPath}`);
      return null;
    }
    
    // Get shadow root
    const shadowRoot = accessClosedShadowRoot(host);
    if (!shadowRoot) {
      console.warn(`Cannot access shadow root at index ${i}`);
      return null;
    }
    
    context = shadowRoot;
  }
  
  return context as ShadowRoot;
}
```

---

## 10. Iframe Chain Resolution

### 10.1 Chain Index Navigation

```typescript
function resolveIframeChain(
  chain: number[],
  doc: Document = document
): Document | null {
  if (!chain || chain.length === 0) {
    return doc;
  }
  
  let currentDoc = doc;
  
  for (let i = 0; i < chain.length; i++) {
    const index = chain[i];
    const iframes = currentDoc.querySelectorAll('iframe');
    
    if (index >= iframes.length) {
      console.warn(`Iframe index ${index} out of bounds (${iframes.length} iframes)`);
      return null;
    }
    
    const iframe = iframes[index] as HTMLIFrameElement;
    
    // Check same-origin access
    try {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) {
        console.warn(`Cannot access iframe document at index ${index}`);
        return null;
      }
      currentDoc = iframeDoc;
    } catch (e) {
      console.warn(`Cross-origin iframe at index ${index}`);
      return null;
    }
  }
  
  return currentDoc;
}
```

### 10.2 Cross-Origin Detection

```typescript
function isCrossOrigin(iframe: HTMLIFrameElement): boolean {
  try {
    // Accessing contentDocument throws for cross-origin
    const doc = iframe.contentDocument;
    return doc === null;
  } catch (e) {
    return true;
  }
}
```

---

## 11. Visibility Detection

### 11.1 Comprehensive Visibility Check

```typescript
function isVisible(element: HTMLElement): boolean {
  if (!element) return false;
  
  // Check if element is in DOM
  if (!element.isConnected) return false;
  
  // Check computed styles
  const style = getComputedStyle(element);
  
  // Display none
  if (style.display === 'none') return false;
  
  // Visibility hidden
  if (style.visibility === 'hidden') return false;
  
  // Opacity 0
  if (style.opacity === '0') return false;
  
  // Zero dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  
  // Off-screen (optional - may want to keep for scrollable elements)
  // if (rect.bottom < 0 || rect.right < 0) return false;
  
  // Check parent visibility (recursive)
  if (element.parentElement && element.parentElement !== document.body) {
    const parentStyle = getComputedStyle(element.parentElement);
    if (parentStyle.display === 'none') return false;
  }
  
  return true;
}
```

### 11.2 Interactability Check

```typescript
function isInteractable(element: HTMLElement): boolean {
  if (!isVisible(element)) return false;
  
  // Check disabled state
  if ((element as HTMLInputElement).disabled) return false;
  
  // Check readonly (for inputs)
  if ((element as HTMLInputElement).readOnly) return false;
  
  // Check pointer-events
  const style = getComputedStyle(element);
  if (style.pointerEvents === 'none') return false;
  
  return true;
}
```

---

## 12. Helper Functions

### 12.1 Sleep Utility

```typescript
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 12.2 Logging Utilities

```typescript
function logFindSuccess(strategy: string, bundle: LocatorBundle): void {
  console.info(`[ElementFinder] Found via ${strategy}: ${bundle.xpath?.slice(0, 50)}...`);
}

function logFindFailure(bundle: LocatorBundle): void {
  console.warn(`[ElementFinder] Element not found after timeout`, {
    xpath: bundle.xpath,
    id: bundle.id,
    name: bundle.name,
    visibleText: bundle.visibleText?.slice(0, 30)
  });
}
```

### 12.3 CSS Escape Polyfill

```typescript
// For older browsers without CSS.escape
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  
  // Simple escape for IDs
  return value.replace(/([^\w-])/g, '\\$1');
}
```

---

## 13. Configuration and Tuning

### 13.1 Default Configuration

```typescript
const ELEMENT_FINDER_CONFIG = {
  // Timing
  timeout: 2000,           // Total wait time (ms)
  retryInterval: 150,      // Time between retries (ms)
  
  // Thresholds
  fuzzyThreshold: 0.4,     // 40% text similarity required
  boundingThreshold: 200,  // 200px max distance
  attributeScoreMin: 0.5,  // 50% attribute match for ID verification
  
  // Strategy enables
  enableXPath: true,
  enableId: true,
  enableName: true,
  enableAria: true,
  enablePlaceholder: true,
  enableDataAttrs: true,
  enableFuzzyText: true,
  enableBoundingBox: true,
  
  // Logging
  logSuccesses: true,
  logFailures: true,
  logAttempts: false       // Verbose logging
};
```

### 13.2 Strategy Priority Override

```typescript
type LocatorStrategy = 
  | 'xpath' 
  | 'id' 
  | 'name' 
  | 'aria' 
  | 'placeholder' 
  | 'data-attrs' 
  | 'fuzzy-text' 
  | 'bounding-box';

// Custom priority order
const customPriority: LocatorStrategy[] = [
  'id',           // Some sites have stable IDs
  'xpath',        // Fall back to XPath
  'aria',         // Accessibility-first
  'name',
  'placeholder',
  'data-attrs',
  'fuzzy-text',
  'bounding-box'
];
```

---

## 14. Edge Cases and Pitfalls

### 14.1 Known Edge Cases

| Edge Case | Problem | Current Handling |
|-----------|---------|------------------|
| Dynamic IDs | react-select-1234 changes each render | Falls back to other strategies |
| Stale XPath | DOM restructuring invalidates path | 9-tier fallback |
| Iframe index drift | Iframes added/removed shift indices | Fails silently |
| Shadow DOM timing | Interceptor loads after component | Returns null |
| Hidden elements | display: none on parent | Visibility check fails |
| Cross-origin iframe | Security restriction | Cannot access |

### 14.2 Common Pitfalls

```typescript
// ❌ WRONG: Assuming querySelector works in shadow DOM
document.querySelector('#my-element'); // Doesn't find shadow DOM elements

// ✅ CORRECT: Use shadow-aware traversal
resolveXPath(xpath, shadowHosts);

// ❌ WRONG: Using fixed index for iframes
const iframe = document.querySelectorAll('iframe')[2];
// Index may change if iframes added/removed

// ✅ CORRECT: Use recorded chain with error handling
const doc = resolveIframeChain(bundle.iframeChain);
if (!doc) return null; // Graceful failure

// ❌ WRONG: Trusting bounding box on responsive sites
findByBoundingBox({ x: 500, y: 200 }); // Position changed on mobile

// ✅ CORRECT: Use bounding box as last resort only
// And consider viewport-relative adjustments
```

---

## Summary

The Element Finding System provides:

✅ Nine-tier fallback strategy ensuring resilience  
✅ XPath with shadow DOM traversal for complex component structures  
✅ Attribute verification preventing false positives on ID match  
✅ Fuzzy text matching for dynamic content  
✅ Bounding box proximity as last resort  
✅ Configurable timeouts and thresholds for tuning  
✅ Comprehensive visibility detection filtering hidden elements  
✅ Cross-frame resolution for iframe-heavy applications

This system is the foundation of replay reliability. Each strategy adds resilience while maintaining performance within acceptable bounds.
