# Playwright Executor Overview
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Core Components
4. Action Types
5. Locator Strategies
6. Context Management
7. Event Sequences
8. Error Handling
9. Performance Optimization
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Playwright Executor is the core automation engine that translates recorded steps into actual browser interactions using Playwright's API. It handles element location, action execution, multi-tab navigation, and error recovery.

### 1.2 Key Responsibilities

- **Browser Control**: Launch, configure, and manage Playwright browser instances
- **Element Location**: Find elements using multi-strategy fallback (9 strategies)
- **Action Execution**: Execute clicks, inputs, navigation, keyboard events
- **Context Management**: Handle multiple tabs, iframes, shadow DOM
- **Event Simulation**: Dispatch human-like event sequences
- **Error Recovery**: Graceful fallback when elements not found
- **Screenshot Capture**: Capture screenshots for debugging and AI healing

### 1.3 Design Principles
```
1. RESILIENCE
   - Multiple fallback strategies for element finding
   - Graceful degradation on failures
   - Retry logic with exponential backoff

2. ACCURACY
   - Human-like event sequences
   - Framework-aware input handling (React, Vue, Angular)
   - Proper timing and waits

3. OBSERVABILITY
   - Detailed logging for each action
   - Screenshots on errors
   - Performance metrics

4. MAINTAINABILITY
   - Clean separation of concerns
   - Reusable action primitives
   - Comprehensive test coverage
```

---

## 2. Architecture

### 2.1 System Context
```
┌─────────────────────────────────────────────────────────────┐
│                    JOB EXECUTOR                             │
│                                                             │
│  executeJob(job) {                                          │
│    for each CSV row:                                        │
│      page = browser.newPage()                               │
│      playwrightExecutor.executeSteps(page, steps, row)     │
│  }                                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              PLAYWRIGHT EXECUTOR                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ELEMENT LOCATOR                                     │  │
│  │                                                     │  │
│  │  • 9-strategy fallback                             │  │
│  │  • XPath → ID → Name → ARIA → Placeholder          │  │
│  │  • Fuzzy text → Bounding box → Retry               │  │
│  └─────────────────────────────────────────────────────┘  │
│                       ↓                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ACTION EXECUTOR                                     │  │
│  │                                                     │  │
│  │  • Click handler                                   │  │
│  │  • Input handler                                   │  │
│  │  • Select handler                                  │  │
│  │  • Navigation handler                              │  │
│  │  • Keyboard handler                                │  │
│  └─────────────────────────────────────────────────────┘  │
│                       ↓                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ CONTEXT MANAGER                                     │  │
│  │                                                     │  │
│  │  • Tab management                                  │  │
│  │  • Iframe navigation                               │  │
│  │  • Shadow DOM traversal                            │  │
│  └─────────────────────────────────────────────────────┘  │
│                       ↓                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ SCREENSHOT CAPTURER                                 │  │
│  │                                                     │  │
│  │  • Error screenshots                               │  │
│  │  • Full-page captures                              │  │
│  │  • Element highlights                              │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                   PLAYWRIGHT API                            │
│                                                             │
│  • page.locator()                                           │
│  • page.click()                                             │
│  • page.fill()                                              │
│  • page.goto()                                              │
│  • page.screenshot()                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram
```
PlaywrightExecutor
├── ElementLocator
│   ├── XPathLocator
│   ├── IDLocator
│   ├── NameLocator
│   ├── ARIALocator
│   ├── PlaceholderLocator
│   ├── DataAttrLocator
│   ├── FuzzyTextLocator
│   ├── BoundingBoxLocator
│   └── RetryLocator
├── ActionExecutor
│   ├── ClickAction
│   ├── InputAction
│   ├── SelectAction
│   ├── NavigateAction
│   └── KeypressAction
├── ContextManager
│   ├── TabManager
│   ├── IframeManager
│   └── ShadowDOMManager
└── ScreenshotCapturer
    ├── ErrorCapture
    ├── FullPageCapture
    └── ElementCapture
```

---

## 3. Core Components

### 3.1 PlaywrightExecutor Class
```typescript
// src/playwright-executor.ts
import { Page, Locator, BrowserContext } from 'playwright';

export class PlaywrightExecutor {
  private elementLocator: ElementLocator;
  private actionExecutor: ActionExecutor;
  private contextManager: ContextManager;
  private screenshotCapturer: ScreenshotCapturer;

  constructor() {
    this.elementLocator = new ElementLocator();
    this.actionExecutor = new ActionExecutor();
    this.contextManager = new ContextManager();
    this.screenshotCapturer = new ScreenshotCapturer();
  }

