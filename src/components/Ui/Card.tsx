/**
 * Card - Container component for grouped content
 * @module components/Ui/Card
 * @version 1.0.0
 * 
 * Provides card containers with multiple features:
 * - Compound components: Card, CardHeader, CardTitle, CardContent, CardFooter
 * - Variants: default, outlined, elevated, ghost
 * - Interactive: hoverable, clickable, selectable
 * - Status indicators: border colors, badges
 * 
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Project Name</CardTitle>
 *     <CardDescription>Project description</CardDescription>
 *   </CardHeader>
 *   <CardContent>Content here</CardContent>
 *   <CardFooter>Actions</CardFooter>
 * </Card>
 * ```
 */

import React, { forwardRef, createContext, useContext, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Card variant
 */
export type CardVariant = 'default' | 'outlined' | 'elevated' | 'ghost' | 'filled';

/**
 * Card status (for border color indicator)
 */
export type CardStatus = 'default' | 'success' | 'warning' | 'error' | 'info' | 'draft' | 'testing' | 'complete';

/**
 * Card size
 */
export type CardSize = 'sm' | 'md' | 'lg';

/**
 * Card props
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant */
  variant?: CardVariant;
  /** Size (affects padding) */
  size?: CardSize;
  /** Status indicator (left border color) */
  status?: CardStatus;
  /** Hoverable effect */
  hoverable?: boolean;
  /** Clickable (shows cursor pointer) */
  clickable?: boolean;
  /** Selected state */
  selected?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** No padding (for custom content) */
  noPadding?: boolean;
  /** As link element */
  asChild?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Card header props
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Actions slot (right side) */
  actions?: React.ReactNode;
  /** Test ID */
  testId?: string;
}

/**
 * Card title props
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading level */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** Test ID */
  testId?: string;
}

/**
 * Card description props
 */
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Truncate with ellipsis */
  truncate?: boolean;
  /** Max lines before truncation */
  maxLines?: number;
  /** Test ID */
  testId?: string;
}

/**
 * Card content props
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** No padding */
  noPadding?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Card footer props
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alignment */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Border on top */
  bordered?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Card image props
 */
export interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Aspect ratio */
  aspectRatio?: 'auto' | '16/9' | '4/3' | '1/1' | '2/1';
  /** Position */
  position?: 'top' | 'bottom';
  /** Test ID */
  testId?: string;
}

/**
 * Card badge props
 */
export interface CardBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Position */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Test ID */
  testId?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface CardContextValue {
  size: CardSize;
  variant: CardVariant;
  disabled: boolean;
}

const CardContext = createContext<CardContextValue>({
  size: 'md',
  variant: 'default',
  disabled: false,
});

const useCardContext = () => useContext(CardContext);

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Variant styles
 */
const VARIANT_STYLES: Record<CardVariant, string> = {
  default: 'bg-white border border-gray-200',
  outlined: 'bg-transparent border-2 border-gray-300',
  elevated: 'bg-white border border-gray-100 shadow-lg',
  ghost: 'bg-transparent border-none',
  filled: 'bg-gray-50 border border-gray-100',
};

/**
 * Status border styles
 */
const STATUS_STYLES: Record<CardStatus, string> = {
  default: '',
  success: 'border-l-4 border-l-green-500',
  warning: 'border-l-4 border-l-yellow-500',
  error: 'border-l-4 border-l-red-500',
  info: 'border-l-4 border-l-blue-500',
  draft: 'border-l-4 border-l-gray-400',
  testing: 'border-l-4 border-l-yellow-500',
  complete: 'border-l-4 border-l-green-500',
};

/**
 * Size padding styles
 */
const SIZE_STYLES: Record<CardSize, { card: string; header: string; content: string; footer: string }> = {
  sm: {
    card: '',
    header: 'px-3 py-2',
    content: 'px-3 py-2',
    footer: 'px-3 py-2',
  },
  md: {
    card: '',
    header: 'px-4 py-3',
    content: 'px-4 py-4',
    footer: 'px-4 py-3',
  },
  lg: {
    card: '',
    header: 'px-6 py-4',
    content: 'px-6 py-5',
    footer: 'px-6 py-4',
  },
};

/**
 * Badge variant styles
 */
const BADGE_VARIANT_STYLES: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

/**
 * Badge position styles
 */
const BADGE_POSITION_STYLES: Record<string, string> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
};

// ============================================================================
// MAIN CARD COMPONENT
// ============================================================================

