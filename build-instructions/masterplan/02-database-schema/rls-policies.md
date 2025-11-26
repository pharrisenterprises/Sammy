# Row Level Security (RLS) Policies

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Status:** Complete Technical Specification  
**Last Updated:** November 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [RLS Fundamentals](#2-rls-fundamentals)
3. [Phase 1 Policies (User-Based)](#3-phase-1-policies-user-based)
4. [Phase 3 Policies (Team-Based)](#4-phase-3-policies-team-based)
5. [Helper Functions](#5-helper-functions)
6. [Policy Reference Table](#6-policy-reference-table)
7. [Testing RLS Policies](#7-testing-rls-policies)
8. [Troubleshooting](#8-troubleshooting)
9. [Migration Scripts](#9-migration-scripts)

---

## 1. Overview

Row Level Security (RLS) provides database-level access control in PostgreSQL/Supabase. This document defines all RLS policies for the Chrome Extension Test Recorder, ensuring:

- **Data Isolation:** Users can only access their own data
- **Team Sharing:** (Phase 3) Team members can access shared recordings
- **Defense in Depth:** Security enforced at database level, not just application

### 1.1 Security Principle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                                  │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         Application Layer           │
                    │   (API routes, middleware, auth)    │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         Supabase Auth               │
                    │     (JWT tokens, session mgmt)      │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │      Row Level Security (RLS)       │◄── THIS DOCUMENT
                    │   (Database-enforced policies)      │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         PostgreSQL Tables           │
                    │        (recordings, jobs, etc)      │
                    └─────────────────────────────────────┘
```

### 1.2 Key Concepts

| Concept | Description |
|---------|-------------|
| `auth.uid()` | Returns the UUID of the currently authenticated user from the JWT |
| `USING` clause | Filter for SELECT, UPDATE, DELETE operations |
| `WITH CHECK` clause | Validation for INSERT, UPDATE operations |
| `FOR ALL` | Policy applies to all operations (SELECT, INSERT, UPDATE, DELETE) |
| Permissive vs Restrictive | Permissive policies OR together; restrictive AND together |

---

## 2. RLS Fundamentals

### 2.1 Enabling RLS

RLS must be explicitly enabled on each table:

```sql
-- Enable RLS on a table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (recommended for security)
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;
```

### 2.2 Policy Structure

```sql
CREATE POLICY policy_name ON table_name
  [AS PERMISSIVE | RESTRICTIVE]  -- Default: PERMISSIVE
  FOR [ALL | SELECT | INSERT | UPDATE | DELETE]
  TO [role_name | PUBLIC]        -- Default: PUBLIC
  USING (condition)              -- Filter for existing rows
  WITH CHECK (condition);        -- Validation for new/updated rows
```

### 2.3 Auth Functions

Supabase provides helper functions for RLS:

```sql
-- Get current user's UUID
auth.uid()

-- Get current user's JWT claims
auth.jwt()

-- Get current user's role
auth.role()

-- Example usage in policy
CREATE POLICY example_policy ON recordings
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 3. Phase 1 Policies (User-Based)

Phase 1 implements simple user-based access control where each user can only access their own data.

### 3.1 Users Table

```sql
-- ============================================
-- USERS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users cannot delete their own account via RLS (use admin function)
-- No INSERT policy needed - handled by Supabase Auth trigger
```

### 3.2 Recordings Table

```sql
-- ============================================
-- RECORDINGS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own recordings
CREATE POLICY recordings_select_own ON recordings
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create recordings for themselves
CREATE POLICY recordings_insert_own ON recordings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own recordings
CREATE POLICY recordings_update_own ON recordings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete (archive) their own recordings
CREATE POLICY recordings_delete_own ON recordings
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 3.3 Execution Jobs Table

```sql
-- ============================================
-- EXECUTION JOBS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE execution_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own execution jobs
CREATE POLICY execution_jobs_select_own ON execution_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create jobs only for recordings they own
CREATE POLICY execution_jobs_insert_own ON execution_jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM recordings
      WHERE id = recording_id
      AND user_id = auth.uid()
    )
  );

-- UPDATE: Users can update their own jobs (pause, cancel, etc.)
CREATE POLICY execution_jobs_update_own ON execution_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own jobs
CREATE POLICY execution_jobs_delete_own ON execution_jobs
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 3.4 Execution Results Table

```sql
-- ============================================
-- EXECUTION RESULTS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view results for their own jobs
CREATE POLICY execution_results_select_own ON execution_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM execution_jobs
      WHERE id = execution_job_id
      AND user_id = auth.uid()
    )
  );

-- INSERT: Only VDI service can insert (via service role, bypasses RLS)
-- No user-facing INSERT policy needed

-- UPDATE: Only VDI service can update
-- No user-facing UPDATE policy needed

-- DELETE: Users can delete results for their own jobs
CREATE POLICY execution_results_delete_own ON execution_results
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM execution_jobs
      WHERE id = execution_job_id
      AND user_id = auth.uid()
    )
  );
```

### 3.5 Execution Logs Table

```sql
-- ============================================
-- EXECUTION LOGS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view logs for their own jobs
CREATE POLICY execution_logs_select_own ON execution_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM execution_jobs
      WHERE id = execution_job_id
      AND user_id = auth.uid()
    )
  );

-- INSERT: Only VDI service can insert logs
-- No user-facing INSERT policy needed

-- DELETE: Users can delete logs for their own jobs
CREATE POLICY execution_logs_delete_own ON execution_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM execution_jobs
      WHERE id = execution_job_id
      AND user_id = auth.uid()
    )
  );
```

### 3.6 Healing Logs Table

```sql
-- ============================================
-- HEALING LOGS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE healing_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view healing logs for their own recordings
CREATE POLICY healing_logs_select_own ON healing_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE id = recording_id
      AND user_id = auth.uid()
    )
  );

-- INSERT: Only VDI service can insert healing logs
-- No user-facing INSERT policy needed

-- DELETE: Users can delete healing logs for their own recordings
CREATE POLICY healing_logs_delete_own ON healing_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE id = recording_id
      AND user_id = auth.uid()
    )
  );
```

### 3.7 VDI Metrics Table

```sql
-- ============================================
-- VDI METRICS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE vdi_metrics ENABLE ROW LEVEL SECURITY;

-- VDI metrics are system-level, no user access via RLS
-- All access via service role key (bypasses RLS)

-- Optionally allow admins to view metrics
-- CREATE POLICY vdi_metrics_admin_view ON vdi_metrics
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE id = auth.uid()
--       AND tier = 'enterprise'
--     )
--   );
```

---

## 4. Phase 3 Policies (Team-Based)

Phase 3 extends RLS to support team-based access control.

### 4.1 Team Tables RLS

```sql
-- ============================================
-- TEAMS TABLE RLS
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Users can view teams they belong to
CREATE POLICY teams_select_member ON teams
  FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Only admins can update team settings
CREATE POLICY teams_update_admin ON teams
  FOR UPDATE
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

-- ============================================
-- TEAM MEMBERS TABLE RLS
-- ============================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY team_members_select_own ON team_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can see other members of teams they belong to
CREATE POLICY team_members_select_team ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members AS tm
      WHERE tm.user_id = auth.uid()
      AND tm.status = 'active'
    )
  );

-- Only team admins can modify memberships
CREATE POLICY team_members_manage_admin ON team_members
  FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members AS tm
      WHERE tm.user_id = auth.uid()
      AND tm.role = 'admin'
      AND tm.status = 'active'
    )
  );
```

### 4.2 Updated Recordings Policy (Team Access)

```sql
-- ============================================
-- RECORDINGS TABLE RLS (PHASE 3 UPDATE)
-- ============================================

-- Drop Phase 1 policies
DROP POLICY IF EXISTS recordings_select_own ON recordings;
DROP POLICY IF EXISTS recordings_insert_own ON recordings;
DROP POLICY IF EXISTS recordings_update_own ON recordings;
DROP POLICY IF EXISTS recordings_delete_own ON recordings;

-- SELECT: Own recordings OR team recordings (if member)
CREATE POLICY recordings_select_phase3 ON recordings
  FOR SELECT
  USING (
    -- Own recordings
    auth.uid() = user_id
    OR
    -- Team recordings where user is active member
    (
      team_id IS NOT NULL
      AND visibility IN ('team', 'public')
      AND team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid()
        AND status = 'active'
      )
    )
  );

-- INSERT: Users can create recordings for themselves
-- Team assignment happens via separate update
CREATE POLICY recordings_insert_phase3 ON recordings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Own recordings OR team recordings with edit permission
CREATE POLICY recordings_update_phase3 ON recordings
  FOR UPDATE
  USING (
    -- Own recordings
    auth.uid() = user_id
    OR
    -- Team recordings where user has edit permission
    (
      team_id IS NOT NULL
      AND team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid()
        AND status = 'active'
        AND (
          role IN ('admin', 'manager')
          OR 'recording.edit' = ANY(permissions)
        )
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- DELETE: Only own recordings (not team recordings)
CREATE POLICY recordings_delete_phase3 ON recordings
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 4.3 Updated Execution Jobs Policy (Team Access)

```sql
-- ============================================
-- EXECUTION JOBS TABLE RLS (PHASE 3 UPDATE)
-- ============================================

-- Drop Phase 1 policies
DROP POLICY IF EXISTS execution_jobs_select_own ON execution_jobs;
DROP POLICY IF EXISTS execution_jobs_insert_own ON execution_jobs;
DROP POLICY IF EXISTS execution_jobs_update_own ON execution_jobs;
DROP POLICY IF EXISTS execution_jobs_delete_own ON execution_jobs;

-- SELECT: Own jobs OR team jobs
CREATE POLICY execution_jobs_select_phase3 ON execution_jobs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- INSERT: Can create jobs for own recordings OR team recordings with run permission
CREATE POLICY execution_jobs_insert_phase3 ON execution_jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.id = recording_id
      AND (
        r.user_id = auth.uid()
        OR (
          r.team_id IS NOT NULL
          AND r.team_id IN (
            SELECT team_id FROM team_members tm
            WHERE tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND (
              tm.role IN ('admin', 'manager', 'member')
              OR 'execution.run' = ANY(tm.permissions)
            )
          )
        )
      )
    )
  );

-- UPDATE: Own jobs OR team admin
CREATE POLICY execution_jobs_update_phase3 ON execution_jobs
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
      AND status = 'active'
    )
  );

-- DELETE: Only own jobs
CREATE POLICY execution_jobs_delete_phase3 ON execution_jobs
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 4.4 Audit Logs Policy

```sql
-- ============================================
-- AUDIT LOGS TABLE RLS
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only team admins can view audit logs
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

-- INSERT: System only (via service role)
-- No user-facing INSERT policy

-- Audit logs cannot be modified or deleted by users
-- No UPDATE or DELETE policies
```

---

## 5. Helper Functions

### 5.1 Check Team Membership

```sql
-- Function to check if user is member of a team
CREATE OR REPLACE FUNCTION is_team_member(
  p_user_id UUID,
  p_team_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = p_user_id
    AND team_id = p_team_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2 Check Team Role

```sql
-- Function to check user's role in a team
CREATE OR REPLACE FUNCTION get_team_role(
  p_user_id UUID,
  p_team_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM team_members
  WHERE user_id = p_user_id
  AND team_id = p_team_id
  AND status = 'active';
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.3 Check Permission

```sql
-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_team_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_permissions TEXT[];
BEGIN
  SELECT role, permissions INTO v_role, v_permissions
  FROM team_members
  WHERE user_id = p_user_id
  AND team_id = p_team_id
  AND status = 'active';
  
  -- Admin has all permissions
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check explicit permission
  RETURN p_permission = ANY(v_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Policy Reference Table

### 6.1 Phase 1 Policies Summary

| Table | Operation | Policy Name | Condition |
|-------|-----------|-------------|-----------|
| users | SELECT | users_select_own | `auth.uid() = id` |
| users | UPDATE | users_update_own | `auth.uid() = id` |
| recordings | SELECT | recordings_select_own | `auth.uid() = user_id` |
| recordings | INSERT | recordings_insert_own | `auth.uid() = user_id` |
| recordings | UPDATE | recordings_update_own | `auth.uid() = user_id` |
| recordings | DELETE | recordings_delete_own | `auth.uid() = user_id` |
| execution_jobs | SELECT | execution_jobs_select_own | `auth.uid() = user_id` |
| execution_jobs | INSERT | execution_jobs_insert_own | `auth.uid() = user_id` + owns recording |
| execution_jobs | UPDATE | execution_jobs_update_own | `auth.uid() = user_id` |
| execution_jobs | DELETE | execution_jobs_delete_own | `auth.uid() = user_id` |
| execution_results | SELECT | execution_results_select_own | owns parent job |
| execution_results | DELETE | execution_results_delete_own | owns parent job |
| execution_logs | SELECT | execution_logs_select_own | owns parent job |
| execution_logs | DELETE | execution_logs_delete_own | owns parent job |
| healing_logs | SELECT | healing_logs_select_own | owns parent recording |
| healing_logs | DELETE | healing_logs_delete_own | owns parent recording |

### 6.2 Phase 3 Additions

| Table | Operation | Policy Name | Condition |
|-------|-----------|-------------|-----------|
| teams | SELECT | teams_select_member | is active team member |
| teams | UPDATE | teams_update_admin | is team admin |
| team_members | SELECT | team_members_select_* | own or same team |
| team_members | ALL | team_members_manage_admin | is team admin |
| recordings | SELECT | recordings_select_phase3 | own OR team member |
| recordings | UPDATE | recordings_update_phase3 | own OR has edit permission |
| execution_jobs | SELECT | execution_jobs_select_phase3 | own OR team member |
| audit_logs | SELECT | audit_logs_select_admin | is team admin |

---

## 7. Testing RLS Policies

### 7.1 Testing Setup

```sql
-- Test as a specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Or using Supabase's test helpers
SELECT set_config('request.jwt.claims', 
  json_build_object('sub', 'user-uuid-here')::text, 
  true
);
```

### 7.2 Test Cases

```sql
-- ============================================
-- TEST: User can only see own recordings
-- ============================================

-- Setup: Create two users and their recordings
INSERT INTO recordings (id, user_id, name, starting_url, status, steps)
VALUES 
  ('rec-1', 'user-1', 'User 1 Recording', 'https://example.com', 'completed', '[]'),
  ('rec-2', 'user-2', 'User 2 Recording', 'https://example.com', 'completed', '[]');

-- Test as User 1
SET LOCAL request.jwt.claims = '{"sub": "user-1"}';
SELECT * FROM recordings;
-- Expected: Only rec-1 returned

-- Test as User 2
SET LOCAL request.jwt.claims = '{"sub": "user-2"}';
SELECT * FROM recordings;
-- Expected: Only rec-2 returned

-- ============================================
-- TEST: User cannot insert recording for another user
-- ============================================

SET LOCAL request.jwt.claims = '{"sub": "user-1"}';
INSERT INTO recordings (id, user_id, name, starting_url, status, steps)
VALUES ('rec-3', 'user-2', 'Malicious Insert', 'https://evil.com', 'completed', '[]');
-- Expected: Error - violates RLS policy

-- ============================================
-- TEST: Team member can see shared recordings
-- ============================================

-- Setup: Create team and add users
INSERT INTO teams (id, name) VALUES ('team-1', 'Test Team');
INSERT INTO team_members (team_id, user_id, role, status) 
VALUES ('team-1', 'user-1', 'admin', 'active'),
       ('team-1', 'user-2', 'member', 'active');

-- Create team recording
UPDATE recordings SET team_id = 'team-1', visibility = 'team' WHERE id = 'rec-1';

-- Test as User 2 (team member)
SET LOCAL request.jwt.claims = '{"sub": "user-2"}';
SELECT * FROM recordings WHERE team_id = 'team-1';
-- Expected: rec-1 returned (shared via team)
```

### 7.3 Performance Testing

```sql
-- Check query plan with RLS
EXPLAIN ANALYZE
SELECT * FROM recordings WHERE user_id = 'some-uuid';

-- Verify index usage
-- Expected: Index scan on idx_recordings_user_id
```

---

## 8. Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "permission denied for table" | RLS enabled but no policies | Add appropriate policies |
| Empty results (should have data) | Policy too restrictive | Check USING clause |
| Insert fails | WITH CHECK clause fails | Verify user_id matches auth.uid() |
| Subquery in policy slow | Missing indexes | Add indexes on foreign keys |

### 8.2 Debugging Queries

```sql
-- Check which policies exist
SELECT * FROM pg_policies WHERE tablename = 'recordings';

-- Check if RLS is enabled
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE relname = 'recordings';

-- Test policy condition directly
SELECT 
  id,
  user_id,
  auth.uid() = user_id AS can_access
FROM recordings;
```

### 8.3 Bypassing RLS (Admin Only)

```sql
-- Service role key bypasses RLS automatically
-- For debugging, temporarily disable RLS:
ALTER TABLE recordings DISABLE ROW LEVEL SECURITY;

-- Re-enable after debugging
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
```

---

## 9. Migration Scripts

### 9.1 Phase 1 RLS Migration

```sql
-- ============================================
-- MIGRATION: 001_enable_rls_phase1
-- ============================================

BEGIN;

-- Enable RLS on all user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE healing_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Recordings policies
CREATE POLICY recordings_select_own ON recordings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY recordings_insert_own ON recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY recordings_update_own ON recordings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY recordings_delete_own ON recordings FOR DELETE USING (auth.uid() = user_id);

-- Execution jobs policies
CREATE POLICY execution_jobs_select_own ON execution_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY execution_jobs_insert_own ON execution_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM recordings WHERE id = recording_id AND user_id = auth.uid()));
CREATE POLICY execution_jobs_update_own ON execution_jobs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY execution_jobs_delete_own ON execution_jobs FOR DELETE USING (auth.uid() = user_id);

-- Execution results policies
CREATE POLICY execution_results_select_own ON execution_results FOR SELECT 
  USING (EXISTS (SELECT 1 FROM execution_jobs WHERE id = execution_job_id AND user_id = auth.uid()));
CREATE POLICY execution_results_delete_own ON execution_results FOR DELETE 
  USING (EXISTS (SELECT 1 FROM execution_jobs WHERE id = execution_job_id AND user_id = auth.uid()));

-- Execution logs policies
CREATE POLICY execution_logs_select_own ON execution_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM execution_jobs WHERE id = execution_job_id AND user_id = auth.uid()));
CREATE POLICY execution_logs_delete_own ON execution_logs FOR DELETE 
  USING (EXISTS (SELECT 1 FROM execution_jobs WHERE id = execution_job_id AND user_id = auth.uid()));

