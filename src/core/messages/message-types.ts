/**
 * @fileoverview Message type definitions for Chrome extension messaging
 * @module core/messages/message-types
 * @version 1.0.0
 * 
 * This module defines the canonical message types for communication between
 * background script, content scripts, and popup/UI components.
 * 
 * CRITICAL: All action names use lowercase_snake_case convention:
 * - ✅ get_all_projects, add_project, update_project_steps
 * - ❌ getAllProjects, addProject, updateProjectSteps
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 2 for message action registry
 * @see message-bus_breakdown.md for messaging architecture
 */

import type { Project, Step, Field, TestRun } from '../types';

// ============================================================================
// MESSAGE ACTION CONSTANTS
// ============================================================================

/**
 * All valid message action names
 * 
 * CRITICAL: These are lowercase_snake_case, NOT camelCase
 * 
 * Categories:
 * - Project CRUD: get_all_projects, get_project, add_project, update_project, delete_project
 * - Step Management: update_project_steps, get_project_steps
 * - Field Mapping: update_project_fields, get_project_fields
 * - Test Execution: start_test_run, stop_test_run, get_test_run_status
 * - Recording: start_recording, stop_recording, get_recording_status
 * - CSV Operations: import_csv, export_csv, parse_csv
 * - Tab Management: get_active_tab, inject_content_script
 * - Storage: clear_storage, get_storage_stats
 */
export const MESSAGE_ACTIONS = {
  // Project CRUD
  GET_ALL_PROJECTS: 'get_all_projects',
  GET_PROJECT: 'get_project',
  ADD_PROJECT: 'add_project',
  UPDATE_PROJECT: 'update_project',
  DELETE_PROJECT: 'delete_project',
  
  // Step Management
  UPDATE_PROJECT_STEPS: 'update_project_steps',
  GET_PROJECT_STEPS: 'get_project_steps',
  ADD_STEP: 'add_step',
  UPDATE_STEP: 'update_step',
  DELETE_STEP: 'delete_step',
  REORDER_STEPS: 'reorder_steps',
  
  // Field Mapping
  UPDATE_PROJECT_FIELDS: 'update_project_fields',
  GET_PROJECT_FIELDS: 'get_project_fields',
  AUTO_MAP_FIELDS: 'auto_map_fields',
  
  // Test Execution
  START_TEST_RUN: 'start_test_run',
  STOP_TEST_RUN: 'stop_test_run',
  GET_TEST_RUN_STATUS: 'get_test_run_status',
  GET_TEST_RUN_LOGS: 'get_test_run_logs',
  
  // Recording
  START_RECORDING: 'start_recording',
  STOP_RECORDING: 'stop_recording',
  GET_RECORDING_STATUS: 'get_recording_status',
  RECORD_STEP: 'record_step',
  
  // Replay
  START_REPLAY: 'start_replay',
  STOP_REPLAY: 'stop_replay',
  REPLAY_STEP: 'replay_step',
  GET_REPLAY_STATUS: 'get_replay_status',
  
  // CSV Operations
  IMPORT_CSV: 'import_csv',
  EXPORT_CSV: 'export_csv',
  PARSE_CSV: 'parse_csv',
  UPDATE_CSV_DATA: 'update_csv_data',
  
  // Tab Management
  GET_ACTIVE_TAB: 'get_active_tab',
  INJECT_CONTENT_SCRIPT: 'inject_content_script',
  NAVIGATE_TO_URL: 'navigate_to_url',
  
  // Storage
  CLEAR_STORAGE: 'clear_storage',
  GET_STORAGE_STATS: 'get_storage_stats',
  EXPORT_ALL_DATA: 'export_all_data',
  IMPORT_ALL_DATA: 'import_all_data',
  
  // Element Location (content script)
  LOCATE_ELEMENT: 'locate_element',
  HIGHLIGHT_ELEMENT: 'highlight_element',
  CLEAR_HIGHLIGHTS: 'clear_highlights',
  
  // UI Notifications
  SHOW_NOTIFICATION: 'show_notification',
  UPDATE_BADGE: 'update_badge'
} as const;

