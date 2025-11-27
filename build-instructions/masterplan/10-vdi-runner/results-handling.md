# Results Handling
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Metrics Calculation
3. Job Status Update
4. Log Aggregation
5. Screenshot Collection
6. Execution Summary
7. Database Schema
8. Error Result Handling
9. Performance Tracking
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Results Handling aggregates execution data, calculates metrics, and persists final job status and results to Supabase for portal display.

### 1.2 Results Flow
```
1. Execution completes
   ↓
2. Calculate metrics
   - Total steps executed
   - Passed/failed counts
   - Success rate
   - Duration
   - Average time per step
   ↓
3. Aggregate logs
   - Fetch all logs for job
   - Group by level
   - Calculate error distribution
   ↓
4. Collect screenshots
   - List all error screenshots
   - Generate signed URLs
   ↓
5. Generate summary
   - Create execution_results record
   - Include all metrics
   ↓
6. Update job status
   - Set to 'completed' or 'failed'
   - Add end timestamp
   - Link to results
   ↓
7. Notify portal
   - Trigger Realtime event
   - Portal refreshes UI
```

### 1.3 Key Responsibilities

- Calculate execution metrics (passed, failed, duration)
- Determine final job status (completed, failed)
- Aggregate logs by level and count
- Collect screenshot references
- Generate execution summary
- Update database atomically
- Trigger notifications

---

## 2. Metrics Calculation

### 2.1 Core Metrics
```typescript
interface ExecutionMetrics {
  // Step Metrics
  totalSteps: number;          // Total steps executed
  passedSteps: number;         // Successfully executed
  failedSteps: number;         // Failed execution
  skippedSteps: number;        // Skipped (no CSV value)
  successRate: number;         // (passed / total) × 100

  // Row Metrics
  totalRows: number;           // CSV rows processed
  completedRows: number;       // Rows with all steps passed
  failedRows: number;          // Rows with any step failed

  // Time Metrics
  totalDuration: number;       // Total execution time (ms)
  avgStepDuration: number;     // Average time per step (ms)
  avgRowDuration: number;      // Average time per row (ms)

  // Error Metrics
  errorCount: number;          // Total errors encountered
  timeoutCount: number;        // Steps that timed out
  elementNotFoundCount: number; // Element finding failures
}
```

### 2.2 Metrics Calculator
```typescript
// src/results.ts
export class ResultsAggregator {
  async calculateMetrics(jobId: string): Promise<ExecutionMetrics> {
    // Fetch all logs for this job
    const { data: logs } = await this.supabase
      .from('execution_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('timestamp', { ascending: true });

    if (!logs || logs.length === 0) {
      throw new Error('No logs found for job');
    }

    // Parse logs to extract metrics
    let passedSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;
    let errorCount = 0;
    let timeoutCount = 0;
    let elementNotFoundCount = 0;

    const rowResults: Map<number, { passed: number; failed: number }> = new Map();

    logs.forEach(log => {
      // Count step results
      if (log.message.includes('SUCCESS')) {
        passedSteps++;
        
        if (log.row_number) {
          const rowStat = rowResults.get(log.row_number) || { passed: 0, failed: 0 };
          rowStat.passed++;
          rowResults.set(log.row_number, rowStat);
        }
      } else if (log.message.includes('ERROR') || log.message.includes('FAILED')) {
        failedSteps++;
        errorCount++;

        if (log.row_number) {
          const rowStat = rowResults.get(log.row_number) || { passed: 0, failed: 0 };
          rowStat.failed++;
          rowResults.set(log.row_number, rowStat);
        }

        // Categorize errors
        if (log.message.includes('Timeout')) {
          timeoutCount++;
        } else if (log.message.includes('Element not found')) {
          elementNotFoundCount++;
        }
      } else if (log.message.includes('skipped')) {
        skippedSteps++;
      }
    });

    // Calculate row statistics
    let completedRows = 0;
    let failedRows = 0;

    rowResults.forEach(stat => {
      if (stat.failed === 0) {
        completedRows++;
      } else {
        failedRows++;
      }
    });

    // Get timing data
    const firstLog = logs[0];
    const lastLog = logs[logs.length - 1];
    const totalDuration = new Date(lastLog.timestamp).getTime() - 
                          new Date(firstLog.timestamp).getTime();

    const totalSteps = passedSteps + failedSteps + skippedSteps;
    const totalRows = rowResults.size || 1;

    return {
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      successRate: totalSteps > 0 ? (passedSteps / totalSteps) * 100 : 0,
      totalRows,
      completedRows,
      failedRows,
      totalDuration,
      avgStepDuration: totalSteps > 0 ? totalDuration / totalSteps : 0,
      avgRowDuration: totalRows > 0 ? totalDuration / totalRows : 0,
      errorCount,
      timeoutCount,
      elementNotFoundCount
    };
  }
}
```

