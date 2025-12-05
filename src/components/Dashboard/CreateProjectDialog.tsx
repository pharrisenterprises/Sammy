/**
 * CreateProjectDialog - Dialog for creating new projects
 * @module components/Dashboard/CreateProjectDialog
 * @version 1.0.0
 * 
 * Provides a modal form for project creation:
 * - Name field (required)
 * - Description field (optional)
 * - Target URL field (required, validated)
 * - Form validation and error display
 * - Loading state during submission
 * 
 * @example
 * ```tsx
 * <CreateProjectDialog
 *   isOpen={showDialog}
 *   onClose={() => setShowDialog(false)}
 *   onCreate={(project) => handleCreate(project)}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project creation data
 */
export interface CreateProjectData {
  name: string;
  description: string;
  target_url: string;
}

/**
 * Form field errors
 */
export interface FormErrors {
  name?: string;
  description?: string;
  target_url?: string;
}

/**
 * Component props
 */
export interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateProjectData) => Promise<void> | void;
  initialData?: Partial<CreateProjectData>;
  isLoading?: boolean;
  title?: string;
  submitLabel?: string;
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FORM_DATA: CreateProjectData = {
  name: '',
  description: '',
  target_url: '',
};

const URL_PATTERN = /^https?:\/\/.+/i;

const VALIDATION_MESSAGES = {
  nameRequired: 'Project name is required',
  nameMaxLength: 'Project name must be 100 characters or less',
  descriptionMaxLength: 'Description must be 500 characters or less',
  urlRequired: 'Target URL is required',
  urlInvalid: 'URL must start with http:// or https://',
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate form data
 */
export function validateFormData(data: CreateProjectData): FormErrors {
  const errors: FormErrors = {};

  // Name validation
  if (!data.name.trim()) {
    errors.name = VALIDATION_MESSAGES.nameRequired;
  } else if (data.name.length > 100) {
    errors.name = VALIDATION_MESSAGES.nameMaxLength;
  }

  // Description validation
  if (data.description.length > 500) {
    errors.description = VALIDATION_MESSAGES.descriptionMaxLength;
  }

  // URL validation
  if (!data.target_url.trim()) {
    errors.target_url = VALIDATION_MESSAGES.urlRequired;
  } else if (!URL_PATTERN.test(data.target_url.trim())) {
    errors.target_url = VALIDATION_MESSAGES.urlInvalid;
  }

  return errors;
}

/**
 * Check if form has errors
 */
export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Form field component
 */
const FormField: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = memo(({ id, label, required = false, error, children }) => (
  <div className="space-y-1.5">
    <label
      htmlFor={id}
      className="block text-sm font-medium text-gray-700"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-sm text-red-600" role="alert" data-testid={`${id}-error`}>
        {error}
      </p>
    )}
  </div>
));

FormField.displayName = 'FormField';

/**
 * Text input component
 */
const TextInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  type?: 'text' | 'url';
  testId?: string;
}> = memo(({
  id,
  value,
  onChange,
  placeholder,
  error = false,
  disabled = false,
  autoFocus = false,
  type = 'text',
  testId,
}) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    autoFocus={autoFocus}
    className={`
      w-full px-3 py-2 rounded-md border shadow-sm text-sm
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      ${error
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
      }
    `}
    aria-invalid={error}
    data-testid={testId ?? id}
  />
));

TextInput.displayName = 'TextInput';

/**
 * Textarea component
 */
const TextArea: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  rows?: number;
  testId?: string;
}> = memo(({
  id,
  value,
  onChange,
  placeholder,
  error = false,
  disabled = false,
  rows = 3,
  testId,
}) => (
  <textarea
    id={id}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    rows={rows}
    className={`
      w-full px-3 py-2 rounded-md border shadow-sm text-sm resize-none
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      ${error
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
      }
    `}
    aria-invalid={error}
    data-testid={testId ?? id}
  />
));

TextArea.displayName = 'TextArea';

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
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
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CreateProjectDialog component
 */
export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = memo(({
  isOpen,
  onClose,
  onCreate,
  initialData,
  isLoading: externalLoading = false,
  title = 'Create New Project',
  submitLabel = 'Create Project',
  testId = 'create-project-dialog',
}) => {
  // Form state
  const [formData, setFormData] = useState<CreateProjectData>({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Combined loading state
  const isLoading = externalLoading || isSubmitting;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...DEFAULT_FORM_DATA, ...initialData });
      setErrors({});
      setTouched({});
      // Focus first input after dialog opens
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        isOpen &&
        !isLoading
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isLoading, onClose]);

  // Update field value
  const updateField = useCallback((field: keyof CreateProjectData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Mark field as touched
  const touchField = useCallback((field: keyof CreateProjectData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Validate single field
  const validateField = useCallback((field: keyof CreateProjectData) => {
    const fieldErrors = validateFormData(formData);
    if (fieldErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }));
    }
  }, [formData]);

  // Handle field blur
  const handleBlur = useCallback((field: keyof CreateProjectData) => {
    touchField(field);
    validateField(field);
  }, [touchField, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const validationErrors = validateFormData(formData);
    setErrors(validationErrors);
    setTouched({ name: true, description: true, target_url: true });

    if (hasErrors(validationErrors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        target_url: formData.target_url.trim(),
      });
      onClose();
    } catch (err) {
      // Error handling - could add error state here
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onCreate, onClose]);

  // Handle Enter key in form
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }, [handleSubmit]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" aria-hidden="true" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icons.Plus />
            </div>
            <h2 id={`${testId}-title`} className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close dialog"
            data-testid={`${testId}-close`}
          >
            <Icons.Close />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Name Field */}
            <FormField
              id="project-name"
              label="Project Name"
              required
              error={touched.name ? errors.name : undefined}
            >
              <TextInput
                id="project-name"
                value={formData.name}
                onChange={(value) => updateField('name', value)}
                placeholder="Enter project name"
                error={touched.name && !!errors.name}
                disabled={isLoading}
                autoFocus
                testId={`${testId}-name`}
              />
            </FormField>

            {/* Description Field */}
            <FormField
              id="project-description"
              label="Description"
              error={touched.description ? errors.description : undefined}
            >
              <TextArea
                id="project-description"
                value={formData.description}
                onChange={(value) => updateField('description', value)}
                placeholder="Enter project description (optional)"
                error={touched.description && !!errors.description}
                disabled={isLoading}
                rows={3}
                testId={`${testId}-description`}
              />
            </FormField>

            {/* Target URL Field */}
            <FormField
              id="project-url"
              label="Target URL"
              required
              error={touched.target_url ? errors.target_url : undefined}
            >
              <TextInput
                id="project-url"
                type="url"
                value={formData.target_url}
                onChange={(value) => updateField('target_url', value)}
                placeholder="https://example.com"
                error={touched.target_url && !!errors.target_url}
                disabled={isLoading}
                testId={`${testId}-url`}
              />
              <p className="mt-1 text-xs text-gray-500">
                The URL where recording will start
              </p>
            </FormField>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid={`${testId}-cancel`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid={`${testId}-submit`}
            >
              {isLoading && <Icons.Spinner />}
              {isLoading ? 'Creating...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CreateProjectDialog.displayName = 'CreateProjectDialog';

// ============================================================================
// EXPORTS
// ============================================================================

export default CreateProjectDialog;