export type MessageAction = typeof MESSAGE_ACTIONS[keyof typeof MESSAGE_ACTIONS];

/**
 * Array of all valid message actions for runtime validation
 */
export const ALL_MESSAGE_ACTIONS: readonly MessageAction[] = Object.values(MESSAGE_ACTIONS);

// ============================================================================
// BASE MESSAGE INTERFACES
// ============================================================================

/**
 * Base message structure for all Chrome extension messages
 * 
 * @template A - Action type (string literal)
 * @template P - Payload type (varies by action)
 */
export interface BaseMessage<A extends MessageAction, P = undefined> {
  /** Message action identifier (lowercase_snake_case) */
  action: A;
  /** Message payload (type depends on action) */
  payload: P;
  /** Optional request ID for tracking async responses */
  requestId?: string;
  /** Timestamp when message was created */
  timestamp?: number;
}

/**
 * Base response structure for all message responses
 * 
 * @template T - Success data type
 */
export interface BaseResponse<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data (present when success=true) */
  data?: T;
  /** Error message (present when success=false) */
  error?: string;
  /** Original request ID if provided */
  requestId?: string;
}

/**
 * Success response helper type
 */
export type SuccessResponse<T> = {
  success: true;
  data: T;
  error?: never;
  requestId?: string;
};

/**
 * Error response helper type
 */
export type ErrorResponse = {
  success: false;
  data?: never;
  error: string;
  requestId?: string;
};

// ============================================================================
// PROJECT MESSAGE TYPES
// ============================================================================

// Get All Projects
export type GetAllProjectsMessage = BaseMessage<'get_all_projects'>;
export type GetAllProjectsResponse = BaseResponse<Project[]>;

// Get Single Project
export interface GetProjectPayload {
  projectId: number;
}
export type GetProjectMessage = BaseMessage<'get_project', GetProjectPayload>;
export type GetProjectResponse = BaseResponse<Project | null>;

// Add Project
export interface AddProjectPayload {
  name: string;
  description?: string;
  target_url: string;
}
export type AddProjectMessage = BaseMessage<'add_project', AddProjectPayload>;
export type AddProjectResponse = BaseResponse<Project>;

// Update Project
export interface UpdateProjectPayload {
  projectId: number;
  updates: Partial<Omit<Project, 'id' | 'created_date'>>;
}
export type UpdateProjectMessage = BaseMessage<'update_project', UpdateProjectPayload>;
export type UpdateProjectResponse = BaseResponse<Project>;

// Delete Project
export interface DeleteProjectPayload {
  projectId: number;
}
export type DeleteProjectMessage = BaseMessage<'delete_project', DeleteProjectPayload>;
export type DeleteProjectResponse = BaseResponse<{ deleted: boolean }>;

// ============================================================================
// STEP MESSAGE TYPES
// ============================================================================

// Update Project Steps
export interface UpdateProjectStepsPayload {
  projectId: number;
  steps: Step[];
}
export type UpdateProjectStepsMessage = BaseMessage<'update_project_steps', UpdateProjectStepsPayload>;
export type UpdateProjectStepsResponse = BaseResponse<Step[]>;

// Get Project Steps
export interface GetProjectStepsPayload {
  projectId: number;
}
export type GetProjectStepsMessage = BaseMessage<'get_project_steps', GetProjectStepsPayload>;
export type GetProjectStepsResponse = BaseResponse<Step[]>;

// Add Step
export interface AddStepPayload {
  projectId: number;
  step: Omit<Step, 'id'>;
}
export type AddStepMessage = BaseMessage<'add_step', AddStepPayload>;
export type AddStepResponse = BaseResponse<Step>;

// Update Step
export interface UpdateStepPayload {
  projectId: number;
  stepId: string;
  updates: Partial<Omit<Step, 'id'>>;
}
export type UpdateStepMessage = BaseMessage<'update_step', UpdateStepPayload>;
export type UpdateStepResponse = BaseResponse<Step>;

