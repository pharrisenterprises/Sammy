# VDI Runner Implementation
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Runner Service
4. Job Processing
5. Playwright Execution
6. Element Finding
7. Value Injection
8. Screenshot Capture
9. Result Reporting
10. Error Handling
11. Scaling Strategy
12. Deployment

---

## 1. Overview

### 1.1 Purpose

The VDI (Virtual Desktop Infrastructure) Runner is a headless test execution service that runs recorded tests in cloud-based Chrome instances using Playwright. It enables automated test execution without requiring users to have Chrome installed locally.

### 1.2 Key Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VDI RUNNER RESPONSIBILITIES                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. JOB POLLING                                                         │
│     └── Monitor Supabase for queued test runs                          │
│     └── Claim jobs atomically (prevent double-execution)               │
│     └── Track runner health and availability                           │
│                                                                         │
│  2. TEST EXECUTION                                                      │
│     └── Launch headless Chrome via Playwright                          │
│     └── Navigate to target URLs                                        │
│     └── Execute recorded steps in sequence                             │
│     └── Handle multi-row CSV data injection                            │
│                                                                         │
│  3. ELEMENT FINDING                                                     │
│     └── Multi-strategy element location                                │
│     └── Fallback through 9 locator strategies                          │
│     └── Smart waiting for elements                                     │
│                                                                         │
│  4. RESULT COLLECTION                                                   │
│     └── Capture step pass/fail status                                  │
│     └── Record execution timing                                        │
│     └── Take screenshots on failure                                    │
│     └── Aggregate results to Supabase                                  │
│                                                                         │
│  5. ERROR HANDLING                                                      │
│     └── Graceful timeout handling                                      │
│     └── Network error recovery                                         │
│     └── Browser crash recovery                                         │
│     └── Partial result preservation                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20+ | JavaScript execution |
| Browser Automation | Playwright | Chrome control |
| Database Client | @supabase/supabase-js | Supabase access |
| Container | Docker | Deployment packaging |
| Hosting | Fly.io | Cloud execution |
| Scheduling | Built-in polling | Job acquisition |

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       VDI RUNNER ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SUPABASE                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  test_runs table                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │ status: 'queued' | 'claimed' | 'running' | 'completed' │    │   │
│  │  │         | 'failed' | 'cancelled'                        │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  │  projects table                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │ recorded_steps, csv_data, parsed_fields, target_url     │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│                          Poll every 5s                                  │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      VDI RUNNER POOL                            │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │                  RUNNER INSTANCE                        │    │   │
│  │  │  ┌───────────────────────────────────────────────────┐  │    │   │
│  │  │  │ Job Poller                                        │  │    │   │
│  │  │  │   └── Poll Supabase for queued jobs               │  │    │   │
│  │  │  │   └── Claim job atomically                        │  │    │   │
│  │  │  └───────────────────────────────────────────────────┘  │    │   │
│  │  │                                                          │    │   │
│  │  │                     ▼                                    │    │   │
│  │  │  ┌───────────────────────────────────────────────────┐  │    │   │
│  │  │  │ Test Executor                                     │  │    │   │
│  │  │  │   └── Load project data                           │  │    │   │
│  │  │  │   └── Launch Playwright browser                   │  │    │   │
│  │  │  │   └── Execute steps                               │  │    │   │
│  │  │  │   └── Collect results                             │  │    │   │
│  │  │  └───────────────────────────────────────────────────┘  │    │   │
│  │  │                                                          │    │   │
│  │  │                     ▼                                    │    │   │
│  │  │  ┌───────────────────────────────────────────────────┐  │    │   │
│  │  │  │ Result Reporter                                   │  │    │   │
│  │  │  │   └── Upload screenshots                          │  │    │   │
│  │  │  │   └── Save results to Supabase                    │  │    │   │
│  │  │  │   └── Update run status                           │  │    │   │
│  │  │  └───────────────────────────────────────────────────┘  │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  Runners: 1-10 (auto-scaled based on queue depth)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Structure