  async executeSteps(
    page: Page,
    steps: RecordedStep[],
    csvRow: any,
    jobId: string
  ): Promise<{ passed: number; failed: number }> {
    let passed = 0;
    let failed = 0;

    for (const step of steps) {
      try {
        // Inject CSV variables
        const injectedStep = this.injectVariables(step, csvRow);

        // Execute step
        const result = await this.executeStep(page, injectedStep, jobId);

        if (result.success) {
          passed++;
        } else {
          failed++;
        }

      } catch (error) {
        console.error(`Step ${step.stepNumber} failed:`, error);
        failed++;
      }
    }

    return { passed, failed };
  }

  async executeStep(
    page: Page,
    step: RecordedStep,
    jobId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find element
      const element = await this.elementLocator.locate(page, step.bundle);

      if (!element) {
        throw new Error('Element not found');
      }

      // Execute action
      await this.actionExecutor.execute(page, element, step);

      return { success: true };

    } catch (error) {
      // Capture screenshot
      await this.screenshotCapturer.captureError(page, step, jobId);

      return { success: false, error: error.message };
    }
  }

  private injectVariables(step: RecordedStep, csvRow: any): RecordedStep {
    const injected = { ...step };

    if (injected.value && typeof injected.value === 'string') {
      injected.value = injected.value.replace(
        /\{\{(\w+)\}\}/g,
        (match, varName) => csvRow[varName] || match
      );
    }

    return injected;
  }
}
```

---

## 4. Action Types

### 4.1 Supported Actions
```typescript
type ActionType = 
  | 'click'       // Mouse click
  | 'input'       // Text input
  | 'select'      // Dropdown selection
  | 'navigate'    // Page navigation
  | 'keypress'    // Keyboard event
  | 'hover'       // Mouse hover (Phase 2)
  | 'drag'        // Drag and drop (Phase 2)
  | 'upload';     // File upload (Phase 2)
```

### 4.2 Action Interface
```typescript
interface ActionHandler {
  canHandle(step: RecordedStep): boolean;
  execute(page: Page, element: Locator, step: RecordedStep): Promise<void>;
}
```

### 4.3 Action Registry
```typescript
export class ActionExecutor {
  private handlers: Map<string, ActionHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.set('click', new ClickAction());
    this.handlers.set('input', new InputAction());
    this.handlers.set('select', new SelectAction());
    this.handlers.set('navigate', new NavigateAction());
    this.handlers.set('keypress', new KeypressAction());
  }

  async execute(
    page: Page,
    element: Locator,
    step: RecordedStep
  ): Promise<void> {
    const handler = this.handlers.get(step.event);

    if (!handler) {
      throw new Error(`Unknown action type: ${step.event}`);
    }

    await handler.execute(page, element, step);
  }
}
```

---

## 5. Locator Strategies

### 5.1 Strategy Priority
```
Priority 1: XPath (Most precise, recorded during capture)
Priority 2: ID (Fast, unique)
Priority 3: Name (Common for form inputs)
Priority 4: ARIA (Accessibility labels)
Priority 5: Placeholder (Input hints)
Priority 6: Data Attributes (data-testid, data-cy)
Priority 7: Fuzzy Text (Partial text match)
Priority 8: Bounding Box (Position-based fallback)
Priority 9: Retry Loop (Wait and retry)
```

### 5.2 Strategy Implementation
```typescript
export class ElementLocator {
  private strategies: LocatorStrategy[] = [];

  constructor() {
    this.strategies = [
      new XPathLocator(),
      new IDLocator(),
      new NameLocator(),
      new ARIALocator(),
      new PlaceholderLocator(),
      new DataAttrLocator(),
      new FuzzyTextLocator(),
      new BoundingBoxLocator(),
      new RetryLocator()
    ];
  }

  async locate(page: Page, bundle: LocatorBundle): Promise<Locator | null> {
    for (const strategy of this.strategies) {
      try {
        const locator = await strategy.locate(page, bundle);

        if (locator && await locator.count() > 0) {
          console.log(`✅ Element found using: ${strategy.name}`);
          return locator;
        }

      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error.message);
      }
    }

    console.error('❌ All locator strategies failed');
    return null;
  }
}
```

### 5.3 LocatorBundle Interface
```typescript
interface LocatorBundle {
  xpath?: string;
  id?: string;
  name?: string;
  aria?: string;
  placeholder?: string;
  dataAttrs?: Record<string, string>;
  tag?: string;
  visibleText?: string;
  bounding?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  iframeChain?: string[];
  shadowHosts?: string[];
}
```

---

## 6. Context Management

### 6.1 Context Types
```typescript
type ExecutionContext = 
  | 'main'        // Main page
  | 'iframe'      // Within iframe
  | 'shadow'      // Within shadow DOM
  | 'tab';        // Different browser tab