// Delete Step
export interface DeleteStepPayload {
  projectId: number;
  stepId: string;
}
export type DeleteStepMessage = BaseMessage<'delete_step', DeleteStepPayload>;
export type DeleteStepResponse = BaseResponse<{ deleted: boolean }>;

// Reorder Steps
export interface ReorderStepsPayload {
  projectId: number;
  fromIndex: number;
  toIndex: number;
}
export type ReorderStepsMessage = BaseMessage<'reorder_steps', ReorderStepsPayload>;
export type ReorderStepsResponse = BaseResponse<Step[]>;

// ============================================================================
// FIELD MESSAGE TYPES
// ============================================================================

// Update Project Fields
export interface UpdateProjectFieldsPayload {
  projectId: number;
  fields: Field[];
}
export type UpdateProjectFieldsMessage = BaseMessage<'update_project_fields', UpdateProjectFieldsPayload>;
export type UpdateProjectFieldsResponse = BaseResponse<Field[]>;

// Get Project Fields
export interface GetProjectFieldsPayload {
  projectId: number;
}
export type GetProjectFieldsMessage = BaseMessage<'get_project_fields', GetProjectFieldsPayload>;
export type GetProjectFieldsResponse = BaseResponse<Field[]>;

// Auto Map Fields
export interface AutoMapFieldsPayload {
  projectId: number;
  csvHeaders: string[];
  stepLabels: string[];
}
export type AutoMapFieldsMessage = BaseMessage<'auto_map_fields', AutoMapFieldsPayload>;
export type AutoMapFieldsResponse = BaseResponse<Field[]>;

// ============================================================================
// TEST RUN MESSAGE TYPES
// ============================================================================

// Start Test Run
export interface StartTestRunPayload {
  projectId: number;
  csvRowIndex?: number;
}
export type StartTestRunMessage = BaseMessage<'start_test_run', StartTestRunPayload>;
export type StartTestRunResponse = BaseResponse<TestRun>;

// Stop Test Run
export interface StopTestRunPayload {
  testRunId: string;
}
export type StopTestRunMessage = BaseMessage<'stop_test_run', StopTestRunPayload>;
export type StopTestRunResponse = BaseResponse<TestRun>;

// Get Test Run Status
export interface GetTestRunStatusPayload {
  testRunId: string;
}
export type GetTestRunStatusMessage = BaseMessage<'get_test_run_status', GetTestRunStatusPayload>;
export type GetTestRunStatusResponse = BaseResponse<TestRun>;

// Get Test Run Logs
export interface GetTestRunLogsPayload {
  testRunId: string;
  lastLineCount?: number;
}
export type GetTestRunLogsMessage = BaseMessage<'get_test_run_logs', GetTestRunLogsPayload>;
export type GetTestRunLogsResponse = BaseResponse<{ logs: string }>;

// ============================================================================
// RECORDING MESSAGE TYPES
// ============================================================================

// Start Recording
export interface StartRecordingPayload {
  projectId: number;
  tabId: number;
}
export type StartRecordingMessage = BaseMessage<'start_recording', StartRecordingPayload>;
export type StartRecordingResponse = BaseResponse<{ recording: boolean }>;

// Stop Recording
export interface StopRecordingPayload {
  projectId: number;
}
export type StopRecordingMessage = BaseMessage<'stop_recording', StopRecordingPayload>;
export type StopRecordingResponse = BaseResponse<{ recording: boolean; stepCount: number }>;

// Get Recording Status
export type GetRecordingStatusMessage = BaseMessage<'get_recording_status'>;
export type GetRecordingStatusResponse = BaseResponse<{
  recording: boolean;
  projectId: number | null;
  tabId: number | null;
  stepCount: number;
}>;

// Record Step (from content script)
export interface RecordStepPayload {
  projectId: number;
  step: Omit<Step, 'id'>;
}
export type RecordStepMessage = BaseMessage<'record_step', RecordStepPayload>;
export type RecordStepResponse = BaseResponse<Step>;

// ============================================================================
// REPLAY MESSAGE TYPES
// ============================================================================

