/**
 * Tests for BackgroundState
 * @module background/BackgroundState.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  BackgroundState,
  createBackgroundState,
  STATE_KEYS,
  STATE_VERSION,
  type IChromeStorage,
  type TrackedTabInfo,
  type RecordingState,
  type StateChangeEvent,
} from './BackgroundState';
import { BackgroundConfig } from './BackgroundConfig';

// ============================================================================
// MOCK FACTORY
// ============================================================================

function createMockChromeStorage(): IChromeStorage & {
  _localData: Record<string, unknown>;
  _sessionData: Record<string, unknown>;
} {
  const localData: Record<string, unknown> = {};
  const sessionData: Record<string, unknown> = {};

  return {
    _localData: localData,
    _sessionData: sessionData,
    local: {
      get: vi.fn(async (keys) => {
        if (keys === null) {
          return { ...localData };
        }
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of keyArray) {
          if (key in localData) {
            result[key] = localData[key];
          }
        }
        return result;
      }),
      set: vi.fn(async (items) => {
        Object.assign(localData, items);
      }),
      remove: vi.fn(async (keys) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          delete localData[key];
        }
      }),
      clear: vi.fn(async () => {
        for (const key in localData) {
          delete localData[key];
        }
      }),
    },
    session: {
      get: vi.fn(async (keys) => {
        if (keys === null) {
          return { ...sessionData };
        }
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of keyArray) {
          if (key in sessionData) {
            result[key] = sessionData[key];
          }
        }
        return result;
      }),
      set: vi.fn(async (items) => {
        Object.assign(sessionData, items);
      }),
      remove: vi.fn(async (keys) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          delete sessionData[key];
        }
      }),
      clear: vi.fn(async () => {
        for (const key in sessionData) {
          delete sessionData[key];
        }
      }),
    },
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('BackgroundState', () => {
  let state: BackgroundState;
  let config: BackgroundConfig;
  let mockStorage: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    config = new BackgroundConfig();
    // Disable debounce for tests
    config.updateState({ saveDebounce: 0 });
    mockStorage = createMockChromeStorage();
    state = new BackgroundState(config, mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // BASIC SAVE/LOAD TESTS
  // ==========================================================================

  describe('save and load', () => {
    it('should save and load a value', async () => {
      await state.save('testKey', 'testValue');
      const loaded = await state.load<string>('testKey');

      expect(loaded).toBe('testValue');
    });

    it('should save to chrome.storage.local', async () => {
      await state.save('testKey', 'testValue');

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'bg_testKey': 'testValue',
      });
    });

    it('should load from cache if available', async () => {
      await state.save('testKey', 'cachedValue');

      // Clear mock call count
      vi.mocked(mockStorage.local.get).mockClear();

      const loaded = await state.load<string>('testKey');

      expect(loaded).toBe('cachedValue');
      // Should not hit storage because it's cached
      expect(mockStorage.local.get).not.toHaveBeenCalled();
    });

    it('should handle complex objects', async () => {
      const obj = { name: 'Test', items: [1, 2, 3], nested: { deep: true } };
      await state.save('complex', obj);
      const loaded = await state.load<typeof obj>('complex');

      expect(loaded).toEqual(obj);
    });

    it('should return undefined for non-existent keys', async () => {
      const loaded = await state.load('nonexistent');

      expect(loaded).toBeUndefined();
    });
  });

  // ==========================================================================
  // DELETE TESTS
  // ==========================================================================

  describe('delete', () => {
    it('should delete a value', async () => {
      await state.save('testKey', 'testValue');
      await state.delete('testKey');
      const loaded = await state.load('testKey');

      expect(loaded).toBeUndefined();
    });

    it('should remove from storage', async () => {
      await state.save('testKey', 'testValue');
      await state.delete('testKey');

      expect(mockStorage.local.remove).toHaveBeenCalledWith('bg_testKey');
    });
  });

  // ==========================================================================
  // CLEAR TESTS
  // ==========================================================================

  describe('clear', () => {
    it('should clear all state', async () => {
      await state.save('key1', 'value1');
      await state.save('key2', 'value2');
      await state.clear();

      const key1 = await state.load('key1');
      const key2 = await state.load('key2');

      expect(key1).toBeUndefined();
      expect(key2).toBeUndefined();
    });
  });

  // ==========================================================================
  // RESTORE TESTS
  // ==========================================================================

  describe('restore', () => {
    it('should restore state from storage', async () => {
      // Pre-populate storage
      mockStorage._localData['bg_openedTabId'] = 123;
      mockStorage._localData['bg_activeProject'] = 456;

      await state.restore();

      expect(state.isCacheInitialized()).toBe(true);
      expect(await state.loadOpenedTabId()).toBe(123);
      expect(await state.loadActiveProject()).toBe(456);
    });

    it('should skip restore if autoRestore disabled', async () => {
      config.updateState({ autoRestore: false });
      mockStorage._localData['bg_openedTabId'] = 123;

      await state.restore();

      expect(state.isCacheInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // KEYS TESTS
  // ==========================================================================

  describe('keys', () => {
    it('should return all keys', async () => {
      await state.save('key1', 'value1');
      await state.save('key2', 'value2');

      const keys = await state.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should filter by prefix', async () => {
      mockStorage._localData['other_key'] = 'other';
      await state.save('our_key', 'ours');

      const keys = await state.keys();

      expect(keys).toContain('our_key');
      expect(keys).not.toContain('other_key');
    });
  });

  // ==========================================================================
  // CONVENIENCE METHOD TESTS
  // ==========================================================================

  describe('opened tab ID', () => {
    it('should save and load opened tab ID', async () => {
      await state.saveOpenedTabId(123);
      const tabId = await state.loadOpenedTabId();

      expect(tabId).toBe(123);
    });

    it('should return null when not set', async () => {
      const tabId = await state.loadOpenedTabId();

      expect(tabId).toBeNull();
    });
  });

  describe('tracked tabs', () => {
    it('should save and load tracked tabs', async () => {
      const tabs: TrackedTabInfo[] = [
        { tabId: 1, url: 'https://example1.com', injected: true, trackedAt: new Date().toISOString() },
        { tabId: 2, url: 'https://example2.com', injected: false, trackedAt: new Date().toISOString() },
      ];

      await state.saveTrackedTabs(tabs);
      const loaded = await state.loadTrackedTabs();

      expect(loaded).toHaveLength(2);
      expect(loaded[0].tabId).toBe(1);
    });

    it('should return empty array when not set', async () => {
      const tabs = await state.loadTrackedTabs();

      expect(tabs).toEqual([]);
    });

    it('should add tracked tab', async () => {
      const tab: TrackedTabInfo = {
        tabId: 1,
        url: 'https://example.com',
        injected: true,
        trackedAt: new Date().toISOString(),
      };

      await state.addTrackedTab(tab);
      const tabs = await state.loadTrackedTabs();

      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe(1);
    });

    it('should update existing tracked tab', async () => {
      const tab1: TrackedTabInfo = {
        tabId: 1,
        url: 'https://example.com',
        injected: false,
        trackedAt: new Date().toISOString(),
      };
      const tab2: TrackedTabInfo = {
        tabId: 1,
        url: 'https://example.com',
        injected: true,
        trackedAt: new Date().toISOString(),
      };

      await state.addTrackedTab(tab1);
      await state.addTrackedTab(tab2);
      const tabs = await state.loadTrackedTabs();

      expect(tabs).toHaveLength(1);
      expect(tabs[0].injected).toBe(true);
    });

    it('should remove tracked tab', async () => {
      await state.addTrackedTab({
        tabId: 1,
        url: 'https://example.com',
        injected: true,
        trackedAt: new Date().toISOString(),
      });
      await state.addTrackedTab({
        tabId: 2,
        url: 'https://example2.com',
        injected: true,
        trackedAt: new Date().toISOString(),
      });

      await state.removeTrackedTab(1);
      const tabs = await state.loadTrackedTabs();

      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe(2);
    });
  });

  describe('active project', () => {
    it('should save and load active project', async () => {
      await state.saveActiveProject(42);
      const projectId = await state.loadActiveProject();

      expect(projectId).toBe(42);
    });
  });

  describe('recording state', () => {
    it('should save and load recording state', async () => {
      const recordingState: RecordingState = {
        projectId: 1,
        tabId: 123,
        isRecording: true,
        stepCount: 5,
        startedAt: new Date().toISOString(),
      };

      await state.saveRecordingState(recordingState);
      const loaded = await state.loadRecordingState();

      expect(loaded?.projectId).toBe(1);
      expect(loaded?.isRecording).toBe(true);
    });

    it('should return null when not recording', async () => {
      const recordingState = await state.loadRecordingState();

      expect(recordingState).toBeNull();
    });
  });

  // ==========================================================================
  // SNAPSHOT TESTS
  // ==========================================================================

  describe('snapshots', () => {
    it('should save and load snapshot', async () => {
      await state.saveOpenedTabId(123);
      await state.saveActiveProject(42);
      await state.saveRecordingState({
        projectId: 42,
        tabId: 123,
        isRecording: true,
        stepCount: 10,
        startedAt: new Date().toISOString(),
      });

      await state.saveSnapshot();
      const snapshot = await state.loadSnapshot();

      expect(snapshot?.openedTabId).toBe(123);
      expect(snapshot?.activeProjectId).toBe(42);
      expect(snapshot?.version).toBe(STATE_VERSION);
    });

    it('should restore from snapshot', async () => {
      const snapshot = {
        openedTabId: 456,
        trackedTabs: [{ tabId: 1, url: 'https://test.com', injected: true, trackedAt: new Date().toISOString() }],
        activeProjectId: 99,
        recordingState: null,
        lastUpdated: new Date().toISOString(),
        version: STATE_VERSION,
      };

      await state.restoreFromSnapshot(snapshot);

      expect(await state.loadOpenedTabId()).toBe(456);
      expect(await state.loadActiveProject()).toBe(99);
    });
  });

  // ==========================================================================
  // DEBOUNCE TESTS
  // ==========================================================================

  describe('debounced saves', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      config.updateState({ saveDebounce: 100 });
      state = new BackgroundState(config, mockStorage);
    });

    it('should debounce multiple saves', async () => {
      await state.save('key1', 'value1');
      await state.save('key2', 'value2');
      await state.save('key3', 'value3');

      // Storage should not be called yet
      expect(mockStorage.local.set).not.toHaveBeenCalled();

      // Advance timers
      await vi.advanceTimersByTimeAsync(150);

      // Now storage should be called once with all values
      expect(mockStorage.local.set).toHaveBeenCalledTimes(1);
    });

    it('should flush pending saves', async () => {
      await state.save('key1', 'value1');
      expect(state.getPendingSavesCount()).toBe(1);

      await state.flushPendingSaves();

      expect(state.getPendingSavesCount()).toBe(0);
      expect(mockStorage.local.set).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('change events', () => {
    it('should emit change events', async () => {
      const events: StateChangeEvent[] = [];
      state.onChange(e => events.push(e));

      await state.save('testKey', 'testValue');

      expect(events).toHaveLength(1);
      expect(events[0].key).toBe('testKey');
      expect(events[0].newValue).toBe('testValue');
    });

    it('should include old value in change event', async () => {
      await state.save('testKey', 'oldValue');

      const events: StateChangeEvent[] = [];
      state.onChange(e => events.push(e));

      await state.save('testKey', 'newValue');

      expect(events[0].oldValue).toBe('oldValue');
      expect(events[0].newValue).toBe('newValue');
    });

    it('should unsubscribe from events', async () => {
      const events: StateChangeEvent[] = [];
      const unsubscribe = state.onChange(e => events.push(e));

      await state.save('key1', 'value1');
      unsubscribe();
      await state.save('key2', 'value2');

      expect(events).toHaveLength(1);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    it('should track save statistics', async () => {
      await state.save('key1', 'value1');
      await state.save('key2', 'value2');

      const stats = state.getStats();
      expect(stats.saves).toBe(2);
    });

    it('should track load statistics', async () => {
      await state.save('key', 'value');
      await state.load('key');
      await state.load('key');

      const stats = state.getStats();
      expect(stats.loads).toBe(2);
    });

    it('should reset statistics', async () => {
      await state.save('key', 'value');
      state.resetStats();

      const stats = state.getStats();
      expect(stats.saves).toBe(0);
    });
  });

  // ==========================================================================
  // SESSION STORAGE TESTS
  // ==========================================================================

  describe('session storage', () => {
    it('should use session storage when configured', async () => {
      config.updateState({ storageType: 'session' });
      state = new BackgroundState(config, mockStorage);

      await state.save('testKey', 'testValue');

      expect(mockStorage.session?.set).toHaveBeenCalled();
      expect(mockStorage.local.set).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createBackgroundState', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const mockStorage = createMockChromeStorage();

    const state = createBackgroundState(config, mockStorage);

    expect(state).toBeInstanceOf(BackgroundState);
  });
});
