/**
 * Test Orchestrator Module - Barrel Export
 * @module core/orchestrator
 * @version 1.0.0
 * 
 * Coordinates test execution workflow including:
 * - Test lifecycle management (start, pause, stop, resume)
 * - Multi-row CSV execution
 * - Tab coordination and script injection
 * - Step sequencing and value injection
 * - Progress tracking and logging
 * - Error handling and recovery
 * - Result aggregation and persistence
 * - Session management and checkpointing
 * - Performance metrics and analytics
 * 
 * @example
 * ```typescript
 * import {
 *   TestOrchestrator,
 *   createTestOrchestrator,
 *   TabManager,
 *   createTabManager,
 * } from '@/core/orchestrator';
 * 
 * const orchestrator = createTestOrchestrator(tabOps, storageOps);
 * 
 * orchestrator.on('progress', (event) => {
 *   console.log(`Progress: ${event.data.percentage}%`);
 * });
 * ```
 * 
 * @see test-orchestrator_breakdown.md for architecture details
 */

// ============================================================================
// INTERFACES (P4-141)
// ============================================================================

export type {
  ITestOrchestrator,
} from './ITestOrchestrator';

// ============================================================================
// VALUE INJECTOR (P4-147)
// ============================================================================

export {
  ValueInjector,
  createValueInjector,
  type ValueInjectorConfig,
  type InjectionResult,
  type InjectionMapping,
} from './ValueInjector';

// ============================================================================
// PROGRESS TRACKER (P4-148)
// ============================================================================

export {
  ProgressTracker,
  createProgressTracker,
  type ProgressTrackerConfig,
  type Progress,
  type StepProgress,
  type RowProgress,
  type ProgressListener,
} from './ProgressTracker';

// ============================================================================
// LOG COLLECTOR (P4-149)
// ============================================================================

export {
  LogCollector,
  createLogCollector,
  type LogCollectorConfig,
  type LogEntry,
  type LogLevel,
  type LogListener,
} from './LogCollector';

// ============================================================================
// RESULT AGGREGATOR (P4-150)
// ============================================================================

export {
  ResultAggregator,
  createResultAggregator,
  type ExecutionResult,
  type AggregatedStepResult,
  type AggregatedRowResult,
  type ResultStatus,
} from './ResultAggregator';

// ============================================================================
// TEST RUN BUILDER (P4-151)
// ============================================================================

export {
  TestRunBuilder,
  createTestRunBuilder,
  type TestRun,
  type TestRunStatus,
  type StepResult,
} from './TestRunBuilder';

// ============================================================================
// TAB MANAGER (P4-152)
// ============================================================================

export {
  TabManager,
  createTabManager,
  type TabManagerConfig,
  type TabState,
  type TabInfo,
  type TabEventType,
  type TabEvent,
} from './TabManager';

// ============================================================================
// SCRIPT INJECTOR (P4-153)
// ============================================================================

export {
  ScriptInjector,
  createScriptInjector,
  createScript,
  createInlineScript,
  type ScriptInjectorConfig,
  type Script,
  type InlineScript,
  type InjectionOptions,
  type InjectionResult as ScriptInjectionResult,
  type InjectionStatus,
} from './ScriptInjector';

// ============================================================================
// ERROR HANDLER (P4-154)
// ============================================================================

export {
  ErrorHandler,
  createErrorHandler,
  createContinueOnErrorHandler,
  createStrictErrorHandler,
  withErrorHandling,
  type ErrorHandlerConfig,
  type ExecutionError,
  type ErrorCategory,
  type ErrorSeverity,
  type FailurePolicy,
  type ErrorHandlingResult,
  type RecoveryStrategy,
  type RecoveryResult,
  type ErrorStats,
} from './ErrorHandler';

// ============================================================================
// STOP CONTROLLER (P4-155)
// ============================================================================

export {
  StopController,
  createStopController,
  withStopControl,
  cancellableDelay,
  stoppableIterator,
  isStopRequestedError,
  StopRequestedError,
  type StopControllerConfig,
  type StopReason,
  type RunningState,
  type StopEvent,
  type StopCallback,
} from './StopController';

// ============================================================================
// PAUSE CONTROLLER (P4-156)
// ============================================================================

export {
  PauseController,
  createPauseController,
  pauseAwareDelay,
  pauseAwareIterator,
  waitWithStopCheck,
  type PauseControllerConfig,
  type PauseReason,
  type PauseState,
  type PauseEvent,
  type PauseCallback,
} from './PauseController';

// ============================================================================
// TEST ORCHESTRATOR (P4-157)
// ============================================================================

export {
  TestOrchestrator,
  createTestOrchestrator,
  DEFAULT_EXECUTION_OPTIONS,
  type TestConfig,
  type ExecutionStep,
  type FieldMapping,
  type ExecutionOptions,
  type TestRunResult,
  type StepExecutionResult,
  type RowExecutionResult,
  type OrchestratorEventListener,
  type ITabOperations,
  type IStorageOperations,
} from './TestOrchestrator';

// ============================================================================
// ORCHESTRATOR SESSION (P4-158)
// ============================================================================

export {
  OrchestratorSession,
  createOrchestratorSession,
  DEFAULT_SESSION_CONFIG,
  type SessionConfig,
  type SessionStatus,
  type SessionMetadata,
  type SessionSummary,
  type SessionData,
  type SessionEvent,
  type SessionEventType,
  type SessionEventListener,
  type Checkpoint,
  type CheckpointStepResult,
  type ISessionStorage,
} from './OrchestratorSession';

// ============================================================================
// ORCHESTRATOR METRICS (P4-159)
// ============================================================================

export {
  OrchestratorMetrics,
  createOrchestratorMetrics,
  DEFAULT_METRICS_CONFIG,
  type MetricsConfig,
  type TimingMeasurement,
  type StepTiming,
  type RowTiming,
  type ExecutionTiming,
  type Statistics,
  type PerformanceSummary,
  type StepPerformance,
  type MetricsEvent,
  type MetricsEventType,
  type MetricsEventListener,
} from './OrchestratorMetrics';

// ============================================================================
// CHROME TAB MANAGER (Legacy - from earlier implementation)
// ============================================================================

export {
  ChromeTabManager,
  createChromeTabManager,
  createFastTabManager,
  createTolerantTabManager,
  getTabManager,
  resetTabManager,
  MockTabManager,
  createMockTabManager,
  DEFAULT_TAB_MANAGER_CONFIG,
  type ChromeTabManagerConfig,
} from './ChromeTabManager';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Default export: TestOrchestrator class
 * 
 * @example
 * ```typescript
 * import TestOrchestrator from '@/core/orchestrator';
 * ```
 */
export { TestOrchestrator as default } from './TestOrchestrator';
