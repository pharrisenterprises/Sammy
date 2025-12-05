/**
 * ProgressBar - Progress indicator component
 * @module components/Ui/ProgressBar
 * @version 1.0.0
 * 
 * Displays progress with multiple variants:
 * - Linear progress bar
 * - Circular progress
 * - Step-based progress
 * - Indeterminate (loading) state
 * 
 * @example
 * ```tsx
 * <ProgressBar value={75} max={100} />
 * <ProgressBar value={3} max={10} showSteps />
 * <CircularProgress value={50} size="lg" />
 * ```
 */

import React, { memo, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Progress bar size
 */
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Progress bar color
 */
export type ProgressColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';

/**
 * Progress bar variant
 */
export type ProgressVariant = 'default' | 'striped' | 'gradient';

/**
 * Linear progress bar props
 */
export interface ProgressBarProps {
  value: number;
  max?: number;
  size?: ProgressSize;
  color?: ProgressColor;
  variant?: ProgressVariant;
  showLabel?: boolean;
  showValue?: boolean;
  label?: string;
  animated?: boolean;
  indeterminate?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Circular progress props
 */
export interface CircularProgressProps {
  value: number;
  max?: number;
  size?: ProgressSize;
  color?: ProgressColor;
  strokeWidth?: number;
  showValue?: boolean;
  label?: string;
  className?: string;
  testId?: string;
}

/**
 * Step progress props
 */
export interface StepProgressProps {
  current: number;
  total: number;
  size?: ProgressSize;
  color?: ProgressColor;
  showLabels?: boolean;
  labels?: string[];
  className?: string;
  testId?: string;
}

/**
 * Test execution progress props
 */
export interface TestProgressProps {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  currentStep: number;
  isRunning?: boolean;
  showDetails?: boolean;
  className?: string;
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZE_HEIGHTS: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
  xl: 'h-4',
};

const SIZE_LABELS: Record<ProgressSize, string> = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
};

const COLOR_BARS: Record<ProgressColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  gray: 'bg-gray-500',
};

const COLOR_TRACKS: Record<ProgressColor, string> = {
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  red: 'bg-red-100',
  yellow: 'bg-yellow-100',
  purple: 'bg-purple-100',
  gray: 'bg-gray-200',
};

const CIRCULAR_SIZES: Record<ProgressSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
};

