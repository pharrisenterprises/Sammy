# Job Execution
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Browser Launching
3. CSV Row Iteration
4. Variable Injection
5. Step Execution
6. Multi-Tab Handling
7. Error Handling
8. Logging Strategy
9. Screenshot Capture
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Job Execution manages the complete lifecycle of running a single test job: launching the browser, iterating through CSV rows, executing recorded steps with variable injection, and handling errors.

### 1.2 Execution Flow
```
1. Claim job from queue
   ↓
2. Fetch recording from Supabase
   ↓
3. Launch Playwright browser
   ↓
4. FOR EACH CSV row:
   ↓
   5. Navigate to starting URL
   ↓
   6. FOR EACH step:
      ↓
      a. Inject CSV variables
      b. Find element
      c. Execute action
      d. Log result
   ↓
7. Aggregate results
   ↓
8. Update job status
   ↓
9. Close browser
```

### 1.3 Key Responsibilities

- Launch and configure Playwright browser
- Iterate through CSV data rows sequentially
- Inject CSV values into step variables
- Execute steps using Playwright actions
- Handle multi-tab navigation
- Capture screenshots on errors
- Write real-time logs to Supabase
- Aggregate execution metrics
- Clean up browser resources

---

## 2. Browser Launching

### 2.1 Playwright Configuration
```typescript
// src/executor.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export class JobExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launchBrowser(config: BrowserConfig): Promise<Browser> {
    console.log('🚀 Launching browser...');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });

    // Create browser context with configuration
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: config.ignoreHTTPSErrors || false,
      acceptDownloads: config.acceptDownloads || false
    });

    console.log('✅ Browser launched');
    return this.browser;
  }

  async closeBrowser(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    console.log('🔒 Browser closed');
  }
}
```

### 2.2 Browser Configuration Options
```typescript
interface BrowserConfig {
  headless?: boolean;              // Default: true
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  ignoreHTTPSErrors?: boolean;     // Default: false
  acceptDownloads?: boolean;       // Default: false
  recordVideo?: boolean;           // Phase 2
  slowMo?: number;                 // Debug mode
}
```

---

## 3. CSV Row Iteration

### 3.1 Row Processing Logic
```typescript
async executeJob(job: ExecutionJob): Promise<void> {
  try {
    // Fetch recording
    const { data: recording } = await this.supabase
      .from('recordings')
      .select('steps, starting_url')
      .eq('id', job.recording_id)
      .single();

    if (!recording) {
      throw new Error('Recording not found');
    }

    const steps = recording.steps as RecordedStep[];
    const csvData = job.csv_data || [{}]; // Single empty row if no CSV

    // Launch browser once
    await this.launchBrowser(job.config);

    // Track metrics
    let totalPassed = 0;
    let totalFailed = 0;
    const startTime = Date.now();

    // Iterate CSV rows
    for (let rowIndex = 0; rowIndex < csvData.length; rowIndex++) {
      const row = csvData[rowIndex];
      const rowNumber = rowIndex + 1;

      await this.logExecution(job.id, 'info', `Processing row ${rowNumber}/${csvData.length}`);

      try {
        // Create new page for this row
        const page = await this.context!.newPage();

        // Navigate to starting URL
        await page.goto(recording.starting_url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        await this.logExecution(job.id, 'success', `Navigated to ${recording.starting_url}`);

        // Execute steps for this row
        const { passed, failed } = await this.executeSteps(
          page,
          steps,
          row,
          job.id,
          rowNumber
        );

        totalPassed += passed;
        totalFailed += failed;

        // Close page
        await page.close();

        await this.logExecution(
          job.id,
          'info',
          `Row ${rowNumber} complete: ${passed} passed, ${failed} failed`
        );

      } catch (error) {
        await this.logExecution(
          job.id,
          'error',
          `Row ${rowNumber} failed: ${error.message}`
        );
        totalFailed += steps.length;
      }
    }

    // Update job with results
    await this.updateJobResults(job.id, {
      status: totalFailed === 0 ? 'completed' : 'failed',
      total_steps: steps.length * csvData.length,
      passed_steps: totalPassed,
      failed_steps: totalFailed,
      duration: Date.now() - startTime
    });

  } finally {
    await this.closeBrowser();
  }
}
```

