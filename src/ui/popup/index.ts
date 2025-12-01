/**
 * Popup Module - Central export barrel
 * @module ui/popup
 * @version 1.0.0
 * 
 * Provides a unified entry point for the extension popup UI.
 * 
 * Main Components:
 * - PopupApp: Main popup container component
 * 
 * @example
 * ```typescript
 * import {
 *   PopupApp,
 *   POPUP_VIEWS,
 *   POPUP_DIMENSIONS,
 *   createPopupApp,
 * } from '@/ui/popup';
 * 
 * // Render popup
 * ReactDOM.render(<PopupApp />, document.getElementById('root'));
 * 
 * // Or with configuration
 * const ConfiguredPopup = createPopupApp({
 *   initialView: POPUP_VIEWS.HOME,
 *   onViewChange: (view) => console.log('View changed:', view),
 * });
 * ```
 */

// ============================================================================
// POPUP APP
// ============================================================================

export {
  // Main component
  PopupApp,
  
  // Factory function
  createPopupApp,
  
  // Constants
  POPUP_VIEWS,
  POPUP_DIMENSIONS,
  STATUS_COLORS,
  
  // Types
  type PopupView,
  type PopupState,
  type PopupAppProps,
} from './PopupApp';

// Import for internal use
import { POPUP_DIMENSIONS } from './PopupApp';

// ============================================================================
// RE-EXPORTS FROM COMPONENTS
// ============================================================================

/**
 * Re-export commonly used components for popup convenience
 */
export {
  // Recording controls
  RecordingControls,
  CompactRecordingControls,
  ExpandedRecordingControls,
  BUTTON_VARIANTS,
  LAYOUT_VARIANTS,
  
  // Step list
  StepList,
  STEP_ICONS,
  STEP_COLORS,
  STEP_STATUS,
  
  // Types
  type RecordingControlsProps,
  type StepListProps,
  type StepListItem,
  type StepStatus,
} from '../components';

// ============================================================================
// POPUP-SPECIFIC UTILITIES
// ============================================================================

/**
 * Default popup configuration
 */
export const DEFAULT_POPUP_CONFIG = {
  /** Initial view to show */
  initialView: 'home' as const,
  /** Whether to auto-connect to background */
  autoConnect: true,
  /** Connection timeout (ms) */
  connectionTimeout: 5000,
  /** Whether to show loading state */
  showLoading: true,
  /** Whether to show error messages */
  showErrors: true,
};

/**
 * Popup configuration type
 */
export type PopupConfig = typeof DEFAULT_POPUP_CONFIG;

/**
 * Message types used by popup
 */
export const POPUP_MESSAGES = {
  // Status
  GET_STATUS: 'GET_STATUS',
  GET_TEST_COUNT: 'GET_TEST_COUNT',
  
  // Recording
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  PAUSE_RECORDING: 'PAUSE_RECORDING',
  RESUME_RECORDING: 'RESUME_RECORDING',
  CANCEL_RECORDING: 'CANCEL_RECORDING',
  
  // Test cases
  GET_TEST_CASES: 'GET_TEST_CASES',
  DELETE_TEST_CASE: 'DELETE_TEST_CASE',
  EXPORT_TEST_CASE: 'EXPORT_TEST_CASE',
  
  // Replay
  START_REPLAY: 'START_REPLAY',
  STOP_REPLAY: 'STOP_REPLAY',
  PAUSE_REPLAY: 'PAUSE_REPLAY',
  RESUME_REPLAY: 'RESUME_REPLAY',
  
  // Settings
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  
  // Navigation
  OPEN_OPTIONS: 'OPEN_OPTIONS',
  OPEN_DEVTOOLS: 'OPEN_DEVTOOLS',
} as const;

/**
 * Popup message type
 */
export type PopupMessage = typeof POPUP_MESSAGES[keyof typeof POPUP_MESSAGES];

/**
 * Creates a message sender function for the popup
 * 
 * @param timeout - Message timeout in ms
 * @returns Message sender function
 * 
 * @example
 * ```typescript
 * const sendMessage = createMessageSender(5000);
 * const status = await sendMessage('GET_STATUS');
 * ```
 */
