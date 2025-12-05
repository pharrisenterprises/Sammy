/**
 * DOM Mocks
 * @module test/mocks/dom
 * @version 1.0.0
 * 
 * Additional DOM mocks and utilities for testing.
 */

import { vi } from 'vitest';

// ============================================================================
// INTERSECTION OBSERVER MOCK
// ============================================================================

const mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(() => []),
}));

vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

// ============================================================================
// RESIZE OBSERVER MOCK
// ============================================================================

const mockResizeObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', mockResizeObserver);

// ============================================================================
// MUTATION OBSERVER MOCK (Enhanced)
// ============================================================================

// jsdom includes MutationObserver, but we enhance it for testing
const originalMutationObserver = globalThis.MutationObserver;

class MockMutationObserver extends originalMutationObserver {
  static instances: MockMutationObserver[] = [];
  
  constructor(callback: MutationCallback) {
    super(callback);
    MockMutationObserver.instances.push(this);
  }
  
  static clearInstances(): void {
    MockMutationObserver.instances.forEach((instance) => {
      instance.disconnect();
    });
    MockMutationObserver.instances = [];
  }
}

vi.stubGlobal('MutationObserver', MockMutationObserver);

// ============================================================================
// MATCH MEDIA MOCK
// ============================================================================

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
}));

vi.stubGlobal('matchMedia', mockMatchMedia);

// ============================================================================
// SCROLL MOCK
// ============================================================================

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();

// ============================================================================
// CLIPBOARD MOCK
// ============================================================================

const mockClipboard = {
  writeText: vi.fn(async () => {}),
  readText: vi.fn(async () => ''),
  write: vi.fn(async () => {}),
  read: vi.fn(async () => []),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

// ============================================================================
// GET COMPUTED STYLE MOCK (Enhanced)
// ============================================================================

const originalGetComputedStyle = window.getComputedStyle;

vi.stubGlobal('getComputedStyle', (element: Element) => {
  const style = originalGetComputedStyle(element);
  return {
    ...style,
    getPropertyValue: (prop: string) => {
      return style.getPropertyValue(prop) || '';
    },
  };
});

// ============================================================================
// BOUNDING CLIENT RECT MOCK
// ============================================================================

Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  top: 0,
  right: 100,
  bottom: 50,
  left: 0,
  toJSON: () => ({}),
});

// ============================================================================
// FOCUS MOCK
// ============================================================================

HTMLElement.prototype.focus = vi.fn();
HTMLElement.prototype.blur = vi.fn();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  mockIntersectionObserver,
  mockResizeObserver,
  MockMutationObserver,
  mockMatchMedia,
  mockClipboard,
};
