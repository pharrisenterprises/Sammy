/**
 * Tests for TabHandlers
 * @module background/handlers/TabHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TabHandlers,
  createTabHandlers,
  TAB_ACTIONS,
  type IChromeTabs,
  type IChromeScripting,
  type IChromeRuntime,
} from './TabHandlers';
import type { BackgroundMessage, MessageSender } from '../IBackgroundService';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockChromeTabs(): IChromeTabs {
  let nextTabId = 1;
  const tabs = new Map<number, chrome.tabs.Tab>();

  return {
    create: vi.fn(async (props) => {
      const tab: chrome.tabs.Tab = {
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
        status: 'complete',
      };
      tabs.set(tab.id!, tab);
      return tab;
    }),
    remove: vi.fn(async (tabId) => {
      tabs.delete(tabId);
    }),
    get: vi.fn(async (tabId) => {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Tab not found');
      return tab;
    }),
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => ({ success: true })),
    update: vi.fn(async (tabId, props) => {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Tab not found');
      const updated = { ...tab, ...props };
      tabs.set(tabId, updated);
      return updated;
    }),
  };
}

function createMockChromeScripting(): IChromeScripting {
  return {
    executeScript: vi.fn(async () => [{ result: undefined }]),
  };
}

function createMockChromeRuntime(): IChromeRuntime {
  return {
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
  };
}

function createMessage(action: string, payload?: unknown): BackgroundMessage {
  return { action, payload };
}

const mockSender: MessageSender = {};

// ============================================================================
// TESTS
// ============================================================================

describe('TabHandlers', () => {
  let handlers: TabHandlers;
  let mockTabs: IChromeTabs;
  let mockScripting: IChromeScripting;
  let mockRuntime: IChromeRuntime;

  beforeEach(() => {
    mockTabs = createMockChromeTabs();
    mockScripting = createMockChromeScripting();
    mockRuntime = createMockChromeRuntime();
    handlers = new TabHandlers(mockTabs, mockScripting, mockRuntime);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // OPEN TAB TESTS
  // ==========================================================================

  describe('handleOpenTab', () => {
    it('should open a new tab', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_TAB, {
        url: 'https://example.com',
      });

      const response = await handlers.handleOpenTab(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.tabId).toBe(1);
      expect(mockTabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        active: true,
      });
    });

    it('should inject content script by default', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_TAB, {
        url: 'https://example.com',
      });

      await handlers.handleOpenTab(message, mockSender);

      expect(mockScripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1, allFrames: true },
        files: ['js/main.js'],
      });
    });

    it('should skip injection when inject=false', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_TAB, {
        url: 'https://example.com',
        inject: false,
      });

      await handlers.handleOpenTab(message, mockSender);

      expect(mockScripting.executeScript).not.toHaveBeenCalled();
    });

    it('should track opened tab', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_TAB, {
        url: 'https://example.com',
        projectId: 123,
      });

      await handlers.handleOpenTab(message, mockSender);

      expect(handlers.getOpenedTabId()).toBe(1);
      expect(handlers.getTrackedTabs().get(1)).toEqual({
        projectId: 123,
        injected: true,
        url: 'https://example.com',
      });
    });

    it('should support legacy url field', async () => {
      const message = { action: TAB_ACTIONS.OPEN_TAB, url: 'https://legacy.com' } as any;

      const response = await handlers.handleOpenTab(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://legacy.com' })
      );
    });

    it('should fail without URL', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_TAB, {});

      const response = await handlers.handleOpenTab(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('URL');
    });
  });

  // ==========================================================================
  // CLOSE OPENED TAB TESTS
  // ==========================================================================

  describe('handleCloseOpenedTab', () => {
    beforeEach(async () => {
      // Open a tab first
      await handlers.handleOpenTab(
        createMessage(TAB_ACTIONS.OPEN_TAB, { url: 'https://example.com' }),
        mockSender
      );
    });

    it('should close the opened tab', async () => {
      const message = createMessage(TAB_ACTIONS.CLOSE_OPENED_TAB);

      const response = await handlers.handleCloseOpenedTab(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockTabs.remove).toHaveBeenCalledWith(1);
      expect(handlers.getOpenedTabId()).toBeNull();
    });

    it('should fail when no tab is opened', async () => {
      // Close the tab first
      await handlers.handleCloseOpenedTab(createMessage(TAB_ACTIONS.CLOSE_OPENED_TAB), mockSender);

      // Try to close again
      const response = await handlers.handleCloseOpenedTab(
        createMessage(TAB_ACTIONS.CLOSE_OPENED_TAB),
        mockSender
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('No opened tab');
    });
  });

  // ==========================================================================
  // CLOSE TAB TESTS
  // ==========================================================================

  describe('handleCloseTab', () => {
    it('should close specific tab', async () => {
      // Open a tab first
      await handlers.handleOpenTab(
        createMessage(TAB_ACTIONS.OPEN_TAB, { url: 'https://example.com' }),
        mockSender
      );

      const message = createMessage(TAB_ACTIONS.CLOSE_TAB, { tabId: 1 });

      const response = await handlers.handleCloseTab(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockTabs.remove).toHaveBeenCalledWith(1);
    });

    it('should fail without tabId', async () => {
      const message = createMessage(TAB_ACTIONS.CLOSE_TAB, {});

      const response = await handlers.handleCloseTab(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Tab ID');
    });
  });

  // ==========================================================================
  // OPEN PROJECT URL TESTS
  // ==========================================================================

  describe('handleOpenProjectUrlAndInject', () => {
    it('should open project URL and inject', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_PROJECT_URL_AND_INJECT, {
        url: 'https://project.com',
        projectId: 42,
      });

      const response = await handlers.handleOpenProjectUrlAndInject(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.tabId).toBe(1);
      expect(mockTabs.create).toHaveBeenCalled();
      expect(mockScripting.executeScript).toHaveBeenCalled();
    });

    it('should track with project ID', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_PROJECT_URL_AND_INJECT, {
        url: 'https://project.com',
        projectId: 42,
      });

      await handlers.handleOpenProjectUrlAndInject(message, mockSender);

      const tracked = handlers.getTrackedTabs().get(1);
      expect(tracked?.projectId).toBe(42);
    });

    it('should fail without URL', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_PROJECT_URL_AND_INJECT, {
        projectId: 42,
      });

      const response = await handlers.handleOpenProjectUrlAndInject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('URL');
    });

    it('should fail without projectId', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_PROJECT_URL_AND_INJECT, {
        url: 'https://project.com',
      });

      const response = await handlers.handleOpenProjectUrlAndInject(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Project ID');
    });
  });

  // ==========================================================================
  // OPEN DASHBOARD TESTS
  // ==========================================================================

  describe('handleOpenDashboard', () => {
    it('should open dashboard', async () => {
      const message = createMessage(TAB_ACTIONS.OPEN_DASHBOARD);

      const response = await handlers.handleOpenDashboard(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockTabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test-id/pages.html',
        active: true,
      });
    });

    it('should focus existing dashboard tab', async () => {
      const existingTab: chrome.tabs.Tab = { 
        id: 99, 
        index: 0, 
        pinned: false, 
        highlighted: true, 
        windowId: 1, 
        active: false, 
        incognito: false, 
        selected: false, 
        discarded: false, 
        autoDiscardable: true,
        url: 'chrome-extension://test-id/pages.html',
        status: 'complete',
      };
      vi.mocked(mockTabs.query).mockResolvedValue([existingTab]);
      // Mock update to not throw for non-existent tabs
      vi.mocked(mockTabs.update).mockResolvedValue({ ...existingTab, active: true });

      const message = createMessage(TAB_ACTIONS.OPEN_DASHBOARD);

      const response = await handlers.handleOpenDashboard(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.tabId).toBe(99);
      expect(mockTabs.update).toHaveBeenCalledWith(99, { active: true });
    });
  });

  // ==========================================================================
  // GET TAB STATUS TESTS
  // ==========================================================================

  describe('handleGetTabStatus', () => {
    beforeEach(async () => {
      await handlers.handleOpenTab(
        createMessage(TAB_ACTIONS.OPEN_TAB, { url: 'https://example.com', projectId: 5 }),
        mockSender
      );
    });

    it('should return opened tab status', async () => {
      const message = createMessage(TAB_ACTIONS.GET_TAB_STATUS, {});

      const response = await handlers.handleGetTabStatus(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.openedTabId).toBe(1);
      expect(response.data?.projectId).toBe(5);
    });

    it('should return specific tab status', async () => {
      const message = createMessage(TAB_ACTIONS.GET_TAB_STATUS, { tabId: 1 });

      const response = await handlers.handleGetTabStatus(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.tabId).toBe(1);
    });

    it('should return null when no tab opened', async () => {
      handlers.clearTracking();

      const message = createMessage(TAB_ACTIONS.GET_TAB_STATUS, {});

      const response = await handlers.handleGetTabStatus(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.openedTabId).toBeNull();
    });
  });

  // ==========================================================================
  // GET TRACKED TABS TESTS
  // ==========================================================================

  describe('handleGetTrackedTabs', () => {
    it('should return all tracked tabs', async () => {
      await handlers.handleOpenTab(
        createMessage(TAB_ACTIONS.OPEN_TAB, { url: 'https://example1.com' }),
        mockSender
      );
      await handlers.handleOpenTab(
        createMessage(TAB_ACTIONS.OPEN_TAB, { url: 'https://example2.com' }),
        mockSender
      );

      const message = createMessage(TAB_ACTIONS.GET_TRACKED_TABS);

      const response = await handlers.handleGetTrackedTabs(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.trackedTabs).toHaveLength(2);
    });
  });

  // ==========================================================================
  // SEND TO TAB TESTS
  // ==========================================================================

  describe('handleSendToTab', () => {
    it('should send message to tab', async () => {
      const message = createMessage(TAB_ACTIONS.SEND_TO_TAB, {
        tabId: 1,
        message: { type: 'runStep', data: {} },
      });

      const response = await handlers.handleSendToTab(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(1, { type: 'runStep', data: {} });
    });

    it('should fail without tabId', async () => {
      const message = createMessage(TAB_ACTIONS.SEND_TO_TAB, {
        message: { type: 'test' },
      });

      const response = await handlers.handleSendToTab(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Tab ID');
    });
  });

  // ==========================================================================
  // INJECT INTO TAB TESTS
  // ==========================================================================

  describe('handleInjectIntoTab', () => {
    it('should inject into specific tab', async () => {
      const message = createMessage(TAB_ACTIONS.INJECT_INTO_TAB, { tabId: 5 });

      const response = await handlers.handleInjectIntoTab(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockScripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 5, allFrames: true },
        files: ['js/main.js'],
      });
    });

    it('should fail without tabId', async () => {
      const message = createMessage(TAB_ACTIONS.INJECT_INTO_TAB, {});

      const response = await handlers.handleInjectIntoTab(message, mockSender);

      expect(response.success).toBe(false);
    });
  });

  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================

  describe('registration', () => {
    it('should return all handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(9);
      expect(entries.every(e => e.category === 'tab')).toBe(true);
    });
  });

  // ==========================================================================
  // STATE MANAGEMENT TESTS
  // ==========================================================================

  describe('state management', () => {
    it('should track and untrack tabs', () => {
      handlers.trackTab(10, { injected: true, url: 'https://test.com' });
      expect(handlers.getTrackedTabs().has(10)).toBe(true);

      handlers.untrackTab(10);
      expect(handlers.getTrackedTabs().has(10)).toBe(false);
    });

    it('should clear all tracking', async () => {
      await handlers.handleOpenTab(
        createMessage(TAB_ACTIONS.OPEN_TAB, { url: 'https://example.com' }),
        mockSender
      );

      handlers.clearTracking();

      expect(handlers.getOpenedTabId()).toBeNull();
      expect(handlers.getTrackedTabs().size).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createTabHandlers', () => {
  it('should create instance with mocks', () => {
    const mockTabs = createMockChromeTabs();
    const mockScripting = createMockChromeScripting();
    const mockRuntime = createMockChromeRuntime();

    const handlers = createTabHandlers(mockTabs, mockScripting, mockRuntime);

    expect(handlers).toBeInstanceOf(TabHandlers);
  });
});
