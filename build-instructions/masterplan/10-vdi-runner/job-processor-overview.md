# Job Processor Overview
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Job Lifecycle
4. Component Structure
5. Data Flow
6. Queue Management
7. Worker Pool
8. Error Recovery
9. Monitoring
10. Deployment

---

## 1. Overview

### 1.1 Purpose

The Job Processor is a Node.js service that polls Supabase for queued test executions, claims jobs atomically, executes them using Playwright, and reports results back to the database.

### 1.2 Key Responsibilities

- **Job Polling**: Query Supabase every 5 seconds for pending jobs
- **Atomic Claiming**: Use optimistic locking to prevent duplicate execution
- **Execution**: Launch Playwright browser and run recorded steps
- **CSV Iteration**: Execute test for each row in CSV data
- **Logging**: Write real-time logs to Supabase for portal monitoring
- **Result Reporting**: Update job status (completed, failed) with metrics
- **Error Handling**: Retry failed steps, implement healing, graceful shutdown
- **Resource Cleanup**: Close browsers, release workers

### 1.3 Design Principles
```
1. FAULT TOLERANCE
   - Jobs can be retried if worker crashes
   - Partial results saved incrementally
   - Database transactions for atomicity

2. SCALABILITY
   - Worker pool (2-10 concurrent jobs)
   - Horizontal scaling via Fly.io machines
   - Queue-based load balancing

3. OBSERVABILITY
   - Real-time log streaming to database
   - Execution metrics (duration, success rate)
   - Health checks and alerts

4. ISOLATION
   - Each job runs in separate Playwright context
   - No state shared between jobs
   - Clean slate for every execution
```

---

## 2. Architecture

### 2.1 System Context
```
┌─────────────────────────────────────────────────────────────┐
│                    WEB PORTAL (Next.js)                     │
│                                                             │
│  User clicks "Start Execution"                              │
│  ↓                                                           │
│  Create execution_jobs record:                              │
│  { status: 'queued', recording_id, csv_data, config }      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                         │
│                                                             │
│  execution_jobs table:                                      │
│  ┌─────┬────────────┬──────────┬────────────┬──────────┐  │
│  │ id  │ status     │ rec_id   │ csv_data   │ config   │  │
│  ├─────┼────────────┼──────────┼────────────┼──────────┤  │
│  │ 1   │ queued     │ rec-123  │ [{...}]    │ {...}    │  │
│  │ 2   │ running    │ rec-456  │ [{...}]    │ {...}    │  │
│  │ 3   │ completed  │ rec-789  │ [{...}]    │ {...}    │  │
│  └─────┴────────────┴──────────┴────────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              VDI RUNNER (Node.js on Fly.io)                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ JOB POLLER (5 second interval)                     │   │
│  │                                                     │   │
│  │  1. Query for status='queued'                      │   │
│  │  2. Atomically claim job (UPDATE WHERE status='queued')│
│  │  3. If success, add to worker pool                 │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ WORKER POOL (2-10 concurrent workers)              │   │
│  │                                                     │   │
│  │  Worker 1: Executing job 42                        │   │
│  │  Worker 2: Executing job 43                        │   │
│  │  Worker 3: Idle                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ PLAYWRIGHT EXECUTOR                                 │   │
│  │                                                     │   │
│  │  • Launch Chromium (headless)                      │   │
│  │  • Iterate CSV rows                                │   │
│  │  • Execute steps sequentially                      │   │
│  │  • Log to Supabase                                 │   │
│  │  • Capture screenshots on error                    │   │
│  │  • Clean up browser                                │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ RESULTS AGGREGATOR                                  │   │
│  │                                                     │   │
│  │  • Calculate metrics                               │   │
│  │  • Update job status='completed'                   │   │
│  │  • Save execution summary                          │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                         │
│                                                             │
│  execution_jobs: Updated with results                      │
│  execution_logs: Step-by-step logs                         │
│  execution_screenshots: Error screenshots                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 High-Level Components

| Component | Responsibility | File |
|-----------|----------------|------|
| **JobPoller** | Poll Supabase for queued jobs | `src/poller.ts` |
| **WorkerPool** | Manage concurrent job execution | `src/worker-pool.ts` |
| **JobExecutor** | Execute single job | `src/executor.ts` |
| **PlaywrightRunner** | Browser automation | `src/playwright-runner.ts` |
| **LogWriter** | Write logs to Supabase | `src/logger.ts` |
| **ResultsAggregator** | Calculate and save results | `src/results.ts` |
| **HealthChecker** | Health endpoint for monitoring | `src/health.ts` |

---

## 3. Job Lifecycle

### 3.1 Status Flow
```
queued → running → completed
                 ↘ failed
