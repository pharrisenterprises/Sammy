/**
 * Background Script Entry Point (P4-214)
 * @module background/backgroundP4
 * @version 1.0.0
 * 
 * Main entry point for the Manifest V3 service worker.
 * Initializes the BackgroundService singleton.
 */

import { BackgroundService } from './BackgroundService';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize background service
 */
const initializeBackground = async (): Promise<void> => {
  console.log('🚀 Starting Sammy Background Service (P4-214)');

  try {
    const service = BackgroundService.getInstance({
      debug: true,
      requestPersistentStorage: true,
    });

    await service.initialize();

    console.log('✅ Background service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize background service:', error);
  }
};

// Initialize immediately
initializeBackground();

// ============================================================================
// SERVICE WORKER LIFECYCLE
// ============================================================================

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  // @ts-expect-error - ServiceWorkerGlobalScope type
  event.waitUntil(self.clients.claim());
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('Service worker installed');
  // @ts-expect-error - ServiceWorkerGlobalScope type
  event.waitUntil(self.skipWaiting());
});

// Export for testing
export { BackgroundService };
