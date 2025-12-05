/**
 * Badge - Status indicator component
 * @module components/Ui/Badge
 * @version 1.0.0
 * 
 * Provides badge/label components for status indicators:
 * - Multiple variants (colors)
 * - Multiple sizes
 * - Optional icons
 * - Preset badges for common statuses
 * 
 * @example
 * ```tsx
 * <Badge variant="success">Passed</Badge>
 * <Badge variant="error" icon={<XIcon />}>Failed</Badge>
 * <StatusBadge status="running" />
 * <EventBadge event="click" />
 * ```
 */

import React, { forwardRef, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Badge variant
 */
export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'outline';

/**
 * Badge size
 */
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Project status
 */
export type ProjectStatus = 'draft' | 'testing' | 'complete';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Event type
 */
export type EventType = 'click' | 'input' | 'enter' | 'open' | 'navigate' | 'wait';

/**
 * Badge props
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size */
  size?: BadgeSize;
  /** Icon to show before text */
  icon?: React.ReactNode;
  /** Icon to show after text */
  iconAfter?: React.ReactNode;
  /** Rounded pill style */
  pill?: boolean;
  /** Dot indicator (no text) */
  dot?: boolean;
  /** Pulsing animation (for running/loading) */
  pulse?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Status badge props
 */
export interface StatusBadgeProps {
  /** Status value */
  status: StepStatus;
  /** Show icon */
  showIcon?: boolean;
  /** Size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Project status badge props
 */
export interface ProjectStatusBadgeProps {
  /** Project status */
  status: ProjectStatus;
  /** Size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Event badge props
 */
export interface EventBadgeProps {
  /** Event type */
  event: EventType;
  /** Size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Count badge props
 */
export interface CountBadgeProps {
  /** Count value */
  count: number;
  /** Maximum before showing + */
  max?: number;
  /** Variant */
  variant?: BadgeVariant;
  /** Size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const CircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
  </svg>
);

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

const SkipIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ClickIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
  </svg>
);

const InputIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const EnterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const OpenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const NavigateIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const WaitIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Variant styles
 */
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  primary: 'bg-blue-100 text-blue-800 border-blue-200',
  secondary: 'bg-gray-100 text-gray-600 border-gray-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  outline: 'bg-transparent text-gray-700 border-gray-300',
};

/**
 * Size styles
 */
const SIZE_STYLES: Record<BadgeSize, { badge: string; icon: string; dot: string }> = {
  xs: { badge: 'px-1.5 py-0.5 text-xs', icon: 'w-3 h-3', dot: 'w-1.5 h-1.5' },
  sm: { badge: 'px-2 py-0.5 text-xs', icon: 'w-3.5 h-3.5', dot: 'w-2 h-2' },
  md: { badge: 'px-2.5 py-1 text-sm', icon: 'w-4 h-4', dot: 'w-2.5 h-2.5' },
  lg: { badge: 'px-3 py-1.5 text-sm', icon: 'w-5 h-5', dot: 'w-3 h-3' },
};

/**
 * Step status configuration
 */
const STEP_STATUS_CONFIG: Record<StepStatus, { variant: BadgeVariant; label: string; icon: React.ReactNode }> = {
  pending: {
    variant: 'secondary',
    label: 'Pending',
    icon: <CircleIcon className="w-3.5 h-3.5" />,
  },
  running: {
    variant: 'info',
    label: 'Running',
    icon: <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />,
  },
  passed: {
    variant: 'success',
    label: 'Passed',
    icon: <CheckIcon className="w-3.5 h-3.5" />,
  },
  failed: {
    variant: 'error',
    label: 'Failed',
    icon: <XIcon className="w-3.5 h-3.5" />,
  },
  skipped: {
    variant: 'warning',
    label: 'Skipped',
    icon: <SkipIcon className="w-3.5 h-3.5" />,
  },
};

/**
 * Project status configuration
 */
const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { variant: BadgeVariant; label: string }> = {
  draft: {
    variant: 'secondary',
    label: 'Draft',
  },
  testing: {
    variant: 'warning',
    label: 'Testing',
  },
  complete: {
    variant: 'success',
    label: 'Complete',
  },
};

/**
 * Event type configuration
 */
const EVENT_TYPE_CONFIG: Record<EventType, { variant: BadgeVariant; label: string; icon: React.ReactNode }> = {
  click: {
    variant: 'primary',
    label: 'Click',
    icon: <ClickIcon className="w-3.5 h-3.5" />,
  },
  input: {
    variant: 'info',
    label: 'Input',
    icon: <InputIcon className="w-3.5 h-3.5" />,
  },
  enter: {
    variant: 'success',
    label: 'Enter',
    icon: <EnterIcon className="w-3.5 h-3.5" />,
  },
  open: {
    variant: 'warning',
    label: 'Open',
    icon: <OpenIcon className="w-3.5 h-3.5" />,
  },
  navigate: {
    variant: 'secondary',
    label: 'Navigate',
    icon: <NavigateIcon className="w-3.5 h-3.5" />,
  },
  wait: {
    variant: 'default',
    label: 'Wait',
    icon: <WaitIcon className="w-3.5 h-3.5" />,
  },
};

// ============================================================================
// MAIN BADGE COMPONENT
// ============================================================================

/**
 * Base badge component
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({
  variant = 'default',
  size = 'sm',
  icon,
  iconAfter,
  pill = false,
  dot = false,
  pulse = false,
  className = '',
  children,
  testId = 'badge',
  ...props
}, ref) => {
  const variantStyles = VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  return (
    <span
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-1
        font-medium border
        ${variantStyles}
        ${sizeStyles.badge}
        ${pill ? 'rounded-full' : 'rounded-md'}
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {dot && (
        <span
          className={`${sizeStyles.dot} rounded-full bg-current`}
          data-testid={`${testId}-dot`}
        />
      )}
      {icon && !dot && (
        <span className={sizeStyles.icon} data-testid={`${testId}-icon`}>
          {icon}
        </span>
      )}
      {!dot && children}
      {iconAfter && !dot && (
        <span className={sizeStyles.icon} data-testid={`${testId}-icon-after`}>
          {iconAfter}
        </span>
      )}
    </span>
  );
});

Badge.displayName = 'Badge';

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

/**
 * Step status badge
 */
export const StatusBadge = memo<StatusBadgeProps>(({
  status,
  showIcon = true,
  size = 'sm',
  className = '',
  testId = 'status-badge',
}) => {
  const config = STEP_STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      icon={showIcon ? config.icon : undefined}
      pulse={status === 'running'}
      className={className}
      testId={testId}
    >
      {config.label}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

// ============================================================================
// PROJECT STATUS BADGE COMPONENT
// ============================================================================

/**
 * Project status badge
 */
export const ProjectStatusBadge = memo<ProjectStatusBadgeProps>(({
  status,
  size = 'sm',
  className = '',
  testId = 'project-status-badge',
}) => {
  const config = PROJECT_STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      className={className}
      testId={testId}
    >
      {config.label}
    </Badge>
  );
});

ProjectStatusBadge.displayName = 'ProjectStatusBadge';

// ============================================================================
// EVENT BADGE COMPONENT
// ============================================================================

/**
 * Event type badge
 */
export const EventBadge = memo<EventBadgeProps>(({
  event,
  size = 'sm',
  className = '',
  testId = 'event-badge',
}) => {
  const config = EVENT_TYPE_CONFIG[event];

  return (
    <Badge
      variant={config.variant}
      size={size}
      icon={config.icon}
      pill
      className={className}
      testId={testId}
    >
      {config.label}
    </Badge>
  );
});

EventBadge.displayName = 'EventBadge';

// ============================================================================
// COUNT BADGE COMPONENT
// ============================================================================

/**
 * Count/number badge
 */
export const CountBadge = memo<CountBadgeProps>(({
  count,
  max = 99,
  variant = 'primary',
  size = 'xs',
  className = '',
  testId = 'count-badge',
}) => {
  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <Badge
      variant={variant}
      size={size}
      pill
      className={`min-w-[20px] ${className}`}
      testId={testId}
    >
      {displayCount}
    </Badge>
  );
});

CountBadge.displayName = 'CountBadge';

// ============================================================================
// BADGE GROUP COMPONENT
// ============================================================================

/**
 * Badge group props
 */
export interface BadgeGroupProps {
  /** Badges to display */
  children: React.ReactNode;
  /** Gap between badges */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Badge group container
 */
export const BadgeGroup = memo<BadgeGroupProps>(({
  children,
  gap = 'sm',
  className = '',
  testId = 'badge-group',
}) => {
  const gapStyles = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3',
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center ${gapStyles[gap]} ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
});

BadgeGroup.displayName = 'BadgeGroup';

// ============================================================================
// REMOVABLE BADGE COMPONENT
// ============================================================================

/**
 * Removable badge props
 */
export interface RemovableBadgeProps extends Omit<BadgeProps, 'iconAfter'> {
  /** Remove handler */
  onRemove: () => void;
  /** Remove button aria-label */
  removeLabel?: string;
}

/**
 * Badge with remove button
 */
export const RemovableBadge = forwardRef<HTMLSpanElement, RemovableBadgeProps>(({
  onRemove,
  removeLabel = 'Remove',
  children,
  testId = 'removable-badge',
  ...props
}, ref) => {
  return (
    <Badge
      ref={ref}
      iconAfter={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current"
          aria-label={removeLabel}
          data-testid={`${testId}-remove`}
        >
          <XIcon className="w-3 h-3" />
        </button>
      }
      testId={testId}
      {...props}
    >
      {children}
    </Badge>
  );
});

RemovableBadge.displayName = 'RemovableBadge';

// ============================================================================
// DURATION BADGE COMPONENT
// ============================================================================

/**
 * Duration badge props
 */
export interface DurationBadgeProps {
  /** Duration in milliseconds */
  duration: number;
  /** Variant based on duration */
  autoVariant?: boolean;
  /** Slow threshold (ms) */
  slowThreshold?: number;
  /** Size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Duration display badge
 */
export const DurationBadge = memo<DurationBadgeProps>(({
  duration,
  autoVariant = true,
  slowThreshold = 2000,
  size = 'xs',
  className = '',
  testId = 'duration-badge',
}) => {
  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Determine variant based on duration
  const getVariant = (): BadgeVariant => {
    if (!autoVariant) return 'secondary';
    if (duration > slowThreshold) return 'warning';
    return 'secondary';
  };

  return (
    <Badge
      variant={getVariant()}
      size={size}
      icon={<ClockIcon className="w-3 h-3" />}
      className={`font-mono ${className}`}
      testId={testId}
    >
      {formatDuration(duration)}
    </Badge>
  );
});

DurationBadge.displayName = 'DurationBadge';

// ============================================================================
// EXPORTS
// ============================================================================

export default Badge;
