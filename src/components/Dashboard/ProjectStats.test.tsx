/**
 * ProjectStats - Component tests
 * @module components/Dashboard/ProjectStats.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectStats, {
  calculateStats,
  formatNumber,
  StatCard,
  MiniStat,
  ProgressBar,
  StatusBreakdown,
  ProjectStatsSkeleton,
  type Project,
  type TestRun,
} from './ProjectStats';

// ============================================================================
// TEST DATA
// ============================================================================

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Project 1',
    status: 'draft',
    recorded_steps: [{ id: 1 }, { id: 2 }],
    updated_date: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
  },
  {
    id: 2,
    name: 'Project 2',
    status: 'testing',
    recorded_steps: [{ id: 1 }, { id: 2 }, { id: 3 }],
    updated_date: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
  },
  {
    id: 3,
    name: 'Project 3',
    status: 'complete',
    recorded_steps: [{ id: 1 }],
    updated_date: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
  },
  {
    id: 4,
    name: 'Project 4',
    status: 'testing',
    recorded_steps: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    updated_date: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
  },
];

const mockTestRuns: TestRun[] = [
  {
    id: 1,
    project_id: 2,
    status: 'completed',
    passed_steps: 3,
    failed_steps: 0,
    total_steps: 3,
    start_time: new Date().toISOString(),
  },
  {
    id: 2,
    project_id: 4,
    status: 'completed',
    passed_steps: 2,
    failed_steps: 2,
    total_steps: 4,
    start_time: new Date().toISOString(),
  },
  {
    id: 3,
    project_id: 2,
    status: 'completed',
    passed_steps: 3,
    failed_steps: 0,
    total_steps: 3,
    start_time: new Date().toISOString(),
  },
  {
    id: 4,
    project_id: 3,
    status: 'running',
    passed_steps: 0,
    failed_steps: 0,
    total_steps: 1,
    start_time: new Date().toISOString(),
  },
];

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('calculateStats', () => {
  it('should calculate total projects', () => {
    const stats = calculateStats(mockProjects);
    expect(stats.totalProjects).toBe(4);
  });

  it('should calculate projects by status', () => {
    const stats = calculateStats(mockProjects);
    expect(stats.projectsByStatus.draft).toBe(1);
    expect(stats.projectsByStatus.testing).toBe(2);
    expect(stats.projectsByStatus.complete).toBe(1);
  });

  it('should calculate total steps', () => {
    const stats = calculateStats(mockProjects);
    expect(stats.totalSteps).toBe(10); // 2 + 3 + 1 + 4
  });

  it('should calculate total test runs', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.totalRuns).toBe(4);
  });

  it('should calculate passed runs (completed with 0 failures)', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.passedRuns).toBe(2); // runs 1 and 3
  });

  it('should calculate failed runs (completed with failures)', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.failedRuns).toBe(1); // run 2
  });

  it('should calculate success rate', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.successRate).toBe(67); // 2 passed / 3 completed = 66.67% -> 67%
  });

  it('should calculate total steps passed', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.totalStepsPassed).toBe(8); // 3 + 2 + 3 + 0
  });

  it('should calculate total steps failed', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.totalStepsFailed).toBe(2); // 0 + 2 + 0 + 0
  });

  it('should calculate step pass rate', () => {
    const stats = calculateStats(mockProjects, mockTestRuns);
    expect(stats.stepPassRate).toBe(80); // 8 / 10 = 80%
  });

  it('should calculate recent activity (last 7 days)', () => {
    const stats = calculateStats(mockProjects);
    expect(stats.recentActivity).toBe(3); // Projects 1, 2, 4 updated within 7 days
  });

  it('should calculate active projects (status=testing)', () => {
    const stats = calculateStats(mockProjects);
    expect(stats.activeProjects).toBe(2); // Projects 2 and 4
  });

  it('should handle empty projects array', () => {
    const stats = calculateStats([]);
    expect(stats.totalProjects).toBe(0);
    expect(stats.totalSteps).toBe(0);
    expect(stats.projectsByStatus.draft).toBe(0);
  });

  it('should handle empty test runs array', () => {
    const stats = calculateStats(mockProjects, []);
    expect(stats.totalRuns).toBe(0);
    expect(stats.passedRuns).toBe(0);
    expect(stats.successRate).toBe(0);
  });

  it('should handle projects without recorded_steps', () => {
    const projectsNoSteps: Project[] = [
      { id: 1, name: 'Test', status: 'draft' },
    ];
    const stats = calculateStats(projectsNoSteps);
    expect(stats.totalSteps).toBe(0);
  });

  it('should handle projects without updated_date', () => {
    const projectsNoDate: Project[] = [
      { id: 1, name: 'Test', status: 'draft' },
    ];
    const stats = calculateStats(projectsNoDate);
    expect(stats.recentActivity).toBe(0);
  });
});

describe('formatNumber', () => {
  it('should format numbers under 1000 as-is', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('should format thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(10000)).toBe('10.0K');
    expect(formatNumber(99999)).toBe('100.0K');
  });

  it('should format millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(1500000)).toBe('1.5M');
    expect(formatNumber(10000000)).toBe('10.0M');
  });
});

// ============================================================================
// SUB-COMPONENT TESTS
// ============================================================================

describe('StatCard', () => {
  const mockIcon = <svg data-testid="mock-icon" />;

  it('should render title, value, and icon', () => {
    render(
      <StatCard
        title="Total Projects"
        value="42"
        icon={mockIcon}
        testId="stat-card"
      />
    );

    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(
      <StatCard
        title="Total Projects"
        value="42"
        subtitle="5 active"
        icon={mockIcon}
      />
    );

    expect(screen.getByText('5 active')).toBeInTheDocument();
  });

  it('should render trend when provided', () => {
    render(
      <StatCard
        title="Success Rate"
        value="85%"
        icon={mockIcon}
        trend={{ value: 85, isPositive: true }}
      />
    );

    expect(screen.getByText('85%', { selector: 'span' })).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <StatCard
        title="Total Projects"
        value="42"
        icon={mockIcon}
        isLoading={true}
        testId="stat-card"
      />
    );

    expect(screen.getByTestId('stat-card').querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should apply custom iconBgColor', () => {
    render(
      <StatCard
        title="Test"
        value="10"
        icon={mockIcon}
        iconBgColor="bg-red-100"
      />
    );

    const iconContainer = screen.getByTestId('mock-icon').parentElement;
    expect(iconContainer).toHaveClass('bg-red-100');
  });

  it('should not render subtitle when loading', () => {
    render(
      <StatCard
        title="Test"
        value="10"
        subtitle="Test subtitle"
        icon={mockIcon}
        isLoading={true}
      />
    );

    expect(screen.queryByText('Test subtitle')).not.toBeInTheDocument();
  });

  it('should not render trend when loading', () => {
    render(
      <StatCard
        title="Test"
        value="10"
        icon={mockIcon}
        trend={{ value: 50, isPositive: true }}
        isLoading={true}
      />
    );

    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('MiniStat', () => {
  it('should render label and value', () => {
    render(<MiniStat label="Passed" value="42" testId="mini-stat" />);

    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should apply custom color', () => {
    render(<MiniStat label="Failed" value="5" color="text-red-600" />);

    const valueElement = screen.getByText('5');
    expect(valueElement).toHaveClass('text-red-600');
  });

  it('should apply default color when not specified', () => {
    render(<MiniStat label="Total" value="100" />);

    const valueElement = screen.getByText('100');
    expect(valueElement).toHaveClass('text-gray-900');
  });
});

describe('ProgressBar', () => {
  it('should render progress bar', () => {
    render(<ProgressBar value={50} testId="progress-bar" />);

    const container = screen.getByTestId('progress-bar');
    expect(container).toBeInTheDocument();
  });

  it('should calculate percentage correctly', () => {
    const { container } = render(<ProgressBar value={30} max={100} testId="progress" />);
    
    const progressBar = container.querySelector('[data-testid="progress"] > div > div');
    expect(progressBar).toHaveAttribute('style', 'width: 30%;');
  });

  it('should show label when requested', () => {
    render(<ProgressBar value={75} showLabel={true} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should not exceed 100%', () => {
    const { container } = render(<ProgressBar value={150} max={100} testId="progress" />);
    
    const progressBar = container.querySelector('[data-testid="progress"] > div > div');
    expect(progressBar).toHaveAttribute('style', 'width: 100%;');
  });

  it('should not go below 0%', () => {
    const { container } = render(<ProgressBar value={-10} max={100} testId="progress" />);
    
    const progressBar = container.querySelector('[data-testid="progress"] > div > div');
    expect(progressBar).toHaveAttribute('style', 'width: 0%;');
  });

  it('should apply custom color', () => {
    const { container } = render(<ProgressBar value={50} color="bg-red-600" testId="progress" />);
    
    const progressBar = container.querySelector('[data-testid="progress"] > div > div');
    expect(progressBar).toHaveClass('bg-red-600');
  });

  it('should apply size class', () => {
    const { container: smContainer } = render(<ProgressBar value={50} size="sm" />);
    const { container: lgContainer } = render(<ProgressBar value={50} size="lg" />);
    
    expect(smContainer.querySelector('.h-1')).toBeInTheDocument();
    expect(lgContainer.querySelector('.h-3')).toBeInTheDocument();
  });
});

describe('StatusBreakdown', () => {
  const mockProjectsByStatus = {
    draft: 2,
    testing: 5,
    complete: 3,
  };

  it('should render status breakdown title', () => {
    render(
      <StatusBreakdown
        projectsByStatus={mockProjectsByStatus}
        total={10}
        testId="status-breakdown"
      />
    );

    expect(screen.getByText('Projects by Status')).toBeInTheDocument();
  });

  it('should render all status categories', () => {
    render(
      <StatusBreakdown
        projectsByStatus={mockProjectsByStatus}
        total={10}
      />
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('should display correct counts', () => {
    render(
      <StatusBreakdown
        projectsByStatus={mockProjectsByStatus}
        total={10}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <StatusBreakdown
        projectsByStatus={mockProjectsByStatus}
        total={10}
        isLoading={true}
        testId="status-breakdown"
      />
    );

    const container = screen.getByTestId('status-breakdown');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('should handle zero total', () => {
    render(
      <StatusBreakdown
        projectsByStatus={{ draft: 0, testing: 0, complete: 0 }}
        total={0}
      />
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});

// ============================================================================
// MAIN COMPONENT TESTS
// ============================================================================

describe('ProjectStats', () => {
  it('should render all primary stat cards', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
      />
    );

    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('Total Steps')).toBeInTheDocument();
    expect(screen.getByText('Test Runs')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
  });

  it('should display calculated statistics', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
        testId="stats"
      />
    );

    expect(screen.getByTestId('stats-total-projects')).toHaveTextContent('4');
    expect(screen.getByTestId('stats-total-steps')).toHaveTextContent('10');
    expect(screen.getByTestId('stats-success-rate')).toHaveTextContent('67%');
  });

  it('should show extended stats when showExtended is true', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
        showExtended={true}
      />
    );

    expect(screen.getByText('Projects by Status')).toBeInTheDocument();
    expect(screen.getByText('Activity Summary')).toBeInTheDocument();
  });

  it('should not show extended stats by default', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
      />
    );

    expect(screen.queryByText('Projects by Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity Summary')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        className="custom-class"
        testId="stats"
      />
    );

    expect(screen.getByTestId('stats')).toHaveClass('custom-class');
  });

  it('should apply custom testId', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testId="custom-stats"
      />
    );

    expect(screen.getByTestId('custom-stats')).toBeInTheDocument();
  });

  it('should handle empty projects array', () => {
    render(
      <ProjectStats
        projects={[]}
        testRuns={[]}
        testId="stats"
      />
    );

    expect(screen.getByTestId('stats-total-projects')).toHaveTextContent('0');
    expect(screen.getByTestId('stats-total-steps')).toHaveTextContent('0');
  });

  it('should handle missing testRuns prop', () => {
    render(
      <ProjectStats
        projects={mockProjects}
      />
    );

    expect(screen.getByText('Total Projects')).toBeInTheDocument();
  });

  it('should show loading state for all cards', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        isLoading={true}
        testId="stats"
      />
    );

    const container = screen.getByTestId('stats');
    const loadingElements = container.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should show loading state for extended stats', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        isLoading={true}
        showExtended={true}
        testId="stats"
      />
    );

    const container = screen.getByTestId('stats');
    const loadingElements = container.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(4); // More than just primary cards
  });

  it('should format large numbers with K suffix', () => {
    const manyProjects: Project[] = Array.from({ length: 1500 }, (_, i) => ({
      id: i,
      name: `Project ${i}`,
      status: 'draft' as const,
      recorded_steps: [{ id: 1 }],
    }));

    render(
      <ProjectStats
        projects={manyProjects}
        testId="stats"
      />
    );

    expect(screen.getByTestId('stats-total-projects')).toHaveTextContent('1.5K');
  });

  it('should display active projects count', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
      />
    );

    expect(screen.getByText('2 active')).toBeInTheDocument(); // 2 testing projects
  });

  it('should display passed runs count', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
      />
    );

    expect(screen.getByText('2 passed')).toBeInTheDocument();
  });

  it('should display step pass rate subtitle', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
      />
    );

    expect(screen.getByText('80% steps')).toBeInTheDocument();
  });

  it('should display recent activity in extended view', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
        showExtended={true}
      />
    );

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });

  it('should display step statistics in extended view', () => {
    render(
      <ProjectStats
        projects={mockProjects}
        testRuns={mockTestRuns}
        showExtended={true}
      />
    );

    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
  });
});

// ============================================================================
// SKELETON COMPONENT TESTS
// ============================================================================

describe('ProjectStatsSkeleton', () => {
  it('should render skeleton placeholder', () => {
    render(<ProjectStatsSkeleton />);

    expect(screen.getByTestId('project-stats-skeleton')).toBeInTheDocument();
  });

  it('should render 4 skeleton cards', () => {
    const { container } = render(<ProjectStatsSkeleton />);
    
    const skeletonCards = container.querySelectorAll('.animate-pulse');
    expect(skeletonCards).toHaveLength(4);
  });

  it('should apply custom className', () => {
    render(<ProjectStatsSkeleton className="custom-skeleton" />);

    expect(screen.getByTestId('project-stats-skeleton')).toHaveClass('custom-skeleton');
  });
});