// Start Replay
export interface StartReplayPayload {
  projectId: number;
  csvRowIndex?: number;
  startFromStep?: number;
}
export type StartReplayMessage = BaseMessage<'start_replay', StartReplayPayload>;
export type StartReplayResponse = BaseResponse<{ testRunId: string }>;

// Stop Replay
export interface StopReplayPayload {
  testRunId: string;
}
export type StopReplayMessage = BaseMessage<'stop_replay', StopReplayPayload>;
export type StopReplayResponse = BaseResponse<TestRun>;

// Replay Step (to content script)
export interface ReplayStepPayload {
  step: Step;
  csvRow?: Record<string, string>;
  fieldMappings?: Field[];
}
export type ReplayStepMessage = BaseMessage<'replay_step', ReplayStepPayload>;
export type ReplayStepResponse = BaseResponse<{
  success: boolean;
  strategyUsed: string;
  duration: number;
  error?: string;
}>;

// Get Replay Status
export type GetReplayStatusMessage = BaseMessage<'get_replay_status'>;
export type GetReplayStatusResponse = BaseResponse<{
  replaying: boolean;
  testRunId: string | null;
  currentStep: number;
  totalSteps: number;
}>;

// ============================================================================
// CSV MESSAGE TYPES
// ============================================================================

// Import CSV
export interface ImportCsvPayload {
  projectId: number;
  csvContent: string;
  hasHeaders?: boolean;
}
export type ImportCsvMessage = BaseMessage<'import_csv', ImportCsvPayload>;
export type ImportCsvResponse = BaseResponse<{
  headers: string[];
  rowCount: number;
  fields: Field[];
}>;

// Export CSV
export interface ExportCsvPayload {
  projectId: number;
  includeResults?: boolean;
}
export type ExportCsvMessage = BaseMessage<'export_csv', ExportCsvPayload>;
export type ExportCsvResponse = BaseResponse<{ csvContent: string }>;

// Parse CSV
export interface ParseCsvPayload {
  csvContent: string;
  hasHeaders?: boolean;
}
export type ParseCsvMessage = BaseMessage<'parse_csv', ParseCsvPayload>;
export type ParseCsvResponse = BaseResponse<{
  headers: string[];
  rows: string[][];
  rowCount: number;
}>;

// Update CSV Data
export interface UpdateCsvDataPayload {
  projectId: number;
  csvData: any[];
}
export type UpdateCsvDataMessage = BaseMessage<'update_csv_data', UpdateCsvDataPayload>;
export type UpdateCsvDataResponse = BaseResponse<{ rowCount: number }>;

// ============================================================================
// TAB MANAGEMENT MESSAGE TYPES
// ============================================================================

// Get Active Tab
export type GetActiveTabMessage = BaseMessage<'get_active_tab'>;
export type GetActiveTabResponse = BaseResponse<{
  tabId: number;
  url: string;
  title: string;
}>;

// Inject Content Script
export interface InjectContentScriptPayload {
  tabId: number;
}
export type InjectContentScriptMessage = BaseMessage<'inject_content_script', InjectContentScriptPayload>;
export type InjectContentScriptResponse = BaseResponse<{ injected: boolean }>;

// Navigate to URL
export interface NavigateToUrlPayload {
  tabId: number;
  url: string;
}
export type NavigateToUrlMessage = BaseMessage<'navigate_to_url', NavigateToUrlPayload>;
export type NavigateToUrlResponse = BaseResponse<{ navigated: boolean }>;

// ============================================================================
// STORAGE MESSAGE TYPES
// ============================================================================

// Clear Storage
export interface ClearStoragePayload {
  confirmDelete: boolean;
}
export type ClearStorageMessage = BaseMessage<'clear_storage', ClearStoragePayload>;
export type ClearStorageResponse = BaseResponse<{ cleared: boolean }>;

// Get Storage Stats
export type GetStorageStatsMessage = BaseMessage<'get_storage_stats'>;
export type GetStorageStatsResponse = BaseResponse<{
  projectCount: number;
  testRunCount: number;
  totalSizeBytes: number;
}>;

