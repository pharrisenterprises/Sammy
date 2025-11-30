/**
 * @fileoverview DOM event handlers for recording user interactions
 * @module core/recording/event-handlers
 * @version 1.0.0
 * 
 * This module provides event handlers that connect browser DOM events
 * to the Recorder. It handles attaching/detaching listeners, event
 * filtering, and visual feedback.
 * 
 * EVENT HANDLING STRATEGY:
 * - Use capture phase for reliable event interception
 * - Debounce input events for performance
 * - Provide visual feedback via highlight system
 * - Clean up listeners to prevent memory leaks
 * 
 * @see PHASE_4_SPECIFICATIONS.md for recording specifications
 * @see recording-engine_breakdown.md for engine details
 */

import type { Recorder, CapturedStep } from './recorder';
import { shouldCaptureImmediately } from './recorder';
import {
  highlightRecording,
  removeHighlight
} from '../locators';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event handler configuration
 */
export interface EventHandlerConfig {
  /** Use capture phase for events */
  useCapture?: boolean;
  /** Prevent default on captured events */
  preventDefault?: boolean;
  /** Stop propagation on captured events */
  stopPropagation?: boolean;
  /** Show visual highlight on capture */
  showHighlight?: boolean;
  /** Highlight duration in ms */
  highlightDuration?: number;
  /** Log events to console (debug) */
  debugLog?: boolean;
  /** Throttle mousemove/scroll events */
  throttleMs?: number;
  /** Custom filter function */
  eventFilter?: (event: Event) => boolean;
}

/**
 * Attached handler info
 */
interface AttachedHandler {
  type: string;
  handler: EventListener;
  options: AddEventListenerOptions;
  target: EventTarget;
}

/**
 * Event handler manager state
 */
export interface EventHandlerState {
  /** Whether handlers are attached */
  attached: boolean;
  /** Attached handler references */
  handlers: AttachedHandler[];
  /** Current highlight ID */
  currentHighlightId: string | null;
  /** Recorder reference */
  recorder: Recorder | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default event handler configuration
 */
export const DEFAULT_EVENT_HANDLER_CONFIG: Required<EventHandlerConfig> = {
  useCapture: true,
  preventDefault: false,
  stopPropagation: false,
  showHighlight: true,
  highlightDuration: 1000,
  debugLog: false,
  throttleMs: 100,
  eventFilter: () => true
};

/**
 * Events to listen for
 */
export const RECORDING_EVENTS = {
  CLICK: 'click',
  INPUT: 'input',
  CHANGE: 'change',
  KEYDOWN: 'keydown',
  FOCUS: 'focus',
  BLUR: 'blur'
} as const;

// ============================================================================
// EVENT HANDLER MANAGER
// ============================================================================

/**
 * Event Handler Manager
 * 
 * Manages DOM event listeners for recording.
 * 
 * @example
 * ```typescript
 * const manager = new EventHandlerManager(recorder);
 * 
 * // Attach handlers to document
 * manager.attach(document);
 * 
 * // When done recording
 * manager.detach();
 * ```
 */
export class EventHandlerManager {
  private state: EventHandlerState;
  private config: Required<EventHandlerConfig>;
  private lastHighlightTime: number = 0;

