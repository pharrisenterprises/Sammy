/**
 * Core Module - Master Barrel Export
 * @module core
 * @version 1.0.0
 * 
 * Unified export for all core functionality including data types,
 * storage layer, replay engine, test orchestrator, background service,
 * CSV processing, and content script infrastructure.
 * 
 * ## Module Overview
 * 
 * ### Types (`@/core/types`)
 * Data models: Step, Project, TestRun, ParsedField, LocatorBundle
 * 
 * ### Storage (`@/core/storage`)
 * IndexedDB persistence: Dexie schema, repositories, CRUD operations
 * 
 * ### Replay (`@/core/replay`)
 * Test execution: Element finding, action execution, step replay, sessions
 * 
 * ### Orchestrator (`@/core/orchestrator`)
 * Test coordination: Multi-row execution, tab management, progress tracking
 * 
 * ### Background (`@/core/background`)
 * Service worker: Message routing, tab lifecycle, script injection
 * 
 * ### CSV (`@/core/csv`)
 * Data import: CSV/Excel parsing, field mapping, validation
 * 
 * ### Content (`@/core/content`)
 * Page automation: Recording, replay, cross-context messaging, notifications
 * 
 * ### UI (`@/core/ui`)
 * Component contracts: Props, state, callbacks for React pages
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   // Types
 *   type Step, type Project,
 *   
 *   // Storage
 *   getStorageService,
 *   
 *   // Replay
 *   createReplayEngine,
 *   
 *   // Orchestrator
 *   createTestOrchestrator,
 *   
 *   // Background
 *   createMessageRouter,
 *   
 *   // CSV
 *   createCSVProcessingService,
 *   
 *   // Content
 *   createContextBridge,
 *   createNotificationUI,
 *   
 *   // UI
 *   createUIStateManager,
 * } from '@/core';
 * ```
 */

// ============================================================================
// TYPES MODULE
// ============================================================================

// Re-export all types module exports
export * from './types';

// ============================================================================
// IMPORTS FOR RESET FUNCTION
// ============================================================================

import {
  resetMemoryStorage,
  resetChromeStorage,
  resetIndexedDBStorage,
  resetStorageManager,
} from './storage';

import {
  resetElementFinder,
  resetActionExecutor,
  resetStepExecutor,
} from './replay';

import { resetTabManager } from './orchestrator';

import {
  resetMessageRouter,
  resetBackgroundTabManager,
} from './background';

import { resetAllCSVSingletons } from './csv';

import { resetAllContentSingletons } from './content';

import { resetAllUISingletons } from './ui';

// ============================================================================
// STORAGE MODULE
// ============================================================================

// Re-export all storage module exports
export * from './storage';

// ============================================================================
// REPLAY MODULE
// ============================================================================

// Note: Some exports conflict with types module (StepExecutionResult, formatDuration, formatEta, LogLevel)
// Import directly from '@/core/replay' or '@/core/types' when needed
export * from './replay';

// ============================================================================
// ORCHESTRATOR MODULE
// ============================================================================

// Note: DEFAULT_TAB_MANAGER_CONFIG conflicts with background module
// Import directly from '@/core/orchestrator' or '@/core/background' when needed
export * from './orchestrator';

// ============================================================================
// BACKGROUND MODULE
// ============================================================================

// Note: DEFAULT_TAB_MANAGER_CONFIG conflicts with orchestrator module
// Import directly from '@/core/background' when needed
export * from './background';

// ============================================================================
// CSV MODULE
// ============================================================================

// Note: ValidationResult, ValidationError, ValidationWarning conflict with other modules
// These are re-exported with CSV prefix: CSVValidationResult, CSVValidationError, CSVValidationWarning
export * from './csv';

// ============================================================================
// CONTENT MODULE
// ============================================================================

