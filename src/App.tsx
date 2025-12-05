/**
 * App - Root Application Component
 * @module App
 * @version 1.0.0
 * 
 * Main application component that sets up:
 * - React Router for navigation
 * - Context providers for global state
 * - Error boundaries for error handling
 * - Layout wrapper for consistent UI
 * 
 * @example
 * ```tsx
 * // In main.tsx
 * import App from './App';
 * ReactDOM.createRoot(root).render(<App />);
 * ```
 */

import React, { Suspense } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from '@/context';
import { AppRouter } from '@/routes/Router';
import { MainLayout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/Ui/Progress';

// ============================================================================
// LOADING FALLBACK
// ============================================================================

/**
 * Loading fallback component
 */
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <Spinner size={48} variant="primary" />
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  </div>
);

// ============================================================================
// ERROR FALLBACK
// ============================================================================

/**
 * Error fallback props
 */
interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * Error fallback component
 */
const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md p-6 bg-white rounded-lg shadow-lg text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={resetError}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
);

// ============================================================================
// APP COMPONENT
// ============================================================================

/**
 * Root application component
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, resetError) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
    >
      <HashRouter>
        <AppProvider>
          <Suspense fallback={<LoadingFallback />}>
            <MainLayout>
              <AppRouter />
            </MainLayout>
          </Suspense>
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;