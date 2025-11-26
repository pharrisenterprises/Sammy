# Error Recovery System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Error Classification
3. Graceful Degradation
4. Retry Strategies
5. Element Not Found Recovery
6. Action Failure Recovery
7. Timeout Handling
8. State Recovery
9. Logging and Diagnostics
10. Recovery Configuration
11. Future: AI-Powered Healing
12. Best Practices

---

## 1. Overview

### 1.1 Purpose

The Error Recovery System handles failures during replay execution, providing graceful degradation, retry mechanisms, and diagnostic information. The goal is to maximize test success rate while providing actionable feedback when recovery fails.

### 1.2 Design Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ERROR RECOVERY PRINCIPLES                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. NEVER THROW TO CALLER                                               │
│     - All errors are caught and converted to result objects             │
│     - Callers receive success/failure status, never exceptions          │
│                                                                         │
│  2. FAIL FAST, RECOVER SMART                                            │
│     - Detect failures quickly (bounded timeouts)                        │
│     - Apply appropriate recovery strategy                               │
│     - Don't waste time on unrecoverable situations                      │
│                                                                         │
│  3. PRESERVE CONTEXT                                                    │
│     - Capture full error context for diagnostics                        │
│     - Include element state, page state, action details                 │
│     - Enable post-mortem analysis                                       │
│                                                                         │
│  4. PROGRESSIVE DEGRADATION                                             │
│     - Try best strategy first                                           │
│     - Fall back to less precise strategies                              │
│     - Accept partial success when appropriate                           │
│                                                                         │
│  5. CONFIGURABLE BEHAVIOR                                               │
│     - Allow skip-on-failure vs fail-fast modes                          │
│     - Configurable retry counts and timeouts                            │
│     - Per-step recovery settings                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Error Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ERROR FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step Execution                                                         │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐                                                        │
│  │ Try Action  │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│    Success?                                                             │
│         ├── Yes ──▶ Return { success: true, duration }                 │
│         │                                                               │
│         └── No                                                          │
│             │                                                           │
│             ▼                                                           │
│  ┌─────────────────┐                                                    │
│  │ Classify Error  │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ├── ELEMENT_NOT_FOUND ──▶ Element Recovery                   │
│           ├── ACTION_FAILED ──────▶ Action Recovery                    │
│           ├── TIMEOUT ────────────▶ Timeout Recovery                   │
│           ├── FRAMEWORK_ERROR ────▶ Framework Recovery                 │
│           └── UNKNOWN ────────────▶ Generic Recovery                   │
│                                                                         │
│  Recovery Attempt                                                       │
│       │                                                                 │
│       ├── Success ──▶ Return { success: true, recovered: true }        │
│       │                                                                 │
│       └── Failure                                                       │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ Log Diagnostic  │                                                    │
│  │  Information    │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  Return { success: false, error, diagnostics }                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Error Classification

### 2.1 Error Types

```typescript
enum ReplayErrorType {
  // Element-related errors
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_INTERACTABLE = 'ELEMENT_NOT_INTERACTABLE',
  ELEMENT_STALE = 'ELEMENT_STALE',
  
  // Action-related errors
  ACTION_FAILED = 'ACTION_FAILED',
  VALUE_NOT_SET = 'VALUE_NOT_SET',
  CLICK_INTERCEPTED = 'CLICK_INTERCEPTED',
  
  // Context errors
  IFRAME_NOT_FOUND = 'IFRAME_NOT_FOUND',
  CROSS_ORIGIN_BLOCKED = 'CROSS_ORIGIN_BLOCKED',
  SHADOW_ROOT_CLOSED = 'SHADOW_ROOT_CLOSED',
  
  // Timing errors
  TIMEOUT = 'TIMEOUT',
  PAGE_NOT_READY = 'PAGE_NOT_READY',
  ANIMATION_IN_PROGRESS = 'ANIMATION_IN_PROGRESS',
  
  // Framework errors
  FRAMEWORK_ERROR = 'FRAMEWORK_ERROR',
  REACT_STATE_DESYNC = 'REACT_STATE_DESYNC',
  
  // System errors
  EXTENSION_DISCONNECTED = 'EXTENSION_DISCONNECTED',
  UNKNOWN = 'UNKNOWN'
}
```

### 2.2 Error Classification Logic

