/**
 * SearchBar - Search input component with debounce
 * @module components/Dashboard/SearchBar
 * @version 1.0.0
 * 
 * Provides a search input with:
 * - Debounced onChange callback
 * - Clear button when value present
 * - Keyboard shortcuts (Escape to clear, Cmd/Ctrl+K to focus)
 * - Loading indicator during search
 * - Customizable placeholder and icon
 * 
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   placeholder="Search projects..."
 *   debounceMs={300}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Component props
 */
export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showShortcut?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: (value: string) => void;
  className?: string;
  testId?: string;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * useDebounce hook for debouncing values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useKeyboardShortcut hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlMatch = options.ctrl ? e.ctrlKey : true;
      const metaMatch = options.meta ? e.metaKey : true;
      const shiftMatch = options.shift ? e.shiftKey : !e.shiftKey;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        ctrlMatch &&
        metaMatch &&
        shiftMatch
      ) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    input: 'h-8 text-sm pl-8 pr-8',
    icon: 'w-4 h-4 left-2',
    clear: 'w-4 h-4 right-2',
  },
  md: {
    input: 'h-10 text-sm pl-10 pr-10',
    icon: 'w-5 h-5 left-3',
    clear: 'w-5 h-5 right-3',
  },
  lg: {
    input: 'h-12 text-base pl-12 pr-12',
    icon: 'w-6 h-6 left-4',
    clear: 'w-6 h-6 right-4',
  },
};

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Search: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Clear: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Spinner: ({ className }: { className?: string }) => (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Keyboard shortcut badge
 */
const ShortcutBadge: React.FC<{ className?: string }> = memo(({ className }) => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  
  return (
    <span 
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 rounded ${className}`}
    >
      {isMac ? '⌘' : 'Ctrl'}
      <span className="text-gray-300">+</span>
      K
    </span>
  );
});

ShortcutBadge.displayName = 'ShortcutBadge';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * SearchBar component
 */
export const SearchBar: React.FC<SearchBarProps> = memo(({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 0,
  isLoading = false,
  disabled = false,
  autoFocus = false,
  size = 'md',
  showShortcut = false,
  onFocus,
  onBlur,
  onSubmit,
  className = '',
  testId = 'search-bar',
}) => {
  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the onChange callback
  const debouncedValue = useDebounce(localValue, debounceMs);

  // Call onChange when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, value, onChange]);

  // Get size config
  const sizeConfig = SIZE_CONFIG[size];

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // If no debounce, call onChange immediately
    if (debounceMs === 0) {
      onChange(newValue);
    }
  }, [debounceMs, onChange]);

  // Handle clear
  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (localValue) {
        handleClear();
      } else {
        inputRef.current?.blur();
      }
    } else if (e.key === 'Enter' && onSubmit) {
      onSubmit(localValue);
    }
  }, [localValue, handleClear, onSubmit]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Focus input on Cmd/Ctrl+K
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useKeyboardShortcut('k', focusInput, { meta: true });
  useKeyboardShortcut('k', focusInput, { ctrl: true });

  const hasValue = localValue.length > 0;

  return (
    <div 
      className={`relative ${className}`}
      data-testid={testId}
    >
      {/* Search Icon / Loading Spinner */}
      <div 
        className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 ${sizeConfig.icon}`}
      >
        {isLoading ? (
          <Icons.Spinner className={sizeConfig.icon.split(' ')[0]} />
        ) : (
          <Icons.Search className={sizeConfig.icon.split(' ')[0]} />
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`
          w-full rounded-md border bg-white shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${isFocused ? 'border-blue-500 ring-blue-500' : 'border-gray-300'}
          ${sizeConfig.input}
        `}
        aria-label="Search"
        data-testid={`${testId}-input`}
      />

      {/* Clear Button */}
      {hasValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={`
            absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 
            transition-colors focus:outline-none focus:text-gray-600
            ${sizeConfig.clear}
          `}
          aria-label="Clear search"
          data-testid={`${testId}-clear`}
        >
          <Icons.Clear className={sizeConfig.clear.split(' ')[0]} />
        </button>
      )}

      {/* Keyboard Shortcut Badge */}
      {showShortcut && !hasValue && !isFocused && (
        <div className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none">
          <ShortcutBadge />
        </div>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

// ============================================================================
// COMPOUND COMPONENTS
// ============================================================================

/**
 * SearchBarWithResults - SearchBar with dropdown results
 */
export interface SearchResult {
  id: string | number;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface SearchBarWithResultsProps extends Omit<SearchBarProps, 'onSubmit'> {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  isOpen?: boolean;
  noResultsText?: string;
  maxResults?: number;
}

export const SearchBarWithResults: React.FC<SearchBarWithResultsProps> = memo(({
  results,
  onSelect,
  isOpen: controlledIsOpen,
  noResultsText = 'No results found',
  maxResults = 5,
  ...searchBarProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const showResults = controlledIsOpen ?? isOpen;
  const displayResults = results.slice(0, maxResults);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showResults || displayResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < displayResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : displayResults.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      onSelect(displayResults[selectedIndex]);
      setIsOpen(false);
    }
  }, [showResults, displayResults, selectedIndex, onSelect]);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <SearchBar
        {...searchBarProps}
        onFocus={() => {
          setIsOpen(true);
          searchBarProps.onFocus?.();
        }}
        onBlur={() => {
          // Delay to allow click on result
          setTimeout(() => setIsOpen(false), 200);
          searchBarProps.onBlur?.();
        }}
      />

      {/* Results Dropdown */}
      {showResults && searchBarProps.value && (
        <div 
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
          data-testid={`${searchBarProps.testId}-results`}
        >
          {displayResults.length > 0 ? (
            <ul className="py-1">
              {displayResults.map((result, index) => (
                <li
                  key={result.id}
                  onClick={() => {
                    onSelect(result);
                    setIsOpen(false);
                  }}
                  className={`
                    px-4 py-2 cursor-pointer flex items-center gap-3
                    ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}
                  `}
                  data-testid={`${searchBarProps.testId}-result-${index}`}
                >
                  {result.icon && (
                    <span className="flex-shrink-0 text-gray-400">{result.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.label}</p>
                    {result.description && (
                      <p className="text-xs text-gray-500 truncate">{result.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">{noResultsText}</div>
          )}
        </div>
      )}
    </div>
  );
});

SearchBarWithResults.displayName = 'SearchBarWithResults';

// ============================================================================
// EXPORTS
// ============================================================================

export default SearchBar;