---

## 3. Job Status Update

### 3.1 Final Status Determination
```typescript
function determineFinalStatus(metrics: ExecutionMetrics): JobStatus {
  // Job failed if any steps failed
  if (metrics.failedSteps > 0) {
    return 'failed';
  }

  // Job completed if all steps passed
  if (metrics.passedSteps === metrics.totalSteps) {
    return 'completed';
  }

  // Edge case: Some steps skipped but none failed
  if (metrics.skippedSteps > 0 && metrics.failedSteps === 0) {
    return 'completed';
  }

  // Default to failed if uncertain
  return 'failed';
}
```

### 3.2 Job Update Transaction
```typescript
async updateJobWithResults(
  jobId: string,
  metrics: ExecutionMetrics
): Promise<void> {
  const finalStatus = determineFinalStatus(metrics);

  const { error } = await this.supabase
    .from('execution_jobs')
    .update({
      status: finalStatus,
      ended_at: new Date().toISOString(),
      total_steps: metrics.totalSteps,
      passed_steps: metrics.passedSteps,
      failed_steps: metrics.failedSteps,
      duration: metrics.totalDuration,
      success_rate: metrics.successRate
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }

  console.log(`✅ Job ${jobId} updated with status: ${finalStatus}`);
}
```

---

## 4. Log Aggregation

### 4.1 Log Summary
```typescript
interface LogSummary {
  totalLogs: number;
  infoCount: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  logsByLevel: {
    info: ExecutionLog[];
    success: ExecutionLog[];
    warning: ExecutionLog[];
    error: ExecutionLog[];
  };
  errorMessages: string[];   // Unique error messages
  mostCommonError?: string;  // Most frequently occurring error
}

async aggregateLogs(jobId: string): Promise<LogSummary> {
  const { data: logs } = await this.supabase
    .from('execution_logs')
    .select('*')
    .eq('job_id', jobId)
    .order('timestamp', { ascending: true });

  if (!logs) {
    return {
      totalLogs: 0,
      infoCount: 0,
      successCount: 0,
      warningCount: 0,
      errorCount: 0,
      logsByLevel: { info: [], success: [], warning: [], error: [] },
      errorMessages: []
    };
  }

  const summary: LogSummary = {
    totalLogs: logs.length,
    infoCount: 0,
    successCount: 0,
    warningCount: 0,
    errorCount: 0,
    logsByLevel: {
      info: [],
      success: [],
      warning: [],
      error: []
    },
    errorMessages: []
  };

  const errorFrequency = new Map<string, number>();

  logs.forEach(log => {
    // Count by level
    summary[`${log.level}Count`]++;
    summary.logsByLevel[log.level].push(log);

    // Collect error messages
    if (log.level === 'error') {
      const errorMsg = log.message.split(':').pop()?.trim() || log.message;
      summary.errorMessages.push(errorMsg);

      // Track frequency
      errorFrequency.set(errorMsg, (errorFrequency.get(errorMsg) || 0) + 1);
    }
  });

  // Find most common error
  let maxCount = 0;
  errorFrequency.forEach((count, msg) => {
    if (count > maxCount) {
      maxCount = count;
      summary.mostCommonError = msg;
    }
  });

  return summary;
}
```

---

## 5. Screenshot Collection