-- Healing logs policies
CREATE POLICY healing_logs_select_own ON healing_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM recordings WHERE id = recording_id AND user_id = auth.uid()));
CREATE POLICY healing_logs_delete_own ON healing_logs FOR DELETE 
  USING (EXISTS (SELECT 1 FROM recordings WHERE id = recording_id AND user_id = auth.uid()));

COMMIT;
```

### 9.2 Phase 3 RLS Migration

```sql
-- ============================================
-- MIGRATION: 003_enable_rls_phase3
-- ============================================

BEGIN;

-- Enable RLS on new team tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY teams_select_member ON teams FOR SELECT 
  USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY teams_update_admin ON teams FOR UPDATE 
  USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- Team members policies
CREATE POLICY team_members_select_own ON team_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY team_members_select_team ON team_members FOR SELECT 
  USING (team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'));

-- Drop Phase 1 recordings policies
DROP POLICY IF EXISTS recordings_select_own ON recordings;
DROP POLICY IF EXISTS recordings_update_own ON recordings;

-- Create Phase 3 recordings policies
CREATE POLICY recordings_select_phase3 ON recordings FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR (team_id IS NOT NULL AND visibility IN ('team', 'public') 
        AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'))
  );

CREATE POLICY recordings_update_phase3 ON recordings FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND status = 'active'))
  );

-- Audit logs policy
CREATE POLICY audit_logs_select_admin ON audit_logs FOR SELECT 
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

COMMIT;
```

---

## Document End

This document provides comprehensive Row Level Security policies for all phases of the Chrome Extension Test Recorder, ensuring data isolation and proper access control at the database level.
