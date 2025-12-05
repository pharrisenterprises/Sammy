/**
 * Project Test Fixtures
 * @module test/fixtures/projects
 * @version 1.0.0
 */

import type { Project } from '@/core/types';

// ============================================================================
// BASE PROJECT
// ============================================================================

export const createProject = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  name: 'Test Project',
  description: 'A test project for testing',
  status: 'draft',
  target_url: 'https://example.com',
  created_date: Date.now(),
  updated_date: Date.now(),
  recorded_steps: [],
  parsed_fields: [],
  csv_data: [],
  ...overrides,
});

// ============================================================================
// PRESET PROJECTS
// ============================================================================

export const mockProjects: Project[] = [
  createProject({
    id: 1,
    name: 'Login Form Test',
    description: 'Tests the login form functionality',
    status: 'testing',
    target_url: 'https://example.com/login',
  }),
  createProject({
    id: 2,
    name: 'Checkout Flow',
    description: 'Tests the checkout process',
    status: 'complete',
    target_url: 'https://example.com/checkout',
  }),
  createProject({
    id: 3,
    name: 'Search Feature',
    description: 'Tests the search functionality',
    status: 'draft',
    target_url: 'https://example.com/search',
  }),
];

// ============================================================================
// PROJECT WITH STEPS
// ============================================================================

export const projectWithSteps = createProject({
  id: 10,
  name: 'Project With Steps',
  recorded_steps: [
    {
      id: '1',
      name: 'Click login button',
      event: 'click',
      path: '//*[@id="login-btn"]',
      value: '',
      label: 'Login',
      x: 100,
      y: 200,
      status: 'pending',
    },
    {
      id: '2',
      name: 'Enter username',
      event: 'input',
      path: '//*[@id="username"]',
      value: '{{username}}',
      label: 'Username',
      x: 100,
      y: 250,
      status: 'pending',
    },
    {
      id: '3',
      name: 'Press enter',
      event: 'enter',
      path: '//*[@id="password"]',
      value: '',
      label: 'Submit',
      x: 100,
      y: 300,
      status: 'pending',
    },
  ],
});

// ============================================================================
// PROJECT WITH CSV DATA
// ============================================================================

export const projectWithCsv = createProject({
  id: 20,
  name: 'Project With CSV',
  csv_data: [
    { username: 'user1', password: 'pass1', email: 'user1@example.com' },
    { username: 'user2', password: 'pass2', email: 'user2@example.com' },
    { username: 'user3', password: 'pass3', email: 'user3@example.com' },
  ],
  parsed_fields: [
    { field_name: 'username', mapped: true, inputvarfields: 'Username' },
    { field_name: 'password', mapped: true, inputvarfields: 'Password' },
    { field_name: 'email', mapped: false, inputvarfields: '' },
  ],
});
