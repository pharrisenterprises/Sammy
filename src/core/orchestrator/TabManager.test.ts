/**
 * Tests for TabManager
 * @module core/orchestrator/TabManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TabManager,
  createTabManager,
  waitForTabReady,
  openTabAndWait,
  DEFAULT_TAB_MANAGER_CONFIG,
  type TrackedTab,
  type TabOpenOptions,
  type TabStatus,
} from './TabManager';

// ============================================================================
// CHROME API MOCKS
// ============================================================================

const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    lastError: null as { message: string } | null,
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  webNavigation: {
    onCompleted: {
      addListener: vi.fn(),
    },
    onCommitted: {
      addListener: vi.fn(),
    },
  },
};

// Setup global chrome mock
beforeEach(() => {
  (global as any).chrome = mockChrome;
  mockChrome.runtime.lastError = null;
  vi.clearAllMocks();
  
  // Default mock handlers for all actions
  mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
    // Default fallback: return success for any action
    callback({ success: true, tabId: Date.now() });
  });
});

afterEach(() => {
  delete (global as any).chrome;
});

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('TabManager', () => {
  let manager: TabManager;

  beforeEach(() => {
    manager = new TabManager();
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = manager.getConfig();
      expect(config.defaultTimeout).toBe(DEFAULT_TAB_MANAGER_CONFIG.defaultTimeout);
      expect(config.autoInject).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new TabManager({ defaultTimeout: 5000 });
      expect(custom.getConfig().defaultTimeout).toBe(5000);
    });

    it('should start with no tabs', () => {
      expect(manager.getTabCount()).toBe(0);
      expect(manager.hasOpenTabs()).toBe(false);
    });
  });

  // ==========================================================================
  // TAB OPENING TESTS
  // ==========================================================================

  describe('openTab', () => {
    beforeEach(() => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });
    });

    it('should open a tab successfully', async () => {
      const result = await manager.openTab({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.tabId).toBe(12345);
      expect(result.duration).toBeDefined();
    });

    it('should track opened tab', async () => {
      await manager.openTab({ url: 'https://example.com' });

      expect(manager.getTabCount()).toBe(1);
      expect(manager.isTracked(12345)).toBe(true);
    });

    it('should set active tab', async () => {
      await manager.openTab({ url: 'https://example.com' });

      expect(manager.getActiveTabId()).toBe(12345);
    });

    it('should store tab URL', async () => {
      await manager.openTab({ url: 'https://example.com' });

      const tab = manager.getTab(12345);
      expect(tab?.url).toBe('https://example.com');
    });

    it('should store custom label', async () => {
      await manager.openTab({ url: 'https://example.com', label: 'Test Tab' });

      const tab = manager.getTab(12345);
      expect(tab?.label).toBe('Test Tab');
    });

    it('should mark script as injected when autoInject is true', async () => {
      await manager.openTab({ url: 'https://example.com' });

      const tab = manager.getTab(12345);
      expect(tab?.scriptInjected).toBe(true);
    });

    it('should respect injectScript option', async () => {
      await manager.openTab({ url: 'https://example.com', injectScript: false });

      const tab = manager.getTab(12345);
      expect(tab?.scriptInjected).toBe(false);
    });

    it('should handle open failure', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: false, error: 'Tab creation failed' });
      });

      const result = await manager.openTab({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab creation failed');
    });

    it('should enforce max concurrent tabs', async () => {
      const limitedManager = new TabManager({ maxConcurrentTabs: 2 });
      
      let tabCounter = 1;
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: tabCounter++ });
      });

      await limitedManager.openTab({ url: 'https://example1.com' });
      await limitedManager.openTab({ url: 'https://example2.com' });
      const result = await limitedManager.openTab({ url: 'https://example3.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum concurrent tabs');
    });

    it('should emit tab_created event', async () => {
      const listener = vi.fn();
      manager.onEvent(listener);

      await manager.openTab({ url: 'https://example.com' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tab_created',
          tabId: 12345,
          url: 'https://example.com',
        })
      );
    });
  });

  // ==========================================================================
  // TAB CLOSING TESTS
  // ==========================================================================

  describe('closeTab', () => {
    beforeEach(async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'openTab') {
          callback({ success: true, tabId: 12345 });
        } else if (msg.action === 'closeTab') {
          callback({ success: true });
        }
      });

      await manager.openTab({ url: 'https://example.com' });
    });

    it('should close a tab', async () => {
      const result = await manager.closeTab(12345);

      expect(result.success).toBe(true);
    });

    it('should remove tab from tracking', async () => {
      await manager.closeTab(12345);

      expect(manager.isTracked(12345)).toBe(false);
      expect(manager.getTabCount()).toBe(0);
    });

    it('should clear active tab if closing active', async () => {
      await manager.closeTab(12345);

      expect(manager.getActiveTabId()).toBeNull();
    });

    it('should close active tab by default', async () => {
      const result = await manager.closeActiveTab();

      expect(result.success).toBe(true);
      expect(manager.getActiveTabId()).toBeNull();
    });

    it('should emit tab_closed event', async () => {
      const listener = vi.fn();
      manager.onEvent(listener);

      await manager.closeTab(12345);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tab_closed',
          tabId: 12345,
        })
      );
    });

    it('should handle close failure', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'closeTab') {
          callback({ success: false, error: 'Tab not found' });
        }
      });

      const result = await manager.closeTab(99999);

      expect(result.success).toBe(false);
    });
  });

  describe('closeAllTabs', () => {
    beforeEach(async () => {
      let tabCounter = 1;
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'openTab') {
          callback({ success: true, tabId: tabCounter++ });
        } else if (msg.action === 'closeTab') {
          callback({ success: true });
        }
      });

      await manager.openTab({ url: 'https://example1.com' });
      await manager.openTab({ url: 'https://example2.com' });
      await manager.openTab({ url: 'https://example3.com' });
    });

    it('should close all tabs', async () => {
      const result = await manager.closeAllTabs();

      expect(result.closed).toBe(3);
      expect(result.failed).toBe(0);
      expect(manager.getTabCount()).toBe(0);
    });
  });

  // ==========================================================================
  // SCRIPT INJECTION TESTS
  // ==========================================================================

  describe('injectScript', () => {
    let injectManager: TabManager;

    beforeEach(async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'openTab') {
          callback({ success: true, tabId: 12345 });
        } else if (msg.action === 'injectScript') {
          callback({ success: true });
        } else if (msg.action === 'closeTab') {
          callback({ success: true });
        }
      });

      injectManager = new TabManager();
      await injectManager.openTab({ url: 'https://example.com', injectScript: false });
    });

    afterEach(async () => {
      await injectManager.dispose();
    });

    it('should inject script', async () => {
      const result = await injectManager.injectScript(12345);

      expect(result.success).toBe(true);
      expect(result.tabId).toBe(12345);
    });

    it('should update tab state after injection', async () => {
      await injectManager.injectScript(12345);

      const tab = injectManager.getTab(12345);
      expect(tab?.scriptInjected).toBe(true);
      expect(tab?.status).toBe('ready');
    });

    it('should emit script_injected event', async () => {
      const listener = vi.fn();
      injectManager.onEvent(listener);

      await injectManager.injectScript(12345);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'script_injected',
          tabId: 12345,
        })
      );
    });
  });

  describe('reinjectAll', () => {
    let reinjectManager: TabManager;

    beforeEach(async () => {
      let tabCounter = 1;
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'openTab') {
          callback({ success: true, tabId: tabCounter++ });
        } else if (msg.action === 'injectScript') {
          callback({ success: true });
        } else if (msg.action === 'closeTab') {
          callback({ success: true });
        }
      });

      reinjectManager = new TabManager();
      await reinjectManager.openTab({ url: 'https://example1.com' });
      await reinjectManager.openTab({ url: 'https://example2.com' });
    });

    afterEach(async () => {
      await reinjectManager.dispose();
    });

    it('should reinject all tabs', async () => {
      const result = await reinjectManager.reinjectAll();

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  // ==========================================================================
  // TAB COMMUNICATION TESTS
  // ==========================================================================

  describe('sendMessage', () => {
    beforeEach(async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });

      await manager.openTab({ url: 'https://example.com' });
    });

    it('should send message to tab', async () => {
      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
        callback({ received: true });
      });

      const response = await manager.sendMessage(12345, { type: 'test' });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        12345,
        { type: 'test' },
        expect.any(Function)
      );
      expect(response).toEqual({ received: true });
    });

    it('should send to active tab', async () => {
      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
        callback({ received: true });
      });

      const response = await manager.sendToActiveTab({ type: 'test' });

      expect(response).toEqual({ received: true });
    });

    it('should throw if no active tab', async () => {
      manager.reset();

      await expect(manager.sendToActiveTab({ type: 'test' }))
        .rejects.toThrow('No active tab');
    });
  });

  // ==========================================================================
  // TAB STATE QUERIES TESTS
  // ==========================================================================

  describe('state queries', () => {
    beforeEach(async () => {
      let tabCounter = 1;
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: tabCounter++ });
      });

      await manager.openTab({ url: 'https://example1.com', label: 'Tab 1' });
      await manager.openTab({ url: 'https://example2.com', label: 'Tab 2' });
    });

    it('should get tab by ID', () => {
      const tab = manager.getTab(1);
      expect(tab?.url).toBe('https://example1.com');
    });

    it('should get all tabs', () => {
      const tabs = manager.getAllTabs();
      expect(tabs.length).toBe(2);
    });

    it('should get open tabs', () => {
      const tabs = manager.getOpenTabs();
      expect(tabs.length).toBe(2);
    });

    it('should check if ready', () => {
      expect(manager.isReady(1)).toBe(true);
    });

    it('should set active tab', () => {
      manager.setActiveTab(1);
      expect(manager.getActiveTabId()).toBe(1);
    });

    it('should return false for invalid active tab', () => {
      const result = manager.setActiveTab(99999);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // EVENT HANDLING TESTS
  // ==========================================================================

  describe('event handling', () => {
    it('should add and remove listeners', async () => {
      const listener = vi.fn();
      const unsubscribe = manager.onEvent(listener);

      // Need to create a tracked tab first
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 1 });
      });
      await manager.openTab({ url: 'https://example.com' });
      listener.mockClear();

      manager.handleNavigation(1, 'https://new-url.com');
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      listener.mockClear();
      
      manager.handleNavigation(1, 'https://another-url.com');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const badListener = vi.fn(() => { throw new Error('Listener error'); });
      const goodListener = vi.fn();

      manager.onEvent(badListener);
      manager.onEvent(goodListener);

      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });

      await manager.openTab({ url: 'https://example.com' });

      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // NAVIGATION HANDLING TESTS
  // ==========================================================================

  describe('navigation handling', () => {
    let navManager: TabManager;

    beforeEach(async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'openTab') {  
          callback({ success: true, tabId: 12345 });
        } else if (msg.action === 'injectScript') {
          callback({ success: true });
        } else if (msg.action === 'closeTab') {
          callback({ success: true });
        }
      });

      // Create separate manager without auto re-injection
      navManager = new TabManager({ reinjectOnNavigation: false });
      await navManager.openTab({ url: 'https://example.com' });
    });

    afterEach(async () => {
      await navManager.dispose();
    });

    it('should update URL on navigation', () => {
      navManager.handleNavigation(12345, 'https://new-page.com');

      const tab = navManager.getTab(12345);
      expect(tab?.url).toBe('https://new-page.com');
    });

    it('should emit tab_navigated event', () => {
      const listener = vi.fn();
      navManager.onEvent(listener);

      navManager.handleNavigation(12345, 'https://new-page.com');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tab_navigated',
          tabId: 12345,
          url: 'https://new-page.com',
        })
      );
    });
  });

  // ==========================================================================
  // LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle', () => {
    it('should reset state', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });

      await manager.openTab({ url: 'https://example.com' });
      manager.reset();

      expect(manager.getTabCount()).toBe(0);
      expect(manager.getActiveTabId()).toBeNull();
    });

    it('should dispose and close all tabs', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });

      await manager.openTab({ url: 'https://example.com' });
      await manager.dispose();

      expect(manager.getTabCount()).toBe(0);
    });

    it('should update config', () => {
      manager.updateConfig({ defaultTimeout: 5000 });
      expect(manager.getConfig().defaultTimeout).toBe(5000);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  describe('createTabManager', () => {
    it('should create instance with factory', () => {
      const manager = createTabManager({ maxConcurrentTabs: 10 });
      expect(manager).toBeInstanceOf(TabManager);
      expect(manager.getConfig().maxConcurrentTabs).toBe(10);
    });
  });

  describe('waitForTabReady', () => {
    it('should resolve when tab is ready', async () => {
      const manager = new TabManager();
      
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });

      await manager.openTab({ url: 'https://example.com' });
      
      const ready = await waitForTabReady(manager, 12345, 1000);
      expect(ready).toBe(true);
    });

    it('should timeout if tab not ready', async () => {
      const manager = new TabManager();
      
      // Tab doesn't exist, so won't be ready
      const ready = await waitForTabReady(manager, 99999, 500);
      expect(ready).toBe(false);
    });
  });

  describe('openTabAndWait', () => {
    it('should open and wait for ready', async () => {
      const manager = new TabManager();
      
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, tabId: 12345 });
      });

      const result = await openTabAndWait(manager, { url: 'https://example.com' });
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(12345);
    });
  });
});
