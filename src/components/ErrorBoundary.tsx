/**
 * ErrorBoundary - React Error Boundary
 * @module components/ErrorBoundary
 * @version 1.0.0
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary fallback={(error, reset) => <ErrorPage error={error} onRetry={reset} />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fallback render function
 */
export type FallbackRender = (error: Error, resetError: () => void) => React.ReactNode;

/**
 * ErrorBoundary props
 */
export interface ErrorBoundaryProps {
  /** Children to render */
  children: React.ReactNode;
  /** Fallback UI render function */
  fallback?: FallbackRender;
  /** Error callback */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Reset keys - reset boundary when these change */
  resetKeys?: unknown[];
}

/**
 * ErrorBoundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * Error boundary component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call error callback
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when reset keys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeysChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasResetKeysChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Render fallback UI
      if (fallback) {
        return fallback(error, this.resetError);
      }

      // Default fallback
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-600 mb-4">{error.message}</p>
          <button
            onClick={this.resetError}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// HOOK VERSION (for functional components)
// ============================================================================

/**
 * Hook for error boundary state
 * Note: This is a wrapper, not a true error boundary (can't catch render errors)
 */
export function useErrorBoundary(): {
  error: Error | null;
  showBoundary: (error: Error) => void;
  resetBoundary: () => void;
} {
  const [error, setError] = React.useState<Error | null>(null);

  const showBoundary = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const resetBoundary = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, showBoundary, resetBoundary };
}

export default ErrorBoundary;
