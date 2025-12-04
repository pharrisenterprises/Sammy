/**
 * Tests for useOrchestrator hook
 * @module hooks/useOrchestrator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useOrchestrator,
  formatTestDuration,
  calculatePassRate,
  getStatusBadgeColor,
  type Project,
  type IChromeRuntime,
  type IChromeTabs,
} from './useOrchestrator';

// ============================================================================
// MOCKS
// ============================================================================

function createMockChromeRuntime(): IChromeRuntime {
  return {
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        const action = (message as { action?: string }).action;
        if (action === 'openTab') {
          callback?.({ success: true, tabId: 123 });
        } else if (action === 'closeTab') {
          callback?.({ success: true });
        } else if (action === 'injectScript') {
          callback?.({ success: true });
        } else if (action === 'createTestRun') {
          callback?.({ success: true, data: { id: 1 } });
        } else if (action === 'updateTestRun') {
          callback?.({ success: true });
        } else {
          callback?.({ success: true });
        }
      }, 0);
    }),
    lastError: undefined,
  };
}

function createMockChromeTabs(): IChromeTabs {
  return {
    sendMessage: vi.fn((tabId, message, callback) => {
      setTimeout(() => {
        callback?.(true);
      }, 10);
    }),
  };
}

let mockChrome: {
  runtime: IChromeRuntime;
  tabs: IChromeTabs;
};

const mockProject: Project = {
  id: 1,
  name: 'Test Project',
  target_url: 'https://example.com',
  recorded_steps: [
    {
      id: 'step_1',
      eventType: 'click',
      xpath: '/button[@id="submit"]',
      label: 'Submit',
      bundle: {},
    },
    {
      id: 'step_2',
      eventType: 'input',
      xpath: '/input[@name="email"]',
      label: 'Email',
      value: '',
      bundle: {},
    },
  ],
  parsed_fields: [
    { field_name: 'email', mapped: true, inputvarfields: 'Email' },
  ],
  csv_data: [],
};

beforeEach(() => {
  mockChrome = {
    runtime: createMockChromeRuntime(),
    tabs: createMockChromeTabs(),
  };
  (global as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;
  vi.clearAllMocks();
});

afterEach(() => {
  delete (global as unknown as { chrome?: unknown }).chrome;
});

// ============================================================================
// TESTS
// ============================================================================

describe('useOrchestrator', () => {
  describe('initial state', () => {
    it('should have idle status initially', () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      expect(result.current.testStatus).toBe('idle');
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
    });

    it('should have zero progress', () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      expect(result.current.progress.percentage).toBe(0);
      expect(result.current.progress.passedSteps).toBe(0);
      expect(result.current.progress.failedSteps).toBe(0);
    });

    it('should have null summary when idle', () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      expect(result.current.summary).toBeNull();
    });
  });

  describe('test execution', () => {
    it('should run test', async () => {
      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 0,
        saveResults: false,
      }));

      await act(async () => {
        await result.current.runTest();
      });

      await waitFor(() => {
        expect(result.current.testStatus).toBe('completed');
      }, { timeout: 10000 });
    });

    it('should stop test', async () => {
      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 500,
        saveResults: false,
      }));

      act(() => {
        result.current.runTest();
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
        result.current.stopTest();
      });

      expect(result.current.testStatus).toBe('stopped');
    });

    it('should pause and resume test', async () => {
      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 500,
        saveResults: false,
      }));

      act(() => {
        result.current.runTest();
      });

      await waitFor(() => {
        expect(result.current.testStatus).toBe('running');
      }, { timeout: 3000 });

      act(() => {
        result.current.pauseTest();
      });

      expect(result.current.isPaused).toBe(true);

      act(() => {
        result.current.resumeTest();
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('should reset test', async () => {
      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 0,
        saveResults: false,
      }));

      await act(async () => {
        await result.current.runTest();
      });

      await waitFor(() => {
        expect(result.current.testStatus).toBe('completed');
      });

      act(() => {
        result.current.resetTest();
      });

      expect(result.current.testStatus).toBe('idle');
      expect(result.current.logs).toHaveLength(0);
      expect(result.current.results).toHaveLength(0);
    });
  });

  describe('CSV mode', () => {
    it('should execute with CSV data', async () => {
      const projectWithCsv: Project = {
        ...mockProject,
        csv_data: [
          { email: 'test1@example.com' },
          { email: 'test2@example.com' },
        ],
      };

      const { result } = renderHook(() => useOrchestrator({
        project: projectWithCsv,
        stepDelay: 0,
        saveResults: false,
      }));

      expect(result.current.progress.totalRows).toBe(2);
    });

    it('should use mapping lookup', async () => {
      const projectWithMapping: Project = {
        ...mockProject,
        parsed_fields: [
          { field_name: 'user_email', mapped: true, inputvarfields: 'Email' },
        ],
        csv_data: [
          { user_email: 'mapped@example.com' },
        ],
      };

      const { result } = renderHook(() => useOrchestrator({
        project: projectWithMapping,
        stepDelay: 0,
        saveResults: false,
      }));

      await act(async () => {
        await result.current.runTest();
      });

      await waitFor(() => {
        expect(result.current.testStatus).toBe('completed');
      });
    });
  });

  describe('tab management', () => {
    it('should open tab', async () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      let tabIdResult: number | null;
      await act(async () => {
        tabIdResult = await result.current.openTab('https://example.com');
      });

      expect(tabIdResult!).toBe(123);
      expect(result.current.tabId).toBe(123);
    });

    it('should close tab', async () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      await act(async () => {
        await result.current.openTab('https://example.com');
      });

      await act(async () => {
        await result.current.closeTab();
      });

      expect(result.current.tabId).toBeNull();
    });
  });

  describe('logging', () => {
    it('should add logs', async () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      act(() => {
        result.current.addLog('info', 'Test message');
        result.current.addLog('error', 'Error message', 0, 0);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[0].level).toBe('info');
      expect(result.current.logs[1].level).toBe('error');
    });

    it('should clear logs', async () => {
      const { result } = renderHook(() => useOrchestrator({ project: mockProject }));

      act(() => {
        result.current.addLog('info', 'Test');
        result.current.clearLogs();
      });

      expect(result.current.logs).toHaveLength(0);
    });
  });

  describe('callbacks', () => {
    it('should call onStepComplete', async () => {
      const onStepComplete = vi.fn();

      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 0,
        saveResults: false,
        onStepComplete,
      }));

      await act(async () => {
        await result.current.runTest();
      });

      await waitFor(() => {
        expect(result.current.testStatus).toBe('completed');
      });

      expect(onStepComplete).toHaveBeenCalled();
    });

    it('should call onRowComplete', async () => {
      const onRowComplete = vi.fn();

      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 0,
        saveResults: false,
        onRowComplete,
      }));

      await act(async () => {
        await result.current.runTest();
      });

      await waitFor(() => {
        expect(onRowComplete).toHaveBeenCalled();
      });
    });
  });

  describe('export', () => {
    it('should export results', async () => {
      const { result } = renderHook(() => useOrchestrator({
        project: mockProject,
        stepDelay: 0,
        saveResults: false,
      }));

      await act(async () => {
        await result.current.runTest();
      });

      await waitFor(() => {
        expect(result.current.testStatus).toBe('completed');
      });

      const exported = result.current.exportResults();

      expect(exported.projectId).toBe(1);
      expect(exported.projectName).toBe('Test Project');
      expect(exported.results.length).toBeGreaterThan(0);
    });
  });
});

describe('utility functions', () => {
  describe('formatTestDuration', () => {
    it('should format milliseconds', () => {
      expect(formatTestDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatTestDuration(2500)).toBe('2.5s');
    });

    it('should format minutes', () => {
      expect(formatTestDuration(125000)).toBe('2m 5s');
    });
  });

  describe('calculatePassRate', () => {
    it('should calculate correct rate', () => {
      expect(calculatePassRate(8, 2)).toBe(80);
      expect(calculatePassRate(0, 5)).toBe(0);
      expect(calculatePassRate(5, 0)).toBe(100);
      expect(calculatePassRate(0, 0)).toBe(0);
    });
  });

  describe('getStatusBadgeColor', () => {
    it('should return correct colors', () => {
      expect(getStatusBadgeColor('completed')).toBe('green');
      expect(getStatusBadgeColor('failed')).toBe('red');
      expect(getStatusBadgeColor('running')).toBe('blue');
      expect(getStatusBadgeColor('stopped')).toBe('orange');
    });
  });
});
