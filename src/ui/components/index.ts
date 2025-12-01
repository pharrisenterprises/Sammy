/**
 * UI Components - Central export barrel
 * @module ui/components
 * @version 1.0.0
 * 
 * Provides a unified entry point for all reusable UI components.
 * 
 * Main Components:
 * - RecordingControls: Recording start/stop/pause/resume buttons
 * - StepList: Displays recorded steps in a list
 * 
 * @example
 * ```typescript
 * import {
 *   RecordingControls,
 *   StepList,
 *   CompactRecordingControls,
 *   STEP_ICONS,
 *   STEP_COLORS,
 * } from '@/ui/components';
 * 
 * // Use components
 * <RecordingControls
 *   state="idle"
 *   onStart={handleStart}
 *   onStop={handleStop}
 * />
 * 
 * <StepList
 *   steps={recordedSteps}
 *   onStepClick={handleStepClick}
 * />
 * ```
 */

// ============================================================================
// RECORDING CONTROLS
// ============================================================================

export {
  // Main component
  RecordingControls,
  
  // Specialized variants
  CompactRecordingControls,
  ExpandedRecordingControls,
  
  // Factory function
  createRecordingControls,
  
  // Constants
  BUTTON_VARIANTS,
  LAYOUT_VARIANTS,
  DEFAULT_SHORTCUTS,
  
  // Types
  type ButtonVariant,
  type LayoutVariant,
  type RecordingControlsProps,
} from './RecordingControls';

// ============================================================================
// STEP LIST
// ============================================================================

export {
  // Main component
  StepList,
  
  // Factory function
  createStepList,
  
  // Constants
  STEP_ICONS,
  STEP_COLORS,
  STEP_STATUS,
  STATUS_COLORS,
  
  // Types
  type StepStatus,
  type StepListItem,
  type StepListProps,
} from './StepList';

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Common size variants used across components
 */
export type SizeVariant = 'small' | 'medium' | 'large';

/**
 * Common component base props
 */
export interface BaseComponentProps {
  /** Custom class name */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Data test ID for testing */
  'data-testid'?: string;
}

// ============================================================================
// THEME CONSTANTS
// ============================================================================

/**
 * Shared color palette
 */
export const COLORS = {
  // Primary
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: '#eff6ff',
  
  // Success
  success: '#10b981',
  successHover: '#059669',
  successLight: '#ecfdf5',
  
  // Warning
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningLight: '#fffbeb',
  
  // Danger
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerLight: '#fef2f2',
  
  // Neutral
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  
  // Text
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  
  // Background
  background: '#ffffff',
  backgroundAlt: '#f9fafb',
  
  // Border
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
} as const;

/**
 * Shared spacing scale
 */
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

/**
 * Shared border radius scale
 */
export const BORDER_RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

/**
 * Shared font sizes
 */
export const FONT_SIZES = {
  xs: '11px',
  sm: '12px',
  md: '13px',
  lg: '14px',
  xl: '16px',
  xxl: '18px',
} as const;

/**
 * Shared font weights
 */
export const FONT_WEIGHTS = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Shared transitions
 */
export const TRANSITIONS = {
  fast: '0.1s ease',
  normal: '0.15s ease',
  slow: '0.25s ease',
} as const;

/**
 * Shared shadows
 */
export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a consistent button style object
 * 
 * @param variant - Button variant
 * @param size - Button size
 * @returns Style object
 */
export function createButtonStyle(
  variant: 'primary' | 'secondary' | 'danger' | 'success' = 'primary',
  size: SizeVariant = 'medium'
): React.CSSProperties {
  const sizeStyles = {
    small: { padding: '6px 12px', fontSize: FONT_SIZES.sm },
    medium: { padding: '10px 16px', fontSize: FONT_SIZES.lg },
    large: { padding: '14px 24px', fontSize: FONT_SIZES.xl },
  };
  
  const variantStyles = {
    primary: {
      backgroundColor: COLORS.primary,
      color: '#ffffff',
      border: 'none',
    },
    secondary: {
      backgroundColor: COLORS.background,
      color: COLORS.gray700,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      backgroundColor: COLORS.danger,
      color: '#ffffff',
      border: 'none',
    },
    success: {
      backgroundColor: COLORS.success,
      color: '#ffffff',
      border: 'none',
    },
  };
  
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    fontWeight: FONT_WEIGHTS.medium,
    cursor: 'pointer',
    transition: `background-color ${TRANSITIONS.normal}, opacity ${TRANSITIONS.normal}`,
    outline: 'none',
    ...sizeStyles[size],
    ...variantStyles[variant],
  };
}

/**
 * Creates a consistent input style object
 * 
 * @param size - Input size
 * @returns Style object
 */
export function createInputStyle(size: SizeVariant = 'medium'): React.CSSProperties {
  const sizeStyles = {
    small: { padding: '6px 10px', fontSize: FONT_SIZES.sm },
    medium: { padding: '8px 12px', fontSize: FONT_SIZES.md },
    large: { padding: '12px 16px', fontSize: FONT_SIZES.lg },
  };
  
  return {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    transition: `border-color ${TRANSITIONS.normal}, box-shadow ${TRANSITIONS.normal}`,
    outline: 'none',
    ...sizeStyles[size],
  };
}

