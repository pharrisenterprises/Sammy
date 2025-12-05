/**
 * Handlers - P4-214 Handler Registration
 * @module background/handlers/handlersP4
 * @version 1.0.0
 * 
 * Exports P4-214 refactored message handlers and registration function.
 */

import { MessageRouter } from '../MessageRouter';
import { TabManager } from '../TabManager';
import { ScriptInjector } from '../ScriptInjector';
import type { BackgroundService } from '../BackgroundService';

import { registerStorageHandlers } from './StorageHandlers';
import { registerTabHandlers } from './TabHandlers';
import { registerRecordingHandlersP4 } from './RecordingHandlersP4';
import { registerReplayHandlersP4 } from './ReplayHandlersP4';

// ============================================================================
// EXPORTS
// ============================================================================

export { registerStorageHandlers } from './StorageHandlers';
export { registerTabHandlers } from './TabHandlers';
export { registerRecordingHandlersP4 } from './RecordingHandlersP4';
export { registerReplayHandlersP4 } from './ReplayHandlersP4';

// ============================================================================
// REGISTER ALL HANDLERS (P4-214)
// ============================================================================

/**
 * Register all P4-214 message handlers
 */
export function registerAllHandlers(
  router: MessageRouter,
  tabManager: TabManager,
  scriptInjector: ScriptInjector,
  backgroundService: BackgroundService
): void {
  // Storage handlers (projects, test runs)
  registerStorageHandlers(router);

  // Tab handlers (open, close, inject)
  registerTabHandlers(router, tabManager, scriptInjector);

  // Recording handlers (start, stop, events)
  registerRecordingHandlersP4(router, backgroundService);

  // Replay handlers (execute steps)
  registerReplayHandlersP4(router, tabManager);

  console.log(`Registered ${router.getRegisteredActions().length} P4-214 message handlers`);
}

export default registerAllHandlers;
