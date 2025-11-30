/**
 * @fileoverview Recording session coordinator for background service
 * @module background/recording-coordinator
 * @version 1.0.0
 * 
 * This module coordinates recording sessions between the background service,
 * content scripts, and UI components.
 * 
 * RECORDING FLOW:
 * 1. UI requests start_recording
 * 2. Coordinator injects content script
 * 3. Content script captures user actions
 * 4. Steps sent to coordinator via messages
 * 5. Coordinator persists steps and updates UI
 * 6. UI requests stop_recording
 * 7. Coordinator finalizes and saves project
 * 
 * STEP EVENTS:
 * - 'open' - Page navigation (first step)
 * - 'click' - Element click
 * - 'input' - Text input
 * - 'enter' - Enter key press
 * 
 * @see PHASE_4_SPECIFICATIONS.md for recording specifications
 * @see recording-engine_breakdown.md for engine details
 */

import type { Step, Project, LocatorBundle } from '../core/types';
import { createStep as coreCreateStep } from '../core/types/step';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recording session state
 */
export interface RecordingSession {
  /** Session ID */
  id: string;
  /** Project ID being recorded */
  projectId: string;
  /** Tab ID where recording is happening */
  tabId: number;
  /** Recording start time */
  startedAt: number;
  /** Recording end time (null if active) */
  endedAt: number | null;
  /** Starting URL */
  startUrl: string;
  /** Current URL */
  currentUrl: string;
  /** Captured steps */
  steps: Step[];
  /** Session state */
  state: RecordingSessionState;
  /** Error if any */
  error: string | null;
}

/**
 * Recording session state
 */
export type RecordingSessionState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'stopped';

/**
 * Recording event types
 */
export type RecordingEventType =
  | 'session_started'
  | 'session_stopped'
  | 'session_paused'
  | 'session_resumed'
  | 'step_captured'
  | 'step_deleted'
  | 'error';

/**
 * Recording event
 */
export interface RecordingEvent {
  /** Event type */
  type: RecordingEventType;
  /** Session ID */
  sessionId: string;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data?: unknown;
}

/**
 * Recording event listener
 */
export type RecordingEventListener = (event: RecordingEvent) => void;

/**
 * Step capture data from content script
 */
export interface StepCaptureData {
  /** Event type */
  event: 'click' | 'input' | 'enter';
  /** Element value (for input) */
  value: string;
  /** Locator bundle */
  bundle: LocatorBundle;
  /** Capture timestamp */
  timestamp: number;
}

/**
 * Recording coordinator configuration
 */
export interface RecordingCoordinatorConfig {
  /** Auto-save steps to storage */
  autoSaveSteps?: boolean;
  /** Auto-save interval (ms) */
  autoSaveInterval?: number;
  /** Max steps per recording */
  maxSteps?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Start recording options
 */
export interface StartRecordingOptions {
  /** Project ID */
  projectId: string;
  /** Tab ID to record */
  tabId: number;
  /** Starting URL (optional, will use tab URL) */
  startUrl?: string;
}

/**
 * Recording result
 */
export interface RecordingResult {
  /** Whether recording completed successfully */
  success: boolean;
  /** Session ID */
  sessionId: string;
  /** Project ID */
  projectId: string;
  /** Captured steps */
  steps: Step[];
  /** Recording duration (ms) */
  duration: number;
  /** Error if failed */
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_RECORDING_CONFIG: Required<RecordingCoordinatorConfig> = {
  autoSaveSteps: true,
  autoSaveInterval: 5000,
  maxSteps: 500,
  debug: false
};

// ============================================================================
// RECORDING COORDINATOR CLASS
// ============================================================================

/**
 * Recording Coordinator
 * 
 * Coordinates recording sessions between components.
 * 
 * @example
 * ```typescript
 * const coordinator = new RecordingCoordinator(stateManager, tabManager);
 * 
 * // Listen for events
 * coordinator.on((event) => {
 *   if (event.type === 'step_captured') {
 *     updateUI(event.data);
 *   }
 * });
 * 
 * // Start recording
 * await coordinator.startRecording({
 *   projectId: 'proj-123',
 *   tabId: 1
 * });
 * 
 * // Stop recording
 * const result = await coordinator.stopRecording();
 * ```
 */
export class RecordingCoordinator {
  private config: Required<RecordingCoordinatorConfig>;
  private session: RecordingSession | null = null;
  private listeners: Set<RecordingEventListener> = new Set();
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private pendingSave: boolean = false;