```

### 3.2 Detailed States
```typescript
type JobStatus = 
  | 'queued'      // Created by portal, waiting for worker
  | 'running'     // Claimed by worker, execution in progress
  | 'completed'   // All steps executed successfully
  | 'failed'      // Execution failed (error, timeout, crash)
  | 'cancelled';  // User cancelled via portal (Phase 2)
```

### 3.3 State Transitions

| From | To | Trigger | Notes |
|------|----|---------| ------|
| queued | running | Worker claims job | Atomic UPDATE |
| running | completed | All steps pass | Success |
| running | failed | Step fails with no healing | Failure |
| running | queued | Worker crashes | Retry mechanism |
| running | cancelled | User clicks cancel | Phase 2 |

---

## 4. Component Structure

### 4.1 Project Structure
```
vdi-runner/
├── src/
│   ├── index.ts                 # Entry point, start poller
│   ├── poller.ts                # Job polling logic
│   ├── worker-pool.ts           # Concurrent worker management
│   ├── executor.ts              # Single job execution
│   ├── playwright-runner.ts     # Playwright automation
│   ├── step-executor.ts         # Execute individual steps
│   ├── logger.ts                # Log writing to Supabase
│   ├── results.ts               # Results aggregation
│   ├── health.ts                # Health check endpoint
│   ├── types.ts                 # TypeScript interfaces
│   └── utils/
│       ├── supabase.ts          # Supabase client
│       ├── retry.ts             # Retry logic
│       └── cleanup.ts           # Resource cleanup
├── Dockerfile                   # Container image
├── fly.toml                     # Fly.io configuration
├── package.json
└── tsconfig.json
```

### 4.2 Main Entry Point
```typescript
// src/index.ts
import { JobPoller } from './poller';
import { WorkerPool } from './worker-pool';
import { HealthChecker } from './health';