### 3.2 Row Validation
```typescript
function validateRow(row: any, steps: RecordedStep[]): boolean {
  // Check if row has any values for mapped variables
  const stepLabels = steps.map(s => s.label);
  const rowKeys = Object.keys(row);

  // Row is valid if at least one key matches a step label
  return rowKeys.some(key => stepLabels.includes(key));
}
```

---

## 4. Variable Injection

### 4.1 Variable Replacement
```typescript
function injectVariables(step: RecordedStep, csvRow: any): RecordedStep {
  const injectedStep = { ...step };

  if (injectedStep.value && typeof injectedStep.value === 'string') {
    // Replace {{variableName}} with CSV value
    injectedStep.value = injectedStep.value.replace(
      /\{\{(\w+)\}\}/g,
      (match, varName) => {
        const value = csvRow[varName];
        return value !== undefined ? String(value) : match;
      }
    );
  }

  // Also check if step label directly matches CSV column
  if (csvRow[injectedStep.label] !== undefined) {
    injectedStep.value = String(csvRow[injectedStep.label]);
  }

  return injectedStep;
}
```

### 4.2 Variable Injection Examples
```typescript
// Example 1: Direct variable replacement
const step = {
  event: 'input',
  label: 'First Name',
  value: '{{firstName}}'
};

const row = {
  firstName: 'John',
  lastName: 'Doe'
};

const injected = injectVariables(step, row);
// Result: { value: 'John' }

// Example 2: Multiple variables
const step2 = {
  event: 'input',
  label: 'Full Name',
  value: '{{firstName}} {{lastName}}'
};

const injected2 = injectVariables(step2, row);
// Result: { value: 'John Doe' }

// Example 3: Direct label match
const step3 = {
  event: 'input',
  label: 'Email',
  value: ''  // Empty - will use CSV column "Email"
};

const row2 = {
  Email: 'john@example.com'
};

const injected3 = injectVariables(step3, row2);
// Result: { value: 'john@example.com' }
```

---

## 5. Step Execution

### 5.1 Step Executor
```typescript
// src/step-executor.ts
import { Page } from 'playwright';

export class StepExecutor {
  async executeStep(
    page: Page,
    step: RecordedStep,
    jobId: string
  ): Promise<ExecutionResult> {
    try {
      await this.logExecution(jobId, 'info', `Executing: ${step.label}`);

      switch (step.event) {
        case 'click':
          await this.executeClick(page, step);
          break;

        case 'input':
          await this.executeInput(page, step);
          break;

        case 'select':
          await this.executeSelect(page, step);
          break;

        case 'navigate':
          await this.executeNavigate(page, step);
          break;

        case 'keypress':
          await this.executeKeypress(page, step);
          break;

        default:
          throw new Error(`Unknown event type: ${step.event}`);
      }

      await this.logExecution(jobId, 'success', `✅ ${step.label} - SUCCESS`);
      return { success: true };

    } catch (error) {
      await this.logExecution(jobId, 'error', `❌ ${step.label} - ERROR: ${error.message}`);
      
      // Capture screenshot on error
      await this.captureScreenshot(page, jobId, step.stepNumber);

      return { success: false, error: error.message };
    }
  }

  private async executeClick(page: Page, step: RecordedStep): Promise<void> {
    // Find element using locator bundle
    const element = await this.findElement(page, step.bundle);

    // Wait for element to be visible
    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Click element
    await element.click({ timeout: 5000 });

    // Wait for navigation if expected
    if (step.navigation?.type === 'navigate') {
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    }
  }

  private async executeInput(page: Page, step: RecordedStep): Promise<void> {
    const element = await this.findElement(page, step.bundle);

    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Clear existing value
    await element.clear();

    // Type new value
    await element.fill(step.value || '', { timeout: 5000 });

    // Brief wait for any onChange handlers
    await page.waitForTimeout(500);
  }

  private async executeSelect(page: Page, step: RecordedStep): Promise<void> {
    const element = await this.findElement(page, step.bundle);

    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Select by value or label
    await element.selectOption(step.value || '', { timeout: 5000 });
  }

  private async executeNavigate(page: Page, step: RecordedStep): Promise<void> {
    await page.goto(step.url!, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  }

  private async executeKeypress(page: Page, step: RecordedStep): Promise<void> {
    await page.keyboard.press(step.key || 'Enter');
  }
}
```

