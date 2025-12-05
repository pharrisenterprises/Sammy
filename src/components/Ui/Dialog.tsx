/**
 * Dialog - Modal/overlay component
 * @module components/Ui/Dialog
 * @version 1.0.0
 * 
 * Provides dialog components with multiple features:
 * - Compound components: Dialog, DialogTrigger, DialogContent, DialogHeader, etc.
 * - Portal rendering with backdrop
 * - Keyboard navigation (Escape to close)
 * - Focus trapping
 * - Preset dialogs: ConfirmDialog, FormDialog
 * 
 * @example
 * ```tsx
 * <Dialog>
 *   <DialogTrigger>Open</DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Create Project</DialogTitle>
 *     </DialogHeader>
 *     <DialogBody>Form content</DialogBody>
 *     <DialogFooter>
 *       <Button>Save</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */

import React, {
  forwardRef,
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Dialog size
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Dialog context
 */
interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dialog props
 */
export interface DialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Default open state */
  defaultOpen?: boolean;
  /** Open change handler */
  onOpenChange?: (open: boolean) => void;
  /** Children */
  children: React.ReactNode;
}

/**
 * Dialog trigger props
 */
export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as child */
  asChild?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Dialog content props
 */
export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size */
  size?: DialogSize;
  /** Close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Close on escape */
  closeOnEscape?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Prevent scroll on body */
  preventScroll?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Dialog header props
 */
export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Dialog title props
 */
export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Dialog description props
 */
export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Dialog body props
 */
export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Dialog footer props
 */
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Dialog close props
 */
export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as child */
  asChild?: boolean;
  /** Test ID */
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Size styles
 */
const SIZE_STYLES: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

// ============================================================================
// CONTEXT
// ============================================================================

const DialogContext = createContext<DialogContextValue | null>(null);

const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog');
  }
  return context;
};

// ============================================================================
// MAIN DIALOG COMPONENT
// ============================================================================

/**
 * Dialog root component
 */
export const Dialog: React.FC<DialogProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback((value: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(value);
    }
    onOpenChange?.(value);
  }, [isControlled, onOpenChange]);

  const contextValue: DialogContextValue = {
    open,
    setOpen,
    onOpenChange,
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
};

Dialog.displayName = 'Dialog';

// ============================================================================
// DIALOG TRIGGER COMPONENT
// ============================================================================

/**
 * Dialog trigger button
 */
export const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(({
  asChild = false,
  onClick,
  children,
  testId = 'dialog-trigger',
  ...props
}, ref) => {
  const { setOpen } = useDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: typeof handleClick }>, {
      onClick: handleClick,
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      data-testid={testId}
      {...props}
    >
      {children}
    </button>
  );
});

DialogTrigger.displayName = 'DialogTrigger';

// ============================================================================
// DIALOG OVERLAY COMPONENT
// ============================================================================

interface DialogOverlayProps {
  onClick?: () => void;
  testId?: string;
}

const DialogOverlay: React.FC<DialogOverlayProps> = ({ onClick, testId = 'dialog-overlay' }) => (
  <div
    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
    onClick={onClick}
    data-testid={testId}
    aria-hidden="true"
  />
);

// ============================================================================
// DIALOG CONTENT COMPONENT
// ============================================================================

/**
 * Dialog content wrapper
 */