```typescript
function classifyError(
  error: Error | null,
  context: ErrorContext
): ReplayErrorType {
  // Element not found
  if (!context.elementFound) {
    if (context.iframeChain?.length > 0 && !context.iframeResolved) {
      return ReplayErrorType.IFRAME_NOT_FOUND;
    }
    if (context.shadowHosts?.length > 0 && !context.shadowRootAccessed) {
      return ReplayErrorType.SHADOW_ROOT_CLOSED;
    }
    return ReplayErrorType.ELEMENT_NOT_FOUND;
  }
  
  // Element found but not usable
  if (context.elementFound && !context.elementVisible) {
    return ReplayErrorType.ELEMENT_NOT_VISIBLE;
  }
  
  if (context.elementFound && !context.elementInteractable) {
    return ReplayErrorType.ELEMENT_NOT_INTERACTABLE;
  }
  
  // Timeout
  if (error?.message?.includes('timeout') || context.timedOut) {
    return ReplayErrorType.TIMEOUT;
  }
  
  // Cross-origin
  if (error?.message?.includes('cross-origin') ||
      error?.message?.includes('SecurityError')) {
    return ReplayErrorType.CROSS_ORIGIN_BLOCKED;
  }
  
  // Framework-specific
  if (error?.message?.includes('React') ||
      error?.message?.includes('controlled input')) {
    return ReplayErrorType.REACT_STATE_DESYNC;
  }
  
  // Action failed
  if (context.actionAttempted && !context.actionSucceeded) {
    return ReplayErrorType.ACTION_FAILED;
  }
  
  return ReplayErrorType.UNKNOWN;
}

interface ErrorContext {
  elementFound: boolean;
  elementVisible: boolean;
  elementInteractable: boolean;
  actionAttempted: boolean;
  actionSucceeded: boolean;
  iframeChain?: number[];
  iframeResolved: boolean;
  shadowHosts?: string[];
  shadowRootAccessed: boolean;
  timedOut: boolean;
}
```

### 2.3 Error Severity Levels

| Severity | Description | Recovery Action |
|----------|-------------|-----------------|
| CRITICAL | Unrecoverable, affects entire test | Abort test run |
| HIGH | Step failed, may affect subsequent steps | Log and continue or retry |
| MEDIUM | Partial failure, workaround available | Apply workaround |
| LOW | Minor issue, doesn't affect outcome | Log warning only |

```typescript
function getErrorSeverity(errorType: ReplayErrorType): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (errorType) {
    case ReplayErrorType.EXTENSION_DISCONNECTED:
    case ReplayErrorType.CROSS_ORIGIN_BLOCKED:
      return 'CRITICAL';
    
    case ReplayErrorType.ELEMENT_NOT_FOUND:
    case ReplayErrorType.IFRAME_NOT_FOUND:
    case ReplayErrorType.SHADOW_ROOT_CLOSED:
    case ReplayErrorType.TIMEOUT:
      return 'HIGH';
    
    case ReplayErrorType.ELEMENT_NOT_VISIBLE:
    case ReplayErrorType.ELEMENT_NOT_INTERACTABLE:
    case ReplayErrorType.ACTION_FAILED:
      return 'MEDIUM';
    
    case ReplayErrorType.ANIMATION_IN_PROGRESS:
    case ReplayErrorType.PAGE_NOT_READY:
      return 'LOW';
    
    default:
      return 'HIGH';
  }
}
```

---

## 3. Graceful Degradation

### 3.1 Degradation Strategies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEGRADATION HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Level 0: FULL SUCCESS                                                  │
│  └── Element found via primary strategy, action succeeded               │
│                                                                         │
│  Level 1: FALLBACK SUCCESS                                              │
│  └── Element found via fallback strategy, action succeeded              │
│                                                                         │
│  Level 2: PARTIAL SUCCESS                                               │
│  └── Action partially completed (e.g., value set but event failed)      │
│                                                                         │
│  Level 3: RECOVERED SUCCESS                                             │
│  └── Initial failure, but retry/recovery succeeded                      │
│                                                                         │
│  Level 4: SKIPPED                                                       │
│  └── Step skipped per configuration, test continues                     │
│                                                                         │
│  Level 5: FAILED                                                        │
│  └── All recovery attempts exhausted, step failed                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Degradation Result Type

