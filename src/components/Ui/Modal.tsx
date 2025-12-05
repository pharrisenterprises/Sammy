/**
 * Modal - Dialog overlay component
 * @module components/Ui/Modal
 * @version 1.0.0
 * 
 * Provides modal dialogs with multiple features:
 * - Sizes: sm, md, lg, xl, full
 * - Variants: default, danger, success
 * - Focus trap for accessibility
 * - Backdrop click to close
 * - Escape key to close
 * - Scroll lock on body
 * 
 * @example
 * ```tsx
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm Delete">
 *   <p>Are you sure you want to delete this item?</p>
 *   <ModalFooter>
 *     <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button variant="destructive" onClick={handleDelete}>Delete</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */

import React, {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Modal size variants
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Modal variant
 */
export type ModalVariant = 'default' | 'danger' | 'success' | 'warning' | 'info';

/**
 * Modal props
 */
export interface ModalProps {
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: React.ReactNode;
  /** Modal description */
  description?: React.ReactNode;
  /** Modal content */
  children: React.ReactNode;
  /** Size variant */
  size?: ModalSize;
  /** Visual variant */
  variant?: ModalVariant;
  /** Close on backdrop click */
  closeOnBackdropClick?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Center modal vertically */
  centered?: boolean;
  /** Prevent body scroll when open */
  lockScroll?: boolean;
  /** Custom header content (replaces title) */
  header?: React.ReactNode;
  /** Custom footer content */
  footer?: React.ReactNode;
  /** Additional CSS classes for overlay */
  overlayClassName?: string;
  /** Additional CSS classes for content */
  className?: string;
  /** Test ID */
  testId?: string;
  /** Accessible label */
  'aria-label'?: string;
  /** ID of element describing the modal */
  'aria-describedby'?: string;
}

/**
 * Modal header props
 */
export interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Modal body props
 */
export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Modal footer props
 */
export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
  testId?: string;
}

/**
 * Confirmation modal props
 */
export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  testId?: string;
}

/**
 * Alert modal props
 */
export interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  buttonText?: string;
  variant?: ModalVariant;
  testId?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface ModalContextValue {
  onClose: () => void;
  titleId: string;
  descriptionId: string;
}

const ModalContext = createContext<ModalContextValue | null>(null);

const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal compound components must be used within a Modal');
  }
  return context;
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Size configurations
 */
const SIZE_CLASSES: Record<ModalSize, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

/**
 * Variant styles for header icons/colors
 */
const VARIANT_STYLES: Record<ModalVariant, { icon: string; border: string; iconBg: string }> = {
  default: {
    icon: 'text-gray-500',
    border: 'border-gray-200',
    iconBg: 'bg-gray-100',
  },
  danger: {
    icon: 'text-red-500',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
  },
  success: {
    icon: 'text-green-500',
    border: 'border-green-200',
    iconBg: 'bg-green-100',
  },
  warning: {
    icon: 'text-yellow-500',
    border: 'border-yellow-200',
    iconBg: 'bg-yellow-100',
  },
  info: {
    icon: 'text-blue-500',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
  },
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to lock body scroll
 */
const useScrollLock = (lock: boolean) => {
  useEffect(() => {
    if (!lock) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [lock]);
};

/**
 * Hook for focus trap
 */
const useFocusTrap = (containerRef: React.RefObject<HTMLElement>, active: boolean) => {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector = 
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    
    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Focus first focusable element
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      // Small delay to ensure modal is rendered
      requestAnimationFrame(() => {
        focusable[0].focus();
      });
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
};

/**
 * Hook to restore focus on close
 */
const useFocusRestore = (active: boolean) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [active]);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique ID
 */
let idCounter = 0;
const generateId = (prefix: string) => `${prefix}-${++idCounter}`;

// ============================================================================
// MODAL OVERLAY COMPONENT
// ============================================================================

interface ModalOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
  closeOnBackdropClick: boolean;
  centered: boolean;
  overlayClassName: string;
  testId: string;
}