  // Dependencies (injected)
  private stateManager: StateManagerLike | null = null;
  private tabManager: TabManagerLike | null = null;
  private storage: StorageLike | null = null;

  constructor(config: RecordingCoordinatorConfig = {}) {
    this.config = { ...DEFAULT_RECORDING_CONFIG, ...config };
  }

  // ==========================================================================
  // DEPENDENCY INJECTION
  // ==========================================================================

  /**
   * Set state manager dependency
   */
  setStateManager(stateManager: StateManagerLike): this {
    this.stateManager = stateManager;
    return this;
  }

  /**
   * Set tab manager dependency
   */
  setTabManager(tabManager: TabManagerLike): this {
    this.tabManager = tabManager;
    return this;
  }

  /**
   * Set storage dependency
   */
  setStorage(storage: StorageLike): this {
    this.storage = storage;
    return this;
  }

  // ==========================================================================
  // RECORDING LIFECYCLE
  // ==========================================================================

  /**
   * Start recording session
   */
  async startRecording(options: StartRecordingOptions): Promise<RecordingSession> {
    const { projectId, tabId, startUrl } = options;

    // Check if already recording
    if (this.session && this.session.state === 'recording') {
      throw new Error('Recording already in progress');
    }

    this.log('Starting recording:', options);

    // Create session
    const sessionId = generateSessionId();
    const now = Date.now();

    // Get tab URL if not provided
    let url = startUrl || '';
    if (!url && this.tabManager) {
      const tab = this.tabManager.getTab(tabId);
      url = tab?.url || '';
    }

    // Create initial 'open' step
    const openStep = this.createOpenStep(url);

    this.session = {
      id: sessionId,
      projectId,
      tabId,
      startedAt: now,
      endedAt: null,
      startUrl: url,
      currentUrl: url,
      steps: [openStep],
      state: 'starting',
      error: null
    };

    try {
      // Ensure content script is injected
      if (this.tabManager) {
        const ready = await this.tabManager.ensureContentScript(tabId);
        if (!ready) {
          throw new Error('Failed to inject content script');
        }
      }

      // Send start message to content script
      await this.sendToTab(tabId, {
        action: 'start_recording',
        data: { sessionId, projectId }
      });

      // Update state
      this.session.state = 'recording';

      // Update state manager
      if (this.stateManager) {
        this.stateManager.update({
          isRecording: true,
          recordingTabId: tabId,
          activeProjectId: projectId,
          isPaused: false
        });
      }

      // Start auto-save timer
      if (this.config.autoSaveSteps) {
        this.startAutoSave();
      }

      // Emit event
      this.emitEvent('session_started', sessionId, {
        projectId,
        tabId,
        startUrl: url
      });

      this.log('Recording started:', sessionId);
      return this.session;

    } catch (error) {
      // Clean up on failure
      this.session.state = 'stopped';
      this.session.error = error instanceof Error ? error.message : String(error);
      
      this.emitEvent('error', sessionId, { error: this.session.error });
      throw error;
    }
  }

