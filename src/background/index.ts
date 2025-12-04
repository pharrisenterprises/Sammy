/**
 * Background Service Module - Barrel Export
 * @module background
 * @version 1.0.0
 * 
 * Central export point for all background service components.
 * 
 * Usage:
 * ```typescript
 * import { 
 *   BackgroundBootstrap,
 *   ServiceCoordinator,
 *   MessageReceiver,
 *   BackgroundMetrics 
 * } from '@/background';
 * ```
 * 
 * @see background-service_breakdown.md for architecture
 */

// ============================================================================
// INTERFACES AND TYPES (P4-161)
// ============================================================================

export {
  // Core interfaces
  type IBackgroundService,
  type IMessageHandler,
  type ITabManager,
  type IScriptInjector,
  type IStateManager,
  
  // Message types
  type BackgroundMessage,
  type BackgroundResponse,
  type MessageSender,
  type SendResponseFn,
  
  // Handler types
  type MessageHandlerFn,
  type MessageHandlerResult,
  
  // Tab types
  type TabInfo,
  type TabState,
  
  // Constants
  BACKGROUND_ACTIONS,
  MESSAGE_SOURCES,
} from './IBackgroundService';

// ============================================================================
// CONFIGURATION (P4-162)
// ============================================================================

export {
  BackgroundConfig,
  createBackgroundConfig,
  
  // Types
  type BackgroundConfigOptions,
  type InjectionConfig,
  type StateConfig,
  type MessageConfig,
  
  // Constants
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_INJECTION_CONFIG,
  DEFAULT_STATE_CONFIG,
  DEFAULT_MESSAGE_CONFIG,
} from './BackgroundConfig';

// ============================================================================
// MESSAGE RECEIVER (P4-164)
// ============================================================================

export {
  MessageReceiver,
  createMessageReceiver,
  
  // Types
  type MessageHandler,
  type HandlerRegistration,
  type MessageReceiverConfig,
  
  // Constants
  DEFAULT_RECEIVER_CONFIG,
} from './MessageReceiver';

// ============================================================================
// HANDLERS - PROJECT (P4-165)
// ============================================================================

export {
  ProjectHandlers,
  createProjectHandlers,
  registerProjectHandlers,
  
  // Types
  type IProjectStorage,
  
  // Constants
  PROJECT_ACTIONS,
} from './handlers/ProjectHandlers';

// ============================================================================
// HANDLERS - TEST RUN (P4-166)
// ============================================================================

export {
  TestRunHandlers,
  createTestRunHandlers,
  registerTestRunHandlers,
  
  // Types
  type ITestRunStorage,
  
  // Constants
  TESTRUN_ACTIONS,
} from './handlers/TestRunHandlers';

// ============================================================================
// HANDLERS - INJECTION (P4-168)
// ============================================================================

export {
  InjectionHandlers,
  createInjectionHandlers,
  registerInjectionHandlers,
  
  // Types
  type IScriptingAPI,
  type ITabsAPI,
  type InjectionResult,
  type TabCreationResult,
  
  // Constants
  INJECTION_ACTIONS,
  DEFAULT_INJECTION_OPTIONS,
} from './handlers/InjectionHandlers';

// ============================================================================
// BACKGROUND STATE (P4-169)
// ============================================================================

export {
  BackgroundState,
  createBackgroundState,
  
  // Types
  type StateSnapshot,
  type StateChangeListener,
  type BackgroundStateConfig,
  
  // Constants
  DEFAULT_STATE_CONFIG as DEFAULT_BACKGROUND_STATE_CONFIG,
  STATE_KEYS,
} from './BackgroundState';

// ============================================================================
// NAVIGATION MANAGER (P4-170)
// ============================================================================

export {
  NavigationManager,
  createNavigationManager,
  
  // Types
  type NavigationEvent,
  type NavigationEventListener,
  type IWebNavigationAPI,
  type ITabsAPI as INavigationTabsAPI,
  type NavigationManagerConfig,
  
  // Constants
  DEFAULT_NAVIGATION_CONFIG,
  NAVIGATION_EVENTS,
} from './NavigationManager';

// ============================================================================
// LIFECYCLE MANAGER (P4-171)
// ============================================================================

export {
  LifecycleManager,
  createLifecycleManager,
  
  // Types
  type InstallDetails,
  type LifecycleEvent,
  type LifecycleEventListener,
  type IRuntimeAPI,
  type IActionAPI,
  type LifecycleManagerConfig,
  
  // Constants
  DEFAULT_LIFECYCLE_CONFIG,
  LIFECYCLE_EVENTS,
  INSTALL_REASONS,
} from './LifecycleManager';

// ============================================================================
// HANDLERS - RECORDING (P4-172)
// ============================================================================

