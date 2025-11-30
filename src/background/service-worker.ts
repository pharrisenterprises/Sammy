/**
 * @fileoverview Background service worker for Sammy Test Recorder
 * @module background/service-worker
 * @version 1.0.0
 * 
 * This module provides the core background service worker that manages
 * extension state, routes messages, and coordinates all extension components.
 * 
 * SERVICE WORKER LIFECYCLE:
 * - Install: Initialize storage, set defaults
 * - Activate: Clean up old data, prepare for use
 * - Wake: Restore state when awakened from idle
 * 
 * MESSAGE ROUTING:
 * - Popup ↔ Background ↔ Content Script
 * - Side Panel ↔ Background ↔ Content Script
 * - All messages use lowercase_snake_case actions
 * 
 * @see PHASE_4_SPECIFICATIONS.md for background service specifications
 * @see background-service_breakdown.md for architecture details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extension state
 */
export interface ExtensionState {
  /** Currently active project ID */
  activeProjectId: string | null;
  /** Currently recording tab ID */
  recordingTabId: number | null;
  /** Currently replaying tab ID */
  replayingTabId: number | null;
  /** Recording state */
  isRecording: boolean;
  /** Replaying state */
  isReplaying: boolean;
  /** Paused state */
  isPaused: boolean;
  /** Last error message */
  lastError: string | null;
  /** Service worker start time */
  startedAt: number;
}

/**
 * Tab info tracked by service worker
 */
export interface TrackedTab {
  /** Tab ID */
  tabId: number;
  /** Tab URL */
  url: string;
  /** Whether content script is injected */
  contentScriptInjected: boolean;
  /** Whether tab is ready for recording/replay */
  ready: boolean;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Message from content script or popup
 */
export interface ExtensionMessage {
  /** Action name (lowercase_snake_case) */
  action: string;
  /** Message payload */
  data?: unknown;
  /** Source of message */
  source?: 'popup' | 'content_script' | 'side_panel';
  /** Tab ID (for content script messages) */
  tabId?: number;
}

/**
 * Message response
 */
export interface MessageResponse {
  /** Whether operation succeeded */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Message handler function
 */
export type MessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
) => Promise<MessageResponse> | MessageResponse;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default extension state
 */
export const DEFAULT_EXTENSION_STATE: ExtensionState = {
  activeProjectId: null,
  recordingTabId: null,
  replayingTabId: null,
  isRecording: false,
  isReplaying: false,
  isPaused: false,
  lastError: null,
  startedAt: Date.now()
};

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  EXTENSION_STATE: 'extensionState',
  TRACKED_TABS: 'trackedTabs',
  LAST_ACTIVE_PROJECT: 'lastActiveProject'
} as const;

/**
 * Content script path
 */
export const CONTENT_SCRIPT_PATH = 'content/content.js';

// ============================================================================
// SERVICE WORKER CLASS
// ============================================================================

/**
 * Background Service Worker
 * 
 * Manages extension state and coordinates all components.
 * 
 * @example
 * ```typescript
 * // In service-worker entry point
 * const serviceWorker = new BackgroundServiceWorker();
 * serviceWorker.initialize();
 * ```
 */
export class BackgroundServiceWorker {
  private state: ExtensionState;
  private trackedTabs: Map<number, TrackedTab>;
  private messageHandlers: Map<string, MessageHandler>;
  private initialized: boolean = false;

  constructor() {
    this.state = { ...DEFAULT_EXTENSION_STATE };
    this.trackedTabs = new Map();
    this.messageHandlers = new Map();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the service worker
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[ServiceWorker] Already initialized');
      return;
    }

    console.log('[ServiceWorker] Initializing...');

    // Register default message handlers
    this.registerDefaultHandlers();

    // Set up Chrome event listeners
    this.setupEventListeners();

    // Restore state from storage
    await this.restoreState();

    this.initialized = true;
    this.state.startedAt = Date.now();