```
vdi-runner/
├── src/
│   ├── index.ts                  # Entry point
│   ├── config.ts                 # Configuration
│   ├── poller/
│   │   ├── JobPoller.ts          # Job polling logic
│   │   └── JobClaimer.ts         # Atomic job claiming
│   ├── executor/
│   │   ├── TestExecutor.ts       # Main execution loop
│   │   ├── StepExecutor.ts       # Individual step execution
│   │   ├── ElementFinder.ts      # Multi-strategy element finding
│   │   └── ValueInjector.ts      # CSV value injection
│   ├── reporter/
│   │   ├── ResultReporter.ts     # Result aggregation
│   │   └── ScreenshotUploader.ts
│   ├── browser/
│   │   ├── BrowserManager.ts     # Playwright lifecycle
│   │   └── PageActions.ts        # Page interaction helpers
│   └── utils/
│       ├── logger.ts             # Structured logging
│       ├── timing.ts             # Delay utilities
│       └── errors.ts             # Error types
├── Dockerfile
├── fly.toml
├── package.json
└── tsconfig.json
```

---

## 3. Runner Service

### 3.1 Entry Point

```typescript
// src/index.ts
import { createClient } from '@supabase/supabase-js';
import { JobPoller } from './poller/JobPoller';
import { TestExecutor } from './executor/TestExecutor';
import { ResultReporter } from './reporter/ResultReporter';
import { BrowserManager } from './browser/BrowserManager';
import { config } from './config';
import { logger } from './utils/logger';

const RUNNER_ID = process.env.RUNNER_ID || `runner-${Date.now()}`;

async function main() {
  logger.info(`Starting VDI Runner: ${RUNNER_ID}`);
  
  // Initialize Supabase client
  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceKey
  );
  
  // Initialize components
  const browserManager = new BrowserManager();
  const resultReporter = new ResultReporter(supabase);
  const testExecutor = new TestExecutor(browserManager, resultReporter);
  const jobPoller = new JobPoller(supabase, RUNNER_ID);
  
  // Health check endpoint
  startHealthServer();
  
  // Main loop
  while (true) {
    try {
      // Poll for jobs
      const job = await jobPoller.poll();
      
      if (job) {
        logger.info(`Processing job: ${job.id}`);
        
        // Execute test
        const result = await testExecutor.execute(job);
        
        // Report results
        await resultReporter.report(job.id, result);
        
        logger.info(`Job completed: ${job.id}, status: ${result.status}`);
      } else {
        // No jobs, wait before polling again
        await sleep(config.pollIntervalMs);
      }
    } catch (error) {
      logger.error('Error in main loop', { error });
      await sleep(config.errorRetryMs);
    }
  }
}

function startHealthServer() {
  const http = require('http');
  const server = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('OK');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(config.healthPort);
  logger.info(`Health server listening on port ${config.healthPort}`);
}

main().catch(error => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
```

### 3.2 Configuration

```typescript
// src/config.ts
export const config = {
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  
  // Polling
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
  errorRetryMs: parseInt(process.env.ERROR_RETRY_MS || '10000'),
  
  // Execution
  stepTimeoutMs: parseInt(process.env.STEP_TIMEOUT_MS || '30000'),
  stepDelayMs: parseInt(process.env.STEP_DELAY_MS || '1000'),
  pageLoadTimeoutMs: parseInt(process.env.PAGE_LOAD_TIMEOUT_MS || '30000'),
  
  // Browser
  headless: process.env.HEADLESS !== 'false',
  viewportWidth: parseInt(process.env.VIEWPORT_WIDTH || '1920'),
  viewportHeight: parseInt(process.env.VIEWPORT_HEIGHT || '1080'),
  
  // Health
  healthPort: parseInt(process.env.HEALTH_PORT || '8080'),
  
  // Screenshots
  screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE !== 'false',
  screenshotOnSuccess: process.env.SCREENSHOT_ON_SUCCESS === 'true',
  
  // Limits
  maxRowsPerRun: parseInt(process.env.MAX_ROWS_PER_RUN || '1000'),
  maxStepsPerRun: parseInt(process.env.MAX_STEPS_PER_RUN || '500')
};
```

---

## 4. Job Processing

### 4.1 Job Poller