async function main() {
  console.log('🚀 VDI Runner starting...');

  // Start health check server
  const healthChecker = new HealthChecker();
  await healthChecker.start(3000);

  // Initialize worker pool
  const workerPool = new WorkerPool({
    minWorkers: 2,
    maxWorkers: 10,
    scaleUpThreshold: 3
  });

  // Start job poller
  const poller = new JobPoller({
    pollInterval: 5000,
    workerPool
  });

  await poller.start();

  console.log('✅ VDI Runner running');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM received, shutting down...');
    await poller.stop();
    await workerPool.drain();
    await healthChecker.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
```

---

## 5. Data Flow

### 5.1 Complete Execution Flow
```
1. POLLING
   JobPoller queries every 5s
   ↓
2. CLAIMING
   Atomic UPDATE to status='running'
   ↓
3. LOADING
   Fetch recording steps from Supabase
   ↓
4. BROWSER LAUNCH
   chromium.launch({ headless: true })
   ↓
5. CSV ITERATION
   FOR EACH row in csv_data:
     ↓
     6. STEP EXECUTION
        FOR EACH step in recording.steps:
          ↓
          a. Variable injection ({{firstName}} → "John")
          b. Navigate or interact with page
          c. Log to Supabase
          d. Screenshot on error
        END FOR
     ↓
   END FOR
   ↓
7. RESULTS AGGREGATION
   Calculate passed/failed counts, duration
   ↓
8. CLEANUP
   Close browser, release worker
   ↓
9. STATUS UPDATE
   UPDATE job SET status='completed'
```

### 5.2 Message Flow
```
VDI Runner                     Supabase
    │                              │
    ├──── Query queued jobs ──────→│
    │←── Return job #42 ───────────┤
    │                              │
    ├──── Claim job #42 ──────────→│
    │     (UPDATE status)          │
    │←── Success ───────────────────┤
    │                              │
    ├──── INSERT log entry ───────→│
    │     (Step 1 started)         │
    │                              │
    ├──── INSERT log entry ───────→│
    │     (Step 1 completed)       │
    │                              │
    ├──── INSERT log entry ───────→│
    │     (Step 2 started)         │
    │                              │
    │     ... (continue)           │
    │                              │
    ├──── UPDATE job #42 ─────────→│
    │     (status='completed')     │
    │←── Success ───────────────────┤
```

---

## 6. Queue Management

### 6.1 FIFO Queue (Phase 1)
```typescript
// Simple first-in-first-out
const { data: jobs } = await supabase
  .from('execution_jobs')
  .select('*')
  .eq('status', 'queued')
  .order('created_at', { ascending: true })
  .limit(1);
```

### 6.2 Priority Queue (Phase 2)
```typescript
// Priority field (1-5, higher = more urgent)
const { data: jobs } = await supabase
  .from('execution_jobs')
  .select('*')
  .eq('status', 'queued')
  .order('priority', { ascending: false })
  .order('created_at', { ascending: true })
  .limit(1);
```

### 6.3 Atomic Claiming
```typescript
// Prevent duplicate execution
const { data, error } = await supabase
  .from('execution_jobs')
  .update({
    status: 'running',
    started_at: new Date().toISOString(),
    worker_id: WORKER_ID
  })
  .eq('id', job.id)
  .eq('status', 'queued')  // Only update if still queued
  .select()
  .single();

if (error || !data) {
  // Another worker claimed it
  return null;
}

return data;
```

---

## 7. Worker Pool

### 7.1 Worker Pool Architecture
```typescript
class WorkerPool {
  private workers: Worker[] = [];
  private maxWorkers: number;
  private minWorkers: number;

  async addJob(job: ExecutionJob): Promise<void> {
    // Find idle worker or create new one
    let worker = this.workers.find(w => w.idle);

    if (!worker && this.workers.length < this.maxWorkers) {
      worker = await this.createWorker();
    }

    if (worker) {
      await worker.execute(job);
    } else {
      // Queue full, wait
      await this.waitForAvailableWorker();
      return this.addJob(job);
    }
  }

  private async createWorker(): Promise<Worker> {
    const worker = new Worker(this.workerConfig);
    this.workers.push(worker);
    return worker;
  }

  async drain(): Promise<void> {
    // Wait for all workers to finish
    await Promise.all(this.workers.map(w => w.waitUntilIdle()));
  }
}
```

### 7.2 Worker Lifecycle
```
Created → Idle → Executing → Idle → ... → Terminated
                     ↓
                  (timeout after 5min idle)
```

---

## 8. Error Recovery

### 8.1 Error Types
```typescript
enum ExecutionError {
  ELEMENT_NOT_FOUND = 'Element not found',
  TIMEOUT = 'Timeout exceeded',
  NAVIGATION_FAILED = 'Navigation failed',
  SCREENSHOT_FAILED = 'Screenshot capture failed',
  DATABASE_ERROR = 'Database write failed',
  BROWSER_CRASH = 'Browser process crashed'
}
```

### 8.2 Recovery Strategies

| Error Type | Strategy | Max Retries |
|------------|----------|-------------|
| Element not found | AI Healing → Retry | 2 |
| Timeout | Increase timeout → Retry | 1 |
| Navigation failed | Retry with delay | 3 |
| Database error | Exponential backoff | 5 |
| Browser crash | Restart browser → Retry job | 1 |

### 8.3 Retry Logic
```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        await sleep(delay * attempt); // Exponential backoff
      }
    }
  }

  throw lastError;
}
```

---

## 9. Monitoring

### 9.1 Health Endpoint
```typescript
// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeWorkers: workerPool.activeCount,
    idleWorkers: workerPool.idleCount,
    queueDepth: jobQueue.length,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  });
});
```

### 9.2 Metrics
```typescript
interface Metrics {
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  avgExecutionTime: number;
  avgStepsPerJob: number;
  totalLogsWritten: number;
  totalScreenshots: number;
}
```

---

## 10. Deployment

### 10.1 Dockerfile
```dockerfile
FROM node:18-bookworm-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### 10.2 Fly.io Configuration
```toml
# fly.toml
app = "automater-vdi-runner"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"

[compute]
  cpu_kind = "performance"
  cpus = 4
  memory = "8gb"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[autoscaling]
  min_machines = 1
  max_machines = 5
```

---

## Summary

The Job Processor provides:
- ✅ **Job polling** every 5 seconds with exponential backoff
- ✅ **Atomic claiming** to prevent duplicate execution
- ✅ **Worker pool** with 2-10 concurrent workers
- ✅ **Playwright execution** with Chromium headless
- ✅ **CSV iteration** for data-driven testing
- ✅ **Real-time logging** to Supabase
- ✅ **Error recovery** with retry logic and AI healing
- ✅ **Results aggregation** with metrics
- ✅ **Health monitoring** with /health endpoint
- ✅ **Fly.io deployment** with Docker and autoscaling

This provides complete serverless test execution infrastructure.
