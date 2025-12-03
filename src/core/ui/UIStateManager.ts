/**
 * UIStateManager - Shared UI State Management
 * @module core/ui/UIStateManager
 * @version 1.0.0
 * 
 * Provides centralized state management for UI components including
 * loading states, errors, notifications, and logs.
 * 
 * ## Features
 * - Loading state management with progress
 * - Error state with recovery options
 * - Toast notification queue
 * - Log management with auto-trimming
 * - State change subscriptions
 * 
 * @example
 * ```typescript
 * const stateManager = new UIStateManager();
 * 
 * // Subscribe to state changes
 * stateManager.subscribe((state) => {
 *   console.log('State updated:', state);
 * });
 * 
 * // Set loading state
 * stateManager.setLoading(true, 'Loading projects...');
 * 
 * // Add log entry
 * stateManager.addLog('info', 'Project loaded successfully');
 * 
 * // Show toast
 * stateManager.showToast('success', 'Saved!');
 * ```
 */

import type {
  LoadingState,
  ErrorState,
  LogEntry,
  LogLevel,
} from './IUIComponents';

import {
  createEmptyLoadingState,
  createLoadingState,
  createEmptyErrorState,
  createErrorState,
  createLogEntry,
  DEFAULT_LOG_LIMIT,
} from './IUIComponents';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Toast notification
 */
export interface Toast {
  /** Unique ID */
  id: string;
  
  /** Toast type */
  type: 'info' | 'success' | 'warning' | 'error';
  
  /** Toast message */
  message: string;
  
  /** Toast title (optional) */
  title?: string;
  
  /** Duration in ms (0 = manual dismiss) */
  duration: number;
  
  /** Created timestamp */
  createdAt: number;
  
  /** Whether toast is dismissible */
  dismissible: boolean;
  
  /** Action button (optional) */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * UI State
 */
export interface UIState {
  /** Loading state */
  loading: LoadingState;
  
  /** Error state */
  error: ErrorState;
  
  /** Log entries */
  logs: LogEntry[];
  
  /** Active toasts */
  toasts: Toast[];
  
  /** Global busy state (any async operation in progress) */
  isBusy: boolean;
  
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  
  /** Theme */
  theme: 'light' | 'dark' | 'system';
}

/**
 * State change listener
 */
export type StateChangeListener = (state: UIState, previousState: UIState) => void;

/**
 * Partial state update
 */
export type PartialUIState = Partial<UIState>;

/**
 * UI State Manager configuration
 */
export interface UIStateManagerConfig {
  /** Maximum log entries to keep */
  maxLogs?: number;
  
  /** Default toast duration in ms */
  defaultToastDuration?: number;
  
  /** Maximum active toasts */
  maxToasts?: number;
  
  /** Initial theme */
  initialTheme?: UIState['theme'];
  
  /** Persist theme to storage */
  persistTheme?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_STATE_MANAGER_CONFIG: Required<UIStateManagerConfig> = {
  maxLogs: DEFAULT_LOG_LIMIT,
  defaultToastDuration: 5000,
  maxToasts: 5,
  initialTheme: 'system',
  persistTheme: true,
};

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Create initial UI state
 */
export function createInitialUIState(
  theme: UIState['theme'] = 'system'
): UIState {
  return {
    loading: createEmptyLoadingState(),
    error: createEmptyErrorState(),
    logs: [],
    toasts: [],
    isBusy: false,
    sidebarCollapsed: false,
    theme,
  };
}

// ============================================================================
// UI STATE MANAGER CLASS
// ============================================================================

/**
 * UI State Manager implementation
 */
export class UIStateManager {
  private state: UIState;
  private config: Required<UIStateManagerConfig>;
  private listeners: Set<StateChangeListener> = new Set();
  private toastTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private busyOperations: Set<string> = new Set();
  
