/**
 * RecordingControls - Recording control buttons component
 * @module ui/components/RecordingControls
 * @version 1.0.0
 * 
 * Reusable component for recording start/stop/pause/resume controls.
 * Provides visual feedback and keyboard accessibility.
 * 
 * Features:
 * - Start/stop recording controls
 * - Pause/resume functionality
 * - Visual state indicators
 * - Step counter display
 * - Duration timer
 * - Keyboard shortcuts
 * - Multiple layout variants
 * 
 * @see ui-components_breakdown.md for architecture details
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { RecordingState } from '../../core/types/recording';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Control button variants
 */
export const BUTTON_VARIANTS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  DANGER: 'danger',
  SUCCESS: 'success',
} as const;

/**
 * Layout variants
 */
export const LAYOUT_VARIANTS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  COMPACT: 'compact',
  EXPANDED: 'expanded',
} as const;

/**
 * Button variant type
 */
export type ButtonVariant = typeof BUTTON_VARIANTS[keyof typeof BUTTON_VARIANTS];

/**
 * Layout variant type
 */
export type LayoutVariant = typeof LAYOUT_VARIANTS[keyof typeof LAYOUT_VARIANTS];

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS = {
  startStop: 'Alt+Shift+R',
  pauseResume: 'Alt+Shift+P',
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * RecordingControls props
 */
export interface RecordingControlsProps {
  /** Current recording state */
  state: RecordingState;
  /** Number of steps recorded */
  stepCount?: number;
  /** Recording duration in ms */
  duration?: number;
  /** Test case name being recorded */
  testCaseName?: string;
  /** Layout variant */
  layout?: LayoutVariant;
  /** Whether to show step counter */
  showStepCount?: boolean;
  /** Whether to show duration timer */
  showDuration?: boolean;
  /** Whether to show test case name */
  showTestName?: boolean;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Whether to show keyboard shortcuts */
  showShortcuts?: boolean;
  /** Custom keyboard shortcuts */
  shortcuts?: Partial<typeof DEFAULT_SHORTCUTS>;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** On start recording */
  onStart?: () => void;
  /** On stop recording */
  onStop?: () => void;
  /** On pause recording */
  onPause?: () => void;
  /** On resume recording */
  onResume?: () => void;
  /** On cancel recording */
  onCancel?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

/**
 * Button config
 */
interface ButtonConfig {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  variant: ButtonVariant;
  disabled?: boolean;
  title?: string;
  shortcut?: string;
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (size: 'small' | 'medium' | 'large') => {
  const sizes = {
    small: {
      padding: '6px 12px',
      fontSize: '12px',
      iconSize: '14px',
      gap: '4px',
    },
    medium: {
      padding: '10px 16px',
      fontSize: '14px',
      iconSize: '18px',
      gap: '8px',
    },
    large: {
      padding: '14px 24px',
      fontSize: '16px',
      iconSize: '22px',
      gap: '12px',
    },
  };
  
  const s = sizes[size];
  
  return {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: s.gap,
    },
    horizontalContainer: {
      display: 'flex',
      flexDirection: 'row' as const,
      alignItems: 'center',
      gap: s.gap,
    },
    verticalContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: s.gap,
    },
    compactContainer: {
      display: 'flex',
      flexDirection: 'row' as const,
      alignItems: 'center',
      gap: '4px',
    },
    expandedContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
    },
    statusBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      backgroundColor: '#f3f4f6',
      borderRadius: '6px',
      fontSize: s.fontSize,
    },
    statusIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    recordingDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: '#ef4444',
      animation: 'pulse 1.5s ease-in-out infinite',
    },
    pausedDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: '#f59e0b',
    },
    idleDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: '#6b7280',
    },
    statusText: {
      fontWeight: 500,
      color: '#374151',
    },
    statusMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '12px',
      color: '#6b7280',
    },
    buttonGroup: {
      display: 'flex',
      gap: s.gap,
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      padding: s.padding,
      border: 'none',
      borderRadius: '6px',
      fontSize: s.fontSize,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.15s, opacity 0.15s, transform 0.1s',
      outline: 'none',
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
    secondaryButton: {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db',
    },
    dangerButton: {
      backgroundColor: '#ef4444',
      color: '#ffffff',
    },
    successButton: {
      backgroundColor: '#10b981',
      color: '#ffffff',
    },
    disabledButton: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    icon: {
      fontSize: s.iconSize,
    },
    shortcut: {
      fontSize: '10px',
      opacity: 0.7,
      marginLeft: '4px',
    },
    testName: {
      fontSize: '13px',
      color: '#4b5563',
      fontWeight: 500,
      marginBottom: '4px',
    },
    controlsRow: {
      display: 'flex',
      gap: s.gap,
    },
  } as const;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats duration as mm:ss or hh:mm:ss
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Gets status text for recording state
 */
