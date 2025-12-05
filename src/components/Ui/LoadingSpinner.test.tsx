/**
 * Tests for LoadingSpinner component
 * @module components/Ui/LoadingSpinner.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LoadingSpinner,
  LoadingOverlay,
  FullPageLoader,
  InlineSpinner,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  type SpinnerVariant,
  type SpinnerSize,
} from './LoadingSpinner';

// ============================================================================
// TESTS
// ============================================================================

describe('LoadingSpinner', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should render spinner variant by default', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('loading-spinner-circle')).toBeInTheDocument();
    });

    it('should render label', () => {
      render(<LoadingSpinner label="Loading data..." />);
      expect(screen.getByTestId('loading-spinner-label')).toHaveTextContent('Loading data...');
    });

    it('should hide label when showLabel is false', () => {
      render(<LoadingSpinner label="Loading data..." showLabel={false} />);
      expect(screen.queryByTestId('loading-spinner-label')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<LoadingSpinner className="custom-class" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('custom-class');
    });

    it('should have accessibility attributes', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner).toHaveAttribute('aria-busy', 'true');
    });

    it('should have screen reader text', () => {
      render(<LoadingSpinner />);
      expect(screen.getByText('Loading...')).toHaveClass('sr-only');
    });
  });

  describe('variants', () => {
    it.each<SpinnerVariant>(['spinner', 'dots', 'pulse', 'bar'])(
      'should render %s variant',
      (variant) => {
        render(<LoadingSpinner variant={variant} />);
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      }
    );

    it('should render dots variant', () => {
      render(<LoadingSpinner variant="dots" />);
      expect(screen.getByTestId('loading-spinner-dots')).toBeInTheDocument();
    });

    it('should render pulse variant', () => {
      render(<LoadingSpinner variant="pulse" />);
      expect(screen.getByTestId('loading-spinner-pulse')).toBeInTheDocument();
    });

    it('should render bar variant', () => {
      render(<LoadingSpinner variant="bar" />);
      expect(screen.getByTestId('loading-spinner-bar')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it.each<SpinnerSize>(['xs', 'sm', 'md', 'lg', 'xl'])(
      'should render %s size',
      (size) => {
        render(<LoadingSpinner size={size} />);
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      }
    );
  });
});

describe('LoadingOverlay', () => {
  it('should render children', () => {
    render(
      <LoadingOverlay isLoading={false}>
        <div data-testid="content">Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should show overlay when loading', () => {
    render(
      <LoadingOverlay isLoading={true}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('loading-overlay-backdrop')).toBeInTheDocument();
  });

  it('should hide overlay when not loading', () => {
    render(
      <LoadingOverlay isLoading={false}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.queryByTestId('loading-overlay-backdrop')).not.toBeInTheDocument();
  });

  it('should show spinner in overlay', () => {
    render(
      <LoadingOverlay isLoading={true}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('loading-overlay-spinner')).toBeInTheDocument();
  });

  it('should show label in overlay', () => {
    render(
      <LoadingOverlay isLoading={true} label="Please wait...">
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('loading-overlay-spinner-label')).toHaveTextContent('Please wait...');
  });

  it('should apply blur when blur prop is true', () => {
    render(
      <LoadingOverlay isLoading={true} blur={true}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('loading-overlay-backdrop')).toHaveClass('backdrop-blur-sm');
  });

  it('should not apply blur when blur prop is false', () => {
    render(
      <LoadingOverlay isLoading={true} blur={false}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByTestId('loading-overlay-backdrop')).not.toHaveClass('backdrop-blur-sm');
  });
});

describe('FullPageLoader', () => {
  it('should render full page loader', () => {
    render(<FullPageLoader />);
    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument();
  });

  it('should render with default label', () => {
    render(<FullPageLoader />);
    expect(screen.getByTestId('full-page-loader-spinner-label')).toHaveTextContent('Loading...');
  });

  it('should render with custom label', () => {
    render(<FullPageLoader label="Initializing..." />);
    expect(screen.getByTestId('full-page-loader-spinner-label')).toHaveTextContent('Initializing...');
  });

  it('should be fixed positioned', () => {
    render(<FullPageLoader />);
    expect(screen.getByTestId('full-page-loader')).toHaveClass('fixed', 'inset-0');
  });
});

describe('InlineSpinner', () => {
  it('should render inline spinner', () => {
    render(<InlineSpinner />);
    expect(screen.getByTestId('inline-spinner')).toBeInTheDocument();
  });

  it.each(['xs', 'sm'] as const)('should render %s size', (size) => {
    render(<InlineSpinner size={size} />);
    expect(screen.getByTestId('inline-spinner')).toBeInTheDocument();
  });

  it('should apply custom color', () => {
    render(<InlineSpinner color="text-white" />);
    expect(screen.getByTestId('inline-spinner')).toHaveClass('text-white');
  });
});

describe('Skeleton', () => {
  it('should render skeleton', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('should apply width and height', () => {
    render(<Skeleton width={200} height={50} />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveStyle({ width: '200px', height: '50px' });
  });

  it('should apply string dimensions', () => {
    render(<Skeleton width="50%" height="2rem" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveStyle({ width: '50%', height: '2rem' });
  });

  it.each(['none', 'sm', 'md', 'lg', 'full'] as const)(
    'should apply %s rounded',
    (rounded) => {
      render(<Skeleton rounded={rounded} testId={`skeleton-${rounded}`} />);
      expect(screen.getByTestId(`skeleton-${rounded}`)).toBeInTheDocument();
    }
  );

  it('should have animate-pulse class', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse');
  });
});

describe('SkeletonText', () => {
  it('should render skeleton text', () => {
    render(<SkeletonText />);
    expect(screen.getByTestId('skeleton-text')).toBeInTheDocument();
  });

  it('should render correct number of lines', () => {
    render(<SkeletonText lines={4} />);
    expect(screen.getByTestId('skeleton-text-line-0')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-text-line-3')).toBeInTheDocument();
  });

  it('should apply last line width', () => {
    render(<SkeletonText lines={2} lastLineWidth="50%" />);
    const lastLine = screen.getByTestId('skeleton-text-line-1');
    expect(lastLine).toHaveStyle({ width: '50%' });
  });
});

describe('SkeletonCard', () => {
  it('should render skeleton card', () => {
    render(<SkeletonCard />);
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
  });

  it('should show image placeholder by default', () => {
    render(<SkeletonCard />);
    const card = screen.getByTestId('skeleton-card');
    expect(card.querySelector('[data-testid="skeleton"]')).toBeInTheDocument();
  });

  it('should hide image when showImage is false', () => {
    render(<SkeletonCard showImage={false} showTitle={false} showDescription={false} />);
    const card = screen.getByTestId('skeleton-card');
    expect(card.querySelectorAll('[data-testid^="skeleton"]').length).toBe(0);
  });

  it('should show actions when showActions is true', () => {
    render(<SkeletonCard showActions={true} />);
    const card = screen.getByTestId('skeleton-card');
    // Should have at least 2 action skeletons
    expect(card.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThanOrEqual(2);
  });
});