export {
  // Mode types
  type ContentScriptMode,
  type ContentScriptState,
  type RecordingState,
  type ReplayState,
  
  // Event types
  type RecordedEventType,
  type RecordedEvent,
  type IframeInfo,
  
  // Message types
  type ContentToExtensionMessage,
  type ExtensionToContentMessage,
  type PageContextMessage,
  type StepExecutionRequest,
  type StepExecutionResponse,
  
  // Notification types
  type NotificationType,
  type NotificationConfig,
  
  // Handler types
  type RecordedEventHandler,
  type ModeChangeHandler,
  type ContentErrorHandler,
  
  // Interfaces
  type IEventRecorder,
  type IStepReplayer,
  type IIframeManager,
  type IShadowDOMHandler,
  type IContextBridge,
  type INotificationUI,
  type IContentScript,
  type ContentScriptFactory,
  
  // Constants (IContentScript)
  DEFAULT_STEP_TIMEOUT,
  DEFAULT_NOTIFICATION_DURATION,
  PAGE_SCRIPT_SOURCE,
  CONTENT_SCRIPT_SOURCE,
  INPUT_EVENT_TYPES,
  CLICK_EVENT_TYPES,
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
  
  // EventRecorder
  type EventRecorderConfig,
  DEFAULT_RECORDER_CONFIG,
  EventRecorder,
  createEventRecorder,
  createDebugRecorder,
  createFullRecorder,
  getEventRecorder,
  resetEventRecorder,
  generateXPath,
  getElementLabel,
  getElementValue,
  buildLocatorBundle,
  getEventTarget,
  determineEventType,
  
  // IframeManager
  type IframeManagerConfig,
  DEFAULT_IFRAME_MANAGER_CONFIG,
  IframeManager,
  createIframeManager,
  createDebugIframeManager,
  createManualIframeManager,
  getIframeManager,
  resetIframeManager,
  isCrossOriginIframe,
  getIframeDocument,
  createIframeInfo,
  findIframesInDocument,
  
  // ContextBridge
  type ExtensionMessageHandler,
  type PageMessageHandler,
  type ContextBridgeConfig,
  DEFAULT_BRIDGE_CONFIG,
  ContextBridge,
  createContextBridge,
  createInitializedBridge,
  createDebugBridge,
  getContextBridge,
  resetContextBridge,
  MockContextBridge,
  createMockContextBridge,
  
  // NotificationUI
  type NotificationUIConfig,
  DEFAULT_UI_CONFIG,
  NOTIFICATION_COLORS,
  NOTIFICATION_ICONS,
  NotificationUI,
  createNotificationUI,
  createPositionedNotificationUI,
  createSimpleNotificationUI,
  getNotificationUI,
  resetNotificationUI,
  MockNotificationUI,
  createMockNotificationUI,
  
  // Content convenience exports
  CONTENT_VERSION,
  CONTENT_DEFAULTS,
  MESSAGE_TYPES,
  NOTIFICATION_TYPES,
  RECORDED_EVENT_TYPES,
  isContentScriptContext,
  isPageContext,
  getCurrentPageUrl,
  getCurrentPageOrigin,
  formatStepProgress,
  formatRowProgress,
  formatReplayProgress,
  createTimeoutError,
  createElementNotFoundError,
  resetAllContentSingletons,
  isContentToExtensionMessage,
  isExtensionToContentMessage,
  isPageContextMessage,
  isValidRecordedEventType,
} from './content';

// ============================================================================
// UI MODULE
// ============================================================================

