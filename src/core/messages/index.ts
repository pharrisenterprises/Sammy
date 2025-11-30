/**
 * @fileoverview Barrel export for all message-related types and utilities
 * @module core/messages
 * @version 1.0.0
 * 
 * This module re-exports all message types, handlers, and utilities
 * for Chrome extension messaging.
 * 
 * @example
 * ```typescript
 * // Import message types
 * import { 
 *   MESSAGE_ACTIONS, 
 *   MessageAction, 
 *   BaseMessage, 
 *   BaseResponse 
 * } from '@/core/messages';
 * 
 * // Import handler utilities
 * import { 
 *   MessageHandlerRegistry, 
 *   messageRegistry,
 *   wrapAsyncHandler,
 *   sendMessageToBackground 
 * } from '@/core/messages';
 * 
 * // Import running state utilities (CRITICAL: use isRunningRef pattern)
 * import { createRunningState, createRunningRef } from '@/core/messages';
 * ```
 * 
 * CRITICAL PATTERNS:
 * - Message actions are lowercase_snake_case (get_all_projects, NOT getAllProjects)
 * - Async handlers MUST return true to keep message channel open
 * - Use isRunningRef pattern for synchronous state checks
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 2 for message specifications
 * @see message-bus_breakdown.md for messaging architecture
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export {
  // Action Constants
  MESSAGE_ACTIONS,
  ALL_MESSAGE_ACTIONS,
  PROJECT_ACTIONS,
  STEP_ACTIONS,
  RECORDING_ACTIONS,
  REPLAY_ACTIONS,
  
  // Base Types
  type MessageAction,
  type BaseMessage,
  type BaseResponse,
  type SuccessResponse,
  type ErrorResponse,
  
  // Project Message Types
  type GetAllProjectsMessage,
  type GetAllProjectsResponse,
  type GetProjectPayload,
  type GetProjectMessage,
  type GetProjectResponse,
  type AddProjectPayload,
  type AddProjectMessage,
  type AddProjectResponse,
  type UpdateProjectPayload,
  type UpdateProjectMessage,
  type UpdateProjectResponse,
  type DeleteProjectPayload,
  type DeleteProjectMessage,
  type DeleteProjectResponse,
  
  // Step Message Types
  type UpdateProjectStepsPayload,
  type UpdateProjectStepsMessage,
  type UpdateProjectStepsResponse,
  type GetProjectStepsPayload,
  type GetProjectStepsMessage,
  type GetProjectStepsResponse,
  type AddStepPayload,
  type AddStepMessage,
  type AddStepResponse,
  type UpdateStepPayload,
  type UpdateStepMessage,
  type UpdateStepResponse,
  type DeleteStepPayload,
  type DeleteStepMessage,
  type DeleteStepResponse,
  type ReorderStepsPayload,
  type ReorderStepsMessage,
  type ReorderStepsResponse,
  
  // Field Message Types
  type UpdateProjectFieldsPayload,
  type UpdateProjectFieldsMessage,
  type UpdateProjectFieldsResponse,
  type GetProjectFieldsPayload,
  type GetProjectFieldsMessage,
  type GetProjectFieldsResponse,
  type AutoMapFieldsPayload,
  type AutoMapFieldsMessage,
  type AutoMapFieldsResponse,
  
  // Test Run Message Types
  type StartTestRunPayload,
  type StartTestRunMessage,
  type StartTestRunResponse,
  type StopTestRunPayload,
  type StopTestRunMessage,
  type StopTestRunResponse,
  type GetTestRunStatusPayload,
  type GetTestRunStatusMessage,
  type GetTestRunStatusResponse,
  type GetTestRunLogsPayload,
  type GetTestRunLogsMessage,
  type GetTestRunLogsResponse,
  
  // Recording Message Types
  type StartRecordingPayload,
  type StartRecordingMessage,
  type StartRecordingResponse,
  type StopRecordingPayload,
  type StopRecordingMessage,
  type StopRecordingResponse,
  type GetRecordingStatusMessage,
  type GetRecordingStatusResponse,
  type RecordStepPayload,
  type RecordStepMessage,
  type RecordStepResponse,
  
  // Replay Message Types
  type StartReplayPayload,
  type StartReplayMessage,
  type StartReplayResponse,
  type StopReplayPayload,
  type StopReplayMessage,
  type StopReplayResponse,
  type ReplayStepPayload,
  type ReplayStepMessage,
  type ReplayStepResponse,
  type GetReplayStatusMessage,
  type GetReplayStatusResponse,
  
  // CSV Message Types
  type ImportCsvPayload,
  type ImportCsvMessage,
  type ImportCsvResponse,
  type ExportCsvPayload,
  type ExportCsvMessage,
  type ExportCsvResponse,
  type ParseCsvPayload,
  type ParseCsvMessage,
  type ParseCsvResponse,
  type UpdateCsvDataPayload,
  type UpdateCsvDataMessage,
  type UpdateCsvDataResponse,
  
  // Tab Management Message Types
  type GetActiveTabMessage,
  type GetActiveTabResponse,
  type InjectContentScriptPayload,
  type InjectContentScriptMessage,
  type InjectContentScriptResponse,
  type NavigateToUrlPayload,
  type NavigateToUrlMessage,
  type NavigateToUrlResponse,
  
  // Storage Message Types
  type ClearStoragePayload,
  type ClearStorageMessage,
  type ClearStorageResponse,
  type GetStorageStatsMessage,
  type GetStorageStatsResponse,
  type ExportAllDataMessage,
  type ExportAllDataResponse,
  type ImportAllDataPayload,
  type ImportAllDataMessage,
  type ImportAllDataResponse,
  
  // Element Location Message Types
  type LocateElementPayload,
  type LocateElementMessage,
  type LocateElementResponse,
  type HighlightElementPayload,
  type HighlightElementMessage,
  type HighlightElementResponse,
  type ClearHighlightsMessage,
  type ClearHighlightsResponse,
  
  // UI Notification Message Types
  type ShowNotificationPayload,
  type ShowNotificationMessage,
  type ShowNotificationResponse,
  type UpdateBadgePayload,
  type UpdateBadgeMessage,
  type UpdateBadgeResponse,
  
  // Union Types
  type AnyMessage,
  type AnyResponse,
  
  // Type Guards
  isMessageAction,
  isMessage,
  isSuccessResponse,
  isErrorResponse,
  
  // Category Helpers
  isProjectAction,
  isStepAction,
  isRecordingAction,
  isReplayAction,
  
  // Factory Functions
  generateRequestId,
  createMessage,
  createSuccessResponse,
  createErrorResponse
} from './message-types';

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

export {
  // Types
  type MessageSender,
  type SendResponse,
  type AsyncMessageHandler,
  type SyncMessageHandler,
  type HandlerRegistryEntry,
  type HandlerRegistry,
  type MessageListenerReturn,
  type ChromeMessageListener,
  type RunningStateController,
  
  // Handler Registry Class
  MessageHandlerRegistry,
  
  // Singleton Instance
  messageRegistry,
  
  // Handler Wrappers
  wrapAsyncHandler,
  wrapSyncHandler,
  withValidation,
  withSenderRequirement,
  
  // Message Sending Utilities
  sendMessageToBackground,
  sendMessageToTab,
  sendMessageToActiveTab,
  broadcastToAllTabs,
  sendMessageWithTimeout,
  sendMessageWithRetry,
  
  // Running State Pattern (CRITICAL: use instead of useState)
  createRunningState,
  createRunningRef
} from './message-handler';

// ============================================================================
// CONVENIENCE TYPES
// ============================================================================

/**
 * Type for message handler functions that can be registered
 */