const ModalOverlay: React.FC<ModalOverlayProps> = ({
  children,
  onClose,
  closeOnBackdropClick,
  centered,
  overlayClassName,
  testId,
}) => {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && closeOnBackdropClick) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  return (
    <div
      className={`
        fixed inset-0 z-50 overflow-y-auto
        bg-black/50 backdrop-blur-sm
        transition-opacity duration-200
        ${overlayClassName}
      `}
      onClick={handleBackdropClick}
      data-testid={`${testId}-overlay`}
    >
      <div
        className={`
          flex min-h-full p-4
          ${centered ? 'items-center' : 'items-start pt-[10vh]'}
          justify-center
        `}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

/**
 * Modal component
 */
export const Modal = memo<ModalProps>(({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  variant = 'default',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  centered = true,
  lockScroll = true,
  header,
  footer,
  overlayClassName = '',
  className = '',
  testId = 'modal',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Generate IDs for accessibility
  const titleId = useMemo(() => generateId('modal-title'), []);
  const descriptionId = useMemo(() => generateId('modal-description'), []);

  // Hooks
  useScrollLock(open && lockScroll);
  useFocusTrap(modalRef, open);
  useFocusRestore(open);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Animation state
  useEffect(() => {
    if (open) {
      // Small delay for enter animation
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [open]);

  // Context value
  const contextValue = useMemo(
    () => ({ onClose, titleId, descriptionId }),
    [onClose, titleId, descriptionId]
  );

  // Don't render if not open
  if (!open) return null;

  const variantStyles = VARIANT_STYLES[variant];

  return createPortal(
    <ModalContext.Provider value={contextValue}>
      <ModalOverlay
        onClose={onClose}
        closeOnBackdropClick={closeOnBackdropClick}
        centered={centered}
        overlayClassName={overlayClassName}
        testId={testId}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={ariaDescribedBy || (description ? descriptionId : undefined)}
          aria-label={ariaLabel}
          className={`
            relative w-full ${SIZE_CLASSES[size]}
            bg-white rounded-lg shadow-xl
            transform transition-all duration-200
            ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            ${className}
          `}
          data-testid={testId}
        >
          {/* Close button */}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="
                absolute top-4 right-4 p-1
                text-gray-400 hover:text-gray-600
                rounded-md hover:bg-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
              aria-label="Close modal"
              data-testid={`${testId}-close-button`}
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}

          {/* Header */}
          {header || (title && (
            <div
              className={`px-6 pt-6 pb-4 ${description ? '' : 'pb-2'}`}
              data-testid={`${testId}-header`}
            >
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900 pr-8"
              >
                {title}
              </h2>
              {description && (
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-gray-500"
                >
                  {description}
                </p>
              )}
            </div>
          ))}

          {/* Body */}
          <div
            className={`px-6 ${title || header ? 'py-2' : 'pt-6 pb-2'}`}
            data-testid={`${testId}-body`}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div
              className="px-6 py-4 bg-gray-50 rounded-b-lg"
              data-testid={`${testId}-footer`}
            >
              {footer}
            </div>
          )}
        </div>
      </ModalOverlay>
    </ModalContext.Provider>,
    document.body
  );
});

Modal.displayName = 'Modal';

// ============================================================================
// MODAL HEADER COMPONENT
// ============================================================================

/**
 * Modal header component
 */
export const ModalHeader = memo<ModalHeaderProps>(({
  children,
  className = '',
  testId = 'modal-header',
}) => (
  <div
    className={`px-6 pt-6 pb-4 ${className}`}
    data-testid={testId}
  >
    {children}
  </div>
));

ModalHeader.displayName = 'ModalHeader';

// ============================================================================
// MODAL TITLE COMPONENT
// ============================================================================

/**
 * Modal title component
 */
export interface ModalTitleProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export const ModalTitle = memo<ModalTitleProps>(({
  children,
  className = '',
  testId = 'modal-title',
}) => {
  const { titleId } = useModalContext();
  
  return (
    <h2
      id={titleId}
      className={`text-lg font-semibold text-gray-900 ${className}`}
      data-testid={testId}
    >
      {children}
    </h2>
  );
});

ModalTitle.displayName = 'ModalTitle';

// ============================================================================
// MODAL DESCRIPTION COMPONENT
// ============================================================================

/**
 * Modal description component
 */
export interface ModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export const ModalDescription = memo<ModalDescriptionProps>(({
  children,
  className = '',
  testId = 'modal-description',
}) => {
  const { descriptionId } = useModalContext();
  
  return (
    <p
      id={descriptionId}
      className={`mt-1 text-sm text-gray-500 ${className}`}
      data-testid={testId}
    >
      {children}
    </p>
  );
});

ModalDescription.displayName = 'ModalDescription';

// ============================================================================
// MODAL BODY COMPONENT
// ============================================================================

/**
 * Modal body component
 */
export const ModalBody = memo<ModalBodyProps>(({
  children,
  className = '',
  testId = 'modal-body',
}) => (
  <div
    className={`px-6 py-4 ${className}`}
    data-testid={testId}
  >
    {children}
  </div>
));

ModalBody.displayName = 'ModalBody';

// ============================================================================
// MODAL FOOTER COMPONENT
// ============================================================================

/**
 * Modal footer component
 */
export const ModalFooter = memo<ModalFooterProps>(({
  children,
  className = '',
  align = 'right',
  testId = 'modal-footer',
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-6 py-4
        bg-gray-50 rounded-b-lg
        ${alignClasses[align]}
        ${className}
      `}
      data-testid={testId}
    >
      {children}
    </div>
  );
});

ModalFooter.displayName = 'ModalFooter';

// ============================================================================
// CONFIRMATION MODAL COMPONENT
// ============================================================================

/**
 * Pre-built confirmation modal
 */
export const ConfirmModal = memo<ConfirmModalProps>(({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  testId = 'confirm-modal',
}) => {
  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const variantButtonClasses = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  };

  const variantIconBg = {
    danger: 'bg-red-100',
    warning: 'bg-yellow-100',
    info: 'bg-blue-100',
  };

  const variantIconColor = {
    danger: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      testId={testId}
    >
      <div className="flex gap-4">
        {/* Icon */}
        <div
          className={`
            flex-shrink-0 w-10 h-10 rounded-full
            flex items-center justify-center
            ${variantIconBg[variant]}
          `}
        >
          {variant === 'danger' ? (
            <AlertIcon className={`w-5 h-5 ${variantIconColor[variant]}`} />
          ) : variant === 'warning' ? (
            <WarningIcon className={`w-5 h-5 ${variantIconColor[variant]}`} />
          ) : (
            <InfoIcon className={`w-5 h-5 ${variantIconColor[variant]}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3
            className="text-lg font-semibold text-gray-900"
            data-testid={`${testId}-title`}
          >
            {title}
          </h3>
          <div
            className="mt-2 text-sm text-gray-500"
            data-testid={`${testId}-message`}
          >
            {message}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="
            px-4 py-2 text-sm font-medium text-gray-700
            bg-white border border-gray-300 rounded-md
            hover:bg-gray-50 focus:outline-none focus:ring-2
            focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
          data-testid={`${testId}-cancel`}
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading}
          className={`
            px-4 py-2 text-sm font-medium text-white
            rounded-md focus:outline-none focus:ring-2
            focus:ring-offset-2 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${variantButtonClasses[variant]}
          `}
          data-testid={`${testId}-confirm`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner className="w-4 h-4" />
              Processing...
            </span>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </Modal>
  );
});

ConfirmModal.displayName = 'ConfirmModal';

// ============================================================================
// ALERT MODAL COMPONENT
// ============================================================================

/**
 * Pre-built alert modal (single button)
 */
export const AlertModal = memo<AlertModalProps>(({
  open,
  onClose,
  title,
  message,
  buttonText = 'OK',
  variant = 'info',
  testId = 'alert-modal',
}) => {
  const variantIconBg = {
    default: 'bg-gray-100',
    danger: 'bg-red-100',
    success: 'bg-green-100',
    warning: 'bg-yellow-100',
    info: 'bg-blue-100',
  };

  const variantIconColor = {
    default: 'text-gray-600',
    danger: 'text-red-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  const VariantIcon = {
    default: InfoIcon,
    danger: AlertIcon,
    success: CheckIcon,
    warning: WarningIcon,
    info: InfoIcon,
  }[variant];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      testId={testId}
    >
      <div className="text-center">
        {/* Icon */}
        <div
          className={`
            mx-auto w-12 h-12 rounded-full
            flex items-center justify-center
            ${variantIconBg[variant]}
          `}
        >
          <VariantIcon className={`w-6 h-6 ${variantIconColor[variant]}`} />
        </div>

        {/* Content */}
        <h3
          className="mt-4 text-lg font-semibold text-gray-900"
          data-testid={`${testId}-title`}
        >
          {title}
        </h3>
        <div
          className="mt-2 text-sm text-gray-500"
          data-testid={`${testId}-message`}
        >
          {message}
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={onClose}
          className="
            mt-6 w-full px-4 py-2 text-sm font-medium
            text-white bg-blue-600 rounded-md
            hover:bg-blue-700 focus:outline-none focus:ring-2
            focus:ring-blue-500 focus:ring-offset-2
            transition-colors
          "
          data-testid={`${testId}-button`}
        >
          {buttonText}
        </button>
      </div>
    </Modal>
  );
});