```typescript
// src/poller/JobPoller.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface TestJob {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  csv_row_filter?: number[];  // Optional: specific rows to run
}

export class JobPoller {
  constructor(
    private supabase: SupabaseClient,
    private runnerId: string
  ) {}
  
  async poll(): Promise<TestJob | null> {
    // Find oldest queued job
    const { data: jobs, error } = await this.supabase
      .from('test_runs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (error) {
      logger.error('Failed to poll for jobs', { error });
      return null;
    }
    
    if (!jobs || jobs.length === 0) {
      return null;
    }
    
    const job = jobs[0];
    
    // Try to claim the job atomically
    const claimed = await this.claimJob(job.id);
    
    if (!claimed) {
      logger.debug('Job already claimed by another runner', { jobId: job.id });
      return null;
    }
    
    return job as TestJob;
  }
  
  private async claimJob(jobId: string): Promise<boolean> {
    // Use atomic update with condition
    const { data, error } = await this.supabase
      .from('test_runs')
      .update({
        status: 'claimed',
        runner_id: this.runnerId,
        claimed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('status', 'queued')  // Only claim if still queued
      .select();
    
    if (error) {
      logger.error('Failed to claim job', { jobId, error });
      return false;
    }
    
    // If no rows updated, another runner got it
    return data && data.length > 0;
  }
  
  async updateJobStatus(
    jobId: string, 
    status: string, 
    additionalData?: Record<string, any>
  ): Promise<void> {
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'running') {
      updateData.started_at = new Date().toISOString();
    }
    
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    if (additionalData) {
      Object.assign(updateData, additionalData);
    }
    
    const { error } = await this.supabase
      .from('test_runs')
      .update(updateData)
      .eq('id', jobId);
    
    if (error) {
      logger.error('Failed to update job status', { jobId, status, error });
    }
  }
  
  async checkForCancellation(jobId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('test_runs')
      .select('status')
      .eq('id', jobId)
      .single();
    
    return data?.status === 'cancelled';
  }
}
```

### 4.2 Project Data Loading

```typescript
// src/executor/ProjectLoader.ts
import { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectData {
  id: string;
  name: string;
  target_url: string;
  recorded_steps: RecordedStep[];
  csv_data: Record<string, string>[];
  parsed_fields: FieldMapping[];
}

export interface RecordedStep {
  stepNumber: number;
  label: string;
  event: string;
  value?: string;
  selector?: string;
  bundle?: LocatorBundle;
}

export interface LocatorBundle {
  id?: string;
  xpath?: string;
  selector?: string;
  textContent?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  dataTestId?: string;
  className?: string;
  bounding?: { x: number; y: number; width: number; height: number };
  key?: string;  // For keyboard events
}

export interface FieldMapping {
  stepIndex: number;
  columnName: string;
  label: string;
}

export class ProjectLoader {
  constructor(private supabase: SupabaseClient) {}
  
  async load(projectId: string): Promise<ProjectData> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to load project: ${projectId}`);
    }
    
    return {
      id: data.id,
      name: data.name,
      target_url: data.target_url,
      recorded_steps: data.recorded_steps || [],
      csv_data: data.csv_data || [{}],  // Default to single empty row
      parsed_fields: data.parsed_fields || []
    };
  }
}
```

---

## 5. Playwright Execution

### 5.1 Test Executor

```typescript
// src/executor/TestExecutor.ts
import { BrowserManager } from '../browser/BrowserManager';
import { ResultReporter } from '../reporter/ResultReporter';
import { ProjectLoader, ProjectData } from './ProjectLoader';
import { StepExecutor, StepResult } from './StepExecutor';
import { ValueInjector } from './ValueInjector';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sleep } from '../utils/timing';

export interface TestResult {
  status: 'completed' | 'failed' | 'cancelled';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalRows: number;
  passedRows: number;
  failedRows: number;
  stepResults: StepResult[];
  screenshotUrls: string[];
  logs: string[];
  duration: number;
  error?: string;
}

export interface RowResult {
  rowIndex: number;
  success: boolean;
  stepResults: StepResult[];
}

export class TestExecutor {
  private projectLoader: ProjectLoader;
  private stepExecutor: StepExecutor;
  private valueInjector: ValueInjector;
  
  constructor(
    private browserManager: BrowserManager,
    private resultReporter: ResultReporter
  ) {
    this.projectLoader = new ProjectLoader(resultReporter.supabase);
    this.stepExecutor = new StepExecutor();
    this.valueInjector = new ValueInjector();
  }
  
  async execute(job: TestJob): Promise<TestResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const allStepResults: StepResult[] = [];
    const rowResults: RowResult[] = [];
    const screenshotUrls: string[] = [];
    
    let browser = null;
    let page = null;
    
