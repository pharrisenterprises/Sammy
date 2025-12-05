/**
 * Select - Dropdown select component
 * @module components/Ui/Select
 * @version 1.0.0
 * 
 * Provides dropdown selection with multiple features:
 * - Single and multi-select modes
 * - Searchable/filterable options
 * - Grouped options
 * - Custom option rendering
 * - Keyboard navigation
 * 
 * @example
 * ```tsx
 * <Select
 *   value={selectedStep}
 *   onChange={setSelectedStep}
 *   options={recordedSteps.map(s => ({ value: s.label, label: s.label }))}
 *   placeholder="Select step..."
 * />
 * ```
 */

import React, {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Select option
 */
export interface SelectOption<T = string> {
  /** Option value */
  value: T;
  /** Display label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Group name (for grouped options) */
  group?: string;
  /** Icon element */
  icon?: React.ReactNode;
  /** Additional description */
  description?: string;
  /** Custom data */
  data?: Record<string, unknown>;
}

/**
 * Select group
 */
export interface SelectGroup<T = string> {
  /** Group label */
  label: string;
  /** Options in group */
  options: SelectOption<T>[];
}

/**
 * Select size
 */
export type SelectSize = 'sm' | 'md' | 'lg';

/**
 * Select variant
 */
export type SelectVariant = 'default' | 'outline' | 'filled' | 'ghost';

/**
 * Base select props
 */
export interface SelectProps<T = string> {
  /** Current value */
  value?: T | null;
  /** Change handler */
  onChange?: (value: T | null) => void;
  /** Options array */
  options: SelectOption<T>[] | SelectGroup<T>[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Size variant */
  size?: SelectSize;
  /** Visual variant */
  variant?: SelectVariant;
  /** Enable search/filter */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Clearable (show clear button) */
  clearable?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom no results message */
  noResultsMessage?: string;
  /** Name for form */
  name?: string;
  /** ID for label association */
  id?: string;
  /** Required field */
  required?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Portal to body */
  portal?: boolean;
  /** Max dropdown height */
  maxHeight?: number;
  /** Custom option renderer */
  renderOption?: (option: SelectOption<T>, isSelected: boolean) => React.ReactNode;
  /** Custom value renderer */
  renderValue?: (option: SelectOption<T>) => React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Dropdown CSS classes */
  dropdownClassName?: string;
  /** Test ID */
  testId?: string;
  /** ARIA label */
  'aria-label'?: string;
  /** ARIA labelledby */
  'aria-labelledby'?: string;
}

/**
 * Multi-select props
 */
export interface MultiSelectProps<T = string> extends Omit<SelectProps<T>, 'value' | 'onChange'> {
  /** Current values */
  value?: T[];
  /** Change handler */
  onChange?: (values: T[]) => void;
  /** Maximum selections */
  maxSelections?: number;
  /** Show selected count badge */
  showCount?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Size styles
 */
const SIZE_STYLES: Record<SelectSize, { trigger: string; option: string; text: string }> = {
  sm: {
    trigger: 'h-8 px-2 text-sm',
    option: 'px-2 py-1 text-sm',
    text: 'text-sm',
  },
  md: {
    trigger: 'h-10 px-3 text-sm',
    option: 'px-3 py-2 text-sm',
    text: 'text-sm',
  },
  lg: {
    trigger: 'h-12 px-4 text-base',
    option: 'px-4 py-3 text-base',
    text: 'text-base',
  },
};

/**
 * Variant styles
 */
const VARIANT_STYLES: Record<SelectVariant, string> = {
  default: 'bg-white border border-gray-300 hover:border-gray-400',
  outline: 'bg-transparent border-2 border-gray-300 hover:border-gray-400',
  filled: 'bg-gray-100 border border-transparent hover:bg-gray-200',
  ghost: 'bg-transparent border border-transparent hover:bg-gray-100',
};

// ============================================================================
// CONTEXT
// ============================================================================

interface SelectContextValue {
  isOpen: boolean;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if options are grouped
 */
const isGroupedOptions = <T,>(
  options: SelectOption<T>[] | SelectGroup<T>[]
): options is SelectGroup<T>[] => {
  return options.length > 0 && 'options' in options[0];
};

/**
 * Flatten grouped options
 */
const flattenOptions = <T,>(
  options: SelectOption<T>[] | SelectGroup<T>[]
): SelectOption<T>[] => {
  if (isGroupedOptions(options)) {
    return options.flatMap((group) => group.options);
  }
  return options;
};

/**
 * Filter options by search query
 */
const filterOptions = <T,>(
  options: SelectOption<T>[],
  query: string
): SelectOption<T>[] => {
  if (!query.trim()) return options;
  
  const lowerQuery = query.toLowerCase();
  return options.filter((option) =>
    option.label.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Find option by value
 */
const findOption = <T,>(
  options: SelectOption<T>[],
  value: T | null | undefined
): SelectOption<T> | undefined => {
  if (value === null || value === undefined) return undefined;
  return options.find((opt) => opt.value === value);
};

// ============================================================================
// DROPDOWN COMPONENT
// ============================================================================

interface DropdownProps {
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  onClose: () => void;
  portal: boolean;
  maxHeight: number;
  className: string;
  testId: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  children,
  triggerRef,
  isOpen,
  onClose,
  portal,
  maxHeight,
  className,
  testId,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Calculate position
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={`
        absolute z-50 mt-1 overflow-hidden
        bg-white border border-gray-200 rounded-md shadow-lg
        ${className}
      `}
      style={{
        top: portal ? position.top : '100%',
        left: portal ? position.left : 0,
        width: portal ? position.width : '100%',
        maxHeight,
      }}
      data-testid={testId}
    >
      {children}
    </div>
  );

  if (portal) {
    return createPortal(dropdownContent, document.body);
  }

  return dropdownContent;
};

// ============================================================================
// SELECT TRIGGER COMPONENT
// ============================================================================

interface SelectTriggerProps {
  children: React.ReactNode;
  isOpen: boolean;
  disabled: boolean;
  error: boolean;
  size: SelectSize;
  variant: SelectVariant;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  className: string;
  testId: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
  id?: string;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  (
    {
      children,
      isOpen,
      disabled,
      error,
      size,
      variant,
      onClick,
      onKeyDown,
      className,
      testId,
      ariaLabel,
      ariaLabelledby,
      id,
    },
    ref
  ) => {
    const sizeStyles = SIZE_STYLES[size];
    const variantStyles = VARIANT_STYLES[variant];

    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        id={id}
        disabled={disabled}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={`
          relative w-full flex items-center justify-between gap-2
          rounded-md transition-colors cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeStyles.trigger}
          ${variantStyles}
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${isOpen ? 'ring-2 ring-blue-500' : ''}
          ${className}
        `}
        data-testid={testId}
      >
        {children}
        <ChevronIcon
          className={`
            w-4 h-4 text-gray-400 transition-transform flex-shrink-0
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>
    );
  }
);

SelectTrigger.displayName = 'SelectTrigger';

// ============================================================================
// SELECT OPTION COMPONENT
// ============================================================================

interface SelectOptionItemProps<T> {
  option: SelectOption<T>;
  isSelected: boolean;
  isHighlighted: boolean;
  size: SelectSize;
  onClick: () => void;
  onMouseEnter: () => void;
  renderOption?: (option: SelectOption<T>, isSelected: boolean) => React.ReactNode;
  testId: string;
}

function SelectOptionItem<T>({
  option,
  isSelected,
  isHighlighted,
  size,
  onClick,
  onMouseEnter,
  renderOption,
  testId,
}: SelectOptionItemProps<T>) {
  const sizeStyles = SIZE_STYLES[size];

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled}
      onClick={option.disabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      className={`
        cursor-pointer select-none
        ${sizeStyles.option}
        ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isHighlighted ? 'bg-blue-50' : ''}
        ${isSelected ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}
        ${!isHighlighted && !isSelected ? 'hover:bg-gray-50' : ''}
      `}
      data-testid={testId}
      data-value={String(option.value)}
      data-selected={isSelected}
      data-highlighted={isHighlighted}
    >
      {renderOption ? (
        renderOption(option, isSelected)
      ) : (
        <div className="flex items-center gap-2">
          {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="truncate">{option.label}</div>
            {option.description && (
              <div className="text-xs text-gray-500 truncate">
                {option.description}
              </div>
            )}
          </div>
          {isSelected && (
            <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN SELECT COMPONENT
// ============================================================================

/**
 * Select component
 */
export const Select = memo(<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  error = false,
  errorMessage,
  size = 'md',
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Search...',
  clearable = false,
  loading = false,
  emptyMessage = 'No options available',
  noResultsMessage = 'No results found',
  name,
  id,
  required = false,
  autoFocus = false,
  portal = true,
  maxHeight = 300,
  renderOption,
  renderValue,
  className = '',
  dropdownClassName = '',
  testId = 'select',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: SelectProps<T>) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten and filter options
  const flatOptions = useMemo(() => flattenOptions(options), [options]);
  const filteredOptions = useMemo(
    () => filterOptions(flatOptions, searchQuery),
    [flatOptions, searchQuery]
  );
  const enabledOptions = useMemo(
    () => filteredOptions.filter((opt) => !opt.disabled),
    [filteredOptions]
  );

  // Find selected option
  const selectedOption = useMemo(
    () => findOption(flatOptions, value),
    [flatOptions, value]
  );

  // Auto focus
  useEffect(() => {
    if (autoFocus && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [autoFocus]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset highlight on close
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const optionEl = listRef.current.querySelector(
        `[data-testid="${testId}-option-${highlightedIndex}"]`
      );
      optionEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, testId]);

  // Handlers
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      onChange?.(option.value);
      handleClose();
    },
    [onChange, handleClose]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            const option = enabledOptions[highlightedIndex];
            if (option) handleSelect(option);
          } else {
            setIsOpen(true);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(0);
          } else {
            setHighlightedIndex((prev) =>
              prev < enabledOptions.length - 1 ? prev + 1 : 0
            );
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(enabledOptions.length - 1);
          } else {
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : enabledOptions.length - 1
            );
          }
          break;

        case 'Escape':
          e.preventDefault();
          handleClose();
          break;

        case 'Tab':
          handleClose();
          break;

        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setHighlightedIndex(enabledOptions.length - 1);
          break;
      }
    },
    [isOpen, highlightedIndex, enabledOptions, handleSelect, handleClose]
  );

  // Group options for rendering
  const groupedForRender = useMemo(() => {
    if (isGroupedOptions(options)) {
      return options.map((group) => ({
        ...group,
        options: filterOptions(group.options, searchQuery),
      }));
    }
    return null;
  }, [options, searchQuery]);

  // Context value
  const contextValue = useMemo(
    () => ({ isOpen, highlightedIndex, setHighlightedIndex }),
    [isOpen, highlightedIndex]
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div className={`relative ${className}`} data-testid={`${testId}-container`}>
        {/* Hidden input for form submission */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={value ?? ''}
            required={required}
          />
        )}

        {/* Trigger */}
        <SelectTrigger
          ref={triggerRef}
          isOpen={isOpen}
          disabled={disabled || loading}
          error={error}
          size={size}
          variant={variant}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className=""
          testId={`${testId}-trigger`}
          ariaLabel={ariaLabel}
          ariaLabelledby={ariaLabelledby}
          id={id}
        >
          <span className="flex-1 text-left truncate">
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Loading...
              </span>
            ) : selectedOption ? (
              renderValue ? (
                renderValue(selectedOption)
              ) : (
                <span className="flex items-center gap-2">
                  {selectedOption.icon}
                  {selectedOption.label}
                </span>
              )
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </span>

          {/* Clear button */}
          {clearable && value !== null && value !== undefined && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 rounded"
              aria-label="Clear selection"
              data-testid={`${testId}-clear`}
            >
              <CloseIcon className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </SelectTrigger>

        {/* Error message */}
        {error && errorMessage && (
          <p
            className="mt-1 text-sm text-red-500"
            data-testid={`${testId}-error`}
          >
            {errorMessage}
          </p>
        )}

        {/* Dropdown */}
        <Dropdown
          triggerRef={triggerRef}
          isOpen={isOpen}
          onClose={handleClose}
          portal={portal}
          maxHeight={maxHeight}
          className={dropdownClassName}
          testId={`${testId}-dropdown`}
        >
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="
                  w-full px-3 py-1.5 text-sm
                  border border-gray-300 rounded-md
                  focus:outline-none focus:ring-1 focus:ring-blue-500
                "
                data-testid={`${testId}-search`}
              />
            </div>
          )}

          {/* Options list */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto"
            style={{ maxHeight: maxHeight - (searchable ? 52 : 0) }}
            data-testid={`${testId}-list`}
          >
            {flatOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {emptyMessage}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {noResultsMessage}
              </div>
            ) : groupedForRender ? (
              // Grouped options
              groupedForRender.map((group, groupIndex) => (
                <div key={group.label}>
                  {group.options.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                        {group.label}
                      </div>
                      {group.options.map((option) => {
                        const optionIndex = enabledOptions.findIndex(
                          (o) => o.value === option.value
                        );
                        return (
                          <SelectOptionItem
                            key={String(option.value)}
                            option={option}
                            isSelected={option.value === value}
                            isHighlighted={optionIndex === highlightedIndex}
                            size={size}
                            onClick={() => handleSelect(option)}
                            onMouseEnter={() => setHighlightedIndex(optionIndex)}
                            renderOption={renderOption}
                            testId={`${testId}-option-${optionIndex}`}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              ))
            ) : (
              // Flat options
              filteredOptions.map((option, index) => {
                const optionIndex = enabledOptions.findIndex(
                  (o) => o.value === option.value
                );
                return (
                  <SelectOptionItem
                    key={String(option.value)}
                    option={option}
                    isSelected={option.value === value}
                    isHighlighted={optionIndex === highlightedIndex}
                    size={size}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(optionIndex)}
                    renderOption={renderOption}
                    testId={`${testId}-option-${index}`}
                  />
                );
              })
            )}
          </div>
        </Dropdown>
      </div>
    </SelectContext.Provider>
  );
}) as <T extends string | number = string>(props: SelectProps<T>) => React.ReactElement;

(Select as React.FC).displayName = 'Select';

// ============================================================================
// MULTI-SELECT COMPONENT
// ============================================================================

/**
 * Multi-select component
 */
export const MultiSelect = memo(<T extends string | number = string>({
  value = [],
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  error = false,
  errorMessage,
  size = 'md',
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Search...',
  clearable = false,
  loading = false,
  emptyMessage = 'No options available',
  noResultsMessage = 'No results found',
  maxSelections,
  showCount = true,
  name,
  id,
  required = false,
  portal = true,
  maxHeight = 300,
  renderOption,
  className = '',
  dropdownClassName = '',
  testId = 'multi-select',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: MultiSelectProps<T>) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten and filter options
  const flatOptions = useMemo(() => flattenOptions(options), [options]);
  const filteredOptions = useMemo(
    () => filterOptions(flatOptions, searchQuery),
    [flatOptions, searchQuery]
  );
  const enabledOptions = useMemo(
    () => filteredOptions.filter((opt) => !opt.disabled),
    [filteredOptions]
  );

  // Selected options
  const selectedOptions = useMemo(
    () => flatOptions.filter((opt) => value.includes(opt.value)),
    [flatOptions, value]
  );

  // Check if max selections reached
  const maxReached = maxSelections !== undefined && value.length >= maxSelections;

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handlers
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      const isSelected = value.includes(option.value);

      if (isSelected) {
        onChange?.(value.filter((v) => v !== option.value));
      } else if (!maxReached) {
        onChange?.([...value, option.value]);
      }
    },
    [value, onChange, maxReached]
  );

  const handleRemove = useCallback(
    (optionValue: T, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(value.filter((v) => v !== optionValue));
    },
    [value, onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.([]);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            const option = enabledOptions[highlightedIndex];
            if (option) handleSelect(option);
          } else {
            setIsOpen(true);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < enabledOptions.length - 1 ? prev + 1 : 0
            );
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : enabledOptions.length - 1
            );
          }
          break;

        case 'Escape':
          e.preventDefault();
          handleClose();
          break;

        case 'Backspace':
          if (searchQuery === '' && value.length > 0) {
            onChange?.(value.slice(0, -1));
          }
          break;
      }
    },
    [isOpen, highlightedIndex, enabledOptions, handleSelect, handleClose, searchQuery, value, onChange]
  );

  const sizeStyles = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];

  return (
    <div className={`relative ${className}`} data-testid={`${testId}-container`}>
      {/* Hidden input for form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value.join(',')}
          required={required}
        />
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        id={id}
        disabled={disabled || loading}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`
          relative w-full min-h-[40px] flex items-center flex-wrap gap-1
          rounded-md transition-colors cursor-pointer p-1.5
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles}
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${isOpen ? 'ring-2 ring-blue-500' : ''}
        `}
        data-testid={`${testId}-trigger`}
      >
        {/* Selected tags */}
        {selectedOptions.length > 0 ? (
          <>
            {selectedOptions.slice(0, 3).map((opt) => (
              <span
                key={String(opt.value)}
                className="
                  inline-flex items-center gap-1 px-2 py-0.5
                  bg-blue-100 text-blue-800 rounded text-sm
                "
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => handleRemove(opt.value, e)}
                  className="hover:text-blue-600"
                  aria-label={`Remove ${opt.label}`}
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedOptions.length > 3 && showCount && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                +{selectedOptions.length - 3} more
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400 px-1">{placeholder}</span>
        )}

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-1">
          {/* Clear button */}
          {clearable && value.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 rounded"
              aria-label="Clear all"
              data-testid={`${testId}-clear`}
            >
              <CloseIcon className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <ChevronIcon
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Error message */}
      {error && errorMessage && (
        <p className="mt-1 text-sm text-red-500" data-testid={`${testId}-error`}>
          {errorMessage}
        </p>
      )}

      {/* Dropdown */}
      <Dropdown
        triggerRef={triggerRef}
        isOpen={isOpen}
        onClose={handleClose}
        portal={portal}
        maxHeight={maxHeight}
        className={dropdownClassName}
        testId={`${testId}-dropdown`}
      >
        {/* Search input */}
        {searchable && (
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full px-3 py-1.5 text-sm
                border border-gray-300 rounded-md
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
              data-testid={`${testId}-search`}
            />
          </div>
        )}

        {/* Options list */}
        <div
          ref={listRef}
          role="listbox"
          aria-multiselectable="true"
          className="overflow-y-auto"
          style={{ maxHeight: maxHeight - (searchable ? 52 : 0) }}
          data-testid={`${testId}-list`}
        >
          {flatOptions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {emptyMessage}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {noResultsMessage}
            </div>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = value.includes(option.value);
              const isDisabledByMax = !isSelected && maxReached;
              const optionIndex = enabledOptions.findIndex((o) => o.value === option.value);

              return (
                <div
                  key={String(option.value)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || isDisabledByMax}
                  onClick={option.disabled || isDisabledByMax ? undefined : () => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(optionIndex)}
                  className={`
                    cursor-pointer select-none flex items-center gap-2
                    ${sizeStyles.option}
                    ${option.disabled || isDisabledByMax ? 'opacity-50 cursor-not-allowed' : ''}
                    ${optionIndex === highlightedIndex ? 'bg-blue-50' : ''}
                    ${isSelected ? 'bg-blue-100' : ''}
                    ${optionIndex !== highlightedIndex && !isSelected ? 'hover:bg-gray-50' : ''}
                  `}
                  data-testid={`${testId}-option-${index}`}
                >
                  {/* Checkbox */}
                  <div
                    className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}
                    `}
                  >
                    {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>

                  {/* Option content */}
                  {renderOption ? (
                    renderOption(option, isSelected)
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Max selections warning */}
        {maxReached && (
          <div className="px-3 py-2 text-xs text-amber-600 bg-amber-50 border-t border-amber-100">
            Maximum {maxSelections} selections reached
          </div>
        )}
      </Dropdown>
    </div>
  );
}) as <T extends string | number = string>(props: MultiSelectProps<T>) => React.ReactElement;

(MultiSelect as React.FC).displayName = 'MultiSelect';

// ============================================================================
// NATIVE SELECT COMPONENT
// ============================================================================

/**
 * Native select props
 */
export interface NativeSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption<string>[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  size?: SelectSize;
  name?: string;
  id?: string;
  required?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Native HTML select (for simpler use cases)
 */
export const NativeSelect = memo<NativeSelectProps>(({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  error = false,
  size = 'md',
  name,
  id,
  required = false,
  className = '',
  testId = 'native-select',
}) => {
  const sizeStyles = SIZE_STYLES[size];

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      name={name}
      id={id}
      required={required}
      className={`
        w-full rounded-md border border-gray-300
        bg-white focus:outline-none focus:ring-2
        focus:ring-blue-500 focus:border-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeStyles.trigger}
        ${error ? 'border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      data-testid={testId}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option
          key={String(option.value)}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
});

NativeSelect.displayName = 'NativeSelect';

// ============================================================================
// STEP SELECTOR COMPONENT (Field Mapping specific)
// ============================================================================

/**
 * Step selector props
 */
export interface StepSelectorProps {
  value?: string;
  onChange?: (value: string | null) => void;
  steps: Array<{ label: string; event?: string }>;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Step selector for field mapping
 */
export const StepSelector = memo<StepSelectorProps>(({
  value,
  onChange,
  steps,
  placeholder = 'Select step...',
  disabled = false,
  error = false,
  className = '',
  testId = 'step-selector',
}) => {
  const options: SelectOption<string>[] = useMemo(
    () =>
      steps.map((step) => ({
        value: step.label,
        label: step.label,
        description: step.event ? `Event: ${step.event}` : undefined,
      })),
    [steps]
  );

  return (
    <Select
      value={value ?? null}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      error={error}
      searchable={steps.length > 5}
      clearable
      className={className}
      testId={testId}
    />
  );
});

StepSelector.displayName = 'StepSelector';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default Select;