export {
  // Shared types
  type LoadingState,
  type ErrorState,
  type PaginationState,
  type SortConfig,
  type FilterConfig,
  type LogLevel,
  type LogEntry,
  
  // Dashboard types
  type ProjectSummary,
  type DashboardStats,
  type CreateProjectData,
  type EditProjectData,
  type DashboardProps,
  
  // Recorder types
  type StepDisplayItem,
  type RecordingStatus,
  type RecorderState,
  type StepEditData,
  type RecorderProps,
  
  // Field Mapper types
  type CSVPreview,
  type FieldMappingItem,
  type MappingValidation,
  type FieldMapperState,
  type FieldMapperProps,
  
  // Test Runner types
  type TestExecutionStatus,
  type StepExecutionStatus,
  type StepResult,
  type RowResult,
  type TestProgress,
  type TestRunnerState,
  type TestRunnerProps,
  
  // Dialog types
  type ConfirmDialogProps,
  type AlertDialogProps,
  
  // UI State Manager types
  type Toast,
  type UIState,
  type StateChangeListener,
  type PartialUIState,
  type UIStateManagerConfig,
  type StateSelector,
  
  // Constants
  DEFAULT_PAGE_SIZE,
  DEFAULT_LOG_LIMIT,
  STATUS_COLORS,
  STATUS_LABELS,
  LOG_LEVEL_COLORS,
  LOG_LEVEL_ICONS,
  DEFAULT_STATE_MANAGER_CONFIG,
  UI_VERSION,
  UI_DEFAULTS,
  RECORDING_STATUSES,
  TEST_EXECUTION_STATUSES,
  STEP_EXECUTION_STATUSES,
  
  // Helper functions (IUIComponents)
  createEmptyLoadingState,
  createLoadingState,
  createEmptyErrorState,
  createErrorState,
  createLogEntry,
  createInitialTestProgress,
  createProjectSummary,
  calculateDashboardStats,
  formatDuration as formatUIDuration,
  formatTimestamp,
  formatRelativeTime,
  
  // UIStateManager
  createInitialUIState,
  UIStateManager,
  createUIStateManager,
  createLimitedLogManager,
  createTransientManager,
  getUIStateManager,
  resetUIStateManager,
  selectors,
  
  // Utility functions
  isRecordingActive,
  canStartRecording,
  canStopRecording,
  isTestRunning,
  isTestTerminal,
  canStartTest,
  canStopTest,
  canPauseTest,
  canResumeTest,
  isStepPassed,
  isStepFailed,
  isStepPending,
  isStepComplete,
  calculateProgressPercentage,
  getStatusColor,
  getStatusLabel,
  formatProgressText,
  formatPassRate,
  getLogLevelColor,
  getLogLevelIcon,
  resetAllUISingletons,
} from './ui';

// ============================================================================
// MODULE VERSION
// ============================================================================

/**
 * Core module version
 */
export const CORE_VERSION = '1.0.0';

// ============================================================================
// CONVENIENCE AGGREGATES
// ============================================================================

/**
 * All default configurations
 */
export const ALL_DEFAULTS = {
  storage: {
    dbName: 'anthropic-auto-allow-db',
    dbVersion: 1,
  },
  replay: {
    findTimeout: 2000,
    retryInterval: 150,
    maxRetries: 13,
    fuzzyThreshold: 0.4,
    boundingBoxThreshold: 200,
  },
  orchestrator: {
    rowDelay: 1000,
    stepDelay: 0,
    humanDelay: [50, 300] as [number, number],
    stepTimeout: 30000,
  },
  background: {
    handlerTimeout: 30000,
    injectionDelay: 100,
  },
  csv: {
    similarityThreshold: 0.3,
    previewRowCount: 10,
    maxEmptyCellRatio: 0.5,
    minMappedFields: 1,
  },
  content: {
    stepTimeout: 30000,
    notificationDuration: 3000,
    animationDuration: 300,
    extensionTimeout: 30000,
    inputDebounce: 300,
    maxIframeDepth: 10,
  },
  ui: {
    pageSize: 10,
    logLimit: 500,
    toastDuration: 5000,
    maxToasts: 5,
  },
} as const;

/**
 * Reset all singletons (for testing)
 */
export function resetAllSingletons(): void {
  // Storage
  resetMemoryStorage();
  resetChromeStorage();
  resetIndexedDBStorage();
  resetStorageManager();
  
  // Replay
  resetElementFinder();
  resetActionExecutor();
  resetStepExecutor();
  
  // Orchestrator
  resetTabManager();
  
  // Background
  resetMessageRouter();
  resetBackgroundTabManager();
  
  // CSV
  resetAllCSVSingletons();
  
  // Content
  resetAllContentSingletons();
  
  // UI
  resetAllUISingletons();
}

/**
 * Note: To access individual module exports when there are naming conflicts,
 * import from the specific module instead:
 * 
 * @example
 * ```typescript
 * // For orchestrator tab manager
 * import { DEFAULT_TAB_MANAGER_CONFIG } from '@/core/orchestrator';
 * 
 * // For background tab manager  
 * import { DEFAULT_TAB_MANAGER_CONFIG } from '@/core/background';
 * 
 * // For types
 * import { StepExecutionResult } from '@/core/types';
 * 
 * // For replay
 * import { StepExecutionResult } from '@/core/replay';
 * ```
 */