```typescript
interface DegradationResult {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  success: boolean;
  degraded: boolean;
  skipped: boolean;
  strategyUsed: string;
  recoveryAttempts: number;
  partialActions: string[];
  warnings: string[];
}

function createDegradationResult(
  level: number,
  details: Partial<DegradationResult>
): DegradationResult {
  return {
    level: level as DegradationResult['level'],
    success: level <= 3,
    degraded: level >= 1 && level <= 3,
    skipped: level === 4,
    strategyUsed: details.strategyUsed || 'primary',
    recoveryAttempts: details.recoveryAttempts || 0,
    partialActions: details.partialActions || [],
    warnings: details.warnings || []
  };
}
```

### 3.3 Degradation Decision Logic

```typescript
async function executeWithDegradation(
  element: HTMLElement | null,
  action: ActionType,
  value: string | undefined,
  config: RecoveryConfig
): Promise<DegradationResult> {
  // Level 0: Try primary execution
  if (element) {
    const primaryResult = await tryAction(element, action, value);
    if (primaryResult.success) {
      return createDegradationResult(0, { strategyUsed: 'primary' });
    }
  }
  
  // Level 1: Try fallback strategies
  const fallbackElement = await tryFallbackStrategies(config.bundle);
  if (fallbackElement) {
    const fallbackResult = await tryAction(fallbackElement, action, value);
    if (fallbackResult.success) {
      return createDegradationResult(1, {
        strategyUsed: 'fallback',
        warnings: ['Used fallback element finding strategy']
      });
    }
  }
  
  // Level 2: Try partial execution
  if (element && action === 'input') {
    const partialResult = await tryPartialInput(element, value!);
    if (partialResult.valueSet) {
      return createDegradationResult(2, {
        partialActions: ['value_set'],
        warnings: ['Value set but change event may not have fired']
      });
    }
  }
  
  // Level 3: Retry with delays
  for (let i = 0; i < config.maxRetries; i++) {
    await sleep(config.retryDelay * (i + 1));
    
    const retryElement = await findElementFromBundle(config.bundle);
    if (retryElement) {
      const retryResult = await tryAction(retryElement, action, value);
      if (retryResult.success) {
        return createDegradationResult(3, {
          recoveryAttempts: i + 1,
          warnings: [`Succeeded after ${i + 1} retry attempts`]
        });
      }
    }
  }
  
  // Level 4: Skip if configured
  if (config.skipOnFailure) {
    return createDegradationResult(4, {
      warnings: ['Step skipped due to skipOnFailure configuration']
    });
  }
  
  // Level 5: Failed
  return createDegradationResult(5, {
    recoveryAttempts: config.maxRetries,
    warnings: ['All recovery strategies exhausted']
  });
}
```

---

## 4. Retry Strategies

### 4.1 Retry Configuration

```typescript
interface RetryConfig {
  maxRetries: number;           // Maximum retry attempts (default: 2)
  retryDelay: number;           // Base delay between retries (default: 200ms)
  backoffMultiplier: number;    // Delay multiplier per retry (default: 1.5)
  maxDelay: number;             // Maximum delay cap (default: 2000ms)
  retryOn: ReplayErrorType[];   // Error types to retry (default: all recoverable)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  retryDelay: 200,
  backoffMultiplier: 1.5,
  maxDelay: 2000,
  retryOn: [
    ReplayErrorType.ELEMENT_NOT_FOUND,
    ReplayErrorType.ELEMENT_NOT_VISIBLE,
    ReplayErrorType.TIMEOUT,
    ReplayErrorType.PAGE_NOT_READY,
    ReplayErrorType.ANIMATION_IN_PROGRESS
  ]
};
```