  constructor(
    recorder: Recorder,
    config: EventHandlerConfig = {}
  ) {
    this.config = { ...DEFAULT_EVENT_HANDLER_CONFIG, ...config };
    this.state = {
      attached: false,
      handlers: [],
      currentHighlightId: null,
      recorder
    };
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Attach event handlers to target
   * 
   * @param target - DOM element or document to attach to
   */
  attach(target: EventTarget = document): void {
    if (this.state.attached) {
      this.detach();
    }

    const options: AddEventListenerOptions = {
      capture: this.config.useCapture,
      passive: false // Allow preventDefault
    };

    // Click handler
    this.addHandler(target, RECORDING_EVENTS.CLICK, this.handleClick, options);

    // Input handlers
    this.addHandler(target, RECORDING_EVENTS.INPUT, this.handleInput, options);
    this.addHandler(target, RECORDING_EVENTS.CHANGE, this.handleChange, options);

    // Keyboard handler
    this.addHandler(target, RECORDING_EVENTS.KEYDOWN, this.handleKeydown, options);

    // Focus handlers for context
    this.addHandler(target, RECORDING_EVENTS.FOCUS, this.handleFocus, { ...options, passive: true });
    this.addHandler(target, RECORDING_EVENTS.BLUR, this.handleBlur, { ...options, passive: true });

    this.state.attached = true;
    this.log('Event handlers attached');
  }

  /**
   * Detach all event handlers
   */
  detach(): void {
    for (const { target, type, handler, options } of this.state.handlers) {
      target.removeEventListener(type, handler, options);
    }

    this.state.handlers = [];
    this.state.attached = false;
    this.clearHighlight();
    this.log('Event handlers detached');
  }

  /**
   * Check if handlers are attached
   */
  isAttached(): boolean {
    return this.state.attached;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EventHandlerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<EventHandlerConfig> {
    return { ...this.config };
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle click events
   */
  private handleClick = (event: Event): void => {
    if (!this.shouldProcess(event)) return;

    const target = event.target as Element;
    if (!target) return;

    // Skip if target is an input that should capture input instead
    if (this.isTextInput(target)) {
      return; // Let input handler deal with it
    }

    this.log('Click captured', target);

    // Capture the click
    const captured = this.state.recorder?.captureClick(target);

    if (captured) {
      this.showCaptureHighlight(target);
      this.handleEventOptions(event);
    }
  };

  /**
   * Handle input events
   */
  private handleInput = (event: Event): void => {
    if (!this.shouldProcess(event)) return;

    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || !('value' in target)) return;

    this.log('Input captured', target, target.value);

    // Capture immediately for certain input types
    if (shouldCaptureImmediately(target)) {
      const captured = this.state.recorder?.captureInput(target, target.value);
      if (captured) {
        this.showCaptureHighlight(target);
      }
    } else {
      // Debounced capture handled by recorder
      this.state.recorder?.captureInput(target, target.value);
      this.showCaptureHighlight(target, 'input');
    }
  };

  /**
   * Handle change events (for select, checkbox, radio)
   */
  private handleChange = (event: Event): void => {
    if (!this.shouldProcess(event)) return;

    const target = event.target as HTMLSelectElement | HTMLInputElement;
    if (!target) return;

    // Select elements
    if (target.tagName === 'SELECT') {
      this.log('Select change captured', target, (target as HTMLSelectElement).value);
      const captured = this.state.recorder?.captureInput(target, (target as HTMLSelectElement).value);
      if (captured) {
        this.showCaptureHighlight(target);
      }
      return;
    }

    // Checkbox and radio
    if (target.tagName === 'INPUT' && 'type' in target) {
      const inputType = (target as HTMLInputElement).type;
      if (inputType === 'checkbox' || inputType === 'radio') {
        this.log('Checkbox/Radio change captured', target, (target as HTMLInputElement).checked);
        const captured = this.state.recorder?.captureClick(target);
        if (captured) {
          this.showCaptureHighlight(target);
        }
      }
    }
  };

  /**
   * Handle keydown events
   */
  private handleKeydown = (event: Event): void => {
    if (!this.shouldProcess(event)) return;
    if (!('key' in event)) return;

    const target = event.target as Element;
    if (!target) return;

    // Only capture Enter key
    if ((event as KeyboardEvent).key === 'Enter') {
      this.log('Enter key captured', target);

      const captured = this.state.recorder?.captureEnter(target);

      if (captured) {
        this.showCaptureHighlight(target, 'enter');
        this.handleEventOptions(event);
      }
    }
  };

  /**
   * Handle focus events (for context tracking)
   */
  private handleFocus = (event: Event): void => {
    if (!this.shouldProcess(event)) return;

    const target = event.target as Element;
    if (!target) return;

    // Track focused element for context
    this.log('Focus', target);
  };

  /**
   * Handle blur events (for finalizing inputs)
   */
  private handleBlur = (event: Event): void => {
    if (!this.shouldProcess(event)) return;

    const target = event.target as Element;
    if (!target) return;

    this.log('Blur', target);
    this.clearHighlight();
  };

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Add event handler and track it
   */
  private addHandler(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options: AddEventListenerOptions
  ): void {
    const boundHandler = handler.bind(this);
    target.addEventListener(type, boundHandler, options);
    
    this.state.handlers.push({
      type,
      handler: boundHandler,
      options,
      target
    });
  }

  /**
   * Check if event should be processed
   */
  private shouldProcess(event: Event): boolean {
    // Must have recorder and be recording
    if (!this.state.recorder?.isRecording()) {
      return false;
    }

    // Apply custom filter
    if (!this.config.eventFilter(event)) {
      return false;
    }

    // Check if target is in ignored selector
    const target = event.target as Element;
    if (target && this.isIgnoredElement(target)) {
      return false;
    }

    return true;
  }

  /**
   * Check if element is a text input
   */
  private isTextInput(element: Element): boolean {
    if (element.tagName === 'TEXTAREA') return true;
    
    if (element.tagName === 'INPUT' && 'type' in element) {
      const textTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
      return textTypes.includes((element as HTMLInputElement).type);
    }

    return false;
  }

  /**
   * Check if element should be ignored
   */
  private isIgnoredElement(element: Element): boolean {
    // Check for sammy-related elements
    const ignoredSelectors = [
      '[data-sammy-ignore]',
      '.sammy-highlight-overlay',
      '.sammy-ui',
      '#sammy-extension',
      '.sammy-tooltip'
    ];

    for (const selector of ignoredSelectors) {
      try {
        if (element.matches(selector) || element.closest(selector)) {
          return true;
        }
      } catch {
        // Invalid selector
      }
    }

    return false;
  }

  /**
   * Handle event options (preventDefault, stopPropagation)
   */
  private handleEventOptions(event: Event): void {
    if (this.config.preventDefault) {
      event.preventDefault();
    }
    if (this.config.stopPropagation) {
      event.stopPropagation();
    }
  }

  /**
   * Show capture highlight on element
   */
  private showCaptureHighlight(
    element: Element,
    type: 'click' | 'input' | 'enter' = 'click'
  ): void {
    if (!this.config.showHighlight) return;

    // Throttle highlights
    const now = Date.now();
    if (now - this.lastHighlightTime < this.config.throttleMs) {
      return;
    }
    this.lastHighlightTime = now;

    // Clear previous highlight
    this.clearHighlight();

    // Show new highlight
    const message = this.getHighlightMessage(type);
    this.state.currentHighlightId = highlightRecording(element, message);

    // Auto-remove after duration
    setTimeout(() => {
      this.clearHighlight();
    }, this.config.highlightDuration);
  }

  /**
   * Get highlight message for event type
   */
  private getHighlightMessage(type: 'click' | 'input' | 'enter'): string {
    switch (type) {
      case 'click':
        return 'Recording click...';
      case 'input':
        return 'Recording input...';
      case 'enter':
        return 'Recording enter...';
      default:
        return 'Recording...';
    }
  }

  /**
   * Clear current highlight
   */
  private clearHighlight(): void {
    if (this.state.currentHighlightId) {
      removeHighlight(this.state.currentHighlightId);
      this.state.currentHighlightId = null;
    }
  }

  /**
   * Log debug message
   */
  private log(...args: unknown[]): void {
    if (this.config.debugLog) {
      console.log('[SammyRecorder]', ...args);
    }
  }

  /**
   * Destroy manager and clean up
   */
  destroy(): void {
    this.detach();
    this.state.recorder = null;
  }
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Create click handler for recording
 */
export function createClickHandler(
  recorder: Recorder,
  onCapture?: (step: CapturedStep) => void
): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target) return;

    if (!recorder.isRecording()) return;

    const captured = recorder.captureClick(target);
    
    if (captured && onCapture) {
      const steps = recorder.getCapturedSteps();
      onCapture(steps[steps.length - 1]);
    }
  };
}

/**
 * Create input handler for recording
 */
export function createInputHandler(
  recorder: Recorder
): (event: Event) => void {
  return (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || !('value' in target)) return;

    if (!recorder.isRecording()) return;

    recorder.captureInput(target, target.value);
  };
}

