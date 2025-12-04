/**
 * useRecording - React hook for recording operations
 * @module hooks/useRecording
 * @version 1.0.0
 * 
 * Provides recording interface:
 * - Start/stop recording sessions
 * - Real-time step capture via chrome.runtime.onMessage
 * - Step management (edit, delete, reorder)
 * - Auto-save to project storage
 * - Recording logs and status
 * 
 * @example
 * ```tsx
 * const { 
 *   isRecording,
 *   steps,
 *   startRecording,
 *   stopRecording,
 *   logs 
 * } = useRecording({ projectId: 123, tabId: 456 });
 * ```
 * 
 * @see recording-engine_breakdown.md for capture patterns
 * @see ui-components_breakdown.md for Recorder UI patterns
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useStorage, type UseStorageOptions } from './useStorage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recording status
 */
export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'stopped';

/**
 * Event type
 */
export type RecordingEventType = 'click' | 'input' | 'enter' | 'open' | 'select' | 'check' | 'scroll' | 'hover';

/**
 * Element bundle (from recording engine)
 */
export interface ElementBundle {
  id?: string;
  name?: string;
  className?: string;
  tag?: string;
  xpath?: string;
  dataAttrs?: Record<string, string>;
  aria?: Record<string, string>;
  placeholder?: string;
  visibleText?: string;
  bounding?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  iframeChain?: string[];
}

/**
 * Recorded step
 */
export interface RecordedStep {
  id: string;
  eventType: RecordingEventType;
  xpath: string;
  value?: string;
  label?: string;
  timestamp: number;
  x?: number;
  y?: number;
  bundle: ElementBundle;
  page?: string;
}

/**
 * Log entry
 */
export interface RecordingLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  stepId?: string;
}

/**
 * Recording session info
 */
export interface RecordingSession {
  projectId: number;
  tabId: number | null;
  startedAt: Date | null;
  stepsRecorded: number;
  status: RecordingStatus;
}

/**
 * Chrome runtime message listener types
 */
export interface LogEventMessage {
  type: 'logEvent';
  data: {
    eventType: RecordingEventType;
    xpath: string;
    value?: string;
    label?: string;
    x?: number;
    y?: number;
    bundle: ElementBundle;
    page?: string;
  };
}

/**
 * Chrome runtime interface
 */
export interface IChromeRuntime {
  sendMessage<T = unknown>(
    message: unknown,
    callback?: (response: T) => void
  ): void;
  onMessage: {
    addListener(listener: (message: unknown, sender: unknown, sendResponse: unknown) => void): void;
    removeListener(listener: (message: unknown, sender: unknown, sendResponse: unknown) => void): void;
  };
  lastError?: { message?: string };
}

/**
 * Hook options
 */
export interface UseRecordingOptions extends UseStorageOptions {
  projectId: number;
  tabId?: number | null;
  autoSave?: boolean;
  autoSaveInterval?: number; // ms
  maxSteps?: number;
  initialSteps?: RecordedStep[];
}

/**
 * Default options
 */
export const DEFAULT_RECORDING_OPTIONS: Partial<UseRecordingOptions> = {
  autoSave: true,
  autoSaveInterval: 5000, // 5 seconds
  maxSteps: 1000,
};

/**
 * Hook return type
 */
export interface UseRecordingReturn {
  // State
  status: RecordingStatus;
  isRecording: boolean;
  isPaused: boolean;
  steps: RecordedStep[];
  logs: RecordingLog[];
  session: RecordingSession;
  error: string | null;
  hasUnsavedChanges: boolean;
  
  // Recording control
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<boolean>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  
  // Step management
  addStep: (step: Omit<RecordedStep, 'id' | 'timestamp'>) => void;
  updateStep: (id: string, updates: Partial<RecordedStep>) => void;
  deleteStep: (id: string) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  clearSteps: () => void;
  
  // Persistence
  saveSteps: () => Promise<boolean>;
  loadSteps: () => Promise<void>;
  
  // Logs
  addLog: (level: RecordingLog['level'], message: string, stepId?: string) => void;
  clearLogs: () => void;
  
  // Utilities
  getStepById: (id: string) => RecordedStep | undefined;
  exportSteps: () => ExportedSteps;
  setTabId: (tabId: number | null) => void;
  clearError: () => void;
}

/**
 * Exported steps format
 */
