/**
 * Input - Text input component
 * @module components/Ui/Input
 * @version 1.0.0
 * 
 * Provides text inputs with multiple features:
 * - Input types: text, password, email, number, url, search, tel
 * - Validation states: error, success, warning
 * - Addons: prefix, suffix, icons
 * - Labels and helper text
 * 
 * @example
 * ```tsx
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="Enter your email"
 *   error={errors.email}
 * />
 * ```
 */

import React, {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useId,
} from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input type
 */
export type InputType = 
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'url'
  | 'search'
  | 'tel'
  | 'date'
  | 'time'
  | 'datetime-local';

/**
 * Input size
 */
export type InputSize = 'sm' | 'md' | 'lg';

/**
 * Input variant
 */
export type InputVariant = 'default' | 'outline' | 'filled' | 'ghost';

/**
 * Validation state
 */
export type ValidationState = 'default' | 'error' | 'success' | 'warning';

/**
 * Input props
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  /** Input type */
  type?: InputType;
  /** Size variant */
  size?: InputSize;
  /** Visual variant */
  variant?: InputVariant;
  /** Label text */
  label?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error message (also sets error state) */
  error?: string | boolean;
  /** Success message (also sets success state) */
  success?: string | boolean;
  /** Warning message (also sets warning state) */
  warning?: string | boolean;
  /** Left addon/icon */
  leftIcon?: React.ReactNode;
  /** Right addon/icon */
  rightIcon?: React.ReactNode;
  /** Left text addon */
  prefix?: string;
  /** Right text addon */
  suffix?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Callback when cleared */
  onClear?: () => void;
  /** Full width */
  fullWidth?: boolean;
  /** Show character count */
  showCount?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Hide label visually (still accessible) */
  hideLabel?: boolean;
  /** Additional wrapper classes */
  wrapperClassName?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Textarea props
 */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** Size variant */
  size?: InputSize;
  /** Visual variant */
  variant?: InputVariant;
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string | boolean;
  /** Success message */
  success?: string | boolean;
  /** Auto-resize to content */
  autoResize?: boolean;
  /** Minimum rows */
  minRows?: number;
  /** Maximum rows */
  maxRows?: number;
  /** Show character count */
  showCount?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Hide label visually */
  hideLabel?: boolean;
  /** Wrapper classes */
  wrapperClassName?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Password input props
 */
export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
  /** Show password strength indicator */
  showStrength?: boolean;
  /** Custom strength calculator */
  strengthCalculator?: (password: string) => PasswordStrength;
}

/**
 * Password strength
 */
export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  feedback?: string[];
}

/**
 * Search input props
 */
