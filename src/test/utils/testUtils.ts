/**
 * Test Utilities
 * @module test/utils/testUtils
 * @version 1.0.0
 * 
 * Common testing utilities and helpers.
 */

import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

// ============================================================================
// USER EVENT SETUP
// ============================================================================

/**
 * Create user event instance with default options
 */
export const createUser = () => {
  return userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
  });
};

// ============================================================================
// ASYNC HELPERS
// ============================================================================

/**
 * Wait for next tick
 */
export const tick = (): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * Wait for multiple ticks
 */
export const ticks = async (count: number = 1): Promise<void> => {
  for (let i = 0; i < count; i++) {
    await tick();
  }
};

/**
 * Flush all pending promises
 */
export const flushPromises = (): Promise<void> => {
  return new Promise((resolve) => setImmediate(resolve));
};

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Create a deferred promise for testing async behavior
 */
export interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export const createDeferredPromise = <T>(): DeferredPromise<T> => {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
};

/**
 * Create a spy that tracks calls
 */
export const createCallTracker = <T extends (...args: unknown[]) => unknown>() => {
  const calls: Parameters<T>[] = [];
  
  const fn = vi.fn((...args: Parameters<T>) => {
    calls.push(args);
  }) as unknown as T & { calls: Parameters<T>[] };
  
  fn.calls = calls;
  
  return fn;
};

// ============================================================================
// DOM HELPERS
// ============================================================================

/**
 * Create a mock element with specified properties
 */
export const createMockElement = (
  tagName: string,
  attributes: Record<string, string> = {}
): HTMLElement => {
  const element = document.createElement(tagName);
  
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  
  return element;
};

/**
 * Create a mock input element
 */
export const createMockInput = (
  type: string = 'text',
  attributes: Record<string, string> = {}
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = type;
  
  Object.entries(attributes).forEach(([key, value]) => {
    input.setAttribute(key, value);
  });
  
  return input;
};

/**
 * Simulate user typing
 */
export const typeIntoInput = async (
  input: HTMLInputElement,
  value: string
): Promise<void> => {
  const user = createUser();
  await user.clear(input);
  await user.type(input, value);
};

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a mock was called with specific arguments
 */
export const assertCalledWith = <T extends (...args: unknown[]) => unknown>(
  mockFn: ReturnType<typeof vi.fn>,
  ...expectedArgs: Parameters<T>
): void => {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
};

/**
 * Assert that a mock was called n times
 */
export const assertCalledTimes = (
  mockFn: ReturnType<typeof vi.fn>,
  times: number
): void => {
  expect(mockFn).toHaveBeenCalledTimes(times);
};

/**
 * Assert that an element has specific text content
 */
export const assertTextContent = (
  element: HTMLElement,
  text: string
): void => {
  expect(element.textContent).toContain(text);
};

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Assert that an async function throws
 */
export const assertThrowsAsync = async (
  fn: () => Promise<unknown>,
  expectedError?: string | RegExp
): Promise<void> => {
  let threw = false;
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    threw = true;
    error = e as Error;
  }

  expect(threw).toBe(true);
  
  if (expectedError && error) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else {
      expect(error.message).toMatch(expectedError);
    }
  }
};

// ============================================================================
// SNAPSHOT HELPERS
// ============================================================================

/**
 * Create a simplified snapshot of an object
 */
export const simplifyForSnapshot = <T extends object>(
  obj: T,
  omitKeys: string[] = []
): Partial<T> => {
  const result: Partial<T> = {};
  
  Object.entries(obj).forEach(([key, value]) => {
    if (!omitKeys.includes(key)) {
      (result as Record<string, unknown>)[key] = value;
    }
  });
  
  return result;
};
