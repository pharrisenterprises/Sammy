/**
 * Tabs - Tabbed interface component
 * @module components/Ui/Tabs
 * @version 1.0.0
 * 
 * Provides a tabbed interface for organizing content:
 * - Multiple tab variants (underline, pills, boxed)
 * - Controlled and uncontrolled modes
 * - Keyboard navigation
 * - Icon and badge support
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <Tabs defaultValue="console">
 *   <TabsList>
 *     <TabsTrigger value="console">Console</TabsTrigger>
 *     <TabsTrigger value="results">Results</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="console">Console content</TabsContent>
 *   <TabsContent value="results">Results content</TabsContent>
 * </Tabs>
 * ```
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tab variant style
 */
export type TabsVariant = 'underline' | 'pills' | 'boxed' | 'minimal';

/**
 * Tab size
 */
export type TabsSize = 'sm' | 'md' | 'lg';

/**
 * Tab orientation
 */
export type TabsOrientation = 'horizontal' | 'vertical';

/**
 * Tabs context value
 */
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: TabsVariant;
  size: TabsSize;
  orientation: TabsOrientation;
  disabled: boolean;
}

/**
 * Tabs root props
 */
export interface TabsProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  orientation?: TabsOrientation;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

/**
 * TabsList props
 */
export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * TabsTrigger props
 */
export interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * TabsContent props
 */
export interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  forceMount?: boolean;
  className?: string;
  testId?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIST_STYLES: Record<TabsVariant, Record<TabsOrientation, string>> = {
  underline: {
    horizontal: 'border-b border-gray-200',
    vertical: 'border-r border-gray-200',
  },
  pills: {
    horizontal: 'bg-gray-100 p-1 rounded-lg',
    vertical: 'bg-gray-100 p-1 rounded-lg',
  },
  boxed: {
    horizontal: 'border border-gray-200 rounded-lg p-1',
    vertical: 'border border-gray-200 rounded-lg p-1',
  },
  minimal: {
    horizontal: '',
    vertical: '',
  },
};

const TRIGGER_BASE = 'relative inline-flex items-center justify-center font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const TRIGGER_VARIANTS: Record<TabsVariant, { active: string; inactive: string }> = {
  underline: {
    active: 'text-blue-600 border-b-2 border-blue-600 -mb-px',
    inactive: 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px',
  },
  pills: {
    active: 'bg-white text-gray-900 shadow-sm rounded-md',
    inactive: 'text-gray-500 hover:text-gray-700 rounded-md',
  },
  boxed: {
    active: 'bg-white text-gray-900 border border-gray-200 rounded-md shadow-sm',
    inactive: 'text-gray-500 hover:text-gray-700 border border-transparent rounded-md',
  },
  minimal: {
    active: 'text-blue-600',
    inactive: 'text-gray-500 hover:text-gray-700',
  },
};

const TRIGGER_SIZES: Record<TabsSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3 py-2 gap-2',
  lg: 'text-base px-4 py-2.5 gap-2.5',
};

const ORIENTATION_STYLES: Record<TabsOrientation, { list: string; content: string }> = {
  horizontal: {
    list: 'flex flex-row',
    content: 'mt-2',
  },
  vertical: {
    list: 'flex flex-col',
    content: 'ml-4',
  },
};

// ============================================================================
// TABS ROOT
// ============================================================================

/**
 * Tabs root component
 */
export const Tabs: React.FC<TabsProps> = memo(({
  children,
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  variant = 'underline',
  size = 'md',
  orientation = 'horizontal',
  disabled = false,
  className = '',
  testId = 'tabs',
}) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = useCallback((newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  }, [isControlled, onValueChange]);

  const contextValue = useMemo<TabsContextValue>(() => ({
    value,
    onValueChange: handleValueChange,
    variant,
    size,
    orientation,
    disabled,
  }), [value, handleValueChange, variant, size, orientation, disabled]);

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={`${orientation === 'vertical' ? 'flex' : ''} ${className}`}
        data-testid={testId}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
});

Tabs.displayName = 'Tabs';

// ============================================================================
// TABS LIST
// ============================================================================

/**
 * TabsList component - contains tab triggers
 */
