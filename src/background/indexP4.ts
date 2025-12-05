/**
 * Background - P4-214 Barrel Export
 * @module background/indexP4
 * @version 1.0.0
 * 
 * Re-exports all P4-214 background service components.
 */

// ============================================================================
// MAIN SERVICE
// ============================================================================

export {
  BackgroundService,
  type BackgroundServiceConfig,
  type BackgroundServiceState,
} from './BackgroundService';

// ============================================================================
// CORE COMPONENTS
// ============================================================================

export {
  MessageRouter,
  type Message,
  type MessageResponse,
  type MessageHandler,
  type HandlerRegistration,
} from './MessageRouter';

export {
  TabManager,
  type TabInfo,
  type TabOpenOptions,
  type TabOpenResult,
} from './TabManager';

export {
  ScriptInjector,
  type InjectionOptions,
  type InjectionResult,
} from './ScriptInjector';

// ============================================================================
// HANDLERS
// ============================================================================

export {
  registerAllHandlers,
  registerStorageHandlers,
  registerTabHandlers,
  registerRecordingHandlersP4,
  registerReplayHandlersP4,
} from './handlers/handlersP4';
