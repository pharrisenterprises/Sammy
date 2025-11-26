# Web Portal Core Pages

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 2025  
**Status:** Complete Technical Specification

---

## Table of Contents

1. [Overview](#1-overview)
2. [Page Architecture](#2-page-architecture)
3. [Authentication Pages](#3-authentication-pages)
4. [Dashboard Page](#4-dashboard-page)
5. [Project Detail Page](#5-project-detail-page)
6. [Test Runner Page](#6-test-runner-page)

---

## 1. Overview

### 1.1 Purpose

This document specifies the core pages in the Web Portal, including layouts, components, data requirements, and interactions. The portal is built with Next.js 14+ using the App Router.

### 1.2 Page Map

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Landing page | No |
| `/login` | Sign in | No |
| `/register` | Create account | No |
| `/forgot-password` | Password reset request | No |
| `/reset-password` | Password reset form | No |
| `/dashboard` | Project list + stats | Yes |
| `/dashboard/[id]` | Project detail + editor | Yes |
| `/dashboard/[id]/run` | Test execution UI | Yes |
| `/dashboard/[id]/history` | Past test runs | Yes |
| `/dashboard/new` | Create new project | Yes |

---

## 2. Page Architecture

### 2.1 Next.js App Router Structure
```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   └── layout.tsx              # Auth layout (centered card)
│
├── (dashboard)/
│   ├── dashboard/
│   │   ├── page.tsx            # Project list
│   │   ├── new/page.tsx        # Create project
│   │   └── [id]/
│   │       ├── page.tsx        # Project detail
│   │       ├── run/page.tsx    # Test runner
│   │       └── history/page.tsx
│   └── layout.tsx              # Dashboard layout (sidebar)
│
├── api/
│   ├── auth/
│   ├── projects/
│   └── runs/
│
├── layout.tsx                  # Root layout
├── page.tsx                    # Landing page
└── globals.css
```

### 2.2 Dashboard Layout Component
```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## 3. Authentication Pages

### 3.1 Login Page
```typescript
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }
  
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          Sign in to TestFlow
        </h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Link 
              href="/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
          
          <button
            onClick={handleGoogleLogin}
            className="mt-4 w-full flex items-center justify-center gap-2 border py-2 rounded-lg hover:bg-gray-50"
          >
            <GoogleIcon className="w-5 h-5" /> Google
          </button>
        </div>
        
        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### 3.2 Register Page
```typescript
// app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const supabase = createClientComponentClient();
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-4">Check your email</h1>
          <p className="text-gray-600">
            We've sent a verification link to <strong>{email}</strong>.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          Create your account
        </h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" required />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" required minLength={8} />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" required />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

## 4. Dashboard Page

### 4.1 Dashboard Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome back, {name}!                                          │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Projects │ │  Runs    │ │ Pass Rate│ │ Run Time │          │
│  │   12     │ │   45     │ │   87%    │ │  2.5 hrs │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  My Projects                         [+ New] [Grid|List]       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Search: [________________]    Status: [All ▼]          │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ Project A   │ │ Project B   │ │ Project C   │              │
│  │ 15 steps    │ │ 8 steps     │ │ 22 steps    │              │
│  │ ✓ Complete  │ │ ⚠ Testing   │ │ ○ Draft     │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Dashboard Implementation
```typescript
// app/(dashboard)/dashboard/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { StatsCards } from '@/components/dashboard/StatsCards';

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_date', { ascending: false });
  
  const { data: recentRuns } = await supabase
    .from('test_runs')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(100);
  
  const stats = calculateStats(projects || [], recentRuns || []);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back!
        </h1>
        <p className="text-gray-600">
          Here's an overview of your test automation projects.
        </p>
      </div>
      
      <StatsCards stats={stats} />
      <ProjectGrid initialProjects={projects || []} />
    </div>
  );
}

function calculateStats(projects: Project[], runs: TestRun[]): DashboardStats {
  const passedRuns = runs.filter(r => r.status === 'completed').length;
  const passRate = runs.length > 0 ? (passedRuns / runs.length) * 100 : 0;
  const totalRunTime = runs.reduce((sum, r) => {
    if (r.end_time && r.start_time) {
      return sum + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime());
    }
    return sum;
  }, 0);
  
  return { totalProjects: projects.length, totalRuns: runs.length, passRate, totalRunTime };
}
```

### 4.3 Project Card Component
```typescript
// components/dashboard/ProjectCard.tsx
function ProjectCard({ project }: { project: Project }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    testing: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700'
  };
  
  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-gray-900">{project.name}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[project.status]}`}>
          {project.status}
        </span>
      </div>
      
      {project.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{project.description}</p>
      )}
      
      <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
        <span>{project.recorded_steps?.length || 0} steps</span>
        <span>•</span>
        <span>{formatDate(project.updated_date)}</span>
      </div>
    </Link>
  );
}
```

---

## 5. Project Detail Page

### 5.1 Project Detail Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                            │
│                                                                 │
│  Project Name                                           [Edit]  │
│  https://example.com                                            │
│                                                                 │
│  [▶ Run Test] [✎ Edit Steps] [📊 History] [⚙ Settings]        │
│                                                                 │
│  ┌─────────────────┬──────────────────┬───────────────────┐    │
│  │ Steps (15)      │ Mappings (5)     │ CSV Data (100)    │    │
│  └─────────────────┴──────────────────┴───────────────────┘    │
│                                                                 │
│  │ 1. Navigate to https://example.com                      │   │
│  │ 2. Click "Login" button                                 │   │
│  │ 3. Type in "Email" field                                │   │
│  │ 4. Type in "Password" field                             │   │
│  │ 5. Click "Submit" button                                │   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Project Detail Implementation
```typescript
// app/(dashboard)/dashboard/[id]/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ProjectHeader } from '@/components/project/ProjectHeader';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { StepList } from '@/components/project/StepList';
import { FieldMapper } from '@/components/project/FieldMapper';
import { CsvViewer } from '@/components/project/CsvViewer';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();
  
  if (error || !project) notFound();
  
  const { data: recentRuns } = await supabase
    .from('test_runs')
    .select('*')
    .eq('project_id', params.id)
    .order('start_time', { ascending: false })
    .limit(5);
  
  return (
    <div className="space-y-6">
      <ProjectHeader project={project} recentRuns={recentRuns || []} />
      <ProjectTabs
        tabs={[
          { id: 'steps', label: `Steps (${project.recorded_steps?.length || 0})`,
            content: <StepList steps={project.recorded_steps || []} projectId={project.id} /> },
          { id: 'mappings', label: `Mappings (${project.parsed_fields?.length || 0})`,
            content: <FieldMapper steps={project.recorded_steps || []} mappings={project.parsed_fields || []} projectId={project.id} /> },
          { id: 'csv', label: `CSV (${project.csv_data?.length || 0} rows)`,
            content: <CsvViewer data={project.csv_data || []} projectId={project.id} /> }
        ]}
      />
    </div>
  );
}
```

### 5.3 Step List with Drag & Drop
```typescript
// components/project/StepList.tsx
'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export function StepList({ steps, projectId, editable = true }: StepListProps) {
  const [localSteps, setLocalSteps] = useState(steps);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  
  async function handleDragEnd(result: any) {
    if (!result.destination) return;
    
    const items = Array.from(localSteps);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
    const renumbered = items.map((step, index) => ({ ...step, stepNumber: index + 1 }));
    setLocalSteps(renumbered);
    await saveSteps(projectId, renumbered);
  }
  
  async function handleDeleteStep(index: number) {
    const updated = localSteps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, stepNumber: i + 1 }));
    setLocalSteps(updated);
    await saveSteps(projectId, updated);
  }
  
  const stepIcons: Record<string, string> = {
    click: '👆', input: '⌨️', change: '✏️', keydown: '⏎', navigate: '🔗', scroll: '📜'
  };
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="steps">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {localSteps.map((step, index) => (
              <Draggable 
                key={`step-${index}`} 
                draggableId={`step-${index}`} 
                index={index}
                isDragDisabled={!editable}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`p-3 bg-white border rounded-lg mb-2 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                    onClick={() => setSelectedStep(index)}
                  >
                    <div className="flex items-center gap-3">
                      {editable && <div {...provided.dragHandleProps} className="cursor-grab">⋮⋮</div>}
                      <span className="text-sm font-medium text-gray-500 w-8">{step.stepNumber}.</span>
                      <span className="text-lg">{stepIcons[step.event] || '•'}</span>
                      <span className="flex-1">{step.label}</span>
                      {editable && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStep(index); }}
                          className="text-gray-400 hover:text-red-500">🗑</button>
                      )}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

---

## 6. Test Runner Page

### 6.1 Test Runner Implementation
```typescript
// app/(dashboard)/dashboard/[id]/run/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function TestRunnerPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<TestRunResult | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    async function loadProject() {
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (data) setProject(data);
    }
    loadProject();
  }, [projectId]);
  
  // Subscribe to real-time run updates
  useEffect(() => {
    if (!activeRunId) return;
    
    const channel = supabase
      .channel(`run_${activeRunId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'test_runs', filter: `id=eq.${activeRunId}`
      }, (payload) => {
        const run = payload.new;
        setProgress(run.progress || 0);
        if (run.status === 'completed' || run.status === 'failed') {
          setIsRunning(false);
          setResults(run);
        }
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [activeRunId]);
  
  async function startTest() {
    if (!project) return;
    setIsRunning(true);
    setProgress(0);
    setLogs([]);
    setResults(null);
    
    const { data: run, error } = await supabase
      .from('test_runs')
      .insert({ project_id: projectId, status: 'queued', total_steps: project.recorded_steps.length })
      .select().single();
    
    if (error) {
      addLog('error', `Failed to start: ${error.message}`);
      setIsRunning(false);
      return;
    }
    
    setActiveRunId(run.id);
    addLog('info', 'Test queued for execution...');
  }
  
  function stopTest() {
    if (activeRunId) {
      supabase.from('test_runs').update({ status: 'cancelled' }).eq('id', activeRunId);
    }
    setIsRunning(false);
    addLog('warning', 'Test stopped by user');
  }
  
  function addLog(level: 'info' | 'error' | 'warning', message: string) {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), level, message }]);
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project?.name || 'Loading...'}</h1>
          <p className="text-gray-600">{project?.target_url}</p>
        </div>
        
        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={startTest} disabled={!project}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
              ▶ Run Test
            </button>
          ) : (
            <button onClick={stopTest}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
              ⏹ Stop
            </button>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      
      {/* Console and step progress grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 text-white rounded-xl p-4 font-mono text-sm max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-green-400'}`}>
              [{log.timestamp}] {log.message}
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-xl border p-4 max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-2">Steps</h3>
          {project?.recorded_steps?.map((step, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <span className="text-sm text-gray-500">{step.stepNumber}.</span>
              <span className="text-sm">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {results && (
        <div className={`p-4 rounded-xl ${results.status === 'completed' ? 'bg-green-50' : 'bg-red-50'}`}>
          <h2 className="font-bold text-lg">{results.status === 'completed' ? '✅ Test Passed' : '❌ Test Failed'}</h2>
        </div>
      )}
    </div>
  );
}
```

---

## Document End

See **web-portal-supporting-pages.md** for Settings, History, Workspace pages, and shared components.
