/**
 * ReplayHandlers - Replay Message Handlers
 * @module background/handlers/ReplayHandlersP4
 * @version 1.0.0
 * 
 * Handles replay/execution-related messages (P4-214 refactored version).
 */

import { MessageRouter, MessageHandler } from '../MessageRouter';
import { TabManager } from '../TabManager';

// ============================================================================
// HANDLER CREATORS
// ============================================================================

/**
 * Create replay handlers with dependencies
 */
export function createReplayHandlers(
  tabManager: TabManager
): Record<string, MessageHandler> {
  /**
   * Start replay handler
   */
  const handleStartReplay: MessageHandler = async (payload, _sender, sendResponse) => {
    const { steps, tabId } = payload as { steps: unknown[]; tabId: number };

    if (!tabManager.isTracked(tabId)) {
      sendResponse({ success: false, error: 'Tab not tracked' });
      return;
    }

    try {
      // Send replay start message to content script
      await tabManager.sendToTab(tabId, {
        type: 'start_replay',
        steps,
      });

      sendResponse({ success: true });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start replay',
      });
    }
    return true;
  };

  /**
   * Stop replay handler
   */
  const handleStopReplay: MessageHandler = async (payload, _sender, sendResponse) => {
    const { tabId } = (payload as { tabId?: number }) || {};

    const targetTabId = tabId || tabManager.getLastOpenedTabId();

    if (!targetTabId) {
      sendResponse({ success: false, error: 'No tab to stop replay' });
      return;
    }

    try {
      await tabManager.sendToTab(targetTabId, { type: 'stop_replay' });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop replay',
      });
    }
    return true;
  };

  /**
   * Run single step handler
   */
  const handleRunStep: MessageHandler = async (payload, _sender, sendResponse) => {
    const { tabId, step } = payload as { tabId: number; step: unknown };

    try {
      const result = await tabManager.sendToTab(tabId, {
        type: 'runStep',
        data: step,
      });

      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run step',
      });
    }
    return true;
  };

  /**
   * Step result handler (from content script)
   * Broadcasts to extension pages
   */
  const handleStepResult: MessageHandler = (payload, sender, sendResponse) => {
    // Broadcast to all extension pages
    chrome.runtime.sendMessage({
      type: 'step_result',
      data: payload,
      source: sender.tab?.id,
    }).catch(() => {
      // Ignore errors if no listeners
    });

    sendResponse({ success: true });
    return false;
  };

  return {
    start_replay: handleStartReplay,
    stop_replay: handleStopReplay,
    runStep: handleRunStep,
    step_result: handleStepResult,
  };
}

/**
 * Register replay handlers
 */
export function registerReplayHandlersP4(
  router: MessageRouter,
  tabManager: TabManager
): void {
  const handlers = createReplayHandlers(tabManager);
  
  Object.entries(handlers).forEach(([action, handler]) => {
    router.register(action, handler);
  });
}

export default registerReplayHandlersP4;
