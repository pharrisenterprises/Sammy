/**
 * PopupApp - Main popup component for the extension
 * @module ui/popup/PopupApp
 * @version 1.0.0
 * 
 * Primary user interface for the browser extension popup.
 * Provides controls for recording, viewing tests, and settings.
 * 
 * Features:
 * - Recording start/stop controls
 * - Test case list view
 * - Quick access to settings
 * - Status indicators
 * - Navigation between views
 * 
 * @see ui-components_breakdown.md for architecture details
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { RecordingState, RecordingSession } from '../../core/types/recording';
import type { ReplayState } from '../../core/types/replay';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Popup view types
 */
export const POPUP_VIEWS = {
  HOME: 'home',
  TESTS: 'tests',
  RECORDING: 'recording',
  REPLAY: 'replay',
  SETTINGS: 'settings',
} as const;

/**
 * Popup view type
 */
export type PopupView = typeof POPUP_VIEWS[keyof typeof POPUP_VIEWS];

/**
 * Default popup dimensions
 */
export const POPUP_DIMENSIONS = {
  width: 360,
  minHeight: 400,
  maxHeight: 600,
};

/**
 * Status colors
 */
export const STATUS_COLORS = {
  idle: '#6b7280',      // gray
  recording: '#ef4444', // red
  paused: '#f59e0b',    // amber
  running: '#3b82f6',   // blue
  completed: '#10b981', // green
  failed: '#ef4444',    // red
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Popup state
 */
export interface PopupState {
  /** Current view */
  view: PopupView;
  /** Recording state */
  recordingState: RecordingState;
  /** Current recording session */
  recordingSession: RecordingSession | null;
  /** Replay state */
  replayState: ReplayState;
  /** Number of test cases */
  testCaseCount: number;
  /** Last error message */
  error: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Connected to content script */
  isConnected: boolean;
}

/**
 * PopupApp props
 */
export interface PopupAppProps {
  /** Initial view */
  initialView?: PopupView;
  /** Message sender function (injected for testing) */
  sendMessage?: (type: string, payload?: unknown) => Promise<unknown>;
  /** On view change callback */
  onViewChange?: (view: PopupView) => void;
  /** On recording action callback */
  onRecordingAction?: (action: 'start' | 'stop' | 'pause' | 'resume') => void;
}

/**
 * Quick action definition
 */
interface QuickAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: POPUP_DIMENSIONS.width,
    minHeight: POPUP_DIMENSIONS.minHeight,
    maxHeight: POPUP_DIMENSIONS.maxHeight,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '16px',
  },
  logoIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    backgroundColor: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '12px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  iconButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#6b7280',
    transition: 'background-color 0.15s, color 0.15s',
  },
  content: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    marginBottom: '16px',
    borderRadius: '8px',
    backgroundColor: '#f3f4f6',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '13px',
    color: '#4b5563',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  primaryButton: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  secondaryButton: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  dangerButton: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  quickActionButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '6px',
    padding: '16px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s',
  },
  quickActionIcon: {
    fontSize: '20px',
  },
  quickActionLabel: {
    fontSize: '12px',
    color: '#4b5563',
  },
  testCasePreview: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  testCaseItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  testCaseName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#1f2937',
  },
  testCaseMeta: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: '#6b7280',
  },
  emptyStateIcon: {
    fontSize: '32px',
    marginBottom: '12px',
    opacity: 0.5,
  },
  emptyStateText: {
    fontSize: '13px',
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: '11px',
    color: '#9ca3af',
    textAlign: 'center' as const,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    marginBottom: '16px',
    borderRadius: '6px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: '13px',
  },
  loadingOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  recordingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#991b1b',
  },
  recordingMeta: {
    fontSize: '12px',
    color: '#dc2626',
  },
  nav: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
  },
  navItem: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  },
  navItemActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PopupApp - Main popup component
 */