export interface ExportedSteps {
  projectId: number;
  exportedAt: string;
  steps: RecordedStep[];
  totalCount: number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useRecording - Hook for recording operations
 */
export function useRecording(options: UseRecordingOptions): UseRecordingReturn {
  const opts = { ...DEFAULT_RECORDING_OPTIONS, ...options };
  
  // Storage hook
  const storage = useStorage(options);
  
  // State
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [steps, setSteps] = useState<RecordedStep[]>(opts.initialSteps ?? []);
  const [logs, setLogs] = useState<RecordingLog[]>([]);
  const [tabId, setTabIdState] = useState<number | null>(opts.tabId ?? null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  
  // Refs
  const isRecordingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chromeRuntimeRef = useRef<IChromeRuntime | null>(
    typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime as IChromeRuntime : null
  );
  const messageListenerRef = useRef<((message: unknown, sender: unknown, sendResponse: unknown) => void) | null>(null);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  const isRecording = status === 'recording';
  const isPaused = status === 'paused';

  const session = useMemo((): RecordingSession => ({
    projectId: opts.projectId,
    tabId,
    startedAt,
    stepsRecorded: steps.length,
    status,
  }), [opts.projectId, tabId, startedAt, steps.length, status]);

  // ==========================================================================
  // MESSAGE LISTENER
  // ==========================================================================

  /**
   * Add log entry (internal)
   */
  const addLogInternal = useCallback((
    level: RecordingLog['level'],
    message: string,
    stepId?: string
  ) => {
    const entry: RecordingLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      stepId,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  /**
   * Handle incoming logEvent messages
   */
  const handleLogEvent = useCallback((data: LogEventMessage['data']) => {
    if (!isRecordingRef.current) return;

    const newStep: RecordedStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: data.eventType,
      xpath: data.xpath,
      value: data.value,
      label: data.label,
      timestamp: Date.now(),
      x: data.x,
      y: data.y,
      bundle: data.bundle,
      page: data.page,
    };

    setSteps(prev => {
      // Check max steps limit
      if (opts.maxSteps && prev.length >= opts.maxSteps) {
        addLogInternal('warning', `Maximum steps (${opts.maxSteps}) reached. Step not recorded.`);
        return prev;
      }
      return [...prev, newStep];
    });

    setHasUnsavedChanges(true);
    addLogInternal('success', `Recorded: ${data.eventType} on "${data.label || data.xpath}"`, newStep.id);
  }, [opts.maxSteps, addLogInternal]);

  /**
   * Setup message listener
   */
  useEffect(() => {
    const runtime = chromeRuntimeRef.current;
    if (!runtime) return;

    const listener = (message: unknown) => {
      // Type guard for logEvent messages
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        (message as { type: string }).type === 'logEvent' &&
        'data' in message
      ) {
        const logEventMessage = message as LogEventMessage;
        handleLogEvent(logEventMessage.data);
      }
    };

    messageListenerRef.current = listener;
    runtime.onMessage.addListener(listener);

    return () => {
      if (messageListenerRef.current) {
        runtime.onMessage.removeListener(messageListenerRef.current);
        messageListenerRef.current = null;
      }
    };
  }, [handleLogEvent]);

  // ==========================================================================
  // AUTO-SAVE
  // ==========================================================================

  /**
   * Save steps to storage (internal)
   */
  const saveStepsInternal = useCallback(async (): Promise<boolean> => {
    const response = await storage.sendMessage('update_project_steps', {
      id: opts.projectId,
      recorded_steps: steps,
    });

    if (response.success) {
      setHasUnsavedChanges(false);
      return true;
    }

    return false;
  }, [storage.sendMessage, opts.projectId, steps]);

  /**
   * Setup auto-save interval
   */
  useEffect(() => {
    if (!opts.autoSave || opts.autoSaveInterval === 0) return;

    autoSaveTimerRef.current = setInterval(() => {
      if (hasUnsavedChanges && steps.length > 0) {
        saveStepsInternal();
      }
    }, opts.autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [opts.autoSave, opts.autoSaveInterval, hasUnsavedChanges, steps.length, saveStepsInternal]);

  // ==========================================================================
  // RECORDING CONTROL
  // ==========================================================================

  /**
   * Start recording
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (isRecordingRef.current) return false;

    setStatus('starting');
    setError(null);

    try {
      // Notify background to enable recording
      const response = await new Promise<{ success: boolean; tabId?: number }>((resolve) => {
        storage.sendMessage<{ success: boolean; tabId?: number }>('start_recording', {
          projectId: opts.projectId,
          tabId,
        }).then(resolve);
      });

      if (!response.success) {
        setError('Failed to start recording');
        setStatus('idle');
        return false;
      }

      // Update tab ID if returned
      if (response.tabId) {
        setTabIdState(response.tabId);
      }

      isRecordingRef.current = true;
      setStatus('recording');
      setStartedAt(new Date());
      addLogInternal('info', 'Recording started');

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setStatus('idle');
      return false;
    }
  }, [storage.sendMessage, opts.projectId, tabId, addLogInternal]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<boolean> => {
    if (!isRecordingRef.current && status !== 'paused') return false;

    setStatus('stopping');

    try {
      // Notify background to disable recording
      await storage.sendMessage('stop_recording', {
        projectId: opts.projectId,
        tabId,
      });

      isRecordingRef.current = false;
      setStatus('stopped');
      addLogInternal('info', `Recording stopped. Total steps: ${steps.length}`);

      // Save steps
      if (hasUnsavedChanges) {
        await saveStepsInternal();
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      setStatus('recording'); // Revert
      return false;
    }
  }, [storage.sendMessage, opts.projectId, tabId, steps.length, hasUnsavedChanges, saveStepsInternal, addLogInternal, status]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    setStatus('paused');
    addLogInternal('info', 'Recording paused');
  }, [addLogInternal]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (status !== 'paused') return;

    isRecordingRef.current = true;
    setStatus('recording');
    addLogInternal('info', 'Recording resumed');
  }, [status, addLogInternal]);

  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================

  /**
   * Add step manually
   */
  const addStep = useCallback((step: Omit<RecordedStep, 'id' | 'timestamp'>) => {
    const newStep: RecordedStep = {
      ...step,
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setSteps(prev => [...prev, newStep]);
    setHasUnsavedChanges(true);
    addLogInternal('info', `Step added manually: ${step.eventType}`);
  }, [addLogInternal]);

  /**
   * Update step
   */
  const updateStep = useCallback((id: string, updates: Partial<RecordedStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...updates } : step
    ));
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Delete step
   */
  const deleteStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(step => step.id !== id));
    setHasUnsavedChanges(true);
    addLogInternal('info', 'Step deleted');
  }, [addLogInternal]);

  /**
   * Reorder steps (for drag-and-drop)
   */
  const reorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    setSteps(prev => {
      const newSteps = [...prev];
      const [removed] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, removed);
      return newSteps;
    });
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Clear all steps
   */
  const clearSteps = useCallback(() => {
    setSteps([]);
    setHasUnsavedChanges(true);
    addLogInternal('warning', 'All steps cleared');
  }, [addLogInternal]);

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save steps to storage
   */
  const saveSteps = useCallback(async (): Promise<boolean> => {
    const success = await saveStepsInternal();
    if (success) {
      addLogInternal('success', `Saved ${steps.length} steps`);
    } else {
      addLogInternal('error', 'Failed to save steps');
    }
    return success;
  }, [saveStepsInternal, steps.length, addLogInternal]);