/**
 * Create keydown handler for recording
 */
export function createKeydownHandler(
  recorder: Recorder,
  onCapture?: (step: CapturedStep) => void
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    const target = event.target as Element;
    if (!target) return;

    if (!recorder.isRecording()) return;

    if (event.key === 'Enter') {
      const captured = recorder.captureEnter(target);
      
      if (captured && onCapture) {
        const steps = recorder.getCapturedSteps();
        onCapture(steps[steps.length - 1]);
      }
    }
  };
}

/**
 * Attach all recording handlers to document
 * 
 * Convenience function for quick setup.
 * 
 * @param recorder - Recorder instance
 * @param config - Handler configuration
 * @returns Cleanup function
 */
export function attachRecordingHandlers(
  recorder: Recorder,
  config: EventHandlerConfig = {}
): () => void {
  const manager = new EventHandlerManager(recorder, config);
  manager.attach(document);

  return () => manager.detach();
}

/**
 * Create event filter for specific element types
 */
export function createElementTypeFilter(
  allowedTags: string[]
): (event: Event) => boolean {
  const upperTags = allowedTags.map(t => t.toUpperCase());
  
  return (event: Event) => {
    const target = event.target as Element;
    if (!target) return false;
    return upperTags.includes(target.tagName);
  };
}

