# Polling Strategy
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Basic Polling Loop
3. Exponential Backoff
4. Atomic Job Claiming
5. Optimistic Locking
6. Query Optimization
7. Realtime Alternative
8. Error Handling
9. Monitoring
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Polling Strategy ensures reliable, efficient job discovery and claiming from Supabase with proper concurrency control to prevent duplicate execution.

### 1.2 Key Requirements

- **Responsiveness**: Pick up new jobs within 5-10 seconds
- **Efficiency**: Minimize unnecessary database queries
- **Concurrency**: Prevent multiple workers claiming same job
- **Scalability**: Support multiple VDI instances polling simultaneously
- **Reliability**: Continue working during Supabase hiccups

### 1.3 Design Goals
```
1. LOW LATENCY
   - 5 second base poll interval
   - Instant pickup for queued jobs
   
2. LOW OVERHEAD
   - Exponential backoff when queue empty
   - Efficient SQL queries (indexed columns)
   
3. HIGH RELIABILITY
   - Atomic claiming with optimistic locking
   - Retry logic for transient failures
   
4. OBSERVABILITY
   - Log all polling attempts
   - Track claim success/failure rates
```

---

## 2. Basic Polling Loop

### 2.1 Simple Implementation
```typescript
// src/poller.ts
import { createClient } from '@supabase/supabase-js';

export class JobPoller {
  private supabase;
  private pollInterval: number;
  private isRunning: boolean = false;

  constructor(config: PollerConfig) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.pollInterval = config.pollInterval || 5000;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🔄 Job poller started');

    while (this.isRunning) {
      try {
        await this.pollOnce();
      } catch (error) {
        console.error('❌ Polling error:', error);
      }

      await this.sleep(this.pollInterval);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('⏸️  Job poller stopped');
  }

  private async pollOnce(): Promise<void> {
    // Query for queued jobs
    const { data: jobs, error } = await this.supabase
      .from('execution_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      throw error;
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log(`📥 Found job ${job.id}`);

      // Attempt to claim job
      const claimed = await this.claimJob(job);

      if (claimed) {
        console.log(`✅ Claimed job ${job.id}`);
        await this.executeJob(job);
      } else {
        console.log(`⚠️  Job ${job.id} already claimed`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2.2 Configuration
```typescript
interface PollerConfig {
  pollInterval?: number;          // Base interval (default: 5000ms)
  maxPollInterval?: number;       // Max backoff (default: 30000ms)
  backoffMultiplier?: number;     // Backoff factor (default: 1.5)
  workerPool: WorkerPool;         // Worker pool reference
}
```

---

## 3. Exponential Backoff

### 3.1 Purpose

When no jobs are queued, reduce polling frequency to save resources. When jobs appear, reset to base interval for fast pickup.

### 3.2 Implementation
```typescript
export class AdaptivePoller extends JobPoller {
  private currentInterval: number;
  private maxInterval: number;
  private backoffMultiplier: number;
  private consecutiveEmptyPolls: number = 0;

  constructor(config: PollerConfig) {
    super(config);
    this.currentInterval = config.pollInterval || 5000;
    this.maxInterval = config.maxPollInterval || 30000;
    this.backoffMultiplier = config.backoffMultiplier || 1.5;
  }

  private async pollOnce(): Promise<void> {
    const { data: jobs, error } = await this.supabase
      .from('execution_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      throw error;
    }

    if (jobs && jobs.length > 0) {
      // Jobs found - reset to base interval
      this.currentInterval = this.pollInterval;
      this.consecutiveEmptyPolls = 0;

      const job = jobs[0];
      const claimed = await this.claimJob(job);

      if (claimed) {
        await this.executeJob(job);
      }
    } else {
      // No jobs - increase backoff
      this.consecutiveEmptyPolls++;
      this.currentInterval = Math.min(
        this.currentInterval * this.backoffMultiplier,
        this.maxInterval
      );

      console.log(
        `💤 No jobs (${this.consecutiveEmptyPolls} empty polls). ` +
        `Next poll in ${this.currentInterval}ms`
      );
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.pollOnce();
      } catch (error) {
        console.error('❌ Polling error:', error);
      }

      // Use adaptive interval
      await this.sleep(this.currentInterval);
    }
  }
}
```

### 3.3 Backoff Progression
```
Poll 1: 5s   (base)
Poll 2: 5s   (base)
Poll 3: 7.5s (first backoff: 5 * 1.5)
Poll 4: 11.25s
Poll 5: 16.87s
Poll 6: 25.31s
Poll 7: 30s  (capped at max)
Poll 8: 30s  (stays at max)

[Job appears]
Poll 9: 5s   (reset to base)
```

---

## 4. Atomic Job Claiming

### 4.1 Race Condition Problem
```
Time    Worker A                    Worker B
T0      Query: Found job #42        Query: Found job #42
T1      Claim job #42               Claim job #42
T2      Execute job #42             Execute job #42
        
