# Data Synchronization Strategy

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Status:** Complete Technical Specification  
**Last Updated:** November 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Dual-Mode Storage](#3-dual-mode-storage)
4. [Online Mode (Default)](#4-online-mode-default)
5. [Offline Fallback Mode](#5-offline-fallback-mode)
6. [Recording Sync Flow](#6-recording-sync-flow)
7. [Conflict Resolution](#7-conflict-resolution)
8. [Realtime Subscriptions](#8-realtime-subscriptions)
9. [Sync Status Indicators](#9-sync-status-indicators)
10. [Error Handling & Retry](#10-error-handling--retry)
11. [Implementation Guide](#11-implementation-guide)
12. [Testing Checklist](#12-testing-checklist)

---

## 1. Overview

This document defines the data synchronization strategy between the Chrome Extension and Supabase cloud storage. The system supports:

- **Online Mode (Default):** Direct writes to Supabase with realtime subscriptions
- **Offline Fallback:** Queue writes in memory during disconnection, replay on reconnection
- **Conflict Resolution:** Last-write-wins strategy with timestamp comparison

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| Cloud-First | All data lives in Supabase; local storage is temporary |
| Graceful Degradation | Extension remains functional when offline |
| Eventual Consistency | All changes eventually sync to cloud |
| User Transparency | Clear visual indicators of sync status |

### 1.2 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA SYNC ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │    User Action      │
                    │  (Click, Type, etc) │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Event Capture     │
                    │  (Content Script)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Background Script  │
                    │  (Step Assembly)    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
     ┌─────────────────────┐      ┌─────────────────────┐
     │   Online Mode       │      │   Offline Mode      │
     │ (Direct Supabase)   │      │  (Memory Queue)     │
     └──────────┬──────────┘      └──────────┬──────────┘
                │                             │
                ▼                             │
     ┌─────────────────────┐                  │
     │     Supabase        │◄─────────────────┘
     │  (Cloud Database)   │    (Replay on reconnect)
     └─────────────────────┘
```

---

## 2. Architecture

### 2.1 Component Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYNC ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CHROME EXTENSION                              │   │
│  │                                                                   │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │   │
│  │  │   Content     │  │  Background   │  │    Sync Manager   │    │   │
│  │  │   Script      │──│    Script     │──│                   │    │   │
│  │  │               │  │               │  │  • Connection     │    │   │
│  │  │ • Event       │  │ • State       │  │    Monitor        │    │   │
│  │  │   Capture     │  │   Management  │  │  • Queue Manager  │    │   │
│  │  │ • DOM Access  │  │ • Message     │  │  • Retry Logic    │    │   │
│  │  │               │  │   Routing     │  │  • Conflict       │    │   │
│  │  │               │  │               │  │    Resolution     │    │   │
│  │  └───────────────┘  └───────────────┘  └─────────┬─────────┘    │   │
│  │                                                   │              │   │
│  └───────────────────────────────────────────────────┼──────────────┘   │
│                                                      │                  │
│                         ┌────────────────────────────┴────────┐         │
│                         │                                     │         │
│                         ▼                                     ▼         │
│              ┌─────────────────────┐           ┌─────────────────────┐  │
│              │   Supabase Client   │           │   Memory Queue      │  │
│              │                     │           │   (Offline Buffer)  │  │
│              │  • REST API         │           │                     │  │
│              │  • Realtime WS      │           │  • Pending Writes   │  │
│              │  • Auth             │           │  • Retry Queue      │  │
│              └──────────┬──────────┘           └─────────────────────┘  │
│                         │                                               │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │
                          │ HTTPS / WebSocket
                          ▼
               ┌─────────────────────┐
               │      SUPABASE       │
               │                     │
               │  • PostgreSQL       │
               │  • Realtime         │
               │  • Storage          │
               └─────────────────────┘
```

### 2.2 Sync Manager Interface

```typescript
interface SyncManager {
  // Connection state
  isOnline: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  // Sync operations
  syncRecording(recording: Recording): Promise<SyncResult>;
  syncStep(recordingId: string, step: RecordedStep): Promise<SyncResult>;
  
  // Queue management
  getPendingCount(): number;
  flushQueue(): Promise<FlushResult>;
  
  // Event handlers
  onConnectionChange(callback: (status: ConnectionStatus) => void): void;
  onSyncComplete(callback: (result: SyncResult) => void): void;
  onSyncError(callback: (error: SyncError) => void): void;
}

interface SyncResult {
  success: boolean;
  recordingId: string;
  syncedAt: string;
  conflictResolved?: boolean;
}

interface SyncError {
  code: string;
  message: string;
  recordingId?: string;
  retryable: boolean;
}
```

---

## 3. Dual-Mode Storage

### 3.1 Storage Decision Logic

The extension uses a dual-mode storage strategy based on user authentication and network status:

```typescript
class StorageService {
  private supabaseService: SupabaseService;
  private memoryQueue: MemoryQueue;
  private isOnline: boolean = true;
  private isAuthenticated: boolean = false;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.memoryQueue = new MemoryQueue();
    this.initializeConnectionMonitor();
  }

  async saveRecording(recording: Recording): Promise<SaveResult> {
    // Decision tree for storage mode
    if (!this.isAuthenticated) {
      // Not logged in: queue for later sync
      return this.memoryQueue.add(recording);
    }
    
    if (!this.isOnline) {
      // Logged in but offline: queue for sync when back online
      return this.memoryQueue.add(recording);
    }
    
    // Logged in and online: direct write to Supabase
    try {
      return await this.supabaseService.saveRecording(recording);
    } catch (error) {
      // Network error: fall back to queue
      this.memoryQueue.add(recording);
      throw error;
    }
  }

  private initializeConnectionMonitor(): void {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    
    // Monitor auth state
    this.supabaseService.onAuthStateChange((user) => {
      this.isAuthenticated = !!user;
      if (user && this.isOnline) {
        this.flushQueue();
      }
    });
  }
}
```

### 3.2 Storage Mode Matrix

| User State | Network State | Storage Mode | Behavior |
|------------|---------------|--------------|----------|
| Not logged in | Online | Memory Queue | Queue writes, prompt login |
| Not logged in | Offline | Memory Queue | Queue writes, prompt login |
| Logged in | Online | Supabase Direct | Immediate cloud writes |
| Logged in | Offline | Memory Queue | Queue writes, auto-sync on reconnect |

---

## 4. Online Mode (Default)

### 4.1 Direct Write Flow

When online and authenticated, all writes go directly to Supabase:

```typescript
class OnlineSyncService {
  private supabase: SupabaseClient;

  async saveRecording(recording: Recording): Promise<Recording> {
    const { data, error } = await this.supabase
      .from('recordings')
      .upsert({
        id: recording.id,
        user_id: recording.user_id,
        name: recording.name,
        starting_url: recording.starting_url,
        status: recording.status,
        steps: recording.steps,
        step_count: recording.steps.length,
        variables: recording.variables,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new SyncError('SAVE_FAILED', error.message);
    return data;
  }

  async addStep(recordingId: string, step: RecordedStep): Promise<void> {
    // Fetch current steps
    const { data: recording, error: fetchError } = await this.supabase
      .from('recordings')
      .select('steps')
      .eq('id', recordingId)
      .single();

    if (fetchError) throw new SyncError('FETCH_FAILED', fetchError.message);

    // Append new step
    const updatedSteps = [...(recording.steps || []), step];

    // Update recording
    const { error: updateError } = await this.supabase
      .from('recordings')
      .update({
        steps: updatedSteps,
        step_count: updatedSteps.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);

    if (updateError) throw new SyncError('UPDATE_FAILED', updateError.message);
  }
}
```

### 4.2 Debounced Step Sync

To avoid excessive writes during rapid user interactions, steps are debounced:

```typescript
class DebouncedStepSync {
  private pendingSteps: Map<string, RecordedStep[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 500;

  queueStep(recordingId: string, step: RecordedStep): void {
    // Add step to pending queue
    const pending = this.pendingSteps.get(recordingId) || [];
    pending.push(step);
    this.pendingSteps.set(recordingId, pending);

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(recordingId);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.flushSteps(recordingId);
    }, this.DEBOUNCE_MS);
    
    this.debounceTimers.set(recordingId, timer);
  }

  private async flushSteps(recordingId: string): Promise<void> {
    const steps = this.pendingSteps.get(recordingId);
    if (!steps || steps.length === 0) return;

    // Clear pending queue
    this.pendingSteps.delete(recordingId);
    this.debounceTimers.delete(recordingId);

    // Batch sync all pending steps
    await this.syncService.addSteps(recordingId, steps);
  }
}
```

---

## 5. Offline Fallback Mode

### 5.1 Memory Queue Implementation

When offline, writes are queued in memory:

```typescript
interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

class MemoryQueue {
  private queue: QueuedOperation[] = [];
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_RETRIES = 3;

  add(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): string {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest operation to make room
      this.queue.shift();
    }

    const queuedOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedOp);
    this.persistQueue();
    
    return queuedOp.id;
  }

  async flush(syncService: SyncService): Promise<FlushResult> {
    const results: OperationResult[] = [];
    const failedOps: QueuedOperation[] = [];

    for (const op of this.queue) {
      try {
        await this.executeOperation(op, syncService);
        results.push({ id: op.id, success: true });
      } catch (error) {
        op.retryCount++;
        
        if (op.retryCount < this.MAX_RETRIES) {
          failedOps.push(op);
        }
        
        results.push({ id: op.id, success: false, error: error.message });
      }
    }

    // Replace queue with failed operations only
    this.queue = failedOps;
    this.persistQueue();

    return {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }

  private persistQueue(): void {
    // Store queue in chrome.storage.local for persistence
    chrome.storage.local.set({ syncQueue: this.queue });
  }

  private async loadQueue(): Promise<void> {
    const result = await chrome.storage.local.get('syncQueue');
    this.queue = result.syncQueue || [];
  }
}
```

### 5.2 Queue Processing on Reconnect

```typescript
class ReconnectHandler {
  private syncManager: SyncManager;
  private memoryQueue: MemoryQueue;

  constructor() {
    this.setupReconnectListener();
  }

  private setupReconnectListener(): void {
    window.addEventListener('online', async () => {
      console.log('Network reconnected, processing queue...');
      
      // Wait for connection to stabilize
      await this.waitForStableConnection();
      
      // Process queue
      const result = await this.memoryQueue.flush(this.syncManager);
      
      // Notify user
      this.notifyUser(result);
    });
  }

  private async waitForStableConnection(): Promise<void> {
    return new Promise((resolve) => {
      let stableCount = 0;
      const interval = setInterval(async () => {
        const isReachable = await this.checkSupabaseReachable();
        
        if (isReachable) {
          stableCount++;
          if (stableCount >= 3) {
            clearInterval(interval);
            resolve();
          }
        } else {
          stableCount = 0;
        }
      }, 1000);
    });
  }

  private async checkSupabaseReachable(): Promise<boolean> {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: { apikey: SUPABASE_ANON_KEY }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

---

## 6. Recording Sync Flow

### 6.1 Complete Recording Sync Sequence

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     RECORDING SYNC SEQUENCE                             │
└─────────────────────────────────────────────────────────────────────────┘

User starts recording
        │
        ▼
┌───────────────────┐
│ Create Recording  │
│ (Generate UUID)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Check Connection  │────▶│ Online?           │
└───────────────────┘     └─────────┬─────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼ YES                           ▼ NO
         ┌─────────────────────┐      ┌─────────────────────┐
         │ Insert to Supabase  │      │ Queue to Memory     │
         └──────────┬──────────┘      └──────────┬──────────┘
                    │                             │
                    ▼                             │
         ┌─────────────────────┐                  │
         │ Subscribe Realtime  │                  │
         └──────────┬──────────┘                  │
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌───────────────────┐
                    │ User Interactions │
                    │ (Capture Steps)   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Debounce 500ms    │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Batch Update      │
                    │ (Steps Array)     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ User Stops        │
                    │ Recording         │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Final Sync        │
                    │ (Status=complete) │
                    └───────────────────┘
```

### 6.2 Step-by-Step Sync Implementation

```typescript
class RecordingSyncFlow {
  private syncManager: SyncManager;
  private debouncedSync: DebouncedStepSync;

  async startRecording(name: string, startingUrl: string): Promise<Recording> {
    const recording: Recording = {
      id: crypto.randomUUID(),
      user_id: await this.getCurrentUserId(),
      name,
      starting_url: startingUrl,
      status: 'recording',
      steps: [],
      step_count: 0,
      variables: {},
      recording_method: 'extension',
      visibility: 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Initial sync (create record)
    await this.syncManager.syncRecording(recording);
    
    // Subscribe to realtime updates (for multi-device sync)
    this.subscribeToRecording(recording.id);
    
    return recording;
  }

  async captureStep(recordingId: string, step: RecordedStep): Promise<void> {
    // Queue step with debouncing
    this.debouncedSync.queueStep(recordingId, step);
  }

  async stopRecording(recordingId: string): Promise<Recording> {
    // Flush any pending steps
    await this.debouncedSync.flushAll();
    
    // Update status to completed
    const { data, error } = await this.supabase
      .from('recordings')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId)
      .select()
      .single();

    if (error) throw new SyncError('STOP_FAILED', error.message);
    
    // Unsubscribe from realtime
    this.unsubscribeFromRecording(recordingId);
    
    return data;
  }
}
```

---

## 7. Conflict Resolution

### 7.1 Last-Write-Wins Strategy

The system uses a simple last-write-wins conflict resolution strategy based on `updated_at` timestamps:

```typescript
class ConflictResolver {
  async resolveConflict(
    localRecording: Recording,
    remoteRecording: Recording
  ): Promise<Recording> {
    const localTime = new Date(localRecording.updated_at).getTime();
    const remoteTime = new Date(remoteRecording.updated_at).getTime();

    if (localTime > remoteTime) {
      // Local is newer - push to remote
      console.log('Conflict resolved: Local wins (newer timestamp)');
      return await this.pushLocal(localRecording);
    } else if (remoteTime > localTime) {
      // Remote is newer - pull from remote
      console.log('Conflict resolved: Remote wins (newer timestamp)');
      return remoteRecording;
    } else {
      // Same timestamp - merge steps (rare edge case)
      console.log('Conflict resolved: Merging (same timestamp)');
      return await this.mergeRecordings(localRecording, remoteRecording);
    }
  }

  private async mergeRecordings(
    local: Recording,
    remote: Recording
  ): Promise<Recording> {
    // Merge steps by stepNumber (remote takes precedence on conflicts)
    const mergedSteps = new Map<number, RecordedStep>();
    
    // Add all remote steps first
    for (const step of remote.steps) {
      mergedSteps.set(step.stepNumber, step);
    }
    
    // Add local steps only if not in remote
    for (const step of local.steps) {
      if (!mergedSteps.has(step.stepNumber)) {
        mergedSteps.set(step.stepNumber, step);
      }
    }
    
    // Sort by step number
    const sortedSteps = Array.from(mergedSteps.values())
      .sort((a, b) => a.stepNumber - b.stepNumber);

    const merged: Recording = {
      ...remote,
      steps: sortedSteps,
      step_count: sortedSteps.length,
      updated_at: new Date().toISOString()
    };

    return await this.pushLocal(merged);
  }
}
```

### 7.2 Conflict Detection

```typescript
async function detectConflict(
  recordingId: string,
  localUpdatedAt: string
): Promise<boolean> {
  const { data: remote } = await supabase
    .from('recordings')
    .select('updated_at')
    .eq('id', recordingId)
    .single();

  if (!remote) return false; // No remote version exists

  const localTime = new Date(localUpdatedAt).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();

  return remoteTime > localTime;
}
```

---

## 8. Realtime Subscriptions

### 8.1 Subscription Setup

```typescript
class RealtimeManager {
  private supabase: SupabaseClient;
  private subscriptions: Map<string, RealtimeChannel> = new Map();

  subscribeToRecording(recordingId: string, onUpdate: (recording: Recording) => void): void {
    const channel = this.supabase
      .channel(`recording:${recordingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings',
          filter: `id=eq.${recordingId}`
        },
        (payload) => {
          console.log('Recording update received:', payload);
          
          if (payload.eventType === 'UPDATE') {
            onUpdate(payload.new as Recording);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Subscription status for ${recordingId}:`, status);
      });

    this.subscriptions.set(recordingId, channel);
  }

  subscribeToUserRecordings(userId: string, onUpdate: (change: RecordingChange) => void): void {
    const channel = this.supabase
      .channel(`user-recordings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          onUpdate({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            recording: payload.new as Recording,
            oldRecording: payload.old as Recording | undefined
          });
        }
      )
      .subscribe();

    this.subscriptions.set(`user:${userId}`, channel);
  }

  unsubscribe(key: string): void {
    const channel = this.subscriptions.get(key);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll(): void {
    for (const [key, channel] of this.subscriptions) {
      this.supabase.removeChannel(channel);
    }
    this.subscriptions.clear();
  }
}
```

### 8.2 Execution Job Subscriptions

```typescript
function subscribeToExecutionJob(
  jobId: string,
  callbacks: {
    onStatusChange: (status: string) => void;
    onProgressUpdate: (progress: JobProgress) => void;
    onLogEntry: (log: ExecutionLog) => void;
  }
): () => void {
  // Subscribe to job status changes
  const jobChannel = supabase
    .channel(`execution:${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'execution_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        const job = payload.new;
        callbacks.onStatusChange(job.status);
        callbacks.onProgressUpdate({
          currentRow: job.current_row,
          totalRows: job.total_rows,
          completedRows: job.completed_rows,
          failedRows: job.failed_rows
        });
      }
    )
    .subscribe();

  // Subscribe to log entries
  const logsChannel = supabase
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
        callbacks.onLogEntry(payload.new as ExecutionLog);
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(jobChannel);
    supabase.removeChannel(logsChannel);
  };
}
```

---

## 9. Sync Status Indicators

### 9.1 Status Types

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| Synced | ✓ | Green | All changes saved to cloud |
| Syncing | ↻ | Blue | Upload in progress |
| Pending | ● | Yellow | Changes queued locally |
| Offline | ⚠ | Orange | No connection, changes queued |
| Error | ✗ | Red | Sync failed, retry needed |

### 9.2 Status Component

```typescript
interface SyncStatusProps {
  status: 'synced' | 'syncing' | 'pending' | 'offline' | 'error';
  pendingCount?: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

const SyncStatusIndicator: React.FC<SyncStatusProps> = ({
  status,
  pendingCount,
  lastSyncedAt,
  errorMessage
}) => {
  const statusConfig = {
    synced: { icon: '✓', color: 'text-green-500', label: 'Synced' },
    syncing: { icon: '↻', color: 'text-blue-500', label: 'Syncing...' },
    pending: { icon: '●', color: 'text-yellow-500', label: `${pendingCount} pending` },
    offline: { icon: '⚠', color: 'text-orange-500', label: 'Offline' },
    error: { icon: '✗', color: 'text-red-500', label: 'Sync error' }
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${config.color}`}>
      <span className={status === 'syncing' ? 'animate-spin' : ''}>
        {config.icon}
      </span>
      <span className="text-sm">{config.label}</span>
      {status === 'synced' && lastSyncedAt && (
        <span className="text-xs text-gray-400">
          Last synced: {formatRelativeTime(lastSyncedAt)}
        </span>
      )}
      {status === 'error' && errorMessage && (
        <span className="text-xs">{errorMessage}</span>
      )}
    </div>
  );
};
```

---

## 10. Error Handling & Retry

### 10.1 Retry Strategy

```typescript
class RetryStrategy {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 30000;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryable(error)) {
          throw error;
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = this.calculateDelay(attempt);
          console.log(`${context}: Retry ${attempt + 1}/${this.MAX_RETRIES} in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, this.MAX_DELAY_MS);
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      // Retry on network errors
      if (error.message.includes('network') || error.message.includes('timeout')) {
        return true;
      }
      // Retry on 5xx errors
      if (error.message.includes('500') || error.message.includes('503')) {
        return true;
      }
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 10.2 Error Classification

```typescript
enum SyncErrorCode {
  // Network errors (retryable)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Auth errors (not retryable - need user action)
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Data errors (not retryable)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',
  NOT_FOUND = 'NOT_FOUND',
  
  // Unknown
  UNKNOWN = 'UNKNOWN'
}

function classifyError(error: unknown): SyncErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return SyncErrorCode.NETWORK_ERROR;
    }
    if (message.includes('timeout')) {
      return SyncErrorCode.TIMEOUT;
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return SyncErrorCode.UNAUTHORIZED;
    }
    if (message.includes('409') || message.includes('conflict')) {
      return SyncErrorCode.CONFLICT;
    }
    if (message.includes('404') || message.includes('not found')) {
      return SyncErrorCode.NOT_FOUND;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return SyncErrorCode.VALIDATION_ERROR;
    }
  }
  
  return SyncErrorCode.UNKNOWN;
}
```

---

## 11. Implementation Guide

### 11.1 Setup Checklist

```
☐ Install Supabase client
  npm install @supabase/supabase-js

☐ Configure environment variables
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_ANON_KEY=eyJ...

☐ Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

☐ Enable Realtime for tables
  ALTER PUBLICATION supabase_realtime ADD TABLE recordings;
  ALTER PUBLICATION supabase_realtime ADD TABLE execution_jobs;
  ALTER PUBLICATION supabase_realtime ADD TABLE execution_logs;

☐ Implement SyncManager class

☐ Implement MemoryQueue class

☐ Add connection monitoring

☐ Add sync status UI component

☐ Test offline/online transitions
```

### 11.2 File Structure

```
src/
├── services/
│   ├── supabase/
│   │   ├── client.ts          # Supabase client initialization
│   │   ├── sync-manager.ts    # Main sync orchestration
│   │   ├── memory-queue.ts    # Offline queue
│   │   ├── realtime.ts        # Realtime subscriptions
│   │   ├── conflict-resolver.ts
│   │   └── retry-strategy.ts
│   └── storage-service.ts     # High-level storage API
├── hooks/
│   ├── useSyncStatus.ts       # React hook for sync status
│   └── useRealtimeRecording.ts
└── components/
    └── SyncStatusIndicator.tsx
```

---

## 12. Testing Checklist

### 12.1 Online Mode Tests

```
☐ Create recording syncs immediately to Supabase
☐ Steps are debounced (500ms) before syncing
☐ Multiple rapid steps batch into single update
☐ Stop recording triggers final sync
☐ Realtime updates received from other devices
```

### 12.2 Offline Mode Tests

```
☐ Recording continues when offline
☐ Steps queue in memory
☐ Queue persists to chrome.storage.local
☐ Queue flushes on reconnect
☐ Failed operations retry with backoff
☐ UI shows offline indicator
```

### 12.3 Conflict Resolution Tests

```
☐ Local newer than remote: local wins
☐ Remote newer than local: remote wins
☐ Same timestamp: merge occurs
☐ Merged recording saves correctly
```

### 12.4 Error Handling Tests

```
☐ Network error triggers retry
☐ Max retries exceeded moves to failed queue
☐ Auth error prompts re-login
☐ Validation error shows user message
☐ Error state clears on success
```

---

## Document End

This sync strategy ensures reliable data synchronization between the Chrome Extension and Supabase, with graceful offline handling and clear user feedback on sync status.