  /**
   * Stop recording session
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.session) {
      throw new Error('No active recording session');
    }

    if (this.session.state === 'stopped') {
      throw new Error('Recording already stopped');
    }

    this.log('Stopping recording:', this.session.id);

    this.session.state = 'stopping';
    const sessionId = this.session.id;

    try {
      // Send stop message to content script
      await this.sendToTab(this.session.tabId, {
        action: 'stop_recording',
        data: { sessionId }
      });

      // Stop auto-save
      this.stopAutoSave();

      // Finalize session
      this.session.state = 'stopped';
      this.session.endedAt = Date.now();

      // Save steps to storage
      await this.saveStepsToProject();

      // Update state manager
      if (this.stateManager) {
        this.stateManager.update({
          isRecording: false,
          recordingTabId: null,
          isPaused: false
        });
      }

      const result: RecordingResult = {
        success: true,
        sessionId,
        projectId: this.session.projectId,
        steps: [...this.session.steps],
        duration: this.session.endedAt - this.session.startedAt
      };

      // Emit event
      this.emitEvent('session_stopped', sessionId, result);

      this.log('Recording stopped:', result);

      // Clear session
      this.session = null;

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.session) {
        this.session.error = errorMessage;
      }

      this.emitEvent('error', sessionId, { error: errorMessage });

      return {
        success: false,
        sessionId,
        projectId: this.session?.projectId || '',
        steps: this.session?.steps || [],
        duration: Date.now() - (this.session?.startedAt || Date.now()),
        error: errorMessage
      };
    }
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.session || this.session.state !== 'recording') {
      throw new Error('Cannot pause: not recording');
    }

    this.session.state = 'paused';

    // Notify content script
    this.sendToTab(this.session.tabId, {
      action: 'pause_recording',
      data: { sessionId: this.session.id }
    }).catch(console.error);

    // Update state
    if (this.stateManager) {
      this.stateManager.set('isPaused', true);
    }

    this.emitEvent('session_paused', this.session.id);
    this.log('Recording paused');
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.session || this.session.state !== 'paused') {
      throw new Error('Cannot resume: not paused');
    }

    this.session.state = 'recording';

    // Notify content script
    this.sendToTab(this.session.tabId, {
      action: 'resume_recording',
      data: { sessionId: this.session.id }
    }).catch(console.error);

    // Update state
    if (this.stateManager) {
      this.stateManager.set('isPaused', false);
    }

    this.emitEvent('session_resumed', this.session.id);
    this.log('Recording resumed');
  }

  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================

  /**
   * Handle step captured from content script
   */
  handleStepCaptured(data: StepCaptureData): Step | null {
    if (!this.session || this.session.state !== 'recording') {
      this.log('Ignoring step: not recording');
      return null;
    }

    // Check max steps
    if (this.session.steps.length >= this.config.maxSteps) {
      this.log('Max steps reached, ignoring step');
      return null;
    }

    // Create step
    const step = this.createStep(data);
    this.session.steps.push(step);

    // Mark for save
    this.pendingSave = true;

    // Emit event
    this.emitEvent('step_captured', this.session.id, { step });

    this.log('Step captured:', this.session.steps.length, step.event);
    return step;
  }

  /**
   * Delete last captured step
   */
  deleteLastStep(): Step | null {
    if (!this.session || this.session.steps.length <= 1) {
      return null; // Keep at least the 'open' step
    }

    const deleted = this.session.steps.pop();
    
    if (deleted) {
      this.pendingSave = true;
      this.emitEvent('step_deleted', this.session.id, { step: deleted });
      this.log('Step deleted:', deleted.id);
    }

    return deleted || null;
  }

  /**
   * Delete step at index
   */
  deleteStepAt(index: number): Step | null {
    if (!this.session) return null;
    
    // Don't delete the first 'open' step
    if (index === 0) return null;
    
    if (index < 0 || index >= this.session.steps.length) {
      return null;
    }

    const [deleted] = this.session.steps.splice(index, 1);

    // Renumber remaining steps
    this.renumberSteps();

    if (deleted) {
      this.pendingSave = true;
      this.emitEvent('step_deleted', this.session.id, { step: deleted, index });
    }

    return deleted || null;
  }

  /**
   * Get current steps
   */
  getSteps(): Step[] {
    return this.session ? [...this.session.steps] : [];
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.session?.steps.length || 0;
  }

  // ==========================================================================
  // STEP CREATION
  // ==========================================================================

  /**
   * Create 'open' step for page navigation
   */
  private createOpenStep(url: string): Step {
    return coreCreateStep({
      event: 'open',
      path: url,
      value: url,
      x: 0,
      y: 0,
      bundle: this.createEmptyBundle(url)
    });
  }

  /**
   * Create step from capture data
   */
  private createStep(data: StepCaptureData): Step {
    return coreCreateStep({
      event: data.event, // CRITICAL: Only 'click' | 'input' | 'enter'
      path: data.bundle.xpath || data.bundle.css || '',
      value: data.value,
      label: data.bundle.aria || data.bundle.placeholder || '',
      x: 0, // Coordinates not captured from content script
      y: 0,
      bundle: data.bundle
    });
  }

  /**
   * Create empty bundle for open step
   */
  private createEmptyBundle(pageUrl: string): LocatorBundle {
    return {
      tag: 'document',
      id: '',
      name: '',
      placeholder: '',
      aria: '',
      dataAttrs: {},
      text: '',
      css: '',
      xpath: '',
      classes: [],
      pageUrl,
      bounding: null,
      iframeChain: null,
      shadowHosts: null
    };
  }

  /**
   * Renumber steps after deletion
   * Note: Step type doesn't have order field, steps are ordered by array index
   */
  private renumberSteps(): void {
    // Steps are inherently ordered by their position in the array
    // No explicit renumbering needed
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) return;

