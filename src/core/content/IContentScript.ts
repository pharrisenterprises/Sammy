/**
 * IContentScript - Content Script System Interface
 * @module core/content/IContentScript
 * @version 1.0.0
 * 
 * Defines contracts for content script operations including dual-mode
 * recording/replay, iframe management, shadow DOM handling, and
 * cross-context messaging.
 * 
 * ## Content Script Architecture
 * 
 * The content script runs in an isolated world within the page context:
 * - Can access DOM but not page JavaScript
 * - Uses window.postMessage for page script communication
 * - Uses chrome.runtime for extension communication
 * 
 * ## Dual-Mode Operation
 * - Recording: Capture user interactions as steps
 * - Replay: Execute recorded steps programmatically
 * 
 * @example
 * ```typescript
 * // Initialize content script
 * const coordinator = createContentCoordinator();
 * await coordinator.initialize();
 * 
 * // Start recording
 * coordinator.startRecording();
 * 
 * // Or start replay
 * coordinator.startReplay(steps);
 * ```
 */

import type { Step } from '../types/step';
import type { LocatorBundle } from '../types/locator-bundle';

// ============================================================================
// MODE TYPES
// ============================================================================

/**
 * Content script operational mode
 */
export type ContentScriptMode = 'idle' | 'recording' | 'replaying';

/**
 * Content script state
 */
export interface ContentScriptState {
  /** Current operational mode */
  mode: ContentScriptMode;
  
  /** Whether initialized */
  initialized: boolean;
  
  /** Current page URL */
  pageUrl: string;
  
  /** Number of attached iframes */
  attachedIframes: number;
  
  /** Whether page interceptor is injected */
  interceptorInjected: boolean;
  
  /** Recording state (if recording) */
  recordingState?: RecordingState;
  
  /** Replay state (if replaying) */
  replayState?: ReplayState;
}

/**
 * Recording state
 */
export interface RecordingState {
  /** Whether actively recording */
  active: boolean;
  
  /** Number of events captured */
  eventsCaptured: number;
  
  /** Last captured event timestamp */
  lastEventTime?: number;
  
  /** Project ID being recorded */
  projectId?: number;
}

/**
 * Replay state
 */
export interface ReplayState {
  /** Whether actively replaying */
  active: boolean;
  
  /** Current step index */
  currentStep: number;
  
  /** Total steps */
  totalSteps: number;
  
  /** Steps completed */
  completedSteps: number;
  
  /** Steps failed */
  failedSteps: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Recorded event type
 */
export type RecordedEventType = 
  | 'click'
  | 'input'
  | 'change'
  | 'enter'
  | 'select'
  | 'focus'
  | 'blur'
  | 'submit'
  | 'navigation'
  | 'autocomplete_input'
  | 'autocomplete_selection';

/**
 * Recorded event data
 */
export interface RecordedEvent {
  /** Event type */
  eventType: RecordedEventType;
  
  /** XPath to element */
  xpath: string;
  
  /** CSS selector */
  selector?: string;
  
  /** Element ID */
  elementId?: string;
  
  /** Input value (for input events) */
  value: string;
  
  /** Detected label */
  label: string;
  
  /** Click coordinates */
  x?: number;
  y?: number;
  
  /** Locator bundle */
  bundle: LocatorBundle;
  
  /** Page URL */
  page: string;
  
  /** Timestamp */
  timestamp: number;
  
  /** Iframe chain (if in iframe) */
  iframeChain?: IframeInfo[];
}

/**
 * Iframe information
 */
export interface IframeInfo {
  /** Iframe index in parent */
  index: number;
  
  /** Iframe src URL */
  src?: string;
  
  /** Iframe ID */
  id?: string;
  
  /** Iframe name */
  name?: string;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Message from content script to extension
 */
export interface ContentToExtensionMessage {
  /** Message type */
  type: 
    | 'logEvent'
    | 'step_result'
    | 'recording_started'
    | 'recording_stopped'
    | 'replay_complete'
    | 'content_script_ready'
    | 'error';
  
  /** Message data */
  data?: unknown;
  
  /** Error message (if error) */
  error?: string;
}

/**
 * Message from extension to content script
 */
export interface ExtensionToContentMessage {
  /** Action type */
  action:
    | 'start_recording'
    | 'stop_recording'
    | 'execute_replay'
    | 'execute_step'
    | 'ping'
    | 'get_state'
    | 'inject_interceptor';
  