export function createMessageSender(
  timeout: number = 5000
): (type: string, payload?: unknown) => Promise<unknown> {
  return (type: string, payload?: unknown): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout: ${type}`));
      }, timeout);
      
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } else {
        clearTimeout(timeoutId);
        reject(new Error('Chrome runtime not available'));
      }
    });
  };
}

/**
 * Creates a mock message sender for testing
 * 
 * @param responses - Map of message types to responses
 * @returns Mock message sender function
 * 
 * @example
 * ```typescript
 * const mockSender = createMockMessageSender({
 *   GET_STATUS: { recordingState: 'idle' },
 *   GET_TEST_COUNT: { count: 5 },
 * });
 * 
 * <PopupApp sendMessage={mockSender} />
 * ```
 */
export function createMockMessageSender(
  responses: Record<string, unknown> = {}
): (type: string, payload?: unknown) => Promise<unknown> {
  return async (type: string, _payload?: unknown): Promise<unknown> => {
    // Simulate async delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (responses[type] !== undefined) {
      return responses[type];
    }
    
    // Default responses
    switch (type) {
      case POPUP_MESSAGES.GET_STATUS:
        return { recordingState: 'idle', replayState: 'idle' };
      case POPUP_MESSAGES.GET_TEST_COUNT:
        return { count: 0 };
      case POPUP_MESSAGES.START_RECORDING:
      case POPUP_MESSAGES.STOP_RECORDING:
      case POPUP_MESSAGES.PAUSE_RECORDING:
      case POPUP_MESSAGES.RESUME_RECORDING:
        return { success: true };
      default:
        return {};
    }
  };
}

// ============================================================================
// POPUP HOOKS
// ============================================================================

/**
 * Hook result for popup state
 */
export interface UsePopupStateResult {
  /** Current recording state */
  recordingState: 'idle' | 'recording' | 'paused';
  /** Current replay state */
  replayState: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  /** Number of test cases */
  testCaseCount: number;
  /** Whether loading */
  isLoading: boolean;
  /** Whether connected to background */
  isConnected: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh state */
  refresh: () => Promise<void>;
}

/**
 * Hook result for recording actions
 */
export interface UseRecordingActionsResult {
  /** Start recording */
  start: (options?: { testCaseName?: string }) => Promise<void>;
  /** Stop recording */
  stop: () => Promise<void>;
  /** Pause recording */
  pause: () => Promise<void>;
  /** Resume recording */
  resume: () => Promise<void>;
  /** Cancel recording */
  cancel: () => Promise<void>;
  /** Whether action is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

// ============================================================================
// VIEW HELPERS
// ============================================================================

/**
 * View metadata
 */
export const VIEW_METADATA: Record<string, {
  title: string;
  icon: string;
  description: string;
}> = {
  home: {
    title: 'Home',
    icon: '🏠',
    description: 'Quick actions and overview',
  },
  tests: {
    title: 'Tests',
    icon: '📋',
    description: 'View and manage test cases',
  },
  recording: {
    title: 'Recording',
    icon: '⏺️',
    description: 'Recording in progress',
  },
  replay: {
    title: 'Replay',
    icon: '▶️',
    description: 'Run and watch tests',
  },
  settings: {
    title: 'Settings',
    icon: '⚙️',
    description: 'Configure extension options',
  },
};

/**
 * Gets view metadata
 * 
 * @param view - View name
 * @returns View metadata
 */
export function getViewMetadata(view: string): {
  title: string;
  icon: string;
  description: string;
} {
  return VIEW_METADATA[view] ?? {
    title: view,
    icon: '📄',
    description: '',
  };
}

/**
 * Checks if view requires recording state
 * 
 * @param view - View name
 * @returns Whether view needs recording
 */
export function isRecordingView(view: string): boolean {
  return view === 'recording';
}

/**
 * Checks if view requires test cases
 * 
 * @param view - View name
 * @returns Whether view needs test cases
 */
export function requiresTestCases(view: string): boolean {
  return view === 'tests' || view === 'replay';
}

// ============================================================================
// POPUP STYLES
// ============================================================================

/**
 * Common popup styles
 */
export const POPUP_STYLES = {
  /** Container width */
  containerWidth: POPUP_DIMENSIONS.width,
  
  /** Header height */
  headerHeight: 48,
  
  /** Footer height */
  footerHeight: 36,
  
  /** Content padding */
  contentPadding: 16,
  
  /** Section gap */
  sectionGap: 20,
  
  /** Border radius */
  borderRadius: 8,
  
  /** Font family */
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  
  /** Base font size */
  fontSize: 14,
} as const;

/**
 * Creates popup container style
 * 
 * @returns Container style object
 */
export function createPopupContainerStyle(): React.CSSProperties {
  return {
    width: POPUP_STYLES.containerWidth,
    minHeight: POPUP_DIMENSIONS.minHeight,
    maxHeight: POPUP_DIMENSIONS.maxHeight,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: POPUP_STYLES.fontFamily,
    fontSize: POPUP_STYLES.fontSize,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  };
}

/**
 * Creates popup header style
 * 
 * @returns Header style object
 */
export function createPopupHeaderStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: POPUP_STYLES.headerHeight,
    padding: '0 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  };
}

/**
 * Creates popup content style
 * 
 * @returns Content style object
 */
export function createPopupContentStyle(): React.CSSProperties {
  return {
    flex: 1,
    padding: POPUP_STYLES.contentPadding,
    overflowY: 'auto',
  };
}

/**
 * Creates popup footer style
 * 
 * @returns Footer style object
 */
export function createPopupFooterStyle(): React.CSSProperties {
  return {
    height: POPUP_STYLES.footerHeight,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: 11,
    color: '#9ca3af',
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the popup
 * 
 * @param container - DOM container element
 * @param config - Popup configuration
 * @returns Cleanup function
 * 
 * @example
 * ```typescript
 * const cleanup = initializePopup(
 *   document.getElementById('root'),
 *   { initialView: 'home' }
 * );
 * 
 * // Later, to cleanup
 * cleanup();
 * ```
 */
export function initializePopup(
  container: HTMLElement | null,
  config?: Partial<PopupConfig>
): () => void {
  if (!container) {
    console.error('[Popup] Container element not found');
    return () => {};
  }
  
  const mergedConfig = { ...DEFAULT_POPUP_CONFIG, ...config };
  
  // Log initialization
  console.log('[Popup] Initializing with config:', mergedConfig);
  
  // Return cleanup function
  return () => {
    console.log('[Popup] Cleanup');
  };
}

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

/**
 * Re-export recording types
 */
export type {
  RecordingState,
  RecordingSession,
} from '../../core/types/project';

/**
 * Re-export replay types
 */
export type {
  ReplayState,
  ReplayResult,
} from '../../core/types/replay';

/**
 * Re-export step types
 */
export type {
  RecordedStep,
  StepType,
} from '../../core/types/step';
