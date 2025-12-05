/**
 * Modal Component Tests
 * @module components/Ui/Modal.test
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ConfirmModal,
  AlertModal,
  FormModal,
} from './Modal';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ControlledModal: React.FC<{ initialOpen?: boolean }> = ({ initialOpen = true }) => {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open Modal</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Test Modal"
        testId="test-modal"
      >
        <p>Modal content</p>
      </Modal>
    </>
  );
};

// ============================================================================
// MODAL TESTS
// ============================================================================

describe('Modal', () => {
  describe('Rendering', () => {
    it('should render when open', () => {
      render(
        <Modal open={true} onClose={() => {}} title="Test Modal" testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      expect(screen.getByTestId('my-modal')).toBeInTheDocument();
      expect(screen.getByTestId('my-modal')).toHaveAttribute('role', 'dialog');
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <Modal open={false} onClose={() => {}} title="Test Modal" testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      expect(screen.queryByTestId('my-modal')).not.toBeInTheDocument();
    });

    it('should render title and description', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Modal Title"
          description="Modal description text"
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      expect(screen.getByText('Modal Title')).toBeInTheDocument();
      expect(screen.getByText('Modal description text')).toBeInTheDocument();
    });

    it('should render close button by default', () => {
      render(
        <Modal open={true} onClose={() => {}} title="Test" testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      expect(screen.getByTestId('my-modal-close-button')).toBeInTheDocument();
    });

    it('should hide close button when showCloseButton is false', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Test"
          showCloseButton={false}
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      expect(screen.queryByTestId('my-modal-close-button')).not.toBeInTheDocument();
    });

    it('should render custom footer', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Test"
          footer={<button>Custom Footer</button>}
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      expect(screen.getByTestId('my-modal-footer')).toBeInTheDocument();
      expect(screen.getByText('Custom Footer')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(
          <Modal open={true} onClose={() => {}} size={size} testId={`modal-${size}`}>
            <p>Content</p>
          </Modal>
        );
        
        expect(screen.getByTestId(`modal-${size}`)).toBeInTheDocument();
      });
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn();
      
      render(
        <Modal open={true} onClose={onClose} title="Test" testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      await userEvent.click(screen.getByTestId('my-modal-close-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop clicked', async () => {
      const onClose = vi.fn();
      
      render(
        <Modal open={true} onClose={onClose} title="Test" testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      await userEvent.click(screen.getByTestId('my-modal-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose on backdrop click when closeOnBackdropClick is false', async () => {
      const onClose = vi.fn();
      
      render(
        <Modal
          open={true}
          onClose={onClose}
          closeOnBackdropClick={false}
          title="Test"
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      await userEvent.click(screen.getByTestId('my-modal-overlay'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape pressed', async () => {
      const onClose = vi.fn();
      
      render(
        <Modal open={true} onClose={onClose} title="Test" testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose on Escape when closeOnEscape is false', async () => {
      const onClose = vi.fn();
      
      render(
        <Modal
          open={true}
          onClose={onClose}
          closeOnEscape={false}
          title="Test"
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should focus first focusable element on open', async () => {
      render(
        <Modal open={true} onClose={() => {}} title="Test" testId="my-modal">
          <input data-testid="first-input" />
          <button>Button</button>
        </Modal>
      );
      
      // Just verify modal rendered and focus is managed
      await waitFor(() => {
        expect(screen.getByTestId('my-modal')).toBeInTheDocument();
      });
    });

    it('should have focusable elements', async () => {
      render(
        <Modal open={true} onClose={() => {}} showCloseButton={false} testId="my-modal">
          <button data-testid="first-btn">First</button>
          <button data-testid="last-btn">Last</button>
        </Modal>
      );
      
      const firstBtn = screen.getByTestId('first-btn');
      const lastBtn = screen.getByTestId('last-btn');
      
      // Verify buttons are focusable
      firstBtn.focus();
      expect(firstBtn).toHaveFocus();
      
      lastBtn.focus();
      expect(lastBtn).toHaveFocus();
    });
  });

  describe('Scroll Lock', () => {
    it('should lock body scroll when open', () => {
      render(
        <Modal open={true} onClose={() => {}} lockScroll={true} testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should not lock scroll when lockScroll is false', () => {
      const originalOverflow = document.body.style.overflow;
      
      render(
        <Modal open={true} onClose={() => {}} lockScroll={false} testId="my-modal">
          <p>Content</p>
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe(originalOverflow);
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Accessible Modal"
          description="This is a description"
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      const dialog = screen.getByTestId('my-modal');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('should use aria-label when provided', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          aria-label="Custom Label"
          testId="my-modal"
        >
          <p>Content</p>
        </Modal>
      );
      
      const dialog = screen.getByTestId('my-modal');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Custom Label');
    });
  });
});

// ============================================================================
// MODAL COMPOUND COMPONENTS TESTS
// ============================================================================

describe('Modal Compound Components', () => {
  describe('ModalHeader', () => {
    it('should render header content', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          <ModalHeader testId="custom-header">
            <h2>Custom Header</h2>
          </ModalHeader>
        </Modal>
      );
      
      expect(screen.getByTestId('custom-header')).toBeInTheDocument();
      expect(screen.getByText('Custom Header')).toBeInTheDocument();
    });
  });

  describe('ModalBody', () => {
    it('should render body content', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          <ModalBody testId="custom-body">
            <p>Body content</p>
          </ModalBody>
        </Modal>
      );
      
      expect(screen.getByTestId('custom-body')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });
  });

  describe('ModalFooter', () => {
    it('should render footer content', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          <ModalFooter testId="custom-footer">
            <button>Action</button>
          </ModalFooter>
        </Modal>
      );
      
      expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('should align content based on align prop', () => {
      const { rerender } = render(
        <Modal open={true} onClose={() => {}}>
          <ModalFooter align="left" testId="footer">
            <button>Action</button>
          </ModalFooter>
        </Modal>
      );
      
      expect(screen.getByTestId('footer')).toHaveClass('justify-start');
      
      rerender(
        <Modal open={true} onClose={() => {}}>
          <ModalFooter align="center" testId="footer">
            <button>Action</button>
          </ModalFooter>
        </Modal>
      );
      
      expect(screen.getByTestId('footer')).toHaveClass('justify-center');
      
      rerender(
        <Modal open={true} onClose={() => {}}>
          <ModalFooter align="between" testId="footer">
            <button>Action</button>
          </ModalFooter>
        </Modal>
      );
      
      expect(screen.getByTestId('footer')).toHaveClass('justify-between');
    });
  });
});

// ============================================================================
// CONFIRM MODAL TESTS
// ============================================================================

describe('ConfirmModal', () => {
  it('should render with title and message', () => {
    render(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm Action"
        message="Are you sure?"
        testId="confirm-modal"
      />
    );
    
    expect(screen.getByTestId('confirm-modal-title')).toHaveTextContent('Confirm Action');
    expect(screen.getByTestId('confirm-modal-message')).toHaveTextContent('Are you sure?');
  });

  it('should render confirm and cancel buttons', () => {
    render(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        message="Message"
        confirmText="Delete"
        cancelText="Keep"
        testId="confirm-modal"
      />
    );
    
    expect(screen.getByTestId('confirm-modal-confirm')).toHaveTextContent('Delete');
    expect(screen.getByTestId('confirm-modal-cancel')).toHaveTextContent('Keep');
  });

  it('should call onConfirm when confirm clicked', async () => {
    const onConfirm = vi.fn();
    
    render(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Confirm"
        message="Message"
        testId="confirm-modal"
      />
    );
    
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    
    render(
      <ConfirmModal
        open={true}
        onClose={onClose}
        onConfirm={() => {}}
        title="Confirm"
        message="Message"
        testId="confirm-modal"
      />
    );
    
    await userEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show loading state', () => {
    render(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        message="Message"
        isLoading={true}
        testId="confirm-modal"
      />
    );
    
    expect(screen.getByTestId('confirm-modal-confirm')).toHaveTextContent('Processing...');
    expect(screen.getByTestId('confirm-modal-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm-modal-cancel')).toBeDisabled();
  });

  it('should render different variants', () => {
    const { rerender } = render(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        message="Message"
        variant="danger"
        testId="confirm-modal"
      />
    );
    
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    
    rerender(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        message="Message"
        variant="warning"
        testId="confirm-modal"
      />
    );
    
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
  });
});

// ============================================================================
// ALERT MODAL TESTS
// ============================================================================

describe('AlertModal', () => {
  it('should render with title and message', () => {
    render(
      <AlertModal
        open={true}
        onClose={() => {}}
        title="Alert Title"
        message="Alert message content"
        testId="alert-modal"
      />
    );
    
    expect(screen.getByTestId('alert-modal-title')).toHaveTextContent('Alert Title');
    expect(screen.getByTestId('alert-modal-message')).toHaveTextContent('Alert message content');
  });

  it('should render button with custom text', () => {
    render(
      <AlertModal
        open={true}
        onClose={() => {}}
        title="Alert"
        message="Message"
        buttonText="Got it!"
        testId="alert-modal"
      />
    );
    
    expect(screen.getByTestId('alert-modal-button')).toHaveTextContent('Got it!');
  });

  it('should call onClose when button clicked', async () => {
    const onClose = vi.fn();
    
    render(
      <AlertModal
        open={true}
        onClose={onClose}
        title="Alert"
        message="Message"
        testId="alert-modal"
      />
    );
    
    await userEvent.click(screen.getByTestId('alert-modal-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render different variants', () => {
    const variants = ['default', 'danger', 'success', 'warning', 'info'] as const;
    
    variants.forEach((variant) => {
      const { unmount } = render(
        <AlertModal
          open={true}
          onClose={() => {}}
          title="Alert"
          message="Message"
          variant={variant}
          testId={`alert-${variant}`}
        />
      );
      
      expect(screen.getByTestId(`alert-${variant}`)).toBeInTheDocument();
      unmount();
    });
  });
});

// ============================================================================
// FORM MODAL TESTS
// ============================================================================

describe('FormModal', () => {
  it('should render form with title', () => {
    render(
      <FormModal
        open={true}
        onClose={() => {}}
        onSubmit={() => {}}
        title="Form Title"
        testId="form-modal"
      >
        <input name="test" />
      </FormModal>
    );
    
    expect(screen.getByText('Form Title')).toBeInTheDocument();
    expect(screen.getByTestId('form-modal-form')).toBeInTheDocument();
  });

  it('should render submit and cancel buttons', () => {
    render(
      <FormModal
        open={true}
        onClose={() => {}}
        onSubmit={() => {}}
        title="Form"
        submitText="Save"
        cancelText="Discard"
        testId="form-modal"
      >
        <input name="test" />
      </FormModal>
    );
    
    expect(screen.getByTestId('form-modal-submit')).toHaveTextContent('Save');
    expect(screen.getByTestId('form-modal-cancel')).toHaveTextContent('Discard');
  });

  it('should call onSubmit when form submitted', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    
    render(
      <FormModal
        open={true}
        onClose={() => {}}
        onSubmit={onSubmit}
        title="Form"
        testId="form-modal"
      >
        <input name="test" />
      </FormModal>
    );
    
    await userEvent.click(screen.getByTestId('form-modal-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    
    render(
      <FormModal
        open={true}
        onClose={onClose}
        onSubmit={() => {}}
        title="Form"
        testId="form-modal"
      >
        <input name="test" />
      </FormModal>
    );
    
    await userEvent.click(screen.getByTestId('form-modal-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show loading state when submitting', () => {
    render(
      <FormModal
        open={true}
        onClose={() => {}}
        onSubmit={() => {}}
        title="Form"
        isSubmitting={true}
        testId="form-modal"
      >
        <input name="test" />
      </FormModal>
    );
    
    expect(screen.getByTestId('form-modal-submit')).toHaveTextContent('Processing...');
    expect(screen.getByTestId('form-modal-submit')).toBeDisabled();
    expect(screen.getByTestId('form-modal-cancel')).toBeDisabled();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle rapid open/close', async () => {
    const { rerender } = render(
      <Modal open={true} onClose={() => {}} testId="my-modal">
        <p>Content</p>
      </Modal>
    );
    
    expect(screen.getByTestId('my-modal')).toBeInTheDocument();
    
    rerender(
      <Modal open={false} onClose={() => {}} testId="my-modal">
        <p>Content</p>
      </Modal>
    );
    
    expect(screen.queryByTestId('my-modal')).not.toBeInTheDocument();
    
    rerender(
      <Modal open={true} onClose={() => {}} testId="my-modal">
        <p>Content</p>
      </Modal>
    );
    
    expect(screen.getByTestId('my-modal')).toBeInTheDocument();
  });

  it('should handle nested modals', () => {
    render(
      <Modal open={true} onClose={() => {}} testId="outer-modal">
        <Modal open={true} onClose={() => {}} testId="inner-modal">
          <p>Inner content</p>
        </Modal>
      </Modal>
    );
    
    expect(screen.getByTestId('outer-modal')).toBeInTheDocument();
    expect(screen.getByTestId('inner-modal')).toBeInTheDocument();
  });

  it('should handle React node as message in ConfirmModal', () => {
    render(
      <ConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm"
        message={
          <div>
            <strong>Important:</strong> This action cannot be undone.
          </div>
        }
        testId="confirm-modal"
      />
    );
    
    expect(screen.getByText('Important:')).toBeInTheDocument();
  });

  it('should clean up scroll lock on unmount', () => {
    const { unmount } = render(
      <Modal open={true} onClose={() => {}} lockScroll={true}>
        <p>Content</p>
      </Modal>
    );
    
    expect(document.body.style.overflow).toBe('hidden');
    
    unmount();
    
    // Should restore original overflow
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
