/**
 * Vitest Global Setup
 * @module vitest.setup
 * @version 1.0.0
 * 
 * Global setup for all tests. Runs before each test file.
 */

import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Import mocks
import './src/test/mocks/chrome';
import './src/test/mocks/indexeddb';
import './src/test/mocks/dom';

// ============================================================================
// GLOBAL SETUP
// ============================================================================

beforeAll(() => {
  // Suppress console errors during tests (optional)
  // vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Set up any global state
});

afterAll(() => {
  // Clean up global state
  vi.restoreAllMocks();
});

afterEach(() => {
  // Clean up after each test
  vi.clearAllMocks();
  
  // Clear any DOM modifications
  document.body.innerHTML = '';
  
  // Clear localStorage/sessionStorage mocks
  localStorage.clear();
  sessionStorage.clear();
});

// ============================================================================
// GLOBAL MATCHERS EXTENSIONS
// ============================================================================

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// ============================================================================
// TYPE DECLARATIONS
// ============================================================================

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toBeWithinRange(floor: number, ceiling: number): T;
  }
  interface AsymmetricMatchersContaining {
    toBeWithinRange(floor: number, ceiling: number): unknown;
  }
}
