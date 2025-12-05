/**
 * Progress Component Tests
 * @module components/Ui/Progress.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Progress,
  CircularProgress,
  StepProgress,
  SegmentedProgress,
  TestProgress,
  MappingProgress,
  Spinner,
} from './Progress';

// ============================================================================
// PROGRESS TESTS
// ============================================================================

describe('Progress', () => {
  describe('Rendering', () => {
    it('should render progress bar', () => {
      render(<Progress value={50} testId="progress" />);
      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('should render with correct percentage width', () => {
      render(<Progress value={75} testId="progress" />);
      const fill = screen.getByTestId('progress-fill');
      expect(fill).toHaveStyle({ width: '75%' });
    });

    it('should clamp value to 0-100', () => {
      const { rerender } = render(<Progress value={-20} testId="progress" />);
      expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '0%' });

      rerender(<Progress value={150} testId="progress" />);
      expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '100%' });
    });

    it('should respect custom max value', () => {
      render(<Progress value={25} max={50} testId="progress" />);
      expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '50%' });
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'primary', 'success', 'warning', 'error', 'info'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<Progress value={50} variant={variant} testId={`progress-${variant}`} />);
        expect(screen.getByTestId(`progress-${variant}`)).toBeInTheDocument();
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(<Progress value={50} size={size} testId={`progress-${size}`} />);
        expect(screen.getByTestId(`progress-${size}`)).toBeInTheDocument();
      });
    });
  });

  describe('Label and Value', () => {
    it('should show label', () => {
      render(<Progress value={50} label="Loading" testId="progress" />);
      expect(screen.getByTestId('progress-label')).toHaveTextContent('Loading');
    });

    it('should show value when showValue is true', () => {
      render(<Progress value={75} showValue testId="progress" />);
      expect(screen.getByTestId('progress-value')).toHaveTextContent('75%');
    });

    it('should format value with custom formatter', () => {
      render(
        <Progress
          value={30}
          max={60}
          showValue
          formatValue={(v, m) => `${v}/${m} min`}
          testId="progress"
        />
      );
      expect(screen.getByTestId('progress-value')).toHaveTextContent('30/60 min');
    });
  });

  describe('Indeterminate Mode', () => {
    it('should render indeterminate progress', () => {
      render(<Progress value={0} indeterminate testId="progress" />);
      const fill = screen.getByTestId('progress-fill');
      expect(fill).toHaveClass('animate-indeterminate');
    });

    it('should not show value in indeterminate mode', () => {
      render(<Progress value={50} indeterminate showValue testId="progress" />);
      expect(screen.queryByTestId('progress-value')).not.toBeInTheDocument();
    });
  });

  describe('Striped and Animated', () => {
    it('should render striped progress', () => {
      render(<Progress value={50} striped testId="progress" />);
      expect(screen.getByTestId('progress-fill')).toHaveClass('bg-stripes');
    });

    it('should render animated stripes', () => {
      render(<Progress value={50} striped animated testId="progress" />);
      expect(screen.getByTestId('progress-fill')).toHaveClass('animate-stripes');
    });
  });

  describe('Accessibility', () => {
    it('should have progressbar role', () => {
      render(<Progress value={50} testId="progress" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should have aria attributes', () => {
      render(<Progress value={50} max={100} testId="progress" />);
      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '50');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });
});

// ============================================================================
// CIRCULAR PROGRESS TESTS
// ============================================================================

describe('CircularProgress', () => {
  it('should render circular progress', () => {
    render(<CircularProgress value={50} testId="circular" />);
    expect(screen.getByTestId('circular')).toBeInTheDocument();
  });

  it('should show value when showValue is true', () => {
    render(<CircularProgress value={75} showValue testId="circular" />);
    expect(screen.getByTestId('circular-value')).toHaveTextContent('75%');
  });

  it('should render with custom size', () => {
    render(<CircularProgress value={50} size={64} testId="circular" />);
    const container = screen.getByTestId('circular');
    expect(container).toHaveStyle({ width: '64px', height: '64px' });
  });

  it('should render indeterminate mode', () => {
    render(<CircularProgress value={0} indeterminate testId="circular" />);
    const svg = screen.getByTestId('circular').querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
  });
});

// ============================================================================
// STEP PROGRESS TESTS
// ============================================================================

describe('StepProgress', () => {
  it('should render step progress', () => {
    render(<StepProgress current={3} total={10} testId="step-progress" />);
    expect(screen.getByTestId('step-progress')).toBeInTheDocument();
  });

  it('should show step count label', () => {
    render(<StepProgress current={5} total={10} showSteps testId="step-progress" />);
    expect(screen.getByTestId('step-progress-label')).toHaveTextContent('Step 5 of 10');
  });

  it('should show percentage', () => {
    render(<StepProgress current={5} total={10} showSteps testId="step-progress" />);
    expect(screen.getByTestId('step-progress-percentage')).toHaveTextContent('50%');
  });

  it('should format label with custom formatter', () => {
    render(
      <StepProgress
        current={3}
        total={10}
        showSteps
        formatLabel={(c, t) => `Processing ${c}/${t}`}
        testId="step-progress"
      />
    );
    expect(screen.getByTestId('step-progress-label')).toHaveTextContent('Processing 3/10');
  });

  it('should clamp current to valid range', () => {
    render(<StepProgress current={15} total={10} showSteps testId="step-progress" />);
    expect(screen.getByTestId('step-progress-percentage')).toHaveTextContent('100%');
  });
});

// ============================================================================
// SEGMENTED PROGRESS TESTS
// ============================================================================

describe('SegmentedProgress', () => {
  const segments = [
    { value: 5, variant: 'success' as const, label: 'Passed' },
    { value: 2, variant: 'error' as const, label: 'Failed' },
  ];

  it('should render segmented progress', () => {
    render(<SegmentedProgress segments={segments} total={10} testId="segmented" />);
    expect(screen.getByTestId('segmented')).toBeInTheDocument();
  });

  it('should render all segments', () => {
    render(<SegmentedProgress segments={segments} total={10} testId="segmented" />);
    expect(screen.getByTestId('segmented-segment-0')).toBeInTheDocument();
    expect(screen.getByTestId('segmented-segment-1')).toBeInTheDocument();
  });

  it('should show legend when showLegend is true', () => {
    render(<SegmentedProgress segments={segments} total={10} showLegend testId="segmented" />);
    expect(screen.getByTestId('segmented-legend')).toBeInTheDocument();
    expect(screen.getByText('Passed: 5')).toBeInTheDocument();
    expect(screen.getByText('Failed: 2')).toBeInTheDocument();
  });
});

// ============================================================================
// TEST PROGRESS TESTS
// ============================================================================

describe('TestProgress', () => {
  it('should render test progress', () => {
    render(<TestProgress passed={5} failed={2} total={10} testId="test-progress" />);
    expect(screen.getByTestId('test-progress')).toBeInTheDocument();
  });

  it('should show passed and failed counts', () => {
    render(<TestProgress passed={5} failed={2} total={10} testId="test-progress" />);
    expect(screen.getByTestId('test-progress-passed')).toHaveTextContent('5 passed');
    expect(screen.getByTestId('test-progress-failed')).toHaveTextContent('2 failed');
  });

  it('should show elapsed time', () => {
    render(
      <TestProgress passed={5} failed={0} total={10} elapsedTime={65000} testId="test-progress" />
    );
    expect(screen.getByTestId('test-progress-elapsed')).toHaveTextContent('Elapsed: 1:05');
  });

  it('should show current step', () => {
    render(
      <TestProgress passed={2} failed={0} total={10} currentStep={2} testId="test-progress" />
    );
    expect(screen.getByTestId('test-progress-current')).toHaveTextContent('Running step 3...');
  });

  it('should calculate estimated remaining time', () => {
    render(
      <TestProgress
        passed={5}
        failed={0}
        total={10}
        elapsedTime={50000}
        testId="test-progress"
      />
    );
    // 5 steps in 50s = 10s/step, 5 remaining = ~50s
    expect(screen.getByTestId('test-progress-remaining')).toHaveTextContent('~0:50 remaining');
  });

  it('should hide details when showDetails is false', () => {
    render(
      <TestProgress passed={5} failed={2} total={10} showDetails={false} testId="test-progress" />
    );
    expect(screen.queryByTestId('test-progress-passed')).not.toBeInTheDocument();
  });
});

// ============================================================================
// MAPPING PROGRESS TESTS
// ============================================================================

describe('MappingProgress', () => {
  it('should render mapping progress', () => {
    render(<MappingProgress mapped={5} total={10} testId="mapping" />);
    expect(screen.getByTestId('mapping')).toBeInTheDocument();
  });

  it('should show mapped count', () => {
    render(<MappingProgress mapped={5} total={10} testId="mapping" />);
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('should show success variant when complete', () => {
    render(<MappingProgress mapped={10} total={10} testId="mapping" />);
    expect(screen.getByText('10/10')).toHaveClass('text-green-600');
  });
});

// ============================================================================
// SPINNER TESTS
// ============================================================================

describe('Spinner', () => {
  it('should render spinner', () => {
    render(<Spinner testId="spinner" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should render with custom size', () => {
    render(<Spinner size={32} testId="spinner" />);
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveAttribute('width', '32');
    expect(spinner).toHaveAttribute('height', '32');
  });

  it('should have spin animation', () => {
    render(<Spinner testId="spinner" />);
    expect(screen.getByTestId('spinner')).toHaveClass('animate-spin');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle zero total', () => {
    render(<StepProgress current={0} total={0} testId="step-progress" />);
    expect(screen.getByTestId('step-progress-percentage')).toHaveTextContent('0%');
  });

  it('should handle ref forwarding', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Progress ref={ref} value={50} testId="progress" />);
    expect(ref.current).toBe(screen.getByTestId('progress'));
  });

  it('should handle className prop', () => {
    render(<Progress value={50} className="custom-class" testId="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('custom-class');
  });

  it('should handle empty segments', () => {
    render(<SegmentedProgress segments={[]} total={0} testId="segmented" />);
    expect(screen.getByTestId('segmented')).toBeInTheDocument();
  });
});
