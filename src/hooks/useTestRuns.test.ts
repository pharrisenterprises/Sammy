/**
 * Tests for useTestRuns hook
 * @module hooks/useTestRuns.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useTestRuns,
  useTestRun,
  type TestRun,
  type StepResult,
  type LogEntry,
} from './useTestRuns';
import type { IChromeRuntime } from './useStorage';

// ============================================================================
// MOCKS
// ============================================================================

const mockTestRuns: TestRun[] = [
  {
    id: 1,
    project_id: 1,
    status: 'completed',
    start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    end_time: new Date(Date.now() - 3500000).toISOString(),
    total_steps: 10,
    passed_steps: 10,
    failed_steps: 0,
    skipped_steps: 0,
    total_rows: 1,
    completed_rows: 1,
    current_row: 1,
    current_step: 10,
    test_results: [],
    logs: [],
    duration: 100000,
  },
  {
    id: 2,
    project_id: 1,
    status: 'failed',
    start_time: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    end_time: new Date(Date.now() - 7100000).toISOString(),
    total_steps: 5,
    passed_steps: 3,
    failed_steps: 2,
    skipped_steps: 0,
    total_rows: 1,
    completed_rows: 1,
    current_row: 1,
    current_step: 5,
    test_results: [],
    logs: [],
    duration: 100000,
    error_message: 'Element not found',
  },
];

function createMockChromeRuntime(): IChromeRuntime {
  return {
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        if (message.action === 'getTestRunsByProject') {
          callback?.({ success: true, data: { testRuns: mockTestRuns } });
        } else if (message.action === 'getTestRunById') {
          const run = mockTestRuns.find(r => r.id === message.payload?.id);
          callback?.({ success: true, data: { testRun: run } });
        } else if (message.action === 'createTestRun') {
          callback?.({ success: true, data: { id: 3 } });
        } else if (message.action === 'updateTestRun') {
          callback?.({ success: true });
        } else if (message.action === 'deleteTestRun') {
          callback?.({ success: true });
        } else {
          callback?.({ success: true });
        }
      }, 0);
    }),
    lastError: undefined,
  };
}

let mockChrome: IChromeRuntime;

beforeEach(() => {
  mockChrome = createMockChromeRuntime();
  (global as unknown as { chrome: { runtime: IChromeRuntime } }).chrome = {
    runtime: mockChrome,
  };
  vi.clearAllMocks();
});

afterEach(() => {
  delete (global as unknown as { chrome?: unknown }).chrome;
});

// ============================================================================
// TESTS
// ============================================================================

describe('useTestRuns', () => {
  describe('loading', () => {
    it('should load test runs for project', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.testRuns.length).toBeGreaterThan(0);
      });

      expect(result.current.testRuns).toHaveLength(2);
      expect(result.current.isLoading).toBe(false);
    });

    it('should not load without projectId', async () => {
      const { result } = renderHook(() => useTestRuns({ autoLoad: true }));

      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });

      expect(result.current.testRuns).toHaveLength(0);
    });

    it('should load manually', async () => {
      const { result } = renderHook(() => useTestRuns({ autoLoad: false }));

      await act(async () => {
        await result.current.loadTestRuns(1);
      });

      expect(result.current.testRuns).toHaveLength(2);
    });
  });

  describe('statistics', () => {
    it('should calculate stats', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats.totalRuns).toBe(2);
      expect(result.current.stats.byStatus.completed).toBe(1);
      expect(result.current.stats.byStatus.failed).toBe(1);
      expect(result.current.stats.totalStepsPassed).toBe(13);
      expect(result.current.stats.totalStepsFailed).toBe(2);
    });

    it('should calculate success rate', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1 fully successful out of 2 completed = 50%
      expect(result.current.stats.successRate).toBe(50);
    });
  });

  describe('CRUD operations', () => {
    it('should create test run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let newId: number | null;
      await act(async () => {
        newId = await result.current.createRun({
          project_id: 1,
          total_steps: 10,
          total_rows: 5,
        });
      });

      expect(newId).toBe(3);
    });

    it('should start run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.startRun(1);
      });

      expect(success!).toBe(true);
    });

    it('should complete run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.completeRun(1);
      });

      expect(success!).toBe(true);
    });

    it('should fail run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.failRun(1, 'Test failed');
      });

      expect(success!).toBe(true);
    });

    it('should stop run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.stopRun(1);
      });

      expect(success!).toBe(true);
    });

    it('should delete run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.deleteRun(1);
      });

      expect(success!).toBe(true);
      expect(result.current.testRuns.find(r => r.id === 1)).toBeUndefined();
    });
  });

  describe('progress updates', () => {
    it('should update progress', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.updateProgress(1, {
          current_step: 5,
          passed_steps: 4,
          failed_steps: 1,
        });
      });

      expect(success!).toBe(true);
    });

    it('should add step result', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stepResult: StepResult = {
        stepIndex: 0,
        status: 'passed',
        duration: 100,
        timestamp: Date.now(),
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.addStepResult(1, stepResult);
      });

      expect(success!).toBe(true);
    });

    it('should add log entry', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test started',
      };

      let success: boolean;
      await act(async () => {
        success = await result.current.addLog(1, logEntry);
      });

      expect(success!).toBe(true);
    });
  });

  describe('utilities', () => {
    it('should export run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let exported;
      await act(async () => {
        exported = await result.current.exportRun(1);
      });

      expect(exported).toBeDefined();
      expect(exported!.id).toBe(1);
      expect(exported!.summary).toBeDefined();
    });

    it('should set active run', async () => {
      const { result } = renderHook(() => useTestRuns({ projectId: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setActiveRun(result.current.testRuns[0]);
      });

      expect(result.current.activeRun).not.toBeNull();
      expect(result.current.activeRun?.id).toBe(1);
    });
  });
});

describe('useTestRun', () => {
  it('should load single test run', async () => {
    const { result } = renderHook(() => useTestRun(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.run?.id).toBe(1);
  });

  it('should handle null runId', async () => {
    const { result } = renderHook(() => useTestRun(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.run).toBeNull();
  });

  it('should start run', async () => {
    const { result } = renderHook(() => useTestRun(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.start();
    });

    expect(success!).toBe(true);
  });

  it('should add result', async () => {
    const { result } = renderHook(() => useTestRun(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.addResult({
        stepIndex: 0,
        status: 'passed',
        duration: 100,
        timestamp: Date.now(),
      });
    });

    expect(success!).toBe(true);
  });
});
