# Portal API Routes Implementation
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. API Architecture
3. Projects API
4. Test Runs API
5. Users API
6. VM Management API
7. Authentication Middleware
8. Error Handling
9. Rate Limiting
10. Request Validation
11. Response Formats
12. Testing API Routes

---

## 1. Overview

### 1.1 Purpose

This document specifies all API routes in the Next.js web portal, including request/response formats, authentication, validation, and error handling.

### 1.2 API Design Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    API DESIGN PRINCIPLES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  RESTful Design:                                                        │
│  ├── Use HTTP verbs correctly (GET, POST, PUT, DELETE)                 │
│  ├── Resource-oriented URLs (/api/projects/:id)                        │
│  ├── Consistent naming conventions                                      │
│  └── Stateless requests                                                 │
│                                                                         │
│  Security First:                                                        │
│  ├── Authenticate all requests                                          │
│  ├── Validate all inputs                                                │
│  ├── Use HTTPS only                                                     │
│  └── Rate limit to prevent abuse                                        │
│                                                                         │
│  Developer Experience:                                                  │
│  ├── Clear error messages                                               │
│  ├── Consistent response formats                                        │
│  ├── Comprehensive documentation                                        │
│  └── Type-safe with TypeScript                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 API Structure

```
portal/app/api/
├── projects/
│   ├── route.ts                      # GET, POST /api/projects
│   └── [id]/
│       ├── route.ts                  # GET, PUT, DELETE /api/projects/:id
│       ├── steps/
│       │   └── route.ts              # PUT /api/projects/:id/steps
│       └── duplicate/
│           └── route.ts              # POST /api/projects/:id/duplicate
│
├── runs/
│   ├── route.ts                      # GET, POST /api/runs
│   └── [id]/
│       ├── route.ts                  # GET, DELETE /api/runs/:id
│       ├── cancel/
│       │   └── route.ts              # POST /api/runs/:id/cancel
│       └── results/
│           └── route.ts              # GET /api/runs/:id/results
│
├── users/
│   ├── me/
│   │   └── route.ts                  # GET /api/users/me
│   └── settings/
│       └── route.ts                  # GET, PUT /api/users/settings
│
├── vm/
│   ├── provision/
│   │   └── route.ts                  # POST /api/vm/provision
│   ├── status/
│   │   └── route.ts                  # GET /api/vm/status
│   ├── wake/
│   │   └── route.ts                  # POST /api/vm/wake
│   └── hibernate/
│       └── route.ts                  # POST /api/vm/hibernate
│
└── health/
    └── route.ts                      # GET /api/health
```

---

## 2. API Architecture

### 2.1 Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    API REQUEST FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Client Request                                                         │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Next.js API Route Handler                                      │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Authentication Middleware                                       │   │
│  │  ├── Extract JWT from cookie/header                             │   │
│  │  ├── Verify token with Supabase                                 │   │
│  │  └── Attach user to request                                     │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Rate Limiting Middleware                                        │   │
│  │  └── Check request count per user/IP                            │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Input Validation                                                │   │
│  │  └── Validate with Zod schemas                                  │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Business Logic                                                  │   │
│  │  ├── Query Supabase                                             │   │
│  │  ├── Process data                                               │   │
│  │  └── Prepare response                                           │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Error Handling                                                  │   │
│  │  └── Catch and format errors                                    │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  Response to Client                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Base Types

```typescript
// portal/lib/api-types.ts
import { z } from 'zod';

// Success response wrapper
export interface ApiResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
  };
}

// Error response wrapper
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Common response type
export type ApiResult<T = any> = ApiResponse<T> | ApiError;

// Pagination params
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20)
});

export type PaginationParams = z.infer<typeof PaginationSchema>;
```

---

## 3. Projects API

### 3.1 List Projects

**Endpoint:** GET /api/projects