export interface SearchInputProps extends Omit<InputProps, 'type' | 'leftIcon'> {
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Callback for debounced search */
  onSearch?: (value: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Size styles
 */
const SIZE_STYLES: Record<InputSize, { input: string; label: string; icon: string }> = {
  sm: {
    input: 'h-8 px-2.5 text-sm',
    label: 'text-xs',
    icon: 'w-4 h-4',
  },
  md: {
    input: 'h-10 px-3 text-sm',
    label: 'text-sm',
    icon: 'w-5 h-5',
  },
  lg: {
    input: 'h-12 px-4 text-base',
    label: 'text-base',
    icon: 'w-5 h-5',
  },
};

/**
 * Variant styles
 */
const VARIANT_STYLES: Record<InputVariant, string> = {
  default: 'bg-white border border-gray-300 focus:border-blue-500',
  outline: 'bg-transparent border-2 border-gray-300 focus:border-blue-500',
  filled: 'bg-gray-100 border border-transparent focus:bg-white focus:border-blue-500',
  ghost: 'bg-transparent border border-transparent focus:bg-gray-50 focus:border-gray-200',
};

/**
 * Validation state styles
 */
const VALIDATION_STYLES: Record<ValidationState, { border: string; text: string; icon: string }> = {
  default: {
    border: '',
    text: 'text-gray-500',
    icon: '',
  },
  error: {
    border: 'border-red-500 focus:border-red-500 focus:ring-red-500',
    text: 'text-red-500',
    icon: 'text-red-500',
  },
  success: {
    border: 'border-green-500 focus:border-green-500 focus:ring-green-500',
    text: 'text-green-500',
    icon: 'text-green-500',
  },
  warning: {
    border: 'border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500',
    text: 'text-yellow-500',
    icon: 'text-yellow-500',
  },
};

/**
 * Password strength colors
 */
const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
const STRENGTH_LABELS = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get validation state from props
 */
const getValidationState = (
  error?: string | boolean,
  success?: string | boolean,
  warning?: string | boolean
): ValidationState => {
  if (error) return 'error';
  if (success) return 'success';
  if (warning) return 'warning';
  return 'default';
};

/**
 * Get validation message
 */
const getValidationMessage = (
  error?: string | boolean,
  success?: string | boolean,
  warning?: string | boolean
): string | undefined => {
  if (typeof error === 'string') return error;
  if (typeof success === 'string') return success;
  if (typeof warning === 'string') return warning;
  return undefined;
};

/**
 * Default password strength calculator
 */
const defaultStrengthCalculator = (password: string): PasswordStrength => {
  let score = 0;
  const feedback: string[] = [];

  if (password.length === 0) {
    return { score: 0, label: 'Empty', feedback: ['Enter a password'] };
  }

  // Length check
  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters');

  if (password.length >= 12) score++;

  // Uppercase check
  if (/[A-Z]/.test(password)) score++;
  else feedback.push('At least 1 uppercase letter');

  // Number check
  if (/\d/.test(password)) score++;
  else feedback.push('At least 1 number');

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else feedback.push('At least 1 special character');

  // Cap at 4
  score = Math.min(score, 4);

  return {
    score,
    label: STRENGTH_LABELS[score],
    feedback: feedback.length > 0 ? feedback : undefined,
  };
};

// ============================================================================
// MAIN INPUT COMPONENT
// ============================================================================

/**
 * Input component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  size = 'md',
  variant = 'default',
  label,
  helperText,
  error,
  success,
  warning,
  leftIcon,
  rightIcon,
  prefix,
  suffix,
  clearable = false,
  onClear,
  fullWidth = true,
  showCount = false,
  loading = false,
  hideLabel = false,
  wrapperClassName = '',
  className = '',
  testId = 'input',
  id: providedId,
  disabled,
  readOnly,
  maxLength,
  value,
  defaultValue,
  onChange,
  ...props
}, ref) => {
  // Generate ID if not provided
  const generatedId = useId();
  const inputId = providedId || generatedId;

  // Track value for controlled/uncontrolled inputs
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const currentValue = value !== undefined ? value : internalValue;

  // Get styles
  const sizeStyles = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];
  const validationState = getValidationState(error, success, warning);
  const validationStyles = VALIDATION_STYLES[validationState];
  const validationMessage = getValidationMessage(error, success, warning);

  // Handle change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    },
    [onChange]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setInternalValue('');
    onClear?.();
    // Create synthetic event for onChange
    const syntheticEvent = {
      target: { value: '' },
      currentTarget: { value: '' },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(syntheticEvent);
  }, [onChange, onClear]);

  // Calculate if we should show clear button
  const showClearButton = clearable && String(currentValue).length > 0 && !disabled && !readOnly;

  // Check if we have any addons
  const hasLeftAddon = leftIcon || prefix;
  const hasRightAddon = rightIcon || suffix || showClearButton || loading;

  return (
    <div
      className={`${fullWidth ? 'w-full' : 'inline-block'} ${wrapperClassName}`}
      data-testid={`${testId}-wrapper`}
    >
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={`
            block mb-1.5 font-medium text-gray-700
            ${sizeStyles.label}
            ${hideLabel ? 'sr-only' : ''}
          `}
          data-testid={`${testId}-label`}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input container */}
      <div className="relative">
        {/* Prefix */}
        {prefix && (
          <span
            className="
              absolute left-0 inset-y-0 flex items-center
              px-3 text-gray-500 bg-gray-50 border-r border-gray-300
              rounded-l-md
            "
            data-testid={`${testId}-prefix`}
          >
            {prefix}
          </span>
        )}