const VARIANT_STYLES: Record<ProgressVariant, string> = {
  default: '',
  striped: 'bg-stripes',
  gradient: 'bg-gradient-to-r from-blue-400 to-blue-600',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate percentage from value and max
 */
export function calculatePercentage(value: number, max: number): number {
  if (max <= 0) return 0;
  const percentage = (value / max) * 100;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Format percentage for display
 */
export function formatPercentage(percentage: number, decimals: number = 0): string {
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Get color based on percentage (for dynamic coloring)
 */
export function getColorByPercentage(percentage: number): ProgressColor {
  if (percentage >= 80) return 'green';
  if (percentage >= 50) return 'blue';
  if (percentage >= 25) return 'yellow';
  return 'red';
}

// ============================================================================
// LINEAR PROGRESS BAR
// ============================================================================

/**
 * ProgressBar - Linear progress indicator
 */
export const ProgressBar: React.FC<ProgressBarProps> = memo(({
  value,
  max = 100,
  size = 'md',
  color = 'blue',
  variant = 'default',
  showLabel = false,
  showValue = false,
  label,
  animated = true,
  indeterminate = false,
  className = '',
  testId = 'progress-bar',
}) => {
  const percentage = useMemo(() => calculatePercentage(value, max), [value, max]);
  const heightClass = SIZE_HEIGHTS[size];
  const labelClass = SIZE_LABELS[size];
  const barColor = variant === 'gradient' ? '' : COLOR_BARS[color];
  const trackColor = COLOR_TRACKS[color];
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      {/* Label row */}
      {(showLabel || showValue) && (
        <div className={`flex justify-between items-center mb-1 ${labelClass}`}>
          {showLabel && (
            <span className="text-gray-700 font-medium" data-testid={`${testId}-label`}>
              {label || 'Progress'}
            </span>
          )}
          {showValue && (
            <span className="text-gray-500" data-testid={`${testId}-value`}>
              {indeterminate ? 'Loading...' : formatPercentage(percentage)}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className={`w-full ${trackColor} rounded-full overflow-hidden ${heightClass}`}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        data-testid={`${testId}-track`}
      >
        {/* Bar */}
        <div
          className={`
            ${heightClass} rounded-full
            ${barColor} ${variantStyle}
            ${animated && !indeterminate ? 'transition-all duration-300 ease-out' : ''}
            ${indeterminate ? 'animate-indeterminate w-1/3' : ''}
          `}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
          data-testid={`${testId}-bar`}
        />
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .animate-indeterminate {
          animation: indeterminate 1.5s ease-in-out infinite;
        }
        .bg-stripes {
          background-image: linear-gradient(
            45deg,
            rgba(255,255,255,0.15) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255,255,255,0.15) 50%,
            rgba(255,255,255,0.15) 75%,
            transparent 75%,
            transparent
          );
          background-size: 1rem 1rem;
          animation: stripes 1s linear infinite;
        }
        @keyframes stripes {
          from { background-position: 1rem 0; }
          to { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

// ============================================================================
// CIRCULAR PROGRESS
// ============================================================================

/**
 * CircularProgress - Circular progress indicator
 */
export const CircularProgress: React.FC<CircularProgressProps> = memo(({
  value,
  max = 100,
  size = 'md',
  color = 'blue',
  strokeWidth = 4,
  showValue = true,
  label,
  className = '',
  testId = 'circular-progress',
}) => {
  const percentage = useMemo(() => calculatePercentage(value, max), [value, max]);
  const sizePx = CIRCULAR_SIZES[size];
  const radius = (sizePx - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorMap: Record<ProgressColor, string> = {
    blue: '#3b82f6',
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
    purple: '#a855f7',
    gray: '#6b7280',
  };

  const trackColorMap: Record<ProgressColor, string> = {
    blue: '#dbeafe',
    green: '#dcfce7',
    red: '#fee2e2',
    yellow: '#fef3c7',
    purple: '#f3e8ff',
    gray: '#e5e7eb',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: sizePx, height: sizePx }}
      data-testid={testId}
    >
      <svg
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          stroke={trackColorMap[color]}
          strokeWidth={strokeWidth}
          data-testid={`${testId}-track`}
        />
        {/* Progress */}
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-out"
          data-testid={`${testId}-bar`}
        />
      </svg>

      {/* Center content */}
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-semibold ${size === 'xs' || size === 'sm' ? 'text-xs' : 'text-sm'}`}
            data-testid={`${testId}-value`}
          >
            {Math.round(percentage)}%
          </span>
          {label && size !== 'xs' && size !== 'sm' && (
            <span className="text-xs text-gray-500" data-testid={`${testId}-label`}>
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

CircularProgress.displayName = 'CircularProgress';

// ============================================================================
// STEP PROGRESS
// ============================================================================

/**
 * StepProgress - Step-based progress indicator
 */
export const StepProgress: React.FC<StepProgressProps> = memo(({
  current,
  total,
  size = 'md',
  color = 'blue',
  showLabels = false,
  labels = [],
  className = '',
  testId = 'step-progress',
}) => {
  const dotSizes: Record<ProgressSize, string> = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  };

  const connectorHeights: Record<ProgressSize, string> = {
    xs: 'h-0.5',
    sm: 'h-0.5',
    md: 'h-1',
    lg: 'h-1',
    xl: 'h-1.5',
  };

  const dotSize = dotSizes[size];
  const connectorHeight = connectorHeights[size];
  const activeColor = COLOR_BARS[color];
  const inactiveColor = 'bg-gray-200';

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      <div className="flex items-center justify-between">
        {Array.from({ length: total }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber <= current;
          const isCurrent = stepNumber === current;

          return (
            <React.Fragment key={index}>
              {/* Step dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    ${dotSize} rounded-full flex items-center justify-center
                    ${isCompleted ? activeColor : inactiveColor}
                    ${isCurrent ? 'ring-2 ring-offset-2 ring-blue-300' : ''}
                    transition-all duration-200
                  `}
                  data-testid={`${testId}-step-${stepNumber}`}
                >
                  {isCompleted && size !== 'xs' && size !== 'sm' && (
                    <svg className="w-2/3 h-2/3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Step label */}
                {showLabels && (
                  <span className={`mt-1 text-xs text-gray-500 ${isCurrent ? 'font-medium' : ''}`}>
                    {labels[index] || `Step ${stepNumber}`}
                  </span>
                )}
              </div>

              {/* Connector */}
              {index < total - 1 && (
                <div
                  className={`flex-1 mx-2 ${connectorHeight} ${isCompleted ? activeColor : inactiveColor} transition-all duration-200`}
                  data-testid={`${testId}-connector-${stepNumber}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

StepProgress.displayName = 'StepProgress';

// ============================================================================
// TEST EXECUTION PROGRESS
// ============================================================================

/**
 * TestProgress - Progress for test execution
 */
export const TestProgress: React.FC<TestProgressProps> = memo(({
  totalSteps,
  passedSteps,
  failedSteps,
  currentStep,
  isRunning = false,
  showDetails = true,
  className = '',
  testId = 'test-progress',
}) => {
  const completedSteps = passedSteps + failedSteps;
  const percentage = useMemo(
    () => calculatePercentage(completedSteps, totalSteps),
    [completedSteps, totalSteps]
  );

  const passPercentage = useMemo(
    () => completedSteps > 0 ? calculatePercentage(passedSteps, completedSteps) : 0,
    [passedSteps, completedSteps]
  );

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      {/* Main progress bar */}
      <div className="mb-2">
        <ProgressBar
          value={completedSteps}
          max={totalSteps}
          size="md"
          color={failedSteps > 0 ? 'yellow' : 'blue'}
          showLabel
          showValue
          label={isRunning ? `Running step ${currentStep} of ${totalSteps}` : 'Test Progress'}
          animated={isRunning}
          testId={`${testId}-main`}
        />
      </div>

      {/* Details section */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-4 mt-4" data-testid={`${testId}-details`}>
          {/* Passed */}
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600" data-testid={`${testId}-passed`}>
              {passedSteps}
            </div>
            <div className="text-xs text-green-700">Passed</div>
          </div>

          {/* Failed */}
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600" data-testid={`${testId}-failed`}>
              {failedSteps}
            </div>
            <div className="text-xs text-red-700">Failed</div>
          </div>

          {/* Remaining */}
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600" data-testid={`${testId}-remaining`}>
              {totalSteps - completedSteps}
            </div>
            <div className="text-xs text-gray-700">Remaining</div>
          </div>
        </div>
      )}

      {/* Pass rate bar */}
      {completedSteps > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span>Pass Rate</span>
            <span>{formatPercentage(passPercentage)}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${passPercentage}%` }}
              data-testid={`${testId}-pass-bar`}
            />
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${100 - passPercentage}%` }}
              data-testid={`${testId}-fail-bar`}
            />
          </div>
        </div>
      )}
    </div>
  );
});

TestProgress.displayName = 'TestProgress';

// ============================================================================
// EXPORTS
// ============================================================================

export default ProgressBar;
