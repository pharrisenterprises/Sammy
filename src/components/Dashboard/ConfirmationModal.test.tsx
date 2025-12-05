/**
 * Tests for ConfirmationModal component
 * @module components/Dashboard/ConfirmationModal.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConfirmationModal,
  DeleteConfirmation,
  DiscardConfirmation,
  StopTestConfirmation,
  ClearHistoryConfirmation,
  type ConfirmationVariant,
} from './ConfirmationModal';

// ============================================================================
// TESTS
// ============================================================================

describe('ConfirmationModal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when open', () => {
      render(<ConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<ConfirmationModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });

    it('should render title', () => {
      render(<ConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('should render message', () => {
      render(<ConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('should render custom confirm label', () => {
      render(<ConfirmationModal {...defaultProps} confirmLabel="Delete" />);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should render custom cancel label', () => {
      render(<ConfirmationModal {...defaultProps} cancelLabel="Nevermind" />);
      expect(screen.getByText('Nevermind')).toBeInTheDocument();
    });

    it('should render icon by default', () => {
      render(<ConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('confirmation-modal-icon')).toBeInTheDocument();
    });

    it('should hide icon when showIcon is false', () => {
      render(<ConfirmationModal {...defaultProps} showIcon={false} />);
      expect(screen.queryByTestId('confirmation-modal-icon')).not.toBeInTheDocument();
    });

    it('should render React node message', () => {
      const customMessage = <span data-testid="custom-message">Custom <strong>content</strong></span>;
      render(<ConfirmationModal {...defaultProps} message={customMessage} />);
      expect(screen.getByTestId('custom-message')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it.each<[ConfirmationVariant, string]>([
      ['danger', 'bg-red-100'],
      ['warning', 'bg-yellow-100'],
      ['info', 'bg-blue-100'],
    ])('should render %s variant with correct icon color', (variant, expectedClass) => {
      render(<ConfirmationModal {...defaultProps} variant={variant} />);
      const icon = screen.getByTestId('confirmation-modal-icon');
      expect(icon).toHaveClass(expectedClass);
    });
  });

  describe('interactions', () => {
    it('should call onConfirm when confirm button clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByTestId('confirmation-modal-confirm'));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmationModal {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByTestId('confirmation-modal-cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when close button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmationModal {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByTestId('confirmation-modal-close'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when backdrop clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmationModal {...defaultProps} onCancel={onCancel} />);

      const modal = screen.getByTestId('confirmation-modal');
      await user.click(modal);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel on Escape key', () => {
      const onCancel = vi.fn();
      render(<ConfirmationModal {...defaultProps} onCancel={onCancel} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onCancel on Escape when loading', () => {
      const onCancel = vi.fn();
      render(<ConfirmationModal {...defaultProps} onCancel={onCancel} isLoading={true} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when isLoading', () => {
      render(<ConfirmationModal {...defaultProps} isLoading={true} />);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should disable buttons when loading', () => {
      render(<ConfirmationModal {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('confirmation-modal-confirm')).toBeDisabled();
      expect(screen.getByTestId('confirmation-modal-cancel')).toBeDisabled();
    });

    it('should not call onConfirm when loading', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} isLoading={true} />);

      await user.click(screen.getByTestId('confirmation-modal-confirm'));

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should not close on backdrop click when loading', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<ConfirmationModal {...defaultProps} onCancel={onCancel} isLoading={true} />);

      const modal = screen.getByTestId('confirmation-modal');
      await user.click(modal);

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have alertdialog role', () => {
      render(<ConfirmationModal {...defaultProps} />);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(<ConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('confirmation-modal')).toHaveAttribute('aria-modal', 'true');
    });

    it('should have proper aria-labelledby', () => {
      render(<ConfirmationModal {...defaultProps} />);
      const modal = screen.getByTestId('confirmation-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'confirmation-modal-title');
    });

    it('should have proper aria-describedby', () => {
      render(<ConfirmationModal {...defaultProps} />);
      const modal = screen.getByTestId('confirmation-modal');
      expect(modal).toHaveAttribute('aria-describedby', 'confirmation-modal-description');
    });
  });

  describe('async confirm', () => {
    it('should handle async onConfirm', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByTestId('confirmation-modal-confirm'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });
  });
});

describe('DeleteConfirmation', () => {
  const defaultProps = {
    isOpen: true,
    itemName: 'Test Project',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render with item name', () => {
    render(<DeleteConfirmation {...defaultProps} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('should render custom item type', () => {
    render(<DeleteConfirmation {...defaultProps} itemType="project" />);
    expect(screen.getByText('Delete project')).toBeInTheDocument();
  });

  it('should render delete button', () => {
    render(<DeleteConfirmation {...defaultProps} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should call onConfirm when delete clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteConfirmation {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByText('Delete'));

    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('DiscardConfirmation', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render discard message', () => {
    render(<DiscardConfirmation {...defaultProps} />);
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it('should render discard button', () => {
    render(<DiscardConfirmation {...defaultProps} />);
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });

  it('should render keep editing button', () => {
    render(<DiscardConfirmation {...defaultProps} />);
    expect(screen.getByText('Keep Editing')).toBeInTheDocument();
  });
});

describe('StopTestConfirmation', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render stop test message', () => {
    render(<StopTestConfirmation {...defaultProps} />);
    expect(screen.getByText(/still running/i)).toBeInTheDocument();
  });

  it('should render stop test button', () => {
    render(<StopTestConfirmation {...defaultProps} />);
    expect(screen.getByTestId('stop-test-confirmation-confirm')).toHaveTextContent('Stop Test');
  });

  it('should render continue running button', () => {
    render(<StopTestConfirmation {...defaultProps} />);
    expect(screen.getByText('Continue Running')).toBeInTheDocument();
  });
});

describe('ClearHistoryConfirmation', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render clear history message', () => {
    render(<ClearHistoryConfirmation {...defaultProps} />);
    expect(screen.getByText(/clear all test history/i)).toBeInTheDocument();
  });

  it('should render clear history button', () => {
    render(<ClearHistoryConfirmation {...defaultProps} />);
    expect(screen.getByText('Clear History')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<ClearHistoryConfirmation {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });
});
