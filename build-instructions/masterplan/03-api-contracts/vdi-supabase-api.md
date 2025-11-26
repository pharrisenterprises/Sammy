# VDI-Supabase API Contract

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Status:** Complete Technical Specification  
**Last Updated:** November 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Service Client Configuration](#2-service-client-configuration)
3. [Job Polling API](#3-job-polling-api)
4. [Job Status Updates](#4-job-status-updates)
5. [Execution Results API](#5-execution-results-api)
6. [Execution Logs API](#6-execution-logs-api)
7. [Healing Logs API](#7-healing-logs-api)
8. [Recording Updates API](#8-recording-updates-api)
9. [Screenshot Storage API](#9-screenshot-storage-api)
10. [VDI Metrics API](#10-vdi-metrics-api)
11. [Error Handling](#11-error-handling)
12. [Rate Limiting & Performance](#12-rate-limiting--performance)

---

## 1. Overview

This document defines the API contract between the VDI Executor (Fly.io) and Supabase. The VDI uses a **service role key** to bypass Row Level Security (RLS) and perform operations on behalf of all users.

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VDI EXECUTOR (Fly.io)                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Node.js Application                          │   │
│  │                                                                   │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐│   │
│  │  │  Job Poller   │  │   Executor    │  │    AI Healer          ││   │
│  │  │               │  │               │  │                       ││   │
│  │  │ • Poll jobs   │  │ • Playwright  │  │ • Claude Vision       ││   │
│  │  │ • Claim job   │  │ • Actions     │  │ • Selector gen        ││   │
│  │  │ • Update      │  │ • Variables   │  │ • Cache check         ││   │
│  │  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘│   │
│  │          │                  │                      │            │   │
│  │          └──────────────────┴──────────────────────┘            │   │
│  │                             │                                    │   │
│  │              ┌──────────────┴──────────────┐                    │   │
│  │              │     Supabase Service        │                    │   │
│  │              │     (Service Role Key)      │                    │   │
│  │              └──────────────┬──────────────┘                    │   │
│  └─────────────────────────────┼───────────────────────────────────┘   │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
                                 │ HTTPS (REST API)
                                 │
┌────────────────────────────────┼────────────────────────────────────────┐
│                                ▼                                        │
│                           SUPABASE                                      │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   PostgreSQL    │  │    Storage      │  │      Realtime           │ │
│  │                 │  │                 │  │                         │ │
│  │  Tables:        │  │  Buckets:       │  │  • Job notifications    │ │
│  │  • exec_jobs    │  │  • screenshots  │  │  • Log broadcasting     │ │
│  │  • exec_results │  │  • downloads    │  │                         │ │
│  │  • exec_logs    │  │                 │  │                         │ │
│  │  • healing_logs │  │                 │  │                         │ │
│  │  • recordings   │  │                 │  │                         │ │
│  │  • vdi_metrics  │  │                 │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Principles

| Principle | Description |
|-----------|-------------|
| Service Role | VDI uses service role key (bypasses RLS) |
| Atomic Claims | Jobs claimed with atomic UPDATE + status check |
| Idempotent Writes | Results/logs can be safely retried |
| Batched Logging | Logs batched for performance |
| Realtime Broadcast | Status changes trigger realtime events |

### 1.3 Environment Configuration

```bash
# VDI Environment Variables
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Full access, bypasses RLS
ANTHROPIC_API_KEY=sk-ant-...       # For AI healing
VDI_INSTANCE_ID=vdi-001            # Unique instance identifier
VDI_REGION=iad                     # Fly.io region
```

---

## 2. Service Client Configuration

### 2.1 Supabase Service Client

```typescript
// vdi-executor/src/lib/supabase.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

class SupabaseService {
  private client: SupabaseClient<Database>;
  private instanceId: string;

  constructor() {
    this.client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role bypasses RLS
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    );

    this.instanceId = process.env.VDI_INSTANCE_ID || `vdi-${Date.now()}`;
  }

  get db() {
    return this.client;
  }

  get storage() {
    return this.client.storage;
  }

  getInstanceId(): string {
    return this.instanceId;
  }
}

// Singleton export
export const supabase = new SupabaseService();
```

### 2.2 Type Definitions

```typescript
// vdi-executor/src/types/supabase.ts

export interface Database {
  public: {
    Tables: {
      execution_jobs: {
        Row: ExecutionJob;
        Insert: Omit<ExecutionJob, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ExecutionJob, 'id' | 'created_at'>>;
      };
      execution_results: {
        Row: ExecutionResult;
        Insert: Omit<ExecutionResult, 'id' | 'created_at'>;
        Update: Partial<Omit<ExecutionResult, 'id' | 'created_at'>>;
      };
      execution_logs: {
        Row: ExecutionLog;
        Insert: Omit<ExecutionLog, 'id' | 'created_at'>;
        Update: never; // Logs are immutable
      };
      healing_logs: {
        Row: HealingLog;
        Insert: Omit<HealingLog, 'id' | 'created_at'>;
        Update: never;
      };
      recordings: {
        Row: Recording;
        Insert: Omit<Recording, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Recording, 'id' | 'created_at'>>;
      };
      vdi_metrics: {
        Row: VdiMetric;
        Insert: Omit<VdiMetric, 'id' | 'created_at'>;
        Update: Partial<Omit<VdiMetric, 'id' | 'created_at'>>;
      };
    };
  };
}
```

---

## 3. Job Polling API

### 3.1 Poll for Pending Jobs

The VDI polls Supabase every 5 seconds for pending jobs.

```typescript
// vdi-executor/src/services/job-poller.ts

interface PollResult {
  job: ExecutionJob | null;
  claimed: boolean;
}

class JobPoller {
  private readonly POLL_INTERVAL_MS = 5000;
  private readonly MAX_BACKOFF_MS = 30000;
  private currentInterval = this.POLL_INTERVAL_MS;
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    
    while (this.isRunning) {
      const result = await this.pollAndClaim();
      
      if (result.claimed && result.job) {
        // Reset interval on successful claim
        this.currentInterval = this.POLL_INTERVAL_MS;
        
        // Execute job
        await this.executeJob(result.job);
      } else {
        // Exponential backoff when no jobs
        this.currentInterval = Math.min(
          this.currentInterval * 1.5,
          this.MAX_BACKOFF_MS
        );
      }
      
      await this.sleep(this.currentInterval);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  private async pollAndClaim(): Promise<PollResult> {
    // 1. Query for oldest pending job
    const { data: jobs, error: queryError } = await supabase.db
      .from('execution_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (queryError) {
      console.error('Failed to query jobs:', queryError);
      return { job: null, claimed: false };
    }

    if (!jobs || jobs.length === 0) {
      return { job: null, claimed: false };
    }

    const job = jobs[0];

    // 2. Atomic claim with optimistic locking
    const { data: claimedJob, error: claimError } = await supabase.db
      .from('execution_jobs')
      .update({
        status: 'running',
        vdi_instance_id: supabase.getInstanceId(),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .eq('status', 'pending') // Ensures no race condition
      .select()
      .single();

    if (claimError || !claimedJob) {
      // Another VDI instance claimed this job
      console.log('Job already claimed by another instance');
      return { job: null, claimed: false };
    }

    console.log(`Claimed job ${claimedJob.id}`);
    return { job: claimedJob, claimed: true };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const jobPoller = new JobPoller();
```

### 3.2 Fetch Recording for Job

```typescript
// vdi-executor/src/services/recording-service.ts

interface FetchRecordingResult {
  recording: Recording;
  steps: RecordedStep[];
}

async function fetchRecording(recordingId: string): Promise<FetchRecordingResult> {
  const { data: recording, error } = await supabase.db
    .from('recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch recording: ${error.message}`);
  }

  return {
    recording,
    steps: recording.steps as RecordedStep[]
  };
}
```

### 3.3 Concurrent Job Limit

```typescript
// VDI should not claim more jobs than it can handle
const MAX_CONCURRENT_JOBS = 3;
let activeJobs = 0;

async function canClaimJob(): Promise<boolean> {
  return activeJobs < MAX_CONCURRENT_JOBS;
}

async function incrementActiveJobs(): Promise<void> {
  activeJobs++;
}

async function decrementActiveJobs(): Promise<void> {
  activeJobs = Math.max(0, activeJobs - 1);
}
```

---

## 4. Job Status Updates

### 4.1 Update Job Progress

```typescript
// vdi-executor/src/services/job-updater.ts

interface JobProgress {
  currentRow: number;
  completedRows: number;
  failedRows: number;
}

async function updateJobProgress(
  jobId: string,
  progress: JobProgress
): Promise<void> {
  const { error } = await supabase.db
    .from('execution_jobs')
    .update({
      current_row: progress.currentRow,
      completed_rows: progress.completedRows,
      failed_rows: progress.failedRows,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to update job progress:', error);
    // Don't throw - progress updates are non-critical
  }
}
```

### 4.2 Complete Job

```typescript
async function completeJob(
  jobId: string,
  status: 'completed' | 'failed' | 'cancelled'
): Promise<void> {
  const { error } = await supabase.db
    .from('execution_jobs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to complete job: ${error.message}`);
  }

  console.log(`Job ${jobId} completed with status: ${status}`);
}
```

### 4.3 Pause/Resume Job

```typescript
async function pauseJob(jobId: string): Promise<void> {
  const { error } = await supabase.db
    .from('execution_jobs')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .eq('status', 'running');

  if (error) {
    throw new Error(`Failed to pause job: ${error.message}`);
  }
}

async function resumeJob(jobId: string): Promise<void> {
  const { error } = await supabase.db
    .from('execution_jobs')
    .update({
      status: 'running',
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .eq('status', 'paused');

  if (error) {
    throw new Error(`Failed to resume job: ${error.message}`);
  }
}
```

### 4.4 Check for Cancellation

VDI should periodically check if a job has been cancelled by the user.

```typescript
async function isJobCancelled(jobId: string): Promise<boolean> {
  const { data, error } = await supabase.db
    .from('execution_jobs')
    .select('status')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('Failed to check job status:', error);
    return false;
  }

  return data?.status === 'cancelled';
}

// Usage in execution loop
async function executeSteps(job: ExecutionJob, steps: RecordedStep[]): Promise<void> {
  for (const step of steps) {
    // Check cancellation before each step
    if (await isJobCancelled(job.id)) {
      console.log('Job cancelled, stopping execution');
      throw new JobCancelledException(job.id);
    }

    await executeStep(step);
  }
}
```

---

## 5. Execution Results API

### 5.1 Create Result for Row

```typescript
// vdi-executor/src/services/result-service.ts

interface CreateResultParams {
  jobId: string;
  rowIndex: number;
  rowData: Record<string, string>;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
}

async function createResult(params: CreateResultParams): Promise<string> {
  const { data, error } = await supabase.db
    .from('execution_results')
    .insert({
      execution_job_id: params.jobId,
      row_index: params.rowIndex,
      row_data: params.rowData,
      status: params.status,
      steps_completed: 0,
      steps_failed: 0
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create result: ${error.message}`);
  }

  return data.id;
}
```

### 5.2 Update Result

```typescript
interface UpdateResultParams {
  resultId: string;
  status?: 'running' | 'passed' | 'failed' | 'skipped';
  stepsCompleted?: number;
  stepsFailed?: number;
  duration?: number;
  errorMessage?: string;
  errorStepNumber?: number;
  errorScreenshotUrl?: string;
  extractedData?: Record<string, string>;
}

async function updateResult(params: UpdateResultParams): Promise<void> {
  const { resultId, ...updateData } = params;

  // Convert camelCase to snake_case
  const snakeCaseData: Record<string, unknown> = {};
  
  if (updateData.status) snakeCaseData.status = updateData.status;
  if (updateData.stepsCompleted !== undefined) snakeCaseData.steps_completed = updateData.stepsCompleted;
  if (updateData.stepsFailed !== undefined) snakeCaseData.steps_failed = updateData.stepsFailed;
  if (updateData.duration !== undefined) snakeCaseData.duration = updateData.duration;
  if (updateData.errorMessage) snakeCaseData.error_message = updateData.errorMessage;
  if (updateData.errorStepNumber !== undefined) snakeCaseData.error_step_number = updateData.errorStepNumber;
  if (updateData.errorScreenshotUrl) snakeCaseData.error_screenshot_url = updateData.errorScreenshotUrl;
  if (updateData.extractedData) snakeCaseData.extracted_data = updateData.extractedData;

  const { error } = await supabase.db
    .from('execution_results')
    .update(snakeCaseData)
    .eq('id', resultId);

  if (error) {
    throw new Error(`Failed to update result: ${error.message}`);
  }
}
```

### 5.3 Complete Result with Summary

```typescript
interface CompleteResultParams {
  resultId: string;
  status: 'passed' | 'failed';
  stepsCompleted: number;
  stepsFailed: number;
  duration: number;
  errorMessage?: string;
  errorStepNumber?: number;
  errorScreenshotUrl?: string;
}

async function completeResult(params: CompleteResultParams): Promise<void> {
  const { error } = await supabase.db
    .from('execution_results')
    .update({
      status: params.status,
      steps_completed: params.stepsCompleted,
      steps_failed: params.stepsFailed,
      duration: params.duration,
      error_message: params.errorMessage,
      error_step_number: params.errorStepNumber,
      error_screenshot_url: params.errorScreenshotUrl
    })
    .eq('id', params.resultId);

  if (error) {
    throw new Error(`Failed to complete result: ${error.message}`);
  }
}
```

---

## 6. Execution Logs API

### 6.1 Insert Single Log

```typescript
// vdi-executor/src/services/log-service.ts

interface LogEntry {
  jobId: string;
  resultId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stepNumber?: number;
  stepLabel?: string;
  rowIndex?: number;
  metadata?: Record<string, unknown>;
  screenshotUrl?: string;
}

async function insertLog(entry: LogEntry): Promise<void> {
  const { error } = await supabase.db
    .from('execution_logs')
    .insert({
      execution_job_id: entry.jobId,
      execution_result_id: entry.resultId,
      level: entry.level,
      message: entry.message,
      step_number: entry.stepNumber,
      step_label: entry.stepLabel,
      row_index: entry.rowIndex,
      metadata: entry.metadata,
      screenshot_url: entry.screenshotUrl
    });

  if (error) {
    console.error('Failed to insert log:', error);
    // Don't throw - logging failures should not stop execution
  }
}
```

### 6.2 Batched Log Insertion

For performance, logs can be batched and inserted together.

```typescript
class LogBatcher {
  private buffer: LogEntry[] = [];
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 2000;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startFlushTimer();
  }

  add(entry: LogEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const insertData = entries.map(entry => ({
      execution_job_id: entry.jobId,
      execution_result_id: entry.resultId,
      level: entry.level,
      message: entry.message,
      step_number: entry.stepNumber,
      step_label: entry.stepLabel,
      row_index: entry.rowIndex,
      metadata: entry.metadata,
      screenshot_url: entry.screenshotUrl
    }));

    const { error } = await supabase.db
      .from('execution_logs')
      .insert(insertData);

    if (error) {
      console.error('Failed to batch insert logs:', error);
      // Re-add failed entries to buffer (with limit)
      if (this.buffer.length < 1000) {
        this.buffer.push(...entries);
      }
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

export const logBatcher = new LogBatcher();
```

### 6.3 Convenience Logging Functions

```typescript
class ExecutionLogger {
  private jobId: string;
  private resultId?: string;
  private rowIndex?: number;

  constructor(jobId: string, resultId?: string, rowIndex?: number) {
    this.jobId = jobId;
    this.resultId = resultId;
    this.rowIndex = rowIndex;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    logBatcher.add({
      jobId: this.jobId,
      resultId: this.resultId,
      rowIndex: this.rowIndex,
      level: 'debug',
      message,
      metadata
    });
  }

  info(message: string, stepNumber?: number, stepLabel?: string): void {
    logBatcher.add({
      jobId: this.jobId,
      resultId: this.resultId,
      rowIndex: this.rowIndex,
      level: 'info',
      message,
      stepNumber,
      stepLabel
    });
  }

  warn(message: string, stepNumber?: number): void {
    logBatcher.add({
      jobId: this.jobId,
      resultId: this.resultId,
      rowIndex: this.rowIndex,
      level: 'warn',
      message,
      stepNumber
    });
  }

  error(message: string, stepNumber?: number, screenshotUrl?: string): void {
    logBatcher.add({
      jobId: this.jobId,
      resultId: this.resultId,
      rowIndex: this.rowIndex,
      level: 'error',
      message,
      stepNumber,
      screenshotUrl
    });
  }

  stepSuccess(stepNumber: number, label: string, durationMs: number): void {
    this.info(`✅ Step ${stepNumber}: ${label} (${durationMs}ms)`, stepNumber, label);
  }

  stepFailed(stepNumber: number, label: string, error: string, screenshotUrl?: string): void {
    this.error(`❌ Step ${stepNumber}: ${label} - ${error}`, stepNumber, screenshotUrl);
  }

  healingAttempt(stepNumber: number): void {
    this.info(`🔧 Step ${stepNumber}: AI Healing triggered`, stepNumber);
  }

  healingSuccess(stepNumber: number, confidence: number): void {
    this.info(`✅ Step ${stepNumber}: AI Healing succeeded (${confidence}% confidence)`, stepNumber);
  }

  healingFailed(stepNumber: number, reason: string): void {
    this.warn(`⚠ Step ${stepNumber}: AI Healing failed - ${reason}`, stepNumber);
  }

  rowStart(rowIndex: number): void {
    this.info(`▶ Row ${rowIndex + 1}: Starting execution`);
  }

  rowComplete(rowIndex: number, durationMs: number): void {
    this.info(`✅ Row ${rowIndex + 1}: Completed in ${Math.round(durationMs / 1000)}s`);
  }

  rowFailed(rowIndex: number, error: string): void {
    this.error(`❌ Row ${rowIndex + 1}: Failed - ${error}`);
  }
}

// Usage
const logger = new ExecutionLogger(job.id, result.id, rowIndex);
logger.stepSuccess(1, 'Click Submit', 150);
```

---

## 7. Healing Logs API

### 7.1 Record Healing Attempt

```typescript
// vdi-executor/src/services/healing-service.ts

interface RecordHealingParams {
  recordingId: string;
  jobId: string;
  stepNumber: number;
  originalSelector: string;
  healedSelector: string;
  healingMethod: 'ai_vision' | 'text_match' | 'structural' | 'attribute_fallback';
  confidence: number;
  pageUrl?: string;
  pageTitle?: string;
  applied: boolean;
  success: boolean;
  screenshotUrl?: string;
}

async function recordHealing(params: RecordHealingParams): Promise<string> {
  const { data, error } = await supabase.db
    .from('healing_logs')
    .insert({
      recording_id: params.recordingId,
      execution_job_id: params.jobId,
      step_number: params.stepNumber,
      original_selector: params.originalSelector,
      healed_selector: params.healedSelector,
      healing_method: params.healingMethod,
      confidence: params.confidence,
      page_url: params.pageUrl,
      page_title: params.pageTitle,
      applied: params.applied,
      success: params.success,
      screenshot_url: params.screenshotUrl
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to record healing: ${error.message}`);
  }

  return data.id;
}
```

### 7.2 Check Healing Cache

Before calling Claude Vision, check if we have a cached healing for this scenario.

```typescript
interface CachedHealing {
  healedSelector: string;
  confidence: number;
  successRate: number;
}

async function checkHealingCache(
  recordingId: string,
  originalSelector: string,
  stepNumber: number
): Promise<CachedHealing | null> {
  // Look for successful healings in the past 24 hours
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data, error } = await supabase.db
    .from('healing_logs')
    .select('healed_selector, confidence, success')
    .eq('recording_id', recordingId)
    .eq('step_number', stepNumber)
    .eq('original_selector', originalSelector)
    .eq('applied', true)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Calculate success rate
  const totalAttempts = data.length;
  const successCount = data.filter(h => h.success).length;
  const successRate = successCount / totalAttempts;

  // Only use cache if success rate > 70%
  if (successRate < 0.7) {
    return null;
  }

  // Return most recent successful healing
  const latestSuccess = data.find(h => h.success);
  
  if (!latestSuccess) {
    return null;
  }

  return {
    healedSelector: latestSuccess.healed_selector,
    confidence: latestSuccess.confidence,
    successRate
  };
}
```

---

## 8. Recording Updates API

### 8.1 Update Step Selector (After Healing)

When AI healing succeeds, optionally update the recording with the healed selector.

```typescript
// vdi-executor/src/services/recording-updater.ts

interface UpdateStepSelectorParams {
  recordingId: string;
  stepNumber: number;
  newSelector: string;
  addToAlternatives?: boolean;
}

async function updateStepSelector(params: UpdateStepSelectorParams): Promise<void> {
  // Fetch current recording
  const { data: recording, error: fetchError } = await supabase.db
    .from('recordings')
    .select('steps')
    .eq('id', params.recordingId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch recording: ${fetchError.message}`);
  }

  const steps = recording.steps as RecordedStep[];
  
  // Find the step
  const stepIndex = steps.findIndex(s => s.stepNumber === params.stepNumber);
  
  if (stepIndex === -1) {
    throw new Error(`Step ${params.stepNumber} not found`);
  }

  const step = steps[stepIndex];

  if (params.addToAlternatives) {
    // Add healed selector to alternatives list
    const alternatives = step.alternatives || [];
    if (!alternatives.includes(params.newSelector)) {
      alternatives.push(params.newSelector);
    }
    step.alternatives = alternatives;
  } else {
    // Replace primary selector
    const oldSelector = step.selector;
    step.selector = params.newSelector;
    
    // Keep old selector as first alternative
    const alternatives = step.alternatives || [];
    if (oldSelector && !alternatives.includes(oldSelector)) {
      alternatives.unshift(oldSelector);
    }
    step.alternatives = alternatives;
  }

  // Update recording
  steps[stepIndex] = step;

  const { error: updateError } = await supabase.db
    .from('recordings')
    .update({
      steps,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.recordingId);

  if (updateError) {
    throw new Error(`Failed to update recording: ${updateError.message}`);
  }
}
```

---

## 9. Screenshot Storage API

### 9.1 Upload Screenshot

```typescript
// vdi-executor/src/services/storage-service.ts

interface UploadScreenshotParams {
  jobId: string;
  stepNumber: number;
  rowIndex: number;
  imageBuffer: Buffer;
  purpose: 'error' | 'healing' | 'step';
}

async function uploadScreenshot(params: UploadScreenshotParams): Promise<string> {
  const fileName = `${params.jobId}/${params.rowIndex}/step-${params.stepNumber}-${params.purpose}-${Date.now()}.png`;

  const { data, error } = await supabase.storage
    .from('screenshots')
    .upload(fileName, params.imageBuffer, {
      contentType: 'image/png',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload screenshot: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(data.path);

  return publicUrl;
}
```

### 9.2 Cleanup Old Screenshots

```typescript
// Clean up screenshots older than 7 days
async function cleanupOldScreenshots(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // List all files in bucket
  const { data: files, error: listError } = await supabase.storage
    .from('screenshots')
    .list('', { limit: 1000 });

  if (listError || !files) {
    console.error('Failed to list screenshots:', listError);
    return 0;
  }

  // Filter old files (check metadata.lastModified)
  const oldFiles = files.filter(file => {
    const lastModified = new Date(file.metadata?.lastModified || file.created_at);
    return lastModified < sevenDaysAgo;
  });

  if (oldFiles.length === 0) {
    return 0;
  }

  // Delete old files
  const { error: deleteError } = await supabase.storage
    .from('screenshots')
    .remove(oldFiles.map(f => f.name));

  if (deleteError) {
    console.error('Failed to delete old screenshots:', deleteError);
    return 0;
  }

  return oldFiles.length;
}
```

---

## 10. VDI Metrics API

### 10.1 Report Metrics

VDI instances periodically report their health metrics.

```typescript
// vdi-executor/src/services/metrics-service.ts

interface VdiMetrics {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  activeJobs: number;
  completedJobs1h: number;
  failedJobs1h: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

async function reportMetrics(metrics: VdiMetrics): Promise<void> {
  const instanceId = supabase.getInstanceId();
  
  const { error } = await supabase.db
    .from('vdi_metrics')
    .upsert({
      instance_id: instanceId,
      region: process.env.VDI_REGION || 'unknown',
      cpu_percent: metrics.cpuPercent,
      memory_percent: metrics.memoryPercent,
      disk_percent: metrics.diskPercent,
      active_jobs: metrics.activeJobs,
      completed_jobs_1h: metrics.completedJobs1h,
      failed_jobs_1h: metrics.failedJobs1h,
      status: metrics.status,
      last_heartbeat: new Date().toISOString()
    }, {
      onConflict: 'instance_id'
    });

  if (error) {
    console.error('Failed to report metrics:', error);
  }
}
```

### 10.2 Heartbeat Loop

```typescript
class MetricsReporter {
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private intervalId: NodeJS.Timeout | null = null;
  private activeJobs = 0;
  private completedJobs1h = 0;
  private failedJobs1h = 0;

  start(): void {
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);

    // Initial heartbeat
    this.sendHeartbeat();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  incrementActive(): void {
    this.activeJobs++;
  }

  decrementActive(): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1);
  }

  recordCompleted(): void {
    this.completedJobs1h++;
    setTimeout(() => {
      this.completedJobs1h = Math.max(0, this.completedJobs1h - 1);
    }, 3600000); // Decrement after 1 hour
  }

  recordFailed(): void {
    this.failedJobs1h++;
    setTimeout(() => {
      this.failedJobs1h = Math.max(0, this.failedJobs1h - 1);
    }, 3600000);
  }

  private async sendHeartbeat(): Promise<void> {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Rough estimate
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (memoryPercent > 90 || cpuPercent > 90) {
      status = 'unhealthy';
    } else if (memoryPercent > 70 || cpuPercent > 70) {
      status = 'degraded';
    }

    await reportMetrics({
      cpuPercent,
      memoryPercent,
      diskPercent: 0, // Would need fs stats
      activeJobs: this.activeJobs,
      completedJobs1h: this.completedJobs1h,
      failedJobs1h: this.failedJobs1h,
      status
    });
  }
}

export const metricsReporter = new MetricsReporter();
```

---

## 11. Error Handling

### 11.1 Error Types

```typescript
// vdi-executor/src/errors.ts

export class VdiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'VdiError';
  }
}

export class JobClaimError extends VdiError {
  constructor(jobId: string) {
    super(`Failed to claim job ${jobId}`, 'JOB_CLAIM_FAILED', true);
  }
}

export class RecordingNotFoundError extends VdiError {
  constructor(recordingId: string) {
    super(`Recording ${recordingId} not found`, 'RECORDING_NOT_FOUND', false);
  }
}

export class ElementNotFoundError extends VdiError {
  constructor(selector: string, stepNumber: number) {
    super(`Element not found: ${selector} (step ${stepNumber})`, 'ELEMENT_NOT_FOUND', false);
  }
}

export class NavigationError extends VdiError {
  constructor(url: string, reason: string) {
    super(`Navigation to ${url} failed: ${reason}`, 'NAVIGATION_FAILED', true);
  }
}

export class HealingError extends VdiError {
  constructor(stepNumber: number, reason: string) {
    super(`Healing failed for step ${stepNumber}: ${reason}`, 'HEALING_FAILED', false);
  }
}

export class JobCancelledException extends VdiError {
  constructor(jobId: string) {
    super(`Job ${jobId} was cancelled`, 'JOB_CANCELLED', false);
  }
}
```

### 11.2 Retry Logic

```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (error instanceof VdiError && !error.retryable) {
        throw error;
      }

      if (attempt < options.maxRetries) {
        const delay = Math.min(
          options.baseDelayMs * Math.pow(2, attempt),
          options.maxDelayMs
        );
        console.log(`Retry ${attempt + 1}/${options.maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

---

## 12. Rate Limiting & Performance

### 12.1 Supabase Rate Limits

| Operation | Limit | Strategy |
|-----------|-------|----------|
| Reads | 1000/sec | Batch queries |
| Writes | 1000/sec | Batch logs |
| Storage uploads | 10 MB/sec | Compress images |
| Realtime connections | 200 | Pool connections |

### 12.2 Batch Operations

```typescript
// Batch insert for bulk operations
async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  records: T[],
  batchSize: number = 100
): Promise<void> {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error } = await supabase.db
      .from(table)
      .insert(batch);

    if (error) {
      console.error(`Batch insert failed at index ${i}:`, error);
      throw error;
    }
  }
}
```

### 12.3 Connection Pooling

```typescript
// The Supabase client handles connection pooling internally
// For high-throughput scenarios, consider:

const HIGH_PERFORMANCE_CONFIG = {
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'vdi-executor'
    }
  },
  // Supabase handles pooling, but we can configure timeouts
  realtime: {
    timeout: 30000
  }
};
```

### 12.4 Performance Checklist

```
☐ Batch log insertions (50 records per batch)
☐ Compress screenshots before upload
☐ Cache healing results (24-hour TTL)
☐ Poll with exponential backoff
☐ Check cancellation every 10 steps, not every step
☐ Use upsert for metrics (single record per instance)
☐ Limit result payload size (no full page HTML)
☐ Stream large files instead of loading into memory
```

---

## Document End

This API contract ensures reliable, performant communication between the VDI Executor and Supabase, supporting high-throughput execution while maintaining data integrity.