### 4.2 Exponential Backoff

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ result: T | null; attempts: number; lastError: Error | null }> {
  let lastError: Error | null = null;
  let delay = config.retryDelay;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();
      return { result, attempts: attempt + 1, lastError: null };
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        break;
      }
      
      // Don't delay after last attempt
      if (attempt < config.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }
  
  return { result: null, attempts: config.maxRetries + 1, lastError };
}
```

### 4.3 Smart Retry Logic

```typescript
function shouldRetryError(
  errorType: ReplayErrorType,
  attemptNumber: number,
  config: RetryConfig
): boolean {
  // Never retry critical errors
  if (getErrorSeverity(errorType) === 'CRITICAL') {
    return false;
  }
  
  // Check if error type is in retry list
  if (!config.retryOn.includes(errorType)) {
    return false;
  }
  
  // Check attempt limit
  if (attemptNumber >= config.maxRetries) {
    return false;
  }
  
  // Special cases
  switch (errorType) {
    case ReplayErrorType.ELEMENT_NOT_FOUND:
      // Retry with increasing delay - element may be loading
      return true;
    
    case ReplayErrorType.ELEMENT_NOT_VISIBLE:
      // Retry - element may become visible after animation
      return true;
    
    case ReplayErrorType.PAGE_NOT_READY:
      // Retry with longer delay
      return true;
    
    case ReplayErrorType.ACTION_FAILED:
      // Only retry once for action failures
      return attemptNumber < 1;
    
    default:
      return true;
  }
}
```

---

## 5. Element Not Found Recovery

### 5.1 Recovery Strategies

```typescript
async function recoverElementNotFound(
  bundle: LocatorBundle,
  originalError: Error
): Promise<HTMLElement | null> {
  const strategies = [
    // Strategy 1: Wait and retry with same locators
    async () => {
      await sleep(500);
      return findElementFromBundle(bundle, { timeout: 1000 });
    },
    
    // Strategy 2: Try relaxed matching
    async () => {
      return findElementRelaxed(bundle);
    },
    
    // Strategy 3: Search by visible text only
    async () => {
      if (bundle.visibleText) {
        return findByFuzzyText(bundle.visibleText, 0.3); // Lower threshold
      }
      return null;
    },
    
    // Strategy 4: Search in all iframes
    async () => {
      return searchAllIframes(bundle);
    },
    
    // Strategy 5: Search by bounding box with larger threshold
    async () => {
      if (bundle.bounding) {
        return findByBoundingBox(bundle.bounding, 400); // 400px threshold
      }
      return null;
    }
  ];
  
  for (const strategy of strategies) {
    const element = await strategy();
    if (element && isVisible(element)) {
      return element;
    }
  }
  
  return null;
}
```

### 5.2 Relaxed Matching

```typescript
async function findElementRelaxed(bundle: LocatorBundle): Promise<HTMLElement | null> {
  // Try each attribute individually with relaxed matching
  
  // Partial ID match
  if (bundle.id) {
    const partialIdMatch = document.querySelector(
      `[id*="${bundle.id.substring(0, 10)}"]`
    ) as HTMLElement;
    if (partialIdMatch && isVisible(partialIdMatch)) {
      return partialIdMatch;
    }
  }
  
  // Tag + class combination
  if (bundle.tag && bundle.className) {
    const classes = bundle.className.split(' ').slice(0, 2).join('.');
    const tagClassMatch = document.querySelector(
      `${bundle.tag}.${classes}`
    ) as HTMLElement;
    if (tagClassMatch && isVisible(tagClassMatch)) {
      return tagClassMatch;
    }
  }
  
  // Any element with matching aria-label
  if (bundle.aria) {
    const ariaMatch = document.querySelector(
      `[aria-label*="${bundle.aria}"]`
    ) as HTMLElement;
    if (ariaMatch && isVisible(ariaMatch)) {
      return ariaMatch;
    }
  }
  
  // Tag + placeholder
  if (bundle.tag && bundle.placeholder) {
    const placeholderMatch = document.querySelector(
      `${bundle.tag}[placeholder*="${bundle.placeholder.substring(0, 15)}"]`
    ) as HTMLElement;
    if (placeholderMatch && isVisible(placeholderMatch)) {
      return placeholderMatch;
    }
  }
  
  return null;
}
```

### 5.3 Iframe Search

```typescript
async function searchAllIframes(bundle: LocatorBundle): Promise<HTMLElement | null> {
  const iframes = document.querySelectorAll('iframe');
  
  for (const iframe of iframes) {
    try {
      const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
      if (!iframeDoc) continue;
      
      // Try XPath in this iframe
      if (bundle.xpath) {
        const element = evaluateXPath(bundle.xpath, iframeDoc);
        if (element && isVisible(element as HTMLElement)) {
          return element as HTMLElement;
        }
      }
      
      // Try ID in this iframe
      if (bundle.id) {
        const element = iframeDoc.getElementById(bundle.id);
        if (element && isVisible(element as HTMLElement)) {
          return element as HTMLElement;
        }
      }
    } catch (e) {
      // Cross-origin iframe, skip
      continue;
    }
  }
  
  return null;
}
```

---

## 6. Action Failure Recovery

### 6.1 Click Recovery

```typescript
async function recoverClickFailure(
  element: HTMLElement,
  error: Error
): Promise<boolean> {
  // Strategy 1: Scroll element into view
  element.scrollIntoView({ block: 'center', inline: 'center' });
  await sleep(100);
  
  if (await tryClick(element)) return true;
  
  // Strategy 2: Remove overlapping elements
  const overlapping = getOverlappingElements(element);
  for (const overlay of overlapping) {
    const originalVisibility = overlay.style.visibility;
    overlay.style.visibility = 'hidden';
    
    if (await tryClick(element)) {
      overlay.style.visibility = originalVisibility;
      return true;
    }
    
    overlay.style.visibility = originalVisibility;
  }
  
  // Strategy 3: Use JavaScript click
  try {
    (element as HTMLElement).click();
    return true;
  } catch (e) {
    // Fallthrough
  }
  
  // Strategy 4: Focus and Enter key
  element.focus();
  element.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    key: 'Enter',
    keyCode: 13
  }));
  
  return false;
}