  /** Action payload */
  payload?: unknown;
}

/**
 * Message between content script and page context
 */
export interface PageContextMessage {
  /** Message type */
  type:
    | 'REPLAY_AUTOCOMPLETE'
    | 'AUTOCOMPLETE_INPUT'
    | 'AUTOCOMPLETE_SELECTION'
    | 'SHADOW_ROOT_EXPOSED'
    | 'PAGE_SCRIPT_READY'
    | 'EXECUTE_IN_PAGE';
  
  /** Message payload */
  payload?: unknown;
  
  /** Source identifier */
  source?: string;
}

/**
 * Step execution request
 */
export interface StepExecutionRequest {
  /** Step to execute */
  step: Step;
  
  /** CSV values for variable substitution */
  csvValues?: Record<string, string>;
  
  /** Field mappings */
  fieldMappings?: Record<string, string>;
  
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Step execution response
 */
export interface StepExecutionResponse {
  /** Whether step succeeded */
  success: boolean;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Execution duration in ms */
  duration: number;
  
  /** Element found (if any) */
  elementFound: boolean;
  
  /** Locator strategy used */
  strategyUsed?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/**
 * Notification type for UI overlay
 */
export type NotificationType = 'loading' | 'success' | 'error' | 'info';

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Notification type */
  type: NotificationType;
  
  /** Message text */
  message: string;
  
  /** Auto-dismiss duration in ms (0 = manual dismiss) */
  duration?: number;
  
  /** Show progress indicator */
  showProgress?: boolean;
  
  /** Progress value (0-100) */
  progress?: number;
}

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Event handler for recorded events
 */
export type RecordedEventHandler = (event: RecordedEvent) => void;

/**
 * Event handler for mode changes
 */
export type ModeChangeHandler = (
  newMode: ContentScriptMode,
  previousMode: ContentScriptMode
) => void;

/**
 * Event handler for errors
 */
export type ContentErrorHandler = (error: Error, context?: string) => void;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Event Recorder interface
 */
export interface IEventRecorder {
  /**
   * Start recording events
   */
  start(projectId?: number): void;
  
  /**
   * Stop recording events
   */
  stop(): void;
  
  /**
   * Check if recording
   */
  isRecording(): boolean;
  
  /**
   * Get recording state
   */
  getState(): RecordingState;
  
  /**
   * Register event handler
   */
  onEvent(handler: RecordedEventHandler): void;
  
  /**
   * Remove event handler
   */
  offEvent(handler: RecordedEventHandler): void;
  
  /**
   * Get captured events count
   */
  getEventCount(): number;
  
  /**
   * Clear captured events
   */
  clearEvents(): void;
}

/**
 * Step Replayer interface
 */
export interface IStepReplayer {
  /**
   * Execute a single step
   */
  executeStep(request: StepExecutionRequest): Promise<StepExecutionResponse>;
  
  /**
   * Execute multiple steps in sequence
   */
  executeSteps(
    steps: Step[],
    options?: {
      csvValues?: Record<string, string>;
      fieldMappings?: Record<string, string>;
      onStepComplete?: (index: number, response: StepExecutionResponse) => void;
      stopOnError?: boolean;
    }
  ): Promise<StepExecutionResponse[]>;
  
  /**
   * Stop current replay
   */
  stop(): void;
  
  /**
   * Check if replaying
   */
  isReplaying(): boolean;
  
  /**
   * Get replay state
   */
  getState(): ReplayState;
  
  /**
   * Find element using locator bundle
   */
  findElement(bundle: LocatorBundle, timeout?: number): Promise<Element | null>;
}

/**
 * Iframe Manager interface
 */
export interface IIframeManager {
  /**
   * Start monitoring for iframes
   */
  start(): void;
  
  /**
   * Stop monitoring
   */
  stop(): void;
  
  /**
   * Attach listeners to all current iframes
   */
  attachToAllIframes(): void;
  
  /**
   * Attach listeners to specific iframe
   */
  attachToIframe(iframe: HTMLIFrameElement): boolean;
  
  /**
   * Detach listeners from iframe
   */
  detachFromIframe(iframe: HTMLIFrameElement): void;
  
  /**
   * Get all attached iframes
   */
  getAttachedIframes(): HTMLIFrameElement[];
  