/**
 * Creates a consistent card style object
 * 
 * @param elevated - Whether card has shadow
 * @returns Style object
 */
export function createCardStyle(elevated: boolean = false): React.CSSProperties {
  return {
    backgroundColor: COLORS.background,
    border: `1px solid ${COLORS.border}`,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...(elevated ? { boxShadow: SHADOWS.md } : {}),
  };
}

/**
 * Combines class names, filtering out falsy values
 * 
 * @param classes - Class names to combine
 * @returns Combined class name string
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Merges style objects
 * 
 * @param styles - Style objects to merge
 * @returns Merged style object
 */
export function mergeStyles(
  ...styles: (React.CSSProperties | undefined | null)[]
): React.CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}

// ============================================================================
// COMPONENT PRESETS
// ============================================================================

/**
 * Recording control presets
 */
export const RECORDING_CONTROL_PRESETS = {
  /** Compact toolbar controls */
  toolbar: {
    layout: 'compact' as const,
    size: 'small' as const,
    showStepCount: true,
    showDuration: true,
  },
  /** Expanded panel controls */
  panel: {
    layout: 'expanded' as const,
    size: 'medium' as const,
    showStepCount: true,
    showDuration: true,
    showTestName: true,
  },
  /** Minimal overlay controls */
  overlay: {
    layout: 'horizontal' as const,
    size: 'small' as const,
    showStepCount: false,
    showDuration: false,
  },
} as const;

/**
 * Step list presets
 */
export const STEP_LIST_PRESETS = {
  /** Compact list for sidebar */
  compact: {
    size: 'small' as const,
    showNumbers: true,
    showStatus: false,
    showDuration: false,
    enableReorder: false,
  },
  /** Detailed list for editor */
  detailed: {
    size: 'medium' as const,
    showNumbers: true,
    showStatus: false,
    showDuration: false,
    enableReorder: true,
  },
  /** Replay view list */
  replay: {
    size: 'medium' as const,
    showNumbers: true,
    showStatus: true,
    showDuration: true,
    readOnly: true,
    enableReorder: false,
  },
  /** Results view list */
  results: {
    size: 'medium' as const,
    showNumbers: true,
    showStatus: true,
    showDuration: true,
    readOnly: true,
    enableReorder: false,
  },
} as const;

// ============================================================================
// ICON HELPERS
// ============================================================================

/**
 * Common UI icons
 */
export const ICONS = {
  // Actions
  play: '▶️',
  pause: '⏸️',
  stop: '⏹️',
  record: '⏺️',
  refresh: '🔄',
  close: '✕',
  check: '✓',
  plus: '+',
  minus: '−',
  
  // Navigation
  arrowLeft: '←',
  arrowRight: '→',
  arrowUp: '↑',
  arrowDown: '↓',
  chevronLeft: '‹',
  chevronRight: '›',
  chevronUp: '⌃',
  chevronDown: '⌄',
  
  // Status
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  
  // Objects
  folder: '📁',
  file: '📄',
  settings: '⚙️',
  search: '🔍',
  filter: '🔽',
  sort: '↕️',
  
  // Editing
  edit: '✏️',
  delete: '🗑️',
  copy: '📋',
  paste: '📌',
  undo: '↩️',
  redo: '↪️',
  
  // Misc
  drag: '⋮⋮',
  menu: '☰',
  more: '⋯',
  external: '↗️',
} as const;

// Note: Step icon/color helpers are available from individual components
// Import { STEP_ICONS, STEP_COLORS, STATUS_COLORS } from '@/ui/components'

// ============================================================================
// ACCESSIBILITY HELPERS
// ============================================================================

/**
 * Creates ARIA props for interactive elements
 * 
 * @param label - Accessible label
 * @param description - Accessible description
 * @returns ARIA props object
 */
export function createAriaProps(
  label?: string,
  description?: string
): Record<string, string | undefined> {
  return {
    'aria-label': label,
    'aria-describedby': description ? `desc-${Date.now()}` : undefined,
  };
}

/**
 * Keyboard navigation helpers
 */
export const KEYBOARD = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
} as const;

/**
 * Checks if event is an activation key (Enter or Space)
 * 
 * @param event - Keyboard event
 * @returns Whether key is activation key
 */
export function isActivationKey(event: React.KeyboardEvent): boolean {
  return event.key === KEYBOARD.ENTER || event.key === KEYBOARD.SPACE;
}

/**
 * Checks if event is a navigation key
 * 
 * @param event - Keyboard event
 * @returns Whether key is navigation key
 */
export function isNavigationKey(event: React.KeyboardEvent): boolean {
  return [
    KEYBOARD.ARROW_UP,
    KEYBOARD.ARROW_DOWN,
    KEYBOARD.ARROW_LEFT,
    KEYBOARD.ARROW_RIGHT,
    KEYBOARD.HOME,
    KEYBOARD.END,
  ].includes(event.key as typeof KEYBOARD.ARROW_UP);
}

// ============================================================================
// RE-EXPORTS FROM TYPES
// ============================================================================

/**
 * Re-export recording types for convenience
 */
export type { RecordingState } from '../../core/types/project';

/**
 * Re-export step types for convenience
 */
export type { RecordedStep, StepType, StepTarget } from '../../core/types/step';