    this.autoSaveTimer = setInterval(() => {
      if (this.pendingSave) {
        this.saveStepsToProject().catch(console.error);
        this.pendingSave = false;
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save steps to project in storage
   */
  private async saveStepsToProject(): Promise<void> {
    if (!this.session || !this.storage) return;

    try {
      const project = await this.storage.getProject(this.session.projectId);
      
      if (project) {
        project.recorded_steps = [...this.session.steps];
        project.updated_date = Date.now();
        await this.storage.updateProject(project);
        this.log('Steps saved to project');
      }
    } catch (error) {
      console.error('[RecordingCoordinator] Failed to save steps:', error);
    }
  }

  // ==========================================================================
  // TAB COMMUNICATION
  // ==========================================================================

  /**
   * Send message to recording tab
   */
  private async sendToTab(tabId: number, message: unknown): Promise<unknown> {
    if (this.tabManager) {
      return this.tabManager.sendToTab(tabId, message, { ensureInjected: false });
    }

    // Fallback to direct Chrome API
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      throw new Error(`Failed to send message to tab: ${error}`);
    }
  }

  /**
   * Handle tab navigation during recording
   */
  handleTabNavigation(tabId: number, url: string): void {
    if (!this.session || this.session.tabId !== tabId) return;

    this.session.currentUrl = url;

    // Create new 'open' step for navigation
    if (this.session.state === 'recording') {
      const openStep = this.createOpenStep(url);
      this.session.steps.push(openStep);
      this.pendingSave = true;

      this.emitEvent('step_captured', this.session.id, { step: openStep });
      this.log('Navigation captured:', url);
    }
  }

  /**
   * Handle tab closed during recording
   */
  handleTabClosed(tabId: number): void {
    if (!this.session || this.session.tabId !== tabId) return;

    this.log('Recording tab closed, stopping recording');
    
    this.stopRecording().catch(error => {
      console.error('[RecordingCoordinator] Stop on tab close failed:', error);
    });
  }

  // ==========================================================================
  // EVENT EMITTER
  // ==========================================================================

  /**
   * Add event listener
   */
  on(listener: RecordingEventListener): () => void {
    this.listeners.add(listener);
    return () => this.off(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: RecordingEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(
    type: RecordingEventType,
    sessionId: string,
    data?: unknown
  ): void {
    const event: RecordingEvent = {
      type,
      sessionId,
      timestamp: Date.now(),
      data
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[RecordingCoordinator] Listener error:', error);
      }
    }
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  /**
   * Get current session
   */
  getSession(): RecordingSession | null {
    return this.session ? { ...this.session, steps: [...this.session.steps] } : null;
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.session?.state === 'recording';
  }

  /**
   * Check if recording is paused
   */
  isPaused(): boolean {
    return this.session?.state === 'paused';
  }

  /**
   * Get session state
   */
  getState(): RecordingSessionState {
    return this.session?.state || 'idle';
  }

  /**
   * Get recording tab ID
   */
  getRecordingTabId(): number | null {
    return this.session?.tabId || null;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Log message (if debug enabled)
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[RecordingCoordinator]', ...args);
    }
  }

  /**
   * Destroy coordinator
   */
  destroy(): void {
    this.stopAutoSave();
    this.listeners.clear();
    this.session = null;
    this.log('Destroyed');
  }
}

// ============================================================================
// DEPENDENCY INTERFACES
// ============================================================================

/**
 * State manager interface (for dependency injection)
 */
interface StateManagerLike {
  update(updates: Record<string, unknown>): void;
  set(key: string, value: unknown): void;
}

/**
 * Tab manager interface (for dependency injection)
 */
interface TabManagerLike {
  getTab(tabId: number): { url: string } | undefined;
  ensureContentScript(tabId: number): Promise<boolean>;
  sendToTab(tabId: number, message: unknown, options?: unknown): Promise<unknown>;
}

/**
 * Storage interface (for dependency injection)
 */
interface StorageLike {
  getProject(id: string): Promise<Project | null>;
  updateProject(project: Project): Promise<void>;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rec_${timestamp}_${random}`;
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: RecordingCoordinator | null = null;

/**
 * Get or create recording coordinator instance
 */
export function getRecordingCoordinator(): RecordingCoordinator {
  if (!instance) {
    instance = new RecordingCoordinator();
  }
  return instance;
}

/**
 * Reset recording coordinator singleton (for testing)
 */
export function resetRecordingCoordinator(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
