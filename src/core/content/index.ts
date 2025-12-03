/**
 * Content Script Module - Barrel Export
 * @module core/content
 * @version 1.0.0
 * 
 * Provides content script infrastructure for dual-mode operation
 * (recording/replay), cross-context messaging, and notification UI.
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   createContextBridge,
 *   createNotificationUI,
 *   type ContentScriptMode,
 *   type RecordedEvent,
 * } from '@/core/content';
 * 
 * // Initialize context bridge
 * const bridge = createContextBridge();
 * bridge.initialize();
 * 
 * // Show notification
 * const notification = createNotificationUI();
 * notification.showLoading('Executing step 1 of 5...', 20);
 * ```
 * 
 * ## Module Structure
 * - **IContentScript**: Interface contracts
 * - **ContextBridge**: Cross-context messaging
 * - **NotificationUI**: Overlay notifications
 */

// ============================================================================
// INTERFACES & TYPES (IContentScript)
// ============================================================================

export type {
  // Mode types
  ContentScriptMode,
  ContentScriptState,
  RecordingState,
  ReplayState,
  
  // Event types
  RecordedEventType,
  RecordedEvent,
  IframeInfo,
  
  // Message types
  ContentToExtensionMessage,
  ExtensionToContentMessage,
  PageContextMessage,
  StepExecutionRequest,
  StepExecutionResponse,
  
  // Notification types
  NotificationType,
  NotificationConfig,
  
  // Handler types
  RecordedEventHandler,
  ModeChangeHandler,
  ContentErrorHandler,
  
  // Interfaces
  IEventRecorder,
  IStepReplayer,
  IIframeManager,
  IShadowDOMHandler,
  IContextBridge,
  INotificationUI,
  IContentScript,
  ContentScriptFactory,
} from './IContentScript';

// ============================================================================
// CONSTANTS (IContentScript)
// ============================================================================

export {
  // Timeouts
  DEFAULT_STEP_TIMEOUT,
  DEFAULT_NOTIFICATION_DURATION,
  
  // Source identifiers
  PAGE_SCRIPT_SOURCE,
  CONTENT_SCRIPT_SOURCE,
  
  // Event type lists
  INPUT_EVENT_TYPES,
  CLICK_EVENT_TYPES,
  
  // Helper functions
  isInputEventType,
  isClickEventType,
  createEmptyRecordingState,
  createEmptyReplayState,
  createInitialContentState,
  createRecordedEvent,
  createStepResponse,
  serializeIframeChain,
  createContentMessage,
  createNotification,
} from './IContentScript';

// ============================================================================
// CONTEXT BRIDGE
// ============================================================================

export {
  // Types
  type ExtensionMessageHandler,
  type PageMessageHandler,
  type ContextBridgeConfig,
  
  // Constants
  DEFAULT_BRIDGE_CONFIG,
  
  // Class
  ContextBridge,
  
  // Factory functions
  createContextBridge,
  createInitializedBridge,
  createDebugBridge,
  
  // Singleton
  getContextBridge,
  resetContextBridge,
  
  // Mock
  MockContextBridge,
  createMockContextBridge,
} from './ContextBridge';

// ============================================================================
// NOTIFICATION UI
// ============================================================================

export {
  // Types
  type NotificationUIConfig,
  
  // Constants
  DEFAULT_UI_CONFIG,
  NOTIFICATION_COLORS,
  NOTIFICATION_ICONS,
  
  // Class
  NotificationUI,
  
  // Factory functions
  createNotificationUI,
  createPositionedNotificationUI,
  createSimpleNotificationUI,
  
  // Singleton
  getNotificationUI,
  resetNotificationUI,
  
  // Mock
  MockNotificationUI,
  createMockNotificationUI,
} from './NotificationUI';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Content module version
 */
export const CONTENT_VERSION = '1.0.0';

/**
 * Content module defaults
 */
export const CONTENT_DEFAULTS = {
  /** Default step execution timeout in ms */
  STEP_TIMEOUT: 30000,
  
  /** Default notification display duration in ms */
  NOTIFICATION_DURATION: 3000,
  
  /** Default animation duration in ms */
  ANIMATION_DURATION: 300,
  
  /** Default notification position */
  NOTIFICATION_POSITION: 'top-right' as const,
  
  /** Default z-index for overlays */
  OVERLAY_Z_INDEX: 2147483647,
  
  /** Extension message timeout in ms */
  EXTENSION_TIMEOUT: 30000,
} as const;

/**
 * Message type constants
 */