export const PopupApp: React.FC<PopupAppProps> = ({
  initialView = POPUP_VIEWS.HOME,
  sendMessage,
  onViewChange,
  onRecordingAction,
}) => {
  // State
  const [state, setState] = useState<PopupState>({
    view: initialView,
    recordingState: 'idle',
    recordingSession: null,
    replayState: 'idle',
    testCaseCount: 0,
    error: null,
    isLoading: true,
    isConnected: false,
  });
  
  // Derived state
  const isRecording = state.recordingState === 'recording';
  const isPaused = state.recordingState === 'paused';
  const isReplaying = state.replayState === 'running';
  
  // Message sender (use injected or default)
  const send = useCallback(async (type: string, payload?: unknown): Promise<unknown> => {
    if (sendMessage) {
      return sendMessage(type, payload);
    }
    
    // Default: use chrome.runtime.sendMessage
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } else {
        reject(new Error('Chrome runtime not available'));
      }
    });
  }, [sendMessage]);
  
  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      try {
        const [statusResponse, testCountResponse] = await Promise.all([
          send('GET_STATUS'),
          send('GET_TEST_COUNT'),
        ]);
        
        const status = statusResponse as {
          recordingState?: RecordingState;
          recordingSession?: RecordingSession;
          replayState?: ReplayState;
        } | undefined;
        
        const testCount = testCountResponse as { count?: number } | undefined;
        
        setState(prev => ({
          ...prev,
          recordingState: status?.recordingState ?? 'idle',
          recordingSession: status?.recordingSession ?? null,
          replayState: status?.replayState ?? 'idle',
          testCaseCount: testCount?.count ?? 0,
          isLoading: false,
          isConnected: true,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: 'Failed to connect to extension',
          isLoading: false,
          isConnected: false,
        }));
      }
    };
    
    loadState();
  }, [send]);
  
  // Recording actions
  const handleStartRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await send('START_RECORDING', {
        testCaseName: `Recording ${new Date().toLocaleString()}`,
      });
      
      setState(prev => ({
        ...prev,
        recordingState: 'recording',
        view: POPUP_VIEWS.RECORDING,
        isLoading: false,
      }));
      
      onRecordingAction?.('start');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording',
        isLoading: false,
      }));
    }
  }, [send, onRecordingAction]);
  
  const handleStopRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await send('STOP_RECORDING');
      
      setState(prev => ({
        ...prev,
        recordingState: 'idle',
        recordingSession: null,
        view: POPUP_VIEWS.HOME,
        isLoading: false,
        testCaseCount: prev.testCaseCount + 1,
      }));
      
      onRecordingAction?.('stop');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to stop recording',
        isLoading: false,
      }));
    }
  }, [send, onRecordingAction]);
  
  const handlePauseRecording = useCallback(async () => {
    try {
      await send('PAUSE_RECORDING');
      setState(prev => ({ ...prev, recordingState: 'paused' }));
      onRecordingAction?.('pause');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to pause recording',
      }));
    }
  }, [send, onRecordingAction]);
  
  const handleResumeRecording = useCallback(async () => {
    try {
      await send('RESUME_RECORDING');
      setState(prev => ({ ...prev, recordingState: 'recording' }));
      onRecordingAction?.('resume');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to resume recording',
      }));
    }
  }, [send, onRecordingAction]);
  
  // View navigation
  const navigateTo = useCallback((view: PopupView) => {
    setState(prev => ({ ...prev, view }));
    onViewChange?.(view);
  }, [onViewChange]);
  
  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  // Quick actions
  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'record',
      label: 'Record',
      icon: '⏺️',
      onClick: handleStartRecording,
      disabled: isRecording || isReplaying,
      variant: 'primary',
    },
    {
      id: 'tests',
      label: 'Tests',
      icon: '📋',
      onClick: () => navigateTo(POPUP_VIEWS.TESTS),
    },
    {
      id: 'replay',
      label: 'Replay',
      icon: '▶️',
      onClick: () => navigateTo(POPUP_VIEWS.REPLAY),
      disabled: state.testCaseCount === 0,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      onClick: () => navigateTo(POPUP_VIEWS.SETTINGS),
    },
  ], [handleStartRecording, navigateTo, isRecording, isReplaying, state.testCaseCount]);
  
  // Status info
  const statusInfo = useMemo(() => {
    if (isRecording) {
      return {
        color: STATUS_COLORS.recording,
        text: 'Recording in progress...',
      };
    }
    if (isPaused) {
      return {
        color: STATUS_COLORS.paused,
        text: 'Recording paused',
      };
    }
    if (isReplaying) {
      return {
        color: STATUS_COLORS.running,
        text: 'Replay in progress...',
      };
    }
    if (!state.isConnected) {
      return {
        color: STATUS_COLORS.failed,
        text: 'Not connected',
      };
    }
    return {
      color: STATUS_COLORS.idle,
      text: 'Ready',
    };
  }, [isRecording, isPaused, isReplaying, state.isConnected]);
  
  // Render home view
  const renderHomeView = () => (
    <>
      {/* Status bar */}
      <div style={styles.statusBar}>
        <div
          style={{
            ...styles.statusIndicator,
            backgroundColor: statusInfo.color,
          }}
        />
        <span style={styles.statusText}>{statusInfo.text}</span>
      </div>
      
      {/* Quick actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Quick Actions</div>
        <div style={styles.quickActions}>
          {quickActions.map(action => (
            <button
              key={action.id}
              style={{
                ...styles.quickActionButton,
                opacity: action.disabled ? 0.5 : 1,
                cursor: action.disabled ? 'not-allowed' : 'pointer',
              }}
              onClick={action.onClick}
              disabled={action.disabled}
              data-testid={`action-${action.id}`}
            >
              <span style={styles.quickActionIcon}>{action.icon}</span>
              <span style={styles.quickActionLabel}>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Recent tests preview */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Recent Tests ({state.testCaseCount})
        </div>
        {state.testCaseCount > 0 ? (
          <div style={styles.testCasePreview}>
            <div
              style={styles.testCaseItem}
              onClick={() => navigateTo(POPUP_VIEWS.TESTS)}
              data-testid="view-all-tests"
            >
              <span style={styles.testCaseName}>View all tests →</span>
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>📝</div>
            <div style={styles.emptyStateText}>
              No tests recorded yet.
              <br />
              Click "Record" to create your first test.
            </div>
          </div>
        )}
      </div>
    </>
  );
  
  // Render recording view
  const renderRecordingView = () => (
    <>
      {/* Recording indicator */}
      <div style={styles.recordingIndicator}>
        <div
          style={{
            ...styles.recordingDot,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
        <div style={styles.recordingInfo}>
          <div style={styles.recordingTitle}>
            {isPaused ? 'Recording Paused' : 'Recording...'}
          </div>
          <div style={styles.recordingMeta}>
            {state.recordingSession?.steps?.length ?? 0} steps captured
          </div>
        </div>
      </div>
      
      {/* Recording controls */}
      <div style={styles.section}>
        <div style={styles.buttonGroup}>
          {isPaused ? (
            <button
              style={styles.primaryButton}
              onClick={handleResumeRecording}
              data-testid="resume-recording"
            >
              ▶️ Resume
            </button>
          ) : (
            <button
              style={styles.secondaryButton}
              onClick={handlePauseRecording}
              data-testid="pause-recording"
            >
              ⏸️ Pause
            </button>
          )}
        </div>
        
        <div style={{ marginTop: '8px' }}>
          <button
            style={styles.dangerButton}
            onClick={handleStopRecording}
            data-testid="stop-recording"
          >
            ⏹️ Stop Recording
          </button>
        </div>
      </div>
    </>
  );
  
  // Render tests view
  const renderTestsView = () => (
    <>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Test Cases</div>
        {state.testCaseCount > 0 ? (
          <div style={styles.testCasePreview}>
            <div style={styles.emptyState}>
              <div style={styles.emptyStateText}>
                Test list will be loaded here.
                <br />
                This is a placeholder for the full test list component.
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>📋</div>
            <div style={styles.emptyStateText}>No test cases found.</div>
          </div>
        )}
      </div>
      
      <button
        style={styles.secondaryButton}
        onClick={() => navigateTo(POPUP_VIEWS.HOME)}
        data-testid="back-home"
      >
        ← Back to Home
      </button>
    </>
  );
  
  // Render replay view
  const renderReplayView = () => (
    <>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Replay</div>
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>▶️</div>
          <div style={styles.emptyStateText}>
            Select a test case to replay.
            <br />
            Replay controls will appear here.
          </div>
        </div>
      </div>
      
      <button
        style={styles.secondaryButton}
        onClick={() => navigateTo(POPUP_VIEWS.HOME)}
        data-testid="back-home"
      >
        ← Back to Home
      </button>
    </>
  );
  
  // Render settings view
  const renderSettingsView = () => (
    <>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Settings</div>
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>⚙️</div>
          <div style={styles.emptyStateText}>
            Settings panel will be loaded here.
            <br />
            Configure recording, replay, and export options.
          </div>
        </div>
      </div>
      
      <button
        style={styles.secondaryButton}
        onClick={() => navigateTo(POPUP_VIEWS.HOME)}
        data-testid="back-home"
      >
        ← Back to Home
      </button>
    </>
  );
  
  // Render content based on view
  const renderContent = () => {
    switch (state.view) {
      case POPUP_VIEWS.HOME:
        return renderHomeView();
      case POPUP_VIEWS.RECORDING:
        return renderRecordingView();
      case POPUP_VIEWS.TESTS:
        return renderTestsView();
      case POPUP_VIEWS.REPLAY:
        return renderReplayView();
      case POPUP_VIEWS.SETTINGS:
        return renderSettingsView();
      default:
        return renderHomeView();
    }
  };
  
  return (
    <div style={styles.container} data-testid="popup-app">
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🧪</div>
          <span>Copilot</span>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.iconButton}
            onClick={() => navigateTo(POPUP_VIEWS.SETTINGS)}
            title="Settings"
            data-testid="settings-button"
          >
            ⚙️
          </button>
        </div>
      </header>
      
      {/* Navigation (show when not on home) */}
      {state.view !== POPUP_VIEWS.HOME && state.view !== POPUP_VIEWS.RECORDING && (
        <nav style={styles.nav}>
          <button
            style={{
              ...styles.navItem,
              ...(state.view === POPUP_VIEWS.TESTS ? styles.navItemActive : {}),
            }}
            onClick={() => navigateTo(POPUP_VIEWS.TESTS)}
          >
            Tests
          </button>
          <button
            style={{
              ...styles.navItem,
              ...(state.view === POPUP_VIEWS.REPLAY ? styles.navItemActive : {}),
            }}
            onClick={() => navigateTo(POPUP_VIEWS.REPLAY)}
          >
            Replay
          </button>
          <button
            style={{
              ...styles.navItem,
              ...(state.view === POPUP_VIEWS.SETTINGS ? styles.navItemActive : {}),
            }}
            onClick={() => navigateTo(POPUP_VIEWS.SETTINGS)}
          >
            Settings
          </button>
        </nav>
      )}
      
      {/* Content */}
      <main style={styles.content}>
        {/* Error banner */}
        {state.error && (
          <div style={styles.errorBanner} data-testid="error-banner">
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{state.error}</span>
            <button
              style={{ ...styles.iconButton, width: '24px', height: '24px' }}
              onClick={clearError}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        
        {renderContent()}
      </main>
      
      {/* Footer */}
      <footer style={styles.footer}>
        Copilot Test Recorder v1.0.0
      </footer>
      
      {/* Loading overlay */}
      {state.isLoading && (
        <div style={styles.loadingOverlay} data-testid="loading-overlay">
          <div style={styles.spinner} />
        </div>
      )}
      
      {/* CSS animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a PopupApp component with configuration
 * 
 * @param config - Configuration options
 * @returns Configured PopupApp component
 */
export function createPopupApp(config?: PopupAppProps): React.FC {
  return () => <PopupApp {...config} />;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default PopupApp;