Result: ❌ Job executed twice (duplicate work)
```

### 4.2 Optimistic Locking Solution
```typescript
private async claimJob(job: ExecutionJob): Promise<boolean> {
  const workerId = process.env.WORKER_ID || `worker-${Date.now()}`;

  // Atomic claim using WHERE clause
  const { data, error } = await this.supabase
    .from('execution_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      worker_id: workerId
    })
    .eq('id', job.id)
    .eq('status', 'queued')  // ← CRITICAL: Only update if still queued
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows updated (already claimed)
      return false;
    }
    throw error;
  }

  return !!data;
}
```

### 4.3 How It Works
```
PostgreSQL executes:

UPDATE execution_jobs
SET status = 'running', started_at = NOW(), worker_id = 'worker-123'
WHERE id = '42'
  AND status = 'queued';  -- Only succeeds if still queued

If another worker already updated status to 'running':
- This UPDATE affects 0 rows
- Supabase returns error code PGRST116 (no rows)
- claimJob() returns false
- Worker skips this job
```

---

## 5. Optimistic Locking

### 5.1 Version-Based Locking (Alternative)
```typescript
// Add version column to execution_jobs
CREATE TABLE execution_jobs (
  id UUID PRIMARY KEY,
  status TEXT,
  version INTEGER DEFAULT 1,
  ...
);

// Claim with version check
const { data } = await supabase
  .from('execution_jobs')
  .update({
    status: 'running',
    version: job.version + 1
  })
  .eq('id', job.id)
  .eq('version', job.version)  // Only if version matches
  .select()
  .single();

if (!data) {
  // Version mismatch (concurrent update)
  return false;
}
```

### 5.2 Timestamp-Based Locking (Phase 2)
```typescript
// Use updated_at for concurrency control
const { data } = await supabase
  .from('execution_jobs')
  .update({
    status: 'running',
    updated_at: new Date().toISOString()
  })
  .eq('id', job.id)
  .eq('updated_at', job.updated_at)  // Only if not modified
  .select()
  .single();
```

---

## 6. Query Optimization

### 6.1 Index Strategy
```sql
-- Essential indexes for fast polling
CREATE INDEX idx_execution_jobs_status ON execution_jobs(status);
CREATE INDEX idx_execution_jobs_created_at ON execution_jobs(created_at);

-- Composite index for polling query
CREATE INDEX idx_execution_jobs_status_created 
ON execution_jobs(status, created_at);
```

### 6.2 Query Plan Analysis
```sql
-- Verify index usage
EXPLAIN ANALYZE
SELECT *
FROM execution_jobs
WHERE status = 'queued'
ORDER BY created_at ASC
LIMIT 1;

-- Expected output:
-- Index Scan using idx_execution_jobs_status_created
-- Planning Time: 0.1 ms
-- Execution Time: 0.5 ms
```

### 6.3 Optimized Query
```typescript
// Select only needed columns
const { data: jobs } = await this.supabase
  .from('execution_jobs')
  .select('id, recording_id, csv_data, config')  // Not *
  .eq('status', 'queued')
  .order('created_at', { ascending: true })
  .limit(1);
```

---

## 7. Realtime Alternative

### 7.1 Supabase Realtime (Push-Based)
```typescript
export class RealtimePoller {
  private subscription: RealtimeChannel;

  async start(): Promise<void> {
    // Subscribe to INSERT events on execution_jobs
    this.subscription = this.supabase
      .channel('execution_jobs_insert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'execution_jobs',
          filter: 'status=eq.queued'
        },
        async (payload) => {
          const job = payload.new as ExecutionJob;
          console.log(`📨 New job received: ${job.id}`);

          const claimed = await this.claimJob(job);
          if (claimed) {
            await this.executeJob(job);
          }
        }
      )
      .subscribe();

    console.log('📡 Realtime listener started');
  }

  async stop(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
    }
  }
}
```

### 7.2 Hybrid Approach (Recommended)
```typescript
export class HybridPoller {
  private realtimePoller: RealtimePoller;
  private adaptivePoller: AdaptivePoller;