### 5.2 Element Finding Strategy
```typescript
private async findElement(page: Page, bundle: LocatorBundle): Promise<Locator> {
  // Strategy 1: XPath
  if (bundle.xpath) {
    try {
      const xpath = page.locator(`xpath=${bundle.xpath}`);
      if (await xpath.count() > 0) {
        return xpath;
      }
    } catch (error) {
      // XPath failed, continue to next strategy
    }
  }

  // Strategy 2: ID
  if (bundle.id) {
    const byId = page.locator(`#${bundle.id}`);
    if (await byId.count() > 0) {
      return byId;
    }
  }

  // Strategy 3: Name
  if (bundle.name) {
    const byName = page.locator(`[name="${bundle.name}"]`);
    if (await byName.count() > 0) {
      return byName;
    }
  }

  // Strategy 4: ARIA label
  if (bundle.aria) {
    const byAria = page.getByLabel(bundle.aria);
    if (await byAria.count() > 0) {
      return byAria;
    }
  }

  // Strategy 5: Placeholder
  if (bundle.placeholder) {
    const byPlaceholder = page.getByPlaceholder(bundle.placeholder);
    if (await byPlaceholder.count() > 0) {
      return byPlaceholder;
    }
  }

  // Strategy 6: Fuzzy text match
  if (bundle.visibleText) {
    const byText = page.getByText(bundle.visibleText, { exact: false });
    if (await byText.count() > 0) {
      return byText;
    }
  }

  throw new Error(`Element not found using any strategy`);
}
```

---

## 6. Multi-Tab Handling

### 6.1 Tab Management
```typescript
export class MultiTabExecutor extends JobExecutor {
  private tabMap: Map<string, Page> = new Map();

  async executeSteps(
    page: Page,
    steps: RecordedStep[],
    csvRow: any,
    jobId: string,
    rowNumber: number
  ): Promise<{ passed: number; failed: number }> {
    let passed = 0;
    let failed = 0;

    // Initialize main tab
    this.tabMap.set('main', page);

    for (const step of steps) {
      const injectedStep = injectVariables(step, csvRow);

      // Handle new tab creation
      if (injectedStep.navigation?.type === 'new_tab') {
        const newPage = await this.context!.newPage();
        this.tabMap.set(injectedStep.tabId || `tab-${this.tabMap.size}`, newPage);
        
        await this.logExecution(jobId, 'info', `Opened new tab: ${injectedStep.tabId}`);
      }

      // Switch to correct tab
      const targetPage = this.tabMap.get(injectedStep.tabId || 'main') || page;

      // Execute step
      const result = await this.stepExecutor.executeStep(targetPage, injectedStep, jobId);

      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    }

    // Close all tabs except main
    for (const [tabId, tabPage] of this.tabMap.entries()) {
      if (tabId !== 'main' && tabPage !== page) {
        await tabPage.close();
      }
    }

    this.tabMap.clear();

    return { passed, failed };
  }
}
```

---

## 7. Error Handling

### 7.1 Error Types and Recovery
```typescript
enum ExecutionError {
  ELEMENT_NOT_FOUND = 'Element not found',
  TIMEOUT = 'Timeout exceeded',
  NAVIGATION_FAILED = 'Navigation failed',
  NETWORK_ERROR = 'Network error',
  JAVASCRIPT_ERROR = 'JavaScript execution error'
}

async executeStepWithRetry(
  page: Page,
  step: RecordedStep,
  jobId: string,
  maxRetries: number = 2
): Promise<ExecutionResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await this.executeStep(page, step, jobId);
      
      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (attempt < maxRetries) {
        await this.logExecution(
          jobId,
          'warning',
          `Retry ${attempt}/${maxRetries - 1} for step: ${step.label}`
        );
        await page.waitForTimeout(1000 * attempt); // Exponential backoff
      }

    } catch (error) {
      lastError = error.message;
    }
  }

  return { success: false, error: lastError };
}
```

### 7.2 Failure Policies
```typescript
enum FailurePolicy {
  CONTINUE = 'continue',      // Continue to next step
  SKIP_ROW = 'skip_row',      // Skip to next CSV row
  ABORT = 'abort'             // Abort entire job
}