function getOverlappingElements(element: HTMLElement): HTMLElement[] {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const elementsAtPoint = document.elementsFromPoint(centerX, centerY);
  
  return elementsAtPoint
    .filter(el => el !== element && el.contains(element) === false)
    .slice(0, 3) as HTMLElement[]; // Limit to top 3 overlapping
}
```

### 6.2 Input Recovery

```typescript
async function recoverInputFailure(
  element: HTMLElement,
  value: string,
  error: Error
): Promise<boolean> {
  const input = element as HTMLInputElement;
  
  // Strategy 1: Clear and retry
  input.value = '';
  await sleep(50);
  
  if (await trySetValue(input, value)) return true;
  
  // Strategy 2: Character-by-character input
  input.focus();
  for (const char of value) {
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: char
    }));
    input.dispatchEvent(new KeyboardEvent('keypress', {
      bubbles: true,
      key: char
    }));
    
    input.value += char;
    
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: char,
      inputType: 'insertText'
    }));
    
    input.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      key: char
    }));
    
    await sleep(10); // Small delay between characters
  }
  
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Verify value was set
  return input.value === value;
}

// Strategy 3: Clipboard paste simulation
async function tryClipboardPaste(
  element: HTMLInputElement,
  value: string
): Promise<boolean> {
  element.focus();
  element.select();
  
  // Create paste event
  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer()
  });
  
  pasteEvent.clipboardData?.setData('text/plain', value);
  
  element.dispatchEvent(pasteEvent);
  
  // Verify
  return element.value === value;
}
```

---

## 7. Timeout Handling

### 7.1 Timeout Types

```typescript
interface TimeoutConfig {
  elementFinding: number;    // Time to find element (default: 2000ms)
  actionExecution: number;   // Time for action to complete (default: 5000ms)
  pageLoad: number;          // Time for page to load (default: 10000ms)
  networkIdle: number;       // Time to wait for network (default: 3000ms)
}

