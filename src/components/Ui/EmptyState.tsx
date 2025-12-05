/**
 * EmptyState - Empty state placeholder component
 * @module components/Ui/EmptyState
 * @version 1.0.0
 * 
 * Displays helpful messages when no data exists:
 * - Customizable icon
 * - Title and description text
 * - Optional action button
 * - Preset variants for common scenarios
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<FolderIcon />}
 *   title="No projects yet"
 *   description="Create your first project to get started"
 *   action={{
 *     label: "Create Project",
 *     onClick: () => setShowCreate(true)
 *   }}
 * />
 * ```
 */

import React, { memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action button configuration
 */
export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
}

/**
 * Component props
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  testId?: string;
}

/**
 * Preset variant type
 */
export type EmptyStateVariant = 
  | 'no-projects'
  | 'no-steps'
  | 'no-results'
  | 'no-test-runs'
  | 'no-csv'
  | 'no-mappings'
  | 'search-empty'
  | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    container: 'py-8 px-4',
    icon: 'w-10 h-10 mb-3',
    title: 'text-base',
    description: 'text-sm max-w-xs',
    button: 'text-sm px-3 py-1.5',
  },
  md: {
    container: 'py-12 px-6',
    icon: 'w-14 h-14 mb-4',
    title: 'text-lg',
    description: 'text-sm max-w-sm',
    button: 'text-sm px-4 py-2',
  },
  lg: {
    container: 'py-16 px-8',
    icon: 'w-20 h-20 mb-6',
    title: 'text-xl',
    description: 'text-base max-w-md',
    button: 'text-base px-6 py-2.5',
  },
};

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
};

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Folder: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  Steps: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  Search: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Play: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Table: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Link: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  AlertCircle: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Inbox: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
};

// ============================================================================
// PRESET VARIANTS
// ============================================================================

/**
 * Preset configurations for common empty states
 */
