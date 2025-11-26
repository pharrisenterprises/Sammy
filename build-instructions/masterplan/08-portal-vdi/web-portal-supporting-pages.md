# Web Portal Supporting Pages

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 2025  
**Status:** Complete Technical Specification

---

## Table of Contents

1. [Run History Page](#1-run-history-page)
2. [Settings Pages](#2-settings-pages)
3. [Workspace Page (Cloud Browser)](#3-workspace-page)
4. [Shared Components](#4-shared-components)
5. [State Management](#5-state-management)
6. [Responsive Design](#6-responsive-design)

---

## 1. Run History Page

### 1.1 History Implementation
```typescript
// app/(dashboard)/dashboard/[id]/history/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { HistoryList } from '@/components/history/HistoryList';
import { HistoryChart } from '@/components/history/HistoryChart';

export default async function HistoryPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', params.id).single();
  
  const { data: runs } = await supabase
    .from('test_runs')
    .select('*')
    .eq('project_id', params.id)
    .order('start_time', { ascending: false });
  
  const trends = calculateTrends(runs || []);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project?.name} - History</h1>
          <p className="text-gray-600">{runs?.length || 0} test runs</p>
        </div>
      </div>
      
      {runs && runs.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-4">Pass Rate Over Time</h2>
          <HistoryChart data={trends} />
        </div>
      )}
      
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">All Runs</h2>
        </div>
        <HistoryList runs={runs || []} projectId={params.id} />
      </div>
    </div>
  );
}

function calculateTrends(runs: TestRun[]) {
  // Group by day and calculate pass rates
  const byDay = runs.reduce((acc, run) => {
    const day = new Date(run.start_time).toLocaleDateString();
    if (!acc[day]) acc[day] = { total: 0, passed: 0 };
    acc[day].total++;
    if (run.status === 'completed') acc[day].passed++;
    return acc;
  }, {} as Record<string, { total: number; passed: number }>);
  
  return Object.entries(byDay).map(([date, { total, passed }]) => ({
    date,
    passRate: (passed / total) * 100
  }));
}
```

### 1.2 History List Component
```typescript
// components/history/HistoryList.tsx
export function HistoryList({ runs, projectId }: { runs: TestRun[]; projectId: string }) {
  const statusColors = {
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700'
  };
  
  return (
    <div className="divide-y">
      {runs.map(run => (
        <div key={run.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[run.status]}`}>
                {run.status}
              </span>
              <div>
                <p className="text-sm font-medium">{formatDate(run.start_time)}</p>
                <p className="text-xs text-gray-500">
                  {run.steps_passed}/{run.total_steps} steps passed
                  {run.duration && ` • ${formatDuration(run.duration)}`}
                </p>
              </div>
            </div>
          </div>
          <Link href={`/dashboard/${projectId}/run/${run.id}`} className="text-sm text-blue-600 hover:underline">
            View Details →
          </Link>
        </div>
      ))}
    </div>
  );
}
```

---

## 2. Settings Pages

### 2.1 Settings Layout
```typescript
// app/(dashboard)/settings/layout.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { href: '/settings/profile', label: 'Profile' },
    { href: '/settings/preferences', label: 'Preferences' },
    { href: '/settings/billing', label: 'Billing' }
  ];
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="flex gap-4 border-b mb-6">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2 border-b-2 border-transparent hover:border-gray-300"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      
      {children}
    </div>
  );
}
```

### 2.2 Profile Settings
```typescript
// app/(dashboard)/settings/profile/page.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useUser();
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const supabase = createClientComponentClient();
  
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    
    const { error } = await supabase.auth.updateUser({ data: { name } });
    
    setMessage(error 
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Profile updated successfully' }
    );
    
    if (!error) refreshUser();
    setSaving(false);
  }
  
  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
      
      {message && (
        <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2 border rounded-lg bg-gray-50" />
          <p className="text-xs text-gray-500 mt-1">Contact support to change your email</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
        </div>
        
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
```

### 2.3 Preferences Settings
```typescript
// app/(dashboard)/settings/preferences/page.tsx
'use client';

import { useState } from 'react';

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState({
    defaultTimeout: 30,
    screenshotsOnError: true,
    emailNotifications: true,
    autoRetry: true,
    retryCount: 2
  });
  
  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Execution Preferences</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Timeout (seconds)</label>
          <input type="number" value={preferences.defaultTimeout}
            onChange={(e) => setPreferences(p => ({ ...p, defaultTimeout: parseInt(e.target.value) }))}
            className="w-32 px-3 py-2 border rounded-lg" />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Screenshots on Error</p>
            <p className="text-sm text-gray-500">Capture screenshot when a step fails</p>
          </div>
          <Toggle checked={preferences.screenshotsOnError}
            onChange={(v) => setPreferences(p => ({ ...p, screenshotsOnError: v }))} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Auto-Retry Failed Steps</p>
            <p className="text-sm text-gray-500">Automatically retry failed steps before marking as failed</p>
          </div>
          <Toggle checked={preferences.autoRetry}
            onChange={(v) => setPreferences(p => ({ ...p, autoRetry: v }))} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Email Notifications</p>
            <p className="text-sm text-gray-500">Receive email when tests complete or fail</p>
          </div>
          <Toggle checked={preferences.emailNotifications}
            onChange={(v) => setPreferences(p => ({ ...p, emailNotifications: v }))} />
        </div>
      </div>
      
      <button className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
        Save Preferences
      </button>
    </div>
  );
}
```

---

## 3. Workspace Page (Cloud Browser)

### 3.1 Workspace Implementation
```typescript
// app/(dashboard)/workspace/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import RFB from '@novnc/novnc/lib/rfb';

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const recordingId = searchParams.get('recording');
  
  const [vmStatus, setVmStatus] = useState<'checking' | 'waking' | 'ready' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    checkVMStatus();
    return () => { if (rfbRef.current) rfbRef.current.disconnect(); };
  }, []);
  
  async function checkVMStatus() {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('users')
        .select('vm_id, vm_url, vm_status')
        .eq('id', user?.user?.id)
        .single();
      
      if (!profile?.vm_id) {
        setError('No cloud browser provisioned. Upgrade to Business plan.');
        setVmStatus('error');
        return;
      }
      
      if (profile.vm_status === 'hibernating') {
        setVmStatus('waking');
        await wakeVM();
      } else if (profile.vm_status === 'ready') {
        setVmStatus('ready');
        connectVNC(profile.vm_url);
      }
    } catch {
      setError('Failed to check VM status');
      setVmStatus('error');
    }
  }
  
  async function wakeVM() {
    const response = await fetch('/api/vm/wake', { method: 'POST' });
    if (!response.ok) { setError('Failed to wake VM'); setVmStatus('error'); return; }
    
    // Poll until ready (max 30 attempts, 2s each)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data: profile } = await supabase.from('users').select('vm_status, vm_url').single();
      if (profile?.vm_status === 'ready') {
        setVmStatus('ready');
        connectVNC(profile.vm_url);
        return;
      }
    }
    setError('VM took too long to wake up');
    setVmStatus('error');
  }
  
  function connectVNC(url: string) {
    if (!canvasRef.current) return;
    rfbRef.current = new RFB(canvasRef.current, url);
    rfbRef.current.scaleViewport = true;
    rfbRef.current.resizeSession = true;
  }
  
  if (vmStatus === 'checking') return <LoadingScreen message="Checking cloud browser status..." />;
  if (vmStatus === 'waking') return <LoadingScreen message="Waking up cloud browser... (10-15 seconds)" />;
  if (vmStatus === 'error') return <ErrorScreen message={error || 'Unknown error'} />;
  
  return (
    <div className="h-full flex">
      <div className="flex-1 bg-black" ref={canvasRef} />
      
      <div className="w-80 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Cloud Browser</h2>
          <p className="text-sm text-gray-600">Status: Connected</p>
        </div>
        
        {recordingId && (
          <div className="p-4 border-b">
            <h3 className="font-medium mb-2">Recording</h3>
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">
                ⏹ Stop
              </button>
              <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                ⏸ Pause
              </button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="font-medium mb-2">Live Steps</h3>
          <p className="text-sm text-gray-500">Steps will appear here as you interact.</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Shared Components

### 4.1 Sidebar Component
```typescript
// components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  
  const links = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/workspace', icon: '🖥️', label: 'Cloud Browser', tier: 'business' },
    { href: '/settings', icon: '⚙️', label: 'Settings' }
  ];
  
  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🧪</span>
          <span className="font-bold text-lg">TestFlow</span>
        </Link>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {links.map(link => {
            if (link.tier === 'business' && user.tier !== 'business') return null;
            const isActive = pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user.user_metadata?.name || 'User'}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

### 4.2 Header Component
```typescript
// components/layout/Header.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export function Header({ user }: { user: User }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }
  
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      {/* Breadcrumb placeholder */}
      <div></div>
      
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg">🔔</button>
        
        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
            <span>{user.user_metadata?.name || user.email}</span>
            <span>▼</span>
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
              <Link href="/settings/profile" className="block px-4 py-2 hover:bg-gray-50">Profile</Link>
              <Link href="/settings/billing" className="block px-4 py-2 hover:bg-gray-50">Billing</Link>
              <hr className="my-1" />
              <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

### 4.3 Common UI Components
```typescript
// components/ui/Toggle.tsx
export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// components/ui/LoadingScreen.tsx
export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// components/ui/ErrorScreen.tsx
export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
```

---

## 5. State Management

### 5.1 React Query Setup
```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      cacheTime: 10 * 60 * 1000,    // 10 minutes
      refetchOnWindowFocus: false
    }
  }
});
```

### 5.2 Custom Hooks
```typescript
// hooks/useProjects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useProjects() {
  const supabase = createClientComponentClient();
  
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const supabase = createClientComponentClient();
  
  return useMutation({
    mutationFn: async (project: Partial<Project>) => {
      const { data, error } = await supabase.from('projects').insert(project).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

// hooks/useUser.ts
import { useState, useEffect } from 'react';

export function useUser() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  const refreshUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  };
  
  return { user, refreshUser };
}
```

---

## 6. Responsive Design

### 6.1 Breakpoint Strategy

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |

### 6.2 Mobile Navigation
```typescript
// components/layout/MobileNav.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      {/* Mobile header - visible on small screens */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-40">
        <Link href="/dashboard" className="font-bold">TestFlow</Link>
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '✕' : '☰'}
        </button>
      </header>
      
      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setIsOpen(false)}>
          <nav className="w-64 h-full bg-white p-4" onClick={e => e.stopPropagation()}>
            <Link href="/dashboard" className="block py-2">Dashboard</Link>
            <Link href="/settings" className="block py-2">Settings</Link>
          </nav>
        </div>
      )}
    </>
  );
}
```

### 6.3 Responsive Patterns
```typescript
// Grid responsive pattern
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {projects.map(p => <ProjectCard key={p.id} project={p} />)}
</div>

// Sidebar hidden on mobile
<aside className="hidden lg:block w-64 bg-white border-r">
  {/* Sidebar content */}
</aside>

// Full-width on mobile, constrained on desktop
<div className="w-full lg:max-w-4xl lg:mx-auto">
  {/* Content */}
</div>
```

---

## Summary

The Web Portal Supporting Pages specification provides:

- ✅ Run history page with trends and list
- ✅ Settings pages (profile, preferences, billing)
- ✅ Workspace page for cloud browser VNC
- ✅ Shared layout components (sidebar, header)
- ✅ Common UI components (toggle, loading, error)
- ✅ State management with React Query
- ✅ Custom hooks for data fetching
- ✅ Responsive design patterns
- ✅ Mobile navigation

Combined with **web-portal-core-pages.md**, this provides complete web portal UI implementation guidance.