const DEFAULT_TIMEOUTS: TimeoutConfig = {
  elementFinding: 2000,
  actionExecution: 5000,
  pageLoad: 10000,
  networkIdle: 3000
};
```

### 7.2 Timeout Wrapper

```typescript
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<{ result: T | null; timedOut: boolean }> {
  let timeoutId: number;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([operation, timeoutPromise]);
    clearTimeout(timeoutId!);
    return { result, timedOut: false };
  } catch (error) {
    clearTimeout(timeoutId!);
    
    if (error instanceof TimeoutError) {
      return { result: null, timedOut: true };
    }
    
    throw error;
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
```

### 7.3 Adaptive Timeout

```typescript
class AdaptiveTimeout {
  private history: number[] = [];
  private baseTimeout: number;
  
  constructor(baseTimeout: number = 2000) {
    this.baseTimeout = baseTimeout;
  }
  
  recordDuration(duration: number): void {
    this.history.push(duration);
    
    // Keep last 10 measurements
    if (this.history.length > 10) {
      this.history.shift();
    }
  }
  
  getTimeout(): number {
    if (this.history.length < 3) {
      return this.baseTimeout;
    }
    
    // Calculate 95th percentile
    const sorted = [...this.history].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    // Add 50% buffer
    const adaptiveTimeout = p95 * 1.5;
    
    // Clamp between base and 3x base
    return Math.max(this.baseTimeout, Math.min(adaptiveTimeout, this.baseTimeout * 3));
  }
}
```

---

## 8. State Recovery

### 8.1 Page State Validation

```typescript
interface PageState {
  url: string;
  readyState: DocumentReadyState;
  pendingRequests: number;
  hasErrors: boolean;
  scrollPosition: { x: number; y: number };
}

async function capturePageState(): Promise<PageState> {
  return {
    url: window.location.href,
    readyState: document.readyState,
    pendingRequests: getPendingRequestCount(),
    hasErrors: hasPageErrors(),
    scrollPosition: {
      x: window.scrollX,
      y: window.scrollY
    }
  };
}

function getPendingRequestCount(): number {
  // Use Performance API to check pending requests
  const entries = performance.getEntriesByType('resource');
  const pending = entries.filter(entry => {
    const resource = entry as PerformanceResourceTiming;
    return resource.responseEnd === 0;
  });
  return pending.length;
}

function hasPageErrors(): boolean {
  // Check for error indicators
  const errorElements = document.querySelectorAll(
    '.error, .error-message, [role="alert"], .toast-error'
  );
  return errorElements.length > 0;
}
```

### 8.2 State Recovery Actions

```typescript
async function recoverPageState(
  expectedState: Partial<PageState>,
  currentState: PageState
): Promise<boolean> {
  // URL mismatch - navigate back
  if (expectedState.url && currentState.url !== expectedState.url) {
    window.location.href = expectedState.url;
    await waitForPageLoad();
    return true;
  }
  
  // Page not ready - wait
  if (currentState.readyState !== 'complete') {
    await waitForPageLoad();
    return true;
  }
  
  // Pending requests - wait for network
  if (currentState.pendingRequests > 0) {
    await waitForNetworkIdle();
    return true;
  }
  
  // Scroll position drift - restore
  if (expectedState.scrollPosition) {
    const { x, y } = expectedState.scrollPosition;
    if (Math.abs(currentState.scrollPosition.x - x) > 100 ||
        Math.abs(currentState.scrollPosition.y - y) > 100) {
      window.scrollTo(x, y);
      return true;
    }
  }
  
  return false;
}

async function waitForPageLoad(timeout: number = 10000): Promise<void> {
  if (document.readyState === 'complete') return;
  
  return new Promise((resolve) => {
    const handler = () => {
      if (document.readyState === 'complete') {
        window.removeEventListener('load', handler);
        resolve();
      }
    };
    
    window.addEventListener('load', handler);
    
    setTimeout(() => {
      window.removeEventListener('load', handler);
      resolve();
    }, timeout);
  });
}

async function waitForNetworkIdle(timeout: number = 3000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (getPendingRequestCount() === 0) {
      // Wait a bit more to ensure no new requests
      await sleep(100);
      if (getPendingRequestCount() === 0) {
        return;
      }
    }
    await sleep(100);
  }
}
```

---

## 9. Logging and Diagnostics

### 9.1 Diagnostic Information

```typescript
interface DiagnosticInfo {
  // Error details
  errorType: ReplayErrorType;
  errorMessage: string;
  stackTrace?: string;
  
  // Element state
  elementFound: boolean;
  elementXPath?: string;
  elementHTML?: string;
  elementBoundingBox?: DOMRect;
  elementVisibility?: {
    display: string;
    visibility: string;
    opacity: string;
  };
  
  // Page state
  pageUrl: string;
  pageReadyState: string;
  scrollPosition: { x: number; y: number };
  
  // Action details
  actionType: ActionType;
  actionValue?: string;
  
  // Recovery attempts
  recoveryAttempts: RecoveryAttempt[];
  
  // Timing
  timestamp: number;
  duration: number;
  
  // Screenshots (if enabled)
  screenshot?: string; // Base64
}

