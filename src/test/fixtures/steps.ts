/**
 * Step Test Fixtures
 * @module test/fixtures/steps
 * @version 1.0.0
 */

import type { Step, LocatorBundle } from '@/core/types';

// ============================================================================
// BASE STEP
// ============================================================================

export const createStep = (overrides: Partial<Step> = {}): Step => ({
  id: '1',
  name: 'Test Step',
  event: 'click',
  path: '//*[@id="test-element"]',
  value: '',
  label: 'Test Label',
  x: 100,
  y: 100,
  status: 'pending',
  ...overrides,
});

// ============================================================================
// LOCATOR BUNDLE
// ============================================================================

export const createBundle = (overrides: Partial<LocatorBundle> = {}): LocatorBundle => ({
  tag: 'button',
  id: 'test-btn',
  name: null,
  placeholder: null,
  aria: 'Test Button',
  dataAttrs: {},
  text: 'Click Me',
  css: '#test-btn',
  xpath: '//*[@id="test-btn"]',
  classes: ['btn', 'btn-primary'],
  attrs: { type: 'button' },
  role: 'button',
  title: null,
  href: null,
  src: null,
  bounding: { x: 100, y: 100, width: 120, height: 40 },
  pageUrl: 'https://example.com',
  ...overrides,
});

// ============================================================================
// PRESET STEPS
// ============================================================================

export const clickStep = createStep({
  id: 'click-1',
  name: 'Click button',
  event: 'click',
  label: 'Submit',
  bundle: createBundle({ id: 'submit-btn', text: 'Submit' }),
});

export const inputStep = createStep({
  id: 'input-1',
  name: 'Enter username',
  event: 'input',
  value: 'testuser',
  label: 'Username',
  path: '//*[@id="username"]',
  bundle: createBundle({
    tag: 'input',
    id: 'username',
    placeholder: 'Enter username',
  }),
});

export const enterStep = createStep({
  id: 'enter-1',
  name: 'Press enter',
  event: 'enter',
  label: 'Submit Form',
  bundle: createBundle({
    tag: 'input',
    id: 'password',
    placeholder: 'Enter password',
  }),
});

export const openStep = createStep({
  id: 'open-1',
  name: 'Navigate to page',
  event: 'open',
  value: 'https://example.com/page',
  label: 'Open Page',
});

// ============================================================================
// STEP SEQUENCES
// ============================================================================

export const loginSteps: Step[] = [
  createStep({
    id: 'login-1',
    event: 'click',
    label: 'Username Field',
    path: '//*[@id="username"]',
  }),
  createStep({
    id: 'login-2',
    event: 'input',
    value: 'testuser',
    label: 'Username',
    path: '//*[@id="username"]',
  }),
  createStep({
    id: 'login-3',
    event: 'click',
    label: 'Password Field',
    path: '//*[@id="password"]',
  }),
  createStep({
    id: 'login-4',
    event: 'input',
    value: 'testpass',
    label: 'Password',
    path: '//*[@id="password"]',
  }),
  createStep({
    id: 'login-5',
    event: 'click',
    label: 'Login Button',
    path: '//*[@id="login-btn"]',
  }),
];

export const searchSteps: Step[] = [
  createStep({
    id: 'search-1',
    event: 'click',
    label: 'Search Box',
    path: '//*[@id="search"]',
  }),
  createStep({
    id: 'search-2',
    event: 'input',
    value: 'test query',
    label: 'Search',
    path: '//*[@id="search"]',
  }),
  createStep({
    id: 'search-3',
    event: 'enter',
    label: 'Submit Search',
    path: '//*[@id="search"]',
  }),
];
