/**
 * IBackgroundService - Interface definitions for Background Service
 * @module background/IBackgroundService
 * @version 1.0.0
 * 
 * Defines contracts for the Manifest V3 service worker including:
 * - Message routing and handling
 * - Tab management (open, close, track)
 * - Script injection
 * - Storage coordination
 * - Extension lifecycle events
 * 
 * @see background-service_breakdown.md for architecture details
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Base message structure for all background service messages
 */
export interface BackgroundMessage {
  /** Action identifier */
  action: string;
  /** Message payload */
  payload?: unknown;
  /** Optional request ID for correlation */
  requestId?: string;
}

/**
 * Message sender information (from chrome.runtime.MessageSender)
 */
export interface MessageSender {
  /** Tab that sent the message */
  tab?: {
    id?: number;
    url?: string;
    title?: string;
  };
  /** Frame ID within tab */
  frameId?: number;
  /** Extension ID of sender */
  id?: string;
  /** URL of sender */
  url?: string;
  /** Origin of sender */
  origin?: string;
}

/**
 * Standard response structure
 */
export interface BackgroundResponse {
  /** Whether operation succeeded */
  success: boolean;
  /** Result data (if success) */
  data?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Created resource ID (for create operations) */
  id?: number;
  /** Tab ID (for tab operations) */
  tabId?: number;
}

/**
 * Message handler function signature
 */
export type MessageHandler = (
  message: BackgroundMessage,
  sender: MessageSender
) => Promise<BackgroundResponse> | BackgroundResponse;

/**
 * Synchronous message handler (for backwards compatibility)
 */
export type SyncMessageHandler = (
  message: BackgroundMessage,
  sender: MessageSender,
  sendResponse: (response: BackgroundResponse) => void
) => boolean | void;

// ============================================================================
// TAB MANAGEMENT TYPES
// ============================================================================

/**
 * Tab state information
 */
export interface TabState {
  /** Tab ID */
  tabId: number;
  /** Tab URL */
  url: string;
  /** Whether content script is injected */
  injected: boolean;
  /** Associated project ID */
  projectId?: number;
  /** When tab was opened */
  openedAt: Date;
  /** Last injection time */
  lastInjected?: Date;
  /** Tab status */
  status: TabStatus;
}

/**
 * Tab status
 */
export type TabStatus = 
  | 'loading'
  | 'complete'
  | 'injecting'
  | 'ready'
  | 'error'
  | 'closed';

/**
 * Tab open options
 */
export interface TabOpenOptions {
  /** URL to open */
  url: string;
  /** Whether to make tab active */
  active?: boolean;
  /** Associate with project */
  projectId?: number;
  /** Auto-inject content script */
  autoInject?: boolean;
}

/**
 * Tab open result
 */
export interface TabOpenResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Tab ID if successful */
  tabId?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Tab ID to inject into */
  tabId: number;
  /** Inject into all frames */
  allFrames?: boolean;
  /** Script files to inject */
  files?: string[];
  /** Inline code to execute */
  code?: string;
  /** World to inject into */
  world?: 'MAIN' | 'ISOLATED';
}

/**
 * Injection result
 */