interface RecoveryAttempt {
  strategy: string;
  success: boolean;
  duration: number;
  error?: string;
}
```

### 9.2 Diagnostic Capture

```typescript
async function captureDiagnostics(
  error: Error,
  context: {
    bundle: LocatorBundle;
    action: ActionType;
    value?: string;
    element?: HTMLElement | null;
    recoveryAttempts: RecoveryAttempt[];
    startTime: number;
  }
): Promise<DiagnosticInfo> {
  const errorType = classifyError(error, {
    elementFound: !!context.element,
    elementVisible: context.element ? isVisible(context.element) : false,
    elementInteractable: context.element ? isInteractable(context.element) : false,
    actionAttempted: true,
    actionSucceeded: false,
    iframeChain: context.bundle.iframeChain,
    iframeResolved: true,
    shadowHosts: context.bundle.shadowHosts,
    shadowRootAccessed: true,
    timedOut: error.message.includes('timeout')
  });
  
  const diagnostics: DiagnosticInfo = {
    errorType,
    errorMessage: error.message,
    stackTrace: error.stack,
    
    elementFound: !!context.element,
    elementXPath: context.bundle.xpath,
    elementHTML: context.element?.outerHTML?.substring(0, 500),
    elementBoundingBox: context.element?.getBoundingClientRect(),
    elementVisibility: context.element ? {
      display: getComputedStyle(context.element).display,
      visibility: getComputedStyle(context.element).visibility,
      opacity: getComputedStyle(context.element).opacity
    } : undefined,
    
    pageUrl: window.location.href,
    pageReadyState: document.readyState,
    scrollPosition: { x: window.scrollX, y: window.scrollY },
    
    actionType: context.action,
    actionValue: context.value,
    
    recoveryAttempts: context.recoveryAttempts,
    
    timestamp: Date.now(),
    duration: Date.now() - context.startTime
  };
  
  return diagnostics;
}
```

### 9.3 Logging Levels

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class ReplayLogger {
  private level: LogLevel = LogLevel.INFO;
  private logs: Array<{ level: LogLevel; message: string; data?: any; timestamp: number }> = [];
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) return;
    
    const entry = {
      level,
      message,
      data,
      timestamp: Date.now()
    };
    
    this.logs.push(entry);
    
    // Console output
    const prefix = `[Replay ${LogLevel[level]}]`;
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, data);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, data);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, data);
        break;
    }
  }
  
  getLogs(): typeof this.logs {
    return [...this.logs];
  }
  
  clear(): void {
    this.logs = [];
  }
}

const replayLogger = new ReplayLogger();
```

---

## 10. Recovery Configuration

### 10.1 Full Configuration Schema

```typescript
interface RecoveryConfig {
  // Retry settings
  retry: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
    retryOn: ReplayErrorType[];
  };
  
  // Timeout settings
  timeouts: {
    elementFinding: number;
    actionExecution: number;
    pageLoad: number;
    networkIdle: number;
  };
  
  // Behavior settings
  behavior: {
    skipOnFailure: boolean;
    screenshotOnFailure: boolean;
    continueOnError: boolean;
    strictMode: boolean; // Fail on any warning
  };
  
  // Recovery strategies
  strategies: {
    enableRelaxedMatching: boolean;
    enableIframeSearch: boolean;
    enableBoundingBoxFallback: boolean;
    enableClickRecovery: boolean;
    enableInputRecovery: boolean;
  };
  
  // Logging
  logging: {
    level: LogLevel;
    captureHTML: boolean;
    captureScreenshots: boolean;
  };
}

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  retry: {
    maxRetries: 2,
    retryDelay: 200,
    backoffMultiplier: 1.5,
    maxDelay: 2000,
    retryOn: [
      ReplayErrorType.ELEMENT_NOT_FOUND,
      ReplayErrorType.ELEMENT_NOT_VISIBLE,
      ReplayErrorType.TIMEOUT
    ]
  },
  timeouts: {
    elementFinding: 2000,
    actionExecution: 5000,
    pageLoad: 10000,
    networkIdle: 3000
  },
  behavior: {
    skipOnFailure: false,
    screenshotOnFailure: false,
    continueOnError: true,
    strictMode: false
  },
  strategies: {
    enableRelaxedMatching: true,
    enableIframeSearch: true,
    enableBoundingBoxFallback: true,
    enableClickRecovery: true,
    enableInputRecovery: true
  },
  logging: {
    level: LogLevel.INFO,
    captureHTML: true,
    captureScreenshots: false
  }
};
```

### 10.2 Per-Step Configuration

