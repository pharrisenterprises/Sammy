/**
 * ProjectStats - Dashboard statistics display component
 * @module components/Dashboard/ProjectStats
 * @version 1.0.0
 * 
 * Displays aggregate metrics for the dashboard:
 * - Total projects count
 * - Projects by status (draft, testing, complete)
 * - Test run statistics (total runs, pass rate)
 * - Recent activity summary
 * 
 * @example
 * ```tsx
 * <ProjectStats
 *   projects={projects}
 *   testRuns={testRuns}
 *   isLoading={isLoading}
 * />
 * ```
 */

import React, { useMemo, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project status
 */
export type ProjectStatus = 'draft' | 'testing' | 'complete';

/**
 * Test run status
 */
export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';

/**
 * Project data (minimal)
 */
export interface Project {
  id: number;
  name: string;
  status: ProjectStatus;
  recorded_steps?: unknown[];
  updated_date?: number;
}

/**
 * Test run data (minimal)
 */
export interface TestRun {
  id: number;
  project_id: number;
  status: TestRunStatus;
  passed_steps: number;
  failed_steps: number;
  total_steps: number;
  start_time: string;
  end_time?: string;
}

/**
 * Calculated statistics
 */
export interface Stats {
  totalProjects: number;
  projectsByStatus: Record<ProjectStatus, number>;
  totalSteps: number;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  successRate: number;
  totalStepsPassed: number;
  totalStepsFailed: number;
  stepPassRate: number;
  recentActivity: number; // Projects updated in last 7 days
  activeProjects: number; // Projects with status 'testing'
}

/**
 * Component props
 */
export interface ProjectStatsProps {
  projects: Project[];
  testRuns?: TestRun[];
  isLoading?: boolean;
  showExtended?: boolean;
  className?: string;
  testId?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate statistics from projects and test runs
 */
export function calculateStats(projects: Project[], testRuns: TestRun[] = []): Stats {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Project stats
  const projectsByStatus: Record<ProjectStatus, number> = {
    draft: 0,
    testing: 0,
    complete: 0,
  };

  let totalSteps = 0;
  let recentActivity = 0;

  projects.forEach(project => {
    projectsByStatus[project.status] = (projectsByStatus[project.status] || 0) + 1;
    totalSteps += project.recorded_steps?.length ?? 0;
    
    if (project.updated_date && project.updated_date >= sevenDaysAgo) {
      recentActivity++;
    }
  });

  // Test run stats
  let passedRuns = 0;
  let failedRuns = 0;
  let totalStepsPassed = 0;
  let totalStepsFailed = 0;

  testRuns.forEach(run => {
    if (run.status === 'completed' && run.failed_steps === 0) {
      passedRuns++;
    } else if (run.status === 'completed' || run.status === 'failed') {
      failedRuns++;
    }
    totalStepsPassed += run.passed_steps;
    totalStepsFailed += run.failed_steps;
  });

  const completedRuns = passedRuns + failedRuns;
  const successRate = completedRuns > 0 ? Math.round((passedRuns / completedRuns) * 100) : 0;
  
  const totalStepsExecuted = totalStepsPassed + totalStepsFailed;
  const stepPassRate = totalStepsExecuted > 0 
    ? Math.round((totalStepsPassed / totalStepsExecuted) * 100) 
    : 0;

  return {
    totalProjects: projects.length,
    projectsByStatus,
    totalSteps,
    totalRuns: testRuns.length,
    passedRuns,
    failedRuns,
    successRate,
    totalStepsPassed,
    totalStepsFailed,
    stepPassRate,
    recentActivity,
    activeProjects: projectsByStatus.testing,
  };
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Folder: () => (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  Steps: () => (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  Play: () => (
    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Activity: () => (
    <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  TrendUp: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  TrendDown: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Stat card component
 */
export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  testId?: string;
}

export const StatCard: React.FC<StatCardProps> = memo(({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-blue-100',
  trend,
  isLoading = false,
  testId,
}) => (
  <div
    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"
    data-testid={testId}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {isLoading ? (
          <div className="mt-1 h-8 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        )}
        {subtitle && !isLoading && (
          <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
        )}
        {trend && !isLoading && (
          <div className={`mt-1 flex items-center text-xs ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.isPositive ? (
              <Icons.TrendUp />
            ) : (
              <Icons.TrendDown />
            )}
            <span className="ml-1">{trend.value}%</span>
          </div>
        )}
      </div>
      <div className={`p-2 rounded-lg ${iconBgColor}`}>
        {icon}
      </div>
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

/**
 * Mini stat component for compact display
 */
export interface MiniStatProps {
  label: string;
  value: string | number;
  color?: string;
  testId?: string;
}

export const MiniStat: React.FC<MiniStatProps> = memo(({
  label,
  value,
  color = 'text-gray-900',
  testId,
}) => (
  <div className="text-center" data-testid={testId}>
    <p className={`text-lg font-semibold ${color}`}>{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
));

MiniStat.displayName = 'MiniStat';

/**
 * Progress bar component
 */
export interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = memo(({
  value,
  max = 100,
  color = 'bg-blue-600',
  showLabel = false,
  size = 'md',
  testId,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' };

  return (
    <div data-testid={testId}>
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${color} rounded-full transition-all duration-300 ${heights[size]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-gray-500 text-right">{Math.round(percentage)}%</p>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

/**
 * Status breakdown component
 */
export interface StatusBreakdownProps {
  projectsByStatus: Record<ProjectStatus, number>;
  total: number;
  isLoading?: boolean;
  testId?: string;
}

export const StatusBreakdown: React.FC<StatusBreakdownProps> = memo(({
  projectsByStatus,
  total,
  isLoading = false,
  testId,
}) => {
  const statuses: { key: ProjectStatus; label: string; color: string; bgColor: string }[] = [
    { key: 'draft', label: 'Draft', color: 'bg-gray-500', bgColor: 'bg-gray-100' },
    { key: 'testing', label: 'Testing', color: 'bg-blue-500', bgColor: 'bg-blue-100' },
    { key: 'complete', label: 'Complete', color: 'bg-green-500', bgColor: 'bg-green-100' },
  ];

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"
      data-testid={testId}
    >
      <p className="text-sm font-medium text-gray-500 mb-3">Projects by Status</p>
      
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {statuses.map(({ key, label, color, bgColor }) => {
            const count = projectsByStatus[key] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-sm text-gray-600">{label}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
                <ProgressBar value={percentage} color={color} size="sm" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

StatusBreakdown.displayName = 'StatusBreakdown';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ProjectStats component
 */
export const ProjectStats: React.FC<ProjectStatsProps> = memo(({
  projects,
  testRuns = [],
  isLoading = false,
  showExtended = false,
  className = '',
  testId = 'project-stats',
}) => {
  // Calculate statistics
  const stats = useMemo(
    () => calculateStats(projects, testRuns),
    [projects, testRuns]
  );

  return (
    <div className={className} data-testid={testId}>
      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          title="Total Projects"
          value={formatNumber(stats.totalProjects)}
          subtitle={`${stats.activeProjects} active`}
          icon={<Icons.Folder />}
          iconBgColor="bg-blue-100"
          isLoading={isLoading}
          testId={`${testId}-total-projects`}
        />

        <StatCard
          title="Total Steps"
          value={formatNumber(stats.totalSteps)}
          subtitle="Recorded"
          icon={<Icons.Steps />}
          iconBgColor="bg-purple-100"
          isLoading={isLoading}
          testId={`${testId}-total-steps`}
        />

        <StatCard
          title="Test Runs"
          value={formatNumber(stats.totalRuns)}
          subtitle={`${stats.passedRuns} passed`}
          icon={<Icons.Play />}
          iconBgColor="bg-green-100"
          isLoading={isLoading}
          testId={`${testId}-test-runs`}
        />

        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          subtitle={`${stats.stepPassRate}% steps`}
          icon={<Icons.Chart />}
          iconBgColor="bg-amber-100"
          trend={stats.totalRuns > 0 ? {
            value: stats.successRate,
            isPositive: stats.successRate >= 50,
          } : undefined}
          isLoading={isLoading}
          testId={`${testId}-success-rate`}
        />
      </div>

      {/* Extended Stats */}
      {showExtended && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Breakdown */}
          <StatusBreakdown
            projectsByStatus={stats.projectsByStatus}
            total={stats.totalProjects}
            isLoading={isLoading}
            testId={`${testId}-status-breakdown`}
          />

          {/* Activity Summary */}
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-4"
            data-testid={`${testId}-activity`}
          >
            <p className="text-sm font-medium text-gray-500 mb-3">Activity Summary</p>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 rounded-lg">
                      <Icons.Activity />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Recent Activity</p>
                      <p className="text-xs text-gray-500">Last 7 days</p>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {stats.recentActivity}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                  <MiniStat
                    label="Passed"
                    value={formatNumber(stats.totalStepsPassed)}
                    color="text-green-600"
                    testId={`${testId}-steps-passed`}
                  />
                  <MiniStat
                    label="Failed"
                    value={formatNumber(stats.totalStepsFailed)}
                    color="text-red-600"
                    testId={`${testId}-steps-failed`}
                  />
                  <MiniStat
                    label="Pass Rate"
                    value={`${stats.stepPassRate}%`}
                    color="text-blue-600"
                    testId={`${testId}-step-pass-rate`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ProjectStats.displayName = 'ProjectStats';

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

/**
 * ProjectStats skeleton for loading state
 */
export const ProjectStatsSkeleton: React.FC<{ className?: string }> = memo(({ className = '' }) => (
  <div className={className} data-testid="project-stats-skeleton">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="mt-2 h-8 w-16 bg-gray-200 rounded" />
              <div className="mt-2 h-3 w-12 bg-gray-200 rounded" />
            </div>
            <div className="w-9 h-9 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </div>
));

ProjectStatsSkeleton.displayName = 'ProjectStatsSkeleton';

// ============================================================================
// EXPORTS
// ============================================================================

export default ProjectStats;
