/**
 * Background Handlers - Barrel Export
 * @module background/handlers
 * @version 1.0.0
 * 
 * Export all message handlers for the background service.
 */

// Project handlers (P4-165)
export {
  ProjectHandlers,
  createProjectHandlers,
  registerProjectHandlers,
  type IProjectStorage,
  PROJECT_ACTIONS,
} from './ProjectHandlers';

// Test run handlers (P4-166)
export {
  TestRunHandlers,
  createTestRunHandlers,
  registerTestRunHandlers,
  type ITestRunStorage,
  TESTRUN_ACTIONS,
} from './TestRunHandlers';

// Injection handlers (P4-168)
export {
  InjectionHandlers,
  createInjectionHandlers,
  registerInjectionHandlers,
  type IScriptingAPI,
  type ITabsAPI,
  type InjectionResult,
  type TabCreationResult,
  INJECTION_ACTIONS,
  DEFAULT_INJECTION_OPTIONS,
} from './InjectionHandlers';

// Recording handlers (P4-172)
export {
  RecordingHandlers,
  createRecordingHandlers,
  registerRecordingHandlers,
  type RecordingSession,
  type RecordingStatus,
  type RecordedStep,
  type RecordedBundle,
  type IRecordingStateStorage,
  type ITabCommunication,
  type IStepStorage,
  type RecordingEvent,
  type RecordingEventType,
  RECORDING_ACTIONS,
} from './RecordingHandlers';

// Replay handlers (P4-173)
export {
  ReplayHandlers,
  createReplayHandlers,
  registerReplayHandlers,
  type ReplaySession,
  type ReplayStatus,
  type ReplayStep,
  type StepResult,
  type IReplayStateStorage,
  type IResultStorage,
  type ReplayEvent,
  type ReplayEventType,
  REPLAY_ACTIONS,
  DEFAULT_STEP_TIMEOUT,
} from './ReplayHandlers';

// Storage handlers (P4-174)
export {
  StorageHandlers,
  createStorageHandlers,
  registerStorageHandlers,
  type StorageQuotaInfo,
  type StorageBackup,
  type ISettingsStorage,
  type StorageEvent,
  type StorageEventType,
  STORAGE_ACTIONS,
  BACKUP_VERSION,
} from './StorageHandlers';

// ============================================================================
// ALL ACTIONS CONSTANT
// ============================================================================

/**
 * All background action types combined
 */
export const ALL_ACTIONS = {
  ...PROJECT_ACTIONS,
  ...TESTRUN_ACTIONS,
  ...INJECTION_ACTIONS,
  ...RECORDING_ACTIONS,
  ...REPLAY_ACTIONS,
  ...STORAGE_ACTIONS,
} as const;
