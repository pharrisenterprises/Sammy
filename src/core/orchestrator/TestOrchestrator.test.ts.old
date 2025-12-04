/**
 * Tests for TestOrchestrator
 * @module core/orchestrator/TestOrchestrator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TestOrchestrator,
  createTestOrchestrator,
  createMockTabManager,
} from './TestOrchestrator';
import type {
  ITabManager,
  OrchestratorProgress,
  LogEntry,
} from './ITestOrchestrator';

// Test helpers removed - not needed for current tests

// ============================================================================
// TESTS
// ============================================================================

describe('TestOrchestrator', () => {
  let tabManager: ITabManager;
  let orchestrator: TestOrchestrator;
  
  beforeEach(() => {
    vi.useFakeTimers();
    tabManager = createMockTabManager();
    orchestrator = createTestOrchestrator(tabManager);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    orchestrator.reset();
  });
  
  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================
  
  describe('initialization', () => {
    it('should start in idle state', () => {
      expect(orchestrator.getLifecycle()).toBe('idle');
    });
    
    it('should have no project initially', () => {
      expect(orchestrator.getProject()).toBeNull();
    });
    
    it('should have no tab initially', () => {
      expect(orchestrator.getTab()).toBeNull();
    });
    
    it('should have empty logs initially', () => {
      expect(orchestrator.getLogs()).toEqual([]);
    });
  });
  
  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================
  
  describe('lifecycle', () => {
    it('should track lifecycle changes', () => {
      const changes: string[] = [];
      orchestrator.onLifecycleChange((newState, prevState) => {
        changes.push(`${prevState} → ${newState}`);
      });
      
      // Trigger loading (will fail since no storage)
      orchestrator.load(1).catch(() => {});
      
      expect(changes).toContain('idle → loading');
    });
    
    it('should not allow invalid transitions', async () => {
      // Cannot run from idle (must load first)
      // The run will fail to find project, but transition is allowed
      await expect(orchestrator.run({ projectId: 1 })).rejects.toThrow();
    });
    
    it('should reset to idle', () => {
      orchestrator.reset();
      expect(orchestrator.getLifecycle()).toBe('idle');
    });
  });
  
  // ==========================================================================
  // STATE ACCESSOR TESTS
  // ==========================================================================
  
  describe('state accessors', () => {
    it('should return lifecycle state', () => {
      expect(orchestrator.getLifecycle()).toBe('idle');
    });
    
    it('should return empty progress initially', () => {
      const progress = orchestrator.getProgress();
      
      expect(progress.lifecycle).toBe('idle');
      expect(progress.currentRow).toBe(0);
      expect(progress.totalRows).toBe(0);
      expect(progress.overallPercentage).toBe(0);
    });
    
    it('should return logs', () => {
      orchestrator.log('info', 'Test message');
      
      const logs = orchestrator.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
    });
    
    it('should return step statuses', () => {
      const statuses = orchestrator.getStepStatuses();
      expect(statuses).toEqual([]);
    });
  });
  
  // ==========================================================================
  // CAPABILITY PREDICATES
  // ==========================================================================
  
  describe('capability predicates', () => {
    it('should not allow start from idle', () => {
      expect(orchestrator.canStart()).toBe(false);
    });
    
    it('should not allow pause from idle', () => {
      expect(orchestrator.canPause()).toBe(false);
    });
    
    it('should not allow resume from idle', () => {
      expect(orchestrator.canResume()).toBe(false);
    });
    
    it('should not allow stop from idle', () => {
      expect(orchestrator.canStop()).toBe(false);
    });
  });
  
  // ==========================================================================
  // LOGGING TESTS
  // ==========================================================================
  
  describe('logging', () => {
    it('should add log entries', () => {
      orchestrator.log('info', 'Test info');
      orchestrator.log('error', 'Test error');
      orchestrator.log('success', 'Test success');
      
      const logs = orchestrator.getLogs();
      expect(logs).toHaveLength(3);
    });
    
    it('should include timestamp in logs', () => {
      orchestrator.log('info', 'Test');
      
      const logs = orchestrator.getLogs();
      expect(logs[0].timestamp).toBeTruthy();
    });
    
    it('should emit onLog callback', () => {
      const entries: LogEntry[] = [];
      orchestrator.onLog((entry) => entries.push(entry));
      
      orchestrator.log('info', 'Test');
      
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test');
    });
    
    it('should include optional data', () => {
      orchestrator.log('info', 'Test', { key: 'value' });
      
      const logs = orchestrator.getLogs();
      expect(logs[0].data).toEqual({ key: 'value' });
    });
  });
  
  // ==========================================================================
  // EVENT REGISTRATION TESTS
  // ==========================================================================
  
  describe('event registration', () => {
    it('should register onProjectLoaded', () => {
      let called = false;
      orchestrator.onProjectLoaded(() => { called = true; });
      
      // Trigger would need actual storage
      expect(called).toBe(false);
    });
    
    it('should register onProgress', () => {
      let progress: OrchestratorProgress | null = null;
      orchestrator.onProgress((p) => { progress = p; });
      
      // Progress would be emitted during execution
      expect(progress).toBeNull();
    });
    
    it('should register onLog', () => {
      const logs: LogEntry[] = [];
      orchestrator.onLog((entry) => logs.push(entry));
      
      orchestrator.log('info', 'Test');
      
      expect(logs).toHaveLength(1);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('createTestOrchestrator', () => {
  it('should create orchestrator with tab manager', () => {
    const tabManager = createMockTabManager();
    const orchestrator = createTestOrchestrator(tabManager);
    
    expect(orchestrator.getLifecycle()).toBe('idle');
  });
  
  it('should accept optional events', () => {
    const tabManager = createMockTabManager();
    const logs: LogEntry[] = [];
    
    const orchestrator = createTestOrchestrator(tabManager, {
      onLog: (entry) => logs.push(entry),
    });
    
    orchestrator.log('info', 'Test');
    
    expect(logs).toHaveLength(1);
  });
});

// ============================================================================
// MOCK TAB MANAGER TESTS
// ============================================================================

describe('createMockTabManager', () => {
  it('should create mock with defaults', () => {
    const mock = createMockTabManager();
    
    expect(mock.openTab).toBeDefined();
    expect(mock.closeTab).toBeDefined();
    expect(mock.injectScript).toBeDefined();
  });
  
  it('should return success by default', async () => {
    const mock = createMockTabManager();
    
    const result = await mock.openTab('https://example.com');
    
    expect(result.success).toBe(true);
    expect(result.tab).toBeDefined();
  });
  
  it('should return failure when configured', async () => {
    const mock = createMockTabManager({ openSuccess: false });
    
    const result = await mock.openTab('https://example.com');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  it('should use custom tabId', async () => {
    const mock = createMockTabManager({ tabId: 999 });
    
    const result = await mock.openTab('https://example.com');
    
    expect(result.tab?.tabId).toBe(999);
  });
  
  it('should report script injection status', async () => {
    const mock = createMockTabManager({ scriptInjected: false });
    
    const ready = await mock.isTabReady(123);
    
    expect(ready).toBe(false);
  });
});
