/**
 * ContentScriptService - Main Content Script Coordinator
 * @module contentScript/ContentScriptService
 * @version 1.0.0
 * 
 * Coordinates between recording and replay modes.
 * Manages initialization, message handling, and mode switching.
 */

import { RecordingMode } from './RecordingMode';
import { ReplayMode } from './ReplayMode';
import { IframeManager } from './IframeManager';
import { NotificationOverlay } from './NotificationOverlay';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Content script mode
 */
export type ContentScriptMode = 'idle' | 'recording' | 'replaying';

/**
 * Content script configuration
 */
export interface ContentScriptConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-inject into iframes */
  autoInjectIframes?: boolean;
  /** Show notification overlay */
  showNotifications?: boolean;
}

/**
 * Content script state
 */
export interface ContentScriptState {
  /** Current mode */
  mode: ContentScriptMode;
  /** Is initialized */
  initialized: boolean;
  /** Current project ID */
  projectId: string | null;
  /** Page URL */
  pageUrl: string;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: ContentScriptConfig = {
  debug: false,
  autoInjectIframes: true,
  showNotifications: true,
};

// ============================================================================
// CONTENT SCRIPT SERVICE
// ============================================================================

/**
 * Main content script service
 */
export class ContentScriptService {
  private static instance: ContentScriptService | null = null;

  private config: ContentScriptConfig;
  private state: ContentScriptState;
  private recordingMode: RecordingMode;
  private replayMode: ReplayMode;
  private iframeManager: IframeManager;
  private notificationOverlay: NotificationOverlay;

  private constructor(config: ContentScriptConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      mode: 'idle',
      initialized: false,
      projectId: null,
      pageUrl: window.location.href,
    };

    this.recordingMode = new RecordingMode(this);
    this.replayMode = new ReplayMode(this);
    this.iframeManager = new IframeManager(this);
    this.notificationOverlay = new NotificationOverlay();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: ContentScriptConfig): ContentScriptService {
    if (!ContentScriptService.instance) {
      ContentScriptService.instance = new ContentScriptService(config);
    }
    return ContentScriptService.instance;
  }

  /**
   * Initialize content script
   */
  async initialize(): Promise<void> {
    if (this.state.initialized) {
      this.log('Already initialized');
      return;
    }

    this.log('Initializing content script...');

    try {
      // Set up message listener
      this.setupMessageListener();

      // Inject page scripts
      this.injectPageScripts();

      // Set up iframe management
      if (this.config.autoInjectIframes) {
        this.iframeManager.initialize();
      }

      // Set up page message listener
      this.setupPageMessageListener();

      this.state.initialized = true;
      this.log('Content script initialized');

      // Notify background that content script is ready
      this.sendToBackground({ action: 'content_script_ready' });
    } catch (error) {
      console.error('Failed to initialize content script:', error);
      throw error;
    }
  }

