/**
 * Content Module - Barrel Export
 * @module core/content
 * @version 1.0.0
 * 
 * Provides content script infrastructure for page automation including
 * recording, replay, cross-context messaging, and notifications.
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   // Recording
 *   createEventRecorder,
 *   
 *   // Iframe coordination
 *   createIframeManager,
 *   
 *   // Shadow DOM
 *   createShadowDOMHandler,
 *   
 *   // Cross-context messaging
 *   createContextBridge,
 *   
 *   // Notifications
 *   createNotificationUI,
 *   
 *   // Types
 *   type RecordedEvent,
 *   type IframeInfo,
 *   type ShadowHostInfo,
 * } from '@/core/content';
 * ```
 * 
 * ## Module Structure
 * - **IContentScript**: Type definitions and interfaces
 * - **EventRecorder**: User interaction capture
 * - **IframeManager**: Iframe coordination
 * - **ShadowDOMHandler**: Shadow DOM traversal
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
// EVENT RECORDER
// ============================================================================

export {
  // Types
  type EventRecorderConfig,
  
  // Constants
  DEFAULT_RECORDER_CONFIG,
  
  // Class
  EventRecorder,
  
  // Factory functions
  createEventRecorder,
  createDebugRecorder,
  createFullRecorder,
  
  // Singleton
  getEventRecorder,
  resetEventRecorder,
  
  // Helper functions
  generateXPath,
  getElementLabel,
  getElementValue,
  buildLocatorBundle,
  getEventTarget,
  determineEventType,
} from './EventRecorder';

// ============================================================================
// IFRAME MANAGER
// ============================================================================

export {
  // Types
  type IframeManagerConfig,
  
  // Constants
  DEFAULT_IFRAME_MANAGER_CONFIG,
  
  // Class
  IframeManager,
  
  // Factory functions
  createIframeManager,
  createDebugIframeManager,
  createManualIframeManager,
  
  // Singleton
  getIframeManager,
  resetIframeManager,
  
  // Helper functions
  isCrossOriginIframe,
  getIframeDocument,
  createIframeInfo,
  findIframesInDocument,
} from './IframeManager';

// ============================================================================
// SHADOW DOM HANDLER
// ============================================================================

export {
  // Types
  type ShadowHostInfo,
  type ShadowDOMHandlerConfig,
  
  // Constants
  DEFAULT_SHADOW_HANDLER_CONFIG,
  
  // Class
  ShadowDOMHandler,
  
  // Factory functions
  createShadowDOMHandler,
  createDebugShadowHandler,
  
  // Singleton
  getShadowDOMHandler,
  resetShadowDOMHandler,
  
  // Helper functions
  hasShadowRoot,
  getShadowRoot,
  getShadowRootMode,
  createShadowHostInfo,
  generateLocalXPath,
  findAllShadowHosts,
} from './ShadowDOMHandler';

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
  
  /** Default notification duration in ms */
  NOTIFICATION_DURATION: 3000,
  
  /** Default animation duration in ms */
  ANIMATION_DURATION: 300,
  
  /** Default notification position */
  NOTIFICATION_POSITION: 'top-right' as const,
  
  /** Default overlay z-index */
  OVERLAY_Z_INDEX: 2147483647,
  
  /** Default extension message timeout in ms */
  EXTENSION_TIMEOUT: 30000,
  
  /** Default input debounce delay in ms */
  INPUT_DEBOUNCE: 300,
  
  /** Default max iframe depth */
  MAX_IFRAME_DEPTH: 10,
  
  /** Default max shadow DOM depth */
  MAX_SHADOW_DEPTH: 10,
  
  /** Property name for intercepted shadow roots */
  INTERCEPTED_SHADOW_PROPERTY: '__realShadowRoot',
} as const;

/**
 * Message type constants
 */
export const MESSAGE_TYPES = {
  // Content to Extension
  LOG_EVENT: 'logEvent' as const,
  PAGE_LOADED: 'pageLoaded' as const,
  RECORDING_ERROR: 'recordingError' as const,
  STEP_COMPLETE: 'stepComplete' as const,
  STEP_ERROR: 'stepError' as const,
  CONTENT_READY: 'contentReady' as const,
  IFRAME_ATTACHED: 'iframeAttached' as const,
  
  // Extension to Content
  START_RECORDING: 'startRecording' as const,
  STOP_RECORDING: 'stopRecording' as const,
  RUN_STEP: 'runStep' as const,
  PING: 'ping' as const,
  GET_STATE: 'getState' as const,
  ATTACH_IFRAMES: 'attachIframes' as const,
  DETACH_IFRAMES: 'detachIframes' as const,
  
  // Page Context
  AUTOCOMPLETE_INPUT: 'AUTOCOMPLETE_INPUT' as const,
  AUTOCOMPLETE_SELECTION: 'AUTOCOMPLETE_SELECTION' as const,
  REPLAY_AUTOCOMPLETE: 'REPLAY_AUTOCOMPLETE' as const,
  SHADOW_ROOT_ATTACHED: 'SHADOW_ROOT_ATTACHED' as const,
  PAGE_SCRIPT_READY: 'PAGE_SCRIPT_READY' as const,
  PAGE_SCRIPT_ERROR: 'PAGE_SCRIPT_ERROR' as const,
} as const;

/**
 * Notification type constants
 */
export const NOTIFICATION_TYPES = {
  LOADING: 'loading' as const,
  SUCCESS: 'success' as const,
  ERROR: 'error' as const,
  INFO: 'info' as const,
} as const;

/**
 * Recording event type constants
 */
export const RECORDED_EVENT_TYPES = {
  CLICK: 'click' as const,
  INPUT: 'input' as const,
  CHANGE: 'change' as const,
  ENTER: 'enter' as const,
  SELECT: 'select' as const,
  FOCUS: 'focus' as const,
  BLUR: 'blur' as const,
  SUBMIT: 'submit' as const,
  NAVIGATION: 'navigation' as const,
  AUTOCOMPLETE_INPUT: 'autocomplete_input' as const,
  AUTOCOMPLETE_SELECTION: 'autocomplete_selection' as const,
} as const;

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
  resetEventRecorder();
  resetIframeManager();
  resetShadowDOMHandler();
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

import { resetEventRecorder } from './EventRecorder';
import { resetIframeManager } from './IframeManager';
import { resetShadowDOMHandler } from './ShadowDOMHandler';
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
