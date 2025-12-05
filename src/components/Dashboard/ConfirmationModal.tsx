/**
 * ConfirmationModal - Generic confirmation dialog component
 * @module components/Dashboard/ConfirmationModal
 * @version 1.0.0
 * 
 * Provides a reusable confirmation dialog:
 * - Multiple variants (danger, warning, info)
 * - Customizable title, message, and button labels
 * - Loading state support
 * - Keyboard support (Enter to confirm, Escape to cancel)
 * - Accessible with proper ARIA attributes
 * 
 * @example
 * ```tsx
 * <ConfirmationModal
 *   isOpen={showConfirm}
 *   variant="danger"
 *   title="Delete Project"
 *   message={`Are you sure you want to delete "${projectName}"?`}
 *   confirmLabel="Delete"
 *   onConfirm={() => handleDelete(projectId)}
 *   onCancel={() => setShowConfirm(false)}
 * />
 * ```
 */

import React, { useCallback, useEffect, useRef, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Modal variant
 */
export type ConfirmationVariant = 'danger' | 'warning' | 'info';

/**
 * Component props
 */
export interface ConfirmationModalProps {
  isOpen: boolean;
  variant?: ConfirmationVariant;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
  showIcon?: boolean;
  testId?: string;
}

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Danger: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Warning: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Info: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Close: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Spinner: () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Variant configuration
 */
const VariantConfig: Record<ConfirmationVariant, {
  iconBgColor: string;
  iconColor: string;
  confirmBgColor: string;
  confirmHoverColor: string;
  focusRingColor: string;
  icon: React.FC;
}> = {
  danger: {
    iconBgColor: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmBgColor: 'bg-red-600',
    confirmHoverColor: 'hover:bg-red-700',
    focusRingColor: 'focus:ring-red-500',
    icon: Icons.Danger,
  },
  warning: {
    iconBgColor: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    confirmBgColor: 'bg-yellow-600',
    confirmHoverColor: 'hover:bg-yellow-700',
    focusRingColor: 'focus:ring-yellow-500',
    icon: Icons.Warning,
  },
  info: {
    iconBgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmBgColor: 'bg-blue-600',
    confirmHoverColor: 'hover:bg-blue-700',
    focusRingColor: 'focus:ring-blue-500',
    icon: Icons.Info,
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ConfirmationModal component
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = memo(({
  isOpen,
  variant = 'danger',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  showIcon = true,
  testId = 'confirmation-modal',
}) => {
  // Refs
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Get variant config
  const config = VariantConfig[variant];
  const IconComponent = config.icon;

  // Focus confirm button when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmButtonRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isLoading) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (isLoading) return;
    await onConfirm();
  }, [isLoading, onConfirm]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  }, [isLoading, onCancel]);

  // Handle key press on buttons
  const handleKeyPress = useCallback((e: React.KeyboardEvent, action: 'confirm' | 'cancel') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'confirm') {
        handleConfirm();
      } else {
        onCancel();
      }
    }
  }, [handleConfirm, onCancel]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid={testId}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
      aria-describedby={`${testId}-description`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity" 
        aria-hidden="true" 
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all"
      >
        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            {showIcon && (
              <div 
                className={`flex-shrink-0 p-3 rounded-full ${config.iconBgColor}`}
                data-testid={`${testId}-icon`}
              >
                <span className={config.iconColor}>
                  <IconComponent />
                </span>
              </div>
            )}

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              <h3
                id={`${testId}-title`}
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h3>
              <div
                id={`${testId}-description`}
                className="mt-2 text-sm text-gray-500"
              >
                {typeof message === 'string' ? (
                  <p>{message}</p>
                ) : (
                  message
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors disabled:opacity-50"
              aria-label="Close"
              data-testid={`${testId}-close`}
            >
              <Icons.Close />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            onKeyDown={(e) => handleKeyPress(e, 'cancel')}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            onKeyDown={(e) => handleKeyPress(e, 'confirm')}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${config.confirmBgColor} ${config.confirmHoverColor} ${config.focusRingColor}`}
            data-testid={`${testId}-confirm`}
          >
            {isLoading && <Icons.Spinner />}
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmationModal.displayName = 'ConfirmationModal';

// ============================================================================
// PRESET VARIANTS
// ============================================================================

/**
 * Delete confirmation modal preset
 */
export interface DeleteConfirmationProps {
  isOpen: boolean;
  itemName: string;
  itemType?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
  testId?: string;
}

export const DeleteConfirmation: React.FC<DeleteConfirmationProps> = memo(({
  isOpen,
  itemName,
  itemType = 'item',
  onConfirm,
  onCancel,
  isLoading = false,
  testId = 'delete-confirmation',
}) => (
  <ConfirmationModal
    isOpen={isOpen}
    variant="danger"
    title={`Delete ${itemType}`}
    message={
      <>
        Are you sure you want to delete <strong className="text-gray-900">{itemName}</strong>? 
        This action cannot be undone.
      </>
    }
    confirmLabel="Delete"
    cancelLabel="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    isLoading={isLoading}
    testId={testId}
  />
));

DeleteConfirmation.displayName = 'DeleteConfirmation';

/**
 * Discard changes confirmation modal preset
 */
export interface DiscardConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

export const DiscardConfirmation: React.FC<DiscardConfirmationProps> = memo(({
  isOpen,
  onConfirm,
  onCancel,
  testId = 'discard-confirmation',
}) => (
  <ConfirmationModal
    isOpen={isOpen}
    variant="warning"
    title="Discard Changes"
    message="You have unsaved changes. Are you sure you want to discard them?"
    confirmLabel="Discard"
    cancelLabel="Keep Editing"
    onConfirm={onConfirm}
    onCancel={onCancel}
    testId={testId}
  />
));

DiscardConfirmation.displayName = 'DiscardConfirmation';

/**
 * Stop test confirmation modal preset
 */
export interface StopTestConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

export const StopTestConfirmation: React.FC<StopTestConfirmationProps> = memo(({
  isOpen,
  onConfirm,
  onCancel,
  testId = 'stop-test-confirmation',
}) => (
  <ConfirmationModal
    isOpen={isOpen}
    variant="warning"
    title="Stop Test"
    message="The test is still running. Are you sure you want to stop it? Progress will be saved."
    confirmLabel="Stop Test"
    cancelLabel="Continue Running"
    onConfirm={onConfirm}
    onCancel={onCancel}
    testId={testId}
  />
));

StopTestConfirmation.displayName = 'StopTestConfirmation';

/**
 * Clear history confirmation modal preset
 */
export interface ClearHistoryConfirmationProps {
  isOpen: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
  testId?: string;
}

export const ClearHistoryConfirmation: React.FC<ClearHistoryConfirmationProps> = memo(({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  testId = 'clear-history-confirmation',
}) => (
  <ConfirmationModal
    isOpen={isOpen}
    variant="danger"
    title="Clear Test History"
    message="Are you sure you want to clear all test history for this project? This action cannot be undone."
    confirmLabel="Clear History"
    cancelLabel="Cancel"
    onConfirm={onConfirm}
    onCancel={onCancel}
    isLoading={isLoading}
    testId={testId}
  />
));

ClearHistoryConfirmation.displayName = 'ClearHistoryConfirmation';

// ============================================================================
// EXPORTS
// ============================================================================

export default ConfirmationModal;
export { Icons as ConfirmationIcons };