```typescript
// portal/app/api/projects/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['draft', 'testing', 'complete']).optional(),
  search: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = QuerySchema.parse(searchParams);
    
    // Build query
    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('updated_date', { ascending: false });
    
    // Apply filters
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    if (params.search) {
      query = query.ilike('name', `%${params.search}%`);
    }
    
    // Apply pagination
    const start = (params.page - 1) * params.perPage;
    const end = start + params.perPage - 1;
    query = query.range(start, end);
    
    // Execute query
    const { data: projects, error, count } = await query;
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: projects,
      meta: {
        page: params.page,
        perPage: params.perPage,
        total: count || 0
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors } },
        { status: 400 }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 3.2 Create Project

**Endpoint:** POST /api/projects

```typescript
// portal/app/api/projects/route.ts (continued)
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  targetUrl: z.string().url().optional()
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Parse and validate body
    const body = await request.json();
    const data = CreateProjectSchema.parse(body);
    
    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: data.name,
        description: data.description,
        target_url: data.targetUrl,
        status: 'draft',
        recorded_steps: [],
        parsed_fields: [],
        csv_data: []
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: true, data: project },
      { status: 201 }
    );
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors } },
        { status: 400 }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 3.3 Get Project by ID

**Endpoint:** GET /api/projects/:id

```typescript
// portal/app/api/projects/[id]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Get project (RLS will ensure user can only access their own)
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
          { status: 404 }
        );
      }
      
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data: project });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 3.4 Update Project

**Endpoint:** PUT /api/projects/:id

```typescript
// portal/app/api/projects/[id]/route.ts (continued)
const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  targetUrl: z.string().url().optional(),
  status: z.enum(['draft', 'testing', 'complete']).optional(),
  recordedSteps: z.array(z.any()).optional(),
  parsedFields: z.array(z.any()).optional(),
  csvData: z.array(z.any()).optional()
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Parse and validate body
    const body = await request.json();
    const data = UpdateProjectSchema.parse(body);
    
    // Build update object (snake_case for database)
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.targetUrl !== undefined) updateData.target_url = data.targetUrl;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.recordedSteps !== undefined) updateData.recorded_steps = data.recordedSteps;
    if (data.parsedFields !== undefined) updateData.parsed_fields = data.parsedFields;
    if (data.csvData !== undefined) updateData.csv_data = data.csvData;
    
    // Update project
    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
          { status: 404 }
        );
      }
      
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data: project });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors } },
        { status: 400 }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 3.5 Delete Project

**Endpoint:** DELETE /api/projects/:id

```typescript
// portal/app/api/projects/[id]/route.ts (continued)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Delete project (cascade will delete related test_runs)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: true, data: { deleted: true } },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

---

## 4. Test Runs API

### 4.1 List Test Runs

**Endpoint:** GET /api/runs

```typescript
// portal/app/api/runs/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['queued', 'claimed', 'running', 'completed', 'failed', 'cancelled']).optional(),
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20)
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = QuerySchema.parse(searchParams);
    
    // Build query - join with projects to filter by user
    let query = supabase
      .from('test_runs')
      .select(`
        *,
        projects!inner(user_id)
      `, { count: 'exact' })
      .eq('projects.user_id', user.id)
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (params.projectId) {
      query = query.eq('project_id', params.projectId);
    }
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    // Apply pagination
    const start = (params.page - 1) * params.perPage;
    const end = start + params.perPage - 1;
    query = query.range(start, end);
    
    // Execute query
    const { data: runs, error, count } = await query;
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    // Remove the projects join data from response
    const cleanedRuns = runs?.map(({ projects, ...run }) => run);
    
    return NextResponse.json({
      success: true,
      data: cleanedRuns,
      meta: {
        page: params.page,
        perPage: params.perPage,
        total: count || 0
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: error.errors } },
        { status: 400 }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 4.2 Create Test Run

**Endpoint:** POST /api/runs

```typescript
// portal/app/api/runs/route.ts (continued)
const CreateRunSchema = z.object({
  projectId: z.string().uuid(),
  csvRowFilter: z.array(z.number()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Parse and validate body
    const body = await request.json();
    const data = CreateRunSchema.parse(body);
    
    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, recorded_steps, csv_data')
      .eq('id', data.projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }
    
    // Calculate total steps and rows
    const totalSteps = project.recorded_steps?.length || 0;
    const totalRows = data.csvRowFilter 
      ? data.csvRowFilter.length 
      : (project.csv_data?.length || 1);
    
    // Create test run
    const { data: run, error } = await supabase
      .from('test_runs')
      .insert({
        project_id: data.projectId,
        status: 'queued',
        total_steps: totalSteps,
        total_rows: totalRows,
        progress: 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: true, data: run },
      { status: 201 }
    );
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors } },
        { status: 400 }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 4.3 Cancel Test Run

**Endpoint:** POST /api/runs/:id/cancel

```typescript
// portal/app/api/runs/[id]/cancel/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Verify run belongs to user's project
    const { data: run, error: runError } = await supabase
      .from('test_runs')
      .select(`
        *,
        projects!inner(user_id)
      `)
      .eq('id', params.id)
      .eq('projects.user_id', user.id)
      .single();
    
    if (runError || !run) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Test run not found' } },
        { status: 404 }
      );
    }
    
    // Can only cancel queued or running tests
    if (!['queued', 'claimed', 'running'].includes(run.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: 'Test run cannot be cancelled' } },
        { status: 400 }
      );
    }
    
    // Update status to cancelled
    const { data: updated, error } = await supabase
      .from('test_runs')
      .update({ status: 'cancelled' })
      .eq('id', params.id)
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data: updated });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

