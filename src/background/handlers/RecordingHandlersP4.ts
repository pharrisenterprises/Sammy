/**
 * RecordingHandlers - Recording Message Handlers
 * @module background/handlers/RecordingHandlersP4
 * @version 1.0.0
 * 
 * Handles recording-related messages (P4-214 refactored version).
 */

import { MessageRouter, MessageHandler } from '../MessageRouter';
import type { BackgroundService } from '../BackgroundService';

// ============================================================================
// HANDLER CREATORS
// ============================================================================

/**
 * Create recording handlers with dependencies
 */
export function createRecordingHandlers(
  backgroundService: BackgroundService
): Record<string, MessageHandler> {
  /**
   * Start recording handler
   */
  const handleStartRecording: MessageHandler = (payload, _sender, sendResponse) => {
    const { projectId } = payload as { projectId?: string };
    
    backgroundService.setRecordingState(true, projectId || null);
    
    sendResponse({ success: true });
    return false;
  };

  /**
   * Stop recording handler
   */
  const handleStopRecording: MessageHandler = (_payload, _sender, sendResponse) => {
    backgroundService.setRecordingState(false, null);
    
    sendResponse({ success: true });
    return false;
  };

  /**
   * Get recording state handler
   */
  const handleGetRecordingState: MessageHandler = (_payload, _sender, sendResponse) => {
    const state = backgroundService.getState();
    
    sendResponse({
      success: true,
      data: {
        isRecording: state.isRecording,
        projectId: state.activeRecordingProjectId,
      },
    });
    return false;
  };

  /**
   * Log event handler (from content script)
   * Broadcasts to all extension pages
   */
  const handleLogEvent: MessageHandler = (payload, sender, sendResponse) => {
    // Broadcast to all extension pages
    chrome.runtime.sendMessage({
      type: 'logEvent',
      data: payload,
      source: sender.tab?.id,
    }).catch(() => {
      // Ignore errors if no listeners
    });
    
    sendResponse({ success: true });
    return false;
  };

  return {
    start_recording: handleStartRecording,
    stop_recording: handleStopRecording,
    get_recording_state: handleGetRecordingState,
    logEvent: handleLogEvent,
  };
}

/**
 * Register recording handlers
 */
export function registerRecordingHandlersP4(
  router: MessageRouter,
  backgroundService: BackgroundService
): void {
  const handlers = createRecordingHandlers(backgroundService);
  
  Object.entries(handlers).forEach(([action, handler]) => {
    router.register(action, handler);
  });
}

export default registerRecordingHandlersP4;
