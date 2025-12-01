/**
 * UI Module - Central export barrel
 * @module ui
 * @version 1.0.0
 * 
 * Provides a unified entry point for all UI-related exports.
 * Organized by category for clean imports throughout the extension.
 * 
 * @example
 * ```typescript
 * // Import specific items
 * import { PopupApp, RecordingControls, useTheme } from '../ui';
 * 
 * // Import types
 * import type { PopupView, ThemeMode } from '../ui';
 * ```
 */

// ============================================================================
// POPUP MODULE EXPORTS
// ============================================================================

/**
 * Popup application and related exports
 */
export {
  // Main popup application
  PopupApp,
  createPopupApp,
  DEFAULT_POPUP_CONFIG,
  
  // Popup messaging
  POPUP_MESSAGES,
  createMessageSender,
  createMockMessageSender,
  
  // Popup views
  POPUP_VIEWS,
  POPUP_DIMENSIONS,
  getViewMetadata,
  VIEW_METADATA,
  isRecordingView,
  requiresTestCases,
  
  // Popup styles
  POPUP_STYLES,
  createPopupContainerStyle,
  createPopupHeaderStyle,
  createPopupContentStyle,
  createPopupFooterStyle,
  
  // Popup initialization
  initializePopup,
} from './popup';

/**
 * Re-export popup types
 */
export type {
  PopupConfig,
  PopupView,
  PopupState,
  PopupAppProps,
  PopupMessage,
  UsePopupStateResult,
  UseRecordingActionsResult,
} from './popup';

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================

/**
 * Reusable UI components
 */
export {
  // Recording components
  RecordingControls,
  CompactRecordingControls,
  ExpandedRecordingControls,
  createRecordingControls,
  
  // Step components
  StepList,
  createStepList,
  
  // Button variants
  BUTTON_VARIANTS,
  
  // Layout variants
  LAYOUT_VARIANTS,
  
  // Keyboard shortcuts
  DEFAULT_SHORTCUTS,
  
  // Step display
  STEP_ICONS,
  STEP_COLORS,
  STEP_STATUS,
  
  // Status colors
  STATUS_COLORS,
} from './components';

/**
 * Re-export component types
 */
export type {
  // Recording types
  RecordingControlsProps,
  ButtonVariant,
  LayoutVariant,
  
  // Step types
  StepListProps,
  StepListItem,
  StepStatus,
  
  // Shared types
  SizeVariant,
  BaseComponentProps,
} from './components';

// ============================================================================
// THEME AND STYLE EXPORTS
// ============================================================================

/**
 * Theme constants and utilities
 */
export {
  // Color palette
  COLORS,
  
  // Spacing scale
  SPACING,
  
  // Border radius
  BORDER_RADIUS,
  
  // Typography
  FONT_SIZES,
  FONT_WEIGHTS,
  
  // Transitions
  TRANSITIONS,
  
  // Shadows
  SHADOWS,
  
  // Style utilities
  createButtonStyle,
  createInputStyle,
  createCardStyle,
  classNames,
  mergeStyles,
} from './components';

// ============================================================================
// COMPONENT PRESETS
// ============================================================================

/**
 * Pre-configured component variants
 */
export {
  RECORDING_CONTROL_PRESETS,
  STEP_LIST_PRESETS,
} from './components';

// ============================================================================
// ICON EXPORTS
// ============================================================================

/**
 * Icon constants
 */
export {
  ICONS,
} from './components';

// ============================================================================
// ACCESSIBILITY EXPORTS
// ============================================================================

/**
 * Accessibility utilities
 */
export {
  createAriaProps,
  KEYBOARD,
  isActivationKey,
  isNavigationKey,
} from './components';

// ============================================================================
// TYPE RE-EXPORTS FROM CORE
// ============================================================================

/**
 * Re-export commonly used types from core for convenience
 * These are already re-exported from popup and components modules
 */
export type {
  // Recording types
  RecordingState,
  RecordingSession,
  
  // Replay types
  ReplayState,
  ReplayResult,
} from './popup';

/**
 * Re-export step types from components
 */
export type {
  // Step types
  RecordedStep,
  StepType,
  StepTarget,
} from './components';

// ============================================================================
// VERSION EXPORT
// ============================================================================

/**
 * UI module version
 */
export const UI_VERSION = '1.0.0';

/**
 * UI module metadata
 */
export const UI_MODULE_INFO = {
  name: 'ui',
  version: UI_VERSION,
  description: 'Chrome Extension Test Recorder UI Module',
  exports: [
    'popup',
    'components',
  ],
  components: [
    'PopupApp',
    'RecordingControls',
    'StepList',
  ],
  utilities: [
    'createMessageSender',
    'createButtonStyle',
    'createInputStyle',
    'createCardStyle',
    'classNames',
    'mergeStyles',
    'createAriaProps',
    'isActivationKey',
    'isNavigationKey',
  ],
  constants: [
    'POPUP_VIEWS',
    'POPUP_DIMENSIONS',
    'POPUP_MESSAGES',
    'BUTTON_VARIANTS',
    'LAYOUT_VARIANTS',
    'STEP_ICONS',
    'STEP_COLORS',
    'STATUS_COLORS',
    'COLORS',
    'SPACING',
    'ICONS',
    'KEYBOARD',
  ],
} as const;