  /**
   * Get iframe chain for element
   */
  getIframeChain(element: Element): IframeInfo[];
  
  /**
   * Find element across iframes
   */
  findElementInIframes(
    xpath: string,
    iframeChain?: IframeInfo[]
  ): Element | null;
  
  /**
   * Check if iframe is cross-origin
   */
  isCrossOrigin(iframe: HTMLIFrameElement): boolean;
}

/**
 * Shadow DOM Handler interface
 */
export interface IShadowDOMHandler {
  /**
   * Initialize shadow DOM handling
   */
  initialize(): void;
  
  /**
   * Check if element is in shadow DOM
   */
  isInShadowDOM(element: Element): boolean;
  
  /**
   * Get shadow root for element
   */
  getShadowRoot(element: Element): ShadowRoot | null;
  
  /**
   * Traverse into shadow roots to find element
   */
  findInShadowRoots(
    selector: string,
    root?: Element | Document
  ): Element | null;
  
  /**
   * Get focused element (traversing shadow boundaries)
   */
  getFocusedElement(): Element | null;
  
  /**
   * Resolve XPath in shadow DOM context
   */
  resolveXPathInShadow(xpath: string): Element | null;
  
  /**
   * Check if page interceptor is available
   */
  isInterceptorAvailable(): boolean;
  
  /**
   * Get exposed closed shadow roots
   */
  getExposedShadowRoots(): Map<Element, ShadowRoot>;
}

/**
 * Context Bridge interface for cross-context messaging
 */
export interface IContextBridge {
  /**
   * Send message to extension (background/popup)
   */
  sendToExtension(message: ContentToExtensionMessage): Promise<unknown>;
  
  /**
   * Send message to page context
   */
  sendToPage(message: PageContextMessage): void;
  
  /**
   * Register handler for extension messages
   */
  onExtensionMessage(
    handler: (
      message: ExtensionToContentMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => boolean | void
  ): void;
  
  /**
   * Register handler for page context messages
   */
  onPageMessage(handler: (message: PageContextMessage) => void): void;
  
  /**
   * Remove extension message handler
   */
  offExtensionMessage(handler: Function): void;
  
  /**
   * Remove page message handler
   */
  offPageMessage(handler: Function): void;
  
  /**
   * Inject script into page context
   */
  injectPageScript(scriptPath: string): Promise<boolean>;
}

/**
 * Notification UI interface
 */
export interface INotificationUI {
  /**
   * Show notification
   */
  show(config: NotificationConfig): void;
  
  /**
   * Hide current notification
   */
  hide(): void;
  
  /**
   * Update notification
   */
  update(config: Partial<NotificationConfig>): void;
  
  /**
   * Show loading notification
   */
  showLoading(message: string, progress?: number): void;
  
  /**
   * Show success notification
   */
  showSuccess(message: string, duration?: number): void;
  
  /**
   * Show error notification
   */
  showError(message: string, duration?: number): void;
  
  /**
   * Check if notification is visible
   */
  isVisible(): boolean;
}

/**
 * Main Content Script Coordinator interface
 */
export interface IContentScript {
  /**
   * Initialize content script
   */
  initialize(): Promise<void>;
  
  /**
   * Cleanup and shutdown
   */
  shutdown(): void;
  
  /**
   * Get current mode
   */
  getMode(): ContentScriptMode;
  
  /**
   * Get current state
   */
  getState(): ContentScriptState;
  
  /**
   * Start recording mode
   */
  startRecording(projectId?: number): void;
  
  /**
   * Stop recording mode
   */
  stopRecording(): void;
  
  /**
   * Start replay mode
   */
  startReplay(steps: Step[]): Promise<void>;
  
  /**
   * Stop replay mode
   */
  stopReplay(): void;
  
  /**
   * Execute single step
   */
  executeStep(request: StepExecutionRequest): Promise<StepExecutionResponse>;
  
  /**
   * Register mode change handler
   */
  onModeChange(handler: ModeChangeHandler): void;
  
  /**
   * Register error handler
   */
  onError(handler: ContentErrorHandler): void;
  
  /**
   * Get event recorder
   */
  getRecorder(): IEventRecorder;
  
  /**
   * Get step replayer
   */
  getReplayer(): IStepReplayer;
  
  /**
   * Get iframe manager
   */
  getIframeManager(): IIframeManager;
  
