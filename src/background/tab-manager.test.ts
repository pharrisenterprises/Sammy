/**
 * @fileoverview Tests for tab manager
 * @module background/tab-manager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TabManager,
  getTabManager,
  initializeTabManager,
  resetTabManager,
  DEFAULT_TAB_MANAGER_CONFIG
} from './tab-manager';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    onCreated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
    query: vi.fn().mockResolvedValue([
      { id: 1, url: 'https://example.com', title: 'Example', windowId: 1 },
      { id: 2, url: 'https://test.com', title: 'Test', windowId: 1 }
    ]),
    get: vi.fn().mockResolvedValue({
      id: 1,
      url: 'https://example.com',
      title: 'Example',
      windowId: 1
    }),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: 3, url: 'https://new.com' })
  },
  windows: {
    update: vi.fn().mockResolvedValue({})
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([]),
    insertCSS: vi.fn().mockResolvedValue([])
  },
  runtime: {
    onMessage: { addListener: vi.fn() }
  },
  webNavigation: {
    getAllFrames: vi.fn().mockResolvedValue([
      { frameId: 0, url: 'https://example.com', parentFrameId: -1 },
      { frameId: 1, url: 'https://iframe.com', parentFrameId: 0 }
    ])
  }
};

vi.stubGlobal('chrome', mockChrome);

describe('TabManager', () => {
  let manager: TabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetTabManager();
    manager = new TabManager({ debug: false });
  });

  afterEach(() => {
    manager.destroy();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default config', () => {
      expect(DEFAULT_TAB_MANAGER_CONFIG.contentScriptPath).toBe('content/content.js');
      expect(DEFAULT_TAB_MANAGER_CONFIG.maxInjectionAttempts).toBe(3);
      expect(DEFAULT_TAB_MANAGER_CONFIG.autoInjectOnNavigation).toBe(true);
    });

    it('should have blocked URL patterns', () => {
      expect(DEFAULT_TAB_MANAGER_CONFIG.blockedUrlPatterns.length).toBeGreaterThan(0);
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

    it('should set up event listeners', async () => {
      await manager.initialize();

      expect(mockChrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onActivated.addListener).toHaveBeenCalled();
    });

    it('should query existing tabs', async () => {
      await manager.initialize();

      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(manager.getTabCount()).toBe(2);
    });

    it('should not initialize twice', async () => {
      await manager.initialize();
      await manager.initialize();

      expect(mockChrome.tabs.query).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // TAB TRACKING
  // ==========================================================================

  describe('Tab Tracking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get tracked tab', () => {
      const tab = manager.getTab(1);

      expect(tab).toBeDefined();
      expect(tab?.id).toBe(1);
      expect(tab?.url).toBe('https://example.com');
    });

    it('should return undefined for unknown tab', () => {
      const tab = manager.getTab(999);
      expect(tab).toBeUndefined();
    });

    it('should get all tabs', () => {
      const tabs = manager.getAllTabs();
      expect(tabs.length).toBe(2);
    });

    it('should get ready tabs', () => {
      const tabs = manager.getReadyTabs();
      expect(tabs.length).toBe(0); // None ready initially
    });

    it('should check if tab is ready', () => {
      expect(manager.isTabReady(1)).toBe(false);
    });

    it('should get tab count', () => {
      expect(manager.getTabCount()).toBe(2);
    });
  });

  // ==========================================================================
  // CONTENT SCRIPT INJECTION
  // ==========================================================================

  describe('Content Script Injection', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should inject content script', async () => {
      const result = await manager.injectContentScript(1);

      expect(result.success).toBe(true);
      expect(result.tabId).toBe(1);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
    });

    it('should not inject into chrome:// URLs', async () => {
      mockChrome.tabs.get.mockResolvedValueOnce({
        id: 3,
        url: 'chrome://extensions',
        title: 'Extensions',
        windowId: 1
      });

      const result = await manager.injectContentScript(3);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should track injection attempts', async () => {
      mockChrome.scripting.executeScript.mockRejectedValueOnce(new Error('Failed'));
      mockChrome.scripting.executeScript.mockRejectedValueOnce(new Error('Failed'));
      mockChrome.scripting.executeScript.mockRejectedValueOnce(new Error('Failed'));

      await manager.injectContentScript(1);
      await manager.injectContentScript(1);
      await manager.injectContentScript(1);
      const result = await manager.injectContentScript(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Max injection attempts');
    });

    it('should force inject even if ready', async () => {
      // Simulate already ready
      const tab = manager.getTab(1);
      if (tab) {
        tab.isReady = true;
      }

      await manager.injectContentScript(1, { force: true });

      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
    });

    it('should inject into all frames', async () => {
      const results = await manager.injectIntoAllFrames(1);

      expect(results.length).toBe(2); // Main frame + 1 iframe
    });
  });

  // ==========================================================================
  // TAB COMMUNICATION
  // ==========================================================================

  describe('Tab Communication', () => {
    beforeEach(async () => {
      await manager.initialize();
      // Mark tab as ready
      const tab = manager.getTab(1);
      if (tab) {
        tab.isReady = true;
      }
    });

    it('should send message to tab', async () => {
      await manager.sendToTab(1, { action: 'test' }, {
        ensureInjected: false
      });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { action: 'test' }
      );
    });

    it('should broadcast to all ready tabs', async () => {
      const results = await manager.broadcastToTabs({ action: 'broadcast' });

      expect(results.size).toBe(1); // Only 1 tab is ready
    });
  });

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should emit events to listeners', () => {
      const listener = vi.fn();
      manager.on(listener);

      // Simulate tab created event
      const onCreatedCallback = mockChrome.tabs.onCreated.addListener.mock.calls[0][0];
      onCreatedCallback({ id: 3, url: 'https://new.com', windowId: 1 });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'created',
          tabId: 3
        })
      );
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      const unsubscribe = manager.on(listener);

      unsubscribe();

      // Simulate event after unsubscribe
      const onCreatedCallback = mockChrome.tabs.onCreated.addListener.mock.calls[0][0];
      onCreatedCallback({ id: 3, url: 'https://new.com', windowId: 1 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  describe('Utilities', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get active tab', async () => {
      mockChrome.tabs.query.mockResolvedValueOnce([
        { id: 1, url: 'https://example.com' }
      ]);

      const tab = await manager.getActiveTab();

      expect(tab?.id).toBe(1);
    });

    it('should get active tab ID', async () => {
      mockChrome.tabs.query.mockResolvedValueOnce([
        { id: 1, url: 'https://example.com' }
      ]);

      const tabId = await manager.getActiveTabId();

      expect(tabId).toBe(1);
    });

    it('should focus tab', async () => {
      const result = await manager.focusTab(1);

      expect(result).toBe(true);
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
      expect(mockChrome.windows.update).toHaveBeenCalled();
    });

    it('should create new tab', async () => {
      await manager.createTab('https://new.com');

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://new.com',
        active: true
      });
    });
  });

  // ==========================================================================
  // SINGLETON
  // ==========================================================================

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getTabManager();
      const instance2 = getTabManager();

      expect(instance1).toBe(instance2);
    });

    it('should initialize singleton', async () => {
      const instance = await initializeTabManager();
      expect(instance.isInitialized()).toBe(true);
    });

    it('should reset singleton', () => {
      getTabManager();
      resetTabManager();

      const newInstance = getTabManager();
      expect(newInstance.isInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  describe('Cleanup', () => {
    it('should destroy manager', async () => {
      await manager.initialize();
      manager.destroy();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getTabCount()).toBe(0);
    });
  });
});
