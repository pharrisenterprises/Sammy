/**
 * @fileoverview Tests for replay coordinator
 * @module background/replay-coordinator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ReplayCoordinator,
  getReplayCoordinator,
  resetReplayCoordinator,
  DEFAULT_REPLAY_CONFIG
} from './replay-coordinator';
import type { Step, LocatorBundle, Field } from '../core/types';
import { createStep } from '../core/types/step';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    sendMessage: vi.fn().mockResolvedValue({ success: true })
  }
};

vi.stubGlobal('chrome', mockChrome);

// Mock dependencies
const mockStateManager = {
  update: vi.fn(),
  set: vi.fn()
};

const mockTabManager = {
  ensureContentScript: vi.fn().mockResolvedValue(true),
  sendToTab: vi.fn().mockResolvedValue({ success: true })
};

const mockStorage = {
  createTestRun: vi.fn().mockResolvedValue(undefined)
};

// Test data
const mockBundle: LocatorBundle = {
  tag: 'input',
  id: 'username',
  name: 'username',
  placeholder: '',
  aria: '',
  dataAttrs: {},
  text: '',
  css: '#username',
  xpath: '//*[@id="username"]',
  classes: [],
  pageUrl: 'https://example.com',
  bounding: null,
  iframeChain: null,
  shadowHosts: null
};

const mockSteps: Step[] = [
  createStep({ event: 'open', path: 'https://example.com', value: 'https://example.com', x: 0, y: 0 }),
  createStep({ event: 'click', path: '//*[@id="username"]', value: '', x: 100, y: 100, bundle: mockBundle }),
  createStep({ event: 'input', path: '//*[@id="username"]', value: 'testuser', x: 100, y: 100, bundle: mockBundle }),
  createStep({ event: 'enter', path: '//*[@id="username"]', value: '', x: 100, y: 100, bundle: mockBundle })
];

describe('ReplayCoordinator', () => {
  let coordinator: ReplayCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetReplayCoordinator();
    
    coordinator = new ReplayCoordinator({ debug: false });
    coordinator.setStateManager(mockStateManager);
    coordinator.setTabManager(mockTabManager);
    coordinator.setStorage(mockStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
    coordinator.destroy();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default config', () => {
      expect(DEFAULT_REPLAY_CONFIG.defaultStepDelay).toBe(500);
      expect(DEFAULT_REPLAY_CONFIG.defaultElementTimeout).toBe(5000);
      expect(DEFAULT_REPLAY_CONFIG.defaultRetryCount).toBe(3);
      expect(DEFAULT_REPLAY_CONFIG.stopOnFailure).toBe(true);
    });
  });

  // ==========================================================================
  // REPLAY LIFECYCLE
  // ==========================================================================

  describe('Replay Lifecycle', () => {
    it('should start replay', async () => {
      const session = await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      expect(session).toBeDefined();
      expect(session.projectId).toBe(123);
      expect(session.tabId).toBe(1);
      expect(session.state).toBe('running');
      expect(coordinator.isReplaying()).toBe(true);
    });

    it('should prevent multiple replays', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      await expect(coordinator.startReplay({
        projectId: 456,
        tabId: 2,
        steps: mockSteps
      })).rejects.toThrow('Replay already in progress');
    });

    it('should stop replay', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      const result = await coordinator.stopReplay();

      expect(result.status).toBe('stopped');
      expect(coordinator.isReplaying()).toBe(false);
    });

    it('should pause replay', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      coordinator.pauseReplay();

      expect(coordinator.isPaused()).toBe(true);
      expect(coordinator.getState()).toBe('paused');
    });

    it('should resume replay', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      coordinator.pauseReplay();
      coordinator.resumeReplay();

      expect(coordinator.isPaused()).toBe(false);
      expect(coordinator.isReplaying()).toBe(true);
    });

    it('should update state manager on start', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      expect(mockStateManager.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isReplaying: true,
          replayingTabId: 1,
          activeProjectId: 123,
          totalSteps: 4
        })
      );
    });
  });

  // ==========================================================================
  // STEP HANDLING
  // ==========================================================================

  describe('Step Handling', () => {
    beforeEach(async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });
    });

    it('should handle step started', () => {
      const listener = vi.fn();
      coordinator.on(listener);

      coordinator.handleStepStarted(0);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'step_started'
        })
      );
    });

    it('should handle step completed', () => {
      const listener = vi.fn();
      coordinator.on(listener);

      coordinator.handleStepCompleted({
        step: mockSteps[1],
        success: true,
        duration: 100,
        retries: 0
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'step_completed'
        })
      );
    });

    it('should handle replay completed with all passed', async () => {
      const results = mockSteps.map(step => ({
        step,
        success: true,
        duration: 100,
        retries: 0
      }));

      await coordinator.handleReplayCompleted(results);

      expect(mockStorage.createTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'passed'
        })
      );
    });

    it('should handle replay completed with failures', async () => {
      const results = mockSteps.map((step, i) => ({
        step,
        success: i !== 2, // Third step fails
        duration: 100,
        retries: 0,
        error: i === 2 ? 'Element not found' : undefined
      }));

      await coordinator.handleReplayCompleted(results);

      expect(mockStorage.createTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
    });
  });

  // ==========================================================================
  // CSV INJECTION
  // ==========================================================================

  describe('CSV Injection', () => {
    const csvData = [
      ['username', 'password', 'email'],
      ['user1', 'pass1', 'user1@test.com'],
      ['user2', 'pass2', 'user2@test.com']
    ];

    const fields: Field[] = [
      {
        field_name: 'username',
        mapped: true,
        inputvarfields: 'username'
      }
    ];

    it('should start replay with CSV injection', async () => {
      const session = await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps,
        csvData,
        csvRowIndex: 0,
        fields
      });

      expect(session.csvRowIndex).toBe(0);
    });

    it('should get injected value', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps,
        csvData,
        csvRowIndex: 0,
        fields
      });

      const value = coordinator.getInjectedValue('username');
      expect(value).toBe('user1');
    });

    it('should get injected value for second row', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps,
        csvData,
        csvRowIndex: 1,
        fields
      });

      const value = coordinator.getInjectedValue('username');
      expect(value).toBe('user2');
    });

    it('should return null for unmapped field', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps,
        csvData,
        csvRowIndex: 0,
        fields
      });

      const value = coordinator.getInjectedValue('nonexistent');
      expect(value).toBeNull();
    });
  });

  // ==========================================================================
  // LOGS GENERATION
  // ==========================================================================

  describe('Logs Generation', () => {
    it('should generate logs as string', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      coordinator.handleStepCompleted({
        step: mockSteps[0],
        success: true,
        duration: 50,
        retries: 0
      });

      const result = await coordinator.stopReplay();

      // CRITICAL: logs must be string
      expect(typeof result.logs).toBe('string');
      expect(result.logs).toContain('Replay started');
      expect(result.logs).toContain('Step 1');
    });

    it('should include CSV row in logs', async () => {
      const csvData = [
        ['username'],
        ['user1']
      ];

      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps,
        csvData,
        csvRowIndex: 0,
        fields: []
      });

      const result = await coordinator.stopReplay();

      expect(result.logs).toContain('CSV Row: 1');
    });
  });

  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });
    });

    it('should get progress', () => {
      const progress = coordinator.getProgress();

      expect(progress).toBeDefined();
      expect(progress?.totalSteps).toBe(4);
      expect(progress?.completedSteps).toBe(0);
    });

    it('should update progress after step', () => {
      coordinator.handleStepCompleted({
        step: mockSteps[0],
        success: true,
        duration: 100,
        retries: 0
      });

      const progress = coordinator.getProgress();

      expect(progress?.completedSteps).toBe(1);
    });

    it('should emit progress_update events', () => {
      const listener = vi.fn();
      coordinator.on(listener);

      vi.advanceTimersByTime(600); // After 500ms interval

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress_update'
        })
      );
    });
  });

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  describe('Events', () => {
    it('should emit session_started event', async () => {
      const listener = vi.fn();
      coordinator.on(listener);

      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_started'
        })
      );
    });

    it('should unsubscribe listener', async () => {
      const listener = vi.fn();
      const unsubscribe = coordinator.on(listener);

      unsubscribe();

      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TAB HANDLING
  // ==========================================================================

  describe('Tab Handling', () => {
    it('should stop replay when tab closes', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      coordinator.handleTabClosed(1);

      await vi.runAllTimersAsync();

      expect(coordinator.isReplaying()).toBe(false);
    });

    it('should ignore tab close for other tabs', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      coordinator.handleTabClosed(999);

      expect(coordinator.isReplaying()).toBe(true);
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getReplayCoordinator();
      const instance2 = getReplayCoordinator();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getReplayCoordinator();
      resetReplayCoordinator();
      const instance2 = getReplayCoordinator();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // STATUS
  // ==========================================================================

  describe('Status', () => {
    it('should return session copy', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      const session = coordinator.getSession();

      expect(session?.projectId).toBe(123);
    });

    it('should return replay tab ID', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 42,
        steps: mockSteps
      });

      expect(coordinator.getReplayingTabId()).toBe(42);
    });

    it('should return null when not replaying', () => {
      expect(coordinator.getSession()).toBeNull();
      expect(coordinator.getReplayingTabId()).toBeNull();
      expect(coordinator.getProgress()).toBeNull();
    });

    it('should return results', async () => {
      await coordinator.startReplay({
        projectId: 123,
        tabId: 1,
        steps: mockSteps
      });

      coordinator.handleStepCompleted({
        step: mockSteps[0],
        success: true,
        duration: 100,
        retries: 0
      });

      const results = coordinator.getResults();
      expect(results.length).toBe(1);
    });
  });
});
