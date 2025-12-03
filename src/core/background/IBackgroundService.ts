/**
 * IBackgroundService - Background Service Worker Interface
 * @module core/background/IBackgroundService
 * @version 1.0.0
 * 
 * Defines the contract for the Manifest V3 service worker that provides
 * message routing, tab management, script injection, and storage coordination.
 * 
 * ## Service Worker Responsibilities
 * 1. Message Routing: Direct chrome.runtime messages to handlers
 * 2. Tab Management: Open, close, track browser tabs
 * 3. Script Injection: Inject content scripts into pages
 * 4. Storage Coordination: Route IndexedDB operations
 * 5. Lifecycle Management: Handle install/update events
 * 
 * ## Message Protocol
 * - All messages have `action` field (string)
 * - Responses have `success` field (boolean)
 * - Async handlers must `return true` to keep channel open
 * 
 * @example
 * ```typescript
 * // Register handler
 * router.register('add_project', async (message, sender) => {
 *   const id = await storage.addProject(message.payload);
 *   return { success: true, id };
 * });
 * 
 * // Send message from UI
 * const response = await chrome.runtime.sendMessage({
 *   action: 'add_project',
 *   payload: { name: 'Test', target_url: 'https://...' }
 * });
 * ```
 */

import type { Project } from '../types/project';
import type { TestRun } from '../types/test-run';

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Base message structure
 */
export interface BackgroundMessage {
  /** Action identifier */
  action: string;
  
  /** Optional payload data */
  payload?: unknown;
  
  /** Additional properties */
  [key: string]: unknown;
}

/**
 * Base response structure
 */
export interface BackgroundResponse {
  /** Whether operation succeeded */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional response data */
  [key: string]: unknown;
}

/**
 * Message sender information
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
  
  /** Extension ID */
  id?: string;
  
  /** URL of the sending context */
  url?: string;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * Storage action types
 */
export type StorageAction =
  | 'add_project'
  | 'update_project'
  | 'get_all_projects'
  | 'delete_project'
  | 'get_project_by_id'
  | 'update_project_steps'
  | 'update_project_fields'
  | 'update_project_csv'
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
  | 'injectScript'
  | 'openDashBoard';

/**
 * Recording action types
 */
export type RecordingAction =
  | 'start_recording'
  | 'stop_recording'
  | 'logEvent';

/**
 * Replay action types
 */
export type ReplayAction =
  | 'start_replay'
  | 'stop_replay'
  | 'step_result';

/**
 * All known action types
 */
export type KnownAction = 
  | StorageAction 
  | TabAction 
  | RecordingAction 
  | ReplayAction;

/**
 * Action categories for routing
 */
export const ACTION_CATEGORIES: Record<string, KnownAction[]> = {
  storage: [
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
  ],
  tab: [
    'openTab',
    'close_opened_tab',
    'open_project_url_and_inject',
    'injectScript',
    'openDashBoard',
  ],
  recording: [
    'start_recording',
    'stop_recording',
    'logEvent',
  ],
  replay: [
    'start_replay',
    'stop_replay',
    'step_result',
  ],
};

// ============================================================================
// SPECIFIC MESSAGE TYPES
// ============================================================================

/**
 * Add project message
 */
export interface AddProjectMessage extends BackgroundMessage {
  action: 'add_project';
  payload: {
    name: string;
    description?: string;
    target_url: string;
    status?: string;
  };
}

/**
 * Add project response
 */
export interface AddProjectResponse extends BackgroundResponse {
  id?: number;
}

/**
 * Get all projects response
 */
export interface GetAllProjectsResponse extends BackgroundResponse {
  projects?: Project[];
}

/**
 * Get project by ID message
 */
export interface GetProjectByIdMessage extends BackgroundMessage {
  action: 'get_project_by_id';
  id: number;
}

/**
 * Get project by ID response
 */
export interface GetProjectByIdResponse extends BackgroundResponse {
  project?: Project;
}

/**
 * Update project steps message
 */
export interface UpdateProjectStepsMessage extends BackgroundMessage {
  action: 'update_project_steps';
  payload: {
    id: number;
    recorded_steps: unknown[];
  };
}

/**
 * Open tab message
 */
export interface OpenTabMessage extends BackgroundMessage {
  action: 'openTab';
  url: string;
}

/**
 * Open tab response
 */
export interface OpenTabResponse extends BackgroundResponse {
  tabId?: number;
}

/**
 * Create test run message
 */