export const EMPTY_STATE_PRESETS: Record<EmptyStateVariant, Omit<EmptyStateProps, 'action' | 'testId'>> = {
  'no-projects': {
    icon: <Icons.Folder />,
    title: 'No projects yet',
    description: 'Create your first automation project to get started. Record once, replay infinitely.',
  },
  'no-steps': {
    icon: <Icons.Steps />,
    title: 'No steps recorded',
    description: 'Start recording to capture browser interactions. Click the Record button to begin.',
  },
  'no-results': {
    icon: <Icons.Search />,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria to find what you\'re looking for.',
  },
  'no-test-runs': {
    icon: <Icons.Play />,
    title: 'No test runs yet',
    description: 'Run your first test to see execution history and results here.',
  },
  'no-csv': {
    icon: <Icons.Table />,
    title: 'No CSV data',
    description: 'Upload a CSV file to enable data-driven testing with multiple data rows.',
  },
  'no-mappings': {
    icon: <Icons.Link />,
    title: 'No field mappings',
    description: 'Map CSV columns to recorded steps to inject data during test execution.',
  },
  'search-empty': {
    icon: <Icons.Search />,
    title: 'No matches found',
    description: 'We couldn\'t find anything matching your search. Try different keywords.',
  },
  'error': {
    icon: <Icons.AlertCircle />,
    title: 'Something went wrong',
    description: 'An error occurred while loading data. Please try again.',
  },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Action button component
 */
const ActionButton: React.FC<{
  action: EmptyStateAction;
  sizeConfig: typeof SIZE_CONFIG['md'];
  testId?: string;
}> = memo(({ action, sizeConfig, testId }) => {
  const variant = action.variant ?? 'primary';
  
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={`
        inline-flex items-center justify-center rounded-md font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        ${sizeConfig.button}
        ${BUTTON_VARIANTS[variant]}
      `}
      data-testid={testId}
    >
      {action.label}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * EmptyState component
 */
export const EmptyState: React.FC<EmptyStateProps> = memo(({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className = '',
  testId = 'empty-state',
}) => {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${sizeConfig.container} ${className}`}
      data-testid={testId}
    >
      {/* Icon */}
      {icon && (
        <div 
          className={`text-gray-400 ${sizeConfig.icon}`}
          data-testid={`${testId}-icon`}
        >
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 
        className={`font-semibold text-gray-900 ${sizeConfig.title}`}
        data-testid={`${testId}-title`}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p 
          className={`mt-2 text-gray-500 ${sizeConfig.description}`}
          data-testid={`${testId}-description`}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            <ActionButton 
              action={action} 
              sizeConfig={sizeConfig}
              testId={`${testId}-action`}
            />
          )}
          {secondaryAction && (
            <ActionButton 
              action={{ ...secondaryAction, variant: secondaryAction.variant ?? 'outline' }} 
              sizeConfig={sizeConfig}
              testId={`${testId}-secondary-action`}
            />
          )}
        </div>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

// ============================================================================
// PRESET COMPONENTS
// ============================================================================

/**
 * Factory function to create preset empty state component
 */
export function createEmptyStatePreset(variant: EmptyStateVariant) {
  const preset = EMPTY_STATE_PRESETS[variant];
  
  const PresetComponent: React.FC<{
    action?: EmptyStateAction;
    secondaryAction?: EmptyStateAction;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    testId?: string;
  }> = memo((props) => (
    <EmptyState {...preset} {...props} />
  ));
  
  PresetComponent.displayName = `EmptyState${variant.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
  
  return PresetComponent;
}

/**
 * Preset: No Projects
 */
export const NoProjectsEmptyState = createEmptyStatePreset('no-projects');

/**
 * Preset: No Steps
 */
export const NoStepsEmptyState = createEmptyStatePreset('no-steps');

/**
 * Preset: No Results
 */
export const NoResultsEmptyState = createEmptyStatePreset('no-results');

/**
 * Preset: No Test Runs
 */
export const NoTestRunsEmptyState = createEmptyStatePreset('no-test-runs');

/**
 * Preset: No CSV
 */
export const NoCsvEmptyState = createEmptyStatePreset('no-csv');

/**
 * Preset: No Mappings
 */
export const NoMappingsEmptyState = createEmptyStatePreset('no-mappings');

/**
 * Preset: Search Empty
 */
export const SearchEmptyState = createEmptyStatePreset('search-empty');

/**
 * Preset: Error
 */
export const ErrorEmptyState = createEmptyStatePreset('error');

// ============================================================================
// ILLUSTRATION COMPONENT
// ============================================================================

/**
 * EmptyStateWithIllustration - Enhanced empty state with larger illustration
 */
export interface EmptyStateWithIllustrationProps extends EmptyStateProps {
  illustration: React.ReactNode;
}

export const EmptyStateWithIllustration: React.FC<EmptyStateWithIllustrationProps> = memo(({
  illustration,
  title,
  description,
  action,
  secondaryAction,
  size = 'lg',
  className = '',
  testId = 'empty-state-illustration',
}) => {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${sizeConfig.container} ${className}`}
      data-testid={testId}
    >
      {/* Illustration */}
      <div className="mb-8 max-w-xs" data-testid={`${testId}-illustration`}>
        {illustration}
      </div>

      {/* Title */}
      <h3 className={`font-semibold text-gray-900 ${sizeConfig.title}`}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className={`mt-2 text-gray-500 ${sizeConfig.description}`}>
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            <ActionButton action={action} sizeConfig={sizeConfig} />
          )}
          {secondaryAction && (
            <ActionButton 
              action={{ ...secondaryAction, variant: secondaryAction.variant ?? 'outline' }} 
              sizeConfig={sizeConfig}
            />
          )}
        </div>
      )}
    </div>
  );
});

EmptyStateWithIllustration.displayName = 'EmptyStateWithIllustration';

// ============================================================================
// EXPORTS
// ============================================================================

export default EmptyState;
export { Icons as EmptyStateIcons };
