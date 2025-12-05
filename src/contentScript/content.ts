/**
 * Content Script Entry Point
 * @module contentScript/content
 * @version 1.0.0
 * 
 * Main entry point for the content script.
 * Initializes the ContentScriptService.
 */

import { ContentScriptService } from './ContentScriptService';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize content script
 */
const initializeContentScript = async (): Promise<void> => {
  // Prevent multiple initializations
  if ((window as unknown as { __sammyContentScript?: boolean }).__sammyContentScript) {
    console.log('Content script already initialized');
    return;
  }
  (window as unknown as { __sammyContentScript?: boolean }).__sammyContentScript = true;

  console.log('🎬 Sammy Content Script initializing...');

  try {
    const service = ContentScriptService.getInstance({
      debug: true,
      autoInjectIframes: true,
      showNotifications: true,
    });

    await service.initialize();

    console.log('✅ Sammy Content Script ready');
  } catch (error) {
    console.error('❌ Failed to initialize content script:', error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Export for testing
export { ContentScriptService };