    console.log('[ServiceWorker] Initialized successfully');
  }

  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    // State management
    this.registerHandler('get_state', () => this.handleGetState());
    this.registerHandler('set_active_project', (msg) => this.handleSetActiveProject(msg));
    
    // Recording control
    this.registerHandler('start_recording', (msg, sender) => this.handleStartRecording(msg, sender));
    this.registerHandler('stop_recording', () => this.handleStopRecording());
    this.registerHandler('pause_recording', () => this.handlePauseRecording());
    this.registerHandler('resume_recording', () => this.handleResumeRecording());
    
    // Replay control
    this.registerHandler('start_replay', (msg, sender) => this.handleStartReplay(msg, sender));
    this.registerHandler('stop_replay', () => this.handleStopReplay());
    this.registerHandler('pause_replay', () => this.handlePauseReplay());
    this.registerHandler('resume_replay', () => this.handleResumeReplay());
    
    // Tab management
    this.registerHandler('get_active_tab', () => this.handleGetActiveTab());
    this.registerHandler('inject_content_script', (msg) => this.handleInjectContentScript(msg));
    
    // Content script communication
    this.registerHandler('content_script_ready', (msg, sender) => this.handleContentScriptReady(msg, sender));
    this.registerHandler('step_captured', (msg, sender) => this.handleStepCaptured(msg, sender));
    this.registerHandler('step_executed', (msg, sender) => this.handleStepExecuted(msg, sender));
    
    // Error handling
    this.registerHandler('report_error', (msg) => this.handleReportError(msg));
    this.registerHandler('clear_error', () => this.handleClearError());
  }

  /**
   * Set up Chrome event listeners
   */
  private setupEventListeners(): void {
    // Message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => {
          console.error('[ServiceWorker] Message handler error:', error);
          sendResponse({ success: false, error: error.message });
        });
      
      // CRITICAL: Return true to keep channel open for async response
      return true;
    });

    // Tab events
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Extension install/update
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Service worker wake
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });
  }

  /**
   * Restore state from storage
   */
  private async restoreState(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.EXTENSION_STATE,
        STORAGE_KEYS.LAST_ACTIVE_PROJECT
      ]);

      if (result[STORAGE_KEYS.EXTENSION_STATE]) {
        // Restore partial state (some fields reset on restart)
        const saved = result[STORAGE_KEYS.EXTENSION_STATE];
        this.state.activeProjectId = saved.activeProjectId ?? null;
        // Recording/replay states reset on restart
        this.state.isRecording = false;
        this.state.isReplaying = false;
        this.state.isPaused = false;
        this.state.recordingTabId = null;
        this.state.replayingTabId = null;
      }

      if (result[STORAGE_KEYS.LAST_ACTIVE_PROJECT]) {
        this.state.activeProjectId = result[STORAGE_KEYS.LAST_ACTIVE_PROJECT];
      }

      console.log('[ServiceWorker] State restored:', this.state);
    } catch (error) {
      console.error('[ServiceWorker] Failed to restore state:', error);
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.EXTENSION_STATE]: this.state,
        [STORAGE_KEYS.LAST_ACTIVE_PROJECT]: this.state.activeProjectId
      });
    } catch (error) {
      console.error('[ServiceWorker] Failed to save state:', error);
    }
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  /**
   * Register a message handler
   */
  registerHandler(action: string, handler: MessageHandler): void {
    this.messageHandlers.set(action, handler);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(action: string): void {
    this.messageHandlers.delete(action);
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    const { action } = message;

    if (!action) {
      return { success: false, error: 'Message missing action' };
    }

    const handler = this.messageHandlers.get(action);

    if (!handler) {
      console.warn('[ServiceWorker] Unknown action:', action);
      return { success: false, error: `Unknown action: ${action}` };
    }

    try {
      const result = await handler(message, sender);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ServiceWorker] Handler error for ${action}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  // ==========================================================================
  // STATE HANDLERS
  // ==========================================================================

  /**
   * Handle get_state message
   */
  private handleGetState(): MessageResponse {
    return {
      success: true,
      data: { ...this.state }
    };
  }

  /**
   * Handle set_active_project message
   */
  private async handleSetActiveProject(message: ExtensionMessage): Promise<MessageResponse> {
    const { projectId } = message.data as { projectId: string | null };
    
    this.state.activeProjectId = projectId;
    await this.saveState();

    return { success: true, data: { projectId } };
  }

  // ==========================================================================
  // RECORDING HANDLERS
  // ==========================================================================

  /**
   * Handle start_recording message
   */
  private async handleStartRecording(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    if (this.state.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    if (this.state.isReplaying) {
      return { success: false, error: 'Cannot record while replaying' };
    }

    const { projectId } = message.data as { projectId: string };
    const tabId = sender.tab?.id ?? (message.data as { tabId?: number }).tabId;

    if (!tabId) {
      return { success: false, error: 'No tab ID provided' };
    }

    // Ensure content script is injected
    await this.ensureContentScriptInjected(tabId);

    // Update state
    this.state.isRecording = true;
    this.state.recordingTabId = tabId;
    this.state.activeProjectId = projectId;
    this.state.isPaused = false;
    await this.saveState();

    // Notify content script to start recording
    await this.sendToTab(tabId, {
      action: 'start_recording',
      data: { projectId }
    });

    // Notify popup/side panel
    this.broadcast({
      action: 'recording_started',
      data: { projectId, tabId }
    });

    return { success: true, data: { tabId } };
  }

  /**
   * Handle stop_recording message
   */
  private async handleStopRecording(): Promise<MessageResponse> {
    if (!this.state.isRecording) {
      return { success: false, error: 'Not recording' };
    }

    const tabId = this.state.recordingTabId;

    // Notify content script to stop
    if (tabId) {
      await this.sendToTab(tabId, { action: 'stop_recording', data: {} });
    }

    // Update state
    this.state.isRecording = false;
    this.state.recordingTabId = null;
    this.state.isPaused = false;
    await this.saveState();

    // Notify popup/side panel
    this.broadcast({
      action: 'recording_stopped',
      data: { tabId }
    });

    return { success: true };
  }

  /**
   * Handle pause_recording message
   */
  private async handlePauseRecording(): Promise<MessageResponse> {
    if (!this.state.isRecording || this.state.isPaused) {
      return { success: false, error: 'Cannot pause' };
    }

    this.state.isPaused = true;

    if (this.state.recordingTabId) {
      await this.sendToTab(this.state.recordingTabId, { action: 'pause_recording', data: {} });
    }

    this.broadcast({ action: 'recording_paused', data: {} });

    return { success: true };
  }

  /**
   * Handle resume_recording message
   */
  private async handleResumeRecording(): Promise<MessageResponse> {
    if (!this.state.isRecording || !this.state.isPaused) {
      return { success: false, error: 'Cannot resume' };
    }

    this.state.isPaused = false;

    if (this.state.recordingTabId) {
      await this.sendToTab(this.state.recordingTabId, { action: 'resume_recording', data: {} });
    }

    this.broadcast({ action: 'recording_resumed', data: {} });

    return { success: true };
  }

  // ==========================================================================
  // REPLAY HANDLERS
  // ==========================================================================

  /**
   * Handle start_replay message
   */
  private async handleStartReplay(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    if (this.state.isReplaying) {
      return { success: false, error: 'Already replaying' };
    }

    if (this.state.isRecording) {
      return { success: false, error: 'Cannot replay while recording' };
    }

    const { projectId, steps, config } = message.data as {
      projectId: string;
      steps: unknown[];
      config?: unknown;
    };

    const tabId = sender.tab?.id ?? (message.data as { tabId?: number }).tabId;

    if (!tabId) {
      return { success: false, error: 'No tab ID provided' };
    }

    // Ensure content script is injected
    await this.ensureContentScriptInjected(tabId);

    // Update state
    this.state.isReplaying = true;
    this.state.replayingTabId = tabId;
    this.state.activeProjectId = projectId;
    this.state.isPaused = false;
    await this.saveState();

    // Notify content script to start replay
    await this.sendToTab(tabId, {
      action: 'start_replay',
      data: { projectId, steps, config }
    });

    // Notify popup/side panel
    this.broadcast({
      action: 'replay_started',
      data: { projectId, tabId }
    });

    return { success: true, data: { tabId } };
  }

  /**
   * Handle stop_replay message
   */
  private async handleStopReplay(): Promise<MessageResponse> {
    if (!this.state.isReplaying) {
      return { success: false, error: 'Not replaying' };
    }

    const tabId = this.state.replayingTabId;

    if (tabId) {
      await this.sendToTab(tabId, { action: 'stop_replay', data: {} });
    }

    this.state.isReplaying = false;
    this.state.replayingTabId = null;
    this.state.isPaused = false;
    await this.saveState();

    this.broadcast({
      action: 'replay_stopped',
      data: { tabId }
    });

    return { success: true };
  }

  /**
   * Handle pause_replay message
   */
  private async handlePauseReplay(): Promise<MessageResponse> {
    if (!this.state.isReplaying || this.state.isPaused) {
      return { success: false, error: 'Cannot pause' };
    }

    this.state.isPaused = true;

    if (this.state.replayingTabId) {
      await this.sendToTab(this.state.replayingTabId, { action: 'pause_replay', data: {} });
    }

    this.broadcast({ action: 'replay_paused', data: {} });

    return { success: true };
  }

  /**
   * Handle resume_replay message
   */
  private async handleResumeReplay(): Promise<MessageResponse> {
    if (!this.state.isReplaying || !this.state.isPaused) {
      return { success: false, error: 'Cannot resume' };
    }

    this.state.isPaused = false;

    if (this.state.replayingTabId) {
      await this.sendToTab(this.state.replayingTabId, { action: 'resume_replay', data: {} });
    }

    this.broadcast({ action: 'replay_resumed', data: {} });

    return { success: true };
  }

  // ==========================================================================
  // TAB HANDLERS
  // ==========================================================================

  /**
   * Handle get_active_tab message
   */
  private async handleGetActiveTab(): Promise<MessageResponse> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        return { success: false, error: 'No active tab' };
      }

      return {
        success: true,
        data: {
          tabId: tab.id,
          url: tab.url,
          title: tab.title
        }
      };
    } catch (error) {
      return { success: false, error: 'Failed to get active tab' };
    }
  }

  /**
   * Handle inject_content_script message
   */
  private async handleInjectContentScript(message: ExtensionMessage): Promise<MessageResponse> {
    const { tabId } = message.data as { tabId: number };

    try {
      await this.injectContentScript(tabId);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to inject content script' };
    }
  }

  /**
   * Handle content_script_ready message
   */
  private handleContentScriptReady(
    _message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): MessageResponse {
    const tabId = sender.tab?.id;
    
    if (tabId) {
      this.trackedTabs.set(tabId, {
        tabId,
        url: sender.tab?.url || '',
        contentScriptInjected: true,
        ready: true,
        lastActivity: Date.now()
      });
    }

    return { success: true };
  }

  /**
   * Handle step_captured message (from content script during recording)
   */
  private handleStepCaptured(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender
  ): MessageResponse {
    // Forward to popup/side panel
    this.broadcast({
      action: 'step_captured',
      data: message.data,
      source: 'content_script'
    });

    return { success: true };
  }

  /**
   * Handle step_executed message (from content script during replay)
   */
  private handleStepExecuted(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender
  ): MessageResponse {
    // Forward to popup/side panel
    this.broadcast({
      action: 'step_executed',
      data: message.data,
      source: 'content_script'
    });

    return { success: true };
  }

  // ==========================================================================
  // ERROR HANDLERS
  // ==========================================================================

  /**
   * Handle report_error message
   */
  private handleReportError(message: ExtensionMessage): MessageResponse {
    const { error } = message.data as { error: string };
    
    this.state.lastError = error;
    console.error('[ServiceWorker] Error reported:', error);

    this.broadcast({
      action: 'error_reported',
      data: { error }
    });

    return { success: true };
  }

  /**
   * Handle clear_error message
   */
  private handleClearError(): MessageResponse {
    this.state.lastError = null;
    return { success: true };
  }

  // ==========================================================================
  // CHROME EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle tab removed
   */
  private handleTabRemoved(tabId: number): void {
    // Clean up tracked tab
    this.trackedTabs.delete(tabId);

    // Stop recording if recording tab was closed
    if (this.state.recordingTabId === tabId) {
      this.state.isRecording = false;
      this.state.recordingTabId = null;
      this.state.isPaused = false;
      this.saveState();
      
      this.broadcast({
        action: 'recording_stopped',
        data: { reason: 'tab_closed' }
      });
    }

    // Stop replay if replaying tab was closed
    if (this.state.replayingTabId === tabId) {
      this.state.isReplaying = false;
      this.state.replayingTabId = null;
      this.state.isPaused = false;
      this.saveState();
      
      this.broadcast({
        action: 'replay_stopped',
        data: { reason: 'tab_closed' }
      });
    }
  }

  /**
   * Handle tab updated
   */
  private handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    // Update tracked tab URL
    if (this.trackedTabs.has(tabId) && changeInfo.url) {
      const tracked = this.trackedTabs.get(tabId)!;
      tracked.url = changeInfo.url;
      tracked.lastActivity = Date.now();
    }

    // Re-inject content script on navigation if needed
    if (changeInfo.status === 'complete' && tab.url) {
      const isRecordingTab = this.state.recordingTabId === tabId;
      const isReplayingTab = this.state.replayingTabId === tabId;

      if (isRecordingTab || isReplayingTab) {
        this.ensureContentScriptInjected(tabId).catch(console.error);
      }
    }
  }

  /**
   * Handle extension installed/updated
   */
  private handleInstalled(details: chrome.runtime.InstalledDetails): void {
    console.log('[ServiceWorker] Extension installed:', details.reason);

    if (details.reason === 'install') {
      // First install - set defaults
      this.state = { ...DEFAULT_EXTENSION_STATE };
      this.saveState();
    } else if (details.reason === 'update') {
      // Update - migrate if needed
      console.log('[ServiceWorker] Updated from version:', details.previousVersion);
    }
  }

  /**
   * Handle service worker startup
   */
  private handleStartup(): void {
    console.log('[ServiceWorker] Startup');
    this.restoreState();
  }

  // ==========================================================================
  // TAB UTILITIES
  // ==========================================================================

  /**
   * Ensure content script is injected into tab
   */
  private async ensureContentScriptInjected(tabId: number): Promise<void> {
    const tracked = this.trackedTabs.get(tabId);
    
    if (tracked?.contentScriptInjected && tracked.ready) {
      return; // Already injected
    }

    await this.injectContentScript(tabId);
  }

  /**
   * Inject content script into tab
   */
  private async injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [CONTENT_SCRIPT_PATH]
      });

      this.trackedTabs.set(tabId, {
        tabId,
        url: '',
        contentScriptInjected: true,
        ready: false, // Will be set true when content script sends ready message
        lastActivity: Date.now()
      });
    } catch (error) {
      console.error('[ServiceWorker] Failed to inject content script:', error);
      throw error;
    }
  }

  /**
   * Send message to specific tab
   */
  private async sendToTab(tabId: number, message: ExtensionMessage): Promise<MessageResponse> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response as MessageResponse;
    } catch (error) {
      console.error('[ServiceWorker] Failed to send to tab:', error);
      return { success: false, error: 'Failed to send message to tab' };
    }
  }

  /**
   * Broadcast message to all extension contexts (popup, side panel)
   */
  private broadcast(message: ExtensionMessage): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors when no receivers (popup closed, etc.)
    });
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Get current state
   */
  getState(): ExtensionState {
    return { ...this.state };
  }

  /**
   * Get tracked tabs
   */
  getTrackedTabs(): TrackedTab[] {
    return Array.from(this.trackedTabs.values());
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: BackgroundServiceWorker | null = null;

/**
 * Get or create service worker instance
 */
export function getServiceWorker(): BackgroundServiceWorker {
  if (!instance) {
    instance = new BackgroundServiceWorker();
  }
  return instance;
}

/**
 * Initialize service worker (call once at startup)
 */
export async function initializeServiceWorker(): Promise<BackgroundServiceWorker> {
  const sw = getServiceWorker();
  await sw.initialize();
  return sw;
}

// ============================================================================
// AUTO-INITIALIZE
// ============================================================================

// Auto-initialize when loaded
initializeServiceWorker().catch(console.error);