async handleStepFailure(
  step: RecordedStep,
  error: string,
  policy: FailurePolicy
): Promise<{ shouldContinue: boolean; shouldSkipRow: boolean }> {
  switch (policy) {
    case FailurePolicy.CONTINUE:
      return { shouldContinue: true, shouldSkipRow: false };

    case FailurePolicy.SKIP_ROW:
      return { shouldContinue: false, shouldSkipRow: true };

    case FailurePolicy.ABORT:
      throw new Error(`Execution aborted at step: ${step.label}`);
  }
}
```

---

## 8. Logging Strategy

### 8.1 Real-Time Log Writing
```typescript
private async logExecution(
  jobId: string,
  level: 'info' | 'success' | 'error' | 'warning',
  message: string
): Promise<void> {
  const logEntry = {
    job_id: jobId,
    level,
    message,
    timestamp: new Date().toISOString()
  };

  await this.supabase
    .from('execution_logs')
    .insert(logEntry);

  console.log(`[${level.toUpperCase()}] ${message}`);
}
```

### 8.2 Structured Logging
```typescript
interface StructuredLog {
  job_id: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  step_number?: number;
  step_label?: string;
  row_number?: number;
  duration?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

async logStructured(log: Omit<StructuredLog, 'timestamp'>): Promise<void> {
  await this.supabase
    .from('execution_logs')
    .insert({
      ...log,
      timestamp: new Date().toISOString()
    });
}
```

---

## 9. Screenshot Capture

### 9.1 Error Screenshots
```typescript
private async captureScreenshot(
  page: Page,
  jobId: string,
  stepNumber: number
): Promise<string | null> {
  try {
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    const fileName = `${jobId}_step-${stepNumber}_${Date.now()}.png`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from('screenshots')
      .upload(fileName, screenshot, {
        contentType: 'image/png'
      });

    if (error) {
      throw error;
    }

    await this.logExecution(
      jobId,
      'info',
      `Screenshot captured: ${fileName}`
    );

    return fileName;

  } catch (error) {
    console.error('Screenshot capture failed:', error);
    return null;
  }
}
```

### 9.2 Video Recording (Phase 2)
```typescript
async startVideoRecording(context: BrowserContext): Promise<void> {
  await context.tracing.start({
    screenshots: true,
    snapshots: true
  });
}

async stopVideoRecording(
  context: BrowserContext,
  jobId: string
): Promise<string> {
  const tracePath = `./traces/${jobId}.zip`;
  await context.tracing.stop({ path: tracePath });
  
  // Upload to Supabase
  // ...
  
  return tracePath;
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('StepExecutor', () => {
  it('executes click action', async () => {
    const page = await browser.newPage();
    await page.setContent('<button id="test">Click me</button>');

    const step: RecordedStep = {
      event: 'click',
      label: 'Test button',
      bundle: { id: 'test' }
    };

    const result = await executor.executeStep(page, step, 'job-123');

    expect(result.success).toBe(true);
  });

  it('injects CSV variables correctly', () => {
    const step = {
      value: '{{firstName}} {{lastName}}',
      label: 'Name'
    };

    const row = {
      firstName: 'John',
      lastName: 'Doe'
    };

    const injected = injectVariables(step, row);

    expect(injected.value).toBe('John Doe');
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Job Execution', () => {
  it('executes job with CSV data', async () => {
    const job = {
      id: 'test-job',
      recording_id: 'test-recording',
      csv_data: [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ]
    };

    await executor.executeJob(job);

    const logs = await supabase
      .from('execution_logs')
      .select('*')
      .eq('job_id', 'test-job');

    expect(logs.data).toHaveLength(greaterThan(0));
  });
});
```

---

## Summary

Job Execution provides:
- ✅ **Browser launching** with Playwright configuration
- ✅ **CSV row iteration** with validation
- ✅ **Variable injection** ({{variable}} replacement + direct label match)
- ✅ **Step execution** with 6 action types (click, input, select, navigate, keypress)
- ✅ **Multi-strategy element finding** (XPath, ID, name, ARIA, placeholder, text)
- ✅ **Multi-tab handling** with tab map management
- ✅ **Error handling** with retry logic and failure policies
- ✅ **Real-time logging** to Supabase
- ✅ **Screenshot capture** on errors
- ✅ **Testing strategy** with unit and integration tests

This provides complete job execution with robust error handling and observability.