/**
 * Card container component
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  size = 'md',
  status = 'default',
  hoverable = false,
  clickable = false,
  selected = false,
  disabled = false,
  fullWidth = false,
  noPadding = false,
  className = '',
  children,
  testId = 'card',
  onClick,
  ...props
}, ref) => {
  const variantStyles = VARIANT_STYLES[variant];
  const statusStyles = STATUS_STYLES[status];

  const cardClassName = [
    'rounded-lg overflow-hidden transition-all duration-200',
    variantStyles,
    statusStyles,
    fullWidth ? 'w-full' : '',
    hoverable ? 'hover:shadow-md hover:border-gray-300' : '',
    clickable || onClick ? 'cursor-pointer' : '',
    selected ? 'ring-2 ring-blue-500 ring-offset-2' : '',
    disabled ? 'opacity-50 pointer-events-none' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const contextValue: CardContextValue = {
    size,
    variant,
    disabled,
  };

  return (
    <CardContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cardClassName}
        data-testid={testId}
        data-variant={variant}
        data-status={status}
        data-selected={selected}
        data-disabled={disabled}
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled}
        {...props}
      >
        {children}
      </div>
    </CardContext.Provider>
  );
});

Card.displayName = 'Card';

// ============================================================================
// CARD HEADER COMPONENT
// ============================================================================

/**
 * Card header section
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({
  actions,
  className = '',
  children,
  testId = 'card-header',
  ...props
}, ref) => {
  const { size } = useCardContext();
  const sizeStyles = SIZE_STYLES[size];

  return (
    <div
      ref={ref}
      className={`
        flex items-start justify-between gap-4
        ${sizeStyles.header}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {actions && (
        <div className="flex-shrink-0 flex items-center gap-2" data-testid={`${testId}-actions`}>
          {actions}
        </div>
      )}
    </div>
  );
});

CardHeader.displayName = 'CardHeader';

// ============================================================================
// CARD TITLE COMPONENT
// ============================================================================

/**
 * Card title
 */
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({
  as: Component = 'h3',
  className = '',
  children,
  testId = 'card-title',
  ...props
}, ref) => (
  <Component
    ref={ref}
    className={`text-lg font-semibold text-gray-900 leading-tight ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </Component>
));

CardTitle.displayName = 'CardTitle';

// ============================================================================
// CARD DESCRIPTION COMPONENT
// ============================================================================

/**
 * Card description text
 */
export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(({
  truncate = false,
  maxLines,
  className = '',
  children,
  testId = 'card-description',
  style,
  ...props
}, ref) => {
  const truncateStyles = truncate
    ? maxLines
      ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }
      : {}
    : {};

  return (
    <p
      ref={ref}
      className={`
        text-sm text-gray-500 mt-1
        ${truncate && !maxLines ? 'truncate' : ''}
        ${className}
      `}
      style={{ ...truncateStyles, ...style }}
      data-testid={testId}
      {...props}
    >
      {children}
    </p>
  );
});

CardDescription.displayName = 'CardDescription';

// ============================================================================
// CARD CONTENT COMPONENT
// ============================================================================

/**
 * Card content area
 */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({
  noPadding = false,
  className = '',
  children,
  testId = 'card-content',
  ...props
}, ref) => {
  const { size } = useCardContext();
  const sizeStyles = SIZE_STYLES[size];

  return (
    <div
      ref={ref}
      className={`
        ${noPadding ? '' : sizeStyles.content}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </div>
  );
});

CardContent.displayName = 'CardContent';

// ============================================================================
// CARD FOOTER COMPONENT
// ============================================================================

/**
 * Card footer section
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(({
  align = 'right',
  bordered = false,
  className = '',
  children,
  testId = 'card-footer',
  ...props
}, ref) => {
  const { size } = useCardContext();
  const sizeStyles = SIZE_STYLES[size];

  const alignmentStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      ref={ref}
      className={`
        flex items-center gap-2
        ${sizeStyles.footer}
        ${alignmentStyles[align]}
        ${bordered ? 'border-t border-gray-200' : ''}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';

// ============================================================================
// CARD IMAGE COMPONENT
// ============================================================================

/**
 * Card image
 */
export const CardImage = forwardRef<HTMLImageElement, CardImageProps>(({
  aspectRatio = 'auto',
  position = 'top',
  className = '',
  alt = '',
  testId = 'card-image',
  ...props
}, ref) => {
  const aspectRatioStyles = {
    auto: '',
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '1/1': 'aspect-square',
    '2/1': 'aspect-[2/1]',
  };

  return (
    <div
      className={`
        overflow-hidden
        ${position === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'}
        ${aspectRatioStyles[aspectRatio]}
      `}
      data-testid={`${testId}-container`}
    >
      <img
        ref={ref}
        className={`w-full h-full object-cover ${className}`}
        alt={alt}
        data-testid={testId}
        {...props}
      />
    </div>
  );
});

CardImage.displayName = 'CardImage';

// ============================================================================
// CARD BADGE COMPONENT
// ============================================================================

/**
 * Card badge (positioned overlay)
 */
