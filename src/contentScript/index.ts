/**
 * Content Script - Barrel Export
 * @module contentScript
 * @version 1.0.0
 * 
 * Re-exports all content script components.
 */

// ============================================================================
// MAIN SERVICE
// ============================================================================

export {
  ContentScriptService,
  type ContentScriptConfig,
  type ContentScriptState,
  type ContentScriptMode,
} from './ContentScriptService';

// ============================================================================
// MODES
// ============================================================================

export {
  RecordingMode,
  type RecordedEvent,
} from './RecordingMode';

export {
  ReplayMode,
  type StepResult,
  type FindOptions,
} from './ReplayMode';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  IframeManager,
} from './IframeManager';

export {
  NotificationOverlay,
  type NotificationOptions,
} from './NotificationOverlay';
