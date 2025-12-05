/**
 * LoadingSpinner - Loading indicator component
 * @module components/Ui/LoadingSpinner
 * @version 1.0.0
 * 
 * Provides loading indicators with multiple variants:
 * - Spinner: Circular spinning animation
 * - Dots: Three bouncing dots
 * - Pulse: Pulsing circle
 * - Bar: Horizontal progress bar animation
 * 
 * @example
 * ```tsx
 * <LoadingSpinner size="md" />
 * <LoadingSpinner variant="dots" label="Loading projects..." />
 * <LoadingOverlay isLoading={isLoading}>
 *   <Content />
 * </LoadingOverlay>
 * ```
 */

import React, { memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Spinner variant
 */
export type SpinnerVariant = 'spinner' | 'dots' | 'pulse' | 'bar';

/**
 * Spinner size
 */
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Component props
 */
export interface LoadingSpinnerProps {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  color?: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Overlay props
 */
export interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  label?: string;
  blur?: boolean;
  opaque?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Full page loader props
 */
export interface FullPageLoaderProps {
  label?: string;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZE_CONFIG: Record<SpinnerSize, { spinner: string; dots: string; label: string }> = {
  xs: { spinner: 'w-4 h-4', dots: 'w-1.5 h-1.5', label: 'text-xs' },
  sm: { spinner: 'w-5 h-5', dots: 'w-2 h-2', label: 'text-xs' },
  md: { spinner: 'w-8 h-8', dots: 'w-2.5 h-2.5', label: 'text-sm' },
  lg: { spinner: 'w-12 h-12', dots: 'w-3 h-3', label: 'text-base' },
  xl: { spinner: 'w-16 h-16', dots: 'w-4 h-4', label: 'text-lg' },
};

const DEFAULT_COLOR = 'text-blue-600';

// ============================================================================
// SPINNER VARIANTS
// ============================================================================

/**
 * Circular spinner variant
 */
const CircularSpinner: React.FC<{ size: SpinnerSize; color: string; testId?: string }> = memo(
  ({ size, color, testId }) => {
    const sizeClass = SIZE_CONFIG[size].spinner;
    
    return (
      <svg
        className={`animate-spin ${sizeClass} ${color}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        data-testid={testId}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  }
);

CircularSpinner.displayName = 'CircularSpinner';

/**
 * Bouncing dots variant
 */
const DotsSpinner: React.FC<{ size: SpinnerSize; color: string; testId?: string }> = memo(
  ({ size, color, testId }) => {
    const dotSize = SIZE_CONFIG[size].dots;
    
    return (
      <div className="flex items-center gap-1" data-testid={testId}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`${dotSize} rounded-full ${color.replace('text-', 'bg-')} animate-bounce`}
            style={{
              animationDelay: `${index * 0.15}s`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
    );
  }
);

DotsSpinner.displayName = 'DotsSpinner';

/**
 * Pulse variant
 */
const PulseSpinner: React.FC<{ size: SpinnerSize; color: string; testId?: string }> = memo(
  ({ size, color, testId }) => {
    const sizeClass = SIZE_CONFIG[size].spinner;
    
    return (
      <div className="relative" data-testid={testId}>
        <div
          className={`${sizeClass} rounded-full ${color.replace('text-', 'bg-')} opacity-75 animate-ping absolute`}
        />
        <div
          className={`${sizeClass} rounded-full ${color.replace('text-', 'bg-')} opacity-50`}
        />
      </div>
    );
  }
);

PulseSpinner.displayName = 'PulseSpinner';

/**
 * Bar variant (horizontal progress animation)
 */
const BarSpinner: React.FC<{ size: SpinnerSize; color: string; testId?: string }> = memo(
  ({ size, color, testId }) => {
    const heightMap: Record<SpinnerSize, string> = {
      xs: 'h-0.5',
      sm: 'h-1',
      md: 'h-1.5',
      lg: 'h-2',
      xl: 'h-3',
    };
    const height = heightMap[size];
    
    return (
      <div
        className={`w-full max-w-xs ${height} bg-gray-200 rounded-full overflow-hidden`}
        data-testid={testId}
      >
        <div
          className={`${height} ${color.replace('text-', 'bg-')} rounded-full animate-loading-bar`}
          style={{
            animation: 'loading-bar 1.5s ease-in-out infinite',
          }}
        />
        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; margin-left: 0%; }
            50% { width: 70%; margin-left: 30%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    );
  }
);

BarSpinner.displayName = 'BarSpinner';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * LoadingSpinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(({
  variant = 'spinner',
  size = 'md',
  color = DEFAULT_COLOR,
  label,
  showLabel = true,
  className = '',
  testId = 'loading-spinner',
}) => {
  const sizeConfig = SIZE_CONFIG[size];

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsSpinner size={size} color={color} testId={`${testId}-dots`} />;
      case 'pulse':
        return <PulseSpinner size={size} color={color} testId={`${testId}-pulse`} />;
      case 'bar':
        return <BarSpinner size={size} color={color} testId={`${testId}-bar`} />;
      case 'spinner':
      default:
        return <CircularSpinner size={size} color={color} testId={`${testId}-circle`} />;
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid={testId}
    >
      {renderSpinner()}
      
      {label && showLabel && (
        <span className={`${sizeConfig.label} text-gray-500`} data-testid={`${testId}-label`}>
          {label}
        </span>
      )}
      
      {/* Screen reader text */}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

// ============================================================================
// LOADING OVERLAY
// ============================================================================

/**
 * LoadingOverlay - Overlay with spinner for content loading
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = memo(({
  isLoading,
  children,
  variant = 'spinner',
  size = 'lg',
  label,
  blur = true,
  opaque = false,
  className = '',
  testId = 'loading-overlay',
}) => {
  return (
    <div className={`relative ${className}`} data-testid={testId}>
      {children}
      
      {isLoading && (
        <div
          className={`
            absolute inset-0 z-50 flex items-center justify-center
            ${opaque ? 'bg-white' : 'bg-white/80'}
            ${blur ? 'backdrop-blur-sm' : ''}
          `}
          data-testid={`${testId}-backdrop`}
        >
          <LoadingSpinner
            variant={variant}
            size={size}
            label={label}
            testId={`${testId}-spinner`}
          />
        </div>
      )}
    </div>
  );
});

LoadingOverlay.displayName = 'LoadingOverlay';

// ============================================================================
// FULL PAGE LOADER
// ============================================================================

/**
 * FullPageLoader - Full screen loading overlay
 */
export const FullPageLoader: React.FC<FullPageLoaderProps> = memo(({
  label = 'Loading...',
  variant = 'spinner',
  size = 'xl',
  testId = 'full-page-loader',
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
      data-testid={testId}
    >
      <LoadingSpinner
        variant={variant}
        size={size}
        label={label}
        testId={`${testId}-spinner`}
      />
    </div>
  );
});

FullPageLoader.displayName = 'FullPageLoader';

// ============================================================================
// INLINE SPINNER
// ============================================================================

/**
 * InlineSpinner - Small inline spinner for buttons
 */
export interface InlineSpinnerProps {
  size?: 'xs' | 'sm';
  color?: string;
  className?: string;
  testId?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = memo(({
  size = 'sm',
  color = 'text-current',
  className = '',
  testId = 'inline-spinner',
}) => {
  const sizeClass = size === 'xs' ? 'w-3 h-3' : 'w-4 h-4';
  
  return (
    <svg
      className={`animate-spin ${sizeClass} ${color} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      data-testid={testId}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
});

InlineSpinner.displayName = 'InlineSpinner';

// ============================================================================
// SKELETON LOADERS
// ============================================================================

/**
 * Skeleton - Content placeholder
 */
export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  testId?: string;
}

export const Skeleton: React.FC<SkeletonProps> = memo(({
  width = '100%',
  height = '1rem',
  rounded = 'md',
  className = '',
  testId = 'skeleton',
}) => {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 ${roundedClasses[rounded]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      data-testid={testId}
    />
  );
});

Skeleton.displayName = 'Skeleton';

/**
 * SkeletonText - Text line placeholder
 */
export interface SkeletonTextProps {
  lines?: number;
  spacing?: 'tight' | 'normal' | 'loose';
  lastLineWidth?: string;
  className?: string;
  testId?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = memo(({
  lines = 3,
  spacing = 'normal',
  lastLineWidth = '70%',
  className = '',
  testId = 'skeleton-text',
}) => {
  const spacingClasses = {
    tight: 'space-y-1',
    normal: 'space-y-2',
    loose: 'space-y-3',
  };

  return (
    <div className={`${spacingClasses[spacing]} ${className}`} data-testid={testId}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height="0.875rem"
          testId={`${testId}-line-${index}`}
        />
      ))}
    </div>
  );
});

SkeletonText.displayName = 'SkeletonText';

/**
 * SkeletonCard - Card placeholder
 */
export interface SkeletonCardProps {
  showImage?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showActions?: boolean;
  className?: string;
  testId?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = memo(({
  showImage = true,
  showTitle = true,
  showDescription = true,
  showActions = false,
  className = '',
  testId = 'skeleton-card',
}) => {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}
      data-testid={testId}
    >
      {showImage && (
        <Skeleton width="100%" height="8rem" rounded="md" className="mb-4" />
      )}
      
      {showTitle && (
        <Skeleton width="60%" height="1.25rem" className="mb-2" />
      )}
      
      {showDescription && (
        <SkeletonText lines={2} spacing="tight" lastLineWidth="80%" />
      )}
      
      {showActions && (
        <div className="mt-4 flex gap-2">
          <Skeleton width="5rem" height="2rem" rounded="md" />
          <Skeleton width="5rem" height="2rem" rounded="md" />
        </div>
      )}
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

// ============================================================================
// EXPORTS
// ============================================================================

export default LoadingSpinner;