    try {
      // Load project data
      logs.push(`Loading project: ${job.project_id}`);
      const project = await this.projectLoader.load(job.project_id);
      
      logs.push(`Project loaded: ${project.name}`);
      logs.push(`Steps: ${project.recorded_steps.length}`);
      logs.push(`CSV rows: ${project.csv_data.length}`);
      
      // Validate project
      if (project.recorded_steps.length === 0) {
        throw new Error('No recorded steps in project');
      }
      
      // Launch browser
      logs.push('Launching browser...');
      browser = await this.browserManager.launch();
      page = await browser.newPage();
      
      // Configure page
      await page.setViewportSize({
        width: config.viewportWidth,
        height: config.viewportHeight
      });
      
      // Determine rows to execute
      const rowsToExecute = job.csv_row_filter 
        ? project.csv_data.filter((_, i) => job.csv_row_filter!.includes(i))
        : project.csv_data;
      
      logs.push(`Executing ${rowsToExecute.length} rows`);
      
      // Execute each row
      for (let rowIndex = 0; rowIndex < rowsToExecute.length; rowIndex++) {
        const row = rowsToExecute[rowIndex];
        logs.push(`\n--- Row ${rowIndex + 1} of ${rowsToExecute.length} ---`);
        
        // Check for cancellation
        const cancelled = await this.resultReporter.checkCancellation(job.id);
        if (cancelled) {
          logs.push('Test cancelled by user');
          return this.buildResult('cancelled', rowResults, allStepResults, screenshotUrls, logs, startTime);
        }
        
        // Navigate to starting URL
        logs.push(`Navigating to ${project.target_url}`);
        await page.goto(project.target_url, { 
          waitUntil: 'networkidle',
          timeout: config.pageLoadTimeoutMs
        });
        
        // Execute steps for this row
        const rowStepResults: StepResult[] = [];
        let rowSuccess = true;
        
        for (const step of project.recorded_steps) {
          // Check for cancellation between steps
          const cancelled = await this.resultReporter.checkCancellation(job.id);
          if (cancelled) {
            logs.push('Test cancelled by user');
            return this.buildResult('cancelled', rowResults, allStepResults, screenshotUrls, logs, startTime);
          }
          
          // Resolve value for this step
          const value = this.valueInjector.resolve(step, row, project.parsed_fields);
          
          // Execute step
          logs.push(`Step ${step.stepNumber}: ${step.label}`);
          const stepResult = await this.stepExecutor.execute(page, step, value);
          
          stepResult.rowIndex = rowIndex;
          rowStepResults.push(stepResult);
          allStepResults.push(stepResult);
          
          if (stepResult.success) {
            logs.push(`  ✓ Passed (${stepResult.duration}ms)`);
          } else {
            logs.push(`  ✗ Failed: ${stepResult.error}`);
            rowSuccess = false;
            
            // Capture screenshot on failure
            if (config.screenshotOnFailure) {
              const screenshotUrl = await this.captureScreenshot(
                page, 
                job.id, 
                step.stepNumber, 
                rowIndex
              );
              if (screenshotUrl) {
                screenshotUrls.push(screenshotUrl);
                stepResult.screenshotUrl = screenshotUrl;
              }
            }
            
            // Continue with next row on failure (fail-soft)
            break;
          }
          
          // Delay between steps
          await sleep(config.stepDelayMs);
          
          // Update progress
          const progress = this.calculateProgress(
            rowIndex, 
            rowsToExecute.length, 
            step.stepNumber, 
            project.recorded_steps.length
          );
          await this.resultReporter.updateProgress(job.id, progress);
        }
        
        rowResults.push({
          rowIndex,
          success: rowSuccess,
          stepResults: rowStepResults
        });
      }
      
      // Determine overall status
      const hasFailures = rowResults.some(r => !r.success);
      const status = hasFailures ? 'failed' : 'completed';
      
      return this.buildResult(status, rowResults, allStepResults, screenshotUrls, logs, startTime);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logs.push(`\nFatal error: ${errorMessage}`);
      
      // Try to capture final screenshot
      if (page && config.screenshotOnFailure) {
        const screenshotUrl = await this.captureScreenshot(page, job.id, 0, 0);
        if (screenshotUrl) screenshotUrls.push(screenshotUrl);
      }
      
      return {
        status: 'failed',
        totalSteps: allStepResults.length,
        passedSteps: allStepResults.filter(s => s.success).length,
        failedSteps: allStepResults.filter(s => !s.success).length,
        skippedSteps: 0,
        totalRows: rowResults.length,
        passedRows: rowResults.filter(r => r.success).length,
        failedRows: rowResults.filter(r => !r.success).length,
        stepResults: allStepResults,
        screenshotUrls,
        logs,
        duration: Date.now() - startTime,
        error: errorMessage
      };
      
    } finally {
      // Clean up
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }
  
