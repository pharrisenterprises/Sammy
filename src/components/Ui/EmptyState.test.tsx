/**
 * Tests for EmptyState component
 * @module components/Ui/EmptyState.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  EmptyState,
  EmptyStateWithIllustration,
  NoProjectsEmptyState,
  NoStepsEmptyState,
  NoResultsEmptyState,
  NoTestRunsEmptyState,
  NoCsvEmptyState,
  NoMappingsEmptyState,
  SearchEmptyState,
  ErrorEmptyState,
  EMPTY_STATE_PRESETS,
  type EmptyStateAction,
} from './EmptyState';

// ============================================================================
// TESTS
// ============================================================================

describe('EmptyState', () => {
  describe('rendering', () => {
    it('should render title', () => {
      render(<EmptyState title="No data" />);
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('should render description', () => {
      render(<EmptyState title="No data" description="Add some data to get started" />);
      expect(screen.getByText('Add some data to get started')).toBeInTheDocument();
    });

    it('should render icon', () => {
      render(
        <EmptyState 
          title="No data" 
          icon={<span data-testid="custom-icon">Icon</span>} 
        />
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should render without description', () => {
      render(<EmptyState title="No data" />);
      expect(screen.queryByTestId('empty-state-description')).not.toBeInTheDocument();
    });

    it('should render without icon', () => {
      render(<EmptyState title="No data" />);
      expect(screen.queryByTestId('empty-state-icon')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<EmptyState title="No data" className="custom-class" />);
      expect(screen.getByTestId('empty-state')).toHaveClass('custom-class');
    });

    it('should use custom testId', () => {
      render(<EmptyState title="No data" testId="custom-empty" />);
      expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)('should render %s size', (size) => {
      render(<EmptyState title="No data" size={size} />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('action button', () => {
    it('should render action button', () => {
      const action: EmptyStateAction = {
        label: 'Create',
        onClick: vi.fn(),
      };
      
      render(<EmptyState title="No data" action={action} />);
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    it('should call onClick when action clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const action: EmptyStateAction = {
        label: 'Create',
        onClick,
      };
      
      render(<EmptyState title="No data" action={action} />);
      await user.click(screen.getByText('Create'));
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render secondary action', () => {
      const action: EmptyStateAction = {
        label: 'Create',
        onClick: vi.fn(),
      };
      const secondaryAction: EmptyStateAction = {
        label: 'Learn More',
        onClick: vi.fn(),
      };
      
      render(
        <EmptyState 
          title="No data" 
          action={action} 
          secondaryAction={secondaryAction} 
        />
      );
      
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Learn More')).toBeInTheDocument();
    });

    it('should apply button variants', () => {
      const action: EmptyStateAction = {
        label: 'Primary',
        onClick: vi.fn(),
        variant: 'primary',
      };
      
      render(<EmptyState title="No data" action={action} />);
      const button = screen.getByTestId('empty-state-action');
      expect(button).toHaveClass('bg-blue-600');
    });
  });

  describe('without action', () => {
    it('should not render action section when no action provided', () => {
      render(<EmptyState title="No data" />);
      expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
    });
  });
});

describe('Preset Empty States', () => {
  describe('NoProjectsEmptyState', () => {
    it('should render with preset content', () => {
      render(<NoProjectsEmptyState />);
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    it('should accept custom action', () => {
      const action: EmptyStateAction = {
        label: 'Create Project',
        onClick: vi.fn(),
      };
      
      render(<NoProjectsEmptyState action={action} />);
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });
  });

  describe('NoStepsEmptyState', () => {
    it('should render with preset content', () => {
      render(<NoStepsEmptyState />);
      expect(screen.getByText('No steps recorded')).toBeInTheDocument();
    });
  });

  describe('NoResultsEmptyState', () => {
    it('should render with preset content', () => {
      render(<NoResultsEmptyState />);
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('NoTestRunsEmptyState', () => {
    it('should render with preset content', () => {
      render(<NoTestRunsEmptyState />);
      expect(screen.getByText('No test runs yet')).toBeInTheDocument();
    });
  });

  describe('NoCsvEmptyState', () => {
    it('should render with preset content', () => {
      render(<NoCsvEmptyState />);
      expect(screen.getByText('No CSV data')).toBeInTheDocument();
    });
  });

  describe('NoMappingsEmptyState', () => {
    it('should render with preset content', () => {
      render(<NoMappingsEmptyState />);
      expect(screen.getByText('No field mappings')).toBeInTheDocument();
    });
  });

  describe('SearchEmptyState', () => {
    it('should render with preset content', () => {
      render(<SearchEmptyState />);
      expect(screen.getByText('No matches found')).toBeInTheDocument();
    });
  });

  describe('ErrorEmptyState', () => {
    it('should render with preset content', () => {
      render(<ErrorEmptyState />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});

describe('EMPTY_STATE_PRESETS', () => {
  it('should have all required presets', () => {
    expect(EMPTY_STATE_PRESETS).toHaveProperty('no-projects');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('no-steps');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('no-results');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('no-test-runs');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('no-csv');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('no-mappings');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('search-empty');
    expect(EMPTY_STATE_PRESETS).toHaveProperty('error');
  });

  it('each preset should have title and description', () => {
    Object.values(EMPTY_STATE_PRESETS).forEach(preset => {
      expect(preset.title).toBeDefined();
      expect(typeof preset.title).toBe('string');
    });
  });
});

describe('EmptyStateWithIllustration', () => {
  it('should render illustration', () => {
    render(
      <EmptyStateWithIllustration
        title="No data"
        illustration={<div data-testid="illustration">Illustration</div>}
      />
    );
    
    expect(screen.getByTestId('illustration')).toBeInTheDocument();
  });

  it('should render title and description', () => {
    render(
      <EmptyStateWithIllustration
        title="No projects"
        description="Create your first project"
        illustration={<div>Illustration</div>}
      />
    );
    
    expect(screen.getByText('No projects')).toBeInTheDocument();
    expect(screen.getByText('Create your first project')).toBeInTheDocument();
  });

  it('should render action buttons', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    
    render(
      <EmptyStateWithIllustration
        title="No data"
        illustration={<div>Illustration</div>}
        action={{ label: 'Create', onClick }}
      />
    );
    
    await user.click(screen.getByText('Create'));
    expect(onClick).toHaveBeenCalled();
  });
});
