/**
 * Progress - Progress bar component
 * @module components/Ui/Progress
 * @version 1.0.0
 * 
 * Provides progress indicators with multiple features:
 * - Linear progress bar
 * - Circular progress
 * - Segmented progress
 * - Step progress
 * - Multiple color variants
 * 
 * @example
 * ```tsx
 * <Progress value={75} />
 * <Progress value={50} variant="success" showValue />
 * <StepProgress current={3} total={10} />
 * ```
 */

import React, { forwardRef, memo, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Progress variant (color)
 */
export type ProgressVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

/**
 * Progress size
 */
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Progress props
 */
export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Size */
  size?: ProgressSize;
  /** Show value label */
  showValue?: boolean;
  /** Value format function */
  formatValue?: (value: number, max: number) => string;
  /** Indeterminate mode (animated, no value) */
  indeterminate?: boolean;
  /** Striped animation */
  striped?: boolean;
  /** Animated stripes */
  animated?: boolean;
  /** Label text */
  label?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Circular progress props
 */
export interface CircularProgressProps {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Diameter in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Show value in center */
  showValue?: boolean;
  /** Value format function */
  formatValue?: (value: number, max: number) => string;
  /** Indeterminate mode */
  indeterminate?: boolean;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Step progress props
 */
export interface StepProgressProps {
  /** Current step (1-based) */
  current: number;
  /** Total steps */
  total: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Size */
  size?: ProgressSize;
  /** Show step count label */
  showSteps?: boolean;
  /** Label format */
  formatLabel?: (current: number, total: number) => string;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Segmented progress props
 */
export interface SegmentedProgressProps {
  /** Segment values (passed, failed, etc.) */
  segments: Array<{
    value: number;
    variant: ProgressVariant;
    label?: string;
  }>;
  /** Total value */
  total: number;
  /** Size */
  size?: ProgressSize;
  /** Show legend */
  showLegend?: boolean;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Test execution progress props
 */
export interface TestProgressProps {
  /** Passed step count */
  passed: number;
  /** Failed step count */
  failed: number;
  /** Total step count */
  total: number;
  /** Current step index */
  currentStep?: number;
  /** Elapsed time in ms */
  elapsedTime?: number;
  /** Show details */
  showDetails?: boolean;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Variant colors
 */
const VARIANT_COLORS: Record<ProgressVariant, { bg: string; fill: string }> = {
  default: { bg: 'bg-gray-200', fill: 'bg-gray-600' },
  primary: { bg: 'bg-blue-100', fill: 'bg-blue-600' },
  success: { bg: 'bg-green-100', fill: 'bg-green-600' },
  warning: { bg: 'bg-yellow-100', fill: 'bg-yellow-500' },
  error: { bg: 'bg-red-100', fill: 'bg-red-600' },
  info: { bg: 'bg-cyan-100', fill: 'bg-cyan-600' },
};

/**
 * Size heights
 */
const SIZE_HEIGHTS: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

/**
 * Circular stroke colors (SVG)
 */
const CIRCULAR_COLORS: Record<ProgressVariant, string> = {
  default: '#4B5563', // gray-600
  primary: '#2563EB', // blue-600
  success: '#16A34A', // green-600
  warning: '#EAB308', // yellow-500
  error: '#DC2626', // red-600
  info: '#0891B2', // cyan-600
};

// ============================================================================
// MAIN PROGRESS COMPONENT
// ============================================================================

/**
 * Linear progress bar
 */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showValue = false,
  formatValue,
  indeterminate = false,
  striped = false,
  animated = false,
  label,
  className = '',
  testId = 'progress',
  ...props
}, ref) => {
  // Clamp value between 0 and max
  const clampedValue = Math.min(Math.max(0, value), max);
  const percentage = (clampedValue / max) * 100;

  const colors = VARIANT_COLORS[variant];
  const height = SIZE_HEIGHTS[size];

  // Format value for display
  const displayValue = formatValue
    ? formatValue(clampedValue, max)
    : `${Math.round(percentage)}%`;

  return (
    <div
      ref={ref}
      className={`w-full ${className}`}
      data-testid={testId}
      {...props}
    >
      {/* Label and value */}
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-sm font-medium text-gray-700" data-testid={`${testId}-label`}>
              {label}
            </span>
          )}
          {showValue && !indeterminate && (
            <span className="text-sm font-medium text-gray-600" data-testid={`${testId}-value`}>
              {displayValue}
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className={`
          w-full ${height} ${colors.bg} rounded-full overflow-hidden
        `}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
        data-testid={`${testId}-bar`}
      >
        <div
          className={`
            ${height} ${colors.fill} rounded-full
            transition-all duration-300 ease-out
            ${striped ? 'bg-stripes' : ''}
            ${animated ? 'animate-stripes' : ''}
            ${indeterminate ? 'animate-indeterminate w-1/3' : ''}
          `}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
          data-testid={`${testId}-fill`}
        />
      </div>
    </div>
  );
});

Progress.displayName = 'Progress';

// ============================================================================
// CIRCULAR PROGRESS COMPONENT
// ============================================================================

/**
 * Circular progress indicator
 */
export const CircularProgress = memo<CircularProgressProps>(({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  variant = 'primary',
  showValue = false,
  formatValue,
  indeterminate = false,
  className = '',
  testId = 'circular-progress',
}) => {
  const clampedValue = Math.min(Math.max(0, value), max);
  const percentage = (clampedValue / max) * 100;

  // SVG calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color = CIRCULAR_COLORS[variant];

  const displayValue = formatValue
    ? formatValue(clampedValue, max)
    : `${Math.round(percentage)}%`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedValue}
      aria-valuemin={0}
      aria-valuemax={max}
      data-testid={testId}
    >
      <svg
        className={`transform -rotate-90 ${indeterminate ? 'animate-spin' : ''}`}
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={indeterminate ? circumference * 0.75 : strokeDashoffset}
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Center value */}
      {showValue && !indeterminate && (
        <span
          className="absolute text-sm font-semibold text-gray-700"
          data-testid={`${testId}-value`}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
});

CircularProgress.displayName = 'CircularProgress';

// ============================================================================
// STEP PROGRESS COMPONENT
// ============================================================================

/**
 * Step-based progress indicator
 */
export const StepProgress = memo<StepProgressProps>(({
  current,
  total,
  variant = 'primary',
  size = 'md',
  showSteps = true,
  formatLabel,
  className = '',
  testId = 'step-progress',
}) => {
  // Clamp current to valid range
  const clampedCurrent = Math.min(Math.max(0, current), total);
  const percentage = total > 0 ? (clampedCurrent / total) * 100 : 0;

  const label = formatLabel
    ? formatLabel(clampedCurrent, total)
    : `Step ${clampedCurrent} of ${total}`;

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      {showSteps && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700" data-testid={`${testId}-label`}>
            {label}
          </span>
          <span className="text-sm text-gray-500" data-testid={`${testId}-percentage`}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <Progress
        value={percentage}
        variant={variant}
        size={size}
        testId={`${testId}-bar`}
      />
    </div>
  );
});

StepProgress.displayName = 'StepProgress';

// ============================================================================
// SEGMENTED PROGRESS COMPONENT
// ============================================================================

/**
 * Multi-segment progress bar
 */
export const SegmentedProgress = memo<SegmentedProgressProps>(({
  segments,
  total,
  size = 'md',
  showLegend = false,
  className = '',
  testId = 'segmented-progress',
}) => {
  const height = SIZE_HEIGHTS[size];

  // Calculate percentages
  const segmentPercentages = useMemo(() => {
    return segments.map((segment) => ({
      ...segment,
      percentage: total > 0 ? (segment.value / total) * 100 : 0,
    }));
  }, [segments, total]);

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      {/* Progress bar */}
      <div
        className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden flex`}
        role="progressbar"
        data-testid={`${testId}-bar`}
      >
        {segmentPercentages.map((segment, index) => {
          const colors = VARIANT_COLORS[segment.variant];
          return (
            <div
              key={index}
              className={`${height} ${colors.fill} transition-all duration-300`}
              style={{ width: `${segment.percentage}%` }}
              data-testid={`${testId}-segment-${index}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-4 mt-2" data-testid={`${testId}-legend`}>
          {segmentPercentages.map((segment, index) => {
            const colors = VARIANT_COLORS[segment.variant];
            return (
              <div key={index} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${colors.fill}`} />
                <span className="text-xs text-gray-600">
                  {segment.label || segment.variant}: {segment.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

SegmentedProgress.displayName = 'SegmentedProgress';

// ============================================================================
// TEST EXECUTION PROGRESS COMPONENT
// ============================================================================

/**
 * Test execution progress with passed/failed breakdown
 */
export const TestProgress = memo<TestProgressProps>(({
  passed,
  failed,
  total,
  currentStep,
  elapsedTime,
  showDetails = true,
  className = '',
  testId = 'test-progress',
}) => {
  const completed = passed + failed;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const remaining = total - completed;

  // Format elapsed time
  const formatTime = (ms?: number) => {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate estimated time remaining
  const estimatedRemaining = useMemo(() => {
    if (!elapsedTime || completed === 0) return null;
    const avgTimePerStep = elapsedTime / completed;
    return remaining * avgTimePerStep;
  }, [elapsedTime, completed, remaining]);

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Progress: {completed}/{total} steps
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Segmented progress bar */}
      <SegmentedProgress
        segments={[
          { value: passed, variant: 'success', label: 'Passed' },
          { value: failed, variant: 'error', label: 'Failed' },
        ]}
        total={total}
        size="md"
        testId={`${testId}-segments`}
      />

      {/* Details */}
      {showDetails && (
        <div className="flex items-center justify-between mt-3 text-sm">
          {/* Pass/fail counts */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4 text-green-600" />
              <span className="text-green-700 font-medium" data-testid={`${testId}-passed`}>
                {passed} passed
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <XIcon className="w-4 h-4 text-red-600" />
              <span className="text-red-700 font-medium" data-testid={`${testId}-failed`}>
                {failed} failed
              </span>
            </div>
          </div>

          {/* Time info */}
          <div className="flex items-center gap-4 text-gray-500">
            {elapsedTime !== undefined && (
              <span data-testid={`${testId}-elapsed`}>
                Elapsed: {formatTime(elapsedTime)}
              </span>
            )}
            {estimatedRemaining !== null && remaining > 0 && (
              <span data-testid={`${testId}-remaining`}>
                ~{formatTime(estimatedRemaining)} remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Current step indicator */}
      {currentStep !== undefined && currentStep < total && (
        <div className="mt-2 text-sm text-gray-500" data-testid={`${testId}-current`}>
          Running step {currentStep + 1}...
        </div>
      )}
    </div>
  );
});

TestProgress.displayName = 'TestProgress';

// ============================================================================
// MAPPING PROGRESS COMPONENT
// ============================================================================

/**
 * Field mapping progress props
 */
export interface MappingProgressProps {
  /** Mapped field count */
  mapped: number;
  /** Total field count */
  total: number;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Field mapping progress indicator
 */
export const MappingProgress = memo<MappingProgressProps>(({
  mapped,
  total,
  className = '',
  testId = 'mapping-progress',
}) => {
  const percentage = total > 0 ? (mapped / total) * 100 : 0;
  const isComplete = mapped === total && total > 0;

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">
          Fields Mapped
        </span>
        <span className={`text-sm font-semibold ${isComplete ? 'text-green-600' : 'text-gray-600'}`}>
          {mapped}/{total}
        </span>
      </div>
      <Progress
        value={percentage}
        variant={isComplete ? 'success' : 'primary'}
        size="sm"
        testId={`${testId}-bar`}
      />
    </div>
  );
});

MappingProgress.displayName = 'MappingProgress';

// ============================================================================
// LOADING SPINNER COMPONENT
// ============================================================================

/**
 * Loading spinner props
 */
export interface SpinnerProps {
  /** Size in pixels */
  size?: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Loading spinner
 */
export const Spinner = memo<SpinnerProps>(({
  size = 24,
  variant = 'primary',
  className = '',
  testId = 'spinner',
}) => {
  const color = CIRCULAR_COLORS[variant];

  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      data-testid={testId}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="#E5E7EB"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
});

Spinner.displayName = 'Spinner';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ============================================================================
// CSS ANIMATIONS (add to Tailwind config)
// ============================================================================

/**
 * Add to tailwind.config.js:
 * 
 * module.exports = {
 *   theme: {
 *     extend: {
 *       keyframes: {
 *         indeterminate: {
 *           '0%': { transform: 'translateX(-100%)' },
 *           '100%': { transform: 'translateX(400%)' },
 *         },
 *         stripes: {
 *           '0%': { backgroundPosition: '1rem 0' },
 *           '100%': { backgroundPosition: '0 0' },
 *         },
 *       },
 *       animation: {
 *         indeterminate: 'indeterminate 1.5s ease-in-out infinite',
 *         stripes: 'stripes 1s linear infinite',
 *       },
 *     },
 *   },
 *   plugins: [
 *     function({ addUtilities }) {
 *       addUtilities({
 *         '.bg-stripes': {
 *           backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)',
 *           backgroundSize: '1rem 1rem',
 *         },
 *       });
 *     },
 *   ],
 * };
 */

// ============================================================================
// EXPORTS
// ============================================================================

export default Progress;
