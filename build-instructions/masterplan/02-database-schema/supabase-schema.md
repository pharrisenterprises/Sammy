# Supabase Database Schema
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Schema Specification

## Table of Contents
1. Overview
2. Schema Design Principles
3. Table Definitions
4. JSONB Structures
5. Indexes and Constraints
6. Trigger Functions
7. Migration Scripts
8. Performance Optimization

---

## 1. Overview

### 1.1 Database Architecture

**PostgreSQL Version:** 15+  
**Hosting:** Supabase Cloud  
**Extensions:** uuid-ossp, pgcrypto

**Core Tables:**
- `users` - User accounts (managed by Supabase Auth)
- `recordings` - Canonical workflow storage with JSONB steps array
- `execution_jobs` - Test run management and queuing
- `execution_results` - Per-row execution results
- `execution_logs` - Real-time execution logs for monitoring
- `healing_logs` - AI healing history and 24-hour cache
- `vdi_metrics` - VDI performance tracking

### 1.2 Key Design Decisions

**JSONB for Flexibility:**
- `recordings.steps` stores complete step array (canonical format)
- `recordings.variables` stores dynamic field configurations
- `execution_results.row_data` stores CSV row data
- `execution_jobs.csv_data` stores uploaded CSV rows

**UUID Primary Keys:**
- All tables use UUID via `uuid_generate_v4()`
- Distributed systems compatibility
- No auto-increment collision issues

**Timestamps:**
- Every table has `created_at` and `updated_at`
- Automatic updates via triggers
- Timezone-aware (TIMESTAMPTZ)

---

## 2. Schema Design Principles

### 2.1 Data Normalization

**Third Normal Form (3NF) Compliance:**
- No redundant data across tables
- Foreign keys enforce referential integrity
- Atomic columns (no multi-value fields in relational columns)

**Strategic Denormalization:**
- `recordings.step_count` cached for dashboard performance
- `execution_jobs.total_rows` cached to avoid COUNT queries
- `execution_jobs.completed_rows` cached for progress tracking

### 2.2 Backward Compatibility Guarantee

**Canonical JSON Format Never Changes:**

```typescript
// Phase 1, 2, and 3 all use IDENTICAL structure
interface RecordedStep {
  stepNumber: number;
  event: string;
  selector?: string;
  value?: string;
  navigation: {
    type: string;
    url?: string;
  };
  bundle: LocatorBundle;
  metadata?: Record<string, any>;
}
```

**Migration Strategy:**
- Phase 1 recordings work in Phase 2 without changes
- Phase 2 recordings work in Phase 3 without changes
- Only nullable columns added in later phases
- No breaking schema changes allowed

### 2.3 Multi-Tenancy Pattern

**Row-Level Security (RLS):**
- Every table has `user_id` foreign key
- RLS policies enforce data isolation at database level
- Phase 3 adds optional `team_id` for sharing

**Isolation Guarantee:**

```sql
-- Users can only see their own data
CREATE POLICY "users_own_data" ON recordings
FOR ALL USING (auth.uid() = user_id);
```

---

## 3. Table Definitions

### 3.1 users

**Purpose:** User account management (extends Supabase Auth)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  tier TEXT DEFAULT 'starter' CHECK (tier IN ('starter', 'professional', 'business', 'enterprise')),
  
  -- User Preferences (JSONB for flexibility)
  preferences JSONB DEFAULT '{
    "recording": {
      "overlayPosition": "top",
      "autoMinimize": false,
      "captureScreenshots": true
    },
    "replay": {
      "highlightElements": true,
      "slowMotion": false,
      "waitTimeout": 5000
    },
    "aiHealing": {
      "mode": "autonomous",
      "confidenceThreshold": 80,
      "cacheEnabled": true
    }
  }'::jsonb,
  
  -- Phase 2: Cloud Browser VM Tracking
  vm_id TEXT,
  vm_url TEXT,
  vm_status TEXT CHECK (vm_status IN ('not_provisioned', 'provisioning', 'ready', 'hibernating', 'stopped', 'error')),
  vm_provisioned_at TIMESTAMPTZ,
  vm_last_accessed TIMESTAMPTZ,
  
  -- Phase 3: Team Management
  default_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_vm_id ON users(vm_id) WHERE vm_id IS NOT NULL;
