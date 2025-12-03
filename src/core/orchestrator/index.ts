/**
 * Orchestrator Module - Barrel Export
 * @module core/orchestrator
 * @version 1.0.0
 * 
 * Provides test execution orchestration including tab management,
 * script injection, multi-row CSV execution, and result persistence.
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   createTestOrchestrator, 
 *   createChromeTabManager 
 * } from '@/core/orchestrator';
 * 
 * // Create orchestrator with Chrome tab manager
 * const tabManager = createChromeTabManager();
 * const orchestrator = createTestOrchestrator(tabManager);
 * 
 * // Run test
 * orchestrator.onProgress((progress) => {
 *   console.log(`Progress: ${progress.overallPercentage}%`);
 * });
 * 
 * const result = await orchestrator.run({ projectId: 42 });
 * ```
 * 
 * ## Module Structure
 * - **ITestOrchestrator**: Interface for test orchestration
 * - **ITabManager**: Interface for tab management
 * - **TestOrchestrator**: Main orchestrator implementation
 * - **ChromeTabManager**: Chrome extension tab manager
 * - **MockTabManager**: Mock for testing without Chrome
 */

// ============================================================================
// INTERFACES & TYPES (ITestOrchestrator)
// ============================================================================

export type {
  // Lifecycle
  OrchestratorLifecycle,
  
  // Tab management
  TabInfo,
  TabResult,
  ITabManager,
  
  // Configuration
  OrchestratorConfig,
  
  // Progress & Logging
  LogLevel,
  LogEntry,
  OrchestratorProgress,
  StepStatus,
  
  // Results
  OrchestratorResult,
  TestRunCreateData,
  TestRunUpdateData,
  
  // Callbacks
  ProjectLoadedCallback,
  TabOpenedCallback,
  RowStartCallback,
  RowCompleteCallback,
  StepStartCallback,
  StepCompleteCallback,
  ProgressCallback,
  LogCallback,
  CompleteCallback,
  ErrorCallback,
  LifecycleCallback,
  
  // Events aggregate
  OrchestratorEvents,
  
  // Factory type
  OrchestratorFactory,
  
  // Main interface
  ITestOrchestrator,
} from './ITestOrchestrator';

// ============================================================================
// CONSTANTS (ITestOrchestrator)
// ============================================================================

export {
  ORCHESTRATOR_TRANSITIONS,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './ITestOrchestrator';

// ============================================================================
// TEST ORCHESTRATOR
// ============================================================================

export {
  TestOrchestrator,
  createTestOrchestrator,
  createMockTabManager as createOrchestratorMockTabManager,
} from './TestOrchestrator';

// ============================================================================
// CHROME TAB MANAGER
// ============================================================================

export {
  // Types
  type ChromeTabManagerConfig,
  
  // Constants
  DEFAULT_TAB_MANAGER_CONFIG,
  
  // Class
  ChromeTabManager,
  
  // Factory functions
  createChromeTabManager,
  createFastTabManager,
  createTolerantTabManager,
  
  // Singleton
  getTabManager,
  resetTabManager,
  
  // Mock for testing
  MockTabManager,
  createMockTabManager,
} from './ChromeTabManager';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Default orchestrator configuration values
 */
export const ORCHESTRATOR_DEFAULTS = {
  /** Row delay in ms */
  ROW_DELAY: 1000,
  
  /** Step delay in ms */
  STEP_DELAY: 0,
  
  /** Human-like delay range [min, max] in ms */
  HUMAN_DELAY_RANGE: [50, 300] as [number, number],
  
  /** Step timeout in ms */
  STEP_TIMEOUT: 30000,
  
  /** Max row failures (0 = unlimited) */
  MAX_ROW_FAILURES: 0,
  
  /** Continue after row failure */
  CONTINUE_ON_ROW_FAILURE: true,
  
  /** Persist results to storage */
  PERSIST_RESULTS: true,
  
  /** Close tab on completion */
  CLOSE_TAB_ON_COMPLETE: false,
} as const;

/**
 * Tab manager configuration values
 */
export const TAB_MANAGER_DEFAULTS = {
  /** Operation timeout in ms */
  TIMEOUT: 30000,
  
  /** Delay after tab open in ms */
  LOAD_DELAY: 500,
  
  /** Max script injection retries */
  MAX_INJECTION_RETRIES: 3,
  
  /** Delay between injection retries in ms */
  INJECTION_RETRY_DELAY: 500,
  
  /** Wait for page load */
  WAIT_FOR_LOAD: true,
} as const;

/**
 * Lifecycle state display names
 */
export const LIFECYCLE_DISPLAY_NAMES: Record<string, string> = {
  idle: 'Idle',
  loading: 'Loading',
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  stopping: 'Stopping',
  stopped: 'Stopped',
  completed: 'Completed',
  error: 'Error',
};

/**
 * Lifecycle state colors for UI
 */
export const LIFECYCLE_COLORS: Record<string, string> = {
  idle: 'gray',
  loading: 'blue',
  ready: 'green',
  running: 'blue',
  paused: 'yellow',
  stopping: 'orange',
  stopped: 'gray',
  completed: 'green',
  error: 'red',
};

/**
 * Log level colors for UI
 */
export const LOG_LEVEL_COLORS: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  debug: 'gray',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if lifecycle state is terminal
 */
export function isTerminalState(lifecycle: string): boolean {
  return ['stopped', 'completed', 'error'].includes(lifecycle);
}

/**
 * Check if lifecycle state is active (can be paused/stopped)
 */
export function isActiveState(lifecycle: string): boolean {
  return ['running', 'paused'].includes(lifecycle);
}

/**
 * Check if lifecycle state is idle-like (can start)
 */
export function isIdleState(lifecycle: string): boolean {
  return ['idle', 'ready'].includes(lifecycle);
}

/**
 * Format progress percentage
 */
export function formatProgress(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

/**
 * Format duration in ms to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Format ETA from remaining milliseconds
 */
export function formatEta(remainingMs: number | null): string {
  if (remainingMs === null) {
    return 'Calculating...';
  }
  
  if (remainingMs <= 0) {
    return 'Almost done';
  }
  
  return formatDuration(remainingMs);
}

/**
 * Calculate overall progress from row and step info
 */
export function calculateOverallProgress(
  currentRow: number,
  totalRows: number,
  currentStep: number,
  totalSteps: number
): number {
  if (totalRows === 0 || totalSteps === 0) {
    return 0;
  }
  
  const totalOperations = totalRows * totalSteps;
  const completedOperations = (currentRow * totalSteps) + currentStep;
  
  return (completedOperations / totalOperations) * 100;
}
