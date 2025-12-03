/**
 * Core Module - Master Barrel Export
 * @module core
 * @version 1.0.0
 * 
 * Unified export for all core functionality including data types,
 * storage layer, replay engine, test orchestrator, background service,
 * CSV processing, and content script infrastructure.
 * 
 * ## Module Overview
 * 
 * ### Types (`@/core/types`)
 * Data models: Step, Project, TestRun, ParsedField, LocatorBundle
 * 
 * ### Storage (`@/core/storage`)
 * IndexedDB persistence: Dexie schema, repositories, CRUD operations
 * 
 * ### Replay (`@/core/replay`)
 * Test execution: Element finding, action execution, step replay, sessions
 * 
 * ### Orchestrator (`@/core/orchestrator`)
 * Test coordination: Multi-row execution, tab management, progress tracking
 * 
 * ### Background (`@/core/background`)
 * Service worker: Message routing, tab lifecycle, script injection
 * 
 * ### CSV (`@/core/csv`)
 * Data import: CSV/Excel parsing, field mapping, validation
 * 
 * ### Content (`@/core/content`)
 * Page automation: Recording, replay, cross-context messaging, notifications
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   // Types
 *   type Step, type Project,
 *   
 *   // Storage
 *   getStorageService,
 *   
 *   // Replay
 *   createReplayEngine,
 *   
 *   // Orchestrator
 *   createTestOrchestrator,
 *   
 *   // Background
 *   createMessageRouter,
 *   
 *   // CSV
 *   createCSVProcessingService,
 *   
 *   // Content
 *   createContextBridge,
 *   createNotificationUI,
 * } from '@/core';
 * ```
 */

// ============================================================================
// TYPES MODULE
// ============================================================================

// Re-export all types module exports
export * from './types';

// ============================================================================
// IMPORTS FOR RESET FUNCTION
// ============================================================================

import {
  resetMemoryStorage,
  resetChromeStorage,
  resetIndexedDBStorage,
  resetStorageManager,
} from './storage';

import {
  resetElementFinder,
  resetActionExecutor,
  resetStepExecutor,
} from './replay';

import { resetTabManager } from './orchestrator';

import {
  resetMessageRouter,
  resetBackgroundTabManager,
} from './background';

import { resetAllCSVSingletons } from './csv';

import { resetAllContentSingletons } from './content';

// ============================================================================
// STORAGE MODULE
// ============================================================================

// Re-export all storage module exports
export * from './storage';

// ============================================================================
// REPLAY MODULE
// ============================================================================

// Note: Some exports conflict with types module (StepExecutionResult, formatDuration, formatEta, LogLevel)
// Import directly from '@/core/replay' or '@/core/types' when needed
export * from './replay';

// ============================================================================
// ORCHESTRATOR MODULE
// ============================================================================

// Note: DEFAULT_TAB_MANAGER_CONFIG conflicts with background module
// Import directly from '@/core/orchestrator' or '@/core/background' when needed
export * from './orchestrator';

// ============================================================================
// BACKGROUND MODULE
// ============================================================================

// Note: DEFAULT_TAB_MANAGER_CONFIG conflicts with orchestrator module
// Import directly from '@/core/background' when needed
export * from './background';

// ============================================================================
// CSV MODULE
// ============================================================================

// Note: ValidationResult, ValidationError, ValidationWarning conflict with other modules
// These are re-exported with CSV prefix: CSVValidationResult, CSVValidationError, CSVValidationWarning
export * from './csv';

// ============================================================================
// CONTENT MODULE
// ============================================================================

// Note: formatStepProgress, formatRowProgress, formatReplayProgress are content-specific
// For other progress formatting, see respective modules
export * from './content';

// ============================================================================
// MODULE VERSION
// ============================================================================

/**
 * Core module version
 */
export const CORE_VERSION = '1.0.0';

// ============================================================================
// CONVENIENCE AGGREGATES
// ============================================================================

/**
 * All default configurations
 */
export const ALL_DEFAULTS = {
  storage: {
    dbName: 'anthropic-auto-allow-db',
    dbVersion: 1,
  },
  replay: {
    findTimeout: 2000,
    retryInterval: 150,
    maxRetries: 13,
    fuzzyThreshold: 0.4,
    boundingBoxThreshold: 200,
  },
  orchestrator: {
    rowDelay: 1000,
    stepDelay: 0,
    humanDelay: [50, 300] as [number, number],
    stepTimeout: 30000,
  },
  background: {
    handlerTimeout: 30000,
    injectionDelay: 100,
  },
  csv: {
    similarityThreshold: 0.3,
    previewRowCount: 10,
    maxEmptyCellRatio: 0.5,
    minMappedFields: 1,
  },
  content: {
    stepTimeout: 30000,
    notificationDuration: 3000,
    animationDuration: 300,
    extensionTimeout: 30000,
  },
} as const;

/**
 * Reset all singletons (for testing)
 */
export function resetAllSingletons(): void {
  // Storage
  resetMemoryStorage();
  resetChromeStorage();
  resetIndexedDBStorage();
  resetStorageManager();
  
  // Replay
  resetElementFinder();
  resetActionExecutor();
  resetStepExecutor();
  
  // Orchestrator
  resetTabManager();
  
  // Background
  resetMessageRouter();
  resetBackgroundTabManager();
  
  // CSV
  resetAllCSVSingletons();
  
  // Content
  resetAllContentSingletons();
}

/**
 * Note: To access individual module exports when there are naming conflicts,
 * import from the specific module instead:
 * 
 * @example
 * ```typescript
 * // For orchestrator tab manager
 * import { DEFAULT_TAB_MANAGER_CONFIG } from '@/core/orchestrator';
 * 
 * // For background tab manager  
 * import { DEFAULT_TAB_MANAGER_CONFIG } from '@/core/background';
 * 
 * // For types
 * import { StepExecutionResult } from '@/core/types';
 * 
 * // For replay
 * import { StepExecutionResult } from '@/core/replay';
 * ```
 */