```typescript
interface StepRecoveryOverrides {
  stepNumber: number;
  overrides: Partial<RecoveryConfig>;
}

function getStepConfig(
  stepNumber: number,
  baseConfig: RecoveryConfig,
  stepOverrides: StepRecoveryOverrides[]
): RecoveryConfig {
  const override = stepOverrides.find(o => o.stepNumber === stepNumber);
  
  if (!override) {
    return baseConfig;
  }
  
  return deepMerge(baseConfig, override.overrides);
}
```

---

## 11. Future: AI-Powered Healing

### 11.1 Healing Architecture (Phase 2+)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI HEALING FLOW (Future)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step Failure                                                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────┐                                                    │
│  │ Capture Context │                                                    │
│  │ - DOM snapshot  │                                                    │
│  │ - Screenshot    │                                                    │
│  │ - Original step │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │  Claude API     │                                                    │
│  │  - Analyze page │                                                    │
│  │  - Find element │                                                    │
│  │  - Suggest fix  │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ Apply Healing   │                                                    │
│  │ - New selector  │                                                    │
│  │ - Action adjust │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ Validate & Save │                                                    │
│  │ - Test healing  │                                                    │
│  │ - Update step   │                                                    │
│  └─────────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Healing Request Schema

```typescript
interface HealingRequest {
  // Failed step information
  step: {
    action: ActionType;
    originalXPath: string;
    originalBundle: LocatorBundle;
    label: string;
  };
  
  // Context
  context: {
    pageUrl: string;
    domSnapshot: string; // Simplified DOM
    screenshot?: string; // Base64 image
    previousSteps: { label: string; success: boolean }[];
  };
  
  // Error information
  error: {
    type: ReplayErrorType;
    message: string;
    diagnostics: DiagnosticInfo;
  };
}

interface HealingResponse {
  success: boolean;
  
  // New locator if healing succeeded
  newLocator?: {
    xpath: string;
    alternativeSelectors: string[];
    confidence: number;
  };
  
  // Explanation for human review
  explanation: string;
  
  // Suggested action modifications
  actionModifications?: {
    waitBefore?: number;
    scrollIntoView?: boolean;
    useAlternativeAction?: ActionType;
  };
}
```

---

## 12. Best Practices

### 12.1 Error Handling Patterns

```typescript
// ✅ GOOD: Wrap all actions in try-catch with result objects
async function executeStep(step: Step): Promise<StepResult> {
  try {
    const element = await findElement(step.bundle);
    const success = await performAction(element, step.action);
    return { success, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ❌ BAD: Let exceptions propagate
async function executeStepBad(step: Step): Promise<void> {
  const element = await findElement(step.bundle); // May throw!
  await performAction(element, step.action); // May throw!
}
```

### 12.2 Timeout Patterns

```typescript
// ✅ GOOD: Always use bounded timeouts
const element = await withTimeout(
  findElement(bundle),
  2000,
  'Element finding'
);

// ❌ BAD: Unbounded waits
while (!element) {
  element = document.querySelector(selector);
  await sleep(100); // Could loop forever!
}
```

### 12.3 Recovery Patterns

```typescript
// ✅ GOOD: Progressive recovery with logging
async function robustAction(element: HTMLElement): Promise<boolean> {
  // Try primary method
  if (await tryPrimaryAction(element)) {
    return true;
  }
  
  replayLogger.warn('Primary action failed, trying recovery');
  
  // Try recovery
  if (await tryRecoveryAction(element)) {
    replayLogger.info('Recovery succeeded');
    return true;
  }
  
  replayLogger.error('All recovery attempts failed');
  return false;
}

// ❌ BAD: Silent failure without recovery
async function fragileAction(element: HTMLElement): Promise<boolean> {
  try {
    await performAction(element);
    return true;
  } catch {
    return false; // No recovery, no logging
  }
}
```

---

## Summary

The Error Recovery System provides:

✅ Comprehensive error classification with severity levels  
✅ Graceful degradation through 6-level hierarchy  
✅ Configurable retry strategies with exponential backoff  
✅ Element recovery with relaxed matching and iframe search  
✅ Action recovery for click and input failures  
✅ Timeout management with adaptive timing  
✅ Page state recovery for navigation and scroll issues  
✅ Rich diagnostics for debugging and analysis  
✅ Flexible configuration at global and per-step levels  
✅ Future-ready for AI-powered healing integration

This system maximizes test success rate while providing actionable information for debugging persistent failures.