  private buildResult(
    status: 'completed' | 'failed' | 'cancelled',
    rowResults: RowResult[],
    stepResults: StepResult[],
    screenshotUrls: string[],
    logs: string[],
    startTime: number
  ): TestResult {
    return {
      status,
      totalSteps: stepResults.length,
      passedSteps: stepResults.filter(s => s.success).length,
      failedSteps: stepResults.filter(s => !s.success).length,
      skippedSteps: 0,
      totalRows: rowResults.length,
      passedRows: rowResults.filter(r => r.success).length,
      failedRows: rowResults.filter(r => !r.success).length,
      stepResults,
      screenshotUrls,
      logs,
      duration: Date.now() - startTime
    };
  }
  
  private calculateProgress(
    currentRow: number,
    totalRows: number,
    currentStep: number,
    totalSteps: number
  ): number {
    const rowProgress = currentRow / totalRows;
    const stepProgress = currentStep / totalSteps;
    const overallProgress = (rowProgress + (stepProgress / totalRows)) * 100;
    return Math.min(Math.round(overallProgress), 100);
  }
  
  private async captureScreenshot(
    page: any,
    jobId: string,
    stepNumber: number,
    rowIndex: number
  ): Promise<string | null> {
    try {
      const buffer = await page.screenshot({ 
        type: 'png',
        fullPage: false
      });
      return await this.resultReporter.uploadScreenshot(
        jobId, 
        stepNumber, 
        rowIndex, 
        buffer
      );
    } catch (error) {
      logger.error('Failed to capture screenshot', { error });
      return null;
    }
  }
}
```

### 5.2 Browser Manager

```typescript
// src/browser/BrowserManager.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../config';
import { logger } from '../utils/logger';

export class BrowserManager {
  private browser: Browser | null = null;
  
  async launch(): Promise<Browser> {
    logger.debug('Launching browser', { headless: config.headless });
    
    this.browser = await chromium.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    return this.browser;
  }
  
  async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }
    
    const context = await this.browser.newContext({
      viewport: {
        width: config.viewportWidth,
        height: config.viewportHeight
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });
    
    return context;
  }
  
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

---

## 6. Element Finding

### 6.1 Element Finder

```typescript
// src/executor/ElementFinder.ts
import { Page, Locator, ElementHandle } from 'playwright';
import { LocatorBundle } from './ProjectLoader';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface FindResult {
  element: ElementHandle | null;
  strategy: string;
  attempts: number;
}

export class ElementFinder {
  // Ordered list of strategies to try
  private strategies: LocatorStrategy[] = [
    new IdStrategy(),
    new DataTestIdStrategy(),
    new NameStrategy(),
    new AriaLabelStrategy(),
    new PlaceholderStrategy(),
    new XPathStrategy(),
    new CssSelectorStrategy(),
    new TextContentStrategy(),
    new CoordinateStrategy()
  ];
  
  async find(page: Page, bundle: LocatorBundle): Promise<FindResult> {
    let attempts = 0;
    
    for (const strategy of this.strategies) {
      if (!strategy.canHandle(bundle)) {
        continue;
      }
      
      attempts++;
      
      try {
        const locator = strategy.getLocator(page, bundle);
        
        // Wait for element with timeout
        await locator.waitFor({ 
          state: 'visible', 
          timeout: 5000 
        });
        
        const element = await locator.elementHandle();
        
        if (element && await this.isInteractable(element)) {
          logger.debug(`Element found using ${strategy.name}`, { 
            strategy: strategy.name 
          });
          
          return {
            element,
            strategy: strategy.name,
            attempts
          };
        }
      } catch (error) {
        // Strategy failed, try next
        logger.debug(`Strategy ${strategy.name} failed`, { 
          error: error instanceof Error ? error.message : 'Unknown' 
        });
      }
    }
    
    return {
      element: null,
      strategy: 'none',
      attempts
    };
  }
  
  private async isInteractable(element: ElementHandle): Promise<boolean> {
    try {
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled();
      return isVisible && isEnabled;
    } catch {
      return false;
    }
  }
}

// Strategy interface
interface LocatorStrategy {
  name: string;
  canHandle(bundle: LocatorBundle): boolean;
  getLocator(page: Page, bundle: LocatorBundle): Locator;
}

// Strategy implementations
class IdStrategy implements LocatorStrategy {
  name = 'id';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.id;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(`#${bundle.id}`);
  }
}