export interface InjectionResult {
  /** Whether injection succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Frame results */
  frameResults?: Array<{
    frameId: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Tab event types
 */
export type TabEventType =
  | 'tab_opened'
  | 'tab_closed'
  | 'tab_updated'
  | 'tab_navigated'
  | 'injection_started'
  | 'injection_completed'
  | 'injection_failed';

/**
 * Tab event
 */
export interface TabEvent {
  type: TabEventType;
  tabId: number;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Tab event listener
 */
export type TabEventListener = (event: TabEvent) => void;

// ============================================================================
// MESSAGE ROUTING TYPES
// ============================================================================

/**
 * Action categories for organization
 */
export type ActionCategory =
  | 'project'    // Project CRUD operations
  | 'testrun'    // Test run operations
  | 'tab'        // Tab management
  | 'injection'  // Script injection
  | 'recording'  // Recording control
  | 'replay'     // Replay control
  | 'system';    // System operations

/**
 * Registered handler info
 */
export interface RegisteredHandler {
  /** Action name */
  action: string;
  /** Category */
  category: ActionCategory;
  /** Handler function */
  handler: MessageHandler;
  /** Description */
  description?: string;
}

/**
 * Route result
 */
export interface RouteResult {
  /** Whether message was handled */
  handled: boolean;
  /** Response if handled */
  response?: BackgroundResponse;
  /** Handler that processed message */
  handler?: string;
  /** Processing duration (ms) */
  duration?: number;
}

// ============================================================================
// STORAGE COORDINATION TYPES
// ============================================================================

/**
 * Storage action types
 */
export type StorageAction =
  // Project operations
  | 'add_project'
  | 'update_project'
  | 'get_all_projects'
  | 'delete_project'
  | 'get_project_by_id'
  | 'update_project_steps'
  | 'update_project_fields'
  | 'update_project_csv'
  // Test run operations
  | 'createTestRun'
  | 'updateTestRun'
  | 'getTestRunsByProject';

/**
 * Tab action types
 */
export type TabAction =
  | 'openTab'
  | 'close_opened_tab'
  | 'open_project_url_and_inject'
  | 'openDashBoard'
  | 'injectScript'
  | 'getTabStatus';

/**
 * All supported actions
 */
export type BackgroundAction = StorageAction | TabAction | string;

// ============================================================================
// LIFECYCLE TYPES
// ============================================================================

/**
 * Extension lifecycle events
 */
export type LifecycleEvent =
  | 'installed'
  | 'updated'
  | 'enabled'
  | 'disabled'
  | 'startup'
  | 'suspend';

/**
 * Install details
 */
export interface InstallDetails {
  /** Reason for event */
  reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update';
  /** Previous version (if update) */
  previousVersion?: string;
}

/**
 * Lifecycle event listener
 */
export type LifecycleEventListener = (
  event: LifecycleEvent,
  details?: InstallDetails
) => void;

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Message Router interface
 * Routes incoming messages to appropriate handlers
 */
export interface IMessageRouter {
  /**
   * Register a message handler
   * @param action - Action name to handle
   * @param handler - Handler function
   * @param category - Optional category for organization
   */
  register(
    action: string,
    handler: MessageHandler,
    category?: ActionCategory
  ): void;

  /**
   * Unregister a handler
   * @param action - Action to unregister
   */
  unregister(action: string): void;

  /**
   * Route a message to its handler
   * @param message - Message to route
   * @param sender - Message sender info
   * @returns Route result with response
   */
  route(
    message: BackgroundMessage,
    sender: MessageSender
  ): Promise<RouteResult>;

  /**
   * Check if action has a handler
   * @param action - Action to check
   */
  hasHandler(action: string): boolean;

  /**
   * Get all registered handlers
   */
  getHandlers(): RegisteredHandler[];

  /**
   * Get handlers by category
   * @param category - Category to filter by
   */
  getHandlersByCategory(category: ActionCategory): RegisteredHandler[];
}

/**
 * Tab Manager interface
 * Manages browser tabs for automation
 */
export interface ITabManager {
  /**
   * Open a new tab
   * @param options - Tab open options
   * @returns Result with tab ID
   */
  open(options: TabOpenOptions): Promise<TabOpenResult>;

  /**
   * Close a tab
   * @param tabId - Tab ID to close
   */
  close(tabId: number): Promise<void>;

  /**
   * Inject script into tab
   * @param options - Injection options
   * @returns Injection result
   */
  inject(options: InjectionOptions): Promise<InjectionResult>;

  /**
   * Track a tab for re-injection on navigation
   * @param tabId - Tab ID to track
   * @param projectId - Optional project association
   */
  track(tabId: number, projectId?: number): void;

  /**
   * Stop tracking a tab
   * @param tabId - Tab ID to untrack
   */
  untrack(tabId: number): void;

  /**
   * Check if tab is tracked
   * @param tabId - Tab ID to check
   */
  isTracked(tabId: number): boolean;

  /**
   * Get tab state
   * @param tabId - Tab ID
   */
  getTabState(tabId: number): TabState | undefined;

  /**
   * Get all tracked tabs
   */
  getTrackedTabs(): TabState[];

  /**
   * Get tab by project ID
   * @param projectId - Project ID
   */
  getTabByProject(projectId: number): TabState | undefined;

  /**
   * Re-inject scripts into all tracked tabs
   */
  reinjectAll(): Promise<void>;

  /**
   * Subscribe to tab events
   * @param listener - Event listener
   * @returns Unsubscribe function
   */
  onEvent(listener: TabEventListener): () => void;
}

/**
 * Script Injector interface
 * Handles content script injection
 */
export interface IScriptInjector {
  /**
   * Inject main content script
   * @param tabId - Tab ID
   * @param allFrames - Inject into all frames
   */
  injectMain(tabId: number, allFrames?: boolean): Promise<InjectionResult>;

  /**
   * Inject custom script files
   * @param tabId - Tab ID
   * @param files - Script file paths
   * @param allFrames - Inject into all frames
   */
  injectFiles(
    tabId: number,
    files: string[],
    allFrames?: boolean
  ): Promise<InjectionResult>;

  /**
   * Execute inline code
   * @param tabId - Tab ID
   * @param code - Code to execute
   * @param world - Execution world
   */
  executeCode(
    tabId: number,
    code: string,
    world?: 'MAIN' | 'ISOLATED'
  ): Promise<InjectionResult>;

  /**
   * Check if tab has script injected
   * @param tabId - Tab ID
   */
  isInjected(tabId: number): boolean;

  /**
   * Mark tab as needing re-injection
   * @param tabId - Tab ID
   */
  markForReinjection(tabId: number): void;
}

/**
 * Background State interface
 * Persists state across service worker restarts
 */
export interface IBackgroundState {
  /**
   * Save state value
   * @param key - State key
   * @param value - Value to save
   */
  save<T>(key: string, value: T): Promise<void>;

  /**
   * Load state value
   * @param key - State key
   * @returns Saved value or undefined
   */
  load<T>(key: string): Promise<T | undefined>;

  /**
   * Delete state value
   * @param key - State key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all state
   */
  clear(): Promise<void>;

  /**
   * Restore all persisted state
   * Called on service worker startup
   */
  restore(): Promise<void>;

  /**
   * Get all state keys
   */
  keys(): Promise<string[]>;
}

/**
 * Background Service interface
 * Main service worker coordinator
 */
export interface IBackgroundService {
  /**
   * Initialize the background service
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the background service
   */
  shutdown(): Promise<void>;

  /**
   * Get the message router
   */
  getRouter(): IMessageRouter;

  /**
   * Get the tab manager
   */
  getTabManager(): ITabManager;

  /**
   * Get the script injector
   */
  getScriptInjector(): IScriptInjector;

  /**
   * Get the state manager
   */
  getState(): IBackgroundState;

  /**
   * Subscribe to lifecycle events
   * @param listener - Event listener
   * @returns Unsubscribe function
   */
  onLifecycle(listener: LifecycleEventListener): () => void;

  /**
   * Check if service is ready
   */
  isReady(): boolean;

  /**
   * Keep service worker alive
   * Uses chrome.alarms for long-running operations
   */
  keepAlive(): void;

  /**
   * Allow service worker to suspend
   */
  allowSuspend(): void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type guard for BackgroundMessage
 */
export function isBackgroundMessage(obj: unknown): obj is BackgroundMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'action' in obj &&
    typeof (obj as BackgroundMessage).action === 'string'
  );
}

/**
 * Type guard for successful response
 */
export function isSuccessResponse(
  response: BackgroundResponse
): response is BackgroundResponse & { success: true } {
  return response.success === true;
}

/**
 * Type guard for error response
 */
export function isErrorResponse(
  response: BackgroundResponse
): response is BackgroundResponse & { success: false; error: string } {
  return response.success === false && typeof response.error === 'string';
}

/**
 * Create a success response
 */
export function createSuccessResponse(data?: unknown): BackgroundResponse {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function createErrorResponse(error: string): BackgroundResponse {
  return { success: false, error };
}

/**
 * Create a success response with ID
 */
export function createIdResponse(id: number): BackgroundResponse {
  return { success: true, id };
}

/**
 * Create a success response with tab ID
 */
export function createTabResponse(tabId: number): BackgroundResponse {
  return { success: true, tabId };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default main script path
 */
export const DEFAULT_MAIN_SCRIPT = 'js/main.js';

/**
 * Background state keys
 */
export const STATE_KEYS = {
  OPENED_TAB_ID: 'openedTabId',
  TRACKED_TABS: 'trackedTabs',
  ACTIVE_PROJECT: 'activeProject',
  RECORDING_STATE: 'recordingState',
} as const;

/**
 * Standard actions
 */
export const ACTIONS = {
  // Project
  ADD_PROJECT: 'add_project',
  UPDATE_PROJECT: 'update_project',
  GET_ALL_PROJECTS: 'get_all_projects',
  DELETE_PROJECT: 'delete_project',
  GET_PROJECT_BY_ID: 'get_project_by_id',
  UPDATE_PROJECT_STEPS: 'update_project_steps',
  UPDATE_PROJECT_FIELDS: 'update_project_fields',
  UPDATE_PROJECT_CSV: 'update_project_csv',
  
  // Test Run
  CREATE_TEST_RUN: 'createTestRun',
  UPDATE_TEST_RUN: 'updateTestRun',
  GET_TEST_RUNS_BY_PROJECT: 'getTestRunsByProject',
  
  // Tab
  OPEN_TAB: 'openTab',
  CLOSE_OPENED_TAB: 'close_opened_tab',
  OPEN_PROJECT_URL_AND_INJECT: 'open_project_url_and_inject',
  OPEN_DASHBOARD: 'openDashBoard',
  INJECT_SCRIPT: 'injectScript',
  GET_TAB_STATUS: 'getTabStatus',
} as const;