export interface CreateTestRunMessage extends BackgroundMessage {
  action: 'createTestRun';
  testRun: Partial<TestRun>;
}

/**
 * Create test run response
 */
export interface CreateTestRunResponse extends BackgroundResponse {
  id?: number;
}

/**
 * Update test run message
 */
export interface UpdateTestRunMessage extends BackgroundMessage {
  action: 'updateTestRun';
  id: number;
  updates: Partial<TestRun>;
}

/**
 * Get test runs response
 */
export interface GetTestRunsResponse extends BackgroundResponse {
  testRuns?: TestRun[];
}

// ============================================================================
// HANDLER TYPES
// ============================================================================

/**
 * Message handler function type
 */
export type MessageHandler<
  TMessage extends BackgroundMessage = BackgroundMessage,
  TResponse extends BackgroundResponse = BackgroundResponse
> = (
  message: TMessage,
  sender: MessageSender
) => Promise<TResponse> | TResponse;

/**
 * Async message handler that returns true to keep channel open
 */
export type AsyncMessageHandler = (
  message: BackgroundMessage,
  sender: MessageSender,
  sendResponse: (response: BackgroundResponse) => void
) => boolean;

// ============================================================================
// MESSAGE ROUTER INTERFACE
// ============================================================================

/**
 * Message router for handling background messages
 */
export interface IMessageRouter {
  /**
   * Register a handler for an action
   */
  register<TMessage extends BackgroundMessage, TResponse extends BackgroundResponse>(
    action: string,
    handler: MessageHandler<TMessage, TResponse>
  ): void;
  
  /**
   * Unregister a handler
   */
  unregister(action: string): void;
  
  /**
   * Check if handler exists for action
   */
  hasHandler(action: string): boolean;
  
  /**
   * Route a message to its handler
   */
  route(
    message: BackgroundMessage,
    sender: MessageSender
  ): Promise<BackgroundResponse>;
  
  /**
   * Get all registered actions
   */
  getRegisteredActions(): string[];
}

// ============================================================================
// TAB MANAGER INTERFACE
// ============================================================================

/**
 * Tab state information
 */
export interface TrackedTab {
  /** Tab ID */
  tabId: number;
  
  /** Tab URL */
  url: string;
  
  /** Associated project ID (if any) */
  projectId?: number;
  
  /** Whether content script is injected */
  scriptInjected: boolean;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Tab manager for background service
 */
export interface IBackgroundTabManager {
  /**
   * Open a new tab
   */
  openTab(url: string, projectId?: number): Promise<{ success: boolean; tabId?: number; error?: string }>;
  
  /**
   * Close a tab
   */
  closeTab(tabId: number): Promise<boolean>;
  
  /**
   * Close the last opened tab
   */
  closeOpenedTab(): Promise<boolean>;
  
  /**
   * Inject content script into tab
   */
  injectScript(tabId: number, scriptPath?: string): Promise<boolean>;
  
  /**
   * Track a tab
   */
  trackTab(tabId: number, projectId?: number): void;
  
  /**
   * Untrack a tab
   */
  untrackTab(tabId: number): void;
  
  /**
   * Check if tab is tracked
   */
  isTracked(tabId: number): boolean;
  
  /**
   * Get tracked tab info
   */
  getTrackedTab(tabId: number): TrackedTab | null;
  
  /**
   * Get all tracked tabs
   */
  getTrackedTabs(): TrackedTab[];
  
  /**
   * Get last opened tab ID
   */
  getOpenedTabId(): number | null;
  
  /**
   * Send message to tab
   */
  sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T>;
}

// ============================================================================
// STORAGE COORDINATOR INTERFACE
// ============================================================================

/**
 * Storage coordinator for background service
 */
export interface IStorageCoordinator {
  // Projects
  addProject(payload: AddProjectMessage['payload']): Promise<number>;
  updateProject(id: number, updates: Partial<Project>): Promise<void>;
  getProject(id: number): Promise<Project | null>;
  getAllProjects(): Promise<Project[]>;
  deleteProject(id: number): Promise<void>;
  updateProjectSteps(id: number, steps: unknown[]): Promise<void>;
  updateProjectFields(id: number, fields: unknown[]): Promise<void>;
  updateProjectCsv(id: number, csvData: unknown[]): Promise<void>;
  