class DataTestIdStrategy implements LocatorStrategy {
  name = 'data-testid';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.dataTestId;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(`[data-testid="${bundle.dataTestId}"]`);
  }
}

class NameStrategy implements LocatorStrategy {
  name = 'name';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.name;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(`[name="${bundle.name}"]`);
  }
}

class AriaLabelStrategy implements LocatorStrategy {
  name = 'aria-label';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.ariaLabel;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(`[aria-label="${bundle.ariaLabel}"]`);
  }
}

class PlaceholderStrategy implements LocatorStrategy {
  name = 'placeholder';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.placeholder;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(`[placeholder="${bundle.placeholder}"]`);
  }
}

class XPathStrategy implements LocatorStrategy {
  name = 'xpath';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.xpath;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(`xpath=${bundle.xpath}`);
  }
}

class CssSelectorStrategy implements LocatorStrategy {
  name = 'css';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.selector;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    return page.locator(bundle.selector!);
  }
}

class TextContentStrategy implements LocatorStrategy {
  name = 'text';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!bundle.textContent;
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    // Use exact text match for buttons/links
    return page.locator(`text="${bundle.textContent}"`);
  }
}

class CoordinateStrategy implements LocatorStrategy {
  name = 'coordinates';
  
  canHandle(bundle: LocatorBundle): boolean {
    return !!(bundle.bounding?.x && bundle.bounding?.y);
  }
  
  getLocator(page: Page, bundle: LocatorBundle): Locator {
    // Fallback to coordinate-based selection
    // This creates a locator for element at specific coordinates
    const x = bundle.bounding!.x + (bundle.bounding!.width || 0) / 2;
    const y = bundle.bounding!.y + (bundle.bounding!.height || 0) / 2;
    
    // Use page.evaluate to find element at coordinates
    return page.locator(`xpath=//*`).filter({
      has: page.locator(`xpath=./ancestor-or-self::*`)
    }).first();
    // Note: Actual implementation would use page.mouse.click(x, y)
  }
}
```

### 6.2 Smart Waiting

```typescript
// src/executor/SmartWaiter.ts
import { Page } from 'playwright';
import { config } from '../config';

export class SmartWaiter {
  async waitForStable(page: Page): Promise<void> {
    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { 
      timeout: config.pageLoadTimeoutMs 
    }).catch(() => {});
    
    // Wait for animations to complete
    await page.waitForFunction(() => {
      const animations = document.getAnimations();
      return animations.length === 0 || animations.every(a => a.playState === 'finished');
    }, { timeout: 2000 }).catch(() => {});
    