        {/* Left icon */}
        {leftIcon && !prefix && (
          <span
            className={`
              absolute left-3 inset-y-0 flex items-center
              pointer-events-none text-gray-400
              ${sizeStyles.icon}
            `}
            data-testid={`${testId}-left-icon`}
          >
            {leftIcon}
          </span>
        )}

        {/* Input element */}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          value={currentValue}
          onChange={handleChange}
          className={`
            w-full rounded-md transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
            read-only:bg-gray-50 read-only:cursor-default
            placeholder:text-gray-400
            ${sizeStyles.input}
            ${variantStyles}
            ${validationStyles.border}
            ${hasLeftAddon ? (prefix ? 'pl-16' : 'pl-10') : ''}
            ${hasRightAddon ? 'pr-10' : ''}
            ${className}
          `}
          data-testid={testId}
          aria-invalid={validationState === 'error'}
          aria-describedby={validationMessage ? `${inputId}-message` : undefined}
          {...props}
        />

        {/* Right side container */}
        {hasRightAddon && (
          <span
            className={`
              absolute right-3 inset-y-0 flex items-center gap-1.5
              ${disabled || readOnly ? 'pointer-events-none' : ''}
            `}
          >
            {/* Loading spinner */}
            {loading && (
              <LoadingSpinner
                className={`${sizeStyles.icon} text-gray-400`}
                data-testid={`${testId}-loading`}
              />
            )}

            {/* Clear button */}
            {showClearButton && !loading && (
              <button
                type="button"
                onClick={handleClear}
                className="
                  p-0.5 text-gray-400 hover:text-gray-600
                  rounded hover:bg-gray-100 transition-colors
                "
                tabIndex={-1}
                aria-label="Clear input"
                data-testid={`${testId}-clear`}
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            )}

            {/* Validation icon */}
            {validationState !== 'default' && !loading && !showClearButton && (
              <span className={validationStyles.icon}>
                {validationState === 'error' && <ErrorIcon className={sizeStyles.icon} />}
                {validationState === 'success' && <SuccessIcon className={sizeStyles.icon} />}
                {validationState === 'warning' && <WarningIcon className={sizeStyles.icon} />}
              </span>
            )}

            {/* Right icon */}
            {rightIcon && !loading && !showClearButton && validationState === 'default' && (
              <span className={`text-gray-400 ${sizeStyles.icon}`}>
                {rightIcon}
              </span>
            )}
          </span>
        )}

        {/* Suffix */}
        {suffix && (
          <span
            className="
              absolute right-0 inset-y-0 flex items-center
              px-3 text-gray-500 bg-gray-50 border-l border-gray-300
              rounded-r-md
            "
            data-testid={`${testId}-suffix`}
          >
            {suffix}
          </span>
        )}
      </div>

      {/* Helper text / Error message / Character count */}
      <div className="flex justify-between items-start mt-1.5">
        {/* Message */}
        {(validationMessage || helperText) && (
          <p
            id={`${inputId}-message`}
            className={`text-sm ${validationStyles.text}`}
            data-testid={`${testId}-message`}
          >
            {validationMessage || helperText}
          </p>
        )}

