# Portal/VDI Support Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture Summary
3. Web Portal
4. Cloud Browser VDI
5. VDI Runner Service
6. Communication Flow
7. Data Synchronization
8. Security Considerations
9. Deployment Strategy
10. Future Enhancements

---

## 1. Overview

### 1.1 Purpose

Portal/VDI Support enables two key capabilities beyond the Chrome extension:

1. **Web Portal** - A Next.js web application for managing recordings, viewing results, and configuring tests from any browser
2. **VDI (Virtual Desktop Infrastructure)** - Cloud-based browser execution for running tests without requiring a local Chrome installation

### 1.2 Why Portal/VDI?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHY PORTAL/VDI SUPPORT?                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  LIMITATION: Extension-Only Architecture                               │
│  ├── Users must have Chrome installed                                  │
│  ├── Cannot record from mobile or tablet                               │
│  ├── Cannot run tests in CI/CD pipelines                               │
│  ├── Limited visibility for team collaboration                         │
│  └── No scheduled/automated test runs                                  │
│                                                                        │
│  SOLUTION: Hybrid Architecture                                         │
│  ├── Web Portal for cross-device management                            │
│  ├── Cloud Browser for any-device recording                            │
│  ├── VDI Runner for automated execution                                │
│  └── Supabase for data synchronization                                 │
│                                                                        │
│  BENEFITS:                                                             │
│  ├── Record from any device with a browser                             │
│  ├── Run tests in cloud (no local Chrome needed)                       │
│  ├── Schedule automated test runs                                      │
│  ├── Team collaboration via shared dashboard                           │
│  ├── CI/CD integration via API                                         │
│  └── Centralized reporting and analytics                               │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Phase Strategy

| Phase | Component | Tier | Status |
|-------|-----------|------|--------|
| **Phase 1** | Chrome Extension (local) | All | Current |
| **Phase 1** | Web Portal (management) | All | Current |
| **Phase 1** | IndexedDB (local storage) | All | Current |
| **Phase 1.5** | Supabase (cloud sync) | All | Planned |
| **Phase 2** | Cloud Browser (recording) | Business+ | Future |
| **Phase 2** | VDI Runner (execution) | Business+ | Future |

---

## 2. Architecture Summary

### 2.1 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  USER DEVICES                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  Desktop/Laptop   │  Mobile/Tablet   │  CI/CD Server         │   │
│  │  ┌────────────────────┐  │  ┌──────────────┐  │  ┌─────────────┐ │   │
│  │  │ Chrome + Extension │  │  │ Web Portal   │  │  │ API Client  │ │   │
│  │  └─────────┬──────────┘  │  └──────┬───────┘  │  └──────┬──────┘ │   │
│  └───────────┼──────────────┴────────┼─────────┴────────┼────────┘   │
│              │                       │                  │            │
│              │                       │                  │            │
│              ════════════╪═══════════════════════╪══════════════════╪═════════ │
│              │           INTERNET                │                  │            │
│              ════════════╪═══════════════════════╪══════════════════╪═════════ │
│              │                       │                  │            │
│              ▼                       ▼                  ▼            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SUPABASE (Cloud Backend)                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │ PostgreSQL  │  │    Auth     │  │  Realtime   │            │   │
│  │  │  Database   │  │    (JWT)    │  │   Subscr.   │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   Storage   │  │    Edge     │  │     RLS     │            │   │
│  │  │   (files)   │  │  Functions  │  │  Policies   │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                         │
│                              │  Job Queue                              │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  VDI RUNNER (Fly.io)                                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  VM Pool (auto-scaled)                                  │   │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐          │   │   │
│  │  │  │ Runner 1  │  │ Runner 2  │  │ Runner N  │          │   │   │
│  │  │  │ Playwright│  │ Playwright│  │ Playwright│          │   │   │
│  │  │  │ + Chrome  │  │ + Chrome  │  │ + Chrome  │          │   │   │
│  │  │  └───────────┘  └───────────┘  └───────────┘          │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLOUD BROWSER VMs (Business+ tier)                             │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  User-dedicated VMs (1 per Business user)               │   │   │
│  │  │  ┌──────────────────────────────────────────────────┐   │   │   │
│  │  │  │  Ubuntu + Chrome + Extension + NoVNC             │   │   │   │
│  │  │  │  - Recording via VNC stream                      │   │   │   │
│  │  │  │  - Extension identical to Phase 1                │   │   │   │
│  │  │  │  - Data saved to Supabase                        │   │   │   │
│  │  │  └──────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Summary

