/**
 * Test Utilities - Barrel Export
 * @module test/utils
 * @version 1.0.0
 */

// Render utilities
export {
  render,
  renderWithRouter,
  renderWithContext,
  screen,
  waitFor,
  within,
  fireEvent,
  act,
} from './render';

// Test utilities
export {
  createUser,
  tick,
  ticks,
  flushPromises,
  createDeferredPromise,
  createCallTracker,
  createMockElement,
  createMockInput,
  typeIntoInput,
  assertCalledWith,
  assertCalledTimes,
  assertTextContent,
  assertThrowsAsync,
  simplifyForSnapshot,
  type DeferredPromise,
} from './testUtils';

// Re-export user-event
export { default as userEvent } from '@testing-library/user-event';
