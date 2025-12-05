/**
 * IframeManager - Iframe Detection and Injection
 * @module contentScript/IframeManager
 * @version 1.0.0
 * 
 * Manages iframe detection and listener attachment.
 */

import type { ContentScriptService } from './ContentScriptService';

// ============================================================================
// IFRAME MANAGER
// ============================================================================

/**
 * Manages iframes in the page
 */
export class IframeManager {
  private service: ContentScriptService;
  private observer: MutationObserver | null = null;
  private attachedIframes: WeakSet<HTMLIFrameElement> = new WeakSet();

  constructor(service: ContentScriptService) {
    this.service = service;
  }

  /**
   * Initialize iframe management
   */
  initialize(): void {
    // Attach to existing iframes
    this.attachToAllIframes(document);

    // Watch for new iframes
    this.startObserver();

    this.service.log('Iframe manager initialized');
  }

  /**
   * Start mutation observer
   */
  private startObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLIFrameElement) {
            this.attachToIframe(node);
          } else if (node instanceof HTMLElement) {
            // Check for nested iframes
            const iframes = node.querySelectorAll('iframe');
            iframes.forEach((iframe) => this.attachToIframe(iframe as HTMLIFrameElement));
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stop mutation observer
   */
  stopObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Attach listeners to all iframes
   */
  attachToAllIframes(root: Document | HTMLElement): void {
    try {
      const iframes = root.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        this.attachToIframe(iframe as HTMLIFrameElement);
      });
    } catch (error) {
      console.warn('Failed to attach to iframes:', error);
    }
  }

  /**
   * Attach listeners to a single iframe
   */
  private attachToIframe(iframe: HTMLIFrameElement): void {
    // Skip if already attached
    if (this.attachedIframes.has(iframe)) return;

    // Wait for iframe to load
    if (iframe.contentDocument) {
      this.tryAttach(iframe);
    } else {
      iframe.addEventListener('load', () => {
        this.tryAttach(iframe);
      });
    }
  }

  /**
   * Try to attach listeners to iframe
   */
  private tryAttach(iframe: HTMLIFrameElement): void {
    try {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return;

      // Attach recording listeners
      const recordingMode = this.service.getRecordingMode();
      recordingMode.attachListeners(iframeDoc);

      // Recursively attach to nested iframes
      this.attachToAllIframes(iframeDoc);

      this.attachedIframes.add(iframe);
      this.service.log('Attached to iframe:', iframe.src || 'inline');
    } catch (error) {
      // Cross-origin iframe - can't access
      this.service.log('Cannot access iframe (cross-origin):', iframe.src);
    }
  }

  /**
   * Get iframe chain for element
   */
  getIframeChain(element: HTMLElement): HTMLIFrameElement[] {
    const chain: HTMLIFrameElement[] = [];
    let currentWindow: Window | null = element.ownerDocument?.defaultView || null;

    while (currentWindow && currentWindow !== window.top) {
      const parentWindow = currentWindow.parent;
      if (!parentWindow) break;

      try {
        const iframes = parentWindow.document.querySelectorAll('iframe');
        for (const iframe of Array.from(iframes)) {
          if ((iframe as HTMLIFrameElement).contentWindow === currentWindow) {
            chain.unshift(iframe as HTMLIFrameElement);
            break;
          }
        }
      } catch {
        // Cross-origin
        break;
      }

      currentWindow = parentWindow;
    }

    return chain;
  }

  /**
   * Serialize iframe chain
   */
  serializeIframeChain(chain: HTMLIFrameElement[]): { src: string; index: number }[] {
    return chain.map((iframe, index) => ({
      src: iframe.src || '',
      index,
    }));
  }
}

export default IframeManager;
