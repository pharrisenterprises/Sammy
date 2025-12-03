/**
 * NotificationUI - Overlay Notification System
 * @module core/content/NotificationUI
 * @version 1.0.0
 * 
 * Implements INotificationUI for showing overlay notifications during
 * test replay execution. Creates DOM elements directly for compatibility
 * with content script context.
 * 
 * ## Features
 * - Loading, success, error, info notification types
 * - Progress bar with percentage display
 * - Auto-dismiss with configurable duration
 * - Fixed positioning (top-right corner)
 * - Shadow DOM isolation to avoid style conflicts
 * 
 * @example
 * ```typescript
 * const notificationUI = new NotificationUI();
 * 
 * // Show loading with progress
 * notificationUI.showLoading('Executing step 3 of 10...', 30);
 * 
 * // Show success
 * notificationUI.showSuccess('Test completed!', 3000);
 * 
 * // Show error
 * notificationUI.showError('Step failed: Element not found');
 * ```
 */

import type {
  INotificationUI,
  NotificationConfig,
  NotificationType,
} from './IContentScript';

import { DEFAULT_NOTIFICATION_DURATION } from './IContentScript';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notification UI configuration
 */
export interface NotificationUIConfig {
  /** Container ID */
  containerId?: string;
  
  /** Position on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  
  /** Z-index for overlay */
  zIndex?: number;
  
  /** Use shadow DOM for style isolation */
  useShadowDOM?: boolean;
  
  /** Animation duration in ms */
  animationDuration?: number;
  
  /** Default notification duration in ms */
  defaultDuration?: number;
}

/**
 * Default UI configuration
 */
export const DEFAULT_UI_CONFIG: Required<NotificationUIConfig> = {
  containerId: 'anthropic-auto-allow-notification',
  position: 'top-right',
  zIndex: 2147483647, // Max z-index
  useShadowDOM: true,
  animationDuration: 300,
  defaultDuration: DEFAULT_NOTIFICATION_DURATION,
};

/**
 * Notification colors by type
 */
