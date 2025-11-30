/**
 * @fileoverview Tests for recording coordinator
 * @module background/recording-coordinator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RecordingCoordinator,
  getRecordingCoordinator,
  resetRecordingCoordinator,
  DEFAULT_RECORDING_CONFIG
} from './recording-coordinator';
import type { LocatorBundle } from '../core/types';

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
  getTab: vi.fn().mockReturnValue({ url: 'https://example.com/page' }),
  ensureContentScript: vi.fn().mockResolvedValue(true),
  sendToTab: vi.fn().mockResolvedValue({ success: true })
};

const mockStorage = {
  getProject: vi.fn().mockResolvedValue({
    id: 'proj-123',
    name: 'Test Project',
    steps: [],
    fields: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }),
  updateProject: vi.fn().mockResolvedValue(undefined)
};

describe('RecordingCoordinator', () => {
  let coordinator: RecordingCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetRecordingCoordinator();
    
    coordinator = new RecordingCoordinator({ debug: false });
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
      expect(DEFAULT_RECORDING_CONFIG.autoSaveSteps).toBe(true);
      expect(DEFAULT_RECORDING_CONFIG.autoSaveInterval).toBe(5000);
      expect(DEFAULT_RECORDING_CONFIG.maxSteps).toBe(500);
    });
  });

  // ==========================================================================
  // RECORDING LIFECYCLE
  // ==========================================================================

  describe('Recording Lifecycle', () => {
    it('should start recording', async () => {
      const session = await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      expect(session).toBeDefined();
      expect(session.projectId).toBe('proj-123');
      expect(session.tabId).toBe(1);
      expect(session.state).toBe('recording');
      expect(coordinator.isRecording()).toBe(true);
    });

    it('should create open step on start', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1,
        startUrl: 'https://example.com'
      });

      const steps = coordinator.getSteps();
      expect(steps.length).toBe(1);
      expect(steps[0].event).toBe('open');
      expect(steps[0].value).toBe('https://example.com');
    });

    it('should prevent multiple recordings', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      await expect(coordinator.startRecording({
        projectId: 'proj-456',
        tabId: 2
      })).rejects.toThrow('Recording already in progress');
    });

    it('should stop recording', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      const result = await coordinator.stopRecording();

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('proj-123');
      expect(coordinator.isRecording()).toBe(false);
    });

    it('should pause recording', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.pauseRecording();

      expect(coordinator.isPaused()).toBe(true);
      expect(coordinator.getState()).toBe('paused');
    });

    it('should resume recording', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.pauseRecording();
      coordinator.resumeRecording();

      expect(coordinator.isPaused()).toBe(false);
      expect(coordinator.isRecording()).toBe(true);
    });

    it('should update state manager on start', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      expect(mockStateManager.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecording: true,
          recordingTabId: 1,
          activeProjectId: 'proj-123'
        })
      );
    });

    it('should update state manager on stop', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      await coordinator.stopRecording();

      expect(mockStateManager.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isRecording: false,
          recordingTabId: null
        })
      );
    });
  });

  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================

  describe('Step Management', () => {
    const mockBundle: LocatorBundle = {
      tag: 'input',
      id: 'username',
      name: 'username',
      placeholder: 'Enter username',
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

    beforeEach(async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });
    });

    it('should capture step', () => {
      const step = coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      expect(step).toBeDefined();
      expect(step?.event).toBe('click');
    });

    it('should capture input step with value', () => {
      const step = coordinator.handleStepCaptured({
        event: 'input',
        value: 'testuser',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      expect(step?.event).toBe('input');
      expect(step?.value).toBe('testuser');
    });

    it('should capture enter step', () => {
      const step = coordinator.handleStepCaptured({
        event: 'enter',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      expect(step?.event).toBe('enter');
    });

    it('should increment step order correctly', () => {
      coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      const step2 = coordinator.handleStepCaptured({
        event: 'input',
        value: 'test',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      expect(step2?.event).toBe('input');
      expect(coordinator.getStepCount()).toBe(3);
    });

    it('should delete last step', () => {
      coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      const deleted = coordinator.deleteLastStep();

      expect(deleted?.event).toBe('click');
      expect(coordinator.getStepCount()).toBe(1); // Only open step
    });

    it('should not delete open step', () => {
      const deleted = coordinator.deleteLastStep();
      expect(deleted).toBeNull();
      expect(coordinator.getStepCount()).toBe(1);
    });

    it('should delete step at index', () => {
      coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      coordinator.handleStepCaptured({
        event: 'input',
        value: 'test',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      const deleted = coordinator.deleteStepAt(1); // Delete click step

      expect(deleted?.event).toBe('click');
      
      // Check remaining steps
      const steps = coordinator.getSteps();
      expect(steps[1].event).toBe('input');
    });

    it('should ignore steps when not recording', async () => {
      await coordinator.stopRecording();

      const step = coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      expect(step).toBeNull();
    });

    it('should respect max steps limit', async () => {
      const coordinator2 = new RecordingCoordinator({ maxSteps: 3 });
      coordinator2.setTabManager(mockTabManager);

      await coordinator2.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      // Open step + 2 more = 3 (max)
      coordinator2.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      coordinator2.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      // This should be ignored
      const step = coordinator2.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: mockBundle,
        timestamp: Date.now()
      });

      expect(step).toBeNull();
      expect(coordinator2.getStepCount()).toBe(3);

      coordinator2.destroy();
    });
  });

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  describe('Events', () => {
    it('should emit session_started event', async () => {
      const listener = vi.fn();
      coordinator.on(listener);

      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_started'
        })
      );
    });

    it('should emit step_captured event', async () => {
      const listener = vi.fn();
      coordinator.on(listener);

      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: {} as LocatorBundle,
        timestamp: Date.now()
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'step_captured'
        })
      );
    });

    it('should emit session_stopped event', async () => {
      const listener = vi.fn();
      coordinator.on(listener);

      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      await coordinator.stopRecording();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_stopped'
        })
      );
    });

    it('should unsubscribe listener', async () => {
      const listener = vi.fn();
      const unsubscribe = coordinator.on(listener);

      unsubscribe();

      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TAB HANDLING
  // ==========================================================================

  describe('Tab Handling', () => {
    it('should handle tab navigation', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.handleTabNavigation(1, 'https://example.com/page2');

      const steps = coordinator.getSteps();
      expect(steps.length).toBe(2);
      expect(steps[1].event).toBe('open');
      expect(steps[1].value).toBe('https://example.com/page2');
    });

    it('should ignore navigation from other tabs', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.handleTabNavigation(999, 'https://other.com');

      expect(coordinator.getStepCount()).toBe(1);
    });

    it('should stop recording when tab closes', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.handleTabClosed(1);

      // Wait for async stop
      await vi.runAllTimersAsync();

      expect(coordinator.isRecording()).toBe(false);
    });
  });

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  describe('Persistence', () => {
    it('should save steps to project on stop', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      coordinator.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: {} as LocatorBundle,
        timestamp: Date.now()
      });

      await coordinator.stopRecording();

      expect(mockStorage.updateProject).toHaveBeenCalled();
    });

    it('should auto-save periodically', async () => {
      const coordinator2 = new RecordingCoordinator({
        autoSaveSteps: true,
        autoSaveInterval: 1000
      });
      coordinator2.setTabManager(mockTabManager);
      coordinator2.setStorage(mockStorage);

      await coordinator2.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      // Clear initial calls from startRecording
      mockStorage.updateProject.mockClear();

      coordinator2.handleStepCaptured({
        event: 'click',
        value: '',
        bundle: {} as LocatorBundle,
        timestamp: Date.now()
      });

      // Run the timer to trigger auto-save
      await vi.runOnlyPendingTimersAsync();

      expect(mockStorage.updateProject).toHaveBeenCalled();

      await coordinator2.stopRecording();
      coordinator2.destroy();
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getRecordingCoordinator();
      const instance2 = getRecordingCoordinator();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getRecordingCoordinator();
      resetRecordingCoordinator();
      const instance2 = getRecordingCoordinator();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // STATUS
  // ==========================================================================

  describe('Status', () => {
    it('should return session copy', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 1
      });

      const session = coordinator.getSession();

      expect(session?.projectId).toBe('proj-123');
    });

    it('should return recording tab ID', async () => {
      await coordinator.startRecording({
        projectId: 'proj-123',
        tabId: 42
      });

      expect(coordinator.getRecordingTabId()).toBe(42);
    });

    it('should return null when not recording', () => {
      expect(coordinator.getSession()).toBeNull();
      expect(coordinator.getRecordingTabId()).toBeNull();
    });
  });
});