| Component | Technology | Purpose | Tier |
|-----------|------------|---------|------|
| **Chrome Extension** | Chrome APIs, React | Local recording & replay | All |
| **Web Portal** | Next.js, React | Management dashboard | All |
| **Supabase** | PostgreSQL, Auth | Cloud storage & sync | All |
| **Cloud Browser** | Fly.io VMs, NoVNC | Remote recording | Business+ |
| **VDI Runner** | Fly.io, Playwright | Headless execution | Business+ |

---

## 3. Web Portal

### 3.1 Portal Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WEB PORTAL ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  NEXT.JS APPLICATION                                                   │
│  ├── app/                                                              │
│  │   ├── (auth)/                                                       │
│  │   │   ├── login/page.tsx                                            │
│  │   │   ├── register/page.tsx                                         │
│  │   │   └── forgot-password/page.tsx                                  │
│  │   │                                                                 │
│  │   ├── dashboard/                                                    │
│  │   │   ├── page.tsx                      # Project list             │
│  │   │   ├── [projectId]/page.tsx          # Project detail           │
│  │   │   └── settings/page.tsx             # User settings            │
│  │   │                                                                 │
│  │   ├── workspace/                                                    │
│  │   │   └── page.tsx                      # Cloud browser viewer     │
│  │   │                                                                 │
│  │   ├── api/                                                          │
│  │   │   ├── auth/                         # Auth endpoints           │
│  │   │   ├── projects/                     # Project CRUD             │
│  │   │   ├── runs/                         # Test run management      │
│  │   │   └── vm/                           # VM lifecycle (Business+) │
│  │   │                                                                 │
│  │   └── layout.tsx                                                    │
│  │                                                                     │
│  ├── components/                                                       │
│  │   ├── dashboard/                        # Dashboard components     │
│  │   ├── editor/                           # Recording editor         │
│  │   ├── runner/                           # Test runner UI           │
│  │   └── workspace/                        # Cloud browser components │
│  │                                                                     │
│  └── lib/                                                              │
│      ├── supabase.ts                       # Supabase client          │
│      ├── auth.ts                           # Auth utilities           │
│      └── api.ts                            # API helpers              │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Portal Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Marketing, signup CTA |
| `/login` | Login | Email/password or OAuth |
| `/register` | Register | New account creation |
| `/dashboard` | Dashboard | Project list, quick actions |
| `/dashboard/[id]` | Project Detail | View/edit recording |
| `/dashboard/[id]/run` | Test Runner | Execute tests |
| `/dashboard/[id]/history` | Run History | Past executions |
| `/workspace` | Cloud Browser | VNC viewer (Business+) |
| `/settings` | Settings | Profile, preferences |
| `/settings/billing` | Billing | Plan management |

### 3.3 Dashboard Features

```typescript
interface DashboardFeatures {
  // Project Management
  projectList: {
    view: 'grid' | 'list';
    sort: 'name' | 'updated' | 'created' | 'status';
    filter: {
      status: ProjectStatus[];
      search: string;
    };
    pagination: {
      page: number;
      perPage: number;
    };
  };
  
  // Quick Actions
  quickActions: [
    'createProject',
    'importRecording',
    'runLastTest',
    'viewRecentRuns'
  ];
  
  // Statistics
  stats: {
    totalProjects: number;
    totalRuns: number;
    passRate: number;
    runTimeThisMonth: number;
  };
  
  // Recent Activity
  recentActivity: ActivityEntry[];
}
```

### 3.4 API Routes

