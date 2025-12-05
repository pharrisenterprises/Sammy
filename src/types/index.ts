/**
 * Types Barrel Export
 * @module types
 * @version 1.0.0
 * 
 * Re-exports all type declarations.
 */

// Global types are automatically included via tsconfig
// This file provides explicit exports for shared types

// ============================================================================
// RE-EXPORT CORE TYPES
// ============================================================================

export type {
  // Project types
  Project,
  ProjectStatus,
  ProjectCreateInput,
  ProjectUpdateInput,
  
  // Step types
  Step,
  StepEvent,
  StepStatus,
  StepCreateInput,
  StepUpdateInput,
  
  // Test run types
  TestRun,
  TestRunStatus,
  TestRunCreateInput,
  TestRunUpdateInput,
  StepResult,
  
  // Field types
  Field,
  FieldMapping,
  FieldMappingResult,
  
  // Locator types
  LocatorBundle,
  LocatorBundlePartial,
  BoundingBox,
  
  // Message types
  MessageAction,
  MessagePayload,
  MessageResponse,
  
  // Recording types
  RecordedEvent,
  RecordingState,
  RecordingConfig,
  
  // Replay types
  ReplayState,
  ReplayConfig,
  ReplayResult,
  
  // CSV types
  CsvData,
  CsvRow,
  CsvColumn,
  CsvParseResult,
  
  // Orchestrator types
  ExecutionState,
  ExecutionConfig,
  ExecutionResult,
  ExecutionProgress,
  ExecutionLog,
  LogLevel,
  
  // Utility types
  Result,
  Success,
  Failure,
  AsyncResult,
  Timestamp,
  Duration,
  UUID,
} from '@/core/types';