### 5.1 Screenshot References
```typescript
interface ScreenshotReference {
  fileName: string;
  stepNumber: number;
  url: string;              // Signed URL for download
  timestamp: string;
}

async collectScreenshots(jobId: string): Promise<ScreenshotReference[]> {
  // List all screenshots for this job
  const { data: files, error } = await this.supabase.storage
    .from('screenshots')
    .list('', {
      search: jobId
    });

  if (error || !files) {
    console.warn('No screenshots found for job:', jobId);
    return [];
  }

  // Generate signed URLs
  const screenshots: ScreenshotReference[] = [];

  for (const file of files) {
    // Extract step number from filename: jobId_step-5_timestamp.png
    const match = file.name.match(/step-(\d+)/);
    const stepNumber = match ? parseInt(match[1]) : 0;

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrl } = await this.supabase.storage
      .from('screenshots')
      .createSignedUrl(file.name, 3600);

    if (signedUrl) {
      screenshots.push({
        fileName: file.name,
        stepNumber,
        url: signedUrl.signedUrl,
        timestamp: file.created_at
      });
    }
  }

  return screenshots.sort((a, b) => a.stepNumber - b.stepNumber);
}
```

---

## 6. Execution Summary

### 6.1 Summary Generation
```typescript
interface ExecutionSummary {
  jobId: string;
  status: JobStatus;
  metrics: ExecutionMetrics;
  logSummary: LogSummary;
  screenshots: ScreenshotReference[];
  startTime: string;
  endTime: string;
  duration: number;
}

async generateExecutionSummary(jobId: string): Promise<ExecutionSummary> {
  // Fetch job details
  const { data: job } = await this.supabase
    .from('execution_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job) {
    throw new Error('Job not found');
  }

  // Calculate all metrics
  const metrics = await this.calculateMetrics(jobId);
  const logSummary = await this.aggregateLogs(jobId);
  const screenshots = await this.collectScreenshots(jobId);

  const summary: ExecutionSummary = {
    jobId,
    status: job.status,
    metrics,
    logSummary,
    screenshots,
    startTime: job.started_at,
    endTime: job.ended_at,
    duration: metrics.totalDuration
  };

  return summary;
}
```

