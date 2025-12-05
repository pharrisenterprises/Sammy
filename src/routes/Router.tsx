/**
 * Router - Application Routes
 * @module routes/Router
 * @version 1.0.0
 * 
 * Defines all application routes using React Router.
 * Implements lazy loading for code splitting.
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spinner } from '@/components/Ui/Progress';

// ============================================================================
// LAZY LOADED PAGES
// ============================================================================

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Recorder = lazy(() => import('@/pages/Recorder'));
const FieldMapper = lazy(() => import('@/pages/FieldMapper'));
const TestRunner = lazy(() => import('@/pages/TestRunner'));

// ============================================================================
// ROUTE LOADING FALLBACK
// ============================================================================

/**
 * Page loading fallback
 */
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Spinner size={32} variant="primary" />
  </div>
);

// ============================================================================
// NOT FOUND PAGE
// ============================================================================

/**
 * 404 Not Found page
 */
const NotFound: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
    <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
    <p className="text-gray-600 mb-4">Page not found</p>
    <a
      href="#/dashboard"
      className="text-blue-600 hover:text-blue-700 underline"
    >
      Go to Dashboard
    </a>
  </div>
);

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

/**
 * Route configuration
 */
export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  title: string;
}

/**
 * Application routes
 */
export const routes: RouteConfig[] = [
  {
    path: '/dashboard',
    element: <Dashboard />,
    title: 'Dashboard',
  },
  {
    path: '/recorder',
    element: <Recorder />,
    title: 'Recorder',
  },
  {
    path: '/mapper',
    element: <FieldMapper />,
    title: 'Field Mapper',
  },
  {
    path: '/runner',
    element: <TestRunner />,
    title: 'Test Runner',
  },
];

// ============================================================================
// ROUTER COMPONENT
// ============================================================================

/**
 * Application router component
 */
export const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Default redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Main routes */}
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={route.element}
          />
        ))}
        
        {/* 404 fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Create a URL for a page with optional query params
 */
export const createPageUrl = (path: string, params?: Record<string, string>): string => {
  const url = new URL(`#${path}`, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.hash;
};

/**
 * Get project ID from URL query params
 */
export const getProjectIdFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  return params.get('project');
};

export default AppRouter;
