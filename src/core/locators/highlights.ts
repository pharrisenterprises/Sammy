/**
 * @fileoverview Visual element highlighting for recording and replay
 * @module core/locators/highlights
 * @version 1.0.0
 * 
 * This module provides visual highlighting capabilities for elements during
 * recording (user feedback) and replay (step visualization).
 * 
 * Features:
 * - Element outline highlighting
 * - Overlay with transparency
 * - Tooltip display
 * - Animation effects (pulse, fade)
 * - Multiple simultaneous highlights
 * - Auto-removal timers
 * 
 * @see PHASE_4_SPECIFICATIONS.md for UI specifications
 * @see locator-strategy_breakdown.md for strategy details
 */

import type { BoundingBox } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Highlight style preset
 */
export type HighlightStyle = 
  | 'recording'    // Red border for recording
  | 'replay'       // Blue border for replay
  | 'success'      // Green border for success
  | 'error'        // Orange border for error
  | 'info'         // Gray border for info
  | 'custom';      // Custom colors

/**
 * Highlight configuration
 */
export interface HighlightConfig {
  /** Style preset */
  style?: HighlightStyle;
  /** Border color (overrides style) */
  borderColor?: string;
  /** Background color with alpha */
  backgroundColor?: string;
  /** Border width in pixels */
  borderWidth?: number;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Duration in ms (0 = permanent until removed) */
  duration?: number;
  /** Animation type */
  animation?: 'none' | 'pulse' | 'fade-in' | 'fade-out';
  /** Animation duration in ms */
  animationDuration?: number;
  /** Show tooltip */
  showTooltip?: boolean;
  /** Tooltip text */
  tooltipText?: string;
  /** Tooltip position */
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Z-index for overlay */
  zIndex?: number;
  /** Padding around element */
  padding?: number;
}

/**
 * Active highlight instance
 */
export interface HighlightInstance {
  /** Unique ID */
  id: string;
  /** Target element */
  element: Element;
  /** Overlay element */
  overlay: HTMLDivElement;
  /** Tooltip element (if shown) */
  tooltip: HTMLDivElement | null;
  /** Configuration used */
  config: Required<HighlightConfig>;
  /** Creation timestamp */
  createdAt: number;
  /** Auto-remove timer ID */
  timerId: number | null;
}

/**
 * Highlight manager state
 */
export interface HighlightManagerState {
  /** Active highlights by ID */
  highlights: Map<string, HighlightInstance>;
  /** Next highlight ID */
  nextId: number;
  /** Whether manager is active */
  active: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Style presets
 */
export const STYLE_PRESETS: Record<HighlightStyle, Partial<HighlightConfig>> = {
  recording: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    animation: 'pulse'
  },
  replay: {
    borderColor: '#4dabf7',
    backgroundColor: 'rgba(77, 171, 247, 0.15)',
    animation: 'pulse'
  },
  success: {
    borderColor: '#51cf66',
    backgroundColor: 'rgba(81, 207, 102, 0.15)',
    animation: 'fade-out'
  },
  error: {
    borderColor: '#ff922b',
    backgroundColor: 'rgba(255, 146, 43, 0.15)',
    animation: 'pulse'
  },
  info: {
    borderColor: '#868e96',
    backgroundColor: 'rgba(134, 142, 150, 0.1)',
    animation: 'none'
  },
  custom: {}
};

/**
 * Default configuration
 */
export const DEFAULT_HIGHLIGHT_CONFIG: Required<HighlightConfig> = {
  style: 'recording',
  borderColor: '#ff6b6b',
  backgroundColor: 'rgba(255, 107, 107, 0.15)',
  borderWidth: 3,
  borderRadius: 4,
  duration: 2000,
  animation: 'pulse',
  animationDuration: 500,
  showTooltip: false,
  tooltipText: '',
  tooltipPosition: 'top',
  zIndex: 999999,
  padding: 2
};

/**
 * CSS class prefix
 */
const CLASS_PREFIX = 'sammy-highlight';

/**
 * Injected styles flag
 */
let stylesInjected = false;

// ============================================================================
// HIGHLIGHT MANAGER
// ============================================================================

/**
 * Highlight Manager class
 * 
 * Manages visual highlights on elements for recording and replay.
 * 
 * @example
 * ```typescript
 * const manager = new HighlightManager();
 * 
 * // Highlight during recording
 * const id = manager.highlight(element, {
 *   style: 'recording',
 *   duration: 1500,
 *   showTooltip: true,
 *   tooltipText: 'Recording click...'
 * });
 * 
 * // Remove manually
 * manager.remove(id);
 * 
 * // Clear all
 * manager.clearAll();
 * ```
 */