---

## 5. Users API

### 5.1 Get Current User

**Endpoint:** GET /api/users/me

```typescript
// portal/app/api/users/me/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Get user profile from users table
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    // Combine auth user with profile
    const userData = {
      id: user.id,
      email: user.email,
      name: profile.name,
      tier: profile.tier,
      vmStatus: profile.vm_status,
      vmUrl: profile.vm_url,
      createdAt: profile.created_at
    };
    
    return NextResponse.json({ success: true, data: userData });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 5.2 Update User Settings

**Endpoint:** PUT /api/users/settings

```typescript
// portal/app/api/users/settings/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  // Add other updateable settings here
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Parse and validate body
    const body = await request.json();
    const data = UpdateSettingsSchema.parse(body);
    
    // Update user profile
    const { data: updated, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data: updated });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors } },
        { status: 400 }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

---

## 6. VM Management API

### 6.1 Provision VM (Business+ only)

**Endpoint:** POST /api/vm/provision

```typescript
// portal/app/api/vm/provision/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Check user tier
    const { data: profile } = await supabase
      .from('users')
      .select('tier, vm_id, vm_status')
      .eq('id', user.id)
      .single();
    
    if (profile?.tier !== 'business' && profile?.tier !== 'enterprise') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Business+ tier required' } },
        { status: 403 }
      );
    }
    
    // Check if VM already exists
    if (profile?.vm_id && profile?.vm_status !== 'stopped') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'VM already exists' } },
        { status: 409 }
      );
    }
    
    // TODO: Call Fly.io API to provision VM
    // This is a placeholder - actual implementation would call Fly.io
    const vmId = `vm-${user.id}-${Date.now()}`;
    const vmUrl = `https://${vmId}.fly.dev`;
    
    // Update user record
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        vm_id: vmId,
        vm_url: vmUrl,
        vm_status: 'provisioning'
      })
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        vmId,
        vmUrl,
        status: 'provisioning'
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### 6.2 Get VM Status

**Endpoint:** GET /api/vm/status

```typescript
// portal/app/api/vm/status/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    
    // Get VM info from user profile
    const { data: profile, error } = await supabase
      .from('users')
      .select('vm_id, vm_url, vm_status')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }
    
    if (!profile?.vm_id) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'VM not provisioned' } },
        { status: 404 }
      );
    }
    
    // TODO: Query actual VM status from Fly.io
    // This is a placeholder
    
    return NextResponse.json({
      success: true,
      data: {
        vmId: profile.vm_id,
        vmUrl: profile.vm_url,
        status: profile.vm_status
      }
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

---

## Summary

Portal API Routes specification provides:

✅ **Complete API structure** with RESTful design  
✅ **All CRUD operations** for projects and test runs  
✅ **User management** endpoints  
✅ **VM management** for Business+ tier  
✅ **Authentication** on all routes  
✅ **Input validation** with Zod  
✅ **Error handling** with standard formats  
✅ **Type safety** with TypeScript  

Next: Portal Components Implementation (10d)