```typescript
// Project CRUD
POST   /api/projects           // Create project
GET    /api/projects           // List projects
GET    /api/projects/[id]      // Get project
PUT    /api/projects/[id]      // Update project
DELETE /api/projects/[id]      // Delete project

// Recording steps
PUT    /api/projects/[id]/steps   // Update steps
PUT    /api/projects/[id]/fields  // Update field mappings
PUT    /api/projects/[id]/csv     // Upload CSV data

// Test runs
POST   /api/runs               // Start test run
GET    /api/runs               // List runs
GET    /api/runs/[id]          // Get run details
DELETE /api/runs/[id]          // Delete run

// VM management (Business+ tier)
POST   /api/vm/provision       // Create user's VM
GET    /api/vm/status          // Check VM status
POST   /api/vm/wake            // Wake from hibernation
POST   /api/vm/hibernate       // Put to sleep
POST   /api/vm/restart         // Reboot VM
```

---

## 4. Cloud Browser VDI

### 4.1 Cloud Browser Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUD BROWSER ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  USER'S BROWSER (Any device)                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Web Portal - /workspace                                        │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │  NoVNC Client (JavaScript)                                │ │   │
│  │  │  - Renders remote desktop in <canvas>                     │ │   │
│  │  │  - Captures mouse/keyboard events                         │ │   │
│  │  │  - Sends input via WebSocket                              │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                      │
│                                 │ WebSocket (wss://)                   │
│                                 │                                      │
│                                 ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLOUD VM (Fly.io - Per User)                                   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  Ubuntu 24.04 LTS                                       │   │   │
│  │  │  ├── Xvfb (Virtual X Display)                           │   │   │
│  │  │  ├── Openbox (Window Manager)                           │   │   │
│  │  │  ├── Chrome 120 (Browser)                               │   │   │
│  │  │  │   └── TestFlow Extension (Pre-installed)             │   │   │
│  │  │  ├── x11vnc (VNC Server)                                │   │   │
│  │  │  └── Websockify (WebSocket → VNC bridge)                │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  Extension saves steps to Supabase (identical to Phase 1)       │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 VM Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VM LIFECYCLE STATES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                    ┌──────────────┐                                    │
│                    │ not_created  │  (User hasn't upgraded)            │
│                    └──────┬───────┘                                    │
│                           │  User upgrades to Business                 │
│                           ▼                                            │
│                    ┌──────────────┐                                    │
│                    │ provisioning │  (VM being created)                │
│                    └──────┬───────┘                                    │
│                           │  VM ready (~60 seconds)                    │
│                           ▼                                            │
│         ┌────────────────────────────────────┐                        │
│         │                                    │                        │
│         │              ┌──────────────┐      │                        │
│         │  ┌───────────│    ready     │◄─────┼─── Wake API            │
│         │  │           └──────┬───────┘      │                        │
│         │  │                  │               │                        │
│         │  │  Idle 1 hour     │  User accesses│                        │
│         │  │                  │  workspace    │                        │
│         │  ▼                  ▼               │                        │
│         │  ┌──────────────┐   Active         │                        │
│         │  │ hibernating  │   Session        │                        │
│         │  └──────────────┘                  │                        │
│         │                                    │                        │
│         └────────────────────────────────────┘                        │
│                           │                                            │
│                           │  User downgrades or VM error               │
│                           ▼                                            │
│                    ┌──────────────┐                                    │
│                    │   stopped    │                                    │
│                    └──────────────┘                                    │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 VM Configuration

```typescript
interface VMConfiguration {
  // Fly.io machine config
  machine: {
    region: 'iad' | 'lax' | 'fra' | 'sin';  // Closest to user
    size: 'shared-cpu-2x';                   // 2 CPU, 2GB RAM
    image: 'testflow/cloud-browser:latest';  // Custom Docker image
  };
  
  // Lifecycle settings
  lifecycle: {
    hibernateAfterIdleMinutes: 60;   // Save costs
    maxSessionDurationHours: 8;       // Prevent abuse
    autoRestartOnError: true;
  };
  
  // Network
  network: {
    vncPort: 5900;           // Internal VNC
    websocketPort: 6080;     // External WebSocket
    httpPort: 80;            // Health checks
  };
  
  // Storage
  storage: {
    persistentVolume: '10GB';  // User data, Chrome profile
    mountPath: '/home/user';
  };
}
```

### 4.4 Recording via Cloud Browser

```typescript
// User journey for cloud recording

// Step 1: User creates recording (selects "Cloud Browser")
const recording = await createRecording({
  name: 'My Recording',
  startingUrl: 'https://example.com',
  recordingMethod: 'cloud_browser'  // vs 'local_extension'
});

// Step 2: Redirect to workspace
window.location.href = `/workspace?recording=${recording.id}&autostart=true`;

// Step 3: Workspace page wakes VM if needed
async function initWorkspace(recordingId: string) {
  const vmStatus = await checkVMStatus();
  
  if (vmStatus === 'hibernating') {
    await wakeVM();
    await waitForVMReady();  // 10-15 seconds
  }
  
  // Connect NoVNC client
  const vnc = new RFB(document.getElementById('canvas'), vncUrl);
  
  // Tell extension to start recording
  await sendToExtension({
    action: 'startRecording',
    recordingId: recordingId,
    startingUrl: recording.startingUrl
  });
}

// Step 4: Extension captures events (IDENTICAL to local extension)
// All recorded steps saved to Supabase via extension background script
```

---

## 5. VDI Runner Service

### 5.1 VDI Runner Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VDI RUNNER ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  SUPABASE                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  test_runs table                                                │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  id: uuid                                               │   │   │
│  │  │  project_id: uuid                                       │   │   │
│  │  │  status: 'queued' | 'running' | 'completed' | 'failed'  │   │   │
│  │  │  runner_id: string  (assigned VM)                       │   │   │
│  │  │  started_at: timestamp                                  │   │   │
│  │  │  completed_at: timestamp                                │   │   │
│  │  │  results: jsonb                                         │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────┬──────────────────────────────┘   │
│                                     │                                  │
│                                     │  Poll for queued jobs            │
│                                     ▼                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  VDI RUNNER POOL (Fly.io)                                       │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  Runner 1   │  │  Runner 2   │  │  Runner 3   │            │   │
│  │  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │            │   │
│  │  │ │Playwright│ │  │ │Playwright│ │  │ │Playwright│ │            │   │
│  │  │ │+ Chrome  │ │  │ │+ Chrome  │ │  │ │+ Chrome  │ │            │   │
│  │  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │            │   │
│  │  │             │  │             │  │             │            │   │
│  │  │  Status:    │  │  Status:    │  │  Status:    │            │   │
│  │  │  Running    │  │  Idle       │  │  Running    │            │   │
│  │  │  Job: abc123│  │             │  │  Job: xyz789│            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                 │   │
│  │  Auto-scales based on queue depth (min: 1, max: 10)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Runner Job Flow

```typescript
// Job polling loop (runs on each VDI runner)
async function runnerLoop() {
  while (true) {
    // Poll for queued jobs
    const { data: job } = await supabase
      .from('test_runs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    if (!job) {
      await sleep(5000);  // Wait 5 seconds before polling again
      continue;
    }
    
    // Claim the job
    const claimed = await claimJob(job.id);
    if (!claimed) continue;  // Another runner got it
    
    // Execute the test
    try {
      await updateJobStatus(job.id, 'running');
      const results = await executeTest(job);
      await updateJobStatus(job.id, 'completed', results);
    } catch (error) {
      await updateJobStatus(job.id, 'failed', { error: error.message });
    }
  }
}

async function claimJob(jobId: string): Promise<boolean> {
  // Atomic claim using RLS or transaction
  const { data, error } = await supabase
    .from('test_runs')
    .update({ 
      status: 'claimed', 
      runner_id: RUNNER_ID,
      claimed_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .eq('status', 'queued')  // Only if still queued
    .select();
  
  return !error && data.length > 0;
}
```

### 5.3 Playwright Execution

```typescript
import { chromium, Browser, Page } from 'playwright';

interface ExecutionResult {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  stepResults: StepResult[];
  screenshots: Screenshot[];
  logs: string[];
  duration: number;
}

async function executeTest(job: TestJob): Promise<ExecutionResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Load project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', job.project_id)
    .single();
  
  const steps = project.recorded_steps;
  const csvData = project.csv_data || [{}];
  const mappings = project.parsed_fields || [];
  
  const results: StepResult[] = [];
  const screenshots: Screenshot[] = [];
  const logs: string[] = [];
  
  const startTime = Date.now();
  
  // Navigate to starting URL
  await page.goto(project.target_url);
  logs.push(`Navigated to ${project.target_url}`);
  
  // Execute each CSV row
  for (const row of csvData) {
    // Execute each step
    for (const step of steps) {
      const stepResult = await executeStep(page, step, row, mappings);
      results.push(stepResult);
      
      if (stepResult.screenshot) {
        screenshots.push(stepResult.screenshot);
      }
      
      logs.push(`Step ${step.stepNumber}: ${stepResult.success ? 'PASS' : 'FAIL'}`);
      
      // Add delay between steps
      await page.waitForTimeout(1000);
    }
  }
  
  await browser.close();
  
  return {
    totalSteps: results.length,
    passedSteps: results.filter(r => r.success).length,
    failedSteps: results.filter(r => !r.success).length,
    stepResults: results,
    screenshots,
    logs,
    duration: Date.now() - startTime
  };
}

async function executeStep(
  page: Page,
  step: RecordedStep,
  row: Record<string, string>,
  mappings: FieldMapping[]
): Promise<StepResult> {
  const startTime = Date.now();
  
  try {
    // Find element using locator strategies
    const element = await findElement(page, step.bundle);
    
    if (!element) {
      throw new Error(`Element not found for step ${step.stepNumber}`);
    }
    
    // Get value to inject
    const value = resolveValue(step, row, mappings);
    
    // Execute action based on event type
    switch (step.event) {
      case 'click':
        await element.click();
        break;
      case 'input':
      case 'change':
        await element.fill(value || step.value || '');
        break;
      case 'keydown':
        if (step.bundle?.key === 'Enter') {
          await element.press('Enter');
        } else if (step.bundle?.key === 'Tab') {
          await element.press('Tab');
        }
        break;
      default:
        await element.click();
    }
    
    return {
      stepNumber: step.stepNumber,
      success: true,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    // Capture screenshot on failure
    const screenshot = await page.screenshot({ type: 'png' });
    
    return {
      stepNumber: step.stepNumber,
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
      screenshot: {
        data: screenshot.toString('base64'),
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### 5.4 Element Finding in Playwright

```typescript
async function findElement(
  page: Page,
  bundle: LocatorBundle
): Promise<ElementHandle | null> {
  const strategies = [
    // Strategy 1: ID
    async () => bundle.id ? page.locator(`#${bundle.id}`).first() : null,
    
    // Strategy 2: Data-testid
    async () => bundle.dataTestId 
      ? page.locator(`[data-testid="${bundle.dataTestId}"]`).first() 
      : null,
    
    // Strategy 3: XPath
    async () => bundle.xpath 
      ? page.locator(`xpath=${bundle.xpath}`).first() 
      : null,
    
    // Strategy 4: CSS selector
    async () => bundle.selector 
      ? page.locator(bundle.selector).first() 
      : null,
    
    // Strategy 5: Text content
    async () => bundle.textContent 
      ? page.locator(`text=${bundle.textContent}`).first() 
      : null,
    
    // Strategy 6: ARIA label
    async () => bundle.ariaLabel 
      ? page.locator(`[aria-label="${bundle.ariaLabel}"]`).first() 
      : null,
    
    // Strategy 7: Placeholder
    async () => bundle.placeholder 
      ? page.locator(`[placeholder="${bundle.placeholder}"]`).first() 
      : null,
    
    // Strategy 8: Name attribute
    async () => bundle.name 
      ? page.locator(`[name="${bundle.name}"]`).first() 
      : null,
    
    // Strategy 9: Coordinates fallback
    async () => {
      if (bundle.bounding?.x && bundle.bounding?.y) {
        // Click at coordinates and return element at that point
        const element = await page.evaluateHandle(({ x, y }) => {
          return document.elementFromPoint(x, y);
        }, { x: bundle.bounding.x, y: bundle.bounding.y });
        return element.asElement();
      }
      return null;
    }
  ];
  
  // Try each strategy in order
  for (const strategy of strategies) {
    try {
      const locator = await strategy();
      if (locator) {
        const element = await locator.elementHandle();
        if (element && await element.isVisible()) {
          return element;
        }
      }
    } catch {
      // Strategy failed, try next
    }
  }
  
  return null;
}
```

---

## 6. Communication Flow

### 6.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW BETWEEN COMPONENTS                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────┐                         ┌─────────────────┐       │
│  │ Chrome Extension│                         │   Web Portal    │       │
│  │ (Local Browser) │                         │   (Next.js)     │       │
│  └────────┬────────┘                         └────────┬────────┘       │
│           │                                          │                 │
│           │  1. Save recording                       │  2. View/edit   │
│           │     (IndexedDB + Supabase)               │     recordings  │
│           │                                          │                 │
│           ▼                                          ▼                 │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                       SUPABASE                                │     │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │     │
│  │  │   projects    │  │   test_runs   │  │     users     │    │     │
│  │  │   (steps,     │  │   (results,   │  │   (profile,   │    │     │
│  │  │    mappings)  │  │    logs)      │  │    prefs)     │    │     │
│  │  └───────────────┘  └───────────────┘  └───────────────┘    │     │
│  └───────────────────────────┬───────────────────────────────────┘     │
│                              │                                         │
│           ┌──────────────────┼──────────────────┐                     │
│           │                  │                  │                     │
│           ▼                  ▼                  ▼                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐         │
│  │ Cloud Browser   │ │   VDI Runner    │ │    Realtime     │         │
│  │ (Recording)     │ │  (Execution)    │ │  (Subscriptions)│         │
│  │                 │ │                 │ │                 │         │
│  │ 3. Save steps   │ │ 4. Poll jobs    │ │ 5. Push updates │         │
│  │    to Supabase  │ │    Execute      │ │    to clients   │         │
│  │                 │ │    Save results │ │                 │         │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘         │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Realtime Subscriptions

```typescript
// Subscribe to test run updates
function subscribeToTestRun(runId: string, callbacks: {
  onProgress: (progress: number) => void;
  onStepComplete: (step: StepResult) => void;
  onComplete: (result: TestRunResult) => void;
  onError: (error: string) => void;
}) {
  const channel = supabase
    .channel(`test_run_${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'test_runs',
        filter: `id=eq.${runId}`
      },
      (payload) => {
        const run = payload.new;
        
        if (run.status === 'completed') {
          callbacks.onComplete(run.results);
        } else if (run.status === 'failed') {
          callbacks.onError(run.error);
        } else if (run.status === 'running') {
          callbacks.onProgress(run.progress);
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

## 7. Data Synchronization

### 7.1 Sync Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SYNC STRATEGY                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  LOCAL (IndexedDB)                      CLOUD (Supabase)               │
│  ┌─────────────────┐                    ┌─────────────────┐            │
│  │ Primary storage │ ──── Sync ─────▶  │ Secondary/Shared│            │
│  │ for extension   │ ◀──── Sync ────   │ storage         │            │
│  └─────────────────┘                    └─────────────────┘            │
│                                                                        │
│  SYNC RULES:                                                           │
│  1. Extension writes to IndexedDB first (offline-capable)              │
│  2. Background sync pushes changes to Supabase                         │
│  3. Portal reads directly from Supabase                                │
│  4. Conflicts resolved by "last write wins" with timestamp             │
│  5. Deletions are soft-deletes with sync flag                          │
│                                                                        │
│  SYNC TRIGGERS:                                                        │
│  • On recording save                                                   │
│  • On step capture (batched, every 5 seconds)                          │
│  • On test run complete                                                │
│  • On extension popup open                                             │
│  • On periodic interval (every 60 seconds)                             │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Conflict Resolution

```typescript
interface SyncConflictResolution {
  strategy: 'last_write_wins' | 'server_wins' | 'client_wins' | 'manual';
  
  // Last Write Wins implementation
  resolve(local: Project, remote: Project): Project {
    if (local.updated_at > remote.updated_at) {
      return { ...local, sync_status: 'synced' };
    } else {
      return { ...remote, sync_status: 'synced' };
    }
  }
}
```

---

## 8. Security Considerations

### 8.1 Authentication Flow

```typescript
// Shared auth between extension and portal
interface AuthFlow {
  // Extension uses Supabase auth
  extension: {
    login: 'supabase.auth.signInWithPassword()';
    token: 'stored in chrome.storage.local';
    refresh: 'automatic via supabase-js';
  };
  
  // Portal uses Next.js + Supabase SSR
  portal: {
    login: 'Server-side auth with cookies';
    token: 'HTTP-only secure cookies';
    refresh: 'Middleware checks on each request';
  };
  
  // Shared session
  sync: {
    method: 'Extension checks portal cookie on open';
    fallback: 'Independent login if no cookie';
  };
}
```

### 8.2 Row Level Security

```sql
-- Projects: Users can only access their own
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

-- Test runs: Users can only access runs for their projects
CREATE POLICY "Users can view own test runs"
  ON test_runs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

### 8.3 VM Security

```typescript
interface VMSecurity {
  // Network isolation
  network: {
    privateNetwork: true;  // VMs only accessible via Fly proxy
    noDirectInternet: false;  // Need internet for browsing
    firewallRules: ['allow outbound 80,443', 'deny inbound except 6080'];
  };
  
  // Authentication
  auth: {
    vncPassword: 'Generated per-user, stored encrypted';
    tokenValidation: 'JWT verified on WebSocket connect';
  };
  
  // Data isolation
  data: {
    separateVolumes: true;  // Each user has isolated storage
    noSharedState: true;    // No cross-user data access
    autoWipe: 'On user downgrade or deletion';
  };
}
```

---

## 9. Deployment Strategy

### 9.1 Component Deployment

| Component | Platform | Config | Scaling |
|-----------|----------|--------|---------|
| **Web Portal** | Vercel | Edge Functions | Auto |
| **Supabase** | Supabase Cloud | Pro plan | Auto |
| **Cloud Browser** | Fly.io | Per-user VMs | Manual |
| **VDI Runner** | Fly.io | Shared pool | Auto (1-10) |

### 9.2 Environment Variables

```bash
# Portal (.env)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

FLY_API_TOKEN=xxx
FLY_ORG=testflow

# VDI Runner
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
RUNNER_ID=runner-001

# Cloud Browser VM
SUPABASE_URL=https://xxx.supabase.co
USER_JWT=xxx  # Set per-user
VNC_PASSWORD=xxx  # Generated
```

---

## 10. Future Enhancements

### 10.1 Roadmap

| Phase | Feature | Priority |
|-------|---------|----------|
| **2.1** | Basic web portal | High |
| **2.2** | Supabase sync | High |
| **2.3** | VDI Runner MVP | High |
| **3.0** | Cloud Browser | Medium |
| **3.1** | Parallel execution | Medium |
| **3.2** | Scheduled runs | Medium |
| **4.0** | CI/CD integration | Low |
| **4.1** | API access | Low |

### 10.2 API Access (Future)

```typescript
// Public API for CI/CD integration
interface PublicAPI {
  // Authentication
  'POST /api/v1/auth/token': {
    body: { api_key: string };
    response: { access_token: string; expires_in: number };
  };
  
  // Run tests
  'POST /api/v1/runs': {
    body: { project_id: string; csv_data?: object[] };
    response: { run_id: string; status: 'queued' };
  };
  
  // Check status
  'GET /api/v1/runs/:id': {
    response: { status: string; progress: number; results?: object };
  };
  
  // Get results
  'GET /api/v1/runs/:id/results': {
    response: { passed: number; failed: number; steps: StepResult[] };
  };
}
```

---

## Summary

Portal/VDI Support provides:

✅ **Web Portal** for cross-device management  
✅ **Cloud Browser** for any-device recording  
✅ **VDI Runner** for automated execution  
✅ **Supabase sync** for data sharing  
✅ **Security** via RLS and VM isolation  
✅ **Scalability** via auto-scaling pools  
✅ **Future API** for CI/CD integration

This enables users to manage, record, and execute tests from any device while maintaining consistency with the Chrome extension's core functionality.
