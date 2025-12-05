/**
 * Sammy Test Automation - Root Export
 * @module src
 * @version 1.0.0
 * 
 * Main entry point for the Sammy Chrome extension.
 * 
 * @example
 * ```typescript
 * // Import from root
 * import { RecordingEngine, ReplayEngine, ProjectRepository } from '@/';
 * 
 * // Or import from specific modules
 * import { RecordingEngine } from '@/core/recording';
 * import { useProjects } from '@/hooks';
 * ```
 */

// =============================================================================
// CORE MODULES
// =============================================================================

export * from './core';

// =============================================================================
// HOOKS
// =============================================================================

export {
  // Storage hooks
  useStorage,
  useProjects,
  useTestRuns,
  
  // Engine hooks
  useRecording,
  useReplay,
  
  // Data hooks
  useCsv,
  useOrchestrator,
  
  // Communication hooks
  useMessages,
} from './hooks';

// =============================================================================
// CONTEXT
// =============================================================================

export {
  // Providers
  AppProvider,
  StorageProvider,
  RecordingProvider,
  ReplayProvider,
  
  // Hooks
  useStorageContext,
  useRecordingContext,
  useReplayContext,
} from './context';

// =============================================================================
// COMPONENTS
// =============================================================================

export * from './components';

// =============================================================================
// PAGES
// =============================================================================

export * from './pages';

// =============================================================================
// TYPES (Re-export commonly used)
// =============================================================================

export type {
  Project,
  Step,
  TestRun,
  Field,
  LocatorBundle,
  RecordedEvent,
  StepResult,
} from './core/types';

// =============================================================================
// VERSION
// =============================================================================

export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();