  constructor(config?: Partial<UIStateManagerConfig>) {
    this.config = {
      ...DEFAULT_STATE_MANAGER_CONFIG,
      ...config,
    };
    
    this.state = createInitialUIState(this.config.initialTheme);
    
    // Load persisted theme if enabled
    if (this.config.persistTheme) {
      this.loadPersistedTheme();
    }
  }
  
  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================
  
  /**
   * Get current state
   */
  getState(): UIState {
    return { ...this.state };
  }
  
  /**
   * Get loading state
   */
  getLoadingState(): LoadingState {
    return { ...this.state.loading };
  }
  
  /**
   * Get error state
   */
  getErrorState(): ErrorState {
    return { ...this.state.error };
  }
  
  /**
   * Get logs
   */
  getLogs(): LogEntry[] {
    return [...this.state.logs];
  }
  
  /**
   * Get toasts
   */
  getToasts(): Toast[] {
    return [...this.state.toasts];
  }
  
  /**
   * Check if busy
   */
  isBusy(): boolean {
    return this.state.isBusy;
  }
  
  // ==========================================================================
  // LOADING STATE
  // ==========================================================================
  
  /**
   * Set loading state
   */
  setLoading(isLoading: boolean, message?: string, progress?: number): void {
    this.updateState({
      loading: isLoading
        ? createLoadingState(message, progress)
        : createEmptyLoadingState(),
    });
  }
  
  /**
   * Update loading progress
   */
  setLoadingProgress(progress: number, message?: string): void {
    if (this.state.loading.isLoading) {
      this.updateState({
        loading: {
          ...this.state.loading,
          progress,
          message: message ?? this.state.loading.message,
        },
      });
    }
  }
  
  /**
   * Clear loading state
   */
  clearLoading(): void {
    this.setLoading(false);
  }
  
  // ==========================================================================
  // ERROR STATE
  // ==========================================================================
  
  /**
   * Set error state
   */
  setError(message: string, options?: { code?: string; recoverable?: boolean }): void {
    this.updateState({
      error: createErrorState(message, options),
    });
  }
  
  /**
   * Clear error state
   */
  clearError(): void {
    this.updateState({
      error: createEmptyErrorState(),
    });
  }
  
  // ==========================================================================
  // BUSY STATE
  // ==========================================================================
  
  /**
   * Start a named operation (marks as busy)
   */
  startOperation(operationId: string): void {
    this.busyOperations.add(operationId);
    this.updateBusyState();
  }
  
  /**
   * End a named operation
   */
  endOperation(operationId: string): void {
    this.busyOperations.delete(operationId);
    this.updateBusyState();
  }
  
  /**
   * Check if specific operation is in progress
   */
  isOperationInProgress(operationId: string): boolean {
    return this.busyOperations.has(operationId);
  }
  
  /**
   * Update busy state based on operations
   */
  private updateBusyState(): void {
    const isBusy = this.busyOperations.size > 0;
    if (this.state.isBusy !== isBusy) {
      this.updateState({ isBusy });
    }
  }
  
  // ==========================================================================
  // LOG MANAGEMENT
  // ==========================================================================
  
  /**
   * Add log entry
   */
  addLog(level: LogLevel, message: string, data?: unknown, source?: string): LogEntry {
    const entry = createLogEntry(level, message, { data, source });
    
    const logs = [...this.state.logs, entry];
    
    // Trim if exceeds max
    if (logs.length > this.config.maxLogs) {
      logs.splice(0, logs.length - this.config.maxLogs);
    }
    
    this.updateState({ logs });
    
    return entry;
  }
  
  /**
   * Add info log
   */
  logInfo(message: string, data?: unknown): LogEntry {
    return this.addLog('info', message, data);
  }
  
  /**
   * Add success log
   */
  logSuccess(message: string, data?: unknown): LogEntry {
    return this.addLog('success', message, data);
  }
  
  /**
   * Add warning log
   */
  logWarning(message: string, data?: unknown): LogEntry {
    return this.addLog('warning', message, data);
  }
  