### 6.2 Summary Persistence
```typescript
async saveExecutionSummary(summary: ExecutionSummary): Promise<void> {
  const { error } = await this.supabase
    .from('execution_results')
    .insert({
      job_id: summary.jobId,
      status: summary.status,
      metrics: summary.metrics,
      log_summary: summary.logSummary,
      screenshots: summary.screenshots,
      start_time: summary.startTime,
      end_time: summary.endTime,
      duration: summary.duration,
      created_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Failed to save execution summary: ${error.message}`);
  }

  console.log(`✅ Execution summary saved for job: ${summary.jobId}`);
}
```

---

## 7. Database Schema

### 7.1 execution_results Table
```sql
CREATE TABLE execution_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES execution_jobs(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL,
  
  -- Metrics (JSONB for flexibility)
  metrics JSONB NOT NULL,
  
  -- Log summary
  log_summary JSONB,
  
  -- Screenshot references
  screenshots JSONB,
  
  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL,  -- Milliseconds
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_execution_results_job_id ON execution_results(job_id);
CREATE INDEX idx_execution_results_status ON execution_results(status);
```

### 7.2 Example Result Record
```json
{
  "id": "result-uuid",
  "job_id": "job-uuid",
  "status": "completed",
  "metrics": {
    "totalSteps": 50,
    "passedSteps": 48,
    "failedSteps": 2,
    "skippedSteps": 0,
    "successRate": 96,
    "totalRows": 10,
    "completedRows": 8,
    "failedRows": 2,
    "totalDuration": 125000,
    "avgStepDuration": 2500,
    "avgRowDuration": 12500,
    "errorCount": 2,
    "timeoutCount": 1,
    "elementNotFoundCount": 1
  },
  "log_summary": {
    "totalLogs": 120,
    "infoCount": 60,
    "successCount": 48,
    "warningCount": 10,
    "errorCount": 2,
    "errorMessages": [
      "Element not found",
      "Timeout exceeded"
    ],
    "mostCommonError": "Element not found"
  },
  "screenshots": [
    {
      "fileName": "job-uuid_step-25_1234567890.png",
      "stepNumber": 25,
      "url": "https://storage.supabase.co/signed/...",
      "timestamp": "2025-11-25T12:34:56Z"
    }
  ],
  "start_time": "2025-11-25T12:30:00Z",
  "end_time": "2025-11-25T12:32:05Z",
  "duration": 125000
}
```

---

## 8. Error Result Handling

### 8.1 Partial Results
```typescript
async handlePartialExecution(
  jobId: string,
  error: Error
): Promise<void> {
  console.error(`❌ Job ${jobId} failed:`, error.message);

  // Calculate metrics up to failure point
  const metrics = await this.calculateMetrics(jobId);

  // Update job with partial results
  await this.supabase
    .from('execution_jobs')
    .update({
      status: 'failed',
      ended_at: new Date().toISOString(),
      total_steps: metrics.totalSteps,
      passed_steps: metrics.passedSteps,
      failed_steps: metrics.failedSteps,
      error_message: error.message
    })
    .eq('id', jobId);

  // Save partial summary
  const summary = await this.generateExecutionSummary(jobId);
  await this.saveExecutionSummary(summary);
}
```

### 8.2 Critical Failure Handling
```typescript
async handleCriticalFailure(
  jobId: string,
  error: Error,
  stage: 'browser_launch' | 'navigation' | 'execution'
): Promise<void> {
  const errorDetails = {
    stage,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  // Log critical failure
  await this.supabase
    .from('execution_logs')
    .insert({
      job_id: jobId,
      level: 'error',
      message: `CRITICAL FAILURE at ${stage}: ${error.message}`,
      metadata: errorDetails,
      timestamp: new Date().toISOString()
    });

  // Mark job as failed
  await this.supabase
    .from('execution_jobs')
    .update({
      status: 'failed',
      ended_at: new Date().toISOString(),
      error_message: `Critical failure: ${error.message}`
    })
    .eq('id', jobId);
}
```

---

## 9. Performance Tracking

### 9.1 Performance Metrics
```typescript
interface PerformanceMetrics {
  browserLaunchTime: number;   // Time to launch browser (ms)
  navigationTime: number;       // Time to navigate (ms)
  stepExecutionTime: number;    // Total step execution (ms)
  logWriteTime: number;         // Time spent writing logs (ms)
  screenshotTime: number;       // Time capturing screenshots (ms)
  resultsAggregationTime: number; // Time calculating results (ms)
}

export class PerformanceTracker {
  private timers: Map<string, number> = new Map();

  startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) {
      return 0;
    }

    const duration = Date.now() - start;
    this.timers.delete(label);
    return duration;
  }

  async savePerformanceMetrics(
    jobId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    await this.supabase
      .from('execution_performance')
      .insert({
        job_id: jobId,
        metrics,
        timestamp: new Date().toISOString()
      });
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('ResultsAggregator', () => {
  it('calculates metrics correctly', async () => {
    const mockLogs = [
      { level: 'success', message: 'Step 1 - SUCCESS' },
      { level: 'success', message: 'Step 2 - SUCCESS' },
      { level: 'error', message: 'Step 3 - ERROR: Element not found' }
    ];

    mockSupabase.from().select().eq().order.mockResolvedValue({ data: mockLogs });

    const metrics = await aggregator.calculateMetrics('job-123');

    expect(metrics.passedSteps).toBe(2);
    expect(metrics.failedSteps).toBe(1);
    expect(metrics.successRate).toBe(66.67);
  });

  it('determines final status correctly', () => {
    const metrics: ExecutionMetrics = {
      totalSteps: 10,
      passedSteps: 10,
      failedSteps: 0,
      // ...
    };

    const status = determineFinalStatus(metrics);

    expect(status).toBe('completed');
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Results Handling', () => {
  it('saves execution summary to database', async () => {
    const jobId = 'test-job';

    // Run job
    await executor.executeJob(mockJob);

    // Generate and save summary
    const summary = await aggregator.generateExecutionSummary(jobId);
    await aggregator.saveExecutionSummary(summary);

    // Verify saved
    const { data: result } = await supabase
      .from('execution_results')
      .select('*')
      .eq('job_id', jobId)
      .single();

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.metrics.totalSteps).toBeGreaterThan(0);
  });
});
```

---

## Summary

Results Handling provides:
- ✅ **Metrics calculation** (10 key metrics: steps, rows, time, errors)
- ✅ **Job status determination** based on pass/fail counts
- ✅ **Atomic database updates** with transaction safety
- ✅ **Log aggregation** by level with error frequency analysis
- ✅ **Screenshot collection** with signed URL generation
- ✅ **Execution summary** with complete result data
- ✅ **Database schema** for execution_results table
- ✅ **Error result handling** with partial results and critical failures
- ✅ **Performance tracking** with detailed timing metrics
- ✅ **Testing strategy** with unit and integration tests

This provides complete results aggregation and persistence for portal display.
