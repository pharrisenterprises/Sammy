/**
 * ProjectCard - Dashboard project card component
 * @module components/Dashboard/ProjectCard
 * @version 1.0.0
 * 
 * Displays project information in a card format:
 * - Project name, description, status badge
 * - Step count and dates
 * - Action buttons (Edit, Delete, Record, Run)
 * 
 * @example
 * ```tsx
 * <ProjectCard
 *   project={project}
 *   onEdit={(id) => handleEdit(id)}
 *   onDelete={(id) => handleDelete(id)}
 *   onRecord={(id) => navigate(`/recorder?project=${id}`)}
 *   onRun={(id) => navigate(`/test-runner?project=${id}`)}
 * />
 * ```
 */

import React, { memo, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project status
 */
export type ProjectStatus = 'draft' | 'testing' | 'complete';

/**
 * Project data
 */
export interface Project {
  id: number;
  name: string;
  description?: string;
  target_url: string;
  status: ProjectStatus;
  created_date: number;
  updated_date: number;
  recorded_steps?: unknown[];
  parsed_fields?: unknown[];
  csv_data?: unknown[];
}

/**
 * Component props
 */
export interface ProjectCardProps {
  project: Project;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onRecord?: (id: number) => void;
  onRun?: (id: number) => void;
  onSelect?: (project: Project) => void;
  isSelected?: boolean;
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Status badge configuration
 */
export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  testing: {
    label: 'Testing',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  complete: {
    label: 'Complete',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Status badge component
 */
export const StatusBadge: React.FC<{ status: ProjectStatus }> = memo(({ status }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
      data-testid="status-badge"
    >
      {config.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

/**
 * Action button component
 */
export const ActionButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  testId?: string;
}> = memo(({ onClick, icon, label, variant = 'default', disabled = false, testId }) => {
  const variants = {
    default: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    primary: 'text-blue-600 hover:text-blue-900 hover:bg-blue-100',
    danger: 'text-red-600 hover:text-red-900 hover:bg-red-100',
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${variants[variant]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={label}
      aria-label={label}
      data-testid={testId}
    >
      {icon}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

/**
 * Stat item component
 */
export const StatItem: React.FC<{
  icon: React.ReactNode;
  value: string | number;
  label: string;
}> = memo(({ icon, value, label }) => (
  <div className="flex items-center gap-1.5 text-sm text-gray-500" title={label}>
    {icon}
    <span>{value}</span>
  </div>
));

StatItem.displayName = 'StatItem';

// ============================================================================
// ICONS (Inline SVG for zero dependencies)
// ============================================================================

const Icons = {
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Delete: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Duplicate: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Record: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  ),
  Play: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Steps: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  CSV: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ProjectCard component
 */
export const ProjectCard: React.FC<ProjectCardProps> = memo(({
  project,
  onEdit,
  onDelete,
  onDuplicate,
  onRecord,
  onRun,
  onSelect,
  isSelected = false,
  isLoading = false,
  className = '',
  testId = 'project-card',
}) => {
  // Derived values
  const stepCount = project.recorded_steps?.length ?? 0;
  const hasSteps = stepCount > 0;
  const hasCsv = (project.csv_data?.length ?? 0) > 0;
  const domain = useMemo(() => extractDomain(project.target_url), [project.target_url]);

  // Handle card click
  const handleCardClick = () => {
    onSelect?.(project);
  };

  return (
    <div
      className={`
        relative bg-white rounded-lg border shadow-sm transition-all duration-200
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}
        ${onSelect ? 'cursor-pointer' : ''}
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
      onClick={onSelect ? handleCardClick : undefined}
      data-testid={testId}
      data-project-id={project.id}
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 
              className="text-base font-semibold text-gray-900 truncate"
              title={project.name}
            >
              {project.name}
            </h3>
            {project.description && (
              <p 
                className="mt-1 text-sm text-gray-500 line-clamp-2"
                title={project.description}
              >
                {project.description}
              </p>
            )}
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* URL Display */}
        {domain && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <Icons.Globe />
            <span className="truncate" title={project.target_url}>
              {domain}
            </span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4">
        <StatItem
          icon={<Icons.Steps />}
          value={stepCount}
          label={`${stepCount} recorded step${stepCount !== 1 ? 's' : ''}`}
        />
        {hasCsv && (
          <StatItem
            icon={<Icons.CSV />}
            value={project.csv_data?.length ?? 0}
            label={`${project.csv_data?.length ?? 0} CSV row${(project.csv_data?.length ?? 0) !== 1 ? 's' : ''}`}
          />
        )}
        <div className="flex-1" />
        <StatItem
          icon={<Icons.Clock />}
          value={formatDate(project.updated_date)}
          label={`Updated ${formatDate(project.updated_date)}`}
        />
      </div>

      {/* Actions Row */}
      <div className="px-2 py-2 border-t border-gray-100 flex items-center justify-between">
        {/* Left Actions */}
        <div className="flex items-center gap-1">
          {onEdit && (
            <ActionButton
              onClick={() => onEdit(project.id)}
              icon={<Icons.Edit />}
              label="Edit project"
              testId={`${testId}-edit`}
            />
          )}
          {onDuplicate && (
            <ActionButton
              onClick={() => onDuplicate(project.id)}
              icon={<Icons.Duplicate />}
              label="Duplicate project"
              testId={`${testId}-duplicate`}
            />
          )}
          {onDelete && (
            <ActionButton
              onClick={() => onDelete(project.id)}
              icon={<Icons.Delete />}
              label="Delete project"
              variant="danger"
              testId={`${testId}-delete`}
            />
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          {onRecord && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRecord(project.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              data-testid={`${testId}-record`}
            >
              <Icons.Record />
              <span>Record</span>
            </button>
          )}
          {onRun && hasSteps && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRun(project.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              data-testid={`${testId}-run`}
            >
              <Icons.Play />
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

ProjectCard.displayName = 'ProjectCard';

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

/**
 * ProjectCard skeleton for loading state
 */
export const ProjectCardSkeleton: React.FC<{ className?: string }> = memo(({ className = '' }) => (
  <div
    className={`bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse ${className}`}
    data-testid="project-card-skeleton"
  >
    {/* Header */}
    <div className="p-4 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="mt-2 h-4 bg-gray-200 rounded w-full" />
          <div className="mt-1 h-4 bg-gray-200 rounded w-2/3" />
        </div>
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
      </div>
      <div className="mt-2 h-3 bg-gray-200 rounded w-1/3" />
    </div>

    {/* Stats */}
    <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4">
      <div className="h-4 bg-gray-200 rounded w-12" />
      <div className="flex-1" />
      <div className="h-4 bg-gray-200 rounded w-20" />
    </div>

    {/* Actions */}
    <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-20 bg-gray-200 rounded" />
        <div className="h-8 w-16 bg-gray-200 rounded" />
      </div>
    </div>
  </div>
));

ProjectCardSkeleton.displayName = 'ProjectCardSkeleton';

// ============================================================================
// EXPORTS
// ============================================================================

export default ProjectCard;