  /**
   * Set up Chrome message listener
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(
    message: { type?: string; action?: string; data?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean {
    const type = message.type || message.action;
    this.log('Received message:', type);

    switch (type) {
      case 'ping':
        sendResponse('pong');
        return false;

      case 'start_recording':
        this.startRecording(message.data as { projectId?: string });
        sendResponse({ success: true });
        return false;

      case 'stop_recording':
        this.stopRecording();
        sendResponse({ success: true });
        return false;

      case 'runStep':
        this.handleRunStep(message.data, sendResponse);
        return true; // Async response

      case 'start_replay':
        this.startReplay(message.data as { steps: unknown[] });
        sendResponse({ success: true });
        return false;

      case 'stop_replay':
        this.stopReplay();
        sendResponse({ success: true });
        return false;

      case 'get_state':
        sendResponse({ success: true, data: this.getState() });
        return false;

      default:
        this.log('Unknown message type:', type);
        return false;
    }
  }

  /**
   * Handle run step message
   */
  private async handleRunStep(
    stepData: unknown,
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      const result = await this.replayMode.executeStep(stepData);
      sendResponse(result);
    } catch (error) {
      console.error('Step execution error:', error);
      sendResponse(false);
    }
  }

  /**
   * Set up page message listener (for page context scripts)
   */
  private setupPageMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data || !event.data.type) return;

      this.handlePageMessage(event.data);
    });
  }

  /**
   * Handle messages from page context
   */
  private handlePageMessage(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case 'AUTOCOMPLETE_INPUT':
        if (this.state.mode === 'recording') {
          this.recordingMode.handleAutocompleteInput(data);
        }
        break;

      case 'AUTOCOMPLETE_SELECTION':
        if (this.state.mode === 'recording') {
          this.recordingMode.handleAutocompleteSelection(data);
        }
        break;

      case 'SHADOW_ROOT_EXPOSED':
        this.log('Shadow root exposed:', data);
        break;
    }
  }

  /**
   * Inject page context scripts
   */
  private injectPageScripts(): void {
    // Inject interceptor for shadow DOM
    this.injectScript('js/interceptor.js');
    
    // Inject replay helper for autocomplete
    this.injectScript('js/replay.js');
  }

  /**
   * Inject a script into page context
   */
  private injectScript(fileName: string): void {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(fileName);
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
      this.log('Injected script:', fileName);
    } catch (error) {
      console.error('Failed to inject script:', fileName, error);
    }
  }

  /**
   * Start recording mode
   */
  startRecording(options?: { projectId?: string }): void {
    if (this.state.mode === 'recording') {
      this.log('Already recording');
      return;
    }

    this.log('Starting recording mode');
    this.state.mode = 'recording';
    this.state.projectId = options?.projectId || null;

    this.recordingMode.start();

    if (this.config.showNotifications) {
      this.notificationOverlay.show({
        label: 'Recording',
        status: 'loading',
      });
    }
  }

  /**
   * Stop recording mode
   */
  stopRecording(): void {
    if (this.state.mode !== 'recording') {
      return;
    }

    this.log('Stopping recording mode');
    this.recordingMode.stop();
    this.state.mode = 'idle';
    this.state.projectId = null;

    this.notificationOverlay.hide();
  }

  /**
   * Start replay mode
   */
  startReplay(options?: { steps: unknown[] }): void {
    if (this.state.mode === 'replaying') {
      this.log('Already replaying');
      return;
    }

    this.log('Starting replay mode');
    this.state.mode = 'replaying';

    this.replayMode.start(options?.steps);
  }

  /**
   * Stop replay mode
   */
  stopReplay(): void {
    if (this.state.mode !== 'replaying') {
      return;
    }

    this.log('Stopping replay mode');
    this.replayMode.stop();
    this.state.mode = 'idle';

    this.notificationOverlay.hide();
  }

  /**
   * Send message to background script
   */
  sendToBackground(message: unknown): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if background not available
    });
  }

  /**
   * Send log event (recording)
   */
  sendLogEvent(data: unknown): void {
    this.sendToBackground({
      type: 'logEvent',
      data,
    });
  }

  /**
   * Show notification
   */
  showNotification(options: {
    label: string;
    value?: string;
    status: 'loading' | 'success' | 'error';
  }): void {
    if (this.config.showNotifications) {
      this.notificationOverlay.show(options);
    }
  }

  /**
   * Get current state
   */
  getState(): ContentScriptState {
    return { ...this.state };
  }

  /**
   * Get recording mode instance
   */
  getRecordingMode(): RecordingMode {
    return this.recordingMode;
  }

  /**
   * Get replay mode instance
   */
  getReplayMode(): ReplayMode {
    return this.replayMode;
  }

  /**
   * Get iframe manager
   */
  getIframeManager(): IframeManager {
    return this.iframeManager;
  }

  /**
   * Log message (if debug enabled)
   */
  log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[ContentScript] ${message}`, ...args);
    }
  }
}

export default ContentScriptService;