// Export All Data
export type ExportAllDataMessage = BaseMessage<'export_all_data'>;
export type ExportAllDataResponse = BaseResponse<{
  projects: Project[];
  testRuns: TestRun[];
  exportedAt: number;
}>;

// Import All Data
export interface ImportAllDataPayload {
  projects: Project[];
  testRuns?: TestRun[];
  overwrite?: boolean;
}
export type ImportAllDataMessage = BaseMessage<'import_all_data', ImportAllDataPayload>;
export type ImportAllDataResponse = BaseResponse<{
  projectsImported: number;
  testRunsImported: number;
}>;

// ============================================================================
// ELEMENT LOCATION MESSAGE TYPES (Content Script)
// ============================================================================

// Locate Element
export interface LocateElementPayload {
  xpath?: string;
  id?: string;
  name?: string;
  css?: string;
  bounding?: { x: number; y: number; radius: number };
}
export type LocateElementMessage = BaseMessage<'locate_element', LocateElementPayload>;
export type LocateElementResponse = BaseResponse<{
  found: boolean;
  strategy: string;
  confidence: number;
}>;

// Highlight Element
export interface HighlightElementPayload {
  xpath?: string;
  css?: string;
  duration?: number;
}
export type HighlightElementMessage = BaseMessage<'highlight_element', HighlightElementPayload>;
export type HighlightElementResponse = BaseResponse<{ highlighted: boolean }>;

// Clear Highlights
export type ClearHighlightsMessage = BaseMessage<'clear_highlights'>;
export type ClearHighlightsResponse = BaseResponse<{ cleared: boolean }>;

// ============================================================================
// UI NOTIFICATION MESSAGE TYPES
// ============================================================================

// Show Notification
export interface ShowNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}
export type ShowNotificationMessage = BaseMessage<'show_notification', ShowNotificationPayload>;
export type ShowNotificationResponse = BaseResponse<{ shown: boolean }>;

// Update Badge
export interface UpdateBadgePayload {
  text: string;
  color?: string;
}
export type UpdateBadgeMessage = BaseMessage<'update_badge', UpdateBadgePayload>;
export type UpdateBadgeResponse = BaseResponse<{ updated: boolean }>;

// ============================================================================
// UNION TYPES FOR MESSAGE HANDLING
// ============================================================================

/**
 * Union of all possible messages
 */
export type AnyMessage =
  // Project
  | GetAllProjectsMessage
  | GetProjectMessage
  | AddProjectMessage
  | UpdateProjectMessage
  | DeleteProjectMessage
  // Steps
  | UpdateProjectStepsMessage
  | GetProjectStepsMessage
  | AddStepMessage
  | UpdateStepMessage
  | DeleteStepMessage
  | ReorderStepsMessage
  // Fields
  | UpdateProjectFieldsMessage
  | GetProjectFieldsMessage
  | AutoMapFieldsMessage
  // Test Runs
  | StartTestRunMessage
  | StopTestRunMessage
  | GetTestRunStatusMessage
  | GetTestRunLogsMessage
  // Recording
  | StartRecordingMessage
  | StopRecordingMessage
  | GetRecordingStatusMessage
  | RecordStepMessage
  // Replay
  | StartReplayMessage
  | StopReplayMessage
  | ReplayStepMessage
  | GetReplayStatusMessage
  // CSV
  | ImportCsvMessage
  | ExportCsvMessage
  | ParseCsvMessage
  | UpdateCsvDataMessage
  // Tab Management
  | GetActiveTabMessage
  | InjectContentScriptMessage
  | NavigateToUrlMessage
  // Storage
  | ClearStorageMessage
  | GetStorageStatsMessage
  | ExportAllDataMessage
  | ImportAllDataMessage
  // Element Location
  | LocateElementMessage
  | HighlightElementMessage
  | ClearHighlightsMessage
  // UI
  | ShowNotificationMessage
  | UpdateBadgeMessage;

/**
 * Union of all possible responses
 */
export type AnyResponse = BaseResponse<unknown>;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid message action
 * 
 * @param value - Value to check
 * @returns True if value is a valid MessageAction
 */