export const CardBadge = forwardRef<HTMLSpanElement, CardBadgeProps>(({
  variant = 'default',
  position = 'top-right',
  className = '',
  children,
  testId = 'card-badge',
  ...props
}, ref) => {
  const variantStyles = BADGE_VARIANT_STYLES[variant];
  const positionStyles = BADGE_POSITION_STYLES[position];

  return (
    <span
      ref={ref}
      className={`
        absolute ${positionStyles}
        px-2 py-0.5 rounded-full text-xs font-medium
        ${variantStyles}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </span>
  );
});

CardBadge.displayName = 'CardBadge';

// ============================================================================
// PRESET CARD COMPONENTS
// ============================================================================

/**
 * Stats card props
 */
export interface StatsCardProps {
  /** Title/label */
  title: string;
  /** Value to display */
  value: string | number;
  /** Change indicator (+5%, -3%, etc.) */
  change?: string;
  /** Change direction */
  changeType?: 'increase' | 'decrease' | 'neutral';
  /** Icon */
  icon?: React.ReactNode;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Stats card for dashboard metrics
 */
export const StatsCard = memo<StatsCardProps>(({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  className = '',
  testId = 'stats-card',
}) => {
  const changeStyles = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <Card className={className} testId={testId}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
            {change && (
              <p className={`mt-1 text-sm ${changeStyles[changeType]}`}>
                {changeType === 'increase' && '↑ '}
                {changeType === 'decrease' && '↓ '}
                {change}
              </p>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 p-3 bg-gray-100 rounded-full text-gray-600">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

StatsCard.displayName = 'StatsCard';

/**
 * Project card props
 */
export interface ProjectCardProps {
  /** Project ID */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description?: string;
  /** Project status */
  status: 'draft' | 'testing' | 'complete';
  /** Created date */
  createdDate?: string | number | Date;
  /** Updated date */
  updatedDate?: string | number | Date;
  /** Click handler */
  onClick?: () => void;
  /** Action buttons */
  actions?: React.ReactNode;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Project card for dashboard
 */
export const ProjectCard = memo<ProjectCardProps>(({
  id,
  name,
  description,
  status,
  createdDate,
  updatedDate,
  onClick,
  actions,
  className = '',
  testId = 'project-card',
}) => {
  const statusConfig: Record<string, { label: string; color: CardStatus }> = {
    draft: { label: 'Draft', color: 'draft' },
    testing: { label: 'Testing', color: 'testing' },
    complete: { label: 'Complete', color: 'complete' },
  };

  const { label: statusLabel, color: statusColor } = statusConfig[status] || statusConfig.draft;

  // Format date
  const formatDate = (date?: string | number | Date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card
      hoverable
      clickable={!!onClick}
      status={statusColor}
      onClick={onClick}
      className={className}
      testId={testId}
      data-project-id={id}
    >
      <CardHeader
        actions={actions}
        testId={`${testId}-header`}
      >
        <div className="flex items-center gap-2">
          <CardTitle testId={`${testId}-title`}>{name}</CardTitle>
          <StatusBadge status={status}>{statusLabel}</StatusBadge>
        </div>
        {description && (
          <CardDescription truncate maxLines={2} testId={`${testId}-description`}>
            {description}
          </CardDescription>
        )}
      </CardHeader>
      
      {(createdDate || updatedDate) && (
        <CardFooter align="between" bordered testId={`${testId}-footer`}>
          {createdDate && (
            <span className="text-xs text-gray-400">
              Created {formatDate(createdDate)}
            </span>
          )}
          {updatedDate && (
            <span className="text-xs text-gray-400">
              Updated {formatDate(updatedDate)}
            </span>
          )}
        </CardFooter>
      )}
    </Card>
  );
});

ProjectCard.displayName = 'ProjectCard';

/**
 * Status card props
 */
export interface StatusCardProps {
  /** Title */
  title: string;
  /** Status value */
  status: 'idle' | 'running' | 'success' | 'error' | 'paused';
  /** Primary value */
  value?: string | number;
  /** Secondary info */
  subtitle?: string;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Status card for test execution
 */
export const StatusCard = memo<StatusCardProps>(({
  title,
  status,
  value,
  subtitle,
  className = '',
  testId = 'status-card',
}) => {
  const statusConfig: Record<string, { color: string; bgColor: string; icon: string }> = {
    idle: { color: 'text-gray-500', bgColor: 'bg-gray-100', icon: '○' },
    running: { color: 'text-blue-500', bgColor: 'bg-blue-100', icon: '◉' },
    success: { color: 'text-green-500', bgColor: 'bg-green-100', icon: '✓' },
    error: { color: 'text-red-500', bgColor: 'bg-red-100', icon: '✗' },
    paused: { color: 'text-yellow-500', bgColor: 'bg-yellow-100', icon: '❚❚' },
  };

  const { color, bgColor, icon } = statusConfig[status] || statusConfig.idle;

  return (
    <Card className={className} testId={testId}>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${bgColor} rounded-full flex items-center justify-center ${color}`}>
            <span className="text-lg">{icon}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {value !== undefined && (
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
            )}
            {subtitle && (
              <p className="text-xs text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StatusCard.displayName = 'StatusCard';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Status badge (inline)
 */
interface StatusBadgeProps {
  status: 'draft' | 'testing' | 'complete' | 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children }) => {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    testing: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.draft}`}
    >
      {children}
    </span>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default Card;
