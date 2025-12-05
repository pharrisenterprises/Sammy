/**
 * Card Component Tests
 * @module components/Ui/Card.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardImage,
  CardBadge,
  StatsCard,
  ProjectCard,
  StatusCard,
} from './Card';

// ============================================================================
// CARD TESTS
// ============================================================================

describe('Card', () => {
  describe('Rendering', () => {
    it('should render card with children', () => {
      render(<Card testId="my-card">Card content</Card>);
      expect(screen.getByTestId('my-card')).toHaveTextContent('Card content');
    });

    it('should render with custom testId', () => {
      render(<Card testId="custom-card">Content</Card>);
      expect(screen.getByTestId('custom-card')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'outlined', 'elevated', 'ghost', 'filled'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<Card variant={variant} testId={`card-${variant}`}>Content</Card>);
        expect(screen.getByTestId(`card-${variant}`)).toHaveAttribute('data-variant', variant);
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(
          <Card size={size} testId="card">
            <CardContent>Content</CardContent>
          </Card>
        );
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });
    });
  });

  describe('Status', () => {
    const statuses = ['default', 'success', 'warning', 'error', 'info', 'draft', 'testing', 'complete'] as const;

    statuses.forEach((status) => {
      it(`should render ${status} status`, () => {
        render(<Card status={status} testId={`card-${status}`}>Content</Card>);
        expect(screen.getByTestId(`card-${status}`)).toHaveAttribute('data-status', status);
      });
    });
  });

  describe('Interactive States', () => {
    it('should render hoverable card', () => {
      render(<Card hoverable testId="card">Content</Card>);
      expect(screen.getByTestId('card')).toHaveClass('hover:shadow-md');
    });

    it('should render clickable card', () => {
      render(<Card clickable testId="card">Content</Card>);
      expect(screen.getByTestId('card')).toHaveClass('cursor-pointer');
    });

    it('should render selected card', () => {
      render(<Card selected testId="card">Content</Card>);
      expect(screen.getByTestId('card')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('card')).toHaveClass('ring-2');
    });

    it('should render disabled card', () => {
      render(<Card disabled testId="card">Content</Card>);
      expect(screen.getByTestId('card')).toHaveAttribute('data-disabled', 'true');
      expect(screen.getByTestId('card')).toHaveClass('opacity-50');
    });

    it('should call onClick when clicked', async () => {
      const onClick = vi.fn();
      render(<Card onClick={onClick} testId="card">Content</Card>);
      
      await userEvent.click(screen.getByTestId('card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const onClick = vi.fn();
      render(<Card disabled onClick={onClick} testId="card">Content</Card>);
      
      await userEvent.click(screen.getByTestId('card'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Full Width', () => {
    it('should render full width card', () => {
      render(<Card fullWidth testId="card">Content</Card>);
      expect(screen.getByTestId('card')).toHaveClass('w-full');
    });
  });
});

// ============================================================================
// CARD HEADER TESTS
// ============================================================================

describe('CardHeader', () => {
  it('should render header with children', () => {
    render(
      <Card>
        <CardHeader testId="header">Header content</CardHeader>
      </Card>
    );
    expect(screen.getByTestId('header')).toHaveTextContent('Header content');
  });

  it('should render actions slot', () => {
    render(
      <Card>
        <CardHeader actions={<button>Action</button>} testId="header">
          Title
        </CardHeader>
      </Card>
    );
    expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Action');
  });
});

// ============================================================================
// CARD TITLE TESTS
// ============================================================================

describe('CardTitle', () => {
  it('should render title as h3 by default', () => {
    render(
      <Card>
        <CardTitle testId="title">My Title</CardTitle>
      </Card>
    );
    expect(screen.getByTestId('title').tagName).toBe('H3');
    expect(screen.getByTestId('title')).toHaveTextContent('My Title');
  });

  it('should render with custom heading level', () => {
    render(
      <Card>
        <CardTitle as="h1" testId="title">My Title</CardTitle>
      </Card>
    );
    expect(screen.getByTestId('title').tagName).toBe('H1');
  });
});

// ============================================================================
// CARD DESCRIPTION TESTS
// ============================================================================

describe('CardDescription', () => {
  it('should render description', () => {
    render(
      <Card>
        <CardDescription testId="desc">My description</CardDescription>
      </Card>
    );
    expect(screen.getByTestId('desc')).toHaveTextContent('My description');
  });

  it('should truncate text', () => {
    render(
      <Card>
        <CardDescription truncate testId="desc">Long text</CardDescription>
      </Card>
    );
    expect(screen.getByTestId('desc')).toHaveClass('truncate');
  });
});

// ============================================================================
// CARD CONTENT TESTS
// ============================================================================

describe('CardContent', () => {
  it('should render content', () => {
    render(
      <Card>
        <CardContent testId="content">Main content</CardContent>
      </Card>
    );
    expect(screen.getByTestId('content')).toHaveTextContent('Main content');
  });

  it('should render without padding', () => {
    render(
      <Card>
        <CardContent noPadding testId="content">Content</CardContent>
      </Card>
    );
    const content = screen.getByTestId('content');
    expect(content).not.toHaveClass('px-4');
    expect(content).not.toHaveClass('py-4');
  });
});

// ============================================================================
// CARD FOOTER TESTS
// ============================================================================

describe('CardFooter', () => {
  it('should render footer', () => {
    render(
      <Card>
        <CardFooter testId="footer">Footer content</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('footer')).toHaveTextContent('Footer content');
  });

  it('should align content to right by default', () => {
    render(
      <Card>
        <CardFooter testId="footer">Footer</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('footer')).toHaveClass('justify-end');
  });

  it('should align content to left', () => {
    render(
      <Card>
        <CardFooter align="left" testId="footer">Footer</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('footer')).toHaveClass('justify-start');
  });

  it('should align content between', () => {
    render(
      <Card>
        <CardFooter align="between" testId="footer">Footer</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('footer')).toHaveClass('justify-between');
  });

  it('should render with border', () => {
    render(
      <Card>
        <CardFooter bordered testId="footer">Footer</CardFooter>
      </Card>
    );
    expect(screen.getByTestId('footer')).toHaveClass('border-t');
  });
});

// ============================================================================
// CARD IMAGE TESTS
// ============================================================================

describe('CardImage', () => {
  it('should render image', () => {
    render(
      <Card>
        <CardImage src="/test.jpg" alt="Test" testId="image" />
      </Card>
    );
    expect(screen.getByTestId('image')).toHaveAttribute('src', '/test.jpg');
    expect(screen.getByTestId('image')).toHaveAttribute('alt', 'Test');
  });

  it('should render with aspect ratio', () => {
    render(
      <Card>
        <CardImage src="/test.jpg" alt="Test" aspectRatio="16/9" testId="image" />
      </Card>
    );
    expect(screen.getByTestId('image-container')).toHaveClass('aspect-video');
  });
});

// ============================================================================
// CARD BADGE TESTS
// ============================================================================

describe('CardBadge', () => {
  it('should render badge', () => {
    render(
      <Card className="relative">
        <CardBadge testId="badge">New</CardBadge>
      </Card>
    );
    expect(screen.getByTestId('badge')).toHaveTextContent('New');
  });

  it('should render with variant', () => {
    render(
      <Card className="relative">
        <CardBadge variant="success" testId="badge">Success</CardBadge>
      </Card>
    );
    expect(screen.getByTestId('badge')).toHaveClass('bg-green-100');
  });

  it('should position badge', () => {
    render(
      <Card className="relative">
        <CardBadge position="top-left" testId="badge">Badge</CardBadge>
      </Card>
    );
    expect(screen.getByTestId('badge')).toHaveClass('top-2', 'left-2');
  });
});

// ============================================================================
// STATS CARD TESTS
// ============================================================================

describe('StatsCard', () => {
  it('should render stats card', () => {
    render(<StatsCard title="Total Projects" value={42} testId="stats" />);
    
    expect(screen.getByTestId('stats')).toBeInTheDocument();
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render with change indicator', () => {
    render(
      <StatsCard
        title="Revenue"
        value="$1,234"
        change="+12%"
        changeType="increase"
        testId="stats"
      />
    );
    
    expect(screen.getByText('+12%', { exact: false })).toBeInTheDocument();
  });

  it('should render with icon', () => {
    render(
      <StatsCard
        title="Projects"
        value={10}
        icon={<span data-testid="icon">📊</span>}
        testId="stats"
      />
    );
    
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});

// ============================================================================
// PROJECT CARD TESTS
// ============================================================================

describe('ProjectCard', () => {
  const defaultProps = {
    id: '123',
    name: 'Test Project',
    description: 'A test project description',
    status: 'draft' as const,
  };

  it('should render project card', () => {
    render(<ProjectCard {...defaultProps} testId="project" />);
    
    expect(screen.getByTestId('project')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('A test project description')).toBeInTheDocument();
  });

  it('should render with status badge', () => {
    render(<ProjectCard {...defaultProps} status="testing" testId="project" />);
    expect(screen.getByText('Testing')).toBeInTheDocument();
  });

  it('should render with dates', () => {
    render(
      <ProjectCard
        {...defaultProps}
        createdDate="2024-01-01"
        updatedDate="2024-01-15"
        testId="project"
      />
    );
    
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('should call onClick', async () => {
    const onClick = vi.fn();
    render(<ProjectCard {...defaultProps} onClick={onClick} testId="project" />);
    
    await userEvent.click(screen.getByTestId('project'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should render actions', () => {
    render(
      <ProjectCard
        {...defaultProps}
        actions={<button data-testid="action-btn">Edit</button>}
        testId="project"
      />
    );
    
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });
});

// ============================================================================
// STATUS CARD TESTS
// ============================================================================

describe('StatusCard', () => {
  it('should render status card', () => {
    render(<StatusCard title="Test Status" status="idle" testId="status" />);
    
    expect(screen.getByTestId('status')).toBeInTheDocument();
    expect(screen.getByText('Test Status')).toBeInTheDocument();
  });

  it('should render with value', () => {
    render(<StatusCard title="Progress" status="running" value="50%" testId="status" />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render with subtitle', () => {
    render(
      <StatusCard
        title="Status"
        status="success"
        subtitle="Completed 5 minutes ago"
        testId="status"
      />
    );
    expect(screen.getByText('Completed 5 minutes ago')).toBeInTheDocument();
  });

  const statuses = ['idle', 'running', 'success', 'error', 'paused'] as const;

  statuses.forEach((status) => {
    it(`should render ${status} status style`, () => {
      render(<StatusCard title="Test" status={status} testId={`status-${status}`} />);
      expect(screen.getByTestId(`status-${status}`)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// COMPOUND COMPONENT TESTS
// ============================================================================

describe('Compound Components', () => {
  it('should render full card structure', () => {
    render(
      <Card testId="card">
        <CardHeader testId="header">
          <CardTitle testId="title">Title</CardTitle>
          <CardDescription testId="desc">Description</CardDescription>
        </CardHeader>
        <CardContent testId="content">Content here</CardContent>
        <CardFooter testId="footer">
          <button>Action</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toBeInTheDocument();
    expect(screen.getByTestId('desc')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should forward refs', () => {
    const cardRef = React.createRef<HTMLDivElement>();
    const headerRef = React.createRef<HTMLDivElement>();
    const contentRef = React.createRef<HTMLDivElement>();

    render(
      <Card ref={cardRef} testId="card">
        <CardHeader ref={headerRef} testId="header">Header</CardHeader>
        <CardContent ref={contentRef} testId="content">Content</CardContent>
      </Card>
    );

    expect(cardRef.current).toBe(screen.getByTestId('card'));
    expect(headerRef.current).toBe(screen.getByTestId('header'));
    expect(contentRef.current).toBe(screen.getByTestId('content'));
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty children', () => {
    render(<Card testId="card" />);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should handle className prop', () => {
    render(<Card className="custom-class" testId="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('custom-class');
  });

  it('should handle multiple statuses (last wins)', () => {
    render(<Card status="success" testId="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveAttribute('data-status', 'success');
  });
});