export const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; border: string; text: string }> = {
  loading: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  success: { bg: '#22c55e', border: '#16a34a', text: '#ffffff' },
  error: { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
  info: { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' },
};

/**
 * Notification icons by type (Unicode)
 */
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  loading: '⏳',
  success: '✓',
  error: '✗',
  info: 'ℹ',
};

// ============================================================================
// STYLES
// ============================================================================

/**
 * Generate CSS for notification container
 */
function generateStyles(config: Required<NotificationUIConfig>): string {
  const positions: Record<string, string> = {
    'top-right': 'top: 16px; right: 16px;',
    'top-left': 'top: 16px; left: 16px;',
    'bottom-right': 'bottom: 16px; right: 16px;',
    'bottom-left': 'bottom: 16px; left: 16px;',
    'top-center': 'top: 16px; left: 50%; transform: translateX(-50%);',
  };
  
  return `
    .notification-container {
      position: fixed;
      ${positions[config.position]}
      z-index: ${config.zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      pointer-events: none;
    }
    
    .notification {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 280px;
      max-width: 400px;
      pointer-events: auto;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity ${config.animationDuration}ms ease, transform ${config.animationDuration}ms ease;
    }
    
    .notification.visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .notification-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .notification-content {
      flex: 1;
      min-width: 0;
    }
    
    .notification-message {
      margin: 0;
      word-wrap: break-word;
    }
    
    .notification-progress {
      margin-top: 8px;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .notification-progress-bar {
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 2px;
      transition: width 300ms ease;
    }
    
    .notification-close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 4px;
      margin: -4px;
      opacity: 0.7;
      font-size: 16px;
      line-height: 1;
      flex-shrink: 0;
    }
    
    .notification-close:hover {
      opacity: 1;
    }
    
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}

// ============================================================================
// NOTIFICATION UI CLASS
// ============================================================================

/**
 * Notification UI implementation
 */
export class NotificationUI implements INotificationUI {
  private config: Required<NotificationUIConfig>;
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private notificationEl: HTMLElement | null = null;
  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentConfig: NotificationConfig | null = null;
  
  constructor(config?: Partial<NotificationUIConfig>) {
    this.config = {
      ...DEFAULT_UI_CONFIG,
      ...config,
    };
  }
  
  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  
  /**
   * Initialize the notification container
   */
  private initialize(): void {
    if (this.container) {
      return;
    }
    
    if (typeof document === 'undefined') {
      return;
    }
    
    // Create container
    this.container = document.createElement('div');
    this.container.id = this.config.containerId;
    
    if (this.config.useShadowDOM) {
      // Use shadow DOM for style isolation
      this.shadowRoot = this.container.attachShadow({ mode: 'open' });
      
      // Add styles to shadow root
      const styleEl = document.createElement('style');
      styleEl.textContent = generateStyles(this.config);
      this.shadowRoot.appendChild(styleEl);
      
      // Create notification container inside shadow root
      const innerContainer = document.createElement('div');
      innerContainer.className = 'notification-container';
      this.shadowRoot.appendChild(innerContainer);
    } else {
      // Without shadow DOM
      this.container.className = 'notification-container';
      
      // Inject styles globally
      const styleEl = document.createElement('style');
      styleEl.id = `${this.config.containerId}-styles`;
      styleEl.textContent = generateStyles(this.config);
      document.head.appendChild(styleEl);
    }
    
    // Add to document
    document.body.appendChild(this.container);
  }
  
  /**
   * Get the notification container element
   */
  private getNotificationContainer(): HTMLElement | null {
    if (!this.container) {
      this.initialize();
    }
    
    if (this.config.useShadowDOM && this.shadowRoot) {
      return this.shadowRoot.querySelector('.notification-container');
    }
    
    return this.container;
  }
  
  // ==========================================================================
  // NOTIFICATION DISPLAY
  // ==========================================================================
  
  /**
   * Show notification
   */
  show(config: NotificationConfig): void {
    this.clearDismissTimeout();
    this.currentConfig = config;
    
    const container = this.getNotificationContainer();
    if (!container) {
      return;
    }
    
    // Remove existing notification
    if (this.notificationEl) {
      this.notificationEl.remove();
    }
    
    // Create notification element
    this.notificationEl = this.createNotificationElement(config);
    container.appendChild(this.notificationEl);
    
    // Trigger animation
    requestAnimationFrame(() => {
      if (this.notificationEl) {
        this.notificationEl.classList.add('visible');
      }
    });
    
    // Set auto-dismiss
    if (config.duration && config.duration > 0) {
      this.dismissTimeout = setTimeout(() => {
        this.hide();
      }, config.duration);
    }
  }
  
  /**
   * Hide current notification
   */
  hide(): void {
    this.clearDismissTimeout();
    
    if (this.notificationEl) {
      this.notificationEl.classList.remove('visible');
      
      // Remove after animation
      setTimeout(() => {
        if (this.notificationEl) {
          this.notificationEl.remove();
          this.notificationEl = null;
        }
      }, this.config.animationDuration);
    }
    
    this.currentConfig = null;
  }
  
  /**
   * Update current notification
   */
  update(config: Partial<NotificationConfig>): void {
    if (!this.currentConfig || !this.notificationEl) {
      return;
    }
    
    // Merge configs
    this.currentConfig = {
      ...this.currentConfig,
      ...config,
    };
    
    // Update message
    if (config.message !== undefined) {
      const messageEl = this.notificationEl.querySelector('.notification-message');
      if (messageEl) {
        messageEl.textContent = config.message;
      }
    }
    
    // Update progress
    if (config.progress !== undefined) {
      const progressBar = this.notificationEl.querySelector('.notification-progress-bar') as HTMLElement;
      if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, config.progress))}%`;
      }
    }
    
    // Update type (requires full rebuild)
    if (config.type !== undefined && config.type !== this.currentConfig.type) {
      this.show(this.currentConfig);
    }
  }
  
  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================
  
  /**
   * Show loading notification
   */
  showLoading(message: string, progress?: number): void {
    this.show({
      type: 'loading',
      message,
      duration: 0, // Don't auto-dismiss loading
      showProgress: progress !== undefined,
      progress,
    });
  }
  
  /**
   * Show success notification
   */
  showSuccess(message: string, duration?: number): void {
    this.show({
      type: 'success',
      message,
      duration: duration ?? this.config.defaultDuration,
    });
  }
  
  /**
   * Show error notification
   */
  showError(message: string, duration?: number): void {
    this.show({
      type: 'error',
      message,
      duration: duration ?? this.config.defaultDuration * 2, // Show errors longer
    });
  }
  
  /**
   * Show info notification
   */
  showInfo(message: string, duration?: number): void {
    this.show({
      type: 'info',
      message,
      duration: duration ?? this.config.defaultDuration,
    });
  }
  
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  /**
   * Check if notification is visible
   */
  isVisible(): boolean {
    return this.notificationEl !== null && this.notificationEl.classList.contains('visible');
  }
  
  /**
   * Get current notification config
   */
  getCurrentConfig(): NotificationConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }
  
  // ==========================================================================
  // ELEMENT CREATION
  // ==========================================================================
  
  /**
   * Create notification element
   */
  private createNotificationElement(config: NotificationConfig): HTMLElement {
    const colors = NOTIFICATION_COLORS[config.type];
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.backgroundColor = colors.bg;
    notification.style.borderLeft = `4px solid ${colors.border}`;
    notification.style.color = colors.text;
    
    // Icon
    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    
    if (config.type === 'loading') {
      // Spinner for loading
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      icon.appendChild(spinner);
    } else {
      icon.textContent = NOTIFICATION_ICONS[config.type];
    }
    notification.appendChild(icon);
    
    // Content
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    const message = document.createElement('p');
    message.className = 'notification-message';
    message.textContent = config.message;
    content.appendChild(message);
    
    // Progress bar
    if (config.showProgress) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'notification-progress';
      
      const progressBar = document.createElement('div');
      progressBar.className = 'notification-progress-bar';
      progressBar.style.width = `${config.progress ?? 0}%`;
      
      progressContainer.appendChild(progressBar);
      content.appendChild(progressContainer);
    }
    
    notification.appendChild(content);
    
    // Close button (for non-loading notifications)
    if (config.type !== 'loading') {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'notification-close';
      closeBtn.textContent = '×';
      closeBtn.onclick = () => this.hide();
      notification.appendChild(closeBtn);
    }
    
    return notification;
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Clear dismiss timeout
   */
  private clearDismissTimeout(): void {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
  }
  
  /**
   * Destroy the notification UI
   */
  destroy(): void {
    this.hide();
    this.clearDismissTimeout();
    
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
    
    // Remove global styles if not using shadow DOM
    if (!this.config.useShadowDOM && typeof document !== 'undefined') {
      const styleEl = document.getElementById(`${this.config.containerId}-styles`);
      if (styleEl) {
        styleEl.remove();
      }
    }
  }
  
  /**
   * Get configuration
   */
  getConfig(): Required<NotificationUIConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<NotificationUIConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a NotificationUI
 */
