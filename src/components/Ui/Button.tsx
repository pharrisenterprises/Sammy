/**
 * Button - Interactive button component
 * @module components/Ui/Button
 * @version 1.0.0
 * 
 * Provides buttons with multiple features:
 * - Variants: default, secondary, outline, ghost, destructive, link
 * - Sizes: xs, sm, md, lg, xl
 * - States: loading, disabled
 * - Icons: left, right, icon-only
 * 
 * @example
 * ```tsx
 * <Button variant="default" onClick={handleSave}>Save</Button>
 * <Button variant="destructive" leftIcon={<TrashIcon />}>Delete</Button>
 * <Button loading>Processing...</Button>
 * ```
 */

import React, { forwardRef, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Button variant
 */
export type ButtonVariant = 
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'link';

/**
 * Button size
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Button props
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size */
  size?: ButtonSize;
  /** Loading state */
  loading?: boolean;
  /** Loading text (shown when loading) */
  loadingText?: string;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Icon only (circular button) */
  iconOnly?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Rounded style */
  rounded?: boolean;
  /** As child (for composition) */
  asChild?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Icon button props
 */
export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'iconOnly' | 'children'> {
  /** Icon element */
  icon: React.ReactNode;
  /** Accessible label */
  'aria-label': string;
}

/**
 * Button group props
 */
export interface ButtonGroupProps {
  /** Children buttons */
  children: React.ReactNode;
  /** Attached style (no gap, connected borders) */
  attached?: boolean;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Size for all buttons */
  size?: ButtonSize;
  /** Variant for all buttons */
  variant?: ButtonVariant;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Size configurations
 */
const SIZE_STYLES: Record<ButtonSize, { button: string; icon: string; iconButton: string }> = {
  xs: {
    button: 'h-7 px-2.5 text-xs gap-1',
    icon: 'w-3 h-3',
    iconButton: 'h-7 w-7',
  },
  sm: {
    button: 'h-8 px-3 text-sm gap-1.5',
    icon: 'w-4 h-4',
    iconButton: 'h-8 w-8',
  },
  md: {
    button: 'h-10 px-4 text-sm gap-2',
    icon: 'w-4 h-4',
    iconButton: 'h-10 w-10',
  },
  lg: {
    button: 'h-11 px-6 text-base gap-2',
    icon: 'w-5 h-5',
    iconButton: 'h-11 w-11',
  },
  xl: {
    button: 'h-12 px-8 text-lg gap-2.5',
    icon: 'w-5 h-5',
    iconButton: 'h-12 w-12',
  },
};

/**
 * Variant styles
 */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  default: `
    bg-blue-600 text-white 
    hover:bg-blue-700 
    focus-visible:ring-blue-500
    active:bg-blue-800
  `,
  secondary: `
    bg-gray-100 text-gray-900 
    hover:bg-gray-200 
    focus-visible:ring-gray-500
    active:bg-gray-300
  `,
  outline: `
    bg-transparent text-gray-700 
    border border-gray-300
    hover:bg-gray-50 hover:border-gray-400
    focus-visible:ring-gray-500
    active:bg-gray-100
  `,
  ghost: `
    bg-transparent text-gray-700 
    hover:bg-gray-100 
    focus-visible:ring-gray-500
    active:bg-gray-200
  `,
  destructive: `
    bg-red-600 text-white 
    hover:bg-red-700 
    focus-visible:ring-red-500
    active:bg-red-800
  `,
  success: `
    bg-green-600 text-white 
    hover:bg-green-700 
    focus-visible:ring-green-500
    active:bg-green-800
  `,
  warning: `
    bg-yellow-500 text-white 
    hover:bg-yellow-600 
    focus-visible:ring-yellow-500
    active:bg-yellow-700
  `,
  link: `
    bg-transparent text-blue-600 
    hover:text-blue-700 hover:underline
    focus-visible:ring-blue-500
    p-0 h-auto
  `,
};

/**
 * Base button styles
 */
const BASE_STYLES = `
  inline-flex items-center justify-center
  font-medium rounded-md
  transition-colors duration-150
  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
`;

// ============================================================================
// LOADING SPINNER COMPONENT
// ============================================================================

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className = '' }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
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

// ============================================================================
// MAIN BUTTON COMPONENT
// ============================================================================

