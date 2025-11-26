# Portal-Supabase API Contract

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Status:** Complete Technical Specification  
**Last Updated:** November 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Client Configuration](#2-client-configuration)
3. [Authentication API](#3-authentication-api)
4. [Recordings API](#4-recordings-api)
5. [Execution Jobs API](#5-execution-jobs-api)
6. [Execution Results API](#6-execution-results-api)
7. [Execution Logs API](#7-execution-logs-api)
8. [Healing Logs API](#8-healing-logs-api)
9. [Storage API](#9-storage-api)
10. [Realtime Subscriptions](#10-realtime-subscriptions)
11. [Error Handling](#11-error-handling)
12. [Type Definitions](#12-type-definitions)

---

## 1. Overview

This document defines the API contract between the Web Portal (Next.js) and Supabase. All data operations flow through the Supabase JavaScript client using typed queries.

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WEB PORTAL (Next.js)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                     React Server Components                      │  │
│   │                                                                   │  │
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐   │  │
│   │   │  Dashboard      │  │  Recording      │  │  Execution    │   │  │
│   │   │  Page           │  │  Detail Page    │  │  Monitor      │   │  │
│   │   └────────┬────────┘  └────────┬────────┘  └───────┬───────┘   │  │
│   │            │                    │                    │           │  │
│   │            └────────────────────┴────────────────────┘           │  │
│   │                                 │                                 │  │
│   │                    createServerClient()                          │  │
│   │                                 │                                 │  │
│   └─────────────────────────────────┼───────────────────────────────┘  │
│                                     │                                   │
│   ┌─────────────────────────────────┼───────────────────────────────┐  │
│   │                     API Route Handlers                           │  │
│   │                                 │                                 │  │
│   │   ┌─────────────────┐  ┌───────┴───────┐  ┌───────────────────┐ │  │
│   │   │ /api/recordings │  │ /api/jobs     │  │ /api/storage      │ │  │
│   │   └────────┬────────┘  └───────┬───────┘  └─────────┬─────────┘ │  │
│   │            │                   │                     │           │  │
│   │            └───────────────────┴─────────────────────┘           │  │
│   │                                │                                  │  │
│   │               createServerClient() / createClient()              │  │
│   │                                │                                  │  │
│   └────────────────────────────────┼────────────────────────────────┘  │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                                     │ HTTPS / WebSocket
                                     │
┌────────────────────────────────────┼────────────────────────────────────┐
│                                    ▼                                    │
│                              SUPABASE                                   │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   PostgreSQL    │  │    Realtime     │  │       Storage           │ │
│  │                 │  │                 │  │                         │ │
│  │  • recordings   │  │  • Job status   │  │  • screenshots/         │ │
│  │  • exec_jobs    │  │  • Log streams  │  │  • downloads/           │ │
│  │  • exec_results │  │  • Progress     │  │  • exports/             │ │
│  │  • exec_logs    │  │                 │  │                         │ │
│  │  • healing_logs │  │                 │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Client Types

| Context | Client Factory | Use Case |
|---------|----------------|----------|
| Server Components | createServerClient() | SSR data fetching |
| API Routes | createServerClient() | Server-side mutations |
| Client Components | createBrowserClient() | Realtime subscriptions |
| Service Role | createServiceClient() | Admin operations (VDI) |

---

## 2. Client Configuration

### 2.1 Server Client Setup

```typescript
// lib/supabase/server.ts
import { createServerClient as createClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export function createServerClient() {
  const cookieStore = cookies();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Handle cookie errors in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Handle cookie errors in Server Components
          }
        },
      },
    }
  );
}
```

### 2.2 Browser Client Setup

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 2.3 Service Client Setup (Admin)

```typescript
// lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose to client
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
```

---

## 3. Authentication API

### 3.1 Sign Up

```typescript
// POST /api/auth/signup
interface SignUpRequest {
  email: string;
  password: string;
  fullName?: string;
}

interface SignUpResponse {
  user: User | null;
  session: Session | null;
  error?: string;
}

// Implementation
export async function signUp(data: SignUpRequest): Promise<SignUpResponse> {
  const supabase = createServerClient();
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName
      }
    }
  });

  if (authError) {
    return { user: null, session: null, error: authError.message };
  }

  // Create user profile
  if (authData.user) {
    await supabase.from('users').insert({
      id: authData.user.id,
      email: data.email,
      full_name: data.fullName,
      tier: 'starter',
      preferences: {
        recording: { overlayPosition: 'top-right', captureScreenshots: true },
        execution: { defaultTimeout: 30000, retryCount: 2 },
        aiHealing: { mode: 'autonomous', confidenceThreshold: 80 },
        notifications: { emailOnComplete: true, emailOnFailure: true }
      }
    });
  }

  return { user: authData.user, session: authData.session };
}
```

### 3.2 Sign In

```typescript
// POST /api/auth/signin
interface SignInRequest {
  email: string;
  password: string;
}

export async function signIn(data: SignInRequest) {
  const supabase = createServerClient();
  
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  return { user: authData.user, session: authData.session };
}
```

### 3.3 Sign Out

```typescript
// POST /api/auth/signout
export async function signOut() {
  const supabase = createServerClient();
  const { error } = await supabase.auth.signOut();
  return { success: !error, error: error?.message };
}
```

### 3.4 Get Current User

```typescript
// GET /api/auth/user
export async function getCurrentUser() {
  const supabase = createServerClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}
```

---

## 4. Recordings API

### 4.1 List Recordings

```typescript
// GET /api/recordings
interface ListRecordingsParams {
  userId: string;
  status?: 'recording' | 'completed' | 'archived';
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface ListRecordingsResponse {
  recordings: Recording[];
  total: number;
  hasMore: boolean;
}

export async function listRecordings(
  params: ListRecordingsParams
): Promise<ListRecordingsResponse> {
  const supabase = createServerClient();
  
  let query = supabase
    .from('recordings')
    .select('*', { count: 'exact' })
    .eq('user_id', params.userId);

  // Apply filters
  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`);
  }

  // Apply sorting
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Apply pagination
  const limit = params.limit || 20;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  return {
    recordings: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit
  };
}
```

### 4.2 Get Recording

```typescript
// GET /api/recordings/:id
interface GetRecordingParams {
  id: string;
  includeSteps?: boolean;
}

export async function getRecording(
  params: GetRecordingParams
): Promise<Recording> {
  const supabase = createServerClient();
  
  const columns = params.includeSteps 
    ? '*' 
    : 'id,user_id,name,description,starting_url,status,step_count,duration,variables,recording_method,visibility,created_at,updated_at';

  const { data, error } = await supabase
    .from('recordings')
    .select(columns)
    .eq('id', params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError('NOT_FOUND', 'Recording not found');
    }
    throw new ApiError('FETCH_FAILED', error.message);
  }

  return data;
}
```

### 4.3 Create Recording

```typescript
// POST /api/recordings
interface CreateRecordingRequest {
  name: string;
  startingUrl: string;
  description?: string;
  tags?: string[];
  recordingMethod?: 'extension' | 'cloud_browser';
}

export async function createRecording(
  userId: string,
  data: CreateRecordingRequest
): Promise<Recording> {
  const supabase = createServerClient();
  
  const { data: recording, error } = await supabase
    .from('recordings')
    .insert({
      user_id: userId,
      name: data.name,
      starting_url: data.startingUrl,
      description: data.description,
      tags: data.tags || [],
      status: 'recording',
      steps: [],
      step_count: 0,
      variables: {},
      recording_method: data.recordingMethod || 'extension',
      visibility: 'private'
    })
    .select()
    .single();

  if (error) throw new ApiError('CREATE_FAILED', error.message);

  return recording;
}
```

### 4.4 Update Recording

```typescript
// PATCH /api/recordings/:id
interface UpdateRecordingRequest {
  name?: string;
  description?: string;
  tags?: string[];
  status?: 'recording' | 'completed' | 'archived';
  steps?: RecordedStep[];
  variables?: Record<string, Variable>;
}

export async function updateRecording(
  id: string,
  data: UpdateRecordingRequest
): Promise<Recording> {
  const supabase = createServerClient();
  
  const updateData: Partial<Recording> = {
    ...data,
    updated_at: new Date().toISOString()
  };

  // Auto-update step_count if steps provided
  if (data.steps) {
    updateData.step_count = data.steps.length;
  }

  const { data: recording, error } = await supabase
    .from('recordings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ApiError('UPDATE_FAILED', error.message);

  return recording;
}
```

### 4.5 Delete Recording

```typescript
// DELETE /api/recordings/:id
export async function deleteRecording(id: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from('recordings')
    .delete()
    .eq('id', id);

  if (error) throw new ApiError('DELETE_FAILED', error.message);
}
```

### 4.6 Add Step to Recording

```typescript
// POST /api/recordings/:id/steps
interface AddStepRequest {
  step: RecordedStep;
}

export async function addStep(
  recordingId: string,
  step: RecordedStep
): Promise<Recording> {
  const supabase = createServerClient();
  
  // Fetch current steps
  const { data: recording, error: fetchError } = await supabase
    .from('recordings')
    .select('steps')
    .eq('id', recordingId)
    .single();

  if (fetchError) throw new ApiError('FETCH_FAILED', fetchError.message);

  // Append step
  const updatedSteps = [...(recording.steps || []), step];

  // Update recording
  const { data: updated, error: updateError } = await supabase
    .from('recordings')
    .update({
      steps: updatedSteps,
      step_count: updatedSteps.length,
      updated_at: new Date().toISOString()
    })
    .eq('id', recordingId)
    .select()
    .single();

  if (updateError) throw new ApiError('UPDATE_FAILED', updateError.message);

  return updated;
}
```

---

## 5. Execution Jobs API

### 5.1 Create Execution Job

```typescript
// POST /api/jobs
interface CreateJobRequest {
  recordingId: string;
  name?: string;
  csvData?: Record<string, string>[];
  variableMapping?: Record<string, string>;
  settings?: {
    headless?: boolean;
    timeout?: number;
    retryCount?: number;
    screenshotOnError?: boolean;
    enableHealing?: boolean;
  };
}

export async function createJob(
  userId: string,
  data: CreateJobRequest
): Promise<ExecutionJob> {
  const supabase = createServerClient();
  
  const { data: job, error } = await supabase
    .from('execution_jobs')
    .insert({
      recording_id: data.recordingId,
      user_id: userId,
      name: data.name || `Execution ${new Date().toISOString()}`,
      csv_data: data.csvData || [],
      variable_mapping: data.variableMapping || {},
      total_rows: data.csvData?.length || 1,
      current_row: 0,
      completed_rows: 0,
      failed_rows: 0,
      status: 'pending',
      settings: {
        headless: data.settings?.headless ?? true,
        timeout: data.settings?.timeout ?? 30000,
        retryCount: data.settings?.retryCount ?? 2,
        screenshotOnError: data.settings?.screenshotOnError ?? true,
        enableHealing: data.settings?.enableHealing ?? true
      }
    })
    .select()
    .single();

  if (error) throw new ApiError('CREATE_FAILED', error.message);

  return job;
}
```

### 5.2 List Jobs for Recording

```typescript
// GET /api/recordings/:recordingId/jobs
interface ListJobsParams {
  recordingId: string;
  status?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  limit?: number;
  offset?: number;
}

export async function listJobs(
  params: ListJobsParams
): Promise<{ jobs: ExecutionJob[]; total: number }> {
  const supabase = createServerClient();
  
  let query = supabase
    .from('execution_jobs')
    .select('*', { count: 'exact' })
    .eq('recording_id', params.recordingId)
    .order('created_at', { ascending: false });

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const limit = params.limit || 20;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  return { jobs: data || [], total: count || 0 };
}
```

### 5.3 Get Job Details

```typescript
// GET /api/jobs/:id
export async function getJob(id: string): Promise<ExecutionJob> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('execution_jobs')
    .select(`
      *,
      recording:recordings(id, name, starting_url, step_count)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new ApiError('NOT_FOUND', 'Job not found');
    }
    throw new ApiError('FETCH_FAILED', error.message);
  }

  return data;
}
```

### 5.4 Update Job Status

```typescript
// PATCH /api/jobs/:id/status
interface UpdateJobStatusRequest {
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentRow?: number;
  completedRows?: number;
  failedRows?: number;
  vdiInstanceId?: string;
}

export async function updateJobStatus(
  id: string,
  data: UpdateJobStatusRequest
): Promise<ExecutionJob> {
  const supabase = createServerClient();
  
  const updateData: Partial<ExecutionJob> = {
    status: data.status,
    updated_at: new Date().toISOString()
  };

  if (data.currentRow !== undefined) updateData.current_row = data.currentRow;
  if (data.completedRows !== undefined) updateData.completed_rows = data.completedRows;
  if (data.failedRows !== undefined) updateData.failed_rows = data.failedRows;
  if (data.vdiInstanceId) updateData.vdi_instance_id = data.vdiInstanceId;

  // Set timestamps based on status
  if (data.status === 'running' && !updateData.started_at) {
    updateData.started_at = new Date().toISOString();
  }
  if (['completed', 'failed', 'cancelled'].includes(data.status)) {
    updateData.completed_at = new Date().toISOString();
  }

  const { data: job, error } = await supabase
    .from('execution_jobs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ApiError('UPDATE_FAILED', error.message);

  return job;
}
```

### 5.5 Cancel Job

```typescript
// POST /api/jobs/:id/cancel
export async function cancelJob(id: string): Promise<ExecutionJob> {
  return updateJobStatus(id, { status: 'cancelled' });
}
```

---

## 6. Execution Results API

### 6.1 List Results for Job

```typescript
// GET /api/jobs/:jobId/results
interface ListResultsParams {
  jobId: string;
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  limit?: number;
  offset?: number;
}

export async function listResults(
  params: ListResultsParams
): Promise<{ results: ExecutionResult[]; total: number }> {
  const supabase = createServerClient();
  
  let query = supabase
    .from('execution_results')
    .select('*', { count: 'exact' })
    .eq('execution_job_id', params.jobId)
    .order('row_index', { ascending: true });

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const limit = params.limit || 100;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  return { results: data || [], total: count || 0 };
}
```

### 6.2 Get Result Details

```typescript
// GET /api/results/:id
export async function getResult(id: string): Promise<ExecutionResult> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('execution_results')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  return data;
}
```

### 6.3 Create Result (VDI Use)

```typescript
// POST /api/jobs/:jobId/results
interface CreateResultRequest {
  rowIndex: number;
  rowData: Record<string, string>;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  stepsCompleted?: number;
  stepsFailed?: number;
  duration?: number;
  errorMessage?: string;
  errorStepNumber?: number;
  errorScreenshotUrl?: string;
  extractedData?: Record<string, string>;
}

export async function createResult(
  jobId: string,
  data: CreateResultRequest
): Promise<ExecutionResult> {
  const supabase = createServiceClient(); // Service role for VDI
  
  const { data: result, error } = await supabase
    .from('execution_results')
    .insert({
      execution_job_id: jobId,
      row_index: data.rowIndex,
      row_data: data.rowData,
      status: data.status,
      steps_completed: data.stepsCompleted || 0,
      steps_failed: data.stepsFailed || 0,
      duration: data.duration,
      error_message: data.errorMessage,
      error_step_number: data.errorStepNumber,
      error_screenshot_url: data.errorScreenshotUrl,
      extracted_data: data.extractedData
    })
    .select()
    .single();

  if (error) throw new ApiError('CREATE_FAILED', error.message);

  return result;
}
```

---

## 7. Execution Logs API

### 7.1 List Logs for Job

```typescript
// GET /api/jobs/:jobId/logs
interface ListLogsParams {
  jobId: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  resultId?: string;
  limit?: number;
  after?: string; // ISO timestamp for pagination
}

export async function listLogs(
  params: ListLogsParams
): Promise<{ logs: ExecutionLog[]; hasMore: boolean }> {
  const supabase = createServerClient();
  
  let query = supabase
    .from('execution_logs')
    .select('*')
    .eq('execution_job_id', params.jobId)
    .order('created_at', { ascending: true });

  if (params.level) {
    query = query.eq('level', params.level);
  }

  if (params.resultId) {
    query = query.eq('execution_result_id', params.resultId);
  }

  if (params.after) {
    query = query.gt('created_at', params.after);
  }

  const limit = params.limit || 100;
  query = query.limit(limit + 1); // Fetch one extra to check hasMore

  const { data, error } = await query;

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  const logs = data || [];
  const hasMore = logs.length > limit;
  
  return {
    logs: hasMore ? logs.slice(0, limit) : logs,
    hasMore
  };
}
```

### 7.2 Create Log Entry (VDI Use)

```typescript
// POST /api/jobs/:jobId/logs
interface CreateLogRequest {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stepNumber?: number;
  stepLabel?: string;
  rowIndex?: number;
  resultId?: string;
  metadata?: Record<string, unknown>;
  screenshotUrl?: string;
}

export async function createLog(
  jobId: string,
  data: CreateLogRequest
): Promise<ExecutionLog> {
  const supabase = createServiceClient(); // Service role for VDI
  
  const { data: log, error } = await supabase
    .from('execution_logs')
    .insert({
      execution_job_id: jobId,
      execution_result_id: data.resultId,
      level: data.level,
      message: data.message,
      step_number: data.stepNumber,
      step_label: data.stepLabel,
      row_index: data.rowIndex,
      metadata: data.metadata,
      screenshot_url: data.screenshotUrl
    })
    .select()
    .single();

  if (error) throw new ApiError('CREATE_FAILED', error.message);

  return log;
}
```

---

## 8. Healing Logs API

### 8.1 List Healing Logs

```typescript
// GET /api/recordings/:recordingId/healing
interface ListHealingLogsParams {
  recordingId: string;
  jobId?: string;
  success?: boolean;
  method?: 'ai_vision' | 'text_match' | 'structural' | 'attribute_fallback';
  limit?: number;
  offset?: number;
}

export async function listHealingLogs(
  params: ListHealingLogsParams
): Promise<{ logs: HealingLog[]; total: number }> {
  const supabase = createServerClient();
  
  let query = supabase
    .from('healing_logs')
    .select('*', { count: 'exact' })
    .eq('recording_id', params.recordingId)
    .order('created_at', { ascending: false });

  if (params.jobId) {
    query = query.eq('execution_job_id', params.jobId);
  }

  if (params.success !== undefined) {
    query = query.eq('success', params.success);
  }

  if (params.method) {
    query = query.eq('healing_method', params.method);
  }

  const limit = params.limit || 50;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  return { logs: data || [], total: count || 0 };
}
```

### 8.2 Get Healing Statistics

```typescript
// GET /api/recordings/:recordingId/healing/stats
interface HealingStats {
  totalAttempts: number;
  successfulHeals: number;
  failedHeals: number;
  successRate: number;
  byMethod: Record<string, { attempts: number; successes: number }>;
  avgConfidence: number;
}

export async function getHealingStats(
  recordingId: string,
  days: number = 30
): Promise<HealingStats> {
  const supabase = createServerClient();
  
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('healing_logs')
    .select('healing_method, success, confidence')
    .eq('recording_id', recordingId)
    .gte('created_at', since.toISOString());

  if (error) throw new ApiError('FETCH_FAILED', error.message);

  const logs = data || [];
  const totalAttempts = logs.length;
  const successfulHeals = logs.filter(l => l.success).length;
  const failedHeals = totalAttempts - successfulHeals;
  
  const byMethod: Record<string, { attempts: number; successes: number }> = {};
  let totalConfidence = 0;

  for (const log of logs) {
    const method = log.healing_method;
    if (!byMethod[method]) {
      byMethod[method] = { attempts: 0, successes: 0 };
    }
    byMethod[method].attempts++;
    if (log.success) byMethod[method].successes++;
    totalConfidence += log.confidence || 0;
  }

  return {
    totalAttempts,
    successfulHeals,
    failedHeals,
    successRate: totalAttempts > 0 ? (successfulHeals / totalAttempts) * 100 : 0,
    byMethod,
    avgConfidence: totalAttempts > 0 ? totalConfidence / totalAttempts : 0
  };
}
```

---

## 9. Storage API

### 9.1 Upload Screenshot

```typescript
// POST /api/storage/screenshots
interface UploadScreenshotRequest {
  jobId: string;
  stepNumber: number;
  rowIndex?: number;
  base64Data: string;
  contentType?: string;
}

export async function uploadScreenshot(
  data: UploadScreenshotRequest
): Promise<{ url: string }> {
  const supabase = createServerClient();
  
  const fileName = `${data.jobId}/${data.rowIndex ?? 0}/step-${data.stepNumber}-${Date.now()}.png`;
  
  // Convert base64 to buffer
  const buffer = Buffer.from(data.base64Data, 'base64');

  const { data: uploadData, error } = await supabase.storage
    .from('screenshots')
    .upload(fileName, buffer, {
      contentType: data.contentType || 'image/png',
      upsert: false
    });

  if (error) throw new ApiError('UPLOAD_FAILED', error.message);

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(uploadData.path);

  return { url: publicUrl };
}
```

### 9.2 Upload CSV Export

```typescript
// POST /api/storage/exports
interface UploadExportRequest {
  userId: string;
  jobId: string;
  csvContent: string;
  fileName: string;
}

export async function uploadExport(
  data: UploadExportRequest
): Promise<{ url: string; expiresAt: string }> {
  const supabase = createServerClient();
  
  const path = `${data.userId}/${data.jobId}/${data.fileName}`;

  const { data: uploadData, error } = await supabase.storage
    .from('exports')
    .upload(path, data.csvContent, {
      contentType: 'text/csv',
      upsert: true
    });

  if (error) throw new ApiError('UPLOAD_FAILED', error.message);

  // Create signed URL (expires in 24 hours)
  const { data: signedData, error: signError } = await supabase.storage
    .from('exports')
    .createSignedUrl(uploadData.path, 86400);

  if (signError) throw new ApiError('SIGNED_URL_FAILED', signError.message);

  const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

  return { url: signedData.signedUrl, expiresAt };
}
```

### 9.3 Delete Storage Files

```typescript
// DELETE /api/storage/:bucket/:path
export async function deleteStorageFile(
  bucket: 'screenshots' | 'exports' | 'downloads',
  path: string
): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw new ApiError('DELETE_FAILED', error.message);
}
```

---

## 10. Realtime Subscriptions

### 10.1 Subscribe to Job Updates

```typescript
// Client-side subscription
export function subscribeToJob(
  jobId: string,
  callbacks: {
    onStatusChange?: (status: string) => void;
    onProgressUpdate?: (progress: JobProgress) => void;
    onComplete?: (job: ExecutionJob) => void;
  }
): () => void {
  const supabase = createClient();
  
  const channel = supabase
    .channel(`job:${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'execution_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        const job = payload.new as ExecutionJob;
        
        callbacks.onStatusChange?.(job.status);
        
        callbacks.onProgressUpdate?.({
          currentRow: job.current_row,
          totalRows: job.total_rows,
          completedRows: job.completed_rows,
          failedRows: job.failed_rows,
          percentComplete: (job.completed_rows + job.failed_rows) / job.total_rows * 100
        });

        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          callbacks.onComplete?.(job);
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
```

### 10.2 Subscribe to Logs Stream

```typescript
// Client-side subscription
export function subscribeToLogs(
  jobId: string,
  onLog: (log: ExecutionLog) => void
): () => void {
  const supabase = createClient();
  
  const channel = supabase
    .channel(`logs:${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'execution_logs',
        filter: `execution_job_id=eq.${jobId}`
      },
      (payload) => {
        onLog(payload.new as ExecutionLog);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

### 10.3 Subscribe to User Recordings

```typescript
// Client-side subscription
export function subscribeToRecordings(
  userId: string,
  callbacks: {
    onInsert?: (recording: Recording) => void;
    onUpdate?: (recording: Recording) => void;
    onDelete?: (id: string) => void;
  }
): () => void {
  const supabase = createClient();
  
  const channel = supabase
    .channel(`recordings:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recordings',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onInsert?.(payload.new as Recording);
            break;
          case 'UPDATE':
            callbacks.onUpdate?.(payload.new as Recording);
            break;
          case 'DELETE':
            callbacks.onDelete?.(payload.old.id);
            break;
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

---

## 11. Error Handling

### 11.1 API Error Class

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      details: this.details
    };
  }
}

// Common errors
export const Errors = {
  NOT_FOUND: (resource: string) => 
    new ApiError('NOT_FOUND', `${resource} not found`, 404),
  
  UNAUTHORIZED: () => 
    new ApiError('UNAUTHORIZED', 'Authentication required', 401),
  
  FORBIDDEN: () => 
    new ApiError('FORBIDDEN', 'Access denied', 403),
  
  VALIDATION: (message: string) => 
    new ApiError('VALIDATION_ERROR', message, 400),
  
  CONFLICT: (message: string) => 
    new ApiError('CONFLICT', message, 409),
  
  INTERNAL: (message: string) => 
    new ApiError('INTERNAL_ERROR', message, 500)
};
```

### 11.2 API Route Handler

```typescript
// lib/api-handler.ts
import { NextResponse } from 'next/server';
import { ApiError } from './errors';

type Handler = (
  request: Request,
  context?: { params: Record<string, string> }
) => Promise<Response>;

export function withErrorHandler(handler: Handler): Handler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      if (error instanceof ApiError) {
        return NextResponse.json(error.toJSON(), { status: error.statusCode });
      }

      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
  };
}

// Usage in API route
export const GET = withErrorHandler(async (request, { params }) => {
  const recording = await getRecording({ id: params.id });
  return NextResponse.json(recording);
});
```

---

## 12. Type Definitions

### 12.1 Database Types

```typescript
// types/supabase.ts
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      recordings: {
        Row: Recording;
        Insert: Omit<Recording, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Recording, 'id' | 'created_at'>>;
      };
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
        Update: never; // Healing logs are immutable
      };
    };
  };
}
```

### 12.2 Entity Types

```typescript
// types/entities.ts
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  tier: 'starter' | 'professional' | 'business' | 'enterprise';
  preferences: UserPreferences;
  default_team_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  user_id: string;
  team_id?: string;
  name: string;
  description?: string;
  starting_url: string;
  tags: string[];
  status: 'recording' | 'completed' | 'archived';
  step_count: number;
  duration?: number;
  steps: RecordedStep[];
  variables: Record<string, Variable>;
  recording_method: 'extension' | 'cloud_browser';
  visibility: 'private' | 'team' | 'public';
  created_at: string;
  updated_at: string;
}

export interface ExecutionJob {
  id: string;
  recording_id: string;
  user_id: string;
  team_id?: string;
  name: string;
  csv_data: Record<string, string>[];
  variable_mapping: Record<string, string>;
  total_rows: number;
  current_row: number;
  completed_rows: number;
  failed_rows: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  settings: JobSettings;
  vdi_instance_id?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutionResult {
  id: string;
  execution_job_id: string;
  row_index: number;
  row_data: Record<string, string>;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  steps_completed: number;
  steps_failed: number;
  duration?: number;
  error_message?: string;
  error_step_number?: number;
  error_screenshot_url?: string;
  extracted_data?: Record<string, string>;
  created_at: string;
}

export interface ExecutionLog {
  id: string;
  execution_job_id: string;
  execution_result_id?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  step_number?: number;
  step_label?: string;
  row_index?: number;
  metadata?: Record<string, unknown>;
  screenshot_url?: string;
  created_at: string;
}

export interface HealingLog {
  id: string;
  recording_id: string;
  execution_job_id?: string;
  step_number: number;
  original_selector: string;
  healed_selector: string;
  healing_method: 'ai_vision' | 'text_match' | 'structural' | 'attribute_fallback';
  confidence: number;
  page_url?: string;
  page_title?: string;
  applied: boolean;
  success: boolean;
  screenshot_url?: string;
  created_at: string;
}
```

---

## Document End

This API contract ensures consistent, type-safe interactions between the Web Portal and Supabase across all operations.