export type RegisterableHandler<P = unknown, R = unknown> = (
  payload: P,
  sender: import('./message-handler').MessageSender,
  sendResponse: import('./message-handler').SendResponse<R>
) => Promise<void> | void;

/**
 * Configuration options for the message handler registry
 */
export interface MessageHandlerConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Default timeout for message responses */
  defaultTimeoutMs?: number;
  /** Default retry count for failed messages */
  defaultRetryCount?: number;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Number of retry attempts */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelayMs?: number;
}

// ============================================================================
// COMMON MESSAGE PATTERNS
// ============================================================================

// Import generateRequestId for use in helper functions below
import { generateRequestId } from './message-types';

/**
 * Create a simple get-all message (no payload needed)
 * 
 * @example
 * ```typescript
 * const response = await sendMessageToBackground(createGetAllMessage('get_all_projects'));
 * ```
 */
export function createGetAllMessage(
  action: 'get_all_projects' | 'get_recording_status' | 'get_replay_status' | 'get_storage_stats' | 'get_active_tab' | 'export_all_data' | 'clear_highlights'
) {
  return {
    action,
    payload: undefined,
    requestId: generateRequestId(),
    timestamp: Date.now()
  };
}

/**
 * Create a message with project ID payload
 * 
 * @example
 * ```typescript
 * const response = await sendMessageToBackground(createProjectIdMessage('get_project', 1));
 * ```
 */