export class HighlightManager {
  private state: HighlightManagerState;

  constructor() {
    this.state = {
      highlights: new Map(),
      nextId: 1,
      active: true
    };

    // Inject styles on first use
    injectStyles();
  }

  /**
   * Highlight an element
   * 
   * @param element - Element to highlight
   * @param config - Highlight configuration
   * @returns Highlight ID for later removal
   */
  highlight(element: Element, config: HighlightConfig = {}): string {
    if (!this.state.active) {
      return '';
    }

    const id = `${CLASS_PREFIX}-${this.state.nextId++}`;
    const mergedConfig = this.mergeConfig(config);

    // Create overlay
    const overlay = this.createOverlay(element, mergedConfig, id);

    // Create tooltip if needed
    let tooltip: HTMLDivElement | null = null;
    if (mergedConfig.showTooltip && mergedConfig.tooltipText) {
      tooltip = this.createTooltip(element, mergedConfig, id);
    }

    // Set up auto-removal
    let timerId: number | null = null;
    if (mergedConfig.duration > 0) {
      timerId = window.setTimeout(() => {
        this.remove(id);
      }, mergedConfig.duration);
    }

    // Store instance
    const instance: HighlightInstance = {
      id,
      element,
      overlay,
      tooltip,
      config: mergedConfig,
      createdAt: Date.now(),
      timerId
    };

    this.state.highlights.set(id, instance);

    return id;
  }

  /**
   * Remove a highlight by ID
   */
  remove(id: string): boolean {
    const instance = this.state.highlights.get(id);
    
    if (!instance) {
      return false;
    }

    // Clear timer
    if (instance.timerId !== null) {
      window.clearTimeout(instance.timerId);
    }

    // Remove overlay with fade-out
    this.removeWithAnimation(instance.overlay, instance.config);

    // Remove tooltip
    if (instance.tooltip) {
      this.removeWithAnimation(instance.tooltip, instance.config);
    }

    this.state.highlights.delete(id);
    return true;
  }

  /**
   * Remove highlight for specific element
   */
  removeByElement(element: Element): boolean {
    for (const [id, instance] of this.state.highlights) {
      if (instance.element === element) {
        return this.remove(id);
      }
    }
    return false;
  }

  /**
   * Clear all highlights
   */
  clearAll(): void {
    for (const id of Array.from(this.state.highlights.keys())) {
      this.remove(id);
    }
  }

  /**
   * Update highlight configuration
   */
  update(id: string, config: Partial<HighlightConfig>): boolean {
    const instance = this.state.highlights.get(id);
    
    if (!instance) {
      return false;
    }

    // Update config
    const newConfig = { ...instance.config, ...config };
    
    // Apply style preset if changed
    if (config.style && config.style !== instance.config.style) {
      const preset = STYLE_PRESETS[config.style];
      Object.assign(newConfig, preset);
    }

    // Update overlay styles
    this.applyOverlayStyles(instance.overlay, instance.element, newConfig);

    // Update tooltip if needed
    if (instance.tooltip && config.tooltipText) {
      instance.tooltip.textContent = config.tooltipText;
    }

    instance.config = newConfig;
    return true;
  }

  /**
   * Get highlight by ID
   */
  get(id: string): HighlightInstance | undefined {
    return this.state.highlights.get(id);
  }

  /**
   * Get all active highlight IDs
   */
  getActiveIds(): string[] {
    return Array.from(this.state.highlights.keys());
  }

  /**
   * Get count of active highlights
   */
  getCount(): number {
    return this.state.highlights.size;
  }

  /**
   * Pause highlighting (new highlights won't be created)
   */
  pause(): void {
    this.state.active = false;
  }

  /**
   * Resume highlighting
   */
  resume(): void {
    this.state.active = true;
  }