  // Test Runs
  createTestRun(testRun: Partial<TestRun>): Promise<number>;
  updateTestRun(id: number, updates: Partial<TestRun>): Promise<void>;
  getTestRunsByProject(projectId: number): Promise<TestRun[]>;
}

// ============================================================================
// LIFECYCLE MANAGER INTERFACE
// ============================================================================

/**
 * Install reason
 */
export type InstallReason = 'install' | 'update' | 'chrome_update' | 'shared_module_update';

/**
 * Lifecycle event data
 */
export interface LifecycleEvent {
  reason: InstallReason;
  previousVersion?: string;
}

/**
 * Lifecycle manager for extension events
 */
export interface ILifecycleManager {
  /**
   * Handle extension installation
   */
  onInstalled(details: LifecycleEvent): Promise<void>;
  
  /**
   * Handle extension icon click
   */
  onIconClicked(): Promise<void>;
  
  /**
   * Ensure persistent storage
   */
  ensurePersistentStorage(): Promise<boolean>;
  
  /**
   * Handle service worker startup
   */
  onStartup(): Promise<void>;
  
  /**
   * Handle service worker suspend
   */
  onSuspend(): Promise<void>;
}

// ============================================================================
// MAIN BACKGROUND SERVICE INTERFACE
// ============================================================================

/**
 * Background service state
 */
export interface BackgroundServiceState {
  /** Whether service is initialized */
  initialized: boolean;
  
  /** Currently recording project ID */
  recordingProjectId: number | null;
  
  /** Whether recording is active */
  isRecording: boolean;
  
  /** Currently replaying project ID */
  replayingProjectId: number | null;
  
  /** Whether replay is active */
  isReplaying: boolean;
  
  /** Number of tracked tabs */
  trackedTabCount: number;
  
  /** Last opened tab ID */
  openedTabId: number | null;
}

/**
 * Main background service interface
 */
export interface IBackgroundService {
  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  
  /**
   * Initialize the background service
   */
  initialize(): Promise<void>;
  
  /**
   * Shutdown the background service
   */
  shutdown(): Promise<void>;
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean;
  
  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================
  
  /**
   * Get the message router
   */
  getRouter(): IMessageRouter;
  
  /**
   * Handle incoming message (for chrome.runtime.onMessage)
   */
  handleMessage(
    message: BackgroundMessage,
    sender: MessageSender,
    sendResponse: (response: BackgroundResponse) => void
  ): boolean;
  
  // ==========================================================================
  // TAB MANAGEMENT
  // ==========================================================================
  
  /**
   * Get the tab manager
   */
  getTabManager(): IBackgroundTabManager;
  
  // ==========================================================================
  // STORAGE
  // ==========================================================================
  
  /**
   * Get the storage coordinator
   */
  getStorage(): IStorageCoordinator;
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  /**
   * Get the lifecycle manager
   */
  getLifecycle(): ILifecycleManager;
  
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  /**
   * Get current service state
   */
  getState(): BackgroundServiceState;
  
  /**
   * Set recording state
   */
  setRecording(projectId: number | null): void;
  
  /**
   * Set replay state
   */
  setReplaying(projectId: number | null): void;
}

// ============================================================================
// FACTORY TYPE
// ============================================================================

/**
 * Factory for creating background service
 */
export type BackgroundServiceFactory = (
  storage: IStorageCoordinator
) => IBackgroundService;

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Check if action is a storage action
 */
export function isStorageAction(action: string): action is StorageAction {
  return ACTION_CATEGORIES.storage.includes(action as StorageAction);
}

/**
 * Check if action is a tab action
 */
export function isTabAction(action: string): action is TabAction {
  return ACTION_CATEGORIES.tab.includes(action as TabAction);
}

/**
 * Check if action is a recording action
 */
export function isRecordingAction(action: string): action is RecordingAction {
  return ACTION_CATEGORIES.recording.includes(action as RecordingAction);
}

/**
 * Check if action is a replay action
 */
export function isReplayAction(action: string): action is ReplayAction {
  return ACTION_CATEGORIES.replay.includes(action as ReplayAction);
}

/**
 * Get action category
 */
export function getActionCategory(action: string): string | null {
  for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
    if (actions.includes(action as KnownAction)) {
      return category;
    }
  }
  return null;
}

/**
 * Create success response
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
  data?: T
): BackgroundResponse & T {
  return {
    success: true,
    ...data,
  } as BackgroundResponse & T;
}

/**
 * Create error response
 */
export function createErrorResponse(error: string | Error): BackgroundResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : error,
  };
}
