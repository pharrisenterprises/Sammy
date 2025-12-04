/**
 * Tests for InjectionHandlers
 * @module background/handlers/InjectionHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InjectionHandlers,
  createInjectionHandlers,
  INJECTION_ACTIONS,
  DEFAULT_SCRIPTS,
  type IChromeScripting,
  type IChromeWebNavigation,
  type InjectionEvent,
} from './InjectionHandlers';
import { BackgroundConfig } from '../BackgroundConfig';
import type { BackgroundMessage, MessageSender } from '../IBackgroundService';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockChromeScripting(): IChromeScripting {
  return {
    executeScript: vi.fn(async () => [{ result: undefined }]),
  };
}

function createMockChromeWebNavigation(): IChromeWebNavigation & {
  _triggerOnCommitted: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void;
  _triggerOnCompleted: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void;
} {
  const committedListeners: Array<(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void> = [];
  const completedListeners: Array<(details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => void> = [];

  return {
    onCommitted: {
      addListener: vi.fn((cb) => committedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const index = committedListeners.indexOf(cb);
        if (index >= 0) committedListeners.splice(index, 1);
      }),
    },
    onCompleted: {
      addListener: vi.fn((cb) => completedListeners.push(cb)),
      removeListener: vi.fn((cb) => {
        const index = completedListeners.indexOf(cb);
        if (index >= 0) completedListeners.splice(index, 1);
      }),
    },
    _triggerOnCommitted: (details) => {
      committedListeners.forEach(cb => cb(details));
    },
    _triggerOnCompleted: (details) => {
      completedListeners.forEach(cb => cb(details));
    },
  };
}

function createMessage(action: string, payload?: unknown): BackgroundMessage {
  return { action, payload };
}

const mockSender: MessageSender = {};

// ============================================================================
// TESTS
// ============================================================================

describe('InjectionHandlers', () => {
  let handlers: InjectionHandlers;
  let config: BackgroundConfig;
  let mockScripting: IChromeScripting;
  let mockWebNavigation: ReturnType<typeof createMockChromeWebNavigation>;

  beforeEach(() => {
    config = new BackgroundConfig();
    mockScripting = createMockChromeScripting();
    mockWebNavigation = createMockChromeWebNavigation();
    handlers = new InjectionHandlers(config, mockScripting, mockWebNavigation);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // INJECT SCRIPT TESTS
  // ==========================================================================

  describe('handleInjectScript', () => {
    it('should inject script into tab', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {
        tabId: 1,
      });

      const response = await handlers.handleInjectScript(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockScripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1, allFrames: true },
        files: [DEFAULT_SCRIPTS.MAIN],
        world: 'ISOLATED',
      });
    });

    it('should inject custom files', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {
        tabId: 1,
        files: ['js/custom.js', 'js/other.js'],
      });

      await handlers.handleInjectScript(message, mockSender);

      expect(mockScripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          files: ['js/custom.js', 'js/other.js'],
        })
      );
    });

    it('should support MAIN world injection', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {
        tabId: 1,
        world: 'MAIN',
      });

      await handlers.handleInjectScript(message, mockSender);

      expect(mockScripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          world: 'MAIN',
        })
      );
    });

    it('should retry on failure', async () => {
      vi.mocked(mockScripting.executeScript)
        .mockRejectedValueOnce(new Error('Injection failed'))
        .mockResolvedValueOnce([{ result: undefined }]);

      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {
        tabId: 1,
        retry: true,
      });

      const response = await handlers.handleInjectScript(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockScripting.executeScript).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      vi.mocked(mockScripting.executeScript).mockRejectedValue(new Error('Injection failed'));

      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {
        tabId: 1,
        retry: true,
      });

      const response = await handlers.handleInjectScript(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Injection failed');
    });

    it('should fail without tabId', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {});

      const response = await handlers.handleInjectScript(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Tab ID');
    });

    it('should update injection status', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, {
        tabId: 1,
      });

      await handlers.handleInjectScript(message, mockSender);

      expect(handlers.isInjected(1)).toBe(true);
    });
  });

  // ==========================================================================
  // INJECT INTO ALL FRAMES TESTS
  // ==========================================================================

  describe('handleInjectIntoAllFrames', () => {
    it('should inject into all frames', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_INTO_ALL_FRAMES, {
        tabId: 1,
      });

      await handlers.handleInjectIntoAllFrames(message, mockSender);

      expect(mockScripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 1, allFrames: true },
        })
      );
    });

    it('should enable auto-reinject for tab', async () => {
      const message = createMessage(INJECTION_ACTIONS.INJECT_INTO_ALL_FRAMES, {
        tabId: 1,
      });

      await handlers.handleInjectIntoAllFrames(message, mockSender);

      expect(handlers.getAutoReinjectTabs().has(1)).toBe(true);
    });
  });

  // ==========================================================================
  // EXECUTE CODE TESTS
  // ==========================================================================

  describe('handleExecuteCode', () => {
    it('should execute code in tab', async () => {
      const message = createMessage(INJECTION_ACTIONS.EXECUTE_CODE, {
        tabId: 1,
        code: 'console.log("test")',
      });

      const response = await handlers.handleExecuteCode(message, mockSender);

      expect(response.success).toBe(true);
      expect(mockScripting.executeScript).toHaveBeenCalled();
    });

    it('should fail without code', async () => {
      const message = createMessage(INJECTION_ACTIONS.EXECUTE_CODE, {
        tabId: 1,
      });

      const response = await handlers.handleExecuteCode(message, mockSender);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Code');
    });
  });

  // ==========================================================================
  // GET INJECTION STATUS TESTS
  // ==========================================================================

  describe('handleGetInjectionStatus', () => {
    it('should return status for specific tab', async () => {
      // Inject first
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );

      const message = createMessage(INJECTION_ACTIONS.GET_INJECTION_STATUS, {
        tabId: 1,
      });

      const response = await handlers.handleGetInjectionStatus(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.injected).toBe(true);
      expect(response.data?.injectionCount).toBe(1);
    });

    it('should return false for non-injected tab', async () => {
      const message = createMessage(INJECTION_ACTIONS.GET_INJECTION_STATUS, {
        tabId: 999,
      });

      const response = await handlers.handleGetInjectionStatus(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.injected).toBe(false);
    });

    it('should return all statuses when no tabId', async () => {
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 2 }),
        mockSender
      );

      const message = createMessage(INJECTION_ACTIONS.GET_INJECTION_STATUS, {});

      const response = await handlers.handleGetInjectionStatus(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.statuses).toHaveLength(2);
    });
  });

  // ==========================================================================
  // REINJECT ALL TESTS
  // ==========================================================================

  describe('handleReinjectAll', () => {
    it('should reinject into all auto-reinject tabs', async () => {
      // Mark tabs for auto-reinject
      await handlers.handleMarkForReinjection(
        createMessage(INJECTION_ACTIONS.MARK_FOR_REINJECTION, { tabId: 1 }),
        mockSender
      );
      await handlers.handleMarkForReinjection(
        createMessage(INJECTION_ACTIONS.MARK_FOR_REINJECTION, { tabId: 2 }),
        mockSender
      );

      const message = createMessage(INJECTION_ACTIONS.REINJECT_ALL);

      const response = await handlers.handleReinjectAll(message, mockSender);

      expect(response.success).toBe(true);
      expect(response.data?.total).toBe(2);
      expect(mockScripting.executeScript).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // MARK FOR REINJECTION TESTS
  // ==========================================================================

  describe('handleMarkForReinjection', () => {
    it('should mark tab for reinjection', async () => {
      const message = createMessage(INJECTION_ACTIONS.MARK_FOR_REINJECTION, {
        tabId: 1,
      });

      const response = await handlers.handleMarkForReinjection(message, mockSender);

      expect(response.success).toBe(true);
      expect(handlers.getAutoReinjectTabs().has(1)).toBe(true);
    });

    it('should unmark tab when enabled=false', async () => {
      // Mark first
      await handlers.handleMarkForReinjection(
        createMessage(INJECTION_ACTIONS.MARK_FOR_REINJECTION, { tabId: 1 }),
        mockSender
      );

      // Unmark
      const message = createMessage(INJECTION_ACTIONS.MARK_FOR_REINJECTION, {
        tabId: 1,
        enabled: false,
      });

      await handlers.handleMarkForReinjection(message, mockSender);

      expect(handlers.getAutoReinjectTabs().has(1)).toBe(false);
    });
  });

  // ==========================================================================
  // CLEAR INJECTION STATUS TESTS
  // ==========================================================================

  describe('handleClearInjectionStatus', () => {
    it('should clear specific tab status', async () => {
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );

      const message = createMessage(INJECTION_ACTIONS.CLEAR_INJECTION_STATUS, {
        tabId: 1,
      });

      await handlers.handleClearInjectionStatus(message, mockSender);

      expect(handlers.isInjected(1)).toBe(false);
    });

    it('should clear all statuses when no tabId', async () => {
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 2 }),
        mockSender
      );

      const message = createMessage(INJECTION_ACTIONS.CLEAR_INJECTION_STATUS, {});

      await handlers.handleClearInjectionStatus(message, mockSender);

      expect(handlers.isInjected(1)).toBe(false);
      expect(handlers.isInjected(2)).toBe(false);
    });
  });

  // ==========================================================================
  // NAVIGATION LISTENER TESTS
  // ==========================================================================

  describe('navigation listeners', () => {
    it('should setup navigation listeners', () => {
      handlers.setupNavigationListeners();

      expect(mockWebNavigation.onCommitted.addListener).toHaveBeenCalled();
      expect(mockWebNavigation.onCompleted.addListener).toHaveBeenCalled();
    });

    it('should reinject on navigation for tracked tabs', async () => {
      // Mark tab for auto-reinject
      await handlers.handleMarkForReinjection(
        createMessage(INJECTION_ACTIONS.MARK_FOR_REINJECTION, { tabId: 1 }),
        mockSender
      );

      handlers.setupNavigationListeners();

      // Trigger navigation
      mockWebNavigation._triggerOnCommitted({
        tabId: 1,
        frameId: 0,
        url: 'https://example.com',
        transitionType: 'link',
        transitionQualifiers: [],
        timeStamp: Date.now(),
        processId: 1,
        documentId: 'doc1',
        documentLifecycle: 'active',
        parentDocumentId: undefined,
        parentFrameId: -1,
      });

      // Wait for delayed reinjection
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockScripting.executeScript).toHaveBeenCalled();
    });

    it('should not reinject for non-tracked tabs', async () => {
      handlers.setupNavigationListeners();

      // Trigger navigation for non-tracked tab
      mockWebNavigation._triggerOnCommitted({
        tabId: 999,
        frameId: 0,
        url: 'https://example.com',
        transitionType: 'link',
        transitionQualifiers: [],
        timeStamp: Date.now(),
        processId: 1,
        documentId: 'doc1',
        documentLifecycle: 'active',
        parentDocumentId: undefined,
        parentFrameId: -1,
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockScripting.executeScript).not.toHaveBeenCalled();
    });

    it('should remove navigation listeners', () => {
      handlers.setupNavigationListeners();
      handlers.removeNavigationListeners();

      expect(mockWebNavigation.onCommitted.removeListener).toHaveBeenCalled();
      expect(mockWebNavigation.onCompleted.removeListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit injection events', async () => {
      const events: InjectionEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );

      expect(events.some(e => e.type === 'injection_started')).toBe(true);
      expect(events.some(e => e.type === 'injection_completed')).toBe(true);
    });

    it('should emit injection_failed event', async () => {
      vi.mocked(mockScripting.executeScript).mockRejectedValue(new Error('Failed'));

      const events: InjectionEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1, retry: false }),
        mockSender
      );

      expect(events.some(e => e.type === 'injection_failed')).toBe(true);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    it('should track injection statistics', async () => {
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );

      const stats = handlers.getStats();
      expect(stats.totalInjections).toBe(1);
      expect(stats.successfulInjections).toBe(1);
    });

    it('should reset statistics', async () => {
      await handlers.handleInjectScript(
        createMessage(INJECTION_ACTIONS.INJECT_SCRIPT, { tabId: 1 }),
        mockSender
      );

      handlers.resetStats();

      const stats = handlers.getStats();
      expect(stats.totalInjections).toBe(0);
    });
  });

  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================

  describe('registration', () => {
    it('should return all handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(7);
      expect(entries.every(e => e.category === 'injection')).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createInjectionHandlers', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const mockScripting = createMockChromeScripting();

    const handlers = createInjectionHandlers(config, mockScripting);

    expect(handlers).toBeInstanceOf(InjectionHandlers);
  });
});