  async start(): Promise<void> {
    // Primary: Realtime for instant pickup
    this.realtimePoller.start();

    // Fallback: Polling every 30 seconds
    // Catches jobs if Realtime connection drops
    this.adaptivePoller.start({
      pollInterval: 30000,
      maxPollInterval: 60000
    });
  }
}
```

### 7.3 Comparison

| Method | Latency | Overhead | Reliability | Complexity |
|--------|---------|----------|-------------|------------|
| **Polling** | 5-30s | Low (queries) | High | Low |
| **Realtime** | <1s | Low (WebSocket) | Medium | Medium |
| **Hybrid** | <1s | Medium | Very High | High |

**Recommendation:** Start with Polling (Phase 1), add Realtime (Phase 2).

---

## 8. Error Handling

### 8.1 Transient Errors
```typescript
private async pollOnce(): Promise<void> {
  try {
    const { data: jobs, error } = await this.supabase
      .from('execution_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      if (this.isTransientError(error)) {
        console.warn('⚠️  Transient error, will retry:', error.message);
        return;
      }
      throw error;
    }

    // Process jobs...
  } catch (error) {
    console.error('❌ Fatal polling error:', error);
    
    // Don't stop polling - continue in next iteration
    // Log to external monitoring
    await this.logError(error);
  }
}

private isTransientError(error: any): boolean {
  const transientCodes = [
    'ECONNREFUSED',   // Connection refused
    'ETIMEDOUT',      // Timeout
    'ENOTFOUND',      // DNS lookup failed
    'PGRST301'        // JWT expired
  ];

  return transientCodes.includes(error.code);
}
```

### 8.2 Retry with Exponential Backoff
```typescript
private async pollWithRetry(maxRetries: number = 3): Promise<void> {
  let attempt = 1;

  while (attempt <= maxRetries) {
    try {
      await this.pollOnce();
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Give up
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.warn(
        `⚠️  Retry ${attempt}/${maxRetries} after ${delay}ms:`,
        error.message
      );

      await this.sleep(delay);
      attempt++;
    }
  }
}
```

---

## 9. Monitoring

### 9.1 Polling Metrics
```typescript
interface PollingMetrics {
  pollsPerMinute: number;
  jobsFoundPerPoll: number;
  claimSuccessRate: number;
  avgClaimLatency: number;
  consecutiveErrors: number;
}

export class MonitoredPoller extends AdaptivePoller {
  private metrics: PollingMetrics = {
    pollsPerMinute: 0,
    jobsFoundPerPoll: 0,
    claimSuccessRate: 0,
    avgClaimLatency: 0,
    consecutiveErrors: 0
  };

  private pollCount: number = 0;
  private claimAttempts: number = 0;
  private claimSuccesses: number = 0;

  private async pollOnce(): Promise<void> {
    const startTime = Date.now();
    this.pollCount++;

    try {
      const { data: jobs } = await this.queryJobs();

      if (jobs && jobs.length > 0) {
        this.claimAttempts++;
        const claimed = await this.claimJob(jobs[0]);

        if (claimed) {
          this.claimSuccesses++;
          this.metrics.consecutiveErrors = 0;
        }

        this.metrics.claimSuccessRate = 
          this.claimSuccesses / this.claimAttempts;
      }

      this.metrics.avgClaimLatency = Date.now() - startTime;
    } catch (error) {
      this.metrics.consecutiveErrors++;
      throw error;
    }
  }

  getMetrics(): PollingMetrics {
    return { ...this.metrics };
  }
}
```

### 9.2 Health Check Endpoint
```typescript
// GET /health
app.get('/health', (req, res) => {
  const metrics = poller.getMetrics();

  const healthy = 
    metrics.consecutiveErrors < 5 &&
    metrics.pollsPerMinute > 0;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    metrics
  });
});
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('JobPoller', () => {
  it('polls Supabase for queued jobs', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ 
        data: [{ id: '123', status: 'queued' }], 
        error: null 
      })
    };

    const poller = new JobPoller({ supabase: mockSupabase });
    await poller.pollOnce();

    expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'queued');
  });

  it('claims job atomically', async () => {
    const poller = new JobPoller({ supabase: mockSupabase });
    const job = { id: '123', status: 'queued', version: 1 };

    const claimed = await poller.claimJob(job);

    expect(claimed).toBe(true);
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'running' })
    );
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Polling Integration', () => {
  it('prevents duplicate claims', async () => {
    // Create job
    await supabase.from('execution_jobs').insert({ 
      status: 'queued' 
    });

    // Start two pollers
    const poller1 = new JobPoller(config);
    const poller2 = new JobPoller(config);

    const [claimed1, claimed2] = await Promise.all([
      poller1.pollOnce(),
      poller2.pollOnce()
    ]);

    // Only one should succeed
    expect(claimed1 !== claimed2).toBe(true);
  });
});
```

---

## Summary

The Polling Strategy provides:
- ✅ **Basic polling loop** with 5 second base interval
- ✅ **Exponential backoff** (5s → 30s when queue empty)
- ✅ **Atomic job claiming** with optimistic locking
- ✅ **Query optimization** with composite indexes
- ✅ **Realtime alternative** with Supabase push notifications
- ✅ **Error handling** with retry logic and transient error detection
- ✅ **Monitoring** with metrics and health checks
- ✅ **Testing** with unit and integration tests

This provides reliable, efficient job discovery with proper concurrency control.