  /**
   * Check if manager is active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Destroy manager and clean up
   */
  destroy(): void {
    this.clearAll();
    this.state.active = false;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Merge configuration with defaults and presets
   */
  private mergeConfig(config: HighlightConfig): Required<HighlightConfig> {
    const merged = { ...DEFAULT_HIGHLIGHT_CONFIG, ...config };

    // Apply style preset
    if (merged.style && merged.style !== 'custom') {
      const preset = STYLE_PRESETS[merged.style];
      Object.assign(merged, preset, config);
    }

    return merged;
  }

  /**
   * Create overlay element
   */
  private createOverlay(
    element: Element,
    config: Required<HighlightConfig>,
    id: string
  ): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = `${CLASS_PREFIX}-overlay`;
    
    this.applyOverlayStyles(overlay, element, config);

    // Add animation class
    if (config.animation !== 'none') {
      overlay.classList.add(`${CLASS_PREFIX}-${config.animation}`);
    }

    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Apply styles to overlay
   */
  private applyOverlayStyles(
    overlay: HTMLDivElement,
    element: Element,
    config: Required<HighlightConfig>
  ): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    overlay.style.cssText = `
      position: absolute;
      top: ${rect.top + scrollY - config.padding}px;
      left: ${rect.left + scrollX - config.padding}px;
      width: ${rect.width + config.padding * 2}px;
      height: ${rect.height + config.padding * 2}px;
      border: ${config.borderWidth}px solid ${config.borderColor};
      background-color: ${config.backgroundColor};
      border-radius: ${config.borderRadius}px;
      pointer-events: none;
      z-index: ${config.zIndex};
      box-sizing: border-box;
    `;
  }

  /**
   * Create tooltip element
   */
  private createTooltip(
    element: Element,
    config: Required<HighlightConfig>,
    id: string
  ): HTMLDivElement {
    const tooltip = document.createElement('div');
    tooltip.id = `${id}-tooltip`;
    tooltip.className = `${CLASS_PREFIX}-tooltip`;
    tooltip.textContent = config.tooltipText;

    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let top: number;
    let left: number;

    switch (config.tooltipPosition) {
      case 'bottom':
        top = rect.bottom + scrollY + 8;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'left':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left + scrollX - 8;
        tooltip.style.transform = 'translateX(-100%) translateY(-50%)';
        break;
      case 'right':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + scrollX + 8;
        tooltip.style.transform = 'translateY(-50%)';
        break;
      case 'top':
      default:
        top = rect.top + scrollY - 8;
        left = rect.left + scrollX + rect.width / 2;
        tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
        break;
    }

    tooltip.style.cssText += `
      position: absolute;
      top: ${top}px;
      left: ${left}px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      white-space: nowrap;
      pointer-events: none;
      z-index: ${config.zIndex + 1};
    `;

    document.body.appendChild(tooltip);
    return tooltip;
  }