export {
  RecordingHandlers,
  createRecordingHandlers,
  registerRecordingHandlers,
  
  // Types
  type RecordingSession,
  type RecordingStatus,
  type RecordedStep,
  type RecordedBundle,
  type IRecordingStateStorage,
  type ITabCommunication,
  type IStepStorage,
  type RecordingEvent,
  type RecordingEventType,
  
  // Constants
  RECORDING_ACTIONS,
} from './handlers/RecordingHandlers';

// ============================================================================
// HANDLERS - REPLAY (P4-173)
// ============================================================================

export {
  ReplayHandlers,
  createReplayHandlers,
  registerReplayHandlers,
  
  // Types
  type ReplaySession,
  type ReplayStatus,
  type ReplayStep,
  type StepResult,
  type IReplayStateStorage,
  type IResultStorage,
  type ReplayEvent,
  type ReplayEventType,
  
  // Constants
  REPLAY_ACTIONS,
  DEFAULT_STEP_TIMEOUT,
} from './handlers/ReplayHandlers';

// ============================================================================
// HANDLERS - STORAGE (P4-174)
// ============================================================================

export {
  StorageHandlers,
  createStorageHandlers,
  registerStorageHandlers,
  
  // Types
  type StorageQuotaInfo,
  type StorageBackup,
  type ISettingsStorage,
  type StorageEvent,
  type StorageEventType,
  
  // Constants
  STORAGE_ACTIONS,
  BACKUP_VERSION,
} from './handlers/StorageHandlers';

// ============================================================================
// EXTENSION BRIDGE (P4-175)
// ============================================================================

export {
  ExtensionBridge,
  createExtensionBridge,
  getExtensionBridge,
  createBridgeSubscription,
  
  // Types
  type BridgeMessage,
  type BridgeResponse,
  type BroadcastEvent,
  type BroadcastListener,
  type BridgeConfig,
  type IChromeRuntime,
  
  // Constants
  DEFAULT_BRIDGE_CONFIG,
  BROADCAST_EVENTS,
} from './ExtensionBridge';

// ============================================================================
// CONTENT SCRIPT BRIDGE (P4-176)
// ============================================================================

export {
  ContentScriptBridge,
  createContentScriptBridge,
  
  // Types
  type ContentMessage,
  type ContentResponse,
  type ContentScriptMessage,
  type ContentMessageListener,
  type ContentBridgeConfig,
  type IChromeTabs,
  type IChromeRuntime as IContentChromeRuntime,
  type TabConnectionState,
  type RunStepData,
  type LogEventData,
  
  // Constants
  DEFAULT_CONTENT_BRIDGE_CONFIG,
  CONTENT_MESSAGE_TYPES,
} from './ContentScriptBridge';

// ============================================================================
// SERVICE COORDINATOR (P4-177)
// ============================================================================

export {
  ServiceCoordinator,
  createServiceCoordinator,
  
  // Types
  type ServiceStatus,
  type ComponentStatus,
  type ServiceHealth,
  type InitResult,
  type ShutdownResult,
  type IServiceComponent,
  type IHandlerRegistry,
  type ILifecycleManager,
  type INavigationManager,
  type IStateManager as ICoordinatorStateManager,
  type CoordinatorEvent,
  type CoordinatorEventType,
  type CoordinatorEventListener,
  type CoordinatorConfig,
  
  // Constants
  DEFAULT_COORDINATOR_CONFIG,
} from './ServiceCoordinator';

// ============================================================================
// BACKGROUND ENTRY (P4-178)
// ============================================================================

export {
  BackgroundBootstrap,
  bootstrapBackground,
  getBackgroundCoordinator,
  isBackgroundInitialized,
  ensurePersistentStorage,
  
  // Types
  type BootstrapResult,
  type BootstrapConfig,
  type IChromeAPIs,
  
  // Constants
  DEFAULT_BOOTSTRAP_CONFIG,
} from './BackgroundEntry';

// ============================================================================
// BACKGROUND METRICS (P4-179)
// ============================================================================

export {
  BackgroundMetrics,
  createBackgroundMetrics,
  getBackgroundMetrics,
  resetBackgroundMetrics,
  
  // Types
  type TimingEntry,
  type OperationStats,
  type MessageMetrics,
  type HealthMetrics,
  type ResourceMetrics,
  type MetricsSnapshot,
  type ErrorEntry,
  type MetricsConfig,
  type MetricsEvent,
  type MetricsEventType,
  type MetricsEventListener,
  type OperationTimer,
  
  // Constants
  DEFAULT_METRICS_CONFIG,
} from './BackgroundMetrics';

// ============================================================================
// HANDLER BARREL EXPORT
// ============================================================================

/**
 * Re-export all handlers as a namespace for convenience
 */
export * as Handlers from './handlers';
