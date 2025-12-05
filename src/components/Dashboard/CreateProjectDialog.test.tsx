/**
 * Tests for CreateProjectDialog component
 * @module components/Dashboard/CreateProjectDialog.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CreateProjectDialog,
  validateFormData,
  hasErrors,
  type CreateProjectData,
} from './CreateProjectDialog';

// ============================================================================
// TESTS
// ============================================================================

describe('CreateProjectDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when open', () => {
      render(<CreateProjectDialog {...defaultProps} />);
      expect(screen.getByTestId('create-project-dialog')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<CreateProjectDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('create-project-dialog')).not.toBeInTheDocument();
    });

    it('should render title', () => {
      render(<CreateProjectDialog {...defaultProps} />);
      expect(screen.getByText('Create New Project')).toBeInTheDocument();
    });

    it('should render custom title', () => {
      render(<CreateProjectDialog {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render form fields', () => {
      render(<CreateProjectDialog {...defaultProps} />);
      expect(screen.getByTestId('create-project-dialog-name')).toBeInTheDocument();
      expect(screen.getByTestId('create-project-dialog-description')).toBeInTheDocument();
      expect(screen.getByTestId('create-project-dialog-url')).toBeInTheDocument();
    });

    it('should render submit button with custom label', () => {
      render(<CreateProjectDialog {...defaultProps} submitLabel="Save Project" />);
      expect(screen.getByText('Save Project')).toBeInTheDocument();
    });

    it('should show required indicators', () => {
      render(<CreateProjectDialog {...defaultProps} />);
      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('form interaction', () => {
    it('should update name field', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      const input = screen.getByTestId('create-project-dialog-name');
      await user.type(input, 'Test Project');
      
      expect(input).toHaveValue('Test Project');
    });

    it('should update description field', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      const textarea = screen.getByTestId('create-project-dialog-description');
      await user.type(textarea, 'Test description');
      
      expect(textarea).toHaveValue('Test description');
    });

    it('should update URL field', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      const input = screen.getByTestId('create-project-dialog-url');
      await user.type(input, 'https://example.com');
      
      expect(input).toHaveValue('https://example.com');
    });

    it('should populate with initial data', () => {
      const initialData = {
        name: 'Initial Name',
        description: 'Initial Description',
        target_url: 'https://initial.com',
      };
      
      render(<CreateProjectDialog {...defaultProps} initialData={initialData} />);
      
      expect(screen.getByTestId('create-project-dialog-name')).toHaveValue('Initial Name');
      expect(screen.getByTestId('create-project-dialog-description')).toHaveValue('Initial Description');
      expect(screen.getByTestId('create-project-dialog-url')).toHaveValue('https://initial.com');
    });
  });

  describe('validation', () => {
    it('should show error for empty name', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      // Fill URL but leave name empty
      await user.type(screen.getByTestId('create-project-dialog-url'), 'https://example.com');
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    it('should show error for empty URL', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      // Fill name but leave URL empty
      await user.type(screen.getByTestId('create-project-dialog-name'), 'Test Project');
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      expect(screen.getByText('Target URL is required')).toBeInTheDocument();
    });

    // Note: Invalid URL validation is covered by the validateFormData unit test below

    it('should clear error when user types', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      // Submit to show errors
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
      
      // Type to clear error
      await user.type(screen.getByTestId('create-project-dialog-name'), 'Test');
      expect(screen.queryByText('Project name is required')).not.toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('should call onCreate with form data', async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onCreate={onCreate} />);
      
      await user.type(screen.getByTestId('create-project-dialog-name'), 'Test Project');
      await user.type(screen.getByTestId('create-project-dialog-description'), 'Description');
      await user.type(screen.getByTestId('create-project-dialog-url'), 'https://example.com');
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Description',
        target_url: 'https://example.com',
      });
    });

    it('should trim whitespace from values', async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onCreate={onCreate} />);
      
      await user.type(screen.getByTestId('create-project-dialog-name'), '  Test Project  ');
      await user.type(screen.getByTestId('create-project-dialog-url'), '  https://example.com  ');
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Test Project',
        description: '',
        target_url: 'https://example.com',
      });
    });

    it('should call onClose after successful submission', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onCreate = vi.fn().mockResolvedValue(undefined);
      render(<CreateProjectDialog {...defaultProps} onClose={onClose} onCreate={onCreate} />);
      
      await user.type(screen.getByTestId('create-project-dialog-name'), 'Test Project');
      await user.type(screen.getByTestId('create-project-dialog-url'), 'https://example.com');
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should not submit with validation errors', async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onCreate={onCreate} />);
      
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when submitting', async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn(() => new Promise(() => {})); // Never resolves
      render(<CreateProjectDialog {...defaultProps} onCreate={onCreate} />);
      
      await user.type(screen.getByTestId('create-project-dialog-name'), 'Test Project');
      await user.type(screen.getByTestId('create-project-dialog-url'), 'https://example.com');
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    it('should disable inputs when loading', async () => {
      render(<CreateProjectDialog {...defaultProps} isLoading={true} />);
      
      expect(screen.getByTestId('create-project-dialog-name')).toBeDisabled();
      expect(screen.getByTestId('create-project-dialog-description')).toBeDisabled();
      expect(screen.getByTestId('create-project-dialog-url')).toBeDisabled();
    });

    it('should disable buttons when loading', async () => {
      render(<CreateProjectDialog {...defaultProps} isLoading={true} />);
      
      expect(screen.getByTestId('create-project-dialog-cancel')).toBeDisabled();
      expect(screen.getByTestId('create-project-dialog-submit')).toBeDisabled();
    });
  });

  describe('dialog controls', () => {
    it('should call onClose when cancel clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByTestId('create-project-dialog-cancel'));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByTestId('create-project-dialog-close'));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose on Escape key', async () => {
      const onClose = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should not close on Escape when loading', async () => {
      const onClose = vi.fn();
      render(<CreateProjectDialog {...defaultProps} onClose={onClose} isLoading={true} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<CreateProjectDialog {...defaultProps} />);
      
      const dialog = screen.getByTestId('create-project-dialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should show error alerts', async () => {
      const user = userEvent.setup();
      render(<CreateProjectDialog {...defaultProps} />);
      
      await user.click(screen.getByTestId('create-project-dialog-submit'));
      
      const errorAlert = screen.getByTestId('project-name-error');
      expect(errorAlert).toHaveAttribute('role', 'alert');
    });
  });
});

describe('validateFormData', () => {
  it('should return empty errors for valid data', () => {
    const data: CreateProjectData = {
      name: 'Test Project',
      description: 'Description',
      target_url: 'https://example.com',
    };
    
    expect(validateFormData(data)).toEqual({});
  });

  it('should return error for empty name', () => {
    const data: CreateProjectData = {
      name: '',
      description: '',
      target_url: 'https://example.com',
    };
    
    expect(validateFormData(data).name).toBe('Project name is required');
  });

  it('should return error for long name', () => {
    const data: CreateProjectData = {
      name: 'a'.repeat(101),
      description: '',
      target_url: 'https://example.com',
    };
    
    expect(validateFormData(data).name).toBe('Project name must be 100 characters or less');
  });

  it('should return error for long description', () => {
    const data: CreateProjectData = {
      name: 'Test',
      description: 'a'.repeat(501),
      target_url: 'https://example.com',
    };
    
    expect(validateFormData(data).description).toBe('Description must be 500 characters or less');
  });

  it('should return error for empty URL', () => {
    const data: CreateProjectData = {
      name: 'Test',
      description: '',
      target_url: '',
    };
    
    expect(validateFormData(data).target_url).toBe('Target URL is required');
  });

  it('should return error for invalid URL', () => {
    const data: CreateProjectData = {
      name: 'Test',
      description: '',
      target_url: 'invalid',
    };
    
    expect(validateFormData(data).target_url).toBe('URL must start with http:// or https://');
  });

  it('should accept http URL', () => {
    const data: CreateProjectData = {
      name: 'Test',
      description: '',
      target_url: 'http://example.com',
    };
    
    expect(validateFormData(data).target_url).toBeUndefined();
  });

  it('should accept https URL', () => {
    const data: CreateProjectData = {
      name: 'Test',
      description: '',
      target_url: 'https://example.com',
    };
    
    expect(validateFormData(data).target_url).toBeUndefined();
  });
});

describe('hasErrors', () => {
  it('should return false for empty errors', () => {
    expect(hasErrors({})).toBe(false);
  });

  it('should return true for errors', () => {
    expect(hasErrors({ name: 'Error' })).toBe(true);
  });
});
