/**
 * NotificationOverlay - On-page Notification UI
 * @module contentScript/NotificationOverlay
 * @version 1.0.0
 * 
 * Shows notification overlay during recording/replay.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notification options
 */
export interface NotificationOptions {
  label: string;
  value?: string;
  status: 'loading' | 'success' | 'error';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OVERLAY_ID = 'ext-test-notification';

const STATUS_COLORS = {
  loading: '#3b82f6', // Blue
  success: '#16a34a', // Green
  error: '#dc2626',   // Red
};

const STATUS_ICONS = {
  loading: '⏳',
  success: '✅',
  error: '❌',
};

const STATUS_TEXT = {
  loading: 'Processing...',
  success: 'Success',
  error: 'Failed',
};

// ============================================================================
// NOTIFICATION OVERLAY
// ============================================================================

/**
 * On-page notification overlay
 */
export class NotificationOverlay {
  private element: HTMLDivElement | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Show notification
   */
  show(options: NotificationOptions): void {
    // Only show in top frame
    if (window.self !== window.top) return;

    this.ensureElement();
    if (!this.element) return;

    // Clear any pending hide
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Update content
    this.element.innerHTML = this.renderContent(options);
    this.element.style.display = 'block';

    // Auto-hide after success/error
    if (options.status !== 'loading') {
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, 2000);
    }
  }

  /**
   * Hide notification
   */
  hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Remove notification element
   */
  destroy(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }

  /**
   * Ensure element exists
   */
  private ensureElement(): void {
    if (this.element) return;

    // Check if already exists
    let element = document.getElementById(OVERLAY_ID) as HTMLDivElement;
    
    if (!element) {
      element = document.createElement('div');
      element.id = OVERLAY_ID;
      this.applyStyles(element);
      document.body.appendChild(element);
    }

    this.element = element;
  }

  /**
   * Apply styles to element
   */
  private applyStyles(element: HTMLDivElement): void {
    Object.assign(element.style, {
      position: 'fixed',
      top: '62px',
      right: '20px',
      width: '280px',
      padding: '12px',
      borderRadius: '10px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      zIndex: '2147483647',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(4px)',
      transition: 'opacity 0.2s ease',
      display: 'none',
    });
  }

  /**
   * Render notification content
   */
  private renderContent(options: NotificationOptions): string {
    const statusColor = STATUS_COLORS[options.status];
    const statusIcon = STATUS_ICONS[options.status];
    const statusText = options.status === 'loading' 
      ? STATUS_TEXT.loading 
      : (options.status === 'success' ? STATUS_TEXT.success : STATUS_TEXT.error);

    return `
      <div style="font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${this.escapeHtml(options.label)}
      </div>
      ${options.value ? `
        <div style="opacity: 0.8; margin-bottom: 6px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${this.escapeHtml(options.value)}
        </div>
      ` : ''}
      <div style="color: ${statusColor}; font-weight: 500;">
        ${statusIcon} ${statusText}
      </div>
    `;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default NotificationOverlay;
