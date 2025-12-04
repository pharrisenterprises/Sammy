/**
 * Tests for useRecording hook
 * @module hooks/useRecording.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useRecording,
  getStepDisplayName,
  getStepIcon,
  isValidStep,
  type RecordedStep,
  type IChromeRuntime,
} from './useRecording';
import type { StorageResponse } from './useStorage';

// ============================================================================
// MOCKS
// ============================================================================

type MessageListener = (message: unknown, sender: unknown, sendResponse: unknown) => void;

function createMockChromeRuntime(): IChromeRuntime & {
  _listeners: MessageListener[];
  _simulateMessage: (message: unknown) => void;
} {
  const listeners: MessageListener[] = [];

  return {
    _listeners: listeners,
    _simulateMessage: (message: unknown) => {
      listeners.forEach(listener => listener(message, {}, () => {}));
    },
    sendMessage: vi.fn((message, callback) => {
      setTimeout(() => {
        if ((message as { action?: string }).action === 'start_recording') {
          callback?.({ success: true, tabId: 123 });
        } else if ((message as { action?: string }).action === 'stop_recording') {
          callback?.({ success: true });
        } else if ((message as { action?: string }).action === 'update_project_steps') {
          callback?.({ success: true });
        } else if ((message as { action?: string }).action === 'get_project_by_id') {
          callback?.({ 
            success: true, 
            data: { 
              project: { 
                id: 1, 
                recorded_steps: [] 
              } 
            } 
          });
        } else {
          callback?.({ success: true });
        }
      }, 0);
    }),
    onMessage: {
      addListener: vi.fn((listener: MessageListener) => {
        listeners.push(listener);
      }),
      removeListener: vi.fn((listener: MessageListener) => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      }),
    },
    lastError: undefined,
  };
}

let mockChrome: ReturnType<typeof createMockChromeRuntime>;

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

describe('useRecording', () => {
  describe('initial state', () => {
    it('should have idle status initially', () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      expect(result.current.status).toBe('idle');
      expect(result.current.isRecording).toBe(false);
      expect(result.current.steps).toHaveLength(0);
    });

    it('should use initial steps if provided', () => {
      const initialSteps: RecordedStep[] = [
        {
          id: 'step_1',
          eventType: 'click',
          xpath: '/button',
          timestamp: Date.now(),
          bundle: {},
        },
      ];

      const { result } = renderHook(() =>
        useRecording({ projectId: 1, initialSteps })
      );

      expect(result.current.steps).toHaveLength(1);
    });
  });

  describe('recording control', () => {
    it('should start recording', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      let success: boolean;
      await act(async () => {
        success = await result.current.startRecording();
      });

      expect(success!).toBe(true);
      expect(result.current.isRecording).toBe(true);
      expect(result.current.status).toBe('recording');
    });

    it('should stop recording', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      await act(async () => {
        await result.current.startRecording();
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.stopRecording();
      });

      expect(success!).toBe(true);
      expect(result.current.isRecording).toBe(false);
      expect(result.current.status).toBe('stopped');
    });

    it('should pause and resume recording', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.pauseRecording();
      });

      expect(result.current.isPaused).toBe(true);
      expect(result.current.status).toBe('paused');

      act(() => {
        result.current.resumeRecording();
      });

      expect(result.current.isRecording).toBe(true);
      expect(result.current.status).toBe('recording');
    });
  });

  describe('message listening', () => {
    it('should capture logEvent messages when recording', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      await act(async () => {
        await result.current.startRecording();
      });

      // Simulate logEvent message
      act(() => {
        mockChrome._simulateMessage({
          type: 'logEvent',
          data: {
            eventType: 'click',
            xpath: '/button[@id="submit"]',
            label: 'Submit',
            bundle: { id: 'submit' },
          },
        });
      });

      expect(result.current.steps).toHaveLength(1);
      expect(result.current.steps[0].eventType).toBe('click');
      expect(result.current.steps[0].label).toBe('Submit');
    });

    it('should not capture messages when not recording', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      // Simulate message without starting recording
      act(() => {
        mockChrome._simulateMessage({
          type: 'logEvent',
          data: {
            eventType: 'click',
            xpath: '/button',
            bundle: {},
          },
        });
      });

      expect(result.current.steps).toHaveLength(0);
    });

    it('should set unsaved changes flag on capture', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);

      act(() => {
        mockChrome._simulateMessage({
          type: 'logEvent',
          data: {
            eventType: 'click',
            xpath: '/button',
            bundle: {},
          },
        });
      });

      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe('step management', () => {
    it('should add step manually', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({
          eventType: 'click',
          xpath: '/button',
          bundle: {},
        });
      });

      expect(result.current.steps).toHaveLength(1);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should update step', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({
          eventType: 'click',
          xpath: '/button',
          bundle: {},
        });
      });

      const stepId = result.current.steps[0].id;

      act(() => {
        result.current.updateStep(stepId, { label: 'Updated Label' });
      });

      expect(result.current.steps[0].label).toBe('Updated Label');
    });

    it('should delete step', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({
          eventType: 'click',
          xpath: '/button',
          bundle: {},
        });
      });

      const stepId = result.current.steps[0].id;

      act(() => {
        result.current.deleteStep(stepId);
      });

      expect(result.current.steps).toHaveLength(0);
    });

    it('should reorder steps', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({ eventType: 'click', xpath: '/button1', bundle: {} });
        result.current.addStep({ eventType: 'click', xpath: '/button2', bundle: {} });
        result.current.addStep({ eventType: 'click', xpath: '/button3', bundle: {} });
      });

      act(() => {
        result.current.reorderSteps(0, 2);
      });

      expect(result.current.steps[2].xpath).toBe('/button1');
    });

    it('should clear all steps', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({ eventType: 'click', xpath: '/button1', bundle: {} });
        result.current.addStep({ eventType: 'click', xpath: '/button2', bundle: {} });
      });

      act(() => {
        result.current.clearSteps();
      });

      expect(result.current.steps).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should save steps', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({ eventType: 'click', xpath: '/button', bundle: {} });
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.saveSteps();
      });

      expect(success!).toBe(true);
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should load steps', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      await act(async () => {
        await result.current.loadSteps();
      });

      // Mock returns empty steps
      expect(result.current.steps).toHaveLength(0);
    });
  });

  describe('logs', () => {
    it('should add log entries', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addLog('info', 'Test message');
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].level).toBe('info');
      expect(result.current.logs[0].message).toBe('Test message');
    });

    it('should clear logs', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addLog('info', 'Test message');
        result.current.clearLogs();
      });

      expect(result.current.logs).toHaveLength(0);
    });
  });

  describe('session info', () => {
    it('should track session state', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      expect(result.current.session.projectId).toBe(1);
      expect(result.current.session.status).toBe('idle');

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.session.status).toBe('recording');
      expect(result.current.session.startedAt).not.toBeNull();
    });
  });

  describe('utilities', () => {
    it('should get step by id', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({ eventType: 'click', xpath: '/button', bundle: {} });
      });

      const stepId = result.current.steps[0].id;
      const step = result.current.getStepById(stepId);

      expect(step).toBeDefined();
      expect(step?.xpath).toBe('/button');
    });

    it('should export steps', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.addStep({ eventType: 'click', xpath: '/button', bundle: {} });
      });

      const exported = result.current.exportSteps();

      expect(exported.projectId).toBe(1);
      expect(exported.steps).toHaveLength(1);
      expect(exported.totalCount).toBe(1);
    });

    it('should set tab id', async () => {
      const { result } = renderHook(() => useRecording({ projectId: 1 }));

      act(() => {
        result.current.setTabId(456);
      });

      expect(result.current.session.tabId).toBe(456);
    });
  });
});

describe('utility functions', () => {
  describe('getStepDisplayName', () => {
    it('should use label if available', () => {
      const step: RecordedStep = {
        id: '1',
        eventType: 'click',
        xpath: '/button',
        label: 'Submit Button',
        timestamp: Date.now(),
        bundle: {},
      };

      expect(getStepDisplayName(step)).toBe('click: Submit Button');
    });

    it('should use visible text if no label', () => {
      const step: RecordedStep = {
        id: '1',
        eventType: 'click',
        xpath: '/button',
        timestamp: Date.now(),
        bundle: { visibleText: 'Click Me' },
      };

      expect(getStepDisplayName(step)).toBe('click: "Click Me"');
    });

    it('should use xpath if nothing else', () => {
      const step: RecordedStep = {
        id: '1',
        eventType: 'click',
        xpath: '/html/body/button',
        timestamp: Date.now(),
        bundle: {},
      };

      expect(getStepDisplayName(step)).toContain('click: /html/body/button');
    });
  });

  describe('getStepIcon', () => {
    it('should return correct icons', () => {
      expect(getStepIcon('click')).toBe('🖱️');
      expect(getStepIcon('input')).toBe('⌨️');
      expect(getStepIcon('enter')).toBe('↵');
    });
  });

  describe('isValidStep', () => {
    it('should validate complete steps', () => {
      const validStep = {
        id: '1',
        eventType: 'click' as const,
        xpath: '/button',
        timestamp: Date.now(),
        bundle: {},
      };

      expect(isValidStep(validStep)).toBe(true);
    });

    it('should reject incomplete steps', () => {
      const invalidStep = {
        id: '1',
        eventType: 'click' as const,
        // missing xpath, timestamp, bundle
      };

      expect(isValidStep(invalidStep)).toBe(false);
    });
  });
});
