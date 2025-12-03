/**
 * Background Service Module - Barrel Export
 * @module core/background
 * @version 1.0.0
 * 
 * Provides background service worker functionality including message routing,
 * tab management, script injection, and storage coordination.
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   createMessageRouter,
 *   createBackgroundTabManager,
 *   registerHandlers,
 * } from '@/core/background';
 * 
 * // Create router and register handlers
 * const router = createMessageRouter();
 * registerHandlers(router, {
 *   'get_all_projects': async () => {
 *     const projects = await db.getAllProjects();
 *     return { success: true, projects };
 *   },
 * });
 * 
 * // Create tab manager
 * const tabManager = createBackgroundTabManager();
 * 
 * // Wire up Chrome listener
 * chrome.runtime.onMessage.addListener(router.createChromeHandler());
 * ```
 * 
 * ## Module Structure
 * - **IBackgroundService**: Main service interface
 * - **IMessageRouter**: Message routing contract
 * - **IBackgroundTabManager**: Tab management contract
 * - **MessageRouter**: Route messages to handlers
 * - **BackgroundTabManager**: Manage browser tabs
 */

// ============================================================================
// INTERFACES & TYPES (IBackgroundService)
// ============================================================================

export type {
  // Message types
  BackgroundMessage,
  BackgroundResponse,
  MessageSender,
  
  // Action types
  StorageAction,
  TabAction,
  RecordingAction,
  ReplayAction,
  KnownAction,
  
  // Specific message types
  AddProjectMessage,
  AddProjectResponse,
  GetAllProjectsResponse,
  GetProjectByIdMessage,
  GetProjectByIdResponse,
  UpdateProjectStepsMessage,
  OpenTabMessage,
  OpenTabResponse,
  CreateTestRunMessage,
  CreateTestRunResponse,
  UpdateTestRunMessage,
  GetTestRunsResponse,
  
  // Handler types
  MessageHandler,
  AsyncMessageHandler,
  
  // Interface types
  IMessageRouter,
  TrackedTab,
  IBackgroundTabManager,
  IStorageCoordinator,
  InstallReason,
  LifecycleEvent,
  ILifecycleManager,
  BackgroundServiceState,
  IBackgroundService,
  BackgroundServiceFactory,
} from './IBackgroundService';

// ============================================================================
// CONSTANTS (IBackgroundService)
// ============================================================================

export {
  ACTION_CATEGORIES,
  isStorageAction,
  isTabAction,
  isRecordingAction,
  isReplayAction,
  getActionCategory,
  createSuccessResponse,
  createErrorResponse,
} from './IBackgroundService';

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

export {
  // Types
  type MessageMiddleware,
  type MessageRouterConfig,
  
  // Constants
  DEFAULT_ROUTER_CONFIG,
  
  // Class
  MessageRouter,
  
  // Factory functions
  createMessageRouter,
  createDebugRouter,
  
  // Singleton
  getMessageRouter,
  resetMessageRouter,
  
  // Helper functions
  registerHandlers,
  createLoggingMiddleware,
  createErrorRecoveryMiddleware,
  createRateLimitMiddleware,
} from './MessageRouter';

// ============================================================================
// BACKGROUND TAB MANAGER
// ============================================================================

export {
  // Types
  type BackgroundTabManagerConfig,
  type TabOpenResult,
  
  // Constants
  DEFAULT_TAB_MANAGER_CONFIG,
  
  // Class
  BackgroundTabManager,
  
  // Factory functions
  createBackgroundTabManager,
  
  // Singleton
  getBackgroundTabManager,
  resetBackgroundTabManager,
  
  // Mock for testing
  MockBackgroundTabManager,
  createMockBackgroundTabManager,
} from './BackgroundTabManager';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * All storage action names
 */
export const STORAGE_ACTIONS: readonly string[] = [
  'add_project',
  'update_project',
  'get_all_projects',
  'delete_project',
  'get_project_by_id',
  'update_project_steps',
  'update_project_fields',
  'update_project_csv',
  'createTestRun',
  'updateTestRun',
  'getTestRunsByProject',
] as const;

/**
 * All tab action names
 */
export const TAB_ACTIONS: readonly string[] = [
  'openTab',
  'close_opened_tab',
  'open_project_url_and_inject',
  'injectScript',
  'openDashBoard',
] as const;

/**
 * All recording action names
 */
export const RECORDING_ACTIONS: readonly string[] = [
  'start_recording',
  'stop_recording',
  'logEvent',
] as const;

/**
 * All replay action names
 */
export const REPLAY_ACTIONS: readonly string[] = [
  'start_replay',
  'stop_replay',
  'step_result',
] as const;

/**
 * All known action names
 */
export const ALL_ACTIONS: readonly string[] = [
  ...STORAGE_ACTIONS,
  ...TAB_ACTIONS,
  ...RECORDING_ACTIONS,
  ...REPLAY_ACTIONS,
] as const;

/**
 * Default configuration values
 */
export const BACKGROUND_DEFAULTS = {
  /** Handler timeout in ms */
  HANDLER_TIMEOUT: 30000,
  
  /** Tab operation timeout in ms */
  TAB_TIMEOUT: 30000,
  
  /** Script injection delay in ms */
  INJECTION_DELAY: 100,
  
  /** Default content script path */
  DEFAULT_SCRIPT: 'js/main.js',
  
  /** Inject into all frames */
  ALL_FRAMES: true,
  
  /** Re-inject on navigation */
  REINJECT_ON_NAV: true,
} as const;

/**
 * Action category display names
 */
export const ACTION_CATEGORY_NAMES: Record<string, string> = {
  storage: 'Storage Operations',
  tab: 'Tab Management',
  recording: 'Recording',
  replay: 'Replay',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if action is known
 */
export function isKnownAction(action: string): boolean {
  return ALL_ACTIONS.includes(action);
}

/**
 * Get action display name
 */
export function getActionDisplayName(action: string): string {
  // Convert snake_case or camelCase to Title Case
  return action
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s+/, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Create a typed message
 */
export function createMessage<T extends Record<string, unknown>>(
  action: string,
  data?: T
): BackgroundMessage & T {
  return {
    action,
    ...data,
  } as BackgroundMessage & T;
}

/**
 * Validate message structure
 */
export function isValidMessage(message: unknown): message is BackgroundMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'action' in message &&
    typeof (message as BackgroundMessage).action === 'string'
  );
}

/**
 * Validate response structure
 */
export function isValidResponse(response: unknown): response is BackgroundResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    typeof (response as BackgroundResponse).success === 'boolean'
  );
}

/**
 * Create handler map from object
 */
export function createHandlerMap(
  handlers: Record<string, MessageHandler>
): Map<string, MessageHandler> {
  return new Map(Object.entries(handlers));
}

// ============================================================================
// TYPE IMPORTS FOR RE-EXPORT
// ============================================================================

// Re-export BackgroundMessage and BackgroundResponse as types for convenience
import type { BackgroundMessage, BackgroundResponse, MessageHandler } from './IBackgroundService';