function getStatusText(state: RecordingState): string {
  switch (state) {
    case 'recording':
      return 'Recording';
    case 'paused':
      return 'Paused';
    case 'idle':
    default:
      return 'Ready';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RecordingControls - Recording control buttons
 */
export const RecordingControls: React.FC<RecordingControlsProps> = ({
  state,
  stepCount = 0,
  duration = 0,
  testCaseName,
  layout = LAYOUT_VARIANTS.HORIZONTAL,
  showStepCount = true,
  showDuration = true,
  showTestName = false,
  disabled = false,
  showShortcuts = false,
  shortcuts = DEFAULT_SHORTCUTS,
  size = 'medium',
  onStart,
  onStop,
  onPause,
  onResume,
  onCancel,
  className,
  style,
}) => {
  // State
  const [elapsedTime, setElapsedTime] = useState(duration);
  
  // Styles
  const styles = useMemo(() => createStyles(size), [size]);
  
  // Timer effect
  useEffect(() => {
    if (state === 'recording') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1000);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [state]);
  
  // Reset elapsed time when duration prop changes
  useEffect(() => {
    setElapsedTime(duration);
  }, [duration]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      
      const shortcutMap: Record<string, () => void> = {};
      
      if (shortcuts.startStop) {
        shortcutMap[shortcuts.startStop.toLowerCase()] = () => {
          if (state === 'idle') {
            onStart?.();
          } else {
            onStop?.();
          }
        };
      }
      
      if (shortcuts.pauseResume) {
        shortcutMap[shortcuts.pauseResume.toLowerCase()] = () => {
          if (state === 'recording') {
            onPause?.();
          } else if (state === 'paused') {
            onResume?.();
          }
        };
      }
      
      // Build pressed keys string
      const keys: string[] = [];
      if (e.altKey) keys.push('alt');
      if (e.shiftKey) keys.push('shift');
      if (e.ctrlKey) keys.push('ctrl');
      if (e.metaKey) keys.push('meta');
      keys.push(e.key.toLowerCase());
      
      const pressedShortcut = keys.join('+');
      
      // Check against shortcuts
      for (const [shortcut, handler] of Object.entries(shortcutMap)) {
        const normalizedShortcut = shortcut
          .split('+')
          .map(k => k.toLowerCase().trim())
          .sort()
          .join('+');
        const normalizedPressed = keys.sort().join('+');
        
        if (normalizedShortcut === normalizedPressed) {
          e.preventDefault();
          handler();
          break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, disabled, shortcuts, onStart, onStop, onPause, onResume]);
  
  // Button configurations
  const getButtons = useCallback((): ButtonConfig[] => {
    const buttons: ButtonConfig[] = [];
    
    if (state === 'idle') {
      buttons.push({
        id: 'start',
        label: 'Start Recording',
        icon: '⏺️',
        onClick: () => onStart?.(),
        variant: BUTTON_VARIANTS.DANGER,
        disabled: disabled || !onStart,
        title: 'Start recording',
        shortcut: showShortcuts ? shortcuts.startStop : undefined,
      });
    } else if (state === 'recording') {
      buttons.push({
        id: 'pause',
        label: 'Pause',
        icon: '⏸️',
        onClick: () => onPause?.(),
        variant: BUTTON_VARIANTS.SECONDARY,
        disabled: disabled || !onPause,
        title: 'Pause recording',
        shortcut: showShortcuts ? shortcuts.pauseResume : undefined,
      });
      buttons.push({
        id: 'stop',
        label: 'Stop',
        icon: '⏹️',
        onClick: () => onStop?.(),
        variant: BUTTON_VARIANTS.DANGER,
        disabled: disabled || !onStop,
        title: 'Stop recording',
        shortcut: showShortcuts ? shortcuts.startStop : undefined,
      });
    } else if (state === 'paused') {
      buttons.push({
        id: 'resume',
        label: 'Resume',
        icon: '▶️',
        onClick: () => onResume?.(),
        variant: BUTTON_VARIANTS.PRIMARY,
        disabled: disabled || !onResume,
        title: 'Resume recording',
        shortcut: showShortcuts ? shortcuts.pauseResume : undefined,
      });
      buttons.push({
        id: 'stop',
        label: 'Stop',
        icon: '⏹️',
        onClick: () => onStop?.(),
        variant: BUTTON_VARIANTS.DANGER,
        disabled: disabled || !onStop,
        title: 'Stop recording',
        shortcut: showShortcuts ? shortcuts.startStop : undefined,
      });
    }
    
    // Add cancel button if handler provided and not idle
    if (onCancel && state !== 'idle') {
      buttons.push({
        id: 'cancel',
        label: 'Cancel',
        icon: '✕',
        onClick: () => onCancel(),
        variant: BUTTON_VARIANTS.SECONDARY,
        disabled,
        title: 'Cancel recording',
      });
    }
    
    return buttons;
  }, [state, disabled, onStart, onStop, onPause, onResume, onCancel, showShortcuts, shortcuts]);
  
  // Get button style
  const getButtonStyle = (variant: ButtonVariant, isDisabled: boolean): React.CSSProperties => {
    const baseStyle = styles.button;
    let variantStyle: React.CSSProperties;
    
    switch (variant) {
      case BUTTON_VARIANTS.PRIMARY:
        variantStyle = styles.primaryButton;
        break;
      case BUTTON_VARIANTS.DANGER:
        variantStyle = styles.dangerButton;
        break;
      case BUTTON_VARIANTS.SUCCESS:
        variantStyle = styles.successButton;
        break;
      case BUTTON_VARIANTS.SECONDARY:
      default:
        variantStyle = styles.secondaryButton;
        break;
    }
    
    return {
      ...baseStyle,
      ...variantStyle,
      ...(isDisabled ? styles.disabledButton : {}),
    };
  };
  
  // Get container style
  const getContainerStyle = (): React.CSSProperties => {
    switch (layout) {
      case LAYOUT_VARIANTS.VERTICAL:
        return styles.verticalContainer;
      case LAYOUT_VARIANTS.COMPACT:
        return styles.compactContainer;
      case LAYOUT_VARIANTS.EXPANDED:
        return styles.expandedContainer;
      case LAYOUT_VARIANTS.HORIZONTAL:
      default:
        return styles.horizontalContainer;
    }
  };
  
  // Get status dot style
  const getStatusDotStyle = (): React.CSSProperties => {
    switch (state) {
      case 'recording':
        return styles.recordingDot;
      case 'paused':
        return styles.pausedDot;
      default:
        return styles.idleDot;
    }
  };
  
  const buttons = getButtons();
  const isExpanded = layout === LAYOUT_VARIANTS.EXPANDED;
  
  return (
    <div
      style={{ ...getContainerStyle(), ...style }}
      className={className}
      data-testid="recording-controls"
      role="group"
      aria-label="Recording controls"
    >
      {/* Test name (expanded layout) */}
      {showTestName && testCaseName && isExpanded && (
        <div style={styles.testName} data-testid="test-name">
          {testCaseName}
        </div>
      )}
      
      {/* Status bar (expanded layout) */}
      {isExpanded && (
        <div style={styles.statusBar} data-testid="status-bar">
          <div style={styles.statusIndicator}>
            <div
              style={getStatusDotStyle()}
              data-testid="status-dot"
            />
            <span style={styles.statusText}>
              {getStatusText(state)}
            </span>
          </div>
          <div style={styles.statusMeta}>
            {showStepCount && (
              <span data-testid="step-count">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'}
              </span>
            )}
            {showDuration && state !== 'idle' && (
              <span data-testid="duration">
                {formatDuration(elapsedTime)}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Inline status (non-expanded) */}
      {!isExpanded && state !== 'idle' && (showStepCount || showDuration) && (
        <div style={styles.statusMeta} data-testid="inline-status">
          <div style={getStatusDotStyle()} />
          {showStepCount && (
            <span data-testid="step-count">{stepCount} steps</span>
          )}
          {showDuration && (
            <span data-testid="duration">{formatDuration(elapsedTime)}</span>
          )}
        </div>
      )}
      
      {/* Control buttons */}
      <div style={styles.buttonGroup} data-testid="button-group">
        {buttons.map(button => (
          <button
            key={button.id}
            style={getButtonStyle(button.variant, button.disabled ?? false)}
            onClick={button.onClick}
            disabled={button.disabled}
            title={button.title}
            data-testid={`btn-${button.id}`}
            aria-label={button.label}
          >
            <span style={styles.icon}>{button.icon}</span>
            {layout !== LAYOUT_VARIANTS.COMPACT && (
              <span>{button.label}</span>
            )}
            {button.shortcut && (
              <span style={styles.shortcut}>({button.shortcut})</span>
            )}
          </button>
        ))}
      </div>
      
      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// SPECIALIZED VARIANTS
// ============================================================================

/**
 * Compact recording controls for toolbar/overlay
 */
export const CompactRecordingControls: React.FC<Omit<RecordingControlsProps, 'layout'>> = (props) => (
  <RecordingControls {...props} layout={LAYOUT_VARIANTS.COMPACT} size="small" />
);

/**
 * Expanded recording controls for popup/panel
 */
export const ExpandedRecordingControls: React.FC<Omit<RecordingControlsProps, 'layout'>> = (props) => (
  <RecordingControls {...props} layout={LAYOUT_VARIANTS.EXPANDED} showTestName />
);

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a RecordingControls component with preset configuration
 * 
 * @param preset - Configuration preset
 * @returns Configured component
 */
export function createRecordingControls(
  preset: 'compact' | 'expanded' | 'default' = 'default'
): React.FC<Omit<RecordingControlsProps, 'layout'>> {
  switch (preset) {
    case 'compact':
      return CompactRecordingControls;
    case 'expanded':
      return ExpandedRecordingControls;
    default:
      return RecordingControls as React.FC<Omit<RecordingControlsProps, 'layout'>>;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default RecordingControls;