export function createNotificationUI(
  config?: Partial<NotificationUIConfig>
): NotificationUI {
  return new NotificationUI(config);
}

/**
 * Create notification UI at specific position
 */
export function createPositionedNotificationUI(
  position: NotificationUIConfig['position']
): NotificationUI {
  return new NotificationUI({ position });
}

/**
 * Create notification UI without shadow DOM
 */
export function createSimpleNotificationUI(): NotificationUI {
  return new NotificationUI({ useShadowDOM: false });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultNotificationUI: NotificationUI | null = null;

/**
 * Get default notification UI instance
 */
export function getNotificationUI(): NotificationUI {
  if (!defaultNotificationUI) {
    defaultNotificationUI = new NotificationUI();
  }
  return defaultNotificationUI;
}

/**
 * Reset default notification UI
 */
export function resetNotificationUI(): void {
  if (defaultNotificationUI) {
    defaultNotificationUI.destroy();
    defaultNotificationUI = null;
  }
}

// ============================================================================
// MOCK IMPLEMENTATION (for testing)
// ============================================================================

/**
 * Mock NotificationUI for testing without DOM
 */
export class MockNotificationUI implements INotificationUI {
  private visible = false;
  private currentConfig: NotificationConfig | null = null;
  private showHistory: NotificationConfig[] = [];
  
  show(config: NotificationConfig): void {
    this.visible = true;
    this.currentConfig = { ...config };
    this.showHistory.push({ ...config });
  }
  
  hide(): void {
    this.visible = false;
    this.currentConfig = null;
  }
  
  update(config: Partial<NotificationConfig>): void {
    if (this.currentConfig) {
      this.currentConfig = {
        ...this.currentConfig,
        ...config,
      };
    }
  }
  
  showLoading(message: string, progress?: number): void {
    this.show({
      type: 'loading',
      message,
      duration: 0,
      showProgress: progress !== undefined,
      progress,
    });
  }
  
  showSuccess(message: string, duration?: number): void {
    this.show({
      type: 'success',
      message,
      duration: duration ?? DEFAULT_NOTIFICATION_DURATION,
    });
  }
  
  showError(message: string, duration?: number): void {
    this.show({
      type: 'error',
      message,
      duration: duration ?? DEFAULT_NOTIFICATION_DURATION * 2,
    });
  }
  
  isVisible(): boolean {
    return this.visible;
  }
  
  // Test helpers
  
  /**
   * Get current config
   */
  getCurrentConfig(): NotificationConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }
  
  /**
   * Get show history
   */
  getShowHistory(): NotificationConfig[] {
    return [...this.showHistory];
  }
  
  /**
   * Get last shown notification
   */
  getLastShown(): NotificationConfig | null {
    return this.showHistory.length > 0 
      ? { ...this.showHistory[this.showHistory.length - 1] }
      : null;
  }
  
  /**
   * Reset mock state
   */
  reset(): void {
    this.visible = false;
    this.currentConfig = null;
    this.showHistory = [];
  }
}

/**
 * Create a mock notification UI
 */
export function createMockNotificationUI(): MockNotificationUI {
  return new MockNotificationUI();
}