export const TabsList: React.FC<TabsListProps> = memo(({
  children,
  className = '',
  testId = 'tabs-list',
}) => {
  const { variant, orientation, size } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    if (e.key !== nextKey && e.key !== prevKey && e.key !== 'Home' && e.key !== 'End') {
      return;
    }

    e.preventDefault();

    const triggers = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not([disabled])'
    );
    if (!triggers?.length) return;

    const currentIndex = Array.from(triggers).findIndex(
      (trigger) => trigger === document.activeElement
    );

    let nextIndex: number;
    if (e.key === nextKey) {
      nextIndex = currentIndex < triggers.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === prevKey) {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : triggers.length - 1;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else {
      nextIndex = triggers.length - 1;
    }

    triggers[nextIndex]?.focus();
  }, [orientation]);

  const listStyle = LIST_STYLES[variant][orientation];
  const orientationStyle = ORIENTATION_STYLES[orientation].list;

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={`${orientationStyle} ${listStyle} gap-1 ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
});

TabsList.displayName = 'TabsList';

// ============================================================================
// TABS TRIGGER
// ============================================================================

/**
 * TabsTrigger component - clickable tab button
 */
export const TabsTrigger: React.FC<TabsTriggerProps> = memo(({
  children,
  value,
  disabled: localDisabled = false,
  icon,
  badge,
  className = '',
  testId,
}) => {
  const {
    value: selectedValue,
    onValueChange,
    variant,
    size,
    disabled: globalDisabled,
  } = useTabsContext();

  const isSelected = selectedValue === value;
  const isDisabled = globalDisabled || localDisabled;

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onValueChange(value);
    }
  }, [isDisabled, onValueChange, value]);

  const variantStyle = isSelected
    ? TRIGGER_VARIANTS[variant].active
    : TRIGGER_VARIANTS[variant].inactive;
  const sizeStyle = TRIGGER_SIZES[size];

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={`tabpanel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      disabled={isDisabled}
      onClick={handleClick}
      className={`${TRIGGER_BASE} ${variantStyle} ${sizeStyle} ${className}`}
      data-testid={testId || `tab-trigger-${value}`}
      data-state={isSelected ? 'active' : 'inactive'}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge && <span className="flex-shrink-0">{badge}</span>}
    </button>
  );
});

TabsTrigger.displayName = 'TabsTrigger';

// ============================================================================
// TABS CONTENT
// ============================================================================

/**
 * TabsContent component - panel content for a tab
 */
export const TabsContent: React.FC<TabsContentProps> = memo(({
  children,
  value,
  forceMount = false,
  className = '',
  testId,
}) => {
  const { value: selectedValue, orientation } = useTabsContext();

  const isSelected = selectedValue === value;

  // Don't render if not selected and forceMount is false
  if (!isSelected && !forceMount) {
    return null;
  }

  const orientationStyle = ORIENTATION_STYLES[orientation].content;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-trigger-${value}`}
      hidden={!isSelected}
      tabIndex={0}
      className={`${orientationStyle} focus:outline-none ${className}`}
      data-testid={testId || `tab-content-${value}`}
      data-state={isSelected ? 'active' : 'inactive'}
    >
      {children}
    </div>
  );
});

TabsContent.displayName = 'TabsContent';

// ============================================================================
// COMPOUND COMPONENTS
// ============================================================================

/**
 * Simple tabs wrapper for common use cases
 */
export interface SimpleTabsProps {
  tabs: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    content: React.ReactNode;
    disabled?: boolean;
  }>;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  className?: string;
  testId?: string;
}

export const SimpleTabs: React.FC<SimpleTabsProps> = memo(({
  tabs,
  defaultValue,
  value,
  onValueChange,
  variant = 'underline',
  size = 'md',
  className = '',
  testId = 'simple-tabs',
}) => {
  const effectiveDefaultValue = defaultValue ?? tabs[0]?.value ?? '';

  return (
    <Tabs
      defaultValue={effectiveDefaultValue}
      value={value}
      onValueChange={onValueChange}
      variant={variant}
      size={size}
      className={className}
      testId={testId}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            icon={tab.icon}
            badge={tab.badge}
            disabled={tab.disabled}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
});

SimpleTabs.displayName = 'SimpleTabs';

/**
 * Test Runner tabs preset
 */
export interface TestRunnerTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  consoleContent: React.ReactNode;
  resultsContent: React.ReactNode;
  historyContent?: React.ReactNode;
  stepsContent?: React.ReactNode;
  consoleBadge?: React.ReactNode;
  resultsBadge?: React.ReactNode;
  className?: string;
  testId?: string;
}

export const TestRunnerTabs: React.FC<TestRunnerTabsProps> = memo(({
  activeTab,
  onTabChange,
  consoleContent,
  resultsContent,
  historyContent,
  stepsContent,
  consoleBadge,
  resultsBadge,
  className = '',
  testId = 'test-runner-tabs',
}) => {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      variant="underline"
      className={className}
      testId={testId}
    >
      <TabsList>
        <TabsTrigger value="console" badge={consoleBadge}>
          Console
        </TabsTrigger>
        <TabsTrigger value="results" badge={resultsBadge}>
          Results
        </TabsTrigger>
        {stepsContent && (
          <TabsTrigger value="steps">Steps</TabsTrigger>
        )}
        {historyContent && (
          <TabsTrigger value="history">History</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="console">{consoleContent}</TabsContent>
      <TabsContent value="results">{resultsContent}</TabsContent>
      {stepsContent && (
        <TabsContent value="steps">{stepsContent}</TabsContent>
      )}
      {historyContent && (
        <TabsContent value="history">{historyContent}</TabsContent>
      )}
    </Tabs>
  );
});

TestRunnerTabs.displayName = 'TestRunnerTabs';

// ============================================================================
// ICONS
// ============================================================================

export const TabIcons = {
  Console: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Results: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  History: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Steps: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
};

// ============================================================================
// EXPORTS
// ============================================================================

export default Tabs;
