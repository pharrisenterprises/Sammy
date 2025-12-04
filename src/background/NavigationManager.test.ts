/**
 * Tests for NavigationManager
 * @module background/NavigationManager.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  NavigationManager,
  createNavigationManager,
  type IChromeWebNavigation,
  type IChromeTabs,
  type NavigationEvent,
} from './NavigationManager';
import { BackgroundConfig } from './BackgroundConfig';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

type WebNavCallback<T> = (details: T) => void;
type TabRemovedCallback = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void;

function createMockChromeWebNavigation(): IChromeWebNavigation & {
  _triggerBeforeNavigate: (details: chrome.webNavigation.WebNavigationParentedCallbackDetails) => void;
  _triggerCommitted: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void;
  _triggerDOMContentLoaded: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void;
  _triggerCompleted: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void;
  _triggerErrorOccurred: (details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails) => void;
  _triggerHistoryStateUpdated: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void;
} {
  const beforeNavigateListeners: WebNavCallback<chrome.webNavigation.WebNavigationParentedCallbackDetails>[] = [];
  const committedListeners: WebNavCallback<chrome.webNavigation.WebNavigationTransitionCallbackDetails>[] = [];
  const domContentLoadedListeners: WebNavCallback<chrome.webNavigation.WebNavigationFramedCallbackDetails>[] = [];
  const completedListeners: WebNavCallback<chrome.webNavigation.WebNavigationFramedCallbackDetails>[] = [];
  const errorOccurredListeners: WebNavCallback<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails>[] = [];
  const historyStateUpdatedListeners: WebNavCallback<chrome.webNavigation.WebNavigationTransitionCallbackDetails>[] = [];

  return {
    onBeforeNavigate: {
      addListener: vi.fn((cb) => beforeNavigateListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = beforeNavigateListeners.indexOf(cb);
        if (idx >= 0) beforeNavigateListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => beforeNavigateListeners.includes(cb)),
    },
    onCommitted: {
      addListener: vi.fn((cb) => committedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = committedListeners.indexOf(cb);
        if (idx >= 0) committedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => committedListeners.includes(cb)),
    },
    onDOMContentLoaded: {
      addListener: vi.fn((cb) => domContentLoadedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = domContentLoadedListeners.indexOf(cb);
        if (idx >= 0) domContentLoadedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => domContentLoadedListeners.includes(cb)),
    },
    onCompleted: {
      addListener: vi.fn((cb) => completedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = completedListeners.indexOf(cb);
        if (idx >= 0) completedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => completedListeners.includes(cb)),
    },
    onErrorOccurred: {
      addListener: vi.fn((cb) => errorOccurredListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = errorOccurredListeners.indexOf(cb);
        if (idx >= 0) errorOccurredListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => errorOccurredListeners.includes(cb)),
    },
    onHistoryStateUpdated: {
      addListener: vi.fn((cb) => historyStateUpdatedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = historyStateUpdatedListeners.indexOf(cb);
        if (idx >= 0) historyStateUpdatedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => historyStateUpdatedListeners.includes(cb)),
    },
    onReferenceFragmentUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
    },
    _triggerBeforeNavigate: (details) => beforeNavigateListeners.forEach(cb => cb(details)),
    _triggerCommitted: (details) => committedListeners.forEach(cb => cb(details)),
    _triggerDOMContentLoaded: (details) => domContentLoadedListeners.forEach(cb => cb(details)),
    _triggerCompleted: (details) => completedListeners.forEach(cb => cb(details)),
    _triggerErrorOccurred: (details) => errorOccurredListeners.forEach(cb => cb(details)),
    _triggerHistoryStateUpdated: (details) => historyStateUpdatedListeners.forEach(cb => cb(details)),
  };
}

function createMockChromeTabs(): IChromeTabs & {
  _triggerRemoved: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void;
} {
  const removedListeners: TabRemovedCallback[] = [];

  return {
    onRemoved: {
      addListener: vi.fn((cb) => removedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = removedListeners.indexOf(cb);
        if (idx >= 0) removedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => removedListeners.includes(cb)),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
    },
    _triggerRemoved: (tabId, removeInfo) => removedListeners.forEach(cb => cb(tabId, removeInfo)),
  };
}

function createNavigationDetails(tabId: number, frameId: number = 0, url: string = 'https://example.com'): chrome.webNavigation.WebNavigationFramedCallbackDetails {
  return {
    tabId,
    frameId,
    url,
    timeStamp: Date.now(),
    processId: 1,
    documentId: 'doc1',
    documentLifecycle: 'active',
    parentDocumentId: undefined,
    parentFrameId: frameId === 0 ? -1 : 0,
  };
}

function createCommittedDetails(tabId: number, frameId: number = 0, url: string = 'https://example.com'): chrome.webNavigation.WebNavigationTransitionCallbackDetails {
  return {
    ...createNavigationDetails(tabId, frameId, url),
    transitionType: 'link',
    transitionQualifiers: [],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('NavigationManager', () => {
  let manager: NavigationManager;
  let config: BackgroundConfig;
  let mockWebNav: ReturnType<typeof createMockChromeWebNavigation>;
  let mockTabs: ReturnType<typeof createMockChromeTabs>;
  let mockInjectionCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    config = new BackgroundConfig();
    config.updateInjection({ navigationDelay: 50, reinjectOnNavigation: true });
    mockWebNav = createMockChromeWebNavigation();
    mockTabs = createMockChromeTabs();
    mockInjectionCallback = vi.fn().mockResolvedValue(true);
    
    manager = new NavigationManager(config, mockWebNav, mockTabs);
    manager.setInjectionCallback(mockInjectionCallback);
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.stop();
    vi.useRealTimers();
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should start listening', () => {
      manager.start();

      expect(manager.isActive()).toBe(true);
      expect(mockWebNav.onBeforeNavigate.addListener).toHaveBeenCalled();
      expect(mockWebNav.onCommitted.addListener).toHaveBeenCalled();
      expect(mockWebNav.onCompleted.addListener).toHaveBeenCalled();
    });

    it('should stop listening', () => {
      manager.start();
      manager.stop();

      expect(manager.isActive()).toBe(false);
      expect(mockWebNav.onBeforeNavigate.removeListener).toHaveBeenCalled();
    });

    it('should not start twice', () => {
      manager.start();
      manager.start();

      expect(mockWebNav.onCommitted.addListener).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // TAB TRACKING TESTS
  // ==========================================================================

  describe('tab tracking', () => {
    it('should track tabs', () => {
      manager.trackTab(1);
      manager.trackTab(2);

      expect(manager.isTracked(1)).toBe(true);
      expect(manager.isTracked(2)).toBe(true);
      expect(manager.isTracked(3)).toBe(false);
    });

    it('should untrack tabs', () => {
      manager.trackTab(1);
      manager.untrackTab(1);

      expect(manager.isTracked(1)).toBe(false);
    });

    it('should set tracked tabs', () => {
      manager.setTrackedTabs(new Set([1, 2, 3]));

      expect(manager.getTrackedTabs().size).toBe(3);
    });
  });

  // ==========================================================================
  // NAVIGATION EVENT TESTS
  // ==========================================================================

  describe('navigation events', () => {
    beforeEach(() => {
      manager.trackTab(1);
      manager.start();
    });

    it('should handle onBeforeNavigate for tracked tabs', () => {
      const events: NavigationEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockWebNav._triggerBeforeNavigate({
        ...createNavigationDetails(1),
        parentFrameId: -1,
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('before_navigate');
      expect(events[0].tabId).toBe(1);
    });

    it('should ignore events for non-tracked tabs', () => {
      const events: NavigationEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockWebNav._triggerCommitted(createCommittedDetails(999));

      expect(events).toHaveLength(0);
    });

    it('should handle onCommitted', () => {
      const events: NavigationEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockWebNav._triggerCommitted(createCommittedDetails(1));

      expect(events.some(e => e.type === 'committed')).toBe(true);
    });

    it('should handle onCompleted', () => {
      const events: NavigationEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockWebNav._triggerCompleted(createNavigationDetails(1));

      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    it('should handle onHistoryStateUpdated for SPA', () => {
      const events: NavigationEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockWebNav._triggerHistoryStateUpdated(createCommittedDetails(1));

      expect(events.some(e => e.type === 'history_state_updated')).toBe(true);
    });
  });

  // ==========================================================================
  // AUTO-REINJECTION TESTS
  // ==========================================================================

  describe('auto-reinjection', () => {
    beforeEach(() => {
      manager.trackTab(1);
      manager.start();
    });

    it('should schedule injection on committed', () => {
      mockWebNav._triggerCommitted(createCommittedDetails(1));

      expect(manager.hasPendingInjection(1)).toBe(true);
    });

    it('should inject after delay', async () => {
      mockWebNav._triggerCommitted(createCommittedDetails(1));

      await vi.advanceTimersByTimeAsync(100);

      expect(mockInjectionCallback).toHaveBeenCalledWith(1, true);
    });

    it('should debounce rapid navigations', async () => {
      mockWebNav._triggerCommitted(createCommittedDetails(1, 0, 'https://page1.com'));
      mockWebNav._triggerCommitted(createCommittedDetails(1, 0, 'https://page2.com'));
      mockWebNav._triggerCommitted(createCommittedDetails(1, 0, 'https://page3.com'));

      await vi.advanceTimersByTimeAsync(100);

      expect(mockInjectionCallback).toHaveBeenCalledTimes(1);
    });

    it('should track reinjection statistics', async () => {
      mockWebNav._triggerCommitted(createCommittedDetails(1));
      await vi.advanceTimersByTimeAsync(100);

      const stats = manager.getStats();
      expect(stats.reinjectionAttempts).toBe(1);
      expect(stats.reinjectionSuccesses).toBe(1);
    });

    it('should track failed reinjections', async () => {
      mockInjectionCallback.mockResolvedValue(false);
      mockWebNav._triggerCommitted(createCommittedDetails(1));
      await vi.advanceTimersByTimeAsync(100);

      const stats = manager.getStats();
      expect(stats.reinjectionFailures).toBe(1);
    });

    it('should handle injection errors', async () => {
      mockInjectionCallback.mockRejectedValue(new Error('Injection failed'));
      mockWebNav._triggerCommitted(createCommittedDetails(1));
      await vi.advanceTimersByTimeAsync(100);

      const stats = manager.getStats();
      expect(stats.reinjectionFailures).toBe(1);
    });

    it('should not inject if tab untracked while waiting', async () => {
      mockWebNav._triggerCommitted(createCommittedDetails(1));
      manager.untrackTab(1);
      await vi.advanceTimersByTimeAsync(100);

      expect(mockInjectionCallback).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // FORCE INJECTION TESTS
  // ==========================================================================

  describe('force injection', () => {
    beforeEach(() => {
      manager.trackTab(1);
      manager.start();
    });

    it('should force immediate injection', async () => {
      const result = await manager.forceInjection(1);

      expect(result).toBe(true);
      expect(mockInjectionCallback).toHaveBeenCalledWith(1, true);
    });

    it('should cancel pending injection', async () => {
      mockWebNav._triggerCommitted(createCommittedDetails(1));
      expect(manager.hasPendingInjection(1)).toBe(true);

      await manager.forceInjection(1);

      expect(manager.hasPendingInjection(1)).toBe(false);
    });
  });

  // ==========================================================================
  // TAB REMOVED TESTS
  // ==========================================================================

  describe('tab removed', () => {
    beforeEach(() => {
      manager.trackTab(1);
      manager.start();
    });

    it('should clean up on tab removed', () => {
      mockTabs._triggerRemoved(1, { isWindowClosing: false });

      expect(manager.isTracked(1)).toBe(false);
    });

    it('should call tab removed callback', () => {
      const callback = vi.fn();
      manager.setTabRemovedCallback(callback);

      mockTabs._triggerRemoved(1, { isWindowClosing: false });

      expect(callback).toHaveBeenCalledWith(1);
    });

    it('should emit tab_removed event', () => {
      const events: NavigationEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockTabs._triggerRemoved(1, { isWindowClosing: false });

      expect(events.some(e => e.type === 'tab_removed')).toBe(true);
    });

    it('should track tabs removed statistic', () => {
      mockTabs._triggerRemoved(1, { isWindowClosing: false });

      expect(manager.getStats().tabsRemoved).toBe(1);
    });
  });

  // ==========================================================================
  // STATE ACCESS TESTS
  // ==========================================================================

  describe('state access', () => {
    beforeEach(() => {
      manager.trackTab(1);
      manager.start();
    });

    it('should track navigation state', () => {
      mockWebNav._triggerBeforeNavigate({
        ...createNavigationDetails(1, 0, 'https://test.com'),
        parentFrameId: -1,
      });

      const state = manager.getNavigationState(1);

      expect(state?.url).toBe('https://test.com');
      expect(state?.status).toBe('navigating');
    });

    it('should update state on completion', () => {
      mockWebNav._triggerBeforeNavigate({
        ...createNavigationDetails(1),
        parentFrameId: -1,
      });
      mockWebNav._triggerCompleted(createNavigationDetails(1));

      const state = manager.getNavigationState(1);

      expect(state?.status).toBe('complete');
      expect(state?.completedAt).toBeDefined();
    });

    it('should clear all state', () => {
      mockWebNav._triggerBeforeNavigate({
        ...createNavigationDetails(1),
        parentFrameId: -1,
      });

      manager.clearAll();

      expect(manager.getTrackedTabs().size).toBe(0);
      expect(manager.getAllNavigationStates().size).toBe(0);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    beforeEach(() => {
      manager.trackTab(1);
      manager.start();
    });

    it('should track navigations detected', () => {
      mockWebNav._triggerBeforeNavigate({
        ...createNavigationDetails(1),
        parentFrameId: -1,
      });

      expect(manager.getStats().navigationsDetected).toBe(1);
    });

    it('should reset statistics', () => {
      mockWebNav._triggerBeforeNavigate({
        ...createNavigationDetails(1),
        parentFrameId: -1,
      });

      manager.resetStats();

      expect(manager.getStats().navigationsDetected).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createNavigationManager', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const manager = createNavigationManager(config, null, null);

    expect(manager).toBeInstanceOf(NavigationManager);
  });
});
