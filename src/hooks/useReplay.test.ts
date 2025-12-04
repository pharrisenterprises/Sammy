/**
 * Tests for useReplay hook
 * @module hooks/useReplay.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useReplay,
  calculatePassRate,
  formatDuration,
  getStatusColor,
  type ReplayStep,
  type IChromeRuntime,
  type IChromeTabs,
} from './useReplay';

// ============================================================================
// MOCKS
// ============================================================================

function createMockChromeRuntime(): IChromeRuntime {
  return {
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        if ((message as { action?: string }).action === 'openTab') {
          callback?.({ success: true, tabId: 123 });
        } else {
          callback?.({ success: true });
        }
      }, 0);
    }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: undefined,
  };
}

function createMockChromeTabs(): IChromeTabs {
  return {
    sendMessage: vi.fn((tabId, message, callback) => {
      setTimeout(() => {
        callback?.(true); // Step success
      }, 10);
    }),
  };
}

let mockChrome: {
  runtime: IChromeRuntime;
  tabs: IChromeTabs;
};

const mockSteps: ReplayStep[] = [
  {
    id: 'step_1',
    eventType: 'click',
    xpath: '/button[@id="submit"]',
    label: 'Submit Button',
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
];

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

describe('useReplay', () => {
  describe('initial state', () => {
    it('should have idle status initially', () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      expect(result.current.status).toBe('idle');
      expect(result.current.isRunning).toBe(false);
      expect(result.current.stepResults).toHaveLength(0);
    });

    it('should calculate progress correctly', () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      expect(result.current.progress.percentage).toBe(0);
      expect(result.current.progress.totalSteps).toBe(2);
      expect(result.current.progress.totalRows).toBe(1);
    });

    it('should track session info', () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      expect(result.current.session.projectId).toBe(1);
      expect(result.current.session.status).toBe('idle');
      expect(result.current.session.totalSteps).toBe(2);
    });
  });

  describe('replay control', () => {
    it('should start replay', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
        targetUrl: 'https://example.com',
        stepDelay: 0,
      }));

      await act(async () => {
        await result.current.startReplay();
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.status).toBe('completed');
      }, { timeout: 5000 });
    });

    it('should stop replay', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
        targetUrl: 'https://example.com',
        stepDelay: 100,
      }));

      // Start replay
      act(() => {
        result.current.startReplay();
      });

      // Wait a bit then stop
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
        await result.current.stopReplay();
      });

      expect(result.current.status).toBe('stopped');
    });

    it('should pause and resume', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
        targetUrl: 'https://example.com',
        stepDelay: 500,
      }));

      // Start replay
      act(() => {
        result.current.startReplay();
      });

      // Wait for running status
      await waitFor(() => {
        expect(result.current.status).toBe('running');
      }, { timeout: 3000 });

      // Pause
      act(() => {
        result.current.pauseReplay();
      });

      expect(result.current.isPaused).toBe(true);

      // Resume
      act(() => {
        result.current.resumeReplay();
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('should reset replay state', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      // Add some logs
      act(() => {
        result.current.addLog('info', 'Test log');
      });

      // Reset
      act(() => {
        result.current.resetReplay();
      });

      expect(result.current.logs).toHaveLength(0);
      expect(result.current.stepResults).toHaveLength(0);
      expect(result.current.status).toBe('idle');
    });
  });

  describe('step execution', () => {
    it('should execute individual step', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
        targetUrl: 'https://example.com',
      }));

      // Set tab ID first
      act(() => {
        result.current.setTabId(123);
      });

      let stepResult;
      await act(async () => {
        stepResult = await result.current.executeStep(0);
      });

      expect(stepResult).toBeDefined();
      expect(stepResult!.stepIndex).toBe(0);
    });

    it('should skip step', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      act(() => {
        result.current.skipStep(0);
      });

      expect(result.current.stepResults).toHaveLength(1);
      expect(result.current.stepResults[0].status).toBe('skipped');
    });
  });

  describe('CSV injection', () => {
    it('should inject CSV values into steps', async () => {
      const csvData = [
        { email: 'test@example.com' },
      ];

      const fieldMappings = [
        { field_name: 'email', mapped: true, inputvarfields: 'Email' },
      ];

      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
        csvData,
        fieldMappings,
        targetUrl: 'https://example.com',
        stepDelay: 0,
      }));

      act(() => {
        result.current.setTabId(123);
      });

      // Execute step with CSV data
      let stepResult;
      await act(async () => {
        stepResult = await result.current.executeStep(1, csvData[0]);
      });

      expect(stepResult).toBeDefined();
    });

    it('should track multiple rows', async () => {
      const csvData = [
        { email: 'test1@example.com' },
        { email: 'test2@example.com' },
      ];

      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
        csvData,
        targetUrl: 'https://example.com',
      }));

      expect(result.current.progress.totalRows).toBe(2);
    });
  });

  describe('logs', () => {
    it('should add log entries', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      act(() => {
        result.current.addLog('info', 'Test message');
        result.current.addLog('error', 'Error message', 0, 0);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[0].level).toBe('info');
      expect(result.current.logs[1].level).toBe('error');
    });

    it('should clear logs', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      act(() => {
        result.current.addLog('info', 'Test');
        result.current.clearLogs();
      });

      expect(result.current.logs).toHaveLength(0);
    });
  });

  describe('results', () => {
    it('should get step result', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      act(() => {
        result.current.skipStep(0);
      });

      const stepResult = result.current.getStepResult(0, 0);
      expect(stepResult).toBeDefined();
      expect(stepResult?.status).toBe('skipped');
    });

    it('should export results', async () => {
      const { result } = renderHook(() => useReplay({
        projectId: 1,
        steps: mockSteps,
      }));

      act(() => {
        result.current.skipStep(0);
      });

      const exported = result.current.exportResults();
      expect(exported.projectId).toBe(1);
      expect(exported.stepResults).toHaveLength(1);
    });
  });
});

describe('utility functions', () => {
  describe('calculatePassRate', () => {
    it('should calculate correct pass rate', () => {
      expect(calculatePassRate(8, 2)).toBe(80);
      expect(calculatePassRate(0, 5)).toBe(0);
      expect(calculatePassRate(5, 0)).toBe(100);
      expect(calculatePassRate(0, 0)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s');
    });

    it('should format minutes', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors', () => {
      expect(getStatusColor('passed')).toBe('green');
      expect(getStatusColor('failed')).toBe('red');
      expect(getStatusColor('running')).toBe('blue');
      expect(getStatusColor('pending')).toBe('gray');
    });
  });
});
