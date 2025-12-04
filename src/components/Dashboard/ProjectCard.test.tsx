/**
 * Tests for ProjectCard component
 * @module components/Dashboard/ProjectCard.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ProjectCard,
  ProjectCardSkeleton,
  StatusBadge,
  formatDate,
  truncateText,
  extractDomain,
  type Project,
  type ProjectStatus,
} from './ProjectCard';

// ============================================================================
// TEST DATA
// ============================================================================

const mockProject: Project = {
  id: 1,
  name: 'Test Project',
  description: 'A test project description',
  target_url: 'https://example.com/app',
  status: 'draft',
  created_date: Date.now() - 86400000, // 1 day ago
  updated_date: Date.now(),
  recorded_steps: [{ id: '1' }, { id: '2' }, { id: '3' }],
  parsed_fields: [],
  csv_data: [{ row: '1' }, { row: '2' }],
};

// ============================================================================
// TESTS
// ============================================================================

describe('ProjectCard', () => {
  describe('rendering', () => {
    it('should render project name', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should render project description', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByText('A test project description')).toBeInTheDocument();
    });

    it('should render status badge', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Draft');
    });

    it('should render domain from target URL', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should render step count', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render CSV row count', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render updated date', () => {
      render(<ProjectCard project={mockProject} />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should handle project without description', () => {
      const projectWithoutDesc = { ...mockProject, description: undefined };
      render(<ProjectCard project={projectWithoutDesc} />);
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should handle project without CSV data', () => {
      const projectWithoutCsv = { ...mockProject, csv_data: [] };
      render(<ProjectCard project={projectWithoutCsv} />);
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('should call onEdit when edit button clicked', () => {
      const onEdit = vi.fn();
      render(<ProjectCard project={mockProject} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTestId('project-card-edit'));
      expect(onEdit).toHaveBeenCalledWith(1);
    });

    it('should call onDelete when delete button clicked', () => {
      const onDelete = vi.fn();
      render(<ProjectCard project={mockProject} onDelete={onDelete} />);
      
      fireEvent.click(screen.getByTestId('project-card-delete'));
      expect(onDelete).toHaveBeenCalledWith(1);
    });

    it('should call onDuplicate when duplicate button clicked', () => {
      const onDuplicate = vi.fn();
      render(<ProjectCard project={mockProject} onDuplicate={onDuplicate} />);
      
      fireEvent.click(screen.getByTestId('project-card-duplicate'));
      expect(onDuplicate).toHaveBeenCalledWith(1);
    });

    it('should call onRecord when record button clicked', () => {
      const onRecord = vi.fn();
      render(<ProjectCard project={mockProject} onRecord={onRecord} />);
      
      fireEvent.click(screen.getByTestId('project-card-record'));
      expect(onRecord).toHaveBeenCalledWith(1);
    });

    it('should call onRun when run button clicked', () => {
      const onRun = vi.fn();
      render(<ProjectCard project={mockProject} onRun={onRun} />);
      
      fireEvent.click(screen.getByTestId('project-card-run'));
      expect(onRun).toHaveBeenCalledWith(1);
    });

    it('should call onSelect when card clicked', () => {
      const onSelect = vi.fn();
      render(<ProjectCard project={mockProject} onSelect={onSelect} />);
      
      fireEvent.click(screen.getByTestId('project-card'));
      expect(onSelect).toHaveBeenCalledWith(mockProject);
    });

    it('should not render run button if no steps', () => {
      const projectWithoutSteps = { ...mockProject, recorded_steps: [] };
      const onRun = vi.fn();
      render(<ProjectCard project={projectWithoutSteps} onRun={onRun} />);
      
      expect(screen.queryByTestId('project-card-run')).not.toBeInTheDocument();
    });

    it('should stop propagation on action button clicks', () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      render(<ProjectCard project={mockProject} onSelect={onSelect} onEdit={onEdit} />);
      
      fireEvent.click(screen.getByTestId('project-card-edit'));
      expect(onEdit).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('states', () => {
    it('should show selected state', () => {
      render(<ProjectCard project={mockProject} isSelected={true} />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveClass('border-blue-500');
    });

    it('should show loading state', () => {
      render(<ProjectCard project={mockProject} isLoading={true} />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveClass('opacity-50');
    });

    it('should apply custom className', () => {
      render(<ProjectCard project={mockProject} className="custom-class" />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveClass('custom-class');
    });

    it('should use custom testId', () => {
      render(<ProjectCard project={mockProject} testId="custom-card" />);
      expect(screen.getByTestId('custom-card')).toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    it.each<[ProjectStatus, string]>([
      ['draft', 'Draft'],
      ['testing', 'Testing'],
      ['complete', 'Complete'],
    ])('should render %s status badge', (status, label) => {
      const projectWithStatus = { ...mockProject, status };
      render(<ProjectCard project={projectWithStatus} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
    });
  });
});

describe('StatusBadge', () => {
  it.each<[ProjectStatus, string, string]>([
    ['draft', 'Draft', 'bg-gray-100'],
    ['testing', 'Testing', 'bg-blue-100'],
    ['complete', 'Complete', 'bg-green-100'],
  ])('should render %s badge with correct style', (status, label, bgClass) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveClass(bgClass);
  });
});

describe('ProjectCardSkeleton', () => {
  it('should render skeleton', () => {
    render(<ProjectCardSkeleton />);
    expect(screen.getByTestId('project-card-skeleton')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<ProjectCardSkeleton className="custom-skeleton" />);
    expect(screen.getByTestId('project-card-skeleton')).toHaveClass('custom-skeleton');
  });
});

describe('utility functions', () => {
  describe('formatDate', () => {
    it('should return "Today" for today', () => {
      expect(formatDate(Date.now())).toBe('Today');
    });

    it('should return "Yesterday" for yesterday', () => {
      const yesterday = Date.now() - 86400000;
      expect(formatDate(yesterday)).toBe('Yesterday');
    });

    it('should return "X days ago" for recent dates', () => {
      const threeDaysAgo = Date.now() - 3 * 86400000;
      expect(formatDate(threeDaysAgo)).toBe('3 days ago');
    });

    it('should return formatted date for older dates', () => {
      const twoWeeksAgo = Date.now() - 14 * 86400000;
      const result = formatDate(twoWeeksAgo);
      expect(result).toMatch(/\w{3} \d{1,2}/); // e.g., "Nov 15"
    });

    it('should handle invalid timestamp', () => {
      expect(formatDate(0)).toBe('N/A');
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('Short', 10)).toBe('Short');
    });

    it('should truncate long text', () => {
      expect(truncateText('This is a long text', 10)).toBe('This is...');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
    });

    it('should handle URL with subdomain', () => {
      expect(extractDomain('https://app.example.com')).toBe('app.example.com');
    });

    it('should return original string for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('not-a-url');
    });

    it('should handle empty string', () => {
      expect(extractDomain('')).toBe('');
    });
  });
});