AlertModal.displayName = 'AlertModal';

// ============================================================================
// FORM MODAL COMPONENT
// ============================================================================

/**
 * Form modal props
 */
export interface FormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  submitText?: string;
  cancelText?: string;
  isSubmitting?: boolean;
  size?: ModalSize;
  testId?: string;
}

/**
 * Pre-built form modal
 */
export const FormModal = memo<FormModalProps>(({
  open,
  onClose,
  onSubmit,
  title,
  description,
  children,
  submitText = 'Submit',
  cancelText = 'Cancel',
  isSubmitting = false,
  size = 'md',
  testId = 'form-modal',
}) => {
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(e);
    },
    [onSubmit]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      testId={testId}
    >
      <form onSubmit={handleSubmit} data-testid={`${testId}-form`}>
        <div className="space-y-4">
          {children}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="
              px-4 py-2 text-sm font-medium text-gray-700
              bg-white border border-gray-300 rounded-md
              hover:bg-gray-50 focus:outline-none focus:ring-2
              focus:ring-blue-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
            data-testid={`${testId}-cancel`}
          >
            {cancelText}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="
              px-4 py-2 text-sm font-medium text-white
              bg-blue-600 rounded-md hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:ring-offset-2 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            data-testid={`${testId}-submit`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Processing...
              </span>
            ) : (
              submitText
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
});

FormModal.displayName = 'FormModal';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default Modal;