/**
 * Create event filter for specific selectors
 */
export function createSelectorFilter(
  selector: string
): (event: Event) => boolean {
  return (event: Event) => {
    const target = event.target as Element;
    if (!target) return false;
    
    try {
      return target.matches(selector) || !!target.closest(selector);
    } catch {
      return false;
    }
  };
}

/**
 * Combine multiple event filters (AND logic)
 */
export function combineFilters(
  ...filters: Array<(event: Event) => boolean>
): (event: Event) => boolean {
  return (event: Event) => filters.every(filter => filter(event));
}

/**
 * Create exclude filter (NOT logic)
 */
export function createExcludeFilter(
  filter: (event: Event) => boolean
): (event: Event) => boolean {
  return (event: Event) => !filter(event);
}

// ============================================================================
// IFRAME SUPPORT
// ============================================================================

/**
 * Attach handlers to iframe content
 * 
 * @param iframe - Iframe element
 * @param recorder - Recorder instance
 * @param config - Handler configuration
 * @returns Cleanup function or null if cross-origin
 */
export function attachToIframe(
  iframe: HTMLIFrameElement,
  recorder: Recorder,
  config: EventHandlerConfig = {}
): (() => void) | null {
  try {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return null;

    const manager = new EventHandlerManager(recorder, config);
    manager.attach(iframeDoc);

    return () => manager.detach();
  } catch {
    // Cross-origin iframe
    console.warn('Cannot attach to cross-origin iframe');
    return null;
  }
}

/**
 * Attach handlers to all accessible iframes
 * 
 * @param recorder - Recorder instance
 * @param config - Handler configuration
 * @returns Array of cleanup functions
 */
export function attachToAllIframes(
  recorder: Recorder,
  config: EventHandlerConfig = {}
): Array<() => void> {
  const cleanups: Array<() => void> = [];
  const iframes = document.querySelectorAll('iframe');

  for (const iframe of Array.from(iframes)) {
    const cleanup = attachToIframe(iframe as HTMLIFrameElement, recorder, config);
    if (cleanup) {
      cleanups.push(cleanup);
    }
  }

  return cleanups;
}