export function createProjectIdMessage(
  action: 'get_project' | 'delete_project' | 'get_project_steps' | 'get_project_fields',
  projectId: number
) {
  return {
    action,
    payload: { projectId },
    requestId: generateRequestId(),
    timestamp: Date.now()
  };
}

/**
 * Create a recording control message
 * 
 * @example
 * ```typescript
 * const response = await sendMessageToBackground(
 *   createRecordingMessage('start_recording', 1, 123)
 * );
 * ```
 */
export function createRecordingMessage(
  action: 'start_recording',
  projectId: number,
  tabId: number
): import('./message-types').StartRecordingMessage;
export function createRecordingMessage(
  action: 'stop_recording',
  projectId: number,
  tabId?: never
): import('./message-types').StopRecordingMessage;
export function createRecordingMessage(
  action: 'start_recording' | 'stop_recording',
  projectId: number,
  tabId?: number
): import('./message-types').StartRecordingMessage | import('./message-types').StopRecordingMessage {
  const requestId = generateRequestId();
  const timestamp = Date.now();
  if (action === 'start_recording') {
    return {
      action,
      payload: { projectId, tabId: tabId! },
      requestId,
      timestamp
    };
  }
  return {
    action,
    payload: { projectId },
    requestId,
    timestamp
  };
}

/**
 * Create a replay control message
 * 
 * @example
 * ```typescript
 * const response = await sendMessageToBackground(
 *   createReplayMessage('start_replay', 1, { csvRowIndex: 0 })
 * );
 * ```
 */
export function createReplayMessage(
  action: 'start_replay',
  projectId: number,
  options?: { csvRowIndex?: number; startFromStep?: number }
): import('./message-types').StartReplayMessage;
export function createReplayMessage(
  action: 'stop_replay',
  testRunId: string,
  options?: never
): import('./message-types').StopReplayMessage;
export function createReplayMessage(
  action: 'start_replay' | 'stop_replay',
  idOrProjectId: number | string,
  options?: { csvRowIndex?: number; startFromStep?: number }
): import('./message-types').StartReplayMessage | import('./message-types').StopReplayMessage {
  const requestId = generateRequestId();
  const timestamp = Date.now();
  if (action === 'start_replay') {
    return {
      action,
      payload: { 
        projectId: idOrProjectId as number, 
        csvRowIndex: options?.csvRowIndex,
        startFromStep: options?.startFromStep
      },
      requestId,
      timestamp
    };
  }
  return {
    action,
    payload: { testRunId: idOrProjectId as string },
    requestId,
    timestamp
  };
}

// ============================================================================
// DOCUMENTATION REMINDERS
// ============================================================================

/**
 * CRITICAL IMPLEMENTATION PATTERNS
 * 
 * 1. Message Action Names:
 *    ✅ lowercase_snake_case: 'get_all_projects', 'add_project', 'start_recording'
 *    ❌ camelCase: 'getAllProjects', 'addProject', 'startRecording'
 * 
 * 2. Async Handler Return Value:
 *    ALWAYS return true from async handlers to keep message channel open
 *    ```typescript
 *    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 *      handleAsyncMessage(message, sendResponse);
 *      return true; // CRITICAL: keeps channel open
 *    });
 *    ```
 * 
 * 3. Running State Pattern:
 *    Use isRunningRef (useRef) for synchronous state checks, NOT useState
 *    ```typescript
 *    // ✅ CORRECT: synchronous check
 *    const isRunningRef = useRef(false);
 *    if (isRunningRef.current) return;
 *    isRunningRef.current = true;
 * 
 *    // ❌ WRONG: useState has async updates
 *    const [isRunning, setIsRunning] = useState(false);
 *    if (isRunning) return; // May not reflect latest value!
 *    ```
 * 
 * 4. Error Handling:
 *    Always wrap async operations in try/catch and send error responses
 *    ```typescript
 *    try {
 *      const result = await doAsyncWork();
 *      sendResponse(createSuccessResponse(result));
 *    } catch (error) {
 *      sendResponse(createErrorResponse(error.message));
 *    }
 *    ```
 */