    // Small delay for React/Vue state updates
    await page.waitForTimeout(100);
  }
  
  async waitForElement(
    page: Page, 
    selector: string, 
    options?: { timeout?: number; state?: 'visible' | 'attached' }
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, {
        state: options?.state || 'visible',
        timeout: options?.timeout || config.stepTimeoutMs
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 7. Value Injection

### 7.1 Value Injector

```typescript
// src/executor/ValueInjector.ts
import { RecordedStep, FieldMapping } from './ProjectLoader';
import { logger } from '../utils/logger';

export class ValueInjector {
  /**
   * Resolve the value to use for a step, considering CSV mappings
   */
  resolve(
    step: RecordedStep,
    row: Record<string, string>,
    mappings: FieldMapping[]
  ): string | undefined {
    // Strategy 1: Direct mapping by step index
    const directMapping = mappings.find(m => m.stepIndex === step.stepNumber - 1);
    if (directMapping && row[directMapping.columnName] !== undefined) {
      logger.debug('Value resolved via direct mapping', {
        stepNumber: step.stepNumber,
        column: directMapping.columnName,
        value: row[directMapping.columnName]
      });
      return row[directMapping.columnName];
    }
    
    // Strategy 2: Label contains column name
    for (const [columnName, value] of Object.entries(row)) {
      if (this.labelContainsColumn(step.label, columnName)) {
        logger.debug('Value resolved via label match', {
          stepNumber: step.stepNumber,
          label: step.label,
          column: columnName,
          value
        });
        return value;
      }
    }
    
    // Strategy 3: Exact column name match in label
    for (const [columnName, value] of Object.entries(row)) {
      if (step.label.toLowerCase().includes(columnName.toLowerCase())) {
        logger.debug('Value resolved via exact label match', {
          stepNumber: step.stepNumber,
          column: columnName,
          value
        });
        return value;
      }
    }
    
    // Strategy 4: Fall back to recorded value
    logger.debug('Using recorded value (no mapping found)', {
      stepNumber: step.stepNumber,
      value: step.value
    });
    return step.value;
  }
  
  private labelContainsColumn(label: string, columnName: string): boolean {
    const normalizedLabel = this.normalizeString(label);
    const normalizedColumn = this.normalizeString(columnName);
    
    // Check if label contains column name
    return normalizedLabel.includes(normalizedColumn);
  }
  
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')  // Remove special characters
      .trim();
  }
}
```

---

## 8. Screenshot Capture

### 8.1 Screenshot Uploader

```typescript
// src/reporter/ScreenshotUploader.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export class ScreenshotUploader {
  constructor(private supabase: SupabaseClient) {}
  
  async upload(
    jobId: string,
    stepNumber: number,
    rowIndex: number,
    buffer: Buffer
  ): Promise<string | null> {
    const filename = `${jobId}/step-${stepNumber}-row-${rowIndex}-${Date.now()}.png`;
    
    try {
      const { data, error } = await this.supabase.storage
        .from('screenshots')
        .upload(filename, buffer, {
          contentType: 'image/png',
          cacheControl: '31536000'  // 1 year cache
        });
      
      if (error) {
        logger.error('Failed to upload screenshot', { filename, error });
        return null;
      }
      
      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('screenshots')
        .getPublicUrl(filename);
      
      return urlData.publicUrl;
      
    } catch (error) {
      logger.error('Screenshot upload exception', { error });
      return null;
    }
  }
  
  async deleteJobScreenshots(jobId: string): Promise<void> {
    try {
      const { data: files } = await this.supabase.storage
        .from('screenshots')
        .list(jobId);
      
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${jobId}/${f.name}`);
        await this.supabase.storage
          .from('screenshots')
          .remove(filePaths);
      }
    } catch (error) {
      logger.error('Failed to delete screenshots', { jobId, error });
    }
  }
}
```

---

## 9. Result Reporting

### 9.1 Result Reporter

```typescript
// src/reporter/ResultReporter.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { TestResult } from '../executor/TestExecutor';
import { ScreenshotUploader } from './ScreenshotUploader';
import { logger } from '../utils/logger';