        {/* Character count */}
        {showCount && maxLength && (
          <span
            className="text-xs text-gray-400 ml-auto"
            data-testid={`${testId}-count`}
          >
            {String(currentValue).length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

Input.displayName = 'Input';

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

/**
 * Textarea component
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  size = 'md',
  variant = 'default',
  label,
  helperText,
  error,
  success,
  autoResize = false,
  minRows = 3,
  maxRows = 10,
  showCount = false,
  fullWidth = true,
  hideLabel = false,
  wrapperClassName = '',
  className = '',
  testId = 'textarea',
  id: providedId,
  disabled,
  readOnly,
  maxLength,
  value,
  defaultValue,
  onChange,
  ...props
}, ref) => {
  const generatedId = useId();
  const textareaId = providedId || generatedId;
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const currentValue = value !== undefined ? value : internalValue;

  const sizeStyles = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];
  const validationState = getValidationState(error, success);
  const validationStyles = VALIDATION_STYLES[validationState];
  const validationMessage = getValidationMessage(error, success);

  // Auto-resize effect
  useEffect(() => {
    if (!autoResize || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [currentValue, autoResize, minRows, maxRows, textareaRef]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    },
    [onChange]
  );

  return (
    <div
      className={`${fullWidth ? 'w-full' : 'inline-block'} ${wrapperClassName}`}
      data-testid={`${testId}-wrapper`}
    >
      {label && (
        <label
          htmlFor={textareaId}
          className={`
            block mb-1.5 font-medium text-gray-700
            ${sizeStyles.label}
            ${hideLabel ? 'sr-only' : ''}
          `}
          data-testid={`${testId}-label`}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <textarea
        ref={textareaRef}
        id={textareaId}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        value={currentValue}
        onChange={handleChange}
        rows={autoResize ? minRows : props.rows || minRows}
        className={`
          w-full rounded-md transition-colors resize-y
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
          read-only:bg-gray-50 read-only:cursor-default
          placeholder:text-gray-400
          px-3 py-2 ${sizeStyles.label}
          ${variantStyles}
          ${validationStyles.border}
          ${autoResize ? 'resize-none overflow-hidden' : ''}
          ${className}
        `}
        data-testid={testId}
        aria-invalid={validationState === 'error'}
        aria-describedby={validationMessage ? `${textareaId}-message` : undefined}
        {...props}
      />

      <div className="flex justify-between items-start mt-1.5">
        {(validationMessage || helperText) && (
          <p
            id={`${textareaId}-message`}
            className={`text-sm ${validationStyles.text}`}
            data-testid={`${testId}-message`}
          >
            {validationMessage || helperText}
          </p>
        )}

        {showCount && maxLength && (
          <span
            className="text-xs text-gray-400 ml-auto"
            data-testid={`${testId}-count`}
          >
            {String(currentValue).length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

Textarea.displayName = 'Textarea';

// ============================================================================
// PASSWORD INPUT COMPONENT
// ============================================================================

/**
 * Password input with visibility toggle and strength indicator
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({
  showStrength = false,
  strengthCalculator = defaultStrengthCalculator,
  testId = 'password-input',
  value,
  defaultValue,
  onChange,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const currentValue = value !== undefined ? value : internalValue;
  const strength = showStrength ? strengthCalculator(String(currentValue)) : null;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    },
    [onChange]
  );

  const toggleVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="w-full">
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        value={currentValue}
        onChange={handleChange}
        rightIcon={
          <button
            type="button"
            onClick={toggleVisibility}
            className="p-0.5 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            data-testid={`${testId}-toggle`}
          >
            {showPassword ? (
              <EyeOffIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        }
        testId={testId}
        {...props}
      />

      {/* Strength indicator */}
      {showStrength && currentValue && (
        <div className="mt-2" data-testid={`${testId}-strength`}>
          {/* Strength bars */}
          <div className="flex gap-1 mb-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`
                  h-1 flex-1 rounded-full transition-colors
                  ${i <= (strength?.score ?? 0) ? STRENGTH_COLORS[strength?.score ?? 0] : 'bg-gray-200'}
                `}
                data-testid={`${testId}-strength-bar-${i}`}
              />
            ))}
          </div>

          {/* Strength label */}
          <div className="flex justify-between items-start">
            <span
              className={`text-xs font-medium ${STRENGTH_COLORS[strength?.score ?? 0].replace('bg-', 'text-')}`}
              data-testid={`${testId}-strength-label`}
            >
              {strength?.label}
            </span>
          </div>

          {/* Feedback */}
          {strength?.feedback && strength.feedback.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 space-y-0.5">
              {strength.feedback.map((item, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

// ============================================================================
// SEARCH INPUT COMPONENT
// ============================================================================

/**
 * Search input with debouncing
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  debounceMs = 300,
  onSearch,
  testId = 'search-input',
  placeholder = 'Search...',
  value,
  defaultValue,
  onChange,
  ...props
}, ref) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const currentValue = value !== undefined ? value : internalValue;
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(e);

      // Debounced search
      if (onSearch) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          onSearch(newValue);
        }, debounceMs);
      }
    },
    [onChange, onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onSearch?.('');
  }, [onSearch]);

  return (
    <Input
      ref={ref}
      type="search"
      value={currentValue}
      onChange={handleChange}
      placeholder={placeholder}
      leftIcon={<SearchIcon className="w-5 h-5" />}
      clearable
      onClear={handleClear}
      testId={testId}
      {...props}
    />
  );
});

SearchInput.displayName = 'SearchInput';

// ============================================================================
// URL INPUT COMPONENT
// ============================================================================

/**
 * URL input with validation
 */
export interface UrlInputProps extends Omit<InputProps, 'type' | 'prefix'> {
  /** Show protocol prefix */
  showProtocol?: boolean;
}

export const UrlInput = forwardRef<HTMLInputElement, UrlInputProps>(({
  showProtocol = true,
  testId = 'url-input',
  placeholder = 'example.com',
  ...props
}, ref) => (
  <Input
    ref={ref}
    type="url"
    prefix={showProtocol ? 'https://' : undefined}
    placeholder={placeholder}
    testId={testId}
    {...props}
  />
));

UrlInput.displayName = 'UrlInput';

// ============================================================================
// NUMBER INPUT COMPONENT
// ============================================================================

/**
 * Number input with increment/decrement
 */
export interface NumberInputProps extends Omit<InputProps, 'type'> {
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Show increment/decrement buttons */
  showButtons?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(({
  min,
  max,
  step = 1,
  showButtons = false,
  testId = 'number-input',
  value,
  defaultValue,
  onChange,
  disabled,
  ...props
}, ref) => {
  const [internalValue, setInternalValue] = useState<number>(
    typeof defaultValue === 'string' ? parseFloat(defaultValue) || 0 : 0
  );
  const currentValue = value !== undefined ? parseFloat(String(value)) || 0 : internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
      setInternalValue(newValue);
      onChange?.(e);
    },
    [onChange]
  );

  const increment = useCallback(() => {
    const newValue = Math.min(currentValue + step, max ?? Infinity);
    setInternalValue(newValue);
    // Create synthetic event
    const syntheticEvent = {
      target: { value: String(newValue) },
      currentTarget: { value: String(newValue) },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(syntheticEvent);
  }, [currentValue, step, max, onChange]);

  const decrement = useCallback(() => {
    const newValue = Math.max(currentValue - step, min ?? -Infinity);
    setInternalValue(newValue);
    const syntheticEvent = {
      target: { value: String(newValue) },
      currentTarget: { value: String(newValue) },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(syntheticEvent);
  }, [currentValue, step, min, onChange]);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        testId={testId}
        className={showButtons ? 'pr-10' : ''}
        {...props}
      />

      {showButtons && (
        <div className="absolute right-1 inset-y-1 flex flex-col">
          <button
            type="button"
            onClick={increment}
            disabled={disabled || (max !== undefined && currentValue >= max)}
            className="
              flex-1 px-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100
              disabled:opacity-50 disabled:cursor-not-allowed
              rounded-t border-b border-gray-200
            "
            tabIndex={-1}
            aria-label="Increment"
            data-testid={`${testId}-increment`}
          >
            <ChevronUpIcon className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={decrement}
            disabled={disabled || (min !== undefined && currentValue <= min)}
            className="
              flex-1 px-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100
              disabled:opacity-50 disabled:cursor-not-allowed
              rounded-b
            "
            tabIndex={-1}
            aria-label="Decrement"
            data-testid={`${testId}-decrement`}
          >
            <ChevronDownIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
});

NumberInput.displayName = 'NumberInput';

// ============================================================================
// FORM FIELD WRAPPER COMPONENT
// ============================================================================

/**
 * Form field wrapper with label and error handling
 */
export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Field ID */
  htmlFor?: string;
  /** Required indicator */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Children (input element) */
  children: React.ReactNode;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

export const FormField = memo<FormFieldProps>(({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
  className = '',
  testId = 'form-field',
}) => (
  <div className={`space-y-1.5 ${className}`} data-testid={testId}>
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-gray-700"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {(error || helperText) && (
      <p className={`text-sm ${error ? 'text-red-500' : 'text-gray-500'}`}>
        {error || helperText}
      </p>
    )}
  </div>
));

FormField.displayName = 'FormField';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SuccessIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const ChevronUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const LoadingSpinner: React.FC<{ className?: string; 'data-testid'?: string }> = ({ className, ...props }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" {...props}>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default Input;