  /**
   * Load steps from storage
   */
  const loadSteps = useCallback(async (): Promise<void> => {
    const response = await storage.getProject(opts.projectId);

    if (response.success && response.data) {
      const project = response.data.project as { recorded_steps?: RecordedStep[] };
      const loadedSteps = project.recorded_steps ?? [];
      setSteps(loadedSteps);
      setHasUnsavedChanges(false);
      addLogInternal('info', `Loaded ${loadedSteps.length} steps`);
    }
  }, [storage.getProject, opts.projectId, addLogInternal]);

  // ==========================================================================
  // LOGS
  // ==========================================================================

  /**
   * Add log entry (public)
   */
  const addLog = useCallback((
    level: RecordingLog['level'],
    message: string,
    stepId?: string
  ) => {
    addLogInternal(level, message, stepId);
  }, [addLogInternal]);

  /**
   * Clear logs
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get step by ID
   */
  const getStepById = useCallback((id: string): RecordedStep | undefined => {
    return steps.find(step => step.id === id);
  }, [steps]);

  /**
   * Export steps
   */
  const exportSteps = useCallback((): ExportedSteps => {
    return {
      projectId: opts.projectId,
      exportedAt: new Date().toISOString(),
      steps,
      totalCount: steps.length,
    };
  }, [opts.projectId, steps]);

  /**
   * Set tab ID
   */
  const setTabId = useCallback((newTabId: number | null) => {
    setTabIdState(newTabId);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Stop auto-save
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }

      // Stop recording if active
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
      }
    };
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // State
    status,
    isRecording,
    isPaused,
    steps,
    logs,
    session,
    error,
    hasUnsavedChanges,
    
    // Recording control
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    
    // Step management
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
    clearSteps,
    
    // Persistence
    saveSteps,
    loadSteps,
    
    // Logs
    addLog,
    clearLogs,
    
    // Utilities
    getStepById,
    exportSteps,
    setTabId,
    clearError,
  };
}

// ============================================================================
// RECORDING STEP UTILITIES
// ============================================================================

/**
 * Generate display name for step
 */
export function getStepDisplayName(step: RecordedStep): string {
  if (step.label) {
    return `${step.eventType}: ${step.label}`;
  }
  if (step.bundle.visibleText) {
    const text = step.bundle.visibleText.substring(0, 30);
    return `${step.eventType}: "${text}"`;
  }
  if (step.bundle.id) {
    return `${step.eventType}: #${step.bundle.id}`;
  }
  return `${step.eventType}: ${step.xpath.substring(0, 40)}`;
}

/**
 * Get step icon based on event type
 */
export function getStepIcon(eventType: RecordingEventType): string {
  const icons: Record<RecordingEventType, string> = {
    click: '🖱️',
    input: '⌨️',
    enter: '↵',
    open: '🔗',
    select: '📋',
    check: '☑️',
    scroll: '📜',
    hover: '👆',
  };
  return icons[eventType] ?? '●';
}

/**
 * Validate step has minimum required data
 */
export function isValidStep(step: Partial<RecordedStep>): step is RecordedStep {
  return !!(
    step.id &&
    step.eventType &&
    step.xpath &&
    step.timestamp &&
    step.bundle
  );
}