```

### 6.2 Context Manager
```typescript
export class ContextManager {
  async navigateToContext(
    page: Page,
    bundle: LocatorBundle
  ): Promise<Page | FrameLocator> {
    // Navigate through iframe chain
    if (bundle.iframeChain && bundle.iframeChain.length > 0) {
      let frame = page.mainFrame();

      for (const iframeSelector of bundle.iframeChain) {
        frame = frame.frameLocator(iframeSelector);
      }

      return frame;
    }

    // Shadow DOM handled by Playwright automatically
    // Playwright can pierce shadow roots

    return page;
  }
}
```

---

## 7. Event Sequences

### 7.1 Human-Like Click Sequence
```typescript
async humanClick(element: Locator): Promise<void> {
  // Simulate realistic user interaction
  await element.hover();               // Mouse move to element
  await element.dispatchEvent('mouseover');
  await element.dispatchEvent('mousedown');
  await new Promise(r => setTimeout(r, 50));  // Brief pause
  await element.dispatchEvent('mouseup');
  await element.click();               // Actual click
}
```

### 7.2 React-Safe Input Sequence
```typescript
async reactSafeInput(element: Locator, value: string): Promise<void> {
  // Clear existing value
  await element.clear();

  // Focus element
  await element.focus();

  // Type value (triggers React onChange)
  await element.fill(value);

  // Brief wait for React state update
  await new Promise(r => setTimeout(r, 100));

  // Blur to trigger onBlur handlers
  await element.blur();
}
```

---

## 8. Error Handling

### 8.1 Error Types
```typescript
enum ExecutionError {
  ELEMENT_NOT_FOUND = 'Element not found',
  TIMEOUT = 'Action timeout',
  DETACHED = 'Element detached from DOM',
  NOT_VISIBLE = 'Element not visible',
  NOT_ENABLED = 'Element not enabled',
  SCRIPT_ERROR = 'JavaScript error'
}
```

### 8.2 Error Recovery Strategy
```typescript
async executeWithRetry(
  action: () => Promise<void>,
  maxRetries: number = 2
): Promise<void> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      return; // Success

    } catch (error) {
      lastError = error;

      if (this.isRetryable(error) && attempt < maxRetries) {
        console.warn(`Retry ${attempt}/${maxRetries}:`, error.message);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError!;
}

private isRetryable(error: Error): boolean {
  const retryableErrors = [
    'Element is not attached',
    'Timeout',
    'waiting for element to be visible'
  ];

  return retryableErrors.some(msg => error.message.includes(msg));
}
```

---

## 9. Performance Optimization

### 9.1 Wait Optimization
```typescript
// Default timeout configuration
const TIMEOUTS = {
  navigation: 30000,    // 30 seconds
  element: 10000,       // 10 seconds
  action: 5000,         // 5 seconds
  script: 30000         // 30 seconds
};

// Configure page with optimized timeouts
page.setDefaultTimeout(TIMEOUTS.element);
page.setDefaultNavigationTimeout(TIMEOUTS.navigation);
```

### 9.2 Parallel Execution (Phase 2)
```typescript
async executeStepsInParallel(
  page: Page,
  steps: RecordedStep[]
): Promise<void> {
  // Identify independent steps (no dependencies)
  const independentSteps = this.identifyIndependentSteps(steps);

  // Execute in parallel
  await Promise.all(
    independentSteps.map(step => this.executeStep(page, step, 'job-id'))
  );
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('PlaywrightExecutor', () => {
  it('locates element by XPath', async () => {
    const page = await browser.newPage();
    await page.setContent('<button id="test">Click</button>');

    const bundle: LocatorBundle = {
      xpath: '//button[@id="test"]'
    };

    const locator = await executor.elementLocator.locate(page, bundle);

    expect(locator).toBeDefined();
    expect(await locator!.count()).toBe(1);
  });

  it('falls back to ID when XPath fails', async () => {
    const page = await browser.newPage();
    await page.setContent('<button id="test">Click</button>');

    const bundle: LocatorBundle = {
      xpath: '//invalid/xpath',
      id: 'test'
    };

    const locator = await executor.elementLocator.locate(page, bundle);

    expect(locator).toBeDefined();
    expect(await locator!.textContent()).toBe('Click');
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Action Execution', () => {
  it('executes click action', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="test" onclick="this.textContent='Clicked'">
        Click me
      </button>
    `);

    const step: RecordedStep = {
      event: 'click',
      bundle: { id: 'test' }
    };

    await executor.executeStep(page, step, 'job-123');

    const text = await page.locator('#test').textContent();
    expect(text).toBe('Clicked');
  });
});
```

---

## Summary

The Playwright Executor provides:
- ✅ **Multi-strategy element location** with 9 fallback strategies
- ✅ **Action execution** for 5+ action types
- ✅ **Context management** (tabs, iframes, shadow DOM)
- ✅ **Human-like event sequences** for realistic simulation
- ✅ **React-safe input handling** with proper event dispatch
- ✅ **Error recovery** with retry logic
- ✅ **Screenshot capture** on errors
- ✅ **Performance optimization** with configurable timeouts
- ✅ **Testing infrastructure** with unit and integration tests

This provides complete browser automation with Playwright.