export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(({
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  preventScroll = true,
  className = '',
  children,
  testId = 'dialog-content',
  ...props
}, ref) => {
  const { open, setOpen } = useDialogContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store previous focus and prevent scroll
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      if (preventScroll) {
        document.body.style.overflow = 'hidden';
      }

      // Focus first focusable element
      const focusableElements = contentRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }

    return () => {
      if (preventScroll) {
        document.body.style.overflow = '';
      }
      // Restore previous focus
      previousFocusRef.current?.focus();
    };
  }, [open, preventScroll]);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, setOpen]);

  // Handle click outside
  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      setOpen(false);
    }
  };

  // Trap focus
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusableElements = contentRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  if (!open) return null;

  const sizeStyles = SIZE_STYLES[size];

  return createPortal(
    <>
      <DialogOverlay onClick={handleOverlayClick} />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        data-testid={`${testId}-wrapper`}
      >
        <div
          ref={(node) => {
            (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={`
            relative w-full ${sizeStyles}
            bg-white rounded-lg shadow-xl
            animate-scale-in
            ${className}
          `}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          data-testid={testId}
          {...props}
        >
          {showCloseButton && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close dialog"
              data-testid={`${testId}-close`}
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
          {children}
        </div>
      </div>
    </>,
    document.body
  );
});

DialogContent.displayName = 'DialogContent';

// ============================================================================
// DIALOG HEADER COMPONENT
// ============================================================================

/**
 * Dialog header section
 */
export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(({
  className = '',
  children,
  testId = 'dialog-header',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`px-6 pt-6 pb-2 ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </div>
));

DialogHeader.displayName = 'DialogHeader';

// ============================================================================
// DIALOG TITLE COMPONENT
// ============================================================================

/**
 * Dialog title
 */
export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(({
  className = '',
  children,
  testId = 'dialog-title',
  ...props
}, ref) => (
  <h2
    ref={ref}
    className={`text-lg font-semibold text-gray-900 ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </h2>
));

DialogTitle.displayName = 'DialogTitle';

// ============================================================================
// DIALOG DESCRIPTION COMPONENT
// ============================================================================

/**
 * Dialog description
 */
export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(({
  className = '',
  children,
  testId = 'dialog-description',
  ...props
}, ref) => (
  <p
    ref={ref}
    className={`mt-1 text-sm text-gray-500 ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </p>
));

DialogDescription.displayName = 'DialogDescription';

// ============================================================================
// DIALOG BODY COMPONENT
// ============================================================================

/**
 * Dialog body section
 */
export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(({
  className = '',
  children,
  testId = 'dialog-body',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`px-6 py-4 ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </div>
));

DialogBody.displayName = 'DialogBody';

// ============================================================================
// DIALOG FOOTER COMPONENT
// ============================================================================

/**
 * Dialog footer section
 */
export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(({
  className = '',
  children,
  testId = 'dialog-footer',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`px-6 py-4 bg-gray-50 rounded-b-lg flex items-center justify-end gap-3 ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </div>
));

DialogFooter.displayName = 'DialogFooter';

// ============================================================================
// DIALOG CLOSE COMPONENT
// ============================================================================

/**
 * Dialog close button
 */
export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(({
  asChild = false,
  onClick,
  children,
  testId = 'dialog-close-btn',
  ...props
}, ref) => {
  const { setOpen } = useDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: typeof handleClick }>, {
      onClick: handleClick,
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      data-testid={testId}
      {...props}
    >
      {children}
    </button>
  );
});

DialogClose.displayName = 'DialogClose';

// ============================================================================
// CONFIRM DIALOG PRESET
// ============================================================================

/**
 * Confirm dialog props
 */
export interface ConfirmDialogProps {
  /** Open state */
  open: boolean;
  /** Open change handler */
  onOpenChange: (open: boolean) => void;
  /** Title */
  title: string;
  /** Description/message */
  description: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm handler */
  onConfirm: () => void;
  /** Cancel handler */
  onCancel?: () => void;
  /** Variant */
  variant?: 'default' | 'destructive';
  /** Loading state */
  loading?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Confirmation dialog preset
 */
export const ConfirmDialog = memo<ConfirmDialogProps>(({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  loading = false,
  testId = 'confirm-dialog',
}) => {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const confirmButtonStyles = variant === 'destructive'
    ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" testId={testId}>
        <DialogHeader>
          <DialogTitle testId={`${testId}-title`}>{title}</DialogTitle>
          <DialogDescription testId={`${testId}-description`}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            data-testid={`${testId}-cancel`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmButtonStyles}`}
            data-testid={`${testId}-confirm`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Loading...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

// ============================================================================
// FORM DIALOG PRESET
// ============================================================================

/**
 * Form dialog props
 */
export interface FormDialogProps {
  /** Open state */
  open: boolean;
  /** Open change handler */
  onOpenChange: (open: boolean) => void;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Form content */
  children: React.ReactNode;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Submit handler */
  onSubmit: (e: React.FormEvent) => void;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Dialog size */
  size?: DialogSize;
  /** Test ID */
  testId?: string;
}

/**
 * Form dialog preset
 */
export const FormDialog = memo<FormDialogProps>(({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitText = 'Save',
  cancelText = 'Cancel',
  onSubmit,
  onCancel,
  loading = false,
  size = 'md',
  testId = 'form-dialog',
}) => {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} testId={testId}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle testId={`${testId}-title`}>{title}</DialogTitle>
            {description && (
              <DialogDescription testId={`${testId}-description`}>
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody testId={`${testId}-body`}>
            {children}
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid={`${testId}-cancel`}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid={`${testId}-submit`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Saving...
                </span>
              ) : (
                submitText
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

FormDialog.displayName = 'FormDialog';

// ============================================================================
// CREATE PROJECT DIALOG PRESET
// ============================================================================

/**
 * Create project dialog props
 */
export interface CreateProjectDialogProps {
  /** Open state */
  open: boolean;
  /** Open change handler */
  onOpenChange: (open: boolean) => void;
  /** Create handler */
  onCreate: (data: { name: string; description: string; targetUrl: string }) => void;
  /** Loading state */
  loading?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Create project dialog preset
 */
export const CreateProjectDialog = memo<CreateProjectDialogProps>(({
  open,
  onOpenChange,
  onCreate,
  loading = false,
  testId = 'create-project-dialog',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [errors, setErrors] = useState<{ name?: string; targetUrl?: string }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setTargetUrl('');
      setErrors({});
    }
  }, [open]);

  const validate = () => {
    const newErrors: { name?: string; targetUrl?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (!targetUrl.trim()) {
      newErrors.targetUrl = 'Target URL is required';
    } else if (!/^https?:\/\/.+/.test(targetUrl)) {
      newErrors.targetUrl = 'Please enter a valid URL starting with http:// or https://';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    onCreate({
      name: name.trim(),
      description: description.trim(),
      targetUrl: targetUrl.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" testId={testId}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter the details for your new automation project.
            </DialogDescription>
          </DialogHeader>
          
          <DialogBody>
            <div className="space-y-4">
              {/* Name field */}
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Automation Project"
                  className={`
                    w-full px-3 py-2 border rounded-md text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.name ? 'border-red-500' : 'border-gray-300'}
                  `}
                  data-testid={`${testId}-name-input`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                )}
              </div>
              
              {/* Description field */}
              <div>
                <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this automation does..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid={`${testId}-description-input`}
                />
              </div>
              
              {/* Target URL field */}
              <div>
                <label htmlFor="project-url" className="block text-sm font-medium text-gray-700 mb-1">
                  Target URL <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-url"
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com"
                  className={`
                    w-full px-3 py-2 border rounded-md text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.targetUrl ? 'border-red-500' : 'border-gray-300'}
                  `}
                  data-testid={`${testId}-url-input`}
                />
                {errors.targetUrl && (
                  <p className="mt-1 text-sm text-red-500">{errors.targetUrl}</p>
                )}
              </div>
            </div>
          </DialogBody>
          
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid={`${testId}-cancel`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid={`${testId}-submit`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Creating...
                </span>
              ) : (
                'Create Project'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

CreateProjectDialog.displayName = 'CreateProjectDialog';

// ============================================================================
// DELETE CONFIRMATION DIALOG PRESET
// ============================================================================

/**
 * Delete confirmation dialog props
 */
export interface DeleteConfirmDialogProps {
  /** Open state */
  open: boolean;
  /** Open change handler */
  onOpenChange: (open: boolean) => void;
  /** Item name to delete */
  itemName: string;
  /** Item type (project, step, etc.) */
  itemType?: string;
  /** Delete handler */
  onDelete: () => void;
  /** Loading state */
  loading?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Delete confirmation dialog preset
 */
export const DeleteConfirmDialog = memo<DeleteConfirmDialogProps>(({
  open,
  onOpenChange,
  itemName,
  itemType = 'item',
  onDelete,
  loading = false,
  testId = 'delete-confirm-dialog',
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title={`Delete ${itemType}?`}
    description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
    confirmText="Delete"
    cancelText="Cancel"
    variant="destructive"
    onConfirm={onDelete}
    loading={loading}
    testId={testId}
  />
));

DeleteConfirmDialog.displayName = 'DeleteConfirmDialog';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ============================================================================
// CSS ANIMATIONS (add to Tailwind config)
// ============================================================================

/**
 * Add to tailwind.config.js:
 * 
 * module.exports = {
 *   theme: {
 *     extend: {
 *       keyframes: {
 *         'fade-in': {
 *           '0%': { opacity: '0' },
 *           '100%': { opacity: '1' },
 *         },
 *         'scale-in': {
 *           '0%': { opacity: '0', transform: 'scale(0.95)' },
 *           '100%': { opacity: '1', transform: 'scale(1)' },
 *         },
 *       },
 *       animation: {
 *         'fade-in': 'fade-in 0.15s ease-out',
 *         'scale-in': 'scale-in 0.2s ease-out',
 *       },
 *     },
 *   },
 * };
 */

// ============================================================================
// EXPORTS
// ============================================================================

export default Dialog;
