/**
 * Test Setup - Additional Setup Utilities
 * @module test/setup
 * @version 1.0.0
 * 
 * Additional setup utilities for specific test scenarios.
 */

import { vi } from 'vitest';

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Check if running in extension context
 */
export const isExtensionContext = (): boolean => {
  return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
};

/**
 * Mock extension context
 */
export const mockExtensionContext = (): void => {
  vi.stubGlobal('chrome', {
    ...globalThis.chrome,
    runtime: {
      ...globalThis.chrome?.runtime,
      id: 'test-extension-id',
    },
  });
};

/**
 * Clear extension context mock
 */
export const clearExtensionContext = (): void => {
  vi.unstubAllGlobals();
};

// ============================================================================
// ASYNC HELPERS
// ============================================================================

/**
 * Wait for async operations to complete
 */
export const waitForAsync = (): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * Wait for a specific amount of time
 */
export const waitFor = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wait for condition to be true
 */
export const waitUntil = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> => {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('waitUntil timeout');
    }
    await waitFor(interval);
  }
};

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Create a mock function that resolves after a delay
 */
export const createAsyncMock = <T>(
  result: T,
  delay: number = 0
): ReturnType<typeof vi.fn> => {
  return vi.fn().mockImplementation(() => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(result), delay);
    });
  });
};

/**
 * Create a mock function that rejects after a delay
 */
export const createRejectingMock = (
  error: Error,
  delay: number = 0
): ReturnType<typeof vi.fn> => {
  return vi.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(error), delay);
    });
  });
};
