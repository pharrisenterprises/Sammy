/**
 * Badge Component Tests
 * @module components/Ui/Badge.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Badge,
  StatusBadge,
  ProjectStatusBadge,
  EventBadge,
  CountBadge,
  BadgeGroup,
  RemovableBadge,
  DurationBadge,
} from './Badge';

// ============================================================================
// BADGE TESTS
// ============================================================================

describe('Badge', () => {
  describe('Rendering', () => {
    it('should render badge with text', () => {
      render(<Badge testId="badge">Label</Badge>);
      expect(screen.getByTestId('badge')).toHaveTextContent('Label');
    });

    it('should render with default variant', () => {
      render(<Badge testId="badge">Label</Badge>);
      expect(screen.getByTestId('badge')).toHaveClass('bg-gray-100');
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'primary', 'secondary', 'success', 'warning', 'error', 'info', 'outline'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<Badge variant={variant} testId={`badge-${variant}`}>Label</Badge>);
        expect(screen.getByTestId(`badge-${variant}`)).toBeInTheDocument();
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(<Badge size={size} testId={`badge-${size}`}>Label</Badge>);
        expect(screen.getByTestId(`badge-${size}`)).toBeInTheDocument();
      });
    });
  });

  describe('Icon', () => {
    it('should render with icon before text', () => {
      render(
        <Badge icon={<span data-testid="icon">🔔</span>} testId="badge">
          Label
        </Badge>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
    });

    it('should render with icon after text', () => {
      render(
        <Badge iconAfter={<span data-testid="icon-after">→</span>} testId="badge">
          Label
        </Badge>
      );
      expect(screen.getByTestId('icon-after')).toBeInTheDocument();
      expect(screen.getByTestId('badge-icon-after')).toBeInTheDocument();
    });
  });

  describe('Pill Style', () => {
    it('should render with pill style', () => {
      render(<Badge pill testId="badge">Label</Badge>);
      expect(screen.getByTestId('badge')).toHaveClass('rounded-full');
    });

    it('should render with rounded-md by default', () => {
      render(<Badge testId="badge">Label</Badge>);
      expect(screen.getByTestId('badge')).toHaveClass('rounded-md');
    });
  });

  describe('Dot Style', () => {
    it('should render dot indicator', () => {
      render(<Badge dot testId="badge">Label</Badge>);
      expect(screen.getByTestId('badge-dot')).toBeInTheDocument();
    });

    it('should not render icon when dot is true', () => {
      render(
        <Badge dot icon={<span data-testid="icon">🔔</span>} testId="badge">
          Label
        </Badge>
      );
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    });
  });

  describe('Pulse Animation', () => {
    it('should render with pulse animation', () => {
      render(<Badge pulse testId="badge">Label</Badge>);
      expect(screen.getByTestId('badge')).toHaveClass('animate-pulse');
    });
  });
});

// ============================================================================
// STATUS BADGE TESTS
// ============================================================================

describe('StatusBadge', () => {
  const statuses = ['pending', 'running', 'passed', 'failed', 'skipped'] as const;

  statuses.forEach((status) => {
    it(`should render ${status} status`, () => {
      render(<StatusBadge status={status} testId={`status-${status}`} />);
      expect(screen.getByTestId(`status-${status}`)).toBeInTheDocument();
    });
  });

  it('should show icon by default', () => {
    render(<StatusBadge status="passed" testId="status" />);
    expect(screen.getByTestId('status-icon')).toBeInTheDocument();
  });

  it('should hide icon when showIcon is false', () => {
    render(<StatusBadge status="passed" showIcon={false} testId="status" />);
    expect(screen.queryByTestId('status-icon')).not.toBeInTheDocument();
  });

  it('should show correct labels', () => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      running: 'Running',
      passed: 'Passed',
      failed: 'Failed',
      skipped: 'Skipped',
    };

    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} testId="status" />);
      expect(screen.getByTestId('status')).toHaveTextContent(labels[status]);
      unmount();
    });
  });

  it('should pulse when running', () => {
    render(<StatusBadge status="running" testId="status" />);
    expect(screen.getByTestId('status')).toHaveClass('animate-pulse');
  });
});

// ============================================================================
// PROJECT STATUS BADGE TESTS
// ============================================================================

describe('ProjectStatusBadge', () => {
  const statuses = ['draft', 'testing', 'complete'] as const;

  statuses.forEach((status) => {
    it(`should render ${status} status`, () => {
      render(<ProjectStatusBadge status={status} testId={`project-${status}`} />);
      expect(screen.getByTestId(`project-${status}`)).toBeInTheDocument();
    });
  });

  it('should show correct labels', () => {
    const labels: Record<string, string> = {
      draft: 'Draft',
      testing: 'Testing',
      complete: 'Complete',
    };

    statuses.forEach((status) => {
      const { unmount } = render(<ProjectStatusBadge status={status} testId="status" />);
      expect(screen.getByTestId('status')).toHaveTextContent(labels[status]);
      unmount();
    });
  });
});

// ============================================================================
// EVENT BADGE TESTS
// ============================================================================

describe('EventBadge', () => {
  const events = ['click', 'input', 'enter', 'open', 'navigate', 'wait'] as const;

  events.forEach((event) => {
    it(`should render ${event} event`, () => {
      render(<EventBadge event={event} testId={`event-${event}`} />);
      expect(screen.getByTestId(`event-${event}`)).toBeInTheDocument();
    });
  });

  it('should show correct labels', () => {
    const labels: Record<string, string> = {
      click: 'Click',
      input: 'Input',
      enter: 'Enter',
      open: 'Open',
      navigate: 'Navigate',
      wait: 'Wait',
    };

    events.forEach((event) => {
      const { unmount } = render(<EventBadge event={event} testId="event" />);
      expect(screen.getByTestId('event')).toHaveTextContent(labels[event]);
      unmount();
    });
  });

  it('should show icon', () => {
    render(<EventBadge event="click" testId="event" />);
    expect(screen.getByTestId('event-icon')).toBeInTheDocument();
  });

  it('should be pill shaped', () => {
    render(<EventBadge event="click" testId="event" />);
    expect(screen.getByTestId('event')).toHaveClass('rounded-full');
  });
});

// ============================================================================
// COUNT BADGE TESTS
// ============================================================================

describe('CountBadge', () => {
  it('should render count', () => {
    render(<CountBadge count={5} testId="count" />);
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });

  it('should show max+ when over max', () => {
    render(<CountBadge count={150} max={99} testId="count" />);
    expect(screen.getByTestId('count')).toHaveTextContent('99+');
  });

  it('should show exact count when under max', () => {
    render(<CountBadge count={50} max={99} testId="count" />);
    expect(screen.getByTestId('count')).toHaveTextContent('50');
  });

  it('should use custom max', () => {
    render(<CountBadge count={15} max={10} testId="count" />);
    expect(screen.getByTestId('count')).toHaveTextContent('10+');
  });

  it('should be pill shaped', () => {
    render(<CountBadge count={5} testId="count" />);
    expect(screen.getByTestId('count')).toHaveClass('rounded-full');
  });
});

// ============================================================================
// BADGE GROUP TESTS
// ============================================================================

describe('BadgeGroup', () => {
  it('should render badge group', () => {
    render(
      <BadgeGroup testId="group">
        <Badge>One</Badge>
        <Badge>Two</Badge>
      </BadgeGroup>
    );
    expect(screen.getByTestId('group')).toBeInTheDocument();
  });

  it('should apply gap class', () => {
    render(
      <BadgeGroup gap="md" testId="group">
        <Badge>One</Badge>
      </BadgeGroup>
    );
    expect(screen.getByTestId('group')).toHaveClass('gap-2');
  });
});

// ============================================================================
// REMOVABLE BADGE TESTS
// ============================================================================

describe('RemovableBadge', () => {
  it('should render removable badge', () => {
    render(<RemovableBadge onRemove={() => {}} testId="removable">Label</RemovableBadge>);
    expect(screen.getByTestId('removable')).toBeInTheDocument();
  });

  it('should call onRemove when remove button clicked', async () => {
    const onRemove = vi.fn();
    render(<RemovableBadge onRemove={onRemove} testId="removable">Label</RemovableBadge>);

    await userEvent.click(screen.getByTestId('removable-remove'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('should have aria-label on remove button', () => {
    render(
      <RemovableBadge onRemove={() => {}} removeLabel="Delete tag" testId="removable">
        Label
      </RemovableBadge>
    );
    expect(screen.getByLabelText('Delete tag')).toBeInTheDocument();
  });
});

// ============================================================================
// DURATION BADGE TESTS
// ============================================================================

describe('DurationBadge', () => {
  it('should render duration in ms', () => {
    render(<DurationBadge duration={500} testId="duration" />);
    expect(screen.getByTestId('duration')).toHaveTextContent('500ms');
  });

  it('should render duration in seconds', () => {
    render(<DurationBadge duration={2500} testId="duration" />);
    expect(screen.getByTestId('duration')).toHaveTextContent('2.5s');
  });

  it('should render duration in minutes', () => {
    render(<DurationBadge duration={125000} testId="duration" />);
    expect(screen.getByTestId('duration')).toHaveTextContent('2:05');
  });

  it('should show warning variant when slow', () => {
    render(<DurationBadge duration={3000} slowThreshold={2000} testId="duration" />);
    expect(screen.getByTestId('duration')).toHaveClass('bg-yellow-100');
  });

  it('should not auto-variant when disabled', () => {
    render(<DurationBadge duration={5000} autoVariant={false} testId="duration" />);
    expect(screen.getByTestId('duration')).toHaveClass('bg-gray-100');
  });

  it('should show clock icon', () => {
    render(<DurationBadge duration={1000} testId="duration" />);
    expect(screen.getByTestId('duration-icon')).toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should forward ref', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Badge ref={ref} testId="badge">Label</Badge>);
    expect(ref.current).toBe(screen.getByTestId('badge'));
  });

  it('should handle className prop', () => {
    render(<Badge className="custom-class" testId="badge">Label</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('custom-class');
  });

  it('should pass through additional props', () => {
    render(<Badge data-custom="value" testId="badge">Label</Badge>);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-custom', 'value');
  });

  it('should handle empty children', () => {
    render(<Badge testId="badge" />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('should handle zero count', () => {
    render(<CountBadge count={0} testId="count" />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('should handle zero duration', () => {
    render(<DurationBadge duration={0} testId="duration" />);
    expect(screen.getByTestId('duration')).toHaveTextContent('0ms');
  });
});