  /**
   * Get shadow DOM handler
   */
  getShadowHandler(): IShadowDOMHandler;
  
  /**
   * Get context bridge
   */
  getContextBridge(): IContextBridge;
  
  /**
   * Get notification UI
   */
  getNotificationUI(): INotificationUI;
}

/**
 * Content Script factory type
 */
export type ContentScriptFactory = () => IContentScript;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default step execution timeout in ms
 */
export const DEFAULT_STEP_TIMEOUT = 30000;

/**
 * Default notification duration in ms
 */
export const DEFAULT_NOTIFICATION_DURATION = 3000;

/**
 * Page script source identifier
 */
export const PAGE_SCRIPT_SOURCE = 'anthropic-auto-allow-page';

/**
 * Content script source identifier
 */
export const CONTENT_SCRIPT_SOURCE = 'anthropic-auto-allow-content';

/**
 * Recorded event types that capture input values
 */
export const INPUT_EVENT_TYPES: readonly RecordedEventType[] = [
  'input',
  'change',
  'select',
  'autocomplete_input',
  'autocomplete_selection',
] as const;

/**
 * Recorded event types that represent clicks
 */
export const CLICK_EVENT_TYPES: readonly RecordedEventType[] = [
  'click',
  'enter',
  'submit',
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if event type captures input values
 */
export function isInputEventType(type: RecordedEventType): boolean {
  return INPUT_EVENT_TYPES.includes(type);
}

/**
 * Check if event type is a click
 */
export function isClickEventType(type: RecordedEventType): boolean {
  return CLICK_EVENT_TYPES.includes(type);
}

/**
 * Create empty recording state
 */
export function createEmptyRecordingState(): RecordingState {
  return {
    active: false,
    eventsCaptured: 0,
    lastEventTime: undefined,
    projectId: undefined,
  };
}

/**
 * Create empty replay state
 */
export function createEmptyReplayState(): ReplayState {
  return {
    active: false,
    currentStep: 0,
    totalSteps: 0,
    completedSteps: 0,
    failedSteps: 0,
  };
}

/**
 * Create initial content script state
 */
export function createInitialContentState(): ContentScriptState {
  return {
    mode: 'idle',
    initialized: false,
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    attachedIframes: 0,
    interceptorInjected: false,
  };
}

/**
 * Create recorded event
 */
export function createRecordedEvent(
  eventType: RecordedEventType,
  bundle: LocatorBundle,
  options?: {
    value?: string;
    label?: string;
    x?: number;
    y?: number;
    page?: string;
    iframeChain?: IframeInfo[];
  }
): RecordedEvent {
  return {
    eventType,
    xpath: bundle.xpath || '',
    selector: bundle.css || undefined,
    elementId: bundle.id,
    value: options?.value || '',
    label: options?.label || '',
    x: options?.x,
    y: options?.y,
    bundle,
    page: options?.page || (typeof window !== 'undefined' ? window.location.href : ''),
    timestamp: Date.now(),
    iframeChain: options?.iframeChain,
  };
}

/**
 * Create step execution response
 */
export function createStepResponse(
  success: boolean,
  duration: number,
  options?: {
    error?: string;
    elementFound?: boolean;
    strategyUsed?: string;
  }
): StepExecutionResponse {
  return {
    success,
    duration,
    elementFound: options?.elementFound ?? success,
    error: options?.error,
    strategyUsed: options?.strategyUsed,
  };
}

/**
 * Serialize iframe chain for transmission
 */
export function serializeIframeChain(iframes: HTMLIFrameElement[]): IframeInfo[] {
  return iframes.map((iframe, index) => ({
    index,
    src: iframe.src || undefined,
    id: iframe.id || undefined,
    name: iframe.name || undefined,
  }));
}

/**
 * Create content to extension message
 */
export function createContentMessage(
  type: ContentToExtensionMessage['type'],
  data?: unknown,
  error?: string
): ContentToExtensionMessage {
  return { type, data, error };
}

/**
 * Create notification config
 */
export function createNotification(
  type: NotificationType,
  message: string,
  options?: {
    duration?: number;
    showProgress?: boolean;
    progress?: number;
  }
): NotificationConfig {
  return {
    type,
    message,
    duration: options?.duration ?? (type === 'loading' ? 0 : DEFAULT_NOTIFICATION_DURATION),
    showProgress: options?.showProgress,
    progress: options?.progress,
  };
}
