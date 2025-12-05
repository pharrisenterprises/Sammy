/**
 * Pages Barrel Export
 * @module src/pages
 * @version 1.0.0
 * 
 * Re-exports all page components for lazy loading.
 */

import { lazy } from 'react';

// =============================================================================
// LAZY LOADED PAGES
// =============================================================================

/**
 * Dashboard page - Project management and overview
 */
export const Dashboard = lazy(() => import('./Dashboard'));

/**
 * Recorder page - Record user interactions
 */
export const Recorder = lazy(() => import('./Recorder'));

/**
 * Field Mapper page - Map CSV columns to steps
 */
export const FieldMapper = lazy(() => import('./FieldMapper'));

/**
 * Test Runner page - Execute and monitor tests
 */
export const TestRunner = lazy(() => import('./TestRunner'));

// =============================================================================
// DIRECT EXPORTS (for non-lazy usage)
// =============================================================================

export { default as DashboardPage } from './Dashboard';
export { default as RecorderPage } from './Recorder';
export { default as FieldMapperPage } from './FieldMapper';
export { default as TestRunnerPage } from './TestRunner';

// =============================================================================
// PAGE ROUTES
// =============================================================================

/**
 * Route configuration for all pages
 */
export const PAGE_ROUTES = {
  dashboard: {
    path: '/',
    label: 'Dashboard',
    icon: 'home',
  },
  recorder: {
    path: '/recorder/:projectId',
    label: 'Recorder',
    icon: 'video',
  },
  fieldMapper: {
    path: '/mapper/:projectId',
    label: 'Field Mapper',
    icon: 'map',
  },
  testRunner: {
    path: '/runner/:projectId',
    label: 'Test Runner',
    icon: 'play',
  },
} as const;

export type PageRoute = keyof typeof PAGE_ROUTES;