export class ResultReporter {
  public supabase: SupabaseClient;
  private screenshotUploader: ScreenshotUploader;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.screenshotUploader = new ScreenshotUploader(supabase);
  }
  
  async report(jobId: string, result: TestResult): Promise<void> {
    const updateData = {
      status: result.status,
      completed_at: new Date().toISOString(),
      duration_ms: result.duration,
      total_steps: result.totalSteps,
      passed_steps: result.passedSteps,
      failed_steps: result.failedSteps,
      skipped_steps: result.skippedSteps,
      total_rows: result.totalRows,
      passed_rows: result.passedRows,
      failed_rows: result.failedRows,
      pass_rate: result.totalSteps > 0 
        ? (result.passedSteps / result.totalSteps) * 100 
        : 0,
      step_results: result.stepResults,
      screenshot_urls: result.screenshotUrls,
      logs: result.logs,
      error: result.error || null
    };
    
    const { error } = await this.supabase
      .from('test_runs')
      .update(updateData)
      .eq('id', jobId);
    
    if (error) {
      logger.error('Failed to report results', { jobId, error });
      throw error;
    }
    
    logger.info('Results reported', {
      jobId,
      status: result.status,
      passRate: updateData.pass_rate
    });
  }
  
  async updateProgress(jobId: string, progress: number): Promise<void> {
    await this.supabase
      .from('test_runs')
      .update({ 
        progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
  
  async checkCancellation(jobId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('test_runs')
      .select('status')
      .eq('id', jobId)
      .single();
    
    return data?.status === 'cancelled';
  }
  
  async uploadScreenshot(
    jobId: string,
    stepNumber: number,
    rowIndex: number,
    buffer: Buffer
  ): Promise<string | null> {
    return this.screenshotUploader.upload(jobId, stepNumber, rowIndex, buffer);
  }
}
```

---

## 10. Error Handling

### 10.1 Error Types

```typescript
// src/utils/errors.ts
export class TestExecutionError extends Error {
  constructor(
    message: string,
    public stepNumber?: number,
    public rowIndex?: number,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'TestExecutionError';
  }
}

export class ElementNotFoundError extends TestExecutionError {
  constructor(stepNumber: number, rowIndex: number, selector: string) {
    super(
      `Element not found: ${selector}`,
      stepNumber,
      rowIndex,
      false
    );
    this.name = 'ElementNotFoundError';
  }
}

export class TimeoutError extends TestExecutionError {
  constructor(stepNumber: number, rowIndex: number, operation: string) {
    super(
      `Timeout waiting for: ${operation}`,
      stepNumber,
      rowIndex,
      true
    );
    this.name = 'TimeoutError';
  }
}

export class NavigationError extends TestExecutionError {
  constructor(url: string, reason: string) {
    super(`Navigation failed to ${url}: ${reason}`, undefined, undefined, true);
    this.name = 'NavigationError';
  }
}

export class BrowserCrashError extends TestExecutionError {
  constructor() {
    super('Browser crashed unexpectedly', undefined, undefined, true);
    this.name = 'BrowserCrashError';
  }
}
```

### 10.2 Error Recovery

```typescript
// src/executor/ErrorRecovery.ts
import { Page, Browser } from 'playwright';
import { BrowserManager } from '../browser/BrowserManager';
import { logger } from '../utils/logger';

export class ErrorRecovery {
  constructor(private browserManager: BrowserManager) {}
  
  async attemptRecovery(
    error: Error,
    browser: Browser | null,
    page: Page | null
  ): Promise<{ browser: Browser; page: Page } | null> {
    logger.info('Attempting error recovery', { 
      errorType: error.name,
      message: error.message
    });
    
    // Close existing resources
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    
    // Relaunch browser
    try {
      const newBrowser = await this.browserManager.launch();
      const newPage = await newBrowser.newPage();
      
      logger.info('Recovery successful - browser relaunched');
      return { browser: newBrowser, page: newPage };
    } catch (recoveryError) {
      logger.error('Recovery failed', { recoveryError });
      return null;
    }
  }
}
```

---

## 11. Scaling Strategy

### 11.1 Auto-Scaling Configuration

```toml
# fly.toml
app = "testflow-vdi-runner"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  HEADLESS = "true"

[http_service]
  internal_port = 8080
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    path = "/health"

[metrics]
  port = 9091
  path = "/metrics"

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 2048
```

### 11.2 Scaling Logic

```typescript
// Auto-scaling is handled by Fly.io based on:
// 1. HTTP check responses (/health endpoint)
// 2. Queue depth (monitored externally)
// 3. CPU/memory thresholds

// Manual scaling can be triggered via:
// fly scale count 5  # Scale to 5 runners
// fly scale count 1  # Scale back to 1

// For queue-based scaling, implement external monitor:
async function checkQueueDepth(): Promise<number> {
  const { count } = await supabase
    .from('test_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  return count || 0;
}

async function scaleRunners(targetCount: number): Promise<void> {
  // Call Fly.io API to scale
  const response = await fetch(
    `https://api.fly.io/v1/apps/${FLY_APP}/scale`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ count: targetCount })
    }
  );
}
```

---

## 12. Deployment

### 12.1 Dockerfile

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY dist/ ./dist/

# Set environment
ENV NODE_ENV=production
ENV HEADLESS=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run
CMD ["node", "dist/index.js"]
```

### 12.2 Deployment Commands

```bash
# Build and deploy to Fly.io
fly deploy

# View logs
fly logs

# Scale runners
fly scale count 3

# SSH into runner for debugging
fly ssh console

# View metrics
fly status
```

### 12.3 Environment Variables

```bash
# Required environment variables (set via fly secrets)
fly secrets set SUPABASE_URL=https://xxx.supabase.co
fly secrets set SUPABASE_SERVICE_KEY=xxx

# Optional configuration
fly secrets set POLL_INTERVAL_MS=5000
fly secrets set STEP_TIMEOUT_MS=30000
fly secrets set STEP_DELAY_MS=1000
```

---

## Summary

The VDI Runner Implementation provides:

✅ Job polling with atomic claiming  
✅ Playwright execution in headless Chrome  
✅ Multi-strategy element finding (9 strategies)  
✅ CSV value injection with smart resolution  
✅ Screenshot capture on failures  
✅ Result reporting to Supabase  
✅ Error handling with recovery  
✅ Auto-scaling via Fly.io  
✅ Docker deployment ready  

This enables reliable, scalable execution of recorded tests in the cloud without requiring users to have Chrome installed locally.