/**
 * Button component
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'default',
  size = 'md',
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  iconOnly = false,
  fullWidth = false,
  rounded = false,
  disabled,
  className = '',
  children,
  testId = 'button',
  type = 'button',
  ...props
}, ref) => {
  // Get styles
  const sizeStyles = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];

  // Determine if button is effectively disabled
  const isDisabled = disabled || loading;

  // Build class name
  const buttonClassName = [
    BASE_STYLES,
    variantStyles,
    iconOnly ? sizeStyles.iconButton : sizeStyles.button,
    fullWidth ? 'w-full' : '',
    rounded ? 'rounded-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={buttonClassName}
      data-testid={testId}
      data-loading={loading}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...props}
    >
      {/* Loading spinner (replaces left icon when loading) */}
      {loading ? (
        <Spinner className={sizeStyles.icon} />
      ) : leftIcon ? (
        <span className={`${sizeStyles.icon} flex-shrink-0`} aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      {/* Button text */}
      {!iconOnly && (
        <span className={loading && loadingText ? '' : loading ? 'opacity-0' : ''}>
          {loading && loadingText ? loadingText : children}
        </span>
      )}

      {/* Right icon */}
      {!loading && rightIcon && (
        <span className={`${sizeStyles.icon} flex-shrink-0`} aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

// ============================================================================
// ICON BUTTON COMPONENT
// ============================================================================

/**
 * Icon-only button
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  icon,
  variant = 'ghost',
  size = 'md',
  rounded = true,
  testId = 'icon-button',
  'aria-label': ariaLabel,
  ...props
}, ref) => {
  const sizeStyles = SIZE_STYLES[size];

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      iconOnly
      rounded={rounded}
      testId={testId}
      aria-label={ariaLabel}
      {...props}
    >
      <span className={sizeStyles.icon}>{icon}</span>
    </Button>
  );
});

IconButton.displayName = 'IconButton';

// ============================================================================
// BUTTON GROUP COMPONENT
// ============================================================================

/**
 * Button group for related actions
 */
export const ButtonGroup = memo<ButtonGroupProps>(({
  children,
  attached = false,
  orientation = 'horizontal',
  size,
  variant,
  className = '',
  testId = 'button-group',
}) => {
  // Clone children to pass size/variant if specified
  const enhancedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) return child;

    const childProps: Partial<ButtonProps> = {};
    if (size) childProps.size = size;
    if (variant) childProps.variant = variant;

    // Add attached styling
    if (attached) {
      const isFirst = index === 0;
      const isLast = index === React.Children.count(children) - 1;
      const isHorizontal = orientation === 'horizontal';

      let roundedClass = '';
      if (isHorizontal) {
        if (isFirst) roundedClass = 'rounded-r-none';
        else if (isLast) roundedClass = 'rounded-l-none border-l-0';
        else roundedClass = 'rounded-none border-l-0';
      } else {
        if (isFirst) roundedClass = 'rounded-b-none';
        else if (isLast) roundedClass = 'rounded-t-none border-t-0';
        else roundedClass = 'rounded-none border-t-0';
      }

      childProps.className = `${child.props.className || ''} ${roundedClass}`.trim();
    }

    return React.cloneElement(child, childProps);
  });

  return (
    <div
      className={`
        inline-flex
        ${orientation === 'vertical' ? 'flex-col' : 'flex-row'}
        ${attached ? '' : orientation === 'vertical' ? 'gap-1' : 'gap-2'}
        ${className}
      `}
      role="group"
      data-testid={testId}
    >
      {enhancedChildren}
    </div>
  );
});

ButtonGroup.displayName = 'ButtonGroup';

// ============================================================================
// PRESET BUTTON COMPONENTS
// ============================================================================

/**
 * Primary action button
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="default" {...props} />
);
PrimaryButton.displayName = 'PrimaryButton';

/**
 * Secondary action button
 */
export const SecondaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="secondary" {...props} />
);
SecondaryButton.displayName = 'SecondaryButton';

/**
 * Outline button
 */
export const OutlineButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="outline" {...props} />
);
OutlineButton.displayName = 'OutlineButton';

/**
 * Ghost button
 */
export const GhostButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="ghost" {...props} />
);
GhostButton.displayName = 'GhostButton';