CREATE INDEX idx_users_vm_status ON users(vm_status) WHERE vm_status IS NOT NULL;
CREATE INDEX idx_users_default_team ON users(default_team_id) WHERE default_team_id IS NOT NULL;

-- Comments
COMMENT ON TABLE users IS 'User accounts extending Supabase Auth with tier and preferences';
COMMENT ON COLUMN users.tier IS 'Subscription level: starter (free), professional ($49), business ($149), enterprise ($299+)';
COMMENT ON COLUMN users.preferences IS 'User-configurable settings stored as JSONB';
COMMENT ON COLUMN users.vm_id IS 'Phase 2: Fly.io VM identifier for cloud browser';
```

**Column Explanations:**

| Column | Type | Purpose | Nullable |
|--------|------|---------|----------|
| id | UUID | References auth.users(id), managed by Supabase | No |
| email | TEXT | User email for notifications | No |
| tier | TEXT | Subscription level (starter/professional/business/enterprise) | No |
| preferences | JSONB | Flexible user settings | No |
| vm_id | TEXT | Phase 2: Cloud browser VM identifier | Yes |
| vm_url | TEXT | Phase 2: VM access URL (e.g., wss://vm-123.fly.dev) | Yes |
| vm_status | TEXT | Phase 2: VM lifecycle state | Yes |
| vm_provisioned_at | TIMESTAMPTZ | Phase 2: When VM was created | Yes |
| vm_last_accessed | TIMESTAMPTZ | Phase 2: Last time user used cloud browser | Yes |
| default_team_id | UUID | Phase 3: User's default team workspace | Yes |

### 3.2 recordings

**Purpose:** Canonical storage for recorded workflows

```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  starting_url TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('recording', 'draft', 'ready', 'archived')),
  step_count INTEGER DEFAULT 0,
  duration INTEGER, -- Total recording duration in milliseconds
  
  -- THE HEART: JSONB array of steps (canonical format, never changes)
  steps JSONB DEFAULT '[]'::jsonb NOT NULL,
  
  -- Variables: Parsed fields + CSV column mapping
  variables JSONB DEFAULT '{}'::jsonb,
  
  -- Recording Method
  recording_method TEXT DEFAULT 'extension' CHECK (recording_method IN ('extension', 'cloud_browser')),
  
  -- Phase 3: Team Sharing
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_team_id ON recordings(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX idx_recordings_recording_method ON recordings(recording_method);

-- Full-text search on recording names
CREATE INDEX idx_recordings_name_gin ON recordings USING gin(to_tsvector('english', name));

-- GIN index for JSONB queries
CREATE INDEX idx_recordings_steps_gin ON recordings USING gin(steps);

-- Comments
COMMENT ON TABLE recordings IS 'Canonical workflow storage with JSONB steps array';
COMMENT ON COLUMN recordings.steps IS 'Complete step array in canonical JSON format (unchanged across all phases)';
COMMENT ON COLUMN recordings.variables IS 'Parsed field definitions and CSV column mappings';
COMMENT ON COLUMN recordings.recording_method IS 'extension (local) or cloud_browser (Phase 2+)';
```

**Column Explanations:**

| Column | Type | Purpose | Nullable |
|--------|------|---------|----------|
| id | UUID | Primary key | No |
| user_id | UUID | Owner of recording | No |
| name | TEXT | User-defined name (e.g., "Login Flow") | No |
| description | TEXT | Optional description | Yes |
| starting_url | TEXT | Initial URL where recording begins | No |
| status | TEXT | recording/draft/ready/archived | No |
| step_count | INTEGER | Cached count of steps (auto-updated by trigger) | No |
| duration | INTEGER | Total recording time in milliseconds | Yes |
| steps | JSONB | Complete array of recorded steps | No |
| variables | JSONB | Field definitions and CSV mappings | No |
| recording_method | TEXT | extension or cloud_browser | No |
| team_id | UUID | Phase 3: If shared with team | Yes |
| visibility | TEXT | Phase 3: private or team | No |

### 3.3 execution_jobs

**Purpose:** Test run management and VDI job queue

```sql
CREATE TABLE execution_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- CSV Data
  csv_data JSONB NOT NULL, -- Array of row objects
  field_mapping JSONB NOT NULL, -- Column name -> Step label mapping
  total_rows INTEGER NOT NULL,
  completed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  
  -- Execution Configuration
  concurrency INTEGER DEFAULT 5 CHECK (concurrency BETWEEN 1 AND 10),
  stop_on_error BOOLEAN DEFAULT false,
  
  -- VDI Worker Tracking
  worker_id TEXT, -- Which VDI worker claimed this job
  claimed_at TIMESTAMPTZ, -- When job was claimed (for timeout detection)
  
  -- Phase 3: Team Context
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_execution_jobs_recording_id ON execution_jobs(recording_id);
CREATE INDEX idx_execution_jobs_user_id ON execution_jobs(user_id);
CREATE INDEX idx_execution_jobs_status ON execution_jobs(status);
CREATE INDEX idx_execution_jobs_created_at ON execution_jobs(created_at DESC);

-- Critical index for VDI job poller (FOR UPDATE SKIP LOCKED)
CREATE INDEX idx_execution_jobs_poller ON execution_jobs(status, created_at) 
WHERE status = 'pending';

-- Index for timeout detection (stale running jobs)
CREATE INDEX idx_execution_jobs_stale ON execution_jobs(status, claimed_at)
WHERE status = 'running';

-- Comments
COMMENT ON TABLE execution_jobs IS 'Test run management and VDI job queue';
COMMENT ON COLUMN execution_jobs.csv_data IS 'Complete CSV data as JSONB array';
COMMENT ON COLUMN execution_jobs.field_mapping IS 'Maps CSV column names to recording step labels';
COMMENT ON COLUMN execution_jobs.worker_id IS 'VDI worker that claimed this job';
COMMENT ON COLUMN execution_jobs.claimed_at IS 'For detecting stale jobs (timeout after 10 minutes)';
```

**VDI Poller Query (FOR UPDATE SKIP LOCKED):**

```sql
-- VDI worker polls for next pending job
SELECT * FROM execution_jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- Claim the job
UPDATE execution_jobs
SET 
  status = 'running',
  worker_id = 'worker-123',
  claimed_at = NOW(),
  started_at = NOW()
WHERE id = 'job-uuid';
```

### 3.4 execution_results

**Purpose:** Per-row execution results

```sql
CREATE TABLE execution_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_job_id UUID NOT NULL REFERENCES execution_jobs(id) ON DELETE CASCADE,
  
  -- Row Context
  row_index INTEGER NOT NULL, -- 0-based index into CSV
  row_data JSONB NOT NULL, -- Complete CSV row data
  
  -- Result
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  duration INTEGER, -- Execution time in milliseconds
  error_message TEXT,
  
  -- Step-by-Step Results
  step_results JSONB DEFAULT '[]'::jsonb,
  
  -- Screenshots
  screenshot_url TEXT, -- Supabase Storage URL if captured on failure
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_execution_results_job_id ON execution_results(execution_job_id);
CREATE INDEX idx_execution_results_status ON execution_results(status);
CREATE INDEX idx_execution_results_row_index ON execution_results(execution_job_id, row_index);

-- Comments
COMMENT ON TABLE execution_results IS 'Per-row execution results with step-by-step details';
COMMENT ON COLUMN execution_results.step_results IS 'JSONB array of per-step results';
```

**step_results JSONB Structure:**

```json
[
  {
    "stepNumber": 1,
    "success": true,
    "duration": 234,
    "strategy": "xpath",
    "message": "Element found using XPath"
  },
  {
    "stepNumber": 2,
    "success": false,
    "duration": 5000,
    "strategy": "fallback_text",
    "error": "Element not found after 5000ms timeout",
    "healingAttempted": true,
    "healingSuccess": false
  }
]
```

### 3.5 execution_logs

**Purpose:** Real-time execution logs (streaming to portal)

```sql
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_job_id UUID NOT NULL REFERENCES execution_jobs(id) ON DELETE CASCADE,
  
  -- Log Entry
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  
  -- Context
  row_index INTEGER,
  step_number INTEGER,
  
  -- Metadata (flexible JSONB)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_execution_logs_job_id_timestamp ON execution_logs(execution_job_id, timestamp DESC);
CREATE INDEX idx_execution_logs_level ON execution_logs(level);

-- Partition by month (for large-scale deployments)
-- CREATE TABLE execution_logs_2024_11 PARTITION OF execution_logs
-- FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

-- Comments
COMMENT ON TABLE execution_logs IS 'Real-time execution logs for monitoring';
COMMENT ON COLUMN execution_logs.metadata IS 'Additional context (strategy used, duration, etc.)';
```

**Usage Example:**

```sql
-- VDI worker logs each step
INSERT INTO execution_logs (execution_job_id, level, message, row_index, step_number, metadata)
VALUES (
  'job-uuid',
  'info',
  'Element found using XPath strategy',
  0,
  1,
  '{"strategy": "xpath", "duration": 123, "selector": "//button[@id=\"submit\"]"}'::jsonb
);
```

### 3.6 healing_logs

**Purpose:** AI healing history and 24-hour cache

```sql
CREATE TABLE healing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_job_id UUID REFERENCES execution_jobs(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  
  -- Step Context
  step_number INTEGER NOT NULL,
  original_selector TEXT NOT NULL,
  
  -- Healing Result
  healed_selector TEXT,
  healing_method TEXT CHECK (healing_method IN ('claude_vision', 'fuzzy_match', 'bounding_box', 'cached')),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  
  -- Claude Vision Details
  screenshot_url TEXT, -- Supabase Storage URL
  claude_request JSONB, -- Request payload sent to Claude API
  claude_response JSONB, -- Complete API response
  
  -- Cache Management
  cache_hit BOOLEAN DEFAULT false,
  cache_key TEXT, -- Hash of (recording_id + step_number + page_context)
  cached_until TIMESTAMPTZ, -- TTL: created_at + 24 hours
  
  -- Success Tracking
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_healing_logs_recording_id ON healing_logs(recording_id);
CREATE INDEX idx_healing_logs_step_number ON healing_logs(recording_id, step_number);
CREATE INDEX idx_healing_logs_success ON healing_logs(success);
CREATE INDEX idx_healing_logs_healing_method ON healing_logs(healing_method);

-- Cache lookup index (24-hour TTL)
CREATE INDEX idx_healing_cache_lookup ON healing_logs(cache_key, cached_until) 
WHERE success = true AND cached_until > NOW();

-- Comments
COMMENT ON TABLE healing_logs IS 'AI healing history with 24-hour cache';
COMMENT ON COLUMN healing_logs.cache_key IS 'MD5 hash of recording_id + step_number + page URL';
COMMENT ON COLUMN healing_logs.cached_until IS 'Cache expiration (created_at + 24 hours)';
```

**Cache Lookup Query:**

```sql
-- Check cache before calling Claude API
SELECT healed_selector, confidence_score
FROM healing_logs
WHERE cache_key = MD5('recording-uuid' || '1' || 'https://example.com')
  AND cached_until > NOW()
  AND success = true
ORDER BY created_at DESC
LIMIT 1;
```

### 3.7 vdi_metrics

**Purpose:** VDI worker performance monitoring

```sql
CREATE TABLE vdi_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Worker Identification
  worker_id TEXT NOT NULL,
  worker_region TEXT, -- Fly.io region (e.g., 'iad', 'lhr')
  
  -- Performance Metrics
  cpu_usage DECIMAL(5,2), -- Percentage (0.00 to 100.00)
  memory_usage DECIMAL(10,2), -- Megabytes
  browser_count INTEGER, -- Active Playwright browser instances
  
  -- Job Metrics
  jobs_processed INTEGER DEFAULT 0,
  jobs_succeeded INTEGER DEFAULT 0,
  jobs_failed INTEGER DEFAULT 0,
  avg_job_duration INTEGER, -- Milliseconds
  
  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vdi_metrics_worker_id ON vdi_metrics(worker_id, recorded_at DESC);
CREATE INDEX idx_vdi_metrics_recorded_at ON vdi_metrics(recorded_at DESC);

-- Time-series partitioning (for production scale)
-- CREATE TABLE vdi_metrics_2024_11 PARTITION OF vdi_metrics
-- FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

-- Comments
COMMENT ON TABLE vdi_metrics IS 'VDI worker performance metrics for monitoring and auto-scaling';
COMMENT ON COLUMN vdi_metrics.worker_region IS 'Fly.io region for geographic performance analysis';
```

---

## 4. JSONB Structures

### 4.1 recordings.steps (Canonical Format)

**Complete Step Example:**

```json
{
  "stepNumber": 1,
  "timestamp": 1700145000000,
  "label": "Email Address",
  "event": "type",
  "selector": "input#email",
  "value": "test@example.com",
  "x": 150,
  "y": 250,
  "page": "https://example.com/login",
  "navigation": {
    "type": "same_page",
    "url": "https://example.com/login"
  },
  "tabId": 1,
  "metadata": {
    "elementTag": "input",
    "elementType": "email",
    "isInIframe": false,
    "iframeDepth": 0,
    "isInShadowDOM": false,
    "visibilityState": "visible",
    "scrollPosition": {"x": 0, "y": 100}
  },
  "bundle": {
    "xpath": "//input[@id='email']",
    "id": "email",
    "name": "email",
    "className": "form-control input-lg",
    "aria": "Email address input field",
    "placeholder": "Enter your email",
    "dataAttrs": {
      "data-testid": "email-input",
      "data-field": "email",
      "data-required": "true"
    },
    "tag": "input",
    "visibleText": "",
    "bounding": {
      "left": 100,
      "top": 200,
      "width": 300,
      "height": 40
    },
    "iframeChain": [],
    "shadowHosts": [],
    "isClosedShadow": false
  }
}
```

### 4.2 recordings.variables

**Variable Configuration Example:**

```json
{
  "Email Address": {
    "type": "input",
    "required": true,
    "description": "User email for login",
    "csvColumn": "email",
    "stepNumber": 1,
    "defaultValue": ""
  },
  "Password": {
    "type": "input",
    "required": true,
    "description": "User password",
    "csvColumn": "password",
    "stepNumber": 2,
    "defaultValue": ""
  },
  "Remember Me": {
    "type": "checkbox",
    "required": false,
    "csvColumn": "remember",
    "stepNumber": 3,
    "defaultValue": "false"
  }
}
```

### 4.3 execution_jobs.csv_data

**CSV Data Array Example:**

```json
[
  {
    "email": "john@example.com",
    "password": "SecurePass123!",
    "remember": "true",
    "name": "John Doe"
  },
  {
    "email": "jane@example.com",
    "password": "AnotherPass456!",
    "remember": "false",
    "name": "Jane Smith"
  },
  {
    "email": "bob@example.com",
    "password": "BobPassword789!",
    "remember": "true",
    "name": "Bob Johnson"
  }
]
```

### 4.4 execution_jobs.field_mapping

**Field Mapping Example:**

```json
{
  "email": "Email Address",
  "password": "Password",
  "remember": "Remember Me"
}
```

**Note:** "name" column not mapped (no corresponding step)

### 4.5 users.preferences

**User Preferences Example:**

```json
{
  "recording": {
    "overlayPosition": "top",
    "autoMinimize": false,
    "captureScreenshots": true,
    "labelDetectionMode": "aggressive",
    "highlightRecordedElements": true
  },
  "replay": {
    "highlightElements": true,
    "slowMotion": false,
    "slowMotionDelay": 500,
    "waitTimeout": 5000,
    "retryAttempts": 3,
    "retryBackoff": [100, 200, 400]
  },
  "aiHealing": {
    "mode": "autonomous",
    "confidenceThreshold": 80,
    "cacheEnabled": true,
    "cacheTTL": 86400,
    "maxAttemptsPerStep": 3
  },
  "notifications": {
    "email": true,
    "browser": false,
    "executionComplete": true,
    "executionFailed": true,
    "healingUsed": false
  },
  "ui": {
    "theme": "dark",
    "compactMode": false,
    "defaultView": "grid"
  }
}
```

---

## 5. Indexes and Constraints

### 5.1 Performance Indexes

**Full-Text Search:**

```sql
-- Search recordings by name
CREATE INDEX idx_recordings_name_gin 
ON recordings USING gin(to_tsvector('english', name));

-- Query example
SELECT * FROM recordings 
WHERE to_tsvector('english', name) @@ to_tsquery('english', 'login & form');
```

**Composite Indexes:**

```sql
-- Dashboard query: User's recordings by status, sorted by date
CREATE INDEX idx_recordings_user_status_created 
ON recordings(user_id, status, created_at DESC);

-- Query example
SELECT * FROM recordings 
WHERE user_id = 'user-uuid' AND status = 'ready'
ORDER BY created_at DESC
LIMIT 20;
```

**Partial Indexes:**

```sql
-- Only index pending jobs (for VDI poller)
CREATE INDEX idx_execution_jobs_pending 
ON execution_jobs(created_at) 
WHERE status = 'pending';

-- Only index active VMs
CREATE INDEX idx_users_active_vms 
ON users(vm_id, vm_last_accessed) 
WHERE vm_status = 'ready';
```

### 5.2 Foreign Key Constraints

**Cascade Delete Rules:**

```sql
-- User deleted → All recordings deleted
ALTER TABLE recordings 
ADD CONSTRAINT fk_recordings_user 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Recording deleted → All execution jobs deleted
ALTER TABLE execution_jobs 
ADD CONSTRAINT fk_execution_jobs_recording 
FOREIGN KEY (recording_id) 
REFERENCES recordings(id) 
ON DELETE CASCADE;

-- Execution job deleted → All results and logs deleted
ALTER TABLE execution_results 
ADD CONSTRAINT fk_execution_results_job 
FOREIGN KEY (execution_job_id) 
REFERENCES execution_jobs(id) 
ON DELETE CASCADE;
```

### 5.3 Check Constraints

**Enum-Like Constraints:**

```sql
-- Tier validation
ALTER TABLE users 
ADD CONSTRAINT check_users_tier 
CHECK (tier IN ('starter', 'professional', 'business', 'enterprise'));

-- Status validation
ALTER TABLE recordings 
ADD CONSTRAINT check_recordings_status 
CHECK (status IN ('recording', 'draft', 'ready', 'archived'));

-- Execution status validation
ALTER TABLE execution_jobs 
ADD CONSTRAINT check_execution_jobs_status 
CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
```

**Range Constraints:**

```sql
-- Concurrency limits (1-10 concurrent tabs)
ALTER TABLE execution_jobs 
ADD CONSTRAINT check_execution_jobs_concurrency 
CHECK (concurrency BETWEEN 1 AND 10);

-- Confidence score range (0-100)
ALTER TABLE healing_logs 
ADD CONSTRAINT check_healing_logs_confidence 
CHECK (confidence_score BETWEEN 0 AND 100);

-- CPU usage percentage (0.00-100.00)
ALTER TABLE vdi_metrics
ADD CONSTRAINT check_vdi_metrics_cpu
CHECK (cpu_usage BETWEEN 0.00 AND 100.00);
```

---

## 6. Trigger Functions

### 6.1 Auto-Update Timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at 
BEFORE UPDATE ON recordings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_execution_jobs_updated_at 
BEFORE UPDATE ON execution_jobs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 6.2 Auto-Update Step Count

```sql
CREATE OR REPLACE FUNCTION update_recording_step_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.step_count = jsonb_array_length(NEW.steps);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recordings_step_count 
BEFORE INSERT OR UPDATE OF steps ON recordings 
FOR EACH ROW EXECUTE FUNCTION update_recording_step_count();
```

### 6.3 Auto-Update Execution Progress

```sql
CREATE OR REPLACE FUNCTION update_execution_job_progress()
RETURNS TRIGGER AS $$
DECLARE
  total INTEGER;
  completed INTEGER;
  successful INTEGER;
  failed INTEGER;
BEGIN
  -- Get counts
  SELECT 
    ej.total_rows,
    COUNT(*) FILTER (WHERE er.status IN ('success', 'failed')),
    COUNT(*) FILTER (WHERE er.status = 'success'),
    COUNT(*) FILTER (WHERE er.status = 'failed')
  INTO total, completed, successful, failed
  FROM execution_jobs ej
  LEFT JOIN execution_results er ON er.execution_job_id = ej.id
  WHERE ej.id = NEW.execution_job_id
  GROUP BY ej.total_rows;
  
  -- Update job
  UPDATE execution_jobs
  SET 
    completed_rows = completed,
    successful_rows = successful,
    failed_rows = failed,
    status = CASE
      WHEN completed = total THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN completed = total THEN NOW()
      ELSE completed_at
    END
  WHERE id = NEW.execution_job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_execution_jobs_progress 
AFTER INSERT OR UPDATE ON execution_results 
FOR EACH ROW EXECUTE FUNCTION update_execution_job_progress();
```

### 6.4 Auto-Set Cache Expiration

```sql
CREATE OR REPLACE FUNCTION set_healing_cache_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.success = true THEN
    NEW.cached_until = NEW.created_at + INTERVAL '24 hours';
    NEW.cache_key = MD5(NEW.recording_id::text || NEW.step_number::text || COALESCE(NEW.original_selector, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_healing_logs_cache 
BEFORE INSERT ON healing_logs 
FOR EACH ROW EXECUTE FUNCTION set_healing_cache_expiration();
```

---

## 7. Migration Scripts

### 7.1 Initial Schema (Phase 1)

```sql
-- migrations/001_initial_schema.sql

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  tier TEXT DEFAULT 'starter' CHECK (tier IN ('starter', 'professional', 'business', 'enterprise')),
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create recordings table
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  starting_url TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('recording', 'draft', 'ready', 'archived')),
  step_count INTEGER DEFAULT 0,
  duration INTEGER,
  steps JSONB DEFAULT '[]'::jsonb NOT NULL,
  variables JSONB DEFAULT '{}'::jsonb,
  recording_method TEXT DEFAULT 'extension' CHECK (recording_method IN ('extension', 'cloud_browser')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create execution_jobs table
CREATE TABLE execution_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  csv_data JSONB NOT NULL,
  field_mapping JSONB NOT NULL,
  total_rows INTEGER NOT NULL,
  completed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  concurrency INTEGER DEFAULT 5 CHECK (concurrency BETWEEN 1 AND 10),
  stop_on_error BOOLEAN DEFAULT false,
  worker_id TEXT,
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create execution_results table
CREATE TABLE execution_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_job_id UUID NOT NULL REFERENCES execution_jobs(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  row_data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  duration INTEGER,
  error_message TEXT,
  step_results JSONB DEFAULT '[]'::jsonb,
  screenshot_url TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create execution_logs table
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_job_id UUID NOT NULL REFERENCES execution_jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  row_index INTEGER,
  step_number INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create healing_logs table
CREATE TABLE healing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_job_id UUID REFERENCES execution_jobs(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  original_selector TEXT NOT NULL,
  healed_selector TEXT,
  healing_method TEXT CHECK (healing_method IN ('claude_vision', 'fuzzy_match', 'bounding_box', 'cached')),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  screenshot_url TEXT,
  claude_request JSONB,
  claude_response JSONB,
  cache_hit BOOLEAN DEFAULT false,
  cache_key TEXT,
  cached_until TIMESTAMPTZ,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vdi_metrics table
CREATE TABLE vdi_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id TEXT NOT NULL,
  worker_region TEXT,
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(10,2),
  browser_count INTEGER,
  jobs_processed INTEGER DEFAULT 0,
  jobs_succeeded INTEGER DEFAULT 0,
  jobs_failed INTEGER DEFAULT 0,
  avg_job_duration INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create all indexes (from section 5.1)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX idx_recordings_name_gin ON recordings USING gin(to_tsvector('english', name));
CREATE INDEX idx_execution_jobs_recording_id ON execution_jobs(recording_id);
CREATE INDEX idx_execution_jobs_user_id ON execution_jobs(user_id);
CREATE INDEX idx_execution_jobs_status ON execution_jobs(status);
CREATE INDEX idx_execution_jobs_poller ON execution_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_execution_results_job_id ON execution_results(execution_job_id);
CREATE INDEX idx_execution_logs_job_id_timestamp ON execution_logs(execution_job_id, timestamp DESC);
CREATE INDEX idx_healing_logs_recording_id ON healing_logs(recording_id);
CREATE INDEX idx_healing_cache_lookup ON healing_logs(cache_key, cached_until) WHERE success = true AND cached_until > NOW();
CREATE INDEX idx_vdi_metrics_worker_id ON vdi_metrics(worker_id, recorded_at DESC);

-- Create triggers (from section 6)
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON recordings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recordings_step_count BEFORE INSERT OR UPDATE OF steps ON recordings FOR EACH ROW EXECUTE FUNCTION update_recording_step_count();
CREATE TRIGGER update_execution_jobs_updated_at BEFORE UPDATE ON execution_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_execution_jobs_progress AFTER INSERT OR UPDATE ON execution_results FOR EACH ROW EXECUTE FUNCTION update_execution_job_progress();
CREATE TRIGGER set_healing_logs_cache BEFORE INSERT ON healing_logs FOR EACH ROW EXECUTE FUNCTION set_healing_cache_expiration();

-- Enable Row Level Security (policies defined in separate file)
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE healing_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
```

### 7.2 Phase 2 Migration (Cloud Browser)

```sql
-- migrations/002_phase_2_cloud_browser.sql

BEGIN;

-- Add VM columns to users table
ALTER TABLE users ADD COLUMN vm_id TEXT;
ALTER TABLE users ADD COLUMN vm_url TEXT;
ALTER TABLE users ADD COLUMN vm_status TEXT CHECK (vm_status IN ('not_provisioned', 'provisioning', 'ready', 'hibernating', 'stopped', 'error'));
ALTER TABLE users ADD COLUMN vm_provisioned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN vm_last_accessed TIMESTAMPTZ;

-- Create indexes
CREATE INDEX idx_users_vm_id ON users(vm_id) WHERE vm_id IS NOT NULL;
CREATE INDEX idx_users_vm_status ON users(vm_status) WHERE vm_status IS NOT NULL;

COMMIT;
```

### 7.3 Phase 3 Migration (Teams)

```sql
-- migrations/003_phase_3_teams.sql

BEGIN;

-- Create teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Add team columns to existing tables
ALTER TABLE users ADD COLUMN default_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE recordings ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE recordings ADD COLUMN visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team'));
ALTER TABLE execution_jobs ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_teams_owner_id ON teams(owner_id);
CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_users_default_team ON users(default_team_id) WHERE default_team_id IS NOT NULL;
CREATE INDEX idx_recordings_team_id ON recordings(team_id) WHERE team_id IS NOT NULL;

-- Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

COMMIT;
```

---

## 8. Performance Optimization

### 8.1 Query Optimization Tips

**Avoid N+1 Queries:**

```sql
-- ❌ BAD: Fetches recordings, then fetches user for each
SELECT * FROM recordings WHERE user_id = 'user-uuid';
-- Then: SELECT * FROM users WHERE id = recording.user_id; (N times)

-- ✅ GOOD: Single query with JOIN
SELECT 
  r.*,
  u.email,
  u.tier
FROM recordings r
INNER JOIN users u ON u.id = r.user_id
WHERE r.user_id = 'user-uuid';
```

**Use EXISTS Instead of IN:**

```sql
-- ❌ SLOWER: IN with subquery
SELECT * FROM recordings 
WHERE id IN (
  SELECT recording_id FROM execution_jobs WHERE status = 'completed'
);

-- ✅ FASTER: EXISTS
SELECT * FROM recordings r
WHERE EXISTS (
  SELECT 1 FROM execution_jobs ej 
  WHERE ej.recording_id = r.id AND ej.status = 'completed'
);
```

**Pagination:**

```sql
-- ❌ OFFSET pagination (slow on large datasets)
SELECT * FROM recordings 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 1000; -- Scans 1020 rows

-- ✅ Cursor pagination (faster)
SELECT * FROM recordings 
WHERE created_at < '2024-01-01T00:00:00Z' -- Last seen timestamp
ORDER BY created_at DESC 
LIMIT 20; -- Only scans 20 rows
```

### 8.2 JSONB Query Optimization

**Index JSONB Fields:**

```sql
-- For containment queries (@>)
CREATE INDEX idx_recordings_steps_gin ON recordings USING gin(steps);

-- Query: Find recordings with click events
SELECT * FROM recordings 
WHERE steps @> '[{"event": "click"}]'::jsonb;

-- For path queries (json_path_ops)
CREATE INDEX idx_recordings_steps_path ON recordings USING gin(steps jsonb_path_ops);
```

**Extract Frequently Queried Fields:**

```sql
-- Instead of querying JSONB repeatedly
SELECT * FROM recordings 
WHERE steps @> '[{"label": "Email Address"}]'::jsonb;

-- Consider materialized view
CREATE MATERIALIZED VIEW recordings_with_fields AS
SELECT 
  r.id,
  r.name,
  jsonb_array_elements(r.steps)->>'label' AS field_label
FROM recordings r;

CREATE INDEX idx_recordings_fields ON recordings_with_fields(field_label);

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY recordings_with_fields;
```

### 8.3 Connection Pooling

**PgBouncer Configuration:**

```ini
[databases]
testrecorder = host=db.supabase.co port=5432 dbname=postgres user=postgres

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
```

---

## Summary

This schema provides:

✅ Complete table definitions for 7 core tables  
✅ JSONB structures for flexible data storage  
✅ Comprehensive indexing for query performance  
✅ Foreign key constraints for data integrity  
✅ Trigger functions for automatic updates  
✅ Phase 1-3 migration scripts  
✅ Performance optimization strategies  
✅ Backward compatibility guaranteed

The canonical `steps` JSONB array format remains unchanged across all phases, ensuring seamless phase transitions without data migrations.
