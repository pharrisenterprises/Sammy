/**
 * @fileoverview Tests for state manager
 * @module background/state-manager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StateManager,
  getStateManager,
  initializeStateManager,
  resetStateManager,
  createStateSelector,
  createDerivedState,
  DEFAULT_STATE,
  DEFAULT_CONFIG,
  TRANSIENT_KEYS,
  PERSISTENT_KEYS
} from './state-manager';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    },
    onChanged: {
      addListener: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined)
  }
};

vi.stubGlobal('chrome', mockChrome);

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetStateManager();
    manager = new StateManager({ debug: false, broadcastChanges: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.destroy();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default state', () => {
      expect(DEFAULT_STATE.isRecording).toBe(false);
      expect(DEFAULT_STATE.isReplaying).toBe(false);
      expect(DEFAULT_STATE.activeProjectId).toBeNull();
    });

    it('should have transient keys defined', () => {
      expect(TRANSIENT_KEYS).toContain('isRecording');
      expect(TRANSIENT_KEYS).toContain('isReplaying');
      expect(TRANSIENT_KEYS).toContain('recordingTabId');
    });

    it('should have persistent keys defined', () => {
      expect(PERSISTENT_KEYS).toContain('activeProjectId');
      expect(PERSISTENT_KEYS).toContain('debugMode');
    });
  });

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should load state from storage', async () => {
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [DEFAULT_CONFIG.storageKey]: {
          activeProjectId: 'project-123',
          debugMode: true
        }
      });

      await manager.initialize();

      expect(manager.get('activeProjectId')).toBe('project-123');
      expect(manager.get('debugMode')).toBe(true);
    });

    it('should reset transient state on init', async () => {
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [DEFAULT_CONFIG.storageKey]: {
          isRecording: true, // Should be reset
          activeProjectId: 'project-123' // Should persist
        }
      });

      await manager.initialize();

      expect(manager.get('isRecording')).toBe(false);
      expect(manager.get('activeProjectId')).toBe('project-123');
    });

    it('should not initialize twice', async () => {
      await manager.initialize();
      await manager.initialize();

      expect(mockChrome.storage.local.get).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  describe('State Access', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get entire state', () => {
      const state = manager.getState();
      expect(state).toBeDefined();
      expect(state.isRecording).toBe(false);
    });

    it('should get specific value', () => {
      manager.set('activeProjectId', 'project-456');
      expect(manager.get('activeProjectId')).toBe('project-456');
    });

    it('should check if value exists', () => {
      expect(manager.has('activeProjectId')).toBe(false);
      manager.set('activeProjectId', 'project-123');
      expect(manager.has('activeProjectId')).toBe(true);
    });

    it('should pick multiple values', () => {
      manager.set('activeProjectId', 'proj-1');
      manager.set('isRecording', true);

      const picked = manager.pick('activeProjectId', 'isRecording');

      expect(picked.activeProjectId).toBe('proj-1');
      expect(picked.isRecording).toBe(true);
    });
  });

  // ==========================================================================
  // STATE UPDATES
  // ==========================================================================

  describe('State Updates', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should set single value', () => {
      manager.set('isRecording', true);
      expect(manager.get('isRecording')).toBe(true);
    });

    it('should not update if value unchanged', () => {
      const subscriber = vi.fn();
      manager.subscribe('isRecording', subscriber);

      manager.set('isRecording', false); // Same as default
      expect(subscriber).not.toHaveBeenCalled();
    });

    it('should update multiple values', () => {
      manager.update({
        isRecording: true,
        recordingTabId: 123,
        activeProjectId: 'project-789'
      });

      expect(manager.get('isRecording')).toBe(true);
      expect(manager.get('recordingTabId')).toBe(123);
      expect(manager.get('activeProjectId')).toBe('project-789');
    });

    it('should transform state with updater function', () => {
      manager.set('currentStepIndex', 5);

      manager.transform((state) => ({
        currentStepIndex: state.currentStepIndex + 1
      }));

      expect(manager.get('currentStepIndex')).toBe(6);
    });

    it('should reset to defaults', () => {
      manager.set('activeProjectId', 'project-123');
      manager.set('isRecording', true);

      manager.reset();

      expect(manager.get('activeProjectId')).toBeNull();
      expect(manager.get('isRecording')).toBe(false);
    });

    it('should save persistent keys to storage', async () => {
      manager.set('activeProjectId', 'project-to-save');

      // Fast-forward debounce timer
      vi.advanceTimersByTime(600);

      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    it('should not save transient keys', async () => {
      manager.set('isRecording', true);

      vi.advanceTimersByTime(600);

      // Should not trigger save for transient key only
      const calls = mockChrome.storage.local.set.mock.calls;
      if (calls.length > 0) {
        const savedData = calls[0][0][DEFAULT_CONFIG.storageKey];
        expect(savedData.isRecording).toBeUndefined();
      }
    });
  });

  // ==========================================================================
  // LOCKING
  // ==========================================================================

  describe('Locking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should block updates when locked', () => {
      manager.lock();
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      manager.set('isRecording', true);

      expect(manager.get('isRecording')).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      manager.unlock();
    });

    it('should allow updates after unlock', () => {
      manager.lock();
      manager.unlock();

      manager.set('isRecording', true);

      expect(manager.get('isRecording')).toBe(true);
    });

    it('should execute with lock', async () => {
      const result = await manager.withLock(async () => {
        return 'locked result';
      });

      expect(result).toBe('locked result');
    });
  });

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  describe('Subscriptions', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should subscribe to specific key', () => {
      const callback = vi.fn();
      manager.subscribe('isRecording', callback);

      manager.set('isRecording', true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'isRecording',
          previousValue: false,
          newValue: true
        })
      );
    });

    it('should subscribe to all changes', () => {
      const callback = vi.fn();
      manager.subscribeAll(callback);

      manager.set('isRecording', true);
      manager.set('activeProjectId', 'proj-1');

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe('isRecording', callback);

      unsubscribe();
      manager.set('isRecording', true);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear all subscriptions', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.subscribe('isRecording', callback1);
      manager.subscribe('activeProjectId', callback2);
      
      manager.clearSubscriptions();
      
      manager.set('isRecording', true);
      manager.set('activeProjectId', 'proj-1');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should get subscription count', () => {
      manager.subscribe('isRecording', () => {});
      manager.subscribe('activeProjectId', () => {});

      expect(manager.getSubscriptionCount()).toBe(2);
    });
  });

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  describe('Utilities', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should force save', async () => {
      manager.set('activeProjectId', 'force-save-test');
      
      await manager.forceSave();

      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    it('should get snapshot', () => {
      const snapshot = manager.getSnapshot();

      expect(snapshot.state).toBeDefined();
      expect(snapshot.subscriptionCount).toBe(0);
      expect(snapshot.initialized).toBe(true);
      expect(snapshot.locked).toBe(false);
    });

    it('should destroy manager', () => {
      manager.subscribe('isRecording', () => {});
      manager.destroy();

      expect(manager.getSubscriptionCount()).toBe(0);
      expect(manager.isInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getStateManager();
      const instance2 = getStateManager();

      expect(instance1).toBe(instance2);
    });

    it('should initialize singleton', async () => {
      const instance = await initializeStateManager();
      expect(instance.isInitialized()).toBe(true);
    });

    it('should reset singleton', () => {
      getStateManager();
      resetStateManager();
      
      // New instance should be different
      const newInstance = getStateManager();
      expect(newInstance.isInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // SELECTORS AND DERIVED STATE
  // ==========================================================================

  describe('Selectors and Derived State', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should create state selector', () => {
      const selector = createStateSelector(manager, 'isRecording');

      expect(selector.get()).toBe(false);

      const callback = vi.fn();
      selector.subscribe(callback);

      manager.set('isRecording', true);

      expect(callback).toHaveBeenCalled();
    });

    it('should create derived state', () => {
      const derived = createDerivedState(
        manager,
        (state) => state.isRecording || state.isReplaying,
        ['isRecording', 'isReplaying']
      );

      expect(derived.get()).toBe(false);

      manager.set('isRecording', true);
      expect(derived.get()).toBe(true);
    });

    it('should subscribe to derived state', () => {
      const derived = createDerivedState(
        manager,
        (state) => state.isRecording && state.recordingTabId !== null,
        ['isRecording', 'recordingTabId']
      );

      const callback = vi.fn();
      derived.subscribe(callback);

      manager.update({ isRecording: true, recordingTabId: 123 });

      expect(callback).toHaveBeenCalledWith(true);
    });
  });
});