  /**
   * Add error log
   */
  logError(message: string, data?: unknown): LogEntry {
    return this.addLog('error', message, data);
  }
  
  /**
   * Add debug log
   */
  logDebug(message: string, data?: unknown): LogEntry {
    return this.addLog('debug', message, data);
  }
  
  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.updateState({ logs: [] });
  }
  
  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.state.logs.filter(log => log.level === level);
  }
  
  /**
   * Get logs since timestamp
   */
  getLogsSince(timestamp: number): LogEntry[] {
    return this.state.logs.filter(log => log.timestamp >= timestamp);
  }
  
  // ==========================================================================
  // TOAST MANAGEMENT
  // ==========================================================================
  
  /**
   * Show toast notification
   */
  showToast(
    type: Toast['type'],
    message: string,
    options?: {
      title?: string;
      duration?: number;
      dismissible?: boolean;
      action?: Toast['action'];
    }
  ): Toast {
    const toast: Toast = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      title: options?.title,
      duration: options?.duration ?? this.config.defaultToastDuration,
      createdAt: Date.now(),
      dismissible: options?.dismissible ?? true,
      action: options?.action,
    };
    
    let toasts = [...this.state.toasts, toast];
    
    // Trim if exceeds max
    if (toasts.length > this.config.maxToasts) {
      // Remove oldest non-dismissible toasts first, then oldest
      const excess = toasts.length - this.config.maxToasts;
      toasts = toasts.slice(excess);
    }
    
    this.updateState({ toasts });
    