export const MESSAGE_TYPES = {
  // Content to extension
  LOG_EVENT: 'logEvent',
  STEP_RESULT: 'step_result',
  RECORDING_STARTED: 'recording_started',
  RECORDING_STOPPED: 'recording_stopped',
  REPLAY_COMPLETE: 'replay_complete',
  CONTENT_READY: 'content_script_ready',
  ERROR: 'error',
  
  // Extension to content
  START_RECORDING: 'start_recording',
  STOP_RECORDING: 'stop_recording',
  EXECUTE_REPLAY: 'execute_replay',
  EXECUTE_STEP: 'execute_step',
  PING: 'ping',
  GET_STATE: 'get_state',
  INJECT_INTERCEPTOR: 'inject_interceptor',
  
  // Page context
  REPLAY_AUTOCOMPLETE: 'REPLAY_AUTOCOMPLETE',
  AUTOCOMPLETE_INPUT: 'AUTOCOMPLETE_INPUT',
  AUTOCOMPLETE_SELECTION: 'AUTOCOMPLETE_SELECTION',
  SHADOW_ROOT_EXPOSED: 'SHADOW_ROOT_EXPOSED',
  PAGE_SCRIPT_READY: 'PAGE_SCRIPT_READY',
  EXECUTE_IN_PAGE: 'EXECUTE_IN_PAGE',
} as const;

/**
 * Notification type constants
 */
export const NOTIFICATION_TYPES = {
  LOADING: 'loading' as const,
  SUCCESS: 'success' as const,
  ERROR: 'error' as const,
  INFO: 'info' as const,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if running in content script context
 */
export function isContentScriptContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function' &&
    typeof window !== 'undefined'
  );
}

/**
 * Check if running in page context
 */
export function isPageContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    (typeof chrome === 'undefined' || !chrome.runtime)
  );
}

/**
 * Get current page URL safely
 */
export function getCurrentPageUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.href;
  }
  return '';
}

/**
 * Get current page origin safely
 */
export function getCurrentPageOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/**
 * Format step progress message
 */
export function formatStepProgress(
  current: number,
  total: number,
  label?: string
): string {
  const base = `Step ${current} of ${total}`;
  return label ? `${base}: ${label}` : base;
}

/**
 * Format row progress message
 */
export function formatRowProgress(
  currentRow: number,
  totalRows: number,
  currentStep: number,
  totalSteps: number
): string {
  return `Row ${currentRow}/${totalRows} - Step ${currentStep}/${totalSteps}`;
}

/**
 * Format replay progress percentage
 */
export function formatReplayProgress(
  completedRows: number,
  totalRows: number,
  currentStep: number,
  totalSteps: number
): number {
  if (totalRows === 0 || totalSteps === 0) return 0;
  
  const totalOperations = totalRows * totalSteps;
  const completedOperations = (completedRows * totalSteps) + currentStep;
  
  return Math.round((completedOperations / totalOperations) * 100);
}

/**
 * Create step execution timeout error
 */
export function createTimeoutError(stepLabel: string, timeout: number): Error {
  return new Error(
    `Step "${stepLabel}" timed out after ${timeout}ms`
  );
}

/**
 * Create element not found error
 */
export function createElementNotFoundError(
  stepLabel: string,
  strategies: string[]
): Error {
  return new Error(
    `Element for step "${stepLabel}" not found using strategies: ${strategies.join(', ')}`
  );
}

/**
 * Reset all content module singletons (for testing)
 */
export function resetAllContentSingletons(): void {
  resetContextBridge();
  resetNotificationUI();
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

import type {
  ContentToExtensionMessage,
  ExtensionToContentMessage,
  PageContextMessage,
  RecordedEventType,
} from './IContentScript';

import { resetContextBridge } from './ContextBridge';
import { resetNotificationUI } from './NotificationUI';

/**
 * Check if message is a content-to-extension message
 */
export function isContentToExtensionMessage(
  message: unknown
): message is ContentToExtensionMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as Record<string, unknown>;
  return typeof msg.type === 'string';
}

/**
 * Check if message is an extension-to-content message
 */
export function isExtensionToContentMessage(
  message: unknown
): message is ExtensionToContentMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as Record<string, unknown>;
  return typeof msg.action === 'string';
}

/**
 * Check if message is a page context message
 */
export function isPageContextMessage(
  message: unknown
): message is PageContextMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as Record<string, unknown>;
  return typeof msg.type === 'string';
}

/**
 * Check if event type is valid
 */
export function isValidRecordedEventType(
  type: string
): type is RecordedEventType {
  const validTypes: RecordedEventType[] = [
    'click',
    'input',
    'change',
    'enter',
    'select',
    'focus',
    'blur',
    'submit',
    'navigation',
    'autocomplete_input',
    'autocomplete_selection',
  ];
  
  return validTypes.includes(type as RecordedEventType);
}