export function isMessageAction(value: unknown): value is MessageAction {
  return typeof value === 'string' && ALL_MESSAGE_ACTIONS.includes(value as MessageAction);
}

/**
 * Check if a value is a valid message structure
 * 
 * @param value - Value to check
 * @returns True if value has required message properties
 */
export function isMessage(value: unknown): value is AnyMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return isMessageAction(obj.action);
}

/**
 * Check if a response is successful
 * 
 * @param response - Response to check
 * @returns True if response.success is true
 */
export function isSuccessResponse<T>(response: BaseResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

/**
 * Check if a response is an error
 * 
 * @param response - Response to check
 * @returns True if response.success is false
 */
export function isErrorResponse(response: BaseResponse<unknown>): response is ErrorResponse {
  return response.success === false;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a message with standard structure
 * 
 * @param action - Message action
 * @param payload - Message payload
 * @param requestId - Optional request ID for tracking
 * @returns Formatted message object
 */
export function createMessage<A extends MessageAction, P>(
  action: A,
  payload: P,
  requestId?: string
): BaseMessage<A, P> {
  return {
    action,
    payload,
    requestId: requestId ?? generateRequestId(),
    timestamp: Date.now()
  };
}

/**
 * Create a success response
 * 
 * @param data - Response data
 * @param requestId - Original request ID
 * @returns Success response object
 */
export function createSuccessResponse<T>(data: T, requestId?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    requestId
  };
}

/**
 * Create an error response
 * 
 * @param error - Error message
 * @param requestId - Original request ID
 * @returns Error response object
 */
export function createErrorResponse(error: string, requestId?: string): ErrorResponse {
  return {
    success: false,
    error,
    requestId
  };
}

// ============================================================================
// MESSAGE CATEGORY HELPERS
// ============================================================================

/**
 * Project-related message actions
 */
export const PROJECT_ACTIONS = [
  MESSAGE_ACTIONS.GET_ALL_PROJECTS,
  MESSAGE_ACTIONS.GET_PROJECT,
  MESSAGE_ACTIONS.ADD_PROJECT,
  MESSAGE_ACTIONS.UPDATE_PROJECT,
  MESSAGE_ACTIONS.DELETE_PROJECT
] as const;

/**
 * Step-related message actions
 */
export const STEP_ACTIONS = [
  MESSAGE_ACTIONS.UPDATE_PROJECT_STEPS,
  MESSAGE_ACTIONS.GET_PROJECT_STEPS,
  MESSAGE_ACTIONS.ADD_STEP,
  MESSAGE_ACTIONS.UPDATE_STEP,
  MESSAGE_ACTIONS.DELETE_STEP,
  MESSAGE_ACTIONS.REORDER_STEPS
] as const;

/**
 * Recording-related message actions
 */
export const RECORDING_ACTIONS = [
  MESSAGE_ACTIONS.START_RECORDING,
  MESSAGE_ACTIONS.STOP_RECORDING,
  MESSAGE_ACTIONS.GET_RECORDING_STATUS,
  MESSAGE_ACTIONS.RECORD_STEP
] as const;

/**
 * Replay-related message actions
 */
export const REPLAY_ACTIONS = [
  MESSAGE_ACTIONS.START_REPLAY,
  MESSAGE_ACTIONS.STOP_REPLAY,
  MESSAGE_ACTIONS.REPLAY_STEP,
  MESSAGE_ACTIONS.GET_REPLAY_STATUS
] as const;

/**
 * Check if action is a project action
 */
export function isProjectAction(action: MessageAction): boolean {
  return (PROJECT_ACTIONS as readonly string[]).includes(action);
}

/**
 * Check if action is a step action
 */
export function isStepAction(action: MessageAction): boolean {
  return (STEP_ACTIONS as readonly string[]).includes(action);
}

/**
 * Check if action is a recording action
 */
export function isRecordingAction(action: MessageAction): boolean {
  return (RECORDING_ACTIONS as readonly string[]).includes(action);
}

/**
 * Check if action is a replay action
 */
export function isReplayAction(action: MessageAction): boolean {
  return (REPLAY_ACTIONS as readonly string[]).includes(action);
}
