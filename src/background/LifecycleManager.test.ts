/**
 * Tests for LifecycleManager
 * @module background/LifecycleManager.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LifecycleManager,
  createLifecycleManager,
  DASHBOARD_PATHS,
  type IChromeRuntime,
  type IChromeAction,
  type IChromeTabs,
  type INavigatorStorage,
  type LifecycleEvent,
} from './LifecycleManager';
import { BackgroundConfig } from './BackgroundConfig';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockChromeRuntime(): IChromeRuntime & {
  _triggerInstalled: (details: chrome.runtime.InstalledDetails) => void;
  _triggerStartup: () => void;
  _triggerSuspend: () => void;
  _triggerSuspendCanceled: () => void;
} {
  const installedListeners: Array<(details: chrome.runtime.InstalledDetails) => void> = [];
  const startupListeners: Array<() => void> = [];
  const suspendListeners: Array<() => void> = [];
  const suspendCanceledListeners: Array<() => void> = [];

  return {
    onInstalled: {
      addListener: vi.fn((cb) => installedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = installedListeners.indexOf(cb);
        if (idx >= 0) installedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => installedListeners.includes(cb)),
    },
    onStartup: {
      addListener: vi.fn((cb) => startupListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = startupListeners.indexOf(cb);
        if (idx >= 0) startupListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => startupListeners.includes(cb)),
    },
    onSuspend: {
      addListener: vi.fn((cb) => suspendListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = suspendListeners.indexOf(cb);
        if (idx >= 0) suspendListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => suspendListeners.includes(cb)),
    },
    onSuspendCanceled: {
      addListener: vi.fn((cb) => suspendCanceledListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = suspendCanceledListeners.indexOf(cb);
        if (idx >= 0) suspendCanceledListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => suspendCanceledListeners.includes(cb)),
    },
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
    getManifest: vi.fn(() => ({
      manifest_version: 3,
      name: 'Test Extension',
      version: '1.0.0',
    })),
    _triggerInstalled: (details) => installedListeners.forEach(cb => cb(details)),
    _triggerStartup: () => startupListeners.forEach(cb => cb()),
    _triggerSuspend: () => suspendListeners.forEach(cb => cb()),
    _triggerSuspendCanceled: () => suspendCanceledListeners.forEach(cb => cb()),
  };
}

function createMockChromeAction(): IChromeAction & {
  _triggerClicked: (tab: chrome.tabs.Tab) => void;
} {
  const clickedListeners: Array<(tab: chrome.tabs.Tab) => void> = [];

  return {
    onClicked: {
      addListener: vi.fn((cb) => clickedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = clickedListeners.indexOf(cb);
        if (idx >= 0) clickedListeners.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => clickedListeners.includes(cb)),
    },
    _triggerClicked: (tab) => clickedListeners.forEach(cb => cb(tab)),
  };
}

function createMockChromeTabs(): IChromeTabs {
  let nextTabId = 1;

  return {
    create: vi.fn(async (props) => ({
      id: nextTabId++,
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: props.active ?? true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      url: props.url,
    })),
    query: vi.fn(async () => []),
    update: vi.fn(async (tabId, props) => ({
      id: tabId,
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: props.active ?? true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
    })),
  };
}

function createMockNavigatorStorage(persisted: boolean = false): INavigatorStorage {
  let isPersisted = persisted;

  return {
    persist: vi.fn(async () => {
      isPersisted = true;
      return true;
    }),
    persisted: vi.fn(async () => isPersisted),
    estimate: vi.fn(async () => ({
      quota: 100000000,
      usage: 5000000,
    })),
  };
}

function createMockTab(id: number = 1): chrome.tabs.Tab {
  return {
    id,
    index: 0,
    pinned: false,
    highlighted: true,
    windowId: 1,
    active: true,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('LifecycleManager', () => {
  let manager: LifecycleManager;
  let config: BackgroundConfig;
  let mockRuntime: ReturnType<typeof createMockChromeRuntime>;
  let mockAction: ReturnType<typeof createMockChromeAction>;
  let mockTabs: IChromeTabs;
  let mockStorage: INavigatorStorage;

  beforeEach(() => {
    config = new BackgroundConfig();
    mockRuntime = createMockChromeRuntime();
    mockAction = createMockChromeAction();
    mockTabs = createMockChromeTabs();
    mockStorage = createMockNavigatorStorage();
    
    manager = new LifecycleManager(
      config,
      mockRuntime,
      mockAction,
      mockTabs,
      mockStorage
    );
    
    vi.clearAllMocks();
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should start listening', async () => {
      await manager.start();

      expect(manager.isActive()).toBe(true);
      expect(manager.hasInitialized()).toBe(true);
      expect(mockRuntime.onInstalled.addListener).toHaveBeenCalled();
      expect(mockRuntime.onStartup.addListener).toHaveBeenCalled();
      expect(mockAction.onClicked.addListener).toHaveBeenCalled();
    });

    it('should stop listening', async () => {
      await manager.start();
      manager.stop();

      expect(manager.isActive()).toBe(false);
      expect(mockRuntime.onInstalled.removeListener).toHaveBeenCalled();
    });

    it('should emit initialized event', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      await manager.start();

      expect(events.some(e => e.type === 'initialized')).toBe(true);
    });

    it('should emit shutdown event', async () => {
      await manager.start();
      
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));
      
      manager.stop();

      expect(events.some(e => e.type === 'shutdown')).toBe(true);
    });
  });

  // ==========================================================================
  // INSTALL TESTS
  // ==========================================================================

  describe('onInstalled', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should handle fresh install', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockRuntime._triggerInstalled({ reason: 'install' });

      expect(events.some(e => e.type === 'installed')).toBe(true);
      expect(manager.isFreshInstall()).toBe(true);
    });

    it('should open dashboard on fresh install', async () => {
      mockRuntime._triggerInstalled({ reason: 'install' });

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('pages.html#dashboard'),
        })
      );
    });

    it('should handle update', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockRuntime._triggerInstalled({ reason: 'update', previousVersion: '0.9.0' });

      expect(events.some(e => e.type === 'updated')).toBe(true);
      expect(manager.isUpdate()).toBe(true);
      expect(manager.getPreviousVersion()).toBe('0.9.0');
    });

    it('should handle chrome update', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockRuntime._triggerInstalled({ reason: 'chrome_update' });

      expect(events.some(e => e.type === 'chrome_updated')).toBe(true);
    });

    it('should call custom install handlers', async () => {
      const handler = vi.fn();
      manager.onInstall(handler);

      mockRuntime._triggerInstalled({ reason: 'install' });

      expect(handler).toHaveBeenCalledWith({ reason: 'install' });
    });

    it('should track install statistics', async () => {
      mockRuntime._triggerInstalled({ reason: 'install' });

      expect(manager.getStats().installs).toBe(1);
    });
  });

  // ==========================================================================
  // STARTUP TESTS
  // ==========================================================================

  describe('onStartup', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should handle startup', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockRuntime._triggerStartup();

      expect(events.some(e => e.type === 'startup')).toBe(true);
    });

    it('should call custom startup handlers', async () => {
      const handler = vi.fn();
      manager.onStartup(handler);

      mockRuntime._triggerStartup();

      expect(handler).toHaveBeenCalled();
    });

    it('should track startup statistics', async () => {
      mockRuntime._triggerStartup();

      expect(manager.getStats().startups).toBe(1);
    });
  });

  // ==========================================================================
  // SUSPEND TESTS
  // ==========================================================================

  describe('onSuspend', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should handle suspend', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockRuntime._triggerSuspend();

      expect(events.some(e => e.type === 'suspend')).toBe(true);
    });

    it('should handle suspend canceled', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockRuntime._triggerSuspendCanceled();

      expect(events.some(e => e.type === 'suspend_canceled')).toBe(true);
    });

    it('should track suspend statistics', async () => {
      mockRuntime._triggerSuspend();

      expect(manager.getStats().suspends).toBe(1);
    });
  });

  // ==========================================================================
  // ICON CLICK TESTS
  // ==========================================================================

  describe('onIconClicked', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should handle icon click', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockAction._triggerClicked(createMockTab(123));

      expect(events.some(e => e.type === 'icon_clicked')).toBe(true);
    });

    it('should open dashboard by default', async () => {
      mockAction._triggerClicked(createMockTab());

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('pages.html'),
        })
      );
    });

    it('should call custom icon click handlers', async () => {
      const handler = vi.fn();
      manager.onIconClick(handler);

      const tab = createMockTab(456);
      mockAction._triggerClicked(tab);

      expect(handler).toHaveBeenCalledWith(tab);
    });

    it('should skip default behavior if custom handlers exist', async () => {
      manager.onIconClick(vi.fn());

      mockAction._triggerClicked(createMockTab());

      expect(mockTabs.create).not.toHaveBeenCalled();
    });

    it('should track icon click statistics', async () => {
      mockAction._triggerClicked(createMockTab());

      expect(manager.getStats().iconClicks).toBe(1);
    });
  });

  // ==========================================================================
  // PERSISTENT STORAGE TESTS
  // ==========================================================================

  describe('persistent storage', () => {
    it('should request persistent storage on start', async () => {
      await manager.start();

      expect(mockStorage.persist).toHaveBeenCalled();
    });

    it('should emit storage_persisted event', async () => {
      const events: LifecycleEvent[] = [];
      manager.onEvent(e => events.push(e));

      await manager.start();

      expect(events.some(e => e.type === 'storage_persisted')).toBe(true);
    });

    it('should check if storage is persisted', async () => {
      await manager.start();

      expect(manager.isStoragePersisted()).toBe(true);
    });

    it('should get storage status', async () => {
      await manager.start();

      const status = await manager.getStorageStatus();

      expect(status.persisted).toBe(true);
      expect(status.quota).toBeDefined();
      expect(status.usage).toBeDefined();
      expect(status.percentUsed).toBeDefined();
    });
  });

  // ==========================================================================
  // DASHBOARD TESTS
  // ==========================================================================

  describe('dashboard', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should open dashboard', async () => {
      const tabId = await manager.openDashboard();

      expect(mockTabs.create).toHaveBeenCalled();
      expect(tabId).toBeDefined();
    });

    it('should focus existing dashboard tab', async () => {
      vi.mocked(mockTabs.query).mockResolvedValue([
        { id: 99, index: 0, pinned: false, highlighted: true, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true },
      ]);

      const tabId = await manager.openDashboard();

      expect(mockTabs.update).toHaveBeenCalledWith(99, { active: true });
      expect(tabId).toBe(99);
    });

    it('should get extension URL', () => {
      const url = manager.getExtensionURL('test.html');

      expect(url).toBe('chrome-extension://test-id/test.html');
    });
  });

  // ==========================================================================
  // MANIFEST TESTS
  // ==========================================================================

  describe('manifest', () => {
    it('should get manifest', () => {
      const manifest = manager.getManifest();

      expect(manifest).toBeDefined();
      expect(manifest?.version).toBe('1.0.0');
    });

    it('should get version', () => {
      const version = manager.getVersion();

      expect(version).toBe('1.0.0');
    });
  });

  // ==========================================================================
  // HANDLER UNSUBSCRIPTION TESTS
  // ==========================================================================

  describe('handler unsubscription', () => {
    beforeEach(async () => {
      await manager.start();
    });

    it('should unsubscribe install handler', async () => {
      const handler = vi.fn();
      const unsubscribe = manager.onInstall(handler);

      unsubscribe();
      mockRuntime._triggerInstalled({ reason: 'install' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should unsubscribe startup handler', async () => {
      const handler = vi.fn();
      const unsubscribe = manager.onStartup(handler);

      unsubscribe();
      mockRuntime._triggerStartup();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should unsubscribe icon click handler', async () => {
      const handler = vi.fn();
      const unsubscribe = manager.onIconClick(handler);

      unsubscribe();
      mockAction._triggerClicked(createMockTab());

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    it('should reset statistics', async () => {
      await manager.start();
      mockRuntime._triggerInstalled({ reason: 'install' });

      manager.resetStats();

      expect(manager.getStats().installs).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createLifecycleManager', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const manager = createLifecycleManager(config);

    expect(manager).toBeInstanceOf(LifecycleManager);
  });
});
