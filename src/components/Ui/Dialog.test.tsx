/**
 * Dialog Component Tests
 * @module components/Ui/Dialog.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  ConfirmDialog,
  FormDialog,
  CreateProjectDialog,
  DeleteConfirmDialog,
} from './Dialog';

// ============================================================================
// DIALOG TESTS
// ============================================================================

describe('Dialog', () => {
  describe('Rendering', () => {
    it('should render trigger button', () => {
      render(
        <Dialog>
          <DialogTrigger testId="trigger">Open</DialogTrigger>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      expect(screen.getByTestId('trigger')).toBeInTheDocument();
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('should open dialog when trigger clicked', async () => {
      render(
        <Dialog>
          <DialogTrigger testId="trigger">Open</DialogTrigger>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      await userEvent.click(screen.getByTestId('trigger'));
      
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should render with controlled open state', () => {
      render(
        <Dialog open={true}>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should not render when controlled closed', () => {
      render(
        <Dialog open={false}>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });
  });

  describe('Closing', () => {
    it('should close when close button clicked', async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      expect(screen.getByTestId('content')).toBeInTheDocument();
      
      await userEvent.click(screen.getByTestId('content-close'));
      
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('should close when overlay clicked', async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      await userEvent.click(screen.getByTestId('dialog-overlay'));
      
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('should not close on overlay click when disabled', async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent closeOnOverlayClick={false} testId="content">
            Content
          </DialogContent>
        </Dialog>
      );
      
      await userEvent.click(screen.getByTestId('dialog-overlay'));
      
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should close on escape key', async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      });
    });

    it('should not close on escape when disabled', async () => {
      render(
        <Dialog defaultOpen>
          <DialogContent closeOnEscape={false} testId="content">
            Content
          </DialogContent>
        </Dialog>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should call onOpenChange when closed', async () => {
      const onOpenChange = vi.fn();
      
      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      
      await userEvent.click(screen.getByTestId('content-close'));
      
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(
          <Dialog open>
            <DialogContent size={size} testId="content">Content</DialogContent>
          </Dialog>
        );
        expect(screen.getByTestId('content')).toBeInTheDocument();
      });
    });
  });

  describe('Close Button', () => {
    it('should show close button by default', () => {
      render(
        <Dialog open>
          <DialogContent testId="content">Content</DialogContent>
        </Dialog>
      );
      expect(screen.getByTestId('content-close')).toBeInTheDocument();
    });

    it('should hide close button when disabled', () => {
      render(
        <Dialog open>
          <DialogContent showCloseButton={false} testId="content">
            Content
          </DialogContent>
        </Dialog>
      );
      expect(screen.queryByTestId('content-close')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// COMPOUND COMPONENT TESTS
// ============================================================================

describe('Dialog Compound Components', () => {
  it('should render full dialog structure', async () => {
    render(
      <Dialog>
        <DialogTrigger testId="trigger">Open</DialogTrigger>
        <DialogContent testId="content">
          <DialogHeader testId="header">
            <DialogTitle testId="title">Title</DialogTitle>
            <DialogDescription testId="desc">Description</DialogDescription>
          </DialogHeader>
          <DialogBody testId="body">Body content</DialogBody>
          <DialogFooter testId="footer">
            <DialogClose testId="close-btn">Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    
    await userEvent.click(screen.getByTestId('trigger'));
    
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toHaveTextContent('Title');
    expect(screen.getByTestId('desc')).toHaveTextContent('Description');
    expect(screen.getByTestId('body')).toHaveTextContent('Body content');
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should close dialog via DialogClose', async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent testId="content">
          <DialogClose testId="close-btn">Close</DialogClose>
        </DialogContent>
      </Dialog>
    );
    
    await userEvent.click(screen.getByTestId('close-btn'));
    
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });
});

// ============================================================================
// CONFIRM DIALOG TESTS
// ============================================================================

describe('ConfirmDialog', () => {
  it('should render confirm dialog', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm Action"
        description="Are you sure?"
        onConfirm={() => {}}
        testId="confirm"
      />
    );
    
    expect(screen.getByTestId('confirm')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-title')).toHaveTextContent('Confirm Action');
    expect(screen.getByTestId('confirm-description')).toHaveTextContent('Are you sure?');
  });

  it('should call onConfirm when confirm clicked', async () => {
    const onConfirm = vi.fn();
    
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Message"
        onConfirm={onConfirm}
        testId="confirm"
      />
    );
    
    await userEvent.click(screen.getByTestId('confirm-confirm'));
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onOpenChange when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirm"
        description="Message"
        onConfirm={() => {}}
        testId="confirm"
      />
    );
    
    await userEvent.click(screen.getByTestId('confirm-cancel'));
    
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show loading state', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Message"
        onConfirm={() => {}}
        loading
        testId="confirm"
      />
    );
    
    expect(screen.getByTestId('confirm-confirm')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('confirm-confirm')).toBeDisabled();
  });

  it('should render destructive variant', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="This will delete the item"
        onConfirm={() => {}}
        variant="destructive"
        testId="confirm"
      />
    );
    
    expect(screen.getByTestId('confirm-confirm')).toHaveClass('bg-red-600');
  });
});

// ============================================================================
// FORM DIALOG TESTS
// ============================================================================

describe('FormDialog', () => {
  it('should render form dialog', () => {
    render(
      <FormDialog
        open={true}
        onOpenChange={() => {}}
        title="Form"
        onSubmit={() => {}}
        testId="form"
      >
        <input data-testid="input" />
      </FormDialog>
    );
    
    expect(screen.getByTestId('form')).toBeInTheDocument();
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('should call onSubmit when form submitted', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    
    render(
      <FormDialog
        open={true}
        onOpenChange={() => {}}
        title="Form"
        onSubmit={onSubmit}
        testId="form"
      >
        <input />
      </FormDialog>
    );
    
    await userEvent.click(screen.getByTestId('form-submit'));
    
    expect(onSubmit).toHaveBeenCalled();
  });

  it('should close when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    
    render(
      <FormDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Form"
        onSubmit={() => {}}
        testId="form"
      >
        <input />
      </FormDialog>
    );
    
    await userEvent.click(screen.getByTestId('form-cancel'));
    
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ============================================================================
// CREATE PROJECT DIALOG TESTS
// ============================================================================

describe('CreateProjectDialog', () => {
  it('should render create project dialog', () => {
    render(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={() => {}}
        testId="create-project"
      />
    );
    
    expect(screen.getByTestId('create-project')).toBeInTheDocument();
    expect(screen.getByText('Create New Project')).toBeInTheDocument();
  });

  it('should render form fields', () => {
    render(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={() => {}}
        testId="create-project"
      />
    );
    
    expect(screen.getByTestId('create-project-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-project-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-project-url-input')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const onCreate = vi.fn();
    
    render(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={onCreate}
        testId="create-project"
      />
    );
    
    await userEvent.click(screen.getByTestId('create-project-submit'));
    
    expect(screen.getByText('Project name is required')).toBeInTheDocument();
    expect(screen.getByText('Target URL is required')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('should validate URL format', async () => {
    const onCreate = vi.fn();
    
    render(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={onCreate}
        testId="create-project"
      />
    );
    
    const nameInput = screen.getByTestId('create-project-name-input');
    const urlInput = screen.getByTestId('create-project-url-input');
    
    // Type valid name
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Test Project');
    
    // Type invalid URL
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, 'not-a-url');
    
    // Submit form directly
    const form = screen.getByTestId('create-project').querySelector('form');
    fireEvent.submit(form!);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid URL/)).toBeInTheDocument();
    }, { timeout: 2000 });
    
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('should call onCreate with valid data', async () => {
    const onCreate = vi.fn();
    
    render(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={onCreate}
        testId="create-project"
      />
    );
    
    await userEvent.type(screen.getByTestId('create-project-name-input'), 'Test Project');
    await userEvent.type(screen.getByTestId('create-project-description-input'), 'Description');
    await userEvent.type(screen.getByTestId('create-project-url-input'), 'https://example.com');
    await userEvent.click(screen.getByTestId('create-project-submit'));
    
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Test Project',
      description: 'Description',
      targetUrl: 'https://example.com',
    });
  });

  it('should reset form when reopened', async () => {
    const { rerender } = render(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={() => {}}
        testId="create-project"
      />
    );
    
    await userEvent.type(screen.getByTestId('create-project-name-input'), 'Test');
    
    rerender(
      <CreateProjectDialog
        open={false}
        onOpenChange={() => {}}
        onCreate={() => {}}
        testId="create-project"
      />
    );
    
    rerender(
      <CreateProjectDialog
        open={true}
        onOpenChange={() => {}}
        onCreate={() => {}}
        testId="create-project"
      />
    );
    
    expect(screen.getByTestId('create-project-name-input')).toHaveValue('');
  });
});

// ============================================================================
// DELETE CONFIRM DIALOG TESTS
// ============================================================================

describe('DeleteConfirmDialog', () => {
  it('should render delete confirmation dialog', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={() => {}}
        itemName="My Project"
        itemType="project"
        onDelete={() => {}}
        testId="delete-confirm"
      />
    );
    
    expect(screen.getByTestId('delete-confirm')).toBeInTheDocument();
    expect(screen.getByText('Delete project?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "My Project"/)).toBeInTheDocument();
  });

  it('should call onDelete when confirmed', async () => {
    const onDelete = vi.fn();
    
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={() => {}}
        itemName="My Project"
        onDelete={onDelete}
        testId="delete-confirm"
      />
    );
    
    await userEvent.click(screen.getByTestId('delete-confirm-confirm'));
    
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe('Dialog Accessibility', () => {
  it('should have role="dialog"', () => {
    render(
      <Dialog open>
        <DialogContent testId="content">Content</DialogContent>
      </Dialog>
    );
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should have aria-modal="true"', () => {
    render(
      <Dialog open>
        <DialogContent testId="content">Content</DialogContent>
      </Dialog>
    );
    
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('should have close button with aria-label', () => {
    render(
      <Dialog open>
        <DialogContent testId="content">Content</DialogContent>
      </Dialog>
    );
    
    expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle rapid open/close', async () => {
    const onOpenChange = vi.fn();
    
    const { rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent testId="content">Content</DialogContent>
      </Dialog>
    );
    
    // Rapidly toggle
    rerender(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogContent testId="content">Content</DialogContent>
      </Dialog>
    );
    
    rerender(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent testId="content">Content</DialogContent>
      </Dialog>
    );
    
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('should forward ref to content', () => {
    const ref = React.createRef<HTMLDivElement>();
    
    render(
      <Dialog open>
        <DialogContent ref={ref} testId="content">Content</DialogContent>
      </Dialog>
    );
    
    expect(ref.current).toBe(screen.getByTestId('content'));
  });

  it('should handle className prop', () => {
    render(
      <Dialog open>
        <DialogContent className="custom-class" testId="content">
          Content
        </DialogContent>
      </Dialog>
    );
    
    expect(screen.getByTestId('content')).toHaveClass('custom-class');
  });
});
