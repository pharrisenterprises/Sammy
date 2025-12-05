/**
 * Tests for ProgressBar component
 * @module components/Ui/ProgressBar.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ProgressBar,
  CircularProgress,
  StepProgress,
  TestProgress,
  calculatePercentage,
  formatPercentage,
  getColorByPercentage,
  type ProgressSize,
  type ProgressColor,
  type ProgressVariant,
} from './ProgressBar';

// ============================================================================
// TESTS
// ============================================================================

describe('ProgressBar', () => {
  describe('rendering', () => {
    it('should render progress bar', () => {
      render(<ProgressBar value={50} />);
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('should render track and bar', () => {
      render(<ProgressBar value={50} />);
      expect(screen.getByTestId('progress-bar-track')).toBeInTheDocument();
      expect(screen.getByTestId('progress-bar-bar')).toBeInTheDocument();
    });

    it('should calculate correct width', () => {
      render(<ProgressBar value={75} max={100} />);
      const bar = screen.getByTestId('progress-bar-bar');
      expect(bar).toHaveStyle({ width: '75%' });
    });

    it('should apply custom className', () => {
      render(<ProgressBar value={50} className="custom-class" />);
      expect(screen.getByTestId('progress-bar')).toHaveClass('custom-class');
    });
  });

  describe('sizes', () => {
    it.each<ProgressSize>(['xs', 'sm', 'md', 'lg', 'xl'])(
      'should render %s size',
      (size) => {
        render(<ProgressBar value={50} size={size} />);
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      }
    );
  });

  describe('colors', () => {
    it.each<ProgressColor>(['blue', 'green', 'red', 'yellow', 'purple', 'gray'])(
      'should render %s color',
      (color) => {
        render(<ProgressBar value={50} color={color} />);
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      }
    );
  });

  describe('variants', () => {
    it.each<ProgressVariant>(['default', 'striped', 'gradient'])(
      'should render %s variant',
      (variant) => {
        render(<ProgressBar value={50} variant={variant} />);
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      }
    );
  });

  describe('label and value', () => {
    it('should show label when showLabel is true', () => {
      render(<ProgressBar value={50} showLabel label="Loading" />);
      expect(screen.getByTestId('progress-bar-label')).toHaveTextContent('Loading');
    });

    it('should show value when showValue is true', () => {
      render(<ProgressBar value={50} showValue />);
      expect(screen.getByTestId('progress-bar-value')).toHaveTextContent('50%');
    });

    it('should show "Loading..." for indeterminate', () => {
      render(<ProgressBar value={50} showValue indeterminate />);
      expect(screen.getByTestId('progress-bar-value')).toHaveTextContent('Loading...');
    });
  });

  describe('indeterminate state', () => {
    it('should apply indeterminate animation class', () => {
      render(<ProgressBar value={0} indeterminate />);
      const bar = screen.getByTestId('progress-bar-bar');
      expect(bar).toHaveClass('animate-indeterminate');
    });
  });

  describe('accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<ProgressBar value={50} max={100} />);
      const track = screen.getByTestId('progress-bar-track');
      expect(track).toHaveAttribute('role', 'progressbar');
      expect(track).toHaveAttribute('aria-valuenow', '50');
      expect(track).toHaveAttribute('aria-valuemin', '0');
      expect(track).toHaveAttribute('aria-valuemax', '100');
    });
  });
});

describe('CircularProgress', () => {
  it('should render circular progress', () => {
    render(<CircularProgress value={50} />);
    expect(screen.getByTestId('circular-progress')).toBeInTheDocument();
  });

  it('should show value by default', () => {
    render(<CircularProgress value={50} />);
    expect(screen.getByTestId('circular-progress-value')).toHaveTextContent('50%');
  });

  it('should hide value when showValue is false', () => {
    render(<CircularProgress value={50} showValue={false} />);
    expect(screen.queryByTestId('circular-progress-value')).not.toBeInTheDocument();
  });

  it('should show label when provided', () => {
    render(<CircularProgress value={50} label="Upload" size="lg" />);
    expect(screen.getByTestId('circular-progress-label')).toHaveTextContent('Upload');
  });

  it.each<ProgressSize>(['xs', 'sm', 'md', 'lg', 'xl'])(
    'should render %s size',
    (size) => {
      render(<CircularProgress value={50} size={size} />);
      expect(screen.getByTestId('circular-progress')).toBeInTheDocument();
    }
  );
});

describe('StepProgress', () => {
  it('should render step progress', () => {
    render(<StepProgress current={2} total={5} />);
    expect(screen.getByTestId('step-progress')).toBeInTheDocument();
  });

  it('should render correct number of steps', () => {
    render(<StepProgress current={2} total={5} />);
    expect(screen.getByTestId('step-progress-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-progress-step-5')).toBeInTheDocument();
  });

  it('should render connectors between steps', () => {
    render(<StepProgress current={2} total={3} />);
    expect(screen.getByTestId('step-progress-connector-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-progress-connector-2')).toBeInTheDocument();
  });

  it('should show labels when showLabels is true', () => {
    render(<StepProgress current={1} total={3} showLabels labels={['First', 'Second', 'Third']} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});

describe('TestProgress', () => {
  const defaultProps = {
    totalSteps: 10,
    passedSteps: 5,
    failedSteps: 2,
    currentStep: 8,
  };

  it('should render test progress', () => {
    render(<TestProgress {...defaultProps} />);
    expect(screen.getByTestId('test-progress')).toBeInTheDocument();
  });

  it('should show passed count', () => {
    render(<TestProgress {...defaultProps} />);
    expect(screen.getByTestId('test-progress-passed')).toHaveTextContent('5');
  });

  it('should show failed count', () => {
    render(<TestProgress {...defaultProps} />);
    expect(screen.getByTestId('test-progress-failed')).toHaveTextContent('2');
  });

  it('should show remaining count', () => {
    render(<TestProgress {...defaultProps} />);
    expect(screen.getByTestId('test-progress-remaining')).toHaveTextContent('3');
  });

  it('should show running state label', () => {
    render(<TestProgress {...defaultProps} isRunning />);
    expect(screen.getByText(/Running step 8 of 10/)).toBeInTheDocument();
  });

  it('should hide details when showDetails is false', () => {
    render(<TestProgress {...defaultProps} showDetails={false} />);
    expect(screen.queryByTestId('test-progress-details')).not.toBeInTheDocument();
  });

  it('should show pass rate bar', () => {
    render(<TestProgress {...defaultProps} />);
    expect(screen.getByTestId('test-progress-pass-bar')).toBeInTheDocument();
    expect(screen.getByTestId('test-progress-fail-bar')).toBeInTheDocument();
  });
});

describe('utility functions', () => {
  describe('calculatePercentage', () => {
    it('should calculate correct percentage', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(25, 50)).toBe(50);
      expect(calculatePercentage(3, 10)).toBe(30);
    });

    it('should clamp to 0-100', () => {
      expect(calculatePercentage(-10, 100)).toBe(0);
      expect(calculatePercentage(150, 100)).toBe(100);
    });

    it('should handle zero max', () => {
      expect(calculatePercentage(50, 0)).toBe(0);
    });
  });

  describe('formatPercentage', () => {
    it('should format with default decimals', () => {
      expect(formatPercentage(50)).toBe('50%');
      expect(formatPercentage(33.333)).toBe('33%');
    });

    it('should format with specified decimals', () => {
      expect(formatPercentage(33.333, 1)).toBe('33.3%');
      expect(formatPercentage(33.333, 2)).toBe('33.33%');
    });
  });

  describe('getColorByPercentage', () => {
    it('should return correct colors', () => {
      expect(getColorByPercentage(90)).toBe('green');
      expect(getColorByPercentage(60)).toBe('blue');
      expect(getColorByPercentage(30)).toBe('yellow');
      expect(getColorByPercentage(10)).toBe('red');
    });
  });
});