    // Set auto-dismiss timer
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        this.dismissToast(toast.id);
      }, toast.duration);
      
      this.toastTimers.set(toast.id, timer);
    }
    
    return toast;
  }
  
  /**
   * Show info toast
   */
  toastInfo(message: string, title?: string): Toast {
    return this.showToast('info', message, { title });
  }
  
  /**
   * Show success toast
   */
  toastSuccess(message: string, title?: string): Toast {
    return this.showToast('success', message, { title });
  }
  
  /**
   * Show warning toast
   */
  toastWarning(message: string, title?: string): Toast {
    return this.showToast('warning', message, { title });
  }
  
  /**
   * Show error toast
   */
  toastError(message: string, title?: string): Toast {
    return this.showToast('error', message, { title, duration: 0 }); // Errors don't auto-dismiss
  }
  
  /**
   * Dismiss toast
   */
  dismissToast(id: string): void {
    // Clear timer
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }
    
    // Remove toast
    const toasts = this.state.toasts.filter(t => t.id !== id);
    this.updateState({ toasts });
  }
  
  /**
   * Dismiss all toasts
   */
  dismissAllToasts(): void {
    // Clear all timers
    for (const timer of this.toastTimers.values()) {
      clearTimeout(timer);
    }
    this.toastTimers.clear();
    
    this.updateState({ toasts: [] });
  }
  
  // ==========================================================================
  // UI PREFERENCES
  // ==========================================================================
  
  /**
   * Set sidebar collapsed state
   */
  setSidebarCollapsed(collapsed: boolean): void {
    this.updateState({ sidebarCollapsed: collapsed });
  }
  
  /**
   * Toggle sidebar
   */
  toggleSidebar(): void {
    this.updateState({ sidebarCollapsed: !this.state.sidebarCollapsed });
  }
  
  /**
   * Set theme
   */
  setTheme(theme: UIState['theme']): void {
    this.updateState({ theme });
    
    if (this.config.persistTheme) {
      this.persistTheme(theme);
    }
  }
  
  /**
   * Get theme
   */
  getTheme(): UIState['theme'] {
    return this.state.theme;
  }
  
  /**
   * Persist theme to storage
   */
  private persistTheme(theme: UIState['theme']): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ui-theme', theme);
      }
    } catch {
      // Ignore storage errors
    }
  }
  
  /**
   * Load persisted theme
   */
  private loadPersistedTheme(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const theme = localStorage.getItem('ui-theme') as UIState['theme'] | null;
        if (theme && ['light', 'dark', 'system'].includes(theme)) {
          this.state.theme = theme;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }
  
  // ==========================================================================
  // STATE UPDATES
  // ==========================================================================
  
  /**
   * Update state and notify listeners
   */
  private updateState(partial: PartialUIState): void {
    const previousState = { ...this.state };
    
    this.state = {
      ...this.state,
      ...partial,
    };
    
    this.notifyListeners(previousState);
  }
  
  /**
   * Notify all listeners
   */
  private notifyListeners(previousState: UIState): void {
    for (const listener of this.listeners) {
      try {
        listener(this.getState(), previousState);
      } catch (error) {
        console.error('UIStateManager listener error:', error);
      }
    }
  }
  
  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.listeners.size;
  }
  
  // ==========================================================================
  // RESET
  // ==========================================================================
  
  /**
   * Reset state to initial
   */
  reset(): void {
    // Clear all toast timers
    for (const timer of this.toastTimers.values()) {
      clearTimeout(timer);
    }
    this.toastTimers.clear();
    
    // Clear busy operations
    this.busyOperations.clear();
    
    // Reset state (preserve theme)
    const previousState = { ...this.state };
    this.state = createInitialUIState(this.state.theme);
    this.notifyListeners(previousState);
  }
  
  /**
   * Destroy manager (cleanup)
   */
  destroy(): void {
    this.reset();
    this.listeners.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a UIStateManager
 */
export function createUIStateManager(
  config?: Partial<UIStateManagerConfig>
): UIStateManager {
  return new UIStateManager(config);
}

/**
 * Create UI state manager with custom log limit
 */
export function createLimitedLogManager(maxLogs: number): UIStateManager {
  return new UIStateManager({ maxLogs });
}

/**
 * Create UI state manager without theme persistence
 */
export function createTransientManager(): UIStateManager {
  return new UIStateManager({ persistTheme: false });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultManager: UIStateManager | null = null;

/**
 * Get default UI state manager instance
 */
export function getUIStateManager(): UIStateManager {
  if (!defaultManager) {
    defaultManager = new UIStateManager();
  }
  return defaultManager;
}

/**
 * Reset default UI state manager
 */
export function resetUIStateManager(): void {
  if (defaultManager) {
    defaultManager.destroy();
    defaultManager = null;
  }
}

// ============================================================================
// REACT HOOK HELPERS
// ============================================================================

/**
 * Selector function type for use with React hooks
 */
export type StateSelector<T> = (state: UIState) => T;

/**
 * Common selectors
 */
export const selectors = {
  /** Select loading state */
  loading: (state: UIState) => state.loading,
  
  /** Select error state */
  error: (state: UIState) => state.error,
  
  /** Select logs */
  logs: (state: UIState) => state.logs,
  
  /** Select toasts */
  toasts: (state: UIState) => state.toasts,
  
  /** Select is busy */
  isBusy: (state: UIState) => state.isBusy,
  
  /** Select theme */
  theme: (state: UIState) => state.theme,
  
  /** Select sidebar collapsed */
  sidebarCollapsed: (state: UIState) => state.sidebarCollapsed,
  
  /** Select is loading */
  isLoading: (state: UIState) => state.loading.isLoading,
  
  /** Select has error */
  hasError: (state: UIState) => state.error.hasError,
  
  /** Select error message */
  errorMessage: (state: UIState) => state.error.message,
  
  /** Select loading message */
  loadingMessage: (state: UIState) => state.loading.message,
  
  /** Select loading progress */
  loadingProgress: (state: UIState) => state.loading.progress,
  
  /** Select log count */
  logCount: (state: UIState) => state.logs.length,
  
  /** Select toast count */
  toastCount: (state: UIState) => state.toasts.length,
};