  /**
   * Remove element with animation
   */
  private removeWithAnimation(
    element: HTMLElement,
    config: Required<HighlightConfig>
  ): void {
    if (config.animation === 'fade-out' || config.animation === 'pulse') {
      element.classList.add(`${CLASS_PREFIX}-fade-out`);
      setTimeout(() => {
        element.remove();
      }, config.animationDuration);
    } else {
      element.remove();
    }
  }
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Quick highlight with auto-removal
 * 
 * @param element - Element to highlight
 * @param duration - Duration in ms
 * @param style - Style preset
 */
export function quickHighlight(
  element: Element,
  duration: number = 1500,
  style: HighlightStyle = 'recording'
): void {
  const manager = getDefaultManager();
  manager.highlight(element, { style, duration });
}

/**
 * Highlight with success effect
 */
export function highlightSuccess(element: Element, duration: number = 1000): void {
  const manager = getDefaultManager();
  manager.highlight(element, {
    style: 'success',
    duration,
    animation: 'fade-out'
  });
}

/**
 * Highlight with error effect
 */
export function highlightError(
  element: Element,
  message?: string,
  duration: number = 3000
): void {
  const manager = getDefaultManager();
  manager.highlight(element, {
    style: 'error',
    duration,
    showTooltip: !!message,
    tooltipText: message || ''
  });
}

/**
 * Highlight for recording
 */
export function highlightRecording(
  element: Element,
  message?: string
): string {
  const manager = getDefaultManager();
  return manager.highlight(element, {
    style: 'recording',
    duration: 0, // Permanent until removed
    showTooltip: !!message,
    tooltipText: message || ''
  });
}

/**
 * Highlight for replay
 */
export function highlightReplay(
  element: Element,
  stepNumber?: number
): string {
  const manager = getDefaultManager();
  return manager.highlight(element, {
    style: 'replay',
    duration: 0,
    showTooltip: stepNumber !== undefined,
    tooltipText: stepNumber !== undefined ? `Step ${stepNumber}` : ''
  });
}

/**
 * Clear all highlights
 */
export function clearAllHighlights(): void {
  getDefaultManager().clearAll();
}

/**
 * Remove specific highlight
 */
export function removeHighlight(id: string): boolean {
  return getDefaultManager().remove(id);
}

// ============================================================================
// BOUNDING BOX HIGHLIGHT
// ============================================================================

/**
 * Highlight a bounding box area (not an element)
 * 
 * Useful for showing where element was expected to be.
 */
export function highlightBoundingBox(
  box: BoundingBox,
  config: HighlightConfig = {}
): string {
  const manager = getDefaultManager();
  
  // Create a temporary element to position overlay
  const tempElement = document.createElement('div');
  tempElement.style.cssText = `
    position: fixed;
    top: ${box.y}px;
    left: ${box.x}px;
    width: ${box.width}px;
    height: ${box.height}px;
    pointer-events: none;
  `;
  document.body.appendChild(tempElement);

  const id = manager.highlight(tempElement, {
    ...config,
    style: config.style || 'info'
  });

  // Remove temp element after highlight is created
  setTimeout(() => tempElement.remove(), 0);

  return id;
}

/**
 * Flash highlight (quick on/off)
 */
export function flashHighlight(
  element: Element,
  times: number = 3,
  interval: number = 200
): Promise<void> {
  return new Promise((resolve) => {
    const manager = getDefaultManager();
    let count = 0;

    const flash = () => {
      if (count >= times * 2) {
        resolve();
        return;
      }

      if (count % 2 === 0) {
        manager.highlight(element, {
          style: 'recording',
          duration: interval,
          animation: 'none'
        });
      }

      count++;
      setTimeout(flash, interval);
    };

    flash();
  });
}

// ============================================================================
// STYLES INJECTION
// ============================================================================

/**
 * Inject CSS styles for highlights
 */
function injectStyles(): void {
  if (stylesInjected) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = `${CLASS_PREFIX}-styles`;
  styleElement.textContent = `
    .${CLASS_PREFIX}-overlay {
      transition: opacity 0.2s ease-in-out;
    }

    .${CLASS_PREFIX}-pulse {
      animation: ${CLASS_PREFIX}-pulse-animation 1s ease-in-out infinite;
    }

    .${CLASS_PREFIX}-fade-in {
      animation: ${CLASS_PREFIX}-fade-in-animation 0.3s ease-in-out forwards;
    }

    .${CLASS_PREFIX}-fade-out {
      animation: ${CLASS_PREFIX}-fade-out-animation 0.3s ease-in-out forwards;
    }

    @keyframes ${CLASS_PREFIX}-pulse-animation {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.02);
      }
    }

    @keyframes ${CLASS_PREFIX}-fade-in-animation {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes ${CLASS_PREFIX}-fade-out-animation {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }

    .${CLASS_PREFIX}-tooltip {
      animation: ${CLASS_PREFIX}-fade-in-animation 0.2s ease-in-out forwards;
    }
  `;

  document.head.appendChild(styleElement);
  stylesInjected = true;
}

/**
 * Remove injected styles
 */
export function removeInjectedStyles(): void {
  const styleElement = document.getElementById(`${CLASS_PREFIX}-styles`);
  if (styleElement) {
    styleElement.remove();
    stylesInjected = false;
  }
}

// ============================================================================
// DEFAULT MANAGER SINGLETON
// ============================================================================

let defaultManager: HighlightManager | null = null;

/**
 * Get or create default highlight manager
 */
export function getDefaultManager(): HighlightManager {
  if (!defaultManager) {
    defaultManager = new HighlightManager();
  }
  return defaultManager;
}

/**
 * Reset default manager
 */
export function resetDefaultManager(): void {
  if (defaultManager) {
    defaultManager.destroy();
    defaultManager = null;
  }
}

// ============================================================================
// SCROLL INTO VIEW
// ============================================================================

/**
 * Scroll element into view and highlight
 */
export async function scrollAndHighlight(
  element: Element,
  config: HighlightConfig = {}
): Promise<string> {
  // Scroll into view
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  // Wait for scroll to complete
  await new Promise(resolve => setTimeout(resolve, 300));

  // Highlight
  return getDefaultManager().highlight(element, config);
}

/**
 * Ensure element is visible and highlight
 */
export async function ensureVisibleAndHighlight(
  element: Element,
  config: HighlightConfig = {}
): Promise<string> {
  const rect = element.getBoundingClientRect();
  const isVisible = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );

  if (!isVisible) {
    return scrollAndHighlight(element, config);
  }

  return getDefaultManager().highlight(element, config);
}