/**
 * Destructive/danger button
 */
export const DestructiveButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="destructive" {...props} />
);
DestructiveButton.displayName = 'DestructiveButton';

/**
 * Success button
 */
export const SuccessButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="success" {...props} />
);
SuccessButton.displayName = 'SuccessButton';

/**
 * Link-styled button
 */
export const LinkButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="link" {...props} />
);
LinkButton.displayName = 'LinkButton';

// ============================================================================
// SPECIALIZED BUTTON COMPONENTS
// ============================================================================

/**
 * Close button (X icon)
 */
export interface CloseButtonProps extends Omit<IconButtonProps, 'icon' | 'aria-label'> {
  'aria-label'?: string;
}

export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(({
  'aria-label': ariaLabel = 'Close',
  size = 'sm',
  testId = 'close-button',
  ...props
}, ref) => (
  <IconButton
    ref={ref}
    icon={<CloseIcon />}
    aria-label={ariaLabel}
    size={size}
    testId={testId}
    {...props}
  />
));
CloseButton.displayName = 'CloseButton';

/**
 * Back button with arrow
 */
export interface BackButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  /** Button text */
  label?: string;
}

export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(({
  label = 'Back',
  variant = 'ghost',
  size = 'sm',
  testId = 'back-button',
  ...props
}, ref) => (
  <Button
    ref={ref}
    variant={variant}
    size={size}
    leftIcon={<ArrowLeftIcon />}
    testId={testId}
    {...props}
  >
    {label}
  </Button>
));
BackButton.displayName = 'BackButton';

/**
 * Add/Create button with plus icon
 */
export interface AddButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  /** Button text */
  label?: string;
}

export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(({
  label = 'Add',
  variant = 'default',
  testId = 'add-button',
  ...props
}, ref) => (
  <Button
    ref={ref}
    variant={variant}
    leftIcon={<PlusIcon />}
    testId={testId}
    {...props}
  >
    {label}
  </Button>
));
AddButton.displayName = 'AddButton';

/**
 * Save button
 */
export interface SaveButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  /** Show icon */
  showIcon?: boolean;
}

export const SaveButton = forwardRef<HTMLButtonElement, SaveButtonProps>(({
  showIcon = true,
  children = 'Save',
  variant = 'default',
  testId = 'save-button',
  ...props
}, ref) => (
  <Button
    ref={ref}
    variant={variant}
    leftIcon={showIcon ? <SaveIcon /> : undefined}
    testId={testId}
    {...props}
  >
    {children}
  </Button>
));
SaveButton.displayName = 'SaveButton';

/**
 * Delete button
 */
export interface DeleteButtonProps extends Omit<ButtonProps, 'leftIcon' | 'variant'> {
  /** Show icon */
  showIcon?: boolean;
}

export const DeleteButton = forwardRef<HTMLButtonElement, DeleteButtonProps>(({
  showIcon = true,
  children = 'Delete',
  testId = 'delete-button',
  ...props
}, ref) => (
  <Button
    ref={ref}
    variant="destructive"
    leftIcon={showIcon ? <TrashIcon /> : undefined}
    testId={testId}
    {...props}
  >
    {children}
  </Button>
));
DeleteButton.displayName = 'DeleteButton';

/**
 * Cancel button
 */
export const CancelButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(({
  children = 'Cancel',
  testId = 'cancel-button',
  ...props
}, ref) => (
  <Button
    ref={ref}
    variant="outline"
    testId={testId}
    {...props}
  >
    {children}
  </Button>
));
CancelButton.displayName = 'CancelButton';

/**
 * Play/Run button
 */
export interface PlayButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  /** Show as stop instead */
  isPlaying?: boolean;
}

export const PlayButton = forwardRef<HTMLButtonElement, PlayButtonProps>(({
  isPlaying = false,
  children,
  variant = 'default',
  testId = 'play-button',
  ...props
}, ref) => (
  <Button
    ref={ref}
    variant={isPlaying ? 'destructive' : variant}
    leftIcon={isPlaying ? <StopIcon /> : <PlayIcon />}
    testId={testId}
    {...props}
  >
    {children || (isPlaying ? 'Stop' : 'Run')}
  </Button>
));
PlayButton.displayName = 'PlayButton';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const CloseIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const SaveIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default Button;
